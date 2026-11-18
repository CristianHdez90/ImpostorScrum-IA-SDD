# Sistema visual propuesto — Farsante Scrum

> **Versión:** 0.1.0 · **Estado:** PROPUESTA G2 (ver [ADR-0005](../adr/ADR-0005-sistema-visual-y-accesibilidad.md)).

## 1. Dirección visual

Lúdica y profesional: tema oscuro, tarjetas claras, código de sala destacado, énfasis en la acción actual, iconos y emojis moderados **siempre acompañados de texto**. Sin animaciones permanentes ni recursos decorativos pesados. Tipografía del sistema (PROPUESTA, D-21): `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; sin solicitudes a fuentes externas.

## 2. Tokens semánticos

### Color (tema oscuro único en el MVP)

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#101321` | Fondo de página (referencia del maestro) |
| `--color-surface` | `#1b2035` | Tarjetas y paneles |
| `--color-text` | `#f5f4ff` | Texto principal (referencia del maestro) |
| `--color-text-muted` | `#b9b7d6` | Texto secundario |
| `--color-accent` | `#5eead4` | Menta: acción principal, conectado |
| `--color-accent-2` | `#b9a3ff` | Violeta: anfitrión, elementos de juego |
| `--color-danger` | `#ff8a8a` | Reiniciar, errores |
| `--color-warning` | `#ffd166` | Advertencias |
| `--color-focus` | `#ffd166` | Anillo de foco |
| `--color-border` | `#737ba0` | Bordes de campos y controles |
| `--color-on-accent` | `#101321` | Texto sobre botones de color |

**Cálculo teórico de contraste** (fórmula de luminancia relativa WCAG; script ejecutado en esta sesión el 2026-11-18 sobre los valores de la tabla). **No es** una auditoría de la interfaz renderizada; debe medirse de nuevo en G5 con los estados reales.

| Combinación | Ratio | Umbral aplicable |
|---|---|---|
| Texto sobre fondo / superficie | 16,94 / 14,77 | 4,5:1 texto |
| Texto secundario sobre fondo / superficie | 9,50 / 8,28 | 4,5:1 |
| Menta sobre fondo / superficie | 12,48 / 10,88 | 4,5:1 |
| Violeta sobre fondo / superficie | 8,57 / 7,47 | 4,5:1 |
| Peligro sobre fondo / superficie | 8,14 / 7,09 | 4,5:1 |
| Foco/advertencia sobre fondo / superficie | 12,81 / 11,16 | 3:1 no textual |
| Borde sobre fondo / superficie | 4,46 / 3,89 | 3:1 no textual (1.4.11) |
| `--color-on-accent` sobre menta / violeta / peligro | 12,48 / 8,57 / 8,14 | 4,5:1 |

Un primer borde candidato (`#5b6285`) dio 2,71:1 sobre superficie y se descartó.

### Tipografía, espacio y forma

| Token | Valores |
|---|---|
| Tamaños | 14 (mínimo, solo metadatos), 16 (base), 20, 24, 32, 48 px (código de sala) en `rem` |
| Altura de línea | 1,5 cuerpo; 1,2 títulos |
| Espaciado | 4, 8, 12, 16, 24, 32, 48 px |
| Radio | 8 px controles, 16 px tarjetas, 999 px insignias |
| Borde | 1 px; 2 px en estado de error |
| Foco | contorno de 3 px `--color-focus` con 2 px de separación; nunca `outline: none` sin reemplazo |
| Elevación | una sombra suave para tarjetas; sin sombras como única separación |
| Movimiento | 150–200 ms en transiciones; desactivado con `prefers-reduced-motion: reduce` |
| Objetivo táctil | 44×44 CSS px (decisión UX; el mínimo AA 2.5.8 es 24×24) |

## 3. Componentes reutilizables

| Componente | Variantes y notas |
|---|---|
| Botón | principal, secundario, peligro (reiniciar), deshabilitado **con motivo visible** cerca, «procesando» |
| Campo de texto | etiqueta visible, ayuda vinculada (`aria-describedby`), contador, error junto al campo |
| Selector de grupo | radio o `select` nativo; emoji decorativo con `aria-hidden` y nombre textual |
| Alerta / región de estado | info, éxito, error; persistente para errores críticos |
| Tarjeta de jugador | nombre completo con ajuste de línea, insignias «Anfitrión», «Tú», «Conectado/Desconectado» (texto + icono) |
| Carta secreta | oculta por defecto; botón «Ver mi carta» / «Ocultar»; contenido no presente en el DOM mientras está oculta (PROPUESTA) |
| Contador | tiempo restante en texto `mm:ss`; no se anuncia cada segundo |
| Historial de pistas | lista ordenada; «Sin pista» explícito |
| Candidato de voto | radio con nombre; confirmación separada |
| Resultados | tabla de recuento ordenada; ganador en texto, no solo color |
| Reflexión | título, texto y pregunta |
| Código y compartir | código grande con separación de letras y lectura letra por letra (`aria-label="Código A B C D E"`), enlace seleccionable, botón copiar, QR con margen claro |

## 4. Responsive

- Móvil primero; probar desde 320 CSS px, orientación horizontal y zoom 200 %/400 % (reflujo).
- Sin desplazamiento horizontal con 12 jugadores, nombres de 26 caracteres, pistas de 160 y palabras compuestas.
- Una columna < 640 px; dos columnas (tarea + contexto) ≥ 960 px.
- La acción principal visible con teclado virtual; sin barras fijas que tapen foco o mensajes.
