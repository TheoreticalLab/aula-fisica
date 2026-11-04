-- Pruebas: tiempo mínimo de realización en prácticas (migración 78). Se deshace al final.
-- Práctica A (60 min de tiempo activo), práctica B (sin mínimo), práctica C (60 min, ya cerrada), examen E.
-- Estudiantes S (en curso), S2 (empezó ANTES de activarse), S3 (entregada sin cumplir), X (otro estudiante).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de780000-0000-4000-8000-000000000001', 'tm1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-tminimo","aula_role":"teacher"}', '{}', now(), now()),
  ('de780000-0000-4000-8000-000000000011', 'tm11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tm-s"}', '{}', now(), now()),
  ('de780000-0000-4000-8000-000000000012', 'tm12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tm-s2"}', '{}', now(), now()),
  ('de780000-0000-4000-8000-000000000013', 'tm13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tm-s3"}', '{}', now(), now()),
  ('de780000-0000-4000-8000-000000000014', 'tm14@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-tm-x"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de780000-%';
update public.profiles set role = 'teacher' where id = 'de780000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de780000-0000-4000-8000-000000000021', 'Curso tiempo mínimo');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points)
  select ('de780000-0000-4000-8000-0000000000e' || g)::uuid, 'de780000-0000-4000-8000-000000000021', 'tm-' || g, 'numerica', 'intermedio', 'bank', 'numeric', 'P' || g, 1 from generate_series(1, 4) g;
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de780000-0000-4000-8000-000000000031', 'de780000-0000-4000-8000-000000000021', 'Sección tiempo', 'TMINIM01', 'de780000-0000-4000-8000-000000000001'),
  ('de780000-0000-4000-8000-000000000032', 'de780000-0000-4000-8000-000000000021', 'Sección tiempo 2', 'TMINIM02', 'de780000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('de780000-0000-4000-8000-000000000031', 'de780000-0000-4000-8000-000000000001'), ('de780000-0000-4000-8000-000000000032', 'de780000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'de780000-0000-4000-8000-000000000031', ('de780000-0000-4000-8000-00000000001' || g)::uuid from generate_series(1, 4) g;
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, closes_at) values
  ('de780000-0000-4000-8000-0000000000a1', 'de780000-0000-4000-8000-000000000031', 'Práctica A', 'practice', true, 'after_submit', false, now() + interval '7 days'),
  ('de780000-0000-4000-8000-0000000000a2', 'de780000-0000-4000-8000-000000000031', 'Práctica B', 'practice', true, 'after_submit', false, null),
  ('de780000-0000-4000-8000-0000000000a3', 'de780000-0000-4000-8000-000000000031', 'Práctica C', 'practice', true, 'after_submit', false, now() - interval '1 minute'),
  ('de780000-0000-4000-8000-0000000000a4', 'de780000-0000-4000-8000-000000000031', 'Examen E', 'exam', true, 'after_submit', false, null);
insert into public.activity_items (activity_id, exercise_id, position)
  select a.id, ('de780000-0000-4000-8000-0000000000e' || g)::uuid, g
  from (values ('de780000-0000-4000-8000-0000000000a1'::uuid), ('de780000-0000-4000-8000-0000000000a2'::uuid), ('de780000-0000-4000-8000-0000000000a3'::uuid)) a(id)
  cross join generate_series(1, 4) g;

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;

-- 0) S2 empezó ANTES de que se activara el mínimo (queda exento)
insert into public.attempts (id, user_id, course_id, activity_id, mode, started_at) values
  ('de780000-0000-4000-8000-0000000000b2', 'de780000-0000-4000-8000-000000000012', 'de780000-0000-4000-8000-000000000021', 'de780000-0000-4000-8000-0000000000a1', 'practice', now() - interval '1 hour');

-- 1) Configuración: solo el profesor de la sección y solo en prácticas
set local role authenticated;
select pg_temp.como('de780000-0000-4000-8000-000000000011');
do $$ begin
  begin perform public.practica_tiempo_guardar('de780000-0000-4000-8000-0000000000a1', 60); raise exception 'FALLO: el estudiante configuró'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.activity_min_time; raise exception 'FALLO: leyó la configuración por REST'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.attempt_active_time; raise exception 'FALLO: leyó tiempos por REST'; exception when insufficient_privilege then null; end;
  begin perform public.svc_tiempo_minimo_verificar('de780000-0000-4000-8000-000000000011', gen_random_uuid()); raise exception 'FALLO: llamó svc'; exception when insufficient_privilege then null; end;
  if (public.practica_tiempo_config('de780000-0000-4000-8000-0000000000a1') ->> 'activo')::boolean then raise exception 'FALLO: activo por defecto'; end if;
end $$;
select pg_temp.como('de780000-0000-4000-8000-000000000001');
do $$ declare r jsonb; begin
  begin perform public.practica_tiempo_guardar('de780000-0000-4000-8000-0000000000a4', 30); raise exception 'FALLO: mínimo en un examen';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.practica_tiempo_guardar('de780000-0000-4000-8000-0000000000a1', 0); raise exception 'FALLO: 0 minutos';
  exception when invalid_parameter_value then null; end;
  r := public.practica_tiempo_guardar('de780000-0000-4000-8000-0000000000a1', 60);
  if not (r ->> 'activo')::boolean or (r ->> 'minutos')::int <> 60 then raise exception 'FALLO: activar: %', r; end if;
  perform public.practica_tiempo_guardar('de780000-0000-4000-8000-0000000000a3', 60);
end $$;
reset role;

insert into public.attempts (id, user_id, course_id, activity_id, mode) values
  ('de780000-0000-4000-8000-0000000000b1', 'de780000-0000-4000-8000-000000000011', 'de780000-0000-4000-8000-000000000021', 'de780000-0000-4000-8000-0000000000a1', 'practice'),
  ('de780000-0000-4000-8000-0000000000b3', 'de780000-0000-4000-8000-000000000013', 'de780000-0000-4000-8000-000000000021', 'de780000-0000-4000-8000-0000000000a1', 'practice'),
  ('de780000-0000-4000-8000-0000000000b4', 'de780000-0000-4000-8000-000000000014', 'de780000-0000-4000-8000-000000000021', 'de780000-0000-4000-8000-0000000000a2', 'practice'),
  ('de780000-0000-4000-8000-0000000000b5', 'de780000-0000-4000-8000-000000000014', 'de780000-0000-4000-8000-000000000021', 'de780000-0000-4000-8000-0000000000a3', 'practice');
-- todas las respuestas correctas (4 puntos posibles)
insert into public.responses (attempt_id, exercise_id, user_id, answer, status, auto_credit)
  select b.id, ('de780000-0000-4000-8000-0000000000e' || g)::uuid, b.u, '{"text":"2 m"}', 'correct', 1
  from (values ('de780000-0000-4000-8000-0000000000b1'::uuid, 'de780000-0000-4000-8000-000000000011'::uuid),
               ('de780000-0000-4000-8000-0000000000b2'::uuid, 'de780000-0000-4000-8000-000000000012'::uuid),
               ('de780000-0000-4000-8000-0000000000b3'::uuid, 'de780000-0000-4000-8000-000000000013'::uuid),
               ('de780000-0000-4000-8000-0000000000b4'::uuid, 'de780000-0000-4000-8000-000000000014'::uuid),
               ('de780000-0000-4000-8000-0000000000b5'::uuid, 'de780000-0000-4000-8000-000000000014'::uuid)) b(id, u)
  cross join generate_series(1, 4) g;

-- 2) Latidos: solo suma tiempo real entre latidos cercanos y activos; no cuenta inactividad ni ausencias
set local role authenticated;
select pg_temp.como('de780000-0000-4000-8000-000000000011');
do $$ declare r jsonb; begin
  r := public.practica_latido('de780000-0000-4000-8000-0000000000b1', true);
  if not (r ->> 'aplica')::boolean or (r ->> 'minimo_s')::int <> 3600 or (r ->> 'segundos')::numeric <> 0 then raise exception 'FALLO: primer latido: %', r; end if;
end $$;
reset role;
update public.attempt_active_time set last_beat = now() - interval '10 seconds' where attempt_id = 'de780000-0000-4000-8000-0000000000b1';
set local role authenticated;
select pg_temp.como('de780000-0000-4000-8000-000000000011');
do $$ declare r jsonb; begin
  r := public.practica_latido('de780000-0000-4000-8000-0000000000b1', true);
  if (r ->> 'segundos')::numeric <> 10 then raise exception 'FALLO: no sumó 10 s: %', r; end if;
  -- otro latido inmediato (otra pestaña): no duplica
  r := public.practica_latido('de780000-0000-4000-8000-0000000000b1', true);
  if (r ->> 'segundos')::numeric <> 10 then raise exception 'FALLO: dos pestañas duplicaron el tiempo: %', r; end if;
end $$;
reset role;
update public.attempt_active_time set last_beat = now() - interval '10 seconds' where attempt_id = 'de780000-0000-4000-8000-0000000000b1';
set local role authenticated;
select pg_temp.como('de780000-0000-4000-8000-000000000011');
do $$ declare r jsonb; begin
  -- inactivo / página oculta: esos 10 s no cuentan y deja de contar
  r := public.practica_latido('de780000-0000-4000-8000-0000000000b1', false);
  if (r ->> 'contando')::boolean then raise exception 'FALLO: sigue contando inactivo'; end if;
  if (r ->> 'segundos')::numeric <> 10 then raise exception 'FALLO: contó tiempo inactivo: %', r; end if;
end $$;
reset role;
do $$ begin
  if (select last_beat from public.attempt_active_time where attempt_id = 'de780000-0000-4000-8000-0000000000b1') is not null then
    raise exception 'FALLO: no se detuvo el contador al quedar inactivo';
  end if;
end $$;
update public.attempt_active_time set last_beat = now() - interval '40 seconds' where attempt_id = 'de780000-0000-4000-8000-0000000000b1';
set local role authenticated;
select pg_temp.como('de780000-0000-4000-8000-000000000011');
do $$ declare r jsonb; begin
  -- volvió tras 40 s fuera: no se cuentan
  r := public.practica_latido('de780000-0000-4000-8000-0000000000b1', true);
  if (r ->> 'segundos')::numeric <> 10 then raise exception 'FALLO: contó una ausencia: %', r; end if;
  if (public.practica_tiempo_estado('de780000-0000-4000-8000-0000000000b1') ->> 'cumplido')::boolean then raise exception 'FALLO: cumplido con 10 s'; end if;
  -- el intento de S2 (empezado antes de activar) está exento
  begin perform public.practica_latido('de780000-0000-4000-8000-0000000000b2', true); raise exception 'FALLO: latido en intento ajeno';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('de780000-0000-4000-8000-000000000012');
do $$ begin
  if (public.practica_latido('de780000-0000-4000-8000-0000000000b2', true) ->> 'aplica')::boolean then raise exception 'FALLO: intento anterior a la activación'; end if;
end $$;
select pg_temp.como('de780000-0000-4000-8000-000000000014');
do $$ begin
  begin perform public.practica_latido('de780000-0000-4000-8000-0000000000b1', true); raise exception 'FALLO: otro estudiante sumó tiempo'; exception when insufficient_privilege then null; end;
  begin perform public.practica_tiempo_estado('de780000-0000-4000-8000-0000000000b1'); raise exception 'FALLO: vio el tiempo de otro'; exception when insufficient_privilege then null; end;
  if (public.practica_latido('de780000-0000-4000-8000-0000000000b4', true) ->> 'aplica')::boolean then raise exception 'FALLO: práctica sin mínimo'; end if;
  -- práctica C ya cerrada: el tiempo no cuenta
  perform public.practica_latido('de780000-0000-4000-8000-0000000000b5', true);
end $$;
reset role;
update public.attempt_active_time set last_beat = now() - interval '10 seconds', segundos = 1200 where attempt_id = 'de780000-0000-4000-8000-0000000000b5';
set local role authenticated;
select pg_temp.como('de780000-0000-4000-8000-000000000014');
do $$ declare r jsonb; begin
  r := public.practica_latido('de780000-0000-4000-8000-0000000000b5', true);
  if (r ->> 'segundos')::numeric <> 1200 or not (r ->> 'cerrada')::boolean then raise exception 'FALLO: contó tras el cierre: %', r; end if;
end $$;
reset role;

-- 3) Entrega del estudiante: bloqueada antes del mínimo con la práctica abierta; permitida al cumplirlo o tras el cierre
set local role service_role;
do $$ begin
  begin perform public.svc_tiempo_minimo_verificar('de780000-0000-4000-8000-000000000011', 'de780000-0000-4000-8000-0000000000b1');
    raise exception 'FALLO: entregó sin el tiempo mínimo';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
    if sqlerrm not like '%le faltan 60 min%' then raise exception 'FALLO: mensaje: %', sqlerrm; end if;
  end;
  perform public.svc_tiempo_minimo_verificar('de780000-0000-4000-8000-000000000012', 'de780000-0000-4000-8000-0000000000b2');   -- exento
  perform public.svc_tiempo_minimo_verificar('de780000-0000-4000-8000-000000000014', 'de780000-0000-4000-8000-0000000000b4');   -- sin mínimo
  if not (public.svc_tiempo_minimo_verificar('de780000-0000-4000-8000-000000000014', 'de780000-0000-4000-8000-0000000000b5') ->> 'reducida')::boolean then
    raise exception 'FALLO: tras el cierre debe poder entregar (con reducción)';
  end if;
  -- usuario equivocado: no aplica (la Edge Function ya validó el usuario de la sesión)
  if (public.svc_tiempo_minimo_verificar('de780000-0000-4000-8000-000000000014', 'de780000-0000-4000-8000-0000000000b1') ->> 'aplica')::boolean then
    raise exception 'FALLO: intento de otro usuario';
  end if;
end $$;
reset role;
update public.attempt_active_time set segundos = 3600 where attempt_id = 'de780000-0000-4000-8000-0000000000b1';
set local role service_role;
do $$ begin
  perform public.svc_tiempo_minimo_verificar('de780000-0000-4000-8000-000000000011', 'de780000-0000-4000-8000-0000000000b1');
end $$;
reset role;

-- 3b) un examen nunca tiene tiempo mínimo, aunque hubiera una fila de configuración
insert into public.activity_min_time (activity_id, minutos) values ('de780000-0000-4000-8000-0000000000a4', 30);
insert into public.attempts (id, user_id, course_id, activity_id, mode) values
  ('de780000-0000-4000-8000-0000000000b6', 'de780000-0000-4000-8000-000000000014', 'de780000-0000-4000-8000-000000000021', 'de780000-0000-4000-8000-0000000000a4', 'exam');
set local role authenticated;
select pg_temp.como('de780000-0000-4000-8000-000000000014');
do $$ begin
  if (public.practica_latido('de780000-0000-4000-8000-0000000000b6', true) ->> 'aplica')::boolean then raise exception 'FALLO: tiempo mínimo en un examen'; end if;
end $$;
reset role;

-- 4) Nota: entregada sin cumplirlo → × (activo ÷ mínimo); cumplida, exenta o sin mínimo → completa
insert into public.attempt_active_time (attempt_id, user_id, activity_id, minimo_s, segundos)
  values ('de780000-0000-4000-8000-0000000000b3', 'de780000-0000-4000-8000-000000000013', 'de780000-0000-4000-8000-0000000000a1', 3600, 1200);
update public.attempts set status = 'submitted', submitted_at = now() where id::text like 'de780000-%';
do $$ declare b text; begin
  foreach b in array array['b1', 'b2', 'b3', 'b4', 'b5'] loop perform public.recompute_attempt(('de780000-0000-4000-8000-0000000000' || b)::uuid); end loop;
  if (select score from public.attempts where id = 'de780000-0000-4000-8000-0000000000b1') <> 4 then raise exception 'FALLO: cumplida con nota reducida'; end if;
  if (select score from public.attempts where id = 'de780000-0000-4000-8000-0000000000b2') <> 4 then raise exception 'FALLO: exenta con nota reducida'; end if;
  if (select score from public.attempts where id = 'de780000-0000-4000-8000-0000000000b3') <> 1.33 then raise exception 'FALLO: 20 de 60 min debe valer un tercio (%)', (select score from public.attempts where id = 'de780000-0000-4000-8000-0000000000b3'); end if;
  if (select score from public.attempts where id = 'de780000-0000-4000-8000-0000000000b4') <> 4 then raise exception 'FALLO: práctica sin mínimo cambió'; end if;
  if (select score from public.attempts where id = 'de780000-0000-4000-8000-0000000000b5') <> 1.33 then raise exception 'FALLO: cerrada sin cumplir'; end if;
  -- abandonada sin ningún latido: vale 0 (no trabajó en la práctica)
  delete from public.attempt_active_time where attempt_id = 'de780000-0000-4000-8000-0000000000b3';
  perform public.recompute_attempt('de780000-0000-4000-8000-0000000000b3');
  if (select score from public.attempts where id = 'de780000-0000-4000-8000-0000000000b3') <> 0 then raise exception 'FALLO: sin tiempo activo'; end if;
  insert into public.attempt_active_time (attempt_id, user_id, activity_id, minimo_s, segundos)
    values ('de780000-0000-4000-8000-0000000000b3', 'de780000-0000-4000-8000-000000000013', 'de780000-0000-4000-8000-0000000000a1', 3600, 1200);
  perform public.recompute_attempt('de780000-0000-4000-8000-0000000000b3');
end $$;

-- 5) El profesor ve el tiempo de cada intento; desactivar devuelve las notas; copiar la práctica copia el mínimo
set local role authenticated;
select pg_temp.como('de780000-0000-4000-8000-000000000001');
do $$ declare r jsonb; v uuid; begin
  if (select segundos from public.practica_tiempo_intentos('de780000-0000-4000-8000-0000000000a1') where attempt_id = 'de780000-0000-4000-8000-0000000000b3') <> 1200 then raise exception 'FALLO: lista del profesor'; end if;
  if not (select exento from public.practica_tiempo_intentos('de780000-0000-4000-8000-0000000000a1') where attempt_id = 'de780000-0000-4000-8000-0000000000b2') then raise exception 'FALLO: exento en la lista'; end if;
  r := public.practica_tiempo_guardar('de780000-0000-4000-8000-0000000000a1', null);
  if (r ->> 'activo')::boolean then raise exception 'FALLO: no se desactivó'; end if;
  r := public.actividad_copiar('de780000-0000-4000-8000-0000000000a3', 'de780000-0000-4000-8000-000000000032', true);
  if (r ->> 'id') is null then raise exception 'FALLO: no se copió'; end if;
end $$;
reset role;
do $$ begin
  if (select score from public.attempts where id = 'de780000-0000-4000-8000-0000000000b3') <> 4 then raise exception 'FALLO: desactivar no devolvió la nota'; end if;
  if (select m.minutos from public.activity_min_time m join public.activities a on a.id = m.activity_id where a.class_id = 'de780000-0000-4000-8000-000000000032') is distinct from 60 then
    raise exception 'FALLO: la copia no lleva el mínimo';
  end if;
  if (select count(*) from public.attempt_active_time where attempt_id::text like 'de780000-%') < 3 then raise exception 'FALLO: se perdieron tiempos'; end if;
end $$;

select 'PRUEBAS DE TIEMPO MÍNIMO PASARON' as resultado;
rollback;
