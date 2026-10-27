-- Pruebas: presencia y Orbe Control (migración 18). Transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d2000000-0000-4000-8000-000000000001', 'op@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-orbe","aula_role":"teacher"}', '{}', now(), now()),
  ('d2000000-0000-4000-8000-000000000002', 'oq@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-otro","aula_role":"teacher"}', '{}', now(), now()),
  ('d2000000-0000-4000-8000-000000000011', 'o1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-orbe-1"}', '{}', now(), now()),
  ('d2000000-0000-4000-8000-000000000012', 'o2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-orbe-2"}', '{}', now(), now()),
  ('d2000000-0000-4000-8000-000000000013', 'o3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-orbe-3"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'd2000000-%';
insert into public.courses (id, title) values ('d2000000-0000-4000-8000-000000000021', 'Curso Orbe');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d2000000-0000-4000-8000-000000000031', 'd2000000-0000-4000-8000-000000000021', 'Sección O1', 'ORBEONE2', 'd2000000-0000-4000-8000-000000000001'),
  ('d2000000-0000-4000-8000-000000000032', 'd2000000-0000-4000-8000-000000000021', 'Sección O2', 'ORBETWO2', 'd2000000-0000-4000-8000-000000000002');
insert into public.enrollments (class_id, user_id) values
  ('d2000000-0000-4000-8000-000000000031', 'd2000000-0000-4000-8000-000000000011'),
  ('d2000000-0000-4000-8000-000000000031', 'd2000000-0000-4000-8000-000000000012'),
  ('d2000000-0000-4000-8000-000000000032', 'd2000000-0000-4000-8000-000000000013');

-- estudiante 1: dos pestañas (o dispositivos)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000011', true);
do $$ begin
  perform public.presence_ping('d2000000-0000-4000-8000-0000000000c1', true);
  perform public.presence_ping('d2000000-0000-4000-8000-0000000000c2', false);
  perform public.presence_ping('d2000000-0000-4000-8000-0000000000c1', true);   -- latido repetido: misma fila
  -- no puede leer la presencia ni la lista de conectados
  if exists (select 1 from public.presence_connections) then raise exception 'FALLO: un estudiante leyó la presencia'; end if;
  if exists (select 1 from public.control_online()) then raise exception 'FALLO: un estudiante vio a los conectados'; end if;
  if (public.control_access() ->> 'ok')::boolean then raise exception 'FALLO: un estudiante tiene acceso a Orbe Control'; end if;
  begin
    perform public.send_live_message_online('urgente', 'falso', null, 60);
    raise exception 'FALLO: un estudiante envió a los conectados';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.presence_connections (conn_id, user_id) values (gen_random_uuid(), 'd2000000-0000-4000-8000-000000000012');
    raise exception 'FALLO: registró la presencia de otro estudiante';
  exception when insufficient_privilege then null;
  end;
end $$;

-- estudiante 2 no puede apropiarse de una conexión del estudiante 1
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000012', true);
do $$ begin
  begin
    perform public.presence_ping('d2000000-0000-4000-8000-0000000000c1', true);
    raise exception 'FALLO: usó la conexión de otro estudiante';
  exception when insufficient_privilege then null;
  end;
  perform public.presence_ping('d2000000-0000-4000-8000-0000000000c3', true);
end $$;
-- estudiante 3 (sección del otro profesor)
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000013', true);
select public.presence_ping('d2000000-0000-4000-8000-0000000000c4', true);

-- profesor: ve a sus 2 estudiantes en línea, una sola vez cada uno
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000001', true);
do $$
declare r jsonb;
begin
  if not (public.control_access() ->> 'ok')::boolean then raise exception 'FALLO: el profesor no tiene acceso'; end if;
  if (select count(*) from public.control_online()) <> 2 then raise exception 'FALLO: conectados = % (esperado 2)', (select count(*) from public.control_online()); end if;
  if (select conexiones from public.control_online() where user_id = 'd2000000-0000-4000-8000-000000000011') <> 2 then raise exception 'FALLO: conexiones del estudiante 1'; end if;
  if (select count(*) from public.presence_connections) <> 3 then raise exception 'FALLO: el profesor ve conexiones que no son de sus estudiantes'; end if;
  -- mensaje a los conectados: destinatarios del servidor, uno por estudiante
  r := public.send_live_message_online('importante', 'Revisen el ejercicio 3', null, 60);
  if (r ->> 'recipients')::int <> 2 then raise exception 'FALLO: destinatarios del mensaje a conectados = %', r; end if;
  -- el profesor tampoco se registra como conectado
  if (public.presence_ping(gen_random_uuid(), true) ->> 'tracked')::boolean then raise exception 'FALLO: registró la presencia del profesor'; end if;
end $$;

-- caducidad: sin señal en 75 s el estudiante deja de estar en línea; cerrar la pestaña borra la conexión
reset role;
update public.presence_connections set last_seen = now() - interval '2 minutes' where user_id = 'd2000000-0000-4000-8000-000000000012';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000011', true);
select public.presence_leave('d2000000-0000-4000-8000-0000000000c2');
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000001', true);
do $$ begin
  if (select count(*) from public.control_online()) <> 1 then raise exception 'FALLO: el estudiante caducado sigue en línea'; end if;
  if (select conexiones from public.control_online()) <> 1 then raise exception 'FALLO: la pestaña cerrada sigue contando'; end if;
  begin
    perform public.send_live_message_online('importante', 'x', 'd2000000-0000-4000-8000-000000000032', 60);
    raise exception 'FALLO: envió a los conectados de una sección ajena';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;

reset role;
select 'PRUEBAS DE PRESENCIA PASARON' as resultado;
rollback;
