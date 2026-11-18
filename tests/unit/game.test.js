'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../../lib/config');
const game = require('../../lib/game');
const { createRoomDoc, addPlayer, DomainError } = require('../../lib/room');

const NOW = 1_763_478_000_000;
const ROLES_MS = config.ROLES_SECONDS * 1000;

function room(names = ['Ana', 'Luis', 'Eva']) {
  const [hostName, ...rest] = names;
  const doc = createRoomDoc({ code: 'BCDFG', now: NOW, host: { id: 'p_0', name: hostName, key: hostName.toLowerCase(), tokenHash: 'h' } });
  rest.forEach((name, i) => addPlayer(doc, { id: `p_${i + 1}`, name, key: name.toLowerCase(), tokenHash: 'h' }, NOW));
  return doc;
}

const allConnected = (doc) => Object.fromEntries(doc.players.map((p) => [p.id, NOW]));
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof DomainError, e); return e.code; } return null; };
const start = (doc, opts = {}) => game.startGame(doc, { actorId: 'p_0', presence: allConnected(doc), now: NOW, gameId: 'g_1', ...opts });

test('CA-01 con 3 conectados el anfitrión inicia: fase roles con plazo de 90 s', () => {
  const doc = start(room());
  assert.equal(doc.phase, 'roles');
  assert.equal(doc.game.gameId, 'g_1');
  assert.deepEqual(doc.game.ready, []);
  assert.equal(doc.game.phaseEndsAt, NOW + ROLES_MS);
});

test('CA-02/CA-03 no inicia con menos de 3 ni con alguien desconectado (APR-009)', () => {
  const two = room(['Ana', 'Luis']);
  assert.equal(code(() => start(two)), 'WRONG_PHASE');
  assert.equal(two.phase, 'lobby');
  const four = room(['Ana', 'Luis', 'Eva', 'Raúl']);
  const presence = allConnected(four);
  presence.p_2 = NOW - 31_000;
  assert.equal(code(() => start(four, { presence })), 'WRONG_PHASE');
  assert.deepEqual(game.startConditions(four, presence, NOW), { ok: false, reasons: ['PLAYERS_DISCONNECTED'], missingPlayers: 0, disconnected: ['Eva'] });
});

test('CA-04 solo el anfitrión inicia; no se inicia dos veces', () => {
  const doc = room();
  assert.equal(code(() => start(doc, { actorId: 'p_1' })), 'NOT_HOST');
  start(doc);
  assert.equal(code(() => start(doc)), 'WRONG_PHASE');
});

test('CA-05 exactamente un impostor y una palabra del grupo en 1000 partidas', () => {
  const impostors = new Map();
  const words = new Set();
  for (let i = 0; i < 1000; i += 1) {
    const doc = start(room(['Ana', 'Luis', 'Eva', 'Raúl', 'Sofía']), { randomInt: require('node:crypto').randomInt });
    assert.ok(doc.players.some((p) => p.id === doc.game.impostorId));
    assert.ok(doc.words.items.includes(doc.game.word));
    impostors.set(doc.game.impostorId, (impostors.get(doc.game.impostorId) ?? 0) + 1);
    words.add(doc.game.word);
  }
  assert.equal(impostors.size, 5, 'todos pueden ser impostor');
  assert.equal(words.size, 10, 'todas las palabras pueden salir');
});

test('CA-05 el sorteo usa la aleatoriedad inyectada', () => {
  const picks = [3, 2]; // palabra índice 3 (Retro), impostor índice 2 (Eva)
  const doc = start(room(), { randomInt: () => picks.shift() });
  assert.equal(doc.game.word, 'Retro');
  assert.equal(doc.game.impostorId, 'p_2');
});

test('CA-08/CA-09 confirmar es idempotente y con todos listos pasa a clues', () => {
  const doc = start(room());
  game.markReady(doc, { actorId: 'p_1', gameId: 'g_1', now: NOW + 1000 });
  assert.equal(game.markReady(doc, { actorId: 'p_1', gameId: 'g_1', now: NOW + 2000 }), null);
  assert.deepEqual(doc.game.ready, ['p_1']);
  game.markReady(doc, { actorId: 'p_0', gameId: 'g_1', now: NOW + 3000 });
  assert.equal(doc.phase, 'roles');
  game.markReady(doc, { actorId: 'p_2', gameId: 'g_1', now: NOW + 4000 });
  assert.equal(doc.phase, 'clues');
  assert.equal(doc.game.phaseStartedAt, NOW + 4000);
  assert.equal(code(() => game.markReady(doc, { actorId: 'p_0', gameId: 'g_1', now: NOW + 5000 })), 'WRONG_PHASE');
});

test('CA-10 al vencer los 90 s pasa a clues desde el vencimiento original', () => {
  const doc = start(room());
  assert.equal(game.advance(doc, NOW + ROLES_MS - 1), false);
  assert.equal(doc.phase, 'roles');
  assert.equal(game.advance(doc, NOW + ROLES_MS + 1_000), true);
  assert.equal(doc.phase, 'clues');
  assert.equal(doc.game.phaseStartedAt, NOW + ROLES_MS, 'no desde «ahora»');
  assert.equal(doc.game.phaseEndsAt, NOW + ROLES_MS + 60_000);
});

test('CA-11/CA-12 reinicio: solo anfitrión, conserva integrantes y palabras; gameId viejo queda obsoleto', () => {
  const doc = start(room());
  const words = JSON.stringify(doc.words);
  assert.equal(code(() => game.resetGame(doc, { actorId: 'p_1', gameId: 'g_1', now: NOW })), 'NOT_HOST');
  assert.equal(code(() => game.resetGame(doc, { actorId: 'p_0', gameId: 'g_viejo', now: NOW })), 'STALE_GAME');
  game.resetGame(doc, { actorId: 'p_0', gameId: 'g_1', now: NOW });
  assert.equal(doc.phase, 'lobby');
  assert.equal(doc.game, null);
  assert.equal(doc.players.length, 3);
  assert.equal(doc.hostId, 'p_0');
  assert.equal(JSON.stringify(doc.words), words);
  assert.equal(code(() => game.markReady(doc, { actorId: 'p_1', gameId: 'g_1', now: NOW })), 'STALE_GAME');
  assert.equal(code(() => game.resetGame(doc, { actorId: 'p_0', gameId: 'g_1', now: NOW })), 'STALE_GAME');
});
