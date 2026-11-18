# ADR-0004 — Sesión, transporte de credenciales y modelo de amenazas

> **Estado:** APROBADO para el alcance de SPEC-FEAT-001 (APR-010); **decisión central aprobada**: cookie `HttpOnly` (D-08, APR-005, 2026-11-18) · **Aprobador:** responsable técnico (usuario de la sesión)

## Contexto

Sin cuentas. Hay que demostrar pertenencia a una sala y recuperar el lugar al recargar. El código de cinco letras facilita el acceso pero **no** es una credencial de pertenencia. La implementación de referencia mencionada en el prompt maestro usaba almacenamiento del navegador y tokens en parámetros de consulta; este proyecto es greenfield y no hereda esa decisión.

La [guía HTML5 de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) recomienda no guardar identificadores de sesión en `localStorage`.

## Opciones

| Opción | XSS | CSRF | Recarga / pestañas | Logs/URL |
|---|---|---|---|---|
| Token en `localStorage` + cabecera | Robable por XSS | No aplica | Recupera en todas las pestañas | Bien si no va en URL |
| Token en `sessionStorage` + cabecera | Robable por XSS | No aplica | Se pierde al cerrar pestaña; no compartido | Igual |
| Token en query string | Robable | — | — | **Se filtra** a historial, logs y Referer → descartada |
| **Cookie `HttpOnly` por sala** | No legible por JS | Requiere mitigación | Recupera al recargar y en otras pestañas del mismo navegador | No aparece en URL |

## Decisión propuesta

1. Al crear o unirse, el servidor genera `playerId` (≥ 96 bits) y `token` (256 bits, `crypto.randomBytes`), guarda **solo** `sha256(token)` en el documento y responde `Set-Cookie: fs_<CODE>=<playerId>.<token>; HttpOnly; SameSite=Strict; Path=/; Max-Age=21600` y `Secure` cuando la petición llega por HTTPS.
2. Verificación en **cada** consulta y acción: cookie de esa sala → jugador existe → hash coincide (comparación en tiempo constante). Si falla: `401` sin renovar TTL.
3. El navegador guarda en `localStorage` **solo** el código de la sala actual (no secreto) para saber qué recuperar; si el almacenamiento está bloqueado, la app funciona y solo se pierde la recuperación automática del código.
4. **CSRF:** `SameSite=Strict`, `POST` solo con `Content-Type: application/json` y comprobación de `Origin` igual al host. Sin CORS (`Access-Control-Allow-Origin` ausente).
5. **Varias pestañas:** comparten identidad en la misma sala (mismo jugador). Para varias personas en un equipo se usan navegadores o perfiles distintos (y contextos aislados en E2E).
6. **Modo local por HTTP en red local (prueba de QR desde un móvil):** los navegadores no guardan cookies `Secure` en HTTP fuera de `localhost`; por eso `Secure` se aplica según el protocolo. Documentar que el modo LAN es solo para desarrollo.
7. **SSE local:** `EventSource` del mismo origen envía la cookie; no se necesita token en URL.
8. Al expirar o eliminarse la sala, el servidor responde `Set-Cookie` con `Max-Age=0`.

## Consecuencias y riesgos

- (+) Un XSS no puede leer el token (aunque sí actuar dentro de la página: XSS sigue siendo crítico; ver [threat-model.md](../security/threat-model.md)).
- (−) Cookies por sala: un navegador puede acumular varias; se limpian al expirar (`Max-Age`).
- Riesgo: `SameSite=Strict` no envía la cookie en la navegación desde otro sitio (p. ej. enlace en el chat) en la **primera** carga de documento; las peticiones `fetch` posteriores del mismo origen sí la envían. Debe verificarse en E2E (T-015).
- D-08 confirmada (APR-005). Quedan por aprobar el resto de detalles de este ADR (CSRF, `Secure` según protocolo, nombres de cookie).
