'use strict';

/**
 * Scripts Lua (ADR-0002). Cortos a propósito: la lógica de juego vive en Node;
 * Lua solo garantiza la condición de escritura. Todas las claves van en KEYS.
 */

// KEYS[1]=sala  ARGV[1]=doc  ARGV[2]=ttl → 1 creada, 0 ya existía
const CREATE_ROOM = [
  "if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end",
  "redis.call('HSET', KEYS[1], 'v', '1', 'doc', ARGV[1])",
  "redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))",
  'return 1',
].join('\n');

// KEYS[1]=sala  ARGV[1]=versión esperada  ARGV[2]=doc  ARGV[3]=ttl
// → 1 escrito, 0 conflicto, -1 sala inexistente (nunca la recrea)
const COMPARE_AND_SET = [
  "local v = redis.call('HGET', KEYS[1], 'v')",
  'if not v then return -1 end',
  'if v ~= ARGV[1] then return 0 end',
  "redis.call('HSET', KEYS[1], 'v', tostring(tonumber(v) + 1), 'doc', ARGV[2])",
  "redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))",
  'return 1',
].join('\n');

// KEYS[1]=sala  KEYS[2]=presencia  ARGV[1]=versión esperada
// → 1 eliminada, 0 conflicto, -1 inexistente (sala vacía, RF-008.08)
const DELETE_IF_VERSION = [
  "local v = redis.call('HGET', KEYS[1], 'v')",
  'if not v then return -1 end',
  'if v ~= ARGV[1] then return 0 end',
  "redis.call('DEL', KEYS[1], KEYS[2])",
  'return 1',
].join('\n');

// KEYS[1]=contador  ARGV[1]=ventana en segundos → valor tras incrementar
const RATE_HIT = [
  "local c = redis.call('INCR', KEYS[1])",
  "if c == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end",
  'return c',
].join('\n');

module.exports = { CREATE_ROOM, COMPARE_AND_SET, DELETE_IF_VERSION, RATE_HIT };
