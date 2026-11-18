# SPEC-FEAT-001 — Crear sala privada y unirse

> **Proyecto:** Farsante Scrum · **Versión:** 0.2.0 · **Estado:** IMPLEMENTADA (G4) y verificada localmente (G5 parcial) — pendiente revisión del responsable; sin despliegue
>
> **Constitución:** [`../governance/CONSTITUTION.md`](../governance/CONSTITUTION.md) 1.0.0 — ratificada sin enmiendas (APR-002)
>
> **Responsable de producto y técnico:** CristianDev (APR-001)
>
> **Autorización G3:** APROBADA 2026-11-18 por CristianDev (APR-015) — alcance §07 + CI; CA-01…CA-17
>
> **Requisitos de origen:** RF-001 y parte de RF-009 del prompt maestro; §1 y §Requisitos técnicos de `PROMPT-IMPLEMENTACION.md`.
>
> **ADR aplicables:** [0001](../adr/ADR-0001-stack-y-arquitectura.md), [0002](../adr/ADR-0002-redis-concurrencia-y-ttl.md), [0003](../adr/ADR-0003-sincronizacion.md), [0004](../adr/ADR-0004-sesion-y-credenciales.md), [0005](../adr/ADR-0005-sistema-visual-y-accesibilidad.md) — todos PROPUESTOS.

## 01. Intención

- **Problema del usuario:** un facilitador necesita reunir a su equipo en una sala privada en pocos segundos, sin registro, desde móvil u ordenador.
- **Actor / perfil:** visitante que crea (pasa a anfitrión) y visitantes que se unen (participantes).
- **Resultado esperado:** existe una sala con código de cinco letras; hasta 12 personas aparecen en la sala de espera con su estado de conexión y pueden recargar sin duplicarse.
- **Medida de éxito:** `[POR APROBAR — D-06]`; propuesta vinculada a OBJ-002 (tiempo desde abrir la invitación hasta aparecer en el lobby).

## 02. Comportamiento

### Historias de usuario

- **HU-001:** Como anfitrión, quiero crear una sala privada con código de cinco letras para invitar a mi equipo.
- **HU-002:** Como participante, quiero unirme con código, enlace o QR sin registrarme.
- **HU-003:** Como integrante, quiero ver quién está, quién es anfitrión y quién está conectado.
- **HU-004:** Como integrante, quiero recuperar mi lugar al recargar el navegador.

### Requisitos

| ID | Requisito observable | Prioridad | Origen | Evidencia |
|---|---|---|---|---|
| RF-001.01 | Un visitante crea una sala indicando su nombre; se convierte en anfitrión y la sala queda en `lobby` | P1 | ACORDADO | TEST-001-01 |
| RF-001.02 | El código tiene cinco letras mayúsculas del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ` (24 letras, sin I ni O; APR-006), generadas con aleatoriedad criptográfica y únicas entre salas activas mediante escritura condicional | P1 | ACORDADO | TEST-001-02, -03 |
| RF-001.03 | El nombre tiene 2–26 caracteres contados como grafemas (lo que una persona percibe como un carácter: un emoji = 1) tras recortar y colapsar espacios; es único por sala sin distinguir mayúsculas ni acentos («Ana», «ana» y «Ána» son iguales); se conserva la escritura visible | P1 | ACORDADO + APR-007 | TEST-001-04 |
| RF-001.04 | La sala nueva guarda el grupo «Scrum y equipo» y sus diez palabras desde el catálogo único con los cuatro grupos (APR-008; nombre visible del grupo sujeto a D-30) | P1 | ACORDADO | TEST-001-05 |
| RF-001.05 | Un visitante se une con código y nombre solo si la sala existe, está en `lobby` y tiene < 12 integrantes | P1 | ACORDADO | TEST-001-06…09 |
| RF-001.06 | Se rechazan con mensaje útil: código con formato inválido, sala inexistente o expirada, llena, ya iniciada, nombre inválido o duplicado | P1 | ACORDADO | TEST-001-06…10 |
| RF-001.07 | La sala de espera muestra código, integrantes (n de 12), anfitrión, «tú» y conexión con texto y señal visual | P1 | ACORDADO | TEST-001-11 |
| RF-001.08 | Un integrante se considera conectado si tuvo contacto válido en los últimos 30 s | P1 | ACORDADO | TEST-001-12 |
| RF-001.09 | Se muestra cuántos participantes faltan para el mínimo de 3 (texto informativo; el botón Iniciar llega en SPEC-003) | P2 | ACORDADO | TEST-001-11 |
| RF-001.10 | Se ofrecen código manual, enlace copiable `/?sala=CODIGO` y QR generado localmente | P1 | ACORDADO | TEST-001-13, -14 |
| RF-001.11 | El QR contiene únicamente la URL de invitación con el código; nunca token, rol ni palabra | P1 | ACORDADO | TEST-001-14 |
| RF-001.12 | Si falla el portapapeles o el QR, el enlace sigue visible y seleccionable y el código disponible | P1 | ACORDADO | TEST-001-15 |
| RF-001.13 | Si la página se sirve desde `localhost`/`127.0.0.1`, se advierte que el QR no funcionará en otro dispositivo | P2 | ACORDADO | TEST-001-16 |
| RF-001.14 | Al abrir `/?sala=ABCDE`, el código queda precargado, se muestra «Te invitaron a la sala ABCDE» y el foco va al nombre | P1 | ACORDADO | TEST-001-17 |
| RF-001.15 | Al recargar con sesión válida se recupera el mismo integrante, sin crear otro | P1 | ACORDADO | TEST-001-18 |
| RF-001.16 | Una sesión inválida o una sala expirada se explican y ofrecen volver al inicio; un fallo 5xx o de red muestra «Reconectando…» y **no** borra la sesión | P1 | ACORDADO | TEST-001-19, -20 |
| RF-001.17 | Los cambios del lobby (entradas, conexión) llegan a todos en ≤ ~3 s en Vercel (polling 1,5 s) y en local (SSE) | P1 | ACORDADO | TEST-001-21 |
| RF-001.18 | La sala expira tras 6 h sin peticiones válidas; peticiones con sesión inválida no renuevan el TTL | P1 | ACORDADO | TEST-001-22 |
| RF-001.19 | En Vercel, si Redis no está configurado o falla, se responde `503 STORE_UNAVAILABLE`; nunca se usa memoria como respaldo | P1 | ACORDADO | TEST-001-23 |
| RF-001.20 | Entradas simultáneas al último cupo: exactamente una tiene éxito; el resto recibe `ROOM_FULL`; ninguna entrada se pierde | P1 | ACORDADO | TEST-001-24 |
| RF-001.21 | Abrir la invitación de la misma sala recupera la sesión. Abrir la de **otra** sala muestra el formulario de entrada y el aviso «Ya estás en la sala X» con enlace para volver, sin mezclar identidades ni borrar la sesión anterior. La salida de la sala anterior se resuelve en SPEC-007 (D-25) | P2 | APROBADO (APR-012) | TEST-001-25 |

### Flujo principal — crear

1. **Precondición:** visitante sin sesión en Inicio.
2. Escribe su nombre y pulsa **Crear sala**; el botón se bloquea mientras se procesa.
3. `POST /api/create` → el servidor valida, genera el código con escritura condicional, crea el documento (`schemaVersion: 1`, `phase: lobby`, grupo Scrum), emite cookie de sesión y devuelve `201` con el DTO.
4. El cliente guarda el código de la sala actual en `localStorage` (si está disponible), muestra la sala de espera, genera el QR y anuncia «Sala BCDFG creada» en la región de estado.

### Flujo principal — unirse

1. **Precondición:** visitante con código (manual, enlace o QR).
2. Con `/?sala=CODIGO`, el formulario de entrada aparece con el código precargado y el foco en el nombre.
3. `POST /api/join` → validación → `mutate` atómico (fase `lobby`, cupo, nombre único) → cookie → `201`.
4. Todos los integrantes ven al nuevo participante en su siguiente sincronización.

### Alternativos, límites y fallos

- **Entradas inválidas:** nombre vacío, de 1 o 27+ caracteres, solo espacios; código distinto de 5 letras del alfabeto (el cliente convierte a mayúsculas y elimina espacios antes de validar).
- **Duplicados:** «ana», «Ana» y «Ána» se consideran iguales si se aprueba D-10.
- **Reingreso:** `join` con cookie válida de esa sala → `200` con el estado actual (no crea otro integrante).
- **Permisos:** `GET /api/state` sin cookie válida → `401`; cookie de otra sala → `401`.
- **Red/externo:** tiempo agotado, 5xx o 503 → mensaje recuperable, datos del formulario conservados, reintento con espera creciente.
- **Concurrencia:** dos instancias crean con el mismo código candidato → solo una gana, la otra regenera; varias entradas al último cupo → una sola.
- **Almacenamiento del navegador bloqueado o corrupto:** la app funciona; solo se pierde la recuperación automática al recargar (se informa).
- **Colisiones de código persistentes:** tras 5 intentos → `503` recuperable (probabilidad despreciable; registrado como evento técnico).

### Datos, contratos e integraciones

- **Entradas/salidas:** `POST /api/create`, `POST /api/join`, `GET /api/state` según [api-contracts.md](../architecture/api-contracts.md); DTO de lobby de su §3.
- **Persistencia y retención:** Hash `{prefix}:room:{CODE}` y `{prefix}:presence:{CODE}`, TTL 21 600 s ([data-model.md](../architecture/data-model.md)). Nombre visible retenido mientras exista la sala.
- **Integraciones:** Upstash Redis REST (Vercel y local compartido); memoria (local). `qrcode-generator` en el navegador.
- **Sesión:** cookie `fs_<CODE>` `HttpOnly; SameSite=Strict` (+`Secure` en HTTPS) según [ADR-0004](../adr/ADR-0004-sesion-y-credenciales.md) — sujeta a D-08.

### UX y accesibilidad

Pantallas Inicio, Entrada por invitación y Sala de espera; estados del [catálogo](../ux/flows-and-states.md) para formulario, lista de participantes y compartir. Etiquetas visibles, errores junto al campo, foco al `h1` al entrar al lobby, código legible letra por letra, objetivos de 44×44 px, sin desplazamiento horizontal a 320 px con 12 nombres de 26 caracteres.

### Criterios de aceptación BDD

```gherkin
Característica: Crear sala privada y unirse

  Escenario: CA-01 Crear una sala
    Dado que un visitante está en la página de inicio
    Cuando escribe "Ana" y pulsa "Crear sala"
    Entonces ve la sala de espera con un código de cinco letras sin I ni O
    Y aparece como anfitriona y conectada
    Y el grupo guardado es "Scrum y equipo" con 10 palabras
    Y la respuesta incluye una cookie de sesión HttpOnly y ningún token en el cuerpo ni en la URL

  Escenario: CA-02 Códigos únicos ante colisión
    Dado que el generador propone un código que ya pertenece a una sala activa
    Cuando se crea una sala nueva
    Entonces la sala nueva recibe un código distinto
    Y la sala existente no se modifica

  Escenario: CA-03 Unirse con código manual
    Dado que existe la sala "BCDFG" en espera con 1 integrante
    Cuando un visitante introduce "bcdfg" y el nombre "Luis"
    Entonces entra en la sala "BCDFG"
    Y todos los integrantes ven a "Luis" en su siguiente actualización

  Escenario: CA-04 Invitación precarga el código
    Dado que existe la sala "BCDFG"
    Cuando un visitante abre "/?sala=BCDFG"
    Entonces el campo de código muestra "BCDFG"
    Y el foco está en el campo de nombre
    Y se lee "Te invitaron a la sala BCDFG"

  Escenario: CA-05 QR solo con la invitación
    Dado que el anfitrión ve la sala "BCDFG" servida desde una URL pública
    Cuando se decodifica el QR mostrado con un decodificador independiente
    Entonces el contenido es exactamente "<origen>/?sala=BCDFG"
    Y no contiene token, rol, palabra ni identificador de jugador

  Esquema del escenario: CA-06 Rechazos con mensaje útil
    Dado que la sala "BCDFG" está <situación>
    Cuando un visitante intenta unirse como "<nombre>"
    Entonces recibe el código "<código>" con estado HTTP <http>
    Y ve un mensaje que explica cómo continuar
    Ejemplos:
      | situación                 | nombre | código         | http |
      | inexistente               | Eva    | ROOM_NOT_FOUND | 404  |
      | con 12 integrantes        | Eva    | ROOM_FULL      | 409  |
      | en una partida iniciada   | Eva    | ROOM_STARTED   | 409  |
      | en espera con "Ana"       | ána    | NAME_TAKEN     | 409  |
      | en espera                 | E      | INVALID_NAME   | 400  |

  Escenario: CA-07 Último cupo con entradas simultáneas
    Dado que la sala "BCDFG" tiene 11 integrantes
    Cuando dos visitantes se unen al mismo tiempo desde instancias distintas
    Entonces exactamente uno entra
    Y el otro recibe "ROOM_FULL"
    Y la sala tiene 12 integrantes

  Escenario: CA-08 Recarga sin duplicarse
    Dado que "Luis" está en la sala "BCDFG"
    Cuando recarga el navegador
    Entonces vuelve a la sala de espera como "Luis"
    Y la sala sigue teniendo el mismo número de integrantes

  Escenario: CA-09 Estado de conexión
    Dado que "Luis" está en la sala y cierra su pestaña
    Cuando pasan más de 30 segundos sin contacto de "Luis"
    Entonces los demás ven a "Luis" como "Desconectado" con texto e icono

  Escenario: CA-10 Fallo temporal del almacén
    Dado que "Luis" tiene una sesión válida
    Cuando el servidor responde 503 a sus consultas
    Entonces ve "Reconectando…" y la última lista de integrantes conocida
    Y su sesión no se borra
    Y al recuperarse el servicio vuelve a sincronizar sin recargar

  Escenario: CA-11 Sin respaldo en memoria en Vercel
    Dado un despliegue en Vercel sin variables UPSTASH_REDIS_REST_URL ni UPSTASH_REDIS_REST_TOKEN
    Cuando un visitante intenta crear una sala
    Entonces recibe 503 "STORE_UNAVAILABLE"
    Y no se crea ninguna sala en memoria

  Escenario: CA-12 Acceso sin sesión
    Dado que existe la sala "BCDFG"
    Cuando alguien consulta su estado sin cookie válida de esa sala
    Entonces recibe 401 "SESSION_INVALID"
    Y no recibe nombres de integrantes
    Y el TTL de la sala no se renueva

  Escenario: CA-13 Expiración por inactividad
    Dado que la sala "BCDFG" no recibe peticiones válidas durante 6 horas
    Cuando un integrante intenta consultarla
    Entonces recibe 404 "ROOM_NOT_FOUND"
    Y ve "Esta sala expiró" con la opción de volver al inicio

  Escenario: CA-14 Portapapeles no disponible
    Dado que el navegador bloquea el portapapeles
    Cuando el anfitrión pulsa "Copiar enlace"
    Entonces ve que no se pudo copiar
    Y el enlace queda visible y seleccionable

  Escenario: CA-15 Advertencia de localhost
    Dado que la aplicación se sirve desde "http://localhost:3000"
    Cuando el anfitrión ve el QR
    Entonces ve un aviso de que otros dispositivos no podrán usarlo y cómo usar la IP de la red o una URL pública

  Escenario: CA-16 Nombres con contenido activo
    Dado que un visitante se une con el nombre "<img src=x onerror=alert(1)>"
    Cuando cualquier integrante ve la lista
    Entonces el nombre se muestra como texto literal si cumple la longitud
    Y no se ejecuta ningún script

  Escenario: CA-17 Accesibilidad del lobby
    Dado un integrante que usa solo teclado y lector de pantalla
    Cuando crea o se une a una sala
    Entonces puede completar el flujo sin ratón
    Y el foco visible llega al encabezado de la sala de espera
    Y la entrada de nuevos integrantes se anuncia una vez en la región de estado
```

### Plan de pruebas

| Test ID | CA / RF | Nivel | Datos | Resultado esperado |
|---|---|---|---|---|
| TEST-001-01 | CA-01 | API | Nombre «Ana» | 201, cookie `HttpOnly`, DTO de lobby, `hostId` = solicitante |
| TEST-001-02 | RF-001.02 | Unit | 10⁴ códigos con RNG inyectado | Solo alfabeto aprobado, longitud 5 |
| TEST-001-03 | CA-02 | Integración | Generador forzado a colisionar | Código distinto; sala previa intacta |
| TEST-001-04 | RF-001.03 | Unit | Bordes 1/2/26/27 grafemas, espacios, acentos combinados; «👩‍💻» cuenta 1, «Ana 👩‍💻» cuenta 5 | Aceptación/rechazo según RF-001.03 |
| TEST-001-05 | RF-001.04 | Unit | Catálogo | Grupo `scrum`, 10 palabras exactas |
| TEST-001-06…10 | CA-06 | API | Tabla CA-06 | Códigos HTTP y de negocio |
| TEST-001-11 | RF-001.07/09 | E2E | 3 contextos | Lista, insignias, «faltan N» |
| TEST-001-12 | CA-09 | Unit/API | Reloj controlado 29/31 s | Conectado / desconectado |
| TEST-001-13 | RF-001.10 | E2E | — | Enlace con `?sala=` |
| TEST-001-14 | CA-05 | E2E | Captura del canvas/SVG + `jsqr` | URL exacta |
| TEST-001-15 | CA-14 | E2E | Permiso de portapapeles denegado | Mensaje y enlace seleccionable |
| TEST-001-16 | CA-15 | E2E | Origen `localhost` | Aviso visible |
| TEST-001-17 | CA-04 | E2E | `/?sala=BCDFG` | Precarga y foco |
| TEST-001-18 | CA-08 | E2E | Recarga | Mismo `playerId`, mismo conteo |
| TEST-001-19 | CA-10 | E2E/API | Almacén simulado con fallo | Reconectando, sesión conservada |
| TEST-001-20 | CA-12, CA-13 | API | Cookie ausente/ajena; reloj +6 h | 401 / 404; TTL no renovado |
| TEST-001-21 | RF-001.17 | E2E | 3 contextos, polling y SSE | Actualización en ≤ 3 s |
| TEST-001-22 | RF-001.18 | Integración | Redis simulado con TTL | TTL 21 600 s renovado solo con sesión válida |
| TEST-001-23 | CA-11 | Integración | `VERCEL=1` sin variables | 503, sin `memory-store` |
| TEST-001-24 | CA-07 | Concurrencia | 2 instancias, mismo almacén; luego Upstash real | Exactamente 12 integrantes |
| TEST-001-25 | RF-001.21 | E2E | Sesión en sala A, invitación a sala B | Comportamiento de D-25 |
| TEST-001-26 | CA-16 | E2E/DOM | Cadenas XSS | Texto literal, sin ejecución |
| TEST-001-27 | CA-17 | Manual + axe | Teclado, NVDA/VoiceOver, 320 px | Sin violaciones críticas; recorrido completo |

## 03. Restricciones

- Respetar la Constitución (una vez ratificada) y los ADR aprobados.
- No modificar archivos fuera del alcance G3 listado en §07.
- Validación y autorización en servidor; el cliente nunca envía `playerId`, `isHost` ni rol.
- Sin secretos ni datos reales en código, pruebas, fixtures o capturas; `.env.example` con valores ficticios.
- Sin dependencias adicionales a las de ADR-0001 (y D-18/D-19 si se aprueban).
- No crear cuentas, bases de datos Upstash, proyectos Vercel ni repositorios remotos dentro de esta SPEC; las pruebas contra Upstash real requieren credenciales de un entorno de pruebas provistas por el responsable mediante variables de entorno.

## 04. No-Objetivos

- Selector y editor de grupos de palabras (SPEC-FEAT-002).
- Botón Iniciar, roles y partida (SPEC-FEAT-003 en adelante).
- Salir de la sala y transferir anfitrión (SPEC-FEAT-007).
- `/health`, limitación de solicitudes, vencimientos de fase e idempotencia por `actionId` (SPEC-FEAT-008). **Por ello no se recomienda publicar en Production solo con SPEC-001.**
- Expulsar integrantes, cuentas, chat, analítica.
- No desplegar en producción sin G6.

## 05. Decisiones abiertas / riesgo

| ID | Tema | Estado | Responsable |
|---|---|---|---|
| D-08 | Sesión en cookie `HttpOnly` | RESUELTA (APR-005) | Responsable |
| D-09 | Alfabeto sin I ni O | RESUELTA (APR-006) | Responsable |
| D-10 | Nombres sin distinguir mayúsculas ni acentos | RESUELTA (APR-007) | Responsable |
| D-11 | Caracteres contados como grafemas | RESUELTA (APR-007) | Responsable |
| D-23 | Catálogo completo en esta SPEC | RESUELTA (APR-008) | Responsable |
| D-25 | Otra invitación con sesión activa | Comportamiento mínimo propuesto en RF-001.21; resto diferido a SPEC-007 | Responsable |
| D-05 | Repositorio y rama | El responsable los creará (APR-004); **G4 no empieza hasta que existan**, salvo que el responsable autorice expresamente trabajar sin rama | Responsable |
| D-18, D-19 | Playwright Node + `jsqr`, ESLint | RESUELTA (APR-011) | Responsable |
| R-02, R-03, R-14, R-15 | Ver [risk-matrix.md](../qa/risk-matrix.md) | Abiertos | — |

## 06. Dependencias

| Tipo | Dependencia | Estado |
|---|---|---|
| Gobernanza | Ratificación G0 | Aprobada (APR-001…003); falta nombre y bloque *Ratificación* en `CONSTITUTION.md` |
| Gobernanza | Repositorio Git y rama | Los creará el responsable (APR-004) |
| Diseño | ADR-0001…0005 | APROBADOS para este alcance (APR-010) |
| Herramientas | Node.js LTS disponible en Vercel (24.x/22.x/20.x consultado 2026-11-18) instalado localmente | Por verificar en G4 |
| Paquete | `qrcode-generator`: versión fijada y licencia verificada | Por verificar en G4 |
| Infraestructura (solo G5 real) | Base Upstash de **pruebas**, prefijo propio, credenciales por variables de entorno | Requiere autorización separada |
| Ninguna SPEC previa | — | — |

## 07. Archivos futuros (propuesta de alcance G3 — no creados)

| Ruta | Propósito |
|---|---|
| `package.json`, `package-lock.json` | Scripts `start`, `build`, `test`, `test:e2e`, `lint`; `engines.node`; dependencias de ADR-0001 |
| `.gitignore`, `.env.example` | Excluir `.env`, `node_modules`, `public/vendor/`; nombres de variables con valores ficticios |
| `README.md` | Instalar, ejecutar local (memoria/SSE y Redis), probar, variables, prueba de QR por IP LAN |
| `vercel.json` | Framework «Other», `buildCommand`, `outputDirectory: public`, reescrituras `/api/*` → `api/index.js`, `maxDuration` (propuesta 30 s), cabeceras de seguridad; `git.deploymentEnabled` según D-26 |
| `api/index.js` | Adaptador Vercel |
| `server.js` | Servidor local: estáticos, API, SSE |
| `lib/config.js`, `lib/text.js`, `lib/codes.js`, `lib/room.js`, `lib/projection.js`, `lib/session.js`, `lib/http.js`, `lib/api.js` | Ver [architecture.md](../architecture/architecture.md) §3 |
| `lib/store/index.js`, `lib/store/memory-store.js`, `lib/store/redis-store.js`, `lib/store/scripts.js` | Selección de almacén, memoria, Redis REST con `fetch`, scripts Lua de creación y CAS |
| `public/index.html`, `public/app.js`, `public/styles.css` | Inicio, invitación, lobby, compartir y QR |
| `public/word-themes.js` | Catálogo único (si D-23 = sí) |
| `scripts/build.js` | Copiar `qrcode-generator` a `public/vendor/qrcode.js` (artefacto generado, no editado a mano) |
| `tests/unit/{text,codes,room,projection,session}.test.js` | Dominio |
| `tests/integration/{api-lobby,store-cas,store-selection}.test.js` | API, CAS, selección de almacén |
| `tests/e2e/lobby.spec.js`, `playwright.config.js` | Recorridos (si D-18) |
| `eslint.config.js` | Si D-19 |
| `.github/workflows/ci.yml` | Solo si D-05 elige GitHub; propuesta en [deployment-and-rollback.md](../operations/deployment-and-rollback.md) |

Archivos que **no** se tocarán: `docs/governance/CONSTITUTION.md`, `docs/specs/SPEC-DEV-000-…`, `docs/specs/SPEC-FEAT-TEMPLATE.md`, `AGENTS.md`, los prompts y el zip.

## 08. Autorización y cierre

- **Alcance de archivos autorizado:** §07 completo, incluido `.github/workflows/ci.yml`
- **Autorizó implementación:** CristianDev, 2026-11-18, APR-015 (sin Git: APR-014)
- **Rama / PR:** no aplica (sin Git, APR-014)
- **Pruebas ejecutadas (2026-11-18, sin Git: no hay commit de referencia):**

| Comando | Entorno | Resultado |
|---|---|---|
| `npm ci` / `npm audit` | Equipo de CristianDev (Ubuntu 22.04 en la VM del escritorio, Node 22.23.5, npm 10.9.9) | Instalado; **0 vulnerabilidades** |
| `npm run lint` (ESLint 10.15.0) | Igual | Sin errores |
| `npm run check` | Igual | 17/17 archivos con sintaxis correcta |
| `npm run build` | Igual | `qrcode-generator` 2.0.4 copiado a `public/vendor/qrcode.js` |
| `npm test` (`node:test`) | Igual; repetido 5 veces | **50/50** en cada ejecución (dominio, API, concurrencia) |
| `npm run test:e2e` (Playwright 1.65.1) | **Entorno en la nube de la sesión** (copia de los archivos, mismo Node 22.23.5) con Google Chrome del sistema vía `CHROME_PATH`, porque el equipo no pudo descargar el navegador de Playwright | **26/26** (13 escenarios × escritorio y móvil emulado Pixel 7) |
| Revisión visual | Capturas de inicio, invitación móvil y sala de espera (escritorio y móvil) | Sin problemas de jerarquía ni desbordes |

- **Qué es simulado:** almacén en **memoria** y **Redis simulado** en proceso (reproduce los scripts Lua). **No** se ha probado contra Upstash real ni en Vercel (fuera de alcance, APR-015).
- **Criterios:** CA-01…CA-16 cubiertos por pruebas automáticas (CA-09 y CA-13 a nivel API con reloj controlado; CA-07 con dos instancias sobre el mismo almacén). **CA-17 parcial:** recorrido por teclado y foco verificados; **pendiente** revisión con lector de pantalla y medición de contraste sobre estados renderizados (axe no está entre las dependencias aprobadas).
- **Desviaciones e interpretaciones:**
  - La «ñ» se considera distinta de «n» al comparar nombres (APR-007 habla de acentos; la ñ es una letra). Confirmar.
  - Se rechazan caracteres de control e invisibles en nombres (salvo el unión de emojis).
  - Se añadió `@eslint/js` (configuración recomendada que acompaña a ESLint) como dependencia de desarrollo.
  - Contrato ampliado: campo `sync` en el DTO y códigos `FORBIDDEN_ORIGIN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED` (ver [api-contracts.md](../architecture/api-contracts.md)).
  - Se creó por error `lib/errors.js` fuera del alcance y se eliminó (con permiso de borrado concedido en la sesión); no quedó en el proyecto.
- **Pendiente de verificación fuera de este alcance:** reescritura `/api/:route*` y paso de parámetros en Vercel; EVAL/CAS en Upstash real (T-016); escaneo del QR con un teléfono real en la red local; `/health` y limitación de solicitudes (SPEC-FEAT-008).
- **Revisión del diff:** `[PENDIENTE — CristianDev]`; sin Git, revisar el inventario de archivos de §07
- **Autorización de despliegue G6:** separada; no incluida

### Historial

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.0 | 2026-11-18 | Borrador inicial |
| 0.2.0 | 2026-11-18 | Incorpora APR-001…APR-008: responsables, ratificación, cookie `HttpOnly`, alfabeto sin I/O, nombres y grafemas, catálogo completo; RF-001.21 con comportamiento mínimo |
| 0.2.0 (impl.) | 2026-11-18 | Implementación G4 y evidencia G5 local registradas; la especificación no cambió |
