'use strict';

const { CREATE_ROOM, COMPARE_AND_SET, DELETE_IF_VERSION, RATE_HIT } = require('./scripts');

class StoreUnavailableError extends Error {
  constructor(reason) {
    super('Almacén no disponible');
    this.name = 'StoreUnavailableError';
    this.reason = reason; // etiqueta técnica sin secretos
  }
}

/**
 * Cliente Upstash Redis REST con `fetch` nativo (ADR-0001, APR-010).
 * Nunca registra la URL ni el token. Cada llamada tiene tiempo límite.
 */
function createRedisStore({ url, token, prefix, ttlSeconds, timeoutMs, fetchImpl = globalThis.fetch }) {
  const baseUrl = String(url).replace(/\/+$/u, '');
  const roomKey = (code) => `${prefix}:room:${code}`;
  const presenceKey = (code) => `${prefix}:presence:${code}`;

  async function post(path, body) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new StoreUnavailableError(err && err.name === 'TimeoutError' ? 'timeout' : 'network');
    }
    if (!response.ok) throw new StoreUnavailableError(`http_${response.status}`);
    let json;
    try {
      json = await response.json();
    } catch {
      throw new StoreUnavailableError('invalid_response');
    }
    return json;
  }

  async function command(...args) {
    const json = await post('', args);
    if (json && json.error) throw new StoreUnavailableError('command_error');
    return json.result;
  }

  async function pipeline(commands) {
    const json = await post('/pipeline', commands);
    if (!Array.isArray(json) || json.some((item) => item && item.error)) {
      throw new StoreUnavailableError('pipeline_error');
    }
    return json.map((item) => item.result);
  }

  return {
    kind: 'redis',

    async create(code, doc) {
      const result = await command('EVAL', CREATE_ROOM, 1, roomKey(code), JSON.stringify(doc), ttlSeconds);
      return Number(result) === 1;
    },

    async read(code) {
      const [v, doc] = await command('HMGET', roomKey(code), 'v', 'doc');
      if (v === null || v === undefined || doc === null || doc === undefined) return null;
      return { version: Number(v), doc: JSON.parse(doc) };
    },

    async cas(code, expectedVersion, doc) {
      const result = Number(
        await command('EVAL', COMPARE_AND_SET, 1, roomKey(code), String(expectedVersion), JSON.stringify(doc), ttlSeconds),
      );
      if (result === 1) return 'ok';
      if (result === 0) return 'conflict';
      return 'missing';
    },

    async getPresence(code) {
      const flat = (await command('HGETALL', presenceKey(code))) ?? [];
      const result = {};
      for (let i = 0; i + 1 < flat.length; i += 2) result[flat[i]] = Number(flat[i + 1]);
      return result;
    },

    async setPresence(code, playerId, timestamp) {
      await pipeline([
        ['HSET', presenceKey(code), playerId, String(timestamp)],
        ['EXPIRE', presenceKey(code), ttlSeconds],
        ['EXPIRE', roomKey(code), ttlSeconds],
      ]);
    },

    async remove(code, expectedVersion) {
      const result = Number(await command('EVAL', DELETE_IF_VERSION, 2, roomKey(code), presenceKey(code), String(expectedVersion)));
      if (result === 1) return 'ok';
      if (result === 0) return 'conflict';
      return 'missing';
    },

    async hit(key, windowSeconds) {
      return Number(await command('EVAL', RATE_HIT, 1, `${prefix}:rl:${key}`, windowSeconds));
    },

    async ping() {
      return (await command('PING')) === 'PONG';
    },
  };
}

module.exports = { createRedisStore, StoreUnavailableError };
