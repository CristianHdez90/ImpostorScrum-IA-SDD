'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCode, normalizeCodeInput, isValidCode } = require('../../lib/codes');
const config = require('../../lib/config');

test('el alfabeto excluye I y O (APR-006) y tiene 24 letras', () => {
  assert.equal(config.CODE_ALPHABET.length, 24);
  assert.ok(!config.CODE_ALPHABET.includes('I'));
  assert.ok(!config.CODE_ALPHABET.includes('O'));
});

test('generateCode produce 5 letras del alfabeto (10 000 muestras criptográficas)', () => {
  const seen = new Set();
  for (let i = 0; i < 10_000; i += 1) {
    const code = generateCode();
    assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
    seen.add(code);
  }
  assert.ok(seen.size > 9_900, 'prácticamente sin repeticiones en 10 000 muestras');
});

test('generateCode usa el generador inyectado', () => {
  let i = 0;
  const sequence = [0, 1, 2, 3, 23];
  assert.equal(generateCode(() => sequence[i++]), 'ABCDZ');
});

test('normalizeCodeInput convierte a mayúsculas y elimina espacios', () => {
  assert.equal(normalizeCodeInput(' bc df g '), 'BCDFG');
  assert.equal(normalizeCodeInput(undefined), '');
});

test('isValidCode rechaza formatos inválidos', () => {
  assert.equal(isValidCode('BCDFG'), true);
  for (const bad of ['BCDFI', 'BCDFO', 'BCDF0', 'bcdfg', 'BCDF', 'BCDFGH', '', null, 12345]) {
    assert.equal(isValidCode(bad), false, String(bad));
  }
});
