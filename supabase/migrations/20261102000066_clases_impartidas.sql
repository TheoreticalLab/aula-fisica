-- =============================================================================
-- Clases impartidas (migración 66): archivo de las pizarras de cada sesión presencial y, SOLO si el profesor lo pide,
-- una versión académica ampliada con Claude (Orbe IA). Distingue la teoría oficial de lo trabajado en el aula.
--  · Dos procesos y dos aprobaciones independientes: fotos (fotos_estado) y versión ampliada (class_ai_versions).
--    Subir NO genera nada; generar NO publica nada; nada llega al estudiante sin aprobación del profesor.
--  · Delegación por sección: monitores (si el profesor lo habilita) y estudiantes concretos (con vencimiento opcional)
--    pueden registrar clases y subir fotos; NO publican, NO generan con IA, NO aprueban, NO tocan la teoría.
--  · Fotos en Storage (bucket privado «archivo-clases», lo crea la Edge Function «entregas»); aquí solo metadatos.
--  · IA: propósito «clase» de Orbe IA (interruptor, presupuesto, límite diario, simulador) + registro de modelos
--    verificado en el servidor (orbe_ia_modelos: Haiku/Sonnet/Opus, imágenes, precios con fecha de vigencia).
--    Idempotencia por request_id; una sola generación en curso por clase; las interrumpidas se cierran solas.
--  · Versiones: editar o regenerar crea un BORRADOR nuevo; la versión publicada no cambia hasta otra aprobación.
--  · Enlaces con la teoría: solo identificadores reales (claves foráneas + validación de curso y de apartado).
-- Todas las tablas con RLS y sin permisos directos: todo pasa por funciones. Aditiva.
-- =============================================================================

-- 1) Registro de modelos verificado (catálogo del servidor; la disponibilidad se contrasta en vivo con la API)
create table if not exists public.orbe_ia_modelos (
  model_id text primary key check (model_id ~ '^claude-[a-z0-9-]{3,60}$'),
  familia text not null check (familia in ('haiku', 'sonnet', 'opus')),
  nombre text not null,
  acepta_imagenes boolean not null default true,
  precio_entrada numeric(10, 4) not null check (precio_entrada >= 0),      -- USD por millón de tokens
  precio_salida numeric(10, 4) not null check (precio_salida >= 0),
  umbral_largo integer,                                                     -- tokens de entrada a partir de los que rige otra tarifa
  precio_entrada_largo numeric(10, 4),
  precio_salida_largo numeric(10, 4),
  vigente_desde date not null,
  fuente text not null,
  activo boolean not null default true,
  actualizado_por uuid references public.profiles (id) on delete set null,
  actualizado_at timestamptz not null default now()
);
insert into public.orbe_ia_modelos (model_id, familia, nombre, precio_entrada, precio_salida, umbral_largo, precio_entrada_largo, precio_salida_largo, vigente_desde, fuente) values
  ('claude-haiku-5-5', 'haiku', 'Claude Haiku 5.5', 0.10, 0.50, 100000, 0.50, 2.50, date '2026-11-02', 'Catálogo de modelos de la documentación de la API de Claude'),
  ('claude-sonnet-5-5', 'sonnet', 'Claude Sonnet 5.5', 2, 10, null, null, null, date '2026-11-02', 'Catálogo de modelos de la documentación de la API de Claude'),
  ('claude-opus-5-5', 'opus', 'Claude Opus 5.5', 4, 20, null, null, null, date '2026-11-02', 'Catálogo de modelos de la documentación de la API de Claude')
on conflict (model_id) do nothing;
alter table public.orbe_ia_config add column if not exists clase_model text not null default 'claude-sonnet-5-5';
alter table public.orbe_ia_modelos enable row level security;
revoke all on public.orbe_ia_modelos from anon, authenticated;

create or replace function public.orbe_ia_costo_modelo(p_model text, p_input integer, p_output integer)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select round(case when m.umbral_largo is not null and p_input > m.umbral_largo
                    then (p_input * m.precio_entrada_largo + p_output * m.precio_salida_largo)
                    else (p_input * m.precio_entrada + p_output * m.precio_salida) end / 1000000.0, 6)
  from public.orbe_ia_modelos m where m.model_id = p_model
$$;

-- 2) Configuración y delegación por sección
create table if not exists public.class_archive_settings (
  class_id uuid primary key references public.classes (id) on delete cascade,
  monitores_suben boolean not null default false,
  permitir_descarga boolean not null default false,
  max_mb numeric(4, 2) not null default 4 check (max_mb between 0.5 and 8),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.class_upload_delegates (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null
);
create unique index if not exists class_upload_delegates_activo on public.class_upload_delegates (class_id, user_id) where revoked_at is null;

-- 3) Clases, fotos, generaciones, versiones, enlaces y auditoría
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  fecha date not null,
  title text not null check (char_length(title) between 1 and 160),
  temas text[] not null default '{}' check (cardinality(temas) <= 12),
  unit_id uuid references public.units (id) on delete set null,
  descripcion text not null default '' check (char_length(descripcion) <= 2000),
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploader_role text not null check (uploader_role in ('docente', 'admin', 'monitor', 'delegado')),
  client_id uuid unique,
  fotos_estado text not null default 'borrador' check (fotos_estado in ('borrador', 'pendiente', 'aprobada', 'rechazada', 'retirada')),
  fotos_motivo text check (fotos_motivo is null or char_length(fotos_motivo) <= 500),
  fotos_revisado_por uuid references public.profiles (id) on delete set null,
  fotos_revisado_at timestamptz,
  version_publicada uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists class_sessions_class_idx on public.class_sessions (class_id, fecha desc);

create table if not exists public.class_session_images (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  posicion integer not null check (posicion between 1 and 4),
  path text not null check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{64}\.(webp|jpg|png)$'),
  thumb_path text check (thumb_path is null or thumb_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/t_[0-9a-f]{64}\.(webp|jpg)$'),
  mime text not null check (mime in ('image/webp', 'image/jpeg', 'image/png')),
  bytes integer not null check (bytes > 0),
  thumb_bytes integer not null default 0,
  ancho integer not null, alto integer not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  sha256_original text check (sha256_original is null or sha256_original ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint class_session_images_pos unique (session_id, posicion) deferrable initially immediate
);

create table if not exists public.class_ai_generations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  request_id uuid not null unique,
  model text not null references public.orbe_ia_modelos (model_id),
  nivel text not null check (nivel in ('estandar', 'detallado', 'exhaustivo')),
  instrucciones text not null default '' check (char_length(instrucciones) <= 2000),
  estado text not null default 'procesando' check (estado in ('procesando', 'ok', 'error')),
  usage_id bigint references public.orbe_ia_usage (id) on delete set null,
  simulated boolean not null default false,
  imagenes text[] not null default '{}',                     -- sha256 de las fotos enviadas, en orden
  estimado_usd numeric(12, 6) not null default 0,
  input_tokens integer not null default 0, output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,40}$'),
  descartados integer not null default 0,                    -- enlaces propuestos por la IA que no existen
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists class_ai_generations_session_idx on public.class_ai_generations (session_id, created_at desc);

create table if not exists public.class_ai_versions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  generation_id uuid references public.class_ai_generations (id) on delete set null,
  base_version uuid references public.class_ai_versions (id) on delete set null,
  numero integer not null,
  contenido jsonb not null check (jsonb_typeof(contenido) = 'object'),
  estado text not null default 'borrador' check (estado in ('borrador', 'publicada', 'retirada', 'sustituida')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  unique (session_id, numero)
);
create unique index if not exists class_ai_versions_una_publicada on public.class_ai_versions (session_id) where estado = 'publicada';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'class_sessions_version_publicada_fkey') then
    alter table public.class_sessions add constraint class_sessions_version_publicada_fkey foreign key (version_publicada) references public.class_ai_versions (id) on delete set null;
  end if;
end $$;

create table if not exists public.class_resource_links (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  generation_id uuid references public.class_ai_generations (id) on delete set null,
  tipo text not null check (tipo in ('leccion', 'unidad', 'ejercicio', 'simulador', 'brecha')),
  lesson_id uuid references public.lessons (id) on delete cascade,
  unit_id uuid references public.units (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete cascade,
  sim_key text check (sim_key is null or sim_key ~ '^[a-z0-9_-]{1,60}$'),
  apartado text check (apartado is null or char_length(apartado) <= 160),
  concepto text check (concepto is null or char_length(concepto) <= 200),
  cobertura text check (cobertura is null or cobertura in ('completa', 'parcial', 'ninguna')),
  estado text not null default 'sugerido' check (estado in ('sugerido', 'confirmado', 'rechazado')),
  origen text not null check (origen in ('ia', 'docente')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((tipo = 'leccion' and lesson_id is not null) or (tipo = 'unidad' and unit_id is not null) or (tipo = 'ejercicio' and exercise_id is not null)
         or (tipo = 'simulador' and sim_key is not null and lesson_id is not null) or (tipo = 'brecha' and concepto is not null))
);
create index if not exists class_resource_links_session_idx on public.class_resource_links (session_id);

create table if not exists public.class_audit_events (
  id bigint generated always as identity primary key,
  session_id uuid references public.class_sessions (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  actor uuid references public.profiles (id) on delete set null,
  accion text not null check (char_length(accion) <= 40),
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists class_audit_events_session_idx on public.class_audit_events (session_id, created_at);

create table if not exists public.class_ai_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  model text not null references public.orbe_ia_modelos (model_id),
  updated_at timestamptz not null default now()
);

alter table public.class_archive_settings enable row level security;
alter table public.class_upload_delegates enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_session_images enable row level security;
alter table public.class_ai_generations enable row level security;
alter table public.class_ai_versions enable row level security;
alter table public.class_resource_links enable row level security;
alter table public.class_audit_events enable row level security;
alter table public.class_ai_prefs enable row level security;
revoke all on public.class_archive_settings, public.class_upload_delegates, public.class_sessions, public.class_session_images,
  public.class_ai_generations, public.class_ai_versions, public.class_resource_links, public.class_audit_events, public.class_ai_prefs from anon, authenticated;

-- Orbe IA: nuevo propósito «clase»
alter table public.orbe_ia_usage drop constraint if exists orbe_ia_usage_purpose_check;
alter table public.orbe_ia_usage add constraint orbe_ia_usage_purpose_check check (purpose in ('chistes', 'mensaje', 'pulso', 'pregunta', 'lieia', 'generar', 'asistente', 'clase'));

-- svc_orbe_ia_reservar_uso (copia de la migración 56) + propósito «clase» (estimación: 20 000 tokens de entrada con fotos, 16 000 de salida)
create or replace function public.svc_orbe_ia_reservar_uso(p_actor uuid, p_purpose text, p_lesson uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c public.orbe_ia_config;
  v_max integer; v_est numeric; v_gastado numeric; v_reservado numeric; v_llamadas integer; v_usage bigint;
  v_ctx jsonb := null; v_course uuid := null; v_admin boolean;
  v_hoy timestamptz := date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
begin
  perform pg_advisory_xact_lock(hashtextextended('orbe-ia-presupuesto', 0));
  select * into c from public.orbe_ia_config where id = 1;
  if not c.enabled then return jsonb_build_object('ok', false, 'motivo', 'apagado'); end if;
  if p_purpose is null or p_purpose not in ('mensaje', 'pulso', 'pregunta', 'lieia', 'generar', 'asistente', 'clase') then return jsonb_build_object('ok', false, 'motivo', 'proposito'); end if;
  select p.role = 'admin' into v_admin from public.profiles p
    where p.id = p_actor and p.role in ('teacher', 'admin') and p.active and p.suspended_at is null;
  if v_admin is null then return jsonb_build_object('ok', false, 'motivo', 'permiso'); end if;

  -- preguntas sobre una lección: solo de asignaturas que imparte (o cualquiera si es administrador)
  if p_lesson is not null then
    select l.course_id into v_course from public.lessons l where l.id = p_lesson;
    if v_course is null then return jsonb_build_object('ok', false, 'motivo', 'leccion'); end if;
    if not v_admin and not exists (select 1 from public.course_staff s where s.course_id = v_course and s.user_id = p_actor)
       and not exists (select 1 from public.classes cl join public.class_teachers ct on ct.class_id = cl.id where cl.course_id = v_course and ct.user_id = p_actor) then
      return jsonb_build_object('ok', false, 'motivo', 'permiso');
    end if;
    select jsonb_build_object('asignatura', co.title, 'unidad', u.title, 'leccion', l.title, 'resumen', left(coalesce(l.summary, ''), 400),
        'apartados', to_jsonb(public.orbe_ia_apartados(l.id)))
      into v_ctx from public.lessons l join public.units u on u.id = l.unit_id join public.courses co on co.id = l.course_id where l.id = p_lesson;
  end if;

  v_max := case p_purpose when 'pregunta' then c.max_output_tokens when 'lieia' then least(c.max_output_tokens, 3000)
                          when 'generar' then least(c.max_output_tokens, 4000) when 'clase' then 16000 else least(c.max_output_tokens, 2000) end;
  select count(*) into v_llamadas from public.orbe_ia_usage where created_at >= v_hoy;
  if v_llamadas >= c.daily_max_calls then return jsonb_build_object('ok', false, 'motivo', 'limite_diario'); end if;
  v_est := case when c.api_real then public.orbe_ia_costo(case p_purpose when 'lieia' then 8000 when 'generar' then 6000 when 'asistente' then 12000 when 'clase' then 20000 else 4000 end, v_max) else 0 end;
  if c.api_real then
    select coalesce(sum(cost_usd), 0) into v_gastado from public.orbe_ia_usage where created_at >= v_mes and status = 'ok' and not simulated;
    select coalesce(sum(reserved_usd), 0) into v_reservado from public.orbe_ia_usage
      where status = 'reservado' and not simulated and created_at > now() - interval '15 minutes';
    if v_gastado + v_reservado + v_est > c.monthly_budget_usd then return jsonb_build_object('ok', false, 'motivo', 'presupuesto'); end if;
  end if;

  insert into public.orbe_ia_usage (actor_id, trigger, course_id, lesson_id, model, simulated, reserved_usd, purpose)
  values (p_actor, 'profesor', v_course, p_lesson, c.model, not c.api_real, v_est, p_purpose) returning id into v_usage;
  return jsonb_build_object('ok', true, 'usage_id', v_usage, 'api_real', c.api_real, 'model', c.model, 'max_tokens', v_max, 'contexto', v_ctx,
    'precio_entrada', c.price_input_per_mtok, 'precio_salida', c.price_output_per_mtok);
end;
$$;


-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
-- Papel con el que un usuario puede SUBIR a una sección (o null): docente/admin, monitor habilitado o delegado vigente
create or replace function public.clase_papel_subida(p_class uuid, p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when not public.account_ok(p_user) then null
    when exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin') then 'admin'
    when exists (select 1 from public.class_teachers t where t.class_id = p_class and t.user_id = p_user) then 'docente'
    when exists (select 1 from public.class_monitors m join public.enrollments e on e.class_id = m.class_id and e.user_id = m.user_id
                 join public.class_archive_settings s on s.class_id = m.class_id and s.monitores_suben
                 where m.class_id = p_class and m.user_id = p_user and m.revoked_at is null) then 'monitor'
    when exists (select 1 from public.class_upload_delegates d join public.enrollments e on e.class_id = d.class_id and e.user_id = d.user_id
                 where d.class_id = p_class and d.user_id = p_user and d.revoked_at is null and (d.expires_at is null or d.expires_at > now())) then 'delegado'
  end
$$;

create or replace function public.clase_es_docente(p_class uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.clase_papel_subida(p_class, p_user) in ('docente', 'admin'), false) $$;   -- nunca NULL (un NULL anularía los «not …»)

-- ¿Puede ver esta clase? docente/admin: siempre; quien la subió (mientras tenga permiso): la suya; matriculado: si publicada
create or replace function public.clase_puede_ver(p_session uuid, p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when s.id is null then null
    when public.clase_es_docente(s.class_id, p_user) then 'docente'
    when s.uploaded_by is not distinct from p_user and public.clase_papel_subida(s.class_id, p_user) is not null then 'autor'
    when public.account_ok(p_user) and exists (select 1 from public.enrollments e where e.class_id = s.class_id and e.user_id = p_user)
         and (s.fotos_estado = 'aprobada' or s.version_publicada is not null) then 'estudiante'
  end
  from (select 1) x left join public.class_sessions s on s.id = p_session
$$;

create or replace function public.clase_log(p_session uuid, p_class uuid, p_accion text, p_detalle jsonb)
returns void language sql security definer set search_path = ''
as $$ insert into public.class_audit_events (session_id, class_id, actor, accion, detalle) values (p_session, p_class, auth.uid(), p_accion, coalesce(p_detalle, '{}'::jsonb)) $$;

create or replace function public.clase_sesion_docente(p_session uuid)
returns public.class_sessions
language plpgsql stable security definer set search_path = ''
as $$
declare s public.class_sessions;
begin
  select * into s from public.class_sessions where id = p_session;
  if s.id is null or not public.clase_es_docente(s.class_id, auth.uid()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return s;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profesor: permisos de la sección
-- -----------------------------------------------------------------------------
create or replace function public.clase_permisos(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.class_archive_settings;
begin
  if not public.clase_es_docente(p_class, auth.uid()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.class_archive_settings where class_id = p_class;
  return jsonb_build_object(
    'monitores_suben', coalesce(s.monitores_suben, false), 'permitir_descarga', coalesce(s.permitir_descarga, false), 'max_mb', coalesce(s.max_mb, 4),
    'monitores', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'nombre', p.full_name) order by p.full_name), '[]'::jsonb)
                  from public.class_monitors m join public.profiles p on p.id = m.user_id where m.class_id = p_class and m.revoked_at is null),
    'delegados', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'user_id', d.user_id, 'nombre', p.full_name, 'expires_at', d.expires_at,
                    'vigente', d.expires_at is null or d.expires_at > now(), 'granted_at', d.granted_at) order by p.full_name), '[]'::jsonb)
                  from public.class_upload_delegates d join public.profiles p on p.id = d.user_id where d.class_id = p_class and d.revoked_at is null),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', e.user_id, 'nombre', p.full_name) order by p.full_name), '[]'::jsonb)
                    from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' and p.active where e.class_id = p_class));
end;
$$;

create or replace function public.clase_permisos_config(p_class uuid, p_monitores boolean, p_descarga boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.clase_es_docente(p_class, auth.uid()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  insert into public.class_archive_settings (class_id, monitores_suben, permitir_descarga, updated_by)
    values (p_class, coalesce(p_monitores, false), coalesce(p_descarga, false), auth.uid())
    on conflict (class_id) do update set monitores_suben = excluded.monitores_suben, permitir_descarga = excluded.permitir_descarga,
      updated_by = auth.uid(), updated_at = now();
  perform public.clase_log(null, p_class, 'permisos', jsonb_build_object('monitores_suben', p_monitores, 'permitir_descarga', p_descarga));
  return public.clase_permisos(p_class);
end;
$$;

create or replace function public.clase_delegado_otorgar(p_class uuid, p_user uuid, p_expira timestamptz)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.clase_es_docente(p_class, auth.uid()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' where e.class_id = p_class and e.user_id = p_user) then
    raise exception 'Solo estudiantes matriculados en esta sección' using errcode = 'P0001'; end if;
  if p_expira is not null and p_expira <= now() then raise exception 'La fecha de vencimiento ya pasó' using errcode = '22023'; end if;
  update public.class_upload_delegates set revoked_at = now(), revoked_by = auth.uid() where class_id = p_class and user_id = p_user and revoked_at is null;
  insert into public.class_upload_delegates (class_id, user_id, granted_by, expires_at) values (p_class, p_user, auth.uid(), p_expira);
  perform public.clase_log(null, p_class, 'delegado_otorgado', jsonb_build_object('user_id', p_user, 'expires_at', p_expira));
  return public.clase_permisos(p_class);
end;
$$;

create or replace function public.clase_delegado_revocar(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare d public.class_upload_delegates;
begin
  select * into d from public.class_upload_delegates where id = p_id;
  if d.id is null or not public.clase_es_docente(d.class_id, auth.uid()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.class_upload_delegates set revoked_at = now(), revoked_by = auth.uid() where id = p_id and revoked_at is null;
  perform public.clase_log(null, d.class_id, 'delegado_revocado', jsonb_build_object('user_id', d.user_id));
  return public.clase_permisos(d.class_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Registro de clases (profesor, monitor habilitado o delegado)
-- -----------------------------------------------------------------------------
create or replace function public.clases_puedo_subir()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('class_id', c.id, 'seccion', c.name, 'asignatura', co.title, 'course_id', co.id,
      'papel', public.clase_papel_subida(c.id, auth.uid()),
      'unidades', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'title', u.title) order by u.position), '[]'::jsonb)
                   from public.units u where u.course_id = co.id and not u.hidden))
    order by co.title, c.name), '[]'::jsonb)
  from public.classes c join public.courses co on co.id = c.course_id
  where not c.archived and public.clase_papel_subida(c.id, auth.uid()) is not null
    and (exists (select 1 from public.class_teachers t where t.class_id = c.id and t.user_id = auth.uid())
         or exists (select 1 from public.enrollments e where e.class_id = c.id and e.user_id = auth.uid())
         or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
$$;

create or replace function public.clase_validar_datos(p_class uuid, p jsonb)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if coalesce(trim(p ->> 'title'), '') = '' or char_length(p ->> 'title') > 160 then raise exception 'Título obligatorio (máximo 160 caracteres)' using errcode = '22023'; end if;
  if (p ->> 'fecha') is null or (p ->> 'fecha')::date > (now() at time zone 'America/Santo_Domingo')::date + 1
     or (p ->> 'fecha')::date < date '2020-01-01' then raise exception 'Fecha de la clase no válida' using errcode = '22023'; end if;
  if nullif(p ->> 'unit_id', '') is not null and not exists (select 1 from public.units u join public.classes c on c.course_id = u.course_id
      where u.id = (p ->> 'unit_id')::uuid and c.id = p_class) then raise exception 'La unidad no es de esta asignatura' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p -> 'temas', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'temas', '[]'::jsonb)) > 12 then
    raise exception 'Temas no válidos (máximo 12)' using errcode = '22023'; end if;
end;
$$;

create or replace function public.clase_crear(p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := (p ->> 'class_id')::uuid; v_papel text; s public.class_sessions; v_client uuid := nullif(p ->> 'client_id', '')::uuid;
begin
  if v_client is null then raise exception 'Falta el identificador de la petición' using errcode = '22023'; end if;
  select * into s from public.class_sessions where client_id = v_client;
  if found then
    if s.uploaded_by <> auth.uid() then raise exception 'Identificador reutilizado' using errcode = '22023'; end if;
    return to_jsonb(s);                                                     -- reintento: idempotente
  end if;
  v_papel := public.clase_papel_subida(v_class, auth.uid());
  if v_papel is null then raise exception 'No tiene permiso para registrar clases en esta sección' using errcode = '42501'; end if;
  perform public.clase_validar_datos(v_class, p);
  insert into public.class_sessions (class_id, fecha, title, temas, unit_id, descripcion, uploaded_by, uploader_role, client_id)
    values (v_class, (p ->> 'fecha')::date, trim(p ->> 'title'),
      coalesce((select array_agg(left(trim(t), 120)) from jsonb_array_elements_text(p -> 'temas') t where trim(t) <> ''), '{}'),
      nullif(p ->> 'unit_id', '')::uuid, left(coalesce(p ->> 'descripcion', ''), 2000), auth.uid(), v_papel, v_client)
    returning * into s;
  perform public.clase_log(s.id, v_class, 'registrar', jsonb_build_object('papel', v_papel));
  return to_jsonb(s);
end;
$$;

-- Editar datos: quien la subió mientras no esté aprobada; el profesor siempre (puede cambiar a otra sección suya de la misma asignatura)
create or replace function public.clase_editar(p_session uuid, p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions; v_doc boolean; v_class uuid;
begin
  select * into s from public.class_sessions where id = p_session for update;
  if s.id is null then raise exception 'Clase no encontrada' using errcode = 'P0001'; end if;
  v_doc := public.clase_es_docente(s.class_id, auth.uid());
  if not v_doc and not (s.uploaded_by is not distinct from auth.uid() and public.clase_papel_subida(s.class_id, auth.uid()) is not null
                        and s.fotos_estado in ('borrador', 'pendiente', 'rechazada')) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  v_class := coalesce(nullif(p ->> 'class_id', '')::uuid, s.class_id);
  if v_class <> s.class_id then
    if not v_doc or not public.clase_es_docente(v_class, auth.uid())
       or (select course_id from public.classes where id = v_class) <> (select course_id from public.classes where id = s.class_id) then
      raise exception 'Solo puede moverla a otra sección suya de la misma asignatura' using errcode = '42501'; end if;
  end if;
  perform public.clase_validar_datos(v_class, p);
  update public.class_sessions set class_id = v_class, fecha = (p ->> 'fecha')::date, title = trim(p ->> 'title'),
      temas = coalesce((select array_agg(left(trim(t), 120)) from jsonb_array_elements_text(p -> 'temas') t where trim(t) <> ''), '{}'),
      unit_id = nullif(p ->> 'unit_id', '')::uuid, descripcion = left(coalesce(p ->> 'descripcion', ''), 2000), updated_at = now()
    where id = p_session returning * into s;
  perform public.clase_log(p_session, s.class_id, 'editar', jsonb_build_object('campos', p - 'descripcion'));
  return to_jsonb(s);
end;
$$;

create or replace function public.clase_fotos_reordenar(p_session uuid, p_orden uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions; i integer;
begin
  select * into s from public.class_sessions where id = p_session for update;
  if s.id is null then raise exception 'Clase no encontrada' using errcode = 'P0001'; end if;
  if not public.clase_es_docente(s.class_id, auth.uid()) and not (s.uploaded_by is not distinct from auth.uid() and public.clase_papel_subida(s.class_id, auth.uid()) is not null
     and s.fotos_estado in ('borrador', 'pendiente', 'rechazada')) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if cardinality(p_orden) <> (select count(*) from public.class_session_images where session_id = p_session)
     or exists (select 1 from unnest(p_orden) x where not exists (select 1 from public.class_session_images im where im.id = x and im.session_id = p_session)) then
    raise exception 'El orden debe incluir exactamente las fotos de la clase' using errcode = '22023'; end if;
  set constraints public.class_session_images_pos deferred;
  for i in 1 .. cardinality(p_orden) loop
    update public.class_session_images set posicion = i where id = p_orden[i];
  end loop;
  perform public.clase_log(p_session, s.class_id, 'reordenar', jsonb_build_object('orden', p_orden));
end;
$$;

-- Enviar a revisión (quien sube). El profesor puede enviar y publicar las fotos a la vez.
create or replace function public.clase_enviar(p_session uuid, p_publicar boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions; v_doc boolean;
begin
  select * into s from public.class_sessions where id = p_session for update;
  if s.id is null then raise exception 'Clase no encontrada' using errcode = 'P0001'; end if;
  v_doc := public.clase_es_docente(s.class_id, auth.uid());
  if not v_doc and not (s.uploaded_by is not distinct from auth.uid() and public.clase_papel_subida(s.class_id, auth.uid()) is not null) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if s.fotos_estado not in ('borrador', 'rechazada') and not (v_doc and s.fotos_estado = 'pendiente') then raise exception 'Esta clase ya fue enviada' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.class_session_images where session_id = p_session) then raise exception 'Suba al menos una fotografía' using errcode = 'P0001'; end if;
  if coalesce(p_publicar, false) and not v_doc then raise exception 'Solo el profesor publica' using errcode = '42501'; end if;
  update public.class_sessions set fotos_estado = case when coalesce(p_publicar, false) then 'aprobada' else 'pendiente' end,
      fotos_revisado_por = case when coalesce(p_publicar, false) then auth.uid() end, fotos_revisado_at = case when coalesce(p_publicar, false) then now() end,
      fotos_motivo = null, updated_at = now()
    where id = p_session returning * into s;
  perform public.clase_log(p_session, s.class_id, case when coalesce(p_publicar, false) then 'fotos_aprobadas' else 'enviar' end, '{}'::jsonb);
  return to_jsonb(s);
end;
$$;

-- Proceso A: el profesor aprueba, rechaza o retira las fotografías (independiente de la versión ampliada)
create or replace function public.clase_fotos_revisar(p_session uuid, p_decision text, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions;
begin
  s := public.clase_sesion_docente(p_session);
  if p_decision not in ('aprobada', 'rechazada', 'retirada', 'pendiente') then raise exception 'Decisión no válida' using errcode = '22023'; end if;
  if p_decision = 'aprobada' and not exists (select 1 from public.class_session_images where session_id = p_session) then raise exception 'No hay fotografías' using errcode = 'P0001'; end if;
  if p_decision in ('rechazada', 'retirada') and nullif(trim(p_motivo), '') is null then raise exception 'Indique el motivo' using errcode = '22023'; end if;
  update public.class_sessions set fotos_estado = p_decision, fotos_motivo = left(nullif(trim(p_motivo), ''), 500),
      fotos_revisado_por = auth.uid(), fotos_revisado_at = now(), updated_at = now() where id = p_session returning * into s;
  perform public.clase_log(p_session, s.class_id, 'fotos_' || p_decision, jsonb_build_object('motivo', p_motivo));
  return to_jsonb(s);
end;
$$;

-- -----------------------------------------------------------------------------
-- Consultas
-- -----------------------------------------------------------------------------
create or replace function public.clase_resumen(s public.class_sessions)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', s.id, 'class_id', s.class_id, 'fecha', s.fecha, 'title', s.title, 'temas', to_jsonb(s.temas), 'unit_id', s.unit_id,
    'unidad', (select u.title from public.units u where u.id = s.unit_id), 'descripcion', s.descripcion,
    'seccion', c.name, 'asignatura', co.title, 'course_id', co.id,
    'fotos_estado', s.fotos_estado, 'fotos_motivo', s.fotos_motivo, 'n_fotos', (select count(*) from public.class_session_images im where im.session_id = s.id),
    'ampliada_publicada', s.version_publicada is not null, 'subida_por', (select p.full_name from public.profiles p where p.id = s.uploaded_by),
    'uploader_role', s.uploader_role, 'created_at', s.created_at, 'updated_at', s.updated_at)
  from public.classes c join public.courses co on co.id = c.course_id where c.id = s.class_id
$$;

-- Estudiante: clases publicadas de sus secciones (todas, haya asistido o no)
create or replace function public.clases_mias()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(public.clase_resumen(s) order by s.fecha desc, s.created_at desc), '[]'::jsonb)
  from public.class_sessions s
  where public.my_account_ok() and exists (select 1 from public.enrollments e where e.class_id = s.class_id and e.user_id = auth.uid())
    and (s.fotos_estado = 'aprobada' or s.version_publicada is not null)
$$;

-- Profesor (o delegado/monitor: solo las suyas): clases de una sección
create or replace function public.clases_seccion(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_doc boolean := public.clase_es_docente(p_class, auth.uid());
begin
  if not v_doc and public.clase_papel_subida(p_class, auth.uid()) is null then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(public.clase_resumen(s) || jsonb_build_object(
      'generaciones', (select count(*) from public.class_ai_generations g where g.session_id = s.id),
      'procesando', exists (select 1 from public.class_ai_generations g where g.session_id = s.id and g.estado = 'procesando'),
      'borradores', (select count(*) from public.class_ai_versions v where v.session_id = s.id and v.estado = 'borrador'),
      'costo_usd', (select coalesce(sum(g.cost_usd), 0) from public.class_ai_generations g where g.session_id = s.id))
    order by (s.fotos_estado = 'pendiente') desc, s.fecha desc, s.created_at desc), '[]'::jsonb)
    from public.class_sessions s where s.class_id = p_class and (v_doc or s.uploaded_by is not distinct from auth.uid()));
end;
$$;

-- Detalle según el papel: el estudiante NUNCA recibe borradores, generaciones, enlaces sin confirmar ni fotos pendientes
create or replace function public.clase_detalle(p_session uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.class_sessions; v_papel text; v_out jsonb;
begin
  select * into s from public.class_sessions where id = p_session;
  v_papel := public.clase_puede_ver(p_session, auth.uid());
  if v_papel is null then raise exception 'Sin permiso' using errcode = '42501'; end if;
  v_out := public.clase_resumen(s) || jsonb_build_object('papel', v_papel,
    'fotos_visibles', v_papel <> 'estudiante' or s.fotos_estado = 'aprobada',
    'permitir_descarga', coalesce((select permitir_descarga from public.class_archive_settings where class_id = s.class_id), false),
    'imagenes', case when v_papel <> 'estudiante' or s.fotos_estado = 'aprobada' then
      (select coalesce(jsonb_agg(jsonb_build_object('id', im.id, 'posicion', im.posicion, 'ancho', im.ancho, 'alto', im.alto, 'bytes', im.bytes) order by im.posicion), '[]'::jsonb)
       from public.class_session_images im where im.session_id = s.id) else '[]'::jsonb end,
    'publicada', (select jsonb_build_object('id', v.id, 'numero', v.numero, 'contenido', v.contenido, 'approved_at', v.approved_at,
                    'modelo', (select g.model from public.class_ai_generations g where g.id = v.generation_id))
                  from public.class_ai_versions v where v.id = s.version_publicada and v.estado = 'publicada'),
    'enlaces', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'tipo', l.tipo, 'lesson_id', l.lesson_id, 'unit_id', l.unit_id, 'exercise_id', l.exercise_id,
                  'sim_key', l.sim_key, 'apartado', l.apartado, 'concepto', l.concepto, 'cobertura', l.cobertura, 'estado', l.estado, 'origen', l.origen,
                  'leccion_id', coalesce(l.lesson_id, (select e.lesson_id from public.exercises e where e.id = l.exercise_id)),
                  'leccion', (select le.title from public.lessons le where le.id = coalesce(l.lesson_id, (select e.lesson_id from public.exercises e where e.id = l.exercise_id))),
                  'course_id', (select c.course_id from public.classes c where c.id = s.class_id),
                  'unidad', (select u.title from public.units u where u.id = coalesce(l.unit_id, (select le.unit_id from public.lessons le where le.id = l.lesson_id))),
                  'ejercicio', (select e.slug from public.exercises e where e.id = l.exercise_id)) order by l.tipo, l.created_at), '[]'::jsonb)
                from public.class_resource_links l where l.session_id = s.id and (v_papel = 'docente' or l.estado = 'confirmado')));
  if v_papel = 'docente' then
    v_out := v_out || jsonb_build_object(
      'versiones', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'numero', v.numero, 'estado', v.estado, 'contenido', v.contenido, 'generation_id', v.generation_id,
                      'created_at', v.created_at, 'approved_at', v.approved_at, 'autor', (select p.full_name from public.profiles p where p.id = v.created_by)) order by v.numero desc), '[]'::jsonb)
                    from public.class_ai_versions v where v.session_id = s.id),
      'generaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'model', g.model, 'nivel', g.nivel, 'estado', g.estado, 'simulated', g.simulated,
                      'estimado_usd', g.estimado_usd, 'cost_usd', g.cost_usd, 'input_tokens', g.input_tokens, 'output_tokens', g.output_tokens,
                      'error_code', g.error_code, 'descartados', g.descartados, 'created_at', g.created_at, 'finished_at', g.finished_at,
                      'fotos_cambiadas', g.imagenes is distinct from (select array_agg(im.sha256 order by im.posicion) from public.class_session_images im where im.session_id = s.id))
                      order by g.created_at desc), '[]'::jsonb)
                       from public.class_ai_generations g where g.session_id = s.id),
      'auditoria', (select coalesce(jsonb_agg(jsonb_build_object('accion', a.accion, 'detalle', a.detalle, 'created_at', a.created_at,
                      'actor', (select p.full_name from public.profiles p where p.id = a.actor)) order by a.created_at desc), '[]'::jsonb)
                    from public.class_audit_events a where a.session_id = s.id),
      'modelo_preferido', coalesce((select model from public.class_ai_prefs where user_id = auth.uid()), (select clase_model from public.orbe_ia_config where id = 1)));
  end if;
  return v_out;
end;
$$;

-- -----------------------------------------------------------------------------
-- Proceso B: versiones de la clase ampliada (solo el profesor)
-- -----------------------------------------------------------------------------
create or replace function public.clase_contenido_valido(c jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(c) = 'object' and jsonb_typeof(c -> 'secciones') = 'array' and jsonb_array_length(c -> 'secciones') between 1 and 20
    and not exists (select 1 from jsonb_array_elements(c -> 'secciones') x
                    where jsonb_typeof(x -> 'titulo') <> 'string' or jsonb_typeof(x -> 'cuerpo') <> 'string'
                       or char_length(x ->> 'titulo') > 160 or char_length(x ->> 'cuerpo') > 60000)
$$;

create or replace function public.clase_version_guardar(p_session uuid, p_base uuid, p_contenido jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions; v public.class_ai_versions; n integer;
begin
  s := public.clase_sesion_docente(p_session);
  if not public.clase_contenido_valido(p_contenido) then raise exception 'Contenido no válido' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clase_version' || p_session::text, 0));
  select coalesce(max(numero), 0) + 1 into n from public.class_ai_versions where session_id = p_session;
  insert into public.class_ai_versions (session_id, generation_id, base_version, numero, contenido, created_by)
    values (p_session, (select generation_id from public.class_ai_versions where id = p_base and session_id = p_session), p_base, n, p_contenido, auth.uid())
    returning * into v;
  perform public.clase_log(p_session, s.class_id, 'version_editada', jsonb_build_object('numero', n, 'base', p_base));
  return to_jsonb(v);
end;
$$;

create or replace function public.clase_version_publicar(p_version uuid, p_confirmar_sugeridos boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v public.class_ai_versions; s public.class_sessions;
begin
  select * into v from public.class_ai_versions where id = p_version;
  if v.id is null then raise exception 'Versión no encontrada' using errcode = 'P0001'; end if;
  s := public.clase_sesion_docente(v.session_id);
  if v.estado = 'publicada' then return to_jsonb(v); end if;
  update public.class_ai_versions set estado = 'sustituida' where session_id = v.session_id and estado = 'publicada';
  update public.class_ai_versions set estado = 'publicada', approved_by = auth.uid(), approved_at = now() where id = p_version returning * into v;
  update public.class_sessions set version_publicada = p_version, updated_at = now() where id = v.session_id;
  if coalesce(p_confirmar_sugeridos, false) then
    update public.class_resource_links set estado = 'confirmado' where session_id = v.session_id and estado = 'sugerido';
  end if;
  perform public.clase_log(v.session_id, s.class_id, 'version_publicada', jsonb_build_object('numero', v.numero, 'confirmar_sugeridos', p_confirmar_sugeridos));
  return to_jsonb(v);
end;
$$;

create or replace function public.clase_version_retirar(p_session uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions;
begin
  s := public.clase_sesion_docente(p_session);
  if s.version_publicada is null then raise exception 'No hay versión publicada' using errcode = 'P0001'; end if;
  update public.class_ai_versions set estado = 'retirada' where id = s.version_publicada;
  update public.class_sessions set version_publicada = null, updated_at = now() where id = p_session;
  perform public.clase_log(p_session, s.class_id, 'version_retirada', jsonb_build_object('motivo', p_motivo));
end;
$$;

-- Enlaces con la teoría: el profesor confirma, rechaza o añade (validados contra la base)
create or replace function public.clase_enlace_validar(p_class uuid, p jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_course uuid; v_lesson uuid := nullif(p ->> 'lesson_id', '')::uuid; v_unit uuid := nullif(p ->> 'unit_id', '')::uuid;
  v_ex uuid := nullif(p ->> 'exercise_id', '')::uuid; v_tipo text := p ->> 'tipo'; v_apartado text := nullif(trim(p ->> 'apartado'), ''); v_sim text := nullif(p ->> 'sim_key', '');
begin
  select course_id into v_course from public.classes where id = p_class;
  if v_tipo not in ('leccion', 'unidad', 'ejercicio', 'simulador', 'brecha') then return null; end if;
  if v_lesson is not null and not exists (select 1 from public.lessons l where l.id = v_lesson and l.course_id = v_course) then return null; end if;
  if v_unit is not null and not exists (select 1 from public.units u where u.id = v_unit and u.course_id = v_course) then return null; end if;
  if v_ex is not null and not exists (select 1 from public.exercises e where e.id = v_ex and e.course_id = v_course and e.published) then return null; end if;
  if v_apartado is not null and (v_lesson is null or not (v_apartado = any (coalesce(public.orbe_ia_apartados(v_lesson), '{}')))) then v_apartado := null; end if;
  if v_tipo = 'simulador' and (v_lesson is null or v_sim is null or not exists (select 1 from public.lessons l where l.id = v_lesson
       and (l.simulation ->> 'key' = v_sim or l.simulation ->> 'type' = v_sim or l.simulation ->> 'id' = v_sim))) then return null; end if;
  if (v_tipo = 'leccion' and v_lesson is null) or (v_tipo = 'unidad' and v_unit is null) or (v_tipo = 'ejercicio' and v_ex is null)
     or (v_tipo = 'brecha' and nullif(trim(p ->> 'concepto'), '') is null) then return null; end if;
  return jsonb_build_object('tipo', v_tipo, 'lesson_id', v_lesson, 'unit_id', v_unit, 'exercise_id', v_ex, 'sim_key', v_sim, 'apartado', v_apartado,
    'concepto', left(nullif(trim(p ->> 'concepto'), ''), 200),
    'cobertura', case when p ->> 'cobertura' in ('completa', 'parcial', 'ninguna') then p ->> 'cobertura' end);
end;
$$;

create or replace function public.clase_enlace_agregar(p_session uuid, p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions; v jsonb; r public.class_resource_links;
begin
  s := public.clase_sesion_docente(p_session);
  v := public.clase_enlace_validar(s.class_id, p);
  if v is null then raise exception 'El recurso no existe en esta asignatura' using errcode = '22023'; end if;
  insert into public.class_resource_links (session_id, tipo, lesson_id, unit_id, exercise_id, sim_key, apartado, concepto, cobertura, estado, origen, created_by)
    values (p_session, v ->> 'tipo', (v ->> 'lesson_id')::uuid, (v ->> 'unit_id')::uuid, (v ->> 'exercise_id')::uuid, v ->> 'sim_key', v ->> 'apartado',
            v ->> 'concepto', v ->> 'cobertura', 'confirmado', 'docente', auth.uid())
    returning * into r;
  perform public.clase_log(p_session, s.class_id, 'enlace_agregado', v);
  return to_jsonb(r);
end;
$$;

create or replace function public.clase_enlace_estado(p_id uuid, p_estado text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare l public.class_resource_links; s public.class_sessions;
begin
  select * into l from public.class_resource_links where id = p_id;
  if l.id is null then raise exception 'Enlace no encontrado' using errcode = 'P0001'; end if;
  s := public.clase_sesion_docente(l.session_id);
  if p_estado not in ('sugerido', 'confirmado', 'rechazado') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  update public.class_resource_links set estado = p_estado where id = p_id;
  perform public.clase_log(l.session_id, s.class_id, 'enlace_' || p_estado, jsonb_build_object('enlace', p_id));
end;
$$;

-- Cobertura curricular pendiente: temas trabajados en clase sin teoría (brechas confirmadas o sugeridas)
create or replace function public.clases_brechas(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.clase_es_docente(p_class, auth.uid()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('concepto', l.concepto, 'estado', l.estado, 'session_id', s.id, 'fecha', s.fecha, 'clase', s.title) order by s.fecha desc), '[]'::jsonb)
    from public.class_resource_links l join public.class_sessions s on s.id = l.session_id
    where s.class_id = p_class and l.tipo = 'brecha' and l.estado <> 'rechazado');
end;
$$;

create or replace function public.clase_modelo_preferido(p_model text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_teacher() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from public.orbe_ia_modelos where model_id = p_model and activo and acepta_imagenes) then raise exception 'Modelo no disponible' using errcode = '22023'; end if;
  insert into public.class_ai_prefs (user_id, model) values (auth.uid(), p_model) on conflict (user_id) do update set model = excluded.model, updated_at = now();
end;
$$;

-- Catálogo de modelos para el profesor (sin claves; la disponibilidad en vivo la añade la Edge Function)
create or replace function public.orbe_ia_modelos_lista()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when public.is_teacher() then (select coalesce(jsonb_agg(to_jsonb(m) - 'actualizado_por' order by m.precio_entrada), '[]'::jsonb) from public.orbe_ia_modelos m) end
$$;

-- Administrador: actualizar tarifas o disponibilidad (con fecha de vigencia) y el modelo por defecto de las clases
create or replace function public.orbe_ia_modelo_actualizar(p_model text, p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador' using errcode = '42501'; end if;
  update public.orbe_ia_modelos set
      precio_entrada = coalesce((p ->> 'precio_entrada')::numeric, precio_entrada), precio_salida = coalesce((p ->> 'precio_salida')::numeric, precio_salida),
      activo = coalesce((p ->> 'activo')::boolean, activo), acepta_imagenes = coalesce((p ->> 'acepta_imagenes')::boolean, acepta_imagenes),
      vigente_desde = coalesce((p ->> 'vigente_desde')::date, vigente_desde), fuente = coalesce(nullif(p ->> 'fuente', ''), fuente),
      actualizado_por = auth.uid(), actualizado_at = now()
    where model_id = p_model;
  if not found then raise exception 'Modelo no registrado' using errcode = 'P0001'; end if;
  if (p ->> 'por_defecto_clases')::boolean then update public.orbe_ia_config set clase_model = p_model where id = 1; end if;
  return public.orbe_ia_modelos_lista();
end;
$$;

-- -----------------------------------------------------------------------------
-- Servicio (Edge Functions, service_role): fotografías
-- -----------------------------------------------------------------------------
create or replace function public.svc_clase_foto_check(p_user uuid, p_session uuid, p_posicion integer, p_bytes integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.class_sessions; v_doc boolean; v_max integer;
begin
  select * into s from public.class_sessions where id = p_session;
  if s.id is null then raise exception 'Clase no encontrada' using errcode = 'P0001'; end if;
  v_doc := public.clase_es_docente(s.class_id, p_user);
  if not v_doc and not (s.uploaded_by is not distinct from p_user and public.clase_papel_subida(s.class_id, p_user) is not null
                        and s.fotos_estado in ('borrador', 'pendiente', 'rechazada')) then
    raise exception 'No puede modificar las fotografías de esta clase' using errcode = '42501'; end if;
  if p_posicion is null or p_posicion < 1 or p_posicion > 4 then raise exception 'Máximo 4 fotografías por clase' using errcode = '22023'; end if;
  if (select count(*) from public.class_session_images where session_id = p_session and posicion <> p_posicion) >= 4 then
    raise exception 'Máximo 4 fotografías por clase' using errcode = '22023'; end if;
  v_max := (coalesce((select max_mb from public.class_archive_settings where class_id = s.class_id), 4) * 1048576)::integer;
  if p_bytes is null or p_bytes <= 0 or p_bytes > v_max then raise exception 'La fotografía supera el tamaño máximo (% MB)', round(v_max / 1048576.0, 1) using errcode = '22023'; end if;
  return jsonb_build_object('class_id', s.class_id, 'max_bytes', v_max);
end;
$$;

create or replace function public.svc_clase_foto_registrar(p_user uuid, p_session uuid, p_posicion integer, p_path text, p_thumb text, p_mime text,
  p_bytes integer, p_thumb_bytes integer, p_ancho integer, p_alto integer, p_sha text, p_sha_original text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions; v_old record; v_liberar text[] := '{}';
begin
  perform public.svc_clase_foto_check(p_user, p_session, p_posicion, p_bytes);
  select * into s from public.class_sessions where id = p_session for update;
  if p_path not like s.class_id::text || '/' || s.id::text || '/%' or (p_thumb is not null and p_thumb not like s.class_id::text || '/' || s.id::text || '/t_%') then
    raise exception 'Ruta no válida' using errcode = '22023'; end if;
  if exists (select 1 from public.class_session_images where session_id = p_session and sha256 = p_sha and posicion <> p_posicion) then
    raise exception 'Esa fotografía ya está en esta clase' using errcode = '22023'; end if;
  select path, thumb_path into v_old from public.class_session_images where session_id = p_session and posicion = p_posicion;
  if found then
    if v_old.path <> p_path then v_liberar := v_liberar || v_old.path; end if;
    if v_old.thumb_path is not null and v_old.thumb_path is distinct from p_thumb then v_liberar := v_liberar || v_old.thumb_path; end if;
    delete from public.class_session_images where session_id = p_session and posicion = p_posicion;
  end if;
  insert into public.class_session_images (session_id, posicion, path, thumb_path, mime, bytes, thumb_bytes, ancho, alto, sha256, sha256_original, uploaded_by)
    values (p_session, p_posicion, p_path, p_thumb, p_mime, p_bytes, coalesce(p_thumb_bytes, 0), p_ancho, p_alto, p_sha, p_sha_original, p_user);
  update public.class_sessions set updated_at = now() where id = p_session;
  insert into public.class_audit_events (session_id, class_id, actor, accion, detalle)
    values (p_session, s.class_id, p_user, case when v_old.path is null then 'foto_subida' else 'foto_reemplazada' end,
            jsonb_build_object('posicion', p_posicion, 'sha256', p_sha, 'estado_fotos', s.fotos_estado));
  return jsonb_build_object('ok', true, 'liberar', to_jsonb(v_liberar));
end;
$$;

create or replace function public.svc_clase_foto_quitar(p_user uuid, p_image uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare im public.class_session_images; s public.class_sessions;
begin
  select * into im from public.class_session_images where id = p_image;
  if im.id is null then raise exception 'Fotografía no encontrada' using errcode = 'P0001'; end if;
  select * into s from public.class_sessions where id = im.session_id for update;
  if not public.clase_es_docente(s.class_id, p_user) and not (s.uploaded_by is not distinct from p_user and public.clase_papel_subida(s.class_id, p_user) is not null
     and s.fotos_estado in ('borrador', 'pendiente', 'rechazada')) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if s.fotos_estado = 'aprobada' and (select count(*) from public.class_session_images where session_id = s.id) = 1 then
    raise exception 'Una clase con fotos publicadas debe conservar al menos una (retire la publicación primero)' using errcode = 'P0001'; end if;
  delete from public.class_session_images where id = p_image;
  -- compacta las posiciones (el orden relativo se conserva)
  set constraints public.class_session_images_pos deferred;
  update public.class_session_images x set posicion = o.n
    from (select id, row_number() over (order by posicion) n from public.class_session_images where session_id = s.id) o where x.id = o.id;
  insert into public.class_audit_events (session_id, class_id, actor, accion, detalle) values (s.id, s.class_id, p_user, 'foto_quitada', jsonb_build_object('sha256', im.sha256));
  return jsonb_build_object('liberar', to_jsonb(array_remove(array[im.path, im.thumb_path], null)));
end;
$$;

-- Rutas que el usuario puede ver (para URLs firmadas): estudiante solo con fotos aprobadas y matrícula en la sección
create or replace function public.svc_clase_fotos(p_user uuid, p_session uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_papel text := public.clase_puede_ver(p_session, p_user); s public.class_sessions;
begin
  select * into s from public.class_sessions where id = p_session;
  if v_papel is null or (v_papel = 'estudiante' and s.fotos_estado <> 'aprobada') then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object('descarga', v_papel <> 'estudiante' or coalesce((select permitir_descarga from public.class_archive_settings where class_id = s.class_id), false),
    'fotos', (select coalesce(jsonb_agg(jsonb_build_object('id', im.id, 'posicion', im.posicion, 'path', im.path, 'thumb_path', im.thumb_path, 'mime', im.mime,
                'ancho', im.ancho, 'alto', im.alto) order by im.posicion), '[]'::jsonb)
              from public.class_session_images im where im.session_id = p_session));
end;
$$;

-- Borrar una clase no aprobada (quien la subió o el profesor): devuelve las rutas a liberar
create or replace function public.svc_clase_eliminar(p_user uuid, p_session uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions; v_rutas text[];
begin
  select * into s from public.class_sessions where id = p_session for update;
  if s.id is null then raise exception 'Clase no encontrada' using errcode = 'P0001'; end if;
  if not public.clase_es_docente(s.class_id, p_user) and not (s.uploaded_by is not distinct from p_user and s.fotos_estado in ('borrador', 'pendiente', 'rechazada')) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if s.fotos_estado = 'aprobada' or exists (select 1 from public.class_ai_versions v where v.session_id = p_session and v.estado in ('publicada', 'retirada', 'sustituida')) then
    raise exception 'Una clase publicada forma parte del registro histórico: retire su publicación, no la borre' using errcode = 'P0001'; end if;
  select coalesce(array_agg(x), '{}') into v_rutas from (select path x from public.class_session_images where session_id = p_session
    union all select thumb_path from public.class_session_images where session_id = p_session and thumb_path is not null) q;
  insert into public.class_audit_events (session_id, class_id, actor, accion, detalle) values (null, s.class_id, p_user, 'clase_eliminada', jsonb_build_object('session_id', s.id, 'title', s.title));
  delete from public.class_sessions where id = p_session;
  return jsonb_build_object('liberar', to_jsonb(v_rutas));
end;
$$;

-- -----------------------------------------------------------------------------
-- Servicio (Edge Function «orbe-ia»): generación con IA, idempotente
-- -----------------------------------------------------------------------------
create or replace function public.svc_clase_modelos()
returns jsonb
language sql stable security definer set search_path = ''
as $$ select coalesce(jsonb_agg(to_jsonb(m) - 'actualizado_por'), '[]'::jsonb) from public.orbe_ia_modelos m where m.activo and m.acepta_imagenes $$;

create or replace function public.svc_clase_ia_iniciar(p_user uuid, p_session uuid, p_request uuid, p_model text, p_nivel text, p_instrucciones text, p_estimado numeric)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.class_sessions; g public.class_ai_generations; m public.orbe_ia_modelos; r jsonb; v_course uuid; c public.orbe_ia_config;
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo'; v_gastado numeric;
begin
  if p_request is null then raise exception 'Falta el identificador de la petición' using errcode = '22023'; end if;
  select * into g from public.class_ai_generations where request_id = p_request;
  if found then return jsonb_build_object('repetida', true, 'generation_id', g.id, 'estado', g.estado); end if;   -- doble clic / reintento de red
  select * into s from public.class_sessions where id = p_session for update;
  if s.id is null or not public.clase_es_docente(s.class_id, p_user) then raise exception 'Solo el profesor de la sección genera con IA' using errcode = '42501'; end if;
  select * into m from public.orbe_ia_modelos where model_id = p_model;
  if m.model_id is null or not m.activo or not m.acepta_imagenes then raise exception 'Modelo no disponible' using errcode = '22023'; end if;
  if p_nivel not in ('estandar', 'detallado', 'exhaustivo') then raise exception 'Nivel no válido' using errcode = '22023'; end if;
  if not exists (select 1 from public.class_session_images where session_id = p_session) then raise exception 'La clase no tiene fotografías' using errcode = 'P0001'; end if;
  -- generaciones interrumpidas (p. ej. el servidor cortó la ejecución): se cierran y liberan su reserva
  update public.orbe_ia_usage u set status = 'error', reserved_usd = 0, error_code = 'interrumpida', finished_at = now()
    from public.class_ai_generations x where x.usage_id = u.id and x.session_id = p_session and x.estado = 'procesando'
      and x.created_at < now() - interval '15 minutes' and u.status = 'reservado';
  update public.class_ai_generations set estado = 'error', error_code = 'interrumpida', finished_at = now()
    where session_id = p_session and estado = 'procesando' and created_at < now() - interval '15 minutes';
  if exists (select 1 from public.class_ai_generations where session_id = p_session and estado = 'procesando') then
    return jsonb_build_object('ok', false, 'motivo', 'en_curso'); end if;
  r := public.svc_orbe_ia_reservar_uso(p_user, 'clase', null);
  if not (r ->> 'ok')::boolean then return r; end if;
  -- el presupuesto se vuelve a comprobar con la estimación del modelo elegido (la general usa el modelo por defecto)
  select * into c from public.orbe_ia_config where id = 1;
  if c.api_real then
    select coalesce(sum(cost_usd), 0) + coalesce(sum(reserved_usd) filter (where status = 'reservado' and id <> (r ->> 'usage_id')::bigint), 0)
      into v_gastado from public.orbe_ia_usage where created_at >= v_mes and not simulated and (status = 'ok' or (status = 'reservado' and created_at > now() - interval '15 minutes'));
    if v_gastado + coalesce(p_estimado, 0) > c.monthly_budget_usd then
      update public.orbe_ia_usage set status = 'error', reserved_usd = 0, error_code = 'presupuesto', finished_at = now() where id = (r ->> 'usage_id')::bigint;
      return jsonb_build_object('ok', false, 'motivo', 'presupuesto');
    end if;
  end if;
  update public.orbe_ia_usage set model = p_model, reserved_usd = case when c.api_real then coalesce(p_estimado, 0) else 0 end, course_id = (select course_id from public.classes where id = s.class_id)
    where id = (r ->> 'usage_id')::bigint;
  insert into public.class_ai_generations (session_id, request_id, model, nivel, instrucciones, usage_id, simulated, imagenes, estimado_usd, requested_by)
    values (p_session, p_request, p_model, p_nivel, left(coalesce(p_instrucciones, ''), 2000), (r ->> 'usage_id')::bigint, not c.api_real,
            (select array_agg(im.sha256 order by im.posicion) from public.class_session_images im where im.session_id = p_session),
            coalesce(p_estimado, 0), p_user)
    returning * into g;
  insert into public.class_audit_events (session_id, class_id, actor, accion, detalle)
    values (p_session, s.class_id, p_user, 'ia_solicitada', jsonb_build_object('model', p_model, 'nivel', p_nivel, 'estimado_usd', p_estimado, 'simulado', not c.api_real));
  select course_id into v_course from public.classes where id = s.class_id;
  return jsonb_build_object('ok', true, 'generation_id', g.id, 'api_real', c.api_real, 'model', p_model,
    'precio', jsonb_build_object('entrada', m.precio_entrada, 'salida', m.precio_salida),
    'clase', public.clase_resumen(s),
    'imagenes', (select coalesce(jsonb_agg(jsonb_build_object('posicion', im.posicion, 'path', im.path, 'mime', im.mime) order by im.posicion), '[]'::jsonb)
                 from public.class_session_images im where im.session_id = p_session),
    -- catálogo REAL de la asignatura (la IA solo puede proponer estos identificadores; se validan otra vez al guardar)
    'catalogo', jsonb_build_object(
      'unidades', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'titulo', u.title, 'temas_previstos', to_jsonb(u.planned_topics)) order by u.position), '[]'::jsonb)
                   from public.units u where u.course_id = v_course and not u.hidden),
      'lecciones', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'unidad', l.unit_id, 'titulo', l.title, 'resumen', left(l.summary, 240),
                      'apartados', to_jsonb(public.orbe_ia_apartados(l.id)), 'simulador', coalesce(l.simulation ->> 'key', l.simulation ->> 'type', l.simulation ->> 'id'))
                      order by l.position), '[]'::jsonb)
                    from public.lessons l join public.units u on u.id = l.unit_id where l.course_id = v_course and not l.hidden and not u.hidden),
      'ejercicios', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'slug', e.slug, 'conceptos', to_jsonb(e.concepts), 'nivel', e.difficulty, 'leccion', e.lesson_id)), '[]'::jsonb)
                     from (select * from public.exercises e where e.course_id = v_course and e.published order by e.slug limit 250) e)));
end;
$$;

create or replace function public.svc_clase_ia_finalizar(p_generation uuid, p_ok boolean, p_input integer, p_output integer, p_error text, p_contenido jsonb, p_enlaces jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare g public.class_ai_generations; s public.class_sessions; v_cost numeric := 0; v_version uuid; n integer; e jsonb; val jsonb; v_validos integer := 0; v_desc integer := 0;
begin
  select * into g from public.class_ai_generations where id = p_generation for update;
  if g.id is null then raise exception 'Generación no encontrada' using errcode = 'P0001'; end if;
  if g.estado <> 'procesando' then return jsonb_build_object('repetida', true, 'estado', g.estado); end if;   -- nunca dos veces
  select * into s from public.class_sessions where id = g.session_id;
  if not g.simulated then v_cost := coalesce(public.orbe_ia_costo_modelo(g.model, coalesce(p_input, 0), coalesce(p_output, 0)), 0); end if;
  update public.orbe_ia_usage set status = case when p_ok then 'ok' else 'error' end, input_tokens = coalesce(p_input, 0), output_tokens = coalesce(p_output, 0),
      cost_usd = v_cost, reserved_usd = 0, finished_at = now(), error_code = case when p_ok then null else left(coalesce(p_error, 'error'), 40) end
    where id = g.usage_id;
  if p_ok and not public.clase_contenido_valido(p_contenido) then p_ok := false; p_error := 'contenido_invalido'; end if;
  if p_ok then
    perform pg_advisory_xact_lock(hashtextextended('clase_version' || g.session_id::text, 0));
    select coalesce(max(numero), 0) + 1 into n from public.class_ai_versions where session_id = g.session_id;
    insert into public.class_ai_versions (session_id, generation_id, numero, contenido, created_by) values (g.session_id, g.id, n, p_contenido, g.requested_by)
      returning id into v_version;
    for e in select * from jsonb_array_elements(coalesce(p_enlaces, '[]'::jsonb)) loop
      val := public.clase_enlace_validar(s.class_id, e);
      if val is null then v_desc := v_desc + 1; continue; end if;
      insert into public.class_resource_links (session_id, generation_id, tipo, lesson_id, unit_id, exercise_id, sim_key, apartado, concepto, cobertura, estado, origen, created_by)
        values (g.session_id, g.id, val ->> 'tipo', (val ->> 'lesson_id')::uuid, (val ->> 'unit_id')::uuid, (val ->> 'exercise_id')::uuid, val ->> 'sim_key',
                val ->> 'apartado', val ->> 'concepto', val ->> 'cobertura', 'sugerido', 'ia', g.requested_by);
      v_validos := v_validos + 1;
    end loop;
  end if;
  update public.class_ai_generations set estado = case when p_ok then 'ok' else 'error' end, input_tokens = coalesce(p_input, 0), output_tokens = coalesce(p_output, 0),
      cost_usd = v_cost, error_code = case when p_ok then null else left(coalesce(p_error, 'error'), 40) end, descartados = v_desc, finished_at = now()
    where id = g.id;
  insert into public.class_audit_events (session_id, class_id, actor, accion, detalle)
    values (g.session_id, s.class_id, g.requested_by, case when p_ok then 'ia_borrador' else 'ia_error' end,
            jsonb_build_object('generation_id', g.id, 'cost_usd', v_cost, 'enlaces', v_validos, 'descartados', v_desc, 'error', p_error));
  return jsonb_build_object('ok', p_ok, 'version_id', v_version, 'enlaces', v_validos, 'descartados', v_desc, 'cost_usd', v_cost);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public.orbe_ia_costo_modelo(text, integer, integer)', 'public.clase_papel_subida(uuid, uuid)', 'public.clase_es_docente(uuid, uuid)',
    'public.clase_puede_ver(uuid, uuid)', 'public.clase_log(uuid, uuid, text, jsonb)', 'public.clase_sesion_docente(uuid)', 'public.clase_validar_datos(uuid, jsonb)',
    'public.clase_resumen(public.class_sessions)', 'public.clase_enlace_validar(uuid, jsonb)', 'public.clase_contenido_valido(jsonb)',
    'public.svc_clase_foto_check(uuid, uuid, integer, integer)',
    'public.svc_clase_foto_registrar(uuid, uuid, integer, text, text, text, integer, integer, integer, integer, text, text)',
    'public.svc_clase_foto_quitar(uuid, uuid)', 'public.svc_clase_fotos(uuid, uuid)', 'public.svc_clase_eliminar(uuid, uuid)', 'public.svc_clase_modelos()',
    'public.svc_clase_ia_iniciar(uuid, uuid, uuid, text, text, text, numeric)',
    'public.svc_clase_ia_finalizar(uuid, boolean, integer, integer, text, jsonb, jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['public.svc_clase_foto_check(uuid, uuid, integer, integer)',
    'public.svc_clase_foto_registrar(uuid, uuid, integer, text, text, text, integer, integer, integer, integer, text, text)',
    'public.svc_clase_foto_quitar(uuid, uuid)', 'public.svc_clase_fotos(uuid, uuid)', 'public.svc_clase_eliminar(uuid, uuid)', 'public.svc_clase_modelos()',
    'public.svc_clase_ia_iniciar(uuid, uuid, uuid, text, text, text, numeric)', 'public.svc_clase_ia_finalizar(uuid, boolean, integer, integer, text, jsonb, jsonb)'] loop
    execute format('grant execute on function %s to service_role', f);
  end loop;
  foreach f in array array['public.clase_permisos(uuid)', 'public.clase_permisos_config(uuid, boolean, boolean)', 'public.clase_delegado_otorgar(uuid, uuid, timestamptz)',
    'public.clase_delegado_revocar(uuid)', 'public.clases_puedo_subir()', 'public.clase_crear(jsonb)', 'public.clase_editar(uuid, jsonb)',
    'public.clase_fotos_reordenar(uuid, uuid[])', 'public.clase_enviar(uuid, boolean)', 'public.clase_fotos_revisar(uuid, text, text)',
    'public.clases_mias()', 'public.clases_seccion(uuid)', 'public.clase_detalle(uuid)', 'public.clase_version_guardar(uuid, uuid, jsonb)',
    'public.clase_version_publicar(uuid, boolean)', 'public.clase_version_retirar(uuid, text)', 'public.clase_enlace_agregar(uuid, jsonb)',
    'public.clase_enlace_estado(uuid, text)', 'public.clases_brechas(uuid)', 'public.clase_modelo_preferido(text)', 'public.orbe_ia_modelos_lista()',
    'public.orbe_ia_modelo_actualizar(text, jsonb)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
