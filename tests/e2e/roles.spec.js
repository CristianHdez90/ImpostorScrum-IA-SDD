'use strict';

/** Recorridos de SPEC-FEAT-003: iniciar, carta privada, preparación y reinicio. */
const { test, expect } = require('@playwright/test');

const SSE_URL = 'http://127.0.0.1:4173';
const POLL_URL = 'http://127.0.0.1:4174';
const lobbyHeading = (page) => page.getByRole('heading', { level: 1, name: 'Sala de espera' });
const rolesHeading = (page) => page.getByRole('heading', { level: 1, name: 'Tu carta' });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function createRoom(page, base) {
  await page.goto(`${base}/`);
  await page.locator('#create-name').fill('Ana');
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(lobbyHeading(page)).toBeVisible();
  return page.locator('#room-code').getAttribute('data-code');
}

async function join(browser, base, code, name) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/?sala=${code}`);
  await page.locator('#invite-name').fill(name);
  await page.getByRole('button', { name: 'Unirme al juego' }).click();
  await expect(lobbyHeading(page)).toBeVisible();
  return { context, page };
}

async function roomOfThree(page, browser, base = SSE_URL) {
  const code = await createRoom(page, base);
  const luis = await join(browser, base, code, 'Luis');
  const eva = await join(browser, base, code, 'Eva');
  await expect(page.getByTestId('player')).toHaveCount(3, { timeout: 3_000 });
  return { code, guests: [luis, eva], all: [page, luis.page, eva.page] };
}

test('CA-02 con 2 el botón está deshabilitado y explica el motivo; con 3 se habilita', async ({ page, browser }) => {
  const code = await createRoom(page, SSE_URL);
  const luis = await join(browser, SSE_URL, code, 'Luis');
  const start = page.getByRole('button', { name: 'Iniciar partida' });
  await expect(start).toBeVisible();
  await expect(start).toBeDisabled({ timeout: 3_000 });
  await expect(page.locator('#lobby-requirement')).toHaveText('Falta 1 participante para iniciar (mínimo 3).');
  await expect(luis.page.getByRole('button', { name: 'Iniciar partida' })).toBeHidden();
  await expect(luis.page.locator('#waiting-host')).toBeVisible();
  const eva = await join(browser, SSE_URL, code, 'Eva');
  await expect(start).toBeEnabled({ timeout: 3_000 });
  await expect(page.locator('#lobby-requirement')).toHaveText('Todo listo: ya puedes iniciar la partida.');
  await luis.context.close();
  await eva.context.close();
});

test('CA-01/06/07/09 iniciar, cartas privadas, un solo impostor y paso a pistas', async ({ page, browser }) => {
  const room = await roomOfThree(page, browser);
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  for (const p of room.all) {
    await expect(rolesHeading(p)).toBeVisible({ timeout: 3_000 });
    await expect(p.locator('#card-content')).toBeEmpty();
    await expect(p.locator('#ready-count')).toHaveText('Preparados: 0 de 3.');
  }

  const cards = [];
  for (const p of room.all) {
    await p.getByRole('button', { name: 'Ver mi carta' }).click();
    cards.push((await p.locator('#card-content').innerText()).trim());
  }
  const impostorIndex = cards.findIndex((c) => c.includes('Eres el impostor'));
  expect(cards.filter((c) => c.includes('Eres el impostor'))).toHaveLength(1);
  const words = cards.filter((_, i) => i !== impostorIndex).map((c) => c.replace('La palabra secreta es', '').trim());
  expect(words[0]).toBe(words[1]);
  const impostorHtml = await room.all[impostorIndex].content();
  expect(impostorHtml).not.toMatch(new RegExp(`\\b${escapeRe(words[0])}\\b`), 'el impostor no tiene la palabra en su página');

  await room.all[0].getByRole('button', { name: 'Ocultar mi carta' }).click();
  await expect(room.all[0].locator('#card-content')).toBeEmpty();

  for (const p of room.all) await p.getByRole('button', { name: 'Ya vi mi rol, estoy listo' }).click();
  for (const p of room.all) {
    await expect(p.getByRole('heading', { level: 1, name: 'Ronda de pistas' })).toBeVisible({ timeout: 3_000 });
  }
  for (const g of room.guests) await g.context.close();
});

test('CA-12 reinicio con confirmación: solo el anfitrión, todos vuelven a la sala de espera', async ({ page, browser }) => {
  const room = await roomOfThree(page, browser);
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(rolesHeading(room.guests[0].page)).toBeVisible({ timeout: 3_000 });
  await expect(room.guests[0].page.getByRole('button', { name: 'Reiniciar partida' })).toBeHidden();

  await page.getByRole('button', { name: 'Reiniciar partida' }).click();
  await expect(page.getByText('¿Reiniciar para todos?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('¿Reiniciar para todos?')).toBeHidden();
  await expect(rolesHeading(page)).toBeVisible();

  await page.getByRole('button', { name: 'Reiniciar partida' }).click();
  await page.getByRole('button', { name: 'Confirmar reinicio' }).click();
  for (const p of room.all) {
    await expect(lobbyHeading(p)).toBeVisible({ timeout: 3_000 });
    await expect(p.getByTestId('player')).toHaveCount(3);
  }
  await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled();
  for (const g of room.guests) await g.context.close();
});

test('modo consultas periódicas (como en Vercel): los invitados pasan a roles en ≤ 3 s', async ({ page, browser }) => {
  const room = await roomOfThree(page, browser, POLL_URL);
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  for (const g of room.guests) await expect(rolesHeading(g.page)).toBeVisible({ timeout: 3_000 });
  for (const g of room.guests) await g.context.close();
});
