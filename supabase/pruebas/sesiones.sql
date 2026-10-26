-- Pruebas: mis sesiones abiertas (migración 13). Transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('dd000000-0000-4000-8000-000000000001', 'ss1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ses-uno"}', '{}', now(), now()),
  ('dd000000-0000-4000-8000-000000000002', 'ss2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"ses-dos"}', '{}', now(), now());
insert into auth.sessions (id, user_id, user_agent, ip, refreshed_at) values
  ('dd000000-0000-4000-8000-0000000000a1', 'dd000000-0000-4000-8000-000000000001', 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', '10.0.0.1', now() at time zone 'UTC'),
  ('dd000000-0000-4000-8000-0000000000a2', 'dd000000-0000-4000-8000-000000000001', 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', '10.0.0.2', null),
  ('dd000000-0000-4000-8000-0000000000b1', 'dd000000-0000-4000-8000-000000000002', 'Mozilla/5.0 (Macintosh) Safari/605', '10.0.0.3', null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dd000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"dd000000-0000-4000-8000-0000000000a1"}', true);
select set_config('request.jwt.claim.sub', 'dd000000-0000-4000-8000-000000000001', true);
do $$ begin
  -- ve solo sus dos sesiones, con la actual marcada
  if (select count(*) from public.my_sessions()) <> 2 then raise exception 'FALLO: no ve exactamente sus 2 sesiones'; end if;
  if not (select current from public.my_sessions() where id = 'dd000000-0000-4000-8000-0000000000a1') then raise exception 'FALLO: no marca la sesión actual'; end if;
  if (select ip from public.my_sessions() where id = 'dd000000-0000-4000-8000-0000000000a2') <> '10.0.0.2' then raise exception 'FALLO: IP'; end if;
  -- no puede leer auth.sessions directamente
  begin
    perform 1 from auth.sessions;
    raise exception 'FALLO: leyó auth.sessions directamente';
  exception when insufficient_privilege then null;
  end;
  -- no puede cerrar la sesión de otro usuario
  begin
    perform public.revoke_my_session('dd000000-0000-4000-8000-0000000000b1');
    raise exception 'FALLO: cerró una sesión ajena';
  exception when no_data_found then null;
  end;
  -- ni la actual desde aquí
  begin
    perform public.revoke_my_session('dd000000-0000-4000-8000-0000000000a1');
    raise exception 'FALLO: cerró la sesión actual';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
  -- cierra la del teléfono
  perform public.revoke_my_session('dd000000-0000-4000-8000-0000000000a2');
  if (select count(*) from public.my_sessions()) <> 1 then raise exception 'FALLO: no cerró la sesión elegida'; end if;
end $$;

reset role;
do $$ begin
  if not exists (select 1 from auth.sessions where id = 'dd000000-0000-4000-8000-0000000000b1') then raise exception 'FALLO: desapareció la sesión ajena'; end if;
end $$;

select 'PRUEBAS DE SESIONES PASARON' as resultado;
rollback;
