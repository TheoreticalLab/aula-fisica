-- =============================================================================
-- Aula Virtual · 7. Activación de cuentas con la clave de la sección
-- =============================================================================
-- El estudiante crea su propia cuenta escribiendo la clave de su sección (classes.join_code o el código de un
-- grupo), su ID, su nombre y la contraseña que elige. Queda matriculado SOLO en esa sección.
-- La creación la hace la Edge Function «activar» con la API de administración de Auth (el registro público
-- de Supabase sigue desactivado). La clave solo sirve mientras la matrícula de la sección esté abierta
-- (classes.join_open); el profesor puede cerrarla o cambiarla en cualquier momento.
-- Migración ADITIVA.

create table if not exists public.activation_attempts (
  id bigint generated always as identity primary key,
  ip_hash text,
  login_id text,
  class_id uuid references public.classes (id) on delete set null,
  success boolean not null,
  reason text not null check (reason in ('ok', 'bad_code', 'closed', 'id_taken', 'invalid', 'rate_ip', 'error')),
  created_at timestamptz not null default now()
);
create index if not exists activation_attempts_ip_idx on public.activation_attempts (ip_hash, created_at desc);
alter table public.activation_attempts enable row level security;
create policy activation_attempts_admin on public.activation_attempts for select to authenticated using (public.is_admin());
grant select on public.activation_attempts to authenticated;
comment on table public.activation_attempts is 'Intentos de activación con clave de sección. Sin contraseñas; la IP solo como hash.';

-- Comprueba la clave, el ID y los límites antes de crear la cuenta.
-- Límite: 10 intentos fallidos por IP en una hora (las claves tienen ~8·10^11 combinaciones).
create or replace function public.svc_activation_check(p_code text, p_login text, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_login text := public.normalize_login(p_login);
  v_class public.classes;
  v_group public.class_groups;
begin
  if p_ip_hash is not null and (select count(*) from public.activation_attempts
      where ip_hash = p_ip_hash and not success and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'rate_ip');
  end if;
  if v_login !~ '^[a-z0-9][a-z0-9._-]{2,39}$' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select * into v_class from public.classes where join_code = v_code and not archived;
  if v_class.id is null then
    select * into v_group from public.class_groups where join_code = v_code;
    if v_group.id is not null then select * into v_class from public.classes where id = v_group.class_id and not archived; end if;
  end if;
  if v_class.id is null then return jsonb_build_object('ok', false, 'reason', 'bad_code'); end if;
  if not v_class.join_open then return jsonb_build_object('ok', false, 'reason', 'closed', 'class_id', v_class.id); end if;
  if exists (select 1 from public.profiles where login_id = v_login) then
    return jsonb_build_object('ok', false, 'reason', 'id_taken', 'class_id', v_class.id);
  end if;
  return jsonb_build_object('ok', true, 'login', v_login, 'class_id', v_class.id, 'group_id', v_group.id, 'class_name', v_class.name);
end;
$$;

create or replace function public.svc_activation_record(p_ip_hash text, p_login text, p_class uuid, p_success boolean, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activation_attempts (ip_hash, login_id, class_id, success, reason)
    values (p_ip_hash, left(public.normalize_login(p_login), 60), p_class, p_success, p_reason);
  delete from public.activation_attempts where created_at < now() - interval '180 days';
end;
$$;

-- Tras crear el usuario en Auth: completa el perfil desde app_metadata (que Auth guarda en un segundo paso),
-- lo activa con la contraseña que eligió el propio estudiante (no provisional) y lo matricula en su sección.
create or replace function public.svc_account_activated(p_user uuid, p_class uuid, p_group uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_meta jsonb;
  v_login text;
begin
  select coalesce(raw_app_meta_data, '{}'::jsonb) into v_meta from auth.users where id = p_user;
  if v_meta is null then raise exception 'Cuenta inexistente' using errcode = 'P0001'; end if;
  v_login := public.normalize_login(v_meta ->> 'login_id');
  if v_login !~ '^[a-z0-9][a-z0-9._-]{2,39}$' then raise exception 'ID inválido' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where login_id = v_login and id <> p_user) then
    raise exception 'Ese ID ya está en uso' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.classes where id = p_class and join_open and not archived) then
    raise exception 'La sección no admite activaciones' using errcode = 'P0001';
  end if;
  update public.profiles set
      login_id = v_login,
      full_name = left(coalesce(nullif(v_meta ->> 'full_name', ''), full_name), 120),
      role = 'student',
      active = true,
      must_change_password = false,
      password_fingerprint = null,
      suspended_at = null
    where id = p_user;
  insert into public.enrollments (class_id, user_id, group_id) values (p_class, p_user, p_group) on conflict do nothing;
  insert into public.account_events (actor_id, target_id, action, detail)
    values (null, p_user, 'create', jsonb_build_object('via', 'clave_seccion', 'class', p_class));
  return jsonb_build_object('login_id', v_login);
end;
$$;

revoke execute on function
  public.svc_activation_check(text, text, text), public.svc_activation_record(text, text, uuid, boolean, text),
  public.svc_account_activated(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.svc_activation_check(text, text, text), public.svc_activation_record(text, text, uuid, boolean, text),
  public.svc_account_activated(uuid, uuid, uuid)
  to service_role;
