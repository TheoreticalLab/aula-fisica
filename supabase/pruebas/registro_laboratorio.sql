-- Pruebas: registro de calificaciones de las asignaturas de LABORATORIO (migración 90). Se deshace al final.
-- Laboratorio (courses.laboratorio_controles no nulo): parcial1 20 · parcial2 20 · parcial3 30 · práctica 30, sin examen
-- final y sin puntos extras. Una asignatura normal sigue con 15 · 15 · 15 · 30 · 25 y extras.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d9000000-0000-4000-8000-000000000001', 'rl1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-reglab","aula_role":"teacher"}', '{}', now(), now()),
  ('d9000000-0000-4000-8000-000000000011', 'rl11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-rl-a"}', '{}', now(), now()),
  ('d9000000-0000-4000-8000-000000000012', 'rl12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-rl-b"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'd9000000-%';
update public.profiles set role = 'teacher', full_name = 'Profesor Lab' where id = 'd9000000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'Ana Lab' where id = 'd9000000-0000-4000-8000-000000000011';
update public.profiles set full_name = 'Beto Normal' where id = 'd9000000-0000-4000-8000-000000000012';
insert into public.courses (id, title, laboratorio_controles) values
  ('d9000000-0000-4000-8000-000000000021', 'Laboratorio 90', 10),
  ('d9000000-0000-4000-8000-000000000022', 'Teoría 90', null);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000021', 'Sección Lab 90', 'REGLAB90', 'd9000000-0000-4000-8000-000000000001'),
  ('d9000000-0000-4000-8000-000000000032', 'd9000000-0000-4000-8000-000000000022', 'Sección Teo 90', 'REGTEO90', 'd9000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000001'),
  ('d9000000-0000-4000-8000-000000000032', 'd9000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011'),
  ('d9000000-0000-4000-8000-000000000032', 'd9000000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, closes_at) values
  ('d9000000-0000-4000-8000-0000000000a1', 'd9000000-0000-4000-8000-000000000031', 'Lab cerrada', 'practice', true, now() - interval '1 day'),
  ('d9000000-0000-4000-8000-0000000000a2', 'd9000000-0000-4000-8000-000000000032', 'Teo cerrada', 'practice', true, now() - interval '1 day');

-- ===== máximos por sección (funciones auxiliares) =====
do $$ begin
  if public.grade_category_max('d9000000-0000-4000-8000-000000000031', 'parcial1') <> 20
     or public.grade_category_max('d9000000-0000-4000-8000-000000000031', 'parcial2') <> 20
     or public.grade_category_max('d9000000-0000-4000-8000-000000000031', 'parcial3') <> 30
     or public.grade_category_max('d9000000-0000-4000-8000-000000000031', 'practica') <> 30
     or public.grade_category_max('d9000000-0000-4000-8000-000000000031', 'final') is not null then
    raise exception 'FALLO: máximos de laboratorio';
  end if;
  if public.grade_category_max('d9000000-0000-4000-8000-000000000032', 'parcial1') <> 15
     or public.grade_category_max('d9000000-0000-4000-8000-000000000032', 'parcial3') <> 15
     or public.grade_category_max('d9000000-0000-4000-8000-000000000032', 'final') <> 25 then
    raise exception 'FALLO: máximos de la asignatura normal';
  end if;
  if public.grade_extras_permitidos('d9000000-0000-4000-8000-000000000031') or not public.grade_extras_permitidos('d9000000-0000-4000-8000-000000000032') then
    raise exception 'FALLO: extras permitidos';
  end if;
  if has_function_privilege('anon', 'public.grade_category_max(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.grade_extras_permitidos(uuid)', 'execute') then
    raise exception 'FALLO: anon puede ejecutar las funciones nuevas';
  end if;
end $$;

-- ===== restricciones de tabla (sin pasar por las funciones) =====
do $$ begin
  begin
    insert into public.grade_entries (class_id, user_id, category, score) values
      ('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011', 'final', 5);
    raise exception 'FALLO: la tabla admitió un examen final en laboratorio';
  exception when check_violation then null;
  end;
  begin
    insert into public.grade_entries (class_id, user_id, category, score) values
      ('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011', 'parcial1', 20.5);
    raise exception 'FALLO: la tabla admitió 20,5 en un parcial de 20';
  exception when check_violation then null;
  end;
  begin
    insert into public.grade_entries (class_id, user_id, category, score) values
      ('d9000000-0000-4000-8000-000000000032', 'd9000000-0000-4000-8000-000000000012', 'parcial1', 16);
    raise exception 'FALLO: la tabla admitió 16 en un parcial de 15 (asignatura normal)';
  exception when check_violation then null;
  end;
  begin
    insert into public.activity_grade_links (activity_id, class_id, category, points) values
      ('d9000000-0000-4000-8000-0000000000a1', 'd9000000-0000-4000-8000-000000000031', 'final', 5);
    raise exception 'FALLO: vínculo de actividad al examen final en laboratorio';
  exception when check_violation then null;
  end;
  begin
    insert into public.grade_parts (class_id, category, label, max) values
      ('d9000000-0000-4000-8000-000000000031', 'final', 'Oral', 5);
    raise exception 'FALLO: parte de examen final en laboratorio';
  exception when check_violation then null;
  end;
  begin
    insert into public.grade_parts (class_id, category, label, max) values
      ('d9000000-0000-4000-8000-000000000031', 'parcial1', 'Oral', 20);
    raise exception 'FALLO: parte igual al apartado entero (20)';
  exception when check_violation then null;
  end;
end $$;

-- ===== profesor =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000001', true);
do $$
declare g record;
begin
  -- laboratorio: 20 · 20 · 30 · 30
  perform public.set_official_grade('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011', 'parcial1', 18);
  perform public.set_official_grade('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011', 'parcial2', 20);
  perform public.set_official_grade('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011', 'parcial3', 27.5);
  begin
    perform public.set_official_grade('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011', 'parcial3', 30.5);
    raise exception 'FALLO: aceptó 30,5 en el tercer parcial de laboratorio';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_official_grade('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011', 'parcial1', 21);
    raise exception 'FALLO: aceptó 21 en el primer parcial de laboratorio';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_official_grade('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011', 'final', 10);
    raise exception 'FALLO: aceptó examen final en laboratorio';
  exception when invalid_parameter_value then null;
  end;
  -- asignatura normal: sin cambios (15 en parciales, 25 en el final)
  perform public.set_official_grade('d9000000-0000-4000-8000-000000000032', 'd9000000-0000-4000-8000-000000000012', 'parcial1', 15);
  perform public.set_official_grade('d9000000-0000-4000-8000-000000000032', 'd9000000-0000-4000-8000-000000000012', 'final', 25);
  begin
    perform public.set_official_grade('d9000000-0000-4000-8000-000000000032', 'd9000000-0000-4000-8000-000000000012', 'parcial2', 16);
    raise exception 'FALLO: aceptó 16 en un parcial de 15 (asignatura normal)';
  exception when invalid_parameter_value then null;
  end;

  -- partes escritas a mano y vínculos de actividades con el máximo de la sección
  perform public.set_grade_part('d9000000-0000-4000-8000-000000000031', 'parcial3', 'Informe escrito', 25);
  begin
    perform public.set_grade_part('d9000000-0000-4000-8000-000000000031', 'final', 'Oral', 5);
    raise exception 'FALLO: parte del examen final en laboratorio';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_grade_part('d9000000-0000-4000-8000-000000000032', 'parcial3', 'Informe escrito', 25);
    raise exception 'FALLO: parte de 25 en un parcial de 15 (asignatura normal)';
  exception when invalid_parameter_value then null;
  end;
  perform public.set_activity_grade_link('d9000000-0000-4000-8000-0000000000a1', 'practica', 30);
  begin
    perform public.set_activity_grade_link('d9000000-0000-4000-8000-0000000000a1', 'final', 5);
    raise exception 'FALLO: actividad vinculada al examen final en laboratorio';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_activity_grade_link('d9000000-0000-4000-8000-0000000000a2', 'parcial1', 20);
    raise exception 'FALLO: vínculo de 20 en un parcial de 15 (asignatura normal)';
  exception when invalid_parameter_value then null;
  end;
  perform public.set_activity_grade_link('d9000000-0000-4000-8000-0000000000a2', 'final', 25);

  -- puntos extras: no en laboratorio; sí en la asignatura normal
  begin
    perform public.add_extra_points('d9000000-0000-4000-8000-0000000000e1', 'd9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000011', 1, 'Participación');
    raise exception 'FALLO: asignó puntos extras en laboratorio';
  exception when invalid_parameter_value then
    if sqlerrm not like '%no tiene puntos extras%' then raise exception 'FALLO: mensaje de extras: %', sqlerrm; end if;
  end;
  perform public.add_extra_points('d9000000-0000-4000-8000-0000000000e2', 'd9000000-0000-4000-8000-000000000032', 'd9000000-0000-4000-8000-000000000012', 1, 'Participación');

  -- registro de laboratorio: sin examen final, que tampoco cuenta como pendiente. La práctica vale 0 (actividad
  -- vinculada ya cerrada y sin intento, regla vigente), así que no queda nada pendiente.
  select * into g from public.gradebook_official('d9000000-0000-4000-8000-000000000031') where user_id = 'd9000000-0000-4000-8000-000000000011';
  if g.final is not null or g.parcial1 <> 18 or g.parcial2 <> 20 or g.parcial3 <> 27.5 or g.practica <> 0 then raise exception 'FALLO: notas del registro de laboratorio %', g; end if;
  if g.pendientes <> 0 or g.bruto <> 65.5 then raise exception 'FALLO: pendientes/bruto en laboratorio = %/% (esperado 0/65,5)', g.pendientes, g.bruto; end if;
  -- asignatura normal: 5 apartados y el final cuenta como pendiente
  select * into g from public.gradebook_official('d9000000-0000-4000-8000-000000000032') where user_id = 'd9000000-0000-4000-8000-000000000012';
  if g.parcial1 <> 15 or g.final <> 25 or g.pendientes <> 3 then raise exception 'FALLO: registro de la asignatura normal %', g; end if;
  if (select count(*) from public.class_activity_links('d9000000-0000-4000-8000-000000000031')) <> 1 then
    raise exception 'FALLO: class_activity_links de laboratorio';
  end if;
  perform public.set_official_grade_settings('d9000000-0000-4000-8000-000000000031', true, 5, 2, null, null, true);
end $$;

-- ===== estudiante de laboratorio: su desglose sin examen final =====
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000011', true);
do $$
declare d jsonb := public.my_grade_breakdown() -> 0 -> 'categorias';
begin
  if jsonb_array_length(d) <> 4 then raise exception 'FALLO: el estudiante de laboratorio ve % apartados', jsonb_array_length(d); end if;
  if (select string_agg(x ->> 'category' || '=' || (x ->> 'max'), ',' order by o) from jsonb_array_elements(d) with ordinality t(x, o))
     <> 'parcial1=20,parcial2=20,parcial3=30,practica=30' then
    raise exception 'FALLO: apartados del estudiante de laboratorio %', d;
  end if;
end $$;

-- ===== estudiante de la asignatura normal: sin cambios =====
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000012', true);
do $$
declare d jsonb := public.my_grade_breakdown() -> 0 -> 'categorias';
begin
  if (select string_agg(x ->> 'category' || '=' || (x ->> 'max'), ',' order by o) from jsonb_array_elements(d) with ordinality t(x, o))
     <> 'parcial1=15,parcial2=15,parcial3=15,practica=30,final=25' then
    raise exception 'FALLO: apartados del estudiante normal %', d;
  end if;
end $$;

-- ===== funciones internas (sin permiso para authenticated): apartados y puntos perdidos =====
reset role;
do $$ begin
  if has_function_privilege('authenticated', 'public.official_scores(uuid)', 'execute') then
    raise exception 'FALLO: official_scores no debe poder llamarse desde la sesión del usuario';
  end if;
  if (select count(*) from public.official_scores('d9000000-0000-4000-8000-000000000031') where category = 'final') <> 0 then
    raise exception 'FALLO: official_scores devuelve el examen final en laboratorio';
  end if;
  if (select count(*) from public.official_scores('d9000000-0000-4000-8000-000000000031')) <> 4 then
    raise exception 'FALLO: official_scores de laboratorio no tiene 4 apartados';
  end if;
  if (select count(*) from public.official_scores('d9000000-0000-4000-8000-000000000032')) <> 5 then
    raise exception 'FALLO: official_scores normal no tiene 5 apartados';
  end if;
  if exists (select 1 from public.official_lost('d9000000-0000-4000-8000-000000000031') where category = 'final') then
    raise exception 'FALLO: puntos perdidos del examen final en laboratorio';
  end if;
  if (select perdidos from public.official_lost('d9000000-0000-4000-8000-000000000031')
      where user_id = 'd9000000-0000-4000-8000-000000000011' and category = 'parcial3') <> 2.5 then
    raise exception 'FALLO: perdidos del tercer parcial (30 − 27,5)';
  end if;
  if (select perdidos from public.official_lost('d9000000-0000-4000-8000-000000000031')
      where user_id = 'd9000000-0000-4000-8000-000000000011' and category = 'parcial1') <> 2 then
    raise exception 'FALLO: perdidos del primer parcial (20 − 18)';
  end if;
end $$;

select 'registro_laboratorio.sql: PRUEBAS PASARON' as resultado;
rollback;
