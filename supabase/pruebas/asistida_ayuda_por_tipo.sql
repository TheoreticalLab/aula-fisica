-- Pruebas: el primer intento con ayuda declarada vale según el TIPO de ayuda (migración 61). Se deshace al final.
-- Pesos 20/30/20, regla por acierto, todos aciertan el primer intento y explican.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de610000-0000-4000-8000-000000000001', 'at1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-tipo-ayuda","aula_role":"teacher"}', '{}', now(), now()),
  ('de610000-0000-4000-8000-000000000011', 'at11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tipo-ia"}', '{}', now(), now()),
  ('de610000-0000-4000-8000-000000000012', 'at12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tipo-varias"}', '{}', now(), now()),
  ('de610000-0000-4000-8000-000000000013', 'at13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tipo-libro"}', '{}', now(), now()),
  ('de610000-0000-4000-8000-000000000014', 'at14@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tipo-sin"}', '{}', now(), now()),
  ('de610000-0000-4000-8000-000000000015', 'at15@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tipo-servidor"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de610000-%';
update public.profiles set role = 'teacher' where id = 'de610000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de610000-0000-4000-8000-000000000021', 'Curso tipo de ayuda');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points) values
  ('de610000-0000-4000-8000-0000000000e1', 'de610000-0000-4000-8000-000000000021', 'ta-1', 'numerica', 'intermedio', 'bank', 'numeric', 'Energía', 1);
insert into public.exercise_keys (exercise_id, answer, explanation) values ('de610000-0000-4000-8000-0000000000e1', '{"format":"numeric","value":"12 J"}', '');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de610000-0000-4000-8000-000000000031', 'de610000-0000-4000-8000-000000000021', 'Sección tipo', 'TIPOAY01', 'de610000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de610000-0000-4000-8000-000000000031', 'de610000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('de610000-0000-4000-8000-000000000031', 'de610000-0000-4000-8000-000000000015');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de610000-0000-4000-8000-0000000000a1', 'de610000-0000-4000-8000-000000000031', 'Asistida', 'practice', true, 'after_submit', false, 2);
insert into public.activity_items (activity_id, exercise_id, position) values ('de610000-0000-4000-8000-0000000000a1', 'de610000-0000-4000-8000-0000000000e1', 1);
-- práctica NUEVA: nace con los valores por tipo y 50 % sin tipo
insert into public.assisted_settings (activity_id) values ('de610000-0000-4000-8000-0000000000a1');
insert into public.attempts (id, user_id, course_id, activity_id, mode) values
  ('de610000-0000-4000-8000-0000000000b1', 'de610000-0000-4000-8000-000000000011', 'de610000-0000-4000-8000-000000000021', 'de610000-0000-4000-8000-0000000000a1', 'practice'),
  ('de610000-0000-4000-8000-0000000000b2', 'de610000-0000-4000-8000-000000000012', 'de610000-0000-4000-8000-000000000021', 'de610000-0000-4000-8000-0000000000a1', 'practice'),
  ('de610000-0000-4000-8000-0000000000b3', 'de610000-0000-4000-8000-000000000013', 'de610000-0000-4000-8000-000000000021', 'de610000-0000-4000-8000-0000000000a1', 'practice'),
  ('de610000-0000-4000-8000-0000000000b4', 'de610000-0000-4000-8000-000000000014', 'de610000-0000-4000-8000-000000000021', 'de610000-0000-4000-8000-0000000000a1', 'practice');
insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, client_id, answer, declaracion, fuentes, status, credit, reflexion)
  select b, 'de610000-0000-4000-8000-0000000000e1', u, f.fase, gen_random_uuid(),
         case when f.fase = 'reflexion' then null else '{"text":"12 J"}'::jsonb end, case when f.fase = 'inicial' then 'consulto_ayuda' end,
         case when f.fase = 'inicial' then fu end,
         case when f.fase = 'reflexion' then null else 'correct' end, case when f.fase = 'reflexion' then null else 1 end,
         case when f.fase = 'reflexion' then '{"que_aprendi":"La energía cinética depende del cuadrado de la rapidez."}'::jsonb end
  from (values ('de610000-0000-4000-8000-0000000000b1'::uuid, 'de610000-0000-4000-8000-000000000011'::uuid, array['ia']),
               ('de610000-0000-4000-8000-0000000000b2'::uuid, 'de610000-0000-4000-8000-000000000012'::uuid, array['ia', 'libro']),
               ('de610000-0000-4000-8000-0000000000b3'::uuid, 'de610000-0000-4000-8000-000000000013'::uuid, array['libro']),
               ('de610000-0000-4000-8000-0000000000b4'::uuid, 'de610000-0000-4000-8000-000000000014'::uuid, null::text[])) e(b, u, fu)
  cross join (values ('inicial'), ('corregida'), ('reflexion')) f(fase);

do $$ declare c numeric; k text; esperados jsonb := '{"b1": 0.464, "b2": 0.464, "b3": 0.857, "b4": 0.643}'; begin
  -- IA: (20·0,25 + 30·0,25 + 20)/70 = 0,464 · IA y libro: cuenta la menor (IA) · libro: (16 + 24 + 20)/70 = 0,857
  -- sin tipo (declaración anterior a la migración): factor_declarada 0,5 → 45/70 = 0,643
  foreach k in array array['b1', 'b2', 'b3', 'b4'] loop
    c := (public.asistida_credito(('de610000-0000-4000-8000-0000000000' || k)::uuid, 'de610000-0000-4000-8000-0000000000e1') ->> 'credito')::numeric;
    if c <> (esperados ->> k)::numeric then raise exception 'FALLO: % obtuvo % (esperado %)', k, c, esperados ->> k; end if;
  end loop;
  if (public.asistida_credito('de610000-0000-4000-8000-0000000000b2', 'de610000-0000-4000-8000-0000000000e1') ->> 'factor_aplicado')::numeric <> 0.25 then
    raise exception 'FALLO: factor aplicado con varias ayudas'; end if;
end $$;

-- el servidor guarda los tipos del primer intento (descarta los desconocidos y los que no vienen con «consulté ayuda»)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de610000-0000-4000-8000-000000000015","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de610000-0000-4000-8000-000000000015', true);
select set_config('prueba.t5', public.start_activity_attempt('de610000-0000-4000-8000-0000000000a1')::text, true);
reset role;
set local role service_role;
do $$ begin
  perform public.svc_asistida_registrar('de610000-0000-4000-8000-000000000015', current_setting('prueba.t5')::uuid, 'de610000-0000-4000-8000-0000000000e1', 'inicial',
    '{"answer":{"text":"12 J"},"declaracion":"consulto_ayuda","fuentes":["ia","inventada","ia","video"]}', '{"status":"correct","credit":1,"code":"ok","messages":[]}', 'c6100000-0000-4000-8000-000000000001');
end $$;
reset role;
do $$ begin
  if (select fuentes from public.assisted_steps where client_id = 'c6100000-0000-4000-8000-000000000001') <> array['ia', 'video'] then
    raise exception 'FALLO: tipos guardados %', (select fuentes from public.assisted_steps where client_id = 'c6100000-0000-4000-8000-000000000001'); end if;
end $$;

-- el profesor ajusta: libro 50 % y recalcula; entradas inválidas rechazadas
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de610000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de610000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.asistida_ayuda_guardar('de610000-0000-4000-8000-0000000000a1', 0.5, '{"chatgpt": 0.1}', false); raise exception 'FALLO: tipo desconocido aceptado';
  exception when invalid_parameter_value then null; end;
  begin perform public.asistida_ayuda_guardar('de610000-0000-4000-8000-0000000000a1', 0.5, '{"ia": 1.5}', false); raise exception 'FALLO: valor 1,5 aceptado';
  exception when invalid_parameter_value then null; end;
  r := public.asistida_ayuda_guardar('de610000-0000-4000-8000-0000000000a1', 0.5, '{"ia": 0.25, "libro": 0.5, "apuntes": 0.9, "persona": 0.5, "video": 0.6, "simulador": 0.8}', true);
  if (r ->> 'recalculados')::int < 4 or (r -> 'config' -> 'factores_fuente' ->> 'libro')::numeric <> 0.5 then raise exception 'FALLO: guardar %', r; end if;
end $$;
-- el estudiante ve los valores por tipo antes de declarar
select set_config('request.jwt.claims', '{"sub":"de610000-0000-4000-8000-000000000015","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de610000-0000-4000-8000-000000000015', true);
do $$ begin
  if (public.asistida_estado(current_setting('prueba.t5')::uuid) -> 'config' -> 'regla' -> 'factores_fuente' ->> 'ia')::numeric <> 0.25 then
    raise exception 'FALLO: el estudiante no ve los valores por tipo'; end if;
end $$;
reset role;

do $$ begin
  -- libro al 50 %: 45/70 = 0,643, ya recalculado en la respuesta
  if (select auto_credit from public.responses where attempt_id = 'de610000-0000-4000-8000-0000000000b3') <> 0.643 then
    raise exception 'FALLO: recálculo libro %', (select auto_credit from public.responses where attempt_id = 'de610000-0000-4000-8000-0000000000b3'); end if;
  -- prácticas existentes: sin valores por tipo ('{}') → sin efecto mientras factor_declarada sea 1
  if exists (select 1 from public.assisted_settings s where s.factores_fuente is null) then raise exception 'FALLO: valores nulos'; end if;
  if has_function_privilege('anon', 'public.asistida_ayuda_guardar(uuid, numeric, jsonb, boolean)', 'execute') then raise exception 'FALLO: anon'; end if;
end $$;

select 'asistida_ayuda_por_tipo.sql: PRUEBAS PASARON' as resultado;
rollback;
