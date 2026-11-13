-- Pruebas: calculadora científica integrada (migración 93). Se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ca930000-0000-4000-8000-000000000001', 'calc-p@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-calc","aula_role":"teacher"}', '{}', now(), now()),
  ('ca930000-0000-4000-8000-000000000011', 'calc-1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-calc-1"}', '{}', now(), now()),
  ('ca930000-0000-4000-8000-000000000012', 'calc-2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-calc-2"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'ca930000-%';
update public.profiles set role = 'teacher' where id = 'ca930000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('ca930000-0000-4000-8000-000000000021', 'Curso calculadora');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ca930000-0000-4000-8000-000000000031', 'ca930000-0000-4000-8000-000000000021', 'Sección calculadora', 'CALCUL01', 'ca930000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('ca930000-0000-4000-8000-000000000031', 'ca930000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('ca930000-0000-4000-8000-000000000031', 'ca930000-0000-4000-8000-000000000011');
insert into public.activities (id, class_id, title, mode, reveal_policy, hints_enabled, published) values
  ('ca930000-0000-4000-8000-000000000041', 'ca930000-0000-4000-8000-000000000031', 'Examen', 'exam', 'after_submit', false, true);

-- 1) nace apagada, y ninguna actividad existente quedó con la calculadora activada por la migración
do $$ begin
  if (select calculadora from public.activities where id = 'ca930000-0000-4000-8000-000000000041') then raise exception 'FALLO: debía nacer apagada'; end if;
  if (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'activities' and column_name = 'calculadora') <> 'NO' then
    raise exception 'FALLO: la columna admite nulos';
  end if;
end $$;

set local role authenticated;

-- 2) el profesor de la sección la activa con su permiso normal de edición
select set_config('request.jwt.claims', '{"sub":"ca930000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ca930000-0000-4000-8000-000000000001', true);
update public.activities set calculadora = true where id = 'ca930000-0000-4000-8000-000000000041';
do $$ begin
  if not (select calculadora from public.activities where id = 'ca930000-0000-4000-8000-000000000041') then raise exception 'FALLO: el profesor no pudo activarla'; end if;
end $$;

-- 3) el estudiante inscrito lee el permiso, pero no puede cambiarlo
select set_config('request.jwt.claims', '{"sub":"ca930000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ca930000-0000-4000-8000-000000000011', true);
do $$ begin
  if not coalesce((select calculadora from public.activities where id = 'ca930000-0000-4000-8000-000000000041'), false) then raise exception 'FALLO: el inscrito no lee el permiso'; end if;
end $$;
update public.activities set calculadora = false where id = 'ca930000-0000-4000-8000-000000000041';

-- 4) quien no está inscrito no ve la actividad
select set_config('request.jwt.claims', '{"sub":"ca930000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ca930000-0000-4000-8000-000000000012', true);
do $$ begin
  if exists (select 1 from public.activities where id = 'ca930000-0000-4000-8000-000000000041') then raise exception 'FALLO: un no inscrito ve la actividad'; end if;
end $$;

reset role;
do $$ begin
  if not (select calculadora from public.activities where id = 'ca930000-0000-4000-8000-000000000041') then raise exception 'FALLO: el estudiante desactivó la calculadora'; end if;
end $$;

select 'PRUEBAS DE LA CALCULADORA INTEGRADA PASARON' as resultado;
rollback;
