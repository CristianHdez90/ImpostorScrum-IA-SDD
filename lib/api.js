'use strict';

const crypto = require('node:crypto');
const config = require('./config');
const { generateCode, normalizeCodeInput, isValidCode } = require('./codes');
const room = require('./room');
const game = require('./game');
const { projectRoom } = require('./projection');
const session = require('./session');
const http = require('./http');
const { mutateRoom, DELETE_ROOM, StoreUnavailableError, ConflictExhaustedError, RoomMissingError } = require('./store');

const { HttpError } = http;
const { DomainError } = room;

const ACTION_ID = /^[A-Za-z0-9_-]{1,64}$/u;

/**
 * Casos de uso HTTP: validar → limitar → autorizar → mutar con CAS → proyectar.
 * Compartido por `api/index.js` (Vercel) y `server.js` (local).
 *
 * @param {object} deps
 * @param {object} deps.store                 Almacén (`lib/store`).
 * @param {'poll'|'sse'} deps.syncMode
 * @param {import('node:events').EventEmitter} [deps.notifier]  Solo modo local con SSE.
 * @param {number} [deps.rateLimitMultiplier]  Multiplica los límites (pruebas locales).
 * @param {string} [deps.rateLimitSalt]        Sal para el hash de IP.
 */
function createApiHandler({
  store,
  syncMode,
  notifier = null,
  now = Date.now,
  randomInt = crypto.randomInt,
  randomBytes = crypto.randomBytes,
  log = defaultLog,
  sleep,
  rateLimitMultiplier = 1,
  rateLimitSalt = 'farsante-local',
}) {
  const casOptions = (op) => ({ clock: now, sleep, onConflict: (attempt) => log({ event: 'cas_conflict', op, attempt }) });

  function notify(code) {
    if (notifier) notifier.emit(`room:${code}`);
  }

  /* ---------- Limitación de solicitudes (TM-06, D-20) ---------- */

  function clientKey(req) {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    const ip = forwarded || (req.socket && req.socket.remoteAddress) || 'desconocida';
    return crypto.createHash('sha256').update(`${rateLimitSalt}:${ip}`).digest('hex').slice(0, 16);
  }

  async function limit(scope, key) {
    const rule = config.RATE_LIMITS[scope];
    const count = await store.hit(`${scope}:${key}`, rule.windowSeconds);
    if (count > rule.limit * rateLimitMultiplier) {
      log({ event: 'rate_limited', scope });
      throw new RateLimitError(rule.windowSeconds);
    }
  }

  /* ---------- Presencia y vencimientos ---------- */

  async function touchPresence(code, playerId, presence, at) {
    const last = presence[playerId];
    if (typeof last === 'number' && at - last < config.PRESENCE_WRITE_INTERVAL_MS) return presence;
    await store.setPresence(code, playerId, at);
    const wasConnected = typeof last === 'number' && at - last <= config.PRESENCE_WINDOW_MS;
    if (!wasConnected) notify(code);
    return { ...presence, [playerId]: at };
  }

  /** Aplica en la petición los vencimientos pendientes (ADR-0003 §3). */
  async function advanceIfDue(code, current) {
    const at = now();
    if (!game.isDue(current.doc, at)) return current;
    const result = await mutateRoom(store, code, (doc) => (game.advance(doc, at, randomInt) ? doc : null), casOptions('advance'));
    notify(code);
    return result;
  }

  function respondWithRoom(res, status, { doc, version, presence, meId, at }, extraHeaders) {
    const dto = projectRoom({ doc, version, presence, meId, now: at, syncMode });
    http.sendJson(res, status, dto, extraHeaders);
  }

  /* ---------- Crear y unirse (SPEC-FEAT-001) ---------- */

  async function handleCreate(req, res) {
    http.assertJsonPost(req);
    await limit('create', clientKey(req));
    const body = await http.readJsonObject(req);
    http.assertAllowedFields(body, ['name', 'groupId', 'settings']);
    const { name, key } = room.validateName(body.name);
    const words = body.groupId === undefined ? undefined : room.wordsFromGroup(body.groupId);
    const settings = body.settings === undefined ? undefined : room.validateSettings(body.settings);
    const credentials = session.newPlayerCredentials(randomBytes);
    const at = now();
    const host = { ...credentials, name, key };

    let code = null;
    let doc = null;
    for (let attempt = 1; attempt <= config.CREATE_MAX_ATTEMPTS; attempt += 1) {
      const candidate = generateCode(randomInt);
      const candidateDoc = room.createRoomDoc({ code: candidate, now: at, host, words, settings });
      if (await store.create(candidate, candidateDoc)) {
        code = candidate;
        doc = candidateDoc;
        break;
      }
      log({ event: 'room_code_collision', attempt });
    }
    if (!code) throw new StoreUnavailableError('code_collisions');

    await store.setPresence(code, host.id, at);
    const cookie = session.buildSessionCookie(code, host.id, credentials.token, http.isSecureRequest(req));
    respondWithRoom(res, 201, { doc, version: 1, presence: { [host.id]: at }, meId: host.id, at }, { 'Set-Cookie': cookie });
  }

  async function handleJoin(req, res) {
    http.assertJsonPost(req);
    await limit('joinIp', clientKey(req));
    const body = await http.readJsonObject(req);
    http.assertAllowedFields(body, ['code', 'name']);
    const code = normalizeCodeInput(body.code);
    if (!isValidCode(code)) {
      throw new HttpError('INVALID_CODE', 'El código tiene cinco letras (sin I ni O). Revísalo e inténtalo de nuevo.');
    }
    await limit('joinRoom', code);

    const existing = await store.read(code);
    if (!existing) throw new RoomMissingError();

    // Reingreso idempotente: ya es integrante con cookie válida (RF-001.15).
    const current = session.verifySession(existing.doc, session.readSessionCookie(req.headers.cookie, code));
    if (current) {
      const at = now();
      const presence = await touchPresence(code, current.id, await store.getPresence(code), at);
      respondWithRoom(res, 200, { doc: existing.doc, version: existing.version, presence, meId: current.id, at });
      return;
    }

    const { name, key } = room.validateName(body.name);
    const credentials = session.newPlayerCredentials(randomBytes);
    const at = now();
    const player = { ...credentials, name, key };
    const result = await mutateRoom(store, code, (doc) => room.addPlayer(doc, player, at), casOptions('join'));

    await store.setPresence(code, player.id, at);
    const presence = { ...(await store.getPresence(code)), [player.id]: at };
    notify(code);
    const cookie = session.buildSessionCookie(code, player.id, credentials.token, http.isSecureRequest(req));
    respondWithRoom(res, 201, { doc: result.doc, version: result.version, presence, meId: player.id, at }, { 'Set-Cookie': cookie });
  }

  /* ---------- Sesión ---------- */

  async function authorizeCode(req, rawCode) {
    const code = normalizeCodeInput(rawCode);
    if (!isValidCode(code)) throw new HttpError('INVALID_CODE', 'Código de sala inválido.');
    const credentials = session.readSessionCookie(req.headers.cookie, code);
    // Sin cookie de esa sala no se revela si la sala existe (TM-01).
    if (!credentials) throw new SessionError(code);
    const stored = await store.read(code);
    if (!stored) throw new RoomGoneError(code);
    const player = session.verifySession(stored.doc, credentials);
    if (!player) throw new SessionError(code);
    return { code, room: await advanceIfDue(code, stored), player };
  }

  async function handleState(req, res, url) {
    const { code, room: current, player } = await authorizeCode(req, url.searchParams.get('code'));
    await limit('state', player.id);
    const at = now();
    const presence = await touchPresence(code, player.id, await store.getPresence(code), at);
    respondWithRoom(res, 200, { doc: current.doc, version: current.version, presence, meId: player.id, at });
  }

  /* ---------- Acciones (SPEC-FEAT-002…007) ---------- */

  const ACTIONS = {
    words: {
      fields: ['groupId', 'items'],
      prepare: (payload) => ({ words: room.validateWords(payload) }),
      run: (doc, c) => room.saveWords(doc, { actorId: c.playerId, words: c.words, now: c.at }),
    },
    settings: {
      fields: ['rounds', 'turnSeconds', 'voteSeconds'],
      prepare: (payload) => ({ settings: room.validateSettings(payload) }),
      run: (doc, c) => room.saveSettings(doc, { actorId: c.playerId, settings: c.settings, now: c.at }),
    },
    nextGame: { fields: [], run: (doc, c) => game.nextGame(doc, { actorId: c.playerId, gameId: c.gameId, now: c.at, randomInt }) },
    start: { fields: [], run: (doc, c) => game.startGame(doc, { actorId: c.playerId, presence: c.presence, now: c.at, randomInt }) },
    ready: { fields: [], run: (doc, c) => game.markReady(doc, { actorId: c.playerId, gameId: c.gameId, now: c.at, randomInt }) },
    clue: { fields: ['text'], run: (doc, c) => game.submitClue(doc, { actorId: c.playerId, gameId: c.gameId, text: c.payload.text, now: c.at }, c) },
    skip: { fields: [], run: (doc, c) => game.skipTurn(doc, { actorId: c.playerId, gameId: c.gameId, now: c.at }) },
    voting: { fields: [], run: (doc, c) => game.openVoting(doc, { actorId: c.playerId, gameId: c.gameId, now: c.at }) },
    vote: { fields: ['targetId'], run: (doc, c) => game.castVote(doc, { actorId: c.playerId, gameId: c.gameId, targetId: c.payload.targetId, now: c.at }) },
    closeVote: { fields: [], run: (doc, c) => game.closeVoteByHost(doc, { actorId: c.playerId, gameId: c.gameId, now: c.at }) },
    next: { fields: [], run: (doc, c) => game.nextRound(doc, { actorId: c.playerId, gameId: c.gameId, now: c.at, randomInt }) },
    guess: { fields: ['text'], run: (doc, c) => game.submitGuess(doc, { actorId: c.playerId, gameId: c.gameId, text: c.payload.text, now: c.at }) },
    reset: { fields: [], run: (doc, c) => game.resetGame(doc, { actorId: c.playerId, gameId: c.gameId, now: c.at }) },
    playAgain: {
      fields: [],
      run: (doc, c) => {
        if (doc.phase !== 'finished' || (doc.series && !doc.series.complete)) {
          throw new DomainError('WRONG_PHASE', 'La serie todavía no terminó.');
        }
        return game.resetGame(doc, { actorId: c.playerId, gameId: c.gameId, now: c.at });
      },
    },
    leave: { fields: [], run: (doc, c) => room.removePlayer(doc, { actorId: c.playerId, now: c.at }) ?? DELETE_ROOM },
  };

  async function handleAction(req, res) {
    http.assertJsonPost(req);
    const body = await http.readJsonObject(req);
    http.assertAllowedFields(body, ['code', 'type', 'payload', 'gameId', 'actionId']);
    const action = typeof body.type === 'string' && Object.hasOwn(ACTIONS, body.type) ? ACTIONS[body.type] : null;
    if (!action) throw new HttpError('INVALID_ACTION', 'Acción no reconocida.');
    const payload = body.payload ?? {};
    if (typeof payload !== 'object' || Array.isArray(payload)) throw new HttpError('INVALID_ACTION', 'Datos de la acción inválidos.');
    http.assertAllowedFields(payload, action.fields);
    if (body.gameId !== undefined && body.gameId !== null && typeof body.gameId !== 'string') {
      throw new HttpError('INVALID_ACTION', 'Identificador de partida inválido.');
    }
    if (body.actionId !== undefined && (typeof body.actionId !== 'string' || !ACTION_ID.test(body.actionId))) {
      throw new HttpError('INVALID_ACTION', 'Identificador de acción inválido.');
    }
    const prepared = action.prepare ? action.prepare(payload) : {};

    const { code, player } = await authorizeCode(req, body.code);
    await limit('action', player.id);
    const at = now();
    const presence = await touchPresence(code, player.id, await store.getPresence(code), at);
    const ctx = { playerId: player.id, gameId: body.gameId ?? null, payload, presence, at, ...prepared };

    const result = await mutateRoom(store, code, (doc) => {
      ctx.rejection = null;
      const advanced = game.advance(doc, at, randomInt);
      // Reintento de transporte con el mismo actionId: no repetir el efecto (RF-008T.04).
      const recent = (doc.recentActions && doc.recentActions[player.id]) || [];
      if (body.actionId && recent.includes(body.actionId)) return advanced ? doc : null;
      const next = action.run(doc, ctx);
      if (next === DELETE_ROOM) return DELETE_ROOM;
      if (next && body.actionId && !ctx.rejection) {
        doc.recentActions = { ...(doc.recentActions || {}), [player.id]: [...recent, body.actionId].slice(-config.RECENT_ACTION_IDS) };
      }
      return next || advanced ? doc : null;
    }, casOptions(body.type));

    notify(code);
    log({ event: 'action', type: body.type, outcome: ctx.rejection ? 'rejected' : 'ok' });

    if (body.type === 'leave') {
      http.sendJson(res, 200, { left: true }, { 'Set-Cookie': session.buildClearCookie(code, http.isSecureRequest(req)) });
      return;
    }
    if (ctx.rejection) throw new DomainError(ctx.rejection.code, ctx.rejection.message);
    respondWithRoom(res, 200, { doc: result.doc, version: result.version, presence, meId: player.id, at });
  }

  /* ---------- SSE local ---------- */

  async function handleEvents(req, res, url) {
    if (!notifier) throw new HttpError('NOT_FOUND', 'Recurso no encontrado.');
    const { code, player } = await authorizeCode(req, url.searchParams.get('code'));

    res.statusCode = 200;
    for (const [name, value] of Object.entries(http.SECURITY_HEADERS)) res.setHeader(name, value);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    res.write('retry: 2000\n\n');

    let lastPayload = '';
    let closed = false;
    let sending = false;
    let pending = false;
    let deadlineTimer = null;

    async function send() {
      if (closed) return;
      if (sending) {
        pending = true;
        return;
      }
      sending = true;
      try {
        const stored = await store.read(code);
        const current = stored ? await advanceIfDue(code, stored) : null;
        if (!current || !current.doc.players.some((p) => p.id === player.id)) {
          res.write('event: gone\ndata: {}\n\n');
          cleanup();
          res.end();
          return;
        }
        const at = now();
        const presence = await touchPresence(code, player.id, await store.getPresence(code), at);
        const dto = projectRoom({ doc: current.doc, version: current.version, presence, meId: player.id, now: at, syncMode });
        const comparable = JSON.stringify({ ...dto, serverNow: 0 });
        if (comparable !== lastPayload) {
          lastPayload = comparable;
          res.write(`data: ${JSON.stringify(dto)}\n\n`);
        }
        clearTimeout(deadlineTimer);
        if (dto.deadline) deadlineTimer = setTimeout(send, Math.max(0, dto.deadline - at) + 50);
      } catch (err) {
        log({ event: 'sse_send_failed', error: err && err.name });
      } finally {
        sending = false;
        if (pending && !closed) {
          pending = false;
          send();
        }
      }
    }

    const onChange = () => send();
    const refresh = setInterval(send, config.SSE_REFRESH_MS);
    const heartbeat = setInterval(() => !closed && res.write(': ping\n\n'), config.SSE_HEARTBEAT_MS);
    function cleanup() {
      if (closed) return;
      closed = true;
      clearInterval(refresh);
      clearInterval(heartbeat);
      clearTimeout(deadlineTimer);
      notifier.off(`room:${code}`, onChange);
    }
    notifier.on(`room:${code}`, onChange);
    req.on('close', cleanup);
    await send();
  }

  /* ---------- Salud (RF-008T.05) ---------- */

  async function handleHealth(req, res) {
    try {
      await store.ping();
      http.sendJson(res, 200, { status: 'ok', store: store.kind });
    } catch {
      http.sendJson(res, 503, { status: 'unavailable' });
    }
  }

  const routes = {
    'POST create': handleCreate,
    'POST join': handleJoin,
    'GET state': handleState,
    'GET events': handleEvents,
    'POST action': handleAction,
    'GET health': handleHealth,
  };

  return async function handle(req, res) {
    const started = now();
    const requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    const url = new URL(req.url, 'http://localhost');
    // En Vercel la reescritura añade `route`; en local se usa la ruta.
    const route = url.searchParams.get('route')
      ?? (url.pathname === '/health' ? 'health' : url.pathname.replace(/^\/api\/?/u, ''));
    const handler = routes[`${req.method} ${route}`];
    let outcome = 'ok';
    try {
      if (!handler) {
        const known = Object.keys(routes).some((k) => k.endsWith(` ${route}`));
        throw new HttpError(known ? 'METHOD_NOT_ALLOWED' : 'NOT_FOUND', known ? 'Método no permitido.' : 'Recurso no encontrado.');
      }
      await handler(req, res, url);
    } catch (err) {
      outcome = sendError(req, res, err);
    } finally {
      log({ event: 'request', requestId, route: route.slice(0, 40), method: req.method, status: res.statusCode, outcome, ms: now() - started });
    }
  };
}

class SessionError extends Error {
  constructor(code) {
    super('Sesión inválida');
    this.roomCode = code;
  }
}

class RoomGoneError extends Error {
  constructor(code) {
    super('Sala inexistente');
    this.roomCode = code;
  }
}

class RateLimitError extends Error {
  constructor(retryAfterSeconds) {
    super('Demasiadas solicitudes');
    this.retryAfter = retryAfterSeconds;
  }
}

/** Traduce errores a respuestas sin trazas ni detalles del proveedor. */
function sendError(req, res, err) {
  if (res.headersSent) {
    res.end();
    return 'aborted';
  }
  const secure = http.isSecureRequest(req);
  if (err instanceof SessionError) {
    http.sendJson(res, 401, http.errorBody('SESSION_INVALID', 'Tu sesión en esta sala no es válida. Vuelve a unirte.'), {
      'Set-Cookie': session.buildClearCookie(err.roomCode, secure),
    });
    return 'SESSION_INVALID';
  }
  if (err instanceof RoomGoneError || err instanceof RoomMissingError) {
    const headers = err.roomCode ? { 'Set-Cookie': session.buildClearCookie(err.roomCode, secure) } : {};
    http.sendJson(res, 404, http.errorBody('ROOM_NOT_FOUND', 'No encontramos esa sala. Puede que el código sea incorrecto o que la sala haya expirado.'), headers);
    return 'ROOM_NOT_FOUND';
  }
  if (err instanceof RateLimitError) {
    http.sendJson(res, 429, http.errorBody('RATE_LIMITED', 'Demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo.'), { 'Retry-After': String(Math.min(err.retryAfter, 60)) });
    return 'RATE_LIMITED';
  }
  if (err instanceof DomainError || err instanceof HttpError) {
    http.sendJson(res, http.statusFor(err.code), http.errorBody(err.code, err.message));
    return err.code;
  }
  if (err instanceof StoreUnavailableError) {
    http.sendJson(res, 503, http.errorBody('STORE_UNAVAILABLE', 'No pudimos contactar con el servidor de partidas. Reintentaremos automáticamente.'), { 'Retry-After': '2' });
    return `STORE_UNAVAILABLE:${err.reason}`;
  }
  if (err instanceof ConflictExhaustedError) {
    http.sendJson(res, 409, http.errorBody('CONFLICT_RETRY_EXHAUSTED', 'Hubo muchos cambios a la vez. Inténtalo de nuevo.'));
    return 'CONFLICT_RETRY_EXHAUSTED';
  }
  http.sendJson(res, 500, http.errorBody('INTERNAL', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
  return `INTERNAL:${err && err.name}`;
}

/** Registro técnico en una línea JSON: sin nombres, tokens, cookies, palabras, votos ni códigos de sala. */
function defaultLog(entry) {
  process.stdout.write(`${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`);
}

module.exports = { createApiHandler };
