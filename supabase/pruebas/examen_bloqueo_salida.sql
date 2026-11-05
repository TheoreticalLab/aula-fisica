-- Pruebas: quiz y exámenes con bloqueo al salir e impedir copiar (migración 85). Datos sintéticos; se deshace al final.
-- T = profesor · T2 = profesor ajeno · E1, E2 = estudiantes
-- q1: quiz «una pregunta a la vez» protegido · q2: examen clásico protegido · q3: examen sin protecciones · p1: práctica
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('eb850000-0000-4000-8000-000000000001', 'bs01@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-salida","aula_role":"teacher"}', '{}', now(), now()),
  ('eb850000-0000-4000-8000-000000000002', 'bs02@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-salida-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('eb850000-0000-4000-8000-000000000011', 'bs11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-salida-1"}', '{}', now(), now()),
  ('eb850000-0000-4000-8000-000000000012', 'bs12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-salida-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'eb850000-%';
update public.profiles set role = 'teacher' where id in ('eb850000-0000-4000-8000-000000000001', 'eb850000-0000-4000-8000-000000000002');
update public.profiles set full_name = 'Ana Salida' where id = 'eb850000-0000-4000-8000-000000000011';
insert into public.courses (id, title) values ('eb850000-0000-4000-8000-000000000021', 'Curso salida');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options, points)
  select ('eb850000-0000-4000-8000-0000000000e' || k)::uuid, 'eb850000-0000-4000-8000-000000000021', 'salida-e' || k, 'seleccion', 'basico', 'bank', 'choice', 'Pregunta ' || k, '["a","b","c"]', 1
  from generate_series(1, 3) k;
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('eb850000-0000-4000-8000-000000000031', 'eb850000-0000-4000-8000-000000000021', 'Sección salida', 'SALIDA01', 'eb850000-0000-4000-8000-000000000001');
insert into public.enrollments (class_id, user_id) values
  ('eb850000-0000-4000-8000-000000000031', 'eb850000-0000-4000-8000-000000000011'),
  ('eb850000-0000-4000-8000-000000000031', 'eb850000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, created_by) values
  ('eb850000-0000-4000-8000-0000000000a1', 'eb850000-0000-4000-8000-000000000031', 'Quiz protegido', 'exam', true, 'after_submit', false, 'eb850000-0000-4000-8000-000000000001'),
  ('eb850000-0000-4000-8000-0000000000a2', 'eb850000-0000-4000-8000-000000000031', 'Examen clásico protegido', 'exam', true, 'after_submit', false, 'eb850000-0000-4000-8000-000000000001'),
  ('eb850000-0000-4000-8000-0000000000a3', 'eb850000-0000-4000-8000-000000000031', 'Examen sin protecciones', 'exam', true, 'after_submit', false, 'eb850000-0000-4000-8000-000000000001'),
  ('eb850000-0000-4000-8000-0000000000a4', 'eb850000-0000-4000-8000-000000000031', 'Práctica', 'practice', true, 'immediate', true, 'eb850000-0000-4000-8000-000000000001');
insert into public.activity_items (activity_id, exercise_id, position)
  select ('eb850000-0000-4000-8000-0000000000a' || a)::uuid, ('eb850000-0000-4000-8000-0000000000e' || k)::uuid, k from generate_series(1, 4) a, generate_series(1, 3) k;

create function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p::text, true);
$$;
grant execute on function pg_temp.como(uuid) to authenticated;
create temp table t (k text primary key, v text);
grant all on t to authenticated;

-- 0) permisos: ayudantes no invocables, tabla no legible, anónimo fuera
do $$ begin
  if has_function_privilege('authenticated', 'public.exam_registrar(uuid, text, text)', 'execute') then raise exception 'FALLO: exam_registrar expuesto'; end if;
  if has_function_privilege('authenticated', 'public.exam_registrar_entrada(uuid)', 'execute') then raise exception 'FALLO: exam_registrar_entrada expuesto'; end if;
  if has_function_privilege('authenticated', 'public.exam_bloqueado(uuid)', 'execute') then raise exception 'FALLO: exam_bloqueado expuesto'; end if;
  if has_function_privilege('authenticated', 'public.exam_protegido(uuid)', 'execute') then raise exception 'FALLO: exam_protegido expuesto'; end if;
  if has_function_privilege('anon', 'public.exam_salida(uuid, text)', 'execute') then raise exception 'FALLO: anon'; end if;
  if has_table_privilege('authenticated', 'public.exam_integridad_eventos', 'select') then raise exception 'FALLO: eventos legibles'; end if;
  if has_column_privilege('authenticated', 'public.exam_settings', 'codigo_salida_hash', 'select') then raise exception 'FALLO: hash legible'; end if;
end $$;

-- 1) configuración del profesor: el código es obligatorio para bloquear, se valida y nunca se devuelve
set local role authenticated;
select pg_temp.como('eb850000-0000-4000-8000-000000000001');
do $$ declare r jsonb; begin
  begin perform public.exam_settings_save('eb850000-0000-4000-8000-0000000000a1', '{"presentacion":"una_a_la_vez","duracion_s":900,"integridad":{"bloquear_al_salir":true}}');
    raise exception 'FALLO: bloquear sin código';
  exception when invalid_parameter_value then null; end;
  begin perform public.exam_settings_save('eb850000-0000-4000-8000-0000000000a1', '{"presentacion":"una_a_la_vez","integridad":{"bloquear_al_salir":true,"codigo":"12"}}');
    raise exception 'FALLO: código de 2 caracteres';
  exception when invalid_parameter_value then null; end;
  r := public.exam_settings_save('eb850000-0000-4000-8000-0000000000a1',
    '{"presentacion":"una_a_la_vez","navegacion":"libre","duracion_s":900,"integridad":{"bloquear_al_salir":true,"impedir_copiar":true,"codigo":"Lab4821"}}');
  if not (r -> 'integridad' ->> 'bloquear_al_salir')::boolean or not (r -> 'integridad' ->> 'codigo_configurado')::boolean then raise exception 'FALLO: guardar %', r; end if;
  if r::text ~ '\$2[aby]\$' or r::text ilike '%lab4821%' then raise exception 'FALLO: el código o su hash salió en la respuesta'; end if;
  -- guardar sin «integridad» (la pantalla de siempre) conserva las protecciones
  r := public.exam_settings_save('eb850000-0000-4000-8000-0000000000a1', '{"presentacion":"una_a_la_vez","navegacion":"libre","duracion_s":900}');
  if not (r -> 'integridad' ->> 'bloquear_al_salir')::boolean or not (r -> 'integridad' ->> 'impedir_copiar')::boolean then raise exception 'FALLO: se perdieron las protecciones'; end if;
  -- código vacío = conserva el anterior
  perform public.exam_settings_save('eb850000-0000-4000-8000-0000000000a1', '{"presentacion":"una_a_la_vez","navegacion":"libre","duracion_s":900,"integridad":{"bloquear_al_salir":true,"impedir_copiar":true,"codigo":""}}');
  perform public.exam_settings_save('eb850000-0000-4000-8000-0000000000a2', '{"presentacion":"todas","integridad":{"bloquear_al_salir":true,"codigo":"clasico9"}}');
  perform public.exam_settings_save('eb850000-0000-4000-8000-0000000000a3', '{"presentacion":"una_a_la_vez","duracion_s":900}');
end $$;
select pg_temp.como('eb850000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.exam_settings_save('eb850000-0000-4000-8000-0000000000a1', '{"integridad":{"bloquear_al_salir":false}}'); raise exception 'FALLO: profesor ajeno desactivó';
  exception when insufficient_privilege then null; end;
  begin perform public.exam_integridad_resumen('eb850000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: profesor ajeno vio el resumen';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) E1 empieza el quiz: la primera entrada no bloquea; ve las reglas; guarda
select pg_temp.como('eb850000-0000-4000-8000-000000000011');
do $$ declare r jsonb; begin
  r := public.exam_rules('eb850000-0000-4000-8000-0000000000a1');
  if not (r -> 'integridad' ->> 'bloquear_al_salir')::boolean then raise exception 'FALLO: el estudiante no ve la regla antes de empezar'; end if;
end $$;
insert into t select 'q1', public.start_activity_attempt('eb850000-0000-4000-8000-0000000000a1')::text;
do $$ declare q uuid := (select v::uuid from t where k = 'q1'); r jsonb; begin
  r := public.exam_open(q);
  r := public.exam_integridad(q);
  if not (r ->> 'bloquear_al_salir')::boolean or not (r ->> 'impedir_copiar')::boolean or (r ->> 'bloqueado')::boolean then raise exception 'FALLO: integridad inicial %', r; end if;
  perform public.exam_save(q, 'eb850000-0000-4000-8000-0000000000e1', '{"selected":[1]}', 1);
end $$;

-- 3) sale (pestaña oculta): pantalla bloqueada; el servidor no guarda ni abre preguntas
do $$ declare q uuid := (select v::uuid from t where k = 'q1'); r jsonb; begin
  r := public.exam_salida(q, 'oculta');
  if not (r ->> 'bloqueado')::boolean then raise exception 'FALLO: no bloqueó al salir'; end if;
  r := public.my_screen_lock();
  if r is null or r ->> 'body' not like 'Saliste de «Quiz protegido»%' then raise exception 'FALLO: aviso de bloqueo %', r; end if;
  insert into t values ('lock1', r ->> 'id');
  begin perform public.exam_save(q, 'eb850000-0000-4000-8000-0000000000e1', '{"selected":[2]}', 2); raise exception 'FALLO: guardó bloqueado';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.save_response(q, 'eb850000-0000-4000-8000-0000000000e1', '{"selected":[2]}'); raise exception 'FALLO: save_response bloqueado';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.exam_goto(q, 'eb850000-0000-4000-8000-0000000000e2'); raise exception 'FALLO: abrió otra pregunta bloqueado';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  -- otra salida con el bloqueo activo: se anota, no se crea otro bloqueo
  perform public.exam_salida(q, 'sin_foco');
  begin perform public.exam_salida(q, 'teletransporte'); raise exception 'FALLO: motivo inventado';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.screen_locks where user_id = 'eb850000-0000-4000-8000-000000000011' and unlocked_at is null) <> 1 then raise exception 'FALLO: más de un bloqueo activo'; end if;
  if (select count(*) from public.exam_integridad_eventos where attempt_id = (select v::uuid from t where k = 'q1') and tipo = 'salida') <> 2 then raise exception 'FALLO: salidas anotadas'; end if;
  if (select sender_id from public.screen_locks where id = (select v::uuid from t where k = 'lock1')) <> 'eb850000-0000-4000-8000-000000000001' then raise exception 'FALLO: remitente'; end if;
end $$;

-- 4) desbloqueo solo con el código de la evaluación (sin distinguir mayúsculas ni espacios); después puede seguir
set local role authenticated;
select pg_temp.como('eb850000-0000-4000-8000-000000000011');
do $$ declare q uuid := (select v::uuid from t where k = 'q1'); l uuid := (select v::uuid from t where k = 'lock1'); r jsonb; begin
  r := public.unlock_screen(l, '0000');
  if (r ->> 'ok')::boolean then raise exception 'FALLO: desbloqueó con un código falso'; end if;
  r := public.unlock_screen(l, '  LAB4821 ');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: no desbloqueó con el código %', r; end if;
  perform public.exam_save(q, 'eb850000-0000-4000-8000-0000000000e1', '{"selected":[2]}', 3);
  perform public.exam_goto(q, 'eb850000-0000-4000-8000-0000000000e2');
end $$;

-- 5) reabrir el quiz (recargar u otro dispositivo) es un reingreso: vuelve a bloquear, aunque el navegador no avise
do $$ declare q uuid := (select v::uuid from t where k = 'q1'); r jsonb; begin
  perform public.exam_open(q);
  r := public.exam_integridad(q);
  if not (r ->> 'bloqueado')::boolean then raise exception 'FALLO: reabrir no bloqueó'; end if;
  -- reabrir otra vez con el bloqueo activo no apila bloqueos
  perform public.exam_open(q);
end $$;

-- 6) E2 no puede avisar salidas ni ver la integridad de E1
select pg_temp.como('eb850000-0000-4000-8000-000000000012');
do $$ declare q uuid := (select v::uuid from t where k = 'q1'); begin
  begin perform public.exam_salida(q, 'oculta'); raise exception 'FALLO: E2 hizo salir a E1';
  exception when insufficient_privilege then null; end;
  begin perform public.exam_integridad(q); raise exception 'FALLO: E2 leyó la integridad de E1';
  exception when insufficient_privilege then null; end;
  begin perform public.exam_evento_copia(q, 'pegado'); raise exception 'FALLO: E2 anotó un pegado a E1';
  exception when insufficient_privilege then null; end;
  begin perform public.exam_integridad_resumen('eb850000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: un estudiante vio el resumen';
  exception when insufficient_privilege then null; end;
end $$;
-- E2 en el examen SIN protecciones: salir no bloquea
do $$ declare q uuid; r jsonb; begin
  q := public.start_activity_attempt('eb850000-0000-4000-8000-0000000000a3');
  perform public.exam_open(q);
  r := public.exam_salida(q, 'oculta');
  if (r ->> 'bloqueado')::boolean or public.my_screen_lock() is not null then raise exception 'FALLO: bloqueó un examen sin la opción'; end if;
  r := public.exam_integridad(q);
  if (r ->> 'bloquear_al_salir')::boolean or (r ->> 'impedir_copiar')::boolean then raise exception 'FALLO: protecciones fantasma'; end if;
  perform public.exam_open(q);                        -- reabrir tampoco bloquea
  perform public.exam_save(q, 'eb850000-0000-4000-8000-0000000000e1', '{"selected":[0]}', 1);
end $$;

-- 7) E1: con la pantalla bloqueada, las PRÁCTICAS siguen funcionando (solo se protegen las evaluaciones)
select pg_temp.como('eb850000-0000-4000-8000-000000000011');
do $$ declare p uuid; begin
  p := public.start_activity_attempt('eb850000-0000-4000-8000-0000000000a4');
  perform public.save_response(p, 'eb850000-0000-4000-8000-0000000000e1', '{"selected":[0]}');
end $$;
-- copiar / pegar: se anotan; tipo inventado rechazado
do $$ declare q uuid := (select v::uuid from t where k = 'q1'); begin
  perform public.exam_evento_copia(q, 'pegado');
  perform public.exam_evento_copia(q, 'pegado');
  perform public.exam_evento_copia(q, 'copia');
  begin perform public.exam_evento_copia(q, 'teclear'); raise exception 'FALLO: tipo inventado';
  exception when invalid_parameter_value then null; end;
end $$;

-- 8) examen clásico (todas las preguntas en una página): la entrada la registra exam_entrada
do $$ declare q uuid; r jsonb; begin
  -- primero se libera a E1 (lo hará el profesor más abajo; aquí, con el código del quiz)
  perform public.unlock_screen((public.my_screen_lock() ->> 'id')::uuid, 'lab4821');
  q := public.start_activity_attempt('eb850000-0000-4000-8000-0000000000a2');
  insert into t values ('q2', q::text);
  if public.exam_open(q) ->> 'modo' <> 'clasico' then raise exception 'FALLO: debía ser clásico'; end if;
  r := public.exam_entrada(q);
  if (r ->> 'bloqueado')::boolean then raise exception 'FALLO: la primera entrada bloqueó'; end if;
  perform public.save_response(q, 'eb850000-0000-4000-8000-0000000000e1', '{"selected":[1]}');
  r := public.exam_entrada(q);
  if not (r ->> 'bloqueado')::boolean then raise exception 'FALLO: reabrir el clásico no bloqueó'; end if;
  -- el código del quiz NO sirve: cada evaluación tiene el suyo
  if (public.unlock_screen((public.my_screen_lock() ->> 'id')::uuid, 'lab4821') ->> 'ok')::boolean then raise exception 'FALLO: sirvió el código de otra evaluación'; end if;
end $$;

-- 9) profesor: resumen con salidas, reingresos y pegados; libera con el botón de siempre; el estudiante sigue
select pg_temp.como('eb850000-0000-4000-8000-000000000001');
do $$ declare r jsonb; e jsonb; begin
  r := public.exam_integridad_resumen('eb850000-0000-4000-8000-0000000000a1');
  select x into e from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'nombre' = 'Ana Salida';
  if (e ->> 'salidas')::int <> 2 or (e ->> 'reingresos')::int <> 1 or (e ->> 'pegados')::int <> 2 or (e ->> 'copias')::int <> 1 then raise exception 'FALLO: resumen %', e; end if;
  if e ->> 'lock_id' is null then raise exception 'FALLO: el resumen no muestra el bloqueo activo'; end if;
  if r::text ~ '\$2[aby]\$' then raise exception 'FALLO: hash en el resumen'; end if;
  perform public.release_screen_lock((e ->> 'lock_id')::uuid);
end $$;
select pg_temp.como('eb850000-0000-4000-8000-000000000011');
do $$ begin
  perform public.save_response((select v::uuid from t where k = 'q2'), 'eb850000-0000-4000-8000-0000000000e2', '{"selected":[0]}');
end $$;

-- 10) terminado el tiempo oficial, salir ya no bloquea (no hay nada que proteger) y se puede entregar lo guardado
reset role;
update public.attempts set started_at = now() - interval '2 hours' where id = (select v::uuid from t where k = 'q1');
set local role authenticated;
select pg_temp.como('eb850000-0000-4000-8000-000000000011');
do $$ declare q uuid := (select v::uuid from t where k = 'q1'); r jsonb; begin
  r := public.exam_salida(q, 'cierre');
  if (r ->> 'bloqueado')::boolean or public.my_screen_lock() is not null then raise exception 'FALLO: bloqueó con el tiempo vencido'; end if;
  if (public.exam_integridad(q) ->> 'bloquear_al_salir')::boolean then raise exception 'FALLO: sigue protegido vencido'; end if;
end $$;
reset role;

select 'examen_bloqueo_salida.sql: PRUEBAS PASARON' as resultado;
rollback;
