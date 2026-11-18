# SPEC-FEAT-006 — Resultados, adivinanza y reflexión final

> **Proyecto:** Farsante Scrum · **Versión:** 0.1.0 · **Estado:** IMPLEMENTADA (APR-018) · **Constitución:** 1.0.0 no ratificada · **Responsables:** `[PENDIENTE]` · **Autorización G3:** APROBADA 2026-11-18 por CristianDev (APR-018)
>
> **Origen:** RF-006, RF-007 · **Depende de:** SPEC-FEAT-005

## 01. Intención

- **Problema:** cerrar cada votación con un resultado claro y terminar la partida con una conversación útil.
- **Actores:** todos; impostor descubierto (adivina); anfitrión (siguiente ronda).
- **Resultado:** reglas de resultado aplicadas en orden; reflexión visible solo en `finished`.

## 02. Comportamiento

**HU-011, HU-012, HU-013.**

| ID | Requisito (orden de evaluación) | Prioridad |
|---|---|---|
| RF-006.01 | Sin cuórum → nadie señalado, identidad oculta, recuento visible → `reveal` | P1 |
| RF-006.02 | Con cuórum y empate entre los más votados → igual que RF-006.01 | P1 |
| RF-006.03 | `reveal` vuelve a `clues` con nuevo orden tras 18 s o con `next` del anfitrión | P1 |
| RF-006.04 | Inocente único más votado → `finished`, gana el impostor; todos ven acusado, sus votos, «era inocente» y el verdadero impostor | P1 |
| RF-006.05 | Impostor único más votado → `guess`: solo él tiene 45 s para adivinar | P1 |
| RF-006.06 | Acierto (comparación normalizada) → gana el impostor; fallo o vencimiento → gana el equipo; los errores no exponen la palabra | P1 |
| RF-006.07 | `finished` muestra ganador, verdadero impostor, palabra, recuento y reflexión | P1 |
| RF-007.01 | Reflexión y pregunta específicas para las diez palabras Scrum (texto editorial del prompt maestro RF-007); reflexión general para el resto y personalizadas | P1 |
| RF-007.02 | La reflexión no se envía en `roles`, `clues`, `discussion`, `vote`, `reveal` ni `guess` | P1 |
| RF-007.03 | QA y DEV se presentan como términos del equipo, no como ceremonias oficiales | P2 |

La regla acordada **no** continúa la partida tras acusar a un inocente.

```gherkin
Característica: Resultados y reflexiones

  Escenario: Inocente más votado con cuatro participantes
    Dado que tres de los cuatro votos señalan a un inocente
    Y el cuarto señala al impostor
    Cuando se cierra la votación
    Entonces termina la partida con victoria del impostor
    Y todos ven el inocente señalado, tres votos y el verdadero impostor
    Y se muestra la palabra y su reflexión

  Escenario: Empate mantiene el secreto
    Dado que dos jugadores empatan con 2 votos cada uno y hay cuórum
    Cuando se cierra la votación
    Entonces la fase es "reveal"
    Y nadie recibe la identidad del impostor ni la palabra si no le corresponde
    Y tras 18 segundos comienza una nueva ronda de pistas con nuevo orden

  Escenario: Impostor descubierto acierta
    Dado que el impostor fue el más votado
    Cuando envía "retro" y la palabra es "Retro"
    Entonces gana el impostor y la fase es "finished"

  Escenario: Solo el impostor adivina
    Dado la fase "guess"
    Cuando "Luis", que no es impostor, envía "guess"
    Entonces recibe 403 "NOT_IMPOSTOR"

  Escenario: Reflexión oculta durante la adivinanza
    Dado la fase "guess" con la palabra "Daily"
    Cuando cualquier jugador consulta el estado
    Entonces ningún DTO contiene la reflexión de "Daily"

  Escenario: Reflexión general para palabras personalizadas
    Dado que la palabra fue "Kanban" de una lista personalizada
    Cuando la partida termina
    Entonces se muestra la reflexión general
```

**Pruebas:** T-010, T-011, T-012 (dominio/DTO por fase/E2E), verificación de los once textos editoriales.

**UX:** ganador en texto y no solo color; tabla de recuento; foco al encabezado de resultado; reflexión con pregunta destacada.

## 03. Restricciones

Textos editoriales en `lib/reflections.js`, revisados por el responsable de producto antes de G3.

## 04. No-Objetivos

Reflexiones por palabra para Comida/Música/Tecnología (HU-X03); puntuaciones acumuladas.

## 05. Decisiones abiertas

Normalización para la adivinanza: usar la misma de D-12 (PROPUESTA).

## 06. Autorización

Alcance propuesto: `lib/game.js`, `lib/reflections.js`, `lib/projection.js`, `lib/api.js`, `public/app.js`, pruebas. `[PENDIENTE]`.

## Implementación y evidencia (2026-11-18, APR-018)

- **Estado:** IMPLEMENTADA (G4) y verificada en local (G5 parcial); sin Git, sin despliegue.
- **Pruebas:** `npm test` **89/89** en el equipo de CristianDev (memoria y Redis simulado); `npm run test:e2e` **46/46**, dos ejecuciones seguidas, en el entorno en la nube de la sesión con Chrome del sistema (escritorio y móvil emulado). Detalle en [traceability.md](../qa/traceability.md).
- **Decisiones aplicadas por propuesta (pendientes de confirmación):** ver [approvals.md](../governance/approvals.md) APR-018.
- **Pendiente:** Upstash real, Vercel, lector de pantalla y medición de contraste renderizado.
