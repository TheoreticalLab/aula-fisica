-- Pruebas: «Aviso del aula» (migración 57): mensaje neutro, sin el nombre del profesor. Se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de570000-0000-4000-8000-000000000001', 'av1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-aviso","aula_role":"teacher"}', '{}', now(), now()),
  ('de570000-0000-4000-8000-000000000011', 'av11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-aviso-1"}', '{}', now(), now()),
  ('de570000-0000-4000-8000-000000000012', 'av12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-aviso-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de570000-%';
update public.profiles set role = 'teacher', full_name = 'Prof. Aviso' where id = 'de570000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de570000-0000-4000-8000-000000000021', 'Curso aviso');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de570000-0000-4000-8000-000000000031', 'de570000-0000-4000-8000-000000000021', 'Sección aviso', 'AVISOA01', 'de570000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de570000-0000-4000-8000-000000000031', 'de570000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de570000-0000-4000-8000-000000000031', 'de570000-0000-4000-8000-000000000011'), ('de570000-0000-4000-8000-000000000031', 'de570000-0000-4000-8000-000000000012');

-- 1) un estudiante no puede enviar avisos del aula
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de570000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de570000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.send_live_message_aula('urgente', 'falso', 'todos', null, null, 60); raise exception 'FALLO: un estudiante envió un aviso';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) el profesor envía un aviso del aula a un estudiante y un mensaje normal a otro
select set_config('request.jwt.claims', '{"sub":"de570000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de570000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.send_live_message_aula('urgente', 'Veo que tienes tus respuestas guardadas pero no has avanzado. ¿Necesitas ayuda?', 'seleccion',
    array['de570000-0000-4000-8000-000000000011'::uuid], null, 60);
  if (r ->> 'recipients')::int <> 1 then raise exception 'FALLO: destinatarios del aviso %', r; end if;
  r := public.send_live_message('informativo', 'Mensaje normal', 'seleccion', array['de570000-0000-4000-8000-000000000012'::uuid], null, 60);
  if (r ->> 'recipients')::int <> 1 then raise exception 'FALLO: mensaje normal %', r; end if;
end $$;

-- 3) el estudiante 1 ve un aviso del aula SIN el nombre del profesor (en las dos versiones de la consulta)
select set_config('request.jwt.claims', '{"sub":"de570000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de570000-0000-4000-8000-000000000011', true);
do $$ declare m record; begin
  select * into m from public.my_pending_messages_v2();
  if m.remitente <> 'aula' or m.sender_name is not null or m.kind <> 'urgente' then raise exception 'FALLO: aviso del aula visto como % / %', m.remitente, m.sender_name; end if;
  select * into m from public.my_pending_messages();
  if m.sender_name <> 'Aula virtual' then raise exception 'FALLO: la consulta anterior revela el remitente: %', m.sender_name; end if;
end $$;

-- 4) el estudiante 2 ve el mensaje normal como del profesor, como siempre
select set_config('request.jwt.claims', '{"sub":"de570000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de570000-0000-4000-8000-000000000012', true);
do $$ declare m record; begin
  select * into m from public.my_pending_messages_v2();
  if m.remitente <> 'profesor' or m.sender_name <> 'Prof. Aviso' then raise exception 'FALLO: mensaje normal visto como % / %', m.remitente, m.sender_name; end if;
end $$;
reset role;

select 'aviso_del_aula.sql: PRUEBAS PASARON' as resultado;
rollback;
