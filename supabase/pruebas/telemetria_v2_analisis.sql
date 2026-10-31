-- Pruebas: Telemetría V2 · análisis entre intentos, práctica asistida y Centro de Datos (migración 44).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('7e440000-0000-4000-8000-000000000001', 'a1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-analisis","aula_role":"teacher"}', '{}', now(), now()),
  ('7e440000-0000-4000-8000-000000000002', 'a2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-analisis-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('7e440000-0000-4000-8000-000000000011', 'a11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-analisis-1"}', '{}', now(), now()),
  ('7e440000-0000-4000-8000-000000000012', 'a12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-analisis-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like '7e440000-%';
update public.profiles set role = 'teacher' where id in ('7e440000-0000-4000-8000-000000000001', '7e440000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('7e440000-0000-4000-8000-000000000021', 'Curso análisis');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points, concepts) values
  ('7e440000-0000-4000-8000-0000000000e1', '7e440000-0000-4000-8000-000000000021', 'an-e1', 'numerica', 'intermedio', 'bank', 'numeric', 'Pregunta 1', 1, '{u9c-impulso-def}');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('7e440000-0000-4000-8000-000000000031', '7e440000-0000-4000-8000-000000000021', 'Sección análisis', 'ANALIS01', '7e440000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('7e440000-0000-4000-8000-000000000031', '7e440000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('7e440000-0000-4000-8000-000000000031', '7e440000-0000-4000-8000-000000000011'), ('7e440000-0000-4000-8000-000000000031', '7e440000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('7e440000-0000-4000-8000-0000000000a1', '7e440000-0000-4000-8000-000000000031', 'Práctica asistida', 'practice', true, 'never', false);
insert into public.activity_items (activity_id, exercise_id, position) values ('7e440000-0000-4000-8000-0000000000a1', '7e440000-0000-4000-8000-0000000000e1', 1);
insert into public.attempts (id, user_id, course_id, activity_id, mode, status, submitted_at) values
  ('7e440000-0000-4000-8000-0000000000b1', '7e440000-0000-4000-8000-000000000011', '7e440000-0000-4000-8000-000000000021', '7e440000-0000-4000-8000-0000000000a1', 'practice', 'submitted', now()),
  ('7e440000-0000-4000-8000-0000000000b2', '7e440000-0000-4000-8000-000000000012', '7e440000-0000-4000-8000-000000000021', '7e440000-0000-4000-8000-0000000000a1', 'practice', 'in_progress', null);
insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, client_id, answer, declaracion, status) values
  ('7e440000-0000-4000-8000-0000000000b1', '7e440000-0000-4000-8000-0000000000e1', '7e440000-0000-4000-8000-000000000011', 'inicial', gen_random_uuid(), '{"text":"3 m/s"}', 'consulto_ayuda', 'incorrect'),
  ('7e440000-0000-4000-8000-0000000000b1', '7e440000-0000-4000-8000-0000000000e1', '7e440000-0000-4000-8000-000000000011', 'corregida', gen_random_uuid(), '{"text":"4 m/s"}', null, 'correct');

do $$ begin
  if has_function_privilege('authenticated', 'public.telemetria_v2_paquete(uuid)', 'execute') then raise exception 'FALLO: el paquete interno es invocable'; end if;
  if has_function_privilege('anon', 'public.telemetria_v2_actividad(uuid, boolean)', 'execute') then raise exception 'FALLO: anon lee la actividad'; end if;
  -- Centro de Datos: las fuentes nuevas están en la lista blanca y las anteriores siguen
  if (select grupo from public.export_fuente('telemetria_v2')) <> 'telemetria' or (select grupo from public.export_fuente('revisiones_respuesta')) <> 'respuestas'
     or (select grupo from public.export_fuente('instantaneas_entrega')) <> 'respuestas' or (select grupo from public.export_fuente('asistencia_horarios')) <> 'asistencia'
     or (select grupo from public.export_fuente('asistencia_quorum_eventos')) <> 'asistencia' then raise exception 'FALLO: fuentes nuevas del Centro de Datos'; end if;
  if (select grupo from public.export_fuente('asistida_pasos')) <> 'respuestas' or (select grupo from public.export_fuente('telemetria')) <> 'telemetria'
     or (select grupo from public.export_fuente('no_existe')) is not null then raise exception 'FALLO: fuentes anteriores o desconocidas'; end if;
  if not ('{lat,lng,device_hash}'::text[] <@ (select quitar from public.export_fuente('asistencia_registros'))) then raise exception 'FALLO: coordenadas en la exportación'; end if;
end $$;

set local role authenticated;
-- profesor de la sección: el intento trae los pasos de la práctica asistida y los conceptos; la actividad, solo entregados
select set_config('request.jwt.claims', '{"sub":"7e440000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '7e440000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.telemetria_v2_intento('7e440000-0000-4000-8000-0000000000b1');
  if jsonb_array_length(r -> 'asistida') <> 2 or r -> 'asistida' -> 0 ->> 'fase' <> 'inicial' or r -> 'asistida' -> 0 ->> 'declaracion' <> 'consulto_ayuda' then
    raise exception 'FALLO: pasos de la práctica asistida %', r -> 'asistida'; end if;
  if r -> 'items' -> 0 -> 'conceptos' ->> 0 <> 'u9c-impulso-def' then raise exception 'FALLO: conceptos de la pregunta %', r -> 'items'; end if;
  r := public.telemetria_v2_actividad('7e440000-0000-4000-8000-0000000000a1');
  if jsonb_array_length(r -> 'intentos') <> 1 or r -> 'intentos' -> 0 -> 'paquete' -> 'intento' ->> 'id' <> '7e440000-0000-4000-8000-0000000000b1' then
    raise exception 'FALLO: intentos de la actividad %', jsonb_array_length(r -> 'intentos'); end if;
  r := public.telemetria_v2_actividad('7e440000-0000-4000-8000-0000000000a1', false);
  if jsonb_array_length(r -> 'intentos') <> 2 then raise exception 'FALLO: con los no entregados'; end if;
end $$;
-- profesor ajeno y estudiante: no
select set_config('request.jwt.claims', '{"sub":"7e440000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '7e440000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.telemetria_v2_actividad('7e440000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: un profesor ajeno leyó la actividad';
  exception when insufficient_privilege then null; end;
  begin perform public.telemetria_v2_intento('7e440000-0000-4000-8000-0000000000b1'); raise exception 'FALLO: un profesor ajeno leyó el intento';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"7e440000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '7e440000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.telemetria_v2_actividad('7e440000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: un estudiante leyó la actividad';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.analytics_audit where detail ? 'telemetria_v2_actividad') < 2 then raise exception 'FALLO: consulta no auditada'; end if;
end $$;

select 'telemetria_v2_analisis.sql: PRUEBAS PASARON' as resultado;
rollback;
