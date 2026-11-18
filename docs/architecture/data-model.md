# Modelo de datos — Farsante Scrum

> **Versión:** 0.1.0 · **Estado:** PROPUESTA G2 · Fuente de verdad: **Redis** en modo compartido; memoria del proceso solo en modo local sin Redis ([ADR-0002](../adr/ADR-0002-redis-concurrencia-y-ttl.md)).
>
> Propietario de los datos: `[PENDIENTE — D-02]`. Todos los ejemplos usan datos sintéticos.

## 1. Claves Redis (PROPUESTA)

| Clave | Tipo | Contenido | TTL |
|---|---|---|---|
| `{prefix}:room:{CODE}` | Hash | `v` (versión entera), `doc` (JSON del documento de sala) | 21 600 s, renovado en cada petición **válida** |
| `{prefix}:presence:{CODE}` | Hash | `playerId → lastSeen (ms epoch)` | Igual que la sala |
| `{prefix}:rl:{scope}:{hash}:{ventana}` | String | Contador de limitación de solicitudes | Duración de la ventana |

- `{prefix}` = `REDIS_KEY_PREFIX` (por defecto `farsante:dev`); distinto en desarrollo, pruebas, Preview y Production.
- La presencia va fuera del documento para que el latido no incremente `v` ni provoque conflictos CAS.
- No se recorren ni listan salas (sin `SCAN`/`KEYS` en el camino de la aplicación).

## 2. Documento de sala (`doc`, `schemaVersion: 1`)

```json
{
  "schemaVersion": 1,
  "code": "BCDFG",
  "createdAt": 1763478000000,
  "lastActivityAt": 1763478000000,
  "hostId": "p_7Qm…",
  "players": [
    { "id": "p_7Qm…", "name": "Ana", "nameKey": "ana", "joinedAt": 1763478000000, "tokenHash": "sha256:…" }
  ],
  "words": { "groupId": "scrum", "label": "Scrum y equipo", "items": ["Planning", "Review", "…"] },
  "phase": "lobby",
  "game": null
}
```

### Partida (`game`, nulo en `lobby`)

```json
{
  "gameId": "g_X1…",
  "round": 1,
  "word": "Retro",
  "impostorId": "p_…",
  "ready": ["p_…"],
  "order": ["p_…", "p_…", "p_…"],
  "turnIndex": 0,
  "phaseStartedAt": 1763478100000,
  "phaseEndsAt": 1763478160000,
  "clues": [ { "round": 1, "playerId": "p_…", "text": "Mirar atrás", "skipped": false, "at": 1763478120000 } ],
  "turnRejections": 0,
  "vote": { "eligible": ["p_…"], "ballots": { "p_votante": "p_destino" } },
  "lastTally": [ { "playerId": "p_…", "votes": 3 } ],
  "outcome": null
}
```

`outcome` (solo `reveal`, `guess`, `finished`): `{ "kind": "noQuorum|tie|innocentAccused|impostorAccused", "accusedId": "p_…|null", "votesFor": 3, "participation": 4, "eligible": 4, "guess": "texto|null", "winner": "impostor|team|null" }`.

## 3. Reglas de integridad

| Regla | Dónde se valida |
|---|---|
| `players.length ≤ 12`; entradas solo en `lobby` | `room.join` dentro de `mutate` |
| `nameKey` único por sala (normalización D-10) | `room.join` |
| `hostId ∈ players` | `room.*` |
| Un `impostorId ∈ players`, una `word ∈ words.items` | `game.start` |
| `order` es permutación de jugadores al iniciar la ronda | `game.startRound` |
| `vote.eligible` fijo desde la apertura; `ballots` sin auto-voto ni duplicados | `game.vote` |
| Cada mutación incrementa `v` en 1 | Script CAS |

## 4. Proyección pública (DTO por jugador)

Ver [api-contracts.md §3](api-contracts.md). Reglas: el impostor recibe `word: null` hasta `finished`; nunca se envían `tokenHash`, `impostorId`, `ballots`, `word` (a quien no corresponde) ni la reflexión antes de `finished`.

## 5. Clasificación, finalidad y retención

| Dato | Clasificación | Finalidad | Retención | Acceso |
|---|---|---|---|---|
| Nombre visible | Dato personal potencial (se recomienda alias) | Identificar jugadores en la sala | Mientras exista la sala (≤ 6 h de inactividad) | Integrantes de la sala |
| Pistas, votos, resultado | Contenido de juego | Partida en curso | Igual; se limpian al reiniciar | Según proyección |
| Token de sesión | Secreto | Pertenencia | Solo su hash en Redis; cookie hasta fin de sala | Servidor |
| Código de sala | Identificador de acceso (no credencial) | Invitar | Igual | Cualquiera con el enlace |
| Credenciales Redis | Secreto | Infraestructura | Variables del entorno | Servidor y responsables |
| Logs técnicos | Operativo | Diagnóstico | Según plataforma | Responsables; sin nombres, tokens, palabras ni votos |

No hay respaldo: las salas son efímeras (SUPUESTO S-02, D-07).

## 6. Evolución del esquema

- `schemaVersion` en cada documento; el lector acepta la versión actual y la anterior.
- Cambio incompatible: nuevo `REDIS_KEY_PREFIX` por versión mayor (las salas antiguas expiran solas en ≤ 6 h) o lector compatible N-1. **Nunca** borrar claves productivas para resolver una migración.
- El rollback de código debe poder leer documentos escritos por la versión nueva o el cambio se publica en dos pasos (lector primero, escritor después).
