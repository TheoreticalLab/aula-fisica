-- Pruebas: ficha completa del estudiante (migración 22). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d6000000-0000-4000-8000-000000000001', 'fa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ficha-a","aula_role":"teacher"}', '{}', now(), now()),
  ('d6000000-0000-4000-8000-000000000002', 'fb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ficha-b","aula_role":"teacher"}', '{}', now(), now()),
  ('d6000000-0000-4000-8000-000000000003', 'fd@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-ficha","aula_role":"admin"}', '{}', now(), now()),
  ('d6000000-0000-4000-8000-000000000004', 'fc@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ficha-c","aula_role":"teacher"}', '{}', now(), now()),
  ('d6000000-0000-4000-8000-000000000011', 'fs@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ficha"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'd6000000-%';
update public.profiles set role = 'teacher' where id in ('d6000000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000002', 'd6000000-0000-4000-8000-000000000004');
update public.profiles set role = 'admin' where id = 'd6000000-0000-4000-8000-000000000003';
update public.profiles set full_name = 'Estudiante Ficha' where id = 'd6000000-0000-4000-8000-000000000011';

insert into public.courses (id, title) values ('d6000000-0000-4000-8000-000000000021', 'Curso ficha');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt) values
  ('d6000000-0000-4000-8000-0000000000e1', 'd6000000-0000-4000-8000-000000000021', 'ficha-e1', 'numerica', 'basico', 'practice', 'numeric', 'Calcule la velocidad final');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d6000000-0000-4000-8000-000000000031', 'd6000000-0000-4000-8000-000000000021', 'Sección A', 'FICHAAA1', 'd6000000-0000-4000-8000-000000000001'),
  ('d6000000-0000-4000-8000-000000000032', 'd6000000-0000-4000-8000-000000000021', 'Sección B', 'FICHABB2', 'd6000000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('d6000000-0000-4000-8000-000000000031', 'd6000000-0000-4000-8000-000000000001'),
  ('d6000000-0000-4000-8000-000000000032', 'd6000000-0000-4000-8000-000000000002')
on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('d6000000-0000-4000-8000-000000000031', 'd6000000-0000-4000-8000-000000000011'),
  ('d6000000-0000-4000-8000-000000000032', 'd6000000-0000-4000-8000-000000000011');
insert into public.activities (id, class_id, title, mode, published) values
  ('d6000000-0000-4000-8000-0000000000a1', 'd6000000-0000-4000-8000-000000000031', 'A1 intentada', 'practice', true),
  ('d6000000-0000-4000-8000-0000000000a2', 'd6000000-0000-4000-8000-000000000031', 'A2 no intentada', 'practice', true),
  ('d6000000-0000-4000-8000-0000000000a3', 'd6000000-0000-4000-8000-000000000031', 'A3 oculta', 'practice', false),
  ('d6000000-0000-4000-8000-0000000000b1', 'd6000000-0000-4000-8000-000000000032', 'B1 de otra sección', 'practice', true);
insert into public.attempts (id, user_id, course_id, activity_id, mode, status, score, max_score, started_at, submitted_at) values
  ('d6000000-0000-4000-8000-0000000000f1', 'd6000000-0000-4000-8000-000000000011', 'd6000000-0000-4000-8000-000000000021', 'd6000000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 8, 10, now() - interval '2 days', now() - interval '2 days' + interval '20 minutes'),
  ('d6000000-0000-4000-8000-0000000000f2', 'd6000000-0000-4000-8000-000000000011', 'd6000000-0000-4000-8000-000000000021', 'd6000000-0000-4000-8000-0000000000b1', 'practice', 'submitted', 3, 10, now() - interval '1 day', now() - interval '1 day');
insert into public.responses (id, attempt_id, exercise_id, user_id, status, tries, engine_code, first_try_correct, auto_credit) values
  ('d6000000-0000-4000-8000-0000000000c1', 'd6000000-0000-4000-8000-0000000000f1', 'd6000000-0000-4000-8000-0000000000e1', 'd6000000-0000-4000-8000-000000000011', 'incorrect', 2, 'sign', false, 0);
insert into public.response_events (response_id, user_id, kind, result) values
  ('d6000000-0000-4000-8000-0000000000c1', 'd6000000-0000-4000-8000-000000000011', 'check', '{"status":"incorrect","code":"sign"}'),
  ('d6000000-0000-4000-8000-0000000000c1', 'd6000000-0000-4000-8000-000000000011', 'check', '{"status":"incorrect","code":"sign"}');
insert into public.login_attempts (login_id, user_id, ip_hash, success, reason, browser, created_at) values
  ('sint-ficha', 'd6000000-0000-4000-8000-000000000011', 'red-ficha', true, 'ok', 'Firefox 131', now() - interval '5 hours'),
  ('sint-ficha', 'd6000000-0000-4000-8000-000000000011', 'red-ficha', false, 'bad_password', 'Firefox 131', now() - interval '5 hours 1 minute');
-- estudio: dos visitas seguidas en la sección A (una sesión) y otra horas después en la sección B
insert into public.study_visits (id, user_id, session_id, course_id, class_id, section, started_at, last_beat_at, effective_seconds, visible_seconds) values
  ('d6000000-0000-4000-8000-000000000071', 'd6000000-0000-4000-8000-000000000011', 'd6000000-0000-4000-8000-000000000081', 'd6000000-0000-4000-8000-000000000021', 'd6000000-0000-4000-8000-000000000031', 'leccion', now() - interval '5 hours', now() - interval '4 hours 50 minutes', 500, 600),
  ('d6000000-0000-4000-8000-000000000072', 'd6000000-0000-4000-8000-000000000011', 'd6000000-0000-4000-8000-000000000081', 'd6000000-0000-4000-8000-000000000021', 'd6000000-0000-4000-8000-000000000031', 'leccion', now() - interval '4 hours 45 minutes', now() - interval '4 hours 35 minutes', 300, 600),
  ('d6000000-0000-4000-8000-000000000073', 'd6000000-0000-4000-8000-000000000011', 'd6000000-0000-4000-8000-000000000082', 'd6000000-0000-4000-8000-000000000021', 'd6000000-0000-4000-8000-000000000032', 'leccion', now() - interval '1 hour', now() - interval '50 minutes', 400, 600);
insert into public.grade_entries (class_id, user_id, category, score) values
  ('d6000000-0000-4000-8000-000000000031', 'd6000000-0000-4000-8000-000000000011', 'parcial1', 12),
  ('d6000000-0000-4000-8000-000000000032', 'd6000000-0000-4000-8000-000000000011', 'parcial1', 10);
insert into public.live_messages (id, sender_id, kind, body) values
  ('d6000000-0000-4000-8000-000000000091', 'd6000000-0000-4000-8000-000000000002', 'informativo', 'Mensaje del profesor B');
insert into public.live_message_recipients (message_id, user_id) values
  ('d6000000-0000-4000-8000-000000000091', 'd6000000-0000-4000-8000-000000000011');

set local role authenticated;

-- 1) el propio estudiante y un profesor que no le enseña: denegado
select set_config('request.jwt.claims', '{"sub":"d6000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd6000000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.student_dossier('d6000000-0000-4000-8000-000000000011'); raise exception 'FALLO: el estudiante vio su ficha docente';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"d6000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd6000000-0000-4000-8000-000000000004', true);
do $$ begin
  begin perform public.student_dossier('d6000000-0000-4000-8000-000000000011'); raise exception 'FALLO: un profesor ajeno vio la ficha';
  exception when insufficient_privilege then null; end;
  begin perform public.student_dossier_by_login('sint-ficha'); raise exception 'FALLO: un profesor ajeno vio la ficha por ID';
  exception when insufficient_privilege then null; end;
  -- un ID inexistente da el mismo error que uno ajeno (no revela qué cuentas existen)
  begin perform public.student_dossier_by_login('no-existe-ficha'); raise exception 'FALLO: ID inexistente';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) profesor de la sección A: todo lo de SU sección, nada de la B, sin detalle técnico de accesos
select set_config('request.jwt.claims', '{"sub":"d6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd6000000-0000-4000-8000-000000000001', true);
do $$
declare d jsonb; x jsonb;
begin
  d := public.student_dossier('d6000000-0000-4000-8000-000000000011');
  if d -> 'perfil' ->> 'full_name' <> 'Estudiante Ficha' then raise exception 'FALLO: perfil'; end if;
  if jsonb_array_length(d -> 'clases') <> 1 then raise exception 'FALLO: ve secciones ajenas (%)', jsonb_array_length(d -> 'clases'); end if;
  -- actividades publicadas de su sección: la intentada y la no intentada; ni la oculta ni la de la sección B
  if jsonb_array_length(d -> 'actividades') <> 2 then raise exception 'FALLO: actividades (%)', jsonb_array_length(d -> 'actividades'); end if;
  select a into x from jsonb_array_elements(d -> 'actividades') a where a ->> 'titulo' = 'A1 intentada';
  if (x ->> 'intentos')::int <> 1 or (x ->> 'mejor_pct')::numeric <> 80 or (x -> 'ultimo' ->> 'respondidos')::int <> 1 then raise exception 'FALLO: actividad intentada'; end if;
  select a into x from jsonb_array_elements(d -> 'actividades') a where a ->> 'titulo' = 'A2 no intentada';
  if (x ->> 'intentos')::int <> 0 then raise exception 'FALLO: actividad no intentada'; end if;
  -- estudio y sesiones (solo la sección A): 800 s en una sesión
  if (d -> 'estudio' ->> 'efectivo')::int <> 800 or (d -> 'sesiones' ->> 'total')::int <> 1 then
    raise exception 'FALLO: estudio % s, % sesiones', d -> 'estudio' ->> 'efectivo', d -> 'sesiones' ->> 'total';
  end if;
  -- respuestas y errores típicos
  if (d -> 'respuestas' ->> 'incorrectas')::int <> 1 then raise exception 'FALLO: respuestas'; end if;
  if not exists (select 1 from jsonb_array_elements(d -> 'respuestas' -> 'errores') e where e ->> 'codigo' = 'sign' and (e ->> 'n')::int = 2) then
    raise exception 'FALLO: errores típicos';
  end if;
  -- calificaciones solo de su sección
  if jsonb_array_length(d -> 'calificaciones') <> 1 then raise exception 'FALLO: notas de otra sección'; end if;
  if not exists (select 1 from jsonb_array_elements(d -> 'calificaciones' -> 0 -> 'categorias') c where c ->> 'categoria' = 'parcial1' and (c ->> 'nota')::numeric = 12) then
    raise exception 'FALLO: nota del primer parcial';
  end if;
  -- accesos: cifras sí; dispositivo y origen no (solo administrador)
  if (d -> 'accesos' ->> 'correctos')::int <> 1 or (d -> 'accesos' ->> 'fallos')::int <> 1 then raise exception 'FALLO: conteo de accesos'; end if;
  if d -> 'accesos' -> 'eventos' -> 0 ->> 'navegador' is not null or d -> 'accesos' -> 'dispositivos' <> 'null'::jsonb then
    raise exception 'FALLO: un profesor vio el detalle técnico de los accesos';
  end if;
  -- mensajes de otro profesor: no
  if jsonb_array_length(d -> 'mensajes') <> 0 then raise exception 'FALLO: ve mensajes de otro profesor'; end if;
end $$;

-- 3) administrador: todo
select set_config('request.jwt.claims', '{"sub":"d6000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd6000000-0000-4000-8000-000000000003', true);
do $$
declare d jsonb;
begin
  d := public.student_dossier('d6000000-0000-4000-8000-000000000011');
  if jsonb_array_length(d -> 'clases') <> 2 or jsonb_array_length(d -> 'calificaciones') <> 2 then raise exception 'FALLO: el administrador no ve todas las secciones'; end if;
  if (d -> 'estudio' ->> 'efectivo')::int <> 1200 or (d -> 'sesiones' ->> 'total')::int <> 2 then
    raise exception 'FALLO: sesiones del administrador (% s, %)', d -> 'estudio' ->> 'efectivo', d -> 'sesiones' ->> 'total';
  end if;
  if d -> 'accesos' -> 'eventos' -> 0 ->> 'navegador' <> 'Firefox 131' then raise exception 'FALLO: detalle técnico para el administrador'; end if;
  if jsonb_array_length(d -> 'mensajes') <> 1 then raise exception 'FALLO: mensajes para el administrador'; end if;
  if public.student_dossier_by_login('SINT-FICHA') -> 'perfil' ->> 'id' <> 'd6000000-0000-4000-8000-000000000011' then raise exception 'FALLO: ficha por ID de acceso'; end if;
  begin perform public.student_dossier('d6000000-0000-4000-8000-0000000000ff'); raise exception 'FALLO: estudiante inexistente';
  exception when no_data_found then null; end;
end $$;

reset role;
do $$ begin
  if (select count(*) from public.analytics_audit where action = 'consulta_estudiante' and detail ->> 'estudiante' = 'd6000000-0000-4000-8000-000000000011') < 2 then
    raise exception 'FALLO: las consultas de la ficha no quedaron auditadas';
  end if;
end $$;
select 'PRUEBAS DE LA FICHA DEL ESTUDIANTE PASARON' as resultado;
rollback;
