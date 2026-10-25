-- =============================================================================
-- Aula Virtual de Física Básica · 3. Funciones (RPC)
-- =============================================================================
-- Todas son SECURITY DEFINER con search_path vacío y comprueban auth.uid() explícitamente.
-- Al final se revoca EXECUTE a todos y se concede solo lo necesario.

-- -----------------------------------------------------------------------------
-- Utilidades internas
-- -----------------------------------------------------------------------------

-- Conjunto de práctica de una lección según practice_config (p. ej. 3 básicos, 1 intermedio, 1 desafiante)
create or replace function public.lesson_practice_set(p_lesson uuid)
returns table (exercise_id uuid, ord integer)
language sql stable security definer set search_path = ''
as $$
  with ranked as (
    select e.id, e.difficulty, e.position, e.slug,
           row_number() over (partition by e.difficulty order by e.position, e.slug) as rn
    from public.exercises e
    where e.lesson_id = p_lesson and e.published and e.role = 'practice'
  )
  select r.id, (row_number() over (
            order by case r.difficulty when 'basico' then 1 when 'intermedio' then 2 else 3 end, r.position, r.slug))::integer
  from ranked r
  join public.lessons l on l.id = p_lesson
  where r.rn <= coalesce((l.practice_config ->> r.difficulty::text)::integer, 0)
$$;

-- Puntos de un ejercicio dentro de un intento, o null si el ejercicio no pertenece a ese intento
create or replace function public.attempt_item_points(p_attempt uuid, p_exercise uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select case
    when a.activity_id is not null then (
      select coalesce(i.points, e.points) from public.activity_items i
      join public.exercises e on e.id = i.exercise_id
      where i.activity_id = a.activity_id and i.exercise_id = p_exercise)
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

create or replace function public.recompute_attempt(p_attempt uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts;
begin
  select * into v_att from public.attempts where id = p_attempt;
  if v_att.activity_id is not null then
    update public.attempts a set
      max_score = (select coalesce(sum(coalesce(i.points, e.points)), 0) from public.activity_items i
                   join public.exercises e on e.id = i.exercise_id where i.activity_id = v_att.activity_id),
      -- mismos puntos que max_score y solo ítems que siguen en la actividad
      score = (select coalesce(sum(coalesce(i.points, e.points) * coalesce(r.manual_credit, r.auto_credit, 0)), 0)
               from public.responses r
               join public.activity_items i on i.activity_id = v_att.activity_id and i.exercise_id = r.exercise_id
               join public.exercises e on e.id = r.exercise_id
               where r.attempt_id = p_attempt),
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

-- ¿Puede el estudiante ver si sus respuestas son correctas (y las soluciones)?
create or replace function public.correctness_visible(p_attempt public.attempts, p_activity public.activities)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_activity.id is null then true -- práctica libre de lección
    when p_activity.reveal_policy = 'immediate' then true
    when p_activity.reveal_policy = 'after_submit' then p_attempt.status = 'submitted'
    when p_activity.reveal_policy = 'after_close' then p_attempt.status = 'submitted'
         and p_activity.closes_at is not null and now() >= p_activity.closes_at
    else false
  end
$$;

-- ¿Puede el estudiante ver su puntaje, notas manuales y comentarios del profesor?
create or replace function public.score_visible(p_attempt public.attempts, p_activity public.activities)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_activity.id is null then true
    when p_activity.grades_published then p_attempt.status = 'submitted' or p_activity.mode = 'practice'
    when p_activity.mode = 'practice' and p_activity.reveal_policy = 'immediate' then true
    else false
  end
$$;

-- Valor de dominio (0..1) que aporta una respuesta, o null si no aporta evidencia verificable.
create or replace function public.response_mastery_value(p_resp public.responses, p_mode public.activity_mode)
returns numeric
language sql immutable set search_path = ''
as $$
  select case
    when p_resp.manual_credit is not null then p_resp.manual_credit
    when p_resp.status in ('draft', 'invalid', 'pending_review') then null
    when p_mode = 'exam' then coalesce(p_resp.auto_credit, 0)
    -- práctica: lo que cuenta es acertar al primer intento sin ayuda
    when p_resp.first_try_correct and p_resp.hints_used = 0 then 1.0
    when p_resp.first_try_correct then 0.75
    when p_resp.status in ('correct', 'partial') and not p_resp.solution_revealed then 0.5
    when p_resp.status in ('correct', 'partial') then 0.3
    when p_resp.status in ('incorrect', 'revealed') then 0
    else null
  end
$$;

-- -----------------------------------------------------------------------------
-- Matrícula
-- -----------------------------------------------------------------------------
create table public.join_failures (
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now()
);
create index join_failures_idx on public.join_failures (user_id, at);
alter table public.join_failures enable row level security; -- sin políticas: solo funciones internas

create or replace function public.join_class(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_class public.classes;
  v_group public.class_groups;
  v_existing public.enrollments;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if (select count(*) from public.join_failures where user_id = v_uid and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'Demasiados intentos con códigos incorrectos. Espere una hora.');
  end if;

  select * into v_class from public.classes where join_code = v_code and not archived;
  if not found then
    select * into v_group from public.class_groups where join_code = v_code;
    if found then
      select * into v_class from public.classes where id = v_group.class_id and not archived;
    end if;
  end if;
  if v_class.id is null then
    insert into public.join_failures (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'error', 'El código no corresponde a ninguna clase activa.');
  end if;
  if not v_class.join_open then
    return jsonb_build_object('ok', false, 'error', 'La matrícula de esta clase está cerrada. Consulte a su profesor.');
  end if;
  if public.is_class_teacher(v_class.id) then
    return jsonb_build_object('ok', false, 'error', 'Usted es profesor de esta clase.');
  end if;

  select * into v_existing from public.enrollments where class_id = v_class.id and user_id = v_uid;
  if found then
    if v_existing.group_id is null and v_group.id is not null then
      update public.enrollments set group_id = v_group.id where class_id = v_class.id and user_id = v_uid;
    end if;
    return jsonb_build_object('ok', true, 'class_id', v_class.id, 'already', true);
  end if;

  insert into public.enrollments (class_id, user_id, group_id) values (v_class.id, v_uid, v_group.id);
  return jsonb_build_object('ok', true, 'class_id', v_class.id, 'class_name', v_class.name, 'group_name', v_group.name);
end;
$$;

create or replace function public.regenerate_join_code(p_class uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_code text;
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  loop
    v_code := public.gen_join_code();
    exit when not exists (select 1 from public.classes where join_code = v_code)
          and not exists (select 1 from public.class_groups where join_code = v_code);
  end loop;
  update public.classes set join_code = v_code where id = p_class;
  return v_code;
end;
$$;

-- Clases del estudiante (incluye su grupo y los nombres de sus profesores)
create or replace function public.my_classes()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'class_id', c.id, 'name', c.name, 'term', c.term, 'archived', c.archived,
      'course_id', co.id, 'course_title', co.title,
      'group_name', g.name,
      'teachers', (select coalesce(jsonb_agg(p.full_name order by p.full_name), '[]'::jsonb)
                   from public.class_teachers t join public.profiles p on p.id = t.user_id where t.class_id = c.id)
    ) order by c.archived, c.created_at desc), '[]'::jsonb)
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.courses co on co.id = c.course_id
  left join public.class_groups g on g.id = e.group_id
  where e.user_id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- Intentos
-- -----------------------------------------------------------------------------
create or replace function public.start_lesson_practice(p_lesson uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_lesson public.lessons;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into v_lesson from public.lessons where id = p_lesson;
  if not found or not (public.lesson_visible_to_me(p_lesson) or public.is_teacher()) then
    raise exception 'Lección no disponible' using errcode = '42501';
  end if;
  select id into v_id from public.attempts
    where user_id = v_uid and lesson_id = p_lesson and activity_id is null and status = 'in_progress';
  if found then return v_id; end if;
  insert into public.attempts (user_id, course_id, lesson_id, mode)
    values (v_uid, v_lesson.course_id, p_lesson, 'practice')
    on conflict do nothing
    returning id into v_id;
  if v_id is null then
    select id into v_id from public.attempts
      where user_id = v_uid and lesson_id = p_lesson and activity_id is null and status = 'in_progress';
  end if;
  return v_id;
end;
$$;

-- Cierra la práctica libre actual y abre una nueva (el historial se conserva para el dominio de conceptos)
create or replace function public.restart_lesson_practice(p_lesson uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  update public.attempts set status = 'submitted', submitted_at = now()
    where user_id = auth.uid() and lesson_id = p_lesson and activity_id is null and status = 'in_progress';
  return public.start_lesson_practice(p_lesson);
end;
$$;

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
  select id into v_id from public.attempts where user_id = v_uid and activity_id = p_activity and status = 'in_progress';
  if found then return v_id; end if;
  if v_act.closes_at is not null and now() >= v_act.closes_at then
    raise exception 'La actividad está cerrada' using errcode = 'P0001';
  end if;
  select count(*) into v_used from public.attempts where user_id = v_uid and activity_id = p_activity;
  if v_act.max_attempts is not null and v_used >= v_act.max_attempts then
    raise exception 'Ya utilizó todos los intentos permitidos' using errcode = 'P0001';
  end if;
  select c.course_id into v_course from public.classes c where c.id = v_act.class_id;
  insert into public.attempts (user_id, course_id, activity_id, lesson_id, mode, attempt_number)
    -- lesson_id queda vacío: borrar una lección no debe borrar intentos calificados de una actividad
    values (v_uid, v_course, p_activity, null, v_act.mode, v_used + 1)
    returning id into v_id;
  insert into public.responses (attempt_id, exercise_id, user_id, points)
    select v_id, i.exercise_id, v_uid, coalesce(i.points, e.points)
    from public.activity_items i join public.exercises e on e.id = i.exercise_id
    where i.activity_id = p_activity;
  perform public.recompute_attempt(v_id);
  return v_id;
end;
$$;

-- Comprueba que el intento es del usuario, está en curso y (si es actividad) dentro del plazo
create or replace function public.assert_attempt_writable(p_attempt uuid, p_user uuid)
returns public.attempts
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_act public.activities;
begin
  select * into v_att from public.attempts where id = p_attempt;
  if not found or v_att.user_id <> p_user then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  if v_att.status <> 'in_progress' then raise exception 'El intento ya fue entregado' using errcode = 'P0001'; end if;
  if v_att.activity_id is not null then
    select * into v_act from public.activities where id = v_att.activity_id;
    if v_act.closes_at is not null and now() >= v_act.closes_at then
      raise exception 'El plazo de la actividad terminó' using errcode = 'P0001';
    end if;
    if not v_act.published then raise exception 'Actividad no disponible' using errcode = '42501'; end if;
  elsif v_att.lesson_id is null then
    raise exception 'Intento inválido' using errcode = 'P0001';
  end if;
  return v_att;
end;
$$;

-- Guarda un borrador (no califica). Sirve para «guardar actividades incompletas».
create or replace function public.save_response(p_attempt uuid, p_exercise uuid, p_answer jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.save_response_for(auth.uid(), p_attempt, p_exercise, p_answer);
end;
$$;

-- Igual, para la Edge Function (respuesta no interpretable: se guarda sin consumir intento)
create or replace function public.svc_save_draft(p_user uuid, p_attempt uuid, p_exercise uuid, p_answer jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.save_response_for(p_user, p_attempt, p_exercise, p_answer);
end;
$$;

create or replace function public.save_response_for(p_user uuid, p_attempt uuid, p_exercise uuid, p_answer jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := p_user;
  v_att public.attempts;
  v_points numeric;
  v_resp public.responses;
  v_max integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' or octet_length(p_answer::text) > 20000 then
    raise exception 'Respuesta inválida' using errcode = '22023';
  end if;
  v_att := public.assert_attempt_writable(p_attempt, v_uid);
  v_points := public.attempt_item_points(p_attempt, p_exercise);
  if v_points is null then raise exception 'El ejercicio no pertenece a este intento' using errcode = '42501'; end if;
  select coalesce((select a.max_tries_per_item from public.activities a where a.id = v_att.activity_id), 3) into v_max;
  select * into v_resp from public.responses where attempt_id = p_attempt and exercise_id = p_exercise;
  if found and v_att.mode = 'practice'
     and (v_resp.status in ('correct', 'revealed', 'pending_review') or v_resp.solution_revealed or v_resp.tries >= v_max) then
    return; -- ejercicio ya cerrado: no se modifica la respuesta registrada
  end if;
  insert into public.responses (attempt_id, exercise_id, user_id, answer, points)
    values (p_attempt, p_exercise, v_uid, p_answer, v_points)
    on conflict (attempt_id, exercise_id) do update set answer = excluded.answer;
end;
$$;

create or replace function public.get_hint(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_att public.attempts;
  v_act public.activities;
  v_points numeric;
  v_resp public.responses;
  v_hints jsonb;
  v_n integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  v_att := public.assert_attempt_writable(p_attempt, v_uid);
  if v_att.mode <> 'practice' then raise exception 'Las pistas no están disponibles en evaluaciones' using errcode = 'P0001'; end if;
  if v_att.activity_id is not null then
    select * into v_act from public.activities where id = v_att.activity_id;
    if not v_act.hints_enabled then raise exception 'El profesor desactivó las pistas en esta actividad' using errcode = 'P0001'; end if;
  end if;
  v_points := public.attempt_item_points(p_attempt, p_exercise);
  if v_points is null then raise exception 'El ejercicio no pertenece a este intento' using errcode = '42501'; end if;
  insert into public.responses (attempt_id, exercise_id, user_id, points)
    values (p_attempt, p_exercise, v_uid, v_points)
    on conflict (attempt_id, exercise_id) do nothing;
  select * into v_resp from public.responses where attempt_id = p_attempt and exercise_id = p_exercise for update;
  select coalesce(k.hints, '[]'::jsonb) into v_hints from public.exercise_keys k where k.exercise_id = p_exercise;
  v_hints := coalesce(v_hints, '[]'::jsonb);
  v_n := v_resp.hints_used;
  if v_n >= jsonb_array_length(v_hints) then
    return jsonb_build_object('hint', null, 'index', v_n, 'total', jsonb_array_length(v_hints));
  end if;
  update public.responses set hints_used = v_n + 1 where id = v_resp.id;
  insert into public.response_events (response_id, user_id, kind, result)
    values (v_resp.id, v_uid, 'hint', jsonb_build_object('index', v_n + 1));
  return jsonb_build_object('hint', v_hints -> v_n, 'index', v_n + 1, 'total', jsonb_array_length(v_hints));
end;
$$;

-- El estudiante se rinde en un ejercicio de práctica: ve la solución y el ejercicio queda cerrado
create or replace function public.reveal_solution(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_att public.attempts;
  v_act public.activities;
  v_points numeric;
  v_resp public.responses;
  v_key public.exercise_keys;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  v_att := public.assert_attempt_writable(p_attempt, v_uid);
  if v_att.activity_id is not null then
    select * into v_act from public.activities where id = v_att.activity_id;
  end if;
  if v_att.mode <> 'practice' or (v_act.id is not null and v_act.reveal_policy <> 'immediate') then
    raise exception 'La solución no está disponible en esta actividad' using errcode = 'P0001';
  end if;
  v_points := public.attempt_item_points(p_attempt, p_exercise);
  if v_points is null then raise exception 'El ejercicio no pertenece a este intento' using errcode = '42501'; end if;
  insert into public.responses (attempt_id, exercise_id, user_id, points)
    values (p_attempt, p_exercise, v_uid, v_points)
    on conflict (attempt_id, exercise_id) do nothing;
  update public.responses set
      solution_revealed = true,
      status = case when status in ('correct', 'partial', 'pending_review') then status else 'revealed' end,
      auto_credit = coalesce(auto_credit, 0)
    where attempt_id = p_attempt and exercise_id = p_exercise
    returning * into v_resp;
  insert into public.response_events (response_id, user_id, kind) values (v_resp.id, v_uid, 'reveal');
  perform public.recompute_attempt(p_attempt);
  select * into v_key from public.exercise_keys where exercise_id = p_exercise;
  return jsonb_build_object('answer', v_key.answer, 'explanation', v_key.explanation);
end;
$$;

-- -----------------------------------------------------------------------------
-- Vista de un intento (estudiante: con la política de visibilidad; profesor: completa)
-- -----------------------------------------------------------------------------
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
begin
  select * into v_att from public.attempts where id = p_attempt;
  if not found then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  v_owner := coalesce(v_att.user_id = v_uid, false);
  v_reviewer := public.can_review_attempt(p_attempt);
  if not (v_owner or v_reviewer) then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  if v_att.activity_id is not null then
    select * into v_act from public.activities where id = v_att.activity_id;
  end if;

  v_correct_vis := v_reviewer or public.correctness_visible(v_att, v_act);
  v_score_vis := v_reviewer or public.score_visible(v_att, v_act);
  v_feedback_vis := v_reviewer or v_act.id is null or v_act.grades_published;
  v_max_tries := coalesce(v_act.max_tries_per_item, 3);
  v_editable := v_owner and v_att.status = 'in_progress'
    and (v_act.id is null or v_act.closes_at is null or now() < v_act.closes_at);

  with items as (
    select i.exercise_id, i.position as ord, coalesce(i.points, e.points) as points
      from public.activity_items i join public.exercises e on e.id = i.exercise_id
      where v_att.activity_id is not null and i.activity_id = v_att.activity_id
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

-- Ejercicios similares para reforzar (mismos conceptos, todavía no resueltos por el estudiante)
create or replace function public.reinforcement_for(p_exercise uuid, p_limit integer default 2)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with src as (select concepts, lesson_id, course_id, difficulty from public.exercises where id = p_exercise)
  select coalesce(jsonb_agg(jsonb_build_object('exercise_id', x.id, 'lesson_id', x.lesson_id, 'difficulty', x.difficulty)), '[]'::jsonb)
  from (
    select e.id, e.lesson_id, e.difficulty
    from public.exercises e, src
    where e.course_id = src.course_id and e.id <> p_exercise and e.published
      and e.role in ('reinforcement', 'practice') and e.lesson_id is not null
      and e.concepts && src.concepts
      and public.lesson_visible_to_me(e.lesson_id)
      -- solo cuentan los resultados que el estudiante puede ver (no se filtra por exámenes aún ocultos)
      and not exists (
        select 1 from public.responses r
        join public.attempts t on t.id = r.attempt_id
        left join public.activities act on act.id = t.activity_id
        where r.exercise_id = e.id and r.user_id = auth.uid() and r.status in ('correct', 'revealed')
          and public.correctness_visible(t, act))
      -- no se ofrecen como refuerzo ejercicios que están en una evaluación abierta del estudiante
      and not exists (
        select 1 from public.activity_items i
        join public.activities x on x.id = i.activity_id
        join public.enrollments en on en.class_id = x.class_id and en.user_id = auth.uid()
        where i.exercise_id = e.id and x.published
          and (x.mode = 'exam' or x.reveal_policy <> 'immediate')
          and (x.closes_at is null or now() < x.closes_at))
    order by (e.role = 'reinforcement') desc, (e.lesson_id = src.lesson_id) desc,
             abs((case e.difficulty when 'basico' then 1 when 'intermedio' then 2 else 3 end)
               - (case src.difficulty when 'basico' then 1 when 'intermedio' then 2 else 3 end)),
             random()
    limit greatest(1, least(p_limit, 5))
  ) x
$$;

-- -----------------------------------------------------------------------------
-- Progreso y dominio de conceptos
-- -----------------------------------------------------------------------------
-- p_user null = el propio usuario. Un profesor puede consultar a sus estudiantes.
create or replace function public.concept_mastery(p_course uuid, p_user uuid default null)
returns table (concept_slug text, concept_name text, lesson_id uuid, evidence integer, score numeric, level text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_self boolean := p_user is null or p_user = auth.uid();
begin
  if v_user is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not v_self and not (public.teaches_student(v_user) and (public.teaches_course(p_course) or public.is_course_staff(p_course))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
  with ev as (
    select unnest(e.concepts) as slug,
           public.response_mastery_value(r, a.mode) as val,
           r.updated_at
    from public.responses r
    join public.attempts a on a.id = r.attempt_id
    join public.exercises e on e.id = r.exercise_id
    left join public.activities act on act.id = a.activity_id
    where r.user_id = v_user and a.course_id = p_course
      and (not v_self or public.correctness_visible(a, act))
  ),
  recent as (
    select slug, val, row_number() over (partition by slug order by updated_at desc) as rn
    from ev where val is not null
  ),
  agg as (
    select slug, count(*)::integer as n, round(avg(val), 3) as s from recent where rn <= 10 group by slug
  )
  select c.slug, c.name, c.lesson_id, coalesce(agg.n, 0), agg.s,
         case when coalesce(agg.n, 0) < 2 then 'pocos_datos'
              when agg.s >= 0.8 then 'dominado'
              when agg.s >= 0.5 then 'en_progreso'
              else 'dificultad' end
  from public.concepts c
  left join agg on agg.slug = c.slug
  where c.course_id = p_course
  order by c.lesson_id nulls last, c.slug;
end;
$$;

create or replace function public.lesson_progress(p_course uuid, p_user uuid default null)
returns table (lesson_id uuid, unit_id uuid, practice_total integer, practice_solved integer, mastery numeric, evidence integer)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_self boolean := p_user is null or p_user = auth.uid();
begin
  if v_user is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not v_self and not (public.teaches_student(v_user) and (public.teaches_course(p_course) or public.is_course_staff(p_course))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
  select l.id, l.unit_id,
    (select count(*)::integer from public.lesson_practice_set(l.id)),
    (select count(*)::integer from public.lesson_practice_set(l.id) s
       where exists (select 1 from public.responses r join public.attempts a on a.id = r.attempt_id
                     left join public.activities act on act.id = a.activity_id
                     where r.exercise_id = s.exercise_id and r.user_id = v_user and r.status = 'correct'
                       and (not v_self or public.correctness_visible(a, act)))),
    m.s, coalesce(m.n, 0)
  from public.lessons l
  left join lateral (
    select round(avg(v.val), 3) as s, count(*)::integer as n from (
      select public.response_mastery_value(r, a.mode) as val
      from public.responses r
      join public.attempts a on a.id = r.attempt_id
      join public.exercises e on e.id = r.exercise_id
      left join public.activities act on act.id = a.activity_id
      where e.lesson_id = l.id and r.user_id = v_user
        and (not v_self or public.correctness_visible(a, act))
    ) v where v.val is not null
  ) m on true
  where l.course_id = p_course and (not v_self or public.lesson_visible_to_me(l.id) or public.is_teacher());
end;
$$;

-- -----------------------------------------------------------------------------
-- Panel del estudiante
-- -----------------------------------------------------------------------------
create or replace function public.my_activities()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(s.obj order by (s.obj ->> 'closes_at') nulls last), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', a.id, 'title', a.title, 'mode', a.mode, 'opens_at', a.opens_at, 'closes_at', a.closes_at,
      'class_id', c.id, 'class_name', c.name, 'course_id', c.course_id, 'lesson_id', a.lesson_id,
      'max_attempts', a.max_attempts, 'grades_published', a.grades_published,
      'items', (select count(*) from public.activity_items i where i.activity_id = a.id),
      'attempts_used', (select count(*) from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid()),
      'in_progress', (select t.id from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'in_progress'),
      'submitted', exists (select 1 from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'submitted'),
      'last_attempt_id', (select t.id from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'submitted'
                          order by t.submitted_at desc limit 1),
      'best_score', case when a.grades_published or (a.mode = 'practice' and a.reveal_policy = 'immediate') then
          (select max(t.score) from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'submitted') end,
      'max_score', (select coalesce(sum(coalesce(i.points, e.points)), 0) from public.activity_items i
                    join public.exercises e on e.id = i.exercise_id where i.activity_id = a.id)
    ) as obj
    from public.activities a
    join public.classes c on c.id = a.class_id
    where public.activity_visible_to_me(a.id) and not c.archived
  ) s
$$;

-- Calificaciones publicadas del estudiante (mejor intento entregado)
create or replace function public.my_grades()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'activity_id', a.id, 'title', a.title, 'mode', a.mode, 'class_id', c.id, 'class_name', c.name,
      'closes_at', a.closes_at,
      'best_score', (select max(t.score) from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'submitted'),
      'max_score', (select coalesce(sum(coalesce(i.points, e.points)), 0) from public.activity_items i
                    join public.exercises e on e.id = i.exercise_id where i.activity_id = a.id),
      'attempts', (select count(*) from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'submitted'),
      'pending_review', exists (select 1 from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.needs_review),
      'last_attempt_id', (select t.id from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'submitted'
                          order by t.submitted_at desc limit 1)
    ) order by c.name, a.closes_at nulls last), '[]'::jsonb)
  from public.activities a
  join public.classes c on c.id = a.class_id
  where public.activity_visible_to_me(a.id) and a.grades_published
$$;

-- Prácticas libres de lección sin terminar
create or replace function public.my_pending_practice()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'attempt_id', a.id, 'lesson_id', l.id, 'lesson_title', l.title, 'course_id', l.course_id,
      'started_at', a.started_at,
      'total', (select count(*) from public.lesson_practice_set(l.id)),
      'solved', (select count(*) from public.lesson_practice_set(l.id) s join public.responses r
                 on r.exercise_id = s.exercise_id and r.attempt_id = a.id
                 where r.status in ('correct', 'revealed', 'pending_review') or r.solution_revealed or r.tries >= 3)
    ) order by a.started_at desc), '[]'::jsonb)
  from public.attempts a join public.lessons l on l.id = a.lesson_id
  where a.user_id = auth.uid() and a.activity_id is null and a.status = 'in_progress'
$$;

-- -----------------------------------------------------------------------------
-- Profesorado
-- -----------------------------------------------------------------------------
create or replace function public.grade_response(p_response uuid, p_credit numeric, p_feedback text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_resp public.responses;
begin
  select * into v_resp from public.responses where id = p_response;
  if not found or not public.can_review_attempt(v_resp.attempt_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_credit is not null and (p_credit < 0 or p_credit > 1) then
    raise exception 'El crédito debe estar entre 0 y 1' using errcode = '22023';
  end if;
  if exists (select 1 from public.attempts a where a.id = v_resp.attempt_id and a.activity_id is not null and a.status = 'in_progress') then
    raise exception 'El intento todavía no se ha entregado' using errcode = 'P0001';
  end if;
  update public.responses set
    manual_credit = p_credit,
    teacher_feedback = nullif(left(coalesce(p_feedback, ''), 4000), ''),
    graded_by = auth.uid(),
    graded_at = now(),
    status = case
      -- sin nota manual: vuelve al resultado automático (o a pendiente si no lo hay)
      when p_credit is null and auto_credit is null and status in ('correct', 'partial', 'incorrect')
           and (select e.format from public.exercises e where e.id = responses.exercise_id) = 'open' then 'pending_review'::public.response_status
      when p_credit is null and auto_credit is not null and v_resp.manual_credit is not null then
        (case when auto_credit >= 1 then 'correct' when auto_credit > 0 then 'partial' else 'incorrect' end)::public.response_status
      when p_credit is null then status
      when p_credit >= 1 then 'correct'::public.response_status
      when p_credit > 0 then 'partial'::public.response_status
      else 'incorrect'::public.response_status end
  where id = p_response;
  insert into public.response_events (response_id, user_id, kind, result)
    values (p_response, auth.uid(), 'manual_grade', jsonb_build_object('credit', p_credit));
  perform public.recompute_attempt(v_resp.attempt_id);
end;
$$;

-- Libro de calificaciones de una clase: mejor intento entregado por estudiante y actividad
create or replace function public.gradebook(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'activities', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'mode', a.mode, 'closes_at', a.closes_at, 'published', a.published,
        'grades_published', a.grades_published, 'group_id', a.group_id,
        'max_score', (select coalesce(sum(coalesce(i.points, e.points)), 0) from public.activity_items i
                      join public.exercises e on e.id = i.exercise_id where i.activity_id = a.id)
      ) order by a.closes_at nulls last, a.created_at), '[]'::jsonb)
      from public.activities a where a.class_id = p_class),
    'students', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', p.id, 'full_name', p.full_name, 'email', p.email, 'student_code', p.student_code,
        'group_id', en.group_id, 'group_name', g.name,
        'grades', (select coalesce(jsonb_object_agg(x.activity_id, jsonb_build_object(
              'best', x.best, 'submitted', x.submitted, 'in_progress', x.in_progress, 'needs_review', x.needs_review,
              'last_attempt_id', x.last_attempt_id)), '{}'::jsonb)
            from (
              select t.activity_id,
                     max(t.score) filter (where t.status = 'submitted') as best,
                     count(*) filter (where t.status = 'submitted') as submitted,
                     bool_or(t.status = 'in_progress') as in_progress,
                     bool_or(t.needs_review) as needs_review,
                     (array_agg(t.id order by t.started_at desc))[1] as last_attempt_id
              from public.attempts t join public.activities a on a.id = t.activity_id
              where t.user_id = p.id and a.class_id = p_class
              group by t.activity_id
            ) x)
      ) order by p.full_name), '[]'::jsonb)
      from public.enrollments en
      join public.profiles p on p.id = en.user_id
      left join public.class_groups g on g.id = en.group_id
      where en.class_id = p_class)
  );
end;
$$;

-- Respuestas pendientes de revisión manual
create or replace function public.review_queue(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'response_id', r.id, 'attempt_id', t.id, 'activity_id', a.id, 'activity_title', a.title,
      'student', p.full_name, 'student_id', p.id, 'exercise_slug', e.slug, 'prompt', left(e.prompt, 200),
      'format', e.format, 'status', r.status, 'updated_at', r.updated_at
    ) order by r.updated_at), '[]'::jsonb)
    from public.responses r
    join public.attempts t on t.id = r.attempt_id
    join public.activities a on a.id = t.activity_id
    join public.exercises e on e.id = r.exercise_id
    join public.profiles p on p.id = t.user_id
    where a.class_id = p_class and t.status = 'submitted' and r.manual_credit is null
      and r.status = 'pending_review');
end;
$$;

-- Estadísticas de una actividad: por ítem y global
create or replace function public.activity_stats(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'enrolled', (select count(*) from public.enrollments en where en.class_id = v_class),
        'students_started', count(distinct t.user_id),
        'students_submitted', count(distinct t.user_id) filter (where t.status = 'submitted'),
        'attempts', count(*) filter (where t.status = 'submitted'),
        'mean_best', (select round(avg(b.best), 2) from (
            select max(t2.score) as best from public.attempts t2
            where t2.activity_id = p_activity and t2.status = 'submitted' group by t2.user_id) b),
        'scores', (select coalesce(jsonb_agg(b.best order by b.best), '[]'::jsonb) from (
            select max(t2.score) as best from public.attempts t2
            where t2.activity_id = p_activity and t2.status = 'submitted' group by t2.user_id) b))
      from public.attempts t where t.activity_id = p_activity),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'exercise_id', e.id, 'slug', e.slug, 'prompt', left(e.prompt, 160), 'format', e.format,
          'difficulty', e.difficulty, 'concepts', to_jsonb(e.concepts),
          'answered', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                       where t.activity_id = p_activity and r.exercise_id = e.id and r.status not in ('draft')),
          'correct', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                      where t.activity_id = p_activity and r.exercise_id = e.id and r.status = 'correct'),
          'first_try', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                        where t.activity_id = p_activity and r.exercise_id = e.id and r.first_try_correct),
          'mean_credit', (select round(avg(coalesce(r.manual_credit, r.auto_credit)), 3) from public.responses r
                          join public.attempts t on t.id = r.attempt_id
                          where t.activity_id = p_activity and r.exercise_id = e.id and r.status not in ('draft')),
          'codes', (select coalesce(jsonb_object_agg(c.engine_code, c.n), '{}'::jsonb) from (
                      select r.engine_code, count(*) as n from public.responses r join public.attempts t on t.id = r.attempt_id
                      where t.activity_id = p_activity and r.exercise_id = e.id and r.engine_code is not null
                        and r.engine_code <> 'ok' group by r.engine_code) c)
        ) order by i.position), '[]'::jsonb)
      from public.activity_items i join public.exercises e on e.id = i.exercise_id
      where i.activity_id = p_activity)
  );
end;
$$;

-- Dominio de conceptos en una clase: distribución de niveles por concepto
create or replace function public.class_concept_stats(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_course uuid;
begin
  select course_id into v_course from public.classes where id = p_class;
  if v_course is null or not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'concept_slug', x.concept_slug, 'concept_name', x.concept_name, 'lesson_id', x.lesson_id,
        'students', x.students, 'with_data', x.with_data, 'mean', x.mean,
        'dominado', x.dominado, 'en_progreso', x.en_progreso, 'dificultad', x.dificultad
      ) order by x.lesson_id nulls last, x.concept_slug), '[]'::jsonb)
    from (
      select m.concept_slug, m.concept_name, m.lesson_id,
             count(*) as students,
             count(*) filter (where m.level <> 'pocos_datos') as with_data,
             round(avg(m.score) filter (where m.level <> 'pocos_datos'), 3) as mean,
             count(*) filter (where m.level = 'dominado') as dominado,
             count(*) filter (where m.level = 'en_progreso') as en_progreso,
             count(*) filter (where m.level = 'dificultad') as dificultad
      from public.enrollments en
      cross join lateral public.concept_mastery(v_course, en.user_id) m
      where en.class_id = p_class
      group by m.concept_slug, m.concept_name, m.lesson_id
    ) x);
end;
$$;

-- Añadir colegas por correo (profesor de una clase o del equipo de un curso)
create or replace function public.add_class_teacher_by_email(p_class uuid, p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id into v_user from public.profiles where lower(email) = lower(trim(p_email)) and role in ('teacher', 'admin');
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'No existe un profesor con ese correo.'); end if;
  insert into public.class_teachers (class_id, user_id) values (p_class, v_user) on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.add_course_staff_by_email(p_course uuid, p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.is_course_staff(p_course) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id into v_user from public.profiles where lower(email) = lower(trim(p_email)) and role in ('teacher', 'admin');
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'No existe un profesor con ese correo.'); end if;
  insert into public.course_staff (course_id, user_id) values (p_course, v_user) on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Administración de usuarios
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_users(p_query text default '')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', p.email, 'student_code', p.student_code, 'role', p.role, 'created_at', p.created_at
    ) order by p.created_at desc), '[]'::jsonb)
    from (select * from public.profiles p
          where coalesce(p_query, '') = '' or p.email ilike '%' || p_query || '%' or p.full_name ilike '%' || p_query || '%'
          order by p.created_at desc limit 100) p);
end;
$$;

create or replace function public.admin_set_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'No puede quitarse a sí mismo el rol de administrador' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user;
  -- quien deja de ser profesor pierde el acceso a cursos y clases (claves, respuestas, listas)
  if p_role = 'student' then
    delete from public.course_staff where user_id = p_user;
    delete from public.class_teachers where user_id = p_user;
  end if;
end;
$$;

-- Ejecutar UNA VEZ desde el editor SQL de Supabase (como postgres) para crear el primer administrador.
-- No está disponible para la API: se revoca EXECUTE más abajo.
create or replace function public.bootstrap_admin(p_email text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid;
begin
  select id into v_user from public.profiles where lower(email) = lower(trim(p_email));
  if v_user is null then return 'No existe un usuario con ese correo. Regístrese primero en la aplicación.'; end if;
  update public.profiles set role = 'admin' where id = v_user;
  insert into public.course_staff (course_id, user_id) select id, v_user from public.courses on conflict do nothing;
  return 'Listo: ' || p_email || ' es administrador y forma parte del equipo docente de todos los cursos.';
end;
$$;

-- -----------------------------------------------------------------------------
-- Funciones de servicio (solo service_role, desde la Edge Function «calificar»)
-- -----------------------------------------------------------------------------

-- Contexto para calificar un ejercicio de PRÁCTICA (retroalimentación inmediata)
create or replace function public.svc_check_context(p_user uuid, p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_act public.activities;
  v_points numeric;
  v_resp public.responses;
  v_ex public.exercises;
  v_key public.exercise_keys;
  v_max integer;
begin
  v_att := public.assert_attempt_writable(p_attempt, p_user);
  if v_att.mode <> 'practice' then raise exception 'En una evaluación las respuestas se califican al entregar' using errcode = 'P0001'; end if;
  if v_att.activity_id is not null then
    select * into v_act from public.activities where id = v_att.activity_id;
    if v_act.reveal_policy <> 'immediate' then
      raise exception 'Esta actividad no tiene retroalimentación inmediata' using errcode = 'P0001';
    end if;
  end if;
  v_points := public.attempt_item_points(p_attempt, p_exercise);
  if v_points is null then raise exception 'El ejercicio no pertenece a este intento' using errcode = '42501'; end if;
  v_max := coalesce(v_act.max_tries_per_item, 3);
  select * into v_resp from public.responses where attempt_id = p_attempt and exercise_id = p_exercise;
  if found and (v_resp.status in ('correct', 'revealed', 'pending_review') or v_resp.solution_revealed or v_resp.tries >= v_max) then
    raise exception 'Este ejercicio ya está cerrado' using errcode = 'P0001';
  end if;
  select * into v_ex from public.exercises where id = p_exercise;
  select * into v_key from public.exercise_keys where exercise_id = p_exercise;
  if v_key.exercise_id is null then raise exception 'El ejercicio no tiene clave de respuesta' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'key', v_key.answer, 'format', v_ex.format,
    'option_count', case when v_ex.options is null then null else jsonb_array_length(v_ex.options) end,
    'max_tries', v_max);
end;
$$;

-- Registra un intento de práctica ya calificado por el motor y devuelve el estado resultante
create or replace function public.svc_record_check(p_user uuid, p_attempt uuid, p_exercise uuid, p_answer jsonb, p_result jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_act public.activities;
  v_points numeric;
  v_resp public.responses;
  v_key public.exercise_keys;
  v_status text := p_result ->> 'status';
  v_credit numeric := least(1, greatest(0, coalesce((p_result ->> 'credit')::numeric, 0)));
  v_factor numeric;
  v_new_status public.response_status;
  v_new_credit numeric;
  v_max integer;
  v_locked boolean;
begin
  v_att := public.assert_attempt_writable(p_attempt, p_user);
  if v_att.activity_id is not null then select * into v_act from public.activities where id = v_att.activity_id; end if;
  -- defensa en profundidad: solo práctica con retroalimentación inmediata
  if v_att.mode <> 'practice' or (v_act.id is not null and v_act.reveal_policy <> 'immediate') then
    raise exception 'Esta actividad no tiene retroalimentación inmediata' using errcode = 'P0001';
  end if;
  v_max := coalesce(v_act.max_tries_per_item, 3);
  v_points := public.attempt_item_points(p_attempt, p_exercise);
  if v_points is null then raise exception 'El ejercicio no pertenece a este intento' using errcode = '42501'; end if;
  insert into public.responses (attempt_id, exercise_id, user_id, points)
    values (p_attempt, p_exercise, p_user, v_points)
    on conflict (attempt_id, exercise_id) do nothing;
  select * into v_resp from public.responses where attempt_id = p_attempt and exercise_id = p_exercise for update;
  if v_resp.status in ('correct', 'revealed', 'pending_review') or v_resp.solution_revealed or v_resp.tries >= v_max then
    raise exception 'Este ejercicio ya está cerrado' using errcode = 'P0001';
  end if;

  -- penalización suave por reintentos y pistas (mínimo 40 % del puntaje si al final acierta)
  v_factor := greatest(0.4, 1 - 0.2 * v_resp.tries - 0.1 * v_resp.hints_used);
  if v_status = 'correct' then
    v_new_status := 'correct';
    v_new_credit := greatest(coalesce(v_resp.auto_credit, 0), v_factor);
  elsif v_status = 'partial' then
    v_new_credit := greatest(coalesce(v_resp.auto_credit, 0), v_credit * v_factor);
    v_new_status := 'partial';
  elsif v_status = 'pending_review' then
    v_new_status := 'pending_review';
    v_new_credit := null;
  else
    v_new_credit := coalesce(v_resp.auto_credit, 0);
    v_new_status := case when v_resp.status = 'partial' then 'partial' else 'incorrect' end;
  end if;

  update public.responses set
    answer = p_answer,
    status = v_new_status,
    auto_credit = v_new_credit,
    tries = tries + 1,
    first_try_correct = case when v_resp.tries = 0 then v_status = 'correct' else first_try_correct end,
    engine_code = p_result ->> 'code',
    engine_messages = coalesce(p_result -> 'messages', '[]'::jsonb)
  where id = v_resp.id
  returning * into v_resp;

  insert into public.response_events (response_id, user_id, kind, answer, result)
    values (v_resp.id, p_user, 'check', p_answer, p_result);
  perform public.recompute_attempt(p_attempt);

  v_locked := v_resp.status in ('correct', 'pending_review') or v_resp.tries >= v_max;
  if v_locked then select * into v_key from public.exercise_keys where exercise_id = p_exercise; end if;
  return jsonb_build_object(
    'status', v_resp.status, 'credit', v_resp.auto_credit, 'tries', v_resp.tries, 'max_tries', v_max,
    'locked', v_locked,
    'solution', case when v_locked then jsonb_build_object('answer', v_key.answer, 'explanation', v_key.explanation) end);
end;
$$;

-- Contexto para entregar un intento completo (evaluación o actividad de práctica)
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
      where i.activity_id = v_att.activity_id));
end;
$$;

create or replace function public.svc_record_submission(p_user uuid, p_attempt uuid, p_results jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_item jsonb;
  v_status public.response_status;
  v_points numeric;
  v_resp_id uuid;
begin
  select * into v_att from public.attempts where id = p_attempt for update;
  if not found or v_att.user_id <> p_user then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  if v_att.status <> 'in_progress' then raise exception 'El intento ya fue entregado' using errcode = 'P0001'; end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    v_points := public.attempt_item_points(p_attempt, (v_item ->> 'exercise_id')::uuid);
    continue when v_points is null;
    v_status := case v_item ->> 'status'
      when 'correct' then 'correct' when 'partial' then 'partial' when 'pending_review' then 'pending_review'
      else 'incorrect' end;
    insert into public.responses (attempt_id, exercise_id, user_id, points)
      values (p_attempt, (v_item ->> 'exercise_id')::uuid, p_user, v_points)
      on conflict (attempt_id, exercise_id) do nothing;
    update public.responses r set
      status = v_status,
      auto_credit = case when v_status = 'pending_review' then null
                         else least(1, greatest(0, coalesce((v_item ->> 'credit')::numeric, 0))) end,
      tries = r.tries + 1,
      first_try_correct = case when r.tries = 0 then v_status = 'correct' else r.first_try_correct end,
      engine_code = v_item ->> 'code',
      engine_messages = coalesce(v_item -> 'messages', '[]'::jsonb),
      -- se guarda la respuesta exacta que se calificó
      answer = coalesce(v_item -> 'answer', r.answer)
    where r.attempt_id = p_attempt and r.exercise_id = (v_item ->> 'exercise_id')::uuid
      -- en actividades de práctica, los ítems ya comprobados conservan su resultado
      and (v_att.mode = 'exam' or r.status in ('draft', 'invalid'))
    returning r.id into v_resp_id;
    if v_resp_id is not null then
      insert into public.response_events (response_id, user_id, kind, result) values (v_resp_id, p_user, 'submit', v_item);
    end if;
    v_resp_id := null;
  end loop;

  update public.attempts set status = 'submitted', submitted_at = now() where id = p_attempt;
  perform public.recompute_attempt(p_attempt);
  return (select jsonb_build_object('status', status, 'submitted_at', submitted_at) from public.attempts where id = p_attempt);
end;
$$;

-- Intentos en curso de una actividad (para que el profesor los cierre y califique tras el plazo)
create or replace function public.svc_finalize_context(p_teacher uuid, p_activity uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null then raise exception 'Actividad no encontrada' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_teacher and role = 'admin')
     and not exists (select 1 from public.class_teachers where class_id = v_class and user_id = p_teacher) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('attempt_id', t.id, 'user_id', t.user_id)), '[]'::jsonb)
          from public.attempts t where t.activity_id = p_activity and t.status = 'in_progress');
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilegios de ejecución
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- usadas por políticas RLS y valores por defecto
grant execute on function
  public.gen_join_code(), public.my_role(), public.is_teacher(), public.is_admin(), public.is_teacher_user(uuid),
  public.is_course_staff(uuid), public.is_class_teacher(uuid), public.teaches_course(uuid), public.can_view_keys(uuid),
  public.is_enrolled_class(uuid), public.is_enrolled_course(uuid), public.teaches_student(uuid), public.can_see_profile(uuid),
  public.lesson_visible_to_me(uuid), public.activity_visible_to_me(uuid), public.activity_open_to_me(uuid),
  public.exercise_in_open_activity(uuid), public.exercise_course(uuid), public.can_review_attempt(uuid)
  to authenticated;

-- RPC para usuarios autenticados (cada una comprueba permisos internamente)
grant execute on function
  public.join_class(text), public.regenerate_join_code(uuid), public.my_classes(),
  public.start_lesson_practice(uuid), public.restart_lesson_practice(uuid), public.start_activity_attempt(uuid),
  public.save_response(uuid, uuid, jsonb), public.get_hint(uuid, uuid), public.reveal_solution(uuid, uuid),
  public.get_attempt(uuid), public.reinforcement_for(uuid, integer),
  public.concept_mastery(uuid, uuid), public.lesson_progress(uuid, uuid),
  public.my_activities(), public.my_grades(), public.my_pending_practice(),
  public.grade_response(uuid, numeric, text), public.gradebook(uuid), public.review_queue(uuid),
  public.activity_stats(uuid), public.class_concept_stats(uuid),
  public.add_class_teacher_by_email(uuid, text), public.add_course_staff_by_email(uuid, text),
  public.admin_list_users(text), public.admin_set_role(uuid, public.app_role)
  to authenticated;

-- solo la Edge Function (clave service_role)
grant execute on function
  public.svc_check_context(uuid, uuid, uuid), public.svc_record_check(uuid, uuid, uuid, jsonb, jsonb),
  public.svc_submit_context(uuid, uuid), public.svc_record_submission(uuid, uuid, jsonb),
  public.svc_finalize_context(uuid, uuid), public.svc_save_draft(uuid, uuid, uuid, jsonb)
  to service_role;

-- bootstrap_admin, save_response_for, recompute_attempt, assert_attempt_writable, attempt_item_points, lesson_practice_set,
-- correctness_visible, score_visible y response_mastery_value quedan sin EXECUTE para la API.
