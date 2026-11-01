-- Pruebas: examen adaptativo en el motor de examen (migración 53). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de530000-0000-4000-8000-000000000001', 'ad1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-adaptativo","aula_role":"teacher"}', '{}', now(), now()),
  ('de530000-0000-4000-8000-000000000002', 'ad2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-adaptativo-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('de530000-0000-4000-8000-000000000011', 'ad11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-adapt-1"}', '{}', now(), now()),
  ('de530000-0000-4000-8000-000000000012', 'ad12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-adapt-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de530000-%';
update public.profiles set role = 'teacher' where id in ('de530000-0000-4000-8000-000000000001', 'de530000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de530000-0000-4000-8000-000000000021', 'Curso adaptativo');
-- 20 preguntas con dificultades de −2.85 a 2.85 (calibradas) y 1 sin calibrar
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points)
  select ('de530000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'de530000-0000-4000-8000-000000000021', 'adapt-' || g, 'numerica', 'intermedio', 'bank', 'numeric', 'Pregunta ' || g, 1
  from generate_series(1, 21) g;
insert into public.exercise_keys (exercise_id, answer, explanation)
  select ('de530000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, '{"format":"numeric","value":"1 m"}', '' from generate_series(1, 21) g;
insert into public.item_calibrations (exercise_id, a, b, se_a, se_b, n_resp, estado)
  select ('de530000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, 1.2, -3 + g * 0.3 - 0.15, 0.1, 0.1, 300, 'calibrado' from generate_series(1, 20) g;
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de530000-0000-4000-8000-000000000031', 'de530000-0000-4000-8000-000000000021', 'Sección adaptativa', 'ADAPTA01', 'de530000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de530000-0000-4000-8000-000000000031', 'de530000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de530000-0000-4000-8000-000000000031', 'de530000-0000-4000-8000-000000000011'), ('de530000-0000-4000-8000-000000000031', 'de530000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de530000-0000-4000-8000-0000000000a1', 'de530000-0000-4000-8000-000000000031', 'Parcial adaptativo', 'exam', true, 'after_submit', false, 1),
  ('de530000-0000-4000-8000-0000000000a2', 'de530000-0000-4000-8000-000000000031', 'Práctica', 'practice', true, 'immediate', true, 3),
  ('de530000-0000-4000-8000-0000000000a3', 'de530000-0000-4000-8000-000000000031', 'Parcial con banco corto', 'exam', true, 'after_submit', false, 1);
insert into public.activity_items (activity_id, exercise_id, position)
  select 'de530000-0000-4000-8000-0000000000a1', ('de530000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, g from generate_series(1, 21) g;
insert into public.activity_items (activity_id, exercise_id, position)
  select 'de530000-0000-4000-8000-0000000000a3', ('de530000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, g from generate_series(1, 10) g;

do $$ begin
  if has_function_privilege('authenticated', 'public.svc_adaptativo_siguiente(uuid, uuid, uuid, jsonb)', 'execute') then raise exception 'FALLO: svc expuesta'; end if;
  if has_table_privilege('authenticated', 'public.exam_adaptive_state', 'select') then raise exception 'FALLO: estado legible directamente'; end if;
  if has_table_privilege('authenticated', 'public.exam_adaptive_pool', 'select') then raise exception 'FALLO: banco legible directamente'; end if;
end $$;

-- 1) configuración: solo el profesor de la sección, solo evaluaciones, banco calibrado ≥ 15
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de530000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de530000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.exam_adaptive_save('de530000-0000-4000-8000-0000000000a1', '{}'); raise exception 'FALLO: profesor ajeno configuró';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de530000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de530000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.exam_adaptive_save('de530000-0000-4000-8000-0000000000a2', '{}'); raise exception 'FALLO: adaptativo en una práctica';
  exception when invalid_parameter_value then null; end;
  begin perform public.exam_adaptive_save('de530000-0000-4000-8000-0000000000a3', '{"max_items":5}'); raise exception 'FALLO: banco de 10 aceptado';
  exception when raise_exception then if sqlerrm not like '%al menos 15%' then raise; end if; end;
  begin perform public.exam_adaptive_save('de530000-0000-4000-8000-0000000000a1', '{"max_items":25}'); raise exception 'FALLO: máximo mayor que el banco';
  exception when invalid_parameter_value then null; end;
  r := public.exam_adaptive_save('de530000-0000-4000-8000-0000000000a1', '{"max_items":8,"min_items":5,"se_objetivo":0.2,"exposicion":1}');
  if (r -> 'config' ->> 'max_items')::int <> 8 or (r ->> 'calibradas')::int <> 20 then raise exception 'FALLO: configuración %', r; end if;
end $$;
reset role;
do $$ begin
  if (select presentacion || '/' || navegacion from public.exam_settings where activity_id = 'de530000-0000-4000-8000-0000000000a1') <> 'una_a_la_vez/solo_adelante' then
    raise exception 'FALLO: el examen adaptativo debe ser de una pregunta a la vez y solo hacia adelante'; end if;
end $$;

-- 2) empezar: una sola pregunta asignada (la más informativa en θ = 0: b más cercana a 0) y copia del banco
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de530000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de530000-0000-4000-8000-000000000011', true);
select set_config('prueba.t1', public.start_activity_attempt('de530000-0000-4000-8000-0000000000a1')::text, true);
do $$ declare v jsonb; begin
  v := public.get_attempt(current_setting('prueba.t1')::uuid);
  if jsonb_array_length(v -> 'items') <> 1 then raise exception 'FALLO: el estudiante ve % preguntas al empezar', jsonb_array_length(v -> 'items'); end if;
  if (public.exam_adaptive_estado(current_setting('prueba.t1')::uuid) ->> 'administradas')::int <> 1 then raise exception 'FALLO: estado inicial'; end if;
  if public.exam_adaptive_estado(current_setting('prueba.t1')::uuid) ? 'theta' then raise exception 'FALLO: el estudiante ve su θ'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de530000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de530000-0000-4000-8000-000000000012', true);
select set_config('prueba.t2', public.start_activity_attempt('de530000-0000-4000-8000-0000000000a1')::text, true);
reset role;
do $$ declare v_b double precision; begin
  if (select count(*) from public.exam_adaptive_pool where attempt_id = current_setting('prueba.t1')::uuid) <> 20 then raise exception 'FALLO: la copia del banco debe tener las 20 calibradas'; end if;
  select c.b into v_b from public.attempt_item_orders o join public.item_calibrations c on c.exercise_id = o.exercise_id where o.attempt_id = current_setting('prueba.t1')::uuid;
  if abs(v_b) > 0.2 then raise exception 'FALLO: la primera pregunta debía ser la de b ≈ 0 (b = %)', v_b; end if;
  if (select count(*) from public.responses where attempt_id = current_setting('prueba.t1')::uuid) <> 1 then raise exception 'FALLO: respuestas creadas para preguntas no asignadas'; end if;
end $$;

-- 2b) la estimación EAP del servidor coincide con una implementación independiente (Node, misma rejilla y a priori):
--     respuestas a las preguntas 10 (acierto), 11 (fallo) y 13 (acierto) → θ = 0.434358125, ET = 0.728253524
do $$ declare r jsonb; begin
  r := public.adaptive_eap(current_setting('prueba.t1')::uuid, jsonb_build_object(
    'de530000-0000-4000-8000-000000000110', 1, 'de530000-0000-4000-8000-000000000111', 0, 'de530000-0000-4000-8000-000000000113', 1));
  if abs((r ->> 'theta')::double precision - 0.434358125) > 1e-6 or abs((r ->> 'se')::double precision - 0.728253524) > 1e-6 or (r ->> 'n')::int <> 3 then
    raise exception 'FALLO: EAP del servidor % (referencia θ = 0.434358125, ET = 0.728253524)', r; end if;
  if abs((select avg(public.adaptive_p(p.a, p.b, 0.434358125)) from public.exam_adaptive_pool p where p.attempt_id = current_setting('prueba.t1')::uuid) - 0.568399656) > 1e-6 then
    raise exception 'FALLO: dominio en el banco distinto de la referencia 0.568399656'; end if;
end $$;

-- 3) recorrido: el estudiante 1 acierta todo (θ sube y las preguntas se endurecen), el 2 falla todo
set local role service_role;
do $$ declare t uuid; u uuid; r jsonb; r2 jsonb; cred jsonb; ultima uuid; b_prev double precision; b_act double precision; i integer;
begin
  for i in 1..2 loop
    t := current_setting(case i when 1 then 'prueba.t1' else 'prueba.t2' end)::uuid;
    u := case i when 1 then 'de530000-0000-4000-8000-000000000011'::uuid else 'de530000-0000-4000-8000-000000000012'::uuid end;
    loop
      select o.exercise_id into ultima from public.attempt_item_orders o where o.attempt_id = t order by o.position desc limit 1;
      select jsonb_object_agg(o.exercise_id::text, case i when 1 then 1 else 0 end) into cred from public.attempt_item_orders o where o.attempt_id = t;
      r := public.svc_adaptativo_siguiente(u, t, ultima, cred);
      exit when (r ->> 'fin')::boolean;
      -- repetir la llamada no asigna otra pregunta (doble clic)
      r2 := public.svc_adaptativo_siguiente(u, t, ultima, cred);
      if r2 ->> 'siguiente' <> r ->> 'siguiente' then raise exception 'FALLO: la repetición asignó otra pregunta'; end if;
      select c.b into b_prev from public.item_calibrations c where c.exercise_id = ultima;
      select c.b into b_act from public.item_calibrations c where c.exercise_id = (r ->> 'siguiente')::uuid;
      if i = 1 and b_act <= b_prev then raise exception 'FALLO: tras acertar, la siguiente debía ser más difícil (% → %)', b_prev, b_act; end if;
      if i = 2 and b_act >= b_prev then raise exception 'FALLO: tras fallar, la siguiente debía ser más fácil (% → %)', b_prev, b_act; end if;
    end loop;
    if (r ->> 'administradas')::int <> 8 then raise exception 'FALLO: debían administrarse 8 (máximo; el objetivo de precisión 0,2 no se alcanza), fueron %', r ->> 'administradas'; end if;
    -- terminado: no se asignan más
    if not (public.svc_adaptativo_siguiente(u, t, ultima, cred) ->> 'fin')::boolean then raise exception 'FALLO: siguió asignando tras el fin'; end if;
  end loop;
  -- permisos: otro estudiante no puede avanzar un intento ajeno; una pregunta ajena al intento se rechaza
  begin perform public.svc_adaptativo_siguiente('de530000-0000-4000-8000-000000000012', current_setting('prueba.t1')::uuid, ultima, '{}'); raise exception 'FALLO: intento ajeno';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_adaptativo_siguiente('de530000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de530000-0000-4000-8000-000000000121', '{}'); raise exception 'FALLO: pregunta ajena';
  exception when insufficient_privilege then null; end;
end $$;

-- 4) entrega: la nota es máximo × dominio (no el número de aciertos); quien acertó todo supera a quien falló todo
do $$ declare t uuid; u uuid; res jsonb; i integer; a1 public.attempts; a2 public.attempts; s1 public.exam_adaptive_state; s2 public.exam_adaptive_state;
begin
  for i in 1..2 loop
    t := current_setting(case i when 1 then 'prueba.t1' else 'prueba.t2' end)::uuid;
    u := case i when 1 then 'de530000-0000-4000-8000-000000000011'::uuid else 'de530000-0000-4000-8000-000000000012'::uuid end;
    select jsonb_agg(jsonb_build_object('exercise_id', o.exercise_id, 'answer', '{"text":"1 m"}'::jsonb, 'status', case i when 1 then 'correct' else 'incorrect' end,
      'credit', case i when 1 then 1 else 0 end, 'code', null, 'messages', '[]'::jsonb)) into res from public.attempt_item_orders o where o.attempt_id = t;
    perform public.svc_record_submission(u, t, res);
  end loop;
  select * into a1 from public.attempts where id = current_setting('prueba.t1')::uuid;
  select * into a2 from public.attempts where id = current_setting('prueba.t2')::uuid;
  select * into s1 from public.exam_adaptive_state where attempt_id = a1.id;
  select * into s2 from public.exam_adaptive_state where attempt_id = a2.id;
  if a1.max_score <> 8 or a2.max_score <> 8 then raise exception 'FALLO: puntuación máxima % / %', a1.max_score, a2.max_score; end if;
  if not (s1.theta > 1 and s2.theta < -1) then raise exception 'FALLO: θ final % / %', s1.theta, s2.theta; end if;
  if not (s1.dominio > 0.6 and s1.dominio < 1 and s2.dominio < 0.4 and s2.dominio > 0) then raise exception 'FALLO: dominio % / %', s1.dominio, s2.dominio; end if;
  if abs(a1.score - round((8 * s1.dominio)::numeric, 2)) > 0.01 then raise exception 'FALLO: nota % ≠ 8 × dominio %', a1.score, s1.dominio; end if;
  if a1.score = 8 then raise exception 'FALLO: la nota no debe ser el número de aciertos'; end if;
  -- una calificación manual posterior se refleja en θ y en la nota
  update public.responses set manual_credit = 0 where attempt_id = a1.id
    and exercise_id = (select exercise_id from public.attempt_item_orders where attempt_id = a1.id order by position desc limit 1);
  perform public.recompute_attempt(a1.id);
  if (select score from public.attempts where id = a1.id) >= a1.score then raise exception 'FALLO: el crédito manual no bajó la nota'; end if;
  -- recalibrar el banco después no cambia la nota del intento (usa su copia)
  update public.item_calibrations set b = b + 2 where exercise_id::text like 'de530000-%';
  select score into a2.score from public.attempts where id = a2.id;
  perform public.recompute_attempt(a2.id);
  if (select score from public.attempts where id = a2.id) <> a2.score then raise exception 'FALLO: una recalibración posterior cambió la nota'; end if;
end $$;
reset role;

-- 5) con intentos, la configuración ya no cambia; el profesor ve θ en el estado
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de530000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de530000-0000-4000-8000-000000000001', true);
do $$ begin
  begin perform public.exam_adaptive_save('de530000-0000-4000-8000-0000000000a1', '{"max_items":10}'); raise exception 'FALLO: cambió con intentos';
  exception when raise_exception then if sqlerrm not like '%Ya hay intentos%' then raise; end if; end;
  if not (public.exam_adaptive_estado(current_setting('prueba.t1')::uuid) ? 'theta') then raise exception 'FALLO: el profesor no ve θ'; end if;
end $$;
reset role;

select 'examen_adaptativo.sql: PRUEBAS PASARON' as resultado;
rollback;
