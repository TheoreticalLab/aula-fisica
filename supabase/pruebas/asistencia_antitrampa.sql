-- Pruebas: asistencia anti-trampa (migración 26): código rotativo, ubicación, un dispositivo por estudiante.
-- Datos sintéticos (coordenadas inventadas); transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d9000000-0000-4000-8000-000000000001', 'ta1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-trampa","aula_role":"teacher"}', '{}', now(), now()),
  ('d9000000-0000-4000-8000-000000000011', 'tb1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tr-1"}', '{}', now(), now()),
  ('d9000000-0000-4000-8000-000000000012', 'tb2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tr-2"}', '{}', now(), now()),
  ('d9000000-0000-4000-8000-000000000013', 'tb3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tr-3"}', '{}', now(), now()),
  ('d9000000-0000-4000-8000-000000000014', 'tb4@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tr-4"}', '{}', now(), now()),
  ('d9000000-0000-4000-8000-000000000015', 'tb5@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tr-5"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'd9000000-%';
update public.profiles set role = 'teacher' where id = 'd9000000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('d9000000-0000-4000-8000-000000000021', 'Curso trampa');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000021', 'Sección trampa', 'TRAMPA01', 'd9000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('d9000000-0000-4000-8000-000000000031', 'd9000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'd9000000-0000-4000-8000-000000000031', ('d9000000-0000-4000-8000-0000000000' || n)::uuid from unnest(array['11', '12', '13', '14', '15']) n;

do $$ begin
  -- la distancia: 0,001° de latitud ≈ 111 m
  if abs(public.geo_distance_m(18.0, -70.0, 18.001, -70.0) - 111.2) > 1 then raise exception 'FALLO: distancia'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000001', true);
do $$ begin
  -- no se puede exigir ubicación sin la del profesor
  begin perform public.attendance_start('d9000000-0000-4000-8000-000000000031', 10, 30, null, null, null, true, 100); raise exception 'FALLO: exigió ubicación sin referencia';
  exception when invalid_parameter_value then null; end;
end $$;
-- aula de referencia en (18.0000, -70.0000), radio 100 m, código cada 30 s, ubicación obligatoria
select set_config('prueba.tr', public.attendance_start('d9000000-0000-4000-8000-000000000031', 10, 30, 18.0, -70.0, 15, true, 100) ->> 'id', true);
do $$
declare l jsonb := public.attendance_live(current_setting('prueba.tr')::uuid);
begin
  if l ->> 'code' !~ '^[0-9]{6}$' or (l ->> 'rotate_seconds')::int <> 30 or l ->> 'code_changes_at' is null then raise exception 'FALLO: vista del código rotativo'; end if;
end $$;

reset role;
-- códigos de la ventana actual, la anterior y la de hace dos ventanas (calculados como el servidor)
do $$
declare v_id uuid := current_setting('prueba.tr')::uuid; w bigint := public.attendance_window(30);
begin
  perform set_config('prueba.c0', public.attendance_code_at(v_id, w), true);
  perform set_config('prueba.c1', public.attendance_code_at(v_id, w - 1), true);
  perform set_config('prueba.c2', public.attendance_code_at(v_id, w - 2), true);
  if current_setting('prueba.c0') = current_setting('prueba.c1') then raise exception 'FALLO: el código no rota'; end if;
end $$;
set local role authenticated;

-- 1) estudiante 1 en el aula (≈ 33 m), con su dispositivo: presente y verificado; no puede calcular códigos
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000011', true);
do $$
declare r jsonb;
begin
  r := public.attendance_check_in(current_setting('prueba.c0'), 18.0003, -70.0, 20, 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: estudiante en el aula rechazado (%)', r; end if;
  begin perform public.attendance_code_at(current_setting('prueba.tr')::uuid, 1); raise exception 'FALLO: un estudiante calculó el código';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) estudiante 2 en otra ciudad con el código correcto: rechazado y registrado; sin ubicación: rechazado
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000012', true);
do $$
declare r jsonb;
begin
  r := public.attendance_check_in(current_setting('prueba.c0'), 19.45, -70.69, 15, 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb');
  if (r ->> 'ok')::boolean or r ->> 'error' not like '%fuera del aula%' then raise exception 'FALLO: aceptó a alguien a ~100 km (%)', r; end if;
  r := public.attendance_check_in(current_setting('prueba.c0'), null, null, null, 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb');
  if (r ->> 'ok')::boolean or r ->> 'error' not like '%exige compartir su ubicación%' then raise exception 'FALLO: aceptó sin ubicación (%)', r; end if;
  -- el atajo antiguo (sin ubicación) tampoco sirve en una asistencia que la exige
  if (public.attendance_mark(current_setting('prueba.c0')) ->> 'ok')::boolean then raise exception 'FALLO: attendance_mark saltó la ubicación'; end if;
end $$;

-- 3) estudiante 3 en el aula pero desde el MISMO dispositivo que el estudiante 1: rechazado
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000013', true);
do $$
declare r jsonb;
begin
  r := public.attendance_check_in(current_setting('prueba.c0'), 18.0002, -70.0001, 20, 'AAAAAAAA-1111-4111-8111-AAAAAAAAAAAA');
  if (r ->> 'ok')::boolean or r ->> 'error' not like '%otro estudiante%' then raise exception 'FALLO: un dispositivo marcó a dos estudiantes (%)', r; end if;
end $$;

-- 4) estudiante 4: el código de la ventana anterior vale; el de hace dos ventanas no
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000014","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000014', true);
do $$
declare r jsonb;
begin
  if current_setting('prueba.c2') not in (current_setting('prueba.c0'), current_setting('prueba.c1')) then
    r := public.attendance_check_in(current_setting('prueba.c2'), 18.0001, -70.0, 10, 'dddddddd-4444-4444-8444-dddddddddddd');
    if (r ->> 'ok')::boolean then raise exception 'FALLO: aceptó un código de hace dos ventanas'; end if;
  end if;
  r := public.attendance_check_in(current_setting('prueba.c1'), 18.0001, -70.0, 10, 'dddddddd-4444-4444-8444-dddddddddddd');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: rechazó el código de la ventana anterior (%)', r; end if;
end $$;

-- 5) estudiante 5 con ubicación muy imprecisa (± 800 m) a 400 m: se acepta, marcado como «impreciso»
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000015","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000015', true);
do $$
declare r jsonb;
begin
  r := public.attendance_check_in(current_setting('prueba.c0'), 18.0036, -70.0, 800, 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: ubicación imprecisa (%)', r; end if;
end $$;

-- 6) el profesor ve la verificación de cada presente y los intentos rechazados
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000001', true);
do $$
declare l jsonb := public.attendance_live(current_setting('prueba.tr')::uuid);
begin
  if (select count(*) from jsonb_array_elements(l -> 'estudiantes') e where (e ->> 'presente')::boolean) <> 3 then raise exception 'FALLO: presentes (%)', l -> 'estudiantes'; end if;
  if (select e ->> 'geo_status' from jsonb_array_elements(l -> 'estudiantes') e where e ->> 'student_code' is null and (e ->> 'distance_m')::int between 25 and 40) <> 'verificado' then
    raise exception 'FALLO: verificación del estudiante en el aula';
  end if;
  if not exists (select 1 from jsonb_array_elements(l -> 'estudiantes') e where e ->> 'geo_status' = 'impreciso') then raise exception 'FALLO: marca de imprecisión'; end if;
  if (select count(*) from jsonb_array_elements(l -> 'rechazos') x where x ->> 'motivo' = 'lejos' and (x ->> 'distance_m')::int > 50000) <> 1 then raise exception 'FALLO: rechazo por distancia'; end if;
  if not exists (select 1 from jsonb_array_elements(l -> 'rechazos') x where x ->> 'motivo' = 'dispositivo_compartido') then raise exception 'FALLO: rechazo por dispositivo'; end if;
  if not exists (select 1 from jsonb_array_elements(l -> 'rechazos') x where x ->> 'motivo' = 'sin_ubicacion') then raise exception 'FALLO: rechazo sin ubicación'; end if;
end $$;
reset role;
select 'PRUEBAS DE ASISTENCIA ANTI-TRAMPA PASARON' as resultado;
rollback;
