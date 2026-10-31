-- Pruebas: Telemetría V2 (migración 42). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('7e420000-0000-4000-8000-000000000001', 't1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-tv2","aula_role":"teacher"}', '{}', now(), now()),
  ('7e420000-0000-4000-8000-000000000002', 't2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-tv2-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('7e420000-0000-4000-8000-000000000011', 't11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tv2-1"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like '7e420000-%';
update public.profiles set role = 'teacher' where id in ('7e420000-0000-4000-8000-000000000001', '7e420000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('7e420000-0000-4000-8000-000000000021', 'Curso telemetría V2');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points) values
  ('7e420000-0000-4000-8000-0000000000e1', '7e420000-0000-4000-8000-000000000021', 'tv2-e1', 'numerica', 'basico', 'bank', 'numeric', 'Pregunta 1', 1),
  ('7e420000-0000-4000-8000-0000000000e2', '7e420000-0000-4000-8000-000000000021', 'tv2-e2', 'numerica', 'basico', 'bank', 'numeric', 'Ajena', 1);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('7e420000-0000-4000-8000-000000000031', '7e420000-0000-4000-8000-000000000021', 'Sección TV2', 'TELEV201', '7e420000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('7e420000-0000-4000-8000-000000000031', '7e420000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('7e420000-0000-4000-8000-000000000031', '7e420000-0000-4000-8000-000000000011');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('7e420000-0000-4000-8000-0000000000a1', '7e420000-0000-4000-8000-000000000031', 'Práctica TV2', 'practice', true, 'immediate', false);
insert into public.activity_items (activity_id, exercise_id, position) values ('7e420000-0000-4000-8000-0000000000a1', '7e420000-0000-4000-8000-0000000000e1', 1);
insert into public.telemetry_v2_flags (course_id, activo) values ('7e420000-0000-4000-8000-000000000021', true);

-- privilegios: tablas cerradas; funciones internas no ejecutables
do $$ begin
  if has_table_privilege('authenticated', 'public.telemetry_v2_events', 'select') or has_table_privilege('authenticated', 'public.response_revisions', 'select')
     or has_table_privilege('authenticated', 'public.response_revisions', 'insert') or has_table_privilege('authenticated', 'public.attempt_snapshots', 'select') then
    raise exception 'FALLO: tablas de telemetría V2 accesibles directamente'; end if;
  if has_function_privilege('anon', 'public.telemetry_v2_ingest(jsonb)', 'execute') then raise exception 'FALLO: anon puede enviar eventos'; end if;
  if has_function_privilege('authenticated', 'public.registrar_revision()', 'execute') then raise exception 'FALLO: disparador ejecutable'; end if;
end $$;

-- el estudiante empieza la práctica
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7e420000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '7e420000-0000-4000-8000-000000000011', true);
select set_config('prueba.t', public.start_activity_attempt('7e420000-0000-4000-8000-0000000000a1')::text, true);

do $$ declare r jsonb; v_att uuid := current_setting('prueba.t')::uuid; begin
  r := public.telemetry_v2_sync(v_att);
  if (r ->> 'activo')::boolean is not true or (r ->> 'servidor_ms')::bigint < 1700000000000 then raise exception 'FALLO: sincronización %', r; end if;
  -- idempotencia: el mismo event_id dos veces; un tipo desconocido; una pregunta ajena al intento
  r := public.telemetry_v2_ingest(jsonb_build_array(
    jsonb_build_object('event_id', '7e420000-0000-4000-8000-00000000ee01', 'attempt_id', v_att, 'session_id', '7e420000-0000-4000-8000-00000000cc01',
      'client_seq', 1, 'event_type', 'session_started', 't_mono', 0, 'visibility', 'visible', 'payload', jsonb_build_object('navegacion', 'navigate', 'texto', 'no permitido')),
    jsonb_build_object('event_id', '7e420000-0000-4000-8000-00000000ee01', 'attempt_id', v_att, 'session_id', '7e420000-0000-4000-8000-00000000cc01',
      'client_seq', 1, 'event_type', 'session_started', 't_mono', 0),
    jsonb_build_object('event_id', '7e420000-0000-4000-8000-00000000ee02', 'attempt_id', v_att, 'session_id', '7e420000-0000-4000-8000-00000000cc01',
      'client_seq', 2, 'event_type', 'keylogger', 't_mono', 10),
    jsonb_build_object('event_id', '7e420000-0000-4000-8000-00000000ee03', 'attempt_id', v_att, 'session_id', '7e420000-0000-4000-8000-00000000cc01',
      'client_seq', 3, 'event_type', 'question_activated', 'question_id', '7e420000-0000-4000-8000-0000000000e2', 't_mono', 20),
    jsonb_build_object('event_id', '7e420000-0000-4000-8000-00000000ee04', 'attempt_id', v_att, 'session_id', '7e420000-0000-4000-8000-00000000cc01',
      'client_seq', 4, 'event_type', 'question_activated', 'question_id', '7e420000-0000-4000-8000-0000000000e1', 't_mono', 30, 'wall', '1000000000000')));
  if (r ->> 'aceptados')::int <> 2 or (r ->> 'duplicados')::int <> 1 or (r ->> 'rechazados')::int <> 2 then raise exception 'FALLO: ingesta %', r; end if;
end $$;

-- revisiones de la respuesta (guardados reales con save_response)
do $$ declare v_att uuid := current_setting('prueba.t')::uuid; begin
  perform public.save_response(v_att, '7e420000-0000-4000-8000-0000000000e1', '{"text": ""}');
  perform public.save_response(v_att, '7e420000-0000-4000-8000-0000000000e1', '{"text": "4 m/s"}');
  perform public.save_response(v_att, '7e420000-0000-4000-8000-0000000000e1', '{"text": "4.0 m/s"}');
  perform public.save_response(v_att, '7e420000-0000-4000-8000-0000000000e1', '{"text": "4.00 m/s"}');
  perform public.save_response(v_att, '7e420000-0000-4000-8000-0000000000e1', '{"text": "4.00 m/s"}');
  begin
    insert into public.response_revisions (response_id, attempt_id, exercise_id, user_id, rev, answer, answer_hash, vacia)
      select r.id, v_att, r.exercise_id, r.user_id, 99, '{"text":"falsa"}', 'x', false from public.responses r where r.attempt_id = v_att;
    raise exception 'FALLO: el estudiante escribió una revisión';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ declare v_att uuid := current_setting('prueba.t')::uuid; n int; c int; a jsonb; begin
  -- el payload se limpió (sin «texto») y la identidad la puso el servidor; la hora de cliente absurda se descartó
  if exists (select 1 from public.telemetry_v2_events where attempt_id = v_att and payload ? 'texto') then raise exception 'FALLO: campo no permitido guardado'; end if;
  if exists (select 1 from public.telemetry_v2_events where attempt_id = v_att and user_id <> '7e420000-0000-4000-8000-000000000011') then raise exception 'FALLO: identidad'; end if;
  if not exists (select 1 from public.telemetry_v2_events where attempt_id = v_att and client_seq = 4 and 'hora_cliente_descartada' = any(quality_flags) and client_wall is null) then
    raise exception 'FALLO: hora de cliente no descartada'; end if;
  -- vacía: sin revisión; «4 m/s» = rev 1 (nunca se consolida); «4.0» = rev 2; «4.00» se consolida en la 2; repetir no crea nada
  select count(*), max(consolidados) into n, c from public.response_revisions where attempt_id = v_att;
  if n <> 2 or c <> 1 then raise exception 'FALLO: revisiones n=% consolidados=%', n, c; end if;
  select answer into a from public.response_revisions where attempt_id = v_att and rev = 1;
  if a ->> 'text' <> '4 m/s' then raise exception 'FALLO: la primera respuesta no se conservó (%)', a; end if;
  select answer into a from public.response_revisions where attempt_id = v_att and rev = 2;
  if a ->> 'text' <> '4.00 m/s' then raise exception 'FALLO: la última revisión no es la final (%)', a; end if;
  -- la entrega deja una instantánea con la revisión entregada
  update public.attempts set status = 'submitted', submitted_at = now() where id = v_att;
  if (select (s.revisiones -> 0 ->> 'rev')::int from public.attempt_snapshots s where s.attempt_id = v_att) <> 2 then raise exception 'FALLO: instantánea de entrega'; end if;
end $$;

-- la bandera apagada cierra la ingesta
update public.telemetry_v2_flags set activo = false where course_id = '7e420000-0000-4000-8000-000000000021';
update public.attempts set status = 'in_progress', submitted_at = null where id = current_setting('prueba.t')::uuid;
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.telemetry_v2_ingest(jsonb_build_array(jsonb_build_object('event_id', '7e420000-0000-4000-8000-00000000ee09', 'attempt_id', current_setting('prueba.t')::uuid,
    'session_id', '7e420000-0000-4000-8000-00000000cc01', 'client_seq', 9, 'event_type', 'heartbeat', 't_mono', 90)));
  if (r ->> 'rechazados')::int <> 1 then raise exception 'FALLO: ingesta con la bandera apagada %', r; end if;
  if (public.telemetry_v2_sync(current_setting('prueba.t')::uuid) ->> 'activo')::boolean then raise exception 'FALLO: bandera'; end if;
  -- el estudiante no lee la reconstrucción ni enciende la bandera
  begin perform public.telemetria_v2_intento(current_setting('prueba.t')::uuid); raise exception 'FALLO: el estudiante leyó la reconstrucción';
  exception when insufficient_privilege then null; end;
  begin perform public.telemetry_v2_set('7e420000-0000-4000-8000-000000000021', true); raise exception 'FALLO: el estudiante encendió la bandera';
  exception when insufficient_privilege then null; end;
  begin perform public.telemetry_v2_flag('7e420000-0000-4000-8000-000000000021'); raise exception 'FALLO: el estudiante leyó la bandera';
  exception when insufficient_privilege then null; end;
end $$;

-- profesor ajeno: no; profesor de la sección: sí, con todo lo necesario para reconstruir
select set_config('request.jwt.claims', '{"sub":"7e420000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '7e420000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.telemetria_v2_intento(current_setting('prueba.t')::uuid); raise exception 'FALLO: un profesor ajeno leyó la reconstrucción';
  exception when insufficient_privilege then null; end;
  begin perform public.telemetry_v2_monitor(); raise exception 'FALLO: el monitor no es solo de administración';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"7e420000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '7e420000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  if public.telemetry_v2_flag('7e420000-0000-4000-8000-000000000021') then raise exception 'FALLO: lectura de la bandera (está apagada)'; end if;
  r := public.telemetria_v2_intento(current_setting('prueba.t')::uuid);
  if jsonb_array_length(r -> 'revisiones') <> 2 or jsonb_array_length(r -> 'v2') <> 2 or jsonb_array_length(r -> 'items') <> 1 or r -> 'instantanea' is null then
    raise exception 'FALLO: reconstrucción incompleta %', jsonb_build_object('rev', jsonb_array_length(r -> 'revisiones'), 'v2', jsonb_array_length(r -> 'v2'), 'items', jsonb_array_length(r -> 'items'));
  end if;
end $$;
reset role;

select 'telemetria_v2.sql: PRUEBAS PASARON' as resultado;
rollback;
