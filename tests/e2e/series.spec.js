'use strict';

/** Serie de rondas, configuración y mesa (SPEC-FEAT-009 y SPEC-FEAT-010). */
const { test, expect } = require('@playwright/test');

const BASE = 'http://127.0.0.1:4173';
const heading = (page, name) => page.getByRole('heading', { level: 1, name });

async function join(browser, code, name) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/?sala=${code}`);
  await page.locator('#invite-name').fill(name);
  await page.getByRole('button', { name: 'Unirme al juego' }).click();
  await expect(heading(page, 'Sala de espera')).toBeVisible();
  return { context, page };
}

/** Juega una ronda: pistas y un voto contra un inocente, que hace ganar al impostor. */
async function playRound(players, host) {
  const pages = Object.values(players);
  let impostor = null;
  for (const [name, p] of Object.entries(players)) {
    await expect(heading(p, 'Tu carta')).toBeVisible({ timeout: 4_000 });
    await p.getByRole('button', { name: 'Ver mi carta' }).click();
    await expect(p.locator('#playing-card')).toHaveAttribute('data-flipped', 'true');
    if ((await p.locator('#card-content').innerText()).includes('Eres el impostor')) impostor = name;
    await p.getByRole('button', { name: 'Ocultar mi carta' }).click();
    await expect(p.locator('#card-content')).toBeEmpty();
    await p.getByRole('button', { name: 'Ya vi mi rol, estoy listo' }).click();
  }
  for (let turn = 1; turn <= 3; turn += 1) {
    const findCurrent = async () => {
      // Solo cuenta quien ya recibió ESTE turno: evita elegir a quien acaba de enviar y aún no se actualizó.
      for (let i = 0; i < pages.length; i += 1) {
        if ((await pages[i].locator('#turn-info').textContent()) === `Es tu turno (${turn} de 3).` && await pages[i].locator('#clue-form').isVisible()) return i;
      }
      return -1;
    };
    await expect.poll(findCurrent, { timeout: 4_000 }).toBeGreaterThan(-1);
    const current = pages[await findCurrent()];
    // La mesa marca a quien tiene el turno (RF-010.04).
    await expect(host.locator('[data-testid="seat"][aria-current="step"]')).toHaveCount(1);
    await expect(host.locator('[data-testid="seat"][aria-current="step"] .seat-status')).toHaveText('En turno');
    await current.getByLabel('Tu pista').fill(`pista de prueba ${turn}`);
    await current.getByRole('button', { name: 'Enviar pista' }).click();
    await expect(current.locator('#clue-form')).toBeHidden({ timeout: 4_000 }); // la respuesta ya se aplicó
  }
  await expect(heading(host, 'Debate')).toBeVisible({ timeout: 4_000 });
  await host.getByRole('button', { name: 'Abrir votación' }).click();
  const innocents = Object.keys(players).filter((n) => n !== impostor);
  const target = innocents[0];
  const voters = Object.entries(players);
  for (let i = 0; i < voters.length; i += 1) {
    const [name, p] = voters[i];
    await expect(heading(p, 'Votación secreta')).toBeVisible({ timeout: 4_000 });
    const choice = name === target ? innocents[1] : target;
    await p.getByRole('radio', { name: choice }).check();
    await p.getByRole('button', { name: 'Confirmar voto' }).click();
    if (i < voters.length - 1) await expect(p.locator('#vote-done')).toBeVisible({ timeout: 4_000 });
  }
  for (const p of pages) await expect(heading(p, 'Ganó el impostor')).toBeVisible({ timeout: 4_000 });
  return impostor;
}

test('configuración al crear y en la sala de espera; serie de 2 rondas con «Continuar» y podio', async ({ page, browser }) => {
  await page.goto(`${BASE}/`);
  await page.locator('#create-name').fill('Ana');
  await page.locator('#create-rounds').selectOption('2');
  await page.locator('#create-turn').selectOption('90');
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(heading(page, 'Sala de espera')).toBeVisible();
  await expect(page.locator('#settings-summary')).toHaveText('2 rondas, 1 minuto 30 s por turno y 1 minuto 15 s para votar.');

  const code = await page.locator('#room-code').getAttribute('data-code');
  const luis = await join(browser, code, 'Luis');
  const eva = await join(browser, code, 'Eva');
  // Los invitados ven el resumen pero no pueden editar.
  await expect(luis.page.locator('#settings-summary')).toContainText('2 rondas');
  await expect(luis.page.locator('#settings-form')).toBeHidden();

  // El anfitrión cambia el tiempo de votación y todos lo ven.
  await page.locator('#settings-vote').selectOption('45');
  await expect(page.locator('#settings-draft')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar configuración' }).click();
  await expect(page.locator('#settings-draft')).toBeHidden();
  await expect(eva.page.locator('#settings-summary')).toHaveText('2 rondas, 1 minuto 30 s por turno y 45 segundos para votar.', { timeout: 4_000 });

  const players = { Ana: page, Luis: luis.page, Eva: eva.page };
  await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled({ timeout: 4_000 });
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  for (const p of Object.values(players)) await expect(p.locator('#round-label')).toHaveText('Ronda 1 de 2', { timeout: 4_000 });

  const firstImpostor = await playRound(players, page);
  // Fin de la ronda 1: pausa con cuenta atrás; solo el anfitrión ve «Continuar».
  await expect(page.locator('#finished-round')).toHaveText('Ronda 1 de 2');
  await expect(page.locator('#next-round-area')).toBeVisible();
  await expect(luis.page.locator('#next-game')).toBeHidden();
  await expect(page.locator('#podium-area')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Jugar otra partida' })).toBeHidden();
  const seat = page.locator('[data-testid="seat"]', { hasText: firstImpostor });
  await expect(seat.locator('.seat-points')).toHaveText('1 punto');

  await page.getByRole('button', { name: 'Continuar' }).click();
  for (const p of Object.values(players)) await expect(p.locator('#round-label')).toHaveText('Ronda 2 de 2', { timeout: 4_000 });
  await playRound(players, page);

  // Fin de la serie: podio y clasificación para todos.
  for (const p of Object.values(players)) {
    await expect(p.getByRole('heading', { name: 'Podio' })).toBeVisible({ timeout: 4_000 });
    await expect(p.locator('#ranking li')).toHaveCount(3);
    await expect(p.locator('#next-round-area')).toBeHidden();
  }
  await expect(page.locator('#podium [data-rank="1"]')).toBeVisible();
  await page.getByRole('button', { name: 'Jugar otra partida' }).click();
  for (const p of Object.values(players)) await expect(heading(p, 'Sala de espera')).toBeVisible({ timeout: 4_000 });
  // Se conserva la configuración (RF-009.08).
  await expect(page.locator('#settings-summary')).toContainText('2 rondas');
  await luis.context.close();
  await eva.context.close();
});

test('cada participante ve su propio nombre en la sala y en la partida', async ({ page, browser }) => {
  await page.goto(`${BASE}/`);
  await page.locator('#create-name').fill('Ana');
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(heading(page, 'Sala de espera')).toBeVisible();
  await expect(page.locator('#identity')).toHaveText(/Juegas como Ana/);
  const code = await page.locator('#room-code').getAttribute('data-code');
  const luis = await join(browser, code, 'Luis');
  const eva = await join(browser, code, 'Eva');
  await expect(luis.page.locator('#identity')).toHaveText(/Juegas como Luis/);
  await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled({ timeout: 4_000 });
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(heading(eva.page, 'Tu carta')).toBeVisible({ timeout: 4_000 });
  await expect(eva.page.locator('#identity')).toHaveText(/Juegas como Eva/);
  await expect(eva.page.locator('.card-owner')).toHaveText('Carta de Eva');
  await luis.context.close();
  await eva.context.close();
});

test('RF-001.22 el anfitrión quita a un participante con confirmación; la persona quitada lo ve explicado', async ({ page, browser }) => {
  await page.goto(`${BASE}/`);
  await page.locator('#create-name').fill('Ana');
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(heading(page, 'Sala de espera')).toBeVisible();
  const code = await page.locator('#room-code').getAttribute('data-code');
  const luis = await join(browser, code, 'Luis');
  const eva = await join(browser, code, 'Eva');
  await expect(luis.page.getByRole('button', { name: /^Quitar a/ })).toHaveCount(0); // solo el anfitrión

  await page.getByRole('button', { name: 'Quitar a Eva de la sala' }).click();
  await expect(page.getByRole('button', { name: 'Sí, quitar' })).toBeFocused();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('[data-testid="player"]')).toHaveCount(3);

  await page.getByRole('button', { name: 'Quitar a Eva de la sala' }).click();
  await page.getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(page.locator('[data-testid="player"]')).toHaveCount(2);
  await expect(luis.page.locator('[data-testid="player"]')).toHaveCount(2, { timeout: 4_000 });
  await expect(eva.page.locator('#fatal-message')).toContainText('el anfitrión te quitó', { timeout: 4_000 });
  await luis.context.close();
  await eva.context.close();
});
