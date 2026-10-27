-- Pruebas: bloqueo de pantalla con código (migración 19). Transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d3000000-0000-4000-8000-000000000001', 'bp@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-bloq","aula_role":"teacher"}', '{}', now(), now()),
  ('d3000000-0000-4000-8000-000000000002', 'bq@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-bloq-2","aula_role":"teacher"}', '{}', now(), now()),
  ('d3000000-0000-4000-8000-000000000011', 'b1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-bloq-1"}', '{}', now(), now()),
  ('d3000000-0000-4000-8000-000000000012', 'b2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-bloq-2"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'd3000000-%';
insert into public.courses (id, title) values ('d3000000-0000-4000-8000-000000000021', 'Curso bloqueo');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d3000000-0000-4000-8000-000000000031', 'd3000000-0000-4000-8000-000000000021', 'Sección B1', 'BLOQUEA2', 'd3000000-0000-4000-8000-000000000001');
insert into public.enrollments (class_id, user_id) values
  ('d3000000-0000-4000-8000-000000000031', 'd3000000-0000-4000-8000-000000000011'),
  ('d3000000-0000-4000-8000-000000000031', 'd3000000-0000-4000-8000-000000000012');

-- un estudiante no puede bloquear
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd3000000-0000-4000-8000-000000000012', true);
do $$ begin
  begin
    perform public.send_screen_lock('Bloqueado', '1234', 'todos', null, null);
    raise exception 'FALLO: un estudiante bloqueó pantallas';
  exception when insufficient_privilege then null;
  end;
end $$;

-- el profesor bloquea al estudiante 1 con el código «Fisica-42»
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd3000000-0000-4000-8000-000000000001', true);
do $$ begin
  if (public.send_screen_lock('Pase por mi oficina antes de continuar.', 'Fisica-42', 'seleccion', array['d3000000-0000-4000-8000-000000000011']::uuid[], null) ->> 'locked')::int <> 1 then
    raise exception 'FALLO: no bloqueó';
  end if;
  if (select count(*) from public.active_screen_locks()) <> 1 then raise exception 'FALLO: bloqueos activos del profesor'; end if;
  begin
    perform public.send_screen_lock('x', '12', 'todos', null, null);
    raise exception 'FALLO: aceptó un código de 2 caracteres';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- el código no está guardado en claro
reset role;
do $$ begin
  if exists (select 1 from public.screen_locks where code_hash ilike '%fisica-42%') then raise exception 'FALLO: código en claro'; end if;
end $$;

-- estudiante 1: ve el bloqueo (sin el código), falla, y al fallar 5 veces espera; no puede leer el hash
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd3000000-0000-4000-8000-000000000011', true);
do $$
declare v_id uuid := (public.my_screen_lock() ->> 'id')::uuid; r jsonb;
begin
  if v_id is null then raise exception 'FALLO: el estudiante no ve su bloqueo'; end if;
  if public.my_screen_lock() ? 'code_hash' then raise exception 'FALLO: expuso el hash'; end if;
  begin
    perform code_hash from public.screen_locks;
    raise exception 'FALLO: leyó el hash del código';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.screen_locks set unlocked_at = now();
    raise exception 'FALLO: se desbloqueó modificando la tabla';
  exception when insufficient_privilege then null;
  end;
  for i in 1..4 loop
    r := public.unlock_screen(v_id, 'mal');
  end loop;
  if (r ->> 'ok')::boolean or r ->> 'espera_hasta' is not null then raise exception 'FALLO: 4 fallos ya imponen espera'; end if;
  r := public.unlock_screen(v_id, 'mal');
  if r ->> 'espera_hasta' is null then raise exception 'FALLO: 5 fallos no imponen espera'; end if;
  -- durante la espera ni el código correcto sirve
  r := public.unlock_screen(v_id, 'Fisica-42');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: desbloqueó durante la espera'; end if;
end $$;
-- pasa la espera; el código correcto (sin distinguir mayúsculas ni espacios) desbloquea
reset role;
update public.screen_locks set locked_until = now() - interval '1 second';
set local role authenticated;
do $$
declare v_id uuid := (public.my_screen_lock() ->> 'id')::uuid;
begin
  if not (public.unlock_screen(v_id, '  fisica-42 ') ->> 'ok')::boolean then raise exception 'FALLO: el código correcto no desbloqueó'; end if;
  if public.my_screen_lock() is not null then raise exception 'FALLO: sigue bloqueado'; end if;
end $$;

-- estudiante 2 no puede usar el desbloqueo de otro
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd3000000-0000-4000-8000-000000000001', true);
select public.send_screen_lock('Segundo bloqueo', 'abcd', 'seccion', null, 'd3000000-0000-4000-8000-000000000031');
reset role;
create temporary table otro_bloqueo on commit drop as
  select id from public.screen_locks where user_id = 'd3000000-0000-4000-8000-000000000011' and unlocked_at is null;
grant select on otro_bloqueo to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd3000000-0000-4000-8000-000000000012', true);
do $$
declare v_otro uuid := (select id from otro_bloqueo);
begin
  begin
    perform public.unlock_screen(v_otro, 'abcd');
    raise exception 'FALLO: desbloqueó la pantalla de otro estudiante';
  exception when no_data_found then null;
  end;
  begin
    perform public.release_screen_lock(v_otro);
    raise exception 'FALLO: un estudiante liberó un bloqueo';
  exception when insufficient_privilege then null;
  end;
end $$;

-- otro profesor no puede liberar; el profesor de la sección sí
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd3000000-0000-4000-8000-000000000002', true);
do $$ begin
  if exists (select 1 from public.active_screen_locks()) then raise exception 'FALLO: otro profesor ve los bloqueos'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd3000000-0000-4000-8000-000000000001', true);
do $$
declare v uuid;
begin
  select id into v from public.active_screen_locks() where user_id = 'd3000000-0000-4000-8000-000000000012';
  perform public.release_screen_lock(v);
  if (select count(*) from public.active_screen_locks()) <> 1 then raise exception 'FALLO: liberar'; end if;
end $$;

reset role;
select 'PRUEBAS DE BLOQUEO CON CÓDIGO PASARON' as resultado;
rollback;
