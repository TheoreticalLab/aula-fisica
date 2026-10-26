-- Pruebas: actividades vinculadas al Registro de Calificaciones (migración 16). Transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d1000000-0000-4000-8000-000000000001', 'vp@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-vinc","aula_role":"teacher"}', '{}', now(), now()),
  ('d1000000-0000-4000-8000-000000000011', 've@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-vinc"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'd1000000-%';
insert into public.courses (id, title) values ('d1000000-0000-4000-8000-000000000021', 'Curso vínculos');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d1000000-0000-4000-8000-000000000031', 'd1000000-0000-4000-8000-000000000021', 'Sección V', 'VINCULA2', 'd1000000-0000-4000-8000-000000000001');
insert into public.enrollments (class_id, user_id) values ('d1000000-0000-4000-8000-000000000031', 'd1000000-0000-4000-8000-000000000011');
insert into public.activities (id, class_id, title, mode, published, closes_at) values
  ('d1000000-0000-4000-8000-0000000000a1', 'd1000000-0000-4000-8000-000000000031', 'Lectura', 'practice', true, null),
  ('d1000000-0000-4000-8000-0000000000a2', 'd1000000-0000-4000-8000-000000000031', 'Práctica B', 'practice', true, null),
  ('d1000000-0000-4000-8000-0000000000a3', 'd1000000-0000-4000-8000-000000000031', 'Práctica C', 'practice', true, null),
  ('d1000000-0000-4000-8000-0000000000a5', 'd1000000-0000-4000-8000-000000000031', 'Práctica cerrada', 'practice', true, now() - interval '1 day'),
  ('d1000000-0000-4000-8000-0000000000a6', 'd1000000-0000-4000-8000-000000000031', 'Sin vincular', 'practice', true, null);
-- un examen: sin retroalimentación inmediata ni pistas (regla de la tabla activities)
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('d1000000-0000-4000-8000-0000000000a4', 'd1000000-0000-4000-8000-000000000031', 'Parcial en línea', 'exam', true, 'after_submit', false);
insert into public.attempts (user_id, course_id, activity_id, mode, status, score, max_score) values
  ('d1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000021', 'd1000000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 80, 100),
  ('d1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000021', 'd1000000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 60, 100),
  ('d1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000021', 'd1000000-0000-4000-8000-0000000000a2', 'practice', 'submitted', 5, 10),
  ('d1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000021', 'd1000000-0000-4000-8000-0000000000a4', 'exam', 'submitted', 90, 100),
  ('d1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000021', 'd1000000-0000-4000-8000-0000000000a6', 'practice', 'submitted', 100, 100);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
do $$
declare g record; v record;
begin
  -- Práctica: lectura 5 fijos, cerrada 5 fijos, B y C «por definir» (se reparten los 20 restantes: 10 cada una)
  perform public.set_activity_grade_link('d1000000-0000-4000-8000-0000000000a1', 'practica', 5);
  perform public.set_activity_grade_link('d1000000-0000-4000-8000-0000000000a5', 'practica', 5);
  perform public.set_activity_grade_link('d1000000-0000-4000-8000-0000000000a2', 'practica', null);
  perform public.set_activity_grade_link('d1000000-0000-4000-8000-0000000000a3', 'practica', null);
  -- el examen en línea vale el primer parcial entero
  perform public.set_activity_grade_link('d1000000-0000-4000-8000-0000000000a4', 'parcial1', 15);
  if (select peso_efectivo from public.class_activity_links('d1000000-0000-4000-8000-000000000031') where activity_id = 'd1000000-0000-4000-8000-0000000000a2') <> 10 then
    raise exception 'FALLO: reparto de las actividades por definir';
  end if;
  -- no se puede pasar del máximo del apartado
  begin
    perform public.set_activity_grade_link('d1000000-0000-4000-8000-0000000000a6', 'practica', 25);
    raise exception 'FALLO: aceptó 35 puntos en un apartado de 30';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  -- lectura 80 % de 5 = 4 · B 50 % de 10 = 5 · C abierta sin entregar = pendiente · cerrada sin entregar = 0 → 9
  select * into g from public.gradebook_official('d1000000-0000-4000-8000-000000000031');
  if g.practica <> 9 or g.parcial1 <> 13.5 then raise exception 'FALLO: práctica % y parcial %', g.practica, g.parcial1; end if;
  select * into v from public.gradebook_sources('d1000000-0000-4000-8000-000000000031') where category = 'practica';
  if v.source <> 'actividades' or v.pendientes <> 1 then raise exception 'FALLO: origen/pendientes de práctica'; end if;
  -- una nota escrita a mano tiene prioridad
  perform public.set_official_grade('d1000000-0000-4000-8000-000000000031', 'd1000000-0000-4000-8000-000000000011', 'parcial1', 12);
  if (select parcial1 from public.gradebook_official('d1000000-0000-4000-8000-000000000031')) <> 12 then raise exception 'FALLO: la nota manual no tuvo prioridad'; end if;
  -- desvincular la lectura: deja de contar y B y C se reparten ahora 25 (12.5 cada una): B 50 % = 6.25
  perform public.set_activity_grade_link('d1000000-0000-4000-8000-0000000000a1', null, null);
  if (select practica from public.gradebook_official('d1000000-0000-4000-8000-000000000031')) <> 6.25 then raise exception 'FALLO: desvincular'; end if;
end $$;

-- el estudiante no puede vincular actividades ni ver los vínculos
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000011', true);
do $$ begin
  begin
    perform public.set_activity_grade_link('d1000000-0000-4000-8000-0000000000a6', 'final', 25);
    raise exception 'FALLO: un estudiante vinculó una actividad';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.official_scores('d1000000-0000-4000-8000-000000000031');
    raise exception 'FALLO: un estudiante ejecutó official_scores';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'PRUEBAS DE ACTIVIDADES EN EL REGISTRO PASARON' as resultado;
rollback;
