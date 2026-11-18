'use strict';

const config = require('./config');
const { isConnected, startConditions, quorumFor, currentTurnPlayer } = require('./game');
const { reflectionFor } = require('./reflections');
const { settingsOf } = require('./room');

/** Clasificación con empates compartidos: 1, 1, 3 (RF-009.06). */
function rankScores(scores, meId) {
  return [...scores]
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'es'))
    .map((s) => ({
      name: s.name,
      points: s.points,
      rank: 1 + scores.filter((other) => other.points > s.points).length, // puesto de competición
      isMe: s.playerId === meId,
    }));
}

/** Estado de cada jugador en la vuelta de pistas actual (RF-010.04). */
function turnStates(doc) {
  if (doc.phase !== 'clues') return {};
  const game = doc.game;
  const current = currentTurnPlayer(doc);
  const lap = game.clues.filter((c) => c.round === game.round);
  const states = {};
  for (const id of game.order) {
    const clue = lap.find((c) => c.playerId === id);
    states[id] = id === current ? 'current' : clue ? (clue.skipped ? 'skipped' : 'done') : 'pending';
  }
  return states;
}

/**
 * Proyección pública del documento para un integrante (api-contracts.md §3).
 * Nunca incluye `tokenHash`, claves internas, el id del impostor antes de que se
 * revele, la palabra para el impostor, los votos individuales de otros ni la
 * reflexión antes de `finished` (RF-003.09, RF-005.04, RF-007.02).
 */
function projectRoom({ doc, version, presence, meId, now, syncMode }) {
  const states = turnStates(doc);
  const points = new Map((doc.series ? doc.series.scores : []).map((s) => [s.playerId, s.points]));
  const players = doc.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.id === doc.hostId,
    isMe: p.id === meId,
    connected: isConnected(presence, p.id, now),
    points: doc.series ? points.get(p.id) ?? 0 : null,
    turnState: states[p.id] ?? null,
  }));
  const me = players.find((p) => p.isMe);
  const game = doc.game;
  const isImpostor = Boolean(game) && game.impostorId === meId;
  const inLobby = doc.phase === 'lobby';

  const dto = {
    code: doc.code,
    version,
    phase: doc.phase,
    gameId: game ? game.gameId : null,
    round: game ? game.round : null,
    serverNow: now,
    deadline: game && game.phaseEndsAt ? game.phaseEndsAt : null,
    me: {
      id: me.id,
      name: me.name,
      isHost: me.isHost,
      role: game ? (isImpostor ? 'impostor' : 'player') : null,
      word: game && !isImpostor ? game.word : null,
    },
    players,
    capacity: { min: config.MIN_PLAYERS, max: config.MAX_PLAYERS, count: players.length },
    words: {
      groupId: doc.words.groupId,
      label: doc.words.label,
      count: doc.words.items.length,
      // La lista editable solo para el anfitrión y en la sala de espera (RF-002.08).
      items: inLobby && me.isHost ? [...doc.words.items] : null,
    },
    canStart: startConditions(doc, presence, now),
    settings: settingsOf(doc),
    series: doc.series
      ? { current: doc.series.current, total: doc.series.total, complete: doc.series.complete, scores: rankScores(doc.series.scores, meId) }
      : null,
    ready: doc.phase === 'roles'
      ? { count: game.ready.length, total: doc.players.length, mine: game.ready.includes(meId) }
      : null,
    turn: null,
    clues: game ? game.clues.map((c) => ({ round: c.round, name: c.name, text: c.text, skipped: c.skipped })) : [],
    vote: null,
    outcome: null,
    result: null,
    invite: { path: `/?sala=${doc.code}` },
    sync: { mode: syncMode, intervalMs: config.POLL_INTERVAL_MS },
  };

  if (doc.phase === 'clues') {
    const playerId = currentTurnPlayer(doc);
    dto.turn = {
      playerId,
      name: doc.players.find((p) => p.id === playerId)?.name ?? '',
      index: game.turnIndex + 1,
      total: game.order.length,
      isMine: playerId === meId,
      attemptsLeft: playerId === meId ? config.MAX_CLUE_REJECTIONS - game.turnRejections : null,
      order: game.order.map((id) => doc.players.find((p) => p.id === id)?.name ?? ''),
    };
  }

  if (doc.phase === 'vote') {
    const { eligible, ballots } = game.vote;
    dto.vote = {
      eligible: eligible.length,
      participation: Object.keys(ballots).length,
      quorum: quorumFor(eligible.length),
      canVote: eligible.includes(meId),
      myVote: Object.hasOwn(ballots, meId) ? ballots[meId] : null, // solo el voto propio
      candidates: players.filter((p) => p.id !== meId).map((p) => ({ id: p.id, name: p.name })),
    };
  }

  if (game && game.outcome && (doc.phase === 'reveal' || doc.phase === 'guess' || doc.phase === 'finished')) {
    const o = game.outcome;
    dto.outcome = {
      kind: o.kind,
      round: o.round,
      tally: o.tally.map((t) => ({ name: t.name, votes: t.votes })),
      participation: o.participation,
      eligible: o.eligible,
      quorum: o.quorum,
      accusedName: o.accusedName ?? null,
      votesFor: o.votesFor ?? null,
      canGuess: doc.phase === 'guess' && isImpostor,
    };
  }

  if (doc.phase === 'finished') {
    const o = game.outcome;
    dto.result = {
      winner: o.winner,
      impostorName: o.impostorName,
      word: game.word,
      guess: o.guess ?? null,
      guessCorrect: o.guessCorrect ?? null,
      hasNextRound: Boolean(o.hasNextRound) && !(doc.series && doc.series.complete),
      reflection: reflectionFor(game.word),
    };
  }

  return dto;
}

module.exports = { projectRoom, isConnected };
