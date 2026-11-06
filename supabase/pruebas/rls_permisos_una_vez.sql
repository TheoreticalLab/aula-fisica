-- Pruebas: migración 88 (RLS de contenido con los permisos calculados una vez). Transacción que se deshace al final.
-- EQUIVALENCIA usuario por usuario: para cada usuario (casos preparados + administradores, profesores y una muestra
-- de estudiantes de la base: en `npm run probar`, los REALES de la copia de producción) las filas visibles con las
-- políticas nuevas son exactamente las que daban las reglas antiguas, y el permiso de escritura es el mismo.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('b8800000-0000-4000-8000-000000000001', 'b88ad@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b88-admin"}', '{}', now(), now()),
  ('b8800000-0000-4000-8000-000000000002', 'b88t@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b88-prof","aula_role":"teacher"}', '{}', now(), now()),
  ('b8800000-0000-4000-8000-000000000003', 'b88t2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b88-prof2","aula_role":"teacher"}', '{}', now(), now()),
  ('b8800000-0000-4000-8000-000000000004', 'b88td@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b88-prof-off","aula_role":"teacher"}', '{}', now(), now()),
  ('b8800000-0000-4000-8000-000000000011', 'b88s@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b88-est"}', '{}', now(), now()),
  ('b8800000-0000-4000-8000-000000000012', 'b88n@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b88-ajeno"}', '{}', now(), now()),
  ('b8800000-0000-4000-8000-000000000013', 'b88i@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b88-inactivo"}', '{}', now(), now()),
  ('b8800000-0000-4000-8000-000000000014', 'b88c@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b88-clave"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'b8800000-%';
update public.profiles set role = 'admin' where id = 'b8800000-0000-4000-8000-000000000001';
update public.profiles set role = 'teacher' where id in ('b8800000-0000-4000-8000-000000000002', 'b8800000-0000-4000-8000-000000000003', 'b8800000-0000-4000-8000-000000000004');
update public.profiles set active = false where id in ('b8800000-0000-4000-8000-000000000004', 'b8800000-0000-4000-8000-000000000013');
update public.profiles set must_change_password = true where id = 'b8800000-0000-4000-8000-000000000014';

insert into public.courses (id, title) values
  ('b8800000-0000-4000-8000-0000000000c1', 'Curso 88 A'), ('b8800000-0000-4000-8000-0000000000c2', 'Curso 88 B');
insert into public.course_staff (course_id, user_id) values
  ('b8800000-0000-4000-8000-0000000000c1', 'b8800000-0000-4000-8000-000000000002'),
  ('b8800000-0000-4000-8000-0000000000c1', 'b8800000-0000-4000-8000-000000000004');   -- personal con la cuenta deshabilitada
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('b8800000-0000-4000-8000-0000000000d1', 'b8800000-0000-4000-8000-0000000000c1', 'Sección 88', 'RLS00088', 'b8800000-0000-4000-8000-000000000002');
insert into public.enrollments (class_id, user_id) values
  ('b8800000-0000-4000-8000-0000000000d1', 'b8800000-0000-4000-8000-000000000011'),
  ('b8800000-0000-4000-8000-0000000000d1', 'b8800000-0000-4000-8000-000000000013'),
  ('b8800000-0000-4000-8000-0000000000d1', 'b8800000-0000-4000-8000-000000000014');
-- unidades: publicada, oculta, en borrador; y una publicada del curso B
insert into public.units (id, course_id, slug, title, position, hidden, status) values
  ('b8800000-0000-4000-8000-0000000000e1', 'b8800000-0000-4000-8000-0000000000c1', 'b88-u1', 'U pub', 1, false, 'publicado'),
  ('b8800000-0000-4000-8000-0000000000e2', 'b8800000-0000-4000-8000-0000000000c1', 'b88-u2', 'U oculta', 2, true, 'publicado'),
  ('b8800000-0000-4000-8000-0000000000e3', 'b8800000-0000-4000-8000-0000000000c1', 'b88-u3', 'U borrador', 3, false, 'borrador'),
  ('b8800000-0000-4000-8000-0000000000e4', 'b8800000-0000-4000-8000-0000000000c2', 'b88-u4', 'U otra', 1, false, 'publicado');
insert into public.lessons (id, unit_id, course_id, slug, position, title, hidden) values
  ('b8800000-0000-4000-8000-0000000000f1', 'b8800000-0000-4000-8000-0000000000e1', 'b8800000-0000-4000-8000-0000000000c1', 'b88-l1', 1, 'L visible', false),
  ('b8800000-0000-4000-8000-0000000000f2', 'b8800000-0000-4000-8000-0000000000e1', 'b8800000-0000-4000-8000-0000000000c1', 'b88-l2', 2, 'L oculta', true),
  ('b8800000-0000-4000-8000-0000000000f3', 'b8800000-0000-4000-8000-0000000000e2', 'b8800000-0000-4000-8000-0000000000c1', 'b88-l3', 1, 'L en unidad oculta', false),
  ('b8800000-0000-4000-8000-0000000000f4', 'b8800000-0000-4000-8000-0000000000e3', 'b8800000-0000-4000-8000-0000000000c1', 'b88-l4', 1, 'L en borrador', false),
  ('b8800000-0000-4000-8000-0000000000f5', 'b8800000-0000-4000-8000-0000000000e4', 'b8800000-0000-4000-8000-0000000000c2', 'b88-l5', 1, 'L de otro curso', false),
  -- «cruzada»: se pide curso A con una unidad del curso B; el disparador lessons_sync_course la pasa al curso B
  ('b8800000-0000-4000-8000-0000000000f6', 'b8800000-0000-4000-8000-0000000000e4', 'b8800000-0000-4000-8000-0000000000c1', 'b88-l6', 2, 'L cruzada', false);
insert into public.concepts (id, course_id, slug, name, hidden) values
  ('b8800000-0000-4000-8000-0000000000a1', 'b8800000-0000-4000-8000-0000000000c1', 'b88-c1', 'Concepto visible', false),
  ('b8800000-0000-4000-8000-0000000000a2', 'b8800000-0000-4000-8000-0000000000c1', 'b88-c2', 'Concepto oculto', true);

-- Comparación: reglas antiguas (evaluadas como superusuario con los datos de la sesión del usuario) frente a lo que
-- devuelven las políticas nuevas con el rol authenticated.
do $$
declare
  u record; v_ant text; v_nue text; n integer := 0;
  firma constant text := 'md5(coalesce(string_agg(id::text, '','' order by id), ''''))';
  reglas constant text[][] := array[
    ['public.courses',  'public.is_teacher() or public.is_enrolled_course(id)'],
    ['public.units',    'public.is_teacher() or (not hidden and status = ''publicado'' and public.is_enrolled_course(course_id)) or public.is_course_staff(course_id)'],
    ['public.lessons',  'public.is_teacher() or public.lesson_visible_to_me(id) or public.is_course_staff(course_id)'],
    ['public.concepts', 'public.is_teacher() or (public.is_enrolled_course(course_id) and not hidden) or public.is_course_staff(course_id)']];
  i integer;
begin
  for u in
    select id from public.profiles where id::text like 'b8800000-%'
    union select id from (select id from public.profiles where role <> 'student' and id::text not like 'b8800000-%' order by id limit 30) p
    union select id from (select id from public.profiles where role = 'student' and id::text not like 'b8800000-%' order by id limit 40) e
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', u.id::text, true);
    perform set_config('request.path', '/rest/v1/prueba', true);   -- como una petición REST (aplica la inactividad)
    for i in 1 .. array_length(reglas, 1) loop
      execute format('select %s from %s where %s', firma, reglas[i][1], reglas[i][2]) into v_ant;
      execute 'set local role authenticated';
      execute format('select %s from %s', firma, reglas[i][1]) into v_nue;
      execute 'reset role';
      if v_ant is distinct from v_nue then
        raise exception 'FALLO: % ve filas distintas en % con las políticas nuevas', u.id, reglas[i][1];
      end if;
    end loop;
    -- permiso de ESCRITURA (with check / using de *_write): misma regla para cada asignatura
    execute format('select %s from public.courses where public.is_course_staff(id)', firma) into v_ant;
    execute format('select %s from public.courses where (select public.is_admin()) or id in (select public.mis_cursos_staff())', firma) into v_nue;
    if v_ant is distinct from v_nue then raise exception 'FALLO: % cambia de permiso de escritura', u.id; end if;
    n := n + 1;
  end loop;
  if n < 8 then raise exception 'FALLO: solo se compararon % usuarios', n; end if;
end $$;

-- Casos concretos (para que la prueba no dependa solo de la equivalencia)
set local role authenticated;
select set_config('request.path', '/rest/v1/prueba', true);
select set_config('request.jwt.claims', '{"sub":"b8800000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8800000-0000-4000-8000-000000000011', true);
do $$ begin
  if (select array_agg(slug order by slug) from public.lessons where slug like 'b88-%') is distinct from array['b88-l1'] then
    raise exception 'FALLO: el estudiante ve lecciones distintas de la única visible: %', (select array_agg(slug order by slug) from public.lessons where slug like 'b88-%');
  end if;
  if (select count(*) from public.units where id::text like 'b8800000-%') <> 1 then raise exception 'FALLO: unidades del estudiante'; end if;
  -- las funciones nuevas, llamadas por RPC, solo devuelven lo que el estudiante ya puede leer
  if (select array_agg(x) from public.mis_unidades_visibles() x where x::text like 'b8800000-%') is distinct from array['b8800000-0000-4000-8000-0000000000e1'::uuid] then
    raise exception 'FALLO: mis_unidades_visibles() revela unidades que el estudiante no ve';
  end if;
  if exists (select 1 from public.mis_cursos_staff()) then raise exception 'FALLO: mis_cursos_staff() no vacío para un estudiante'; end if;
  if (select count(*) from public.concepts where slug like 'b88-%') <> 1 then raise exception 'FALLO: conceptos del estudiante'; end if;
  begin
    insert into public.lessons (unit_id, course_id, slug, position, title) values ('b8800000-0000-4000-8000-0000000000e1', 'b8800000-0000-4000-8000-0000000000c1', 'b88-x', 9, 'x');
    raise exception 'FALLO: un estudiante creó una lección';
  exception when insufficient_privilege then null;
  end;
end $$;
-- estudiante con cambio de contraseña pendiente (cuenta no habilitada): nada
select set_config('request.jwt.claims', '{"sub":"b8800000-0000-4000-8000-000000000014","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8800000-0000-4000-8000-000000000014', true);
do $$ begin
  if exists (select 1 from public.lessons where slug like 'b88-%') or exists (select 1 from public.courses where id::text like 'b8800000-%') then
    raise exception 'FALLO: una cuenta no habilitada ve contenido';
  end if;
  if exists (select 1 from public.mis_unidades_visibles() x where x::text like 'b8800000-%') or exists (select 1 from public.mis_cursos_inscritos() x where x::text like 'b8800000-%') then
    raise exception 'FALLO: una cuenta no habilitada obtiene unidades o asignaturas por RPC';
  end if;
end $$;
-- profesor del personal del curso: crea y edita; profesor ajeno: ve pero no edita
select set_config('request.jwt.claims', '{"sub":"b8800000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8800000-0000-4000-8000-000000000002', true);
insert into public.lessons (unit_id, course_id, slug, position, title) values ('b8800000-0000-4000-8000-0000000000e1', 'b8800000-0000-4000-8000-0000000000c1', 'b88-nueva', 9, 'Nueva');
update public.lessons set title = 'Editada' where slug = 'b88-l1';
select set_config('request.jwt.claims', '{"sub":"b8800000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8800000-0000-4000-8000-000000000003', true);
do $$ declare n integer; begin
  if (select count(*) from public.lessons where slug like 'b88-%') <> 7 then raise exception 'FALLO: un profesor no ve todas las lecciones'; end if;
  update public.lessons set title = 'Ajena' where slug = 'b88-l1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: un profesor ajeno editó una lección'; end if;
  begin
    insert into public.concepts (course_id, slug, name) values ('b8800000-0000-4000-8000-0000000000c1', 'b88-c9', 'x');
    raise exception 'FALLO: un profesor ajeno creó un concepto';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if (select title from public.lessons where slug = 'b88-l1') <> 'Editada' then raise exception 'FALLO: el personal del curso no pudo editar'; end if;
end $$;

select 'RLS PERMISOS UNA VEZ: PRUEBAS PASARON' as resultado;
rollback;
