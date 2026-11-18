'use strict';

/**
 * Servidor local: estáticos de `public/`, API y SSE.
 * - Sin variables UPSTASH_*: memoria + SSE.
 * - Con variables UPSTASH_*: Redis + consultas periódicas.
 * - SYNC_MODE=poll fuerza consultas periódicas (útil para reproducir Vercel).
 * Escucha en 127.0.0.1 por defecto; HOST=0.0.0.0 para probar desde el móvil en la red local.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { createApiHandler } = require('./lib/api');
const { selectStore } = require('./lib/store');
const { SECURITY_HEADERS } = require('./lib/http');

const PUBLIC_DIR = path.join(__dirname, 'public');
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function createLocalServer({ env = process.env, now = Date.now, log } = {}) {
  const selection = selectStore(env, { now });
  const syncMode = env.SYNC_MODE === 'poll' || selection.mode !== 'memory' ? 'poll' : 'sse';
  const notifier = syncMode === 'sse' ? new EventEmitter().setMaxListeners(200) : null;
  const api = createApiHandler({
    store: selection.store,
    syncMode,
    notifier,
    now,
    rateLimitMultiplier: Math.max(1, Number(env.RATE_LIMIT_MULTIPLIER) || 1),
    ...(env.RATE_LIMIT_SALT ? { rateLimitSalt: env.RATE_LIMIT_SALT } : {}),
    ...(log ? { log } : {}),
  });

  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api' || pathname.startsWith('/api/') || pathname === '/health') {
      api(req, res);
      return;
    }
    serveStatic(pathname, req, res);
  });
  return { server, selection, syncMode };
}

function serveStatic(pathname, req, res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end();
    return;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    res.statusCode = 400;
    res.end();
    return;
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/u, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('No encontrado');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const { server, selection, syncMode } = createLocalServer();
  server.listen(port, host, () => {
    process.stdout.write(`Farsante Scrum en http://${host === '0.0.0.0' ? 'localhost' : host}:${port} (almacén: ${selection.mode}, sincronización: ${syncMode})\n`);
    if (selection.mode === 'unavailable') {
      process.stdout.write('Aviso: configuración de Redis incompleta; la API responderá 503.\n');
    }
    if (host === '0.0.0.0') {
      for (const ip of lanAddresses()) process.stdout.write(`  En la red local: http://${ip}:${port}\n`);
    }
  });
}

module.exports = { createLocalServer };
