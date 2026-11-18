# Estrategia QA — Farsante Scrum

> **Versión:** 0.1.0 · **Estado:** PROPUESTA G2 · **Pruebas ejecutadas hasta hoy: ninguna** (no existe código).

## 1. Orden de trabajo

Revisión estática de SPECS → análisis de riesgos ([risk-matrix.md](risk-matrix.md)) → casos base → reglas de dominio → API/integración → concurrencia y vencimientos → E2E de flujos de alto valor → no funcionales (seguridad, accesibilidad, rendimiento proporcional) → Smoke autorizado.

## 2. Niveles y herramientas (PROPUESTA)

| Nivel | Qué demuestra | Herramienta | Entorno |
|---|---|---|---|
| Dominio (unitario) | Reglas, transiciones, normalización, proyección | `node:test` con reloj y aleatoriedad inyectados | Local/CI |
| API / integración | Contratos, códigos HTTP, autorización, cookies | `node:test` + servidor en puerto efímero + `memory-store` | Local/CI |
| Concurrencia | CAS sin pérdidas, último cupo, votos simultáneos, reinicio concurrente | `node:test` con dos instancias del caso de uso sobre el **mismo** almacén | **Redis simulado** (en memoria con semántica CAS) en CI; **Upstash real** en entorno autorizado |
| Vencimientos persistidos | Recuperación de varias fases sin timers activos, desde otra instancia | Reloj controlado | Simulado y real |
| E2E navegador | Recorridos completos con 3–12 sesiones independientes, móvil, recarga, reinicio, QR | Playwright (D-18), contextos aislados; `jsqr` para decodificar el QR renderizado | Local/CI; Preview autorizado |
| Accesibilidad | Teclado, foco, contraste, mensajes de estado | axe (automatizada) + revisión manual con lector de pantalla | Local; revisión humana |
| Seguridad | XSS, acceso cruzado, CSRF, cabeceras, logs sin secretos | API + DOM + revisión de logs | Local/CI |
| Smoke | Salud, Redis real, partida entre dispositivos, rollback | Manual guiado + script | **Solo con autorización G6** |

**Regla de honestidad:** cada reporte indica si se usó Redis simulado, memoria, navegador real o Upstash/Vercel reales. No son equivalentes.

## 3. Reglas de ejecución

- Datos sintéticos; prefijo Redis por suite (`farsante:test:<uuid>`) y limpieza controlada.
- Aserciones de comportamiento, no copia del algoritmo como oráculo.
- Límites, fallos y permisos, no solo el camino feliz.
- Tiempo controlado en dominio/API; en E2E, esperar condiciones observables (sin pausas arbitrarias). Para E2E con plazos, el servidor de prueba admite un **factor de tiempo** solo en modo de prueba (PROPUESTA; nunca activable en producción).
- Selectores por rol y nombre accesible o `data-testid` sin secretos.
- Capturas con la carta oculta; nunca capturar cookies.
- Reporte: comando, fecha, entorno, commit, resultado, omitidos y motivo.

## 4. Suites

| Suite | Contenido | Cuándo |
|---|---|---|
| Smoke local | crear, unir 3, iniciar, una ronda, reinicio | Cada PR |
| Regresión | Toda la matriz T-001…T-019 aplicable | Cada PR que toque `lib/` o `public/` |
| Concurrencia real | T-016, T-017 contra Upstash de pruebas | Antes de G6 (autorizado) |
| Smoke posdespliegue | T-020 | Cada release (G6/G7) |

## 5. Criterios de salida (propuesta para DoD)

Todos los CA de la SPEC con prueba verde o excepción aprobada; sin defectos críticos abiertos; omitidos declarados; brechas de accesibilidad registradas.

## 6. Herramientas por decidir

D-18 (Playwright Node vs Python) y D-19 (ESLint). Dependencias de desarrollo propuestas: `@playwright/test`, `jsqr`, `@axe-core/playwright`, `eslint`. Ninguna instalada.
