-- =============================================================================
-- Pruebas: cuentas por ID (migración 4) y asignaturas/secciones (migración 5).
-- Todo dentro de una transacción que se deshace al final (no deja datos).
-- =============================================================================
begin;

-- Cuentas: administrador (creado «a mano» y promovido con bootstrap_admin), profesor y estudiantes creados por el servidor,
-- y una cuenta de registro público que intenta darse rol de administrador.
insert into auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'admin.prueba@example.com', 'authenticated', 'authenticated', 'hash-admin', '{}', '{}', now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'u1@cuentas.aula.invalid', 'authenticated', 'authenticated', 'hash-prof',
     '{"login_id":"Prof-01","full_name":"Profe Uno","aula_role":"teacher"}', '{}', now(), now()),
  ('b1000000-0000-4000-8000-000000000003', 'u2@cuentas.aula.invalid', 'authenticated', 'authenticated', 'hash-provisional',
     '{"login_id":"  EST-100 ","full_name":"Estudiante Cien"}', '{}', now(), now()),
  ('b1000000-0000-4000-8000-000000000004', 'u3@cuentas.aula.invalid', 'authenticated', 'authenticated', 'hash-otro',
     '{"login_id":"est-200","full_name":"Estudiante Doscientos"}', '{}', now(), now()),
  ('b1000000-0000-4000-8000-000000000005', 'intruso@example.com', 'authenticated', 'authenticated', 'hash-intruso',
     '{}', '{"full_name":"Intruso","aula_role":"teacher","role":"admin","login_id":"admin"}', now(), now());

do $$ begin
  if (select public.bootstrap_admin('admin.prueba@example.com', 'Admin-Prueba')) not like 'Listo%' then raise exception 'FALLO: bootstrap_admin'; end if;
  if (select login_id from public.profiles where id = 'b1000000-0000-4000-8000-000000000003') <> 'est-100' then raise exception 'FALLO: el ID no se normalizó'; end if;
  if (select role from public.profiles where id = 'b1000000-0000-4000-8000-000000000002') <> 'teacher' then raise exception 'FALLO: rol de profesor desde app_metadata'; end if;
  if not (select must_change_password from public.profiles where id = 'b1000000-0000-4000-8000-000000000003') then raise exception 'FALLO: la cuenta nueva no exige cambiar la contraseña'; end if;
  if (select active or role <> 'student' or login_id is not null from public.profiles where id = 'b1000000-0000-4000-8000-000000000005') then
    raise exception 'FALLO: el registro público obtuvo cuenta activa, rol o ID desde user_metadata';
  end if;
end $$;
-- el profesor ya cambió su contraseña provisional
update public.profiles set must_change_password = false where id = 'b1000000-0000-4000-8000-000000000002';
update public.profiles set must_change_password = false where id = 'b1000000-0000-4000-8000-000000000004';

-- Asignaturas y secciones
insert into public.courses (id, title) values
  ('b2000000-0000-4000-8000-000000000001', 'Física General I (prueba)'),
  ('b2000000-0000-4000-8000-000000000002', 'Física General III (prueba)');
insert into public.units (id, course_id, slug, title) values ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'u1', 'U1');
insert into public.lessons (id, unit_id, course_id, slug, title) values ('b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'l1', 'L1');
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt) values
  ('b5000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'g1', 'numerica', 'basico', 'practice', 'numeric', '¿?');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('b6000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'FG1 Sección 01', 'SECC0001', 'b1000000-0000-4000-8000-000000000002'),
  ('b6000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'FG1 Sección 02', 'SECC0002', 'b1000000-0000-4000-8000-000000000002'),
  ('b6000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002', 'FG3 Sección 01', 'SECC0003', 'b1000000-0000-4000-8000-000000000001');
insert into public.activities (id, class_id, title, mode, published) values
  ('b7000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'Práctica compartida', 'practice', true);
insert into public.activity_items (activity_id, exercise_id, points) values ('b7000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 2);

-- Como hace Supabase Auth con createUser: primero inserta el usuario SIN app_metadata y después la guarda.
insert into auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('b1000000-0000-4000-8000-000000000006', 'u6@cuentas.aula.invalid', 'authenticated', 'authenticated', 'hash-6',
        '{"provider":"email","providers":["email"]}', '{}', now(), now());
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"login_id":"Dos-Pasos","full_name":"Alta en dos pasos","aula_role":"teacher"}'
  where id = 'b1000000-0000-4000-8000-000000000006';

-- ---------------------------------------------------------------------------
-- Funciones de servicio (como service_role, igual que las Edge Functions)
-- ---------------------------------------------------------------------------
set local role service_role;
do $$
declare v jsonb;
begin
  v := public.svc_account_issued('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000006', 'create');
  if v ->> 'login_id' <> 'dos-pasos' or v ->> 'full_name' <> 'Alta en dos pasos' then
    raise exception 'FALLO: el alta en dos pasos no copió el ID y el nombre de app_metadata: %', v;
  end if;
  if (select role from public.profiles where id = 'b1000000-0000-4000-8000-000000000006') <> 'teacher' then
    raise exception 'FALLO: el alta en dos pasos no copió el rol';
  end if;
  if (select public.svc_login_check('dos-pasos', 'ip-z') ->> 'user_id') is null then
    raise exception 'FALLO: la cuenta creada en dos pasos no se encuentra por su ID';
  end if;
  v := public.svc_account_issued('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'create');
  if v ->> 'login_id' <> 'est-100' then raise exception 'FALLO: svc_account_issued'; end if;
  begin
    perform public.svc_account_issued('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'reset_password');
    raise exception 'FALLO: un profesor (no administrador) restableció una contraseña';
  exception when insufficient_privilege then null;
  end;
  if public.svc_enroll('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', array['b6000000-0000-4000-8000-000000000001'::uuid]) <> 1 then
    raise exception 'FALLO: svc_enroll';
  end if;
  -- acceso: ID existente, ID inexistente, formato inválido
  v := public.svc_login_check('EST-100', 'ip-a');
  if not (v ->> 'allowed')::boolean or v ->> 'email' <> 'u2@cuentas.aula.invalid' then raise exception 'FALLO: svc_login_check con ID válido'; end if;
  v := public.svc_login_check('no-existe-99', 'ip-a');
  if not (v ->> 'allowed')::boolean or v ->> 'user_id' is not null then raise exception 'FALLO: svc_login_check con ID inexistente'; end if;
  if (public.svc_login_check('a', 'ip-a') ->> 'reason') <> 'invalid_format' then raise exception 'FALLO: formato de ID'; end if;
  -- 5 fallos → bloqueo temporal del ID (también para IDs inexistentes: no revela si existen)
  for i in 1..5 loop
    perform public.svc_login_record('est-100', 'b1000000-0000-4000-8000-000000000003', 'ip-a', false, 'bad_password');
    perform public.svc_login_record('no-existe-99', null, 'ip-a', false, 'unknown_id');
  end loop;
  if (public.svc_login_check('est-100', 'ip-b') ->> 'reason') <> 'locked' then raise exception 'FALLO: no se bloqueó el ID tras 5 fallos'; end if;
  if (public.svc_login_check('no-existe-99', 'ip-b') ->> 'reason') <> 'locked' then raise exception 'FALLO: el bloqueo revela qué IDs existen'; end if;
  if (public.svc_login_record('est-200', 'b1000000-0000-4000-8000-000000000004', 'ip-c', true, 'ok') ->> 'must_change_password')::boolean then
    raise exception 'FALLO: must_change_password tras acceso correcto';
  end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Estudiante con contraseña provisional: no ve nada hasta cambiarla
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true);
do $$ begin
  if exists (select 1 from public.lessons) then raise exception 'FALLO: con contraseña provisional ve lecciones'; end if;
  if jsonb_array_length(public.my_classes()) <> 0 then raise exception 'FALLO: con contraseña provisional ve sus clases'; end if;
  if exists (select 1 from public.login_attempts) or exists (select 1 from public.account_events) then raise exception 'FALLO: un estudiante ve registros de acceso'; end if;
  begin
    perform public.svc_login_check('est-100', 'x');
    raise exception 'FALLO: un estudiante ejecutó svc_login_check';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_list_users('');
    raise exception 'FALLO: un estudiante listó usuarios';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.confirm_password_changed();
    raise exception 'FALLO: confirmó el cambio sin cambiar la contraseña';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
  begin
    update public.profiles set must_change_password = false, active = true, login_id = 'otro' where id = auth.uid();
    raise exception 'FALLO: el estudiante modificó campos protegidos de su perfil';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
update auth.users set encrypted_password = 'hash-nuevo-del-estudiante' where id = 'b1000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$ begin
  if not public.confirm_password_changed() then raise exception 'FALLO: confirm_password_changed'; end if;
  if not exists (select 1 from public.lessons) then raise exception 'FALLO: tras cambiar la contraseña no ve sus lecciones'; end if;
  if jsonb_array_length(public.my_classes()) <> 1 then raise exception 'FALLO: debería ver exactamente su sección'; end if;
  if exists (select 1 from public.activities where class_id = 'b6000000-0000-4000-8000-000000000002') then raise exception 'FALLO: ve actividades de otra sección'; end if;
  if exists (select 1 from public.classes where id = 'b6000000-0000-4000-8000-000000000003') then raise exception 'FALLO: ve una sección en la que no está matriculado'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profesor: matrícula por ID, copia de actividades y resumen de secciones
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
do $$
declare v jsonb;
begin
  v := public.enroll_students_by_login('b6000000-0000-4000-8000-000000000002', array['EST-100', 'est-200', 'nadie-123', 'prof-01']);
  if v -> 'matriculados' <> '["est-100", "est-200"]'::jsonb then raise exception 'FALLO: matrícula por ID: %', v; end if;
  if v -> 'no_encontrados' <> '["nadie-123"]'::jsonb or v -> 'no_son_estudiantes' <> '["prof-01"]'::jsonb then raise exception 'FALLO: clasificación de IDs: %', v; end if;
  v := public.enroll_students_by_login('b6000000-0000-4000-8000-000000000002', array['est-100']);
  if v -> 'ya_estaban' <> '["est-100"]'::jsonb then raise exception 'FALLO: matrícula repetida'; end if;
  begin
    perform public.enroll_students_by_login('b6000000-0000-4000-8000-000000000003', array['est-100']);
    raise exception 'FALLO: matriculó en una sección ajena';
  exception when insufficient_privilege then null;
  end;
  v := public.copy_activity_to_classes('b7000000-0000-4000-8000-000000000001', array['b6000000-0000-4000-8000-000000000002'::uuid]);
  if jsonb_array_length(v) <> 1 then raise exception 'FALLO: copia de actividad'; end if;
  if (select count(*) from public.activity_items i join public.activities a on a.id = i.activity_id
      where a.class_id = 'b6000000-0000-4000-8000-000000000002' and i.points = 2) <> 1 then raise exception 'FALLO: los ejercicios no se copiaron'; end if;
  if exists (select 1 from public.activities where class_id = 'b6000000-0000-4000-8000-000000000002' and published) then
    raise exception 'FALLO: la copia debería quedar como borrador';
  end if;
  begin
    perform public.copy_activity_to_classes('b7000000-0000-4000-8000-000000000001', array['b6000000-0000-4000-8000-000000000003'::uuid]);
    raise exception 'FALLO: copió a una sección ajena o de otra asignatura';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
  v := public.teacher_overview();
  if jsonb_array_length(v) <> 2 then raise exception 'FALLO: el resumen debería mostrar sus 2 secciones (tiene %)', jsonb_array_length(v); end if;
  if (select (x ->> 'students')::int from jsonb_array_elements(v) x where x ->> 'name' = 'FG1 Sección 02') <> 2 then raise exception 'FALLO: conteo de estudiantes'; end if;
  if exists (select 1 from public.login_attempts) then raise exception 'FALLO: un profesor ve los registros de acceso'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Administrador: suspensión
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select public.svc_set_suspended('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', true);
do $$ begin
  begin
    perform public.svc_set_suspended('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', true);
    raise exception 'FALLO: el administrador pudo suspenderse a sí mismo';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true);
do $$ begin
  if exists (select 1 from public.lessons) then raise exception 'FALLO: una cuenta suspendida sigue viendo lecciones'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
do $$ begin
  if not exists (select 1 from public.login_attempts) then raise exception 'FALLO: el administrador no ve los intentos de acceso'; end if;
  if jsonb_array_length(public.admin_suspicious_logins()) < 2 then raise exception 'FALLO: intentos sospechosos'; end if;
  if (select (x ->> 'active')::boolean from jsonb_array_elements(public.admin_list_users('est-100')) x) then raise exception 'FALLO: listado de cuentas'; end if;
end $$;

reset role;
rollback;
select 'PRUEBAS DE CUENTAS Y SECCIONES PASARON' as resultado;
