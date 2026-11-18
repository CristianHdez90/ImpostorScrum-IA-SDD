# Accesibilidad — objetivo WCAG 2.2 AA

> **Versión:** 0.1.0 · **Estado:** PROPUESTA G2. **No se declara conformidad**: no existe interfaz ni pruebas. Esta matriz define qué se probará y cómo.
>
> Referencias consultadas: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) y documentos *Understanding* enlazados por el prompt maestro.

## 1. Matriz criterio → aplicación → prueba

| Criterio | Aplicación en Farsante Scrum | Prueba prevista (G5) | Evidencia |
|---|---|---|---|
| 1.1.1 Contenido no textual | QR con alternativa (código y enlace en texto); emojis decorativos ocultos | Revisión manual + axe | PENDIENTE |
| 1.3.1 Información y relaciones | Encabezados por pantalla, listas, `fieldset/legend` en votación y grupos | Inspección del árbol de accesibilidad | PENDIENTE |
| 1.3.4 Orientación | Sin bloqueo de orientación | Manual en móvil | PENDIENTE |
| 1.4.1 Uso del color | Conexión, ganador, selección y errores con texto/icono además de color | Manual | PENDIENTE |
| 1.4.3 Contraste mínimo | Tokens con ≥4,5:1 (cálculo teórico en [design-system.md](design-system.md)) | Medición sobre estados renderizados | PENDIENTE |
| 1.4.10 Reflujo | 320 CSS px sin desplazamiento horizontal | E2E con viewport 320 | PENDIENTE |
| 1.4.11 Contraste no textual | Bordes de campos, foco | Medición | PENDIENTE |
| 1.4.12 Espaciado de texto | Sin pérdida de contenido al aumentar espaciado | Bookmarklet / CSS de prueba | PENDIENTE |
| 2.1.1 Teclado | Todo el juego operable por teclado | Recorrido completo solo con teclado | PENDIENTE |
| 2.2.1 Tiempo ajustable | **Riesgo abierto**: turnos 60 s, roles 90 s, debate 45 s, voto 75 s, adivinanza 45 s | Ver §2 | PENDIENTE (D-14) |
| 2.3.1 Destellos | Sin destellos | Revisión | PENDIENTE |
| 2.4.3 Orden del foco | Orden lógico; foco al encabezado al cambiar de fase | Manual | PENDIENTE |
| 2.4.7 / 2.4.11 Foco visible / no oculto | Anillo de 3 px; sin barras fijas que lo tapen | Manual + captura | PENDIENTE |
| 2.5.8 Tamaño del objetivo | ≥24×24 (diseño a 44×44) | Medición | PENDIENTE |
| 3.1.1 Idioma | `<html lang="es">` | Automática | PENDIENTE |
| 3.2.2 Al introducir datos | Seleccionar candidato no envía el voto | E2E | PENDIENTE |
| 3.3.1 / 3.3.3 Errores | Mensajes junto al campo con sugerencia | E2E | PENDIENTE |
| 4.1.2 Nombre, función, valor | Controles nativos; estados `aria-pressed`/`aria-expanded` donde aplique | axe + lector | PENDIENTE |
| 4.1.3 Mensajes de estado | Región `role="status"` para fase, copiado, progreso; `role="alert"` solo para errores | Lector de pantalla (NVDA/VoiceOver) | PENDIENTE |

## 2. Límites de tiempo (2.2.1) — decisión pendiente D-14

WCAG 2.2.1 admite excepciones (tiempo real, esencial, > 20 h). No se asume que el juego quede exento. Opciones:

| Opción | Efecto | Riesgo |
|---|---|---|
| A. Documentar excepción «tiempo real/esencial» | Sin cambio de reglas | Puede no sostenerse: el anfitrión ya puede adelantar fases y los plazos no son esenciales para todos los jugadores |
| B. «Tiempo ampliado» (×2) activable por el anfitrión en el lobby | Cumple la vía «ajustar» antes de empezar | Cambia tiempos acordados → requiere SPEC-FEAT-009 y aprobación |
| C. Pausa del anfitrión | Cumple vía «extender» | Nueva acción y estado; mayor complejidad |

**Propuesta:** B, en una SPEC posterior al MVP básico; mientras tanto, no anunciar conformidad AA.

## 3. Anuncios y foco

- Una sola región `role="status"` (`aria-live="polite"`) para cambios de fase, turno, copiado y progreso de votación; no se marca la raíz como región viva.
- El contador **no** se anuncia cada segundo; propuesta: anunciar una vez a los 10 s restantes del propio turno.
- Errores de formulario: `aria-invalid`, mensaje vinculado y foco en el primer campo con error.
- Al cambiar de fase: foco al `h1` de la pantalla (`tabindex="-1"`), sin robarlo mientras el usuario escribe en una tarea que no cambió.

## 4. Pruebas manuales mínimas por release

Teclado completo, zoom 200 % y 400 %, 320 px, lector de pantalla en un navegador de escritorio y uno móvil, `prefers-reduced-motion`, contraste de estados reales.
