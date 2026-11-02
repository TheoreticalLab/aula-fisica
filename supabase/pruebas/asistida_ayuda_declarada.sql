-- Pruebas: el primer intento con ayuda declarada vale una fracción (migración 60). Se deshace al final.
-- Caso real: un estudiante declara «consulté ayuda» en el primer intento, acierta y sacaba 100 %.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de600000-0000-4000-8000-000000000001', 'ad1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-declarada","aula_role":"teacher"}', '{}', now(), now()),
  ('de600000-0000-4000-8000-000000000011', 'ad11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-decl-ayuda"}', '{}', now(), now()),
  ('de600000-0000-4000-8000-000000000012', 'ad12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-decl-solo"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de600000-%';
update public.profiles set role = 'teacher' where id = 'de600000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de600000-0000-4000-8000-000000000021', 'Curso declarada');
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points) values
  ('de600000-0000-4000-8000-0000000000e1', 'de600000-0000-4000-8000-000000000021', 'dc-1', 'numerica', 'intermedio', 'bank', 'numeric', 'Energía', 1);
insert into public.exercise_keys (exercise_id, answer, explanation) values ('de600000-0000-4000-8000-0000000000e1', '{"format":"numeric","value":"12 J"}', '');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de600000-0000-4000-8000-000000000031', 'de600000-0000-4000-8000-000000000021', 'Sección declarada', 'DECLAR01', 'de600000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de600000-0000-4000-8000-000000000031', 'de600000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item) values
  ('de600000-0000-4000-8000-0000000000a1', 'de600000-0000-4000-8000-000000000031', 'Asistida', 'practice', true, 'after_submit', false, 2);
insert into public.activity_items (activity_id, exercise_id, position) values ('de600000-0000-4000-8000-0000000000a1', 'de600000-0000-4000-8000-0000000000e1', 1);
-- práctica que ya existía: regla de acierto, pero sin efecto de la ayuda declarada (valor 1)
insert into public.assisted_settings (activity_id, nota_primer_intento, factor_ayuda, factor_declarada, factores_fuente) values ('de600000-0000-4000-8000-0000000000a1', 'acierto', 0.5, 1, '{}');
insert into public.attempts (id, user_id, course_id, activity_id, mode) values
  ('de600000-0000-4000-8000-0000000000b1', 'de600000-0000-4000-8000-000000000011', 'de600000-0000-4000-8000-000000000021', 'de600000-0000-4000-8000-0000000000a1', 'practice'),
  ('de600000-0000-4000-8000-0000000000b2', 'de600000-0000-4000-8000-000000000012', 'de600000-0000-4000-8000-000000000021', 'de600000-0000-4000-8000-0000000000a1', 'practice');
insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, client_id, answer, declaracion, fuentes, status, credit, reflexion)
  select b, 'de600000-0000-4000-8000-0000000000e1', u, f.fase, gen_random_uuid(),
         case when f.fase = 'reflexion' then null else '{"text":"12 J"}'::jsonb end, case when f.fase = 'inicial' then d end,
         case when f.fase = 'inicial' and d = 'consulto_ayuda' then array['ia'] end,
         case when f.fase = 'reflexion' then null else 'correct' end, case when f.fase = 'reflexion' then null else 1 end,
         case when f.fase = 'reflexion' then '{"que_aprendi":"La energía cinética depende del cuadrado de la rapidez."}'::jsonb end
  from (values ('de600000-0000-4000-8000-0000000000b1'::uuid, 'de600000-0000-4000-8000-000000000011'::uuid, 'consulto_ayuda'),
               ('de600000-0000-4000-8000-0000000000b2'::uuid, 'de600000-0000-4000-8000-000000000012'::uuid, 'autonomo')) e(b, u, d)
  cross join (values ('inicial'), ('corregida'), ('reflexion')) f(fase);
do $$ begin
  perform public.asistida_actualizar_respuesta('de600000-0000-4000-8000-0000000000b1', 'de600000-0000-4000-8000-0000000000e1');
  perform public.asistida_actualizar_respuesta('de600000-0000-4000-8000-0000000000b2', 'de600000-0000-4000-8000-0000000000e1');
  -- el defecto: con ayuda declarada y acierto sacaba lo mismo que sin ayuda
  if (select auto_credit from public.responses where attempt_id = 'de600000-0000-4000-8000-0000000000b1') <> 1 then raise exception 'FALLO: situación previa'; end if;
end $$;

-- el profesor fija 50 % y recalcula
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de600000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de600000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.asistida_declarada_guardar('de600000-0000-4000-8000-0000000000a1', 0.5, true);
  if (r ->> 'recalculados')::int <> 2 then raise exception 'FALLO: recalculados %', r; end if;
end $$;
-- el estudiante ve la regla en su estado
select set_config('request.jwt.claims', '{"sub":"de600000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de600000-0000-4000-8000-000000000011', true);
do $$ begin
  if (public.asistida_estado('de600000-0000-4000-8000-0000000000b1') -> 'config' -> 'regla' ->> 'factor_declarada')::numeric <> 0.5 then raise exception 'FALLO: el estudiante no ve la regla'; end if;
end $$;
reset role;

do $$ declare c1 numeric; c2 numeric; begin
  -- con ayuda declarada y acierto: (20·0,5 + 30·0,5 + 20) / 70 = 45/70 = 0,643; autónomo y acierto: 1
  select auto_credit into c1 from public.responses where attempt_id = 'de600000-0000-4000-8000-0000000000b1';
  select auto_credit into c2 from public.responses where attempt_id = 'de600000-0000-4000-8000-0000000000b2';
  if c1 <> 0.643 or c2 <> 1 then raise exception 'FALLO: % / % (esperados 0,643 / 1)', c1, c2; end if;
  -- las prácticas nuevas nacen con 0,5
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'assisted_settings' and column_name = 'factor_declarada') not like '%0.5%' then
    raise exception 'FALLO: valor por defecto para prácticas nuevas'; end if;
end $$;

select 'asistida_ayuda_declarada.sql: PRUEBAS PASARON' as resultado;
rollback;
