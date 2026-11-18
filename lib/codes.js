'use strict';

const crypto = require('node:crypto');
const { CODE_ALPHABET, CODE_LENGTH } = require('./config');

const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** Genera un código de sala con aleatoriedad criptográfica (inyectable en pruebas). */
function generateCode(randomInt = crypto.randomInt) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Convierte la entrada del usuario: mayúsculas y sin espacios. */
function normalizeCodeInput(value) {
  return String(value ?? '').toUpperCase().replace(/\s+/gu, '');
}

function isValidCode(code) {
  return typeof code === 'string' && CODE_PATTERN.test(code);
}

module.exports = { generateCode, normalizeCodeInput, isValidCode, CODE_PATTERN };
