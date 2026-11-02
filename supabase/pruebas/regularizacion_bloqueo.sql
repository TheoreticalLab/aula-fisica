-- Pruebas: regularización obligatoria — bloqueo total hasta terminarla (migración 64). Se deshace al final.
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
-- regularización abierta en la sección; S2 ya terminó
insert into public.hist_settings (class_id, abierto) values ('de640000-0000-4000-8000-000000000031', true);
insert into public.hist_cierres (class_id, user_id, finalizado_at, sin_practicas) values ('de640000-0000-4000-8000-000000000031', 'de640000-0000-4000-8000-000000000012', now(), true);

-- 1) el profesor activa el bloqueo; un estudiante no puede
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
do $$ begin
  -- sin bloqueo activado: el aula funciona (el recordatorio sigue siendo solo un aviso)
  if not public.my_account_ok() or not public.activity_visible_to_me('de640000-0000-4000-8000-0000000000a1') then raise exception 'FALLO: bloqueado sin activar'; end if;
  begin perform public.hist_bloqueo_configurar('de640000-0000-4000-8000-000000000031', true); raise exception 'FALLO: un estudiante configuró el bloqueo';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.hist_bloqueo_configurar('de640000-0000-4000-8000-000000000031', true);
  if not (r ->> 'bloquear')::boolean or (r ->> 'bloqueados')::int <> 1 then raise exception 'FALLO: estado del bloqueo %', r; end if;
  if not public.my_account_ok() then raise exception 'FALLO: el profesor quedó bloqueado'; end if;
end $$;

-- 2) S1 (sin terminar) no puede hacer nada… salvo la regularización
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
do $$ begin
  if public.my_account_ok() then raise exception 'FALLO: S1 no está bloqueado'; end if;
  if public.activity_visible_to_me('de640000-0000-4000-8000-0000000000a1') then raise exception 'FALLO: S1 ve actividades'; end if;
  if exists (select 1 from public.activities where id = 'de640000-0000-4000-8000-0000000000a1') then raise exception 'FALLO: S1 lee actividades'; end if;
  begin perform public.start_activity_attempt('de640000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: S1 empezó una práctica';
  exception when insufficient_privilege then null; end;
  begin perform public.attendance_check_in('123456', null, null, null, null); raise exception 'FALLO: S1 marcó asistencia';
  exception when sqlstate '28000' then null; end;
  if jsonb_array_length(public.my_grade_breakdown()) <> 0 then raise exception 'FALLO: S1 ve sus notas'; end if;
  if public.my_control_pendiente() is not null then raise exception 'FALLO: control'; end if;
  -- la regularización sí funciona
  if jsonb_array_length(public.hist_mi_bloqueo()) <> 1 then raise exception 'FALLO: motivo del bloqueo'; end if;
  if jsonb_array_length(public.hist_pendientes()) <> 1 then raise exception 'FALLO: pendientes durante el bloqueo'; end if;
  if jsonb_array_length(public.hist_mis_secciones()) <> 1 then raise exception 'FALLO: mis secciones durante el bloqueo'; end if;
  -- el parámetro de exención no sobrevive fuera de las funciones de la regularización
  if public.my_account_ok() then raise exception 'FALLO: la exención se filtró'; end if;
end $$;

-- 3) S2 (ya terminó) trabaja con normalidad
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000012', true);
do $$ begin
  if not public.my_account_ok() or jsonb_array_length(public.hist_mi_bloqueo()) <> 0 then raise exception 'FALLO: S2 bloqueado'; end if;
  perform public.start_activity_attempt('de640000-0000-4000-8000-0000000000a1');
end $$;

-- 4) S1 termina (declara que no tiene prácticas) → vuelve a la normalidad
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
do $$ begin
  perform public.hist_finalizar('de640000-0000-4000-8000-000000000031', true, null);
  if not public.my_account_ok() or not public.activity_visible_to_me('de640000-0000-4000-8000-0000000000a1') then raise exception 'FALLO: sigue bloqueado tras terminar'; end if;
  perform public.start_activity_attempt('de640000-0000-4000-8000-0000000000a1');
end $$;

-- 5) el profesor le reabre la regularización → bloqueado otra vez; si cierra la regularización o quita el bloqueo, libre
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000001', true);
select public.hist_reabrir_estudiante('de640000-0000-4000-8000-000000000031', 'de640000-0000-4000-8000-000000000011', 'Falta la práctica 3');
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
do $$ begin if public.my_account_ok() then raise exception 'FALLO: reabierta sin bloqueo'; end if; end $$;
reset role;
update public.hist_settings set abierto = false where class_id = 'de640000-0000-4000-8000-000000000031';
set local role authenticated;
do $$ begin if not public.my_account_ok() then raise exception 'FALLO: bloqueo sin salida con la regularización cerrada'; end if; end $$;
reset role;
update public.hist_settings set abierto = true where class_id = 'de640000-0000-4000-8000-000000000031';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000001', true);
select public.hist_bloqueo_configurar('de640000-0000-4000-8000-000000000031', false) is not null;
select set_config('request.jwt.claims', '{"sub":"de640000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de640000-0000-4000-8000-000000000011', true);
do $$ begin if not public.my_account_ok() then raise exception 'FALLO: bloqueado con el bloqueo desactivado'; end if; end $$;
reset role;

do $$ begin
  if has_function_privilege('authenticated', 'public.hist_bloqueado(uuid)', 'execute') then raise exception 'FALLO: permisos'; end if;
  -- todas las funciones de la regularización llevan la exención; las auxiliares del bloqueo no
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'hist\_%'
             and p.proname not in ('hist_bloqueado', 'hist_bloqueos', 'hist_terminado') and not coalesce(p.proconfig, '{}') @> array['aula.regularizacion=on']) then
    raise exception 'FALLO: función de la regularización sin exención'; end if;
end $$;

select 'regularizacion_bloqueo.sql: PRUEBAS PASARON' as resultado;
rollback;
