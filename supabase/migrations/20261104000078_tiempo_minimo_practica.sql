-- =============================================================================
-- Migración 78 · Tiempo mínimo de realización en prácticas ordinarias (tiempo ACTIVO).
--
-- El profesor puede exigir, en una práctica (mode = 'practice', no secuencial), un tiempo mínimo de trabajo:
--  · Solo cuenta el tiempo ACTIVO: con la práctica visible y con actividad reciente. Lo cuenta el servidor con latidos
--    (como la lectura cronometrada): suma el tiempo real entre latidos solo si el anterior fue hace ≤ 25 s y declarado
--    activo; si el estudiante se va, cambia de pestaña o deja la página quieta más de 2 min, deja de contar.
--    Dos pestañas no duplican el tiempo (un único contador por intento, acotado por el reloj real).
--  · Antes de cumplirlo NO puede entregar (lo impide la Edge Function «calificar» con svc_tiempo_minimo_verificar).
--  · Si no lo cumple y el intento se entrega al cierre (o después del cierre, o lo entrega el profesor con
--    «Entregar y calificar» / Orbe Control), la nota se multiplica por (tiempo activo ÷ mínimo). Ej.: 20 de 60 min → ⅓.
--  · Solo afecta a intentos EMPEZADOS después de activarlo (una práctica publicada que aún no se ha intentado sirve).
--  · Viene desactivado en todas las prácticas. Desactivarlo devuelve las notas completas (se recalculan).
--  · Indicador de trabajo, no prueba de esfuerzo ni de autoría: no impide el uso de IA.
-- Aditiva: dos tablas nuevas, funciones nuevas y copias ampliadas de recompute_attempt (migración 59) y de
-- actividad_copiar (migración 73, ahora copia también el tiempo mínimo).
-- =============================================================================

create table if not exists public.activity_min_time (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  minutos integer not null check (minutos between 1 and 600),
  activo boolean not null default true,
  activado_at timestamptz not null default now(),   -- los intentos empezados antes quedan exentos
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.attempt_active_time (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  minimo_s integer not null check (minimo_s > 0),           -- copia del mínimo vigente al empezar a contar
  segundos numeric(10, 1) not null default 0 check (segundos >= 0),
  last_beat timestamptz,                                     -- null = no está contando (fuera, oculta o inactiva)
  pausas integer not null default 0,
  cumplido_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists attempt_active_time_actividad_idx on public.attempt_active_time (activity_id);

alter table public.activity_min_time enable row level security;
alter table public.attempt_active_time enable row level security;
-- sin políticas: se leen y escriben solo mediante las funciones de abajo
revoke all on public.activity_min_time, public.attempt_active_time from anon, authenticated;

-- ¿Exige este intento tiempo mínimo? Devuelve el mínimo en segundos o NULL
create or replace function public.practica_minimo_aplica(p_attempt uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select c.minutos * 60
  from public.attempts a
  join public.activities act on act.id = a.activity_id and act.mode = 'practice'
  join public.activity_min_time c on c.activity_id = act.id and c.activo
  where a.id = p_attempt and a.started_at >= c.activado_at
$$;

-- Tiempo activo y mínimo efectivos del intento (para la nota y la entrega)
create or replace function public.practica_tiempo_de(p_attempt uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when m.v is null then null else jsonb_build_object(
    'minimo_s', coalesce(t.minimo_s, m.v), 'segundos', coalesce(t.segundos, 0),
    'cumplido', coalesce(t.segundos, 0) >= coalesce(t.minimo_s, m.v)) end
  from (select public.practica_minimo_aplica(p_attempt) as v) m
  left join public.attempt_active_time t on t.attempt_id = p_attempt
$$;

-- Latido del estudiante (cada ~10 s). p_activo = página visible y con actividad en los últimos 2 min.
create or replace function public.practica_latido(p_attempt uuid, p_activo boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a public.attempts;
  act public.activities;
  v_min integer;
  t public.attempt_active_time;
  v_gap double precision;
  v_add numeric := 0;
  v_cuenta boolean;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into a from public.attempts where id = p_attempt;
  if a.id is null or a.user_id <> v_uid or not public.my_account_ok() then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  v_min := public.practica_minimo_aplica(p_attempt);
  if v_min is null then return jsonb_build_object('aplica', false); end if;
  select * into act from public.activities where id = a.activity_id;
  insert into public.attempt_active_time (attempt_id, user_id, activity_id, minimo_s) values (a.id, a.user_id, a.activity_id, v_min)
    on conflict (attempt_id) do nothing;
  select * into t from public.attempt_active_time where attempt_id = p_attempt for update;
  -- solo cuenta con el intento en curso y dentro del plazo de la práctica
  v_cuenta := a.status = 'in_progress' and (act.closes_at is null or now() < act.closes_at) and (act.opens_at is null or now() >= act.opens_at);
  if v_cuenta then
    if p_activo and t.last_beat is not null then
      v_gap := extract(epoch from (now() - t.last_beat));
      if v_gap > 0 and v_gap <= 25 then v_add := round(v_gap::numeric, 1); end if;
    end if;
    update public.attempt_active_time set
      segundos = segundos + v_add,
      last_beat = case when p_activo then now() end,
      pausas = pausas + case when not p_activo and t.last_beat is not null then 1 else 0 end,
      cumplido_at = coalesce(cumplido_at, case when segundos + v_add >= minimo_s then now() end),
      updated_at = now()
    where attempt_id = p_attempt
    returning * into t;
  end if;
  return jsonb_build_object('aplica', true, 'minimo_s', t.minimo_s, 'segundos', t.segundos, 'cumplido', t.segundos >= t.minimo_s,
    'contando', v_cuenta and p_activo, 'cierra', act.closes_at, 'cerrada', act.closes_at is not null and now() >= act.closes_at);
end $$;

-- Estado sin contar (estudiante dueño o profesor de la sección)
create or replace function public.practica_tiempo_estado(p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare a public.attempts; act public.activities; v jsonb;
begin
  select * into a from public.attempts where id = p_attempt;
  select * into act from public.activities where id = a.activity_id;
  if a.id is null or not (a.user_id = auth.uid() or (act.id is not null and public.is_class_teacher(act.class_id))) then
    raise exception 'Intento no encontrado' using errcode = '42501';
  end if;
  v := public.practica_tiempo_de(p_attempt);
  if v is null then return jsonb_build_object('aplica', false); end if;
  return v || jsonb_build_object('aplica', true, 'cierra', act.closes_at, 'cerrada', act.closes_at is not null and now() >= act.closes_at);
end $$;

-- Configuración visible para quien puede ver la actividad (para avisar antes de empezar)
create or replace function public.practica_tiempo_config(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities; c public.activity_min_time;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not (public.is_class_teacher(act.class_id) or public.activity_open_to_me(p_activity)) then
    raise exception 'Actividad no disponible' using errcode = '42501';
  end if;
  select * into c from public.activity_min_time where activity_id = p_activity;
  return jsonb_build_object('activo', coalesce(c.activo, false) and act.mode = 'practice', 'minutos', c.minutos,
    'activado_at', case when c.activo then c.activado_at end);
end $$;

-- Para la Edge Function «calificar» (entrega del ESTUDIANTE): bloquea si falta tiempo activo y la práctica sigue abierta.
-- La entrega del profesor («Entregar y calificar») no pasa por aquí; la nota se reduce en recompute_attempt.
create or replace function public.svc_tiempo_minimo_verificar(p_user uuid, p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare a public.attempts; v jsonb; v_cierra timestamptz; v_faltan numeric;
begin
  select * into a from public.attempts where id = p_attempt and user_id = p_user;
  if a.id is null then return jsonb_build_object('aplica', false); end if;
  v := public.practica_tiempo_de(p_attempt);
  if v is null or (v ->> 'cumplido')::boolean then return jsonb_build_object('aplica', v is not null); end if;
  select closes_at into v_cierra from public.activities where id = a.activity_id;
  if v_cierra is not null and now() >= v_cierra then
    return jsonb_build_object('aplica', true, 'reducida', true);   -- tras el cierre: se entrega con la nota reducida
  end if;
  v_faltan := (v ->> 'minimo_s')::numeric - (v ->> 'segundos')::numeric;
  raise exception 'Todavía no puede entregar: esta práctica exige % min de trabajo activo y le faltan %.',
    round((v ->> 'minimo_s')::numeric / 60), case when v_faltan < 60 then ceil(v_faltan)::text || ' s' else ceil(v_faltan / 60)::text || ' min' end
    using errcode = 'P0001';
end $$;

-- Profesor: activar (minutos), cambiar o desactivar (NULL). Recalcula las notas de los intentos entregados afectados.
create or replace function public.practica_tiempo_guardar(p_activity uuid, p_minutos integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities; c public.activity_min_time; v_n integer := 0; r record;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if act.mode <> 'practice' then raise exception 'El tiempo mínimo es solo para prácticas' using errcode = 'P0001'; end if;
  if p_minutos is not null and (p_minutos < 1 or p_minutos > 600) then raise exception 'El tiempo mínimo debe estar entre 1 y 600 minutos' using errcode = '22023'; end if;
  select * into c from public.activity_min_time where activity_id = p_activity for update;
  if p_minutos is null then
    update public.activity_min_time set activo = false, updated_by = auth.uid(), updated_at = now() where activity_id = p_activity;
  elsif c.activity_id is null then
    insert into public.activity_min_time (activity_id, minutos, updated_by) values (p_activity, p_minutos, auth.uid());
  else
    -- reactivar: cuenta desde ahora (lo empezado mientras estaba apagado queda exento); cambiar minutos: los
    -- intentos que ya contaban conservan el mínimo con el que empezaron
    update public.activity_min_time set minutos = p_minutos, activo = true,
      activado_at = case when c.activo then c.activado_at else now() end, updated_by = auth.uid(), updated_at = now()
    where activity_id = p_activity;
  end if;
  for r in select a.id from public.attempts a where a.activity_id = p_activity and a.status = 'submitted'
           and (exists (select 1 from public.attempt_active_time t where t.attempt_id = a.id)
                or a.started_at >= coalesce(c.activado_at, now())) loop
    perform public.recompute_attempt(r.id);
    v_n := v_n + 1;
  end loop;
  return public.practica_tiempo_config(p_activity) || jsonb_build_object('recalculados', v_n);
end $$;

-- Profesor: tiempo activo de cada intento de la práctica
create or replace function public.practica_tiempo_intentos(p_activity uuid)
returns table (attempt_id uuid, user_id uuid, full_name text, login_id text, status text, started_at timestamptz, submitted_at timestamptz,
  minimo_s integer, segundos numeric, cumplido boolean, pausas integer, exento boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select a.id, a.user_id, p.full_name, p.login_id, a.status::text, a.started_at, a.submitted_at,
    coalesce(t.minimo_s, public.practica_minimo_aplica(a.id)), coalesce(t.segundos, 0),
    coalesce(t.segundos, 0) >= coalesce(t.minimo_s, public.practica_minimo_aplica(a.id), 0), coalesce(t.pausas, 0),
    public.practica_minimo_aplica(a.id) is null
  from public.attempts a
  join public.profiles p on p.id = a.user_id
  left join public.attempt_active_time t on t.attempt_id = a.id
  where a.activity_id = p_activity
  order by p.full_name, a.attempt_number;
end $$;

-- recompute_attempt: copia de la migración 59 + reducción por tiempo mínimo no cumplido
create or replace function public.recompute_attempt(p_attempt uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_asig boolean;
  v_resp jsonb; v_eap jsonb; v_dom double precision; v_dep jsonb; v_tiempo jsonb;
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
    -- examen adaptativo ENTREGADO: nota = máximo × dominio estimado en el banco (los aciertos no son comparables)
    if exists (select 1 from public.exam_adaptive_state s where s.attempt_id = p_attempt)
       and (select status from public.attempts where id = p_attempt) = 'submitted' then
      select coalesce(jsonb_object_agg(r.exercise_id::text, coalesce(r.manual_credit, r.auto_credit, 0)), '{}'::jsonb) into v_resp
        from public.responses r join public.attempt_item_orders o on o.attempt_id = r.attempt_id and o.exercise_id = r.exercise_id
        where r.attempt_id = p_attempt;
      v_eap := public.adaptive_eap(p_attempt, v_resp);
      select avg(public.adaptive_p(p.a, p.b, (v_eap ->> 'theta')::double precision)) into v_dom from public.exam_adaptive_pool p where p.attempt_id = p_attempt;
      update public.attempts set score = round((max_score * coalesce(v_dom, 0))::numeric, 2) where id = p_attempt;
      update public.exam_adaptive_state set theta = (v_eap ->> 'theta')::double precision, se = (v_eap ->> 'se')::double precision,
        dominio = v_dom, fin = true, updated_at = now() where attempt_id = p_attempt;
    end if;
    -- práctica asistida con penalización por dependencia observada de la ayuda (migración 59)
    v_dep := public.asistida_dependencia(p_attempt);
    if v_dep is not null and (v_dep ->> 'aplicado')::boolean then
      update public.attempts set score = round(score * (1 - (v_dep ->> 'descuento')::numeric / 100), 2) where id = p_attempt;
    end if;
    -- tiempo mínimo de realización (migración 78): entregada sin cumplirlo → nota × (tiempo activo ÷ mínimo)
    v_tiempo := public.practica_tiempo_de(p_attempt);
    if v_tiempo is not null and not (v_tiempo ->> 'cumplido')::boolean
       and (select status from public.attempts where id = p_attempt) = 'submitted' then
      update public.attempts set score = round(score * least(1, (v_tiempo ->> 'segundos')::numeric / (v_tiempo ->> 'minimo_s')::numeric), 2)
        where id = p_attempt;
    end if;
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

-- actividad_copiar: copia de la migración 73 + copia del tiempo mínimo
create or replace function public.actividad_copiar(p_activity uuid, p_class uuid, p_fechas boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  a public.activities; v_src uuid; v_dst uuid; v_new uuid := gen_random_uuid(); v_lesson uuid;
  r record; v_ex uuid; v_map jsonb := '{}'::jsonb; v_enl integer := 0; v_cop integer := 0;
  g public.activity_grade_links; v_fijos numeric; v_disp numeric; v_reg text := null; v_patch jsonb;
begin
  select * into a from public.activities where id = p_activity;
  if a.id is null or not public.is_class_teacher(a.class_id) or p_class is null or not public.is_class_teacher(p_class) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if exists (select 1 from public.control_sessions s where s.control_activity_id = a.id) then
    raise exception 'Una Práctica de Control no se copia: se genera en clase desde Orbe Control' using errcode = 'P0001'; end if;
  select course_id into v_src from public.classes where id = a.class_id;
  select course_id into v_dst from public.classes where id = p_class and not archived;
  if v_dst is null then raise exception 'Sección de destino no válida' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('copiar-actividad:' || v_dst::text, 0));

  -- 1) ejercicios: misma asignatura → los mismos; otra → el del mismo identificador, o una copia
  for r in
    select ex.* from public.exercises ex where ex.id in (
      select i.exercise_id from public.activity_items i where i.activity_id = a.id
      union select d.exercise_id from public.exam_design_items d where d.activity_id = a.id
      union select t.exercise_id from public.assisted_transfer t where t.activity_id = a.id
      union select t.transfer_exercise_id from public.assisted_transfer t where t.activity_id = a.id)
  loop
    if v_src = v_dst then
      v_ex := r.id;
    else
      v_ex := (select e.id from public.exercises e where e.course_id = v_dst and e.slug = r.slug);
      if v_ex is not null then
        v_enl := v_enl + 1;
      else
        v_ex := gen_random_uuid();
        insert into public.exercises
          select (jsonb_populate_record(null::public.exercises, to_jsonb(r) || jsonb_build_object(
            'id', v_ex, 'course_id', v_dst, 'created_by', auth.uid(), 'updated_at', now(),
            'lesson_id', (select l.id from public.lessons l where l.course_id = v_dst and l.slug = (select l0.slug from public.lessons l0 where l0.id = r.lesson_id))))).*;
        insert into public.exercise_keys
          select (jsonb_populate_record(null::public.exercise_keys, to_jsonb(k) || jsonb_build_object('exercise_id', v_ex))).*
          from public.exercise_keys k where k.exercise_id = r.id;
        insert into public.exercise_bank_meta (exercise_id, course_id, meta)
          select v_ex, v_dst, m.meta from public.exercise_bank_meta m where m.exercise_id = r.id;
        v_cop := v_cop + 1;
      end if;
    end if;
    v_map := v_map || jsonb_build_object(r.id::text, v_ex);
  end loop;

  -- 2) la actividad (oculta; sin grupo; lección equivalente en la asignatura de destino)
  v_lesson := case when v_src = v_dst then a.lesson_id
                   else (select l.id from public.lessons l where l.course_id = v_dst and l.slug = (select l0.slug from public.lessons l0 where l0.id = a.lesson_id)) end;
  v_patch := jsonb_build_object('id', v_new, 'class_id', p_class, 'group_id', null, 'lesson_id', v_lesson, 'published', false, 'grades_published', false,
                                'created_by', auth.uid(), 'created_at', now(), 'updated_at', now());
  if not coalesce(p_fechas, true) then
    v_patch := v_patch || jsonb_build_object('opens_at', null, 'closes_at', null)
      -- «después del cierre» necesita una fecha de cierre
      || case when a.reveal_policy = 'after_close' then jsonb_build_object('reveal_policy', 'after_submit') else '{}'::jsonb end;
  end if;
  insert into public.activities select (jsonb_populate_record(null::public.activities, to_jsonb(a) || v_patch)).*;

  insert into public.activity_items (activity_id, exercise_id, position, points)
    select v_new, (v_map ->> i.exercise_id::text)::uuid, i.position, i.points from public.activity_items i where i.activity_id = a.id;

  -- 3) configuración asociada (cada tabla, si la actividad la tiene)
  insert into public.exam_settings
    select (jsonb_populate_record(null::public.exam_settings, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now()))).*
    from public.exam_settings x where x.activity_id = a.id;
  insert into public.exam_designs
    select (jsonb_populate_record(null::public.exam_designs, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now()))).*
    from public.exam_designs x where x.activity_id = a.id;
  insert into public.exam_design_items
    select (jsonb_populate_record(null::public.exam_design_items, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'exercise_id', v_map ->> x.exercise_id::text))).*
    from public.exam_design_items x where x.activity_id = a.id;
  insert into public.exam_adaptive
    select (jsonb_populate_record(null::public.exam_adaptive, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now()))).*
    from public.exam_adaptive x where x.activity_id = a.id;
  -- la actividad de verificación de la práctica asistida es de la sección de origen: en la copia se elige de nuevo
  insert into public.assisted_settings
    select (jsonb_populate_record(null::public.assisted_settings, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now(),
      'verificacion_actividad', null))).*
    from public.assisted_settings x where x.activity_id = a.id;
  insert into public.assisted_transfer (activity_id, exercise_id, transfer_exercise_id)
    select v_new, (v_map ->> t.exercise_id::text)::uuid, (v_map ->> t.transfer_exercise_id::text)::uuid from public.assisted_transfer t where t.activity_id = a.id;

  -- tiempo mínimo de realización (migración 78): misma regla; cuenta desde la copia
  insert into public.activity_min_time (activity_id, minutos, activo, activado_at, updated_by, updated_at)
    select v_new, x.minutos, x.activo, now(), auth.uid(), now() from public.activity_min_time x where x.activity_id = a.id;

  -- 4) Registro de Calificaciones: el mismo apartado; el valor fijo solo si cabe en el destino
  select * into g from public.activity_grade_links where activity_id = a.id;
  if g.activity_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('vinculos:' || p_class::text || g.category, 0));
    v_disp := public.grade_category_max(g.category) - public.grade_part_max(p_class, g.category);
    select coalesce(sum(points), 0) into v_fijos from public.activity_grade_links where class_id = p_class and category = g.category and points is not null;
    insert into public.activity_grade_links (activity_id, class_id, category, points, updated_by)
      values (v_new, p_class, g.category, case when g.points is not null and v_fijos + g.points <= v_disp then g.points end, auth.uid());
    v_reg := g.category;
  end if;

  return jsonb_build_object('id', v_new, 'misma_asignatura', v_src = v_dst, 'ejercicios', (select count(*) from public.activity_items where activity_id = v_new),
    'ejercicios_enlazados', v_enl, 'ejercicios_copiados', v_cop, 'registro', v_reg,
    'registro_por_definir', coalesce(g.points is not null and not exists (select 1 from public.activity_grade_links k where k.activity_id = v_new and k.points is not null), false));
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['practica_minimo_aplica(uuid)', 'practica_tiempo_de(uuid)', 'svc_tiempo_minimo_verificar(uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  grant execute on function public.svc_tiempo_minimo_verificar(uuid, uuid) to service_role;
  foreach f in array array['practica_latido(uuid, boolean)', 'practica_tiempo_estado(uuid)', 'practica_tiempo_config(uuid)',
    'practica_tiempo_guardar(uuid, integer)', 'practica_tiempo_intentos(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.actividad_copiar(uuid, uuid, boolean) from public, anon;
grant execute on function public.actividad_copiar(uuid, uuid, boolean) to authenticated;
