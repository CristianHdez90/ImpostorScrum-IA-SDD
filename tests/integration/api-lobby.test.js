'use strict';

/**
 * API de SPEC-FEAT-001 sobre servidor HTTP real (puerto efímero) con almacén
 * en MEMORIA y reloj controlado. No usa Redis ni Vercel.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApiHandler } = require('../../lib/api');
const { createMemoryStore } = require('../../lib/store/memory-store');
const { StoreUnavailableError } = require('../../lib/store');

const T0 = 1_763_478_000_000;

async function startServer({ store, clock } = {}) {
  const time = clock ?? { now: T0 };
  const memory = store ?? createMemoryStore({ ttlSeconds: 21_600, now: () => time.now });
  const handler = createApiHandler({ store: memory, syncMode: 'poll', now: () => time.now, log: () => {} });
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  async function call(method, path, { body, cookie, headers = {} } = {}) {
    const init = { method, headers: { ...headers } };
    if (body !== undefined) {
      init.headers['content-type'] ??= 'application/json';
      init.headers.origin ??= origin;
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    if (cookie) init.headers.cookie = cookie;
    const res = await fetch(`${origin}${path}`, init);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* sin cuerpo JSON */ }
    const setCookie = res.headers.get('set-cookie');
    return { status: res.status, data, text, headers: res.headers, setCookie, cookie: setCookie ? setCookie.split(';')[0] : null };
  }

  return { server, origin, call, time, store: memory, close: () => new Promise((r) => server.close(r)) };
}

async function createRoom(ctx, name = 'Ana') {
  const r = await ctx.call('POST', '/api/create', { body: { name } });
  assert.equal(r.status, 201, r.text);
  return r;
}

test('CA-01 crear sala: 201, código sin I/O, anfitrión, grupo Scrum y cookie HttpOnly', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const r = await createRoom(ctx);
  assert.match(r.data.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
  assert.equal(r.data.phase, 'lobby');
  assert.equal(r.data.me.isHost, true);
  assert.equal(r.data.players.length, 1);
  assert.equal(r.data.players[0].connected, true);
  assert.deepEqual({ ...r.data.words, items: undefined }, { groupId: 'scrum', label: 'Scrum y equipo', count: 10, items: undefined });
  assert.equal(r.data.words.items.length, 10, 'el anfitrión recibe la lista editable en lobby');
  assert.match(r.setCookie, new RegExp(`^fs_${r.data.code}=p_[^.]+\\.[A-Za-z0-9_-]+; Path=/; HttpOnly; SameSite=Strict; Max-Age=21600$`));
  const token = r.cookie.split('.')[1];
  assert.ok(!r.text.includes(token), 'el token no viaja en el cuerpo');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  assert.ok(r.headers.get('x-request-id'));
});

test('cookie Secure cuando la petición llega por HTTPS (x-forwarded-proto)', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const host = new URL(ctx.origin).host;
  const r = await ctx.call('POST', '/api/create', { body: { name: 'Ana' }, headers: { 'x-forwarded-proto': 'https', origin: `https://${host}` } });
  assert.equal(r.status, 201);
  assert.match(r.setCookie, /; Secure$/);
});

test('validación de entrada y CSRF en POST', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const cases = [
    [{ body: { name: 'E' } }, 400, 'INVALID_NAME'],
    [{ body: { name: 'Ana', admin: true } }, 400, 'UNKNOWN_FIELD'],
    [{ body: '{"name":' }, 400, 'INVALID_JSON'],
    [{ body: '[1,2]' }, 400, 'INVALID_JSON'],
    [{ body: { name: 'Ana' }, headers: { 'content-type': 'text/plain' } }, 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [{ body: { name: 'Ana' }, headers: { origin: 'https://atacante.example' } }, 403, 'FORBIDDEN_ORIGIN'],
    [{ body: { name: 'x'.repeat(9_000) } }, 413, 'PAYLOAD_TOO_LARGE'],
  ];
  for (const [options, status, code] of cases) {
    const r = await ctx.call('POST', '/api/create', options);
    assert.equal(r.status, status, code);
    assert.equal(r.data.error.code, code);
    assert.equal(typeof r.data.error.message, 'string');
    assert.doesNotMatch(r.text, /at .*\.js:\d+/, 'sin trazas');
  }
});

test('rutas y métodos desconocidos', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  assert.equal((await ctx.call('GET', '/api/nada')).data.error.code, 'NOT_FOUND');
  assert.equal((await ctx.call('GET', '/api/create')).status, 405);
  assert.equal((await ctx.call('GET', '/api/events?code=BCDFG')).status, 404, 'sin SSE en modo poll');
});

test('CA-03 unirse con código en minúsculas; los demás lo ven en su siguiente consulta', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const ana = await createRoom(ctx);
  const luis = await ctx.call('POST', '/api/join', { body: { code: ana.data.code.toLowerCase(), name: 'Luis' } });
  assert.equal(luis.status, 201, luis.text);
  assert.equal(luis.data.me.isHost, false);
  const seen = await ctx.call('GET', `/api/state?code=${ana.data.code}`, { cookie: ana.cookie });
  assert.equal(seen.status, 200);
  assert.deepEqual(seen.data.players.map((p) => p.name), ['Ana', 'Luis']);
  assert.equal(seen.data.canStart.missingPlayers, 1);
});

test('CA-06 rechazos con código de negocio y mensaje útil', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const ana = await createRoom(ctx);
  const code = ana.data.code;
  const join = (c, name) => ctx.call('POST', '/api/join', { body: { code: c, name } });

  let r = await join(code === 'BCDFG' ? 'HJKLM' : 'BCDFG', 'Eva');
  assert.deepEqual([r.status, r.data.error.code], [404, 'ROOM_NOT_FOUND']);
  r = await join('BCDF0', 'Eva');
  assert.deepEqual([r.status, r.data.error.code], [400, 'INVALID_CODE']);
  r = await join(code, 'ána');
  assert.deepEqual([r.status, r.data.error.code], [409, 'NAME_TAKEN']);
  assert.match(r.data.error.message, /otro nombre/);
  r = await join(code, 'E');
  assert.deepEqual([r.status, r.data.error.code], [400, 'INVALID_NAME']);

  for (let i = 2; i <= 12; i += 1) assert.equal((await join(code, `Jugador ${i}`)).status, 201);
  r = await join(code, 'Eva');
  assert.deepEqual([r.status, r.data.error.code], [409, 'ROOM_FULL']);

  const ctx2 = await startServer();
  t.after(ctx2.close);
  const other = await createRoom(ctx2);
  const current = await ctx2.store.read(other.data.code);
  await ctx2.store.cas(other.data.code, current.version, { ...current.doc, phase: 'roles' });
  r = await ctx2.call('POST', '/api/join', { body: { code: other.data.code, name: 'Eva' } });
  assert.deepEqual([r.status, r.data.error.code], [409, 'ROOM_STARTED']);
});

test('CA-08 reingreso con cookie válida no duplica al integrante', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const ana = await createRoom(ctx);
  const luis = await ctx.call('POST', '/api/join', { body: { code: ana.data.code, name: 'Luis' } });
  const again = await ctx.call('POST', '/api/join', { body: { code: ana.data.code, name: 'Otro nombre' }, cookie: luis.cookie });
  assert.equal(again.status, 200);
  assert.equal(again.data.me.id, luis.data.me.id);
  assert.equal(again.data.players.length, 2);
  const state = await ctx.call('GET', `/api/state?code=${ana.data.code}`, { cookie: luis.cookie });
  assert.equal(state.data.me.id, luis.data.me.id);
});

test('CA-09 un integrante sin contacto durante más de 30 s aparece desconectado', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const ana = await createRoom(ctx);
  await ctx.call('POST', '/api/join', { body: { code: ana.data.code, name: 'Luis' } });
  const view = async () => (await ctx.call('GET', `/api/state?code=${ana.data.code}`, { cookie: ana.cookie })).data.players.find((p) => p.name === 'Luis');
  ctx.time.now = T0 + 29_000;
  assert.equal((await view()).connected, true);
  ctx.time.now = T0 + 31_000;
  assert.equal((await view()).connected, false);
});

test('CA-12 sin cookie válida: 401 sin datos de la sala y sin renovar el TTL', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const ana = await createRoom(ctx);
  const code = ana.data.code;

  let r = await ctx.call('GET', `/api/state?code=${code}`);
  assert.deepEqual([r.status, r.data.error.code], [401, 'SESSION_INVALID']);
  assert.doesNotMatch(r.text, /Ana/);
  r = await ctx.call('GET', `/api/state?code=${code}`, { cookie: `fs_${code}=p_falso.token-falso` });
  assert.equal(r.status, 401);
  assert.match(r.setCookie, /Max-Age=0/);
  r = await ctx.call('GET', '/api/state?code=HJKLM', { cookie: ana.cookie });
  assert.equal(r.status, 401, 'cookie de otra sala');
  r = await ctx.call('GET', '/api/state?code=NO');
  assert.equal(r.data.error.code, 'INVALID_CODE');

  // Peticiones inválidas a las 5 h 59 min no renuevan: a las 6 h 1 min la sala expiró.
  ctx.time.now = T0 + (5 * 60 + 59) * 60_000;
  await ctx.call('GET', `/api/state?code=${code}`, { cookie: `fs_${code}=p_falso.token-falso` });
  ctx.time.now = T0 + (6 * 60 + 1) * 60_000;
  r = await ctx.call('GET', `/api/state?code=${code}`, { cookie: ana.cookie });
  assert.deepEqual([r.status, r.data.error.code], [404, 'ROOM_NOT_FOUND']);
});

test('CA-13 la sala expira tras 6 h sin peticiones válidas; una petición válida renueva el plazo', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const ana = await createRoom(ctx);
  const code = ana.data.code;
  ctx.time.now = T0 + (5 * 60 + 59) * 60_000;
  assert.equal((await ctx.call('GET', `/api/state?code=${code}`, { cookie: ana.cookie })).status, 200);
  ctx.time.now = T0 + (6 * 60 + 1) * 60_000;
  assert.equal((await ctx.call('GET', `/api/state?code=${code}`, { cookie: ana.cookie })).status, 200, 'renovada');
  ctx.time.now += 6 * 60 * 60_000 + 1_000;
  const r = await ctx.call('GET', `/api/state?code=${code}`, { cookie: ana.cookie });
  assert.deepEqual([r.status, r.data.error.code], [404, 'ROOM_NOT_FOUND']);
  assert.match(r.setCookie, new RegExp(`^fs_${code}=; .*Max-Age=0`));
});

test('CA-10 fallo del almacén: 503 recuperable que no borra la sesión', async (t) => {
  const time = { now: T0 };
  const memory = createMemoryStore({ ttlSeconds: 21_600, now: () => time.now });
  let failing = false;
  const flaky = new Proxy(memory, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== 'function') return value;
      return (...args) => (failing ? Promise.reject(new StoreUnavailableError('test')) : value.apply(target, args));
    },
  });
  const ctx = await startServer({ store: flaky, clock: time });
  t.after(ctx.close);
  const ana = await createRoom(ctx);
  failing = true;
  let r = await ctx.call('GET', `/api/state?code=${ana.data.code}`, { cookie: ana.cookie });
  assert.equal(r.status, 503);
  assert.deepEqual(r.data.error, { code: 'STORE_UNAVAILABLE', message: r.data.error.message, retryable: true });
  assert.equal(r.setCookie, null, 'no se borra la cookie');
  assert.doesNotMatch(r.text, /test|redis|upstash/i, 'sin detalles del proveedor');
  failing = false;
  r = await ctx.call('GET', `/api/state?code=${ana.data.code}`, { cookie: ana.cookie });
  assert.equal(r.status, 200);
});

test('CA-16 nombres con marcado se guardan y devuelven como texto literal', async (t) => {
  const ctx = await startServer();
  t.after(ctx.close);
  const name = '<script>alert(1)</script>';
  const r = await createRoom(ctx, name);
  assert.equal(r.data.me.name, name);
  assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
});
