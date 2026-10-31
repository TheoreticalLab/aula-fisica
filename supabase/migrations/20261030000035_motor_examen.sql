-- =============================================================================
-- Motor de examen (rediseño · etapa 2): una pregunta activa a la vez, navegación configurable, pausas declaradas,
-- reloj oficial del servidor, diario de tramos de tiempo (trabajo / pausa / oculta / inactividad / desconexión) y
-- guardado automático con revisiones.
--
-- Aditiva: tablas nuevas, una columna nueva con valor por defecto (responses.client_rev), funciones nuevas y dos
-- funciones existentes redefinidas conservando su comportamiento (assert_attempt_writable y save_response_for:
-- solo añaden el límite de tiempo y la regla de navegación cuando el intento tiene sesión de examen).
-- Las actividades SIN configuración de examen funcionan exactamente igual que antes (presentación «todas»).
-- No toca calificaciones ni intentos existentes.
-- =============================================================================

-- 1) Configuración por actividad (la fija el profesor)
create table if not exists public.exam_settings (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  presentacion text not null default 'una_a_la_vez' check (presentacion in ('una_a_la_vez', 'todas')),
  navegacion text not null default 'libre' check (navegacion in ('libre', 'solo_adelante')),
  duracion_s integer check (duracion_s is null or duracion_s between 60 and 21600),
  pausas_permitidas boolean not null default false,
  pausas_max integer not null default 0 check (pausas_max between 0 and 10),
  pausa_max_total_s integer not null default 0 check (pausa_max_total_s between 0 and 3600),
  pausa_detiene_reloj boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (pausas_permitidas or (pausas_max = 0 and pausa_max_total_s = 0 and not pausa_detiene_reloj))
);

-- 2) Sesión oficial de cada intento (copia de la configuración al empezar: cambiarla después no altera intentos en curso)
create table if not exists public.exam_sessions (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  presentacion text not null,
  navegacion text not null,
  duracion_s integer,
  pausas_permitidas boolean not null,
  pausas_max integer not null,
  pausa_max_total_s integer not null,
  pausa_detiene_reloj boolean not null,
  activa uuid,
  pausa_desde timestamptz,
  pausas_n integer not null default 0,
  pausas_ms bigint not null default 0,
  ultimo_contacto timestamptz not null default now(),
  diario_seq integer not null default 0,
  diario_fin timestamptz,
  fuera_de_turno integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3) Eventos oficiales (hora del servidor)
create table if not exists public.exam_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('apertura', 'ir_a', 'pausa', 'reanudacion', 'entrega', 'rechazo')),
  exercise_id uuid,
  t timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 600)
);
create index if not exists exam_events_attempt_idx on public.exam_events (attempt_id, t);

-- 4) Diario de tramos enviado por el navegador (validado al recibirlo; se concilia con los eventos oficiales)
create table if not exists public.exam_intervals (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seq integer not null check (seq between 1 and 100000),
  tipo text not null check (tipo in ('trabajo', 'inactividad', 'pausa_declarada', 'oculta', 'desconexion', 'desconocido', 'fuera_de_pregunta')),
  exercise_id uuid,
  inicio timestamptz not null,
  fin timestamptz not null,
  sin_red boolean not null default false,
  received_at timestamptz not null default now(),
  check (fin > inicio),
  unique (attempt_id, seq)
);
create index if not exists exam_intervals_attempt_idx on public.exam_intervals (attempt_id, inicio);

-- 5) Revisión del guardado automático (las revisiones viejas o repetidas no pisan una más nueva)
alter table public.responses add column if not exists client_rev bigint not null default 0;

alter table public.exam_settings enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_events enable row level security;
alter table public.exam_intervals enable row level security;
revoke all on public.exam_settings, public.exam_sessions, public.exam_events, public.exam_intervals from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Ayudantes

create or replace function public.exam_ms(p timestamptz)
returns bigint language sql immutable set search_path = '' as $$ select (extract(epoch from p) * 1000)::bigint $$;

-- Orden de las preguntas del intento (el asignado por el diseño, o el de la actividad)
create or replace function public.exam_item_order(p_attempt uuid)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select array_agg(o.exercise_id order by o.position) from public.attempt_item_orders o where o.attempt_id = p_attempt),
    (select array_agg(i.exercise_id order by i.position) from public.attempts a join public.activity_items i on i.activity_id = a.activity_id where a.id = p_attempt),
    '{}'::uuid[])
$$;

-- Hora límite oficial: inicio + duración (+ pausa usada, hasta su máximo, si las pausas detienen el reloj), sin pasar del cierre
create or replace function public.exam_deadline(p_attempt uuid)
returns timestamptz
language plpgsql stable security definer set search_path = ''
as $$
declare s public.exam_sessions; a public.attempts; v_cierre timestamptz; v_lim timestamptz; v_pausa bigint := 0;
begin
  select * into s from public.exam_sessions where attempt_id = p_attempt;
  select * into a from public.attempts where id = p_attempt;
  if a.id is null then return null; end if;
  select closes_at into v_cierre from public.activities where id = a.activity_id;
  if s.attempt_id is null or s.duracion_s is null then return v_cierre; end if;
  if s.pausa_detiene_reloj then
    v_pausa := least(s.pausa_max_total_s::bigint * 1000,
      s.pausas_ms + case when s.pausa_desde is null then 0 else public.exam_ms(now()) - public.exam_ms(s.pausa_desde) end);
  end if;
  v_lim := a.started_at + make_interval(secs => s.duracion_s) + make_interval(secs => v_pausa / 1000.0);
  return case when v_cierre is null then v_lim else least(v_lim, v_cierre) end;
end;
$$;

-- Configuración efectiva de una actividad (sin fila: presentación «todas», como antes)
create or replace function public.exam_settings_of(p_activity uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('presentacion', s.presentacion, 'navegacion', s.navegacion, 'duracion_s', s.duracion_s,
       'pausas', jsonb_build_object('permitidas', s.pausas_permitidas, 'max_numero', s.pausas_max, 'max_total_s', s.pausa_max_total_s, 'detienen_reloj', s.pausa_detiene_reloj),
       'configurado', true)
     from public.exam_settings s where s.activity_id = p_activity),
    jsonb_build_object('presentacion', 'todas', 'navegacion', 'libre', 'duracion_s', null,
      'pausas', jsonb_build_object('permitidas', false, 'max_numero', 0, 'max_total_s', 0, 'detienen_reloj', false), 'configurado', false))
$$;

-- -----------------------------------------------------------------------------
-- Profesor: leer y guardar la configuración

create or replace function public.exam_settings_get(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return public.exam_settings_of(p_activity) || jsonb_build_object('en_curso',
    (select count(*) from public.exam_sessions s join public.attempts a on a.id = s.attempt_id where a.activity_id = p_activity and a.status = 'in_progress'));
end;
$$;

create or replace function public.exam_settings_save(p_activity uuid, p_cfg jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid; v_mode public.activity_mode; v_pp boolean;
begin
  select class_id, mode into v_class, v_mode from public.activities where id = p_activity;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if v_mode <> 'exam' then raise exception 'La configuración de examen solo se aplica a evaluaciones' using errcode = '22023'; end if;
  if p_cfg is null or jsonb_typeof(p_cfg) <> 'object' then raise exception 'Configuración inválida' using errcode = '22023'; end if;
  v_pp := coalesce((p_cfg -> 'pausas' ->> 'permitidas')::boolean, false);
  begin
    insert into public.exam_settings as s (activity_id, presentacion, navegacion, duracion_s, pausas_permitidas, pausas_max, pausa_max_total_s, pausa_detiene_reloj, updated_by, updated_at)
    values (p_activity,
      coalesce(p_cfg ->> 'presentacion', 'una_a_la_vez'), coalesce(p_cfg ->> 'navegacion', 'libre'), (p_cfg ->> 'duracion_s')::integer,
      v_pp, case when v_pp then coalesce((p_cfg -> 'pausas' ->> 'max_numero')::integer, 1) else 0 end,
      case when v_pp then coalesce((p_cfg -> 'pausas' ->> 'max_total_s')::integer, 300) else 0 end,
      v_pp and coalesce((p_cfg -> 'pausas' ->> 'detienen_reloj')::boolean, false), auth.uid(), now())
    on conflict (activity_id) do update set presentacion = excluded.presentacion, navegacion = excluded.navegacion, duracion_s = excluded.duracion_s,
      pausas_permitidas = excluded.pausas_permitidas, pausas_max = excluded.pausas_max, pausa_max_total_s = excluded.pausa_max_total_s,
      pausa_detiene_reloj = excluded.pausa_detiene_reloj, updated_by = excluded.updated_by, updated_at = now();
  exception when check_violation or invalid_text_representation then
    raise exception 'Configuración fuera de los límites permitidos' using errcode = '22023';
  end;
  return public.exam_settings_get(p_activity);
end;
$$;

-- Reglas visibles para el estudiante ANTES de empezar (inscrito en la sección y actividad publicada)
create or replace function public.exam_rules(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into act from public.activities where id = p_activity;
  if act.id is null or not (public.is_class_teacher(act.class_id)
      or (act.published and exists (select 1 from public.enrollments e where e.class_id = act.class_id and e.user_id = auth.uid()))) then
    raise exception 'Actividad no disponible' using errcode = '42501';
  end if;
  return public.exam_settings_of(p_activity) - 'configurado';
end;
$$;

-- -----------------------------------------------------------------------------
-- Estudiante: sesión de examen

create or replace function public.exam_state(p_attempt uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'modo', 'una_a_la_vez',
    'ahora_ms', public.exam_ms(now()),
    'inicio_ms', public.exam_ms(a.started_at),
    'limite_ms', public.exam_ms(public.exam_deadline(a.id)),
    'cierre_ms', public.exam_ms(act.closes_at),
    'activa', s.activa,
    'orden', to_jsonb(public.exam_item_order(a.id)),
    'config', jsonb_build_object('presentacion', s.presentacion, 'navegacion', s.navegacion, 'duracion_s', s.duracion_s,
      'pausas', jsonb_build_object('permitidas', s.pausas_permitidas, 'max_numero', s.pausas_max, 'max_total_s', s.pausa_max_total_s, 'detienen_reloj', s.pausa_detiene_reloj)),
    'pausa', jsonb_build_object('n', s.pausas_n, 'ms', s.pausas_ms, 'desde_ms', public.exam_ms(s.pausa_desde)),
    'visitadas', (select coalesce(jsonb_agg(distinct e.exercise_id), '[]'::jsonb) from public.exam_events e where e.attempt_id = a.id and e.tipo in ('apertura', 'ir_a') and e.exercise_id is not null),
    'diario_seq', s.diario_seq,
    'diario_fin_ms', public.exam_ms(s.diario_fin),
    'estado', case when a.status <> 'in_progress' then 'entregado'
                   when public.exam_deadline(a.id) is not null and now() >= public.exam_deadline(a.id) then 'vencido'
                   when s.pausa_desde is not null then 'en_pausa' else 'en_curso' end)
  from public.attempts a
  join public.exam_sessions s on s.attempt_id = a.id
  left join public.activities act on act.id = a.activity_id
  where a.id = p_attempt
$$;

-- Comprobación común: el intento es del usuario y está en curso; devuelve la sesión bloqueada para actualizar
create or replace function public.exam_session_for(p_attempt uuid)
returns public.exam_sessions
language plpgsql security definer set search_path = ''
as $$
declare s public.exam_sessions; a public.attempts;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into a from public.attempts where id = p_attempt;
  if not found or a.user_id <> auth.uid() then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  select * into s from public.exam_sessions where attempt_id = p_attempt for update;
  if not found then raise exception 'Este intento no tiene sesión de examen' using errcode = 'P0001'; end if;
  if a.status <> 'in_progress' then raise exception 'El intento ya fue entregado' using errcode = 'P0001'; end if;
  return s;
end;
$$;

-- Abrir (o reabrir tras recargar o perder la conexión). Crea la sesión la primera vez, con la configuración vigente.
create or replace function public.exam_open(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a public.attempts; act public.activities; cfg public.exam_settings; s public.exam_sessions; v_orden uuid[];
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.account_ok(auth.uid()) then raise exception 'Cuenta no habilitada' using errcode = '42501'; end if;
  select * into a from public.attempts where id = p_attempt;
  if not found or a.user_id <> auth.uid() then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  select * into act from public.activities where id = a.activity_id;
  select * into s from public.exam_sessions where attempt_id = p_attempt for update;
  if not found then
    -- prácticas y evaluaciones sin el modo de una pregunta a la vez: interfaz clásica, sin sesión (como antes)
    select * into cfg from public.exam_settings where activity_id = act.id;
    if act.id is null or act.mode <> 'exam' or cfg.activity_id is null or cfg.presentacion <> 'una_a_la_vez' then
      return jsonb_build_object('modo', 'clasico');
    end if;
    if a.status <> 'in_progress' then return jsonb_build_object('modo', 'clasico'); end if;
    v_orden := public.exam_item_order(p_attempt);
    insert into public.exam_sessions (attempt_id, user_id, presentacion, navegacion, duracion_s, pausas_permitidas, pausas_max, pausa_max_total_s, pausa_detiene_reloj, activa)
      values (p_attempt, a.user_id, cfg.presentacion, cfg.navegacion, cfg.duracion_s, cfg.pausas_permitidas, cfg.pausas_max, cfg.pausa_max_total_s, cfg.pausa_detiene_reloj, v_orden[1])
      returning * into s;
  end if;
  if a.status = 'in_progress' then
    update public.exam_sessions set ultimo_contacto = now() where attempt_id = p_attempt;
    insert into public.exam_events (attempt_id, user_id, tipo, exercise_id) values (p_attempt, a.user_id, 'apertura', s.activa);
  end if;
  return public.exam_state(p_attempt);
end;
$$;

-- Latido y sincronización del reloj
create or replace function public.exam_ping(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.exam_sessions;
begin
  s := public.exam_session_for(p_attempt);
  update public.exam_sessions set ultimo_contacto = now() where attempt_id = p_attempt;
  return jsonb_build_object('ahora_ms', public.exam_ms(now()), 'limite_ms', public.exam_ms(public.exam_deadline(p_attempt)));
end;
$$;

-- Cambiar de pregunta (respeta la navegación configurada; no durante una pausa)
create or replace function public.exam_goto(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.exam_sessions; v_orden uuid[]; i integer; j integer;
begin
  s := public.exam_session_for(p_attempt);
  if s.pausa_desde is not null then raise exception 'Reanude el examen para continuar' using errcode = 'P0001'; end if;
  v_orden := public.exam_item_order(p_attempt);
  j := array_position(v_orden, p_exercise);
  if j is null then raise exception 'La pregunta no pertenece a este intento' using errcode = '42501'; end if;
  if s.navegacion = 'solo_adelante' and s.activa is not null then
    i := array_position(v_orden, s.activa);
    if j < i or (j <> i and exists (select 1 from public.exam_events e where e.attempt_id = p_attempt and e.tipo in ('apertura', 'ir_a') and e.exercise_id = p_exercise)) then
      raise exception 'En este examen no se puede volver a preguntas anteriores' using errcode = 'P0001';
    end if;
  end if;
  update public.exam_sessions set activa = p_exercise, ultimo_contacto = now() where attempt_id = p_attempt;
  insert into public.exam_events (attempt_id, user_id, tipo, exercise_id) values (p_attempt, s.user_id, 'ir_a', p_exercise);
  return jsonb_build_object('ahora_ms', public.exam_ms(now()), 'activa', p_exercise);
end;
$$;

create or replace function public.exam_pause(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.exam_sessions;
begin
  s := public.exam_session_for(p_attempt);
  if not s.pausas_permitidas then raise exception 'Este examen no admite pausas' using errcode = 'P0001'; end if;
  if s.pausa_desde is not null then raise exception 'El examen ya está en pausa' using errcode = 'P0001'; end if;
  if s.pausas_n >= s.pausas_max then raise exception 'Ya usó las pausas permitidas' using errcode = 'P0001'; end if;
  if s.pausas_ms >= s.pausa_max_total_s::bigint * 1000 then raise exception 'Ya usó todo el tiempo de pausa permitido' using errcode = 'P0001'; end if;
  if public.exam_deadline(p_attempt) is not null and now() >= public.exam_deadline(p_attempt) then raise exception 'El tiempo del examen terminó' using errcode = 'P0001'; end if;
  update public.exam_sessions set pausa_desde = now(), pausas_n = pausas_n + 1, ultimo_contacto = now() where attempt_id = p_attempt;
  insert into public.exam_events (attempt_id, user_id, tipo, exercise_id) values (p_attempt, s.user_id, 'pausa', s.activa);
  return public.exam_state(p_attempt);
end;
$$;

create or replace function public.exam_resume(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.exam_sessions;
begin
  s := public.exam_session_for(p_attempt);
  if s.pausa_desde is null then raise exception 'El examen no está en pausa' using errcode = 'P0001'; end if;
  update public.exam_sessions set pausas_ms = pausas_ms + (public.exam_ms(now()) - public.exam_ms(pausa_desde)), pausa_desde = null, ultimo_contacto = now()
    where attempt_id = p_attempt;
  insert into public.exam_events (attempt_id, user_id, tipo, exercise_id) values (p_attempt, s.user_id, 'reanudacion', s.activa);
  return public.exam_state(p_attempt);
end;
$$;

-- Diario de tramos: idempotente por número de secuencia; cada tramo se valida (los inválidos se registran como rechazo)
create or replace function public.exam_journal(p_attempt uuid, p_tramos jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  a public.attempts; s public.exam_sessions; t jsonb; v_seq integer; v_ini timestamptz; v_fin timestamptz; v_tipo text; v_ex uuid;
  v_orden uuid[]; v_ok integer := 0; v_mal integer := 0; v_motivo text; v_tope timestamptz;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into a from public.attempts where id = p_attempt;
  if not found or a.user_id <> auth.uid() then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  select * into s from public.exam_sessions where attempt_id = p_attempt for update;
  if not found then raise exception 'Este intento no tiene sesión de examen' using errcode = 'P0001'; end if;
  -- tras la entrega se aceptan durante 10 minutos los últimos tramos (hasta la hora de entrega)
  if a.status <> 'in_progress' and now() > a.submitted_at + interval '10 minutes' then raise exception 'El intento ya fue entregado' using errcode = 'P0001'; end if;
  if p_tramos is null or jsonb_typeof(p_tramos) <> 'array' or jsonb_array_length(p_tramos) > 200 then raise exception 'Diario inválido' using errcode = '22023'; end if;
  v_orden := public.exam_item_order(p_attempt);
  v_tope := case when a.status = 'in_progress' then now() else a.submitted_at end + interval '5 seconds';
  for t in select x from jsonb_array_elements(p_tramos) x order by (x ->> 'seq')::integer loop
    v_motivo := null;
    begin
      v_seq := (t ->> 'seq')::integer;
      v_tipo := t ->> 'tipo';
      v_ex := nullif(t ->> 'exercise_id', '')::uuid;
      v_ini := to_timestamp((t ->> 'inicio_ms')::bigint / 1000.0);
      v_fin := to_timestamp((t ->> 'fin_ms')::bigint / 1000.0);
    exception when others then v_motivo := 'formato';
    end;
    continue when v_motivo is null and v_seq <= s.diario_seq;          -- ya recibido (reintento)
    if v_motivo is null then
      v_motivo := case
        when v_seq is null or v_seq > 100000 then 'secuencia'
        when v_tipo not in ('trabajo', 'inactividad', 'pausa_declarada', 'oculta', 'desconexion', 'desconocido', 'fuera_de_pregunta') then 'tipo'
        when v_fin <= v_ini then 'duracion'
        when v_fin - v_ini > interval '6 hours' then 'duracion'
        when v_ini < a.started_at - interval '5 seconds' or v_fin > v_tope then 'fuera_de_sesion'
        when s.diario_fin is not null and v_ini < s.diario_fin - interval '5 seconds' then 'solapamiento'
        when v_ex is not null and array_position(v_orden, v_ex) is null then 'pregunta_ajena'
        else null end;
    end if;
    if v_motivo is null then
      insert into public.exam_intervals (attempt_id, user_id, seq, tipo, exercise_id, inicio, fin, sin_red)
        values (p_attempt, a.user_id, v_seq, v_tipo, v_ex, v_ini, v_fin, coalesce((t ->> 'sin_red')::boolean, false));
      s.diario_fin := greatest(coalesce(s.diario_fin, v_fin), v_fin);
      v_ok := v_ok + 1;
    else
      insert into public.exam_events (attempt_id, user_id, tipo, data) values (p_attempt, a.user_id, 'rechazo', jsonb_build_object('seq', v_seq, 'motivo', v_motivo));
      v_mal := v_mal + 1;
    end if;
    if v_seq is not null and v_seq <= 100000 then s.diario_seq := greatest(s.diario_seq, v_seq); end if;
  end loop;
  update public.exam_sessions set diario_seq = s.diario_seq, diario_fin = s.diario_fin, ultimo_contacto = now() where attempt_id = p_attempt;
  return jsonb_build_object('aceptados', v_ok, 'rechazados', v_mal, 'diario_seq', s.diario_seq);
end;
$$;

-- Guardado con revisión: solo aplica una revisión MAYOR que la guardada (reintentos y desorden no pisan lo nuevo)
create or replace function public.exam_save(p_attempt uuid, p_exercise uuid, p_answer jsonb, p_rev bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_att public.attempts; v_points numeric; v_rev bigint;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' or octet_length(p_answer::text) > 20000 then raise exception 'Respuesta inválida' using errcode = '22023'; end if;
  if p_rev is null or p_rev < 1 then raise exception 'Revisión inválida' using errcode = '22023'; end if;
  v_att := public.assert_attempt_writable(p_attempt, auth.uid());       -- incluye el límite de tiempo del examen
  perform public.exam_assert_navegable(p_attempt, p_exercise);
  v_points := public.attempt_item_points(p_attempt, p_exercise);
  if v_points is null then raise exception 'El ejercicio no pertenece a este intento' using errcode = '42501'; end if;
  insert into public.responses as r (attempt_id, exercise_id, user_id, answer, points, client_rev)
    values (p_attempt, p_exercise, auth.uid(), p_answer, v_points, p_rev)
    on conflict (attempt_id, exercise_id) do update set answer = excluded.answer, client_rev = excluded.client_rev
      where r.client_rev < excluded.client_rev
    returning r.client_rev into v_rev;
  if v_rev is not null then return jsonb_build_object('rev', v_rev, 'aplicada', true, 'ahora_ms', public.exam_ms(now())); end if;
  select client_rev into v_rev from public.responses where attempt_id = p_attempt and exercise_id = p_exercise;
  return jsonb_build_object('rev', v_rev, 'aplicada', false, 'ahora_ms', public.exam_ms(now()));
end;
$$;

-- Regla de navegación al guardar: en «solo adelante», una pregunta que ya se dejó atrás no se modifica
-- (gracia de 10 s para el último guardado pendiente al cambiar de pregunta). En «libre», solo se cuenta.
create or replace function public.exam_assert_navegable(p_attempt uuid, p_exercise uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare s public.exam_sessions; v_dejada timestamptz;
begin
  select * into s from public.exam_sessions where attempt_id = p_attempt;
  if not found or s.activa is null or s.activa = p_exercise then return; end if;
  -- momento en que la dejó: la PRIMERA salida posterior a la última llegada (por orden de registro, que no empata)
  select min(e.t) into v_dejada from public.exam_events e
    where e.attempt_id = p_attempt and e.tipo = 'ir_a' and e.exercise_id <> p_exercise
      and e.id > coalesce((select max(e2.id) from public.exam_events e2 where e2.attempt_id = p_attempt and e2.tipo in ('apertura', 'ir_a') and e2.exercise_id = p_exercise), 0);
  if s.navegacion = 'solo_adelante' and (v_dejada is null or now() > v_dejada + interval '10 seconds') then
    raise exception 'En este examen no se puede modificar una pregunta anterior' using errcode = 'P0001';
  end if;
  update public.exam_sessions set fuera_de_turno = fuera_de_turno + 1 where attempt_id = p_attempt and (v_dejada is null or now() > v_dejada + interval '10 seconds');
end;
$$;

-- -----------------------------------------------------------------------------
-- Funciones existentes: se añade el límite de tiempo del examen y la regla de navegación (resto idéntico)

-- assert_attempt_writable (última versión: migración 4) + límite oficial con 30 s de gracia por la red
create or replace function public.assert_attempt_writable(p_attempt uuid, p_user uuid)
returns public.attempts
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_act public.activities;
  v_lim timestamptz;
begin
  if not public.account_ok(p_user) then raise exception 'Cuenta no habilitada' using errcode = '42501'; end if;
  select * into v_att from public.attempts where id = p_attempt;
  if not found or v_att.user_id <> p_user then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  if v_att.status <> 'in_progress' then raise exception 'El intento ya fue entregado' using errcode = 'P0001'; end if;
  if v_att.activity_id is not null then
    select * into v_act from public.activities where id = v_att.activity_id;
    if v_act.closes_at is not null and now() >= v_act.closes_at then
      raise exception 'El plazo de la actividad terminó' using errcode = 'P0001';
    end if;
    if not v_act.published then raise exception 'Actividad no disponible' using errcode = '42501'; end if;
    if exists (select 1 from public.exam_sessions s where s.attempt_id = p_attempt) then
      if (select pausa_desde from public.exam_sessions where attempt_id = p_attempt) is not null then
        raise exception 'El examen está en pausa' using errcode = 'P0001';
      end if;
      v_lim := public.exam_deadline(p_attempt);
      if v_lim is not null and now() >= v_lim + interval '30 seconds' then
        raise exception 'El tiempo del examen terminó' using errcode = 'P0001';
      end if;
    end if;
  elsif v_att.lesson_id is null then
    raise exception 'Intento inválido' using errcode = 'P0001';
  end if;
  return v_att;
end;
$$;

-- save_response_for (migración 3) + regla de navegación del examen
create or replace function public.save_response_for(p_user uuid, p_attempt uuid, p_exercise uuid, p_answer jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := p_user;
  v_att public.attempts;
  v_points numeric;
  v_resp public.responses;
  v_max integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' or octet_length(p_answer::text) > 20000 then
    raise exception 'Respuesta inválida' using errcode = '22023';
  end if;
  v_att := public.assert_attempt_writable(p_attempt, v_uid);
  perform public.exam_assert_navegable(p_attempt, p_exercise);
  v_points := public.attempt_item_points(p_attempt, p_exercise);
  if v_points is null then raise exception 'El ejercicio no pertenece a este intento' using errcode = '42501'; end if;
  select coalesce((select a.max_tries_per_item from public.activities a where a.id = v_att.activity_id), 3) into v_max;
  select * into v_resp from public.responses where attempt_id = p_attempt and exercise_id = p_exercise;
  if found and v_att.mode = 'practice'
     and (v_resp.status in ('correct', 'revealed', 'pending_review') or v_resp.solution_revealed or v_resp.tries >= v_max) then
    return; -- ejercicio ya cerrado: no se modifica la respuesta registrada
  end if;
  insert into public.responses (attempt_id, exercise_id, user_id, answer, points)
    values (p_attempt, p_exercise, v_uid, p_answer, v_points)
    on conflict (attempt_id, exercise_id) do update set answer = excluded.answer;
end;
$$;

-- Al entregar: evento oficial de entrega (cierra la sesión)
create or replace function public.exam_on_submit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'submitted' and old.status <> 'submitted' and exists (select 1 from public.exam_sessions s where s.attempt_id = new.id) then
    update public.exam_sessions set
      pausas_ms = pausas_ms + case when pausa_desde is null then 0 else public.exam_ms(now()) - public.exam_ms(pausa_desde) end,
      pausa_desde = null
      where attempt_id = new.id;
    insert into public.exam_events (attempt_id, user_id, tipo, t) values (new.id, new.user_id, 'entrega', coalesce(new.submitted_at, now()));
  end if;
  return new;
end;
$$;
drop trigger if exists exam_on_submit on public.attempts;
create trigger exam_on_submit after update of status on public.attempts for each row execute function public.exam_on_submit();

-- -----------------------------------------------------------------------------
-- Lectura de la cronología (el propio estudiante o el profesorado de la sección)

create or replace function public.exam_timeline(p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare a public.attempts; v_class uuid;
begin
  select * into a from public.attempts where id = p_attempt;
  if not found then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  select class_id into v_class from public.activities where id = a.activity_id;
  if a.user_id <> auth.uid() and (v_class is null or not public.is_class_teacher(v_class)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'sesion', (select to_jsonb(s) - 'user_id' from public.exam_sessions s where s.attempt_id = p_attempt),
    'limite_ms', public.exam_ms(public.exam_deadline(p_attempt)),
    'orden', to_jsonb(public.exam_item_order(p_attempt)),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('t', public.exam_ms(e.t), 'tipo', e.tipo, 'exercise_id', e.exercise_id, 'data', e.data) order by e.t, e.id), '[]'::jsonb)
                from public.exam_events e where e.attempt_id = p_attempt),
    'tramos', (select coalesce(jsonb_agg(jsonb_build_object('seq', i.seq, 'tipo', i.tipo, 'exercise_id', i.exercise_id, 'inicio', public.exam_ms(i.inicio), 'fin', public.exam_ms(i.fin), 'sin_red', i.sin_red) order by i.seq), '[]'::jsonb)
               from public.exam_intervals i where i.attempt_id = p_attempt));
end;
$$;

-- Seguimiento en vivo para el profesorado de la sección: estado de cada intento en curso (sin respuestas ni tramos)
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
    'inscritos', (select count(*) from public.enrollments e where e.class_id = act.class_id),
    'entregados', (select count(distinct a.user_id) from public.attempts a where a.activity_id = p_activity and a.status = 'submitted'),
    'en_curso', (select coalesce(jsonb_agg(jsonb_build_object(
        'attempt_id', a.id, 'nombre', p.full_name,
        'pregunta', array_position(public.exam_item_order(a.id), s.activa), 'total', cardinality(public.exam_item_order(a.id)),
        'respondidas', (select count(*) from public.responses r where r.attempt_id = a.id and r.answer <> '{}'::jsonb),
        'en_pausa', s.pausa_desde is not null, 'pausas', s.pausas_n,
        'ultimo_contacto_ms', public.exam_ms(s.ultimo_contacto), 'limite_ms', public.exam_ms(public.exam_deadline(a.id)),
        'inicio_ms', public.exam_ms(a.started_at)) order by p.full_name), '[]'::jsonb)
      from public.attempts a join public.exam_sessions s on s.attempt_id = a.id join public.profiles p on p.id = a.user_id
      where a.activity_id = p_activity and a.status = 'in_progress'));
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos: nada para anon; las funciones de uso directo, a authenticated; los ayudantes, a nadie
do $$
declare f text;
begin
  foreach f in array array[
    'public.exam_ms(timestamptz)', 'public.exam_item_order(uuid)', 'public.exam_deadline(uuid)', 'public.exam_settings_of(uuid)',
    'public.exam_state(uuid)', 'public.exam_session_for(uuid)', 'public.exam_assert_navegable(uuid, uuid)', 'public.exam_on_submit()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.exam_settings_get(uuid)', 'public.exam_settings_save(uuid, jsonb)', 'public.exam_rules(uuid)', 'public.exam_open(uuid)', 'public.exam_ping(uuid)',
    'public.exam_goto(uuid, uuid)', 'public.exam_pause(uuid)', 'public.exam_resume(uuid)', 'public.exam_journal(uuid, jsonb)',
    'public.exam_save(uuid, uuid, jsonb, bigint)', 'public.exam_timeline(uuid)', 'public.exam_monitor(uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
