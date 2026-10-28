-- Pruebas: Orbe IA sin activación por parte del estudiante (migración 32). Datos sintéticos; se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d9300000-0000-4000-8000-000000000011', 'a1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-act-nuevo"}', '{}', now(), now()),
  ('d9300000-0000-4000-8000-000000000012', 'a2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-act-antes-desactivo"}', '{}', now(), now()),
  ('d9300000-0000-4000-8000-000000000013', 'a3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-act-examen"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'd9300000-%';
insert into public.courses (id, title) values ('d9300000-0000-4000-8000-000000000021', 'Curso activación');
insert into public.units (id, course_id, slug, title) values ('d9300000-0000-4000-8000-000000000031', 'd9300000-0000-4000-8000-000000000021', 'u-act', 'Unidad');
insert into public.lessons (id, unit_id, course_id, slug, title) values
  ('d9300000-0000-4000-8000-000000000041', 'd9300000-0000-4000-8000-000000000031', 'd9300000-0000-4000-8000-000000000021', 'l-act', 'Lección');
insert into public.classes (id, course_id, name, join_code) values ('d9300000-0000-4000-8000-000000000051', 'd9300000-0000-4000-8000-000000000021', 'Sección activación', 'ACTIVA01');
insert into public.enrollments (class_id, user_id) select 'd9300000-0000-4000-8000-000000000051', id from public.profiles where id::text like 'd9300000-%';
insert into public.study_visits (id, user_id, session_id, course_id, lesson_id, section, started_at, last_beat_at, effective_seconds)
  select gen_random_uuid(), id, gen_random_uuid(), 'd9300000-0000-4000-8000-000000000021', 'd9300000-0000-4000-8000-000000000041', 'teoria',
         now() - interval '6 minutes', now() - interval '15 seconds', 300
  from public.profiles where id::text like 'd9300000-%';
-- el estudiante 2 había desmarcado la casilla del perfil o pulsado «No mostrar más» con la versión anterior
insert into public.orbe_ia_prefs (user_id, disabled, last_request_at) values ('d9300000-0000-4000-8000-000000000012', true, now() - interval '1 hour')
  on conflict (user_id) do update set disabled = true, last_request_at = now() - interval '1 hour';

-- el profesor enciende Orbe IA para estudiantes en esta lección (reposición automática apagada); un chiste por revisar
update public.orbe_ia_config set enabled = true, students_enabled = true, auto_generate = false, auto_approve = false,
  interval_minutes = 10, min_activity_seconds = 180 where id = 1;
insert into public.orbe_ia_courses (course_id, enabled, all_lessons) values ('d9300000-0000-4000-8000-000000000021', true, true)
  on conflict (course_id) do update set enabled = true, all_lessons = true;
insert into public.orbe_ia_jokes (id, course_id, lesson_id, text, status, origin) values
  ('d9300000-0000-4000-8000-000000000061', 'd9300000-0000-4000-8000-000000000021', 'd9300000-0000-4000-8000-000000000041', 'Chiste todavía pendiente de revisión.', 'pendiente', 'ia');
select set_config('prueba.usos', (select count(*) from public.orbe_ia_usage)::text, true);

set local role authenticated;

-- 1) estudiante nuevo, que nunca respondió nada: el pendiente NO se muestra
select set_config('request.jwt.claims', '{"sub":"d9300000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9300000-0000-4000-8000-000000000011', true);
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9300000-0000-4000-8000-000000000041', 'teoria', null, null);
  if not (r ->> 'activo')::boolean or r ->> 'motivo' <> 'sin_chistes' then raise exception 'FALLO: con solo un pendiente debía decir sin_chistes (%)', r; end if;
end $$;

-- el profesor lo aprueba
reset role;
update public.orbe_ia_jokes set status = 'aprobado' where id = 'd9300000-0000-4000-8000-000000000061';
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9300000-0000-4000-8000-000000000011';
set local role authenticated;

-- 2) el estudiante nuevo lo recibe sin activar nada
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9300000-0000-4000-8000-000000000041', 'teoria', null, null);
  if r -> 'chiste' ->> 'id' <> 'd9300000-0000-4000-8000-000000000061' then raise exception 'FALLO: el estudiante nuevo no recibió el chiste (%)', r; end if;
end $$;

-- 3) quien lo había desactivado con la versión anterior también lo recibe; «No mostrar más» ya no desactiva
select set_config('request.jwt.claims', '{"sub":"d9300000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9300000-0000-4000-8000-000000000012', true);
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9300000-0000-4000-8000-000000000041', 'teoria', null, null);
  if r -> 'chiste' is null then raise exception 'FALLO: la desactivación antigua sigue bloqueando (%)', r; end if;
  perform public.orbe_ia_cerrar('d9300000-0000-4000-8000-000000000061', 'no_mostrar_mas');
  if (public.orbe_ia_set_pref(true) ->> 'disabled')::boolean then raise exception 'FALLO: orbe_ia_set_pref aún desactiva'; end if;
end $$;
reset role;
do $$ begin
  -- la recepción quedó registrada (evita repetirlo) y el cierre se anotó
  if (select count(*) from public.orbe_ia_deliveries where joke_id = 'd9300000-0000-4000-8000-000000000061') <> 2 then raise exception 'FALLO: recepciones no registradas'; end if;
  if (select action from public.orbe_ia_deliveries where joke_id = 'd9300000-0000-4000-8000-000000000061' and user_id = 'd9300000-0000-4000-8000-000000000012') <> 'no_mostrar_mas' then
    raise exception 'FALLO: cierre no anotado'; end if;
end $$;
insert into public.orbe_ia_jokes (course_id, lesson_id, text, status, origin) values
  ('d9300000-0000-4000-8000-000000000021', 'd9300000-0000-4000-8000-000000000041', 'Segundo chiste aprobado de la lección.', 'aprobado', 'profesor');
update public.orbe_ia_deliveries set shown_at = now() - interval '11 minutes' where user_id = 'd9300000-0000-4000-8000-000000000012';
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9300000-0000-4000-8000-000000000012';
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9300000-0000-4000-8000-000000000041', 'teoria', null, null);
  if r -> 'chiste' is null or r -> 'chiste' ->> 'texto' <> 'Segundo chiste aprobado de la lección.' then
    raise exception 'FALLO: tras «No mostrar más» debía seguir recibiendo (y sin repetir) (%)', r; end if;
end $$;

-- 4) con una evaluación en curso: nada, aunque todo esté encendido
reset role;
insert into public.activities (id, class_id, title, mode, reveal_policy, hints_enabled, published) values
  ('d9300000-0000-4000-8000-000000000071', 'd9300000-0000-4000-8000-000000000051', 'Parcial', 'exam', 'after_submit', false, true);
insert into public.attempts (user_id, course_id, activity_id, mode, status) values
  ('d9300000-0000-4000-8000-000000000013', 'd9300000-0000-4000-8000-000000000021', 'd9300000-0000-4000-8000-000000000071', 'exam', 'in_progress');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9300000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9300000-0000-4000-8000-000000000013', true);
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9300000-0000-4000-8000-000000000041', 'teoria', null, null);
  if r ->> 'motivo' <> 'evaluacion' or r -> 'chiste' is not null then raise exception 'FALLO: apareció durante una evaluación (%)', r; end if;
end $$;

-- 5) el profesor apaga la visualización para estudiantes: nada; y con el interruptor general apagado, tampoco
reset role;
update public.attempts set status = 'submitted', submitted_at = now() where user_id = 'd9300000-0000-4000-8000-000000000013';
update public.orbe_ia_prefs set last_request_at = now() - interval '1 minute' where user_id = 'd9300000-0000-4000-8000-000000000013';
update public.orbe_ia_config set students_enabled = false where id = 1;
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9300000-0000-4000-8000-000000000041', 'teoria', null, null);
  if (r ->> 'activo')::boolean or r -> 'chiste' is not null then raise exception 'FALLO: apareció con la visualización apagada (%)', r; end if;
end $$;
reset role;
update public.orbe_ia_config set students_enabled = true, enabled = false where id = 1;
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.orbe_ia_next('d9300000-0000-4000-8000-000000000041', 'teoria', null, null);
  if (r ->> 'activo')::boolean or r -> 'chiste' is not null then raise exception 'FALLO: apareció con Orbe IA apagado (%)', r; end if;
end $$;

-- 6) nada de lo anterior llamó a Claude: no hay registros nuevos de consumo
reset role;
do $$ begin
  if (select count(*) from public.orbe_ia_usage) <> current_setting('prueba.usos')::bigint then raise exception 'FALLO: se registró consumo de la API'; end if;
end $$;

select 'ORBE IA · SIN ACTIVACIÓN DEL ESTUDIANTE: PRUEBAS PASARON' as resultado;
rollback;
