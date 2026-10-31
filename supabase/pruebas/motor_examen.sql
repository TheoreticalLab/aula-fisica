-- Pruebas: motor de examen (migración 35). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de350000-0000-4000-8000-000000000001', 'me1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-motor","aula_role":"teacher"}', '{}', now(), now()),
  ('de350000-0000-4000-8000-000000000002', 'me2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-motor-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('de350000-0000-4000-8000-000000000011', 'me11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-motor-1"}', '{}', now(), now()),
  ('de350000-0000-4000-8000-000000000012', 'me12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-motor-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de350000-%';
update public.profiles set role = 'teacher' where id in ('de350000-0000-4000-8000-000000000001', 'de350000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de350000-0000-4000-8000-000000000021', 'Curso motor');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options, points)
  select ('de350000-0000-4000-8000-0000000000e' || k)::uuid, 'de350000-0000-4000-8000-000000000021', 'motor-e' || k, 'seleccion', 'basico', 'bank', 'choice', 'Pregunta ' || k, '["a","b","c"]', 1
  from generate_series(1, 3) k;
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de350000-0000-4000-8000-000000000031', 'de350000-0000-4000-8000-000000000021', 'Sección motor', 'MOTOR001', 'de350000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de350000-0000-4000-8000-000000000031', 'de350000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de350000-0000-4000-8000-000000000031', 'de350000-0000-4000-8000-000000000011'),
  ('de350000-0000-4000-8000-000000000031', 'de350000-0000-4000-8000-000000000012');
-- a1: sin configuración (control: como antes) · a2: una a la vez, libre, con pausas · a3: solo adelante, 60 s · a4: práctica
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('de350000-0000-4000-8000-0000000000a1', 'de350000-0000-4000-8000-000000000031', 'Examen clásico', 'exam', true, 'after_submit', false),
  ('de350000-0000-4000-8000-0000000000a2', 'de350000-0000-4000-8000-000000000031', 'Examen con pausas', 'exam', true, 'after_submit', false),
  ('de350000-0000-4000-8000-0000000000a3', 'de350000-0000-4000-8000-000000000031', 'Examen solo adelante', 'exam', true, 'after_submit', false),
  ('de350000-0000-4000-8000-0000000000a4', 'de350000-0000-4000-8000-000000000031', 'Práctica', 'practice', true, 'immediate', true);
insert into public.activity_items (activity_id, exercise_id, position)
  select ('de350000-0000-4000-8000-0000000000a' || a)::uuid, ('de350000-0000-4000-8000-0000000000e' || k)::uuid, k from generate_series(1, 4) a, generate_series(1, 3) k;

-- 0) nadie anónimo; los ayudantes no son invocables desde la API
do $$ begin
  if has_function_privilege('anon', 'public.exam_open(uuid)', 'execute') then raise exception 'FALLO: anon puede abrir exámenes'; end if;
  if has_function_privilege('authenticated', 'public.exam_deadline(uuid)', 'execute') then raise exception 'FALLO: ayudante expuesto'; end if;
  if has_function_privilege('authenticated', 'public.exam_assert_navegable(uuid, uuid)', 'execute') then raise exception 'FALLO: ayudante expuesto'; end if;
  if has_table_privilege('authenticated', 'public.exam_intervals', 'select') then raise exception 'FALLO: tabla de tramos legible directamente'; end if;
end $$;

set local role authenticated;
-- 1) configuración: solo el profesor de la sección, solo en evaluaciones, dentro de límites
select set_config('request.jwt.claims', '{"sub":"de350000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de350000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.exam_settings_get('de350000-0000-4000-8000-0000000000a1');
  if r ->> 'presentacion' <> 'todas' or (r ->> 'configurado')::boolean then raise exception 'FALLO: sin fila debe ser «todas» (como antes): %', r; end if;
  r := public.exam_settings_save('de350000-0000-4000-8000-0000000000a2', '{"presentacion":"una_a_la_vez","navegacion":"libre","duracion_s":3600,"pausas":{"permitidas":true,"max_numero":1,"max_total_s":120,"detienen_reloj":true}}');
  if (r -> 'pausas' ->> 'max_numero')::int <> 1 then raise exception 'FALLO: guardar configuración %', r; end if;
  perform public.exam_settings_save('de350000-0000-4000-8000-0000000000a3', '{"presentacion":"una_a_la_vez","navegacion":"solo_adelante","duracion_s":60,"pausas":{"permitidas":false,"max_numero":5}}');
  begin perform public.exam_settings_save('de350000-0000-4000-8000-0000000000a4', '{}'); raise exception 'FALLO: configuró una práctica';
  exception when invalid_parameter_value then null; end;
  begin perform public.exam_settings_save('de350000-0000-4000-8000-0000000000a2', '{"duracion_s":10}'); raise exception 'FALLO: aceptó 10 s';
  exception when invalid_parameter_value then null; end;
  begin perform public.exam_settings_save('de350000-0000-4000-8000-0000000000a2', '{"navegacion":"caotica"}'); raise exception 'FALLO: navegación inválida';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
  if (select pausas_max from public.exam_settings where activity_id = 'de350000-0000-4000-8000-0000000000a3') <> 0 then raise exception 'FALLO: sin pausas, el máximo debe ser 0'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de350000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de350000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.exam_settings_save('de350000-0000-4000-8000-0000000000a2', '{}'); raise exception 'FALLO: un profesor ajeno configuró';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) estudiante: la evaluación sin configuración no usa el motor y funciona como antes
select set_config('request.jwt.claims', '{"sub":"de350000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de350000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.exam_settings_save('de350000-0000-4000-8000-0000000000a2', '{}'); raise exception 'FALLO: un estudiante configuró';
  exception when insufficient_privilege then null; end;
end $$;
do $$ declare r jsonb; begin
  r := public.exam_rules('de350000-0000-4000-8000-0000000000a2');
  if r ->> 'presentacion' <> 'una_a_la_vez' or (r -> 'pausas' ->> 'max_numero')::int <> 1 or r ? 'configurado' then raise exception 'FALLO: reglas visibles %', r; end if;
end $$;
select set_config('prueba.t1', public.start_activity_attempt('de350000-0000-4000-8000-0000000000a1')::text, true);
select public.save_response(current_setting('prueba.t1')::uuid, 'de350000-0000-4000-8000-0000000000e1', '{"selected":[1]}');
do $$ begin
  if public.exam_open(current_setting('prueba.t1')::uuid) ->> 'modo' <> 'clasico' then raise exception 'FALLO: sin configuración debe ser la interfaz clásica'; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.exam_sessions where attempt_id = current_setting('prueba.t1')::uuid) then raise exception 'FALLO: creó sesión sin configuración'; end if;
end $$;
set local role authenticated;

-- 3) examen con pausas: abrir crea la sesión con una COPIA de la configuración
select set_config('prueba.t2', public.start_activity_attempt('de350000-0000-4000-8000-0000000000a2')::text, true);
reset role;
update public.attempts set started_at = now() - interval '10 minutes' where id = current_setting('prueba.t2')::uuid;
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.exam_open(current_setting('prueba.t2')::uuid);
  if r ->> 'activa' <> 'de350000-0000-4000-8000-0000000000e1' then raise exception 'FALLO: pregunta activa inicial %', r; end if;
  if r ->> 'estado' <> 'en_curso' or jsonb_array_length(r -> 'orden') <> 3 then raise exception 'FALLO: estado inicial %', r; end if;
  if (r ->> 'limite_ms')::bigint <> (extract(epoch from now() - interval '10 minutes') * 1000)::bigint + 3600000 then raise exception 'FALLO: límite oficial %', r; end if;
  -- reabrir no duplica la sesión
  r := public.exam_open(current_setting('prueba.t2')::uuid);
end $$;
reset role;
update public.exam_settings set duracion_s = 120 where activity_id = 'de350000-0000-4000-8000-0000000000a2';
do $$ begin
  if (select duracion_s from public.exam_sessions where attempt_id = current_setting('prueba.t2')::uuid) <> 3600 then raise exception 'FALLO: cambiar la configuración alteró un intento en curso'; end if;
  if (select count(*) from public.exam_events where attempt_id = current_setting('prueba.t2')::uuid and tipo = 'apertura') <> 2 then raise exception 'FALLO: aperturas'; end if;
end $$;
set local role authenticated;

-- 4) guardado con revisiones
do $$ declare r jsonb; begin
  r := public.exam_save(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e1', '{"selected":[0]}', 100);
  if not (r ->> 'aplicada')::boolean then raise exception 'FALLO: primera revisión %', r; end if;
  r := public.exam_save(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e1', '{"selected":[2]}', 50);
  if (r ->> 'aplicada')::boolean or (r ->> 'rev')::bigint <> 100 then raise exception 'FALLO: una revisión vieja pisó la nueva %', r; end if;
  r := public.exam_save(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e1', '{"selected":[1]}', 200);
  if not (r ->> 'aplicada')::boolean then raise exception 'FALLO: revisión nueva %', r; end if;
  begin perform public.exam_save(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e9', '{}', 300); raise exception 'FALLO: guardó una pregunta ajena';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select answer ->> 'selected' from public.responses where attempt_id = current_setting('prueba.t2')::uuid and exercise_id = 'de350000-0000-4000-8000-0000000000e1') <> '[1]' then
    raise exception 'FALLO: respuesta guardada'; end if;
end $$;
set local role authenticated;

-- 5) navegación libre y pausas (una pausa permitida)
do $$ declare r jsonb; begin
  perform public.exam_goto(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e3');
  perform public.exam_goto(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e1');   -- volver: permitido
  r := public.exam_pause(current_setting('prueba.t2')::uuid);
  if r ->> 'estado' <> 'en_pausa' then raise exception 'FALLO: pausa %', r; end if;
  begin perform public.exam_save(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e1', '{"selected":[0]}', 400); raise exception 'FALLO: guardó en pausa';
  exception when raise_exception then null; end;
  begin perform public.exam_goto(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e2'); raise exception 'FALLO: navegó en pausa';
  exception when raise_exception then null; end;
  r := public.exam_resume(current_setting('prueba.t2')::uuid);
  if r ->> 'estado' <> 'en_curso' then raise exception 'FALLO: reanudar %', r; end if;
  begin perform public.exam_pause(current_setting('prueba.t2')::uuid); raise exception 'FALLO: superó el número de pausas';
  exception when raise_exception then null; end;
end $$;

-- 6) diario de tramos: validación, idempotencia y rechazos registrados
do $$ declare r jsonb; v0 bigint := (extract(epoch from now() - interval '10 minutes') * 1000)::bigint; begin
  r := public.exam_journal(current_setting('prueba.t2')::uuid, jsonb_build_array(
    jsonb_build_object('seq', 1, 'tipo', 'trabajo', 'exercise_id', 'de350000-0000-4000-8000-0000000000e1', 'inicio_ms', v0, 'fin_ms', v0 + 30000),
    jsonb_build_object('seq', 2, 'tipo', 'oculta', 'exercise_id', 'de350000-0000-4000-8000-0000000000e1', 'inicio_ms', v0 + 30000, 'fin_ms', v0 + 45000),
    jsonb_build_object('seq', 3, 'tipo', 'trabajo', 'exercise_id', 'de350000-0000-4000-8000-0000000000e1', 'inicio_ms', v0 + 10000, 'fin_ms', v0 + 50000),   -- solapa
    jsonb_build_object('seq', 4, 'tipo', 'trabajo', 'exercise_id', 'de350000-0000-4000-8000-0000000000e9', 'inicio_ms', v0 + 45000, 'fin_ms', v0 + 50000),   -- ajena
    jsonb_build_object('seq', 5, 'tipo', 'trabajo', 'exercise_id', 'de350000-0000-4000-8000-0000000000e2', 'inicio_ms', v0 + 45000, 'fin_ms', (extract(epoch from now()) * 1000)::bigint + 600000), -- futuro
    jsonb_build_object('seq', 6, 'tipo', 'teletransporte', 'inicio_ms', v0 + 50000, 'fin_ms', v0 + 60000),
    jsonb_build_object('seq', 7, 'tipo', 'trabajo', 'exercise_id', 'de350000-0000-4000-8000-0000000000e2', 'inicio_ms', v0 + 45000, 'fin_ms', v0 + 90000)));
  if (r ->> 'aceptados')::int <> 3 or (r ->> 'rechazados')::int <> 4 then raise exception 'FALLO: validación del diario %', r; end if;
  -- reintento del mismo lote: no duplica
  r := public.exam_journal(current_setting('prueba.t2')::uuid, jsonb_build_array(
    jsonb_build_object('seq', 1, 'tipo', 'trabajo', 'exercise_id', 'de350000-0000-4000-8000-0000000000e1', 'inicio_ms', v0, 'fin_ms', v0 + 30000)));
  if (r ->> 'aceptados')::int <> 0 then raise exception 'FALLO: duplicó un tramo %', r; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.exam_intervals where attempt_id = current_setting('prueba.t2')::uuid) <> 3 then raise exception 'FALLO: tramos guardados'; end if;
  if (select count(*) from public.exam_events where attempt_id = current_setting('prueba.t2')::uuid and tipo = 'rechazo') <> 4 then raise exception 'FALLO: rechazos registrados'; end if;
end $$;

-- 7) otro estudiante no puede tocar la sesión ni ver la cronología
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de350000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de350000-0000-4000-8000-000000000012', true);
do $$ begin
  begin perform public.exam_goto(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e2'); raise exception 'FALLO: navegó en un intento ajeno';
  exception when insufficient_privilege then null; end;
  begin perform public.exam_journal(current_setting('prueba.t2')::uuid, '[]'); raise exception 'FALLO: escribió el diario ajeno';
  exception when insufficient_privilege then null; end;
  begin perform public.exam_timeline(current_setting('prueba.t2')::uuid); raise exception 'FALLO: vio una cronología ajena';
  exception when insufficient_privilege then null; end;
end $$;

-- 8) solo adelante + límite de 60 s
select set_config('request.jwt.claims', '{"sub":"de350000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de350000-0000-4000-8000-000000000011', true);
select set_config('prueba.t3', public.start_activity_attempt('de350000-0000-4000-8000-0000000000a3')::text, true);
do $$ begin
  perform public.exam_open(current_setting('prueba.t3')::uuid);
  perform public.exam_save(current_setting('prueba.t3')::uuid, 'de350000-0000-4000-8000-0000000000e1', '{"selected":[0]}', 10);
  perform public.exam_goto(current_setting('prueba.t3')::uuid, 'de350000-0000-4000-8000-0000000000e2');
  -- gracia de 10 s para el último guardado de la pregunta que se acaba de dejar
  perform public.exam_save(current_setting('prueba.t3')::uuid, 'de350000-0000-4000-8000-0000000000e1', '{"selected":[1]}', 20);
  begin perform public.exam_goto(current_setting('prueba.t3')::uuid, 'de350000-0000-4000-8000-0000000000e1'); raise exception 'FALLO: volvió atrás en «solo adelante»';
  exception when raise_exception then null; end;
  begin perform public.exam_pause(current_setting('prueba.t3')::uuid); raise exception 'FALLO: pausó sin pausas permitidas';
  exception when raise_exception then null; end;
end $$;
reset role;
update public.exam_events set t = t - interval '1 minute' where attempt_id = current_setting('prueba.t3')::uuid;   -- pasó el tiempo de gracia
set local role authenticated;
do $$ begin
  begin perform public.exam_save(current_setting('prueba.t3')::uuid, 'de350000-0000-4000-8000-0000000000e1', '{"selected":[2]}', 30); raise exception 'FALLO: modificó una pregunta anterior';
  exception when raise_exception then null; end;
  -- tampoco por la vía antigua
  begin perform public.save_response(current_setting('prueba.t3')::uuid, 'de350000-0000-4000-8000-0000000000e1', '{"selected":[2]}'); raise exception 'FALLO: save_response saltó la navegación';
  exception when raise_exception then null; end;
end $$;
reset role;
update public.attempts set started_at = now() - interval '5 minutes' where id = current_setting('prueba.t3')::uuid;   -- 60 s vencidos
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.exam_open(current_setting('prueba.t3')::uuid);
  if r ->> 'estado' <> 'vencido' then raise exception 'FALLO: debería estar vencido %', r; end if;
  begin perform public.exam_save(current_setting('prueba.t3')::uuid, 'de350000-0000-4000-8000-0000000000e2', '{"selected":[0]}', 40); raise exception 'FALLO: guardó con el tiempo vencido';
  exception when raise_exception then null; end;
  begin perform public.save_response(current_setting('prueba.t3')::uuid, 'de350000-0000-4000-8000-0000000000e2', '{"selected":[0]}'); raise exception 'FALLO: save_response saltó el límite';
  exception when raise_exception then null; end;
end $$;

-- 8b) seguimiento en vivo: el profesor ve los intentos en curso; un estudiante no
select set_config('request.jwt.claims', '{"sub":"de350000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de350000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.exam_monitor('de350000-0000-4000-8000-0000000000a2');
  if jsonb_array_length(r -> 'en_curso') <> 1 or (r -> 'en_curso' -> 0 ->> 'respondidas')::int <> 1 or (r ->> 'inscritos')::int <> 2 then raise exception 'FALLO: seguimiento %', r; end if;
  if r::text ~ 'selected' then raise exception 'FALLO: el seguimiento expone respuestas'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de350000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de350000-0000-4000-8000-000000000012', true);
do $$ begin
  begin perform public.exam_monitor('de350000-0000-4000-8000-0000000000a2'); raise exception 'FALLO: un estudiante vio el seguimiento';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de350000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de350000-0000-4000-8000-000000000011', true);

-- 9) entrega: evento oficial y tramos finales aceptados solo hasta la hora de entrega
reset role;
update public.attempts set status = 'submitted', submitted_at = now() where id = current_setting('prueba.t2')::uuid;
do $$ begin
  if not exists (select 1 from public.exam_events where attempt_id = current_setting('prueba.t2')::uuid and tipo = 'entrega') then raise exception 'FALLO: sin evento de entrega'; end if;
end $$;
set local role authenticated;
do $$ declare r jsonb; v0 bigint := (extract(epoch from now() - interval '10 minutes') * 1000)::bigint; begin
  r := public.exam_journal(current_setting('prueba.t2')::uuid, jsonb_build_array(
    jsonb_build_object('seq', 8, 'tipo', 'trabajo', 'exercise_id', 'de350000-0000-4000-8000-0000000000e2', 'inicio_ms', v0 + 90000, 'fin_ms', (extract(epoch from now()) * 1000)::bigint)));
  if (r ->> 'aceptados')::int <> 1 then raise exception 'FALLO: último tramo tras entregar %', r; end if;
  begin perform public.exam_goto(current_setting('prueba.t2')::uuid, 'de350000-0000-4000-8000-0000000000e2'); raise exception 'FALLO: navegó tras entregar';
  exception when raise_exception then null; end;
  -- el propio estudiante ve su cronología (sin su identificador)
  r := public.exam_timeline(current_setting('prueba.t2')::uuid);
  if jsonb_array_length(r -> 'tramos') <> 4 or (r -> 'sesion') ? 'user_id' then raise exception 'FALLO: cronología propia %', r; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de350000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de350000-0000-4000-8000-000000000001', true);
do $$ begin
  if jsonb_array_length(public.exam_timeline(current_setting('prueba.t2')::uuid) -> 'eventos') < 5 then raise exception 'FALLO: el profesor no ve la cronología'; end if;
end $$;
reset role;

select 'motor_examen.sql: PRUEBAS PASARON' as resultado;
rollback;
