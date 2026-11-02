-- Pruebas: banco por origen, preguntas desde una clase, resumen semanal y mapa de tutoría (migración 68). Se deshace al final.
-- P = profesor de la sección; Q = otro profesor (sin la sección ni la asignatura); E = estudiante; F = estudiante bloqueado.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de680000-0000-4000-8000-000000000001', 'bt1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-banco68","aula_role":"teacher"}', '{}', now(), now()),
  ('de680000-0000-4000-8000-000000000002', 'bt2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-otro68","aula_role":"teacher"}', '{}', now(), now()),
  ('de680000-0000-4000-8000-000000000011', 'bt11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-bt-e"}', '{}', now(), now()),
  ('de680000-0000-4000-8000-000000000012', 'bt12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-bt-f"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de680000-%';
update public.profiles set role = 'teacher' where id in ('de680000-0000-4000-8000-000000000001', 'de680000-0000-4000-8000-000000000002');
update public.profiles set full_name = 'Persona ' || right(id::text, 2) where id::text like 'de680000-%';
insert into public.courses (id, title) values ('de680000-0000-4000-8000-000000000021', 'Curso 68');
insert into public.units (id, course_id, slug, title, position) values ('de680000-0000-4000-8000-000000000041', 'de680000-0000-4000-8000-000000000021', 'u68', 'Unidad 68', 1);
insert into public.lessons (id, unit_id, course_id, slug, title, position) values
  ('de680000-0000-4000-8000-000000000051', 'de680000-0000-4000-8000-000000000041', 'de680000-0000-4000-8000-000000000021', 'l68a', 'Lección A', 1),
  ('de680000-0000-4000-8000-000000000052', 'de680000-0000-4000-8000-000000000041', 'de680000-0000-4000-8000-000000000021', 'l68b', 'Lección B', 2);
insert into public.concepts (course_id, lesson_id, slug, name) values
  ('de680000-0000-4000-8000-000000000021', 'de680000-0000-4000-8000-000000000051', 'c68-mru', 'MRU'),
  ('de680000-0000-4000-8000-000000000021', 'de680000-0000-4000-8000-000000000052', 'c68-newton', 'Segunda ley');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de680000-0000-4000-8000-000000000031', 'de680000-0000-4000-8000-000000000021', 'Sección 68', 'BANCO068', 'de680000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de680000-0000-4000-8000-000000000031', 'de680000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de680000-0000-4000-8000-000000000031', 'de680000-0000-4000-8000-000000000011'), ('de680000-0000-4000-8000-000000000031', 'de680000-0000-4000-8000-000000000012');

-- ejercicios: contenido (sin autor), del profesor, de una generación por temas
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, concepts, published, created_by) values
  ('de680000-0000-4000-8000-0000000000e1', 'de680000-0000-4000-8000-000000000021', 'de680000-0000-4000-8000-000000000051', 'c68-e1', 'numerica', 'basico', 'practice', 'numeric', 'Contenido', '{c68-mru}', true, null),
  ('de680000-0000-4000-8000-0000000000e2', 'de680000-0000-4000-8000-000000000021', 'de680000-0000-4000-8000-000000000052', 'c68-e2', 'numerica', 'basico', 'bank', 'numeric', 'Del profesor', '{c68-newton}', true, 'de680000-0000-4000-8000-000000000001'),
  ('de680000-0000-4000-8000-0000000000e3', 'de680000-0000-4000-8000-000000000021', 'de680000-0000-4000-8000-000000000051', 'ia-68temas', 'numerica', 'basico', 'bank', 'numeric', 'IA por temas', '{c68-mru}', false, 'de680000-0000-4000-8000-000000000001');
insert into public.question_generation_runs (id, course_id, actor_id, solicitadas) values ('de680000-0000-4000-8000-0000000000d1', 'de680000-0000-4000-8000-000000000021', 'de680000-0000-4000-8000-000000000001', 5);
insert into public.question_generation_items (exercise_id, run_id, verificacion) values ('de680000-0000-4000-8000-0000000000e3', 'de680000-0000-4000-8000-0000000000d1', 'revisar');

-- clase impartida con versión ampliada (borrador), enlazada a la lección B; fotos pendientes de revisar
insert into public.class_sessions (id, class_id, fecha, title, temas, uploader_role, uploaded_by, fotos_estado) values
  ('de680000-0000-4000-8000-0000000000a1', 'de680000-0000-4000-8000-000000000031', current_date, 'Segunda ley de Newton', '{fuerza,masa}', 'docente', 'de680000-0000-4000-8000-000000000001', 'pendiente');
insert into public.class_ai_versions (session_id, numero, contenido, estado, created_by) values
  ('de680000-0000-4000-8000-0000000000a1', 1, '{"secciones":[{"clave":"incertidumbres","titulo":"Nota","cuerpo":"VALOR DUDOSO"},{"clave":"reconstruccion","titulo":"Lo trabajado","cuerpo":"F = m a con m = 2 kg"}]}', 'borrador', 'de680000-0000-4000-8000-000000000001');
insert into public.class_resource_links (session_id, tipo, lesson_id, estado, origen) values
  ('de680000-0000-4000-8000-0000000000a1', 'leccion', 'de680000-0000-4000-8000-000000000052', 'sugerido', 'ia');

-- regularización con bloqueo: F no la terminó (bloqueado); E sí
insert into public.hist_settings (class_id, abierto, bloquear) values ('de680000-0000-4000-8000-000000000031', true, true);
insert into public.hist_cierres (class_id, user_id, finalizado_at, sin_practicas) values ('de680000-0000-4000-8000-000000000031', 'de680000-0000-4000-8000-000000000011', now(), true);

-- respuestas de E: MRU bien en práctica y mal en evaluación; Segunda ley sin evidencia de práctica
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('de680000-0000-4000-8000-0000000000b1', 'de680000-0000-4000-8000-000000000031', 'Práctica 68', 'practice', true, 'immediate', true),
  ('de680000-0000-4000-8000-0000000000b2', 'de680000-0000-4000-8000-000000000031', 'Control 68', 'exam', true, 'never', false);
insert into public.attempts (id, user_id, course_id, activity_id, lesson_id, mode, status, score, max_score) values
  ('de680000-0000-4000-8000-0000000000f1', 'de680000-0000-4000-8000-000000000011', 'de680000-0000-4000-8000-000000000021', 'de680000-0000-4000-8000-0000000000b1', null, 'practice', 'submitted', 10, 10),
  ('de680000-0000-4000-8000-0000000000f2', 'de680000-0000-4000-8000-000000000011', 'de680000-0000-4000-8000-000000000021', 'de680000-0000-4000-8000-0000000000b2', null, 'exam', 'submitted', 0, 10),
  ('de680000-0000-4000-8000-0000000000f3', 'de680000-0000-4000-8000-000000000011', 'de680000-0000-4000-8000-000000000021', null, 'de680000-0000-4000-8000-000000000051', 'practice', 'submitted', 1, 1);
insert into public.responses (attempt_id, exercise_id, user_id, status, tries, first_try_correct, auto_credit) values
  ('de680000-0000-4000-8000-0000000000f1', 'de680000-0000-4000-8000-0000000000e1', 'de680000-0000-4000-8000-000000000011', 'correct', 1, true, 1),
  ('de680000-0000-4000-8000-0000000000f3', 'de680000-0000-4000-8000-0000000000e3', 'de680000-0000-4000-8000-000000000011', 'correct', 1, true, 1),
  ('de680000-0000-4000-8000-0000000000f2', 'de680000-0000-4000-8000-0000000000e1', 'de680000-0000-4000-8000-000000000011', 'incorrect', 1, false, 0);
-- un control confirmado (MRU, 0 %) y otro sin confirmar
insert into public.control_sessions (id, practice_activity_id, class_id, duracion_min, semilla, estado, iniciado_at) values
  ('de680000-0000-4000-8000-0000000000c1', 'de680000-0000-4000-8000-0000000000b1', 'de680000-0000-4000-8000-000000000031', 5, 1, 'cerrado', now() - interval '1 day');
insert into public.control_assignments (session_id, user_id, estado, exercise_id, competencia, attempt_id, confirmado_at) values
  ('de680000-0000-4000-8000-0000000000c1', 'de680000-0000-4000-8000-000000000011', 'elegible', 'de680000-0000-4000-8000-0000000000e1', 'c68-mru', 'de680000-0000-4000-8000-0000000000f2', now()),
  ('de680000-0000-4000-8000-0000000000c1', 'de680000-0000-4000-8000-000000000012', 'elegible', 'de680000-0000-4000-8000-0000000000e1', 'c68-mru', 'de680000-0000-4000-8000-0000000000f1', null);

set local role authenticated;
select set_config('request.path', '/rpc/prueba', true);

-- ---- el otro profesor y el estudiante no pueden usar nada de esto
select set_config('request.jwt.claims', '{"sub":"de680000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de680000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.banco_origen('de680000-0000-4000-8000-000000000021'); raise exception 'FALLO: otro profesor ve el origen'; exception when insufficient_privilege then null; end;
  begin perform public.generar_clase_info('de680000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: otro profesor ve la clase'; exception when insufficient_privilege then null; end;
  begin perform public.generar_iniciar_clase('de680000-0000-4000-8000-0000000000a1', '{}', 4); raise exception 'FALLO: otro profesor genera'; exception when insufficient_privilege then null; end;
  begin perform public.tutoria_mapa('de680000-0000-4000-8000-000000000031', 'de680000-0000-4000-8000-000000000011'); raise exception 'FALLO: otro profesor ve el mapa'; exception when insufficient_privilege then null; end;
  if jsonb_array_length(public.resumen_semanal() -> 'secciones') <> 0 then raise exception 'FALLO: resumen con secciones ajenas'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de680000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de680000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.resumen_semanal(); raise exception 'FALLO: el estudiante ve el resumen'; exception when insufficient_privilege then null; end;
  begin perform public.tutoria_mapa('de680000-0000-4000-8000-000000000031', 'de680000-0000-4000-8000-000000000011'); raise exception 'FALLO: el estudiante ve su mapa'; exception when insufficient_privilege then null; end;
end $$;

-- ---- el profesor de la sección
select set_config('request.jwt.claims', '{"sub":"de680000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de680000-0000-4000-8000-000000000001', true);
do $$ declare j jsonb; v_run uuid; v_ctx jsonb; m jsonb; c jsonb; s jsonb; begin
  -- 1) origen
  if (select origen from public.banco_origen('de680000-0000-4000-8000-000000000021') where exercise_id = 'de680000-0000-4000-8000-0000000000e1') <> 'contenido'
     or (select origen from public.banco_origen('de680000-0000-4000-8000-000000000021') where exercise_id = 'de680000-0000-4000-8000-0000000000e2') <> 'docente'
     or (select origen from public.banco_origen('de680000-0000-4000-8000-000000000021') where exercise_id = 'de680000-0000-4000-8000-0000000000e3') <> 'ia' then
    raise exception 'FALLO: origen del banco'; end if;

  -- 2) generación desde la clase: lecciones sugeridas (las enlazadas), versión ampliada en borrador
  j := public.generar_clase_info('de680000-0000-4000-8000-0000000000a1');
  if j -> 'lecciones' <> '["de680000-0000-4000-8000-000000000052"]'::jsonb or j ->> 'ampliada' <> 'borrador' or (j ->> 'ya_generadas')::int <> 0 then
    raise exception 'FALLO: info de la clase %', j; end if;
  begin perform public.generar_iniciar_clase('de680000-0000-4000-8000-0000000000a1', '{}', 0); raise exception 'FALLO: cantidad 0'; exception when invalid_parameter_value then null; end;
  v_run := public.generar_iniciar_clase('de680000-0000-4000-8000-0000000000a1', '{"n":4}', 4);
  perform set_config('aula.prueba_run', v_run::text, true);

  -- 3) resumen semanal
  j := public.resumen_semanal();
  s := j -> 'secciones' -> 0;
  if jsonb_array_length(j -> 'secciones') <> 1 or (s ->> 'controles_por_confirmar')::int <> 1 or (s ->> 'fotos_por_revisar')::int <> 1
     or (s ->> 'ampliadas_por_revisar')::int <> 1 or (s ->> 'bloqueados')::int <> 1 or not (s ->> 'bloqueo_activo')::boolean
     or (s ->> 'controles_semana')::int <> 1 or (j -> 'banco' -> 0 ->> 'ia')::int <> 1 or (j -> 'banco' -> 0 ->> 'clase')::int <> 0
     or (j ->> 'es_admin')::boolean or j -> 'ia' ->> 'total_usd' is not null then
    raise exception 'FALLO: resumen semanal %', j; end if;

  -- 4) mapa de tutoría de E
  m := public.tutoria_mapa('de680000-0000-4000-8000-000000000031', 'de680000-0000-4000-8000-000000000011');
  select x into c from jsonb_array_elements(m -> 'conceptos') x where x ->> 'slug' = 'c68-mru';
  if (c -> 'practica' ->> 'n')::int <> 2 or (c -> 'practica' ->> 'score')::numeric <> 1 or (c -> 'evaluaciones' ->> 'n')::int <> 1
     or (c -> 'evaluaciones' ->> 'score')::numeric <> 0 or (c -> 'controles' ->> 'n')::int <> 1 or (c -> 'controles' ->> 'pct')::numeric <> 0
     or (c -> 'general' ->> 'n')::int <> 3 then raise exception 'FALLO: mapa MRU %', c; end if;
  select x into c from jsonb_array_elements(m -> 'conceptos') x where x ->> 'slug' = 'c68-newton';
  if (c -> 'practica' ->> 'n')::int <> 0 or (c -> 'controles' ->> 'n')::int <> 0 then raise exception 'FALLO: mapa Newton %', c; end if;
  if jsonb_array_length(m -> 'conceptos') <> 2 or m -> 'vta' ->> 'controles' <> '1' or m ->> 'aviso' not like '%No son pruebas de uso de IA%' then
    raise exception 'FALLO: mapa %', m; end if;
  -- un estudiante que no es de la sección: no
  begin perform public.tutoria_mapa('de680000-0000-4000-8000-000000000031', 'de680000-0000-4000-8000-000000000002'); raise exception 'FALLO: mapa de un no matriculado';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---- el contexto del modelo incluye la clase (sin la nota de lectura de la pizarra) solo en la generación desde la clase
set local role service_role;
do $$ declare c jsonb; begin
  c := public.svc_generar_contexto('de680000-0000-4000-8000-000000000001', current_setting('aula.prueba_run')::uuid, array['de680000-0000-4000-8000-000000000052'::uuid]);
  if c -> 'clase' ->> 'titulo' <> 'Segunda ley de Newton' or c -> 'clase' ->> 'contenido' not like '%F = m a con m = 2 kg%'
     or c -> 'clase' ->> 'contenido' like '%VALOR DUDOSO%' or c -> 'clase' -> 'temas' <> '["fuerza","masa"]'::jsonb then
    raise exception 'FALLO: contexto de la clase %', c -> 'clase'; end if;
  c := public.svc_generar_contexto('de680000-0000-4000-8000-000000000001', 'de680000-0000-4000-8000-0000000000d1', array['de680000-0000-4000-8000-000000000051'::uuid]);
  if c -> 'clase' is not null and c -> 'clase' <> 'null'::jsonb then raise exception 'FALLO: clase en una generación por temas'; end if;
end $$;
reset role;

do $$ begin
  if (select session_id from public.question_generation_runs where id = current_setting('aula.prueba_run')::uuid) <> 'de680000-0000-4000-8000-0000000000a1' then
    raise exception 'FALLO: generación sin su clase'; end if;
  if has_function_privilege('anon', 'public.resumen_semanal()', 'execute') or has_function_privilege('anon', 'public.tutoria_mapa(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.svc_generar_contexto(uuid, uuid, uuid[])', 'execute') then raise exception 'FALLO: permisos'; end if;
end $$;

select 'banco_resumen_tutoria.sql: PRUEBAS PASARON' as resultado;
rollback;
