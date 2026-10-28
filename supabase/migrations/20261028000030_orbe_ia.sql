-- Orbe IA · humor contextual (migración 30). Solo añade tablas y funciones nuevas: no toca datos existentes.
--
-- 1) Los chistes se generan POR LECCIÓN/APARTADO (nunca por estudiante) con la Edge Function «orbe-ia», se
--    guardan aquí y se reutilizan con todos los estudiantes. A Claude solo le llega contexto académico escrito
--    por el profesor (asignatura, unidad, lección, resumen, apartado): ningún dato personal.
-- 2) Todo nace APAGADO: interruptor general, visibilidad para estudiantes, llamadas reales (por defecto el
--    simulador) y aprobación automática (por defecto, modo revisión).
-- 3) Las reglas de aparición (intervalo, actividad reciente, nada durante evaluaciones, sin repetir) y los
--    límites de gasto se aplican en el servidor; el navegador solo las imita para no preguntar en vano.
-- 4) Tablas sin políticas: nadie las lee ni escribe directamente. Estudiantes: orbe_ia_next / orbe_ia_cerrar /
--    orbe_ia_set_pref. Administrador: orbe_ia_admin_*. Edge Function: svc_orbe_ia_* (solo service_role).

create table if not exists public.orbe_ia_config (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,               -- interruptor general (generación y aparición)
  students_enabled boolean not null default false,      -- los estudiantes ven los mensajes
  api_real boolean not null default false,              -- false = simulador: sin llamadas de pago
  auto_approve boolean not null default false,          -- false = modo revisión: el profesor aprueba cada chiste
  auto_generate boolean not null default false,         -- reponer automáticamente cuando se agoten
  events_enabled boolean not null default false,        -- nivel C (eventos académicos)
  interval_minutes integer not null default 10 check (interval_minutes between 1 and 1440),
  min_activity_seconds integer not null default 180 check (min_activity_seconds between 0 and 3600),
  model text not null default 'claude-opus-5-5' check (model in ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5')),
  max_output_tokens integer not null default 3000 check (max_output_tokens between 512 and 8000),
  jokes_per_batch integer not null default 10 check (jokes_per_batch between 1 and 20),
  monthly_budget_usd numeric(10, 2) not null default 2.00 check (monthly_budget_usd between 0 and 1000),
  daily_max_calls integer not null default 20 check (daily_max_calls between 0 and 1000),
  price_input_per_mtok numeric(10, 4) not null default 4.00 check (price_input_per_mtok >= 0),
  price_output_per_mtok numeric(10, 4) not null default 20.00 check (price_output_per_mtok >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.orbe_ia_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.orbe_ia_courses (
  course_id uuid primary key references public.courses (id) on delete cascade,
  enabled boolean not null default false,
  all_lessons boolean not null default false,
  lessons uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.orbe_ia_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  actor_id uuid references public.profiles (id) on delete set null,  -- quién la pidió (profesor) o el estudiante que agotó los chistes
  trigger text not null check (trigger in ('profesor', 'automatico')),
  course_id uuid references public.courses (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  section text,
  apartado text,
  evento text,
  model text not null,
  simulated boolean not null,
  status text not null default 'reservado' check (status in ('reservado', 'ok', 'error')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  reserved_usd numeric(12, 6) not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  jokes_generated integer not null default 0,
  jokes_rejected integer not null default 0,
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,40}$')  -- solo un código: nunca contenido ni datos
);
create index if not exists orbe_ia_usage_fecha_idx on public.orbe_ia_usage (created_at);

create table if not exists public.orbe_ia_jokes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  section text check (section is null or section in ('teoria', 'formulas', 'ejemplos', 'simulacion', 'comprension', 'practica')),
  apartado text check (apartado is null or char_length(apartado) between 1 and 160),
  evento text check (evento is null or evento in ('ejercicio_correcto', 'leccion_terminada', 'actividad_tras_intentos', 'fin_sesion')),
  text text not null check (char_length(text) between 10 and 300),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'eliminado')),
  origin text not null check (origin in ('ia', 'simulador', 'profesor')),
  model text,
  usage_id bigint references public.orbe_ia_usage (id) on delete set null,
  times_shown integer not null default 0,
  edited boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null
);
create index if not exists orbe_ia_jokes_leccion_idx on public.orbe_ia_jokes (lesson_id, section, status);
create index if not exists orbe_ia_jokes_evento_idx on public.orbe_ia_jokes (course_id, evento, status);

create table if not exists public.orbe_ia_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joke_id uuid not null references public.orbe_ia_jokes (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  section text,
  shown_at timestamptz not null default now(),
  closed_at timestamptz,
  action text check (action is null or action in ('cerrado', 'no_mostrar_mas', 'caducado')),
  unique (user_id, joke_id)                                   -- nunca el mismo chiste dos veces a la misma persona
);
create index if not exists orbe_ia_deliveries_user_idx on public.orbe_ia_deliveries (user_id, shown_at desc);

create table if not exists public.orbe_ia_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  disabled boolean not null default false,
  last_request_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.orbe_ia_config enable row level security;
alter table public.orbe_ia_courses enable row level security;
alter table public.orbe_ia_usage enable row level security;
alter table public.orbe_ia_jokes enable row level security;
alter table public.orbe_ia_deliveries enable row level security;
alter table public.orbe_ia_prefs enable row level security;
revoke all on public.orbe_ia_config, public.orbe_ia_courses, public.orbe_ia_usage, public.orbe_ia_jokes,
  public.orbe_ia_deliveries, public.orbe_ia_prefs from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Utilidades

-- Normalización para comparar apartados y evitar chistes duplicados (sin símbolos de Markdown/LaTeX).
create or replace function public.orbe_ia_norm(p text)
returns text
language sql immutable set search_path = ''
as $$ select left(btrim(regexp_replace(lower(regexp_replace(coalesce(p, ''), '[$*_`#\\{}]', '', 'g')), '\s+', ' ', 'g')), 160) $$;

-- Encabezados (## y ###) de la teoría de una lección: los apartados que puede citar el navegador.
create or replace function public.orbe_ia_apartados(p_lesson uuid)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(left(btrim(m[1]), 160)), '{}')
  from public.lessons l, regexp_matches(l.theory, '^#{2,3}[ \t]+([^\n]+)$', 'gn') m
  where l.id = p_lesson
$$;

-- Precio estimado de una llamada con la configuración vigente.
create or replace function public.orbe_ia_costo(p_input integer, p_output integer)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select round(((coalesce(p_input, 0) * c.price_input_per_mtok + coalesce(p_output, 0) * c.price_output_per_mtok) / 1e6)::numeric, 6)
  from public.orbe_ia_config c where c.id = 1
$$;

-- ¿Está Orbe IA habilitado en esa lección (asignatura activada y lección seleccionada)?
create or replace function public.orbe_ia_leccion_habilitada(p_lesson uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lessons l join public.orbe_ia_courses oc on oc.course_id = l.course_id
    where l.id = p_lesson and oc.enabled and (oc.all_lessons or l.id = any (oc.lessons))
  )
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Estudiante: pedir un mensaje. Devuelve {activo:false} si el módulo está apagado para él (el navegador deja de
-- preguntar), un chiste si se cumplen TODAS las reglas, o el motivo por el que no toca todavía.
create or replace function public.orbe_ia_next(p_lesson uuid, p_section text, p_apartado text default null, p_evento text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.orbe_ia_config;
  v_pref public.orbe_ia_prefs;
  v_course uuid;
  v_apartado text;
  v_ultimo timestamptz;
  v_activo integer;
  v_ultimo_latido timestamptz;
  v_joke public.orbe_ia_jokes;
  v_intervalo integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into c from public.orbe_ia_config where id = 1;
  if not public.my_account_ok() or coalesce((select role::text from public.profiles where id = v_uid), '') <> 'student'
     or not coalesce(c.enabled, false) or not c.students_enabled then
    return jsonb_build_object('activo', false);
  end if;
  v_intervalo := c.interval_minutes;

  perform pg_advisory_xact_lock(hashtextextended('orbe-ia:' || v_uid::text, 0));
  select * into v_pref from public.orbe_ia_prefs where user_id = v_uid;
  if found and v_pref.disabled then return jsonb_build_object('activo', false, 'motivo', 'desactivado'); end if;
  -- protección contra solicitudes excesivas: como mucho una consulta cada 30 s
  if found and v_pref.last_request_at > now() - interval '30 seconds' then
    return jsonb_build_object('activo', true, 'motivo', 'demasiado_pronto', 'espera', 30);
  end if;
  insert into public.orbe_ia_prefs (user_id, last_request_at) values (v_uid, now())
    on conflict (user_id) do update set last_request_at = now();

  -- nunca durante una evaluación en curso (aunque el navegador lo intente desde otra pestaña)
  if exists (select 1 from public.attempts t where t.user_id = v_uid and t.status = 'in_progress' and t.mode = 'exam') then
    return jsonb_build_object('activo', true, 'motivo', 'evaluacion');
  end if;

  if p_lesson is null or not public.lesson_visible_to_me(p_lesson) then
    return jsonb_build_object('activo', true, 'motivo', 'contexto');
  end if;
  select l.course_id into v_course from public.lessons l where l.id = p_lesson;
  if not public.orbe_ia_leccion_habilitada(p_lesson) then
    return jsonb_build_object('activo', true, 'motivo', 'leccion_no_habilitada');
  end if;
  -- evento desactivado o desconocido: se atiende como una consulta normal de la lección
  if p_evento is not null and (not c.events_enabled or p_evento not in ('ejercicio_correcto', 'leccion_terminada', 'actividad_tras_intentos', 'fin_sesion')) then
    p_evento := null;
  end if;
  if p_evento is null and (p_section is null or p_section not in ('teoria', 'formulas', 'ejemplos', 'simulacion', 'comprension', 'practica')) then
    return jsonb_build_object('activo', true, 'motivo', 'contexto');
  end if;

  -- intervalo mínimo entre mensajes
  select max(d.shown_at) into v_ultimo from public.orbe_ia_deliveries d where d.user_id = v_uid;
  if v_ultimo is not null and v_ultimo > now() - make_interval(mins => v_intervalo) then
    return jsonb_build_object('activo', true, 'motivo', 'intervalo', 'intervalo_min', v_intervalo,
      'espera', ceil(extract(epoch from (v_ultimo + make_interval(mins => v_intervalo) - now())))::integer);
  end if;

  -- actividad reciente comprobada con el seguimiento de tiempo (no con lo que diga el navegador)
  select coalesce(sum(v.effective_seconds), 0), max(v.last_beat_at) into v_activo, v_ultimo_latido
    from public.study_visits v where v.user_id = v_uid and v.last_beat_at > now() - interval '20 minutes';
  if v_activo < c.min_activity_seconds or v_ultimo_latido is null or v_ultimo_latido < now() - interval '3 minutes' then
    return jsonb_build_object('activo', true, 'motivo', 'actividad', 'intervalo_min', v_intervalo);
  end if;

  -- apartado: solo si coincide con un encabezado real de la teoría (el texto que se usa es el del profesor)
  if p_apartado is not null and p_evento is null then
    select a into v_apartado from unnest(public.orbe_ia_apartados(p_lesson)) a
      where public.orbe_ia_norm(a) = public.orbe_ia_norm(p_apartado) limit 1;
  end if;

  -- selección: aprobados, nunca vistos por este estudiante; primero el apartado, luego la subsección y la
  -- lección; entre ellos, los menos mostrados (rotación) y al azar
  select j.* into v_joke from public.orbe_ia_jokes j
  where j.status = 'aprobado'
    and not exists (select 1 from public.orbe_ia_deliveries d where d.user_id = v_uid and d.joke_id = j.id)
    and (
      (p_evento is not null and j.evento = p_evento and j.course_id = v_course and (j.lesson_id is null or j.lesson_id = p_lesson))
      or (p_evento is null and j.evento is null and j.lesson_id = p_lesson and (j.section is null or j.section = p_section)
          and (j.apartado is null or (v_apartado is not null and j.apartado = v_apartado)))
    )
  order by (case when j.apartado is not null then 0 when j.section is not null then 1 else 2 end), j.times_shown, random()
  limit 1;

  if not found then
    return jsonb_build_object('activo', true, 'motivo', 'sin_chistes', 'reponer', c.auto_generate, 'intervalo_min', v_intervalo,
      'apartado', v_apartado);
  end if;

  insert into public.orbe_ia_deliveries (user_id, joke_id, lesson_id, section) values (v_uid, v_joke.id, p_lesson, coalesce(p_section, p_evento));
  update public.orbe_ia_jokes set times_shown = times_shown + 1 where id = v_joke.id;
  return jsonb_build_object('activo', true, 'chiste', jsonb_build_object('id', v_joke.id, 'texto', v_joke.text), 'intervalo_min', v_intervalo);
end;
$$;

-- Estudiante: cerró el mensaje (o pidió no volver a verlos).
create or replace function public.orbe_ia_cerrar(p_joke uuid, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_action not in ('cerrado', 'no_mostrar_mas', 'caducado') then raise exception 'Acción no válida' using errcode = '22023'; end if;
  update public.orbe_ia_deliveries set closed_at = coalesce(closed_at, now()), action = coalesce(action, p_action)
    where user_id = auth.uid() and joke_id = p_joke;
  if p_action = 'no_mostrar_mas' then perform public.orbe_ia_set_pref(true); end if;
end;
$$;

-- Estudiante: activar o desactivar los mensajes de Orbe IA para sí mismo.
create or replace function public.orbe_ia_set_pref(p_disabled boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  insert into public.orbe_ia_prefs (user_id, disabled, updated_at) values (auth.uid(), coalesce(p_disabled, false), now())
    on conflict (user_id) do update set disabled = coalesce(p_disabled, false), updated_at = now();
  return jsonb_build_object('disabled', coalesce(p_disabled, false));
end;
$$;

create or replace function public.orbe_ia_my_pref()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'disabled', coalesce((select p.disabled from public.orbe_ia_prefs p where p.user_id = auth.uid()), false),
    'disponible', coalesce((select c.enabled and c.students_enabled from public.orbe_ia_config c where c.id = 1), false))
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Administrador (el profesor). Todas comprueban is_admin() en el servidor.

create or replace function public.orbe_ia_assert_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede gestionar Orbe IA' using errcode = '42501'; end if;
end;
$$;

create or replace function public.orbe_ia_admin_get()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_mes timestamptz := date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
        v_hoy timestamptz := date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
begin
  perform public.orbe_ia_assert_admin();
  return jsonb_build_object(
    'config', (select to_jsonb(c) - 'id' from public.orbe_ia_config c where c.id = 1),
    'cursos', (select coalesce(jsonb_agg(jsonb_build_object('course_id', co.id, 'titulo', co.title, 'archivada', co.archived,
        'enabled', coalesce(oc.enabled, false), 'all_lessons', coalesce(oc.all_lessons, false), 'lessons', coalesce(to_jsonb(oc.lessons), '[]'::jsonb),
        'pendientes', (select count(*) from public.orbe_ia_jokes j where j.course_id = co.id and j.status = 'pendiente'),
        'aprobados', (select count(*) from public.orbe_ia_jokes j where j.course_id = co.id and j.status = 'aprobado'))
        order by co.archived, co.title), '[]'::jsonb)
      from public.courses co left join public.orbe_ia_courses oc on oc.course_id = co.id),
    'estadisticas', jsonb_build_object(
      'chistes', (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb) from (select status, count(*) n from public.orbe_ia_jokes group by status) s),
      'mostrados', (select count(*) from public.orbe_ia_deliveries),
      'mostrados_7d', (select count(*) from public.orbe_ia_deliveries where shown_at > now() - interval '7 days'),
      'estudiantes_alcanzados', (select count(distinct user_id) from public.orbe_ia_deliveries),
      'cerrados_al_instante', (select count(*) from public.orbe_ia_deliveries where closed_at < shown_at + interval '3 seconds'),
      'no_mostrar_mas', (select count(*) from public.orbe_ia_deliveries where action = 'no_mostrar_mas'),
      'estudiantes_desactivados', (select count(*) from public.orbe_ia_prefs where disabled),
      'gasto_mes_usd', (select coalesce(sum(cost_usd), 0) from public.orbe_ia_usage where created_at >= v_mes and not simulated and status = 'ok'),
      'tokens_mes', (select jsonb_build_object('entrada', coalesce(sum(input_tokens), 0), 'salida', coalesce(sum(output_tokens), 0))
                     from public.orbe_ia_usage where created_at >= v_mes and not simulated),
      'llamadas_hoy', (select count(*) from public.orbe_ia_usage where created_at >= v_hoy),
      'llamadas_reales_mes', (select count(*) from public.orbe_ia_usage where created_at >= v_mes and not simulated),
      'errores_mes', (select count(*) from public.orbe_ia_usage where created_at >= v_mes and status = 'error')),
    'consumo', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select u.id, u.created_at, u.trigger, u.model, u.simulated, u.status, u.input_tokens, u.output_tokens, u.cost_usd,
             u.jokes_generated, u.jokes_rejected, u.error_code, u.section, u.apartado, u.evento, l.title leccion
      from public.orbe_ia_usage u left join public.lessons l on l.id = u.lesson_id order by u.created_at desc limit 60) x)
  );
end;
$$;

-- Cambia la configuración. Solo las claves presentes en p; los valores los validan los CHECK de la tabla.
create or replace function public.orbe_ia_admin_set_config(p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.orbe_ia_assert_admin();
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Configuración no válida' using errcode = '22023'; end if;
  update public.orbe_ia_config c set
    enabled = coalesce((p ->> 'enabled')::boolean, c.enabled),
    students_enabled = coalesce((p ->> 'students_enabled')::boolean, c.students_enabled),
    api_real = coalesce((p ->> 'api_real')::boolean, c.api_real),
    auto_approve = coalesce((p ->> 'auto_approve')::boolean, c.auto_approve),
    auto_generate = coalesce((p ->> 'auto_generate')::boolean, c.auto_generate),
    events_enabled = coalesce((p ->> 'events_enabled')::boolean, c.events_enabled),
    interval_minutes = coalesce((p ->> 'interval_minutes')::integer, c.interval_minutes),
    min_activity_seconds = coalesce((p ->> 'min_activity_seconds')::integer, c.min_activity_seconds),
    model = coalesce(p ->> 'model', c.model),
    max_output_tokens = coalesce((p ->> 'max_output_tokens')::integer, c.max_output_tokens),
    jokes_per_batch = coalesce((p ->> 'jokes_per_batch')::integer, c.jokes_per_batch),
    monthly_budget_usd = coalesce((p ->> 'monthly_budget_usd')::numeric, c.monthly_budget_usd),
    daily_max_calls = coalesce((p ->> 'daily_max_calls')::integer, c.daily_max_calls),
    price_input_per_mtok = coalesce((p ->> 'price_input_per_mtok')::numeric, c.price_input_per_mtok),
    price_output_per_mtok = coalesce((p ->> 'price_output_per_mtok')::numeric, c.price_output_per_mtok),
    updated_at = now(), updated_by = auth.uid()
  where c.id = 1;
  return (select to_jsonb(c) - 'id' from public.orbe_ia_config c where c.id = 1);
end;
$$;

create or replace function public.orbe_ia_admin_set_course(p_course uuid, p_enabled boolean, p_all_lessons boolean, p_lessons uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.orbe_ia_assert_admin();
  if not exists (select 1 from public.courses where id = p_course) then raise exception 'Asignatura inexistente' using errcode = '22023'; end if;
  insert into public.orbe_ia_courses (course_id, enabled, all_lessons, lessons, updated_at)
  values (p_course, coalesce(p_enabled, false), coalesce(p_all_lessons, false),
          coalesce((select array_agg(l.id) from public.lessons l where l.course_id = p_course and l.id = any (coalesce(p_lessons, '{}'))), '{}'), now())
  on conflict (course_id) do update set enabled = excluded.enabled, all_lessons = excluded.all_lessons, lessons = excluded.lessons, updated_at = now();
end;
$$;

-- Lecciones de una asignatura con sus apartados y el recuento de chistes.
create or replace function public.orbe_ia_admin_lessons(p_course uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.orbe_ia_assert_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('lesson_id', l.id, 'titulo', l.title, 'unidad', u.title, 'oculta', l.hidden or u.hidden,
      'apartados', to_jsonb(public.orbe_ia_apartados(l.id)),
      'pendientes', (select count(*) from public.orbe_ia_jokes j where j.lesson_id = l.id and j.status = 'pendiente'),
      'aprobados', (select count(*) from public.orbe_ia_jokes j where j.lesson_id = l.id and j.status = 'aprobado'))
      order by u.position, l.position), '[]'::jsonb)
    from public.lessons l join public.units u on u.id = l.unit_id where l.course_id = p_course);
end;
$$;

create or replace function public.orbe_ia_admin_jokes(p_course uuid, p_lesson uuid default null, p_status text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.orbe_ia_assert_admin();
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select j.id, j.lesson_id, l.title leccion, j.section, j.apartado, j.evento, j.text, j.status, j.origin, j.model,
           j.times_shown, j.edited, j.created_at, j.reviewed_at
    from public.orbe_ia_jokes j left join public.lessons l on l.id = j.lesson_id
    where j.course_id = p_course and (p_lesson is null or j.lesson_id = p_lesson)
      and (p_status is null and j.status <> 'eliminado' or j.status = p_status)
    order by j.created_at desc limit 400) x);
end;
$$;

-- Aprobar, devolver a revisión, eliminar o editar un chiste.
create or replace function public.orbe_ia_admin_joke(p_joke uuid, p_action text, p_text text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_text text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
begin
  perform public.orbe_ia_assert_admin();
  if p_action = 'editar' then
    if char_length(v_text) not between 10 and 300 then raise exception 'El chiste debe tener entre 10 y 300 caracteres' using errcode = '22023'; end if;
    update public.orbe_ia_jokes set text = v_text, edited = true, reviewed_at = now(), reviewed_by = auth.uid() where id = p_joke;
  elsif p_action in ('aprobado', 'pendiente', 'eliminado') then
    update public.orbe_ia_jokes set status = p_action, reviewed_at = now(), reviewed_by = auth.uid() where id = p_joke;
  else
    raise exception 'Acción no válida' using errcode = '22023';
  end if;
  if not found then raise exception 'Chiste no encontrado' using errcode = 'P0002'; end if;
end;
$$;

-- El profesor escribe un chiste propio (queda aprobado).
create or replace function public.orbe_ia_admin_add(p_lesson uuid, p_section text, p_text text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_course uuid; v_id uuid; v_text text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
begin
  perform public.orbe_ia_assert_admin();
  select course_id into v_course from public.lessons where id = p_lesson;
  if v_course is null then raise exception 'Lección inexistente' using errcode = '22023'; end if;
  insert into public.orbe_ia_jokes (course_id, lesson_id, section, text, status, origin, reviewed_at, reviewed_by)
  values (v_course, p_lesson, nullif(p_section, ''), v_text, 'aprobado', 'profesor', now(), auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Edge Function «orbe-ia» (solo service_role). Reserva: comprueba permisos, reglas y presupuesto ANTES de
-- llamar a la API, y devuelve el contexto académico mínimo. Finalización: registra el consumo y guarda los
-- chistes ya validados.

create or replace function public.svc_orbe_ia_reservar(p_actor uuid, p_trigger text, p_lesson uuid, p_section text,
  p_apartado text default null, p_evento text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c public.orbe_ia_config;
  v_course uuid; v_unit_title text; v_lesson_title text; v_summary text; v_course_title text;
  v_apartado text;
  v_est numeric; v_gastado numeric; v_reservado numeric; v_llamadas integer;
  v_usage bigint;
  v_hoy timestamptz := date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
begin
  perform pg_advisory_xact_lock(hashtextextended('orbe-ia-presupuesto', 0));
  select * into c from public.orbe_ia_config where id = 1;
  if not c.enabled then return jsonb_build_object('ok', false, 'motivo', 'apagado'); end if;
  if p_trigger not in ('profesor', 'automatico') then return jsonb_build_object('ok', false, 'motivo', 'trigger'); end if;

  select l.course_id, l.title, l.summary, u.title, co.title into v_course, v_lesson_title, v_summary, v_unit_title, v_course_title
    from public.lessons l join public.units u on u.id = l.unit_id join public.courses co on co.id = l.course_id where l.id = p_lesson;
  if v_course is null then return jsonb_build_object('ok', false, 'motivo', 'leccion'); end if;
  if p_evento is not null then
    if p_evento not in ('ejercicio_correcto', 'leccion_terminada', 'actividad_tras_intentos', 'fin_sesion') then return jsonb_build_object('ok', false, 'motivo', 'evento'); end if;
    p_section := null; p_apartado := null;
  elsif p_section is not null and p_section not in ('teoria', 'formulas', 'ejemplos', 'simulacion', 'comprension', 'practica') then
    return jsonb_build_object('ok', false, 'motivo', 'seccion');
  end if;
  if p_apartado is not null then
    select a into v_apartado from unnest(public.orbe_ia_apartados(p_lesson)) a where public.orbe_ia_norm(a) = public.orbe_ia_norm(p_apartado) limit 1;
    if v_apartado is null then return jsonb_build_object('ok', false, 'motivo', 'apartado'); end if;
  end if;

  if p_trigger = 'profesor' then
    if not exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'admin' and p.active and p.suspended_at is null) then
      return jsonb_build_object('ok', false, 'motivo', 'permiso');
    end if;
    if (select count(*) from public.orbe_ia_jokes j where j.lesson_id = p_lesson and j.status <> 'eliminado') >= 200 then
      return jsonb_build_object('ok', false, 'motivo', 'suficientes');
    end if;
  else
    -- reposición automática pedida por un estudiante que se quedó sin chistes en esa lección
    if not c.students_enabled or not c.auto_generate then return jsonb_build_object('ok', false, 'motivo', 'auto_apagado'); end if;
    if not exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'student' and p.active and p.suspended_at is null)
       or not exists (select 1 from public.enrollments e join public.classes cl on cl.id = e.class_id where e.user_id = p_actor and cl.course_id = v_course)
       or exists (select 1 from public.lessons l join public.units u on u.id = l.unit_id where l.id = p_lesson and (l.hidden or u.hidden or u.status <> 'publicado')) then
      return jsonb_build_object('ok', false, 'motivo', 'permiso');
    end if;
    if not public.orbe_ia_leccion_habilitada(p_lesson) then return jsonb_build_object('ok', false, 'motivo', 'leccion_no_habilitada'); end if;
    if p_evento is not null and not c.events_enabled then return jsonb_build_object('ok', false, 'motivo', 'evento_no_habilitado'); end if;
    -- aún le quedan chistes por ver: no hace falta generar
    if exists (select 1 from public.orbe_ia_jokes j where j.status = 'aprobado' and j.lesson_id = p_lesson
               and j.evento is not distinct from p_evento
               and not exists (select 1 from public.orbe_ia_deliveries d where d.user_id = p_actor and d.joke_id = j.id)) then
      return jsonb_build_object('ok', false, 'motivo', 'quedan_chistes');
    end if;
    -- en modo revisión, no acumular: si ya hay un lote esperando aprobación, no se genera otro
    if (select count(*) from public.orbe_ia_jokes j where j.lesson_id = p_lesson and j.status = 'pendiente') >= c.jokes_per_batch then
      return jsonb_build_object('ok', false, 'motivo', 'pendientes_revision');
    end if;
    -- sin estampidas: una sola generación automática por lección cada 10 minutos
    if exists (select 1 from public.orbe_ia_usage u where u.lesson_id = p_lesson and u.trigger = 'automatico' and u.created_at > now() - interval '10 minutes') then
      return jsonb_build_object('ok', false, 'motivo', 'en_curso');
    end if;
    if (select count(*) from public.orbe_ia_jokes j where j.lesson_id = p_lesson and j.status <> 'eliminado') >= 60 then
      return jsonb_build_object('ok', false, 'motivo', 'suficientes');
    end if;
  end if;

  -- límites de consumo: llamadas diarias (también simuladas) y presupuesto mensual (solo llamadas reales)
  select count(*) into v_llamadas from public.orbe_ia_usage where created_at >= v_hoy;
  if v_llamadas >= c.daily_max_calls then return jsonb_build_object('ok', false, 'motivo', 'limite_diario'); end if;
  v_est := case when c.api_real then public.orbe_ia_costo(4000, c.max_output_tokens) else 0 end;
  if c.api_real then
    select coalesce(sum(cost_usd), 0) into v_gastado from public.orbe_ia_usage where created_at >= v_mes and status = 'ok' and not simulated;
    select coalesce(sum(reserved_usd), 0) into v_reservado from public.orbe_ia_usage
      where status = 'reservado' and not simulated and created_at > now() - interval '15 minutes';
    if v_gastado + v_reservado + v_est > c.monthly_budget_usd then return jsonb_build_object('ok', false, 'motivo', 'presupuesto'); end if;
  end if;

  insert into public.orbe_ia_usage (actor_id, trigger, course_id, lesson_id, section, apartado, evento, model, simulated, reserved_usd)
  values (p_actor, p_trigger, v_course, p_lesson, p_section, v_apartado, p_evento, c.model, not c.api_real, v_est) returning id into v_usage;

  return jsonb_build_object('ok', true, 'usage_id', v_usage, 'api_real', c.api_real, 'model', c.model,
    'max_tokens', c.max_output_tokens, 'n', c.jokes_per_batch,
    'contexto', jsonb_build_object('asignatura', v_course_title, 'unidad', v_unit_title, 'leccion', v_lesson_title,
      'resumen', left(coalesce(v_summary, ''), 400), 'seccion', p_section, 'apartado', v_apartado, 'evento', p_evento),
    'existentes', (select coalesce(jsonb_agg(left(x.text, 300)), '[]'::jsonb) from (
      select j.text from public.orbe_ia_jokes j where j.lesson_id = p_lesson and j.status <> 'eliminado'
        and j.evento is not distinct from p_evento order by j.created_at desc limit 20) x));
end;
$$;

create or replace function public.svc_orbe_ia_finalizar(p_usage bigint, p_ok boolean, p_input integer, p_output integer,
  p_textos text[], p_rechazados integer, p_error text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u public.orbe_ia_usage;
  c public.orbe_ia_config;
  t text; v_ins integer := 0; v_dup integer := 0;
begin
  select * into u from public.orbe_ia_usage where id = p_usage for update;
  if not found or u.status <> 'reservado' then raise exception 'Reserva no válida' using errcode = '22023'; end if;
  select * into c from public.orbe_ia_config where id = 1;
  if p_ok then
    foreach t in array coalesce(p_textos, '{}') loop
      t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
      -- segunda barrera (la primera está en la Edge Function): longitud, sin enlaces ni marcas HTML
      if char_length(t) not between 10 and 300 or t ~* '(https?://|www\.|<|>)' then continue; end if;
      -- duplicado = mismas letras y cifras (ignora mayúsculas, espacios y puntuación), como en la Edge Function
      if exists (select 1 from public.orbe_ia_jokes j where j.lesson_id is not distinct from u.lesson_id
                 and regexp_replace(lower(j.text), '[^[:alnum:]]+', '', 'g') = regexp_replace(lower(t), '[^[:alnum:]]+', '', 'g')) then
        v_dup := v_dup + 1; continue;
      end if;
      insert into public.orbe_ia_jokes (course_id, lesson_id, section, apartado, evento, text, status, origin, model, usage_id)
      values (u.course_id, u.lesson_id, u.section, u.apartado, u.evento, t,
              case when c.auto_approve then 'aprobado' else 'pendiente' end,
              case when u.simulated then 'simulador' else 'ia' end, u.model, u.id);
      v_ins := v_ins + 1;
    end loop;
  end if;
  update public.orbe_ia_usage set
    status = case when p_ok then 'ok' else 'error' end,
    finished_at = now(),
    input_tokens = greatest(coalesce(p_input, 0), 0),
    output_tokens = greatest(coalesce(p_output, 0), 0),
    cost_usd = case when u.simulated then 0 else public.orbe_ia_costo(p_input, p_output) end,
    reserved_usd = 0,
    jokes_generated = v_ins,
    jokes_rejected = greatest(coalesce(p_rechazados, 0), 0) + v_dup,
    error_code = case when p_ok then null else left(regexp_replace(lower(coalesce(p_error, 'error')), '[^a-z0-9_]', '_', 'g'), 40) end
  where id = p_usage;
  return jsonb_build_object('insertados', v_ins, 'duplicados', v_dup, 'aprobados', c.auto_approve and v_ins > 0);
end;
$$;

-- Edge Function: ¿quién llama? (solo el rol; nada más del perfil)
create or replace function public.svc_orbe_ia_rol(p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$ select p.role::text from public.profiles p where p.id = p_user and p.active and p.suspended_at is null $$;

-- ---------------------------------------------------------------------------------------------------------
-- Permisos
revoke all on function public.orbe_ia_norm(text) from public, anon, authenticated;
revoke all on function public.orbe_ia_apartados(uuid) from public, anon, authenticated;
revoke all on function public.orbe_ia_costo(integer, integer) from public, anon, authenticated;
revoke all on function public.orbe_ia_leccion_habilitada(uuid) from public, anon, authenticated;
revoke all on function public.orbe_ia_assert_admin() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['orbe_ia_next(uuid, text, text, text)', 'orbe_ia_cerrar(uuid, text)', 'orbe_ia_set_pref(boolean)', 'orbe_ia_my_pref()',
    'orbe_ia_admin_get()', 'orbe_ia_admin_set_config(jsonb)', 'orbe_ia_admin_set_course(uuid, boolean, boolean, uuid[])', 'orbe_ia_admin_lessons(uuid)',
    'orbe_ia_admin_jokes(uuid, uuid, text)', 'orbe_ia_admin_joke(uuid, text, text)', 'orbe_ia_admin_add(uuid, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['svc_orbe_ia_reservar(uuid, text, uuid, text, text, text)', 'svc_orbe_ia_finalizar(bigint, boolean, integer, integer, text[], integer, text)',
    'svc_orbe_ia_rol(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
