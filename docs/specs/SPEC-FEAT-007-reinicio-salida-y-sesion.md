# SPEC-FEAT-007 — Reiniciar, volver a jugar, salir y sesión

> **Proyecto:** Farsante Scrum · **Versión:** 0.1.0 · **Estado:** IMPLEMENTADA (APR-018) · **Constitución:** 1.0.0 no ratificada · **Responsables:** `[PENDIENTE]` · **Autorización G3:** APROBADA 2026-11-18 por CristianDev (APR-018)
>
> **Origen:** RF-008, RF-009 · **Depende de:** SPEC-FEAT-001, SPEC-FEAT-003

## 01. Intención

- **Problema:** el facilitador necesita reconducir la actividad en cualquier momento y las personas deben poder salir o volver sin romper la sala.
- **Actores:** anfitrión (reiniciar, jugar otra), integrantes (salir).
- **Resultado:** reinicio global limpio y sin reactivaciones; salida con transferencia de anfitrión.

## 02. Comportamiento

**HU-014, HU-015, HU-004.**

| ID | Requisito | Prioridad |
|---|---|---|
| RF-008.01 | **Reiniciar partida** visible solo para el anfitrión en toda fase activa; **Jugar otra partida** en `finished` | P1 |
| RF-008.02 | Reiniciar vuelve todos a `lobby`; conserva código, participantes, anfitrión y palabras guardadas | P1 |
| RF-008.03 | Limpia palabra, impostor, roles, confirmaciones, orden, pistas, votos, resultados, ganador y vencimientos; invalida el `gameId` | P1 |
| RF-008.04 | Acciones o respuestas de la partida anterior no la reactivan (`409 STALE_GAME`; el cliente descarta respuestas con otro `gameId` o versión menor) | P1 |
| RF-008.05 | Se informa el alcance global de la acción; confirmación según D-15 | P2 |
| RF-008.06 | Solo el anfitrión reinicia, aunque otro llame a la API (`403 NOT_HOST`) | P1 |
| RF-008.07 | Salir solo en `lobby` o `finished`; en partida activa se explica que el anfitrión debe reiniciar primero | P1 |
| RF-008.08 | Si sale el anfitrión, el control pasa al siguiente integrante por orden de entrada; si sale el último, la sala se elimina atómicamente | P1 |
| RF-009.01 | Recargar con sesión válida no crea integrante nuevo (base en SPEC-001) | P1 |
| RF-009.02 | Al salir o cambiar de sesión se cancelan consultas y reconexiones; no se aplican respuestas de la sala anterior | P1 |
| RF-009.03 | Manejo explícito de sesión inválida, sala expirada, servidor no disponible y almacenamiento bloqueado o corrupto | P1 |
| RF-009.04 | Otra invitación con sesión activa: D-25 | P2 |

```gherkin
Característica: Reinicio y salida

  Escenario: Reinicio durante votación
    Dado que existe una votación con votos registrados
    Cuando el anfitrión reinicia la partida
    Entonces todos vuelven a la sala de espera
    Y se conservan código, participantes y palabras guardadas
    Y se limpian roles, pistas, votos y vencimientos
    Y ninguna petición de la partida anterior la reactiva

  Escenario: Voto tardío tras reinicio
    Dado que "Luis" envió un voto con el gameId anterior justo después del reinicio
    Cuando el servidor lo procesa
    Entonces responde 409 "STALE_GAME" y la sala sigue en "lobby"

  Escenario: Participante intenta reiniciar
    Cuando "Luis" envía "reset" directamente a la API
    Entonces recibe 403 "NOT_HOST" y la partida continúa

  Escenario: El anfitrión sale en la sala de espera
    Dado que "Ana" es anfitriona y "Luis" entró después que "Eva"
    Cuando "Ana" sale
    Entonces "Eva" pasa a ser anfitriona
    Y todos lo ven en su siguiente actualización

  Escenario: Sale el último integrante
    Dado que solo "Eva" queda en la sala
    Cuando "Eva" sale
    Entonces la sala se elimina
    Y una petición antigua con su sesión no la recrea

  Escenario: Salir durante una partida activa
    Dado la fase "clues"
    Cuando "Luis" intenta salir
    Entonces recibe 409 "WRONG_PHASE" con el mensaje de que el anfitrión debe reiniciar primero
```

**Pruebas:** T-013 (reinicio en roles/pistas/voto/adivinanza), T-014 (reinicio concurrente, transferencia), T-015 (recarga, red, sesión inválida, sala expirada).

**UX:** botón de peligro; estados de reinicio; foco al encabezado del lobby tras el reinicio.

## 03. Restricciones

Eliminación de sala con comparación de versión (ADR-0002); sin salida unilateral en partida.

## 04. No-Objetivos

Expulsar integrantes; transferencia por desconexión (D-16); salida durante turnos o votación.

## 05. Decisiones abiertas

D-15, D-16, D-25.

## 06. Autorización

Alcance propuesto: `lib/room.js`, `lib/game.js`, `lib/api.js`, `lib/store/*`, `public/app.js`, pruebas. `[PENDIENTE]`.

## Implementación y evidencia (2026-11-18, APR-018)

- **Estado:** IMPLEMENTADA (G4) y verificada en local (G5 parcial); sin Git, sin despliegue.
- **Pruebas:** `npm test` **89/89** en el equipo de CristianDev (memoria y Redis simulado); `npm run test:e2e` **46/46**, dos ejecuciones seguidas, en el entorno en la nube de la sesión con Chrome del sistema (escritorio y móvil emulado). Detalle en [traceability.md](../qa/traceability.md).
- **Decisiones aplicadas por propuesta (pendientes de confirmación):** ver [approvals.md](../governance/approvals.md) APR-018.
- **Pendiente:** Upstash real, Vercel, lector de pantalla y medición de contraste renderizado.
