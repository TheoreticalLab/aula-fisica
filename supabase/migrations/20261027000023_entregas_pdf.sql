-- =============================================================================
-- Entregas en PDF (prácticas y exámenes escritos en papel, escaneados) con autorización del profesor.
--
-- Flujo:
--   1) El profesor crea un BUZÓN en una sección (título, instrucciones, apertura/cierre, máximo de archivos y MB).
--   2) El estudiante SOLICITA autorización (con un mensaje opcional). El profesor la aprueba o la rechaza; también
--      puede autorizar a un estudiante sin que lo pida, o a todos a la vez. Un buzón puede no exigir autorización.
--   3) Solo con la autorización aprobada y dentro del plazo, el estudiante sube su PDF. La subida la hace la Edge
--      Function «entregas» (servidor): comprueba aquí la autorización (svc_upload_*), verifica que el archivo es un
--      PDF real y lo guarda en un almacenamiento PRIVADO. El navegador nunca escribe en el almacenamiento.
--   4) El profesor revisa cada archivo: aceptado / rechazado (con nota). Los rechazados no cuentan para el máximo,
--      así el estudiante puede volver a subir. Nada se borra: queda el historial de lo entregado.
-- Las tablas no son accesibles directamente (sin permisos para anon/authenticated): todo pasa por funciones.
-- Aditiva: tablas y funciones nuevas.
-- =============================================================================

create table if not exists public.upload_boxes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  kind text not null default 'practica' check (kind in ('practica', 'examen', 'otro')),
  opens_at timestamptz,
  closes_at timestamptz,
  requires_approval boolean not null default true,
  max_files integer not null default 1 check (max_files between 1 and 10),
  max_mb integer not null default 10 check (max_mb between 1 and 20),
  archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);
create index if not exists upload_boxes_class_idx on public.upload_boxes (class_id, created_at desc);

create table if not exists public.upload_permissions (
  box_id uuid not null references public.upload_boxes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('solicitado', 'aprobado', 'rechazado', 'revocado')),
  request_note text check (request_note is null or char_length(request_note) <= 500),
  requested_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  primary key (box_id, user_id)
);

create table if not exists public.upload_files (
  id uuid primary key,                                  -- lo genera el servidor antes de guardar el archivo
  box_id uuid not null references public.upload_boxes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 200),
  size_bytes integer not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_at timestamptz not null default now(),
  status text not null default 'recibido' check (status in ('recibido', 'aceptado', 'rechazado')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz
);
create index if not exists upload_files_box_idx on public.upload_files (box_id, user_id, uploaded_at desc);

alter table public.upload_boxes enable row level security;
alter table public.upload_permissions enable row level security;
alter table public.upload_files enable row level security;
revoke all on public.upload_boxes, public.upload_permissions, public.upload_files from anon, authenticated;

-- ¿Puede este usuario subir ahora a este buzón? null = sí; si no, el motivo en palabras.
create or replace function public.upload_block_reason(p_user uuid, p_box uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when b.id is null then 'El buzón no existe'
    when not exists (select 1 from public.enrollments e where e.class_id = b.class_id and e.user_id = p_user) then 'No está inscrito en esta sección'
    when not public.account_ok(p_user) then 'Su cuenta no está activa'
    when b.archived then 'El buzón está cerrado'
    when b.opens_at is not null and b.opens_at > now() then 'El buzón aún no abre'
    when b.closes_at is not null and b.closes_at < now() then 'El plazo de entrega terminó'
    when b.requires_approval and coalesce((select p.status from public.upload_permissions p where p.box_id = b.id and p.user_id = p_user), '') <> 'aprobado'
      then 'Necesita la autorización del profesor'
    when (select count(*) from public.upload_files f where f.box_id = b.id and f.user_id = p_user and f.status <> 'rechazado') >= b.max_files
      then 'Ya entregó el máximo de archivos permitido'
  end
  from (select 1) uno left join public.upload_boxes b on b.id = p_box
$$;

-- --- profesorado -----------------------------------------------------------------------------------------------
create or replace function public.upload_box_assert_teacher(p_box uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.upload_boxes where id = p_box;
  if v_class is null or not public.is_teacher() or not public.is_class_teacher(v_class) then
    raise exception 'No tiene acceso a este buzón' using errcode = '42501';
  end if;
  return v_class;
end;
$$;

create or replace function public.upload_box_save(p_id uuid, p_class uuid, p_title text, p_instructions text, p_kind text,
  p_opens timestamptz, p_closes timestamptz, p_requires_approval boolean, p_max_files integer, p_max_mb integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if p_id is null then
    if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
    insert into public.upload_boxes (class_id, title, instructions, kind, opens_at, closes_at, requires_approval, max_files, max_mb, created_by)
      values (p_class, btrim(p_title), coalesce(p_instructions, ''), coalesce(p_kind, 'practica'), p_opens, p_closes,
              coalesce(p_requires_approval, true), coalesce(p_max_files, 1), coalesce(p_max_mb, 10), auth.uid())
      returning id into v_id;
  else
    perform public.upload_box_assert_teacher(p_id);
    update public.upload_boxes set title = btrim(p_title), instructions = coalesce(p_instructions, ''), kind = coalesce(p_kind, kind),
      opens_at = p_opens, closes_at = p_closes, requires_approval = coalesce(p_requires_approval, requires_approval),
      max_files = coalesce(p_max_files, max_files), max_mb = coalesce(p_max_mb, max_mb), updated_at = now()
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.upload_box_archive(p_id uuid, p_archived boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.upload_box_assert_teacher(p_id);
  update public.upload_boxes set archived = coalesce(p_archived, true), updated_at = now() where id = p_id;
end;
$$;

create or replace function public.upload_boxes_for_class(p_class uuid)
returns table (id uuid, title text, instructions text, kind text, opens_at timestamptz, closes_at timestamptz, requires_approval boolean,
  max_files integer, max_mb integer, archived boolean, created_at timestamptz, estudiantes bigint, solicitudes_pendientes bigint,
  autorizados bigint, con_entrega bigint, archivos bigint, sin_revisar bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  return query
  select b.id, b.title, b.instructions, b.kind, b.opens_at, b.closes_at, b.requires_approval, b.max_files, b.max_mb, b.archived, b.created_at,
    (select count(*) from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' where e.class_id = b.class_id),
    (select count(*) from public.upload_permissions x where x.box_id = b.id and x.status = 'solicitado'),
    (select count(*) from public.upload_permissions x where x.box_id = b.id and x.status = 'aprobado'),
    (select count(distinct f.user_id) from public.upload_files f where f.box_id = b.id and f.status <> 'rechazado'),
    (select count(*) from public.upload_files f where f.box_id = b.id),
    (select count(*) from public.upload_files f where f.box_id = b.id and f.status = 'recibido')
  from public.upload_boxes b where b.class_id = p_class
  order by b.archived, b.created_at desc;
end;
$$;

create or replace function public.upload_box_students(p_box uuid)
returns table (user_id uuid, full_name text, student_code text, permiso text, request_note text, requested_at timestamptz,
  decided_at timestamptz, decision_note text, archivos jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid := public.upload_box_assert_teacher(p_box);
begin
  return query
  select p.id, p.full_name, p.student_code, x.status, x.request_note, x.requested_at, x.decided_at, x.decision_note,
    (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nombre', f.original_name, 'bytes', f.size_bytes, 'subido', f.uploaded_at,
        'estado', f.status, 'nota', f.review_note, 'revisado', f.reviewed_at) order by f.uploaded_at desc), '[]')
     from public.upload_files f where f.box_id = p_box and f.user_id = p.id)
  from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
  left join public.upload_permissions x on x.box_id = p_box and x.user_id = p.id
  where e.class_id = v_class
  order by (x.status = 'solicitado') desc nulls last, p.full_name;
end;
$$;

create or replace function public.upload_permission_decide(p_box uuid, p_user uuid, p_status text, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := public.upload_box_assert_teacher(p_box);
begin
  if p_status not in ('aprobado', 'rechazado', 'revocado') then raise exception 'Decisión no válida' using errcode = '22023'; end if;
  if not exists (select 1 from public.enrollments e where e.class_id = v_class and e.user_id = p_user) then
    raise exception 'El estudiante no está en esta sección' using errcode = '22023';
  end if;
  insert into public.upload_permissions (box_id, user_id, status, decided_by, decided_at, decision_note)
    values (p_box, p_user, p_status, auth.uid(), now(), nullif(btrim(p_note), ''))
  on conflict (box_id, user_id) do update set status = excluded.status, decided_by = excluded.decided_by,
    decided_at = excluded.decided_at, decision_note = excluded.decision_note;
end;
$$;

-- Autoriza a todos los estudiantes de la sección (no cambia a los rechazados ni revocados expresamente)
create or replace function public.upload_permission_approve_all(p_box uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := public.upload_box_assert_teacher(p_box); n integer;
begin
  insert into public.upload_permissions (box_id, user_id, status, decided_by, decided_at)
  select p_box, e.user_id, 'aprobado', auth.uid(), now()
  from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
  where e.class_id = v_class
  on conflict (box_id, user_id) do update set status = 'aprobado', decided_by = excluded.decided_by, decided_at = excluded.decided_at
    where public.upload_permissions.status = 'solicitado';
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.upload_file_review(p_file uuid, p_status text, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_box uuid;
begin
  select box_id into v_box from public.upload_files where id = p_file;
  if v_box is null then raise exception 'Archivo no encontrado' using errcode = 'P0002'; end if;
  perform public.upload_box_assert_teacher(v_box);
  if p_status not in ('recibido', 'aceptado', 'rechazado') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  update public.upload_files set status = p_status, review_note = nullif(btrim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_file;
end;
$$;

-- --- estudiantes -------------------------------------------------------------------------------------------------
create or replace function public.my_upload_boxes()
returns table (id uuid, class_name text, course_title text, title text, instructions text, kind text, opens_at timestamptz,
  closes_at timestamptz, requires_approval boolean, max_files integer, max_mb integer, permiso text, decision_note text,
  puede_subir boolean, motivo text, archivos jsonb)
language sql stable security definer set search_path = ''
as $$
  select b.id, c.name, co.title, b.title, b.instructions, b.kind, b.opens_at, b.closes_at, b.requires_approval, b.max_files, b.max_mb,
    x.status, x.decision_note,
    public.upload_block_reason(auth.uid(), b.id) is null,
    public.upload_block_reason(auth.uid(), b.id),
    (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nombre', f.original_name, 'bytes', f.size_bytes, 'subido', f.uploaded_at,
        'estado', f.status, 'nota', f.review_note) order by f.uploaded_at desc), '[]')
     from public.upload_files f where f.box_id = b.id and f.user_id = auth.uid())
  from public.upload_boxes b
  join public.enrollments e on e.class_id = b.class_id and e.user_id = auth.uid()
  join public.classes c on c.id = b.class_id join public.courses co on co.id = c.course_id
  left join public.upload_permissions x on x.box_id = b.id and x.user_id = auth.uid()
  where not b.archived and public.my_account_ok()
  order by coalesce(b.closes_at, 'infinity'::timestamptz), b.created_at desc
$$;

create or replace function public.upload_permission_request(p_box uuid, p_note text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); b public.upload_boxes; v_actual text;
begin
  select * into b from public.upload_boxes where id = p_box;
  if b.id is null or not exists (select 1 from public.enrollments e where e.class_id = b.class_id and e.user_id = v_uid) or not public.my_account_ok() then
    raise exception 'No tiene acceso a este buzón' using errcode = '42501';
  end if;
  if b.archived or (b.closes_at is not null and b.closes_at < now()) then raise exception 'El buzón está cerrado' using errcode = 'P0001'; end if;
  if not b.requires_approval then return 'aprobado'; end if;
  select status into v_actual from public.upload_permissions where box_id = p_box and user_id = v_uid;
  if v_actual = 'aprobado' then return 'aprobado'; end if;
  if v_actual = 'revocado' then raise exception 'El profesor retiró su autorización para este buzón' using errcode = 'P0001'; end if;
  insert into public.upload_permissions (box_id, user_id, status, request_note, requested_at)
    values (p_box, v_uid, 'solicitado', nullif(btrim(p_note), ''), now())
  on conflict (box_id, user_id) do update set status = 'solicitado', request_note = excluded.request_note, requested_at = now(),
    decided_by = null, decided_at = null, decision_note = null;
  return 'solicitado';
end;
$$;

-- --- servidor (Edge Function «entregas», con service_role) ----------------------------------------------------------
create or replace function public.svc_upload_check(p_user uuid, p_box uuid, p_size integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_motivo text := public.upload_block_reason(p_user, p_box); v_max integer;
begin
  if v_motivo is not null then raise exception '%', v_motivo using errcode = '42501'; end if;
  select max_mb into v_max from public.upload_boxes where id = p_box;
  if p_size is null or p_size <= 0 or p_size > v_max * 1048576 then
    raise exception 'El archivo supera el máximo de % MB', v_max using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true, 'max_mb', v_max);
end;
$$;

create or replace function public.svc_upload_record(p_user uuid, p_box uuid, p_file uuid, p_path text, p_name text, p_size integer, p_sha text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_motivo text; v_max integer;
begin
  -- se bloquea el buzón para que dos subidas simultáneas no superen el máximo de archivos
  select max_mb into v_max from public.upload_boxes where id = p_box for update;
  v_motivo := public.upload_block_reason(p_user, p_box);
  if v_motivo is not null then raise exception '%', v_motivo using errcode = '42501'; end if;
  if p_size > v_max * 1048576 then raise exception 'El archivo supera el máximo de % MB', v_max using errcode = '22023'; end if;
  if p_path <> p_box::text || '/' || p_user::text || '/' || p_file::text || '.pdf' then raise exception 'Ruta no válida' using errcode = '22023'; end if;
  insert into public.upload_files (id, box_id, user_id, storage_path, original_name, size_bytes, sha256)
    values (p_file, p_box, p_user, p_path, left(btrim(p_name), 200), p_size, p_sha);
  return jsonb_build_object('id', p_file, 'estado', 'recibido');
end;
$$;

-- Ruta del archivo para descargarlo: el propio estudiante, el profesorado de la sección o el administrador
create or replace function public.svc_upload_file_path(p_user uuid, p_file uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare f public.upload_files; v_class uuid; v_course uuid;
begin
  select * into f from public.upload_files where id = p_file;
  if f.id is null then raise exception 'Archivo no encontrado' using errcode = 'P0002'; end if;
  select b.class_id, c.course_id into v_class, v_course from public.upload_boxes b join public.classes c on c.id = b.class_id where b.id = f.box_id;
  if not public.account_ok(p_user) or not (
       f.user_id = p_user
       or exists (select 1 from public.class_teachers t where t.class_id = v_class and t.user_id = p_user)
       or exists (select 1 from public.course_staff s where s.course_id = v_course and s.user_id = p_user)
       or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')) then
    raise exception 'No tiene acceso a este archivo' using errcode = '42501';
  end if;
  return f.storage_path;
end;
$$;

revoke all on function public.upload_block_reason(uuid, uuid) from public, anon, authenticated;
revoke all on function public.upload_box_assert_teacher(uuid) from public, anon, authenticated;
revoke all on function public.svc_upload_check(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.svc_upload_record(uuid, uuid, uuid, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.svc_upload_file_path(uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_upload_check(uuid, uuid, integer) to service_role;
grant execute on function public.svc_upload_record(uuid, uuid, uuid, text, text, integer, text) to service_role;
grant execute on function public.svc_upload_file_path(uuid, uuid) to service_role;
do $$
declare f text;
begin
  foreach f in array array[
    'upload_box_save(uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, integer, integer)', 'upload_box_archive(uuid, boolean)',
    'upload_boxes_for_class(uuid)', 'upload_box_students(uuid)', 'upload_permission_decide(uuid, uuid, text, text)',
    'upload_permission_approve_all(uuid)', 'upload_file_review(uuid, text, text)', 'my_upload_boxes()', 'upload_permission_request(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
