-- Pruebas: acceso sin contraseña y recuperación supervisada (migración 77). Se deshace al final.
-- Sección A: profesor P, monitores M y M2, estudiantes S, S2, S3. Sección B: profesor Q, monitor N, estudiante X.
-- Administrador AD. Sesiones recientes (…a*) y antiguas (…b*: iniciadas hace 2 días).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, encrypted_password) values
  ('ac770000-0000-4000-8000-000000000001', 'ac01@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-prof-a","aula_role":"teacher"}', '{}', now(), now(), 'h-p'),
  ('ac770000-0000-4000-8000-000000000002', 'ac02@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-prof-b","aula_role":"teacher"}', '{}', now(), now(), 'h-q'),
  ('ac770000-0000-4000-8000-000000000003', 'ac03@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-admin"}', '{}', now(), now(), 'h-ad'),
  ('ac770000-0000-4000-8000-000000000011', 'ac11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-mon-a"}', '{}', now(), now(), 'h-m'),
  ('ac770000-0000-4000-8000-000000000012', 'ac12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-mon-a2"}', '{}', now(), now(), 'h-m2'),
  ('ac770000-0000-4000-8000-000000000013', 'ac13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-mon-b"}', '{}', now(), now(), 'h-n'),
  ('ac770000-0000-4000-8000-000000000021', 'ac21@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-est-s"}', '{}', now(), now(), 'h-s'),
  ('ac770000-0000-4000-8000-000000000022', 'ac22@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-est-s2"}', '{}', now(), now(), 'h-s2'),
  ('ac770000-0000-4000-8000-000000000023', 'ac23@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-est-s3"}', '{}', now(), now(), 'h-s3'),
  ('ac770000-0000-4000-8000-000000000024', 'ac24@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ac-est-x"}', '{}', now(), now(), 'h-x');
update public.profiles set must_change_password = false, active = true, full_name = 'Nombre ' || login_id where id::text like 'ac770000-%';
update public.profiles set role = 'teacher' where id in ('ac770000-0000-4000-8000-000000000001', 'ac770000-0000-4000-8000-000000000002');
update public.profiles set role = 'admin' where id = 'ac770000-0000-4000-8000-000000000003';
insert into public.courses (id, title) values ('ac770000-0000-4000-8000-0000000000c1', 'Curso acceso');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-0000000000c1', 'Sección A', 'ACCESA01', 'ac770000-0000-4000-8000-000000000001'),
  ('ac770000-0000-4000-8000-0000000000b0', 'ac770000-0000-4000-8000-0000000000c1', 'Sección B', 'ACCESB01', 'ac770000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000001'),
  ('ac770000-0000-4000-8000-0000000000b0', 'ac770000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000011'), ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000012'),
  ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000021'), ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000022'),
  ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000023'),
  ('ac770000-0000-4000-8000-0000000000b0', 'ac770000-0000-4000-8000-000000000013'), ('ac770000-0000-4000-8000-0000000000b0', 'ac770000-0000-4000-8000-000000000024');
insert into public.class_monitors (class_id, user_id) values
  ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000011'),
  ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000012'),
  ('ac770000-0000-4000-8000-0000000000b0', 'ac770000-0000-4000-8000-000000000013');
insert into auth.sessions (id, user_id, created_at) values
  ('ac770000-0000-4000-8000-0000000001a1', 'ac770000-0000-4000-8000-000000000001', now()),
  ('ac770000-0000-4000-8000-0000000001b1', 'ac770000-0000-4000-8000-000000000001', now() - interval '2 days'),
  ('ac770000-0000-4000-8000-0000000002a1', 'ac770000-0000-4000-8000-000000000002', now()),
  ('ac770000-0000-4000-8000-0000000003a1', 'ac770000-0000-4000-8000-000000000003', now()),
  ('ac770000-0000-4000-8000-0000000003b1', 'ac770000-0000-4000-8000-000000000003', now() - interval '2 days'),
  ('ac770000-0000-4000-8000-0000000011a1', 'ac770000-0000-4000-8000-000000000011', now()),
  ('ac770000-0000-4000-8000-0000000011b1', 'ac770000-0000-4000-8000-000000000011', now() - interval '2 days'),
  ('ac770000-0000-4000-8000-0000000012a1', 'ac770000-0000-4000-8000-000000000012', now()),
  ('ac770000-0000-4000-8000-0000000013a1', 'ac770000-0000-4000-8000-000000000013', now()),
  ('ac770000-0000-4000-8000-0000000021a1', 'ac770000-0000-4000-8000-000000000021', now());
-- el monitor M ha iniciado sesión desde la instalación «dev-monitor»
insert into public.login_attempts (login_id, user_id, success, reason, device_hash) values
  ('ac-mon-a', 'ac770000-0000-4000-8000-000000000011', true, 'ok', 'dev-monitor');

-- utilidades: actuar como un usuario/sesión; guardar códigos devueltos; hashes de secretos de dispositivo
create function pg_temp.como(p_user text, p_sesion text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_sesion)::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.h(p text) returns text language sql as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;
create temp table t (k text primary key, v jsonb);
grant all on t to authenticated, service_role, anon;

-- 0) Todo apagado por defecto; ningún monitor tiene el permiso; sin acceso directo a las tablas.
-- En una base nueva la configuración viene apagada; sobre la copia de producción puede estar encendida: se comprueba
-- el valor por defecto de las columnas y se parte de la configuración apagada (todo se deshace al final).
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'acceso_config'
             and column_name in ('passkeys', 'recuperacion', 'recuperacion_monitores') and column_default <> 'false') then
    raise exception 'FALLO: config no apagada por defecto';
  end if;
end $$;
update public.acceso_config set passkeys = false, recuperacion = false, recuperacion_monitores = false, minutos_solicitud = 30,
  minutos_aprobacion = 10, horas_sesion_reciente = 12, max_aprobaciones_monitor_dia = 5 where id = 1;
do $$ begin
  if exists (select 1 from public.acceso_monitores where class_id::text like 'ac770000-%')
     or exists (select 1 from public.acceso_secciones where class_id::text like 'ac770000-%') then raise exception 'FALLO: permisos automáticos'; end if;
end $$;
set local role service_role;
do $$ begin
  if (public.svc_acceso_solicitar('ac-est-s', 'profesor', pg_temp.h('sec-s'), 'ip1', '{}') ->> 'disponible')::boolean then
    raise exception 'FALLO: solicitud con todo apagado';
  end if;
end $$;
reset role;
set local role authenticated;
select pg_temp.como('ac770000-0000-4000-8000-000000000021', 'ac770000-0000-4000-8000-0000000021a1');
do $$ begin
  begin perform 1 from public.acceso_solicitudes; raise exception 'FALLO: leyó solicitudes'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.acceso_eventos; raise exception 'FALLO: leyó auditoría'; exception when insufficient_privilege then null; end;
  begin perform public.svc_acceso_canjear(gen_random_uuid(), 'x', null); raise exception 'FALLO: estudiante llamó svc'; exception when insufficient_privilege then null; end;
  if (public.acceso_estado_panel() ->> 'passkeys')::boolean then raise exception 'FALLO: passkeys visibles apagadas'; end if;
  if jsonb_array_length(public.acceso_estado_panel() -> 'secciones') <> 0 then raise exception 'FALLO: estudiante con secciones'; end if;
  -- funciones de administración: el estudiante no puede
  begin perform public.acceso_config_guardar(true, true, true); raise exception 'FALLO: estudiante configuró'; exception when insufficient_privilege then null; end;
  begin perform public.acceso_seccion_guardar('ac770000-0000-4000-8000-0000000000a0', true, true); raise exception 'FALLO: estudiante configuró sección'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.acceso_aprobar(gen_random_uuid(), 'AAAAAA', 'carnet'); raise exception 'FALLO: anon aprobó'; exception when insufficient_privilege then null; end;
  begin perform public.svc_acceso_solicitar('ac-est-s', 'profesor', repeat('a', 64), null, '{}'); raise exception 'FALLO: anon llamó svc'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 1) Activación progresiva: solo el admin enciende, y con sesión reciente; el profesor activa SU sección
set local role authenticated;
select pg_temp.como('ac770000-0000-4000-8000-000000000001', 'ac770000-0000-4000-8000-0000000001a1');
do $$ begin
  begin perform public.acceso_config_guardar(true, true, true); raise exception 'FALLO: profesor configuró lo global'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000003', 'ac770000-0000-4000-8000-0000000003b1');
do $$ begin
  begin perform public.acceso_config_guardar(true, true, true); raise exception 'FALLO: activó con sesión antigua'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000003', 'ac770000-0000-4000-8000-0000000003a1');
select public.acceso_config_guardar(true, true, true);
select pg_temp.como('ac770000-0000-4000-8000-000000000002', 'ac770000-0000-4000-8000-0000000002a1');
do $$ begin
  begin perform public.acceso_seccion_guardar('ac770000-0000-4000-8000-0000000000a0', true, true); raise exception 'FALLO: profesor de B configuró A'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000001', 'ac770000-0000-4000-8000-0000000001b1');
do $$ begin
  begin perform public.acceso_seccion_guardar('ac770000-0000-4000-8000-0000000000a0', true, true); raise exception 'FALLO: activó sección con sesión antigua'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000001', 'ac770000-0000-4000-8000-0000000001a1');
select public.acceso_seccion_guardar('ac770000-0000-4000-8000-0000000000a0', true, true);
do $$ begin
  -- delegación: solo en monitores activos de la sección; el monitor de B no recibe nada
  begin perform public.acceso_monitor_permiso('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000021', true);
    raise exception 'FALLO: delegó en un no monitor'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.acceso_monitor_permiso('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000011', true);
  perform public.acceso_monitor_permiso('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000012', true);
  if (select count(*) from public.acceso_monitores_lista('ac770000-0000-4000-8000-0000000000a0') where delegado) <> 2 then raise exception 'FALLO: delegación'; end if;
  begin perform public.acceso_monitores_lista('ac770000-0000-4000-8000-0000000000b0'); raise exception 'FALLO: vio monitores de B'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.acceso_monitores where user_id = 'ac770000-0000-4000-8000-000000000013') then raise exception 'FALLO: monitor de B con permiso'; end if;
  if (select count(*) from public.acceso_eventos where accion in ('configurar', 'configurar_seccion', 'otorgar_permiso') and resultado = 'ok'
      and actor::text like 'ac770000-%') <> 4 then
    raise exception 'FALLO: configuración sin auditar';
  end if;
end $$;

-- 2) Solicitudes: respuesta uniforme (existe o no, elegible o no)
set local role service_role;
do $$
declare r jsonb; v_k text;
begin
  insert into t values ('s', public.svc_acceso_solicitar('AC-EST-S ', 'profesor', pg_temp.h('sec-s'), 'ip1', '{"device_hash":"dev-s","browser":"Chrome 130","device_type":"teléfono"}'));
  insert into t values ('fantasma', public.svc_acceso_solicitar('no-existe-77', 'profesor', pg_temp.h('sec-f'), 'ip9', '{}'));
  insert into t values ('docente', public.svc_acceso_solicitar('ac-prof-a', 'profesor', pg_temp.h('sec-d'), 'ip9', '{}'));
  insert into t values ('x', public.svc_acceso_solicitar('ac-est-x', 'profesor', pg_temp.h('sec-x'), 'ip9', '{}'));   -- sección B sin activar
  for v_k in select t.k from t loop
    r := (select t.v from t where t.k = v_k);
    if not (r ? 'id' and r ? 'codigo' and r ? 'expira' and (r ->> 'disponible')::boolean and not r ? 'error' and not r ? 'limitado') then
      raise exception 'FALLO: respuesta no uniforme para %: %', v_k, r;
    end if;
    if coalesce(r ->> 'codigo', '') !~ '^[ACDEFGHJKMNPQRTUVWXY3479]{6}$' then raise exception 'FALLO: código %', r ->> 'codigo'; end if;
    if (public.svc_acceso_estado((r ->> 'id')::uuid, pg_temp.h('sec-' || case v_k when 'fantasma' then 'f' when 'docente' then 'd' else v_k end)) ->> 'estado') <> 'pendiente' then
      raise exception 'FALLO: estado inicial de %', k;
    end if;
  end loop;
  if (public.svc_acceso_estado((select (v ->> 'id')::uuid from t where k = 's'), pg_temp.h('otro')) ->> 'estado') <> 'desconocida' then
    raise exception 'FALLO: estado con secreto ajeno';
  end if;
  if (public.svc_acceso_solicitar('ac-est-s', 'invitado', pg_temp.h('z'), 'ip1', '{}') ->> 'error') <> 'formato' then raise exception 'FALLO: destinatario inválido'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.acceso_solicitudes where elegible and login_declarado in ('ac-est-s', 'no-existe-77', 'ac-prof-a', 'ac-est-x')) <> 1 then raise exception 'FALLO: elegibilidad'; end if;
  if (select user_id from public.acceso_solicitudes where login_declarado = 'ac-prof-a') is not null then raise exception 'FALLO: cuenta docente elegible'; end if;
  if not exists (select 1 from public.acceso_alertas where tipo = 'cuenta_no_elegible') then raise exception 'FALLO: sin alerta de cuenta docente'; end if;
  if (select class_id from public.acceso_solicitudes where login_declarado = 'ac-est-s') <> 'ac770000-0000-4000-8000-0000000000a0' then raise exception 'FALLO: sección'; end if;
  -- la base no guarda el código ni el secreto en claro
  if exists (select 1 from public.acceso_solicitudes s, t where t.k = 's' and (s.codigo_hash = t.v ->> 'codigo' or s.secreto_hash = 'sec-s')) then raise exception 'FALLO: secreto en claro'; end if;
end $$;

-- 3) Quién ve y quién puede aprobar la solicitud dirigida al PROFESOR de A
set local role authenticated;
select pg_temp.como('ac770000-0000-4000-8000-000000000011', 'ac770000-0000-4000-8000-0000000011a1');   -- monitor de A
do $$ declare r jsonb; begin
  if exists (select 1 from public.acceso_solicitudes_lista()) then raise exception 'FALLO: el monitor ve solicitudes para el profesor'; end if;
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's'), (select v ->> 'codigo' from t where k = 's'), 'carnet');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: monitor aprobó solicitud para el profesor'; end if;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000002', 'ac770000-0000-4000-8000-0000000002a1');   -- profesor de B
do $$ declare r jsonb; begin
  if exists (select 1 from public.acceso_solicitudes_lista()) then raise exception 'FALLO: profesor de B ve solicitudes de A'; end if;
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's'), (select v ->> 'codigo' from t where k = 's'), 'carnet');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: aprobación entre secciones'; end if;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000021', 'ac770000-0000-4000-8000-0000000021a1');   -- estudiante
do $$ declare r jsonb; begin
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's'), (select v ->> 'codigo' from t where k = 's'), 'carnet');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: el estudiante aprobó'; end if;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000001', 'ac770000-0000-4000-8000-0000000001b1');   -- profesor de A, sesión antigua
do $$ declare r jsonb; begin
  if (select count(*) from public.acceso_solicitudes_lista(array['pendiente'])) <> 1 then raise exception 'FALLO: el profesor no ve la solicitud (o ve señuelos)'; end if;
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's'), (select v ->> 'codigo' from t where k = 's'), 'carnet');
  if r ->> 'codigo' <> 'sesion_no_reciente' then raise exception 'FALLO: aprobó con sesión antigua: %', r; end if;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000001', 'ac770000-0000-4000-8000-0000000001a1');
do $$ declare r jsonb; begin
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's'), 'ZZZZZZ', 'carnet');
  if r ->> 'codigo' <> 'codigo' then raise exception 'FALLO: código ajeno aceptado: %', r; end if;
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's'), (select v ->> 'codigo' from t where k = 's'), 'telepatia');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: método inválido'; end if;
  -- señuelo (cuenta inexistente): ni siquiera se encuentra
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 'fantasma'), (select v ->> 'codigo' from t where k = 'fantasma'), 'carnet');
  if r ->> 'codigo' <> 'no_encontrada' then raise exception 'FALLO: señuelo aprobable'; end if;
  -- código con minúsculas y guion: se normaliza
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's'),
         lower(substr((select v ->> 'codigo' from t where k = 's'), 1, 3) || '-' || substr((select v ->> 'codigo' from t where k = 's'), 4)), 'carnet', 'Carné UASD visto');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: el profesor no pudo aprobar: %', r; end if;
  if (select estado from public.acceso_solicitudes_lista() where id = (select (v ->> 'id')::uuid from t where k = 's')) <> 'aprobada' then raise exception 'FALLO: estado aprobada'; end if;
end $$;
reset role;
do $$ begin
  -- toda acción, permitida o denegada, queda en la auditoría
  if (select count(*) from public.acceso_eventos where accion = 'aprobar' and resultado = 'rechazado'
      and solicitud = (select (v ->> 'id')::uuid from t where k = 's')) < 6 then raise exception 'FALLO: denegaciones sin auditar'; end if;
  if not exists (select 1 from public.acceso_eventos where accion = 'aprobar' and resultado = 'ok' and actor = 'ac770000-0000-4000-8000-000000000001'
                 and actor_rol = 'profesor' and metodo = 'carnet' and estudiante = 'ac770000-0000-4000-8000-000000000021'
                 and class_id = 'ac770000-0000-4000-8000-0000000000a0') then raise exception 'FALLO: aprobación sin trazabilidad completa'; end if;
end $$;

-- 4) Canje: solo el dispositivo con el secreto, una sola vez; la cuenta queda con cambio de contraseña obligatorio
set local role service_role;
do $$ declare r jsonb; v_id uuid := (select (v ->> 'id')::uuid from t where k = 's'); begin
  r := public.svc_acceso_canjear(v_id, pg_temp.h('robado'), 'ip-otro');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: canje sin el secreto (otro dispositivo)'; end if;
  r := public.svc_acceso_canjear(v_id, pg_temp.h('sec-s'), 'ip1');
  if not (r ->> 'ok')::boolean or r ->> 'email' <> 'ac21@cuentas.aula.invalid' then raise exception 'FALLO: canje legítimo: %', r; end if;
  r := public.svc_acceso_canjear(v_id, pg_temp.h('sec-s'), 'ip1');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: reutilización del canje'; end if;
  if (public.svc_acceso_estado(v_id, pg_temp.h('sec-s')) ->> 'estado') <> 'completada' then raise exception 'FALLO: estado completada'; end if;
end $$;
reset role;
do $$ begin
  if not (select must_change_password and password_fingerprint = encode(extensions.digest('h-s', 'sha256'), 'hex') and full_name = 'Nombre ac-est-s' and active
          from public.profiles where id = 'ac770000-0000-4000-8000-000000000021') then raise exception 'FALLO: perfil tras el canje'; end if;
  if not exists (select 1 from public.live_message_recipients r join public.live_messages m on m.id = r.message_id
                 where r.user_id = 'ac770000-0000-4000-8000-000000000021' and m.remitente = 'aula' and m.body like 'Se recuperó el acceso%') then
    raise exception 'FALLO: sin aviso al estudiante';
  end if;
  -- la auditoría no contiene secretos ni códigos
  if exists (select 1 from public.acceso_eventos e, t where e.detalle::text || coalesce(e.motivo, '') || coalesce(e.metodo, '') like '%' || (t.v ->> 'codigo') || '%') then
    raise exception 'FALLO: código en la auditoría';
  end if;
  if exists (select 1 from public.acceso_eventos e where e.detalle::text like '%sec-%' or e.detalle::text ~ '[0-9a-f]{64}') then raise exception 'FALLO: secreto en la auditoría'; end if;
end $$;

-- 5) Solicitud al MONITOR: aprueba el monitor de A; el de B no; retirar el permiso anula la aprobación
set local role service_role;
do $$ begin
  insert into t values ('s2', public.svc_acceso_solicitar('ac-est-s2', 'monitor', pg_temp.h('sec-s2'), 'ip2', '{"device_hash":"dev-s2"}'));
  insert into t values ('m', public.svc_acceso_solicitar('ac-mon-a', 'monitor', pg_temp.h('sec-m'), 'ip3', '{}'));   -- la cuenta de un monitor
  insert into t values ('s3', public.svc_acceso_solicitar('ac-est-s3', 'monitor', pg_temp.h('sec-s3'), 'ip4', '{"device_hash":"dev-monitor"}'));
end $$;
reset role;
set local role authenticated;
select pg_temp.como('ac770000-0000-4000-8000-000000000013', 'ac770000-0000-4000-8000-0000000013a1');   -- monitor de B (sin permiso)
do $$ declare r jsonb; begin
  if exists (select 1 from public.acceso_solicitudes_lista()) then raise exception 'FALLO: monitor de B ve solicitudes'; end if;
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's2'), (select v ->> 'codigo' from t where k = 's2'), 'carnet');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: monitor de otra sección aprobó'; end if;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000011', 'ac770000-0000-4000-8000-0000000011b1');   -- monitor de A, sesión antigua
do $$ declare r jsonb; begin
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's2'), (select v ->> 'codigo' from t where k = 's2'), 'carnet');
  if r ->> 'codigo' <> 'sesion_no_reciente' then raise exception 'FALLO: monitor con sesión antigua aprobó'; end if;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000011', 'ac770000-0000-4000-8000-0000000011a1');
do $$ declare r jsonb; begin
  if (select count(*) from public.acceso_solicitudes_lista(array['pendiente'])) <> 3 then raise exception 'FALLO: lo que ve el monitor de A'; end if;
  -- la solicitud salió de un dispositivo donde el propio monitor inició sesión
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's3'), (select v ->> 'codigo' from t where k = 's3'), 'carnet');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: aprobó desde su propio dispositivo'; end if;
  -- su propia cuenta / la de otro monitor
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 'm'), (select v ->> 'codigo' from t where k = 'm'), 'carnet');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: monitor aprobó su propia solicitud'; end if;
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's2'), (select v ->> 'codigo' from t where k = 's2'), 'cedula');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: monitor de A no pudo aprobar: %', r; end if;
  -- el monitor no puede cancelar ni administrar
  r := public.acceso_cerrar((select (v ->> 'id')::uuid from t where k = 's3'), 'cancelar', 'x');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: monitor canceló'; end if;
  begin perform public.acceso_monitor_permiso('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000012', false);
    raise exception 'FALLO: monitor retiró permisos'; exception when insufficient_privilege then null; end;
  begin perform public.acceso_alertas_lista(); raise exception 'FALLO: monitor vio alertas'; exception when insufficient_privilege then null; end;
  -- ve el historial permitido (sus acciones), pero no puede modificarlo
  if not exists (select 1 from public.acceso_eventos_lista() where actor = 'ac770000-0000-4000-8000-000000000011' and accion = 'aprobar') then
    raise exception 'FALLO: el monitor no ve su historial';
  end if;
  begin delete from public.acceso_eventos; raise exception 'FALLO: borró auditoría'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000012', 'ac770000-0000-4000-8000-0000000012a1');   -- M2
do $$ declare r jsonb; begin
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 'm'), (select v ->> 'codigo' from t where k = 'm'), 'carnet');
  if (r ->> 'ok')::boolean or r ->> 'error' not like '%monitor solo la recupera el profesor%' then raise exception 'FALLO: monitor recuperó a otro monitor: %', r; end if;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000001', 'ac770000-0000-4000-8000-0000000001b1');   -- profesor: suspender NO exige sesión reciente
do $$ begin
  if not exists (select 1 from public.acceso_alertas_lista() where tipo = 'monitor_aprobo') then raise exception 'FALLO: el profesor no ve la aprobación del monitor'; end if;
  if not exists (select 1 from public.acceso_alertas_lista() where tipo = 'mismo_dispositivo') then raise exception 'FALLO: sin alerta de mismo dispositivo'; end if;
  perform public.acceso_monitor_permiso('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000011', false);
end $$;
reset role;
-- retirar el permiso revoca al instante (no solo al intentar canjear)
do $$ begin
  if (select estado from public.acceso_solicitudes where id = (select (v ->> 'id')::uuid from t where k = 's2')) <> 'revocada' then
    raise exception 'FALLO: retirar el permiso no revocó la aprobación';
  end if;
end $$;
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_acceso_canjear((select (v ->> 'id')::uuid from t where k = 's2'), pg_temp.h('sec-s2'), 'ip2');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: canje tras retirar el permiso del monitor'; end if;
  if (public.svc_acceso_estado((select (v ->> 'id')::uuid from t where k = 's2'), pg_temp.h('sec-s2')) ->> 'estado') <> 'revocada' then raise exception 'FALLO: no quedó revocada'; end if;
end $$;
reset role;
do $$ begin
  if (select must_change_password from public.profiles where id = 'ac770000-0000-4000-8000-000000000022') then raise exception 'FALLO: perfil tocado sin canje'; end if;
end $$;

-- 6) Monitor sin permiso ya no ve nada; límite diario; vencimientos; revocación por el profesor
set local role authenticated;
select pg_temp.como('ac770000-0000-4000-8000-000000000011', 'ac770000-0000-4000-8000-0000000011a1');
do $$ begin
  if exists (select 1 from public.acceso_solicitudes_lista()) then raise exception 'FALLO: monitor sin permiso sigue viendo'; end if;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000003', 'ac770000-0000-4000-8000-0000000003a1');
select public.acceso_config_guardar(null, null, null, null, null, null, 1);   -- 1 aprobación por monitor al día
reset role;
set local role service_role;
do $$ begin
  insert into t values ('s3b', public.svc_acceso_solicitar('ac-est-s3', 'monitor', pg_temp.h('sec-s3b'), 'ip5', '{}'));
end $$;
reset role;
set local role authenticated;
select pg_temp.como('ac770000-0000-4000-8000-000000000012', 'ac770000-0000-4000-8000-0000000012a1');
do $$ declare r jsonb; begin
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's3b'), (select v ->> 'codigo' from t where k = 's3b'), 'carnet');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: primera aprobación de M2: %', r; end if;
end $$;
reset role;
-- forzar una segunda aprobación de M2 sobre otra solicitud pendiente (s3 fue cancelada al aprobar s3b: se crea otra para X en A)
insert into public.enrollments (class_id, user_id) values ('ac770000-0000-4000-8000-0000000000a0', 'ac770000-0000-4000-8000-000000000024');
set local role service_role;
do $$ begin
  insert into t values ('xa', public.svc_acceso_solicitar('ac-est-x', 'monitor', pg_temp.h('sec-xa'), 'ip6', '{}'));
end $$;
reset role;
do $$ begin
  if (select estado from public.acceso_solicitudes where id = (select (v ->> 'id')::uuid from t where k = 's3')) <> 'cancelada' then
    raise exception 'FALLO: la otra solicitud de la misma cuenta no se canceló';
  end if;
end $$;
set local role authenticated;
select pg_temp.como('ac770000-0000-4000-8000-000000000012', 'ac770000-0000-4000-8000-0000000012a1');
do $$ declare r jsonb; begin
  r := public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 'xa'), (select v ->> 'codigo' from t where k = 'xa'), 'carnet');
  if (r ->> 'ok')::boolean or r ->> 'error' not like '%máximo%' then raise exception 'FALLO: límite diario del monitor: %', r; end if;
end $$;
-- el profesor revoca la aprobación pendiente de canje (s3b) y rechaza xa
select pg_temp.como('ac770000-0000-4000-8000-000000000001', 'ac770000-0000-4000-8000-0000000001a1');
do $$ declare r jsonb; begin
  r := public.acceso_cerrar((select (v ->> 'id')::uuid from t where k = 'xa'), 'rechazar', '');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: rechazo sin motivo'; end if;
  r := public.acceso_cerrar((select (v ->> 'id')::uuid from t where k = 'xa'), 'rechazar', 'No presentó identificación');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: rechazo: %', r; end if;
  r := public.acceso_cerrar((select (v ->> 'id')::uuid from t where k = 's3b'), 'revocar', 'Revisión');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: revocación: %', r; end if;
end $$;
reset role;
set local role service_role;
do $$ declare r jsonb; begin
  if (public.svc_acceso_canjear((select (v ->> 'id')::uuid from t where k = 's3b'), pg_temp.h('sec-s3b'), 'ip5') ->> 'ok')::boolean then raise exception 'FALLO: canje revocado'; end if;
  if (public.svc_acceso_canjear((select (v ->> 'id')::uuid from t where k = 'xa'), pg_temp.h('sec-xa'), 'ip6') ->> 'ok')::boolean then raise exception 'FALLO: canje rechazado'; end if;
end $$;
reset role;
-- vencimientos: una solicitud pendiente y una aprobación no canjeada que caducan
update public.acceso_solicitudes set expires_at = now() - interval '1 second' where id = (select (v ->> 'id')::uuid from t where k = 'm');
set local role service_role;
do $$ begin
  if (public.svc_acceso_estado((select (v ->> 'id')::uuid from t where k = 'm'), pg_temp.h('sec-m')) ->> 'estado') <> 'vencida' then raise exception 'FALLO: vencimiento'; end if;
  if (public.svc_acceso_estado((select (v ->> 'id')::uuid from t where k = 'fantasma'), pg_temp.h('sec-f')) ->> 'estado') <> 'pendiente' then raise exception 'FALLO: señuelo'; end if;
  -- límite por cuenta declarada (3 en 24 h): igual para cuentas que existen y que no
  perform public.svc_acceso_solicitar('no-existe-77', 'profesor', pg_temp.h('f2'), 'ip9', '{}');
  perform public.svc_acceso_solicitar('no-existe-77', 'profesor', pg_temp.h('f3'), 'ip9', '{}');
  if not coalesce((public.svc_acceso_solicitar('no-existe-77', 'profesor', pg_temp.h('f4'), 'ip9', '{}') ->> 'limitado')::boolean, false) then raise exception 'FALLO: límite por cuenta'; end if;
end $$;
reset role;

-- 7) Interruptor general: apagar (sin sesión reciente) anula al instante las aprobaciones sin canjear
set local role service_role;
do $$ begin insert into t values ('s2b', public.svc_acceso_solicitar('ac-est-s2', 'profesor', pg_temp.h('sec-s2b'), 'ip7', '{}')); end $$;
reset role;
set local role authenticated;
select pg_temp.como('ac770000-0000-4000-8000-000000000001', 'ac770000-0000-4000-8000-0000000001a1');
do $$ begin
  if not (public.acceso_aprobar((select (v ->> 'id')::uuid from t where k = 's2b'), (select v ->> 'codigo' from t where k = 's2b'), 'conocimiento_personal') ->> 'ok')::boolean then
    raise exception 'FALLO: aprobación s2b';
  end if;
end $$;
select pg_temp.como('ac770000-0000-4000-8000-000000000003', 'ac770000-0000-4000-8000-0000000003b1');
select public.acceso_config_guardar(null, false, null);
reset role;
set local role service_role;
do $$ begin
  if (public.svc_acceso_canjear((select (v ->> 'id')::uuid from t where k = 's2b'), pg_temp.h('sec-s2b'), 'ip7') ->> 'ok')::boolean then raise exception 'FALLO: canje con todo apagado'; end if;
  if (public.svc_acceso_solicitar('ac-est-s2', 'profesor', pg_temp.h('z2'), 'ip7', '{}') ->> 'disponible')::boolean then raise exception 'FALLO: solicitud apagada'; end if;
end $$;
reset role;

-- 8) Auditoría inmutable incluso para el propietario
do $$ begin
  begin update public.acceso_eventos set motivo = 'x' where id = (select min(id) from public.acceso_eventos); raise exception 'FALLO: modificó auditoría';
  exception when insufficient_privilege then null; end;
  begin delete from public.acceso_eventos where id = (select min(id) from public.acceso_eventos); raise exception 'FALLO: borró auditoría';
  exception when insufficient_privilege then null; end;
  begin truncate public.acceso_eventos; raise exception 'FALLO: vació auditoría'; exception when insufficient_privilege then null; end;
  -- los datos académicos no se tocaron
  if exists (select 1 from public.attempts where user_id::text like 'ac770000-%') or exists (select 1 from public.grade_entries where user_id::text like 'ac770000-%') then
    raise exception 'FALLO: datos académicos';
  end if;
end $$;

select 'PRUEBAS DE ACCESO Y RECUPERACIÓN PASARON' as resultado;
rollback;
