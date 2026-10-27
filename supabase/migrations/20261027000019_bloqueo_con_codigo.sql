-- =============================================================================
-- Bloqueo de pantalla con código: un mensaje del profesor que ocupa toda la pantalla del aula del estudiante y
-- solo desaparece con el código que el profesor le entrega (o si el profesor lo libera).
--  · El estado vive en el servidor: cerrar la pestaña, cerrar sesión o entrar desde otro dispositivo no lo quita.
--  · El código se guarda cifrado (bcrypt), nunca en claro; el profesor lo elige al enviar y debe anotarlo.
--  · Intentos limitados: 5 fallos seguidos bloquean los intentos 10 minutos.
--  · Solo el profesor de la sección puede bloquear o liberar; el estudiante solo ve y desbloquea lo suyo.
-- No toca los mensajes emergentes existentes (migración 14).
-- =============================================================================

create table if not exists public.screen_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  code_hash text not null,
  created_at timestamptz not null default now(),
  failed_attempts integer not null default 0,
  locked_until timestamptz,                 -- tras demasiados fallos, no se admiten intentos hasta esta hora
  unlocked_at timestamptz,
  unlocked_by text check (unlocked_by in ('codigo', 'profesor'))
);
create index if not exists screen_locks_activos on public.screen_locks (user_id) where unlocked_at is null;
alter table public.screen_locks enable row level security;
-- lectura: el estudiante, sus bloqueos (para recibir el aviso por Realtime); el profesor, los de sus estudiantes.
-- El hash del código no se expone: las aplicaciones usan las funciones de abajo, que nunca lo devuelven.
drop policy if exists screen_locks_select on public.screen_locks;
create policy screen_locks_select on public.screen_locks for select to authenticated
  using (user_id = auth.uid() or public.teaches_student(user_id));
revoke all on public.screen_locks from anon, authenticated;
grant select (id, user_id, sender_id, created_at, unlocked_at) on public.screen_locks to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'screen_locks') then
    alter publication supabase_realtime add table public.screen_locks;
  end if;
end $$;

-- Envío. p_mode: 'seleccion' (p_users), 'seccion' (p_class), 'todos' o 'conectados' (decididos en el servidor).
create or replace function public.send_screen_lock(p_body text, p_code text, p_mode text, p_users uuid[], p_class uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_ids uuid[]; v_hash text; v_n integer;
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado puede bloquear pantallas' using errcode = '42501'; end if;
  if p_body is null or char_length(btrim(p_body)) = 0 or char_length(p_body) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres' using errcode = '22023';
  end if;
  if p_code is null or char_length(btrim(p_code)) < 4 or char_length(p_code) > 32 then
    raise exception 'El código debe tener entre 4 y 32 caracteres' using errcode = '22023';
  end if;
  if p_mode = 'seccion' and (p_class is null or not (public.is_class_teacher(p_class)
       or public.is_course_staff((select course_id from public.classes where id = p_class)))) then
    raise exception 'No imparte esa sección' using errcode = '42501';
  end if;
  if p_mode = 'conectados' then
    select array_agg(distinct o.user_id) into v_ids from public.control_online() o where p_class is null or o.class_id = p_class;
  else
    select array_agg(distinct s.user_id) into v_ids from public.my_messageable_students() s
      where case p_mode when 'seccion' then s.class_id = p_class when 'todos' then true
                        when 'seleccion' then s.user_id = any (coalesce(p_users, '{}'::uuid[])) else false end;
  end if;
  if v_ids is null then raise exception 'Ningún destinatario autorizado' using errcode = 'P0001'; end if;
  v_hash := extensions.crypt(lower(btrim(p_code)), extensions.gen_salt('bf'));
  -- un solo bloqueo activo por estudiante: el nuevo sustituye al anterior (que queda como liberado por el profesor)
  update public.screen_locks set unlocked_at = now(), unlocked_by = 'profesor'
    where user_id = any (v_ids) and unlocked_at is null;
  insert into public.screen_locks (user_id, sender_id, body, code_hash)
    select u, auth.uid(), btrim(p_body), v_hash from unnest(v_ids) u;
  get diagnostics v_n = row_count;
  return jsonb_build_object('locked', v_n);
end;
$$;

-- Bloqueo activo del estudiante (sin el código)
create or replace function public.my_screen_lock()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', l.id, 'body', l.body, 'sender_name', coalesce(nullif(p.full_name, ''), 'Profesor'),
    'created_at', l.created_at, 'locked_until', l.locked_until)
  from public.screen_locks l left join public.profiles p on p.id = l.sender_id
  where l.user_id = auth.uid() and l.unlocked_at is null
  order by l.created_at desc limit 1
$$;

-- Desbloqueo con el código (comparación sin distinguir mayúsculas y sin espacios en los extremos)
create or replace function public.unlock_screen(p_lock uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r public.screen_locks;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into r from public.screen_locks where id = p_lock and user_id = auth.uid() for update;
  if not found then raise exception 'Bloqueo no encontrado' using errcode = 'P0002'; end if;
  if r.unlocked_at is not null then return jsonb_build_object('ok', true); end if;
  if r.locked_until is not null and r.locked_until > now() then
    return jsonb_build_object('ok', false, 'espera_hasta', r.locked_until);
  end if;
  if extensions.crypt(lower(btrim(coalesce(p_code, ''))), r.code_hash) = r.code_hash then
    update public.screen_locks set unlocked_at = now(), unlocked_by = 'codigo', failed_attempts = 0 where id = p_lock;
    return jsonb_build_object('ok', true);
  end if;
  update public.screen_locks set failed_attempts = failed_attempts + 1,
      locked_until = case when (failed_attempts + 1) % 5 = 0 then now() + interval '10 minutes' end
    where id = p_lock returning * into r;
  return jsonb_build_object('ok', false, 'intentos', r.failed_attempts, 'espera_hasta', r.locked_until);
end;
$$;

-- Bloqueos activos de mis estudiantes (para el panel y Orbe Control) y liberación por el profesor
create or replace function public.active_screen_locks()
returns table (id uuid, user_id uuid, full_name text, student_code text, body text, created_at timestamptz, failed_attempts integer)
language sql stable security definer set search_path = ''
as $$
  select l.id, l.user_id, p.full_name, p.student_code, l.body, l.created_at, l.failed_attempts
  from public.screen_locks l join public.profiles p on p.id = l.user_id
  where l.unlocked_at is null and public.is_teacher() and public.teaches_student(l.user_id)
  order by l.created_at desc
$$;

create or replace function public.release_screen_lock(p_lock uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user uuid;
begin
  select user_id into v_user from public.screen_locks where id = p_lock;
  if v_user is null then raise exception 'Bloqueo no encontrado' using errcode = 'P0002'; end if;
  if not (public.is_teacher() and public.teaches_student(v_user)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.screen_locks set unlocked_at = now(), unlocked_by = 'profesor' where id = p_lock and unlocked_at is null;
end;
$$;

revoke all on function public.send_screen_lock(text, text, text, uuid[], uuid) from public, anon;
revoke all on function public.my_screen_lock() from public, anon;
revoke all on function public.unlock_screen(uuid, text) from public, anon;
revoke all on function public.active_screen_locks() from public, anon;
revoke all on function public.release_screen_lock(uuid) from public, anon;
grant execute on function public.send_screen_lock(text, text, text, uuid[], uuid) to authenticated;
grant execute on function public.my_screen_lock() to authenticated;
grant execute on function public.unlock_screen(uuid, text) to authenticated;
grant execute on function public.active_screen_locks() to authenticated;
grant execute on function public.release_screen_lock(uuid) to authenticated;
