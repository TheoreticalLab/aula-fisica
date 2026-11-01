-- Pruebas: generación de preguntas con IA para el banco (migración 55). Datos sintéticos; se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de550000-0000-4000-8000-000000000001', 'gp1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-genera","aula_role":"teacher"}', '{}', now(), now()),
  ('de550000-0000-4000-8000-000000000002', 'gp2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-genera-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('de550000-0000-4000-8000-000000000011', 'gp11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-genera"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de550000-%';
update public.profiles set role = 'teacher' where id in ('de550000-0000-4000-8000-000000000001', 'de550000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de550000-0000-4000-8000-000000000021', 'Curso genera'), ('de550000-0000-4000-8000-000000000022', 'Otro curso');
insert into public.units (id, course_id, slug, title) values
  ('de550000-0000-4000-8000-000000000031', 'de550000-0000-4000-8000-000000000021', 'u-gen', 'Cinemática'),
  ('de550000-0000-4000-8000-000000000032', 'de550000-0000-4000-8000-000000000022', 'u-otro', 'Otra');
insert into public.lessons (id, unit_id, course_id, slug, title, summary) values
  ('de550000-0000-4000-8000-000000000041', 'de550000-0000-4000-8000-000000000031', 'de550000-0000-4000-8000-000000000021', 'l-gen', 'MRU', 'Rapidez constante'),
  ('de550000-0000-4000-8000-000000000042', 'de550000-0000-4000-8000-000000000032', 'de550000-0000-4000-8000-000000000022', 'l-otro', 'Otra', '');
insert into public.concepts (course_id, lesson_id, slug, name) values ('de550000-0000-4000-8000-000000000021', 'de550000-0000-4000-8000-000000000041', 'gen-mru', 'MRU');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de550000-0000-4000-8000-000000000051', 'de550000-0000-4000-8000-000000000021', 'Sección genera', 'GENERA01', 'de550000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de550000-0000-4000-8000-000000000051', 'de550000-0000-4000-8000-000000000001') on conflict do nothing;

do $$ begin
  if has_function_privilege('authenticated', 'public.svc_generar_guardar(uuid, uuid, jsonb, integer, numeric)', 'execute') then raise exception 'FALLO: svc expuesta'; end if;
  if has_table_privilege('authenticated', 'public.question_generation_runs', 'select') then raise exception 'FALLO: tabla legible directamente'; end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conname = 'orbe_ia_usage_purpose_check') not like '%generar%' then raise exception 'FALLO: falta el propósito generar'; end if;
end $$;

-- 1) profesorado de la asignatura: temas, estimación y comienzo; un profesor ajeno y un estudiante no
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de550000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de550000-0000-4000-8000-000000000001', true);
do $$ declare t jsonb; e jsonb; begin
  t := public.generar_temas('de550000-0000-4000-8000-000000000021');
  if t -> 'unidades' -> 0 -> 'lecciones' -> 0 ->> 'titulo' <> 'MRU' or t -> 'unidades' -> 0 -> 'lecciones' -> 0 -> 'conceptos' -> 0 ->> 'slug' <> 'gen-mru' then raise exception 'FALLO: temas %', t; end if;
  e := public.generar_estimacion('de550000-0000-4000-8000-000000000021');
  if not (e ? 'precio_entrada' and e ? 'limite_diario' and (e ->> 'por_lote')::int = 4) then raise exception 'FALLO: estimación %', e; end if;
  begin perform public.generar_iniciar('de550000-0000-4000-8000-000000000021', '{}', 500); raise exception 'FALLO: 500 preguntas aceptadas';
  exception when invalid_parameter_value then null; end;
  begin perform public.generar_temas('de550000-0000-4000-8000-000000000022'); raise exception 'FALLO: temas de una asignatura que no imparte';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('prueba.run', public.generar_iniciar('de550000-0000-4000-8000-000000000021', '{"niveles":{"basico":1}}', 2)::text, true);
select set_config('request.jwt.claims', '{"sub":"de550000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de550000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.generar_iniciar('de550000-0000-4000-8000-000000000021', '{}', 5); raise exception 'FALLO: profesor ajeno inició';
  exception when insufficient_privilege then null; end;
  begin perform public.generar_resumen(current_setting('prueba.run')::uuid); raise exception 'FALLO: profesor ajeno vio el resumen';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de550000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de550000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.generar_estimacion('de550000-0000-4000-8000-000000000021'); raise exception 'FALLO: un estudiante estimó';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 2) servidor: contexto y guardado como BORRADOR no publicado, nunca más de lo pedido, solo lecciones de la asignatura
set local role service_role;
do $$ declare r uuid := current_setting('prueba.run')::uuid; c jsonb; g jsonb; e public.exercises; k public.exercise_keys;
  item jsonb := '{"lesson_id":"de550000-0000-4000-8000-000000000041","difficulty":"basico","format":"numeric","concepts":["gen-mru"],
    "prompt":"Un móvil recorre 120 m en 8 s. ¿Cuál es su rapidez?","options":null,"unit_hint":"m/s",
    "answer":{"format":"numeric","value":"15 m/s","relTol":0.02},"hints":["d/t"],"explanation":"Rapidez = distancia / tiempo = 15 m/s.","verificacion":"calculo_comprobado"}';
begin
  c := public.svc_generar_contexto('de550000-0000-4000-8000-000000000001', r, array['de550000-0000-4000-8000-000000000041'::uuid]);
  if c -> 'lecciones' -> 0 ->> 'titulo' <> 'MRU' or c ->> 'asignatura' <> 'Curso genera' then raise exception 'FALLO: contexto %', c; end if;
  if c::text like '%15 m/s%' then raise exception 'FALLO: el contexto lleva claves'; end if;
  begin perform public.svc_generar_contexto('de550000-0000-4000-8000-000000000001', r, array['de550000-0000-4000-8000-000000000042'::uuid]); raise exception 'FALLO: lección ajena en el contexto';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_generar_contexto('de550000-0000-4000-8000-000000000002', r, array['de550000-0000-4000-8000-000000000041'::uuid]); raise exception 'FALLO: otro profesor usó la generación';
  exception when insufficient_privilege then null; end;
  -- tres preguntas cuando se pidieron dos: solo se guardan dos
  g := public.svc_generar_guardar('de550000-0000-4000-8000-000000000001', r, jsonb_build_array(item, item || '{"prompt":"Un móvil recorre 60 m en 4 s. ¿Rapidez?"}', item || '{"prompt":"Otra pregunta de MRU con 30 m en 2 s."}'), 1, 0.05);
  if jsonb_array_length(g -> 'ids') <> 2 then raise exception 'FALLO: guardó % (se pidieron 2)', jsonb_array_length(g -> 'ids'); end if;
  select * into e from public.exercises where id = (g -> 'ids' ->> 0)::uuid;
  select * into k from public.exercise_keys where exercise_id = e.id;
  if e.published or e.role <> 'bank' or e.course_id <> 'de550000-0000-4000-8000-000000000021' or e.slug not like 'ia-%' or e.category <> 'numerica' then raise exception 'FALLO: ejercicio guardado %', row_to_json(e); end if;
  if k.answer ->> 'value' <> '15 m/s' or k.explanation not like 'Rapidez%' then raise exception 'FALLO: clave guardada %', row_to_json(k); end if;
  if (select creadas || '/' || rechazadas || '/' || costo_usd from public.question_generation_runs where id = r) <> '2/1/0.050000' then raise exception 'FALLO: contadores de la generación'; end if;
  begin perform public.svc_generar_guardar('de550000-0000-4000-8000-000000000001', r, jsonb_build_array(item || '{"lesson_id":"de550000-0000-4000-8000-000000000042"}'), 0, 0);
    raise exception 'FALLO: guardó en una lección ajena'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 3) el resumen lo ve quien generó
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de550000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de550000-0000-4000-8000-000000000001', true);
do $$ declare s jsonb; begin
  s := public.generar_resumen(current_setting('prueba.run')::uuid);
  if (s ->> 'creadas')::int <> 2 or jsonb_array_length(s -> 'items') <> 2 or s -> 'items' -> 0 ->> 'verificacion' <> 'calculo_comprobado' then raise exception 'FALLO: resumen %', s; end if;
end $$;
reset role;

select 'generacion_preguntas.sql: PRUEBAS PASARON' as resultado;
rollback;
