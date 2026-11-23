-- Pruebas: práctica secuencial con aviso de rapidez y mensaje tras «Sí» (migración 110). Se deshace al final.
-- Profesor T de la sección A (T2 de la B); estudiantes S1, S2 en la A (S2 dado de baja no aplica aquí), S5 en la B.
-- Práctica P (secuencial) y examen E de la sección A; práctica Q sin configuración.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('dea11000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'ps' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k in (1, 2) then json_build_object('login_id', 'prof-psec' || k, 'aula_role', 'teacher')::text else json_build_object('login_id', 'sint-psec-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 2, 11, 15]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'dea11000-%';
update public.profiles set role = 'teacher' where id in ('dea11000-0000-4000-8000-000000000001', 'dea11000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('dea11000-0000-4000-8000-000000000021', 'Curso secuencial');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('dea11000-0000-4000-8000-000000000031', 'dea11000-0000-4000-8000-000000000021', 'Sección A', 'PSECA001', 'dea11000-0000-4000-8000-000000000001'),
  ('dea11000-0000-4000-8000-000000000032', 'dea11000-0000-4000-8000-000000000021', 'Sección B', 'PSECB002', 'dea11000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('dea11000-0000-4000-8000-000000000031', 'dea11000-0000-4000-8000-000000000001'),
  ('dea11000-0000-4000-8000-000000000032', 'dea11000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('dea11000-0000-4000-8000-000000000031', 'dea11000-0000-4000-8000-000000000011'),
  ('dea11000-0000-4000-8000-000000000032', 'dea11000-0000-4000-8000-000000000015');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('dea11000-0000-4000-8000-000000000041', 'dea11000-0000-4000-8000-000000000031', 'Práctica P', 'practice', true, 'immediate', true, 3),
  ('dea11000-0000-4000-8000-000000000042', 'dea11000-0000-4000-8000-000000000031', 'Práctica Q', 'practice', true, 'immediate', true, 3),
  ('dea11000-0000-4000-8000-000000000043', 'dea11000-0000-4000-8000-000000000031', 'Examen E', 'exam', true, 'never', false, 1);
insert into public.practica_secuencial (activity_id, aviso) values
  ('dea11000-0000-4000-8000-000000000041', 'Me parece que estás usando asistencia artificial, pero puedes continuar.'),
  ('dea11000-0000-4000-8000-000000000043', 'No debería aplicar a un examen.');
insert into public.actividad_consultas (id, activity_id, titulo, texto, mensaje_si) values
  ('dea11000-0000-4000-8000-000000000051', 'dea11000-0000-4000-8000-000000000041', 'Pregunta de la plataforma', '¿Usará inteligencia artificial?',
   'Recuerde que en esta práctica no se puede usar.');

-- restricciones: mensaje demasiado corto y umbral negativo
do $$ begin
  begin
    update public.actividad_consultas set mensaje_si = 'x' where id = 'dea11000-0000-4000-8000-000000000051';
    raise exception 'debió rechazar un mensaje de 1 carácter';
  exception when check_violation then null; end;
  begin
    update public.practica_secuencial set umbral_basico_s = -1 where activity_id = 'dea11000-0000-4000-8000-000000000041';
    raise exception 'debió rechazar un umbral negativo';
  exception when check_violation then null; end;
end $$;

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns text language sql as $$ select 'dea11000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0') $$;

set local role authenticated;

-- 1) la configuración: estudiante de la sección y su profesor sí; otra sección, sin sesión, sin config o examen, no
do $$ declare c jsonb; begin
  perform pg_temp.como(pg_temp.u(11));
  c := public.practica_secuencial_config('dea11000-0000-4000-8000-000000000041');
  if c is null then raise exception 'S1 debería recibir la configuración'; end if;
  if (c -> 'umbrales' ->> 'basico')::int <> 120 or (c -> 'umbrales' ->> 'intermedio')::int <> 300 or (c -> 'umbrales' ->> 'desafiante')::int <> 480 then
    raise exception 'umbrales por defecto incorrectos: %', c; end if;
  if not (c ->> 'aleatorio')::boolean then raise exception 'debería ser aleatoria por defecto'; end if;
  if c ->> 'aviso' not like 'Me parece%' then raise exception 'falta el aviso'; end if;
  if public.practica_secuencial_config('dea11000-0000-4000-8000-000000000042') is not null then raise exception 'Q no tiene configuración'; end if;
  if public.practica_secuencial_config('dea11000-0000-4000-8000-000000000043') is not null then raise exception 'un examen nunca es práctica secuencial'; end if;
  perform pg_temp.como(pg_temp.u(1));
  if public.practica_secuencial_config('dea11000-0000-4000-8000-000000000041') is null then raise exception 'el profesor de la sección debería verla'; end if;
  perform pg_temp.como(pg_temp.u(2));
  if public.practica_secuencial_config('dea11000-0000-4000-8000-000000000041') is not null then raise exception 'T2 es de otra sección'; end if;
  perform pg_temp.como(pg_temp.u(15));
  if public.practica_secuencial_config('dea11000-0000-4000-8000-000000000041') is not null then raise exception 'S5 es de otra sección'; end if;
end $$;

-- 2) sin acceso directo a la tabla
do $$ begin
  perform 1 from public.practica_secuencial;
  raise exception 'authenticated no debería leer la tabla';
exception when insufficient_privilege then null; end $$;

-- 3) mensaje tras «Sí» en la pregunta pendiente
do $$ declare q jsonb; begin
  perform pg_temp.como(pg_temp.u(11));
  q := public.actividad_consulta_pendiente('dea11000-0000-4000-8000-000000000041');
  if q ->> 'mensaje_si' is distinct from 'Recuerde que en esta práctica no se puede usar.' then raise exception 'falta mensaje_si: %', q; end if;
  if q ->> 'texto' is distinct from '¿Usará inteligencia artificial?' then raise exception 'cambió el texto'; end if;
  perform public.actividad_declarar('dea11000-0000-4000-8000-000000000051', true);
  if public.actividad_consulta_pendiente('dea11000-0000-4000-8000-000000000041') is not null then raise exception 'ya respondió'; end if;
end $$;

reset role;
-- 4) anon no puede llamar a la función
do $$ begin
  if has_function_privilege('anon', 'public.practica_secuencial_config(uuid)', 'execute') then raise exception 'anon no debe ejecutarla'; end if;
  if not has_function_privilege('authenticated', 'public.practica_secuencial_config(uuid)', 'execute') then raise exception 'authenticated debe ejecutarla'; end if;
end $$;

select 'practica_secuencial.sql: PRUEBAS PASARON' as resultado;
rollback;
