'use strict';

const crypto = require('node:crypto');
const config = require('./config');

/**
 * Sesión por sala en cookie HttpOnly (ADR-0004, APR-005).
 * Valor: `<playerId>.<token>`. En Redis solo se guarda `sha256(token)`.
 */

function newPlayerCredentials(randomBytes = crypto.randomBytes) {
  const id = `p_${randomBytes(12).toString('base64url')}`;
  const token = randomBytes(32).toString('base64url');
  return { id, token, tokenHash: hashToken(token) };
}

function hashToken(token) {
  return `sha256:${crypto.createHash('sha256').update(token).digest('hex')}`;
}

function cookieName(code) {
  return `fs_${code}`;
}

function buildSessionCookie(code, playerId, token, secure) {
  const parts = [
    `${cookieName(code)}=${playerId}.${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${config.ROOM_TTL_SECONDS}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function buildClearCookie(code, secure) {
  const parts = [`${cookieName(code)}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function parseCookies(header) {
  const result = {};
  if (typeof header !== 'string') return result;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (!(name in result)) result[name] = part.slice(index + 1).trim();
  }
  return result;
}

/** Devuelve `{ playerId, token }` de la cookie de esa sala o `null`. */
function readSessionCookie(cookieHeader, code) {
  const raw = parseCookies(cookieHeader)[cookieName(code)];
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot < 1 || dot === raw.length - 1) return null;
  return { playerId: raw.slice(0, dot), token: raw.slice(dot + 1) };
}

/** Comprueba pertenencia en tiempo constante; devuelve el integrante o `null`. */
function verifySession(doc, session) {
  if (!doc || !session) return null;
  const player = doc.players.find((p) => p.id === session.playerId);
  if (!player) return null;
  const expected = Buffer.from(player.tokenHash);
  const actual = Buffer.from(hashToken(session.token));
  if (expected.length !== actual.length) return null;
  return crypto.timingSafeEqual(expected, actual) ? player : null;
}

module.exports = {
  newPlayerCredentials,
  hashToken,
  cookieName,
  buildSessionCookie,
  buildClearCookie,
  parseCookies,
  readSessionCookie,
  verifySession,
};
