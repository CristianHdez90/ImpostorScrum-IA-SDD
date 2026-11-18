# Matriz de trazabilidad — Farsante Scrum

> **Versión:** 0.1.0 · **Estado:** PROPUESTA · Cadena: `Objetivo → Historia → SPEC → RF/CA → ADR → Cambio/PR → Test → Evidencia → Release`. Cambio/PR, evidencia y release: **PENDIENTE** en todas las filas (no hay código).

| Objetivo | Historia | SPEC | RF / CA | ADR | Test (matriz base) | Evidencia |
|---|---|---|---|---|---|---|
| OBJ-002 | HU-001, HU-002 | SPEC-FEAT-001 | RF-001.01–.06, .14 / CA-01…CA-07 | 0001, 0002, 0004 | T-001, T-002 | **Verde en local 2026-11-18** (`npm test` 50/50, E2E 26/26); Upstash real pendiente |
| OBJ-002 | HU-003 | SPEC-FEAT-001 | RF-001.07–.09 / CA-09, CA-17 | 0003, 0005 | T-001, T-019 | Verde en local; CA-17 parcial (lector de pantalla y contraste renderizado pendientes) |
| OBJ-002 | HU-004 | SPEC-FEAT-001 | RF-001.15–.16 / CA-08, CA-10, CA-12 | 0004 | T-015 | Verde en local |
| OBJ-004 | HU-001 | SPEC-FEAT-001 | RF-001.11, .19 / CA-05, CA-11, CA-16 | 0002, 0004 | T-002, T-018 | Verde en local (QR decodificado con jsQR) |
| OBJ-001 | HU-005 | SPEC-FEAT-002 | RF-002.01–.10 | 0001 | T-003 | Verde en local (API + E2E palabras) |
| OBJ-004 | HU-006, HU-007, HU-014 | SPEC-FEAT-003 | RF-003.01–.11, RF-008.01–.06 / CA-01…CA-12 | 0004 | T-004, T-005, T-013 (parcial) | **Verde en local 2026-11-18** (`npm test` 66/66, E2E 34/34) |
| OBJ-001 | HU-008, HU-009 | SPEC-FEAT-004 | RF-004.01–.10 | — | T-006, T-007 | Verde en local 2026-11-18 (T-016 con Upstash real y T-020 pendientes) |
| OBJ-001 | HU-010 | SPEC-FEAT-005 | RF-005.01–.08 | 0002 | T-008, T-009 | Verde en local 2026-11-18 (T-016 con Upstash real y T-020 pendientes) |
| OBJ-001, OBJ-003 | HU-011…HU-013 | SPEC-FEAT-006 | RF-006.01–.07, RF-007.01–.03 | — | T-010, T-011, T-012 | Verde en local 2026-11-18 (T-016 con Upstash real y T-020 pendientes) |
| OBJ-001 | HU-014, HU-015 | SPEC-FEAT-007 | RF-008.01–.08, RF-009.01–.04 | 0002, 0003 | T-013, T-014, T-015 | Verde en local 2026-11-18 (T-016 con Upstash real y T-020 pendientes) |
| OBJ-001 | HU-016…HU-018 | SPEC-FEAT-008 | RF-008T.01–.10 | 0002, 0003 | T-016, T-017, T-018, T-020 | Verde en local 2026-11-18 (T-016 con Upstash real y T-020 pendientes) |
| — (Art. VI) | todas | todas con UI | Estados y WCAG | 0005 | T-019 | PENDIENTE |

## Matriz base requisito–prueba (del prompt maestro, mapeada)

| ID | Requisito | Nivel | SPEC |
|---|---|---|---|
| T-001 | RF-001: crear y unir 3–12; llena/iniciada; colisiones | API/integración | 001 |
| T-002 | RF-001: QR real decodificado sin token; entrada por código | E2E/QR | 001 |
| T-003 | RF-002: cuatro grupos de diez, edición, guardado, permisos, recarga | E2E/API | 002 |
| T-004 | RF-003: un impostor; DTO sin secreto; solo anfitrión inicia | Dominio/API | 003 |
| T-005 | RF-003: confirmaciones idempotentes y vencimiento de preparación | Integración | 003 |
| T-006 | RF-004: frases, 160, vacíos, duplicados, secreto en frase, turno | API | 004 |
| T-007 | RF-004/005: avance por vencimiento y saltos | Reloj controlado | 004 |
| T-008 | RF-005: voto único, no auto-voto, elegibles fijos | API/concurrencia | 005 |
| T-009 | RF-005/006: cuórum por techo de 2/3; empate; cierre anticipado | Integración | 005 |
| T-010 | RF-006: inocente más votado termina y revela al impostor | API/E2E | 006 |
| T-011 | RF-006: adivinanza: acierto, fallo, vencimiento | API | 006 |
| T-012 | RF-007: diez reflexiones; general; ocultas hasta el final | Dominio/DTO/E2E | 006 |
| T-013 | RF-008: reinicio en roles/pistas/voto/adivinanza | API/E2E | 007 |
| T-014 | RF-008: reinicio concurrente; salir transfiere anfitrión | Integración | 007 |
| T-015 | RF-009: recarga, red, sesión inválida, sala expirada | E2E/fallos | 001, 007 |
| T-016 | Persistencia: dos instancias sin pérdidas | Concurrencia | 001, 005, 008 |
| T-017 | Persistencia/tiempo: varias fases vencidas desde otra instancia | Integración | 008 |
| T-018 | Seguridad: XSS, acceso cruzado, no autorizados, logs | API/DOM | todas |
| T-019 | UX/accesibilidad: teclado, foco, contraste, lector, móvil | Manual y automatizada | todas |
| T-020 | Operación: salud, Redis real, QR, partida entre dispositivos, rollback | Smoke autorizado | 008 |
| T-021 | RF-009.01–02: configuración al crear y en la sala de espera; valores inválidos y no anfitrión | Dominio/API/E2E | 009 |
| T-022 | RF-009.03–07: serie de rondas, pausa de 20 s, «Continuar», puntos, podio con empates, serie cortada | Dominio/API/E2E | 009 |
| T-023 | RF-009.08: reiniciar borra puntos y conserva la configuración | Dominio/E2E | 009 |
| T-024 | RF-010.01: carta con giro 3D; la palabra no está en el DOM oculta; sin giro con movimiento reducido | E2E/CSS | 010 |
| T-025 | RF-010.02–06: iconos, avatares, mesa con «En turno», barra «Ronda X de N» + «Vuelta k», podio | E2E/revisión visual | 010 |


## Evidencia consolidada (2026-11-18, sin Git)

| Suite | Archivos | Resultado | Entorno |
|---|---|---|---|
| Dominio | `tests/unit/*.test.js` (7) | Verde | Equipo de CristianDev, Node 22.23.5 |
| API e integración | `tests/integration/*.test.js` (6) | Verde — total `npm test` **89/89** | Igual; memoria y **Redis simulado** |
| E2E | `tests/e2e/{lobby,roles,game}.spec.js` | **46/46** ×2 | Entorno en la nube de la sesión, Chrome del sistema, escritorio + móvil emulado |
| Lint / sintaxis / auditoría | ESLint, `node --check`, `npm audit` | Sin errores; 0 vulnerabilidades | Equipo de CristianDev |
| CI de GitHub Actions | `.github/workflows/ci.yml`: lint, sintaxis, build, `npm test`, auditoría y E2E | **Verde; E2E 46/46** | Runner `ubuntu-latest` con Chromium de Playwright, 2026-11-18 (tras corregir una carrera en `game.spec.js`) |
| Upstash real (T-016) | `scripts/validate-upstash.js` | **9/9** | ejecutado por CristianDev el 2026-11-18 15:49 (America/Bogota) con `npm run validate:upstash` contra `up-dragon-176459.upstash.io`, prefijo `farsante:pruebas:validacion-af51e155` |
| Smoke en Production (T-020) | `/health` + partida real entre dispositivos con QR | **Correcto** | CristianDev, 2026-11-18 16:21–16:32, `impostor-scrum-ia-sdd.vercel.app` (APR-020, APR-021) |
| No ejecutado | Lector de pantalla y contraste renderizado (T-019 parcial) | PENDIENTE | Requiere revisión humana |

## Evidencia SPEC-FEAT-009 y SPEC-FEAT-010 (2026-11-18, sin Git, sin desplegar)

| Suite | Archivos | Resultado | Entorno |
|---|---|---|---|
| Dominio, API e integración | `tests/unit/series.test.js` (nuevo), `tests/integration/api-full.test.js`, `tests/unit/room.test.js` (LIMITS con `settingsOptions`) | **97/97** | Entorno en la nube de la sesión, Node 22; memoria y Redis simulado |
| E2E | `tests/e2e/series.spec.js` (nuevo) + `game.spec.js` (empate ahora comprueba `#lap-label` «Vuelta 2») | **50/50** (25 escritorio + 25 móvil; incluye «cada participante ve su nombre») | Entorno en la nube de la sesión, Chrome del sistema |
| Lint | ESLint | Sin errores | Igual |
| Revisión visual | Capturas de inicio, sala de espera, carta, pistas con la mesa, pausa entre rondas y podio (escritorio y móvil) | Revisadas; se corrigieron alineaciones, colores de avatar y espaciado | Igual |
| Corrección encontrada | La portada mostraba «Retro», que es palabra del grupo Scrum: el impostor la veía en la página. Se cambió por «?» | Corregido | — |
| No ejecutado | CI de GitHub, Preview/Production, lector de pantalla y contraste medido | PENDIENTE | Requiere a CristianDev y G6 |
