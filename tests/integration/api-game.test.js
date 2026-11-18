'use strict';

/** API de SPEC-FEAT-003 (inicio, roles, reinicio) con almacén en MEMORIA y reloj controlado. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApiHandler } = require('../../lib/api');
const { createMemoryStore } = require('../../lib/store/memory-store');

const T0 = 1_763_478_000_000;

async function setup(t, names = ['Ana', 'Luis', 'Eva']) {
  const time = { now: T0 };
  const store = createMemoryStore({ ttlSeconds: 21_600, now: () => time.now });
  const server = http.createServer(createApiHandler({ store, syncMode: 'poll', now: () => time.now, log: () => {} }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function call(method, path, body, cookie) {
    const headers = { origin };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    const res = await fetch(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, data: JSON.parse(text), text, setCookie: res.headers.get('set-cookie') };
  }
  const players = {};
  const host = await call('POST', '/api/create', { name: names[0] });
  const code = host.data.code;
  players[names[0]] = { cookie: host.setCookie.split(';')[0], id: host.data.me.id };
  for (const name of names.slice(1)) {
    const r = await call('POST', '/api/join', { code, name });
    players[name] = { cookie: r.setCookie.split(';')[0], id: r.data.me.id };
  }
  const as = (name) => ({
    state: () => call('GET', `/api/state?code=${code}`, undefined, players[name].cookie),
    action: (type, extra = {}) => call('POST', '/api/action', { code, type, ...extra }, players[name].cookie),
  });
  return { time, store, code, players, as, call };
}

test('CA-01 el anfitrión inicia con 3; todos ven roles y el plazo', async (t) => {
  const s = await setup(t);
  const r = await s.as('Ana').action('start');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.data.phase, 'roles');
  assert.match(r.data.gameId, /^g_/);
  assert.equal(r.data.deadline, T0 + 90_000);
  assert.deepEqual(r.data.ready, { count: 0, total: 3, mine: false });
  const luis = await s.as('Luis').state();
  assert.equal(luis.data.phase, 'roles');
  assert.equal(luis.data.gameId, r.data.gameId);
});

test('CA-02/CA-04 rechazos de inicio: menos de 3, no anfitrión, acción desconocida', async (t) => {
  const two = await setup(t, ['Ana', 'Luis']);
  let r = await two.as('Ana').action('start');
  assert.deepEqual([r.status, r.data.error.code], [409, 'WRONG_PHASE']);
  const s = await setup(t);
  r = await s.as('Luis').action('start');
  assert.deepEqual([r.status, r.data.error.code], [403, 'NOT_HOST']);
  r = await s.as('Ana').action('ganar');
  assert.deepEqual([r.status, r.data.error.code], [400, 'INVALID_ACTION']);
  r = await s.as('Ana').action('start', { payload: { impostor: 'Luis' } });
  assert.deepEqual([r.status, r.data.error.code], [400, 'UNKNOWN_FIELD'], 'el cliente no puede elegir al impostor');
  r = await s.call('POST', '/api/action', { code: s.code, type: 'start' });
  assert.equal(r.status, 401, 'sin cookie');
  assert.equal((await s.as('Ana').state()).data.phase, 'lobby');
});

test('CA-03 no inicia con un integrante desconectado', async (t) => {
  const s = await setup(t, ['Ana', 'Luis', 'Eva', 'Raúl']);
  s.time.now = T0 + 31_000; // solo Ana y Luis vuelven a contactar
  await s.as('Luis').state();
  await s.as('Eva').state();
  const r = await s.as('Ana').action('start');
  assert.deepEqual([r.status, r.data.error.code], [409, 'WRONG_PHASE']);
  assert.match(r.data.error.message, /Raúl/);
});

test('CA-06 privacidad: el impostor recibe word null y nadie recibe el id del impostor ni la palabra ajena', async (t) => {
  const s = await setup(t, ['Ana', 'Luis', 'Eva', 'Raúl']);
  await s.as('Ana').action('start');
  const views = {};
  for (const name of Object.keys(s.players)) views[name] = (await s.as(name).state()).data;
  const impostors = Object.entries(views).filter(([, v]) => v.me.role === 'impostor');
  assert.equal(impostors.length, 1, 'exactamente un impostor');
  const [impostorName, impostorView] = impostors[0];
  assert.equal(impostorView.me.word, null);
  const word = Object.values(views).find((v) => v.me.role === 'player').me.word;
  const room = await s.store.read(s.code);
  assert.equal(word, room.doc.game.word);
  for (const [name, v] of Object.entries(views)) {
    const json = JSON.stringify(v);
    // Los ids de jugador son públicos; lo secreto es la relación «id → impostor».
    assert.doesNotMatch(json, /impostorId|tokenHash/);
    if (name !== impostorName) assert.doesNotMatch(json, /impostor/, `${name} no recibe ninguna referencia al impostor`);
    if (name === impostorName) assert.ok(!json.includes(`"${word}"`), 'el impostor no recibe la palabra');
    else assert.equal(v.me.word, word);
  }
});

test('CA-08/CA-09 confirmar es idempotente y con todos listos pasa a clues', async (t) => {
  const s = await setup(t);
  const { data: started } = await s.as('Ana').action('start');
  const gameId = started.gameId;
  let r = await s.as('Luis').action('ready', { gameId });
  assert.deepEqual(r.data.ready, { count: 1, total: 3, mine: true });
  r = await s.as('Luis').action('ready', { gameId });
  assert.equal(r.status, 200);
  assert.equal(r.data.ready.count, 1, 'idempotente');
  await s.as('Ana').action('ready', { gameId });
  r = await s.as('Eva').action('ready', { gameId });
  assert.equal(r.data.phase, 'clues');
  assert.equal(r.data.ready, null);
  assert.equal(r.data.deadline, T0 + 60_000, 'primer turno de 60 s');
});

test('CA-10 al vencer 90 s la siguiente consulta encuentra la sala en clues', async (t) => {
  const s = await setup(t);
  const { data } = await s.as('Ana').action('start');
  await s.as('Luis').action('ready', { gameId: data.gameId });
  s.time.now = T0 + 89_000;
  assert.equal((await s.as('Eva').state()).data.phase, 'roles');
  s.time.now = T0 + 95_000;
  assert.equal((await s.as('Eva').state()).data.phase, 'clues');
  const room = await s.store.read(s.code);
  assert.equal(room.doc.game.phaseStartedAt, T0 + 90_000, 'desde el vencimiento original');
});

test('CA-11/CA-12 reinicio del anfitrión, NOT_HOST para otros y STALE_GAME para acciones viejas', async (t) => {
  const s = await setup(t);
  const { data } = await s.as('Ana').action('start');
  await s.as('Luis').action('ready', { gameId: data.gameId });
  let r = await s.as('Luis').action('reset', { gameId: data.gameId });
  assert.deepEqual([r.status, r.data.error.code], [403, 'NOT_HOST']);
  r = await s.as('Ana').action('reset', { gameId: data.gameId });
  assert.equal(r.status, 200);
  assert.equal(r.data.phase, 'lobby');
  assert.equal(r.data.gameId, null);
  assert.equal(r.data.players.length, 3);
  assert.equal(r.data.words.label, 'Scrum y equipo');
  r = await s.as('Eva').action('ready', { gameId: data.gameId });
  assert.deepEqual([r.status, r.data.error.code], [409, 'STALE_GAME']);
  assert.equal((await s.as('Eva').state()).data.phase, 'lobby');
  const again = await s.as('Ana').action('start');
  assert.equal(again.data.phase, 'roles');
  assert.notEqual(again.data.gameId, data.gameId, 'nuevo sorteo con otro gameId');
});

test('nadie puede unirse durante la partida', async (t) => {
  const s = await setup(t);
  await s.as('Ana').action('start');
  const r = await s.call('POST', '/api/join', { code: s.code, name: 'Tarde' });
  assert.deepEqual([r.status, r.data.error.code], [409, 'ROOM_STARTED']);
});
