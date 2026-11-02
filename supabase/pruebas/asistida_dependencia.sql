-- Pruebas: penalización por dependencia observada de la ayuda (migración 59). Se deshace al final.
-- Escenario del profesor: A hace 2 de 4 solo y bien y deja 2 en blanco; B falla los 4 y los corrige con ayuda.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de590000-0000-4000-8000-000000000001', 'dp1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-dependencia","aula_role":"teacher"}', '{}', now(), now()),
  ('de590000-0000-4000-8000-000000000011', 'dp11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-dep-a"}', '{}', now(), now()),
  ('de590000-0000-4000-8000-000000000012', 'dp12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-dep-b"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de590000-%';
update public.profiles set role = 'teacher' where id = 'de590000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de590000-0000-4000-8000-000000000021', 'Curso dependencia');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points)
  select ('de590000-0000-4000-8000-0000000000e' || g)::uuid, 'de590000-0000-4000-8000-000000000021', 'dep-' || g, 'numerica', 'intermedio', 'bank', 'numeric', 'P' || g, 1 from generate_series(1, 4) g;
insert into public.exercise_keys (exercise_id, answer, explanation)
  select ('de590000-0000-4000-8000-0000000000e' || g)::uuid, '{"format":"numeric","value":"2 m"}', '' from generate_series(1, 4) g;
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de590000-0000-4000-8000-000000000031', 'de590000-0000-4000-8000-000000000021', 'Sección dependencia', 'DEPEND01', 'de590000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de590000-0000-4000-8000-000000000031', 'de590000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de590000-0000-4000-8000-000000000031', 'de590000-0000-4000-8000-000000000011'), ('de590000-0000-4000-8000-000000000031', 'de590000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de590000-0000-4000-8000-0000000000a1', 'de590000-0000-4000-8000-000000000031', 'Asistida', 'practice', true, 'after_submit', false, 2);
insert into public.activity_items (activity_id, exercise_id, position)
  select 'de590000-0000-4000-8000-0000000000a1', ('de590000-0000-4000-8000-0000000000e' || g)::uuid, g from generate_series(1, 4) g;
insert into public.assisted_settings (activity_id, nota_primer_intento, factor_ayuda) values ('de590000-0000-4000-8000-0000000000a1', 'acierto', 0.5);
insert into public.attempts (id, user_id, course_id, activity_id, mode) values
  ('de590000-0000-4000-8000-0000000000b1', 'de590000-0000-4000-8000-000000000011', 'de590000-0000-4000-8000-000000000021', 'de590000-0000-4000-8000-0000000000a1', 'practice'),
  ('de590000-0000-4000-8000-0000000000b2', 'de590000-0000-4000-8000-000000000012', 'de590000-0000-4000-8000-000000000021', 'de590000-0000-4000-8000-0000000000a1', 'practice');
-- A: ejercicios 1 y 2 solo y bien (con su corrección y explicación); 3 y 4 en blanco
insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, client_id, answer, declaracion, status, credit, reflexion)
  select 'de590000-0000-4000-8000-0000000000b1', ('de590000-0000-4000-8000-0000000000e' || g)::uuid, 'de590000-0000-4000-8000-000000000011', f.fase, gen_random_uuid(),
         case when f.fase = 'reflexion' then null else '{"text":"2 m"}'::jsonb end, case when f.fase = 'inicial' then 'autonomo' end,
         case when f.fase = 'reflexion' then null else 'correct' end, case when f.fase = 'reflexion' then null else 1 end,
         case when f.fase = 'reflexion' then '{"que_aprendi":"Lo resolví con la ecuación de posición."}'::jsonb end
  from generate_series(1, 2) g cross join (values ('inicial'), ('corregida'), ('reflexion')) f(fase);
-- B: los 4 fallados primero y corregidos con ayuda, con explicación
insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, client_id, answer, declaracion, status, credit, reflexion)
  select 'de590000-0000-4000-8000-0000000000b2', ('de590000-0000-4000-8000-0000000000e' || g)::uuid, 'de590000-0000-4000-8000-000000000012', f.fase, gen_random_uuid(),
         case f.fase when 'inicial' then '{"text":"7 m"}'::jsonb when 'corregida' then '{"text":"2 m"}'::jsonb end, case when f.fase = 'inicial' then 'consulto_ayuda' end,
         case f.fase when 'inicial' then 'incorrect' when 'corregida' then 'correct' end, case f.fase when 'inicial' then 0 when 'corregida' then 1 end,
         case when f.fase = 'reflexion' then '{"que_aprendi":"Entendí que debía usar la velocidad final."}'::jsonb end
  from generate_series(1, 4) g cross join (values ('inicial'), ('corregida'), ('reflexion')) f(fase);
do $$ declare r record; begin
  for r in select distinct attempt_id, exercise_id from public.assisted_steps where attempt_id::text like 'de590000-%' loop
    perform public.asistida_actualizar_respuesta(r.attempt_id, r.exercise_id);
  end loop;
end $$;

do $$ declare d jsonb; begin
  -- sin penalización: A = 2 × 100 % = 2; B = 4 × 50 % = 2 (empatados: el caso que preocupa al profesor)
  if (select score from public.attempts where id = 'de590000-0000-4000-8000-0000000000b1') <> 2 then raise exception 'FALLO: A sin penalización'; end if;
  if (select score from public.attempts where id = 'de590000-0000-4000-8000-0000000000b2') <> 2 then raise exception 'FALLO: B sin penalización (%)', (select score from public.attempts where id = 'de590000-0000-4000-8000-0000000000b2'); end if;
  d := public.asistida_dependencia('de590000-0000-4000-8000-0000000000b2');
  if (d ->> 'corregidos_tras_fallar')::int <> 4 or (d ->> 'porcentaje')::numeric <> 100 or (d ->> 'aplicado')::boolean then raise exception 'FALLO: dependencia de B %', d; end if;
  if (public.asistida_dependencia('de590000-0000-4000-8000-0000000000b1') ->> 'corregidos_tras_fallar')::int <> 0 then raise exception 'FALLO: A no depende de la ayuda'; end if;
  if has_function_privilege('authenticated', 'public.asistida_dependencia(uuid)', 'execute') then raise exception 'FALLO: función interna expuesta'; end if;
end $$;

-- el profesor activa: más del 50 % corregido tras fallar → −20 %, y recalcula
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de590000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de590000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.asistida_dependencia_guardar('de590000-0000-4000-8000-0000000000a1', 150, 20, false); raise exception 'FALLO: umbral 150 aceptado';
  exception when invalid_parameter_value then null; end;
  r := public.asistida_dependencia_guardar('de590000-0000-4000-8000-0000000000a1', 50, 20, true);
  if (r ->> 'recalculados')::int <> 2 or (r -> 'config' ->> 'dependencia_umbral')::int <> 50 then raise exception 'FALLO: guardar %', r; end if;
end $$;
-- el estudiante B ve la regla y su dependencia; A no tiene penalización
select set_config('request.jwt.claims', '{"sub":"de590000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de590000-0000-4000-8000-000000000012', true);
do $$ declare e jsonb; begin
  e := public.asistida_estado('de590000-0000-4000-8000-0000000000b2');
  if not (e -> 'dependencia' ->> 'aplicado')::boolean or (e -> 'dependencia' ->> 'umbral')::int <> 50 then raise exception 'FALLO: B no ve su dependencia %', e -> 'dependencia'; end if;
end $$;
reset role;

do $$ begin
  if (select score from public.attempts where id = 'de590000-0000-4000-8000-0000000000b2') <> 1.6 then raise exception 'FALLO: B con penalización (%), esperado 1.6', (select score from public.attempts where id = 'de590000-0000-4000-8000-0000000000b2'); end if;
  if (select score from public.attempts where id = 'de590000-0000-4000-8000-0000000000b1') <> 2 then raise exception 'FALLO: A no debía cambiar'; end if;
  -- la penalización se recalcula sola con cada paso (recompute_attempt) y se quita al desactivarla
  update public.assisted_settings set dependencia_umbral = null where activity_id = 'de590000-0000-4000-8000-0000000000a1';
  perform public.recompute_attempt('de590000-0000-4000-8000-0000000000b2');
  if (select score from public.attempts where id = 'de590000-0000-4000-8000-0000000000b2') <> 2 then raise exception 'FALLO: al desactivarla debía volver a 2'; end if;
end $$;

select 'asistida_dependencia.sql: PRUEBAS PASARON' as resultado;
rollback;
