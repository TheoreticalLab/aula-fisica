-- Pruebas: copiar una actividad a otra sección (migración 73). Se deshace al final.
-- Asignaturas A y B comparten el ejercicio «comun» (mismo identificador); «propio» solo existe en A.
-- Secciones SA (A, profesor P), SA2 (A, profesor P), SB (B, profesor P) y SX (B, otro profesor Q).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de730000-0000-4000-8000-000000000001', 'ca1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-copiar","aula_role":"teacher"}', '{}', now(), now()),
  ('de730000-0000-4000-8000-000000000002', 'ca2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-otro73","aula_role":"teacher"}', '{}', now(), now()),
  ('de730000-0000-4000-8000-000000000011', 'ca11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ca-e"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de730000-%';
update public.profiles set role = 'teacher' where id in ('de730000-0000-4000-8000-000000000001', 'de730000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de730000-0000-4000-8000-0000000000a0', 'Curso A'), ('de730000-0000-4000-8000-0000000000b0', 'Curso B');
insert into public.units (id, course_id, slug, title, position) values
  ('de730000-0000-4000-8000-0000000000a1', 'de730000-0000-4000-8000-0000000000a0', 'u', 'U', 1),
  ('de730000-0000-4000-8000-0000000000b1', 'de730000-0000-4000-8000-0000000000b0', 'u', 'U', 1);
insert into public.lessons (id, unit_id, course_id, slug, title) values
  ('de730000-0000-4000-8000-0000000000a2', 'de730000-0000-4000-8000-0000000000a1', 'de730000-0000-4000-8000-0000000000a0', 'mru', 'MRU A'),
  ('de730000-0000-4000-8000-0000000000b2', 'de730000-0000-4000-8000-0000000000b1', 'de730000-0000-4000-8000-0000000000b0', 'mru', 'MRU B');
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, published) values
  ('de730000-0000-4000-8000-0000000000e1', 'de730000-0000-4000-8000-0000000000a0', 'de730000-0000-4000-8000-0000000000a2', 'comun', 'numerica', 'basico', 'practice', 'numeric', 'Común en A', true),
  ('de730000-0000-4000-8000-0000000000e2', 'de730000-0000-4000-8000-0000000000a0', 'de730000-0000-4000-8000-0000000000a2', 'propio', 'numerica', 'basico', 'bank', 'numeric', 'Solo en A', true),
  ('de730000-0000-4000-8000-0000000000e3', 'de730000-0000-4000-8000-0000000000b0', 'de730000-0000-4000-8000-0000000000b2', 'comun', 'numerica', 'basico', 'practice', 'numeric', 'Común en B', true);
insert into public.exercise_keys (exercise_id, answer, hints, explanation) values
  ('de730000-0000-4000-8000-0000000000e2', '{"format":"numeric","value":"5 m","relTol":0.02}', '["pista"]', 'explicación');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de730000-0000-4000-8000-000000000031', 'de730000-0000-4000-8000-0000000000a0', 'SA', 'COPIA731', 'de730000-0000-4000-8000-000000000001'),
  ('de730000-0000-4000-8000-000000000032', 'de730000-0000-4000-8000-0000000000a0', 'SA2', 'COPIA732', 'de730000-0000-4000-8000-000000000001'),
  ('de730000-0000-4000-8000-000000000033', 'de730000-0000-4000-8000-0000000000b0', 'SB', 'COPIA733', 'de730000-0000-4000-8000-000000000001'),
  ('de730000-0000-4000-8000-000000000034', 'de730000-0000-4000-8000-0000000000b0', 'SX', 'COPIA734', 'de730000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('de730000-0000-4000-8000-000000000031', 'de730000-0000-4000-8000-000000000001'), ('de730000-0000-4000-8000-000000000032', 'de730000-0000-4000-8000-000000000001'),
  ('de730000-0000-4000-8000-000000000033', 'de730000-0000-4000-8000-000000000001'), ('de730000-0000-4000-8000-000000000034', 'de730000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('de730000-0000-4000-8000-000000000031', 'de730000-0000-4000-8000-000000000011');

-- la actividad de origen: dos ejercicios, examen una a la vez, diseño, publicada, con nota en el registro (Práctica 10 fijos)
insert into public.activities (id, class_id, lesson_id, title, mode, published, opens_at, closes_at, reveal_policy, hints_enabled, max_attempts, shuffle_options) values
  ('de730000-0000-4000-8000-0000000000f0', 'de730000-0000-4000-8000-000000000031', 'de730000-0000-4000-8000-0000000000a2', 'Práctica 3', 'exam', true,
   now(), now() + interval '7 days', 'after_close', false, 1, true);
insert into public.activity_items (activity_id, exercise_id, position, points) values
  ('de730000-0000-4000-8000-0000000000f0', 'de730000-0000-4000-8000-0000000000e1', 1, 2), ('de730000-0000-4000-8000-0000000000f0', 'de730000-0000-4000-8000-0000000000e2', 2, 3);
insert into public.exam_settings (activity_id, presentacion, navegacion, duracion_s) values ('de730000-0000-4000-8000-0000000000f0', 'una_a_la_vez', 'solo_adelante', 1800);
insert into public.exam_designs (activity_id, orden) values ('de730000-0000-4000-8000-0000000000f0', 'aleatorio');
insert into public.exam_design_items (activity_id, exercise_id, rol) values ('de730000-0000-4000-8000-0000000000f0', 'de730000-0000-4000-8000-0000000000e2', 'ancla');
insert into public.activity_grade_links (activity_id, class_id, category, points) values ('de730000-0000-4000-8000-0000000000f0', 'de730000-0000-4000-8000-000000000031', 'practica', 10);
-- un intento de un estudiante (no debe copiarse)
insert into public.attempts (id, user_id, course_id, activity_id, mode, status) values
  ('de730000-0000-4000-8000-0000000000d1', 'de730000-0000-4000-8000-000000000011', 'de730000-0000-4000-8000-0000000000a0', 'de730000-0000-4000-8000-0000000000f0', 'exam', 'submitted');
-- en SB la Práctica ya tiene 25 puntos fijos: los 10 no caben
insert into public.activities (id, class_id, title, mode) values ('de730000-0000-4000-8000-0000000000f9', 'de730000-0000-4000-8000-000000000033', 'Otra', 'practice');
insert into public.activity_grade_links (activity_id, class_id, category, points) values ('de730000-0000-4000-8000-0000000000f9', 'de730000-0000-4000-8000-000000000033', 'practica', 25);

set local role authenticated;
select set_config('request.path', '/rpc/prueba', true);
select set_config('request.jwt.claims', '{"sub":"de730000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de730000-0000-4000-8000-000000000001', true);
do $$ declare j jsonb; begin
  -- a una sección ajena: no
  begin perform public.actividad_copiar('de730000-0000-4000-8000-0000000000f0', 'de730000-0000-4000-8000-000000000034'); raise exception 'FALLO: copia a una sección ajena';
  exception when insufficient_privilege then null; end;

  -- 1) misma asignatura: los mismos ejercicios
  j := public.actividad_copiar('de730000-0000-4000-8000-0000000000f0', 'de730000-0000-4000-8000-000000000032');
  if not (j ->> 'misma_asignatura')::boolean or (j ->> 'ejercicios')::int <> 2 or (j ->> 'ejercicios_copiados')::int <> 0 then raise exception 'FALLO: misma asignatura %', j; end if;
  perform set_config('prueba.c1', j ->> 'id', true);

  -- 2) otra asignatura sin fechas: «comun» se enlaza con el de B, «propio» se copia con su clave
  j := public.actividad_copiar('de730000-0000-4000-8000-0000000000f0', 'de730000-0000-4000-8000-000000000033', false);
  if (j ->> 'misma_asignatura')::boolean or (j ->> 'ejercicios_enlazados')::int <> 1 or (j ->> 'ejercicios_copiados')::int <> 1
     or j ->> 'registro' <> 'practica' or not (j ->> 'registro_por_definir')::boolean then raise exception 'FALLO: otra asignatura %', j; end if;
  perform set_config('prueba.c2', j ->> 'id', true);
end $$;
reset role;

do $$ declare c1 uuid := current_setting('prueba.c1')::uuid; c2 uuid := current_setting('prueba.c2')::uuid; a public.activities; v_propio uuid; begin
  -- la copia: oculta, misma configuración, sin intentos
  select * into a from public.activities where id = c1;
  if a.published or a.title <> 'Práctica 3' or a.mode <> 'exam' or not a.shuffle_options or a.closes_at is null or a.class_id <> 'de730000-0000-4000-8000-000000000032' then
    raise exception 'FALLO: copia en la misma asignatura %', to_jsonb(a); end if;
  if (select count(*) from public.attempts where activity_id in (c1, c2)) <> 0 then raise exception 'FALLO: se copiaron intentos'; end if;
  if (select navegacion from public.exam_settings where activity_id = c1) <> 'solo_adelante' or (select orden from public.exam_designs where activity_id = c1) <> 'aleatorio'
     or (select points from public.activity_items where activity_id = c1 and exercise_id = 'de730000-0000-4000-8000-0000000000e2') <> 3 then raise exception 'FALLO: configuración'; end if;
  if (select points from public.activity_grade_links where activity_id = c1) <> 10 then raise exception 'FALLO: registro en la misma asignatura'; end if;

  -- copia en B: sin fechas (y la política «después del cierre» pasa a «después de entregar»), lección equivalente
  select * into a from public.activities where id = c2;
  if a.opens_at is not null or a.closes_at is not null or a.reveal_policy <> 'after_submit' or a.lesson_id <> 'de730000-0000-4000-8000-0000000000b2' then
    raise exception 'FALLO: copia sin fechas %', to_jsonb(a); end if;
  if not exists (select 1 from public.activity_items where activity_id = c2 and exercise_id = 'de730000-0000-4000-8000-0000000000e3') then raise exception 'FALLO: enlace por identificador'; end if;
  select e.id into v_propio from public.exercises e where e.course_id = 'de730000-0000-4000-8000-0000000000b0' and e.slug = 'propio';
  if v_propio is null or not exists (select 1 from public.exercise_keys where exercise_id = v_propio)
     or not exists (select 1 from public.activity_items where activity_id = c2 and exercise_id = v_propio)
     or not exists (select 1 from public.exam_design_items where activity_id = c2 and exercise_id = v_propio and rol = 'ancla') then raise exception 'FALLO: ejercicio copiado'; end if;
  if (select points from public.activity_grade_links where activity_id = c2) is not null then raise exception 'FALLO: valor fijo que no cabía'; end if;
  -- el original no cambió
  if (select count(*) from public.activity_items where activity_id = 'de730000-0000-4000-8000-0000000000f0') <> 2
     or not (select published from public.activities where id = 'de730000-0000-4000-8000-0000000000f0') then raise exception 'FALLO: el original cambió'; end if;
  if has_function_privilege('anon', 'public.actividad_copiar(uuid, uuid, boolean)', 'execute') then raise exception 'FALLO: permisos'; end if;
end $$;

-- un estudiante no puede copiar
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de730000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de730000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.actividad_copiar('de730000-0000-4000-8000-0000000000f0', 'de730000-0000-4000-8000-000000000031'); raise exception 'FALLO: el estudiante copia';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'copiar_actividad.sql: PRUEBAS PASARON' as resultado;
rollback;
