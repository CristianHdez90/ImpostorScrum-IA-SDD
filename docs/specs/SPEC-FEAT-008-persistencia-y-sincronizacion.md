# SPEC-FEAT-008 — Persistencia, vencimientos, sincronización y operación

> **Proyecto:** Farsante Scrum · **Versión:** 0.1.0 · **Estado:** IMPLEMENTADA (APR-018) · **Constitución:** 1.0.0 no ratificada · **Responsables:** `[PENDIENTE]` · **Autorización G3:** APROBADA 2026-11-18 por CristianDev (APR-018)
>
> **Origen:** requisitos técnicos de ambos prompts · **Depende de:** SPEC-FEAT-001 (base), 003–006 (fases) · **ADR:** 0002, 0003

## 01. Intención

- **Problema:** el juego debe funcionar entre instancias de Vercel, recuperar fases vencidas sin procesos en segundo plano y ser operable.
- **Actor:** integrantes (experiencia estable), responsable técnico (operación).
- **Resultado:** ninguna acción perdida, fases recuperadas desde sus vencimientos originales, `/health`, límites de abuso y presupuesto estimado.

## 02. Comportamiento

**HU-016, HU-017, HU-018.**

| ID | Requisito | Prioridad |
|---|---|---|
| RF-008T.01 | Toda mutación usa CAS atómico (ADR-0002) con reintentos acotados y presupuesto total por petición | P1 |
| RF-008T.02 | `advance` se ejecuta en cada consulta o acción válida, desde los vencimientos originales y con tope de pasos | P1 |
| RF-008T.03 | Tras inactividad que abarque varias fases, la siguiente petición (desde cualquier instancia) recupera el estado correcto | P1 |
| RF-008T.04 | `actionId` hace idempotentes los reintentos de transporte | P1 |
| RF-008T.05 | `GET /health`: en modo compartido comprueba Redis (`PING`); `200` o `503` genérico, sin secretos ni prefijo | P1 |
| RF-008T.06 | Limitación de solicitudes distribuida (valores D-20) | P1 |
| RF-008T.07 | `REDIS_KEY_PREFIX` separa entornos; en Vercel, falta de variables o fallo de Redis → `503`, nunca memoria | P1 |
| RF-008T.08 | Modo local sin Redis: memoria + SSE, cerrando streams al desconectar | P1 |
| RF-008T.09 | Logs técnicos con `requestId`, operación, duración, resultado y conflictos CAS; sin datos personales ni secretos | P2 |
| RF-008T.10 | Polling encadenado de ~1,5 s con abortado, espera creciente y descarte de respuestas obsoletas | P1 |

```gherkin
Característica: Persistencia y sincronización

  Escenario: Fallo temporal de Redis
    Dado que un jugador tiene una sesión válida
    Cuando Redis deja de responder temporalmente
    Entonces se comunica un fallo recuperable
    Y no se sustituye la sala compartida por una sala en memoria
    Y no se afirma que la sala expiró sin evidencia

  Escenario: Recuperar varias fases vencidas
    Dado una partida en "roles" que inició en t0 y nadie hace peticiones durante 10 minutos
    Cuando un integrante consulta desde otra instancia
    Entonces el estado refleja las transiciones calculadas desde t0 + 90 s y los vencimientos sucesivos
    Y no se reinicia ningún plazo desde el momento de la consulta

  Escenario: Reintento de transporte
    Dado que "Ana" envió un voto con actionId "a1" y perdió la respuesta
    Cuando reenvía la misma acción con actionId "a1"
    Entonces recibe el estado actual sin error y su voto cuenta una sola vez

  Escenario: Health con Redis caído
    Dado el modo compartido con Redis no disponible
    Cuando se consulta "/health"
    Entonces responde 503 con {"status":"unavailable"} sin detalles del proveedor

  Escenario: Prefijos por entorno
    Dado Preview con prefijo "farsante:preview" y Production con "farsante:prod"
    Cuando se crea una sala en Preview
    Entonces no es visible desde Production
```

**Pruebas:** T-016 (dos instancias, simulado y Upstash real), T-017 (vencimientos persistidos), T-018 (límites), T-020 (smoke autorizado).

## 03. Restricciones

Sin scheduler, cola ni servicio adicional (requeriría ADR). Sin `SCAN`/`KEYS` en la aplicación. Validación con Upstash real solo en entorno autorizado.

## 04. No-Objetivos

WebSockets; respaldo de salas; panel de administración; métricas de producto.

## 05. Decisiones abiertas

D-07, D-20, D-27; modo de sincronización local con Redis (polling o SSE).

## 06. Autorización

Alcance propuesto: `lib/store/*`, `lib/game.js` (`advance`), `lib/api.js`, `lib/http.js`, `api/index.js`, `server.js`, `vercel.json`, pruebas de concurrencia y vencimientos. `[PENDIENTE]`.

## Implementación y evidencia (2026-11-18, APR-018)

- **Estado:** IMPLEMENTADA (G4) y verificada en local (G5 parcial); sin Git, sin despliegue.
- **Pruebas:** `npm test` **89/89** en el equipo de CristianDev (memoria y Redis simulado); `npm run test:e2e` **46/46**, dos ejecuciones seguidas, en el entorno en la nube de la sesión con Chrome del sistema (escritorio y móvil emulado). Detalle en [traceability.md](../qa/traceability.md).
- **Decisiones aplicadas por propuesta (pendientes de confirmación):** ver [approvals.md](../governance/approvals.md) APR-018.
- **Pendiente:** Upstash real, Vercel, lector de pantalla y medición de contraste renderizado.
