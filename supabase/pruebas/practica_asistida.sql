-- Pruebas: práctica con aprendizaje asistido (migración 38). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de380000-0000-4000-8000-000000000001', 'as1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-asistida","aula_role":"teacher"}', '{}', now(), now()),
  ('de380000-0000-4000-8000-000000000002', 'as2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-asistida-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('de380000-0000-4000-8000-000000000011', 'as11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-asistida-1"}', '{}', now(), now()),
  ('de380000-0000-4000-8000-000000000012', 'as12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-asistida-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de380000-%';
update public.profiles set role = 'teacher' where id in ('de380000-0000-4000-8000-000000000001', 'de380000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de380000-0000-4000-8000-000000000021', 'Curso asistida'), ('de380000-0000-4000-8000-000000000022', 'Otro curso');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points) values
  ('de380000-0000-4000-8000-0000000000e1', 'de380000-0000-4000-8000-000000000021', 'resorte-descenso', 'numerica', 'intermedio', 'bank', 'numeric', 'Descenso máximo', 1),
  ('de380000-0000-4000-8000-0000000000e2', 'de380000-0000-4000-8000-000000000021', 'resorte-transfer', 'numerica', 'intermedio', 'bank', 'numeric', 'Variante conceptual', 1),
  ('de380000-0000-4000-8000-0000000000e9', 'de380000-0000-4000-8000-000000000022', 'ajeno', 'numerica', 'basico', 'bank', 'numeric', 'Ajeno', 1);
insert into public.exercise_keys (exercise_id, answer, explanation) values
  ('de380000-0000-4000-8000-0000000000e1', '{"format":"numeric","value":"0.098 m"}', 'Conservación de la energía: 2mg/k.'),
  ('de380000-0000-4000-8000-0000000000e2', '{"format":"numeric","value":"0.2 m"}', 'Misma idea.');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de380000-0000-4000-8000-000000000031', 'de380000-0000-4000-8000-000000000021', 'Sección asistida', 'ASISTI01', 'de380000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de380000-0000-4000-8000-000000000031', 'de380000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de380000-0000-4000-8000-000000000031', 'de380000-0000-4000-8000-000000000011'), ('de380000-0000-4000-8000-000000000031', 'de380000-0000-4000-8000-000000000012');
-- a1: asistida · a2: práctica tradicional (control) · a3: evaluación
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de380000-0000-4000-8000-0000000000a1', 'de380000-0000-4000-8000-000000000031', 'Resorte asistido', 'practice', true, 'immediate', true, 2),
  ('de380000-0000-4000-8000-0000000000a2', 'de380000-0000-4000-8000-000000000031', 'Resorte tradicional', 'practice', true, 'immediate', true, 3),
  ('de380000-0000-4000-8000-0000000000a3', 'de380000-0000-4000-8000-000000000031', 'Examen', 'exam', true, 'after_submit', false, 1);
insert into public.activity_items (activity_id, exercise_id, position) values
  ('de380000-0000-4000-8000-0000000000a1', 'de380000-0000-4000-8000-0000000000e1', 1),
  ('de380000-0000-4000-8000-0000000000a2', 'de380000-0000-4000-8000-0000000000e1', 1),
  ('de380000-0000-4000-8000-0000000000a3', 'de380000-0000-4000-8000-0000000000e1', 1);

do $$ begin
  if has_function_privilege('authenticated', 'public.svc_asistida_registrar(uuid, uuid, uuid, text, jsonb, jsonb, uuid)', 'execute') then raise exception 'FALLO: svc expuesta'; end if;
  if has_table_privilege('authenticated', 'public.assisted_steps', 'select') then raise exception 'FALLO: pasos legibles directamente'; end if;
end $$;

-- 1) configuración: solo el profesor de la sección, solo prácticas, pesos que suman 100; cierra la comprobación clásica
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.assisted_settings_save('de380000-0000-4000-8000-0000000000a3', '{}', null); raise exception 'FALLO: asistida en un examen';
  exception when invalid_parameter_value then null; end;
  begin perform public.assisted_settings_save('de380000-0000-4000-8000-0000000000a1', '{"peso_inicial":50}', null); raise exception 'FALLO: pesos que no suman 100';
  exception when invalid_parameter_value then null; end;
  begin perform public.assisted_settings_save('de380000-0000-4000-8000-0000000000a1', '{"transferencia":true}', '{"de380000-0000-4000-8000-0000000000e1":"de380000-0000-4000-8000-0000000000e9"}');
    raise exception 'FALLO: transferencia de otra asignatura'; exception when invalid_parameter_value then null; end;
  r := public.assisted_settings_save('de380000-0000-4000-8000-0000000000a1', '{"transferencia":true}', '{"de380000-0000-4000-8000-0000000000e1":"de380000-0000-4000-8000-0000000000e2"}');
  if (r -> 'config' ->> 'peso_transferencia')::int <> 30 or r -> 'transferencias' ->> 'de380000-0000-4000-8000-0000000000e1' <> 'de380000-0000-4000-8000-0000000000e2' then raise exception 'FALLO: configuración %', r; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.assisted_settings_save('de380000-0000-4000-8000-0000000000a1', '{}', null); raise exception 'FALLO: profesor ajeno configuró';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select reveal_policy::text || hints_enabled::text from public.activities where id = 'de380000-0000-4000-8000-0000000000a1') <> 'after_submitfalse' then
    raise exception 'FALLO: la práctica asistida debe quedar sin retroalimentación inmediata ni pistas'; end if;
end $$;

-- 2) los estudiantes empiezan; 16) la vía clásica de comprobación sigue funcionando en la práctica tradicional y está cerrada en la asistida
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000011', true);
select set_config('prueba.t1', public.start_activity_attempt('de380000-0000-4000-8000-0000000000a1')::text, true);
select set_config('prueba.t2', public.start_activity_attempt('de380000-0000-4000-8000-0000000000a2')::text, true);
do $$ begin
  if (public.asistida_estado(current_setting('prueba.t2')::uuid) ->> 'asistida')::boolean then raise exception 'FALLO: la tradicional no es asistida'; end if;
  begin perform public.get_hint(current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1'); raise exception 'FALLO: pistas en la asistida';
  exception when raise_exception then null; end;
  begin perform public.reveal_solution(current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1'); raise exception 'FALLO: solución en la asistida';
  exception when raise_exception then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000012', true);
select set_config('prueba.t3', public.start_activity_attempt('de380000-0000-4000-8000-0000000000a1')::text, true);
reset role;
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_check_context('de380000-0000-4000-8000-000000000011', current_setting('prueba.t2')::uuid, 'de380000-0000-4000-8000-0000000000e1');
  if r -> 'key' ->> 'value' <> '0.098 m' then raise exception 'FALLO: práctica tradicional %', r; end if;
  begin perform public.svc_check_context('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1');
    raise exception 'FALLO: comprobación clásica (oráculo) en la asistida'; exception when raise_exception then null; end;

  -- orden: no hay corrección sin primer intento
  begin perform public.svc_asistida_contexto('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'corregida');
    raise exception 'FALLO: corrección antes del primer intento'; exception when raise_exception then null; end;
  -- 2) estudiante 1: primer intento incorrecto declarado autónomo (0.049 m)
  r := public.svc_asistida_contexto('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'inicial', 'c0000000-0000-4000-8000-000000000001');
  if r -> 'key' ->> 'value' <> '0.098 m' then raise exception 'FALLO: contexto %', r; end if;
  r := public.svc_asistida_registrar('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'inicial',
    '{"answer":{"text":"0.049 m"},"procedimiento":"x = mg/k","declaracion":"autonomo"}', '{"status":"incorrect","credit":0,"code":"factor_two","messages":["m"]}', 'c0000000-0000-4000-8000-000000000001');
  if r ->> 'siguiente' <> 'corregida' then raise exception 'FALLO: estado tras el primer intento %', r; end if;
  if (r -> 'pasos' -> 0 ->> 'status') is not null then raise exception 'FALLO: el estudiante ve el resultado de su primer intento antes de corregir'; end if;
  if r -> 'solucion' is not null and r -> 'solucion' <> 'null'::jsonb then raise exception 'FALLO: solución antes de explicar'; end if;
  -- 10) reintento del mismo envío: se reconoce, sin duplicar
  r := public.svc_asistida_contexto('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'inicial', 'c0000000-0000-4000-8000-000000000001');
  if not (r ->> 'repetido')::boolean then raise exception 'FALLO: reintento no reconocido %', r; end if;
  -- 13) otra pestaña con otro envío del primer intento: rechazado (ya existe)
  begin perform public.svc_asistida_contexto('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'inicial', 'c0000000-0000-4000-8000-000000000099');
    raise exception 'FALLO: segundo primer intento desde otra pestaña'; exception when raise_exception then null; end;
  begin perform public.svc_asistida_registrar('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'inicial',
    '{"answer":{"text":"0.098 m"},"declaracion":"autonomo"}', '{"status":"correct","credit":1}', 'c0000000-0000-4000-8000-000000000098');
    raise exception 'FALLO: sobrescribió el primer intento'; exception when raise_exception then null; end;
  -- corrección: dos comprobaciones como máximo (max_tries_per_item = 2)
  perform public.svc_asistida_registrar('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'corregida',
    '{"answer":{"text":"0.098 cm"}}', '{"status":"incorrect","credit":0}', 'c0000000-0000-4000-8000-000000000002');
  r := public.svc_asistida_registrar('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'corregida',
    '{"answer":{"text":"0.098 m"},"procedimiento":"Energía: mgx = kx²/2"}', '{"status":"correct","credit":1}', 'c0000000-0000-4000-8000-000000000003');
  if r ->> 'siguiente' <> 'reflexion' or (r -> 'pasos' -> 0 ->> 'status') <> 'incorrect' then raise exception 'FALLO: tras corregir debe pasar a explicar y mostrar el resultado inicial %', r; end if;
  begin perform public.svc_asistida_contexto('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'corregida');
    raise exception 'FALLO: superó las comprobaciones'; exception when raise_exception then null; end;
  -- transferencia antes de explicar: no
  begin perform public.svc_asistida_contexto('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'transferencia');
    raise exception 'FALLO: transferencia antes de explicar'; exception when raise_exception then null; end;

  -- 3 y 18) estudiante 2: mismas respuestas, declara haber consultado ayuda → misma nota
  perform public.svc_asistida_registrar('de380000-0000-4000-8000-000000000012', current_setting('prueba.t3')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'inicial',
    '{"answer":{"text":"0.049 m"},"declaracion":"consulto_ayuda"}', '{"status":"incorrect","credit":0}', 'c0000000-0000-4000-8000-000000000011');
  perform public.svc_asistida_registrar('de380000-0000-4000-8000-000000000012', current_setting('prueba.t3')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'corregida',
    '{"answer":{"text":"0.098 m"}}', '{"status":"correct","credit":1}', 'c0000000-0000-4000-8000-000000000012');
  -- 14) un estudiante no puede registrar pasos en el intento de otro
  begin perform public.svc_asistida_contexto('de380000-0000-4000-8000-000000000012', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'corregida');
    raise exception 'FALLO: fase en el intento de otro estudiante'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 12) ni siquiera directamente en la base de datos se puede modificar el primer intento
do $$ begin
  begin update public.assisted_steps set answer = '{"text":"0.098 m"}' where attempt_id = current_setting('prueba.t1')::uuid and fase = 'inicial';
    raise exception 'FALLO: se pudo modificar el primer intento'; exception when raise_exception then null; end;
  if (select answer ->> 'text' from public.assisted_steps where attempt_id = current_setting('prueba.t1')::uuid and fase = 'inicial') <> '0.049 m' then raise exception 'FALLO: el primer intento cambió'; end if;
  if (select count(*) from public.assisted_steps where attempt_id = current_setting('prueba.t1')::uuid and fase = 'corregida') <> 2 then raise exception 'FALLO: versiones de la corrección'; end if;
end $$;

-- 4, 7, 11) reflexión del estudiante 1 (su propio intento), estado completo tras «recargar»; el estudiante 2 no explica
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000011', true);
do $$ declare r jsonb; begin
  begin perform public.asistida_reflexion(current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', '{"error":"x"}', array['inventada'], null, 'c0000000-0000-4000-8000-000000000020');
    raise exception 'FALLO: fuente no válida'; exception when invalid_parameter_value then null; end;
  r := public.asistida_reflexion(current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1',
    '{"error":"Confundí el equilibrio con el punto de retorno","principio":"Conservación de la energía"}', array['ia', 'libro'],
    '[{"fuente":"Tutor IA","concepto":"punto de retorno"}]', 'c0000000-0000-4000-8000-000000000021');
  if r ->> 'siguiente' <> 'transferencia' or r -> 'transferencia' ->> 'prompt' <> 'Variante conceptual' then raise exception 'FALLO: debe desbloquear la transferencia %', r; end if;
  if r -> 'solucion' ->> 'explanation' is null then raise exception 'FALLO: tras explicar se muestra la solución %', r; end if;
  -- otro estudiante no ve este intento
  r := public.asistida_estado(current_setting('prueba.t1')::uuid);
  if jsonb_array_length(r -> 'items') <> 1 or r -> 'items' -> 0 ->> 'siguiente' <> 'transferencia' then raise exception 'FALLO: estado tras recargar %', r; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000012', true);
do $$ begin
  begin perform public.asistida_estado(current_setting('prueba.t1')::uuid); raise exception 'FALLO: un estudiante vio el proceso de otro';
  exception when insufficient_privilege then null; end;
  begin perform public.asistida_reflexion(current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', '{"error":"Ajena ajena ajena ajena"}', null, null, 'c0000000-0000-4000-8000-000000000030');
    raise exception 'FALLO: reflexión en el intento de otro'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 9) transferencia del estudiante 1
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_asistida_contexto('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'transferencia');
  if r -> 'key' ->> 'value' <> '0.2 m' then raise exception 'FALLO: la transferencia usa la clave del otro ejercicio %', r; end if;
  r := public.svc_asistida_registrar('de380000-0000-4000-8000-000000000011', current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1', 'transferencia',
    '{"answer":{"text":"0.2 m"}}', '{"status":"correct","credit":1}', 'c0000000-0000-4000-8000-000000000040');
  if r ->> 'siguiente' <> 'completo' then raise exception 'FALLO: debe quedar completo %', r; end if;
end $$;
reset role;

-- 6, 8, 18) notas: estudiante 1 completo = 100 %; estudiante 2 (sin explicar, sin transferencia) = 20 + 30 = 50 % de 100
do $$ begin
  if (select auto_credit from public.responses where attempt_id = current_setting('prueba.t1')::uuid) <> 1 then raise exception 'FALLO: nota del estudiante 1'; end if;
  if (select auto_credit from public.responses where attempt_id = current_setting('prueba.t3')::uuid) <> 0.5 then
    raise exception 'FALLO: nota del estudiante 2 (%)', (select auto_credit from public.responses where attempt_id = current_setting('prueba.t3')::uuid); end if;
  -- la declaración no cambia la nota: con las mismas fases, misma parte inicial y de corrección
  if (public.asistida_credito(current_setting('prueba.t1')::uuid, 'de380000-0000-4000-8000-0000000000e1') ->> 'inicial')::numeric
     <> (public.asistida_credito(current_setting('prueba.t3')::uuid, 'de380000-0000-4000-8000-0000000000e1') ->> 'inicial')::numeric then raise exception 'FALLO: la declaración afecta a la nota'; end if;
  if (select status from public.responses where attempt_id = current_setting('prueba.t1')::uuid) <> 'correct' then raise exception 'FALLO: estado de la respuesta'; end if;
end $$;

-- 17) el profesor ve el proceso completo (con el resultado del primer intento); un profesor ajeno no
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.asistida_proceso('de380000-0000-4000-8000-0000000000a1');
  if jsonb_array_length(r -> 'intentos') <> 2 then raise exception 'FALLO: proceso %', r; end if;
  if not exists (select 1 from jsonb_array_elements(r -> 'intentos') i, jsonb_array_elements(i -> 'items' -> 0 -> 'pasos') p
                 where p ->> 'fase' = 'inicial' and p ->> 'status' = 'incorrect' and p ->> 'declaracion' = 'consulto_ayuda') then
    raise exception 'FALLO: el profesor no ve el primer intento con su resultado y declaración'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.asistida_proceso('de380000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: profesor ajeno vio el proceso';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- desactivar (migración 40): no con pasos registrados; sí en una práctica asistida sin pasos; solo el profesor de la sección
reset role;
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('de380000-0000-4000-8000-0000000000a4', 'de380000-0000-4000-8000-000000000031', 'Asistida sin usar', 'practice', true, 'after_submit', false);
insert into public.assisted_settings (activity_id) values ('de380000-0000-4000-8000-0000000000a4');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000001', true);
do $$ begin
  begin perform public.assisted_settings_disable('de380000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: desactivó con pasos registrados';
  exception when raise_exception then null; end;
  if public.assisted_settings_disable('de380000-0000-4000-8000-0000000000a4') -> 'config' <> 'null'::jsonb then raise exception 'FALLO: no se desactivó'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de380000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de380000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.assisted_settings_disable('de380000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: profesor ajeno desactivó';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.assisted_settings where activity_id = 'de380000-0000-4000-8000-0000000000a1') then raise exception 'FALLO: se borró la configuración con pasos'; end if;
end $$;

select 'practica_asistida.sql: PRUEBAS PASARON' as resultado;
rollback;
