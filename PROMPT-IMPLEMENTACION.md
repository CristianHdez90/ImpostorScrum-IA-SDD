# Prompt de implementación de Farsante Scrum

> Para la versión ampliada con gobernanza SDD, detalle técnico, seguridad, QA y diseño UX/UI, usa [PROMPT-MAESTRO-FARSANTE-SCRUM-SDD.md](PROMPT-MAESTRO-FARSANTE-SCRUM-SDD.md). Este archivo conserva el resumen funcional previo.

Implementa un juego web multijugador llamado **Farsante Scrum** para actividades y retrospectivas de equipo.

Si trabajas sobre un proyecto existente, revisa primero su estructura y conserva las funcionalidades que ya funcionan.

## Tecnologías

- HTML5, CSS3 y JavaScript puro para la interfaz.
- Node.js para el servidor y las reglas.
- Vercel para el despliegue.
- Upstash Redis mediante API REST para compartir las salas entre instancias.
- `qrcode-generator` para generar códigos QR localmente.

## Funcionalidades

### 1. Salas y participantes

- Crear salas privadas con un código de cinco letras.
- Permitir entre 3 y 12 participantes, sin registro.
- Mostrar el código, un enlace de invitación y un QR.
- Al abrir la invitación, precargar el código de sala.
- Recuperar la sesión al recargar el navegador.

### 2. Grupos de palabras

- Permitir seleccionar y editar grupos de 10 palabras:
  - **Scrum:** Planning, Review, Daily, Retro, Historia de Usuario, QA, DEV, Refinamiento, Sprint y Backlog.
  - **Comida:** Pizza, Hamburguesa, Arepa, Empanada, Sushi, Tacos, Pasta, Ensalada, Chocolate y Helado.
  - **Música:** Salsa, Reguetón, Rock, Pop, Bachata, Vallenato, Concierto, Guitarra, Karaoke y Playlist.
  - **Tecnología e IA:** Inteligencia Artificial, Chatbot, Prompt, Algoritmo, Automatización, Nube, Ciberseguridad, Robot, Datos y Realidad Virtual.
- Permitir palabras personalizadas.
- El anfitrión puede cambiar y guardar la lista antes de iniciar.
- Conservar el borrador del editor mientras entran otros participantes.

### 3. Inicio y roles

- Solo el anfitrión puede iniciar la partida.
- Exigir al menos tres participantes conectados.
- Elegir una palabra y exactamente un impostor al azar.
- Cada participante ve únicamente su carta.
- El impostor nunca recibe la palabra secreta antes del resultado final.
- Comenzar las pistas cuando todos confirmen sus roles o después de 90 segundos.

### 4. Pistas

- Sortear el orden de participación.
- Permitir una palabra o frase de hasta 160 caracteres.
- Rechazar pistas vacías, repetidas o que incluyan la palabra secreta.
- Aceptar pistas únicamente del participante que tiene el turno.
- Dar 60 segundos por turno y avanzar al enviar una pista o vencer el tiempo.
- Permitir al anfitrión saltar turnos.

### 5. Debate y votación

- Abrir un debate de 45 segundos y una votación secreta de 75 segundos.
- Impedir votos duplicados y votos por uno mismo.
- Cerrar automáticamente cuando todos voten.
- Exigir participación de al menos dos tercios para una eliminación.
- No reducir el total de votantes exigido por una desconexión.
- Mostrar el recuento únicamente al cerrar la votación, sin revelar votos individuales.

### 6. Resultados

- Si hay empate o votos insuficientes, mantener oculta la identidad y comenzar otra ronda después de 18 segundos o cuando lo indique el anfitrión.
- Si un inocente recibe más votos sin empate y con cuórum, terminar la partida con victoria del impostor.
- Mostrar el inocente señalado, sus votos y el verdadero impostor.
- Si descubren al impostor, darle 45 segundos para adivinar la palabra: si acierta, gana; si falla o vence el tiempo, gana el equipo.
- Al finalizar, revelar la palabra y mostrar una reflexión Scrum.
- Crear una reflexión y una pregunta específicas para cada palabra del grupo Scrum, y una reflexión general para otras palabras.
- Mantener las reflexiones ocultas mientras el impostor todavía pueda adivinar.

### 7. Reiniciar y salir

- Mostrar al anfitrión un botón **Reiniciar partida** durante cualquier fase activa.
- Al pulsarlo, regresar a todos a la sala de espera.
- Conservar el código, los participantes y las palabras.
- Limpiar roles, pistas, votos, resultados y temporizadores.
- Desde la sala de espera, permitir salir o comenzar otra partida.
- Si el anfitrión sale, transferir el control a otro participante.

## Requisitos técnicos

- Validar permisos y reglas en el servidor.
- Guardar las salas en Redis y usar actualizaciones atómicas para evitar perder acciones simultáneas.
- Persistir los vencimientos de cada fase y procesarlos al recibir consultas o acciones, recuperando las fases vencidas después de un periodo sin peticiones.
- Actualizar el estado mediante consultas periódicas aproximadamente cada 1,5 segundos en Vercel.
- Considerar desconectado a un participante después de 30 segundos sin contacto.
- Expirar las salas tras seis horas sin peticiones válidas.
- Mantener las credenciales Redis exclusivamente en el servidor.
- Usar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
- Permitir `REDIS_KEY_PREFIX` para separar pruebas y producción.
- No usar almacenamiento en memoria como respaldo en Vercel si Redis no está configurado o falla.
- Mantener un modo local sin Redis usando almacenamiento en memoria y SSE.
- Incluir diseño responsive, mensajes de error claros y estados de conexión.
- Conservar la edición de formularios cuando lleguen actualizaciones del estado.
- Preparar `vercel.json`, compilación, `.env.example` y documentación de despliegue.
- Generar el archivo público de la biblioteca QR durante la compilación.
- Implementar `/health` para comprobar la conexión a Redis en el modo compartido.

## Verificación y entrega

- Agregar pruebas de reglas, privacidad de roles, turnos, frases, votaciones, concurrencia, vencimientos persistidos, reinicio y salida.
- Verificar los grupos de palabras y las reflexiones.
- Probar recorridos completos de navegador con varias sesiones independientes, incluyendo móvil, lectura del QR, recarga y reinicio durante la partida.
- Entregar el proyecto funcional y ejecutar las comprobaciones disponibles.
- Informar qué comprobaciones pasaron y cuáles quedaron pendientes.
- Explicar los pasos para configurar Redis y desplegar en Vercel.
- Distinguir las pruebas con Redis simulado de la validación con Upstash y Vercel reales.
