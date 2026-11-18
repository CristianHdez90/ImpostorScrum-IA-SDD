# Farsante Scrum

Juego web multijugador para retrospectivas de equipo. El MVP completo está implementado (SPEC-FEAT-001…008): salas con código, enlace y QR; grupos de palabras editables; roles secretos; pistas por turnos; debate; votación secreta con cuórum; adivinanza del impostor; resultado con reflexión Scrum; reinicio, salida y `/health`.

- Gobernanza y diseño: [`docs/README.md`](docs/README.md) · Constitución 1.0.0 ratificada · [SPEC-FEAT-001](docs/specs/SPEC-FEAT-001-salas-e-invitaciones.md)
- Stack (ADR-0001): HTML/CSS/JavaScript sin framework, Node.js 22+, Upstash Redis REST con `fetch` nativo, Vercel.

## Requisitos

- Node.js 22 o superior y npm.

## Instalar y ejecutar en local

```bash
npm ci
npm run build      # copia qrcode-generator a public/vendor/
npm start          # http://127.0.0.1:3000
```

| Modo | Cómo | Almacén | Sincronización |
|---|---|---|---|
| Local por defecto | `npm start` sin variables `UPSTASH_*` | Memoria del proceso | SSE |
| Como en Vercel | `SYNC_MODE=poll npm start` | Memoria | Consultas cada ~1,5 s |
| Local con Redis | Variables `UPSTASH_*` de una base **de pruebas** | Redis | Consultas |

Para usar un archivo `.env` (copia de [`.env.example`](.env.example)), cárgalo explícitamente: `node --env-file=.env server.js`. No se carga solo.

### Probar desde el móvil (QR)

Un QR generado desde `localhost` no sirve en otro dispositivo. Arranca con `HOST=0.0.0.0 npm start`, abre la aplicación en el ordenador con la IP de tu red que muestra la consola (por ejemplo `http://192.168.1.20:3000`) y escanea el QR. Es solo para desarrollo: por HTTP la cookie no lleva `Secure`.

## Configuración de la partida

Al crear la sala (y después, en la sala de espera, solo el anfitrión) se eligen:

- **Rondas:** de 1 a 10. Cada ronda es una partida completa con nueva palabra e impostor; entre rondas hay una pausa de 20 s o el anfitrión pulsa «Continuar». Cada ganador suma 1 punto y al final se muestra un podio.
- **Tiempo por turno:** 30, 45, 60, 90 o 120 s.
- **Tiempo de votación:** 45, 60, 75, 90 o 120 s.

## Recursos de terceros

- **DM Sans** (fuente variable, subconjunto latino), licencia SIL OFL 1.1: `public/fonts/` (`DM-Sans-OFL.txt`). Se aloja en el propio sitio porque la CSP no permite fuentes externas.
- **qrcode-generator** (MIT): se copia a `public/vendor/` al compilar.

## Pruebas

```bash
npm run lint       # ESLint
npm run check      # node --check sobre el código propio
npm test           # dominio, API e integración (memoria y Redis SIMULADO)
npm run test:e2e   # Playwright: escritorio y móvil emulado, servidores locales en memoria
```

Si no puedes descargar el navegador de Playwright, indica uno instalado: `CHROME_PATH=/ruta/a/chrome npm run test:e2e`.

**Importante:** `npm test` usa un Redis **simulado**. Validar con Upstash real y en Vercel requiere una autorización aparte (G5/G6).

## Variables de entorno

| Variable | Uso |
|---|---|
| `UPSTASH_REDIS_REST_URL` | URL REST HTTPS de Upstash (solo servidor) |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST de lectura y escritura (solo servidor; nunca en el frontend, logs ni Git) |
| `REDIS_KEY_PREFIX` | Prefijo por entorno (`farsante:dev`, `farsante:preview`, `farsante:prod`) |
| `RATE_LIMIT_SALT` | Sal para el hash de IP en la limitación de solicitudes (servidor) |
| `PORT`, `HOST`, `SYNC_MODE` | Solo servidor local |
| `RATE_LIMIT_MULTIPLIER` | Solo desarrollo y pruebas: multiplica los límites |

En Vercel, si faltan las variables de Redis la API responde `503`: nunca usa memoria como respaldo. `GET /health` comprueba el almacén.

## Estructura

```text
api/index.js          Entrada de Vercel Functions
server.js             Servidor local (estáticos, API, SSE)
lib/                  Reglas, sesión, proyección, HTTP y almacenes
public/               Interfaz (index.html, app.js, styles.css, word-themes.js)
scripts/build.js      Copia del QR y comprobación de sintaxis
tests/                unit · integration · e2e
docs/                 Gobernanza, SPECS, ADR, UX, QA, seguridad y operación
```

## Despliegue

No autorizado todavía (G6). Ver [`docs/operations/deployment-and-rollback.md`](docs/operations/deployment-and-rollback.md) y [`docs/operations/runbook.md`](docs/operations/runbook.md). `vercel.json` desactiva los despliegues automáticos por Git (`git.deploymentEnabled: false`).
