# SPEC-FEAT-003 — Inicio de partida, sorteo y carta privada

> **Proyecto:** Farsante Scrum · **Versión:** 0.2.0 · **Estado:** IMPLEMENTADA (G4) y verificada localmente (G5 parcial) — pendiente revisión de CristianDev; sin despliegue
>
> **Constitución:** [`../governance/CONSTITUTION.md`](../governance/CONSTITUTION.md) 1.0.0 ratificada · **Responsable:** CristianDev (APR-001) · **Autorización G3:** APROBADA 2026-11-18 por CristianDev (APR-016), con reinicio mínimo; D-15 confirmación en un paso (APR-017)
>
> **Origen:** RF-003; petición de CristianDev del 2026-11-18 12:16: «Se debe poder iniciar el juego con mínimo 3 participantes». **Depende de:** SPEC-FEAT-001 (implementada). SPEC-FEAT-002 no es necesaria: se juega con el grupo guardado (Scrum por defecto).
>
> **Propuesta de alcance ampliado (requiere decisión):** incluir el **reinicio mínimo** de SPEC-FEAT-007 (RF-008.01–.06). Sin él, una sala que inicia queda bloqueada: la fase de pistas (SPEC-004) aún no existe y nadie podría volver a la sala de espera.

## 01. Intención

- **Problema:** repartir roles en secreto sin que nadie, ni el anfitrión, vea los ajenos.
- **Actor:** anfitrión (inicia y reinicia), todos (ven su carta y confirman).
- **Resultado:** con 3 a 12 integrantes conectados, el anfitrión inicia; el servidor elige una palabra y exactamente un impostor; cada uno ve solo su carta.
- **Medida de éxito:** `[POR APROBAR — D-06]`.

## 02. Comportamiento

**HU-006, HU-007** (y HU-014 si se aprueba el reinicio mínimo).

| ID | Requisito | Prioridad |
|---|---|---|
| RF-003.01 | Solo el anfitrión ve **Iniciar partida**; el servidor rechaza a cualquier otro (`403 NOT_HOST`) | P1 |
| RF-003.02 | Condición: **al menos 3 integrantes y todos conectados** (APR-009). Si no se cumple, el botón está deshabilitado y el motivo se ve a su lado («Faltan 2 participantes», «Esperando a Eva»); el servidor responde `409 WRONG_PHASE` con el motivo | P1 |
| RF-003.03 | El servidor elige con `crypto.randomInt` una palabra del grupo guardado y exactamente un impostor, y crea un `gameId` nuevo | P1 |
| RF-003.04 | La sala pasa a `roles` con plazo de 90 s; nadie más puede unirse (`ROOM_STARTED`, ya implementado) | P1 |
| RF-003.05 | La carta está oculta hasta que su dueño pulsa **Ver mi carta**; se advierte sobre compartir pantalla. Mientras está oculta, su contenido no está en el DOM | P1 |
| RF-003.06 | Los jugadores normales reciben la palabra; el impostor recibe `role: "impostor"` y `word: null` | P1 |
| RF-003.07 | **Ya vi mi rol, estoy listo** es idempotente; todos ven «Preparados n de N», sin decir quién falta | P1 |
| RF-003.08 | Cuando todos confirman, o al vencer los 90 s, la sala pasa a `clues`. El vencimiento se aplica en la siguiente petición, desde el plazo original | P1 |
| RF-003.09 | Ningún secreto en HTML inicial, `data-*`, consola, logs ni DTO ajeno | P1 |
| RF-003.10 | Mientras no exista SPEC-004, `clues` muestra «Comienza la ronda de pistas» y avisa que esa fase llega en la siguiente versión | P2 |
| RF-003.11 | `POST /api/action` (contrato §2) con `gameId` obligatorio en acciones de partida; `gameId` antiguo → `409 STALE_GAME` | P1 |
| RF-008.01–.06 *(si se aprueba)* | **Reiniciar partida** solo para el anfitrión en `roles` y `clues`: todos vuelven a `lobby`, se conservan código, integrantes, anfitrión y palabras, y se borra palabra, impostor y confirmaciones. Confirmación según D-15 | P1 |

**Contrato nuevo:** `POST /api/action` con `{ code, type, payload, gameId }`; tipos `start`, `ready` y, si se aprueba, `reset`. El DTO añade `gameId`, `deadline`, `me.role`, `me.word` y `ready: { count, total, mine }`.

```gherkin
Característica: Inicio y roles

  Escenario: CA-01 Iniciar con tres participantes conectados
    Dado una sala con Ana (anfitriona), Luis y Eva conectados
    Cuando Ana pulsa "Iniciar partida"
    Entonces los tres pasan a la pantalla de roles con la carta oculta y 90 segundos

  Escenario: CA-02 No se puede iniciar con menos de tres
    Dado una sala con Ana y Luis
    Entonces el botón "Iniciar partida" está deshabilitado y se lee "Falta 1 participante"
    Y si Ana envía "start" a la API recibe 409 "WRONG_PHASE"

  Escenario: CA-03 No se puede iniciar con alguien desconectado
    Dado 4 integrantes y Eva desconectada
    Entonces Ana ve "Esperando la conexión de: Eva"
    Y si envía "start" recibe 409 "WRONG_PHASE"

  Escenario: CA-04 Solo el anfitrión inicia
    Cuando Luis envía "start" directamente a la API
    Entonces recibe 403 "NOT_HOST" y la sala sigue en "lobby"

  Escenario: CA-05 Exactamente un impostor y una palabra del grupo
    Dado una sala con 5 integrantes
    Cuando se inician 1000 partidas con aleatoriedad controlada
    Entonces cada una tiene exactamente un impostor y una palabra del grupo guardado

  Escenario: CA-06 El impostor no recibe la palabra
    Dado que la partida inició
    Cuando el impostor consulta el estado
    Entonces recibe su rol de impostor y "word": null
    Y ninguna respuesta de ningún jugador contiene la palabra fuera de su propia carta ni el id del impostor

  Escenario: CA-07 Carta oculta por defecto
    Dado la pantalla de roles
    Entonces la palabra no está en el DOM hasta pulsar "Ver mi carta"
    Y al pulsar "Ocultar" desaparece del DOM

  Escenario: CA-08 Confirmación idempotente
    Dado que Luis ya confirmó
    Cuando vuelve a confirmar
    Entonces "Preparados" no cambia

  Escenario: CA-09 Todos listos
    Cuando confirma el último jugador
    Entonces la sala pasa a "clues"

  Escenario: CA-10 Vence la preparación
    Dado que 2 de 4 confirmaron
    Cuando pasan 90 segundos y alguien consulta
    Entonces la sala está en "clues" con el vencimiento original como inicio

  Escenario: CA-11 Acción de una partida anterior
    Dado que la partida se reinició
    Cuando llega "ready" con el gameId anterior
    Entonces responde 409 "STALE_GAME" y la sala sigue en "lobby"

  Escenario: CA-12 Reinicio (si se aprueba)
    Dado la fase "roles" con confirmaciones
    Cuando Ana reinicia la partida
    Entonces todos vuelven a la sala de espera con los mismos integrantes y palabras
    Y una nueva partida sortea de nuevo palabra e impostor
    Y si Luis envía "reset" recibe 403 "NOT_HOST"
```

**Pruebas:** unitarias de `lib/game.js` (sorteo con aleatoriedad inyectada, condiciones, idempotencia, `advance` con reloj controlado); API de `start`, `ready`, `reset` y privacidad del DTO por rol; E2E con 3 sesiones (iniciar, carta oculta/visible, impostor sin palabra, todos listos, reinicio) en escritorio y móvil.

**UX:** foco al encabezado de Roles; anuncio «La partida comenzó»; botón de peligro para reiniciar; contador `mm:ss` sin anunciar cada segundo.

## 03. Restricciones

El cliente no asigna roles, palabra ni resultado. Reloj y aleatoriedad inyectables. Sin dependencias nuevas.

## 04. No-Objetivos

Pistas, turnos y orden (SPEC-004); votación; salida y transferencia de anfitrión (SPEC-007); varios impostores; elegir la palabra a mano; que el anfitrión vea roles ajenos; `actionId` y vencimientos de varias fases seguidas (SPEC-008).

## 05. Decisiones abiertas

| ID | Tema | Propuesta |
|---|---|---|
| — | Incluir el reinicio mínimo en esta SPEC | Sí |
| D-15 | Confirmación al reiniciar | Confirmación en un paso, dentro de la página (sin ventana emergente) |
| — | Mostrar quién falta por confirmar | No (solo el número) |

## 06. Dependencias

SPEC-FEAT-001 implementada; ADR-0001…0005 (aprobados para SPEC-001; se pide extenderlos a esta SPEC); sin infraestructura nueva.

## 07. Archivos futuros (propuesta de alcance G3)

| Ruta | Cambio |
|---|---|
| `lib/game.js` | **Nuevo:** inicio, sorteo, confirmación, reinicio y `advance` de la fase de roles |
| `lib/config.js` | Plazo de roles (90 s) |
| `lib/projection.js` | Rol, palabra propia, preparados y plazo |
| `lib/api.js`, `lib/http.js` | `POST /api/action` y códigos `NOT_HOST`, `WRONG_PHASE`, `STALE_GAME`, `INVALID_ACTION` |
| `public/index.html`, `public/app.js`, `public/styles.css` | Botón Iniciar, pantalla de Roles, fase `clues` provisional, Reiniciar |
| `tests/unit/game.test.js` | **Nuevo** |
| `tests/integration/api-game.test.js` | **Nuevo** |
| `tests/e2e/roles.spec.js` | **Nuevo** |
| `docs/architecture/api-contracts.md`, `docs/qa/traceability.md`, `README.md` | Actualizar |

## 08. Autorización y cierre

- **Alcance autorizado:** §07 completo, con reinicio mínimo
- **Autorizó:** CristianDev, 2026-11-18, APR-016
- **Pruebas ejecutadas (2026-11-18, sin Git):**

| Comando | Entorno | Resultado |
|---|---|---|
| `npm run lint`, `npm run check` | Equipo de CristianDev (VM del escritorio, Node 22.23.5) | Sin errores; 18/18 archivos |
| `npm test` | Igual | **66/66** (16 nuevas: `game.test.js` y `api-game.test.js`) |
| `npm run test:e2e` | Entorno en la nube de la sesión, Chrome del sistema (`CHROME_PATH`) | **34/34**: 8 nuevas (`roles.spec.js`) y las 26 de SPEC-001, en escritorio y móvil emulado |
| Revisión visual | Captura móvil de la carta con el panel de reinicio | Correcta |

- **Simulado:** almacén en memoria; sin Upstash ni Vercel.
- **Cambio en SPEC-001:** el texto del lobby pasa de «para jugar» a «para iniciar» y el anfitrión ve «Todo listo: ya puedes iniciar la partida»; su prueba E2E se actualizó.
- **Limitaciones conocidas:** en modo SSE local el paso a pistas por vencimiento se envía al cumplirse el plazo; el contador del cliente es orientativo. Sin revisión con lector de pantalla.
