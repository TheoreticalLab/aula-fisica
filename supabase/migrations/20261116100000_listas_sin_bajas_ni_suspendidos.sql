-- =============================================================================
-- Migración 96 · Las listas de seguimiento no muestran a los dados de baja ni a las cuentas suspendidas.
--
-- La migración 95 sacó a los dados de baja de todo lo que se construye con la matrícula. Un barrido sobre la copia de
-- producción (privado/tmp/barrido-bajas.mjs: baja de un estudiante real, suspensión de otro y llamada a todas las
-- funciones del profesor por sección o actividad) encontró las que parten de los INTENTOS o de los registros y no de la
-- matrícula: revisión pendiente, regularización, tiempo mínimo, protección del examen, práctica asistida y telemetría.
-- El profesor pidió además que las cuentas SUSPENDIDAS tampoco salgan en «quién hizo y quién no».
--
-- Criterio único, fuera_de_seccion(sección, estudiante): baja vigente en la sección o cuenta desactivada
-- (profiles.active = false: suspendida o fusionada). Se aplica a las listas de seguimiento de actividades y prácticas.
-- NO se aplica (decisión pendiente del profesor) al registro oficial de calificaciones ni a la asistencia, donde los
-- suspendidos siguen apareciendo; los dados de baja ya no aparecen en ninguno de los dos (migración 95).
-- NO se toca LIEIA (congelado; filtrar cambiaría la numeración de los seudónimos).
-- Ningún dato cambia: solo qué filas devuelven estas funciones. Todas son copia de su versión vigente + el filtro.
-- =============================================================================

create or replace function public.fuera_de_seccion(p_class uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.baja_vigente(p_class, p_user)
      or exists (select 1 from public.profiles p where p.id = p_user and not p.active)
$$;

-- Cuántos cuentan en la sección: matriculados con la cuenta activa.
create or replace function public.inscritos_activos(p_class uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select count(*) from public.enrollments e join public.profiles p on p.id = e.user_id and p.active
  where e.class_id = p_class
$$;

-- activity_stats (vigente: migración 95)
create or replace function public.activity_stats(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'enrolled', public.inscritos_activos(v_class),
        'students_started', count(distinct t.user_id),
        'students_submitted', count(distinct t.user_id) filter (where t.status = 'submitted'),
        'attempts', count(*) filter (where t.status = 'submitted'),
        'mean_best', (select round(avg(b.best), 2) from (
            select max(t2.score) as best from public.attempts t2
            where t2.activity_id = p_activity and t2.status = 'submitted'
              and not public.fuera_de_seccion(v_class, t2.user_id) group by t2.user_id) b),
        'scores', (select coalesce(jsonb_agg(b.best order by b.best), '[]'::jsonb) from (
            select max(t2.score) as best from public.attempts t2
            where t2.activity_id = p_activity and t2.status = 'submitted'
              and not public.fuera_de_seccion(v_class, t2.user_id) group by t2.user_id) b))
      from public.attempts t where t.activity_id = p_activity and not public.fuera_de_seccion(v_class, t.user_id)),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'exercise_id', e.id, 'slug', e.slug, 'prompt', left(e.prompt, 160), 'format', e.format,
          'difficulty', e.difficulty, 'concepts', to_jsonb(e.concepts),
          'answered', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                       where t.activity_id = p_activity and r.exercise_id = e.id and r.status not in ('draft')
                         and not public.fuera_de_seccion(v_class, t.user_id)),
          'correct', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                      where t.activity_id = p_activity and r.exercise_id = e.id and r.status = 'correct'
                        and not public.fuera_de_seccion(v_class, t.user_id)),
          'first_try', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                        where t.activity_id = p_activity and r.exercise_id = e.id and r.first_try_correct
                          and not public.fuera_de_seccion(v_class, t.user_id)),
          'mean_credit', (select round(avg(coalesce(r.manual_credit, r.auto_credit)), 3) from public.responses r
                          join public.attempts t on t.id = r.attempt_id
                          where t.activity_id = p_activity and r.exercise_id = e.id and r.status not in ('draft')
                            and not public.fuera_de_seccion(v_class, t.user_id)),
          'codes', (select coalesce(jsonb_object_agg(c.engine_code, c.n), '{}'::jsonb) from (
                      select r.engine_code, count(*) as n from public.responses r join public.attempts t on t.id = r.attempt_id
                      where t.activity_id = p_activity and r.exercise_id = e.id and r.engine_code is not null
                        and r.engine_code <> 'ok' and not public.fuera_de_seccion(v_class, t.user_id) group by r.engine_code) c)
        ) order by i.position), '[]'::jsonb)
      from public.activity_items i join public.exercises e on e.id = i.exercise_id
      where i.activity_id = p_activity)
  );
end;
$$;

-- gradebook = pestaña «Seguimiento» (vigente: migración 5)
create or replace function public.gradebook(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'activities', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'mode', a.mode, 'closes_at', a.closes_at, 'published', a.published,
        'grades_published', a.grades_published, 'group_id', a.group_id,
        'max_score', (select coalesce(sum(coalesce(i.points, e.points)), 0) from public.activity_items i
                      join public.exercises e on e.id = i.exercise_id where i.activity_id = a.id)
      ) order by a.closes_at nulls last, a.created_at), '[]'::jsonb)
      from public.activities a where a.class_id = p_class),
    'students', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', p.id, 'full_name', p.full_name, 'login_id', p.login_id, 'email', p.email, 'student_code', p.student_code,
        'active', p.active, 'group_id', en.group_id, 'group_name', g.name,
        'grades', (select coalesce(jsonb_object_agg(x.activity_id, jsonb_build_object(
              'best', x.best, 'submitted', x.submitted, 'in_progress', x.in_progress, 'needs_review', x.needs_review,
              'last_attempt_id', x.last_attempt_id)), '{}'::jsonb)
            from (
              select t.activity_id,
                     max(t.score) filter (where t.status = 'submitted') as best,
                     count(*) filter (where t.status = 'submitted') as submitted,
                     bool_or(t.status = 'in_progress') as in_progress,
                     bool_or(t.needs_review) as needs_review,
                     (array_agg(t.id order by t.started_at desc))[1] as last_attempt_id
              from public.attempts t join public.activities a on a.id = t.activity_id
              where t.user_id = p.id and a.class_id = p_class
              group by t.activity_id
            ) x)
      ) order by p.full_name), '[]'::jsonb)
      from public.enrollments en
      join public.profiles p on p.id = en.user_id and p.active
      left join public.class_groups g on g.id = en.group_id
      where en.class_id = p_class)
  );
end;
$$;

-- review_queue = respuestas por revisar (vigente: migración 3)
create or replace function public.review_queue(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'response_id', r.id, 'attempt_id', t.id, 'activity_id', a.id, 'activity_title', a.title,
      'student', p.full_name, 'student_id', p.id, 'exercise_slug', e.slug, 'prompt', left(e.prompt, 200),
      'format', e.format, 'status', r.status, 'updated_at', r.updated_at
    ) order by r.updated_at), '[]'::jsonb)
    from public.responses r
    join public.attempts t on t.id = r.attempt_id
    join public.activities a on a.id = t.activity_id
    join public.exercises e on e.id = r.exercise_id
    join public.profiles p on p.id = t.user_id
    where a.class_id = p_class and t.status = 'submitted' and r.manual_credit is null
      and r.status = 'pending_review' and not public.fuera_de_seccion(p_class, t.user_id));
end;
$$;

-- exam_monitor (vigente: migración 37)
create or replace function public.exam_monitor(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'ahora_ms', public.exam_ms(now()),
    'inscritos', public.inscritos_activos(act.class_id),
    'entregados', (select count(distinct a.user_id) from public.attempts a where a.activity_id = p_activity and a.status = 'submitted'
                     and not public.fuera_de_seccion(act.class_id, a.user_id)),
    'en_curso', (select coalesce(jsonb_agg(jsonb_build_object(
        'attempt_id', a.id, 'nombre', p.full_name,
        'pregunta', array_position(public.exam_item_order(a.id), s.activa), 'total', cardinality(public.exam_item_order(a.id)),
        'respondidas', (select count(*) from public.responses r where r.attempt_id = a.id and r.answer <> '{}'::jsonb),
        'en_pausa', s.pausa_desde is not null, 'pausas', s.pausas_n,
        'ultimo_contacto_ms', public.exam_ms(s.ultimo_contacto), 'limite_ms', public.exam_ms(public.exam_deadline(a.id)),
        'inicio_ms', public.exam_ms(a.started_at), 'extra_s', s.extra_s) order by p.full_name), '[]'::jsonb)
      from public.attempts a join public.exam_sessions s on s.attempt_id = a.id join public.profiles p on p.id = a.user_id
      where a.activity_id = p_activity and a.status = 'in_progress' and not public.fuera_de_seccion(act.class_id, a.user_id)));
end;
$$;

-- exam_integridad_resumen = «Protección del examen» (vigente: migración 85)
create or replace function public.exam_integridad_resumen(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.grades_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'config', (select jsonb_build_object('bloquear_al_salir', s.bloquear_al_salir, 'impedir_copiar', s.impedir_copiar, 'codigo_configurado', s.codigo_salida_hash is not null)
               from public.exam_settings s where s.activity_id = p_activity),
    'estudiantes', (select coalesce(jsonb_agg(z order by z->>'nombre'), '[]') from (
      select jsonb_build_object('user_id', p.id, 'nombre', p.full_name, 'matricula', coalesce(p.student_code, p.login_id),
        'attempt_id', a.id, 'estado', a.status, 'inicio', a.started_at,
        'salidas', count(*) filter (where e.tipo = 'salida'), 'reingresos', count(*) filter (where e.tipo = 'reingreso'),
        'pegados', count(*) filter (where e.tipo = 'pegado'), 'arrastres', count(*) filter (where e.tipo = 'arrastre'),
        'copias', count(*) filter (where e.tipo = 'copia'),
        'ultima_salida', max(e.created_at) filter (where e.tipo in ('salida', 'reingreso')),
        'lock_id', (select l.id from public.screen_locks l where l.user_id = p.id and l.unlocked_at is null order by l.created_at desc limit 1),
        'salidas_autorizadas', count(*) filter (where e.tipo = 'salida_autorizada'),
        'codigos_fallidos', count(*) filter (where e.tipo = 'codigo_fallido'),
        'incidencias', count(*) filter (where e.tipo = 'incidencia'),
        'detalle', coalesce(jsonb_agg(jsonb_build_object('tipo', e.tipo, 'motivo', e.motivo, 'resultado', e.resultado, 'en', e.created_at,
                       'pregunta', array_position(public.exam_item_order(a.id), e.exercise_id)) order by e.created_at)
                     filter (where e.tipo <> 'entrada'), '[]')) z
      from public.attempts a
      join public.profiles p on p.id = a.user_id
      left join public.exam_integridad_eventos e on e.attempt_id = a.id
      where a.activity_id = p_activity and not public.fuera_de_seccion(act.class_id, a.user_id)
      group by p.id, p.full_name, p.student_code, p.login_id, a.id, a.status, a.started_at) q));
end;
$$;

-- practica_tiempo_intentos = tiempo mínimo de una práctica (vigente: migración 78)
create or replace function public.practica_tiempo_intentos(p_activity uuid)
returns table (attempt_id uuid, user_id uuid, full_name text, login_id text, status text, started_at timestamptz, submitted_at timestamptz,
  minimo_s integer, segundos numeric, cumplido boolean, pausas integer, exento boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select a.id, a.user_id, p.full_name, p.login_id, a.status::text, a.started_at, a.submitted_at,
    coalesce(t.minimo_s, public.practica_minimo_aplica(a.id)), coalesce(t.segundos, 0),
    coalesce(t.segundos, 0) >= coalesce(t.minimo_s, public.practica_minimo_aplica(a.id), 0), coalesce(t.pausas, 0),
    public.practica_minimo_aplica(a.id) is null
  from public.attempts a
  join public.profiles p on p.id = a.user_id
  left join public.attempt_active_time t on t.attempt_id = a.id
  where a.activity_id = p_activity and not public.fuera_de_seccion(act.class_id, a.user_id)
  order by p.full_name, a.attempt_number;
end $$;

-- asistida_proceso = proceso de la práctica asistida (vigente: migración 38)
create or replace function public.asistida_proceso(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities; s public.assisted_settings;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.assisted_settings where activity_id = p_activity;
  if s.activity_id is null then return jsonb_build_object('asistida', false); end if;
  return jsonb_build_object('asistida', true,
    'config', to_jsonb(s) - 'updated_by',
    'inscritos', public.inscritos_activos(act.class_id),
    'ejercicios', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', i.exercise_id, 'slug', x.slug, 'concepts', x.concepts, 'format', x.format,
                     'transfer_exercise_id', t.transfer_exercise_id) order by i.position), '[]'::jsonb)
                   from public.activity_items i join public.exercises x on x.id = i.exercise_id
                   left join public.assisted_transfer t on t.activity_id = p_activity and t.exercise_id = i.exercise_id
                   where i.activity_id = p_activity),
    'intentos', (select coalesce(jsonb_agg(jsonb_build_object('attempt_id', a.id, 'user_id', a.user_id, 'nombre', p.full_name, 'status', a.status,
                   'items', (select coalesce(jsonb_agg(public.asistida_estado_item(a.id, i.exercise_id, false) order by i.position), '[]'::jsonb)
                             from public.activity_items i where i.activity_id = p_activity),
                   'retencion', case when s.verificacion_actividad is null then null else
                     (select max(case when b.max_score > 0 then b.score / b.max_score end) from public.attempts b
                      where b.activity_id = s.verificacion_actividad and b.user_id = a.user_id and b.status = 'submitted') end)
                   order by p.full_name, a.attempt_number), '[]'::jsonb)
                 from public.attempts a join public.profiles p on p.id = a.user_id
                 where a.activity_id = p_activity and not public.fuera_de_seccion(act.class_id, a.user_id)));
end;
$$;

-- telemetria_v2_actividad (vigente: migración 44)
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
              and not public.fuera_de_seccion(v_class, x.user_id)
            order by x.started_at limit 400) t
      join public.profiles p on p.id = t.user_id));
end;
$$;

-- hist_resumen = regularización, resumen por estudiante (vigente: migración 45)
create or replace function public.hist_resumen(p_class uuid)
returns table (user_id uuid, full_name text, student_code text, group_name text, borradores bigint, registradas bigint, incidencias bigint,
  pendientes bigint, localizadas bigint, verificadas bigint, convalidadas bigint, no_localizadas bigint, observadas bigint, aclaraciones bigint, sugerencias bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.hist_assert_teacher(p_class);
  return query
  select p.id, p.full_name, p.student_code, g.name,
    count(d.id) filter (where d.estado = 'borrador'),
    count(d.id) filter (where d.estado <> 'borrador' and d.tipo = 'evidencia'),
    count(d.id) filter (where d.estado <> 'borrador' and d.tipo = 'incidencia'),
    count(d.id) filter (where d.estado = 'registrada'),
    count(d.id) filter (where d.estado = 'localizada'),
    count(d.id) filter (where d.estado = 'verificada'),
    count(d.id) filter (where d.estado = 'convalidada'),
    count(d.id) filter (where d.estado = 'no_localizada'),
    count(d.id) filter (where d.estado = 'observada'),
    count(d.id) filter (where d.estado = 'aclaracion'),
    (select count(*) from public.hist_suggestions s where s.class_id = p_class and s.user_id = p.id)
  from public.enrollments e
  join public.profiles p on p.id = e.user_id and p.role = 'student' and p.active
  left join public.class_groups g on g.id = e.group_id
  left join public.hist_declarations d on d.class_id = p_class and d.user_id = p.id
  where e.class_id = p_class
  group by p.id, p.full_name, p.student_code, g.name
  order by p.full_name;
end;
$$;

-- hist_registros = regularización, registros enviados (vigente: migración 45)
create or replace function public.hist_registros(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_class is not null then perform public.hist_assert_teacher(p_class);
  elsif not public.is_teacher() or not public.my_account_ok() then raise exception 'No tiene acceso' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'class_id', d.class_id, 'class_name', c.name, 'course_id', c.course_id, 'course_title', co.title,
      'group_id', e.group_id, 'group_name', g.name,
      'user_id', d.user_id, 'full_name', pr.full_name, 'student_code', pr.student_code,
      'practice_id', d.practice_id, 'numero', p.numero, 'practica_titulo', p.titulo, 'practica_archivada', p.archivada,
      'tipo', d.tipo, 'tema', d.tema, 'descripcion', d.descripcion, 'fecha_declarada', d.fecha_declarada, 'fecha_desconocida', d.fecha_desconocida,
      'medio', d.medio, 'correo_remitente', d.correo_remitente, 'otra_via', d.otra_via, 'contacto', d.contacto, 'motivo_incidencia', d.motivo_incidencia,
      'estado', d.estado, 'enviado_at', d.enviado_at, 'revisada_at', d.revisada_at, 'localizada_at', d.localizada_at, 'verificada_at', d.verificada_at,
      'convalidada_at', d.convalidada_at, 'nota_docente', d.nota_docente, 'respuesta_estudiante', d.respuesta_estudiante,
      'actividad', (select a.title from public.activities a where a.id = p.activity_id),
      'calificacion', (select jsonb_build_object('score', t.score, 'max', t.max_score) from public.attempts t
         where p.activity_id is not null and t.activity_id = p.activity_id and t.user_id = d.user_id and t.status <> 'in_progress' and t.score is not null
         order by t.score desc nulls last limit 1),
      'capturas', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'posicion', k.posicion, 'bytes', k.bytes, 'ancho', k.ancho, 'alto', k.alto,
          'mime', k.mime, 'sha256', k.sha256,
          'igual_a_otros', (select count(distinct k2.user_id) from public.hist_captures k2 where k2.user_id <> k.user_id
             and (k2.sha256 = k.sha256 or (k.sha256_original is not null and k2.sha256_original = k.sha256_original))))
          order by k.posicion), '[]'::jsonb) from public.hist_captures k where k.declaration_id = d.id)
    ) order by c.name, pr.full_name, p.numero), '[]'::jsonb)
    from public.hist_declarations d
    join public.classes c on c.id = d.class_id join public.courses co on co.id = c.course_id
    join public.profiles pr on pr.id = d.user_id
    join public.hist_practices p on p.id = d.practice_id
    left join public.enrollments e on e.class_id = d.class_id and e.user_id = d.user_id
    left join public.class_groups g on g.id = e.group_id
    where d.estado <> 'borrador'
      and (case when p_class is null then public.is_class_teacher(d.class_id) else d.class_id = p_class end)
      and not public.fuera_de_seccion(d.class_id, d.user_id)
  );
end;
$$;

-- hist_terminados = regularización, quién la dio por terminada (vigente: migración 46)
create or replace function public.hist_terminados(p_class uuid)
returns table (user_id uuid, finalizado_at timestamptz, sin_practicas boolean, registradas integer, nota text, reabierto_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.hist_assert_teacher(p_class);
  return query select c.user_id, c.finalizado_at, c.sin_practicas, c.registradas, c.nota, c.reabierto_at
    from public.hist_cierres c where c.class_id = p_class and not public.fuera_de_seccion(p_class, c.user_id);
end;
$$;

-- hist_libre_datos = prácticas sin correo (vigente: migración 47)
create or replace function public.hist_libre_datos(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.hist_settings;
begin
  perform public.hist_assert_teacher(p_class);
  select * into s from public.hist_settings where class_id = p_class;
  return jsonb_build_object(
    'config', jsonb_build_object('habilitado', coalesce(s.libre_habilitado, false), 'nuevos', coalesce(s.libre_nuevos, true),
      'correcciones', coalesce(s.libre_correcciones, true), 'sin_foto', coalesce(s.libre_sin_foto, true), 'nombres_libres', coalesce(s.libre_nombres_libres, true),
      'max_registros', coalesce(s.libre_max_registros, 60), 'max_ejercicios', coalesce(s.libre_max_ejercicios, 200),
      'sugerencias', coalesce(s.libre_sugerencias, true), 'solicitudes', coalesce(s.libre_solicitudes, true), 'max_mb_captura', coalesce(s.max_mb_captura, 2),
      'cuota_mb', coalesce(s.cuota_mb, 300), 'bytes_seccion', public.hist_bytes_seccion(p_class)),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'student_code', p.student_code, 'group_name', g.name)
        order by p.full_name), '[]'::jsonb)
        from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' and p.active left join public.class_groups g on g.id = e.group_id
        where e.class_id = p_class),
    'registros', (select coalesce(jsonb_agg(public.hist_libre_json(l) order by l.created_at), '[]'::jsonb) from public.hist_libres l
        where l.class_id = p_class and not public.fuera_de_seccion(p_class, l.user_id)),
    'grupos', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nombre_oficial', g.nombre_oficial, 'total_oficial', g.total_oficial,
        'descripcion', g.descripcion, 'created_at', g.created_at) order by g.nombre_oficial), '[]'::jsonb) from public.hist_libre_grupos g where g.class_id = p_class),
    'avisos', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'grupo_id', a.grupo_id, 'user_id', a.user_id, 'estado', a.estado, 'respuesta', a.respuesta,
        'libre_id', a.libre_id, 'enviado_at', a.enviado_at, 'respondido_at', a.respondido_at)), '[]'::jsonb) from public.hist_libre_avisos a
        where a.class_id = p_class and not public.fuera_de_seccion(p_class, a.user_id)),
    'correo', (select coalesce(jsonb_agg(jsonb_build_object('user_id', d.user_id, 'tema', d.tema, 'practica', p.titulo, 'numero', p.numero)), '[]'::jsonb)
        from public.hist_declarations d join public.hist_practices p on p.id = d.practice_id
        where d.class_id = p_class and d.estado <> 'borrador' and not public.fuera_de_seccion(p_class, d.user_id))
  );
end;
$$;

-- vta_seccion = prácticas de control, señales por estudiante (vigente: migración 62)
create or replace function public.vta_seccion(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (with d as (select * from public.vta_datos(p_class)),
    -- brecha ajustada por dificultad: un control más difícil que la práctica explica parte de la diferencia (0,10 por nivel)
    g as (select d.*, d.practica_pct - d.control_pct - 0.10 * greatest(0, coalesce(d.dif_control, 2) - coalesce(d.dif_practica, 2)) brecha from d),
    est as (select g.user_id, count(*) n, avg(g.practica_pct) practica, avg(g.control_pct) control, avg(g.brecha) brecha,
               stddev_samp(g.brecha) sd,
               count(distinct g.competencia) filter (where g.control_pct >= 0.7) verificadas
            from g group by g.user_id),
    pend as (select e.user_id, count(distinct x) pendientes
             from public.enrollments e join public.attempts t on t.user_id = e.user_id and t.status = 'submitted'
             join public.activities a on a.id = t.activity_id and a.class_id = p_class and a.mode = 'practice'
             join public.activity_items i on i.activity_id = a.id join public.exercises ex on ex.id = i.exercise_id, unnest(ex.concepts) x
             where e.class_id = p_class
               and not exists (select 1 from g where g.user_id = e.user_id and g.competencia = x and g.control_pct >= 0.7)
             group by e.user_id)
    select jsonb_build_object('estudiantes', coalesce(jsonb_agg(jsonb_build_object('user_id', e.user_id, 'nombre', pr.full_name,
        'controles', coalesce(est.n, 0), 'practica', round(100 * est.practica, 1), 'supervisado', round(100 * est.control, 1),
        'brecha', round(100 * est.brecha, 1),
        -- error típico de la media: con menos de 3 controles no se interpreta
        'brecha_ee', case when est.n >= 3 then round(100 * est.sd / sqrt(est.n::numeric), 1) end,
        'competencias_verificadas', coalesce(est.verificadas, 0), 'competencias_pendientes', coalesce(pend.pendientes, 0),
        'senal', case when coalesce(est.n, 0) = 0 then 'sin_datos' when est.n < 3 then 'datos_insuficientes'
                      when est.brecha - 2 * est.sd / sqrt(est.n::numeric) > 0.15 then 'reforzar_autonomia'
                      when est.brecha + 2 * est.sd / sqrt(est.n::numeric) < 0.15 then 'coherente' else 'indeterminada' end)
      order by pr.full_name), '[]'::jsonb),
      'aviso', 'Señales pedagógicas: comparan lo entregado en prácticas con lo resuelto de forma supervisada. No son pruebas de uso de IA ni de irregularidades.')
    from public.enrollments e join public.profiles pr on pr.id = e.user_id and pr.role = 'student' and pr.active
    left join est on est.user_id = e.user_id left join pend on pend.user_id = e.user_id
    where e.class_id = p_class);
end;
$$;

revoke all on function public.fuera_de_seccion(uuid, uuid), public.inscritos_activos(uuid) from public, anon, authenticated;
revoke all on function public.activity_stats(uuid), public.gradebook(uuid), public.review_queue(uuid), public.exam_monitor(uuid),
  public.exam_integridad_resumen(uuid), public.practica_tiempo_intentos(uuid), public.asistida_proceso(uuid),
  public.telemetria_v2_actividad(uuid, boolean), public.hist_resumen(uuid), public.hist_registros(uuid), public.hist_terminados(uuid),
  public.hist_libre_datos(uuid), public.vta_seccion(uuid) from public, anon;
grant execute on function public.activity_stats(uuid), public.gradebook(uuid), public.review_queue(uuid), public.exam_monitor(uuid),
  public.exam_integridad_resumen(uuid), public.practica_tiempo_intentos(uuid), public.asistida_proceso(uuid),
  public.telemetria_v2_actividad(uuid, boolean), public.hist_resumen(uuid), public.hist_registros(uuid), public.hist_terminados(uuid),
  public.hist_libre_datos(uuid), public.vta_seccion(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Segunda pasada del barrido (todas las secciones): prácticas extraordinarias, maratón, buzones, controles de
-- laboratorio, delegados de clases impartidas y, del registro, puntos extra y partes de apartado. En lo del registro
-- solo se quita al dado de baja (los suspendidos siguen en el registro, como gradebook_official).
-- No se filtra clases_seccion: el nombre de quien subió las fotos es autoría de la clase, no una lista de estudiantes.
-- -----------------------------------------------------------------------------

-- class_extra_points (vigente: migración 15)
create or replace function public.class_extra_points(p_class uuid)
returns table (id uuid, user_id uuid, alumno text, asignado_por text, assigner_role text, points numeric, reason text, status text,
  created_at timestamptz, reviewed_at timestamptz, review_note text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return query
  select x.id, x.user_id, a.full_name, coalesce(m.full_name, ''), x.assigner_role, x.points, x.reason, x.status, x.created_at,
    x.reviewed_at, x.review_note
  from public.extra_points x join public.profiles a on a.id = x.user_id left join public.profiles m on m.id = x.assigned_by
  where x.class_id = p_class and not public.baja_vigente(p_class, x.user_id) order by x.created_at desc;
end;
$$;

-- class_grade_parts (vigente: migración 69)
create or replace function public.class_grade_parts(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return jsonb_build_object(
    'partes', (select coalesce(jsonb_agg(jsonb_build_object('category', p.category, 'label', p.label, 'max', p.max) order by p.category), '[]'::jsonb)
               from public.grade_parts p where p.class_id = p_class),
    'notas', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'category', s.category, 'score', s.score)), '[]'::jsonb)
              from public.grade_part_scores s join public.grade_parts p on p.class_id = s.class_id and p.category = s.category
              where s.class_id = p_class and not public.baja_vigente(p_class, s.user_id)));
end;
$$;

-- pes_detalle_docente (vigente: migración 74)
create or replace function public.pes_detalle_docente(p_practica uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.pes_practicas;
begin
  select * into p from public.pes_practicas where id = p_practica;
  if p.id is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object('practica', to_jsonb(p),
    'ejercicios', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'posicion', e.posicion, 'titulo', e.titulo, 'contexto', e.contexto,
        'origen', e.origen, 'origen_ref', e.origen_ref,
        'apartados', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'posicion', a.posicion, 'letra', chr(64 + a.posicion), 'etapa', a.etapa,
            'enunciado', a.enunciado, 'formato', a.formato, 'opciones', a.opciones, 'multiple', a.multiple, 'unidad_sugerida', a.unidad_sugerida,
            'figura', a.figura, 'peso', a.peso, 't_ref_s', a.t_ref_s, 'origen_exercise_id', a.origen_exercise_id,
            'clave', k.clave, 'rubrica', k.rubrica, 'explicacion', k.explicacion) order by a.posicion), '[]'::jsonb)
          from public.pes_apartados a left join public.pes_claves k on k.apartado_id = a.id where a.ejercicio_id = e.id)) order by e.posicion)
      from public.pes_ejercicios e where e.practica_id = p_practica), '[]'::jsonb),
    'asignaciones', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'nombre', pr.full_name, 'codigo', pr.student_code,
        'tiempo_extra_min', s.tiempo_extra_min, 'factor_espera', s.factor_espera, 'pegado_permitido', s.pegado_permitido, 'nota_adaptacion', s.nota_adaptacion,
        'aceptado_at', s.aceptado_at, 'estado', st.estado, 'cierre', public.pes_cierre(p_practica, s.user_id),
        'puntaje', public.pes_puntaje(p_practica, s.user_id)) order by pr.full_name)
      from public.pes_asignaciones s join public.profiles pr on pr.id = s.user_id
      left join public.pes_estado st on st.practica_id = s.practica_id and st.user_id = s.user_id
      where s.practica_id = p_practica and not s.prueba and not public.fuera_de_seccion(p.class_id, s.user_id)), '[]'::jsonb));
end $$;

-- pes_monitor (vigente: migración 75)
create or replace function public.pes_monitor(p_practica uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.pes_practicas;
begin
  select * into p from public.pes_practicas where id = p_practica;
  if p.id is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object('ahora', now(),
    'practica', jsonb_build_object('id', p.id, 'titulo', p.titulo, 'estado', p.estado, 'cierra_at', p.cierra_at, 'resultados_publicados', p.resultados_publicados,
      'ejercicios', (select count(*) from public.pes_ejercicios e where e.practica_id = p.id),
      'apartados', (select count(*) from public.pes_apartados a where a.practica_id = p.id), 'control_politica', p.control_politica),
    'estudiantes', coalesce((select jsonb_agg(x order by x ->> 'nombre') from (
      select jsonb_build_object('user_id', s.user_id, 'nombre', pr.full_name, 'codigo', pr.student_code, 'estado', coalesce(st.estado, 'no_iniciada'),
        'cierre', public.pes_cierre(p.id, s.user_id), 'aceptado_at', s.aceptado_at,
        'adaptacion', jsonb_build_object('tiempo_extra_min', s.tiempo_extra_min, 'factor_espera', s.factor_espera, 'pegado_permitido', s.pegado_permitido),
        'actual', case when st.estado = 'apartado_abierto' then jsonb_build_object('ejercicio', ea.posicion, 'letra', chr(64 + aa.posicion),
          'revelado_at', st.revelado_at, 't_min_s', public.pes_t_min(aa.id, s.user_id)) end,
        'cerrados', r.cerrados, 'omitidos', r.omitidos, 'anticipados', r.anticipados, 'validadas', r.validadas, 'pendientes_revision', r.pendientes,
        'breves', r.breves, 'tiempo_total_s', r.tiempo,
        'ejercicios_completos', (select count(*) from (select a.ejercicio_id from public.pes_apartados a
            left join public.pes_respuestas x on x.apartado_id = a.id and x.user_id = s.user_id
            where a.practica_id = p.id group by a.ejercicio_id having count(*) = count(x.id)) z),
        'ultima_actividad', (select max(ev.at) from public.pes_eventos ev where ev.practica_id = p.id and ev.user_id = s.user_id),
        'pegados_bloqueados', (select count(*) from public.pes_eventos ev where ev.practica_id = p.id and ev.user_id = s.user_id and ev.tipo in ('pegado_bloqueado', 'arrastre_bloqueado')),
        'reconexiones', (select count(*) from public.pes_eventos ev where ev.practica_id = p.id and ev.user_id = s.user_id and ev.tipo = 'reconexion'),
        'controles', (select count(*) from public.pes_controles c where c.practica_id = p.id and c.user_id = s.user_id and c.estado = 'realizado'),
        'puntaje', public.pes_puntaje(p.id, s.user_id)) x
      from public.pes_asignaciones s join public.profiles pr on pr.id = s.user_id
      left join public.pes_estado st on st.practica_id = s.practica_id and st.user_id = s.user_id
      left join public.pes_apartados aa on aa.id = st.apartado_id
      left join public.pes_ejercicios ea on ea.id = aa.ejercicio_id
      cross join lateral (select count(*) cerrados, count(*) filter (where x.accion = 'omitida') omitidos, count(*) filter (where x.accion = 'anticipada') anticipados,
          count(*) filter (where x.validada) validadas, count(*) filter (where x.revision = 'pendiente') pendientes,
          count(*) filter (where x.accion <> 'omitida' and x.segundos < 0.5 * x.t_min_s) breves, coalesce(sum(x.segundos), 0) tiempo
        from public.pes_respuestas x where x.practica_id = p.id and x.user_id = s.user_id) r
      where s.practica_id = p.id and not s.prueba and not public.fuera_de_seccion(p.class_id, s.user_id)) q), '[]'::jsonb));
end $$;

-- pes_respuestas_docente (vigente: migración 74)
create or replace function public.pes_respuestas_docente(p_practica uuid, p_solo_pendientes boolean default true) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_class uuid := (select class_id from public.pes_practicas where id = p_practica);
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'nombre', pr.full_name, 'ejercicio', e.posicion,
      'letra', chr(64 + a.posicion), 'enunciado', a.enunciado, 'formato', a.formato, 'rubrica', k.rubrica, 'respuesta', r.respuesta, 'accion', r.accion,
      'segundos', r.segundos, 't_min_s', r.t_min_s, 'm', r.m, 'q', r.q, 'revision', r.revision, 'validada', r.validada, 'nota_revision', r.nota_revision,
      'cerrado_at', r.cerrado_at) order by pr.full_name, e.posicion, a.posicion)
    from public.pes_respuestas r join public.pes_apartados a on a.id = r.apartado_id join public.pes_ejercicios e on e.id = a.ejercicio_id
    join public.profiles pr on pr.id = r.user_id left join public.pes_claves k on k.apartado_id = a.id
    join public.pes_asignaciones s on s.practica_id = r.practica_id and s.user_id = r.user_id and not s.prueba
    where r.practica_id = p_practica and (not coalesce(p_solo_pendientes, true) or r.revision = 'pendiente')
      and not public.fuera_de_seccion(v_class, r.user_id)), '[]'::jsonb);
end $$;

-- clase_permisos (vigente: migración 66): monitores y delegados sin dados de baja ni suspendidos
create or replace function public.clase_permisos(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.class_archive_settings;
begin
  if not public.clase_es_docente(p_class, auth.uid()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.class_archive_settings where class_id = p_class;
  return jsonb_build_object(
    'monitores_suben', coalesce(s.monitores_suben, false), 'permitir_descarga', coalesce(s.permitir_descarga, false), 'max_mb', coalesce(s.max_mb, 4),
    'monitores', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'nombre', p.full_name) order by p.full_name), '[]'::jsonb)
                  from public.class_monitors m join public.profiles p on p.id = m.user_id where m.class_id = p_class and m.revoked_at is null
                    and not public.fuera_de_seccion(p_class, m.user_id)),
    'delegados', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'user_id', d.user_id, 'nombre', p.full_name, 'expires_at', d.expires_at,
                    'vigente', d.expires_at is null or d.expires_at > now(), 'granted_at', d.granted_at) order by p.full_name), '[]'::jsonb)
                  from public.class_upload_delegates d join public.profiles p on p.id = d.user_id where d.class_id = p_class and d.revoked_at is null
                    and not public.fuera_de_seccion(p_class, d.user_id)),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', e.user_id, 'nombre', p.full_name) order by p.full_name), '[]'::jsonb)
                    from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' and p.active where e.class_id = p_class));
end;
$$;

-- maraton_resumen (vigente: migración 94)
create or replace function public.maraton_resumen(p_maraton uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); c jsonb := public.maraton_cfg(m.config);
  n integer := (c -> 'programacion' ->> 'jornadas')::int;
begin
  return jsonb_build_object(
    'maraton', public.maraton_json_docente(m),
    'calendario', (select jsonb_agg(public.maraton_calendario(m, k) order by k) from generate_series(1, n) k),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', u.id, 'nombre', pr.full_name, 'login_id', pr.login_id,
        'matriculado', u.matriculado, 'participa', i.id is not null, 'nivel_actual', i.nivel, 'comodines_usados', i.comodines_usados,
        'aceptado_at', i.aceptado_at,
        'resumen', case when i.id is not null then public.maraton_resumen_inscripcion(i.id) end) order by pr.full_name), '[]')
      from (select e.user_id as id, true as matriculado from public.enrollments e
             where e.class_id = m.class_id and (m.group_id is null or m.group_id = e.group_id)
               and not exists (select 1 from public.profiles p2 where p2.id = e.user_id and p2.role <> 'student')
            union
            select ii.user_id, false from public.maraton_inscripciones ii
             where ii.maraton_id = m.id and not ii.prueba
               and not exists (select 1 from public.enrollments e2 where e2.class_id = m.class_id and e2.user_id = ii.user_id)) u
      join public.profiles pr on pr.id = u.id
      left join public.maraton_inscripciones i on i.maraton_id = m.id and i.user_id = u.id and not i.prueba
      where not public.fuera_de_seccion(m.class_id, u.id)));
end $$;

-- upload_box_students = entregas de un buzón (vigente: migración 23)
create or replace function public.upload_box_students(p_box uuid)
returns table (user_id uuid, full_name text, student_code text, permiso text, request_note text, requested_at timestamptz,
  decided_at timestamptz, decision_note text, archivos jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid := public.upload_box_assert_teacher(p_box);
begin
  return query
  select p.id, p.full_name, p.student_code, x.status, x.request_note, x.requested_at, x.decided_at, x.decision_note,
    (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nombre', f.original_name, 'bytes', f.size_bytes, 'subido', f.uploaded_at,
        'estado', f.status, 'nota', f.review_note, 'revisado', f.reviewed_at) order by f.uploaded_at desc), '[]')
     from public.upload_files f where f.box_id = p_box and f.user_id = p.id)
  from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' and p.active
  left join public.upload_permissions x on x.box_id = p_box and x.user_id = p.id
  where e.class_id = v_class
  order by (x.status = 'solicitado') desc nulls last, p.full_name;
end;
$$;

-- lab_controles_seccion = controles de laboratorio (vigente: migración 91)
create or replace function public.lab_controles_seccion(p_class uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare n integer; v_curso text; v_sec text;
begin
  if not public.grades_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  select co.laboratorio_controles, co.title, c.name into n, v_curso, v_sec
    from public.classes c join public.courses co on co.id = c.course_id where c.id = p_class;
  if n is null then raise exception 'Esta sección no es de una asignatura de laboratorio' using errcode = 'P0001'; end if;
  perform public.lab_asegurar_controles(p_class);
  return jsonb_build_object('controles', n, 'curso', v_curso, 'seccion', v_sec,
    'cajas', (select coalesce(jsonb_agg(jsonb_build_object('box_id', b.id, 'numero', b.control_number, 'abre', b.opens_at, 'cierra', b.closes_at,
                'archivado', b.archived, 'cuenta', b.cuenta_en_practica) order by b.control_number), '[]')
              from public.upload_boxes b where b.class_id = p_class and b.control_number between 1 and n),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'nombre', p.full_name, 'matricula', p.student_code, 'login', p.login_id,
        'estados', z.estados, 'entregados', z.entregados, 'aprobados', z.aprobados, 'por_corregir', z.por_corregir, 'sin_revisar', z.sin_revisar,
        'en_practica', z.en_practica)
        order by p.full_name), '[]')
      from public.enrollments e
      join public.profiles p on p.id = e.user_id and p.role = 'student' and p.active
      cross join lateral (
        select jsonb_agg(s.estado order by s.numero) estados,
          count(*) filter (where s.estado in ('entregado', 'aprobado')) entregados,
          count(*) filter (where s.estado = 'aprobado') aprobados,
          count(*) filter (where s.estado = 'requiere_correccion') por_corregir,
          count(*) filter (where s.estado = 'entregado') sin_revisar,
          count(*) filter (where s.estado in ('entregado', 'aprobado') and s.cuenta) en_practica
        from (select b.control_number numero, b.cuenta_en_practica cuenta,
                case when u.id is null then 'pendiente' when u.status = 'recibido' then 'entregado'
                     when u.status = 'aceptado' then 'aprobado' else 'requiere_correccion' end estado
              from public.upload_boxes b
              left join lateral (select f.id, f.status from public.upload_files f where f.box_id = b.id and f.user_id = p.id
                                 order by f.uploaded_at desc, f.id desc limit 1) u on true
              where b.class_id = p_class and b.control_number between 1 and n) s) z
      where e.class_id = p_class));
end;
$$;

revoke all on function public.class_extra_points(uuid), public.class_grade_parts(uuid), public.pes_detalle_docente(uuid), public.pes_monitor(uuid),
  public.pes_respuestas_docente(uuid, boolean), public.clase_permisos(uuid), public.maraton_resumen(uuid), public.upload_box_students(uuid),
  public.lab_controles_seccion(uuid) from public, anon;
grant execute on function public.class_extra_points(uuid), public.class_grade_parts(uuid), public.pes_detalle_docente(uuid), public.pes_monitor(uuid),
  public.pes_respuestas_docente(uuid, boolean), public.clase_permisos(uuid), public.maraton_resumen(uuid), public.upload_box_students(uuid),
  public.lab_controles_seccion(uuid) to authenticated;
