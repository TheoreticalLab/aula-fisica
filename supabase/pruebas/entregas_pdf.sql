-- Pruebas: entregas en PDF con autorización (migración 23). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d7000000-0000-4000-8000-000000000001', 'ea@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-entregas","aula_role":"teacher"}', '{}', now(), now()),
  ('d7000000-0000-4000-8000-000000000002', 'eb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ajeno-ent","aula_role":"teacher"}', '{}', now(), now()),
  ('d7000000-0000-4000-8000-000000000011', 'e1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ent-1"}', '{}', now(), now()),
  ('d7000000-0000-4000-8000-000000000012', 'e2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ent-2"}', '{}', now(), now()),
  ('d7000000-0000-4000-8000-000000000013', 'e3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-ent-3"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'd7000000-%';
update public.profiles set role = 'teacher' where id in ('d7000000-0000-4000-8000-000000000001', 'd7000000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('d7000000-0000-4000-8000-000000000021', 'Curso entregas');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d7000000-0000-4000-8000-000000000031', 'd7000000-0000-4000-8000-000000000021', 'Sección entregas', 'ENTREGA1', 'd7000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('d7000000-0000-4000-8000-000000000031', 'd7000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('d7000000-0000-4000-8000-000000000031', 'd7000000-0000-4000-8000-000000000011'),
  ('d7000000-0000-4000-8000-000000000031', 'd7000000-0000-4000-8000-000000000012');
-- el estudiante 3 NO está inscrito

set local role authenticated;

-- 1) el profesor crea un buzón (exige autorización, 1 archivo, 5 MB)
select set_config('request.jwt.claims', '{"sub":"d7000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd7000000-0000-4000-8000-000000000001', true);
select set_config('prueba.box', public.upload_box_save(null, 'd7000000-0000-4000-8000-000000000031', 'Práctica 3 escrita', 'Escanee las 4 páginas', 'practica',
  null, now() + interval '7 days', true, 1, 5)::text, true);

-- 2) un profesor ajeno no ve ni administra el buzón
select set_config('request.jwt.claims', '{"sub":"d7000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd7000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform * from public.upload_box_students(current_setting('prueba.box')::uuid); raise exception 'FALLO: un profesor ajeno vio el buzón';
  exception when insufficient_privilege then null; end;
  begin perform public.upload_permission_approve_all(current_setting('prueba.box')::uuid); raise exception 'FALLO: un profesor ajeno autorizó';
  exception when insufficient_privilege then null; end;
end $$;

-- 3) estudiante 1: ve el buzón, NO puede subir sin autorización, la solicita; no puede autorizarse ni leer tablas
select set_config('request.jwt.claims', '{"sub":"d7000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd7000000-0000-4000-8000-000000000011', true);
do $$
declare r record;
begin
  select * into r from public.my_upload_boxes();
  if r.title <> 'Práctica 3 escrita' or r.puede_subir or r.motivo <> 'Necesita la autorización del profesor' then raise exception 'FALLO: estado inicial (%)', r.motivo; end if;
  if public.upload_permission_request(current_setting('prueba.box')::uuid, 'Profesor, ya la tengo escaneada') <> 'solicitado' then raise exception 'FALLO: solicitud'; end if;
  begin perform public.upload_permission_decide(current_setting('prueba.box')::uuid, 'd7000000-0000-4000-8000-000000000011', 'aprobado', null);
    raise exception 'FALLO: el estudiante se autorizó a sí mismo';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.upload_permissions; raise exception 'FALLO: leyó la tabla de permisos'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.upload_files; raise exception 'FALLO: leyó la tabla de archivos'; exception when insufficient_privilege then null; end;
  -- tampoco puede usar las funciones del servidor
  begin perform public.svc_upload_check('d7000000-0000-4000-8000-000000000011', current_setting('prueba.box')::uuid, 1000);
    raise exception 'FALLO: un estudiante llamó a svc_upload_check';
  exception when insufficient_privilege then null; end;
end $$;

-- 4) estudiante no inscrito: no ve el buzón ni puede solicitar
select set_config('request.jwt.claims', '{"sub":"d7000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd7000000-0000-4000-8000-000000000013', true);
do $$ begin
  if exists (select 1 from public.my_upload_boxes()) then raise exception 'FALLO: un no inscrito ve el buzón'; end if;
  begin perform public.upload_permission_request(current_setting('prueba.box')::uuid, null); raise exception 'FALLO: un no inscrito solicitó';
  exception when insufficient_privilege then null; end;
end $$;

-- 5) el profesor ve la solicitud y la aprueba
select set_config('request.jwt.claims', '{"sub":"d7000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd7000000-0000-4000-8000-000000000001', true);
do $$
declare r record;
begin
  select * into r from public.upload_box_students(current_setting('prueba.box')::uuid) limit 1;
  if r.permiso <> 'solicitado' or r.request_note <> 'Profesor, ya la tengo escaneada' then raise exception 'FALLO: el profesor no ve la solicitud primero'; end if;
  if (select solicitudes_pendientes from public.upload_boxes_for_class('d7000000-0000-4000-8000-000000000031')) <> 1 then raise exception 'FALLO: contador de solicitudes'; end if;
  perform public.upload_permission_decide(current_setting('prueba.box')::uuid, 'd7000000-0000-4000-8000-000000000011', 'aprobado', 'Adelante');
end $$;

reset role;
-- 6) el servidor (Edge Function, service_role): sube para el estudiante 1; el 2 sin autorización no puede
do $$
declare v_box uuid := current_setting('prueba.box')::uuid;
begin
  perform public.svc_upload_check('d7000000-0000-4000-8000-000000000011', v_box, 400000);
  begin perform public.svc_upload_check('d7000000-0000-4000-8000-000000000011', v_box, 6 * 1048576); raise exception 'FALLO: aceptó un archivo de 6 MB en un buzón de 5';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_upload_check('d7000000-0000-4000-8000-000000000012', v_box, 1000); raise exception 'FALLO: subió sin autorización';
  exception when insufficient_privilege then null; end;
  -- la ruta debe ser la del propio estudiante
  begin perform public.svc_upload_record('d7000000-0000-4000-8000-000000000011', v_box, 'd7000000-0000-4000-8000-0000000000f1',
      v_box || '/d7000000-0000-4000-8000-000000000012/d7000000-0000-4000-8000-0000000000f1.pdf', 'p.pdf', 1000, repeat('a', 64));
    raise exception 'FALLO: aceptó una ruta ajena';
  exception when invalid_parameter_value then null; end;
  perform public.svc_upload_record('d7000000-0000-4000-8000-000000000011', v_box, 'd7000000-0000-4000-8000-0000000000f1',
    v_box || '/d7000000-0000-4000-8000-000000000011/d7000000-0000-4000-8000-0000000000f1.pdf', 'Práctica 3.pdf', 400000, repeat('a', 64));
  -- máximo de 1 archivo: el segundo no
  begin perform public.svc_upload_check('d7000000-0000-4000-8000-000000000011', v_box, 1000); raise exception 'FALLO: superó el máximo de archivos';
  exception when insufficient_privilege then null; end;
  -- descarga: el autor y el profesor sí; otro estudiante y un profesor ajeno no
  perform public.svc_upload_file_path('d7000000-0000-4000-8000-000000000011', 'd7000000-0000-4000-8000-0000000000f1');
  perform public.svc_upload_file_path('d7000000-0000-4000-8000-000000000001', 'd7000000-0000-4000-8000-0000000000f1');
  begin perform public.svc_upload_file_path('d7000000-0000-4000-8000-000000000012', 'd7000000-0000-4000-8000-0000000000f1'); raise exception 'FALLO: otro estudiante descargó';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_upload_file_path('d7000000-0000-4000-8000-000000000002', 'd7000000-0000-4000-8000-0000000000f1'); raise exception 'FALLO: un profesor ajeno descargó';
  exception when insufficient_privilege then null; end;
end $$;

-- 7) el profesor rechaza el archivo con nota: el estudiante puede volver a subir; «autorizar a todos» autoriza al 2
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d7000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd7000000-0000-4000-8000-000000000001', true);
do $$ begin
  perform public.upload_file_review('d7000000-0000-4000-8000-0000000000f1', 'rechazado', 'Falta la página 3');
  if public.upload_permission_approve_all(current_setting('prueba.box')::uuid) <> 1 then raise exception 'FALLO: autorizar a todos'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"d7000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd7000000-0000-4000-8000-000000000011', true);
do $$
declare r record;
begin
  select * into r from public.my_upload_boxes();
  if not r.puede_subir or r.archivos -> 0 ->> 'estado' <> 'rechazado' or r.archivos -> 0 ->> 'nota' <> 'Falta la página 3' then
    raise exception 'FALLO: tras el rechazo (puede %, %)', r.puede_subir, r.archivos;
  end if;
end $$;
reset role;
do $$ begin
  perform public.svc_upload_check('d7000000-0000-4000-8000-000000000012', current_setting('prueba.box')::uuid, 1000);
  -- cerrado el plazo, nadie sube
  update public.upload_boxes set closes_at = now() - interval '1 minute', opens_at = null where id = current_setting('prueba.box')::uuid;
  begin perform public.svc_upload_check('d7000000-0000-4000-8000-000000000012', current_setting('prueba.box')::uuid, 1000); raise exception 'FALLO: subió fuera de plazo';
  exception when insufficient_privilege then null; end;
end $$;
select 'PRUEBAS DE ENTREGAS EN PDF PASARON' as resultado;
rollback;
