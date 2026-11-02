-- Pruebas: huellas de archivos y bloqueo de duplicados entre estudiantes (migración 67). Se deshace al final.
-- A sube primero (sección 1); B (sección 2, MISMA asignatura) intenta subir lo mismo; Z es de otra asignatura.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de670000-0000-4000-8000-000000000001', 'hu1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-huellas","aula_role":"teacher"}', '{}', now(), now()),
  ('de670000-0000-4000-8000-000000000011', 'hu11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-hu-a"}', '{}', now(), now()),
  ('de670000-0000-4000-8000-000000000012', 'hu12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-hu-b"}', '{}', now(), now()),
  ('de670000-0000-4000-8000-000000000013', 'hu13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-hu-z"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de670000-%';
update public.profiles set role = 'teacher' where id = 'de670000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'Estudiante ' || right(id::text, 2) where id::text like 'de670000-%';
insert into public.courses (id, title) values ('de670000-0000-4000-8000-000000000021', 'Curso huellas'), ('de670000-0000-4000-8000-000000000022', 'Otra asignatura');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de670000-0000-4000-8000-000000000031', 'de670000-0000-4000-8000-000000000021', 'Sección 1', 'HUELLA01', 'de670000-0000-4000-8000-000000000001'),
  ('de670000-0000-4000-8000-000000000032', 'de670000-0000-4000-8000-000000000021', 'Sección 2', 'HUELLA02', 'de670000-0000-4000-8000-000000000001'),
  ('de670000-0000-4000-8000-000000000033', 'de670000-0000-4000-8000-000000000022', 'Otra', 'HUELLA03', 'de670000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de670000-0000-4000-8000-000000000032', 'de670000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.upload_boxes (id, class_id, title) values
  ('de670000-0000-4000-8000-0000000000b1', 'de670000-0000-4000-8000-000000000031', 'Práctica 1'),
  ('de670000-0000-4000-8000-0000000000b2', 'de670000-0000-4000-8000-000000000032', 'Práctica 1'),
  ('de670000-0000-4000-8000-0000000000b3', 'de670000-0000-4000-8000-000000000033', 'Práctica 1');
insert into public.upload_files (id, box_id, user_id, storage_path, original_name, size_bytes, sha256) values
  ('de670000-0000-4000-8000-0000000000f1', 'de670000-0000-4000-8000-0000000000b1', 'de670000-0000-4000-8000-000000000011', 'x/a1.pdf', 'a.pdf', 100, repeat('a', 64)),
  ('de670000-0000-4000-8000-0000000000f2', 'de670000-0000-4000-8000-0000000000b1', 'de670000-0000-4000-8000-000000000011', 'x/a2.pdf', 'a2.pdf', 100, repeat('c', 64));

set local role service_role;
do $$ declare r jsonb; begin
  -- A registra dos archivos: un PDF y (como imagen) una huella perceptual
  perform public.svc_huella_guardar('pdf', 'de670000-0000-4000-8000-0000000000f1', 'de670000-0000-4000-8000-000000000011', null, 'de670000-0000-4000-8000-0000000000b1', repeat('a', 64), null, null);
  perform public.svc_huella_guardar('pdf', 'de670000-0000-4000-8000-0000000000f2', 'de670000-0000-4000-8000-000000000011', null, 'de670000-0000-4000-8000-0000000000b1', repeat('c', 64), repeat('e', 64), 'f0f0f0f0f0f0f0f0');

  -- distancia de Hamming
  if public.hamming64('0000000000000000', '0000000000000000') <> 0 or public.hamming64('0000000000000000', '000000000000000f') <> 4
     or public.hamming64('ffffffffffffffff', '0000000000000000') <> 64 or public.hamming64(null, '0000000000000000') <> 64 then raise exception 'FALLO: hamming'; end if;

  -- 1) B, de OTRA sección de la misma asignatura, sube el mismo PDF: bloqueado (exacto) y solicitud registrada
  r := public.svc_huella_check('de670000-0000-4000-8000-000000000012', null, 'de670000-0000-4000-8000-0000000000b2', 'pdf', repeat('a', 64), null, null);
  if (r ->> 'ok')::boolean or not (r ->> 'exacto')::boolean or r ->> 'solicitud' is null then raise exception 'FALLO: copia exacta %', r; end if;
  -- el mismo archivo original (reoptimizado: otro SHA de lo subido, mismo SHA del original): bloqueado
  r := public.svc_huella_check('de670000-0000-4000-8000-000000000012', 'de670000-0000-4000-8000-000000000032', null, 'captura', repeat('9', 64), repeat('e', 64), null);
  if (r ->> 'ok')::boolean then raise exception 'FALLO: mismo original'; end if;
  -- 2) la misma imagen con otra resolución/compresión (dHash a 6 bits): bloqueada
  r := public.svc_huella_check('de670000-0000-4000-8000-000000000012', 'de670000-0000-4000-8000-000000000032', null, 'captura', repeat('1', 64), null, 'f0f0f0f0f0f0f0cf');
  if (r ->> 'ok')::boolean or (r ->> 'exacto')::boolean or (r ->> 'distancia')::int <> public.hamming64('f0f0f0f0f0f0f0f0', 'f0f0f0f0f0f0f0cf') then raise exception 'FALLO: parecida %', r; end if;
  -- 3) una imagen distinta (muchos bits distintos): permitida
  if not (public.svc_huella_check('de670000-0000-4000-8000-000000000012', 'de670000-0000-4000-8000-000000000032', null, 'captura', repeat('2', 64), null, '0f0f0f0f0f0f0f0f') ->> 'ok')::boolean then
    raise exception 'FALLO: imagen distinta bloqueada'; end if;
  -- 4) el MISMO estudiante puede volver a subir lo suyo
  if not (public.svc_huella_check('de670000-0000-4000-8000-000000000011', null, 'de670000-0000-4000-8000-0000000000b1', 'pdf', repeat('a', 64), null, null) ->> 'ok')::boolean then
    raise exception 'FALLO: el propio estudiante bloqueado'; end if;
  -- 5) otra asignatura: no se compara
  if not (public.svc_huella_check('de670000-0000-4000-8000-000000000013', null, 'de670000-0000-4000-8000-0000000000b3', 'pdf', repeat('a', 64), null, null) ->> 'ok')::boolean then
    raise exception 'FALLO: otra asignatura bloqueada'; end if;
  -- reintentos: una sola solicitud pendiente por archivo
  perform public.svc_huella_check('de670000-0000-4000-8000-000000000012', null, 'de670000-0000-4000-8000-0000000000b2', 'pdf', repeat('a', 64), null, null);
  if (select intentos from public.duplicate_requests where user_id = 'de670000-0000-4000-8000-000000000012' and sha256 = repeat('a', 64)) <> 2 then raise exception 'FALLO: solicitud duplicada'; end if;
end $$;
reset role;

-- 6) el profesor de la sección de B ve la coincidencia (con los dos nombres) y autoriza el PDF; el estudiante no puede
set local role authenticated;
select set_config('request.path', '/rpc/huellas_solicitudes', true);
select set_config('request.jwt.claims', '{"sub":"de670000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de670000-0000-4000-8000-000000000012', true);
do $$ begin
  begin perform public.huellas_solicitudes('de670000-0000-4000-8000-000000000032'); raise exception 'FALLO: el estudiante ve las coincidencias';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de670000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de670000-0000-4000-8000-000000000001', true);
do $$ declare l jsonb; v uuid; begin
  l := public.huellas_solicitudes('de670000-0000-4000-8000-000000000032');
  if jsonb_array_length(l) <> 3 then raise exception 'FALLO: solicitudes %', jsonb_array_length(l); end if;
  select (x ->> 'id')::uuid into v from jsonb_array_elements(l) x where (x ->> 'exacto')::boolean and x ->> 'kind' = 'pdf';
  if (select x ->> 'coincide_con' from jsonb_array_elements(l) x where (x ->> 'id')::uuid = v) <> 'Estudiante 11' then raise exception 'FALLO: con quién coincide'; end if;
  perform public.huella_decidir(v, true, 'Trabajo en grupo');
end $$;
reset role;
set local role service_role;
do $$ begin
  if not (public.svc_huella_check('de670000-0000-4000-8000-000000000012', null, 'de670000-0000-4000-8000-0000000000b2', 'pdf', repeat('a', 64), null, null) ->> 'autorizado')::boolean then
    raise exception 'FALLO: autorización no aplicada'; end if;
end $$;
reset role;

-- 7) si A borra su archivo, ya no bloquea a nadie
delete from public.upload_files where id = 'de670000-0000-4000-8000-0000000000f2';
set local role service_role;
do $$ begin
  if not (public.svc_huella_check('de670000-0000-4000-8000-000000000012', 'de670000-0000-4000-8000-000000000032', null, 'captura', repeat('3', 64), null, 'f0f0f0f0f0f0f0f0') ->> 'ok')::boolean then
    raise exception 'FALLO: un archivo borrado sigue bloqueando'; end if;
end $$;
reset role;

do $$ begin
  if has_function_privilege('authenticated', 'public.svc_huella_check(uuid, uuid, uuid, text, text, text, text)', 'execute') then raise exception 'FALLO: permisos'; end if;
  begin perform 1 from public.upload_fingerprints limit 0; exception when others then null; end;
end $$;

select 'huellas_archivos.sql: PRUEBAS PASARON' as resultado;
rollback;
