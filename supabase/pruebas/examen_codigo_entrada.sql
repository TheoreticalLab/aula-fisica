-- Pruebas: código de entrada rotativo de las evaluaciones (migración 100). Datos sintéticos; se deshace al final.
-- T = profesor · T2 = profesor ajeno · E1, E2 = estudiantes · a1: examen con código de entrada · a2: examen sin código
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ec100000-0000-4000-8000-000000000001', 'ce01@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-entrada","aula_role":"teacher"}', '{}', now(), now()),
  ('ec100000-0000-4000-8000-000000000002', 'ce02@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-entrada-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('ec100000-0000-4000-8000-000000000011', 'ce11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-entrada-1"}', '{}', now(), now()),
  ('ec100000-0000-4000-8000-000000000012', 'ce12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-entrada-2"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'ec100000-%';
update public.profiles set role = 'teacher' where id in ('ec100000-0000-4000-8000-000000000001', 'ec100000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('ec100000-0000-4000-8000-000000000021', 'Curso entrada');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, options, points)
  select ('ec100000-0000-4000-8000-0000000000e' || k)::uuid, 'ec100000-0000-4000-8000-000000000021', 'entrada-e' || k, 'seleccion', 'basico', 'bank', 'choice', 'Pregunta ' || k, '["a","b","c"]', 1
  from generate_series(1, 2) k;
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ec100000-0000-4000-8000-000000000031', 'ec100000-0000-4000-8000-000000000021', 'Sección entrada', 'ENTRAD01', 'ec100000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('ec100000-0000-4000-8000-000000000031', 'ec100000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('ec100000-0000-4000-8000-000000000031', 'ec100000-0000-4000-8000-000000000011'),
  ('ec100000-0000-4000-8000-000000000031', 'ec100000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_attempts, created_by) values
  ('ec100000-0000-4000-8000-0000000000a1', 'ec100000-0000-4000-8000-000000000031', 'Examen con código', 'exam', true, 'never', false, 1, 'ec100000-0000-4000-8000-000000000001'),
  ('ec100000-0000-4000-8000-0000000000a2', 'ec100000-0000-4000-8000-000000000031', 'Examen sin código', 'exam', true, 'never', false, 1, 'ec100000-0000-4000-8000-000000000001');
insert into public.activity_items (activity_id, exercise_id, position)
  select ('ec100000-0000-4000-8000-0000000000a' || a)::uuid, ('ec100000-0000-4000-8000-0000000000e' || k)::uuid, k from generate_series(1, 2) a, generate_series(1, 2) k;
insert into public.exam_settings (activity_id, presentacion, navegacion, duracion_s, codigo_entrada) values
  ('ec100000-0000-4000-8000-0000000000a1', 'una_a_la_vez', 'solo_adelante', 3600, true),
  ('ec100000-0000-4000-8000-0000000000a2', 'una_a_la_vez', 'solo_adelante', 3600, false);

create function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p::text, true);
$$;
grant execute on function pg_temp.como(uuid) to authenticated;
create temp table t (k text primary key, v text);
grant all on t to authenticated;

-- 0) permisos: el cálculo del código y los fallos no son accesibles; el secreto nunca sale
do $$ begin
  if has_function_privilege('authenticated', 'public.exam_codigo_entrada_en(uuid, bigint)', 'execute') then raise exception 'FALLO: exam_codigo_entrada_en expuesto'; end if;
  if has_table_privilege('authenticated', 'public.exam_entrada_fallos', 'select') then raise exception 'FALLO: fallos legibles'; end if;
  if has_function_privilege('anon', 'public.start_activity_attempt_codigo(uuid, text)', 'execute') then raise exception 'FALLO: anon'; end if;
  if (select count(distinct codigo_entrada_secreto) from public.exam_settings where activity_id::text like 'ec100000-%') <> 2 then raise exception 'FALLO: secretos repetidos'; end if;
end $$;

set local role authenticated;

-- 1) el profesor ve el código vigente; el profesor ajeno y el estudiante no
select pg_temp.como('ec100000-0000-4000-8000-000000000001');
do $$ declare r jsonb := public.exam_codigo_entrada('ec100000-0000-4000-8000-0000000000a1'); begin
  if not (r ->> 'activo')::boolean or r ->> 'codigo' !~ '^\d{6}$' or (r ->> 'segundos')::int <> 60 or (r ->> 'cambia_at')::timestamptz <= now() then
    raise exception 'FALLO: código del profesor: %', r; end if;
  insert into t values ('codigo', r ->> 'codigo');
  if (public.exam_codigo_entrada('ec100000-0000-4000-8000-0000000000a2') ->> 'activo')::boolean then raise exception 'FALLO: a2 sin código aparece activo'; end if;
  if public.exam_codigo_entrada('ec100000-0000-4000-8000-0000000000a1')::text ~ 'secreto' then raise exception 'FALLO: expuso el secreto'; end if;
end $$;
select pg_temp.como('ec100000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.exam_codigo_entrada('ec100000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: profesor ajeno vio el código';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) el estudiante: sin código no empieza; ve en las reglas que hace falta; con código incorrecto no; con el vigente sí
select pg_temp.como('ec100000-0000-4000-8000-000000000011');
do $$ declare r jsonb; v_id uuid; begin
  begin perform public.exam_codigo_entrada('ec100000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: el estudiante vio el código';
  exception when insufficient_privilege then null; end;
  if not (public.exam_rules('ec100000-0000-4000-8000-0000000000a1') ->> 'codigo_entrada')::boolean then raise exception 'FALLO: las reglas no avisan del código'; end if;
  begin perform public.start_activity_attempt('ec100000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: empezó sin código';
  exception when sqlstate 'P0001' then null; end;
  r := public.start_activity_attempt_codigo('ec100000-0000-4000-8000-0000000000a1', '000000');
  if (r ->> 'ok')::boolean and (select v from t where k = 'codigo') <> '000000' then raise exception 'FALLO: aceptó un código incorrecto'; end if;
  r := public.start_activity_attempt_codigo('ec100000-0000-4000-8000-0000000000a1', ' ' || (select v from t where k = 'codigo') || ' ');
  if not (r ->> 'ok')::boolean or r ->> 'attempt_id' is null then raise exception 'FALLO: el código vigente no abrió el examen: %', r; end if;
  v_id := (r ->> 'attempt_id')::uuid;
  -- continuar el intento en curso no vuelve a pedir el código
  if public.start_activity_attempt('ec100000-0000-4000-8000-0000000000a1') <> v_id then raise exception 'FALLO: continuar pidió otro intento'; end if;
  -- la marca no queda puesta para otra evaluación de la misma transacción
  if current_setting('aula.codigo_entrada', true) <> '' then raise exception 'FALLO: quedó la marca del código'; end if;
  -- sin código de entrada: como siempre
  r := public.start_activity_attempt_codigo('ec100000-0000-4000-8000-0000000000a2', '');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: examen sin código'; end if;
  perform public.start_activity_attempt('ec100000-0000-4000-8000-0000000000a2');
end $$;

-- 3) el código de la ventana anterior todavía vale; el de hace dos ventanas no
reset role;
do $$ declare w bigint := floor(extract(epoch from now()) / 60)::bigint; begin
  insert into t values ('anterior', public.exam_codigo_entrada_en('ec100000-0000-4000-8000-0000000000a1', w - 1)),
                       ('viejo', public.exam_codigo_entrada_en('ec100000-0000-4000-8000-0000000000a1', w - 2));
end $$;
set local role authenticated;
select pg_temp.como('ec100000-0000-4000-8000-000000000012');
do $$ declare r jsonb; begin
  if (select v from t where k = 'viejo') not in ((select v from t where k = 'codigo'), (select v from t where k = 'anterior')) then
    r := public.start_activity_attempt_codigo('ec100000-0000-4000-8000-0000000000a1', (select v from t where k = 'viejo'));
    if (r ->> 'ok')::boolean then raise exception 'FALLO: valió un código de hace dos minutos'; end if;
  end if;
  r := public.start_activity_attempt_codigo('ec100000-0000-4000-8000-0000000000a1', (select v from t where k = 'anterior'));
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: el código del minuto anterior no valió: %', r; end if;
end $$;

-- 4) cinco fallos en 10 minutos bloquean, aunque después escriba el código bueno; los fallos quedan registrados
reset role;
delete from public.attempts where activity_id = 'ec100000-0000-4000-8000-0000000000a1' and user_id = 'ec100000-0000-4000-8000-000000000012';
delete from public.exam_entrada_fallos where user_id = 'ec100000-0000-4000-8000-000000000012';
set local role authenticated;
select pg_temp.como('ec100000-0000-4000-8000-000000000012');
do $$ declare r jsonb; n integer; begin
  for n in 1 .. 5 loop
    r := public.start_activity_attempt_codigo('ec100000-0000-4000-8000-0000000000a1', 'x' || n);
    if (r ->> 'ok')::boolean then raise exception 'FALLO: aceptó un código vacío'; end if;
  end loop;
  r := public.start_activity_attempt_codigo('ec100000-0000-4000-8000-0000000000a1', (select v from t where k = 'codigo'));
  if (r ->> 'ok')::boolean or r ->> 'mensaje' not like 'Demasiados%' then raise exception 'FALLO: no limitó los intentos: %', r; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.exam_entrada_fallos where user_id = 'ec100000-0000-4000-8000-000000000012') <> 5 then raise exception 'FALLO: fallos no registrados'; end if;
end $$;

select 'examen_codigo_entrada: PRUEBAS PASARON' as resultado;
rollback;
