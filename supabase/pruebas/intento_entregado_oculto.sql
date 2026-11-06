-- Pruebas: migración 89 (evaluación con soluciones «nunca»: el intento entregado no se vuelve a abrir). Se deshace.
--  · mientras responde: el estudiante recibe sus preguntas como siempre;
--  · entregado: el AUTOR recibe el intento sin preguntas ni respuestas (contenido_oculto), ni rastro de los enunciados;
--  · el profesorado lo sigue viendo todo; otras políticas de soluciones y las prácticas no cambian.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('b8900000-0000-4000-8000-000000000001', 'b89p@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b89-prof","aula_role":"teacher"}', '{}', now(), now()),
  ('b8900000-0000-4000-8000-000000000011', 'b89a@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b89-est"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'b8900000-%';
update public.profiles set role = 'teacher' where id = 'b8900000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('b8900000-0000-4000-8000-000000000021', 'Curso 89');
insert into public.course_staff (course_id, user_id) values ('b8900000-0000-4000-8000-000000000021', 'b8900000-0000-4000-8000-000000000001');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('b8900000-0000-4000-8000-000000000031', 'b8900000-0000-4000-8000-000000000021', 'Sección 89', 'OCULTO89', 'b8900000-0000-4000-8000-000000000001');
insert into public.enrollments (class_id, user_id) values ('b8900000-0000-4000-8000-000000000031', 'b8900000-0000-4000-8000-000000000011');
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, published) values
  ('b8900000-0000-4000-8000-0000000000e1', 'b8900000-0000-4000-8000-000000000021', null, 'b89-d1', 'desarrollo', 'intermedio', 'bank', 'open', 'ENUNCIADO-SECRETO-1', true),
  ('b8900000-0000-4000-8000-0000000000e2', 'b8900000-0000-4000-8000-000000000021', null, 'b89-d2', 'desarrollo', 'intermedio', 'bank', 'open', 'ENUNCIADO-SECRETO-2', true);
insert into public.exercise_keys (exercise_id, answer, hints, explanation)
  select id, '{"format":"open","rubric":"RUBRICA"}', '[]', 'MODELO' from public.exercises where id::text like 'b8900000-%';
-- A: evaluación «nunca» (la del laboratorio) · B: evaluación «al entregar» · C: práctica «nunca»
insert into public.activities (id, class_id, title, mode, published, reveal_policy, max_attempts, max_tries_per_item, hints_enabled) values
  ('b8900000-0000-4000-8000-0000000000a1', 'b8900000-0000-4000-8000-000000000031', 'Evaluación nunca', 'exam', true, 'never', 1, 1, false),
  ('b8900000-0000-4000-8000-0000000000a2', 'b8900000-0000-4000-8000-000000000031', 'Evaluación al entregar', 'exam', true, 'after_submit', 1, 1, false),
  ('b8900000-0000-4000-8000-0000000000a3', 'b8900000-0000-4000-8000-000000000031', 'Práctica nunca', 'practice', true, 'never', null, 3, false);
insert into public.activity_items (activity_id, exercise_id, position)
  select a.id, e.id, row_number() over (partition by a.id order by e.slug)
  from public.activities a cross join public.exercises e where a.id::text like 'b8900000-%' and e.id::text like 'b8900000-%';

create temporary table b89_int (act text primary key, id uuid) on commit drop;
grant all on b89_int to authenticated;

-- el estudiante empieza las tres y, mientras responde, ve sus preguntas
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b8900000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8900000-0000-4000-8000-000000000011', true);
select set_config('request.path', '/rest/v1/rpc/get_attempt', true);
insert into b89_int values
  ('A', public.start_activity_attempt('b8900000-0000-4000-8000-0000000000a1')),
  ('B', public.start_activity_attempt('b8900000-0000-4000-8000-0000000000a2')),
  ('C', public.start_activity_attempt('b8900000-0000-4000-8000-0000000000a3'));
do $$ declare v jsonb; begin
  v := public.get_attempt((select id from b89_int where act = 'A'));
  if jsonb_array_length(v -> 'items') <> 2 or (v -> 'flags' ->> 'contenido_oculto')::boolean then
    raise exception 'FALLO: en curso, el estudiante debe ver sus 2 preguntas (vio %)', jsonb_array_length(v -> 'items');
  end if;
end $$;
reset role;

-- entrega (como lo haría la calificación) con una respuesta escrita
update public.responses set answer = '{"text":"MI-RESPUESTA"}' where attempt_id in (select id from b89_int);
update public.attempts set status = 'submitted', submitted_at = now() where id in (select id from b89_int);

set local role authenticated;
do $$ declare v jsonb; begin
  v := public.get_attempt((select id from b89_int where act = 'A'));
  if jsonb_array_length(v -> 'items') <> 0 then raise exception 'FALLO: el autor sigue viendo las preguntas de una evaluación «nunca» entregada'; end if;
  if not (v -> 'flags' ->> 'contenido_oculto')::boolean then raise exception 'FALLO: falta contenido_oculto'; end if;
  if v::text ~ 'ENUNCIADO-SECRETO|MI-RESPUESTA|RUBRICA|MODELO' then raise exception 'FALLO: el resultado contiene enunciados, respuestas o claves: %', left(v::text, 200); end if;
  if v -> 'attempt' ->> 'status' <> 'submitted' or v -> 'activity' ->> 'title' <> 'Evaluación nunca' then
    raise exception 'FALLO: el resumen del intento (estado y título) debe seguir disponible';
  end if;
  -- evaluación «al entregar» y práctica «nunca»: sin cambios
  v := public.get_attempt((select id from b89_int where act = 'B'));
  if jsonb_array_length(v -> 'items') <> 2 or (v -> 'flags' ->> 'contenido_oculto')::boolean then raise exception 'FALLO: cambió la evaluación «al entregar»'; end if;
  v := public.get_attempt((select id from b89_int where act = 'C'));
  if jsonb_array_length(v -> 'items') <> 2 or (v -> 'flags' ->> 'contenido_oculto')::boolean then raise exception 'FALLO: cambió la práctica'; end if;
  -- y por REST tampoco: enunciados del banco y composición de la actividad
  if exists (select 1 from public.exercises where id::text like 'b8900000-%') then raise exception 'FALLO: lee los enunciados por REST'; end if;
  if exists (select 1 from public.activity_items where activity_id::text like 'b8900000-%') then raise exception 'FALLO: lee la composición por REST'; end if;
end $$;

-- el profesor lo ve todo para corregir
select set_config('request.jwt.claims', '{"sub":"b8900000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8900000-0000-4000-8000-000000000001', true);
do $$ declare v jsonb; begin
  v := public.get_attempt((select id from b89_int where act = 'A'));
  if jsonb_array_length(v -> 'items') <> 2 or (v -> 'flags' ->> 'contenido_oculto')::boolean then raise exception 'FALLO: el profesor no ve el intento completo'; end if;
  if v::text !~ 'MI-RESPUESTA' or v::text !~ 'ENUNCIADO-SECRETO-1' then raise exception 'FALLO: el profesor no ve preguntas y respuestas'; end if;
end $$;
reset role;

select 'INTENTO ENTREGADO OCULTO: PRUEBAS PASARON' as resultado;
rollback;
