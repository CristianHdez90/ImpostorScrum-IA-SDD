# Paquete documental G0–G2 — Farsante Scrum

> **Fecha:** 2026-11-18 · **Modalidad:** GREENFIELD · **Estado:** listo para revisión; **ningún gate cumplido**, **ninguna aprobación registrada**, **ninguna prueba ejecutada**, **sin código ni dependencias ni infraestructura**.

## Orden de lectura sugerido

1. [Ficha del proyecto](governance/project-charter.md) y [decisiones pendientes](governance/open-decisions.md)
2. [Propuesta de adopción de la Constitución](governance/constitution-proposal.md) · [Registro de aprobaciones](governance/approvals.md)
3. [SPEC-FEAT-001 — Crear sala y unirse](specs/SPEC-FEAT-001-salas-e-invitaciones.md) (primera candidata a G3)
4. ADR [0001](adr/ADR-0001-stack-y-arquitectura.md) · [0002](adr/ADR-0002-redis-concurrencia-y-ttl.md) · [0003](adr/ADR-0003-sincronizacion.md) · [0004](adr/ADR-0004-sesion-y-credenciales.md) · [0005](adr/ADR-0005-sistema-visual-y-accesibilidad.md)

## Inventario

| Área | Documentos |
|---|---|
| Gobernanza (kit, sin modificar) | [CONSTITUTION.md](governance/CONSTITUTION.md) 1.0.0 BORRADOR · [SPEC-DEV-000](specs/SPEC-DEV-000-especificacion-maestra-desarrollo-software.md) 2.0.0 PROPUESTA · [SPEC-FEAT-TEMPLATE](specs/SPEC-FEAT-TEMPLATE.md) · [`AGENTS.md`](../AGENTS.md) |
| Gobernanza (nuevos) | [project-charter](governance/project-charter.md) · [constitution-proposal](governance/constitution-proposal.md) · [approvals](governance/approvals.md) · [open-decisions](governance/open-decisions.md) |
| Producto | [vision](product/vision.md) · [personas-and-journeys](product/personas-and-journeys.md) · [mvp-backlog](product/mvp-backlog.md) |
| UX/UI | [flows-and-states](ux/flows-and-states.md) · [design-system](ux/design-system.md) · [accessibility](ux/accessibility.md) |
| Arquitectura | [architecture](architecture/architecture.md) (C4, módulos, máquina de estados) · [data-model](architecture/data-model.md) · [api-contracts](architecture/api-contracts.md) |
| Seguridad | [threat-model](security/threat-model.md) (amenazas, datos personales, secretos) |
| QA | [strategy](qa/strategy.md) · [risk-matrix](qa/risk-matrix.md) · [traceability](qa/traceability.md) |
| SPECS | [001](specs/SPEC-FEAT-001-salas-e-invitaciones.md) · [002](specs/SPEC-FEAT-002-grupos-de-palabras.md) · [003](specs/SPEC-FEAT-003-inicio-y-roles.md) · [004](specs/SPEC-FEAT-004-pistas-y-turnos.md) · [005](specs/SPEC-FEAT-005-debate-y-votacion.md) · [006](specs/SPEC-FEAT-006-resultados-y-reflexiones.md) · [007](specs/SPEC-FEAT-007-reinicio-salida-y-sesion.md) · [008](specs/SPEC-FEAT-008-persistencia-y-sincronizacion.md) |
| Operación | [deployment-and-rollback](operations/deployment-and-rollback.md) (CI/CD) · [runbook](operations/runbook.md) |

## Fuentes de requisitos

`PROMPT-MAESTRO-FARSANTE-SCRUM-SDD.md` 1.0.0 (referencia detallada) y `PROMPT-IMPLEMENTACION.md` (resumen complementario), en la raíz y sin modificar. Las discrepancias entre ambos se registran como D-29 y D-30.

## Documentación externa consultada (2026-11-18)

Upstash: [EVAL por REST](https://upstash.com/docs/redis/commands/scripting/eval), [Lua y atomicidad](https://upstash.com/blog/lua-scripting-on-upstash-redis-atomic-operations-over-http), [key locking](https://upstash.com/docs/redis/features/key-locking). Vercel: [duración de funciones](https://vercel.com/docs/functions/configuring-functions/duration), [versiones de Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [configuración Git](https://vercel.com/docs/project-configuration/git-configuration). Volver a verificar antes de G4/G6.
