/**
 * Centro de Datos · catálogo de fuentes y diccionario de datos.
 * Las fuentes ORIGINALES coinciden una a una con la lista blanca del servidor (export_fuente, migración 34); las
 * DERIVADAS se calculan en el navegador a partir de ellas (metricas.ts) y nunca sustituyen a los datos originales.
 */

export type Naturaleza = 'observado' | 'registrado_por_el_sistema' | 'calculado_y_almacenado' | 'inferido' | 'calculado' | 'no_disponible';

export interface Fuente {
  nombre: string;                    // nombre de la exportación (= export_fuente)
  grupo: 'academico' | 'claves' | 'respuestas' | 'telemetria' | 'estudio' | 'asistencia' | 'calificaciones' | 'comunicacion' | 'diseno';
  carpeta: string;
  tablaOriginal: string;
  descripcion: string;
  clave: string[];
  relaciones?: Record<string, string>;
}

export const GRUPOS: Record<Fuente['grupo'], string> = {
  academico: 'Datos académicos (estudiantes, asignaturas, lecciones, ejercicios, secciones, actividades e intentos)',
  claves: 'Claves de respuesta de los ejercicios (solo administrador)',
  respuestas: 'Respuestas y su historial de comprobaciones y entregas',
  telemetria: 'Telemetría del proceso de respuesta y orden de las preguntas',
  estudio: 'Tiempo de estudio por página y lecturas cronometradas',
  asistencia: 'Asistencia con código',
  calificaciones: 'Registro de calificaciones',
  comunicacion: 'Mensajes, preguntas relámpago, bloqueos, Orbe IA y entregas en PDF',
  diseno: 'Diseño experimental de exámenes y calibración de ítems (LIEIA)',
};

const P = (nombre: string, grupo: Fuente['grupo'], carpeta: string, tablaOriginal: string, descripcion: string, clave: string[], relaciones?: Record<string, string>): Fuente =>
  ({ nombre, grupo, carpeta, tablaOriginal, descripcion, clave, relaciones });

export const FUENTES: Fuente[] = [
  P('estudiantes', 'academico', 'academico', 'profiles', 'Estudiantes del alcance (en modo investigación: seudónimo, sin nombre, correo, matrícula ni ID de acceso).', ['id']),
  P('profesores', 'academico', 'academico', 'profiles', 'Profesorado de las secciones del alcance (sin correo ni ID de acceso).', ['id']),
  P('cursos', 'academico', 'academico', 'courses', 'Asignaturas.', ['id']),
  P('unidades', 'academico', 'academico', 'units', 'Unidades de cada asignatura.', ['id'], { course_id: 'cursos.id' }),
  P('lecciones', 'academico', 'academico', 'lessons', 'Lecciones (sin el texto de la teoría ni los ejemplos: solo su descripción).', ['id'], { unit_id: 'unidades.id', course_id: 'cursos.id' }),
  P('conceptos', 'academico', 'academico', 'concepts', 'Conceptos evaluables por lección.', ['id'], { course_id: 'cursos.id', lesson_id: 'lecciones.id' }),
  P('ejercicios', 'academico', 'academico', 'exercises', 'Preguntas: enunciado, formato, dificultad, conceptos y puntos.', ['id'], { course_id: 'cursos.id', lesson_id: 'lecciones.id' }),
  P('claves', 'claves', 'academico', 'exercise_keys', 'Respuesta correcta, pistas y explicación de cada ejercicio (solo si el administrador lo pidió).', ['exercise_id'], { exercise_id: 'ejercicios.id' }),
  P('secciones', 'academico', 'academico', 'classes', 'Secciones (grupos de clase) de cada asignatura.', ['id'], { course_id: 'cursos.id' }),
  P('grupos', 'academico', 'academico', 'class_groups', 'Subgrupos dentro de una sección.', ['id'], { class_id: 'secciones.id' }),
  P('matriculas', 'academico', 'academico', 'enrollments', 'Matrícula de cada estudiante en cada sección.', ['class_id', 'user_id'], { class_id: 'secciones.id', user_id: 'estudiantes.id', group_id: 'grupos.id' }),
  P('profesores_seccion', 'academico', 'academico', 'class_teachers', 'Profesorado asignado a cada sección.', ['class_id', 'user_id'], { class_id: 'secciones.id', user_id: 'profesores.id' }),
  P('actividades', 'academico', 'academico', 'activities', 'Prácticas y evaluaciones asignadas (fechas, intentos, política de respuestas, lectura previa).', ['id'], { class_id: 'secciones.id', lesson_id: 'lecciones.id' }),
  P('actividad_items', 'academico', 'academico', 'activity_items', 'Ejercicios de cada actividad, con su posición y puntos.', ['activity_id', 'exercise_id'], { activity_id: 'actividades.id', exercise_id: 'ejercicios.id' }),
  P('intentos', 'academico', 'academico', 'attempts', 'Intentos (de actividades o de práctica libre por lección): inicio, entrega, puntaje.', ['id'], { user_id: 'estudiantes.id', course_id: 'cursos.id', activity_id: 'actividades.id', lesson_id: 'lecciones.id' }),
  P('respuestas', 'respuestas', 'academico', 'responses', 'Estado FINAL de cada respuesta (texto o selección, calificación automática y manual, intentos, pistas).', ['id'], { attempt_id: 'intentos.id', exercise_id: 'ejercicios.id', user_id: 'estudiantes.id' }),
  P('eventos_respuesta', 'respuestas', 'academico', 'response_events', 'Historial: cada comprobación, entrega, pista, solución vista o calificación manual, con la respuesta enviada y el resultado.', ['id'], { response_id: 'respuestas.id', user_id: 'estudiantes.id' }),
  P('telemetria', 'telemetria', 'telemetria', 'telemetry_events', 'EVENTOS ORIGINALES del proceso de respuesta (sin teclas ni contenido): sesión, secuencia, reloj monotónico, hora del cliente y de recepción.', ['id'], { attempt_id: 'intentos.id', user_id: 'estudiantes.id', exercise_id: 'ejercicios.id' }),
  P('eventos_pregunta', 'telemetria', 'telemetria', 'exam_item_events', 'Cada cambio guardado de una respuesta (huella opaca de la respuesta y hora del servidor).', ['id'], { attempt_id: 'intentos.id', exercise_id: 'ejercicios.id', user_id: 'estudiantes.id' }),
  P('orden_items', 'telemetria', 'telemetria', 'attempt_item_orders', 'Orden en que se presentaron las preguntas en cada intento (si el examen las barajaba).', ['attempt_id', 'exercise_id'], { attempt_id: 'intentos.id', exercise_id: 'ejercicios.id' }),
  P('visitas', 'estudio', 'estudio', 'study_visits', 'Tiempo de estudio por visita a cada página (efectivo, visible, inactivo, oculto), validado en el servidor.', ['id'], { user_id: 'estudiantes.id', course_id: 'cursos.id', class_id: 'secciones.id', unit_id: 'unidades.id', lesson_id: 'lecciones.id', activity_id: 'actividades.id' }),
  P('lectura', 'estudio', 'estudio', 'reading_progress', 'Lectura cronometrada previa a una actividad (segundos leídos, pausas, finalización).', ['user_id', 'activity_id'], { user_id: 'estudiantes.id', activity_id: 'actividades.id' }),
  P('asistencia_sesiones', 'asistencia', 'asistencia', 'attendance_sessions', 'Sesiones de asistencia abiertas por el profesor (sin el código ni la ubicación exacta).', ['id'], { class_id: 'secciones.id' }),
  P('asistencia_registros', 'asistencia', 'asistencia', 'attendance_records', 'Presencias registradas (sin coordenadas ni huella del dispositivo; con distancia y estado de la ubicación).', ['session_id', 'user_id'], { session_id: 'asistencia_sesiones.id', user_id: 'estudiantes.id' }),
  P('asistencia_rechazos', 'asistencia', 'asistencia', 'attendance_rejections', 'Intentos de marcar asistencia rechazados y su motivo.', ['id'], { session_id: 'asistencia_sesiones.id', user_id: 'estudiantes.id' }),
  P('calif_config', 'calificaciones', 'calificaciones', 'grade_settings', 'Configuración del registro de calificaciones por sección.', ['class_id'], { class_id: 'secciones.id' }),
  P('calif_notas', 'calificaciones', 'calificaciones', 'grade_entries', 'Notas por apartado del registro oficial.', ['class_id', 'user_id', 'category'], { class_id: 'secciones.id', user_id: 'estudiantes.id' }),
  P('calif_historial', 'calificaciones', 'calificaciones', 'grade_history', 'Historial de cambios de notas (antes, después, quién y cuándo).', ['id'], { class_id: 'secciones.id', user_id: 'estudiantes.id' }),
  P('puntos_extra', 'calificaciones', 'calificaciones', 'extra_points', 'Puntos extra solicitados, aprobados o rechazados.', ['id'], { class_id: 'secciones.id', user_id: 'estudiantes.id' }),
  P('calif_vinculos', 'calificaciones', 'calificaciones', 'activity_grade_links', 'Qué actividades cuentan en qué apartado del registro.', ['activity_id'], { activity_id: 'actividades.id', class_id: 'secciones.id' }),
  P('mensajes_recibidos', 'comunicacion', 'comunicacion', 'live_message_recipients', 'Recepción de cada mensaje emergente (entregado, leído, cerrado).', ['message_id', 'user_id'], { message_id: 'mensajes.id', user_id: 'estudiantes.id' }),
  P('mensajes', 'comunicacion', 'comunicacion', 'live_messages', 'Mensajes emergentes del profesor recibidos por estudiantes del alcance.', ['id']),
  P('preguntas_relampago', 'comunicacion', 'comunicacion', 'quick_polls', 'Preguntas relámpago de Orbe Control (sin el código de desbloqueo).', ['id'], { class_id: 'secciones.id' }),
  P('preguntas_relampago_respuestas', 'comunicacion', 'comunicacion', 'quick_poll_recipients', 'Destinatarios de cada pregunta relámpago: la vio, respondió, salió de la plataforma.', ['poll_id', 'user_id'], { poll_id: 'preguntas_relampago.id', user_id: 'estudiantes.id', lock_id: 'bloqueos.id' }),
  P('orbe_ia_mostrados', 'comunicacion', 'comunicacion', 'orbe_ia_deliveries', 'Mensajes de humor de Orbe IA mostrados a cada estudiante y cómo se cerraron.', ['id'], { user_id: 'estudiantes.id', lesson_id: 'lecciones.id' }),
  P('bloqueos', 'comunicacion', 'comunicacion', 'screen_locks', 'Bloqueos de pantalla (sin el código), desbloqueos e intentos fallidos.', ['id'], { user_id: 'estudiantes.id' }),
  P('entregas_buzones', 'comunicacion', 'comunicacion', 'upload_boxes', 'Buzones de entrega de PDF por sección.', ['id'], { class_id: 'secciones.id' }),
  P('entregas_archivos', 'comunicacion', 'comunicacion', 'upload_files', 'Metadatos de los PDF entregados (sin el archivo ni su ruta interna).', ['id'], { box_id: 'entregas_buzones.id', user_id: 'estudiantes.id' }),
  P('entregas_permisos', 'comunicacion', 'comunicacion', 'upload_permissions', 'Autorizaciones de entrega solicitadas y decididas.', ['box_id', 'user_id'], { box_id: 'entregas_buzones.id', user_id: 'estudiantes.id' }),
  P('disenos', 'diseno', 'diseno', 'exam_designs', 'Diseño de cada examen: orden (fijo, aleatorio, contrabalanceado) y versiones.', ['activity_id'], { activity_id: 'actividades.id' }),
  P('diseno_items', 'diseno', 'diseno', 'exam_design_items', 'Papel de cada ítem en el diseño (ancla, isomorfo…).', ['activity_id', 'exercise_id'], { activity_id: 'actividades.id', exercise_id: 'ejercicios.id' }),
  P('calibraciones', 'diseno', 'diseno', 'item_calibrations', 'Calibración psicométrica 2PL de los ítems y su modelo de tiempos.', ['exercise_id'], { exercise_id: 'ejercicios.id' }),
  P('examen_config', 'diseno', 'diseno', 'exam_settings', 'Modo de examen de cada evaluación: presentación, navegación, duración y pausas.', ['activity_id'], { activity_id: 'actividades.id' }),
  P('examen_sesiones', 'telemetria', 'telemetria', 'exam_sessions', 'Sesión oficial de cada intento con el motor de examen (copia de la configuración, pausas usadas, pregunta activa).', ['attempt_id'], { attempt_id: 'intentos.id', user_id: 'estudiantes.id' }),
  P('examen_eventos', 'telemetria', 'telemetria', 'exam_events', 'Eventos OFICIALES del servidor en el examen: apertura, cambio de pregunta, pausa, reanudación, entrega y tramos rechazados.', ['id'], { attempt_id: 'intentos.id', user_id: 'estudiantes.id', exercise_id: 'ejercicios.id' }),
  P('examen_tramos', 'telemetria', 'telemetria', 'exam_intervals', 'Diario de TRAMOS del tiempo del intento (trabajo, inactividad, pausa, oculta, desconexión, desconocido, revisión), en hora del servidor.', ['id'], { attempt_id: 'intentos.id', user_id: 'estudiantes.id', exercise_id: 'ejercicios.id' }),
];

export const fuente = (nombre: string) => FUENTES.find((f) => f.nombre === nombre);

/** Nombre de la tabla en los archivos exportados (igual en CSV, JSON, Excel y SQLite). */
export const nombreSalida = (nombre: string) => (nombre === 'telemetria' ? 'eventos_originales' : nombre);

export interface Derivada { nombre: string; carpeta: string; descripcion: string; clave: string[]; relaciones?: Record<string, string> }

export const DERIVADAS: Derivada[] = [
  { nombre: 'eventos_normalizados', carpeta: 'telemetria', descripcion: 'Cada evento de telemetría con su tiempo alineado al reloj del servidor, tiempo relativo al intento, retraso de recepción y huecos de secuencia. CALCULADO: no sustituye a eventos_originales.', clave: ['id'], relaciones: { id: 'eventos_originales.id', attempt_id: 'intentos.id' } },
  { nombre: 'sesiones_telemetria', carpeta: 'telemetria', descripcion: 'Cada carga de página (sesión) de cada intento: eventos, secuencias, perdidos, llegadas tardías.', clave: ['attempt_id', 'session_id'], relaciones: { attempt_id: 'intentos.id' } },
  { nombre: 'intervalos_estado', carpeta: 'telemetria', descripcion: 'Intervalos de página oculta, inactividad y sin conexión reconstruidos (pueden superponerse).', clave: ['attempt_id', 'n'], relaciones: { attempt_id: 'intentos.id' } },
  { nombre: 'modificaciones', carpeta: 'telemetria', descripcion: 'Cambios de respuesta de las tres fuentes que los registran (telemetría, cambios guardados e historial de comprobaciones), sin mezclarlas.', clave: ['fuente', 'id_origen'], relaciones: { attempt_id: 'intentos.id', exercise_id: 'ejercicios.id' } },
  { nombre: 'calidad_datos', carpeta: 'telemetria', descripcion: 'Calidad de la telemetría de cada intento: eventos, sesiones, perdidos, tardíos, recargas, desfase del reloj del cliente.', clave: ['attempt_id'], relaciones: { attempt_id: 'intentos.id' } },
  { nombre: 'metricas_pregunta', carpeta: 'metricas', descripcion: 'Una fila por intento y pregunta: cronología (primera vista, primera interacción, primera respuesta, edición, revisitas) y resultado.', clave: ['attempt_id', 'exercise_id'], relaciones: { attempt_id: 'intentos.id', exercise_id: 'ejercicios.id' } },
  { nombre: 'metricas_intento', carpeta: 'metricas', descripcion: 'Una fila por intento: duración, tiempo activo, oculto, inactivo, sin conexión, espera final, puntaje y calidad.', clave: ['attempt_id'], relaciones: { attempt_id: 'intentos.id' } },
  { nombre: 'metricas_estudiante', carpeta: 'metricas', descripcion: 'Una fila por estudiante: intentos, respuestas, aciertos, tiempo de estudio y telemetría disponible.', clave: ['user_id'], relaciones: { user_id: 'estudiantes.id' } },
  { nombre: 'resumen_colectivo', carpeta: 'metricas', descripcion: 'Una fila por actividad (o práctica libre de una lección): estudiantes, intentos, puntajes y tiempos.', clave: ['clave_grupo'] },
];

export interface Variable { descripcion: string; unidad?: string; naturaleza: Naturaleza; limitaciones?: string; calculo?: string }

const TS = 'Marca temporal UTC (ISO 8601) del servidor.';
/** Diccionario curado: «tabla.columna» o «*.columna» (vale para cualquier tabla). */
export const VARIABLES: Record<string, Variable> = {
  '*.id': { descripcion: 'Identificador único de la fila (UUID o entero). En modo investigación, el de una persona es un seudónimo estable E-…/P-….', naturaleza: 'registrado_por_el_sistema' },
  '*.user_id': { descripcion: 'Estudiante (o persona) a quien pertenece el registro. En modo investigación: seudónimo estable E-… (HMAC-SHA256 con clave del servidor).', naturaleza: 'registrado_por_el_sistema' },
  '*.attempt_id': { descripcion: 'Intento al que pertenece el registro (intentos.id).', naturaleza: 'registrado_por_el_sistema' },
  '*.exercise_id': { descripcion: 'Pregunta (ejercicios.id).', naturaleza: 'registrado_por_el_sistema' },
  '*.created_at': { descripcion: `${TS} Creación del registro.`, unidad: 'fecha-hora UTC', naturaleza: 'registrado_por_el_sistema' },
  '*.updated_at': { descripcion: `${TS} Última modificación (la fila puede haber cambiado después de crearse).`, unidad: 'fecha-hora UTC', naturaleza: 'registrado_por_el_sistema' },
  'intentos.started_at': { descripcion: `${TS} Inicio del intento.`, unidad: 'fecha-hora UTC', naturaleza: 'registrado_por_el_sistema' },
  'intentos.submitted_at': { descripcion: `${TS} Entrega del intento (vacío = en curso o no entregado).`, unidad: 'fecha-hora UTC', naturaleza: 'registrado_por_el_sistema' },
  'intentos.score': { descripcion: 'Puntaje obtenido según el motor de calificación (y la revisión manual).', unidad: 'puntos', naturaleza: 'calculado_y_almacenado', limitaciones: 'Puede cambiar si el profesor califica manualmente después.' },
  'intentos.max_score': { descripcion: 'Puntaje máximo posible del intento.', unidad: 'puntos', naturaleza: 'calculado_y_almacenado' },
  'intentos.mode': { descripcion: 'practice = práctica (varios intentos, pistas); exam = evaluación (sin pistas, se califica al entregar).', naturaleza: 'registrado_por_el_sistema' },
  'respuestas.answer': { descripcion: 'Respuesta FINAL del estudiante (JSON: text, selected, value, justification…). Textos abiertos completos.', naturaleza: 'observado', limitaciones: 'Puede contener datos personales escritos por el estudiante, también en modo investigación.' },
  'respuestas.status': { descripcion: 'Estado de la respuesta: correct, partial, incorrect, invalid, pending_review, revealed, draft.', naturaleza: 'calculado_y_almacenado' },
  'respuestas.auto_credit': { descripcion: 'Crédito automático del motor de calificación (0 a 1).', unidad: 'fracción', naturaleza: 'calculado_y_almacenado' },
  'respuestas.manual_credit': { descripcion: 'Crédito asignado por el profesor (0 a 1); prevalece sobre el automático.', unidad: 'fracción', naturaleza: 'registrado_por_el_sistema' },
  'respuestas.engine_code': { descripcion: 'Error típico detectado por el motor (p. ej. missing_unit, sign, unit_mismatch).', naturaleza: 'calculado_y_almacenado' },
  'respuestas.tries': { descripcion: 'Número de comprobaciones de la respuesta.', unidad: 'veces', naturaleza: 'registrado_por_el_sistema' },
  'eventos_respuesta.kind': { descripcion: 'check = comprobación; submit = entrega; hint = pista; reveal = vio la solución; manual_grade = calificación manual.', naturaleza: 'registrado_por_el_sistema' },
  'eventos_respuesta.answer': { descripcion: 'Respuesta enviada en ese momento (historial de cambios con contenido).', naturaleza: 'observado' },
  'eventos_respuesta.result': { descripcion: 'Resultado devuelto por el motor (estado, código de error, crédito).', naturaleza: 'calculado_y_almacenado' },
  'eventos_originales.session_id': { descripcion: 'Sesión = cada carga de la página del intento (una recarga abre otra).', naturaleza: 'observado' },
  'eventos_originales.seq': { descripcion: 'Número de secuencia del evento dentro de su sesión (1, 2, 3…). Un salto indica eventos perdidos.', naturaleza: 'observado' },
  'eventos_originales.kind': { descripcion: 'Tipo de evento: sesion_inicio, pregunta_vista, primera_interaccion, respuesta_cambio, borrador_guardado, comprobacion, envio, visibilidad, foco, inactividad, conexion, salida.', naturaleza: 'observado' },
  'eventos_originales.t_ms': { descripcion: 'Reloj MONOTÓNICO del navegador: milisegundos desde el inicio de la sesión (no se ve afectado por cambiar la hora del dispositivo).', unidad: 'ms', naturaleza: 'observado' },
  'eventos_originales.client_wall': { descripcion: 'Hora del dispositivo del estudiante al generar el evento (orientativa; se anula si difería más de un día de la del servidor).', unidad: 'fecha-hora UTC', naturaleza: 'observado', limitaciones: 'El reloj del dispositivo puede estar mal.' },
  'eventos_originales.received_at': { descripcion: 'Hora en que el servidor RECIBIÓ el evento (los eventos se envían por lotes y pueden llegar tarde).', unidad: 'fecha-hora UTC', naturaleza: 'registrado_por_el_sistema' },
  'eventos_originales.data': { descripcion: 'Detalles permitidos del evento (JSON): h = huella de la respuesta, len = longitud, delta = cambio de longitud, rafaga_ms = duración de la ráfaga de edición, visible, en_linea, borrado…', naturaleza: 'observado', limitaciones: 'Nunca contiene teclas ni el texto de la respuesta.' },
  'eventos_pregunta.answer_hash': { descripcion: 'Huella opaca de la respuesta guardada (igual huella = misma respuesta); no permite reconstruirla.', naturaleza: 'registrado_por_el_sistema' },
  'visitas.effective_seconds': { descripcion: 'Segundos de estudio efectivo (página visible, con foco y con actividad reciente), validados por el servidor.', unidad: 's', naturaleza: 'calculado_y_almacenado', limitaciones: 'Estar activo no implica haber leído o comprendido.' },
  'visitas.hidden_seconds': { descripcion: 'Segundos con la página en segundo plano.', unidad: 's', naturaleza: 'calculado_y_almacenado' },
  'visitas.idle_seconds': { descripcion: 'Segundos visibles pero sin actividad (más allá del umbral de inactividad).', unidad: 's', naturaleza: 'calculado_y_almacenado' },
  // derivadas
  'eventos_normalizados.ancla_sesion_utc': { descripcion: 'Inicio estimado de la sesión en el reloj del servidor: mín(recepción − t_ms). La red solo retrasa, así que es la mejor cota.', unidad: 'fecha-hora UTC', naturaleza: 'inferido', calculo: 'min(received_at − t_ms) sobre los eventos de la sesión' },
  'eventos_normalizados.t_alineado_utc': { descripcion: 'Momento estimado del evento en el reloj del servidor (ancla + t_ms).', unidad: 'fecha-hora UTC', naturaleza: 'inferido' },
  'eventos_normalizados.t_intento_s': { descripcion: 'Segundos desde el inicio del intento hasta el evento (tiempo alineado − started_at).', unidad: 's', naturaleza: 'inferido' },
  'eventos_normalizados.retraso_recepcion_s': { descripcion: 'Recepción − tiempo alineado: cuánto tardó en llegar respecto al evento más rápido de la sesión.', unidad: 's', naturaleza: 'calculado' },
  'eventos_normalizados.tardio': { descripcion: 'true si llegó más de 30 s después de lo esperado (mismo criterio que LIEIA).', naturaleza: 'calculado' },
  'eventos_normalizados.hueco_previo': { descripcion: 'Eventos perdidos entre el anterior de la sesión y este (salto de secuencia − 1).', unidad: 'eventos', naturaleza: 'calculado' },
  'eventos_normalizados.llego_desordenado': { descripcion: 'true si se recibió antes que un evento de secuencia menor (llegada fuera de orden; no se reordena el original).', naturaleza: 'calculado' },
  'metricas_pregunta.primera_vista_s': { descripcion: 'Segundos desde el inicio del intento hasta la primera vez que la pregunta estuvo visible.', unidad: 's', naturaleza: 'calculado', limitaciones: 'Requiere telemetría; vacío si no hay eventos.' },
  'metricas_pregunta.primera_interaccion_s': { descripcion: 'Segundos hasta la primera interacción con la pregunta.', unidad: 's', naturaleza: 'calculado' },
  'metricas_pregunta.primera_respuesta_s': { descripcion: 'Segundos hasta la primera entrada no vacía.', unidad: 's', naturaleza: 'calculado' },
  'metricas_pregunta.latencia_s': { descripcion: 'Primera vista → primera entrada no vacía.', unidad: 's', naturaleza: 'calculado', limitaciones: 'Puede incluir períodos sin actividad, cambios de pestaña o intervalos no observados.' },
  'metricas_pregunta.tiempo_edicion_s': { descripcion: 'Primera entrada no vacía → última edición.', unidad: 's', naturaleza: 'calculado' },
  'metricas_pregunta.cambios': { descripcion: 'Ráfagas de edición registradas (un cambio no implica pegado).', unidad: 'veces', naturaleza: 'calculado' },
  'metricas_pregunta.apariciones_de_golpe': { descripcion: 'Ráfagas en que la respuesta creció ≥ 15 caracteres en ≤ 0,3 s. Descriptivo: no prueba que se pegara ni que hubiera fraude.', unidad: 'veces', naturaleza: 'calculado' },
  'metricas_pregunta.activo_s': { descripcion: 'Tiempo activo atribuido a la pregunta (excluye oculto, inactivo y sin conexión).', unidad: 's', naturaleza: 'calculado' },
  'metricas_intento.activo_s': { descripcion: 'Tiempo cronológico menos la unión de oculto, inactivo y sin conexión.', unidad: 's', naturaleza: 'calculado' },
  'metricas_intento.espera_final_s': { descripcion: 'Última modificación → envío.', unidad: 's', naturaleza: 'calculado' },
  'intervalos_estado.tipo': { descripcion: 'oculta = página en segundo plano o sin registro; inactiva = sin actividad; sin_conexion = sin red. Pueden superponerse.', naturaleza: 'inferido', limitaciones: 'La ausencia de eventos no se considera inactividad por sí sola.' },
};

/** Busca la descripción curada de una columna (específica de la tabla o genérica). */
export function variable(tabla: string, columna: string): Variable | undefined {
  return VARIABLES[`${tabla}.${columna}`] ?? VARIABLES[`*.${columna}`];
}

export const VERSION_ESQUEMA = '1.0';
export const VERSION_METRICAS = 'metricas-1.0 (reconstruir() de LIEIA, src/lib/lieia/proceso.ts)';
