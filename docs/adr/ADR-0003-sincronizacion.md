# ADR-0003 — Sincronización: consultas periódicas en Vercel y SSE local

> **Estado:** APROBADO para el alcance de SPEC-FEAT-001 (APR-010, 2026-11-18); PROPUESTO para el resto · **Fecha:** 2026-11-18 · **Aprobador:** `[PENDIENTE — D-02]` · **Revisar:** si la latencia percibida no es aceptable (S-01) o cambia el presupuesto (D-07)

## Contexto

Requisito acordado: en Vercel, actualización por consultas periódicas cada ~1,5 s; en local, SSE con memoria. No se promete tiempo real estricto. Si nadie hace peticiones, no hay ejecución de fases en segundo plano: los vencimientos se recuperan en la siguiente petición.

## Opciones

| Opción | Ventajas | Limitaciones |
|---|---|---|
| **Polling encadenado (`setTimeout` tras cada respuesta)** | Peticiones finitas; sin estado de conexión; sin solapes | Latencia ~1,5 s + red; costo proporcional a jugadores conectados |
| SSE en Vercel | Menos peticiones vacías | Conexiones largas cuentan duración de función y requieren fan-out entre instancias (no verificado para este caso) |
| WebSockets / servicio pub-sub externo | Tiempo real | Nuevo proveedor o servicio; fuera de lo acordado |
| Scheduler/cola para vencimientos | Avance sin clientes | Nueva infraestructura; requiere ADR y alcance nuevos |

No se afirma que Vercel carezca de soporte para conexiones largas; la elección es de arquitectura y costo para este juego.

## Decisión propuesta

1. **Cliente:** una sola consulta en vuelo; la siguiente se programa 1 500 ms después de recibir la respuesta. `AbortController` con tiempo límite de 8 s. Ante error: 1,5 → 3 → 6 → 10 s (máx.) y estado «Reconectando…». Al volver la pestaña visible, consulta inmediata. Al salir o cambiar de sala, abortar y descartar.
2. **Orden y obsolescencia:** el cliente aplica un DTO solo si `code` coincide con la sala actual, `gameId` coincide (o la fase es `lobby` tras `reset`) y `version` ≥ la última aplicada. Así una respuesta en vuelo no devuelve la vista a una votación anterior a un reinicio.
3. **Servidor:** cada consulta válida ejecuta `advance` con vencimientos absolutos (`phaseEndsAt`) y persiste la transición con CAS; después proyecta. El contador del cliente se calcula con `deadline - serverNow` corregido por la diferencia de reloj medida, y es solo orientativo.
4. **Presencia:** `connected = now - lastSeen ≤ 30 s`. El latido se escribe en el Hash de presencia **solo si** el último registro tiene más de 10 s (PROPUESTA), para limitar escrituras. No incrementa la versión de la sala.
5. **Local:** SSE en `/api/events`, emitiendo el DTO filtrado de cada jugador tras cada mutación y cerrando los streams al desconectar. La presencia en local se deriva de streams abiertos y latidos.
6. **Errores:** un 5xx o tiempo agotado **no** borra la sesión ni se interpreta como «sala inexistente». Solo `401 SESSION_INVALID` o `404 ROOM_NOT_FOUND` son definitivos.

## Presupuesto (hipótesis explícitas; sin precios)

Comandos Redis por consulta ≈ 1 lectura de sala + 1 lectura de presencia + ~0,15 escrituras de presencia (+ EVAL ocasional) ≈ **2,2**.

| Variable | Símbolo | Valor de ejemplo |
|---|---|---|
| Jugadores conectados | J | 12 |
| Consultas por minuto por jugador | 60 / 1,5 = 40 | 40 |
| Salas activas simultáneas | S | `[PENDIENTE — D-07]` |

- Invocaciones de función por hora ≈ `J × 40 × 60 × S` → con J = 12: **28 800 × S**.
- Comandos Redis por hora ≈ invocaciones × 2,2 → **≈ 63 400 × S**.

Contrastar con los límites y precios **vigentes** de los planes contratados antes de G6; no se presentan planes gratuitos como ilimitados. Proponer alertas de cuota con umbrales acordados ([runbook.md](../operations/runbook.md)).

## Consecuencias

- (+) Robusto ante reinicios de instancias; sin infraestructura adicional.
- (−) Costo lineal con jugadores; latencia de hasta ~2 s percibida.
- Validar S-01 con 12 sesiones (T-016, T-020).
