-- Pruebas: centro de mando del profesor (migración 92). Se deshace al final.
-- tablero_docente(): conectados (latido < 150 s), examen en marcha, asistencia de hoy, archivos cuya entrega vigente está
-- «recibida», no entregaron (cerradas en 30 días), sin entrar (7 días). Cada profesor ve solo sus secciones no archivadas;
-- un estudiante no puede llamarla. tablero_eventos(): recuentos agrupados, sin nombres, solo de las secciones propias.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('dc920000-0000-4000-8000-000000000001', 'tb1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-tb-1","aula_role":"teacher"}', '{}', now(), now()),
  ('dc920000-0000-4000-8000-000000000002', 'tb2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-tb-2","aula_role":"teacher"}', '{}', now(), now()),
  ('dc920000-0000-4000-8000-000000000011', 'tb11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tb-a"}', '{}', now(), now()),
  ('dc920000-0000-4000-8000-000000000012', 'tb12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tb-b"}', '{}', now(), now()),
  ('dc920000-0000-4000-8000-000000000013', 'tb13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tb-c"}', '{}', now(), now()),
  ('dc920000-0000-4000-8000-000000000014', 'tb14@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tb-d"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'dc920000-%';
update public.profiles set role = 'teacher', full_name = 'Profesora Tablero' where id = 'dc920000-0000-4000-8000-000000000001';
update public.profiles set role = 'teacher', full_name = 'Profesor Ajeno' where id = 'dc920000-0000-4000-8000-000000000002';
update public.profiles set full_name = 'Ana Tablero' where id = 'dc920000-0000-4000-8000-000000000011';
update public.profiles set full_name = 'Beto Tablero' where id = 'dc920000-0000-4000-8000-000000000012';
update public.profiles set full_name = 'Caro Tablero' where id = 'dc920000-0000-4000-8000-000000000013';
update public.profiles set full_name = 'Dani Ajeno' where id = 'dc920000-0000-4000-8000-000000000014';
insert into public.courses (id, title) values ('dc920000-0000-4000-8000-000000000021', 'Asignatura Tablero 92');
insert into public.classes (id, course_id, name, join_code, created_by, archived) values
  ('dc920000-0000-4000-8000-000000000031', 'dc920000-0000-4000-8000-000000000021', 'Sección Tablero A', 'TABL92AA', 'dc920000-0000-4000-8000-000000000001', false),
  ('dc920000-0000-4000-8000-000000000032', 'dc920000-0000-4000-8000-000000000021', 'Sección Tablero B', 'TABL92BB', 'dc920000-0000-4000-8000-000000000002', false),
  ('dc920000-0000-4000-8000-000000000033', 'dc920000-0000-4000-8000-000000000021', 'Sección Tablero Vieja', 'TABL92CC', 'dc920000-0000-4000-8000-000000000001', true);
insert into public.class_teachers (class_id, user_id) values
  ('dc920000-0000-4000-8000-000000000031', 'dc920000-0000-4000-8000-000000000001'),
  ('dc920000-0000-4000-8000-000000000033', 'dc920000-0000-4000-8000-000000000001'),
  ('dc920000-0000-4000-8000-000000000032', 'dc920000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id, enrolled_at) values
  ('dc920000-0000-4000-8000-000000000031', 'dc920000-0000-4000-8000-000000000011', now() - interval '20 days'),
  ('dc920000-0000-4000-8000-000000000031', 'dc920000-0000-4000-8000-000000000012', now() - interval '20 days'),
  ('dc920000-0000-4000-8000-000000000031', 'dc920000-0000-4000-8000-000000000013', now() - interval '20 days'),
  ('dc920000-0000-4000-8000-000000000032', 'dc920000-0000-4000-8000-000000000014', now() - interval '20 days');

-- A: una práctica cerrada hace 2 días (entregó solo Ana) y un examen abierto que cierra en 2 h (Ana lo está haciendo)
insert into public.activities (id, class_id, title, mode, published, opens_at, closes_at, reveal_policy, hints_enabled) values
  ('dc920000-0000-4000-8000-0000000000a1', 'dc920000-0000-4000-8000-000000000031', 'Práctica cerrada 92', 'practice', true, now() - interval '5 days', now() - interval '2 days', 'immediate', true),
  ('dc920000-0000-4000-8000-0000000000a2', 'dc920000-0000-4000-8000-000000000031', 'Parcial 92', 'exam', true, now() - interval '1 hour', now() + interval '2 hours', 'after_submit', false),
  ('dc920000-0000-4000-8000-0000000000a3', 'dc920000-0000-4000-8000-000000000032', 'Práctica ajena 92', 'practice', true, now() - interval '5 days', now() - interval '2 days', 'immediate', true);
insert into public.attempts (user_id, course_id, activity_id, mode, status, started_at, submitted_at, score, max_score) values
  ('dc920000-0000-4000-8000-000000000011', 'dc920000-0000-4000-8000-000000000021', 'dc920000-0000-4000-8000-0000000000a1', 'practice', 'submitted', now() - interval '3 days', now() - interval '3 days', 8, 10),
  ('dc920000-0000-4000-8000-000000000014', 'dc920000-0000-4000-8000-000000000021', 'dc920000-0000-4000-8000-0000000000a3', 'practice', 'submitted', now() - interval '3 days', now() - interval '3 days', 8, 10);
insert into public.attempts (user_id, course_id, activity_id, mode, status, started_at) values
  ('dc920000-0000-4000-8000-000000000011', 'dc920000-0000-4000-8000-000000000021', 'dc920000-0000-4000-8000-0000000000a2', 'exam', 'in_progress', now() - interval '10 minutes');

-- presencia: Ana conectada ahora; Beto dejó de latir hace 10 minutos
insert into public.presence_connections (conn_id, user_id, visible, last_seen) values
  ('dc920000-0000-4000-8000-0000000000c1', 'dc920000-0000-4000-8000-000000000011', true, now() - interval '30 seconds'),
  ('dc920000-0000-4000-8000-0000000000c2', 'dc920000-0000-4000-8000-000000000012', true, now() - interval '10 minutes');
-- uso del aula: Ana hoy, Beto hace 10 días, Caro nunca
insert into public.cuenta_actividad (user_id, ultimo_uso) values
  ('dc920000-0000-4000-8000-000000000011', now() - interval '1 minute'),
  ('dc920000-0000-4000-8000-000000000012', now() - interval '10 days')
  on conflict (user_id) do update set ultimo_uso = excluded.ultimo_uso;
delete from public.cuenta_actividad where user_id = 'dc920000-0000-4000-8000-000000000013';
-- asistencia de hoy, abierta, con Ana presente
insert into public.attendance_sessions (id, class_id, code, code_expires_at, opened_by) values
  ('dc920000-0000-4000-8000-0000000000d1', 'dc920000-0000-4000-8000-000000000031', '654321', now() + interval '1 hour', 'dc920000-0000-4000-8000-000000000001');
insert into public.attendance_records (session_id, user_id, method) values
  ('dc920000-0000-4000-8000-0000000000d1', 'dc920000-0000-4000-8000-000000000011', 'codigo');
-- buzón con aprobación: Ana «recibido»; Beto rechazado y luego «recibido» (cuenta el último); Caro aceptado
insert into public.upload_boxes (id, class_id, title, requires_approval, created_by) values
  ('dc920000-0000-4000-8000-0000000000e1', 'dc920000-0000-4000-8000-000000000031', 'Buzón 92', true, 'dc920000-0000-4000-8000-000000000001');
insert into public.upload_files (id, box_id, user_id, storage_path, original_name, size_bytes, sha256, mime, uploaded_at, status) values
  (gen_random_uuid(), 'dc920000-0000-4000-8000-0000000000e1', 'dc920000-0000-4000-8000-000000000011', 'tb92/a.pdf', 'a.pdf', 1000, repeat('a', 64), 'image/jpeg', now() - interval '2 hours', 'recibido'),
  (gen_random_uuid(), 'dc920000-0000-4000-8000-0000000000e1', 'dc920000-0000-4000-8000-000000000012', 'tb92/b1.pdf', 'b.pdf', 1000, repeat('b', 64), 'image/jpeg', now() - interval '3 hours', 'rechazado'),
  (gen_random_uuid(), 'dc920000-0000-4000-8000-0000000000e1', 'dc920000-0000-4000-8000-000000000012', 'tb92/b2.pdf', 'b.pdf', 1000, repeat('c', 64), 'image/jpeg', now() - interval '1 hour', 'recibido'),
  (gen_random_uuid(), 'dc920000-0000-4000-8000-0000000000e1', 'dc920000-0000-4000-8000-000000000013', 'tb92/c.pdf', 'c.pdf', 1000, repeat('d', 64), 'image/jpeg', now() - interval '2 hours', 'aceptado');

do $$ begin
  if has_function_privilege('anon', 'public.tablero_docente()', 'execute') or has_function_privilege('anon', 'public.tablero_eventos(integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.tablero_docente()', 'execute')
     or not has_function_privilege('authenticated', 'public.tablero_eventos(integer)', 'execute') then
    raise exception 'FALLO: permisos de las funciones del tablero';
  end if;
end $$;

-- ===== la profesora de la sección A =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dc920000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc920000-0000-4000-8000-000000000001', true);
do $$
declare t jsonb; s jsonb; ev jsonb; x jsonb;
begin
  t := public.tablero_docente();
  if jsonb_array_length(t -> 'secciones') <> 1 then raise exception 'FALLO: debía ver 1 sección (ni la ajena ni la archivada) y ve %', jsonb_array_length(t -> 'secciones'); end if;
  s := t -> 'secciones' -> 0;
  if s ->> 'class_id' <> 'dc920000-0000-4000-8000-000000000031' then raise exception 'FALLO: sección equivocada'; end if;
  if (s ->> 'estudiantes')::int <> 3 then raise exception 'FALLO: estudiantes = %', s ->> 'estudiantes'; end if;
  if (s ->> 'conectados')::int <> 1 then raise exception 'FALLO: conectados = % (solo Ana late)', s ->> 'conectados'; end if;
  if (s ->> 'abiertas')::int <> 1 then raise exception 'FALLO: abiertas = %', s ->> 'abiertas'; end if;
  if (s ->> 'por_revisar')::int <> 0 then raise exception 'FALLO: por_revisar = %', s ->> 'por_revisar'; end if;
  if (s ->> 'archivos_por_revisar')::int <> 2 then raise exception 'FALLO: archivos_por_revisar = % (Ana y la última de Beto)', s ->> 'archivos_por_revisar'; end if;
  if (s ->> 'solicitudes_acceso')::int <> 0 then raise exception 'FALLO: solicitudes_acceso = %', s ->> 'solicitudes_acceso'; end if;
  if (s -> 'asistencia' ->> 'presentes')::int <> 1 or not (s -> 'asistencia' ->> 'abierta')::boolean then raise exception 'FALLO: asistencia de hoy %', s -> 'asistencia'; end if;
  if jsonb_array_length(s -> 'examenes') <> 1 then raise exception 'FALLO: exámenes en marcha %', s -> 'examenes'; end if;
  x := s -> 'examenes' -> 0;
  if x ->> 'title' <> 'Parcial 92' or (x ->> 'en_curso')::int <> 1 or (x ->> 'entregados')::int <> 0 or (x ->> 'convocados')::int <> 3 then
    raise exception 'FALLO: examen %', x; end if;
  if (s ->> 'no_entregaron')::int <> 2 then raise exception 'FALLO: no_entregaron = % (Beto y Caro)', s ->> 'no_entregaron'; end if;
  if (s ->> 'sin_entrar')::int <> 2 then raise exception 'FALLO: sin_entrar = % (Beto y Caro)', s ->> 'sin_entrar'; end if;
  if s ? 'join_code' or t::text like '%Ana Tablero%' then raise exception 'FALLO: el tablero no debe traer códigos ni nombres de estudiantes'; end if;

  ev := public.tablero_eventos(7);
  if exists (select 1 from jsonb_array_elements(ev) e where e ->> 'class_id' <> 'dc920000-0000-4000-8000-000000000031') then
    raise exception 'FALLO: eventos de secciones ajenas'; end if;
  if not exists (select 1 from jsonb_array_elements(ev) e where e ->> 'tipo' = 'entregas' and e ->> 'titulo' = 'Práctica cerrada 92' and (e ->> 'n')::int = 1) then
    raise exception 'FALLO: falta el evento de entregas %', ev; end if;
  if not exists (select 1 from jsonb_array_elements(ev) e where e ->> 'tipo' = 'archivos' and e ->> 'titulo' = 'Buzón 92' and (e ->> 'n')::int = 4) then
    raise exception 'FALLO: falta el evento de archivos %', ev; end if;
  if not exists (select 1 from jsonb_array_elements(ev) e where e ->> 'tipo' = 'asistencia' and (e ->> 'n')::int = 1 and e ->> 'modo' = 'abierta') then
    raise exception 'FALLO: falta el evento de asistencia'; end if;
  if not exists (select 1 from jsonb_array_elements(ev) e where e ->> 'tipo' = 'cierre' and e ->> 'titulo' = 'Práctica cerrada 92' and (e ->> 'n')::int = 1) then
    raise exception 'FALLO: falta el evento de cierre'; end if;
  if ev::text like '%Tablero%' and ev::text like '%Ana%' then raise exception 'FALLO: los eventos no deben traer nombres de estudiantes'; end if;
  -- el periodo se acota entre 1 y 30 días
  if jsonb_array_length(public.tablero_eventos(0)) <> 2 then raise exception 'FALLO: con 1 día quedan los archivos y la asistencia de hoy, hay %', public.tablero_eventos(0); end if;
end $$;

-- ===== el profesor de la sección B: solo la suya =====
select set_config('request.jwt.claims', '{"sub":"dc920000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc920000-0000-4000-8000-000000000002', true);
do $$
declare t jsonb;
begin
  t := public.tablero_docente();
  if jsonb_array_length(t -> 'secciones') <> 1 or t -> 'secciones' -> 0 ->> 'class_id' <> 'dc920000-0000-4000-8000-000000000032' then
    raise exception 'FALLO: el profesor B debía ver solo su sección'; end if;
  if (t -> 'secciones' -> 0 ->> 'no_entregaron')::int <> 0 or (t -> 'secciones' -> 0 -> 'asistencia') <> 'null'::jsonb then
    raise exception 'FALLO: datos de la sección B %', t -> 'secciones' -> 0; end if;
  if exists (select 1 from jsonb_array_elements(public.tablero_eventos(7)) e where e ->> 'class_id' <> 'dc920000-0000-4000-8000-000000000032') then
    raise exception 'FALLO: el profesor B ve eventos ajenos'; end if;
end $$;

-- ===== una estudiante no puede =====
select set_config('request.jwt.claims', '{"sub":"dc920000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc920000-0000-4000-8000-000000000011', true);
do $$ begin
  begin
    perform public.tablero_docente();
    raise exception 'FALLO: una estudiante pudo leer el tablero';
  exception when insufficient_privilege then null; end;
  begin
    perform public.tablero_eventos(7);
    raise exception 'FALLO: una estudiante pudo leer los eventos';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'tablero_docente.sql: PRUEBAS PASARON' as resultado;
rollback;
