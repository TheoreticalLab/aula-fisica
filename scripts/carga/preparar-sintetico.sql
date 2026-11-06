-- Auditoría de rendimiento · entorno SINTÉTICO sobre la COPIA LOCAL del respaldo (base aula_prueba). Nunca en producción.
-- 94 estudiantes ficticios (carga-001…carga-094), 1 profesor ficticio, una sección nueva en la asignatura con más
-- contenido, una práctica con 10 ejercicios publicados del banco (con clave) y telemetría v2 activada para esa asignatura.
-- Sin datos personales: nombres «Estudiante sintético N».
do $$
declare v_curso uuid; v_clase uuid := 'cafe0000-0000-4000-8000-0000000000c1'; v_act uuid := 'cafe0000-0000-4000-8000-0000000000a1';
  v_prof uuid := 'cafe0000-0000-4000-8000-000000000001'; i integer; u uuid;
begin
  if exists (select 1 from public.classes where id = v_clase) then raise notice 'ya preparado'; return; end if;
  -- asignatura con más ejercicios publicados con clave
  select e.course_id into v_curso from public.exercises e join public.exercise_keys k on k.exercise_id = e.id
    where e.published and e.format in ('numeric', 'choice') group by e.course_id order by count(*) desc limit 1;
  insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (v_prof, 'carga-prof@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"carga-prof","aula_role":"teacher"}', '{}', now(), now());
  for i in 1..94 loop
    u := ('cafe0000-0000-4000-8000-' || lpad((1000 + i)::text, 12, '0'))::uuid;
    insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (u, 'carga' || i || '@cuentas.aula.invalid', 'authenticated', 'authenticated', jsonb_build_object('login_id', 'carga-' || lpad(i::text, 3, '0')), '{}', now(), now());
  end loop;
  update public.profiles set must_change_password = false, active = true, full_name = 'Estudiante sintético ' || substr(login_id, 7) where id::text like 'cafe0000-0000-4000-8000-0000000010%';
  update public.profiles set must_change_password = false, active = true, role = 'teacher', full_name = 'Profesor sintético' where id = v_prof;
  insert into public.classes (id, course_id, name, join_code, created_by) values (v_clase, v_curso, 'CARGA SINTÉTICA', 'CARGA001', v_prof);
  insert into public.class_teachers (class_id, user_id) values (v_clase, v_prof) on conflict do nothing;
  insert into public.enrollments (class_id, user_id) select v_clase, id from public.profiles where id::text like 'cafe0000-0000-4000-8000-0000000010%';
  insert into public.activities (id, class_id, title, mode, published, reveal_policy, max_tries_per_item, max_attempts)
    values (v_act, v_clase, 'Práctica sintética de carga', 'practice', true, 'immediate', 5, 50);
  insert into public.activity_items (activity_id, exercise_id, position)
    select v_act, x.id, row_number() over (order by x.id) from (
      select e.id from public.exercises e join public.exercise_keys k on k.exercise_id = e.id
      where e.course_id = v_curso and e.published and e.format in ('numeric', 'choice') order by e.id limit 10) x;
  -- telemetría v2 como en producción (si la asignatura no la tenía)
  insert into public.telemetry_v2_flags (course_id, activo) values (v_curso, true) on conflict (course_id) do update set activo = true;
  -- sesiones de Auth (como si hubieran iniciado sesión)
  insert into auth.sessions (id, user_id, created_at)
    select gen_random_uuid(), id, now() from public.profiles where id::text like 'cafe0000-0000-4000-8000-0000000010%' or id = v_prof;
end $$;
select (select count(*) from public.enrollments where class_id = 'cafe0000-0000-4000-8000-0000000000c1') as estudiantes,
       (select count(*) from public.activity_items where activity_id = 'cafe0000-0000-4000-8000-0000000000a1') as ejercicios;
