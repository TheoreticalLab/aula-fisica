-- Pruebas NEGATIVAS y casos límite de la migración 88 (RLS de courses/units/lessons/concepts con los permisos
-- calculados una vez). Auditoría independiente. Transacción que se deshace al final.
--
-- Método: para cada usuario de prueba (22, incluidos anon y un sub sin perfil), cada ruta de petición
-- ('/rest/v1/x', '' = script, '/rest/v1/rpc/hist_guardar' = exenta de la regularización) y cada operación
-- (lecturas y ~60 escrituras, cada una sin y con RETURNING, ejecutada como rol authenticated/anon en una
-- subtransacción que se deshace), se mide el resultado con:
--   1) las políticas NUEVAS (las que dejó la migración 88);
--   2) las ANTIGUAS (SQL literal de supabase/reversion/20261106000088_rls_permisos_una_vez_revertir.sql);
--   3) otra vez las NUEVAS (SQL literal de la migración 88; se comprueba que pg_policies queda idéntico).
-- Cualquier diferencia entre 1 y 2 (o 1 y 3) es un FALLO. Después, aserciones absolutas (negativas y algunas
-- positivas para que la prueba no sea vacía) y la comprobación de lo que revelan por RPC las tres funciones nuevas.
begin;

-- ---------------------------------------------------------------------------------------------------------------
-- Preparación (como superusuario)
-- ---------------------------------------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('a8800000-0000-4000-8000-0000000001' || n)::uuid, 'a88-' || n || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
       json_build_object('login_id', 'a88-' || n)::jsonb, '{}'::jsonb, now(), now()
from unnest(array['01','02','03','04','05','06','07','08','11','12','13','14','15','16','17','18','19','20']) n;
update public.profiles set must_change_password = false, active = true where id::text like 'a8800000-%';
update public.profiles set role = 'admin'   where id::text in ('a8800000-0000-4000-8000-000000000101', 'a8800000-0000-4000-8000-000000000102');
update public.profiles set role = 'teacher' where id::text in ('a8800000-0000-4000-8000-000000000103', 'a8800000-0000-4000-8000-000000000104',
  'a8800000-0000-4000-8000-000000000105', 'a8800000-0000-4000-8000-000000000106', 'a8800000-0000-4000-8000-000000000107',
  'a8800000-0000-4000-8000-000000000108');
update public.profiles set active = false where id::text in ('a8800000-0000-4000-8000-000000000102', 'a8800000-0000-4000-8000-000000000104',
  'a8800000-0000-4000-8000-000000000112');
update public.profiles set must_change_password = true where id::text in ('a8800000-0000-4000-8000-000000000107', 'a8800000-0000-4000-8000-000000000113');

create temp table aud_usuarios (etiqueta text primary key, id uuid, rol_db text not null, descripcion text not null);
insert into aud_usuarios values
  ('u01', 'a8800000-0000-4000-8000-000000000101', 'authenticated', 'administrador activo'),
  ('u02', 'a8800000-0000-4000-8000-000000000102', 'authenticated', 'administrador deshabilitado'),
  ('u03', 'a8800000-0000-4000-8000-000000000103', 'authenticated', 'profesor activo, personal de A'),
  ('u04', 'a8800000-0000-4000-8000-000000000104', 'authenticated', 'profesor deshabilitado, personal de A'),
  ('u05', 'a8800000-0000-4000-8000-000000000105', 'authenticated', 'profesor activo, NO personal de A (profesor de la sección d001 de A)'),
  ('u06', 'a8800000-0000-4000-8000-000000000106', 'authenticated', 'profesor activo, personal de B'),
  ('u07', 'a8800000-0000-4000-8000-000000000107', 'authenticated', 'profesor personal de A con contraseña provisional'),
  ('u08', 'a8800000-0000-4000-8000-000000000108', 'authenticated', 'profesor activo sin relación con ninguna asignatura'),
  ('u11', 'a8800000-0000-4000-8000-000000000111', 'authenticated', 'estudiante activo matriculado en A'),
  ('u12', 'a8800000-0000-4000-8000-000000000112', 'authenticated', 'estudiante deshabilitado matriculado en A'),
  ('u13', 'a8800000-0000-4000-8000-000000000113', 'authenticated', 'estudiante de A con contraseña provisional'),
  ('u14', 'a8800000-0000-4000-8000-000000000114', 'authenticated', 'estudiante sin matrícula'),
  ('u15', 'a8800000-0000-4000-8000-000000000115', 'authenticated', 'estudiante matriculado solo en B'),
  ('u16', 'a8800000-0000-4000-8000-000000000116', 'authenticated', 'estudiante de A bloqueado por la regularización'),
  ('u17', 'a8800000-0000-4000-8000-000000000117', 'authenticated', 'estudiante de A con el plazo de inactividad vencido'),
  ('u18', 'a8800000-0000-4000-8000-000000000118', 'authenticated', 'monitor de la sección d001 (estudiante de A)'),
  ('u19', 'a8800000-0000-4000-8000-000000000119', 'authenticated', 'rol estudiante con fila en course_staff de A (profesor degradado)'),
  ('u20', 'a8800000-0000-4000-8000-000000000120', 'authenticated', 'estudiante matriculado solo en una sección ARCHIVADA de A'),
  ('u21', 'a8800000-0000-4000-8000-000000000121', 'authenticated', 'sub sin perfil (no existe en profiles)'),
  ('anon', null, 'anon', 'anónimo');

-- asignaturas: A (c001), B (c002), C (c003, sin secciones ni personal)
insert into public.courses (id, title) values
  ('a8800000-0000-4000-8000-00000000c001', 'Curso a88 A'), ('a8800000-0000-4000-8000-00000000c002', 'Curso a88 B'),
  ('a8800000-0000-4000-8000-00000000c003', 'Curso a88 C');
insert into public.course_staff (course_id, user_id) values
  ('a8800000-0000-4000-8000-00000000c001', 'a8800000-0000-4000-8000-000000000103'),
  ('a8800000-0000-4000-8000-00000000c001', 'a8800000-0000-4000-8000-000000000104'),
  ('a8800000-0000-4000-8000-00000000c001', 'a8800000-0000-4000-8000-000000000107'),
  ('a8800000-0000-4000-8000-00000000c001', 'a8800000-0000-4000-8000-000000000119'),
  ('a8800000-0000-4000-8000-00000000c002', 'a8800000-0000-4000-8000-000000000106');
insert into public.classes (id, course_id, name, join_code, created_by, archived) values
  ('a8800000-0000-4000-8000-00000000d001', 'a8800000-0000-4000-8000-00000000c001', 'a88 A1', 'AUD88A01', 'a8800000-0000-4000-8000-000000000105', false),
  ('a8800000-0000-4000-8000-00000000d002', 'a8800000-0000-4000-8000-00000000c001', 'a88 A2 bloqueo', 'AUD88A02', 'a8800000-0000-4000-8000-000000000105', false),
  ('a8800000-0000-4000-8000-00000000d003', 'a8800000-0000-4000-8000-00000000c002', 'a88 B1', 'AUD88B01', 'a8800000-0000-4000-8000-000000000106', false),
  ('a8800000-0000-4000-8000-00000000d004', 'a8800000-0000-4000-8000-00000000c001', 'a88 A archivada', 'AUD88A04', 'a8800000-0000-4000-8000-000000000105', true);
-- created_by lo fija el disparador solo si hay auth.uid(); aquí no hay: se respeta el valor dado
insert into public.class_teachers (class_id, user_id) values
  ('a8800000-0000-4000-8000-00000000d001', 'a8800000-0000-4000-8000-000000000105') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('a8800000-0000-4000-8000-00000000d001', 'a8800000-0000-4000-8000-000000000111'),
  ('a8800000-0000-4000-8000-00000000d001', 'a8800000-0000-4000-8000-000000000112'),
  ('a8800000-0000-4000-8000-00000000d001', 'a8800000-0000-4000-8000-000000000113'),
  ('a8800000-0000-4000-8000-00000000d002', 'a8800000-0000-4000-8000-000000000116'),
  ('a8800000-0000-4000-8000-00000000d001', 'a8800000-0000-4000-8000-000000000117'),
  ('a8800000-0000-4000-8000-00000000d001', 'a8800000-0000-4000-8000-000000000118'),
  ('a8800000-0000-4000-8000-00000000d003', 'a8800000-0000-4000-8000-000000000115'),
  ('a8800000-0000-4000-8000-00000000d004', 'a8800000-0000-4000-8000-000000000120');
insert into public.class_monitors (class_id, user_id, assigned_by) values
  ('a8800000-0000-4000-8000-00000000d001', 'a8800000-0000-4000-8000-000000000118', 'a8800000-0000-4000-8000-000000000105');
-- regularización obligatoria abierta y con bloqueo en la sección d002 (solo u16)
insert into public.hist_settings (class_id, abierto, bloquear) values ('a8800000-0000-4000-8000-00000000d002', true, true)
  on conflict (class_id) do update set abierto = true, bloquear = true;
-- regla de inactividad activa; u17 sin uso desde hace 400 días (los demás se acaban de crear)
update public.inactividad_config set activo = true, dias = 30, activado_at = now() - interval '400 days' where id = 1;
update public.profiles set created_at = now() - interval '400 days' where id = 'a8800000-0000-4000-8000-000000000117';

-- unidades: A: e001 publicada, e002 oculta, e003 borrador, e004 preparado, e005 archivado, e006 oculta+borrador;
--           B: e007 publicada; C: e008 publicada
insert into public.units (id, course_id, slug, title, position, hidden, status) values
  ('a8800000-0000-4000-8000-00000000e001', 'a8800000-0000-4000-8000-00000000c001', 'a88-u1', 'U1', 1, false, 'publicado'),
  ('a8800000-0000-4000-8000-00000000e002', 'a8800000-0000-4000-8000-00000000c001', 'a88-u2', 'U2', 2, true,  'publicado'),
  ('a8800000-0000-4000-8000-00000000e003', 'a8800000-0000-4000-8000-00000000c001', 'a88-u3', 'U3', 3, false, 'borrador'),
  ('a8800000-0000-4000-8000-00000000e004', 'a8800000-0000-4000-8000-00000000c001', 'a88-u4', 'U4', 4, false, 'preparado'),
  ('a8800000-0000-4000-8000-00000000e005', 'a8800000-0000-4000-8000-00000000c001', 'a88-u5', 'U5', 5, false, 'archivado'),
  ('a8800000-0000-4000-8000-00000000e006', 'a8800000-0000-4000-8000-00000000c001', 'a88-u6', 'U6', 6, true,  'borrador'),
  ('a8800000-0000-4000-8000-00000000e007', 'a8800000-0000-4000-8000-00000000c002', 'a88-u7', 'U7', 1, false, 'publicado'),
  ('a8800000-0000-4000-8000-00000000e008', 'a8800000-0000-4000-8000-00000000c003', 'a88-u8', 'U8', 1, false, 'publicado');
-- lecciones: f001 visible (e001), f002 oculta (e001), f003 en unidad oculta, f004 borrador, f005 preparado,
--            f006 archivado, f007 en B, f008 en C, f009 en unidad oculta+borrador
insert into public.lessons (id, unit_id, course_id, slug, position, title, hidden)
select ('a8800000-0000-4000-8000-00000000f00' || l)::uuid, ('a8800000-0000-4000-8000-00000000e00' || u)::uuid,
       'a8800000-0000-4000-8000-00000000c001', 'a88-l' || l, 1, 'L' || l, h   -- el disparador corrige course_id
from (values ('1', '1', false), ('2', '1', true), ('3', '2', false), ('4', '3', false), ('5', '4', false), ('6', '5', false),
             ('7', '7', false), ('8', '8', false), ('9', '6', false)) v(l, u, h);
-- conceptos: a001 visible A, a002 oculto A, a003 visible B, a004 visible C, a005 oculto B
insert into public.concepts (id, course_id, slug, name, hidden) values
  ('a8800000-0000-4000-8000-00000000a001', 'a8800000-0000-4000-8000-00000000c001', 'a88-k1', 'K1', false),
  ('a8800000-0000-4000-8000-00000000a002', 'a8800000-0000-4000-8000-00000000c001', 'a88-k2', 'K2', true),
  ('a8800000-0000-4000-8000-00000000a003', 'a8800000-0000-4000-8000-00000000c002', 'a88-k3', 'K3', false),
  ('a8800000-0000-4000-8000-00000000a004', 'a8800000-0000-4000-8000-00000000c003', 'a88-k4', 'K4', false),
  ('a8800000-0000-4000-8000-00000000a005', 'a8800000-0000-4000-8000-00000000c002', 'a88-k5', 'K5', true);

-- comprobaciones de la preparación (si fallan, la prueba no mide lo que dice)
do $$ begin
  if (select course_id from public.lessons where id = 'a8800000-0000-4000-8000-00000000f007') <> 'a8800000-0000-4000-8000-00000000c002'
    then raise exception 'FALLO (preparación): el disparador no pasó f007 al curso B'; end if;
  if not public.hist_bloqueado('a8800000-0000-4000-8000-000000000116') then raise exception 'FALLO (preparación): u16 no está bloqueado'; end if;
  if public.hist_bloqueado('a8800000-0000-4000-8000-000000000111') then raise exception 'FALLO (preparación): u11 bloqueado'; end if;
  if not public.inactividad_vencida('a8800000-0000-4000-8000-000000000117') then raise exception 'FALLO (preparación): u17 no vencido'; end if;
  if public.inactividad_vencida('a8800000-0000-4000-8000-000000000111') then raise exception 'FALLO (preparación): u11 vencido'; end if;
  if exists (select 1 from public.profiles where id = 'a8800000-0000-4000-8000-000000000121') then raise exception 'FALLO (preparación): u21 tiene perfil'; end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Operaciones medidas. Las de escritura se miden también con RETURNING (como PostgREST con return=representation).
-- ---------------------------------------------------------------------------------------------------------------
create temp table aud_ops (orden serial, nombre text not null, tipo text not null, sql text not null);
insert into aud_ops (nombre, tipo, sql)
select nombre, tipo, replace(replace(replace(replace(replace(sql, '$A', '''a8800000-0000-4000-8000-00000000c001'''),
         '$B', '''a8800000-0000-4000-8000-00000000c002'''), '$C', '''a8800000-0000-4000-8000-00000000c003'''),
         '$e', '''a8800000-0000-4000-8000-00000000e00'), '$f', '''a8800000-0000-4000-8000-00000000f00')
from (values
  -- lecturas: etiquetas (últimos 4 caracteres del id) de las filas de prueba visibles, y totales de toda la tabla
  ('r_courses',  'lectura', 'select coalesce(string_agg(right(id::text, 4), '','' order by id), '''') from public.courses where id::text like ''a8800000-%'''),
  ('r_units',    'lectura', 'select coalesce(string_agg(right(id::text, 4), '','' order by id), '''') from public.units where id::text like ''a8800000-%'''),
  ('r_lessons',  'lectura', 'select coalesce(string_agg(right(id::text, 4), '','' order by id), '''') from public.lessons where id::text like ''a8800000-%'''),
  ('r_concepts', 'lectura', 'select coalesce(string_agg(right(id::text, 4), '','' order by id), '''') from public.concepts where id::text like ''a8800000-%'''),
  ('r_total',    'lectura', 'select (select count(*) from public.courses) || ''/'' || (select count(*) from public.units) || ''/'' || (select count(*) from public.lessons) || ''/'' || (select count(*) from public.concepts)'),
  ('r_incrustado', 'lectura', 'select coalesce(string_agg(right(l.id::text, 4) || ''<'' || right(u.id::text, 4) || ''<'' || right(c.id::text, 4), '','' order by l.id), '''') from public.lessons l join public.units u on u.id = l.unit_id join public.courses c on c.id = l.course_id where l.id::text like ''a8800000-%'''),
  ('r_lecc_unidad_borrador', 'lectura', 'select count(*)::text from public.lessons where unit_id in ($e3'', $e4'', $e5'', $e6'', $e2'')'),
  -- courses (sus políticas de escritura no cambian, pero UPDATE/RETURNING evalúa courses_select, que sí cambia)
  ('c_upd_A',  'escritura', 'update public.courses set description = ''x'' where id = $A'),
  ('c_upd_B',  'escritura', 'update public.courses set description = ''x'' where id = $B'),
  ('c_upd_C',  'escritura', 'update public.courses set description = ''x'' where id = $C'),
  ('c_ins',    'escritura', 'insert into public.courses (title) values (''Curso a88 nuevo'')'),
  ('c_del_C',  'escritura', 'delete from public.courses where id = $C'),
  -- units
  ('u_ins_A',  'escritura', 'insert into public.units (course_id, slug, title) values ($A, ''a88-nueva'', ''N'')'),
  ('u_ins_B',  'escritura', 'insert into public.units (course_id, slug, title) values ($B, ''a88-nueva'', ''N'')'),
  ('u_ins_C',  'escritura', 'insert into public.units (course_id, slug, title) values ($C, ''a88-nueva'', ''N'')'),
  ('u_ins_A_oculta', 'escritura', 'insert into public.units (course_id, slug, title, hidden, status) values ($A, ''a88-nueva'', ''N'', true, ''borrador'')'),
  ('u_upd_e1', 'escritura', 'update public.units set summary = ''x'' where id = $e1'''),
  ('u_upd_e2', 'escritura', 'update public.units set summary = ''x'' where id = $e2'''),
  ('u_upd_e3', 'escritura', 'update public.units set summary = ''x'' where id = $e3'''),
  ('u_upd_e7', 'escritura', 'update public.units set summary = ''x'' where id = $e7'''),
  ('u_upd_e8', 'escritura', 'update public.units set summary = ''x'' where id = $e8'''),
  ('u_mov_e1_a_B', 'escritura', 'update public.units set course_id = $B where id = $e1'''),
  ('u_mov_e1_a_C', 'escritura', 'update public.units set course_id = $C where id = $e1'''),
  ('u_mov_e7_a_A', 'escritura', 'update public.units set course_id = $A where id = $e7'''),
  ('u_publicar_e3', 'escritura', 'update public.units set status = ''publicado'' where id = $e3'''),
  ('u_mostrar_e2', 'escritura', 'update public.units set hidden = false where id = $e2'''),
  ('u_ocultar_e1', 'escritura', 'update public.units set hidden = true where id = $e1'''),
  ('u_del_e3', 'escritura', 'delete from public.units where id = $e3'''),
  ('u_del_e7', 'escritura', 'delete from public.units where id = $e7'''),
  ('u_del_e8', 'escritura', 'delete from public.units where id = $e8'''),
  ('u_upd_todas', 'escritura', 'update public.units set summary = summary'),
  -- upsert (PostgREST Prefer: resolution=merge-duplicates / ignore-duplicates): evalúa SELECT sobre la fila existente
  ('u_upsert_e1', 'escritura', 'insert into public.units (id, course_id, slug, title) values ($e1'', $A, ''a88-u1'', ''Ups'') on conflict (id) do update set title = excluded.title'),
  ('u_upsert_e7', 'escritura', 'insert into public.units (id, course_id, slug, title) values ($e7'', $B, ''a88-u7'', ''Ups'') on conflict (id) do update set title = excluded.title'),
  ('u_upsert_e7_a_A', 'escritura', 'insert into public.units (id, course_id, slug, title) values ($e7'', $A, ''a88-u7'', ''Ups'') on conflict (id) do update set title = excluded.title, course_id = excluded.course_id'),
  ('u_upsert_e2_nada', 'escritura', 'insert into public.units (id, course_id, slug, title) values ($e2'', $A, ''a88-u2'', ''Ups'') on conflict (id) do nothing'),
  ('l_upsert_f2', 'escritura', 'insert into public.lessons (id, unit_id, course_id, slug, title) values ($f2'', $e1'', $A, ''a88-l2'', ''Ups'') on conflict (id) do update set title = excluded.title'),
  ('l_upsert_f7', 'escritura', 'insert into public.lessons (id, unit_id, course_id, slug, title) values ($f7'', $e7'', $B, ''a88-l7'', ''Ups'') on conflict (id) do update set title = excluded.title'),
  ('k_upsert_a2', 'escritura', 'insert into public.concepts (id, course_id, slug, name) values (''a8800000-0000-4000-8000-00000000a002'', $A, ''a88-k2'', ''Ups'') on conflict (id) do update set name = excluded.name'),
  ('k_upsert_a5', 'escritura', 'insert into public.concepts (id, course_id, slug, name) values (''a8800000-0000-4000-8000-00000000a005'', $B, ''a88-k5'', ''Ups'') on conflict (id) do update set name = excluded.name'),
  -- lessons (disparador lessons_sync_course: course_id = curso de la unidad al insertar o cambiar unit_id)
  ('l_ins_e1', 'escritura', 'insert into public.lessons (unit_id, course_id, slug, title) values ($e1'', $A, ''a88-nueva'', ''N'')'),
  ('l_ins_e7', 'escritura', 'insert into public.lessons (unit_id, course_id, slug, title) values ($e7'', $B, ''a88-nueva'', ''N'')'),
  ('l_ins_e8', 'escritura', 'insert into public.lessons (unit_id, course_id, slug, title) values ($e8'', $C, ''a88-nueva'', ''N'')'),
  ('l_ins_cruzada_e7_A', 'escritura', 'insert into public.lessons (unit_id, course_id, slug, title) values ($e7'', $A, ''a88-nueva'', ''N'')'),
  ('l_ins_cruzada_e1_B', 'escritura', 'insert into public.lessons (unit_id, course_id, slug, title) values ($e1'', $B, ''a88-nueva'', ''N'')'),
  ('l_ins_oculta_e3', 'escritura', 'insert into public.lessons (unit_id, course_id, slug, title, hidden) values ($e3'', $A, ''a88-nueva'', ''N'', true)'),
  ('l_upd_f1', 'escritura', 'update public.lessons set summary = ''x'' where id = $f1'''),
  ('l_upd_f2', 'escritura', 'update public.lessons set summary = ''x'' where id = $f2'''),
  ('l_upd_f3', 'escritura', 'update public.lessons set summary = ''x'' where id = $f3'''),
  ('l_upd_f4', 'escritura', 'update public.lessons set summary = ''x'' where id = $f4'''),
  ('l_upd_f7', 'escritura', 'update public.lessons set summary = ''x'' where id = $f7'''),
  ('l_upd_f8', 'escritura', 'update public.lessons set summary = ''x'' where id = $f8'''),
  ('l_mov_unidad_f1_a_e7', 'escritura', 'update public.lessons set unit_id = $e7'' where id = $f1'''),
  ('l_mov_unidad_f7_a_e1', 'escritura', 'update public.lessons set unit_id = $e1'' where id = $f7'''),
  ('l_mov_unidad_f1_a_e3', 'escritura', 'update public.lessons set unit_id = $e3'' where id = $f1'''),
  ('l_mov_curso_f1_a_B', 'escritura', 'update public.lessons set course_id = $B where id = $f1'''),
  ('l_mov_curso_f7_a_A', 'escritura', 'update public.lessons set course_id = $A where id = $f7'''),
  ('l_ocultar_f1', 'escritura', 'update public.lessons set hidden = true where id = $f1'''),
  ('l_mostrar_f2', 'escritura', 'update public.lessons set hidden = false where id = $f2'''),
  ('l_del_f1', 'escritura', 'delete from public.lessons where id = $f1'''),
  ('l_del_f2', 'escritura', 'delete from public.lessons where id = $f2'''),
  ('l_del_f7', 'escritura', 'delete from public.lessons where id = $f7'''),
  ('l_del_f8', 'escritura', 'delete from public.lessons where id = $f8'''),
  ('l_upd_todas', 'escritura', 'update public.lessons set summary = summary'),
  -- concepts
  ('k_ins_A', 'escritura', 'insert into public.concepts (course_id, slug, name) values ($A, ''a88-nuevo'', ''N'')'),
  ('k_ins_B', 'escritura', 'insert into public.concepts (course_id, slug, name) values ($B, ''a88-nuevo'', ''N'')'),
  ('k_ins_C', 'escritura', 'insert into public.concepts (course_id, slug, name) values ($C, ''a88-nuevo'', ''N'')'),
  ('k_ins_A_oculto', 'escritura', 'insert into public.concepts (course_id, slug, name, hidden) values ($A, ''a88-nuevo'', ''N'', true)'),
  ('k_upd_a1', 'escritura', 'update public.concepts set name = ''x'' where id = ''a8800000-0000-4000-8000-00000000a001'''),
  ('k_upd_a2', 'escritura', 'update public.concepts set name = ''x'' where id = ''a8800000-0000-4000-8000-00000000a002'''),
  ('k_upd_a3', 'escritura', 'update public.concepts set name = ''x'' where id = ''a8800000-0000-4000-8000-00000000a003'''),
  ('k_upd_a4', 'escritura', 'update public.concepts set name = ''x'' where id = ''a8800000-0000-4000-8000-00000000a004'''),
  ('k_mov_a1_a_B', 'escritura', 'update public.concepts set course_id = $B where id = ''a8800000-0000-4000-8000-00000000a001'''),
  ('k_mov_a3_a_A', 'escritura', 'update public.concepts set course_id = $A where id = ''a8800000-0000-4000-8000-00000000a003'''),
  ('k_mostrar_a2', 'escritura', 'update public.concepts set hidden = false where id = ''a8800000-0000-4000-8000-00000000a002'''),
  ('k_del_a1', 'escritura', 'delete from public.concepts where id = ''a8800000-0000-4000-8000-00000000a001'''),
  ('k_del_a3', 'escritura', 'delete from public.concepts where id = ''a8800000-0000-4000-8000-00000000a003'''),
  ('k_del_a4', 'escritura', 'delete from public.concepts where id = ''a8800000-0000-4000-8000-00000000a004'''),
  ('k_upd_todas', 'escritura', 'update public.concepts set name = name'),
  -- exercises: su disparador exercises_check_course lee lessons con la RLS del usuario (depende de lessons_select)
  ('x_ins_f1', 'escritura', 'insert into public.exercises (course_id, lesson_id, slug, category, difficulty, format, prompt) values ($A, $f1'', ''a88-x'', ''numerica'', ''basico'', ''numeric'', ''p'')'),
  ('x_ins_f2', 'escritura', 'insert into public.exercises (course_id, lesson_id, slug, category, difficulty, format, prompt) values ($A, $f2'', ''a88-x'', ''numerica'', ''basico'', ''numeric'', ''p'')'),
  ('x_ins_f7', 'escritura', 'insert into public.exercises (course_id, lesson_id, slug, category, difficulty, format, prompt) values ($B, $f7'', ''a88-x'', ''numerica'', ''basico'', ''numeric'', ''p'')')
) v(nombre, tipo, sql);

create temp table aud_obs (fase text, usuario text, ruta text, op text, res text, msg text);

create function pg_temp.aud_medir(p_fase text) returns integer language plpgsql as $f$
declare
  v_et text[]; v_id uuid[]; v_rol text[]; v_nom text[]; v_tipo text[]; v_sql text[];
  -- la ruta solo cambia account_ok de los ESTUDIANTES (regularización e inactividad): las tres rutas, solo para ellos
  rutas_est constant text[] := array['/rest/v1/x', '', '/rest/v1/rpc/hist_guardar'];
  i integer; j integer; v_ruta text; v_var text; v_q text; r text; m text; n bigint; total integer := 0;
begin
  select array_agg(etiqueta order by etiqueta), array_agg(id order by etiqueta), array_agg(rol_db order by etiqueta) into v_et, v_id, v_rol from aud_usuarios;
  select array_agg(nombre order by orden), array_agg(tipo order by orden), array_agg(sql order by orden) into v_nom, v_tipo, v_sql from aud_ops;
  for i in 1 .. array_length(v_et, 1) loop
    foreach v_ruta in array case when v_et[i] between 'u11' and 'u20' then rutas_est else array['/rest/v1/x'] end loop
      perform set_config('request.jwt.claims', case when v_id[i] is null then '{"role":"anon"}'
                         else json_build_object('sub', v_id[i], 'role', 'authenticated')::text end, true);
      perform set_config('request.jwt.claim.sub', coalesce(v_id[i]::text, ''), true);
      perform set_config('request.path', v_ruta, true);
      for j in 1 .. array_length(v_nom, 1) loop
        foreach v_var in array case when v_tipo[j] = 'escritura' then array['', '+ret'] else array[''] end loop
          r := null; m := null;
          begin
            execute 'set local role ' || v_rol[i];
            if v_tipo[j] = 'lectura' then
              execute v_sql[j] into r;
            elsif v_var = '' then
              execute v_sql[j]; get diagnostics n = row_count; r := 'ok:' || n;
            else
              execute 'with x as (' || v_sql[j] || ' returning 1) select count(*)::text from x' into r; r := 'ok:' || r;
            end if;
            raise exception using errcode = 'P0A88';   -- deshace la operación (subtransacción)
          exception
            when sqlstate 'P0A88' then null;
            when others then r := 'err:' || sqlstate; m := sqlerrm;
          end;
          execute 'reset role';
          insert into aud_obs values (p_fase, v_et[i], v_ruta, v_nom[j] || v_var, r, m);
          total := total + 1;
        end loop;
      end loop;
    end loop;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.path', '', true);
  return total;
end $f$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1) políticas NUEVAS (las de la migración 88, tal como están en la base)
-- ---------------------------------------------------------------------------------------------------------------
create temp table aud_pol as
  select tablename::text, policyname::text, cmd, roles::text, qual, with_check
  from pg_policies where schemaname = 'public' and tablename in ('courses', 'units', 'lessons', 'concepts');
do $$ begin
  if (select qual from aud_pol where policyname = 'lessons_select') not like '%mis_unidades_visibles%' then
    raise exception 'FALLO (preparación): lessons_select no es la de la migración 88';
  end if;
end $$;
select pg_temp.aud_medir('nueva');

-- ---------------------------------------------------------------------------------------------------------------
-- 2) políticas ANTIGUAS: SQL literal de supabase/reversion/20261106000088_rls_permisos_una_vez_revertir.sql
-- ---------------------------------------------------------------------------------------------------------------
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated
  using (public.is_teacher() or public.is_enrolled_course(id));

drop policy if exists units_select on public.units;
create policy units_select on public.units for select to authenticated
  using (public.is_teacher() or (not hidden and status = 'publicado' and public.is_enrolled_course(course_id)));

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
  using (public.is_teacher() or public.lesson_visible_to_me(id));

drop policy if exists concepts_select on public.concepts;
create policy concepts_select on public.concepts for select to authenticated
  using (public.is_teacher() or (public.is_enrolled_course(course_id) and not hidden));

drop policy if exists units_write on public.units;
create policy units_write on public.units for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));
drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));
drop policy if exists concepts_write on public.concepts;
create policy concepts_write on public.concepts for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));

do $$ begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename in ('courses', 'units', 'lessons', 'concepts')
      and (coalesce(qual, '') ~ 'mis_cursos|mis_unidades' or coalesce(with_check, '') ~ 'mis_cursos|mis_unidades')) <> 0 then
    raise exception 'FALLO (preparación): quedan políticas nuevas tras instalar las antiguas';
  end if;
end $$;
select pg_temp.aud_medir('antigua');

-- ---------------------------------------------------------------------------------------------------------------
-- 3) otra vez las NUEVAS: SQL literal de la migración 88 (solo las políticas; las funciones siguen instaladas)
-- ---------------------------------------------------------------------------------------------------------------
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated
  using ((select public.is_teacher()) or id in (select public.mis_cursos_inscritos()));
drop policy if exists units_select on public.units;
create policy units_select on public.units for select to authenticated
  using ((select public.is_teacher()) or (not hidden and status = 'publicado' and course_id in (select public.mis_cursos_inscritos())));
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
  using ((select public.is_teacher())
         or (not hidden and course_id in (select public.mis_cursos_inscritos()) and unit_id in (select public.mis_unidades_visibles())));
drop policy if exists concepts_select on public.concepts;
create policy concepts_select on public.concepts for select to authenticated
  using ((select public.is_teacher()) or (course_id in (select public.mis_cursos_inscritos()) and not hidden));
drop policy if exists units_write on public.units;
create policy units_write on public.units for all to authenticated
  using ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()))
  with check ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()));
drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons for all to authenticated
  using ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()))
  with check ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()));
drop policy if exists concepts_write on public.concepts;
create policy concepts_write on public.concepts for all to authenticated
  using ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()))
  with check ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()));

do $$ declare n integer; begin
  select count(*) into n from (
    (select tablename::text, policyname::text, cmd, roles::text, qual, with_check from pg_policies
       where schemaname = 'public' and tablename in ('courses', 'units', 'lessons', 'concepts')
     except select * from aud_pol)
    union all
    (select * from aud_pol except
     select tablename::text, policyname::text, cmd, roles::text, qual, with_check from pg_policies
       where schemaname = 'public' and tablename in ('courses', 'units', 'lessons', 'concepts'))) d;
  if n <> 0 then raise exception 'FALLO (preparación): la copia de las políticas nuevas difiere de la base (% diferencias)', n; end if;
end $$;
select pg_temp.aud_medir('nueva2');

-- ---------------------------------------------------------------------------------------------------------------
-- Comparación usuario × ruta × operación
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare v_n integer; v_dif text; v_dif2 text;
begin
  select count(*) into v_n from aud_obs where fase = 'nueva';
  if v_n < 40 * 100 or v_n <> (select count(*) from aud_obs where fase = 'antigua') then
    raise exception 'FALLO (preparación): mediciones incompletas (% nuevas)', v_n;
  end if;
  select string_agg(format('[%s ruta=%L %s: antes=%s ahora=%s]', coalesce(a.usuario, n.usuario), coalesce(a.ruta, n.ruta),
                           coalesce(a.op, n.op), a.res, n.res), ' ' order by coalesce(a.usuario, n.usuario), coalesce(a.op, n.op)),
         count(*)
    into v_dif, v_n
  from (select * from aud_obs where fase = 'antigua') a
  full join (select * from aud_obs where fase = 'nueva') n using (usuario, ruta, op)
  where a.res is distinct from n.res;
  if v_dif is not null then
    raise exception 'FALLO: % diferencias de permisos entre las políticas antiguas y las nuevas: %', v_n, left(v_dif, 3000);
  end if;
  select string_agg(format('[%s %L %s: %s/%s]', n.usuario, n.ruta, n.op, n.res, b.res), ' ') into v_dif2
  from (select * from aud_obs where fase = 'nueva') n join (select * from aud_obs where fase = 'nueva2') b using (usuario, ruta, op)
  where n.res is distinct from b.res;
  if v_dif2 is not null then raise exception 'FALLO (arnés): la medición no es reproducible: %', left(v_dif2, 2000); end if;
  raise notice 'equivalencia: % mediciones idénticas con las políticas antiguas y las nuevas', (select count(*) from aud_obs where fase = 'nueva');
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Aserciones absolutas (políticas nuevas, petición REST normal)
-- ---------------------------------------------------------------------------------------------------------------
create function pg_temp.aud(p_usuario text, p_op text, p_ruta text default '/rest/v1/x') returns text language sql as $$
  select res from aud_obs where fase = 'nueva' and usuario = p_usuario and op = p_op and ruta = p_ruta
$$;

do $$
declare v_mal text; u text; t text;
begin
  -- a) NINGUNA escritura con filas afectadas para quien no es administrador ni personal habilitado del curso
  --    (crear una asignatura nueva, c_ins, es legítimo para cualquier profesor activo: courses_insert = is_teacher())
  select string_agg(format('%s %L %s=%s', usuario, ruta, op, res), '; ') into v_mal
  from aud_obs o
  where fase = 'nueva' and usuario not in ('u01', 'u03', 'u06', 'u19')
    and op not like 'r\_%' and res ~ '^ok:[1-9]'
    and not (op like 'c\_ins%' and usuario in ('u05', 'u08'));
  if v_mal is not null then raise exception 'FALLO: escrituras no autorizadas: %', left(v_mal, 2000); end if;

  -- b) cuentas sin acceso (deshabilitadas, contraseña provisional, sin matrícula, bloqueadas, vencidas, sin perfil, anon)
  foreach u in array array['u02', 'u04', 'u07', 'u12', 'u13', 'u14', 'u16', 'u17', 'u21', 'anon'] loop
    foreach t in array array['r_courses', 'r_units', 'r_lessons', 'r_concepts', 'r_incrustado'] loop
      if coalesce(pg_temp.aud(u, t), '') not in ('', 'err:42501') then
        raise exception 'FALLO: % (%) lee % = %', u, (select descripcion from aud_usuarios where etiqueta = u), t, pg_temp.aud(u, t);
      end if;
    end loop;
  end loop;

  -- c) estudiantes habilitados: solo lo publicado, no oculto y de SU asignatura (la sección archivada sigue dando acceso,
  --    igual que antes: is_enrolled_course no mira classes.archived)
  foreach u in array array['u11', 'u18', 'u20'] loop
    if pg_temp.aud(u, 'r_courses') <> 'c001' or pg_temp.aud(u, 'r_units') <> 'e001' or pg_temp.aud(u, 'r_lessons') <> 'f001'
       or pg_temp.aud(u, 'r_concepts') <> 'a001' or pg_temp.aud(u, 'r_lecc_unidad_borrador') <> '0' then
      raise exception 'FALLO: el estudiante % ve: cursos=% unidades=% lecciones=% conceptos=%', u, pg_temp.aud(u, 'r_courses'),
        pg_temp.aud(u, 'r_units'), pg_temp.aud(u, 'r_lessons'), pg_temp.aud(u, 'r_concepts');
    end if;
  end loop;
  if pg_temp.aud('u15', 'r_courses') <> 'c002' or pg_temp.aud('u15', 'r_units') <> 'e007' or pg_temp.aud('u15', 'r_lessons') <> 'f007'
     or pg_temp.aud('u15', 'r_concepts') <> 'a003' then
    raise exception 'FALLO: el estudiante de B ve: % / % / % / %', pg_temp.aud('u15', 'r_courses'), pg_temp.aud('u15', 'r_units'),
      pg_temp.aud('u15', 'r_lessons'), pg_temp.aud('u15', 'r_concepts');
  end if;
  -- el monitor no gana nada sobre un estudiante normal
  if exists (select 1 from aud_obs m join aud_obs s using (fase, ruta, op)
             where m.fase = 'nueva' and m.usuario = 'u18' and s.usuario = 'u11' and m.res is distinct from s.res) then
    raise exception 'FALLO: el monitor tiene permisos distintos de un estudiante';
  end if;

  -- d) profesores habilitados que no son personal: lo ven todo, no escriben nada del contenido
  foreach u in array array['u05', 'u08'] loop
    if pg_temp.aud(u, 'r_units') <> 'e001,e002,e003,e004,e005,e006,e007,e008' then raise exception 'FALLO: profesor % no ve todas las unidades', u; end if;
  end loop;

  -- e) personal de A (u03): escribe en A, nunca en B ni en C ni puede sacar filas de A ni meterlas en A desde fuera
  if pg_temp.aud('u03', 'u_upd_e1') <> 'ok:1' or pg_temp.aud('u03', 'l_ins_e1') <> 'ok:1' or pg_temp.aud('u03', 'k_ins_A') <> 'ok:1'
     or pg_temp.aud('u03', 'l_del_f2') <> 'ok:1' or pg_temp.aud('u03', 'u_ins_A_oculta+ret') <> 'ok:1' then
    raise exception 'FALLO: el personal de A no puede editar A (la prueba sería vacía)';
  end if;
  foreach t in array array['u_ins_B', 'u_ins_C', 'u_mov_e1_a_B', 'u_mov_e1_a_C', 'l_ins_e7', 'l_ins_e8', 'l_ins_cruzada_e7_A',
                           'l_mov_unidad_f1_a_e7', 'l_mov_curso_f1_a_B', 'k_ins_B', 'k_ins_C', 'k_mov_a1_a_B', 'x_ins_f7',
                           'u_upsert_e7', 'u_upsert_e7_a_A', 'l_upsert_f7', 'k_upsert_a5'] loop
    if pg_temp.aud('u03', t) not like 'err:%' then raise exception 'FALLO: el personal de A logró % = %', t, pg_temp.aud('u03', t); end if;
  end loop;
  foreach t in array array['u_upd_e7', 'u_upd_e8', 'u_mov_e7_a_A', 'u_del_e7', 'u_del_e8', 'l_upd_f7', 'l_upd_f8', 'l_mov_unidad_f7_a_e1',
                           'l_mov_curso_f7_a_A', 'l_del_f7', 'l_del_f8', 'k_upd_a3', 'k_upd_a4', 'k_mov_a3_a_A', 'k_del_a3', 'k_del_a4'] loop
    if pg_temp.aud('u03', t) <> 'ok:0' then raise exception 'FALLO: el personal de A afectó filas ajenas con % = %', t, pg_temp.aud('u03', t); end if;
  end loop;
  -- la regla «una lección insertada con course_id de A en una unidad de B acaba en B» la corta el with check
  if pg_temp.aud('u03', 'l_ins_cruzada_e1_B') <> 'ok:1' then raise exception 'FALLO: lección en unidad de A con course_id de B (el disparador la pasa a A)'; end if;
  -- personal de B (u06): simétrico
  if pg_temp.aud('u06', 'u_upd_e7') <> 'ok:1' or pg_temp.aud('u06', 'u_upd_e1') <> 'ok:0' or pg_temp.aud('u06', 'u_mov_e7_a_A') not like 'err:%' then
    raise exception 'FALLO: personal de B: % % %', pg_temp.aud('u06', 'u_upd_e7'), pg_temp.aud('u06', 'u_upd_e1'), pg_temp.aud('u06', 'u_mov_e7_a_A');
  end if;
  -- administrador activo: todo; administrador deshabilitado: nada (comprobado en a y b)
  if pg_temp.aud('u01', 'u_ins_C') <> 'ok:1' or pg_temp.aud('u01', 'l_mov_curso_f1_a_B') <> 'ok:1' then
    raise exception 'FALLO: el administrador activo no puede escribir';
  end if;
  raise notice 'aserciones absolutas: correctas';
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Las funciones nuevas llamadas directamente (RPC, rol authenticated): ¿revelan algo que antes no se podía leer?
-- Referencia «antes»: lo que cada usuario podía leer con las políticas ANTIGUAS (fase 'antigua') y lo que ya daban
-- por RPC is_enrolled_course(uuid) / is_course_staff(uuid) (concedidas a authenticated desde la migración 4).
-- ---------------------------------------------------------------------------------------------------------------
create temp table aud_rpc (usuario text, ruta text, fn text, arg text, res text);
do $$
declare
  u record; v_ruta text; c uuid; e uuid; r text;
begin
  for u in select * from aud_usuarios where id is not null order by etiqueta loop
    foreach v_ruta in array array['/rest/v1/rpc/mis_cursos_inscritos', '/rest/v1/rpc/hist_guardar'] loop
      perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u.id::text, true);
      perform set_config('request.path', v_ruta, true);
      execute 'set local role authenticated';
      select coalesce(string_agg(right(x::text, 4), ',' order by x), '') into r from public.mis_cursos_inscritos() x where x::text like 'a8800000-%';
      execute 'reset role'; insert into aud_rpc values (u.etiqueta, v_ruta, 'mis_cursos_inscritos', null, r);
      execute 'set local role authenticated';
      select coalesce(string_agg(right(x::text, 4), ',' order by x), '') into r from public.mis_cursos_staff() x where x::text like 'a8800000-%';
      execute 'reset role'; insert into aud_rpc values (u.etiqueta, v_ruta, 'mis_cursos_staff', null, r);
      for c in select id from public.courses where id::text like 'a8800000-%' order by id loop
        execute 'set local role authenticated';
        r := public.is_enrolled_course(c)::text || '/' || public.is_course_staff(c)::text;
        execute 'reset role'; insert into aud_rpc values (u.etiqueta, v_ruta, 'antiguas', right(c::text, 4), r);
      end loop;
      -- mis_unidades_visibles(): una fila por unidad devuelta (arg = unidad) para compararla con lo legible antes
      execute 'set local role authenticated';
      for e in select x from public.mis_unidades_visibles() x where x::text like 'a8800000-%' order by x loop
        execute 'reset role'; insert into aud_rpc values (u.etiqueta, v_ruta, 'mis_unidades_visibles', right(e::text, 4), 'true');
        execute 'set local role authenticated';
      end loop;
      execute 'reset role';
    end loop;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.path', '', true);
end $$;

do $$
declare v_mal text;
begin
  -- mis_cursos_inscritos() = {c : is_enrolled_course(c)} (RPC que ya existía): no revela nada nuevo
  select string_agg(format('%s %L: %s vs %s', m.usuario, m.ruta, m.res,
           (select coalesce(string_agg(a.arg, ',' order by a.arg), '') from aud_rpc a where a.usuario = m.usuario and a.ruta = m.ruta
              and a.fn = 'antiguas' and a.res like 'true/%')), '; ')
    into v_mal
  from aud_rpc m where m.fn = 'mis_cursos_inscritos'
    and m.res is distinct from (select coalesce(string_agg(a.arg, ',' order by a.arg), '') from aud_rpc a
                                where a.usuario = m.usuario and a.ruta = m.ruta and a.fn = 'antiguas' and a.res like 'true/%');
  if v_mal is not null then raise exception 'FALLO: mis_cursos_inscritos() difiere de is_enrolled_course(): %', v_mal; end if;
  -- mis_cursos_staff() ⊆ {c : is_course_staff(c)} (RPC que ya existía)
  select string_agg(format('%s: %s', m.usuario, m.res), '; ') into v_mal
  from aud_rpc m where m.fn = 'mis_cursos_staff' and m.res <> '' and exists (
    select 1 from unnest(string_to_array(m.res, ',')) k
    where not exists (select 1 from aud_rpc a where a.usuario = m.usuario and a.ruta = m.ruta and a.fn = 'antiguas' and a.arg = k and a.res like '%/true'));
  if v_mal is not null then raise exception 'FALLO: mis_cursos_staff() revela asignaturas fuera de is_course_staff(): %', v_mal; end if;
  -- mis_unidades_visibles(): no debe devolver ninguna unidad que el usuario no podía leer antes (fase 'antigua', REST)
  select string_agg(format('%s (%s) unidad %s', p.usuario, (select descripcion from aud_usuarios where etiqueta = p.usuario), p.arg), '; '
                    order by p.usuario, p.arg)
    into v_mal
  from aud_rpc p
  where p.fn = 'mis_unidades_visibles' and p.ruta = '/rest/v1/rpc/mis_cursos_inscritos' and p.res = 'true'
    and position(p.arg in coalesce((select o.res from aud_obs o where o.fase = 'antigua' and o.usuario = p.usuario
                                     and o.ruta = '/rest/v1/x' and o.op = 'r_units'), '')) = 0;
  if v_mal is not null then
    raise exception 'FALLO (fuga por RPC): mis_unidades_visibles(), concedida a authenticated y SECURITY DEFINER, devuelve unidades que el usuario NO puede leer (sin matrícula, cuenta deshabilitada, bloqueada o vencida): %', v_mal;
  end if;
end $$;

select 'RLS PERMISOS UNA VEZ (NEGATIVAS Y CASOS LÍMITE): PRUEBAS PASARON' as resultado;
rollback;
