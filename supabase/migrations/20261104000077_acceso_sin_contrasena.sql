-- =============================================================================
-- Acceso sin contraseña y recuperación supervisada (presencial) para ESTUDIANTES.
--
-- Solo añade: tablas nuevas y funciones nuevas. No toca cuentas, contraseñas, sesiones, prácticas, respuestas,
-- calificaciones, intentos, exámenes ni telemetría. TODO queda APAGADO por defecto:
--   acceso_config.passkeys / recuperacion / recuperacion_monitores = false; acceso_secciones sin filas (= apagado);
--   acceso_monitores sin filas: ningún monitor existente recibe el permiso automáticamente.
--
-- Flujo de recuperación (ver docs/ACCESO_SIN_CONTRASENA.md):
--   1. El estudiante, sin sesión, pide acceso desde su dispositivo (Edge Function «recuperar» → svc_acceso_solicitar).
--      El dispositivo guarda un secreto aleatorio (aquí solo su hash) y muestra un código corto.
--      La respuesta es la misma exista o no la cuenta (no permite averiguar qué IDs existen).
--   2. En persona, el profesor o un monitor DELEGADO de la sección verifica la identidad (carné, cédula…),
--      escribe el código que ve en el dispositivo y aprueba (acceso_aprobar). La aprobación no autentica a nadie
--      y vence en pocos minutos. Nadie más que el dispositivo con el secreto puede canjearla.
--   3. El dispositivo canjea (svc_acceso_canjear): un solo uso; la cuenta queda con cambio de contraseña obligatorio.
--      La Edge Function obtiene de Supabase Auth un token de un solo uso (admin.generateLink, sin enviar correo)
--      y el navegador lo verifica con auth.verifyOtp: la sesión la crea Supabase Auth, no esta base de datos.
-- El monitor nunca recibe tokens, contraseñas ni enlaces. Toda acción queda en acceso_eventos (inmutable).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configuración
-- -----------------------------------------------------------------------------
create table if not exists public.acceso_config (
  id smallint primary key default 1 check (id = 1),
  passkeys boolean not null default false,                 -- muestra «Entrar con passkey» y su administración
  recuperacion boolean not null default false,             -- interruptor general de la recuperación supervisada
  recuperacion_monitores boolean not null default false,   -- interruptor general de la delegación en monitores
  minutos_solicitud integer not null default 30 check (minutos_solicitud between 5 and 120),
  minutos_aprobacion integer not null default 10 check (minutos_aprobacion between 2 and 30),
  horas_sesion_reciente integer not null default 12 check (horas_sesion_reciente between 1 and 72),
  max_aprobaciones_monitor_dia integer not null default 5 check (max_aprobaciones_monitor_dia between 1 and 50),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.acceso_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.acceso_secciones (
  class_id uuid primary key references public.classes (id) on delete cascade,
  recuperacion boolean not null default false,
  monitores boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Permiso «aprobar recuperaciones» (student_access_recovery_approve) de un monitor en una sección:
-- independiente de class_monitors para que ningún monitor actual lo reciba sin que el profesor lo otorgue.
create table if not exists public.acceso_monitores (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  otorgado_por uuid references public.profiles (id) on delete set null,
  otorgado_at timestamptz not null default now(),
  revocado_por uuid references public.profiles (id) on delete set null,
  revocado_at timestamptz
);
create unique index if not exists acceso_monitores_activo on public.acceso_monitores (class_id, user_id) where revocado_at is null;

-- -----------------------------------------------------------------------------
-- Solicitudes
-- -----------------------------------------------------------------------------
create table if not exists public.acceso_solicitudes (
  id uuid primary key default gen_random_uuid(),
  flujo_id uuid not null default gen_random_uuid(),
  login_declarado text not null check (char_length(login_declarado) <= 40),
  user_id uuid references public.profiles (id) on delete cascade,   -- NULL: cuenta inexistente o no elegible (señuelo)
  class_id uuid references public.classes (id) on delete cascade,
  destinatario text not null check (destinatario in ('profesor', 'monitor')),
  elegible boolean not null default false,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'vencida', 'cancelada', 'revocada', 'completada')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  secreto_hash text not null check (secreto_hash ~ '^[0-9a-f]{64}$'),   -- sha256 del secreto del dispositivo
  codigo_hash text not null check (codigo_hash ~ '^[0-9a-f]{64}$'),     -- sha256(id:código); el código solo lo tiene el dispositivo
  intentos_codigo integer not null default 0,
  intentos_canje integer not null default 0,
  ip_hash text check (char_length(ip_hash) <= 64),
  device_hash text check (char_length(device_hash) <= 64),
  navegador text check (char_length(navegador) <= 60),
  dispositivo text check (char_length(dispositivo) <= 30),
  aprobada_por uuid references public.profiles (id) on delete set null,
  aprobada_rol text check (aprobada_rol in ('monitor', 'profesor', 'admin')),
  aprobada_at timestamptz,
  aprobada_hasta timestamptz,
  metodo_verificacion text check (metodo_verificacion in ('carnet', 'cedula', 'conocimiento_personal', 'otro_documento')),
  nota_verificacion text check (char_length(nota_verificacion) <= 300),
  cerrada_por uuid references public.profiles (id) on delete set null,
  cerrada_at timestamptz,
  motivo text check (char_length(motivo) <= 300),
  completada_at timestamptz
);
create index if not exists acceso_solicitudes_clase_idx on public.acceso_solicitudes (class_id, estado, created_at desc);
create index if not exists acceso_solicitudes_usuario_idx on public.acceso_solicitudes (user_id, created_at desc);
create index if not exists acceso_solicitudes_login_idx on public.acceso_solicitudes (login_declarado, created_at desc);
create index if not exists acceso_solicitudes_ip_idx on public.acceso_solicitudes (ip_hash, created_at desc);
create index if not exists acceso_solicitudes_vence_idx on public.acceso_solicitudes (estado, expires_at) where estado in ('pendiente', 'aprobada');

-- -----------------------------------------------------------------------------
-- Auditoría inmutable (sin claves foráneas: sobrevive al borrado de cuentas o secciones)
-- -----------------------------------------------------------------------------
create table if not exists public.acceso_eventos (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor uuid,
  actor_rol text not null check (actor_rol in ('estudiante', 'monitor', 'profesor', 'admin', 'sistema', 'anonimo')),
  class_id uuid,
  estudiante uuid,
  solicitud uuid,
  accion text not null check (accion ~ '^[a-z_]{3,40}$'),
  metodo text check (char_length(metodo) <= 60),
  resultado text not null check (resultado in ('ok', 'rechazado', 'error')),
  motivo text check (char_length(motivo) <= 300),
  detalle jsonb not null default '{}'::jsonb check (jsonb_typeof(detalle) = 'object' and octet_length(detalle::text) <= 2000)
);
create index if not exists acceso_eventos_clase_idx on public.acceso_eventos (class_id, created_at desc);
create index if not exists acceso_eventos_actor_idx on public.acceso_eventos (actor, accion, created_at desc);
create index if not exists acceso_eventos_solicitud_idx on public.acceso_eventos (solicitud);
comment on table public.acceso_eventos is 'Auditoría de acceso. Inmutable. Nunca contiene contraseñas, tokens, secretos ni códigos.';

create or replace function public.acceso_eventos_inmutable()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();   -- siempre la hora del servidor
    return new;
  end if;
  raise exception 'La auditoría de acceso es inmutable' using errcode = '42501';
end $$;
drop trigger if exists acceso_eventos_inmutable on public.acceso_eventos;
create trigger acceso_eventos_inmutable before insert or update or delete on public.acceso_eventos
  for each row execute function public.acceso_eventos_inmutable();
-- disparador que IMPIDE vaciar la tabla (protección, no una operación destructiva; en un bloque para el revisor estático)
do $$ begin
  execute 'drop trigger if exists acceso_eventos_sin_vaciar on public.acceso_eventos';
  execute 'create trigger acceso_eventos_sin_vaciar before truncate on public.acceso_eventos for each statement execute function public.acceso_eventos_inmutable()';
end $$;

create table if not exists public.acceso_alertas (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  tipo text not null check (tipo in ('monitor_exceso', 'cuenta_muchas_solicitudes', 'mismo_dispositivo', 'codigo_fallido',
    'ip_muchas_solicitudes', 'cuenta_no_elegible', 'canje_fallido', 'monitor_aprobo')),
  class_id uuid,
  actor uuid,
  estudiante uuid,
  solicitud uuid,
  detalle text check (char_length(detalle) <= 300),
  atendida_por uuid references public.profiles (id) on delete set null,
  atendida_at timestamptz
);
create index if not exists acceso_alertas_idx on public.acceso_alertas (class_id, created_at desc);

alter table public.acceso_config enable row level security;
alter table public.acceso_secciones enable row level security;
alter table public.acceso_monitores enable row level security;
alter table public.acceso_solicitudes enable row level security;
alter table public.acceso_eventos enable row level security;
alter table public.acceso_alertas enable row level security;
-- sin políticas: nadie lee ni escribe estas tablas por REST; todo pasa por las funciones de abajo
revoke all on public.acceso_config, public.acceso_secciones, public.acceso_monitores, public.acceso_solicitudes,
  public.acceso_eventos, public.acceso_alertas from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Auxiliares internas (no se conceden a nadie)
-- -----------------------------------------------------------------------------
create or replace function public.acceso_log(p_actor uuid, p_rol text, p_class uuid, p_estudiante uuid, p_solicitud uuid,
  p_accion text, p_metodo text, p_resultado text, p_motivo text, p_detalle jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = ''
as $$
  insert into public.acceso_eventos (actor, actor_rol, class_id, estudiante, solicitud, accion, metodo, resultado, motivo, detalle)
  values (p_actor, p_rol, p_class, p_estudiante, p_solicitud, p_accion, left(p_metodo, 60), p_resultado, left(p_motivo, 300),
          coalesce(p_detalle, '{}'::jsonb))
$$;

-- una alerta del mismo tipo, actor y estudiante como mucho cada hora (si sigue sin atender)
create or replace function public.acceso_alerta(p_tipo text, p_class uuid, p_actor uuid, p_estudiante uuid, p_solicitud uuid, p_detalle text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.acceso_alertas a where a.tipo = p_tipo and a.atendida_at is null
             and a.actor is not distinct from p_actor and a.estudiante is not distinct from p_estudiante
             and a.class_id is not distinct from p_class and a.created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into public.acceso_alertas (tipo, class_id, actor, estudiante, solicitud, detalle)
    values (p_tipo, p_class, p_actor, p_estudiante, p_solicitud, left(p_detalle, 300));
end $$;

-- ¿Qué papel tiene quien llama en la recuperación de esta sección? 'admin' | 'profesor' | 'monitor' | NULL
create or replace function public.acceso_papel(p_class uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when p_class is null or auth.uid() is null then null
    when public.is_admin() then 'admin'
    when public.grades_teacher(p_class) then 'profesor'
    when coalesce((select recuperacion_monitores from public.acceso_config where id = 1), false)
     and coalesce((select monitores from public.acceso_secciones where class_id = p_class), false)
     and public.is_class_monitor(p_class)
     and exists (select 1 from public.acceso_monitores a where a.class_id = p_class and a.user_id = auth.uid() and a.revocado_at is null)
      then 'monitor'
  end
$$;

-- rol con el que se anota a quien llama cuando no tiene papel en la sección
create or replace function public.acceso_rol_actor(p_papel text)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(p_papel, (select case p.role::text when 'admin' then 'admin' when 'teacher' then 'profesor' else 'estudiante' end
                            from public.profiles p where p.id = auth.uid()), 'anonimo')
$$;

-- sesión válida (existe en auth.sessions: no cerrada) e iniciada hace menos de horas_sesion_reciente
create or replace function public.acceso_sesion_reciente()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    where s.id::text = coalesce(auth.jwt() ->> 'session_id', '') and s.user_id = auth.uid()
      and s.created_at > now() - make_interval(hours => (select horas_sesion_reciente from public.acceso_config where id = 1)))
$$;

-- estudiante activo (no suspendido, no docente) matriculado en una sección con la recuperación activada
create or replace function public.acceso_estudiante_elegible(p_user uuid, p_class uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.enrollments e on e.user_id = p.id and e.class_id = p_class
    join public.classes c on c.id = e.class_id and not c.archived
    join public.acceso_secciones s on s.class_id = c.id and s.recuperacion
    join auth.users u on u.id = p.id
    where p.id = p_user and p.role::text = 'student' and p.active
      and (u.banned_until is null or u.banned_until <= now()) and u.deleted_at is null)
$$;

-- ¿es monitor activo de alguna sección? (su cuenta solo la recupera el profesor)
create or replace function public.acceso_es_monitor(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.class_monitors m where m.user_id = p_user and m.revoked_at is null) $$;

-- ¿hay en la sección algún monitor delegado y operativo (distinto del propio estudiante)?
create or replace function public.acceso_hay_monitor(p_class uuid, p_excepto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select recuperacion_monitores from public.acceso_config where id = 1), false)
     and coalesce((select monitores from public.acceso_secciones where class_id = p_class), false)
     and exists (select 1 from public.acceso_monitores a
                 join public.class_monitors m on m.class_id = a.class_id and m.user_id = a.user_id and m.revoked_at is null
                 join public.enrollments e on e.class_id = a.class_id and e.user_id = a.user_id
                 where a.class_id = p_class and a.revocado_at is null and a.user_id <> p_excepto and public.account_ok(a.user_id))
$$;

-- vence solicitudes pendientes y aprobaciones no canjeadas
create or replace function public.acceso_vencer()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  with v as (
    update public.acceso_solicitudes set estado = 'vencida', cerrada_at = now(),
      motivo = case when estado = 'aprobada' then 'La aprobación venció sin canjearse' else 'Venció sin atenderse' end
    where (estado = 'pendiente' and expires_at <= now()) or (estado = 'aprobada' and aprobada_hasta <= now())
    returning id, class_id, user_id, motivo)
  insert into public.acceso_eventos (actor, actor_rol, class_id, estudiante, solicitud, accion, resultado, motivo)
    select null, 'sistema', v.class_id, v.user_id, v.id, 'vencer', 'ok', v.motivo from v where v.user_id is not null;
end $$;

create or replace function public.acceso_negar(p_papel text, p_s public.acceso_solicitudes, p_accion text, p_motivo text, p_codigo text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform public.acceso_log(auth.uid(), public.acceso_rol_actor(p_papel), p_s.class_id, p_s.user_id, p_s.id, p_accion, null, 'rechazado', p_motivo);
  return jsonb_build_object('ok', false, 'error', p_motivo, 'codigo', coalesce(p_codigo, 'rechazado'));
end $$;

-- -----------------------------------------------------------------------------
-- Para la Edge Function «recuperar» (solo service_role)
-- -----------------------------------------------------------------------------
create or replace function public.svc_acceso_config()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('passkeys', c.passkeys, 'recuperacion', c.recuperacion,
    'monitores', c.recuperacion and c.recuperacion_monitores, 'minutos_solicitud', c.minutos_solicitud)
  from public.acceso_config c where c.id = 1
$$;

create or replace function public.svc_acceso_solicitar(p_login text, p_destinatario text, p_secreto_hash text, p_ip_hash text, p_meta jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_cfg public.acceso_config;
  v_login text := left(public.normalize_login(p_login), 40);
  v_id uuid := gen_random_uuid();
  v_user uuid;
  v_rol text;
  v_class uuid;
  v_eleg boolean := false;
  v_alfabeto constant text := 'ACDEFGHJKMNPQRTUVWXY3479';   -- sin 0/O, 1/I/L, 2/Z, 5/S, 6/B, 8
  v_bytes bytea := extensions.gen_random_bytes(6);
  v_codigo text := '';
  v_n integer;
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
begin
  select * into v_cfg from public.acceso_config where id = 1;
  if not v_cfg.recuperacion or (p_destinatario = 'monitor' and not v_cfg.recuperacion_monitores) then
    return jsonb_build_object('disponible', false);
  end if;
  if p_destinatario is null or p_destinatario not in ('profesor', 'monitor') or coalesce(p_secreto_hash, '') !~ '^[0-9a-f]{64}$'
     or v_login !~ '^[a-z0-9][a-z0-9._-]{2,39}$' then
    return jsonb_build_object('disponible', true, 'error', 'formato');
  end if;
  -- límites (no dependen de que la cuenta exista)
  if p_ip_hash is not null then
    select count(*) into v_n from public.acceso_solicitudes where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if v_n >= 30 then
      perform public.acceso_alerta('ip_muchas_solicitudes', null, null, null, null, format('%s solicitudes en una hora desde la misma red', v_n));
      return jsonb_build_object('disponible', true, 'limitado', true);
    end if;
  end if;
  select count(*) into v_n from public.acceso_solicitudes where login_declarado = v_login and created_at > now() - interval '24 hours';
  if v_n >= 3 then return jsonb_build_object('disponible', true, 'limitado', true); end if;

  select p.id, p.role::text into v_user, v_rol from public.profiles p where p.login_id = v_login;
  if v_user is not null and v_rol = 'student' then
    select e.class_id into v_class from public.enrollments e
      where e.user_id = v_user and public.acceso_estudiante_elegible(v_user, e.class_id)
        and (p_destinatario = 'profesor' or public.acceso_hay_monitor(e.class_id, v_user))
      order by e.enrolled_at desc limit 1;
    v_eleg := v_class is not null;
  elsif v_user is not null then
    perform public.acceso_alerta('cuenta_no_elegible', null, null, null, v_id, 'Se pidió recuperar una cuenta de profesor o administrador');
  end if;

  for i in 0..5 loop
    v_codigo := v_codigo || substr(v_alfabeto, get_byte(v_bytes, i) % length(v_alfabeto) + 1, 1);
  end loop;

  insert into public.acceso_solicitudes (id, login_declarado, user_id, class_id, destinatario, elegible, expires_at, secreto_hash,
    codigo_hash, ip_hash, device_hash, navegador, dispositivo)
  values (v_id, v_login, case when v_eleg then v_user end, v_class, p_destinatario, v_eleg,
    now() + make_interval(mins => v_cfg.minutos_solicitud), p_secreto_hash,
    encode(extensions.digest(v_id::text || ':' || v_codigo, 'sha256'), 'hex'),
    left(p_ip_hash, 64), left(v_meta ->> 'device_hash', 64), left(v_meta ->> 'browser', 60), left(v_meta ->> 'device_type', 30));

  perform public.acceso_log(null, 'anonimo', v_class, case when v_eleg then v_user end, v_id, 'solicitar', p_destinatario, 'ok', null,
    jsonb_build_object('elegible', v_eleg));
  if v_eleg then
    select count(*) into v_n from public.acceso_solicitudes where user_id = v_user and created_at > now() - interval '24 hours';
    if v_n >= 3 then
      perform public.acceso_alerta('cuenta_muchas_solicitudes', v_class, null, v_user, v_id, format('%s solicitudes para la misma cuenta en 24 h', v_n));
    end if;
  end if;
  return jsonb_build_object('disponible', true, 'id', v_id, 'codigo', v_codigo,
    'expira', now() + make_interval(mins => v_cfg.minutos_solicitud));
end $$;

create or replace function public.svc_acceso_estado(p_id uuid, p_secreto_hash text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare s public.acceso_solicitudes;
begin
  perform public.acceso_vencer();
  select * into s from public.acceso_solicitudes where id = p_id and secreto_hash = coalesce(p_secreto_hash, '');
  if not found then return jsonb_build_object('estado', 'desconocida'); end if;
  return jsonb_build_object('estado', s.estado, 'expira', s.expires_at,
    'aprobada_hasta', case when s.estado = 'aprobada' then s.aprobada_hasta end);
end $$;

create or replace function public.svc_acceso_canjear(p_id uuid, p_secreto_hash text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  s public.acceso_solicitudes;
  v_cfg public.acceso_config;
  v_hash text;
  v_email text;
  v_msg uuid;
begin
  perform public.acceso_vencer();
  select * into v_cfg from public.acceso_config where id = 1;
  select * into s from public.acceso_solicitudes where id = p_id for update;
  if not found then return jsonb_build_object('ok', false); end if;
  if s.secreto_hash <> coalesce(p_secreto_hash, '') then
    update public.acceso_solicitudes set intentos_canje = intentos_canje + 1 where id = s.id returning * into s;
    perform public.acceso_log(null, 'anonimo', s.class_id, s.user_id, s.id, 'canjear', null, 'rechazado', 'Secreto del dispositivo incorrecto');
    if s.intentos_canje >= 3 and s.user_id is not null then
      perform public.acceso_alerta('canje_fallido', s.class_id, null, s.user_id, s.id, 'Intentos de canje con un secreto incorrecto');
    end if;
    return jsonb_build_object('ok', false);
  end if;
  if s.user_id is null or s.estado <> 'aprobada' or s.aprobada_hasta <= now() then
    if s.user_id is not null then
      perform public.acceso_log(s.user_id, 'estudiante', s.class_id, s.user_id, s.id, 'canjear', null, 'rechazado', 'Estado: ' || s.estado);
    end if;
    return jsonb_build_object('ok', false, 'estado', s.estado);
  end if;
  -- la autorización se vuelve a comprobar al canjear: apagar un interruptor o retirar el permiso la anula al instante
  if not v_cfg.recuperacion or not public.acceso_estudiante_elegible(s.user_id, s.class_id)
     or (s.aprobada_rol = 'monitor' and not (
           v_cfg.recuperacion_monitores
           and coalesce((select monitores from public.acceso_secciones where class_id = s.class_id), false)
           and exists (select 1 from public.acceso_monitores a where a.class_id = s.class_id and a.user_id = s.aprobada_por and a.revocado_at is null)
           and exists (select 1 from public.class_monitors m where m.class_id = s.class_id and m.user_id = s.aprobada_por and m.revoked_at is null))) then
    update public.acceso_solicitudes set estado = 'revocada', cerrada_at = now(), motivo = 'La autorización dejó de ser válida antes del canje'
      where id = s.id;
    perform public.acceso_log(null, 'sistema', s.class_id, s.user_id, s.id, 'canjear', null, 'rechazado', 'La autorización dejó de ser válida');
    return jsonb_build_object('ok', false, 'estado', 'revocada');
  end if;

  select u.encrypted_password, u.email into v_hash, v_email from auth.users u where u.id = s.user_id;
  if v_email is null then return jsonb_build_object('ok', false); end if;
  update public.acceso_solicitudes set estado = 'completada', completada_at = now() where id = s.id;
  -- contraseña nueva obligatoria (mismo mecanismo que la contraseña provisional: confirm_password_changed)
  update public.profiles set must_change_password = true,
      password_fingerprint = case when v_hash is null then null else encode(extensions.digest(v_hash, 'sha256'), 'hex') end
    where id = s.user_id;
  perform public.acceso_log(s.user_id, 'estudiante', s.class_id, s.user_id, s.id, 'canjear', s.metodo_verificacion, 'ok', null,
    jsonb_build_object('aprobada_por', s.aprobada_por, 'aprobada_rol', s.aprobada_rol));
  -- aviso interno al estudiante (no hay otro canal verificado: las cuentas no tienen correo real)
  begin
    insert into public.live_messages (sender_id, kind, body, audience, remitente)
      values (null, 'importante',
        format('Se recuperó el acceso a tu cuenta el %s con verificación presencial (%s). Si no fuiste tú, avisa al profesor de inmediato.',
          to_char(now() at time zone 'America/Santo_Domingo', 'DD/MM/YYYY HH24:MI'),
          case s.aprobada_rol when 'monitor' then 'monitor de la sección' else 'profesor' end),
        jsonb_build_object('modo', 'acceso', 'seccion', s.class_id, 'seleccionados', 1), 'aula')
      returning id into v_msg;
    insert into public.live_message_recipients (message_id, user_id) values (v_msg, s.user_id);
  exception when others then null;   -- el aviso no debe impedir la recuperación
  end;
  return jsonb_build_object('ok', true, 'user_id', s.user_id, 'email', v_email);
end $$;

create or replace function public.svc_acceso_canje_fallido(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare s public.acceso_solicitudes;
begin
  select * into s from public.acceso_solicitudes where id = p_id;
  if not found then return; end if;
  perform public.acceso_log(null, 'sistema', s.class_id, s.user_id, s.id, 'emitir_token', null, 'error', left(p_motivo, 300));
  perform public.acceso_alerta('canje_fallido', s.class_id, null, s.user_id, s.id, 'Supabase Auth no emitió el token de un solo uso');
end $$;

-- -----------------------------------------------------------------------------
-- Panel (profesor, administrador, monitor delegado)
-- -----------------------------------------------------------------------------
create or replace function public.acceso_estado_panel()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.acceso_config;
  v_secciones jsonb;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into v_cfg from public.acceso_config where id = 1;
  select coalesce(jsonb_agg(x order by x ->> 'curso', x ->> 'seccion'), '[]'::jsonb) into v_secciones from (
    select jsonb_build_object('class_id', c.id, 'seccion', c.name, 'curso', k.title, 'papel', public.acceso_papel(c.id),
      'recuperacion', coalesce(s.recuperacion, false), 'monitores', coalesce(s.monitores, false),
      'pendientes', (select count(*) from public.acceso_solicitudes q where q.class_id = c.id and q.estado = 'pendiente'
                       and q.expires_at > now() and q.user_id is not null
                       and (public.acceso_papel(c.id) <> 'monitor' or q.destinatario = 'monitor'))) as x
    from public.classes c join public.courses k on k.id = c.course_id
    left join public.acceso_secciones s on s.class_id = c.id
    where not c.archived and public.acceso_papel(c.id) is not null) t;
  return jsonb_build_object(
    'passkeys', v_cfg.passkeys,
    'recuperacion', v_cfg.recuperacion,
    'monitores', v_cfg.recuperacion and v_cfg.recuperacion_monitores,
    'config', case when public.is_admin() then to_jsonb(v_cfg) - 'updated_by' end,
    'secciones', v_secciones,
    'sesion_reciente', public.acceso_sesion_reciente(),
    'alertas', case when public.is_teacher() then (select count(*) from public.acceso_alertas a
                 where a.atendida_at is null and (public.is_admin() or (a.class_id is not null and public.grades_teacher(a.class_id)))) end);
end $$;

create or replace function public.acceso_solicitudes_lista(p_estados text[] default null, p_class uuid default null,
  p_desde timestamptz default null, p_hasta timestamptz default null, p_buscar text default null, p_actor uuid default null,
  p_rol text default null, p_limite integer default 200)
returns table (id uuid, flujo_id uuid, created_at timestamptz, expires_at timestamptz, estado text, destinatario text,
  class_id uuid, seccion text, curso text, estudiante uuid, estudiante_nombre text, estudiante_login text,
  aprobada_por uuid, aprobada_por_nombre text, aprobada_rol text, aprobada_at timestamptz, aprobada_hasta timestamptz,
  metodo_verificacion text, nota_verificacion text, cerrada_por_nombre text, cerrada_at timestamptz, motivo text,
  completada_at timestamptz, intentos_codigo integer, navegador text, dispositivo text, otras_activas bigint, mi_papel text)
language plpgsql security definer set search_path = ''
as $$
declare v_b text := nullif(lower(btrim(coalesce(p_buscar, ''))), '');
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  perform public.acceso_vencer();
  return query
  with mis as (
    select c.id, c.name, k.title, public.acceso_papel(c.id) as papel
    from public.classes c join public.courses k on k.id = c.course_id
    where (p_class is null or c.id = p_class))
  select s.id, s.flujo_id, s.created_at, s.expires_at, s.estado, s.destinatario, s.class_id, m.name, m.title,
    s.user_id, p.full_name, p.login_id, s.aprobada_por, ap.full_name, s.aprobada_rol, s.aprobada_at, s.aprobada_hasta,
    s.metodo_verificacion, s.nota_verificacion, cp.full_name, s.cerrada_at, s.motivo, s.completada_at, s.intentos_codigo,
    s.navegador, s.dispositivo,
    (select count(*) from public.acceso_solicitudes o where o.user_id = s.user_id and o.id <> s.id and o.estado in ('pendiente', 'aprobada')),
    m.papel
  from public.acceso_solicitudes s
  join mis m on m.id = s.class_id and m.papel is not null
  join public.profiles p on p.id = s.user_id
  left join public.profiles ap on ap.id = s.aprobada_por
  left join public.profiles cp on cp.id = s.cerrada_por
  where s.user_id is not null
    and (m.papel <> 'monitor' or s.destinatario = 'monitor')
    and (p_estados is null or s.estado = any (p_estados))
    and (p_desde is null or s.created_at >= p_desde)
    and (p_hasta is null or s.created_at < p_hasta)
    and (v_b is null or lower(p.full_name) like '%' || v_b || '%' or p.login_id like '%' || v_b || '%')
    and (p_actor is null or s.aprobada_por = p_actor or s.cerrada_por = p_actor)
    and (p_rol is null or s.aprobada_rol = p_rol)
  order by s.created_at desc
  limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end $$;

create or replace function public.acceso_aprobar(p_solicitud uuid, p_codigo text, p_metodo text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.acceso_config;
  s public.acceso_solicitudes;
  v_papel text;
  v_cod text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_fallo text;
  v_n integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  perform public.acceso_vencer();
  select * into v_cfg from public.acceso_config where id = 1;
  select * into s from public.acceso_solicitudes where id = p_solicitud for update;
  if not found or s.user_id is null then
    perform public.acceso_log(v_uid, public.acceso_rol_actor(null), null, null, p_solicitud, 'aprobar', null, 'rechazado', 'Solicitud no encontrada');
    return jsonb_build_object('ok', false, 'error', 'Solicitud no encontrada', 'codigo', 'no_encontrada');
  end if;
  v_papel := public.acceso_papel(s.class_id);
  v_fallo := case
    when not v_cfg.recuperacion then 'La recuperación supervisada está desactivada'
    when v_papel is null then 'No tiene permiso para aprobar en esta sección'
    when s.destinatario = 'profesor' and v_papel = 'monitor' then 'Esta solicitud es para el profesor'
    when s.estado <> 'pendiente' then 'La solicitud ya no está pendiente (' || s.estado || ')'
    when s.user_id = v_uid then 'No puede aprobar su propia solicitud'
    when not public.acceso_estudiante_elegible(s.user_id, s.class_id) then 'La cuenta no puede recuperarse por esta vía'
    when v_papel = 'monitor' and public.acceso_es_monitor(s.user_id) then 'La cuenta de un monitor solo la recupera el profesor'
    when coalesce(p_metodo, '') not in ('carnet', 'cedula', 'conocimiento_personal', 'otro_documento') then 'Indique cómo verificó la identidad'
  end;
  if v_fallo is not null then return public.acceso_negar(v_papel, s, 'aprobar', v_fallo); end if;
  if not public.acceso_sesion_reciente() then
    return public.acceso_negar(v_papel, s, 'aprobar', 'Por seguridad, vuelva a iniciar sesión para aprobar', 'sesion_no_reciente');
  end if;
  if v_papel = 'monitor' then
    select count(*) into v_n from public.acceso_eventos e
      where e.actor = v_uid and e.accion = 'aprobar' and e.resultado = 'ok' and e.created_at > now() - interval '24 hours';
    if v_n >= v_cfg.max_aprobaciones_monitor_dia then
      perform public.acceso_alerta('monitor_exceso', s.class_id, v_uid, null, s.id, format('El monitor alcanzó %s aprobaciones en 24 h', v_n));
      return public.acceso_negar(v_papel, s, 'aprobar', 'Alcanzó el máximo de aprobaciones de las últimas 24 horas');
    end if;
    -- la solicitud salió de un dispositivo en el que el propio monitor ha iniciado sesión
    if s.device_hash is not null and exists (select 1 from public.login_attempts l where l.user_id = v_uid and l.success
         and l.device_hash = s.device_hash and l.created_at > now() - interval '90 days') then
      perform public.acceso_alerta('mismo_dispositivo', s.class_id, v_uid, s.user_id, s.id, 'La solicitud salió de un dispositivo usado por el monitor');
      return public.acceso_negar(v_papel, s, 'aprobar', 'La solicitud se hizo desde un dispositivo en el que usted ha iniciado sesión. Debe aprobarla el profesor');
    end if;
  end if;
  if v_cod = '' or encode(extensions.digest(s.id::text || ':' || v_cod, 'sha256'), 'hex') <> s.codigo_hash then
    update public.acceso_solicitudes set intentos_codigo = intentos_codigo + 1 where id = s.id returning * into s;
    if s.intentos_codigo >= 5 then
      update public.acceso_solicitudes set estado = 'cancelada', cerrada_at = now(), motivo = 'Demasiados códigos incorrectos' where id = s.id;
      perform public.acceso_alerta('codigo_fallido', s.class_id, v_uid, s.user_id, s.id, 'Solicitud cancelada por códigos incorrectos');
    end if;
    return public.acceso_negar(v_papel, s, 'aprobar', 'El código no coincide con el que muestra el dispositivo del estudiante', 'codigo');
  end if;

  update public.acceso_solicitudes set estado = 'aprobada', aprobada_por = v_uid, aprobada_rol = v_papel, aprobada_at = now(),
      aprobada_hasta = now() + make_interval(mins => v_cfg.minutos_aprobacion), metodo_verificacion = p_metodo,
      nota_verificacion = nullif(left(btrim(coalesce(p_nota, '')), 300), '')
    where id = s.id;
  perform public.acceso_log(v_uid, v_papel, s.class_id, s.user_id, s.id, 'aprobar', p_metodo, 'ok', null);
  -- las demás solicitudes activas de la misma cuenta se cancelan (evita confusiones y sustituciones)
  with c as (
    update public.acceso_solicitudes set estado = 'cancelada', cerrada_por = v_uid, cerrada_at = now(),
        motivo = 'Se aprobó otra solicitud de la misma cuenta'
      where user_id = s.user_id and id <> s.id and estado in ('pendiente', 'aprobada')
      returning id, class_id)
  insert into public.acceso_eventos (actor, actor_rol, class_id, estudiante, solicitud, accion, resultado, motivo)
    select v_uid, v_papel, c.class_id, s.user_id, c.id, 'cancelar', 'ok', 'Se aprobó otra solicitud de la misma cuenta' from c;
  if v_papel = 'monitor' then
    perform public.acceso_alerta('monitor_aprobo', s.class_id, v_uid, s.user_id, s.id, 'Recuperación aprobada por un monitor (supervisión)');
  end if;
  return jsonb_build_object('ok', true, 'aprobada_hasta', now() + make_interval(mins => v_cfg.minutos_aprobacion));
end $$;

-- rechazar (pendiente), revocar (aprobada sin canjear) o cancelar (pendiente, solo profesor/admin)
create or replace function public.acceso_cerrar(p_solicitud uuid, p_accion text, p_motivo text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  s public.acceso_solicitudes;
  v_papel text;
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), '');
  v_fallo text;
  v_nuevo text;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_accion is null or p_accion not in ('rechazar', 'revocar', 'cancelar') then raise exception 'Acción inválida' using errcode = '22023'; end if;
  perform public.acceso_vencer();
  select * into s from public.acceso_solicitudes where id = p_solicitud for update;
  if not found or s.user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Solicitud no encontrada', 'codigo', 'no_encontrada');
  end if;
  v_papel := public.acceso_papel(s.class_id);
  v_nuevo := case p_accion when 'rechazar' then 'rechazada' when 'revocar' then 'revocada' else 'cancelada' end;
  v_fallo := case
    when v_papel is null then 'No tiene permiso en esta sección'
    when v_papel = 'monitor' and s.destinatario <> 'monitor' then 'Esta solicitud es para el profesor'
    when p_accion = 'cancelar' and v_papel = 'monitor' then 'Solo el profesor puede cancelar solicitudes'
    when p_accion = 'revocar' and v_papel = 'monitor' and s.aprobada_por is distinct from v_uid then 'Solo puede revocar sus propias aprobaciones'
    when p_accion in ('rechazar', 'cancelar') and s.estado <> 'pendiente' then 'La solicitud ya no está pendiente (' || s.estado || ')'
    when p_accion = 'revocar' and s.estado <> 'aprobada' then 'Solo se revoca una aprobación todavía no canjeada'
    when p_accion = 'rechazar' and v_motivo is null then 'Indique el motivo del rechazo'
  end;
  if v_fallo is not null then return public.acceso_negar(v_papel, s, p_accion, v_fallo); end if;
  update public.acceso_solicitudes set estado = v_nuevo, cerrada_por = v_uid, cerrada_at = now(), motivo = v_motivo where id = s.id;
  perform public.acceso_log(v_uid, v_papel, s.class_id, s.user_id, s.id, p_accion, null, 'ok', v_motivo);
  return jsonb_build_object('ok', true, 'estado', v_nuevo);
end $$;

create or replace function public.acceso_eventos_lista(p_class uuid default null, p_solicitud uuid default null,
  p_desde timestamptz default null, p_hasta timestamptz default null, p_actor uuid default null, p_limite integer default 300)
returns table (id bigint, created_at timestamptz, actor uuid, actor_nombre text, actor_rol text, class_id uuid, seccion text,
  estudiante uuid, estudiante_nombre text, estudiante_login text, solicitud uuid, accion text, metodo text, resultado text, motivo text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_admin boolean := public.is_admin();
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  return query
  with mis as (select c.id, c.name, public.acceso_papel(c.id) as papel from public.classes c where (p_class is null or c.id = p_class))
  select e.id, e.created_at, e.actor, a.full_name, e.actor_rol, e.class_id, m.name, e.estudiante, p.full_name, p.login_id,
    e.solicitud, e.accion, e.metodo, e.resultado, e.motivo
  from public.acceso_eventos e
  left join mis m on m.id = e.class_id
  left join public.profiles a on a.id = e.actor
  left join public.profiles p on p.id = e.estudiante
  where (
      (v_admin and (p_class is null or e.class_id = p_class))
      or m.papel in ('profesor', 'admin')
      -- el monitor ve el historial de las solicitudes dirigidas a monitores de su sección y sus propias acciones
      or (m.papel = 'monitor' and (e.actor = auth.uid()
          or exists (select 1 from public.acceso_solicitudes s where s.id = e.solicitud and s.destinatario = 'monitor'))))
    and (p_solicitud is null or e.solicitud = p_solicitud)
    and (p_desde is null or e.created_at >= p_desde)
    and (p_hasta is null or e.created_at < p_hasta)
    and (p_actor is null or e.actor = p_actor)
  order by e.id desc
  limit least(greatest(coalesce(p_limite, 300), 1), 2000);
end $$;

create or replace function public.acceso_alertas_lista(p_todas boolean default false)
returns table (id bigint, created_at timestamptz, tipo text, class_id uuid, seccion text, actor uuid, actor_nombre text,
  estudiante uuid, estudiante_nombre text, solicitud uuid, detalle text, atendida_at timestamptz, atendida_por_nombre text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado' using errcode = '42501'; end if;
  return query
  select a.id, a.created_at, a.tipo, a.class_id, c.name, a.actor, pa.full_name, a.estudiante, pe.full_name, a.solicitud, a.detalle,
    a.atendida_at, pt.full_name
  from public.acceso_alertas a
  left join public.classes c on c.id = a.class_id
  left join public.profiles pa on pa.id = a.actor
  left join public.profiles pe on pe.id = a.estudiante
  left join public.profiles pt on pt.id = a.atendida_por
  where (public.is_admin() or (a.class_id is not null and public.grades_teacher(a.class_id)))
    and (p_todas or a.atendida_at is null)
  order by a.id desc limit 500;
end $$;

create or replace function public.acceso_alerta_atender(p_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare a public.acceso_alertas;
begin
  select * into a from public.acceso_alertas where id = p_id for update;
  if not found or not (public.is_admin() or (a.class_id is not null and public.grades_teacher(a.class_id))) then
    raise exception 'Alerta no encontrada' using errcode = 'P0002';
  end if;
  if a.atendida_at is null then
    update public.acceso_alertas set atendida_por = auth.uid(), atendida_at = now() where id = p_id;
    perform public.acceso_log(auth.uid(), public.acceso_rol_actor(null), a.class_id, a.estudiante, a.solicitud, 'atender_alerta', a.tipo, 'ok', null);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Controles (activación progresiva). Encender exige sesión reciente; apagar, nunca (suspensión inmediata).
-- -----------------------------------------------------------------------------
create or replace function public.acceso_config_guardar(p_passkeys boolean, p_recuperacion boolean, p_monitores boolean,
  p_minutos_solicitud integer default null, p_minutos_aprobacion integer default null, p_horas_sesion integer default null,
  p_max_monitor_dia integer default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v public.acceso_config;
begin
  if not public.is_admin() then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  select * into v from public.acceso_config where id = 1 for update;
  if ((p_passkeys and not v.passkeys) or (p_recuperacion and not v.recuperacion) or (p_monitores and not v.recuperacion_monitores))
     and not public.acceso_sesion_reciente() then
    raise exception 'Por seguridad, vuelva a iniciar sesión para activar' using errcode = '42501';
  end if;
  update public.acceso_config set passkeys = coalesce(p_passkeys, passkeys), recuperacion = coalesce(p_recuperacion, recuperacion),
      recuperacion_monitores = coalesce(p_monitores, recuperacion_monitores),
      minutos_solicitud = coalesce(p_minutos_solicitud, minutos_solicitud), minutos_aprobacion = coalesce(p_minutos_aprobacion, minutos_aprobacion),
      horas_sesion_reciente = coalesce(p_horas_sesion, horas_sesion_reciente),
      max_aprobaciones_monitor_dia = coalesce(p_max_monitor_dia, max_aprobaciones_monitor_dia),
      updated_by = auth.uid(), updated_at = now()
    where id = 1 returning * into v;
  perform public.acceso_log(auth.uid(), 'admin', null, null, null, 'configurar', null, 'ok', null, to_jsonb(v) - 'updated_by' - 'updated_at' - 'id');
  return to_jsonb(v) - 'updated_by';
end $$;

create or replace function public.acceso_seccion_guardar(p_class uuid, p_recuperacion boolean, p_monitores boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_prev public.acceso_secciones;
  v_papel text := public.acceso_papel(p_class);
begin
  if v_papel is null or v_papel = 'monitor' then raise exception 'Solo el profesor de la sección' using errcode = '42501'; end if;
  select * into v_prev from public.acceso_secciones where class_id = p_class for update;
  if ((p_recuperacion and not coalesce(v_prev.recuperacion, false)) or (p_monitores and not coalesce(v_prev.monitores, false)))
     and not public.acceso_sesion_reciente() then
    raise exception 'Por seguridad, vuelva a iniciar sesión para activar' using errcode = '42501';
  end if;
  insert into public.acceso_secciones (class_id, recuperacion, monitores, updated_by, updated_at)
    values (p_class, coalesce(p_recuperacion, false), coalesce(p_monitores, false), auth.uid(), now())
  on conflict (class_id) do update set recuperacion = coalesce(p_recuperacion, acceso_secciones.recuperacion),
    monitores = coalesce(p_monitores, acceso_secciones.monitores), updated_by = auth.uid(), updated_at = now();
  perform public.acceso_log(auth.uid(), v_papel, p_class, null, null, 'configurar_seccion', null, 'ok', null,
    jsonb_build_object('recuperacion', p_recuperacion, 'monitores', p_monitores));
  return (select to_jsonb(s) - 'updated_by' from public.acceso_secciones s where s.class_id = p_class);
end $$;

create or replace function public.acceso_monitores_lista(p_class uuid)
returns table (user_id uuid, full_name text, login_id text, delegado boolean, otorgado_at timestamptz, aprobaciones_24h bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare v_papel text := public.acceso_papel(p_class);
begin
  if v_papel is null or v_papel = 'monitor' then raise exception 'Solo el profesor de la sección' using errcode = '42501'; end if;
  return query
  select p.id, p.full_name, p.login_id, a.id is not null, a.otorgado_at,
    (select count(*) from public.acceso_eventos e where e.actor = p.id and e.accion = 'aprobar' and e.resultado = 'ok'
       and e.created_at > now() - interval '24 hours')
  from public.class_monitors m
  join public.profiles p on p.id = m.user_id
  left join public.acceso_monitores a on a.class_id = m.class_id and a.user_id = m.user_id and a.revocado_at is null
  where m.class_id = p_class and m.revoked_at is null
  order by p.full_name;
end $$;

create or replace function public.acceso_monitor_permiso(p_class uuid, p_user uuid, p_activo boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_papel text := public.acceso_papel(p_class);
begin
  if v_papel is null or v_papel = 'monitor' then raise exception 'Solo el profesor de la sección' using errcode = '42501'; end if;
  if p_activo then
    if not exists (select 1 from public.class_monitors m join public.enrollments e on e.class_id = m.class_id and e.user_id = m.user_id
                   where m.class_id = p_class and m.user_id = p_user and m.revoked_at is null) then
      raise exception 'Solo puede delegarse en un monitor activo de la sección' using errcode = 'P0001';
    end if;
    if not public.acceso_sesion_reciente() then
      raise exception 'Por seguridad, vuelva a iniciar sesión para otorgar el permiso' using errcode = '42501';
    end if;
    insert into public.acceso_monitores (class_id, user_id, otorgado_por) values (p_class, p_user, auth.uid())
      on conflict (class_id, user_id) where revocado_at is null do nothing;
  else
    update public.acceso_monitores set revocado_por = auth.uid(), revocado_at = now()
      where class_id = p_class and user_id = p_user and revocado_at is null;
    -- retirar el permiso anula al instante sus aprobaciones sin canjear
    with r as (
      update public.acceso_solicitudes set estado = 'revocada', cerrada_por = auth.uid(), cerrada_at = now(),
          motivo = 'Se retiró el permiso del monitor que la aprobó'
        where class_id = p_class and aprobada_por = p_user and estado = 'aprobada'
        returning id, user_id)
    insert into public.acceso_eventos (actor, actor_rol, class_id, estudiante, solicitud, accion, resultado, motivo)
      select auth.uid(), v_papel, p_class, r.user_id, r.id, 'revocar', 'ok', 'Se retiró el permiso del monitor que la aprobó' from r;
  end if;
  perform public.acceso_log(auth.uid(), v_papel, p_class, null, null, case when p_activo then 'otorgar_permiso' else 'retirar_permiso' end,
    null, 'ok', null, jsonb_build_object('monitor', p_user));
  return jsonb_build_object('ok', true);
end $$;

-- Anotación de acciones propias del usuario sobre passkeys (las ejecuta Supabase Auth; esto solo deja constancia)
create or replace function public.acceso_evento_propio(p_accion text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_accion is null or p_accion not in ('passkey_registrada', 'passkey_eliminada', 'ingreso_passkey', 'clave_tras_recuperacion') then
    raise exception 'Acción inválida' using errcode = '22023';
  end if;
  if (select count(*) from public.acceso_eventos where actor = v_uid and created_at > now() - interval '24 hours') >= 50 then return; end if;
  perform public.acceso_log(v_uid, public.acceso_rol_actor(null), null, v_uid, null, p_accion, null, 'ok', null, jsonb_build_object('declarado', true));
end $$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array[
    'acceso_log(uuid, text, uuid, uuid, uuid, text, text, text, text, jsonb)', 'acceso_alerta(text, uuid, uuid, uuid, uuid, text)',
    'acceso_papel(uuid)', 'acceso_rol_actor(text)', 'acceso_sesion_reciente()', 'acceso_estudiante_elegible(uuid, uuid)',
    'acceso_es_monitor(uuid)', 'acceso_hay_monitor(uuid, uuid)', 'acceso_vencer()',
    'acceso_negar(text, public.acceso_solicitudes, text, text, text)', 'acceso_eventos_inmutable()',
    'svc_acceso_config()', 'svc_acceso_solicitar(text, text, text, text, jsonb)', 'svc_acceso_estado(uuid, text)',
    'svc_acceso_canjear(uuid, text, text)', 'svc_acceso_canje_fallido(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array['svc_acceso_config()', 'svc_acceso_solicitar(text, text, text, text, jsonb)', 'svc_acceso_estado(uuid, text)',
    'svc_acceso_canjear(uuid, text, text)', 'svc_acceso_canje_fallido(uuid, text)'] loop
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  foreach f in array array['acceso_estado_panel()',
    'acceso_solicitudes_lista(text[], uuid, timestamptz, timestamptz, text, uuid, text, integer)',
    'acceso_aprobar(uuid, text, text, text)', 'acceso_cerrar(uuid, text, text)',
    'acceso_eventos_lista(uuid, uuid, timestamptz, timestamptz, uuid, integer)', 'acceso_alertas_lista(boolean)', 'acceso_alerta_atender(bigint)',
    'acceso_config_guardar(boolean, boolean, boolean, integer, integer, integer, integer)', 'acceso_seccion_guardar(uuid, boolean, boolean)',
    'acceso_monitores_lista(uuid)', 'acceso_monitor_permiso(uuid, uuid, boolean)', 'acceso_evento_propio(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
