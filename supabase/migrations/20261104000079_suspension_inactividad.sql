-- =============================================================================
-- Migración 79 · Suspensión automática de cuentas de ESTUDIANTES inactivas (10 días por defecto).
--
--  · «Uso» = tener el aula abierta con la sesión iniciada: lo registra el latido de conexión que el aula ya envía
--    (presence_ping → presence_connections, también en versiones anteriores del aula) y cuenta_presencia().
--    El inicio de sesión NO cuenta como uso (quien vuelve tras 10 días queda suspendido al entrar).
--  · Una cuenta de estudiante sin uso durante N días (contados desde el último uso, desde la creación de la cuenta
--    o desde que se activó la regla, lo más reciente) deja de estar habilitada: account_ok (copia de la migración 64)
--    añade la condición, igual que el bloqueo de la regularización. Al volver, cuenta_presencia() la marca como
--    suspendida (profiles.active = false) y el aula le explica cómo reactivarla; el profesor puede marcar todas las
--    vencidas con inactividad_aplicar().
--  · Profesores y administradores: nunca.
--  · Reactivación: el profesor (inactividad_reactivar o «Reactivar» de Cuentas) o el propio estudiante con
--    «Recuperar acceso» (verificación presencial, migración 77): acceso_estudiante_elegible y svc_acceso_canjear
--    (copias de la 77) aceptan las cuentas suspendidas POR INACTIVIDAD (no las suspendidas por el administrador,
--    que además están bloqueadas en Supabase Auth). Toda reactivación reinicia el contador.
--  · Interruptor apagado por defecto; al activarlo (o reactivarlo tras una pausa, p. ej. vacaciones) todos tienen
--    N días desde ese momento.
-- Aditiva: tablas nuevas, funciones nuevas, dos disparadores y copias ampliadas de funciones existentes.
-- =============================================================================

create table if not exists public.inactividad_config (
  id smallint primary key default 1 check (id = 1),
  activo boolean not null default false,
  dias integer not null default 10 check (dias between 3 and 365),
  activado_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.inactividad_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.cuenta_actividad (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  ultimo_uso timestamptz not null default now()
);

create table if not exists public.cuenta_suspensiones (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  motivo text not null default 'inactividad' check (motivo in ('inactividad')),
  ultimo_uso timestamptz,
  dias integer not null,
  suspendida_at timestamptz not null default now(),
  reactivada_at timestamptz,
  reactivada_por uuid references public.profiles (id) on delete set null,
  reactivada_via text check (reactivada_via in ('profesor', 'recuperacion'))
);
create index if not exists cuenta_suspensiones_abiertas on public.cuenta_suspensiones (user_id) where reactivada_at is null;

alter table public.inactividad_config enable row level security;
alter table public.cuenta_actividad enable row level security;
alter table public.cuenta_suspensiones enable row level security;
revoke all on public.inactividad_config, public.cuenta_actividad, public.cuenta_suspensiones from anon, authenticated;

-- Referencia del contador: lo más reciente entre el último uso, la creación de la cuenta y la activación de la regla
create or replace function public.inactividad_referencia(p_user uuid)
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select greatest(coalesce((select a.ultimo_uso from public.cuenta_actividad a where a.user_id = p_user), '-infinity'::timestamptz),
                  coalesce(c.activado_at, '-infinity'::timestamptz), coalesce(p.created_at, '-infinity'::timestamptz))
  from public.inactividad_config c, public.profiles p where c.id = 1 and p.id = p_user
$$;

-- ¿Venció el plazo de inactividad de esta cuenta? (solo estudiantes, solo con la regla activa)
create or replace function public.inactividad_vencida(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- se evalúa en cada comprobación de cuenta (account_ok): con la regla apagada no consulta nada más; activa, una sola consulta
  select case when not c.activo then false else coalesce((
    select p.role::text = 'student'
       and now() - greatest(coalesce(a.ultimo_uso, '-infinity'::timestamptz), coalesce(c.activado_at, '-infinity'::timestamptz),
                            coalesce(p.created_at, '-infinity'::timestamptz)) >= make_interval(days => c.dias)
    from public.profiles p left join public.cuenta_actividad a on a.user_id = p.id where p.id = p_user), false) end
  from public.inactividad_config c where c.id = 1
$$;

-- ¿Está suspendida POR INACTIVIDAD (y no por otra razón)?
create or replace function public.inactividad_suspendida(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.cuenta_suspensiones s join public.profiles p on p.id = s.user_id
                 where s.user_id = p_user and s.reactivada_at is null and not p.active)
$$;

-- Marca la suspensión (idempotente). Devuelve true si la cuenta quedó suspendida ahora.
create or replace function public.inactividad_suspender(p_user uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_dias integer := (select dias from public.inactividad_config where id = 1);
begin
  if not public.inactividad_vencida(p_user) then return false; end if;
  update public.profiles set active = false, suspended_at = now() where id = p_user and active;
  if not found then return false; end if;
  insert into public.cuenta_suspensiones (user_id, ultimo_uso, dias)
    values (p_user, (select ultimo_uso from public.cuenta_actividad where user_id = p_user), v_dias);
  return true;
end $$;

-- Registro de uso (máximo una escritura cada 5 min por cuenta)
create or replace function public.inactividad_registrar_uso(p_user uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.cuenta_actividad (user_id, ultimo_uso) values (p_user, now())
  on conflict (user_id) do update set ultimo_uso = now() where public.cuenta_actividad.ultimo_uso < now() - interval '5 minutes'
$$;

-- El latido de conexión del aula (presence_ping, solo cuentas habilitadas) registra el uso
create or replace function public.inactividad_presencia_trg()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.inactividad_registrar_uso(new.user_id);
  return new;
end $$;
drop trigger if exists inactividad_presencia on public.presence_connections;
create trigger inactividad_presencia after insert or update on public.presence_connections
  for each row execute function public.inactividad_presencia_trg();

-- Toda reactivación (Cuentas, recuperación, restablecer contraseña) cierra la suspensión y reinicia el contador
create or replace function public.inactividad_reactivacion_trg()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.cuenta_actividad (user_id, ultimo_uso) values (new.id, now())
    on conflict (user_id) do update set ultimo_uso = now();
  update public.cuenta_suspensiones set reactivada_at = now(), reactivada_por = auth.uid(),
      reactivada_via = case when coalesce(current_setting('aula.reactivacion', true), '') = 'recuperacion' then 'recuperacion' else 'profesor' end
    where user_id = new.id and reactivada_at is null;
  return new;
end $$;
drop trigger if exists inactividad_reactivacion on public.profiles;
create trigger inactividad_reactivacion after update of active on public.profiles
  for each row when (old.active = false and new.active = true) execute function public.inactividad_reactivacion_trg();

-- Estudiante (sin exigir cuenta habilitada): registra el uso o, si venció el plazo, marca la suspensión y lo explica
create or replace function public.cuenta_presencia()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); p public.profiles; c public.inactividad_config;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into p from public.profiles where id = v_uid;
  select * into c from public.inactividad_config where id = 1;
  if p.role::text <> 'student' then return jsonb_build_object('suspendida', false); end if;
  if public.inactividad_vencida(v_uid) then perform public.inactividad_suspender(v_uid); end if;
  if public.inactividad_suspendida(v_uid) then
    return jsonb_build_object('suspendida', true, 'motivo', 'inactividad', 'dias', c.dias,
      'ultimo_uso', (select ultimo_uso from public.cuenta_suspensiones where user_id = v_uid and reactivada_at is null order by id desc limit 1));
  end if;
  if not p.active then return jsonb_build_object('suspendida', true, 'motivo', 'profesor'); end if;
  perform public.inactividad_registrar_uso(v_uid);
  return jsonb_build_object('suspendida', false, 'regla', case when c.activo then c.dias end);
end $$;

-- Profesorado: configuración (solo el administrador la cambia). Activar o reanudar = todos tienen N días desde ahora.
create or replace function public.inactividad_estado()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado' using errcode = '42501'; end if;
  return (select to_jsonb(c) - 'updated_by' - 'id' from public.inactividad_config c where c.id = 1);
end $$;

create or replace function public.inactividad_configurar(p_activo boolean, p_dias integer default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare c public.inactividad_config;
begin
  if not public.is_admin() then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  if p_dias is not null and (p_dias < 3 or p_dias > 365) then raise exception 'Los días deben estar entre 3 y 365' using errcode = '22023'; end if;
  select * into c from public.inactividad_config where id = 1 for update;
  update public.inactividad_config set activo = coalesce(p_activo, activo), dias = coalesce(p_dias, dias),
      activado_at = case when coalesce(p_activo, activo) and not c.activo then now() else activado_at end,
      updated_by = auth.uid(), updated_at = now()
    where id = 1;
  return public.inactividad_estado();
end $$;

-- Estudiantes y su inactividad (administrador: todos; profesor: los de sus secciones)
create or replace function public.inactividad_lista()
returns table (user_id uuid, full_name text, login_id text, secciones text, ultimo_uso timestamptz, referencia timestamptz,
  dias_sin_uso integer, estado text, suspendida_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare v_admin boolean := public.is_admin();
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado' using errcode = '42501'; end if;
  return query
  select p.id, p.full_name, p.login_id,
    (select string_agg(distinct c.name, ', ') from public.enrollments e join public.classes c on c.id = e.class_id and not c.archived where e.user_id = p.id),
    a.ultimo_uso, public.inactividad_referencia(p.id),
    floor(extract(epoch from (now() - public.inactividad_referencia(p.id))) / 86400)::integer,
    case when public.inactividad_suspendida(p.id) then 'suspendida_inactividad'
         when not p.active then 'suspendida'
         when public.inactividad_vencida(p.id) then 'vencida'
         else 'activa' end,
    (select s.suspendida_at from public.cuenta_suspensiones s where s.user_id = p.id and s.reactivada_at is null order by s.id desc limit 1)
  from public.profiles p
  left join public.cuenta_actividad a on a.user_id = p.id
  where p.role::text = 'student'
    and (v_admin or exists (select 1 from public.enrollments e where e.user_id = p.id and public.is_class_teacher(e.class_id)))
  order by 7 desc nulls last, p.full_name;
end $$;

-- Administrador: marcar ya como suspendidas todas las cuentas con el plazo vencido
create or replace function public.inactividad_aplicar()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_n integer := 0; r record;
begin
  if not public.is_admin() then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  for r in select p.id from public.profiles p where p.role::text = 'student' and p.active and public.inactividad_vencida(p.id) loop
    if public.inactividad_suspender(r.id) then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;

-- Reactivar cuentas suspendidas por inactividad (o vencidas sin marcar): administrador o profesor de su sección.
-- No toca las suspendidas por el administrador (esas se reactivan en Cuentas).
create or replace function public.inactividad_reactivar(p_users uuid[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_n integer := 0; u uuid;
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado' using errcode = '42501'; end if;
  foreach u in array coalesce(p_users, '{}'::uuid[]) loop
    if not (public.is_admin() or exists (select 1 from public.enrollments e where e.user_id = u and public.is_class_teacher(e.class_id))) then continue; end if;
    if public.inactividad_suspendida(u) then
      update public.profiles set active = true, suspended_at = null where id = u;   -- el disparador cierra la suspensión
      v_n := v_n + 1;
    elsif public.inactividad_vencida(u) and exists (select 1 from public.profiles where id = u and active) then   -- vencida sin marcar
      insert into public.cuenta_actividad (user_id, ultimo_uso) values (u, now()) on conflict (user_id) do update set ultimo_uso = now();
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- account_ok: copia de la migración 64 + plazo de inactividad
create or replace function public.account_ok(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select active and not must_change_password from public.profiles where id = p_user), false)
    and (public.hist_exento() or not public.hist_bloqueado(p_user))
    -- migración 79: estudiante sin usar el aula durante el plazo (fuera de las peticiones REST, p. ej. scripts, no se aplica)
    and (coalesce(current_setting('request.path', true), '') = '' or not public.inactividad_vencida(p_user))
$$;

-- acceso_estudiante_elegible: copia de la migración 77 + cuentas suspendidas por inactividad
create or replace function public.acceso_estudiante_elegible(p_user uuid, p_class uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.enrollments e on e.user_id = p.id and e.class_id = p_class
    join public.classes c on c.id = e.class_id and not c.archived
    join public.acceso_secciones s on s.class_id = c.id and s.recuperacion
    join auth.users u on u.id = p.id
    where p.id = p_user and p.role::text = 'student' and (p.active or public.inactividad_suspendida(p.id))
      and (u.banned_until is null or u.banned_until <= now()) and u.deleted_at is null)
$$;

-- svc_acceso_canjear: copia de la migración 77 + reactivación de la suspensión por inactividad
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
  -- migración 79: una cuenta suspendida por inactividad se reactiva con la verificación presencial; el contador se reinicia
  perform set_config('aula.reactivacion', 'recuperacion', true);
  update public.profiles set active = true, suspended_at = null where id = s.user_id and not active and public.inactividad_suspendida(s.user_id);
  insert into public.cuenta_actividad (user_id, ultimo_uso) values (s.user_id, now()) on conflict (user_id) do update set ultimo_uso = now();
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

-- svc_acceso_config: copia de la migración 77 + plazo de inactividad (para el aviso de la pantalla de ingreso)
create or replace function public.svc_acceso_config()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('passkeys', c.passkeys, 'recuperacion', c.recuperacion,
    'monitores', c.recuperacion and c.recuperacion_monitores, 'minutos_solicitud', c.minutos_solicitud,
    'inactividad_dias', (select case when i.activo then i.dias end from public.inactividad_config i where i.id = 1))
  from public.acceso_config c where c.id = 1
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['inactividad_referencia(uuid)', 'inactividad_vencida(uuid)', 'inactividad_suspendida(uuid)', 'inactividad_suspender(uuid)',
    'inactividad_registrar_uso(uuid)', 'inactividad_presencia_trg()', 'inactividad_reactivacion_trg()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array['cuenta_presencia()', 'inactividad_estado()', 'inactividad_configurar(boolean, integer)', 'inactividad_lista()',
    'inactividad_aplicar()', 'inactividad_reactivar(uuid[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
