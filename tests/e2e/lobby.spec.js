'use strict';

/**
 * Recorridos de navegador de SPEC-FEAT-001 con sesiones independientes
 * (contextos aislados = navegadores distintos). Servidor local en memoria.
 */
const { test, expect } = require('@playwright/test');
const jsQR = require('jsqr');

const SSE_URL = 'http://127.0.0.1:4173';
const POLL_URL = 'http://127.0.0.1:4174';

const lobbyHeading = (page) => page.getByRole('heading', { level: 1, name: 'Sala de espera' });

async function createRoom(page, name = 'Ana', base = SSE_URL) {
  await page.goto(`${base}/`);
  await page.locator('#create-name').fill(name);
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(lobbyHeading(page)).toBeVisible();
  const code = await page.locator('#room-code').getAttribute('data-code');
  expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
  return code;
}

async function joinByInvite(browser, code, name, base = SSE_URL) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/?sala=${code}`);
  await page.locator('#invite-name').fill(name);
  await page.getByRole('button', { name: 'Unirme al juego' }).click();
  await expect(lobbyHeading(page)).toBeVisible();
  return { context, page };
}

test('CA-01/CA-03/RF-001.17 crear, unirse por código e invitación; lista en vivo por SSE', async ({ page, browser }) => {
  const code = await createRoom(page, 'Ana');
  await expect(page.locator('#lobby-requirement')).toHaveText('Faltan 2 participantes para iniciar (mínimo 3).');

  const luisContext = await browser.newContext();
  const luis = await luisContext.newPage();
  await luis.goto(`${SSE_URL}/`);
  await luis.locator('#join-code').fill(code.toLowerCase());
  await luis.locator('#join-name').fill('Luis');
  await luis.getByRole('button', { name: 'Unirme', exact: true }).click();
  await expect(lobbyHeading(luis)).toBeVisible();

  const eva = await joinByInvite(browser, code, 'Eva');

  const players = page.getByTestId('player');
  await expect(players).toHaveCount(3, { timeout: 3_000 });
  await expect(page.locator('#player-count')).toHaveText('(3 de 12)');
  await expect(page.locator('#lobby-requirement')).toHaveText('Todo listo: ya puedes iniciar la partida.');
  await expect(eva.page.locator('#lobby-requirement')).toHaveText('Hay suficientes participantes conectados para jugar.');
  await expect(players.filter({ hasText: 'Ana' })).toContainText('Anfitrión');
  await expect(players.filter({ hasText: 'Ana' })).toContainText('Tú');
  await expect(players.filter({ hasText: 'Luis' })).toContainText('Conectado');
  await expect(page.locator('#words-label')).toHaveText('Scrum y equipo');
  await expect(eva.page.getByTestId('player')).toHaveCount(3);

  await luisContext.close();
  await eva.context.close();
});

test('RF-001.17 consultas periódicas (modo Vercel): la entrada se ve en ≤ 3 s', async ({ page, browser }) => {
  const code = await createRoom(page, 'Ana', POLL_URL);
  const luis = await joinByInvite(browser, code, 'Luis', POLL_URL);
  await expect(page.getByTestId('player')).toHaveCount(2, { timeout: 3_000 });
  await luis.context.close();
});

test('CA-04 la invitación precarga el código y enfoca el nombre', async ({ page, browser }) => {
  const code = await createRoom(page);
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto(`${SSE_URL}/?sala=${code}`);
  await expect(guest.getByRole('heading', { level: 1 })).toHaveText(`Te invitaron a la sala ${code}`);
  await expect(guest.locator('#invite-code')).toHaveValue(code);
  await expect(guest.locator('#invite-name')).toBeFocused();
  await context.close();
});

test('CA-05 el QR decodificado contiene solo la URL de invitación', async ({ page }) => {
  const code = await createRoom(page);
  const image = await page.locator('#qr-canvas').evaluate((canvas) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    return { width: data.width, height: data.height, pixels: Array.from(data.data) };
  });
  const decoded = jsQR(Uint8ClampedArray.from(image.pixels), image.width, image.height);
  expect(decoded, 'jsQR decodifica el QR renderizado').not.toBeNull();
  expect(decoded.data).toBe(`${SSE_URL}/?sala=${code}`);
  expect(decoded.data).not.toMatch(/fs_|token|p_/);
  await expect(page.locator('#invite-link')).toHaveValue(`${SSE_URL}/?sala=${code}`);
});

test('CA-08 recargar no duplica al integrante', async ({ page, browser }) => {
  const code = await createRoom(page);
  const luis = await joinByInvite(browser, code, 'Luis');
  await luis.page.reload();
  await expect(lobbyHeading(luis.page)).toBeVisible();
  await expect(luis.page.getByTestId('player')).toHaveCount(2);
  await expect(page.getByTestId('player')).toHaveCount(2);
  await expect(luis.page.getByTestId('player').filter({ hasText: 'Tú' })).toContainText('Luis');
  await luis.context.close();
});

test('CA-14 portapapeles bloqueado: aviso y enlace seleccionable', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('bloqueado')) } });
  });
  const page = await context.newPage();
  const code = await createRoom(page);
  await page.getByRole('button', { name: 'Copiar enlace' }).click();
  await expect(page.locator('#copy-feedback')).toHaveText('No se pudo copiar. Selecciona el enlace y cópialo manualmente.');
  await expect(page.locator('#invite-link')).toBeFocused();
  await expect(page.locator('#invite-link')).toHaveValue(`${SSE_URL}/?sala=${code}`);
  await context.close();
});

test('CA-15 aviso de localhost junto al QR', async ({ page }) => {
  await createRoom(page);
  await expect(page.locator('#localhost-warning')).toBeVisible();
  await expect(page.locator('#localhost-warning')).toContainText('otros dispositivos no podrán abrir');
});

test('CA-16 un nombre con marcado se muestra como texto y no ejecuta código', async ({ page, browser }) => {
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  const code = await createRoom(page);
  const name = '<script>alert(1)</script>';
  const intruder = await joinByInvite(browser, code, name);
  await expect(page.getByTestId('player').filter({ hasText: name })).toHaveCount(1, { timeout: 3_000 });
  expect(await page.locator('#player-list script, #player-list img').count()).toBe(0);
  expect(dialogs).toEqual([]);
  await intruder.context.close();
});

test('CA-10 fallo temporal: «Reconectando…», se conserva la lista y se recupera', async ({ page }) => {
  await createRoom(page, 'Ana', POLL_URL);
  await page.route('**/api/state**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":"STORE_UNAVAILABLE","message":"x","retryable":true}}' }));
  await expect(page.locator('#connection-text')).toHaveText('Reconectando…', { timeout: 5_000 });
  await expect(page.getByTestId('player')).toHaveCount(1);
  await page.unroute('**/api/state**');
  await expect(page.locator('#connection-text')).toHaveText('Conectado', { timeout: 12_000 });
  await expect(lobbyHeading(page)).toBeVisible();
});

test('RF-001.16 sesión inválida: se explica y se ofrece volver al inicio', async ({ page, context }) => {
  await createRoom(page);
  await context.clearCookies();
  await page.goto(`${SSE_URL}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No pudimos abrir la sala');
  await expect(page.locator('#fatal-message')).toContainText('sesión');
  await page.getByRole('button', { name: 'Volver al inicio' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Farsante Scrum' })).toBeVisible();
});

test('RF-001.21 invitación de otra sala: aviso sin mezclar identidades y vuelta a la sala propia', async ({ page, browser }) => {
  const mine = await createRoom(page, 'Ana');
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  const other = await createRoom(otherPage, 'Luis');
  await page.goto(`${SSE_URL}/?sala=${other}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Te invitaron a la sala ${other}`);
  await expect(page.locator('#invite-other-room')).toContainText(`Ya estás en la sala ${mine}`);
  await page.getByRole('button', { name: `Volver a la sala ${mine}` }).click();
  await expect(lobbyHeading(page)).toBeVisible();
  await expect(page.locator('#room-code')).toHaveAttribute('data-code', mine);
  await expect(otherPage.getByTestId('player')).toHaveCount(1);
  await otherContext.close();
});

test('CA-17 (parcial) crear sala solo con teclado; el foco llega al encabezado del lobby', async ({ page }) => {
  await page.goto(`${SSE_URL}/`);
  await page.keyboard.press('Tab');
  await expect(page.locator('#create-name')).toBeFocused();
  await page.keyboard.type('Teclado');
  await page.keyboard.press('Enter');
  await expect(lobbyHeading(page)).toBeFocused();
  await expect(page.locator('#status')).toContainText('creada');
});

test('320 CSS px con 12 nombres de 26 caracteres: sin desplazamiento horizontal', async ({ page, playwright }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const code = await createRoom(page, 'Anfitriona con nombre 26c');
  for (let i = 2; i <= 12; i += 1) {
    const api = await playwright.request.newContext({ baseURL: SSE_URL, extraHTTPHeaders: { origin: SSE_URL } });
    const name = `N${String(i).padStart(2, '0')}abcdefghijklmnopqrstuvw`;
    const res = await api.post('/api/join', { data: { code, name } });
    expect(res.status(), name).toBe(201);
    await api.dispose();
  }
  await expect(page.getByTestId('player')).toHaveCount(12, { timeout: 7_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
