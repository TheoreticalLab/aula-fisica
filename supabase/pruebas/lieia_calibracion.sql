-- Pruebas: calibración progresiva versionada y subgrupos seudonimizados (migración 49). Se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ec000000-0000-4000-8000-000000000001', 'ka@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-calib","aula_role":"teacher"}', '{}', now(), now()),
  ('ec000000-0000-4000-8000-000000000011', 'k1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-cal-1"}', '{}', now(), now()),
  ('ec000000-0000-4000-8000-000000000012', 'k2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-cal-2"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'ec000000-%';
update public.profiles set role = 'teacher' where id = 'ec000000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('ec000000-0000-4000-8000-000000000021', 'Curso calibración');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ec000000-0000-4000-8000-000000000031', 'ec000000-0000-4000-8000-000000000021', 'Sección calibración', 'CALIB001', 'ec000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('ec000000-0000-4000-8000-000000000031', 'ec000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.class_groups (id, class_id, name) values ('ec000000-0000-4000-8000-000000000051', 'ec000000-0000-4000-8000-000000000031', 'Grupo A');
insert into public.enrollments (class_id, user_id, group_id) values
  ('ec000000-0000-4000-8000-000000000031', 'ec000000-0000-4000-8000-000000000011', 'ec000000-0000-4000-8000-000000000051'),
  ('ec000000-0000-4000-8000-000000000031', 'ec000000-0000-4000-8000-000000000012', null);
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points) values
  ('ec000000-0000-4000-8000-000000000061', 'ec000000-0000-4000-8000-000000000021', 'cal-1', 'numerica', 'basico', 'bank', 'numeric', 'P', 1);
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('ec000000-0000-4000-8000-000000000041', 'ec000000-0000-4000-8000-000000000031', 'Examen', 'exam', true, 'after_submit', false);
insert into public.attempts (id, user_id, course_id, activity_id, mode, status, submitted_at) values
  ('ec000000-0000-4000-8000-000000000071', 'ec000000-0000-4000-8000-000000000011', 'ec000000-0000-4000-8000-000000000021', 'ec000000-0000-4000-8000-000000000041', 'exam', 'submitted', now()),
  ('ec000000-0000-4000-8000-000000000072', 'ec000000-0000-4000-8000-000000000012', 'ec000000-0000-4000-8000-000000000021', 'ec000000-0000-4000-8000-000000000041', 'exam', 'submitted', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ec000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ec000000-0000-4000-8000-000000000001', true);
do $$
declare h jsonb; g jsonb; d jsonb;
begin
  -- dos calibraciones sucesivas de la misma pregunta → dos versiones (la actual sobrescribe; el historial conserva)
  perform public.calibration_save('ec000000-0000-4000-8000-000000000021', '[{"exercise_id":"ec000000-0000-4000-8000-000000000061","a":1.0,"b":-0.5,"se_a":0.4,"se_b":0.6,"n_resp":40}]');
  perform public.calibration_save('ec000000-0000-4000-8000-000000000021', '[{"exercise_id":"ec000000-0000-4000-8000-000000000061","a":1.2,"b":-0.3,"se_a":0.2,"se_b":0.25,"n_resp":160}]');
  h := public.calibration_history('ec000000-0000-4000-8000-000000000021');
  if jsonb_array_length(h) <> 2 or (h->0->>'n_resp')::int <> 40 or (h->1->>'n_resp')::int <> 160 then raise exception 'FALLO: historial %', h; end if;
  -- subgrupos con los MISMOS seudónimos que lieia_exam_data
  g := public.lieia_exam_groups('ec000000-0000-4000-8000-000000000041');
  d := public.lieia_exam_data('ec000000-0000-4000-8000-000000000041');
  if jsonb_array_length(g) <> 2 then raise exception 'FALLO: grupos %', g; end if;
  if (select jsonb_agg(x->>'seudonimo' order by x->>'seudonimo') from jsonb_array_elements(g) x)
     <> (select jsonb_agg(x->>'seudonimo' order by x->>'seudonimo') from jsonb_array_elements(d->'estudiantes') x) then raise exception 'FALLO: seudónimos distintos'; end if;
  if (select count(*) from jsonb_array_elements(g) x where x->>'grupo' = 'Grupo A') <> 1 or (select count(*) from jsonb_array_elements(g) x where x->'grupo' = 'null'::jsonb) <> 1 then
    raise exception 'FALLO: grupos asignados %', g;
  end if;
  if exists (select 1 from jsonb_array_elements(g) x where x ? 'user_id' or x ? 'full_name') then raise exception 'FALLO: se filtran identidades'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"ec000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ec000000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.calibration_history('ec000000-0000-4000-8000-000000000021'); raise exception 'FALLO: un estudiante vio el historial';
  exception when insufficient_privilege then null; end;
  begin perform public.lieia_exam_groups('ec000000-0000-4000-8000-000000000041'); raise exception 'FALLO: un estudiante vio los grupos';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.item_calibration_history; raise exception 'FALLO: leyó el historial'; exception when insufficient_privilege then null; end;
end $$;

select 'PRUEBAS DE CALIBRACIÓN PROGRESIVA Y GRUPOS LIEIA PASARON' as resultado;
rollback;
