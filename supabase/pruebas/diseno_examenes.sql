-- Pruebas: diseño experimental y calibración de exámenes (migración 28). Datos sintéticos; se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('db000000-0000-4000-8000-000000000001', 'da@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-diseno","aula_role":"teacher"}', '{}', now(), now()),
  ('db000000-0000-4000-8000-000000000002', 'dz@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-diseno-b","aula_role":"teacher"}', '{}', now(), now()),
  ('db000000-0000-4000-8000-000000000011', 'd1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-dis-1"}', '{}', now(), now()),
  ('db000000-0000-4000-8000-000000000012', 'd2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-dis-2"}', '{}', now(), now()),
  ('db000000-0000-4000-8000-000000000013', 'd3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-dis-3"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'db000000-%';
update public.profiles set role = 'teacher' where id in ('db000000-0000-4000-8000-000000000001', 'db000000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('db000000-0000-4000-8000-000000000021', 'Curso diseño'), ('db000000-0000-4000-8000-000000000022', 'Otro curso');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options, points)
  select ('db000000-0000-4000-8000-0000000000e' || k)::uuid, 'db000000-0000-4000-8000-000000000021', 'dis-e' || k, 'seleccion', 'basico', 'bank', 'choice', 'Pregunta ' || k, '["a","b","c","d"]', k
  from generate_series(1, 6) k;
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options)
  values ('db000000-0000-4000-8000-0000000000f9', 'db000000-0000-4000-8000-000000000022', 'otro-e', 'seleccion', 'basico', 'bank', 'choice', 'Ajena', '["a","b"]');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('db000000-0000-4000-8000-000000000031', 'db000000-0000-4000-8000-000000000021', 'Sección diseño', 'DISENO01', 'db000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('db000000-0000-4000-8000-000000000031', 'db000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.course_staff (course_id, user_id) values ('db000000-0000-4000-8000-000000000021', 'db000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'db000000-0000-4000-8000-000000000031', ('db000000-0000-4000-8000-0000000000' || n)::uuid from unnest(array['11', '12', '13']) n;
-- a1: con diseño (versiones + orden aleatorio) · a2: SIN diseño (control: todo como antes) · a3: contrabalanceado · a4: anclas fijas
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled)
  select ('db000000-0000-4000-8000-0000000000a' || k)::uuid, 'db000000-0000-4000-8000-000000000031', 'Examen ' || k, 'exam', true, 'after_submit', false from generate_series(1, 4) k;
insert into public.activity_items (activity_id, exercise_id, position)
  select ('db000000-0000-4000-8000-0000000000a' || a)::uuid, ('db000000-0000-4000-8000-0000000000e' || k)::uuid, k from generate_series(1, 4) a, generate_series(1, 6) k;

-- 0) instrumentación corregida: empezar un intento NO registra respuestas vacías
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000011', true);
select set_config('prueba.t2', public.start_activity_attempt('db000000-0000-4000-8000-0000000000a2')::text, true);
select public.save_response(current_setting('prueba.t2')::uuid, 'db000000-0000-4000-8000-0000000000e1', '{"selected":[1]}');
do $$
declare v jsonb := public.get_attempt(current_setting('prueba.t2')::uuid);
begin
  -- control sin diseño: las 6 preguntas, en su orden, puntaje máximo completo
  if jsonb_array_length(v -> 'items') <> 6 then raise exception 'FALLO: sin diseño cambió el número de preguntas'; end if;
  if (select string_agg(it -> 'exercise' ->> 'slug', ',') from jsonb_array_elements(v -> 'items') it) <> 'dis-e1,dis-e2,dis-e3,dis-e4,dis-e5,dis-e6' then raise exception 'FALLO: sin diseño cambió el orden'; end if;
  if (v -> 'attempt' ->> 'max_score')::numeric <> 21 then raise exception 'FALLO: sin diseño cambió el puntaje máximo'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.exam_item_events where attempt_id = current_setting('prueba.t2')::uuid) <> 1 then raise exception 'FALLO: la instrumentación registró respuestas vacías al empezar'; end if;
  if exists (select 1 from public.attempt_item_orders where attempt_id = current_setting('prueba.t2')::uuid) then raise exception 'FALLO: asignó orden sin diseño'; end if;
end $$;

-- 1) el profesor guarda diseños (con validaciones)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000001', true);
do $$ begin
  begin perform public.design_save('db000000-0000-4000-8000-0000000000a1', 'aleatorio', true, 60,
      '[{"exercise_id":"db000000-0000-4000-8000-0000000000e3","rol":"isomorfa","grupo":"G1"}]');
    raise exception 'FALLO: aceptó un grupo isomorfo de una sola variante';
  exception when invalid_parameter_value then null; end;
  begin perform public.design_save('db000000-0000-4000-8000-0000000000a1', 'aleatorio', false, 60, '[{"exercise_id":"db000000-0000-4000-8000-0000000000f9"}]');
    raise exception 'FALLO: aceptó una pregunta ajena a la actividad';
  exception when invalid_parameter_value then null; end;
  begin perform public.design_save('db000000-0000-4000-8000-0000000000a1', 'caotico', false, null, '[]'); raise exception 'FALLO: orden no válido';
  exception when invalid_parameter_value then null; end;
  perform public.design_save('db000000-0000-4000-8000-0000000000a1', 'aleatorio', true, 60, '[
    {"exercise_id":"db000000-0000-4000-8000-0000000000e1","rol":"ancla"},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e2","rol":"ancla"},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e3","rol":"isomorfa","grupo":"G1"},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e4","rol":"isomorfa","grupo":"G1"},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e5","rol":"isomorfa","grupo":"G2"},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e6","rol":"isomorfa","grupo":"G2"}]');
  perform public.design_save('db000000-0000-4000-8000-0000000000a3', 'contrabalanceado', false, null, '[
    {"exercise_id":"db000000-0000-4000-8000-0000000000e1","bloque":0},{"exercise_id":"db000000-0000-4000-8000-0000000000e2","bloque":0},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e3","bloque":0},{"exercise_id":"db000000-0000-4000-8000-0000000000e4","bloque":1},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e5","bloque":1},{"exercise_id":"db000000-0000-4000-8000-0000000000e6","bloque":1}]');
  perform public.design_save('db000000-0000-4000-8000-0000000000a4', 'anclas_fijas', false, null, '[
    {"exercise_id":"db000000-0000-4000-8000-0000000000e1","rol":"ancla"},{"exercise_id":"db000000-0000-4000-8000-0000000000e6","rol":"ancla"}]');
  if (public.design_get('db000000-0000-4000-8000-0000000000a1') -> 'diseno' ->> 'orden') <> 'aleatorio' then raise exception 'FALLO: design_get'; end if;
end $$;
-- un profesor ajeno no puede
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.design_get('db000000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: un profesor ajeno vio el diseño'; exception when insufficient_privilege then null; end;
  begin perform public.calibration_bank('db000000-0000-4000-8000-000000000021'); raise exception 'FALLO: un profesor ajeno vio la calibración'; exception when insufficient_privilege then null; end;
end $$;

-- 2) los estudiantes empiezan el examen con diseño: 4 preguntas cada uno (2 anclas + 1 variante por grupo), variantes equilibradas
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000011', true);
select set_config('prueba.t11', public.start_activity_attempt('db000000-0000-4000-8000-0000000000a1')::text, true);
select set_config('prueba.c11', public.start_activity_attempt('db000000-0000-4000-8000-0000000000a3')::text, true);
select set_config('prueba.f11', public.start_activity_attempt('db000000-0000-4000-8000-0000000000a4')::text, true);
do $$
declare v jsonb := public.get_attempt(current_setting('prueba.t11')::uuid); slugs text[];
begin
  select array_agg(it -> 'exercise' ->> 'slug') into slugs from jsonb_array_elements(v -> 'items') it;
  if cardinality(slugs) <> 4 or not ('dis-e1' = any(slugs) and 'dis-e2' = any(slugs)) then raise exception 'FALLO: asignación (%)', slugs; end if;
  if ('dis-e3' = any(slugs)) = ('dis-e4' = any(slugs)) or ('dis-e5' = any(slugs)) = ('dis-e6' = any(slugs)) then raise exception 'FALLO: no recibió exactamente una variante por grupo (%)', slugs; end if;
  -- puntaje máximo = solo sus preguntas
  if (v -> 'attempt' ->> 'max_score')::numeric <> (select sum(substr(s, 6)::int) from unnest(slugs) s) then raise exception 'FALLO: puntaje máximo con versiones'; end if;
  -- no puede responder una variante que no le tocó
  begin
    perform public.save_response(current_setting('prueba.t11')::uuid,
      case when 'dis-e3' = any(slugs) then 'db000000-0000-4000-8000-0000000000e4'::uuid else 'db000000-0000-4000-8000-0000000000e3'::uuid end, '{"selected":[0]}');
    raise exception 'FALLO: respondió una variante que no le tocó';
  exception when insufficient_privilege then null; end;
  perform set_config('prueba.slugs11', array_to_string(slugs, ','), true);
end $$;
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000012', true);
select set_config('prueba.t12', public.start_activity_attempt('db000000-0000-4000-8000-0000000000a1')::text, true);
select set_config('prueba.c12', public.start_activity_attempt('db000000-0000-4000-8000-0000000000a3')::text, true);
select set_config('prueba.f12', public.start_activity_attempt('db000000-0000-4000-8000-0000000000a4')::text, true);
do $$
declare s1 text[] := string_to_array(current_setting('prueba.slugs11'), ','); s2 text[]; o1 text; o2 text;
begin
  select array_agg(it -> 'exercise' ->> 'slug') into s2 from jsonb_array_elements(public.get_attempt(current_setting('prueba.t12')::uuid) -> 'items') it;
  -- el segundo estudiante recibe las OTRAS variantes (rotación equilibrada)
  if ('dis-e3' = any(s1)) = ('dis-e3' = any(s2)) or ('dis-e5' = any(s1)) = ('dis-e5' = any(s2)) then raise exception 'FALLO: variantes no equilibradas (% / %)', s1, s2; end if;
  -- contrabalanceado: el segundo estudiante empieza por el otro bloque
  select string_agg(it -> 'exercise' ->> 'slug', ',') into o2 from jsonb_array_elements(public.get_attempt(current_setting('prueba.c12')::uuid) -> 'items') it;
  if o2 <> 'dis-e4,dis-e5,dis-e6,dis-e1,dis-e2,dis-e3' then raise exception 'FALLO: contrabalanceo (%)', o2; end if;
  -- anclas fijas: la primera y la última no se mueven
  select string_agg(it -> 'exercise' ->> 'slug', ',') into o1 from jsonb_array_elements(public.get_attempt(current_setting('prueba.f12')::uuid) -> 'items') it;
  if o1 not like 'dis-e1,%,dis-e6' then raise exception 'FALLO: anclas fijas (%)', o1; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000011', true);
do $$
declare o text;
begin
  select string_agg(it -> 'exercise' ->> 'slug', ',') into o from jsonb_array_elements(public.get_attempt(current_setting('prueba.c11')::uuid) -> 'items') it;
  if o <> 'dis-e1,dis-e2,dis-e3,dis-e4,dis-e5,dis-e6' then raise exception 'FALLO: contrabalanceo del primer estudiante (%)', o; end if;
end $$;

-- 3) con intentos ya iniciados no se puede cambiar el orden ni las versiones (sí los papeles)
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000001', true);
do $$ begin
  begin perform public.design_save('db000000-0000-4000-8000-0000000000a1', 'fijo', true, 60, '[]'); raise exception 'FALLO: cambió el orden con intentos';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.design_save('db000000-0000-4000-8000-0000000000a1', 'aleatorio', true, 90, '[
    {"exercise_id":"db000000-0000-4000-8000-0000000000e1","rol":"ancla"},{"exercise_id":"db000000-0000-4000-8000-0000000000e2","rol":"conceptual"},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e3","rol":"isomorfa","grupo":"G1"},{"exercise_id":"db000000-0000-4000-8000-0000000000e4","rol":"isomorfa","grupo":"G1"},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e5","rol":"isomorfa","grupo":"G2"},{"exercise_id":"db000000-0000-4000-8000-0000000000e6","rol":"isomorfa","grupo":"G2"}]');
end $$;

-- 4) calibración: el estado lo decide el servidor; solo preguntas de la asignatura; estudiantes no
do $$
declare b jsonb;
begin
  perform public.calibration_save('db000000-0000-4000-8000-000000000021', '[
    {"exercise_id":"db000000-0000-4000-8000-0000000000e1","a":1.2,"b":-0.5,"se_a":0.2,"se_b":0.15,"beta_t":4.1,"sigma_t":0.4,"n_resp":150,"n_tiempos":120},
    {"exercise_id":"db000000-0000-4000-8000-0000000000e2","a":0.9,"b":0.3,"se_a":0.6,"se_b":0.9,"beta_t":null,"sigma_t":null,"n_resp":10}]');
  b := public.calibration_bank('db000000-0000-4000-8000-000000000021');
  if (select x -> 'calibracion' ->> 'estado' from jsonb_array_elements(b) x where x ->> 'exercise_id' = 'db000000-0000-4000-8000-0000000000e1') <> 'calibrado'
     or (select x -> 'calibracion' ->> 'estado' from jsonb_array_elements(b) x where x ->> 'exercise_id' = 'db000000-0000-4000-8000-0000000000e2') <> 'no_calibrado' then
    raise exception 'FALLO: estados de calibración';
  end if;
  begin perform public.calibration_save('db000000-0000-4000-8000-000000000021', '[{"exercise_id":"db000000-0000-4000-8000-0000000000f9","a":1,"b":0,"se_a":0.1,"se_b":0.1,"n_resp":200}]');
    raise exception 'FALLO: calibró una pregunta ajena';
  exception when invalid_parameter_value then null; end;
  if (public.design_get('db000000-0000-4000-8000-0000000000a1') -> 'items' -> 0 -> 'calibracion' ->> 'estado') <> 'calibrado' then raise exception 'FALLO: calibración en el diseño'; end if;
  if public.calibration_data('db000000-0000-4000-8000-000000000021')::text like '%sint-dis%' then raise exception 'FALLO: datos de calibración con identificadores'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000013', true);
do $$ begin
  begin perform public.calibration_data('db000000-0000-4000-8000-000000000021'); raise exception 'FALLO: un estudiante leyó datos de calibración'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.attempt_item_orders; raise exception 'FALLO: un estudiante leyó las asignaciones'; exception when insufficient_privilege then null; end;
end $$;

-- 5) el servidor de entrega y el análisis LIEIA ven solo las preguntas asignadas, con su papel y orden
reset role;
do $$
declare c jsonb; d jsonb;
begin
  c := public.svc_submit_context('db000000-0000-4000-8000-000000000011', current_setting('prueba.t11')::uuid);
  if jsonb_array_length(c -> 'items') <> 4 then raise exception 'FALLO: contexto de entrega con versiones'; end if;
  c := public.svc_submit_context('db000000-0000-4000-8000-000000000011', current_setting('prueba.t2')::uuid);
  if jsonb_array_length(c -> 'items') <> 6 then raise exception 'FALLO: contexto de entrega sin diseño'; end if;
  update public.attempts set status = 'submitted', submitted_at = now() where id in (current_setting('prueba.t11')::uuid, current_setting('prueba.t12')::uuid);
  perform set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000001', true);
end $$;
set local role authenticated;
do $$
declare d jsonb := public.lieia_exam_data('db000000-0000-4000-8000-0000000000a1');
begin
  if (d -> 'diseno' ->> 'versiones')::boolean is not true then raise exception 'FALLO: diseño en lieia_exam_data'; end if;
  if (select count(*) from jsonb_array_elements(d -> 'items') x where x ->> 'grupo' = 'G1') <> 2 then raise exception 'FALLO: grupos en lieia_exam_data'; end if;
  if jsonb_array_length(d -> 'estudiantes' -> 0 -> 'orden') <> 4 then raise exception 'FALLO: orden asignado en lieia_exam_data'; end if;
end $$;
reset role;
select 'PRUEBAS DE DISEÑO DE EXÁMENES PASARON' as resultado;
rollback;
