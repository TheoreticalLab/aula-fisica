-- =============================================================================
-- Prácticas de Control + VTA (Verificación de Transferencia y Autonomía) — migración 62.
-- Evaluación breve (3–10 min), individual y presencial, que el profesor prepara y ACTIVA desde la asistencia, con un
-- problema de transferencia distinto para cada estudiante. Puede ajustar parcialmente la nota de una práctica:
--     N_final = N_original × [1 − w × (1 − C)]      (C = resultado confirmado del control, 0–1; w ≤ 0,30)
-- Decisiones (ver docs/PRACTICAS_DE_CONTROL.md):
--  · Reutiliza el motor de exámenes: el control es una actividad 'exam' oculta con UN ejercicio por intento
--    (attempt_item_orders, que ya respetan get_attempt, la entrega y recompute_attempt), reloj oficial del servidor
--    (exam_deadline), autoguardado con revisión, reconexión, prórrogas (exam_extensions) y cierre (acción finalize).
--  · La nota original NUNCA se modifica: el ajuste se calcula al leer (control_factor) en official_scores; así no
--    puede aplicarse dos veces. Varias verificaciones de una práctica: cuenta el MEJOR resultado confirmado (regla
--    agregada única, sin descuentos encadenados).
--  · Sin retroactividad: la política aplicable es la anunciada ANTES de la primera entrega del estudiante; si no hay,
--    el control es solo diagnóstico. Las políticas son inmutables (una versión nueva por cambio).
--  · Sin reducción mientras haya corrección pendiente, incidencia, ausencia, exención o sesión cancelada; y solo
--    después de que el profesor CONFIRME el resultado.
--  · Las soluciones siguen en exercise_keys (solo profesorado); el catálogo de transferencia es solo del profesorado.
-- Aditiva. Redefine activity_visible_to_me (migración 4), official_scores (16) y my_grade_breakdown (17) copiándolas.
-- =============================================================================

-- Límite institucional de la reducción máxima (w)
create or replace function public.control_w_max() returns numeric language sql immutable set search_path = '' as $$ select 0.30::numeric $$;

-- 1) Catálogo de problemas de transferencia (metadatos; el enunciado y la clave son un ejercicio normal del banco)
create table if not exists public.control_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  origen_exercise_id uuid references public.exercises (id) on delete set null,
  tipo text not null check (tipo in ('contextual', 'parametrica', 'conceptual', 'estructural')),
  competencia text not null check (char_length(competencia) between 1 and 80),
  competencias_secundarias text[] not null default '{}',
  minutos numeric(4, 1) not null check (minutos between 1 and 10),
  hipotesis text check (hipotesis is null or char_length(hipotesis) <= 1000),
  justificacion text not null check (char_length(justificacion) between 10 and 1500),
  rubrica jsonb not null default '[]'::jsonb check (jsonb_typeof(rubrica) = 'array'),
  generador text not null default 'docente' check (generador in ('docente', 'plantilla', 'ia')),
  generador_version text,
  validacion jsonb not null default '{}'::jsonb,
  estado text not null default 'propuesto' check (estado in ('propuesto', 'aprobado', 'rechazado')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revisado_por uuid references public.profiles (id) on delete set null,
  revisado_at timestamptz,
  unique nulls not distinct (exercise_id, origen_exercise_id)
);

-- 2) Política de nota por práctica: versionada e inmutable (se anuncia al crearla)
create table if not exists public.control_policies (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  version integer not null,
  w numeric(3, 2) not null default 0.20 check (w >= 0 and w <= 0.30),
  duracion_min integer not null default 7 check (duracion_min between 3 and 10),
  condiciones text not null default '' check (char_length(condiciones) <= 1500),
  politica_ayudas text not null default '' check (char_length(politica_ayudas) <= 1000),
  activa boolean not null default true,
  announced_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  unique (activity_id, version)
);
create index if not exists control_policies_activity_idx on public.control_policies (activity_id, announced_at);

-- 3) Sesiones de control y asignaciones individuales
create table if not exists public.control_sessions (
  id uuid primary key default gen_random_uuid(),
  practice_activity_id uuid not null references public.activities (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  attendance_session_id uuid references public.attendance_sessions (id) on delete set null,
  control_activity_id uuid unique references public.activities (id) on delete set null,
  duracion_min integer not null check (duracion_min between 3 and 10),
  ventana_tardia_min integer not null default 5 check (ventana_tardia_min between 0 and 15),
  recuperacion boolean not null default false,
  estado text not null default 'preparado' check (estado in ('preparado', 'activo', 'cerrado', 'cancelado')),
  semilla bigint not null,
  client_id uuid unique,
  motivo_cancelacion text,
  preparado_por uuid references public.profiles (id) on delete set null,
  preparado_at timestamptz not null default now(),
  iniciado_at timestamptz,
  cerrado_at timestamptz,
  cancelado_at timestamptz
);
create unique index if not exists control_sessions_una_abierta on public.control_sessions (practice_activity_id) where estado in ('preparado', 'activo');
create index if not exists control_sessions_class_idx on public.control_sessions (class_id, preparado_at desc);

create table if not exists public.control_assignments (
  session_id uuid not null references public.control_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  estado text not null check (estado in ('elegible', 'ausente', 'sin_entrega', 'exento', 'sin_ejercicio')),
  exercise_id uuid references public.exercises (id) on delete set null,
  control_item_id uuid references public.control_items (id) on delete set null,
  origen_exercise_id uuid references public.exercises (id) on delete set null,
  tipo text,
  competencia text,
  seleccion jsonb,
  extra_min integer not null default 0 check (extra_min between 0 and 20),
  extra_motivo text check (extra_motivo is null or char_length(extra_motivo) <= 200),
  attempt_id uuid references public.attempts (id) on delete set null,
  incidencia text check (incidencia is null or char_length(incidencia) <= 300),
  exencion text check (exencion is null or char_length(exencion) <= 300),
  confirmado_at timestamptz,
  confirmado_por uuid references public.profiles (id) on delete set null,
  primary key (session_id, user_id)
);
create index if not exists control_assignments_user_idx on public.control_assignments (user_id);
create index if not exists control_assignments_attempt_idx on public.control_assignments (attempt_id);

-- 4) Trazabilidad de toda acción del profesor (exenciones, sustituciones, confirmaciones, cancelaciones…)
create table if not exists public.control_audit (
  id bigint generated always as identity primary key,
  session_id uuid references public.control_sessions (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists control_audit_session_idx on public.control_audit (session_id, created_at);

alter table public.control_items enable row level security;
alter table public.control_policies enable row level security;
alter table public.control_sessions enable row level security;
alter table public.control_assignments enable row level security;
alter table public.control_audit enable row level security;
revoke all on public.control_items, public.control_policies, public.control_sessions, public.control_assignments, public.control_audit from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.control_session_teacher(p_session uuid)
returns public.control_sessions
language plpgsql stable security definer set search_path = ''
as $$
declare s public.control_sessions;
begin
  select * into s from public.control_sessions where id = p_session;
  if s.id is null or not public.is_class_teacher(s.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return s;
end;
$$;

create or replace function public.control_log(p_session uuid, p_user uuid, p_accion text, p_detalle jsonb)
returns void language sql security definer set search_path = ''
as $$ insert into public.control_audit (session_id, user_id, accion, detalle, actor) values (p_session, p_user, p_accion, coalesce(p_detalle, '{}'::jsonb), auth.uid()) $$;

-- Tiempo estimado de un ejercicio del banco sin ficha de transferencia (heurística documentada)
create or replace function public.control_minutos_estimados(p_format public.exercise_format, p_difficulty public.exercise_difficulty)
returns numeric language sql immutable set search_path = ''
as $$ select case p_format when 'choice' then 2 when 'truefalse' then 2 when 'text' then 3 when 'open' then 8
  else case p_difficulty when 'basico' then 4 when 'intermedio' then 6 else 9 end end::numeric $$;

-- Azar controlado y reproducible: uniforme en [0, 1) a partir de la semilla de la sesión
create or replace function public.control_azar(p_semilla bigint, p_user uuid, p_exercise uuid)
returns numeric language sql immutable set search_path = ''
as $$ select (('x' || substr(md5(p_semilla::text || ':' || p_user::text || ':' || p_exercise::text), 1, 8))::bit(32)::bigint)::numeric / 4294967296 $$;

-- Política aplicable a un estudiante: la última anunciada ANTES (o en el momento) de su primera entrega de la práctica
create or replace function public.control_politica_aplicable(p_activity uuid, p_user uuid)
returns public.control_policies
language sql stable security definer set search_path = ''
as $$
  select p.* from public.control_policies p
  where p.activity_id = p_activity and p.activa
    and p.announced_at <= (select min(t.submitted_at) from public.attempts t where t.activity_id = p_activity and t.user_id = p_user and t.status = 'submitted')
  order by p.announced_at desc limit 1
$$;

-- Resultado confirmado del control (0–1) que cuenta para la nota: el mejor de las sesiones válidas, o null
create or replace function public.control_resultado(p_activity uuid, p_user uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select max(t.score / nullif(t.max_score, 0))
  from public.control_sessions s
  join public.control_assignments a on a.session_id = s.id and a.user_id = p_user
  join public.attempts t on t.id = a.attempt_id
  where s.practice_activity_id = p_activity and s.estado in ('activo', 'cerrado')
    and a.estado = 'elegible' and a.confirmado_at is not null and a.incidencia is null
    and t.status = 'submitted' and not t.needs_review
$$;

-- Factor que multiplica la nota original de la práctica: 1 − w·(1 − C); 1 si no hay control aplicable
create or replace function public.control_factor(p_activity uuid, p_user uuid)
returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare p public.control_policies; c numeric;
begin
  if not exists (select 1 from public.control_sessions s where s.practice_activity_id = p_activity) then return 1; end if;
  p := public.control_politica_aplicable(p_activity, p_user);
  if p.id is null then return 1; end if;
  c := public.control_resultado(p_activity, p_user);
  if c is null then return 1; end if;
  return 1 - p.w * (1 - least(1, greatest(0, c)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Política de la práctica (profesor) y aviso (estudiante)
-- -----------------------------------------------------------------------------
create or replace function public.control_politica_guardar(p_activity uuid, p_w numeric, p_duracion integer, p_condiciones text, p_politica_ayudas text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities; v integer; r public.control_policies;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if act.mode <> 'practice' then raise exception 'Las Prácticas de Control se vinculan a prácticas, no a evaluaciones' using errcode = 'P0001'; end if;
  if p_w is null or p_w < 0 or p_w > public.control_w_max() then raise exception 'La reducción máxima debe estar entre 0 %% y %s %%', round(100 * public.control_w_max()) using errcode = '22023'; end if;
  if p_duracion is null or p_duracion < 3 or p_duracion > 10 then raise exception 'La duración debe ser de 3 a 10 minutos' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('control_politica' || p_activity::text, 0));
  update public.control_policies set activa = false where activity_id = p_activity and activa;
  select coalesce(max(version), 0) + 1 into v from public.control_policies where activity_id = p_activity;
  insert into public.control_policies (activity_id, version, w, duracion_min, condiciones, politica_ayudas, created_by)
    values (p_activity, v, round(p_w, 2), p_duracion, left(coalesce(p_condiciones, ''), 1500), left(coalesce(p_politica_ayudas, ''), 1000), auth.uid())
    returning * into r;
  return to_jsonb(r) || jsonb_build_object('entregas_previas',
    (select count(distinct t.user_id) from public.attempts t where t.activity_id = p_activity and t.status = 'submitted'));
end;
$$;

-- Retirar la política vigente: no afecta a quien ya entregó con ella anunciada (eso sería retroactivo al revés)
create or replace function public.control_politica_retirar(p_activity uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  insert into public.control_policies (activity_id, version, w, duracion_min, condiciones, politica_ayudas, activa, created_by)
    select p_activity, coalesce(max(version), 0) + 1, 0, 7, 'Política retirada: los controles posteriores no ajustan la nota de quien entregue desde ahora.', '', true, auth.uid()
    from public.control_policies where activity_id = p_activity;
end;
$$;

-- Aviso de verificación (estudiante con la actividad visible, o profesor): última política anunciada
create or replace function public.control_aviso(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities; p public.control_policies;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null then return null; end if;
  if not (public.activity_visible_to_me(p_activity) or public.is_class_teacher(act.class_id)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into p from public.control_policies where activity_id = p_activity and activa order by announced_at desc limit 1;
  if p.id is null or p.w = 0 then return null; end if;
  return jsonb_build_object('version', p.version, 'w', p.w, 'duracion_min', p.duracion_min, 'condiciones', p.condiciones,
    'politica_ayudas', p.politica_ayudas, 'announced_at', p.announced_at,
    -- vínculo con la versión: la política que se aplicará a este estudiante (si ya entregó) y si se le aplica
    'aplicable_a_mi', (select to_jsonb(x) - 'created_by' from public.control_politica_aplicable(p_activity, auth.uid()) x where x.id is not null));
end;
$$;

-- -----------------------------------------------------------------------------
-- Catálogo de transferencia (profesor)
-- -----------------------------------------------------------------------------
create or replace function public.control_item_guardar(p_item jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e public.exercises; v_origen uuid; r public.control_items; v_rub jsonb; v_estado text; v_key jsonb; v_suma numeric;
begin
  select * into e from public.exercises where id = (p_item ->> 'exercise_id')::uuid;
  if e.id is null then raise exception 'Ejercicio no encontrado' using errcode = 'P0001'; end if;
  perform public.course_assert_teacher(e.course_id);
  v_origen := nullif(p_item ->> 'origen_exercise_id', '')::uuid;
  if v_origen = e.id then raise exception 'El problema de control no puede ser el mismo ejercicio de la práctica' using errcode = '22023'; end if;
  v_rub := coalesce(p_item -> 'rubrica', '[]'::jsonb);
  if jsonb_typeof(v_rub) <> 'array' or jsonb_array_length(v_rub) > 8 then raise exception 'Rúbrica inválida (lista de hasta 8 criterios)' using errcode = '22023'; end if;
  select sum((c ->> 'peso')::numeric) into v_suma from jsonb_array_elements(v_rub) c;
  if jsonb_array_length(v_rub) > 0 and (v_suma is null or abs(v_suma - 100) > 0.01) then raise exception 'Los pesos de la rúbrica deben sumar 100' using errcode = '22023'; end if;
  v_estado := coalesce(p_item ->> 'estado', 'propuesto');
  if v_estado = 'aprobado' then
    -- validación mínima del lado del servidor: clave presente y coherente con el formato; las abiertas necesitan rúbrica
    select k.answer into v_key from public.exercise_keys k where k.exercise_id = e.id;
    if v_key is null then raise exception 'No se puede aprobar: el ejercicio no tiene clave' using errcode = 'P0001'; end if;
    if v_key ->> 'format' <> e.format::text then raise exception 'No se puede aprobar: la clave no coincide con el formato' using errcode = 'P0001'; end if;
    if e.format = 'open' and jsonb_array_length(v_rub) = 0 then raise exception 'No se puede aprobar una pregunta abierta sin rúbrica' using errcode = 'P0001'; end if;
    if not e.published then raise exception 'No se puede aprobar: publique antes el ejercicio en el banco (revisión docente)' using errcode = 'P0001'; end if;
  end if;
  insert into public.control_items (course_id, exercise_id, origen_exercise_id, tipo, competencia, competencias_secundarias, minutos, hipotesis,
      justificacion, rubrica, generador, generador_version, validacion, estado, created_by, revisado_por, revisado_at)
    values (e.course_id, e.id, v_origen, p_item ->> 'tipo', p_item ->> 'competencia',
      coalesce((select array_agg(x) from jsonb_array_elements_text(p_item -> 'competencias_secundarias') x), '{}'),
      (p_item ->> 'minutos')::numeric, nullif(p_item ->> 'hipotesis', ''), p_item ->> 'justificacion', v_rub,
      coalesce(p_item ->> 'generador', 'docente'), p_item ->> 'generador_version', coalesce(p_item -> 'validacion', '{}'::jsonb),
      v_estado, auth.uid(), case when v_estado <> 'propuesto' then auth.uid() end, case when v_estado <> 'propuesto' then now() end)
    on conflict (exercise_id, origen_exercise_id) do update set tipo = excluded.tipo, competencia = excluded.competencia,
      competencias_secundarias = excluded.competencias_secundarias, minutos = excluded.minutos, hipotesis = excluded.hipotesis,
      justificacion = excluded.justificacion, rubrica = excluded.rubrica, validacion = excluded.validacion, estado = excluded.estado,
      revisado_por = excluded.revisado_por, revisado_at = excluded.revisado_at
    returning * into r;
  return to_jsonb(r);
end;
$$;

-- Candidatos para una práctica: catálogo existente y sugerencias del banco (mismos conceptos, no repetidos)
create or replace function public.control_catalogo(p_practice uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities; v_course uuid; v_conceptos text[];
begin
  select * into act from public.activities where id = p_practice;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select c.course_id into v_course from public.classes c where c.id = act.class_id;
  select coalesce(array_agg(distinct x), '{}') into v_conceptos from public.activity_items i join public.exercises e on e.id = i.exercise_id, unnest(e.concepts) x where i.activity_id = p_practice;
  return jsonb_build_object(
    'conceptos', to_jsonb(v_conceptos),
    'originales', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', e.id, 'slug', e.slug, 'prompt', left(e.prompt, 400), 'concepts', e.concepts,
        'difficulty', e.difficulty, 'format', e.format) order by i.position), '[]'::jsonb)
      from public.activity_items i join public.exercises e on e.id = i.exercise_id where i.activity_id = p_practice),
    'catalogo', (select coalesce(jsonb_agg(to_jsonb(ci) || jsonb_build_object('slug', e.slug, 'prompt', left(e.prompt, 400), 'format', e.format, 'published', e.published)
        order by ci.created_at), '[]'::jsonb)
      from public.control_items ci join public.exercises e on e.id = ci.exercise_id
      where ci.course_id = v_course and (ci.origen_exercise_id in (select i.exercise_id from public.activity_items i where i.activity_id = p_practice)
        or (ci.origen_exercise_id is null and ci.competencia = any (v_conceptos)))),
    'sugerencias', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', e.id, 'slug', e.slug, 'prompt', left(e.prompt, 400), 'concepts', e.concepts,
        'difficulty', e.difficulty, 'format', e.format, 'minutos', public.control_minutos_estimados(e.format, e.difficulty))
        order by e.slug), '[]'::jsonb)
      from public.exercises e
      where e.course_id = v_course and e.published and e.concepts && v_conceptos
        and not exists (select 1 from public.activity_items i where i.activity_id = p_practice and i.exercise_id = e.id)
        and not exists (select 1 from public.control_items ci where ci.exercise_id = e.id and ci.estado = 'rechazado')
        and exists (select 1 from public.exercise_keys k where k.exercise_id = e.id)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Selección individual (algoritmo documentado en docs/PRACTICAS_DE_CONTROL.md; espejo en src/lib/control.ts)
--   puntaje = 0,30·necesidad + 0,25·diagnóstico + 0,15·cobertura + 0,10·tiempo + 0,10·validación + 0,10·azar
-- -----------------------------------------------------------------------------
create or replace function public.control_seleccionar(p_session uuid, p_user uuid default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare s public.control_sessions; v_course uuid; a record; best record; n integer := 0; v_asignados integer;
begin
  select * into s from public.control_sessions where id = p_session;
  select c.course_id into v_course from public.classes c where c.id = s.class_id;
  for a in
    select x.* from public.control_assignments x
    where x.session_id = p_session and x.estado in ('elegible', 'sin_ejercicio') and x.attempt_id is null
      and (p_user is null or x.user_id = p_user)
    order by md5(s.semilla::text || x.user_id::text)
  loop
    select count(*) into v_asignados from public.control_assignments z where z.session_id = p_session and z.exercise_id is not null and z.user_id <> a.user_id;
    with practica as (
      select i.exercise_id, e.concepts, e.difficulty,
        -- resultado del estudiante en ese ítem de la práctica (última entrega): evidencia de que existe un producto
        (select coalesce(r.manual_credit, r.auto_credit) from public.responses r join public.attempts t on t.id = r.attempt_id
          where t.activity_id = s.practice_activity_id and t.user_id = a.user_id and t.status = 'submitted' and r.exercise_id = i.exercise_id
          order by t.submitted_at desc limit 1) credito,
        -- ayuda declarada en la práctica asistida: dato pedagógico (autonomía no verificada), nunca una penalización
        exists (select 1 from public.assisted_steps st join public.attempts t on t.id = st.attempt_id
          where t.activity_id = s.practice_activity_id and st.user_id = a.user_id and st.exercise_id = i.exercise_id
            and st.fase = 'inicial' and st.declaracion = 'consulto_ayuda') ayuda
      from public.activity_items i join public.exercises e on e.id = i.exercise_id where i.activity_id = s.practice_activity_id
    ),
    cand as (
      -- a) catálogo aprobado: transferencia de un ítem de la práctica, o pregunta validada de una de sus competencias
      select ci.exercise_id, ci.id control_item_id, ci.origen_exercise_id, ci.tipo, ci.competencia, ci.minutos, 1.0 validado
      from public.control_items ci join public.exercises e on e.id = ci.exercise_id
      where ci.course_id = v_course and ci.estado = 'aprobado' and e.published and ci.minutos <= s.duracion_min
        and (ci.origen_exercise_id in (select p.exercise_id from practica p)
             or (ci.origen_exercise_id is null and exists (select 1 from practica p where ci.competencia = any (p.concepts))))
      union all
      -- b) respaldo: ejercicio publicado del banco con clave, de una competencia de la práctica, que quepa en el tiempo
      select e.id, null, null, 'banco', (select x from unnest(e.concepts) x where exists (select 1 from practica p where x = any (p.concepts)) limit 1),
             public.control_minutos_estimados(e.format, e.difficulty), 0.5
      from public.exercises e
      where e.course_id = v_course and e.published and e.format <> 'open'
        and exists (select 1 from practica p where p.concepts && e.concepts)
        and not exists (select 1 from practica p where p.exercise_id = e.id)
        and not exists (select 1 from public.control_items ci where ci.exercise_id = e.id)
        and exists (select 1 from public.exercise_keys k where k.exercise_id = e.id)
        and public.control_minutos_estimados(e.format, e.difficulty) <= s.duracion_min
    ),
    comp as (
      select c.*,
        -- necesidad: 1 − dominio demostrado en condiciones supervisadas (evaluaciones y controles) en esa competencia
        1 - coalesce((select avg(coalesce(r.manual_credit, r.auto_credit)) from (
            select r.manual_credit, r.auto_credit from public.responses r join public.attempts t on t.id = r.attempt_id
              join public.exercises e2 on e2.id = r.exercise_id
            where t.user_id = a.user_id and t.mode = 'exam' and t.status = 'submitted' and c.competencia = any (e2.concepts)
            order by t.submitted_at desc limit 10) r), 0) necesidad,
        -- diagnóstico: un producto correcto en la práctica sin verificación supervisada es la evidencia más útil
        least(1, coalesce((select case when max(p.credito) >= 0.8 then 1.0 when max(p.credito) >= 0.4 then 0.7 else 0.4 end
                             + case when bool_or(p.ayuda) then 0.1 else 0 end
                           from practica p where p.exercise_id = c.origen_exercise_id or (c.origen_exercise_id is null and c.competencia = any (p.concepts))), 0.4)) diagnostico,
        -- cobertura: evita que toda la sección reciba la misma competencia o el mismo ejercicio
        1 - 0.5 * (select count(*) from public.control_assignments z where z.session_id = p_session and z.user_id <> a.user_id and z.competencia = c.competencia)::numeric / (v_asignados + 1)
          - 0.5 * (select count(*) from public.control_assignments z where z.session_id = p_session and z.user_id <> a.user_id and z.exercise_id = c.exercise_id)::numeric / (v_asignados + 1) cobertura,
        greatest(0, 1 - abs(c.minutos / s.duracion_min - 0.7)) tiempo,
        public.control_azar(s.semilla, a.user_id, c.exercise_id) azar
      from cand c
    ),
    total as (
      select comp.*, round(0.30 * necesidad + 0.25 * diagnostico + 0.15 * cobertura + 0.10 * tiempo + 0.10 * validado + 0.10 * azar, 4) puntaje
      from comp
    )
    select t.*, (select jsonb_agg(jsonb_build_object('exercise_id', t2.exercise_id, 'puntaje', t2.puntaje) order by t2.puntaje desc)
                 from (select * from total order by puntaje desc limit 4) t2) alternativas
      into best from total t order by t.puntaje desc, t.exercise_id limit 1;
    if best.exercise_id is null then
      update public.control_assignments set estado = 'sin_ejercicio', exercise_id = null, seleccion = jsonb_build_object('motivo', 'sin candidatos que quepan en el tiempo')
        where session_id = p_session and user_id = a.user_id;
    else
      update public.control_assignments set estado = 'elegible', exercise_id = best.exercise_id, control_item_id = best.control_item_id,
          origen_exercise_id = best.origen_exercise_id, tipo = best.tipo, competencia = best.competencia,
          seleccion = jsonb_build_object('version', 'vta-sel-1', 'semilla', s.semilla, 'puntaje', best.puntaje, 'necesidad', round(best.necesidad, 3),
            'diagnostico', round(best.diagnostico, 3), 'cobertura', round(best.cobertura, 3), 'tiempo', round(best.tiempo, 3),
            'validado', best.validado, 'azar', round(best.azar, 3), 'minutos', best.minutos, 'alternativas', best.alternativas)
        where session_id = p_session and user_id = a.user_id;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- La actividad del control contiene los ejercicios asignados (cada intento ve solo el suyo)
create or replace function public.control_sincronizar_items(p_session uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.activity_items (activity_id, exercise_id, position, points)
    select s.control_activity_id, x.exercise_id, row_number() over (order by x.exercise_id) + coalesce((select max(i.position) from public.activity_items i where i.activity_id = s.control_activity_id), 0), 1
    from public.control_sessions s
    join (select distinct a.exercise_id from public.control_assignments a where a.session_id = p_session and a.exercise_id is not null) x on true
    where s.id = p_session
      and not exists (select 1 from public.activity_items i where i.activity_id = s.control_activity_id and i.exercise_id = x.exercise_id)
$$;

-- -----------------------------------------------------------------------------
-- Ciclo de vida: preparar → (sustituir / exentar / tiempo adicional) → iniciar → (tardíos) → cerrar → confirmar
-- -----------------------------------------------------------------------------
create or replace function public.control_preparar(p_practice uuid, p_attendance uuid, p_duracion integer, p_client_id uuid, p_recuperacion boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities; s public.control_sessions; v_att public.attendance_sessions; v_ctrl uuid; v_course uuid;
begin
  if p_client_id is null then raise exception 'Falta el identificador de la petición' using errcode = '22023'; end if;
  select * into s from public.control_sessions where client_id = p_client_id;
  if found then perform public.control_session_teacher(s.id); return public.control_live(s.id); end if;   -- reintento: idempotente
  select * into act from public.activities where id = p_practice;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if act.mode <> 'practice' then raise exception 'Seleccione una práctica' using errcode = 'P0001'; end if;
  if p_duracion is null or p_duracion < 3 or p_duracion > 10 then raise exception 'La duración debe ser de 3 a 10 minutos' using errcode = '22023'; end if;
  if p_attendance is not null then
    select * into v_att from public.attendance_sessions where id = p_attendance;
    if v_att.id is null or v_att.class_id <> act.class_id then raise exception 'La asistencia no es de la sección de esta práctica' using errcode = 'P0001'; end if;
  end if;
  if exists (select 1 from public.control_sessions x where x.practice_activity_id = p_practice and x.estado in ('preparado', 'activo')) then
    raise exception 'Ya hay una Práctica de Control preparada o en curso para esta práctica' using errcode = 'P0001'; end if;
  select c.course_id into v_course from public.classes c where c.id = act.class_id;
  -- actividad de evaluación oculta (motor de exámenes); se publica al iniciar
  insert into public.activities (class_id, group_id, title, instructions, mode, opens_at, closes_at, max_attempts, max_tries_per_item, reveal_policy, hints_enabled, published, created_by)
    values (act.class_id, act.group_id, left('Práctica de Control · ' || act.title, 160),
      'Práctica de Control: problema individual de transferencia sobre lo trabajado en «' || act.title || '». Resuélvalo sin ayudas externas, salvo las que indique el profesor.',
      'exam', null, now() + interval '1 day', 1, 1, 'after_close', false, false, auth.uid())
    returning id into v_ctrl;
  insert into public.exam_settings (activity_id, presentacion, navegacion, duracion_s, updated_by) values (v_ctrl, 'una_a_la_vez', 'libre', p_duracion * 60, auth.uid());
  insert into public.control_sessions (practice_activity_id, class_id, attendance_session_id, control_activity_id, duracion_min, recuperacion, semilla, client_id, preparado_por)
    values (p_practice, act.class_id, p_attendance, v_ctrl, p_duracion, coalesce(p_recuperacion, false),
      ('x' || substr(md5(p_client_id::text), 1, 12))::bit(48)::bigint, p_client_id, auth.uid())
    returning * into s;
  -- todos los estudiantes de la sección (o del grupo de la práctica): elegible si entregó la práctica
  insert into public.control_assignments (session_id, user_id, estado)
    select s.id, e.user_id,
      case when exists (select 1 from public.attempts t where t.activity_id = p_practice and t.user_id = e.user_id and t.status = 'submitted') then 'elegible' else 'sin_entrega' end
    from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' and p.active
    where e.class_id = act.class_id and (act.group_id is null or e.group_id = act.group_id);
  perform public.control_seleccionar(s.id);
  perform public.control_sincronizar_items(s.id);
  perform public.control_log(s.id, null, 'preparar', jsonb_build_object('duracion_min', p_duracion, 'asistencia', p_attendance, 'recuperacion', p_recuperacion));
  return public.control_live(s.id);
end;
$$;

create or replace function public.control_sustituir(p_session uuid, p_user uuid, p_exercise uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.control_sessions; a public.control_assignments; e public.exercises; v_course uuid; ci public.control_items;
begin
  s := public.control_session_teacher(p_session);
  if s.estado not in ('preparado', 'activo') then raise exception 'La sesión ya terminó' using errcode = 'P0001'; end if;
  select * into a from public.control_assignments where session_id = p_session and user_id = p_user for update;
  if a.user_id is null or a.estado not in ('elegible', 'sin_ejercicio') then raise exception 'Este estudiante no está en condiciones de recibir el control' using errcode = 'P0001'; end if;
  if a.attempt_id is not null then raise exception 'El estudiante ya comenzó: no se puede cambiar su problema' using errcode = 'P0001'; end if;
  select c.course_id into v_course from public.classes c where c.id = s.class_id;
  select * into e from public.exercises where id = p_exercise;
  if e.id is null or e.course_id <> v_course or not e.published then raise exception 'Ejercicio no disponible para esta asignatura' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.exercise_keys k where k.exercise_id = e.id) then raise exception 'El ejercicio no tiene clave' using errcode = 'P0001'; end if;
  if exists (select 1 from public.activity_items i where i.activity_id = s.practice_activity_id and i.exercise_id = e.id) then
    raise exception 'Es un ejercicio de la propia práctica: el control debe ser de transferencia' using errcode = 'P0001'; end if;
  select * into ci from public.control_items where exercise_id = e.id and estado = 'aprobado' order by created_at limit 1;
  update public.control_assignments set estado = 'elegible', exercise_id = e.id, control_item_id = ci.id, origen_exercise_id = ci.origen_exercise_id,
      tipo = coalesce(ci.tipo, 'banco'), competencia = coalesce(ci.competencia, e.concepts[1]),
      seleccion = coalesce(a.seleccion, '{}'::jsonb) || jsonb_build_object('sustituido_por_docente', true, 'anterior', a.exercise_id)
    where session_id = p_session and user_id = p_user;
  perform public.control_sincronizar_items(p_session);
  perform public.control_log(p_session, p_user, 'sustituir', jsonb_build_object('anterior', a.exercise_id, 'nuevo', e.id));
  return public.control_live(p_session);
end;
$$;

create or replace function public.control_exentar(p_session uuid, p_user uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.control_sessions; a public.control_assignments;
begin
  s := public.control_session_teacher(p_session);
  select * into a from public.control_assignments where session_id = p_session and user_id = p_user for update;
  if a.user_id is null then raise exception 'Estudiante no encontrado en esta sesión' using errcode = 'P0001'; end if;
  if nullif(trim(p_motivo), '') is null then
    -- quitar la exención: vuelve a su estado anterior según la práctica
    if a.estado <> 'exento' then return public.control_live(p_session); end if;
    update public.control_assignments set exencion = null,
        estado = case when exists (select 1 from public.attempts t where t.activity_id = s.practice_activity_id and t.user_id = p_user and t.status = 'submitted') then 'elegible' else 'sin_entrega' end
      where session_id = p_session and user_id = p_user;
    if s.estado = 'preparado' then perform public.control_seleccionar(p_session, p_user); perform public.control_sincronizar_items(p_session); end if;
  else
    if a.attempt_id is not null then raise exception 'El estudiante ya comenzó: registre una incidencia en lugar de una exención' using errcode = 'P0001'; end if;
    update public.control_assignments set estado = 'exento', exencion = left(trim(p_motivo), 300) where session_id = p_session and user_id = p_user;
  end if;
  perform public.control_log(p_session, p_user, 'exencion', jsonb_build_object('motivo', p_motivo));
  return public.control_live(p_session);
end;
$$;

-- Tiempo adicional justificado: antes de empezar se guarda; si ya empezó, se aplica como prórroga del examen
create or replace function public.control_tiempo_extra(p_session uuid, p_user uuid, p_minutos integer, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.control_sessions; a public.control_assignments; v_lim timestamptz;
begin
  s := public.control_session_teacher(p_session);
  if s.estado not in ('preparado', 'activo') then raise exception 'La sesión ya terminó' using errcode = 'P0001'; end if;
  if p_minutos is null or p_minutos < 0 or p_minutos > 20 then raise exception 'El tiempo adicional debe ser de 0 a 20 minutos' using errcode = '22023'; end if;
  if p_minutos > 0 and nullif(trim(p_motivo), '') is null then raise exception 'Indique el motivo del tiempo adicional' using errcode = '22023'; end if;
  select * into a from public.control_assignments where session_id = p_session and user_id = p_user for update;
  if a.user_id is null then raise exception 'Estudiante no encontrado en esta sesión' using errcode = 'P0001'; end if;
  if a.attempt_id is not null and exists (select 1 from public.exam_sessions es where es.attempt_id = a.attempt_id) then
    if p_minutos <= a.extra_min then raise exception 'Ya comenzó: solo se puede añadir tiempo' using errcode = 'P0001'; end if;
    update public.exam_sessions set extra_s = extra_s + (p_minutos - a.extra_min) * 60 where attempt_id = a.attempt_id;
    insert into public.exam_extensions (attempt_id, teacher_id, segundos, motivo) values (a.attempt_id, auth.uid(), (p_minutos - a.extra_min) * 60, left('Práctica de Control: ' || trim(p_motivo), 200));
    v_lim := public.exam_deadline(a.attempt_id);
  end if;
  update public.control_assignments set extra_min = p_minutos, extra_motivo = left(nullif(trim(p_motivo), ''), 200) where session_id = p_session and user_id = p_user;
  -- la ventana de la actividad no debe recortar el tiempo concedido
  if s.estado = 'activo' then
    update public.activities set closes_at = greatest(closes_at, now() + make_interval(mins => s.duracion_min + p_minutos + 1)) where id = s.control_activity_id;
  end if;
  perform public.control_log(p_session, p_user, 'tiempo_extra', jsonb_build_object('minutos', p_minutos, 'motivo', p_motivo));
  return public.control_live(p_session);
end;
$$;

-- Iniciar: SOLO lo hace el profesor, después de comprobar la asistencia. Los presentes y elegibles reciben su control.
create or replace function public.control_iniciar(p_session uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.control_sessions; v_n integer; v_extra integer;
begin
  s := public.control_session_teacher(p_session);
  perform pg_advisory_xact_lock(hashtextextended('control' || p_session::text, 0));
  select * into s from public.control_sessions where id = p_session;
  if s.estado = 'activo' then return public.control_live(p_session); end if;    -- doble clic: idempotente
  if s.estado <> 'preparado' then raise exception 'Esta Práctica de Control ya terminó o fue cancelada' using errcode = 'P0001'; end if;
  if s.attendance_session_id is not null then
    update public.control_assignments a set estado = 'ausente'
      where a.session_id = p_session and a.estado in ('elegible', 'sin_ejercicio')
        and not exists (select 1 from public.attendance_records r where r.session_id = s.attendance_session_id and r.user_id = a.user_id);
  end if;
  select count(*), coalesce(max(extra_min), 0) into v_n, v_extra from public.control_assignments where session_id = p_session and estado = 'elegible' and exercise_id is not null;
  if v_n = 0 then raise exception 'No hay estudiantes presentes y elegibles con un problema asignado' using errcode = 'P0001'; end if;
  update public.activities set published = true, opens_at = now() - interval '5 seconds',
      closes_at = now() + make_interval(mins => s.duracion_min + v_extra + s.ventana_tardia_min + 1)
    where id = s.control_activity_id;
  update public.control_sessions set estado = 'activo', iniciado_at = now() where id = p_session;
  perform public.control_log(p_session, null, 'iniciar', jsonb_build_object('estudiantes', v_n));
  return public.control_live(p_session);
end;
$$;

-- Llegada tardía o estudiante presente que no recibió el control: se le asigna y se amplía la ventana si hace falta
create or replace function public.control_agregar(p_session uuid, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.control_sessions; a public.control_assignments;
begin
  s := public.control_session_teacher(p_session);
  if s.estado not in ('preparado', 'activo') then raise exception 'La sesión ya terminó' using errcode = 'P0001'; end if;
  select * into a from public.control_assignments where session_id = p_session and user_id = p_user for update;
  if a.user_id is null then raise exception 'Estudiante no encontrado en esta sesión' using errcode = 'P0001'; end if;
  if a.estado = 'sin_entrega' then raise exception 'No entregó la práctica: no hay producto que verificar (la política no añade penalización)' using errcode = 'P0001'; end if;
  if a.estado = 'exento' then raise exception 'Primero retire la exención' using errcode = 'P0001'; end if;
  if a.estado = 'ausente' then update public.control_assignments set estado = 'elegible' where session_id = p_session and user_id = p_user; end if;
  if a.exercise_id is null then perform public.control_seleccionar(p_session, p_user); end if;
  perform public.control_sincronizar_items(p_session);
  if s.estado = 'activo' then
    update public.activities set closes_at = greatest(closes_at, now() + make_interval(mins => s.duracion_min + a.extra_min + 2)) where id = s.control_activity_id;
  end if;
  perform public.control_log(p_session, p_user, 'agregar', '{}'::jsonb);
  return public.control_live(p_session);
end;
$$;

create or replace function public.control_cancelar(p_session uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.control_sessions;
begin
  s := public.control_session_teacher(p_session);
  if s.estado in ('cerrado', 'cancelado') then raise exception 'La sesión ya terminó' using errcode = 'P0001'; end if;
  -- activación accidental: la sesión cancelada no ajusta ninguna nota; los intentos se conservan para auditoría
  update public.control_sessions set estado = 'cancelado', cancelado_at = now(), motivo_cancelacion = left(nullif(trim(p_motivo), ''), 300) where id = p_session;
  update public.activities set published = false where id = s.control_activity_id;
  perform public.control_log(p_session, null, 'cancelar', jsonb_build_object('motivo', p_motivo, 'estaba', s.estado));
  return public.control_live(p_session);
end;
$$;

-- Cerrar: nadie más puede empezar; los intentos abiertos los entrega la acción «finalize» de calificar (lo hace la interfaz)
create or replace function public.control_cerrar(p_session uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.control_sessions;
begin
  s := public.control_session_teacher(p_session);
  if s.estado = 'cerrado' then return public.control_live(p_session); end if;
  if s.estado <> 'activo' then raise exception 'Solo se cierra una Práctica de Control en curso' using errcode = 'P0001'; end if;
  update public.control_sessions set estado = 'cerrado', cerrado_at = now() where id = p_session;
  update public.activities set closes_at = least(closes_at, now()) where id = s.control_activity_id and closes_at > now();
  perform public.control_log(p_session, null, 'cerrar', '{}'::jsonb);
  return public.control_live(p_session);
end;
$$;

-- Incidencia técnica (o quitarla con texto vacío): mientras exista, el control no ajusta la nota
create or replace function public.control_incidencia(p_session uuid, p_user uuid, p_texto text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.control_session_teacher(p_session);
  update public.control_assignments set incidencia = left(nullif(trim(p_texto), ''), 300),
      confirmado_at = case when nullif(trim(p_texto), '') is not null then null else confirmado_at end,
      confirmado_por = case when nullif(trim(p_texto), '') is not null then null else confirmado_por end
    where session_id = p_session and user_id = p_user;
  if not found then raise exception 'Estudiante no encontrado en esta sesión' using errcode = 'P0001'; end if;
  perform public.control_log(p_session, p_user, 'incidencia', jsonb_build_object('texto', p_texto));
  return public.control_live(p_session);
end;
$$;

-- Confirmar resultados (todos los listos o los indicados). Solo se confirma lo entregado, sin corrección pendiente ni incidencia.
create or replace function public.control_confirmar(p_session uuid, p_users uuid[] default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.control_sessions; n integer;
begin
  s := public.control_session_teacher(p_session);
  if s.estado <> 'cerrado' then raise exception 'Cierre primero la Práctica de Control' using errcode = 'P0001'; end if;
  update public.control_assignments a set confirmado_at = now(), confirmado_por = auth.uid()
    from public.attempts t
    where a.session_id = p_session and t.id = a.attempt_id and a.estado = 'elegible' and a.incidencia is null and a.confirmado_at is null
      and t.status = 'submitted' and not t.needs_review and (p_users is null or a.user_id = any (p_users));
  get diagnostics n = row_count;
  perform public.control_log(p_session, null, 'confirmar', jsonb_build_object('confirmados', n, 'usuarios', p_users));
  return public.control_live(p_session) || jsonb_build_object('confirmados', n);
end;
$$;

-- Revertir la confirmación de un estudiante (p. ej. tras una revisión): el ajuste deja de aplicarse
create or replace function public.control_desconfirmar(p_session uuid, p_user uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.control_session_teacher(p_session);
  if nullif(trim(p_motivo), '') is null then raise exception 'Indique el motivo' using errcode = '22023'; end if;
  update public.control_assignments set confirmado_at = null, confirmado_por = null where session_id = p_session and user_id = p_user;
  perform public.control_log(p_session, p_user, 'desconfirmar', jsonb_build_object('motivo', p_motivo));
  return public.control_live(p_session);
end;
$$;

-- -----------------------------------------------------------------------------
-- Vista en vivo (profesor), historial y ajustes
-- -----------------------------------------------------------------------------
create or replace function public.control_live(p_session uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.control_sessions; act public.activities; ctrl public.activities;
begin
  s := public.control_session_teacher(p_session);
  select * into act from public.activities where id = s.practice_activity_id;
  select * into ctrl from public.activities where id = s.control_activity_id;
  return jsonb_build_object(
    'session', to_jsonb(s) - 'client_id',
    'server_now', now(),
    'practica', jsonb_build_object('id', act.id, 'title', act.title, 'opens_at', act.opens_at, 'closes_at', act.closes_at, 'created_at', act.created_at,
      'curso', (select k.title from public.classes c join public.courses k on k.id = c.course_id where c.id = act.class_id),
      'seccion', (select c.name from public.classes c where c.id = act.class_id)),
    'control', jsonb_build_object('id', ctrl.id, 'opens_at', ctrl.opens_at, 'closes_at', ctrl.closes_at, 'published', ctrl.published),
    'politica', (select to_jsonb(p) - 'created_by' from public.control_policies p where p.activity_id = act.id and p.activa order by p.announced_at desc limit 1),
    'estudiantes', (select coalesce(jsonb_agg(x order by x ->> 'nombre'), '[]'::jsonb) from (
      select jsonb_build_object(
        'user_id', a.user_id, 'nombre', pr.full_name, 'estado_elegibilidad', a.estado, 'exencion', a.exencion, 'incidencia', a.incidencia,
        'presente', case when s.attendance_session_id is null then null else exists (select 1 from public.attendance_records r where r.session_id = s.attendance_session_id and r.user_id = a.user_id) end,
        'exercise_id', a.exercise_id, 'slug', e.slug, 'enunciado', left(e.prompt, 600), 'formato', e.format, 'tipo', a.tipo, 'competencia', a.competencia,
        'minutos', (a.seleccion ->> 'minutos')::numeric, 'seleccion', a.seleccion, 'extra_min', a.extra_min, 'extra_motivo', a.extra_motivo,
        'attempt_id', a.attempt_id, 'confirmado_at', a.confirmado_at,
        'resultado', case when t.status = 'submitted' then round(100 * t.score / nullif(t.max_score, 0), 1) end,
        'en_blanco', t.status = 'submitted' and exists (select 1 from public.responses r where r.attempt_id = t.id and (r.answer is null or r.answer = '{}'::jsonb or coalesce(trim(r.answer ->> 'text'), '') = '' and r.answer -> 'selected' is null and r.answer -> 'value' is null)),
        'limite', case when t.id is not null then public.exam_deadline(t.id) end,
        'estado', case
          when a.estado <> 'elegible' then a.estado
          when a.incidencia is not null then 'incidencia'
          when s.estado = 'cancelado' then 'cancelado'
          when t.id is null then case when s.estado = 'cerrado' then 'no_inicio' else 'pendiente_inicio' end
          when t.status = 'in_progress' then case when now() > public.exam_deadline(t.id) then 'tiempo_agotado' else 'en_desarrollo' end
          when t.needs_review then 'correccion_pendiente'
          when a.confirmado_at is not null then 'confirmado'
          else 'corregido' end,
        'nota_practica', (select round(100 * max(p.score / nullif(p.max_score, 0)), 1) from public.attempts p where p.activity_id = s.practice_activity_id and p.user_id = a.user_id and p.status = 'submitted'),
        'politica_aplicable', (select x.version from public.control_politica_aplicable(s.practice_activity_id, a.user_id) x),
        'factor', round(public.control_factor(s.practice_activity_id, a.user_id), 4)) x
      from public.control_assignments a join public.profiles pr on pr.id = a.user_id
      left join public.exercises e on e.id = a.exercise_id left join public.attempts t on t.id = a.attempt_id
      where a.session_id = p_session) q));
end;
$$;

create or replace function public.control_sesiones(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'practica', a.title, 'practice_activity_id', s.practice_activity_id, 'estado', s.estado,
      'recuperacion', s.recuperacion, 'duracion_min', s.duracion_min, 'preparado_at', s.preparado_at, 'iniciado_at', s.iniciado_at, 'cerrado_at', s.cerrado_at,
      'asignados', (select count(*) from public.control_assignments x where x.session_id = s.id and x.estado = 'elegible'),
      'entregados', (select count(*) from public.control_assignments x join public.attempts t on t.id = x.attempt_id where x.session_id = s.id and t.status = 'submitted'),
      'confirmados', (select count(*) from public.control_assignments x where x.session_id = s.id and x.confirmado_at is not null)) order by s.preparado_at desc), '[]'::jsonb)
    from public.control_sessions s join public.activities a on a.id = s.practice_activity_id where s.class_id = p_class);
end;
$$;

-- Prácticas de la sección que se pueden verificar (selector «Práctica de Control» de la asistencia)
create or replace function public.control_practicas(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'opens_at', a.opens_at, 'closes_at', a.closes_at, 'created_at', a.created_at,
      'curso', k.title, 'seccion', c.name,
      'entregaron', (select count(distinct t.user_id) from public.attempts t where t.activity_id = a.id and t.status = 'submitted'),
      'politica', (select jsonb_build_object('version', p.version, 'w', p.w, 'duracion_min', p.duracion_min, 'announced_at', p.announced_at)
                   from public.control_policies p where p.activity_id = a.id and p.activa order by p.announced_at desc limit 1),
      'abierta', (select s.id from public.control_sessions s where s.practice_activity_id = a.id and s.estado in ('preparado', 'activo'))) order by a.created_at desc), '[]'::jsonb)
    from public.activities a join public.classes c on c.id = a.class_id join public.courses k on k.id = c.course_id
    where a.class_id = p_class and a.mode = 'practice' and a.published
      and not exists (select 1 from public.control_sessions s2 where s2.control_activity_id = a.id));
end;
$$;

-- Ajustes de la nota: original, control, w, factor y final, por estudiante (lo que usa el Registro)
create or replace function public.control_ajustes(p_practice uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_practice;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', e.user_id, 'nombre', pr.full_name,
      'original', round(100 * o.pct, 2), 'control', round(100 * public.control_resultado(p_practice, e.user_id), 1),
      'politica', (select jsonb_build_object('version', x.version, 'w', x.w) from public.control_politica_aplicable(p_practice, e.user_id) x where x.id is not null),
      'factor', round(public.control_factor(p_practice, e.user_id), 4),
      'final', round(100 * o.pct * public.control_factor(p_practice, e.user_id), 2)) order by pr.full_name), '[]'::jsonb)
    from public.enrollments e join public.profiles pr on pr.id = e.user_id and pr.role = 'student'
    left join lateral (select max(t.score / nullif(t.max_score, 0)) pct from public.attempts t where t.activity_id = p_practice and t.user_id = e.user_id and t.status = 'submitted') o on true
    where e.class_id = act.class_id);
end;
$$;

-- Revisión docente de un control: enunciado, respuesta, solución de referencia y rúbrica. Se califica con
-- grade_response (existente: nota manual con traza en response_events y recálculo del intento).
create or replace function public.control_revision(p_session uuid, p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare a public.control_assignments;
begin
  perform public.control_session_teacher(p_session);
  select * into a from public.control_assignments where session_id = p_session and user_id = p_user;
  if a.user_id is null then raise exception 'Estudiante no encontrado en esta sesión' using errcode = 'P0001'; end if;
  return (select jsonb_build_object(
      'nombre', pr.full_name, 'competencia', a.competencia, 'tipo', a.tipo, 'incidencia', a.incidencia, 'confirmado_at', a.confirmado_at,
      'ejercicio', jsonb_build_object('id', e.id, 'slug', e.slug, 'prompt', e.prompt, 'format', e.format, 'options', e.options, 'difficulty', e.difficulty),
      'clave', k.answer, 'solucion', k.explanation,
      'ficha', (select jsonb_build_object('rubrica', ci.rubrica, 'hipotesis', ci.hipotesis, 'justificacion', ci.justificacion, 'minutos', ci.minutos)
                from public.control_items ci where ci.id = a.control_item_id),
      'respuesta', (select jsonb_build_object('id', r.id, 'answer', r.answer, 'status', r.status, 'auto_credit', r.auto_credit, 'manual_credit', r.manual_credit,
                      'feedback', r.teacher_feedback, 'graded_at', r.graded_at)
                    from public.responses r where r.attempt_id = a.attempt_id and r.exercise_id = a.exercise_id),
      'intento', (select jsonb_build_object('id', t.id, 'status', t.status, 'score', t.score, 'max_score', t.max_score, 'needs_review', t.needs_review,
                    'started_at', t.started_at, 'submitted_at', t.submitted_at) from public.attempts t where t.id = a.attempt_id),
      'historial', (select coalesce(jsonb_agg(jsonb_build_object('accion', x.accion, 'detalle', x.detalle, 'created_at', x.created_at) order by x.created_at), '[]'::jsonb)
                    from public.control_audit x where x.session_id = p_session and x.user_id = p_user))
    from public.profiles pr left join public.exercises e on e.id = a.exercise_id left join public.exercise_keys k on k.exercise_id = a.exercise_id
    where pr.id = p_user);
end;
$$;

-- Estudiante: control activo que le toca (para el aviso que lo lleva al intento)
create or replace function public.my_control_pendiente()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('activity_id', s.control_activity_id, 'attempt_id', a.attempt_id, 'practica', p.title, 'competencia', a.competencia,
      'duracion_min', s.duracion_min, 'extra_min', a.extra_min, 'cierra', c.closes_at, 'server_now', now())
  from public.control_assignments a
  join public.control_sessions s on s.id = a.session_id and s.estado = 'activo'
  join public.activities c on c.id = s.control_activity_id and c.published and c.closes_at > now()
  join public.activities p on p.id = s.practice_activity_id
  left join public.attempts t on t.id = a.attempt_id
  where a.user_id = auth.uid() and a.estado = 'elegible' and a.exercise_id is not null and public.my_account_ok()
    and (t.id is null or t.status = 'in_progress')
  order by s.iniciado_at desc limit 1
$$;

-- -----------------------------------------------------------------------------
-- Enganches con el motor de exámenes
-- -----------------------------------------------------------------------------
-- Al crear el intento del control: SOLO su ejercicio (attempt_item_orders) y solo si le corresponde
create or replace function public.control_on_attempt()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare a public.control_assignments; s public.control_sessions;
begin
  select * into s from public.control_sessions where control_activity_id = new.activity_id;
  if s.id is null then return new; end if;
  select * into a from public.control_assignments where session_id = s.id and user_id = new.user_id for update;
  if s.estado <> 'activo' or a.user_id is null or a.estado <> 'elegible' or a.exercise_id is null or a.attempt_id is not null then
    raise exception 'Esta Práctica de Control no le corresponde o ya la comenzó' using errcode = '42501';
  end if;
  insert into public.attempt_item_orders (attempt_id, exercise_id, position) values (new.id, a.exercise_id, 1);
  update public.control_assignments set attempt_id = new.id where session_id = s.id and user_id = new.user_id;
  return new;
end;
$$;
drop trigger if exists control_on_attempt on public.attempts;
create trigger control_on_attempt after insert on public.attempts for each row execute function public.control_on_attempt();

-- Tiempo adicional concedido antes de empezar: se copia a la sesión del examen (y queda en exam_extensions)
create or replace function public.control_on_exam_session()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare a public.control_assignments;
begin
  select * into a from public.control_assignments where attempt_id = new.attempt_id;
  if a.attempt_id is not null and a.extra_min > 0 then
    new.extra_s := new.extra_s + a.extra_min * 60;
    insert into public.exam_extensions (attempt_id, teacher_id, segundos, motivo)
      values (new.attempt_id, null, a.extra_min * 60, left('Práctica de Control (adaptación): ' || coalesce(a.extra_motivo, ''), 200));
  end if;
  return new;
end;
$$;
drop trigger if exists control_on_exam_session on public.exam_sessions;
create trigger control_on_exam_session before insert on public.exam_sessions for each row execute function public.control_on_exam_session();

-- Para la Edge Function: un formato no interpretable en un control va a revisión docente, no a cero
create or replace function public.svc_es_control(p_attempt uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.control_assignments a where a.attempt_id = p_attempt) $$;

-- activity_visible_to_me (migración 4) + la actividad de un control solo la ve quien tiene ese control asignado
create or replace function public.activity_visible_to_me(p_activity uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.my_account_ok() and exists (
    select 1 from public.activities a
    join public.enrollments e on e.class_id = a.class_id and e.user_id = auth.uid()
    where a.id = p_activity and a.published and (a.group_id is null or a.group_id = e.group_id)
      and (not exists (select 1 from public.control_sessions s where s.control_activity_id = a.id)
           or exists (select 1 from public.control_sessions s join public.control_assignments x on x.session_id = s.id
                      where s.control_activity_id = a.id and x.user_id = auth.uid() and x.estado = 'elegible' and x.exercise_id is not null))
  )
$$;

-- -----------------------------------------------------------------------------
-- Registro de calificaciones: la práctica cuenta N_original × factor (la nota original no se toca)
-- -----------------------------------------------------------------------------
-- official_scores (migración 16) + control_factor en «mejor»
create or replace function public.official_scores(p_class uuid)
returns table (user_id uuid, category text, score numeric, source text, pendientes integer)
language sql stable security definer set search_path = ''
as $$
  with cats(category) as (values ('parcial1'), ('parcial2'), ('parcial3'), ('practica'), ('final')),
  alumnos as (select e.user_id from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
              where e.class_id = p_class),
  l as (select k.*, a.closes_at from public.activity_grade_links k join public.activities a on a.id = k.activity_id
        where k.class_id = p_class),
  f as (select l.category, coalesce(sum(l.points), 0) fijos, count(*) filter (where l.points is null) n from l group by l.category),
  w as (select l.activity_id, l.category, l.closes_at,
          coalesce(l.points, greatest(0, public.grade_category_max(l.category) - f.fijos) / nullif(f.n, 0)) peso
        from l join f on f.category = l.category),
  mejor as (select t.user_id, t.activity_id, max(t.score / nullif(t.max_score, 0)) * public.control_factor(t.activity_id, t.user_id) pct
            from public.attempts t join w on w.activity_id = t.activity_id
            where t.status = 'submitted' group by t.user_id, t.activity_id),
  aporte as (
    select a.user_id, w.category,
      coalesce(m.pct, case when w.closes_at is not null and w.closes_at < now() then 0 end) pct, w.peso
    from alumnos a cross join w left join mejor m on m.user_id = a.user_id and m.activity_id = w.activity_id
  ),
  auto as (
    select x.user_id, x.category,
      case when count(x.pct) = 0 then null
           else least(public.grade_category_max(x.category), round(sum(x.peso * x.pct), 2)) end score,
      count(*) filter (where x.pct is null)::integer pend
    from aporte x group by x.user_id, x.category
  )
  select a.user_id, c.category,
    coalesce(g.score, au.score),
    case when g.score is not null then 'manual' when au.score is not null then 'actividades' end,
    case when g.score is not null then 0 else coalesce(au.pend, 0) end
  from alumnos a cross join cats c
  left join public.grade_entries g on g.class_id = p_class and g.user_id = a.user_id and g.category = c.category
  left join auto au on au.user_id = a.user_id and au.category = c.category
$$;

-- my_grade_breakdown (migración 17) + nota original, factor del control y nota ajustada por actividad
create or replace function public.my_grade_breakdown()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  r record;
  v_pub boolean;
  v_cats jsonb;
begin
  if v_uid is null or not public.my_account_ok() then return v_out; end if;
  for r in
    select c.id class_id, c.name class_name, k.title course_title
    from public.enrollments e join public.classes c on c.id = e.class_id and not c.archived
    join public.courses k on k.id = c.course_id
    where e.user_id = v_uid order by k.title
  loop
    select coalesce(published, false) into v_pub from public.grade_settings where class_id = r.class_id;
    v_pub := coalesce(v_pub, false);
    with cats(category, orden) as (values ('parcial1', 1), ('parcial2', 2), ('parcial3', 3), ('practica', 4), ('final', 5)),
    l as (select k.*, a.title, a.closes_at, a.mode from public.activity_grade_links k join public.activities a on a.id = k.activity_id
          where k.class_id = r.class_id),
    f as (select l.category, coalesce(sum(l.points), 0) fijos, count(*) filter (where l.points is null) n from l group by l.category),
    acts as (
      select l.category, jsonb_agg(jsonb_build_object(
          'activity_id', l.activity_id, 'title', l.title, 'mode', l.mode, 'closes_at', l.closes_at,
          'peso', round(coalesce(l.points, greatest(0, public.grade_category_max(l.category) - f.fijos) / nullif(f.n, 0)), 2),
          'por_definir', l.points is null,
          'visible', public.activity_visible_to_me(l.activity_id),
          'mejor', case when v_pub then (select round(100 * max(t.score / nullif(t.max_score, 0)), 1) from public.attempts t
                    where t.activity_id = l.activity_id and t.user_id = v_uid and t.status = 'submitted') end,
          'control', case when v_pub and public.control_factor(l.activity_id, v_uid) < 1 then jsonb_build_object(
                    'resultado', round(100 * public.control_resultado(l.activity_id, v_uid), 1),
                    'factor', round(public.control_factor(l.activity_id, v_uid), 4),
                    'ajustada', (select round(100 * max(t.score / nullif(t.max_score, 0)) * public.control_factor(l.activity_id, v_uid), 1) from public.attempts t
                                 where t.activity_id = l.activity_id and t.user_id = v_uid and t.status = 'submitted')) end
        ) order by l.title) lista
      from l join f on f.category = l.category group by l.category
    ),
    sc as (select * from public.official_scores(r.class_id) where user_id = v_uid)
    select jsonb_agg(jsonb_build_object(
        'category', cats.category, 'max', public.grade_category_max(cats.category),
        'score', case when v_pub then sc.score end,
        'source', case when v_pub then sc.source end,
        'pendientes', case when v_pub then sc.pendientes end,
        'actividades', coalesce(acts.lista, '[]'::jsonb)
      ) order by cats.orden)
    into v_cats
    from cats left join sc on sc.category = cats.category left join acts on acts.category = cats.category;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'class_id', r.class_id, 'class_name', r.class_name, 'course_title', r.course_title, 'published', v_pub,
      'categorias', v_cats,
      'extras', case when v_pub then (
        select coalesce(jsonb_agg(jsonb_build_object('points', x.points, 'reason', x.reason, 'created_at', x.created_at) order by x.created_at), '[]'::jsonb)
        from public.extra_points x where x.class_id = r.class_id and x.user_id = v_uid and x.status = 'aprobado') else '[]'::jsonb end));
  end loop;
  return v_out;
end;
$$;

-- -----------------------------------------------------------------------------
-- VTA · Verificación de Transferencia y Autonomía (LIEIA, separada de los indicadores de integridad)
-- Brecha = rendimiento en la práctica − rendimiento supervisado en su control, por pareja (práctica, control).
-- Es una señal pedagógica con incertidumbre, no una prueba de nada.
-- -----------------------------------------------------------------------------
create or replace function public.vta_datos(p_class uuid)
returns table (user_id uuid, session_id uuid, practica uuid, practica_title text, fecha timestamptz, competencia text, tipo text,
               recuperacion boolean, practica_pct numeric, control_pct numeric, dif_practica integer, dif_control integer)
language sql stable security definer set search_path = ''
as $$
  select a.user_id, s.id, s.practice_activity_id, p.title, coalesce(s.iniciado_at, s.preparado_at), a.competencia, a.tipo, s.recuperacion,
    (select max(t2.score / nullif(t2.max_score, 0)) from public.attempts t2 where t2.activity_id = s.practice_activity_id and t2.user_id = a.user_id and t2.status = 'submitted'),
    t.score / nullif(t.max_score, 0),
    (select round(avg(case e2.difficulty when 'basico' then 1 when 'intermedio' then 2 else 3 end))::integer
       from public.activity_items i join public.exercises e2 on e2.id = i.exercise_id where i.activity_id = s.practice_activity_id),
    (select case e3.difficulty when 'basico' then 1 when 'intermedio' then 2 else 3 end from public.exercises e3 where e3.id = a.exercise_id)
  from public.control_sessions s join public.control_assignments a on a.session_id = s.id
  join public.attempts t on t.id = a.attempt_id join public.activities p on p.id = s.practice_activity_id
  where s.class_id = p_class and s.estado in ('activo', 'cerrado') and a.estado = 'elegible' and a.incidencia is null
    and a.confirmado_at is not null and t.status = 'submitted' and not t.needs_review
$$;

create or replace function public.vta_seccion(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (with d as (select * from public.vta_datos(p_class)),
    -- brecha ajustada por dificultad: un control más difícil que la práctica explica parte de la diferencia (0,10 por nivel)
    g as (select d.*, d.practica_pct - d.control_pct - 0.10 * greatest(0, coalesce(d.dif_control, 2) - coalesce(d.dif_practica, 2)) brecha from d),
    est as (select g.user_id, count(*) n, avg(g.practica_pct) practica, avg(g.control_pct) control, avg(g.brecha) brecha,
               stddev_samp(g.brecha) sd,
               count(distinct g.competencia) filter (where g.control_pct >= 0.7) verificadas
            from g group by g.user_id),
    pend as (select e.user_id, count(distinct x) pendientes
             from public.enrollments e join public.attempts t on t.user_id = e.user_id and t.status = 'submitted'
             join public.activities a on a.id = t.activity_id and a.class_id = p_class and a.mode = 'practice'
             join public.activity_items i on i.activity_id = a.id join public.exercises ex on ex.id = i.exercise_id, unnest(ex.concepts) x
             where e.class_id = p_class
               and not exists (select 1 from g where g.user_id = e.user_id and g.competencia = x and g.control_pct >= 0.7)
             group by e.user_id)
    select jsonb_build_object('estudiantes', coalesce(jsonb_agg(jsonb_build_object('user_id', e.user_id, 'nombre', pr.full_name,
        'controles', coalesce(est.n, 0), 'practica', round(100 * est.practica, 1), 'supervisado', round(100 * est.control, 1),
        'brecha', round(100 * est.brecha, 1),
        -- error típico de la media: con menos de 3 controles no se interpreta
        'brecha_ee', case when est.n >= 3 then round(100 * est.sd / sqrt(est.n::numeric), 1) end,
        'competencias_verificadas', coalesce(est.verificadas, 0), 'competencias_pendientes', coalesce(pend.pendientes, 0),
        'senal', case when coalesce(est.n, 0) = 0 then 'sin_datos' when est.n < 3 then 'datos_insuficientes'
                      when est.brecha - 2 * est.sd / sqrt(est.n::numeric) > 0.15 then 'reforzar_autonomia'
                      when est.brecha + 2 * est.sd / sqrt(est.n::numeric) < 0.15 then 'coherente' else 'indeterminada' end)
      order by pr.full_name), '[]'::jsonb),
      'aviso', 'Señales pedagógicas: comparan lo entregado en prácticas con lo resuelto de forma supervisada. No son pruebas de uso de IA ni de irregularidades.')
    from public.enrollments e join public.profiles pr on pr.id = e.user_id and pr.role = 'student'
    left join est on est.user_id = e.user_id left join pend on pend.user_id = e.user_id
    where e.class_id = p_class);
end;
$$;

create or replace function public.vta_estudiante(p_class uuid, p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'historial', (select coalesce(jsonb_agg(jsonb_build_object('session_id', d.session_id, 'practica', d.practica_title, 'fecha', d.fecha,
        'competencia', d.competencia, 'tipo', d.tipo, 'recuperacion', d.recuperacion, 'practica_pct', round(100 * d.practica_pct, 1),
        'control_pct', round(100 * d.control_pct, 1), 'dif_practica', d.dif_practica, 'dif_control', d.dif_control) order by d.fecha), '[]'::jsonb)
      from public.vta_datos(p_class) d where d.user_id = p_user),
    'pendientes_de_confirmar', (select count(*) from public.control_assignments a join public.control_sessions s on s.id = a.session_id
      where s.class_id = p_class and a.user_id = p_user and a.estado = 'elegible' and a.confirmado_at is null and a.attempt_id is not null),
    'aviso', 'Señal pedagógica, no una prueba de uso de IA.');
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public.control_w_max()', 'public.control_session_teacher(uuid)', 'public.control_log(uuid, uuid, text, jsonb)',
    'public.control_minutos_estimados(public.exercise_format, public.exercise_difficulty)', 'public.control_azar(bigint, uuid, uuid)',
    'public.control_politica_aplicable(uuid, uuid)', 'public.control_resultado(uuid, uuid)', 'public.control_factor(uuid, uuid)',
    'public.control_seleccionar(uuid, uuid)', 'public.control_sincronizar_items(uuid)', 'public.control_on_attempt()', 'public.control_on_exam_session()',
    'public.vta_datos(uuid)', 'public.svc_es_control(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  execute 'grant execute on function public.svc_es_control(uuid) to service_role';
  foreach f in array array['public.control_politica_guardar(uuid, numeric, integer, text, text)', 'public.control_politica_retirar(uuid)',
    'public.control_aviso(uuid)', 'public.control_item_guardar(jsonb)', 'public.control_catalogo(uuid)',
    'public.control_preparar(uuid, uuid, integer, uuid, boolean)', 'public.control_sustituir(uuid, uuid, uuid)', 'public.control_exentar(uuid, uuid, text)',
    'public.control_tiempo_extra(uuid, uuid, integer, text)', 'public.control_iniciar(uuid)', 'public.control_agregar(uuid, uuid)',
    'public.control_cancelar(uuid, text)', 'public.control_cerrar(uuid)', 'public.control_incidencia(uuid, uuid, text)',
    'public.control_confirmar(uuid, uuid[])', 'public.control_desconfirmar(uuid, uuid, text)', 'public.control_live(uuid)',
    'public.control_sesiones(uuid)', 'public.control_practicas(uuid)', 'public.control_ajustes(uuid)', 'public.my_control_pendiente()',
    'public.control_revision(uuid, uuid)',
    'public.vta_seccion(uuid)', 'public.vta_estudiante(uuid, uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
