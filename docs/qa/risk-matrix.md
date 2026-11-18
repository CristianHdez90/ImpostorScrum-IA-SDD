# Matriz de riesgos — Farsante Scrum

> **Versión:** 0.1.0 · **Estado:** PROPUESTA G1/G2 · Probabilidad (P) e impacto (I): A alta, M media, B baja (estimación del agente, por revisar).

| ID | Tipo | Riesgo | P | I | Mitigación / validación | Prueba | Dueño |
|---|---|---|---|---|---|---|---|
| R-01 | Seguridad | Filtración de palabra o impostor en DTO, HTML o consola | M | A | Proyección por jugador; pruebas de privacidad por fase | T-004, T-012 | PENDIENTE |
| R-02 | Datos | Pérdida de actualizaciones por concurrencia entre instancias | M | A | CAS con Lua (ADR-0002); pruebas con dos instancias y Redis real | T-016 | PENDIENTE |
| R-03 | Proveedor | EVAL no disponible o con límites en el plan elegido | B | A | Spike en Upstash autorizado antes de G6 | T-016 | PENDIENTE |
| R-04 | Funcional | Vencimientos no recuperados tras inactividad o recuperados desde «ahora» | M | M | `advance` desde `phaseEndsAt` original con tope de pasos | T-017 | PENDIENTE |
| R-05 | Funcional | Petición tardía reactiva partida tras reinicio | M | M | `gameId` + versión; descarte en cliente | T-014 | PENDIENTE |
| R-06 | UX | Revelación accidental al compartir pantalla | A | M | Carta oculta por defecto, advertencia | T-019 | PENDIENTE |
| R-07 | UX/a11y | Re-render cada 1,5 s interrumpe escritura o lector | M | M | Render localizado; prueba de escritura durante sincronización | T-019 | PENDIENTE |
| R-08 | Accesibilidad | Límites de tiempo incumplen 2.2.1 | A | M | D-14 (tiempo ampliado) | T-019 | PENDIENTE |
| R-09 | Seguridad | XSS en campos libres | M | A | `textContent`, CSP | T-018 | PENDIENTE |
| R-10 | Seguridad | Oráculo de validación de pistas | M | B | D-13 | T-006 | PENDIENTE |
| R-11 | Costo | Consultas cada 1,5 s superan cuota | M | M | Fórmula ADR-0003; alertas; D-07 | T-020 | PENDIENTE |
| R-12 | Operación | Preview y Production comparten prefijo Redis | B | A | `REDIS_KEY_PREFIX` obligatorio por entorno; verificación en `/health` (sin exponer valor) | T-020 | PENDIENTE |
| R-13 | Operación | Despliegue automático por push sin autorización G6 | M | A | D-26 `git.deploymentEnabled` | — | PENDIENTE |
| R-14 | UX | QR generado con `localhost` inutilizable en otro dispositivo | A | B | Advertencia; documentación de IP LAN o URL HTTPS | T-002 | PENDIENTE |
| R-15 | Sesión | Cookie `Secure` no se guarda en HTTP LAN | A | B | `Secure` según protocolo (ADR-0004) | T-015 | PENDIENTE |
| R-16 | Funcional | Normalización de pistas bloquea textos legítimos («QA» dentro de otra palabra) | M | M | Coincidencia por tokens completos y ejemplos aprobados (D-12) | T-006 | PENDIENTE |
| R-17 | Continuidad | Pérdida de datos del proveedor | B | B | Salas efímeras aceptadas (S-02) | — | PENDIENTE |
| R-18 | Entrega | No existe repositorio Git ni responsables | A | A | D-01, D-02, D-05 antes de G3/G4 | — | PENDIENTE |
| R-19 | Funcional | Anfitrión desconectado deja la partida sin poder reiniciar | M | B | Plazos avanzan solos; D-16 | T-015 | PENDIENTE |
| R-20 | Funcional | Discrepancias entre los dos prompts aplicadas en silencio | M | M | Registradas como D-29 y D-30 | — | PENDIENTE |
