'use strict';

/**
 * API del juego completo (SPEC-FEAT-002…008) sobre servidor HTTP real con
 * almacén en MEMORIA y reloj controlado. No usa Redis ni Vercel.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApiHandler } = require('../../lib/api');
const { createMemoryStore } = require('../../lib/store/memory-store');
const { StoreUnavailableError } = require('../../lib/store');

const T0 = 1_763_478_000_000;

async function serve(t, { store, time, ...opts }) {
  const server = http.createServer(createApiHandler({ store, syncMode: 'poll', now: () => time.now, log: () => {}, ...opts }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return async function call(method, path, body, cookie) {
    const headers = { origin };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    const res = await fetch(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, data: JSON.parse(text), text, setCookie: res.headers.get('set-cookie'), headers: res.headers };
  };
}

async function setup(t, names = ['Ana', 'Luis', 'Eva'], opts = {}) {
  const time = { now: T0 };
  const store = opts.store ?? createMemoryStore({ ttlSeconds: 21_600, now: () => time.now });
  const call = await serve(t, { store, time, ...opts });
  const players = {};
  const host = await call('POST', '/api/create', { name: names[0] });
  const code = host.data.code;
  players[names[0]] = host.setCookie.split(';')[0];
  for (const name of names.slice(1)) {
    const r = await call('POST', '/api/join', { code, name });
    players[name] = r.setCookie.split(';')[0];
  }
  const state = (name) => call('GET', `/api/state?code=${code}`, undefined, players[name]).then((r) => r.data);
  const act = async (name, type, payload, extra = {}) => {
    const gameId = (await state(name)).gameId;
    return call('POST', '/api/action', { code, type, payload, gameId: gameId ?? undefined, ...extra }, players[name]);
  };
  return { time, store, code, players, call, state, act, names };
}

/** Lleva la partida hasta la votación; devuelve palabra e impostor. */
async function playToVote(s) {
  await s.act(s.names[0], 'start');
  for (const n of s.names) await s.act(n, 'ready');
  let view = await s.state(s.names[0]);
  let i = 0;
  while (view.phase === 'clues') {
    const r = await s.act(view.turn.name, 'clue', { text: `pista número ${i += 1}` });
    assert.equal(r.status, 200, r.text);
    view = r.data;
  }
  assert.equal(view.phase, 'discussion');
  await s.act(s.names[0], 'voting');
  const views = {};
  for (const n of s.names) views[n] = await s.state(n);
  const impostor = s.names.find((n) => views[n].me.role === 'impostor');
  const word = views[s.names.find((n) => n !== impostor)].me.word;
  const ids = Object.fromEntries(views[s.names[0]].players.map((p) => [p.name, p.id]));
  return { impostor, word, ids };
}

test('RF-002 palabras: guardar grupo, personalizado, permisos y fase', async (t) => {
  const s = await setup(t);
  let r = await s.act('Ana', 'words', { groupId: 'musica', items: ['Salsa', 'Reguetón', 'Rock', 'Pop', 'Bachata', 'Vallenato', 'Concierto', 'Guitarra', 'Karaoke', 'Playlist'] });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.data.words.groupId, r.data.words.label, r.data.words.count], ['musica', 'Música', 10]);
  const luis = await s.state('Luis');
  assert.deepEqual([luis.words.label, luis.words.items], ['Música', null], 'los participantes ven el grupo, no la lista');
  r = await s.act('Ana', 'words', { groupId: 'musica', items: ['Kanban', 'Lean', 'XP'] });
  assert.deepEqual([r.data.words.groupId, r.data.words.label], ['custom', 'Personalizado']);
  r = await s.act('Ana', 'words', { items: ['Una'] });
  assert.deepEqual([r.status, r.data.error.code], [400, 'INVALID_WORDS']);
  r = await s.act('Luis', 'words', { items: ['Kanban', 'Lean', 'XP'] });
  assert.deepEqual([r.status, r.data.error.code], [403, 'NOT_HOST']);
  await s.act('Ana', 'start');
  r = await s.act('Ana', 'words', { items: ['Kanban', 'Lean', 'XP'] });
  assert.deepEqual([r.status, r.data.error.code], [409, 'WRONG_PHASE']);
  const create = await s.call('POST', '/api/create', { name: 'Otra', groupId: 'comida' });
  assert.equal(create.data.words.label, 'Comida', 'grupo elegido al crear');
});

test('Partida completa: pistas, privacidad del voto, impostor descubierto que falla y reflexión al final', async (t) => {
  const s = await setup(t, ['Ana', 'Luis', 'Eva', 'Raúl']);
  await s.act('Ana', 'start');
  for (const n of s.names) await s.act(n, 'ready');
  let view = await s.state('Ana');
  assert.equal(view.phase, 'clues');
  assert.equal(view.result, null);

  // Pista que contiene la palabra: rechazada sin consumir el turno.
  const turnName = view.turn.name;
  const secret = (await s.state(turnName)).me.word;
  if (secret) {
    const r = await s.act(turnName, 'clue', { text: `Es como ${secret}` });
    assert.deepEqual([r.status, r.data.error.code], [400, 'INVALID_CLUE']);
    const after = await s.state(turnName);
    assert.deepEqual([after.turn.name, after.turn.attemptsLeft], [turnName, 2]);
  }
  const outsider = s.names.find((n) => n !== turnName);
  const r = await s.act(outsider, 'clue', { text: 'hola' });
  assert.deepEqual([r.status, r.data.error.code], [403, 'NOT_YOUR_TURN']);

  let i = 0;
  while (view.phase === 'clues') view = (await s.act(view.turn.name, 'clue', { text: `pista ${i += 1}` })).data;
  assert.equal(view.clues.length, 4);
  assert.equal(view.phase, 'discussion');
  assert.equal((await s.act('Luis', 'voting')).data.error.code, 'NOT_HOST');
  await s.act('Ana', 'voting');

  const views = {};
  for (const n of s.names) views[n] = await s.state(n);
  const impostor = s.names.find((n) => views[n].me.role === 'impostor');
  const ids = Object.fromEntries(views.Ana.players.map((p) => [p.name, p.id]));
  const innocents = s.names.filter((n) => n !== impostor);

  await s.act(innocents[0], 'vote', { targetId: ids[impostor] });
  const peek = await s.state(innocents[1]);
  assert.deepEqual([peek.vote.participation, peek.vote.myVote, peek.outcome], [1, null, null]);
  assert.doesNotMatch(JSON.stringify(peek), /ballots/);
  assert.equal(peek.vote.quorum, 3);
  for (const n of innocents.slice(1)) await s.act(n, 'vote', { targetId: ids[impostor] });
  const last = await s.act(impostor, 'vote', { targetId: ids[innocents[0]] });
  assert.equal(last.data.phase, 'guess');
  assert.equal(last.data.outcome.canGuess, true);
  const guesser = await s.state(innocents[0]);
  assert.deepEqual([guesser.outcome.accusedName, guesser.outcome.votesFor, guesser.outcome.canGuess, guesser.result], [impostor, 3, false, null]);
  assert.doesNotMatch(JSON.stringify(guesser), /reflection/, 'sin reflexión antes de finished');
  assert.equal((await s.act(innocents[0], 'guess', { text: 'x' })).data.error.code, 'NOT_IMPOSTOR');

  const end = await s.act(impostor, 'guess', { text: 'definitivamente no es' });
  assert.equal(end.data.phase, 'finished');
  assert.equal(end.data.result.winner, 'team');
  assert.equal(end.data.result.impostorName, impostor);
  assert.equal(end.data.result.word, views[innocents[0]].me.word);
  assert.equal(end.data.result.reflection.kind, 'scrum');
  assert.ok(end.data.result.reflection.question.endsWith('?'));

  assert.equal((await s.act('Luis', 'playAgain')).data.error.code, 'NOT_HOST');
  const again = await s.act('Ana', 'playAgain');
  assert.deepEqual([again.data.phase, again.data.gameId, again.data.players.length], ['lobby', null, 4]);
});

test('RF-006 inocente acusado termina la partida y revela al verdadero impostor', async (t) => {
  const s = await setup(t, ['Ana', 'Luis', 'Eva', 'Raúl']);
  const { impostor, ids } = await playToVote(s);
  const innocents = s.names.filter((n) => n !== impostor);
  const victim = innocents[0];
  for (const n of s.names) if (n !== victim) await s.act(n, 'vote', { targetId: ids[victim] });
  const end = await s.act(victim, 'vote', { targetId: ids[innocents[1]] });
  assert.equal(end.data.phase, 'finished');
  assert.deepEqual([end.data.outcome.kind, end.data.outcome.accusedName, end.data.outcome.votesFor, end.data.result.winner, end.data.result.impostorName],
    ['innocentAccused', victim, 3, 'impostor', impostor]);
});

test('RF-008T.04 reintento con el mismo actionId no duplica el efecto', async (t) => {
  const s = await setup(t);
  const { ids } = await playToVote(s);
  const gameId = (await s.state('Ana')).gameId;
  const body = { code: s.code, type: 'vote', payload: { targetId: ids.Luis }, gameId, actionId: 'a1b2c3' };
  const first = await s.call('POST', '/api/action', body, s.players.Ana);
  const retry = await s.call('POST', '/api/action', body, s.players.Ana);
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200, 'mismo actionId: estado actual, sin error');
  assert.equal(retry.data.vote.participation, 1);
  const other = await s.call('POST', '/api/action', { ...body, actionId: 'otro-id' }, s.players.Ana);
  assert.deepEqual([other.status, other.data.error.code], [409, 'ALREADY_VOTED']);
});

test('T-017 otra instancia recupera varias fases vencidas sin temporizadores activos', async (t) => {
  const s = await setup(t);
  await s.act('Ana', 'start');
  const call2 = await serve(t, { store: s.store, time: s.time });
  s.time.now = T0 + (90 + 3 * 60 + 45 + 75) * 1000 + 500;
  const r = await call2('GET', `/api/state?code=${s.code}`, undefined, s.players.Eva);
  assert.equal(r.data.phase, 'reveal');
  assert.equal(r.data.outcome.kind, 'noQuorum');
  assert.equal(r.data.clues.filter((c) => c.skipped).length, 3);
});

test('RF-008 salir: transferencia de anfitrión, sala eliminada al salir el último y bloqueo en partida', async (t) => {
  const s = await setup(t);
  let r = await s.act('Ana', 'leave');
  assert.deepEqual([r.status, r.data.left], [200, true]);
  assert.match(r.setCookie, /Max-Age=0/);
  const luis = await s.state('Luis');
  assert.deepEqual([luis.me.isHost, luis.players.length], [true, 2]);
  assert.equal((await s.call('GET', `/api/state?code=${s.code}`, undefined, s.players.Ana)).status, 401);
  await s.act('Luis', 'leave');
  await s.act('Eva', 'leave');
  const gone = await s.call('GET', `/api/state?code=${s.code}`, undefined, s.players.Eva);
  assert.equal(gone.status, 404, 'la sala se eliminó');

  const g = await setup(t);
  await g.act('Ana', 'start');
  r = await g.act('Luis', 'leave');
  assert.deepEqual([r.status, r.data.error.code], [409, 'WRONG_PHASE']);
});

test('RF-008T.05 /health: 200 con el almacén y 503 genérico si falla', async (t) => {
  const time = { now: T0 };
  const ok = await serve(t, { store: createMemoryStore({ ttlSeconds: 60, now: () => time.now }), time });
  let r = await ok('GET', '/health');
  assert.deepEqual([r.status, r.data], [200, { status: 'ok', store: 'memory' }]);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const broken = await serve(t, { store: { kind: 'redis', ping: async () => { throw new StoreUnavailableError('x'); } }, time });
  r = await broken('GET', '/health');
  assert.deepEqual([r.status, r.data], [503, { status: 'unavailable' }]);
});

test('RF-008T.06 límite de creación por IP: 429 con Retry-After', async (t) => {
  const time = { now: T0 };
  const call = await serve(t, { store: createMemoryStore({ ttlSeconds: 21_600, now: () => time.now }), time });
  for (let i = 0; i < 10; i += 1) assert.equal((await call('POST', '/api/create', { name: `Ana ${i}` })).status, 201);
  const r = await call('POST', '/api/create', { name: 'Ana 11' });
  assert.deepEqual([r.status, r.data.error.code, r.data.error.retryable], [429, 'RATE_LIMITED', true]);
  assert.ok(Number(r.headers.get('retry-after')) > 0);
  time.now += 3600 * 1000 + 1;
  assert.equal((await call('POST', '/api/create', { name: 'Ana 12' })).status, 201, 'la ventana se renueva');
});
