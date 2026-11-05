-- Pruebas: pregunta de respuesta oral (migración 86). Datos sintéticos; se deshace al final.
-- T = profesor · T2 = profesor ajeno · AD = administrador · E1, E2 = estudiantes
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ab860000-0000-4000-8000-000000000001', 'or01@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-oral","aula_role":"teacher"}', '{}', now(), now()),
  ('ab860000-0000-4000-8000-000000000002', 'or02@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-oral-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('ab860000-0000-4000-8000-000000000003', 'or03@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-oral"}', '{}', now(), now()),
  ('ab860000-0000-4000-8000-000000000011', 'or11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-oral-1"}', '{}', now(), now()),
  ('ab860000-0000-4000-8000-000000000012', 'or12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-oral-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'ab860000-%';
update public.profiles set role = 'teacher' where id in ('ab860000-0000-4000-8000-000000000001', 'ab860000-0000-4000-8000-000000000002');
update public.profiles set role = 'admin' where id = 'ab860000-0000-4000-8000-000000000003';
insert into public.courses (id, title) values ('ab860000-0000-4000-8000-000000000021', 'Curso oral');
-- e1: oral sin configuración (valores por defecto) · e2: oral con límites fuera de rango · e3: selección con audio_config (se ignora)
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options, points, audio_config) values
  ('ab860000-0000-4000-8000-0000000000e1', 'ab860000-0000-4000-8000-000000000021', 'oral-e1', 'conceptual', 'basico', 'bank', 'audio', 'Explique oralmente la conservación de la energía.', null, 10, null),
  ('ab860000-0000-4000-8000-0000000000e2', 'ab860000-0000-4000-8000-000000000021', 'oral-e2', 'conceptual', 'basico', 'bank', 'audio', 'Otra oral.', null, 10, '{"min_s":1,"max_s":9999,"max_grabaciones":50}'),
  ('ab860000-0000-4000-8000-0000000000e3', 'ab860000-0000-4000-8000-000000000021', 'oral-e3', 'seleccion', 'basico', 'bank', 'choice', 'Elija.', '["a","b"]', 10, '{"min_s":60}');
insert into public.exercise_keys (exercise_id, answer, hints, explanation) values
  ('ab860000-0000-4000-8000-0000000000e1', '{"format":"audio","rubric":"RUBRICA-SECRETA: 5 puntos idea, 5 puntos ejemplo"}', '[]', ''),
  ('ab860000-0000-4000-8000-0000000000e3', '{"format":"choice","correct":[0]}', '[]', '');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ab860000-0000-4000-8000-000000000031', 'ab860000-0000-4000-8000-000000000021', 'Sección oral', 'ORAL0001', 'ab860000-0000-4000-8000-000000000001');
insert into public.enrollments (class_id, user_id) values
  ('ab860000-0000-4000-8000-000000000031', 'ab860000-0000-4000-8000-000000000011'),
  ('ab860000-0000-4000-8000-000000000031', 'ab860000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, created_by) values
  ('ab860000-0000-4000-8000-0000000000a1', 'ab860000-0000-4000-8000-000000000031', 'Examen oral', 'exam', true, 'never', false, 'ab860000-0000-4000-8000-000000000001');
insert into public.activity_items (activity_id, exercise_id, position) values
  ('ab860000-0000-4000-8000-0000000000a1', 'ab860000-0000-4000-8000-0000000000e1', 1),
  ('ab860000-0000-4000-8000-0000000000a1', 'ab860000-0000-4000-8000-0000000000e3', 2);
insert into public.exam_settings (activity_id, presentacion, navegacion, duracion_s) values ('ab860000-0000-4000-8000-0000000000a1', 'una_a_la_vez', 'libre', 3600);

create function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p::text, true);
$$;
grant execute on function pg_temp.como(uuid) to authenticated;
create temp table t (k text primary key, v text);
grant all on t to authenticated;

-- 0) configuración normalizada; permisos
do $$ declare v_f text; begin
  if (select audio_config from public.exercises where id = 'ab860000-0000-4000-8000-0000000000e1') <> '{"ia": false, "max_s": 120, "min_s": 60, "transcripcion": false, "max_grabaciones": 2, "reproducir_previa": true}'::jsonb then
    raise exception 'FALLO: valores por defecto %', (select audio_config from public.exercises where id = 'ab860000-0000-4000-8000-0000000000e1');
  end if;
  if (select (audio_config ->> 'min_s')::int || '-' || (audio_config ->> 'max_s') || '-' || (audio_config ->> 'max_grabaciones') from public.exercises where id = 'ab860000-0000-4000-8000-0000000000e2') <> '5-600-5' then
    raise exception 'FALLO: límites técnicos';
  end if;
  if (select audio_config from public.exercises where id = 'ab860000-0000-4000-8000-0000000000e3') is not null then raise exception 'FALLO: audio_config en una pregunta de selección'; end if;
  if has_table_privilege('authenticated', 'public.response_audios', 'select') then raise exception 'FALLO: grabaciones legibles por REST'; end if;
  foreach v_f in array array['public.svc_audio_check(uuid, uuid, uuid, integer, integer)', 'public.svc_audio_record(uuid, uuid, uuid, uuid, text, text, integer, integer, text)',
      'public.svc_audio_path(uuid, uuid)', 'public.svc_audio_caducados(uuid, integer)', 'public.audio_comprobar(uuid, uuid, uuid, integer, integer)'] loop
    if has_function_privilege('authenticated', v_f, 'execute') then raise exception 'FALLO: % expuesta', v_f; end if;
  end loop;
  if has_function_privilege('anon', 'public.audio_mi_pregunta(uuid, uuid)', 'execute') then raise exception 'FALLO: anon'; end if;
end $$ language plpgsql;

-- 1) E1 empieza: ve la configuración de la pregunta oral, nunca la rúbrica
set local role authenticated;
select pg_temp.como('ab860000-0000-4000-8000-000000000011');
insert into t select 'q', public.start_activity_attempt('ab860000-0000-4000-8000-0000000000a1')::text;
do $$ declare q uuid := (select v::uuid from t where k = 'q'); r jsonb; g jsonb; begin
  perform public.exam_open(q);
  r := public.audio_mi_pregunta(q, 'ab860000-0000-4000-8000-0000000000e1');
  if (r -> 'config' ->> 'min_s')::int <> 60 or (r -> 'config' ->> 'max_s')::int <> 120 or jsonb_array_length(r -> 'grabaciones') <> 0 then raise exception 'FALLO: configuración %', r; end if;
  g := public.get_attempt(q);
  if g::text like '%RUBRICA-SECRETA%' or r::text like '%RUBRICA-SECRETA%' then raise exception 'FALLO: la rúbrica llegó al estudiante'; end if;
  begin perform public.audio_mi_pregunta(q, 'ab860000-0000-4000-8000-0000000000e3'); raise exception 'FALLO: config de una pregunta no oral';
  exception when invalid_parameter_value then null; end;
end $$;
select pg_temp.como('ab860000-0000-4000-8000-000000000012');
do $$ begin
  begin perform public.audio_mi_pregunta((select v::uuid from t where k = 'q'), 'ab860000-0000-4000-8000-0000000000e1'); raise exception 'FALLO: E2 leyó la pregunta de E1';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) servidor (Edge Function): límites de duración y tamaño, intento ajeno, ruta, formato, número de grabaciones
reset role;
do $$ declare q uuid := (select v::uuid from t where k = 'q'); u uuid := 'ab860000-0000-4000-8000-000000000011'; ej uuid := 'ab860000-0000-4000-8000-0000000000e1';
  f1 uuid := 'ab860000-0000-4000-8000-0000000000f1'; f2 uuid := 'ab860000-0000-4000-8000-0000000000f2'; r jsonb; begin
  begin perform public.svc_audio_check(u, q, ej, 500000, 30000); raise exception 'FALLO: aceptó 30 s (mínimo 60)';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_audio_check(u, q, ej, 500000, 130000); raise exception 'FALLO: aceptó 130 s (máximo 120)';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_audio_check(u, q, ej, 25000000, 75000); raise exception 'FALLO: aceptó 25 MB';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_audio_check('ab860000-0000-4000-8000-000000000012', q, ej, 500000, 75000); raise exception 'FALLO: E2 grabó en el intento de E1';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_audio_check(u, q, 'ab860000-0000-4000-8000-0000000000e3', 500000, 75000); raise exception 'FALLO: grabó en una pregunta de selección';
  exception when invalid_parameter_value then null; end;
  r := public.svc_audio_check(u, q, ej, 500000, 75000);
  if (r ->> 'usadas')::int <> 0 then raise exception 'FALLO: usadas'; end if;
  begin perform public.svc_audio_record(u, q, ej, f1, q || '/ab860000-0000-4000-8000-000000000012/' || f1 || '.webm', 'audio/webm', 500000, 75000, repeat('a', 64));
    raise exception 'FALLO: ruta ajena';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_audio_record(u, q, ej, f1, q || '/' || u || '/' || f1 || '.exe', 'application/x-msdownload', 500000, 75000, repeat('a', 64));
    raise exception 'FALLO: formato no audio';
  exception when invalid_parameter_value then null; end;
  r := public.svc_audio_record(u, q, ej, f1, q || '/' || u || '/' || f1 || '.webm', 'audio/webm', 500000, 75000, repeat('a', 64));
  if (select answer ->> 'audio_id' from public.responses where attempt_id = q and exercise_id = ej) <> f1::text then raise exception 'FALLO: la respuesta no apunta al audio'; end if;
  perform public.svc_audio_record(u, q, ej, f2, q || '/' || u || '/' || f2 || '.m4a', 'audio/mp4', 400000, 61000, repeat('b', 64));
  if (select answer ->> 'audio_id' from public.responses where attempt_id = q and exercise_id = ej) <> f2::text then raise exception 'FALLO: la nueva grabación no quedó vigente'; end if;
  if (select count(*) from public.response_audios where attempt_id = q) <> 2 then raise exception 'FALLO: la anterior se perdió'; end if;
  begin perform public.svc_audio_check(u, q, ej, 500000, 75000); raise exception 'FALLO: tercera grabación con máximo 2';
  exception when insufficient_privilege then null; end;
  -- escuchar: autor, profesor de la sección y admin sí; otro estudiante y profesor ajeno no
  if public.svc_audio_path(u, f1) is null then raise exception 'FALLO: el autor no escucha'; end if;
  if public.svc_audio_path('ab860000-0000-4000-8000-000000000001', f1) is null then raise exception 'FALLO: el profesor no escucha'; end if;
  if public.svc_audio_path('ab860000-0000-4000-8000-000000000003', f1) is null then raise exception 'FALLO: el admin no escucha'; end if;
  begin perform public.svc_audio_path('ab860000-0000-4000-8000-000000000012', f1); raise exception 'FALLO: E2 escuchó a E1';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_audio_path('ab860000-0000-4000-8000-000000000002', f1); raise exception 'FALLO: profesor ajeno escuchó';
  exception when insufficient_privilege then null; end;
end $$;

-- 3) con la pantalla bloqueada no se graba (barrera de la migración 85)
insert into public.screen_locks (user_id, body, code_hash) values ('ab860000-0000-4000-8000-000000000011', 'bloqueo de prueba', 'x');
do $$ begin
  begin perform public.svc_audio_check('ab860000-0000-4000-8000-000000000011', (select v::uuid from t where k = 'q'), 'ab860000-0000-4000-8000-0000000000e2', 500000, 10000);
    raise exception 'FALLO: grabó con la pantalla bloqueada';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
update public.screen_locks set unlocked_at = now() where user_id = 'ab860000-0000-4000-8000-000000000011';

-- 4) entregado: la respuesta oral queda pendiente de revisión; el profesor ve las grabaciones y califica
update public.attempts set status = 'submitted', submitted_at = now() where id = (select v::uuid from t where k = 'q');
update public.responses set status = 'pending_review' where attempt_id = (select v::uuid from t where k = 'q') and exercise_id = 'ab860000-0000-4000-8000-0000000000e1';
set local role authenticated;
select pg_temp.como('ab860000-0000-4000-8000-000000000001');
do $$ declare r jsonb; v_resp uuid; begin
  select id into v_resp from public.responses where attempt_id = (select v::uuid from t where k = 'q') and exercise_id = 'ab860000-0000-4000-8000-0000000000e1';
  r := public.audio_de_respuesta(v_resp);
  if jsonb_array_length(r -> 'grabaciones') <> 2 or r ->> 'vigente' <> 'ab860000-0000-4000-8000-0000000000f2' then raise exception 'FALLO: grabaciones para el profesor %', r; end if;
  perform public.grade_response(v_resp, 0.8, 'Buena explicación; faltó el ejemplo.');
  if (select status::text from public.responses where id = v_resp) <> 'partial' then raise exception 'FALLO: nota manual'; end if;
  perform public.grade_response(v_resp, null, null);
  if (select status::text from public.responses where id = v_resp) <> 'pending_review' then raise exception 'FALLO: deshacer no devolvió a pendiente'; end if;
  insert into t values ('resp', v_resp::text);
end $$;
select pg_temp.como('ab860000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.audio_de_respuesta((select v::uuid from t where k = 'resp')); raise exception 'FALLO: profesor ajeno vio grabaciones';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('ab860000-0000-4000-8000-000000000012');
do $$ begin
  begin perform public.audio_de_respuesta((select v::uuid from t where k = 'resp')); raise exception 'FALLO: E2 vio grabaciones de E1';
  exception when insufficient_privilege then null; end;
end $$;

-- 5) conservación: solo administradores, mínimo 180 días; marcar eliminadas deja de servirlas
reset role;
do $$ declare r jsonb; begin
  begin perform public.svc_audio_caducados('ab860000-0000-4000-8000-000000000001', 365); raise exception 'FALLO: un profesor purgó';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_audio_caducados('ab860000-0000-4000-8000-000000000003', 30); raise exception 'FALLO: 30 días';
  exception when invalid_parameter_value then null; end;
  update public.attempts set submitted_at = now() - interval '400 days' where id = (select v::uuid from t where k = 'q');
  r := public.svc_audio_caducados('ab860000-0000-4000-8000-000000000003', 365);
  if jsonb_array_length(r) <> 2 then raise exception 'FALLO: caducados %', r; end if;
  if public.svc_audio_marcar_eliminados('ab860000-0000-4000-8000-000000000003', array['ab860000-0000-4000-8000-0000000000f1']::uuid[]) <> 1 then raise exception 'FALLO: marcar'; end if;
  begin perform public.svc_audio_path('ab860000-0000-4000-8000-000000000011', 'ab860000-0000-4000-8000-0000000000f1'); raise exception 'FALLO: sirvió una grabación eliminada';
  exception when no_data_found then null; end;
  if (select count(*) from public.response_audios) < 2 then raise exception 'FALLO: se borraron filas'; end if;
end $$;

select 'respuesta_oral.sql: PRUEBAS PASARON' as resultado;
rollback;
