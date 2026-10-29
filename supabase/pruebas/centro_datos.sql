-- Pruebas: Centro de Datos (migración 34). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d9500000-0000-4000-8000-000000000001', 'xa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-datos","aula_role":"admin"}', '{}', now(), now()),
  ('d9500000-0000-4000-8000-000000000002', 'xp@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-datos","aula_role":"teacher"}', '{}', now(), now()),
  ('d9500000-0000-4000-8000-000000000003', 'xq@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ajeno-datos","aula_role":"teacher"}', '{}', now(), now()),
  ('d9500000-0000-4000-8000-000000000011', 'x1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-datos-1"}', '{}', now(), now()),
  ('d9500000-0000-4000-8000-000000000012', 'x2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-datos-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'd9500000-%';
update public.profiles set role = 'admin' where id = 'd9500000-0000-4000-8000-000000000001';
update public.profiles set role = 'teacher' where id in ('d9500000-0000-4000-8000-000000000002', 'd9500000-0000-4000-8000-000000000003');
update public.profiles set full_name = 'Nombre Secreto Uno', student_code = 'MAT-0001', password_fingerprint = 'huella-de-prueba' where id = 'd9500000-0000-4000-8000-000000000011';
update public.profiles set full_name = 'Nombre Secreto Dos' where id = 'd9500000-0000-4000-8000-000000000012';
insert into public.courses (id, title) values ('d9500000-0000-4000-8000-000000000021', 'Curso datos');
insert into public.units (id, course_id, slug, title) values ('d9500000-0000-4000-8000-000000000031', 'd9500000-0000-4000-8000-000000000021', 'u-datos', 'Unidad');
insert into public.lessons (id, unit_id, course_id, slug, title, theory) values
  ('d9500000-0000-4000-8000-000000000041', 'd9500000-0000-4000-8000-000000000031', 'd9500000-0000-4000-8000-000000000021', 'l-datos', 'Lección', 'TEORIA-LARGA');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options) values
  ('d9500000-0000-4000-8000-0000000000e1', 'd9500000-0000-4000-8000-000000000021', 'dat-e1', 'seleccion', 'basico', 'bank', 'choice', '¿Pregunta 1?', '["a","b"]'),
  ('d9500000-0000-4000-8000-0000000000e2', 'd9500000-0000-4000-8000-000000000021', 'dat-e2', 'numerica', 'basico', 'bank', 'numeric', '¿Pregunta 2?', null);
insert into public.exercise_keys (exercise_id, answer) values ('d9500000-0000-4000-8000-0000000000e1', '{"format":"choice","correct":[0]}') on conflict do nothing;
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d9500000-0000-4000-8000-000000000051', 'd9500000-0000-4000-8000-000000000021', 'Sección datos', 'DATOS001', 'd9500000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values ('d9500000-0000-4000-8000-000000000051', 'd9500000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('d9500000-0000-4000-8000-000000000051', 'd9500000-0000-4000-8000-000000000011'),
  ('d9500000-0000-4000-8000-000000000051', 'd9500000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, reveal_policy, hints_enabled, published) values
  ('d9500000-0000-4000-8000-000000000061', 'd9500000-0000-4000-8000-000000000051', 'Parcial datos', 'exam', 'after_submit', false, true);
insert into public.activity_items (activity_id, exercise_id, position) values
  ('d9500000-0000-4000-8000-000000000061', 'd9500000-0000-4000-8000-0000000000e1', 1), ('d9500000-0000-4000-8000-000000000061', 'd9500000-0000-4000-8000-0000000000e2', 2);
-- estudiante 1: dos intentos; estudiante 2: uno
insert into public.attempts (id, user_id, course_id, activity_id, mode, status, attempt_number, started_at, submitted_at, score, max_score) values
  ('d9500000-0000-4000-8000-0000000000a1', 'd9500000-0000-4000-8000-000000000011', 'd9500000-0000-4000-8000-000000000021', 'd9500000-0000-4000-8000-000000000061', 'exam', 'submitted', 1, now() - interval '3 hours', now() - interval '2 hours 50 minutes', 1, 2),
  ('d9500000-0000-4000-8000-0000000000a2', 'd9500000-0000-4000-8000-000000000011', 'd9500000-0000-4000-8000-000000000021', 'd9500000-0000-4000-8000-000000000061', 'exam', 'submitted', 2, now() - interval '2 hours', now() - interval '1 hour 50 minutes', 2, 2),
  ('d9500000-0000-4000-8000-0000000000a3', 'd9500000-0000-4000-8000-000000000012', 'd9500000-0000-4000-8000-000000000021', 'd9500000-0000-4000-8000-000000000061', 'exam', 'submitted', 1, now() - interval '3 hours', now() - interval '2 hours 40 minutes', 0, 2);
insert into public.responses (id, attempt_id, exercise_id, user_id, answer, status) values
  ('d9500000-0000-4000-8000-0000000000b1', 'd9500000-0000-4000-8000-0000000000a1', 'd9500000-0000-4000-8000-0000000000e1', 'd9500000-0000-4000-8000-000000000011', '{"selected":[0]}', 'correct'),
  ('d9500000-0000-4000-8000-0000000000b2', 'd9500000-0000-4000-8000-0000000000a3', 'd9500000-0000-4000-8000-0000000000e2', 'd9500000-0000-4000-8000-000000000012', '{"text":"=1+1"}', 'incorrect');
insert into public.response_events (response_id, user_id, kind, answer, result, created_at) values
  ('d9500000-0000-4000-8000-0000000000b1', 'd9500000-0000-4000-8000-000000000011', 'check', '{"selected":[0]}', '{"status":"correct"}', now() - interval '2 hours 55 minutes');
-- 7 eventos del primer intento, uno tardío (seq 6 llega después de seq 7) y con microsegundos
insert into public.telemetry_events (attempt_id, user_id, session_id, seq, kind, exercise_id, t_ms, received_at, data)
select 'd9500000-0000-4000-8000-0000000000a1', 'd9500000-0000-4000-8000-000000000011', 'd9500000-0000-4000-8000-0000000000f1', s, k, null, s * 1000,
       '2026-10-20 14:00:00+00'::timestamptz + make_interval(secs => r) + interval '0.123456 seconds', '{}'::jsonb
from (values (1, 'sesion_inicio', 1), (2, 'pregunta_vista', 2), (3, 'primera_interaccion', 3), (4, 'respuesta_cambio', 4), (5, 'respuesta_cambio', 5), (7, 'envio', 7), (6, 'respuesta_cambio', 90)) v(s, k, r);
insert into public.study_visits (id, user_id, session_id, course_id, lesson_id, section, started_at, last_beat_at, effective_seconds) values
  (gen_random_uuid(), 'd9500000-0000-4000-8000-000000000011', gen_random_uuid(), 'd9500000-0000-4000-8000-000000000021', 'd9500000-0000-4000-8000-000000000041', 'teoria', now() - interval '1 day', now() - interval '1 day', 120);
insert into public.screen_locks (user_id, sender_id, body, code_hash) values ('d9500000-0000-4000-8000-000000000011', 'd9500000-0000-4000-8000-000000000002', 'bloqueo', 'HASH-SECRETO');
insert into public.attendance_sessions (id, class_id, code, opened_by, code_expires_at, secret) values
  ('d9500000-0000-4000-8000-0000000000c1', 'd9500000-0000-4000-8000-000000000051', '123456', 'd9500000-0000-4000-8000-000000000002', now() + interval '5 minutes', 'SECRETO-ASIS');
select set_config('prueba.antes', (select (count(*) filter (where true))::text from public.telemetry_events) || '/' || (select count(*) from public.attempts)::text || '/' || (select count(*) from public.responses)::text, true);

set local role authenticated;

-- 1) un estudiante no exporta nada; un profesor ajeno no exporta a estudiantes ni actividades que no imparte
select set_config('request.jwt.claims', '{"sub":"d9500000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9500000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.export_preview('{"tipo":"todo"}'); raise exception 'FALLO: un estudiante previsualizó'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.data_exports; raise exception 'FALLO: leyó el registro de exportaciones'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"d9500000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9500000-0000-4000-8000-000000000003', true);
do $$ begin
  begin perform public.export_begin('{"tipo":"estudiante","ids":["d9500000-0000-4000-8000-000000000011"]}', 'identificado', array['telemetria'], array['csv']);
    raise exception 'FALLO: un profesor ajeno exportó a un estudiante'; exception when insufficient_privilege then null; end;
  begin perform public.export_begin('{"tipo":"actividad","ids":["d9500000-0000-4000-8000-000000000061"]}', 'identificado', array['telemetria'], array['csv']);
    raise exception 'FALLO: un profesor ajeno exportó una actividad'; exception when insufficient_privilege then null; end;
  if (public.export_preview('{"tipo":"todo"}') ->> 'estudiantes')::int <> 0 then raise exception 'FALLO: «todo» de un profesor ajeno incluye a estos estudiantes'; end if;
end $$;

-- 2) el profesor exporta a su estudiante 1 (todos sus datos): dos intentos, todos los eventos, columnas sensibles fuera
select set_config('request.jwt.claims', '{"sub":"d9500000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9500000-0000-4000-8000-000000000002', true);
do $$
declare b jsonb; p jsonb; cursor_ text := null; ids bigint[] := '{}'; n int := 0; f jsonb;
begin
  begin perform public.export_begin('{"tipo":"estudiante","ids":["d9500000-0000-4000-8000-000000000011"]}', 'identificado', array['telemetria'], array['csv'], true);
    raise exception 'FALLO: un profesor (no administrador) pidió las claves'; exception when insufficient_privilege then null; end;
  b := public.export_begin('{"tipo":"estudiante","ids":["d9500000-0000-4000-8000-000000000011"]}', 'identificado',
         array['respuestas', 'telemetria', 'estudio', 'asistencia', 'calificaciones', 'comunicacion', 'diseno'], array['csv', 'json']);
  perform set_config('prueba.e1', b ->> 'export_id', true);
  if (b -> 'conteos' ->> 'intentos')::int <> 2 or (b -> 'conteos' ->> 'telemetria')::int <> 7 or (b -> 'conteos' ->> 'respuestas')::int <> 1
     or (b -> 'conteos' ->> 'estudiantes')::int <> 1 or (b -> 'conteos' ->> 'visitas')::int <> 1 or b -> 'conteos' ? 'claves' then
    raise exception 'FALLO: recuentos %', b -> 'conteos'; end if;
  -- telemetría en páginas de 2: todas, sin duplicados, en orden de id y con la precisión original
  loop
    p := public.export_page((b ->> 'export_id')::uuid, 'telemetria', cursor_, 2);
    for f in select * from jsonb_array_elements(p -> 'filas') loop ids := ids || (f ->> 'id')::bigint; n := n + 1;
      if f ->> 'received_at' !~ '\.123456' then raise exception 'FALLO: perdió precisión %', f ->> 'received_at'; end if;
    end loop;
    exit when (p ->> 'fin')::boolean;
    cursor_ := p ->> 'siguiente';
  end loop;
  if n <> 7 or cardinality(array(select distinct unnest(ids))) <> 7 or ids <> array(select unnest(ids) order by 1) then raise exception 'FALLO: paginación % %', n, ids; end if;
  -- columnas que nunca salen
  f := public.export_page((b ->> 'export_id')::uuid, 'estudiantes', null, 10) -> 'filas' -> 0;
  if f ? 'password_fingerprint' or f ->> 'full_name' <> 'Nombre Secreto Uno' then raise exception 'FALLO: estudiante identificado %', f; end if;
  if (public.export_page((b ->> 'export_id')::uuid, 'secciones', null, 10) -> 'filas' -> 0) ? 'join_code' then raise exception 'FALLO: código de inscripción'; end if;
  if (public.export_page((b ->> 'export_id')::uuid, 'bloqueos', null, 10)::text) ~ 'HASH-SECRETO' then raise exception 'FALLO: hash del bloqueo'; end if;
  f := public.export_page((b ->> 'export_id')::uuid, 'asistencia_sesiones', null, 10) -> 'filas' -> 0;
  if f is null or f ? 'code' or f ? 'secret' or f ? 'geo_lat' or f::text ~ 'SECRETO-ASIS' then raise exception 'FALLO: código o secreto de asistencia %', f; end if;
  if (public.export_page((b ->> 'export_id')::uuid, 'lecciones', null, 10)::text) ~ 'TEORIA-LARGA' then raise exception 'FALLO: texto de la teoría'; end if;
  -- fuentes no pedidas o inexistentes: rechazadas (lista blanca)
  begin perform public.export_page((b ->> 'export_id')::uuid, 'claves', null, 10); raise exception 'FALLO: sirvió claves no pedidas'; exception when invalid_parameter_value then null; end;
  begin perform public.export_page((b ->> 'export_id')::uuid, 'auth.users', null, 10); raise exception 'FALLO: fuente arbitraria'; exception when invalid_parameter_value then null; end;
  begin perform public.export_page((b ->> 'export_id')::uuid, 'telemetria; drop table public.attempts', null, 10); raise exception 'FALLO: inyección'; exception when invalid_parameter_value then null; end;
end $$;

-- 3) otra persona no puede pedir páginas de esa exportación
select set_config('request.jwt.claims', '{"sub":"d9500000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9500000-0000-4000-8000-000000000003', true);
do $$ begin
  begin perform public.export_page(current_setting('prueba.e1')::uuid, 'telemetria', null, 10); raise exception 'FALLO: otra persona leyó la exportación';
  exception when insufficient_privilege then null; end;
end $$;

-- 4) instantánea: un evento que llega después del corte no entra; terminar la exportación cierra el acceso
reset role;
insert into public.telemetry_events (attempt_id, user_id, session_id, seq, kind, t_ms, received_at, data) values
  ('d9500000-0000-4000-8000-0000000000a1', 'd9500000-0000-4000-8000-000000000011', 'd9500000-0000-4000-8000-0000000000f1', 8, 'salida', 8000, now() + interval '1 second', '{}');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9500000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9500000-0000-4000-8000-000000000002', true);
do $$ begin
  if jsonb_array_length(public.export_page(current_setting('prueba.e1')::uuid, 'telemetria', null, 100) -> 'filas') <> 7 then raise exception 'FALLO: entró un evento posterior al corte'; end if;
  perform public.export_finish(current_setting('prueba.e1')::uuid, 'completada', '{"registros":{"telemetria":7}}', repeat('a', 64));
  begin perform public.export_page(current_setting('prueba.e1')::uuid, 'telemetria', null, 10); raise exception 'FALLO: siguió sirviendo tras terminar';
  exception when invalid_parameter_value then null; end;
  if (public.my_exports() -> 0 ->> 'estado') <> 'completada' then raise exception 'FALLO: historial'; end if;
end $$;

-- 5) actividad completa: todos los intentos de todos los estudiantes, y solo de esa actividad
do $$ declare b jsonb; begin
  b := public.export_begin('{"tipo":"actividad","ids":["d9500000-0000-4000-8000-000000000061"]}', 'identificado', array['respuestas'], array['excel']);
  if (b -> 'conteos' ->> 'intentos')::int <> 3 or (b -> 'conteos' ->> 'estudiantes')::int <> 2 or (b -> 'conteos' ->> 'actividad_items')::int <> 2 then
    raise exception 'FALLO: actividad %', b -> 'conteos'; end if;
  perform public.export_finish((b ->> 'export_id')::uuid, 'completada', '{}', null);
end $$;

-- 6) modo investigación: seudónimos estables y coherentes entre tablas, sin datos personales directos
do $$ declare b jsonb; b2 jsonb; est jsonb; ints jsonb; s1 text; begin
  b := public.export_begin('{"tipo":"grupo","ids":["d9500000-0000-4000-8000-000000000011","d9500000-0000-4000-8000-000000000012"]}', 'investigacion', array['respuestas'], array['csv']);
  est := public.export_page((b ->> 'export_id')::uuid, 'estudiantes', null, 10) -> 'filas';
  ints := public.export_page((b ->> 'export_id')::uuid, 'intentos', null, 10) -> 'filas';
  if est::text ~ '(Nombre Secreto|MAT-0001|d9500000-0000-4000-8000-00000000001|cuentas\.aula|sint-datos)' or ints::text ~ 'd9500000-0000-4000-8000-00000000001'
     or (b -> 'ids_publicos')::text ~ 'd9500000' then raise exception 'FALLO: datos personales en modo investigación % % %', est, ints, b -> 'ids_publicos'; end if;
  if exists (select 1 from jsonb_array_elements(est) e where e ->> 'id' !~ '^E-[0-9A-F]{12}$') then raise exception 'FALLO: formato del seudónimo %', est; end if;
  if exists (select 1 from jsonb_array_elements(ints) i where not exists (select 1 from jsonb_array_elements(est) e where e ->> 'id' = i ->> 'user_id')) then
    raise exception 'FALLO: los seudónimos no relacionan intentos con estudiantes'; end if;
  s1 := (select e ->> 'id' from jsonb_array_elements(est) e where e ->> 'id' = b -> 'ids_publicos' ->> 0);
  b2 := public.export_begin('{"tipo":"estudiante","ids":["d9500000-0000-4000-8000-000000000011"]}', 'investigacion', array['respuestas'], array['csv']);
  if (public.export_page((b2 ->> 'export_id')::uuid, 'estudiantes', null, 10) -> 'filas' -> 0 ->> 'id') is distinct from s1 then raise exception 'FALLO: seudónimo no estable entre exportaciones'; end if;
end $$;

-- 7) administrador: puede pedir las claves de respuesta
select set_config('request.jwt.claims', '{"sub":"d9500000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9500000-0000-4000-8000-000000000001', true);
do $$ declare b jsonb; begin
  b := public.export_begin('{"tipo":"curso","ids":["d9500000-0000-4000-8000-000000000021"]}', 'identificado', array['respuestas'], array['sqlite'], true);
  if (b -> 'conteos' ->> 'claves')::int <> 1 or jsonb_array_length(public.export_page((b ->> 'export_id')::uuid, 'claves', null, 10) -> 'filas') <> 1 then
    raise exception 'FALLO: claves para el administrador %', b -> 'conteos'; end if;
end $$;

-- 8) exportar no modifica ningún dato académico
reset role;
do $$ begin
  if current_setting('prueba.antes') <> ((select count(*) - 1 from public.telemetry_events)::text || '/' || (select count(*) from public.attempts)::text || '/' || (select count(*) from public.responses)::text) then
    raise exception 'FALLO: cambiaron los datos académicos (%)', current_setting('prueba.antes'); end if;
  if exists (select 1 from public.data_exports where alcance::text ~ 'Nombre Secreto') then raise exception 'FALLO: el registro guarda datos personales'; end if;
end $$;

select 'CENTRO DE DATOS: PRUEBAS PASARON' as resultado;
rollback;
