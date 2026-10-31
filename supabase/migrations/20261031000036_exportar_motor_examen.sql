-- =============================================================================
-- Centro de Datos: exportar las tablas del motor de examen (migración 35).
-- Aditiva: redefine export_fuente y export_begin (copias literales de la migración 34) añadiendo cuatro fuentes
-- en lista blanca: examen_config, examen_sesiones, examen_eventos y examen_tramos. Nada más cambia.
-- =============================================================================

-- Plantilla FIJA de cada fuente. $3 = exportación, $4 = hora de corte. Devuelve null si la fuente no existe.
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
    'examen_config', 'examen_sesiones', 'examen_eventos', 'examen_tramos'];
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


revoke all on function public.export_fuente(text) from public, anon, authenticated;
