'use strict';

const config = require('./config');

/** Estado HTTP por código de negocio (api-contracts.md §1). */
const ERROR_STATUS = Object.freeze({
  INVALID_JSON: 400,
  UNKNOWN_FIELD: 400,
  INVALID_NAME: 400,
  INVALID_CODE: 400,
  INVALID_ACTION: 400,
  INVALID_WORDS: 400,
  INVALID_CLUE: 400,
  INVALID_VOTE: 400,
  INVALID_GUESS: 400,
  INVALID_SETTINGS: 400,
  SESSION_INVALID: 401,
  FORBIDDEN_ORIGIN: 403,
  NOT_HOST: 403,
  NOT_YOUR_TURN: 403,
  NOT_IMPOSTOR: 403,
  ROOM_NOT_FOUND: 404,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  ROOM_FULL: 409,
  ROOM_STARTED: 409,
  NAME_TAKEN: 409,
  WRONG_PHASE: 409,
  STALE_GAME: 409,
  ALREADY_VOTED: 409,
  CONFLICT_RETRY_EXHAUSTED: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  STORE_UNAVAILABLE: 503,
});

const RETRYABLE = new Set(['CONFLICT_RETRY_EXHAUSTED', 'STORE_UNAVAILABLE', 'INTERNAL', 'RATE_LIMITED']);

class HttpError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
  }
}

/** Cabeceras comunes (threat-model.md §3). Se aplican también a los estáticos locales. */
const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
});

function statusFor(code) {
  return ERROR_STATUS[code] ?? 500;
}

function errorBody(code, message) {
  return { error: { code, message, retryable: RETRYABLE.has(code) } };
}

function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, ...headers })) {
    res.setHeader(name, value);
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

/** Protocolo efectivo: Vercel informa `x-forwarded-proto`; local, el socket. */
function requestProtocol(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  if (forwarded === 'https' || forwarded === 'http') return forwarded;
  return req.socket && req.socket.encrypted ? 'https' : 'http';
}

function isSecureRequest(req) {
  return requestProtocol(req) === 'https';
}

/** CSRF: `POST` solo con JSON y desde el mismo origen (ADR-0004). */
function assertJsonPost(req) {
  const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw new HttpError('UNSUPPORTED_MEDIA_TYPE', 'La solicitud debe enviarse como JSON.');
  }
  const origin = req.headers.origin;
  const expected = `${requestProtocol(req)}://${req.headers.host}`;
  if (!origin || origin !== expected) {
    throw new HttpError('FORBIDDEN_ORIGIN', 'Origen no permitido.');
  }
}

function parseJsonText(text) {
  if (Buffer.byteLength(text) > config.MAX_BODY_BYTES) {
    throw new HttpError('PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError('INVALID_JSON', 'El cuerpo de la solicitud no es JSON válido.');
  }
}

/**
 * Lee un objeto JSON con límite de tamaño. Admite el cuerpo ya procesado por
 * Vercel (`req.body`) o el flujo sin procesar del servidor local.
 */
async function readJsonObject(req) {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > config.MAX_BODY_BYTES) {
    throw new HttpError('PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.');
  }
  let value;
  let preParsed;
  try {
    preParsed = req.body;
  } catch {
    throw new HttpError('INVALID_JSON', 'El cuerpo de la solicitud no es JSON válido.');
  }
  if (preParsed !== undefined) {
    if (typeof preParsed === 'string') value = parseJsonText(preParsed);
    else if (Buffer.isBuffer(preParsed)) value = parseJsonText(preParsed.toString('utf8'));
    else {
      value = preParsed;
      if (Buffer.byteLength(JSON.stringify(value ?? null)) > config.MAX_BODY_BYTES) {
        throw new HttpError('PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.');
      }
    }
  } else {
    value = parseJsonText(await readStream(req));
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError('INVALID_JSON', 'El cuerpo debe ser un objeto JSON.');
  }
  return value;
}

function readStream(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > config.MAX_BODY_BYTES) {
        failed = true;
        reject(new HttpError('PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!failed) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      if (!failed) reject(err);
    });
  });
}

function assertAllowedFields(body, allowed) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      throw new HttpError('UNKNOWN_FIELD', `Campo no permitido: ${key.slice(0, 40)}`);
    }
  }
}

module.exports = {
  ERROR_STATUS,
  SECURITY_HEADERS,
  HttpError,
  statusFor,
  errorBody,
  sendJson,
  requestProtocol,
  isSecureRequest,
  assertJsonPost,
  readJsonObject,
  assertAllowedFields,
};
