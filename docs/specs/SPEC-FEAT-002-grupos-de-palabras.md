# SPEC-FEAT-002 — Grupos de palabras y personalización

> **Proyecto:** Farsante Scrum · **Versión:** 0.1.0 · **Estado:** IMPLEMENTADA (APR-018)
>
> **Constitución:** [`../governance/CONSTITUTION.md`](../governance/CONSTITUTION.md) 1.0.0 — no ratificada · **Responsables:** `[PENDIENTE — D-01/D-02]` · **Autorización G3:** APROBADA 2026-11-18 por CristianDev (APR-018)
>
> **Origen:** RF-002 · **Depende de:** SPEC-FEAT-001

## 01. Intención

- **Problema:** el anfitrión quiere adaptar la dinámica al equipo (Scrum, temas ligeros o palabras propias).
- **Actor:** anfitrión; participantes como lectores.
- **Resultado:** el grupo guardado se ve en la sala; el anfitrión edita sin perder su borrador aunque lleguen actualizaciones.
- **Medida de éxito:** `[POR APROBAR]`.

## 02. Comportamiento

**HU-005:** Como anfitrión, quiero elegir, editar y guardar el grupo de palabras sin perder mi borrador.

| ID | Requisito | Prioridad |
|---|---|---|
| RF-002.01 | Catálogo único (cliente y servidor) con cuatro grupos de exactamente diez conceptos distintos: Scrum y equipo; Comida; Música; Tecnología e IA (listas literales del prompt maestro RF-002) | P1 |
| RF-002.02 | Scrum es el grupo inicial si no hay borrador guardado | P1 |
| RF-002.03 | Selector disponible al crear la sala y para el anfitrión en `lobby`; elegir un grupo carga el editor | P1 |
| RF-002.04 | En una sala existente, los cambios se aplican con **Guardar palabras**; se distingue visualmente borrador y configuración guardada | P1 |
| RF-002.05 | El borrador se conserva cuando entran jugadores o llegan actualizaciones (y tras recarga, en `sessionStorage`, PROPUESTA) | P1 |
| RF-002.06 | Validación: ≥ 3 palabras distintas tras normalizar; ≤ 100; cada una 2–55 caracteres; se permiten conceptos de varias palabras; tratamiento de inválidas según D-17 | P1 |
| RF-002.07 | La comparación normaliza mayúsculas, acentos y espacios sin alterar la escritura visible | P1 |
| RF-002.08 | Los participantes ven el nombre del grupo y la cantidad guardada; los no anfitriones no reciben la lista editable fuera de `lobby` | P1 |
| RF-002.09 | `words` es rechazada fuera de `lobby` (`409 WRONG_PHASE`) y para no anfitriones (`403 NOT_HOST`) | P1 |
| RF-002.10 | Una lista personalizada se etiqueta «Personalizado» | P2 |

**Contrato:** `POST /api/action` `type: "words"`, `payload: { groupId, items[] }`; `POST /api/create` acepta `words` opcional con la misma validación.

```gherkin
Característica: Grupos de palabras

  Escenario: Catálogo inicial
    Cuando se carga el catálogo
    Entonces existen 4 grupos y cada uno tiene 10 palabras distintas
    Y el grupo "Scrum y equipo" contiene "Historia de Usuario" y "Review"

  Escenario: Cambio de tema persiste
    Dado que el anfitrión está en la sala de espera
    Cuando elige "Música" y guarda las palabras
    Y recarga con una sesión válida
    Entonces conserva "Música" y sus diez palabras
    Y los participantes ven el nombre del grupo guardado

  Escenario: Borrador conservado durante la sincronización
    Dado que el anfitrión escribió "Kanban" en el editor sin guardar
    Cuando un nuevo participante entra en la sala
    Entonces el editor sigue mostrando "Kanban" con el cursor en su lugar
    Y se indica "Cambios sin guardar"

  Escenario: Lista demasiado corta
    Cuando el anfitrión guarda solo "Pizza" y "pizza "
    Entonces recibe "INVALID_WORDS" indicando que se necesitan al menos 3 palabras distintas

  Escenario: Participante intenta cambiar palabras
    Dado que "Luis" no es anfitrión
    Cuando envía la acción "words" directamente a la API
    Entonces recibe 403 "NOT_HOST" y las palabras no cambian

  Escenario: Cambio tras iniciar
    Dado que la partida está en "roles"
    Cuando el anfitrión envía "words"
    Entonces recibe 409 "WRONG_PHASE"
```

**Pruebas:** T-003 (E2E/API), unitarias del catálogo y del validador, prueba de edición durante sincronización (R-07).

**UX:** estados del selector en [flows-and-states.md](../ux/flows-and-states.md) §4; emojis decorativos con `aria-hidden` y nombre textual.

## 03. Restricciones

Catálogo en un solo archivo compartido; validación idéntica en cliente y servidor (D-11); sin dependencias nuevas.

## 04. No-Objetivos

Reflexiones específicas para grupos no Scrum; importar/exportar listas; listas guardadas entre salas; generación con IA.

## 05. Decisiones abiertas

D-17 (inválidas), D-30 (nombre del grupo Scrum), D-11.

## 06. Autorización y cierre

Alcance de archivos propuesto: `public/word-themes.js`, `lib/room.js`, `lib/api.js`, `lib/projection.js`, `public/app.js`, `public/styles.css`, pruebas asociadas. Autorización: `[PENDIENTE]`.

## Implementación y evidencia (2026-11-18, APR-018)

- **Estado:** IMPLEMENTADA (G4) y verificada en local (G5 parcial); sin Git, sin despliegue.
- **Pruebas:** `npm test` **89/89** en el equipo de CristianDev (memoria y Redis simulado); `npm run test:e2e` **46/46**, dos ejecuciones seguidas, en el entorno en la nube de la sesión con Chrome del sistema (escritorio y móvil emulado). Detalle en [traceability.md](../qa/traceability.md).
- **Decisiones aplicadas por propuesta (pendientes de confirmación):** ver [approvals.md](../governance/approvals.md) APR-018.
- **Pendiente:** Upstash real, Vercel, lector de pantalla y medición de contraste renderizado.
