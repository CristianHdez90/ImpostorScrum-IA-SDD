'use strict';

/**
 * Compilación:
 *   node scripts/build.js                → copia qrcode-generator a public/vendor/qrcode.js
 *   node scripts/build.js --check-syntax → `node --check` sobre el código propio
 * `public/vendor/` es un artefacto generado: no se edita a mano ni se versiona.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function copyQrLibrary() {
  const source = require.resolve('qrcode-generator'); // dist/qrcode.js (conserva su cabecera MIT)
  const targetDir = path.join(ROOT, 'public', 'vendor');
  fs.mkdirSync(targetDir, { recursive: true });
  const target = path.join(targetDir, 'qrcode.js');
  fs.copyFileSync(source, target);
  const pkgPath = path.join(path.dirname(source), '..', 'package.json');
  const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  process.stdout.write(`QR: qrcode-generator ${version} → ${path.relative(ROOT, target)}\n`);
}

function listJs(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'vendor' ? [] : listJs(rel);
    return entry.name.endsWith('.js') ? [rel] : [];
  });
}

function checkSyntax() {
  const files = ['server.js', ...listJs('lib'), ...listJs('api'), ...listJs('scripts'), ...listJs('public')];
  let failed = 0;
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
    if (result.status !== 0) {
      failed += 1;
      process.stderr.write(`${file}\n${result.stderr}\n`);
    }
  }
  process.stdout.write(`Sintaxis: ${files.length - failed}/${files.length} archivos correctos\n`);
  if (failed) process.exitCode = 1;
}

if (process.argv.includes('--check-syntax')) checkSyntax();
else copyQrLibrary();
