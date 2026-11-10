-- Centro de mando del profesor (panel docente): el tablero completo en UNA consulta y la línea de tiempo de lo ocurrido.
--
-- Aditiva y de SOLO LECTURA: dos funciones nuevas, ninguna tabla, ninguna columna, ningún dato modificado.
--   · tablero_docente(): por cada sección activa del profesor, lo que pasa AHORA (conectados, exámenes en curso,
--     asistencia de hoy), lo que ESPERA al profesor (respuestas por revisar, archivos recibidos sin revisar, solicitudes
--     de acceso) y quién se QUEDA ATRÁS (no entregó actividades cerradas en los últimos 30 días, no entra hace 7 días).
--   · tablero_eventos(p_dias): lo ocurrido en esas secciones, agrupado (entregas por actividad y día, archivos por buzón
--     y día, asistencias, avisos, cierres). Sin nombres de estudiantes: solo recuentos.
-- Alcance: las mismas secciones que teacher_overview (administrador: todas; profesor: las que imparte), sin archivadas.
-- «Conectado» = tiene una pestaña del aula con latido en los últimos 150 s (migración 87). No es prueba de atención.

create or replace function public.tablero_docente()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_hoy timestamptz := date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
begin
  if not public.is_teacher() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'ahora', now(),
    'secciones', (select coalesce(jsonb_agg(jsonb_build_object(
        'class_id', c.id, 'name', c.name, 'term', c.term, 'course_id', k.id, 'course_title', k.title,
        'laboratorio', k.laboratorio_controles is not null,
        'estudiantes', (select count(*) from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
                        where e.class_id = c.id),
        'conectados', (select count(distinct e.user_id) from public.enrollments e
                       join public.profiles p on p.id = e.user_id and p.role = 'student'
                       join public.presence_connections pc on pc.user_id = e.user_id and pc.last_seen > now() - interval '150 seconds'
                       where e.class_id = c.id),
        'abiertas', (select count(*) from public.activities a where a.class_id = c.id and a.published
                     and (a.opens_at is null or a.opens_at <= now()) and (a.closes_at is null or a.closes_at > now())),
        'por_revisar', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                        join public.activities a on a.id = t.activity_id
                        where a.class_id = c.id and t.status = 'submitted' and r.status = 'pending_review' and r.manual_credit is null),
        -- archivos cuya entrega vigente (la última de cada estudiante en cada buzón) sigue «recibida» y pide aprobación
        'archivos_por_revisar', (select count(*) from (
                        select distinct on (f.box_id, f.user_id) f.status
                        from public.upload_files f join public.upload_boxes b on b.id = f.box_id
                        where b.class_id = c.id and not b.archived and b.requires_approval
                        order by f.box_id, f.user_id, f.uploaded_at desc) u where u.status = 'recibido'),
        'solicitudes_acceso', (select count(*) from public.acceso_solicitudes q where q.class_id = c.id and q.estado = 'pendiente'
                        and q.expires_at > now() and q.user_id is not null),
        'asistencia', (select jsonb_build_object('session_id', s.id, 'abierta', s.closed_at is null, 'abierta_en', s.opened_at,
                          'presentes', (select count(*) from public.attendance_records r where r.session_id = s.id))
                       from public.attendance_sessions s where s.class_id = c.id and s.opened_at >= v_hoy
                       order by s.opened_at desc limit 1),
        -- evaluaciones «en marcha»: con intentos abiertos empezados en las últimas 12 h, o abiertas que cierran en 12 h
        'examenes', (select coalesce(jsonb_agg(jsonb_build_object('activity_id', x.id, 'title', x.title, 'closes_at', x.closes_at,
                          'en_curso', x.en_curso, 'entregados', x.entregados, 'convocados', x.convocados) order by x.closes_at nulls last, x.title), '[]'::jsonb)
                     from (
                       select a.id, a.title, a.closes_at,
                         (select count(*) from public.attempts t where t.activity_id = a.id and t.status = 'in_progress'
                            and t.started_at > now() - interval '12 hours') as en_curso,
                         (select count(distinct t.user_id) from public.attempts t where t.activity_id = a.id and t.status = 'submitted') as entregados,
                         (select count(*) from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
                            where e.class_id = c.id and (a.group_id is null or e.group_id = a.group_id)) as convocados
                       from public.activities a
                       where a.class_id = c.id and a.mode = 'exam' and a.published
                         and (a.opens_at is null or a.opens_at <= now())) x
                     where x.en_curso > 0 or (x.closes_at > now() and x.closes_at < now() + interval '12 hours')),
        'no_entregaron', (select count(distinct e.user_id) from public.enrollments e
                        join public.profiles p on p.id = e.user_id and p.role = 'student'
                        join public.activities a on a.class_id = e.class_id and a.published
                          and a.closes_at <= now() and a.closes_at > now() - interval '30 days'
                          and (a.group_id is null or a.group_id = e.group_id)
                        where e.class_id = c.id and e.enrolled_at < a.closes_at
                          and not exists (select 1 from public.attempts t where t.activity_id = a.id and t.user_id = e.user_id and t.status = 'submitted')),
        'sin_entrar', (select count(*) from public.enrollments e
                        join public.profiles p on p.id = e.user_id and p.role = 'student'
                        left join public.cuenta_actividad ca on ca.user_id = e.user_id
                        where e.class_id = c.id and e.enrolled_at < now() - interval '7 days'
                          and (ca.ultimo_uso is null or ca.ultimo_uso < now() - interval '7 days'))
      ) order by k.title, c.name), '[]'::jsonb)
      from public.classes c join public.courses k on k.id = c.course_id
      where not c.archived
        and (public.is_admin() or exists (select 1 from public.class_teachers t where t.class_id = c.id and t.user_id = auth.uid()))));
end;
$$;

create or replace function public.tablero_eventos(p_dias integer default 7)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_desde timestamptz := now() - make_interval(days => least(greatest(coalesce(p_dias, 7), 1), 30));
begin
  if not public.is_teacher() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return (
    with mis as (
      select c.id, c.name from public.classes c
      where not c.archived
        and (public.is_admin() or exists (select 1 from public.class_teachers t where t.class_id = c.id and t.user_id = auth.uid()))),
    ev as (
      -- entregas de actividades, por actividad y día
      select 'entregas'::text as tipo, m.id as class_id, m.name as seccion, a.title as titulo, a.mode::text as modo,
             count(*)::integer as n, max(t.submitted_at) as cuando, a.id as ref
      from mis m join public.activities a on a.class_id = m.id
      join public.attempts t on t.activity_id = a.id and t.status = 'submitted' and t.submitted_at >= v_desde
      group by m.id, m.name, a.id, a.title, a.mode, (t.submitted_at at time zone 'America/Santo_Domingo')::date
      union all
      -- archivos subidos a los buzones (controles de laboratorio incluidos), por buzón y día
      select 'archivos', m.id, m.name, b.title, case when b.control_number is not null then 'control' else 'buzon' end,
             count(*)::integer, max(f.uploaded_at), b.id
      from mis m join public.upload_boxes b on b.class_id = m.id
      join public.upload_files f on f.box_id = b.id and f.uploaded_at >= v_desde
      group by m.id, m.name, b.id, b.title, b.control_number, (f.uploaded_at at time zone 'America/Santo_Domingo')::date
      union all
      select 'asistencia', m.id, m.name, coalesce(s.note, ''), case when s.closed_at is null then 'abierta' else 'cerrada' end,
             (select count(*) from public.attendance_records r where r.session_id = s.id)::integer, s.opened_at, s.id
      from mis m join public.attendance_sessions s on s.class_id = m.id and s.opened_at >= v_desde
      union all
      select 'aviso', m.id, m.name, an.title, '', 0, an.created_at, an.id
      from mis m join public.announcements an on an.class_id = m.id and an.created_at >= v_desde
      union all
      -- actividades que cerraron: cuántos estudiantes entregaron
      select 'cierre', m.id, m.name, a.title, a.mode::text,
             (select count(distinct t.user_id) from public.attempts t where t.activity_id = a.id and t.status = 'submitted')::integer,
             a.closes_at, a.id
      from mis m join public.activities a on a.class_id = m.id and a.published and a.closes_at >= v_desde and a.closes_at <= now()
    )
    select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'class_id', x.class_id, 'seccion', x.seccion, 'titulo', x.titulo,
             'modo', x.modo, 'n', x.n, 'cuando', x.cuando, 'ref', x.ref) order by x.cuando desc), '[]'::jsonb)
    from (select * from ev order by cuando desc limit 80) x);
end;
$$;

revoke all on function public.tablero_docente() from public, anon;
revoke all on function public.tablero_eventos(integer) from public, anon;
grant execute on function public.tablero_docente() to authenticated;
grant execute on function public.tablero_eventos(integer) to authenticated;
