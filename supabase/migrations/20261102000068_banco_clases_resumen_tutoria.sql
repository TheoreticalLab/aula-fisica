-- =============================================================================
-- Migración 68 · Banco por origen, preguntas desde una clase impartida, resumen semanal del profesor y mapa de
-- dominio para tutorías. Solo añade: una columna nueva (nullable) y funciones.
--
--  1) Origen de cada ejercicio del banco: contenido del curso, profesorado, IA por temas, IA desde una clase
--     impartida, variante de control.
--  2) «Proponer preguntas de esta clase»: una generación (migración 55) ligada a una clase impartida. El modelo recibe
--     el tema y la versión ampliada de la clase (texto de la pizarra, sin fotos ni datos de estudiantes). Todo queda
--     como BORRADOR del banco (no publicado); al publicarlo, entra en las sugerencias del catálogo de control de las
--     prácticas que comparten conceptos.
--  3) Resumen semanal del profesor (panel docente y Orbe Control).
--  4) Mapa de dominio por estudiante: práctica, evaluaciones y controles por concepto, más la señal VTA.
--     Son señales pedagógicas, no pruebas de uso de IA.
-- =============================================================================

alter table public.question_generation_runs add column if not exists session_id uuid references public.class_sessions (id) on delete set null;
create index if not exists question_generation_runs_session_idx on public.question_generation_runs (session_id) where session_id is not null;

-- -----------------------------------------------------------------------------
-- 1) Origen de los ejercicios del banco
-- -----------------------------------------------------------------------------
create or replace function public.banco_origen(p_course uuid)
returns table (exercise_id uuid, origen text, session_id uuid, clase_titulo text, clase_fecha date, verificacion text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.generar_permitido(auth.uid(), p_course) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select e.id,
    case when gi.exercise_id is not null and gr.session_id is not null then 'clase'
         when gi.exercise_id is not null then 'ia'
         when exists (select 1 from public.control_items ci where ci.exercise_id = e.id and ci.generador in ('plantilla', 'ia')) then 'control'
         when e.created_by is not null then 'docente'
         else 'contenido' end,
    gr.session_id, cs.title, cs.fecha, gi.verificacion
  from public.exercises e
  left join public.question_generation_items gi on gi.exercise_id = e.id
  left join public.question_generation_runs gr on gr.id = gi.run_id
  left join public.class_sessions cs on cs.id = gr.session_id
  where e.course_id = p_course;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Preguntas desde una clase impartida
-- -----------------------------------------------------------------------------

-- Lo que el generador necesita saber de la clase (lecciones sugeridas: las enlazadas o, si no hay, las de su unidad)
create or replace function public.generar_clase_info(p_session uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.class_sessions; v_course uuid; v_lecciones uuid[];
begin
  select * into s from public.class_sessions where id = p_session;
  select cl.course_id into v_course from public.classes cl where cl.id = s.class_id;
  if s.id is null or not public.clase_es_docente(s.class_id, auth.uid()) or not public.generar_permitido(auth.uid(), v_course) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct x.lesson_id), '{}') into v_lecciones from (
    select k.lesson_id from public.class_resource_links k where k.session_id = s.id and k.estado <> 'rechazado' and k.lesson_id is not null
    union all
    select l.id from public.class_resource_links k join public.lessons l on l.unit_id = k.unit_id
      where k.session_id = s.id and k.estado <> 'rechazado' and k.tipo = 'unidad') x;
  if cardinality(v_lecciones) = 0 and s.unit_id is not null then
    select coalesce(array_agg(l.id), '{}') into v_lecciones from public.lessons l where l.unit_id = s.unit_id;
  end if;
  return jsonb_build_object('session_id', s.id, 'course_id', v_course, 'titulo', s.title, 'fecha', s.fecha, 'temas', to_jsonb(s.temas),
    'seccion', (select c.name from public.classes c where c.id = s.class_id),
    'lecciones', to_jsonb(v_lecciones),
    'ampliada', (select v.estado from public.class_ai_versions v where v.session_id = s.id and v.estado in ('publicada', 'borrador')
                 order by (v.estado = 'publicada') desc, v.numero desc limit 1),
    'ya_generadas', (select count(*) from public.question_generation_items i join public.question_generation_runs r on r.id = i.run_id where r.session_id = s.id));
end;
$$;

create or replace function public.generar_iniciar_clase(p_session uuid, p_spec jsonb, p_solicitadas integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions; v_course uuid; v_id uuid;
begin
  select * into s from public.class_sessions where id = p_session;
  select cl.course_id into v_course from public.classes cl where cl.id = s.class_id;
  if s.id is null or not public.clase_es_docente(s.class_id, auth.uid()) or not public.generar_permitido(auth.uid(), v_course) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_solicitadas is null or p_solicitadas not between 1 and 300 then raise exception 'Se pueden pedir entre 1 y 300 preguntas' using errcode = '22023'; end if;
  insert into public.question_generation_runs (course_id, actor_id, spec, solicitadas, session_id)
    values (v_course, auth.uid(), coalesce(p_spec, '{}'::jsonb), p_solicitadas, s.id) returning id into v_id;
  return v_id;
end;
$$;

-- Contexto del modelo (migración 55) + «clase» cuando la generación nace de una clase impartida
create or replace function public.svc_generar_contexto(p_actor uuid, p_run uuid, p_lessons uuid[])
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r public.question_generation_runs; s public.class_sessions; v_texto text;
begin
  select * into r from public.question_generation_runs where id = p_run;
  if r.id is null or r.actor_id is distinct from p_actor or not public.generar_permitido(p_actor, r.course_id) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if r.creadas + r.rechazadas >= r.solicitadas * 2 then raise exception 'Esta generación ya terminó' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(p_lessons) x where not exists (select 1 from public.lessons l where l.id = x and l.course_id = r.course_id)) then
    raise exception 'Lección ajena a la asignatura' using errcode = '42501'; end if;
  if r.session_id is not null then
    select * into s from public.class_sessions where id = r.session_id;
    -- versión ampliada: la publicada o, si no hay, el último borrador; sin la nota de lectura de la pizarra
    select string_agg('## ' || (x ->> 'titulo') || E'\n' || (x ->> 'cuerpo'), E'\n\n' order by o) into v_texto
    from (select v.contenido from public.class_ai_versions v where v.session_id = s.id and v.estado in ('publicada', 'borrador')
          order by (v.estado = 'publicada') desc, v.numero desc limit 1) v,
         jsonb_array_elements(case when jsonb_typeof(v.contenido -> 'secciones') = 'array' then v.contenido -> 'secciones' else '[]'::jsonb end) with ordinality as t(x, o)
    where coalesce(x ->> 'clave', '') <> 'incertidumbres';
  end if;
  return jsonb_build_object(
    'asignatura', (select title from public.courses where id = r.course_id),
    'lecciones', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.title, 'unidad', u.title, 'resumen', left(l.summary, 500),
        'conceptos', (select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'nombre', c.name)), '[]'::jsonb) from public.concepts c where c.lesson_id = l.id))), '[]'::jsonb)
      from public.lessons l join public.units u on u.id = l.unit_id where l.id = any (p_lessons)),
    'existentes', (select coalesce(jsonb_agg(x.p), '[]'::jsonb) from (select left(e.prompt, 160) p from public.exercises e
      where e.lesson_id = any (p_lessons) order by e.updated_at desc limit 30) x),
    'clase', case when s.id is not null then jsonb_build_object('titulo', s.title, 'fecha', s.fecha, 'temas', to_jsonb(s.temas),
        'descripcion', left(s.descripcion, 1000), 'contenido', left(coalesce(v_texto, ''), 8000)) end);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Resumen semanal del profesor (sus secciones activas)
-- -----------------------------------------------------------------------------
create or replace function public.resumen_semanal()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_yo uuid := auth.uid(); v_desde timestamptz := now() - interval '7 days'; v_admin boolean;
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
begin
  if not exists (select 1 from public.profiles p where p.id = v_yo and p.active and p.role in ('teacher', 'admin')) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  v_admin := public.is_admin();
  return jsonb_build_object('desde', v_desde, 'hasta', now(), 'es_admin', v_admin,
    'secciones', (select coalesce(jsonb_agg(x.j order by x.curso, x.nombre), '[]'::jsonb) from (
      select co.title curso, cl.name nombre, jsonb_build_object('class_id', cl.id, 'seccion', cl.name, 'asignatura', co.title,
        'controles_por_confirmar', (select count(*) from public.control_assignments a join public.control_sessions s on s.id = a.session_id
            where s.class_id = cl.id and s.estado in ('activo', 'cerrado') and a.estado = 'elegible' and a.confirmado_at is null and a.attempt_id is not null),
        'controles_sin_cerrar', (select count(*) from public.control_sessions s where s.class_id = cl.id and s.estado in ('preparado', 'activo')
            and s.preparado_at < now() - interval '3 hours'),
        'controles_semana', (select count(*) from public.control_sessions s where s.class_id = cl.id and s.iniciado_at >= v_desde),
        'coincidencias_pendientes', (select count(*) from public.duplicate_requests d where d.class_id = cl.id and d.estado = 'pendiente'),
        'coincidencias_semana', (select count(*) from public.duplicate_requests d where d.class_id = cl.id and d.updated_at >= v_desde),
        'fotos_por_revisar', (select count(*) from public.class_sessions s where s.class_id = cl.id and s.fotos_estado = 'pendiente'),
        'ampliadas_por_revisar', (select count(*) from public.class_sessions s where s.class_id = cl.id and s.version_publicada is null
            and exists (select 1 from public.class_ai_versions v where v.session_id = s.id and v.estado = 'borrador')),
        'bloqueo_activo', coalesce((select hs.bloquear and (hs.abierto or hs.libre_habilitado) from public.hist_settings hs where hs.class_id = cl.id), false),
        'bloqueados', (select count(*) from public.hist_settings hs join public.enrollments e on e.class_id = hs.class_id
            join public.profiles pr on pr.id = e.user_id and pr.role = 'student'
            where hs.class_id = cl.id and hs.bloquear and (hs.abierto or hs.libre_habilitado) and not public.hist_terminado(cl.id, e.user_id))) j
      from public.classes cl join public.courses co on co.id = cl.course_id
      where not cl.archived and exists (select 1 from public.class_teachers ct where ct.class_id = cl.id and ct.user_id = v_yo)) x),
    -- borradores del banco creados con IA y aún sin publicar (por revisar)
    'banco', (select coalesce(jsonb_agg(jsonb_build_object('course_id', b.course_id, 'asignatura', b.title, 'ia', b.ia, 'clase', b.clase) order by b.title), '[]'::jsonb) from (
      select co.id course_id, co.title,
        count(*) filter (where gr.session_id is null) ia, count(*) filter (where gr.session_id is not null) clase
      from public.question_generation_items gi join public.question_generation_runs gr on gr.id = gi.run_id
      join public.exercises e on e.id = gi.exercise_id and not e.published join public.courses co on co.id = gr.course_id
      where public.generar_permitido(v_yo, co.id) and not co.archived
      group by co.id, co.title) b),
    'ia', jsonb_build_object(
      'mio_usd', (select coalesce(sum(u.cost_usd), 0) from public.orbe_ia_usage u where u.actor_id = v_yo and u.created_at >= v_desde and u.status = 'ok' and not u.simulated),
      'mio_llamadas', (select count(*) from public.orbe_ia_usage u where u.actor_id = v_yo and u.created_at >= v_desde and u.status = 'ok'),
      'mio_por_proposito', (select coalesce(jsonb_object_agg(p.purpose, p.usd), '{}'::jsonb) from (select u.purpose, round(sum(u.cost_usd), 4) usd
          from public.orbe_ia_usage u where u.actor_id = v_yo and u.created_at >= v_desde and u.status = 'ok' and not u.simulated group by u.purpose) p),
      'total_usd', case when v_admin then (select coalesce(sum(u.cost_usd), 0) from public.orbe_ia_usage u where u.created_at >= v_desde and u.status = 'ok' and not u.simulated) end,
      'mes_usd', case when v_admin then (select coalesce(sum(u.cost_usd), 0) from public.orbe_ia_usage u where u.created_at >= v_mes and u.status = 'ok' and not u.simulated) end,
      'presupuesto_mes', case when v_admin then (select c.monthly_budget_usd from public.orbe_ia_config c where c.id = 1) end));
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Mapa de dominio de un estudiante para tutorías (por concepto de la asignatura de la sección)
--    práctica: respuestas en prácticas y práctica libre; evaluaciones: actividades en modo examen (exámenes, quizzes,
--    controles); controles: Prácticas de Control confirmadas (vta_datos). Las 10 respuestas más recientes por concepto,
--    con el mismo valor que el dominio de la ficha (response_mastery_value).
-- -----------------------------------------------------------------------------
create or replace function public.tutoria_mapa(p_class uuid, p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_course uuid; v_vta jsonb;
begin
  if p_class is null or p_user is null or not public.is_class_teacher(p_class)
     or not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = p_user) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  select cl.course_id into v_course from public.classes cl where cl.id = p_class;
  select x into v_vta from jsonb_array_elements(public.vta_seccion(p_class) -> 'estudiantes') x where (x ->> 'user_id')::uuid = p_user;
  return (with ev as (
      select unnest(e.concepts) slug, public.response_mastery_value(r, a.mode) val, a.mode = 'exam' es_eval, r.updated_at
      from public.responses r join public.attempts a on a.id = r.attempt_id join public.exercises e on e.id = r.exercise_id
      where r.user_id = p_user and a.course_id = v_course),
    rk as (select ev.*, row_number() over (partition by slug, es_eval order by updated_at desc) rn,
                  row_number() over (partition by slug order by updated_at desc) rg from ev where val is not null),
    agg as (select slug,
        count(*) filter (where not es_eval and rn <= 10)::integer np, round(avg(val) filter (where not es_eval and rn <= 10), 3) sp,
        count(*) filter (where es_eval and rn <= 10)::integer ne, round(avg(val) filter (where es_eval and rn <= 10), 3) se,
        count(*) filter (where rg <= 10)::integer ng, round(avg(val) filter (where rg <= 10), 3) sg,
        max(updated_at) ultima
      from rk group by slug),
    ctl as (select d.competencia slug, count(*)::integer n, round(avg(d.control_pct), 3) pct, round(avg(d.practica_pct), 3) practica, max(d.fecha) ultima
      from public.vta_datos(p_class) d where d.user_id = p_user group by d.competencia)
    select jsonb_build_object(
      'asignatura', (select title from public.courses where id = v_course),
      'seccion', (select name from public.classes where id = p_class),
      'estudiante', (select full_name from public.profiles where id = p_user),
      'conceptos', coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'nombre', c.name, 'leccion', l.title, 'leccion_id', c.lesson_id,
          'practica', jsonb_build_object('n', coalesce(agg.np, 0), 'score', agg.sp),
          'evaluaciones', jsonb_build_object('n', coalesce(agg.ne, 0), 'score', agg.se),
          'controles', jsonb_build_object('n', coalesce(ctl.n, 0), 'pct', ctl.pct, 'practica', ctl.practica),
          'general', jsonb_build_object('n', coalesce(agg.ng, 0), 'score', agg.sg),
          'ultima', greatest(agg.ultima, ctl.ultima))
        order by u.position nulls last, l.position nulls last, c.name), '[]'::jsonb),
      'vta', v_vta,
      'pendientes_de_confirmar', (select count(*) from public.control_assignments a join public.control_sessions s on s.id = a.session_id
        where s.class_id = p_class and a.user_id = p_user and a.estado = 'elegible' and a.confirmado_at is null and a.attempt_id is not null),
      'aviso', 'Señales pedagógicas para orientar la tutoría. No son pruebas de uso de IA ni de irregularidades.')
    from public.concepts c left join public.lessons l on l.id = c.lesson_id left join public.units u on u.id = l.unit_id
    left join agg on agg.slug = c.slug left join ctl on ctl.slug = c.slug
    where c.course_id = v_course);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['banco_origen(uuid)', 'generar_clase_info(uuid)', 'generar_iniciar_clase(uuid, jsonb, integer)', 'resumen_semanal()', 'tutoria_mapa(uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.svc_generar_contexto(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.svc_generar_contexto(uuid, uuid, uuid[]) to service_role;
