# ADR-0001 — Stack y arquitectura proporcional

> **Estado:** APROBADO para el alcance de SPEC-FEAT-001 (APR-010, 2026-11-18); PROPUESTO para el resto · **Fecha:** 2026-11-18 · **Aprobador:** `[PENDIENTE — D-02]` · **Revisar:** al superar el MVP o si cambian carga/presupuesto (D-07)

## Contexto

Juego web de 3–12 jugadores por sala, sin cuentas, con estado efímero compartido, desplegado en Vercel. Requisitos acordados: HTML/CSS/JS puro, Node.js, Vercel, Upstash Redis REST, `qrcode-generator`, modo local con memoria y SSE. La Constitución no impone tecnologías (Art. III); este ADR evalúa si el stack de referencia es proporcional.

## Criterios

Simplicidad y número de dependencias; adecuación a funciones efímeras (sin conexiones persistentes); facilidad de probar reglas con reloj inyectado; accesibilidad y control del DOM; costo operativo; experiencia del equipo (`[PENDIENTE]`).

## Opciones

| Opción | Ventajas | Limitaciones |
|---|---|---|
| **A. JS puro + Node sin framework + Vercel Functions + Upstash REST** (referencia) | Mínimas dependencias; reglas en módulos puros; Upstash REST encaja en funciones sin conexión TCP persistente; control total del DOM para actualización localizada | Renderizado y enrutado manuales; disciplina necesaria para no mezclar red, reglas y DOM |
| B. React/Next.js + Vercel KV/Upstash | Ecosistema, componentes | Dependencias y build mayores sin necesidad demostrada; contradice el requisito acordado |
| C. Servidor con WebSockets persistente (p. ej. Node en otro proveedor) | Tiempo real | Otro proveedor y operación; fuera de lo acordado |
| D. TypeScript sobre la opción A | Tipos | Paso de compilación adicional; puede evaluarse más adelante con ADR propio |

## Decisión propuesta

**Opción A.** Sin React, Next.js, Express ni otro framework. Módulos según [architecture.md](../architecture/architecture.md). Dependencias propuestas:

| Paquete | Tipo | Motivo | Estado |
|---|---|---|---|
| `qrcode-generator` | producción (copiado a `public/vendor` en build) | QR local, requisito acordado | Revisar versión, licencia (MIT según su repositorio; **verificar** en G4) y avisos |
| `@upstash/redis` **o** `fetch` nativo | — | Cliente REST | **Propuesta: `fetch` nativo** (sin dependencia); el SDK es alternativa si simplifica EVALSHA |
| `@playwright/test`, `jsqr` | desarrollo | E2E y decodificación de QR | D-18 |
| `eslint` | desarrollo | Lint | D-19 |

Pruebas unitarias e integración con `node:test` (sin dependencia).

**Node.js:** fijar la mayor LTS disponible en Vercel en el momento de G4 mediante `engines` en `package.json`. Consultado el 2026-11-18: la [documentación de Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) lista 24.x (predeterminada), 22.x y 20.x; volver a verificar antes de G4/G6.

## Consecuencias

- (+) Pocas piezas, auditables; reglas testeables sin red.
- (−) Más código de UI manual; riesgo de `app.js` monolítico → dividir por pantalla si supera un tamaño razonable (criterio en SPEC-001).
- Requiere ADR nuevo para introducir framework, TypeScript, colas o schedulers.
