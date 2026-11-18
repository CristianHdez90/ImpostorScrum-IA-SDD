# SPEC-FEAT-005 — Debate y votación secreta

> **Proyecto:** Farsante Scrum · **Versión:** 0.1.0 · **Estado:** IMPLEMENTADA (APR-018) · **Constitución:** 1.0.0 no ratificada · **Responsables:** `[PENDIENTE]` · **Autorización G3:** APROBADA 2026-11-18 por CristianDev (APR-018)
>
> **Origen:** RF-005 · **Depende de:** SPEC-FEAT-004

## 01. Intención

- **Problema:** el equipo debe decidir colectivamente a quién señalar sin presiones por votos visibles.
- **Actor:** integrantes elegibles; anfitrión (abrir y cerrar con cuórum).
- **Resultado:** votación secreta con cuórum de dos tercios; recuento visible solo al cerrar.

## 02. Comportamiento

**HU-010.**

| ID | Requisito | Prioridad |
|---|---|---|
| RF-005.01 | `discussion` dura 45 s; el anfitrión puede abrir la votación antes (`voting`) | P1 |
| RF-005.02 | `vote` dura 75 s; el conjunto de elegibles se fija al abrirla y no se reduce por desconexiones | P1 |
| RF-005.03 | Un voto por elegible, dirigido a otro integrante; se rechazan auto-voto (`400 INVALID_VOTE`), duplicado (`409 ALREADY_VOTED`) y destino inválido | P1 |
| RF-005.04 | Durante la votación solo se publica la participación («4 de 6 votaron») y el voto propio al propio votante | P1 |
| RF-005.05 | Cierre automático cuando votan todos los elegibles o al vencer 75 s | P1 |
| RF-005.06 | El anfitrión puede cerrar antes solo si participación ≥ `ceil(elegibles × 2 / 3)` | P1 |
| RF-005.07 | El cuórum se refiere a participación; el acusado es el **más votado sin empate** (sin exigir mayoría absoluta) | P1 |
| RF-005.08 | Al cerrar se publica el recuento por candidato, nunca quién votó a quién | P1 |

**Tabla de cuórum:** 3→2, 4→3, 5→4, 6→4, 7→5, 8→6, 9→6, 10→7, 11→8, 12→8.

```gherkin
Característica: Debate y votación

  Escenario: Voto por uno mismo
    Cuando "Ana" vota por "Ana"
    Entonces recibe 400 "INVALID_VOTE" y la participación no cambia

  Escenario: Voto duplicado
    Dado que "Ana" ya votó
    Cuando vuelve a votar por otra persona
    Entonces recibe 409 "ALREADY_VOTED" y su voto original se conserva

  Escenario: Desconexión no reduce el cuórum
    Dado una votación abierta con 6 elegibles
    Cuando "Eva" se desconecta
    Entonces siguen siendo 6 elegibles y el cuórum sigue siendo 4

  Escenario: Cierre anticipado sin cuórum
    Dado que votaron 3 de 6
    Cuando el anfitrión envía "closeVote"
    Entonces recibe 409 "WRONG_PHASE" con motivo "QUORUM_NOT_REACHED"

  Escenario: Cierre automático
    Cuando el último elegible vota
    Entonces la votación se cierra y se calcula el resultado

  Escenario: Votos secretos durante la votación
    Dado que votaron 4 de 6
    Cuando "Luis" consulta el estado
    Entonces ve "4 de 6 votaron" y su propio voto
    Y no ve votos de otros ni el recuento por candidato

  Escenario: Votos simultáneos
    Cuando 6 elegibles votan al mismo tiempo desde instancias distintas
    Entonces se registran exactamente 6 votos
```

**Pruebas:** T-008 (API/concurrencia), T-009 (cuórum por techo de dos tercios, empate, cierre anticipado).

**UX:** selección editable separada de la confirmación irreversible; radios en `fieldset` con `legend`; estado «Voto registrado».

## 03. Restricciones

Mapa de votos solo en servidor; sin registrar votos en logs.

## 04. No-Objetivos

Voto en blanco; cambio de voto; votos públicos.

## 05. Decisiones abiertas

Ninguna propia; depende de D-29 para elegibles iniciales.

## 06. Autorización

Alcance propuesto: `lib/game.js`, `lib/projection.js`, `lib/api.js`, `public/app.js`, pruebas. `[PENDIENTE]`.

## Implementación y evidencia (2026-11-18, APR-018)

- **Estado:** IMPLEMENTADA (G4) y verificada en local (G5 parcial); sin Git, sin despliegue.
- **Pruebas:** `npm test` **89/89** en el equipo de CristianDev (memoria y Redis simulado); `npm run test:e2e` **46/46**, dos ejecuciones seguidas, en el entorno en la nube de la sesión con Chrome del sistema (escritorio y móvil emulado). Detalle en [traceability.md](../qa/traceability.md).
- **Decisiones aplicadas por propuesta (pendientes de confirmación):** ver [approvals.md](../governance/approvals.md) APR-018.
- **Pendiente:** Upstash real, Vercel, lector de pantalla y medición de contraste renderizado.
