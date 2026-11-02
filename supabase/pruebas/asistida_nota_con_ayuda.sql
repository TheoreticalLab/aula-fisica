-- Pruebas: práctica asistida, la corrección con ayuda no vale lo mismo que acertar solo (migración 58). Se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de580000-0000-4000-8000-000000000001', 'an1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-nota-asis","aula_role":"teacher"}', '{}', now(), now()),
  ('de580000-0000-4000-8000-000000000002', 'an2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-nota-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('de580000-0000-4000-8000-000000000011', 'an11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-nota-1"}', '{}', now(), now()),
  ('de580000-0000-4000-8000-000000000012', 'an12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-nota-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de580000-%';
update public.profiles set role = 'teacher' where id in ('de580000-0000-4000-8000-000000000001', 'de580000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de580000-0000-4000-8000-000000000021', 'Curso nota asistida');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points) values
  ('de580000-0000-4000-8000-0000000000e1', 'de580000-0000-4000-8000-000000000021', 'na-1', 'numerica', 'intermedio', 'bank', 'numeric', 'Pregunta', 1);
insert into public.exercise_keys (exercise_id, answer, explanation) values ('de580000-0000-4000-8000-0000000000e1', '{"format":"numeric","value":"2 m"}', '');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de580000-0000-4000-8000-000000000031', 'de580000-0000-4000-8000-000000000021', 'Sección nota', 'NOTAAS01', 'de580000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de580000-0000-4000-8000-000000000031', 'de580000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de580000-0000-4000-8000-000000000031', 'de580000-0000-4000-8000-000000000011'), ('de580000-0000-4000-8000-000000000031', 'de580000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de580000-0000-4000-8000-0000000000a1', 'de580000-0000-4000-8000-000000000031', 'Asistida', 'practice', true, 'after_submit', false, 2);
insert into public.activity_items (activity_id, exercise_id, position) values ('de580000-0000-4000-8000-0000000000a1', 'de580000-0000-4000-8000-0000000000e1', 1);
-- práctica asistida «existente» (con la regla anterior): se simula fijando los valores antiguos
insert into public.assisted_settings (activity_id, nota_primer_intento, factor_ayuda, factor_declarada) values ('de580000-0000-4000-8000-0000000000a1', 'participacion', 1, 1);

-- intentos: E1 falla, consulta con IA y corrige bien; E2 acierta solo
insert into public.attempts (id, user_id, course_id, activity_id, mode) values
  ('de580000-0000-4000-8000-0000000000b1', 'de580000-0000-4000-8000-000000000011', 'de580000-0000-4000-8000-000000000021', 'de580000-0000-4000-8000-0000000000a1', 'practice'),
  ('de580000-0000-4000-8000-0000000000b2', 'de580000-0000-4000-8000-000000000012', 'de580000-0000-4000-8000-000000000021', 'de580000-0000-4000-8000-0000000000a1', 'practice');
insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, client_id, answer, declaracion, status, credit) values
  ('de580000-0000-4000-8000-0000000000b1', 'de580000-0000-4000-8000-0000000000e1', 'de580000-0000-4000-8000-000000000011', 'inicial', gen_random_uuid(), '{"text":"5 m"}', 'consulto_ayuda', 'incorrect', 0),
  ('de580000-0000-4000-8000-0000000000b2', 'de580000-0000-4000-8000-0000000000e1', 'de580000-0000-4000-8000-000000000012', 'inicial', gen_random_uuid(), '{"text":"2 m"}', 'autonomo', 'correct', 1);
insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, client_id, answer, status, credit) values
  ('de580000-0000-4000-8000-0000000000b1', 'de580000-0000-4000-8000-0000000000e1', 'de580000-0000-4000-8000-000000000011', 'corregida', gen_random_uuid(), '{"text":"2 m"}', 'correct', 1),
  ('de580000-0000-4000-8000-0000000000b2', 'de580000-0000-4000-8000-0000000000e1', 'de580000-0000-4000-8000-000000000012', 'corregida', gen_random_uuid(), '{"text":"2 m"}', 'correct', 1);
insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, client_id, reflexion) values
  ('de580000-0000-4000-8000-0000000000b1', 'de580000-0000-4000-8000-0000000000e1', 'de580000-0000-4000-8000-000000000011', 'reflexion', gen_random_uuid(), '{"que_aprendi":"Que el desplazamiento se calcula con la velocidad final."}'),
  ('de580000-0000-4000-8000-0000000000b2', 'de580000-0000-4000-8000-0000000000e1', 'de580000-0000-4000-8000-000000000012', 'reflexion', gen_random_uuid(), '{"que_aprendi":"Confirmé el método con la conservación de la energía."}');

do $$ begin
  -- regla anterior: los dos sacan 100 % (el defecto que se corrige)
  if (public.asistida_credito('de580000-0000-4000-8000-0000000000b1', 'de580000-0000-4000-8000-0000000000e1') ->> 'credito')::numeric <> 1 then raise exception 'FALLO: la regla anterior debía dar 1 a E1'; end if;
  if has_function_privilege('authenticated', 'public.asistida_credito(uuid, uuid)', 'execute') then raise exception 'FALLO: asistida_credito expuesta'; end if;
end $$;

-- un profesor ajeno no puede cambiar la regla
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de580000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de580000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.asistida_nota_guardar('de580000-0000-4000-8000-0000000000a1', 'acierto', 0.5, true); raise exception 'FALLO: profesor ajeno cambió la regla';
  exception when insufficient_privilege then null; end;
end $$;
-- el profesor de la sección aplica la regla nueva y recalcula
select set_config('request.jwt.claims', '{"sub":"de580000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de580000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.asistida_nota_guardar('de580000-0000-4000-8000-0000000000a1', 'acierto', 1.5, false); raise exception 'FALLO: factor 1,5 aceptado';
  exception when invalid_parameter_value then null; end;
  r := public.asistida_nota_guardar('de580000-0000-4000-8000-0000000000a1', 'acierto', 0.5, true);
  if (r ->> 'recalculados')::int <> 2 or r -> 'config' ->> 'nota_primer_intento' <> 'acierto' then raise exception 'FALLO: guardar/recalcular %', r; end if;
end $$;
reset role;

do $$ declare c1 numeric; c2 numeric; s1 numeric; s2 numeric; begin
  -- E1 (falló y corrigió con ayuda): (20·0 + 30·0,5·1 + 20·1) / 70 = 0,5   ·   E2 (acertó solo): (20 + 30 + 20) / 70 = 1
  c1 := (public.asistida_credito('de580000-0000-4000-8000-0000000000b1', 'de580000-0000-4000-8000-0000000000e1') ->> 'credito')::numeric;
  c2 := (public.asistida_credito('de580000-0000-4000-8000-0000000000b2', 'de580000-0000-4000-8000-0000000000e1') ->> 'credito')::numeric;
  if c1 <> 0.5 or c2 <> 1 then raise exception 'FALLO: créditos con la regla nueva % / % (esperados 0,5 / 1)', c1, c2; end if;
  -- el recálculo llegó a las respuestas y a la nota del intento
  select auto_credit into s1 from public.responses where attempt_id = 'de580000-0000-4000-8000-0000000000b1';
  select score into s2 from public.attempts where id = 'de580000-0000-4000-8000-0000000000b1';
  if s1 <> 0.5 or s2 <> 0.5 then raise exception 'FALLO: respuesta/nota recalculadas % / %', s1, s2; end if;
  -- una calificación manual del profesor prevalece sobre el recálculo
  update public.responses set manual_credit = 0.8 where attempt_id = 'de580000-0000-4000-8000-0000000000b1';
  perform public.asistida_actualizar_respuesta('de580000-0000-4000-8000-0000000000b1', 'de580000-0000-4000-8000-0000000000e1');
  if (select score from public.attempts where id = 'de580000-0000-4000-8000-0000000000b1') <> 0.8 then raise exception 'FALLO: la nota manual no prevaleció'; end if;
  -- las prácticas asistidas nuevas nacen con la regla corregida
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'assisted_settings' and column_name = 'nota_primer_intento') not like '%acierto%' then
    raise exception 'FALLO: el valor por defecto para prácticas nuevas'; end if;
end $$;

select 'asistida_nota_con_ayuda.sql: PRUEBAS PASARON' as resultado;
rollback;
