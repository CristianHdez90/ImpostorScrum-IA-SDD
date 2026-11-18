'use strict';

/**
 * Normalización de texto compartida por las reglas del servidor.
 * - Longitud en grafemas: lo que una persona percibe como un carácter (APR-007).
 * - Clave de comparación: sin distinguir mayúsculas ni acentos (APR-007).
 *   La «ñ» se conserva distinta de «n»: es una letra, no un acento.
 */

const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });

const CONTROL_CHARS = /[\p{Cc}\p{Cf}\u2028\u2029]/u;
const ENYE_MARK = '\uE000';

/** Recorta y colapsa cualquier secuencia de espacios en uno solo. */
function normalizeSpaces(value) {
  return String(value).normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Cantidad de grafemas: un emoji compuesto cuenta 1. */
function graphemeCount(value) {
  let count = 0;
  for (const _ of segmenter.segment(String(value))) count += 1;
  return count;
}

/** Indica si el texto contiene caracteres de control o de formato invisibles. */
function hasControlChars(value) {
  return CONTROL_CHARS.test(String(value).replace(/\u200D/gu, ''));
}

/** Clave para comparar: espacios colapsados, sin acentos, en minúsculas. */
function foldKey(value) {
  return normalizeSpaces(value)
    .normalize('NFD')
    .replace(/([nN])\u0303/gu, `$1${ENYE_MARK}`)
    .replace(/\p{M}/gu, '')
    .replaceAll(ENYE_MARK, '\u0303')
    .normalize('NFC')
    .toLocaleLowerCase('es');
}

/**
 * Palabras normalizadas para comparar pistas y adivinanzas (D-12): sin acentos,
 * en minúsculas y con la puntuación como separador. «Q.A.» da ["q", "a"].
 */
function tokens(value) {
  return foldKey(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
}

/** ¿`haystack` contiene la secuencia completa `needle` de palabras contiguas? */
function containsSequence(haystack, needle) {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    if (needle.every((token, j) => haystack[i + j] === token)) return true;
  }
  return false;
}

module.exports = { normalizeSpaces, graphemeCount, hasControlChars, foldKey, tokens, containsSequence };
