-- Pruebas: PES · seguimiento docente (migración 75): simulador, calibración, monitor, historial y control presencial.
-- Profesor P (sección S), profesor ajeno Q; estudiantes E1 y E2. Banco: e1…e6 (en la práctica) y e7, e8 (candidatos).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de750000-0000-4000-8000-000000000001', 'sg1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-seg","aula_role":"teacher"}', '{}', now(), now()),
  ('de750000-0000-4000-8000-000000000002', 'sg2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-seg-otro","aula_role":"teacher"}', '{}', now(), now()),
  ('de750000-0000-4000-8000-000000000011', 'sg11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-seg-1"}', '{}', now(), now()),
  ('de750000-0000-4000-8000-000000000012', 'sg12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-seg-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de750000-%';
update public.profiles set role = 'teacher' where id in ('de750000-0000-4000-8000-000000000001', 'de750000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de750000-0000-4000-8000-0000000000a0', 'Curso seguimiento');
insert into public.units (id, course_id, slug, title, position) values ('de750000-0000-4000-8000-0000000000a1', 'de750000-0000-4000-8000-0000000000a0', 'u', 'U', 1);
insert into public.lessons (id, unit_id, course_id, slug, title) values ('de750000-0000-4000-8000-0000000000a2', 'de750000-0000-4000-8000-0000000000a1', 'de750000-0000-4000-8000-0000000000a0', 'mru', 'MRU');
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, published)
select ('de750000-0000-4000-8000-0000000000e' || i)::uuid, 'de750000-0000-4000-8000-0000000000a0', 'de750000-0000-4000-8000-0000000000a2', 'sg-' || i,
  'numerica', 'basico', 'bank', 'numeric', 'Pregunta ' || i, true from generate_series(1, 8) i;
insert into public.exercise_keys (exercise_id, answer)
select ('de750000-0000-4000-8000-0000000000e' || i)::uuid, ('{"format":"numeric","value":"' || i || ' m"}')::jsonb from generate_series(1, 8) i;
update public.exercise_keys set answer = '{"format":"numeric","value":"0 m","relTol":0.02,"variante":{"plantilla":"A","respuesta":"d","unidad":"m"}}'
  where exercise_id = 'de750000-0000-4000-8000-0000000000e2';
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de750000-0000-4000-8000-000000000031', 'de750000-0000-4000-8000-0000000000a0', 'S', 'SEG75001', 'de750000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de750000-0000-4000-8000-000000000031', 'de750000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de750000-0000-4000-8000-000000000031', 'de750000-0000-4000-8000-000000000011'), ('de750000-0000-4000-8000-000000000031', 'de750000-0000-4000-8000-000000000012');

create temp table sg_t (k text primary key, val uuid);
grant all on sg_t to public;

-- ---------------------------------------------------------------------------------------------------------------
-- 1) Borrador con dos ejercicios; política de control anunciada; simulador docente en borrador
-- ---------------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.path', '/rpc/prueba', true);
do $$ declare v uuid; j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000001', true);
  v := public.pes_crear('de750000-0000-4000-8000-000000000031', jsonb_build_object('titulo', 'PES seguimiento', 'cierra_at', now() + interval '5 days'));
  insert into sg_t values ('p', v);
  perform public.pes_ejercicio_desde_banco(v, array['de750000-0000-4000-8000-0000000000e1', 'de750000-0000-4000-8000-0000000000e2', 'de750000-0000-4000-8000-0000000000e3']::uuid[],
    'Uno', 'Un móvil recorre una pista recta.', null, array[60, 60, 60]);
  perform public.pes_ejercicio_desde_banco(v, array['de750000-0000-4000-8000-0000000000e4', 'de750000-0000-4000-8000-0000000000e5', 'de750000-0000-4000-8000-0000000000e6']::uuid[],
    'Dos', 'Un segundo móvil parte del reposo.', null, array[60, 60, 60]);
  begin perform public.pes_politica_control(v, '{"modo":"ajuste","peso":0.5,"descripcion":"Control presencial de un ejercicio al azar."}'); raise exception 'FALLO: peso > 0.3';
  exception when invalid_parameter_value then null; end;
  begin perform public.pes_politica_control(v, '{"modo":"ajuste","peso":0.2,"descripcion":"corto"}'); raise exception 'FALLO: política sin descripción';
  exception when invalid_parameter_value then null; end;
  perform public.pes_politica_control(v, '{"modo":"ajuste","peso":0.2,"descripcion":"Se hará un control presencial sobre un ejercicio realizado; P × [1 − 0,2·(1 − C)]."}');
  -- simulador: solo el profesorado de la sección
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000002', true);
  begin perform public.pes_piloto_iniciar(v); raise exception 'FALLO: profesor ajeno simula'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000011', true);
  begin perform public.pes_piloto_iniciar(v); raise exception 'FALLO: estudiante simula'; exception when insufficient_privilege then null; end;
  begin perform public.pes_monitor(v); raise exception 'FALLO: estudiante ve el monitor'; exception when insufficient_privilege then null; end;
  begin perform public.pes_informe_tiempos(v); raise exception 'FALLO: estudiante ve tiempos'; exception when insufficient_privilege then null; end;
  begin perform public.pes_calibrar((select id from public.pes_apartados where practica_id = v limit 1), 100, 'papel', null); raise exception 'FALLO: estudiante calibra';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000001', true);
  j := public.pes_piloto_iniciar(v);
  if not (j ->> 'prueba')::boolean or j ->> 'estado' <> 'no_iniciada' or j -> 'control_politica' ->> 'modo' <> 'ajuste' then raise exception 'FALLO: piloto %', j; end if;
  j := public.pes_iniciar(v);                                                   -- en BORRADOR, como estudiante de prueba
  if j ->> 'estado' <> 'apartado_abierto' or j -> 'apartado' ->> 'letra' <> 'A' then raise exception 'FALLO: piloto en borrador %', j; end if;
  insert into sg_t values ('a1', (j -> 'apartado' ->> 'id')::uuid);
  if jsonb_array_length(public.pes_mis_practicas()) <> 0 then raise exception 'FALLO: el simulador aparece como práctica real'; end if;
end $$;
reset role;

-- A con la espera cumplida (sin adelantar), B adelantando el reloj, C omitido
update public.pes_estado set revelado_at = now() - interval '100 seconds' where user_id = 'de750000-0000-4000-8000-000000000001';
set local role service_role;
select public.svc_pes_confirmar('de750000-0000-4000-8000-000000000001', (select val from sg_t where k = 'p'), (select val from sg_t where k = 'a1'),
  '{"text":"1 m"}', '{"status":"correct","credit":1,"code":"ok"}', false, 'de750000-0000-4000-8000-00000000c001');
reset role;
set local role authenticated;
do $$ declare v uuid := (select val from sg_t where k = 'p'); j jsonb; ap uuid; begin
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000001', true);
  ap := (public.pes_actual(v) -> 'apartado' ->> 'id')::uuid;
  insert into sg_t values ('a2', ap);
  perform public.pes_piloto_adelantar(v, 300);
  if (public.pes_actual(v) ->> 'revelado_at')::timestamptz > now() - interval '299 seconds' then raise exception 'FALLO: adelantar el reloj del simulador'; end if;
end $$;
reset role;
set local role service_role;
select public.svc_pes_confirmar('de750000-0000-4000-8000-000000000001', (select val from sg_t where k = 'p'), (select val from sg_t where k = 'a2'),
  '{"text":"9 m"}', '{"status":"incorrect","credit":0,"code":"wrong"}', false, 'de750000-0000-4000-8000-00000000c002');
reset role;
set local role authenticated;
do $$ declare v uuid := (select val from sg_t where k = 'p'); j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000001', true);
  perform public.pes_omitir(v, (public.pes_actual(v) -> 'apartado' ->> 'id')::uuid, 'de750000-0000-4000-8000-00000000c003');
  j := public.pes_piloto_detalle(v);
  if jsonb_array_length(j -> 'respuestas') <> 3 or j -> 'respuestas' -> 0 ->> 'estado' <> 'correct' or j -> 'respuestas' -> 1 ->> 'codigo' <> 'wrong'
     or not (j -> 'respuestas' -> 1 ->> 'adelantado')::boolean or (j -> 'respuestas' -> 0 ->> 'adelantado')::boolean then raise exception 'FALLO: detalle del simulador %', j; end if;
  -- calibración: tiempos medidos en papel; el informe da también el del simulador si no se adelantó
  perform public.pes_calibrar((select val from sg_t where k = 'a1'), 50, 'papel', 'Ana');
  perform public.pes_calibrar((select val from sg_t where k = 'a1'), 70, 'papel', 'Luis');
  perform public.pes_calibrar((select val from sg_t where k = 'a1'), 90, 'papel', null);
  begin perform public.pes_calibrar((select val from sg_t where k = 'a1'), 0, 'papel', null); raise exception 'FALLO: calibración de 0 s'; exception when invalid_parameter_value then null; end;
  j := public.pes_informe_tiempos(v);
  if jsonb_array_length(j -> 'apartados') <> 6 or jsonb_array_length(j -> 'apartados' -> 0 -> 'calibraciones') <> 3
     or (j -> 'apartados' -> 0 ->> 't_min_s')::numeric <> 72 or (j -> 'apartados' -> 0 ->> 'piloto_s')::numeric < 99
     or j -> 'apartados' -> 1 -> 'piloto_s' <> 'null'::jsonb then raise exception 'FALLO: informe de tiempos %', j; end if;
  if public.pes_aplicar_calibracion(v) <> 1 then raise exception 'FALLO: aplicar calibración'; end if;
  -- reiniciar el simulador borra SUS respuestas
  j := public.pes_piloto_reiniciar(v);
  if j ->> 'estado' <> 'no_iniciada' or (j ->> 'cerrados')::integer <> 0 then raise exception 'FALLO: reiniciar %', j; end if;
end $$;
reset role;
do $$ begin
  if (select t_ref_s from public.pes_apartados where id = (select val from sg_t where k = 'a1')) <> 70 then raise exception 'FALLO: T_ref = mediana (70)'; end if;
  if exists (select 1 from public.pes_respuestas where user_id = 'de750000-0000-4000-8000-000000000001') then raise exception 'FALLO: respuestas del simulador tras reiniciar'; end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2) Publicar: la política queda congelada; los estudiantes trabajan; el simulador no cuenta en nada
-- ---------------------------------------------------------------------------------------------------------------
set local role authenticated;
do $$ declare v uuid := (select val from sg_t where k = 'p'); j jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000001', true);
  j := public.pes_publicar(v);
  if (j ->> 'asignados')::integer <> 2 then raise exception 'FALLO: el simulador cuenta como asignado %', j; end if;
  begin perform public.pes_politica_control(v, '{"modo":"informativo","peso":0,"descripcion":"Cambio la política después de publicar."}'); raise exception 'FALLO: política editable tras publicar';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.pes_aplicar_calibracion(v); raise exception 'FALLO: T_ref cambiado tras publicar'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.pes_iniciar(v);                                                -- el simulador sigue funcionando
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000011', true);
  j := public.pes_mis_practicas();
  if j -> 0 -> 'control_politica' ->> 'descripcion' not like 'Se hará un control presencial%' then raise exception 'FALLO: política no comunicada %', j; end if;
  perform public.pes_iniciar(v);
  perform public.pes_evento_cliente(v, 'pegado_bloqueado');
  perform public.pes_evento_cliente(v, 'reconexion');
  insert into sg_t values ('e1a', (public.pes_actual(v) -> 'apartado' ->> 'id')::uuid);
end $$;
reset role;
set local role service_role;
-- E1: A anticipada a los 0 s (breve), B a tiempo
select public.svc_pes_confirmar('de750000-0000-4000-8000-000000000011', (select val from sg_t where k = 'p'), (select val from sg_t where k = 'e1a'),
  '{"text":"1 m"}', '{"status":"correct","credit":1}', true, 'de750000-0000-4000-8000-00000000c011');
reset role;
update public.pes_estado set revelado_at = now() - interval '200 seconds' where user_id = 'de750000-0000-4000-8000-000000000011';
set local role service_role;
select public.svc_pes_confirmar('de750000-0000-4000-8000-000000000011', (select val from sg_t where k = 'p'),
  (select apartado_id from public.pes_estado where user_id = 'de750000-0000-4000-8000-000000000011'), '{"text":"2 m"}', '{"status":"correct","credit":1}', false, 'de750000-0000-4000-8000-00000000c012');
reset role;

set local role authenticated;
do $$ declare v uuid := (select val from sg_t where k = 'p'); j jsonb; m jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000001', true);
  j := public.pes_monitor(v);
  if jsonb_array_length(j -> 'estudiantes') <> 2 then raise exception 'FALLO: monitor con el simulador %', j -> 'estudiantes'; end if;
  select x into m from jsonb_array_elements(j -> 'estudiantes') x where x ->> 'user_id' = 'de750000-0000-4000-8000-000000000011';
  if (m ->> 'cerrados')::integer <> 2 or (m ->> 'anticipados')::integer <> 1 or (m ->> 'breves')::integer <> 1 or (m ->> 'pegados_bloqueados')::integer <> 1
     or (m ->> 'reconexiones')::integer <> 1 or m -> 'actual' ->> 'letra' <> 'C' or (m -> 'actual' ->> 'ejercicio')::integer <> 1 or (m ->> 'ejercicios_completos')::integer <> 0
     or m ->> 'ultima_actividad' is null or (m -> 'puntaje' -> 'provisional' ->> 'P')::numeric <= 0 then raise exception 'FALLO: fila del monitor %', m; end if;
  select x into m from jsonb_array_elements(j -> 'estudiantes') x where x ->> 'user_id' = 'de750000-0000-4000-8000-000000000012';
  if m ->> 'estado' <> 'no_iniciada' or (m ->> 'cerrados')::integer <> 0 then raise exception 'FALLO: E2 sin empezar %', m; end if;
  if jsonb_array_length(public.pes_detalle_docente(v) -> 'asignaciones') <> 2 then raise exception 'FALLO: detalle con el simulador'; end if;
  if (public.pes_lista_docente('de750000-0000-4000-8000-000000000031') -> 0 ->> 'asignados')::integer <> 2 then raise exception 'FALLO: lista con el simulador'; end if;
  -- historial
  j := public.pes_historial(v, 'de750000-0000-4000-8000-000000000011');
  if jsonb_array_length(j -> 'respuestas') <> 2 or j -> 'respuestas' -> 0 ->> 'accion' <> 'anticipada'
     or not exists (select 1 from jsonb_array_elements(j -> 'eventos') ev where ev ->> 'tipo' = 'pegado_bloqueado') then raise exception 'FALLO: historial %', j; end if;
  begin perform public.pes_historial(v, 'de750000-0000-4000-8000-000000000002'); raise exception 'FALLO: historial de quien no está asignado';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- 3) Control presencial: preparar (ejercicio realizado), propuesta equivalente, resultado y efecto anunciado
-- ---------------------------------------------------------------------------------------------------------------
insert into sg_t select 'ej' || posicion, id from public.pes_ejercicios where practica_id = (select val from sg_t where k = 'p');
set local role authenticated;
do $$ declare v uuid := (select val from sg_t where k = 'p'); j jsonb; e1 uuid; e2 uuid; c1 uuid; c2 uuid; s jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000001', true);
  e1 := (select val from sg_t where k = 'ej1');
  e2 := (select val from sg_t where k = 'ej2');
  begin perform public.pes_control_preparar(v, 'de750000-0000-4000-8000-000000000011', e2); raise exception 'FALLO: control de un ejercicio no realizado';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.pes_control_preparar(v, 'de750000-0000-4000-8000-000000000001', e1); raise exception 'FALLO: control al simulador';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  j := public.pes_control_preparar(v, 'de750000-0000-4000-8000-000000000011', e1);
  c1 := (j ->> 'id')::uuid;
  if jsonb_array_length(j -> 'propuesta' -> 'apartados') <> 3 or j -> 'propuesta' -> 'apartados' -> 0 -> 'respuesta' ->> 'text' <> '1 m'
     or not (j -> 'propuesta' -> 'apartados' -> 1 ->> 'variante')::boolean or j ->> 'semilla' is null then raise exception 'FALLO: propuesta %', j; end if;
  -- candidatos: misma lección y formato, fuera de la práctica (e7, e8), con su clave para el profesor
  if (select count(*) from jsonb_array_elements(j -> 'propuesta' -> 'candidatos')) <> 2
     or exists (select 1 from jsonb_array_elements(j -> 'propuesta' -> 'candidatos') x where (x ->> 'exercise_id')::uuid not in
       ('de750000-0000-4000-8000-0000000000e7', 'de750000-0000-4000-8000-0000000000e8') or x -> 'clave' ->> 'value' is null) then raise exception 'FALLO: candidatos %', j -> 'propuesta' -> 'candidatos'; end if;
  begin perform public.pes_control_registrar(c1, 0.5, ''); raise exception 'FALLO: resultado sin nota'; exception when invalid_parameter_value then null; end;
  begin perform public.pes_control_registrar(c1, 1.5, 'x'); raise exception 'FALLO: resultado > 1'; exception when invalid_parameter_value then null; end;
  s := public.pes_control_registrar(c1, 0.5, 'Explicó el planteamiento; se equivocó en la unidad.');
  if abs((s -> 'control' ->> 'factor')::numeric - 0.9) > 1e-9 or abs((s -> 'control' ->> 'validada_con_control')::numeric - (s -> 'validada' ->> 'P')::numeric * 0.9) > 1e-6
    then raise exception 'FALLO: factor del control (1 − 0,2·0,5 = 0,9) %', s -> 'control'; end if;
  begin perform public.pes_control_registrar(c1, 1, 'otra vez'); raise exception 'FALLO: registrar dos veces'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  -- un segundo control mejor: cuenta el más favorable
  c2 := (public.pes_control_preparar(v, 'de750000-0000-4000-8000-000000000011', e1) ->> 'id')::uuid;
  s := public.pes_control_registrar(c2, 1, 'Lo resolvió completo con otros números.');
  if (s -> 'control' ->> 'factor')::numeric <> 1 or (s -> 'control' ->> 'realizados')::integer <> 2 then raise exception 'FALLO: el más favorable %', s -> 'control'; end if;
  -- anulado: deja de contar y conserva su resultado
  begin perform public.pes_control_anular(c2, ''); raise exception 'FALLO: anular sin motivo'; exception when invalid_parameter_value then null; end;
  perform public.pes_control_anular(c2, 'Se aplicó al estudiante equivocado');
  insert into sg_t values ('c2', c2);
  if (public.pes_historial(v, 'de750000-0000-4000-8000-000000000011') -> 'puntaje' -> 'control' ->> 'factor')::numeric <> 0.9 then raise exception 'FALLO: anulado sigue contando'; end if;
  if jsonb_array_length(public.pes_controles_lista(v)) <> 2 then raise exception 'FALLO: lista de controles'; end if;
  -- el estudiante no gestiona controles
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000011', true);
  begin perform public.pes_control_preparar(v, 'de750000-0000-4000-8000-000000000011', e1); raise exception 'FALLO: estudiante prepara control'; exception when insufficient_privilege then null; end;
  begin perform public.pes_controles_lista(v); raise exception 'FALLO: estudiante ve controles'; exception when insufficient_privilege then null; end;
  if public.pes_mis_practicas()::text like '%Explicó el planteamiento%' then raise exception 'FALLO: la nota del control llega al estudiante'; end if;
  -- con resultados publicados ve su resultado y el factor, nunca la propuesta ni las claves
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000001', true);
  perform public.pes_publicar_resultados(v, true);
  perform set_config('request.jwt.claim.sub', 'de750000-0000-4000-8000-000000000011', true);
  j := public.pes_mis_practicas() -> 0 -> 'resultado' -> 'control';
  if (j ->> 'C')::numeric <> 0.5 or (j ->> 'factor')::numeric <> 0.9 then raise exception 'FALLO: control publicado %', j; end if;
  if public.pes_mis_practicas()::text like '%"clave"%' or public.pes_mis_practicas()::text like '%candidatos%' then raise exception 'FALLO: fuga del control'; end if;
end $$;
reset role;
do $$ begin
  if (select resultado from public.pes_controles where id = (select val from sg_t where k = 'c2')) <> 1 then raise exception 'FALLO: el anulado perdió su resultado'; end if;
  if exists (select 1 from public.attempts where user_id::text like 'de750000-%') then raise exception 'FALLO: intentos ordinarios'; end if;
  begin delete from public.pes_respuestas where user_id = 'de750000-0000-4000-8000-000000000011'; raise exception 'FALLO: respuestas reales borrables';
  exception when insufficient_privilege then null; end;
end $$;

select 'pes_seguimiento.sql: PRUEBAS PASARON' as resultado;
rollback;
