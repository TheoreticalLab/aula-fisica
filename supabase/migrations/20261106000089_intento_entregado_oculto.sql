-- =============================================================================
-- Migración 89 · Evaluaciones con soluciones «nunca»: el intento entregado no se puede volver a abrir.
--
-- Hasta ahora, tras entregar, el estudiante podía abrir su intento y ver todos los enunciados y sus respuestas
-- (sin solución ni nota). En una evaluación con soluciones «nunca» (las de laboratorio y la plantilla «Evaluación
-- protegida») eso permitía capturar y pasar las preguntas a quien aún no la había presentado.
--
-- get_attempt (copia LITERAL de la migración 80, generada con privado/tmp/rend2/generar-migracion-89.py) con un único
-- cambio: si quien la pide es el AUTOR (no el profesorado), la actividad es una evaluación con reveal_policy = 'never'
-- y el intento ya no está en curso, se devuelven los datos del intento (estado, fecha, nota cuando se publique) pero
-- SIN preguntas ni respuestas (items vacío) y flags.contenido_oculto = true. Mientras responde, todo igual que antes.
-- No hay otra vía: los enunciados de estas evaluaciones (sin lección, papel «bank») y la composición de la actividad
-- ya no los lee un estudiante por REST (migración 80).
-- Aditiva: create or replace con la misma firma; los permisos no cambian. Reversión:
-- supabase/reversion/20261106000089_intento_entregado_oculto_revertir.sql
-- =============================================================================

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
  v_una boolean;
  v_reservar boolean;
  v_oculto boolean;
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

  -- «Una pregunta a la vez»: la sesión del intento lo fija; sin sesión todavía (antes de exam_open), la
  -- configuración vigente de la evaluación. Mientras la evaluación no cierre, el estudiante solo recibe las
  -- preguntas que el servidor ya le abrió (exam_events: apertura / ir_a).
  v_una := exists (select 1 from public.exam_sessions s where s.attempt_id = p_attempt and s.presentacion = 'una_a_la_vez')
    or (v_act.id is not null and v_act.mode = 'exam' and v_att.status = 'in_progress'
        and not exists (select 1 from public.exam_sessions s where s.attempt_id = p_attempt)
        and exists (select 1 from public.exam_settings c where c.activity_id = v_act.id and c.presentacion = 'una_a_la_vez'));
  v_reservar := v_una and not v_reviewer and not (v_act.closes_at is not null and now() >= v_act.closes_at);

  v_correct_vis := v_reviewer or public.correctness_visible(v_att, v_act);
  v_score_vis := v_reviewer or public.score_visible(v_att, v_act);
  v_feedback_vis := v_reviewer or v_act.id is null or v_act.grades_published;
  v_max_tries := coalesce(v_act.max_tries_per_item, 3);
  v_editable := v_owner and v_att.status = 'in_progress'
    and (v_act.id is null or v_act.closes_at is null or now() < v_act.closes_at);
  -- migración 89: evaluación con soluciones «nunca» ya entregada: su autor no vuelve a ver preguntas ni respuestas
  -- (evita que circulen mientras otros la presentan). El profesorado lo sigue viendo todo.
  v_oculto := v_owner and not v_reviewer and v_act.id is not null and v_act.mode = 'exam'
    and v_act.reveal_policy = 'never' and v_att.status <> 'in_progress';

  if v_oculto then
    v_items := '[]'::jsonb;
  else

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
  ),
  autorizadas as (
    select distinct ev.exercise_id from public.exam_events ev
    where v_reservar and ev.attempt_id = p_attempt and ev.tipo in ('apertura', 'ir_a') and ev.exercise_id is not null
  )
  select coalesce(jsonb_agg(
    case when v_reservar and not exists (select 1 from autorizadas au where au.exercise_id = it.exercise_id) then
      -- marcador: sin enunciado, opciones, figura, simulación, pistas ni solución
      jsonb_build_object(
        'exercise', jsonb_build_object('id', e.id, 'oculto', true),
        'points', it.points,
        'response', case when r.id is null then null else jsonb_build_object(
          'id', r.id, 'answer', r.answer,
          'status', case when r.status = 'draft' then 'draft' else 'submitted' end,
          'credit', null, 'messages', '[]'::jsonb, 'tries', r.tries, 'hints_used', 0,
          'solution_revealed', false, 'teacher_feedback', null, 'manual_credit', null, 'updated_at', r.updated_at) end,
        'hints', null, 'hints_total', 0, 'locked', false, 'solution', null)
    else jsonb_build_object(
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
    ) end order by it.ord), '[]'::jsonb)
  into v_items
  from items it
  join public.exercises e on e.id = it.exercise_id
  left join public.responses r on r.attempt_id = p_attempt and r.exercise_id = it.exercise_id
  left join public.exercise_keys k on k.exercise_id = it.exercise_id;
  end if;

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
      'reveal_allowed', v_att.mode = 'practice' and (v_act.id is null or v_act.reveal_policy = 'immediate'),
      'reservadas', v_reservar, 'contenido_oculto', v_oculto),
    'items', v_items
  );
end;
$$;
