'use strict';

/**
 * Validación contra Upstash Redis REAL (T-016, ADR-0002).
 *
 *   node --env-file=.env scripts/validate-upstash.js
 *
 * Comprueba: conexión, scripts Lua (crear, CAS, borrar, contador), TTL y
 * concurrencia entre dos instancias de la API. Usa un prefijo propio
 * («<REDIS_KEY_PREFIX>:validacion-xxxx») y borra sus claves al final.
 * Nunca imprime la URL completa ni el token.
 */
const http = require('node:http');
const crypto = require('node:crypto');
const config = require('../lib/config');
const { createRedisStore } = require('../lib/store/redis-store');
const { createApiHandler } = require('../lib/api');
const { createRoomDoc } = require('../lib/room');

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error('Faltan UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN. Ejecuta: node --env-file=.env scripts/validate-upstash.js');
  process.exit(1);
}
const host = new URL(url).host;
const prefix = `${process.env.REDIS_KEY_PREFIX || 'farsante:pruebas'}:validacion-${crypto.randomBytes(4).toString('hex')}`;
const TTL = config.ROOM_TTL_SECONDS;
const newStore = () => createRedisStore({ url, token, prefix, ttlSeconds: TTL, timeoutMs: 5000 });
const store = newStore();

async function raw(...args) {
  const res = await fetch(url.replace(/\/+$/u, ''), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Redis respondió un error en ${args[0]}`);
  return json.result;
}

const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`  ✘ ${name} — ${err.message}`);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function seed(code, players) {
  const doc = createRoomDoc({ code, now: Date.now(), host: { id: 'p_0', name: 'Anfitrión', key: 'anfitrion', tokenHash: 'sha256:prueba' } });
  for (let i = 1; i < players; i += 1) doc.players.push({ id: `p_${i}`, name: `J${i}`, nameKey: `j${i}`, joinedAt: 0, tokenHash: 'sha256:prueba' });
  return store.create(code, doc);
}

async function startInstances(count, counters) {
  const servers = [];
  for (let i = 0; i < count; i += 1) {
    // Cada instancia con su propio cliente, como dos funciones de Vercel.
    const handler = createApiHandler({
      store: newStore(),
      syncMode: 'poll',
      log: (e) => { if (e.event === 'cas_conflict') counters.conflicts += 1; },
    });
    const server = http.createServer(handler);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${server.address().port}`;
    servers.push({
      server,
      join: (code, name) => fetch(`${origin}/api/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ code, name }),
      }).then(async (r) => ({ status: r.status, data: await r.json() })),
    });
  }
  return servers;
}

async function cleanup() {
  let cursor = '0';
  let deleted = 0;
  do {
    const [next, keys] = await raw('SCAN', cursor, 'MATCH', `${prefix}:*`, 'COUNT', 500);
    cursor = String(next);
    if (keys.length) deleted += Number(await raw('DEL', ...keys));
  } while (cursor !== '0');
  const [, left] = await raw('SCAN', '0', 'MATCH', `${prefix}:*`, 'COUNT', 500);
  return { deleted, left: left.length };
}

(async () => {
  console.log(`Validando Upstash en ${host} con el prefijo «${prefix}»\n`);

  await check('Conexión (PING)', async () => {
    expect(await store.ping(), 'PING no respondió PONG');
  });

  await check('Crear sala con escritura condicional (script Lua)', async () => {
    expect(await seed('AAAAA', 1), 'no creó la sala');
    expect(!(await seed('AAAAA', 1)), 'permitió crear dos veces el mismo código');
    return 'el segundo intento con el mismo código se rechazó';
  });

  await check('TTL de 6 horas en la sala', async () => {
    const ttl = Number(await raw('TTL', `${prefix}:room:AAAAA`));
    expect(ttl > TTL - 60 && ttl <= TTL, `TTL inesperado: ${ttl}`);
    return `${ttl} s`;
  });

  await check('Escritura atómica CAS: éxito, conflicto y sala inexistente', async () => {
    const current = await store.read('AAAAA');
    expect(current && current.version === 1, 'versión inicial distinta de 1');
    expect((await store.cas('AAAAA', 1, { ...current.doc, lastActivityAt: 1 })) === 'ok', 'CAS válido rechazado');
    expect((await store.cas('AAAAA', 1, current.doc)) === 'conflict', 'CAS con versión vieja aceptado');
    expect((await store.cas('ZZZZZ', 1, current.doc)) === 'missing', 'CAS sobre sala inexistente no devolvió missing');
    expect((await store.read('ZZZZZ')) === null, 'CAS recreó una sala inexistente');
    return 'versión 1 → 2; versión vieja rechazada; no recrea salas';
  });

  await check('Contador de límite de solicitudes (script Lua)', async () => {
    const a = await store.hit('prueba:ip', 60);
    const b = await store.hit('prueba:ip', 60);
    expect(a === 1 && b === 2, `contador inesperado: ${a}, ${b}`);
    const ttl = Number(await raw('TTL', `${prefix}:rl:prueba:ip`));
    expect(ttl > 0 && ttl <= 60, `TTL del contador inesperado: ${ttl}`);
  });

  await check('Borrado condicional de sala vacía (script Lua)', async () => {
    await store.setPresence('AAAAA', 'p_0', Date.now());
    expect((await store.remove('AAAAA', 1)) === 'conflict', 'borró con versión vieja');
    expect((await store.remove('AAAAA', 2)) === 'ok', 'no borró con la versión vigente');
    expect((await store.read('AAAAA')) === null, 'la sala sigue existiendo');
    expect((await store.cas('AAAAA', 2, { x: 1 })) === 'missing', 'una escritura tardía recreó la sala');
    expect(Number(await raw('EXISTS', `${prefix}:presence:AAAAA`)) === 0, 'quedó la presencia');
  });

  const counters = { conflicts: 0 };
  const instances = await startInstances(2, counters);
  try {
    await check('CA-07 último cupo: dos entradas simultáneas desde dos instancias', async () => {
      await seed('BBBBB', 11);
      const results2 = await Promise.all([instances[0].join('BBBBB', 'Eva'), instances[1].join('BBBBB', 'Raúl')]);
      const statuses = results2.map((r) => r.status).sort();
      expect(JSON.stringify(statuses) === '[201,409]', `respuestas ${JSON.stringify(statuses)}`);
      const room = await store.read('BBBBB');
      expect(room.doc.players.length === 12, `quedaron ${room.doc.players.length} integrantes`);
      return 'una entra (201) y la otra recibe ROOM_FULL (409); 12 integrantes';
    });

    await check('T-016 entradas simultáneas sin pérdida de actualizaciones', async () => {
      await seed('CCCCC', 1);
      const names = ['Ana', 'Luis', 'Eva', 'Raúl', 'Sofía', 'Tomás', 'Lucía', 'Marta'];
      const responses = await Promise.all(names.map((n, i) => instances[i % 2].join('CCCCC', n)));
      const ok = responses.filter((r) => r.status === 201).length;
      const exhausted = responses.filter((r) => r.data.error && r.data.error.code === 'CONFLICT_RETRY_EXHAUSTED').length;
      const unexpected = responses.filter((r) => r.status !== 201 && !(r.data.error && r.data.error.code === 'CONFLICT_RETRY_EXHAUSTED'));
      expect(unexpected.length === 0, `respuestas inesperadas: ${unexpected.map((r) => r.status).join(', ')}`);
      const room = await store.read('CCCCC');
      expect(room.doc.players.length === 1 + ok, `pérdida de actualizaciones: ${room.doc.players.length} integrantes para ${ok} entradas aceptadas`);
      expect(room.version === 1 + ok, `versión ${room.version} para ${ok} entradas`);
      return `${ok}/8 aceptadas, ${exhausted} con reintentos agotados, ${counters.conflicts} conflictos CAS resueltos; sin pérdidas`;
    });
  } finally {
    await Promise.all(instances.map((i) => new Promise((r) => i.server.close(r))));
  }

  await check('Limpieza de las claves de la validación', async () => {
    const { deleted, left } = await cleanup();
    expect(left === 0, `quedaron ${left} claves`);
    return `${deleted} claves borradas`;
  });

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nResultado: ${results.length - failed}/${results.length} comprobaciones correctas.`);
  process.exitCode = failed ? 1 : 0;
})().catch(async (err) => {
  console.error(`\nLa validación se detuvo: ${err.message}`);
  try { await cleanup(); } catch { /* sin red: las claves expiran solas en ≤ 6 h */ }
  process.exitCode = 1;
});
