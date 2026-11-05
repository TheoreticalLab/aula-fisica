-- Pruebas: fusión de cuentas duplicadas (migración 82). Se deshace al final.
-- P = principal (900838260) · S = secundaria (9008383260, mismo nombre) · O = otro estudiante · X = examen en curso
-- T = profesor de la sección A · AD = administrador · M = monitor de A (estudiante)
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, encrypted_password) values
  ('fa820000-0000-4000-8000-000000000001', 'fu01@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-fusion","aula_role":"teacher"}', '{}', now(), now(), 'h'),
  ('fa820000-0000-4000-8000-000000000002', 'fu02@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-fusion"}', '{}', now(), now(), 'h'),
  ('fa820000-0000-4000-8000-000000000003', 'fu03@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"monitor-fusion"}', '{}', now(), now(), 'h'),
  ('fa820000-0000-4000-8000-000000000011', 'fu11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"900838260"}', '{}', now(), now(), 'h'),
  ('fa820000-0000-4000-8000-000000000012', 'fu12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"9008383260"}', '{}', now(), now(), 'h'),
  ('fa820000-0000-4000-8000-000000000013', 'fu13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"900838261"}', '{}', now(), now(), 'h'),
  ('fa820000-0000-4000-8000-000000000014', 'fu14@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"fusion-q2"}', '{}', now(), now(), 'h'),
  ('fa820000-0000-4000-8000-000000000015', 'fu15@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"fusion-x"}', '{}', now(), now(), 'h');
update public.profiles set must_change_password = false, active = true where id::text like 'fa820000-%';
update public.profiles set full_name = 'Francisco Pérez Gómez' where id in ('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012');
update public.profiles set full_name = 'Ana Rodríguez' where id = 'fa820000-0000-4000-8000-000000000013';
update public.profiles set full_name = 'Otra Persona Q' where id = 'fa820000-0000-4000-8000-000000000014';
update public.profiles set full_name = 'Xiomara Examen' where id = 'fa820000-0000-4000-8000-000000000015';
update public.profiles set role = 'teacher' where id = 'fa820000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin' where id = 'fa820000-0000-4000-8000-000000000002';
insert into auth.sessions (id, user_id, created_at) values
  ('fa820000-0000-4000-8000-0000000002a1', 'fa820000-0000-4000-8000-000000000002', now()),
  ('fa820000-0000-4000-8000-0000000002b1', 'fa820000-0000-4000-8000-000000000002', now() - interval '2 days'),
  ('fa820000-0000-4000-8000-0000000012a1', 'fa820000-0000-4000-8000-000000000012', now()),
  ('fa820000-0000-4000-8000-0000000012a2', 'fa820000-0000-4000-8000-000000000012', now() - interval '5 days');
insert into public.courses (id, title) values ('fa820000-0000-4000-8000-0000000000c1', 'Curso fusión');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-0000000000c1', 'Sección A', 'FUSION0A', 'fa820000-0000-4000-8000-000000000001'),
  ('fa820000-0000-4000-8000-0000000000b0', 'fa820000-0000-4000-8000-0000000000c1', 'Sección B', 'FUSION0B', 'fa820000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000011'), ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000012'),
  ('fa820000-0000-4000-8000-0000000000b0', 'fa820000-0000-4000-8000-000000000012'), ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000003'),
  ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000013'), ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000014'),
  ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000015');
insert into public.class_monitors (class_id, user_id) values ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000003');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points)
  values ('fa820000-0000-4000-8000-0000000000e1', 'fa820000-0000-4000-8000-0000000000c1', 'fu-1', 'numerica', 'basico', 'bank', 'numeric', 'P1', 1);
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('fa820000-0000-4000-8000-0000000000f1', 'fa820000-0000-4000-8000-0000000000a0', 'Práctica 1', 'practice', true, 'after_submit', false),
  ('fa820000-0000-4000-8000-0000000000f4', 'fa820000-0000-4000-8000-0000000000a0', 'Práctica 4', 'practice', true, 'after_submit', false),
  ('fa820000-0000-4000-8000-0000000000f6', 'fa820000-0000-4000-8000-0000000000a0', 'Práctica 6', 'practice', true, 'after_submit', false),
  ('fa820000-0000-4000-8000-0000000000f7', 'fa820000-0000-4000-8000-0000000000a0', 'Práctica 7', 'practice', true, 'after_submit', false),
  ('fa820000-0000-4000-8000-0000000000f8', 'fa820000-0000-4000-8000-0000000000a0', 'Práctica 8', 'practice', true, 'after_submit', false),
  ('fa820000-0000-4000-8000-0000000000e9', 'fa820000-0000-4000-8000-0000000000a0', 'Examen 1', 'exam', true, 'after_submit', false),
  ('fa820000-0000-4000-8000-0000000000e8', 'fa820000-0000-4000-8000-0000000000a0', 'Examen 2', 'exam', true, 'after_submit', false);
insert into public.activity_items (activity_id, exercise_id, position)
  select a.id, 'fa820000-0000-4000-8000-0000000000e1', 1 from public.activities a where a.id::text like 'fa820000-%';
-- intentos: P hizo la 1 y la 6 (75); S hizo la 4, la 6 (90), la 7 (en curso) y el Examen 1 (entregado); X tiene el Examen 2 EN CURSO
insert into public.attempts (id, user_id, course_id, activity_id, mode, status, attempt_number, started_at, submitted_at, score, max_score) values
  ('fa820000-0000-4000-8000-000000000101', 'fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-0000000000c1', 'fa820000-0000-4000-8000-0000000000f1', 'practice', 'submitted', 1, now() - interval '9 days', now() - interval '9 days', 100, 100),
  ('fa820000-0000-4000-8000-000000000106', 'fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-0000000000c1', 'fa820000-0000-4000-8000-0000000000f6', 'practice', 'submitted', 1, now() - interval '8 days', now() - interval '8 days', 75, 100),
  ('fa820000-0000-4000-8000-000000000204', 'fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000000c1', 'fa820000-0000-4000-8000-0000000000f4', 'practice', 'submitted', 1, now() - interval '7 days', now() - interval '7 days', 60, 100),
  ('fa820000-0000-4000-8000-000000000206', 'fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000000c1', 'fa820000-0000-4000-8000-0000000000f6', 'practice', 'submitted', 1, now() - interval '6 days', now() - interval '6 days', 90, 100),
  ('fa820000-0000-4000-8000-000000000207', 'fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000000c1', 'fa820000-0000-4000-8000-0000000000f7', 'practice', 'in_progress', 1, now() - interval '1 day', null, 0, 100),
  ('fa820000-0000-4000-8000-000000000209', 'fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000000c1', 'fa820000-0000-4000-8000-0000000000e9', 'exam', 'submitted', 1, now() - interval '5 days', now() - interval '5 days', 88, 100),
  ('fa820000-0000-4000-8000-000000000108', 'fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-0000000000c1', 'fa820000-0000-4000-8000-0000000000f8', 'practice', 'submitted', 1, now() - interval '4 days', now() - interval '4 days', 50, 100),
  ('fa820000-0000-4000-8000-000000000208', 'fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000000c1', 'fa820000-0000-4000-8000-0000000000f8', 'practice', 'submitted', 1, now() - interval '4 days', now() - interval '4 days', 95, 100),
  ('fa820000-0000-4000-8000-000000000508', 'fa820000-0000-4000-8000-000000000015', 'fa820000-0000-4000-8000-0000000000c1', 'fa820000-0000-4000-8000-0000000000e8', 'exam', 'in_progress', 1, now(), null, 0, 100);
insert into public.responses (id, attempt_id, exercise_id, user_id, answer, status, auto_credit, updated_at) values
  ('fa820000-0000-4000-8000-000000000301', 'fa820000-0000-4000-8000-000000000209', 'fa820000-0000-4000-8000-0000000000e1', 'fa820000-0000-4000-8000-000000000012', '{"text":"9.8 m/s^2"}', 'correct', 1, now() - interval '5 days'),
  ('fa820000-0000-4000-8000-000000000302', 'fa820000-0000-4000-8000-000000000206', 'fa820000-0000-4000-8000-0000000000e1', 'fa820000-0000-4000-8000-000000000012', '{"text":"2 m"}', 'correct', 0.9, now() - interval '6 days'),
  ('fa820000-0000-4000-8000-000000000303', 'fa820000-0000-4000-8000-000000000106', 'fa820000-0000-4000-8000-0000000000e1', 'fa820000-0000-4000-8000-000000000011', '{"text":"3 m"}', 'partial', 0.75, now() - interval '8 days');
insert into public.response_events (response_id, user_id, kind, answer) values ('fa820000-0000-4000-8000-000000000301', 'fa820000-0000-4000-8000-000000000012', 'check', '{"text":"9.8 m/s^2"}');
insert into public.exam_sessions (attempt_id, user_id, presentacion, navegacion, pausas_permitidas, pausas_max, pausa_max_total_s, pausa_detiene_reloj)
  values ('fa820000-0000-4000-8000-000000000209', 'fa820000-0000-4000-8000-000000000012', 'una_a_la_vez', 'libre', false, 0, 0, false);
insert into public.exam_events (attempt_id, user_id, tipo, exercise_id) values
  ('fa820000-0000-4000-8000-000000000209', 'fa820000-0000-4000-8000-000000000012', 'apertura', 'fa820000-0000-4000-8000-0000000000e1'),
  ('fa820000-0000-4000-8000-000000000209', 'fa820000-0000-4000-8000-000000000012', 'entrega', null);
insert into public.attempt_snapshots (attempt_id, user_id, revisiones) values ('fa820000-0000-4000-8000-000000000209', 'fa820000-0000-4000-8000-000000000012', '[]');
insert into public.telemetry_events (attempt_id, user_id, session_id, seq, kind, t_ms, data) values
  ('fa820000-0000-4000-8000-000000000209', 'fa820000-0000-4000-8000-000000000012', gen_random_uuid(), 1, 'sesion_inicio', 10, '{}');
-- notas manuales: misma sección y apartado con valor distinto (conflicto) y una nota de la sección B solo en S
insert into public.grade_entries (class_id, user_id, category, score) values
  ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000011', 'practica', 20),
  ('fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000012', 'practica', 25),
  ('fa820000-0000-4000-8000-0000000000b0', 'fa820000-0000-4000-8000-000000000012', 'parcial1', 12);
-- otras huellas del estudiante: lectura (choca), asistencia (choca), mensajes, estudio, entregas y puntos extra
insert into public.reading_progress (user_id, activity_id, seconds_read) values
  ('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-0000000000f1', 100), ('fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000000f1', 300),
  ('fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000000f4', 200);
insert into public.attendance_sessions (id, class_id, code, code_expires_at) values ('fa820000-0000-4000-8000-0000000000d1', 'fa820000-0000-4000-8000-0000000000a0', '123456', now() + interval '1 hour');
insert into public.attendance_records (session_id, user_id, method) values
  ('fa820000-0000-4000-8000-0000000000d1', 'fa820000-0000-4000-8000-000000000011', 'codigo'), ('fa820000-0000-4000-8000-0000000000d1', 'fa820000-0000-4000-8000-000000000012', 'codigo');
insert into public.study_visits (id, user_id, session_id, section, effective_seconds) values (gen_random_uuid(), 'fa820000-0000-4000-8000-000000000012', gen_random_uuid(), 'teoria', 1200);
insert into public.upload_boxes (id, class_id, title) values ('fa820000-0000-4000-8000-0000000000b9', 'fa820000-0000-4000-8000-0000000000a0', 'Buzón');
insert into public.upload_files (id, box_id, user_id, storage_path, original_name, size_bytes, sha256) values
  ('fa820000-0000-4000-8000-000000000401', 'fa820000-0000-4000-8000-0000000000b9', 'fa820000-0000-4000-8000-000000000012',
   'fa820000-0000-4000-8000-0000000000b9/fa820000-0000-4000-8000-000000000012/x.pdf', 'tarea.pdf', 1000, repeat('a', 64));
insert into public.extra_points (request_id, class_id, user_id, assigned_by, assigner_role, points, reason, status) values
  (gen_random_uuid(), 'fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-000000000001', 'profesor', 2, 'Participación', 'aprobado');
-- prácticas extraordinarias: X asignada a ambas pero solo S respondió; Y respondida en las dos (conflicto)
insert into public.pes_practicas (id, class_id, course_id, titulo) values
  ('fa820000-0000-4000-8000-0000000000aa', 'fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-0000000000c1', 'PES X'),
  ('fa820000-0000-4000-8000-0000000000ab', 'fa820000-0000-4000-8000-0000000000a0', 'fa820000-0000-4000-8000-0000000000c1', 'PES Y');
insert into public.pes_ejercicios (id, practica_id, posicion, titulo) values
  ('fa820000-0000-4000-8000-0000000000ac', 'fa820000-0000-4000-8000-0000000000aa', 1, 'E'), ('fa820000-0000-4000-8000-0000000000ad', 'fa820000-0000-4000-8000-0000000000ab', 1, 'E');
insert into public.pes_apartados (id, practica_id, ejercicio_id, posicion, enunciado, formato, peso, t_ref_s) values
  ('fa820000-0000-4000-8000-0000000000ae', 'fa820000-0000-4000-8000-0000000000aa', 'fa820000-0000-4000-8000-0000000000ac', 1, 'A', 'numeric', 1, 60),
  ('fa820000-0000-4000-8000-0000000000af', 'fa820000-0000-4000-8000-0000000000ab', 'fa820000-0000-4000-8000-0000000000ad', 1, 'A', 'numeric', 1, 60);
update public.pes_practicas set estado = 'publicada' where id::text like 'fa820000-%';
insert into public.pes_asignaciones (practica_id, user_id, version) values
  ('fa820000-0000-4000-8000-0000000000aa', 'fa820000-0000-4000-8000-000000000011', 1), ('fa820000-0000-4000-8000-0000000000aa', 'fa820000-0000-4000-8000-000000000012', 1),
  ('fa820000-0000-4000-8000-0000000000ab', 'fa820000-0000-4000-8000-000000000011', 1), ('fa820000-0000-4000-8000-0000000000ab', 'fa820000-0000-4000-8000-000000000012', 1);
insert into public.pes_estado (practica_id, user_id, estado) values
  ('fa820000-0000-4000-8000-0000000000aa', 'fa820000-0000-4000-8000-000000000011', 'no_iniciada'), ('fa820000-0000-4000-8000-0000000000aa', 'fa820000-0000-4000-8000-000000000012', 'completada'),
  ('fa820000-0000-4000-8000-0000000000ab', 'fa820000-0000-4000-8000-000000000011', 'completada'), ('fa820000-0000-4000-8000-0000000000ab', 'fa820000-0000-4000-8000-000000000012', 'completada');
insert into public.pes_respuestas (practica_id, user_id, apartado_id, accion, revelado_at, segundos, t_min_s, m, idem) values
  ('fa820000-0000-4000-8000-0000000000aa', 'fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000000ae', 'confirmada', now() - interval '3 days', 90, 60, 1, gen_random_uuid()),
  ('fa820000-0000-4000-8000-0000000000ab', 'fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-0000000000af', 'confirmada', now() - interval '3 days', 90, 60, 1, gen_random_uuid()),
  ('fa820000-0000-4000-8000-0000000000ab', 'fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000000af', 'confirmada', now() - interval '3 days', 80, 60, 1, gen_random_uuid());
-- Q2 (para la prueba de fallo a mitad): un registro de estudio
insert into public.study_visits (id, user_id, session_id, section, effective_seconds) values (gen_random_uuid(), 'fa820000-0000-4000-8000-000000000014', gen_random_uuid(), 'teoria', 60);

create function pg_temp.como(p_user text, p_sesion text default null) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_sesion)::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
  select set_config('request.path', '/rpc/prueba', true);
$$;
create temp table t (k text primary key, val jsonb);
grant all on t to authenticated;
-- copia del estado antes de fusionar (para comprobar que la vista previa no cambia nada)
create temp table antes as select 'attempts' tabla, id::text pk, user_id, md5(to_jsonb(a)::text) h from public.attempts a where a.user_id::text like 'fa820000-%'
  union all select 'responses', id::text, user_id, md5(to_jsonb(r)::text) from public.responses r where r.user_id::text like 'fa820000-%'
  union all select 'grade_entries', class_id || category, user_id, md5(to_jsonb(g)::text) from public.grade_entries g where g.user_id::text like 'fa820000-%';
grant all on antes to authenticated;

-- 0) Coherencia del registro: toda clave foránea ON DELETE CASCADE hacia profiles tiene estrategia
do $$ declare v text; begin
  select string_agg(distinct c.conrelid::regclass::text, ', ') into v
  from pg_constraint c join pg_namespace n on n.oid = (select relnamespace from pg_class where oid = c.conrelid)
  where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and c.confdeltype = 'c' and n.nspname = 'public'
    and replace(c.conrelid::regclass::text, 'public.', '') not in (select tabla from public.fusion_tablas);
  if v is not null then raise exception 'FALLO: tablas con datos del estudiante sin estrategia de fusión: %', v; end if;
end $$;

-- 1) Permisos: estudiante, monitor y profesor no pueden; anónimo tampoco; nadie lee las tablas por REST
set local role authenticated;
select pg_temp.como('fa820000-0000-4000-8000-000000000012');
do $$ begin
  begin perform public.fusion_vista_previa('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012'); raise exception 'FALLO: el estudiante simuló'; exception when insufficient_privilege then null; end;
  begin perform public.fusion_ejecutar('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012', 'x', '{}', false, 'motivo largo'); raise exception 'FALLO: el estudiante fusionó'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.fusion_operaciones; raise exception 'FALLO: leyó operaciones'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.fusion_filas; raise exception 'FALLO: leyó filas'; exception when insufficient_privilege then null; end;
  begin perform public.fusion_aplicar(gen_random_uuid()); raise exception 'FALLO: llamó al motor'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('fa820000-0000-4000-8000-000000000003');
do $$ begin
  begin perform public.fusion_ejecutar('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012', 'x', '{}', false, 'motivo largo'); raise exception 'FALLO: el monitor fusionó'; exception when insufficient_privilege then null; end;
  begin perform public.fusion_candidatos(); raise exception 'FALLO: el monitor vio candidatos'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('fa820000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.fusion_buscar('100'); raise exception 'FALLO: el profesor buscó'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.fusion_historial(); raise exception 'FALLO: anónimo'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 2) Detector (orientativo) y buscador
set local role authenticated;
select pg_temp.como('fa820000-0000-4000-8000-000000000002', 'fa820000-0000-4000-8000-0000000002a1');
do $$ declare c record; begin
  select * into c from public.fusion_candidatos() where (login_a, login_b) in (('900838260', '9008383260'), ('9008383260', '900838260'));
  if c.cuenta_a is null or c.confianza <> 'alta' or not ('mismo nombre' = any (c.razones)) or not ('un dígito añadido u omitido' = any (c.razones)) then
    raise exception 'FALLO: el detector no señala el duplicado: %', row_to_json(c);
  end if;
  select * into c from public.fusion_candidatos() where (login_a, login_b) in (('900838260', '900838261'), ('900838261', '900838260'));
  if c.cuenta_a is null or not ('los nombres NO coinciden: probablemente son personas distintas' = any (c.razones)) or c.confianza = 'alta' then raise exception 'FALLO: candidato con nombre distinto: %', row_to_json(c); end if;
  if (select count(*) from public.fusion_buscar('francisco')) < 2 or (select count(*) from public.fusion_buscar('Sección B')) < 1 then raise exception 'FALLO: buscador'; end if;
end $$;

-- 3) Vista previa sin decisiones: conflictos detectados, nada cambia
do $$ declare v jsonb; begin
  v := public.fusion_vista_previa('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012');
  if (v ->> 'ejecutable')::boolean then raise exception 'FALLO: ejecutable con conflictos sin decidir'; end if;
  if jsonb_array_length(v -> 'bloqueos') <> 0 then raise exception 'FALLO: bloqueos inesperados: %', v -> 'bloqueos'; end if;
  if not (v -> 'decisiones_pendientes' ?& array['actividad:fa820000-0000-4000-8000-0000000000f6', 'nota:fa820000-0000-4000-8000-0000000000a0:practica', 'pes:fa820000-0000-4000-8000-0000000000ab', 'actividad:fa820000-0000-4000-8000-0000000000f8'])
     or jsonb_array_length(v -> 'decisiones_pendientes') <> 4 then raise exception 'FALLO: conflictos: %', v -> 'decisiones_pendientes'; end if;
  if (select count(*) from jsonb_array_elements(v -> 'actividades') a where a ->> 'categoria' = 'solo_secundaria') <> 3 then raise exception 'FALLO: detalle de actividades: %', v -> 'actividades'; end if;
  if (v -> 'secundaria' ->> 'tiempo_s')::int <> 1200 or (v -> 'secundaria' ->> 'parcial1')::int <> 1 then raise exception 'FALLO: resumen: %', v -> 'secundaria'; end if;
end $$;

-- 4) Vista previa con decisiones: simulación exacta que no modifica nada
do $$ declare v jsonb; d jsonb := jsonb_build_object('actividad:fa820000-0000-4000-8000-0000000000f6', 'secundaria', 'actividad:fa820000-0000-4000-8000-0000000000f8', 'principal',
    'nota:fa820000-0000-4000-8000-0000000000a0:practica', 'secundaria', 'pes:fa820000-0000-4000-8000-0000000000ab', 'principal'); begin
  v := public.fusion_vista_previa('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012', d);
  if not (v ->> 'ejecutable')::boolean then raise exception 'FALLO: no ejecutable: % / %', v -> 'error_simulacion', v -> 'bloqueos'; end if;
  if (v -> 'simulacion' -> 'trasladadas' ->> 'attempts')::int <> 5 then raise exception 'FALLO: intentos a trasladar (4 de S + 1 de P al archivo): %', v -> 'simulacion' -> 'trasladadas'; end if;
  if (v -> 'simulacion' -> 'notas_principal_despues' ->> 'fa820000-0000-4000-8000-0000000000f6')::numeric <> 90 then raise exception 'FALLO: nota prevista de la práctica 6'; end if;
  insert into t values ('huella', to_jsonb(v ->> 'huella')), ('dec', d);
end $$;
reset role;
do $$ begin
  if exists (select 1 from antes x where x.h is distinct from (select md5(to_jsonb(a)::text) from public.attempts a where a.id::text = x.pk) and x.tabla = 'attempts') then
    raise exception 'FALLO: la vista previa modificó intentos';
  end if;
  -- solo las cuentas de esta prueba: en una copia de producción puede haber fusiones reales anteriores
  if exists (select 1 from public.fusion_operaciones o where o.principal::text like 'fa820000-%' or o.secundaria::text like 'fa820000-%')
     or exists (select 1 from public.fusion_filas f join public.fusion_operaciones o on o.id = f.op
                where o.principal::text like 'fa820000-%' or o.secundaria::text like 'fa820000-%') then
    raise exception 'FALLO: la simulación dejó rastros';
  end if;
end $$;

-- 5) Ejecución: exige sesión reciente; rechaza una huella vieja (los datos cambiaron)
set local role authenticated;
select pg_temp.como('fa820000-0000-4000-8000-000000000002', 'fa820000-0000-4000-8000-0000000002b1');
do $$ begin
  begin perform public.fusion_ejecutar('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012', (select val #>> '{}' from t where k = 'huella'),
      (select val from t where k = 'dec'), true, 'Activó dos veces su cuenta');
    raise exception 'FALLO: fusionó con sesión antigua'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('fa820000-0000-4000-8000-000000000002', 'fa820000-0000-4000-8000-0000000002a1');
do $$ begin
  begin perform public.fusion_ejecutar('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012', 'huella-vieja', (select val from t where k = 'dec'), true, 'Activó dos veces su cuenta');
    raise exception 'FALLO: aceptó una huella distinta';
  exception when raise_exception then if sqlerrm like 'FALLO%' or sqlerrm not like '%cambiaron%' then raise; end if; end;
  begin perform public.fusion_ejecutar('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012', (select val #>> '{}' from t where k = 'huella'), '{}', true, 'Activó dos veces su cuenta');
    raise exception 'FALLO: ejecutó sin decidir';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;

-- 6) Ejecución real
do $$ declare v jsonb; begin
  v := public.fusion_ejecutar('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012', (select val #>> '{}' from t where k = 'huella'),
    (select val from t where k = 'dec'), true, 'Activó dos veces su cuenta');
  if v ->> 'estado' <> 'auth_pendiente' then raise exception 'FALLO: estado tras ejecutar: %', v; end if;
  insert into t values ('op', to_jsonb(v ->> 'op'));
end $$;
reset role;
do $$ declare P uuid := 'fa820000-0000-4000-8000-000000000011'; S uuid := 'fa820000-0000-4000-8000-000000000012'; begin
  -- caso 1: prácticas distintas → todas en la principal; caso 2: la práctica 6 vale la de S (90) y la de P queda archivada en S
  if (select count(*) from public.attempts where user_id = P and activity_id in ('fa820000-0000-4000-8000-0000000000f1', 'fa820000-0000-4000-8000-0000000000f4', 'fa820000-0000-4000-8000-0000000000f6', 'fa820000-0000-4000-8000-0000000000f7', 'fa820000-0000-4000-8000-0000000000e9')) <> 5 then
    raise exception 'FALLO: la principal no tiene todas las actividades';
  end if;
  if (select user_id from public.attempts where id = 'fa820000-0000-4000-8000-000000000106') <> S then raise exception 'FALLO: el intento de P en la práctica 6 no quedó archivado'; end if;
  if (select max(score) from public.attempts where user_id = P and activity_id = 'fa820000-0000-4000-8000-0000000000f6' and status = 'submitted') <> 90 then raise exception 'FALLO: nota válida de la práctica 6'; end if;
  -- práctica 8 resuelta a favor de la principal: la de S (95, mayor) se queda archivada en S; nunca se toma la mayor
  if (select user_id from public.attempts where id = 'fa820000-0000-4000-8000-000000000208') <> S
     or (select max(score) from public.attempts where user_id = P and activity_id = 'fa820000-0000-4000-8000-0000000000f8') <> 50 then raise exception 'FALLO: la decisión «principal» no se respetó'; end if;
  -- caso 3: examen finalizado con todo lo suyo, intacto
  if (select concat_ws('|', user_id, status, score, submitted_at::date, started_at::date) from public.attempts where id = 'fa820000-0000-4000-8000-000000000209')
     <> concat_ws('|', P, 'submitted', 88.00, (now() - interval '5 days')::date, (now() - interval '5 days')::date) then raise exception 'FALLO: examen alterado'; end if;
  if (select user_id from public.exam_sessions where attempt_id = 'fa820000-0000-4000-8000-000000000209') <> P
     or exists (select 1 from public.exam_events where attempt_id = 'fa820000-0000-4000-8000-000000000209' and user_id <> P)
     or (select user_id from public.attempt_snapshots where attempt_id = 'fa820000-0000-4000-8000-000000000209') <> P
     or exists (select 1 from public.telemetry_events where attempt_id = 'fa820000-0000-4000-8000-000000000209' and user_id <> P)
     or (select user_id from public.response_events where response_id = 'fa820000-0000-4000-8000-000000000301') <> P then raise exception 'FALLO: evidencias del examen'; end if;
  -- caso 5: ninguna referencia rota; respuestas con su fecha original (sin «tocar»)
  if exists (select 1 from public.responses r join public.attempts a on a.id = r.attempt_id where r.user_id <> a.user_id) then raise exception 'FALLO: respuestas con otro dueño'; end if;
  if exists (select 1 from public.response_revisions r join public.attempts a on a.id = r.attempt_id where r.user_id <> a.user_id) then raise exception 'FALLO: revisiones con otro dueño'; end if;
  if (select updated_at::date from public.responses where id = 'fa820000-0000-4000-8000-000000000301') <> (now() - interval '5 days')::date then raise exception 'FALLO: cambió la fecha de la respuesta'; end if;
  -- notas manuales: conflicto resuelto con historial; la nota de la sección B pasa a la principal
  if (select score from public.grade_entries where class_id = 'fa820000-0000-4000-8000-0000000000a0' and user_id = P and category = 'practica') <> 25 then raise exception 'FALLO: nota del conflicto'; end if;
  if not exists (select 1 from public.grade_history where user_id = P and category = 'practica' and old_score = 20 and new_score = 25 and changed_by = 'fa820000-0000-4000-8000-000000000002') then raise exception 'FALLO: sin historial de la nota'; end if;
  if (select score from public.grade_entries where class_id = 'fa820000-0000-4000-8000-0000000000a0' and user_id = S and category = 'practica') <> 25 then raise exception 'FALLO: se perdió la nota de la secundaria'; end if;
  if (select user_id from public.grade_entries where class_id = 'fa820000-0000-4000-8000-0000000000b0' and category = 'parcial1') <> P then raise exception 'FALLO: nota de la sección B'; end if;
  -- caso 13: matrícula de B trasladada, la de A no se duplica
  if not exists (select 1 from public.enrollments where class_id = 'fa820000-0000-4000-8000-0000000000b0' and user_id = P) then raise exception 'FALLO: matrícula de B'; end if;
  if not exists (select 1 from public.enrollments where class_id = 'fa820000-0000-4000-8000-0000000000a0' and user_id = S) then raise exception 'FALLO: se tocó la matrícula duplicada de A'; end if;
  -- choques no académicos: se conserva lo de la principal y lo de la secundaria queda archivado
  if (select seconds_read from public.reading_progress where user_id = P and activity_id = 'fa820000-0000-4000-8000-0000000000f1') <> 100
     or (select user_id from public.reading_progress where activity_id = 'fa820000-0000-4000-8000-0000000000f4') <> P then raise exception 'FALLO: lectura'; end if;
  if (select count(*) from public.attendance_records where session_id = 'fa820000-0000-4000-8000-0000000000d1' and user_id in (P, S)) <> 2 then raise exception 'FALLO: asistencia'; end if;
  if (select user_id from public.upload_files where id = 'fa820000-0000-4000-8000-000000000401') <> P
     or (select user_id from public.study_visits where effective_seconds = 1200) <> P or (select user_id from public.extra_points where reason = 'Participación') <> P then raise exception 'FALLO: entregas, estudio o puntos'; end if;
  -- prácticas extraordinarias: X (solo S respondió) pasa entera; la asignación vacía de P queda en la bitácora; Y se queda (decisión «principal»)
  if (select user_id from public.pes_respuestas where practica_id = 'fa820000-0000-4000-8000-0000000000aa') <> P
     or (select estado from public.pes_estado where practica_id = 'fa820000-0000-4000-8000-0000000000aa' and user_id = P) <> 'completada' then raise exception 'FALLO: PES X'; end if;
  if (select count(*) from public.fusion_filas f join public.fusion_operaciones o on o.id = f.op
      where o.principal::text like 'fa820000-%' and f.accion = 'archivar' and f.tabla in ('pes_asignaciones', 'pes_estado')) <> 2 then raise exception 'FALLO: archivo de la asignación vacía'; end if;
  if (select count(*) from public.pes_respuestas where practica_id = 'fa820000-0000-4000-8000-0000000000ab' and user_id = S) <> 1 then raise exception 'FALLO: PES Y'; end if;
  -- secundaria desactivada, sin sesiones, con el ID de archivo; la principal entra con la matrícula de la secundaria
  if (select active from public.profiles where id = S) or exists (select 1 from auth.sessions where user_id = S) then raise exception 'FALLO: la secundaria sigue operativa'; end if;
  if (select login_id from public.profiles where id = P) <> '9008383260' or (select login_id from public.profiles where id = S) not like 'fusionada-%' then raise exception 'FALLO: ID de acceso'; end if;
  if not exists (select 1 from public.fusion_eventos where accion = 'ejecutar' and resultado = 'ok' and principal::text like 'fa820000-%') then raise exception 'FALLO: bitácora'; end if;
end $$;

-- caso 12: con un token emitido antes, la secundaria no puede operar sobre nada
set local role authenticated;
select pg_temp.como('fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-0000000012a1');
do $$ begin
  if public.my_account_ok() then raise exception 'FALLO: la secundaria fusionada sigue habilitada'; end if;
  if exists (select 1 from public.attempts) then raise exception 'FALLO: la secundaria ve intentos'; end if;
end $$;
-- caso 6: no se repite ni se encadena
select pg_temp.como('fa820000-0000-4000-8000-000000000002', 'fa820000-0000-4000-8000-0000000002a1');
do $$ declare v jsonb; begin
  v := public.fusion_vista_previa('fa820000-0000-4000-8000-000000000011', 'fa820000-0000-4000-8000-000000000012');
  if not (v -> 'bloqueos' @> '["La cuenta secundaria ya fue fusionada"]') then raise exception 'FALLO: permite repetir: %', v -> 'bloqueos'; end if;
  v := public.fusion_vista_previa('fa820000-0000-4000-8000-000000000012', 'fa820000-0000-4000-8000-000000000013');
  if jsonb_array_length(v -> 'bloqueos') = 0 then raise exception 'FALLO: una cuenta fusionada recibe otra'; end if;
  -- caso 4: examen en curso → bloqueado (vista previa y ejecución)
  v := public.fusion_vista_previa('fa820000-0000-4000-8000-000000000013', 'fa820000-0000-4000-8000-000000000015');
  if not exists (select 1 from jsonb_array_elements_text(v -> 'bloqueos') b where b like '%examen en curso%') then raise exception 'FALLO: examen en curso no bloquea'; end if;
  begin perform public.fusion_ejecutar('fa820000-0000-4000-8000-000000000013', 'fa820000-0000-4000-8000-000000000015', v ->> 'huella', '{}', false, 'Prueba de bloqueo');
    raise exception 'FALLO: ejecutó con un examen en curso';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  -- caso 14: datos incompatibles (cuenta de profesor) → bloqueado con informe
  v := public.fusion_vista_previa('fa820000-0000-4000-8000-000000000013', 'fa820000-0000-4000-8000-000000000001');
  if not exists (select 1 from jsonb_array_elements_text(v -> 'bloqueos') b where b like '%estudiantes%') then raise exception 'FALLO: cuenta de profesor no bloquea'; end if;
end $$;
reset role;
-- reutilización: la cuenta fusionada no se reactiva por ninguna vía
do $$ begin
  begin update public.profiles set active = true where id = 'fa820000-0000-4000-8000-000000000012'; raise exception 'FALLO: se reactivó la fusionada';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.svc_set_suspended('fa820000-0000-4000-8000-000000000002', 'fa820000-0000-4000-8000-000000000012', false); raise exception 'FALLO: Cuentas la reactivó';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;

-- caso 11: la etapa de Auth falla → queda pendiente y registrada; al reintentar, completada
set local role authenticated;
select pg_temp.como('fa820000-0000-4000-8000-000000000002', 'fa820000-0000-4000-8000-0000000002a1');
do $$ declare op uuid := (select (val #>> '{}')::uuid from t where k = 'op'); begin
  if (public.fusion_auth_resultado(op, false, 'red') ->> 'estado') <> 'auth_pendiente' then raise exception 'FALLO: Auth fallida'; end if;
  if (public.fusion_auth_resultado(op, true) ->> 'estado') <> 'completada' then raise exception 'FALLO: Auth reintento'; end if;
  if (select count(*) from public.fusion_historial() where estado = 'completada') < 1 then raise exception 'FALLO: historial'; end if;
  if ((public.fusion_detalle(op) -> 'por_tabla') ->> 'attempts')::int <> 5 then raise exception 'FALLO: detalle'; end if;
end $$;
reset role;

-- Reversión: bloqueada si la principal siguió trabajando sobre lo trasladado; posible si nada cambió
update public.responses set answer = '{"text":"cambiada"}' where id = 'fa820000-0000-4000-8000-000000000302';
set local role authenticated;
select pg_temp.como('fa820000-0000-4000-8000-000000000002', 'fa820000-0000-4000-8000-0000000002a1');
do $$ declare r jsonb; begin
  r := public.fusion_revertir((select (val #>> '{}')::uuid from t where k = 'op'), 'Prueba de reversión');
  if (r ->> 'ok')::boolean or jsonb_array_length(r -> 'cambios') = 0 then raise exception 'FALLO: revirtió con cambios posteriores: %', r; end if;
end $$;
reset role;
update public.responses set answer = '{"text":"2 m"}' where id = 'fa820000-0000-4000-8000-000000000302';
set local role authenticated;
select pg_temp.como('fa820000-0000-4000-8000-000000000002', 'fa820000-0000-4000-8000-0000000002a1');
do $$ declare r jsonb; begin
  r := public.fusion_revertir((select (val #>> '{}')::uuid from t where k = 'op'), 'Prueba de reversión');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: no revirtió: %', r; end if;
end $$;
reset role;
do $$ declare P uuid := 'fa820000-0000-4000-8000-000000000011'; S uuid := 'fa820000-0000-4000-8000-000000000012'; begin
  if exists (select 1 from antes x where x.tabla = 'attempts' and x.user_id is distinct from (select a.user_id from public.attempts a where a.id::text = x.pk)) then raise exception 'FALLO: intentos no volvieron'; end if;
  if (select score from public.grade_entries where class_id = 'fa820000-0000-4000-8000-0000000000a0' and user_id = P and category = 'practica') <> 20 then raise exception 'FALLO: nota no volvió'; end if;
  if (select estado from public.pes_estado where practica_id = 'fa820000-0000-4000-8000-0000000000aa' and user_id = P) <> 'no_iniciada'
     or (select user_id from public.pes_respuestas where practica_id = 'fa820000-0000-4000-8000-0000000000aa') <> S then raise exception 'FALLO: PES X no volvió'; end if;
  if not (select active from public.profiles where id = S) or (select login_id from public.profiles where id = S) <> '9008383260' or (select login_id from public.profiles where id = P) <> '900838260' then
    raise exception 'FALLO: cuentas no restauradas';
  end if;
  if not exists (select 1 from public.enrollments where class_id = 'fa820000-0000-4000-8000-0000000000b0' and user_id = S) then raise exception 'FALLO: matrícula no volvió'; end if;
end $$;

-- caso 10: un fallo a mitad de la actualización deshace todo (y se puede dejar constancia del intento)
create function pg_temp.falla() returns trigger language plpgsql as $$ begin raise exception 'fallo provocado a mitad de la fusión'; end $$;
create trigger falla_prueba before update of user_id on public.study_visits for each row execute function pg_temp.falla();
set local role authenticated;
select pg_temp.como('fa820000-0000-4000-8000-000000000002', 'fa820000-0000-4000-8000-0000000002a1');
do $$ declare v jsonb; begin
  v := public.fusion_vista_previa('fa820000-0000-4000-8000-000000000013', 'fa820000-0000-4000-8000-000000000014');
  begin
    perform public.fusion_ejecutar('fa820000-0000-4000-8000-000000000013', 'fa820000-0000-4000-8000-000000000014', v ->> 'huella', '{}', false, 'Prueba de fallo');
    raise exception 'FALLO: no falló';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
    perform public.fusion_registrar_fallo('fa820000-0000-4000-8000-000000000013', 'fa820000-0000-4000-8000-000000000014', sqlerrm);
  end;
end $$;
reset role;
drop trigger falla_prueba on public.study_visits;
do $$ begin
  if (select user_id from public.enrollments where class_id = 'fa820000-0000-4000-8000-0000000000a0' and user_id = 'fa820000-0000-4000-8000-000000000014') is null
     or not (select active from public.profiles where id = 'fa820000-0000-4000-8000-000000000014')
     or exists (select 1 from public.fusion_operaciones where secundaria = 'fa820000-0000-4000-8000-000000000014') then raise exception 'FALLO: el fallo dejó cambios a medias'; end if;
  if not exists (select 1 from public.fusion_eventos where secundaria = 'fa820000-0000-4000-8000-000000000014' and resultado = 'error') then raise exception 'FALLO: sin constancia del fallo'; end if;
  -- la bitácora no se altera
  begin update public.fusion_eventos set resultado = 'ok' where resultado = 'error'; raise exception 'FALLO: bitácora modificable';
  exception when insufficient_privilege then null; end;
end $$;

select 'PRUEBAS DE FUSIÓN DE CUENTAS PASARON' as resultado;
rollback;
