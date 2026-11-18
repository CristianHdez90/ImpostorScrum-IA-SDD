# Runbook — Farsante Scrum (propuesta)

> **Versión:** 0.1.0 · **Estado:** PROPUESTA · Responsable de incidentes: `[PENDIENTE — D-02]` · Nada de esto se ha ejecutado.

## 1. Configurar Redis y Vercel (cuando G6 lo autorice)

1. Crear una base Upstash Redis por entorno o compartir una con prefijos distintos (decisión D-07). Región cercana a la de las funciones (verificar).
2. En la consola de Upstash, copiar la URL REST y el token **de lectura y escritura**.
3. En Vercel → Project → Settings → Environment Variables, crear por entorno `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` y `REDIS_KEY_PREFIX`. **No** pegar valores en chats, tickets, capturas ni commits.
4. Desplegar con autorización y comprobar `GET /health` → `200 {"status":"ok","store":"redis"}`.

## 1b. Validar Upstash antes de desplegar

Con el `.env` local configurado: `npm run validate:upstash`. Usa un prefijo propio, borra sus claves y no muestra el token. Resultado esperado: 9/9 (primera ejecución real: APR-019).

## 2. Diagnóstico

| Síntoma | Causa probable | Comprobación | Acción |
|---|---|---|---|
| `/health` 503 en Vercel | Variables ausentes o Redis caído | Variables del entorno; estado de Upstash | Configurar; esperar o escalar al proveedor |
| Todos ven «Reconectando…» | Redis lento/caído, cuota agotada, función con error | Logs de función (sin datos personales), panel de uso | Revisar cuota; rollback si coincide con un despliegue |
| «Sala no encontrada» inesperado | Prefijo distinto entre despliegues, TTL vencido | `REDIS_KEY_PREFIX` del entorno | Corregir variable; las salas no se recuperan |
| Invitados no pueden entrar | Protección de despliegue activa | Abrir la URL en ventana privada | Ajustar protección en Production |
| Conflictos CAS frecuentes | Contención alta o bug | Logs de conflictos | Investigar; no aumentar reintentos sin análisis |
| Costo o uso inesperado | Polling de muchas salas o abuso | Panel de uso; límites de tasa | Alertas acordadas; ajustar D-20 |

## 3. Smoke posdespliegue (T-020)

1. `/health` 200.
2. Desde dos o más dispositivos reales: crear sala, unir 3, escanear el QR con la cámara del móvil.
3. Iniciar; confirmar que el impostor no ve la palabra; pistas con frase; votación; resultado; reflexión.
4. Reiniciar durante una fase activa; comprobar vuelta al lobby.
5. Registrar fecha, URL, commit, dispositivos y resultado. Evidencias con la carta oculta.

## 4. Rotación del token de Redis

Crear el nuevo token en Upstash → actualizar la variable en Vercel → redesplegar → verificar `/health` → revocar el anterior. Registrar la acción sin el valor.

## 5. Observabilidad mínima

Eventos: operación, duración, resultado, conflictos CAS, fallos de dependencia, `requestId`. Métricas y alertas (errores, latencia, peticiones, cuota) con umbrales **por acordar**. `/health` es evidencia puntual, no un SLA.
