'use strict';

/** Recorridos del juego completo con 3 sesiones independientes (SPEC-FEAT-002…007). */
const { test, expect } = require('@playwright/test');

const SSE_URL = 'http://127.0.0.1:4173';
const POLL_URL = 'http://127.0.0.1:4174';
const heading = (page, name) => page.getByRole('heading', { level: 1, name });

async function createRoom(page, base, name = 'Ana') {
  await page.goto(`${base}/`);
  await page.locator('#create-name').fill(name);
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(heading(page, 'Sala de espera')).toBeVisible();
  return page.locator('#room-code').getAttribute('data-code');
}

async function join(browser, base, code, name) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/?sala=${code}`);
  await page.locator('#invite-name').fill(name);
  await page.getByRole('button', { name: 'Unirme al juego' }).click();
  await expect(heading(page, 'Sala de espera')).toBeVisible();
  return { context, page };
}

/** Sala de 3 jugadores llevada hasta la votación; devuelve quién es el impostor. */
async function playToVote(page, browser, base = SSE_URL) {
  const code = await createRoom(page, base);
  const luis = await join(browser, base, code, 'Luis');
  const eva = await join(browser, base, code, 'Eva');
  const players = { Ana: page, Luis: luis.page, Eva: eva.page };
  await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled({ timeout: 3_000 });
  await page.getByRole('button', { name: 'Iniciar partida' }).click();

  let impostor = null;
  let word = null;
  for (const [name, p] of Object.entries(players)) {
    await expect(heading(p, 'Tu carta')).toBeVisible({ timeout: 3_000 });
    await p.getByRole('button', { name: 'Ver mi carta' }).click();
    const text = await p.locator('#card-content').innerText();
    if (text.includes('Eres el impostor')) impostor = name;
    else word = text.replace('La palabra secreta es', '').trim();
    await p.getByRole('button', { name: 'Ya vi mi rol, estoy listo' }).click();
  }
  for (const p of Object.values(players)) await expect(heading(p, 'Ronda de pistas')).toBeVisible({ timeout: 3_000 });

  for (let turn = 1; turn <= 3; turn += 1) {
    await expect(page.locator('#turn-info')).toContainText(`(${turn} de 3)`, { timeout: 3_000 });
    // En modo de consultas, cada página se entera del turno en ≤ 1,5 s: esperar a que alguna lo muestre.
    const pages = Object.values(players);
    const findCurrent = async () => {
      for (let i = 0; i < pages.length; i += 1) if (await pages[i].locator('#clue-form').isVisible()) return i;
      return -1;
    };
    await expect.poll(findCurrent, { timeout: 4_000, message: `alguien tiene el turno ${turn}` }).toBeGreaterThan(-1);
    const current = pages[await findCurrent()];
    await expect(current.locator('#turn-info')).toHaveText(`Es tu turno (${turn} de 3).`);
    await current.getByLabel('Tu pista').fill(`una frase de prueba ${turn}`);
    await current.getByRole('button', { name: 'Enviar pista' }).click();
  }
  for (const p of Object.values(players)) await expect(heading(p, 'Debate')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('#clue-history li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Abrir votación' }).click();
  for (const p of Object.values(players)) await expect(heading(p, 'Votación secreta')).toBeVisible({ timeout: 3_000 });
  return { players, impostor, word, contexts: [luis.context, eva.context] };
}

/** El último voto cierra la votación y la vista cambia de fase, sin mostrar «voto registrado». */
async function vote(page, target, { last = false } = {}) {
  await page.getByRole('radio', { name: target }).check();
  await page.getByRole('button', { name: 'Confirmar voto' }).click();
  if (!last) await expect(page.locator('#vote-done')).toBeVisible({ timeout: 3_000 });
}

test('partida completa: el equipo descubre al impostor, falla la adivinanza y se muestra la reflexión', async ({ page, browser }) => {
  const game = await playToVote(page, browser);
  const innocents = Object.keys(game.players).filter((n) => n !== game.impostor);
  await vote(game.players[innocents[0]], game.impostor);
  await expect(game.players[innocents[1]].locator('#vote-progress')).toContainText('1 de 3 votaron', { timeout: 3_000 });
  await vote(game.players[innocents[1]], game.impostor);
  await vote(game.players[game.impostor], innocents[0], { last: true });

  const impostorPage = game.players[game.impostor];
  await expect(heading(impostorPage, '¡Descubrieron al impostor!')).toBeVisible({ timeout: 3_000 });
  await expect(game.players[innocents[0]].locator('#guess-wait')).toContainText(game.impostor);
  await impostorPage.getByLabel('Tu respuesta').fill('seguro que no es esta');
  await impostorPage.getByRole('button', { name: 'Adivinar la palabra' }).click();

  for (const p of Object.values(game.players)) {
    await expect(heading(p, '¡Ganó el equipo!')).toBeVisible({ timeout: 3_000 });
    await expect(p.locator('#finished-summary')).toContainText(`La palabra era ${game.word}.`);
    await expect(p.locator('#finished-summary')).toContainText(`El impostor era ${game.impostor}.`);
    await expect(p.locator('#reflection-question')).toHaveText(/\?$/);
  }
  await page.getByRole('button', { name: 'Jugar otra partida' }).click();
  for (const p of Object.values(game.players)) await expect(heading(p, 'Sala de espera')).toBeVisible({ timeout: 3_000 });
  for (const c of game.contexts) await c.close();
});

test('empate: nadie es señalado, la identidad sigue oculta y el anfitrión inicia otra ronda (modo Vercel)', async ({ page, browser }) => {
  const game = await playToVote(page, browser, POLL_URL);
  await vote(game.players.Ana, 'Luis');
  await vote(game.players.Luis, 'Eva');
  await vote(game.players.Eva, 'Ana', { last: true });
  for (const p of Object.values(game.players)) {
    await expect(heading(p, 'Nadie fue señalado')).toBeVisible({ timeout: 4_000 });
    await expect(p.locator('#reveal-reason')).toHaveText('Hubo un empate entre los más votados.');
  }
  const innocent = Object.keys(game.players).find((n) => n !== game.impostor);
  expect(await game.players[innocent].content()).not.toContain('Eres el impostor');
  await page.getByRole('button', { name: 'Siguiente ronda' }).click();
  for (const p of Object.values(game.players)) {
    await expect(heading(p, 'Ronda de pistas')).toBeVisible({ timeout: 4_000 });
    await expect(p.locator('#lap-label')).toHaveText('Vuelta 2');
  }
  for (const c of game.contexts) await c.close();
});

test('pista con la palabra secreta: se rechaza junto al campo y el turno sigue', async ({ page, browser }) => {
  const code = await createRoom(page, SSE_URL);
  const luis = await join(browser, SSE_URL, code, 'Luis');
  const eva = await join(browser, SSE_URL, code, 'Eva');
  const players = [page, luis.page, eva.page];
  await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeEnabled({ timeout: 3_000 });
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  for (const p of players) {
    await expect(heading(p, 'Tu carta')).toBeVisible({ timeout: 3_000 });
    await p.getByRole('button', { name: 'Ya vi mi rol, estoy listo' }).click();
  }
  await expect(heading(page, 'Ronda de pistas')).toBeVisible({ timeout: 3_000 });
  // Cada página recibe el turno por su cuenta: esperar a que alguna muestre el formulario.
  const findCurrent = async () => {
    for (let i = 0; i < players.length; i += 1) if (await players[i].locator('#clue-form').isVisible()) return i;
    return -1;
  };
  await expect.poll(findCurrent, { timeout: 4_000, message: 'alguien tiene el primer turno' }).toBeGreaterThan(-1);
  const current = players[await findCurrent()];
  await current.getByRole('button', { name: 'Ver mi carta' }).click();
  const card = await current.locator('#card-content').innerText();
  if (!card.includes('Eres el impostor')) {
    const word = card.replace('La palabra secreta es', '').trim();
    await current.getByLabel('Tu pista').fill(`tiene que ver con ${word}`);
    await current.getByRole('button', { name: 'Enviar pista' }).click();
    await expect(current.locator('#clue-text-error')).toHaveText('Esa pista no se puede usar. Prueba con otra.');
    await expect(current.getByLabel('Tu pista')).toHaveValue(`tiene que ver con ${word}`);
    await expect(current.locator('#turn-info')).toHaveText('Es tu turno (1 de 3).');
  }
  await current.getByLabel('Tu pista').fill(`x${'y'.repeat(160)}`);
  await current.getByRole('button', { name: 'Enviar pista' }).click();
  await expect(current.locator('#clue-text-error')).toHaveText('La pista admite hasta 160 caracteres.');
  await luis.context.close();
  await eva.context.close();
});

test('palabras: el anfitrión cambia a Música, su borrador sobrevive a una entrada y queda guardado tras recargar', async ({ page, browser }) => {
  const code = await createRoom(page, SSE_URL);
  await page.getByLabel('Grupo', { exact: true }).selectOption('musica');
  await expect(page.locator('#words-draft')).toBeVisible();
  const luis = await join(browser, SSE_URL, code, 'Luis');
  await expect(page.getByTestId('player')).toHaveCount(2, { timeout: 3_000 });
  await expect(page.getByLabel('Palabras, una por línea')).toHaveValue(/^Salsa\nReguetón/);
  await page.getByRole('button', { name: 'Guardar palabras' }).click();
  await expect(page.locator('#words-label')).toHaveText('Música');
  await expect(page.locator('#words-draft')).toBeHidden();
  await expect(luis.page.locator('#words-label')).toHaveText('Música', { timeout: 3_000 });
  await expect(luis.page.locator('#words-form')).toBeHidden();
  await page.reload();
  await expect(page.locator('#words-label')).toHaveText('Música');
  await expect(page.getByLabel('Grupo', { exact: true })).toHaveValue('musica');

  await page.getByLabel('Palabras, una por línea').fill('Kanban\nLean\nX');
  await page.getByRole('button', { name: 'Guardar palabras' }).click();
  await expect(page.locator('#words-text-error')).toContainText('Revisa: X');
  await luis.context.close();
});

test('salir: el anfitrión sale de la sala de espera y el control pasa al siguiente', async ({ page, browser }) => {
  const code = await createRoom(page, SSE_URL);
  const luis = await join(browser, SSE_URL, code, 'Luis');
  await page.getByRole('button', { name: 'Salir de la sala' }).click();
  await expect(heading(page, 'Farsante Scrum')).toBeVisible();
  await expect(luis.page.getByTestId('player')).toHaveCount(1, { timeout: 3_000 });
  await expect(luis.page.getByRole('button', { name: 'Iniciar partida' })).toBeVisible();
  await expect(luis.page.getByTestId('player')).toContainText('Anfitrión');
  await luis.context.close();
});

test('/health responde con el estado del almacén', async ({ request }) => {
  const res = await request.get(`${SSE_URL}/health`);
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok', store: 'memory' });
});
