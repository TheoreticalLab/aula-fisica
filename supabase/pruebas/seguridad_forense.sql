-- Pruebas: centro de seguridad, Fase 1 (migración 20). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d4000000-0000-4000-8000-000000000001', 'sa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-sint","aula_role":"admin"}', '{}', now(), now()),
  ('d4000000-0000-4000-8000-000000000011', 's1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-100"}', '{}', now(), now());
update public.profiles set must_change_password = false, role = 'admin' where id = 'd4000000-0000-4000-8000-000000000001';
update public.profiles set must_change_password = false where id = 'd4000000-0000-4000-8000-000000000011';

-- 1) abuso del bloqueo: 5 contraseñas incorrectas bloquean; los rechazos por bloqueo NO prolongan el bloqueo
do $$
declare i int;
begin
  for i in 1..5 loop
    perform public.svc_login_record('sint-100', 'd4000000-0000-4000-8000-000000000011', 'red-a', false, 'bad_password', '{}');
  end loop;
  if (public.svc_login_check('sint-100', 'red-a') ->> 'reason') <> 'locked' then raise exception 'FALLO: 5 fallos no bloquearon'; end if;
  -- el atacante sigue insistiendo durante el bloqueo
  for i in 1..10 loop
    perform public.svc_login_record('sint-100', null, 'red-b', false, 'locked', '{"rule":"id_5_fallos_15min"}');
  end loop;
end $$;
-- pasan 16 minutos desde los fallos reales (los rechazos son recientes): ya no está bloqueado
update public.login_attempts set created_at = now() - interval '16 minutes' where login_id = 'sint-100' and reason = 'bad_password';
do $$ begin
  if (public.svc_login_check('sint-100', 'red-a') ->> 'allowed')::boolean is not true then
    raise exception 'FALLO: los rechazos por bloqueo prolongaron el bloqueo (abuso de bloqueo)';
  end if;
end $$;

-- 2) acceso correcto con metadatos: se registra el evento y se reconoce el dispositivo
select public.svc_login_record('sint-100', 'd4000000-0000-4000-8000-000000000011', 'red-c', true, 'ok',
  '{"request_id":"d4000000-0000-4000-8000-0000000000e1","browser":"Firefox 131","os":"Linux","device_type":"computadora","device_hash":"dev-1","country":"do","client_tz":"America/Santo_Domingo","duration_ms":812,"password":"NO-DEBE-GUARDARSE"}');
do $$ begin
  if not exists (select 1 from public.known_devices where device_hash = 'dev-1') then raise exception 'FALLO: no reconoció el dispositivo'; end if;
  if (select country from public.login_attempts where request_id = 'd4000000-0000-4000-8000-0000000000e1') <> 'DO' then raise exception 'FALLO: país'; end if;
  if exists (select 1 from public.login_attempts where user_agent ilike '%NO-DEBE%' or browser ilike '%NO-DEBE%') then raise exception 'FALLO: guardó un campo no previsto'; end if;
  -- un fallo con metadatos ausentes también se registra
  perform public.svc_login_record('sint-100', 'd4000000-0000-4000-8000-000000000011', null, false, 'bad_password', null);
end $$;

-- 3) un origen prueba 6 identificadores (5 inexistentes): enumeración
do $$
declare i int;
begin
  for i in 1..6 loop
    perform public.svc_login_record('sint-90' || i, null, 'red-x', false, 'unknown_id', '{}');
  end loop;
end $$;

-- 4) un estudiante no puede tocar nada de esto
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d4000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.sec_overview(); raise exception 'FALLO: un estudiante vio el resumen'; exception when insufficient_privilege then null; end;
  begin perform * from public.sec_events(null, null, null, null, 10); raise exception 'FALLO: un estudiante vio eventos'; exception when insufficient_privilege then null; end;
  begin perform * from public.sec_detections(72); raise exception 'FALLO: un estudiante vio detecciones'; exception when insufficient_privilege then null; end;
  begin perform public.sec_annotate(null, 'sint-100', 'reconozco', null); raise exception 'FALLO: un estudiante anotó'; exception when insufficient_privilege then null; end;
  begin
    perform public.svc_login_record('sint-100', null, 'falso', true, 'ok', '{}');
    raise exception 'FALLO: un estudiante insertó un evento de acceso';
  exception when insufficient_privilege then null;
  end;
  begin perform 1 from public.known_devices; raise exception 'FALLO: leyó dispositivos'; exception when insufficient_privilege then null; end;
  -- login_attempts tiene RLS solo para el administrador: el estudiante no ve ninguna fila
  if exists (select 1 from public.login_attempts) then raise exception 'FALLO: un estudiante leyó intentos de acceso'; end if;
  begin insert into public.security_annotations (login_id, note) values ('x', 'y'); raise exception 'FALLO: insertó anotación'; exception when insufficient_privilege then null; end;
end $$;

-- 5) administrador: invariante de indicadores, detecciones, «¿Pude haber sido yo?», anotación sin tocar la evidencia
select set_config('request.jwt.claims', '{"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"sesion-prueba"}', true);
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
do $$
declare x jsonb; v_ev uuid; v_antes bigint;
begin
  for x in select * from jsonb_array_elements(public.admin_suspicious_logins()) loop
    if (x ->> 'ips')::int > (x ->> 'fallos')::int then raise exception 'FALLO: orígenes de fallos (%) > fallos (%)', x ->> 'ips', x ->> 'fallos'; end if;
  end loop;
  if not exists (select 1 from public.sec_detections(72) where regla = 'enumeracion_identificadores') then raise exception 'FALLO: no detectó la enumeración'; end if;
  if not exists (select 1 from public.sec_detections(72) where regla = 'abuso_de_bloqueo' and sujeto = 'sint-100') then raise exception 'FALLO: no detectó el abuso de bloqueo'; end if;
  select event_id into v_ev from public.sec_events('sint-100', 'fallo', null, null, 1);
  x := public.sec_event_context(v_ev);
  if (x ->> 'historial_correctos')::int < 0 or x -> 'evento' ->> 'login_id' <> 'sint-100' then raise exception 'FALLO: contexto del evento'; end if;
  select count(*) into v_antes from public.login_attempts;
  perform public.sec_annotate(v_ev, 'sint-100', 'no_seguro', 'Revisar con el estudiante');
  if (select count(*) from public.login_attempts) <> v_antes then raise exception 'FALLO: la anotación alteró la evidencia'; end if;
  if (select actor_session from public.security_annotations where event_id = v_ev) <> 'sesion-prueba' then raise exception 'FALLO: no registró la sesión'; end if;
  if (select count(*) from public.security_audit where actor_id = 'd4000000-0000-4000-8000-000000000001') < 3 then raise exception 'FALLO: no auditó las consultas'; end if;
end $$;

reset role;
select 'PRUEBAS DEL CENTRO DE SEGURIDAD PASARON' as resultado;
rollback;
