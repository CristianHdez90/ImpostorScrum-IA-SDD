# Propuesta de adopción de la Constitución — Farsante Scrum

> **Versión de la propuesta:** 0.1.0 · **Estado:** **APROBADA** — ratificación sin enmiendas (APR-002) y adopción de `AGENTS.md` (APR-003), 2026-11-18. Pendiente: nombre del responsable y bloque *Ratificación* del archivo normativo.
>
> **Documento normativo:** [`CONSTITUTION.md`](CONSTITUTION.md) versión 1.0.0, **BORRADOR — no ratificada**. Este archivo **no modifica** el texto del kit; propone cómo completar sus campos y cómo aplicarlo a este proyecto.

## 1. Qué se propone ratificar

1. **Texto:** la Constitución 1.0.0 del kit, **sin enmiendas** (PROPUESTA). No se detectaron conflictos entre sus artículos y los requisitos del juego que obliguen a enmendarla.
2. **Campos a completar en el acto de ratificación** (no se rellenan aquí para no simular aprobación):

| Campo de `CONSTITUTION.md` | Valor propuesto | Estado |
|---|---|---|
| Proyecto | Farsante Scrum | PROPUESTA |
| Responsable | `[PENDIENTE — D-01]` | PENDIENTE |
| Fecha de adopción | `[Fecha real de la decisión]` | PENDIENTE |
| Ámbito | Proyecto nuevo (greenfield), desde carpeta sin código hasta operación en Vercel | PROPUESTA |
| Tabla de aprobadores (Art. XIII) | Ver §3 | PENDIENTE |

3. **Procedimiento propuesto:** el responsable registra la decisión en [approvals.md](approvals.md) (persona, fecha, versión, referencia) y, en el mismo cambio, completa los campos de la tabla *Ratificación* de `CONSTITUTION.md`. Esa edición del archivo normativo debe hacerla o autorizarla expresamente el responsable; el agente no la realizará por iniciativa propia.

## 2. Aplicación de los trece artículos a Farsante Scrum

| Artículo | Aplicación concreta | Evidencia en este paquete |
|---|---|---|
| I. Problema y valor | Cada capacidad se liga a una historia y a un objetivo OBJ por validar | [vision.md](../product/vision.md), [mvp-backlog.md](../product/mvp-backlog.md) |
| II. SDD | Una SPEC por capacidad (SPEC-FEAT-001…008) con las cuatro secciones obligatorias | [docs/specs/](../specs/) |
| III. Arquitectura | Stack de referencia sometido a ADR; sin frameworks ni capas ceremoniales | [ADR-0001](../adr/ADR-0001-stack-y-arquitectura.md), [architecture.md](../architecture/architecture.md) |
| IV. Seguridad y privacidad | Autorización en servidor, proyección por jugador, secretos solo en servidor, minimización de nombres | [threat-model.md](../security/threat-model.md), [ADR-0004](../adr/ADR-0004-sesion-y-credenciales.md) |
| V. Calidad | QA desde requisitos, matriz de riesgos, Redis simulado ≠ Upstash real | [strategy.md](../qa/strategy.md), [traceability.md](../qa/traceability.md) |
| VI. UX y accesibilidad | Catálogo de estados, objetivo WCAG 2.2 AA con matriz y tratamiento de límites de tiempo | [flows-and-states.md](../ux/flows-and-states.md), [accessibility.md](../ux/accessibility.md) |
| VII. Datos | Redis como fuente de verdad, TTL de 6 h, `schemaVersion`, sin datos productivos en pruebas | [data-model.md](../architecture/data-model.md), [ADR-0002](../adr/ADR-0002-redis-concurrencia-y-ttl.md) |
| VIII. Operación | `/health`, logs sin secretos, runbook y rollback | [runbook.md](../operations/runbook.md), [deployment-and-rollback.md](../operations/deployment-and-rollback.md) |
| IX. Entrega | CI propuesto; implementación, PR, merge, migración y release son permisos separados | [deployment-and-rollback.md](../operations/deployment-and-rollback.md) |
| X. Documentación | README tras elegir stack; trazabilidad con IDs estables | [traceability.md](../qa/traceability.md) |
| XI. Disciplina de cambios | Alcance de archivos explícito por SPEC; deuda registrada, no corregida por iniciativa | Sección *Archivos futuros* de cada SPEC |
| XII. Límites LLM | Etiquetas HECHO/REQUISITO/PROPUESTA/SUPUESTO/PENDIENTE; ninguna prueba declarada sin ejecución | Todo el paquete |
| XIII. Conflictos | Discrepancias entre los dos prompts registradas como decisiones (D-29, D-30) en lugar de resolverse en silencio | [open-decisions.md](open-decisions.md) |

## 3. Roles de aprobación (Art. XIII) — a designar

| Decisión | Aprobador | Estado |
|---|---|---|
| Ratificar Constitución | `[PENDIENTE — D-01]` | PENDIENTE |
| Aprobar SPEC de funcionalidad | `[PENDIENTE — D-01]` | PENDIENTE |
| Aprobar ADR de alto impacto | `[PENDIENTE — D-02]` | PENDIENTE |
| Autorizar implementación (G3) | `[PENDIENTE]` | PENDIENTE |
| Autorizar migración productiva | `[PENDIENTE — D-02]` | PENDIENTE |
| Aprobar PR / merge | `[PENDIENTE — D-02]` | PENDIENTE |
| Autorizar release productivo | `[PENDIENTE — D-02]` | PENDIENTE |

Una misma persona puede ocupar varios roles; las decisiones deben registrarse por separado en [approvals.md](approvals.md).

## 4. `AGENTS.md`

El archivo `AGENTS.md` del kit quedó en la raíz al extraer el zip, por instrucción explícita del usuario. Su **adopción formal** como instrucciones del repositorio se propone junto con la ratificación (D-04). Hasta entonces se usa como referencia operativa coherente con la sesión, sin que conceda permisos.

## 5. Adaptaciones propuestas del proceso (sin modificar SPEC-DEV-000)

- **Sin AS-IS:** greenfield; no se describe deuda ni migraciones históricas.
- **Simplificación documental:** el responsable puede fusionar documentos (por ejemplo `runbook.md` con `deployment-and-rollback.md`) sin perder decisiones ni trazabilidad. No se ha simplificado nada todavía.
- **Rama aislada en G4:** requiere que exista un repositorio Git (D-05). Si no se crea, G4 no puede cumplir el Artículo IX.
