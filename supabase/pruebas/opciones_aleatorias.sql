-- Pruebas: orden aleatorio de opciones (migración 50). Se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ed000000-0000-4000-8000-000000000001', 'oa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-opciones","aula_role":"teacher"}', '{}', now(), now()),
  ('ed000000-0000-4000-8000-000000000011', 'o1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-opc-1"}', '{}', now(), now()),
  ('ed000000-0000-4000-8000-000000000012', 'o2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-opc-2"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'ed000000-%';
update public.profiles set role = 'teacher' where id = 'ed000000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('ed000000-0000-4000-8000-000000000021', 'Curso opciones');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ed000000-0000-4000-8000-000000000031', 'ed000000-0000-4000-8000-000000000021', 'Sección opciones', 'OPCION01', 'ed000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('ed000000-0000-4000-8000-000000000031', 'ed000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('ed000000-0000-4000-8000-000000000031', 'ed000000-0000-4000-8000-000000000011');
insert into public.activities (id, class_id, title, mode, published) values
  ('ed000000-0000-4000-8000-000000000041', 'ed000000-0000-4000-8000-000000000031', 'Práctica', 'practice', true);

do $$ begin
  if (select shuffle_options from public.activities where id = 'ed000000-0000-4000-8000-000000000041') then raise exception 'FALLO: debía nacer apagado'; end if;
end $$;
update public.activities set shuffle_options = true where id = 'ed000000-0000-4000-8000-000000000041';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ed000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ed000000-0000-4000-8000-000000000011', true);
do $$ begin
  if not public.opciones_aleatorias('ed000000-0000-4000-8000-000000000041') then raise exception 'FALLO: el inscrito no lo ve'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"ed000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ed000000-0000-4000-8000-000000000012', true);
do $$ begin
  if public.opciones_aleatorias('ed000000-0000-4000-8000-000000000041') then raise exception 'FALLO: un no inscrito obtuvo el dato'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"ed000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ed000000-0000-4000-8000-000000000001', true);
do $$ begin
  if not public.opciones_aleatorias('ed000000-0000-4000-8000-000000000041') then raise exception 'FALLO: el profesor no lo ve'; end if;
end $$;

select 'PRUEBAS DE OPCIONES ALEATORIAS PASARON' as resultado;
rollback;
