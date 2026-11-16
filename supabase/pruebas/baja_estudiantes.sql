-- Pruebas: baja de estudiantes de una sección (migración 95). Se deshace al final.
-- dar_de_baja: la matrícula pasa completa (grupo y fecha) a matriculas_bajas; el estudiante sale del registro de
-- calificaciones y de las cifras de la actividad; sus intentos siguen intactos; deja de ser monitor. No puede volver
-- con el código de la clase. reincorporar restaura grupo y fecha. Un borrado directo de la matrícula también se
-- archiva; el borrado en cascada de una sección no. dar_de_baja_todas solo toca las secciones del profesor. Alta por
-- ID de un dado de baja = reincorporación. Nadie ajeno a la sección puede dar de baja ni ver las bajas.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ba950000-0000-4000-8000-000000000001', 'bj1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-bj-1","aula_role":"teacher"}', '{}', now(), now()),
  ('ba950000-0000-4000-8000-000000000002', 'bj2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-bj-2","aula_role":"teacher"}', '{}', now(), now()),
  ('ba950000-0000-4000-8000-000000000011', 'bj11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-bj-a"}', '{}', now(), now()),
  ('ba950000-0000-4000-8000-000000000012', 'bj12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-bj-b"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'ba950000-%';
update public.profiles set role = 'teacher', full_name = 'Profesora Baja' where id = 'ba950000-0000-4000-8000-000000000001';
update public.profiles set role = 'teacher', full_name = 'Profesor Ajeno' where id = 'ba950000-0000-4000-8000-000000000002';
update public.profiles set full_name = 'Ana Baja' where id = 'ba950000-0000-4000-8000-000000000011';
update public.profiles set full_name = 'Beto Baja' where id = 'ba950000-0000-4000-8000-000000000012';
insert into public.courses (id, title) values ('ba950000-0000-4000-8000-000000000021', 'Asignatura Baja 95');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000021', 'Sección Baja X', 'BAJA95XX', 'ba950000-0000-4000-8000-000000000001'),
  ('ba950000-0000-4000-8000-000000000032', 'ba950000-0000-4000-8000-000000000021', 'Sección Baja Y', 'BAJA95YY', 'ba950000-0000-4000-8000-000000000002'),
  ('ba950000-0000-4000-8000-000000000033', 'ba950000-0000-4000-8000-000000000021', 'Sección Baja Z', 'BAJA95ZZ', 'ba950000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000001'),
  ('ba950000-0000-4000-8000-000000000033', 'ba950000-0000-4000-8000-000000000001'),
  ('ba950000-0000-4000-8000-000000000032', 'ba950000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.class_groups (id, class_id, name) values
  ('ba950000-0000-4000-8000-000000000041', 'ba950000-0000-4000-8000-000000000031', 'Grupo 1');
insert into public.enrollments (class_id, user_id, group_id, enrolled_at) values
  ('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000011', 'ba950000-0000-4000-8000-000000000041', '2026-09-01 10:00-04'),
  ('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000012', null, '2026-09-02 10:00-04'),
  ('ba950000-0000-4000-8000-000000000032', 'ba950000-0000-4000-8000-000000000011', null, '2026-09-03 10:00-04'),
  ('ba950000-0000-4000-8000-000000000033', 'ba950000-0000-4000-8000-000000000012', null, '2026-09-04 10:00-04');
insert into public.class_monitors (class_id, user_id, assigned_by) values
  ('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000011', 'ba950000-0000-4000-8000-000000000001');
insert into public.activities (id, class_id, title, mode, published, opens_at, closes_at, reveal_policy, hints_enabled) values
  ('ba950000-0000-4000-8000-0000000000a1', 'ba950000-0000-4000-8000-000000000031', 'Práctica 95', 'practice', true, now() - interval '5 days', now() + interval '2 days', 'immediate', true);
insert into public.attempts (user_id, course_id, activity_id, mode, status, started_at, submitted_at, score, max_score) values
  ('ba950000-0000-4000-8000-000000000011', 'ba950000-0000-4000-8000-000000000021', 'ba950000-0000-4000-8000-0000000000a1', 'practice', 'submitted', now() - interval '3 days', now() - interval '3 days', 2, 10),
  ('ba950000-0000-4000-8000-000000000012', 'ba950000-0000-4000-8000-000000000021', 'ba950000-0000-4000-8000-0000000000a1', 'practice', 'submitted', now() - interval '3 days', now() - interval '3 days', 8, 10);

set local role authenticated;

-- 1) ni un estudiante ni un profesor ajeno pueden dar de baja ni ver las bajas
select set_config('request.jwt.claims', '{"sub":"ba950000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ba950000-0000-4000-8000-000000000012', true);
do $$ begin
  begin
    perform public.dar_de_baja('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000011', '');
    raise exception 'FALLO: un estudiante dio de baja a otro';
  exception when insufficient_privilege then null; end;
  begin
    perform public.bajas_seccion('ba950000-0000-4000-8000-000000000031');
    raise exception 'FALLO: un estudiante leyó las bajas';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"ba950000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ba950000-0000-4000-8000-000000000002', true);
do $$ begin
  begin
    perform public.dar_de_baja('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000011', '');
    raise exception 'FALLO: un profesor ajeno dio de baja en una sección que no es suya';
  exception when insufficient_privilege then null; end;
  begin
    perform public.reincorporar('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000011');
    raise exception 'FALLO: un profesor ajeno reincorporó';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) la profesora da de baja a Ana en X
select set_config('request.jwt.claims', '{"sub":"ba950000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ba950000-0000-4000-8000-000000000001', true);
do $$
declare r jsonb; b public.matriculas_bajas; s jsonb;
begin
  -- antes: Ana está en el registro y en las cifras
  if not exists (select 1 from public.gradebook_official('ba950000-0000-4000-8000-000000000031') where user_id = 'ba950000-0000-4000-8000-000000000011') then
    raise exception 'FALLO (preparación): Ana no estaba en el registro';
  end if;
  r := public.dar_de_baja('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000011', 'Retiró la asignatura');
  if not (r->>'ok')::boolean then raise exception 'FALLO: dar_de_baja devolvió %', r; end if;
  if exists (select 1 from public.enrollments where class_id = 'ba950000-0000-4000-8000-000000000031' and user_id = 'ba950000-0000-4000-8000-000000000011') then
    raise exception 'FALLO: la matrícula sigue en enrollments';
  end if;
  select * into b from public.matriculas_bajas where class_id = 'ba950000-0000-4000-8000-000000000031' and user_id = 'ba950000-0000-4000-8000-000000000011';
  if b.id is null or b.group_id <> 'ba950000-0000-4000-8000-000000000041' or b.enrolled_at <> '2026-09-01 10:00-04'::timestamptz
     or b.motivo <> 'Retiró la asignatura' or b.baja_por <> 'ba950000-0000-4000-8000-000000000001' or b.reincorporada_at is not null then
    raise exception 'FALLO: la baja archivada no conserva la matrícula: %', to_jsonb(b);
  end if;
  if (select count(*) from public.matriculas_bajas where user_id = 'ba950000-0000-4000-8000-000000000011') <> 1 then
    raise exception 'FALLO: la baja quedó duplicada (función + disparador)';
  end if;
  -- desaparece del registro de calificaciones
  if exists (select 1 from public.gradebook_official('ba950000-0000-4000-8000-000000000031') where user_id = 'ba950000-0000-4000-8000-000000000011') then
    raise exception 'FALLO: Ana sigue en el registro de calificaciones';
  end if;
  -- y de las cifras de la actividad (solo queda Beto: 1 estudiante, media 8)
  s := public.activity_stats('ba950000-0000-4000-8000-0000000000a1');
  if (s->'summary'->>'students_submitted')::int <> 1 or (s->'summary'->>'mean_best')::numeric <> 8 or (s->'summary'->>'enrolled')::int <> 1 then
    raise exception 'FALLO: activity_stats cuenta a la dada de baja: %', s->'summary';
  end if;
  -- aparece en las bajas de la sección
  if not exists (select 1 from public.bajas_seccion('ba950000-0000-4000-8000-000000000031') x where x.user_id = 'ba950000-0000-4000-8000-000000000011' and x.motivo = 'Retiró la asignatura') then
    raise exception 'FALLO: bajas_seccion no la muestra';
  end if;
  -- dar de baja a quien no está matriculado: error claro, sin excepción
  r := public.dar_de_baja('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000011', '');
  if (r->>'ok')::boolean then raise exception 'FALLO: dio de baja dos veces'; end if;
end $$;
-- sus intentos siguen intactos (se comprueba sin RLS)
reset role;
do $$ begin
  if (select count(*) from public.attempts where user_id = 'ba950000-0000-4000-8000-000000000011') <> 1 then
    raise exception 'FALLO: la baja tocó los intentos';
  end if;
  if not exists (select 1 from public.enrollments where class_id = 'ba950000-0000-4000-8000-000000000032' and user_id = 'ba950000-0000-4000-8000-000000000011') then
    raise exception 'FALLO: la baja de X tocó la matrícula de Y';
  end if;
  if exists (select 1 from public.class_monitors where class_id = 'ba950000-0000-4000-8000-000000000031' and user_id = 'ba950000-0000-4000-8000-000000000011' and revoked_at is null) then
    raise exception 'FALLO: sigue siendo monitor';
  end if;
end $$;
set local role authenticated;

-- 3) Ana no puede volver con el código de la clase ni ver las bajas
select set_config('request.jwt.claims', '{"sub":"ba950000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ba950000-0000-4000-8000-000000000011', true);
do $$
declare r jsonb;
begin
  begin
    r := public.join_class('BAJA95XX');
    raise exception 'FALLO: la dada de baja volvió a entrar con el código (%).', r;
  exception when raise_exception then
    if sqlerrm not like '%dado de baja%' then raise; end if;
  end;
  if exists (select 1 from public.matriculas_bajas) then raise exception 'FALLO: una estudiante ve el archivo de bajas'; end if;
end $$;

-- 4) reincorporar restaura grupo y fecha originales
select set_config('request.jwt.claims', '{"sub":"ba950000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ba950000-0000-4000-8000-000000000001', true);
do $$
declare r jsonb; e public.enrollments;
begin
  r := public.reincorporar('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000011');
  if not (r->>'ok')::boolean then raise exception 'FALLO: reincorporar devolvió %', r; end if;
  select * into e from public.enrollments where class_id = 'ba950000-0000-4000-8000-000000000031' and user_id = 'ba950000-0000-4000-8000-000000000011';
  if e.user_id is null or e.group_id <> 'ba950000-0000-4000-8000-000000000041' or e.enrolled_at <> '2026-09-01 10:00-04'::timestamptz then
    raise exception 'FALLO: la matrícula restaurada no conserva grupo y fecha: %', to_jsonb(e);
  end if;
  if exists (select 1 from public.matriculas_bajas where user_id = 'ba950000-0000-4000-8000-000000000011' and reincorporada_at is null) then
    raise exception 'FALLO: la baja sigue vigente tras reincorporar';
  end if;
  if not exists (select 1 from public.gradebook_official('ba950000-0000-4000-8000-000000000031') where user_id = 'ba950000-0000-4000-8000-000000000011') then
    raise exception 'FALLO: reincorporada pero no vuelve al registro';
  end if;
  r := public.reincorporar('ba950000-0000-4000-8000-000000000031', 'ba950000-0000-4000-8000-000000000011');
  if (r->>'ok')::boolean then raise exception 'FALLO: reincorporó sin baja vigente'; end if;
end $$;

-- 5) el borrado directo (botón antiguo, por REST con la política de profesor) también se archiva
delete from public.enrollments where class_id = 'ba950000-0000-4000-8000-000000000031' and user_id = 'ba950000-0000-4000-8000-000000000012';
do $$ begin
  if not exists (select 1 from public.matriculas_bajas where class_id = 'ba950000-0000-4000-8000-000000000031'
                 and user_id = 'ba950000-0000-4000-8000-000000000012' and reincorporada_at is null
                 and enrolled_at = '2026-09-02 10:00-04'::timestamptz) then
    raise exception 'FALLO: el borrado directo no quedó archivado';
  end if;
end $$;

-- 6) alta por ID de un dado de baja = reincorporación (cierra la baja)
do $$
declare r jsonb;
begin
  r := public.enroll_students_by_login('ba950000-0000-4000-8000-000000000031', array['sint-bj-b']);
  if not exists (select 1 from public.enrollments where class_id = 'ba950000-0000-4000-8000-000000000031' and user_id = 'ba950000-0000-4000-8000-000000000012') then
    raise exception 'FALLO: el alta por ID no matriculó (%).', r;
  end if;
  if exists (select 1 from public.matriculas_bajas where user_id = 'ba950000-0000-4000-8000-000000000012' and reincorporada_at is null) then
    raise exception 'FALLO: el alta por ID no cerró la baja';
  end if;
end $$;

-- 7) dar_de_baja_todas: solo las secciones de quien llama (Ana sale de X, no de Y, que es del profesor ajeno)
do $$
declare r jsonb;
begin
  r := public.dar_de_baja_todas('ba950000-0000-4000-8000-000000000011', 'Abandono');
  if (r->>'secciones')::int <> 1 then raise exception 'FALLO: dar_de_baja_todas devolvió %', r; end if;
  if exists (select 1 from public.enrollments where class_id = 'ba950000-0000-4000-8000-000000000031' and user_id = 'ba950000-0000-4000-8000-000000000011') then
    raise exception 'FALLO: dar_de_baja_todas no la quitó de X';
  end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.enrollments where class_id = 'ba950000-0000-4000-8000-000000000032' and user_id = 'ba950000-0000-4000-8000-000000000011') then
    raise exception 'FALLO: dar_de_baja_todas tocó una sección ajena';
  end if;
end $$;

-- 8) borrar una sección entera (cascada) no se archiva ni falla
delete from public.classes where id = 'ba950000-0000-4000-8000-000000000033';
do $$ begin
  if exists (select 1 from public.matriculas_bajas where class_id = 'ba950000-0000-4000-8000-000000000033') then
    raise exception 'FALLO: el borrado en cascada se archivó como baja';
  end if;
end $$;

select 'baja_estudiantes.sql: PRUEBAS PASARON' as resultado;
rollback;
