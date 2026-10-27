-- =============================================================================
-- Asistencia con código.
--
-- El profesor abre la asistencia de una sección (en Orbe Control o en el panel): se genera un código de 6 cifras
-- válido unos minutos, que dicta en clase. El estudiante lo escribe en el aula («Marcar presente») y queda
-- registrado con la hora del servidor. El profesor ve los presentes en vivo, puede cambiar el código, cerrar la
-- asistencia y corregir a mano (marcar o quitar a un estudiante). Contra la adivinación: el código caduca y cada
-- estudiante tiene un número limitado de intentos fallidos.
--
-- También añade student_extras(): asistencia y entregas en PDF de un estudiante para su ficha completa.
-- Tablas sin acceso directo (todo por funciones). Aditiva: tablas y funciones nuevas.
-- =============================================================================

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{6}$'),
  opened_by uuid references public.profiles (id) on delete set null,
  opened_at timestamptz not null default now(),
  code_expires_at timestamptz not null,
  closed_at timestamptz,
  note text check (note is null or char_length(note) <= 200)
);
create index if not exists attendance_sessions_class_idx on public.attendance_sessions (class_id, opened_at desc);

create table if not exists public.attendance_records (
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  marked_at timestamptz not null default now(),
  method text not null check (method in ('codigo', 'profesor')),
  marked_by uuid references public.profiles (id) on delete set null,
  primary key (session_id, user_id)
);

create table if not exists public.attendance_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists attendance_failures_user_idx on public.attendance_failures (user_id, created_at desc);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_failures enable row level security;
revoke all on public.attendance_sessions, public.attendance_records, public.attendance_failures from anon, authenticated;

-- 6 cifras a partir de un UUID aleatorio (gen_random_uuid usa el generador criptográfico del servidor)
create or replace function public.attendance_random_code()
returns text
language sql volatile set search_path = ''
as $$ select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))::bit(48)::bigint) % 1000000)::text, 6, '0') $$;

create or replace function public.attendance_assert_teacher(p_session uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.attendance_sessions where id = p_session;
  if v_class is null or not public.is_teacher() or not public.is_class_teacher(v_class) then
    raise exception 'No tiene acceso a esta asistencia' using errcode = '42501';
  end if;
  return v_class;
end;
$$;

-- Abre la asistencia (cierra la que estuviera abierta en la misma sección)
create or replace function public.attendance_open(p_class uuid, p_minutes integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_code text := public.attendance_random_code(); v_exp timestamptz;
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  update public.attendance_sessions set closed_at = now() where class_id = p_class and closed_at is null;
  v_exp := now() + make_interval(mins => least(greatest(coalesce(p_minutes, 10), 1), 180));
  insert into public.attendance_sessions (class_id, code, opened_by, code_expires_at) values (p_class, v_code, auth.uid(), v_exp)
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'code', v_code, 'code_expires_at', v_exp);
end;
$$;

create or replace function public.attendance_new_code(p_session uuid, p_minutes integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_code text := public.attendance_random_code(); v_exp timestamptz := now() + make_interval(mins => least(greatest(coalesce(p_minutes, 10), 1), 180));
begin
  perform public.attendance_assert_teacher(p_session);
  update public.attendance_sessions set code = v_code, code_expires_at = v_exp, closed_at = null where id = p_session;
  return jsonb_build_object('id', p_session, 'code', v_code, 'code_expires_at', v_exp);
end;
$$;

create or replace function public.attendance_close(p_session uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.attendance_assert_teacher(p_session);
  update public.attendance_sessions set closed_at = now() where id = p_session and closed_at is null;
end;
$$;

-- Corrección manual: marcar presente o quitar
create or replace function public.attendance_set(p_session uuid, p_user uuid, p_present boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := public.attendance_assert_teacher(p_session);
begin
  if not exists (select 1 from public.enrollments e where e.class_id = v_class and e.user_id = p_user) then
    raise exception 'El estudiante no está en esta sección' using errcode = '22023';
  end if;
  if p_present then
    insert into public.attendance_records (session_id, user_id, method, marked_by) values (p_session, p_user, 'profesor', auth.uid())
      on conflict (session_id, user_id) do nothing;
  else
    delete from public.attendance_records where session_id = p_session and user_id = p_user;
  end if;
end;
$$;

-- Vista en vivo de una asistencia: código, vigencia y la lista completa de la sección
create or replace function public.attendance_live(p_session uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid := public.attendance_assert_teacher(p_session); r jsonb;
begin
  select jsonb_build_object(
    'id', s.id, 'class_id', s.class_id, 'clase', c.name, 'asignatura', co.title, 'code', s.code, 'code_expires_at', s.code_expires_at,
    'opened_at', s.opened_at, 'closed_at', s.closed_at, 'abierta', s.closed_at is null and s.code_expires_at > now(), 'server_now', now(),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'student_code', p.student_code,
        'presente', r2.user_id is not null, 'marked_at', r2.marked_at, 'method', r2.method) order by r2.marked_at nulls last, p.full_name), '[]')
      from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
      left join public.attendance_records r2 on r2.session_id = s.id and r2.user_id = p.id
      where e.class_id = s.class_id))
  into r
  from public.attendance_sessions s join public.classes c on c.id = s.class_id join public.courses co on co.id = c.course_id
  where s.id = p_session;
  return r;
end;
$$;

-- Asistencias abiertas de las secciones del profesor (para retomar en Orbe Control)
create or replace function public.attendance_open_sessions()
returns table (id uuid, class_id uuid, clase text, code_expires_at timestamptz, opened_at timestamptz, presentes bigint)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.class_id, c.name, s.code_expires_at, s.opened_at,
    (select count(*) from public.attendance_records r where r.session_id = s.id)
  from public.attendance_sessions s join public.classes c on c.id = s.class_id
  where s.closed_at is null and public.is_teacher() and public.is_class_teacher(s.class_id)
  order by s.opened_at desc
$$;

-- Historial de una sección: cada sesión y el total por estudiante
create or replace function public.attendance_report(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r jsonb;
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  select jsonb_build_object(
    'sesiones', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'opened_at', s.opened_at, 'closed_at', s.closed_at,
        'presentes', (select count(*) from public.attendance_records r2 where r2.session_id = s.id)) order by s.opened_at desc), '[]')
      from public.attendance_sessions s where s.class_id = p_class),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'student_code', p.student_code,
        'presentes', (select count(*) from public.attendance_records r2 join public.attendance_sessions s on s.id = r2.session_id
                      where s.class_id = p_class and r2.user_id = p.id),
        'sesiones', (select array_agg(r2.session_id) from public.attendance_records r2 join public.attendance_sessions s on s.id = r2.session_id
                      where s.class_id = p_class and r2.user_id = p.id)) order by p.full_name), '[]')
      from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' where e.class_id = p_class)
  ) into r;
  return r;
end;
$$;

-- --- estudiante ------------------------------------------------------------------------------------------------
create or replace function public.attendance_mark(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g'); v_clases text[]; n integer;
begin
  if v_uid is null or not public.my_account_ok() then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if (select count(*) from public.attendance_failures f where f.user_id = v_uid and f.created_at > now() - interval '15 minutes') >= 6 then
    raise exception 'Demasiados códigos incorrectos. Espere unos minutos o avise al profesor.' using errcode = 'P0001';
  end if;
  if v_code !~ '^[0-9]{6}$' then raise exception 'El código tiene 6 cifras' using errcode = '22023'; end if;
  with s as (
    select x.id, c.name from public.attendance_sessions x join public.classes c on c.id = x.class_id
    join public.enrollments e on e.class_id = x.class_id and e.user_id = v_uid
    where x.closed_at is null and x.code_expires_at > now() and x.code = v_code
  ), ins as (
    insert into public.attendance_records (session_id, user_id, method) select s.id, v_uid, 'codigo' from s
    on conflict (session_id, user_id) do nothing returning session_id
  )
  select array_agg(s.name), (select count(*) from ins) into v_clases, n from s;
  if v_clases is null then
    -- se devuelve (no se lanza una excepción) para que el fallo quede registrado y cuente para el límite
    insert into public.attendance_failures (user_id) values (v_uid);
    delete from public.attendance_failures where created_at < now() - interval '1 day';
    return jsonb_build_object('ok', false, 'error', 'Código incorrecto o vencido');
  end if;
  return jsonb_build_object('ok', true, 'clases', to_jsonb(v_clases), 'nuevo', n > 0);
end;
$$;

create or replace function public.my_attendance()
returns table (class_id uuid, clase text, asignatura text, sesiones bigint, presentes bigint, ultimas jsonb)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, co.title,
    (select count(*) from public.attendance_sessions s where s.class_id = c.id),
    (select count(*) from public.attendance_records r join public.attendance_sessions s on s.id = r.session_id where s.class_id = c.id and r.user_id = auth.uid()),
    (select coalesce(jsonb_agg(jsonb_build_object('fecha', z.opened_at, 'presente', z.pres, 'hora', z.marked_at) order by z.opened_at desc), '[]') from (
       select s.opened_at, r.user_id is not null pres, r.marked_at from public.attendance_sessions s
       left join public.attendance_records r on r.session_id = s.id and r.user_id = auth.uid()
       where s.class_id = c.id order by s.opened_at desc limit 30) z)
  from public.enrollments e join public.classes c on c.id = e.class_id join public.courses co on co.id = c.course_id
  where e.user_id = auth.uid() and not c.archived and public.my_account_ok()
  order by co.title, c.name
$$;

-- --- ficha del estudiante: asistencia y entregas en PDF (secciones del profesor; todas para el administrador) -----
create or replace function public.student_extras(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_clases uuid[];
begin
  if not public.is_teacher() or not public.teaches_student(p_user) then raise exception 'No tiene acceso a este estudiante' using errcode = '42501'; end if;
  v_clases := array(select e.class_id from public.enrollments e where e.user_id = p_user and public.is_class_teacher(e.class_id));
  return jsonb_build_object(
    'asistencia', (select coalesce(jsonb_agg(jsonb_build_object('clase', c.name, 'sesiones', z.n, 'presentes', z.p, 'detalle', z.det) order by c.name), '[]')
      from public.classes c cross join lateral (
        select count(*) n, count(r.user_id) p,
          coalesce(jsonb_agg(jsonb_build_object('fecha', s.opened_at, 'presente', r.user_id is not null, 'hora', r.marked_at, 'como', r.method)
            order by s.opened_at desc), '[]') det
        from public.attendance_sessions s left join public.attendance_records r on r.session_id = s.id and r.user_id = p_user
        where s.class_id = c.id) z
      where c.id = any(v_clases)),
    'entregas', (select coalesce(jsonb_agg(jsonb_build_object('buzon', b.title, 'clase', c.name, 'tipo', b.kind, 'cierra', b.closes_at,
        'permiso', x.status, 'archivos', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nombre', f.original_name, 'bytes', f.size_bytes,
            'subido', f.uploaded_at, 'estado', f.status, 'nota', f.review_note) order by f.uploaded_at desc), '[]')
          from public.upload_files f where f.box_id = b.id and f.user_id = p_user)) order by b.created_at desc), '[]')
      from public.upload_boxes b join public.classes c on c.id = b.class_id
      left join public.upload_permissions x on x.box_id = b.id and x.user_id = p_user
      where b.class_id = any(v_clases))
  );
end;
$$;

revoke all on function public.attendance_random_code() from public, anon, authenticated;
revoke all on function public.attendance_assert_teacher(uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'attendance_open(uuid, integer)', 'attendance_new_code(uuid, integer)', 'attendance_close(uuid)', 'attendance_set(uuid, uuid, boolean)',
    'attendance_live(uuid)', 'attendance_open_sessions()', 'attendance_report(uuid)', 'attendance_mark(text)', 'my_attendance()',
    'student_extras(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
