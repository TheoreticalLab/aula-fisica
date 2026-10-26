-- Pruebas: Registro de Calificaciones y Secretaría del curso (migración 15). Transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('df000000-0000-4000-8000-000000000001', 'rp1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-reg","aula_role":"teacher"}', '{}', now(), now()),
  ('df000000-0000-4000-8000-000000000011', 're1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-reg-mon"}', '{}', now(), now()),
  ('df000000-0000-4000-8000-000000000012', 're2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-reg-2"}', '{}', now(), now()),
  ('df000000-0000-4000-8000-000000000013', 're3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-reg-3"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'df000000-%';
insert into public.courses (id, title) values ('df000000-0000-4000-8000-000000000021', 'Curso registro');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000021', 'Sección R1', 'REGISTA2', 'df000000-0000-4000-8000-000000000001'),
  ('df000000-0000-4000-8000-000000000032', 'df000000-0000-4000-8000-000000000021', 'Sección R2', 'REGISTB2', null);
insert into public.enrollments (class_id, user_id) values
  ('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000011'),
  ('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012'),
  ('df000000-0000-4000-8000-000000000032', 'df000000-0000-4000-8000-000000000013');

-- ===== profesor =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"df000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'df000000-0000-4000-8000-000000000001', true);
do $$ begin
  perform public.set_official_grade('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 'parcial1', 12);
  perform public.set_official_grade('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 'parcial1', 13.5);
  perform public.set_official_grade('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 'practica', 0);
  perform public.set_official_grade('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 'final', 25);
  begin
    perform public.set_official_grade('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 'parcial2', 16);
    raise exception 'FALLO: aceptó 16 en un parcial de 15';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_official_grade('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000013', 'parcial1', 10);
    raise exception 'FALLO: calificó a un estudiante de otra sección';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.gradebook_official('df000000-0000-4000-8000-000000000032');
    raise exception 'FALLO: vio el registro de una sección que no imparte';
  exception when insufficient_privilege then null;
  end;
  perform public.set_official_grade_settings('df000000-0000-4000-8000-000000000031', false, 5, 2, null, null, true);
  perform public.set_class_monitor('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000011', true);
  begin
    perform public.set_class_monitor('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000013', true);
    raise exception 'FALLO: nombró monitor a alguien de otra sección';
  exception when insufficient_privilege then null;
  end;
  -- historial: 3 notas creadas + 1 modificación = 4 registros
  if (select count(*) from public.official_grade_history('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012') where tipo = 'nota') <> 4 then
    raise exception 'FALLO: historial de modificaciones';
  end if;
end $$;

-- ===== monitor =====
select set_config('request.jwt.claims', '{"sub":"df000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'df000000-0000-4000-8000-000000000011', true);
do $$
declare r jsonb;
begin
  if (select count(*) from public.monitor_classmates('df000000-0000-4000-8000-000000000031')) <> 1 then raise exception 'FALLO: compañeros del monitor'; end if;
  -- asigna 2 puntos (requiere aprobación: queda pendiente); repetir la misma solicitud no duplica
  r := public.add_extra_points('df000000-0000-4000-8000-0000000000a1', 'df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 2, 'Participación en clase');
  if r ->> 'status' <> 'pendiente' then raise exception 'FALLO: estado inicial %', r; end if;
  r := public.add_extra_points('df000000-0000-4000-8000-0000000000a1', 'df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 2, 'Participación en clase');
  if not (r ->> 'duplicate')::boolean then raise exception 'FALLO: solicitud duplicada'; end if;
  -- máximo por operación (2)
  begin
    perform public.add_extra_points('df000000-0000-4000-8000-0000000000a2', 'df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 3, 'Demasiado');
    raise exception 'FALLO: superó el máximo por operación';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  -- autoasignación
  begin
    perform public.add_extra_points('df000000-0000-4000-8000-0000000000a3', 'df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000011', 1, 'Para mí');
    raise exception 'FALLO: se asignó puntos a sí mismo';
  exception when insufficient_privilege then null;
  end;
  -- otra sección
  begin
    perform public.add_extra_points('df000000-0000-4000-8000-0000000000a4', 'df000000-0000-4000-8000-000000000032', 'df000000-0000-4000-8000-000000000013', 1, 'Otra sección');
    raise exception 'FALLO: asignó en otra sección';
  exception when insufficient_privilege then null;
  end;
  -- el monitor no modifica notas, no ve el registro ni toca tablas
  begin
    perform public.set_official_grade('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 'final', 0);
    raise exception 'FALLO: el monitor modificó el examen final';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.gradebook_official('df000000-0000-4000-8000-000000000031');
    raise exception 'FALLO: el monitor vio el registro de notas';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.grade_entries set score = 15;
    raise exception 'FALLO: escribió en grade_entries';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.extra_points (request_id, class_id, user_id, assigned_by, assigner_role, points, reason, status)
      values (gen_random_uuid(), 'df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 'df000000-0000-4000-8000-000000000011', 'monitor', 50, 'directo', 'aprobado');
    raise exception 'FALLO: insertó extras directamente';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.my_extra_assignments('df000000-0000-4000-8000-000000000031')) <> 1 then raise exception 'FALLO: historial del monitor'; end if;
end $$;

-- ===== estudiante: notas ocultas hasta publicarse; luego pendientes ≠ cero =====
select set_config('request.jwt.claims', '{"sub":"df000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'df000000-0000-4000-8000-000000000012', true);
do $$ begin
  if (public.my_official_grades() -> 0 -> 'notas') <> 'null'::jsonb then raise exception 'FALLO: vio notas no publicadas'; end if;
  begin
    perform public.set_official_grade('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 'final', 25);
    raise exception 'FALLO: el estudiante se puso nota';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== profesor aprueba, publica y revierte =====
select set_config('request.jwt.claims', '{"sub":"df000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'df000000-0000-4000-8000-000000000001', true);
do $$
declare v_id uuid; g record;
begin
  select id into v_id from public.class_extra_points('df000000-0000-4000-8000-000000000031') limit 1;
  perform public.review_extra_points(v_id, 'aprobado', null);
  perform public.set_official_grade_settings('df000000-0000-4000-8000-000000000031', true, 5, 2, null, null, true);
  select * into g from public.gradebook_official('df000000-0000-4000-8000-000000000031') where user_id = 'df000000-0000-4000-8000-000000000012';
  if g.bruto <> 40.5 or g.nota_final <> 40.5 or g.pendientes <> 2 or g.extras <> 2 then raise exception 'FALLO: cálculo % % % %', g.bruto, g.nota_final, g.pendientes, g.extras; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"df000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'df000000-0000-4000-8000-000000000012', true);
do $$
declare n jsonb := public.my_official_grades() -> 0;
begin
  if (n -> 'notas' ->> 'practica')::numeric <> 0 then raise exception 'FALLO: el cero no aparece como 0'; end if;
  if n -> 'notas' ? 'parcial2' then raise exception 'FALLO: una nota pendiente aparece calificada'; end if;
  if jsonb_array_length(n -> 'extras') <> 1 then raise exception 'FALLO: extras del estudiante'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"df000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'df000000-0000-4000-8000-000000000001', true);
do $$
declare v_id uuid;
begin
  select id into v_id from public.class_extra_points('df000000-0000-4000-8000-000000000031') limit 1;
  perform public.review_extra_points(v_id, 'revertido', 'Error de asignación');
  if (select extras from public.gradebook_official('df000000-0000-4000-8000-000000000031') where user_id = 'df000000-0000-4000-8000-000000000012') <> 0 then
    raise exception 'FALLO: la reversión no descontó los puntos';
  end if;
  if (select status from public.class_extra_points('df000000-0000-4000-8000-000000000031') where id = v_id) <> 'revertido' then
    raise exception 'FALLO: no se conservó la asignación revertida';
  end if;
  -- revocar el cargo: el exmonitor pierde el acceso
  perform public.set_class_monitor('df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000011', false);
end $$;

select set_config('request.jwt.claims', '{"sub":"df000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'df000000-0000-4000-8000-000000000011', true);
do $$ begin
  begin
    perform public.add_extra_points(gen_random_uuid(), 'df000000-0000-4000-8000-000000000031', 'df000000-0000-4000-8000-000000000012', 1, 'Tras revocar');
    raise exception 'FALLO: el exmonitor siguió asignando';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'PRUEBAS DEL REGISTRO DE CALIFICACIONES PASARON' as resultado;
rollback;
