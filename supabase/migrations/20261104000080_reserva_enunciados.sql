-- =============================================================================
-- Aula Virtual de Física · 80. Reserva de enunciados (AUD-SEC-001, P0)
-- =============================================================================
-- Incidente: con una cuenta de estudiante, GET /rest/v1/activity_items devolvía los ejercicios de una práctica
-- publicada y abierta, y GET /rest/v1/exercises?select=prompt devolvía sus enunciados ANTES de empezar el intento.
--
-- Causa raíz (migración 2):
--   · exercises_select tenía la rama «exercise_in_open_activity(id)»: cualquier ejercicio de una actividad publicada
--     cuya apertura ya pasó era legible por REST, con intento o sin él, abierta o ya cerrada.
--   · activity_items_select permitía a los estudiantes leer la composición (qué ejercicios, en qué orden y con qué
--     puntos) de toda actividad publicada y abierta, incluidos los controles y las de su grupo o no.
--   · get_attempt entregaba TODAS las preguntas del intento de una vez, también en «una pregunta a la vez».
--   · exam_goto no comprobaba el tiempo oficial: con el intento vencido se podía seguir abriendo preguntas.
--
-- Regla nueva (mínimo privilegio):
--   · Por REST el estudiante solo lee el catálogo público de estudio: ejercicios publicados de práctica o refuerzo
--     de lecciones visibles para él (igual que antes). Nada por pertenecer a una actividad.
--   · La composición de las actividades (activity_items) solo la lee el profesorado de la sección.
--   · Los enunciados de una actividad se entregan exclusivamente con get_attempt (SECURITY DEFINER), que exige un
--     intento propio, creado por start_activity_attempt (visibilidad, apertura, cierre, intentos, lectura).
--   · En «una pregunta a la vez» (y por tanto en el adaptativo y en los controles), get_attempt solo entrega las
--     preguntas que el servidor ya autorizó (apertura o exam_goto registrados en exam_events); el resto va como
--     marcador sin contenido hasta que la evaluación cierre. El profesorado revisor lo ve todo.
--   · exam_goto rechaza cambiar de pregunta con el tiempo oficial vencido.
--
-- Aditiva: dos políticas reemplazadas en la misma transacción (más estrictas), dos funciones redefinidas copiando
-- su última versión (get_attempt de la migración 28, exam_goto de la 35) y una revocación de EXECUTE.
-- Reversión: supabase/reversion/20261104000080_reserva_enunciados_revertir.sql (restaura las versiones de las migraciones 2, 3, 28 y 35, vigentes hasta la 79).

-- -----------------------------------------------------------------------------
-- 1) exercises: sin la rama «ejercicio de una actividad abierta»
-- -----------------------------------------------------------------------------
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select to authenticated
  using (
    public.is_teacher()
    or (published and role in ('practice', 'reinforcement') and lesson_id is not null and public.lesson_visible_to_me(lesson_id))
  );

-- -----------------------------------------------------------------------------
-- 2) activity_items: la composición de una actividad solo la ve su profesorado
-- -----------------------------------------------------------------------------
drop policy if exists activity_items_select on public.activity_items;
create policy activity_items_select on public.activity_items for select to authenticated
  using (public.is_class_teacher((select a.class_id from public.activities a where a.id = activity_id)));

-- La función ya no la usa ninguna política; ejecutable por un estudiante era un oráculo de composición.
revoke execute on function public.exercise_in_open_activity(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3) get_attempt (migración 28) + solo las preguntas autorizadas en «una pregunta a la vez»
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
  v_asig boolean;
  v_una boolean;
  v_reservar boolean;
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
      'reservadas', v_reservar),
    'items', v_items
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) exam_goto (migración 35) + con el tiempo oficial vencido no se abren preguntas
-- -----------------------------------------------------------------------------
create or replace function public.exam_goto(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.exam_sessions; v_orden uuid[]; i integer; j integer; v_lim timestamptz;
begin
  s := public.exam_session_for(p_attempt);
  v_lim := public.exam_deadline(p_attempt);
  if v_lim is not null and now() >= v_lim then
    raise exception 'El tiempo del examen terminó: ya no se puede cambiar de pregunta' using errcode = 'P0001';
  end if;
  if s.pausa_desde is not null then raise exception 'Reanude el examen para continuar' using errcode = 'P0001'; end if;
  v_orden := public.exam_item_order(p_attempt);
  j := array_position(v_orden, p_exercise);
  if j is null then raise exception 'La pregunta no pertenece a este intento' using errcode = '42501'; end if;
  if s.navegacion = 'solo_adelante' and s.activa is not null then
    i := array_position(v_orden, s.activa);
    if j < i or (j <> i and exists (select 1 from public.exam_events e where e.attempt_id = p_attempt and e.tipo in ('apertura', 'ir_a') and e.exercise_id = p_exercise)) then
      raise exception 'En este examen no se puede volver a preguntas anteriores' using errcode = 'P0001';
    end if;
  end if;
  update public.exam_sessions set activa = p_exercise, ultimo_contacto = now() where attempt_id = p_attempt;
  insert into public.exam_events (attempt_id, user_id, tipo, exercise_id) values (p_attempt, s.user_id, 'ir_a', p_exercise);
  return jsonb_build_object('ahora_ms', public.exam_ms(now()), 'activa', p_exercise);
end;
$$;
