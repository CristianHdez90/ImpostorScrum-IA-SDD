# CI/CD, despliegue y rollback — propuesta

> **Versión:** 0.1.0 · **Estado:** PROPUESTA G2. **No se ha creado** repositorio, pipeline, proyecto Vercel ni base Upstash. Cada uno requiere autorización: repositorio (D-05), infraestructura y release (G6).

## 1. Control de versiones (D-05)

- Repositorio Git con rama `main` protegida: PR obligatorio, revisión del responsable designado y CI en verde para fusionar.
- Ramas por SPEC: `feat/spec-001-salas`, etc. Commits acotados al alcance G3.
- Implementar, abrir PR, fusionar, migrar y desplegar son **permisos distintos** (Constitución, Art. IX).

## 2. Pipeline mínimo propuesto (GitHub Actions u otro según D-05)

| Paso | Comando propuesto | Bloquea | Notas |
|---|---|---|---|
| Instalación reproducible | `npm ci` | Sí | Requiere `package-lock.json` válido |
| Lint | `npm run lint` | Sí | D-19 |
| Sintaxis | `node --check` sobre `lib/`, `api/`, `server.js`, `scripts/` | Sí | Sin compilación (JS puro) |
| Pruebas dominio/API/concurrencia simulada | `npm test` (`node --test`) | Sí | Redis **simulado**; reportarlo como tal |
| Build | `npm run build` | Sí | Genera `public/vendor/qrcode.js` |
| E2E | `npm run test:e2e` | Sí en PR que toquen `public/` | D-18; navegadores instalados en CI |
| Dependencias | `npm audit --omit=dev` | Avisos altos/críticos revisados | No modificar el stack sin análisis |
| Secretos | escaneo de secretos (herramienta por decidir) | Sí | — |

- Los PR **no** acceden a secretos productivos. Pruebas contra Upstash real: trabajo separado y manual/condicional con base de pruebas y prefijo propio.
- Distinguir en el reporte trabajos ejecutados, condicionales, omitidos y simulados.

## 3. Vercel (referencia; verificar en G6)

| Ajuste | Valor propuesto |
|---|---|
| Framework | Other |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `public` |
| Funciones | `api/index.js`, `maxDuration: 30` (elección del proyecto; los límites del plan se consultaron el 2026-11-18 en la [documentación de duración](https://vercel.com/docs/functions/configuring-functions/duration) y deben re-verificarse) |
| Node.js | LTS fijada en `engines` (24.x/22.x/20.x disponibles según la documentación consultada) |
| Variables (por entorno) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (lectura y escritura), `REDIS_KEY_PREFIX` distinto (`farsante:preview`, `farsante:prod`) |
| Despliegue por Git | `git.deploymentEnabled` en `vercel.json` para que un push/merge a `main` **no** publique en Production sin G6 ([doc](https://vercel.com/docs/project-configuration/git-configuration)); D-26 |
| Protección de despliegues | Preview protegido; Production accesible a invitados sin inicio de sesión (verificar en smoke) |

Si una integración creó `KV_REST_API_URL` y `KV_REST_API_TOKEN`, se crean las dos variables `UPSTASH_*` con esos valores; no se promete compatibilidad automática con otros nombres. **No** usar `KV_REST_API_READ_ONLY_TOKEN`.

Local: `npm start` usa el entorno definido; para `.env`, `node --env-file=.env server.js` (Node ≥ 20.6). No se asume carga automática.

## 4. Promoción (G6)

1. Autorización de merge registrada → merge.
2. Autorización de release registrada → despliegue a Production (CLI o promoción manual de un Preview verificado).
3. Smoke T-020 ([runbook.md](runbook.md) §3).
4. Registro en [approvals.md](../governance/approvals.md) y cierre G7.

## 5. Rollback

- **Código:** promover el despliegue anterior compatible desde Vercel (función de rollback/promoción de la plataforma; verificar procedimiento vigente antes de G6). No borra datos.
- **Datos:** salas efímeras (≤ 6 h). Si el nuevo código escribió `schemaVersion` superior, el anterior debe poder leerla o se usa un prefijo nuevo por versión mayor ([data-model.md](../architecture/data-model.md) §6). Nunca borrar claves productivas para resolver un rollback.
- **Impacto en partidas activas:** pueden interrumpirse; comunicar a los facilitadores (canal `[PENDIENTE]`).
