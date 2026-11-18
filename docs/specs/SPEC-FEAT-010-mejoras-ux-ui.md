# SPEC-FEAT-010 — Mejoras de UX/UI: carta, iconos, mesa y turno

> **Proyecto:** Farsante Scrum · **Versión:** 0.1.0 · **Estado:** APROBADA — G3 (APR-022)
>
> **Origen:** pedido del 2026-11-18 16:37 (mejoras 1 y 2) · **ADR:** 0005 (extendido)

## 01. Intención

Hacer el juego más claro y atractivo: una carta que se sienta como un naipe, iconos que ayuden a escanear la pantalla y saber en todo momento quién tiene el turno.

## 02. Comportamiento

| ID | Requisito |
|---|---|
| RF-010.01 | Carta secreta con diseño de naipe: reverso estampado y cara marfil con la palabra en serif; se voltea en 3D al pulsar «Ver mi carta». Con «reducir movimiento», cambio sin giro. La palabra sigue fuera del DOM mientras la carta está oculta (RF-003.05) |
| RF-010.02 | Iconos SVG propios junto a fases, acciones e insignias; siempre con texto (`aria-hidden` en el icono) |
| RF-010.03 | Participantes con avatar de iniciales y color estable por nombre |
| RF-010.04 | **Panel de mesa** durante la partida: todos los jugadores con estado de turno en la vuelta actual — «En turno», «Pista dada», «Sin pista», «Esperando» — y sus puntos de la serie |
| RF-010.05 | Barra de fase con icono, «Ronda X de N», vuelta (si es mayor que 1) y tiempo |
| RF-010.06 | Podio con subida animada (un solo momento) y clasificación completa |
| RF-010.07 | Sin regresiones: textos y nombres accesibles de botones existentes se conservan; contraste ≥ 4,5:1 en texto |

```gherkin
Escenario: Saber quién tiene el turno
  Dado la ronda de pistas con Luis en turno
  Entonces todos ven a Luis marcado "En turno" en el panel de la mesa
  Y quienes ya enviaron su pista aparecen como "Pista dada"

Escenario: Carta con giro
  Cuando un jugador pulsa "Ver mi carta"
  Entonces la carta se voltea y muestra su palabra o "Eres el impostor"
  Y al pulsar "Ocultar mi carta" el contenido sale del DOM
```

## 03. Restricciones

Sin dependencias ni fuentes externas (D-21); CSP sin cambios; movimiento solo como respuesta a acciones y en el podio.

## 04. No-Objetivos

Tema claro, sonidos, personalización de avatares.
