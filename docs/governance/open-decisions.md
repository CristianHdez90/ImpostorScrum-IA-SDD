# Decisiones pendientes — Farsante Scrum

> **Estado al 2026-11-18 10:38:** resueltas D-01, D-02, D-03, D-04, D-05 (diferida por el responsable), D-08, D-09, D-10, D-11, D-23 y D-29 — ver [approvals.md](approvals.md). El resto sigue **PENDIENTE**; en esas filas, la columna de propuesta es solo una recomendación.
>
> **Bloquea SPEC-001** = debe resolverse antes de autorizar G3 de [SPEC-FEAT-001](../specs/SPEC-FEAT-001-salas-e-invitaciones.md).

## Gobernanza y producto

| ID | Decisión | Opciones | Propuesta del agente | Bloquea SPEC-001 | Documento |
|---|---|---|---|---|---|
| D-01 — **RESUELTA (APR-001)** | Responsable de producto (aprueba SPECS, ratifica Constitución) | Persona a designar | — | Sí | [charter](project-charter.md) |
| D-02 — **RESUELTA (APR-001)** | Responsable técnico, release, datos/operación y revisor de PR | Una o varias personas | Puede ser la misma persona con registros separados | Sí | [charter](project-charter.md) |
| D-03 — **RESUELTA (APR-002)** | Ratificar Constitución 1.0.0 | Sin enmiendas / con enmiendas | Sin enmiendas | Sí (para G4) | [propuesta](constitution-proposal.md) |
| D-04 — **RESUELTA (APR-003)** | Adoptar `AGENTS.md` del kit en la raíz | Adoptar / adaptar / retirar | Adoptar sin cambios | No | [propuesta](constitution-proposal.md) §4 |
| D-05 — **RESUELTA (APR-004: el responsable creará el repositorio después)** | Repositorio Git, hosting y protección de rama principal | Git local; GitHub/GitLab/otro | `git init` local + remoto con `main` protegida y PR obligatorio | Sí (rama aislada G4) | [despliegue](../operations/deployment-and-rollback.md) |
| D-06 | Objetivos medibles y método de medición | Ver OBJ-001…004 | Medición manual/encuesta opcional, sin analítica identificable | No | [vision.md](../product/vision.md) |
| D-07 | Salas simultáneas esperadas, presupuesto, plazos, planes Vercel/Upstash | — | Estimar con la fórmula de [ADR-0003](../adr/ADR-0003-sincronizacion.md) §Presupuesto | No (sí para G6) | ADR-0003 |
| D-30 | Nombre visible del grupo Scrum: «Scrum» (resumen) o «Scrum y equipo» (maestro) | Cualquiera | «Scrum y equipo» con id `scrum` | No | [SPEC-002](../specs/SPEC-FEAT-002-grupos-de-palabras.md) |

## Reglas de juego por precisar

| ID | Decisión | Opciones | Propuesta del agente | Bloquea SPEC-001 | Documento |
|---|---|---|---|---|---|
| D-09 — **RESUELTA (APR-006)** | Alfabeto del código de sala | A–Z (26⁵ ≈ 11,9 M) / sin I y O (24⁵ ≈ 8,0 M) | Excluir I y O para evitar confusión con 1 y 0 al dictarlo | Sí | [SPEC-001](../specs/SPEC-FEAT-001-salas-e-invitaciones.md) |
| D-10 — **RESUELTA (APR-007)** | Unicidad de nombres | Comparación exacta / sin mayúsculas / sin mayúsculas ni acentos | Sin mayúsculas ni acentos y con espacios colapsados; se conserva la escritura visible | Sí | SPEC-001 |
| D-11 — **RESUELTA (APR-007)** | Unidad de «carácter» para 26, 55 y 160 | Unidades UTF-16 / puntos de código / grafemas | Grafemas con `Intl.Segmenter` en cliente y servidor, con pruebas de emojis y acentos combinados | Sí | SPEC-001, SPEC-004 |
| D-12 | Detección de la palabra secreta en una pista | Coincidencia de secuencia de palabras normalizadas / además plurales simples | Secuencia completa de tokens normalizados; plurales **no** incluidos salvo decisión | No | [SPEC-004](../specs/SPEC-FEAT-004-pistas-y-turnos.md) |
| D-13 | Oráculo: el impostor puede probar candidatos enviando pistas que se rechazan | Aceptar riesgo / límite de rechazos por turno / mensaje genérico | Límite de 3 rechazos por turno (después, solo «Sin pista» al vencer) y mensaje que no confirma cuál palabra coincidió | No | SPEC-004 |
| D-15 — **RESUELTA (APR-017)** | Confirmación al reiniciar una partida activa | Sin confirmación / diálogo de confirmación | Confirmación en un paso con texto del alcance global | No | [SPEC-007](../specs/SPEC-FEAT-007-reinicio-salida-y-sesion.md) |
| D-16 | Anfitrión desconectado durante una partida | Sin cambio / transferir tras N s | Sin cambio en MVP: los plazos avanzan solos; documentar limitación | No | SPEC-007 |
| D-17 | Palabras personalizadas inválidas | Rechazar la lista / descartar entradas inválidas con aviso | Rechazar la lista indicando las entradas inválidas | No | SPEC-002 |
| D-22 | «Observador eliminado» | Incluir / excluir | Excluir: con las reglas acordadas nadie queda eliminado y continúa la partida | No | [mvp-backlog.md](../product/mvp-backlog.md) |
| D-23 — **RESUELTA (APR-008)** | ¿El catálogo de los cuatro grupos se crea en SPEC-001? | Sí (solo datos) / no (SPEC-002) | Sí: SPEC-001 guarda el grupo Scrum por defecto desde el catálogo único; selector y editor en SPEC-002 | Sí | SPEC-001 |
| D-25 — **parcial: comportamiento mínimo en SPEC-001 (APR-012)** | Abrir otra invitación teniendo una sesión activa en otra sala | Reemplazar / preguntar / bloquear | Preguntar si se abandona la sala anterior (solo si está en `lobby` o `finished`) | No | SPEC-007 |
| D-29 — **RESUELTA (APR-009)** | Condición de inicio: «al menos tres conectados» (resumen) o «todos los integrantes conectados» (maestro) | Cualquiera | Ambas: ≥3 integrantes y **todos** conectados; mostrar quién falta | Sí (mensaje de lobby) | [SPEC-003](../specs/SPEC-FEAT-003-inicio-y-roles.md) |

## Seguridad, accesibilidad e ingeniería

| ID | Decisión | Opciones | Propuesta del agente | Bloquea SPEC-001 | Documento |
|---|---|---|---|---|---|
| D-08 — **RESUELTA (APR-005)** | Mecanismo de sesión | Token en `localStorage`/`sessionStorage` / cookie `HttpOnly` | Cookie `HttpOnly; Secure; SameSite=Strict` por sala, token opaco con hash en Redis | Sí | [ADR-0004](../adr/ADR-0004-sesion-y-credenciales.md) |
| D-14 | Límites de tiempo y WCAG 2.2.1 | Documentar excepción / «tiempo ampliado» configurable por anfitrión | Opción «tiempo ampliado» (×2) en lobby; requiere SPEC propia (SPEC-FEAT-009, fuera del MVP inicial) | No | [ADR-0005](../adr/ADR-0005-sistema-visual-y-accesibilidad.md) |
| D-18 — **RESUELTA (APR-011)** | Herramienta E2E | Playwright Node / Playwright Python (referencia del maestro) | Playwright para Node (un solo lenguaje) y `jsqr` para decodificar el QR | No (sí para G5) | [strategy.md](../qa/strategy.md) |
| D-19 — **RESUELTA (APR-011)** | Lint | ESLint (dependencia de desarrollo) / solo `node --check` | ESLint con configuración mínima recomendada | No | strategy.md |
| D-20 | Umbrales de limitación de solicitudes | — | Valores iniciales en [threat-model.md](../security/threat-model.md) §Controles, por confirmar | No | threat-model.md |
| D-21 | Tipografía | Fuentes del sistema / fuente web | Fuentes del sistema (sin solicitudes externas) | No | [design-system.md](../ux/design-system.md) |
| D-26 | Despliegues automáticos de Vercel por Git y protección de despliegues | Activos / desactivados con `git.deploymentEnabled` | Desactivar en `main` hasta definir G6; Preview protegido; Production accesible a invitados | No (sí para G6) | [despliegue](../operations/deployment-and-rollback.md) |
| D-27 | Registro de nombres y códigos en logs | No registrar / registrar con hash | No registrar nombres; código de sala solo como hash truncado | No | threat-model.md |
