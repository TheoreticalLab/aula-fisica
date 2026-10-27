-- Pruebas: «Fallaron y luego entraron» (migración 21). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d5000000-0000-4000-8000-000000000001', 'ta@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-at","aula_role":"admin"}', '{}', now(), now()),
  ('d5000000-0000-4000-8000-000000000011', 't1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-301"}', '{}', now(), now()),
  ('d5000000-0000-4000-8000-000000000012', 't2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-302"}', '{}', now(), now()),
  ('d5000000-0000-4000-8000-000000000013', 't3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-303"}', '{}', now(), now()),
  ('d5000000-0000-4000-8000-000000000014', 't4@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-304"}', '{}', now(), now()),
  ('d5000000-0000-4000-8000-000000000015', 't5@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-305"}', '{}', now(), now()),
  ('d5000000-0000-4000-8000-000000000016', 't6@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-306"}', '{}', now(), now()),
  ('d5000000-0000-4000-8000-000000000017', 't7@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-307"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'd5000000-%';
update public.profiles set role = 'admin' where id = 'd5000000-0000-4000-8000-000000000001';

-- Historial sintético con horas explícitas (dentro de una transacción now() no avanza)
insert into public.login_attempts (login_id, user_id, ip_hash, device_hash, country, success, reason, created_at)
select l, u::uuid, ip, dev, 'DO', ok, r, now() - h::interval from (values
  -- sint-301: el titular se equivoca dos veces en su dispositivo habitual y entra → baja
  ('sint-301', 'd5000000-0000-4000-8000-000000000011', 'red-a', 'dev-a', true,  'ok',           '3 days'),
  ('sint-301', 'd5000000-0000-4000-8000-000000000011', 'red-a', 'dev-a', false, 'bad_password', '10 minutes'),
  ('sint-301', 'd5000000-0000-4000-8000-000000000011', 'red-a', 'dev-a', false, 'bad_password', '9 minutes'),
  ('sint-301', 'd5000000-0000-4000-8000-000000000011', 'red-a', 'dev-a', true,  'ok',           '8 minutes'),
  -- sint-302: un dispositivo y una red nunca vistos fallan 4 veces y ESE MISMO dispositivo entra → alta
  ('sint-302', 'd5000000-0000-4000-8000-000000000012', 'red-b', 'dev-b', true,  'ok',           '3 days'),
  ('sint-302', 'd5000000-0000-4000-8000-000000000012', 'red-x', 'dev-x', false, 'bad_password', '20 minutes'),
  ('sint-302', 'd5000000-0000-4000-8000-000000000012', 'red-x', 'dev-x', false, 'bad_password', '19 minutes'),
  ('sint-302', 'd5000000-0000-4000-8000-000000000012', 'red-x', 'dev-x', false, 'bad_password', '18 minutes'),
  ('sint-302', 'd5000000-0000-4000-8000-000000000012', 'red-x', 'dev-x', false, 'bad_password', '17 minutes'),
  ('sint-302', 'd5000000-0000-4000-8000-000000000012', 'red-x', 'dev-x', false, 'locked',       '16 minutes'),
  ('sint-302', 'd5000000-0000-4000-8000-000000000012', 'red-x', 'dev-x', true,  'ok',           '5 minutes'),
  -- sint-303: cuenta nueva, primer acceso tras dos fallos → moderada
  ('sint-303', 'd5000000-0000-4000-8000-000000000013', 'red-n', 'dev-n', false, 'bad_password', '7 minutes'),
  ('sint-303', 'd5000000-0000-4000-8000-000000000013', 'red-n', 'dev-n', false, 'bad_password', '6 minutes'),
  ('sint-303', 'd5000000-0000-4000-8000-000000000013', 'red-n', 'dev-n', true,  'ok',           '5 minutes'),
  -- sint-304: un tercero falla desde otra red; el titular entra desde su dispositivo → baja, «el que falló» NO entró
  ('sint-304', 'd5000000-0000-4000-8000-000000000014', 'red-c', 'dev-c', true,  'ok',           '2 days'),
  ('sint-304', 'd5000000-0000-4000-8000-000000000014', 'red-y', 'dev-y', false, 'bad_password', '30 minutes'),
  ('sint-304', 'd5000000-0000-4000-8000-000000000014', 'red-y', 'dev-y', false, 'bad_password', '29 minutes'),
  ('sint-304', 'd5000000-0000-4000-8000-000000000014', 'red-y', 'dev-y', false, 'bad_password', '28 minutes'),
  ('sint-304', 'd5000000-0000-4000-8000-000000000014', 'red-c', 'dev-c', true,  'ok',           '4 minutes'),
  -- sint-305: los fallos anteriores a un acceso correcto no se vuelven a contar en el siguiente
  ('sint-305', 'd5000000-0000-4000-8000-000000000015', 'red-d', 'dev-d', false, 'bad_password', '2 hours'),
  ('sint-305', 'd5000000-0000-4000-8000-000000000015', 'red-d', 'dev-d', true,  'ok',           '1 hour'),
  ('sint-305', 'd5000000-0000-4000-8000-000000000015', 'red-d', 'dev-d', true,  'ok',           '3 minutes'),
  -- sint-306: acceso sin fallos → no aparece
  ('sint-306', 'd5000000-0000-4000-8000-000000000016', 'red-e', 'dev-e', true,  'ok',           '3 minutes'),
  -- sint-307: un fallo de hace 30 h no se asocia a un acceso de ahora (ventana máxima 24 h)
  ('sint-307', 'd5000000-0000-4000-8000-000000000017', 'red-f', 'dev-f', false, 'bad_password', '30 hours'),
  ('sint-307', 'd5000000-0000-4000-8000-000000000017', 'red-f', 'dev-f', true,  'ok',           '2 minutes'),
  -- admin-at: alguien falla 3 veces desde un contexto nuevo y entra desde él → crítica (cuenta privilegiada)
  ('admin-at', 'd5000000-0000-4000-8000-000000000001', 'red-p', 'dev-p', true,  'ok',           '5 days'),
  ('admin-at', 'd5000000-0000-4000-8000-000000000001', 'red-z', 'dev-z', false, 'bad_password', '12 minutes'),
  ('admin-at', 'd5000000-0000-4000-8000-000000000001', 'red-z', 'dev-z', false, 'bad_password', '11 minutes'),
  ('admin-at', 'd5000000-0000-4000-8000-000000000001', 'red-z', 'dev-z', false, 'bad_password', '10 minutes'),
  ('admin-at', 'd5000000-0000-4000-8000-000000000001', 'red-z', 'dev-z', true,  'ok',           '9 minutes')
) v(l, u, ip, dev, ok, r, h);
-- dispositivos reconocidos por los accesos correctos antiguos
insert into public.known_devices (user_id, device_hash, first_seen, last_success) values
  ('d5000000-0000-4000-8000-000000000011', 'dev-a', now() - interval '3 days', now() - interval '3 days'),
  ('d5000000-0000-4000-8000-000000000012', 'dev-b', now() - interval '3 days', now() - interval '3 days'),
  ('d5000000-0000-4000-8000-000000000014', 'dev-c', now() - interval '2 days', now() - interval '2 days'),
  ('d5000000-0000-4000-8000-000000000001', 'dev-p', now() - interval '5 days', now() - interval '5 days');

-- 1) un estudiante no puede consultarlo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d5000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd5000000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform * from public.sec_access_after_failures(30); raise exception 'FALLO: un estudiante vio «fallaron y luego entraron»';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) administrador
select set_config('request.jwt.claims', '{"sub":"d5000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"sesion-at"}', true);
select set_config('request.jwt.claim.sub', 'd5000000-0000-4000-8000-000000000001', true);
do $$
declare r record; v_ev uuid;
begin
  -- solo las cuentas con fallos antes de entrar (de estos datos sintéticos)
  if (select count(*) from public.sec_access_after_failures(30) where login_id in ('sint-306', 'sint-307')) <> 0 then
    raise exception 'FALLO: aparecen accesos sin fallos previos en la ventana';
  end if;
  if (select count(*) from public.sec_access_after_failures(30) where login_id = 'sint-305') <> 1 then
    raise exception 'FALLO: los fallos se contaron también en el acceso siguiente';
  end if;

  select * into r from public.sec_access_after_failures(30) where login_id = 'sint-301';
  if r.nivel <> 'baja' or not r.mismo_dispositivo or not r.dispositivo_reconocido or r.fallos <> 2 then
    raise exception 'FALLO: titular que se equivocó (nivel %, reconocido %)', r.nivel, r.dispositivo_reconocido;
  end if;

  select * into r from public.sec_access_after_failures(30) where login_id = 'sint-302';
  if r.nivel <> 'alta' or not r.mismo_dispositivo or not r.mismo_origen or r.dispositivo_reconocido or r.origen_visto_antes
     or r.fallos <> 4 or r.rechazos <> 1 or r.segundos_tras_ultimo_fallo <> 660 then
    raise exception 'FALLO: «el que falló entró» (nivel %, fallos %, rechazos %, s %)', r.nivel, r.fallos, r.rechazos, r.segundos_tras_ultimo_fallo;
  end if;
  v_ev := r.event_id;

  select * into r from public.sec_access_after_failures(30) where login_id = 'sint-303';
  if r.nivel <> 'moderada' or not r.primer_acceso then raise exception 'FALLO: primer acceso (nivel %)', r.nivel; end if;

  select * into r from public.sec_access_after_failures(30) where login_id = 'sint-304';
  if r.nivel <> 'baja' or r.mismo_dispositivo or r.mismo_origen or r.fallos <> 3 then
    raise exception 'FALLO: fallos ajenos y acceso del titular (nivel %)', r.nivel;
  end if;

  select * into r from public.sec_access_after_failures(30) where login_id = 'admin-at';
  if r.nivel <> 'critica' or r.motivo not like '%Cuenta privilegiada.%' then raise exception 'FALLO: cuenta privilegiada (nivel %)', r.nivel; end if;

  -- orden: lo más grave primero
  if (select nivel from public.sec_access_after_failures(30) limit 1) <> 'critica' then raise exception 'FALLO: orden por gravedad'; end if;

  -- la clasificación manual del acceso aparece en la lista
  perform public.sec_annotate(v_ev, 'sint-302', 'no_reconozco', 'El estudiante no reconoce este acceso');
  if (select clasificacion from public.sec_access_after_failures(30) where login_id = 'sint-302') <> 'no_reconozco' then
    raise exception 'FALLO: no muestra la clasificación';
  end if;
end $$;

reset role;
do $$ begin
  if not exists (select 1 from public.security_audit where actor_id = 'd5000000-0000-4000-8000-000000000001' and action = 'consulta_acceso_tras_fallos') then
    raise exception 'FALLO: la consulta no quedó auditada';
  end if;
end $$;
select 'PRUEBAS DE «FALLARON Y LUEGO ENTRARON» PASARON' as resultado;
rollback;
