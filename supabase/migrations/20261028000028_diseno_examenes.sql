-- =============================================================================
-- LIEIA · Diseño experimental y calibración de exámenes.
--
-- 0) CORRECCIÓN de la instrumentación (migración 27): al empezar un intento el aula crea una respuesta vacía por
--    pregunta y el disparador la registraba como «respuesta» en el instante del inicio, lo que falsearía el tiempo
--    de la primera respuesta. Ahora solo se registran respuestas no vacías (o el borrado de una respuesta). El
--    análisis ignora además los registros vacíos que ya se hubieran guardado.
-- 1) DISEÑO por actividad (exam_designs, exam_design_items): orden de presentación (fijo, aleatorio, contrabalanceado
--    por bloques, anclas fijas), versiones (una variante por grupo isomorfo), límite de tiempo de referencia y papel de
--    cada pregunta (ancla, isomorfa, conceptual, razonamiento).
-- 2) CALIBRACIÓN por pregunta (item_calibrations): TRI de 2 parámetros (a, b y sus errores típicos) y tiempos
--    (β, σ). La calcula el panel con las respuestas históricas seudonimizadas (calibration_data) y la guarda con
--    calibration_save; el ESTADO (calibrado / provisional / no calibrado) lo fija el servidor con reglas fijas.
-- 3) ENTREGA: si (y solo si) una actividad tiene diseño con orden variable o versiones, cada intento nuevo recibe su
--    orden y sus variantes (attempt_item_orders). get_attempt, la puntuación (recompute_attempt), los puntos por ítem
--    y el contexto de entrega usan esa asignación. Sin asignación, TODO funciona exactamente como antes.
-- Aditiva: tablas nuevas y funciones redefinidas con la misma firma. No modifica datos existentes.
-- =============================================================================

-- 0) instrumentación corregida -------------------------------------------------------------------------------
create or replace function public.lieia_registrar_respuesta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_nueva text; v_vieja text;
begin
  begin
    v_nueva := public.lieia_ficha(new.answer);
    if tg_op = 'UPDATE' then v_vieja := public.lieia_ficha(old.answer); end if;
    -- respuesta no vacía, o borrado de una respuesta que existía
    if (v_nueva is not null or v_vieja is not null)
       and exists (select 1 from public.attempts a where a.id = new.attempt_id and a.activity_id is not null and a.status = 'in_progress') then
      insert into public.exam_item_events (attempt_id, exercise_id, user_id, answer_hash)
        values (new.attempt_id, new.exercise_id, new.user_id, coalesce(v_nueva, 'vacia'));
    end if;
  exception when others then
    null; -- la instrumentación nunca debe impedir que se guarde la respuesta
  end;
  return null;
end;
$$;

-- 1) diseño y 2) calibración ---------------------------------------------------------------------------------
create table if not exists public.exam_designs (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  orden text not null default 'fijo' check (orden in ('fijo', 'aleatorio', 'contrabalanceado', 'anclas_fijas')),
  versiones boolean not null default false,
  limite_minutos integer check (limite_minutos is null or limite_minutos between 1 and 600),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.exam_design_items (
  activity_id uuid not null references public.activities (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  rol text not null default 'normal' check (rol in ('normal', 'ancla', 'isomorfa', 'conceptual', 'razonamiento')),
  grupo text check (grupo is null or char_length(grupo) between 1 and 40),
  bloque integer check (bloque is null or bloque between 0 and 20),
  primary key (activity_id, exercise_id)
);
create table if not exists public.item_calibrations (
  exercise_id uuid primary key references public.exercises (id) on delete cascade,
  a double precision not null check (a between 0.05 and 6),
  b double precision not null check (b between -8 and 8),
  se_a double precision not null check (se_a >= 0),
  se_b double precision not null check (se_b >= 0),
  beta_t double precision check (beta_t is null or beta_t between 0 and 12),
  sigma_t double precision check (sigma_t is null or sigma_t between 0 and 5),
  n_resp integer not null check (n_resp >= 0),
  n_tiempos integer not null default 0 check (n_tiempos >= 0),
  estado text not null check (estado in ('calibrado', 'provisional', 'no_calibrado')),
  metodo text not null default '2PL-MAP',
  calibrated_at timestamptz not null default now(),
  calibrated_by uuid references public.profiles (id) on delete set null
);
create table if not exists public.attempt_item_orders (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  exercise_id uuid not null,
  position integer not null,
  primary key (attempt_id, exercise_id)
);
alter table public.exam_designs enable row level security;
alter table public.exam_design_items enable row level security;
alter table public.item_calibrations enable row level security;
alter table public.attempt_item_orders enable row level security;
revoke all on public.exam_designs, public.exam_design_items, public.item_calibrations, public.attempt_item_orders from anon, authenticated;

-- mismas reglas que src/lib/lieia/diseno.ts (estadoDe)
create or replace function public.calibration_state(p_n integer, p_se_b double precision, p_se_a double precision)
returns text
language sql immutable set search_path = ''
as $$ select case when p_n >= 100 and p_se_b <= 0.3 and p_se_a <= 0.35 then 'calibrado'
                  when p_n >= 20 and p_se_b <= 0.8 then 'provisional' else 'no_calibrado' end $$;

create or replace function public.course_assert_teacher(p_course uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() or not (public.is_course_staff(p_course) or public.teaches_course(p_course)) then
    raise exception 'No tiene acceso a esta asignatura' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.design_get(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid := public.lieia_assert(p_activity); r jsonb;
begin
  select jsonb_build_object(
    'diseno', (select jsonb_build_object('orden', d.orden, 'versiones', d.versiones, 'limite_minutos', d.limite_minutos, 'updated_at', d.updated_at)
               from public.exam_designs d where d.activity_id = p_activity),
    'intentos', (select count(*) from public.attempts t where t.activity_id = p_activity),
    'course_id', (select c.course_id from public.classes c where c.id = v_class),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'exercise_id', e.id, 'posicion', ai.position, 'titulo', left(regexp_replace(e.prompt, '\s+', ' ', 'g'), 140), 'dificultad', e.difficulty,
        'categoria', e.category, 'formato', e.format, 'conceptos', to_jsonb(e.concepts),
        'opciones', case when e.options is not null then jsonb_array_length(e.options) end,
        'rol', coalesce(di.rol, 'normal'), 'grupo', di.grupo, 'bloque', di.bloque,
        'calibracion', (select to_jsonb(c) - 'exercise_id' - 'calibrated_by' from public.item_calibrations c where c.exercise_id = e.id))
        order by ai.position), '[]')
      from public.activity_items ai join public.exercises e on e.id = ai.exercise_id
      left join public.exam_design_items di on di.activity_id = p_activity and di.exercise_id = e.id
      where ai.activity_id = p_activity)
  ) into r;
  return r;
end;
$$;

create or replace function public.design_save(p_activity uuid, p_orden text, p_versiones boolean, p_limite integer, p_items jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := public.lieia_assert(p_activity); d public.exam_designs; x jsonb; g record;
begin
  if p_orden not in ('fijo', 'aleatorio', 'contrabalanceado', 'anclas_fijas') then raise exception 'Orden no válido' using errcode = '22023'; end if;
  select * into d from public.exam_designs where activity_id = p_activity;
  if exists (select 1 from public.attempts t where t.activity_id = p_activity)
     and (coalesce(d.orden, 'fijo') <> p_orden or coalesce(d.versiones, false) <> coalesce(p_versiones, false)) then
    raise exception 'Ya hay intentos en esta actividad: no se puede cambiar el orden ni las versiones (los estudiantes verían exámenes distintos)' using errcode = 'P0001';
  end if;
  for x in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if not exists (select 1 from public.activity_items ai where ai.activity_id = p_activity and ai.exercise_id = (x ->> 'exercise_id')::uuid) then
      raise exception 'Una pregunta del diseño no pertenece a la actividad' using errcode = '22023';
    end if;
  end loop;
  insert into public.exam_designs (activity_id, orden, versiones, limite_minutos, updated_by)
    values (p_activity, p_orden, coalesce(p_versiones, false), p_limite, auth.uid())
  on conflict (activity_id) do update set orden = excluded.orden, versiones = excluded.versiones, limite_minutos = excluded.limite_minutos,
    updated_by = excluded.updated_by, updated_at = now();
  delete from public.exam_design_items where activity_id = p_activity;
  insert into public.exam_design_items (activity_id, exercise_id, rol, grupo, bloque)
    select p_activity, (x ->> 'exercise_id')::uuid, coalesce(x ->> 'rol', 'normal'), nullif(btrim(x ->> 'grupo'), ''), (x ->> 'bloque')::integer
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x;
  if coalesce(p_versiones, false) then
    if not exists (select 1 from public.exam_design_items where activity_id = p_activity and grupo is not null) then
      raise exception 'Para usar versiones defina al menos un grupo isomorfo' using errcode = '22023';
    end if;
    for g in select grupo, count(*) n from public.exam_design_items where activity_id = p_activity and grupo is not null group by grupo loop
      if g.n < 2 then raise exception 'El grupo isomorfo «%» necesita al menos dos variantes', g.grupo using errcode = '22023'; end if;
    end loop;
  end if;
end;
$$;

create or replace function public.calibration_bank(p_course uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.course_assert_teacher(p_course);
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'exercise_id', e.id, 'titulo', left(regexp_replace(e.prompt, '\s+', ' ', 'g'), 140), 'dificultad', e.difficulty, 'categoria', e.category,
      'formato', e.format, 'conceptos', to_jsonb(e.concepts), 'opciones', case when e.options is not null then jsonb_array_length(e.options) end,
      'leccion', (select l.title from public.lessons l where l.id = e.lesson_id),
      'calibracion', (select to_jsonb(c) - 'exercise_id' - 'calibrated_by' from public.item_calibrations c where c.exercise_id = e.id))
      order by e.position, e.slug), '[]')
    from public.exercises e where e.course_id = p_course and e.published);
end;
$$;

-- Respuestas históricas seudonimizadas para calibrar (sin nombres ni contenido de las respuestas)
create or replace function public.calibration_data(p_course uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.course_assert_teacher(p_course);
  return (
    with t as (
      select x.*, dense_rank() over (order by md5(x.user_id::text || p_course::text)) s, row_number() over (order by x.started_at, x.id) a
      from public.attempts x join public.profiles p on p.id = x.user_id and p.role = 'student'
      where x.course_id = p_course
    )
    select coalesce(jsonb_agg(jsonb_build_object('s', t.s, 'a', t.a, 'e', r.exercise_id,
        'x', r.status = 'correct', 't0', extract(epoch from t.started_at),
        't', extract(epoch from coalesce(
               (select min(ev.created_at) from public.exam_item_events ev where ev.attempt_id = t.id and ev.exercise_id = r.exercise_id and ev.answer_hash <> 'vacia'),
               (select min(re.created_at) from public.response_events re where re.response_id = r.id and re.kind in ('check', 'submit') and t.mode = 'practice'))))), '[]')
    from t join public.responses r on r.attempt_id = t.id
    where r.status in ('correct', 'incorrect', 'invalid', 'partial', 'revealed'));
end;
$$;

create or replace function public.calibration_save(p_course uuid, p_items jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare x jsonb; n integer := 0;
begin
  perform public.course_assert_teacher(p_course);
  for x in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if not exists (select 1 from public.exercises e where e.id = (x ->> 'exercise_id')::uuid and e.course_id = p_course) then
      raise exception 'Pregunta ajena a la asignatura' using errcode = '22023';
    end if;
    insert into public.item_calibrations (exercise_id, a, b, se_a, se_b, beta_t, sigma_t, n_resp, n_tiempos, estado, calibrated_by)
      values ((x ->> 'exercise_id')::uuid, (x ->> 'a')::float8, (x ->> 'b')::float8, (x ->> 'se_a')::float8, (x ->> 'se_b')::float8,
              (x ->> 'beta_t')::float8, (x ->> 'sigma_t')::float8, (x ->> 'n_resp')::integer, coalesce((x ->> 'n_tiempos')::integer, 0),
              public.calibration_state((x ->> 'n_resp')::integer, (x ->> 'se_b')::float8, (x ->> 'se_a')::float8), auth.uid())
    on conflict (exercise_id) do update set a = excluded.a, b = excluded.b, se_a = excluded.se_a, se_b = excluded.se_b, beta_t = excluded.beta_t,
      sigma_t = excluded.sigma_t, n_resp = excluded.n_resp, n_tiempos = excluded.n_tiempos, estado = excluded.estado,
      calibrated_at = now(), calibrated_by = excluded.calibrated_by;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- 3) entrega con orden y versiones -------------------------------------------------------------------------------
-- Asignación para un intento nuevo (solo si hay diseño con orden variable o versiones). Equilibrada: la variante de
-- cada grupo y la rotación de bloques dependen del número de intento dentro de la actividad.
create or replace function public.assign_attempt_items(p_attempt uuid, p_activity uuid, p_seq integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare d public.exam_designs; v_items uuid[]; v_anclas uuid[]; v_libres uuid[]; v_final uuid[] := '{}'; v_bloques integer[]; v_rot integer; k integer; e uuid;
begin
  select * into d from public.exam_designs where activity_id = p_activity;
  if not found or (d.orden = 'fijo' and not d.versiones) then return; end if;
  -- ítems asignados en el orden base
  select array_agg(ai.exercise_id order by ai.position) into v_items
  from public.activity_items ai
  left join public.exam_design_items di on di.activity_id = p_activity and di.exercise_id = ai.exercise_id
  where ai.activity_id = p_activity
    and (not d.versiones or di.grupo is null or ai.exercise_id = (
      select z.exercise_id from (
        select di2.exercise_id, row_number() over (order by ai2.position) - 1 rn, count(*) over () n,
               dense_rank() over (order by di2.grupo) gr
        from public.exam_design_items di2 join public.activity_items ai2 on ai2.activity_id = p_activity and ai2.exercise_id = di2.exercise_id
        where di2.activity_id = p_activity and di2.grupo = di.grupo) z
      where z.rn = (p_seq + (select count(distinct di3.grupo) from public.exam_design_items di3 where di3.activity_id = p_activity and di3.grupo < di.grupo)) % z.n));
  if v_items is null then return; end if;
  if d.orden = 'aleatorio' then
    select array_agg(x order by random()) into v_final from unnest(v_items) x;
  elsif d.orden = 'anclas_fijas' then
    select array_agg(x order by random()) into v_libres from unnest(v_items) x
      where not exists (select 1 from public.exam_design_items di where di.activity_id = p_activity and di.exercise_id = x and di.rol = 'ancla');
    k := 1;
    foreach e in array v_items loop
      if exists (select 1 from public.exam_design_items di where di.activity_id = p_activity and di.exercise_id = e and di.rol = 'ancla') then
        v_final := v_final || e;
      else
        v_final := v_final || v_libres[k]; k := k + 1;
      end if;
    end loop;
  elsif d.orden = 'contrabalanceado' then
    select array_agg(distinct coalesce(di.bloque, 0) order by coalesce(di.bloque, 0)) into v_bloques
      from unnest(v_items) x left join public.exam_design_items di on di.activity_id = p_activity and di.exercise_id = x;
    v_rot := p_seq % greatest(1, cardinality(v_bloques));
    select array_agg(x order by ((array_position(v_bloques, coalesce(di.bloque, 0)) - 1 - v_rot + cardinality(v_bloques)) % cardinality(v_bloques)), ord)
      into v_final
      from unnest(v_items) with ordinality u(x, ord) left join public.exam_design_items di on di.activity_id = p_activity and di.exercise_id = u.x;
  else
    v_final := v_items;
  end if;
  insert into public.attempt_item_orders (attempt_id, exercise_id, position)
    select p_attempt, x, ord from unnest(v_final) with ordinality u(x, ord);
end;
$$;
revoke all on function public.assign_attempt_items(uuid, uuid, integer) from public, anon, authenticated;

-- start_activity_attempt (migración 10) + asignación del diseño; sin diseño, idéntico al anterior
create or replace function public.start_activity_attempt(p_activity uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_act public.activities;
  v_course uuid;
  v_id uuid;
  v_used integer;
  v_seq integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.activity_visible_to_me(p_activity) then
    raise exception 'Actividad no disponible' using errcode = '42501';
  end if;
  -- serializa dobles clics y peticiones simultáneas del mismo estudiante
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_activity::text, 0));
  select * into v_act from public.activities where id = p_activity;
  if v_act.opens_at is not null and now() < v_act.opens_at then
    raise exception 'La actividad todavía no está abierta' using errcode = 'P0001';
  end if;
  -- lectura cronometrada: primero hay que completar el tiempo mínimo de lectura
  if v_act.reading_min_seconds is not null and not exists (
      select 1 from public.reading_progress r
      where r.user_id = v_uid and r.activity_id = p_activity and r.completed_at is not null) then
    raise exception 'Primero complete el tiempo de lectura' using errcode = 'P0001';
  end if;
  select id into v_id from public.attempts where user_id = v_uid and activity_id = p_activity and status = 'in_progress';
  if found then return v_id; end if;
  if v_act.closes_at is not null and now() >= v_act.closes_at then
    raise exception 'La actividad está cerrada' using errcode = 'P0001';
  end if;
  select count(*) into v_used from public.attempts where user_id = v_uid and activity_id = p_activity;
  if v_act.max_attempts is not null and v_used >= v_act.max_attempts then
    raise exception 'Ya utilizó todos los intentos permitidos' using errcode = 'P0001';
  end if;
  select count(*) into v_seq from public.attempts where activity_id = p_activity;
  select c.course_id into v_course from public.classes c where c.id = v_act.class_id;
  insert into public.attempts (user_id, course_id, activity_id, lesson_id, mode, attempt_number)
    -- lesson_id queda vacío: borrar una lección no debe borrar intentos calificados de una actividad
    values (v_uid, v_course, p_activity, null, v_act.mode, v_used + 1)
    returning id into v_id;
  perform public.assign_attempt_items(v_id, p_activity, v_seq);
  insert into public.responses (attempt_id, exercise_id, user_id, points)
    select v_id, i.exercise_id, v_uid, coalesce(i.points, e.points)
    from public.activity_items i join public.exercises e on e.id = i.exercise_id
    where i.activity_id = p_activity
      and (not exists (select 1 from public.attempt_item_orders o where o.attempt_id = v_id)
           or exists (select 1 from public.attempt_item_orders o where o.attempt_id = v_id and o.exercise_id = i.exercise_id));
  perform public.recompute_attempt(v_id);
  return v_id;
end;
$$;

-- puntos por ítem (migración 3) + solo ítems asignados si el intento tiene asignación
create or replace function public.attempt_item_points(p_attempt uuid, p_exercise uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select case
    when a.activity_id is not null then (
      select coalesce(i.points, e.points) from public.activity_items i
      join public.exercises e on e.id = i.exercise_id
      where i.activity_id = a.activity_id and i.exercise_id = p_exercise
        and (not exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt)
             or exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt and o.exercise_id = p_exercise)))
    else (
      select e.points from public.exercises e
      where e.id = p_exercise and e.lesson_id = a.lesson_id and e.published and e.role in ('practice', 'reinforcement')
        -- mientras el ejercicio esté en una evaluación (o tarea sin retroalimentación) abierta para este
        -- estudiante, no se puede practicar con él: la práctica libre revelaría la solución
        and not exists (
          select 1 from public.activity_items i
          join public.activities x on x.id = i.activity_id
          join public.enrollments en on en.class_id = x.class_id and en.user_id = a.user_id
          where i.exercise_id = p_exercise and x.published
            and (x.mode = 'exam' or x.reveal_policy <> 'immediate')
            and (x.closes_at is null or now() < x.closes_at)))
  end
  from public.attempts a where a.id = p_attempt
$$;

-- puntuación (migración 3) + solo ítems asignados si el intento tiene asignación
create or replace function public.recompute_attempt(p_attempt uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_asig boolean;
begin
  select * into v_att from public.attempts where id = p_attempt;
  v_asig := exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt);
  if v_att.activity_id is not null then
    update public.attempts a set
      max_score = (select coalesce(sum(coalesce(i.points, e.points)), 0) from public.activity_items i
                   join public.exercises e on e.id = i.exercise_id where i.activity_id = v_att.activity_id
                     and (not v_asig or exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt and o.exercise_id = i.exercise_id))),
      -- mismos puntos que max_score y solo ítems que siguen en la actividad
      score = (select coalesce(sum(coalesce(i.points, e.points) * coalesce(r.manual_credit, r.auto_credit, 0)), 0)
               from public.responses r
               join public.activity_items i on i.activity_id = v_att.activity_id and i.exercise_id = r.exercise_id
               join public.exercises e on e.id = r.exercise_id
               where r.attempt_id = p_attempt
                 and (not v_asig or exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt and o.exercise_id = r.exercise_id))),
      needs_review = exists (select 1 from public.responses r where r.attempt_id = p_attempt
                             and r.status = 'pending_review' and r.manual_credit is null)
    where a.id = p_attempt;
  else
    update public.attempts a set
      max_score = (select coalesce(sum(r.points), 0) from public.responses r where r.attempt_id = p_attempt),
      score = (select coalesce(sum(r.points * coalesce(r.manual_credit, r.auto_credit, 0)), 0)
               from public.responses r where r.attempt_id = p_attempt),
      needs_review = false
    where a.id = p_attempt;
  end if;
end;
$$;

-- contexto de entrega (migración 3) + solo ítems asignados
create or replace function public.svc_submit_context(p_user uuid, p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts;
begin
  select * into v_att from public.attempts where id = p_attempt;
  if not found or v_att.user_id <> p_user then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  if v_att.status <> 'in_progress' then raise exception 'El intento ya fue entregado' using errcode = 'P0001'; end if;
  if v_att.activity_id is null then raise exception 'La práctica libre no se entrega' using errcode = 'P0001'; end if;
  -- Se permite entregar después del cierre: solo cuentan los borradores guardados a tiempo (save_response respeta el plazo).
  return jsonb_build_object(
    'mode', v_att.mode,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'exercise_id', i.exercise_id, 'format', e.format,
        'option_count', case when e.options is null then null else jsonb_array_length(e.options) end,
        'key', k.answer, 'answer', r.answer, 'status', r.status)), '[]'::jsonb)
      from public.activity_items i
      join public.exercises e on e.id = i.exercise_id
      left join public.exercise_keys k on k.exercise_id = i.exercise_id
      left join public.responses r on r.attempt_id = p_attempt and r.exercise_id = i.exercise_id
      where i.activity_id = v_att.activity_id
        and (not exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt)
             or exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt and o.exercise_id = i.exercise_id))));
end;
$$;

-- get_attempt (migración 3) + orden y variantes asignados
create or replace function public.get_attempt(p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_att public.attempts;
  v_act public.activities;
  v_owner boolean;
  v_reviewer boolean;
  v_correct_vis boolean;
  v_score_vis boolean;
  v_feedback_vis boolean;
  v_max_tries integer;
  v_editable boolean;
  v_items jsonb;
  v_student jsonb;
  v_asig boolean;
begin
  select * into v_att from public.attempts where id = p_attempt;
  if not found then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  v_owner := coalesce(v_att.user_id = v_uid, false);
  v_reviewer := public.can_review_attempt(p_attempt);
  if not (v_owner or v_reviewer) then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  if v_att.activity_id is not null then
    select * into v_act from public.activities where id = v_att.activity_id;
  end if;
  v_asig := exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt);

  v_correct_vis := v_reviewer or public.correctness_visible(v_att, v_act);
  v_score_vis := v_reviewer or public.score_visible(v_att, v_act);
  v_feedback_vis := v_reviewer or v_act.id is null or v_act.grades_published;
  v_max_tries := coalesce(v_act.max_tries_per_item, 3);
  v_editable := v_owner and v_att.status = 'in_progress'
    and (v_act.id is null or v_act.closes_at is null or now() < v_act.closes_at);

  with items as (
    select i.exercise_id, coalesce(o.position, i.position) as ord, coalesce(i.points, e.points) as points
      from public.activity_items i join public.exercises e on e.id = i.exercise_id
      left join public.attempt_item_orders o on o.attempt_id = p_attempt and o.exercise_id = i.exercise_id
      where v_att.activity_id is not null and i.activity_id = v_att.activity_id and (not v_asig or o.exercise_id is not null)
    union all
    select s.exercise_id, s.ord, e.points
      from public.lesson_practice_set(v_att.lesson_id) s join public.exercises e on e.id = s.exercise_id
      where v_att.activity_id is null
    union all
    -- ejercicios de refuerzo ya respondidos en esta práctica libre
    select r.exercise_id, (1000 + row_number() over (order by r.updated_at))::integer, r.points
      from public.responses r
      where v_att.activity_id is null and r.attempt_id = p_attempt
        and r.exercise_id not in (select exercise_id from public.lesson_practice_set(v_att.lesson_id))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'exercise', jsonb_build_object(
        'id', e.id, 'slug', e.slug, 'lesson_id', e.lesson_id, 'category', e.category, 'difficulty', e.difficulty,
        'role', e.role, 'format', e.format, 'concepts', to_jsonb(e.concepts), 'prompt', e.prompt, 'options', e.options,
        'multiple', e.multiple, 'figure', e.figure, 'simulation', e.simulation, 'unit_hint', e.unit_hint),
      'points', it.points,
      'response', case when r.id is null then null else jsonb_build_object(
        'id', r.id,
        'answer', r.answer,
        'status', case when v_correct_vis then r.status::text
                       when r.status = 'draft' then 'draft' else 'submitted' end,
        'credit', case when v_score_vis then coalesce(r.manual_credit, r.auto_credit) end,
        'messages', case when v_correct_vis then r.engine_messages else '[]'::jsonb end,
        'tries', r.tries,
        'hints_used', r.hints_used,
        'solution_revealed', r.solution_revealed,
        'teacher_feedback', case when v_feedback_vis then r.teacher_feedback end,
        'manual_credit', case when v_feedback_vis then r.manual_credit end,
        'updated_at', r.updated_at) end,
      'hints', case when r.hints_used > 0 then (
          select jsonb_agg(h.value order by h.ordinality)
          from jsonb_array_elements(k.hints) with ordinality as h(value, ordinality)
          where h.ordinality <= r.hints_used) end,
      'hints_total', jsonb_array_length(coalesce(k.hints, '[]'::jsonb)),
      'locked', coalesce(v_att.mode = 'practice' and (r.status in ('correct', 'revealed', 'pending_review')
                         or r.solution_revealed or r.tries >= v_max_tries), false),
      'solution', case when v_reviewer
                         or (v_correct_vis and (v_att.mode = 'exam' or v_att.status = 'submitted'
                             or r.status in ('correct', 'revealed', 'pending_review')
                             or r.solution_revealed or r.tries >= v_max_tries))
                       then jsonb_build_object('answer', k.answer, 'explanation', k.explanation) end
    ) order by it.ord), '[]'::jsonb)
  into v_items
  from items it
  join public.exercises e on e.id = it.exercise_id
  left join public.responses r on r.attempt_id = p_attempt and r.exercise_id = it.exercise_id
  left join public.exercise_keys k on k.exercise_id = it.exercise_id;

  if v_reviewer then
    select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'student_code', p.student_code)
      into v_student from public.profiles p where p.id = v_att.user_id;
  end if;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_att.id, 'status', v_att.status, 'mode', v_att.mode, 'attempt_number', v_att.attempt_number,
      'started_at', v_att.started_at, 'submitted_at', v_att.submitted_at,
      'score', case when v_score_vis then v_att.score end, 'max_score', v_att.max_score,
      'needs_review', v_att.needs_review, 'lesson_id', v_att.lesson_id, 'activity_id', v_att.activity_id,
      'course_id', v_att.course_id),
    'activity', case when v_act.id is null then null else jsonb_build_object(
      'id', v_act.id, 'title', v_act.title, 'instructions', v_act.instructions, 'mode', v_act.mode,
      'opens_at', v_act.opens_at, 'closes_at', v_act.closes_at, 'max_attempts', v_act.max_attempts,
      'max_tries_per_item', v_act.max_tries_per_item, 'reveal_policy', v_act.reveal_policy,
      'hints_enabled', v_act.hints_enabled, 'grades_published', v_act.grades_published, 'class_id', v_act.class_id) end,
    'lesson', (select jsonb_build_object('id', l.id, 'title', l.title, 'unit_id', l.unit_id) from public.lessons l where l.id = coalesce(v_att.lesson_id, v_act.lesson_id)),
    'student', v_student,
    'flags', jsonb_build_object(
      'is_owner', v_owner, 'is_reviewer', v_reviewer, 'editable', v_editable,
      'correctness_visible', v_correct_vis, 'score_visible', v_score_vis, 'feedback_visible', v_feedback_vis,
      'max_tries', v_max_tries,
      'hints_enabled', v_att.mode = 'practice' and coalesce(v_act.hints_enabled, true),
      'reveal_allowed', v_att.mode = 'practice' and (v_act.id is null or v_act.reveal_policy = 'immediate')),
    'items', v_items
  );
end;
$$;

-- lieia_exam_data (migración 27) + papel/grupo de cada pregunta, orden asignado y sin registros vacíos
create or replace function public.lieia_exam_data(p_activity uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid := public.lieia_assert(p_activity); r jsonb;
begin
  insert into public.lieia_audit (actor_id, action, activity_id) values (auth.uid(), 'consulta_examen', p_activity);
  with intentos as (
    select distinct on (t.user_id) t.* from public.attempts t
    join public.profiles p on p.id = t.user_id and p.role = 'student'
    where t.activity_id = p_activity and t.status = 'submitted'
    order by t.user_id, t.attempt_number, t.started_at
  ), seud as (
    select i.*, 'E' || lpad(row_number() over (order by md5(i.user_id::text || p_activity::text))::text, 2, '0') seudonimo from intentos i
  ), ev as (
    select e.* from public.exam_item_events e where e.attempt_id in (select s.id from seud s) and e.answer_hash <> 'vacia'
  )
  select jsonb_build_object(
    'actividad', (select jsonb_build_object('id', a.id, 'titulo', a.title, 'modo', a.mode, 'abre', a.opens_at, 'cierra', a.closes_at) from public.activities a where a.id = p_activity),
    'diseno', (select jsonb_build_object('orden', d.orden, 'versiones', d.versiones) from public.exam_designs d where d.activity_id = p_activity),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', ai.exercise_id, 'posicion', ai.position, 'formato', e.format,
        'opciones', case when e.options is not null then jsonb_array_length(e.options) end,
        'rol', coalesce(di.rol, 'normal'), 'grupo', di.grupo) order by ai.position), '[]')
      from public.activity_items ai join public.exercises e on e.id = ai.exercise_id
      left join public.exam_design_items di on di.activity_id = p_activity and di.exercise_id = ai.exercise_id
      where ai.activity_id = p_activity),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('seudonimo', s.seudonimo, 'inicio', s.started_at, 'fin', s.submitted_at,
        'oculto', (select coalesce(sum(v.hidden_seconds), 0) from public.study_visits v where v.user_id = s.user_id and v.activity_id = p_activity
                     and v.started_at between s.started_at - interval '5 minutes' and coalesce(s.submitted_at, s.started_at + interval '4 hours')),
        'orden', (select jsonb_agg(o.exercise_id order by o.position) from public.attempt_item_orders o where o.attempt_id = s.id),
        'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', rr.exercise_id,
            'ficha', public.lieia_ficha(rr.answer),
            'correcta', case when rr.status = 'correct' then true when rr.status in ('incorrect', 'invalid', 'revealed', 'partial') then false else null end,
            'primera', (select min(x.created_at) from ev x where x.attempt_id = s.id and x.exercise_id = rr.exercise_id),
            'ultima', (select max(x.created_at) from ev x where x.attempt_id = s.id and x.exercise_id = rr.exercise_id),
            'cambios', (select count(*) from ev x where x.attempt_id = s.id and x.exercise_id = rr.exercise_id))), '[]')
          from public.responses rr where rr.attempt_id = s.id)
      ) order by s.seudonimo), '[]') from seud s),
    'con_tiempos', coalesce((select count(*) filter (where exists (select 1 from ev x where x.attempt_id = s.id)) * 2 >= count(*)
                    and count(*) > 0 from seud s), false)
  ) into r;
  return r;
end;
$$;

revoke all on function public.calibration_state(integer, double precision, double precision) from public, anon, authenticated;
revoke all on function public.course_assert_teacher(uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['design_get(uuid)', 'design_save(uuid, text, boolean, integer, jsonb)', 'calibration_bank(uuid)',
                           'calibration_data(uuid)', 'calibration_save(uuid, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
