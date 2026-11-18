'use strict';

/** RF-001.19: en Vercel nunca se usa memoria como respaldo. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { selectStore } = require('../../lib/store');
const { createApiHandler } = require('../../lib/api');

test('selección de almacén según variables de entorno', () => {
  assert.equal(selectStore({}).mode, 'memory');
  assert.equal(selectStore({ VERCEL: '1' }).mode, 'unavailable');
  assert.equal(selectStore({ VERCEL: '1', UPSTASH_REDIS_REST_URL: 'https://x' }).mode, 'unavailable');
  assert.equal(selectStore({ UPSTASH_REDIS_REST_TOKEN: 't' }).mode, 'unavailable', 'configuración incompleta en local');
  assert.equal(selectStore({ VERCEL: '1', UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' }).mode, 'redis');
  assert.equal(selectStore({ UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' }).mode, 'redis');
});

test('CA-11 Vercel sin variables UPSTASH_*: crear sala responde 503 y no crea nada', async (t) => {
  const selection = selectStore({ VERCEL: '1' });
  const server = http.createServer(createApiHandler({ store: selection.store, syncMode: 'poll', log: () => {} }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = () => fetch(`${origin}/api/create`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: '{"name":"Ana"}' });
  const first = await post();
  const body = await first.json();
  assert.equal(first.status, 503);
  assert.equal(body.error.code, 'STORE_UNAVAILABLE');
  assert.equal(first.headers.get('set-cookie'), null);
  assert.equal((await post()).status, 503, 'sigue sin sala en memoria');
});

test('la ruta reescrita por Vercel (?route=) se atiende igual que la ruta local', async (t) => {
  const selection = selectStore({});
  const server = http.createServer(createApiHandler({ store: selection.store, syncMode: 'poll', log: () => {} }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const res = await fetch(`${origin}/api/index?route=create`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: '{"name":"Ana"}' });
  assert.equal(res.status, 201);
});
