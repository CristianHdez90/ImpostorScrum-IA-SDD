'use strict';

/**
 * Constantes de negocio y operación de SPEC-FEAT-001.
 * Única fuente en el servidor; `public/app.js` replica solo los límites de
 * formulario y una prueba verifica que coincidan (tests/unit/room.test.js).
 * No contiene secretos.
 */
module.exports = Object.freeze({
  SCHEMA_VERSION: 1,

  // Código de sala: 5 letras, sin I ni O (APR-006).
  CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  CODE_LENGTH: 5,
  CREATE_MAX_ATTEMPTS: 5,

  // Participantes.
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 12,
  NAME_MIN: 2,
  NAME_MAX: 26,

  // Partida (SPEC-FEAT-003…006).
  ROLES_SECONDS: 90,
  TURN_SECONDS: 60,
  DISCUSSION_SECONDS: 45,
  VOTE_SECONDS: 75,
  REVEAL_SECONDS: 18,
  GUESS_SECONDS: 45,
  ADVANCE_MAX_STEPS: 64,
  ROUND_BREAK_SECONDS: 20, // pausa entre rondas de una serie (D-31)

  // Configuración de la sala (SPEC-FEAT-009): listas cerradas de valores.
  SETTINGS_OPTIONS: {
    rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    turnSeconds: [30, 45, 60, 90, 120],
    voteSeconds: [45, 60, 75, 90, 120],
  },
  DEFAULT_SETTINGS: { rounds: 1, turnSeconds: 60, voteSeconds: 75 },
  CLUE_MAX: 160,
  GUESS_MAX: 55,
  MAX_CLUE_REJECTIONS: 3, // D-13 (propuesta aplicada en APR-018)

  // Palabras (SPEC-FEAT-002).
  WORDS_MIN: 3,
  WORDS_MAX: 100,
  WORD_MIN: 2,
  WORD_MAX: 55,

  // Limitación de solicitudes (D-20, propuesta aplicada en APR-018). Ventanas en segundos.
  RATE_LIMITS: {
    create: { limit: 10, windowSeconds: 3600 },
    joinIp: { limit: 30, windowSeconds: 600 },
    joinRoom: { limit: 60, windowSeconds: 600 },
    action: { limit: 120, windowSeconds: 60 },
    state: { limit: 240, windowSeconds: 60 },
  },
  RECENT_ACTION_IDS: 10,

  // Persistencia y presencia.
  ROOM_TTL_SECONDS: 6 * 60 * 60,
  PRESENCE_WINDOW_MS: 30_000,
  PRESENCE_WRITE_INTERVAL_MS: 10_000,

  // Escritura atómica (ADR-0002).
  CAS_MAX_ATTEMPTS: 5,
  CAS_BUDGET_MS: 3_000,
  CAS_JITTER_MIN_MS: 20,
  CAS_JITTER_MAX_MS: 120,
  STORE_TIMEOUT_MS: 2_500,

  // Sincronización (ADR-0003).
  POLL_INTERVAL_MS: 1_500,
  SSE_REFRESH_MS: 5_000,
  SSE_HEARTBEAT_MS: 15_000,

  // HTTP.
  MAX_BODY_BYTES: 8 * 1024,

  DEFAULT_KEY_PREFIX: 'farsante:dev',
});
