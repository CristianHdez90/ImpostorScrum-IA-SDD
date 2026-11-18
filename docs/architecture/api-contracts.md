# Contratos HTTP — Farsante Scrum

> **Versión del contrato:** 0.2.0 · **Estado:** `create`, `join`, `state` y `events` implementados (SPEC-FEAT-001); `action` implementada para `start`, `ready` y `reset` (SPEC-FEAT-003); el resto de acciones y `/health` siguen como propuesta. El DTO incluye `gameId`, `deadline`, `me.role`, `me.word` y `ready`
>
> Greenfield: no hay contrato previo que preservar; se proponen directamente códigos HTTP diferenciados.

## 1. Convenciones

- JSON UTF-8; `POST` exige `Content-Type: application/json` y cabecera `Origin` igual al origen del sitio (CSRF, [ADR-0004](../adr/ADR-0004-sesion-y-credenciales.md)).
- Cuerpo máximo propuesto: 8 KiB; JSON malformado → `400 INVALID_JSON`. En Vercel se tolera que el cuerpo ya venga procesado por la plataforma.
- Claves desconocidas en el cuerpo → `400 UNKNOWN_FIELD`.
- Sesión: cookie `fs_<CODE>` (`HttpOnly; SameSite=Strict; Path=/; Secure` en HTTPS). **Nunca** en la URL.
- Todas las respuestas de `/api/*`: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Cuerpo de error uniforme, sin trazas ni detalles del proveedor:

```json
{ "error": { "code": "ROOM_FULL", "message": "La sala está llena (12 de 12).", "retryable": false } }
```

| HTTP | Uso | Códigos de negocio |
|---|---|---|
| 400 | Entrada inválida | `INVALID_JSON`, `UNKNOWN_FIELD`, `INVALID_NAME`, `INVALID_CODE`, `INVALID_CLUE`, `INVALID_WORDS`, `INVALID_VOTE` |
| 401 | Sin sesión válida para la sala | `SESSION_INVALID` |
| 403 | Acción no permitida al actor u origen no permitido | `FORBIDDEN_ORIGIN` (implementado), `NOT_HOST`, `NOT_YOUR_TURN`, `NOT_IMPOSTOR` |
| 404 | Sala inexistente o expirada; ruta desconocida | `ROOM_NOT_FOUND`, `NOT_FOUND` |
| 405 | Método no permitido en una ruta conocida | `METHOD_NOT_ALLOWED` |
| 409 | Conflicto de estado | `ROOM_FULL`, `ROOM_STARTED`, `NAME_TAKEN`, `WRONG_PHASE`, `STALE_GAME`, `ALREADY_VOTED`, `CONFLICT_RETRY_EXHAUSTED` |
| 413 | Cuerpo demasiado grande | `PAYLOAD_TOO_LARGE` |
| 415 | Tipo de contenido incorrecto | `UNSUPPORTED_MEDIA_TYPE` |
| 429 | Exceso de solicitudes | `RATE_LIMITED` (+ `Retry-After`) |
| 503 | Dependencia no disponible | `STORE_UNAVAILABLE` (`retryable: true`, cabecera `Retry-After: 2`) |

Todas las respuestas de la API incluyen `X-Request-Id`. Una respuesta `401`/`404` de sala borra la cookie de esa sala (`Max-Age=0`). Sin cookie de la sala, `state` responde `401` sin revelar si la sala existe.

## 2. Operaciones

| Operación | Entrada | Permiso | Éxito | Errores principales | SPEC |
|---|---|---|---|---|---|
| `POST /api/create` | `{ "name": "Ana" }` (+ `words` en SPEC-002) | Visitante | `201` DTO + `Set-Cookie` | 400, 429, 503 | 001 |
| `POST /api/join` | `{ "code": "BCDFG", "name": "Luis" }` | Visitante; sala en `lobby` | `201` DTO + `Set-Cookie`; `200` si ya es integrante con cookie válida | 400, 404, 409 (`ROOM_FULL`, `ROOM_STARTED`, `NAME_TAKEN`), 429, 503 | 001 |
| `GET /api/state?code=BCDFG` | Cookie | Integrante | `200` DTO | 401, 404, 503 | 001 |
| `POST /api/action` | `{ "code", "type", "payload", "gameId", "actionId" }` | Según tipo, actor y fase | `200` DTO | 400, 401, 403, 404, 409, 503 | 002–007 |
| `GET /api/events?code=` | Cookie | Integrante; **solo modo local** | `text/event-stream` de DTO | 401, 404 | 008 |
| `GET /health` | — | Público | `200 {"status":"ok","store":"redis"}` | `503 {"status":"unavailable"}` sin detalles | 008 |

### Acciones (`type`)

| `type` | `payload` | Actor | Fase | SPEC |
|---|---|---|---|---|
| `words` | `{ "groupId": "musica", "items": ["…"] }` | Anfitrión | `lobby` | 002 |
| `start` | `{}` | Anfitrión | `lobby` | 003 |
| `ready` | `{}` | Integrante | `roles` | 003 |
| `clue` | `{ "text": "…" }` | Jugador en turno | `clues` | 004 |
| `skip` | `{}` | Anfitrión | `clues` | 004 |
| `voting` | `{}` | Anfitrión | `discussion` | 005 |
| `vote` | `{ "targetId": "p_…" }` | Elegible | `vote` | 005 |
| `closeVote` | `{}` | Anfitrión, con cuórum | `vote` | 005 |
| `next` | `{}` | Anfitrión | `reveal` | 006 |
| `guess` | `{ "text": "…" }` | Impostor | `guess` | 006 |
| `reset` | `{}` | Anfitrión | cualquier activa | 007 |
| `playAgain` | `{}` | Anfitrión | `finished` | 007 |
| `leave` | `{}` | Integrante | `lobby`, `finished` | 007 |

- `gameId` obligatorio en acciones de partida; si no coincide con la partida vigente → `409 STALE_GAME` (protege frente a peticiones previas a un reinicio).
- `actionId` (UUID del cliente) hace idempotente el reintento de transporte: el servidor guarda los últimos N `actionId` por jugador en la partida y responde el estado actual sin repetir el efecto (PROPUESTA, SPEC-008).
- Nunca se aceptan `playerId`, `isHost`, rol o ganador enviados por el cliente.

## 3. Proyección de estado (DTO)

```json
{
  "code": "BCDFG",
  "version": 12,
  "phase": "lobby",
  "gameId": null,
  "serverNow": 1763478000000,
  "deadline": null,
  "me": { "id": "p_…", "name": "Ana", "isHost": true },
  "players": [ { "id": "p_…", "name": "Ana", "isHost": true, "isMe": true, "connected": true } ],
  "capacity": { "min": 3, "max": 12, "count": 1 },
  "words": { "groupId": "scrum", "label": "Scrum y equipo", "count": 10 },
  "canStart": { "ok": false, "reasons": ["MISSING_PLAYERS"] },
  "invite": { "path": "/?sala=BCDFG" },
  "sync": { "mode": "poll", "intervalMs": 1500 }
}
```

Campos por fase (se añaden en SPEC-003…006): `me.role` y `me.word` (`null` para el impostor), `ready.count/total`, `turn.playerId`, `order`, `clues[]`, `vote.participation/eligible` y `vote.myVote`, `tally` (solo al cerrar), `outcome` y, en `finished`, `impostor`, `word`, `reflection`.

**Nunca en el DTO:** `tokenHash`, `impostorId` antes de `finished` (salvo el caso de inocente acusado, que pasa a `finished`), `ballots`, `word` para el impostor o antes de tiempo, reflexión fuera de `finished`, `words.items` para no anfitriones fuera del `lobby`.

## 4. Ejemplos sintéticos

```http
POST /api/join
Content-Type: application/json
Origin: https://farsante.example

{"code":"BCDFG","name":"Luis"}
```

```http
HTTP/1.1 409 Conflict
Cache-Control: no-store

{"error":{"code":"NAME_TAKEN","message":"Ya hay alguien llamado «Luis» en esta sala. Prueba con otro nombre.","retryable":false}}
```
