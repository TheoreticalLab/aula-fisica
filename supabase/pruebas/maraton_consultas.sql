-- Pruebas: Maratón — preguntas de la plataforma (migración 101). Se deshace al final.
-- Banco sintético (2 temas × 6 niveles). Profesor T (y T2 de otra sección); estudiantes S1…S4 en la sección A.
-- S1 responde «No» y sigue; S2 responde «Sí» y queda fuera; S3 no ha aceptado las condiciones; S4 intenta seguir sin responder.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('dea10000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'c' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k in (1, 2) then json_build_object('login_id', 'prof-cons' || k, 'aula_role', 'teacher')::text else json_build_object('login_id', 'sint-cons-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 2, 11, 12, 13, 14]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'dea10000-%';
update public.profiles set role = 'teacher' where id in ('dea10000-0000-4000-8000-000000000001', 'dea10000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('dea10000-0000-4000-8000-000000000021', 'Curso consultas');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('dea10000-0000-4000-8000-000000000031', 'dea10000-0000-4000-8000-000000000021', 'Sección A', 'CONSU001', 'dea10000-0000-4000-8000-000000000001'),
  ('dea10000-0000-4000-8000-000000000032', 'dea10000-0000-4000-8000-000000000021', 'Sección B', 'CONSU002', 'dea10000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('dea10000-0000-4000-8000-000000000031', 'dea10000-0000-4000-8000-000000000001'),
  ('dea10000-0000-4000-8000-000000000032', 'dea10000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'dea10000-0000-4000-8000-000000000031', ('dea10000-0000-4000-8000-0000000000' || k)::uuid from unnest(array[11, 12, 13, 14]) k;

insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-cons', 'Banco de prueba', array['dea10000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values
  ('prueba-cons', 'pa', 'Tema A', 'alta', 'verificado', 1), ('prueba-cons', 'pb', 'Tema B', 'alta', 'verificado', 2);
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'pc.' || t || '.d' || n, 'prueba-cons', t, n, 'Plantilla ' || t || n, 60, 600, 'validada'
  from unnest(array['pa', 'pb']) t cross join generate_series(1, 6) n;
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id || ' variante ' || v, '[{"etiqueta":"v","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 10) v where p.banco_id = 'prueba-cons';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', 'solución' from public.maraton_variantes where plantilla_id like 'pc.%';

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns uuid language sql as $$ select ('dea10000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid $$;
create function pg_temp.pres(p_m uuid, p_u uuid) returns uuid language sql as $$
  select presentacion_actual from public.maraton_inscripciones where maraton_id = p_m and user_id = p_u
$$;
create function pg_temp.insc(p_m uuid, p_u uuid) returns public.maraton_inscripciones language sql as $$
  select * from public.maraton_inscripciones where maraton_id = p_m and user_id = p_u
$$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Santo_Domingo')::date $$;
create temp table ids (nombre text primary key, id uuid);
grant all on ids to authenticated;

-- 1) Maratón publicado; S1, S2 y S4 empiezan la jornada (S3 no acepta las condiciones); el profesor hace su prueba
set local role authenticated;
select pg_temp.como('dea10000-0000-4000-8000-000000000001');
do $$ declare v uuid; begin
  v := public.maraton_crear('dea10000-0000-4000-8000-000000000031', '{"titulo":"M"}');
  insert into ids values ('M', v);
  perform public.maraton_guardar(v, jsonb_build_object('fecha_inicio', pg_temp.hoy()));
  perform public.maraton_cambiar_estado(v, 'publicado');
  perform public.maraton_iniciar(v);  -- recorrido de prueba del profesor
end $$;
reset role;
do $$ declare m uuid := (select id from ids where nombre = 'M'); k integer; begin
  foreach k in array array[11, 12, 14] loop
    perform pg_temp.como(pg_temp.u(k)::text);
    perform public.maraton_iniciar(m);
    if pg_temp.pres(m, pg_temp.u(k)) is null then raise exception 'FALLO: S% sin problema', k - 10; end if;
  end loop;
  perform pg_temp.como(pg_temp.u(13)::text);
  perform public.maraton_estado(m);
  -- sin pregunta todavía: nadie tiene nada pendiente
  perform pg_temp.como(pg_temp.u(11)::text);
  if public.maraton_consulta_pendiente(m) is not null then raise exception 'FALLO: pregunta sin haberla creado'; end if;
end $$;

-- 2) La plataforma hace la pregunta
insert into public.maraton_consultas (id, maraton_id, titulo, texto, fuera_si)
select 'dea10000-0000-4000-8000-0000000000c1', id, 'Uso de inteligencia artificial', '¿Ha utilizado inteligencia artificial…?', true from ids where nombre = 'M';

-- 3) Quién la ve: participantes dentro (S1, S2, S4); no S3 (no aceptó), ni el profesor en su prueba, ni otro estudiante
do $$ declare m uuid := (select id from ids where nombre = 'M'); r jsonb; begin
  perform pg_temp.como(pg_temp.u(11)::text);
  r := public.maraton_consulta_pendiente(m);
  if r ->> 'id' <> 'dea10000-0000-4000-8000-0000000000c1' or r ->> 'titulo' <> 'Uso de inteligencia artificial' or r ->> 'texto' is null then
    raise exception 'FALLO: S1 no ve la pregunta: %', r; end if;
  if r ? 'fuera_si' then raise exception 'FALLO: datos internos en la pregunta: %', r; end if;
  perform pg_temp.como(pg_temp.u(13)::text);
  if public.maraton_consulta_pendiente(m) is not null then raise exception 'FALLO: S3 (sin aceptar) ve la pregunta'; end if;
  perform pg_temp.como('dea10000-0000-4000-8000-000000000001');
  if public.maraton_consulta_pendiente(m) is not null then raise exception 'FALLO: el profesor en prueba ve la pregunta'; end if;
  perform pg_temp.como('dea10000-0000-4000-8000-000000000002');
  begin perform public.maraton_consulta_pendiente(m); raise exception 'FALLO: profesor de otra sección';
  exception when insufficient_privilege then null; end;
end $$;

-- 4) Sin responder no se puede seguir (S4): ni entregar, ni «No puedo», ni cambiar; el problema sigue abierto
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(14); p uuid; begin
  p := pg_temp.pres(m, u);
  begin perform public.svc_maraton_responder(u, p, gen_random_uuid(), '{"partes":["1 m/s"]}', null, 120, true, null);
    raise exception 'FALLO: respondió con la pregunta pendiente';
  exception when raise_exception then
    if sqlerrm not like '%pregunta pendiente%' then raise; end if;
  end;
  perform pg_temp.como(u::text);
  begin perform public.maraton_no_puedo(p, gen_random_uuid(), 5, null); raise exception 'FALLO: «No puedo» con la pregunta pendiente';
  exception when raise_exception then if sqlerrm not like '%pregunta pendiente%' then raise; end if; end;
  begin perform public.maraton_cambiar(p, gen_random_uuid(), 5); raise exception 'FALLO: cambió con la pregunta pendiente';
  exception when raise_exception then if sqlerrm not like '%pregunta pendiente%' then raise; end if; end;
  if pg_temp.pres(m, u) is distinct from p then raise exception 'FALLO: el problema cambió'; end if;
  -- el profesor en prueba no se ve afectado
  perform public.svc_maraton_responder('dea10000-0000-4000-8000-000000000001', pg_temp.pres(m, 'dea10000-0000-4000-8000-000000000001'),
    gen_random_uuid(), '{"partes":["1 m/s"]}', null, 120, true, null);
end $$;

-- 5) S1 responde «No»: queda registrado, sigue en el maratón y puede continuar; responder otra vez no cambia nada
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(11); r jsonb; p uuid; begin
  perform pg_temp.como(u::text);
  r := public.maraton_declarar(m, 'dea10000-0000-4000-8000-0000000000c1', false);
  if r -> 'fuera' <> 'null'::jsonb and r -> 'fuera' is not null then raise exception 'FALLO: «No» dejó fuera: %', r -> 'fuera'; end if;
  if r -> 'problema' ->> 'presentacion_id' is null then raise exception 'FALLO: perdió el problema: %', r; end if;
  r := public.maraton_declarar(m, 'dea10000-0000-4000-8000-0000000000c1', true);
  if (pg_temp.insc(m, u)).fuera_at is not null then raise exception 'FALLO: cambió su respuesta a «Sí»'; end if;
  if (select count(*) from public.maraton_declaraciones where user_id = u) <> 1
     or (select respuesta from public.maraton_declaraciones where user_id = u) then raise exception 'FALLO: registro de S1'; end if;
  if public.maraton_consulta_pendiente(m) is not null then raise exception 'FALLO: sigue pendiente tras responder'; end if;
  p := pg_temp.pres(m, u);
  perform public.svc_maraton_responder(u, p, gen_random_uuid(), '{"partes":["1 m/s"]}', null, 120, true, null);
  if pg_temp.pres(m, u) is null or pg_temp.pres(m, u) = p then raise exception 'FALLO: S1 no pudo continuar'; end if;
  if not exists (select 1 from public.maraton_eventos where maraton_id = m and user_id = u and tipo = 'declaracion' and datos ->> 'respuesta' = 'no') then
    raise exception 'FALLO: sin evento de S1'; end if;
end $$;

-- 6) S2 responde «Sí»: fuera del maratón (tipo declaracion), jornada cerrada como incompleta, problema retirado
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(12); r jsonb; i public.maraton_inscripciones; p uuid; begin
  p := pg_temp.pres(m, u);
  perform pg_temp.como(u::text);
  r := public.maraton_declarar(m, 'dea10000-0000-4000-8000-0000000000c1', true);
  i := pg_temp.insc(m, u);
  if i.fuera_tipo is distinct from 'declaracion' or i.fuera_jornada <> 1 or i.presentacion_actual is not null then raise exception 'FALLO: «Sí» no dejó fuera: %', to_jsonb(i); end if;
  if r -> 'fuera' ->> 'tipo' <> 'declaracion' or r -> 'fuera' ? 'motivo' then raise exception 'FALLO: estado de S2: %', r -> 'fuera'; end if;
  if (select estado from public.maraton_jornadas where inscripcion_id = i.id and numero = 1) <> 'incompleta' then raise exception 'FALLO: la jornada de S2 no se cerró'; end if;
  if (select accion from public.maraton_presentaciones where id = p) <> 'cierre' then raise exception 'FALLO: el problema de S2 sigue abierto'; end if;
  r := public.maraton_iniciar(m);
  if r -> 'problema' <> 'null'::jsonb and r -> 'problema' is not null then raise exception 'FALLO: S2 recibió otro problema'; end if;
end $$;

-- 7) Las respuestas no se cambian ni se borran
do $$ begin
  begin update public.maraton_declaraciones set respuesta = false where user_id = pg_temp.u(12); raise exception 'FALLO: se cambió una respuesta';
  exception when insufficient_privilege then null; end;
  begin delete from public.maraton_declaraciones where user_id = pg_temp.u(11); raise exception 'FALLO: se borró una respuesta';
  exception when insufficient_privilege then null; end;
end $$;

-- 8) El profesor ve las respuestas y quién falta (S4; S3 no ha aceptado; S2 ya respondió); otro profesor no; nadie lee las tablas
set local role authenticated;
select pg_temp.como('dea10000-0000-4000-8000-000000000001');
do $$ declare m uuid := (select id from ids where nombre = 'M'); r jsonb; begin
  r := public.maraton_consultas_docente(m) -> 0;
  if jsonb_array_length(r -> 'respuestas') <> 2 or not (r -> 'activa')::boolean then raise exception 'FALLO: respuestas para el profesor: %', r; end if;
  if (select array_agg(x ->> 'login_id' order by x ->> 'login_id') from jsonb_array_elements(r -> 'respuestas') x) <> array['sint-cons-s1', 'sint-cons-s2']
     or (select bool_or((x ->> 'respuesta')::boolean) filter (where x ->> 'login_id' = 'sint-cons-s1') from jsonb_array_elements(r -> 'respuestas') x) then
    raise exception 'FALLO: detalle de respuestas: %', r -> 'respuestas'; end if;
  if (select array_agg(x ->> 'login_id') from jsonb_array_elements(r -> 'pendientes') x) <> array['sint-cons-s4'] then raise exception 'FALLO: pendientes: %', r -> 'pendientes'; end if;
  begin perform 1 from public.maraton_declaraciones; raise exception 'FALLO: lectura directa de las respuestas';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('dea10000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.maraton_consultas_docente((select id from ids where nombre = 'M')); raise exception 'FALLO: profesor de otra sección ve las respuestas';
  exception when insufficient_privilege then null; end;
  begin perform public.maraton_consulta_cerrar('dea10000-0000-4000-8000-0000000000c1'); raise exception 'FALLO: profesor de otra sección cierra la pregunta';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('dea10000-0000-4000-8000-000000000014');
do $$ begin
  begin perform public.maraton_consultas_docente((select id from ids where nombre = 'M')); raise exception 'FALLO: un estudiante ve las respuestas';
  exception when insufficient_privilege then null; end;
end $$;

-- 9) El profesor cierra la pregunta: S4 ya no la ve y puede seguir; ya no se puede responder
select pg_temp.como('dea10000-0000-4000-8000-000000000001');
do $$ declare r jsonb := public.maraton_consulta_cerrar('dea10000-0000-4000-8000-0000000000c1') -> 0; begin
  if (r -> 'activa')::boolean or r ->> 'cerrada_at' is null then raise exception 'FALLO: no se cerró: %', r; end if;
end $$;
reset role;
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(14); p uuid := pg_temp.pres(m, u); begin
  perform pg_temp.como(u::text);
  if public.maraton_consulta_pendiente(m) is not null then raise exception 'FALLO: pregunta cerrada aún pendiente'; end if;
  begin perform public.maraton_declarar(m, 'dea10000-0000-4000-8000-0000000000c1', false); raise exception 'FALLO: respondió una pregunta cerrada';
  exception when raise_exception then null; end;
  perform public.svc_maraton_responder(u, p, gen_random_uuid(), '{"partes":["1 m/s"]}', null, 120, true, null);
  if pg_temp.pres(m, u) = p then raise exception 'FALLO: S4 no pudo seguir'; end if;
end $$;

-- 10) Reincorporación de quien respondió «Sí» (como cualquier otra salida)
select pg_temp.como('dea10000-0000-4000-8000-000000000001');
do $$ declare m uuid := (select id from ids where nombre = 'M'); begin
  perform public.maraton_reincorporar(m, pg_temp.u(12), 'Se equivocó al marcar; lo confirmó en persona');
  if (pg_temp.insc(m, pg_temp.u(12))).fuera_at is not null then raise exception 'FALLO: no se reincorporó'; end if;
end $$;

-- 11) Permisos
do $$ begin
  if has_function_privilege('anon', 'public.maraton_declarar(uuid, uuid, boolean)', 'execute')
     or has_function_privilege('anon', 'public.maraton_consulta_pendiente(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.maraton_consulta_de(public.maraton_inscripciones)', 'execute')
     or has_function_privilege('authenticated', 'public.maraton_previo(public.maraton_actividades, public.maraton_inscripciones, uuid, uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.maraton_declarar(uuid, uuid, boolean)', 'execute')
     or has_table_privilege('authenticated', 'public.maraton_consultas', 'select') then
    raise exception 'FALLO: permisos';
  end if;
end $$;

select 'MARATÓN CONSULTAS: PRUEBAS PASARON' as resultado;
rollback;
