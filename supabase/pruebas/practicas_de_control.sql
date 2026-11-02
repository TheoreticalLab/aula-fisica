-- Pruebas: Prácticas de Control + VTA (migración 62). Se deshace al final.
-- Escenario: práctica «Energía» con política anunciada (w = 20 %, 7 min). S1 presente (90 en la práctica, 50 en el
-- control → 81, el ejemplo de la especificación); S2 ausente; S3 sin entregar; S5 presente con tiempo adicional y
-- respuesta abierta pendiente de corrección; S6 entregó ANTES del anuncio (sin retroactividad); S4 es de otra sección.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de620000-0000-4000-8000-000000000001', 'pc1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-control","aula_role":"teacher"}', '{}', now(), now()),
  ('de620000-0000-4000-8000-000000000002', 'pc2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-control-otra","aula_role":"teacher"}', '{}', now(), now()),
  ('de620000-0000-4000-8000-000000000011', 'pc11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ctrl-1"}', '{}', now(), now()),
  ('de620000-0000-4000-8000-000000000012', 'pc12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ctrl-2"}', '{}', now(), now()),
  ('de620000-0000-4000-8000-000000000013', 'pc13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ctrl-3"}', '{}', now(), now()),
  ('de620000-0000-4000-8000-000000000014', 'pc14@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ctrl-4"}', '{}', now(), now()),
  ('de620000-0000-4000-8000-000000000015', 'pc15@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ctrl-5"}', '{}', now(), now()),
  ('de620000-0000-4000-8000-000000000016', 'pc16@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ctrl-6"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de620000-%';
update public.profiles set role = 'teacher' where id in ('de620000-0000-4000-8000-000000000001', 'de620000-0000-4000-8000-000000000002');
update public.profiles set full_name = 'Estudiante ' || right(id::text, 2) where id::text like 'de620000-%';
insert into public.courses (id, title) values ('de620000-0000-4000-8000-000000000021', 'Curso control');
insert into public.concepts (course_id, slug, name) values ('de620000-0000-4000-8000-000000000021', 'energia', 'Energía'), ('de620000-0000-4000-8000-000000000021', 'cinematica', 'Cinemática');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points, concepts, published) values
  ('de620000-0000-4000-8000-0000000000e1', 'de620000-0000-4000-8000-000000000021', 'pc-original', 'numerica', 'intermedio', 'practice', 'numeric', 'Energía original', 1, '{energia}', true),
  ('de620000-0000-4000-8000-0000000000b1', 'de620000-0000-4000-8000-000000000021', 'pc-banco-num', 'numerica', 'basico', 'bank', 'numeric', 'Energía en otro contexto', 1, '{energia}', true),
  ('de620000-0000-4000-8000-0000000000b2', 'de620000-0000-4000-8000-000000000021', 'pc-banco-vf', 'vf_justificacion', 'intermedio', 'bank', 'truefalse', '¿Se conserva la energía mecánica sin rozamiento?', 1, '{energia}', true),
  ('de620000-0000-4000-8000-0000000000b3', 'de620000-0000-4000-8000-000000000021', 'pc-abierta', 'conceptual', 'intermedio', 'bank', 'open', 'Justifique la conservación', 1, '{energia}', true),
  ('de620000-0000-4000-8000-0000000000b4', 'de620000-0000-4000-8000-000000000021', 'pc-larga', 'numerica', 'desafiante', 'bank', 'numeric', 'Problema largo', 1, '{energia}', true),
  ('de620000-0000-4000-8000-0000000000b5', 'de620000-0000-4000-8000-000000000021', 'pc-oculta', 'numerica', 'basico', 'bank', 'numeric', 'No publicada', 1, '{energia}', false),
  ('de620000-0000-4000-8000-0000000000b6', 'de620000-0000-4000-8000-000000000021', 'pc-otra', 'numerica', 'basico', 'bank', 'numeric', 'Cinemática', 1, '{cinematica}', true);
insert into public.exercise_keys (exercise_id, answer, explanation) values
  ('de620000-0000-4000-8000-0000000000e1', '{"format":"numeric","value":"12 J"}', 's'), ('de620000-0000-4000-8000-0000000000b1', '{"format":"numeric","value":"5 J"}', 's'),
  ('de620000-0000-4000-8000-0000000000b2', '{"format":"truefalse","value":true,"modelJustification":"Solo actúan fuerzas conservativas."}', 's'), ('de620000-0000-4000-8000-0000000000b3', '{"format":"open","rubric":"ley"}', 's'),
  ('de620000-0000-4000-8000-0000000000b4', '{"format":"numeric","value":"9 J"}', 's'), ('de620000-0000-4000-8000-0000000000b5', '{"format":"numeric","value":"1 J"}', 's'),
  ('de620000-0000-4000-8000-0000000000b6', '{"format":"numeric","value":"3 m"}', 's');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de620000-0000-4000-8000-000000000031', 'de620000-0000-4000-8000-000000000021', 'Sección A', 'CTRLAA01', 'de620000-0000-4000-8000-000000000001'),
  ('de620000-0000-4000-8000-000000000032', 'de620000-0000-4000-8000-000000000021', 'Sección B', 'CTRLBB01', 'de620000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values ('de620000-0000-4000-8000-000000000031', 'de620000-0000-4000-8000-000000000001'),
  ('de620000-0000-4000-8000-000000000032', 'de620000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de620000-0000-4000-8000-000000000031', 'de620000-0000-4000-8000-000000000011'), ('de620000-0000-4000-8000-000000000031', 'de620000-0000-4000-8000-000000000012'),
  ('de620000-0000-4000-8000-000000000031', 'de620000-0000-4000-8000-000000000013'), ('de620000-0000-4000-8000-000000000031', 'de620000-0000-4000-8000-000000000015'),
  ('de620000-0000-4000-8000-000000000031', 'de620000-0000-4000-8000-000000000016'), ('de620000-0000-4000-8000-000000000032', 'de620000-0000-4000-8000-000000000014');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000031', 'Energía', 'practice', true, 'after_submit', false, 2);
insert into public.activity_items (activity_id, exercise_id, position) values ('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-0000000000e1', 1);
insert into public.activity_grade_links (activity_id, class_id, category, points) values ('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000031', 'practica', 30);
-- S6 entregó AYER, antes de que se anunciara la política
insert into public.attempts (id, user_id, course_id, activity_id, mode, status, score, max_score, started_at, submitted_at) values
  ('de620000-0000-4000-8000-0000000000f6', 'de620000-0000-4000-8000-000000000016', 'de620000-0000-4000-8000-000000000021', 'de620000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 0.9, 1, now() - interval '1 day', now() - interval '1 day');

-- 1) el profesor anuncia la política (w = 20 %, 7 min); un estudiante no puede
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.control_politica_guardar('de620000-0000-4000-8000-0000000000a1', 0.2, 7, 'x', 'y'); raise exception 'FALLO: un estudiante anunció una política';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.control_politica_guardar('de620000-0000-4000-8000-0000000000a1', 0.5, 7, '', ''); raise exception 'FALLO: w = 50 %% aceptado';
  exception when invalid_parameter_value then null; end;
  begin perform public.control_politica_guardar('de620000-0000-4000-8000-0000000000a1', 0.2, 12, '', ''); raise exception 'FALLO: 12 min aceptados';
  exception when invalid_parameter_value then null; end;
  r := public.control_politica_guardar('de620000-0000-4000-8000-0000000000a1', 0.2, 7, 'Se aplica a quien entregue después de este aviso.', 'Puede usar libros y apuntes.');
  if (r ->> 'version')::int <> 1 or (r ->> 'entregas_previas')::int <> 1 then raise exception 'FALLO: política %', r; end if;
  -- catálogo: una abierta sin rúbrica no se aprueba; con rúbrica sí; más de 10 minutos, imposible
  begin perform public.control_item_guardar('{"exercise_id":"de620000-0000-4000-8000-0000000000b3","origen_exercise_id":"de620000-0000-4000-8000-0000000000e1","tipo":"conceptual","competencia":"energia","minutos":4,"justificacion":"Misma ley, otra situación física.","estado":"aprobado"}');
    raise exception 'FALLO: abierta sin rúbrica aprobada'; exception when raise_exception then null; end;
  begin perform public.control_item_guardar('{"exercise_id":"de620000-0000-4000-8000-0000000000b5","origen_exercise_id":"de620000-0000-4000-8000-0000000000e1","tipo":"contextual","competencia":"energia","minutos":4,"justificacion":"Misma ley, otra situación física.","estado":"aprobado"}');
    raise exception 'FALLO: ejercicio no publicado aprobado'; exception when raise_exception then null; end;
  begin perform public.control_item_guardar('{"exercise_id":"de620000-0000-4000-8000-0000000000b1","origen_exercise_id":"de620000-0000-4000-8000-0000000000e1","tipo":"contextual","competencia":"energia","minutos":12,"justificacion":"Misma ley, otra situación física.","estado":"aprobado"}');
    raise exception 'FALLO: 12 minutos aceptados'; exception when check_violation then null; end;
  perform public.control_item_guardar('{"exercise_id":"de620000-0000-4000-8000-0000000000b3","origen_exercise_id":"de620000-0000-4000-8000-0000000000e1","tipo":"conceptual","competencia":"energia","minutos":4,"justificacion":"Misma ley, otra situación física.","hipotesis":"Sin rozamiento","rubrica":[{"criterio":"Principio","peso":40},{"criterio":"Justificación","peso":60}],"estado":"aprobado"}');
  r := public.control_catalogo('de620000-0000-4000-8000-0000000000a1');
  if jsonb_array_length(r -> 'catalogo') <> 1 or exists (select 1 from jsonb_array_elements(r -> 'sugerencias') x where x ->> 'exercise_id' in ('de620000-0000-4000-8000-0000000000e1', 'de620000-0000-4000-8000-0000000000b5', 'de620000-0000-4000-8000-0000000000b6')) then
    raise exception 'FALLO: catálogo/sugerencias %', r; end if;
end $$;
reset role;

-- los estudiantes entregan la práctica DESPUÉS del anuncio (S1 con 90 %)
insert into public.attempts (id, user_id, course_id, activity_id, mode, status, score, max_score, submitted_at) values
  ('de620000-0000-4000-8000-0000000000f1', 'de620000-0000-4000-8000-000000000011', 'de620000-0000-4000-8000-000000000021', 'de620000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 0.9, 1, now() + interval '1 second'),
  ('de620000-0000-4000-8000-0000000000f2', 'de620000-0000-4000-8000-000000000012', 'de620000-0000-4000-8000-000000000021', 'de620000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 0.8, 1, now() + interval '1 second'),
  ('de620000-0000-4000-8000-0000000000f5', 'de620000-0000-4000-8000-000000000015', 'de620000-0000-4000-8000-000000000021', 'de620000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 1, 1, now() + interval '1 second');
insert into public.responses (attempt_id, exercise_id, user_id, points, auto_credit, status) values
  ('de620000-0000-4000-8000-0000000000f1', 'de620000-0000-4000-8000-0000000000e1', 'de620000-0000-4000-8000-000000000011', 1, 0.9, 'partial');
-- asistencia: S1, S5 y S6 presentes; S2 no
insert into public.attendance_sessions (id, class_id, code, opened_by, code_expires_at) values
  ('de620000-0000-4000-8000-0000000000c1', 'de620000-0000-4000-8000-000000000031', '123456', 'de620000-0000-4000-8000-000000000001', now() + interval '1 hour');
insert into public.attendance_records (session_id, user_id, method) values
  ('de620000-0000-4000-8000-0000000000c1', 'de620000-0000-4000-8000-000000000011', 'codigo'), ('de620000-0000-4000-8000-0000000000c1', 'de620000-0000-4000-8000-000000000015', 'codigo'),
  ('de620000-0000-4000-8000-0000000000c1', 'de620000-0000-4000-8000-000000000016', 'profesor');

-- 2) preparar (idempotente), revisar, tiempo adicional e iniciar
set local role authenticated;
do $$ declare r jsonb; r2 jsonb; s uuid; begin
  r := public.control_preparar('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-0000000000c1', 7, 'c6200000-0000-4000-8000-000000000001');
  s := (r -> 'session' ->> 'id')::uuid;
  perform set_config('prueba.s', s::text, true);
  perform set_config('prueba.ctrl', r -> 'session' ->> 'control_activity_id', true);
  r2 := public.control_preparar('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-0000000000c1', 7, 'c6200000-0000-4000-8000-000000000001');
  if (r2 -> 'session' ->> 'id')::uuid <> s then raise exception 'FALLO: preparar no es idempotente'; end if;
  begin perform public.control_preparar('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-0000000000c1', 7, 'c6200000-0000-4000-8000-000000000002');
    raise exception 'FALLO: activación duplicada'; exception when raise_exception then null; end;
  -- elegibilidad y selección (vista previa del profesor): S3 sin entrega; nadie recibe el ejercicio original,
  -- uno no publicado, uno de otra competencia ni uno de 9 minutos
  if not exists (select 1 from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'user_id' = 'de620000-0000-4000-8000-000000000013' and x ->> 'estado' = 'sin_entrega') then raise exception 'FALLO: S3'; end if;
  if exists (select 1 from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'estado_elegibilidad' = 'elegible'
             and (x ->> 'exercise_id' is null or x ->> 'exercise_id' in ('de620000-0000-4000-8000-0000000000e1', 'de620000-0000-4000-8000-0000000000b4', 'de620000-0000-4000-8000-0000000000b5', 'de620000-0000-4000-8000-0000000000b6'))) then
    raise exception 'FALLO: selección inválida %', r -> 'estudiantes'; end if;
  if exists (select 1 from jsonb_array_elements(r -> 'estudiantes') x where (x ->> 'minutos')::numeric > 7) then raise exception 'FALLO: no cabe en 7 min'; end if;
  if (select count(*) from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'estado_elegibilidad' = 'elegible') <> 4 then raise exception 'FALLO: elegibles'; end if;
  -- reproducible: la selección guarda sus componentes y la semilla
  if exists (select 1 from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'estado_elegibilidad' = 'elegible'
             and (x -> 'seleccion' ->> 'semilla' is null or x -> 'seleccion' ->> 'puntaje' is null or x -> 'seleccion' ->> 'version' <> 'vta-sel-1')) then raise exception 'FALLO: selección no documentada'; end if;
  -- a S5 se le asigna la abierta (sustitución docente) y tiempo adicional justificado
  perform public.control_sustituir(s, 'de620000-0000-4000-8000-000000000015', 'de620000-0000-4000-8000-0000000000b3');
  begin perform public.control_sustituir(s, 'de620000-0000-4000-8000-000000000015', 'de620000-0000-4000-8000-0000000000e1'); raise exception 'FALLO: sustituir por el original';
  exception when raise_exception then null; end;
  begin perform public.control_tiempo_extra(s, 'de620000-0000-4000-8000-000000000015', 3, ''); raise exception 'FALLO: tiempo extra sin motivo';
  exception when invalid_parameter_value then null; end;
  perform public.control_tiempo_extra(s, 'de620000-0000-4000-8000-000000000015', 3, 'Adaptación acreditada');
  -- la asistencia no inicia el control: el estudiante no ve nada hasta que el profesor lo activa
  if public.my_control_pendiente() is not null then raise exception 'FALLO: pendiente antes de iniciar'; end if;
  r := public.control_iniciar(s);
  r := public.control_iniciar(s);   -- doble clic
  if not exists (select 1 from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'user_id' = 'de620000-0000-4000-8000-000000000012' and x ->> 'estado' = 'ausente') then raise exception 'FALLO: ausente'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.control_audit where session_id = current_setting('prueba.s')::uuid and accion = 'iniciar') <> 1 then raise exception 'FALLO: inicio duplicado'; end if;
end $$;
set local role authenticated;

-- 3) otro profesor (otra sección) no ve ni maneja esta sesión
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.control_live(current_setting('prueba.s')::uuid); raise exception 'FALLO: otra sección ve la sesión';
  exception when insufficient_privilege then null; end;
  begin perform public.control_confirmar(current_setting('prueba.s')::uuid); raise exception 'FALLO: otra sección confirma';
  exception when insufficient_privilege then null; end;
end $$;

-- 4) estudiantes: S1 recibe SU problema (uno solo); S3 y S4 no pueden; nadie ve claves ni se cambia la nota
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000011', true);
do $$ declare p jsonb; t uuid; begin
  p := public.my_control_pendiente();
  if p is null or (p ->> 'activity_id')::uuid <> current_setting('prueba.ctrl')::uuid then raise exception 'FALLO: aviso al estudiante %', p; end if;
  t := public.start_activity_attempt(current_setting('prueba.ctrl')::uuid);
  perform set_config('prueba.t1', t::text, true);
  if t <> public.start_activity_attempt(current_setting('prueba.ctrl')::uuid) then raise exception 'FALLO: reconexión crea otro intento'; end if;
  perform public.exam_open(t);
  begin perform public.control_live(current_setting('prueba.s')::uuid); raise exception 'FALLO: el estudiante ve la vista docente';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.exercise_keys) then raise exception 'FALLO: el estudiante lee claves'; end if;
  begin perform 1 from public.control_items; raise exception 'FALLO: catálogo legible'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.control_assignments; raise exception 'FALLO: asignaciones legibles'; exception when insufficient_privilege then null; end;
  begin update public.attempts set score = 1, max_score = 1 where id = t; raise exception 'FALLO: el estudiante escribió su nota';
  exception when insufficient_privilege then null; end;
  begin update public.responses set auto_credit = 1, manual_credit = 1 where attempt_id = t;
    if found then raise exception 'FALLO: el estudiante cambió su crédito'; end if;
  exception when insufficient_privilege then null; end;
  begin perform public.control_confirmar(current_setting('prueba.s')::uuid); raise exception 'FALLO: el estudiante confirma';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000013', true);
do $$ begin
  if public.activity_visible_to_me(current_setting('prueba.ctrl')::uuid) then raise exception 'FALLO: S3 ve el control'; end if;
  begin perform public.start_activity_attempt(current_setting('prueba.ctrl')::uuid); raise exception 'FALLO: S3 empezó';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000014","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000014', true);
do $$ begin
  if public.activity_visible_to_me(current_setting('prueba.ctrl')::uuid) or public.my_control_pendiente() is not null then raise exception 'FALLO: S4 (otra sección)'; end if;
end $$;
-- S5 (tiempo adicional) y S6 empiezan
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000015","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000015', true);
select set_config('prueba.t5', public.start_activity_attempt(current_setting('prueba.ctrl')::uuid)::text, true);
select public.exam_open(current_setting('prueba.t5')::uuid) is not null;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000016","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000016', true);
select set_config('prueba.t6', public.start_activity_attempt(current_setting('prueba.ctrl')::uuid)::text, true);
reset role;

do $$ begin
  if (select extra_s from public.exam_sessions where attempt_id = current_setting('prueba.t5')::uuid) <> 180 then raise exception 'FALLO: tiempo adicional no aplicado'; end if;
  if (select exercise_id from public.attempt_item_orders where attempt_id = current_setting('prueba.t1')::uuid) <> (select exercise_id from public.control_assignments where session_id = current_setting('prueba.s')::uuid and user_id = 'de620000-0000-4000-8000-000000000011') then
    raise exception 'FALLO: no es su problema'; end if;
  if (select count(*) from public.responses where attempt_id = current_setting('prueba.t1')::uuid) <> 1 then raise exception 'FALLO: respuestas del intento'; end if;
  if (select count(*) from public.attempt_item_orders where attempt_id = current_setting('prueba.t1')::uuid) <> 1 then raise exception 'FALLO: más de un problema'; end if;
  if (select score from public.attempts where id = current_setting('prueba.t1')::uuid) = 1 then raise exception 'FALLO: el estudiante cambió su nota'; end if;
  -- el reloj oficial: límite = inicio + 7 min (+3 para S5), dentro de la ventana de la actividad
  if public.exam_deadline(current_setting('prueba.t5')::uuid) - public.exam_deadline(current_setting('prueba.t1')::uuid) < interval '2 minutes' then raise exception 'FALLO: límite con adaptación'; end if;
end $$;

-- 5) entregas (lo que haría la Edge Function): S1 obtiene 50 %; S5 abierta pendiente; S6 100 %
update public.responses set auto_credit = 0.5, status = 'partial', answer = '{"text":"x"}' where attempt_id = current_setting('prueba.t1')::uuid;
update public.responses set auto_credit = 0, status = 'pending_review', answer = '{"text":"Se conserva porque..."}' where attempt_id = current_setting('prueba.t5')::uuid;
update public.responses set auto_credit = 1, status = 'correct', answer = '{"text":"y"}' where attempt_id = current_setting('prueba.t6')::uuid;
update public.attempts set status = 'submitted', submitted_at = now() where id in (current_setting('prueba.t1')::uuid, current_setting('prueba.t5')::uuid, current_setting('prueba.t6')::uuid);
select public.recompute_attempt(x) from unnest(array[current_setting('prueba.t1')::uuid, current_setting('prueba.t5')::uuid, current_setting('prueba.t6')::uuid]) x;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000001', true);
do $$ declare s uuid := current_setting('prueba.s')::uuid; r jsonb; begin
  -- antes de confirmar no hay ajuste (nunca se reduce con la corrección pendiente)
  if public.control_ajustes('de620000-0000-4000-8000-0000000000a1') @> '[{"factor": 0.9}]' then raise exception 'FALLO: ajuste antes de confirmar'; end if;
  begin perform public.control_confirmar(s); raise exception 'FALLO: confirmar sin cerrar'; exception when raise_exception then null; end;
  r := public.control_cerrar(s);
  r := public.control_confirmar(s);
  if (r ->> 'confirmados')::int <> 2 then raise exception 'FALLO: confirmados % (S1 y S6; S5 pendiente)', r ->> 'confirmados'; end if;
  r := public.control_confirmar(s);   -- repetir no cambia nada
  if (r ->> 'confirmados')::int <> 0 then raise exception 'FALLO: confirmación repetida'; end if;
  if not exists (select 1 from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'user_id' = 'de620000-0000-4000-8000-000000000015' and x ->> 'estado' = 'correccion_pendiente') then
    raise exception 'FALLO: estado de S5'; end if;
end $$;
reset role;

-- 6) nota: S1 = 90 × [1 − 0,20 × (1 − 0,50)] = 81; S6 conserva 90 (entregó antes del aviso); S5 sin ajuste (pendiente)
do $$ begin
  if public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000011') <> 0.9 then raise exception 'FALLO: factor S1 %', public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000011'); end if;
  if (select score from public.official_scores('de620000-0000-4000-8000-000000000031') where user_id = 'de620000-0000-4000-8000-000000000011' and category = 'practica') <> 24.3 then
    raise exception 'FALLO: registro S1 % (esperado 30 × 0,81 = 24,3)', (select score from public.official_scores('de620000-0000-4000-8000-000000000031') where user_id = 'de620000-0000-4000-8000-000000000011' and category = 'practica'); end if;
  if (select score from public.attempts where id = 'de620000-0000-4000-8000-0000000000f1') <> 0.9 then raise exception 'FALLO: la nota original cambió'; end if;
  if public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000016') <> 1 then raise exception 'FALLO: retroactivo con S6'; end if;
  if public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000015') <> 1 then raise exception 'FALLO: ajuste con corrección pendiente'; end if;
  if public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000012') <> 1 then raise exception 'FALLO: ausencia penalizada'; end if;
  if public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000013') <> 1 then raise exception 'FALLO: sin entrega penalizado de nuevo'; end if;
end $$;

-- 6b) revisión docente de la respuesta abierta de S5 con la rúbrica: entonces sí se confirma y se ajusta
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000015","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000015', true);
do $$ begin
  begin perform public.control_revision(current_setting('prueba.s')::uuid, 'de620000-0000-4000-8000-000000000015'); raise exception 'FALLO: el estudiante ve la solución';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.control_revision(current_setting('prueba.s')::uuid, 'de620000-0000-4000-8000-000000000015');
  if r -> 'clave' ->> 'format' <> 'open' or jsonb_array_length(r -> 'ficha' -> 'rubrica') <> 2 or r -> 'respuesta' ->> 'status' <> 'pending_review' then raise exception 'FALLO: revisión %', r; end if;
  perform public.grade_response((r -> 'respuesta' ->> 'id')::uuid, 0.6, 'Principio correcto; justificación incompleta.');
  r := public.control_confirmar(current_setting('prueba.s')::uuid, array['de620000-0000-4000-8000-000000000015'::uuid]);
  if (r ->> 'confirmados')::int <> 1 then raise exception 'FALLO: confirmar S5 tras revisar'; end if;
end $$;
reset role;
do $$ begin
  if public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000015') <> 0.92 then
    raise exception 'FALLO: factor S5 % (esperado 1 − 0,2·0,4)', public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000015'); end if;
  if not exists (select 1 from public.response_events ev join public.responses r on r.id = ev.response_id
                 where ev.kind = 'manual_grade' and r.attempt_id = current_setting('prueba.t5')::uuid) then raise exception 'FALLO: traza de la revisión'; end if;
end $$;

-- 7) recuperación: un segundo control peor (30 %) NO encadena descuentos; cuenta el mejor (50 %)
set local role authenticated;
do $$ declare r jsonb; s2 uuid; t uuid; begin
  r := public.control_preparar('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-0000000000c1', 5, 'c6200000-0000-4000-8000-000000000003', true);
  s2 := (r -> 'session' ->> 'id')::uuid;
  perform set_config('prueba.s2', s2::text, true);
  perform set_config('prueba.ctrl2', r -> 'session' ->> 'control_activity_id', true);
  r := public.control_iniciar(s2);
end $$;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000011', true);
select set_config('prueba.t1b', public.start_activity_attempt(current_setting('prueba.ctrl2')::uuid)::text, true);
reset role;
update public.responses set auto_credit = 0.3, status = 'partial' where attempt_id = current_setting('prueba.t1b')::uuid;
update public.attempts set status = 'submitted', submitted_at = now() where id = current_setting('prueba.t1b')::uuid;
select public.recompute_attempt(current_setting('prueba.t1b')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de620000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de620000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.control_cerrar(current_setting('prueba.s2')::uuid);
  r := public.control_confirmar(current_setting('prueba.s2')::uuid);
  -- incidencia en la primera sesión: esa medición deja de contar; queda la de 30 %
  r := public.control_incidencia(current_setting('prueba.s')::uuid, 'de620000-0000-4000-8000-000000000011', 'Se cayó la red del aula');
  r := public.vta_seccion('de620000-0000-4000-8000-000000000031');
  if r ->> 'aviso' not like '%No son pruebas%' then raise exception 'FALLO: aviso VTA'; end if;
  if exists (select 1 from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'senal' not in ('sin_datos', 'datos_insuficientes', 'reforzar_autonomia', 'coherente', 'indeterminada')) then
    raise exception 'FALLO: etiqueta VTA'; end if;
  r := public.vta_estudiante('de620000-0000-4000-8000-000000000031', 'de620000-0000-4000-8000-000000000011');
  if jsonb_array_length(r -> 'historial') <> 1 then raise exception 'FALLO: historial VTA %', r; end if;
end $$;
reset role;
do $$ begin
  -- 1 − 0,2 × (1 − 0,3) = 0,86 (solo cuenta la de recuperación; la de la incidencia no)
  if public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000011') <> 0.86 then
    raise exception 'FALLO: factor tras incidencia %', public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000011'); end if;
  update public.control_assignments set incidencia = null where session_id = current_setting('prueba.s')::uuid and user_id = 'de620000-0000-4000-8000-000000000011';
  update public.control_assignments set confirmado_at = now() where session_id = current_setting('prueba.s')::uuid and user_id = 'de620000-0000-4000-8000-000000000011';
  if public.control_factor('de620000-0000-4000-8000-0000000000a1', 'de620000-0000-4000-8000-000000000011') <> 0.9 then raise exception 'FALLO: descuentos encadenados'; end if;
  -- la auditoría registra todo
  if (select count(*) from public.control_audit where session_id = current_setting('prueba.s')::uuid) < 7 then raise exception 'FALLO: auditoría'; end if;
  if has_function_privilege('anon', 'public.control_live(uuid)', 'execute') or has_function_privilege('authenticated', 'public.control_factor(uuid, uuid)', 'execute') then
    raise exception 'FALLO: permisos'; end if;
end $$;

-- 8) cancelación: la sesión cancelada no ajusta nada y su actividad desaparece para los estudiantes
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.control_preparar('de620000-0000-4000-8000-0000000000a1', null, 5, 'c6200000-0000-4000-8000-000000000004');
  r := public.control_cancelar((r -> 'session' ->> 'id')::uuid, 'Activación por error');
  if r -> 'session' ->> 'estado' <> 'cancelado' then raise exception 'FALLO: cancelar'; end if;
end $$;
reset role;

select 'practicas_de_control.sql: PRUEBAS PASARON' as resultado;
rollback;
