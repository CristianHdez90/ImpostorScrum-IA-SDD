'use strict';

/** Reglas de SPEC-FEAT-004…007: pistas, votación, resultados, reinicio y vencimientos. */
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../../lib/config');
const game = require('../../lib/game');
const { createRoomDoc, addPlayer, DomainError, removePlayer, validateWords } = require('../../lib/room');
const { reflectionFor, SCRUM_REFLECTIONS } = require('../../lib/reflections');
const themes = require('../../public/word-themes.js');

const NOW = 1_763_478_000_000;
const S = 1000;
const identity = (n) => n - 1; // con Fisher–Yates deja el orden de entrada

function room(names = ['Ana', 'Luis', 'Eva']) {
  const [hostName, ...rest] = names;
  const doc = createRoomDoc({ code: 'BCDFG', now: NOW, host: { id: 'p_0', name: hostName, key: hostName.toLowerCase(), tokenHash: 'h' } });
  rest.forEach((name, i) => addPlayer(doc, { id: `p_${i + 1}`, name, key: name.toLowerCase(), tokenHash: 'h' }, NOW));
  return doc;
}

/** Partida en `clues` con palabra e impostor fijados y orden de entrada. */
function inClues({ names, word = 'Historia de Usuario', impostor = 'p_2' } = {}) {
  const doc = room(names);
  const presence = Object.fromEntries(doc.players.map((p) => [p.id, NOW]));
  game.startGame(doc, { actorId: 'p_0', presence, now: NOW, gameId: 'g', randomInt: () => 0 });
  doc.game.word = word;
  doc.game.impostorId = impostor;
  for (const p of doc.players) game.markReady(doc, { actorId: p.id, gameId: 'g', now: NOW, randomInt: identity });
  return doc;
}

const errCode = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof DomainError, e); return e.code; } return null; };
const clue = (doc, actorId, text, ctx = {}) => game.submitClue(doc, { actorId, gameId: 'g', text, now: NOW + S }, ctx);
const vote = (doc, actorId, targetId) => game.castVote(doc, { actorId, gameId: 'g', targetId, now: NOW + 2 * S });

function toVote(doc) {
  for (const id of [...doc.game.order]) clue(doc, id, `pista de ${id}`);
  game.openVoting(doc, { actorId: 'p_0', gameId: 'g', now: NOW + 2 * S });
  return doc;
}

test('cuórum por techo de dos tercios (RF-005.06)', () => {
  const expected = { 3: 2, 4: 3, 5: 4, 6: 4, 7: 5, 8: 6, 9: 6, 10: 7, 11: 8, 12: 8 };
  for (const [n, q] of Object.entries(expected)) assert.equal(game.quorumFor(Number(n)), q, `n=${n}`);
});

test('D-12 detección de la palabra secreta por secuencia completa de palabras', () => {
  const cases = [
    ['Historia de Usuario', 'Se parece a una historia de usuario bien escrita', true],
    ['Historia de Usuario', 'Una historia que cuenta un usuario', false],
    ['QA', 'Aquí probamos todo', false],
    ['QA', 'Lo hace el equipo de QA', true],
    ['Review', 'REVIEW!!!', true],
    ['Sprint', 'sprints cortos', false],
    ['Reguetón', 'música de REGUETON', true],
  ];
  for (const [word, text, rejected] of cases) {
    const doc = inClues({ word });
    const result = game.checkClue(doc, text);
    assert.equal(Boolean(result.rejection), rejected, `${word} / ${text}`);
  }
});

test('RF-004 orden sin duplicados; solo el jugador en turno; avance al enviar', () => {
  const doc = inClues();
  assert.deepEqual([...doc.game.order].sort(), ['p_0', 'p_1', 'p_2']);
  assert.equal(new Set(doc.game.order).size, 3);
  const first = doc.game.order[0];
  const other = doc.game.order[1];
  assert.equal(errCode(() => clue(doc, other, 'hola')), 'NOT_YOUR_TURN');
  clue(doc, first, 'Mirar  la   necesidad');
  assert.equal(doc.game.clues[0].text, 'Mirar la necesidad');
  assert.equal(game.currentTurnPlayer(doc), other);
  assert.equal(doc.game.phaseEndsAt, NOW + S + config.TURN_SECONDS * S);
});

test('RF-004 pista inválida no consume el turno; repetida, vacía, larga; máximo 3 rechazos (D-13)', () => {
  const doc = inClues();
  const [a, b] = doc.game.order;
  clue(doc, a, 'Mirar atrás');
  let ctx = {};
  clue(doc, b, 'mirar   ATRÁS', ctx);
  assert.equal(ctx.rejection.code, 'INVALID_CLUE');
  assert.match(ctx.rejection.message, /ya se dio/);
  assert.equal(game.currentTurnPlayer(doc), b, 'no consume el turno');
  ctx = {};
  clue(doc, b, 'x'.repeat(161), ctx);
  assert.match(ctx.rejection.message, /160/);
  ctx = {};
  clue(doc, b, 'una historia de usuario', ctx);
  assert.equal(ctx.rejection.message, 'Esa pista no se puede usar. Prueba con otra.', 'mensaje genérico');
  assert.equal(doc.game.turnRejections, 3);
  assert.equal(errCode(() => clue(doc, b, 'otra pista válida')), 'INVALID_CLUE', 'tras 3 rechazos solo queda esperar');
  ctx = {};
  const fresh = inClues();
  clue(fresh, fresh.game.order[0], 'y'.repeat(160), ctx);
  assert.equal(ctx.rejection, undefined, '160 caracteres se aceptan');
});

test('RF-004 saltar turno (solo anfitrión) y vencimiento registran «Sin pista»', () => {
  const doc = inClues();
  const [a, b] = doc.game.order;
  assert.equal(errCode(() => game.skipTurn(doc, { actorId: 'p_1', gameId: 'g', now: NOW })), 'NOT_HOST');
  game.skipTurn(doc, { actorId: 'p_0', gameId: 'g', now: NOW + S });
  assert.deepEqual([doc.game.clues[0].playerId, doc.game.clues[0].skipped], [a, true]);
  const dueAt = doc.game.phaseEndsAt;
  game.advance(doc, dueAt + 5 * S, identity);
  assert.deepEqual([doc.game.clues[1].playerId, doc.game.clues[1].skipped, doc.game.clues[1].at], [b, true, dueAt]);
});

test('RF-005 tras las pistas: debate de 45 s y votación de 75 s con elegibles fijos', () => {
  const doc = inClues();
  for (const id of [...doc.game.order]) clue(doc, id, `pista ${id}`);
  assert.equal(doc.phase, 'discussion');
  assert.equal(doc.game.phaseEndsAt, NOW + S + 45 * S);
  assert.equal(errCode(() => game.openVoting(doc, { actorId: 'p_1', gameId: 'g', now: NOW })), 'NOT_HOST');
  game.advance(doc, doc.game.phaseEndsAt, identity);
  assert.equal(doc.phase, 'vote');
  assert.deepEqual(doc.game.vote.eligible, ['p_0', 'p_1', 'p_2']);
  assert.equal(doc.game.phaseEndsAt, NOW + S + 45 * S + 75 * S);
});

test('RF-005 voto propio, duplicado y destino inválido; cierre anticipado solo con cuórum', () => {
  const doc = toVote(inClues({ names: ['Ana', 'Luis', 'Eva', 'Raúl', 'Sofía', 'Tomás'] }));
  assert.equal(errCode(() => vote(doc, 'p_1', 'p_1')), 'INVALID_VOTE');
  assert.equal(errCode(() => vote(doc, 'p_1', 'p_99')), 'INVALID_VOTE');
  vote(doc, 'p_1', 'p_2');
  assert.equal(errCode(() => vote(doc, 'p_1', 'p_3')), 'ALREADY_VOTED');
  vote(doc, 'p_3', 'p_2');
  vote(doc, 'p_4', 'p_2');
  assert.equal(errCode(() => game.closeVoteByHost(doc, { actorId: 'p_0', gameId: 'g', now: NOW })), 'WRONG_PHASE', '3 de 6 < 4');
  vote(doc, 'p_5', 'p_1');
  assert.equal(errCode(() => game.closeVoteByHost(doc, { actorId: 'p_1', gameId: 'g', now: NOW })), 'NOT_HOST');
  game.closeVoteByHost(doc, { actorId: 'p_0', gameId: 'g', now: NOW + 3 * S });
  assert.equal(doc.phase, 'guess', 'p_2 (impostor) único más votado con cuórum');
  assert.equal(doc.game.vote, null, 'los votos individuales no se conservan');
  assert.deepEqual(doc.game.outcome.tally.map((t) => [t.name, t.votes]), [['Eva', 3], ['Luis', 1]]);
});

test('RF-006 sin cuórum al vencer: reveal con identidad oculta y nueva ronda a los 18 s', () => {
  const doc = toVote(inClues());
  vote(doc, 'p_0', 'p_1');
  game.advance(doc, doc.game.phaseEndsAt, identity);
  assert.equal(doc.phase, 'reveal');
  assert.equal(doc.game.outcome.kind, 'noQuorum');
  assert.equal(doc.game.outcome.accusedId, undefined);
  game.advance(doc, doc.game.phaseEndsAt, identity);
  assert.equal(doc.phase, 'clues');
  assert.equal(doc.game.round, 2);
  assert.equal(doc.game.clues.length, 3, 'se conserva el historial de la ronda 1');
});

test('RF-006 empate con cuórum: reveal; el anfitrión puede pasar a la siguiente ronda', () => {
  const doc = toVote(inClues());
  vote(doc, 'p_0', 'p_1');
  vote(doc, 'p_1', 'p_2');
  vote(doc, 'p_2', 'p_0');
  assert.equal(doc.phase, 'reveal');
  assert.equal(doc.game.outcome.kind, 'tie');
  assert.equal(errCode(() => game.nextRound(doc, { actorId: 'p_1', gameId: 'g', now: NOW })), 'NOT_HOST');
  game.nextRound(doc, { actorId: 'p_0', gameId: 'g', now: NOW + 4 * S, randomInt: identity });
  assert.deepEqual([doc.phase, doc.game.round], ['clues', 2]);
  const r2 = doc.game.order[0];
  clue(doc, r2, `pista de ${r2}`); // la misma pista de la ronda 1 vuelve a ser válida
  assert.equal(doc.game.clues.at(-1).round, 2);
});

test('RF-006 inocente único más votado: termina con victoria del impostor', () => {
  const doc = toVote(inClues({ names: ['Ana', 'Luis', 'Eva', 'Raúl'] }));
  vote(doc, 'p_0', 'p_1');
  vote(doc, 'p_2', 'p_1');
  vote(doc, 'p_3', 'p_1');
  vote(doc, 'p_1', 'p_2');
  assert.equal(doc.phase, 'finished');
  assert.deepEqual([doc.game.outcome.kind, doc.game.outcome.winner, doc.game.outcome.accusedName, doc.game.outcome.votesFor, doc.game.outcome.impostorName],
    ['innocentAccused', 'impostor', 'Luis', 3, 'Eva']);
});

test('RF-006 adivinanza: solo el impostor; acierto, fallo y vencimiento', () => {
  const make = () => {
    const doc = toVote(inClues({ word: 'Historia de Usuario' }));
    vote(doc, 'p_0', 'p_2');
    vote(doc, 'p_1', 'p_2');
    vote(doc, 'p_2', 'p_0');
    assert.equal(doc.phase, 'guess');
    return doc;
  };
  let doc = make();
  assert.equal(errCode(() => game.submitGuess(doc, { actorId: 'p_1', gameId: 'g', text: 'x', now: NOW })), 'NOT_IMPOSTOR');
  game.submitGuess(doc, { actorId: 'p_2', gameId: 'g', text: '  historia DE usuário ', now: NOW });
  assert.deepEqual([doc.phase, doc.game.outcome.winner, doc.game.outcome.guessCorrect], ['finished', 'impostor', true]);
  doc = make();
  game.submitGuess(doc, { actorId: 'p_2', gameId: 'g', text: 'Backlog', now: NOW });
  assert.deepEqual([doc.game.outcome.winner, doc.game.outcome.guessCorrect], ['team', false]);
  doc = make();
  game.advance(doc, doc.game.phaseEndsAt, identity);
  assert.deepEqual([doc.phase, doc.game.outcome.winner, doc.game.outcome.guess], ['finished', 'team', null]);
});

test('T-017 recuperación de varias fases desde los vencimientos originales', () => {
  const doc = room();
  const presence = Object.fromEntries(doc.players.map((p) => [p.id, NOW]));
  game.startGame(doc, { actorId: 'p_0', presence, now: NOW, gameId: 'g', randomInt: () => 0 });
  const voteEnds = NOW + (90 + 3 * 60 + 45 + 75) * S;
  game.advance(doc, voteEnds + 1, identity);
  assert.equal(doc.phase, 'reveal');
  assert.equal(doc.game.outcome.kind, 'noQuorum');
  assert.equal(doc.game.phaseStartedAt, voteEnds, 'cada plazo desde el anterior, no desde «ahora»');
  assert.equal(doc.game.clues.filter((c) => c.skipped).length, 3);
  // Un salto enorme se corta en el tope de pasos sin bucle infinito y deja un estado coherente.
  game.advance(doc, voteEnds + 365 * 24 * 3600 * S, identity);
  assert.ok(['clues', 'discussion', 'vote', 'reveal'].includes(doc.phase));
});

test('RF-008 jugar otra partida y salir: transferencia de anfitrión y sala vacía', () => {
  const doc = room();
  assert.equal(removePlayer(doc, { actorId: 'p_0', now: NOW }).hostId, 'p_1', 'pasa al siguiente por orden de entrada');
  assert.equal(doc.players.length, 2);
  removePlayer(doc, { actorId: 'p_1', now: NOW });
  assert.equal(removePlayer(doc, { actorId: 'p_2', now: NOW }), null, 'último integrante: eliminar sala');
  const active = inClues();
  assert.equal(errCode(() => removePlayer(active, { actorId: 'p_1', now: NOW })), 'WRONG_PHASE');
});

test('RF-002 validación de palabras: mínimo, longitudes, duplicados y «Personalizado»', () => {
  assert.equal(validateWords({ groupId: 'musica', items: themes.getGroup('musica').words }).label, 'Música');
  const custom = validateWords({ groupId: 'scrum', items: ['Kanban', 'kanban ', 'Lean', 'Scrumban', ''] });
  assert.deepEqual(custom, { groupId: 'custom', label: 'Personalizado', items: ['Kanban', 'Lean', 'Scrumban'] });
  assert.throws(() => validateWords({ items: ['Pizza', 'pizza'] }), /al menos 3/);
  assert.throws(() => validateWords({ items: ['A', 'Pizza', 'Pasta'] }), /Revisa: A/);
  assert.throws(() => validateWords({ items: Array.from({ length: 101 }, (_, i) => `Palabra ${i}`) }), /hasta 100/);
});

test('RF-007 reflexión específica para las diez palabras Scrum y general para el resto', () => {
  const scrum = themes.getGroup('scrum').words;
  assert.equal(Object.keys(SCRUM_REFLECTIONS).length, 10);
  const texts = new Set();
  for (const word of scrum) {
    const r = reflectionFor(word);
    assert.equal(r.kind, 'scrum', word);
    assert.match(r.question, /\?$/);
    texts.add(r.text);
  }
  assert.equal(texts.size, 10, 'cada palabra tiene su reflexión');
  assert.equal(reflectionFor('historia de usuario').kind, 'scrum', 'sin distinguir mayúsculas');
  assert.equal(reflectionFor('Pizza').kind, 'general');
  assert.equal(reflectionFor('Kanban').kind, 'general');
});
