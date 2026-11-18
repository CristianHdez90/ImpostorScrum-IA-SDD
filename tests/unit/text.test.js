'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSpaces, graphemeCount, hasControlChars, foldKey } = require('../../lib/text');

test('normalizeSpaces recorta y colapsa espacios (incluidos tabuladores y saltos)', () => {
  assert.equal(normalizeSpaces('  Ana \t  María \n'), 'Ana María');
});

test('graphemeCount cuenta lo que percibe una persona (APR-007)', () => {
  assert.equal(graphemeCount('Ana'), 3);
  assert.equal(graphemeCount('👩\u200D💻'), 1, 'emoji compuesto con ZWJ');
  assert.equal(graphemeCount('Ana 👩\u200D💻'), 5);
  assert.equal(graphemeCount('🇨🇴'), 1, 'bandera (par regional)');
  assert.equal(graphemeCount('e\u0301'), 1, 'acento combinado');
  assert.equal(graphemeCount('👍🏽'), 1, 'modificador de tono');
});

test('foldKey iguala mayúsculas y acentos, pero distingue la ñ', () => {
  assert.equal(foldKey('Ana'), foldKey('ána'));
  assert.equal(foldKey('ANA'), foldKey('Ána'));
  assert.equal(foldKey('José  Luis'), foldKey('jose luis'));
  assert.equal(foldKey('e\u0301'), foldKey('é'));
  assert.notEqual(foldKey('Peña'), foldKey('Pena'));
  assert.equal(foldKey('PEÑA'), foldKey('peña'));
});

test('hasControlChars detecta controles e invisibles y admite emojis con ZWJ', () => {
  assert.equal(hasControlChars('Ana\u0007'), true);
  assert.equal(hasControlChars('Ana\u200E'), true, 'marca de dirección invisible');
  assert.equal(hasControlChars('👩\u200D💻'), false);
  assert.equal(hasControlChars('Ana María'), false);
});
