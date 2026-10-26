-- =============================================================================
-- Analítica del tiempo de aprendizaje (exclusiva del profesor).
--
-- Modelo: una fila por «visita» (una subsección abierta en una pestaña, cortada además en cada cambio de hora).
-- El navegador calcula localmente el tiempo efectivo con señales de actividad (src/lib/tiempo.ts) y envía cada
-- ~15 s un LATIDO con los totales ACUMULADOS de la visita. El servidor acepta solo el incremento que cabe en el
-- tiempo real transcurrido (su propio reloj) y que no se solapa con tiempo ya acreditado al mismo estudiante en
-- otra pestaña u otro dispositivo (study_clock). Así:
--   · los totales acumulados hacen el latido idempotente (repetirlo o reenviarlo tras una desconexión no duplica);
--   · el total efectivo de un estudiante nunca supera el tiempo de reloj (tres pestañas no cuentan triple);
--   · el reloj del dispositivo no interviene: los instantes guardados son del servidor.
-- Los estudiantes no pueden leer ni escribir estas tablas: solo llaman study_beat(). Los profesores consultan
-- agregados mediante funciones que comprueban su autorización sobre la asignatura y la sección.
-- No se guarda ningún contenido escrito por el estudiante, solo duraciones y recuentos.
-- =============================================================================

-- --- configuración (una sola fila) ------------------------------------------------
create table if not exists public.study_settings (
  id smallint primary key default 1 check (id = 1),
  idle_seconds integer not null default 120 check (idle_seconds between 30 and 1800),
  reading_tail_seconds integer not null default 30 check (reading_tail_seconds between 0 and 600),
  min_visit_seconds integer not null default 15 check (min_visit_seconds between 0 and 300),
  beat_seconds integer not null default 15 check (beat_seconds between 5 and 120),
  session_gap_minutes integer not null default 30 check (session_gap_minutes between 5 and 240),
  weak_max_seconds integer not null default 180 check (weak_max_seconds between 0 and 1800),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check (reading_tail_seconds <= idle_seconds)
);
insert into public.study_settings (id) values (1) on conflict do nothing;
alter table public.study_settings enable row level security;
comment on table public.study_settings is 'Parámetros del algoritmo de tiempo efectivo. Se leen con study_config(); los cambia el administrador con set_study_settings().';

-- --- visitas ---------------------------------------------------------------------
create table if not exists public.study_visits (
  id uuid primary key,                                   -- generado por el navegador (idempotencia)
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null,                              -- pestaña (se conserva al recargar)
  course_id uuid references public.courses (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  group_id uuid references public.class_groups (id) on delete set null,
  unit_id uuid references public.units (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  activity_id uuid references public.activities (id) on delete set null,
  section text not null check (section ~ '^[a-z0-9][a-z0-9:_-]{0,59}$'),
  started_at timestamptz not null default now(),         -- reloj del servidor
  last_beat_at timestamptz not null default now(),
  seq integer not null default 0,
  effective_seconds integer not null default 0 check (effective_seconds >= 0),
  visible_seconds integer not null default 0 check (visible_seconds >= 0),
  idle_seconds integer not null default 0 check (idle_seconds >= 0),
  hidden_seconds integer not null default 0 check (hidden_seconds >= 0),
  weak_seconds integer not null default 0 check (weak_seconds >= 0),       -- efectivo sostenido solo por el ratón
  clamped_seconds integer not null default 0 check (clamped_seconds >= 0), -- rechazado por la validación
  interactions integer not null default 0 check (interactions >= 0),
  answers integer not null default 0 check (answers >= 0),
  offline_sync boolean not null default false,           -- llegó algún tramo tras una desconexión
  created_at timestamptz not null default now()
);
create index if not exists study_visits_course_idx on public.study_visits (course_id, started_at);
create index if not exists study_visits_user_idx on public.study_visits (user_id, started_at);
create index if not exists study_visits_lesson_idx on public.study_visits (lesson_id);
create index if not exists study_visits_class_idx on public.study_visits (class_id);
alter table public.study_visits enable row level security;
-- Sin políticas: nadie lee ni escribe directamente. Escritura: study_beat(). Lectura: funciones analytics_*().
revoke all on public.study_visits from anon, authenticated;
comment on table public.study_visits is 'Tiempo de uso por subsección (solo duraciones). PROTEGIDA: invisible para los estudiantes; los profesores la consultan agregada.';

-- Reloj de acreditación de cada estudiante: avanza exactamente lo que se le acredita (sin pasar de now()).
-- now() − credited_until es el tiempo real todavía disponible: impide que pestañas o dispositivos simultáneos
-- sumen más tiempo efectivo que el transcurrido.
create table if not exists public.study_clock (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  credited_until timestamptz not null
);
alter table public.study_clock enable row level security;
revoke all on public.study_clock from anon, authenticated;

-- --- auditoría -------------------------------------------------------------------------
create table if not exists public.analytics_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('exportar_csv', 'consulta_estudiante', 'cambiar_configuracion')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.analytics_audit enable row level security;
drop policy if exists analytics_audit_admin on public.analytics_audit;
create policy analytics_audit_admin on public.analytics_audit for select to authenticated using (public.is_admin());
revoke all on public.analytics_audit from anon, authenticated;
grant select on public.analytics_audit to authenticated;
comment on table public.analytics_audit is 'Auditoría de la analítica de tiempo: exportaciones, consultas individuales y cambios de configuración.';

-- --- configuración: lectura y cambio -------------------------------------------------
create or replace function public.study_config()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('idle_seconds', idle_seconds, 'reading_tail_seconds', reading_tail_seconds,
    'min_visit_seconds', min_visit_seconds, 'beat_seconds', beat_seconds,
    'session_gap_minutes', session_gap_minutes, 'weak_max_seconds', weak_max_seconds)
  from public.study_settings where id = 1
$$;

create or replace function public.set_study_settings(p_idle integer, p_tail integer, p_min_visit integer,
  p_beat integer, p_gap integer, p_weak integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_old jsonb;
begin
  if not public.is_admin() then raise exception 'Solo el administrador' using errcode = '42501'; end if;
  v_old := public.study_config();
  update public.study_settings set idle_seconds = p_idle, reading_tail_seconds = p_tail,
    min_visit_seconds = p_min_visit, beat_seconds = p_beat, session_gap_minutes = p_gap,
    weak_max_seconds = p_weak, updated_at = now(), updated_by = auth.uid()
  where id = 1;
  insert into public.analytics_audit (actor_id, action, detail)
    values (auth.uid(), 'cambiar_configuracion', jsonb_build_object('antes', v_old, 'despues', public.study_config()));
  return public.study_config();
end;
$$;

-- --- latido -------------------------------------------------------------------------------
-- p_kind: 'leccion' (p_ref = lección), 'curso' (p_ref = asignatura), 'actividad' (p_ref = actividad),
-- 'intento' (p_ref = intento propio) o 'general' (sin asignatura). La jerarquía (asignatura, unidad, sección,
-- grupo) la deduce el servidor, de modo que cualquier lección o unidad nueva se mide sin programar nada.
-- Los p_* numéricos son TOTALES acumulados de la visita; p_seq crece en cada latido.
create or replace function public.study_beat(
  p_visit uuid, p_session uuid, p_kind text, p_ref uuid, p_section text, p_seq integer,
  p_effective integer, p_visible integer, p_idle integer, p_hidden integer, p_weak integer,
  p_interactions integer, p_answers integer, p_offline boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.study_visits;
  v_new boolean := false;
  v_course uuid; v_unit uuid; v_lesson uuid; v_activity uuid; v_class uuid; v_group uuid;
  v_ref timestamptz;
  v_credited timestamptz;
  v_allow_eff double precision;
  v_allow_vis double precision;
  d_eff integer; d_vis integer; d_idle integer; d_hid integer; d_weak integer;
  c_eff integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  -- solo se mide a estudiantes con cuenta habilitada (las vistas previas del profesor no cuentan)
  if not public.my_account_ok() or coalesce((select role from public.profiles where id = v_uid), 'student') <> 'student' then
    return jsonb_build_object('tracked', false, 'server_now', now());
  end if;
  if p_kind not in ('leccion', 'curso', 'actividad', 'intento', 'general') then
    raise exception 'Tipo de contexto no válido' using errcode = '22023';
  end if;
  if p_section is null or p_section !~ '^[a-z0-9][a-z0-9:_-]{0,59}$' then
    raise exception 'Sección no válida' using errcode = '22023';
  end if;
  if least(p_effective, p_visible, p_idle, p_hidden, p_weak, p_interactions, p_answers, p_seq) < 0
     or greatest(p_effective, p_visible, p_idle, p_hidden, p_weak) > 86400 then
    raise exception 'Valores fuera de rango' using errcode = '22023';
  end if;

  -- serializa los latidos del mismo estudiante (varias pestañas o dispositivos)
  perform pg_advisory_xact_lock(hashtextextended('study:' || v_uid::text, 0));

  select * into v_row from public.study_visits where id = p_visit for update;
  if found then
    if v_row.user_id <> v_uid then raise exception 'Visita ajena' using errcode = '42501'; end if;
    if p_seq <= v_row.seq then  -- repetido o desordenado: no cambia nada
      return jsonb_build_object('tracked', true, 'duplicate', true, 'server_now', now(),
                                'effective_seconds', v_row.effective_seconds);
    end if;
  else
    v_new := true;
    if p_kind = 'leccion' then
      if p_ref is null or not public.lesson_visible_to_me(p_ref) then raise exception 'Lección no disponible' using errcode = '42501'; end if;
      select l.course_id, l.unit_id, l.id into v_course, v_unit, v_lesson from public.lessons l where l.id = p_ref;
    elsif p_kind = 'curso' then
      if p_ref is null or not public.is_enrolled_course(p_ref) then raise exception 'Asignatura no disponible' using errcode = '42501'; end if;
      v_course := p_ref;
    elsif p_kind = 'actividad' then
      if p_ref is null or not public.activity_visible_to_me(p_ref) then raise exception 'Actividad no disponible' using errcode = '42501'; end if;
      select c.course_id, a.id, a.class_id into v_course, v_activity, v_class
        from public.activities a join public.classes c on c.id = a.class_id where a.id = p_ref;
    elsif p_kind = 'intento' then
      select t.course_id, t.activity_id, t.lesson_id into v_course, v_activity, v_lesson
        from public.attempts t where t.id = p_ref and t.user_id = v_uid;
      if not found then raise exception 'Intento no disponible' using errcode = '42501'; end if;
      if v_lesson is not null then select l.unit_id into v_unit from public.lessons l where l.id = v_lesson; end if;
      if v_activity is not null then select a.class_id into v_class from public.activities a where a.id = v_activity; end if;
    end if;
    -- sección (y grupo) del estudiante en esa asignatura
    if v_course is not null then
      select e.class_id, e.group_id into v_class, v_group
        from public.enrollments e join public.classes c on c.id = e.class_id
        where e.user_id = v_uid and c.course_id = v_course and (v_class is null or e.class_id = v_class)
        order by c.archived, e.enrolled_at desc limit 1;
    end if;
  end if;

  -- tiempo real disponible según el reloj del servidor
  select credited_until into v_credited from public.study_clock where user_id = v_uid;
  if v_new then
    -- primer latido: como mucho dos intervalos de latido (o una hora si llega tras una desconexión)
    v_ref := now() - make_interval(secs => case when p_offline then 3600 else 60 end);
  else
    v_ref := v_row.last_beat_at;
  end if;
  v_allow_vis := greatest(0, extract(epoch from now() - v_ref)) + 2;   -- 2 s de tolerancia de red
  -- Presupuesto del estudiante: tiempo real aún no acreditado (su reloj avanza solo lo que se acredita).
  -- El tiempo de lectura se confirma con retraso (al reanudar la actividad), así que no basta con mirar el
  -- intervalo desde el último latido; pero el total acreditado al estudiante nunca supera el tiempo real.
  v_credited := greatest(coalesce(v_credited, now() - interval '1 hour'), now() - interval '1 day');
  v_allow_eff := greatest(0, extract(epoch from now() - v_credited)) + 2;

  d_vis := least(greatest(p_visible - coalesce(v_row.visible_seconds, 0), 0), floor(v_allow_vis)::integer);
  -- además, en una visita el efectivo acumulado no supera su tiempo visible validado
  d_eff := least(greatest(p_effective - coalesce(v_row.effective_seconds, 0), 0), floor(v_allow_eff)::integer,
                 coalesce(v_row.visible_seconds, 0) + d_vis - coalesce(v_row.effective_seconds, 0));
  d_eff := greatest(d_eff, 0);
  c_eff := greatest(p_effective - coalesce(v_row.effective_seconds, 0), 0) - d_eff;
  d_idle := least(greatest(p_idle - coalesce(v_row.idle_seconds, 0), 0), floor(v_allow_vis)::integer);
  d_hid := least(greatest(p_hidden - coalesce(v_row.hidden_seconds, 0), 0), floor(v_allow_vis)::integer + 3600);
  d_weak := least(greatest(p_weak - coalesce(v_row.weak_seconds, 0), 0), d_eff);

  if v_new then
    insert into public.study_visits (id, user_id, session_id, course_id, class_id, group_id, unit_id, lesson_id,
        activity_id, section, started_at, last_beat_at, seq, effective_seconds, visible_seconds, idle_seconds,
        hidden_seconds, weak_seconds, clamped_seconds, interactions, answers, offline_sync)
      values (p_visit, v_uid, p_session, v_course, v_class, v_group, v_unit, v_lesson, v_activity, p_section,
        now() - make_interval(secs => d_vis + d_idle), now(), p_seq, d_eff, d_vis, d_idle, d_hid, d_weak, c_eff,
        least(p_interactions, 100000), least(p_answers, 10000), coalesce(p_offline, false))
      returning * into v_row;
  else
    update public.study_visits set
      seq = p_seq, last_beat_at = now(),
      effective_seconds = effective_seconds + d_eff, visible_seconds = visible_seconds + d_vis,
      idle_seconds = idle_seconds + d_idle, hidden_seconds = hidden_seconds + d_hid,
      weak_seconds = weak_seconds + d_weak, clamped_seconds = clamped_seconds + c_eff,
      interactions = greatest(interactions, least(p_interactions, 100000)),
      answers = greatest(answers, least(p_answers, 10000)),
      offline_sync = offline_sync or coalesce(p_offline, false)
    where id = p_visit
    returning * into v_row;
  end if;

  if d_eff > 0 then
    insert into public.study_clock (user_id, credited_until)
      values (v_uid, least(now(), v_credited + make_interval(secs => d_eff)))
      on conflict (user_id) do update set credited_until = excluded.credited_until;
  end if;

  return jsonb_build_object('tracked', true, 'server_now', now(), 'accepted', d_eff,
                            'effective_seconds', v_row.effective_seconds);
end;
$$;

-- --- consultas del profesor ------------------------------------------------------------------
-- Visitas que el usuario actual puede analizar, ya filtradas. Uso interno (sin permiso de ejecución directa).
-- Autorizado: administrador, personal de la asignatura (todas sus secciones) o profesor de la sección concreta.
create or replace function public.analytics_visits(
  p_course uuid, p_class uuid, p_group uuid, p_user uuid, p_unit uuid, p_lesson uuid, p_activity uuid,
  p_section text, p_from date, p_to date)
returns setof public.study_visits
language sql stable security definer set search_path = ''
as $$
  select v.* from public.study_visits v
  join public.classes c on c.id = v.class_id
  where v.course_id = p_course
    and c.course_id = p_course
    and (public.is_course_staff(p_course) or public.is_class_teacher(v.class_id))
    and (p_class is null or v.class_id = p_class)
    and (p_group is null or v.group_id = p_group)
    and (p_user is null or v.user_id = p_user)
    and (p_unit is null or v.unit_id = p_unit)
    and (p_lesson is null or v.lesson_id = p_lesson)
    and (p_activity is null or v.activity_id = p_activity)
    and (p_section is null or v.section = p_section)
    and (p_from is null or (v.started_at at time zone 'America/Santo_Domingo')::date >= p_from)
    and (p_to is null or (v.started_at at time zone 'America/Santo_Domingo')::date <= p_to)
$$;

create or replace function public.analytics_assert(p_course uuid, p_class uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_course is null then raise exception 'Elija una asignatura' using errcode = '22023'; end if;
  if not public.is_teacher() then raise exception 'Solo el profesorado' using errcode = '42501'; end if;
  if not (public.is_course_staff(p_course)
          or (p_class is not null and public.is_class_teacher(p_class))
          or (p_class is null and public.teaches_course(p_course))) then
    raise exception 'No tiene acceso a esta asignatura o sección' using errcode = '42501';
  end if;
end;
$$;

-- Árbol de contenidos agregado a un nivel: 'unidad' (capítulo), 'leccion' (sección) o 'seccion' (subsección).
-- Las sesiones se calculan en el propio nivel (no se suman desde los niveles inferiores, que las duplicarían).
-- Solo cuentan como efectivas las visitas que superaron el mínimo (el navegador envía 0 en las breves).
create or replace function public.analytics_tree(
  p_course uuid, p_class uuid, p_group uuid, p_user uuid, p_level text,
  p_unit uuid, p_lesson uuid, p_activity uuid, p_from date, p_to date)
returns table (nodo text, unit_id uuid, lesson_id uuid, activity_id uuid, section text,
  effective_seconds bigint, visible_seconds bigint, idle_seconds bigint, hidden_seconds bigint,
  visits bigint, effective_visits bigint, sessions bigint, students bigint,
  first_visit timestamptz, last_visit timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare v_gap interval;
begin
  perform public.analytics_assert(p_course, p_class);
  if p_level not in ('unidad', 'leccion', 'seccion') then raise exception 'Nivel no válido' using errcode = '22023'; end if;
  select make_interval(mins => session_gap_minutes) into v_gap from public.study_settings where id = 1;
  return query
  with v as (
    select x.*, case p_level
        when 'unidad' then coalesce(x.unit_id::text, case when x.activity_id is not null then 'actividades' else 'paginas' end)
        when 'leccion' then coalesce(x.lesson_id::text, 'act:' || x.activity_id::text, 'pag:' || x.section)
        else x.section end as k
    from public.analytics_visits(p_course, p_class, p_group, p_user, p_unit, p_lesson, p_activity, null, p_from, p_to) x
  ), s as (
    select e.k, e.user_id,
      case when lag(e.last_beat_at) over w is null or e.started_at - lag(e.last_beat_at) over w > v_gap then 1 else 0 end as nueva
    from v e where e.effective_seconds > 0
    window w as (partition by e.user_id, e.k order by e.started_at)
  ), ses as (select s.k, sum(s.nueva)::bigint as n from s group by s.k)
  select v.k,
    (array_agg(v.unit_id) filter (where v.unit_id is not null))[1],
    (array_agg(v.lesson_id) filter (where v.lesson_id is not null))[1],
    (array_agg(v.activity_id) filter (where v.activity_id is not null))[1],
    (array_agg(v.section))[1],
    sum(v.effective_seconds)::bigint, sum(v.visible_seconds)::bigint, sum(v.idle_seconds)::bigint, sum(v.hidden_seconds)::bigint,
    count(*)::bigint, count(*) filter (where v.effective_seconds > 0)::bigint,
    coalesce(max(ses.n), 0)::bigint,
    count(distinct v.user_id) filter (where v.effective_seconds > 0)::bigint,
    min(v.started_at), max(v.last_beat_at)
  from v left join ses on ses.k = v.k
  group by v.k;
end;
$$;

-- Un renglón por estudiante del alcance (incluidos los que no tienen actividad, con ceros).
create or replace function public.analytics_students(
  p_course uuid, p_class uuid, p_group uuid, p_unit uuid, p_lesson uuid, p_activity uuid, p_section text,
  p_from date, p_to date)
returns table (user_id uuid, full_name text, student_code text, class_id uuid,
  effective_seconds bigint, visible_seconds bigint, effective_visits bigint, sessions bigint, days_active bigint,
  first_visit timestamptz, last_visit timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare v_gap interval;
begin
  perform public.analytics_assert(p_course, p_class);
  select make_interval(mins => session_gap_minutes) into v_gap from public.study_settings where id = 1;
  return query
  with alumnos as (
    select distinct on (e.user_id) e.user_id, e.class_id
    from public.enrollments e join public.classes c on c.id = e.class_id
    join public.profiles p on p.id = e.user_id
    where c.course_id = p_course and p.role = 'student'
      and (p_class is null or e.class_id = p_class)
      and (p_group is null or e.group_id = p_group)
      and (public.is_course_staff(p_course) or public.is_class_teacher(e.class_id))
    order by e.user_id, c.archived, e.enrolled_at desc
  ), v as (
    select * from public.analytics_visits(p_course, p_class, p_group, null, p_unit, p_lesson, p_activity, p_section, p_from, p_to)
  ), s as (
    select e.user_id,
      case when lag(e.last_beat_at) over w is null or e.started_at - lag(e.last_beat_at) over w > v_gap then 1 else 0 end as nueva
    from v e where e.effective_seconds > 0
    window w as (partition by e.user_id order by e.started_at)
  ), ses as (select s.user_id, sum(s.nueva)::bigint as n from s group by s.user_id),
  agg as (
    select v.user_id, sum(v.effective_seconds)::bigint as eff, sum(v.visible_seconds)::bigint as vis,
      count(*) filter (where v.effective_seconds > 0)::bigint as ev,
      count(distinct (v.started_at at time zone 'America/Santo_Domingo')::date) filter (where v.effective_seconds > 0)::bigint as dias,
      min(v.started_at) as f, max(v.last_beat_at) as l
    from v group by v.user_id
  )
  select a.user_id, p.full_name, p.student_code, a.class_id,
    coalesce(agg.eff, 0), coalesce(agg.vis, 0), coalesce(agg.ev, 0), coalesce(ses.n, 0), coalesce(agg.dias, 0),
    agg.f, agg.l
  from alumnos a join public.profiles p on p.id = a.user_id
  left join agg on agg.user_id = a.user_id
  left join ses on ses.user_id = a.user_id;
end;
$$;

-- Serie temporal (día, semana o mes, hora local de Santo Domingo).
create or replace function public.analytics_timeline(
  p_course uuid, p_class uuid, p_group uuid, p_user uuid, p_unit uuid, p_lesson uuid, p_activity uuid,
  p_section text, p_from date, p_to date, p_granularity text)
returns table (bucket date, effective_seconds bigint, visible_seconds bigint, students bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.analytics_assert(p_course, p_class);
  if p_granularity not in ('day', 'week', 'month') then raise exception 'Granularidad no válida' using errcode = '22023'; end if;
  return query
  select date_trunc(p_granularity, v.started_at at time zone 'America/Santo_Domingo')::date,
    sum(v.effective_seconds)::bigint, sum(v.visible_seconds)::bigint,
    count(distinct v.user_id) filter (where v.effective_seconds > 0)::bigint
  from public.analytics_visits(p_course, p_class, p_group, p_user, p_unit, p_lesson, p_activity, p_section, p_from, p_to) v
  group by 1 order by 1;
end;
$$;

-- Mapa de calor: día de la semana (1 = lunes … 7 = domingo) × hora local.
create or replace function public.analytics_heatmap(
  p_course uuid, p_class uuid, p_group uuid, p_user uuid, p_unit uuid, p_lesson uuid, p_activity uuid,
  p_section text, p_from date, p_to date)
returns table (dow integer, hour integer, effective_seconds bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.analytics_assert(p_course, p_class);
  return query
  select extract(isodow from v.started_at at time zone 'America/Santo_Domingo')::integer,
    extract(hour from v.started_at at time zone 'America/Santo_Domingo')::integer,
    sum(v.effective_seconds)::bigint
  from public.analytics_visits(p_course, p_class, p_group, p_user, p_unit, p_lesson, p_activity, p_section, p_from, p_to) v
  where v.effective_seconds > 0
  group by 1, 2;
end;
$$;

-- Indicadores de calidad y confiabilidad de los datos.
create or replace function public.analytics_quality(
  p_course uuid, p_class uuid, p_group uuid, p_user uuid, p_unit uuid, p_lesson uuid, p_activity uuid,
  p_section text, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r jsonb;
begin
  perform public.analytics_assert(p_course, p_class);
  select jsonb_build_object(
    'visits', count(*), 'effective_visits', count(*) filter (where v.effective_seconds > 0),
    'brief_visits', count(*) filter (where v.effective_seconds = 0),
    'effective_seconds', coalesce(sum(v.effective_seconds), 0), 'visible_seconds', coalesce(sum(v.visible_seconds), 0),
    'idle_seconds', coalesce(sum(v.idle_seconds), 0), 'hidden_seconds', coalesce(sum(v.hidden_seconds), 0),
    'weak_seconds', coalesce(sum(v.weak_seconds), 0), 'clamped_seconds', coalesce(sum(v.clamped_seconds), 0),
    'offline_visits', count(*) filter (where v.offline_sync),
    'first_visit', min(v.started_at), 'last_visit', max(v.last_beat_at))
  into r
  from public.analytics_visits(p_course, p_class, p_group, p_user, p_unit, p_lesson, p_activity, p_section, p_from, p_to) v;
  return r;
end;
$$;

-- Registro de auditoría desde el panel (exportaciones y consultas individuales).
create or replace function public.analytics_log(p_action text, p_detail jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado' using errcode = '42501'; end if;
  if p_action not in ('exportar_csv', 'consulta_estudiante') then raise exception 'Acción no válida' using errcode = '22023'; end if;
  insert into public.analytics_audit (actor_id, action, detail)
    values (auth.uid(), p_action, coalesce(p_detail, '{}'::jsonb) - 'password');
end;
$$;

-- --- permisos ----------------------------------------------------------------------------------
revoke all on function public.study_config() from public, anon;
revoke all on function public.set_study_settings(integer, integer, integer, integer, integer, integer) from public, anon;
revoke all on function public.study_beat(uuid, uuid, text, uuid, text, integer, integer, integer, integer, integer, integer, integer, integer, boolean) from public, anon;
revoke all on function public.analytics_visits(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, date) from public, anon, authenticated;
revoke all on function public.analytics_assert(uuid, uuid) from public, anon, authenticated;
revoke all on function public.analytics_tree(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, date, date) from public, anon;
revoke all on function public.analytics_students(uuid, uuid, uuid, uuid, uuid, uuid, text, date, date) from public, anon;
revoke all on function public.analytics_timeline(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, date, text) from public, anon;
revoke all on function public.analytics_heatmap(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, date) from public, anon;
revoke all on function public.analytics_quality(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, date) from public, anon;
revoke all on function public.analytics_log(text, jsonb) from public, anon;

grant execute on function public.study_config() to authenticated;
grant execute on function public.set_study_settings(integer, integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.study_beat(uuid, uuid, text, uuid, text, integer, integer, integer, integer, integer, integer, integer, integer, boolean) to authenticated;
grant execute on function public.analytics_tree(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, date, date) to authenticated;
grant execute on function public.analytics_students(uuid, uuid, uuid, uuid, uuid, uuid, text, date, date) to authenticated;
grant execute on function public.analytics_timeline(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, date, text) to authenticated;
grant execute on function public.analytics_heatmap(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, date) to authenticated;
grant execute on function public.analytics_quality(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, date) to authenticated;
grant execute on function public.analytics_log(text, jsonb) to authenticated;
