-- =============================================================================
-- LIEIA · Laboratorio de inferencia estocástica de integridad académica: instrumentación y consultas reales.
--
-- 1) INSTRUMENTACIÓN. Hasta ahora, en un examen solo quedaba la ÚLTIMA respuesta de cada pregunta, y su hora se
--    sobrescribe al entregar y calificar: no había tiempo por pregunta. Un disparador sobre responses registra cada
--    cambio de respuesta durante un intento de actividad (hora del servidor + huella de la respuesta, no su contenido).
--    El disparador está blindado: si fallara, NO impide guardar la respuesta del estudiante.
-- 2) CONSULTA MINIMIZADA (lieia_exam_data): solo para el profesorado de la sección. Seudónimos (E01…), huellas
--    opacas de las respuestas (para saber si dos respuestas son iguales sin ver su contenido), acierto y tiempos.
--    Los nombres solo se revelan con lieia_reveal, que queda auditada aparte.
-- 3) AUDITORÍA de cada consulta (lieia_audit). Sin sanciones ni clasificaciones automáticas: el servidor solo entrega
--    datos; el análisis estadístico (validado en el laboratorio con datos sintéticos) se hace en el panel.
-- Aditiva: tablas, un disparador nuevo y funciones nuevas. No modifica ni borra datos existentes.
-- =============================================================================

create table if not exists public.exam_item_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  exercise_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answer_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists exam_item_events_attempt_idx on public.exam_item_events (attempt_id, exercise_id, created_at);

create table if not exists public.lieia_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('consulta_examen', 'revelar_nombres')),
  activity_id uuid,
  created_at timestamptz not null default now()
);

alter table public.exam_item_events enable row level security;
alter table public.lieia_audit enable row level security;
revoke all on public.exam_item_events, public.lieia_audit from anon, authenticated;

-- Disparador de instrumentación (blindado)
create or replace function public.lieia_registrar_respuesta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    if exists (select 1 from public.attempts a where a.id = new.attempt_id and a.activity_id is not null and a.status = 'in_progress') then
      insert into public.exam_item_events (attempt_id, exercise_id, user_id, answer_hash)
        values (new.attempt_id, new.exercise_id, new.user_id, coalesce(public.lieia_ficha(new.answer), 'vacia'));
    end if;
  exception when others then
    null; -- la instrumentación nunca debe impedir que se guarde la respuesta
  end;
  return null;
end;
$$;
revoke all on function public.lieia_registrar_respuesta() from public, anon, authenticated;

create trigger responses_lieia_ins after insert on public.responses
  for each row execute function public.lieia_registrar_respuesta();
create trigger responses_lieia_upd after update of answer on public.responses
  for each row when (old.answer is distinct from new.answer) execute function public.lieia_registrar_respuesta();

-- Ficha opaca de una respuesta: igual si y solo si la respuesta es la misma (opciones elegidas, verdadero/falso o
-- texto sin espacios ni mayúsculas; la justificación libre no cuenta). null si está en blanco.
create or replace function public.lieia_ficha(p_answer jsonb)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_answer is null or p_answer = '{}'::jsonb
      or (coalesce(case when jsonb_typeof(p_answer -> 'selected') = 'array' then jsonb_array_length(p_answer -> 'selected') end, 0) = 0
          and p_answer -> 'value' is null and coalesce(btrim(p_answer ->> 'text'), '') = '') then null
    else left(md5(jsonb_build_object('s', p_answer -> 'selected', 'v', p_answer -> 'value',
                    't', lower(regexp_replace(coalesce(p_answer ->> 'text', ''), '\s+', '', 'g')))::text), 12)
  end
$$;
revoke all on function public.lieia_ficha(jsonb) from public, anon, authenticated;

create or replace function public.lieia_assert(p_activity uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null or not public.is_teacher() or not public.is_class_teacher(v_class) then
    raise exception 'No tiene acceso a esta actividad' using errcode = '42501';
  end if;
  return v_class;
end;
$$;
revoke all on function public.lieia_assert(uuid) from public, anon, authenticated;

-- Actividades analizables de una sección
create or replace function public.lieia_activities(p_class uuid)
returns table (id uuid, titulo text, modo text, cierra timestamptz, entregados bigint, con_tiempos bigint, items bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  return query
  select a.id, a.title, a.mode::text, a.closes_at,
    (select count(distinct t.user_id) from public.attempts t where t.activity_id = a.id and t.status = 'submitted'),
    (select count(distinct t.user_id) from public.attempts t where t.activity_id = a.id and t.status = 'submitted'
       and exists (select 1 from public.exam_item_events ev where ev.attempt_id = t.id)),
    (select count(*) from public.activity_items i where i.activity_id = a.id)
  from public.activities a where a.class_id = p_class
  order by coalesce(a.closes_at, a.created_at) desc;
end;
$$;

-- Datos minimizados de una evaluación (primer intento entregado de cada estudiante)
create or replace function public.lieia_exam_data(p_activity uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := public.lieia_assert(p_activity); r jsonb;
begin
  insert into public.lieia_audit (actor_id, action, activity_id) values (auth.uid(), 'consulta_examen', p_activity);
  with intentos as (
    select distinct on (t.user_id) t.* from public.attempts t
    join public.profiles p on p.id = t.user_id and p.role = 'student'
    where t.activity_id = p_activity and t.status = 'submitted'
    order by t.user_id, t.attempt_number, t.started_at
  ), seud as (
    select i.*, 'E' || lpad(row_number() over (order by md5(i.user_id::text || p_activity::text))::text, 2, '0') seudonimo from intentos i
  )
  select jsonb_build_object(
    'actividad', (select jsonb_build_object('id', a.id, 'titulo', a.title, 'modo', a.mode, 'abre', a.opens_at, 'cierra', a.closes_at) from public.activities a where a.id = p_activity),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', ai.exercise_id, 'posicion', ai.position, 'formato', e.format,
        'opciones', case when e.options is not null then jsonb_array_length(e.options) end) order by ai.position), '[]')
      from public.activity_items ai join public.exercises e on e.id = ai.exercise_id where ai.activity_id = p_activity),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('seudonimo', s.seudonimo, 'inicio', s.started_at, 'fin', s.submitted_at,
        'oculto', (select coalesce(sum(v.hidden_seconds), 0) from public.study_visits v where v.user_id = s.user_id and v.activity_id = p_activity
                     and v.started_at between s.started_at - interval '5 minutes' and coalesce(s.submitted_at, s.started_at + interval '4 hours')),
        'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', rr.exercise_id,
            'ficha', public.lieia_ficha(rr.answer),
            'correcta', case when rr.status = 'correct' then true when rr.status in ('incorrect', 'invalid', 'revealed') then false
                             when rr.status = 'partial' then false else null end,
            'primera', (select min(ev.created_at) from public.exam_item_events ev where ev.attempt_id = s.id and ev.exercise_id = rr.exercise_id),
            'ultima', (select max(ev.created_at) from public.exam_item_events ev where ev.attempt_id = s.id and ev.exercise_id = rr.exercise_id),
            'cambios', (select count(*) from public.exam_item_events ev where ev.attempt_id = s.id and ev.exercise_id = rr.exercise_id))), '[]')
          from public.responses rr where rr.attempt_id = s.id)
      ) order by s.seudonimo), '[]') from seud s),
    'con_tiempos', coalesce((select count(*) filter (where exists (select 1 from public.exam_item_events ev where ev.attempt_id = s.id)) * 2 >= count(*)
                    and count(*) > 0 from seud s), false)
  ) into r;
  return r;
end;
$$;

-- Revelar los nombres (acción explícita del profesor, auditada aparte)
create or replace function public.lieia_reveal(p_activity uuid)
returns table (seudonimo text, user_id uuid, full_name text, student_code text)
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := public.lieia_assert(p_activity);
begin
  insert into public.lieia_audit (actor_id, action, activity_id) values (auth.uid(), 'revelar_nombres', p_activity);
  return query
  with intentos as (
    select distinct on (t.user_id) t.user_id from public.attempts t
    join public.profiles p on p.id = t.user_id and p.role = 'student'
    where t.activity_id = p_activity and t.status = 'submitted'
    order by t.user_id, t.attempt_number, t.started_at
  )
  select 'E' || lpad(row_number() over (order by md5(i.user_id::text || p_activity::text))::text, 2, '0'), i.user_id, p.full_name, p.student_code
  from intentos i join public.profiles p on p.id = i.user_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['lieia_activities(uuid)', 'lieia_exam_data(uuid)', 'lieia_reveal(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
