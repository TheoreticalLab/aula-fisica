-- Pruebas: AURORA-07, entrevista automatizada con guion determinista (migración 105). Se deshace al final.
-- Profesor T (sección A) y T2 (sección B); estudiantes S1 (entrevistado) y S2 en la sección A.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('de105000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'au' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k in (1, 2) then json_build_object('login_id', 'prof-au' || k, 'aula_role', 'teacher')::text else json_build_object('login_id', 'sint-au-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 2, 11, 12]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'de105000-%';
update public.profiles set role = 'teacher' where id in ('de105000-0000-4000-8000-000000000001', 'de105000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de105000-0000-4000-8000-000000000021', 'Curso AU');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de105000-0000-4000-8000-000000000031', 'de105000-0000-4000-8000-000000000021', 'Sección A', 'AURO0001', 'de105000-0000-4000-8000-000000000001'),
  ('de105000-0000-4000-8000-000000000032', 'de105000-0000-4000-8000-000000000021', 'Sección B', 'AURO0002', 'de105000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('de105000-0000-4000-8000-000000000031', 'de105000-0000-4000-8000-000000000001'),
  ('de105000-0000-4000-8000-000000000032', 'de105000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'de105000-0000-4000-8000-000000000031', ('de105000-0000-4000-8000-0000000000' || k)::uuid from unnest(array[11, 12]) k;
insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-au', 'Banco de prueba', array['de105000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values ('prueba-au', 'pa', 'Tema A', 'alta', 'verificado', 1);
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'au.pa.d' || n, 'prueba-au', 'pa', n, 'Plantilla ' || n, 60, 600, 'validada' from generate_series(1, 6) n;
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id, '[{"etiqueta":"v","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 5) v where p.banco_id = 'prueba-au';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', 'solución' from public.maraton_variantes where plantilla_id like 'au.%';

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns uuid language sql as $$ select ('de105000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid $$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Santo_Domingo')::date $$;
create temp table ids (nombre text primary key, id uuid);
grant all on ids to authenticated;

-- 1) Maratón publicado; S1 empieza y responde un problema (para tener registros)
set local role authenticated;
select pg_temp.como('de105000-0000-4000-8000-000000000001');
do $$ declare v uuid; begin
  v := public.maraton_crear('de105000-0000-4000-8000-000000000031', '{"titulo":"M"}');
  insert into ids values ('M', v);
  perform public.maraton_guardar(v, jsonb_build_object('fecha_inicio', pg_temp.hoy()));
  perform public.maraton_cambiar_estado(v, 'publicado');
end $$;
reset role;
do $$ declare m uuid := (select id from ids where nombre = 'M'); p uuid; begin
  perform pg_temp.como(pg_temp.u(11)::text);
  perform public.maraton_iniciar(m);
  select presentacion_actual into p from public.maraton_inscripciones where maraton_id = m and user_id = pg_temp.u(11);
  perform public.svc_maraton_responder(pg_temp.u(11), p, gen_random_uuid(), '{"partes":["1 m/s"]}', 'mi procedimiento', 120, true, null);
end $$;
create temp table antes as select (select count(*) from public.maraton_presentaciones) p, (select count(*) from public.maraton_jornadas) j,
  (select count(*) from public.maraton_eventos) ev, (select nivel from public.maraton_inscripciones where user_id = pg_temp.u(11)) nivel;

-- 2) Guion inválido: se rechaza; guion válido: se carga «preparada"
do $$ declare m uuid := (select id from ids where nombre = 'M'); begin
  begin
    insert into public.aurora_entrevistas (user_id, maraton_id, jornadas, titulo, titulo_informe, guion)
    values (pg_temp.u(11), m, '{1}', 'AURORA-07', 'Informe', '{"inicio":"a","nodos":{"a":{"tipo":"opcion","texto":"¿?","opciones":[{"valor":"x","texto":"X"}]}}}');
    raise exception 'FALLO: aceptó un guion inválido';
  exception when invalid_parameter_value then null; end;
  insert into ids values ('E', gen_random_uuid());
  insert into public.aurora_entrevistas (id, user_id, maraton_id, jornadas, titulo, titulo_informe, guion)
  values ((select id from ids where nombre = 'E'), pg_temp.u(11), m, '{1}', 'AURORA-07', 'AURORA-07 — Informe: S1', $g$
  {"inicio": "intro", "nodos": {
    "intro": {"tipo": "info", "texto": "Soy AURORA-07.", "boton": "Comenzar", "siguiente": "papel"},
    "papel": {"tipo": "opcion", "texto": "¿Usó papel?", "afirmacion": "papel", "opciones": [
       {"valor": "si", "texto": "Sí"}, {"valor": "no", "texto": "No"}, {"valor": "otro", "texto": "Otro", "pide_texto": true}], "siguiente": "pantalla"},
    "pantalla": {"tipo": "opcion", "texto": "¿Salió de la pantalla?", "opciones": [{"valor": "si", "texto": "Sí"}, {"valor": "no", "texto": "No"}],
       "ramas": [{"si": {"nodo": "papel", "en": ["si"]}, "ir": "hojas"}], "siguiente": "proc"},
    "hojas": {"tipo": "opcion", "texto": "¿Conserva las hojas?", "opciones": [{"valor": "si", "texto": "Sí"}, {"valor": "no", "texto": "No"}], "siguiente": "proc"},
    "proc": {"tipo": "texto", "texto": "Explique su procedimiento.", "max": 50, "siguiente": "extra"},
    "extra": {"tipo": "texto", "texto": "¿Algo más?", "opcional": true, "siguiente": "fin"},
    "fin": {"tipo": "fin", "texto": "Gracias."}}}$g$);
end $$;

-- 3) Preparada: nadie la ve ni la responde; otro profesor no la habilita
do $$ declare e uuid := (select id from ids where nombre = 'E'); begin
  perform pg_temp.como(pg_temp.u(11)::text);
  if public.aurora_pendiente() <> '[]'::jsonb then raise exception 'FALLO: preparada visible'; end if;
  begin perform public.aurora_estado(e); raise exception 'FALLO: estado de una preparada'; exception when insufficient_privilege then null; end;
  begin perform public.aurora_responder(e, 'intro', null, null, gen_random_uuid()); raise exception 'FALLO: respondió una preparada';
  exception when insufficient_privilege then null; end;
  perform pg_temp.como(pg_temp.u(2)::text);
  begin perform public.aurora_habilitar(e); raise exception 'FALLO: otro profesor la habilitó'; exception when insufficient_privilege then null; end;
  begin perform public.aurora_informe(e); raise exception 'FALLO: otro profesor vio el informe'; exception when insufficient_privilege then null; end;
  perform pg_temp.como(pg_temp.u(11)::text);
  begin perform public.aurora_habilitar(e); raise exception 'FALLO: el estudiante la habilitó'; exception when insufficient_privilege then null; end;
end $$;

-- 4) El profesor la habilita (una sola vez)
do $$ declare e uuid := (select id from ids where nombre = 'E'); r jsonb; begin
  perform pg_temp.como(pg_temp.u(1)::text);
  r := public.aurora_habilitar(e);
  if r -> 'entrevista' ->> 'estado' <> 'abierta' or jsonb_array_length(r -> 'presentaciones') <> 2 then raise exception 'FALLO: habilitar: %', r -> 'entrevista'; end if;
  begin perform public.aurora_habilitar(e); raise exception 'FALLO: habilitó dos veces'; exception when raise_exception then null; end;
end $$;

-- 5) S1 la ve y responde; S2 no puede verla
do $$ declare e uuid := (select id from ids where nombre = 'E'); r jsonb; i1 uuid := gen_random_uuid(); begin
  perform pg_temp.como(pg_temp.u(12)::text);
  if public.aurora_pendiente() <> '[]'::jsonb then raise exception 'FALLO: S2 ve la entrevista de S1'; end if;
  begin perform public.aurora_estado(e); raise exception 'FALLO: S2 vio el estado'; exception when insufficient_privilege then null; end;
  begin perform public.aurora_responder(e, 'intro', null, null, gen_random_uuid()); raise exception 'FALLO: S2 respondió'; exception when insufficient_privilege then null; end;
  perform pg_temp.como(pg_temp.u(11)::text);
  if jsonb_array_length(public.aurora_pendiente()) <> 1 then raise exception 'FALLO: S1 no ve su entrevista'; end if;
  r := public.aurora_estado(e);
  -- lo que ve: texto, tipo y opciones; nunca destinos, ramas ni campos del informe
  if r -> 'actual' ->> 'nodo' <> 'intro' or r::text ~ 'siguiente' or r::text ~ 'ramas' or r::text ~ 'afirmacion' then raise exception 'FALLO: estado inicial: %', r; end if;
  r := public.aurora_responder(e, 'intro', null, null, i1);
  if r -> 'actual' ->> 'nodo' <> 'papel' or jsonb_array_length(r -> 'historial') <> 1 or r::text ~ 'afirmacion' or r::text ~ 'siguiente' then
    raise exception 'FALLO: tras intro: %', r; end if;
  -- doble envío y pestaña atrasada: no registran nada
  r := public.aurora_responder(e, 'intro', null, null, i1);
  r := public.aurora_responder(e, 'intro', null, null, gen_random_uuid());
  if jsonb_array_length(r -> 'historial') <> 1 or r -> 'actual' ->> 'nodo' <> 'papel' then raise exception 'FALLO: doble envío registrado'; end if;
  -- validación de opciones y de texto pedido
  begin perform public.aurora_responder(e, 'papel', 'quizas', null, gen_random_uuid()); raise exception 'FALLO: opción inexistente';
  exception when raise_exception then null; end;
  begin perform public.aurora_responder(e, 'papel', 'otro', '  ', gen_random_uuid()); raise exception 'FALLO: «otro» sin texto';
  exception when raise_exception then null; end;
  r := public.aurora_responder(e, 'papel', 'si', 'texto que se ignora', gen_random_uuid());
  -- rama: dijo que usó papel → tras «pantalla» pregunta por las hojas
  r := public.aurora_responder(e, 'pantalla', 'no', null, gen_random_uuid());
  if r -> 'actual' ->> 'nodo' <> 'hojas' then raise exception 'FALLO: la rama no llevó a «hojas»: %', r -> 'actual'; end if;
  r := public.aurora_responder(e, 'hojas', 'si', null, gen_random_uuid());
  begin perform public.aurora_responder(e, 'proc', null, '', gen_random_uuid()); raise exception 'FALLO: texto obligatorio vacío';
  exception when raise_exception then null; end;
  begin perform public.aurora_responder(e, 'proc', null, repeat('x', 51), gen_random_uuid()); raise exception 'FALLO: texto demasiado largo';
  exception when raise_exception then null; end;
  r := public.aurora_responder(e, 'proc', null, 'Conservación de la energía: ½kx² = ½mv²', gen_random_uuid());
  r := public.aurora_responder(e, 'extra', null, null, gen_random_uuid());
  if r ->> 'estado' <> 'finalizada' or r -> 'actual' ->> 'tipo' <> 'fin' or jsonb_array_length(r -> 'historial') <> 6
     or r -> 'historial' -> 1 ->> 'respuesta' <> 'Sí' or r -> 'historial' -> 5 ->> 'respuesta' <> '(sin respuesta)' then
    raise exception 'FALLO: final: %', r; end if;
  if public.aurora_pendiente() <> '[]'::jsonb then raise exception 'FALLO: terminada sigue pendiente'; end if;
  begin perform public.aurora_responder(e, 'fin', null, 'más', gen_random_uuid()); raise exception 'FALLO: respondió tras terminar';
  exception when raise_exception then null; end;
end $$;

-- 6) Informe del profesor: todo lo respondido, guion y registros; sin tocar el maratón
do $$ declare e uuid := (select id from ids where nombre = 'E'); r jsonb; begin
  perform pg_temp.como(pg_temp.u(1)::text);
  r := public.aurora_informe(e);
  if jsonb_array_length(r -> 'respuestas') <> 6 or r -> 'respuestas' -> 1 ->> 'valor' <> 'si' or r -> 'respuestas' -> 1 ->> 'texto' is not null
     or r -> 'entrevista' -> 'guion' -> 'nodos' -> 'papel' ->> 'afirmacion' <> 'papel' or r -> 'estudiante' ->> 'login_id' <> 'sint-au-s1'
     or jsonb_array_length(r -> 'jornadas') <> 1 or r -> 'presentaciones' -> 0 ->> 'procedimiento' <> 'mi procedimiento'
     or r -> 'entrevista' ->> 'finalizada_at' is null then
    raise exception 'FALLO: informe: %', r; end if;
end $$;
do $$ begin
  if (select p from antes) <> (select count(*) from public.maraton_presentaciones) or (select j from antes) <> (select count(*) from public.maraton_jornadas)
     or (select ev from antes) <> (select count(*) from public.maraton_eventos)
     or (select nivel from antes) <> (select nivel from public.maraton_inscripciones where user_id = pg_temp.u(11)) then
    raise exception 'FALLO: la entrevista tocó el maratón'; end if;
end $$;

-- 7) Una sola entrevista por estudiante y maratón; solo se añaden respuestas
do $$ declare m uuid := (select id from ids where nombre = 'M'); begin
  begin
    insert into public.aurora_entrevistas (user_id, maraton_id, jornadas, titulo, titulo_informe, guion)
    select user_id, maraton_id, jornadas, titulo, titulo_informe, guion from public.aurora_entrevistas where user_id = pg_temp.u(11);
    raise exception 'FALLO: segunda entrevista';
  exception when unique_violation then null; end;
  begin update public.aurora_respuestas set texto = 'cambiado'; raise exception 'FALLO: se modificó una respuesta';
  exception when insufficient_privilege then null; end;
  begin delete from public.aurora_entrevistas where user_id = pg_temp.u(11); raise exception 'FALLO: se borró la entrevista';
  exception when insufficient_privilege then null; end;
end $$;

-- 8) Permisos
do $$ begin
  if has_table_privilege('authenticated', 'public.aurora_entrevistas', 'select') or has_table_privilege('authenticated', 'public.aurora_respuestas', 'select')
     or has_table_privilege('anon', 'public.aurora_respuestas', 'select')
     or has_function_privilege('anon', 'public.aurora_estado(uuid)', 'execute')
     or has_function_privilege('anon', 'public.aurora_responder(uuid, text, text, text, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.aurora_guion_errores(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.aurora_nodo_publico(jsonb, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.aurora_responder(uuid, text, text, text, uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.aurora_informe(uuid)', 'execute') then
    raise exception 'FALLO: permisos';
  end if;
end $$;

select 'AURORA-07: PRUEBAS PASARON' as resultado;
rollback;
