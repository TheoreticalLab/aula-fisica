-- =============================================================================
-- Migración 84 · Asignaturas de LABORATORIO y la asignatura «Laboratorio de Física Básica»
-- =============================================================================
-- Una asignatura de laboratorio (courses.laboratorio_controles = N) no usa capítulos ni lecciones: el estudiante ve
--   · Módulo A «Subir controles»: N espacios de entrega fotográfica (Laboratorio de Física Básica: 8);
--   · Módulo B «Prácticas y/o exámenes»: las actividades de su sección, con el motor de evaluaciones de siempre.
--
-- Reutiliza las ENTREGAS existentes (migración 23) en lugar de crear un sistema paralelo:
--   · cada control es un buzón (upload_boxes) de su sección con control_number = 1…N, sin autorización previa y con un
--     máximo de UN archivo vigente. Los rechazados no cuentan (regla existente): «requiere corrección» = rechazado, lo
--     que habilita la sustitución SIN borrar la entrega anterior, que queda en el historial;
--   · los archivos son filas de upload_files (con mime, ancho y alto para las imágenes); la descarga se autoriza con
--     svc_upload_file_path (autor, profesorado de la sección, personal del curso o administrador);
--   · la revisión usa upload_file_review (aceptado = aprobado; rechazado = requiere corrección).
-- Añade: fechas individuales por estudiante (upload_box_extensions, válidas para cualquier buzón), registro inmutable de
-- revisiones (upload_file_revisiones, también para los PDF), creación automática de los N buzones por sección, vistas
-- para el estudiante y el profesorado, y la asignatura como dato (idempotente).
-- Las asignaturas existentes no cambian: laboratorio_controles es NULL para ellas y los listados de entregas
-- excluyen los controles (que tienen su propio panel).
-- Aditiva: columnas nuevas con valor nulo, tablas nuevas, create or replace de funciones con su firma y permisos.
-- =============================================================================

-- 1) columnas -------------------------------------------------------------------------------------------------
alter table public.courses add column if not exists laboratorio_controles smallint
  check (laboratorio_controles is null or laboratorio_controles between 1 and 20);
comment on column public.courses.laboratorio_controles is
  'Asignatura de laboratorio: número de controles fotográficos por estudiante (NULL = asignatura convencional).';

alter table public.upload_boxes add column if not exists control_number smallint
  check (control_number is null or control_number between 1 and 20);
create unique index if not exists upload_boxes_control_uidx on public.upload_boxes (class_id, control_number) where control_number is not null;
comment on column public.upload_boxes.control_number is 'Control de laboratorio n.º (NULL = buzón de entregas en PDF).';

alter table public.upload_files add column if not exists mime text
  check (mime is null or mime in ('image/webp', 'image/jpeg', 'image/png'));
alter table public.upload_files add column if not exists ancho integer check (ancho is null or ancho between 1 and 20000);
alter table public.upload_files add column if not exists alto integer check (alto is null or alto between 1 and 20000);
comment on column public.upload_files.mime is 'Imagen de un control de laboratorio (NULL = PDF de una entrega escrita).';

-- 2) fechas individuales (cualquier buzón; sin filas, nada cambia) ------------------------------------------------
create table if not exists public.upload_box_extensions (
  box_id uuid not null references public.upload_boxes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  opens_at timestamptz,
  closes_at timestamptz,
  set_by uuid references public.profiles (id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (box_id, user_id),
  check (opens_at is not null or closes_at is not null),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);
alter table public.upload_box_extensions enable row level security;
revoke all on public.upload_box_extensions from anon, authenticated;

-- 3) registro de revisiones: cada cambio de estado o de nota queda guardado (antes se sobrescribía) -------------------
create table if not exists public.upload_file_revisiones (
  id bigserial primary key,
  file_id uuid not null references public.upload_files (id) on delete cascade,
  estado_anterior text not null,
  estado_nuevo text not null,
  nota text,
  revisado_por uuid references public.profiles (id) on delete set null,
  revisado_at timestamptz not null default now()
);
create index if not exists upload_file_revisiones_file_idx on public.upload_file_revisiones (file_id, revisado_at);
alter table public.upload_file_revisiones enable row level security;
revoke all on public.upload_file_revisiones from anon, authenticated;

create or replace function public.upload_file_revision_trg()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status or new.review_note is distinct from old.review_note then
    insert into public.upload_file_revisiones (file_id, estado_anterior, estado_nuevo, nota, revisado_por)
      values (new.id, old.status, new.status, new.review_note, coalesce(new.reviewed_by, auth.uid()));
  end if;
  return new;
end;
$$;
drop trigger if exists upload_file_revision on public.upload_files;
create trigger upload_file_revision after update of status, review_note on public.upload_files
  for each row execute function public.upload_file_revision_trg();

-- 4) regla de subida: fechas individuales y mensajes propios de los controles (copia de la migración 23) ---------------
create or replace function public.upload_block_reason(p_user uuid, p_box uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when b.id is null then 'El buzón no existe'
    when not exists (select 1 from public.enrollments e where e.class_id = b.class_id and e.user_id = p_user) then 'No está inscrito en esta sección'
    when not public.account_ok(p_user) then 'Su cuenta no está activa'
    when b.archived then 'El buzón está cerrado'
    -- fechas: las individuales del estudiante (si las hay) prevalecen sobre las generales del buzón
    when coalesce(x.opens_at, b.opens_at) is not null and coalesce(x.opens_at, b.opens_at) > now() then 'El buzón aún no abre'
    when coalesce(x.closes_at, b.closes_at) is not null and coalesce(x.closes_at, b.closes_at) < now() then 'El plazo de entrega terminó'
    when b.requires_approval and coalesce((select p.status from public.upload_permissions p where p.box_id = b.id and p.user_id = p_user), '') <> 'aprobado'
      then 'Necesita la autorización del profesor'
    when (select count(*) from public.upload_files f where f.box_id = b.id and f.user_id = p_user and f.status <> 'rechazado') >= b.max_files
      then case
        when b.control_number is null then 'Ya entregó el máximo de archivos permitido'
        when exists (select 1 from public.upload_files f where f.box_id = b.id and f.user_id = p_user and f.status = 'aceptado') then 'Este control ya está aprobado'
        else 'Ya entregó este control. Si hay que cambiar la imagen, el profesor puede marcarlo «requiere corrección».'
      end
  end
  from (select 1) uno
  left join public.upload_boxes b on b.id = p_box
  left join public.upload_box_extensions x on x.box_id = b.id and x.user_id = p_user
$$;

-- 5) la subida de PDF no admite buzones de control (copia de la migración 23 + una comprobación) ----------------------
create or replace function public.svc_upload_record(p_user uuid, p_box uuid, p_file uuid, p_path text, p_name text, p_size integer, p_sha text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_motivo text; v_max integer;
begin
  -- se bloquea el buzón para que dos subidas simultáneas no superen el máximo de archivos
  select max_mb into v_max from public.upload_boxes where id = p_box for update;
  if (select control_number from public.upload_boxes where id = p_box) is not null then
    raise exception 'Los controles de laboratorio se entregan como imagen' using errcode = '22023';
  end if;
  v_motivo := public.upload_block_reason(p_user, p_box);
  if v_motivo is not null then raise exception '%', v_motivo using errcode = '42501'; end if;
  if p_size > v_max * 1048576 then raise exception 'El archivo supera el máximo de % MB', v_max using errcode = '22023'; end if;
  if p_path <> p_box::text || '/' || p_user::text || '/' || p_file::text || '.pdf' then raise exception 'Ruta no válida' using errcode = '22023'; end if;
  insert into public.upload_files (id, box_id, user_id, storage_path, original_name, size_bytes, sha256)
    values (p_file, p_box, p_user, p_path, left(btrim(p_name), 200), p_size, p_sha);
  return jsonb_build_object('id', p_file, 'estado', 'recibido');
end;
$$;

-- 6) registro de la imagen de un control (solo el servidor, tras comprobar la imagen y guardarla) ----------------------
create or replace function public.svc_lab_control_record(p_user uuid, p_box uuid, p_file uuid, p_path text, p_size integer, p_sha text,
  p_mime text, p_ancho integer, p_alto integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare b public.upload_boxes; v_motivo text; v_ext text;
begin
  -- bloqueo del buzón: dos envíos simultáneos del mismo control no pueden dejar dos imágenes vigentes
  select * into b from public.upload_boxes where id = p_box for update;
  if b.id is null or b.control_number is null then raise exception 'No es un control de laboratorio' using errcode = '22023'; end if;
  v_motivo := public.upload_block_reason(p_user, p_box);
  if v_motivo is not null then raise exception '%', v_motivo using errcode = '42501'; end if;
  if p_size is null or p_size <= 0 or p_size > b.max_mb * 1048576 then
    raise exception 'La imagen supera el máximo de % MB', b.max_mb using errcode = '22023';
  end if;
  v_ext := case p_mime when 'image/webp' then 'webp' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end;
  if v_ext is null then raise exception 'Formato de imagen no admitido' using errcode = '22023'; end if;
  if p_sha is null or p_sha !~ '^[0-9a-f]{64}$' then raise exception 'Huella no válida' using errcode = '22023'; end if;
  if p_path <> p_box::text || '/' || p_user::text || '/' || p_file::text || '.' || v_ext then raise exception 'Ruta no válida' using errcode = '22023'; end if;
  insert into public.upload_files (id, box_id, user_id, storage_path, original_name, size_bytes, sha256, mime, ancho, alto)
    values (p_file, p_box, p_user, p_path, 'Control ' || b.control_number || '.' || v_ext, p_size, p_sha, p_mime, p_ancho, p_alto);
  return jsonb_build_object('id', p_file, 'estado', 'recibido', 'subido', now());
end;
$$;

-- 7) los N controles de una sección de laboratorio (idempotente; nunca borra ni cambia los que existen) ---------------
create or replace function public.lab_asegurar_controles(p_class uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer; v integer;
begin
  select co.laboratorio_controles into n from public.classes c join public.courses co on co.id = c.course_id where c.id = p_class;
  if n is null then return 0; end if;
  insert into public.upload_boxes (class_id, title, instructions, kind, requires_approval, max_files, max_mb, control_number)
    select p_class, 'Control ' || g, '', 'otro', false, 1, 5, g from generate_series(1, n) g
    on conflict (class_id, control_number) where control_number is not null do nothing;
  get diagnostics v = row_count;
  return v;
end;
$$;

create or replace function public.lab_clase_trg()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.lab_asegurar_controles(new.id);
  return new;
end;
$$;
drop trigger if exists lab_controles_clase on public.classes;
create trigger lab_controles_clase after insert or update of course_id on public.classes
  for each row execute function public.lab_clase_trg();

create or replace function public.lab_curso_trg()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.laboratorio_controles is not null then
    perform public.lab_asegurar_controles(c.id) from public.classes c where c.course_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists lab_controles_curso on public.courses;
create trigger lab_controles_curso after insert or update of laboratorio_controles on public.courses
  for each row execute function public.lab_curso_trg();

-- 8) estado de un control para un estudiante (interno) ------------------------------------------------------------
-- pendiente: sin entregas · entregado: la última está sin revisar · aprobado: la última fue aceptada ·
-- requiere_correccion: la última fue rechazada (puede subir otra; la anterior se conserva)
create or replace function public.lab_control_json(p_box uuid, p_user uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'box_id', b.id, 'numero', b.control_number, 'titulo', b.title, 'instrucciones', b.instructions,
    'abre', coalesce(x.opens_at, b.opens_at), 'cierra', coalesce(x.closes_at, b.closes_at), 'fecha_individual', x.box_id is not null,
    'estado', case when u.id is null then 'pendiente' when u.status = 'recibido' then 'entregado'
                   when u.status = 'aceptado' then 'aprobado' else 'requiere_correccion' end,
    'historial', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'subido', f.uploaded_at, 'estado', f.status, 'nota', f.review_note,
                    'revisado', f.reviewed_at, 'bytes', f.size_bytes, 'mime', f.mime, 'ancho', f.ancho, 'alto', f.alto,
                    'revisiones', (select coalesce(jsonb_agg(jsonb_build_object('de', r.estado_anterior, 'a', r.estado_nuevo, 'nota', r.nota, 'en', r.revisado_at)
                                     order by r.revisado_at), '[]') from public.upload_file_revisiones r where r.file_id = f.id))
                    order by f.uploaded_at desc, f.id desc), '[]')
                  from public.upload_files f where f.box_id = b.id and f.user_id = p_user),
    'puede_subir', public.upload_block_reason(p_user, b.id) is null,
    'motivo', public.upload_block_reason(p_user, b.id))
  from public.upload_boxes b
  left join public.upload_box_extensions x on x.box_id = b.id and x.user_id = p_user
  left join lateral (select f.id, f.status from public.upload_files f where f.box_id = b.id and f.user_id = p_user
                     order by f.uploaded_at desc, f.id desc limit 1) u on true
  where b.id = p_box
$$;

-- 9) estudiante: sus controles en cada sección de la asignatura (las de periodos anteriores también) ------------------
create or replace function public.lab_mis_controles(p_course uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); n integer;
begin
  if v_uid is null or not public.my_account_ok() then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select laboratorio_controles into n from public.courses where id = p_course;
  if n is null then raise exception 'Esta asignatura no tiene controles de laboratorio' using errcode = 'P0001'; end if;
  perform public.lab_asegurar_controles(e.class_id)
    from public.enrollments e join public.classes c on c.id = e.class_id where e.user_id = v_uid and c.course_id = p_course;
  return jsonb_build_object('controles', n, 'secciones', coalesce((
    select jsonb_agg(jsonb_build_object('class_id', c.id, 'seccion', c.name, 'archivada', c.archived,
      'controles', (select coalesce(jsonb_agg(public.lab_control_json(b.id, v_uid) order by b.control_number), '[]')
                    from public.upload_boxes b where b.class_id = c.id and b.control_number between 1 and n and not b.archived))
      order by c.archived, c.created_at desc)
    from public.enrollments e join public.classes c on c.id = e.class_id
    where e.user_id = v_uid and c.course_id = p_course), '[]'));
end;
$$;

-- 10) profesorado: tabla de la sección, detalle de un estudiante y fechas --------------------------------------------
create or replace function public.lab_controles_seccion(p_class uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare n integer; v_curso text; v_sec text;
begin
  if not public.grades_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  select co.laboratorio_controles, co.title, c.name into n, v_curso, v_sec
    from public.classes c join public.courses co on co.id = c.course_id where c.id = p_class;
  if n is null then raise exception 'Esta sección no es de una asignatura de laboratorio' using errcode = 'P0001'; end if;
  perform public.lab_asegurar_controles(p_class);
  return jsonb_build_object('controles', n, 'curso', v_curso, 'seccion', v_sec,
    'cajas', (select coalesce(jsonb_agg(jsonb_build_object('box_id', b.id, 'numero', b.control_number, 'abre', b.opens_at, 'cierra', b.closes_at,
                'archivado', b.archived) order by b.control_number), '[]')
              from public.upload_boxes b where b.class_id = p_class and b.control_number between 1 and n),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'nombre', p.full_name, 'matricula', p.student_code, 'login', p.login_id,
        'estados', z.estados, 'entregados', z.entregados, 'aprobados', z.aprobados, 'por_corregir', z.por_corregir, 'sin_revisar', z.sin_revisar)
        order by p.full_name), '[]')
      from public.enrollments e
      join public.profiles p on p.id = e.user_id and p.role = 'student'
      cross join lateral (
        select jsonb_agg(s.estado order by s.numero) estados,
          count(*) filter (where s.estado in ('entregado', 'aprobado')) entregados,
          count(*) filter (where s.estado = 'aprobado') aprobados,
          count(*) filter (where s.estado = 'requiere_correccion') por_corregir,
          count(*) filter (where s.estado = 'entregado') sin_revisar
        from (select b.control_number numero,
                case when u.id is null then 'pendiente' when u.status = 'recibido' then 'entregado'
                     when u.status = 'aceptado' then 'aprobado' else 'requiere_correccion' end estado
              from public.upload_boxes b
              left join lateral (select f.id, f.status from public.upload_files f where f.box_id = b.id and f.user_id = p.id
                                 order by f.uploaded_at desc, f.id desc limit 1) u on true
              where b.class_id = p_class and b.control_number between 1 and n) s) z
      where e.class_id = p_class));
end;
$$;

create or replace function public.lab_controles_estudiante(p_class uuid, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not public.grades_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = p_user) then
    raise exception 'El estudiante no pertenece a esta sección' using errcode = '42501';
  end if;
  select co.laboratorio_controles into n from public.classes c join public.courses co on co.id = c.course_id where c.id = p_class;
  if n is null then raise exception 'Esta sección no es de una asignatura de laboratorio' using errcode = 'P0001'; end if;
  perform public.lab_asegurar_controles(p_class);
  return jsonb_build_object(
    'estudiante', (select jsonb_build_object('user_id', p.id, 'nombre', p.full_name, 'matricula', p.student_code, 'login', p.login_id)
                   from public.profiles p where p.id = p_user),
    'controles', (select coalesce(jsonb_agg(public.lab_control_json(b.id, p_user) order by b.control_number), '[]')
                  from public.upload_boxes b where b.class_id = p_class and b.control_number between 1 and n));
end;
$$;

-- p_numero NULL = los N controles · p_user NULL = fechas generales del control; con estudiante = fechas individuales
-- (ambas fechas NULL con estudiante: quita sus fechas individuales y vuelven a valer las generales)
create or replace function public.lab_controles_fechas(p_class uuid, p_numero integer, p_user uuid, p_abre timestamptz, p_cierra timestamptz)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer; v integer;
begin
  if not public.grades_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  select co.laboratorio_controles into n from public.classes c join public.courses co on co.id = c.course_id where c.id = p_class;
  if n is null then raise exception 'Esta sección no es de una asignatura de laboratorio' using errcode = 'P0001'; end if;
  if p_numero is not null and (p_numero < 1 or p_numero > n) then raise exception 'Control inexistente' using errcode = '22023'; end if;
  if p_abre is not null and p_cierra is not null and p_cierra <= p_abre then
    raise exception 'El cierre debe ser posterior a la apertura' using errcode = '22023';
  end if;
  perform public.lab_asegurar_controles(p_class);
  if p_user is null then
    update public.upload_boxes set opens_at = p_abre, closes_at = p_cierra, updated_at = now()
      where class_id = p_class and control_number between 1 and n and (p_numero is null or control_number = p_numero);
  else
    if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = p_user) then
      raise exception 'El estudiante no pertenece a esta sección' using errcode = '42501';
    end if;
    if p_abre is null and p_cierra is null then
      delete from public.upload_box_extensions x using public.upload_boxes b
        where x.box_id = b.id and x.user_id = p_user and b.class_id = p_class and b.control_number between 1 and n
          and (p_numero is null or b.control_number = p_numero);
    else
      insert into public.upload_box_extensions (box_id, user_id, opens_at, closes_at, set_by)
        select b.id, p_user, p_abre, p_cierra, auth.uid() from public.upload_boxes b
        where b.class_id = p_class and b.control_number between 1 and n and (p_numero is null or b.control_number = p_numero)
      on conflict (box_id, user_id) do update set opens_at = excluded.opens_at, closes_at = excluded.closes_at, set_by = excluded.set_by, set_at = now();
    end if;
  end if;
  get diagnostics v = row_count;
  return v;
end;
$$;

-- revisión de una entrega de control: aprobado | requiere_correccion | entregado (devolver a «sin revisar»).
-- Usa las columnas de siempre (aceptado / rechazado / recibido); el disparador del punto 3 guarda cada cambio.
create or replace function public.lab_control_revisar(p_file uuid, p_estado text, p_nota text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare f public.upload_files; b public.upload_boxes; v_status text;
begin
  select * into f from public.upload_files where id = p_file;
  if f.id is null then raise exception 'Entrega no encontrada' using errcode = 'P0002'; end if;
  select * into b from public.upload_boxes where id = f.box_id;
  if not public.grades_teacher(b.class_id) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  if b.control_number is null then raise exception 'No es un control de laboratorio' using errcode = '22023'; end if;
  v_status := case p_estado when 'aprobado' then 'aceptado' when 'requiere_correccion' then 'rechazado' when 'entregado' then 'recibido' end;
  if v_status is null then raise exception 'Estado no válido' using errcode = '22023'; end if;
  -- solo se revisa la entrega vigente (la más reciente); las anteriores quedan como historial
  if exists (select 1 from public.upload_files g where g.box_id = f.box_id and g.user_id = f.user_id
             and (g.uploaded_at, g.id) > (f.uploaded_at, f.id)) then
    raise exception 'Hay una entrega más reciente de este control' using errcode = 'P0001';
  end if;
  update public.upload_files set status = v_status, review_note = nullif(btrim(left(coalesce(p_nota, ''), 1000)), ''),
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_file;
  return public.lab_control_json(f.box_id, f.user_id);
end;
$$;

-- los controles no se reconfiguran con las herramientas de los buzones en PDF: siempre una imagen, sin autorización
-- previa, en su sección y sin archivarse (así cada estudiante tiene siempre sus N controles)
create or replace function public.upload_boxes_control_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.control_number is distinct from new.control_number
     or (new.control_number is not null and (new.class_id <> old.class_id or new.max_files <> 1 or new.requires_approval or new.archived)) then
    raise exception 'Los controles de laboratorio no se modifican desde los buzones de entregas' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists upload_boxes_control_guard on public.upload_boxes;
create trigger upload_boxes_control_guard before update on public.upload_boxes
  for each row execute function public.upload_boxes_control_guard();

-- 11) los listados de entregas en PDF no muestran los controles (tienen su propio panel) --------------------------------
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
  where not b.archived and public.my_account_ok() and b.control_number is null
  order by coalesce(b.closes_at, 'infinity'::timestamptz), b.created_at desc
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
  from public.upload_boxes b where b.class_id = p_class and b.control_number is null
  order by b.archived, b.created_at desc;
end;
$$;

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
      where b.class_id = any(v_clases) and b.control_number is null)
  );
end;
$$;

-- 12) fusión de cuentas: las fechas individuales siguen al estudiante -------------------------------------------------
insert into public.fusion_tablas (tabla, estrategia, ancla, clave, orden, nota)
  values ('upload_box_extensions', 'unico', null, array['box_id'], 61, 'fechas individuales de un buzón o control de laboratorio')
  on conflict (tabla) do nothing;

-- 13) la asignatura (dato idempotente: si ya existe con ese código, no se toca) -----------------------------------------
insert into public.courses (title, code, description, laboratorio_controles)
  values ('Laboratorio de Física Básica', 'LAB-FIS-BASICA',
          'Laboratorio de Física Básica: ocho controles con evidencia fotográfica y las prácticas y exámenes del laboratorio.', 8)
  on conflict (code) do nothing;

-- 14) permisos ----------------------------------------------------------------------------------------------------
revoke all on function public.upload_file_revision_trg() from public, anon, authenticated;
revoke all on function public.lab_clase_trg() from public, anon, authenticated;
revoke all on function public.upload_boxes_control_guard() from public, anon, authenticated;
revoke all on function public.lab_control_revisar(uuid, text, text) from public, anon;
grant execute on function public.lab_control_revisar(uuid, text, text) to authenticated;
revoke all on function public.lab_curso_trg() from public, anon, authenticated;
revoke all on function public.lab_asegurar_controles(uuid) from public, anon, authenticated;
revoke all on function public.lab_control_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public.svc_lab_control_record(uuid, uuid, uuid, text, integer, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.svc_lab_control_record(uuid, uuid, uuid, text, integer, text, text, integer, integer) to service_role;
revoke all on function public.lab_mis_controles(uuid) from public, anon;
revoke all on function public.lab_controles_seccion(uuid) from public, anon;
revoke all on function public.lab_controles_estudiante(uuid, uuid) from public, anon;
revoke all on function public.lab_controles_fechas(uuid, integer, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.lab_mis_controles(uuid) to authenticated;
grant execute on function public.lab_controles_seccion(uuid) to authenticated;
grant execute on function public.lab_controles_estudiante(uuid, uuid) to authenticated;
grant execute on function public.lab_controles_fechas(uuid, integer, uuid, timestamptz, timestamptz) to authenticated;
