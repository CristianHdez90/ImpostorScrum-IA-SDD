'use strict';

/**
 * Almacén en memoria para el modo local sin Redis (y pruebas).
 * Misma interfaz y semántica CAS que `redis-store`. Guarda JSON serializado
 * para detectar objetos no serializables, igual que en Redis.
 */
function createMemoryStore({ ttlSeconds, now = Date.now } = {}) {
  const rooms = new Map(); // code → { v, doc, expiresAt }
  const presence = new Map(); // code → { map: Map<id, ts>, expiresAt }
  const counters = new Map(); // key → { count, expiresAt }

  function alive(entry) {
    return entry && entry.expiresAt > now();
  }

  function getRoom(code) {
    const entry = rooms.get(code);
    if (!alive(entry)) {
      rooms.delete(code);
      return null;
    }
    return entry;
  }

  function expiry() {
    return now() + ttlSeconds * 1000;
  }

  return {
    kind: 'memory',

    async create(code, doc) {
      if (getRoom(code)) return false;
      rooms.set(code, { v: 1, doc: JSON.stringify(doc), expiresAt: expiry() });
      return true;
    },

    async read(code) {
      const entry = getRoom(code);
      return entry ? { version: entry.v, doc: JSON.parse(entry.doc) } : null;
    },

    async cas(code, expectedVersion, doc) {
      const entry = getRoom(code);
      if (!entry) return 'missing';
      if (entry.v !== expectedVersion) return 'conflict';
      rooms.set(code, { v: entry.v + 1, doc: JSON.stringify(doc), expiresAt: expiry() });
      return 'ok';
    },

    async getPresence(code) {
      const entry = presence.get(code);
      if (!alive(entry)) return {};
      return Object.fromEntries(entry.map);
    },

    async setPresence(code, playerId, timestamp) {
      const entry = alive(presence.get(code)) ? presence.get(code) : { map: new Map() };
      entry.map.set(playerId, timestamp);
      entry.expiresAt = expiry();
      presence.set(code, entry);
      const room = getRoom(code);
      if (room) room.expiresAt = expiry();
    },

    async remove(code, expectedVersion) {
      const entry = getRoom(code);
      if (!entry) return 'missing';
      if (entry.v !== expectedVersion) return 'conflict';
      rooms.delete(code);
      presence.delete(code);
      return 'ok';
    },

    async hit(key, windowSeconds) {
      const entry = counters.get(key);
      if (alive(entry)) {
        entry.count += 1;
        return entry.count;
      }
      counters.set(key, { count: 1, expiresAt: now() + windowSeconds * 1000 });
      return 1;
    },

    async ping() {
      return true;
    },
  };
}

module.exports = { createMemoryStore };
