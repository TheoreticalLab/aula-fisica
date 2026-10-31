-- Pruebas: prórrogas individuales del examen (migración 37). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de370000-0000-4000-8000-000000000001', 'pr1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-prorroga","aula_role":"teacher"}', '{}', now(), now()),
  ('de370000-0000-4000-8000-000000000002', 'pr2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-prorroga-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('de370000-0000-4000-8000-000000000011', 'pr11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-prorroga-1"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de370000-%';
update public.profiles set role = 'teacher' where id in ('de370000-0000-4000-8000-000000000001', 'de370000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de370000-0000-4000-8000-000000000021', 'Curso prórroga');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options, points)
  values ('de370000-0000-4000-8000-0000000000e1', 'de370000-0000-4000-8000-000000000021', 'prorroga-e1', 'seleccion', 'basico', 'bank', 'choice', 'Pregunta', '["a","b"]', 1);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de370000-0000-4000-8000-000000000031', 'de370000-0000-4000-8000-000000000021', 'Sección prórroga', 'PRORRO01', 'de370000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de370000-0000-4000-8000-000000000031', 'de370000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('de370000-0000-4000-8000-000000000031', 'de370000-0000-4000-8000-000000000011');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('de370000-0000-4000-8000-0000000000a1', 'de370000-0000-4000-8000-000000000031', 'Con límite', 'exam', true, 'after_submit', false),
  ('de370000-0000-4000-8000-0000000000a2', 'de370000-0000-4000-8000-000000000031', 'Sin límite', 'exam', true, 'after_submit', false);
insert into public.activity_items (activity_id, exercise_id, position) values
  ('de370000-0000-4000-8000-0000000000a1', 'de370000-0000-4000-8000-0000000000e1', 1), ('de370000-0000-4000-8000-0000000000a2', 'de370000-0000-4000-8000-0000000000e1', 1);
insert into public.exam_settings (activity_id, presentacion, navegacion, duracion_s) values
  ('de370000-0000-4000-8000-0000000000a1', 'una_a_la_vez', 'libre', 600), ('de370000-0000-4000-8000-0000000000a2', 'una_a_la_vez', 'libre', null);

do $$ begin
  if has_function_privilege('anon', 'public.exam_extend(uuid, integer, text)', 'execute') then raise exception 'FALLO: anon puede dar prórrogas'; end if;
  if has_table_privilege('authenticated', 'public.exam_extensions', 'select') then raise exception 'FALLO: registro de prórrogas legible directamente'; end if;
end $$;

-- el estudiante empieza los dos exámenes; el de 10 minutos venció hace 1 minuto
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de370000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de370000-0000-4000-8000-000000000011', true);
select set_config('prueba.t1', public.start_activity_attempt('de370000-0000-4000-8000-0000000000a1')::text, true);
select set_config('prueba.t2', public.start_activity_attempt('de370000-0000-4000-8000-0000000000a2')::text, true);
do $$ begin perform public.exam_open(current_setting('prueba.t1')::uuid); perform public.exam_open(current_setting('prueba.t2')::uuid); end $$;
reset role;
update public.attempts set started_at = now() - interval '11 minutes' where id = current_setting('prueba.t1')::uuid;
set local role authenticated;
do $$ begin
  begin perform public.exam_save(current_setting('prueba.t1')::uuid, 'de370000-0000-4000-8000-0000000000e1', '{"selected":[0]}', 1); raise exception 'FALLO: guardó con el tiempo vencido';
  exception when raise_exception then null; end;
  -- un estudiante no se da prórrogas
  begin perform public.exam_extend(current_setting('prueba.t1')::uuid, 30); raise exception 'FALLO: el estudiante se dio una prórroga';
  exception when insufficient_privilege then null; end;
end $$;

-- un profesor ajeno no puede; el de la sección sí, dentro de límites
select set_config('request.jwt.claims', '{"sub":"de370000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de370000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.exam_extend(current_setting('prueba.t1')::uuid, 5); raise exception 'FALLO: un profesor ajeno dio una prórroga';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de370000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de370000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.exam_extend(current_setting('prueba.t1')::uuid, 0); raise exception 'FALLO: aceptó 0 minutos';
  exception when invalid_parameter_value then null; end;
  begin perform public.exam_extend(current_setting('prueba.t2')::uuid, 5); raise exception 'FALLO: prórroga en un examen sin límite';
  exception when raise_exception then null; end;
  r := public.exam_extend(current_setting('prueba.t1')::uuid, 5, 'Se cayó su conexión');
  if (r ->> 'extra_s')::int <> 300 then raise exception 'FALLO: prórroga %', r; end if;
  if (r ->> 'limite_ms')::bigint <> (extract(epoch from now() - interval '11 minutes') * 1000)::bigint + 900000 then raise exception 'FALLO: nuevo límite %', r; end if;
  r := public.exam_monitor('de370000-0000-4000-8000-0000000000a1');
  if (r -> 'en_curso' -> 0 ->> 'extra_s')::int <> 300 then raise exception 'FALLO: el seguimiento no muestra la prórroga %', r; end if;
end $$;

-- con la prórroga, el estudiante vuelve a poder guardar
select set_config('request.jwt.claims', '{"sub":"de370000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de370000-0000-4000-8000-000000000011', true);
do $$ begin
  if (public.exam_save(current_setting('prueba.t1')::uuid, 'de370000-0000-4000-8000-0000000000e1', '{"selected":[1]}', 2) ->> 'aplicada')::boolean is not true then
    raise exception 'FALLO: no guardó tras la prórroga'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.exam_extensions where attempt_id = current_setting('prueba.t1')::uuid and segundos = 300 and teacher_id = 'de370000-0000-4000-8000-000000000001' and motivo = 'Se cayó su conexión') <> 1 then
    raise exception 'FALLO: la prórroga no quedó registrada'; end if;
end $$;

select 'prorrogas_examen.sql: PRUEBAS PASARON' as resultado;
rollback;
