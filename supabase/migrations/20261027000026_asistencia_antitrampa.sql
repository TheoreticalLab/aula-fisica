-- =============================================================================
-- Asistencia: medidas contra la asistencia desde fuera del aula.
--
--   1) CÓDIGO ROTATIVO: el código cambia cada N segundos (30 por defecto). Se deriva de un secreto de la sesión y
--      de la ventana de tiempo (como los códigos de verificación de las apps autenticadoras). Se acepta el código
--      de la ventana actual y el de la anterior (margen para quien lo está escribiendo).
--   2) UBICACIÓN: al abrir, el dispositivo del profesor envía su ubicación. El estudiante envía la suya al marcar
--      y el servidor calcula la distancia: si está claramente fuera del radio, se RECHAZA y queda registrado el
--      intento. Si la precisión es mala se acepta como «imprecisa» (visible para el profesor). Si la sesión exige
--      ubicación y el estudiante no la comparte, se rechaza.
--   3) UN DISPOSITIVO, UN ESTUDIANTE: el identificador de instalación (aleatorio, del navegador) no puede marcar a
--      dos estudiantes en la misma asistencia.
--   4) REVISIÓN: el profesor ve, por estudiante, la verificación (distancia, precisión) y los intentos rechazados.
-- Limitación declarada: la ubicación del navegador y el identificador de instalación pueden falsearse con
-- conocimientos técnicos; las medidas impiden lo habitual (dictar el código a quien está fuera).
-- Aditiva: columnas nuevas con valores por defecto, una tabla y funciones nuevas o redefinidas con la misma firma.
-- =============================================================================

alter table public.attendance_sessions add column if not exists rotate_seconds integer not null default 0 check (rotate_seconds in (0, 15, 30, 60, 120));
alter table public.attendance_sessions add column if not exists secret text not null default encode(extensions.gen_random_bytes(16), 'hex');
alter table public.attendance_sessions add column if not exists geo_lat double precision;
alter table public.attendance_sessions add column if not exists geo_lng double precision;
alter table public.attendance_sessions add column if not exists geo_accuracy double precision;
alter table public.attendance_sessions add column if not exists geo_radius_m integer not null default 100 check (geo_radius_m between 20 and 2000);
alter table public.attendance_sessions add column if not exists require_location boolean not null default false;

alter table public.attendance_records add column if not exists lat double precision;
alter table public.attendance_records add column if not exists lng double precision;
alter table public.attendance_records add column if not exists accuracy double precision;
alter table public.attendance_records add column if not exists distance_m integer;
alter table public.attendance_records add column if not exists geo_status text check (geo_status is null or geo_status in ('verificado', 'impreciso', 'sin_ubicacion', 'sin_referencia'));
alter table public.attendance_records add column if not exists device_hash text;

create table if not exists public.attendance_rejections (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('lejos', 'sin_ubicacion', 'dispositivo_compartido')),
  distance_m integer,
  accuracy double precision,
  created_at timestamptz not null default now()
);
create index if not exists attendance_rejections_session_idx on public.attendance_rejections (session_id, created_at desc);
alter table public.attendance_rejections enable row level security;
revoke all on public.attendance_rejections from anon, authenticated;

-- Código de una sesión en una ventana de tiempo (fijo si rotate_seconds = 0)
create or replace function public.attendance_code_at(p_session uuid, p_window bigint)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when s.rotate_seconds = 0 then s.code else
    lpad(((('x' || substr(encode(sha256(convert_to(s.secret || ':' || p_window::text, 'UTF8')), 'hex'), 1, 12))::bit(48)::bigint) % 1000000)::text, 6, '0')
  end
  from public.attendance_sessions s where s.id = p_session
$$;

create or replace function public.attendance_window(p_rotate integer)
returns bigint
language sql stable set search_path = ''
as $$ select case when coalesce(p_rotate, 0) = 0 then 0 else floor(extract(epoch from now()) / p_rotate)::bigint end $$;

-- Distancia en metros (fórmula del semiverseno)
create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Abrir con las opciones anti-trampa (el anterior attendance_open sigue existiendo: código fijo, sin ubicación)
create or replace function public.attendance_start(p_class uuid, p_minutes integer, p_rotate integer,
  p_lat double precision, p_lng double precision, p_accuracy double precision, p_require_location boolean, p_radius integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_exp timestamptz;
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then raise exception 'Ubicación no válida' using errcode = '22023'; end if;
  if coalesce(p_require_location, false) and p_lat is null then
    raise exception 'Para exigir la ubicación de los estudiantes, su dispositivo debe compartir la suya' using errcode = '22023';
  end if;
  update public.attendance_sessions set closed_at = now() where class_id = p_class and closed_at is null;
  v_exp := now() + make_interval(mins => least(greatest(coalesce(p_minutes, 10), 1), 180));
  insert into public.attendance_sessions (class_id, code, opened_by, code_expires_at, rotate_seconds, geo_lat, geo_lng, geo_accuracy, geo_radius_m, require_location)
    values (p_class, public.attendance_random_code(), auth.uid(), v_exp, coalesce(p_rotate, 30), p_lat, p_lng, p_accuracy,
            coalesce(p_radius, 100), coalesce(p_require_location, false))
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'code_expires_at', v_exp);
end;
$$;

-- Actualizar la ubicación de referencia (p. ej. si el profesor la concede después de abrir)
create or replace function public.attendance_set_location(p_session uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.attendance_assert_teacher(p_session);
  if p_lat is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Ubicación no válida' using errcode = '22023'; end if;
  update public.attendance_sessions set geo_lat = p_lat, geo_lng = p_lng, geo_accuracy = p_accuracy where id = p_session;
end;
$$;

-- Vista en vivo (misma firma que en la migración 24): código vigente, rotación, verificación y rechazos
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
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'student_code', p.student_code,
        'presente', r2.user_id is not null, 'marked_at', r2.marked_at, 'method', r2.method, 'geo_status', r2.geo_status,
        'distance_m', r2.distance_m, 'accuracy', round(r2.accuracy::numeric)) order by r2.marked_at nulls last, p.full_name), '[]')
      from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
      left join public.attendance_records r2 on r2.session_id = s.id and r2.user_id = p.id
      where e.class_id = s.class_id),
    'rechazos', (select coalesce(jsonb_agg(jsonb_build_object('full_name', p.full_name, 'student_code', p.student_code, 'motivo', x.reason,
        'distance_m', x.distance_m, 'accuracy', round(x.accuracy::numeric), 'fecha', x.created_at) order by x.created_at desc), '[]')
      from public.attendance_rejections x join public.profiles p on p.id = x.user_id where x.session_id = s.id))
  into r
  from public.attendance_sessions s join public.classes c on c.id = s.class_id join public.courses co on co.id = c.course_id
  where s.id = p_session;
  return r;
end;
$$;

-- Marcar presente con verificación (ubicación e identificador de instalación opcionales según la sesión)
create or replace function public.attendance_check_in(p_code text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_install text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  v_dev text := case when p_install ~ '^[0-9a-fA-F-]{16,64}$' then left(encode(sha256(convert_to(lower(p_install), 'UTF8')), 'hex'), 32) end;
  s record; v_d double precision; v_status text; v_acc double precision; v_nuevos integer := 0; v_clases text[] := '{}'; v_rechazo text;
  v_coinciden integer := 0;
begin
  if v_uid is null or not public.my_account_ok() then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if (select count(*) from public.attendance_failures f where f.user_id = v_uid and f.created_at > now() - interval '15 minutes') >= 6 then
    raise exception 'Demasiados códigos incorrectos. Espere unos minutos o avise al profesor.' using errcode = 'P0001';
  end if;
  if v_code !~ '^[0-9]{6}$' then raise exception 'El código tiene 6 cifras' using errcode = '22023'; end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then raise exception 'Ubicación no válida' using errcode = '22023'; end if;

  for s in
    select x.*, c.name cname from public.attendance_sessions x join public.classes c on c.id = x.class_id
    join public.enrollments e on e.class_id = x.class_id and e.user_id = v_uid
    where x.closed_at is null and x.code_expires_at > now()
      and (v_code = public.attendance_code_at(x.id, public.attendance_window(x.rotate_seconds))
           or (x.rotate_seconds > 0 and v_code = public.attendance_code_at(x.id, public.attendance_window(x.rotate_seconds) - 1)))
  loop
    v_coinciden := v_coinciden + 1;
    if exists (select 1 from public.attendance_records r where r.session_id = s.id and r.user_id = v_uid) then
      v_clases := v_clases || s.cname;
      continue;
    end if;
    v_rechazo := null; v_d := null; v_acc := least(coalesce(p_accuracy, 99999), 99999);
    -- ubicación
    if s.geo_lat is null then
      v_status := 'sin_referencia';
    elsif p_lat is null then
      v_status := 'sin_ubicacion';
      if s.require_location then v_rechazo := 'sin_ubicacion'; end if;
    else
      v_d := public.geo_distance_m(s.geo_lat, s.geo_lng, p_lat, p_lng);
      -- fuera si ni siquiera el círculo de precisión (acotado a 1 km) alcanza el radio del aula
      if v_d - least(v_acc, 1000) > s.geo_radius_m + least(coalesce(s.geo_accuracy, 0), 200) then
        v_rechazo := 'lejos';
      elsif v_acc > 300 then
        v_status := 'impreciso';
      else
        v_status := 'verificado';
      end if;
    end if;
    -- un dispositivo, un estudiante
    if v_rechazo is null and v_dev is not null and exists (
        select 1 from public.attendance_records r where r.session_id = s.id and r.device_hash = v_dev and r.user_id <> v_uid) then
      v_rechazo := 'dispositivo_compartido';
    end if;
    if v_rechazo is not null then
      -- se registran hasta 10 rechazos por estudiante y asistencia (suficiente como evidencia, sin inundar la lista)
      if (select count(*) from public.attendance_rejections x where x.session_id = s.id and x.user_id = v_uid) < 10 then
        insert into public.attendance_rejections (session_id, user_id, reason, distance_m, accuracy)
          values (s.id, v_uid, v_rechazo, round(v_d)::integer, p_accuracy);
      end if;
      continue;
    end if;
    insert into public.attendance_records (session_id, user_id, method, lat, lng, accuracy, distance_m, geo_status, device_hash)
      values (s.id, v_uid, 'codigo', p_lat, p_lng, p_accuracy, round(v_d)::integer, v_status, v_dev);
    v_nuevos := v_nuevos + 1;
    v_clases := v_clases || s.cname;
  end loop;

  if v_coinciden = 0 then
    -- ningún código coincidió: se registra el fallo (se devuelve, no se lanza, para que cuente para el límite)
    insert into public.attendance_failures (user_id) values (v_uid);
    delete from public.attendance_failures where created_at < now() - interval '1 day';
    return jsonb_build_object('ok', false, 'error', 'Código incorrecto o vencido. Si el código cambia cada pocos segundos, escriba el que se ve ahora.');
  end if;
  if v_nuevos = 0 and cardinality(v_clases) = 0 then
    return jsonb_build_object('ok', false, 'error', case v_rechazo
      when 'lejos' then 'Su ubicación está fuera del aula (a unos ' || round(v_d)::text || ' m). Si está en el aula, active la ubicación precisa (GPS) e inténtelo de nuevo, o avise al profesor.'
      when 'sin_ubicacion' then 'Esta asistencia exige compartir su ubicación. Permita el acceso a la ubicación en el navegador e inténtelo de nuevo.'
      else 'Este dispositivo ya marcó la asistencia de otro estudiante. Cada estudiante debe marcar desde su propio dispositivo.' end);
  end if;
  return jsonb_build_object('ok', true, 'clases', to_jsonb(v_clases), 'nuevo', v_nuevos > 0);
end;
$$;

-- El anterior attendance_mark (misma firma) pasa por la verificación nueva, sin ubicación ni dispositivo
create or replace function public.attendance_mark(p_code text)
returns jsonb
language sql security definer set search_path = ''
as $$ select public.attendance_check_in(p_code, null, null, null, null) $$;

revoke all on function public.attendance_code_at(uuid, bigint) from public, anon, authenticated;
revoke all on function public.attendance_window(integer) from public, anon, authenticated;
revoke all on function public.geo_distance_m(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.geo_distance_m(double precision, double precision, double precision, double precision) to authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'attendance_start(uuid, integer, integer, double precision, double precision, double precision, boolean, integer)',
    'attendance_set_location(uuid, double precision, double precision, double precision)',
    'attendance_check_in(text, double precision, double precision, double precision, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
