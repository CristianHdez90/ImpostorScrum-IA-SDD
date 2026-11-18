'use strict';

const config = require('./config');
const { normalizeSpaces, graphemeCount, hasControlChars, foldKey } = require('./text');
const wordThemes = require('../public/word-themes.js');

/** Error de regla de negocio; `lib/http.js` lo traduce a estado HTTP. */
class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

/**
 * Valida un nombre visible (RF-001.03): 2–26 grafemas tras normalizar espacios,
 * sin caracteres de control. Devuelve la escritura visible y su clave de comparación.
 */
function validateName(raw) {
  if (typeof raw !== 'string') {
    throw new DomainError('INVALID_NAME', 'Escribe tu nombre.');
  }
  const name = normalizeSpaces(raw);
  const length = graphemeCount(name);
  if (length < config.NAME_MIN || length > config.NAME_MAX) {
    throw new DomainError(
      'INVALID_NAME',
      `El nombre debe tener entre ${config.NAME_MIN} y ${config.NAME_MAX} caracteres.`,
    );
  }
  if (hasControlChars(name)) {
    throw new DomainError('INVALID_NAME', 'El nombre contiene caracteres no permitidos.');
  }
  return { name, key: foldKey(name) };
}

/** Grupo inicial (RF-001.04, APR-008): copia del catálogo único. */
function defaultWords() {
  const group = wordThemes.getGroup(wordThemes.DEFAULT_GROUP_ID);
  return { groupId: group.id, label: group.label, items: [...group.words] };
}

/** Documento de una sala nueva en `lobby` con su anfitrión. */
function createRoomDoc({ code, now, host, words, settings }) {
  return {
    schemaVersion: config.SCHEMA_VERSION,
    code,
    createdAt: now,
    lastActivityAt: now,
    hostId: host.id,
    players: [toStoredPlayer(host, now)],
    words: words ?? defaultWords(),
    settings: settings ?? { ...config.DEFAULT_SETTINGS },
    series: null,
    phase: 'lobby',
    game: null,
  };
}

function toStoredPlayer(player, now) {
  return {
    id: player.id,
    name: player.name,
    nameKey: player.key,
    joinedAt: now,
    tokenHash: player.tokenHash,
  };
}

/**
 * Añade un integrante (RF-001.05/06). Modifica y devuelve `doc`.
 * Orden de comprobaciones: fase → cupo → nombre.
 */
function addPlayer(doc, player, now) {
  if (doc.phase !== 'lobby') {
    throw new DomainError('ROOM_STARTED', 'Esta sala ya comenzó una partida. Pide al anfitrión que la reinicie o crea otra sala.');
  }
  if (doc.players.length >= config.MAX_PLAYERS) {
    throw new DomainError('ROOM_FULL', `La sala está llena (${config.MAX_PLAYERS} de ${config.MAX_PLAYERS}).`);
  }
  if (doc.players.some((p) => p.nameKey === player.key)) {
    throw new DomainError('NAME_TAKEN', `Ya hay alguien llamado «${player.name}» en esta sala. Prueba con otro nombre.`);
  }
  doc.players.push(toStoredPlayer(player, now));
  doc.lastActivityAt = now;
  return doc;
}

function findPlayer(doc, playerId) {
  return doc.players.find((p) => p.id === playerId) ?? null;
}

/** Grupo del catálogo por id (para crear la sala con otro grupo, RF-002.03). */
function wordsFromGroup(groupId) {
  const group = wordThemes.getGroup(groupId);
  if (!group) throw new DomainError('INVALID_WORDS', 'Ese grupo de palabras no existe.');
  return { groupId: group.id, label: group.label, items: [...group.words] };
}

/**
 * Valida una lista de palabras (RF-002.06/07, D-17: se rechaza la lista entera
 * indicando las entradas inválidas). Si coincide con un grupo del catálogo
 * conserva su nombre; si no, es «Personalizado» (RF-002.10).
 */
function validateWords(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw new DomainError('INVALID_WORDS', 'Envía una lista de palabras.');
  }
  if (payload.items.length > config.WORDS_MAX * 2) {
    throw new DomainError('INVALID_WORDS', `La lista admite hasta ${config.WORDS_MAX} palabras.`);
  }
  const items = [];
  const seen = new Set();
  const invalid = [];
  for (const raw of payload.items) {
    if (typeof raw !== 'string') { invalid.push('(valor no válido)'); continue; }
    const word = normalizeSpaces(raw);
    if (word === '') continue; // líneas vacías del editor
    const length = graphemeCount(word);
    if (length < config.WORD_MIN || length > config.WORD_MAX || hasControlChars(word)) { invalid.push(word.slice(0, 30)); continue; }
    const key = foldKey(word);
    if (seen.has(key)) continue; // duplicado: se conserva la primera escritura
    seen.add(key);
    items.push(word);
  }
  if (invalid.length > 0) {
    throw new DomainError('INVALID_WORDS', `Cada palabra debe tener entre ${config.WORD_MIN} y ${config.WORD_MAX} caracteres. Revisa: ${invalid.slice(0, 5).join(', ')}.`);
  }
  if (items.length < config.WORDS_MIN) {
    throw new DomainError('INVALID_WORDS', `Se necesitan al menos ${config.WORDS_MIN} palabras distintas.`);
  }
  if (items.length > config.WORDS_MAX) {
    throw new DomainError('INVALID_WORDS', `La lista admite hasta ${config.WORDS_MAX} palabras.`);
  }
  const group = typeof payload.groupId === 'string' ? wordThemes.getGroup(payload.groupId) : null;
  const sameAsGroup = group && group.words.length === items.length && group.words.every((w, i) => foldKey(w) === foldKey(items[i]));
  return sameAsGroup
    ? { groupId: group.id, label: group.label, items }
    : { groupId: 'custom', label: 'Personalizado', items };
}

/** Configuración vigente; los documentos anteriores a SPEC-FEAT-009 usan los valores por defecto. */
function settingsOf(doc) {
  return { ...config.DEFAULT_SETTINGS, ...(doc.settings || {}) };
}

/** Valida rondas y tiempos contra las listas cerradas (RF-009.01). */
function validateSettings(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new DomainError('INVALID_SETTINGS', 'Configuración de partida inválida.');
  }
  const result = { ...config.DEFAULT_SETTINGS };
  for (const [key, options] of Object.entries(config.SETTINGS_OPTIONS)) {
    if (payload[key] === undefined) continue;
    const value = Number(payload[key]);
    if (!options.includes(value)) {
      throw new DomainError('INVALID_SETTINGS', `Valor no permitido para ${key === 'rounds' ? 'las rondas' : 'el tiempo'}: elige uno de la lista.`);
    }
    result[key] = value;
  }
  for (const key of Object.keys(payload)) {
    if (!Object.hasOwn(config.SETTINGS_OPTIONS, key)) throw new DomainError('INVALID_SETTINGS', 'Configuración de partida inválida.');
  }
  return result;
}

/** Guarda la configuración (solo anfitrión y en `lobby`, RF-009.02). */
function saveSettings(doc, { actorId, settings, now }) {
  if (actorId !== doc.hostId) throw new DomainError('NOT_HOST', 'Solo el anfitrión puede cambiar la configuración.');
  if (doc.phase !== 'lobby') throw new DomainError('WRONG_PHASE', 'La configuración solo se cambia en la sala de espera.');
  doc.settings = settings;
  doc.lastActivityAt = now;
  return doc;
}

/** Guarda las palabras (solo anfitrión y en `lobby`, RF-002.09). */
function saveWords(doc, { actorId, words, now }) {
  if (actorId !== doc.hostId) throw new DomainError('NOT_HOST', 'Solo el anfitrión puede cambiar las palabras.');
  if (doc.phase !== 'lobby') throw new DomainError('WRONG_PHASE', 'Las palabras solo se cambian en la sala de espera.');
  doc.words = words;
  doc.lastActivityAt = now;
  return doc;
}

/**
 * Salida (RF-008.07/08): solo en `lobby` o `finished`. Si sale el anfitrión, el
 * control pasa al siguiente por orden de entrada. Devuelve `null` si la sala
 * queda vacía (debe eliminarse).
 */
function removePlayer(doc, { actorId, now }) {
  if (doc.phase !== 'lobby' && doc.phase !== 'finished') {
    throw new DomainError('WRONG_PHASE', 'No puedes salir durante una partida. Pide al anfitrión que la reinicie y sal desde la sala de espera.');
  }
  doc.players = doc.players.filter((p) => p.id !== actorId);
  if (doc.players.length === 0) return null;
  if (doc.hostId === actorId) doc.hostId = doc.players[0].id;
  doc.lastActivityAt = now;
  return doc;
}

module.exports = {
  DomainError,
  validateName,
  createRoomDoc,
  addPlayer,
  findPlayer,
  defaultWords,
  wordsFromGroup,
  validateWords,
  saveWords,
  removePlayer,
  settingsOf,
  validateSettings,
  saveSettings,
};
