-- Pruebas: suspensión de cuentas de estudiantes por inactividad (migración 79). Se deshace al final.
-- Estudiantes: V (11 días sin uso), R (3 días), N (nunca usó, cuenta antigua), B (suspendida por el administrador y
-- bloqueada en Auth, 30 días sin uso). Profesor P (40 días sin uso). Administrador AD.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, encrypted_password) values
  ('de790000-0000-4000-8000-000000000001', 'si01@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-inact","aula_role":"teacher"}', '{}', now(), now(), 'h'),
  ('de790000-0000-4000-8000-000000000002', 'si02@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-inact"}', '{}', now(), now(), 'h'),
  ('de790000-0000-4000-8000-000000000011', 'si11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-in-v"}', '{}', now(), now(), 'h-v'),
  ('de790000-0000-4000-8000-000000000012', 'si12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-in-r"}', '{}', now(), now(), 'h'),
  ('de790000-0000-4000-8000-000000000013', 'si13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-in-n"}', '{}', now(), now(), 'h'),
  ('de790000-0000-4000-8000-000000000014', 'si14@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-in-b"}', '{}', now(), now(), 'h');
update public.profiles set must_change_password = false, active = true, created_at = now() - interval '60 days' where id::text like 'de790000-%';
update public.profiles set role = 'teacher' where id = 'de790000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin' where id = 'de790000-0000-4000-8000-000000000002';
update public.profiles set active = false, suspended_at = now() where id = 'de790000-0000-4000-8000-000000000014';
update auth.users set banned_until = now() + interval '100 years' where id = 'de790000-0000-4000-8000-000000000014';
insert into public.courses (id, title) values ('de790000-0000-4000-8000-000000000021', 'Curso inactividad');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de790000-0000-4000-8000-000000000031', 'de790000-0000-4000-8000-000000000021', 'Sección inactividad', 'INACTI01', 'de790000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de790000-0000-4000-8000-000000000031', 'de790000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'de790000-0000-4000-8000-000000000031', ('de790000-0000-4000-8000-00000000001' || g)::uuid from generate_series(1, 4) g;
insert into public.cuenta_actividad (user_id, ultimo_uso) values
  ('de790000-0000-4000-8000-000000000011', now() - interval '11 days'), ('de790000-0000-4000-8000-000000000012', now() - interval '3 days'),
  ('de790000-0000-4000-8000-000000000014', now() - interval '30 days'), ('de790000-0000-4000-8000-000000000001', now() - interval '40 days');
insert into auth.sessions (id, user_id, created_at) values
  ('de790000-0000-4000-8000-0000000002a1', 'de790000-0000-4000-8000-000000000002', now()),
  ('de790000-0000-4000-8000-0000000001a1', 'de790000-0000-4000-8000-000000000001', now());

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'session_id',
    case p_user when 'de790000-0000-4000-8000-000000000002' then 'de790000-0000-4000-8000-0000000002a1' else 'de790000-0000-4000-8000-0000000001a1' end)::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
  select set_config('request.path', '/rpc/prueba', true);   -- como una petición REST (el bloqueo solo se aplica a ellas)
$$;
create function pg_temp.h(p text) returns text language sql as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;
create temp table t (k text primary key, v jsonb);
grant all on t to authenticated, service_role;

-- 0) Apagado por defecto: nadie se suspende
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000011');
do $$ begin
  if not public.my_account_ok() then raise exception 'FALLO: bloqueado con la regla apagada'; end if;
  if (public.cuenta_presencia() ->> 'suspendida')::boolean then raise exception 'FALLO: suspendido con la regla apagada'; end if;
  begin perform 1 from public.cuenta_actividad; raise exception 'FALLO: leyó actividad por REST'; exception when insufficient_privilege then null; end;
  begin perform public.inactividad_configurar(true, 10); raise exception 'FALLO: estudiante configuró'; exception when insufficient_privilege then null; end;
  begin perform public.inactividad_lista(); raise exception 'FALLO: estudiante vio la lista'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.inactividad_configurar(true, 10); raise exception 'FALLO: profesor no admin configuró'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.inactividad_configurar(true, 2); raise exception 'FALLO: 2 días'; exception when invalid_parameter_value then null; end;
  perform public.inactividad_configurar(true, 10);
end $$;
reset role;

-- 1) Recién activada: todos tienen 10 días desde la activación (nadie cae el primer día)
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000011');
do $$ begin
  if not public.my_account_ok() then raise exception 'FALLO: suspendido el primer día'; end if;
end $$;
reset role;
-- la regla se activó hace 12 días
update public.inactividad_config set activado_at = now() - interval '12 days' where id = 1;
-- (el uso de V de hoy se borra: la prueba anterior lo registró)
update public.cuenta_actividad set ultimo_uso = now() - interval '11 days' where user_id = 'de790000-0000-4000-8000-000000000011';

-- 2) Plazo vencido: deja de estar habilitada en las peticiones REST; profesores nunca
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000011');
do $$ begin
  if public.my_account_ok() then raise exception 'FALLO: V sigue habilitado tras 11 días'; end if;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000012');
do $$ begin
  if not public.my_account_ok() then raise exception 'FALLO: R (3 días) bloqueado'; end if;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000013');
do $$ begin
  if public.my_account_ok() then raise exception 'FALLO: N (nunca usó) sigue habilitado'; end if;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000001');
do $$ begin
  if not public.is_teacher() then raise exception 'FALLO: profesor suspendido por inactividad'; end if;
end $$;
reset role;
do $$ begin
  -- fuera de REST (scripts, pruebas) no se aplica
  perform set_config('request.path', '', true);
  if not public.account_ok('de790000-0000-4000-8000-000000000011') then raise exception 'FALLO: bloqueó fuera de REST'; end if;
end $$;

-- 3) El latido de conexión de un bloqueado no registra uso; el de uno habilitado sí
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000011');
do $$ begin
  if (public.presence_ping(gen_random_uuid(), true) ->> 'tracked')::boolean then raise exception 'FALLO: latido de un bloqueado'; end if;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000012');
do $$ begin
  if not (public.presence_ping(gen_random_uuid(), true) ->> 'tracked')::boolean then raise exception 'FALLO: latido de R'; end if;
end $$;
reset role;
do $$ begin
  if (select ultimo_uso from public.cuenta_actividad where user_id = 'de790000-0000-4000-8000-000000000011') > now() - interval '10 days' then raise exception 'FALLO: registró uso de un bloqueado'; end if;
  if (select ultimo_uso from public.cuenta_actividad where user_id = 'de790000-0000-4000-8000-000000000012') < now() - interval '1 minute' then raise exception 'FALLO: el latido no registró el uso'; end if;
end $$;

-- 4) Al volver, cuenta_presencia marca la suspensión y lo explica
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000011');
do $$ declare r jsonb; begin
  r := public.cuenta_presencia();
  if not (r ->> 'suspendida')::boolean or r ->> 'motivo' <> 'inactividad' or (r ->> 'dias')::int <> 10 then raise exception 'FALLO: presencia: %', r; end if;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000012');
do $$ declare r jsonb; begin
  r := public.cuenta_presencia();
  if (r ->> 'suspendida')::boolean or (r ->> 'regla')::int <> 10 then raise exception 'FALLO: R: %', r; end if;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000014');
do $$ declare r jsonb; begin
  r := public.cuenta_presencia();
  if r ->> 'motivo' <> 'profesor' then raise exception 'FALLO: B debe figurar suspendida por el profesor: %', r; end if;
end $$;
reset role;
do $$ begin
  if (select active from public.profiles where id = 'de790000-0000-4000-8000-000000000011') then raise exception 'FALLO: V no quedó suspendido'; end if;
  if not exists (select 1 from public.cuenta_suspensiones where user_id = 'de790000-0000-4000-8000-000000000011' and reactivada_at is null and dias = 10) then raise exception 'FALLO: sin registro de suspensión'; end if;
  if exists (select 1 from public.cuenta_suspensiones where user_id = 'de790000-0000-4000-8000-000000000014') then raise exception 'FALLO: B no se suspende por inactividad (ya estaba suspendida)'; end if;
end $$;

-- 5) El administrador ve la lista y aplica las vencidas pendientes de marcar (N); el profesor no aplica
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.inactividad_aplicar(); raise exception 'FALLO: el profesor aplicó'; exception when insufficient_privilege then null; end;
  if (select estado from public.inactividad_lista() where user_id = 'de790000-0000-4000-8000-000000000013') <> 'vencida' then raise exception 'FALLO: estado de N'; end if;
  if exists (select 1 from public.inactividad_lista() where user_id = 'de790000-0000-4000-8000-000000000001') then raise exception 'FALLO: profesores en la lista'; end if;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000002');
do $$ begin
  if public.inactividad_aplicar() <> 1 then raise exception 'FALLO: aplicar (debe marcar solo a N)'; end if;
  if (select estado from public.inactividad_lista() where user_id = 'de790000-0000-4000-8000-000000000011') <> 'suspendida_inactividad' then raise exception 'FALLO: estado de V'; end if;
  if (select estado from public.inactividad_lista() where user_id = 'de790000-0000-4000-8000-000000000014') <> 'suspendida' then raise exception 'FALLO: estado de B'; end if;
end $$;
reset role;

-- 6) Reactivación por el profesor de la sección: cierra la suspensión y reinicia el contador; no toca la de B
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000001');
do $$ begin
  if public.inactividad_reactivar(array['de790000-0000-4000-8000-000000000013', 'de790000-0000-4000-8000-000000000014']::uuid[]) <> 1 then
    raise exception 'FALLO: reactivar (solo N)';
  end if;
end $$;
select pg_temp.como('de790000-0000-4000-8000-000000000013');
do $$ begin
  if not public.my_account_ok() then raise exception 'FALLO: N sigue bloqueado tras reactivar'; end if;
end $$;
reset role;
do $$ begin
  if (select active from public.profiles where id = 'de790000-0000-4000-8000-000000000014') then raise exception 'FALLO: reactivó una suspensión del administrador'; end if;
  if not exists (select 1 from public.cuenta_suspensiones where user_id = 'de790000-0000-4000-8000-000000000013' and reactivada_via = 'profesor'
                 and reactivada_por = 'de790000-0000-4000-8000-000000000001') then raise exception 'FALLO: registro de la reactivación'; end if;
end $$;

-- 7) Reactivación con «Recuperar acceso» (presencial): V es elegible; B (suspendida por el administrador) no
update public.acceso_config set recuperacion = true where id = 1;
insert into public.acceso_secciones (class_id, recuperacion) values ('de790000-0000-4000-8000-000000000031', true);
set local role service_role;
do $$ begin
  insert into t values ('v', public.svc_acceso_solicitar('sint-in-v', 'profesor', pg_temp.h('sec-v'), 'ipv', '{}'));
  insert into t values ('b', public.svc_acceso_solicitar('sint-in-b', 'profesor', pg_temp.h('sec-b'), 'ipb', '{}'));
end $$;
reset role;
do $$ begin
  if not (select elegible from public.acceso_solicitudes where login_declarado = 'sint-in-v') then raise exception 'FALLO: V (inactividad) no elegible'; end if;
  if (select elegible from public.acceso_solicitudes where login_declarado = 'sint-in-b') then raise exception 'FALLO: B (administrador) elegible'; end if;
end $$;
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000001');
do $$ begin
  if not (public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 'v'), (select v ->> 'codigo' from t where k = 'v'), 'carnet') ->> 'ok')::boolean then
    raise exception 'FALLO: aprobación de V';
  end if;
end $$;
reset role;
set local role service_role;
do $$ begin
  if not (public.svc_acceso_canjear((select (v ->> 'id')::uuid from t where k = 'v'), pg_temp.h('sec-v'), 'ipv') ->> 'ok')::boolean then raise exception 'FALLO: canje de V'; end if;
end $$;
reset role;
do $$ begin
  if not (select active and must_change_password from public.profiles where id = 'de790000-0000-4000-8000-000000000011') then raise exception 'FALLO: V no reactivado (o sin contraseña nueva obligatoria)'; end if;
  if not exists (select 1 from public.cuenta_suspensiones where user_id = 'de790000-0000-4000-8000-000000000011' and reactivada_via = 'recuperacion') then raise exception 'FALLO: vía recuperación'; end if;
  if public.inactividad_vencida('de790000-0000-4000-8000-000000000011') then raise exception 'FALLO: el contador no se reinició'; end if;
end $$;

-- 8) La reactivación de Cuentas (admin-cuentas → svc_set_suspended) también reinicia el contador
update public.cuenta_actividad set ultimo_uso = now() - interval '20 days' where user_id = 'de790000-0000-4000-8000-000000000012';
do $$ begin
  perform public.inactividad_suspender('de790000-0000-4000-8000-000000000012');
  perform public.svc_set_suspended('de790000-0000-4000-8000-000000000002', 'de790000-0000-4000-8000-000000000012', false);
  if public.inactividad_vencida('de790000-0000-4000-8000-000000000012') then raise exception 'FALLO: reactivar en Cuentas no reinició el contador'; end if;
  if exists (select 1 from public.cuenta_suspensiones where user_id = 'de790000-0000-4000-8000-000000000012' and reactivada_at is null) then raise exception 'FALLO: suspensión abierta tras reactivar'; end if;
end $$;

-- 9) Pausar (vacaciones) y reanudar: todos vuelven a tener 10 días
update public.cuenta_actividad set ultimo_uso = now() - interval '15 days' where user_id = 'de790000-0000-4000-8000-000000000012';
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000002');
select public.inactividad_configurar(false);
reset role;
do $$ begin
  if public.inactividad_vencida('de790000-0000-4000-8000-000000000012') then raise exception 'FALLO: vencida con la regla en pausa'; end if;
end $$;
set local role authenticated;
select pg_temp.como('de790000-0000-4000-8000-000000000002');
select public.inactividad_configurar(true);
reset role;
do $$ begin
  if public.inactividad_vencida('de790000-0000-4000-8000-000000000012') then raise exception 'FALLO: al reanudar no hay 10 días nuevos'; end if;
end $$;

select 'PRUEBAS DE SUSPENSIÓN POR INACTIVIDAD PASARON' as resultado;
rollback;
