# ADR-0005 — Sistema visual, accesibilidad y límites de tiempo

> **Estado:** APROBADO para el alcance de SPEC-FEAT-001 (APR-010, 2026-11-18); PROPUESTO para el resto · **Fecha:** 2026-11-18 · **Aprobador:** `[PENDIENTE — D-01/D-02]` · **Decisiones relacionadas:** D-14, D-21

## Contexto

Objetivo WCAG 2.2 AA (Constitución, Art. VI). Interfaz en tema oscuro según la referencia del maestro (`#101321`, `#f5f4ff`, menta y violeta). El juego tiene plazos de 45–90 s que afectan al criterio 2.2.1.

## Decisión propuesta

1. **Tokens semánticos** en variables CSS ([design-system.md](../ux/design-system.md)); componentes nativos HTML antes que roles ARIA personalizados.
2. **Tipografía del sistema** (sin fuentes remotas): sin solicitudes a terceros, sin dependencia de red y sin licencias adicionales (D-21).
3. **Actualización localizada del DOM** y una única región `role="status"`; foco al encabezado al cambiar de fase ([accessibility.md](../ux/accessibility.md)).
4. **Contenido de texto siempre con `textContent`**/APIs de texto; nunca `innerHTML` con datos de usuario (también es control de XSS).
5. **Objetivos táctiles de 44×44 CSS px** como decisión de diseño.
6. **Tiempo:** no declarar conformidad AA hasta resolver D-14. Propuesta: SPEC-FEAT-009 «Tiempo ampliado» (×2, activable por el anfitrión en lobby).
7. `prefers-reduced-motion` respetado; sin destellos.

## Alternativas descartadas

Librería de componentes o framework CSS: dependencias y peso sin necesidad demostrada (ADR-0001). Tema claro adicional: posible ampliación posterior.

## Consecuencias

- (+) Contraste teórico de los tokens ≥ 4,5:1 para texto y ≥ 3:1 para bordes y foco (cálculo de esta sesión; medir en G5).
- (−) Riesgo abierto sobre 2.2.1 hasta la decisión D-14.
