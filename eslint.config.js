'use strict';

const js = require('@eslint/js');

// Globales declarados a mano para no añadir el paquete `globals` (dependencia no aprobada).
const nodeGlobals = {
  require: 'readonly', module: 'writable', exports: 'writable', __dirname: 'readonly', process: 'readonly',
  Buffer: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  AbortController: 'readonly', AbortSignal: 'readonly', fetch: 'readonly', Intl: 'readonly',
  TextEncoder: 'readonly', globalThis: 'readonly', Response: 'readonly', setImmediate: 'readonly',
};
const browserGlobals = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', fetch: 'readonly', EventSource: 'readonly',
  AbortController: 'readonly', URLSearchParams: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  Intl: 'readonly', self: 'readonly', module: 'writable', Symbol: 'readonly',
};

module.exports = [
  { ignores: ['node_modules/', 'public/vendor/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: nodeGlobals },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: browserGlobals },
  },
  {
    // Las pruebas E2E ejecutan callbacks dentro del navegador (page.evaluate, addInitScript).
    files: ['tests/e2e/**/*.js'],
    languageOptions: { globals: { ...nodeGlobals, ...browserGlobals } },
  },
];
