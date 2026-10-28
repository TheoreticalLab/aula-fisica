-- Pruebas: Orbe IA (migración 30). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d9100000-0000-4000-8000-000000000001', 'oa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-orbe","aula_role":"admin"}', '{}', now(), now()),
  ('d9100000-0000-4000-8000-000000000002', 'ot@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-orbe","aula_role":"teacher"}', '{}', now(), now()),
  ('d9100000-0000-4000-8000-000000000011', 'o1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-orbe-1"}', '{}', now(), now()),
  ('d9100000-0000-4000-8000-000000000012', 'o2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-orbe-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'd9100000-%';
update public.profiles set role = 'admin' where id = 'd9100000-0000-4000-8000-000000000001';
update public.profiles set role = 'teacher' where id = 'd9100000-0000-4000-8000-000000000002';
insert into public.courses (id, title) values ('d9100000-0000-4000-8000-000000000021', 'Curso Orbe');
insert into public.units (id, course_id, slug, title) values ('d9100000-0000-4000-8000-000000000031', 'd9100000-0000-4000-8000-000000000021', 'u-orbe', 'Electrostática');
insert into public.lessons (id, unit_id, course_id, slug, title, summary, theory) values
  ('d9100000-0000-4000-8000-000000000041', 'd9100000-0000-4000-8000-000000000031', 'd9100000-0000-4000-8000-000000000021', 'gauss', 'Ley de Gauss',
   'Flujo y carga encerrada.', E'Intro\n\n## Flujo **eléctrico**\n\ntexto\n\n### Superficies gaussianas\n\nmás'),
  ('d9100000-0000-4000-8000-000000000042', 'd9100000-0000-4000-8000-000000000031', 'd9100000-0000-4000-8000-000000000021', 'potencial', 'Potencial', '', '');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d9100000-0000-4000-8000-000000000051', 'd9100000-0000-4000-8000-000000000021', 'Sección Orbe', 'ORBE0001', 'd9100000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values ('d9100000-0000-4000-8000-000000000051', 'd9100000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('d9100000-0000-4000-8000-000000000051', 'd9100000-0000-4000-8000-000000000011'),
  ('d9100000-0000-4000-8000-000000000051', 'd9100000-0000-4000-8000-000000000012');

-- 0) todo nace apagado
do $$ declare c public.orbe_ia_config; begin
  select * into c from public.orbe_ia_config where id = 1;
  if c.enabled or c.students_enabled or c.api_real or c.auto_approve or c.auto_generate or c.events_enabled then raise exception 'FALLO: algo nace encendido'; end if;
  if c.interval_minutes <> 10 or c.min_activity_seconds <> 180 then raise exception 'FALLO: valores iniciales'; end if;
  if public.orbe_ia_apartados('d9100000-0000-4000-8000-000000000041') <> array['Flujo **eléctrico**', 'Superficies gaussianas'] then
    raise exception 'FALLO: apartados %', public.orbe_ia_apartados('d9100000-0000-4000-8000-000000000041'); end if;
end $$;

set local role authenticated;

-- 1) estudiante: con el módulo apagado no recibe nada; no puede leer tablas, ni administrar, ni usar svc_*
select set_config('request.jwt.claims', '{"sub":"d9100000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9100000-0000-4000-8000-000000000011', true);
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', null, null);
  if (r ->> 'activo')::boolean then raise exception 'FALLO: activo con el módulo apagado (%)', r; end if;
  begin perform 1 from public.orbe_ia_config; raise exception 'FALLO: leyó la configuración'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.orbe_ia_jokes; raise exception 'FALLO: leyó los chistes'; exception when insufficient_privilege then null; end;
  begin update public.orbe_ia_config set enabled = true; raise exception 'FALLO: cambió la configuración'; exception when insufficient_privilege then null; end;
  begin perform public.orbe_ia_admin_set_config('{"enabled": true, "students_enabled": true}'); raise exception 'FALLO: un estudiante administró';
  exception when insufficient_privilege then null; end;
  begin perform public.orbe_ia_admin_get(); raise exception 'FALLO: un estudiante vio el panel'; exception when insufficient_privilege then null; end;
  begin perform public.svc_orbe_ia_reservar('d9100000-0000-4000-8000-000000000011', 'automatico', 'd9100000-0000-4000-8000-000000000041', 'teoria');
    raise exception 'FALLO: un estudiante usó svc_*'; exception when insufficient_privilege then null; end;
end $$;

-- 2) un profesor que no es administrador tampoco puede configurar
select set_config('request.jwt.claims', '{"sub":"d9100000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9100000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.orbe_ia_admin_set_config('{"enabled": true}'); raise exception 'FALLO: un profesor no administrador configuró';
  exception when insufficient_privilege then null; end;
end $$;

-- 3) el administrador enciende el módulo, la asignatura y SOLO la lección de Gauss; valida los límites
select set_config('request.jwt.claims', '{"sub":"d9100000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9100000-0000-4000-8000-000000000001', true);
do $$ declare c jsonb; begin
  c := public.orbe_ia_admin_set_config('{"enabled": true, "students_enabled": true}');
  if not (c ->> 'enabled')::boolean or (c ->> 'api_real')::boolean then raise exception 'FALLO: configuración %', c; end if;
  begin perform public.orbe_ia_admin_set_config('{"interval_minutes": 0}'); raise exception 'FALLO: aceptó intervalo 0'; exception when check_violation then null; end;
  begin perform public.orbe_ia_admin_set_config('{"model": "gpt-4"}'); raise exception 'FALLO: aceptó otro modelo'; exception when check_violation then null; end;
  perform public.orbe_ia_admin_set_course('d9100000-0000-4000-8000-000000000021', true, false, array['d9100000-0000-4000-8000-000000000041'::uuid, gen_random_uuid()]);
end $$;
reset role;
do $$ begin
  if (select lessons from public.orbe_ia_courses where course_id = 'd9100000-0000-4000-8000-000000000021') <> array['d9100000-0000-4000-8000-000000000041'::uuid] then
    raise exception 'FALLO: guardó lecciones ajenas'; end if;
end $$;

-- 4) generación con el servidor (service_role): reserva, finaliza en modo revisión, deduplica y descarta enlaces
set local role service_role;
do $$ declare r jsonb; f jsonb; begin
  r := public.svc_orbe_ia_reservar('d9100000-0000-4000-8000-000000000002', 'profesor', 'd9100000-0000-4000-8000-000000000041', 'teoria');
  if (r ->> 'ok')::boolean or r ->> 'motivo' <> 'permiso' then raise exception 'FALLO: generó un profesor no administrador (%)', r; end if;
  r := public.svc_orbe_ia_reservar('d9100000-0000-4000-8000-000000000001', 'profesor', 'd9100000-0000-4000-8000-000000000041', 'teoria', 'flujo eléctrico');
  if not (r ->> 'ok')::boolean or (r ->> 'api_real')::boolean then raise exception 'FALLO: reserva %', r; end if;
  if r -> 'contexto' ->> 'leccion' <> 'Ley de Gauss' or r -> 'contexto' ->> 'apartado' <> 'Flujo **eléctrico**' then raise exception 'FALLO: contexto %', r -> 'contexto'; end if;
  if r::text ~ '(sint-orbe|cuentas\.aula|d9100000-0000-4000-8000-0000000000(01|11))' then raise exception 'FALLO: datos personales en el contexto'; end if;
  f := public.svc_orbe_ia_finalizar((r ->> 'usage_id')::bigint, true, 0, 0,
    array['El flujo eléctrico es muy sociable: atraviesa cualquier superficie.', 'El flujo eléctrico es MUY sociable: atraviesa cualquier superficie!',
          'Visita https://x.com para más chistes de física', 'Gauss encerró la carga y el campo lo celebró.'], 0, null);
  if (f ->> 'insertados')::int <> 2 or (f ->> 'duplicados')::int <> 1 then raise exception 'FALLO: finalizar %', f; end if;
  begin perform public.svc_orbe_ia_finalizar((r ->> 'usage_id')::bigint, true, 0, 0, array['otra vez el mismo lote de chistes'], 0, null);
    raise exception 'FALLO: finalizó dos veces la misma reserva'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.orbe_ia_jokes where lesson_id = 'd9100000-0000-4000-8000-000000000041' and status <> 'pendiente') then
    raise exception 'FALLO: en modo revisión se publicaron solos'; end if;
  if exists (select 1 from public.orbe_ia_jokes where text ~ 'https?://') then raise exception 'FALLO: guardó un enlace'; end if;
end $$;

-- 5) estudiante: nada pendiente se muestra; sin actividad reciente no aparece
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9100000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9100000-0000-4000-8000-000000000011', true);
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', null, null);
  if r ->> 'motivo' <> 'actividad' then raise exception 'FALLO: sin actividad debía esperar (%)', r; end if;
end $$;

-- actividad reciente (como lo registraría study_beat) y aprobación de los chistes
reset role;
insert into public.study_visits (id, user_id, session_id, course_id, lesson_id, section, started_at, last_beat_at, effective_seconds) values
  (gen_random_uuid(), 'd9100000-0000-4000-8000-000000000011', gen_random_uuid(), 'd9100000-0000-4000-8000-000000000021', 'd9100000-0000-4000-8000-000000000041', 'teoria', now() - interval '5 minutes', now() - interval '20 seconds', 240);
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9100000-0000-4000-8000-000000000011';
update public.orbe_ia_jokes set status = 'aprobado' where lesson_id = 'd9100000-0000-4000-8000-000000000041';
insert into public.orbe_ia_jokes (course_id, lesson_id, section, text, status, origin) values
  ('d9100000-0000-4000-8000-000000000021', 'd9100000-0000-4000-8000-000000000042', 'teoria', 'Chiste de otra lección que no está habilitada.', 'aprobado', 'profesor');

-- 6) recibe un chiste; luego, el freno de 30 s; luego, el intervalo de 10 min; nunca el mismo dos veces
set local role authenticated;
do $$ declare r jsonb; v_primero text; begin
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', '## Flujo eléctrico', null);
  if r -> 'chiste' is null then raise exception 'FALLO: no recibió chiste (%)', r; end if;
  perform set_config('prueba.primero', r -> 'chiste' ->> 'id', true);
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', null, null);
  if r ->> 'motivo' <> 'demasiado_pronto' then raise exception 'FALLO: sin freno de 30 s (%)', r; end if;
end $$;
reset role;
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9100000-0000-4000-8000-000000000011';
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', null, null);
  if r ->> 'motivo' <> 'intervalo' or (r ->> 'espera')::int not between 500 and 600 then raise exception 'FALLO: intervalo (%)', r; end if;
end $$;
reset role;
update public.orbe_ia_deliveries set shown_at = now() - interval '11 minutes' where user_id = 'd9100000-0000-4000-8000-000000000011';
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9100000-0000-4000-8000-000000000011';
set local role authenticated;
do $$ declare r jsonb; begin
  -- sin apartado no salen los chistes específicos de un apartado
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', null, null);
  if r ->> 'motivo' <> 'sin_chistes' then raise exception 'FALLO: mostró un chiste de apartado fuera de su apartado (%)', r; end if;
end $$;
reset role;
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9100000-0000-4000-8000-000000000011';
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', 'Flujo eléctrico', null);
  if r -> 'chiste' is null or r -> 'chiste' ->> 'id' = current_setting('prueba.primero') then raise exception 'FALLO: repitió o no rotó (%)', r; end if;
end $$;
reset role;
update public.orbe_ia_deliveries set shown_at = now() - interval '11 minutes' where user_id = 'd9100000-0000-4000-8000-000000000011';
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9100000-0000-4000-8000-000000000011';
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', 'Flujo eléctrico', null);
  if r ->> 'motivo' <> 'sin_chistes' then raise exception 'FALLO: debía agotarse sin repetir (%)', r; end if;
end $$;

-- 7) lección no habilitada y evaluación en curso: nada
reset role;
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9100000-0000-4000-8000-000000000011';
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000042', 'teoria', null, null);
  if r ->> 'motivo' <> 'leccion_no_habilitada' then raise exception 'FALLO: lección no habilitada (%)', r; end if;
end $$;
reset role;
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9100000-0000-4000-8000-000000000011';
insert into public.orbe_ia_jokes (course_id, lesson_id, text, status, origin) values
  ('d9100000-0000-4000-8000-000000000021', 'd9100000-0000-4000-8000-000000000041', 'Chiste nuevo que no debe salir durante un examen.', 'aprobado', 'profesor');
insert into public.activities (id, class_id, title, mode, reveal_policy, hints_enabled, published) values
  ('d9100000-0000-4000-8000-000000000061', 'd9100000-0000-4000-8000-000000000051', 'Parcial', 'exam', 'after_submit', false, true);
insert into public.attempts (user_id, course_id, activity_id, mode, status) values
  ('d9100000-0000-4000-8000-000000000011', 'd9100000-0000-4000-8000-000000000021', 'd9100000-0000-4000-8000-000000000061', 'exam', 'in_progress');
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'practica', null, null);
  if r ->> 'motivo' <> 'evaluacion' or r -> 'chiste' is not null then raise exception 'FALLO: apareció durante una evaluación (%)', r; end if;
end $$;

-- 8) el estudiante los desactiva («No mostrar más»); su preferencia no afecta a otros
do $$ declare r jsonb; begin
  perform public.orbe_ia_cerrar(current_setting('prueba.primero')::uuid, 'no_mostrar_mas');
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', null, null);
  if (r ->> 'activo')::boolean then raise exception 'FALLO: siguió activo tras desactivarlo (%)', r; end if;
  if not (public.orbe_ia_my_pref() ->> 'disabled')::boolean then raise exception 'FALLO: preferencia'; end if;
end $$;

-- 9) límites de gasto en el servidor: presupuesto mensual y llamadas diarias
reset role;
update public.orbe_ia_config set api_real = true, monthly_budget_usd = 0.01, max_output_tokens = 3000 where id = 1;
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_orbe_ia_reservar('d9100000-0000-4000-8000-000000000001', 'profesor', 'd9100000-0000-4000-8000-000000000041', 'teoria');
  if (r ->> 'ok')::boolean or r ->> 'motivo' <> 'presupuesto' then raise exception 'FALLO: superó el presupuesto (%)', r; end if;
end $$;
reset role;
update public.orbe_ia_config set monthly_budget_usd = 100, daily_max_calls = 1 where id = 1;
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_orbe_ia_reservar('d9100000-0000-4000-8000-000000000001', 'profesor', 'd9100000-0000-4000-8000-000000000041', 'teoria');
  if (r ->> 'ok')::boolean or r ->> 'motivo' <> 'limite_diario' then raise exception 'FALLO: superó el límite diario (%)', r; end if;
end $$;
-- coste de una llamada real: 1000 de entrada y 2000 de salida con Opus 5.5 = 0,004 + 0,04
reset role;
update public.orbe_ia_config set daily_max_calls = 10 where id = 1;
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_orbe_ia_reservar('d9100000-0000-4000-8000-000000000001', 'profesor', 'd9100000-0000-4000-8000-000000000041', null);
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: reserva real (%)', r; end if;
  perform public.svc_orbe_ia_finalizar((r ->> 'usage_id')::bigint, true, 1000, 2000, array['La carga encerrada es la que manda en el flujo neto.'], 1, null);
  perform set_config('prueba.usage', r ->> 'usage_id', true);
end $$;
reset role;
do $$ begin
  if (select cost_usd from public.orbe_ia_usage where id = current_setting('prueba.usage')::bigint) <> 0.044 then raise exception 'FALLO: coste mal calculado'; end if;
end $$;
set local role service_role;

-- 10) reposición automática: solo con la opción activada; y el interruptor general lo apaga todo
do $$ declare r jsonb; begin
  r := public.svc_orbe_ia_reservar('d9100000-0000-4000-8000-000000000012', 'automatico', 'd9100000-0000-4000-8000-000000000041', 'teoria');
  if (r ->> 'ok')::boolean or r ->> 'motivo' <> 'auto_apagado' then raise exception 'FALLO: repuso sin permiso (%)', r; end if;
end $$;
reset role;
update public.orbe_ia_config set enabled = false where id = 1;
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_orbe_ia_reservar('d9100000-0000-4000-8000-000000000001', 'profesor', 'd9100000-0000-4000-8000-000000000041', 'teoria');
  if (r ->> 'ok')::boolean or r ->> 'motivo' <> 'apagado' then raise exception 'FALLO: generó con el módulo apagado (%)', r; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9100000-0000-4000-8000-000000000012', true);
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9100000-0000-4000-8000-000000000041', 'teoria', null, null);
  if (r ->> 'activo')::boolean then raise exception 'FALLO: apareció con el módulo apagado (%)', r; end if;
end $$;

select 'ORBE IA: PRUEBAS PASARON' as resultado;
rollback;
