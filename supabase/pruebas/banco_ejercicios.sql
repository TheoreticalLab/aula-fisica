-- Pruebas: banco de ejercicios y arrastre (migración 41). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ba410000-0000-4000-8000-000000000001', 'b1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-banco","aula_role":"teacher"}', '{}', now(), now()),
  ('ba410000-0000-4000-8000-000000000002', 'b2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-banco-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('ba410000-0000-4000-8000-000000000011', 'b11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-banco-1"}', '{}', now(), now()),
  ('ba410000-0000-4000-8000-000000000012', 'b12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-banco-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'ba410000-%';
update public.profiles set role = 'teacher' where id in ('ba410000-0000-4000-8000-000000000001', 'ba410000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('ba410000-0000-4000-8000-000000000021', 'Curso banco');
insert into public.units (id, course_id, slug, title) values ('ba410000-0000-4000-8000-000000000041', 'ba410000-0000-4000-8000-000000000021', 'banco-u', 'Unidad banco');
insert into public.lessons (id, unit_id, course_id, slug, title) values
  ('ba410000-0000-4000-8000-000000000051', 'ba410000-0000-4000-8000-000000000041', 'ba410000-0000-4000-8000-000000000021', 'banco-l1', 'Lección 1'),
  ('ba410000-0000-4000-8000-000000000052', 'ba410000-0000-4000-8000-000000000041', 'ba410000-0000-4000-8000-000000000021', 'banco-l2', 'Lección 2');
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, points) values
  ('ba410000-0000-4000-8000-0000000000e4', 'ba410000-0000-4000-8000-000000000021', 'ba410000-0000-4000-8000-000000000051', 'banco-etapa-4', 'numerica', 'desafiante', 'practice', 'numeric', 'Etapa 4', 1),
  ('ba410000-0000-4000-8000-0000000000e6', 'ba410000-0000-4000-8000-000000000021', 'ba410000-0000-4000-8000-000000000051', 'banco-etapa-6', 'numerica', 'desafiante', 'practice', 'numeric', 'Etapa 6', 1),
  ('ba410000-0000-4000-8000-0000000000e9', 'ba410000-0000-4000-8000-000000000021', 'ba410000-0000-4000-8000-000000000052', 'banco-otra', 'numerica', 'basico', 'practice', 'numeric', 'Otra lección', 1);
insert into public.exercise_bank_meta (exercise_id, course_id, meta) values
  ('ba410000-0000-4000-8000-0000000000e4', 'ba410000-0000-4000-8000-000000000021', '{"tema":"choque","tipo":"encadenada","etapas":4}'),
  ('ba410000-0000-4000-8000-0000000000e6', 'ba410000-0000-4000-8000-000000000021', '{"tema":"frenado","tipo":"encadenada","etapas":6}');
-- dos secciones: el profesor 1 enseña la A (estudiante 11); la B (estudiante 12) no tiene al profesor 1
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ba410000-0000-4000-8000-000000000031', 'ba410000-0000-4000-8000-000000000021', 'Sección banco A', 'BANCO0A1', 'ba410000-0000-4000-8000-000000000001'),
  ('ba410000-0000-4000-8000-000000000032', 'ba410000-0000-4000-8000-000000000021', 'Sección banco B', 'BANCO0B1', 'ba410000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('ba410000-0000-4000-8000-000000000031', 'ba410000-0000-4000-8000-000000000001') on conflict do nothing;
delete from public.class_teachers where class_id = 'ba410000-0000-4000-8000-000000000032';
insert into public.enrollments (class_id, user_id) values
  ('ba410000-0000-4000-8000-000000000031', 'ba410000-0000-4000-8000-000000000011'),
  ('ba410000-0000-4000-8000-000000000032', 'ba410000-0000-4000-8000-000000000012');
insert into public.attempts (id, user_id, course_id, lesson_id, mode) values
  ('ba410000-0000-4000-8000-0000000000a1', 'ba410000-0000-4000-8000-000000000011', 'ba410000-0000-4000-8000-000000000021', 'ba410000-0000-4000-8000-000000000051', 'practice'),
  ('ba410000-0000-4000-8000-0000000000a2', 'ba410000-0000-4000-8000-000000000012', 'ba410000-0000-4000-8000-000000000021', 'ba410000-0000-4000-8000-000000000051', 'practice');
insert into public.responses (attempt_id, exercise_id, user_id, answer, status, tries, first_try_correct, engine_code) values
  ('ba410000-0000-4000-8000-0000000000a1', 'ba410000-0000-4000-8000-0000000000e4', 'ba410000-0000-4000-8000-000000000011', '{"text":"6 m/s"}', 'incorrect', 1, false, 'common_error'),
  ('ba410000-0000-4000-8000-0000000000a1', 'ba410000-0000-4000-8000-0000000000e9', 'ba410000-0000-4000-8000-000000000011', '{"text":"9 m/s"}', 'correct', 1, true, 'ok'),
  ('ba410000-0000-4000-8000-0000000000a2', 'ba410000-0000-4000-8000-0000000000e4', 'ba410000-0000-4000-8000-000000000012', '{"text":"4 m/s"}', 'correct', 1, true, 'ok');

-- privilegios
do $$ begin
  if has_function_privilege('anon', 'public.svc_respuesta_etapa(uuid, uuid, uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.svc_respuesta_etapa(uuid, uuid, uuid, text)', 'execute') then
    raise exception 'FALLO: svc_respuesta_etapa accesible fuera de service_role'; end if;
  if not has_function_privilege('service_role', 'public.svc_respuesta_etapa(uuid, uuid, uuid, text)', 'execute') then
    raise exception 'FALLO: service_role no puede consultar la etapa anterior'; end if;
  if has_function_privilege('anon', 'public.banco_rendimiento(uuid)', 'execute') then raise exception 'FALLO: anon consulta el rendimiento'; end if;
  if has_table_privilege('anon', 'public.exercise_bank_meta', 'select') then raise exception 'FALLO: anon lee el banco'; end if;
  if has_table_privilege('authenticated', 'public.exercise_bank_meta', 'insert') or has_table_privilege('authenticated', 'public.exercise_bank_meta', 'update') then
    raise exception 'FALLO: un usuario puede escribir metadatos del banco'; end if;
end $$;

-- arrastre: la respuesta del MISMO estudiante, en el MISMO intento, a una etapa del MISMO minicapítulo
do $$ begin
  if public.svc_respuesta_etapa('ba410000-0000-4000-8000-000000000011', 'ba410000-0000-4000-8000-0000000000a1', 'ba410000-0000-4000-8000-0000000000e6', 'banco-etapa-4') is distinct from '6 m/s' then
    raise exception 'FALLO: no devuelve la respuesta de la etapa anterior'; end if;
  if public.svc_respuesta_etapa('ba410000-0000-4000-8000-000000000011', 'ba410000-0000-4000-8000-0000000000a1', 'ba410000-0000-4000-8000-0000000000e6', 'banco-otra') is not null then
    raise exception 'FALLO: arrastre desde otro minicapítulo'; end if;
  begin
    perform public.svc_respuesta_etapa('ba410000-0000-4000-8000-000000000012', 'ba410000-0000-4000-8000-0000000000a1', 'ba410000-0000-4000-8000-0000000000e6', 'banco-etapa-4');
    raise exception 'FALLO: leyó la respuesta de otro estudiante';
  exception when insufficient_privilege then null; end;
end $$;

-- estudiante: no ve los metadatos ni el rendimiento
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ba410000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ba410000-0000-4000-8000-000000000011', true);
do $$ begin
  if (select count(*) from public.exercise_bank_meta) <> 0 then raise exception 'FALLO: un estudiante lee el banco'; end if;
  begin perform * from public.banco_rendimiento('ba410000-0000-4000-8000-000000000021'); raise exception 'FALLO: un estudiante consulta el rendimiento';
  exception when insufficient_privilege then null; end;
end $$;

-- profesor ajeno: tampoco
select set_config('request.jwt.claims', '{"sub":"ba410000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ba410000-0000-4000-8000-000000000002', true);
do $$ begin
  if (select count(*) from public.exercise_bank_meta) <> 0 then raise exception 'FALLO: un profesor ajeno lee el banco'; end if;
  begin perform * from public.banco_rendimiento('ba410000-0000-4000-8000-000000000021'); raise exception 'FALLO: un profesor ajeno consulta el rendimiento';
  exception when insufficient_privilege then null; end;
end $$;

-- profesor de la sección A: ve el banco y el rendimiento SOLO de sus estudiantes, agregado
select set_config('request.jwt.claims', '{"sub":"ba410000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ba410000-0000-4000-8000-000000000001', true);
do $$ declare r record; begin
  if (select count(*) from public.exercise_bank_meta where course_id = 'ba410000-0000-4000-8000-000000000021') <> 2 then raise exception 'FALLO: el profesor no ve el banco'; end if;
  select * into r from public.banco_rendimiento('ba410000-0000-4000-8000-000000000021') where exercise_id = 'ba410000-0000-4000-8000-0000000000e4';
  if r.respuestas <> 1 or r.correctas <> 0 or r.primer_intento <> 0 or (r.errores ->> 'common_error')::int <> 1 then
    raise exception 'FALLO: rendimiento del profesor de sección: %', row_to_json(r); end if;
  if exists (select 1 from public.banco_rendimiento('ba410000-0000-4000-8000-000000000021') where exercise_id = 'ba410000-0000-4000-8000-0000000000e9') then
    raise exception 'FALLO: el rendimiento incluye ejercicios que no son del banco'; end if;
end $$;
reset role;

select 'banco_ejercicios.sql: PRUEBAS PASARON' as resultado;
rollback;
