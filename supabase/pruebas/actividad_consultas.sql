-- Pruebas: preguntas de la plataforma en una práctica (migración 108). Se deshace al final.
-- Profesor T de la sección A (y T2 de la B); estudiantes S1…S4 en la A, S5 en la B. Pregunta en la práctica P de la A,
-- con S4 excluido. S1 responde «No»; S2 responde «Sí»; S3 no ha respondido; S4 (excluido) y S5 (otra sección) no la ven.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('dea10800-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'q' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k in (1, 2) then json_build_object('login_id', 'prof-acons' || k, 'aula_role', 'teacher')::text else json_build_object('login_id', 'sint-acons-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 2, 11, 12, 13, 14, 15]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'dea10800-%';
update public.profiles set role = 'teacher' where id in ('dea10800-0000-4000-8000-000000000001', 'dea10800-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('dea10800-0000-4000-8000-000000000021', 'Curso preguntas');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('dea10800-0000-4000-8000-000000000031', 'dea10800-0000-4000-8000-000000000021', 'Sección A', 'ACONS001', 'dea10800-0000-4000-8000-000000000001'),
  ('dea10800-0000-4000-8000-000000000032', 'dea10800-0000-4000-8000-000000000021', 'Sección B', 'ACONS002', 'dea10800-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('dea10800-0000-4000-8000-000000000031', 'dea10800-0000-4000-8000-000000000001'),
  ('dea10800-0000-4000-8000-000000000032', 'dea10800-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'dea10800-0000-4000-8000-000000000031', ('dea10800-0000-4000-8000-0000000000' || k)::uuid from unnest(array[11, 12, 13, 14]) k;
insert into public.enrollments (class_id, user_id) values ('dea10800-0000-4000-8000-000000000032', 'dea10800-0000-4000-8000-000000000015');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('dea10800-0000-4000-8000-000000000041', 'dea10800-0000-4000-8000-000000000031', 'Práctica P', 'practice', true, 'immediate', true, 3),
  ('dea10800-0000-4000-8000-000000000042', 'dea10800-0000-4000-8000-000000000031', 'Práctica Q', 'practice', true, 'immediate', true, 3);
insert into public.actividad_consultas (id, activity_id, titulo, texto, excluidos) values
  ('dea10800-0000-4000-8000-000000000051', 'dea10800-0000-4000-8000-000000000041', 'Uso de inteligencia artificial',
   '¿Está usando inteligencia artificial para resolver esta práctica?', array['dea10800-0000-4000-8000-000000000014'::uuid]);

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns text language sql as $$ select 'dea10800-0000-4000-8000-0000000000' || lpad(k::text, 2, '0') $$;

set local role authenticated;

-- 1) quién la ve
do $$ begin
  perform pg_temp.como(pg_temp.u(11));
  if public.actividad_consulta_pendiente('dea10800-0000-4000-8000-000000000041') ->> 'titulo' is distinct from 'Uso de inteligencia artificial' then
    raise exception 'S1 debería ver la pregunta'; end if;
  if public.actividad_consulta_pendiente('dea10800-0000-4000-8000-000000000042') is not null then raise exception 'la otra práctica no tiene pregunta'; end if;
  perform pg_temp.como(pg_temp.u(14));
  if public.actividad_consulta_pendiente('dea10800-0000-4000-8000-000000000041') is not null then raise exception 'S4 está excluido'; end if;
  perform pg_temp.como(pg_temp.u(15));
  if public.actividad_consulta_pendiente('dea10800-0000-4000-8000-000000000041') is not null then raise exception 'S5 es de otra sección'; end if;
  perform pg_temp.como(pg_temp.u(1));
  if public.actividad_consulta_pendiente('dea10800-0000-4000-8000-000000000041') is not null then raise exception 'el profesor no responde'; end if;
end $$;

-- 2) responder: una vez, idempotente, sin poder cambiarla; los ajenos no pueden
do $$ declare r jsonb; begin
  perform pg_temp.como(pg_temp.u(11));
  r := public.actividad_declarar('dea10800-0000-4000-8000-000000000051', false);
  if r is not null then raise exception 'tras responder no queda nada pendiente'; end if;
  perform public.actividad_declarar('dea10800-0000-4000-8000-000000000051', true);   -- doble clic con otra respuesta: no cambia
  if public.actividad_consulta_pendiente('dea10800-0000-4000-8000-000000000041') is not null then raise exception 'S1 ya respondió'; end if;
  perform pg_temp.como(pg_temp.u(12));
  perform public.actividad_declarar('dea10800-0000-4000-8000-000000000051', true);
  begin
    perform pg_temp.como(pg_temp.u(14));
    perform public.actividad_declarar('dea10800-0000-4000-8000-000000000051', true);
    raise exception 'S4 (excluido) no debería poder responder';
  exception when insufficient_privilege then null; end;
  begin
    perform pg_temp.como(pg_temp.u(15));
    perform public.actividad_declarar('dea10800-0000-4000-8000-000000000051', false);
    raise exception 'S5 (otra sección) no debería poder responder';
  exception when insufficient_privilege then null; end;
  begin
    perform pg_temp.como(pg_temp.u(13));
    perform public.actividad_declarar('dea10800-0000-4000-8000-000000000051', null);
    raise exception 'sin respuesta no se registra';
  exception when invalid_parameter_value then null; end;
end $$;

-- 3) sin acceso directo a las tablas
do $$ begin
  begin
    perform 1 from public.actividad_declaraciones limit 1;
    raise exception 'un estudiante no debería leer la tabla de respuestas';
  exception when insufficient_privilege then null; end;
end $$;

-- 4) profesor: respuestas, pendientes y excluidos; otro profesor no
do $$ declare r jsonb; q jsonb; begin
  perform pg_temp.como(pg_temp.u(1));
  r := public.actividad_consultas_docente('dea10800-0000-4000-8000-000000000041');
  q := r -> 0;
  if jsonb_array_length(r) <> 1 or jsonb_array_length(q -> 'respuestas') <> 2 then raise exception 'esperaba 2 respuestas: %', r; end if;
  if (select (x ->> 'respuesta')::boolean from jsonb_array_elements(q -> 'respuestas') x where x ->> 'user_id' = pg_temp.u(11)) is distinct from false
     or (select (x ->> 'respuesta')::boolean from jsonb_array_elements(q -> 'respuestas') x where x ->> 'user_id' = pg_temp.u(12)) is distinct from true then
    raise exception 'respuestas mal registradas: %', q -> 'respuestas'; end if;
  if jsonb_array_length(q -> 'pendientes') <> 1 or q -> 'pendientes' -> 0 ->> 'user_id' <> pg_temp.u(13)
     or (q -> 'pendientes' -> 0 ->> 'empezo')::boolean then raise exception 'pendiente: solo S3, sin empezar: %', q -> 'pendientes'; end if;
  if jsonb_array_length(q -> 'excluidos') <> 1 or q -> 'excluidos' -> 0 ->> 'user_id' <> pg_temp.u(14) then raise exception 'excluido: S4'; end if;
  begin
    perform pg_temp.como(pg_temp.u(2));
    perform public.actividad_consultas_docente('dea10800-0000-4000-8000-000000000041');
    raise exception 'el profesor de otra sección no debería ver las respuestas';
  exception when insufficient_privilege then null; end;
  begin
    perform pg_temp.como(pg_temp.u(11));
    perform public.actividad_consultas_docente('dea10800-0000-4000-8000-000000000041');
    raise exception 'un estudiante no debería ver las respuestas';
  exception when insufficient_privilege then null; end;
end $$;

-- 5) cerrar: S3 ya no la ve y no puede responder; las respuestas siguen
do $$ declare r jsonb; begin
  perform pg_temp.como(pg_temp.u(1));
  r := public.actividad_consulta_cerrar('dea10800-0000-4000-8000-000000000051');
  if (r -> 0 ->> 'activa')::boolean or jsonb_array_length(r -> 0 -> 'respuestas') <> 2 then raise exception 'cerrar: %', r; end if;
  perform pg_temp.como(pg_temp.u(13));
  if public.actividad_consulta_pendiente('dea10800-0000-4000-8000-000000000041') is not null then raise exception 'cerrada: no se muestra'; end if;
  begin
    perform public.actividad_declarar('dea10800-0000-4000-8000-000000000051', false);
    raise exception 'una pregunta cerrada no debería admitir respuestas';
  exception when raise_exception then
    if sqlerrm <> 'Esa pregunta ya está cerrada' then raise; end if;
  end;
end $$;

reset role;

-- 6) las respuestas no se cambian ni se borran
do $$ begin
  begin
    update public.actividad_declaraciones set respuesta = not respuesta where consulta_id = 'dea10800-0000-4000-8000-000000000051';
    raise exception 'no debería poder cambiarse una respuesta';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.actividad_declaraciones where consulta_id = 'dea10800-0000-4000-8000-000000000051';
    raise exception 'no debería poder borrarse una respuesta';
  exception when insufficient_privilege then null; end;
end $$;

select 'PRUEBAS DE PREGUNTAS EN PRÁCTICAS PASARON' as resultado;
rollback;
