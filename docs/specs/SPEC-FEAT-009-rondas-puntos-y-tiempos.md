# SPEC-FEAT-009 — Rondas, puntuación, podio y tiempos configurables

> **Proyecto:** Farsante Scrum · **Versión:** 0.1.0 · **Estado:** APROBADA — G3 (APR-022)
>
> **Constitución:** 1.0.0 ratificada · **Responsable:** CristianDev · **Origen:** pedido del 2026-11-18 16:37 (mejoras 3 y 4) y respuesta del 16:40

## 01. Intención

- **Problema:** una sola partida es corta para una retro; el equipo quiere jugar varias seguidas, ver quién gana más y ajustar los tiempos a su ritmo.
- **Actor:** anfitrión (configura), todos (juegan y ven el podio).
- **Resultado:** una serie de N rondas encadenadas con puntuación acumulada y un podio final; tiempos de turno y votación ajustables.
- **Nota de accesibilidad:** tiempos más largos ayudan con WCAG 2.2.1 (D-14), sin cerrar ese punto.

## 02. Comportamiento

| ID | Requisito | Origen |
|---|---|---|
| RF-009.01 | Configuración de la sala: **rondas** 1–10 (por defecto 1), **tiempo por turno** 30, 45, 60, 90 o 120 s (por defecto 60) y **tiempo de votación** 45, 60, 75, 90 o 120 s (por defecto 75) | Pedido |
| RF-009.02 | Se elige al crear la sala y el anfitrión puede cambiarla en la sala de espera; fuera de `lobby` → `WRONG_PHASE`; no anfitrión → `NOT_HOST`; valores fuera de lista → `INVALID_SETTINGS` | **Supuesto** (pregunta sin respuesta) |
| RF-009.03 | Cada **ronda** es una partida completa: palabra e impostor nuevos, carta, una pista por jugador por vuelta, debate, votación y resultado. Si hay empate o falta cuórum, la ronda sigue con otra vuelta de pistas (regla vigente) | Pedido |
| RF-009.04 | Al terminar una ronda que no es la última se muestra su resultado y la siguiente empieza sola a los **20 s**, o antes con **Continuar** del anfitrión | Pedido («continúe la siguiente») + PROPUESTA (20 s) |
| RF-009.05 | **Puntos:** cada victoria suma 1. Gana el equipo → +1 a cada inocente; gana el impostor → +1 al impostor | Pedido («veces que logró ganar») + PROPUESTA (valor 1) |
| RF-009.06 | Tras la última ronda: **podio** con los tres primeros puestos y clasificación completa; empates comparten puesto (1, 1, 3) | Pedido |
| RF-009.07 | Si al empezar una ronda quedan menos de 3 integrantes, la serie termina y se muestra el podio | PROPUESTA |
| RF-009.08 | Reiniciar o «Jugar otra partida» vuelve a la sala de espera y borra la puntuación; se conserva la configuración | Coherente con RF-008 |
| RF-009.09 | Nadie se une durante la serie (también entre rondas) | RF-001 vigente |

**Contrato:** `POST /api/create` acepta `settings: { rounds, turnSeconds, voteSeconds }`; acciones `settings` (anfitrión, `lobby`) y `nextGame` (anfitrión, `finished` con rondas pendientes). DTO: `settings`, `series: { current, total, complete, scores: [{ name, points, rank, isMe }] }`, `players[].points`, `result.hasNextRound`.

```gherkin
Escenario: Configurar al crear
  Cuando Ana crea una sala con 3 rondas, 30 s por turno y 90 s de votación
  Entonces la sala de espera muestra esa configuración a todos
  Y el primer turno de pistas dura 30 s y la votación 90 s

Escenario: Encadenar rondas
  Dado una serie de 2 rondas
  Cuando termina la ronda 1
  Entonces todos ven el resultado de la ronda 1 de 2 y la cuenta atrás de 20 s
  Y al pulsar "Continuar" el anfitrión, empieza la ronda 2 con carta nueva

Escenario: Puntuación y podio
  Dado que el equipo ganó la ronda 1 y el impostor la ronda 2
  Cuando termina la ronda 2
  Entonces cada jugador tiene los puntos de sus victorias
  Y se muestra el podio con los primeros puestos y los empates compartidos

Escenario: Configuración inválida
  Cuando el anfitrión envía 7 s por turno
  Entonces recibe 400 "INVALID_SETTINGS"
```

## 03. Restricciones

Valores solo de las listas cerradas; reglas en servidor; documentos antiguos sin `settings` usan los valores por defecto.

## 04. No-Objetivos

Puntuación ponderada (por ejemplo, más puntos al impostor), historial entre series, configurar debate o tiempo de carta.

## 05. Decisiones abiertas

| ID | Tema | Aplicado | Estado |
|---|---|---|---|
| D-31 | Pausa entre rondas | 20 s automáticos + «Continuar» | PENDIENTE de confirmar |
| D-32 | Valor de cada victoria | 1 punto a cada ganador | PENDIENTE de confirmar |
| D-33 | Cuándo se configura | Al crear y en la sala de espera | PENDIENTE de confirmar (supuesto) |
