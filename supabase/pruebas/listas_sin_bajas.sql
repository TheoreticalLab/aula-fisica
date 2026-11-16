-- Pruebas: las listas de seguimiento no muestran a los dados de baja ni a las cuentas suspendidas (migración 96).
-- Tres estudiantes con un intento entregado en la misma actividad: Ana (activa), Beto (dado de baja), Caro (suspendida).
-- Solo Ana debe aparecer en activity_stats, gradebook (Seguimiento), exam_monitor, exam_integridad_resumen,
-- practica_tiempo_intentos, hist_resumen, el registro oficial y la asistencia; al reactivar a Caro vuelve; los
-- intentos de Beto y Caro siguen guardados. Se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ba960000-0000-4000-8000-000000000001', 'ls1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ls-1","aula_role":"teacher"}', '{}', now(), now()),
  ('ba960000-0000-4000-8000-000000000011', 'ls11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ls-a"}', '{}', now(), now()),
  ('ba960000-0000-4000-8000-000000000012', 'ls12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ls-b"}', '{}', now(), now()),
  ('ba960000-0000-4000-8000-000000000013', 'ls13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ls-c"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'ba960000-%';
update public.profiles set role = 'teacher', full_name = 'Profesora Listas' where id = 'ba960000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'Ana Listas' where id = 'ba960000-0000-4000-8000-000000000011';
update public.profiles set full_name = 'Beto Listas' where id = 'ba960000-0000-4000-8000-000000000012';
update public.profiles set full_name = 'Caro Listas' where id = 'ba960000-0000-4000-8000-000000000013';
insert into public.courses (id, title) values ('ba960000-0000-4000-8000-000000000021', 'Asignatura Listas 96');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ba960000-0000-4000-8000-000000000031', 'ba960000-0000-4000-8000-000000000021', 'Sección Listas', 'LIST96XX', 'ba960000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('ba960000-0000-4000-8000-000000000031', 'ba960000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('ba960000-0000-4000-8000-000000000031', 'ba960000-0000-4000-8000-000000000011'),
  ('ba960000-0000-4000-8000-000000000031', 'ba960000-0000-4000-8000-000000000012'),
  ('ba960000-0000-4000-8000-000000000031', 'ba960000-0000-4000-8000-000000000013');
insert into public.activities (id, class_id, title, mode, published, opens_at, closes_at, reveal_policy, hints_enabled) values
  ('ba960000-0000-4000-8000-0000000000a1', 'ba960000-0000-4000-8000-000000000031', 'Práctica 96', 'practice', true, now() - interval '5 days', now() + interval '2 days', 'immediate', true);
insert into public.attempts (user_id, course_id, activity_id, mode, status, started_at, submitted_at, score, max_score) values
  ('ba960000-0000-4000-8000-000000000011', 'ba960000-0000-4000-8000-000000000021', 'ba960000-0000-4000-8000-0000000000a1', 'practice', 'submitted', now() - interval '3 days', now() - interval '3 days', 6, 10),
  ('ba960000-0000-4000-8000-000000000012', 'ba960000-0000-4000-8000-000000000021', 'ba960000-0000-4000-8000-0000000000a1', 'practice', 'submitted', now() - interval '3 days', now() - interval '3 days', 2, 10),
  ('ba960000-0000-4000-8000-000000000013', 'ba960000-0000-4000-8000-000000000021', 'ba960000-0000-4000-8000-0000000000a1', 'practice', 'submitted', now() - interval '3 days', now() - interval '3 days', 10, 10);
-- Caro suspendida
update public.profiles set active = false, suspended_at = now() where id = 'ba960000-0000-4000-8000-000000000013';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ba960000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ba960000-0000-4000-8000-000000000001', true);
select public.dar_de_baja('ba960000-0000-4000-8000-000000000031', 'ba960000-0000-4000-8000-000000000012', '');

do $$
declare s jsonb; g jsonb; m jsonb; i jsonb; n integer;
  ana constant text := 'ba960000-0000-4000-8000-000000000011';
  beto constant text := 'ba960000-0000-4000-8000-000000000012';
  caro constant text := 'ba960000-0000-4000-8000-000000000013';
begin
  s := public.activity_stats('ba960000-0000-4000-8000-0000000000a1');
  if (s->'summary'->>'enrolled')::int <> 1 or (s->'summary'->>'students_submitted')::int <> 1 or (s->'summary'->>'mean_best')::numeric <> 6 then
    raise exception 'FALLO: activity_stats cuenta a la suspendida o al dado de baja: %', s->'summary';
  end if;
  g := public.gradebook('ba960000-0000-4000-8000-000000000031');
  if jsonb_array_length(g->'students') <> 1 or g->'students'->0->>'user_id' <> ana then
    raise exception 'FALLO: Seguimiento muestra a otros además de Ana: %', g->'students';
  end if;
  m := public.exam_monitor('ba960000-0000-4000-8000-0000000000a1');
  if (m->>'inscritos')::int <> 1 or (m->>'entregados')::int <> 1 then raise exception 'FALLO: exam_monitor: %', m; end if;
  i := public.exam_integridad_resumen('ba960000-0000-4000-8000-0000000000a1');
  if jsonb_array_length(i->'estudiantes') <> 1 or i->'estudiantes'->0->>'user_id' <> ana then
    raise exception 'FALLO: Protección del examen muestra a otros: %', i->'estudiantes';
  end if;
  select count(*) into n from public.practica_tiempo_intentos('ba960000-0000-4000-8000-0000000000a1') t where t.user_id::text in (beto, caro);
  if n <> 0 then raise exception 'FALLO: tiempo mínimo muestra a la suspendida o al dado de baja'; end if;
  select count(*) into n from public.hist_resumen('ba960000-0000-4000-8000-000000000031') h where h.user_id::text in (beto, caro);
  if n <> 0 then raise exception 'FALLO: regularización muestra a la suspendida o al dado de baja'; end if;
  if (select count(*) from public.hist_resumen('ba960000-0000-4000-8000-000000000031')) <> 1 then raise exception 'FALLO: regularización perdió a Ana'; end if;
  -- registro oficial y asistencia (decisión del profesor: tampoco los suspendidos)
  if (select array_agg(o.user_id::text) from public.gradebook_official('ba960000-0000-4000-8000-000000000031') o) <> array[ana] then
    raise exception 'FALLO: el registro oficial muestra a otros además de Ana';
  end if;
  select count(*) into n from public.gradebook_sources('ba960000-0000-4000-8000-000000000031') o where o.user_id::text in (beto, caro);
  if n <> 0 then raise exception 'FALLO: las fuentes del registro muestran a la suspendida o al dado de baja'; end if;
  i := public.attendance_report('ba960000-0000-4000-8000-000000000031');
  if jsonb_array_length(i->'estudiantes') <> 1 or i->'estudiantes'->0->>'user_id' <> ana then
    raise exception 'FALLO: la asistencia muestra a otros además de Ana: %', i->'estudiantes';
  end if;
end $$;

-- al reactivar a Caro vuelve a todas las listas
reset role;
update public.profiles set active = true, suspended_at = null where id = 'ba960000-0000-4000-8000-000000000013';
set local role authenticated;
do $$ begin
  if (public.activity_stats('ba960000-0000-4000-8000-0000000000a1')->'summary'->>'students_submitted')::int <> 2
     or jsonb_array_length(public.gradebook('ba960000-0000-4000-8000-000000000031')->'students') <> 2
     or (select count(*) from public.gradebook_official('ba960000-0000-4000-8000-000000000031')) <> 2
     or jsonb_array_length(public.attendance_report('ba960000-0000-4000-8000-000000000031')->'estudiantes') <> 2 then
    raise exception 'FALLO: la cuenta reactivada no vuelve a las listas';
  end if;
end $$;

-- los intentos siguen guardados
reset role;
do $$ begin
  if (select count(*) from public.attempts where activity_id = 'ba960000-0000-4000-8000-0000000000a1') <> 3 then
    raise exception 'FALLO: se tocaron los intentos';
  end if;
end $$;

select 'listas_sin_bajas.sql: PRUEBAS PASARON' as resultado;
rollback;
