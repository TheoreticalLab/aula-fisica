-- Migración 109 · Penalización por intentos y pistas fijada por actividad (decisión del profesor, 21-nov-2026, en vivo
-- durante la práctica de engranajes de FG1).
--
-- Hasta ahora, en una práctica con retroalimentación inmediata, el ejercicio acertado vale
-- máx(40 %, 100 % − 20 % por intento fallido − 10 % por pista). El profesor quiere, para la práctica de engranajes,
-- −35 % por cada intento fallido y −20 % por cada pista (mínimo 0 %).
--   · actividad_penalizaciones: una fila por actividad (por_intento, por_pista, minimo). Sin fila, la regla de siempre.
--   · svc_record_check: copia EXACTA de la migración 3 (su única definición) con el factor leído de esa tabla.
--   · actividad_recalcular_penalizacion (interna): aplica la regla a lo ya respondido de esa actividad (ejercicios
--     acertados; los parciales se dejan como están, porque no se guarda su crédito sin penalizar) y recalcula los intentos.
-- Aditiva: tabla nueva y create or replace; no cambia ninguna otra práctica.

create table if not exists public.actividad_penalizaciones (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  por_intento numeric not null check (por_intento between 0 and 1),
  por_pista numeric not null check (por_pista between 0 and 1),
  minimo numeric not null default 0 check (minimo between 0 and 1),
  motivo text not null check (char_length(motivo) between 3 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.actividad_penalizaciones enable row level security;
revoke all on table public.actividad_penalizaciones from public, anon, authenticated;
grant all on table public.actividad_penalizaciones to service_role;

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
  v_pen public.actividad_penalizaciones;
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

  -- penalización por reintentos y pistas: la de la actividad si el profesor la fijó (migración 109); si no, la suave de
  -- siempre (mínimo 40 % del puntaje si al final acierta)
  select * into v_pen from public.actividad_penalizaciones where activity_id = v_act.id;
  v_factor := case when v_pen.activity_id is not null
                then greatest(v_pen.minimo, 1 - v_pen.por_intento * v_resp.tries - v_pen.por_pista * v_resp.hints_used)
                else greatest(0.4, 1 - 0.2 * v_resp.tries - 0.1 * v_resp.hints_used) end;
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

-- Aplica la penalización de la actividad a lo ya respondido: crédito de cada ejercicio acertado según los intentos fallidos
-- (tries − 1) y las pistas usadas, y recálculo de cada intento. Devuelve cuántos ejercicios cambiaron.
create or replace function public.actividad_recalcular_penalizacion(p_activity uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_pen public.actividad_penalizaciones; v_n integer; a record;
begin
  select * into v_pen from public.actividad_penalizaciones where activity_id = p_activity;
  if v_pen.activity_id is null then return 0; end if;
  update public.responses r
     set auto_credit = greatest(v_pen.minimo, 1 - v_pen.por_intento * greatest(r.tries - 1, 0) - v_pen.por_pista * r.hints_used)
    from public.attempts t
   where t.id = r.attempt_id and t.activity_id = p_activity and t.mode = 'practice'
     and r.status = 'correct' and not r.solution_revealed and r.manual_credit is null
     and r.auto_credit is distinct from greatest(v_pen.minimo, 1 - v_pen.por_intento * greatest(r.tries - 1, 0) - v_pen.por_pista * r.hints_used);
  get diagnostics v_n = row_count;
  for a in select id from public.attempts where activity_id = p_activity and mode = 'practice' loop
    perform public.recompute_attempt(a.id);
  end loop;
  return v_n;
end $$;

revoke all on function public.actividad_recalcular_penalizacion(uuid) from public, anon, authenticated;
