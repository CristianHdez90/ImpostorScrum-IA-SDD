# Backlog MVP priorizado — Farsante Scrum

> **Versión:** 0.1.0 · **Estado:** BORRADOR G1 — orden **propuesto**, pendiente de aprobación del responsable de producto (D-01).
>
> Estados de cada ítem: **CONFIRMADO** (requisito acordado en los prompts), **HIPÓTESIS**, **PENDIENTE DE DECISIÓN**.

## 1. Épicas y orden de entrega propuesto

| Orden | Épica / SPEC | RF | Valor | Dependencias | Estado |
|---|---|---|---|---|---|
| 1 | [SPEC-FEAT-001](../specs/SPEC-FEAT-001-salas-e-invitaciones.md) Salas e invitaciones | RF-001, parte de RF-009 | Sin sala no hay juego; valida stack, Redis y sesión de extremo a extremo | ADR-0001…0005; decisiones resueltas en APR-005…APR-009 | CONFIRMADO |
| 2 | [SPEC-FEAT-002](../specs/SPEC-FEAT-002-grupos-de-palabras.md) Grupos de palabras | RF-002 | Configuración previa al juego | 001 | CONFIRMADO |
| 3 | [SPEC-FEAT-003](../specs/SPEC-FEAT-003-inicio-y-roles.md) Inicio y roles | RF-003 | Núcleo del secreto | 001, 002 | CONFIRMADO |
| 4 | [SPEC-FEAT-004](../specs/SPEC-FEAT-004-pistas-y-turnos.md) Pistas y turnos | RF-004 | Mecánica principal | 003 | CONFIRMADO |
| 5 | [SPEC-FEAT-005](../specs/SPEC-FEAT-005-debate-y-votacion.md) Debate y votación | RF-005 | Decisión colectiva | 004 | CONFIRMADO |
| 6 | [SPEC-FEAT-006](../specs/SPEC-FEAT-006-resultados-y-reflexiones.md) Resultados y reflexiones | RF-006, RF-007 | Cierre y conversación | 005 | CONFIRMADO |
| 7 | [SPEC-FEAT-007](../specs/SPEC-FEAT-007-reinicio-salida-y-sesion.md) Reinicio, salida y sesión | RF-008, RF-009 | Control del facilitador y recuperación | 001, 003 | CONFIRMADO |
| 8 | [SPEC-FEAT-008](../specs/SPEC-FEAT-008-persistencia-y-sincronizacion.md) Persistencia y sincronización robustas | Requisitos técnicos | Funcionamiento multiinstancia, vencimientos, `/health`, límites | 001 (base), 003–006 | CONFIRMADO |

**Nota de diseño:** SPEC-FEAT-001 construye la base mínima de almacenamiento (memoria y Redis con escritura atómica), sesión y sincronización necesaria para el lobby. SPEC-FEAT-008 la extiende a vencimientos de fase, recuperación tras inactividad, `/health`, limitación de solicitudes y presupuesto.

## 2. Historias de usuario

| ID | Historia | SPEC | Prioridad | Estado |
|---|---|---|---|---|
| HU-001 | Como anfitrión, quiero crear una sala privada con código de cinco letras para invitar a mi equipo | 001 | P1 | CONFIRMADO |
| HU-002 | Como participante, quiero unirme con código, enlace o QR sin registrarme | 001 | P1 | CONFIRMADO |
| HU-003 | Como integrante, quiero ver quién está en la sala, quién es anfitrión y quién está conectado | 001 | P1 | CONFIRMADO |
| HU-004 | Como integrante, quiero recuperar mi lugar al recargar el navegador | 001 / 007 | P1 | CONFIRMADO |
| HU-005 | Como anfitrión, quiero elegir, editar y guardar el grupo de palabras sin perder mi borrador | 002 | P1 | CONFIRMADO |
| HU-006 | Como anfitrión, quiero iniciar solo cuando haya al menos tres participantes conectados | 003 | P1 | CONFIRMADO (D-29) |
| HU-007 | Como jugador, quiero ver solo mi carta y confirmar que estoy listo | 003 | P1 | CONFIRMADO |
| HU-008 | Como jugador en turno, quiero dar una palabra o frase de hasta 160 caracteres | 004 | P1 | CONFIRMADO |
| HU-009 | Como anfitrión, quiero saltar un turno | 004 | P2 | CONFIRMADO |
| HU-010 | Como jugador, quiero debatir y votar en secreto una vez | 005 | P1 | CONFIRMADO |
| HU-011 | Como equipo, quiero conocer el resultado y al verdadero impostor | 006 | P1 | CONFIRMADO |
| HU-012 | Como impostor descubierto, quiero adivinar la palabra para intentar ganar | 006 | P1 | CONFIRMADO |
| HU-013 | Como equipo, quiero una reflexión Scrum al finalizar | 006 | P1 | CONFIRMADO |
| HU-014 | Como anfitrión, quiero reiniciar la partida en cualquier fase activa | 007 | P1 | CONFIRMADO |
| HU-015 | Como integrante, quiero salir en lobby o al finalizar; si salgo como anfitrión, otro toma el control | 007 | P2 | CONFIRMADO |
| HU-016 | Como integrante, quiero saber cuándo se pierde la conexión y que se recupere sola | 008 | P1 | CONFIRMADO |
| HU-017 | Como responsable, quiero que la sala funcione entre instancias de Vercel y expire tras 6 h sin actividad | 008 | P1 | CONFIRMADO |
| HU-018 | Como responsable, quiero `/health` para comprobar Redis | 008 | P2 | CONFIRMADO |

## 3. Fuera del MVP o pendientes

| ID | Ítem | Estado |
|---|---|---|
| HU-X01 | Observador eliminado | PENDIENTE DE DECISIÓN (D-22) — propuesta: excluir |
| HU-X02 | Modo «tiempo ampliado» por accesibilidad | PENDIENTE DE DECISIÓN (D-14) — candidata SPEC-FEAT-009 |
| HU-X03 | Reflexiones específicas para Comida, Música y Tecnología | HIPÓTESIS — ampliación opcional, no solicitada |
| HU-X04 | Métricas agregadas de finalización | HIPÓTESIS (OBJ-001) — requiere SPEC y privacidad |
| HU-X05 | Salida unilateral durante una partida activa | Fuera de alcance acordado (requiere SPEC que resuelva sus efectos) |
| HU-X06 | Transferencia de anfitrión por desconexión en partida | PENDIENTE DE DECISIÓN (D-16) — propuesta: fuera del MVP |

## 4. Definition of Ready por historia

SPEC con las cuatro secciones, criterios BDD, datos/contratos, estados UX, fallos, riesgos, plan de pruebas, decisiones bloqueantes resueltas y registro G3 en [approvals.md](../governance/approvals.md).
