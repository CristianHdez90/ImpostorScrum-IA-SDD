# Registro de aprobaciones — Farsante Scrum

> **Regla:** solo se registra una decisión humana identificable (persona, fecha, alcance y referencia verificable). El silencio, el paso del tiempo o un documento redactado por el agente **no** constituyen aprobación (Constitución, Art. II y XII).
>
> **Estado al 2026-11-18 11:42:** Constitución ratificada; **G3 autorizado para SPEC-FEAT-001 v0.2.0** (APR-015). **Sin** autorización de merge, migración, Upstash real, Vercel ni despliegue.
>
> **Aprobador:** CristianDev, responsable de producto y técnico (APR-001).

## Decisiones registradas

| ID | Fecha | Decisión | Documento y versión | Alcance (archivos, criterios) | Aprobador | Referencia |
|---|---|---|---|---|---|---|
| APR-001 | 2026-11-18 | Designa responsables: el usuario es responsable de producto y técnico (D-01, D-02) | [project-charter.md](project-charter.md) 0.1.0 | Todos los roles de la tabla del Art. XIII (con registros separados) | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:38 (America/Bogota), punto 1 |
| APR-002 | 2026-11-18 | **Ratifica** la Constitución 1.0.0 **sin enmiendas** (D-03) | [CONSTITUTION.md](CONSTITUTION.md) 1.0.0 | Proyecto Farsante Scrum | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:38 (America/Bogota), punto 2 |
| APR-003 | 2026-11-18 | Adopta `AGENTS.md` del kit sin cambios (D-04) | [`AGENTS.md`](../../AGENTS.md) | Raíz del proyecto | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:38 (America/Bogota), punto 2 |
| APR-004 | 2026-11-18 | No crear repositorio ni rama ahora; el responsable los creará después (D-05) | [deployment-and-rollback.md](../operations/deployment-and-rollback.md) | El agente no ejecuta `git init` ni crea ramas | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:38 (America/Bogota), punto 3 |
| APR-005 | 2026-11-18 | Sesión en cookie `HttpOnly` (D-08) | [ADR-0004](../adr/ADR-0004-sesion-y-credenciales.md) | Mecanismo de sesión | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:38 (America/Bogota), punto 4 |
| APR-006 | 2026-11-18 | Alfabeto del código sin I ni O (D-09) | [SPEC-FEAT-001](../specs/SPEC-FEAT-001-salas-e-invitaciones.md) | `ABCDEFGHJKLMNPQRSTUVWXYZ` | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:38 (America/Bogota), punto 5 |
| APR-007 | 2026-11-18 | Nombres iguales si solo difieren en mayúsculas o acentos (D-10); caracteres contados como grafemas, un emoji = 1 (D-11) | SPEC-FEAT-001 | Nombres, pistas y palabras | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:38 (America/Bogota), punto 6 |
| APR-008 | 2026-11-18 | SPEC-001 crea el catálogo de los cuatro grupos (solo datos) (D-23) | SPEC-FEAT-001 | `public/word-themes.js` | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:38 (America/Bogota), punto 7 |
| APR-009 | 2026-11-18 | Inicio exige ≥ 3 integrantes **y** todos conectados (D-29) | [SPEC-FEAT-003](../specs/SPEC-FEAT-003-inicio-y-roles.md) | Condición de `start` | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:38 (America/Bogota), punto 7 |

| APR-010 | 2026-11-18 | Aprueba ADR-0001…ADR-0005 **para el alcance de SPEC-FEAT-001**: JS puro sin framework, `fetch` nativo sin SDK de Upstash, CAS con script Lua corto, polling ~1,5 s en Vercel y SSE en local, tokens de color y tipografía del sistema | [docs/adr/](../adr/) | SPEC-FEAT-001 | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:46 (America/Bogota), punto 2 |
| APR-011 | 2026-11-18 | Herramientas: Playwright para Node + `jsqr` (D-18) y ESLint (D-19) como dependencias de desarrollo | [strategy.md](../qa/strategy.md) | Pruebas y lint | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:46 (America/Bogota), punto 3 |
| APR-012 | 2026-11-18 | RF-001.21: invitación de otra sala muestra el formulario con «Ya estás en la sala X», sin mezclar identidades; resto en SPEC-007 | SPEC-FEAT-001 0.2.0 | RF-001.21 | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:46 (America/Bogota), punto 4 |
| APR-013 | 2026-11-18 | Autoriza al agente a completar el bloque *Ratificación* de `CONSTITUTION.md` | [CONSTITUTION.md](CONSTITUTION.md) | Solo ese bloque y los campos de cabecera (proyecto, responsable, fecha, estado) | CristianDev | mensaje del usuario en esta sesión, 2026-11-18 10:46 (America/Bogota), punto 1 — ejecutado tras recibir el nombre (11:42) |

| APR-016 | 2026-11-18 | **Autorización G3** de SPEC-FEAT-003 v0.2.0 **con el reinicio mínimo** (RF-008.01–.06): archivos de §07 de esa SPEC, criterios CA-01…CA-12, sin dependencias nuevas; ADR-0001…0005 extendidos a este alcance. **Fuera:** Upstash real, Vercel, merge y despliegue | [SPEC-FEAT-003](../specs/SPEC-FEAT-003-inicio-y-roles.md) 0.2.0 | §07 de la SPEC | CristianDev | respuesta de CristianDev en esta sesión, 2026-11-18 12:16–12:20 (America/Bogota) |
| APR-017 | 2026-11-18 | D-15: reiniciar exige confirmación en un paso dentro de la página | SPEC-FEAT-003 / SPEC-FEAT-007 | Reinicio | CristianDev | respuesta de CristianDev en esta sesión, 2026-11-18 12:16–12:20 (America/Bogota) |

| APR-018 | 2026-11-18 | **Autorización G3** del resto del MVP: «implementa todo el proyecto completo». Abarca SPEC-FEAT-002, 004, 005, 006, 007 (resto) y 008 en sus versiones 0.1.0, con los archivos de §06 de cada SPEC y las pruebas asociadas, sin dependencias nuevas; ADR-0001…0005 extendidos a este alcance. Las decisiones abiertas (D-12, D-13, D-16, D-17, D-20, D-22, D-25, D-27, D-30) se aplican **según la propuesta documentada** y quedan **pendientes de confirmación**. **Fuera:** Upstash real, Vercel, merge y despliegue | SPECS 002, 004–008 | §06 de cada SPEC | CristianDev | mensaje de CristianDev, 2026-11-18 12:32 (America/Bogota) |

| APR-019 | 2026-11-18 | Validación contra **Upstash real** (T-016) con `scripts/validate-upstash.js`: 9/9 comprobaciones (PING, creación condicional, TTL 21 600 s, CAS, contador, borrado condicional, último cupo entre dos instancias, 8 entradas simultáneas sin pérdidas con 11 conflictos CAS resueltos, limpieza de 8 claves) | [ADR-0002](../adr/ADR-0002-redis-concurrencia-y-ttl.md) | Base Upstash del proyecto, prefijo aislado | CristianDev | ejecutado por CristianDev el 2026-11-18 15:49 (America/Bogota) con `npm run validate:upstash` contra `up-dragon-176459.upstash.io`, prefijo `farsante:pruebas:validacion-af51e155` |

**No constituye aprobación:** la confirmación de las decisiones aplicadas por propuesta en APR-018 ni el despliegue en Vercel (G6), las demás SPECS ni la autorización G3. 
| APR-014 | 2026-11-18 | Autoriza construir **en la carpeta, sin Git** (opción B de D-05). Consecuencia aceptada: sin rama, commits ni PR; el diff se presenta como inventario de archivos hasta que exista repositorio | [project-charter.md](project-charter.md) | G4 de SPEC-FEAT-001 | CristianDev | mensaje de CristianDev en esta sesión, 2026-11-18 11:42 (America/Bogota) |
| APR-015 | 2026-11-18 | **Autorización G3** de SPEC-FEAT-001 v0.2.0: archivos de §07 **incluido** `.github/workflows/ci.yml`; criterios CA-01…CA-17; instalar con `npm` las dependencias aprobadas (`qrcode-generator`, `@playwright/test`, `jsqr`, `eslint`). **Fuera:** Upstash real, Vercel, merge y despliegue | [SPEC-FEAT-001](../specs/SPEC-FEAT-001-salas-e-invitaciones.md) 0.2.0 | §07 de la SPEC | CristianDev | mensaje de CristianDev en esta sesión, 2026-11-18 11:42 (America/Bogota) |

## Decisiones esperadas (orden sugerido)

| Orden | Gate | Decisión | Documento | Bloquea |
|---|---|---|---|---|
| 1 | G0 | Designar responsables (D-01, D-02) | [project-charter.md](project-charter.md) | Todo lo demás |
| 2 | G0 | Ratificar Constitución 1.0.0 y adoptar `AGENTS.md` (D-03, D-04) | [constitution-proposal.md](constitution-proposal.md) | G4 |
| 3 | G0 | Repositorio Git y política de ramas (D-05) | [deployment-and-rollback.md](../operations/deployment-and-rollback.md) | G4 en rama aislada |
| 4 | G1 | Aceptar visión, objetivos y backlog MVP (D-06) | [vision.md](../product/vision.md), [mvp-backlog.md](../product/mvp-backlog.md) | Priorización |
| 5 | G2 | Aprobar ADR-0001…0005 (o con cambios) | [docs/adr/](../adr/) | SPEC-FEAT-001 en G3 |
| 6 | G2 | Resolver decisiones que bloquean SPEC-FEAT-001 (D-08…D-11, D-23, D-29) | [open-decisions.md](open-decisions.md) | G3 de SPEC-FEAT-001 |
| 7 | G3 | Autorizar SPEC-FEAT-001 con alcance de archivos | [SPEC-FEAT-001](../specs/SPEC-FEAT-001-salas-e-invitaciones.md) §06 | G4 |
| — | G6 | Merge, migración y despliegue: **autorizaciones independientes** | — | Producción |

## Plantilla de registro

```text
ID: APR-NNN
Fecha: AAAA-MM-DD
Aprobador: <nombre y rol>
Decisión: <ratifica / aprueba / autoriza / rechaza / aprueba con cambios>
Documento: <ruta> versión <x.y.z>
Alcance: <archivos, paquetes, criterios CA incluidos y excluidos>
Condiciones: <restricciones, fecha límite, dependencias>
Referencia: <enlace a mensaje, PR, acta o firma>
```
