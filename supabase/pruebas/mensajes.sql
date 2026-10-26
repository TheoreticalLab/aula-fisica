-- Pruebas: Centro de Comunicación en Vivo (migración 14). Transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de000000-0000-4000-8000-000000000001', 'mpa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-msg-a","aula_role":"teacher"}', '{}', now(), now()),
  ('de000000-0000-4000-8000-000000000002', 'mpb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-msg-b","aula_role":"teacher"}', '{}', now(), now()),
  ('de000000-0000-4000-8000-000000000011', 'me1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-msg-1"}', '{}', now(), now()),
  ('de000000-0000-4000-8000-000000000012', 'me2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-msg-2"}', '{}', now(), now()),
  ('de000000-0000-4000-8000-000000000013', 'me3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-msg-3"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'de000000-%';
update public.profiles set full_name = 'Prof. A' where id = 'de000000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de000000-0000-4000-8000-000000000021', 'Curso mensajes');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de000000-0000-4000-8000-000000000031', 'de000000-0000-4000-8000-000000000021', 'Sección M1', 'MENSAJA2', 'de000000-0000-4000-8000-000000000001'),
  ('de000000-0000-4000-8000-000000000032', 'de000000-0000-4000-8000-000000000021', 'Sección M2', 'MENSAJB2', 'de000000-0000-4000-8000-000000000002');
insert into public.enrollments (class_id, user_id) values
  ('de000000-0000-4000-8000-000000000031', 'de000000-0000-4000-8000-000000000011'),
  ('de000000-0000-4000-8000-000000000031', 'de000000-0000-4000-8000-000000000012'),
  ('de000000-0000-4000-8000-000000000032', 'de000000-0000-4000-8000-000000000013');
create temporary table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;

-- ===== un estudiante no puede enviar ni escribir registros =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000011', true);
do $$ begin
  begin
    perform public.send_live_message('urgente', 'Mensaje falso', 'todos', null, null, 60);
    raise exception 'FALLO: un estudiante envió un mensaje';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.live_messages (sender_id, kind, body) values ('de000000-0000-4000-8000-000000000001', 'urgente', 'Suplantación');
    raise exception 'FALLO: un estudiante insertó un mensaje haciéndose pasar por el profesor';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== profesor A =====
select set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000001', true);
do $$
declare r jsonb;
begin
  -- individual: el estudiante repetido no se duplica y el de otra sección (no autorizado) se descarta
  r := public.send_live_message('importante', 'Revisar el ejercicio 4', 'seleccion',
    array['de000000-0000-4000-8000-000000000011', 'de000000-0000-4000-8000-000000000011', 'de000000-0000-4000-8000-000000000013']::uuid[], null, 1440);
  if (r ->> 'recipients')::int <> 1 then raise exception 'FALLO: destinatarios del mensaje individual = %', r; end if;
  insert into ids values ('privado', (r ->> 'id')::uuid);
  -- colectivo: todos sus estudiantes (2), no los de la otra sección
  r := public.send_live_message('informativo', 'Aviso general', 'todos', null, null, null);
  if (r ->> 'recipients')::int <> 2 then raise exception 'FALLO: destinatarios del aviso general = %', r; end if;
  insert into ids values ('general', (r ->> 'id')::uuid);
  -- uno que caducará
  r := public.send_live_message('urgente', 'Vence pronto', 'seccion', null, 'de000000-0000-4000-8000-000000000031', 1);
  insert into ids values ('vence', (r ->> 'id')::uuid);
  -- no puede escribir a una sección que no imparte
  begin
    perform public.send_live_message('importante', 'x', 'seccion', null, 'de000000-0000-4000-8000-000000000032', 60);
    raise exception 'FALLO: escribió a una sección ajena';
  exception when insufficient_privilege then null;
  end;
  -- ni enviar solo a no autorizados
  begin
    perform public.send_live_message('importante', 'x', 'seleccion', array['de000000-0000-4000-8000-000000000013']::uuid[], null, 60);
    raise exception 'FALLO: envió a un estudiante que no enseña';
  exception when raise_exception then
    if sqlerrm not like 'Ningún destinatario%' then raise; end if;
  end;
end $$;

reset role;
update public.live_messages set expires_at = now() - interval '1 second' where id = (select v from ids where k = 'vence');

-- ===== estudiante 1 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000011', true);
do $$
declare v_priv uuid := (select v from ids where k = 'privado'); v_read timestamptz;
begin
  -- pendientes: el privado y el general (el caducado no)
  if (select count(*) from public.my_pending_messages()) <> 2 then raise exception 'FALLO: pendientes del estudiante 1 = %', (select count(*) from public.my_pending_messages()); end if;
  if (select sender_name from public.my_pending_messages() where id = v_priv) <> 'Prof. A' then raise exception 'FALLO: remitente'; end if;
  -- solo ve sus propias filas de entrega
  if exists (select 1 from public.live_message_recipients where user_id <> auth.uid()) then raise exception 'FALLO: ve entregas ajenas'; end if;
  -- recepción técnica: una sola vez
  if public.mark_messages_delivered(array[v_priv]) <> 1 then raise exception 'FALLO: no marcó la recepción'; end if;
  if public.mark_messages_delivered(array[v_priv]) <> 0 then raise exception 'FALLO: reescribió la recepción'; end if;
  -- recibir no es leer
  if (select read_at from public.live_message_recipients where message_id = v_priv) is not null then raise exception 'FALLO: marcó leído al entregar'; end if;
  -- no puede modificar su fila directamente
  begin
    update public.live_message_recipients set read_at = now() - interval '1 day' where message_id = v_priv;
    raise exception 'FALLO: modificó su registro de entrega directamente';
  exception when insufficient_privilege then null;
  end;
  -- confirma la lectura; confirmarla otra vez no cambia la hora
  perform public.ack_live_message(v_priv, 'leido');
  select read_at into v_read from public.live_message_recipients where message_id = v_priv;
  perform public.ack_live_message(v_priv, 'leido');
  if v_read is null or v_read <> (select read_at from public.live_message_recipients where message_id = v_priv) then raise exception 'FALLO: confirmación de lectura'; end if;
  -- el informativo se cierra sin confirmar
  perform public.ack_live_message((select v from ids where k = 'general'), 'descartado');
  if (select count(*) from public.my_pending_messages()) <> 0 then raise exception 'FALLO: quedan pendientes tras responder'; end if;
end $$;

-- ===== estudiante 2: no ve el mensaje privado ni puede tocar el registro del estudiante 1 =====
select set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000012', true);
do $$
declare v_priv uuid := (select v from ids where k = 'privado');
begin
  if exists (select 1 from public.live_messages where id = v_priv) then raise exception 'FALLO: el estudiante 2 leyó un mensaje privado ajeno'; end if;
  if (select count(*) from public.my_pending_messages()) <> 1 then raise exception 'FALLO: pendientes del estudiante 2'; end if;
  if public.mark_messages_delivered(array[v_priv]) <> 0 then raise exception 'FALLO: marcó la entrega de otro estudiante'; end if;
  begin
    perform public.ack_live_message(v_priv, 'leido');
    raise exception 'FALLO: confirmó un mensaje ajeno';
  exception when no_data_found then null;
  end;
end $$;

-- ===== profesor A ve los estados; el profesor B no ve los de A =====
select set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000001', true);
do $$ begin
  if (select estado from public.live_message_recipients_status((select v from ids where k = 'privado'))) <> 'confirmado' then raise exception 'FALLO: estado confirmado'; end if;
  if (select confirmados from public.live_message_history(null, 50) where id = (select v from ids where k = 'privado')) <> 1 then raise exception 'FALLO: historial'; end if;
  if (select expirados from public.live_message_history(null, 50) where id = (select v from ids where k = 'vence')) <> 2 then raise exception 'FALLO: expirados'; end if;
  if (select count(*) from public.live_presence()) <> 2 then raise exception 'FALLO: presencia (sus 2 estudiantes)'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000002', true);
do $$ begin
  if exists (select 1 from public.live_message_recipients_status((select v from ids where k = 'privado'))) then raise exception 'FALLO: el profesor B vio entregas de los estudiantes de A'; end if;
  if exists (select 1 from public.live_message_history(null, 50)) then raise exception 'FALLO: el profesor B vio el historial de A'; end if;
  if exists (select 1 from public.live_message_recipients) then raise exception 'FALLO: el profesor B leyó entregas ajenas'; end if;
end $$;

-- un estudiante no consulta presencia ni historiales
select set_config('request.jwt.claims', '{"sub":"de000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000011', true);
do $$ begin
  if exists (select 1 from public.live_presence()) then raise exception 'FALLO: un estudiante vio la presencia'; end if;
  if exists (select 1 from public.live_message_history(null, 50)) then raise exception 'FALLO: un estudiante vio el historial'; end if;
  if exists (select 1 from public.my_messageable_students()) then raise exception 'FALLO: un estudiante vio la lista de estudiantes'; end if;
end $$;

reset role;
select 'PRUEBAS DE MENSAJES EN VIVO PASARON' as resultado;
rollback;
