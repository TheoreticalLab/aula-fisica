-- =============================================================================
-- Asistencia autónoma por quórum de proximidad (docs/ASISTENCIA_QUORUM.md). Migración ADITIVA.
--
-- Segundo mecanismo de activación, junto al manual del profesor (que NO cambia):
--  1. HORARIO: cada sección tiene su horario semanal (America/Santo_Domingo). Desde la hora programada y durante una
--     ventana configurable (20 min), sus estudiantes pueden FORMAR un quórum.
--  2. QUÓRUM: cuando 3 estudiantes distintos, matriculados, con dispositivos distintos y mediciones recientes y
--     precisas, están a ≤ R_q (50 m) unos de otros dentro de la misma ventana de simultaneidad (120 s), el servidor
--     ACTIVA la asistencia (sesión con activación 'quorum') y los registra presentes. Atómico: un candado por sección
--     serializa las solicitudes y un índice único impide dos sesiones por franja.
--  3. CENTRO C₀ = media de las posiciones del quórum; radio general R_a = geo_radius_m (100 m, el existente). C₀ no
--     se mueve (solo el profesor, de forma auditada, con attendance_set_location).
--  4. VALIDACIÓN PROGRESIVA: un estudiante que llega después queda presente si d(P, C₀) ≤ R_a y está a ≤ R_p (50 m)
--     de algún admitido cuya referencia sigue VIGENTE (15 min). La zona nunca se desplaza.
--  5. INCERTIDUMBRE: cada comparación es compatible (d ≤ R), incompatible (d − a₁ − a₂ > R) o inconclusa; una
--     medición con precisión peor que el umbral (40 m) o más antigua que el máximo (60 s) no decide nada. Inconclusa
--     NO es ausencia: se puede reintentar o pedir validación al profesor (attendance_set, sin cambios).
-- Limitación declarada: la ubicación y la antigüedad de la medición las informa el dispositivo; pueden falsearse con
-- conocimientos técnicos. El servidor aplica identidad, matrícula, horario, simultaneidad, dispositivos distintos y
-- consistencia, pero no puede certificar la posición física.
-- Retención: solicitudes 7 días; coordenadas de los registros por quórum/proximidad 30 días (se conservan las
-- distancias); incidencias 180 días.
-- =============================================================================

-- 1 · configuración y horario ---------------------------------------------------------------------------------------
create table if not exists public.attendance_quorum_settings (
  class_id uuid primary key references public.classes (id) on delete cascade,
  enabled boolean not null default false,
  quorum smallint not null default 3 check (quorum between 3 and 6),
  ventana_min smallint not null default 20 check (ventana_min between 5 and 120),
  radio_quorum_m smallint not null default 50 check (radio_quorum_m between 10 and 200),
  radio_proximidad_m smallint not null default 50 check (radio_proximidad_m between 10 and 200),
  radio_general_m smallint not null default 100 check (radio_general_m between 20 and 2000),
  vigencia_ref_min smallint not null default 15 check (vigencia_ref_min between 2 and 180),
  precision_max_m smallint not null default 40 check (precision_max_m between 5 and 500),
  edad_max_s smallint not null default 60 check (edad_max_s between 10 and 600),
  simultaneidad_s smallint not null default 120 check (simultaneidad_s between 30 and 900),
  duracion_min smallint not null default 90 check (duracion_min between 10 and 300),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),   -- ISO: 1 = lunes … 7 = domingo
  hora time not null,                                                 -- hora local de America/Santo_Domingo
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (class_id, dia_semana, hora)
);

-- 2 · solicitudes de quórum (temporales) e incidencias ----------------------------------------------------------------
create table if not exists public.attendance_quorum_requests (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  franja timestamptz not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null unique,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  precision_m double precision not null check (precision_m > 0),
  edad_ms integer not null check (edad_ms >= 0),
  device_hash text not null,
  created_at timestamptz not null default clock_timestamp(),
  usada boolean not null default false,
  unique (class_id, franja, user_id)          -- una sola posición vigente por cuenta y franja
);
create index if not exists attendance_quorum_requests_franja_idx on public.attendance_quorum_requests (class_id, franja, created_at);

create table if not exists public.attendance_quorum_events (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  session_id uuid references public.attendance_sessions (id) on delete cascade,
  franja timestamptz,
  user_id uuid references public.profiles (id) on delete set null,
  tipo text not null check (tipo in ('activacion', 'presente', 'inconclusa', 'fuera_de_zona', 'medicion_antigua', 'dispositivo_compartido',
                                     'fuera_de_horario', 'renovada', 'configuracion', 'centro_modificado')),
  detalle jsonb not null default '{}'::jsonb check (jsonb_typeof(detalle) = 'object' and octet_length(detalle::text) <= 600),
  created_at timestamptz not null default now()
);
create index if not exists attendance_quorum_events_idx on public.attendance_quorum_events (class_id, created_at desc);

-- 3 · columnas nuevas en las tablas existentes (con valores por defecto: las sesiones anteriores no cambian) ---------
alter table public.attendance_sessions add column if not exists activacion text not null default 'manual' check (activacion in ('manual', 'quorum'));
alter table public.attendance_sessions add column if not exists franja timestamptz;
alter table public.attendance_sessions add column if not exists quorum_ids uuid[];
create unique index if not exists attendance_sessions_quorum_franja on public.attendance_sessions (class_id, franja) where activacion = 'quorum';

alter table public.attendance_records add column if not exists ref_vigente_hasta timestamptz;
alter table public.attendance_records add column if not exists validado_por uuid references public.profiles (id) on delete set null;
alter table public.attendance_records add column if not exists distancia_ref_m integer;
-- método: se AMPLÍAN los valores permitidos (los existentes siguen siendo válidos)
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.attendance_records'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%method%' loop
    execute format('alter table public.attendance_records drop constraint %I', c);
  end loop;
  alter table public.attendance_records add constraint attendance_records_method_check check (method in ('codigo', 'profesor', 'quorum', 'proximidad'));
end $$;

alter table public.attendance_quorum_settings enable row level security;
alter table public.class_schedules enable row level security;
alter table public.attendance_quorum_requests enable row level security;
alter table public.attendance_quorum_events enable row level security;
revoke all on public.attendance_quorum_settings, public.class_schedules, public.attendance_quorum_requests, public.attendance_quorum_events from anon, authenticated;

-- 4 · funciones auxiliares ------------------------------------------------------------------------------------------
-- compatible / incompatible / inconclusa frente a un radio, con la incertidumbre de ambas mediciones
create or replace function public.geo_veredicto(p_d double precision, p_a1 double precision, p_a2 double precision, p_r double precision)
returns text
language sql immutable set search_path = ''
as $$ select case when p_d <= p_r then 'compatible' when p_d - (coalesce(p_a1, 0) + coalesce(p_a2, 0)) > p_r then 'incompatible' else 'inconclusa' end $$;

-- inicio (hora del servidor) de la clase programada cuya ventana contiene p_at; mira hoy y ayer (clases nocturnas)
create or replace function public.attendance_quorum_franja(p_class uuid, p_at timestamptz, p_ventana integer)
returns timestamptz
language sql stable set search_path = ''
as $$
  select max(y.t) from (
    select ((x.d + s.hora) at time zone 'America/Santo_Domingo') as t
    from public.class_schedules s
    cross join (values ((p_at at time zone 'America/Santo_Domingo')::date), ((p_at at time zone 'America/Santo_Domingo')::date - 1)) x(d)
    where s.class_id = p_class and s.activo and s.dia_semana = extract(isodow from x.d)
  ) y
  where y.t <= p_at and p_at < y.t + make_interval(mins => p_ventana)
$$;

-- próximo inicio programado después de p_at (hasta 8 días)
create or replace function public.attendance_quorum_proxima(p_class uuid, p_at timestamptz)
returns timestamptz
language sql stable set search_path = ''
as $$
  select min(((g.d0::date + s.hora) at time zone 'America/Santo_Domingo'))
  from public.class_schedules s
  cross join generate_series((p_at at time zone 'America/Santo_Domingo')::date, (p_at at time zone 'America/Santo_Domingo')::date + 7, interval '1 day') g(d0)
  where s.class_id = p_class and s.activo and s.dia_semana = extract(isodow from g.d0)
    and ((g.d0::date + s.hora) at time zone 'America/Santo_Domingo') > p_at
$$;

-- huella del identificador de instalación (igual que attendance_check_in)
create or replace function public.attendance_device_hash(p_install text)
returns text
language sql immutable set search_path = ''
as $$ select case when p_install ~ '^[0-9a-fA-F-]{16,64}$' then left(encode(sha256(convert_to(lower(p_install), 'UTF8')), 'hex'), 32) end $$;

create or replace function public.attendance_quorum_limpiar()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.attendance_quorum_requests where created_at < now() - interval '7 days';
  update public.attendance_records set lat = null, lng = null
    where method in ('quorum', 'proximidad') and lat is not null and marked_at < now() - interval '30 days';
  delete from public.attendance_quorum_events where created_at < now() - interval '180 days';
end;
$$;

-- 5 · admisión progresiva (núcleo; solo la llaman las funciones de esta migración) -----------------------------------
create or replace function public.attendance_quorum_admitir(p_uid uuid, p_session uuid, p_lat double precision, p_lng double precision,
  p_precision double precision, p_edad_ms integer, p_dev text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  ses public.attendance_sessions; st public.attendance_quorum_settings;
  v_dc double precision; v_zona text; v_ref record; v_hay_ref boolean; v_todas_lejos boolean;
begin
  select * into ses from public.attendance_sessions where id = p_session;
  select * into st from public.attendance_quorum_settings where class_id = ses.class_id;
  if st.class_id is null then   -- sin configuración guardada: valores por defecto (el radio general es el de la sesión)
    st.class_id := ses.class_id; st.vigencia_ref_min := 15; st.precision_max_m := 40; st.edad_max_s := 60;
    st.radio_proximidad_m := 50; st.radio_general_m := coalesce(ses.geo_radius_m, 100);
  end if;
  if exists (select 1 from public.attendance_records r where r.session_id = p_session and r.user_id = p_uid) then
    return jsonb_build_object('estado', 'presente', 'ya', true, 'session_id', p_session);
  end if;
  if p_edad_ms is null or p_edad_ms < 0 or p_edad_ms > st.edad_max_s * 1000 then
    return jsonb_build_object('estado', 'medicion_antigua');
  end if;
  if exists (select 1 from public.attendance_records r where r.session_id = p_session and r.device_hash = p_dev and r.user_id <> p_uid) then
    if (select count(*) from public.attendance_rejections x where x.session_id = p_session and x.user_id = p_uid) < 10 then
      insert into public.attendance_rejections (session_id, user_id, reason, accuracy) values (p_session, p_uid, 'dispositivo_compartido', p_precision);
    end if;
    return jsonb_build_object('estado', 'rechazada', 'motivo', 'dispositivo_compartido');
  end if;
  if p_precision is null or p_precision <= 0 or p_precision > st.precision_max_m then
    insert into public.attendance_quorum_events (class_id, session_id, franja, user_id, tipo, detalle)
      values (ses.class_id, p_session, ses.franja, p_uid, 'inconclusa', jsonb_build_object('motivo', 'precision', 'precision_m', round(p_precision::numeric)));
    return jsonb_build_object('estado', 'inconclusa', 'motivo', 'precision');
  end if;
  v_dc := public.geo_distance_m(ses.geo_lat, ses.geo_lng, p_lat, p_lng);
  v_zona := public.geo_veredicto(v_dc, p_precision, ses.geo_accuracy, ses.geo_radius_m);
  if v_zona = 'incompatible' then
    if (select count(*) from public.attendance_rejections x where x.session_id = p_session and x.user_id = p_uid) < 10 then
      insert into public.attendance_rejections (session_id, user_id, reason, distance_m, accuracy) values (p_session, p_uid, 'lejos', round(v_dc)::integer, p_precision);
    end if;
    insert into public.attendance_quorum_events (class_id, session_id, franja, user_id, tipo, detalle)
      values (ses.class_id, p_session, ses.franja, p_uid, 'fuera_de_zona', jsonb_build_object('motivo', 'lejos_del_centro', 'distancia_centro_m', round(v_dc), 'precision_m', round(p_precision::numeric)));
    return jsonb_build_object('estado', 'fuera_de_zona', 'motivo', 'lejos_del_centro');
  end if;
  -- referencia vigente más cercana (las caducadas no autorizan)
  select r.user_id, r.accuracy, public.geo_distance_m(r.lat, r.lng, p_lat, p_lng) as d into v_ref
  from public.attendance_records r
  where r.session_id = p_session and r.lat is not null and r.ref_vigente_hasta > now()
  order by public.geo_distance_m(r.lat, r.lng, p_lat, p_lng), r.user_id limit 1;
  v_hay_ref := v_ref.user_id is not null;
  if not v_hay_ref then
    insert into public.attendance_quorum_events (class_id, session_id, franja, user_id, tipo, detalle)
      values (ses.class_id, p_session, ses.franja, p_uid, 'inconclusa', jsonb_build_object('motivo', 'sin_referencias_vigentes', 'distancia_centro_m', round(v_dc)));
    return jsonb_build_object('estado', 'inconclusa', 'motivo', 'sin_referencias_vigentes');
  end if;
  if v_zona = 'inconclusa' then
    insert into public.attendance_quorum_events (class_id, session_id, franja, user_id, tipo, detalle)
      values (ses.class_id, p_session, ses.franja, p_uid, 'inconclusa', jsonb_build_object('motivo', 'zona_incierta', 'distancia_centro_m', round(v_dc), 'precision_m', round(p_precision::numeric)));
    return jsonb_build_object('estado', 'inconclusa', 'motivo', 'zona_incierta');
  end if;
  if v_ref.d <= st.radio_proximidad_m then
    insert into public.attendance_records (session_id, user_id, method, lat, lng, accuracy, distance_m, geo_status, device_hash, ref_vigente_hasta, validado_por, distancia_ref_m)
      values (p_session, p_uid, 'proximidad', p_lat, p_lng, p_precision, round(v_dc)::integer, 'verificado', p_dev, now() + make_interval(mins => st.vigencia_ref_min), v_ref.user_id, round(v_ref.d)::integer)
      on conflict (session_id, user_id) do nothing;
    insert into public.attendance_quorum_events (class_id, session_id, franja, user_id, tipo, detalle)
      values (ses.class_id, p_session, ses.franja, p_uid, 'presente', jsonb_build_object('distancia_centro_m', round(v_dc), 'distancia_ref_m', round(v_ref.d), 'precision_m', round(p_precision::numeric)));
    return jsonb_build_object('estado', 'presente', 'session_id', p_session);
  end if;
  select bool_and(public.geo_veredicto(public.geo_distance_m(r.lat, r.lng, p_lat, p_lng), p_precision, r.accuracy, st.radio_proximidad_m) = 'incompatible') into v_todas_lejos
  from public.attendance_records r where r.session_id = p_session and r.lat is not null and r.ref_vigente_hasta > now();
  if v_todas_lejos then
    if (select count(*) from public.attendance_rejections x where x.session_id = p_session and x.user_id = p_uid) < 10 then
      insert into public.attendance_rejections (session_id, user_id, reason, distance_m, accuracy) values (p_session, p_uid, 'lejos', round(v_dc)::integer, p_precision);
    end if;
    insert into public.attendance_quorum_events (class_id, session_id, franja, user_id, tipo, detalle)
      values (ses.class_id, p_session, ses.franja, p_uid, 'fuera_de_zona', jsonb_build_object('motivo', 'lejos_de_los_admitidos', 'distancia_centro_m', round(v_dc), 'distancia_ref_m', round(v_ref.d)));
    return jsonb_build_object('estado', 'fuera_de_zona', 'motivo', 'lejos_de_los_admitidos');
  end if;
  insert into public.attendance_quorum_events (class_id, session_id, franja, user_id, tipo, detalle)
    values (ses.class_id, p_session, ses.franja, p_uid, 'inconclusa', jsonb_build_object('motivo', 'proximidad_incierta', 'distancia_ref_m', round(v_ref.d)));
  return jsonb_build_object('estado', 'inconclusa', 'motivo', 'proximidad_incierta');
end;
$$;

-- 6 · estudiante: «Estoy aquí — Activar asistencia» ------------------------------------------------------------------
create or replace function public.attendance_quorum_join(p_class uuid, p_lat double precision, p_lng double precision, p_precision double precision,
  p_edad_ms integer, p_request uuid, p_install text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); st public.attendance_quorum_settings; v_dev text := public.attendance_device_hash(p_install);
  v_open public.attendance_sessions; v_franja timestamptz; v_grupo uuid[]; v_devs text[]; c record; v_n integer; v_sid uuid;
  v_lat double precision; v_lng double precision; v_acc double precision; v_max double precision;
begin
  if v_uid is null or not public.my_account_ok() then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = v_uid) then
    raise exception 'No pertenece a esta sección' using errcode = '42501';
  end if;
  select * into st from public.attendance_quorum_settings where class_id = p_class;
  if st.class_id is null or not st.enabled then return jsonb_build_object('estado', 'no_disponible'); end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Ubicación no válida' using errcode = '22023'; end if;
  if v_dev is null then return jsonb_build_object('estado', 'rechazada', 'motivo', 'sin_dispositivo'); end if;
  if random() < 0.02 then perform public.attendance_quorum_limpiar(); end if;

  -- una sola decisión a la vez por sección: evita activaciones dobles y carreras
  perform pg_advisory_xact_lock(hashtextextended('asistencia-quorum:' || p_class::text, 0));

  select * into v_open from public.attendance_sessions s where s.class_id = p_class and s.closed_at is null and s.code_expires_at > now() order by s.opened_at desc limit 1;
  if v_open.id is not null then
    if v_open.activacion = 'quorum' then
      return public.attendance_quorum_admitir(v_uid, v_open.id, p_lat, p_lng, p_precision, p_edad_ms, v_dev) || jsonb_build_object('activacion', 'quorum');
    end if;
    return jsonb_build_object('estado', 'sesion_manual', 'session_id', v_open.id);   -- se usa la del profesor (con su código)
  end if;

  v_franja := public.attendance_quorum_franja(p_class, now(), st.ventana_min);
  if v_franja is null then
    return jsonb_build_object('estado', 'fuera_de_horario', 'proxima', public.attendance_quorum_proxima(p_class, now()));
  end if;
  if exists (select 1 from public.attendance_sessions s where s.class_id = p_class and s.activacion = 'quorum' and s.franja = v_franja) then
    return jsonb_build_object('estado', 'cerrada');                                  -- el profesor ya cerró la de esta franja
  end if;
  if p_edad_ms is null or p_edad_ms < 0 or p_edad_ms > st.edad_max_s * 1000 then return jsonb_build_object('estado', 'medicion_antigua'); end if;
  if p_precision is null or p_precision <= 0 or p_precision > st.precision_max_m then
    insert into public.attendance_quorum_events (class_id, franja, user_id, tipo, detalle)
      values (p_class, v_franja, v_uid, 'inconclusa', jsonb_build_object('motivo', 'precision', 'precision_m', round(p_precision::numeric)));
    return jsonb_build_object('estado', 'inconclusa', 'motivo', 'precision');
  end if;
  if exists (select 1 from public.attendance_quorum_requests r where r.class_id = p_class and r.franja = v_franja and r.device_hash = v_dev
             and r.user_id <> v_uid and r.created_at > now() - make_interval(secs => st.simultaneidad_s)) then
    insert into public.attendance_quorum_events (class_id, franja, user_id, tipo) values (p_class, v_franja, v_uid, 'dispositivo_compartido');
    return jsonb_build_object('estado', 'rechazada', 'motivo', 'dispositivo_compartido');
  end if;

  insert into public.attendance_quorum_requests (class_id, franja, user_id, request_id, lat, lng, precision_m, edad_ms, device_hash)
    values (p_class, v_franja, v_uid, coalesce(p_request, gen_random_uuid()), p_lat, p_lng, p_precision, p_edad_ms, v_dev)
    on conflict (class_id, franja, user_id) do update set request_id = excluded.request_id, lat = excluded.lat, lng = excluded.lng,
      precision_m = excluded.precision_m, edad_ms = excluded.edad_ms, device_hash = excluded.device_hash, created_at = clock_timestamp(), usada = false;

  -- grupo voraz: candidatos por distancia creciente, compatibles con todos los elegidos, dispositivos distintos
  v_grupo := array[v_uid]; v_devs := array[v_dev];
  for c in
    select r.user_id, r.device_hash, r.lat, r.lng from public.attendance_quorum_requests r
    join public.enrollments e on e.class_id = r.class_id and e.user_id = r.user_id
    where r.class_id = p_class and r.franja = v_franja and r.user_id <> v_uid and not r.usada
      and r.created_at > now() - make_interval(secs => st.simultaneidad_s) and r.precision_m <= st.precision_max_m
    order by public.geo_distance_m(p_lat, p_lng, r.lat, r.lng), r.user_id
  loop
    exit when cardinality(v_grupo) >= st.quorum;
    continue when c.device_hash = any(v_devs);
    if not exists (select 1 from public.attendance_quorum_requests g where g.class_id = p_class and g.franja = v_franja and g.user_id = any(v_grupo)
                   and public.geo_distance_m(g.lat, g.lng, c.lat, c.lng) > st.radio_quorum_m) then
      v_grupo := v_grupo || c.user_id; v_devs := v_devs || c.device_hash;
    end if;
  end loop;

  if cardinality(v_grupo) < st.quorum then
    select count(distinct r.user_id) into v_n from public.attendance_quorum_requests r
    where r.class_id = p_class and r.franja = v_franja and not r.usada and r.created_at > now() - make_interval(secs => st.simultaneidad_s);
    return jsonb_build_object('estado', 'esperando', 'participantes', least(v_n, st.quorum - 1), 'compatibles', cardinality(v_grupo), 'quorum', st.quorum,
      'expira', now() + make_interval(secs => st.simultaneidad_s), 'fin_ventana', v_franja + make_interval(mins => st.ventana_min));
  end if;

  -- ACTIVACIÓN: centro C₀ = media del grupo; los integrantes quedan presentes
  select avg(g.lat), avg(g.lng), avg(g.precision_m) into v_lat, v_lng, v_acc
  from public.attendance_quorum_requests g where g.class_id = p_class and g.franja = v_franja and g.user_id = any(v_grupo);
  select max(public.geo_distance_m(a.lat, a.lng, b.lat, b.lng)) into v_max
  from public.attendance_quorum_requests a join public.attendance_quorum_requests b on b.class_id = a.class_id and b.franja = a.franja
  where a.class_id = p_class and a.franja = v_franja and a.user_id = any(v_grupo) and b.user_id = any(v_grupo);
  insert into public.attendance_sessions (class_id, code, opened_by, code_expires_at, rotate_seconds, geo_lat, geo_lng, geo_accuracy, geo_radius_m,
      require_location, activacion, franja, quorum_ids, note)
    values (p_class, public.attendance_random_code(), null, now() + make_interval(mins => st.duracion_min), 0, v_lat, v_lng, v_acc, st.radio_general_m,
      true, 'quorum', v_franja, v_grupo, 'Activada por quórum de proximidad')
    returning id into v_sid;
  insert into public.attendance_records (session_id, user_id, method, lat, lng, accuracy, distance_m, geo_status, device_hash, ref_vigente_hasta)
    select v_sid, g.user_id, 'quorum', g.lat, g.lng, g.precision_m, round(public.geo_distance_m(v_lat, v_lng, g.lat, g.lng))::integer, 'verificado',
      g.device_hash, g.created_at + make_interval(mins => st.vigencia_ref_min)
    from public.attendance_quorum_requests g where g.class_id = p_class and g.franja = v_franja and g.user_id = any(v_grupo)
    on conflict (session_id, user_id) do nothing;
  update public.attendance_quorum_requests set usada = true where class_id = p_class and franja = v_franja and user_id = any(v_grupo);
  insert into public.attendance_quorum_events (class_id, session_id, franja, user_id, tipo, detalle)
    values (p_class, v_sid, v_franja, v_uid, 'activacion', jsonb_build_object('integrantes', cardinality(v_grupo), 'distancia_max_m', round(v_max), 'precision_media_m', round(v_acc::numeric)));
  return jsonb_build_object('estado', 'activada', 'session_id', v_sid, 'presente', true);
end;
$$;

-- 7 · estudiante: «Marcar presente» en una asistencia activada por quórum ---------------------------------------------
create or replace function public.attendance_quorum_check_in(p_lat double precision, p_lng double precision, p_precision double precision,
  p_edad_ms integer, p_install text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_sid uuid; v_dev text := public.attendance_device_hash(p_install);
begin
  if v_uid is null or not public.my_account_ok() then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Ubicación no válida' using errcode = '22023'; end if;
  if v_dev is null then return jsonb_build_object('estado', 'rechazada', 'motivo', 'sin_dispositivo'); end if;
  select s.id into v_sid from public.attendance_sessions s join public.enrollments e on e.class_id = s.class_id and e.user_id = v_uid
  where s.activacion = 'quorum' and s.closed_at is null and s.code_expires_at > now() order by s.opened_at desc limit 1;
  if v_sid is null then return jsonb_build_object('estado', 'sin_sesion'); end if;
  return public.attendance_quorum_admitir(v_uid, v_sid, p_lat, p_lng, p_precision, p_edad_ms, v_dev);
end;
$$;

-- renovar la propia referencia (no es necesario para conservar la asistencia ya registrada)
create or replace function public.attendance_quorum_renovar(p_lat double precision, p_lng double precision, p_precision double precision, p_edad_ms integer, p_install text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_dev text := public.attendance_device_hash(p_install); r record; st public.attendance_quorum_settings; v_d double precision;
begin
  if v_uid is null or not public.my_account_ok() then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select rec.*, s.geo_lat, s.geo_lng, s.geo_accuracy, s.geo_radius_m, s.class_id, s.franja into r
  from public.attendance_records rec join public.attendance_sessions s on s.id = rec.session_id
  where rec.user_id = v_uid and s.activacion = 'quorum' and s.closed_at is null and s.code_expires_at > now() order by s.opened_at desc limit 1;
  if r.session_id is null then return jsonb_build_object('estado', 'sin_registro'); end if;
  select * into st from public.attendance_quorum_settings where class_id = r.class_id;
  if v_dev is null or r.device_hash is distinct from v_dev then return jsonb_build_object('estado', 'rechazada', 'motivo', 'otro_dispositivo'); end if;
  if p_edad_ms is null or p_edad_ms < 0 or p_edad_ms > coalesce(st.edad_max_s, 60) * 1000 then return jsonb_build_object('estado', 'medicion_antigua'); end if;
  if p_precision is null or p_precision <= 0 or p_precision > coalesce(st.precision_max_m, 40) then return jsonb_build_object('estado', 'inconclusa', 'motivo', 'precision'); end if;
  v_d := public.geo_distance_m(r.geo_lat, r.geo_lng, p_lat, p_lng);
  if v_d > r.geo_radius_m then return jsonb_build_object('estado', 'fuera_de_zona'); end if;   -- la referencia solo se renueva dentro de la zona
  update public.attendance_records set lat = p_lat, lng = p_lng, accuracy = p_precision,
    ref_vigente_hasta = now() + make_interval(mins => coalesce(st.vigencia_ref_min, 15)) where session_id = r.session_id and user_id = v_uid;
  insert into public.attendance_quorum_events (class_id, session_id, franja, user_id, tipo, detalle)
    values (r.class_id, r.session_id, r.franja, v_uid, 'renovada', jsonb_build_object('distancia_centro_m', round(v_d)));
  return jsonb_build_object('estado', 'renovada');
end;
$$;

-- estado para la página del estudiante (nunca devuelve posiciones de otros)
create or replace function public.attendance_quorum_estado()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'class_id', x.class_id, 'clase', x.clase, 'asignatura', x.asignatura, 'session_id', x.sid, 'activacion', x.activacion,
      'estado', case when x.sid is not null and x.activacion = 'quorum' then 'activa_quorum' when x.sid is not null then 'activa_manual'
                     when x.franja is not null and x.cerrada then 'cerrada' when x.franja is not null then 'quorum_disponible'
                     when x.proxima is not null then 'programada' else 'sin_horario' end,
      'presente', x.presente, 'franja', x.franja, 'fin_ventana', x.franja + make_interval(mins => x.ventana), 'proxima', x.proxima,
      'quorum', x.quorum, 'participantes', x.participantes, 'mi_solicitud', x.mia, 'mi_ref_vigente_hasta', x.mi_ref, 'server_now', now())
    order by x.asignatura, x.clase), '[]'::jsonb)
  from (
    select c.id as class_id, c.name as clase, co.title as asignatura, coalesce(st.ventana_min, 20) as ventana, coalesce(st.quorum, 3) as quorum,
      ses.id as sid, ses.activacion,
      exists (select 1 from public.attendance_records r where r.session_id = ses.id and r.user_id = auth.uid()) as presente,
      (select r.ref_vigente_hasta from public.attendance_records r where r.session_id = ses.id and r.user_id = auth.uid()) as mi_ref,
      f.franja,
      exists (select 1 from public.attendance_sessions s2 where s2.class_id = c.id and s2.activacion = 'quorum' and s2.franja = f.franja) as cerrada,
      public.attendance_quorum_proxima(c.id, now()) as proxima,
      (select count(distinct q.user_id) from public.attendance_quorum_requests q where q.class_id = c.id and q.franja = f.franja and not q.usada
         and q.created_at > now() - make_interval(secs => coalesce(st.simultaneidad_s, 120))) as participantes,
      exists (select 1 from public.attendance_quorum_requests q where q.class_id = c.id and q.franja = f.franja and q.user_id = auth.uid() and not q.usada
         and q.created_at > now() - make_interval(secs => coalesce(st.simultaneidad_s, 120))) as mia
    from public.enrollments e join public.classes c on c.id = e.class_id join public.courses co on co.id = c.course_id
    left join public.attendance_quorum_settings st on st.class_id = c.id
    left join lateral (select s.id, s.activacion from public.attendance_sessions s where s.class_id = c.id and s.closed_at is null and s.code_expires_at > now()
                       order by s.opened_at desc limit 1) ses on true
    cross join lateral (select case when st.enabled then public.attendance_quorum_franja(c.id, now(), st.ventana_min) end as franja) f
    where e.user_id = auth.uid() and not c.archived and public.my_account_ok() and (coalesce(st.enabled, false) or ses.activacion = 'quorum')
  ) x
$$;

-- 8 · profesor: configuración, horario y vista ------------------------------------------------------------------------
create or replace function public.attendance_quorum_config(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  return jsonb_build_object(
    'ajustes', coalesce((select to_jsonb(s) - 'updated_by' from public.attendance_quorum_settings s where s.class_id = p_class),
                        jsonb_build_object('class_id', p_class, 'enabled', false, 'quorum', 3, 'ventana_min', 20, 'radio_quorum_m', 50, 'radio_proximidad_m', 50,
                          'radio_general_m', 100, 'vigencia_ref_min', 15, 'precision_max_m', 40, 'edad_max_s', 60, 'simultaneidad_s', 120, 'duracion_min', 90)),
    'horario', (select coalesce(jsonb_agg(jsonb_build_object('dia_semana', h.dia_semana, 'hora', to_char(h.hora, 'HH24:MI'), 'activo', h.activo) order by h.dia_semana, h.hora), '[]')
                from public.class_schedules h where h.class_id = p_class),
    'proxima', public.attendance_quorum_proxima(p_class, now()),
    'zona', 'America/Santo_Domingo');
end;
$$;

create or replace function public.attendance_quorum_configurar(p_class uuid, p_ajustes jsonb, p_horario jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare h jsonb;
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_ajustes, '{}')) <> 'object' or (p_horario is not null and jsonb_typeof(p_horario) <> 'array') then raise exception 'Datos no válidos' using errcode = '22023'; end if;
  insert into public.attendance_quorum_settings (class_id, updated_by, updated_at) values (p_class, auth.uid(), now()) on conflict (class_id) do nothing;
  update public.attendance_quorum_settings set
    enabled = coalesce((p_ajustes ->> 'enabled')::boolean, enabled),
    quorum = coalesce((p_ajustes ->> 'quorum')::smallint, quorum),
    ventana_min = coalesce((p_ajustes ->> 'ventana_min')::smallint, ventana_min),
    radio_quorum_m = coalesce((p_ajustes ->> 'radio_quorum_m')::smallint, radio_quorum_m),
    radio_proximidad_m = coalesce((p_ajustes ->> 'radio_proximidad_m')::smallint, radio_proximidad_m),
    radio_general_m = coalesce((p_ajustes ->> 'radio_general_m')::smallint, radio_general_m),
    vigencia_ref_min = coalesce((p_ajustes ->> 'vigencia_ref_min')::smallint, vigencia_ref_min),
    precision_max_m = coalesce((p_ajustes ->> 'precision_max_m')::smallint, precision_max_m),
    edad_max_s = coalesce((p_ajustes ->> 'edad_max_s')::smallint, edad_max_s),
    simultaneidad_s = coalesce((p_ajustes ->> 'simultaneidad_s')::smallint, simultaneidad_s),
    duracion_min = coalesce((p_ajustes ->> 'duracion_min')::smallint, duracion_min),
    updated_by = auth.uid(), updated_at = now()
  where class_id = p_class;
  if p_horario is not null then
    delete from public.class_schedules where class_id = p_class;
    for h in select * from jsonb_array_elements(p_horario) loop
      insert into public.class_schedules (class_id, dia_semana, hora, activo)
        values (p_class, (h ->> 'dia_semana')::smallint, (h ->> 'hora')::time, coalesce((h ->> 'activo')::boolean, true))
        on conflict (class_id, dia_semana, hora) do nothing;
    end loop;
  end if;
  insert into public.attendance_quorum_events (class_id, user_id, tipo, detalle)
    values (p_class, auth.uid(), 'configuracion', jsonb_build_object('ajustes', p_ajustes, 'franjas', jsonb_array_length(coalesce(p_horario, '[]'))));
  return public.attendance_quorum_config(p_class);
end;
$$;

-- Vista en vivo (misma firma; copia de la migración 26) + activación, franja, quórum inicial, validación e incidencias
create or replace function public.attendance_live(p_session uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid := public.attendance_assert_teacher(p_session); r jsonb; v_rot integer; v_win bigint;
begin
  select rotate_seconds into v_rot from public.attendance_sessions where id = p_session;
  v_win := public.attendance_window(v_rot);
  select jsonb_build_object(
    'id', s.id, 'class_id', s.class_id, 'clase', c.name, 'asignatura', co.title,
    'code', public.attendance_code_at(s.id, v_win), 'code_expires_at', s.code_expires_at,
    'rotate_seconds', s.rotate_seconds,
    'code_changes_at', case when s.rotate_seconds > 0 then to_timestamp((v_win + 1) * s.rotate_seconds) end,
    'require_location', s.require_location, 'geo_radius_m', s.geo_radius_m, 'tiene_ubicacion', s.geo_lat is not null,
    'geo_accuracy', s.geo_accuracy,
    'opened_at', s.opened_at, 'closed_at', s.closed_at, 'abierta', s.closed_at is null and s.code_expires_at > now(), 'server_now', now(),
    'activacion', s.activacion, 'franja', s.franja,
    'quorum', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'student_code', p.student_code) order by p.full_name), '[]')
               from public.profiles p where p.id = any(coalesce(s.quorum_ids, '{}'))),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'student_code', p.student_code,
        'presente', r2.user_id is not null, 'marked_at', r2.marked_at, 'method', r2.method, 'geo_status', r2.geo_status,
        'distance_m', r2.distance_m, 'accuracy', round(r2.accuracy::numeric), 'distancia_ref_m', r2.distancia_ref_m,
        'validado_por', (select v.full_name from public.profiles v where v.id = r2.validado_por)) order by r2.marked_at nulls last, p.full_name), '[]')
      from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
      left join public.attendance_records r2 on r2.session_id = s.id and r2.user_id = p.id
      where e.class_id = s.class_id),
    'rechazos', (select coalesce(jsonb_agg(jsonb_build_object('full_name', p.full_name, 'student_code', p.student_code, 'motivo', x.reason,
        'distance_m', x.distance_m, 'accuracy', round(x.accuracy::numeric), 'fecha', x.created_at) order by x.created_at desc), '[]')
      from public.attendance_rejections x join public.profiles p on p.id = x.user_id where x.session_id = s.id),
    'incidencias', (select coalesce(jsonb_agg(jsonb_build_object('tipo', q.tipo, 'full_name', p.full_name, 'detalle', q.detalle, 'fecha', q.created_at) order by q.created_at desc), '[]')
      from public.attendance_quorum_events q left join public.profiles p on p.id = q.user_id
      where q.session_id = s.id or (s.franja is not null and q.session_id is null and q.class_id = s.class_id and q.franja = s.franja)))
  into r
  from public.attendance_sessions s join public.classes c on c.id = s.class_id join public.courses co on co.id = c.course_id
  where s.id = p_session;
  return r;
end;
$$;

-- Cambiar la ubicación de referencia (misma firma; copia de la migración 26) + registro auditado del cambio
create or replace function public.attendance_set_location(p_session uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid;
begin
  v_class := public.attendance_assert_teacher(p_session);
  if p_lat is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Ubicación no válida' using errcode = '22023'; end if;
  update public.attendance_sessions set geo_lat = p_lat, geo_lng = p_lng, geo_accuracy = p_accuracy where id = p_session;
  insert into public.attendance_quorum_events (class_id, session_id, user_id, tipo, detalle)
    values (v_class, p_session, auth.uid(), 'centro_modificado', jsonb_build_object('precision_m', round(p_accuracy::numeric)));
end;
$$;

-- permisos ---------------------------------------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['geo_veredicto(double precision, double precision, double precision, double precision)',
    'attendance_quorum_franja(uuid, timestamp with time zone, integer)', 'attendance_quorum_proxima(uuid, timestamp with time zone)',
    'attendance_device_hash(text)', 'attendance_quorum_limpiar()',
    'attendance_quorum_admitir(uuid, uuid, double precision, double precision, double precision, integer, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'attendance_quorum_join(uuid, double precision, double precision, double precision, integer, uuid, text)',
    'attendance_quorum_check_in(double precision, double precision, double precision, integer, text)',
    'attendance_quorum_renovar(double precision, double precision, double precision, integer, text)',
    'attendance_quorum_estado()', 'attendance_quorum_config(uuid)', 'attendance_quorum_configurar(uuid, jsonb, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
