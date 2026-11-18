# Visión de producto — Farsante Scrum

> **Versión:** 0.1.0 · **Estado:** BORRADOR G1 para revisión · **Responsable:** `[PENDIENTE — D-01]`

## 1. Problema (REQUISITO ACORDADO)

Los equipos necesitan actividades breves que abran conversación sobre colaboración, calidad y prácticas de trabajo. Farsante Scrum usa una asimetría de información (una persona no conoce la palabra) para provocar esa conversación y cerrarla con una reflexión.

## 2. Propuesta de valor (REQUISITO ACORDADO)

Una sala privada, **sin registro**, con roles secretos, pistas por turnos, debate, votación secreta, resultado compartido y reflexión final, jugable desde el móvil o el ordenador durante una reunión presencial o remota.

## 3. Alternativas actuales (SUPUESTO — por validar)

- Juegos genéricos de impostor sin contenido de equipo ni reflexión.
- Dinámicas de retrospectiva facilitadas manualmente (tarjetas, pizarras).
- Dinámicas que reparten roles en papel o por chat, lo que expone el secreto con facilidad.

## 4. Actores

| Actor | Necesidad principal | Permisos |
|---|---|---|
| Visitante | Entender la dinámica, crear sala o entrar con código, enlace o QR | Crear / unirse |
| Anfitrión | Configurar palabras, invitar, iniciar, saltar turno, abrir y cerrar votación, reiniciar | Acciones administrativas validadas en servidor; **juega** y no conoce secretos ajenos |
| Participante | Ver su carta, confirmar, dar pista en su turno y votar una vez | Acciones de juego propias |
| Impostor | Jugar sin la palabra y, si es descubierto, intentar adivinarla | Adivinanza exclusiva en `guess` |

«Observador eliminado» queda **fuera del MVP** (PROPUESTA, D-22): con las reglas acordadas nadie queda eliminado mientras la partida continúa.

## 5. Objetivos (PROPUESTA — PENDIENTE DE ACUERDO, D-06)

No se afirman eficacia pedagógica ni validación con usuarios. Las metas numéricas quedan en blanco hasta que el responsable las fije.

| ID | Objetivo | Indicador propuesto | Meta | Medición sin datos identificables |
|---|---|---|---|---|
| OBJ-001 | Que un grupo nuevo complete una partida sin explicación verbal extensa | % de partidas iniciadas que llegan a `finished` | `[PENDIENTE]` | Contador agregado por fase final, sin nombres ni códigos (requiere SPEC si se implementa) |
| OBJ-002 | Entrar a una sala en poco tiempo desde código, enlace o QR | Tiempo medio desde abrir la invitación hasta aparecer en el lobby | `[PENDIENTE]` | Prueba moderada con usuarios representativos |
| OBJ-003 | Que la reflexión genere conversación útil | Respuesta a una pregunta opcional del facilitador | `[PENDIENTE]` | Encuesta fuera de la app o pregunta en la retro |
| OBJ-004 | No revelar secretos antes de tiempo | 0 filtraciones en pruebas de privacidad (T-004, T-012, T-018) | 0 (PROPUESTA) | Pruebas automatizadas |

## 6. Límites del producto

**Dentro del MVP:** RF-001…RF-009 ([mvp-backlog.md](mvp-backlog.md)).

**Fuera del MVP (REQUISITO ACORDADO):** cuentas y SSO, grabación de reuniones, audio de Teams, chat abierto, pagos, ranking persistente, varios impostores, contenido generado por IA, publicidad y panel administrativo. El grupo «Tecnología e IA» es solo un banco de palabras.

**Fuera del MVP (PROPUESTA):** observador eliminado (D-22), reflexiones específicas para Comida/Música/Tecnología, modo de «tiempo ampliado» (D-14, candidato a SPEC-FEAT-009), analítica.

## 7. Supuestos a validar

| ID | Supuesto | Cómo validarlo |
|---|---|---|
| S-01 | Una consulta cada ~1,5 s ofrece una experiencia aceptable | Prueba con 12 sesiones y medición de latencia percibida |
| S-02 | Las salas son efímeras y aceptan perderse ante un fallo grave del proveedor | Confirmación del responsable (D-07) |
| S-03 | Los equipos usan alias o nombres de pila, no datos sensibles | Texto de ayuda en el formulario; confirmación del responsable |
| S-04 | El juego se usa principalmente en reuniones con pantalla compartida | Entrevista con facilitadores; afecta a la advertencia de la carta |
