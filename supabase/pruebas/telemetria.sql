-- Pruebas: telemetría del proceso de respuesta (migración 29). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('dc000000-0000-4000-8000-000000000001', 'ta@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-tel","aula_role":"teacher"}', '{}', now(), now()),
  ('dc000000-0000-4000-8000-000000000002', 'tb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-tel-b","aula_role":"teacher"}', '{}', now(), now()),
  ('dc000000-0000-4000-8000-000000000011', 't1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tel-1"}', '{}', now(), now()),
  ('dc000000-0000-4000-8000-000000000012', 't2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tel-2"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'dc000000-%';
update public.profiles set role = 'teacher' where id in ('dc000000-0000-4000-8000-000000000001', 'dc000000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('dc000000-0000-4000-8000-000000000021', 'Curso telemetría');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options) values
  ('dc000000-0000-4000-8000-0000000000e1', 'dc000000-0000-4000-8000-000000000021', 'tel-e1', 'seleccion', 'basico', 'bank', 'choice', '¿?', '["a","b"]'),
  ('dc000000-0000-4000-8000-0000000000e2', 'dc000000-0000-4000-8000-000000000021', 'tel-e2', 'numerica', 'basico', 'bank', 'numeric', '¿?', null),
  ('dc000000-0000-4000-8000-0000000000e9', 'dc000000-0000-4000-8000-000000000021', 'tel-e9', 'numerica', 'basico', 'bank', 'numeric', 'ajena', null);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('dc000000-0000-4000-8000-000000000031', 'dc000000-0000-4000-8000-000000000021', 'Sección telemetría', 'TELEME01', 'dc000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('dc000000-0000-4000-8000-000000000031', 'dc000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('dc000000-0000-4000-8000-000000000031', 'dc000000-0000-4000-8000-000000000011'), ('dc000000-0000-4000-8000-000000000031', 'dc000000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('dc000000-0000-4000-8000-0000000000a1', 'dc000000-0000-4000-8000-000000000031', 'Examen telemetría', 'exam', true, 'after_submit', false);
insert into public.activity_items (activity_id, exercise_id, position) values
  ('dc000000-0000-4000-8000-0000000000a1', 'dc000000-0000-4000-8000-0000000000e1', 1), ('dc000000-0000-4000-8000-0000000000a1', 'dc000000-0000-4000-8000-0000000000e2', 2);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dc000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000011', true);
select set_config('prueba.t1', public.start_activity_attempt('dc000000-0000-4000-8000-0000000000a1')::text, true);
do $$
declare a text := current_setting('prueba.t1'); r jsonb; lote jsonb;
begin
  lote := jsonb_build_array(
    jsonb_build_object('session_id', 'dc000000-0000-4000-8000-00000000d001', 'seq', 1, 'attempt_id', a, 'kind', 'sesion_inicio', 't_ms', 0, 'wall', (extract(epoch from now()) * 1000)::bigint, 'data', jsonb_build_object('navegacion', 'navigate')),
    jsonb_build_object('session_id', 'dc000000-0000-4000-8000-00000000d001', 'seq', 2, 'attempt_id', a, 'kind', 'pregunta_vista', 'exercise_id', 'dc000000-0000-4000-8000-0000000000e1', 't_ms', 1200, 'data', jsonb_build_object('visible', true, 'n', 1)),
    jsonb_build_object('session_id', 'dc000000-0000-4000-8000-00000000d001', 'seq', 3, 'attempt_id', a, 'kind', 'respuesta_cambio', 'exercise_id', 'dc000000-0000-4000-8000-0000000000e1', 't_ms', 9000,
      'data', jsonb_build_object('h', 'abcd1234', 'len', 1, 'delta', 1, 'primera', true, 'rafaga_ms', 0, 'texto', 'NO DEBE GUARDARSE', 'teclas', '[1,2,3]')));
  r := public.telemetry_ingest(lote);
  if (r ->> 'aceptados')::int <> 3 then raise exception 'FALLO: ingesta (%)', r; end if;
  -- reenviar el mismo lote (respuesta perdida, recarga): no duplica
  r := public.telemetry_ingest(lote);
  if (r ->> 'aceptados')::int <> 0 or (r ->> 'duplicados')::int <> 3 then raise exception 'FALLO: deduplicación (%)', r; end if;
  -- rechazos: tipo no permitido, pregunta ajena al intento, evento mal formado; el resto del lote sí entra
  r := public.telemetry_ingest(jsonb_build_array(
    jsonb_build_object('session_id', 'dc000000-0000-4000-8000-00000000d001', 'seq', 4, 'attempt_id', a, 'kind', 'captura_pantalla', 't_ms', 10),
    jsonb_build_object('session_id', 'dc000000-0000-4000-8000-00000000d001', 'seq', 5, 'attempt_id', a, 'kind', 'pregunta_vista', 'exercise_id', 'dc000000-0000-4000-8000-0000000000e9', 't_ms', 10),
    jsonb_build_object('session_id', 'no-es-uuid', 'seq', 6, 'attempt_id', a, 'kind', 'salida', 't_ms', 10),
    jsonb_build_object('session_id', 'dc000000-0000-4000-8000-00000000d002', 'seq', 1, 'attempt_id', a, 'kind', 'sesion_inicio', 't_ms', 0, 'wall', 1000, 'data', jsonb_build_object('navegacion', 'reload'))));
  if (r ->> 'aceptados')::int <> 1 or (r ->> 'rechazados')::int <> 3 then raise exception 'FALLO: validación de la ingesta (%)', r; end if;
  begin perform public.telemetry_ingest((select jsonb_agg(jsonb_build_object('seq', g)) from generate_series(1, 201) g)); raise exception 'FALLO: aceptó un lote de 201';
  exception when invalid_parameter_value then null; end;
  -- transparencia: el estudiante ve qué se registró
  r := public.my_telemetry_summary(a::uuid);
  if (r ->> 'eventos')::int <> 4 or (r ->> 'sesiones')::int <> 2 then raise exception 'FALLO: resumen para el estudiante (%)', r; end if;
  begin perform public.telemetry_attempt(a::uuid); raise exception 'FALLO: un estudiante leyó la telemetría detallada'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.telemetry_events; raise exception 'FALLO: leyó la tabla'; exception when insufficient_privilege then null; end;
end $$;

-- otro estudiante no puede escribir en un intento ajeno
select set_config('request.jwt.claims', '{"sub":"dc000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000012', true);
do $$
declare r jsonb;
begin
  r := public.telemetry_ingest(jsonb_build_array(jsonb_build_object('session_id', 'dc000000-0000-4000-8000-00000000d099', 'seq', 1, 'attempt_id', current_setting('prueba.t1'), 'kind', 'salida', 't_ms', 1)));
  if (r ->> 'aceptados')::int <> 0 then raise exception 'FALLO: escribió en un intento ajeno'; end if;
  if (public.my_telemetry_summary(current_setting('prueba.t1')::uuid) ->> 'eventos')::int <> 0 then raise exception 'FALLO: vio el resumen ajeno'; end if;
end $$;

reset role;
do $$ begin
  -- solo campos permitidos; la hora de pared absurda se anula; la de recepción la pone el servidor
  if exists (select 1 from public.telemetry_events where data ? 'texto' or data ? 'teclas') then raise exception 'FALLO: guardó campos no permitidos'; end if;
  if (select client_wall from public.telemetry_events where session_id = 'dc000000-0000-4000-8000-00000000d002') is not null then raise exception 'FALLO: hora de pared absurda'; end if;
  if (select count(*) from public.telemetry_events where received_at is null) > 0 then raise exception 'FALLO: hora de recepción'; end if;
  -- entregado hace más de 15 minutos: ya no se aceptan eventos
  update public.attempts set status = 'submitted', submitted_at = now() - interval '20 minutes' where id = current_setting('prueba.t1')::uuid;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dc000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000011', true);
do $$ begin
  if (public.telemetry_ingest(jsonb_build_array(jsonb_build_object('session_id', 'dc000000-0000-4000-8000-00000000d003', 'seq', 1, 'attempt_id', current_setting('prueba.t1'), 'kind', 'salida', 't_ms', 1))) ->> 'aceptados')::int <> 0 then
    raise exception 'FALLO: aceptó eventos mucho después de entregar';
  end if;
end $$;

-- profesorado: el de la sección lee (auditado); uno ajeno no
select set_config('request.jwt.claims', '{"sub":"dc000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.telemetry_attempt(current_setting('prueba.t1')::uuid); raise exception 'FALLO: un profesor ajeno leyó la telemetría'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"dc000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000001', true);
do $$
declare d jsonb := public.telemetry_attempt(current_setting('prueba.t1')::uuid); l jsonb;
begin
  if jsonb_array_length(d -> 'eventos') <> 4 or jsonb_array_length(d -> 'items') <> 2 then raise exception 'FALLO: lectura del profesor (%)', d; end if;
  if (select count(*) from public.telemetry_student_attempts('dc000000-0000-4000-8000-000000000011')) <> 1 then raise exception 'FALLO: intentos del estudiante'; end if;
  l := public.lieia_telemetry('dc000000-0000-4000-8000-0000000000a1');
  if jsonb_array_length(l) <> 1 or jsonb_array_length(l -> 0 -> 'eventos') <> 4 or l::text like '%sint-tel%' then raise exception 'FALLO: telemetría LIEIA'; end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.analytics_audit where detail ? 'telemetria_intento') then raise exception 'FALLO: lectura no auditada'; end if;
end $$;
select 'PRUEBAS DE TELEMETRÍA PASARON' as resultado;
rollback;
