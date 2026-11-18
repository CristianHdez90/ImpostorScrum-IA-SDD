'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('../../lib/session');

const doc = (players) => ({ players });

test('las credenciales tienen identificador y token aleatorios; solo se guarda el hash', () => {
  const a = session.newPlayerCredentials();
  const b = session.newPlayerCredentials();
  assert.match(a.id, /^p_[A-Za-z0-9_-]{16}$/);
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/, '256 bits en base64url');
  assert.notEqual(a.token, b.token);
  assert.equal(a.tokenHash, session.hashToken(a.token));
  assert.ok(!a.tokenHash.includes(a.token));
});

test('la cookie es HttpOnly, SameSite=Strict, por sala y Secure solo en HTTPS', () => {
  const plain = session.buildSessionCookie('BCDFG', 'p_x', 'tok', false);
  assert.match(plain, /^fs_BCDFG=p_x\.tok; /);
  assert.match(plain, /HttpOnly/);
  assert.match(plain, /SameSite=Strict/);
  assert.match(plain, /Max-Age=21600/);
  assert.doesNotMatch(plain, /Secure/);
  assert.match(session.buildSessionCookie('BCDFG', 'p_x', 'tok', true), /; Secure$/);
  assert.match(session.buildClearCookie('BCDFG', false), /^fs_BCDFG=; .*Max-Age=0/);
});

test('readSessionCookie solo lee la cookie de la sala pedida', () => {
  const header = 'otra=1; fs_BCDFG=p_a.tokA; fs_HJKLM=p_b.tokB';
  assert.deepEqual(session.readSessionCookie(header, 'BCDFG'), { playerId: 'p_a', token: 'tokA' });
  assert.deepEqual(session.readSessionCookie(header, 'HJKLM'), { playerId: 'p_b', token: 'tokB' });
  assert.equal(session.readSessionCookie(header, 'NPQRS'), null);
  assert.equal(session.readSessionCookie('fs_BCDFG=sinpunto', 'BCDFG'), null);
  assert.equal(session.readSessionCookie(undefined, 'BCDFG'), null);
});

test('verifySession acepta el token correcto y rechaza manipulaciones', () => {
  const ana = session.newPlayerCredentials();
  const luis = session.newPlayerCredentials();
  const room = doc([
    { id: ana.id, tokenHash: ana.tokenHash },
    { id: luis.id, tokenHash: luis.tokenHash },
  ]);
  assert.equal(session.verifySession(room, { playerId: ana.id, token: ana.token }).id, ana.id);
  assert.equal(session.verifySession(room, { playerId: ana.id, token: luis.token }), null, 'token de otro');
  assert.equal(session.verifySession(room, { playerId: 'p_inexistente', token: ana.token }), null);
  assert.equal(session.verifySession(room, null), null);
});
