-- Pruebas: penalización por intentos y pistas fijada por actividad (migración 109). Se deshace al final.
-- Dos prácticas de la misma sección: P con −35 % por intento y −20 % por pista; Q sin fila (regla de siempre).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('dea10900-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'p' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k = 1 then json_build_object('login_id', 'prof-pen1', 'aula_role', 'teacher')::text else json_build_object('login_id', 'sint-pen-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 11]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'dea10900-%';
update public.profiles set role = 'teacher' where id = 'dea10900-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('dea10900-0000-4000-8000-000000000021', 'Curso penalización');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('dea10900-0000-4000-8000-000000000031', 'dea10900-0000-4000-8000-000000000021', 'Sección A', 'PENAL001', 'dea10900-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('dea10900-0000-4000-8000-000000000031', 'dea10900-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('dea10900-0000-4000-8000-000000000031', 'dea10900-0000-4000-8000-000000000011');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('dea10900-0000-4000-8000-000000000041', 'dea10900-0000-4000-8000-000000000031', 'Práctica P', 'practice', true, 'immediate', true, 3),
  ('dea10900-0000-4000-8000-000000000042', 'dea10900-0000-4000-8000-000000000031', 'Práctica Q', 'practice', true, 'immediate', true, 3);
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points, published)
  select ('dea10900-0000-4000-8000-0000000001' || lpad(k::text, 2, '0'))::uuid, 'dea10900-0000-4000-8000-000000000021', 'pen-' || k,
         'numerica', 'basico', 'bank', 'numeric', 'Ejercicio ' || k, 1, true
  from generate_series(1, 6) k;
insert into public.exercise_keys (exercise_id, answer)
  select id, '{"format":"numeric","value":"2 m/s"}' from public.exercises where id::text like 'dea10900-0000-4000-8000-0000000001%';
insert into public.activity_items (activity_id, exercise_id, position)
  select 'dea10900-0000-4000-8000-000000000041', ('dea10900-0000-4000-8000-0000000001' || lpad(k::text, 2, '0'))::uuid, k from generate_series(1, 5) k;
insert into public.activity_items (activity_id, exercise_id, position)
  values ('dea10900-0000-4000-8000-000000000042', 'dea10900-0000-4000-8000-000000000106', 1);
insert into public.attempts (id, user_id, course_id, activity_id, mode) values
  ('dea10900-0000-4000-8000-000000000061', 'dea10900-0000-4000-8000-000000000011', 'dea10900-0000-4000-8000-000000000021', 'dea10900-0000-4000-8000-000000000041', 'practice'),
  ('dea10900-0000-4000-8000-000000000062', 'dea10900-0000-4000-8000-000000000011', 'dea10900-0000-4000-8000-000000000021', 'dea10900-0000-4000-8000-000000000042', 'practice');

create function pg_temp.e(k integer) returns uuid language sql as $$ select ('dea10900-0000-4000-8000-0000000001' || lpad(k::text, 2, '0'))::uuid $$;
create function pg_temp.check(p_attempt uuid, k integer, p_ok boolean) returns jsonb language sql as $$
  select public.svc_record_check('dea10900-0000-4000-8000-000000000011', p_attempt, pg_temp.e(k), '{"value":"x"}',
    case when p_ok then '{"status":"correct","credit":1}' else '{"status":"incorrect","credit":0}' end::jsonb)
$$;
create function pg_temp.credito(p_attempt uuid, k integer) returns numeric language sql as $$
  select auto_credit from public.responses where attempt_id = p_attempt and exercise_id = pg_temp.e(k)
$$;
create function pg_temp.pistas(p_attempt uuid, k integer, n integer) returns void language sql as $$
  update public.responses set hints_used = n where attempt_id = p_attempt and exercise_id = pg_temp.e(k)
$$;

-- 1) antes de fijar la regla, P se comporta como siempre: ejercicio 1 acertado al segundo intento con 1 pista → 70 %
do $$ begin
  perform pg_temp.check('dea10900-0000-4000-8000-000000000061', 1, false);
  perform pg_temp.pistas('dea10900-0000-4000-8000-000000000061', 1, 1);
  perform pg_temp.check('dea10900-0000-4000-8000-000000000061', 1, true);
  if pg_temp.credito('dea10900-0000-4000-8000-000000000061', 1) <> 0.7 then raise exception 'regla de siempre: esperaba 0.7, hay %', pg_temp.credito('dea10900-0000-4000-8000-000000000061', 1); end if;
end $$;

-- 2) se fija la regla en P y se recalcula lo ya respondido: el ejercicio 1 pasa a 1 − 0.35 − 0.20 = 45 %
insert into public.actividad_penalizaciones (activity_id, por_intento, por_pista, minimo, motivo)
  values ('dea10900-0000-4000-8000-000000000041', 0.35, 0.20, 0, 'prueba');
do $$ declare n integer; begin
  n := public.actividad_recalcular_penalizacion('dea10900-0000-4000-8000-000000000041');
  if n <> 1 or pg_temp.credito('dea10900-0000-4000-8000-000000000061', 1) <> 0.45 then raise exception 'recálculo: n=% crédito=%', n, pg_temp.credito('dea10900-0000-4000-8000-000000000061', 1); end if;
  if public.actividad_recalcular_penalizacion('dea10900-0000-4000-8000-000000000041') <> 0 then raise exception 'repetir el recálculo no debe cambiar nada'; end if;
end $$;

-- 3) desde ahora: 1 pista → 80 %; 2 pistas → 60 %; segundo intento → 65 %; tercer intento con 2 pistas → 0 (mínimo)
do $$ begin
  perform pg_temp.check('dea10900-0000-4000-8000-000000000061', 2, false);   -- crea la respuesta
  perform 1;
end $$;
-- ejercicio 2 se reinicia como «al primer intento con 1 pista»: se usa el 3
do $$ begin
  insert into public.responses (attempt_id, exercise_id, user_id, points) values ('dea10900-0000-4000-8000-000000000061', pg_temp.e(3), 'dea10900-0000-4000-8000-000000000011', 1);
  perform pg_temp.pistas('dea10900-0000-4000-8000-000000000061', 3, 1);
  perform pg_temp.check('dea10900-0000-4000-8000-000000000061', 3, true);
  if pg_temp.credito('dea10900-0000-4000-8000-000000000061', 3) <> 0.8 then raise exception '1 pista: esperaba 0.8, hay %', pg_temp.credito('dea10900-0000-4000-8000-000000000061', 3); end if;
  insert into public.responses (attempt_id, exercise_id, user_id, points) values ('dea10900-0000-4000-8000-000000000061', pg_temp.e(4), 'dea10900-0000-4000-8000-000000000011', 1);
  perform pg_temp.pistas('dea10900-0000-4000-8000-000000000061', 4, 2);
  perform pg_temp.check('dea10900-0000-4000-8000-000000000061', 4, true);
  if pg_temp.credito('dea10900-0000-4000-8000-000000000061', 4) <> 0.6 then raise exception '2 pistas: esperaba 0.6, hay %', pg_temp.credito('dea10900-0000-4000-8000-000000000061', 4); end if;
  perform pg_temp.check('dea10900-0000-4000-8000-000000000061', 2, true);   -- segundo intento, sin pistas
  if pg_temp.credito('dea10900-0000-4000-8000-000000000061', 2) <> 0.65 then raise exception 'segundo intento: esperaba 0.65, hay %', pg_temp.credito('dea10900-0000-4000-8000-000000000061', 2); end if;
  perform pg_temp.check('dea10900-0000-4000-8000-000000000061', 5, false);
  perform pg_temp.check('dea10900-0000-4000-8000-000000000061', 5, false);
  perform pg_temp.pistas('dea10900-0000-4000-8000-000000000061', 5, 2);
  perform pg_temp.check('dea10900-0000-4000-8000-000000000061', 5, true);
  if pg_temp.credito('dea10900-0000-4000-8000-000000000061', 5) <> 0 then raise exception 'mínimo 0: hay %', pg_temp.credito('dea10900-0000-4000-8000-000000000061', 5); end if;
end $$;

-- 4) el puntaje del intento suma los créditos (0.45 + 0.65 + 0.8 + 0.6 + 0 = 2.5 de 5)
do $$ begin
  if (select score from public.attempts where id = 'dea10900-0000-4000-8000-000000000061') <> 2.5 then
    raise exception 'puntaje del intento: %', (select score from public.attempts where id = 'dea10900-0000-4000-8000-000000000061'); end if;
end $$;

-- 5) la práctica Q (sin regla) sigue igual: segundo intento con 1 pista → 70 %
do $$ begin
  perform pg_temp.check('dea10900-0000-4000-8000-000000000062', 6, false);
  perform pg_temp.pistas('dea10900-0000-4000-8000-000000000062', 6, 1);
  perform pg_temp.check('dea10900-0000-4000-8000-000000000062', 6, true);
  if pg_temp.credito('dea10900-0000-4000-8000-000000000062', 6) <> 0.7 then raise exception 'otra práctica: esperaba 0.7, hay %', pg_temp.credito('dea10900-0000-4000-8000-000000000062', 6); end if;
end $$;

-- 6) sin acceso directo a la tabla
set local role authenticated;
do $$ begin
  begin
    perform 1 from public.actividad_penalizaciones limit 1;
    raise exception 'un usuario no debería leer la tabla';
  exception when insufficient_privilege then null; end;
  begin
    perform public.actividad_recalcular_penalizacion('dea10900-0000-4000-8000-000000000041');
    raise exception 'un usuario no debería poder recalcular';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'PRUEBAS DE PENALIZACIÓN POR ACTIVIDAD PASARON' as resultado;
rollback;
