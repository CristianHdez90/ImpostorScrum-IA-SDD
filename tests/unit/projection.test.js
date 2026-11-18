'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { projectRoom } = require('../../lib/projection');
const { createRoomDoc, addPlayer } = require('../../lib/room');

const NOW = 1_763_478_000_000;

function room() {
  const doc = createRoomDoc({ code: 'BCDFG', now: NOW, host: { id: 'p_ana', name: 'Ana', key: 'ana', tokenHash: 'sha256:secreto-ana' } });
  addPlayer(doc, { id: 'p_luis', name: 'Luis', key: 'luis', tokenHash: 'sha256:secreto-luis' }, NOW);
  return doc;
}

test('la proyección no expone hashes, claves internas ni la lista de palabras', () => {
  const dto = projectRoom({ doc: room(), version: 2, presence: { p_ana: NOW, p_luis: NOW }, meId: 'p_luis', now: NOW, syncMode: 'poll' });
  const json = JSON.stringify(dto);
  assert.doesNotMatch(json, /secreto|tokenHash|nameKey/);
  assert.doesNotMatch(json, /Historia de Usuario/);
  assert.deepEqual(dto.words, { groupId: 'scrum', label: 'Scrum y equipo', count: 10, items: null }, 'Luis no es anfitrión');
  const hostView = projectRoom({ doc: room(), version: 2, presence: {}, meId: 'p_ana', now: NOW, syncMode: 'poll' });
  assert.equal(hostView.words.items.length, 10);
  assert.deepEqual(dto.me, { id: 'p_luis', name: 'Luis', isHost: false, role: null, word: null });
  assert.equal(dto.ready, null);
  assert.equal(dto.gameId, null);
  assert.equal(dto.players.find((p) => p.isHost).name, 'Ana');
  assert.equal(dto.invite.path, '/?sala=BCDFG');
  assert.deepEqual(dto.sync, { mode: 'poll', intervalMs: 1500 });
});

test('conectado si hubo contacto en los últimos 30 s (RF-001.08)', () => {
  const at = (ms) => projectRoom({ doc: room(), version: 2, presence: { p_ana: NOW, p_luis: NOW - ms }, meId: 'p_ana', now: NOW, syncMode: 'sse' });
  assert.equal(at(30_000).players.find((p) => p.id === 'p_luis').connected, true);
  assert.equal(at(30_001).players.find((p) => p.id === 'p_luis').connected, false);
  const none = projectRoom({ doc: room(), version: 2, presence: {}, meId: 'p_ana', now: NOW, syncMode: 'sse' });
  assert.equal(none.players.every((p) => p.connected === false), true);
});

test('canStart informa participantes faltantes y desconectados (RF-001.09)', () => {
  const dto = projectRoom({ doc: room(), version: 2, presence: { p_ana: NOW }, meId: 'p_ana', now: NOW, syncMode: 'poll' });
  assert.deepEqual(dto.canStart, { ok: false, reasons: ['MISSING_PLAYERS', 'PLAYERS_DISCONNECTED'], missingPlayers: 1, disconnected: ['Luis'] });
  assert.deepEqual(dto.capacity, { min: 3, max: 12, count: 2 });
});
