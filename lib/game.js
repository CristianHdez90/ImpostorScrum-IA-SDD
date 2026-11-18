'use strict';

const crypto = require('node:crypto');
const config = require('./config');
const { DomainError } = require('./room');
const { normalizeSpaces, graphemeCount, hasControlChars, tokens, containsSequence } = require('./text');

/**
 * Máquina de estados de la partida (architecture.md §4):
 * lobby → roles → clues → discussion → vote → reveal → clues …
 *                                           ↘ guess → finished
 *                                           ↘ finished
 * Funciones puras sobre el documento de sala: sin E/S; reloj y aleatoriedad
 * llegan como argumentos. Cada acción valida actor, fase y partida.
 */

const SECOND = 1000;

/* ---------- Utilidades ---------- */

/** Conectado si hubo contacto válido en los últimos 30 s (RF-001.08). */
function isConnected(presence, playerId, now) {
  const lastSeen = presence[playerId];
  return typeof lastSeen === 'number' && now - lastSeen <= config.PRESENCE_WINDOW_MS;
}

/** Condición de inicio (APR-009): al menos 3 integrantes y todos conectados. */
function startConditions(doc, presence, now) {
  const missingPlayers = Math.max(0, config.MIN_PLAYERS - doc.players.length);
  const disconnected = doc.players.filter((p) => !isConnected(presence, p.id, now)).map((p) => p.name);
  const reasons = [];
  if (missingPlayers > 0) reasons.push('MISSING_PLAYERS');
  if (disconnected.length > 0) reasons.push('PLAYERS_DISCONNECTED');
  return { ok: reasons.length === 0, reasons, missingPlayers, disconnected };
}

/** Cuórum de participación: techo de dos tercios de los elegibles (RF-005.06). */
function quorumFor(eligibleCount) {
  return Math.ceil((eligibleCount * 2) / 3);
}

function newGameId(randomBytes = crypto.randomBytes) {
  return `g_${randomBytes(9).toString('base64url')}`;
}

/** Fisher–Yates con el generador inyectado. */
function shuffle(items, randomInt) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function nameOf(doc, playerId) {
  const player = doc.players.find((p) => p.id === playerId);
  return player ? player.name : '';
}

function assertHost(doc, actorId) {
  if (actorId !== doc.hostId) throw new DomainError('NOT_HOST', 'Solo el anfitrión puede hacer esto.');
}

function assertCurrentGame(doc, gameId) {
  if (!doc.game || doc.game.gameId !== gameId) {
    throw new DomainError('STALE_GAME', 'Esa acción es de una partida que ya terminó o se reinició.');
  }
}

function assertPhase(doc, phase, message) {
  if (doc.phase !== phase) throw new DomainError('WRONG_PHASE', message);
}

function setPhase(doc, phase, at, seconds) {
  doc.phase = phase;
  doc.game.phaseStartedAt = at;
  doc.game.phaseEndsAt = seconds ? at + seconds * SECOND : null;
}

/* ---------- Inicio y roles (SPEC-FEAT-003) ---------- */

function startGame(doc, { actorId, presence, now, randomInt = crypto.randomInt, gameId = newGameId() }) {
  assertHost(doc, actorId);
  assertPhase(doc, 'lobby', 'La partida ya comenzó.');
  const conditions = startConditions(doc, presence, now);
  if (!conditions.ok) {
    const message = conditions.missingPlayers > 0
      ? `Se necesitan al menos ${config.MIN_PLAYERS} participantes para iniciar.`
      : `Todos deben estar conectados para iniciar. Esperando a: ${conditions.disconnected.join(', ')}.`;
    throw new DomainError('WRONG_PHASE', message);
  }
  const word = doc.words.items[randomInt(doc.words.items.length)];
  const impostorId = doc.players[randomInt(doc.players.length)].id;
  doc.phase = 'roles';
  doc.game = {
    gameId,
    round: 1,
    word,
    impostorId,
    ready: [],
    order: [],
    turnIndex: 0,
    turnRejections: 0,
    clues: [],
    vote: null,
    outcome: null,
    phaseStartedAt: now,
    phaseEndsAt: now + config.ROLES_SECONDS * SECOND,
  };
  doc.lastActivityAt = now;
  return doc;
}

function markReady(doc, { actorId, gameId, now, randomInt = crypto.randomInt }) {
  assertCurrentGame(doc, gameId);
  assertPhase(doc, 'roles', 'La preparación ya terminó.');
  if (doc.game.ready.includes(actorId)) return null; // idempotente
  doc.game.ready.push(actorId);
  doc.lastActivityAt = now;
  if (doc.players.every((p) => doc.game.ready.includes(p.id))) enterClues(doc, now, randomInt);
  return doc;
}

/* ---------- Pistas (SPEC-FEAT-004) ---------- */

/** Nueva ronda: orden sorteado sin duplicados y 60 s por turno (RF-004.01). */
function enterClues(doc, at, randomInt) {
  doc.game.order = shuffle(doc.players.map((p) => p.id), randomInt);
  doc.game.turnIndex = 0;
  doc.game.turnRejections = 0;
  doc.game.vote = null;
  setPhase(doc, 'clues', at, config.TURN_SECONDS);
}

function currentTurnPlayer(doc) {
  return doc.phase === 'clues' ? doc.game.order[doc.game.turnIndex] : null;
}

function nextTurn(doc, at) {
  doc.game.turnIndex += 1;
  doc.game.turnRejections = 0;
  if (doc.game.turnIndex >= doc.game.order.length) setPhase(doc, 'discussion', at, config.DISCUSSION_SECONDS);
  else setPhase(doc, 'clues', at, config.TURN_SECONDS);
}

function recordClue(doc, playerId, text, at) {
  doc.game.clues.push({ round: doc.game.round, playerId, name: nameOf(doc, playerId), text, skipped: text === null, at });
}

/**
 * Valida una pista sin modificar el documento. Devuelve `{ text }` o
 * `{ rejection: { code, message } }`. El rechazo cuenta para el límite de D-13.
 */
function checkClue(doc, rawText) {
  const text = typeof rawText === 'string' ? normalizeSpaces(rawText) : '';
  const length = graphemeCount(text);
  if (length === 0) return { rejection: { code: 'INVALID_CLUE', message: 'Escribe una palabra o frase.' } };
  if (length > config.CLUE_MAX) return { rejection: { code: 'INVALID_CLUE', message: `La pista admite hasta ${config.CLUE_MAX} caracteres.` } };
  if (hasControlChars(text)) return { rejection: { code: 'INVALID_CLUE', message: 'La pista contiene caracteres no permitidos.' } };
  const clueTokens = tokens(text);
  const joined = clueTokens.join(' ');
  const repeated = doc.game.clues.some((c) => c.round === doc.game.round && !c.skipped && tokens(c.text).join(' ') === joined);
  if (repeated) return { rejection: { code: 'INVALID_CLUE', message: 'Esa pista ya se dio en esta ronda. Prueba con otra.' } };
  // Mensaje genérico: no confirma qué parte coincidió (D-13).
  if (containsSequence(clueTokens, tokens(doc.game.word))) {
    return { rejection: { code: 'INVALID_CLUE', message: 'Esa pista no se puede usar. Prueba con otra.' } };
  }
  return { text };
}

/**
 * Envía la pista del jugador en turno (RF-004.02–.08). Si la pista es inválida,
 * el documento registra el rechazo y `ctx.rejection` recibe el error que debe
 * devolverse tras guardarlo; el turno no se consume.
 */
function submitClue(doc, { actorId, gameId, text, now }, ctx = {}) {
  assertCurrentGame(doc, gameId);
  assertPhase(doc, 'clues', 'No es momento de dar pistas.');
  if (currentTurnPlayer(doc) !== actorId) throw new DomainError('NOT_YOUR_TURN', 'Todavía no es tu turno.');
  if (doc.game.turnRejections >= config.MAX_CLUE_REJECTIONS) {
    throw new DomainError('INVALID_CLUE', 'Alcanzaste el máximo de intentos en este turno. Espera a que termine.');
  }
  const checked = checkClue(doc, text);
  if (checked.rejection) {
    doc.game.turnRejections += 1;
    ctx.rejection = checked.rejection;
    return doc;
  }
  recordClue(doc, actorId, checked.text, now);
  nextTurn(doc, now);
  doc.lastActivityAt = now;
  return doc;
}

function skipTurn(doc, { actorId, gameId, now }) {
  assertHost(doc, actorId);
  assertCurrentGame(doc, gameId);
  assertPhase(doc, 'clues', 'No hay un turno de pistas en curso.');
  recordClue(doc, currentTurnPlayer(doc), null, now);
  nextTurn(doc, now);
  return doc;
}

/* ---------- Debate y votación (SPEC-FEAT-005) ---------- */

function enterVote(doc, at) {
  doc.game.vote = { eligible: doc.players.map((p) => p.id), ballots: {} };
  setPhase(doc, 'vote', at, config.VOTE_SECONDS);
}

function openVoting(doc, { actorId, gameId, now }) {
  assertHost(doc, actorId);
  assertCurrentGame(doc, gameId);
  assertPhase(doc, 'discussion', 'La votación solo se abre durante el debate.');
  enterVote(doc, now);
  return doc;
}

function castVote(doc, { actorId, gameId, targetId, now }) {
  assertCurrentGame(doc, gameId);
  assertPhase(doc, 'vote', 'La votación no está abierta.');
  const { vote } = doc.game;
  if (!vote.eligible.includes(actorId)) throw new DomainError('INVALID_VOTE', 'No puedes votar en esta ronda.');
  if (Object.hasOwn(vote.ballots, actorId)) throw new DomainError('ALREADY_VOTED', 'Ya votaste en esta ronda.');
  if (typeof targetId !== 'string' || targetId === actorId) throw new DomainError('INVALID_VOTE', 'No puedes votar por ti.');
  if (!doc.players.some((p) => p.id === targetId)) throw new DomainError('INVALID_VOTE', 'Esa persona no está en la sala.');
  vote.ballots[actorId] = targetId;
  doc.lastActivityAt = now;
  if (Object.keys(vote.ballots).length === vote.eligible.length) closeVote(doc, now);
  return doc;
}

function closeVoteByHost(doc, { actorId, gameId, now }) {
  assertHost(doc, actorId);
  assertCurrentGame(doc, gameId);
  assertPhase(doc, 'vote', 'La votación no está abierta.');
  const { vote } = doc.game;
  const participation = Object.keys(vote.ballots).length;
  const quorum = quorumFor(vote.eligible.length);
  if (participation < quorum) {
    throw new DomainError('WRONG_PHASE', `Para cerrar antes deben votar al menos ${quorum} de ${vote.eligible.length}.`);
  }
  closeVote(doc, now);
  return doc;
}

/** Aplica RF-006 en orden: sin cuórum → empate → inocente → impostor. */
function closeVote(doc, at) {
  const { vote } = doc.game;
  const counts = new Map();
  for (const target of Object.values(vote.ballots)) counts.set(target, (counts.get(target) ?? 0) + 1);
  const tally = [...counts.entries()]
    .map(([playerId, votes]) => ({ playerId, name: nameOf(doc, playerId), votes }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'es'));
  const participation = Object.keys(vote.ballots).length;
  const eligible = vote.eligible.length;
  const quorum = quorumFor(eligible);
  const base = { round: doc.game.round, tally, participation, eligible, quorum };
  doc.game.vote = null; // los votos individuales no se conservan

  if (participation < quorum) {
    doc.game.outcome = { ...base, kind: 'noQuorum' };
    setPhase(doc, 'reveal', at, config.REVEAL_SECONDS);
    return;
  }
  const top = tally[0];
  if (tally.length > 1 && tally[1].votes === top.votes) {
    doc.game.outcome = { ...base, kind: 'tie' };
    setPhase(doc, 'reveal', at, config.REVEAL_SECONDS);
    return;
  }
  const accused = { accusedId: top.playerId, accusedName: top.name, votesFor: top.votes };
  if (top.playerId === doc.game.impostorId) {
    doc.game.outcome = { ...base, ...accused, kind: 'impostorAccused' };
    setPhase(doc, 'guess', at, config.GUESS_SECONDS);
    return;
  }
  doc.game.outcome = { ...base, ...accused, kind: 'innocentAccused', winner: 'impostor' };
  finish(doc, at);
}

/* ---------- Resultados (SPEC-FEAT-006) ---------- */

function finish(doc, at) {
  doc.game.outcome.impostorName = nameOf(doc, doc.game.impostorId);
  setPhase(doc, 'finished', at, 0);
}

function nextRound(doc, { actorId, gameId, now, randomInt = crypto.randomInt }) {
  assertHost(doc, actorId);
  assertCurrentGame(doc, gameId);
  assertPhase(doc, 'reveal', 'No hay una ronda por continuar.');
  startNextRound(doc, now, randomInt);
  return doc;
}

function startNextRound(doc, at, randomInt) {
  doc.game.round += 1;
  doc.game.outcome = null;
  enterClues(doc, at, randomInt);
}

/** Adivinanza del impostor descubierto (RF-006.05/06). */
function submitGuess(doc, { actorId, gameId, text, now }) {
  assertCurrentGame(doc, gameId);
  assertPhase(doc, 'guess', 'No es momento de adivinar.');
  if (actorId !== doc.game.impostorId) throw new DomainError('NOT_IMPOSTOR', 'Solo el impostor descubierto puede adivinar.');
  const guess = typeof text === 'string' ? normalizeSpaces(text) : '';
  const length = graphemeCount(guess);
  if (length === 0 || length > config.GUESS_MAX || hasControlChars(guess)) {
    throw new DomainError('INVALID_GUESS', `Escribe tu respuesta (hasta ${config.GUESS_MAX} caracteres).`);
  }
  const correct = tokens(guess).join(' ') === tokens(doc.game.word).join(' ');
  doc.game.outcome.guess = guess;
  doc.game.outcome.guessCorrect = correct;
  doc.game.outcome.winner = correct ? 'impostor' : 'team';
  finish(doc, now);
  return doc;
}

/* ---------- Reinicio (SPEC-FEAT-007) ---------- */

/** Reinicio global o «Jugar otra partida»: vuelve a lobby y conserva integrantes y palabras. */
function resetGame(doc, { actorId, gameId, now }) {
  assertHost(doc, actorId);
  assertCurrentGame(doc, gameId);
  if (doc.phase === 'lobby') throw new DomainError('WRONG_PHASE', 'No hay una partida en curso.');
  doc.phase = 'lobby';
  doc.game = null;
  doc.lastActivityAt = now;
  return doc;
}

/* ---------- Vencimientos ---------- */

function isDue(doc, now) {
  return Boolean(doc.game && doc.game.phaseEndsAt !== null && now >= doc.game.phaseEndsAt);
}

/**
 * Aplica los vencimientos desde el plazo original, no desde «ahora», con un tope
 * de pasos (architecture.md §4). Devuelve `true` si cambió el documento.
 */
function advance(doc, now, randomInt = crypto.randomInt) {
  let changed = false;
  for (let step = 0; step < config.ADVANCE_MAX_STEPS && isDue(doc, now); step += 1) {
    const dueAt = doc.game.phaseEndsAt;
    switch (doc.phase) {
      case 'roles':
        enterClues(doc, dueAt, randomInt);
        break;
      case 'clues':
        recordClue(doc, currentTurnPlayer(doc), null, dueAt); // «Sin pista»
        nextTurn(doc, dueAt);
        break;
      case 'discussion':
        enterVote(doc, dueAt);
        break;
      case 'vote':
        closeVote(doc, dueAt);
        break;
      case 'reveal':
        startNextRound(doc, dueAt, randomInt);
        break;
      case 'guess':
        doc.game.outcome.guess = null;
        doc.game.outcome.guessCorrect = false;
        doc.game.outcome.winner = 'team';
        finish(doc, dueAt);
        break;
      default:
        return changed;
    }
    changed = true;
  }
  return changed;
}

module.exports = {
  isConnected,
  startConditions,
  quorumFor,
  newGameId,
  startGame,
  markReady,
  checkClue,
  submitClue,
  skipTurn,
  openVoting,
  castVote,
  closeVoteByHost,
  nextRound,
  submitGuess,
  resetGame,
  advance,
  isDue,
  currentTurnPlayer,
};
