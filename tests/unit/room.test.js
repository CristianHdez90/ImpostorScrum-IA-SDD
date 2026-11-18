'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../lib/config');
const { foldKey } = require('../../lib/text');
const { validateName, createRoomDoc, addPlayer, DomainError } = require('../../lib/room');
const themes = require('../../public/word-themes.js');

const NOW = 1_763_478_000_000;
const host = { id: 'p_host', name: 'Ana', key: 'ana', tokenHash: 'sha256:x' };
const player = (name) => ({ id: `p_${foldKey(name)}`, name, key: foldKey(name), tokenHash: 'sha256:y' });

function expectDomainError(fn, code) {
  assert.throws(fn, (err) => err instanceof DomainError && err.code === code);
}

test('validateName: 2–26 grafemas tras normalizar espacios (RF-001.03)', () => {
  expectDomainError(() => validateName('E'), 'INVALID_NAME');
  expectDomainError(() => validateName('   '), 'INVALID_NAME');
  expectDomainError(() => validateName('A'.repeat(27)), 'INVALID_NAME');
  expectDomainError(() => validateName(42), 'INVALID_NAME');
  expectDomainError(() => validateName('Ana\u0007'), 'INVALID_NAME');
  assert.equal(validateName('Ev').name, 'Ev');
  assert.equal(validateName('A'.repeat(26)).name.length, 26);
  assert.deepEqual(validateName('  Ána   María '), { name: 'Ána María', key: 'ana maria' });
  assert.equal(validateName('👩\u200D💻👩\u200D💻').name, '👩\u200D💻👩\u200D💻', 'dos emojis compuestos = 2 caracteres');
  assert.equal(validateName(`${'B'.repeat(25)}👩\u200D💻`).name.length > 26, true, 'longitud UTF-16 > 26 pero 26 grafemas: válido');
});

test('createRoomDoc crea la sala en lobby con el anfitrión y el grupo Scrum (RF-001.01, RF-001.04)', () => {
  const doc = createRoomDoc({ code: 'BCDFG', now: NOW, host });
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.phase, 'lobby');
  assert.equal(doc.hostId, 'p_host');
  assert.equal(doc.players.length, 1);
  assert.equal(doc.words.groupId, 'scrum');
  assert.equal(doc.words.label, 'Scrum y equipo');
  assert.equal(doc.words.items.length, 10);
  assert.equal(doc.game, null);
});

test('addPlayer: nombre duplicado sin distinguir mayúsculas ni acentos (APR-007)', () => {
  const doc = createRoomDoc({ code: 'BCDFG', now: NOW, host });
  expectDomainError(() => addPlayer(doc, player('ána'), NOW), 'NAME_TAKEN');
  expectDomainError(() => addPlayer(doc, player('ANA'), NOW), 'NAME_TAKEN');
  addPlayer(doc, player('Luis'), NOW);
  assert.equal(doc.players.length, 2);
});

test('addPlayer: máximo 12 integrantes (RF-001.05)', () => {
  const doc = createRoomDoc({ code: 'BCDFG', now: NOW, host });
  for (let i = 1; i < config.MAX_PLAYERS; i += 1) addPlayer(doc, player(`Jugador ${i}`), NOW);
  assert.equal(doc.players.length, 12);
  expectDomainError(() => addPlayer(doc, player('Uno más'), NOW), 'ROOM_FULL');
});

test('addPlayer: no admite entradas fuera de lobby', () => {
  const doc = createRoomDoc({ code: 'BCDFG', now: NOW, host });
  doc.phase = 'roles';
  expectDomainError(() => addPlayer(doc, player('Luis'), NOW), 'ROOM_STARTED');
});

test('catálogo: 4 grupos de 10 palabras distintas, Scrum por defecto (RF-002.01, APR-008)', () => {
  assert.equal(themes.DEFAULT_GROUP_ID, 'scrum');
  assert.deepEqual(themes.groups.map((g) => g.id), ['scrum', 'comida', 'musica', 'tecnologia']);
  for (const group of themes.groups) {
    assert.equal(group.words.length, 10, group.id);
    assert.equal(new Set(group.words.map(foldKey)).size, 10, `${group.id} sin duplicados`);
  }
  assert.ok(themes.getGroup('scrum').words.includes('Historia de Usuario'));
  assert.ok(themes.getGroup('scrum').words.includes('Review'));
  assert.equal(themes.getGroup('inexistente'), null);
});

test('los límites del formulario en public/app.js coinciden con lib/config.js', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../public/app.js'), 'utf8');
  const match = source.match(/\/\* LIMITS:begin \*\/\s*var LIMITS = Object\.freeze\((\{.*?\})\);\s*\/\* LIMITS:end \*\//s);
  assert.ok(match, 'bloque LIMITS presente');
  assert.deepEqual(JSON.parse(match[1]), {
    codeAlphabet: config.CODE_ALPHABET,
    codeLength: config.CODE_LENGTH,
    nameMin: config.NAME_MIN,
    nameMax: config.NAME_MAX,
    pollIntervalMs: config.POLL_INTERVAL_MS,
    clueMax: config.CLUE_MAX,
    guessMax: config.GUESS_MAX,
    wordMin: config.WORD_MIN,
    wordMax: config.WORD_MAX,
    wordsMin: config.WORDS_MIN,
    wordsMax: config.WORDS_MAX,
    settingsOptions: config.SETTINGS_OPTIONS,
  });
});
