-- Pruebas: interpretación con IA de LIEIA a través de Orbe IA (migración 52). Datos sintéticos; se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de520000-0000-4000-8000-000000000001', 'li1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-lieia-ia","aula_role":"teacher"}', '{}', now(), now()),
  ('de520000-0000-4000-8000-000000000011', 'li11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lieia-ia"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de520000-%';
update public.profiles set role = 'teacher' where id = 'de520000-0000-4000-8000-000000000001';

-- 0) solo el servidor; el propósito nuevo cabe en la restricción y los anteriores siguen valiendo
do $$ begin
  if has_function_privilege('authenticated', 'public.svc_orbe_ia_reservar_uso(uuid, text, uuid)', 'execute') then raise exception 'FALLO: reserva expuesta a authenticated'; end if;
  if has_function_privilege('anon', 'public.svc_orbe_ia_reservar_uso(uuid, text, uuid)', 'execute') then raise exception 'FALLO: reserva expuesta a anon'; end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conname = 'orbe_ia_usage_purpose_check') not like '%lieia%' then raise exception 'FALLO: falta el propósito lieia'; end if;
end $$;

-- 1) apagado: no reserva nada
update public.orbe_ia_config set enabled = false where id = 1;
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_orbe_ia_reservar_uso('de520000-0000-4000-8000-000000000001', 'lieia');
  if r ->> 'motivo' <> 'apagado' then raise exception 'FALLO: reservó con Orbe IA apagado (%)', r; end if;
end $$;
reset role;

-- 2) encendido con simulador: reserva del profesorado, simulada, sin coste y con límite de salida acotado
update public.orbe_ia_config set enabled = true, api_real = false, daily_max_calls = 1000 where id = 1;
set local role service_role;
do $$ declare r jsonb; u public.orbe_ia_usage; begin
  r := public.svc_orbe_ia_reservar_uso('de520000-0000-4000-8000-000000000001', 'lieia');
  if not (r ->> 'ok')::boolean or (r ->> 'api_real')::boolean then raise exception 'FALLO: reserva lieia %', r; end if;
  if (r ->> 'max_tokens')::int > 3000 then raise exception 'FALLO: límite de salida %', r ->> 'max_tokens'; end if;
  select * into u from public.orbe_ia_usage where id = (r ->> 'usage_id')::bigint;
  if u.purpose <> 'lieia' or not u.simulated or u.reserved_usd <> 0 then raise exception 'FALLO: registro de uso %', row_to_json(u); end if;
  perform public.svc_orbe_ia_finalizar_uso(u.id, true, 0, 0, null);
  -- un estudiante no puede; un propósito desconocido tampoco; los anteriores siguen funcionando
  r := public.svc_orbe_ia_reservar_uso('de520000-0000-4000-8000-000000000011', 'lieia');
  if r ->> 'motivo' <> 'permiso' then raise exception 'FALLO: un estudiante reservó (%)', r; end if;
  r := public.svc_orbe_ia_reservar_uso('de520000-0000-4000-8000-000000000001', 'otra_cosa');
  if r ->> 'motivo' <> 'proposito' then raise exception 'FALLO: propósito desconocido aceptado (%)', r; end if;
  r := public.svc_orbe_ia_reservar_uso('de520000-0000-4000-8000-000000000001', 'pulso');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: el pulso dejó de funcionar (%)', r; end if;
end $$;
reset role;

select 'lieia_ia.sql: PRUEBAS PASARON' as resultado;
rollback;
