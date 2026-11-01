-- Pruebas: variantes por intento (migración 51). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de510000-0000-4000-8000-000000000001', 'va1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-variantes","aula_role":"teacher"}', '{}', now(), now()),
  ('de510000-0000-4000-8000-000000000002', 'va2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-variantes-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('de510000-0000-4000-8000-000000000011', 'va11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-variantes-1"}', '{}', now(), now()),
  ('de510000-0000-4000-8000-000000000012', 'va12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-variantes-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de510000-%';
update public.profiles set role = 'teacher' where id in ('de510000-0000-4000-8000-000000000001', 'de510000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de510000-0000-4000-8000-000000000021', 'Curso variantes');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points) values
  ('de510000-0000-4000-8000-0000000000e1', 'de510000-0000-4000-8000-000000000021', 'var-choque', 'numerica', 'intermedio', 'bank', 'numeric', 'Bloque de {{m1}} kg a {{v1}} m/s', 1),
  ('de510000-0000-4000-8000-0000000000e2', 'de510000-0000-4000-8000-000000000021', 'fijo', 'numerica', 'basico', 'bank', 'numeric', 'Sin variante', 1),
  ('de510000-0000-4000-8000-0000000000e3', 'de510000-0000-4000-8000-000000000021', 'var-transfer', 'numerica', 'intermedio', 'bank', 'numeric', 'Transferencia {{m1}}', 1),
  ('de510000-0000-4000-8000-0000000000e9', 'de510000-0000-4000-8000-000000000021', 'fuera', 'numerica', 'basico', 'bank', 'numeric', 'No está en la actividad', 1);
insert into public.exercise_keys (exercise_id, answer, explanation) values
  ('de510000-0000-4000-8000-0000000000e1', '{"format":"numeric","value":"0 m","variante":{"plantilla":"A","respuesta":"d","unidad":"m","errores":[{"expresion":"v1^2/(2*mu*g)","message":"secreto"}]}}', ''),
  ('de510000-0000-4000-8000-0000000000e2', '{"format":"numeric","value":"3 m"}', ''),
  ('de510000-0000-4000-8000-0000000000e3', '{"format":"numeric","value":"0 m","variante":{"plantilla":"A","respuesta":"v","unidad":"m/s"}}', ''),
  ('de510000-0000-4000-8000-0000000000e9', '{"format":"numeric","value":"0 m","variante":{"plantilla":"A","respuesta":"d","unidad":"m"}}', '');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de510000-0000-4000-8000-000000000031', 'de510000-0000-4000-8000-000000000021', 'Sección variantes', 'VARIAN01', 'de510000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de510000-0000-4000-8000-000000000031', 'de510000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de510000-0000-4000-8000-000000000031', 'de510000-0000-4000-8000-000000000011'), ('de510000-0000-4000-8000-000000000031', 'de510000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de510000-0000-4000-8000-0000000000a1', 'de510000-0000-4000-8000-000000000031', 'Choques con variantes', 'practice', true, 'immediate', true, 2);
insert into public.activity_items (activity_id, exercise_id, position) values
  ('de510000-0000-4000-8000-0000000000a1', 'de510000-0000-4000-8000-0000000000e1', 1),
  ('de510000-0000-4000-8000-0000000000a1', 'de510000-0000-4000-8000-0000000000e2', 2);
insert into public.assisted_transfer (activity_id, exercise_id, transfer_exercise_id) values
  ('de510000-0000-4000-8000-0000000000a1', 'de510000-0000-4000-8000-0000000000e1', 'de510000-0000-4000-8000-0000000000e3');

-- 0) solo el servidor puede usarla
do $$ begin
  if has_function_privilege('authenticated', 'public.svc_variante_info(uuid, uuid, uuid)', 'execute') then raise exception 'FALLO: svc_variante_info expuesta a authenticated'; end if;
  if has_function_privilege('anon', 'public.svc_variante_info(uuid, uuid, uuid)', 'execute') then raise exception 'FALLO: svc_variante_info expuesta a anon'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de510000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de510000-0000-4000-8000-000000000011', true);
select set_config('prueba.t1', public.start_activity_attempt('de510000-0000-4000-8000-0000000000a1')::text, true);
reset role;

set local role service_role;
do $$ declare r jsonb; t uuid := current_setting('prueba.t1')::uuid; begin
  -- 1) el dueño recibe solo el nombre de la plantilla (sin respuesta ni errores típicos)
  r := public.svc_variante_info('de510000-0000-4000-8000-000000000011', t, 'de510000-0000-4000-8000-0000000000e1');
  if r <> '{"plantilla":"A"}'::jsonb then raise exception 'FALLO: dueño %', r; end if;
  if r::text like '%secreto%' or r::text like '%respuesta%' then raise exception 'FALLO: se filtró la clave %', r; end if;
  -- 2) pregunta sin variante → null
  if public.svc_variante_info('de510000-0000-4000-8000-000000000011', t, 'de510000-0000-4000-8000-0000000000e2') is not null then raise exception 'FALLO: sin variante debía ser null'; end if;
  -- 3) el profesor de la sección también (revisión del intento)
  r := public.svc_variante_info('de510000-0000-4000-8000-000000000001', t, 'de510000-0000-4000-8000-0000000000e1');
  if r ->> 'plantilla' <> 'A' then raise exception 'FALLO: profesor %', r; end if;
  -- 4) el ejercicio de transferencia de una pregunta del intento (práctica asistida)
  r := public.svc_variante_info('de510000-0000-4000-8000-000000000011', t, 'de510000-0000-4000-8000-0000000000e3');
  if r ->> 'plantilla' <> 'A' then raise exception 'FALLO: transferencia %', r; end if;
  -- 5) otro estudiante y un profesor ajeno no pueden
  begin perform public.svc_variante_info('de510000-0000-4000-8000-000000000012', t, 'de510000-0000-4000-8000-0000000000e1'); raise exception 'FALLO: otro estudiante';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_variante_info('de510000-0000-4000-8000-000000000002', t, 'de510000-0000-4000-8000-0000000000e1'); raise exception 'FALLO: profesor ajeno';
  exception when insufficient_privilege then null; end;
  -- 6) una pregunta que no es del intento
  begin perform public.svc_variante_info('de510000-0000-4000-8000-000000000011', t, 'de510000-0000-4000-8000-0000000000e9'); raise exception 'FALLO: pregunta ajena al intento';
  exception when insufficient_privilege then null; end;
  -- 7) intento inexistente
  begin perform public.svc_variante_info('de510000-0000-4000-8000-000000000011', 'de510000-0000-4000-8000-0000000000ff', 'de510000-0000-4000-8000-0000000000e1'); raise exception 'FALLO: intento inexistente';
  exception when no_data_found then null; end;
end $$;
reset role;

select 'variantes_intento: PRUEBAS PASARON' as resultado;
rollback;
