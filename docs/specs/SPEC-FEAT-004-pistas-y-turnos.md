# SPEC-FEAT-004 — Pistas con palabra o frase por turnos

> **Proyecto:** Farsante Scrum · **Versión:** 0.1.0 · **Estado:** IMPLEMENTADA (APR-018) · **Constitución:** 1.0.0 no ratificada · **Responsables:** `[PENDIENTE]` · **Autorización G3:** APROBADA 2026-11-18 por CristianDev (APR-018)
>
> **Origen:** RF-004 · **Depende de:** SPEC-FEAT-003

## 01. Intención

- **Problema:** cada jugador debe aportar una pista en orden, sin revelar la palabra ni bloquear la partida.
- **Actor:** jugador en turno; anfitrión (saltar).
- **Resultado:** historial ordenado de pistas por ronda; avance automático por envío, vencimiento o salto.

## 02. Comportamiento

**HU-008, HU-009.**

| ID | Requisito | Prioridad |
|---|---|---|
| RF-004.01 | El orden se sortea en servidor al comenzar cada ronda (permutación sin duplicados) | P1 |
| RF-004.02 | Solo el jugador en turno envía; otros reciben `403 NOT_YOUR_TURN` | P1 |
| RF-004.03 | Pista no vacía de hasta 160 caracteres (D-11) tras normalizar espacios; misma validación en cliente y servidor | P1 |
| RF-004.04 | Se rechaza una pista ya usada en la ronda (comparación normalizada) | P1 |
| RF-004.05 | Se rechaza si contiene la palabra secreta como **secuencia completa de tokens** normalizados (mayúsculas, acentos, puntuación); no por subcadenas ajenas (D-12) | P1 |
| RF-004.06 | Una pista rechazada no consume el turno; el texto se conserva en el campo | P1 |
| RF-004.07 | Tratamiento del oráculo según D-13 (propuesta: máx. 3 rechazos por turno; mensaje que no confirma la coincidencia exacta) | P2 |
| RF-004.08 | 60 s por turno; avanza al enviar, al vencer (registra «Sin pista») o con `skip` del anfitrión | P1 |
| RF-004.09 | Historial en orden, con ajuste de línea para frases largas | P1 |
| RF-004.10 | Tras el último turno de la ronda → `discussion` | P1 |

**Normalización propuesta (D-12):** NFD → quitar diacríticos → minúsculas → signos de puntuación a espacio → colapsar espacios → tokens. Ejemplos a aprobar:

| Secreta | Pista | ¿Rechazar? |
|---|---|---|
| Historia de Usuario | «Se parece a una historia de usuario bien escrita» | Sí |
| Historia de Usuario | «Una historia que cuenta un usuario» | No (secuencia no contigua) |
| QA | «Aquí probamos todo» | No |
| QA | «Lo hace el equipo de Q.A.» | **Por decidir** (puntuación separa «q» y «a») |
| Review | «REVIEW!!!» | Sí |
| Sprint | «sprints cortos» | No, salvo decisión sobre plurales |
| Reguetón | «reggaeton» | No (otra grafía) |

```gherkin
Característica: Pistas por turnos

  Escenario: Una frase incluye el concepto secreto
    Dado que la palabra secreta es "Historia de Usuario"
    Y un participante tiene el turno
    Cuando envía "Se parece a una historia de usuario bien escrita"
    Entonces la pista es rechazada
    Y no se consume su turno por esa entrada inválida

  Escenario: Subcadena ajena no bloquea
    Dado que la palabra secreta es "QA"
    Cuando el jugador en turno envía "Aquí probamos todo"
    Entonces la pista es aceptada

  Escenario: Fuera de turno
    Dado que el turno es de "Ana"
    Cuando "Luis" envía una pista
    Entonces recibe 403 "NOT_YOUR_TURN" y el historial no cambia

  Escenario: Límite de 160 caracteres
    Cuando el jugador en turno envía una frase de 161 caracteres
    Entonces recibe 400 "INVALID_CLUE"
    Y con 160 caracteres la pista es aceptada

  Escenario: Pista repetida
    Dado que "Ana" escribió "Mirar atrás" en esta ronda
    Cuando "Luis" envía "mirar  ATRÁS"
    Entonces la pista es rechazada como repetida

  Escenario: Vence el turno
    Dado que el turno de "Luis" empezó hace 60 segundos
    Cuando cualquier integrante consulta el estado
    Entonces el historial registra "Sin pista" para "Luis"
    Y el turno pasa al siguiente jugador con plazo desde el vencimiento original

  Escenario: El anfitrión salta un turno
    Cuando el anfitrión envía "skip"
    Entonces se registra "Sin pista" y avanza el turno
```

**Pruebas:** T-006 (API y tabla de normalización), T-007 (reloj controlado, saltos sin duplicar pistas).

**UX:** estados de pista (fuera de turno, escribiendo con contador, enviando, rechazada, vencida, aceptada); anuncio único «Es tu turno»; aviso a 10 s restantes.

## 03. Restricciones

Mensajes de error sin exponer la palabra; validación compartida; sin dependencias.

## 04. No-Objetivos

Pistas por voz; edición de pistas enviadas; detección de sinónimos o traducciones.

## 05. Decisiones abiertas

D-11, D-12, D-13.

## 06. Autorización

Alcance propuesto: `lib/text.js`, `lib/game.js`, `lib/projection.js`, `lib/api.js`, `public/app.js`, pruebas. `[PENDIENTE]`.

## Implementación y evidencia (2026-11-18, APR-018)

- **Estado:** IMPLEMENTADA (G4) y verificada en local (G5 parcial); sin Git, sin despliegue.
- **Pruebas:** `npm test` **89/89** en el equipo de CristianDev (memoria y Redis simulado); `npm run test:e2e` **46/46**, dos ejecuciones seguidas, en el entorno en la nube de la sesión con Chrome del sistema (escritorio y móvil emulado). Detalle en [traceability.md](../qa/traceability.md).
- **Decisiones aplicadas por propuesta (pendientes de confirmación):** ver [approvals.md](../governance/approvals.md) APR-018.
- **Pendiente:** Upstash real, Vercel, lector de pantalla y medición de contraste renderizado.
