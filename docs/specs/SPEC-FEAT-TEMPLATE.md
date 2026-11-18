# SPEC-FEAT-NNN — [Nombre de la funcionalidad]

> **Proyecto:** `[NOMBRE]` · **Versión:** 0.1.0 · **Estado:** BORRADOR / APROBADA
>
> **Constitución:** [`../governance/CONSTITUTION.md`](../governance/CONSTITUTION.md)
>
> **Responsable de producto:** `[NOMBRE]` · **Responsable técnico:** `[NOMBRE]`
>
> **Autorización G3:** `[PENDIENTE / APROBADA + FECHA + ALCANCE]`

## 01. Intención

- **Problema del usuario:** `[DESCRIPCIÓN]`
- **Actor / perfil:** `[ACTOR]`
- **Resultado esperado:** `[RESULTADO OBSERVABLE]`
- **Medida de éxito:** `[MÉTRICA REALISTA, POR APROBAR]`

## 02. Comportamiento

### Historia de usuario

Como `[ACTOR]`, quiero `[CAPACIDAD]` para `[BENEFICIO]`.

### Requisitos

| ID | Requisito observable | Prioridad | Evidencia |
|---|---|---|---|
| RF-001 | `[COMPORTAMIENTO]` | `[P1/P2/P3]` | `[TEST / DEMO]` |

### Flujo principal

1. `[PRECONDICIÓN]`
2. `[ACCIÓN]`
3. `[RESULTADO]`

### Alternativos, límites y fallos

- `[ENTRADA VACÍA, INVÁLIDA, DUPLICADA]`
- `[PERMISOS Y AUTORIZACIÓN]`
- `[ERROR DE RED/EXTERNO Y RECUPERACIÓN]`
- `[CONCURRENCIA Y REPETICIÓN, SI APLICA]`

### Datos, contratos e integraciones

- **Entradas/salidas:** `[SCHEMA O CONTRATO]`
- **Persistencia y retención:** `[DESCRIPCIÓN]`
- **Integraciones:** `[DEPENDENCIAS]`

### Criterios de aceptación BDD

```gherkin
Escenario: [Nombre verificable]
  Dado [estado inicial]
  Cuando [acción del actor]
  Entonces [resultado observable]
```

### Plan de pruebas

| Test ID | CA | Nivel | Datos | Resultado esperado |
|---|---|---|---|---|
| TEST-001 | CA-001 | `[UNIT/API/E2E]` | `[DATOS]` | `[RESULTADO]` |

## 03. Restricciones

- Respetar la Constitución vigente y los ADR aplicables.
- No modificar archivos ni contratos fuera del alcance de aprobación G3.
- Validar seguridad, privacidad, errores y accesibilidad cuando correspondan.
- No usar datos reales ni secretos en código o pruebas.
- Definir impactos de migración y rollback cuando aplique.

## 04. No-Objetivos

- `[FUERA DE ALCANCE 1]`
- `[FUERA DE ALCANCE 2]`
- No desplegar en producción como parte de la implementación sin G6.

## 05. Decisiones abiertas / riesgo

| ID | Tema | Estado | Responsable |
|---|---|---|---|
| Q-001 | `[DECISIÓN NECESARIA]` | PENDIENTE | `[RESPONSABLE]` |

## 06. Autorización y cierre

- **Alcance de archivos autorizado:** `[RUTAS / PAQUETES]`
- **Autorizó implementación:** `[PERSONA, FECHA, REFERENCIA]`
- **Rama / PR:** `[ENLACE]`
- **Pruebas ejecutadas:** `[COMANDOS Y RESULTADOS]`
- **Revisión del diff:** `[APROBADOR]`
- **Autorización de despliegue G6:** `[SEPARADA, SI APLICA]`
