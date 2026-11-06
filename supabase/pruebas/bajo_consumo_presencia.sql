-- Pruebas: modo de bajo consumo en la presencia (migración 87). Transacción que se deshace al final.
--  · presence_ping no escribe un latido duplicado (misma visibilidad, señal de < 5 s); un latido del aula anterior
--    (25 s) sigue escribiendo; sigue rechazando conexiones ajenas.
--  · inactividad_registrar_uso no toca la fila si el uso es reciente (< 5 min) y sí la actualiza si es antiguo.
--  · control_online / live_presence: caducidad de 150 s.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('b8700000-0000-4000-8000-000000000001', 'b87p@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b87-prof","aula_role":"teacher"}', '{}', now(), now()),
  ('b8700000-0000-4000-8000-000000000011', 'b87a@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b87-est-a"}', '{}', now(), now()),
  ('b8700000-0000-4000-8000-000000000012', 'b87b@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b87-est-b"}', '{}', now(), now()),
  ('b8700000-0000-4000-8000-000000000013', 'b87c@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"b87-est-c"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'b8700000-%';
insert into public.courses (id, title) values ('b8700000-0000-4000-8000-000000000021', 'Curso bajo consumo');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('b8700000-0000-4000-8000-000000000031', 'b8700000-0000-4000-8000-000000000021', 'Sección B87', 'BAJO0087', 'b8700000-0000-4000-8000-000000000001');
insert into public.enrollments (class_id, user_id) values
  ('b8700000-0000-4000-8000-000000000031', 'b8700000-0000-4000-8000-000000000011'),
  ('b8700000-0000-4000-8000-000000000031', 'b8700000-0000-4000-8000-000000000012'),
  ('b8700000-0000-4000-8000-000000000031', 'b8700000-0000-4000-8000-000000000013');

create temporary table b87_marca (paso text primary key, ctid_txt text, visible boolean, last_seen timestamptz) on commit drop;
grant all on b87_marca to authenticated;

-- 1) Latidos del estudiante A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b8700000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8700000-0000-4000-8000-000000000011', true);
select set_config('request.path', '/rpc/presence_ping', true);
select public.presence_ping('b8700000-0000-4000-8000-0000000000c1', true);
reset role;
-- la «última señal» se envejece 2 s: un latido duplicado NO debe escribir (ni last_seen ni versión nueva de la fila)
update public.presence_connections set last_seen = now() - interval '2 seconds' where conn_id = 'b8700000-0000-4000-8000-0000000000c1';
insert into b87_marca select 'antes', ctid::text, visible, last_seen from public.presence_connections where conn_id = 'b8700000-0000-4000-8000-0000000000c1';
set local role authenticated;
select public.presence_ping('b8700000-0000-4000-8000-0000000000c1', true);
reset role;
do $$ declare a b87_marca; d record; begin
  select * into a from b87_marca where paso = 'antes';
  select ctid::text c, visible, last_seen into d from public.presence_connections where conn_id = 'b8700000-0000-4000-8000-0000000000c1';
  if d.c <> a.ctid_txt or d.last_seen <> a.last_seen then raise exception 'FALLO: un latido duplicado (2 s, misma visibilidad) escribió la fila'; end if;
end $$;

-- cambio de visibilidad: sí escribe al momento
set local role authenticated;
select public.presence_ping('b8700000-0000-4000-8000-0000000000c1', false);
reset role;
do $$ begin
  if (select visible from public.presence_connections where conn_id = 'b8700000-0000-4000-8000-0000000000c1') then
    raise exception 'FALLO: el cambio a oculta no se guardó';
  end if;
  if (select last_seen from public.presence_connections where conn_id = 'b8700000-0000-4000-8000-0000000000c1') < now() - interval '1 second' then
    raise exception 'FALLO: el cambio de visibilidad no renovó la señal';
  end if;
end $$;

-- latido del aula ANTERIOR (cada 25 s): debe seguir renovando la señal (compatibilidad durante el despliegue: el Orbe
-- Control anterior caduca a los 75 s y no debe ver desconexiones falsas)
update public.presence_connections set last_seen = now() - interval '25 seconds' where conn_id = 'b8700000-0000-4000-8000-0000000000c1';
set local role authenticated;
select public.presence_ping('b8700000-0000-4000-8000-0000000000c1', false);
reset role;
do $$ begin
  if (select last_seen from public.presence_connections where conn_id = 'b8700000-0000-4000-8000-0000000000c1') < now() - interval '1 second' then
    raise exception 'FALLO: un latido de 25 s (aula anterior) no renovó la señal';
  end if;
end $$;
-- y uno a los 6 s (justo por encima del umbral de duplicado), también
update public.presence_connections set last_seen = now() - interval '6 seconds' where conn_id = 'b8700000-0000-4000-8000-0000000000c1';
set local role authenticated;
select public.presence_ping('b8700000-0000-4000-8000-0000000000c1', false);
reset role;
do $$ begin
  if (select last_seen from public.presence_connections where conn_id = 'b8700000-0000-4000-8000-0000000000c1') < now() - interval '1 second' then
    raise exception 'FALLO: un latido a los 6 s no renovó la señal';
  end if;
end $$;

-- conexiones viejas (> 10 min) del mismo estudiante: se borran al abrir una conexión nueva
insert into public.presence_connections (conn_id, user_id, visible, last_seen) values
  ('b8700000-0000-4000-8000-0000000000c9', 'b8700000-0000-4000-8000-000000000011', true, now() - interval '20 minutes');
set local role authenticated;
select public.presence_ping('b8700000-0000-4000-8000-0000000000c2', true);

-- 2) el estudiante B no puede usar una conexión de A (con o sin escritura)
select set_config('request.jwt.claims', '{"sub":"b8700000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8700000-0000-4000-8000-000000000012', true);
do $$ begin
  begin
    perform public.presence_ping('b8700000-0000-4000-8000-0000000000c1', false);
    raise exception 'FALLO: usó la conexión de otro estudiante';
  exception when insufficient_privilege then null;
  end;
end $$;
select public.presence_ping('b8700000-0000-4000-8000-0000000000c3', true);
reset role;
do $$ begin
  if exists (select 1 from public.presence_connections where conn_id = 'b8700000-0000-4000-8000-0000000000c9') then
    raise exception 'FALLO: no se borró la conexión vieja al abrir otra';
  end if;
  if (select user_id from public.presence_connections where conn_id = 'b8700000-0000-4000-8000-0000000000c1') <> 'b8700000-0000-4000-8000-000000000011' then
    raise exception 'FALLO: la conexión cambió de dueño';
  end if;
end $$;

-- 3) Registro de uso (inactividad): sin escritura si es reciente; actualiza si es antiguo; inserta si no existe
delete from public.cuenta_actividad where user_id::text like 'b8700000-%';
insert into public.cuenta_actividad (user_id, ultimo_uso) values
  ('b8700000-0000-4000-8000-000000000011', now() - interval '2 minutes'),
  ('b8700000-0000-4000-8000-000000000012', now() - interval '20 minutes');
truncate b87_marca;
insert into b87_marca select 'uso', ctid::text, null, ultimo_uso from public.cuenta_actividad where user_id = 'b8700000-0000-4000-8000-000000000011';
select public.inactividad_registrar_uso('b8700000-0000-4000-8000-000000000011');
select public.inactividad_registrar_uso('b8700000-0000-4000-8000-000000000012');
select public.inactividad_registrar_uso('b8700000-0000-4000-8000-000000000013');
do $$ declare a b87_marca; begin
  select * into a from b87_marca where paso = 'uso';
  if (select ctid::text from public.cuenta_actividad where user_id = 'b8700000-0000-4000-8000-000000000011') <> a.ctid_txt
     or (select ultimo_uso from public.cuenta_actividad where user_id = 'b8700000-0000-4000-8000-000000000011') <> a.last_seen then
    raise exception 'FALLO: registró el uso aunque era reciente';
  end if;
  if (select ultimo_uso from public.cuenta_actividad where user_id = 'b8700000-0000-4000-8000-000000000012') < now() - interval '1 second' then
    raise exception 'FALLO: no actualizó un uso antiguo';
  end if;
  if not exists (select 1 from public.cuenta_actividad where user_id = 'b8700000-0000-4000-8000-000000000013') then
    raise exception 'FALLO: no registró el primer uso';
  end if;
end $$;

-- 4) Caducidad de 150 s en Orbe Control
update public.presence_connections set last_seen = now() - interval '100 seconds' where user_id = 'b8700000-0000-4000-8000-000000000011';
update public.presence_connections set last_seen = now() - interval '200 seconds' where user_id = 'b8700000-0000-4000-8000-000000000012';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b8700000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8700000-0000-4000-8000-000000000001', true);
do $$ begin
  if not exists (select 1 from public.control_online() where user_id = 'b8700000-0000-4000-8000-000000000011') then
    raise exception 'FALLO: una señal de 100 s ya no cuenta como en línea';
  end if;
  if exists (select 1 from public.control_online() where user_id = 'b8700000-0000-4000-8000-000000000012') then
    raise exception 'FALLO: una señal de 200 s sigue en línea';
  end if;
  if (select estado from public.live_presence() where user_id = 'b8700000-0000-4000-8000-000000000012') <> 'desconectado' then
    raise exception 'FALLO: live_presence no caduca a los 150 s';
  end if;
  if (select estado from public.live_presence() where user_id = 'b8700000-0000-4000-8000-000000000011') = 'desconectado' then
    raise exception 'FALLO: live_presence caducó una señal de 100 s';
  end if;
end $$;
-- un estudiante sigue sin ver la lista de conectados
select set_config('request.jwt.claims', '{"sub":"b8700000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b8700000-0000-4000-8000-000000000013', true);
do $$ begin
  if exists (select 1 from public.control_online()) then raise exception 'FALLO: un estudiante vio a los conectados'; end if;
  begin perform public.inactividad_registrar_uso('b8700000-0000-4000-8000-000000000013'); raise exception 'FALLO: un estudiante llamó a inactividad_registrar_uso';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'BAJO CONSUMO · PRESENCIA: PRUEBAS PASARON' as resultado;
rollback;
