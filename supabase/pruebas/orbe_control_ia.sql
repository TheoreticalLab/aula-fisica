-- Pruebas: Orbe Control con Claude (migración 33). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d9400000-0000-4000-8000-000000000001', 'pa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-pulso","aula_role":"teacher"}', '{}', now(), now()),
  ('d9400000-0000-4000-8000-000000000002', 'pb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('d9400000-0000-4000-8000-000000000011', 'e1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-preg-1"}', '{}', now(), now()),
  ('d9400000-0000-4000-8000-000000000012', 'e2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-preg-2"}', '{}', now(), now()),
  ('d9400000-0000-4000-8000-000000000013', 'e3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-preg-3"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'd9400000-%';
update public.profiles set role = 'teacher' where id in ('d9400000-0000-4000-8000-000000000001', 'd9400000-0000-4000-8000-000000000002');
update public.profiles set full_name = 'Estudiante Uno' where id = 'd9400000-0000-4000-8000-000000000011';
insert into public.courses (id, title) values ('d9400000-0000-4000-8000-000000000021', 'Curso pregunta');
insert into public.units (id, course_id, slug, title) values ('d9400000-0000-4000-8000-000000000031', 'd9400000-0000-4000-8000-000000000021', 'u-preg', 'Cinemática');
insert into public.lessons (id, unit_id, course_id, slug, title, summary) values
  ('d9400000-0000-4000-8000-000000000041', 'd9400000-0000-4000-8000-000000000031', 'd9400000-0000-4000-8000-000000000021', 'l-preg', 'Velocidad media', 'Desplazamiento entre tiempo');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d9400000-0000-4000-8000-000000000051', 'd9400000-0000-4000-8000-000000000021', 'Sección pregunta', 'PREGUN01', 'd9400000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('d9400000-0000-4000-8000-000000000051', 'd9400000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('d9400000-0000-4000-8000-000000000051', 'd9400000-0000-4000-8000-000000000011'),
  ('d9400000-0000-4000-8000-000000000051', 'd9400000-0000-4000-8000-000000000012'),
  ('d9400000-0000-4000-8000-000000000051', 'd9400000-0000-4000-8000-000000000013');
-- conectados ahora: estudiantes 1 y 2 (el 3 no)
insert into public.presence_connections (conn_id, user_id, visible, last_seen) values
  ('d9400000-0000-4000-8000-0000000000c1', 'd9400000-0000-4000-8000-000000000011', true, now()),
  ('d9400000-0000-4000-8000-0000000000c2', 'd9400000-0000-4000-8000-000000000012', true, now());
update public.orbe_ia_config set enabled = true, api_real = false, daily_max_calls = 1000 where id = 1;

-- 1) reserva genérica (Edge Function): solo profesorado; lecciones solo de asignaturas que imparte
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_orbe_ia_reservar_uso('d9400000-0000-4000-8000-000000000001', 'mensaje');
  if not (r ->> 'ok')::boolean or (r ->> 'api_real')::boolean then raise exception 'FALLO: reserva de mensaje %', r; end if;
  perform public.svc_orbe_ia_finalizar_uso((r ->> 'usage_id')::bigint, true, 0, 0, null);
  begin perform public.svc_orbe_ia_finalizar_uso((r ->> 'usage_id')::bigint, true, 0, 0, null); raise exception 'FALLO: finalizó dos veces';
  exception when invalid_parameter_value then null; end;
  r := public.svc_orbe_ia_reservar_uso('d9400000-0000-4000-8000-000000000011', 'mensaje');
  if r ->> 'motivo' <> 'permiso' then raise exception 'FALLO: un estudiante reservó (%)', r; end if;
  r := public.svc_orbe_ia_reservar_uso('d9400000-0000-4000-8000-000000000001', 'chistes');
  if r ->> 'motivo' <> 'proposito' then raise exception 'FALLO: propósito no válido aceptado (%)', r; end if;
  r := public.svc_orbe_ia_reservar_uso('d9400000-0000-4000-8000-000000000002', 'pregunta', 'd9400000-0000-4000-8000-000000000041');
  if r ->> 'motivo' <> 'permiso' then raise exception 'FALLO: un profesor ajeno pidió preguntas de esa lección (%)', r; end if;
  r := public.svc_orbe_ia_reservar_uso('d9400000-0000-4000-8000-000000000001', 'pregunta', 'd9400000-0000-4000-8000-000000000041');
  if r -> 'contexto' ->> 'leccion' <> 'Velocidad media' then raise exception 'FALLO: contexto de la lección %', r; end if;
  perform public.svc_orbe_ia_finalizar_uso((r ->> 'usage_id')::bigint, false, 10, 2, 'formato');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.orbe_ia_usage where actor_id = 'd9400000-0000-4000-8000-000000000001' and purpose in ('mensaje', 'pregunta')) <> 2 then
    raise exception 'FALLO: consumo por propósito no registrado'; end if;
  if exists (select 1 from public.orbe_ia_usage where actor_id = 'd9400000-0000-4000-8000-000000000001' and cost_usd <> 0) then raise exception 'FALLO: el simulador costó'; end if;
end $$;
update public.orbe_ia_config set enabled = false where id = 1;
set local role service_role;
do $$ begin
  if public.svc_orbe_ia_reservar_uso('d9400000-0000-4000-8000-000000000001', 'pulso') ->> 'motivo' <> 'apagado' then raise exception 'FALLO: reservó con Orbe IA apagado'; end if;
end $$;
reset role;
update public.orbe_ia_config set enabled = true where id = 1;

set local role authenticated;

-- 2) pulso: el profesor ve cifras de su sección; un estudiante o un profesor ajeno, no
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.control_pulso('d9400000-0000-4000-8000-000000000051');
  if (r ->> 'conectados')::int <> 2 or (r ->> 'inscritos')::int <> 3 then raise exception 'FALLO: pulso %', r; end if;
  if r::text ~ '(Estudiante Uno|sint-preg)' then raise exception 'FALLO: el pulso trae nombres'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.control_pulso('d9400000-0000-4000-8000-000000000051'); raise exception 'FALLO: un profesor ajeno vio el pulso';
  exception when insufficient_privilege then null; end;
  begin perform public.poll_open('seccion', 'd9400000-0000-4000-8000-000000000051', '¿Pregunta ajena?', array['a', 'b'], 0, null, false, null, 2);
    raise exception 'FALLO: un profesor ajeno lanzó una pregunta'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.control_pulso(null); raise exception 'FALLO: un estudiante vio el pulso'; exception when insufficient_privilege then null; end;
  begin perform public.poll_open('conectados', null, '¿Pregunta de estudiante?', array['a', 'b'], 0, null, false, null, 2);
    raise exception 'FALLO: un estudiante lanzó una pregunta'; exception when insufficient_privilege then null; end;
end $$;

-- 3) el profesor lanza una pregunta con bloqueo a los conectados (estudiantes 1 y 2)
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.poll_open('conectados', 'd9400000-0000-4000-8000-000000000051', '¿Una sola opción?', array['a', '  '], 0, null, false, null, 2);
    raise exception 'FALLO: aceptó una sola opción'; exception when invalid_parameter_value then null; end;
  begin perform public.poll_open('conectados', 'd9400000-0000-4000-8000-000000000051', '¿Bloqueo sin código?', array['a', 'b'], 0, null, true, '12', 2);
    raise exception 'FALLO: aceptó un bloqueo sin código válido'; exception when invalid_parameter_value then null; end;
  r := public.poll_open('conectados', 'd9400000-0000-4000-8000-000000000051', '¿Qué mide la pendiente de x(t)?',
         array['La aceleración', 'La velocidad', 'La distancia'], 1, 'La pendiente es la velocidad.', true, ' 4321 ', 2);
  if (r ->> 'destinatarios')::int <> 2 then raise exception 'FALLO: destinatarios %', r; end if;
  perform set_config('prueba.p1', r ->> 'id', true);
end $$;

-- 4) estudiante 3 (no conectado al lanzarla) no la recibe; el 1 la ve sin la respuesta correcta, responde una vez y salir ya no lo bloquea
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000013', true);
do $$ begin
  if public.my_open_poll() is not null then raise exception 'FALLO: la recibió quien no estaba conectado'; end if;
  begin perform public.poll_answer(current_setting('prueba.p1')::uuid, 0); raise exception 'FALLO: respondió sin ser destinatario';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000011', true);
do $$ declare r jsonb; begin
  r := public.my_open_poll();
  if r ->> 'id' <> current_setting('prueba.p1') or r ? 'correct' or r ? 'explanation' or r::text ~ 'unlock|\$2' then raise exception 'FALLO: lo que ve el estudiante %', r; end if;
  begin perform public.poll_answer(current_setting('prueba.p1')::uuid, 7); raise exception 'FALLO: opción inexistente'; exception when invalid_parameter_value then null; end;
  if not (public.poll_answer(current_setting('prueba.p1')::uuid, 1) ->> 'ok')::boolean then raise exception 'FALLO: no registró la respuesta'; end if;
  if public.poll_answer(current_setting('prueba.p1')::uuid, 0) ->> 'motivo' <> 'ya_respondida' then raise exception 'FALLO: respondió dos veces'; end if;
  if (public.poll_left(current_setting('prueba.p1')::uuid) ->> 'bloqueado')::boolean then raise exception 'FALLO: bloqueó a quien ya respondió'; end if;
  begin perform 1 from public.quick_polls; raise exception 'FALLO: leyó las preguntas directamente'; exception when insufficient_privilege then null; end;
  begin perform answer from public.quick_poll_recipients; raise exception 'FALLO: leyó respuestas directamente'; exception when insufficient_privilege then null; end;
end $$;

-- 5) estudiante 2: salir ANTES de verla no bloquea; después de verla y sin responder, sí (con el código del profesor)
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000012', true);
do $$ begin
  perform public.presence_ping('d9400000-0000-4000-8000-0000000000c2', false);
  if (public.poll_left(current_setting('prueba.p1')::uuid) ->> 'bloqueado')::boolean or public.my_screen_lock() is not null then
    raise exception 'FALLO: bloqueó a quien no había visto la pregunta'; end if;
  perform public.my_open_poll();
  if not (public.poll_left(current_setting('prueba.p1')::uuid) ->> 'bloqueado')::boolean then raise exception 'FALLO: no bloqueó al salir'; end if;
  if public.my_open_poll() is not null then raise exception 'FALLO: siguió viendo la pregunta tras salir'; end if;
  if public.poll_answer(current_setting('prueba.p1')::uuid, 1) ->> 'motivo' <> 'bloqueado' then raise exception 'FALLO: respondió tras salir'; end if;
  if (public.unlock_screen((public.my_screen_lock() ->> 'id')::uuid, '0000') ->> 'ok')::boolean then raise exception 'FALLO: desbloqueó con un código erróneo'; end if;
  if not (public.unlock_screen((public.my_screen_lock() ->> 'id')::uuid, '4321') ->> 'ok')::boolean then raise exception 'FALLO: no desbloqueó con el código'; end if;
end $$;

-- 6) segunda pregunta (cierra la anterior): el latido de conexión con la pestaña oculta también bloquea
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.poll_results(current_setting('prueba.p1')::uuid);
  if (r ->> 'respondieron')::int <> 1 or (r ->> 'salieron')::int <> 1 or r -> 'conteo' <> '[0, 1, 0]'::jsonb or (r ->> 'correct')::int <> 1 then
    raise exception 'FALLO: resultados %', r; end if;
  r := public.poll_open('conectados', null, '¿Segunda pregunta de prueba?', array['Sí', 'No'], null, null, true, 'abcd', 1);
  perform set_config('prueba.p2', r ->> 'id', true);
  if (public.poll_results(current_setting('prueba.p1')::uuid) ->> 'abierta')::boolean then raise exception 'FALLO: no cerró la anterior'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000011', true);
do $$ begin
  if public.my_open_poll() ->> 'id' <> current_setting('prueba.p2') then raise exception 'FALLO: no recibió la segunda'; end if;
  perform public.presence_ping('d9400000-0000-4000-8000-0000000000c1', false);
  if public.my_screen_lock() is null then raise exception 'FALLO: el latido con la pestaña oculta no bloqueó'; end if;
end $$;

-- 7) el profesor libera a todos los de esa pregunta; un profesor ajeno no puede ver ni liberar
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.poll_results(current_setting('prueba.p2')::uuid); raise exception 'FALLO: un profesor ajeno vio resultados'; exception when insufficient_privilege then null; end;
  begin perform public.poll_release_all(current_setting('prueba.p2')::uuid); raise exception 'FALLO: un profesor ajeno liberó'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  if public.poll_release_all(current_setting('prueba.p2')::uuid) <> 1 then raise exception 'FALLO: liberar a todos'; end if;
  -- 8) pregunta a toda la sección, cerrada por el profesor: ya no se puede responder
  r := public.poll_open('seccion', 'd9400000-0000-4000-8000-000000000051', '¿Tercera pregunta, sin bloqueo?', array['A', 'B', 'C'], 2, null, false, null, 5);
  if (r ->> 'destinatarios')::int <> 3 then raise exception 'FALLO: destinatarios de la sección %', r; end if;
  perform set_config('prueba.p3', r ->> 'id', true);
  perform public.poll_close((r ->> 'id')::uuid);
  if jsonb_array_length(public.my_recent_polls()) <> 3 then raise exception 'FALLO: preguntas recientes'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"d9400000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9400000-0000-4000-8000-000000000013', true);
do $$ begin
  if public.my_open_poll() is not null then raise exception 'FALLO: vio una pregunta cerrada'; end if;
  if public.poll_answer(current_setting('prueba.p3')::uuid, 0) ->> 'motivo' <> 'cerrada' then raise exception 'FALLO: respondió una pregunta cerrada'; end if;
  if public.my_screen_lock() is not null then raise exception 'FALLO: bloqueó en una pregunta sin bloqueo'; end if;
end $$;

reset role;
do $$ begin
  -- el código nunca se guardó en claro
  if exists (select 1 from public.quick_polls where unlock_code_hash in ('4321', ' 4321 ', 'abcd')) then raise exception 'FALLO: código en claro'; end if;
  -- el consumo anterior a la migración sigue marcado como chistes
  if exists (select 1 from public.orbe_ia_usage where purpose is null) then raise exception 'FALLO: propósito vacío'; end if;
end $$;

select 'ORBE CONTROL CON CLAUDE: PRUEBAS PASARON' as resultado;
rollback;
