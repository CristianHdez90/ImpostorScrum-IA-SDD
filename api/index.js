'use strict';

/**
 * Entrada de Vercel Functions. `vercel.json` reescribe `/api/*` hacia aquí
 * añadiendo `?route=`. En Vercel la sincronización es por consultas periódicas
 * y el almacén debe ser Redis: sin variables, responde 503 (nunca memoria).
 */
const { createApiHandler } = require('../lib/api');
const { selectStore } = require('../lib/store');

const selection = selectStore(process.env);
if (selection.mode !== 'redis') {
  process.stdout.write(`${JSON.stringify({ event: 'store_unavailable_at_boot', reason: selection.reason ?? selection.mode })}\n`);
}

module.exports = createApiHandler({
  store: selection.store,
  syncMode: 'poll',
  ...(process.env.RATE_LIMIT_SALT ? { rateLimitSalt: process.env.RATE_LIMIT_SALT } : {}),
});
