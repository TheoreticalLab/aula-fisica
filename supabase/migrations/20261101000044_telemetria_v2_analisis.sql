-- =============================================================================
-- Telemetría V2 · análisis entre intentos, práctica asistida y Centro de Datos. Migración ADITIVA.
--
-- 1. telemetria_v2_paquete (interna, sin permisos para usuarios): los datos de un intento para la reconstrucción
--    (copia literal del cuerpo de telemetria_v2_intento, migración 42) + los conceptos de cada pregunta y los PASOS
--    de la práctica asistida (inmutables: primer intento con su declaración, correcciones, explicación, transferencia).
-- 2. telemetria_v2_intento: misma firma y mismos permisos y auditoría; ahora devuelve el paquete ampliado.
-- 3. telemetria_v2_actividad: los paquetes de todos los intentos de una actividad (profesorado de la sección; una
--    fila de auditoría por consulta), para el análisis estadístico descriptivo.
-- 4. Centro de Datos: export_fuente y export_begin copiados literalmente de la migración 39 con cinco fuentes más en
--    lista blanca: telemetria_v2, revisiones_respuesta, instantaneas_entrega, asistencia_horarios,
--    asistencia_quorum_eventos. La seudonimización (export_fila) no cambia: user_id ya se seudonimiza.
-- Reversión: no hace falta borrar nada (las funciones nuevas sin uso no tienen efecto).
-- =============================================================================

-- 1 · paquete de un intento (interno) ------------------------------------------------------------------------------
create or replace function public.telemetria_v2_paquete(p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_att public.attempts; v_mode text;
begin
  select * into v_att from public.attempts where id = p_attempt;
  if v_att.id is null then return null; end if;
  select s.presentacion into v_mode from public.exam_settings s where s.activity_id = v_att.activity_id;
  return jsonb_build_object(
    'intento', jsonb_build_object('id', v_att.id, 'inicio', v_att.started_at, 'entrega', v_att.submitted_at, 'estado', v_att.status, 'modo', v_att.mode,
      'actividad', v_att.activity_id, 'leccion', v_att.lesson_id, 'presentacion', v_mode),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', x.id, 'slug', x.slug, 'dificultad', x.difficulty, 'formato', x.format,
        'titulo', left(regexp_replace(x.prompt, '\s+', ' ', 'g'), 80), 'conceptos', to_jsonb(x.concepts)) order by x.pos), '[]')
      from (select e.id, e.slug, e.difficulty, e.format, e.prompt, e.concepts, coalesce(o.position, ai.position, e.position, 1000) as pos
            from public.exercises e
            left join public.attempt_item_orders o on o.attempt_id = p_attempt and o.exercise_id = e.id
            left join public.activity_items ai on ai.activity_id = v_att.activity_id and ai.exercise_id = e.id
            where (v_att.activity_id is not null and ai.exercise_id is not null)
               or (v_att.activity_id is null and e.id in (select s.exercise_id from public.lesson_practice_set(v_att.lesson_id) s))) x),
    'v1', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'session_id', t.session_id, 'seq', t.seq, 'kind', t.kind, 'exercise_id', t.exercise_id,
        't_ms', t.t_ms, 'received_at', t.received_at, 'data', t.data) order by t.session_id, t.seq), '[]')
      from public.telemetry_events t where t.attempt_id = p_attempt),
    'v2', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'event_id', t.event_id, 'session_id', t.session_id, 'tab_id', t.tab_id, 'client_seq', t.client_seq,
        'event_type', t.event_type, 'question_id', t.question_id, 'active_question_id', t.active_question_id, 't_mono', t.t_mono, 'received_at', t.received_at,
        'visibility', t.visibility, 'connectivity', t.connectivity, 'response_rev', t.response_rev, 'payload', t.payload, 'quality_flags', t.quality_flags)
        order by t.session_id, t.client_seq), '[]')
      from public.telemetry_v2_events t where t.attempt_id = p_attempt),
    'tramos', (select coalesce(jsonb_agg(jsonb_build_object('seq', i.seq, 'tipo', i.tipo, 'exercise_id', i.exercise_id, 'inicio', i.inicio, 'fin', i.fin, 'sin_red', i.sin_red) order by i.seq), '[]')
      from public.exam_intervals i where i.attempt_id = p_attempt),
    'servidor', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'tipo', x.tipo, 'exercise_id', x.exercise_id, 't', x.t, 'data', x.data) order by x.t, x.id), '[]')
      from public.exam_events x where x.attempt_id = p_attempt),
    'revisiones', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', v.exercise_id, 'rev', v.rev, 'answer', v.answer, 'answer_hash', v.answer_hash, 'vacia', v.vacia,
        'client_rev', v.client_rev, 'primero_at', v.primero_at, 'ultimo_at', v.ultimo_at, 'consolidados', v.consolidados) order by v.exercise_id, v.rev), '[]')
      from public.response_revisions v where v.attempt_id = p_attempt),
    'evaluaciones', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', r.exercise_id, 'kind', x.kind, 'answer', x.answer, 'result', x.result, 'at', x.created_at)
        order by x.created_at, x.id), '[]')
      from public.response_events x join public.responses r on r.id = x.response_id where r.attempt_id = p_attempt),
    'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', r.exercise_id, 'answer', r.answer, 'status', r.status, 'auto_credit', r.auto_credit,
        'manual_credit', r.manual_credit, 'engine_code', r.engine_code, 'tries', r.tries, 'hints_used', r.hints_used, 'solution_revealed', r.solution_revealed,
        'client_rev', r.client_rev, 'updated_at', r.updated_at)), '[]')
      from public.responses r where r.attempt_id = p_attempt),
    'instantanea', (select to_jsonb(s) - 'user_id' from public.attempt_snapshots s where s.attempt_id = p_attempt),
    -- práctica con aprendizaje asistido (migración 38): pasos inmutables, en orden
    'asistida', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', a.exercise_id, 'fase', a.fase, 'version', a.version, 'answer', a.answer, 'no_se', a.no_se,
        'declaracion', a.declaracion, 'fuentes', to_jsonb(a.fuentes), 'explicacion_presentada', a.reflexion is not null or coalesce(btrim(a.explicacion), '') <> '',
        'transfer_exercise_id', a.transfer_exercise_id, 'status', a.status, 'credit', a.credit, 'engine_code', a.engine_code, 'at', a.created_at)
        order by a.created_at, a.id), '[]')
      from public.assisted_steps a where a.attempt_id = p_attempt));
end;
$$;

-- 2 · lectura de un intento (misma firma, mismos permisos y auditoría que en la migración 42) ------------------------
create or replace function public.telemetria_v2_intento(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_teacher() or not public.can_review_attempt(p_attempt) then raise exception 'No tiene acceso a este intento' using errcode = '42501'; end if;
  insert into public.analytics_audit (actor_id, action, detail) values (auth.uid(), 'consulta_estudiante', jsonb_build_object('telemetria_v2_intento', p_attempt));
  return public.telemetria_v2_paquete(p_attempt);
end;
$$;

-- 3 · todos los intentos de una actividad (análisis descriptivo) -----------------------------------------------------
create or replace function public.telemetria_v2_actividad(p_activity uuid, p_solo_entregados boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null or not public.is_teacher() or not public.is_class_teacher(v_class) then raise exception 'No tiene acceso a esta actividad' using errcode = '42501'; end if;
  insert into public.analytics_audit (actor_id, action, detail) values (auth.uid(), 'consulta_estudiante', jsonb_build_object('telemetria_v2_actividad', p_activity));
  return jsonb_build_object(
    'actividad', (select jsonb_build_object('id', a.id, 'titulo', a.title, 'modo', a.mode, 'class_id', a.class_id) from public.activities a where a.id = p_activity),
    'intentos', (select coalesce(jsonb_agg(jsonb_build_object('estudiante', jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'student_code', p.student_code),
        'numero', t.attempt_number, 'paquete', public.telemetria_v2_paquete(t.id)) order by p.full_name, t.attempt_number), '[]')
      from (select x.* from public.attempts x where x.activity_id = p_activity and (not coalesce(p_solo_entregados, true) or x.status = 'submitted')
            order by x.started_at limit 400) t
      join public.profiles p on p.id = t.user_id));
end;
$$;

-- 4 · Centro de Datos ----------------------------------------------------------------------------------------------
-- Plantilla FIJA de cada fuente (copia literal de la migración 39 + cinco fuentes al final). $3 = exportación, $4 = corte.
create or replace function public.export_fuente(p_tabla text,
  out grupo text, out tabla_real text, out desde_sql text, out clave text, out tipo text, out quitar text[])
language plpgsql immutable set search_path = ''
as $$
declare
  u constant text := '(select x.user_id from public.data_export_users x where x.export_id = $3)';
  a constant text := '(select x.attempt_id from public.data_export_attempts x where x.export_id = $3)';
  -- «= any ((select arreglo)::uuid[])»: la conversión explícita hace que se compare con los ELEMENTOS del arreglo
  -- (con solo paréntesis, PostgreSQL lo trata como subconsulta y compara uuid con uuid[])
  e constant text := '((select d.%s from public.data_exports d where d.id = $3)::uuid[])';
begin
  case p_tabla
  when 'estudiantes' then grupo := 'academico'; tabla_real := 'profiles'; clave := 'md5(t.id::text)'; tipo := 'text'; quitar := '{password_fingerprint}';
    desde_sql := 'public.profiles t where t.id in ' || u;
  when 'profesores' then grupo := 'academico'; tabla_real := 'profiles'; clave := 'md5(t.id::text)'; tipo := 'text'; quitar := '{password_fingerprint,email,login_id,student_code,must_change_password}';
    desde_sql := 'public.profiles t where t.role <> ''student'' and t.id in (select ct.user_id from public.class_teachers ct where ct.class_id = any ' || format(e, 'secciones') || ')';
  when 'cursos' then grupo := 'academico'; tabla_real := 'courses'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.courses t where t.id = any ' || format(e, 'cursos');
  when 'unidades' then grupo := 'academico'; tabla_real := 'units'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.units t where t.course_id = any ' || format(e, 'cursos');
  when 'lecciones' then grupo := 'academico'; tabla_real := 'lessons'; clave := 't.id'; tipo := 'uuid'; quitar := '{theory,formulas,examples,simulation,study}';
    desde_sql := 'public.lessons t where t.course_id = any ' || format(e, 'cursos');
  when 'conceptos' then grupo := 'academico'; tabla_real := 'concepts'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.concepts t where t.course_id = any ' || format(e, 'cursos');
  when 'ejercicios' then grupo := 'academico'; tabla_real := 'exercises'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.exercises t where t.course_id = any ' || format(e, 'cursos');
  when 'claves' then grupo := 'claves'; tabla_real := 'exercise_keys'; clave := 'md5(t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.exercise_keys t where t.exercise_id in (select ex.id from public.exercises ex where ex.course_id = any ' || format(e, 'cursos') || ')';
  when 'secciones' then grupo := 'academico'; tabla_real := 'classes'; clave := 't.id'; tipo := 'uuid'; quitar := '{join_code}';
    desde_sql := 'public.classes t where t.id = any ' || format(e, 'secciones');
  when 'grupos' then grupo := 'academico'; tabla_real := 'class_groups'; clave := 't.id'; tipo := 'uuid'; quitar := '{join_code}';
    desde_sql := 'public.class_groups t where t.class_id = any ' || format(e, 'secciones');
  when 'matriculas' then grupo := 'academico'; tabla_real := 'enrollments'; clave := 'md5(t.class_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.enrollments t where t.class_id = any ' || format(e, 'secciones') || ' and t.user_id in ' || u;
  when 'profesores_seccion' then grupo := 'academico'; tabla_real := 'class_teachers'; clave := 'md5(t.class_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.class_teachers t where t.class_id = any ' || format(e, 'secciones');
  when 'actividades' then grupo := 'academico'; tabla_real := 'activities'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.activities t where t.id = any ' || format(e, 'actividades');
  when 'actividad_items' then grupo := 'academico'; tabla_real := 'activity_items'; clave := 'md5(t.activity_id::text || t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.activity_items t where t.activity_id = any ' || format(e, 'actividades');
  when 'intentos' then grupo := 'academico'; tabla_real := 'attempts'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.attempts t where t.id in ' || a;
  when 'respuestas' then grupo := 'respuestas'; tabla_real := 'responses'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.responses t where t.attempt_id in ' || a;
  when 'eventos_respuesta' then grupo := 'respuestas'; tabla_real := 'response_events'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.response_events t where t.created_at <= $4 and t.response_id in (select r.id from public.responses r where r.attempt_id in ' || a || ')';
  when 'telemetria' then grupo := 'telemetria'; tabla_real := 'telemetry_events'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.telemetry_events t where t.received_at <= $4 and t.attempt_id in ' || a;
  when 'eventos_pregunta' then grupo := 'telemetria'; tabla_real := 'exam_item_events'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.exam_item_events t where t.created_at <= $4 and t.attempt_id in ' || a;
  when 'orden_items' then grupo := 'telemetria'; tabla_real := 'attempt_item_orders'; clave := 'md5(t.attempt_id::text || t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.attempt_item_orders t where t.attempt_id in ' || a;
  when 'visitas' then grupo := 'estudio'; tabla_real := 'study_visits'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.study_visits t, public.data_exports d where d.id = $3 and t.created_at <= $4 and t.user_id in ' || u
      || ' and (t.course_id = any (d.cursos) or (t.course_id is null and not d.restringe_curso))'
      || ' and (d.desde is null or t.started_at >= d.desde::timestamptz) and (d.hasta is null or t.started_at < (d.hasta + 1)::timestamptz)';
  when 'lectura' then grupo := 'estudio'; tabla_real := 'reading_progress'; clave := 'md5(t.user_id::text || t.activity_id::text)'; tipo := 'text';
    desde_sql := 'public.reading_progress t where t.user_id in ' || u || ' and t.activity_id = any ' || format(e, 'actividades');
  when 'asistencia_sesiones' then grupo := 'asistencia'; tabla_real := 'attendance_sessions'; clave := 't.id'; tipo := 'uuid'; quitar := '{code,secret,geo_lat,geo_lng}';
    desde_sql := 'public.attendance_sessions t where t.opened_at <= $4 and t.class_id = any ' || format(e, 'secciones');
  when 'asistencia_registros' then grupo := 'asistencia'; tabla_real := 'attendance_records'; clave := 'md5(t.session_id::text || t.user_id::text)'; tipo := 'text'; quitar := '{lat,lng,device_hash}';
    desde_sql := 'public.attendance_records t where t.user_id in ' || u || ' and t.session_id in (select s.id from public.attendance_sessions s where s.class_id = any ' || format(e, 'secciones') || ')';
  when 'asistencia_rechazos' then grupo := 'asistencia'; tabla_real := 'attendance_rejections'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.attendance_rejections t where t.created_at <= $4 and t.user_id in ' || u || ' and t.session_id in (select s.id from public.attendance_sessions s where s.class_id = any ' || format(e, 'secciones') || ')';
  when 'calif_config' then grupo := 'calificaciones'; tabla_real := 'grade_settings'; clave := 'md5(t.class_id::text)'; tipo := 'text';
    desde_sql := 'public.grade_settings t where t.class_id = any ' || format(e, 'secciones');
  when 'calif_notas' then grupo := 'calificaciones'; tabla_real := 'grade_entries'; clave := 'md5(t.class_id::text || t.user_id::text || t.category)'; tipo := 'text';
    desde_sql := 'public.grade_entries t where t.class_id = any ' || format(e, 'secciones') || ' and t.user_id in ' || u;
  when 'calif_historial' then grupo := 'calificaciones'; tabla_real := 'grade_history'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.grade_history t where t.changed_at <= $4 and t.class_id = any ' || format(e, 'secciones') || ' and t.user_id in ' || u;
  when 'puntos_extra' then grupo := 'calificaciones'; tabla_real := 'extra_points'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.extra_points t where t.created_at <= $4 and t.class_id = any ' || format(e, 'secciones') || ' and t.user_id in ' || u;
  when 'calif_vinculos' then grupo := 'calificaciones'; tabla_real := 'activity_grade_links'; clave := 'md5(t.activity_id::text)'; tipo := 'text';
    desde_sql := 'public.activity_grade_links t where t.activity_id = any ' || format(e, 'actividades');
  when 'mensajes_recibidos' then grupo := 'comunicacion'; tabla_real := 'live_message_recipients'; clave := 'md5(t.message_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.live_message_recipients t where t.created_at <= $4 and t.user_id in ' || u;
  when 'mensajes' then grupo := 'comunicacion'; tabla_real := 'live_messages'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.live_messages t where t.created_at <= $4 and t.id in (select r.message_id from public.live_message_recipients r where r.user_id in ' || u || ')';
  when 'preguntas_relampago' then grupo := 'comunicacion'; tabla_real := 'quick_polls'; clave := 't.id'; tipo := 'uuid'; quitar := '{unlock_code_hash}';
    desde_sql := 'public.quick_polls t where t.created_at <= $4 and t.id in (select r.poll_id from public.quick_poll_recipients r where r.user_id in ' || u || ')';
  when 'preguntas_relampago_respuestas' then grupo := 'comunicacion'; tabla_real := 'quick_poll_recipients'; clave := 'md5(t.poll_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.quick_poll_recipients t where t.user_id in ' || u;
  when 'orbe_ia_mostrados' then grupo := 'comunicacion'; tabla_real := 'orbe_ia_deliveries'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.orbe_ia_deliveries t where t.shown_at <= $4 and t.user_id in ' || u;
  when 'bloqueos' then grupo := 'comunicacion'; tabla_real := 'screen_locks'; clave := 't.id'; tipo := 'uuid'; quitar := '{code_hash}';
    desde_sql := 'public.screen_locks t where t.created_at <= $4 and t.user_id in ' || u;
  when 'entregas_buzones' then grupo := 'comunicacion'; tabla_real := 'upload_boxes'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.upload_boxes t where t.class_id = any ' || format(e, 'secciones');
  when 'entregas_archivos' then grupo := 'comunicacion'; tabla_real := 'upload_files'; clave := 't.id'; tipo := 'uuid'; quitar := '{storage_path}';
    desde_sql := 'public.upload_files t where t.uploaded_at <= $4 and t.user_id in ' || u || ' and t.box_id in (select b.id from public.upload_boxes b where b.class_id = any ' || format(e, 'secciones') || ')';
  when 'entregas_permisos' then grupo := 'comunicacion'; tabla_real := 'upload_permissions'; clave := 'md5(t.box_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.upload_permissions t where t.user_id in ' || u || ' and t.box_id in (select b.id from public.upload_boxes b where b.class_id = any ' || format(e, 'secciones') || ')';
  when 'disenos' then grupo := 'diseno'; tabla_real := 'exam_designs'; clave := 'md5(t.activity_id::text)'; tipo := 'text';
    desde_sql := 'public.exam_designs t where t.activity_id = any ' || format(e, 'actividades');
  when 'diseno_items' then grupo := 'diseno'; tabla_real := 'exam_design_items'; clave := 'md5(t.activity_id::text || t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.exam_design_items t where t.activity_id = any ' || format(e, 'actividades');
  when 'calibraciones' then grupo := 'diseno'; tabla_real := 'item_calibrations'; clave := 'md5(t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.item_calibrations t where t.exercise_id in (select ex.id from public.exercises ex where ex.course_id = any ' || format(e, 'cursos') || ')';
  -- motor de examen (migración 35)
  when 'examen_config' then grupo := 'diseno'; tabla_real := 'exam_settings'; clave := 'md5(t.activity_id::text)'; tipo := 'text'; quitar := '{updated_by}';
    desde_sql := 'public.exam_settings t where t.activity_id = any ' || format(e, 'actividades');
  when 'examen_sesiones' then grupo := 'telemetria'; tabla_real := 'exam_sessions'; clave := 'md5(t.attempt_id::text)'; tipo := 'text';
    desde_sql := 'public.exam_sessions t where t.attempt_id in ' || a;
  when 'examen_eventos' then grupo := 'telemetria'; tabla_real := 'exam_events'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.exam_events t where t.t <= $4 and t.attempt_id in ' || a;
  when 'examen_tramos' then grupo := 'telemetria'; tabla_real := 'exam_intervals'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.exam_intervals t where t.received_at <= $4 and t.attempt_id in ' || a;
  -- prórrogas (migración 37)
  when 'examen_prorrogas' then grupo := 'telemetria'; tabla_real := 'exam_extensions'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.exam_extensions t where t.created_at <= $4 and t.attempt_id in ' || a;
  -- práctica con aprendizaje asistido (migración 38)
  when 'asistida_config' then grupo := 'diseno'; tabla_real := 'assisted_settings'; clave := 'md5(t.activity_id::text)'; tipo := 'text'; quitar := '{updated_by}';
    desde_sql := 'public.assisted_settings t where t.activity_id = any ' || format(e, 'actividades');
  when 'asistida_transferencias' then grupo := 'diseno'; tabla_real := 'assisted_transfer'; clave := 'md5(t.activity_id::text || t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.assisted_transfer t where t.activity_id = any ' || format(e, 'actividades');
  when 'asistida_pasos' then grupo := 'respuestas'; tabla_real := 'assisted_steps'; clave := 't.id'; tipo := 'bigint'; quitar := '{client_id}';
    desde_sql := 'public.assisted_steps t where t.created_at <= $4 and t.attempt_id in ' || a;
  -- Telemetría V2 (migración 42)
  when 'telemetria_v2' then grupo := 'telemetria'; tabla_real := 'telemetry_v2_events'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.telemetry_v2_events t where t.received_at <= $4 and t.attempt_id in ' || a;
  when 'revisiones_respuesta' then grupo := 'respuestas'; tabla_real := 'response_revisions'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.response_revisions t where t.primero_at <= $4 and t.attempt_id in ' || a;
  when 'instantaneas_entrega' then grupo := 'respuestas'; tabla_real := 'attempt_snapshots'; clave := 'md5(t.attempt_id::text)'; tipo := 'text';
    desde_sql := 'public.attempt_snapshots t where t.created_at <= $4 and t.attempt_id in ' || a;
  -- asistencia por quórum (migración 43): horarios e incidencias (sin coordenadas; distancias redondeadas)
  when 'asistencia_horarios' then grupo := 'asistencia'; tabla_real := 'class_schedules'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.class_schedules t where t.class_id = any ' || format(e, 'secciones');
  when 'asistencia_quorum_eventos' then grupo := 'asistencia'; tabla_real := 'attendance_quorum_events'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.attendance_quorum_events t where t.created_at <= $4 and t.user_id in ' || u || ' and t.class_id = any ' || format(e, 'secciones');
  else
    grupo := null;
  end case;
  quitar := coalesce(quitar, '{}');
end;
$$;


create or replace function public.export_begin(p_alcance jsonb, p_modo text, p_contenido text[], p_formatos text[], p_claves boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record; v_id uuid; v_asof timestamptz := now(); v_cont text[]; t text; v_conteos jsonb := '{}'::jsonb; v_tablas text[];
  todas constant text[] := array['estudiantes', 'profesores', 'cursos', 'unidades', 'lecciones', 'conceptos', 'ejercicios', 'claves', 'secciones', 'grupos', 'matriculas',
    'profesores_seccion', 'actividades', 'actividad_items', 'intentos', 'respuestas', 'eventos_respuesta', 'telemetria', 'eventos_pregunta', 'orden_items',
    'visitas', 'lectura', 'asistencia_sesiones', 'asistencia_registros', 'asistencia_rechazos', 'calif_config', 'calif_notas', 'calif_historial',
    'puntos_extra', 'calif_vinculos', 'mensajes_recibidos', 'mensajes', 'preguntas_relampago', 'preguntas_relampago_respuestas', 'orbe_ia_mostrados',
    'bloqueos', 'entregas_buzones', 'entregas_archivos', 'entregas_permisos', 'disenos', 'diseno_items', 'calibraciones',
    'examen_config', 'examen_sesiones', 'examen_eventos', 'examen_tramos',
    'examen_prorrogas', 'asistida_config', 'asistida_transferencias', 'asistida_pasos',
    'telemetria_v2', 'revisiones_respuesta', 'instantaneas_entrega', 'asistencia_horarios', 'asistencia_quorum_eventos'];
begin
  if p_modo is null or p_modo not in ('identificado', 'investigacion') then raise exception 'Modo no válido' using errcode = '22023'; end if;
  select array_agg(distinct c) into v_cont from unnest(coalesce(p_contenido, '{}')) c
    where c in ('academico', 'respuestas', 'telemetria', 'estudio', 'asistencia', 'calificaciones', 'comunicacion', 'diseno');
  v_cont := array(select distinct unnest(coalesce(v_cont, '{}') || array['academico']));   -- lo académico siempre (da contexto)
  if coalesce(p_claves, false) then
    if not public.is_admin() then raise exception 'Solo el administrador puede exportar las claves de respuesta' using errcode = '42501'; end if;
    v_cont := v_cont || array['claves'];
  end if;
  select * into r from public.export_resolver(p_alcance, v_asof);

  -- limpieza: alcances de más de 30 días y exportaciones que quedaron a medias
  delete from public.data_export_users where export_id in (select id from public.data_exports where created_at < now() - interval '30 days');
  delete from public.data_export_attempts where export_id in (select id from public.data_exports where created_at < now() - interval '30 days');
  update public.data_exports set estado = 'incompleta', finished_at = now(), error_code = 'abandonada'
    where estado = 'en_curso' and created_at < now() - interval '1 day';

  insert into public.data_exports (actor_id, as_of, modo, alcance, contenido, formatos, incluye_claves, restringe_curso, cursos, secciones, actividades, desde, hasta)
  values (auth.uid(), v_asof, p_modo, jsonb_build_object('tipo', p_alcance ->> 'tipo', 'ids', coalesce(p_alcance -> 'ids', '[]'::jsonb),
            'desde', r.desde, 'hasta', r.hasta), v_cont, coalesce(p_formatos, '{}'), coalesce(p_claves, false), r.restringe_curso,
          r.cursos, r.secciones, r.actividades, r.desde, r.hasta)
  returning id into v_id;
  insert into public.data_export_users (export_id, user_id) select v_id, x from unnest(r.usuarios) x on conflict do nothing;
  insert into public.data_export_attempts (export_id, attempt_id) select v_id, x from unnest(r.intentos) x on conflict do nothing;

  v_tablas := array(select x from unnest(todas) x where (select grupo from public.export_fuente(x)) = any (v_cont));
  foreach t in array v_tablas loop
    v_conteos := v_conteos || jsonb_build_object(t, public.export_contar(v_id, t, v_asof));
  end loop;
  update public.data_exports set conteos = v_conteos where id = v_id;
  return jsonb_build_object('export_id', v_id, 'as_of', v_asof, 'modo', p_modo, 'contenido', to_jsonb(v_cont), 'conteos', v_conteos,
    'es_admin', public.is_admin(),
    -- identificadores del alcance para el manifiesto: en modo investigación, los de personas van seudonimizados
    'ids_publicos', case when p_modo = 'investigacion' and p_alcance ->> 'tipo' in ('estudiante', 'grupo')
      then (select coalesce(jsonb_agg(public.export_seudonimo(x::uuid)), '[]'::jsonb) from jsonb_array_elements_text(coalesce(p_alcance -> 'ids', '[]'::jsonb)) x)
      else coalesce(p_alcance -> 'ids', '[]'::jsonb) end);
end;
$$;

-- permisos -----------------------------------------------------------------------------------------------------------
do $$ begin
  execute 'revoke all on function public.telemetria_v2_paquete(uuid) from public, anon, authenticated';
  execute 'revoke all on function public.export_fuente(text) from public, anon, authenticated';
  execute 'revoke all on function public.telemetria_v2_intento(uuid), public.telemetria_v2_actividad(uuid, boolean) from public, anon';
  execute 'grant execute on function public.telemetria_v2_intento(uuid), public.telemetria_v2_actividad(uuid, boolean) to authenticated';
end $$;
