# ADR-0002 — Redis como fuente de verdad, concurrencia y TTL

> **Estado:** APROBADO para el alcance de SPEC-FEAT-001 (APR-010, 2026-11-18); PROPUESTO para el resto · **Fecha:** 2026-11-18 · **Aprobador:** `[PENDIENTE — D-02]` · **Revisar:** tras el spike en Upstash real (G5) o si cambia el proveedor

## Contexto

Las Vercel Functions no comparten memoria entre invocaciones; varias instancias pueden atender a la misma sala a la vez. Se necesita: unicidad del código de sala, mutaciones sin pérdida de actualizaciones (entradas al último cupo, votos simultáneos, reinicio concurrente) y expiración tras 6 h de inactividad. Prohibido el respaldo en memoria en Vercel.

## Hechos consultados (2026-11-18; volver a verificar en G4)

- La API REST de Upstash admite `EVAL` como `POST` al endpoint con el comando en un arreglo JSON ([doc EVAL](https://upstash.com/docs/redis/commands/scripting/eval)).
- Según Upstash, el pipeline no es atómico; MULTI/EXEC es atómico pero no permite decidir según un valor leído; Lua (EVAL) es atómico y sí lo permite ([blog de Upstash](https://upstash.com/blog/lua-scripting-on-upstash-redis-atomic-operations-over-http)).
- Según la documentación del SDK, el patrón WATCH/MULTI/EXEC no se soporta directamente por REST.
- Upstash documenta que los scripts Lua usan por defecto un bloqueo global ([key locking](https://upstash.com/docs/redis/features/key-locking)): conviene que los scripts sean cortos.

## Opciones

| Opción | Atomicidad condicional | Comentario |
|---|---|---|
| WATCH + MULTI/EXEC | Sí en Redis TCP | No disponible por REST |
| MULTI/EXEC simple | No condiciona por lectura | Insuficiente para CAS |
| **CAS con script Lua corto** | Sí | Lógica de juego en Node; Lua solo compara versión y escribe |
| Toda la lógica en Lua | Sí | Duplica reglas en otro lenguaje; difícil de probar |
| Bloqueo distribuido (SET NX + TTL) | Sí | Añade latencia y casos de bloqueo huérfano |

## Decisión propuesta

**CAS optimista con versión** sobre un Hash `{prefix}:room:{CODE}` con campos `v` y `doc` ([data-model.md](../architecture/data-model.md)).

```lua
-- cas.lua  KEYS[1]=room  ARGV[1]=versión esperada  ARGV[2]=doc nuevo  ARGV[3]=ttl
local v = redis.call('HGET', KEYS[1], 'v')
if not v then return -1 end                 -- sala inexistente: no recrear
if v ~= ARGV[1] then return 0 end           -- conflicto
redis.call('HSET', KEYS[1], 'v', tostring(tonumber(v) + 1), 'doc', ARGV[2])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
return 1
```

- **Crear:** script que escribe solo si `EXISTS` es 0 (equivalente a NX); ante colisión se genera otro código (máx. 5 intentos).
- **Mutar:** `HGET v,doc` → función pura en Node → si cambió, `cas.lua`; ante `0`, releer y recalcular; máximo **5 intentos** con espera aleatoria 20–120 ms y **presupuesto total de 3 s** por petición (PROPUESTA), dentro del `maxDuration` elegido.
- **Eliminar sala vacía:** script que compara versión y hace `DEL` de sala y presencia. Como `cas.lua` devuelve `-1` si la clave no existe, una petición antigua **no puede recrear** una sala eliminada.
- **Sin efectos externos** dentro de la función de mutación (puede ejecutarse varias veces).
- **TTL:** 21 600 s; renovar solo tras autenticar la petición. Credenciales inválidas no renuevan.
- **Unicidad de voto ≠ idempotencia de transporte:** la primera la impone la regla; la segunda, `actionId` ([api-contracts.md](../architecture/api-contracts.md)).
- **Modo local:** `memory-store` con la misma interfaz y serialización JSON para detectar objetos no serializables.

## Consecuencias y riesgos

- (+) Reglas en un solo lenguaje; Lua mínimo y auditable.
- (−) Bajo contención alta, reintentos; con 12 jugadores por sala se estima baja, a medir en T-016.
- ~~Riesgo: compatibilidad real de EVAL en el plan contratado~~ → **verificado** (APR-019): ejecutado por CristianDev el 2026-11-18 15:49 (America/Bogota) con `npm run validate:upstash` contra `up-dragon-176459.upstash.io`, prefijo `farsante:pruebas:validacion-af51e155`; todos los scripts Lua y la concurrencia entre dos instancias funcionaron.
- Riesgo: tamaño del documento (≤ 12 jugadores, ≤ 100 palabras, pistas de 160) estimado en decenas de KiB como máximo; verificar.
