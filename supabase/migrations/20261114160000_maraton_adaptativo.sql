-- =============================================================================
-- Migración 94 · Maratón académico adaptativo (docs/MARATON_ADAPTATIVO.md)
--
-- Un motor nuevo, separado de `activities`/`attempts` como la Práctica Extraordinaria (PES): así el maratón NO entra
-- por construcción en el registro de calificaciones (official_scores solo recorre activity_grade_links), ni en los
-- controles, ni en el tablero de exámenes. El sistema administra problemas y produce informes; NUNCA escribe notas.
--
--  · Banco preconstruido: maraton_bancos → maraton_temas → maraton_plantillas → maraton_variantes (+ maraton_claves).
--    Las claves y soluciones solo las leen el servidor (svc_*) y el profesorado de la asignatura (funciones docentes).
--  · Maratón: maraton_actividades (sección, banco, configuración jsonb, estado borrador/publicado/archivado).
--  · Estado del estudiante: maraton_inscripciones (nivel, comodines, problema actual: lo mínimo para elegir el siguiente),
--    maraton_jornadas (contadores del día) y maraton_presentaciones (cada problema presentado y la decisión tomada:
--    es el historial forense; una presentación cerrada es inmutable).
--  · Toda decisión académica se toma aquí, bajo bloqueo de fila de la inscripción y con clave de idempotencia:
--    nivel, ponderación, unidades, comodines, finalización, fecha efectiva (servidor, zona America/Santo_Domingo).
--  · Rendimiento: sin latidos periódicos. El tiempo de cada problema se acredita al cerrarlo:
--    min(tiempo activo informado por el navegador, reloj del servidor desde que se presentó, tope del problema).
--    Una escritura por acción del estudiante; ninguna mientras piensa.
-- =============================================================================
set local lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- Banco de problemas
-- -----------------------------------------------------------------------------
create table if not exists public.maraton_bancos (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9._-]{1,60}$'),
  nombre text not null check (char_length(nombre) between 1 and 160),
  descripcion text not null default '',
  cursos uuid[] not null default '{}',           -- asignaturas que pueden usarlo
  version text not null default '1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maraton_temas (
  banco_id text not null references public.maraton_bancos (id) on delete restrict,
  codigo text not null check (codigo ~ '^[a-z0-9_]{2,40}$'),
  nombre text not null,
  unidad text not null default '',
  fuente text not null default '',                -- evidencia académica (lecciones, clases)
  practicas text not null default '',
  examenes text not null default '',
  cobertura text not null check (cobertura in ('alta', 'media', 'baja', 'sin_evidencia')),
  estado text not null check (estado in ('verificado', 'pendiente', 'excluido')),
  orden integer not null default 0,
  primary key (banco_id, codigo)
);

create table if not exists public.maraton_plantillas (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9._-]{2,80}$'),
  banco_id text not null references public.maraton_bancos (id) on delete restrict,
  tema text not null,
  subtema text not null default '',
  nivel smallint not null check (nivel between 1 and 6),
  titulo text not null,
  metodo text not null default '',                -- método de verificación
  t_min_s integer not null check (t_min_s between 30 and 3600),
  t_max_s integer not null check (t_max_s between 60 and 3600),
  unidades numeric(4, 2) not null default 1,      -- unidades nominales (la ponderación efectiva la fija cada maratón)
  etiquetas text[] not null default '{}',
  fuente text not null default '',                -- fuente curricular
  estado text not null default 'pendiente_revision' check (estado in ('validada', 'pendiente_revision', 'rechazada')),
  nota_revision text,
  revisado_por uuid references public.profiles (id) on delete set null,
  revisado_at timestamptz,
  check (t_max_s >= t_min_s),
  foreign key (banco_id, tema) references public.maraton_temas (banco_id, codigo) on delete restrict
);
create index if not exists maraton_plantillas_banco_idx on public.maraton_plantillas (banco_id, nivel);

create table if not exists public.maraton_variantes (
  id text primary key,
  plantilla_id text not null references public.maraton_plantillas (id) on delete restrict,
  n integer not null check (n >= 1),
  enunciado text not null,
  partes jsonb not null check (jsonb_typeof(partes) = 'array' and jsonb_array_length(partes) between 1 and 6),
  datos jsonb not null default '{}',
  estado text not null default 'validada' check (estado in ('validada', 'pendiente_revision', 'rechazada')),
  huella text not null default '',
  unique (plantilla_id, n)
);

-- 🔒 claves: solo service_role (svc_*) y funciones docentes
create table if not exists public.maraton_claves (
  variante_id text primary key references public.maraton_variantes (id) on delete restrict,
  clave jsonb not null check (jsonb_typeof(clave -> 'partes') = 'array'),
  solucion text not null default '',
  verificacion jsonb not null default '{}'
);

-- -----------------------------------------------------------------------------
-- Maratones (una instancia por sección)
-- -----------------------------------------------------------------------------
create table if not exists public.maraton_actividades (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  group_id uuid references public.class_groups (id) on delete set null,
  banco_id text not null references public.maraton_bancos (id) on delete restrict,
  titulo text not null check (char_length(titulo) between 1 and 160),
  descripcion text not null default '',
  instrucciones text not null default '',
  responsable uuid references public.profiles (id) on delete set null,
  estado text not null default 'borrador' check (estado in ('borrador', 'publicado', 'archivado')),
  fecha_inicio date,                               -- null: pendiente de configuración docente
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object'),
  -- el maratón nunca califica: la columna existe para que la regla quede escrita en el esquema
  calificacion_automatica boolean not null default false check (calificacion_automatica = false),
  origen_id uuid references public.maraton_actividades (id) on delete set null,
  publicado_at timestamptz,
  publicado_por uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists maraton_actividades_class_idx on public.maraton_actividades (class_id);

create table if not exists public.maraton_inscripciones (
  id uuid primary key default gen_random_uuid(),
  maraton_id uuid not null references public.maraton_actividades (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  prueba boolean not null default false,           -- recorrido de prueba del profesor (no aparece en informes)
  nivel smallint not null check (nivel between 1 and 6),
  comodines_usados integer not null default 0 check (comodines_usados >= 0),
  secuencia integer not null default 0,
  presentacion_actual uuid,
  recientes text[] not null default '{}',          -- últimas plantillas (para no repetir familia)
  temas_conteo jsonb not null default '{}',        -- problemas presentados por tema (reparto)
  aceptado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maraton_id, user_id)
);

create table if not exists public.maraton_jornadas (
  id uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references public.maraton_inscripciones (id) on delete restrict,
  maraton_id uuid not null references public.maraton_actividades (id) on delete restrict,
  numero smallint not null check (numero between 1 and 60),
  fecha date not null,
  estado text not null default 'en_curso'
    check (estado in ('pendiente', 'en_curso', 'completada', 'cerrada_limite', 'incompleta', 'justificada')),
  unidades numeric(8, 2) not null default 0,
  intentos_validos integer not null default 0,
  correctas integer not null default 0,
  incorrectas integer not null default 0,
  no_puedo integer not null default 0,
  cambios integer not null default 0,
  presentados integer not null default 0,
  anticipadas integer not null default 0,
  segundos numeric(10, 1) not null default 0,
  via text check (via in ('cuota', 'alternativa')),
  revision boolean not null default false,
  motivo_revision text,
  iniciada_at timestamptz,
  cerrada_at timestamptz,
  reabierta_hasta timestamptz,
  unique (inscripcion_id, numero)
);
create index if not exists maraton_jornadas_maraton_idx on public.maraton_jornadas (maraton_id);

create table if not exists public.maraton_presentaciones (
  id uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references public.maraton_inscripciones (id) on delete restrict,
  jornada_id uuid not null references public.maraton_jornadas (id) on delete restrict,
  secuencia integer not null,
  variante_id text not null references public.maraton_variantes (id) on delete restrict,
  plantilla_id text not null,
  tema text not null,
  nivel smallint not null check (nivel between 1 and 6),
  t_min_s integer not null,
  t_max_s integer not null,
  peso numeric(5, 2) not null,
  presentada_at timestamptz not null default now(),
  cerrada_at timestamptz,
  accion text check (accion in ('respuesta', 'no_puedo', 'cambio', 'cierre')),
  resultado text check (resultado in ('correcta', 'incorrecta')),
  respuesta jsonb,
  procedimiento text check (procedimiento is null or char_length(procedimiento) <= 20000),
  detalle jsonb,
  segundos numeric(8, 1),
  segundos_cliente numeric(8, 1),
  anticipada boolean,
  unidades numeric(6, 2),
  nivel_despues smallint,
  comodines_antes integer,
  comodines_despues integer,
  idem uuid unique,
  unique (inscripcion_id, variante_id),             -- un problema nunca vuelve al mismo estudiante
  unique (inscripcion_id, secuencia)
);
create index if not exists maraton_presentaciones_jornada_idx on public.maraton_presentaciones (jornada_id);

create table if not exists public.maraton_eventos (
  id bigint generated always as identity primary key,
  maraton_id uuid not null references public.maraton_actividades (id) on delete restrict,
  user_id uuid references public.profiles (id) on delete restrict,
  jornada smallint,
  tipo text not null,
  datos jsonb not null default '{}',
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists maraton_eventos_maraton_idx on public.maraton_eventos (maraton_id, user_id);

create table if not exists public.maraton_incidencias (
  id uuid primary key default gen_random_uuid(),
  maraton_id uuid not null references public.maraton_actividades (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  jornada smallint not null,
  tipo text not null check (tipo in ('reapertura', 'justificacion', 'nota')),
  motivo text not null check (char_length(motivo) between 3 and 2000),
  reabierta_hasta timestamptz,
  creado_por uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists maraton_incidencias_maraton_idx on public.maraton_incidencias (maraton_id);

-- RLS en todas las tablas y SIN políticas ni permisos directos: todo pasa por funciones que comprueban quién llama.
alter table public.maraton_bancos enable row level security;
alter table public.maraton_temas enable row level security;
alter table public.maraton_plantillas enable row level security;
alter table public.maraton_variantes enable row level security;
alter table public.maraton_claves enable row level security;
alter table public.maraton_actividades enable row level security;
alter table public.maraton_inscripciones enable row level security;
alter table public.maraton_jornadas enable row level security;
alter table public.maraton_presentaciones enable row level security;
alter table public.maraton_eventos enable row level security;
alter table public.maraton_incidencias enable row level security;

-- -----------------------------------------------------------------------------
-- Integridad del historial: una presentación cerrada no cambia; eventos e incidencias solo se añaden.
-- (El recorrido de PRUEBA del profesor sí se puede borrar con maraton_reiniciar_prueba.)
-- -----------------------------------------------------------------------------
create or replace function public.maraton_es_prueba(p_insc uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select prueba from public.maraton_inscripciones where id = p_insc), false)
$$;

create or replace function public.maraton_presentacion_inmutable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if public.maraton_es_prueba(old.inscripcion_id) and current_setting('maraton.reinicio', true) = 'si' then return old; end if;
    raise exception 'El historial del maratón no se puede borrar' using errcode = '42501';
  end if;
  if old.cerrada_at is not null then
    raise exception 'Una presentación cerrada del maratón no se puede modificar' using errcode = '42501';
  end if;
  if new.inscripcion_id <> old.inscripcion_id or new.variante_id <> old.variante_id or new.secuencia <> old.secuencia
     or new.nivel <> old.nivel or new.presentada_at <> old.presentada_at and current_setting('maraton.ajuste_tiempo', true) is distinct from 'si' then
    raise exception 'Los datos de una presentación no se pueden alterar' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists maraton_presentacion_inmutable on public.maraton_presentaciones;
create trigger maraton_presentacion_inmutable before update or delete on public.maraton_presentaciones
  for each row execute function public.maraton_presentacion_inmutable();

create or replace function public.maraton_solo_anadir() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if tg_op = 'DELETE' and current_setting('maraton.reinicio', true) = 'si' then
    v := to_jsonb(old);
    if tg_table_name = 'maraton_jornadas' and public.maraton_es_prueba((v ->> 'inscripcion_id')::uuid) then return old; end if;
    if tg_table_name = 'maraton_inscripciones' and (v ->> 'prueba')::boolean then return old; end if;
  end if;
  raise exception 'El registro del maratón solo admite añadir filas' using errcode = '42501';
end $$;
drop trigger if exists maraton_eventos_inmutable on public.maraton_eventos;
create trigger maraton_eventos_inmutable before update or delete on public.maraton_eventos
  for each row execute function public.maraton_solo_anadir();
drop trigger if exists maraton_incidencias_inmutable on public.maraton_incidencias;
create trigger maraton_incidencias_inmutable before update or delete on public.maraton_incidencias
  for each row execute function public.maraton_solo_anadir();
drop trigger if exists maraton_jornadas_sin_borrado on public.maraton_jornadas;
create trigger maraton_jornadas_sin_borrado before delete on public.maraton_jornadas
  for each row execute function public.maraton_solo_anadir();
drop trigger if exists maraton_inscripciones_sin_borrado on public.maraton_inscripciones;
create trigger maraton_inscripciones_sin_borrado before delete on public.maraton_inscripciones
  for each row execute function public.maraton_solo_anadir();

-- -----------------------------------------------------------------------------
-- Configuración: valores predeterminados, combinación y validación
-- -----------------------------------------------------------------------------
create or replace function public.maraton_defaults() returns jsonb
language sql immutable set search_path = '' as $$
  select '{
    "programacion": {"jornadas": 14, "modo": "consecutivas", "calendario": [], "hora_inicio": "00:00",
                     "apertura": "00:00", "cierre": "23:59", "zona": "America/Santo_Domingo"},
    "carga": {"cuota": 12, "alternativa_activa": true, "alternativa_minutos": 60, "alternativa_intentos": 8,
              "objetivo_min": 60, "objetivo_max": 75, "limite_minutos": 90, "intentos_max": 18, "presentados_max": 30},
    "dificultad": {"niveles": 6, "nivel_inicial": 2, "adaptativa": true, "pesos": [1.00, 1.20, 1.40, 1.50, 1.00, 1.00],
                   "ascenso": 1, "descenso": 1, "descenso_no_puedo": 1, "nivel_al_iniciar_jornada": "continuar",
                   "t_min_factor": 1.0, "t_min_nivel_s": null},
    "comodines": {"total": 10, "por_jornada": null, "no_puedo": true},
    "contenido": {"temas": null, "excluir_plantillas": [], "distribucion": {}},
    "informes": {"estudiante": true, "docente": true, "publicacion_estudiante": null,
                 "exportaciones": ["pdf", "csv", "xlsx"], "indicadores": true},
    "seguridad": {"retroalimentacion": "ninguna", "gracia_s": 120, "reanudacion": true}
  }'::jsonb
$$;

-- Combina la configuración guardada con los valores predeterminados (un nivel de profundidad)
create or replace function public.maraton_cfg(p_config jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_object_agg(d.key,
    case when jsonb_typeof(d.value) = 'object' and jsonb_typeof(coalesce(p_config, '{}'::jsonb) -> d.key) = 'object'
      then d.value || (p_config -> d.key)
      else coalesce(p_config -> d.key, d.value) end)
  from jsonb_each(public.maraton_defaults()) d
$$;

create or replace function public.maraton_config_errores(p_config jsonb) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  c jsonb := public.maraton_cfg(p_config);
  pr jsonb := c -> 'programacion'; ca jsonb := c -> 'carga'; di jsonb := c -> 'dificultad';
  co jsonb := c -> 'comodines'; inf jsonb := c -> 'informes'; se jsonb := c -> 'seguridad'; ct jsonb := c -> 'contenido';
  e text[] := '{}'; n integer; i integer; d date; prev date; x numeric;
begin
  begin
    n := (pr ->> 'jornadas')::int;
    if n is null or n < 1 or n > 60 then e := array_append(e, 'El número de jornadas debe estar entre 1 y 60.'); end if;
    if coalesce(pr ->> 'modo', '') not in ('consecutivas', 'calendario') then e := array_append(e, 'El tipo de calendario no es válido.'); end if;
    if pr ->> 'modo' = 'calendario' then
      if jsonb_typeof(pr -> 'calendario') is distinct from 'array' or jsonb_array_length(pr -> 'calendario') <> n then
        e := array_append(e, 'El calendario personalizado debe tener exactamente una fecha por jornada.');
      else
        for i in 0 .. n - 1 loop
          d := (pr -> 'calendario' ->> i)::date;
          if prev is not null and d <= prev then e := array_append(e, 'Las fechas del calendario deben ser crecientes y distintas.'); exit; end if;
          prev := d;
        end loop;
      end if;
    end if;
    if (pr ->> 'apertura')::time >= (pr ->> 'cierre')::time then e := array_append(e, 'La hora de apertura debe ser anterior a la hora límite.'); end if;
    perform (pr ->> 'hora_inicio')::time;
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = pr ->> 'zona') then e := array_append(e, 'Zona horaria desconocida.'); end if;
  exception when others then e := array_append(e, 'Programación no válida (fechas u horas mal escritas).');
  end;
  begin
    x := (ca ->> 'cuota')::numeric;
    if x is null or x <= 0 or x > 100 then e := array_append(e, 'La cuota diaria debe estar entre 0 y 100 unidades.'); end if;
    if jsonb_typeof(ca -> 'alternativa_activa') <> 'boolean' then e := array_append(e, 'Indique si la finalización alternativa está activa.'); end if;
    if (ca ->> 'alternativa_minutos')::numeric not between 1 and 600 then e := array_append(e, 'Los minutos de la finalización alternativa deben estar entre 1 y 600.'); end if;
    if (ca ->> 'alternativa_intentos')::int not between 1 and 100 then e := array_append(e, 'Los intentos de la finalización alternativa deben estar entre 1 y 100.'); end if;
    if (ca ->> 'limite_minutos')::numeric not between 5 and 600 then e := array_append(e, 'El límite máximo de la jornada debe estar entre 5 y 600 minutos.'); end if;
    if (ca ->> 'intentos_max')::int not between 1 and 200 then e := array_append(e, 'El máximo de intentos válidos debe estar entre 1 y 200.'); end if;
    if (ca ->> 'presentados_max')::int < (ca ->> 'intentos_max')::int then e := array_append(e, 'El máximo de problemas presentados no puede ser menor que el máximo de intentos.'); end if;
    if (ca ->> 'objetivo_min')::numeric > (ca ->> 'objetivo_max')::numeric then e := array_append(e, 'El tiempo objetivo mínimo supera al máximo.'); end if;
    if (ca ->> 'alternativa_activa')::boolean and (ca ->> 'alternativa_intentos')::int > (ca ->> 'intentos_max')::int then
      e := array_append(e, 'La finalización alternativa pide más intentos que el máximo permitido.'); end if;
  exception when others then e := array_append(e, 'Carga académica no válida.');
  end;
  begin
    n := (di ->> 'niveles')::int;
    if n not between 2 and 6 then e := array_append(e, 'El número de niveles debe estar entre 2 y 6.'); end if;
    if (di ->> 'nivel_inicial')::int not between 1 and n then e := array_append(e, 'El nivel inicial debe estar entre 1 y el número de niveles.'); end if;
    if jsonb_typeof(di -> 'adaptativa') <> 'boolean' then e := array_append(e, 'Indique si la adaptación está activa.'); end if;
    if jsonb_typeof(di -> 'pesos') <> 'array' or jsonb_array_length(di -> 'pesos') <> 6 then e := array_append(e, 'Debe haber una ponderación por cada uno de los seis niveles.');
    else
      for i in 0 .. 5 loop
        if (di -> 'pesos' ->> i)::numeric not between 0.1 and 10 then e := array_append(e, 'Cada ponderación debe estar entre 0.1 y 10.'); exit; end if;
      end loop;
    end if;
    if (di ->> 'ascenso')::int not between 0 and 3 or (di ->> 'descenso')::int not between 0 and 3 or (di ->> 'descenso_no_puedo')::int not between 0 and 3 then
      e := array_append(e, 'Los saltos de ascenso y descenso deben estar entre 0 y 3 niveles.'); end if;
    if coalesce(di ->> 'nivel_al_iniciar_jornada', '') not in ('continuar', 'inicial') then e := array_append(e, 'Regla de nivel al iniciar la jornada no válida.'); end if;
    if (di ->> 't_min_factor')::numeric not between 0.25 and 4 then e := array_append(e, 'El factor de tiempo mínimo debe estar entre 0.25 y 4.'); end if;
    if jsonb_typeof(di -> 't_min_nivel_s') = 'array' then
      if jsonb_array_length(di -> 't_min_nivel_s') <> 6 then e := array_append(e, 'Los tiempos mínimos por nivel deben ser seis.');
      else
        for i in 0 .. 5 loop
          if di -> 't_min_nivel_s' -> i <> 'null'::jsonb and (di -> 't_min_nivel_s' ->> i)::int not between 30 and 3600 then
            e := array_append(e, 'Cada tiempo mínimo por nivel debe estar entre 30 y 3600 s.'); exit; end if;
        end loop;
      end if;
    elsif di -> 't_min_nivel_s' is not null and di -> 't_min_nivel_s' <> 'null'::jsonb then e := array_append(e, 'Tiempos mínimos por nivel no válidos.');
    end if;
  exception when others then e := array_append(e, 'Configuración de dificultad no válida.');
  end;
  begin
    if (co ->> 'total')::int not between 0 and 100 then e := array_append(e, 'Los comodines deben estar entre 0 y 100.'); end if;
    if co -> 'por_jornada' <> 'null'::jsonb and (co ->> 'por_jornada')::int not between 0 and 100 then e := array_append(e, 'El límite diario de comodines no es válido.'); end if;
    if jsonb_typeof(co -> 'no_puedo') <> 'boolean' then e := array_append(e, 'Indique si se permite declarar «No puedo resolverlo».'); end if;
  exception when others then e := array_append(e, 'Configuración de comodines no válida.');
  end;
  begin
    if jsonb_typeof(inf -> 'estudiante') <> 'boolean' or jsonb_typeof(inf -> 'docente') <> 'boolean' then e := array_append(e, 'Configuración de informes no válida.'); end if;
    if inf -> 'publicacion_estudiante' <> 'null'::jsonb then perform (inf ->> 'publicacion_estudiante')::date; end if;
  exception when others then e := array_append(e, 'La fecha de publicación del informe no es válida.');
  end;
  begin
    if coalesce(se ->> 'retroalimentacion', '') not in ('ninguna', 'correcto_incorrecto') then e := array_append(e, 'Retroalimentación no válida.'); end if;
    if (se ->> 'gracia_s')::int not between 0 and 600 then e := array_append(e, 'El margen de gracia debe estar entre 0 y 600 s.'); end if;
  exception when others then e := array_append(e, 'Configuración de seguridad no válida.');
  end;
  if ct -> 'temas' <> 'null'::jsonb and jsonb_typeof(ct -> 'temas') <> 'array' then e := array_append(e, 'La selección de temas no es válida.'); end if;
  if jsonb_typeof(ct -> 'excluir_plantillas') <> 'array' then e := array_append(e, 'La lista de exclusiones no es válida.'); end if;
  return e;
end $$;

-- Temas efectivos de un maratón (null = todos los verificados del banco)
create or replace function public.maraton_temas_sel(p_m public.maraton_actividades) returns text[]
language sql stable security definer set search_path = '' as $$
  select case when jsonb_typeof(public.maraton_cfg(p_m.config) -> 'contenido' -> 'temas') = 'array'
    then coalesce((select array_agg(t.value #>> '{}') from jsonb_array_elements(public.maraton_cfg(p_m.config) -> 'contenido' -> 'temas') t), '{}')
    else coalesce((select array_agg(codigo order by orden) from public.maraton_temas where banco_id = p_m.banco_id and estado = 'verificado'), '{}') end
$$;

-- -----------------------------------------------------------------------------
-- Calendario (servidor; zona de la configuración)
-- -----------------------------------------------------------------------------
create or replace function public.maraton_calendario(p_m public.maraton_actividades, p_k integer) returns jsonb
language plpgsql stable set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); pr jsonb := c -> 'programacion'; z text := pr ->> 'zona';
  f date; v_abre timestamptz; v_cierra timestamptz;
begin
  if p_m.fecha_inicio is null or p_k < 1 or p_k > (pr ->> 'jornadas')::int then return null; end if;
  f := case when pr ->> 'modo' = 'calendario' then (pr -> 'calendario' ->> (p_k - 1))::date else p_m.fecha_inicio + (p_k - 1) end;
  if f is null then return null; end if;
  v_abre := (f + (pr ->> 'apertura')::time) at time zone z;
  if p_k = 1 then v_abre := greatest(v_abre, (f + (pr ->> 'hora_inicio')::time) at time zone z); end if;
  v_cierra := (f + (pr ->> 'cierre')::time + interval '1 minute') at time zone z;
  return jsonb_build_object('numero', p_k, 'fecha', f, 'abre', v_abre, 'cierra', v_cierra);
end $$;

-- Jornada que corresponde HOY: fase = sin_fecha | antes | antes_de_apertura | abierta | cerrada_hoy | sin_jornada_hoy | finalizado
create or replace function public.maraton_hoy(p_m public.maraton_actividades) returns jsonb
language plpgsql stable set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); n integer := (c -> 'programacion' ->> 'jornadas')::int;
  v_hoy date; k integer; j jsonb;
begin
  if p_m.fecha_inicio is null then return jsonb_build_object('fase', 'sin_fecha'); end if;
  v_hoy := (now() at time zone (c -> 'programacion' ->> 'zona'))::date;
  for k in 1 .. n loop
    j := public.maraton_calendario(p_m, k);
    if (j ->> 'fecha')::date = v_hoy then
      if now() < (j ->> 'abre')::timestamptz then return j || jsonb_build_object('fase', 'antes_de_apertura'); end if;
      if now() >= (j ->> 'cierra')::timestamptz then
        return j || jsonb_build_object('fase', case when k = n then 'finalizado' else 'cerrada_hoy' end, 'siguiente', public.maraton_calendario(p_m, k + 1));
      end if;
      return j || jsonb_build_object('fase', 'abierta');
    end if;
    if (j ->> 'fecha')::date > v_hoy then
      return jsonb_build_object('fase', case when k = 1 then 'antes' else 'sin_jornada_hoy' end, 'siguiente', j);
    end if;
  end loop;
  return jsonb_build_object('fase', 'finalizado');
end $$;

create or replace function public.maraton_finalizado(p_m public.maraton_actividades) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(p_m.fecha_inicio is not null
     and now() >= (public.maraton_calendario(p_m, (public.maraton_cfg(p_m.config) -> 'programacion' ->> 'jornadas')::int) ->> 'cierra')::timestamptz, false)
$$;

-- -----------------------------------------------------------------------------
-- Registro
-- -----------------------------------------------------------------------------
create or replace function public.maraton_log(p_maraton uuid, p_user uuid, p_jornada integer, p_tipo text, p_datos jsonb default '{}', p_actor uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.maraton_eventos (maraton_id, user_id, jornada, tipo, datos, actor)
  select p_maraton, p_user, p_jornada, p_tipo, coalesce(p_datos, '{}'), coalesce(p_actor, auth.uid())
  where not exists (select 1 from public.maraton_inscripciones where maraton_id = p_maraton and user_id = p_user and prueba)
$$;

-- -----------------------------------------------------------------------------
-- Núcleo del motor (todas estas funciones se llaman con la inscripción BLOQUEADA)
-- -----------------------------------------------------------------------------

-- Cierra una jornada (vencida, límite…) y retira el problema abierto sin crédito
create or replace function public.maraton_cerrar_jornada(p_insc uuid, p_jornada uuid, p_estado text, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.maraton_inscripciones; j public.maraton_jornadas;
begin
  select * into i from public.maraton_inscripciones where id = p_insc;
  select * into j from public.maraton_jornadas where id = p_jornada;
  update public.maraton_presentaciones set cerrada_at = now(), accion = 'cierre', segundos = 0, unidades = 0, nivel_despues = nivel,
         comodines_antes = i.comodines_usados, comodines_despues = i.comodines_usados
   where jornada_id = p_jornada and cerrada_at is null;
  update public.maraton_inscripciones set presentacion_actual = null, updated_at = now()
   where id = p_insc and presentacion_actual in (select id from public.maraton_presentaciones where jornada_id = p_jornada);
  update public.maraton_jornadas set estado = p_estado, cerrada_at = now(), reabierta_hasta = null,
         revision = revision or p_estado = 'cerrada_limite', motivo_revision = coalesce(p_motivo, motivo_revision)
   where id = p_jornada;
  perform public.maraton_log(j.maraton_id, i.user_id, j.numero, 'jornada_' || p_estado, jsonb_build_object('motivo', p_motivo), i.user_id);
end $$;

-- Jornada en la que el estudiante puede trabajar ahora (la crea si p_crear). Cierra antes las vencidas.
create or replace function public.maraton_jornada_activa(p_m public.maraton_actividades, p_insc public.maraton_inscripciones, p_crear boolean)
returns public.maraton_jornadas language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); v_gracia integer := coalesce((c -> 'seguridad' ->> 'gracia_s')::int, 120);
  n integer := (c -> 'programacion' ->> 'jornadas')::int; j public.maraton_jornadas; cal jsonb; h jsonb; v_num integer;
begin
  -- 1) jornadas en curso cuyo plazo terminó (y no están reabiertas) → incompletas
  if not p_insc.prueba then
    for j in select * from public.maraton_jornadas where inscripcion_id = p_insc.id and estado = 'en_curso' loop
      cal := public.maraton_calendario(p_m, j.numero);
      if (j.reabierta_hasta is null or j.reabierta_hasta < now())
         and (cal is null or now() > (cal ->> 'cierra')::timestamptz + make_interval(secs => v_gracia)) then
        perform public.maraton_cerrar_jornada(p_insc.id, j.id, 'incompleta', 'Terminó el plazo de la jornada sin cumplir los requisitos');
      end if;
    end loop;
  end if;
  -- 2) reapertura administrativa vigente (tiene prioridad)
  select * into j from public.maraton_jornadas
   where inscripcion_id = p_insc.id and reabierta_hasta >= now() and estado in ('pendiente', 'en_curso', 'incompleta', 'justificada')
   order by numero limit 1;
  if j.id is not null then
    if j.estado <> 'en_curso' and p_crear then
      update public.maraton_jornadas set estado = 'en_curso', iniciada_at = coalesce(iniciada_at, now()), cerrada_at = null
       where id = j.id returning * into j;
      perform public.maraton_log(p_m.id, p_insc.user_id, j.numero, 'jornada_reanudada_por_reapertura', '{}', p_insc.user_id);
    end if;
    return j;
  end if;
  -- 3) recorrido de prueba del profesor: jornadas seguidas sin esperar al calendario
  if p_insc.prueba then
    select * into j from public.maraton_jornadas where inscripcion_id = p_insc.id order by numero desc limit 1;
    if j.id is not null and j.estado = 'en_curso' then return j; end if;
    v_num := coalesce(j.numero, 0) + 1;
    if p_crear and v_num <= n then
      insert into public.maraton_jornadas (inscripcion_id, maraton_id, numero, fecha, iniciada_at)
      values (p_insc.id, p_m.id, v_num, (now() at time zone (c -> 'programacion' ->> 'zona'))::date, now()) returning * into j;
    end if;
    return j;
  end if;
  -- 4) la jornada de hoy
  h := public.maraton_hoy(p_m);
  if h ->> 'numero' is null then return null; end if;
  select * into j from public.maraton_jornadas where inscripcion_id = p_insc.id and numero = (h ->> 'numero')::int;
  if j.id is null and p_crear and h ->> 'fase' = 'abierta' then
    insert into public.maraton_jornadas (inscripcion_id, maraton_id, numero, fecha, iniciada_at)
    values (p_insc.id, p_m.id, (h ->> 'numero')::int, (h ->> 'fecha')::date, now())
    on conflict (inscripcion_id, numero) do nothing returning * into j;
    if j.id is not null then
      perform public.maraton_log(p_m.id, p_insc.user_id, j.numero, 'jornada_iniciada', '{}', p_insc.user_id);
      if c -> 'dificultad' ->> 'nivel_al_iniciar_jornada' = 'inicial' then
        update public.maraton_inscripciones set nivel = (c -> 'dificultad' ->> 'nivel_inicial')::int where id = p_insc.id;
      end if;
    end if;
  end if;
  return j;
end $$;

-- Elige y presenta un problema del nivel actual (selección en el servidor; azar no predecible desde el cliente)
create or replace function public.maraton_presentar(p_m public.maraton_actividades, p_insc uuid, p_jornada uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); i public.maraton_inscripciones; v_temas text[] := public.maraton_temas_sel(p_m);
  v_excl text[]; v_nivel integer; v_niveles integer; v_var text; p public.maraton_plantillas; v_id uuid; v_tmin integer; v_tmax integer;
  v_peso numeric; v_intento integer; v_dist jsonb;
begin
  select * into i from public.maraton_inscripciones where id = p_insc;
  v_excl := coalesce((select array_agg(x #>> '{}') from jsonb_array_elements(c -> 'contenido' -> 'excluir_plantillas') x), '{}');
  v_dist := coalesce(c -> 'contenido' -> 'distribucion', '{}');
  v_niveles := (c -> 'dificultad' ->> 'niveles')::int;
  -- nivel pedido; si se agotara (no debería con el banco construido), el más cercano, primero hacia abajo
  for v_intento in 0 .. 10 loop
    v_nivel := case when v_intento = 0 then i.nivel
                    when v_intento % 2 = 1 then i.nivel - (v_intento + 1) / 2
                    else i.nivel + v_intento / 2 end;
    continue when v_nivel < 1 or v_nivel > v_niveles;
    -- plantillas candidatas: primero las no recientes y los temas menos trabajados (según la distribución pedida)
    for p in
      select pl.* from public.maraton_plantillas pl
       where pl.banco_id = p_m.banco_id and pl.nivel = v_nivel and pl.estado = 'validada'
         and pl.tema = any (v_temas) and not (pl.id = any (v_excl))
       order by (pl.id = any (i.recientes)),
                coalesce((i.temas_conteo ->> pl.tema)::numeric, 0) / greatest(coalesce((v_dist ->> pl.tema)::numeric, 1), 0.01),
                random()
    loop
      select v.id into v_var from public.maraton_variantes v
       where v.plantilla_id = p.id and v.estado = 'validada'
         and not exists (select 1 from public.maraton_presentaciones x where x.inscripcion_id = p_insc and x.variante_id = v.id)
       order by random() limit 1;
      exit when v_var is not null;
    end loop;
    exit when v_var is not null;
  end loop;
  if v_var is null then
    raise exception 'No quedan problemas disponibles en el banco para este maratón. Avise a su profesor.' using errcode = 'P0001';
  end if;
  if v_nivel <> i.nivel then
    perform public.maraton_log(p_m.id, i.user_id, null, 'nivel_sin_problemas', jsonb_build_object('pedido', i.nivel, 'presentado', v_nivel), i.user_id);
  end if;
  v_tmin := coalesce((c -> 'dificultad' -> 't_min_nivel_s' ->> (v_nivel - 1))::int,
                     greatest(30, round(p.t_min_s * coalesce((c -> 'dificultad' ->> 't_min_factor')::numeric, 1))::int));
  v_tmax := greatest(v_tmin, round(p.t_max_s * greatest(1, coalesce((c -> 'dificultad' ->> 't_min_factor')::numeric, 1)))::int);
  v_peso := (c -> 'dificultad' -> 'pesos' ->> (v_nivel - 1))::numeric;
  insert into public.maraton_presentaciones (inscripcion_id, jornada_id, secuencia, variante_id, plantilla_id, tema, nivel, t_min_s, t_max_s, peso)
  values (p_insc, p_jornada, i.secuencia + 1, v_var, p.id, p.tema, v_nivel, v_tmin, v_tmax, v_peso)
  returning id into v_id;
  update public.maraton_inscripciones
     set secuencia = secuencia + 1, presentacion_actual = v_id, updated_at = now(),
         recientes = (array_prepend(p.id, recientes))[1:8],
         temas_conteo = jsonb_set(temas_conteo, array[p.tema], to_jsonb(coalesce((temas_conteo ->> p.tema)::int, 0) + 1))
   where id = p_insc;
  update public.maraton_jornadas set presentados = presentados + 1 where id = p_jornada;
  return v_id;
end $$;

-- Tras cada acción: ¿terminó la jornada (vía A o B)? ¿se alcanzó un límite de protección? Si no, siguiente problema.
create or replace function public.maraton_continuar(p_m public.maraton_actividades, p_insc uuid, p_jornada uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); ca jsonb := c -> 'carga'; j public.maraton_jornadas; i public.maraton_inscripciones;
  v_motivo text;
begin
  select * into j from public.maraton_jornadas where id = p_jornada;
  select * into i from public.maraton_inscripciones where id = p_insc;
  if j.estado <> 'en_curso' then return; end if;
  if j.unidades >= (ca ->> 'cuota')::numeric then
    update public.maraton_jornadas set estado = 'completada', via = 'cuota', cerrada_at = now(), reabierta_hasta = null where id = p_jornada;
    perform public.maraton_log(p_m.id, i.user_id, j.numero, 'jornada_completada', jsonb_build_object('via', 'cuota'), i.user_id);
    return;
  end if;
  if (ca ->> 'alternativa_activa')::boolean and j.segundos >= (ca ->> 'alternativa_minutos')::numeric * 60
     and j.intentos_validos >= (ca ->> 'alternativa_intentos')::int then
    update public.maraton_jornadas set estado = 'completada', via = 'alternativa', cerrada_at = now(), reabierta_hasta = null where id = p_jornada;
    perform public.maraton_log(p_m.id, i.user_id, j.numero, 'jornada_completada', jsonb_build_object('via', 'alternativa'), i.user_id);
    return;
  end if;
  v_motivo := case
    when j.segundos >= (ca ->> 'limite_minutos')::numeric * 60 then 'Se alcanzó el límite máximo de tiempo de la jornada'
    when j.intentos_validos >= (ca ->> 'intentos_max')::int then 'Se alcanzó el máximo de intentos válidos de la jornada'
    when j.presentados >= (ca ->> 'presentados_max')::int then 'Se alcanzó el máximo de problemas presentados de la jornada'
  end;
  if v_motivo is not null then
    perform public.maraton_cerrar_jornada(p_insc, p_jornada, 'cerrada_limite', v_motivo);
    return;
  end if;
  if i.presentacion_actual is null then perform public.maraton_presentar(p_m, p_insc, p_jornada); end if;
end $$;

-- Cierra la presentación con la decisión tomada y actualiza nivel, comodines y contadores (máquina de estados)
create or replace function public.maraton_cerrar(p_m public.maraton_actividades, p_pres uuid, p_accion text, p_correcta boolean,
  p_respuesta jsonb, p_proc text, p_seg_cliente numeric, p_idem uuid, p_detalle jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); di jsonb := c -> 'dificultad'; x public.maraton_presentaciones;
  i public.maraton_inscripciones; v_wall numeric; v_seg numeric; v_unid numeric := 0; v_ant boolean := false; v_nivel integer;
  v_n integer := (di ->> 'niveles')::int; v_adapt boolean := (di ->> 'adaptativa')::boolean; v_com integer;
begin
  select * into x from public.maraton_presentaciones where id = p_pres;
  select * into i from public.maraton_inscripciones where id = x.inscripcion_id;
  v_wall := greatest(0, extract(epoch from now() - x.presentada_at));
  -- tiempo acreditado: nunca más que el reloj del servidor ni que el tope del problema
  v_seg := round(least(v_wall, x.t_max_s, coalesce(greatest(p_seg_cliente, 0), v_wall)), 1);
  if p_accion = 'respuesta' then
    v_ant := v_seg < x.t_min_s;
    v_unid := round(x.peso * least(1, v_seg / x.t_min_s), 2);   -- respuesta anticipada: crédito proporcional
  end if;
  v_nivel := case
    when not v_adapt then x.nivel
    when p_accion = 'respuesta' and p_correcta then least(v_n, x.nivel + (di ->> 'ascenso')::int)
    when p_accion = 'respuesta' then greatest(1, x.nivel - (di ->> 'descenso')::int)
    when p_accion = 'no_puedo' then greatest(1, x.nivel - (di ->> 'descenso_no_puedo')::int)
    else x.nivel end;
  v_com := i.comodines_usados + case when p_accion = 'cambio' then 1 else 0 end;
  update public.maraton_presentaciones
     set cerrada_at = now(), accion = p_accion,
         resultado = case when p_accion = 'respuesta' then case when p_correcta then 'correcta' else 'incorrecta' end end,
         respuesta = p_respuesta, procedimiento = nullif(left(coalesce(p_proc, ''), 20000), ''), detalle = p_detalle,
         segundos = v_seg, segundos_cliente = p_seg_cliente, anticipada = v_ant, unidades = v_unid, nivel_despues = v_nivel,
         comodines_antes = i.comodines_usados, comodines_despues = v_com, idem = p_idem
   where id = p_pres;
  update public.maraton_inscripciones set nivel = v_nivel, comodines_usados = v_com, presentacion_actual = null, updated_at = now()
   where id = i.id;
  update public.maraton_jornadas
     set unidades = unidades + v_unid,
         segundos = segundos + v_seg,
         intentos_validos = intentos_validos + case when p_accion = 'respuesta' then 1 else 0 end,
         correctas = correctas + case when p_accion = 'respuesta' and p_correcta then 1 else 0 end,
         incorrectas = incorrectas + case when p_accion = 'respuesta' and not p_correcta then 1 else 0 end,
         no_puedo = no_puedo + case when p_accion = 'no_puedo' then 1 else 0 end,
         cambios = cambios + case when p_accion = 'cambio' then 1 else 0 end,
         anticipadas = anticipadas + case when v_ant then 1 else 0 end
   where id = x.jornada_id;
end $$;

-- Estado OPERATIVO para el estudiante: sin nivel, ponderación, unidades, cuota ni umbrales
create or replace function public.maraton_estado_json(p_m public.maraton_actividades, p_insc uuid, p_aviso text default null, p_ultimo jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); i public.maraton_inscripciones; j public.maraton_jornadas; x public.maraton_presentaciones;
  v_var public.maraton_variantes; h jsonb := public.maraton_hoy(p_m); v_total integer := (c -> 'comodines' ->> 'total')::int;
  v_pj integer; v_disp integer; v_problema jsonb; v_jornada jsonb; v_curso text;
begin
  select * into i from public.maraton_inscripciones where id = p_insc;
  select title into v_curso from public.courses where id = (select course_id from public.classes where id = p_m.class_id);
  if i.id is not null then
    if i.presentacion_actual is not null then
      select * into x from public.maraton_presentaciones where id = i.presentacion_actual;
      select * into j from public.maraton_jornadas where id = x.jornada_id;
    else
      select * into j from public.maraton_jornadas where inscripcion_id = i.id
       order by (estado = 'en_curso') desc, (reabierta_hasta >= now()) desc nulls last,
                (numero = coalesce((h ->> 'numero')::int, -1)) desc, numero desc limit 1;
    end if;
  end if;
  v_disp := greatest(0, v_total - coalesce(i.comodines_usados, 0));
  v_pj := (c -> 'comodines' ->> 'por_jornada')::int;
  if v_pj is not null and j.id is not null then v_disp := least(v_disp, greatest(0, v_pj - j.cambios)); end if;
  if x.id is not null then
    select * into v_var from public.maraton_variantes where id = x.variante_id;
    v_problema := jsonb_build_object('presentacion_id', x.id, 'enunciado', v_var.enunciado,
      'partes', (select jsonb_agg(jsonb_build_object('etiqueta', p ->> 'etiqueta', 'unidad', p ->> 'unidad')) from jsonb_array_elements(v_var.partes) p),
      'presentada_at', x.presentada_at, 'numero', j.presentados);
  end if;
  if j.id is not null then
    v_jornada := jsonb_build_object('numero', j.numero, 'fecha', j.fecha,
      'estado', case j.estado when 'pendiente' then 'sin_iniciar' when 'cerrada_limite' then 'cerrada' else j.estado end,
      'respondidos', j.intentos_validos, 'minutos', floor(j.segundos / 60), 'segundos', j.segundos,
      'reabierta_hasta', case when j.reabierta_hasta >= now() then j.reabierta_hasta end,
      'cierra', coalesce(case when j.reabierta_hasta >= now() then j.reabierta_hasta end, (public.maraton_calendario(p_m, j.numero) ->> 'cierra')::timestamptz));
  end if;
  return jsonb_build_object(
    'maraton', jsonb_build_object('id', p_m.id, 'titulo', p_m.titulo, 'asignatura', v_curso, 'descripcion', p_m.descripcion,
       'instrucciones', p_m.instrucciones, 'jornadas', (c -> 'programacion' ->> 'jornadas')::int, 'fecha_inicio', p_m.fecha_inicio,
       'zona', c -> 'programacion' ->> 'zona', 'apertura', c -> 'programacion' ->> 'apertura', 'cierre', c -> 'programacion' ->> 'cierre',
       'tiempo_orientativo', jsonb_build_array((c -> 'carga' ->> 'objetivo_min')::int, (c -> 'carga' ->> 'objetivo_max')::int),
       'limite_minutos', (c -> 'carga' ->> 'limite_minutos')::int,
       'comodines_total', v_total, 'comodines_por_jornada', v_pj, 'no_puedo', (c -> 'comodines' ->> 'no_puedo')::boolean,
       'estado', p_m.estado),
    'prueba', coalesce(i.prueba, false),
    'hoy', h,
    'finalizado', public.maraton_finalizado(p_m),
    'aceptado', i.aceptado_at is not null,
    'jornada', v_jornada,
    'comodines_disponibles', v_disp,
    'problema', v_problema,
    'aviso', p_aviso,
    'ultimo', case when c -> 'seguridad' ->> 'retroalimentacion' = 'correcto_incorrecto' then p_ultimo end,
    'informe_disponible', public.maraton_informe_visible(p_m));
end $$;

create or replace function public.maraton_informe_visible(p_m public.maraton_actividades) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((public.maraton_cfg(p_m.config) -> 'informes' ->> 'estudiante')::boolean, false)
     and p_m.estado <> 'borrador'
     and case when public.maraton_cfg(p_m.config) -> 'informes' ->> 'publicacion_estudiante' is not null
              then (now() at time zone (public.maraton_cfg(p_m.config) -> 'programacion' ->> 'zona'))::date
                   >= (public.maraton_cfg(p_m.config) -> 'informes' ->> 'publicacion_estudiante')::date
              else public.maraton_finalizado(p_m) end
$$;

-- -----------------------------------------------------------------------------
-- Acceso del estudiante (o del profesor en modo prueba)
-- -----------------------------------------------------------------------------
-- Devuelve la fila del maratón si p_user puede participar; prueba = true si es profesor de la sección
create or replace function public.maraton_acceso(p_maraton uuid, p_user uuid, out m public.maraton_actividades, out prueba boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  select * into m from public.maraton_actividades where id = p_maraton;
  if m.id is null or p_user is null or not public.account_ok(p_user) then
    raise exception 'No tiene acceso a este maratón' using errcode = '42501';
  end if;
  if public.is_teacher_user(p_user) and (exists (select 1 from public.class_teachers t where t.class_id = m.class_id and t.user_id = p_user)
       or exists (select 1 from public.profiles pr where pr.id = p_user and pr.role = 'admin')) then
    prueba := true; return;
  end if;
  if m.estado = 'publicado' and exists (select 1 from public.enrollments e where e.class_id = m.class_id and e.user_id = p_user
                                         and (m.group_id is null or m.group_id = e.group_id)) then
    prueba := false; return;
  end if;
  raise exception 'No tiene acceso a este maratón' using errcode = '42501';
end $$;

-- Bloquea (o crea) la inscripción de p_user
create or replace function public.maraton_inscripcion(p_m public.maraton_actividades, p_user uuid, p_prueba boolean, p_crear boolean)
returns public.maraton_inscripciones language plpgsql security definer set search_path = '' as $$
declare i public.maraton_inscripciones;
begin
  if p_crear then
    insert into public.maraton_inscripciones (maraton_id, user_id, prueba, nivel)
    values (p_m.id, p_user, p_prueba, (public.maraton_cfg(p_m.config) -> 'dificultad' ->> 'nivel_inicial')::int)
    on conflict (maraton_id, user_id) do nothing;
  end if;
  select * into i from public.maraton_inscripciones where maraton_id = p_m.id and user_id = p_user for update;
  return i;
end $$;

-- Lista de maratones publicados de mis secciones
create or replace function public.maraton_mis_maratones() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'descripcion', m.descripcion,
      'asignatura', co.title, 'jornadas', (public.maraton_cfg(m.config) -> 'programacion' ->> 'jornadas')::int,
      'fecha_inicio', m.fecha_inicio, 'hoy', public.maraton_hoy(m), 'finalizado', public.maraton_finalizado(m),
      'aceptado', i.aceptado_at is not null,
      'jornada_hoy', (select case j.estado when 'cerrada_limite' then 'cerrada' when 'pendiente' then 'sin_iniciar' else j.estado end
                        from public.maraton_jornadas j where j.inscripcion_id = i.id and j.numero = (public.maraton_hoy(m) ->> 'numero')::int),
      'informe_disponible', public.maraton_informe_visible(m)) order by m.fecha_inicio), '[]'::jsonb)
  from public.maraton_actividades m
  join public.enrollments e on e.class_id = m.class_id and e.user_id = auth.uid() and (m.group_id is null or m.group_id = e.group_id)
  join public.classes cl on cl.id = m.class_id
  join public.courses co on co.id = cl.course_id
  left join public.maraton_inscripciones i on i.maraton_id = m.id and i.user_id = auth.uid()
  where m.estado = 'publicado' and public.account_ok(auth.uid())
$$;

-- Estado actual (no presenta problemas nuevos; sí cierra jornadas vencidas)
create or replace function public.maraton_estado(p_maraton uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones;
begin
  select * into a from public.maraton_acceso(p_maraton, auth.uid());
  i := public.maraton_inscripcion(a.m, auth.uid(), a.prueba, false);
  if i.id is not null then perform public.maraton_jornada_activa(a.m, i, false); end if;
  return public.maraton_estado_json(a.m, i.id);
end $$;

-- Aceptar las condiciones / comenzar o reanudar la jornada (idempotente)
create or replace function public.maraton_iniciar(p_maraton uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; j public.maraton_jornadas; v_nueva boolean;
begin
  select * into a from public.maraton_acceso(p_maraton, auth.uid());
  if (a.m).fecha_inicio is null and not a.prueba then raise exception 'El maratón todavía no tiene fecha de inicio' using errcode = 'P0001'; end if;
  i := public.maraton_inscripcion(a.m, auth.uid(), a.prueba, true);
  v_nueva := i.aceptado_at is null;
  if v_nueva then
    update public.maraton_inscripciones set aceptado_at = now() where id = i.id returning * into i;
    perform public.maraton_log((a.m).id, auth.uid(), null, 'condiciones_aceptadas', '{}', auth.uid());
  end if;
  j := public.maraton_jornada_activa(a.m, i, true);
  if j.id is not null and j.estado = 'en_curso' then
    select * into i from public.maraton_inscripciones where id = i.id;
    if i.presentacion_actual is null then perform public.maraton_continuar(a.m, i.id, j.id); end if;
  end if;
  return public.maraton_estado_json(a.m, i.id);
end $$;

-- Comprueba que la presentación es la actual del usuario y que su jornada sigue abierta. Devuelve null si todo va bien
-- o un aviso (ya procesada, plazo terminado…) para responder con el estado vigente sin cambiar nada.
create or replace function public.maraton_previo(p_m public.maraton_actividades, i public.maraton_inscripciones, p_pres uuid, p_idem uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare x public.maraton_presentaciones; j public.maraton_jornadas; cal jsonb;
  v_gracia integer := coalesce((public.maraton_cfg(p_m.config) -> 'seguridad' ->> 'gracia_s')::int, 120);
begin
  if p_idem is null then raise exception 'Falta la clave de la operación' using errcode = '22023'; end if;
  if exists (select 1 from public.maraton_presentaciones where idem = p_idem and inscripcion_id = i.id) then return 'ya_procesada'; end if;
  if exists (select 1 from public.maraton_presentaciones where idem = p_idem) then raise exception 'Operación no válida' using errcode = '22023'; end if;
  select * into x from public.maraton_presentaciones where id = p_pres and inscripcion_id = i.id;
  if x.id is null then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  if x.cerrada_at is not null or i.presentacion_actual is distinct from x.id then return 'ya_cerrada'; end if;
  select * into j from public.maraton_jornadas where id = x.jornada_id;
  if j.estado <> 'en_curso' then return 'jornada_cerrada'; end if;
  if not i.prueba and (j.reabierta_hasta is null or j.reabierta_hasta < now()) then
    cal := public.maraton_calendario(p_m, j.numero);
    if cal is null or now() > (cal ->> 'cierra')::timestamptz + make_interval(secs => v_gracia) then
      perform public.maraton_jornada_activa(p_m, i, false);
      return 'jornada_cerrada';
    end if;
  end if;
  return null;
end $$;

-- «NO PUEDO RESOLVER ESTE EJERCICIO»: no consume comodines, no da unidades, baja un nivel, presenta otro
create or replace function public.maraton_no_puedo(p_presentacion uuid, p_idem uuid, p_segundos_cliente numeric default null, p_procedimiento text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; v_insc uuid; v_aviso text; v_j uuid;
begin
  select inscripcion_id into v_insc from public.maraton_presentaciones where id = p_presentacion;
  select * into a from public.maraton_acceso((select maraton_id from public.maraton_inscripciones where id = v_insc), auth.uid());
  i := public.maraton_inscripcion(a.m, auth.uid(), a.prueba, false);
  if i.id is distinct from v_insc then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  if not (public.maraton_cfg((a.m).config) -> 'comodines' ->> 'no_puedo')::boolean then
    raise exception 'Este maratón no admite esa opción' using errcode = 'P0001'; end if;
  v_aviso := public.maraton_previo(a.m, i, p_presentacion, p_idem);
  if v_aviso is not null then return public.maraton_estado_json(a.m, i.id, v_aviso); end if;
  select jornada_id into v_j from public.maraton_presentaciones where id = p_presentacion;
  perform public.maraton_cerrar(a.m, p_presentacion, 'no_puedo', null, null, p_procedimiento, p_segundos_cliente, p_idem, null);
  perform public.maraton_continuar(a.m, i.id, v_j);
  return public.maraton_estado_json(a.m, i.id);
end $$;

-- «CAMBIAR EJERCICIO»: consume un comodín (atómico), mismo nivel, otro problema; el retirado no vuelve
create or replace function public.maraton_cambiar(p_presentacion uuid, p_idem uuid, p_segundos_cliente numeric default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; v_insc uuid; v_aviso text; j public.maraton_jornadas; c jsonb;
begin
  select inscripcion_id into v_insc from public.maraton_presentaciones where id = p_presentacion;
  select * into a from public.maraton_acceso((select maraton_id from public.maraton_inscripciones where id = v_insc), auth.uid());
  i := public.maraton_inscripcion(a.m, auth.uid(), a.prueba, false);   -- bloqueo de fila: dos cambios simultáneos se ordenan aquí
  if i.id is distinct from v_insc then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  v_aviso := public.maraton_previo(a.m, i, p_presentacion, p_idem);
  if v_aviso is not null then return public.maraton_estado_json(a.m, i.id, v_aviso); end if;
  c := public.maraton_cfg((a.m).config);
  select * into j from public.maraton_jornadas where id = (select jornada_id from public.maraton_presentaciones where id = p_presentacion);
  if i.comodines_usados >= (c -> 'comodines' ->> 'total')::int then
    raise exception 'No le quedan comodines' using errcode = 'P0001'; end if;
  if c -> 'comodines' -> 'por_jornada' <> 'null'::jsonb and j.cambios >= (c -> 'comodines' ->> 'por_jornada')::int then
    raise exception 'Ya usó los comodines permitidos en esta jornada' using errcode = 'P0001'; end if;
  perform public.maraton_cerrar(a.m, p_presentacion, 'cambio', null, null, null, p_segundos_cliente, p_idem, null);
  perform public.maraton_continuar(a.m, i.id, j.id);
  return public.maraton_estado_json(a.m, i.id);
end $$;

-- -----------------------------------------------------------------------------
-- Funciones del servidor de calificación (Edge Function «maraton»; solo service_role)
-- -----------------------------------------------------------------------------
create or replace function public.svc_maraton_clave(p_user uuid, p_presentacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare x public.maraton_presentaciones; a record; i public.maraton_inscripciones;
begin
  select * into x from public.maraton_presentaciones where id = p_presentacion;
  if x.id is null then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  select * into i from public.maraton_inscripciones where id = x.inscripcion_id;
  if i.user_id is distinct from p_user then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  select * into a from public.maraton_acceso(i.maraton_id, p_user);
  return jsonb_build_object('abierta', x.cerrada_at is null,
    'clave', case when x.cerrada_at is null then (select k.clave from public.maraton_claves k where k.variante_id = x.variante_id) end);
end $$;

create or replace function public.svc_maraton_responder(p_user uuid, p_presentacion uuid, p_idem uuid, p_respuesta jsonb,
  p_procedimiento text, p_segundos_cliente numeric, p_correcta boolean, p_detalle jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; v_insc uuid; v_aviso text; v_j uuid;
begin
  if p_correcta is null then raise exception 'Falta el resultado' using errcode = '22023'; end if;
  select inscripcion_id, jornada_id into v_insc, v_j from public.maraton_presentaciones where id = p_presentacion;
  select * into a from public.maraton_acceso((select maraton_id from public.maraton_inscripciones where id = v_insc), p_user);
  i := public.maraton_inscripcion(a.m, p_user, a.prueba, false);
  if i.id is distinct from v_insc then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  v_aviso := public.maraton_previo(a.m, i, p_presentacion, p_idem);
  if v_aviso is not null then return public.maraton_estado_json(a.m, i.id, v_aviso); end if;
  perform public.maraton_cerrar(a.m, p_presentacion, 'respuesta', p_correcta, p_respuesta, p_procedimiento, p_segundos_cliente, p_idem, p_detalle);
  perform public.maraton_continuar(a.m, i.id, v_j);
  return public.maraton_estado_json(a.m, i.id, null, jsonb_build_object('resultado', case when p_correcta then 'correcta' else 'incorrecta' end));
end $$;

-- -----------------------------------------------------------------------------
-- Informe descriptivo del estudiante (sin notas; solo cuando el profesor lo habilita)
-- -----------------------------------------------------------------------------
create or replace function public.maraton_resumen_inscripcion(p_insc uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with pr as (select * from public.maraton_presentaciones where inscripcion_id = p_insc and cerrada_at is not null),
       jo as (select * from public.maraton_jornadas where inscripcion_id = p_insc)
  select jsonb_build_object(
    'jornadas_completadas', (select count(*) from jo where estado = 'completada'),
    'jornadas_iniciadas', (select count(*) from jo where estado <> 'pendiente'),
    'jornadas_revision', (select count(*) from jo where revision),
    'via_cuota', (select count(*) from jo where via = 'cuota'),
    'via_alternativa', (select count(*) from jo where via = 'alternativa'),
    'presentados', (select count(*) from public.maraton_presentaciones where inscripcion_id = p_insc),
    'intentos_validos', (select count(*) from pr where accion = 'respuesta'),
    'correctas', (select count(*) from pr where resultado = 'correcta'),
    'incorrectas', (select count(*) from pr where resultado = 'incorrecta'),
    'no_puedo', (select count(*) from pr where accion = 'no_puedo'),
    'cambios', (select count(*) from pr where accion = 'cambio'),
    'anticipadas', (select count(*) from pr where anticipada),
    'segundos', coalesce((select sum(segundos) from pr), 0),
    'unidades', coalesce((select sum(unidades) from pr), 0),
    'nivel_maximo', (select max(nivel) from pr),
    'nivel_maximo_correcto', (select max(nivel) from pr where resultado = 'correcta'),
    'extremos_resueltos', (select count(*) from pr where nivel = 6 and resultado = 'correcta'),
    'por_nivel', (select coalesce(jsonb_agg(jsonb_build_object('nivel', nivel, 'presentados', n, 'validos', v, 'correctas', ok,
                     'no_puedo', np, 'cambios', ca, 'segundos', s) order by nivel), '[]')
                  from (select nivel, count(*) n, count(*) filter (where accion = 'respuesta') v, count(*) filter (where resultado = 'correcta') ok,
                               count(*) filter (where accion = 'no_puedo') np, count(*) filter (where accion = 'cambio') ca, coalesce(sum(segundos), 0) s
                          from pr group by nivel) q),
    'por_tema', (select coalesce(jsonb_agg(jsonb_build_object('tema', q.tema, 'nombre', t.nombre, 'presentados', n, 'validos', v, 'correctas', ok,
                     'no_puedo', np) order by n desc), '[]')
                 from (select p.tema, count(*) n, count(*) filter (where accion = 'respuesta') v, count(*) filter (where resultado = 'correcta') ok,
                              count(*) filter (where accion = 'no_puedo') np from pr p group by p.tema) q
                 left join public.maraton_inscripciones ii on ii.id = p_insc
                 left join public.maraton_actividades m on m.id = ii.maraton_id
                 left join public.maraton_temas t on t.banco_id = m.banco_id and t.codigo = q.tema),
    'por_jornada', (select coalesce(jsonb_agg(jsonb_build_object('numero', j.numero, 'fecha', j.fecha, 'estado', j.estado, 'via', j.via,
                       'revision', j.revision, 'motivo', j.motivo_revision, 'presentados', j.presentados, 'validos', j.intentos_validos,
                       'correctas', j.correctas, 'incorrectas', j.incorrectas, 'no_puedo', j.no_puedo, 'cambios', j.cambios,
                       'anticipadas', j.anticipadas, 'segundos', j.segundos, 'unidades', j.unidades,
                       'nivel_medio', (select round(avg(nivel), 2) from pr where pr.jornada_id = j.id and accion = 'respuesta'),
                       'nivel_maximo', (select max(nivel) from pr where pr.jornada_id = j.id)) order by j.numero), '[]') from jo j))
$$;

create or replace function public.maraton_mi_informe(p_maraton uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; r jsonb;
begin
  select * into a from public.maraton_acceso(p_maraton, auth.uid());
  if not a.prueba and not public.maraton_informe_visible(a.m) then
    raise exception 'El informe estará disponible cuando el profesor lo publique' using errcode = 'P0001'; end if;
  select * into i from public.maraton_inscripciones where maraton_id = p_maraton and user_id = auth.uid();
  if i.id is null then return jsonb_build_object('participo', false); end if;
  r := public.maraton_resumen_inscripcion(i.id);
  -- el estudiante no necesita la ponderación ni las unidades internas
  return jsonb_build_object('participo', true, 'titulo', (a.m).titulo,
    'jornadas_total', (public.maraton_cfg((a.m).config) -> 'programacion' ->> 'jornadas')::int,
    'resumen', r - 'unidades' - 'via_cuota' - 'via_alternativa' - 'jornadas_revision',
    'aviso', 'Este informe describe su trabajo. No es una calificación: la decisión sobre la recuperación corresponde al profesor.');
end $$;

-- -----------------------------------------------------------------------------
-- Panel docente
-- -----------------------------------------------------------------------------
create or replace function public.maraton_docente(p_maraton uuid) returns public.maraton_actividades
language plpgsql stable security definer set search_path = '' as $$
declare m public.maraton_actividades;
begin
  select * into m from public.maraton_actividades where id = p_maraton;
  if m.id is null or not public.is_teacher() or not public.is_class_teacher(m.class_id) then
    raise exception 'Solo el profesorado de la sección' using errcode = '42501'; end if;
  return m;
end $$;

create or replace function public.maraton_banco_permitido(p_banco text, p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.maraton_bancos b join public.classes c on c.id = p_class
                  where b.id = p_banco and c.course_id = any (b.cursos))
$$;

create or replace function public.maraton_banco_docente(p_banco text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_teacher() or not exists (select 1 from public.maraton_bancos b, unnest(b.cursos) cu
                                              where b.id = p_banco and public.can_view_keys(cu)) then
    raise exception 'Solo el profesorado de la asignatura' using errcode = '42501'; end if;
end $$;

-- Recuento de variantes validadas por nivel para los temas elegidos
create or replace function public.maraton_disponibles(p_m public.maraton_actividades) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(nivel, n), '{}') from (
    select pl.nivel, count(v.id) n from public.maraton_plantillas pl
    join public.maraton_variantes v on v.plantilla_id = pl.id and v.estado = 'validada'
    where pl.banco_id = p_m.banco_id and pl.estado = 'validada' and pl.tema = any (public.maraton_temas_sel(p_m))
      and not (pl.id = any (coalesce((select array_agg(x #>> '{}') from jsonb_array_elements(public.maraton_cfg(p_m.config) -> 'contenido' -> 'excluir_plantillas') x), '{}')))
    group by pl.nivel) q
$$;

create or replace function public.maraton_revision(p_m public.maraton_actividades) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); e text[] := public.maraton_config_errores(p_m.config); w text[] := '{}';
  d jsonb := public.maraton_disponibles(p_m); k integer; v_t text;
begin
  if p_m.fecha_inicio is null then e := array_append(e, 'Falta la fecha de inicio (pendiente de configuración docente).');
  elsif p_m.fecha_inicio < (now() at time zone (c -> 'programacion' ->> 'zona'))::date and p_m.estado = 'borrador' then
    e := array_append(e, 'La fecha de inicio ya pasó.'); end if;
  if not public.maraton_banco_permitido(p_m.banco_id, p_m.class_id) then e := array_append(e, 'El banco elegido no corresponde a la asignatura de la sección.'); end if;
  if position('[PENDIENTE' in upper(p_m.instrucciones || ' ' || p_m.descripcion)) > 0 then
    e := array_append(e, 'Las instrucciones tienen apartados [PENDIENTE…] que el profesor debe completar (p. ej., los criterios de la recuperación).'); end if;
  if char_length(trim(p_m.instrucciones)) < 40 then
    w := array_append(w, 'Las instrucciones para estudiantes son muy breves: explique duración, continuidad, comodines, incidencias y criterios.'); end if;
  if cardinality(public.maraton_temas_sel(p_m)) = 0 then e := array_append(e, 'No hay temas seleccionados.'); end if;
  foreach v_t in array public.maraton_temas_sel(p_m) loop
    if not exists (select 1 from public.maraton_temas where banco_id = p_m.banco_id and codigo = v_t and estado <> 'excluido') then
      e := array_append(e, format('El tema «%s» no existe en el banco o está excluido.', v_t)); end if;
  end loop;
  for k in 1 .. least(6, greatest(2, coalesce((c -> 'dificultad' ->> 'niveles')::int, 6))) loop
    if coalesce((d ->> k::text)::int, 0) = 0 then e := array_append(e, format('No hay problemas validados de nivel D%s en los temas elegidos.', k));
    elsif (d ->> k::text)::int < 60 then w := array_append(w, format('Solo hay %s variantes validadas de nivel D%s: podrían repetirse entre estudiantes.', d ->> k::text, k)); end if;
  end loop;
  if (c -> 'carga' ->> 'alternativa_minutos')::numeric > (c -> 'carga' ->> 'limite_minutos')::numeric then
    w := array_append(w, 'La finalización alternativa pide más minutos que el límite máximo: casi nunca se aplicará.'); end if;
  return jsonb_build_object('errores', to_jsonb(e), 'avisos', to_jsonb(w), 'disponibles', d);
end $$;

create or replace function public.maraton_json_docente(p_m public.maraton_actividades) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(p_m) - 'config' || jsonb_build_object(
    'config', public.maraton_cfg(p_m.config),
    'curso_id', (select course_id from public.classes where id = p_m.class_id),
    'seccion', (select name from public.classes where id = p_m.class_id),
    'banco', (select jsonb_build_object('id', b.id, 'nombre', b.nombre, 'version', b.version) from public.maraton_bancos b where b.id = p_m.banco_id),
    'responsable_nombre', (select full_name from public.profiles where id = p_m.responsable),
    'participantes', (select count(*) from public.maraton_inscripciones where maraton_id = p_m.id and not prueba),
    'hoy', public.maraton_hoy(p_m), 'finalizado', public.maraton_finalizado(p_m),
    'revision', public.maraton_revision(p_m))
$$;

create or replace function public.maraton_lista_docente(p_class uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'Solo el profesorado de la sección' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'estado', m.estado, 'fecha_inicio', m.fecha_inicio,
      'jornadas', (public.maraton_cfg(m.config) -> 'programacion' ->> 'jornadas')::int, 'banco_id', m.banco_id,
      'participantes', (select count(*) from public.maraton_inscripciones i where i.maraton_id = m.id and not i.prueba),
      'hoy', public.maraton_hoy(m), 'created_at', m.created_at) order by m.created_at desc), '[]')
    from public.maraton_actividades m where m.class_id = p_class);
end $$;

create or replace function public.maraton_detalle_docente(p_maraton uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.maraton_json_docente(public.maraton_docente(p_maraton))
$$;

-- Bancos utilizables en una sección, con su cobertura y recuentos (sin claves)
create or replace function public.maraton_bancos_disponibles(p_class uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'Solo el profesorado de la sección' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nombre', b.nombre, 'descripcion', b.descripcion, 'version', b.version,
      'temas', (select coalesce(jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nombre', t.nombre, 'unidad', t.unidad, 'fuente', t.fuente,
                   'practicas', t.practicas, 'examenes', t.examenes, 'cobertura', t.cobertura, 'estado', t.estado,
                   'por_nivel', (select coalesce(jsonb_object_agg(q.nivel, jsonb_build_object('plantillas', q.pl, 'validadas', q.val, 'variantes', q.var)), '{}')
                                  from (select pl.nivel, count(distinct pl.id) pl, count(distinct pl.id) filter (where pl.estado = 'validada') val,
                                               count(v.id) filter (where pl.estado = 'validada' and v.estado = 'validada') var
                                          from public.maraton_plantillas pl left join public.maraton_variantes v on v.plantilla_id = pl.id
                                         where pl.banco_id = b.id and pl.tema = t.codigo group by pl.nivel) q)) order by t.orden), '[]')
                from public.maraton_temas t where t.banco_id = b.id)) order by b.nombre), '[]')
    from public.maraton_bancos b where (select course_id from public.classes where id = p_class) = any (b.cursos));
end $$;

create or replace function public.maraton_banco_plantillas(p_banco text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.maraton_banco_docente(p_banco);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', pl.id, 'tema', pl.tema, 'subtema', pl.subtema, 'nivel', pl.nivel, 'titulo', pl.titulo,
      'metodo', pl.metodo, 't_min_s', pl.t_min_s, 't_max_s', pl.t_max_s, 'etiquetas', pl.etiquetas, 'fuente', pl.fuente, 'estado', pl.estado,
      'nota_revision', pl.nota_revision, 'revisado_at', pl.revisado_at,
      'variantes', (select count(*) from public.maraton_variantes v where v.plantilla_id = pl.id and v.estado = 'validada')) order by pl.tema, pl.nivel, pl.id), '[]')
    from public.maraton_plantillas pl where pl.banco_id = p_banco);
end $$;

-- Vista previa de una plantilla (con clave y solución: solo profesorado de la asignatura)
create or replace function public.maraton_banco_muestra(p_plantilla text, p_cuantas integer default 3) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.maraton_banco_docente((select banco_id from public.maraton_plantillas where id = p_plantilla));
  return (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'n', v.n, 'enunciado', v.enunciado, 'partes', v.partes, 'datos', v.datos,
      'clave', k.clave, 'solucion', k.solucion, 'verificacion', k.verificacion, 'estado', v.estado) order by v.n), '[]')
    from (select * from public.maraton_variantes where plantilla_id = p_plantilla order by n limit greatest(1, least(coalesce(p_cuantas, 3), 50))) v
    left join public.maraton_claves k on k.variante_id = v.id);
end $$;

create or replace function public.maraton_plantilla_revisar(p_plantilla text, p_estado text, p_nota text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pl public.maraton_plantillas;
begin
  select * into pl from public.maraton_plantillas where id = p_plantilla;
  if pl.id is null then raise exception 'Plantilla inexistente' using errcode = '22023'; end if;
  perform public.maraton_banco_docente(pl.banco_id);
  if p_estado not in ('validada', 'pendiente_revision', 'rechazada') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  update public.maraton_plantillas set estado = p_estado, nota_revision = nullif(trim(coalesce(p_nota, '')), ''), revisado_por = auth.uid(), revisado_at = now()
   where id = p_plantilla returning * into pl;
  return to_jsonb(pl);
end $$;

-- Crear un maratón (siempre en BORRADOR, sin fecha salvo que se indique, sin acceso de estudiantes)
create or replace function public.maraton_crear(p_class uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_cfg jsonb; v_err text[]; v_banco text := p_datos ->> 'banco_id';
begin
  if not public.is_teacher() or not public.is_class_teacher(p_class) then raise exception 'Solo el profesorado de la sección' using errcode = '42501'; end if;
  if v_banco is null then
    select b.id into v_banco from public.maraton_bancos b join public.classes c on c.id = p_class and c.course_id = any (b.cursos) order by b.id limit 1;
  end if;
  if v_banco is null or not public.maraton_banco_permitido(v_banco, p_class) then
    raise exception 'No hay un banco de problemas para la asignatura de esta sección' using errcode = 'P0001'; end if;
  v_cfg := public.maraton_cfg(coalesce(p_datos -> 'config', '{}'));
  v_err := public.maraton_config_errores(v_cfg);
  if cardinality(v_err) > 0 then raise exception '%', array_to_string(v_err, ' ') using errcode = '22023'; end if;
  insert into public.maraton_actividades (class_id, banco_id, titulo, descripcion, instrucciones, responsable, fecha_inicio, config)
  values (p_class, v_banco, coalesce(nullif(trim(p_datos ->> 'titulo'), ''), 'Maratón adaptativo'), coalesce(p_datos ->> 'descripcion', ''),
          coalesce(p_datos ->> 'instrucciones', ''), auth.uid(), nullif(p_datos ->> 'fecha_inicio', '')::date, v_cfg)
  returning id into v_id;
  perform public.maraton_log(v_id, null, null, 'maraton_creado', jsonb_build_object('banco', v_banco));
  return v_id;
end $$;

-- Guardar cambios. Con participantes, solo se pueden cambiar los textos y la publicación del informe (para no
-- alterar las reglas a mitad del maratón).
create or replace function public.maraton_guardar(p_maraton uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); v_cfg jsonb; v_err text[]; v_part boolean; v_k text;
begin
  v_part := exists (select 1 from public.maraton_inscripciones where maraton_id = p_maraton and not prueba);
  if v_part then
    for v_k in select jsonb_object_keys(p_datos) loop
      if v_k not in ('titulo', 'descripcion', 'instrucciones', 'informes') then
        raise exception 'El maratón ya tiene participantes: solo se pueden cambiar los textos y los informes' using errcode = 'P0001'; end if;
    end loop;
  end if;
  v_cfg := m.config;
  if p_datos ? 'config' then
    v_cfg := public.maraton_cfg(m.config);
    for v_k in select jsonb_object_keys(p_datos -> 'config') loop
      v_cfg := jsonb_set(v_cfg, array[v_k], case when jsonb_typeof(v_cfg -> v_k) = 'object' and jsonb_typeof(p_datos -> 'config' -> v_k) = 'object'
                                                 then (v_cfg -> v_k) || (p_datos -> 'config' -> v_k) else p_datos -> 'config' -> v_k end);
    end loop;
  end if;
  if p_datos ? 'informes' then v_cfg := jsonb_set(public.maraton_cfg(v_cfg), '{informes}', public.maraton_cfg(v_cfg) -> 'informes' || (p_datos -> 'informes')); end if;
  v_err := public.maraton_config_errores(v_cfg);
  if cardinality(v_err) > 0 then raise exception '%', array_to_string(v_err, ' ') using errcode = '22023'; end if;
  if p_datos ? 'banco_id' and not public.maraton_banco_permitido(p_datos ->> 'banco_id', m.class_id) then
    raise exception 'El banco elegido no corresponde a la asignatura de la sección' using errcode = '22023'; end if;
  if p_datos ? 'responsable' and p_datos ->> 'responsable' is not null and not exists (
       select 1 from public.class_teachers where class_id = m.class_id and user_id = (p_datos ->> 'responsable')::uuid) then
    raise exception 'El responsable debe ser profesor de la sección' using errcode = '22023'; end if;
  if p_datos ? 'group_id' and p_datos ->> 'group_id' is not null and not exists (
       select 1 from public.class_groups where id = (p_datos ->> 'group_id')::uuid and class_id = m.class_id) then
    raise exception 'El grupo no pertenece a la sección' using errcode = '22023'; end if;
  update public.maraton_actividades set
    titulo = case when p_datos ? 'titulo' then coalesce(nullif(trim(p_datos ->> 'titulo'), ''), titulo) else titulo end,
    descripcion = case when p_datos ? 'descripcion' then coalesce(p_datos ->> 'descripcion', '') else descripcion end,
    instrucciones = case when p_datos ? 'instrucciones' then coalesce(p_datos ->> 'instrucciones', '') else instrucciones end,
    responsable = case when p_datos ? 'responsable' then (p_datos ->> 'responsable')::uuid else responsable end,
    group_id = case when p_datos ? 'group_id' then (p_datos ->> 'group_id')::uuid else group_id end,
    banco_id = case when p_datos ? 'banco_id' then p_datos ->> 'banco_id' else banco_id end,
    fecha_inicio = case when p_datos ? 'fecha_inicio' then nullif(p_datos ->> 'fecha_inicio', '')::date else fecha_inicio end,
    config = v_cfg, updated_at = now()
  where id = p_maraton returning * into m;
  perform public.maraton_log(m.id, null, null, 'configuracion_guardada', jsonb_build_object('campos', (select jsonb_agg(k) from jsonb_object_keys(p_datos) k)));
  return public.maraton_json_docente(m);
end $$;

-- Publicar (hace visible el maratón a los estudiantes de la sección). Exige que la revisión no tenga errores.
create or replace function public.maraton_cambiar_estado(p_maraton uuid, p_estado text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); r jsonb; v_part boolean;
begin
  if p_estado not in ('borrador', 'publicado', 'archivado') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  v_part := exists (select 1 from public.maraton_inscripciones where maraton_id = p_maraton and not prueba);
  if p_estado = 'publicado' then
    r := public.maraton_revision(m);
    if jsonb_array_length(r -> 'errores') > 0 then
      raise exception 'No se puede publicar: %', (select string_agg(x #>> '{}', ' ') from jsonb_array_elements(r -> 'errores') x) using errcode = 'P0001'; end if;
  elsif p_estado = 'borrador' and v_part then
    raise exception 'El maratón ya tiene participantes: no puede volver a borrador (puede archivarlo)' using errcode = 'P0001';
  end if;
  update public.maraton_actividades set estado = p_estado, updated_at = now(),
    publicado_at = case when p_estado = 'publicado' then now() else publicado_at end,
    publicado_por = case when p_estado = 'publicado' then auth.uid() else publicado_por end
  where id = p_maraton returning * into m;
  perform public.maraton_log(m.id, null, null, 'estado_' || p_estado, '{}');
  return public.maraton_json_docente(m);
end $$;

-- Duplicar: nueva instancia en borrador (misma u otra sección), sin participantes ni respuestas, sin fecha
create or replace function public.maraton_duplicar(p_maraton uuid, p_class uuid, p_titulo text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); v_id uuid; v_class uuid := coalesce(p_class, m.class_id);
begin
  if not public.is_class_teacher(v_class) then raise exception 'Solo el profesorado de la sección de destino' using errcode = '42501'; end if;
  if not public.maraton_banco_permitido(m.banco_id, v_class) then
    raise exception 'El banco de este maratón no corresponde a la asignatura de la sección de destino' using errcode = 'P0001'; end if;
  insert into public.maraton_actividades (class_id, banco_id, titulo, descripcion, instrucciones, responsable, fecha_inicio, config, origen_id)
  values (v_class, m.banco_id, coalesce(nullif(trim(p_titulo), ''), left(m.titulo || ' (copia)', 160)), m.descripcion, m.instrucciones,
          auth.uid(), null, jsonb_set(public.maraton_cfg(m.config), '{programacion,calendario}', '[]'), m.id)
  returning id into v_id;
  perform public.maraton_log(v_id, null, null, 'maraton_duplicado', jsonb_build_object('origen', m.id));
  return v_id;
end $$;

-- Reiniciar el recorrido de PRUEBA del profesor (nunca toca datos de estudiantes)
create or replace function public.maraton_reiniciar_prueba(p_maraton uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); v_insc uuid;
begin
  select id into v_insc from public.maraton_inscripciones where maraton_id = m.id and user_id = auth.uid() and prueba;
  if v_insc is null then return; end if;
  perform set_config('maraton.reinicio', 'si', true);
  delete from public.maraton_presentaciones where inscripcion_id = v_insc;
  delete from public.maraton_jornadas where inscripcion_id = v_insc;
  delete from public.maraton_inscripciones where id = v_insc and prueba;
  perform set_config('maraton.reinicio', 'no', true);
end $$;

-- Informe del profesor: una fila por estudiante (matriculados en la sección/grupo y participantes)
create or replace function public.maraton_resumen(p_maraton uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); c jsonb := public.maraton_cfg(m.config);
  n integer := (c -> 'programacion' ->> 'jornadas')::int;
begin
  return jsonb_build_object(
    'maraton', public.maraton_json_docente(m),
    'calendario', (select jsonb_agg(public.maraton_calendario(m, k) order by k) from generate_series(1, n) k),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', u.id, 'nombre', pr.full_name, 'login_id', pr.login_id,
        'matriculado', u.matriculado, 'participa', i.id is not null, 'nivel_actual', i.nivel, 'comodines_usados', i.comodines_usados,
        'aceptado_at', i.aceptado_at,
        'resumen', case when i.id is not null then public.maraton_resumen_inscripcion(i.id) end) order by pr.full_name), '[]')
      from (select e.user_id as id, true as matriculado from public.enrollments e
             where e.class_id = m.class_id and (m.group_id is null or m.group_id = e.group_id)
               and not exists (select 1 from public.profiles p2 where p2.id = e.user_id and p2.role <> 'student')
            union
            select ii.user_id, false from public.maraton_inscripciones ii
             where ii.maraton_id = m.id and not ii.prueba
               and not exists (select 1 from public.enrollments e2 where e2.class_id = m.class_id and e2.user_id = ii.user_id)) u
      join public.profiles pr on pr.id = u.id
      left join public.maraton_inscripciones i on i.maraton_id = m.id and i.user_id = u.id and not i.prueba));
end $$;

-- Historial forense de un estudiante: cada problema, decisión, tiempos, nivel antes/después y comodines
create or replace function public.maraton_historial(p_maraton uuid, p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); i public.maraton_inscripciones;
begin
  select * into i from public.maraton_inscripciones where maraton_id = m.id and user_id = p_user;
  return jsonb_build_object(
    'estudiante', (select jsonb_build_object('user_id', id, 'nombre', full_name, 'login_id', login_id) from public.profiles where id = p_user),
    'inscripcion', case when i.id is not null then jsonb_build_object('nivel', i.nivel, 'comodines_usados', i.comodines_usados, 'aceptado_at', i.aceptado_at,
                     'prueba', i.prueba, 'resumen', public.maraton_resumen_inscripcion(i.id)) end,
    'presentaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'secuencia', x.secuencia, 'jornada', j.numero,
        'variante_id', x.variante_id, 'plantilla_id', x.plantilla_id, 'tema', x.tema, 'subtema', pl.subtema, 'titulo', pl.titulo, 'nivel', x.nivel,
        't_min_s', x.t_min_s, 't_max_s', x.t_max_s, 'peso', x.peso, 'presentada_at', x.presentada_at, 'cerrada_at', x.cerrada_at,
        'accion', x.accion, 'resultado', x.resultado, 'respuesta', x.respuesta, 'procedimiento', x.procedimiento, 'detalle', x.detalle,
        'segundos', x.segundos, 'segundos_cliente', x.segundos_cliente, 'anticipada', x.anticipada, 'unidades', x.unidades,
        'nivel_despues', x.nivel_despues, 'comodines_antes', x.comodines_antes, 'comodines_despues', x.comodines_despues,
        'enunciado', v.enunciado, 'partes', v.partes, 'clave', k.clave) order by x.secuencia), '[]')
      from public.maraton_presentaciones x join public.maraton_jornadas j on j.id = x.jornada_id
      join public.maraton_variantes v on v.id = x.variante_id join public.maraton_plantillas pl on pl.id = x.plantilla_id
      left join public.maraton_claves k on k.variante_id = x.variante_id
      where x.inscripcion_id = i.id),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('tipo', e.tipo, 'jornada', e.jornada, 'datos', e.datos, 'actor', e.actor, 'created_at', e.created_at)
                  order by e.id), '[]') from public.maraton_eventos e where e.maraton_id = m.id and e.user_id = p_user),
    'incidencias', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.maraton_incidencias x
                     where x.maraton_id = m.id and x.user_id = p_user));
end $$;

-- Datos de toda la sección para exportar (una fila por problema presentado). Sin claves.
create or replace function public.maraton_exportar(p_maraton uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('login_id', pr.login_id, 'nombre', pr.full_name, 'jornada', j.numero, 'fecha', j.fecha,
      'secuencia', x.secuencia, 'variante_id', x.variante_id, 'plantilla_id', x.plantilla_id, 'tema', x.tema, 'nivel', x.nivel,
      'presentada_at', x.presentada_at, 'cerrada_at', x.cerrada_at, 'accion', x.accion, 'resultado', x.resultado,
      'respuesta', x.respuesta -> 'partes', 'segundos', x.segundos, 'anticipada', x.anticipada, 'unidades', x.unidades,
      'nivel_despues', x.nivel_despues, 'comodines_despues', x.comodines_despues) order by pr.full_name, x.secuencia), '[]')
    from public.maraton_presentaciones x join public.maraton_inscripciones i on i.id = x.inscripcion_id and not i.prueba
    join public.maraton_jornadas j on j.id = x.jornada_id join public.profiles pr on pr.id = i.user_id
    where i.maraton_id = m.id);
end $$;

-- Incidencias auditables: reabrir una jornada (con plazo), justificarla o dejar una nota
create or replace function public.maraton_incidencia(p_maraton uuid, p_user uuid, p_jornada integer, p_tipo text, p_motivo text, p_hasta timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); i public.maraton_inscripciones; j public.maraton_jornadas;
  n integer := (public.maraton_cfg(m.config) -> 'programacion' ->> 'jornadas')::int; cal jsonb;
begin
  if p_tipo not in ('reapertura', 'justificacion', 'nota') then raise exception 'Tipo de incidencia no válido' using errcode = '22023'; end if;
  if coalesce(char_length(trim(p_motivo)), 0) < 3 then raise exception 'Escriba el motivo' using errcode = '22023'; end if;
  if p_jornada not between 1 and n then raise exception 'Jornada fuera del maratón' using errcode = '22023'; end if;
  if not exists (select 1 from public.enrollments where class_id = m.class_id and user_id = p_user)
     and not exists (select 1 from public.maraton_inscripciones where maraton_id = m.id and user_id = p_user) then
    raise exception 'El estudiante no pertenece a esta sección' using errcode = '22023'; end if;
  if p_tipo in ('reapertura', 'justificacion') then
    if m.estado <> 'publicado' then raise exception 'Solo en un maratón publicado' using errcode = 'P0001'; end if;
    cal := public.maraton_calendario(m, p_jornada);
    i := public.maraton_inscripcion(m, p_user, false, true);
    select * into j from public.maraton_jornadas where inscripcion_id = i.id and numero = p_jornada for update;
    if j.estado in ('completada', 'cerrada_limite') then raise exception 'Esa jornada ya terminó (%): no se puede reabrir ni justificar', j.estado using errcode = 'P0001'; end if;
    if p_tipo = 'reapertura' then
      if p_hasta is null or p_hasta <= now() or p_hasta > now() + interval '14 days' then
        raise exception 'Indique un plazo futuro (máximo 14 días)' using errcode = '22023'; end if;
      if j.id is null then
        insert into public.maraton_jornadas (inscripcion_id, maraton_id, numero, fecha, estado, reabierta_hasta)
        values (i.id, m.id, p_jornada, (cal ->> 'fecha')::date, 'pendiente', p_hasta);
      else
        update public.maraton_jornadas set reabierta_hasta = p_hasta where id = j.id;
      end if;
    else
      if j.id is null then
        insert into public.maraton_jornadas (inscripcion_id, maraton_id, numero, fecha, estado, cerrada_at)
        values (i.id, m.id, p_jornada, (cal ->> 'fecha')::date, 'justificada', now());
      else
        if j.estado = 'en_curso' then perform public.maraton_cerrar_jornada(i.id, j.id, 'justificada', p_motivo);
        else update public.maraton_jornadas set estado = 'justificada', reabierta_hasta = null, cerrada_at = coalesce(cerrada_at, now()) where id = j.id; end if;
      end if;
    end if;
  end if;
  insert into public.maraton_incidencias (maraton_id, user_id, jornada, tipo, motivo, reabierta_hasta)
  values (m.id, p_user, p_jornada, p_tipo, trim(p_motivo), case when p_tipo = 'reapertura' then p_hasta end);
  perform public.maraton_log(m.id, p_user, p_jornada, 'incidencia_' || p_tipo, jsonb_build_object('motivo', trim(p_motivo), 'hasta', p_hasta));
  return public.maraton_historial(p_maraton, p_user);
end $$;

-- -----------------------------------------------------------------------------
-- Permisos: nadie lee las tablas directamente; anon no recibe nada
-- -----------------------------------------------------------------------------
revoke all on table public.maraton_bancos, public.maraton_temas, public.maraton_plantillas, public.maraton_variantes, public.maraton_claves,
  public.maraton_actividades, public.maraton_inscripciones, public.maraton_jornadas, public.maraton_presentaciones,
  public.maraton_eventos, public.maraton_incidencias from public, anon, authenticated;
grant all on table public.maraton_bancos, public.maraton_temas, public.maraton_plantillas, public.maraton_variantes, public.maraton_claves,
  public.maraton_actividades, public.maraton_inscripciones, public.maraton_jornadas, public.maraton_presentaciones,
  public.maraton_eventos, public.maraton_incidencias to service_role;

do $$ declare f text; begin
  -- internas: nadie salvo las propias funciones (security definer)
  foreach f in array array['maraton_es_prueba(uuid)', 'maraton_presentacion_inmutable()', 'maraton_solo_anadir()', 'maraton_defaults()',
    'maraton_cfg(jsonb)', 'maraton_config_errores(jsonb)', 'maraton_temas_sel(public.maraton_actividades)',
    'maraton_calendario(public.maraton_actividades, integer)', 'maraton_hoy(public.maraton_actividades)', 'maraton_finalizado(public.maraton_actividades)',
    'maraton_log(uuid, uuid, integer, text, jsonb, uuid)', 'maraton_cerrar_jornada(uuid, uuid, text, text)',
    'maraton_jornada_activa(public.maraton_actividades, public.maraton_inscripciones, boolean)',
    'maraton_presentar(public.maraton_actividades, uuid, uuid)', 'maraton_continuar(public.maraton_actividades, uuid, uuid)',
    'maraton_cerrar(public.maraton_actividades, uuid, text, boolean, jsonb, text, numeric, uuid, jsonb)',
    'maraton_estado_json(public.maraton_actividades, uuid, text, jsonb)', 'maraton_informe_visible(public.maraton_actividades)',
    'maraton_acceso(uuid, uuid)', 'maraton_inscripcion(public.maraton_actividades, uuid, boolean, boolean)',
    'maraton_previo(public.maraton_actividades, public.maraton_inscripciones, uuid, uuid)', 'maraton_resumen_inscripcion(uuid)',
    'maraton_docente(uuid)', 'maraton_banco_permitido(text, uuid)', 'maraton_banco_docente(text)',
    'maraton_disponibles(public.maraton_actividades)', 'maraton_revision(public.maraton_actividades)', 'maraton_json_docente(public.maraton_actividades)',
    'svc_maraton_clave(uuid, uuid)', 'svc_maraton_responder(uuid, uuid, uuid, jsonb, text, numeric, boolean, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['svc_maraton_clave(uuid, uuid)', 'svc_maraton_responder(uuid, uuid, uuid, jsonb, text, numeric, boolean, jsonb)'] loop
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  -- llamables con sesión (cada una comprueba quién llama)
  foreach f in array array['maraton_mis_maratones()', 'maraton_estado(uuid)', 'maraton_iniciar(uuid)',
    'maraton_no_puedo(uuid, uuid, numeric, text)', 'maraton_cambiar(uuid, uuid, numeric)', 'maraton_mi_informe(uuid)',
    'maraton_lista_docente(uuid)', 'maraton_detalle_docente(uuid)', 'maraton_bancos_disponibles(uuid)', 'maraton_banco_plantillas(text)',
    'maraton_banco_muestra(text, integer)', 'maraton_plantilla_revisar(text, text, text)', 'maraton_crear(uuid, jsonb)',
    'maraton_guardar(uuid, jsonb)', 'maraton_cambiar_estado(uuid, text)', 'maraton_duplicar(uuid, uuid, text)',
    'maraton_reiniciar_prueba(uuid)', 'maraton_resumen(uuid)', 'maraton_historial(uuid, uuid)', 'maraton_exportar(uuid)',
    'maraton_incidencia(uuid, uuid, integer, text, text, timestamptz)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
