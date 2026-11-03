-- Pruebas: parte manual dentro de un apartado del registro (migración 69). Se deshace al final.
-- Práctica 30 con dos actividades «por definir» (cerradas). A: 100 % y 50 %; B: no entregó nada.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de690000-0000-4000-8000-000000000001', 'pa1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-partes","aula_role":"teacher"}', '{}', now(), now()),
  ('de690000-0000-4000-8000-000000000011', 'pa11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pa-a"}', '{}', now(), now()),
  ('de690000-0000-4000-8000-000000000012', 'pa12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pa-b"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de690000-%';
update public.profiles set role = 'teacher' where id = 'de690000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de690000-0000-4000-8000-000000000021', 'Curso 69');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000021', 'Sección 69', 'PARTE069', 'de690000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000011'), ('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, closes_at) values
  ('de690000-0000-4000-8000-0000000000a1', 'de690000-0000-4000-8000-000000000031', 'P1', 'practice', true, now() - interval '1 day'),
  ('de690000-0000-4000-8000-0000000000a2', 'de690000-0000-4000-8000-000000000031', 'P2', 'practice', true, now() - interval '1 day'),
  ('de690000-0000-4000-8000-0000000000a3', 'de690000-0000-4000-8000-000000000031', 'P3', 'practice', true, now() + interval '1 day');
insert into public.activity_grade_links (activity_id, class_id, category, points) values
  ('de690000-0000-4000-8000-0000000000a1', 'de690000-0000-4000-8000-000000000031', 'practica', null),
  ('de690000-0000-4000-8000-0000000000a2', 'de690000-0000-4000-8000-000000000031', 'practica', null);
insert into public.attempts (id, user_id, course_id, activity_id, mode, status, score, max_score) values
  ('de690000-0000-4000-8000-0000000000f1', 'de690000-0000-4000-8000-000000000011', 'de690000-0000-4000-8000-000000000021', 'de690000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 10, 10),
  ('de690000-0000-4000-8000-0000000000f2', 'de690000-0000-4000-8000-000000000011', 'de690000-0000-4000-8000-000000000021', 'de690000-0000-4000-8000-0000000000a2', 'practice', 'submitted', 5, 10);
-- control desactivado en estas prácticas, para que el factor de control no intervenga
do $$ begin
  if to_regprocedure('public.control_factor(uuid, uuid)') is not null and (public.control_factor('de690000-0000-4000-8000-0000000000a1', 'de690000-0000-4000-8000-000000000011') <> 1
     or public.control_factor('de690000-0000-4000-8000-0000000000a2', 'de690000-0000-4000-8000-000000000011') <> 1) then
    raise exception 'FALLO (preparación): factor de control distinto de 1'; end if;
end $$;

-- sin parte: como antes (15 + 7,5)
do $$ begin
  if (select score from public.official_scores('de690000-0000-4000-8000-000000000031') where user_id = 'de690000-0000-4000-8000-000000000011' and category = 'practica') <> 22.5 then
    raise exception 'FALLO: sin parte el cálculo cambió'; end if;
end $$;

set local role authenticated;
select set_config('request.path', '/rpc/prueba', true);
-- un estudiante no puede definir partes ni notas
select set_config('request.jwt.claims', '{"sub":"de690000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de690000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.set_grade_part('de690000-0000-4000-8000-000000000031', 'practica', 'X', 15); raise exception 'FALLO: el estudiante define la parte';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims', '{"sub":"de690000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de690000-0000-4000-8000-000000000001', true);
do $$ declare j jsonb; begin
  -- límites de la parte
  begin perform public.set_grade_part('de690000-0000-4000-8000-000000000031', 'practica', 'X', 30); raise exception 'FALLO: parte = apartado';
  exception when invalid_parameter_value then null; end;
  begin perform public.set_grade_part('de690000-0000-4000-8000-000000000031', 'practica', '  ', 15); raise exception 'FALLO: parte sin nombre';
  exception when invalid_parameter_value then null; end;
  perform public.set_grade_part('de690000-0000-4000-8000-000000000031', 'practica', 'Prácticas anteriores', 15);

  -- las actividades reparten 15 (7,5 cada una) y una de valor fijo no puede pasar de 15
  if (select peso_efectivo from public.class_activity_links('de690000-0000-4000-8000-000000000031') where activity_id = 'de690000-0000-4000-8000-0000000000a1') <> 7.5 then
    raise exception 'FALLO: reparto con parte'; end if;
  begin perform public.set_activity_grade_link('de690000-0000-4000-8000-0000000000a3', 'practica', 20); raise exception 'FALLO: actividad fija por encima de lo disponible';
  exception when invalid_parameter_value then null; end;

  -- notas de la parte: límites, estudiante ajeno
  begin perform public.set_grade_part_score('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000011', 'practica', 16); raise exception 'FALLO: nota por encima de la parte';
  exception when invalid_parameter_value then null; end;
  begin perform public.set_grade_part_score('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000001', 'practica', 5); raise exception 'FALLO: no matriculado';
  exception when insufficient_privilege then null; end;
  begin perform public.set_grade_part_score('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000011', 'final', 5); raise exception 'FALLO: apartado sin parte';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.set_grade_part_score('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000011', 'practica', 10);

  -- A: 7,5 + 3,75 + 10 = 21,25; B: sin entregas (cerradas = 0) y parte pendiente → 0 con 1 pendiente
  if (select practica from public.gradebook_official('de690000-0000-4000-8000-000000000031') where user_id = 'de690000-0000-4000-8000-000000000011') <> 21.25 then
    raise exception 'FALLO: suma actividades + parte'; end if;
  if (select pendientes from public.gradebook_sources('de690000-0000-4000-8000-000000000031') where user_id = 'de690000-0000-4000-8000-000000000012' and category = 'practica') <> 1
     or (select score from public.gradebook_sources('de690000-0000-4000-8000-000000000031') where user_id = 'de690000-0000-4000-8000-000000000012' and category = 'practica') <> 0 then
    raise exception 'FALLO: parte pendiente'; end if;
  -- B con la parte en 0: sigue 0, sin pendientes
  perform public.set_grade_part_score('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000012', 'practica', 0);
  if (select pendientes from public.gradebook_sources('de690000-0000-4000-8000-000000000031') where user_id = 'de690000-0000-4000-8000-000000000012' and category = 'practica') <> 0 then
    raise exception 'FALLO: parte en 0 sigue pendiente'; end if;

  -- la nota a mano del apartado completo tiene prioridad
  perform public.set_official_grade('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000011', 'practica', 28);
  if (select practica from public.gradebook_official('de690000-0000-4000-8000-000000000031') where user_id = 'de690000-0000-4000-8000-000000000011') <> 28 then
    raise exception 'FALLO: prioridad de la nota a mano'; end if;
  perform public.set_official_grade('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000011', 'practica', null);

  -- historial y lectura
  if not exists (select 1 from public.official_grade_history('de690000-0000-4000-8000-000000000031', 'de690000-0000-4000-8000-000000000011')
                 where categoria = 'practica:parte' and despues = 10) then raise exception 'FALLO: historial de la parte'; end if;
  j := public.class_grade_parts('de690000-0000-4000-8000-000000000031');
  if j -> 'partes' -> 0 ->> 'label' <> 'Prácticas anteriores' or jsonb_array_length(j -> 'notas') <> 2 then raise exception 'FALLO: lectura %', j; end if;

  -- con la parte, una actividad de valor fijo no puede hacer que la parte no quepa
  perform public.set_activity_grade_link('de690000-0000-4000-8000-0000000000a3', 'practica', 10);
  begin perform public.set_grade_part('de690000-0000-4000-8000-000000000031', 'practica', 'Prácticas anteriores', 25); raise exception 'FALLO: parte que no cabe';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.set_activity_grade_link('de690000-0000-4000-8000-0000000000a3', null, null);
  perform public.set_official_grade_settings('de690000-0000-4000-8000-000000000031', true, 5, 2, null, null, true);
end $$;

-- el estudiante ve la parte en su desglose (registro publicado)
select set_config('request.jwt.claims', '{"sub":"de690000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de690000-0000-4000-8000-000000000011', true);
do $$ declare c jsonb; begin
  select x into c from jsonb_array_elements((select y -> 'categorias' from jsonb_array_elements(public.my_grade_breakdown()) y
    where y ->> 'class_id' = 'de690000-0000-4000-8000-000000000031')) x where x ->> 'category' = 'practica';
  if c -> 'parte' ->> 'label' <> 'Prácticas anteriores' or (c -> 'parte' ->> 'score')::numeric <> 10 or (c ->> 'score')::numeric <> 21.25
     or (c -> 'actividades' -> 0 ->> 'peso')::numeric <> 7.5 then raise exception 'FALLO: desglose del estudiante %', c; end if;
end $$;

-- el profesor quita la parte: vuelve el cálculo anterior
select set_config('request.jwt.claims', '{"sub":"de690000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de690000-0000-4000-8000-000000000001', true);
do $$ begin
  perform public.set_grade_part('de690000-0000-4000-8000-000000000031', 'practica', null, null);
  if (select practica from public.gradebook_official('de690000-0000-4000-8000-000000000031') where user_id = 'de690000-0000-4000-8000-000000000011') <> 22.5 then
    raise exception 'FALLO: quitar la parte'; end if;
end $$;
reset role;

do $$ begin
  if has_function_privilege('anon', 'public.set_grade_part_score(uuid, uuid, text, numeric)', 'execute')
     or has_function_privilege('authenticated', 'public.grade_part_max(uuid, text)', 'execute') then raise exception 'FALLO: permisos'; end if;
end $$;

select 'partes_apartado.sql: PRUEBAS PASARON' as resultado;
rollback;
