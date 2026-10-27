-- =============================================================================
-- Centro de seguridad — Fase 1: eventos forenses de acceso, dispositivos reconocidos, detecciones, anotaciones.
--
-- Fuente de verdad: los intentos los registra la Edge Function «acceder» (servidor) — el navegador nunca escribe
-- aquí. Se amplía la tabla existente login_attempts (columnas nuevas, sin tocar las antiguas) en lugar de crear
-- otra: una fila = un intento, con identificador único (event_id).
--
-- Procedencia de cada dato (se muestra en el panel):
--   · SERVIDOR (verificado): hora UTC del servidor, resultado/motivo, cuenta, bloqueo y regla, duración,
--     identificador de solicitud, ip_hash (IP cifrada con secreto del servidor; no se guarda la IP).
--   · CABECERA DE RED (sin verificar en este proyecto): país (cf-ipcountry), si la plataforma la envía.
--   · DECLARADO POR EL NAVEGADOR (falsificable): user-agent (navegador, sistema, tipo de dispositivo), idioma,
--     zona horaria, versión de la aplicación, identificador de instalación (aleatorio, en localStorage).
-- No se guardan contraseñas, tokens ni la IP en claro.
--
-- Correcciones:
--   1) Abuso del bloqueo: el bloqueo por ID contaba también los intentos ya rechazados por bloqueo, de modo que
--      un tercero podía mantener bloqueada indefinidamente una cuenta. Ahora solo cuentan los intentos en que se
--      comprobó la credencial (contraseña incorrecta, ID inexistente, cuenta suspendida).
--   2) Incoherencia «fallos < orígenes»: los orígenes se contaban sobre TODOS los intentos (incluidos los
--      correctos) y los fallos solo sobre los fallidos. Ahora cada indicador declara su universo.
-- =============================================================================

alter table public.login_attempts add column if not exists event_id uuid not null default gen_random_uuid();
alter table public.login_attempts add column if not exists request_id uuid;
alter table public.login_attempts add column if not exists rule text;                 -- regla de seguridad aplicada
alter table public.login_attempts add column if not exists duration_ms integer;
alter table public.login_attempts add column if not exists country text;              -- cabecera de red (sin verificar)
alter table public.login_attempts add column if not exists user_agent text;           -- declarado (falsificable)
alter table public.login_attempts add column if not exists browser text;
alter table public.login_attempts add column if not exists os text;
alter table public.login_attempts add column if not exists device_type text;
alter table public.login_attempts add column if not exists client_tz text;
alter table public.login_attempts add column if not exists client_lang text;
alter table public.login_attempts add column if not exists app_version text;
alter table public.login_attempts add column if not exists device_hash text;          -- instalación (cifrada)
create unique index if not exists login_attempts_event_uidx on public.login_attempts (event_id);
create index if not exists login_attempts_time_idx on public.login_attempts (created_at desc);
create index if not exists login_attempts_device_idx on public.login_attempts (device_hash, created_at desc);

-- Dispositivos reconocidos: instalaciones del aula asociadas a una cuenta tras un acceso CORRECTO.
-- Indicio, no prueba de identidad: el identificador local puede borrarse o copiarse.
create table if not exists public.known_devices (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_hash text not null,
  browser text, os text, device_type text,
  first_seen timestamptz not null default now(),
  last_success timestamptz not null default now(),
  success_count integer not null default 1,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  unique (user_id, device_hash)
);

-- Anotaciones del administrador (solo se añaden; nunca modifican la evidencia)
create table if not exists public.security_annotations (
  id bigint generated always as identity primary key,
  event_id uuid,                                    -- intento concreto (opcional)
  login_id text,                                    -- o un identificador entero
  classification text check (classification in ('reconozco', 'no_reconozco', 'no_seguro', 'prueba_autorizada', 'investigado')),
  note text check (note is null or char_length(note) <= 2000),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_session text,                               -- sesión autenticada desde la que se anotó
  created_at timestamptz not null default now(),
  check (event_id is not null or login_id is not null),
  check (classification is not null or note is not null)
);
create index if not exists security_annotations_event_idx on public.security_annotations (event_id);
create index if not exists security_annotations_login_idx on public.security_annotations (login_id, created_at desc);

-- Auditoría de las consultas y acciones del propio centro de seguridad
create table if not exists public.security_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.known_devices enable row level security;
alter table public.security_annotations enable row level security;
alter table public.security_audit enable row level security;
revoke all on public.known_devices, public.security_annotations, public.security_audit from anon, authenticated;

create or replace function public.sec_assert_admin()
returns void language plpgsql stable security definer set search_path = ''
as $$ begin
  if not public.is_admin() then raise exception 'Solo el administrador' using errcode = '42501'; end if;
end $$;

create or replace function public.sec_log(p_action text, p_detail jsonb)
returns void language sql security definer set search_path = ''
as $$ insert into public.security_audit (actor_id, action, detail) values (auth.uid(), p_action, coalesce(p_detail, '{}'::jsonb)) $$;

-- --- corrección 1: el bloqueo por ID solo cuenta contraseñas incorrectas (no los rechazos por bloqueo) -------------
create or replace function public.svc_login_check(p_login text, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_login text := public.normalize_login(p_login);
  v_prof public.profiles;
  v_email text;
  v_fail_id integer;
  v_fail_ip integer;
begin
  if v_login !~ '^[a-z0-9][a-z0-9._-]{2,39}$' then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_format', 'login', v_login, 'rule', 'formato_invalido');
  end if;
  -- también cuentan los IDs inexistentes: así se bloquean igual que los reales y el bloqueo no revela cuáles existen
  select count(*) into v_fail_id from public.login_attempts
    where login_id = v_login and reason in ('bad_password', 'unknown_id', 'suspended') and created_at > now() - interval '15 minutes';
  select count(*) into v_fail_ip from public.login_attempts
    where p_ip_hash is not null and ip_hash = p_ip_hash and reason in ('bad_password', 'unknown_id', 'suspended')
      and created_at > now() - interval '15 minutes';
  if v_fail_id >= 5 then return jsonb_build_object('allowed', false, 'reason', 'locked', 'login', v_login, 'rule', 'id_5_fallos_15min'); end if;
  if v_fail_ip >= 30 then return jsonb_build_object('allowed', false, 'reason', 'rate_ip', 'login', v_login, 'rule', 'origen_30_fallos_15min'); end if;
  select * into v_prof from public.profiles where login_id = v_login;
  if v_prof.id is not null then
    select u.email into v_email from auth.users u where u.id = v_prof.id;
  end if;
  return jsonb_build_object('allowed', true, 'login', v_login, 'user_id', v_prof.id, 'email', v_email,
                            'active', coalesce(v_prof.active, false));
end;
$$;

-- Registro forense (llamado SOLO por la Edge Function con la clave de servicio). p_meta: ver cabecera.
create or replace function public.svc_login_record(p_login text, p_user uuid, p_ip_hash text, p_success boolean, p_reason text, p_meta jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare m jsonb := coalesce(p_meta, '{}'::jsonb);
begin
  insert into public.login_attempts (login_id, user_id, ip_hash, success, reason, request_id, rule, duration_ms, country,
      user_agent, browser, os, device_type, client_tz, client_lang, app_version, device_hash)
    values (left(public.normalize_login(p_login), 60), p_user, p_ip_hash, p_success, p_reason,
      case when m ->> 'request_id' ~ '^[0-9a-f-]{36}$' then (m ->> 'request_id')::uuid end,
      left(m ->> 'rule', 60), least(greatest((m ->> 'duration_ms')::integer, 0), 600000),
      upper(left(m ->> 'country', 2)), left(m ->> 'user_agent', 300), left(m ->> 'browser', 40), left(m ->> 'os', 40),
      left(m ->> 'device_type', 20), left(m ->> 'client_tz', 60), left(m ->> 'client_lang', 20),
      left(m ->> 'app_version', 20), left(m ->> 'device_hash', 64));
  -- acceso correcto desde una instalación: se reconoce (o se actualiza) el dispositivo
  if p_success and p_user is not null and m ->> 'device_hash' is not null then
    insert into public.known_devices (user_id, device_hash, browser, os, device_type)
      values (p_user, left(m ->> 'device_hash', 64), left(m ->> 'browser', 40), left(m ->> 'os', 40), left(m ->> 'device_type', 20))
      on conflict (user_id, device_hash) do update set last_success = now(), success_count = public.known_devices.success_count + 1,
        browser = excluded.browser, os = excluded.os, device_type = excluded.device_type;
  end if;
  -- retención de eventos detallados: 90 días
  delete from public.login_attempts where created_at < now() - interval '90 days';
  return jsonb_build_object('must_change_password',
    coalesce((select must_change_password from public.profiles where id = p_user and p_success), false));
end;
$$;

-- --- corrección 2: indicadores con universo explícito -----------------------------------------------------------
--   fallos     = intentos con contraseña incorrecta, ID inexistente o cuenta suspendida
--   rechazos   = intentos rechazados sin comprobar la contraseña por un bloqueo activo (locked / rate_ip)
--   origenes_fallos = orígenes distintos ENTRE LOS FALLOS (invariante: ≤ fallos)
--   origenes_total  = orígenes distintos entre todos los intentos (fallos + rechazos + correctos)
create or replace function public.admin_suspicious_logins()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'login_id', x.login_id, 'fallos', x.fallos, 'ips', x.origenes_fallos, 'origenes_total', x.origenes_total,
      'ultimo', x.ultimo, 'existe', x.existe, 'bloqueos', x.rechazos, 'correctos', x.correctos
    ) order by x.ultimo desc), '[]'::jsonb)
    from (
      select a.login_id,
        count(*) filter (where a.reason in ('bad_password', 'unknown_id', 'suspended')) as fallos,
        count(distinct a.ip_hash) filter (where a.reason in ('bad_password', 'unknown_id', 'suspended')) as origenes_fallos,
        count(distinct a.ip_hash) as origenes_total,
        count(*) filter (where a.reason in ('locked', 'rate_ip')) as rechazos,
        count(*) filter (where a.success) as correctos,
        max(a.created_at) as ultimo, bool_or(a.user_id is not null) as existe
      from public.login_attempts a
      where a.created_at > now() - interval '72 hours'
      group by a.login_id
      having count(*) filter (where a.reason in ('bad_password', 'unknown_id', 'suspended')) >= 3
    ) x);
end;
$$;

-- --- panel: resumen ---------------------------------------------------------------------------------------------
create or replace function public.sec_overview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare r jsonb;
begin
  perform public.sec_assert_admin();
  with f as (select * from public.login_attempts where created_at > now() - interval '60 days')
  select jsonb_build_object(
    'fallos_24h', count(*) filter (where reason in ('bad_password','unknown_id','suspended') and created_at > now() - interval '24 hours'),
    'fallos_72h', count(*) filter (where reason in ('bad_password','unknown_id','suspended') and created_at > now() - interval '72 hours'),
    'fallos_7d', count(*) filter (where reason in ('bad_password','unknown_id','suspended') and created_at > now() - interval '7 days'),
    'fallos_30d', count(*) filter (where reason in ('bad_password','unknown_id','suspended') and created_at > now() - interval '30 days'),
    'fallos_30d_anterior', count(*) filter (where reason in ('bad_password','unknown_id','suspended') and created_at <= now() - interval '30 days'),
    'ids_afectados_7d', count(distinct login_id) filter (where reason in ('bad_password','unknown_id','suspended') and created_at > now() - interval '7 days'),
    'origenes_7d', count(distinct ip_hash) filter (where created_at > now() - interval '7 days'),
    'dispositivos_7d', count(distinct device_hash) filter (where created_at > now() - interval '7 days'),
    'rechazos_bloqueo_7d', count(*) filter (where reason in ('locked','rate_ip') and created_at > now() - interval '7 days'),
    'correctos_7d', count(*) filter (where success and created_at > now() - interval '7 days'),
    'con_metadatos_7d', count(*) filter (where user_agent is not null and created_at > now() - interval '7 days'),
    'total_7d', count(*) filter (where created_at > now() - interval '7 days'),
    'primer_evento_forense', min(created_at) filter (where request_id is not null)
  ) into r from f;
  perform public.sec_log('consulta_resumen', '{}');
  return r;
end;
$$;

-- --- panel: eventos (con el intervalo respecto al intento anterior del mismo ID) ----------------------------------
create or replace function public.sec_events(p_login text, p_result text, p_from timestamptz, p_to timestamptz, p_limit integer)
returns table (event_id uuid, created_at timestamptz, login_id text, existe boolean, rol text, success boolean, reason text, rule text,
  ip_hash text, country text, browser text, os text, device_type text, client_tz text, client_lang text, app_version text,
  device_hash text, dispositivo_reconocido boolean, duration_ms integer, request_id uuid, segundos_desde_anterior numeric,
  clasificacion text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.sec_assert_admin();
  perform public.sec_log('consulta_eventos', jsonb_build_object('login', p_login, 'resultado', p_result));
  return query
  select a.event_id, a.created_at, a.login_id, a.user_id is not null, p.role::text, a.success, a.reason, a.rule,
    a.ip_hash, a.country, a.browser, a.os, a.device_type, a.client_tz, a.client_lang, a.app_version, a.device_hash,
    exists (select 1 from public.known_devices k where k.user_id = a.user_id and k.device_hash = a.device_hash and k.revoked_at is null
            and k.first_seen < a.created_at),
    a.duration_ms, a.request_id,
    round(extract(epoch from a.created_at - lag(a.created_at) over (partition by a.login_id order by a.created_at))::numeric, 1),
    (select s.classification from public.security_annotations s where s.event_id = a.event_id and s.classification is not null
      order by s.created_at desc limit 1)
  from public.login_attempts a left join public.profiles p on p.id = a.user_id
  where (p_login is null or a.login_id = public.normalize_login(p_login))
    and (p_result is null or (p_result = 'fallo' and a.reason in ('bad_password','unknown_id','suspended'))
         or (p_result = 'bloqueo' and a.reason in ('locked','rate_ip')) or (p_result = 'correcto' and a.success))
    and (p_from is null or a.created_at >= p_from) and (p_to is null or a.created_at <= p_to)
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

-- --- «¿Pude haber sido yo?»: un intento frente al historial de accesos CORRECTOS de la misma cuenta ---------------
create or replace function public.sec_event_context(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare e public.login_attempts; r jsonb;
begin
  perform public.sec_assert_admin();
  select * into e from public.login_attempts where event_id = p_event;
  if not found then raise exception 'Evento no encontrado' using errcode = 'P0002'; end if;
  perform public.sec_log('consulta_evento', jsonb_build_object('event_id', p_event, 'login', e.login_id));
  with ok as (
    select * from public.login_attempts where login_id = e.login_id and success and created_at < e.created_at
      and created_at > e.created_at - interval '90 days'
  ), rafaga as (
    select * from public.login_attempts where login_id = e.login_id and created_at between e.created_at - interval '1 hour' and e.created_at + interval '1 hour'
  )
  select jsonb_build_object(
    'evento', to_jsonb(e) - 'user_agent' || jsonb_build_object('user_agent', e.user_agent),
    'cuenta', (select jsonb_build_object('full_name', p.full_name, 'student_code', p.student_code, 'role', p.role)
               from public.profiles p where p.id = e.user_id),
    'historial_correctos', (select count(*) from ok),
    'navegadores', (select coalesce(jsonb_agg(distinct browser) filter (where browser is not null), '[]') from ok),
    'sistemas', (select coalesce(jsonb_agg(distinct os) filter (where os is not null), '[]') from ok),
    'paises', (select coalesce(jsonb_agg(distinct country) filter (where country is not null), '[]') from ok),
    'origen_visto_en_correctos', exists (select 1 from ok where ip_hash = e.ip_hash and e.ip_hash is not null),
    'dispositivo_reconocido', exists (select 1 from public.known_devices k where k.user_id = e.user_id and k.device_hash = e.device_hash
                                       and k.revoked_at is null and k.first_seen < e.created_at),
    'horas_habituales', (select coalesce(jsonb_agg(h), '[]') from (select distinct extract(hour from created_at at time zone 'America/Santo_Domingo')::int h from ok) z),
    'hora_evento', extract(hour from e.created_at at time zone 'America/Santo_Domingo')::int,
    'rafaga_intentos', (select count(*) from rafaga where not success),
    'rafaga_intervalos', (select coalesce(jsonb_agg(g order by t), '[]') from (
        select created_at t, extract(epoch from created_at - lag(created_at) over (order by created_at)) g from rafaga) z where g is not null),
    'correcto_despues', (select min(created_at) from public.login_attempts where login_id = e.login_id and success
                          and created_at > e.created_at and created_at < e.created_at + interval '2 hours'),
    'ids_mismo_origen_24h', (select count(distinct login_id) from public.login_attempts where e.ip_hash is not null and ip_hash = e.ip_hash
                              and created_at between e.created_at - interval '24 hours' and e.created_at + interval '1 hour'),
    'anotaciones', (select coalesce(jsonb_agg(jsonb_build_object('classification', s.classification, 'note', s.note, 'created_at', s.created_at,
                      'actor', (select full_name from public.profiles where id = s.actor_id)) order by s.created_at desc), '[]')
                    from public.security_annotations s where s.event_id = e.event_id or (s.event_id is null and s.login_id = e.login_id))
  ) into r;
  return r;
end;
$$;

-- --- detecciones basadas en reglas (auditables) ------------------------------------------------------------------
create or replace function public.sec_detections(p_hours integer)
returns table (regla text, severidad text, sujeto text, eventos bigint, detalle jsonb, desde timestamptz, hasta timestamptz,
  limitaciones text, accion text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_desde timestamptz := now() - make_interval(hours => least(greatest(coalesce(p_hours, 72), 1), 720));
begin
  perform public.sec_assert_admin();
  return query
  with a as (select x.*, p.role::text rol from public.login_attempts x left join public.profiles p on p.id = x.user_id where x.created_at > v_desde),
  fallos as (select * from a where reason in ('bad_password','unknown_id','suspended'))
  -- A. fuerza bruta: ≥ 10 fallos contra un mismo ID en 1 h
  select 'fuerza_bruta', case when max(f.rol) in ('admin','teacher') then 'critica' else 'alta' end, f.login_id, count(*),
    jsonb_build_object('origenes', count(distinct f.ip_hash)), min(f.created_at), max(f.created_at),
    'Un usuario legítimo que olvidó su contraseña también puede acumular fallos.', 'Revisar la cronología; si no reconoce la actividad, restablecer la contraseña.'
  from fallos f group by f.login_id, date_trunc('hour', f.created_at) having count(*) >= 10
  union all
  -- B/D. rociado o enumeración: un origen prueba ≥ 5 identificadores distintos
  select case when count(*) filter (where f.reason = 'unknown_id') >= 3 then 'enumeracion_identificadores' else 'rociado_de_contrasenas' end,
    'alta', 'origen ' || left(f.ip_hash, 8), count(*), jsonb_build_object('identificadores', count(distinct f.login_id),
      'inexistentes', count(*) filter (where f.reason = 'unknown_id')), min(f.created_at), max(f.created_at),
    'Varios estudiantes pueden compartir una red (laboratorio, casa, operador móvil con NAT).', 'Comprobar si el origen coincide con una red institucional antes de actuar.'
  from fallos f where f.ip_hash is not null group by f.ip_hash having count(distinct f.login_id) >= 5
  union all
  -- F. distribuido: un mismo ID recibe fallos desde ≥ 4 orígenes distintos
  select 'ataque_distribuido', 'moderada', f.login_id, count(*), jsonb_build_object('origenes', count(distinct f.ip_hash)),
    min(f.created_at), max(f.created_at), 'Cambiar de wifi a datos móviles también cambia el origen.', 'Revisar dispositivos y países de los intentos.'
  from fallos f group by f.login_id having count(distinct f.ip_hash) >= 4 and count(*) >= 6
  union all
  -- G. abuso del bloqueo: ≥ 3 rechazos por bloqueo sobre un ID
  select 'abuso_de_bloqueo', 'moderada', x.login_id, count(*), jsonb_build_object('origenes', count(distinct x.ip_hash)),
    min(x.created_at), max(x.created_at), 'Puede ser el propio titular insistiendo.', 'Verificar con el titular; el bloqueo ya no se prolonga con estos rechazos.'
  from a x where x.reason in ('locked','rate_ip') group by x.login_id having count(*) >= 3
  union all
  -- H. acceso correcto precedido por ≥ 5 fallos en la hora anterior
  select 'acceso_tras_fallos', case when s.rol in ('admin','teacher') then 'alta' else 'moderada' end, s.login_id,
    (select count(*) from fallos f2 where f2.login_id = s.login_id and f2.created_at between s.created_at - interval '1 hour' and s.created_at),
    jsonb_build_object('origen_distinto_a_los_fallos', not exists (select 1 from fallos f3 where f3.login_id = s.login_id and f3.ip_hash = s.ip_hash
       and f3.created_at between s.created_at - interval '1 hour' and s.created_at)),
    s.created_at - interval '1 hour', s.created_at, 'Lo más común es que el titular recordara la contraseña.', 'Confirmar con el titular si el contexto es inusual.'
  from a s where s.success and (select count(*) from fallos f2 where f2.login_id = s.login_id and f2.created_at between s.created_at - interval '1 hour' and s.created_at) >= 5
  union all
  -- J. cuentas privilegiadas: cualquier racha de ≥ 3 fallos
  select 'cuenta_privilegiada', 'alta', f.login_id, count(*), jsonb_build_object('origenes', count(distinct f.ip_hash), 'rol', max(f.rol)),
    min(f.created_at), max(f.created_at), 'Puede ser usted mismo escribiendo mal la contraseña.', 'Use «¿Pude haber sido yo?» sobre estos intentos.'
  from fallos f where f.rol in ('admin','teacher') group by f.login_id having count(*) >= 3;
end;
$$;

-- --- anotaciones, dispositivos -------------------------------------------------------------------------------------
create or replace function public.sec_annotate(p_event uuid, p_login text, p_classification text, p_note text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.sec_assert_admin();
  insert into public.security_annotations (event_id, login_id, classification, note, actor_id, actor_session)
    values (p_event, public.normalize_login(p_login), p_classification, nullif(btrim(p_note), ''), auth.uid(), auth.jwt() ->> 'session_id');
  perform public.sec_log('anotacion', jsonb_build_object('event_id', p_event, 'login', p_login, 'clasificacion', p_classification));
end;
$$;

create or replace function public.sec_devices(p_login text)
returns table (id bigint, browser text, os text, device_type text, first_seen timestamptz, last_success timestamptz, success_count integer,
  revoked_at timestamptz, fallos_desde_este integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.sec_assert_admin();
  return query select k.id, k.browser, k.os, k.device_type, k.first_seen, k.last_success, k.success_count, k.revoked_at,
    (select count(*)::integer from public.login_attempts a where a.device_hash = k.device_hash and a.reason in ('bad_password','unknown_id','suspended'))
  from public.known_devices k join public.profiles p on p.id = k.user_id
  where p.login_id = public.normalize_login(p_login) order by k.last_success desc;
end;
$$;

create or replace function public.sec_revoke_device(p_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.sec_assert_admin();
  update public.known_devices set revoked_at = now(), revoked_by = auth.uid() where id = p_id and revoked_at is null;
  perform public.sec_log('revocar_dispositivo', jsonb_build_object('device', p_id));
end;
$$;

revoke all on function public.svc_login_record(text, uuid, text, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.svc_login_record(text, uuid, text, boolean, text, jsonb) to service_role;
revoke all on function public.sec_assert_admin() from public, anon, authenticated;
revoke all on function public.sec_log(text, jsonb) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['sec_overview()', 'sec_events(text, text, timestamptz, timestamptz, integer)', 'sec_event_context(uuid)',
    'sec_detections(integer)', 'sec_annotate(uuid, text, text, text)', 'sec_devices(text)', 'sec_revoke_device(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
