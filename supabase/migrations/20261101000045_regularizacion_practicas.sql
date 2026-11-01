-- =============================================================================
-- Regularización de prácticas anteriores (entregadas antes del aula virtual, por correo u otra vía).
--
-- El estudiante NO vuelve a subir el trabajo: declara qué práctica entregó, por qué medio, cuándo (aproximado)
-- y desde qué cuenta, y adjunta UNA captura del envío (más hasta dos complementarias). El profesor usa esos datos
-- para localizar el mensaje original en su propio correo (sin conectarlo a la plataforma), verificarlo y convalidar.
--
-- · hist_settings      configuración por sección (apagada por defecto), cuotas y margen de búsqueda.
-- · hist_practices     catálogo histórico por sección: 10 posiciones PROVISIONALES al activarlo (una estimación);
--                      el profesor las renombra, añade, archiva o une sin perder declaraciones.
-- · hist_declarations  una declaración por práctica (tipo «evidencia» con captura, o «incidencia» si perdió la
--                      evidencia). Estados: borrador → registrada → localizada → verificada → convalidada, y
--                      no_localizada / aclaracion / observada. Encontrar, verificar y convalidar quedan con fecha
--                      y responsable por separado. NADA crea notas: convalidar no es calificar.
-- · hist_captures      solo METADATOS de la imagen (ruta privada, tamaño, dimensiones, SHA-256). Los bytes viven en
--                      el almacenamiento privado «regularizacion» (Edge Function «entregas»), nunca en PostgreSQL.
--                      Ruta = sección/estudiante/sha256.ext: la misma imagen del mismo estudiante se guarda una vez.
-- · hist_suggestions   «Profesor, recuerdo otra práctica»: sugerencias que el profesor confirma, relaciona o descarta.
-- · hist_events        historial (quién, cuándo, de qué estado a cuál, nota). Solo se añade.
--
-- Las posiciones provisionales sin declarar NO son incumplimientos: no hay ningún cálculo que las convierta en cero.
-- Tablas sin permisos directos (RLS sin políticas); todo pasa por funciones que comprueban el papel.
-- Aditiva: tablas y funciones nuevas; no toca prácticas, actividades ni calificaciones existentes.
-- =============================================================================

create table if not exists public.hist_settings (
  class_id uuid primary key references public.classes (id) on delete cascade,
  abierto boolean not null default false,
  mensaje text not null default '' check (char_length(mensaje) <= 1000),
  margen_dias integer not null default 7 check (margen_dias between 0 and 60),
  max_mb_captura numeric(4, 2) not null default 2 check (max_mb_captura between 0.5 and 5),
  cuota_mb integer not null default 300 check (cuota_mb between 10 and 2000),
  max_registros integer not null default 40 check (max_registros between 1 and 200),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.hist_practices (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  numero integer not null check (numero between 1 and 99),
  titulo text not null default '' check (char_length(titulo) <= 160),
  descripcion text not null default '' check (char_length(descripcion) <= 1000),
  provisional boolean not null default true,
  origen text not null default 'provisional' check (origen in ('provisional', 'docente', 'sugerencia')),
  archivada boolean not null default false,
  unida_a uuid references public.hist_practices (id) on delete set null,
  activity_id uuid references public.activities (id) on delete set null,   -- vínculo opcional con el libro de calificaciones
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hist_practices_numero on public.hist_practices (class_id, numero) where not archivada;
create unique index if not exists hist_practices_actividad on public.hist_practices (activity_id) where activity_id is not null;

create table if not exists public.hist_declarations (
  id uuid primary key,                                   -- lo genera el navegador: guardar dos veces no duplica
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  practice_id uuid not null references public.hist_practices (id) on delete restrict,
  tipo text not null default 'evidencia' check (tipo in ('evidencia', 'incidencia')),
  tema text not null default '' check (char_length(tema) <= 160),
  descripcion text not null default '' check (char_length(descripcion) <= 1000),
  fecha_declarada date,                                  -- DECLARADA por el estudiante, no verificada
  fecha_desconocida boolean not null default false,
  medio text check (medio in ('correo', 'otra')),
  correo_remitente text check (correo_remitente is null or char_length(correo_remitente) <= 200),
  otra_via text check (otra_via is null or char_length(otra_via) <= 120),
  contacto text check (contacto is null or char_length(contacto) <= 200),
  motivo_incidencia text check (motivo_incidencia is null or char_length(motivo_incidencia) <= 1000),
  estado text not null default 'borrador'
    check (estado in ('borrador', 'registrada', 'localizada', 'verificada', 'no_localizada', 'aclaracion', 'observada', 'convalidada')),
  declaracion_aceptada_at timestamptz,
  enviado_at timestamptz,
  revisada_at timestamptz,                               -- primera acción del profesor: desde entonces el estudiante ya no edita
  localizada_at timestamptz,
  localizada_por uuid references public.profiles (id) on delete set null,
  verificada_at timestamptz,
  verificada_por uuid references public.profiles (id) on delete set null,
  convalidada_at timestamptz,
  convalidada_por uuid references public.profiles (id) on delete set null,
  nota_docente text check (nota_docente is null or char_length(nota_docente) <= 1000),
  respuesta_estudiante text check (respuesta_estudiante is null or char_length(respuesta_estudiante) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (fecha_desconocida and fecha_declarada is not null))
);
create index if not exists hist_declarations_clase on public.hist_declarations (class_id, estado);
create index if not exists hist_declarations_usuario on public.hist_declarations (user_id, class_id);
create index if not exists hist_declarations_practica on public.hist_declarations (practice_id);

create table if not exists public.hist_captures (
  id uuid primary key,
  declaration_id uuid not null references public.hist_declarations (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  posicion smallint not null check (posicion between 1 and 3),        -- 1 = principal; 2 y 3 = complementarias
  storage_path text not null check (char_length(storage_path) <= 200),
  mime text not null check (mime in ('image/webp', 'image/jpeg', 'image/png')),
  bytes integer not null check (bytes > 0),
  ancho integer not null check (ancho > 0),
  alto integer not null check (alto > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),             -- de los bytes guardados (lo calcula el servidor)
  sha256_original text check (sha256_original is null or sha256_original ~ '^[0-9a-f]{64}$'),  -- del archivo elegido (declarado por el navegador)
  bytes_original integer check (bytes_original is null or bytes_original > 0),
  created_at timestamptz not null default now(),
  unique (declaration_id, posicion)
);
create index if not exists hist_captures_ruta on public.hist_captures (storage_path);
create index if not exists hist_captures_sha on public.hist_captures (sha256);
create index if not exists hist_captures_sha_original on public.hist_captures (sha256_original) where sha256_original is not null;
create index if not exists hist_captures_clase on public.hist_captures (class_id);

create table if not exists public.hist_suggestions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tema text check (tema is null or char_length(tema) between 1 and 160),
  descripcion text not null default '' check (char_length(descripcion) <= 1000),
  fecha_aprox date,
  comentarios text not null default '' check (char_length(comentarios) <= 1000),
  total_estimado integer check (total_estimado is null or total_estimado between 1 and 60),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'relacionada', 'descartada')),
  practice_id uuid references public.hist_practices (id) on delete set null,
  revisada_por uuid references public.profiles (id) on delete set null,
  revisada_at timestamptz,
  nota_revision text check (nota_revision is null or char_length(nota_revision) <= 500),
  created_at timestamptz not null default now(),
  check (tema is not null or total_estimado is not null)
);
create index if not exists hist_suggestions_clase on public.hist_suggestions (class_id, estado);

create table if not exists public.hist_events (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  declaration_id uuid references public.hist_declarations (id) on delete set null,
  practice_id uuid references public.hist_practices (id) on delete set null,
  suggestion_id uuid references public.hist_suggestions (id) on delete set null,
  actor uuid references public.profiles (id) on delete set null,
  papel text not null check (papel in ('estudiante', 'docente', 'sistema')),
  accion text not null check (char_length(accion) <= 40),
  estado_antes text,
  estado_despues text,
  nota text check (nota is null or char_length(nota) <= 1000),
  detalle jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists hist_events_declaracion on public.hist_events (declaration_id, at);
create index if not exists hist_events_clase on public.hist_events (class_id, at desc);

alter table public.hist_settings enable row level security;
alter table public.hist_practices enable row level security;
alter table public.hist_declarations enable row level security;
alter table public.hist_captures enable row level security;
alter table public.hist_suggestions enable row level security;
alter table public.hist_events enable row level security;
revoke all on public.hist_settings, public.hist_practices, public.hist_declarations, public.hist_captures,
  public.hist_suggestions, public.hist_events from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Auxiliares internas
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.hist_assert_teacher(p_class uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_class is null or not public.is_teacher() or not public.is_class_teacher(p_class) or not public.my_account_ok() then
    raise exception 'No tiene acceso a esta sección' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.hist_log(p_class uuid, p_decl uuid, p_practice uuid, p_sug uuid, p_papel text, p_accion text,
  p_antes text, p_despues text, p_nota text, p_detalle jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.hist_events (class_id, declaration_id, practice_id, suggestion_id, actor, papel, accion, estado_antes, estado_despues, nota, detalle)
  values (p_class, p_decl, p_practice, p_sug, auth.uid(), p_papel, p_accion, p_antes, p_despues, nullif(btrim(coalesce(p_nota, '')), ''), coalesce(p_detalle, '{}'::jsonb))
$$;

-- ¿Puede el estudiante modificar esta declaración? (antes de la revisión, o cuando el profesor pidió una aclaración)
create or replace function public.hist_editable(d public.hist_declarations)
returns boolean
language sql immutable set search_path = ''
as $$ select d.estado in ('borrador', 'aclaracion') or (d.estado = 'registrada' and d.revisada_at is null) $$;

-- Lo que falta para poder registrar (vacío = completo). La misma regla se muestra en el navegador.
create or replace function public.hist_faltantes(d public.hist_declarations)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select array_remove(array[
    case when d.medio is null then 'el medio de envío' end,
    case when d.medio = 'otra' and coalesce(btrim(d.otra_via), '') = '' then 'especificar por cuál medio la enviaste' end,
    case when d.tipo = 'evidencia' and not exists (select 1 from public.hist_captures c where c.declaration_id = d.id and c.posicion = 1)
      then 'la captura principal del envío' end,
    case when d.tipo = 'incidencia' and coalesce(btrim(d.motivo_incidencia), '') = '' then 'explicar qué pasó con la evidencia' end
  ], null)
$$;

-- Bytes ocupados (cada archivo una vez, aunque lo usen varias declaraciones del mismo estudiante)
create or replace function public.hist_bytes_seccion(p_class uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$ select coalesce(sum(b), 0)::bigint from (select max(bytes) as b from public.hist_captures where class_id = p_class group by storage_path) x $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Profesorado: configuración y catálogo
-- ---------------------------------------------------------------------------------------------------------------
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
      'archivos_seccion', (select count(distinct storage_path) from public.hist_captures where class_id = p_class),
      'bytes_modulo', (select coalesce(sum(b), 0)::bigint from (select max(bytes) as b from public.hist_captures group by storage_path) x),
      'archivos_modulo', (select count(distinct storage_path) from public.hist_captures))
  );
end;
$$;

-- Guarda la configuración y ajusta la CANTIDAD de posiciones activas del catálogo.
--  · Si hay menos, crea posiciones provisionales nuevas al final.
--  · Si hay más, archiva solo las últimas que sean provisionales, sin título y sin declaraciones; las demás se
--    conservan (devuelve cuántas). Nunca se borra nada.
create or replace function public.hist_configurar(p_class uuid, p_abierto boolean, p_mensaje text, p_margen integer,
  p_max_mb numeric, p_cuota_mb integer, p_max_registros integer, p_espacios integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_activas integer; v_max integer; v_creadas integer := 0; v_archivadas integer := 0; v_conservadas integer := 0; r record;
begin
  perform public.hist_assert_teacher(p_class);
  if p_espacios is not null and (p_espacios < 0 or p_espacios > 99) then raise exception 'La cantidad de prácticas debe estar entre 0 y 99' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hist:' || p_class::text, 0));
  insert into public.hist_settings (class_id, abierto, mensaje, margen_dias, max_mb_captura, cuota_mb, max_registros, updated_by)
    values (p_class, coalesce(p_abierto, false), coalesce(p_mensaje, ''), coalesce(p_margen, 7), coalesce(p_max_mb, 2), coalesce(p_cuota_mb, 300),
            coalesce(p_max_registros, 40), auth.uid())
  on conflict (class_id) do update set abierto = coalesce(p_abierto, hist_settings.abierto), mensaje = coalesce(p_mensaje, hist_settings.mensaje),
    margen_dias = coalesce(p_margen, hist_settings.margen_dias), max_mb_captura = coalesce(p_max_mb, hist_settings.max_mb_captura),
    cuota_mb = coalesce(p_cuota_mb, hist_settings.cuota_mb), max_registros = coalesce(p_max_registros, hist_settings.max_registros),
    updated_by = auth.uid(), updated_at = now();

  if p_espacios is not null then
    select count(*), coalesce(max(numero), 0) into v_activas, v_max from public.hist_practices where class_id = p_class and not archivada;
    while v_activas < p_espacios loop
      v_max := v_max + 1;
      if v_max > 99 then raise exception 'No se pueden numerar más de 99 prácticas' using errcode = '22023'; end if;
      insert into public.hist_practices (class_id, numero, created_by) values (p_class, v_max, auth.uid());
      v_activas := v_activas + 1; v_creadas := v_creadas + 1;
    end loop;
    if v_activas > p_espacios then
      for r in select p.id, p.provisional, p.titulo,
                 exists (select 1 from public.hist_declarations d where d.practice_id = p.id) as usada,
                 exists (select 1 from public.hist_suggestions s where s.practice_id = p.id) as sugerida
               from public.hist_practices p where p.class_id = p_class and not p.archivada order by p.numero desc loop
        exit when v_activas <= p_espacios;
        if r.provisional and r.titulo = '' and not r.usada and not r.sugerida then
          update public.hist_practices set archivada = true, updated_at = now() where id = r.id;
          v_activas := v_activas - 1; v_archivadas := v_archivadas + 1;
        else
          v_conservadas := v_conservadas + 1;
        end if;
      end loop;
    end if;
    if v_creadas + v_archivadas > 0 then
      perform public.hist_log(p_class, null, null, null, 'docente', 'cantidad', null, null, null,
        jsonb_build_object('espacios', p_espacios, 'creadas', v_creadas, 'archivadas', v_archivadas));
    end if;
  end if;
  return jsonb_build_object('creadas', v_creadas, 'archivadas', v_archivadas, 'conservadas', v_conservadas,
    'activas', (select count(*) from public.hist_practices where class_id = p_class and not archivada));
end;
$$;

-- Crear (p_id null) o editar una práctica del catálogo. Con título deja de ser provisional.
create or replace function public.hist_practica_guardar(p_id uuid, p_class uuid, p_numero integer, p_titulo text, p_descripcion text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_class uuid := p_class;
begin
  if p_id is not null then select class_id into v_class from public.hist_practices where id = p_id; end if;
  perform public.hist_assert_teacher(v_class);
  if p_numero is null or p_numero not between 1 and 99 then raise exception 'El número debe estar entre 1 y 99' using errcode = '22023'; end if;
  if exists (select 1 from public.hist_practices where class_id = v_class and numero = p_numero and not archivada and id is distinct from p_id) then
    raise exception 'Ya existe una práctica activa con el número %', p_numero using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into public.hist_practices (class_id, numero, titulo, descripcion, provisional, origen, created_by)
      values (v_class, p_numero, left(btrim(coalesce(p_titulo, '')), 160), left(btrim(coalesce(p_descripcion, '')), 1000),
              btrim(coalesce(p_titulo, '')) = '', 'docente', auth.uid())
      returning id into v_id;
    perform public.hist_log(v_class, null, v_id, null, 'docente', 'practica_creada', null, null, null, jsonb_build_object('numero', p_numero));
  else
    update public.hist_practices set numero = p_numero, titulo = left(btrim(coalesce(p_titulo, '')), 160),
      descripcion = left(btrim(coalesce(p_descripcion, '')), 1000),
      provisional = provisional and btrim(coalesce(p_titulo, '')) = '', updated_at = now()
    where id = p_id returning id into v_id;
    perform public.hist_log(v_class, null, v_id, null, 'docente', 'practica_editada', null, null, null, jsonb_build_object('numero', p_numero));
  end if;
  return v_id;
end;
$$;

create or replace function public.hist_practica_archivar(p_id uuid, p_archivar boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare p public.hist_practices;
begin
  select * into p from public.hist_practices where id = p_id;
  perform public.hist_assert_teacher(p.class_id);
  if not coalesce(p_archivar, true) and exists (select 1 from public.hist_practices x where x.class_id = p.class_id and x.numero = p.numero and not x.archivada and x.id <> p.id) then
    raise exception 'Ya hay otra práctica activa con el número %; cambie uno de los dos números', p.numero using errcode = 'P0001';
  end if;
  update public.hist_practices set archivada = coalesce(p_archivar, true), updated_at = now() where id = p_id;
  perform public.hist_log(p.class_id, null, p_id, null, 'docente', case when coalesce(p_archivar, true) then 'practica_archivada' else 'practica_restaurada' end, null, null, null, '{}');
end;
$$;

-- Une la práctica p_origen con p_destino: sus declaraciones pasan al destino (con historial) y el origen se archiva.
create or replace function public.hist_practica_unir(p_origen uuid, p_destino uuid, p_nota text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare o public.hist_practices; d public.hist_practices; n integer;
begin
  select * into o from public.hist_practices where id = p_origen;
  select * into d from public.hist_practices where id = p_destino;
  perform public.hist_assert_teacher(o.class_id);
  if d.id is null or d.class_id <> o.class_id or o.id = d.id then raise exception 'Las dos prácticas deben ser distintas y de la misma sección' using errcode = '22023'; end if;
  if d.archivada then raise exception 'La práctica de destino está archivada' using errcode = 'P0001'; end if;
  insert into public.hist_events (class_id, declaration_id, practice_id, actor, papel, accion, estado_antes, estado_despues, nota, detalle)
    select o.class_id, x.id, d.id, auth.uid(), 'docente', 'practica_cambiada', x.estado, x.estado, nullif(btrim(coalesce(p_nota, '')), ''),
      jsonb_build_object('desde', o.id, 'desde_numero', o.numero, 'hacia', d.id, 'hacia_numero', d.numero)
    from public.hist_declarations x where x.practice_id = o.id;
  update public.hist_declarations set practice_id = d.id, updated_at = now() where practice_id = o.id;
  get diagnostics n = row_count;
  update public.hist_suggestions set practice_id = d.id where practice_id = o.id;
  update public.hist_practices set archivada = true, unida_a = d.id, updated_at = now() where id = o.id;
  perform public.hist_log(o.class_id, null, o.id, null, 'docente', 'practica_unida', null, null, p_nota, jsonb_build_object('hacia', d.id, 'declaraciones', n));
  return n;
end;
$$;

-- Vincula una práctica con una actividad de la sección (libro de calificaciones). NO crea ni cambia notas.
create or replace function public.hist_practica_vincular(p_id uuid, p_activity uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare p public.hist_practices;
begin
  select * into p from public.hist_practices where id = p_id;
  perform public.hist_assert_teacher(p.class_id);
  if p_activity is not null and not exists (select 1 from public.activities a where a.id = p_activity and a.class_id = p.class_id) then
    raise exception 'La actividad no pertenece a esta sección' using errcode = '22023';
  end if;
  begin
    update public.hist_practices set activity_id = p_activity, updated_at = now() where id = p_id;
  exception when unique_violation then
    raise exception 'Esa actividad ya está asociada a otra práctica histórica' using errcode = 'P0001';
  end;
  perform public.hist_log(p.class_id, null, p_id, null, 'docente', 'practica_vinculada', null, null, null, jsonb_build_object('activity_id', p_activity));
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Profesorado: localizador
-- ---------------------------------------------------------------------------------------------------------------
-- Declaraciones REGISTRADAS (no los borradores) de una sección, o de todas las del profesor si p_class es null.
create or replace function public.hist_registros(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_class is not null then perform public.hist_assert_teacher(p_class);
  elsif not public.is_teacher() or not public.my_account_ok() then raise exception 'No tiene acceso' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'class_id', d.class_id, 'class_name', c.name, 'course_id', c.course_id, 'course_title', co.title,
      'group_id', e.group_id, 'group_name', g.name,
      'user_id', d.user_id, 'full_name', pr.full_name, 'student_code', pr.student_code,
      'practice_id', d.practice_id, 'numero', p.numero, 'practica_titulo', p.titulo, 'practica_archivada', p.archivada,
      'tipo', d.tipo, 'tema', d.tema, 'descripcion', d.descripcion, 'fecha_declarada', d.fecha_declarada, 'fecha_desconocida', d.fecha_desconocida,
      'medio', d.medio, 'correo_remitente', d.correo_remitente, 'otra_via', d.otra_via, 'contacto', d.contacto, 'motivo_incidencia', d.motivo_incidencia,
      'estado', d.estado, 'enviado_at', d.enviado_at, 'revisada_at', d.revisada_at, 'localizada_at', d.localizada_at, 'verificada_at', d.verificada_at,
      'convalidada_at', d.convalidada_at, 'nota_docente', d.nota_docente, 'respuesta_estudiante', d.respuesta_estudiante,
      'actividad', (select a.title from public.activities a where a.id = p.activity_id),
      'calificacion', (select jsonb_build_object('score', t.score, 'max', t.max_score) from public.attempts t
         where p.activity_id is not null and t.activity_id = p.activity_id and t.user_id = d.user_id and t.status <> 'in_progress' and t.score is not null
         order by t.score desc nulls last limit 1),
      'capturas', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'posicion', k.posicion, 'bytes', k.bytes, 'ancho', k.ancho, 'alto', k.alto,
          'mime', k.mime, 'sha256', k.sha256,
          'igual_a_otros', (select count(distinct k2.user_id) from public.hist_captures k2 where k2.user_id <> k.user_id
             and (k2.sha256 = k.sha256 or (k.sha256_original is not null and k2.sha256_original = k.sha256_original))))
          order by k.posicion), '[]'::jsonb) from public.hist_captures k where k.declaration_id = d.id)
    ) order by c.name, pr.full_name, p.numero), '[]'::jsonb)
    from public.hist_declarations d
    join public.classes c on c.id = d.class_id join public.courses co on co.id = c.course_id
    join public.profiles pr on pr.id = d.user_id
    join public.hist_practices p on p.id = d.practice_id
    left join public.enrollments e on e.class_id = d.class_id and e.user_id = d.user_id
    left join public.class_groups g on g.id = e.group_id
    where d.estado <> 'borrador'
      and (case when p_class is null then public.is_class_teacher(d.class_id) else d.class_id = p_class end)
  );
end;
$$;

-- Estudiantes de la sección con sus cuentas (incluye a quienes no han declarado nada: eso NO es un incumplimiento).
create or replace function public.hist_resumen(p_class uuid)
returns table (user_id uuid, full_name text, student_code text, group_name text, borradores bigint, registradas bigint, incidencias bigint,
  pendientes bigint, localizadas bigint, verificadas bigint, convalidadas bigint, no_localizadas bigint, observadas bigint, aclaraciones bigint, sugerencias bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.hist_assert_teacher(p_class);
  return query
  select p.id, p.full_name, p.student_code, g.name,
    count(d.id) filter (where d.estado = 'borrador'),
    count(d.id) filter (where d.estado <> 'borrador' and d.tipo = 'evidencia'),
    count(d.id) filter (where d.estado <> 'borrador' and d.tipo = 'incidencia'),
    count(d.id) filter (where d.estado = 'registrada'),
    count(d.id) filter (where d.estado = 'localizada'),
    count(d.id) filter (where d.estado = 'verificada'),
    count(d.id) filter (where d.estado = 'convalidada'),
    count(d.id) filter (where d.estado = 'no_localizada'),
    count(d.id) filter (where d.estado = 'observada'),
    count(d.id) filter (where d.estado = 'aclaracion'),
    (select count(*) from public.hist_suggestions s where s.class_id = p_class and s.user_id = p.id)
  from public.enrollments e
  join public.profiles p on p.id = e.user_id and p.role = 'student'
  left join public.class_groups g on g.id = e.group_id
  left join public.hist_declarations d on d.class_id = p_class and d.user_id = p.id
  where e.class_id = p_class
  group by p.id, p.full_name, p.student_code, g.name
  order by p.full_name;
end;
$$;

create or replace function public.hist_historial(p_decl uuid)
returns table (at timestamptz, papel text, actor_name text, accion text, estado_antes text, estado_despues text, nota text, detalle jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.hist_declarations where id = p_decl;
  perform public.hist_assert_teacher(v_class);
  return query select ev.at, ev.papel, pr.full_name, ev.accion, ev.estado_antes, ev.estado_despues, ev.nota, ev.detalle
    from public.hist_events ev left join public.profiles pr on pr.id = ev.actor
    where ev.declaration_id = p_decl order by ev.at, ev.id;
end;
$$;

-- Acciones del profesor sobre una o varias declaraciones. Encontrar (localizada), comprobar el contenido (verificada)
-- y reconocer oficialmente (convalidada) son pasos distintos, cada uno con fecha y responsable. Ninguno crea notas.
create or replace function public.hist_revisar(p_ids uuid[], p_accion text, p_nota text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  d public.hist_declarations; v_ok integer := 0; v_errores jsonb := '[]'::jsonb; v_nuevo text; v_motivo text; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_msg uuid; v_num integer; v_id uuid;
begin
  if p_accion not in ('localizada', 'verificada', 'no_localizada', 'aclaracion', 'observada', 'convalidada', 'revertir_convalidacion', 'pendiente') then
    raise exception 'Acción no válida' using errcode = '22023';
  end if;
  if p_accion in ('aclaracion', 'observada', 'revertir_convalidacion') and v_nota is null then
    raise exception 'Escriba una nota que explique la acción' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_ids), 0) = 0 or cardinality(p_ids) > 500 then raise exception 'Seleccione entre 1 y 500 registros' using errcode = '22023'; end if;
  foreach v_id in array p_ids loop
    select * into d from public.hist_declarations where id = v_id for update;
    if d.class_id is null then v_errores := v_errores || jsonb_build_object('id', v_id, 'motivo', 'No existe'); continue; end if;
    perform public.hist_assert_teacher(d.class_id);
    v_motivo := case
      when d.estado = 'borrador' then 'El estudiante aún no lo ha registrado'
      when p_accion = 'verificada' and d.localizada_at is null then 'Primero márquelo como localizado (encontró el mensaje original)'
      when p_accion = 'verificada' and d.estado not in ('localizada', 'observada', 'verificada') then 'Solo se verifica un envío localizado'
      when p_accion = 'convalidada' and d.estado <> 'verificada' then 'Solo se convalida una entrega verificada'
      when p_accion = 'revertir_convalidacion' and d.estado <> 'convalidada' then 'No está convalidada'
      when p_accion not in ('revertir_convalidacion') and d.estado = 'convalidada' then 'Está convalidada: primero revierta la convalidación'
    end;
    if v_motivo is not null then v_errores := v_errores || jsonb_build_object('id', d.id, 'motivo', v_motivo); continue; end if;
    v_nuevo := case p_accion when 'revertir_convalidacion' then 'verificada' when 'pendiente' then 'registrada' else p_accion end;
    update public.hist_declarations set
      estado = v_nuevo,
      revisada_at = coalesce(revisada_at, now()),
      localizada_at = case when p_accion = 'localizada' then now() else localizada_at end,
      localizada_por = case when p_accion = 'localizada' then auth.uid() else localizada_por end,
      verificada_at = case when p_accion = 'verificada' then now() else verificada_at end,
      verificada_por = case when p_accion = 'verificada' then auth.uid() else verificada_por end,
      convalidada_at = case when p_accion = 'convalidada' then now() when p_accion = 'revertir_convalidacion' then null else convalidada_at end,
      convalidada_por = case when p_accion = 'convalidada' then auth.uid() when p_accion = 'revertir_convalidacion' then null else convalidada_por end,
      nota_docente = coalesce(v_nota, nota_docente),
      updated_at = now()
    where id = d.id;
    perform public.hist_log(d.class_id, d.id, d.practice_id, null, 'docente', p_accion, d.estado, v_nuevo, v_nota, '{}');
    if p_accion = 'aclaracion' then
      -- aviso al estudiante por el Centro de Comunicación existente (nunca bloquea la acción)
      begin
        select numero into v_num from public.hist_practices where id = d.practice_id;
        insert into public.live_messages (sender_id, kind, body, audience)
          values (auth.uid(), 'importante',
                  left('Regularización de prácticas anteriores — práctica ' || v_num || ': el profesor pide una aclaración. «' || v_nota
                       || '» Responde en Mi cuenta → Prácticas anteriores.', 2000),
                  jsonb_build_object('modo', 'regularizacion', 'seccion', d.class_id, 'seleccionados', 1))
          returning id into v_msg;
        insert into public.live_message_recipients (message_id, user_id) values (v_msg, d.user_id);
      exception when others then null;
      end;
    end if;
    v_ok := v_ok + 1;
  end loop;
  return jsonb_build_object('aplicadas', v_ok, 'errores', v_errores);
end;
$$;

create or replace function public.hist_sugerencias(p_class uuid)
returns table (id uuid, user_id uuid, full_name text, tema text, descripcion text, fecha_aprox date, comentarios text, total_estimado integer,
  estado text, practice_id uuid, numero integer, nota_revision text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.hist_assert_teacher(p_class);
  return query select s.id, s.user_id, pr.full_name, s.tema, s.descripcion, s.fecha_aprox, s.comentarios, s.total_estimado, s.estado,
    s.practice_id, p.numero, s.nota_revision, s.created_at
  from public.hist_suggestions s join public.profiles pr on pr.id = s.user_id
  left join public.hist_practices p on p.id = s.practice_id
  where s.class_id = p_class order by s.created_at;
end;
$$;

-- Decide sobre un GRUPO de sugerencias. «confirmada» sin p_practice crea una práctica nueva en el catálogo
-- (origen «sugerencia», número siguiente); «relacionada» exige la práctica existente. Nunca crea actividades oficiales.
create or replace function public.hist_sugerencias_decidir(p_ids uuid[], p_decision text, p_practice uuid, p_titulo text, p_nota text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid; v_practice uuid := p_practice; v_titulo text; v_num integer;
begin
  if p_decision not in ('confirmada', 'relacionada', 'descartada', 'pendiente') then raise exception 'Decisión no válida' using errcode = '22023'; end if;
  if coalesce(cardinality(p_ids), 0) = 0 then raise exception 'Seleccione al menos una sugerencia' using errcode = '22023'; end if;
  select min(class_id::text)::uuid into v_class from public.hist_suggestions where id = any (p_ids);
  if (select count(distinct class_id) from public.hist_suggestions where id = any (p_ids)) <> 1 then
    raise exception 'Las sugerencias deben ser de una misma sección' using errcode = '22023';
  end if;
  perform public.hist_assert_teacher(v_class);
  perform pg_advisory_xact_lock(hashtextextended('hist:' || v_class::text, 0));
  if p_decision = 'relacionada' and (v_practice is null or not exists (select 1 from public.hist_practices where id = v_practice and class_id = v_class)) then
    raise exception 'Elija la práctica del catálogo con la que se relaciona' using errcode = '22023';
  end if;
  if p_decision = 'confirmada' and v_practice is null then
    v_titulo := coalesce(nullif(btrim(coalesce(p_titulo, '')), ''), (select s.tema from public.hist_suggestions s where s.id = any (p_ids) and s.tema is not null order by s.created_at limit 1), '');
    select coalesce(max(numero), 0) + 1 into v_num from public.hist_practices where class_id = v_class and not archivada;
    if v_num > 99 then raise exception 'No se pueden numerar más de 99 prácticas' using errcode = '22023'; end if;
    insert into public.hist_practices (class_id, numero, titulo, provisional, origen, created_by)
      values (v_class, v_num, left(v_titulo, 160), false, 'sugerencia', auth.uid()) returning id into v_practice;
    perform public.hist_log(v_class, null, v_practice, null, 'docente', 'practica_creada', null, null, p_nota, jsonb_build_object('numero', v_num, 'desde_sugerencias', to_jsonb(p_ids)));
  elsif p_decision = 'confirmada' and not exists (select 1 from public.hist_practices where id = v_practice and class_id = v_class) then
    raise exception 'La práctica no pertenece a esta sección' using errcode = '22023';
  end if;
  update public.hist_suggestions set estado = p_decision,
    practice_id = case when p_decision in ('confirmada', 'relacionada') then v_practice else null end,
    revisada_por = auth.uid(), revisada_at = now(), nota_revision = nullif(btrim(coalesce(p_nota, '')), '')
  where id = any (p_ids);
  insert into public.hist_events (class_id, suggestion_id, practice_id, actor, papel, accion, estado_despues, nota)
    select v_class, u.sid, v_practice, auth.uid(), 'docente', 'sugerencia_' || p_decision, p_decision, nullif(btrim(coalesce(p_nota, '')), '') from unnest(p_ids) as u(sid);
  return v_practice;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Estudiantes
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.hist_mis_secciones()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', c.id, 'class_name', c.name, 'course_title', co.title,
    'abierto', coalesce(s.abierto, false), 'mensaje', coalesce(s.mensaje, ''), 'max_mb_captura', coalesce(s.max_mb_captura, 2),
    'max_registros', coalesce(s.max_registros, 40),
    'practicas', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'numero', p.numero, 'titulo', p.titulo, 'descripcion', p.descripcion,
        'provisional', p.provisional) order by p.numero), '[]'::jsonb)
        from public.hist_practices p where p.class_id = c.id and (not p.archivada or exists (select 1 from public.hist_declarations d where d.practice_id = p.id and d.user_id = auth.uid()))),
    'registros', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'practice_id', d.practice_id, 'tipo', d.tipo, 'tema', d.tema, 'descripcion', d.descripcion, 'fecha_declarada', d.fecha_declarada,
        'fecha_desconocida', d.fecha_desconocida, 'medio', d.medio, 'correo_remitente', d.correo_remitente, 'otra_via', d.otra_via, 'contacto', d.contacto,
        'motivo_incidencia', d.motivo_incidencia, 'estado', d.estado, 'editable', public.hist_editable(d), 'faltantes', to_jsonb(public.hist_faltantes(d)),
        'enviado_at', d.enviado_at, 'nota_docente', d.nota_docente, 'respuesta_estudiante', d.respuesta_estudiante, 'updated_at', d.updated_at,
        'capturas', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'posicion', k.posicion, 'bytes', k.bytes, 'ancho', k.ancho, 'alto', k.alto)
            order by k.posicion), '[]'::jsonb) from public.hist_captures k where k.declaration_id = d.id)
        ) order by d.created_at), '[]'::jsonb)
        from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid()),
    'sugerencias', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'tema', g.tema, 'descripcion', g.descripcion, 'fecha_aprox', g.fecha_aprox,
        'comentarios', g.comentarios, 'total_estimado', g.total_estimado, 'estado', g.estado, 'created_at', g.created_at) order by g.created_at), '[]'::jsonb)
        from public.hist_suggestions g where g.class_id = c.id and g.user_id = auth.uid())
  ) order by co.title, c.name), '[]'::jsonb)
  from public.enrollments e
  join public.classes c on c.id = e.class_id join public.courses co on co.id = c.course_id
  left join public.hist_settings s on s.class_id = c.id
  where e.user_id = auth.uid() and public.my_account_ok() and not c.archived
    and (s.abierto or exists (select 1 from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid()))
$$;

-- Crea o corrige una declaración (borrador o, si ya se registró y aún no se revisa, la corrige manteniéndola completa).
create or replace function public.hist_guardar(p_id uuid, p_class uuid, p_practice uuid, p_tipo text, p_tema text, p_descripcion text,
  p_fecha date, p_fecha_desconocida boolean, p_medio text, p_correo text, p_otra_via text, p_contacto text, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); s public.hist_settings; d public.hist_declarations; v_nuevo boolean; v_correo text := nullif(lower(btrim(coalesce(p_correo, ''))), '');
begin
  if p_id is null then raise exception 'Falta el identificador del registro' using errcode = '22023'; end if;
  select * into d from public.hist_declarations where id = p_id for update;
  v_nuevo := d.id is null;
  if not v_nuevo and (d.user_id <> v_uid or d.class_id <> p_class) then raise exception 'No tiene acceso a este registro' using errcode = '42501'; end if;
  if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = v_uid) or not public.my_account_ok() then
    raise exception 'No está inscrito en esta sección' using errcode = '42501';
  end if;
  select * into s from public.hist_settings where class_id = p_class;
  if not coalesce(s.abierto, false) then raise exception 'La regularización de prácticas no está abierta en esta sección' using errcode = 'P0001'; end if;
  if not v_nuevo and not public.hist_editable(d) then raise exception 'El profesor ya revisó este registro; no se puede modificar' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.hist_practices p where p.id = p_practice and p.class_id = p_class and (not p.archivada or p.id = d.practice_id)) then
    raise exception 'Elija una práctica del catálogo de la sección' using errcode = '22023';
  end if;
  if coalesce(p_tipo, 'evidencia') not in ('evidencia', 'incidencia') then raise exception 'Tipo no válido' using errcode = '22023'; end if;
  if not v_nuevo and d.tipo <> coalesce(p_tipo, 'evidencia') then raise exception 'No se puede cambiar el tipo de un registro existente' using errcode = '22023'; end if;
  if p_medio is not null and p_medio not in ('correo', 'otra') then raise exception 'Medio no válido' using errcode = '22023'; end if;
  if p_medio = 'correo' and v_correo is not null and v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'La dirección de correo no parece válida' using errcode = '22023'; end if;
  if p_fecha is not null and (p_fecha > current_date + 1 or p_fecha < date '2000-01-01') then raise exception 'La fecha declarada no es válida' using errcode = '22023'; end if;
  if exists (select 1 from public.hist_declarations x where x.user_id = v_uid and x.practice_id = p_practice and x.id <> p_id and x.tipo = coalesce(p_tipo, 'evidencia')) then
    raise exception 'Ya tiene un registro de esa práctica; corrija el existente' using errcode = 'P0001';
  end if;
  if v_nuevo and (select count(*) from public.hist_declarations x where x.user_id = v_uid and x.class_id = p_class) >= s.max_registros then
    raise exception 'Alcanzó el máximo de % registros en esta sección', s.max_registros using errcode = 'P0001';
  end if;

  if v_nuevo then
    insert into public.hist_declarations (id, class_id, user_id, practice_id, tipo) values (p_id, p_class, v_uid, p_practice, coalesce(p_tipo, 'evidencia'));
  end if;
  update public.hist_declarations set
    practice_id = p_practice,
    tema = left(btrim(coalesce(p_tema, '')), 160),
    descripcion = left(btrim(coalesce(p_descripcion, '')), 1000),
    fecha_declarada = case when coalesce(p_fecha_desconocida, false) then null else p_fecha end,
    fecha_desconocida = coalesce(p_fecha_desconocida, false),
    medio = p_medio,
    correo_remitente = case when p_medio = 'correo' then left(v_correo, 200) end,
    otra_via = case when p_medio = 'otra' then nullif(left(btrim(coalesce(p_otra_via, '')), 120), '') end,
    contacto = nullif(left(btrim(coalesce(p_contacto, '')), 200), ''),
    motivo_incidencia = case when coalesce(p_tipo, 'evidencia') = 'incidencia' then nullif(left(btrim(coalesce(p_motivo, '')), 1000), '') end,
    updated_at = now()
  where id = p_id returning * into d;
  -- un registro ya enviado sigue completo después de corregirlo
  if d.estado = 'registrada' and cardinality(public.hist_faltantes(d)) > 0 then
    raise exception 'Falta: %', array_to_string(public.hist_faltantes(d), ', ') using errcode = '22023';
  end if;
  perform public.hist_log(p_class, d.id, d.practice_id, null, 'estudiante', case when v_nuevo then 'creada' else 'corregida' end, d.estado, d.estado, null, '{}');
  return jsonb_build_object('id', d.id, 'estado', d.estado, 'faltantes', to_jsonb(public.hist_faltantes(d)));
end;
$$;

-- Registra (envía al profesor) uno o varios borradores completos, o responde a una aclaración.
create or replace function public.hist_enviar(p_ids uuid[], p_acepto boolean, p_respuesta text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare d public.hist_declarations; v_ok integer := 0; v_errores jsonb := '[]'::jsonb; v_falta text[]; v_antes text; v_id uuid;
begin
  if not coalesce(p_acepto, false) then raise exception 'Debe aceptar la declaración antes de registrar' using errcode = '22023'; end if;
  if coalesce(cardinality(p_ids), 0) = 0 or cardinality(p_ids) > 100 then raise exception 'Seleccione entre 1 y 100 registros' using errcode = '22023'; end if;
  foreach v_id in array p_ids loop
    select * into d from public.hist_declarations where id = v_id for update;
    if d.user_id is distinct from auth.uid() then v_errores := v_errores || jsonb_build_object('id', v_id, 'motivo', 'No es suyo'); continue; end if;
    if not coalesce((select abierto from public.hist_settings where class_id = d.class_id), false) or not public.my_account_ok() then
      v_errores := v_errores || jsonb_build_object('id', d.id, 'motivo', 'La regularización no está abierta'); continue;
    end if;
    if d.estado = 'registrada' then v_ok := v_ok + 1; continue; end if;              -- ya estaba: idempotente
    if d.estado not in ('borrador', 'aclaracion') then v_errores := v_errores || jsonb_build_object('id', d.id, 'motivo', 'Ya fue revisado'); continue; end if;
    v_falta := public.hist_faltantes(d);
    if cardinality(v_falta) > 0 then v_errores := v_errores || jsonb_build_object('id', d.id, 'motivo', 'Falta: ' || array_to_string(v_falta, ', ')); continue; end if;
    v_antes := d.estado;
    update public.hist_declarations set estado = 'registrada', enviado_at = coalesce(enviado_at, now()), declaracion_aceptada_at = now(),
      respuesta_estudiante = case when v_antes = 'aclaracion' then coalesce(nullif(left(btrim(coalesce(p_respuesta, '')), 1000), ''), respuesta_estudiante) else respuesta_estudiante end,
      updated_at = now()
    where id = d.id;
    perform public.hist_log(d.class_id, d.id, d.practice_id, null, 'estudiante', case when v_antes = 'aclaracion' then 'aclaracion_respondida' else 'registrada' end,
      v_antes, 'registrada', case when v_antes = 'aclaracion' then p_respuesta end, '{}');
    v_ok := v_ok + 1;
  end loop;
  return jsonb_build_object('registradas', v_ok, 'errores', v_errores);
end;
$$;

-- «Profesor, recuerdo otra práctica» (o «creo que fueron N prácticas»)
create or replace function public.hist_sugerir(p_class uuid, p_tema text, p_descripcion text, p_fecha date, p_comentarios text, p_total integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_tema text := nullif(left(btrim(coalesce(p_tema, '')), 160), '');
begin
  if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = auth.uid()) or not public.my_account_ok() then
    raise exception 'No está inscrito en esta sección' using errcode = '42501';
  end if;
  if not coalesce((select abierto from public.hist_settings where class_id = p_class), false) then
    raise exception 'La regularización de prácticas no está abierta en esta sección' using errcode = 'P0001';
  end if;
  if v_tema is null and p_total is null then raise exception 'Escriba el tema de la práctica o cuántas prácticas cree que hubo' using errcode = '22023'; end if;
  if p_total is not null and p_total not between 1 and 60 then raise exception 'El total debe estar entre 1 y 60' using errcode = '22023'; end if;
  if p_fecha is not null and (p_fecha > current_date + 1 or p_fecha < date '2000-01-01') then raise exception 'La fecha no es válida' using errcode = '22023'; end if;
  if (select count(*) from public.hist_suggestions where class_id = p_class and user_id = auth.uid()) >= 15 then
    raise exception 'Alcanzó el máximo de 15 sugerencias en esta sección' using errcode = 'P0001';
  end if;
  insert into public.hist_suggestions (class_id, user_id, tema, descripcion, fecha_aprox, comentarios, total_estimado)
    values (p_class, auth.uid(), v_tema, left(btrim(coalesce(p_descripcion, '')), 1000), p_fecha, left(btrim(coalesce(p_comentarios, '')), 1000), p_total)
    returning id into v_id;
  perform public.hist_log(p_class, null, null, v_id, 'estudiante', 'sugerencia', null, 'pendiente', null, '{}');
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Servidor (Edge Function «entregas» con service_role): capturas en el almacenamiento privado «regularizacion»
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.svc_hist_captura_check(p_user uuid, p_decl uuid, p_posicion integer, p_bytes integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare d public.hist_declarations; s public.hist_settings;
begin
  select * into d from public.hist_declarations where id = p_decl;
  if d.id is null or d.user_id <> p_user or not public.account_ok(p_user)
     or not exists (select 1 from public.enrollments e where e.class_id = d.class_id and e.user_id = p_user) then
    raise exception 'No tiene acceso a este registro' using errcode = '42501';
  end if;
  select * into s from public.hist_settings where class_id = d.class_id;
  if not coalesce(s.abierto, false) then raise exception 'La regularización de prácticas no está abierta' using errcode = '42501'; end if;
  if not public.hist_editable(d) then raise exception 'El profesor ya revisó este registro; no se puede modificar' using errcode = '42501'; end if;
  if d.tipo <> 'evidencia' then raise exception 'Una incidencia no lleva capturas' using errcode = '22023'; end if;
  if p_posicion is null or p_posicion not between 1 and 3 then raise exception 'Posición de captura no válida' using errcode = '22023'; end if;
  if p_bytes is null or p_bytes <= 0 or p_bytes > s.max_mb_captura * 1048576 then
    raise exception 'La captura supera el máximo de % MB después de optimizarla', s.max_mb_captura using errcode = '22023';
  end if;
  if public.hist_bytes_seccion(d.class_id) + p_bytes > s.cuota_mb::bigint * 1048576 then
    raise exception 'Se alcanzó el espacio reservado para las capturas de esta sección; avise al profesor' using errcode = 'P0001';
  end if;
  return jsonb_build_object('class_id', d.class_id, 'max_bytes', (s.max_mb_captura * 1048576)::bigint);
end;
$$;

create or replace function public.svc_hist_captura_registrar(p_user uuid, p_decl uuid, p_posicion integer, p_id uuid, p_path text, p_mime text,
  p_bytes integer, p_ancho integer, p_alto integer, p_sha text, p_sha_original text, p_bytes_original integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare d public.hist_declarations; v_ext text; v_old public.hist_captures; v_libre text;
begin
  select * into d from public.hist_declarations where id = p_decl for update;          -- serializa subidas del mismo registro
  perform public.svc_hist_captura_check(p_user, p_decl, p_posicion, p_bytes);
  v_ext := case p_mime when 'image/webp' then 'webp' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end;
  if v_ext is null then raise exception 'Formato no permitido' using errcode = '22023'; end if;
  if p_path <> d.class_id::text || '/' || p_user::text || '/' || p_sha || '.' || v_ext then raise exception 'Ruta no válida' using errcode = '22023'; end if;
  if exists (select 1 from public.hist_captures c where c.declaration_id = p_decl and c.storage_path = p_path and c.posicion <> p_posicion) then
    raise exception 'Esa misma imagen ya está adjunta en este registro' using errcode = 'P0001';
  end if;
  select * into v_old from public.hist_captures where declaration_id = p_decl and posicion = p_posicion;
  if v_old.id is not null then
    delete from public.hist_captures where id = v_old.id;
    if v_old.storage_path <> p_path and not exists (select 1 from public.hist_captures c where c.storage_path = v_old.storage_path) then v_libre := v_old.storage_path; end if;
  end if;
  insert into public.hist_captures (id, declaration_id, class_id, user_id, posicion, storage_path, mime, bytes, ancho, alto, sha256, sha256_original, bytes_original)
    values (p_id, p_decl, d.class_id, p_user, p_posicion, p_path, p_mime, p_bytes, p_ancho, p_alto, p_sha, p_sha_original, p_bytes_original);
  insert into public.hist_events (class_id, declaration_id, practice_id, actor, papel, accion, estado_antes, estado_despues, detalle)
    values (d.class_id, d.id, d.practice_id, p_user, 'estudiante', case when v_old.id is null then 'captura' else 'captura_reemplazada' end, d.estado, d.estado,
            jsonb_build_object('posicion', p_posicion, 'bytes', p_bytes, 'sha256', p_sha, 'anterior', v_old.sha256));
  return jsonb_build_object('id', p_id, 'liberar', v_libre);
end;
$$;

-- Ruta de una captura para verla: el autor, el profesorado de la sección, el personal del curso o el administrador.
create or replace function public.svc_hist_captura_ruta(p_user uuid, p_capture uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare k public.hist_captures; v_course uuid;
begin
  select * into k from public.hist_captures where id = p_capture;
  if k.id is null then raise exception 'Captura no encontrada' using errcode = 'P0002'; end if;
  select course_id into v_course from public.classes where id = k.class_id;
  if not public.account_ok(p_user) or not (
       k.user_id = p_user
       or exists (select 1 from public.class_teachers t where t.class_id = k.class_id and t.user_id = p_user)
       or exists (select 1 from public.course_staff s where s.course_id = v_course and s.user_id = p_user)
       or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')) then
    raise exception 'No tiene acceso a esta captura' using errcode = '42501';
  end if;
  return k.storage_path;
end;
$$;

-- Quita una captura complementaria (o la principal de un borrador). Devuelve la ruta si ya nadie la usa.
create or replace function public.svc_hist_captura_quitar(p_user uuid, p_capture uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare k public.hist_captures; d public.hist_declarations;
begin
  select * into k from public.hist_captures where id = p_capture;
  if k.id is null then raise exception 'Captura no encontrada' using errcode = 'P0002'; end if;
  select * into d from public.hist_declarations where id = k.declaration_id for update;
  if d.user_id <> p_user or not public.account_ok(p_user) then raise exception 'No tiene acceso a esta captura' using errcode = '42501'; end if;
  if not public.hist_editable(d) then raise exception 'El profesor ya revisó este registro; no se puede modificar' using errcode = '42501'; end if;
  if k.posicion = 1 and d.estado <> 'borrador' then raise exception 'Un registro enviado necesita su captura principal: reemplácela en lugar de quitarla' using errcode = 'P0001'; end if;
  delete from public.hist_captures where id = p_capture;
  insert into public.hist_events (class_id, declaration_id, practice_id, actor, papel, accion, estado_antes, estado_despues, detalle)
    values (d.class_id, d.id, d.practice_id, p_user, 'estudiante', 'captura_quitada', d.estado, d.estado, jsonb_build_object('posicion', k.posicion, 'sha256', k.sha256));
  return case when exists (select 1 from public.hist_captures c where c.storage_path = k.storage_path) then null else k.storage_path end;
end;
$$;

-- Elimina un BORRADOR propio (nunca un registro enviado). Devuelve las rutas que ya nadie usa.
create or replace function public.svc_hist_borrador_eliminar(p_user uuid, p_decl uuid)
returns text[]
language plpgsql security definer set search_path = ''
as $$
declare d public.hist_declarations; v_rutas text[];
begin
  select * into d from public.hist_declarations where id = p_decl for update;
  if d.id is null then raise exception 'Registro no encontrado' using errcode = 'P0002'; end if;
  if d.user_id <> p_user or not public.account_ok(p_user) then raise exception 'No tiene acceso a este registro' using errcode = '42501'; end if;
  if d.estado <> 'borrador' then raise exception 'Solo se pueden eliminar borradores' using errcode = 'P0001'; end if;
  select coalesce(array_agg(distinct storage_path), '{}') into v_rutas from public.hist_captures where declaration_id = p_decl;
  insert into public.hist_events (class_id, practice_id, actor, papel, accion, estado_antes, detalle)
    values (d.class_id, d.practice_id, p_user, 'estudiante', 'borrador_eliminado', 'borrador', jsonb_build_object('declaracion', d.id, 'capturas', cardinality(v_rutas)));
  delete from public.hist_declarations where id = p_decl;
  return coalesce((select array_agg(u.ruta) from unnest(v_rutas) as u(ruta) where not exists (select 1 from public.hist_captures c where c.storage_path = u.ruta)), '{}');
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------------------------------------------
revoke all on function public.hist_assert_teacher(uuid) from public, anon, authenticated;
revoke all on function public.hist_log(uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.hist_editable(public.hist_declarations) from public, anon, authenticated;
revoke all on function public.hist_faltantes(public.hist_declarations) from public, anon, authenticated;
revoke all on function public.hist_bytes_seccion(uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'svc_hist_captura_check(uuid, uuid, integer, integer)',
    'svc_hist_captura_registrar(uuid, uuid, integer, uuid, text, text, integer, integer, integer, text, text, integer)',
    'svc_hist_captura_ruta(uuid, uuid)', 'svc_hist_captura_quitar(uuid, uuid)', 'svc_hist_borrador_eliminar(uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  foreach f in array array[
    'hist_config(uuid)', 'hist_configurar(uuid, boolean, text, integer, numeric, integer, integer, integer)',
    'hist_practica_guardar(uuid, uuid, integer, text, text)', 'hist_practica_archivar(uuid, boolean)', 'hist_practica_unir(uuid, uuid, text)',
    'hist_practica_vincular(uuid, uuid)', 'hist_registros(uuid)', 'hist_resumen(uuid)', 'hist_historial(uuid)', 'hist_revisar(uuid[], text, text)',
    'hist_sugerencias(uuid)', 'hist_sugerencias_decidir(uuid[], text, uuid, text, text)',
    'hist_mis_secciones()', 'hist_guardar(uuid, uuid, uuid, text, text, text, date, boolean, text, text, text, text, text)',
    'hist_enviar(uuid[], boolean, text)', 'hist_sugerir(uuid, text, text, date, text, integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
