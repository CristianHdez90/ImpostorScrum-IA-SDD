'use strict';

/** SPEC-FEAT-009: configuración, rondas encadenadas, puntos, podio y estado de turno. */
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../../lib/config');
const game = require('../../lib/game');
const { createRoomDoc, addPlayer, validateSettings, saveSettings, settingsOf, removePlayer, DomainError } = require('../../lib/room');
const { projectRoom } = require('../../lib/projection');

const NOW = 1_763_478_000_000;
const S = 1000;
const identity = (n) => n - 1;

function room(names = ['Ana', 'Luis', 'Eva'], settings) {
  const [hostName, ...rest] = names;
  const doc = createRoomDoc({ code: 'BCDFG', now: NOW, host: { id: 'p_0', name: hostName, key: hostName.toLowerCase(), tokenHash: 'h' }, settings });
  rest.forEach((name, i) => addPlayer(doc, { id: `p_${i + 1}`, name, key: name.toLowerCase(), tokenHash: 'h' }, NOW));
  return doc;
}

const presenceOf = (doc, at = NOW) => Object.fromEntries(doc.players.map((p) => [p.id, at]));
const errCode = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof DomainError, e); return e.code; } return null; };

/** Juega la ronda actual hasta su fin; `impostorWins` decide el resultado. */
function playRound(doc, at, impostorWins) {
  const gameId = doc.game.gameId;
  for (const p of doc.players) game.markReady(doc, { actorId: p.id, gameId, now: at, randomInt: identity });
  for (const id of [...doc.game.order]) game.submitClue(doc, { actorId: id, gameId, text: `pista ${id} ${doc.series.current}`, now: at });
  game.openVoting(doc, { actorId: doc.hostId, gameId, now: at });
  const impostor = doc.game.impostorId;
  const innocent = doc.players.find((p) => p.id !== impostor).id;
  const target = impostorWins ? innocent : impostor;
  for (const p of doc.players) {
    const vote = p.id === target ? doc.players.find((q) => q.id !== p.id && q.id !== target).id : target;
    game.castVote(doc, { actorId: p.id, gameId, targetId: vote, now: at });
  }
  if (doc.phase === 'guess') game.submitGuess(doc, { actorId: impostor, gameId, text: 'respuesta equivocada', now: at });
  assert.equal(doc.phase, 'finished');
  return impostor;
}

test('RF-009.01/02 configuración: valores por defecto, listas cerradas y permisos', () => {
  assert.deepEqual(settingsOf(room()), { rounds: 1, turnSeconds: 60, voteSeconds: 75 });
  assert.deepEqual(validateSettings({ rounds: 3, turnSeconds: 30, voteSeconds: 90 }), { rounds: 3, turnSeconds: 30, voteSeconds: 90 });
  assert.deepEqual(validateSettings({ rounds: '5' }), { rounds: 5, turnSeconds: 60, voteSeconds: 75 });
  for (const bad of [{ rounds: 0 }, { rounds: 11 }, { turnSeconds: 7 }, { voteSeconds: 30 }, { otro: 1 }, null, []]) {
    assert.equal(errCode(() => validateSettings(bad)), 'INVALID_SETTINGS', JSON.stringify(bad));
  }
  const doc = room();
  assert.equal(errCode(() => saveSettings(doc, { actorId: 'p_1', settings: validateSettings({ rounds: 2 }), now: NOW })), 'NOT_HOST');
  saveSettings(doc, { actorId: 'p_0', settings: validateSettings({ rounds: 2 }), now: NOW });
  assert.equal(settingsOf(doc).rounds, 2);
  assert.equal(settingsOf({ ...doc, settings: undefined }).turnSeconds, 60, 'documentos antiguos usan los valores por defecto');
});

test('RF-009.01 los tiempos configurados se aplican a turnos y votación', () => {
  const doc = room(undefined, { rounds: 1, turnSeconds: 30, voteSeconds: 120 });
  game.startGame(doc, { actorId: 'p_0', presence: presenceOf(doc), now: NOW, gameId: 'g', randomInt: () => 0 });
  for (const p of doc.players) game.markReady(doc, { actorId: p.id, gameId: 'g', now: NOW, randomInt: identity });
  assert.equal(doc.game.phaseEndsAt - doc.game.phaseStartedAt, 30 * S);
  for (const id of [...doc.game.order]) game.submitClue(doc, { actorId: id, gameId: 'g', text: `pista ${id}`, now: NOW });
  game.openVoting(doc, { actorId: 'p_0', gameId: 'g', now: NOW });
  assert.equal(doc.game.phaseEndsAt - doc.game.phaseStartedAt, 120 * S);
  assert.equal(errCode(() => saveSettings(doc, { actorId: 'p_0', settings: validateSettings({}), now: NOW })), 'WRONG_PHASE');
});

test('RF-009.03/04/05 serie de 3 rondas: puntos, pausa de 20 s, «Continuar» y podio', () => {
  const doc = room(['Ana', 'Luis', 'Eva', 'Raúl'], { rounds: 3, turnSeconds: 60, voteSeconds: 75 });
  let picks = [0, 2]; // ronda 1: palabra 0, impostor Eva
  game.startGame(doc, { actorId: 'p_0', presence: presenceOf(doc), now: NOW, gameId: 'g1', randomInt: (n) => (picks.length ? picks.shift() : n - 1) });
  assert.deepEqual([doc.series.current, doc.series.total], [1, 3]);

  playRound(doc, NOW + S, false); // gana el equipo: +1 a los 3 inocentes
  assert.equal(doc.game.outcome.hasNextRound, true);
  assert.equal(doc.game.phaseEndsAt, NOW + S + config.ROUND_BREAK_SECONDS * S);
  const points = () => Object.fromEntries(doc.series.scores.map((s) => [s.name, s.points]));
  assert.deepEqual(points(), { Ana: 1, Luis: 1, Eva: 0, 'Raúl': 1 });

  assert.equal(errCode(() => game.nextGame(doc, { actorId: 'p_1', gameId: doc.game.gameId, now: NOW })), 'NOT_HOST');
  const firstGameId = doc.game.gameId;
  game.nextGame(doc, { actorId: 'p_0', gameId: firstGameId, now: NOW + 2 * S, randomInt: identity });
  assert.deepEqual([doc.phase, doc.series.current], ['roles', 2]);
  assert.notEqual(doc.game.gameId, firstGameId, 'nueva partida: las acciones viejas quedan obsoletas');
  assert.equal(doc.game.round, 1, 'la vuelta de pistas empieza en 1');

  const impostor2 = playRound(doc, NOW + 3 * S, true); // gana el impostor: +1 solo a él
  assert.equal(doc.series.scores.find((s) => s.playerId === impostor2).points, impostor2 === 'p_2' ? 1 : 2);

  // La pausa vence sin que nadie pulse «Continuar»: la ronda 3 empieza sola desde el vencimiento.
  const breakEnds = doc.game.phaseEndsAt;
  game.advance(doc, breakEnds + 5 * S, identity);
  assert.deepEqual([doc.phase, doc.series.current, doc.game.phaseStartedAt], ['roles', 3, breakEnds]);

  playRound(doc, NOW + 100 * S, false);
  assert.deepEqual([doc.series.complete, doc.game.outcome.hasNextRound, doc.game.phaseEndsAt], [true, false, null]);
  assert.equal(errCode(() => game.nextGame(doc, { actorId: 'p_0', gameId: doc.game.gameId, now: NOW })), 'WRONG_PHASE');

  const dto = projectRoom({ doc, version: 1, presence: presenceOf(doc), meId: 'p_0', now: NOW, syncMode: 'poll' });
  assert.equal(dto.series.complete, true);
  assert.equal(dto.result.hasNextRound, false);
  const ranks = dto.series.scores.map((s) => s.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.equal(dto.series.scores[0].rank, 1);
});

test('RF-009.06 clasificación con empates compartidos (1, 1, 3)', () => {
  const doc = room();
  doc.series = { total: 1, current: 1, complete: true, scores: [
    { playerId: 'p_0', name: 'Ana', points: 2 }, { playerId: 'p_1', name: 'Luis', points: 2 }, { playerId: 'p_2', name: 'Eva', points: 0 },
  ] };
  const dto = projectRoom({ doc, version: 1, presence: {}, meId: 'p_2', now: NOW, syncMode: 'poll' });
  assert.deepEqual(dto.series.scores.map((s) => [s.name, s.rank, s.isMe]), [['Ana', 1, false], ['Luis', 1, false], ['Eva', 3, true]]);
  assert.deepEqual(dto.players.map((p) => p.points), [2, 2, 0]);
});

test('RF-009.07 con menos de 3 integrantes al empezar la ronda, la serie termina', () => {
  const doc = room(['Ana', 'Luis', 'Eva'], { rounds: 2, turnSeconds: 60, voteSeconds: 75 });
  game.startGame(doc, { actorId: 'p_0', presence: presenceOf(doc), now: NOW, gameId: 'g', randomInt: () => 0 });
  playRound(doc, NOW, false);
  removePlayer(doc, { actorId: 'p_2', now: NOW }); // salir está permitido en `finished`
  game.advance(doc, doc.game.phaseEndsAt, identity);
  assert.deepEqual([doc.phase, doc.series.complete], ['finished', true]);
});

test('RF-009.08 reiniciar borra la puntuación y conserva la configuración', () => {
  const doc = room(undefined, { rounds: 4, turnSeconds: 45, voteSeconds: 60 });
  game.startGame(doc, { actorId: 'p_0', presence: presenceOf(doc), now: NOW, gameId: 'g', randomInt: () => 0 });
  game.resetGame(doc, { actorId: 'p_0', gameId: 'g', now: NOW });
  assert.deepEqual([doc.phase, doc.series, settingsOf(doc).rounds], ['lobby', null, 4]);
});

test('RF-010.04 estado de turno por jugador en la vuelta de pistas', () => {
  const doc = room();
  game.startGame(doc, { actorId: 'p_0', presence: presenceOf(doc), now: NOW, gameId: 'g', randomInt: () => 0 });
  for (const p of doc.players) game.markReady(doc, { actorId: p.id, gameId: 'g', now: NOW, randomInt: identity });
  const [a, b, c] = doc.game.order;
  game.submitClue(doc, { actorId: a, gameId: 'g', text: 'primera pista', now: NOW });
  game.skipTurn(doc, { actorId: 'p_0', gameId: 'g', now: NOW });
  const dto = projectRoom({ doc, version: 1, presence: presenceOf(doc), meId: 'p_0', now: NOW, syncMode: 'poll' });
  const state = Object.fromEntries(dto.players.map((p) => [p.id, p.turnState]));
  assert.deepEqual([state[a], state[b], state[c]], ['done', 'skipped', 'current']);
  assert.ok(dto.players.every((p) => p.points === 0));
});
