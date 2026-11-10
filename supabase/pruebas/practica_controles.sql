-- Pruebas: en laboratorio, la PRÁCTICA se calcula con los CONTROLES (migración 91). Se deshace al final.
-- Cada control que cuenta vale lo mismo (30/7 con 7 que cuentan); suma si la entrega vigente está entregada o aprobada;
-- «requiere corrección» no suma; un control que no cuenta (aquí el 6) no suma aunque esté aprobado; la nota a mano manda;
-- con una actividad sin valor fijo en la Práctica, se reparten los 30. Una asignatura normal no cambia.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d9100000-0000-4000-8000-000000000001', 'pc1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-pctl","aula_role":"teacher"}', '{}', now(), now()),
  ('d9100000-0000-4000-8000-000000000011', 'pc11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pc-a"}', '{}', now(), now()),
  ('d9100000-0000-4000-8000-000000000012', 'pc12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pc-b"}', '{}', now(), now()),
  ('d9100000-0000-4000-8000-000000000013', 'pc13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pc-c"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'd9100000-%';
update public.profiles set role = 'teacher', full_name = 'Profesor Controles' where id = 'd9100000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'Ana Controles' where id = 'd9100000-0000-4000-8000-000000000011';
update public.profiles set full_name = 'Beto Controles' where id = 'd9100000-0000-4000-8000-000000000012';
update public.profiles set full_name = 'Caro Teoría' where id = 'd9100000-0000-4000-8000-000000000013';
insert into public.courses (id, title, laboratorio_controles) values
  ('d9100000-0000-4000-8000-000000000021', 'Laboratorio 91', 8),
  ('d9100000-0000-4000-8000-000000000022', 'Teoría 91', null);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d9100000-0000-4000-8000-000000000031', 'd9100000-0000-4000-8000-000000000021', 'Sección Lab 91', 'PRCTL91A', 'd9100000-0000-4000-8000-000000000001'),
  ('d9100000-0000-4000-8000-000000000032', 'd9100000-0000-4000-8000-000000000022', 'Sección Teo 91', 'PRCTL91B', 'd9100000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('d9100000-0000-4000-8000-000000000031', 'd9100000-0000-4000-8000-000000000001'),
  ('d9100000-0000-4000-8000-000000000032', 'd9100000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('d9100000-0000-4000-8000-000000000031', 'd9100000-0000-4000-8000-000000000011'),
  ('d9100000-0000-4000-8000-000000000031', 'd9100000-0000-4000-8000-000000000012'),
  ('d9100000-0000-4000-8000-000000000032', 'd9100000-0000-4000-8000-000000000013');
insert into public.activities (id, class_id, title, mode, published, closes_at) values
  ('d9100000-0000-4000-8000-0000000000a1', 'd9100000-0000-4000-8000-000000000031', 'Lab cerrada 91', 'practice', true, now() - interval '1 day');

-- permisos de las funciones nuevas
do $$ begin
  perform public.lab_asegurar_controles('d9100000-0000-4000-8000-000000000031');
  if (select count(*) from public.upload_boxes where class_id = 'd9100000-0000-4000-8000-000000000031' and control_number is not null) <> 8 then
    raise exception 'FALLO: la sección de laboratorio no tiene sus 8 controles';
  end if;
  if (select count(*) from public.upload_boxes where class_id = 'd9100000-0000-4000-8000-000000000031' and not cuenta_en_practica) <> 0 then
    raise exception 'FALLO: un control nuevo debe contar por defecto';
  end if;
  if has_function_privilege('authenticated', 'public.lab_controles_cuentan(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.lab_controles_ok(uuid)', 'execute')
     or has_function_privilege('anon', 'public.lab_control_cuenta(uuid, integer, boolean)', 'execute')
     or not has_function_privilege('authenticated', 'public.lab_control_cuenta(uuid, integer, boolean)', 'execute') then
    raise exception 'FALLO: permisos de las funciones de la migración 91';
  end if;
end $$;

-- entregas (como servidor): Ana — 1 entregado, 2 y 3 aprobados, 4 requiere corrección, 5 corregido y vuelto a subir,
-- 6 aprobado (no contará), 7 y 8 sin entregar. Beto, nada.
do $$
declare v_a uuid := 'd9100000-0000-4000-8000-000000000011'; b uuid; k integer; st text;
begin
  foreach k in array array[1, 2, 3, 4, 6] loop
    select id into b from public.upload_boxes where class_id = 'd9100000-0000-4000-8000-000000000031' and control_number = k;
    st := case k when 1 then 'recibido' when 4 then 'rechazado' else 'aceptado' end;
    insert into public.upload_files (id, box_id, user_id, storage_path, original_name, size_bytes, sha256, mime, uploaded_at, status)
      values (gen_random_uuid(), b, v_a, 'pc91/' || k || '/a.jpg', 'Control ' || k || '.jpg', 1000, repeat('a', 64), 'image/jpeg', now() - interval '2 hours', st);
  end loop;
  select id into b from public.upload_boxes where class_id = 'd9100000-0000-4000-8000-000000000031' and control_number = 5;
  insert into public.upload_files (id, box_id, user_id, storage_path, original_name, size_bytes, sha256, mime, uploaded_at, status) values
    (gen_random_uuid(), b, v_a, 'pc91/5/a.jpg', 'Control 5.jpg', 1000, repeat('a', 64), 'image/jpeg', now() - interval '2 hours', 'rechazado'),
    (gen_random_uuid(), b, v_a, 'pc91/5/b.jpg', 'Control 5.jpg', 1000, repeat('b', 64), 'image/jpeg', now() - interval '1 hour', 'recibido');
end $$;

-- ===== profesor =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9100000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9100000-0000-4000-8000-000000000001', true);

do $$
declare c uuid := 'd9100000-0000-4000-8000-000000000031'; v_pa numeric; v_pb numeric; j jsonb; e jsonb;
begin
  -- antes de quitar el 6: 8 cuentan; Ana tiene 1, 2, 3, 5 y 6 → 5/8 de 30 = 18,75
  select g.practica into v_pa from public.gradebook_official(c) g where g.user_id = 'd9100000-0000-4000-8000-000000000011';
  if v_pa is distinct from 18.75 then raise exception 'FALLO: con 8 controles, Ana debía tener 18,75 y tiene %', v_pa; end if;

  -- el control 6 deja de contar
  if public.lab_control_cuenta(c, 6, false) <> 1 then raise exception 'FALLO: lab_control_cuenta no cambió el control 6'; end if;
  begin perform public.lab_control_cuenta(c, 9, false); raise exception 'FALLO: aceptó un control inexistente';
  exception when sqlstate '22023' then null; end;
  begin perform public.lab_control_cuenta('d9100000-0000-4000-8000-000000000032', 1, false); raise exception 'FALLO: aceptó una sección que no es de laboratorio';
  exception when sqlstate 'P0001' then null; end;

  -- 7 cuentan; Ana: 1 (entregado), 2, 3 (aprobados) y 5 (vuelto a subir) = 4 → 30·4/7 = 17,14; el 4 (requiere corrección) y el 6 no
  select g.practica into v_pa from public.gradebook_official(c) g where g.user_id = 'd9100000-0000-4000-8000-000000000011';
  select g.practica into v_pb from public.gradebook_official(c) g where g.user_id = 'd9100000-0000-4000-8000-000000000012';
  if v_pa is distinct from 17.14 then raise exception 'FALLO: Ana debía tener 17,14 en Práctica y tiene %', v_pa; end if;
  if v_pb is distinct from 0.00 then raise exception 'FALLO: Beto, sin controles, debía tener 0 y tiene %', v_pb; end if;

  -- panel de controles: el 6 no cuenta; Ana tiene 5 entregados y 4 que cuentan
  j := public.lab_controles_seccion(c);
  if (select x ->> 'cuenta' from jsonb_array_elements(j -> 'cajas') x where (x ->> 'numero')::int = 6) <> 'false'
     or (select count(*) from jsonb_array_elements(j -> 'cajas') x where (x ->> 'cuenta')::boolean) <> 7 then
    raise exception 'FALLO: el panel no refleja qué controles cuentan';
  end if;
  select x into e from jsonb_array_elements(j -> 'estudiantes') x where x ->> 'user_id' = 'd9100000-0000-4000-8000-000000000011';
  if (e ->> 'entregados')::int <> 5 or (e ->> 'en_practica')::int <> 4 then
    raise exception 'FALLO: entregados/en_practica de Ana en el panel: %', e;
  end if;

  -- la nota a mano manda
  perform public.set_official_grade(c, 'd9100000-0000-4000-8000-000000000012', 'practica', 25);
  select g.practica into v_pb from public.gradebook_official(c) g where g.user_id = 'd9100000-0000-4000-8000-000000000012';
  if v_pb <> 25 then raise exception 'FALLO: la nota a mano no mandó sobre los controles (%)', v_pb; end if;
  perform public.set_official_grade(c, 'd9100000-0000-4000-8000-000000000012', 'practica', null);

  -- una actividad sin valor fijo en la Práctica: se reparten los 30 (15 los controles, 15 la actividad)
  perform public.set_activity_grade_link('d9100000-0000-4000-8000-0000000000a1', 'practica', null);
  if (select peso_efectivo from public.class_activity_links(c) where activity_id = 'd9100000-0000-4000-8000-0000000000a1') <> 15 then
    raise exception 'FALLO: la actividad sin valor fijo debía valer 15 junto a los controles';
  end if;
  select g.practica into v_pa from public.gradebook_official(c) g where g.user_id = 'd9100000-0000-4000-8000-000000000011';
  if v_pa is distinct from 8.57 then raise exception 'FALLO: con la actividad (cerrada, sin intento) Ana debía tener 8,57 y tiene %', v_pa; end if;
  -- con valor fijo de 30 la actividad se lleva todo y los controles no suman
  perform public.set_activity_grade_link('d9100000-0000-4000-8000-0000000000a1', 'practica', 30);
  select g.practica into v_pa from public.gradebook_official(c) g where g.user_id = 'd9100000-0000-4000-8000-000000000011';
  if v_pa is distinct from 0.00 then raise exception 'FALLO: con la actividad de 30 fijos los controles no debían sumar (%)', v_pa; end if;
  perform public.set_activity_grade_link('d9100000-0000-4000-8000-0000000000a1', null, null);

  -- la asignatura normal no cambia: sin vínculos, Práctica pendiente
  if (select g.practica from public.gradebook_official('d9100000-0000-4000-8000-000000000032') g) is not null then
    raise exception 'FALLO: la asignatura normal tiene Práctica calculada';
  end if;
end $$;

-- ===== estudiante: su desglose y sus controles =====
select set_config('request.jwt.claims', '{"sub":"d9100000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9100000-0000-4000-8000-000000000011', true);
do $$
declare d jsonb; p jsonb; m jsonb;
begin
  select x into d from jsonb_array_elements(public.my_grade_breakdown()) x where x ->> 'class_id' = 'd9100000-0000-4000-8000-000000000031';
  select x into p from jsonb_array_elements(d -> 'categorias') x where x ->> 'category' = 'practica';
  if p -> 'controles' is null or (p -> 'controles' ->> 'cuentan')::int <> 7 or (p -> 'controles' ->> 'entregados')::int <> 4
     or (p -> 'controles' ->> 'peso')::numeric <> 30 then
    raise exception 'FALLO: desglose de la Práctica por controles: %', p -> 'controles';
  end if;
  if exists (select 1 from jsonb_array_elements(d -> 'categorias') x where x ? 'controles' and x -> 'controles' <> 'null'::jsonb and x ->> 'category' <> 'practica') then
    raise exception 'FALLO: los controles aparecen fuera de la Práctica';
  end if;
  m := public.lab_mis_controles('d9100000-0000-4000-8000-000000000021');
  if (select x ->> 'cuenta' from jsonb_array_elements(m -> 'secciones' -> 0 -> 'controles') x where (x ->> 'numero')::int = 6) <> 'false' then
    raise exception 'FALLO: el estudiante no ve que el control 6 no cuenta';
  end if;
  begin perform public.lab_control_cuenta('d9100000-0000-4000-8000-000000000031', 6, true); raise exception 'FALLO: un estudiante cambió qué controles cuentan';
  exception when sqlstate '42501' then null; end;
end $$;

reset role;
select 'practica_controles.sql: PRUEBAS PASARON' as resultado;
rollback;
