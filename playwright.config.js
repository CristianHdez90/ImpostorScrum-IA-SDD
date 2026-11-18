'use strict';

/**
 * E2E de SPEC-FEAT-001 contra el servidor local en memoria:
 *  - 4173: SSE (modo local por defecto)
 *  - 4174: consultas periódicas (SYNC_MODE=poll, como en Vercel)
 * CHROME_PATH permite usar un Chrome ya instalado cuando no se puede
 * descargar el navegador de Playwright.
 */
const { defineConfig, devices } = require('@playwright/test');

const executablePath = process.env.CHROME_PATH || undefined;
const serverEnv = (extra) => ({
  ...process.env,
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
  HOST: '127.0.0.1',
  RATE_LIMIT_MULTIPLIER: '100', // muchas salas desde la misma IP durante la suite
  ...extra,
});

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    screenshot: 'off',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'node server.js', env: serverEnv({ PORT: '4173' }), url: 'http://127.0.0.1:4173', reuseExistingServer: false },
    { command: 'node server.js', env: serverEnv({ PORT: '4174', SYNC_MODE: 'poll' }), url: 'http://127.0.0.1:4174', reuseExistingServer: false },
  ],
});
