-- Pruebas: Práctica Extraordinaria Secuencial (migración 74). Se deshace al final.
-- Profesor P (sección S), profesor ajeno Q; estudiantes E1, E2, E3 matriculados en S; X no matriculado.
-- Banco: e1…e6 numéricos (clave 5 m), e7 de selección, e8 abierto (con rúbrica); e9 de otra asignatura.
-- Problemas por etapas: «pr4» (4 etapas, listo), «pr7» (7 etapas; la 5 depende de la 4) y «prx» (3 etapas, una sin clave).
-- Las negativas que esperan P0001 vuelven a lanzar los FALLO (si no, el propio FALLO quedaría atrapado).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de740000-0000-4000-8000-000000000001', 'pes1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-pes","aula_role":"teacher"}', '{}', now(), now()),
  ('de740000-0000-4000-8000-000000000002', 'pes2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-pes-otro","aula_role":"teacher"}', '{}', now(), now()),
  ('de740000-0000-4000-8000-000000000011', 'pes11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pes-1"}', '{}', now(), now()),
  ('de740000-0000-4000-8000-000000000012', 'pes12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pes-2"}', '{}', now(), now()),
  ('de740000-0000-4000-8000-000000000013', 'pes13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pes-3"}', '{}', now(), now()),
  ('de740000-0000-4000-8000-000000000014', 'pes14@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pes-x"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de740000-%';
update public.profiles set role = 'teacher' where id in ('de740000-0000-4000-8000-000000000001', 'de740000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de740000-0000-4000-8000-0000000000a0', 'Curso PES'), ('de740000-0000-4000-8000-0000000000b0', 'Otro curso');
insert into public.units (id, course_id, slug, title, position) values
  ('de740000-0000-4000-8000-0000000000a1', 'de740000-0000-4000-8000-0000000000a0', 'u', 'U', 1),
  ('de740000-0000-4000-8000-0000000000b1', 'de740000-0000-4000-8000-0000000000b0', 'u', 'U', 1);
insert into public.lessons (id, unit_id, course_id, slug, title) values
  ('de740000-0000-4000-8000-0000000000a2', 'de740000-0000-4000-8000-0000000000a1', 'de740000-0000-4000-8000-0000000000a0', 'mru', 'MRU'),
  ('de740000-0000-4000-8000-0000000000b2', 'de740000-0000-4000-8000-0000000000b1', 'de740000-0000-4000-8000-0000000000b0', 'mru', 'MRU B');
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, options, published)
select ('de740000-0000-4000-8000-0000000000e' || i)::uuid, 'de740000-0000-4000-8000-0000000000a0', 'de740000-0000-4000-8000-0000000000a2', 'pes-' || i,
  'numerica', 'basico', 'bank', 'numeric', 'Enunciado secreto ' || i, null, true from generate_series(1, 6) i;
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, options, published) values
  ('de740000-0000-4000-8000-0000000000e7', 'de740000-0000-4000-8000-0000000000a0', 'de740000-0000-4000-8000-0000000000a2', 'pes-7', 'conceptual', 'intermedio', 'bank', 'choice', 'Enunciado secreto 7', '["a","b","c"]', true),
  ('de740000-0000-4000-8000-0000000000e8', 'de740000-0000-4000-8000-0000000000a0', 'de740000-0000-4000-8000-0000000000a2', 'pes-8', 'conceptual', 'intermedio', 'bank', 'open', 'Enunciado secreto 8', null, true),
  ('de740000-0000-4000-8000-0000000000e9', 'de740000-0000-4000-8000-0000000000b0', 'de740000-0000-4000-8000-0000000000b2', 'pes-9', 'numerica', 'basico', 'bank', 'numeric', 'Ajeno', null, true);
insert into public.exercise_keys (exercise_id, answer, explanation)
select ('de740000-0000-4000-8000-0000000000e' || i)::uuid, '{"format":"numeric","value":"5 m","relTol":0.02}', 'expl ' || i from generate_series(1, 6) i;
insert into public.exercise_keys (exercise_id, answer) values
  ('de740000-0000-4000-8000-0000000000e7', '{"format":"choice","correct":[1]}'),
  ('de740000-0000-4000-8000-0000000000e8', '{"format":"open","rubric":"Rúbrica privada: conservación de la energía"}'),
  ('de740000-0000-4000-8000-0000000000e9', '{"format":"numeric","value":"1 m"}');
-- problemas por etapas (exercise_bank_meta.problema)
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, options, published)
select ('de740000-0000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'de740000-0000-4000-8000-0000000000a0', 'de740000-0000-4000-8000-0000000000a2',
  'pr-' || i, 'numerica', 'intermedio', 'bank', 'numeric', 'Etapa secreta ' || i, null, true
from generate_series(11, 33) i where i between 11 and 14 or i between 21 and 27 or i between 31 and 33;
insert into public.exercise_keys (exercise_id, answer)
select ('de740000-0000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid,
  case when i = 25 then '{"format":"numeric","value":"7 m","arrastre":{"desde":"pr-24","expresion":"x*2"}}'::jsonb else '{"format":"numeric","value":"7 m"}'::jsonb end
from generate_series(11, 33) i where i between 11 and 14 or i between 21 and 27 or i in (31, 32);
insert into public.exercise_bank_meta (exercise_id, course_id, meta)
select ('de740000-0000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'de740000-0000-4000-8000-0000000000a0',
  jsonb_build_object('tipo', case i % 10 when 1 then 'prediccion' when 4 then 'conceptual' else 'calculo' end,
    'problema', jsonb_build_object('id', case when i < 20 then 'pr4' when i < 30 then 'pr7' else 'prx' end,
      'titulo', case when i < 20 then 'Plano inclinado' when i < 30 then 'Choque y frenado' else 'Incompleto' end,
      'etapa', i % 10, 'total', case when i < 20 then 4 when i < 30 then 7 else 3 end))
from generate_series(11, 33) i where i between 11 and 14 or i between 21 and 27 or i between 31 and 33;
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de740000-0000-4000-8000-000000000031', 'de740000-0000-4000-8000-0000000000a0', 'S', 'PES74001', 'de740000-0000-4000-8000-000000000001'),
  ('de740000-0000-4000-8000-000000000034', 'de740000-0000-4000-8000-0000000000b0', 'SX', 'PES74002', 'de740000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('de740000-0000-4000-8000-000000000031', 'de740000-0000-4000-8000-000000000001'), ('de740000-0000-4000-8000-000000000034', 'de740000-0000-4000-8000-000000000002')
  on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de740000-0000-4000-8000-000000000031', 'de740000-0000-4000-8000-000000000011'), ('de740000-0000-4000-8000-000000000031', 'de740000-0000-4000-8000-000000000012'),
  ('de740000-0000-4000-8000-000000000031', 'de740000-0000-4000-8000-000000000013'), ('de740000-0000-4000-8000-000000000034', 'de740000-0000-4000-8000-000000000014');

create temp table pes_t (k text primary key, val uuid);
grant all on pes_t to public;

-- ---------------------------------------------------------------------------------------------------------------
-- 1) Contenido: problemas por etapas reales, composición docente con situación común, apartados redactados
-- ---------------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.path', '/rpc/prueba', true);
do $$ declare v uuid; j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000002', true);
  begin perform public.pes_crear('de740000-0000-4000-8000-000000000031', '{"titulo":"x"}'); raise exception 'FALLO: profesor ajeno crea';
  exception when insufficient_privilege then null; end;
  begin perform public.pes_banco_problemas('de740000-0000-4000-8000-000000000031'); raise exception 'FALLO: profesor ajeno ve el banco';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000011', true);
  begin perform public.pes_crear('de740000-0000-4000-8000-000000000031', '{"titulo":"x"}'); raise exception 'FALLO: estudiante crea';
  exception when insufficient_privilege then null; end;
  begin perform public.pes_banco_problemas('de740000-0000-4000-8000-000000000031'); raise exception 'FALLO: estudiante ve el banco';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000001', true);
  -- informe del banco: idoneidad real, sin claves
  j := public.pes_banco_problemas('de740000-0000-4000-8000-000000000031');
  if (j ->> 'listos')::integer <> 1 or (j ->> 'requieren_seleccion')::integer <> 1 then raise exception 'FALLO: informe del banco %', j; end if;
  if (select x ->> 'estado' from jsonb_array_elements(j -> 'problemas') x where x ->> 'id' = 'prx') <> 'incompleto' then raise exception 'FALLO: incompleto %', j; end if;
  if (select x ->> 'estado' from jsonb_array_elements(j -> 'problemas') x where x ->> 'id' = 'pr7') <> 'requiere_seleccion' then raise exception 'FALLO: 7 etapas'; end if;
  if not (select (e ->> 'depende_de_la_anterior')::boolean from jsonb_array_elements(j -> 'problemas') x, jsonb_array_elements(x -> 'etapas') e
          where x ->> 'id' = 'pr7' and (e ->> 'etapa')::integer = 5) then raise exception 'FALLO: arrastre no informado'; end if;
  if (j ->> 'preguntas_sueltas')::integer <> 8 then raise exception 'FALLO: preguntas sueltas %', j ->> 'preguntas_sueltas'; end if;
  if j::text like '%7 m%' or j::text like '%5 m%' then raise exception 'FALLO: el informe del banco filtra claves'; end if;

  v := public.pes_crear('de740000-0000-4000-8000-000000000031', jsonb_build_object('titulo', 'PES 1', 'cierra_at', now() + interval '7 days'));
  insert into pes_t values ('p1', v);
  -- composición docente: 3 a 5 preguntas, de la asignatura, sin repetir, con situación común escrita
  begin perform public.pes_ejercicio_desde_banco(v, array['de740000-0000-4000-8000-0000000000e1', 'de740000-0000-4000-8000-0000000000e2']::uuid[], '', 'Una piedra cae desde un puente alto.');
    raise exception 'FALLO: 2 apartados'; exception when invalid_parameter_value then null; end;
  begin perform public.pes_ejercicio_desde_banco(v, array['de740000-0000-4000-8000-0000000000e1', 'de740000-0000-4000-8000-0000000000e2', 'de740000-0000-4000-8000-0000000000e3']::uuid[]);
    raise exception 'FALLO: composición sin situación común'; exception when invalid_parameter_value then null; end;
  begin perform public.pes_ejercicio_desde_banco(v, array['de740000-0000-4000-8000-0000000000e1', 'de740000-0000-4000-8000-0000000000e1', 'de740000-0000-4000-8000-0000000000e3']::uuid[], '', 'Una piedra cae desde un puente alto.');
    raise exception 'FALLO: pregunta repetida'; exception when invalid_parameter_value then null; end;
  begin perform public.pes_ejercicio_desde_banco(v, array['de740000-0000-4000-8000-0000000000e1', 'de740000-0000-4000-8000-0000000000e2', 'de740000-0000-4000-8000-0000000000e9']::uuid[], '', 'Una piedra cae desde un puente alto.');
    raise exception 'FALLO: ejercicio de otra asignatura'; exception when insufficient_privilege then null; end;
  begin perform public.pes_ejercicio_desde_banco(v, array['de740000-0000-4000-8000-0000000000e1', 'de740000-0000-4000-8000-0000000000e2', 'de740000-0000-4000-8000-0000000000e3']::uuid[],
    '', 'Una piedra cae desde un puente alto.', array[0.5, 0.2, 0.2]); raise exception 'FALLO: pesos que no suman 1'; exception when invalid_parameter_value then null; end;
  -- ejercicio 1: pesos iguales, T_ref por defecto (numérico básico: 4 min)
  perform public.pes_ejercicio_desde_banco(v, array['de740000-0000-4000-8000-0000000000e1', 'de740000-0000-4000-8000-0000000000e2', 'de740000-0000-4000-8000-0000000000e3']::uuid[],
    'Caída', 'Una piedra cae desde un puente alto.');
  -- ejercicio 2: cuatro apartados con pesos y T_ref propios
  perform public.pes_ejercicio_desde_banco(v, array['de740000-0000-4000-8000-0000000000e4', 'de740000-0000-4000-8000-0000000000e7', 'de740000-0000-4000-8000-0000000000e8', 'de740000-0000-4000-8000-0000000000e5']::uuid[],
    'Plano', 'Un bloque en un plano inclinado.', array[0.1, 0.2, 0.3, 0.4], array[60, 60, 60, 60], array['prediccion', 'formulacion', 'interpretacion', 'resolucion']);

  -- borrador aparte para el contenido del banco y redactado
  v := public.pes_crear('de740000-0000-4000-8000-000000000031', '{"titulo":"PES 3 (borrador)"}');
  insert into pes_t values ('p3', v);
  perform public.pes_ejercicio_desde_problema(v, 'pr4', 1, 4);                                    -- problema completo
  begin perform public.pes_ejercicio_desde_problema(v, 'pr7', 1, 7); raise exception 'FALLO: 7 apartados'; exception when invalid_parameter_value then null; end;
  begin perform public.pes_ejercicio_desde_problema(v, 'pr7', 5, 7); raise exception 'FALLO: empezó en una etapa que depende de la anterior';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.pes_ejercicio_desde_problema(v, 'prx', 1, 3); raise exception 'FALLO: problema incompleto';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.pes_ejercicio_desde_problema(v, 'nada', 1, 3); raise exception 'FALLO: problema inexistente';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.pes_ejercicio_desde_problema(v, 'pr7', 2, 5);                                    -- incluye la 4, de la que depende la 5
  -- redactado: claves validadas por formato; abierta con rúbrica
  begin perform public.pes_ejercicio_redactado(v, '{"apartados":[{"enunciado":"a","formato":"numeric","t_ref_s":60,"clave":{"format":"numeric","value":"1 m"}},
      {"enunciado":"b","formato":"choice","opciones":["x","y"],"t_ref_s":60,"clave":{"format":"choice","correct":[5]}},
      {"enunciado":"c","formato":"open","t_ref_s":60,"rubrica":"Explica bien la conservación"}]}'); raise exception 'FALLO: opción correcta fuera de rango';
  exception when invalid_parameter_value then null; end;
  begin perform public.pes_ejercicio_redactado(v, '{"apartados":[{"enunciado":"a","formato":"numeric","t_ref_s":60,"clave":{"format":"numeric","value":"1 m"}},
      {"enunciado":"b","formato":"numeric","t_ref_s":60,"clave":{"format":"numeric","value":"2 m"}},
      {"enunciado":"c","formato":"open","t_ref_s":60,"rubrica":""}]}'); raise exception 'FALLO: abierta sin rúbrica';
  exception when invalid_parameter_value then null; end;
  begin perform public.pes_ejercicio_redactado(v, '{"apartados":[{"enunciado":"a","formato":"numeric","t_ref_s":60,"clave":{"format":"text","accepted":["x"]}},
      {"enunciado":"b","formato":"numeric","t_ref_s":60,"clave":{"format":"numeric","value":"2 m"}},
      {"enunciado":"c","formato":"numeric","t_ref_s":60,"clave":{"format":"numeric","value":"3 m"}}]}'); raise exception 'FALLO: clave de otro formato';
  exception when invalid_parameter_value then null; end;
  perform public.pes_ejercicio_redactado(v, '{"titulo":"Péndulo","contexto":"Un péndulo de 1 m.","apartados":[
      {"enunciado":"¿Qué pasa si se duplica la masa?","formato":"choice","opciones":["Nada","Se duplica el periodo"],"t_ref_s":90,"etapa":"prediccion","clave":{"format":"choice","correct":[0]},"peso":0.2},
      {"enunciado":"Calcule el periodo.","formato":"numeric","t_ref_s":240,"etapa":"resolucion","clave":{"format":"numeric","value":"2.0 s","relTol":0.02},"peso":0.5},
      {"enunciado":"Interprete.","formato":"open","t_ref_s":300,"etapa":"interpretacion","rubrica":"Relaciona periodo y longitud, no la masa.","peso":0.3}]}');
end $$;
reset role;

do $$ declare v uuid := (select val from pes_t where k = 'p1'); v3 uuid := (select val from pes_t where k = 'p3'); begin
  if (select count(*) from public.pes_ejercicios where practica_id = v) <> 2 then raise exception 'FALLO: ejercicios'; end if;
  if (select count(*) from public.pes_apartados where practica_id = v) <> 7 then raise exception 'FALLO: apartados'; end if;
  if (select sum(peso) from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id where e.practica_id = v and e.posicion = 1) <> 1 then raise exception 'FALLO: pesos iguales suman 1'; end if;
  if (select t_ref_s from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id where e.practica_id = v and e.posicion = 1 and a.posicion = 1) <> 240 then raise exception 'FALLO: T_ref por defecto'; end if;
  if (select origen from public.pes_ejercicios where practica_id = v and posicion = 1) <> 'composicion_docente' then raise exception 'FALLO: origen composición'; end if;
  if (select k.clave ->> 'value' from public.pes_claves k join public.pes_apartados a on a.id = k.apartado_id where a.origen_exercise_id = 'de740000-0000-4000-8000-0000000000e1' and a.practica_id = v) <> '5 m' then raise exception 'FALLO: clave copiada'; end if;
  if (select k.rubrica from public.pes_claves k join public.pes_apartados a on a.id = k.apartado_id where a.origen_exercise_id = 'de740000-0000-4000-8000-0000000000e8' and a.practica_id = v) not like 'Rúbrica privada%' then raise exception 'FALLO: rúbrica copiada'; end if;
  -- problema por etapas: orden, etapas pedagógicas y origen
  if (select string_agg(a.etapa, ',' order by a.posicion) from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id where e.practica_id = v3 and e.posicion = 1)
     <> 'prediccion,resolucion,resolucion,interpretacion' then raise exception 'FALLO: etapas del problema'; end if;
  if (select origen || ' ' || origen_ref from public.pes_ejercicios where practica_id = v3 and posicion = 2) <> 'problema_banco pr7 · etapas 2–5' then raise exception 'FALLO: origen del problema'; end if;
  if (select string_agg(x.slug, ',' order by a.posicion) from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id join public.exercises x on x.id = a.origen_exercise_id
      where e.practica_id = v3 and e.posicion = 2) <> 'pr-22,pr-23,pr-24,pr-25' then raise exception 'FALLO: etapas consecutivas'; end if;
  if (select string_agg(peso::text, ',' order by a.posicion) from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id where e.practica_id = v3 and e.posicion = 3) <> '0.20000,0.50000,0.30000'
    then raise exception 'FALLO: pesos del redactado'; end if;
  insert into pes_t select 'a' || e.posicion || a.posicion, a.id from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id where a.practica_id = v;
end $$;

-- quitar un ejercicio del borrador renumera; el profesorado ve claves y rúbricas en su detalle
set local role authenticated;
do $$ declare v3 uuid := (select val from pes_t where k = 'p3'); j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000001', true);
  j := public.pes_detalle_docente(v3);
  if jsonb_array_length(j -> 'ejercicios') <> 3 or j -> 'ejercicios' -> 2 -> 'apartados' -> 2 ->> 'rubrica' not like 'Relaciona%' then raise exception 'FALLO: detalle docente %', j; end if;
  perform public.pes_borrar_ejercicio((j -> 'ejercicios' -> 0 ->> 'id')::uuid);
  j := public.pes_detalle_docente(v3);
  if jsonb_array_length(j -> 'ejercicios') <> 2 or (j -> 'ejercicios' -> 0 ->> 'posicion')::integer <> 1 or j -> 'ejercicios' -> 0 ->> 'origen_ref' <> 'pr7 · etapas 2–5' then raise exception 'FALLO: renumerar %', j; end if;
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000011', true);
  begin perform public.pes_detalle_docente(v3); raise exception 'FALLO: estudiante ve el detalle docente'; exception when insufficient_privilege then null; end;
  begin perform public.pes_respuestas_docente(v3); raise exception 'FALLO: estudiante ve respuestas'; exception when insufficient_privilege then null; end;
  begin perform public.pes_lista_docente('de740000-0000-4000-8000-000000000031'); raise exception 'FALLO: estudiante ve la lista docente'; exception when insufficient_privilege then null; end;
  begin perform public.pes_borrar_practica(v3); raise exception 'FALLO: estudiante borra'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000001', true);
  begin perform public.pes_publicar(v3); raise exception 'FALLO: publicar sin fecha límite'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.pes_borrar_practica(v3);
end $$;
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- 2) Nada es legible por REST: tablas cerradas, funciones internas y de servidor no ejecutables
-- ---------------------------------------------------------------------------------------------------------------
set local role authenticated;
do $$ declare t text; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000011', true);
  foreach t in array array['pes_practicas', 'pes_ejercicios', 'pes_apartados', 'pes_claves', 'pes_asignaciones', 'pes_estado', 'pes_respuestas', 'pes_eventos'] loop
    begin execute format('select count(*) from public.%I', t); raise exception 'FALLO: % legible por authenticated', t;
    exception when insufficient_privilege then null; end;
  end loop;
  begin perform public.pes_puntaje((select val from pes_t where k = 'p1'), auth.uid()); raise exception 'FALLO: pes_puntaje expuesta';
  exception when insufficient_privilege then null; end;
  begin perform public.pes_actual_json((select val from pes_t where k = 'p1'), auth.uid()); raise exception 'FALLO: pes_actual_json expuesta';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_pes_preparar(auth.uid(), (select val from pes_t where k = 'p1'), (select val from pes_t where k = 'a11')); raise exception 'FALLO: svc expuesta';
  exception when insufficient_privilege then null; end;
  if jsonb_array_length(public.pes_mis_practicas()) <> 0 then raise exception 'FALLO: borrador visible'; end if;
  begin perform public.pes_iniciar((select val from pes_t where k = 'p1')); raise exception 'FALLO: iniciar borrador';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare f text; begin
  foreach f in array array['svc_pes_preparar(uuid, uuid, uuid)', 'svc_pes_confirmar(uuid, uuid, uuid, jsonb, jsonb, boolean, uuid)', 'svc_pes_variante(uuid, uuid, uuid)',
    'pes_avanzar(uuid, uuid, uuid)', 'pes_log(uuid, uuid, uuid, text, jsonb)', 'pes_vencer(uuid, uuid)', 'pes_copiar_apartado(uuid, uuid, integer, uuid, numeric, integer, text)'] loop
    if has_function_privilege('authenticated', 'public.' || f, 'execute') or has_function_privilege('anon', 'public.' || f, 'execute') then raise exception 'FALLO: % expuesta', f; end if;
  end loop;
  if has_function_privilege('anon', 'public.pes_iniciar(uuid)', 'execute') then raise exception 'FALLO: anon'; end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3) Publicar: valida, congela y asigna (solo a matriculados de la sección); adaptaciones separadas
-- ---------------------------------------------------------------------------------------------------------------
set local role authenticated;
do $$ declare v uuid := (select val from pes_t where k = 'p1'); r jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000002', true);
  begin perform public.pes_publicar(v); raise exception 'FALLO: profesor ajeno publica'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000001', true);
  r := public.pes_publicar(v);
  if (r ->> 'asignados')::integer <> 3 or (r ->> 'version')::integer <> 1 then raise exception 'FALLO: publicar %', r; end if;
  begin perform public.pes_publicar(v); raise exception 'FALLO: publicar dos veces'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.pes_ejercicio_desde_banco(v, array['de740000-0000-4000-8000-0000000000e1', 'de740000-0000-4000-8000-0000000000e2', 'de740000-0000-4000-8000-0000000000e3']::uuid[], '', 'Una piedra cae desde un puente alto.');
    raise exception 'FALLO: añadir tras publicar'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.pes_editar(v, '{"p_max": 10}'); raise exception 'FALLO: cambiar P_max tras publicar'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.pes_editar(v, '{"incremento": 0}'); raise exception 'FALLO: cambiar incremento tras publicar'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.pes_editar(v, jsonb_build_object('cierra_at', now() + interval '1 day')); raise exception 'FALLO: acortó el plazo tras publicar';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.pes_editar(v, jsonb_build_object('cierra_at', now() + interval '8 days'));          -- ampliar sí
  perform public.pes_editar(v, '{"titulo": "PES 1 (corregido)"}');
  -- adaptaciones: el tiempo adicional NO alarga la espera; el factor de espera solo la reduce
  perform public.pes_adaptacion(v, 'de740000-0000-4000-8000-000000000013', 120, null, true, 'Tiempo adicional aprobado');
  perform public.pes_adaptacion(v, 'de740000-0000-4000-8000-000000000012', null, 0.5, null, 'Espera reducida aprobada');
  begin perform public.pes_adaptacion(v, 'de740000-0000-4000-8000-000000000012', null, 1.5, null, null); raise exception 'FALLO: una adaptación alargó la espera';
  exception when invalid_parameter_value then null; end;
  begin perform public.pes_adaptacion(v, 'de740000-0000-4000-8000-000000000014', 30, null, null, null); raise exception 'FALLO: adaptar a no asignado';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
reset role;
do $$ begin
  begin update public.pes_apartados set peso = 0.5 where id = (select val from pes_t where k = 'a11'); raise exception 'FALLO: apartado editable tras publicar';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin update public.pes_claves set clave = '{"format":"numeric","value":"6 m"}' where apartado_id = (select val from pes_t where k = 'a11'); raise exception 'FALLO: clave editable tras publicar';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  if public.pes_cierre((select val from pes_t where k = 'p1'), 'de740000-0000-4000-8000-000000000013')
     <> (select cierra_at + interval '120 minutes' from public.pes_practicas where id = (select val from pes_t where k = 'p1')) then raise exception 'FALLO: plazo personal'; end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4) Estudiante: condiciones, revelado de UN apartado, sin claves ni futuros
-- ---------------------------------------------------------------------------------------------------------------
set local role authenticated;
do $$ declare v uuid := (select val from pes_t where k = 'p1'); j jsonb; j2 jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000014', true);
  if jsonb_array_length(public.pes_mis_practicas()) <> 0 then raise exception 'FALLO: no matriculado la ve'; end if;
  begin perform public.pes_iniciar(v); raise exception 'FALLO: no matriculado inicia'; exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000011', true);
  j := public.pes_mis_practicas();
  if jsonb_array_length(j) <> 1 or j -> 0 ->> 'estado' <> 'no_iniciada' or (j -> 0 ->> 'apartados')::integer <> 7 then raise exception 'FALLO: mis prácticas %', j; end if;
  if j::text like '%Enunciado secreto%' or j::text like '%5 m%' or j::text like '%Rúbrica%' then raise exception 'FALLO: la lista filtra contenido'; end if;
  if j -> 0 -> 'resultado' <> 'null'::jsonb then raise exception 'FALLO: resultado antes de publicarlo'; end if;
  j := public.pes_actual(v);
  if j ->> 'estado' <> 'no_iniciada' or j ? 'apartado' then raise exception 'FALLO: actual antes de iniciar %', j; end if;
  j := public.pes_iniciar(v);
  if j ->> 'estado' <> 'apartado_abierto' or (j -> 'apartado' ->> 'id')::uuid <> (select val from pes_t where k = 'a11') or j -> 'apartado' ->> 'letra' <> 'A' then raise exception 'FALLO: primer apartado %', j; end if;
  if (j ->> 't_min_s')::numeric <> 288 then raise exception 'FALLO: T_min = 1.2·240 (%)', j ->> 't_min_s'; end if;
  if j::text not like '%Enunciado secreto 1%' or j::text like '%Enunciado secreto 2%' or j::text like '%Enunciado secreto 4%' then raise exception 'FALLO: revela futuros'; end if;
  if j::text like '%5 m%' or j::text like '%expl 1%' or j::text like '%relTol%' then raise exception 'FALLO: revela la clave'; end if;
  if (j ->> 'pegado_permitido')::boolean then raise exception 'FALLO: pegado por defecto'; end if;
  j2 := public.pes_iniciar(v);
  if j2 -> 'apartado' ->> 'id' <> j -> 'apartado' ->> 'id' or j2 ->> 'revelado_at' <> j ->> 'revelado_at' then raise exception 'FALLO: iniciar no idempotente'; end if;
  j2 := public.pes_actual(v);
  if j2 ->> 'revelado_at' <> j ->> 'revelado_at' then raise exception 'FALLO: el tiempo se reinicia al recargar'; end if;
  begin perform public.pes_borrador(v, (select val from pes_t where k = 'a12'), 'x', 1); raise exception 'FALLO: borrador de un apartado futuro';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.pes_borrador(v, (select val from pes_t where k = 'a11'), 'nuevo', 2);
  perform public.pes_borrador(v, (select val from pes_t where k = 'a11'), 'viejo', 1);
  if public.pes_actual(v) ->> 'borrador' <> 'nuevo' then raise exception 'FALLO: borrador viejo pisó al nuevo'; end if;
  perform public.pes_evento_cliente(v, 'pegado_bloqueado');
  begin perform public.pes_evento_cliente(v, 'texto_pegado_completo'); raise exception 'FALLO: tipo de evento libre'; exception when invalid_parameter_value then null; end;

  -- E3: 120 min adicionales y pegado permitido; su espera mínima es la de todos (no se penaliza)
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000013', true);
  j := public.pes_iniciar(v);
  if (j ->> 't_min_s')::numeric <> 288 or not (j ->> 'pegado_permitido')::boolean then raise exception 'FALLO: el tiempo adicional cambió la espera %', j; end if;
  -- E2: factor de espera 0.5 → 144 s
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000012', true);
  if (public.pes_mis_practicas() -> 0 ->> 'minutos_espera')::numeric <> round((288 * 3 + 72 * 4) * 0.5 / 60) then raise exception 'FALLO: minutos de espera con factor'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- 5) Transiciones del servidor: tiempo mínimo, anticipación (m), idempotencia, secuencia e irreversibilidad
-- ---------------------------------------------------------------------------------------------------------------
set local role service_role;
do $$ declare v uuid := (select val from pes_t where k = 'p1'); e1 uuid := 'de740000-0000-4000-8000-000000000011'; j jsonb; pr jsonb; begin
  pr := public.svc_pes_preparar(e1, v, (select val from pes_t where k = 'a11'));
  if pr -> 'clave' ->> 'value' <> '5 m' or pr ->> 'semilla' is null then raise exception 'FALLO: preparar %', pr; end if;
  begin perform public.svc_pes_preparar(e1, v, (select val from pes_t where k = 'a12')); raise exception 'FALLO: preparar un apartado futuro';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.svc_pes_confirmar(e1, v, (select val from pes_t where k = 'a11'), '{"text":"5 m"}', '{"status":"correct","credit":1}', false, 'de740000-0000-4000-8000-00000000c001');
    raise exception 'FALLO: confirmó antes del tiempo mínimo'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  j := public.svc_pes_confirmar(e1, v, (select val from pes_t where k = 'a11'), '{"text":"5 m"}', '{"status":"correct","credit":1}', true, 'de740000-0000-4000-8000-00000000c001');
  if j ->> 'accion' <> 'anticipada' or (j -> 'actual' -> 'apartado' ->> 'id')::uuid <> (select val from pes_t where k = 'a12') then raise exception 'FALLO: anticipada %', j; end if;
  if j::text like '%correct%' or j::text like '%credit%' then raise exception 'FALLO: revela si acertó'; end if;
  j := public.svc_pes_confirmar(e1, v, (select val from pes_t where k = 'a11'), '{"text":"5 m"}', '{"status":"correct","credit":1}', true, 'de740000-0000-4000-8000-00000000c001');
  if not (j ->> 'repetida')::boolean or (j -> 'actual' -> 'apartado' ->> 'id')::uuid <> (select val from pes_t where k = 'a12') then raise exception 'FALLO: reenvío %', j; end if;
  begin perform public.svc_pes_confirmar(e1, v, (select val from pes_t where k = 'a11'), '{"text":"7 m"}', '{"status":"correct","credit":1}', true, 'de740000-0000-4000-8000-00000000c002');
    raise exception 'FALLO: reabrió A'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.svc_pes_confirmar(e1, v, (select val from pes_t where k = 'a13'), '{"text":"5 m"}', '{"status":"correct","credit":1}', true, 'de740000-0000-4000-8000-00000000c003');
    raise exception 'FALLO: respondió un apartado futuro'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.svc_pes_confirmar('de740000-0000-4000-8000-000000000012', v, (select val from pes_t where k = 'a12'), '{"text":"5 m"}', '{"status":"correct","credit":1}', true, 'de740000-0000-4000-8000-00000000c009');
    raise exception 'FALLO: E2 confirmó un apartado que no tiene abierto'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.svc_pes_confirmar('de740000-0000-4000-8000-000000000013', v, (select val from pes_t where k = 'a11'), '{"text":"5 m"}', '{"status":"correct","credit":1}', true, 'de740000-0000-4000-8000-00000000c001');
    raise exception 'FALLO: idempotencia ajena'; exception when insufficient_privilege then null; end;
end $$;
reset role;

update public.pes_estado set revelado_at = now() - interval '10 minutes' where practica_id = (select val from pes_t where k = 'p1') and user_id = 'de740000-0000-4000-8000-000000000011';
set local role service_role;
do $$ declare v uuid := (select val from pes_t where k = 'p1'); e1 uuid := 'de740000-0000-4000-8000-000000000011'; j jsonb; begin
  j := public.svc_pes_confirmar(e1, v, (select val from pes_t where k = 'a12'), '{"text":"9 m"}', '{"status":"incorrect","credit":0}', true, 'de740000-0000-4000-8000-00000000c004');
  if j ->> 'accion' <> 'confirmada' or (j -> 'actual' -> 'apartado' ->> 'id')::uuid <> (select val from pes_t where k = 'a13') then raise exception 'FALLO: confirmada tras T_min %', j; end if;
end $$;
reset role;

set local role authenticated;
do $$ declare v uuid := (select val from pes_t where k = 'p1'); j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000011', true);
  j := public.pes_omitir(v, (select val from pes_t where k = 'a13'), 'de740000-0000-4000-8000-00000000c005');
  if (j -> 'actual' -> 'apartado' ->> 'id')::uuid <> (select val from pes_t where k = 'a21') or j -> 'actual' -> 'ejercicio' ->> 'contexto' <> 'Un bloque en un plano inclinado.' then raise exception 'FALLO: omitir %', j; end if;
  j := public.pes_omitir(v, (select val from pes_t where k = 'a13'), 'de740000-0000-4000-8000-00000000c005');
  if not (j ->> 'repetida')::boolean then raise exception 'FALLO: omitir no idempotente'; end if;
  begin perform public.pes_omitir(v, (select val from pes_t where k = 'a13'), 'de740000-0000-4000-8000-00000000c006'); raise exception 'FALLO: reabrió el omitido';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000012', true);
  begin perform public.pes_omitir(v, (select val from pes_t where k = 'a21'), 'de740000-0000-4000-8000-00000000c007'); raise exception 'FALLO: E2 omite por E1';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin update public.pes_respuestas set q = 1; raise exception 'FALLO: respuestas editables'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ejercicio 2 de E1: e4 correcto a tiempo, e7 parcial anticipado, e8 abierto (revisión), e5 correcto a tiempo
update public.pes_estado set revelado_at = now() - interval '2 minutes' where practica_id = (select val from pes_t where k = 'p1') and user_id = 'de740000-0000-4000-8000-000000000011';
set local role service_role;
select public.svc_pes_confirmar('de740000-0000-4000-8000-000000000011', (select val from pes_t where k = 'p1'), (select val from pes_t where k = 'a21'), '{"text":"5 m"}', '{"status":"correct","credit":1}', false, 'de740000-0000-4000-8000-00000000c011');
select public.svc_pes_confirmar('de740000-0000-4000-8000-000000000011', (select val from pes_t where k = 'p1'), (select val from pes_t where k = 'a22'), '{"selected":[1,2]}', '{"status":"partial","credit":0.5}', true, 'de740000-0000-4000-8000-00000000c012');
reset role;
update public.pes_estado set revelado_at = now() - interval '2 minutes' where practica_id = (select val from pes_t where k = 'p1') and user_id = 'de740000-0000-4000-8000-000000000011';
set local role service_role;
select public.svc_pes_confirmar('de740000-0000-4000-8000-000000000011', (select val from pes_t where k = 'p1'), (select val from pes_t where k = 'a23'), '{"text":"Porque…"}', '{"status":"pending_review","credit":0}', false, 'de740000-0000-4000-8000-00000000c013');
reset role;
update public.pes_estado set revelado_at = now() - interval '2 minutes' where practica_id = (select val from pes_t where k = 'p1') and user_id = 'de740000-0000-4000-8000-000000000011';
set local role service_role;
do $$ declare j jsonb; begin
  j := public.svc_pes_confirmar('de740000-0000-4000-8000-000000000011', (select val from pes_t where k = 'p1'), (select val from pes_t where k = 'a24'), '{"text":"5.0 m"}', '{"status":"correct","credit":1}', false, 'de740000-0000-4000-8000-00000000c014');
  if j -> 'actual' ->> 'estado' <> 'completada' then raise exception 'FALLO: completada %', j; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- 6) Registro inmutable; puntuación provisional, validada y máxima alcanzable
-- ---------------------------------------------------------------------------------------------------------------
do $$ declare v uuid := (select val from pes_t where k = 'p1'); e1 uuid := 'de740000-0000-4000-8000-000000000011'; r public.pes_respuestas; s jsonb; esp numeric; begin
  select * into r from public.pes_respuestas where user_id = e1 and apartado_id = (select val from pes_t where k = 'a11');
  if r.accion <> 'anticipada' or r.m <> 0.5 or r.q <> 1 or r.t_min_s <> 288 or r.validada then raise exception 'FALLO: registro A %', row_to_json(r); end if;
  select * into r from public.pes_respuestas where user_id = e1 and apartado_id = (select val from pes_t where k = 'a12');
  if r.accion <> 'confirmada' or r.m <> 1 or r.q <> 0 or r.segundos < 599 then raise exception 'FALLO: registro B %', row_to_json(r); end if;
  select * into r from public.pes_respuestas where user_id = e1 and apartado_id = (select val from pes_t where k = 'a23');
  if r.revision <> 'pendiente' or r.q <> 0 then raise exception 'FALLO: abierto pendiente %', row_to_json(r); end if;
  if (select count(*) from public.pes_respuestas where user_id = e1) <> 7 then raise exception 'FALLO: 7 respuestas'; end if;
  begin update public.pes_respuestas set m = 1 where id = (select id from public.pes_respuestas where user_id = e1 and apartado_id = (select val from pes_t where k = 'a11'));
    raise exception 'FALLO: m modificable'; exception when insufficient_privilege then null; end;
  begin update public.pes_respuestas set respuesta = '{"text":"otra"}' where user_id = e1; raise exception 'FALLO: respuesta modificable'; exception when insufficient_privilege then null; end;
  begin update public.pes_respuestas set resultado = '{"status":"correct"}' where user_id = e1; raise exception 'FALLO: resultado modificable'; exception when insufficient_privilege then null; end;
  begin delete from public.pes_respuestas where user_id = e1; raise exception 'FALLO: respuesta borrable'; exception when insufficient_privilege then null; end;
  begin update public.pes_eventos set tipo = 'otro' where practica_id = v; raise exception 'FALLO: diario modificable'; exception when insufficient_privilege then null; end;
  begin delete from public.pes_eventos where practica_id = v; raise exception 'FALLO: diario borrable'; exception when insufficient_privilege then null; end;
  if not exists (select 1 from public.pes_eventos where practica_id = v and user_id = e1 and tipo = 'apartado_anticipado')
     or not exists (select 1 from public.pes_eventos where practica_id = v and user_id = e1 and tipo = 'pegado_bloqueado')
     or (select count(*) from public.pes_eventos where practica_id = v and user_id = e1 and tipo = 'apartado_revelado') <> 7 then raise exception 'FALLO: diario incompleto'; end if;

  -- provisional: S = 0.93333, S·m = 0.716665, N = 2 (igual que tests/pes.test.ts)
  s := public.pes_puntaje(v, e1);
  esp := 8 * 0.93333 * 0.716665 / 4;
  if (s -> 'provisional' ->> 'S')::numeric <> 0.93333 or (s -> 'provisional' ->> 'S_m')::numeric <> 0.716665 or abs((s -> 'provisional' ->> 'P')::numeric - esp) > 1e-5
     or abs((s -> 'provisional' ->> 'P_base')::numeric - 8 * power(0.93333 / 2, 2)) > 1e-5 or (s ->> 'omitidos')::integer <> 1 or (s ->> 'anticipados')::integer <> 2
     or (s ->> 'pendientes_revision')::integer <> 1 then raise exception 'FALLO: provisional %', s; end if;
  -- validada: nada validado todavía
  if (s -> 'validada' ->> 'P')::numeric <> 0 or (s -> 'validada' ->> 'completa')::boolean then raise exception 'FALLO: validada antes de validar %', s; end if;
  -- máxima: E1 terminó (no puede responder más): solo el pendiente con crédito completo → S' = 1.23333, S'·m = 1.016665
  if (s ->> 'puede_responder')::boolean or abs((s -> 'maxima_alcanzable' ->> 'P')::numeric - 8 * 1.23333 * 1.016665 / 4) > 1e-5 then raise exception 'FALLO: máxima %', s; end if;
  -- E2 no respondió nada y aún puede: provisional 0, máxima P_max
  s := public.pes_puntaje(v, 'de740000-0000-4000-8000-000000000012');
  if (s -> 'provisional' ->> 'P')::numeric <> 0 or (s -> 'maxima_alcanzable' ->> 'P')::numeric <> 8 or not (s ->> 'puede_responder')::boolean then raise exception 'FALLO: sin respuestas %', s; end if;
end $$;

do $$ begin
  insert into pes_t select 'r23', id from public.pes_respuestas where user_id = 'de740000-0000-4000-8000-000000000011' and apartado_id = (select val from pes_t where k = 'a23');
  insert into pes_t select 'r13', id from public.pes_respuestas where user_id = 'de740000-0000-4000-8000-000000000011' and apartado_id = (select val from pes_t where k = 'a13');
end $$;
set local role authenticated;
do $$ declare v uuid := (select val from pes_t where k = 'p1'); j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000011', true);
  begin perform public.pes_revisar((select val from pes_t where k = 'r23'), 1, 'yo mismo'); raise exception 'FALLO: estudiante se revisa'; exception when insufficient_privilege then null; end;
  begin perform public.pes_validar(v); raise exception 'FALLO: estudiante valida'; exception when insufficient_privilege then null; end;
  begin perform public.pes_publicar_resultados(v, true); raise exception 'FALLO: estudiante publica resultados'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000001', true);
  j := public.pes_respuestas_docente(v);
  if jsonb_array_length(j) <> 1 or j -> 0 ->> 'rubrica' not like 'Rúbrica privada%' then raise exception 'FALLO: cola de revisión %', j; end if;
  begin perform public.pes_revisar((select val from pes_t where k = 'r23'), 0.8, ''); raise exception 'FALLO: revisión sin justificación'; exception when invalid_parameter_value then null; end;
  begin perform public.pes_revisar((select val from pes_t where k = 'r13'), 1, 'regalo'); raise exception 'FALLO: puntuar un omitido'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.pes_revisar((select val from pes_t where k = 'r23'), 0.8, 'Argumento correcto, falta una unidad');
end $$;
reset role;
do $$ declare s jsonb; v uuid := (select val from pes_t where k = 'p1'); e1 uuid := 'de740000-0000-4000-8000-000000000011'; begin
  s := public.pes_puntaje(v, e1);
  -- provisional: S = 0.93333 + 0.3·0.8 = 1.17333; S_m = 0.716665 + 0.24 = 0.956665. Validada: solo el revisado (0.24, 0.24)
  if (s -> 'provisional' ->> 'S')::numeric <> 1.17333 or (s ->> 'pendientes_revision')::integer <> 0 or abs((s -> 'provisional' ->> 'P')::numeric - 8 * 1.17333 * 0.956665 / 4) > 1e-5 then raise exception 'FALLO: provisional tras revisión %', s; end if;
  if abs((s -> 'validada' ->> 'P')::numeric - 8 * 0.24 * 0.24 / 4) > 1e-6 then raise exception 'FALLO: validada parcial %', s; end if;
  -- con todo calificado, la máxima alcanzable coincide con la provisional
  if (s -> 'maxima_alcanzable' ->> 'P') <> (s -> 'provisional' ->> 'P') then raise exception 'FALLO: máxima = provisional %', s; end if;
  if not exists (select 1 from public.pes_eventos where tipo = 'revision_docente' and user_id = e1) then raise exception 'FALLO: revisión sin evento'; end if;
end $$;
set local role authenticated;
do $$ declare v uuid := (select val from pes_t where k = 'p1'); j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000001', true);
  if public.pes_validar(v, 'de740000-0000-4000-8000-000000000011') <> 6 then raise exception 'FALLO: validar 6 automáticas (incluye el omitido)'; end if;
  perform public.pes_publicar_resultados(v, true);
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000011', true);
  j := public.pes_mis_practicas() -> 0 -> 'resultado';
  if (j -> 'validada' ->> 'P') <> (j -> 'provisional' ->> 'P') or not (j -> 'validada' ->> 'completa')::boolean then raise exception 'FALLO: validada completa %', j; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- 7) Liberación por bloques, vencimiento con tiempo adicional y cierre
-- ---------------------------------------------------------------------------------------------------------------
set local role authenticated;
do $$ declare v uuid; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000001', true);
  v := public.pes_crear('de740000-0000-4000-8000-000000000031', jsonb_build_object('titulo', 'PES 2', 'cierra_at', now() + interval '30 days',
    'liberacion', jsonb_build_array(jsonb_build_object('desde', current_date - 1, 'ejercicios', 1), jsonb_build_object('desde', current_date + 3, 'ejercicios', 2))));
  insert into pes_t values ('p2', v);
  perform public.pes_ejercicio_desde_banco(v, array['de740000-0000-4000-8000-0000000000e1', 'de740000-0000-4000-8000-0000000000e2', 'de740000-0000-4000-8000-0000000000e3']::uuid[], '', 'Una piedra cae desde un puente alto.');
  perform public.pes_ejercicio_desde_problema(v, 'pr4', 1, 4);
  perform public.pes_publicar(v, array['de740000-0000-4000-8000-000000000012', 'de740000-0000-4000-8000-000000000013']::uuid[]);
  perform public.pes_adaptacion(v, 'de740000-0000-4000-8000-000000000013', 60, null, null, null);
end $$;
reset role;
do $$ begin
  if (select count(*) from public.pes_asignaciones where practica_id = (select val from pes_t where k = 'p2')) <> 2 then raise exception 'FALLO: asignación a lista'; end if;
end $$;
set local role authenticated;
do $$ declare v uuid := (select val from pes_t where k = 'p2'); j jsonb; i integer; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000011', true);
  begin perform public.pes_iniciar(v); raise exception 'FALLO: E1 inicia una PES de otra lista'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000012', true);
  j := public.pes_iniciar(v);
  for i in 1..3 loop j := (public.pes_omitir(v, (j -> 'apartado' ->> 'id')::uuid, gen_random_uuid())) -> 'actual'; end loop;
  if j ->> 'estado' <> 'esperando_liberacion' or (j ->> 'proximo_ejercicio')::integer <> 2 or (j ->> 'disponible_desde')::date <> current_date + 3 or j ? 'apartado' then
    raise exception 'FALLO: espera de liberación %', j; end if;
  if j::text like '%Etapa secreta%' then raise exception 'FALLO: revela el bloque no liberado'; end if;
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000013', true);
  perform public.pes_iniciar(v);
end $$;
reset role;
set local session_replication_role = replica;
update public.pes_practicas set liberacion = jsonb_build_array(jsonb_build_object('desde', current_date - 1, 'ejercicios', 2)) where id = (select val from pes_t where k = 'p2');
set local session_replication_role = origin;
set local role authenticated;
do $$ declare v uuid := (select val from pes_t where k = 'p2'); j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000012', true);
  j := public.pes_actual(v);
  if j ->> 'estado' <> 'apartado_abierto' or j -> 'ejercicio' ->> 'posicion' <> '2' then raise exception 'FALLO: liberado %', j; end if;
end $$;
reset role;
-- vence la fecha límite general: E2 queda vencida; E3, con 60 min adicionales, sigue trabajando
set local session_replication_role = replica;
update public.pes_practicas set cierra_at = now() - interval '1 second', abre_at = null where id = (select val from pes_t where k = 'p2');
set local session_replication_role = origin;
set local role authenticated;
do $$ declare v uuid := (select val from pes_t where k = 'p2'); j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000012', true);
  j := public.pes_actual(v);
  if j ->> 'estado' <> 'vencida' or j ? 'apartado' then raise exception 'FALLO: vencida %', j; end if;
  begin perform public.pes_omitir(v, gen_random_uuid(), gen_random_uuid()); raise exception 'FALLO: omitir vencida';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000013', true);
  j := public.pes_actual(v);
  if j ->> 'estado' <> 'apartado_abierto' or (j ->> 'cierre')::timestamptz <= now() then raise exception 'FALLO: el tiempo adicional no amplió el plazo %', j; end if;
  j := public.pes_omitir(v, (j -> 'apartado' ->> 'id')::uuid, gen_random_uuid());
  if (j ->> 'repetida')::boolean then raise exception 'FALLO: E3 no pudo trabajar en su tiempo adicional'; end if;
end $$;
reset role;
do $$ declare s jsonb; begin
  -- quien ya no puede responder no tiene «máxima» por encima de lo hecho
  s := public.pes_puntaje((select val from pes_t where k = 'p2'), 'de740000-0000-4000-8000-000000000012');
  if (s ->> 'puede_responder')::boolean or (s -> 'maxima_alcanzable' ->> 'P')::numeric <> 0 then raise exception 'FALLO: máxima tras vencer %', s; end if;
end $$;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000001', true);
  perform public.pes_cambiar_estado((select val from pes_t where k = 'p1'), 'cerrada');
  perform set_config('request.jwt.claim.sub', 'de740000-0000-4000-8000-000000000013', true);
  begin perform public.pes_actual((select val from pes_t where k = 'p1')); raise exception 'FALLO: cerrada sigue abierta'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
reset role;

-- las prácticas ordinarias no se tocan: ninguna tabla previa recibió filas de la PES
do $$ begin
  if exists (select 1 from public.activities where class_id = 'de740000-0000-4000-8000-000000000031') then raise exception 'FALLO: la PES creó actividades ordinarias'; end if;
  if exists (select 1 from public.attempts where user_id::text like 'de740000-%') then raise exception 'FALLO: la PES creó intentos ordinarios'; end if;
end $$;

select 'pes.sql: PRUEBAS PASARON' as resultado;
rollback;
