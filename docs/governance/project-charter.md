# Ficha del proyecto — Farsante Scrum

> **Versión:** 0.1.0 · **Estado:** BORRADOR para revisión G0 · **Fecha de redacción:** 2026-11-18
>
> **Gobernanza:** [Constitución 1.0.0 (BORRADOR, no ratificada)](CONSTITUTION.md) · [Propuesta de adopción](constitution-proposal.md) · [Registro de aprobaciones](approvals.md) · [Decisiones pendientes](open-decisions.md)
>
> Este documento **no ratifica** la Constitución ni autoriza implementación.

## Convención de etiquetas

| Etiqueta | Significado |
|---|---|
| **HECHO COMPROBADO** | Verificado en esta sesión con evidencia (comando, archivo, documentación consultada) |
| **REQUISITO ACORDADO** | Regla funcional recibida en `PROMPT-MAESTRO-FARSANTE-SCRUM-SDD.md` o `PROMPT-IMPLEMENTACION.md` |
| **PROPUESTA** | Recomendación del agente; requiere revisión y aprobación |
| **SUPUESTO** | Hipótesis de trabajo sin evidencia; debe confirmarse |
| **PENDIENTE** | Decisión humana necesaria (ver [open-decisions.md](open-decisions.md)) |

## 1. Ficha de sesión

| Campo | Valor | Etiqueta |
|---|---|---|
| Producto | Farsante Scrum | REQUISITO ACORDADO |
| Modalidad | **GREENFIELD** | HECHO COMPROBADO: la carpeta solo contenía `Kit-SDD-Constitucion-Proyecto-Nuevo.zip`, `PROMPT-IMPLEMENTACION.md` y `PROMPT-MAESTRO-FARSANTE-SCRUM-SDD.md` |
| Ruta de trabajo | `C:\ProyectosIA\ProyectoDesdeCeroConKitSDD` | HECHO COMPROBADO |
| Repositorio Git, rama y commit base | **No existe repositorio Git**; lo creará el responsable más adelante (APR-004) | HECHO COMPROBADO (`git status`: *not a git repository*) |
| Kit SDD | Extraído desde el zip con `unzip -n` (sin sobrescritura); 4 archivos: `AGENTS.md`, `docs/governance/CONSTITUTION.md`, `docs/specs/SPEC-DEV-000-…md`, `docs/specs/SPEC-FEAT-TEMPLATE.md` | HECHO COMPROBADO |
| `PROMPT-INICIO-PROYECTO-NUEVO.md` | **No existe** en la carpeta ni dentro del zip; no se creó ni modificó | HECHO COMPROBADO |
| Responsable de producto | CristianDev | APR-001 |
| Responsable técnico, release, datos/operación y revisor | CristianDev | APR-001 |
| Constitución | 1.0.0 — **ratificación aprobada sin enmiendas** (APR-002); el bloque *Ratificación* del archivo aún muestra BORRADOR hasta registrar el nombre | APR-002 |
| SPEC-DEV-000 | 2.0.0, PROPUESTA | HECHO COMPROBADO |
| Gate autorizado en esta sesión | Documentación y diseño G0–G2 | Instrucción del usuario |
| SPEC y alcance G3 | [SPEC-FEAT-001](../specs/SPEC-FEAT-001-salas-e-invitaciones.md) v0.2.0, §07 + CI | APR-015 |
| Stack de referencia | HTML/CSS/JS puro, Node.js, Vercel, Upstash Redis REST, `qrcode-generator` | REQUISITO ACORDADO; se formaliza en [ADR-0001](../adr/ADR-0001-stack-y-arquitectura.md) (PROPUESTO) |
| Idioma de producto y documentación | Español | REQUISITO ACORDADO |
| Uso previsto | Salas privadas de 3–12 participantes, sin registro | REQUISITO ACORDADO |
| Salas simultáneas esperadas | `[PENDIENTE — D-07]`; no se infiere del máximo por sala | PENDIENTE |
| Presupuesto, plazo, soporte y planes de proveedor | `[PENDIENTE — D-07]` | PENDIENTE |
| Objetivos medibles | Propuestas en [vision.md](../product/vision.md); `[PENDIENTE DE ACUERDO — D-06]` | PROPUESTA |

## 2. Ficha de arranque (SPEC-DEV-000 §00)

| Campo | Valor |
|---|---|
| Nombre del producto | Farsante Scrum |
| Problema que resuelve | Facilitar una actividad breve en la que las diferencias de contexto generen conversación útil sobre colaboración, calidad y prácticas del equipo (REQUISITO ACORDADO) |
| Público objetivo | Equipos ágiles y sus facilitadores; 3–12 personas por sala |
| Patrocinador / responsable | `[PENDIENTE — D-01]` |
| Resultado de negocio | `[PENDIENTE — D-06]`; propuestas OBJ-001…OBJ-004 en [vision.md](../product/vision.md) |
| MVP y criterio de éxito | MVP = RF-001…RF-009 ([mvp-backlog.md](../product/mvp-backlog.md)); criterio por acordar |
| Restricciones de entrega | `[PENDIENTE — D-07]` |
| Clasificación de información | Baja sensibilidad: alias/nombres visibles, pistas y votos temporales; credenciales de sesión y de Redis son secretos (ver [threat-model.md](../security/threat-model.md)) |
| Interfaz / canales | Web responsive (móvil y escritorio) |
| Integraciones | Upstash Redis (REST) y Vercel (alojamiento). Sin otras integraciones en el MVP |
| Constitución | BORRADOR hasta aprobación humana G0 |
| Estado del proyecto | **DESCUBRIMIENTO; SIN IMPLEMENTACIÓN** |
| Repositorio y rama | No existe (D-05) |

## 3. Estado de gates (sin evidencia no hay gate cumplido)

| Gate | Estado | Evidencia disponible | Falta |
|---|---|---|---|
| G0 | **Cumplido** | APR-001…APR-003, bloque *Ratificación* completado (APR-013) | — |
| G1 | **Preparado para revisión; NO cumplido** | Visión, recorridos, backlog, riesgos | Revisión del responsable de producto; D-06 |
| G2 | **Preparado para revisión; NO cumplido** | SPECS 001–008, ADR 0001–0005, contratos, UX, QA, amenazas, operación | Revisión y aprobación de ADR y SPECS |
| G3 | **Autorizado para SPEC-FEAT-001 v0.2.0** | APR-015 | Resto de SPECS |
| G4 | **SPEC-FEAT-001 construida** en la carpeta, sin Git (APR-014) | Inventario §07 | Revisión del responsable |
| G5 | **Parcial para SPEC-FEAT-001** | Evidencia en SPEC-001 §08 | Upstash real, lector de pantalla, contraste renderizado |
| G6–G7 | **No iniciados** | — | Autorizaciones independientes |

## 4. Inventario de entregables de esta sesión

Ver [docs/README.md](../README.md).
