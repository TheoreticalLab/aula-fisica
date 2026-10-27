-- =============================================================================
-- Ficha completa del estudiante (panel docente): todo lo que el aula sabe de un estudiante en una sola consulta.
--
--   perfil · secciones · accesos (inicios de sesión, presencia, sesiones abiertas) · tiempo de estudio
--   (sesiones de estudio «entró / salió», por día, por contenido, mapa semanal, calidad del dato) · actividades
--   (intentadas y no intentadas, puntajes, lectura, vínculo con el registro) · práctica libre · respuestas
--   (aciertos, errores típicos, ejercicios difíciles, últimas acciones) · calificaciones oficiales (categorías,
--   extras, historial) · comunicación (mensajes y bloqueos) · historial de la cuenta.
--
-- Autorización: profesorado que enseña al estudiante (teaches_student) o administrador. Un profesor ve solo lo de
-- SUS secciones; el detalle técnico de los accesos (dispositivo, país, origen) es solo del administrador, como en
-- el Centro de seguridad. Cada consulta queda auditada (analytics_audit, «consulta_estudiante»).
-- Solo lectura sobre los datos de estudiantes. Aditiva: una función nueva.
-- =============================================================================

create or replace function public.student_dossier(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
  v_gap interval;
  v_login text;
  v_clases uuid[];
  v_cursos uuid[];
  v_perfil jsonb;
  v_accesos jsonb;
  v_estudio jsonb;
  v_sesiones jsonb;
  v_actividades jsonb;
  v_practica jsonb;
  v_respuestas jsonb;
  v_notas jsonb;
  v_otros jsonb;
begin
  if not public.is_teacher() or not public.teaches_student(p_user) then
    raise exception 'No tiene acceso a este estudiante' using errcode = '42501';
  end if;

  select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'login_id', p.login_id, 'student_code', p.student_code,
      'email', p.email, 'role', p.role, 'created_at', p.created_at, 'active', p.active, 'suspended_at', p.suspended_at,
      'must_change_password', p.must_change_password,
      'creado_por', (select c.full_name from public.profiles c where c.id = p.created_by),
      'ultimo_ingreso_auth', (select u.last_sign_in_at from auth.users u where u.id = p.id)),
    p.login_id
  into v_perfil, v_login
  from public.profiles p where p.id = p_user;
  if v_perfil is null then raise exception 'Estudiante no encontrado' using errcode = 'P0002'; end if;

  v_clases := array(select e.class_id from public.enrollments e where e.user_id = p_user and public.is_class_teacher(e.class_id));
  v_cursos := array(select distinct c.course_id from public.classes c where c.id = any(v_clases));
  select make_interval(mins => s.session_gap_minutes) into v_gap from public.study_settings s where s.id = 1;
  v_gap := coalesce(v_gap, interval '30 minutes');

  insert into public.analytics_audit (actor_id, action, detail)
    values (auth.uid(), 'consulta_estudiante', jsonb_build_object('estudiante', p_user, 'ficha', true));

  -- --- accesos -------------------------------------------------------------------------------------------------
  with a as (
    select x.* from public.login_attempts x where x.user_id = p_user or (v_login is not null and x.login_id = v_login)
  )
  select jsonb_build_object(
    'correctos', count(*) filter (where a.success),
    'fallos', count(*) filter (where a.reason in ('bad_password', 'unknown_id', 'suspended')),
    'rechazos', count(*) filter (where a.reason in ('locked', 'rate_ip')),
    'primer_acceso', min(a.created_at) filter (where a.success),
    'ultimo_acceso', max(a.created_at) filter (where a.success),
    'ultimo_fallo', max(a.created_at) filter (where not a.success),
    'dias_con_acceso', count(distinct (a.created_at at time zone 'America/Santo_Domingo')::date) filter (where a.success),
    'en_linea', exists (select 1 from public.presence_connections pc where pc.user_id = p_user and pc.last_seen > now() - interval '75 seconds'),
    'ultima_presencia', (select max(pc.last_seen) from public.presence_connections pc where pc.user_id = p_user),
    'sesiones_abiertas', (select count(*) from auth.sessions s where s.user_id = p_user),
    'detalle_tecnico', v_admin,
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('fecha', z.created_at, 'correcto', z.success, 'motivo', z.reason,
                  'navegador', case when v_admin then z.browser end, 'sistema', case when v_admin then z.os end,
                  'tipo', case when v_admin then z.device_type end, 'pais', case when v_admin then z.country end,
                  'origen', case when v_admin then left(z.ip_hash, 6) end, 'event_id', case when v_admin then z.event_id end)
                  order by z.created_at desc), '[]')
                from (select * from a order by a.created_at desc limit 150) z),
    'dispositivos', case when v_admin then (
        select coalesce(jsonb_agg(jsonb_build_object('navegador', k.browser, 'sistema', k.os, 'tipo', k.device_type, 'desde', k.first_seen,
          'ultimo', k.last_success, 'accesos', k.success_count, 'revocado', k.revoked_at) order by k.last_success desc), '[]')
        from public.known_devices k where k.user_id = p_user) end
  ) into v_accesos from a;

  -- --- tiempo de estudio -----------------------------------------------------------------------------------------
  with v as (
    select x.* from public.study_visits x where x.user_id = p_user and (v_admin or x.class_id = any(v_clases))
  )
  select jsonb_build_object(
    'efectivo', coalesce(sum(v.effective_seconds), 0), 'visible', coalesce(sum(v.visible_seconds), 0),
    'inactivo', coalesce(sum(v.idle_seconds), 0), 'oculto', coalesce(sum(v.hidden_seconds), 0),
    'debil', coalesce(sum(v.weak_seconds), 0), 'rechazado', coalesce(sum(v.clamped_seconds), 0),
    'visitas', count(*), 'visitas_efectivas', count(*) filter (where v.effective_seconds > 0),
    'dias_activos', count(distinct (v.started_at at time zone 'America/Santo_Domingo')::date) filter (where v.effective_seconds > 0),
    'primera', min(v.started_at), 'ultima', max(v.last_beat_at),
    'sin_conexion', count(*) filter (where v.offline_sync),
    'interacciones', coalesce(sum(v.interactions), 0), 'respuestas', coalesce(sum(v.answers), 0),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', z.d, 'efectivo', z.ef, 'visible', z.vi) order by z.d), '[]') from (
        select (y.started_at at time zone 'America/Santo_Domingo')::date d, sum(y.effective_seconds) ef, sum(y.visible_seconds) vi
        from v y where y.started_at > now() - interval '120 days' group by 1) z),
    'por_contenido', (select coalesce(jsonb_agg(jsonb_build_object('tipo', z.tipo, 'titulo', z.titulo, 'seccion', z.sec,
          'efectivo', z.ef, 'visitas', z.n, 'ultima', z.ult) order by z.ef desc), '[]') from (
        select case when y.lesson_id is not null then 'leccion' when y.activity_id is not null then 'actividad' else 'pagina' end tipo,
          coalesce(l.title, ac.title) titulo, y.section sec,
          sum(y.effective_seconds) ef, count(*) n, max(y.last_beat_at) ult
        from v y left join public.lessons l on l.id = y.lesson_id left join public.activities ac on ac.id = y.activity_id
        group by 1, 2, 3 order by 4 desc limit 60) z),
    'mapa', (select coalesce(jsonb_agg(jsonb_build_object('dow', z.dow, 'hora', z.h, 'efectivo', z.ef)), '[]') from (
        select extract(isodow from y.started_at at time zone 'America/Santo_Domingo')::int dow,
          extract(hour from y.started_at at time zone 'America/Santo_Domingo')::int h, sum(y.effective_seconds) ef
        from v y where y.effective_seconds > 0 group by 1, 2) z)
  ) into v_estudio from v;

  -- Sesiones de estudio: visitas consecutivas separadas por menos del intervalo configurado (study_settings)
  with v as (
    select x.* from public.study_visits x where x.user_id = p_user and (v_admin or x.class_id = any(v_clases))
  ), o as (
    select v.*, max(v.last_beat_at) over (order by v.started_at, v.id rows between unbounded preceding and 1 preceding) prev_fin from v
  ), g as (
    select o.*, sum(case when o.prev_fin is null or o.started_at - o.prev_fin > v_gap then 1 else 0 end)
      over (order by o.started_at, o.id) ses from o
  ), s as (
    select g.ses, min(g.started_at) ini, max(g.last_beat_at) fin, sum(g.effective_seconds) ef, sum(g.visible_seconds) vi,
      count(*) n, sum(g.answers) resp, bool_or(g.offline_sync) offl,
      array_remove(array_agg(distinct coalesce(l.title, ac.title)), null) titulos,
      array_remove(array_agg(distinct case when g.lesson_id is null and g.activity_id is null then g.section end), null) secciones
    from g left join public.lessons l on l.id = g.lesson_id left join public.activities ac on ac.id = g.activity_id
    group by g.ses
  )
  select jsonb_build_object(
    'total', count(*),
    'duracion_media', coalesce(round(avg(extract(epoch from s.fin - s.ini))), 0),
    'efectivo_medio', coalesce(round(avg(s.ef)), 0),
    'lista', (select coalesce(jsonb_agg(jsonb_build_object('inicio', z.ini, 'fin', z.fin, 'efectivo', z.ef, 'visible', z.vi,
                'visitas', z.n, 'respuestas', z.resp, 'sin_conexion', z.offl, 'titulos', z.titulos, 'secciones', z.secciones)
                order by z.ini desc), '[]')
              from (select * from s order by s.ini desc limit 60) z)
  ) into v_sesiones from s;

  -- --- actividades (publicadas para su sección y grupo), intentadas o no ------------------------------------------
  with e as (
    select en.class_id, en.group_id from public.enrollments en where en.user_id = p_user and en.class_id = any(v_clases)
  ), act as (
    select a.*, c.name cname from public.activities a join e on e.class_id = a.class_id join public.classes c on c.id = a.class_id
    where a.published and (a.group_id is null or a.group_id = e.group_id)
  ), t as (
    select x.* from public.attempts x where x.user_id = p_user and x.activity_id in (select act.id from act)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', act.id, 'clase', act.cname, 'titulo', act.title, 'modo', act.mode, 'abre', act.opens_at, 'cierra', act.closes_at,
      'max_intentos', act.max_attempts, 'notas_publicadas', act.grades_published,
      'items', (select count(*) from public.activity_items i where i.activity_id = act.id),
      'intentos', (select count(*) from t where t.activity_id = act.id),
      'entregados', (select count(*) from t where t.activity_id = act.id and t.status = 'submitted'),
      'mejor', (select max(t.score) from t where t.activity_id = act.id and t.status = 'submitted'),
      'mejor_pct', (select round(max(t.score / nullif(t.max_score, 0)) * 100, 1) from t where t.activity_id = act.id and t.status = 'submitted'),
      'maximo', (select max(t.max_score) from t where t.activity_id = act.id),
      'primer_inicio', (select min(t.started_at) from t where t.activity_id = act.id),
      'ultimo', (select jsonb_build_object('id', t.id, 'estado', t.status, 'inicio', t.started_at, 'entrega', t.submitted_at,
                  'puntaje', t.score, 'maximo', t.max_score, 'por_revisar', t.needs_review,
                  'respondidos', (select count(*) from public.responses r where r.attempt_id = t.id and r.status <> 'draft'))
                from t where t.activity_id = act.id order by t.started_at desc limit 1),
      'tiempo_efectivo', (select coalesce(sum(v.effective_seconds), 0) from public.study_visits v where v.user_id = p_user and v.activity_id = act.id),
      'lectura', (select jsonb_build_object('segundos', rp.seconds_read, 'pausas', rp.pauses, 'completada', rp.completed_at, 'minimo', act.reading_min_seconds)
                  from public.reading_progress rp where rp.user_id = p_user and rp.activity_id = act.id),
      'registro', (select jsonb_build_object('categoria', k.category, 'puntos', k.points) from public.activity_grade_links k where k.activity_id = act.id)
    ) order by coalesce(act.closes_at, act.opens_at, act.created_at) desc), '[]')
  into v_actividades from act;

  -- --- práctica libre por lección ------------------------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object('lesson_id', z.id, 'leccion', z.title, 'intentos', z.n, 'entregados', z.ent,
      'mejor_pct', z.mejor, 'ultimo', z.ult, 'ultimo_intento', z.ult_id) order by z.ult desc), '[]')
  into v_practica
  from (
    select l.id, l.title, count(*) n, count(*) filter (where t.status = 'submitted') ent,
      round(max(t.score / nullif(t.max_score, 0)) * 100, 1) mejor, max(coalesce(t.submitted_at, t.started_at)) ult,
      (array_agg(t.id order by t.started_at desc))[1] ult_id
    from public.attempts t join public.lessons l on l.id = t.lesson_id
    where t.user_id = p_user and t.activity_id is null and (v_admin or t.course_id = any(v_cursos))
    group by l.id, l.title
  ) z;

  -- --- respuestas: aciertos, errores, ejercicios difíciles, últimas acciones -----------------------------------------
  with t as (
    select x.* from public.attempts x left join public.activities a on a.id = x.activity_id
    where x.user_id = p_user and (v_admin or a.class_id = any(v_clases) or (x.activity_id is null and x.course_id = any(v_cursos)))
  ), r as (
    select rr.*, ex.difficulty, ex.format, ex.prompt, ex.lesson_id ex_lesson, ex.concepts, t.mode att_mode, t.activity_id att_activity, t.lesson_id att_lesson
    from public.responses rr join t on t.id = rr.attempt_id join public.exercises ex on ex.id = rr.exercise_id
    where rr.status <> 'draft'
  )
  select jsonb_build_object(
    'total', count(*),
    'correctas', count(*) filter (where r.status = 'correct'),
    'parciales', count(*) filter (where r.status = 'partial'),
    'incorrectas', count(*) filter (where r.status in ('incorrect', 'invalid')),
    'por_revisar', count(*) filter (where r.status = 'pending_review'),
    'reveladas', count(*) filter (where r.status = 'revealed' or r.solution_revealed),
    'primer_intento_correctas', count(*) filter (where r.first_try_correct),
    'primer_intento_total', count(*) filter (where r.first_try_correct is not null),
    'pistas', coalesce(sum(r.hints_used), 0),
    'intentos_promedio', round(avg(r.tries) filter (where r.tries > 0), 2),
    'credito_medio', round(avg(coalesce(r.manual_credit, r.auto_credit)) * 100, 1),
    'por_dificultad', (select coalesce(jsonb_agg(jsonb_build_object('dificultad', z.d, 'total', z.n, 'correctas', z.c)), '[]') from (
        select r2.difficulty::text d, count(*) n, count(*) filter (where r2.status = 'correct') c from r r2 group by 1) z),
    'por_concepto', (select coalesce(jsonb_agg(jsonb_build_object('concepto', z.k, 'total', z.n, 'correctas', z.c) order by z.n desc), '[]') from (
        select u.k, count(*) n, count(*) filter (where r2.status = 'correct') c from r r2 cross join lateral unnest(r2.concepts) as u(k)
        group by u.k order by 2 desc limit 30) z),
    'errores', (select coalesce(jsonb_agg(jsonb_build_object('codigo', z.c, 'n', z.n) order by z.n desc), '[]') from (
        select ev.result ->> 'code' c, count(*) n
        from public.response_events ev join r r3 on r3.id = ev.response_id
        where ev.kind in ('check', 'submit') and coalesce(ev.result ->> 'status', '') <> 'correct'
          and ev.result ->> 'code' is not null and ev.result ->> 'code' not in ('ok', 'typo')
        group by 1) z),
    'dificiles', (select coalesce(jsonb_agg(z.j), '[]') from (
        select jsonb_build_object('enunciado', left(r4.prompt, 160), 'estado', r4.status, 'intentos', r4.tries, 'pistas', r4.hints_used,
          'codigo', r4.engine_code, 'donde', coalesce(ac.title, l.title), 'attempt_id', r4.attempt_id, 'fecha', r4.updated_at) j
        from r r4 left join public.activities ac on ac.id = r4.att_activity
        left join public.lessons l on l.id = coalesce(r4.att_lesson, r4.ex_lesson)
        where r4.status in ('incorrect', 'invalid', 'partial', 'revealed') or r4.tries >= 2
        order by (r4.status <> 'correct') desc, r4.tries desc, r4.updated_at desc limit 20) z),
    'recientes', (select coalesce(jsonb_agg(z.j order by z.f desc), '[]') from (
        select ev.created_at f, jsonb_build_object('fecha', ev.created_at, 'accion', ev.kind, 'estado', ev.result ->> 'status',
          'codigo', ev.result ->> 'code', 'enunciado', left(r5.prompt, 110), 'donde', coalesce(ac.title, l.title), 'attempt_id', r5.attempt_id) j
        from public.response_events ev join r r5 on r5.id = ev.response_id
        left join public.activities ac on ac.id = r5.att_activity
        left join public.lessons l on l.id = coalesce(r5.att_lesson, r5.ex_lesson)
        order by ev.created_at desc limit 80) z)
  ) into v_respuestas from r;

  -- --- calificaciones oficiales por sección ----------------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object('class_id', c.id, 'clase', c.name,
      'publicadas', coalesce((select gs.published from public.grade_settings gs where gs.class_id = c.id), false),
      'categorias', (select coalesce(jsonb_agg(jsonb_build_object('categoria', s.category, 'nota', s.score, 'origen', s.source, 'pendientes', s.pendientes)), '[]')
                     from public.official_scores(c.id) s where s.user_id = p_user),
      'extras', (select coalesce(jsonb_agg(jsonb_build_object('puntos', x.points, 'motivo', x.reason, 'estado', x.status, 'fecha', x.created_at,
                   'por', (select q.full_name from public.profiles q where q.id = x.assigned_by)) order by x.created_at desc), '[]')
                 from public.extra_points x where x.class_id = c.id and x.user_id = p_user),
      'historial', (select coalesce(jsonb_agg(jsonb_build_object('categoria', h.category, 'antes', h.old_score, 'despues', h.new_score,
                      'fecha', h.changed_at, 'por', (select q.full_name from public.profiles q where q.id = h.changed_by)) order by h.changed_at desc), '[]')
                    from public.grade_history h where h.class_id = c.id and h.user_id = p_user)
    ) order by c.archived, c.name), '[]')
  into v_notas
  from public.classes c where c.id = any(v_clases);

  -- --- comunicación e historial de la cuenta ---------------------------------------------------------------------------
  select jsonb_build_object(
    'mensajes', (select coalesce(jsonb_agg(z.j order by z.f desc), '[]') from (
        select m.created_at f, jsonb_build_object('fecha', m.created_at, 'tipo', m.kind, 'texto', left(m.body, 300),
          'entregado', rc.delivered_at, 'leido', rc.read_at, 'cerrado', rc.dismissed_at,
          'por', (select q.full_name from public.profiles q where q.id = m.sender_id)) j
        from public.live_message_recipients rc join public.live_messages m on m.id = rc.message_id
        where rc.user_id = p_user and (v_admin or m.sender_id = auth.uid())
        order by m.created_at desc limit 60) z),
    'bloqueos', (select coalesce(jsonb_agg(jsonb_build_object('fecha', sl.created_at, 'texto', left(sl.body, 200), 'desbloqueado', sl.unlocked_at,
          'como', sl.unlocked_by, 'intentos_fallidos', sl.failed_attempts) order by sl.created_at desc), '[]')
        from public.screen_locks sl where sl.user_id = p_user and (v_admin or sl.sender_id = auth.uid())),
    'cuenta', (select coalesce(jsonb_agg(jsonb_build_object('fecha', ae.created_at, 'accion', ae.action,
          'por', (select q.full_name from public.profiles q where q.id = ae.actor_id)) order by ae.created_at desc), '[]')
        from public.account_events ae where ae.target_id = p_user)
  ) into v_otros;

  return jsonb_build_object(
    'generado', now(), 'perfil', v_perfil,
    'clases', (select coalesce(jsonb_agg(jsonb_build_object('class_id', c.id, 'nombre', c.name, 'periodo', c.term, 'course_id', c.course_id,
        'asignatura', co.title, 'grupo', g.name, 'inscrito', e.enrolled_at, 'archivada', c.archived,
        'monitor', exists (select 1 from public.class_monitors m where m.class_id = c.id and m.user_id = p_user and m.revoked_at is null))
        order by c.archived, e.enrolled_at desc), '[]')
      from public.enrollments e join public.classes c on c.id = e.class_id join public.courses co on co.id = c.course_id
      left join public.class_groups g on g.id = e.group_id
      where e.user_id = p_user and e.class_id = any(v_clases)),
    'accesos', v_accesos, 'estudio', v_estudio, 'sesiones', v_sesiones, 'actividades', v_actividades,
    'practica_libre', v_practica, 'respuestas', v_respuestas, 'calificaciones', v_notas,
    'mensajes', v_otros -> 'mensajes', 'bloqueos', v_otros -> 'bloqueos', 'cuenta', v_otros -> 'cuenta');
end;
$$;

-- La misma ficha a partir del ID de acceso (p. ej. desde el Centro de seguridad, que lista por ID)
create or replace function public.student_dossier_by_login(p_login text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.is_teacher() then raise exception 'No tiene acceso a este estudiante' using errcode = '42501'; end if;
  select p.id into v_id from public.profiles p where p.login_id = public.normalize_login(p_login);
  if v_id is null then
    -- mismo error que un estudiante ajeno: no revela qué IDs existen a quien no tiene acceso
    if public.is_admin() then raise exception 'Estudiante no encontrado' using errcode = 'P0002'; end if;
    raise exception 'No tiene acceso a este estudiante' using errcode = '42501';
  end if;
  return public.student_dossier(v_id);
end;
$$;

revoke all on function public.student_dossier(uuid) from public, anon;
grant execute on function public.student_dossier(uuid) to authenticated;
revoke all on function public.student_dossier_by_login(text) from public, anon;
grant execute on function public.student_dossier_by_login(text) to authenticated;
