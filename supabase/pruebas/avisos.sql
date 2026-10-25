-- Pruebas: avisos por sección (migración 9). Transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d9000000-0000-4000-8000-000000000001', 'p9@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-av","aula_role":"teacher"}', '{}', now(), now()),
  ('d9000000-0000-4000-8000-000000000002', 'e9@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-av-1"}', '{}', now(), now()),
  ('d9000000-0000-4000-8000-000000000003', 'f9@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-av-2"}', '{}', now(), now());
update public.profiles set must_change_password = false
  where id in ('d9000000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000002', 'd9000000-0000-4000-8000-000000000003');
insert into public.courses (id, title) values ('d9000000-0000-4000-8000-000000000011', 'Curso avisos');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d9000000-0000-4000-8000-000000000021', 'd9000000-0000-4000-8000-000000000011', 'Sección A', 'AVISOSA2', 'd9000000-0000-4000-8000-000000000001'),
  ('d9000000-0000-4000-8000-000000000022', 'd9000000-0000-4000-8000-000000000011', 'Sección B', 'AVISOSB2', null);
insert into public.enrollments (class_id, user_id) values
  ('d9000000-0000-4000-8000-000000000021', 'd9000000-0000-4000-8000-000000000002'),
  ('d9000000-0000-4000-8000-000000000022', 'd9000000-0000-4000-8000-000000000003');

-- el profesor publica en su sección; no puede publicar en una ajena
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000001', true);
insert into public.announcements (class_id, title, body, pinned) values ('d9000000-0000-4000-8000-000000000021', 'Examen el lunes', 'Repasen MRU.', true);
do $$ begin
  begin
    insert into public.announcements (class_id, title) values ('d9000000-0000-4000-8000-000000000022', 'Intruso');
    raise exception 'FALLO: un profesor publicó en una sección ajena';
  exception when insufficient_privilege then null;
  end;
end $$;

-- el estudiante de la sección A lo ve; el de la B no
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000002', true);
do $$ begin
  if jsonb_array_length(public.my_announcements()) <> 1 then raise exception 'FALLO: el estudiante de la sección no ve el aviso'; end if;
  begin
    insert into public.announcements (class_id, title) values ('d9000000-0000-4000-8000-000000000021', 'Falso');
    raise exception 'FALLO: un estudiante publicó un aviso';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000003', true);
do $$ begin
  if jsonb_array_length(public.my_announcements()) <> 0 or exists (select 1 from public.announcements) then
    raise exception 'FALLO: un estudiante de otra sección ve el aviso';
  end if;
end $$;

reset role;
rollback;
select 'PRUEBAS DE AVISOS PASARON' as resultado;
