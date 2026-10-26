-- =============================================================================
-- Registro de Calificaciones (nota oficial por sección) y Secretaría del curso (monitor).
--   Distribución: parcial1 15 · parcial2 15 · parcial3 15 · práctica 30 · final 25 = 100.
--   Nota final = suma de categorías + extras aprobados, con máximo oficial 100 (se conserva el total bruto).
--   Una categoría sin nota (NULL) está PENDIENTE; 0 es una nota.
-- Todo el acceso pasa por funciones SECURITY DEFINER que verifican el papel del usuario: nadie lee ni escribe
-- las tablas directamente (RLS activada, sin políticas, sin permisos).
-- No modifica ninguna tabla existente.
-- =============================================================================

create or replace function public.grade_category_max(p_category text)
returns numeric language sql immutable set search_path = ''
as $$ select case p_category when 'parcial1' then 15 when 'parcial2' then 15 when 'parcial3' then 15
                             when 'practica' then 30 when 'final' then 25 end::numeric $$;

create table if not exists public.grade_settings (
  class_id uuid primary key references public.classes (id) on delete cascade,
  published boolean not null default false,
  extra_max_per_student numeric(5, 2) not null default 5 check (extra_max_per_student between 0 and 100),
  extra_max_per_operation numeric(5, 2) not null default 2 check (extra_max_per_operation > 0 and extra_max_per_operation <= 100),
  extra_from date,
  extra_to date,
  extra_requires_approval boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (extra_from is null or extra_to is null or extra_from <= extra_to)
);

create table if not exists public.grade_entries (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('parcial1', 'parcial2', 'parcial3', 'practica', 'final')),
  score numeric(5, 2) check (score is null or (score >= 0 and score <= public.grade_category_max(category))),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (class_id, user_id, category)
);

create table if not exists public.grade_history (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  old_score numeric(5, 2),
  new_score numeric(5, 2),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists grade_history_idx on public.grade_history (class_id, user_id, changed_at desc);

create table if not exists public.class_monitors (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz
);
create unique index if not exists class_monitors_activo on public.class_monitors (class_id, user_id) where revoked_at is null;

create table if not exists public.extra_points (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,                  -- generado por el navegador: evita solicitudes duplicadas
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,      -- beneficiado
  assigned_by uuid references public.profiles (id) on delete set null,
  assigner_role text not null check (assigner_role in ('monitor', 'profesor')),
  points numeric(5, 2) not null check (points > 0 and points <= 100),
  reason text not null check (char_length(btrim(reason)) between 3 and 300),
  status text not null check (status in ('pendiente', 'aprobado', 'rechazado', 'revertido')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 300),
  check (user_id <> assigned_by)
);
create index if not exists extra_points_idx on public.extra_points (class_id, user_id);

alter table public.grade_settings enable row level security;
alter table public.grade_entries enable row level security;
alter table public.grade_history enable row level security;
alter table public.class_monitors enable row level security;
alter table public.extra_points enable row level security;
revoke all on public.grade_settings, public.grade_entries, public.grade_history, public.class_monitors, public.extra_points
  from anon, authenticated;

-- historial automático de toda modificación de una nota (no se puede omitir desde la aplicación)
create or replace function public.grade_entries_log()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.score is distinct from old.score then
    insert into public.grade_history (class_id, user_id, category, old_score, new_score, changed_by)
      values (new.class_id, new.user_id, new.category, case when tg_op = 'UPDATE' then old.score end, new.score, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists grade_entries_log on public.grade_entries;
create trigger grade_entries_log after insert or update on public.grade_entries
  for each row execute function public.grade_entries_log();

-- --- autorización -----------------------------------------------------------------------
create or replace function public.grades_teacher(p_class uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_teacher() and (public.is_class_teacher(p_class)
             or public.is_course_staff((select course_id from public.classes where id = p_class))) $$;

create or replace function public.is_class_monitor(p_class uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.my_account_ok() and exists (select 1 from public.class_monitors m
        join public.enrollments e on e.class_id = m.class_id and e.user_id = m.user_id
        where m.class_id = p_class and m.user_id = auth.uid() and m.revoked_at is null) $$;

create or replace function public.grades_assert_teacher(p_class uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$ begin
  if p_class is null or not public.grades_teacher(p_class) then
    raise exception 'Solo el profesor de la sección' using errcode = '42501';
  end if;
end $$;

-- --- profesor: registro ---------------------------------------------------------------------
create or replace function public.gradebook_official(p_class uuid)
returns table (user_id uuid, full_name text, student_code text, parcial1 numeric, parcial2 numeric, parcial3 numeric,
  practica numeric, final numeric, extras numeric, extras_pendientes numeric, bruto numeric, nota_final numeric,
  pendientes integer, es_monitor boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return query
  with alumnos as (
    select e.user_id, p.full_name, p.student_code from public.enrollments e
    join public.profiles p on p.id = e.user_id and p.role = 'student' where e.class_id = p_class
  ), notas as (
    select g.user_id,
      max(g.score) filter (where g.category = 'parcial1') p1, max(g.score) filter (where g.category = 'parcial2') p2,
      max(g.score) filter (where g.category = 'parcial3') p3, max(g.score) filter (where g.category = 'practica') pr,
      max(g.score) filter (where g.category = 'final') fi
    from public.grade_entries g where g.class_id = p_class group by g.user_id
  ), ext as (
    select x.user_id, coalesce(sum(x.points) filter (where x.status = 'aprobado'), 0) ap,
      coalesce(sum(x.points) filter (where x.status = 'pendiente'), 0) pe
    from public.extra_points x where x.class_id = p_class group by x.user_id
  )
  select a.user_id, a.full_name, a.student_code, n.p1, n.p2, n.p3, n.pr, n.fi,
    coalesce(x.ap, 0), coalesce(x.pe, 0),
    coalesce(n.p1, 0) + coalesce(n.p2, 0) + coalesce(n.p3, 0) + coalesce(n.pr, 0) + coalesce(n.fi, 0) + coalesce(x.ap, 0),
    least(100, coalesce(n.p1, 0) + coalesce(n.p2, 0) + coalesce(n.p3, 0) + coalesce(n.pr, 0) + coalesce(n.fi, 0) + coalesce(x.ap, 0)),
    ((n.p1 is null)::int + (n.p2 is null)::int + (n.p3 is null)::int + (n.pr is null)::int + (n.fi is null)::int),
    exists (select 1 from public.class_monitors m where m.class_id = p_class and m.user_id = a.user_id and m.revoked_at is null)
  from alumnos a left join notas n on n.user_id = a.user_id left join ext x on x.user_id = a.user_id
  order by a.full_name;
end;
$$;

-- p_score NULL = pendiente. Solo el profesor; solo estudiantes inscritos en la sección.
create or replace function public.set_official_grade(p_class uuid, p_user uuid, p_category text, p_score numeric)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  if not exists (select 1 from public.enrollments where class_id = p_class and user_id = p_user) then
    raise exception 'El estudiante no pertenece a la sección' using errcode = '42501';
  end if;
  if public.grade_category_max(p_category) is null then raise exception 'Categoría no válida' using errcode = '22023'; end if;
  if p_score is not null and (p_score < 0 or p_score > public.grade_category_max(p_category)) then
    raise exception 'La nota de % debe estar entre 0 y %', p_category, public.grade_category_max(p_category) using errcode = '22023';
  end if;
  insert into public.grade_entries (class_id, user_id, category, score, updated_by)
    values (p_class, p_user, p_category, round(p_score, 2), auth.uid())
    on conflict (class_id, user_id, category) do update
      set score = excluded.score, updated_by = excluded.updated_by, updated_at = now()
      where public.grade_entries.score is distinct from excluded.score;
end;
$$;

create or replace function public.official_grade_settings(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare r public.grade_settings;
begin
  if not (public.grades_teacher(p_class) or public.is_class_monitor(p_class)) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  select * into r from public.grade_settings where class_id = p_class;
  return jsonb_build_object('published', coalesce(r.published, false),
    'extra_max_per_student', coalesce(r.extra_max_per_student, 5), 'extra_max_per_operation', coalesce(r.extra_max_per_operation, 2),
    'extra_from', r.extra_from, 'extra_to', r.extra_to, 'extra_requires_approval', coalesce(r.extra_requires_approval, true));
end;
$$;

create or replace function public.set_official_grade_settings(p_class uuid, p_published boolean, p_max_student numeric,
  p_max_operation numeric, p_from date, p_to date, p_requires_approval boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  insert into public.grade_settings as s (class_id, published, extra_max_per_student, extra_max_per_operation, extra_from, extra_to,
      extra_requires_approval, updated_by)
    values (p_class, p_published, p_max_student, p_max_operation, p_from, p_to, p_requires_approval, auth.uid())
    on conflict (class_id) do update set published = excluded.published, extra_max_per_student = excluded.extra_max_per_student,
      extra_max_per_operation = excluded.extra_max_per_operation, extra_from = excluded.extra_from, extra_to = excluded.extra_to,
      extra_requires_approval = excluded.extra_requires_approval, updated_by = excluded.updated_by, updated_at = now();
  return public.official_grade_settings(p_class);
end;
$$;

-- Cargo de monitor (uno o varios por sección; revocar conserva el historial)
create or replace function public.set_class_monitor(p_class uuid, p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  if not exists (select 1 from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
                 where e.class_id = p_class and e.user_id = p_user) then
    raise exception 'El estudiante no pertenece a la sección' using errcode = '42501';
  end if;
  if p_active then
    insert into public.class_monitors (class_id, user_id, assigned_by) values (p_class, p_user, auth.uid())
      on conflict do nothing;
  else
    update public.class_monitors set revoked_at = now(), revoked_by = auth.uid()
      where class_id = p_class and user_id = p_user and revoked_at is null;
  end if;
end;
$$;

-- Historial de un estudiante: modificaciones de notas y movimientos de extras
create or replace function public.official_grade_history(p_class uuid, p_user uuid)
returns table (cuando timestamptz, tipo text, categoria text, antes numeric, despues numeric, puntos numeric, motivo text,
  estado text, autor text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return query
  select h.changed_at, 'nota'::text, h.category, h.old_score, h.new_score, null::numeric, null::text, null::text, coalesce(p.full_name, '')
    from public.grade_history h left join public.profiles p on p.id = h.changed_by
    where h.class_id = p_class and (p_user is null or h.user_id = p_user)
  union all
  select x.created_at, 'extra:' || x.assigner_role, null, null, null, x.points, x.reason, x.status, coalesce(p.full_name, '')
    from public.extra_points x left join public.profiles p on p.id = x.assigned_by
    where x.class_id = p_class and (p_user is null or x.user_id = p_user)
  order by 1 desc;
end;
$$;

-- --- puntos extras ---------------------------------------------------------------------------
create or replace function public.class_extra_points(p_class uuid)
returns table (id uuid, user_id uuid, alumno text, asignado_por text, assigner_role text, points numeric, reason text, status text,
  created_at timestamptz, reviewed_at timestamptz, review_note text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return query
  select x.id, x.user_id, a.full_name, coalesce(m.full_name, ''), x.assigner_role, x.points, x.reason, x.status, x.created_at,
    x.reviewed_at, x.review_note
  from public.extra_points x join public.profiles a on a.id = x.user_id left join public.profiles m on m.id = x.assigned_by
  where x.class_id = p_class order by x.created_at desc;
end;
$$;

-- Asignación por el monitor (o el profesor). Idempotente por p_request.
create or replace function public.add_extra_points(p_request uuid, p_class uuid, p_user uuid, p_points numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prof boolean;
  v_s public.grade_settings;
  v_ya numeric;
  v_row public.extra_points;
  v_hoy date := (now() at time zone 'America/Santo_Domingo')::date;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_request is null then raise exception 'Falta el identificador de la solicitud' using errcode = '22023'; end if;
  select * into v_row from public.extra_points where request_id = p_request;
  if found then
    if v_row.assigned_by <> v_uid then raise exception 'Solicitud ajena' using errcode = '42501'; end if;
    return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', true);
  end if;
  v_prof := public.grades_teacher(p_class);
  if not v_prof and not public.is_class_monitor(p_class) then
    raise exception 'Solo el monitor o el profesor de la sección' using errcode = '42501';
  end if;
  if p_user = v_uid then raise exception 'No puede asignarse puntos a sí mismo' using errcode = '42501'; end if;
  if not exists (select 1 from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
                 where e.class_id = p_class and e.user_id = p_user) then
    raise exception 'El estudiante no pertenece a la sección' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 or char_length(p_reason) > 300 then
    raise exception 'Escriba el motivo (3 a 300 caracteres)' using errcode = '22023';
  end if;
  if p_points is null or p_points <= 0 then raise exception 'La cantidad debe ser positiva' using errcode = '22023'; end if;

  -- serializa las asignaciones al mismo estudiante (evita superar el máximo con peticiones simultáneas)
  perform pg_advisory_xact_lock(hashtextextended('extras:' || p_class::text || p_user::text, 0));
  select * into v_s from public.grade_settings where class_id = p_class;
  if not v_prof then
    if v_s.extra_from is not null and v_hoy < v_s.extra_from or v_s.extra_to is not null and v_hoy > v_s.extra_to then
      raise exception 'Las asignaciones de extras no están habilitadas en esta fecha' using errcode = 'P0001';
    end if;
    if p_points > coalesce(v_s.extra_max_per_operation, 2) then
      raise exception 'Máximo % puntos por asignación', coalesce(v_s.extra_max_per_operation, 2) using errcode = 'P0001';
    end if;
  end if;
  select coalesce(sum(points), 0) into v_ya from public.extra_points
    where class_id = p_class and user_id = p_user and status in ('pendiente', 'aprobado');
  if v_ya + p_points > coalesce(v_s.extra_max_per_student, 5) then
    raise exception 'Superaría el máximo de % puntos extras por estudiante (ya tiene %)', coalesce(v_s.extra_max_per_student, 5), v_ya
      using errcode = 'P0001';
  end if;

  insert into public.extra_points (request_id, class_id, user_id, assigned_by, assigner_role, points, reason, status,
      reviewed_by, reviewed_at)
    values (p_request, p_class, p_user, v_uid, case when v_prof then 'profesor' else 'monitor' end, round(p_points, 2), btrim(p_reason),
      case when v_prof or not coalesce(v_s.extra_requires_approval, true) then 'aprobado' else 'pendiente' end,
      case when v_prof then v_uid end, case when v_prof then now() end)
    returning * into v_row;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', false);
end;
$$;

-- Aprobar, rechazar o revertir (profesor). La fila se conserva siempre.
create or replace function public.review_extra_points(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_row public.extra_points;
begin
  select * into v_row from public.extra_points where id = p_id for update;
  if not found then raise exception 'Asignación no encontrada' using errcode = 'P0002'; end if;
  perform public.grades_assert_teacher(v_row.class_id);
  if p_status not in ('aprobado', 'rechazado', 'revertido') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  if p_status = 'revertido' and v_row.status <> 'aprobado' then raise exception 'Solo se revierte lo aprobado' using errcode = 'P0001'; end if;
  if p_status in ('aprobado', 'rechazado') and v_row.status <> 'pendiente' then raise exception 'La asignación ya fue revisada' using errcode = 'P0001'; end if;
  update public.extra_points set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(btrim(p_note), '')
    where id = p_id;
end;
$$;

-- --- monitor: Secretaría del curso -------------------------------------------------------------
create or replace function public.my_monitor_classes()
returns table (class_id uuid, class_name text, course_title text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, k.title from public.class_monitors m
  join public.classes c on c.id = m.class_id and not c.archived
  join public.courses k on k.id = c.course_id
  join public.enrollments e on e.class_id = m.class_id and e.user_id = m.user_id
  where m.user_id = auth.uid() and m.revoked_at is null and public.my_account_ok()
$$;

-- Compañeros de la sección (solo nombre y matrícula: el monitor NO ve las notas)
create or replace function public.monitor_classmates(p_class uuid)
returns table (user_id uuid, full_name text, student_code text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_monitor(p_class) then raise exception 'Solo el monitor de la sección' using errcode = '42501'; end if;
  return query select p.id, p.full_name, p.student_code from public.enrollments e
    join public.profiles p on p.id = e.user_id and p.role = 'student'
    where e.class_id = p_class and e.user_id <> auth.uid() order by p.full_name;
end;
$$;

create or replace function public.my_extra_assignments(p_class uuid)
returns table (id uuid, alumno text, points numeric, reason text, status text, created_at timestamptz, review_note text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_monitor(p_class) and not public.grades_teacher(p_class) then raise exception 'Sin acceso' using errcode = '42501'; end if;
  return query select x.id, p.full_name, x.points, x.reason, x.status, x.created_at, x.review_note
    from public.extra_points x join public.profiles p on p.id = x.user_id
    where x.class_id = p_class and x.assigned_by = auth.uid() order by x.created_at desc;
end;
$$;

-- --- estudiante: mis notas (solo secciones con notas publicadas) ----------------------------------
create or replace function public.my_official_grades()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', c.id, 'class_name', c.name, 'course_title', k.title,
    'published', coalesce(s.published, false),
    'notas', case when coalesce(s.published, false) then (
       select jsonb_object_agg(g.category, g.score) from public.grade_entries g where g.class_id = c.id and g.user_id = auth.uid())
     end,
    'extras', case when coalesce(s.published, false) then (
       select coalesce(jsonb_agg(jsonb_build_object('points', x.points, 'reason', x.reason, 'created_at', x.created_at) order by x.created_at), '[]'::jsonb)
       from public.extra_points x where x.class_id = c.id and x.user_id = auth.uid() and x.status = 'aprobado')
     end
  ) order by k.title), '[]'::jsonb)
  from public.enrollments e
  join public.classes c on c.id = e.class_id and not c.archived
  join public.courses k on k.id = c.course_id
  left join public.grade_settings s on s.class_id = c.id
  where e.user_id = auth.uid() and public.my_account_ok()
$$;

-- --- permisos -----------------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'grades_teacher(uuid)', 'is_class_monitor(uuid)', 'gradebook_official(uuid)', 'set_official_grade(uuid, uuid, text, numeric)',
    'official_grade_settings(uuid)', 'set_official_grade_settings(uuid, boolean, numeric, numeric, date, date, boolean)',
    'set_class_monitor(uuid, uuid, boolean)', 'official_grade_history(uuid, uuid)', 'class_extra_points(uuid)',
    'add_extra_points(uuid, uuid, uuid, numeric, text)', 'review_extra_points(uuid, text, text)', 'my_monitor_classes()',
    'monitor_classmates(uuid)', 'my_extra_assignments(uuid)', 'my_official_grades()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.grades_assert_teacher(uuid) from public, anon, authenticated;
revoke all on function public.grade_entries_log() from public, anon, authenticated;
