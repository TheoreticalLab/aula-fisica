-- Pruebas: asignatura de laboratorio con controles fotográficos (migración 84). Datos sintéticos; se deshace al final.
-- T = profesor de la sección L · T2 = profesor ajeno · E1, E2 = estudiantes de L · E3 = no inscrito · F = estudiante de un curso normal
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('e8400000-0000-4000-8000-000000000001', 'lab01@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-lab","aula_role":"teacher"}', '{}', now(), now()),
  ('e8400000-0000-4000-8000-000000000002', 'lab02@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-lab-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('e8400000-0000-4000-8000-000000000011', 'lab11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lab-1"}', '{}', now(), now()),
  ('e8400000-0000-4000-8000-000000000012', 'lab12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lab-2"}', '{}', now(), now()),
  ('e8400000-0000-4000-8000-000000000013', 'lab13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lab-3"}', '{}', now(), now()),
  ('e8400000-0000-4000-8000-000000000014', 'lab14@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lab-4"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'e8400000-%';
update public.profiles set role = 'teacher' where id in ('e8400000-0000-4000-8000-000000000001', 'e8400000-0000-4000-8000-000000000002');
update public.profiles set full_name = 'Ana Lab', student_code = '100100' where id = 'e8400000-0000-4000-8000-000000000011';
update public.profiles set full_name = 'Beto Lab', student_code = '100200' where id = 'e8400000-0000-4000-8000-000000000012';

create function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p::text, true);
$$;
grant execute on function pg_temp.como(uuid) to authenticated;

-- 0) la asignatura existe (migración), sin capítulos ni lecciones; una sección suya recibe sus 8 controles al crearse
do $$
declare v_course uuid; n integer;
begin
  select id into v_course from public.courses where code = 'LAB-FIS-BASICA' and laboratorio_controles = 8;
  if v_course is null then raise exception 'FALLO: no existe la asignatura Laboratorio de Física Básica'; end if;
  if exists (select 1 from public.units u where u.course_id = v_course) then raise exception 'FALLO: la asignatura trae capítulos'; end if;
  insert into public.classes (id, course_id, name, join_code, created_by) values
    ('e8400000-0000-4000-8000-000000000031', v_course, 'Laboratorio L-01', 'LABCTRL1', 'e8400000-0000-4000-8000-000000000001');
  select count(*) into n from public.upload_boxes where class_id = 'e8400000-0000-4000-8000-000000000031' and control_number is not null;
  if n <> 8 then raise exception 'FALLO: la sección tiene % controles (esperados 8)', n; end if;
  if exists (select 1 from public.upload_boxes where class_id = 'e8400000-0000-4000-8000-000000000031'
             and control_number is not null and (max_files <> 1 or requires_approval or opens_at is not null or closes_at is not null)) then
    raise exception 'FALLO: controles mal configurados (1 imagen, sin autorización, sin fechas por defecto)';
  end if;
  -- idempotente: asegurar de nuevo no duplica
  if public.lab_asegurar_controles('e8400000-0000-4000-8000-000000000031') <> 0 then raise exception 'FALLO: duplicó controles'; end if;
end $$;
-- curso convencional: ninguna caja de control
insert into public.courses (id, title) values ('e8400000-0000-4000-8000-000000000022', 'Curso normal lab-prueba');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('e8400000-0000-4000-8000-000000000032', 'e8400000-0000-4000-8000-000000000022', 'Sección normal', 'LABNORM1', 'e8400000-0000-4000-8000-000000000001');
do $$ begin
  if exists (select 1 from public.upload_boxes where class_id = 'e8400000-0000-4000-8000-000000000032') then
    raise exception 'FALLO (10): un curso normal recibió controles';
  end if;
end $$;
insert into public.enrollments (class_id, user_id) values
  ('e8400000-0000-4000-8000-000000000031', 'e8400000-0000-4000-8000-000000000011'),
  ('e8400000-0000-4000-8000-000000000031', 'e8400000-0000-4000-8000-000000000012'),
  ('e8400000-0000-4000-8000-000000000032', 'e8400000-0000-4000-8000-000000000014');
-- un buzón PDF normal en la sección de laboratorio sigue funcionando aparte
insert into public.upload_boxes (id, class_id, title, kind, requires_approval, max_files, max_mb) values
  ('e8400000-0000-4000-8000-000000000041', 'e8400000-0000-4000-8000-000000000031', 'Informe escrito', 'practica', false, 1, 5);

create temp table t (k text primary key, v text);
grant all on t to authenticated;
insert into t select 'c' || control_number, id::text from public.upload_boxes
  where class_id = 'e8400000-0000-4000-8000-000000000031' and control_number is not null;
insert into t select 'curso', id::text from public.courses where code = 'LAB-FIS-BASICA';

-- 1) estudiante 1: ve sus 8 controles pendientes y con permiso de subir; no ve los controles entre los PDF
set local role authenticated;
select pg_temp.como('e8400000-0000-4000-8000-000000000011');
do $$
declare j jsonb; s jsonb;
begin
  j := public.lab_mis_controles((select v::uuid from t where k = 'curso'));
  if (j->>'controles')::int <> 8 or jsonb_array_length(j->'secciones') <> 1 then raise exception 'FALLO: estructura %', j; end if;
  s := j->'secciones'->0;
  if jsonb_array_length(s->'controles') <> 8 then raise exception 'FALLO: no son 8 controles'; end if;
  if exists (select 1 from jsonb_array_elements(s->'controles') c where c->>'estado' <> 'pendiente' or not (c->>'puede_subir')::boolean) then
    raise exception 'FALLO: estado inicial';
  end if;
  if exists (select 1 from public.my_upload_boxes() b where b.title like 'Control %') then raise exception 'FALLO: los controles salen entre los PDF'; end if;
  if not exists (select 1 from public.my_upload_boxes() b where b.title = 'Informe escrito') then raise exception 'FALLO: el buzón PDF desapareció'; end if;
  -- no llega a las funciones del servidor ni a las tablas
  begin perform public.svc_lab_control_record('e8400000-0000-4000-8000-000000000011', (select v::uuid from t where k = 'c1'), gen_random_uuid(), 'x', 1, repeat('a', 64), 'image/jpeg', 1, 1);
    raise exception 'FALLO: un estudiante registró una imagen directamente';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.upload_box_extensions; raise exception 'FALLO: leyó fechas individuales'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.upload_file_revisiones; raise exception 'FALLO: leyó revisiones'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.upload_files; raise exception 'FALLO: leyó archivos'; exception when insufficient_privilege then null; end;
end $$;

-- 2) el servidor (Edge Function) sube la imagen del Control 1 del estudiante 1 (prueba 1) y no admite una segunda (prueba 2)
reset role;
do $$
declare v_box uuid := (select v::uuid from t where k = 'c1'); r jsonb;
  u1 uuid := 'e8400000-0000-4000-8000-000000000011'; f1 uuid := 'e8400000-0000-4000-8000-0000000000a1';
begin
  -- la vía PDF no acepta buzones de control
  begin perform public.svc_upload_record(u1, v_box, f1, v_box || '/' || u1 || '/' || f1 || '.pdf', 'c.pdf', 1000, repeat('a', 64));
    raise exception 'FALLO: aceptó un PDF en un control';
  exception when invalid_parameter_value then null; end;
  -- ni formatos ajenos, ni rutas ajenas, ni tamaños fuera de límite, ni un buzón PDF como control
  begin perform public.svc_lab_control_record(u1, v_box, f1, v_box || '/' || u1 || '/' || f1 || '.gif', 1000, repeat('a', 64), 'image/gif', 10, 10);
    raise exception 'FALLO: aceptó GIF';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_lab_control_record(u1, v_box, f1, v_box || '/e8400000-0000-4000-8000-000000000012/' || f1 || '.jpg', 1000, repeat('a', 64), 'image/jpeg', 10, 10);
    raise exception 'FALLO: aceptó una ruta ajena';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_lab_control_record(u1, v_box, f1, v_box || '/' || u1 || '/' || f1 || '.jpg', 6 * 1048576, repeat('a', 64), 'image/jpeg', 10, 10);
    raise exception 'FALLO: aceptó 6 MB';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_lab_control_record(u1, 'e8400000-0000-4000-8000-000000000041', f1, 'x', 1000, repeat('a', 64), 'image/jpeg', 10, 10);
    raise exception 'FALLO: un buzón PDF pasó como control';
  exception when invalid_parameter_value then null; end;
  -- un no inscrito no sube
  begin perform public.svc_lab_control_record('e8400000-0000-4000-8000-000000000013', v_box, f1,
      v_box || '/e8400000-0000-4000-8000-000000000013/' || f1 || '.jpg', 1000, repeat('a', 64), 'image/jpeg', 10, 10);
    raise exception 'FALLO: subió un no inscrito';
  exception when insufficient_privilege then null; end;
  r := public.svc_lab_control_record(u1, v_box, f1, v_box || '/' || u1 || '/' || f1 || '.jpg', 400000, repeat('b', 64), 'image/jpeg', 1600, 1200);
  if r->>'estado' <> 'recibido' or r->>'subido' is null then raise exception 'FALLO: registro %', r; end if;
  if (select mime || ancho || 'x' || alto from public.upload_files where id = f1) <> 'image/jpeg1600x1200' then raise exception 'FALLO: metadatos'; end if;
  -- segunda imagen del mismo control: rechazada (prueba 2)
  begin perform public.svc_lab_control_record(u1, v_box, 'e8400000-0000-4000-8000-0000000000a2',
      v_box || '/' || u1 || '/e8400000-0000-4000-8000-0000000000a2.webp', 1000, repeat('c', 64), 'image/webp', 10, 10);
    raise exception 'FALLO: aceptó dos imágenes en el mismo control';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_upload_check(u1, v_box, 1000); raise exception 'FALLO: la comprobación previa no lo impidió';
  exception when insufficient_privilege then null; end;
  -- el Control 2 sigue libre (prueba 7: independencia)
  perform public.svc_lab_control_record(u1, (select v::uuid from t where k = 'c2'), 'e8400000-0000-4000-8000-0000000000b1',
    (select v from t where k = 'c2') || '/' || u1 || '/e8400000-0000-4000-8000-0000000000b1.png', 2000, repeat('d', 64), 'image/png', 800, 600);
  -- la entrega del Control 1 queda más antigua (en la transacción de prueba now() no avanza)
  update public.upload_files set uploaded_at = now() - interval '2 hours' where id = f1;
end $$;

-- 3) estudiante 1 ve su entrega (prueba 3) y los demás controles intactos (prueba 7); su archivo es descargable por él
set local role authenticated;
select pg_temp.como('e8400000-0000-4000-8000-000000000011');
do $$
declare s jsonb;
begin
  s := public.lab_mis_controles((select v::uuid from t where k = 'curso'))->'secciones'->0->'controles';
  if s->0->>'estado' <> 'entregado' or (s->0->>'puede_subir')::boolean or s->0->>'motivo' not like 'Ya entregó este control%' then raise exception 'FALLO: control 1 %', s->0; end if;
  if jsonb_array_length(s->0->'historial') <> 1 or s->0->'historial'->0->>'mime' <> 'image/jpeg' or s->0->'historial'->0->>'subido' is null then raise exception 'FALLO: historial'; end if;
  if s->1->>'estado' <> 'entregado' then raise exception 'FALLO: control 2'; end if;
  if exists (select 1 from jsonb_array_elements(s) c where (c->>'numero')::int > 2 and c->>'estado' <> 'pendiente') then raise exception 'FALLO: los controles no son independientes'; end if;
end $$;
reset role;
do $$ begin
  if public.svc_upload_file_path('e8400000-0000-4000-8000-000000000011', 'e8400000-0000-4000-8000-0000000000a1') not like '%.jpg' then raise exception 'FALLO: ruta del autor'; end if;
  -- prueba 4: otro estudiante y un profesor ajeno no obtienen la imagen
  begin perform public.svc_upload_file_path('e8400000-0000-4000-8000-000000000012', 'e8400000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: otro estudiante vio la imagen';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_upload_file_path('e8400000-0000-4000-8000-000000000002', 'e8400000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: un profesor ajeno vio la imagen';
  exception when insufficient_privilege then null; end;
  if public.svc_upload_file_path('e8400000-0000-4000-8000-000000000001', 'e8400000-0000-4000-8000-0000000000a1') is null then raise exception 'FALLO: el profesor no ve la imagen'; end if;
end $$;

-- 4) estudiante 2: no ve las entregas de otro ni cambia estados ni fechas (prueba 4)
set local role authenticated;
select pg_temp.como('e8400000-0000-4000-8000-000000000012');
do $$
declare s jsonb;
begin
  s := public.lab_mis_controles((select v::uuid from t where k = 'curso'))->'secciones'->0->'controles';
  if exists (select 1 from jsonb_array_elements(s) c where c->>'estado' <> 'pendiente' or jsonb_array_length(c->'historial') > 0) then raise exception 'FALLO: E2 ve entregas ajenas'; end if;
  begin perform public.lab_controles_estudiante('e8400000-0000-4000-8000-000000000031', 'e8400000-0000-4000-8000-000000000011'); raise exception 'FALLO: E2 abrió el detalle de E1';
  exception when insufficient_privilege then null; end;
  begin perform public.lab_controles_seccion('e8400000-0000-4000-8000-000000000031'); raise exception 'FALLO: E2 abrió el panel';
  exception when insufficient_privilege then null; end;
  begin perform public.lab_control_revisar('e8400000-0000-4000-8000-0000000000a1', 'aprobado', null); raise exception 'FALLO: E2 aprobó';
  exception when insufficient_privilege then null; end;
  begin perform public.lab_controles_fechas('e8400000-0000-4000-8000-000000000031', 1, 'e8400000-0000-4000-8000-000000000012', null, now() + interval '9 days');
    raise exception 'FALLO: E2 cambió fechas';
  exception when insufficient_privilege then null; end;
  begin perform public.upload_file_review('e8400000-0000-4000-8000-0000000000a1', 'aceptado', null); raise exception 'FALLO: E2 usó la revisión PDF';
  exception when insufficient_privilege then null; end;
end $$;
-- el propio E1 tampoco se aprueba
select pg_temp.como('e8400000-0000-4000-8000-000000000011');
do $$ begin
  begin perform public.lab_control_revisar('e8400000-0000-4000-8000-0000000000a1', 'aprobado', null); raise exception 'FALLO: E1 se aprobó';
  exception when insufficient_privilege then null; end;
end $$;
-- un no inscrito no ve secciones; un estudiante de un curso normal no tiene controles
select pg_temp.como('e8400000-0000-4000-8000-000000000013');
do $$ begin
  if jsonb_array_length(public.lab_mis_controles((select v::uuid from t where k = 'curso'))->'secciones') <> 0 then raise exception 'FALLO: un no inscrito ve controles'; end if;
end $$;
select pg_temp.como('e8400000-0000-4000-8000-000000000014');
do $$ begin
  begin perform public.lab_mis_controles('e8400000-0000-4000-8000-000000000022'); raise exception 'FALLO: un curso normal tiene controles';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
-- profesor ajeno: sin acceso
select pg_temp.como('e8400000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.lab_controles_seccion('e8400000-0000-4000-8000-000000000031'); raise exception 'FALLO: profesor ajeno abrió el panel';
  exception when insufficient_privilege then null; end;
end $$;

-- 5) profesor: tabla, detalle, «requiere corrección», sustitución sin perder la evidencia, aprobación (prueba 5)
select pg_temp.como('e8400000-0000-4000-8000-000000000001');
do $$
declare j jsonb; e jsonb;
begin
  j := public.lab_controles_seccion('e8400000-0000-4000-8000-000000000031');
  if jsonb_array_length(j->'cajas') <> 8 or jsonb_array_length(j->'estudiantes') <> 2 then raise exception 'FALLO: panel %', j; end if;
  select x into e from jsonb_array_elements(j->'estudiantes') x where x->>'matricula' = '100100';
  if (e->>'entregados')::int <> 2 or (e->>'aprobados')::int <> 0 or (e->>'sin_revisar')::int <> 2 or e->'estados'->>0 <> 'entregado' or e->'estados'->>2 <> 'pendiente' then
    raise exception 'FALLO: fila de E1 %', e;
  end if;
  e := public.lab_controles_estudiante('e8400000-0000-4000-8000-000000000031', 'e8400000-0000-4000-8000-000000000011');
  if jsonb_array_length(e->'controles') <> 8 or e->'estudiante'->>'nombre' <> 'Ana Lab' then raise exception 'FALLO: detalle'; end if;
  if public.lab_control_revisar('e8400000-0000-4000-8000-0000000000a1', 'requiere_correccion', 'La foto está borrosa')->>'estado' <> 'requiere_correccion' then
    raise exception 'FALLO: requiere corrección';
  end if;
  begin perform public.lab_control_revisar('e8400000-0000-4000-8000-0000000000a1', 'perdido', null); raise exception 'FALLO: estado inventado';
  exception when invalid_parameter_value then null; end;
  -- el Control 2 se aprueba de forma independiente
  begin perform public.lab_control_revisar('e8400000-0000-4000-8000-0000000000b1', 'aprobado', null);
  exception when others then raise exception 'FALLO: no pudo aprobar el control 2: %', sqlerrm; end;
  -- configuración de los controles protegida frente a las herramientas de buzones PDF
  begin perform public.upload_box_save((select v::uuid from t where k = 'c1'), null, 'Control 1', '', 'otro', null, null, false, 3, 5);
    raise exception 'FALLO: cambió el máximo de imágenes de un control';
  exception when insufficient_privilege then null; end;
  begin perform public.upload_box_archive((select v::uuid from t where k = 'c1'), true); raise exception 'FALLO: archivó un control';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.upload_boxes_for_class('e8400000-0000-4000-8000-000000000031') b where b.title like 'Control %') then
    raise exception 'FALLO: los controles salen en el panel de entregas PDF';
  end if;
end $$;

-- E1 ve «requiere corrección» con la nota y vuelve a subir; el servidor la registra; la anterior se conserva
select pg_temp.como('e8400000-0000-4000-8000-000000000011');
do $$
declare c jsonb;
begin
  c := public.lab_mis_controles((select v::uuid from t where k = 'curso'))->'secciones'->0->'controles'->0;
  if c->>'estado' <> 'requiere_correccion' or not (c->>'puede_subir')::boolean or c->'historial'->0->>'nota' <> 'La foto está borrosa' then raise exception 'FALLO: E1 no ve la corrección %', c; end if;
end $$;
reset role;
select public.svc_lab_control_record('e8400000-0000-4000-8000-000000000011', (select v::uuid from t where k = 'c1'), 'e8400000-0000-4000-8000-0000000000a3',
  (select v from t where k = 'c1') || '/e8400000-0000-4000-8000-000000000011/e8400000-0000-4000-8000-0000000000a3.webp', 300000, repeat('e', 64), 'image/webp', 1200, 1600);
do $$ begin
  if (select count(*) from public.upload_files where box_id = (select v::uuid from t where k = 'c1') and user_id = 'e8400000-0000-4000-8000-000000000011') <> 2 then
    raise exception 'FALLO: la sustitución borró la evidencia anterior';
  end if;
  if (select count(*) from public.upload_file_revisiones where file_id = 'e8400000-0000-4000-8000-0000000000a1') <> 1 then raise exception 'FALLO: revisión sin registrar'; end if;
  if (select revisado_por from public.upload_file_revisiones where file_id = 'e8400000-0000-4000-8000-0000000000a1') <> 'e8400000-0000-4000-8000-000000000001' then
    raise exception 'FALLO: revisión sin autor';
  end if;
end $$;
set local role authenticated;
select pg_temp.como('e8400000-0000-4000-8000-000000000001');
do $$
declare e jsonb;
begin
  -- la entrega anterior ya no es la vigente: no se re-revisa
  begin perform public.lab_control_revisar('e8400000-0000-4000-8000-0000000000a1', 'aprobado', null); raise exception 'FALLO: aprobó una entrega sustituida';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.lab_control_revisar('e8400000-0000-4000-8000-0000000000a3', 'aprobado', 'Bien');
  select x into e from jsonb_array_elements(public.lab_controles_seccion('e8400000-0000-4000-8000-000000000031')->'estudiantes') x where x->>'matricula' = '100100';
  if (e->>'entregados')::int <> 2 or (e->>'aprobados')::int <> 2 or (e->>'por_corregir')::int <> 0 then raise exception 'FALLO: totales tras aprobar %', e; end if;
end $$;
select pg_temp.como('e8400000-0000-4000-8000-000000000011');
do $$
declare c jsonb;
begin
  c := public.lab_mis_controles((select v::uuid from t where k = 'curso'))->'secciones'->0->'controles'->0;
  if c->>'estado' <> 'aprobado' or (c->>'puede_subir')::boolean or c->>'motivo' <> 'Este control ya está aprobado' then raise exception 'FALLO: aprobado %', c; end if;
  if jsonb_array_length(c->'historial') <> 2 or c->'historial'->0->>'mime' <> 'image/webp' or c->'historial'->1->>'estado' <> 'rechazado' then raise exception 'FALLO: historial tras sustituir'; end if;
end $$;

-- 6) fechas: generales e individuales; registro de fechas y estados (prueba 6)
select pg_temp.como('e8400000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.lab_controles_fechas('e8400000-0000-4000-8000-000000000031', 3, null, now(), now() - interval '1 day'); raise exception 'FALLO: aceptó cierre antes de apertura';
  exception when invalid_parameter_value then null; end;
  begin perform public.lab_controles_fechas('e8400000-0000-4000-8000-000000000031', 9, null, null, null); raise exception 'FALLO: control 9';
  exception when invalid_parameter_value then null; end;
  if public.lab_controles_fechas('e8400000-0000-4000-8000-000000000031', 3, null, null, now() - interval '1 hour') <> 1 then raise exception 'FALLO: fecha general'; end if;
  if public.lab_controles_fechas('e8400000-0000-4000-8000-000000000031', 4, null, now() + interval '1 day', null) <> 1 then raise exception 'FALLO: apertura'; end if;
  if public.lab_controles_fechas('e8400000-0000-4000-8000-000000000031', 3, 'e8400000-0000-4000-8000-000000000011', null, now() + interval '3 days') <> 1 then
    raise exception 'FALLO: fecha individual';
  end if;
  begin perform public.lab_controles_fechas('e8400000-0000-4000-8000-000000000031', 3, 'e8400000-0000-4000-8000-000000000013', null, now() + interval '3 days');
    raise exception 'FALLO: fecha a un no inscrito';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('e8400000-0000-4000-8000-000000000011');
do $$
declare s jsonb;
begin
  s := public.lab_mis_controles((select v::uuid from t where k = 'curso'))->'secciones'->0->'controles';
  if not (s->2->>'puede_subir')::boolean or not (s->2->>'fecha_individual')::boolean then raise exception 'FALLO: E1 no tiene su prórroga %', s->2; end if;
  if (s->3->>'puede_subir')::boolean or s->3->>'motivo' <> 'El buzón aún no abre' then raise exception 'FALLO: control 4 abrió antes'; end if;
end $$;
select pg_temp.como('e8400000-0000-4000-8000-000000000012');
do $$
declare s jsonb;
begin
  s := public.lab_mis_controles((select v::uuid from t where k = 'curso'))->'secciones'->0->'controles';
  if (s->2->>'puede_subir')::boolean or s->2->>'motivo' <> 'El plazo de entrega terminó' then raise exception 'FALLO: E2 no ve el cierre general'; end if;
  if not (s->4->>'puede_subir')::boolean then raise exception 'FALLO: el control 5 debía seguir abierto'; end if;
end $$;
-- quitar la fecha individual devuelve la general
select pg_temp.como('e8400000-0000-4000-8000-000000000001');
select public.lab_controles_fechas('e8400000-0000-4000-8000-000000000031', 3, 'e8400000-0000-4000-8000-000000000011', null, null);
select pg_temp.como('e8400000-0000-4000-8000-000000000011');
do $$ begin
  if (public.lab_mis_controles((select v::uuid from t where k = 'curso'))->'secciones'->0->'controles'->2->>'puede_subir')::boolean then
    raise exception 'FALLO: la prórroga quitada sigue vigente';
  end if;
end $$;

-- 7) anónimo: nada
reset role;
set local role anon;
do $$ begin
  begin perform public.lab_mis_controles('e8400000-0000-4000-8000-000000000022'); raise exception 'FALLO: anon';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'laboratorio_controles.sql: PRUEBAS PASARON' as resultado;
rollback;
