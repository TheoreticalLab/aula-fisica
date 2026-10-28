-- Pruebas: LIEIA (migración 27): instrumentación, datos minimizados, autorización y auditoría. Datos sintéticos.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('da000000-0000-4000-8000-000000000001', 'la@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-lieia","aula_role":"teacher"}', '{}', now(), now()),
  ('da000000-0000-4000-8000-000000000002', 'lb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-lieia-b","aula_role":"teacher"}', '{}', now(), now()),
  ('da000000-0000-4000-8000-000000000011', 'l1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lieia-1"}', '{}', now(), now()),
  ('da000000-0000-4000-8000-000000000012', 'l2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lieia-2"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'da000000-%';
update public.profiles set role = 'teacher' where id in ('da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000002');
update public.profiles set full_name = 'Nombre Secreto Uno' where id = 'da000000-0000-4000-8000-000000000011';
update public.profiles set full_name = 'Nombre Secreto Dos' where id = 'da000000-0000-4000-8000-000000000012';
insert into public.courses (id, title) values ('da000000-0000-4000-8000-000000000021', 'Curso LIEIA');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options) values
  ('da000000-0000-4000-8000-0000000000e1', 'da000000-0000-4000-8000-000000000021', 'lieia-e1', 'seleccion', 'basico', 'bank', 'choice', '¿Cuál?', '["a","b","c","d"]'),
  ('da000000-0000-4000-8000-0000000000e2', 'da000000-0000-4000-8000-000000000021', 'lieia-e2', 'numerica', 'basico', 'bank', 'numeric', '¿Cuánto?', null),
  ('da000000-0000-4000-8000-0000000000e3', 'da000000-0000-4000-8000-000000000021', 'lieia-e3', 'numerica', 'basico', 'bank', 'numeric', '¿Y esto?', null);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('da000000-0000-4000-8000-000000000031', 'da000000-0000-4000-8000-000000000021', 'Sección LIEIA', 'LIEIA001', 'da000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('da000000-0000-4000-8000-000000000031', 'da000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('da000000-0000-4000-8000-000000000031', 'da000000-0000-4000-8000-000000000011'),
  ('da000000-0000-4000-8000-000000000031', 'da000000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('da000000-0000-4000-8000-0000000000a1', 'da000000-0000-4000-8000-000000000031', 'Parcial LIEIA', 'exam', true, 'after_submit', false);
insert into public.activity_items (activity_id, exercise_id, position) values
  ('da000000-0000-4000-8000-0000000000a1', 'da000000-0000-4000-8000-0000000000e1', 1),
  ('da000000-0000-4000-8000-0000000000a1', 'da000000-0000-4000-8000-0000000000e2', 2),
  ('da000000-0000-4000-8000-0000000000a1', 'da000000-0000-4000-8000-0000000000e3', 3);
insert into public.attempts (id, user_id, course_id, activity_id, mode, status) values
  ('da000000-0000-4000-8000-0000000000f1', 'da000000-0000-4000-8000-000000000011', 'da000000-0000-4000-8000-000000000021', 'da000000-0000-4000-8000-0000000000a1', 'exam', 'in_progress'),
  ('da000000-0000-4000-8000-0000000000f2', 'da000000-0000-4000-8000-000000000012', 'da000000-0000-4000-8000-000000000021', 'da000000-0000-4000-8000-0000000000a1', 'exam', 'in_progress');

set local role authenticated;
-- 1) los estudiantes responden con el mecanismo real (save_response): cada cambio queda registrado
select set_config('request.jwt.claims', '{"sub":"da000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000011', true);
select public.save_response('da000000-0000-4000-8000-0000000000f1', 'da000000-0000-4000-8000-0000000000e1', '{"selected":[0]}');
select public.save_response('da000000-0000-4000-8000-0000000000f1', 'da000000-0000-4000-8000-0000000000e1', '{"selected":[2]}');
select public.save_response('da000000-0000-4000-8000-0000000000f1', 'da000000-0000-4000-8000-0000000000e1', '{"selected":[2]}'); -- sin cambio: no registra
select public.save_response('da000000-0000-4000-8000-0000000000f1', 'da000000-0000-4000-8000-0000000000e2', '{"text":" 2.5 m/s"}');
do $$ begin
  begin perform 1 from public.exam_item_events; raise exception 'FALLO: un estudiante leyó la instrumentación'; exception when insufficient_privilege then null; end;
  begin perform public.lieia_exam_data('da000000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: un estudiante consultó el análisis'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"da000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000012', true);
select public.save_response('da000000-0000-4000-8000-0000000000f2', 'da000000-0000-4000-8000-0000000000e1', '{"selected":[2]}');
select public.save_response('da000000-0000-4000-8000-0000000000f2', 'da000000-0000-4000-8000-0000000000e2', '{"text":"2.5m/S"}');  -- misma respuesta, otro formato
select public.save_response('da000000-0000-4000-8000-0000000000f2', 'da000000-0000-4000-8000-0000000000e3', '{"text":"   "}');     -- en blanco

reset role;
do $$ begin
  if (select count(*) from public.exam_item_events where attempt_id = 'da000000-0000-4000-8000-0000000000f1' and exercise_id = 'da000000-0000-4000-8000-0000000000e1') <> 2 then
    raise exception 'FALLO: la instrumentación no registró exactamente los 2 cambios de respuesta';
  end if;
  if public.lieia_ficha('{"text":" 2.5 m/s"}') <> public.lieia_ficha('{"text":"2.5m/S"}') then raise exception 'FALLO: normalización de la ficha'; end if;
  if public.lieia_ficha('{"text":"   "}') is not null or public.lieia_ficha('{}') is not null or public.lieia_ficha('{"selected":[]}') is not null then raise exception 'FALLO: respuesta en blanco'; end if;
end $$;
-- se entregan y califican (como lo haría la Edge Function)
update public.attempts set status = 'submitted', submitted_at = now() where id in ('da000000-0000-4000-8000-0000000000f1', 'da000000-0000-4000-8000-0000000000f2');
update public.responses set status = 'incorrect' where attempt_id in ('da000000-0000-4000-8000-0000000000f1', 'da000000-0000-4000-8000-0000000000f2');

set local role authenticated;
-- 2) un profesor ajeno no puede
select set_config('request.jwt.claims', '{"sub":"da000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.lieia_exam_data('da000000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: un profesor ajeno consultó'; exception when insufficient_privilege then null; end;
  begin perform * from public.lieia_reveal('da000000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: un profesor ajeno reveló nombres'; exception when insufficient_privilege then null; end;
end $$;

-- 3) el profesor de la sección: datos minimizados y correctos
select set_config('request.jwt.claims', '{"sub":"da000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000001', true);
do $$
declare d jsonb; e1 jsonb; e2 jsonb; x record;
begin
  select * into x from public.lieia_activities('da000000-0000-4000-8000-000000000031');
  if x.entregados <> 2 or x.con_tiempos <> 2 or x.items <> 3 then raise exception 'FALLO: lista de actividades (%)', x; end if;
  d := public.lieia_exam_data('da000000-0000-4000-8000-0000000000a1');
  if jsonb_array_length(d -> 'estudiantes') <> 2 or jsonb_array_length(d -> 'items') <> 3 or not (d ->> 'con_tiempos')::boolean then raise exception 'FALLO: estructura'; end if;
  -- minimización: ni nombres, ni identificadores de usuario, ni el contenido de las respuestas
  if d::text like '%Nombre Secreto%' or d::text like '%da000000-0000-4000-8000-00000000001%' or d::text like '%m/s%' or d::text ilike '%selected%' then raise exception 'FALLO: datos no minimizados'; end if;
  select s into e1 from jsonb_array_elements(d -> 'estudiantes') s where jsonb_array_length(s -> 'respuestas') = 2;
  select s into e2 from jsonb_array_elements(d -> 'estudiantes') s where jsonb_array_length(s -> 'respuestas') = 3;
  -- misma respuesta (aunque escrita distinto) → misma ficha; en blanco → sin ficha; cambios y tiempos registrados
  if (select r ->> 'ficha' from jsonb_array_elements(e1 -> 'respuestas') r where r ->> 'exercise_id' = 'da000000-0000-4000-8000-0000000000e2')
     <> (select r ->> 'ficha' from jsonb_array_elements(e2 -> 'respuestas') r where r ->> 'exercise_id' = 'da000000-0000-4000-8000-0000000000e2') then
    raise exception 'FALLO: fichas de respuestas iguales';
  end if;
  if (select r ->> 'ficha' from jsonb_array_elements(e2 -> 'respuestas') r where r ->> 'exercise_id' = 'da000000-0000-4000-8000-0000000000e3') is not null then raise exception 'FALLO: blanco con ficha'; end if;
  if (select (r ->> 'cambios')::int from jsonb_array_elements(e1 -> 'respuestas') r where r ->> 'exercise_id' = 'da000000-0000-4000-8000-0000000000e1') <> 2
     or (select r ->> 'primera' from jsonb_array_elements(e1 -> 'respuestas') r where r ->> 'exercise_id' = 'da000000-0000-4000-8000-0000000000e1') is null then
    raise exception 'FALLO: cambios o tiempos';
  end if;
  if (select count(*) from public.lieia_reveal('da000000-0000-4000-8000-0000000000a1') where full_name like 'Nombre Secreto%') <> 2 then raise exception 'FALLO: revelar nombres'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.lieia_audit where activity_id = 'da000000-0000-4000-8000-0000000000a1') <> 2 then raise exception 'FALLO: auditoría (consulta + revelación)'; end if;
  -- práctica libre de una lección (sin actividad): no se instrumenta
  if exists (select 1 from public.exam_item_events e join public.attempts t on t.id = e.attempt_id where t.activity_id is null) then raise exception 'FALLO: instrumentó fuera de actividades'; end if;
end $$;
select 'PRUEBAS DE LIEIA PASARON' as resultado;
rollback;
