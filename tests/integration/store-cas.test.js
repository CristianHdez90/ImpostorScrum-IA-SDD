'use strict';

/**
 * Concurrencia y CAS. Se ejecuta sobre:
 *  - almacén en MEMORIA, y
 *  - `redis-store` contra un servidor Redis REST SIMULADO en proceso.
 * El simulador reproduce la semántica de los scripts de lib/store/scripts.js;
 * NO es Upstash real (T-016 con Upstash queda pendiente de autorización).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApiHandler } = require('../../lib/api');
const { createMemoryStore } = require('../../lib/store/memory-store');
const { createRedisStore } = require('../../lib/store/redis-store');
const { mutateRoom, ConflictExhaustedError, RoomMissingError, StoreUnavailableError } = require('../../lib/store');
const { CREATE_ROOM, COMPARE_AND_SET, DELETE_IF_VERSION, RATE_HIT } = require('../../lib/store/scripts');
const { createRoomDoc } = require('../../lib/room');

const TTL = 21_600;

/** Redis REST simulado: hashes + TTL + scripts conocidos. */
function createFakeRedis() {
  const hashes = new Map();
  const ttls = new Map();
  const counters = new Map();
  const requests = [];
  function exec([cmd, ...args]) {
    switch (String(cmd).toUpperCase()) {
      case 'EVAL': {
        const [script, , key, ...argv] = args;
        if (script === CREATE_ROOM) {
          if (hashes.has(key)) return 0;
          hashes.set(key, new Map([['v', '1'], ['doc', argv[0]]]));
          ttls.set(key, Number(argv[1]));
          return 1;
        }
        if (script === COMPARE_AND_SET) {
          const h = hashes.get(key);
          if (!h) return -1;
          if (h.get('v') !== argv[0]) return 0;
          h.set('v', String(Number(h.get('v')) + 1));
          h.set('doc', argv[1]);
          ttls.set(key, Number(argv[2]));
          return 1;
        }
        if (script === DELETE_IF_VERSION) {
          const h = hashes.get(key);
          if (!h) return -1;
          if (h.get('v') !== argv[1]) return 0;
          hashes.delete(key);
          hashes.delete(argv[0]);
          return 1;
        }
        if (script === RATE_HIT) {
          const c = Number(counters.get(key) ?? 0) + 1;
          counters.set(key, c);
          if (c === 1) ttls.set(key, Number(argv[0]));
          return c;
        }
        return { error: 'NOSCRIPT' };
      }
      case 'HMGET': {
        const [key, ...fields] = args;
        const h = hashes.get(key);
        return fields.map((f) => (h && h.has(f) ? h.get(f) : null));
      }
      case 'HGETALL': {
        const h = hashes.get(args[0]);
        return h ? [...h.entries()].flat() : [];
      }
      case 'HSET': {
        const [key, ...pairs] = args;
        const h = hashes.get(key) ?? new Map();
        for (let i = 0; i < pairs.length; i += 2) h.set(pairs[i], String(pairs[i + 1]));
        hashes.set(key, h);
        return pairs.length / 2;
      }
      case 'EXPIRE':
        if (!hashes.has(args[0])) return 0;
        ttls.set(args[0], Number(args[1]));
        return 1;
      case 'PING':
        return 'PONG';
      default:
        return { error: 'unknown' };
    }
  }
  const wrap = (r) => (r && typeof r === 'object' && !Array.isArray(r) && r.error ? r : { result: r });
  async function fetchImpl(url, init) {
    requests.push({ url, headers: init.headers });
    assert.equal(init.headers.Authorization, 'Bearer token-de-prueba');
    const body = JSON.parse(init.body);
    await new Promise((r) => setImmediate(r)); // permitir intercalado entre peticiones
    const payload = url.endsWith('/pipeline') ? body.map((c) => wrap(exec(c))) : wrap(exec(body));
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return { fetchImpl, hashes, ttls, requests };
}

function redisStore(fake) {
  return createRedisStore({ url: 'https://redis-simulado.local/', token: 'token-de-prueba', prefix: 'farsante:test', ttlSeconds: TTL, timeoutMs: 1000, fetchImpl: fake.fetchImpl });
}

const STORES = {
  memoria: () => ({ store: createMemoryStore({ ttlSeconds: TTL }) }),
  'redis simulado': () => {
    const fake = createFakeRedis();
    return { store: redisStore(fake), fake };
  },
};

async function startInstances(store, count) {
  const instances = [];
  for (let i = 0; i < count; i += 1) {
    const server = http.createServer(createApiHandler({ store, syncMode: 'poll', log: () => {} }));
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${server.address().port}`;
    instances.push({
      server,
      join: (code, name) =>
        fetch(`${origin}/api/join`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ code, name }) })
          .then(async (r) => ({ status: r.status, data: await r.json() })),
    });
  }
  return { instances, close: () => Promise.all(instances.map((i) => new Promise((r) => i.server.close(r)))) };
}

async function seedRoom(store, code, playerCount) {
  const doc = createRoomDoc({ code, now: Date.now(), host: { id: 'p_0', name: 'Anfitrión', key: 'anfitrion', tokenHash: 'sha256:x' } });
  for (let i = 1; i < playerCount; i += 1) doc.players.push({ id: `p_${i}`, name: `J${i}`, nameKey: `j${i}`, joinedAt: 0, tokenHash: 'sha256:x' });
  assert.equal(await store.create(code, doc), true);
}

for (const [label, make] of Object.entries(STORES)) {
  test(`[${label}] CA-07 último cupo con entradas simultáneas desde dos instancias`, async (t) => {
    const { store } = make();
    await seedRoom(store, 'BCDFG', 11);
    const { instances, close } = await startInstances(store, 2);
    t.after(close);
    const results = await Promise.all([instances[0].join('BCDFG', 'Eva'), instances[1].join('BCDFG', 'Raúl')]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409]);
    assert.equal(results.find((r) => r.status === 409).data.error.code, 'ROOM_FULL');
    assert.equal((await store.read('BCDFG')).doc.players.length, 12);
  });

  test(`[${label}] entradas simultáneas sin pérdida de actualizaciones`, async (t) => {
    const { store } = make();
    await seedRoom(store, 'HJKLM', 1);
    const { instances, close } = await startInstances(store, 3);
    t.after(close);
    const names = ['Ana', 'Luis', 'Eva', 'Raúl', 'Sofía', 'Tomás', 'Lucía', 'Marta'];
    const results = await Promise.all(names.map((n, i) => instances[i % 3].join('HJKLM', n)));
    assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.status)));
    const room = await store.read('HJKLM');
    assert.equal(room.doc.players.length, 9);
    assert.equal(room.version, 9, 'una versión por entrada');
  });

  test(`[${label}] CA-02 colisión de código: se genera otro y la sala existente no cambia`, async () => {
    const { store } = make();
    await seedRoom(store, 'AAAAA', 1);
    const before = await store.read('AAAAA');
    const sequence = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]; // primero AAAAA (ocupado), luego BBBBB
    let i = 0;
    const handler = createApiHandler({ store, syncMode: 'poll', randomInt: () => sequence[i++], log: () => {} });
    const server = http.createServer(handler);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const res = await fetch(`${origin}/api/create`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: '{"name":"Nuevo"}' });
    const data = await res.json();
    server.close();
    assert.equal(res.status, 201);
    assert.equal(data.code, 'BBBBB');
    assert.deepEqual(await store.read('AAAAA'), before);
  });

  test(`[${label}] CAS sobre sala inexistente nunca la recrea`, async () => {
    const { store } = make();
    assert.equal(await store.cas('ZZZZZ', 1, { x: 1 }), 'missing');
    assert.equal(await store.read('ZZZZZ'), null);
    await assert.rejects(mutateRoom(store, 'ZZZZZ', (d) => d), RoomMissingError);
  });
}

test('mutateRoom agota reintentos ante conflictos continuos', async () => {
  let attempts = 0;
  const store = {
    read: async () => ({ version: 1, doc: { players: [] } }),
    cas: async () => { attempts += 1; return 'conflict'; },
  };
  await assert.rejects(mutateRoom(store, 'BCDFG', (d) => d, { sleep: async () => {}, random: () => 0 }), ConflictExhaustedError);
  assert.equal(attempts, 5);
});

test('mutateRoom respeta el presupuesto total de tiempo', async () => {
  let clock = 0;
  let attempts = 0;
  const store = {
    read: async () => ({ version: 1, doc: {} }),
    cas: async () => { attempts += 1; clock += 1_500; return 'conflict'; },
  };
  await assert.rejects(mutateRoom(store, 'BCDFG', (d) => d, { clock: () => clock, sleep: async () => {}, random: () => 0 }), ConflictExhaustedError);
  assert.ok(attempts < 5, `cortó por presupuesto tras ${attempts} intentos`);
});

test('[redis simulado] protocolo: TTL de 6 h, prefijo, presencia y sin el token en la URL', async () => {
  const fake = createFakeRedis();
  const store = redisStore(fake);
  await seedRoom(store, 'NPQRS', 1);
  assert.equal(fake.ttls.get('farsante:test:room:NPQRS'), TTL);
  await store.setPresence('NPQRS', 'p_0', 123);
  assert.deepEqual(await store.getPresence('NPQRS'), { p_0: 123 });
  assert.equal(fake.ttls.get('farsante:test:presence:NPQRS'), TTL);
  assert.equal(await store.ping(), true);
  assert.ok(fake.requests.every((r) => !r.url.includes('token-de-prueba')));
  assert.ok(fake.requests.some((r) => r.url === 'https://redis-simulado.local/pipeline'));
});

test('[redis simulado] errores de red, tiempo agotado y HTTP se traducen a StoreUnavailableError', async () => {
  const make = (impl) => createRedisStore({ url: 'https://x', token: 't', prefix: 'p', ttlSeconds: TTL, timeoutMs: 50, fetchImpl: impl });
  const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
  await assert.rejects(make(async () => { throw timeout; }).read('BCDFG'), (e) => e instanceof StoreUnavailableError && e.reason === 'timeout');
  await assert.rejects(make(async () => { throw new TypeError('fetch failed'); }).read('BCDFG'), (e) => e.reason === 'network');
  await assert.rejects(make(async () => new Response('x', { status: 401 })).read('BCDFG'), (e) => e.reason === 'http_401');
  await assert.rejects(make(async () => new Response('{"error":"ERR"}', { status: 200 })).read('BCDFG'), (e) => e.reason === 'command_error');
});
