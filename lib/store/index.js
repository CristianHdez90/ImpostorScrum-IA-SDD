'use strict';

const config = require('../config');
const { createMemoryStore } = require('./memory-store');
const { createRedisStore, StoreUnavailableError } = require('./redis-store');

/** Almacén que siempre falla: Vercel sin Redis configurado (RF-001.19). */
function createUnavailableStore(reason) {
  const fail = async () => {
    throw new StoreUnavailableError(reason);
  };
  return { kind: 'unavailable', create: fail, read: fail, cas: fail, remove: fail, hit: fail, getPresence: fail, setPresence: fail, ping: fail };
}

/**
 * Elige el almacén según el entorno:
 * - Variables UPSTASH_* completas → Redis.
 * - Solo una de las dos → no disponible (configuración incompleta).
 * - Sin variables y en Vercel → no disponible. **Nunca memoria en Vercel.**
 * - Sin variables y local → memoria (con SSE).
 */
function selectStore(env = process.env, { now = Date.now, fetchImpl } = {}) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  const prefix = env.REDIS_KEY_PREFIX || config.DEFAULT_KEY_PREFIX;
  const onVercel = Boolean(env.VERCEL);

  if (url && token) {
    return {
      mode: 'redis',
      store: createRedisStore({ url, token, prefix, ttlSeconds: config.ROOM_TTL_SECONDS, timeoutMs: config.STORE_TIMEOUT_MS, fetchImpl }),
    };
  }
  if (url || token) {
    return { mode: 'unavailable', reason: 'incomplete_redis_config', store: createUnavailableStore('incomplete_redis_config') };
  }
  if (onVercel) {
    return { mode: 'unavailable', reason: 'missing_redis_config', store: createUnavailableStore('missing_redis_config') };
  }
  return { mode: 'memory', store: createMemoryStore({ ttlSeconds: config.ROOM_TTL_SECONDS, now }) };
}

class ConflictExhaustedError extends Error {
  constructor() {
    super('Demasiados cambios simultáneos');
    this.name = 'ConflictExhaustedError';
  }
}

class RoomMissingError extends Error {
  constructor() {
    super('Sala inexistente');
    this.name = 'RoomMissingError';
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Valor que un mutador devuelve para eliminar la sala (último integrante que sale). */
const DELETE_ROOM = Symbol('DELETE_ROOM');

/**
 * Lee → aplica `mutator(doc)` → escribe con CAS. Reintenta sobre el estado más
 * reciente con espera aleatoria, dentro de un número máximo de intentos y de un
 * presupuesto total. `mutator` debe ser pura (puede ejecutarse varias veces) y
 * devolver el documento nuevo, o `null` si no hay cambios.
 */
async function mutateRoom(store, code, mutator, { clock = Date.now, sleep = defaultSleep, random = Math.random, onConflict } = {}) {
  const started = clock();
  for (let attempt = 1; attempt <= config.CAS_MAX_ATTEMPTS; attempt += 1) {
    const current = await store.read(code);
    if (!current) throw new RoomMissingError();
    const next = mutator(current.doc, current.version);
    if (next === null) return current;
    const result = next === DELETE_ROOM
      ? await store.remove(code, current.version)
      : await store.cas(code, current.version, next);
    if (result === 'ok') return next === DELETE_ROOM ? { deleted: true } : { version: current.version + 1, doc: next };
    if (result === 'missing') throw new RoomMissingError();
    if (onConflict) onConflict(attempt);
    const wait = config.CAS_JITTER_MIN_MS + Math.floor(random() * (config.CAS_JITTER_MAX_MS - config.CAS_JITTER_MIN_MS));
    if (clock() - started + wait > config.CAS_BUDGET_MS) break;
    await sleep(wait);
  }
  throw new ConflictExhaustedError();
}

module.exports = {
  selectStore,
  mutateRoom,
  DELETE_ROOM,
  createUnavailableStore,
  StoreUnavailableError,
  ConflictExhaustedError,
  RoomMissingError,
};
