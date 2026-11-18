'use strict';

const config = require('./config');
const { isConnected, startConditions, quorumFor, currentTurnPlayer } = require('./game');
const { reflectionFor } = require('./reflections');

/**
 * Proyección pública del documento para un integrante (api-contracts.md §3).
 * Nunca incluye `tokenHash`, claves internas, el id del impostor antes de que se
 * revele, la palabra para el impostor, los votos individuales de otros ni la
 * reflexión antes de `finished` (RF-003.09, RF-005.04, RF-007.02).
 */
function projectRoom({ doc, version, presence, meId, now, syncMode }) {
  const players = doc.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.id === doc.hostId,
    isMe: p.id === meId,
    connected: isConnected(presence, p.id, now),
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
      reflection: reflectionFor(game.word),
    };
  }

  return dto;
}

module.exports = { projectRoom, isConnected };
