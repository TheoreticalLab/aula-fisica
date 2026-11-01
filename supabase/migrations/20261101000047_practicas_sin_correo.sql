-- =============================================================================
-- Prácticas anteriores · modalidad «Prácticas realizadas sin envío por correo» (cuaderno, clase, pizarra, casa…).
--
-- Principio: REGISTRAR PRIMERO, VERIFICAR DESPUÉS. El estudiante declara libremente (sin catálogo previo del profesor)
-- el nombre de la práctica, cuántos ejercicios tenía y cuántos hizo, con una foto representativa o una explicación de
-- por qué no la tiene. El profesor revisa, pide evidencia, valida una cantidad VERIFICADA (que puede diferir de la
-- declarada) y reconstruye poco a poco el catálogo consolidando nombres equivalentes. Nada se fusiona solo ni crea notas.
--
-- · hist_libres          declaración del estudiante. Conserva: valores INICIALES (inmutables), valores DECLARADOS
--                        (corregibles mientras se permita), total OFICIAL y realizados VERIFICADOS (del profesor).
-- · hist_libre_fotos     solo metadatos de las fotos (almacenamiento privado «regularizacion», prefijo libre/).
-- · hist_libre_grupos    catálogo consolidado de la sección (nombre y total oficiales), creado por el profesor.
-- · hist_libre_avisos    avisos a estudiantes sin registro de una práctica consolidada (no es un incumplimiento).
-- · hist_events          + libre_id, + libre_grupo_id: el mismo historial del módulo.
-- · hist_settings        + parámetros de la modalidad (nace deshabilitada).
-- Redefine con la misma firma: hist_bytes_seccion (cuenta también estas fotos), hist_config, hist_finalizar y
-- hist_pendientes (copiadas de la 45/46 con los añadidos marcados).
-- Aditiva: columnas con valor por defecto, tablas y funciones nuevas.
-- =============================================================================

alter table public.hist_settings add column if not exists libre_habilitado boolean not null default false;
alter table public.hist_settings add column if not exists libre_nuevos boolean not null default true;          -- false = cerrados los registros nuevos
alter table public.hist_settings add column if not exists libre_correcciones boolean not null default true;    -- el estudiante corrige lo no revisado
alter table public.hist_settings add column if not exists libre_sin_foto boolean not null default true;        -- registros sin foto con explicación
alter table public.hist_settings add column if not exists libre_nombres_libres boolean not null default true;  -- false = solo prácticas consolidadas
alter table public.hist_settings add column if not exists libre_max_registros integer not null default 60;
alter table public.hist_settings add column if not exists libre_max_ejercicios integer not null default 200;
alter table public.hist_settings add column if not exists libre_sugerencias boolean not null default true;
alter table public.hist_settings add column if not exists libre_solicitudes boolean not null default true;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hist_settings_libre_limites') then
    alter table public.hist_settings add constraint hist_settings_libre_limites
      check (libre_max_registros between 1 and 300 and libre_max_ejercicios between 1 and 1000);
  end if;
end $$;

create table if not exists public.hist_libre_grupos (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  nombre_oficial text not null check (char_length(btrim(nombre_oficial)) between 1 and 160),
  total_oficial integer check (total_oficial is null or total_oficial between 1 and 1000),
  descripcion text not null default '' check (char_length(descripcion) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hist_libre_grupos_clase on public.hist_libre_grupos (class_id);

create table if not exists public.hist_libres (
  id uuid primary key,                                   -- lo genera el navegador: guardar dos veces no duplica
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 160),
  nombre_original text not null check (char_length(nombre_original) <= 160),
  total_declarado integer not null check (total_declarado between 1 and 1000),
  realizados_declarados integer not null check (realizados_declarados >= 0),
  total_inicial integer not null,
  realizados_inicial integer not null,
  modalidades text[] not null default '{}' check (modalidades <@ array['cuaderno', 'hojas', 'clase', 'pizarra', 'casa', 'otra']::text[]),
  modalidad_otra text check (modalidad_otra is null or char_length(modalidad_otra) <= 120),
  sin_foto boolean not null default false,
  explicacion_sin_foto text check (explicacion_sin_foto is null or char_length(explicacion_sin_foto) <= 1000),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  estado text not null default 'declarado'
    check (estado in ('declarado', 'pendiente', 'evidencia_solicitada', 'en_revision', 'validado', 'correccion_solicitada')),
  grupo_elegido uuid references public.hist_libre_grupos (id) on delete set null,   -- práctica consolidada que eligió el estudiante (sugerencia)
  grupo_id uuid references public.hist_libre_grupos (id) on delete set null,        -- agrupación CONFIRMADA por el profesor
  grupo_at timestamptz,
  grupo_por uuid references public.profiles (id) on delete set null,
  total_oficial integer check (total_oficial is null or total_oficial between 1 and 1000),   -- corrección del profesor para este registro
  realizados_verificados integer check (realizados_verificados is null or realizados_verificados >= 0),
  validado_at timestamptz,
  validado_por uuid references public.profiles (id) on delete set null,
  revision_presencial_at timestamptz,
  revision_presencial_por uuid references public.profiles (id) on delete set null,
  solicitud_tipo text check (solicitud_tipo is null or solicitud_tipo in ('fotos', 'presencial', 'explicacion', 'correccion')),
  solicitud text check (solicitud is null or char_length(solicitud) <= 1000),
  solicitud_at timestamptz,
  respuesta text check (respuesta is null or char_length(respuesta) <= 1000),
  material_no_disponible boolean not null default false,
  respondido_at timestamptz,
  nota_docente text check (nota_docente is null or char_length(nota_docente) <= 1000),
  declaracion_version text not null,
  declaracion_at timestamptz not null,                   -- hora del SERVIDOR al aceptar la declaración
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (realizados_declarados <= total_declarado)
);
create index if not exists hist_libres_clase on public.hist_libres (class_id, estado);
create index if not exists hist_libres_usuario on public.hist_libres (user_id, class_id);
create index if not exists hist_libres_grupo on public.hist_libres (grupo_id);

create table if not exists public.hist_libre_fotos (
  id uuid primary key,
  libre_id uuid not null references public.hist_libres (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  posicion smallint not null check (posicion between 1 and 4),          -- 1 = representativa; 2–4 = adicionales pedidas por el profesor
  storage_path text not null check (char_length(storage_path) <= 220),
  mime text not null check (mime in ('image/webp', 'image/jpeg', 'image/png')),
  bytes integer not null check (bytes > 0),
  ancho integer not null check (ancho > 0),
  alto integer not null check (alto > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  sha256_original text check (sha256_original is null or sha256_original ~ '^[0-9a-f]{64}$'),
  bytes_original integer check (bytes_original is null or bytes_original > 0),
  created_at timestamptz not null default now(),
  unique (libre_id, posicion)
);
create index if not exists hist_libre_fotos_ruta on public.hist_libre_fotos (storage_path);
create index if not exists hist_libre_fotos_clase on public.hist_libre_fotos (class_id);

create table if not exists public.hist_libre_avisos (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  grupo_id uuid not null references public.hist_libre_grupos (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  nota text check (nota is null or char_length(nota) <= 1000),
  enviado_por uuid references public.profiles (id) on delete set null,
  enviado_at timestamptz not null default now(),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'registrada', 'no_realizada', 'otro_nombre')),
  respuesta text check (respuesta is null or char_length(respuesta) <= 1000),
  libre_id uuid references public.hist_libres (id) on delete set null,
  respondido_at timestamptz,
  unique (grupo_id, user_id)
);

alter table public.hist_events add column if not exists libre_id uuid references public.hist_libres (id) on delete set null;
alter table public.hist_events add column if not exists libre_grupo_id uuid references public.hist_libre_grupos (id) on delete set null;
create index if not exists hist_events_libre on public.hist_events (libre_id, at) where libre_id is not null;

alter table public.hist_libre_grupos enable row level security;
alter table public.hist_libres enable row level security;
alter table public.hist_libre_fotos enable row level security;
alter table public.hist_libre_avisos enable row level security;
revoke all on public.hist_libre_grupos, public.hist_libres, public.hist_libre_fotos, public.hist_libre_avisos from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Auxiliares internas
-- ---------------------------------------------------------------------------------------------------------------
-- Versión del texto de responsabilidad que muestra el navegador (src/lib/practicasLibres.ts: VERSION_DECLARACION).
create or replace function public.hist_libre_version()
returns text language sql immutable set search_path = '' as $$ select 'sin-correo-v1'::text $$;

create or replace function public.hist_libre_log(p_class uuid, p_libre uuid, p_grupo uuid, p_papel text, p_accion text,
  p_antes text, p_despues text, p_nota text, p_detalle jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.hist_events (class_id, libre_id, libre_grupo_id, actor, papel, accion, estado_antes, estado_despues, nota, detalle)
  values (p_class, p_libre, p_grupo, auth.uid(), p_papel, p_accion, p_antes, p_despues, nullif(btrim(coalesce(p_nota, '')), ''), coalesce(p_detalle, '{}'::jsonb))
$$;

-- ¿Puede el estudiante modificar este registro? Lo validado o en revisión, no. Las solicitudes del profesor siempre se
-- pueden atender (aunque estén cerradas las correcciones libres).
create or replace function public.hist_libre_editable(l public.hist_libres, s public.hist_settings)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(s.libre_habilitado, false) and (
    l.estado in ('evidencia_solicitada', 'correccion_solicitada')
    or (coalesce(s.libre_correcciones, true) and l.estado in ('declarado', 'pendiente')))
$$;

create or replace function public.hist_libre_falta_foto(l public.hist_libres)
returns boolean
language sql stable security definer set search_path = ''
as $$ select l.realizados_declarados > 0 and not l.sin_foto and not exists (select 1 from public.hist_libre_fotos f where f.libre_id = l.id and f.posicion = 1) $$;

-- Bytes ocupados por la sección (capturas de correo + fotos sin correo; cada archivo una vez).  [redefinida: + fotos]
create or replace function public.hist_bytes_seccion(p_class uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(b), 0)::bigint from (
    select max(bytes) as b from public.hist_captures where class_id = p_class group by storage_path
    union all
    select max(bytes) as b from public.hist_libre_fotos where class_id = p_class group by storage_path
  ) x
$$;

create or replace function public.hist_libre_json(l public.hist_libres)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', l.id, 'class_id', l.class_id, 'user_id', l.user_id, 'nombre', l.nombre, 'nombre_original', l.nombre_original,
    'total_declarado', l.total_declarado, 'realizados_declarados', l.realizados_declarados, 'total_inicial', l.total_inicial,
    'realizados_inicial', l.realizados_inicial, 'modalidades', to_jsonb(l.modalidades), 'modalidad_otra', l.modalidad_otra,
    'sin_foto', l.sin_foto, 'explicacion_sin_foto', l.explicacion_sin_foto, 'observaciones', l.observaciones, 'estado', l.estado,
    'grupo_elegido', l.grupo_elegido, 'grupo_id', l.grupo_id, 'total_oficial', l.total_oficial,
    'total_oficial_grupo', (select g.total_oficial from public.hist_libre_grupos g where g.id = l.grupo_id),
    'realizados_verificados', l.realizados_verificados, 'validado_at', l.validado_at, 'revision_presencial_at', l.revision_presencial_at,
    'solicitud_tipo', l.solicitud_tipo, 'solicitud', l.solicitud, 'solicitud_at', l.solicitud_at, 'respuesta', l.respuesta,
    'material_no_disponible', l.material_no_disponible, 'respondido_at', l.respondido_at, 'nota_docente', l.nota_docente,
    'declaracion_at', l.declaracion_at, 'created_at', l.created_at, 'updated_at', l.updated_at,
    'falta_foto', public.hist_libre_falta_foto(l),
    'fotos', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'posicion', f.posicion, 'bytes', f.bytes, 'ancho', f.ancho, 'alto', f.alto)
        order by f.posicion), '[]'::jsonb) from public.hist_libre_fotos f where f.libre_id = l.id))
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Estudiante
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.hist_libre_mias()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', c.id, 'class_name', c.name, 'course_title', co.title,
    'habilitado', coalesce(s.libre_habilitado, false), 'nuevos', coalesce(s.libre_nuevos, true) and not public.hist_terminado(c.id, auth.uid()),
    'correcciones', coalesce(s.libre_correcciones, true), 'sin_foto_permitido', coalesce(s.libre_sin_foto, true),
    'nombres_libres', coalesce(s.libre_nombres_libres, true), 'max_registros', coalesce(s.libre_max_registros, 60),
    'max_ejercicios', coalesce(s.libre_max_ejercicios, 200), 'max_mb_captura', coalesce(s.max_mb_captura, 2),
    'version', public.hist_libre_version(),
    'correo_abierto', coalesce(s.abierto, false),
    'terminado_at', (select ci.finalizado_at from public.hist_cierres ci where ci.class_id = c.id and ci.user_id = auth.uid()),
    'registros', (select coalesce(jsonb_agg(public.hist_libre_json(l) || jsonb_build_object('editable', public.hist_libre_editable(l, s)) order by l.created_at), '[]'::jsonb)
        from public.hist_libres l where l.class_id = c.id and l.user_id = auth.uid()),
    'grupos', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nombre', g.nombre_oficial) order by g.nombre_oficial), '[]'::jsonb)
        from public.hist_libre_grupos g where g.class_id = c.id),
    'avisos', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'grupo', g.nombre_oficial, 'total_oficial', g.total_oficial, 'nota', a.nota,
        'estado', a.estado, 'enviado_at', a.enviado_at) order by a.enviado_at), '[]'::jsonb)
        from public.hist_libre_avisos a join public.hist_libre_grupos g on g.id = a.grupo_id where a.class_id = c.id and a.user_id = auth.uid()),
    -- para advertir duplicados con la modalidad por correo
    'correo', (select coalesce(jsonb_agg(jsonb_build_object('tema', d.tema, 'practica', p.titulo, 'numero', p.numero)), '[]'::jsonb)
        from public.hist_declarations d join public.hist_practices p on p.id = d.practice_id where d.class_id = c.id and d.user_id = auth.uid())
  ) order by co.title, c.name), '[]'::jsonb)
  from public.enrollments e
  join public.classes c on c.id = e.class_id join public.courses co on co.id = c.course_id
  left join public.hist_settings s on s.class_id = c.id
  where e.user_id = auth.uid() and public.my_account_ok() and not c.archived
    and (s.libre_habilitado or exists (select 1 from public.hist_libres l where l.class_id = c.id and l.user_id = auth.uid()))
$$;

create or replace function public.hist_libre_guardar(p_id uuid, p_class uuid, p_nombre text, p_total integer, p_realizados integer,
  p_modalidades text[], p_modalidad_otra text, p_sin_foto boolean, p_explicacion text, p_observaciones text, p_grupo uuid,
  p_acepto boolean, p_version text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); s public.hist_settings; l public.hist_libres; v_nuevo boolean; v_nombre text; v_mods text[];
  v_sin_foto boolean := coalesce(p_sin_foto, false) and coalesce(p_realizados, 0) > 0;
begin
  if p_id is null then raise exception 'Falta el identificador del registro' using errcode = '22023'; end if;
  select * into l from public.hist_libres where id = p_id for update;
  v_nuevo := l.id is null;
  if not v_nuevo and (l.user_id <> v_uid or l.class_id <> p_class) then raise exception 'No tiene acceso a este registro' using errcode = '42501'; end if;
  if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = v_uid) or not public.my_account_ok() then
    raise exception 'No está inscrito en esta sección' using errcode = '42501';
  end if;
  select * into s from public.hist_settings where class_id = p_class;
  if not coalesce(s.libre_habilitado, false) then raise exception 'El registro de prácticas sin envío por correo no está habilitado en esta sección' using errcode = 'P0001'; end if;
  if not coalesce(p_acepto, false) then raise exception 'Debe aceptar la declaración de responsabilidad' using errcode = '22023'; end if;
  if p_version is distinct from public.hist_libre_version() then raise exception 'El texto de la declaración cambió: recargue la página y vuelva a leerlo' using errcode = 'P0001'; end if;
  if v_nuevo then
    if not s.libre_nuevos then raise exception 'El profesor cerró los registros nuevos; aún puede atender sus solicitudes' using errcode = 'P0001'; end if;
    if public.hist_terminado(p_class, v_uid) then raise exception 'Ya marcó que terminó la regularización; si necesita añadir algo, pida al profesor que se la reabra' using errcode = 'P0001'; end if;
    if (select count(*) from public.hist_libres x where x.user_id = v_uid and x.class_id = p_class) >= s.libre_max_registros then
      raise exception 'Alcanzó el máximo de % registros en esta sección', s.libre_max_registros using errcode = 'P0001';
    end if;
  elsif not public.hist_libre_editable(l, s) then
    raise exception '%', case l.estado when 'validado' then 'El profesor ya validó este registro; no se puede modificar'
      when 'en_revision' then 'El profesor está revisando este registro; no se puede modificar ahora'
      else 'El profesor no permite corregir los registros en este momento' end using errcode = 'P0001';
  end if;
  if p_total is null or p_total < 1 or p_total > s.libre_max_ejercicios then
    raise exception 'La cantidad total de ejercicios debe estar entre 1 y %', s.libre_max_ejercicios using errcode = '22023';
  end if;
  if p_realizados is null or p_realizados < 0 or p_realizados > p_total then
    raise exception 'Los ejercicios realizados deben estar entre 0 y % (el total de la práctica)', p_total using errcode = '22023';
  end if;
  if p_grupo is not null and not exists (select 1 from public.hist_libre_grupos g where g.id = p_grupo and g.class_id = p_class) then
    raise exception 'Esa práctica no pertenece a esta sección' using errcode = '22023';
  end if;
  if p_grupo is null and not s.libre_nombres_libres then raise exception 'Elija una de las prácticas de la lista' using errcode = '22023'; end if;
  v_nombre := coalesce(nullif(left(btrim(coalesce(p_nombre, '')), 160), ''), (select g.nombre_oficial from public.hist_libre_grupos g where g.id = p_grupo));
  if v_nombre is null then raise exception 'Escriba el nombre de la práctica' using errcode = '22023'; end if;
  if p_modalidades is not null and not (p_modalidades <@ array['cuaderno', 'hojas', 'clase', 'pizarra', 'casa', 'otra']::text[]) then
    raise exception 'Modalidad no válida' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct m order by m), '{}') into v_mods from unnest(coalesce(p_modalidades, '{}')) as u(m);
  if v_sin_foto then
    if not s.libre_sin_foto then raise exception 'El profesor pide una fotografía representativa en esta sección' using errcode = 'P0001'; end if;
    if char_length(btrim(coalesce(p_explicacion, ''))) < 10 then raise exception 'Explique brevemente por qué no tiene fotografía' using errcode = '22023'; end if;
  end if;

  if v_nuevo then
    insert into public.hist_libres (id, class_id, user_id, nombre, nombre_original, total_declarado, realizados_declarados, total_inicial, realizados_inicial,
      modalidades, modalidad_otra, sin_foto, explicacion_sin_foto, observaciones, grupo_elegido, declaracion_version, declaracion_at)
    values (p_id, p_class, v_uid, v_nombre, v_nombre, p_total, p_realizados, p_total, p_realizados, v_mods,
      case when 'otra' = any (v_mods) then nullif(left(btrim(coalesce(p_modalidad_otra, '')), 120), '') end, v_sin_foto,
      case when v_sin_foto then left(btrim(p_explicacion), 1000) end, nullif(left(btrim(coalesce(p_observaciones, '')), 1000), ''), p_grupo,
      public.hist_libre_version(), now())
    returning * into l;
    perform public.hist_libre_log(p_class, l.id, null, 'estudiante', 'creada', null, l.estado, null,
      jsonb_build_object('nombre', l.nombre, 'total', l.total_declarado, 'realizados', l.realizados_declarados, 'sin_foto', l.sin_foto, 'version', l.declaracion_version));
  else
    perform public.hist_libre_log(p_class, l.id, null, 'estudiante', 'corregida', l.estado, l.estado, null,
      jsonb_build_object('antes', jsonb_build_object('nombre', l.nombre, 'total', l.total_declarado, 'realizados', l.realizados_declarados, 'sin_foto', l.sin_foto),
                         'despues', jsonb_build_object('nombre', v_nombre, 'total', p_total, 'realizados', p_realizados, 'sin_foto', v_sin_foto)));
    update public.hist_libres set nombre = v_nombre, total_declarado = p_total, realizados_declarados = p_realizados, modalidades = v_mods,
      modalidad_otra = case when 'otra' = any (v_mods) then nullif(left(btrim(coalesce(p_modalidad_otra, '')), 120), '') end,
      sin_foto = v_sin_foto, explicacion_sin_foto = case when v_sin_foto then left(btrim(p_explicacion), 1000) end,
      observaciones = nullif(left(btrim(coalesce(p_observaciones, '')), 1000), ''), grupo_elegido = p_grupo,
      declaracion_version = public.hist_libre_version(), declaracion_at = now(), updated_at = now()
    where id = p_id returning * into l;
  end if;
  return jsonb_build_object('id', l.id, 'estado', l.estado, 'falta_foto', public.hist_libre_falta_foto(l));
end;
$$;

-- Responde a una solicitud del profesor (evidencia o corrección): vuelve a «pendiente de revisión».
create or replace function public.hist_libre_responder(p_id uuid, p_respuesta text, p_no_disponible boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare l public.hist_libres; s public.hist_settings;
begin
  select * into l from public.hist_libres where id = p_id for update;
  if l.id is null or l.user_id <> auth.uid() or not public.my_account_ok() then raise exception 'No tiene acceso a este registro' using errcode = '42501'; end if;
  select * into s from public.hist_settings where class_id = l.class_id;
  if not coalesce(s.libre_habilitado, false) then raise exception 'La modalidad no está habilitada' using errcode = 'P0001'; end if;
  if l.estado not in ('evidencia_solicitada', 'correccion_solicitada') then raise exception 'No hay ninguna solicitud del profesor pendiente en este registro' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_respuesta), '') = '' and not coalesce(p_no_disponible, false)
     and not (l.solicitud_tipo = 'fotos' and exists (select 1 from public.hist_libre_fotos f where f.libre_id = l.id and f.posicion > 1)) then
    raise exception 'Escriba una respuesta, adjunte la evidencia o indique que ya no conserva el material' using errcode = '22023';
  end if;
  update public.hist_libres set estado = 'pendiente', respuesta = nullif(left(btrim(coalesce(p_respuesta, '')), 1000), ''),
    material_no_disponible = coalesce(p_no_disponible, false), respondido_at = now(), updated_at = now()
  where id = p_id;
  perform public.hist_libre_log(l.class_id, l.id, null, 'estudiante', 'respuesta', l.estado, 'pendiente', p_respuesta,
    jsonb_build_object('material_no_disponible', coalesce(p_no_disponible, false)));
end;
$$;

-- Responde a un aviso de práctica consolidada sin registro. No crea declaraciones en su nombre.
create or replace function public.hist_libre_aviso_responder(p_aviso uuid, p_estado text, p_libre uuid, p_respuesta text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare a public.hist_libre_avisos;
begin
  select * into a from public.hist_libre_avisos where id = p_aviso for update;
  if a.id is null or a.user_id <> auth.uid() or not public.my_account_ok() then raise exception 'No tiene acceso a este aviso' using errcode = '42501'; end if;
  if p_estado not in ('registrada', 'no_realizada', 'otro_nombre') then raise exception 'Respuesta no válida' using errcode = '22023'; end if;
  if p_estado in ('registrada', 'otro_nombre') and p_libre is not null
     and not exists (select 1 from public.hist_libres l where l.id = p_libre and l.user_id = auth.uid() and l.class_id = a.class_id) then
    raise exception 'Ese registro no es suyo' using errcode = '42501';
  end if;
  if p_estado = 'registrada' and p_libre is null then raise exception 'Indique cuál de sus registros corresponde a esta práctica' using errcode = '22023'; end if;
  update public.hist_libre_avisos set estado = p_estado, libre_id = p_libre, respuesta = nullif(left(btrim(coalesce(p_respuesta, '')), 1000), ''), respondido_at = now()
    where id = p_aviso;
  perform public.hist_libre_log(a.class_id, p_libre, a.grupo_id, 'estudiante', 'aviso_respondido', 'pendiente', p_estado, p_respuesta, '{}');
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Profesorado
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.hist_libre_configurar(p_class uuid, p_habilitado boolean, p_nuevos boolean, p_correcciones boolean,
  p_sin_foto boolean, p_nombres_libres boolean, p_max_registros integer, p_max_ejercicios integer, p_sugerencias boolean, p_solicitudes boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.hist_assert_teacher(p_class);
  insert into public.hist_settings (class_id, updated_by) values (p_class, auth.uid()) on conflict (class_id) do nothing;   -- la modalidad por correo sigue cerrada si no estaba abierta
  update public.hist_settings set
    libre_habilitado = coalesce(p_habilitado, libre_habilitado), libre_nuevos = coalesce(p_nuevos, libre_nuevos),
    libre_correcciones = coalesce(p_correcciones, libre_correcciones), libre_sin_foto = coalesce(p_sin_foto, libre_sin_foto),
    libre_nombres_libres = coalesce(p_nombres_libres, libre_nombres_libres), libre_max_registros = coalesce(p_max_registros, libre_max_registros),
    libre_max_ejercicios = coalesce(p_max_ejercicios, libre_max_ejercicios), libre_sugerencias = coalesce(p_sugerencias, libre_sugerencias),
    libre_solicitudes = coalesce(p_solicitudes, libre_solicitudes), updated_by = auth.uid(), updated_at = now()
  where class_id = p_class;
  perform public.hist_libre_log(p_class, null, null, 'docente', 'configuracion', null, null, null,
    jsonb_build_object('habilitado', p_habilitado, 'nuevos', p_nuevos, 'correcciones', p_correcciones, 'sin_foto', p_sin_foto, 'nombres_libres', p_nombres_libres,
      'max_registros', p_max_registros, 'max_ejercicios', p_max_ejercicios, 'sugerencias', p_sugerencias, 'solicitudes', p_solicitudes));
end;
$$;

-- Todo lo que necesita la pestaña «Prácticas sin correo» de una sección.
create or replace function public.hist_libre_datos(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.hist_settings;
begin
  perform public.hist_assert_teacher(p_class);
  select * into s from public.hist_settings where class_id = p_class;
  return jsonb_build_object(
    'config', jsonb_build_object('habilitado', coalesce(s.libre_habilitado, false), 'nuevos', coalesce(s.libre_nuevos, true),
      'correcciones', coalesce(s.libre_correcciones, true), 'sin_foto', coalesce(s.libre_sin_foto, true), 'nombres_libres', coalesce(s.libre_nombres_libres, true),
      'max_registros', coalesce(s.libre_max_registros, 60), 'max_ejercicios', coalesce(s.libre_max_ejercicios, 200),
      'sugerencias', coalesce(s.libre_sugerencias, true), 'solicitudes', coalesce(s.libre_solicitudes, true), 'max_mb_captura', coalesce(s.max_mb_captura, 2),
      'cuota_mb', coalesce(s.cuota_mb, 300), 'bytes_seccion', public.hist_bytes_seccion(p_class)),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'student_code', p.student_code, 'group_name', g.name)
        order by p.full_name), '[]'::jsonb)
        from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' left join public.class_groups g on g.id = e.group_id
        where e.class_id = p_class),
    'registros', (select coalesce(jsonb_agg(public.hist_libre_json(l) order by l.created_at), '[]'::jsonb) from public.hist_libres l where l.class_id = p_class),
    'grupos', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nombre_oficial', g.nombre_oficial, 'total_oficial', g.total_oficial,
        'descripcion', g.descripcion, 'created_at', g.created_at) order by g.nombre_oficial), '[]'::jsonb) from public.hist_libre_grupos g where g.class_id = p_class),
    'avisos', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'grupo_id', a.grupo_id, 'user_id', a.user_id, 'estado', a.estado, 'respuesta', a.respuesta,
        'libre_id', a.libre_id, 'enviado_at', a.enviado_at, 'respondido_at', a.respondido_at)), '[]'::jsonb) from public.hist_libre_avisos a where a.class_id = p_class),
    'correo', (select coalesce(jsonb_agg(jsonb_build_object('user_id', d.user_id, 'tema', d.tema, 'practica', p.titulo, 'numero', p.numero)), '[]'::jsonb)
        from public.hist_declarations d join public.hist_practices p on p.id = d.practice_id where d.class_id = p_class and d.estado <> 'borrador')
  );
end;
$$;

create or replace function public.hist_libre_historial(p_id uuid)
returns table (at timestamptz, papel text, actor_name text, accion text, estado_antes text, estado_despues text, nota text, detalle jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.hist_libres where id = p_id;
  perform public.hist_assert_teacher(v_class);
  return query select ev.at, ev.papel, pr.full_name, ev.accion, ev.estado_antes, ev.estado_despues, ev.nota, ev.detalle
    from public.hist_events ev left join public.profiles pr on pr.id = ev.actor where ev.libre_id = p_id order by ev.at, ev.id;
end;
$$;

-- Acciones del profesor. Validar exige la cantidad VERIFICADA (puede diferir de la declarada). Ninguna crea notas.
create or replace function public.hist_libre_revisar(p_ids uuid[], p_accion text, p_nota text, p_tipo text, p_verificados integer, p_total_oficial integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  l public.hist_libres; s public.hist_settings; v_id uuid; v_ok integer := 0; v_errores jsonb := '[]'::jsonb; v_motivo text; v_nuevo text;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), ''); v_limite integer; v_total_grupo integer; v_msg uuid; v_texto text;
begin
  if p_accion not in ('en_revision', 'solicitar_evidencia', 'solicitar_correccion', 'presencial', 'validar', 'reabrir', 'total_oficial') then
    raise exception 'Acción no válida' using errcode = '22023';
  end if;
  if p_accion in ('solicitar_evidencia', 'solicitar_correccion', 'reabrir') and v_nota is null then raise exception 'Escriba una nota que explique la acción' using errcode = '22023'; end if;
  if p_accion = 'solicitar_evidencia' and coalesce(p_tipo, '') not in ('fotos', 'presencial', 'explicacion') then raise exception 'Tipo de evidencia no válido' using errcode = '22023'; end if;
  if p_accion = 'validar' and p_verificados is null then raise exception 'Indique cuántos ejercicios verificó' using errcode = '22023'; end if;
  if p_accion = 'total_oficial' and p_total_oficial is null then raise exception 'Indique el total oficial' using errcode = '22023'; end if;
  if p_total_oficial is not null and p_total_oficial not between 1 and 1000 then raise exception 'El total oficial debe estar entre 1 y 1000' using errcode = '22023'; end if;
  if coalesce(cardinality(p_ids), 0) = 0 or cardinality(p_ids) > 500 then raise exception 'Seleccione entre 1 y 500 registros' using errcode = '22023'; end if;
  foreach v_id in array p_ids loop
    select * into l from public.hist_libres where id = v_id for update;
    if l.id is null then v_errores := v_errores || jsonb_build_object('id', v_id, 'motivo', 'No existe'); continue; end if;
    perform public.hist_assert_teacher(l.class_id);
    select * into s from public.hist_settings where class_id = l.class_id;
    select total_oficial into v_total_grupo from public.hist_libre_grupos where id = l.grupo_id;
    v_limite := coalesce(p_total_oficial, l.total_oficial, v_total_grupo, l.total_declarado);
    v_motivo := case
      when p_accion = 'reabrir' and l.estado <> 'validado' then 'No está validado'
      when p_accion not in ('reabrir', 'total_oficial') and l.estado = 'validado' then 'Está validado: primero reábralo'
      when p_accion = 'solicitar_evidencia' and not coalesce(s.libre_solicitudes, true) then 'Las solicitudes de evidencia están desactivadas en esta sección'
      when p_accion = 'validar' and (p_verificados < 0 or p_verificados > v_limite) then format('Los verificados deben estar entre 0 y %s', v_limite)
      when p_accion = 'total_oficial' and l.realizados_verificados is not null and l.realizados_verificados > p_total_oficial then 'Ya hay más ejercicios verificados que ese total'
    end;
    if v_motivo is not null then v_errores := v_errores || jsonb_build_object('id', v_id, 'motivo', v_motivo); continue; end if;
    v_nuevo := case p_accion when 'en_revision' then 'en_revision' when 'solicitar_evidencia' then 'evidencia_solicitada'
      when 'solicitar_correccion' then 'correccion_solicitada' when 'presencial' then 'en_revision' when 'validar' then 'validado'
      when 'reabrir' then 'en_revision' else l.estado end;
    perform public.hist_libre_log(l.class_id, l.id, l.grupo_id, 'docente', p_accion, l.estado, v_nuevo, v_nota,
      jsonb_build_object('declarados', jsonb_build_object('total', l.total_declarado, 'realizados', l.realizados_declarados),
        'total_oficial_antes', l.total_oficial, 'total_oficial', coalesce(p_total_oficial, l.total_oficial),
        'verificados_antes', l.realizados_verificados, 'verificados', case when p_accion = 'validar' then p_verificados else l.realizados_verificados end,
        'tipo', p_tipo));
    update public.hist_libres set
      estado = v_nuevo,
      total_oficial = coalesce(p_total_oficial, total_oficial),
      realizados_verificados = case when p_accion = 'validar' then p_verificados else realizados_verificados end,
      validado_at = case when p_accion = 'validar' then now() when p_accion = 'reabrir' then null else validado_at end,
      validado_por = case when p_accion = 'validar' then auth.uid() when p_accion = 'reabrir' then null else validado_por end,
      revision_presencial_at = case when p_accion = 'presencial' then now() else revision_presencial_at end,
      revision_presencial_por = case when p_accion = 'presencial' then auth.uid() else revision_presencial_por end,
      solicitud_tipo = case when p_accion = 'solicitar_evidencia' then p_tipo when p_accion = 'solicitar_correccion' then 'correccion' else solicitud_tipo end,
      solicitud = case when p_accion in ('solicitar_evidencia', 'solicitar_correccion') then v_nota else solicitud end,
      solicitud_at = case when p_accion in ('solicitar_evidencia', 'solicitar_correccion') then now() else solicitud_at end,
      nota_docente = coalesce(v_nota, nota_docente),
      updated_at = now()
    where id = l.id;
    if p_accion in ('solicitar_evidencia', 'solicitar_correccion') then
      begin
        v_texto := case when p_accion = 'solicitar_evidencia'
          then format('El profesor solicita que presentes evidencia adicional de la práctica «%s». Declaraste haber realizado %s de %s ejercicios. %s',
                      l.nombre, l.realizados_declarados, l.total_declarado, v_nota)
          else format('El profesor solicita una corrección en tu registro de la práctica «%s» (%s de %s ejercicios). %s',
                      l.nombre, l.realizados_declarados, l.total_declarado, v_nota) end
          || ' Responde en Mi cuenta → Prácticas anteriores → Sin envío por correo.';
        insert into public.live_messages (sender_id, kind, body, audience)
          values (auth.uid(), 'importante', left(v_texto, 2000), jsonb_build_object('modo', 'regularizacion', 'seccion', l.class_id, 'seleccionados', 1))
          returning id into v_msg;
        insert into public.live_message_recipients (message_id, user_id) values (v_msg, l.user_id);
      exception when others then null;
      end;
    end if;
    v_ok := v_ok + 1;
  end loop;
  return jsonb_build_object('aplicadas', v_ok, 'errores', v_errores);
end;
$$;

-- Catálogo consolidado: crear o editar una práctica oficial (nombre y total oficiales). No toca las declaraciones.
create or replace function public.hist_libre_grupo_guardar(p_id uuid, p_class uuid, p_nombre text, p_total_oficial integer, p_descripcion text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare g public.hist_libre_grupos; v_class uuid := p_class; v_id uuid;
begin
  if p_id is not null then select * into g from public.hist_libre_grupos where id = p_id; v_class := g.class_id; end if;
  perform public.hist_assert_teacher(v_class);
  if char_length(btrim(coalesce(p_nombre, ''))) = 0 then raise exception 'Escriba el nombre oficial' using errcode = '22023'; end if;
  if p_total_oficial is not null and p_total_oficial not between 1 and 1000 then raise exception 'El total oficial debe estar entre 1 y 1000' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.hist_libre_grupos (class_id, nombre_oficial, total_oficial, descripcion, created_by)
      values (v_class, left(btrim(p_nombre), 160), p_total_oficial, left(btrim(coalesce(p_descripcion, '')), 1000), auth.uid()) returning id into v_id;
    perform public.hist_libre_log(v_class, null, v_id, 'docente', 'grupo_creado', null, null, null, jsonb_build_object('nombre', btrim(p_nombre), 'total_oficial', p_total_oficial));
  else
    update public.hist_libre_grupos set nombre_oficial = left(btrim(p_nombre), 160), total_oficial = p_total_oficial,
      descripcion = left(btrim(coalesce(p_descripcion, '')), 1000), updated_at = now() where id = p_id returning id into v_id;
    perform public.hist_libre_log(v_class, null, v_id, 'docente', 'grupo_editado', null, null, null,
      jsonb_build_object('antes', jsonb_build_object('nombre', g.nombre_oficial, 'total_oficial', g.total_oficial), 'despues', jsonb_build_object('nombre', btrim(p_nombre), 'total_oficial', p_total_oficial)));
  end if;
  return v_id;
end;
$$;

-- Confirma que unos registros corresponden a una práctica consolidada (p_grupo null = sacarlos de su grupo).
-- Los nombres y cantidades que escribieron los estudiantes NO cambian.
create or replace function public.hist_libre_agrupar(p_grupo uuid, p_ids uuid[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid; n integer;
begin
  if coalesce(cardinality(p_ids), 0) = 0 then raise exception 'Seleccione al menos un registro' using errcode = '22023'; end if;
  if (select count(distinct class_id) from public.hist_libres where id = any (p_ids)) <> 1 then raise exception 'Los registros deben ser de una misma sección' using errcode = '22023'; end if;
  select min(class_id::text)::uuid into v_class from public.hist_libres where id = any (p_ids);
  perform public.hist_assert_teacher(v_class);
  if p_grupo is not null and not exists (select 1 from public.hist_libre_grupos where id = p_grupo and class_id = v_class) then
    raise exception 'La práctica consolidada no pertenece a esta sección' using errcode = '22023';
  end if;
  insert into public.hist_events (class_id, libre_id, libre_grupo_id, actor, papel, accion, estado_antes, estado_despues, detalle)
    select v_class, l.id, p_grupo, auth.uid(), 'docente', case when p_grupo is null then 'desagrupada' else 'agrupada' end, l.estado, l.estado,
      jsonb_build_object('desde', l.grupo_id, 'hacia', p_grupo, 'nombre_estudiante', l.nombre, 'total_declarado', l.total_declarado)
    from public.hist_libres l where l.id = any (p_ids) and l.grupo_id is distinct from p_grupo;
  update public.hist_libres set grupo_id = p_grupo, grupo_at = case when p_grupo is null then null else now() end,
    grupo_por = case when p_grupo is null then null else auth.uid() end, updated_at = now()
  where id = any (p_ids) and grupo_id is distinct from p_grupo;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Estudiantes de la sección SIN registro en una práctica consolidada (posible omisión, NO incumplimiento).
create or replace function public.hist_libre_omisiones(p_grupo uuid)
returns table (user_id uuid, full_name text, aviso text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.hist_libre_grupos where id = p_grupo;
  perform public.hist_assert_teacher(v_class);
  return query select p.id, p.full_name, (select a.estado from public.hist_libre_avisos a where a.grupo_id = p_grupo and a.user_id = p.id)
    from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
    where e.class_id = v_class and not exists (select 1 from public.hist_libres l where l.grupo_id = p_grupo and l.user_id = p.id)
    order by p.full_name;
end;
$$;

-- Aviso a estudiantes sin registro de una práctica consolidada (por el Centro de Comunicación). No declara por ellos.
create or replace function public.hist_libre_avisar(p_grupo uuid, p_users uuid[], p_nota text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare g public.hist_libre_grupos; v_user uuid; n integer := 0; v_msg uuid;
begin
  select * into g from public.hist_libre_grupos where id = p_grupo;
  perform public.hist_assert_teacher(g.class_id);
  foreach v_user in array coalesce(p_users, '{}') loop
    continue when not exists (select 1 from public.enrollments e where e.class_id = g.class_id and e.user_id = v_user)
      or exists (select 1 from public.hist_libres l where l.grupo_id = p_grupo and l.user_id = v_user);
    insert into public.hist_libre_avisos (class_id, grupo_id, user_id, nota, enviado_por)
      values (g.class_id, p_grupo, v_user, nullif(left(btrim(coalesce(p_nota, '')), 1000), ''), auth.uid())
    on conflict (grupo_id, user_id) do update set estado = 'pendiente', nota = excluded.nota, enviado_por = excluded.enviado_por, enviado_at = now(),
      respuesta = null, libre_id = null, respondido_at = null;
    perform public.hist_libre_log(g.class_id, null, p_grupo, 'docente', 'aviso_omision', null, 'pendiente', p_nota, jsonb_build_object('estudiante', v_user));
    begin
      insert into public.live_messages (sender_id, kind, body, audience)
        values (auth.uid(), 'importante', left(format('Prácticas anteriores: no tienes un registro de la práctica «%s»%s. Indica si la realizaste (y cuántos ejercicios), si no la hiciste o si ya la registraste con otro nombre. %s Responde en Mi cuenta → Prácticas anteriores → Sin envío por correo.',
                  g.nombre_oficial, case when g.total_oficial is not null then format(' (%s ejercicios)', g.total_oficial) else '' end, coalesce(btrim(p_nota), '')), 2000),
                jsonb_build_object('modo', 'regularizacion', 'seccion', g.class_id, 'seleccionados', 1))
        returning id into v_msg;
      insert into public.live_message_recipients (message_id, user_id) values (v_msg, v_user);
    exception when others then null;
    end;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Servidor (Edge Function «entregas»): fotos en el almacenamiento privado, ruta libre/<sección>/<estudiante>/<sha>.ext
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.svc_hist_libre_foto_check(p_user uuid, p_libre uuid, p_posicion integer, p_bytes integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare l public.hist_libres; s public.hist_settings;
begin
  select * into l from public.hist_libres where id = p_libre;
  if l.id is null or l.user_id <> p_user or not public.account_ok(p_user)
     or not exists (select 1 from public.enrollments e where e.class_id = l.class_id and e.user_id = p_user) then
    raise exception 'No tiene acceso a este registro' using errcode = '42501';
  end if;
  select * into s from public.hist_settings where class_id = l.class_id;
  if p_posicion is null or p_posicion not between 1 and 4 then raise exception 'Posición de foto no válida' using errcode = '22023'; end if;
  if p_posicion = 1 and not public.hist_libre_editable(l, s) then raise exception 'Este registro ya no se puede modificar' using errcode = '42501'; end if;
  if p_posicion > 1 and (not coalesce(s.libre_habilitado, false) or l.estado not in ('evidencia_solicitada', 'correccion_solicitada')) then
    raise exception 'Las fotos adicionales se adjuntan cuando el profesor las solicita' using errcode = '42501';
  end if;
  if p_bytes is null or p_bytes <= 0 or p_bytes > s.max_mb_captura * 1048576 then
    raise exception 'La foto supera el máximo de % MB después de optimizarla', s.max_mb_captura using errcode = '22023';
  end if;
  if public.hist_bytes_seccion(l.class_id) + p_bytes > s.cuota_mb::bigint * 1048576 then
    raise exception 'Se alcanzó el espacio reservado para las imágenes de esta sección; su registro sigue guardado. Avise al profesor' using errcode = 'P0001';
  end if;
  return jsonb_build_object('class_id', l.class_id, 'max_bytes', (s.max_mb_captura * 1048576)::bigint);
end;
$$;

create or replace function public.svc_hist_libre_foto_registrar(p_user uuid, p_libre uuid, p_posicion integer, p_id uuid, p_path text, p_mime text,
  p_bytes integer, p_ancho integer, p_alto integer, p_sha text, p_sha_original text, p_bytes_original integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare l public.hist_libres; v_ext text; v_old public.hist_libre_fotos; v_libre text;
begin
  select * into l from public.hist_libres where id = p_libre for update;
  perform public.svc_hist_libre_foto_check(p_user, p_libre, p_posicion, p_bytes);
  v_ext := case p_mime when 'image/webp' then 'webp' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end;
  if v_ext is null then raise exception 'Formato no permitido' using errcode = '22023'; end if;
  if p_path <> 'libre/' || l.class_id::text || '/' || p_user::text || '/' || p_sha || '.' || v_ext then raise exception 'Ruta no válida' using errcode = '22023'; end if;
  if exists (select 1 from public.hist_libre_fotos f where f.libre_id = p_libre and f.storage_path = p_path and f.posicion <> p_posicion) then
    raise exception 'Esa misma imagen ya está adjunta en este registro' using errcode = 'P0001';
  end if;
  select * into v_old from public.hist_libre_fotos where libre_id = p_libre and posicion = p_posicion;
  if v_old.id is not null then
    delete from public.hist_libre_fotos where id = v_old.id;
    if v_old.storage_path <> p_path and not exists (select 1 from public.hist_libre_fotos f where f.storage_path = v_old.storage_path) then v_libre := v_old.storage_path; end if;
  end if;
  insert into public.hist_libre_fotos (id, libre_id, class_id, user_id, posicion, storage_path, mime, bytes, ancho, alto, sha256, sha256_original, bytes_original)
    values (p_id, p_libre, l.class_id, p_user, p_posicion, p_path, p_mime, p_bytes, p_ancho, p_alto, p_sha, p_sha_original, p_bytes_original);
  insert into public.hist_events (class_id, libre_id, actor, papel, accion, estado_antes, estado_despues, detalle)
    values (l.class_id, l.id, p_user, 'estudiante', case when v_old.id is null then 'foto' else 'foto_reemplazada' end, l.estado, l.estado,
            jsonb_build_object('posicion', p_posicion, 'bytes', p_bytes, 'sha256', p_sha, 'anterior', v_old.sha256));
  return jsonb_build_object('id', p_id, 'liberar', v_libre);
end;
$$;

create or replace function public.svc_hist_libre_foto_ruta(p_user uuid, p_foto uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare f public.hist_libre_fotos; v_course uuid;
begin
  select * into f from public.hist_libre_fotos where id = p_foto;
  if f.id is null then raise exception 'Foto no encontrada' using errcode = 'P0002'; end if;
  select course_id into v_course from public.classes where id = f.class_id;
  if not public.account_ok(p_user) or not (
       f.user_id = p_user
       or exists (select 1 from public.class_teachers t where t.class_id = f.class_id and t.user_id = p_user)
       or exists (select 1 from public.course_staff s where s.course_id = v_course and s.user_id = p_user)
       or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')) then
    raise exception 'No tiene acceso a esta foto' using errcode = '42501';
  end if;
  return f.storage_path;
end;
$$;

create or replace function public.svc_hist_libre_foto_quitar(p_user uuid, p_foto uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare f public.hist_libre_fotos; l public.hist_libres; s public.hist_settings;
begin
  select * into f from public.hist_libre_fotos where id = p_foto;
  if f.id is null then raise exception 'Foto no encontrada' using errcode = 'P0002'; end if;
  select * into l from public.hist_libres where id = f.libre_id for update;
  select * into s from public.hist_settings where class_id = l.class_id;
  if l.user_id <> p_user or not public.account_ok(p_user) then raise exception 'No tiene acceso a esta foto' using errcode = '42501'; end if;
  if not public.hist_libre_editable(l, s) then raise exception 'Este registro ya no se puede modificar' using errcode = '42501'; end if;
  delete from public.hist_libre_fotos where id = p_foto;
  insert into public.hist_events (class_id, libre_id, actor, papel, accion, estado_antes, estado_despues, detalle)
    values (l.class_id, l.id, p_user, 'estudiante', 'foto_quitada', l.estado, l.estado, jsonb_build_object('posicion', f.posicion, 'sha256', f.sha256));
  return case when exists (select 1 from public.hist_libre_fotos x where x.storage_path = f.storage_path) then null else f.storage_path end;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Redefiniciones (misma firma)
-- ---------------------------------------------------------------------------------------------------------------
-- hist_config (de la 46): + modalidad sin correo; el almacenamiento del módulo cuenta también estas fotos
create or replace function public.hist_config(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.hist_settings;
begin
  perform public.hist_assert_teacher(p_class);
  select * into s from public.hist_settings where class_id = p_class;
  return jsonb_build_object(
    'configurado', s.class_id is not null,
    'abierto', coalesce(s.abierto, false),
    'recordar', coalesce(s.recordar, true),
    'terminados', (select count(*) from public.hist_cierres c where c.class_id = p_class and c.finalizado_at is not null),
    'libre_habilitado', coalesce(s.libre_habilitado, false),                                                   -- añadido (47)
    'mensaje', coalesce(s.mensaje, ''),
    'margen_dias', coalesce(s.margen_dias, 7),
    'max_mb_captura', coalesce(s.max_mb_captura, 2),
    'cuota_mb', coalesce(s.cuota_mb, 300),
    'max_registros', coalesce(s.max_registros, 40),
    'practicas', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'numero', p.numero, 'titulo', p.titulo, 'descripcion', p.descripcion,
        'provisional', p.provisional, 'origen', p.origen, 'archivada', p.archivada, 'unida_a', p.unida_a, 'activity_id', p.activity_id,
        'actividad', (select a.title from public.activities a where a.id = p.activity_id),
        'declaraciones', (select count(*) from public.hist_declarations d where d.practice_id = p.id and d.estado <> 'borrador'),
        'borradores', (select count(*) from public.hist_declarations d where d.practice_id = p.id and d.estado = 'borrador'))
        order by p.archivada, p.numero), '[]'::jsonb) from public.hist_practices p where p.class_id = p_class),
    'actividades', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title) order by a.created_at), '[]'::jsonb)
        from public.activities a where a.class_id = p_class),
    'almacenamiento', jsonb_build_object(
      'bytes_seccion', public.hist_bytes_seccion(p_class),
      'archivos_seccion', (select count(distinct storage_path) from public.hist_captures where class_id = p_class)
                        + (select count(distinct storage_path) from public.hist_libre_fotos where class_id = p_class),   -- (47)
      'bytes_modulo', (select coalesce(sum(b), 0)::bigint from (select max(bytes) as b from public.hist_captures group by storage_path
                        union all select max(bytes) as b from public.hist_libre_fotos group by storage_path) x),         -- (47)
      'archivos_modulo', (select count(distinct storage_path) from public.hist_captures) + (select count(distinct storage_path) from public.hist_libre_fotos))
  );
end;
$$;

-- hist_finalizar (de la 46): también vale con solo la modalidad sin correo habilitada y cuenta esos registros
create or replace function public.hist_finalizar(p_class uuid, p_sin_practicas boolean, p_nota text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_borradores integer; v_enviadas integer;
begin
  if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = v_uid) or not public.my_account_ok() then
    raise exception 'No está inscrito en esta sección' using errcode = '42501';
  end if;
  if not coalesce((select abierto or libre_habilitado from public.hist_settings where class_id = p_class), false) then        -- (47)
    raise exception 'La regularización de prácticas no está abierta en esta sección' using errcode = 'P0001';
  end if;
  select count(*) filter (where estado = 'borrador'), count(*) filter (where estado <> 'borrador') into v_borradores, v_enviadas
    from public.hist_declarations where class_id = p_class and user_id = v_uid;
  v_enviadas := v_enviadas + (select count(*) from public.hist_libres where class_id = p_class and user_id = v_uid);          -- (47)
  if v_borradores > 0 then
    raise exception 'Tiene % borrador(es) sin registrar: regístrelos o elimínelos antes de terminar', v_borradores using errcode = 'P0001';
  end if;
  if v_enviadas = 0 and not coalesce(p_sin_practicas, false) then
    raise exception 'No ha registrado ninguna práctica. Si no tiene prácticas anteriores que regularizar, márquelo expresamente' using errcode = '22023';
  end if;
  if v_enviadas > 0 and coalesce(p_sin_practicas, false) then
    raise exception 'Ya registró prácticas: no puede declarar que no tiene ninguna' using errcode = '22023';
  end if;
  insert into public.hist_cierres (class_id, user_id, finalizado_at, sin_practicas, registradas, nota)
    values (p_class, v_uid, now(), coalesce(p_sin_practicas, false), v_enviadas, nullif(left(btrim(coalesce(p_nota, '')), 500), ''))
  on conflict (class_id, user_id) do update set finalizado_at = now(), sin_practicas = excluded.sin_practicas, registradas = excluded.registradas, nota = excluded.nota;
  perform public.hist_log(p_class, null, null, null, 'estudiante', 'terminada', null, null, p_nota,
    jsonb_build_object('registradas', v_enviadas, 'sin_practicas', coalesce(p_sin_practicas, false)));
  return jsonb_build_object('registradas', v_enviadas, 'sin_practicas', coalesce(p_sin_practicas, false));
end;
$$;

-- hist_pendientes (de la 46): + solicitudes del profesor y avisos de omisión de la modalidad sin correo
create or replace function public.hist_pendientes()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'course_title', x->>'class_name'), '[]'::jsonb) from (
    select jsonb_build_object('class_id', c.id, 'class_name', c.name, 'course_title', co.title,
      'sin_terminar', s.recordar and not public.hist_terminado(c.id, auth.uid()),
      'registradas', (select count(*) from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid() and d.estado <> 'borrador')
                   + (select count(*) from public.hist_libres l where l.class_id = c.id and l.user_id = auth.uid()),            -- (47)
      'borradores', (select count(*) from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid() and d.estado = 'borrador'),
      'aclaraciones', (select count(*) from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid() and d.estado = 'aclaracion'),
      'solicitudes', (select count(*) from public.hist_libres l where l.class_id = c.id and l.user_id = auth.uid()                -- (47)
                      and l.estado in ('evidencia_solicitada', 'correccion_solicitada')),
      'avisos', (select count(*) from public.hist_libre_avisos a where a.class_id = c.id and a.user_id = auth.uid() and a.estado = 'pendiente')) as x  -- (47)
    from public.enrollments e
    join public.classes c on c.id = e.class_id join public.courses co on co.id = c.course_id
    join public.hist_settings s on s.class_id = c.id
    join public.profiles pr on pr.id = auth.uid() and pr.role = 'student'
    where e.user_id = auth.uid() and public.my_account_ok() and not c.archived and (s.abierto or s.libre_habilitado)            -- (47)
  ) t
  where (x->>'sin_terminar')::boolean or (x->>'aclaraciones')::int > 0 or (x->>'solicitudes')::int > 0 or (x->>'avisos')::int > 0
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------------------------------------------
revoke all on function public.hist_libre_log(uuid, uuid, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.hist_libre_editable(public.hist_libres, public.hist_settings) from public, anon, authenticated;
revoke all on function public.hist_libre_falta_foto(public.hist_libres) from public, anon, authenticated;
revoke all on function public.hist_libre_json(public.hist_libres) from public, anon, authenticated;
revoke all on function public.hist_bytes_seccion(uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'svc_hist_libre_foto_check(uuid, uuid, integer, integer)',
    'svc_hist_libre_foto_registrar(uuid, uuid, integer, uuid, text, text, integer, integer, integer, text, text, integer)',
    'svc_hist_libre_foto_ruta(uuid, uuid)', 'svc_hist_libre_foto_quitar(uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  foreach f in array array[
    'hist_libre_version()', 'hist_libre_mias()',
    'hist_libre_guardar(uuid, uuid, text, integer, integer, text[], text, boolean, text, text, uuid, boolean, text)',
    'hist_libre_responder(uuid, text, boolean)', 'hist_libre_aviso_responder(uuid, text, uuid, text)',
    'hist_libre_configurar(uuid, boolean, boolean, boolean, boolean, boolean, integer, integer, boolean, boolean)',
    'hist_libre_datos(uuid)', 'hist_libre_historial(uuid)', 'hist_libre_revisar(uuid[], text, text, text, integer, integer)',
    'hist_libre_grupo_guardar(uuid, uuid, text, integer, text)', 'hist_libre_agrupar(uuid, uuid[])', 'hist_libre_omisiones(uuid)',
    'hist_libre_avisar(uuid, uuid[], text)', 'hist_config(uuid)', 'hist_finalizar(uuid, boolean, text)', 'hist_pendientes()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
