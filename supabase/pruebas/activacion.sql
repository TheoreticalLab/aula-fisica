-- =============================================================================
-- Pruebas: activación de cuentas con la clave de la sección (migración 7) y secciones del profesor (migración 8).
-- Transacción que se deshace al final.
-- =============================================================================
begin;

-- las cuatro secciones existen, cada una con su clave distinta
do $$ begin
  if (select count(distinct join_code) from public.classes
      where name in ('Física Básica', 'Física General 1-A', 'Física General 1', 'Física General 3')) <> 4 then
    raise exception 'FALLO: no están las cuatro secciones con claves distintas';
  end if;
  if (select count(*) from public.courses where code in ('FIS-GEN-1', 'FIS-GEN-3')) <> 2 then raise exception 'FALLO: faltan las asignaturas de Física General'; end if;
end $$;

insert into public.courses (id, title) values ('c7000000-0000-4000-8000-000000000001', 'Curso activación');
insert into public.classes (id, course_id, name, join_code, join_open) values
  ('c7000000-0000-4000-8000-000000000011', 'c7000000-0000-4000-8000-000000000001', 'Abierta', 'ABIERTA2', true),
  ('c7000000-0000-4000-8000-000000000012', 'c7000000-0000-4000-8000-000000000001', 'Cerrada', 'CERRADA2', false);
insert into public.class_groups (id, class_id, name, join_code) values ('c7000000-0000-4000-8000-000000000021', 'c7000000-0000-4000-8000-000000000011', 'G', 'GRUPOAB2');

set local role service_role;
do $$
declare v jsonb;
begin
  v := public.svc_activation_check('abierta-2', 'EST-900', 'ip1');
  if not (v ->> 'ok')::boolean or v ->> 'class_id' <> 'c7000000-0000-4000-8000-000000000011' then raise exception 'FALLO: clave válida rechazada: %', v; end if;
  v := public.svc_activation_check('GRUPOAB2', 'est-901', 'ip1');
  if v ->> 'group_id' <> 'c7000000-0000-4000-8000-000000000021' then raise exception 'FALLO: clave de grupo'; end if;
  if public.svc_activation_check('CERRADA2', 'est-902', 'ip1') ->> 'reason' <> 'closed' then raise exception 'FALLO: sección cerrada admitió activación'; end if;
  if public.svc_activation_check('NOEXISTE', 'est-903', 'ip1') ->> 'reason' <> 'bad_code' then raise exception 'FALLO: clave inexistente'; end if;
  if public.svc_activation_check('ABIERTA2', 'x', 'ip1') ->> 'reason' <> 'invalid' then raise exception 'FALLO: ID inválido'; end if;
  for i in 1..10 loop perform public.svc_activation_record('ip-mala', 'est-904', null, false, 'bad_code'); end loop;
  if public.svc_activation_check('ABIERTA2', 'est-904', 'ip-mala') ->> 'reason' <> 'rate_ip' then raise exception 'FALLO: no se limitó la IP tras 10 claves incorrectas'; end if;
end $$;
reset role;

-- alta como la hace Auth: primero el usuario sin datos, luego app_metadata
insert into auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('c7000000-0000-4000-8000-000000000031', 'u31@cuentas.aula.invalid', 'authenticated', 'authenticated', 'hash-elegido', '{"provider":"email"}', '{}', now(), now());
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"login_id":"EST-900","full_name":"Ana Activada","aula_role":"student"}'
  where id = 'c7000000-0000-4000-8000-000000000031';

set local role service_role;
do $$ begin
  if public.svc_account_activated('c7000000-0000-4000-8000-000000000031', 'c7000000-0000-4000-8000-000000000011', null) ->> 'login_id' <> 'est-900' then
    raise exception 'FALLO: svc_account_activated';
  end if;
  if public.svc_activation_check('ABIERTA2', 'est-900', 'ip2') ->> 'reason' <> 'id_taken' then raise exception 'FALLO: ID ya activado no detectado'; end if;
  begin
    perform public.svc_account_activated('c7000000-0000-4000-8000-000000000031', 'c7000000-0000-4000-8000-000000000012', null);
    raise exception 'FALLO: se activó en una sección cerrada';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  if (select must_change_password or not active or role <> 'student' or full_name <> 'Ana Activada'
      from public.profiles where id = 'c7000000-0000-4000-8000-000000000031') then
    raise exception 'FALLO: el perfil activado no quedó como estudiante activo con su nombre';
  end if;
  if (select count(*) from public.enrollments where user_id = 'c7000000-0000-4000-8000-000000000031') <> 1 then
    raise exception 'FALLO: debe quedar matriculado exactamente en su sección';
  end if;
end $$;

-- el estudiante activado ve su sección y nada más; no puede usar las funciones de activación
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c7000000-0000-4000-8000-000000000031","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c7000000-0000-4000-8000-000000000031', true);
do $$ begin
  if jsonb_array_length(public.my_classes()) <> 1 then raise exception 'FALLO: el estudiante activado no ve exactamente su sección'; end if;
  if exists (select 1 from public.activation_attempts) then raise exception 'FALLO: un estudiante ve los intentos de activación'; end if;
  begin
    perform public.svc_activation_check('ABIERTA2', 'otro-1', null);
    raise exception 'FALLO: un estudiante ejecutó svc_activation_check';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
rollback;
select 'PRUEBAS DE ACTIVACIÓN CON CLAVE PASARON' as resultado;
