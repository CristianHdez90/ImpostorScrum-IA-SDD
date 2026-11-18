# Modelo de amenazas y protección de datos — Farsante Scrum

> **Versión:** 0.1.0 · **Estado:** PROPUESTA G2 · Proporcional al riesgo: juego efímero sin cuentas, con secretos de juego, nombres visibles y credenciales de infraestructura.
>
> Columna *Evidencia*: todo **PENDIENTE**; no hay código ni pruebas.

## 1. Activos

| Activo | Impacto si se compromete |
|---|---|
| Identidad del impostor, palabra, votos individuales | Arruina la partida; confianza en la herramienta |
| Token de sesión | Suplantación de un jugador o del anfitrión |
| Credenciales Redis (`UPSTASH_REDIS_REST_TOKEN`) | Lectura/escritura de todas las salas; costos |
| Nombres visibles | Dato personal potencial |
| Disponibilidad y cuota | Juego inutilizable; costos inesperados |

## 2. Registro de amenazas

| ID | Atacante | Escenario | Control propuesto | Prueba | Riesgo residual |
|---|---|---|---|---|---|
| TM-01 | Externo | Adivinar códigos / enumerar salas | Espacio 24⁵ ≈ 7,96 M (sin I ni O, APR-006); límite de `join` por IP y global por código; mensajes iguales para «inexistente» y «expirada»; el código no da pertenencia | T-018 | Medio-bajo: una sala en `lobby` puede recibir un intruso que adivine el código; el anfitrión lo ve en la lista (expulsión fuera del MVP) |
| TM-02 | Jugador | Robar o reutilizar sesión ajena; suplantar anfitrión | Token 256 bits en cookie `HttpOnly`; hash en Redis; permiso de anfitrión derivado de `hostId` del servidor | T-018 | Bajo |
| TM-03 | Jugador de otra sala | Acceso cruzado | Cookie por código; verificación de pertenencia en cada petición | T-018 | Bajo |
| TM-04 | Jugador curioso | Leer secretos en DTO, HTML, `data-*`, consola | Proyección por jugador y fase; carta no presente en DOM mientras está oculta; sin logs de cliente con estado | T-004, T-012 | Bajo |
| TM-05 | Jugador | XSS en nombre, pista, palabra o mensaje | `textContent`, CSP sin `unsafe-inline`, validación de longitud | T-018 | Bajo |
| TM-06 | Externo | Abuso: crear salas masivas, consultas excesivas | Límites por IP (hash) en Redis; tamaño de cuerpo; plazos | T-018 | Medio (IP compartidas/NAT) |
| TM-07 | Impostor | Usar el rechazo de pistas como oráculo de la palabra | D-13: límite de rechazos por turno y mensaje genérico | T-006 | Medio (aceptado o mitigado según D-13) |
| TM-08 | Concurrencia | Carreras en entradas, votos, reinicio | CAS con versión, `gameId`, `actionId` | T-014, T-016 | Bajo tras pruebas con Redis real |
| TM-09 | Operador/infra | Tokens en URL, historial, logs, capturas o reportes | Sin tokens en URL; logs sin cookies; capturas E2E con carta oculta | T-018 | Bajo |
| TM-10 | Cadena de suministro | Dependencia comprometida | Dependencias mínimas, lockfile, `npm audit`, revisión de licencia; QR copiado de paquete fijado | CI | Medio-bajo |
| TM-11 | Configuración | Preview con datos de producción; `.env` en Git | Prefijos distintos por entorno; `.env` en `.gitignore`; `.env.example` ficticio; escaneo de secretos | CI | Bajo |
| TM-12 | Externo | Clickjacking | `frame-ancestors 'none'` y `X-Frame-Options: DENY` | T-018 | Bajo |
| TM-13 | Jugador | Peticiones tardías tras reinicio reactivan partida anterior | `gameId` obligatorio; `409 STALE_GAME` | T-014 | Bajo |
| TM-14 | Proveedor | Redis no disponible interpretado como sala expirada | 503 `STORE_UNAVAILABLE`; el cliente conserva sesión | T-015 | Bajo |

## 3. Controles de ingeniería

1. **Aleatoriedad:** `crypto.randomInt` para código, impostor, palabra y orden; `crypto.randomBytes` para IDs y tokens.
2. **Validación estricta:** tipos, rangos, longitud (grafemas, D-11), claves permitidas y tamaño de cuerpo ≤ 8 KiB.
3. **Salida segura:** solo APIs DOM de texto; no se acepta HTML enriquecido, por lo que no se añade sanitizador.
4. **Cabeceras** (PROPUESTA, verificar compatibilidad en G5):
   - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`
   - `Referrer-Policy: no-referrer` · `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` · `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - API: `Cache-Control: no-store`. HTTPS lo provee Vercel en producción.
   - **No** se declara CSP efectiva hasta comprobarla.
5. **CSRF/CORS:** ver [ADR-0004](../adr/ADR-0004-sesion-y-credenciales.md); sin `Access-Control-Allow-Origin: *`.
6. **Limitación de solicitudes** (valores iniciales, **D-20**): `create` 10/h por IP; `join` 30/10 min por IP y 60/10 min por código; consultas 120/min por sesión. La IP se guarda como hash con sal de entorno. La pausa en el cliente no es control de seguridad.
7. **Dependencias:** lockfile, `npm ci`, `npm audit --omit=dev` en CI, revisión de licencias antes de adoptar.
8. **Secretos:** solo variables de servidor en Vercel; nunca en `.env.example`, documentación, frontend, logs, fixtures o commits. Uso del token de **lectura y escritura** de Upstash; no usar `KV_REST_API_READ_ONLY_TOKEN`.
9. **Datos de prueba:** sintéticos; prefijo de Redis aislado por suite.

## 4. Protección de datos

- Minimización: solo nombre visible; texto de ayuda «Usa tu nombre de pila o un alias».
- Retención: hasta 6 h sin actividad; sala eliminada al salir el último integrante.
- Sin analítica, cookies de terceros ni rastreo. La única cookie es técnica (sesión de sala).
- Logs: tipo de operación, duración, resultado, conflictos CAS, fallos de dependencia, `requestId`; **sin** tokens, cookies, nombres, palabras, roles, votos ni código de sala en claro (D-27: hash truncado).
- Aviso de privacidad breve en la página de inicio: `[texto por aprobar por el responsable]`.

## 5. Gestión de secretos

| Secreto | Dónde vive | Quién lo gestiona | Rotación |
|---|---|---|---|
| `UPSTASH_REDIS_REST_TOKEN` | Variables de entorno de Vercel por entorno | `[PENDIENTE — D-02]` | Ante sospecha o salida de un responsable; procedimiento en [runbook.md](../operations/runbook.md) |
| Sal de hash de IP (`RATE_LIMIT_SALT`, PROPUESTA) | Variable de servidor | Igual | Anual o ante sospecha |

Nunca se comparten valores por chat, capturas ni reportes de prueba.
