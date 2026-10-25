-- =============================================================================
-- Aula Virtual · 6. Corrección: datos del perfil en las cuentas creadas por el panel
-- =============================================================================
-- Supabase Auth crea el usuario y DESPUÉS guarda su app_metadata (ID, nombre, rol). El disparador que crea
-- el perfil se ejecuta en el primer paso, por lo que el perfil quedaba sin ID ni nombre.
-- Ahora svc_account_issued (que la Edge Function llama al terminar el alta) copia esos datos de app_metadata,
-- que en ese momento ya están completos. Migración aditiva: redefine una función y repara los perfiles afectados.

create or replace function public.svc_account_issued(p_actor uuid, p_user uuid, p_action text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text;
  v_meta jsonb;
  v_login text;
begin
  if not public.svc_is_admin(p_actor) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_action not in ('create', 'reset_password') then raise exception 'Acción inválida' using errcode = '22023'; end if;
  select encrypted_password, coalesce(raw_app_meta_data, '{}'::jsonb) into v_hash, v_meta from auth.users where id = p_user;
  if v_hash is null then raise exception 'Cuenta inexistente' using errcode = 'P0001'; end if;

  if p_action = 'create' then
    v_login := nullif(public.normalize_login(v_meta ->> 'login_id'), '');
    if v_login is null or v_login !~ '^[a-z0-9][a-z0-9._-]{2,39}$' then
      raise exception 'La cuenta no tiene un ID válido' using errcode = '22023';
    end if;
    if exists (select 1 from public.profiles where login_id = v_login and id <> p_user) then
      raise exception 'Ese ID ya está en uso' using errcode = 'P0001';
    end if;
    update public.profiles set
        login_id = v_login,
        full_name = left(coalesce(nullif(v_meta ->> 'full_name', ''), full_name), 120),
        student_code = coalesce(nullif(left(v_meta ->> 'student_code', 40), ''), student_code),
        role = case when v_meta ->> 'aula_role' = 'teacher' then 'teacher'::public.app_role else 'student'::public.app_role end,
        created_by = p_actor
      where id = p_user and (login_id is null or login_id = v_login);
  end if;

  update public.profiles set
      must_change_password = true,
      password_fingerprint = encode(extensions.digest(v_hash, 'sha256'), 'hex'),
      active = true,
      suspended_at = null
    where id = p_user;
  insert into public.account_events (actor_id, target_id, action) values (p_actor, p_user, p_action);
  return (select jsonb_build_object('id', id, 'login_id', login_id, 'full_name', full_name) from public.profiles where id = p_user);
end;
$$;

-- Reparación de los perfiles creados por el panel antes de esta corrección (los que quedaron sin ID):
-- se toman de app_metadata. Solo afecta a cuentas creadas por un administrador (created_by no nulo).
update public.profiles p set
    login_id = public.normalize_login(u.raw_app_meta_data ->> 'login_id'),
    full_name = left(coalesce(nullif(u.raw_app_meta_data ->> 'full_name', ''), p.full_name), 120),
    student_code = coalesce(nullif(left(u.raw_app_meta_data ->> 'student_code', 40), ''), p.student_code),
    role = case when u.raw_app_meta_data ->> 'aula_role' = 'teacher' then 'teacher'::public.app_role else 'student'::public.app_role end
  from auth.users u
  where u.id = p.id
    and p.login_id is null
    and p.created_by is not null
    and public.normalize_login(u.raw_app_meta_data ->> 'login_id') ~ '^[a-z0-9][a-z0-9._-]{2,39}$'
    and not exists (select 1 from public.profiles x where x.login_id = public.normalize_login(u.raw_app_meta_data ->> 'login_id'));
