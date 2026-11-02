-- =============================================================================
-- Huellas de archivos: impedir que un estudiante suba lo que ya subió OTRO (migración 67). Decisión del profesor
-- (2 nov 2026): bloquear todo lo parecido, comparar en toda la asignatura (todas sus secciones) y poder autorizar un
-- duplicado concreto (trabajo en grupo).
--  · Huella exacta: SHA-256 calculado en el SERVIDOR sobre lo recibido, y el SHA-256 del archivo original que envía el
--    navegador (las imágenes se optimizan antes de subir). Detecta copias idénticas.
--  · Huella perceptual de imágenes (dHash de 64 bits, calculada en el navegador sobre la imagen decodificada): la misma
--    foto con otra resolución, compresión o formato da una huella casi igual. Se compara por distancia de Hamming
--    (bits distintos); se bloquea con distancia ≤ huella_umbral().
--  · PDF: solo huella exacta (un PDF reexportado o reescaneado cambia; no hay un equivalente perceptual sencillo).
--  · Al bloquear se registra una solicitud: el profesor la ve con los dos estudiantes y puede autorizarla; entonces ese
--    estudiante puede subir ese archivo. Al estudiante no se le dice quién subió el otro.
--  · Solo cuentan archivos que siguen existiendo. El primero que sube nunca queda bloqueado.
-- Aditiva: tablas y funciones nuevas; las huellas exactas de los archivos existentes se registran ahora.
-- =============================================================================

create table if not exists public.upload_fingerprints (
  kind text not null check (kind in ('captura', 'foto_libre', 'pdf')),
  object_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  sha256_original text check (sha256_original is null or sha256_original ~ '^[0-9a-f]{64}$'),
  dhash text check (dhash is null or dhash ~ '^[0-9a-f]{16}$'),
  created_at timestamptz not null default now(),
  primary key (kind, object_id)
);
create index if not exists upload_fingerprints_sha on public.upload_fingerprints (course_id, sha256);
create index if not exists upload_fingerprints_sha_orig on public.upload_fingerprints (course_id, sha256_original) where sha256_original is not null;
create index if not exists upload_fingerprints_curso on public.upload_fingerprints (course_id) where dhash is not null;

create table if not exists public.duplicate_requests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('captura', 'foto_libre', 'pdf')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  sha256_original text,
  dhash text check (dhash is null or dhash ~ '^[0-9a-f]{16}$'),
  distancia integer not null check (distancia between 0 and 64),
  coincide_kind text not null,
  coincide_object uuid not null,
  coincide_user uuid references public.profiles (id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'autorizada', 'rechazada')),
  nota text check (nota is null or char_length(nota) <= 300),
  intentos integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz
);
create unique index if not exists duplicate_requests_pendiente on public.duplicate_requests (user_id, sha256) where estado = 'pendiente';
create index if not exists duplicate_requests_clase on public.duplicate_requests (class_id, estado, created_at desc);

alter table public.upload_fingerprints enable row level security;
alter table public.duplicate_requests enable row level security;
revoke all on public.upload_fingerprints, public.duplicate_requests from anon, authenticated;

-- Archivos que ya existían: su huella exacta (sin huella perceptual: se calculaba solo en el navegador desde ahora)
insert into public.upload_fingerprints (kind, object_id, user_id, class_id, course_id, sha256, sha256_original, created_at)
  select 'captura', c.id, c.user_id, c.class_id, cl.course_id, c.sha256, c.sha256_original, c.created_at
  from public.hist_captures c join public.classes cl on cl.id = c.class_id
on conflict do nothing;
insert into public.upload_fingerprints (kind, object_id, user_id, class_id, course_id, sha256, sha256_original, created_at)
  select 'foto_libre', f.id, f.user_id, f.class_id, cl.course_id, f.sha256, f.sha256_original, f.created_at
  from public.hist_libre_fotos f join public.classes cl on cl.id = f.class_id
on conflict do nothing;
insert into public.upload_fingerprints (kind, object_id, user_id, class_id, course_id, sha256, created_at)
  select 'pdf', u.id, u.user_id, b.class_id, cl.course_id, u.sha256, u.uploaded_at
  from public.upload_files u join public.upload_boxes b on b.id = u.box_id join public.classes cl on cl.id = b.class_id
on conflict do nothing;

-- Distancia de Hamming entre dos huellas de 64 bits (hexadecimal)
create or replace function public.hamming64(a text, b text)
returns integer
language sql immutable set search_path = ''
as $$ select case when a is null or b is null then 64 else bit_count(('x' || a)::bit(64) # ('x' || b)::bit(64))::integer end $$;

-- Hasta cuántos bits distintos se considera «la misma imagen» (bloqueo de todo lo parecido)
create or replace function public.huella_umbral()
returns integer language sql immutable set search_path = '' as $$ select 10 $$;

-- ¿El objeto de la huella sigue existiendo? (un archivo borrado no bloquea a nadie)
create or replace function public.huella_vigente(p_kind text, p_object uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case p_kind
    when 'captura' then exists (select 1 from public.hist_captures where id = p_object)
    when 'foto_libre' then exists (select 1 from public.hist_libre_fotos where id = p_object)
    when 'pdf' then exists (select 1 from public.upload_files where id = p_object)
    else false end
$$;

-- Comprobación ANTES de guardar (Edge Function «entregas»): ok, o bloqueo con la solicitud registrada
create or replace function public.svc_huella_check(p_user uuid, p_class uuid, p_box uuid, p_kind text, p_sha text, p_sha_original text, p_dhash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := coalesce(p_class, (select class_id from public.upload_boxes where id = p_box)); v_course uuid; m record; v_req uuid;
  v_dhash text := case when p_dhash ~ '^[0-9a-f]{16}$' then p_dhash end;
  v_orig text := case when p_sha_original ~ '^[0-9a-f]{64}$' then p_sha_original end;
begin
  if p_kind not in ('captura', 'foto_libre', 'pdf') or p_sha !~ '^[0-9a-f]{64}$' then raise exception 'Huella no válida' using errcode = '22023'; end if;
  select course_id into v_course from public.classes where id = v_class;
  if v_course is null then raise exception 'Sección no encontrada' using errcode = 'P0001'; end if;
  select f.kind, f.object_id, f.user_id,
         case when f.sha256 = p_sha or (v_orig is not null and (f.sha256_original = v_orig or f.sha256 = v_orig)) then 0 else public.hamming64(f.dhash, v_dhash) end distancia
    into m
    from public.upload_fingerprints f
    where f.course_id = v_course and f.user_id <> p_user
      and (f.sha256 = p_sha or (v_orig is not null and (f.sha256_original = v_orig or f.sha256 = v_orig))
           or (v_dhash is not null and f.dhash is not null and public.hamming64(f.dhash, v_dhash) <= public.huella_umbral()))
      and public.huella_vigente(f.kind, f.object_id)
    order by 4, f.created_at limit 1;
  if m.object_id is null then return jsonb_build_object('ok', true); end if;
  -- trabajo en grupo: el profesor autorizó a ESTE estudiante a subir ESTE archivo (o la misma imagen)
  if exists (select 1 from public.duplicate_requests r where r.user_id = p_user and r.course_id = v_course and r.estado = 'autorizada'
             and (r.sha256 = p_sha or (v_orig is not null and r.sha256_original = v_orig) or (v_dhash is not null and public.hamming64(r.dhash, v_dhash) <= 2))) then
    return jsonb_build_object('ok', true, 'autorizado', true);
  end if;
  insert into public.duplicate_requests (class_id, course_id, user_id, kind, sha256, sha256_original, dhash, distancia, coincide_kind, coincide_object, coincide_user)
    values (v_class, v_course, p_user, p_kind, p_sha, v_orig, v_dhash, m.distancia, m.kind, m.object_id, m.user_id)
    on conflict (user_id, sha256) where estado = 'pendiente' do update set intentos = public.duplicate_requests.intentos + 1, updated_at = now(),
      distancia = excluded.distancia, coincide_kind = excluded.coincide_kind, coincide_object = excluded.coincide_object, coincide_user = excluded.coincide_user
    returning id into v_req;
  return jsonb_build_object('ok', false, 'exacto', m.distancia = 0, 'distancia', m.distancia, 'solicitud', v_req);
end;
$$;

-- Registro de la huella DESPUÉS de guardar el archivo
create or replace function public.svc_huella_guardar(p_kind text, p_object uuid, p_user uuid, p_class uuid, p_box uuid, p_sha text, p_sha_original text, p_dhash text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.upload_fingerprints (kind, object_id, user_id, class_id, course_id, sha256, sha256_original, dhash)
    select p_kind, p_object, p_user, c.id, c.course_id, p_sha,
      case when p_sha_original ~ '^[0-9a-f]{64}$' then p_sha_original end, case when p_dhash ~ '^[0-9a-f]{16}$' then p_dhash end
    from public.classes c where c.id = coalesce(p_class, (select class_id from public.upload_boxes where id = p_box))
  on conflict (kind, object_id) do update set sha256 = excluded.sha256, sha256_original = excluded.sha256_original, dhash = excluded.dhash
$$;

-- Profesor: coincidencias detectadas en su sección y decisión
create or replace function public.huellas_solicitudes(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'estado', r.estado, 'exacto', r.distancia = 0, 'distancia', r.distancia,
      'intentos', r.intentos, 'created_at', r.created_at, 'updated_at', r.updated_at, 'nota', r.nota, 'decided_at', r.decided_at,
      'estudiante', (select p.full_name from public.profiles p where p.id = r.user_id),
      'coincide_con', (select p.full_name from public.profiles p where p.id = r.coincide_user),
      'coincide_seccion', (select c.name from public.upload_fingerprints f join public.classes c on c.id = f.class_id
                           where f.kind = r.coincide_kind and f.object_id = r.coincide_object),
      'coincide_kind', r.coincide_kind, 'coincide_vigente', public.huella_vigente(r.coincide_kind, r.coincide_object))
    order by (r.estado = 'pendiente') desc, r.updated_at desc), '[]'::jsonb)
    from public.duplicate_requests r where r.class_id = p_class);
end;
$$;

create or replace function public.huella_decidir(p_id uuid, p_autorizar boolean, p_nota text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.duplicate_requests;
begin
  select * into r from public.duplicate_requests where id = p_id;
  if r.id is null or not public.is_class_teacher(r.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.duplicate_requests set estado = case when p_autorizar then 'autorizada' else 'rechazada' end,
      nota = left(nullif(trim(p_nota), ''), 300), decided_by = auth.uid(), decided_at = now(), updated_at = now()
    where id = p_id;
end;
$$;

revoke all on function public.hamming64(text, text) from public, anon, authenticated;
revoke all on function public.huella_vigente(text, uuid) from public, anon, authenticated;
revoke all on function public.svc_huella_check(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.svc_huella_guardar(text, uuid, uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.svc_huella_check(uuid, uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.svc_huella_guardar(text, uuid, uuid, uuid, uuid, text, text, text) to service_role;
revoke all on function public.huellas_solicitudes(uuid) from public, anon;
grant execute on function public.huellas_solicitudes(uuid) to authenticated;
revoke all on function public.huella_decidir(uuid, boolean, text) from public, anon;
grant execute on function public.huella_decidir(uuid, boolean, text) to authenticated;
