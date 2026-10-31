# Telemetría del proceso de respuesta — diccionario de datos

Hay dos capas, que no se sustituyen sino que se complementan.

| Capa | Dónde | Para qué intentos | Qué mide |
|---|---|---|---|
| **v1 · eventos** | tabla `telemetry_events` (migración 29), `src/lib/telemetria/` | todas las prácticas y evaluaciones | hechos puntuales del proceso: vista de una pregunta, primera interacción, ráfagas de edición, guardados, envío, visibilidad, foco, inactividad, conexión |
| **v2 · tramos y eventos oficiales** | tablas `exam_intervals` y `exam_events` (migración 35), `src/lib/examen/` | evaluaciones en modo «una pregunta a la vez» | partición completa del tiempo del intento en tramos con tipo, en hora del servidor, conciliada con los eventos del servidor |

No se registran teclas, ni contenido de las respuestas (solo una huella para saber si cambió), ni nada fuera de la plataforma.

## v1 · `telemetry_events`

| Campo | Significado |
|---|---|
| `session_id`, `seq` | sesión del navegador y número de evento (idempotente: `unique(session_id, seq)`) |
| `kind` | `sesion_inicio`, `pregunta_vista`, `primera_interaccion`, `respuesta_cambio`, `borrador_guardado`, `comprobacion`, `envio`, `visibilidad`, `foco`, `inactividad`, `conexion`, `salida` |
| `exercise_id` | pregunta (si aplica) |
| `t_ms` | milisegundos de reloj monotónico desde el inicio de la sesión; se ancla al servidor con `received_at` |
| `data` | lista blanca (`telemetry_clean`): `h` (huella), `len`, `delta`, `rafaga_ms`, `inicio_ms`, `duracion_ms`, `desde_ms`, `n`, `vacia`, `borrado`, `primera`, `visible`, `ok`, `en_linea`, `navegacion`, `pestana`, `estado`, `fase` |

Reconstrucción: `src/lib/lieia/proceso.ts` (`reconstruir()`).

## v2 · `exam_intervals` (diario de tramos)

Cada instante del intento pertenece a un solo tramo (sin huecos ni solapes dentro de una sesión del navegador).

| Campo | Significado |
|---|---|
| `seq` | número del tramo en el intento (idempotente: `unique(attempt_id, seq)`) |
| `tipo` | `trabajo` · `inactividad` (visible, sin interacción > 60 s) · `pausa_declarada` · `oculta` (página no visible) · `desconexion` (aplicación cerrada) · `desconocido` (sin información fiable) · `fuera_de_pregunta` (pantalla de revisión) |
| `exercise_id` | pregunta activa durante el tramo (null en la revisión) |
| `inicio`, `fin` | hora del servidor (reloj local monotónico + desfase estimado con la menor ida y vuelta) |
| `sin_red` | el navegador no tenía conexión (sigue observando y guardando en el dispositivo) |

Validación al recibir (`exam_journal`): orden, duración positiva y ≤ 6 h, dentro de la sesión (inicio del intento − 5 s … ahora o entrega + 5 s), sin solaparse con lo ya recibido, preguntas del intento. Lo inválido se descarta y queda registrado como evento `rechazo` con su motivo.

## v2 · `exam_events` (hechos oficiales del servidor)

| `tipo` | Cuándo |
|---|---|
| `apertura` | se abre o reabre el examen (incluye la pregunta activa) |
| `ir_a` | cambio de pregunta aceptado por el servidor |
| `pausa`, `reanudacion` | pausa declarada (con permiso, número y total controlados por el servidor) |
| `entrega` | el intento pasa a entregado (disparador) |
| `rechazo` | un tramo del diario no pasó la validación (`data.motivo`) |

## Tiempo observable por pregunta

1. `conciliar(diario, eventos)` reclasifica como `desconocido` lo que contradice al servidor: pausa no registrada, trabajo durante una pausa oficial, fuera de la sesión, pregunta que no estaba activa.
2. `resumirTiempos()` da milisegundos por categoría, en total y por pregunta, y las visitas a cada pregunta.
3. `intervalosDePregunta()` entrega a LIEIA los intervalos de una pregunta, con el tiempo en otras preguntas marcado como `otra_pregunta`. `reconstruirTiempo()` (`src/lib/lieia/d6.ts`) suma el trabajo y excluye la observación solo si no se puede reconstruir.

## Categorías de tiempo que ve el profesor

En la revisión de un intento (motor de examen): trabajo, inactiva, pausa, página oculta, desconectado, desconocido y visitas, por pregunta. Es una descripción del proceso, no un indicador. Una pausa o una página oculta tienen muchas explicaciones legítimas.
