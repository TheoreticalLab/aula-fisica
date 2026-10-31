-- =============================================================================
-- Telemetría V2 — observatorio del proceso de aprendizaje (docs/TELEMETRIA_V2.md). Migración ADITIVA: tablas y
-- funciones nuevas; NO redefine ninguna función existente ni toca telemetry_events (V1), exam_* ni LIEIA.
--
-- 1. telemetry_v2_events: eventos del navegador con sobre versionado (schema_version = 2), idempotentes por event_id y
--    por (sesión, secuencia). Son DECLARADOS POR EL CLIENTE: indicios, no hechos del servidor. Lista blanca de tipos y
--    de campos, tamaños acotados, sin contenido de las respuestas (solo huella y longitud). Retención: 365 días.
-- 2. telemetry_v2_flags: bandera por asignatura (apagada por defecto). Sin bandera, el navegador no envía nada V2.
-- 3. response_revisions: historial de los GUARDADOS del contenido de cada respuesta (lo escribe un disparador del
--    servidor; el estudiante no puede alterarlo). Primera respuesta no vacía = revisión 1 (nunca se consolida);
--    guardados seguidos en menos de 20 s se consolidan en la última revisión (con contador). Tope 1000 por respuesta.
--    Las comprobaciones, entregas y calificaciones ya constan en response_events.
-- 4. attempt_snapshots: al entregar, qué revisión de cada respuesta se entregó (instantánea inmutable).
-- 5. telemetria_v2_intento: todo lo necesario para reconstruir un intento (profesorado que puede revisarlo; auditado).
-- 6. telemetry_v2_ingest_log: recuentos agregados por hora para el monitor (sin datos personales).
--
-- Los disparadores nuevos capturan sus propios errores: la instrumentación nunca impide guardar ni entregar.
-- Reversión: apagar las banderas (update public.telemetry_v2_flags set activo = false). No se borran datos.
-- =============================================================================

-- 1 · eventos V2 ---------------------------------------------------------------------------------------------------
create table if not exists public.telemetry_v2_events (
  id bigint generated always as identity primary key,
  event_id uuid not null unique,
  schema_version smallint not null default 2 check (schema_version = 2),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null,
  tab_id uuid,
  client_seq integer not null check (client_seq between 1 and 1000000),
  event_type text not null check (event_type in (
    'session_started', 'session_resumed', 'session_ended', 'clock_sync', 'heartbeat',
    'page_visible', 'page_hidden', 'focus_gained', 'focus_lost', 'idle_started', 'idle_ended', 'connection_lost', 'connection_restored',
    'question_exposure_started', 'question_exposure_ended', 'question_activated', 'question_deactivated',
    'answer_draft_changed', 'answer_draft_restored', 'answer_save_requested', 'answer_save_confirmed', 'answer_save_failed',
    'answer_checked', 'attempt_submit_requested', 'simulation_event')),
  question_id uuid,
  active_question_id uuid,
  t_mono bigint not null check (t_mono between 0 and 604800000),
  client_wall timestamptz,
  received_at timestamptz not null default clock_timestamp(),
  visibility text check (visibility in ('visible', 'hidden')),
  connectivity text check (connectivity in ('online', 'offline')),
  response_rev integer,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 600),
  quality_flags text[] not null default '{}',
  unique (session_id, client_seq)
);
create index if not exists telemetry_v2_events_attempt_idx on public.telemetry_v2_events (attempt_id, session_id, client_seq);
create index if not exists telemetry_v2_events_received_idx on public.telemetry_v2_events (received_at);
alter table public.telemetry_v2_events enable row level security;

create table if not exists public.telemetry_v2_flags (
  course_id uuid primary key references public.courses (id) on delete cascade,
  activo boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.telemetry_v2_flags enable row level security;

create table if not exists public.telemetry_v2_ingest_log (
  hora timestamptz primary key,
  lotes integer not null default 0,
  aceptados integer not null default 0,
  duplicados integer not null default 0,
  rechazados integer not null default 0
);
alter table public.telemetry_v2_ingest_log enable row level security;

-- campos permitidos del payload, con tipos y longitudes acotados (lo demás se descarta)
create or replace function public.telemetry_v2_clean(p jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
    select k, case
      when k = 'h' and jsonb_typeof(p -> k) = 'string' and length(p ->> k) <= 16 then p -> k
      when k in ('navegacion', 'tipo_cambio', 'fase', 'codigo', 'motivo', 'sim', 'accion', 'param') and jsonb_typeof(p -> k) = 'string' and length(p ->> k) <= 40 then p -> k
      when k in ('inicio_tau', 'fin_tau', 'desde_tau', 'envio_tau', 'recibo_tau', 'servidor_ms', 'n', 'len', 'delta', 'rev', 'pendientes', 'intentos', 'duracion_ms')
           and jsonb_typeof(p -> k) = 'number' and abs((p ->> k)::numeric) <= 4102444800000 then to_jsonb(round((p ->> k)::numeric))
      when k = 'valor' and jsonb_typeof(p -> k) = 'number' and abs((p ->> k)::numeric) <= 1e9 then p -> k
      when k in ('vacia', 'primera', 'borrado', 'visible', 'persistida', 'ok') and jsonb_typeof(p -> k) = 'boolean' then p -> k
    end v
    from jsonb_object_keys(coalesce(p, '{}'::jsonb)) k
  ) x where v is not null
$$;

-- reloj del servidor y bandera para un intento (muestra de sincronización: el cliente mide ida y vuelta)
create or replace function public.telemetry_v2_sync(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_course uuid;
begin
  select a.course_id into v_course from public.attempts a where a.id = p_attempt and a.user_id = auth.uid();
  return jsonb_build_object(
    'servidor_ms', floor(extract(epoch from clock_timestamp()) * 1000),
    'activo', coalesce((select f.activo from public.telemetry_v2_flags f where f.course_id = v_course), false));
end;
$$;

create or replace function public.telemetry_v2_ingest(p_eventos jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); e jsonb; v_att public.attempts; v_ok integer := 0; v_dup integer := 0; v_rech integer := 0;
  v_ex uuid; v_act uuid; v_wall timestamptz; v_n integer; v_cache uuid; v_valido boolean; v_flags text[];
begin
  if v_uid is null or not public.my_account_ok() then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if jsonb_typeof(p_eventos) <> 'array' or jsonb_array_length(p_eventos) > 200 then raise exception 'Lote no válido' using errcode = '22023'; end if;
  for e in select * from jsonb_array_elements(p_eventos) loop
    begin
      if v_cache is distinct from (e ->> 'attempt_id')::uuid then
        select * into v_att from public.attempts where id = (e ->> 'attempt_id')::uuid;
        v_cache := v_att.id;
        -- la identidad sale de la sesión autenticada, nunca del cliente; solo el dueño, con la bandera encendida
        v_valido := found and v_att.user_id = v_uid
          and (v_att.status = 'in_progress' or v_att.submitted_at > now() - interval '15 minutes')
          and exists (select 1 from public.telemetry_v2_flags f where f.course_id = v_att.course_id and f.activo)
          and (select count(*) from public.telemetry_v2_events t where t.attempt_id = v_att.id) < 50000;
      end if;
      if not coalesce(v_valido, false) then v_rech := v_rech + 1; continue; end if;
      v_ex := nullif(e ->> 'question_id', '')::uuid;
      v_act := nullif(e ->> 'active_question_id', '')::uuid;
      -- las preguntas deben pertenecer al intento (actividad o práctica libre)
      if exists (select 1 from unnest(array[v_ex, v_act]) q(id) where q.id is not null
                 and not exists (select 1 from public.responses r where r.attempt_id = v_att.id and r.exercise_id = q.id)
                 and not exists (select 1 from public.activity_items i where i.activity_id = v_att.activity_id and i.exercise_id = q.id)
                 and not exists (select 1 from public.lesson_practice_set(v_att.lesson_id) s where v_att.activity_id is null and s.exercise_id = q.id)) then
        v_rech := v_rech + 1; continue;
      end if;
      v_flags := '{}';
      v_wall := case when (e ->> 'wall') ~ '^[0-9]{10,14}$' then to_timestamp((e ->> 'wall')::bigint / 1000.0) end;
      -- array_append (no «||» con un literal: PostgreSQL lo leería como un arreglo y fallaría)
      if v_wall is not null and abs(extract(epoch from v_wall - now())) > 86400 then v_wall := null; v_flags := array_append(v_flags, 'hora_cliente_descartada'::text); end if;
      if v_att.status <> 'in_progress' then v_flags := array_append(v_flags, 'recibido_tras_entrega'::text); end if;
      insert into public.telemetry_v2_events (event_id, attempt_id, user_id, session_id, tab_id, client_seq, event_type, question_id, active_question_id,
          t_mono, client_wall, visibility, connectivity, response_rev, payload, quality_flags)
        values ((e ->> 'event_id')::uuid, v_att.id, v_uid, (e ->> 'session_id')::uuid, nullif(e ->> 'tab_id', '')::uuid, (e ->> 'client_seq')::integer,
                e ->> 'event_type', v_ex, v_act, greatest(0, (e ->> 't_mono')::bigint), v_wall,
                case when e ->> 'visibility' in ('visible', 'hidden') then e ->> 'visibility' end,
                case when e ->> 'connectivity' in ('online', 'offline') then e ->> 'connectivity' end,
                case when (e ->> 'response_rev') ~ '^[0-9]{1,9}$' then (e ->> 'response_rev')::integer end,
                public.telemetry_v2_clean(e -> 'payload'), v_flags)
        on conflict do nothing;
      get diagnostics v_n = row_count;
      if v_n = 1 then v_ok := v_ok + 1; else v_dup := v_dup + 1; end if;
    exception when others then
      v_rech := v_rech + 1; -- un evento mal formado no invalida el lote
    end;
  end loop;
  insert into public.telemetry_v2_ingest_log (hora, lotes, aceptados, duplicados, rechazados)
    values (date_trunc('hour', now()), 1, v_ok, v_dup, v_rech)
    on conflict (hora) do update set lotes = telemetry_v2_ingest_log.lotes + 1, aceptados = telemetry_v2_ingest_log.aceptados + v_ok,
      duplicados = telemetry_v2_ingest_log.duplicados + v_dup, rechazados = telemetry_v2_ingest_log.rechazados + v_rech;
  if random() < 0.01 then delete from public.telemetry_v2_events where received_at < now() - interval '365 days'; end if;
  return jsonb_build_object('aceptados', v_ok, 'duplicados', v_dup, 'rechazados', v_rech, 'servidor_ms', floor(extract(epoch from clock_timestamp()) * 1000));
end;
$$;

-- encender o apagar la bandera de una asignatura (equipo de la asignatura o administración)
create or replace function public.telemetry_v2_set(p_course uuid, p_activo boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_course_staff(p_course) then raise exception 'Solo el equipo de la asignatura' using errcode = '42501'; end if;
  insert into public.telemetry_v2_flags (course_id, activo, updated_by, updated_at) values (p_course, p_activo, auth.uid(), now())
    on conflict (course_id) do update set activo = excluded.activo, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.telemetry_v2_flag(p_course uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_view_keys(p_course) then raise exception 'Solo el profesorado de la asignatura' using errcode = '42501'; end if;
  return coalesce((select f.activo from public.telemetry_v2_flags f where f.course_id = p_course), false);
end;
$$;

-- 3 · historial de guardados de las respuestas ------------------------------------------------------------------------
create table if not exists public.response_revisions (
  id bigint generated always as identity primary key,
  response_id uuid not null references public.responses (id) on delete cascade,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  exercise_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rev integer not null check (rev between 1 and 1000),
  answer jsonb not null,
  answer_hash text not null,
  vacia boolean not null,
  client_rev bigint,
  primero_at timestamptz not null default clock_timestamp(),
  ultimo_at timestamptz not null default clock_timestamp(),
  consolidados integer not null default 0,
  unique (response_id, rev)
);
create index if not exists response_revisions_attempt_idx on public.response_revisions (attempt_id, exercise_id, rev);
alter table public.response_revisions enable row level security;

create or replace function public.respuesta_vacia(a jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(btrim(a ->> 'text'), '') = '' and coalesce(jsonb_array_length(case when jsonb_typeof(a -> 'selected') = 'array' then a -> 'selected' end), 0) = 0
     and jsonb_typeof(a -> 'value') is distinct from 'boolean' and coalesce(btrim(a ->> 'justification'), '') = ''
$$;

create or replace function public.registrar_revision()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_prev public.response_revisions; v_vacia boolean;
begin
  begin
    v_vacia := public.respuesta_vacia(new.answer);
    select * into v_prev from public.response_revisions where response_id = new.id order by rev desc limit 1;
    if v_prev.id is null and v_vacia then return null; end if;            -- nada escrito todavía: no hay revisión
    if v_prev.id is not null and v_prev.answer = new.answer then return null; end if;
    if v_prev.id is not null and v_prev.rev > 1 and clock_timestamp() - v_prev.ultimo_at < interval '20 seconds' then
      -- guardados seguidos (escritura en curso): se consolidan en la última revisión; la 1 (primera respuesta) nunca
      update public.response_revisions set answer = new.answer, answer_hash = md5(new.answer::text), vacia = v_vacia,
        client_rev = new.client_rev, ultimo_at = clock_timestamp(), consolidados = consolidados + 1 where id = v_prev.id;
    elsif coalesce(v_prev.rev, 0) < 1000 then
      insert into public.response_revisions (response_id, attempt_id, exercise_id, user_id, rev, answer, answer_hash, vacia, client_rev)
        values (new.id, new.attempt_id, new.exercise_id, new.user_id, coalesce(v_prev.rev, 0) + 1, new.answer, md5(new.answer::text), v_vacia, new.client_rev);
    end if;
  exception when others then
    raise warning 'registrar_revision: %', sqlerrm;   -- nunca impedir que se guarde la respuesta
  end;
  return null;
end;
$$;

drop trigger if exists responses_revision_ins on public.responses;
create trigger responses_revision_ins after insert on public.responses
  for each row execute function public.registrar_revision();
drop trigger if exists responses_revision_upd on public.responses;
create trigger responses_revision_upd after update of answer on public.responses
  for each row when (old.answer is distinct from new.answer) execute function public.registrar_revision();

-- 4 · instantánea de la entrega -----------------------------------------------------------------------------------
create table if not exists public.attempt_snapshots (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz,
  revisiones jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.attempt_snapshots enable row level security;

create or replace function public.instantanea_entrega()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    insert into public.attempt_snapshots (attempt_id, user_id, submitted_at, revisiones)
    select new.id, new.user_id, new.submitted_at, coalesce(jsonb_agg(jsonb_build_object(
        'exercise_id', r.exercise_id, 'response_id', r.id, 'status', r.status, 'answer_hash', md5(r.answer::text), 'vacia', public.respuesta_vacia(r.answer),
        'rev', (select max(v.rev) from public.response_revisions v where v.response_id = r.id)) order by r.exercise_id), '[]'::jsonb)
    from public.responses r where r.attempt_id = new.id
    on conflict (attempt_id) do nothing;
  exception when others then
    raise warning 'instantanea_entrega: %', sqlerrm;  -- nunca impedir la entrega
  end;
  return null;
end;
$$;
drop trigger if exists attempts_instantanea on public.attempts;
create trigger attempts_instantanea after update of status on public.attempts
  for each row when (old.status = 'in_progress' and new.status = 'submitted') execute function public.instantanea_entrega();

-- 5 · lectura para la reconstrucción (profesorado que puede revisar el intento; auditada) ---------------------------
create or replace function public.telemetria_v2_intento(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_att public.attempts; v_mode text;
begin
  if not public.is_teacher() or not public.can_review_attempt(p_attempt) then raise exception 'No tiene acceso a este intento' using errcode = '42501'; end if;
  select * into v_att from public.attempts where id = p_attempt;
  select s.presentacion into v_mode from public.exam_settings s where s.activity_id = v_att.activity_id;
  insert into public.analytics_audit (actor_id, action, detail) values (auth.uid(), 'consulta_estudiante', jsonb_build_object('telemetria_v2_intento', p_attempt));
  return jsonb_build_object(
    'intento', jsonb_build_object('id', v_att.id, 'inicio', v_att.started_at, 'entrega', v_att.submitted_at, 'estado', v_att.status, 'modo', v_att.mode,
      'actividad', v_att.activity_id, 'leccion', v_att.lesson_id, 'presentacion', v_mode),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', x.id, 'slug', x.slug, 'dificultad', x.difficulty, 'formato', x.format,
        'titulo', left(regexp_replace(x.prompt, '\s+', ' ', 'g'), 80)) order by x.pos), '[]')
      from (select e.id, e.slug, e.difficulty, e.format, e.prompt, coalesce(o.position, ai.position, e.position, 1000) as pos
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
    'instantanea', (select to_jsonb(s) - 'user_id' from public.attempt_snapshots s where s.attempt_id = p_attempt));
end;
$$;

-- 6 · monitor (administración): recuentos agregados, sin datos personales ----------------------------------------
create or replace function public.telemetry_v2_monitor(p_horas integer default 48)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Solo administración' using errcode = '42501'; end if;
  return jsonb_build_object(
    'ingesta', (select coalesce(jsonb_agg(to_jsonb(l) order by l.hora), '[]') from public.telemetry_v2_ingest_log l
                where l.hora > now() - make_interval(hours => least(greatest(p_horas, 1), 24 * 31))),
    'por_tipo', (select coalesce(jsonb_object_agg(x.event_type, x.n), '{}') from (select event_type, count(*) as n from public.telemetry_v2_events
                where received_at > now() - make_interval(hours => least(greatest(p_horas, 1), 24 * 31)) group by event_type) x),
    'calidad', (select coalesce(jsonb_object_agg(x.f, x.n), '{}') from (select f, count(*) as n from public.telemetry_v2_events, unnest(quality_flags) f
                where received_at > now() - make_interval(hours => least(greatest(p_horas, 1), 24 * 31)) group by f) x),
    'pendientes_max', (select max((payload ->> 'pendientes')::int) from public.telemetry_v2_events
                where event_type = 'heartbeat' and received_at > now() - make_interval(hours => least(greatest(p_horas, 1), 24 * 31))),
    'banderas', (select coalesce(jsonb_agg(jsonb_build_object('course_id', f.course_id, 'activo', f.activo, 'updated_at', f.updated_at)), '[]') from public.telemetry_v2_flags f),
    'revisiones_24h', (select count(*) from public.response_revisions where ultimo_at > now() - interval '24 hours'),
    'instantaneas_24h', (select count(*) from public.attempt_snapshots where created_at > now() - interval '24 hours'));
end;
$$;

-- permisos -------------------------------------------------------------------------------------------------------
do $$ begin
  execute 'revoke all on table public.telemetry_v2_events, public.telemetry_v2_flags, public.telemetry_v2_ingest_log, public.response_revisions, public.attempt_snapshots from anon, authenticated, public';
  execute 'revoke all on function public.registrar_revision(), public.instantanea_entrega() from public, anon, authenticated';
  execute 'revoke all on function public.telemetry_v2_sync(uuid), public.telemetry_v2_ingest(jsonb), public.telemetry_v2_set(uuid, boolean), public.telemetry_v2_flag(uuid), public.telemetria_v2_intento(uuid), public.telemetry_v2_monitor(integer) from public, anon';
  execute 'grant execute on function public.telemetry_v2_sync(uuid), public.telemetry_v2_ingest(jsonb), public.telemetry_v2_set(uuid, boolean), public.telemetry_v2_flag(uuid), public.telemetria_v2_intento(uuid), public.telemetry_v2_monitor(integer) to authenticated';
  execute 'revoke all on function public.telemetry_v2_clean(jsonb), public.respuesta_vacia(jsonb) from public, anon';
end $$;
