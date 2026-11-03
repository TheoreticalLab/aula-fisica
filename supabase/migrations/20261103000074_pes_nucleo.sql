-- =============================================================================
-- Migración 74 · PRÁCTICA EXTRAORDINARIA SECUENCIAL (PES) · núcleo. Solo añade: tablas nuevas y funciones.
-- Las prácticas ordinarias, el motor de examen, el Registro de Calificaciones y Orbe Control no cambian.
--
-- Principios:
--  · El contenido de una PES es PRIVADO: se copia del banco (o se redacta) a tablas sin ningún permiso de lectura por
--    REST. El estudiante solo recibe, por función, EL apartado abierto; nunca los futuros, las claves ni las rúbricas.
--  · El servidor es la única autoridad: qué apartado está abierto, cuándo se reveló (now() del servidor), si se
--    alcanzó el tiempo mínimo y qué factor corresponde. El navegador no envía tiempos ni estados.
--  · Cada transición bloquea la fila del estado (FOR UPDATE), comprueba que el apartado enviado sea el abierto y lleva
--    clave de idempotencia: un reenvío devuelve el mismo resultado; dos solicitudes simultáneas no saltan estados.
--  · Respuestas confirmadas, anticipadas u omitidas son definitivas; el diario de eventos es de solo inserción.
--  · Publicar congela la configuración evaluativa (los cambios posteriores están bloqueados).
--  · Contenido coherente: un ejercicio es un problema por etapas REAL del banco (3 a 5 etapas consecutivas), una
--    composición docente con situación común escrita por el profesor, o apartados redactados. Nunca se trocea ni se
--    agrupa automáticamente preguntas sueltas.
--  · Adaptaciones separadas: «tiempo adicional» amplía el plazo personal; «factor de espera» solo puede REDUCIR la
--    espera mínima (≤ 1). Una adaptación nunca alarga la espera.
--  · Calificación: S = Σ w·q;  P_base = P_max·(S/N)^α;  F = Σ w·q·m / S;  P = P_base·F  (0 si S = 0; ≤ P_max).
--    Provisional (todo lo calificado; pendiente = 0), validada (solo lo validado por el profesor) y máxima alcanzable.
--    Es INFORMATIVA: no entra en el Registro de Calificaciones. Espejo en src/lib/pes.ts.
--  · El avance anticipado es una regla académica explícita, no un detector de IA.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.pes_practicas (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  descripcion text not null default '' check (char_length(descripcion) <= 4000),
  instrucciones text not null default '' check (char_length(instrucciones) <= 8000),
  estado text not null default 'borrador' check (estado in ('borrador', 'publicada', 'cerrada', 'archivada')),
  abre_at timestamptz,
  cierra_at timestamptz,
  p_max numeric(6, 3) not null default 8 check (p_max > 0 and p_max <= 100),
  alfa numeric(4, 2) not null default 2 check (alfa >= 1 and alfa <= 4),
  factor_anticipado numeric(4, 3) not null default 0.5 check (factor_anticipado >= 0 and factor_anticipado <= 1),
  incremento numeric(4, 3) not null default 0.2 check (incremento >= 0 and incremento <= 2),
  -- liberación por bloques: [{"desde": "2026-11-10", "ejercicios": 20}, …] (acumulado); vacío = todos desde el inicio
  liberacion jsonb not null default '[]'::jsonb check (jsonb_typeof(liberacion) = 'array'),
  -- control presencial de comprensión (migración 75), definido y comunicado ANTES de publicar:
  -- informativo (no cambia la puntuación) o ajuste P × [1 − w·(1 − C)] con w ≤ 0.3 y C el resultado más favorable
  control_politica jsonb not null default '{"modo": "informativo", "peso": 0, "descripcion": ""}'::jsonb
    check (jsonb_typeof(control_politica) = 'object' and control_politica ->> 'modo' in ('informativo', 'ajuste')
           and coalesce((control_politica ->> 'peso')::numeric, 0) between 0 and 0.3
           and char_length(coalesce(control_politica ->> 'descripcion', '')) <= 2000),
  todos_los_estudiantes boolean not null default true,
  version integer not null default 0,
  publicada_at timestamptz,
  resultados_publicados boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cierra_at is null or abre_at is null or cierra_at > abre_at)
);
create index if not exists pes_practicas_class_idx on public.pes_practicas (class_id);

create table if not exists public.pes_ejercicios (
  id uuid primary key default gen_random_uuid(),
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  posicion integer not null check (posicion >= 1),
  titulo text not null default '' check (char_length(titulo) <= 200),
  contexto text not null default '' check (char_length(contexto) <= 8000),     -- se muestra con cada apartado
  origen text not null default 'redactado' check (origen in ('problema_banco', 'composicion_docente', 'redactado')),
  origen_ref text check (origen_ref is null or char_length(origen_ref) <= 200),
  unique (practica_id, posicion) deferrable initially deferred
);

create table if not exists public.pes_apartados (
  id uuid primary key default gen_random_uuid(),
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  ejercicio_id uuid not null references public.pes_ejercicios (id) on delete cascade,
  posicion integer not null check (posicion between 1 and 5),
  etapa text not null default 'otra' check (etapa in ('prediccion', 'formulacion', 'resolucion', 'interpretacion', 'transferencia', 'otra')),
  enunciado text not null check (char_length(btrim(enunciado)) between 1 and 8000),
  formato public.exercise_format not null,
  opciones jsonb check (opciones is null or jsonb_typeof(opciones) = 'array'),
  multiple boolean not null default false,
  unidad_sugerida text check (unidad_sugerida is null or char_length(unidad_sugerida) <= 40),
  figura jsonb,
  peso numeric(6, 5) not null check (peso > 0 and peso <= 1),
  t_ref_s integer not null check (t_ref_s between 10 and 7200),
  origen_exercise_id uuid references public.exercises (id) on delete set null,
  unique (ejercicio_id, posicion) deferrable initially deferred
);
create index if not exists pes_apartados_practica_idx on public.pes_apartados (practica_id);

-- claves y rúbricas: SOLO el servidor (la función «calificar») y el profesorado por funciones
create table if not exists public.pes_claves (
  apartado_id uuid primary key references public.pes_apartados (id) on delete cascade,
  clave jsonb,                                         -- AnswerKey del motor de calificación (null = revisión manual)
  rubrica text not null default '' check (char_length(rubrica) <= 4000),
  explicacion text not null default '' check (char_length(explicacion) <= 8000)
);

create table if not exists public.pes_asignaciones (
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  semilla uuid not null default gen_random_uuid(),     -- variantes individuales reproducibles
  -- adaptaciones autorizadas, SEPARADAS: el tiempo adicional amplía el plazo; el factor de espera solo reduce la espera
  tiempo_extra_min integer not null default 0 check (tiempo_extra_min between 0 and 20160),
  factor_espera numeric(3, 2) not null default 1 check (factor_espera between 0 and 1),
  pegado_permitido boolean not null default false,    -- tecnologías de asistencia / dictado
  nota_adaptacion text check (nota_adaptacion is null or char_length(nota_adaptacion) <= 500),
  -- asignación de prueba del profesorado (simulador docente, migración 75): no cuenta en listas, puntuaciones ni monitor
  prueba boolean not null default false,
  version integer not null,
  aceptado_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (practica_id, user_id)
);

create table if not exists public.pes_estado (
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  estado text not null default 'no_iniciada' check (estado in ('no_iniciada', 'apartado_abierto', 'esperando_liberacion', 'completada', 'vencida')),
  apartado_id uuid references public.pes_apartados (id) on delete set null,
  revelado_at timestamptz,                             -- el tiempo empieza cuando el servidor entrega el apartado
  borrador text check (borrador is null or char_length(borrador) <= 20000),
  borrador_rev integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (practica_id, user_id)
);

create table if not exists public.pes_respuestas (
  id uuid primary key default gen_random_uuid(),
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  apartado_id uuid not null references public.pes_apartados (id) on delete cascade,
  accion text not null check (accion in ('confirmada', 'anticipada', 'omitida')),
  respuesta jsonb,
  revelado_at timestamptz not null,
  cerrado_at timestamptz not null default now(),
  segundos numeric(10, 2) not null,
  t_min_s numeric(10, 2) not null,
  m numeric(4, 3) not null check (m >= 0 and m <= 1),
  q numeric(6, 5) not null default 0 check (q >= 0 and q <= 1),
  revision text not null default 'auto' check (revision in ('auto', 'pendiente', 'revisada')),
  resultado jsonb,
  idem uuid not null unique,
  validada boolean not null default false,             -- el profesor dio por buena la calificación
  validada_por uuid references public.profiles (id) on delete set null,
  validada_at timestamptz,
  revisado_por uuid references public.profiles (id) on delete set null,
  revisado_at timestamptz,
  nota_revision text check (nota_revision is null or char_length(nota_revision) <= 2000),
  unique (practica_id, user_id, apartado_id),
  check (revision <> 'pendiente' or not validada)
);
-- búsquedas por apartado (puntuación, monitor, avance): sin este índice cada consulta recorrería toda la tabla
create index if not exists pes_respuestas_apartado_idx on public.pes_respuestas (apartado_id, user_id);

-- controles presenciales de comprensión (se gestionan con las funciones de la migración 75)
create table if not exists public.pes_controles (
  id uuid primary key default gen_random_uuid(),
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  ejercicio_id uuid not null references public.pes_ejercicios (id) on delete cascade,
  semilla uuid not null default gen_random_uuid(),     -- números nuevos para las variantes del ejercicio equivalente
  propuesta jsonb not null default '{}'::jsonb,
  estado text not null default 'preparado' check (estado in ('preparado', 'realizado', 'anulado')),
  resultado numeric(4, 3) check (resultado is null or (resultado >= 0 and resultado <= 1)),
  nota text check (nota is null or char_length(nota) <= 2000),
  preparado_por uuid references public.profiles (id) on delete set null,
  preparado_at timestamptz not null default now(),
  cerrado_por uuid references public.profiles (id) on delete set null,
  cerrado_at timestamptz,
  check (estado <> 'realizado' or resultado is not null)      -- un control anulado conserva su resultado (auditoría)
);
create index if not exists pes_controles_idx on public.pes_controles (practica_id, user_id);

create table if not exists public.pes_eventos (
  id bigint generated always as identity primary key,
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  apartado_id uuid references public.pes_apartados (id) on delete set null,
  tipo text not null check (tipo ~ '^[a-z_]{2,40}$'),
  detalle jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists pes_eventos_idx on public.pes_eventos (practica_id, user_id, at);

do $$ declare t text; begin
  foreach t in array array['pes_practicas', 'pes_ejercicios', 'pes_apartados', 'pes_claves', 'pes_asignaciones', 'pes_estado', 'pes_respuestas', 'pes_controles', 'pes_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- diario inmutable
create or replace function public.pes_eventos_inmutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'El diario de la PES no se modifica' using errcode = '42501'; end $$;
drop trigger if exists pes_eventos_inmutable on public.pes_eventos;
create trigger pes_eventos_inmutable before update on public.pes_eventos for each row execute function public.pes_eventos_inmutable();
-- borrar solo en cascada (borrador eliminado, sección o cuenta borradas), nunca directamente
drop trigger if exists pes_eventos_sin_borrado on public.pes_eventos;
create trigger pes_eventos_sin_borrado before delete on public.pes_eventos for each row
  when (pg_trigger_depth() = 0) execute function public.pes_eventos_inmutable();

-- una respuesta cerrada no se modifica (salvo la revisión y la validación docentes: q, revisión, validación, nota)
create or replace function public.pes_respuesta_cerrada() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.accion is distinct from old.accion or new.respuesta is distinct from old.respuesta or new.revelado_at is distinct from old.revelado_at
     or new.cerrado_at is distinct from old.cerrado_at or new.segundos is distinct from old.segundos or new.m is distinct from old.m
     or new.t_min_s is distinct from old.t_min_s or new.resultado is distinct from old.resultado
     or new.apartado_id is distinct from old.apartado_id or new.user_id is distinct from old.user_id or new.idem is distinct from old.idem then
    raise exception 'Una respuesta confirmada es definitiva' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists pes_respuesta_cerrada on public.pes_respuestas;
create trigger pes_respuesta_cerrada before update on public.pes_respuestas for each row execute function public.pes_respuesta_cerrada();
create or replace function public.pes_respuesta_sin_borrado() returns trigger language plpgsql set search_path = '' as $$
begin
  -- las del simulador docente (asignación de prueba) se pueden reiniciar
  if exists (select 1 from public.pes_asignaciones s where s.practica_id = old.practica_id and s.user_id = old.user_id and s.prueba) then return old; end if;
  raise exception 'Una respuesta confirmada es definitiva' using errcode = '42501';
end $$;
drop trigger if exists pes_respuesta_sin_borrado on public.pes_respuestas;
-- solo se borran en cascada (al borrar la cuenta o la sección, como el resto de los datos del estudiante) o en el simulador
create trigger pes_respuesta_sin_borrado before delete on public.pes_respuestas for each row
  when (pg_trigger_depth() = 0) execute function public.pes_respuesta_sin_borrado();

-- publicada = configuración evaluativa congelada
create or replace function public.pes_congelada() returns trigger language plpgsql set search_path = '' as $$
declare v_p uuid := case when tg_op = 'DELETE' then old.practica_id else new.practica_id end;
begin
  if exists (select 1 from public.pes_practicas p where p.id = v_p and p.estado <> 'borrador') then
    raise exception 'La práctica ya está publicada: su contenido y su calificación no se modifican' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists pes_ejercicios_congelada on public.pes_ejercicios;
create trigger pes_ejercicios_congelada before insert or update or delete on public.pes_ejercicios for each row execute function public.pes_congelada();
drop trigger if exists pes_apartados_congelada on public.pes_apartados;
create trigger pes_apartados_congelada before insert or update or delete on public.pes_apartados for each row execute function public.pes_congelada();
create or replace function public.pes_claves_congelada() returns trigger language plpgsql set search_path = '' as $$
declare v_a uuid := case when tg_op = 'DELETE' then old.apartado_id else new.apartado_id end;
begin
  if exists (select 1 from public.pes_apartados a join public.pes_practicas p on p.id = a.practica_id where a.id = v_a and p.estado <> 'borrador') then
    raise exception 'La práctica ya está publicada: sus claves no se modifican' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists pes_claves_congelada on public.pes_claves;
create trigger pes_claves_congelada before insert or update or delete on public.pes_claves for each row execute function public.pes_claves_congelada();
create or replace function public.pes_parametros_congelados() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.estado <> 'borrador' and (new.p_max, new.alfa, new.factor_anticipado, new.incremento, new.liberacion, new.class_id, new.course_id, new.abre_at, new.control_politica)
       is distinct from (old.p_max, old.alfa, old.factor_anticipado, old.incremento, old.liberacion, old.class_id, old.course_id, old.abre_at, old.control_politica) then
    raise exception 'La práctica ya está publicada: sus parámetros de calificación, la apertura, la liberación y la política de control no se modifican' using errcode = 'P0001';
  end if;
  -- la fecha límite general solo se puede AMPLIAR (nunca acortar el plazo de quien ya trabaja)
  if old.estado <> 'borrador' and (new.cierra_at is null or new.cierra_at < old.cierra_at) then
    raise exception 'La fecha límite de una práctica publicada solo se puede ampliar' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists pes_parametros_congelados on public.pes_practicas;
create trigger pes_parametros_congelados before update on public.pes_practicas for each row execute function public.pes_parametros_congelados();

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------
create or replace function public.pes_docente(p_practica uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.is_class_teacher(p.class_id) or public.is_course_staff(p.course_id) from public.pes_practicas p where p.id = p_practica), false)
$$;

create or replace function public.pes_log(p_practica uuid, p_user uuid, p_apartado uuid, p_tipo text, p_detalle jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.pes_eventos (practica_id, user_id, apartado_id, tipo, detalle) values (p_practica, p_user, p_apartado, p_tipo, coalesce(p_detalle, '{}'::jsonb))
$$;

-- espera mínima de un apartado para un estudiante: (1 + incremento)·T_ref·factor de espera (≤ 1: nunca la alarga)
create or replace function public.pes_t_min(p_apartado uuid, p_user uuid) returns numeric language sql stable security definer set search_path = '' as $$
  select round((1 + p.incremento) * a.t_ref_s * coalesce(s.factor_espera, 1), 2)
  from public.pes_apartados a join public.pes_practicas p on p.id = a.practica_id
  left join public.pes_asignaciones s on s.practica_id = a.practica_id and s.user_id = p_user
  where a.id = p_apartado
$$;

-- plazo personal: la fecha límite más el tiempo adicional autorizado
create or replace function public.pes_cierre(p_practica uuid, p_user uuid) returns timestamptz language sql stable security definer set search_path = '' as $$
  select p.cierra_at + make_interval(mins => coalesce(s.tiempo_extra_min, 0))
  from public.pes_practicas p left join public.pes_asignaciones s on s.practica_id = p.id and s.user_id = p_user
  where p.id = p_practica
$$;

-- ejercicios liberados hasta ahora (liberación por bloques; sin bloques = todos)
create or replace function public.pes_liberados(p_practica uuid) returns integer language sql stable security definer set search_path = '' as $$
  select case when jsonb_array_length(p.liberacion) = 0 then 2147483647
    else coalesce((select max((b ->> 'ejercicios')::integer) from jsonb_array_elements(p.liberacion) b
                   where (b ->> 'desde')::date <= (now() at time zone 'America/Santo_Domingo')::date), 0) end
  from public.pes_practicas p where p.id = p_practica
$$;

-- siguiente apartado después de p_actual (null = primero), en orden de ejercicio y de apartado
create or replace function public.pes_siguiente(p_practica uuid, p_actual uuid) returns public.pes_apartados language sql stable security definer set search_path = '' as $$
  with orden as (
    select a.*, e.posicion pe from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id where a.practica_id = p_practica
  ), act as (select pe, posicion from orden where id = p_actual)
  select o.id, o.practica_id, o.ejercicio_id, o.posicion, o.etapa, o.enunciado, o.formato, o.opciones, o.multiple, o.unidad_sugerida, o.figura, o.peso, o.t_ref_s, o.origen_exercise_id
  from orden o
  where p_actual is null or (o.pe, o.posicion) > (select pe, posicion from act)
  order by o.pe, o.posicion limit 1
$$;

-- coloca el estado en el siguiente apartado (o completada / esperando liberación). Requiere la fila bloqueada.
create or replace function public.pes_avanzar(p_practica uuid, p_user uuid, p_desde uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v public.pes_apartados; v_pos integer;
begin
  v := public.pes_siguiente(p_practica, p_desde);
  if v.id is null then
    update public.pes_estado set estado = 'completada', apartado_id = null, revelado_at = null, borrador = null, updated_at = now()
      where practica_id = p_practica and user_id = p_user;
    perform public.pes_log(p_practica, p_user, null, 'practica_completada');
    return;
  end if;
  select posicion into v_pos from public.pes_ejercicios where id = v.ejercicio_id;
  update public.pes_estado set apartado_id = v.id, revelado_at = null, borrador = null, borrador_rev = 0, updated_at = now(),
    estado = case when v_pos > public.pes_liberados(p_practica) then 'esperando_liberacion' else 'apartado_abierto' end
    where practica_id = p_practica and user_id = p_user;
end $$;

-- vence el trabajo del estudiante si pasó su plazo personal. Requiere la fila bloqueada. Devuelve el estado vigente.
create or replace function public.pes_vencer(p_practica uuid, p_user uuid) returns text language plpgsql security definer set search_path = '' as $$
declare s public.pes_estado; v_cierre timestamptz := public.pes_cierre(p_practica, p_user);
begin
  select * into s from public.pes_estado where practica_id = p_practica and user_id = p_user;
  if s.estado in ('no_iniciada', 'apartado_abierto', 'esperando_liberacion') and v_cierre is not null and now() >= v_cierre then
    update public.pes_estado set estado = 'vencida', updated_at = now() where practica_id = p_practica and user_id = p_user;
    perform public.pes_log(p_practica, p_user, s.apartado_id, 'practica_vencida');
    return 'vencida';
  end if;
  return s.estado;
end $$;

-- ¿Puede este usuario trabajar en la práctica ahora? (devuelve la práctica; lanza si no)
create or replace function public.pes_practica_activa(p_practica uuid, p_user uuid) returns public.pes_practicas language plpgsql stable security definer set search_path = '' as $$
declare p public.pes_practicas; v_prueba boolean;
begin
  select * into p from public.pes_practicas where id = p_practica;
  select s.prueba into v_prueba from public.pes_asignaciones s where s.practica_id = p_practica and s.user_id = p_user;
  -- simulador docente: el profesorado de la sección recorre su asignación de prueba, también en borrador
  if v_prueba and public.clase_es_docente(p.class_id, p_user) then
    if p.estado not in ('borrador', 'publicada') then raise exception 'La práctica no está abierta' using errcode = 'P0001'; end if;
    return p;
  end if;
  if p.id is null or p_user is null or not public.account_ok(p_user) or v_prueba is null or v_prueba
     or not exists (select 1 from public.enrollments e where e.class_id = p.class_id and e.user_id = p_user) then
    raise exception 'No tiene asignada esta práctica' using errcode = '42501'; end if;
  if p.estado <> 'publicada' then raise exception 'La práctica no está abierta' using errcode = 'P0001'; end if;
  if p.abre_at is not null and now() < p.abre_at then raise exception 'La práctica todavía no ha comenzado' using errcode = 'P0001'; end if;
  return p;
end $$;

-- Lo que ve el estudiante: SOLO el apartado abierto (sin clave ni rúbrica). Revela (pone en marcha el tiempo) la
-- primera vez que se entrega. Llamar con la fila del estado bloqueada.
create or replace function public.pes_actual_json(p_practica uuid, p_user uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.pes_estado; a public.pes_apartados; e public.pes_ejercicios; p public.pes_practicas; v_n integer; v_tmin numeric; v_sig date;
  v_cierre timestamptz := public.pes_cierre(p_practica, p_user); v_base jsonb;
begin
  select * into p from public.pes_practicas where id = p_practica;
  perform public.pes_vencer(p_practica, p_user);
  select * into s from public.pes_estado where practica_id = p_practica and user_id = p_user;
  select count(*) into v_n from public.pes_ejercicios where practica_id = p_practica;
  v_base := jsonb_build_object('ejercicios', v_n, 'ahora', now(), 'cierre', v_cierre,
    'cerrados', (select count(*) from public.pes_respuestas r where r.practica_id = p_practica and r.user_id = p_user),
    'apartados_total', (select count(*) from public.pes_apartados x where x.practica_id = p_practica));
  if s.estado is null or s.estado = 'no_iniciada' then return v_base || jsonb_build_object('estado', 'no_iniciada'); end if;
  if s.estado = 'esperando_liberacion' then
    select * into a from public.pes_apartados where id = s.apartado_id;
    select * into e from public.pes_ejercicios where id = a.ejercicio_id;
    if e.posicion <= public.pes_liberados(p_practica) then
      update public.pes_estado set estado = 'apartado_abierto', updated_at = now() where practica_id = p_practica and user_id = p_user;
      s.estado := 'apartado_abierto';
    else
      select min((b ->> 'desde')::date) into v_sig from jsonb_array_elements(p.liberacion) b where (b ->> 'ejercicios')::integer >= e.posicion;
      return v_base || jsonb_build_object('estado', 'esperando_liberacion', 'proximo_ejercicio', e.posicion, 'disponible_desde', v_sig);
    end if;
  end if;
  if s.estado <> 'apartado_abierto' then return v_base || jsonb_build_object('estado', s.estado); end if;
  select * into a from public.pes_apartados where id = s.apartado_id;
  select * into e from public.pes_ejercicios where id = a.ejercicio_id;
  if s.revelado_at is null then
    update public.pes_estado set revelado_at = now(), updated_at = now() where practica_id = p_practica and user_id = p_user returning revelado_at into s.revelado_at;
    perform public.pes_log(p_practica, p_user, a.id, 'apartado_revelado');
  end if;
  v_tmin := public.pes_t_min(a.id, p_user);
  return v_base || jsonb_build_object('estado', 'apartado_abierto',
    'ejercicio', jsonb_build_object('posicion', e.posicion, 'titulo', e.titulo, 'contexto', e.contexto,
      'apartados', (select count(*) from public.pes_apartados x where x.ejercicio_id = e.id)),
    'apartado', jsonb_build_object('id', a.id, 'letra', chr(64 + a.posicion), 'posicion', a.posicion, 'etapa', a.etapa, 'enunciado', a.enunciado,
      'formato', a.formato, 'opciones', a.opciones, 'multiple', a.multiple, 'unidad_sugerida', a.unidad_sugerida, 'figura', a.figura,
      'variante', exists (select 1 from public.pes_claves k where k.apartado_id = a.id and k.clave ? 'variante')),
    'revelado_at', s.revelado_at, 't_min_s', v_tmin, 'borrador', s.borrador, 'borrador_rev', s.borrador_rev,
    'factor_anticipado', p.factor_anticipado,
    'pegado_permitido', (select pegado_permitido from public.pes_asignaciones where practica_id = p_practica and user_id = p_user));
end $$;

-- -----------------------------------------------------------------------------
-- Calificación (la misma fórmula que src/lib/pes.ts)
-- -----------------------------------------------------------------------------
create or replace function public.pes_formula(p_s numeric, p_sm numeric, p_n numeric, p_pmax numeric, p_alfa numeric) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('S', round(p_s, 6), 'S_m', round(p_sm, 6),
    'P_base', round(case when p_n <= 0 then 0 else p_pmax * power(p_s / p_n, p_alfa) end, 6),
    'F_tiempo', round(case when p_s <= 0 then 0 else p_sm / p_s end, 6),
    'P', round(least(p_pmax, case when p_s <= 0 or p_n <= 0 then 0 else p_pmax * power(p_s / p_n, p_alfa) * (p_sm / p_s) end), 6))
$$;

-- provisional: todo lo calificado hasta ahora (pendiente de revisión = 0)
-- validada: solo lo que el profesor validó o revisó
-- máxima alcanzable: lo provisional + lo pendiente de revisión con crédito completo (con su m) + lo que aún puede
--   responder a tiempo (m = 1); lo omitido y lo que ya no puede responder no suma
create or replace function public.pes_puntaje(p_practica uuid, p_user uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  with p as (select * from public.pes_practicas where id = p_practica),
  st as (select estado from public.pes_estado where practica_id = p_practica and user_id = p_user),
  puede as (select (select estado from p) = 'publicada' and coalesce((select estado from st), 'no_iniciada') not in ('completada', 'vencida')
             and (public.pes_cierre(p_practica, p_user) is null or now() < public.pes_cierre(p_practica, p_user)) v),
  n as (select count(*)::numeric n from public.pes_ejercicios where practica_id = p_practica),
  r as (select a.peso w, coalesce(x.q, 0) q, coalesce(x.m, 1) m, x.accion, x.revision, coalesce(x.validada, false) validada
        from public.pes_apartados a left join public.pes_respuestas x on x.apartado_id = a.id and x.user_id = p_user
        where a.practica_id = p_practica),
  t as (select coalesce(sum(w * q), 0) s, coalesce(sum(w * q * m), 0) sm,
          coalesce(sum(w * q) filter (where validada), 0) sv, coalesce(sum(w * q * m) filter (where validada), 0) svm,
          coalesce(sum(w) filter (where accion is null), 0) libre,
          coalesce(sum(w) filter (where revision = 'pendiente'), 0) pend,
          coalesce(sum(w * m) filter (where revision = 'pendiente'), 0) pend_m,
          count(*) filter (where accion is not null) cerrados, count(*) filter (where accion = 'omitida') omitidos,
          count(*) filter (where accion = 'anticipada') anticipados, count(*) filter (where revision = 'pendiente') pendientes,
          count(*) filter (where accion is not null and not validada) sin_validar, count(*) total
        from r),
  -- control presencial: cuenta el resultado más favorable; solo cambia la puntuación si la política es «ajuste»
  ctl as (select max(c.resultado) c, count(*) n from public.pes_controles c where c.practica_id = p_practica and c.user_id = p_user and c.estado = 'realizado'),
  fac as (select case when (select control_politica ->> 'modo' from p) = 'ajuste' and ctl.c is not null
                   then 1 - coalesce(((select control_politica from p) ->> 'peso')::numeric, 0) * (1 - ctl.c) else 1 end f from ctl)
  select jsonb_build_object('N', n.n, 'P_max', p.p_max, 'alfa', p.alfa, 'puede_responder', puede.v,
    'provisional', public.pes_formula(t.s, t.sm, n.n, p.p_max, p.alfa),
    'validada', public.pes_formula(t.sv, t.svm, n.n, p.p_max, p.alfa)
       || jsonb_build_object('completa', t.sin_validar = 0 and t.cerrados = t.total),
    'control', jsonb_build_object('modo', p.control_politica ->> 'modo', 'peso', coalesce((p.control_politica ->> 'peso')::numeric, 0),
       'C', ctl.c, 'realizados', ctl.n, 'factor', round(fac.f, 6),
       'validada_con_control', round(((public.pes_formula(t.sv, t.svm, n.n, p.p_max, p.alfa) ->> 'P')::numeric) * fac.f, 6)),
    'maxima_alcanzable', public.pes_formula(t.s + t.pend + case when puede.v then t.libre else 0 end,
       t.sm + t.pend_m + case when puede.v then t.libre else 0 end, n.n, p.p_max, p.alfa),
    'apartados', t.total, 'cerrados', t.cerrados, 'omitidos', t.omitidos, 'anticipados', t.anticipados,
    'pendientes_revision', t.pendientes, 'sin_validar', t.sin_validar)
  from p, n, t, puede, ctl, fac
$$;

-- -----------------------------------------------------------------------------
-- Profesorado: crear y editar
-- -----------------------------------------------------------------------------
create or replace function public.pes_crear(p_class uuid, p jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_course uuid;
begin
  if p_class is null or not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select course_id into v_course from public.classes where id = p_class;
  insert into public.pes_practicas (class_id, course_id, titulo, descripcion, instrucciones, abre_at, cierra_at, p_max, alfa, factor_anticipado, incremento, liberacion,
    control_politica, created_by)
  values (p_class, v_course, btrim(coalesce(p ->> 'titulo', '')), coalesce(p ->> 'descripcion', ''), coalesce(p ->> 'instrucciones', ''),
    nullif(p ->> 'abre_at', '')::timestamptz, nullif(p ->> 'cierra_at', '')::timestamptz,
    coalesce((p ->> 'p_max')::numeric, 8), coalesce((p ->> 'alfa')::numeric, 2), coalesce((p ->> 'factor_anticipado')::numeric, 0.5),
    coalesce((p ->> 'incremento')::numeric, 0.2), coalesce(p -> 'liberacion', '[]'::jsonb),
    coalesce(p -> 'control_politica', '{"modo": "informativo", "peso": 0, "descripcion": ""}'::jsonb), auth.uid())
  returning id into v_id;
  perform public.pes_log(v_id, auth.uid(), null, 'practica_creada');
  return v_id;
end $$;

create or replace function public.pes_editar(p_practica uuid, p jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.pes_practicas set
    titulo = coalesce(nullif(btrim(p ->> 'titulo'), ''), titulo), descripcion = coalesce(p ->> 'descripcion', descripcion),
    instrucciones = coalesce(p ->> 'instrucciones', instrucciones),
    abre_at = case when p ? 'abre_at' then nullif(p ->> 'abre_at', '')::timestamptz else abre_at end,
    cierra_at = case when p ? 'cierra_at' then nullif(p ->> 'cierra_at', '')::timestamptz else cierra_at end,
    p_max = coalesce((p ->> 'p_max')::numeric, p_max), alfa = coalesce((p ->> 'alfa')::numeric, alfa),
    factor_anticipado = coalesce((p ->> 'factor_anticipado')::numeric, factor_anticipado), incremento = coalesce((p ->> 'incremento')::numeric, incremento),
    liberacion = coalesce(p -> 'liberacion', liberacion), control_politica = coalesce(p -> 'control_politica', control_politica), updated_at = now()
  where id = p_practica;
end $$;

create or replace function public.pes_borrar_practica(p_practica uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  delete from public.pes_practicas where id = p_practica and estado = 'borrador';
  if not found then raise exception 'Solo se borra un borrador; una práctica publicada se cierra o se archiva' using errcode = 'P0001'; end if;
end $$;

-- -----------------------------------------------------------------------------
-- Contenido: del banco (problemas por etapas reales), composición docente o redactado
-- -----------------------------------------------------------------------------
-- copia un ejercicio del banco como apartado (con su clave y explicación; sin clave queda para revisión manual)
create or replace function public.pes_copiar_apartado(p_practica uuid, p_ejercicio uuid, p_pos integer, p_exercise uuid, p_peso numeric, p_t_ref integer, p_etapa text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare x public.exercises; v_ap uuid;
begin
  select * into x from public.exercises where id = p_exercise;
  insert into public.pes_apartados (practica_id, ejercicio_id, posicion, etapa, enunciado, formato, opciones, multiple, unidad_sugerida, figura, peso, t_ref_s, origen_exercise_id)
  values (p_practica, p_ejercicio, p_pos, coalesce(p_etapa, 'otra'), x.prompt, x.format, x.options, x.multiple, x.unit_hint, x.figure, p_peso,
    coalesce(p_t_ref, (public.control_minutos_estimados(x.format, x.difficulty) * 60)::integer), x.id)
  returning id into v_ap;
  insert into public.pes_claves (apartado_id, clave, rubrica, explicacion)
    select v_ap, k.answer, coalesce(k.answer ->> 'rubric', ''), coalesce(k.explanation, '') from public.exercise_keys k where k.exercise_id = x.id;
  if not found then insert into public.pes_claves (apartado_id, clave) values (v_ap, null); end if;
  return v_ap;
end $$;

-- pesos: los indicados (deben ser n y sumar 1) o iguales con 5 decimales (el último absorbe el redondeo)
create or replace function public.pes_pesos(p_n integer, p_pesos numeric[]) returns numeric[] language plpgsql immutable set search_path = '' as $$
declare r numeric[] := '{}'; i integer;
begin
  if p_pesos is not null and cardinality(p_pesos) > 0 then
    if cardinality(p_pesos) <> p_n or abs((select sum(w) from unnest(p_pesos) w) - 1) > 1e-6 or exists (select 1 from unnest(p_pesos) w where w is null or w <= 0) then
      raise exception 'Los pesos de los apartados deben ser % valores positivos que sumen 1', p_n using errcode = '22023'; end if;
    return p_pesos;
  end if;
  for i in 1..p_n loop r := r || (round(1.0 / p_n, 5) + case when i = p_n then 1 - p_n * round(1.0 / p_n, 5) else 0 end); end loop;
  return r;
end $$;

-- Problemas por etapas del banco de la asignatura de la sección, con su idoneidad para una PES (3 a 5 apartados).
-- No contiene claves: solo si cada etapa tiene clave y si depende de la anterior (arrastre).
create or replace function public.pes_banco_problemas(p_class uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_course uuid; r jsonb;
begin
  if p_class is null or not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select course_id into v_course from public.classes where id = p_class;
  with etapas as (
    select m.meta -> 'problema' ->> 'id' pid, m.meta -> 'problema' ->> 'titulo' titulo, (m.meta -> 'problema' ->> 'total')::integer total,
      (m.meta -> 'problema' ->> 'etapa')::integer etapa, e.id exercise_id, e.format, e.published, e.difficulty, m.meta ->> 'tipo' tipo,
      k.exercise_id is not null con_clave, coalesce(k.answer ? 'arrastre', false) arrastre, left(e.prompt, 160) extracto
    from public.exercise_bank_meta m join public.exercises e on e.id = m.exercise_id
    left join public.exercise_keys k on k.exercise_id = e.id
    where m.course_id = v_course and m.meta ? 'problema'
  ), probs as (
    select pid, max(titulo) titulo, max(total) total, count(*) n, bool_and(con_clave and published) completo,
      jsonb_agg(jsonb_build_object('etapa', etapa, 'exercise_id', exercise_id, 'formato', format, 'tipo', tipo, 'con_clave', con_clave,
        'publicado', published, 'depende_de_la_anterior', arrastre, 'extracto', extracto,
        't_ref_s', (public.control_minutos_estimados(format, difficulty) * 60)::integer) order by etapa) etapas
    from etapas group by pid
  )
  select jsonb_build_object(
    'problemas', coalesce(jsonb_agg(jsonb_build_object('id', pid, 'titulo', titulo, 'total', total, 'etapas', etapas,
      'estado', case when n <> total or not completo then 'incompleto' when total < 3 then 'insuficiente' when total <= 5 then 'listo' else 'requiere_seleccion' end,
      'motivo', case when n <> total or not completo then 'Faltan etapas, claves o publicación: requiere preparación docente'
        when total < 3 then 'Tiene menos de 3 etapas: no forma un ejercicio secuencial'
        when total <= 5 then 'Se puede usar completo'
        else format('Tiene %s etapas: elija de 3 a 5 consecutivas que no dependan de una etapa excluida', total) end) order by titulo), '[]'::jsonb),
    'listos', count(*) filter (where n = total and completo and total between 3 and 5),
    'requieren_seleccion', count(*) filter (where n = total and completo and total > 5),
    'preguntas_sueltas', (select count(*) from public.exercises e where e.course_id = v_course and e.published
       and not exists (select 1 from public.exercise_bank_meta m where m.exercise_id = e.id and m.meta ? 'problema')))
  into r from probs;
  return r;
end $$;

-- Ejercicio = etapas consecutivas [desde, hasta] de un problema por etapas del banco (3 a 5). Se rechaza si la primera
-- etapa elegida depende de una etapa excluida (arrastre), si falta alguna clave o si alguna etapa no está publicada.
create or replace function public.pes_ejercicio_desde_problema(p_practica uuid, p_problema text, p_desde integer, p_hasta integer,
  p_pesos numeric[] default null, p_t_ref integer[] default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.pes_practicas; v_ej uuid; v_pos integer; v_n integer := p_hasta - p_desde + 1; v_w numeric[]; r record; i integer := 0; v_titulo text; v_total integer;
begin
  select * into p from public.pes_practicas where id = p_practica;
  if p.id is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or v_n not between 3 and 5 then raise exception 'Elija de 3 a 5 etapas consecutivas' using errcode = '22023'; end if;
  select max(m.meta -> 'problema' ->> 'titulo'), max((m.meta -> 'problema' ->> 'total')::integer) into v_titulo, v_total
    from public.exercise_bank_meta m where m.course_id = p.course_id and m.meta -> 'problema' ->> 'id' = p_problema;
  if v_total is null then raise exception 'Ese problema no está en el banco de la asignatura' using errcode = 'P0001'; end if;
  if p_desde < 1 or p_hasta > v_total then raise exception 'El problema tiene las etapas 1 a %', v_total using errcode = '22023'; end if;
  if (select count(*) from public.exercise_bank_meta m join public.exercises e on e.id = m.exercise_id join public.exercise_keys k on k.exercise_id = e.id
      where m.course_id = p.course_id and m.meta -> 'problema' ->> 'id' = p_problema and e.published
        and (m.meta -> 'problema' ->> 'etapa')::integer between p_desde and p_hasta) <> v_n then
    raise exception 'Alguna etapa elegida falta, no está publicada o no tiene clave: requiere preparación docente' using errcode = 'P0001'; end if;
  if p_desde > 1 and exists (select 1 from public.exercise_bank_meta m join public.exercise_keys k on k.exercise_id = m.exercise_id
      where m.course_id = p.course_id and m.meta -> 'problema' ->> 'id' = p_problema and (m.meta -> 'problema' ->> 'etapa')::integer = p_desde and k.answer ? 'arrastre') then
    raise exception 'La etapa % usa el resultado de la etapa %: inclúyala o empiece en una etapa que no dependa de otra', p_desde, p_desde - 1 using errcode = 'P0001'; end if;
  v_w := public.pes_pesos(v_n, p_pesos);
  if p_t_ref is not null and cardinality(p_t_ref) <> v_n then raise exception 'Indique % tiempos de referencia', v_n using errcode = '22023'; end if;
  select coalesce(max(posicion), 0) + 1 into v_pos from public.pes_ejercicios where practica_id = p_practica;
  insert into public.pes_ejercicios (practica_id, posicion, titulo, contexto, origen, origen_ref)
    values (p_practica, v_pos, left(coalesce(v_titulo, p_problema), 200), coalesce(v_titulo, ''), 'problema_banco', format('%s · etapas %s–%s', p_problema, p_desde, p_hasta))
    returning id into v_ej;
  for r in select m.exercise_id, m.meta ->> 'tipo' tipo from public.exercise_bank_meta m
      where m.course_id = p.course_id and m.meta -> 'problema' ->> 'id' = p_problema and (m.meta -> 'problema' ->> 'etapa')::integer between p_desde and p_hasta
      order by (m.meta -> 'problema' ->> 'etapa')::integer loop
    i := i + 1;
    perform public.pes_copiar_apartado(p_practica, v_ej, i, r.exercise_id, v_w[i], p_t_ref[i],
      case r.tipo when 'prediccion' then 'prediccion' when 'calculo' then 'resolucion' when 'encadenada' then 'resolucion'
        when 'conceptual' then 'interpretacion' when 'esperado_observado' then 'interpretacion' when 'dimensional' then 'formulacion' else 'otra' end);
  end loop;
  return v_ej;
end $$;

-- Composición docente: el profesor elige 3 a 5 preguntas del banco Y escribe la situación común que les da coherencia.
-- (No hay armado automático: agrupar preguntas sueltas sin una situación común no forma un problema secuencial.)
create or replace function public.pes_ejercicio_desde_banco(p_practica uuid, p_exercises uuid[], p_titulo text default '',
  p_contexto text default '', p_pesos numeric[] default null, p_t_ref integer[] default null, p_etapas text[] default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.pes_practicas; v_ej uuid; v_pos integer; i integer; x public.exercises; n integer := coalesce(cardinality(p_exercises), 0); v_w numeric[];
begin
  select * into p from public.pes_practicas where id = p_practica;
  if p.id is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if n not between 3 and 5 then raise exception 'Cada ejercicio tiene de 3 a 5 apartados' using errcode = '22023'; end if;
  if (select count(distinct v) from unnest(p_exercises) v) <> n then raise exception 'No repita una pregunta dentro del ejercicio' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_contexto, ''))) < 20 then
    raise exception 'Escriba la situación común que da coherencia a los apartados (al menos 20 caracteres)' using errcode = '22023'; end if;
  v_w := public.pes_pesos(n, p_pesos);
  if p_t_ref is not null and cardinality(p_t_ref) <> n then raise exception 'Indique % tiempos de referencia', n using errcode = '22023'; end if;
  for i in 1..n loop
    select * into x from public.exercises where id = p_exercises[i];
    if x.id is null or x.course_id <> p.course_id then raise exception 'Ejercicio ajeno a la asignatura' using errcode = '42501'; end if;
  end loop;
  select coalesce(max(posicion), 0) + 1 into v_pos from public.pes_ejercicios where practica_id = p_practica;
  insert into public.pes_ejercicios (practica_id, posicion, titulo, contexto, origen)
    values (p_practica, v_pos, left(coalesce(p_titulo, ''), 200), btrim(p_contexto), 'composicion_docente') returning id into v_ej;
  for i in 1..n loop
    perform public.pes_copiar_apartado(p_practica, v_ej, i, p_exercises[i], v_w[i], p_t_ref[i], p_etapas[i]);
  end loop;
  return v_ej;
end $$;

-- Apartados redactados por el profesor: { titulo, contexto, apartados: [{ enunciado, formato, opciones, multiple,
-- unidad_sugerida, etapa, peso, t_ref_s, clave, rubrica, explicacion }] }. La clave sigue el formato del motor de
-- calificación (la interfaz la comprueba además con el propio motor antes de enviarla).
create or replace function public.pes_ejercicio_redactado(p_practica uuid, p jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ej uuid; v_pos integer; ap jsonb; i integer := 0; n integer; v_w numeric[]; v_pesos numeric[]; f text; k jsonb; v_ap uuid; v_ops integer;
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if jsonb_typeof(p -> 'apartados') <> 'array' then raise exception 'Faltan los apartados' using errcode = '22023'; end if;
  n := jsonb_array_length(p -> 'apartados');
  if n not between 3 and 5 then raise exception 'Cada ejercicio tiene de 3 a 5 apartados' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(p -> 'apartados') x where x ? 'peso' and x ->> 'peso' is not null) then
    select array_agg((x ->> 'peso')::numeric order by o) into v_pesos from jsonb_array_elements(p -> 'apartados') with ordinality t(x, o);
  end if;
  v_w := public.pes_pesos(n, v_pesos);
  -- validación de cada apartado antes de escribir nada
  for ap in select x from jsonb_array_elements(p -> 'apartados') x loop
    i := i + 1;
    f := ap ->> 'formato'; k := ap -> 'clave';
    if f is null or f not in ('choice', 'truefalse', 'numeric', 'text', 'open') then raise exception 'Apartado %: formato no válido', chr(64 + i) using errcode = '22023'; end if;
    if char_length(btrim(coalesce(ap ->> 'enunciado', ''))) = 0 then raise exception 'Apartado %: falta el enunciado', chr(64 + i) using errcode = '22023'; end if;
    if coalesce((ap ->> 't_ref_s')::integer, 0) not between 10 and 7200 then raise exception 'Apartado %: el tiempo de referencia va de 10 s a 2 h', chr(64 + i) using errcode = '22023'; end if;
    if f = 'open' then
      if char_length(btrim(coalesce(ap ->> 'rubrica', ''))) < 10 then raise exception 'Apartado %: una respuesta abierta necesita rúbrica', chr(64 + i) using errcode = '22023'; end if;
    else
      if k is null or jsonb_typeof(k) <> 'object' or k ->> 'format' is distinct from f then raise exception 'Apartado %: falta la clave o no coincide con el formato', chr(64 + i) using errcode = '22023'; end if;
      if f = 'numeric' and char_length(btrim(coalesce(k ->> 'value', ''))) = 0 and not (k ? 'variante') then raise exception 'Apartado %: falta el valor de la clave', chr(64 + i) using errcode = '22023'; end if;
      if f = 'choice' then
        v_ops := case when jsonb_typeof(ap -> 'opciones') = 'array' then jsonb_array_length(ap -> 'opciones') else 0 end;
        if v_ops < 2 then raise exception 'Apartado %: indique al menos 2 opciones', chr(64 + i) using errcode = '22023'; end if;
        if jsonb_typeof(k -> 'correct') <> 'array' or jsonb_array_length(k -> 'correct') = 0
           or exists (select 1 from jsonb_array_elements_text(k -> 'correct') c where c !~ '^\d+$' or c::integer >= v_ops) then
          raise exception 'Apartado %: marque la opción correcta', chr(64 + i) using errcode = '22023'; end if;
      end if;
      if f = 'truefalse' and jsonb_typeof(k -> 'value') <> 'boolean' then raise exception 'Apartado %: indique si es verdadero o falso', chr(64 + i) using errcode = '22023'; end if;
      if f = 'text' and (jsonb_typeof(k -> 'accepted') <> 'array' or jsonb_array_length(k -> 'accepted') = 0) then
        raise exception 'Apartado %: indique al menos una respuesta aceptada', chr(64 + i) using errcode = '22023'; end if;
    end if;
  end loop;
  select coalesce(max(posicion), 0) + 1 into v_pos from public.pes_ejercicios where practica_id = p_practica;
  insert into public.pes_ejercicios (practica_id, posicion, titulo, contexto, origen)
    values (p_practica, v_pos, left(coalesce(p ->> 'titulo', ''), 200), left(coalesce(p ->> 'contexto', ''), 8000), 'redactado') returning id into v_ej;
  i := 0;
  for ap in select x from jsonb_array_elements(p -> 'apartados') x loop
    i := i + 1;
    insert into public.pes_apartados (practica_id, ejercicio_id, posicion, etapa, enunciado, formato, opciones, multiple, unidad_sugerida, peso, t_ref_s)
    values (p_practica, v_ej, i, coalesce(nullif(ap ->> 'etapa', ''), 'otra'), btrim(ap ->> 'enunciado'), (ap ->> 'formato')::public.exercise_format,
      case when ap ->> 'formato' = 'choice' then ap -> 'opciones' end, coalesce((ap ->> 'multiple')::boolean, false),
      nullif(btrim(coalesce(ap ->> 'unidad_sugerida', '')), ''), v_w[i], (ap ->> 't_ref_s')::integer)
    returning id into v_ap;
    insert into public.pes_claves (apartado_id, clave, rubrica, explicacion)
    values (v_ap, case when ap ->> 'formato' = 'open' then null else ap -> 'clave' end, left(coalesce(ap ->> 'rubrica', ''), 4000), left(coalesce(ap ->> 'explicacion', ''), 8000));
  end loop;
  return v_ej;
end $$;

-- Quitar un ejercicio del borrador (renumera los siguientes)
create or replace function public.pes_borrar_ejercicio(p_ejercicio uuid) returns void language plpgsql security definer set search_path = '' as $$
declare e public.pes_ejercicios;
begin
  select * into e from public.pes_ejercicios where id = p_ejercicio;
  if e.id is null or not public.pes_docente(e.practica_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  delete from public.pes_ejercicios where id = p_ejercicio;
  update public.pes_ejercicios set posicion = posicion - 1 where practica_id = e.practica_id and posicion > e.posicion;
end $$;

-- -----------------------------------------------------------------------------
-- Profesorado: publicar, asignar, adaptar, revisar, validar y publicar resultados
-- -----------------------------------------------------------------------------
create or replace function public.pes_publicar(p_practica uuid, p_estudiantes uuid[] default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.pes_practicas; v_mal text; v_n integer;
begin
  select * into p from public.pes_practicas where id = p_practica for update;
  if p.id is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p.estado <> 'borrador' then raise exception 'Ya está publicada' using errcode = 'P0001'; end if;
  select count(*) into v_n from public.pes_ejercicios where practica_id = p_practica;
  if v_n = 0 then raise exception 'La práctica no tiene ejercicios' using errcode = 'P0001'; end if;
  if p.cierra_at is null then raise exception 'Indique la fecha límite' using errcode = 'P0001'; end if;
  if p.cierra_at <= now() then raise exception 'La fecha límite ya pasó' using errcode = 'P0001'; end if;
  select string_agg(format('ejercicio %s', e.posicion), ', ' order by e.posicion) into v_mal from public.pes_ejercicios e
    where e.practica_id = p_practica and ((select count(*) from public.pes_apartados a where a.ejercicio_id = e.id) not between 3 and 5
       or abs((select coalesce(sum(a.peso), 0) from public.pes_apartados a where a.ejercicio_id = e.id) - 1) > 1e-6);
  if v_mal is not null then raise exception 'Revise apartados (3 a 5) y pesos (suman 1): %', v_mal using errcode = 'P0001'; end if;
  -- cada apartado debe poder calificarse: con clave, o abierto con rúbrica
  select string_agg(format('%s%s', e.posicion, chr(64 + a.posicion)), ', ' order by e.posicion, a.posicion) into v_mal
    from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id join public.pes_claves k on k.apartado_id = a.id
    where a.practica_id = p_practica and ((a.formato <> 'open' and k.clave is null) or (a.formato = 'open' and char_length(btrim(k.rubrica)) < 10));
  if v_mal is not null then raise exception 'Apartados sin clave o sin rúbrica: %', v_mal using errcode = 'P0001'; end if;
  update public.pes_practicas set estado = 'publicada', version = version + 1, publicada_at = now(), updated_at = now(),
    todos_los_estudiantes = p_estudiantes is null where id = p_practica;
  insert into public.pes_asignaciones (practica_id, user_id, version)
    select p_practica, e.user_id, p.version + 1 from public.enrollments e join public.profiles pr on pr.id = e.user_id and pr.role = 'student'
    where e.class_id = p.class_id and (p_estudiantes is null or e.user_id = any (p_estudiantes))
    on conflict do nothing;
  insert into public.pes_estado (practica_id, user_id) select p_practica, s.user_id from public.pes_asignaciones s where s.practica_id = p_practica on conflict do nothing;
  perform public.pes_log(p_practica, auth.uid(), null, 'practica_publicada', jsonb_build_object('version', p.version + 1));
  return jsonb_build_object('version', p.version + 1, 'asignados', (select count(*) from public.pes_asignaciones where practica_id = p_practica and not prueba));
end $$;

create or replace function public.pes_cambiar_estado(p_practica uuid, p_estado text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_estado not in ('cerrada', 'archivada') then raise exception 'Use pes_publicar para publicar' using errcode = '22023'; end if;
  update public.pes_practicas set estado = p_estado, updated_at = now() where id = p_practica and estado <> 'borrador';
  if not found then raise exception 'Solo se cierra o archiva una práctica publicada' using errcode = 'P0001'; end if;
  perform public.pes_log(p_practica, auth.uid(), null, 'practica_' || p_estado);
end $$;

-- Adaptaciones autorizadas, SEPARADAS: tiempo adicional (amplía el plazo personal), factor de espera (0 a 1: solo
-- reduce la espera mínima) y pegado permitido (tecnologías de asistencia o dictado).
create or replace function public.pes_adaptacion(p_practica uuid, p_user uuid, p_tiempo_extra_min integer, p_factor_espera numeric, p_pegado boolean, p_nota text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_factor_espera is not null and (p_factor_espera < 0 or p_factor_espera > 1) then
    raise exception 'El factor de espera va de 0 a 1: una adaptación no puede alargar la espera mínima' using errcode = '22023'; end if;
  if p_tiempo_extra_min is not null and (p_tiempo_extra_min < 0 or p_tiempo_extra_min > 20160) then
    raise exception 'El tiempo adicional va de 0 a 14 días' using errcode = '22023'; end if;
  update public.pes_asignaciones set tiempo_extra_min = coalesce(p_tiempo_extra_min, tiempo_extra_min), factor_espera = coalesce(p_factor_espera, factor_espera),
    pegado_permitido = coalesce(p_pegado, pegado_permitido), nota_adaptacion = left(nullif(btrim(p_nota), ''), 500)
    where practica_id = p_practica and user_id = p_user;
  if not found then raise exception 'El estudiante no tiene asignada esta práctica' using errcode = 'P0001'; end if;
  perform public.pes_log(p_practica, p_user, null, 'adaptacion',
    jsonb_build_object('tiempo_extra_min', p_tiempo_extra_min, 'factor_espera', p_factor_espera, 'pegado', p_pegado, 'por', auth.uid()));
end $$;

-- Revisión docente de un apartado (respuestas abiertas o corrección justificada): cambia q, nunca la respuesta; queda validada
create or replace function public.pes_revisar(p_respuesta uuid, p_q numeric, p_nota text) returns void language plpgsql security definer set search_path = '' as $$
declare r public.pes_respuestas;
begin
  select * into r from public.pes_respuestas where id = p_respuesta;
  if r.id is null or not public.pes_docente(r.practica_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_q is null or p_q < 0 or p_q > 1 then raise exception 'La calidad va de 0 a 1' using errcode = '22023'; end if;
  if r.accion = 'omitida' then raise exception 'Un apartado omitido vale 0' using errcode = 'P0001'; end if;
  if nullif(btrim(p_nota), '') is null then raise exception 'Escriba la justificación de la revisión' using errcode = '22023'; end if;
  update public.pes_respuestas set q = round(p_q, 5), revision = 'revisada', revisado_por = auth.uid(), revisado_at = now(), nota_revision = left(btrim(p_nota), 2000),
    validada = true, validada_por = auth.uid(), validada_at = now()
    where id = p_respuesta;
  perform public.pes_log(r.practica_id, r.user_id, r.apartado_id, 'revision_docente', jsonb_build_object('q_antes', r.q, 'q', p_q, 'por', auth.uid()));
end $$;

-- Validar las calificaciones automáticas (y los omitidos) de un estudiante o de todos. Lo pendiente de revisión no se
-- valida aquí: se revisa con pes_revisar.
create or replace function public.pes_validar(p_practica uuid, p_user uuid default null) returns integer language plpgsql security definer set search_path = '' as $$
declare v integer;
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.pes_respuestas set validada = true, validada_por = auth.uid(), validada_at = now()
    where practica_id = p_practica and (p_user is null or user_id = p_user) and revision = 'auto' and not validada
      and not exists (select 1 from public.pes_asignaciones s where s.practica_id = p_practica and s.user_id = pes_respuestas.user_id and s.prueba);
  get diagnostics v = row_count;
  perform public.pes_log(p_practica, p_user, null, 'calificaciones_validadas', jsonb_build_object('n', v, 'por', auth.uid()));
  return v;
end $$;

create or replace function public.pes_publicar_resultados(p_practica uuid, p_publicar boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.pes_practicas set resultados_publicados = coalesce(p_publicar, false), updated_at = now() where id = p_practica and estado <> 'borrador';
  if not found then raise exception 'Publique antes la práctica' using errcode = 'P0001'; end if;
  perform public.pes_log(p_practica, auth.uid(), null, case when p_publicar then 'resultados_publicados' else 'resultados_retirados' end);
end $$;

-- Lista de PES de una sección (profesorado)
create or replace function public.pes_lista_docente(p_class uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_class is null or not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'titulo', p.titulo, 'estado', p.estado, 'abre_at', p.abre_at, 'cierra_at', p.cierra_at,
      'resultados_publicados', p.resultados_publicados, 'publicada_at', p.publicada_at,
      'ejercicios', (select count(*) from public.pes_ejercicios e where e.practica_id = p.id),
      'apartados', (select count(*) from public.pes_apartados a where a.practica_id = p.id),
      'asignados', (select count(*) from public.pes_asignaciones s where s.practica_id = p.id and not s.prueba),
      'por_estado', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb) from (select st.estado, count(*) n from public.pes_estado st
        join public.pes_asignaciones s on s.practica_id = st.practica_id and s.user_id = st.user_id and not s.prueba where st.practica_id = p.id group by st.estado) x),
      'pendientes_revision', (select count(*) from public.pes_respuestas r join public.pes_asignaciones s on s.practica_id = r.practica_id and s.user_id = r.user_id and not s.prueba
        where r.practica_id = p.id and r.revision = 'pendiente'))
    order by p.created_at desc) from public.pes_practicas p where p.class_id = p_class), '[]'::jsonb);
end $$;

-- Detalle completo para el profesorado: estructura con claves y rúbricas, asignaciones con adaptaciones y puntajes
create or replace function public.pes_detalle_docente(p_practica uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.pes_practicas;
begin
  select * into p from public.pes_practicas where id = p_practica;
  if p.id is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object('practica', to_jsonb(p),
    'ejercicios', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'posicion', e.posicion, 'titulo', e.titulo, 'contexto', e.contexto,
        'origen', e.origen, 'origen_ref', e.origen_ref,
        'apartados', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'posicion', a.posicion, 'letra', chr(64 + a.posicion), 'etapa', a.etapa,
            'enunciado', a.enunciado, 'formato', a.formato, 'opciones', a.opciones, 'multiple', a.multiple, 'unidad_sugerida', a.unidad_sugerida,
            'figura', a.figura, 'peso', a.peso, 't_ref_s', a.t_ref_s, 'origen_exercise_id', a.origen_exercise_id,
            'clave', k.clave, 'rubrica', k.rubrica, 'explicacion', k.explicacion) order by a.posicion), '[]'::jsonb)
          from public.pes_apartados a left join public.pes_claves k on k.apartado_id = a.id where a.ejercicio_id = e.id)) order by e.posicion)
      from public.pes_ejercicios e where e.practica_id = p_practica), '[]'::jsonb),
    'asignaciones', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'nombre', pr.full_name, 'codigo', pr.student_code,
        'tiempo_extra_min', s.tiempo_extra_min, 'factor_espera', s.factor_espera, 'pegado_permitido', s.pegado_permitido, 'nota_adaptacion', s.nota_adaptacion,
        'aceptado_at', s.aceptado_at, 'estado', st.estado, 'cierre', public.pes_cierre(p_practica, s.user_id),
        'puntaje', public.pes_puntaje(p_practica, s.user_id)) order by pr.full_name)
      from public.pes_asignaciones s join public.profiles pr on pr.id = s.user_id
      left join public.pes_estado st on st.practica_id = s.practica_id and st.user_id = s.user_id
      where s.practica_id = p_practica and not s.prueba), '[]'::jsonb));
end $$;

-- Respuestas para revisar o validar (profesorado)
create or replace function public.pes_respuestas_docente(p_practica uuid, p_solo_pendientes boolean default true) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'nombre', pr.full_name, 'ejercicio', e.posicion,
      'letra', chr(64 + a.posicion), 'enunciado', a.enunciado, 'formato', a.formato, 'rubrica', k.rubrica, 'respuesta', r.respuesta, 'accion', r.accion,
      'segundos', r.segundos, 't_min_s', r.t_min_s, 'm', r.m, 'q', r.q, 'revision', r.revision, 'validada', r.validada, 'nota_revision', r.nota_revision,
      'cerrado_at', r.cerrado_at) order by pr.full_name, e.posicion, a.posicion)
    from public.pes_respuestas r join public.pes_apartados a on a.id = r.apartado_id join public.pes_ejercicios e on e.id = a.ejercicio_id
    join public.profiles pr on pr.id = r.user_id left join public.pes_claves k on k.apartado_id = a.id
    join public.pes_asignaciones s on s.practica_id = r.practica_id and s.user_id = r.user_id and not s.prueba
    where r.practica_id = p_practica and (not coalesce(p_solo_pendientes, true) or r.revision = 'pendiente')), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- Estudiante
-- -----------------------------------------------------------------------------
create or replace function public.pes_mis_practicas() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'titulo', p.titulo, 'descripcion', p.descripcion, 'instrucciones', p.instrucciones,
      'abre_at', p.abre_at, 'cierra_at', p.cierra_at, 'cierre', public.pes_cierre(p.id, s.user_id), 'estado_practica', p.estado,
      'p_max', p.p_max, 'alfa', p.alfa, 'factor_anticipado', p.factor_anticipado, 'incremento', p.incremento,
      'ejercicios', (select count(*) from public.pes_ejercicios e where e.practica_id = p.id),
      'apartados', (select count(*) from public.pes_apartados a where a.practica_id = p.id),
      'cerrados', (select count(*) from public.pes_respuestas r where r.practica_id = p.id and r.user_id = s.user_id),
      'minutos_espera', (select round(sum((1 + p.incremento) * a.t_ref_s * s.factor_espera) / 60) from public.pes_apartados a where a.practica_id = p.id),
      'minutos_referencia', (select round(sum(a.t_ref_s) / 60.0) from public.pes_apartados a where a.practica_id = p.id),
      'liberacion', p.liberacion, 'control_politica', p.control_politica,
      'estado', st.estado, 'aceptado_at', s.aceptado_at, 'tiempo_extra_min', s.tiempo_extra_min, 'factor_espera', s.factor_espera,
      'pegado_permitido', s.pegado_permitido,
      'resultado', case when p.resultados_publicados then public.pes_puntaje(p.id, auth.uid()) end) order by p.cierra_at), '[]'::jsonb)
  from public.pes_asignaciones s join public.pes_practicas p on p.id = s.practica_id and p.estado in ('publicada', 'cerrada')
  left join public.pes_estado st on st.practica_id = p.id and st.user_id = s.user_id
  where s.user_id = auth.uid() and not s.prueba and public.account_ok(auth.uid())
$$;

-- Aceptar las condiciones y comenzar (idempotente)
create or replace function public.pes_iniciar(p_practica uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); s public.pes_estado;
begin
  perform public.pes_practica_activa(p_practica, v_uid);
  select * into s from public.pes_estado where practica_id = p_practica and user_id = v_uid for update;
  if public.pes_vencer(p_practica, v_uid) = 'no_iniciada' then
    update public.pes_asignaciones set aceptado_at = coalesce(aceptado_at, now()) where practica_id = p_practica and user_id = v_uid;
    perform public.pes_log(p_practica, v_uid, null, 'condiciones_aceptadas');
    perform public.pes_avanzar(p_practica, v_uid, null);
  end if;
  return public.pes_actual_json(p_practica, v_uid);
end $$;

-- El apartado abierto (lo revela la primera vez: ahí empieza su tiempo)
create or replace function public.pes_actual(p_practica uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  perform public.pes_practica_activa(p_practica, v_uid);
  perform 1 from public.pes_estado where practica_id = p_practica and user_id = v_uid for update;
  return public.pes_actual_json(p_practica, v_uid);
end $$;

-- Borrador del apartado abierto (autoguardado); se ignora una revisión más vieja que la guardada
create or replace function public.pes_borrador(p_practica uuid, p_apartado uuid, p_texto text, p_rev integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); s public.pes_estado;
begin
  perform public.pes_practica_activa(p_practica, v_uid);
  select * into s from public.pes_estado where practica_id = p_practica and user_id = v_uid for update;
  if public.pes_vencer(p_practica, v_uid) = 'vencida' then raise exception 'El plazo terminó' using errcode = 'P0001'; end if;
  if s.estado <> 'apartado_abierto' or s.apartado_id is distinct from p_apartado or s.revelado_at is null then
    raise exception 'Ese apartado no está abierto' using errcode = 'P0001'; end if;
  if coalesce(p_rev, 0) > s.borrador_rev then
    update public.pes_estado set borrador = left(coalesce(p_texto, ''), 20000), borrador_rev = p_rev, updated_at = now()
      where practica_id = p_practica and user_id = v_uid;
  end if;
  return jsonb_build_object('guardado', true, 'rev', greatest(coalesce(p_rev, 0), s.borrador_rev), 'ahora', now());
end $$;

-- Omitir definitivamente el apartado abierto (vale 0). Idempotente por p_idem.
create or replace function public.pes_omitir(p_practica uuid, p_apartado uuid, p_idem uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); s public.pes_estado; v_prev public.pes_respuestas;
begin
  perform public.pes_practica_activa(p_practica, v_uid);
  select * into s from public.pes_estado where practica_id = p_practica and user_id = v_uid for update;
  select * into v_prev from public.pes_respuestas where idem = p_idem;
  if v_prev.id is not null then
    if v_prev.user_id <> v_uid then raise exception 'Solicitud no válida' using errcode = '42501'; end if;
    return jsonb_build_object('repetida', true, 'accion', v_prev.accion, 'actual', public.pes_actual_json(p_practica, v_uid));
  end if;
  if public.pes_cierre(p_practica, v_uid) <= now() then raise exception 'El plazo terminó' using errcode = 'P0001'; end if;
  if s.estado <> 'apartado_abierto' or s.apartado_id is distinct from p_apartado or s.revelado_at is null then
    raise exception 'Ese apartado no está abierto' using errcode = 'P0001'; end if;
  insert into public.pes_respuestas (practica_id, user_id, apartado_id, accion, respuesta, revelado_at, segundos, t_min_s, m, q, revision, idem)
  values (p_practica, v_uid, p_apartado, 'omitida', null, s.revelado_at, round(extract(epoch from now() - s.revelado_at)::numeric, 2),
    public.pes_t_min(p_apartado, v_uid), 1, 0, 'auto', p_idem);
  perform public.pes_log(p_practica, v_uid, p_apartado, 'apartado_omitido');
  perform public.pes_avanzar(p_practica, v_uid, p_apartado);
  return jsonb_build_object('repetida', false, 'accion', 'omitida', 'actual', public.pes_actual_json(p_practica, v_uid));
end $$;

-- Incidencias del navegador: SOLO el tipo (nunca el contenido pegado ni nada fuera del aula). Son indicadores para
-- revisión docente, no pruebas de fraude. Tope por estudiante para que no se use como vía de saturación.
create or replace function public.pes_evento_cliente(p_practica uuid, p_tipo text) returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); s public.pes_estado;
begin
  if p_tipo not in ('pegado_bloqueado', 'arrastre_bloqueado', 'ventana_oculta', 'ventana_visible', 'reconexion') then
    raise exception 'Tipo de evento no admitido' using errcode = '22023'; end if;
  perform public.pes_practica_activa(p_practica, v_uid);
  select * into s from public.pes_estado where practica_id = p_practica and user_id = v_uid;
  if (select count(*) from public.pes_eventos where practica_id = p_practica and user_id = v_uid) >= 2000 then return; end if;
  perform public.pes_log(p_practica, v_uid, s.apartado_id, p_tipo);
end $$;

-- -----------------------------------------------------------------------------
-- Servidor (función «calificar», acción «pes»): preparar (clave del apartado ABIERTO) y confirmar (transición)
-- -----------------------------------------------------------------------------
create or replace function public.svc_pes_preparar(p_user uuid, p_practica uuid, p_apartado uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.pes_estado; a public.pes_apartados; v_previo text;
begin
  perform public.pes_practica_activa(p_practica, p_user);
  select * into s from public.pes_estado where practica_id = p_practica and user_id = p_user;
  if s.estado <> 'apartado_abierto' or s.apartado_id is distinct from p_apartado or s.revelado_at is null then
    raise exception 'Ese apartado no está abierto' using errcode = 'P0001'; end if;
  select * into a from public.pes_apartados where id = p_apartado;
  -- arrastre: la respuesta del estudiante en el apartado anterior del mismo ejercicio
  select x.respuesta ->> 'text' into v_previo from public.pes_respuestas x join public.pes_apartados b on b.id = x.apartado_id
    where x.user_id = p_user and b.ejercicio_id = a.ejercicio_id and b.posicion = a.posicion - 1;
  return jsonb_build_object('clave', (select clave from public.pes_claves where apartado_id = p_apartado),
    'opciones', coalesce(jsonb_array_length(a.opciones), 0), 'previo', v_previo,
    'semilla', (select semilla from public.pes_asignaciones where practica_id = p_practica and user_id = p_user));
end $$;

-- p_resultado: { status, credit, code } del motor de calificación. p_anticipado: el estudiante aceptó la reducción.
create or replace function public.svc_pes_confirmar(p_user uuid, p_practica uuid, p_apartado uuid, p_respuesta jsonb, p_resultado jsonb,
  p_anticipado boolean, p_idem uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.pes_practicas; s public.pes_estado; v_prev public.pes_respuestas; v_seg numeric; v_tmin numeric; v_m numeric; v_q numeric; v_rev text; v_status text;
begin
  p := public.pes_practica_activa(p_practica, p_user);
  select * into s from public.pes_estado where practica_id = p_practica and user_id = p_user for update;
  select * into v_prev from public.pes_respuestas where idem = p_idem;
  if v_prev.id is not null then
    if v_prev.user_id <> p_user then raise exception 'Solicitud no válida' using errcode = '42501'; end if;
    return jsonb_build_object('repetida', true, 'accion', v_prev.accion, 'actual', public.pes_actual_json(p_practica, p_user));
  end if;
  if public.pes_cierre(p_practica, p_user) <= now() then raise exception 'El plazo terminó' using errcode = 'P0001'; end if;
  if s.estado <> 'apartado_abierto' or s.apartado_id is distinct from p_apartado or s.revelado_at is null then
    raise exception 'Ese apartado no está abierto' using errcode = 'P0001'; end if;
  v_seg := round(extract(epoch from now() - s.revelado_at)::numeric, 2);
  v_tmin := public.pes_t_min(p_apartado, p_user);
  if v_seg < v_tmin then
    if not coalesce(p_anticipado, false) then
      raise exception 'Aún no se alcanza el tiempo mínimo: confirme el avance anticipado (puntuación reducida)' using errcode = 'P0001'; end if;
    v_m := p.factor_anticipado;
  else
    v_m := 1;
  end if;
  v_status := coalesce(p_resultado ->> 'status', 'pending_review');
  v_rev := case when v_status in ('pending_review', 'needs_review') then 'pendiente' else 'auto' end;
  v_q := case when v_rev = 'pendiente' then 0 else least(1, greatest(0, coalesce((p_resultado ->> 'credit')::numeric, 0))) end;
  insert into public.pes_respuestas (practica_id, user_id, apartado_id, accion, respuesta, revelado_at, segundos, t_min_s, m, q, revision, resultado, idem)
  values (p_practica, p_user, p_apartado, case when v_m < 1 then 'anticipada' else 'confirmada' end, p_respuesta, s.revelado_at, v_seg, v_tmin, v_m, v_q, v_rev,
    jsonb_build_object('status', v_status, 'code', p_resultado ->> 'code'), p_idem);
  perform public.pes_log(p_practica, p_user, p_apartado, case when v_m < 1 then 'apartado_anticipado' else 'apartado_confirmado' end,
    jsonb_build_object('segundos', v_seg, 't_min_s', v_tmin));
  perform public.pes_avanzar(p_practica, p_user, p_apartado);
  -- al estudiante no se le dice si acertó (se publica después): solo que quedó guardado y lo siguiente
  return jsonb_build_object('repetida', false, 'accion', case when v_m < 1 then 'anticipada' else 'confirmada' end, 'actual', public.pes_actual_json(p_practica, p_user));
end $$;

-- Parámetros de la variante del apartado ABIERTO (los calcula «calificar»; nunca la respuesta)
create or replace function public.svc_pes_variante(p_user uuid, p_practica uuid, p_apartado uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.pes_estado;
begin
  perform public.pes_practica_activa(p_practica, p_user);
  select * into s from public.pes_estado where practica_id = p_practica and user_id = p_user;
  if s.estado <> 'apartado_abierto' or s.apartado_id is distinct from p_apartado then raise exception 'Ese apartado no está abierto' using errcode = 'P0001'; end if;
  return jsonb_build_object('plantilla', (select k.clave -> 'variante' ->> 'plantilla' from public.pes_claves k where k.apartado_id = p_apartado),
    'semilla', (select semilla from public.pes_asignaciones where practica_id = p_practica and user_id = p_user));
end $$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['pes_eventos_inmutable()', 'pes_respuesta_cerrada()', 'pes_respuesta_sin_borrado()', 'pes_congelada()', 'pes_claves_congelada()',
    'pes_parametros_congelados()', 'pes_docente(uuid)', 'pes_log(uuid, uuid, uuid, text, jsonb)', 'pes_t_min(uuid, uuid)', 'pes_cierre(uuid, uuid)',
    'pes_liberados(uuid)', 'pes_siguiente(uuid, uuid)', 'pes_avanzar(uuid, uuid, uuid)', 'pes_vencer(uuid, uuid)', 'pes_practica_activa(uuid, uuid)',
    'pes_actual_json(uuid, uuid)', 'pes_formula(numeric, numeric, numeric, numeric, numeric)', 'pes_puntaje(uuid, uuid)',
    'pes_copiar_apartado(uuid, uuid, integer, uuid, numeric, integer, text)', 'pes_pesos(integer, numeric[])',
    'svc_pes_preparar(uuid, uuid, uuid)', 'svc_pes_confirmar(uuid, uuid, uuid, jsonb, jsonb, boolean, uuid)', 'svc_pes_variante(uuid, uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['svc_pes_preparar(uuid, uuid, uuid)', 'svc_pes_confirmar(uuid, uuid, uuid, jsonb, jsonb, boolean, uuid)', 'svc_pes_variante(uuid, uuid, uuid)'] loop
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  foreach f in array array['pes_crear(uuid, jsonb)', 'pes_editar(uuid, jsonb)', 'pes_borrar_practica(uuid)', 'pes_banco_problemas(uuid)',
    'pes_ejercicio_desde_problema(uuid, text, integer, integer, numeric[], integer[])',
    'pes_ejercicio_desde_banco(uuid, uuid[], text, text, numeric[], integer[], text[])', 'pes_ejercicio_redactado(uuid, jsonb)', 'pes_borrar_ejercicio(uuid)',
    'pes_publicar(uuid, uuid[])', 'pes_cambiar_estado(uuid, text)', 'pes_adaptacion(uuid, uuid, integer, numeric, boolean, text)',
    'pes_revisar(uuid, numeric, text)', 'pes_validar(uuid, uuid)', 'pes_publicar_resultados(uuid, boolean)', 'pes_lista_docente(uuid)',
    'pes_detalle_docente(uuid)', 'pes_respuestas_docente(uuid, boolean)',
    'pes_mis_practicas()', 'pes_iniciar(uuid)', 'pes_actual(uuid)', 'pes_borrador(uuid, uuid, text, integer)', 'pes_omitir(uuid, uuid, uuid)',
    'pes_evento_cliente(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
