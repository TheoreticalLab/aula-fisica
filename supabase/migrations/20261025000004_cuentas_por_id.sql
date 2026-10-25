-- =============================================================================
-- Aula Virtual · 4. Cuentas gestionadas por el administrador e inicio de sesión con ID
-- =============================================================================
-- Migración ADITIVA: añade columnas, tablas y funciones; redefine funciones existentes con
-- «create or replace». No borra tablas, columnas ni filas.
--
-- Diseño:
--  * Supabase Auth sigue guardando contraseñas (bcrypt) y sesiones. Cada cuenta tiene un correo
--    técnico aleatorio que nadie usa ni ve; el estudiante entra con su ID (profiles.login_id).
--  * La Edge Function «acceder» traduce ID → cuenta en el servidor, aplica límites de intentos,
--    registra los intentos y devuelve la sesión. La Edge Function «admin-cuentas» crea cuentas,
--    restablece contraseñas y suspende (solo administradores; usa la clave service_role del servidor).
--  * Cuentas creadas fuera del panel (registro público, si alguien lo reactivara) quedan INACTIVAS.
--  * Mientras una cuenta esté suspendida o deba cambiar su contraseña provisional, las funciones de
--    autorización la tratan como si no tuviera clases ni permisos.

-- -----------------------------------------------------------------------------
-- Perfiles
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists login_id text,
  add column if not exists active boolean not null default true,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_fingerprint text,
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists suspended_at timestamptz;

alter table public.profiles
  add constraint profiles_login_id_format check (login_id is null or login_id ~ '^[a-z0-9][a-z0-9._-]{2,39}$');
create unique index if not exists profiles_login_id_key on public.profiles (login_id) where login_id is not null;

comment on column public.profiles.login_id is 'ID de acceso (matrícula u otro), en minúsculas. Único.';
comment on column public.profiles.password_fingerprint is 'SHA-256 del hash bcrypt de la contraseña provisional vigente; sirve para comprobar que el usuario la cambió. Nunca contiene la contraseña.';

-- Normaliza un ID de acceso: minúsculas, sin espacios.
create or replace function public.normalize_login(p text)
returns text
language sql immutable set search_path = ''
as $$ select lower(regexp_replace(coalesce(p, ''), '\s+', '', 'g')) $$;

-- Perfil automático: el ID, el nombre y el rol solo se toman de app_metadata (que solo puede escribir el servidor).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_login text := nullif(public.normalize_login(new.raw_app_meta_data ->> 'login_id'), '');
begin
  insert into public.profiles (id, full_name, email, student_code, role, login_id, active, must_change_password)
  values (
    new.id,
    left(coalesce(new.raw_app_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'full_name', ''), 120),
    new.email,
    nullif(left(coalesce(new.raw_app_meta_data ->> 'student_code', ''), 40), ''),
    case when new.raw_app_meta_data ->> 'aula_role' = 'teacher' then 'teacher'::public.app_role else 'student'::public.app_role end,
    v_login,
    v_login is not null,   -- sin ID asignado por el servidor (p. ej. registro público) la cuenta nace inactiva
    v_login is not null    -- las cuentas creadas por el administrador deben cambiar la contraseña provisional
  );
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- ¿Cuenta habilitada? (activa y sin contraseña provisional pendiente de cambio)
-- -----------------------------------------------------------------------------
create or replace function public.account_ok(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select active and not must_change_password from public.profiles where id = p_user), false) $$;

create or replace function public.my_account_ok()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.account_ok(auth.uid()) $$;

-- Las funciones de autorización existentes pasan a exigir una cuenta habilitada
create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.my_account_ok() and coalesce((select role in ('teacher', 'admin') from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.my_account_ok() and coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_course_staff(p_course uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or (public.my_account_ok() and exists (
    select 1 from public.course_staff s where s.course_id = p_course and s.user_id = auth.uid()
  ))
$$;

create or replace function public.is_class_teacher(p_class uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or (public.my_account_ok() and exists (
    select 1 from public.class_teachers t where t.class_id = p_class and t.user_id = auth.uid()
  ))
$$;

create or replace function public.teaches_course(p_course uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.my_account_ok() and exists (
    select 1 from public.class_teachers t join public.classes c on c.id = t.class_id
    where c.course_id = p_course and t.user_id = auth.uid()
  )
$$;

create or replace function public.teaches_student(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or (public.my_account_ok() and exists (
    select 1 from public.enrollments e
    join public.class_teachers t on t.class_id = e.class_id
    where e.user_id = p_user and t.user_id = auth.uid()
  ))
$$;

create or replace function public.is_enrolled_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.my_account_ok() and exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = auth.uid()) $$;

create or replace function public.is_enrolled_course(p_course uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.my_account_ok() and exists (
    select 1 from public.enrollments e join public.classes c on c.id = e.class_id
    where c.course_id = p_course and e.user_id = auth.uid()
  )
$$;

create or replace function public.activity_visible_to_me(p_activity uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.my_account_ok() and exists (
    select 1 from public.activities a
    join public.enrollments e on e.class_id = a.class_id and e.user_id = auth.uid()
    where a.id = p_activity and a.published and (a.group_id is null or a.group_id = e.group_id)
  )
$$;

-- Escribir respuestas exige cuenta habilitada (cubre guardar, pistas, solución y calificación)
create or replace function public.assert_attempt_writable(p_attempt uuid, p_user uuid)
returns public.attempts
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_act public.activities;
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
  elsif v_att.lesson_id is null then
    raise exception 'Intento inválido' using errcode = 'P0001';
  end if;
  return v_att;
end;
$$;

create or replace function public.my_classes()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'class_id', c.id, 'name', c.name, 'term', c.term, 'archived', c.archived,
      'course_id', co.id, 'course_title', co.title,
      'group_name', g.name,
      'teachers', (select coalesce(jsonb_agg(p.full_name order by p.full_name), '[]'::jsonb)
                   from public.class_teachers t join public.profiles p on p.id = t.user_id where t.class_id = c.id)
    ) order by c.archived, c.created_at desc), '[]'::jsonb)
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.courses co on co.id = c.course_id
  left join public.class_groups g on g.id = e.group_id
  where e.user_id = auth.uid() and public.my_account_ok()
$$;

create or replace function public.join_class(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_class public.classes;
  v_group public.class_groups;
  v_existing public.enrollments;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.my_account_ok() then
    return jsonb_build_object('ok', false, 'error', 'Su cuenta no está habilitada. Cambie su contraseña provisional o consulte al administrador.');
  end if;
  if (select count(*) from public.join_failures where user_id = v_uid and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'Demasiados intentos con códigos incorrectos. Espere una hora.');
  end if;

  select * into v_class from public.classes where join_code = v_code and not archived;
  if not found then
    select * into v_group from public.class_groups where join_code = v_code;
    if found then
      select * into v_class from public.classes where id = v_group.class_id and not archived;
    end if;
  end if;
  if v_class.id is null then
    insert into public.join_failures (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'error', 'El código no corresponde a ninguna clase activa.');
  end if;
  if not v_class.join_open then
    return jsonb_build_object('ok', false, 'error', 'La matrícula de esta clase está cerrada. Consulte a su profesor.');
  end if;
  if public.is_class_teacher(v_class.id) then
    return jsonb_build_object('ok', false, 'error', 'Usted es profesor de esta clase.');
  end if;

  select * into v_existing from public.enrollments where class_id = v_class.id and user_id = v_uid;
  if found then
    if v_existing.group_id is null and v_group.id is not null then
      update public.enrollments set group_id = v_group.id where class_id = v_class.id and user_id = v_uid;
    end if;
    return jsonb_build_object('ok', true, 'class_id', v_class.id, 'already', true);
  end if;

  insert into public.enrollments (class_id, user_id, group_id) values (v_class.id, v_uid, v_group.id);
  return jsonb_build_object('ok', true, 'class_id', v_class.id, 'class_name', v_class.name, 'group_name', v_group.name);
end;
$$;

-- -----------------------------------------------------------------------------
-- Registro de intentos de acceso y de acciones administrativas
-- -----------------------------------------------------------------------------
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  login_id text not null,
  user_id uuid references public.profiles (id) on delete set null,
  ip_hash text,
  success boolean not null,
  reason text not null check (reason in ('ok', 'bad_password', 'unknown_id', 'suspended', 'locked', 'rate_ip', 'invalid_format')),
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_login_idx on public.login_attempts (login_id, created_at desc);
create index if not exists login_attempts_ip_idx on public.login_attempts (ip_hash, created_at desc);
alter table public.login_attempts enable row level security;
comment on table public.login_attempts is 'Intentos de inicio de sesión. Sin contraseñas; la IP se guarda solo como hash.';

create table if not exists public.account_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  target_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('create', 'reset_password', 'suspend', 'reactivate', 'password_changed', 'bootstrap', 'enroll')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists account_events_target_idx on public.account_events (target_id, created_at desc);
alter table public.account_events enable row level security;
comment on table public.account_events is 'Auditoría de acciones sobre cuentas. Nunca contiene contraseñas.';

create policy login_attempts_admin on public.login_attempts for select to authenticated using (public.is_admin());
create policy account_events_admin on public.account_events for select to authenticated using (public.is_admin());
grant select on public.login_attempts, public.account_events to authenticated;

-- -----------------------------------------------------------------------------
-- Funciones de servicio para las Edge Functions «acceder» y «admin-cuentas» (solo service_role)
-- -----------------------------------------------------------------------------

-- Antes de verificar la contraseña: bloqueo por ID y por IP, y cuenta asociada (si existe).
-- Política: 5 fallos en 15 min por ID → bloqueo temporal; 30 fallos en 15 min desde la misma IP → bloqueo.
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
    return jsonb_build_object('allowed', false, 'reason', 'invalid_format', 'login', v_login);
  end if;
  select count(*) into v_fail_id from public.login_attempts
    where login_id = v_login and not success and created_at > now() - interval '15 minutes';
  select count(*) into v_fail_ip from public.login_attempts
    where p_ip_hash is not null and ip_hash = p_ip_hash and not success and created_at > now() - interval '15 minutes';
  if v_fail_id >= 5 then return jsonb_build_object('allowed', false, 'reason', 'locked', 'login', v_login); end if;
  if v_fail_ip >= 30 then return jsonb_build_object('allowed', false, 'reason', 'rate_ip', 'login', v_login); end if;
  select * into v_prof from public.profiles where login_id = v_login;
  if v_prof.id is not null then
    select u.email into v_email from auth.users u where u.id = v_prof.id;
  end if;
  return jsonb_build_object('allowed', true, 'login', v_login, 'user_id', v_prof.id, 'email', v_email,
                            'active', coalesce(v_prof.active, false));
end;
$$;

create or replace function public.svc_login_record(p_login text, p_user uuid, p_ip_hash text, p_success boolean, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.login_attempts (login_id, user_id, ip_hash, success, reason)
    values (left(public.normalize_login(p_login), 60), p_user, p_ip_hash, p_success, p_reason);
  -- retención: 180 días
  delete from public.login_attempts where created_at < now() - interval '180 days';
  return jsonb_build_object('must_change_password',
    coalesce((select must_change_password from public.profiles where id = p_user and p_success), false));
end;
$$;

create or replace function public.svc_is_admin(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'admin' and active and not must_change_password from public.profiles where id = p_user), false) $$;

create or replace function public.svc_login_taken(p_login text)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where login_id = public.normalize_login(p_login)) $$;

-- Tras crear una cuenta o restablecer su contraseña con la API de administración de Auth:
-- marca la contraseña como provisional y guarda la huella del hash para detectar el cambio.
create or replace function public.svc_account_issued(p_actor uuid, p_user uuid, p_action text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_hash text;
begin
  if not public.svc_is_admin(p_actor) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_action not in ('create', 'reset_password') then raise exception 'Acción inválida' using errcode = '22023'; end if;
  select encrypted_password into v_hash from auth.users where id = p_user;
  if v_hash is null then raise exception 'Cuenta inexistente' using errcode = 'P0001'; end if;
  update public.profiles set
      must_change_password = true,
      password_fingerprint = encode(extensions.digest(v_hash, 'sha256'), 'hex'),
      active = true,
      suspended_at = null,
      created_by = case when p_action = 'create' then p_actor else created_by end
    where id = p_user;
  insert into public.account_events (actor_id, target_id, action) values (p_actor, p_user, p_action);
  return (select jsonb_build_object('id', id, 'login_id', login_id, 'full_name', full_name) from public.profiles where id = p_user);
end;
$$;

create or replace function public.svc_set_suspended(p_actor uuid, p_user uuid, p_suspend boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.svc_is_admin(p_actor) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_actor = p_user then raise exception 'No puede suspender su propia cuenta' using errcode = 'P0001'; end if;
  update public.profiles set active = not p_suspend, suspended_at = case when p_suspend then now() end where id = p_user;
  insert into public.account_events (actor_id, target_id, action) values (p_actor, p_user, case when p_suspend then 'suspend' else 'reactivate' end);
end;
$$;

-- Matrícula de una cuenta nueva en secciones (desde la importación del administrador)
create or replace function public.svc_enroll(p_actor uuid, p_user uuid, p_classes uuid[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_n integer;
begin
  if not public.svc_is_admin(p_actor) then raise exception 'No autorizado' using errcode = '42501'; end if;
  insert into public.enrollments (class_id, user_id)
    select c.id, p_user from public.classes c where c.id = any(coalesce(p_classes, '{}')) and not c.archived
    on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.account_events (actor_id, target_id, action, detail)
      values (p_actor, p_user, 'enroll', jsonb_build_object('classes', p_classes));
  end if;
  return v_n;
end;
$$;

-- -----------------------------------------------------------------------------
-- Funciones para usuarios autenticados
-- -----------------------------------------------------------------------------

-- El usuario confirma que ya cambió su contraseña provisional (con supabase.auth.updateUser).
-- Se verifica en el servidor: el hash actual debe ser distinto del emitido por el administrador.
create or replace function public.confirm_password_changed()
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles;
  v_hash text;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  if not v_prof.must_change_password then return true; end if;
  select encrypted_password into v_hash from auth.users where id = v_uid;
  if v_prof.password_fingerprint is not null and encode(extensions.digest(v_hash, 'sha256'), 'hex') = v_prof.password_fingerprint then
    raise exception 'Todavía no ha cambiado la contraseña provisional' using errcode = 'P0001';
  end if;
  update public.profiles set must_change_password = false, password_fingerprint = null where id = v_uid;
  insert into public.account_events (actor_id, target_id, action) values (v_uid, v_uid, 'password_changed');
  return true;
end;
$$;

-- Listado para el panel de cuentas (solo administradores)
create or replace function public.admin_list_users(p_query text default '')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'login_id', p.login_id, 'email', p.email, 'student_code', p.student_code,
      'role', p.role, 'active', p.active, 'must_change_password', p.must_change_password, 'created_at', p.created_at,
      'last_sign_in_at', (select u.last_sign_in_at from auth.users u where u.id = p.id),
      'failed_logins_24h', (select count(*) from public.login_attempts a where a.login_id = p.login_id and not a.success and a.created_at > now() - interval '24 hours'),
      'classes', (select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb) from public.enrollments e join public.classes c on c.id = e.class_id where e.user_id = p.id)
    ) order by p.full_name), '[]'::jsonb)
    from (select * from public.profiles p
          where coalesce(p_query, '') = ''
             or p.login_id ilike '%' || p_query || '%' or p.full_name ilike '%' || p_query || '%' or p.student_code ilike '%' || p_query || '%'
          order by p.created_at desc limit 500) p);
end;
$$;

-- Intentos sospechosos de las últimas 72 horas (IDs con 3 o más fallos)
create or replace function public.admin_suspicious_logins()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'login_id', x.login_id, 'fallos', x.fallos, 'ips', x.ips, 'ultimo', x.ultimo, 'existe', x.existe, 'bloqueos', x.bloqueos
    ) order by x.ultimo desc), '[]'::jsonb)
    from (
      select a.login_id, count(*) filter (where not a.success) as fallos, count(distinct a.ip_hash) as ips,
             max(a.created_at) as ultimo, bool_or(a.user_id is not null) as existe,
             count(*) filter (where a.reason in ('locked', 'rate_ip')) as bloqueos
      from public.login_attempts a
      where a.created_at > now() - interval '72 hours'
      group by a.login_id
      having count(*) filter (where not a.success) >= 3
    ) x);
end;
$$;

-- Primer administrador. Ejecutar UNA VEZ desde el editor SQL (sin acceso por la API).
-- El usuario se crea antes en Supabase → Authentication → Users → «Add user» (con «Auto Confirm User»).
create or replace function public.bootstrap_admin(p_email text, p_login_id text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_login text := public.normalize_login(p_login_id);
begin
  if v_login !~ '^[a-z0-9][a-z0-9._-]{2,39}$' then return 'ID inválido: use de 3 a 40 letras minúsculas, dígitos, punto, guion o guion bajo.'; end if;
  select id into v_user from public.profiles where lower(email) = lower(trim(p_email));
  if v_user is null then return 'No existe un usuario con ese correo. Créelo antes en Authentication → Users → Add user.'; end if;
  if exists (select 1 from public.profiles where login_id = v_login and id <> v_user) then return 'Ese ID ya está en uso.'; end if;
  update public.profiles set role = 'admin', login_id = v_login, active = true, must_change_password = false, suspended_at = null where id = v_user;
  insert into public.course_staff (course_id, user_id) select id, v_user from public.courses on conflict do nothing;
  insert into public.account_events (actor_id, target_id, action) values (v_user, v_user, 'bootstrap');
  return 'Listo: el administrador entra con el ID «' || v_login || '» y su contraseña.';
end;
$$;

-- La versión anterior (solo correo) asigna un ID derivado del correo
create or replace function public.bootstrap_admin(p_email text)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  return public.bootstrap_admin(p_email, left(regexp_replace(split_part(lower(trim(p_email)), '@', 1), '[^a-z0-9._-]', '', 'g'), 40));
end;
$$;

-- -----------------------------------------------------------------------------
-- Cuentas existentes: siguen activas; las que no tienen ID lo recibirán desde el panel.
-- (Las columnas nuevas ya tienen valores por defecto seguros: active = true, must_change_password = false.)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Privilegios
-- -----------------------------------------------------------------------------
revoke execute on function
  public.normalize_login(text), public.account_ok(uuid), public.my_account_ok(),
  public.svc_login_check(text, text), public.svc_login_record(text, uuid, text, boolean, text),
  public.svc_is_admin(uuid), public.svc_login_taken(text), public.svc_account_issued(uuid, uuid, text),
  public.svc_set_suspended(uuid, uuid, boolean), public.svc_enroll(uuid, uuid, uuid[]),
  public.confirm_password_changed(), public.admin_suspicious_logins(),
  public.bootstrap_admin(text, text), public.bootstrap_admin(text)
  from public, anon, authenticated;

grant execute on function public.account_ok(uuid), public.my_account_ok(), public.normalize_login(text) to authenticated;
grant execute on function public.confirm_password_changed(), public.admin_suspicious_logins() to authenticated;
grant execute on function
  public.svc_login_check(text, text), public.svc_login_record(text, uuid, text, boolean, text),
  public.svc_is_admin(uuid), public.svc_login_taken(text), public.svc_account_issued(uuid, uuid, text),
  public.svc_set_suspended(uuid, uuid, boolean), public.svc_enroll(uuid, uuid, uuid[])
  to service_role;
