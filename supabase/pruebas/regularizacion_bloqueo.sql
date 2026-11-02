-- Pruebas: regularización obligatoria — bloqueo total hasta terminarla (migración 64). Se deshace al final.
-- PostgREST fija request.path en cada petición; aquí se simula con set_config antes de cada llamada.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de640000-0000-4000-8000-000000000001', 'rb1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-bloqueo","aula_role":"teacher"}', '{}', now(), now()),
  ('de640000-0000-4000-8000-000000000011', 'rb11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-bloq-1"}', '{}', now(), now()),
  ('de640000-0000-4000-8000-000000000012', 'rb12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-bloq-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de640000-%';
update public.profiles set role = 'teacher' where id = 'de640000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de640000-0000-4000-8000-000000000021', 'Curso bloqueo');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points, published) values
  ('de640000-0000-4000-8000-0000000000e1', 'de640000-0000-4000-8000-000000000021', 'rb-1', 'numerica', 'basico', 'practice', 'numeric', 'P', 1, true);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de640000-0000-4000-8000-000000000031', 'de640000-0000-4000-8000-000000000021', 'Sección bloqueo', 'BLOQUE01', 'de640000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de640000-0000-4000-8000-000000000031', 'de640000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de640000-0000-4000-8000-000000000031', 'de640000-0000-4000-8000-000000000011'), ('de640000-0000-4000-8000-000000000031', 'de640000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de640000-0000-4000-8000-0000000000a1', 'de640000-0000-4000-8000-000000000031', 'Práctica', 'practice', true, 'immediate', true, 3);
insert into public.activity_items (activity_id, exercise_id, position) values ('de640000-0000-4000-8000-0000000000a1', 'de640000-0000-4000-8000-0000000000e1', 1);
-- regularización abierta en la sección; S2 ya terminó; S1 tenía un intento abierto de antes
insert into public.hist_settings (class_id, abierto) values ('de640000-0000-4000-8000-000000000031', true);
insert into public.hist_cierres (class_id, user_id, finalizado_at, sin_practicas) values ('de640000-0000-4000-8000-000000000031', 'de640000-0000-4000-8000-000000000012', now(), true);
insert into public.attempts (id, user_id, course_id, activity_id, mode) values
  ('de640000-0000-4000-8000-0000000000f1', 'de640000-0000-4000-8000-000000000011', 'de640000-0000-4000-8000-000000000021', 'de640000-0000-4000-8000-0000000000a1', 'practice');

-- 1) el profesor activa el bloqueo; un estudiante no puede
set local role authenticated;
select set_config('request.path', '/rpc/activity_visible_to_me', true);
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
do $$ begin
  -- sin bloqueo activado: el aula funciona (el recordatorio sigue siendo solo un aviso)
  if not public.my_account_ok() or not public.activity_visible_to_me('de640000-0000-4000-8000-0000000000a1') then raise exception 'FALLO: bloqueado sin activar'; end if;
  perform set_config('request.path', '/rpc/hist_bloqueo_configurar', true);
  begin perform public.hist_bloqueo_configurar('de640000-0000-4000-8000-000000000031', true); raise exception 'FALLO: un estudiante configuró el bloqueo';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000001', true);
select set_config('request.path', '/rpc/hist_bloqueo_configurar', true);
do $$ declare r jsonb; begin
  r := public.hist_bloqueo_configurar('de640000-0000-4000-8000-000000000031', true);
  if not (r ->> 'bloquear')::boolean or (r ->> 'bloqueados')::int <> 1 or not (r ->> 'servidor_ok')::boolean then raise exception 'FALLO: estado del bloqueo %', r; end if;
  perform set_config('request.path', '/rpc/attendance_live', true);
  if not public.my_account_ok() then raise exception 'FALLO: el profesor quedó bloqueado'; end if;
end $$;

-- 2) S1 (sin terminar) no puede hacer nada… salvo la regularización
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
do $$ begin
  perform set_config('request.path', '/activities', true);
  if public.my_account_ok() then raise exception 'FALLO: S1 no está bloqueado'; end if;
  if exists (select 1 from public.activities where id = 'de640000-0000-4000-8000-0000000000a1') then raise exception 'FALLO: S1 lee actividades'; end if;
  perform set_config('request.path', '/rpc/start_activity_attempt', true);
  begin perform public.start_activity_attempt('de640000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: S1 empezó una práctica';
  exception when insufficient_privilege then null; end;
  perform set_config('request.path', '/rpc/attendance_check_in', true);
  begin perform public.attendance_check_in('123456', null, null, null, null); raise exception 'FALLO: S1 marcó asistencia';
  exception when sqlstate '28000' then null; end;
  perform set_config('request.path', '/rpc/my_grade_breakdown', true);
  if jsonb_array_length(public.my_grade_breakdown()) <> 0 then raise exception 'FALLO: S1 ve sus notas'; end if;
  -- rutas de servicio (calificar, entregas en PDF): un intento abierto de antes tampoco se puede usar
  perform set_config('request.path', '/rpc/svc_check_context', true);
  begin perform public.assert_attempt_writable('de640000-0000-4000-8000-0000000000f1', 'de640000-0000-4000-8000-000000000011'); raise exception 'FALLO: S1 escribe por calificar';
  exception when insufficient_privilege then null; end;
  -- la regularización sí funciona (incluidas las fotos por la Edge Function «entregas»)
  perform set_config('request.path', '/rpc/hist_mi_bloqueo', true);
  if jsonb_array_length(public.hist_mi_bloqueo()) <> 1 then raise exception 'FALLO: motivo del bloqueo'; end if;
  perform set_config('request.path', '/rpc/hist_pendientes', true);
  if jsonb_array_length(public.hist_pendientes()) <> 1 then raise exception 'FALLO: pendientes durante el bloqueo'; end if;
  perform set_config('request.path', '/rpc/hist_mis_secciones', true);
  if jsonb_array_length(public.hist_mis_secciones()) <> 1 then raise exception 'FALLO: mis secciones durante el bloqueo'; end if;
  perform set_config('request.path', '/rpc/svc_hist_captura_check', true);
  if not public.account_ok('de640000-0000-4000-8000-000000000011') then raise exception 'FALLO: fotos de la regularización bloqueadas'; end if;
  -- una ruta parecida no sirve para saltarse el bloqueo
  perform set_config('request.path', '/rpc/start_activity_attempt_hist_x', true);
  if public.my_account_ok() then raise exception 'FALLO: ruta parecida exenta'; end if;
  perform set_config('request.path', '/hist_declarations', true);
  if public.my_account_ok() then raise exception 'FALLO: tabla hist_* exenta'; end if;
  -- el estudiante no puede consultar la función de exención
  perform set_config('request.path', '/rpc/hist_exento', true);
  begin perform public.hist_exento(); raise exception 'FALLO: hist_exento expuesta'; exception when insufficient_privilege then null; end;
end $$;

-- 3) S2 (ya terminó) trabaja con normalidad
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000012', true);
select set_config('request.path', '/rpc/start_activity_attempt', true);
do $$ begin
  if not public.my_account_ok() or jsonb_array_length(public.hist_mi_bloqueo()) <> 0 then raise exception 'FALLO: S2 bloqueado'; end if;
  perform public.start_activity_attempt('de640000-0000-4000-8000-0000000000a1');
end $$;

-- 4) S1 termina (declara que no tiene prácticas) → vuelve a la normalidad
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
do $$ begin
  perform set_config('request.path', '/rpc/hist_finalizar', true);
  perform public.hist_finalizar('de640000-0000-4000-8000-000000000031', true, null);
  perform set_config('request.path', '/rpc/activity_visible_to_me', true);
  if not public.my_account_ok() or not public.activity_visible_to_me('de640000-0000-4000-8000-0000000000a1') then raise exception 'FALLO: sigue bloqueado tras terminar'; end if;
end $$;

-- 5) el profesor le reabre la regularización → bloqueado otra vez; si cierra la regularización o quita el bloqueo, libre
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000001', true);
select set_config('request.path', '/rpc/hist_reabrir_estudiante', true);
select public.hist_reabrir_estudiante('de640000-0000-4000-8000-000000000031', 'de640000-0000-4000-8000-000000000011', 'Falta la práctica 3');
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
select set_config('request.path', '/rpc/activity_visible_to_me', true);
do $$ begin if public.my_account_ok() then raise exception 'FALLO: reabierta sin bloqueo'; end if; end $$;
reset role;
update public.hist_settings set abierto = false, libre_habilitado = false where class_id = 'de640000-0000-4000-8000-000000000031';
set local role authenticated;
do $$ begin if not public.my_account_ok() then raise exception 'FALLO: bloqueo sin salida con la regularización cerrada'; end if; end $$;
reset role;
update public.hist_settings set abierto = true where class_id = 'de640000-0000-4000-8000-000000000031';
set local role authenticated;
do $$ begin
  if public.my_account_ok() then raise exception 'FALLO: debía volver a bloquear'; end if;
  -- fuera de PostgREST (sin ruta) nunca se bloquea: no deja a nadie sin salida
  perform set_config('request.path', '', true);
  if not public.my_account_ok() then raise exception 'FALLO: sin ruta bloqueó'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000001', true);
select set_config('request.path', '/rpc/hist_bloqueo_configurar', true);
select public.hist_bloqueo_configurar('de640000-0000-4000-8000-000000000031', false) is not null;
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
select set_config('request.path', '/rpc/activity_visible_to_me', true);
do $$ begin if not public.my_account_ok() then raise exception 'FALLO: bloqueado con el bloqueo desactivado'; end if; end $$;
reset role;

do $$ begin
  if has_function_privilege('authenticated', 'public.hist_bloqueado(uuid)', 'execute') then raise exception 'FALLO: permisos'; end if;
end $$;

select 'regularizacion_bloqueo.sql: PRUEBAS PASARON' as resultado;
rollback;
