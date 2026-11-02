-- Pruebas: política de Práctica de Control para prácticas YA ENTREGADAS, con aviso previo al control (migración 63).
-- R1 y R2 entregaron hace 10 días. El profesor anuncia hoy «también entregas anteriores» con 24 h de antelación.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de630000-0000-4000-8000-000000000001', 'pr1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-retro","aula_role":"teacher"}', '{}', now(), now()),
  ('de630000-0000-4000-8000-000000000011', 'pr11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-retro-1"}', '{}', now(), now()),
  ('de630000-0000-4000-8000-000000000012', 'pr12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-retro-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de630000-%';
update public.profiles set role = 'teacher' where id = 'de630000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de630000-0000-4000-8000-000000000021', 'Curso retro');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points, concepts, published) values
  ('de630000-0000-4000-8000-0000000000e1', 'de630000-0000-4000-8000-000000000021', 'rt-original', 'numerica', 'intermedio', 'practice', 'numeric', 'Original', 1, '{energia}', true),
  ('de630000-0000-4000-8000-0000000000e2', 'de630000-0000-4000-8000-000000000021', 'rt-original-2', 'numerica', 'intermedio', 'practice', 'numeric', 'Original 2', 1, '{energia}', true),
  ('de630000-0000-4000-8000-0000000000b1', 'de630000-0000-4000-8000-000000000021', 'rt-banco', 'numerica', 'basico', 'bank', 'numeric', 'Transferencia', 1, '{energia}', true);
insert into public.exercise_keys (exercise_id, answer, explanation) values
  ('de630000-0000-4000-8000-0000000000e1', '{"format":"numeric","value":"12 J"}', 's'), ('de630000-0000-4000-8000-0000000000e2', '{"format":"numeric","value":"2 J"}', 's'),
  ('de630000-0000-4000-8000-0000000000b1', '{"format":"numeric","value":"5 J"}', 's');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de630000-0000-4000-8000-000000000031', 'de630000-0000-4000-8000-000000000021', 'Sección retro', 'RETROA01', 'de630000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de630000-0000-4000-8000-000000000031', 'de630000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de630000-0000-4000-8000-000000000031', 'de630000-0000-4000-8000-000000000011'), ('de630000-0000-4000-8000-000000000031', 'de630000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de630000-0000-4000-8000-0000000000a1', 'de630000-0000-4000-8000-000000000031', 'Práctica 1', 'practice', true, 'after_submit', false, 2),
  ('de630000-0000-4000-8000-0000000000a2', 'de630000-0000-4000-8000-000000000031', 'Práctica 2', 'practice', true, 'after_submit', false, 2);
insert into public.activity_items (activity_id, exercise_id, position) values
  ('de630000-0000-4000-8000-0000000000a1', 'de630000-0000-4000-8000-0000000000e1', 1), ('de630000-0000-4000-8000-0000000000a2', 'de630000-0000-4000-8000-0000000000e2', 1);
-- prácticas anteriores a la migración 65 (sin la política por defecto)
delete from public.control_policies where activity_id in ('de630000-0000-4000-8000-0000000000a1', 'de630000-0000-4000-8000-0000000000a2');
insert into public.attempts (user_id, course_id, activity_id, mode, status, score, max_score, started_at, submitted_at) values
  ('de630000-0000-4000-8000-000000000011', 'de630000-0000-4000-8000-000000000021', 'de630000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 0.8, 1, now() - interval '10 days', now() - interval '10 days'),
  ('de630000-0000-4000-8000-000000000012', 'de630000-0000-4000-8000-000000000021', 'de630000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 0.9, 1, now() - interval '10 days', now() - interval '10 days'),
  ('de630000-0000-4000-8000-000000000011', 'de630000-0000-4000-8000-000000000021', 'de630000-0000-4000-8000-0000000000a2', 'practice', 'submitted', 1, 1, now() - interval '4 days', now() - interval '4 days');

-- 1) anuncio retroactivo con 24 h de antelación y aviso fijado en la sección
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de630000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de630000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.control_politica_anunciar('de630000-0000-4000-8000-0000000000a1', 0.2, 5, '', '', 'siempre', 24, true); raise exception 'FALLO: alcance inválido';
  exception when invalid_parameter_value then null; end;
  r := public.control_politica_anunciar('de630000-0000-4000-8000-0000000000a1', 0.2, 5, 'Traigan calculadora.', '', 'todas', 24, true);
  if r ->> 'alcance' <> 'todas' or (r ->> 'entregas_previas')::int <> 2 or r ->> 'aviso_id' is null then raise exception 'FALLO: anuncio %', r; end if;
  if (select p ->> 'alcance' from jsonb_array_elements(public.control_practicas('de630000-0000-4000-8000-000000000031')) x, lateral (select x -> 'politica' p) y
      where x ->> 'id' = 'de630000-0000-4000-8000-0000000000a1') <> 'todas' then raise exception 'FALLO: selector sin alcance'; end if;
  -- control HOY: menos de 24 h desde el anuncio → solo diagnóstico
  r := public.control_preparar('de630000-0000-4000-8000-0000000000a1', null, 5, 'c6300000-0000-4000-8000-000000000001');
  perform set_config('prueba.s1', r -> 'session' ->> 'id', true);
  perform set_config('prueba.c1', r -> 'session' ->> 'control_activity_id', true);
  r := public.control_iniciar(current_setting('prueba.s1')::uuid);
  if exists (select 1 from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'politica_aplicable' is not null) then raise exception 'FALLO: aplica antes de la antelación'; end if;
end $$;
-- el estudiante ve el aviso fijado y el aviso de la práctica con la fecha efectiva
select set_config('request.jwt.claims', '{"sub":"de630000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de630000-0000-4000-8000-000000000011', true);
do $$ declare a jsonb; begin
  if not exists (select 1 from jsonb_array_elements(public.my_announcements()) x where x ->> 'title' like 'Práctica de Control%' and (x ->> 'pinned')::boolean) then raise exception 'FALLO: aviso en la sección'; end if;
  a := public.control_aviso('de630000-0000-4000-8000-0000000000a1');
  if a ->> 'alcance' <> 'todas' or a ->> 'efectiva_desde' is null then raise exception 'FALLO: aviso de la práctica %', a; end if;
  perform set_config('prueba.t1', public.start_activity_attempt(current_setting('prueba.c1')::uuid)::text, true);
end $$;
reset role;
update public.responses set auto_credit = 0.5, status = 'partial' where attempt_id = current_setting('prueba.t1')::uuid;
update public.attempts set status = 'submitted', submitted_at = now() where id = current_setting('prueba.t1')::uuid;
select public.recompute_attempt(current_setting('prueba.t1')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de630000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de630000-0000-4000-8000-000000000001', true);
select public.control_cerrar(current_setting('prueba.s1')::uuid) is not null;
select public.control_confirmar(current_setting('prueba.s1')::uuid) is not null;
reset role;
do $$ begin
  if public.control_factor('de630000-0000-4000-8000-0000000000a1', 'de630000-0000-4000-8000-000000000011') <> 1 then raise exception 'FALLO: ajustó sin la antelación anunciada'; end if;
  if public.control_resultado('de630000-0000-4000-8000-0000000000a1', 'de630000-0000-4000-8000-000000000011') <> 0.5 then raise exception 'FALLO: resultado diagnóstico'; end if;
end $$;

-- 2) el mismo control, pero hecho después de la antelación (simulado: anuncio hace 2 días, control hace 1 hora) → ajusta
update public.control_policies set announced_at = now() - interval '2 days' where activity_id = 'de630000-0000-4000-8000-0000000000a1';
update public.control_sessions set iniciado_at = now() - interval '1 hour' where id = current_setting('prueba.s1')::uuid;
do $$ begin
  -- R1 entregó hace 10 días (antes del anuncio) y aun así se aplica: 80 × [1 − 0,2 × 0,5] = 72
  if public.control_factor('de630000-0000-4000-8000-0000000000a1', 'de630000-0000-4000-8000-000000000011') <> 0.9 then
    raise exception 'FALLO: retroactiva no aplicada %', public.control_factor('de630000-0000-4000-8000-0000000000a1', 'de630000-0000-4000-8000-000000000011'); end if;
end $$;

-- 3) retirar la política: el control ya hecho conserva su regla; uno posterior ya no ajusta
set local role authenticated;
do $$ declare r jsonb; begin
  perform public.control_politica_retirar('de630000-0000-4000-8000-0000000000a1');
  r := public.control_preparar('de630000-0000-4000-8000-0000000000a1', null, 5, 'c6300000-0000-4000-8000-000000000002');
  perform set_config('prueba.s2', r -> 'session' ->> 'id', true);
  perform set_config('prueba.c2', r -> 'session' ->> 'control_activity_id', true);
  r := public.control_iniciar(current_setting('prueba.s2')::uuid);
end $$;
select set_config('request.jwt.claims', '{"sub":"de630000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de630000-0000-4000-8000-000000000012', true);
select set_config('prueba.t2', public.start_activity_attempt(current_setting('prueba.c2')::uuid)::text, true);
reset role;
update public.responses set auto_credit = 0, status = 'incorrect' where attempt_id = current_setting('prueba.t2')::uuid;
update public.attempts set status = 'submitted', submitted_at = now() where id = current_setting('prueba.t2')::uuid;
select public.recompute_attempt(current_setting('prueba.t2')::uuid);
update public.control_sessions set iniciado_at = now() + interval '1 minute' where id = current_setting('prueba.s2')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de630000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de630000-0000-4000-8000-000000000001', true);
select public.control_cerrar(current_setting('prueba.s2')::uuid) is not null;
select public.control_confirmar(current_setting('prueba.s2')::uuid) is not null;
reset role;
do $$ begin
  if public.control_factor('de630000-0000-4000-8000-0000000000a1', 'de630000-0000-4000-8000-000000000011') <> 0.9 then raise exception 'FALLO: el retiro cambió un control ya hecho'; end if;
  if public.control_factor('de630000-0000-4000-8000-0000000000a1', 'de630000-0000-4000-8000-000000000012') <> 1 then raise exception 'FALLO: aplicó una política retirada'; end if;
  -- Registro: el estudiante con control conserva 80 como original y cuenta 72
  if (select score from public.attempts where activity_id = 'de630000-0000-4000-8000-0000000000a1' and user_id = 'de630000-0000-4000-8000-000000000011' and mode = 'practice') <> 0.8 then
    raise exception 'FALLO: nota original modificada'; end if;
end $$;

-- 4) corrección del defecto de la 62: una versión nueva NO anula la anterior para quien entregó bajo ella
insert into public.control_policies (activity_id, version, w, duracion_min, alcance, activa, announced_at) values
  ('de630000-0000-4000-8000-0000000000a2', 1, 0.20, 5, 'nuevas', false, now() - interval '5 days'),
  ('de630000-0000-4000-8000-0000000000a2', 2, 0.30, 5, 'nuevas', true, now() - interval '1 day');
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.control_preparar('de630000-0000-4000-8000-0000000000a2', null, 5, 'c6300000-0000-4000-8000-000000000003');
  perform set_config('prueba.s3', r -> 'session' ->> 'id', true);
  perform set_config('prueba.c3', r -> 'session' ->> 'control_activity_id', true);
  r := public.control_iniciar(current_setting('prueba.s3')::uuid);
end $$;
select set_config('request.jwt.claims', '{"sub":"de630000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de630000-0000-4000-8000-000000000011', true);
select set_config('prueba.t3', public.start_activity_attempt(current_setting('prueba.c3')::uuid)::text, true);
reset role;
update public.responses set auto_credit = 0, status = 'incorrect' where attempt_id = current_setting('prueba.t3')::uuid;
update public.attempts set status = 'submitted', submitted_at = now() where id = current_setting('prueba.t3')::uuid;
select public.recompute_attempt(current_setting('prueba.t3')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de630000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de630000-0000-4000-8000-000000000001', true);
select public.control_cerrar(current_setting('prueba.s3')::uuid) is not null;
select public.control_confirmar(current_setting('prueba.s3')::uuid) is not null;
reset role;
do $$ begin
  -- entregó hace 4 días: rige la v1 (20 %), no la v2 (30 %) ni ninguna (100 %)
  if public.control_factor('de630000-0000-4000-8000-0000000000a2', 'de630000-0000-4000-8000-000000000011') <> 0.8 then
    raise exception 'FALLO: versión aplicable %', public.control_factor('de630000-0000-4000-8000-0000000000a2', 'de630000-0000-4000-8000-000000000011'); end if;
  if has_function_privilege('authenticated', 'public.control_mejor(uuid, uuid)', 'execute') then raise exception 'FALLO: permisos'; end if;
end $$;

select 'practicas_de_control_retro.sql: PRUEBAS PASARON' as resultado;
rollback;
