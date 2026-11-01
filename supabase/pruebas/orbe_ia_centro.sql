-- Pruebas: Orbe IA como centro de IA (migración 54): consumo por uso en el panel. Datos sintéticos; se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de540000-0000-4000-8000-000000000001', 'oc1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-centro","aula_role":"admin"}', '{}', now(), now()),
  ('de540000-0000-4000-8000-000000000002', 'oc2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-centro","aula_role":"teacher"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de540000-%';
update public.profiles set role = 'admin' where id = 'de540000-0000-4000-8000-000000000001';
update public.profiles set role = 'teacher' where id = 'de540000-0000-4000-8000-000000000002';
-- lo que ya hubiera este mes (con los datos reales de producción en `probar` no se parte de cero)
select set_config('prueba.base', (select coalesce(jsonb_object_agg(x.purpose, jsonb_build_object('llamadas', x.l, 'reales', x.r, 'errores', x.e)), '{}'::jsonb)::text
  from (select purpose, count(*) l, count(*) filter (where not simulated) r, count(*) filter (where status = 'error') e
        from public.orbe_ia_usage
        where created_at >= date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo'
        group by purpose) x), true);
-- consumo sintético del mes: dos de LIEIA (una real con coste), uno de pulso (simulado) y uno de chistes con error
insert into public.orbe_ia_usage (actor_id, trigger, model, simulated, status, input_tokens, output_tokens, cost_usd, purpose, error_code) values
  ('de540000-0000-4000-8000-000000000002', 'profesor', 'claude-opus-5-5', false, 'ok', 900, 400, 0.0116, 'lieia', null),
  ('de540000-0000-4000-8000-000000000002', 'profesor', 'claude-opus-5-5', true, 'ok', 0, 0, 0, 'lieia', null),
  ('de540000-0000-4000-8000-000000000002', 'profesor', 'claude-opus-5-5', true, 'ok', 0, 0, 0, 'pulso', null),
  ('de540000-0000-4000-8000-000000000001', 'profesor', 'claude-opus-5-5', false, 'error', 0, 0, 0, 'chistes', 'red');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de540000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de540000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.orbe_ia_admin_get(); raise exception 'FALLO: un profesor no administrador vio el panel';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de540000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de540000-0000-4000-8000-000000000001', true);
do $$ declare p jsonb; l jsonb; b jsonb := current_setting('prueba.base')::jsonb;
  d integer;
begin
  p := public.orbe_ia_admin_get();
  -- diferencias respecto de lo que ya había: exactamente lo insertado
  l := p -> 'estadisticas' -> 'por_proposito' -> 'lieia';
  if (l ->> 'llamadas')::int - coalesce((b -> 'lieia' ->> 'llamadas')::int, 0) <> 2 or (l ->> 'reales')::int - coalesce((b -> 'lieia' ->> 'reales')::int, 0) <> 1
     or (l ->> 'gasto_usd')::numeric < 0.0116 or (l ->> 'tokens')::int < 1300 then raise exception 'FALLO: consumo de LIEIA % (antes %)', l, b -> 'lieia'; end if;
  d := ((p -> 'estadisticas' -> 'por_proposito' -> 'pulso') ->> 'reales')::int - coalesce((b -> 'pulso' ->> 'reales')::int, 0);
  if d <> 0 then raise exception 'FALLO: el pulso simulado contó como real (+%)', d; end if;
  d := ((p -> 'estadisticas' -> 'por_proposito' -> 'pulso') ->> 'llamadas')::int - coalesce((b -> 'pulso' ->> 'llamadas')::int, 0);
  if d <> 1 then raise exception 'FALLO: llamadas de pulso (+%)', d; end if;
  d := ((p -> 'estadisticas' -> 'por_proposito' -> 'chistes') ->> 'errores')::int - coalesce((b -> 'chistes' ->> 'errores')::int, 0);
  if d <> 1 then raise exception 'FALLO: errores por uso (+%)', d; end if;
  if not exists (select 1 from jsonb_array_elements(p -> 'consumo') x where x ->> 'purpose' = 'lieia') then raise exception 'FALLO: el consumo no dice el uso'; end if;
  -- lo anterior sigue igual
  if not (p ? 'config' and p ? 'cursos' and p -> 'estadisticas' ? 'gasto_mes_usd') then raise exception 'FALLO: faltan campos anteriores'; end if;
end $$;
reset role;

select 'orbe_ia_centro.sql: PRUEBAS PASARON' as resultado;
rollback;
