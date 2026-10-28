-- =============================================================================
-- LIEIA · Telemetría del proceso de respuesta (todas las prácticas y evaluaciones).
--
-- Almacenamiento ANALÍTICO separado de los borradores protegidos (responses): telemetry_events solo guarda el tipo
-- de evento, la pregunta, tiempos y un resumen mínimo (huella de la respuesta, longitud, duración de la ráfaga de
-- edición, visibilidad…). Nunca teclas, contenido ni nada fuera de la plataforma.
--  · Identificador de SESIÓN (cada carga de página) + SECUENCIA: (sesión, secuencia) es único → reenviar no duplica.
--  · t_ms: reloj MONOTÓNICO del cliente (ms desde el inicio de la sesión). client_wall: hora del cliente (orientativa;
--    se anula si difiere más de un día de la del servidor). received_at: hora de RECEPCIÓN del servidor.
--  · Los eventos del navegador pueden perderse, retrasarse o manipularse: son indicios, nunca evidencia infalible.
--  · Ingesta validada (telemetry_ingest): solo el dueño del intento, mientras está en curso (o hasta 15 min después de
--    entregarlo, para lo que quedó pendiente), tipos y campos en lista blanca, tamaños acotados, tope por intento.
--  · Retención: 365 días. Lectura: profesorado que puede revisar el intento (auditada). El estudiante ve un resumen
--    de lo que se registró de su intento (transparencia).
-- Aditiva: tabla y funciones nuevas.
-- =============================================================================

create table if not exists public.telemetry_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null,
  seq integer not null check (seq between 1 and 1000000),
  kind text not null check (kind in ('sesion_inicio', 'pregunta_vista', 'primera_interaccion', 'respuesta_cambio', 'borrador_guardado',
                                     'comprobacion', 'envio', 'visibilidad', 'foco', 'inactividad', 'conexion', 'salida')),
  exercise_id uuid,
  t_ms bigint not null check (t_ms between 0 and 604800000),
  client_wall timestamptz,
  received_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 600),
  unique (session_id, seq)
);
create index if not exists telemetry_events_attempt_idx on public.telemetry_events (attempt_id, session_id, seq);
create index if not exists telemetry_events_received_idx on public.telemetry_events (received_at);
alter table public.telemetry_events enable row level security;
revoke all on public.telemetry_events from anon, authenticated;

-- Solo campos permitidos, con tipos y longitudes acotados (lo demás se descarta)
create or replace function public.telemetry_clean(p jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
    select k, case
      when k in ('h') and jsonb_typeof(p -> k) = 'string' and length(p ->> k) <= 16 then p -> k
      when k in ('navegacion', 'pestana', 'estado', 'fase') and jsonb_typeof(p -> k) = 'string' and length(p ->> k) <= 40 then p -> k
      when k in ('len', 'delta', 'rafaga_ms', 'inicio_ms', 'duracion_ms', 'desde_ms', 'n') and jsonb_typeof(p -> k) = 'number'
           and abs((p ->> k)::numeric) <= 604800000 then to_jsonb(round((p ->> k)::numeric))
      when k in ('vacia', 'borrado', 'primera', 'visible', 'ok', 'en_linea') and jsonb_typeof(p -> k) = 'boolean' then p -> k
      when k = 'h' and jsonb_typeof(p -> k) = 'null' then p -> k
    end v
    from jsonb_object_keys(coalesce(p, '{}'::jsonb)) k
  ) x where v is not null
$$;

create or replace function public.telemetry_ingest(p_eventos jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); e jsonb; v_att public.attempts; v_ok integer := 0; v_dup integer := 0; v_rech integer := 0;
  v_ex uuid; v_wall timestamptz; v_n integer; v_cache uuid; v_valido boolean;
begin
  if v_uid is null or not public.my_account_ok() then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if jsonb_typeof(p_eventos) <> 'array' or jsonb_array_length(p_eventos) > 200 then raise exception 'Lote no válido' using errcode = '22023'; end if;
  for e in select * from jsonb_array_elements(p_eventos) loop
    begin
      if v_cache is distinct from (e ->> 'attempt_id')::uuid then
        select * into v_att from public.attempts where id = (e ->> 'attempt_id')::uuid;
        v_cache := v_att.id;
        v_valido := found and v_att.user_id = v_uid
          and (v_att.status = 'in_progress' or v_att.submitted_at > now() - interval '15 minutes')
          and (select count(*) from public.telemetry_events t where t.attempt_id = v_att.id) < 20000;
      end if;
      if not coalesce(v_valido, false) then v_rech := v_rech + 1; continue; end if;
      v_ex := nullif(e ->> 'exercise_id', '')::uuid;
      -- la pregunta debe pertenecer al intento (actividad o práctica libre)
      if v_ex is not null and not exists (select 1 from public.responses r where r.attempt_id = v_att.id and r.exercise_id = v_ex)
         and not exists (select 1 from public.activity_items i where i.activity_id = v_att.activity_id and i.exercise_id = v_ex)
         and not exists (select 1 from public.lesson_practice_set(v_att.lesson_id) s where v_att.activity_id is null and s.exercise_id = v_ex) then
        v_rech := v_rech + 1; continue;
      end if;
      v_wall := case when (e ->> 'wall') ~ '^[0-9]{10,14}$' then to_timestamp((e ->> 'wall')::bigint / 1000.0) end;
      if v_wall is not null and abs(extract(epoch from v_wall - now())) > 86400 then v_wall := null; end if;
      insert into public.telemetry_events (attempt_id, user_id, session_id, seq, kind, exercise_id, t_ms, client_wall, data)
        values (v_att.id, v_uid, (e ->> 'session_id')::uuid, (e ->> 'seq')::integer, e ->> 'kind', v_ex,
                greatest(0, (e ->> 't_ms')::bigint), v_wall, public.telemetry_clean(e -> 'data'))
        on conflict (session_id, seq) do nothing;
      get diagnostics v_n = row_count;
      if v_n = 1 then v_ok := v_ok + 1; else v_dup := v_dup + 1; end if;
    exception when others then
      v_rech := v_rech + 1; -- un evento mal formado no invalida el lote
    end;
  end loop;
  -- retención (de vez en cuando, para no cargar cada envío)
  if random() < 0.01 then delete from public.telemetry_events where received_at < now() - interval '365 days'; end if;
  return jsonb_build_object('aceptados', v_ok, 'duplicados', v_dup, 'rechazados', v_rech, 'server_now', now());
end;
$$;

-- Profesorado: eventos de un intento (auditado)
create or replace function public.telemetry_attempt(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_att public.attempts;
begin
  if not public.is_teacher() or not public.can_review_attempt(p_attempt) then raise exception 'No tiene acceso a este intento' using errcode = '42501'; end if;
  select * into v_att from public.attempts where id = p_attempt;
  insert into public.analytics_audit (actor_id, action, detail) values (auth.uid(), 'consulta_estudiante', jsonb_build_object('telemetria_intento', p_attempt));
  return jsonb_build_object(
    'intento', jsonb_build_object('id', v_att.id, 'inicio', v_att.started_at, 'entrega', v_att.submitted_at, 'estado', v_att.status, 'modo', v_att.mode),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', r.exercise_id, 'dificultad', e.difficulty, 'formato', e.format,
        'titulo', left(regexp_replace(e.prompt, '\s+', ' ', 'g'), 80),
        'b', (select c.b from public.item_calibrations c where c.exercise_id = e.id)) order by coalesce(o.position, ai.position, 1000)), '[]')
      from public.responses r join public.exercises e on e.id = r.exercise_id
      left join public.attempt_item_orders o on o.attempt_id = p_attempt and o.exercise_id = r.exercise_id
      left join public.activity_items ai on ai.activity_id = v_att.activity_id and ai.exercise_id = r.exercise_id
      where r.attempt_id = p_attempt),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('s', t.session_id, 'q', t.seq, 'k', t.kind, 'e', t.exercise_id, 't', t.t_ms,
        'w', extract(epoch from t.client_wall), 'r', extract(epoch from t.received_at), 'd', t.data) order by t.session_id, t.seq), '[]')
      from public.telemetry_events t where t.attempt_id = p_attempt));
end;
$$;

-- Profesorado: intentos de un estudiante con telemetría (para la vista longitudinal)
create or replace function public.telemetry_student_attempts(p_user uuid)
returns table (attempt_id uuid, titulo text, modo text, inicio timestamptz, entrega timestamptz, eventos bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() or not public.teaches_student(p_user) then raise exception 'No tiene acceso a este estudiante' using errcode = '42501'; end if;
  return query
  select t.id, coalesce(a.title, l.title), t.mode::text, t.started_at, t.submitted_at, (select count(*) from public.telemetry_events x where x.attempt_id = t.id)
  from public.attempts t left join public.activities a on a.id = t.activity_id left join public.lessons l on l.id = t.lesson_id
  where t.user_id = p_user and exists (select 1 from public.telemetry_events x where x.attempt_id = t.id)
    and (public.is_admin() or (t.activity_id is not null and public.is_class_teacher(a.class_id))
         or (t.activity_id is null and public.teaches_course(t.course_id)))
  order by t.started_at desc
  limit 60;
end;
$$;

-- LIEIA: telemetría seudonimizada de una evaluación (mismos seudónimos que lieia_exam_data)
create or replace function public.lieia_telemetry(p_activity uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := public.lieia_assert(p_activity);
begin
  insert into public.lieia_audit (actor_id, action, activity_id) values (auth.uid(), 'consulta_examen', p_activity);
  return (
    with intentos as (
      select distinct on (t.user_id) t.* from public.attempts t join public.profiles p on p.id = t.user_id and p.role = 'student'
      where t.activity_id = p_activity and t.status = 'submitted' order by t.user_id, t.attempt_number, t.started_at
    ), seud as (
      select i.*, 'E' || lpad(row_number() over (order by md5(i.user_id::text || p_activity::text))::text, 2, '0') seudonimo from intentos i
    )
    select coalesce(jsonb_agg(jsonb_build_object('seudonimo', s.seudonimo, 'inicio', extract(epoch from s.started_at), 'entrega', extract(epoch from s.submitted_at),
        'eventos', (select coalesce(jsonb_agg(jsonb_build_object('s', t.session_id, 'q', t.seq, 'k', t.kind, 'e', t.exercise_id, 't', t.t_ms,
            'r', extract(epoch from t.received_at), 'd', t.data) order by t.session_id, t.seq), '[]')
          from public.telemetry_events t where t.attempt_id = s.id)) order by s.seudonimo), '[]')
    from seud s);
end;
$$;

-- Estudiante: qué se registró de su propio intento (transparencia)
create or replace function public.my_telemetry_summary(p_attempt uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('eventos', coalesce(sum(x.n), 0), 'por_tipo', coalesce(jsonb_object_agg(x.k, x.n), '{}'::jsonb),
    'sesiones', (select count(distinct t.session_id) from public.telemetry_events t join public.attempts a on a.id = t.attempt_id
                 where t.attempt_id = p_attempt and a.user_id = auth.uid()))
  from (select t.kind k, count(*) n from public.telemetry_events t
        join public.attempts a on a.id = t.attempt_id where t.attempt_id = p_attempt and a.user_id = auth.uid() group by t.kind) x
$$;

revoke all on function public.telemetry_clean(jsonb) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['telemetry_ingest(jsonb)', 'telemetry_attempt(uuid)', 'telemetry_student_attempts(uuid)', 'lieia_telemetry(uuid)', 'my_telemetry_summary(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
