# Centro de Datos — exportación, investigación y análisis

Módulo de Orbe Control (pestaña **🗄️ Datos**) para descargar, de forma estructurada, verificable y reproducible,
los datos originales que registra el aula y las métricas derivadas. Migración `20261029000034_centro_datos.sql`;
código en `src/lib/exportacion/` y `orbe-control/src/Datos.tsx`; pruebas en `tests/centro-datos.test.ts` y
`supabase/pruebas/centro_datos.sql`.

## 1. Inventario (auditoría del 2026-10-29, respaldo de producción de esa fecha)

65 tablas. «Exportable» = entra en el Centro de Datos (siempre dentro del alcance y los permisos).

### Académicas y de comportamiento (exportables)

| Fuente exportada | Tabla | Filas | Contenido | Sensible | Notas |
|---|---|---|---|---|---|
| estudiantes | profiles (role=student) | 40 | perfil | **sí** (nombre, correo, matrícula, ID) | `password_fingerprint` nunca; en investigación, seudónimo y sin datos directos |
| profesores | profiles (docentes) | — | nombre del profesorado de la sección | sí | sin correo ni ID de acceso |
| cursos, unidades, lecciones, conceptos | courses, units, lessons, concepts | 4 · 26 · 308 · 703 | estructura del temario | no | lecciones sin el texto de la teoría |
| ejercicios | exercises | 2124 | enunciados, formato, dificultad | no | |
| claves | exercise_keys | 2124 | respuesta correcta, pistas | **protegida** | solo si un administrador la pide |
| secciones, grupos, matrículas, profesores_seccion | classes, class_groups, enrollments, class_teachers | 9 · 0 · 40 · 9 | organización | no | sin códigos de inscripción |
| actividades, actividad_items | activities, activity_items | 5 · 32 | prácticas y evaluaciones | no | |
| intentos | attempts | 61 | inicio, entrega, puntaje | no | 55 de estudiantes |
| respuestas | responses | 278 | **estado final** de cada respuesta | textos libres | se actualiza (último estado) |
| eventos_respuesta | response_events | 341 | historial con contenido: comprobación, entrega, pista, solución, calificación manual | textos libres | |
| eventos_originales | telemetry_events | 2914 | **telemetría del proceso** (sesión, secuencia, `t_ms` monotónico, hora del cliente y de recepción) | no (sin teclas ni texto) | desde el 28-oct; retención 365 días |
| eventos_pregunta | exam_item_events | 248 | cada cambio guardado (huella opaca) | no | desde la migración 27 |
| orden_items | attempt_item_orders | 0 | orden presentado de las preguntas | no | |
| visitas | study_visits | 931 | tiempo por página (efectivo, visible, inactivo, oculto) | no | validado en el servidor |
| lectura | reading_progress | 13 | lectura cronometrada | no | |
| asistencia_* | attendance_sessions, _records, _rejections | 1 · 0 · 0 | asistencia | ubicación | sin código, secreto, coordenadas ni huella del dispositivo |
| calif_* , puntos_extra | grade_settings, grade_entries, grade_history, extra_points, activity_grade_links | 2 · 0 · 0 · 0 · 0 | registro oficial | sí | |
| mensajes, mensajes_recibidos | live_messages, live_message_recipients | 10 · 63 | mensajes emergentes | no | en investigación sin destinatarios |
| preguntas_relampago(_respuestas) | quick_polls, quick_poll_recipients | 0 · 0 | Orbe Control | no | sin el código de desbloqueo |
| orbe_ia_mostrados | orbe_ia_deliveries | 4 | humor mostrado | no | |
| bloqueos | screen_locks | 1 | bloqueos de pantalla | no | sin el código |
| entregas_* | upload_boxes, upload_files, upload_permissions | 0 · 0 · 0 | metadatos de PDF | nombre de archivo | sin el archivo ni su ruta; en investigación sin nombre de archivo |
| disenos, diseno_items, calibraciones | exam_designs, exam_design_items, item_calibrations | 0 · 0 · 0 | diseño experimental y psicometría (LIEIA) | no | |

### No exportables (por diseño)

`auth.users`, `auth.identities` (credenciales) · `login_attempts`, `security_audit`, `security_annotations`, `known_devices`,
`account_events`, `activation_attempts`, `join_failures` (seguridad) · `analytics_audit`, `lieia_audit`, `data_exports` (auditoría) ·
`presence_connections` (solo el estado actual, efímero) · `study_clock`, `study_settings`, `orbe_ia_*` de configuración,
`announcements` (configuración, sin datos por estudiante).

### Lo que los paneles calculan al momento (no se guarda) y cómo se reproduce

| En pantalla | Se reproduce con |
|---|---|
| Cronología por pregunta, tiempo activo, oculto, inactivo, sin conexión, espera final, calidad (LIEIA) | **Incluido**: `metricas_pregunta`, `metricas_intento`, `intervalos_estado`, `calidad_datos` (misma función `reconstruir()`) |
| Detectores LIEIA (D1–D8, P1–P3), calibración 2PL | Funciones de `src/lib/lieia/` sobre `eventos_originales`, `eventos_pregunta`, `respuestas` y `ejercicios` exportados |
| Sesiones de estudio de la ficha | `visitas` (agrupar por estudiante con la pausa configurada) |
| Dominio por concepto | `respuestas` + `ejercicios.concepts` |
| Nota final del registro | `calif_notas` + `puntos_extra` + `calif_config` (fórmula de `src/lib/notas.ts`) |
| Conectados ahora | No reproducible: la presencia es efímera |

## 2. Diseño (compatible con GitHub Pages + Supabase)

- **Servidor (solo lectura):**
  - `export_begin` resuelve el alcance autorizado (estudiantes e intentos), fija la **hora de corte** (`as_of`), cuenta las filas de cada tabla y registra quién exporta, cuándo y con qué alcance (`data_exports`, sin contenido).
  - `export_page` sirve páginas de hasta 5000 filas (paginación por clave, sin límite total) de **41 fuentes en lista blanca**. El nombre pedido nunca entra en el SQL: se elige una plantilla fija.
  - Solo la persona que inició la exportación puede pedir páginas, durante 24 h, y solo de las fuentes que eligió.
- **Permisos:** el administrador puede todo. El profesorado, solo los estudiantes que imparte y sus secciones, asignaturas, actividades e intentos. Los estudiantes no pueden exportar nada.
- **Modo investigación:** los identificadores de personas se sustituyen **en el servidor** por seudónimos estables `E-…`/`P-…` (HMAC-SHA256 con una clave que nunca sale de la base). Así se pueden relacionar entre tablas y entre exportaciones. Seudonimizar no es anonimizar.
- **Navegador (Orbe Control):** descarga las páginas, comprueba los recuentos, calcula las tablas derivadas y genera CSV, JSON Lines, Excel y el script SQLite, con escritores propios y sin dependencias nuevas. Añade manifiesto, README, diccionario y SHA-256 de cada archivo.
- **Nunca parcial:** si algo falla, se cancela o un recuento no coincide, no se entrega ningún archivo y la exportación queda registrada como `incompleta`, `cancelada` o `error`.
- **SQLite:** se entrega `base_datos/investigacion.sql`; `sqlite3 investigacion.sqlite < investigacion.sql` crea la base. Para generar el `.sqlite` binario dentro del navegador hace falta instalar `sql.js` (WebAssembly): `npm install sql.js`.

## 3. Uso

Orbe Control → **🗄️ Datos**:
1. Elige el **alcance** (un estudiante, un grupo, una sección, una asignatura, una actividad, intentos concretos o todo) y, si quieres, fechas.
2. Elige el **contenido**.
3. Elige el **formato** (paquete completo o algunos) y el **modo** (identificado o investigación).
4. Pulsa **Vista previa** (recuentos y avisos) y después **GENERAR EXPORTACIÓN**.

Para conjuntos grandes, mejor desde una computadora.

## 4. Verificación realizada (29-oct, datos reales del respaldo)

- **Paquete completo en los dos modos:** 104 archivos con SHA-256 correcto y recuentos iguales a la fuente (40 estudiantes, 55 intentos, 2914 eventos originales y 2914 normalizados, 312 filas estudiante-pregunta).
- **Modo investigación:** 0 nombres, correos o identificadores reales en todo el paquete.
- **Validación independiente con Python (biblioteca estándar):**
  - ZIP íntegro;
  - CSV, JSON Lines, Excel (52 hojas, sin fórmulas) y SQLite con los mismos recuentos en las 50 tablas;
  - SQLite 3.45.1 con `integrity_check = ok`, 112 índices y 0 relaciones rotas;
  - consultas de ejemplo resueltas: eventos de un intento, latencias por pregunta y distribución de modificaciones.
- **Prueba sintética:** 200 000 eventos completos en unos 20 s.
- **Pendiente:** la prueba SQL del servidor (`supabase/pruebas/centro_datos.sql`) se ejecuta con `npm run probar`.

## 5. Limitaciones

- **Instantánea:** se incluyen las filas creadas hasta el corte; las filas que se actualizan (respuestas, intentos) reflejan su último estado.
- **Telemetría:** existe desde la migración 29 (28-oct). Antes solo hay `eventos_pregunta` (desde la 27) y el historial de comprobaciones.
- **Eventos del navegador:** pueden perderse, retrasarse o manipularse. La falta de eventos no es inactividad; página oculta, inactividad y desconexión pueden superponerse.
- **Excel:** celdas de hasta 32 767 caracteres (lo que supere se recorta solo en el .xlsx, con aviso) y hojas de 1 048 575 filas (se reparte en varias).
- **CSV:** un texto que empieza con = + - @ lleva un apóstrofo delante; JSON y SQL conservan el valor original.
- **ZIP sin ZIP64:** más de 4 GiB o 65 535 archivos produce un aviso; hay que dividir la exportación.
