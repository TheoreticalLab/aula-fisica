-- =============================================================================
-- Pruebas de seguridad: reserva de enunciados (AUD-SEC-001, migración 80). Datos sintéticos; se deshace al final.
-- =============================================================================
-- Cada consulta del estudiante se hace como lo hace PostgREST: rol «authenticated» y el JWT en request.jwt.claims,
-- con RLS y privilegios reales. Las consultas REST del incidente (GET /rest/v1/activity_items, /exercises?select=prompt,
-- /exercise_keys) y las relaciones anidadas (?select=*,exercises(*)) se reproducen con su SQL equivalente.
-- Además hay dos BARRIDOS genéricos: (a) todas las tablas que authenticated puede leer y (b) todas las funciones que
-- authenticated puede ejecutar, llamadas con todos los identificadores conocidos (efectos deshechos en cada llamada),
-- buscando en el resultado Y en los mensajes de error los marcadores de enunciados reservados, pistas y claves.
--
-- Marcadores: «PUBLICO-…» = catálogo de estudio (legible); «RESERVADO-…» = enunciado de evaluación;
-- «CLAVE-SECRETA», «PISTA-SECRETA» y «4242.42» = clave, pista y respuesta correcta.
begin;

-- -----------------------------------------------------------------------------
-- Escenario
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de770000-0000-4000-8000-000000000001', 'r1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-reserva-a","aula_role":"teacher"}', '{}', now(), now()),
  ('de770000-0000-4000-8000-000000000002', 'r2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-reserva-b","aula_role":"teacher"}', '{}', now(), now()),
  ('de770000-0000-4000-8000-000000000011', 'r11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-reserva-1"}', '{}', now(), now()),
  ('de770000-0000-4000-8000-000000000012', 'r12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-reserva-2"}', '{}', now(), now()),
  ('de770000-0000-4000-8000-000000000013', 'r13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-reserva-3"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de770000-%';
update public.profiles set role = 'teacher' where id in ('de770000-0000-4000-8000-000000000001', 'de770000-0000-4000-8000-000000000002');

insert into public.courses (id, title) values ('de770000-0000-4000-8000-000000000021', 'Curso reserva');
insert into public.course_staff (course_id, user_id) values ('de770000-0000-4000-8000-000000000021', 'de770000-0000-4000-8000-000000000001');
insert into public.units (id, course_id, slug, title) values ('de770000-0000-4000-8000-000000000022', 'de770000-0000-4000-8000-000000000021', 'u-res', 'Unidad');
insert into public.lessons (id, unit_id, course_id, slug, title, practice_config) values
  ('de770000-0000-4000-8000-000000000023', 'de770000-0000-4000-8000-000000000022', 'de770000-0000-4000-8000-000000000021', 'l-res', 'Lección', '{"basico": 3, "intermedio": 0, "desafiante": 0}');

-- e01 catálogo público; e13 de la lección pero sin publicar; el resto, banco de evaluación
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, published, options, figure, simulation) values
  ('de770000-0000-4000-8000-0000000000e1', 'de770000-0000-4000-8000-000000000021', 'de770000-0000-4000-8000-000000000023', 'r-p1', 'numerica', 'basico', 'practice', 'numeric', 'PUBLICO-P1 ¿Cuánto?', true, null, null, null),
  ('de770000-0000-4000-8000-0000000000e2', 'de770000-0000-4000-8000-000000000021', null, 'r-x1', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-X1', true, null, '{"alt":"RESERVADO-X1-FIG"}', null),
  ('de770000-0000-4000-8000-0000000000e3', 'de770000-0000-4000-8000-000000000021', null, 'r-x2', 'conceptual', 'basico', 'bank', 'choice', 'RESERVADO-X2', true, '["RESERVADO-X2-OPC-A","RESERVADO-X2-OPC-B"]', null, null),
  ('de770000-0000-4000-8000-0000000000e4', 'de770000-0000-4000-8000-000000000021', null, 'r-x3', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-X3', true, null, null, '{"tipo":"RESERVADO-X3-SIM"}'),
  ('de770000-0000-4000-8000-0000000000e5', 'de770000-0000-4000-8000-000000000021', null, 'r-e1', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-E1', true, null, null, null),
  ('de770000-0000-4000-8000-0000000000e6', 'de770000-0000-4000-8000-000000000021', null, 'r-f1', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-F1', true, null, null, null),
  ('de770000-0000-4000-8000-0000000000e7', 'de770000-0000-4000-8000-000000000021', null, 'r-u1', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-U1', true, null, null, null),
  ('de770000-0000-4000-8000-0000000000e8', 'de770000-0000-4000-8000-000000000021', null, 'r-b1', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-B1', true, null, null, null),
  ('de770000-0000-4000-8000-0000000000e9', 'de770000-0000-4000-8000-000000000021', null, 'r-pr1', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-PR1', true, null, null, null),
  ('de770000-0000-4000-8000-0000000000ea', 'de770000-0000-4000-8000-000000000021', null, 'r-g2', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-G2', true, null, null, null),
  ('de770000-0000-4000-8000-0000000000eb', 'de770000-0000-4000-8000-000000000021', null, 'r-y1', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-Y1', true, null, null, null),
  ('de770000-0000-4000-8000-0000000000ec', 'de770000-0000-4000-8000-000000000021', null, 'r-y2', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-Y2', true, null, null, null),
  ('de770000-0000-4000-8000-0000000000ed', 'de770000-0000-4000-8000-000000000021', 'de770000-0000-4000-8000-000000000023', 'r-nopub', 'numerica', 'basico', 'practice', 'numeric', 'RESERVADO-NOPUB', false, null, null, null),
  ('de770000-0000-4000-8000-0000000000ee', 'de770000-0000-4000-8000-000000000021', null, 'r-cerr', 'numerica', 'basico', 'bank', 'numeric', 'RESERVADO-CERRADA', true, null, null, null);
-- banco adaptativo: 16 preguntas calibradas
insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points)
  select ('de770000-0000-4000-8000-0000000002' || lpad(g::text, 2, '0'))::uuid, 'de770000-0000-4000-8000-000000000021', 'r-adapt-' || g, 'numerica', 'intermedio', 'bank', 'numeric', 'RESERVADO-Z' || lpad(g::text, 2, '0'), 1
  from generate_series(1, 16) g;
insert into public.item_calibrations (exercise_id, a, b, se_a, se_b, n_resp, estado)
  select ('de770000-0000-4000-8000-0000000002' || lpad(g::text, 2, '0'))::uuid, 1.2, -2.4 + g * 0.3, 0.1, 0.1, 300, 'calibrado' from generate_series(1, 16) g;
insert into public.exercise_keys (exercise_id, answer, hints, explanation)
  select e.id, case when e.format = 'choice' then '{"format":"choice","correct":[0]}'::jsonb else '{"format":"numeric","value":"4242.42 m"}'::jsonb end,
         '["PISTA-SECRETA"]', 'CLAVE-SECRETA'
  from public.exercises e where e.course_id = 'de770000-0000-4000-8000-000000000021';

insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de770000-0000-4000-8000-000000000031', 'de770000-0000-4000-8000-000000000021', 'Sección A', 'RESVAA01', 'de770000-0000-4000-8000-000000000001'),
  ('de770000-0000-4000-8000-000000000032', 'de770000-0000-4000-8000-000000000021', 'Sección B', 'RESVBB01', 'de770000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('de770000-0000-4000-8000-000000000031', 'de770000-0000-4000-8000-000000000001'), ('de770000-0000-4000-8000-000000000032', 'de770000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.class_groups (id, class_id, name, join_code) values
  ('de770000-0000-4000-8000-000000000041', 'de770000-0000-4000-8000-000000000031', 'G1', 'RESVGG01'),
  ('de770000-0000-4000-8000-000000000042', 'de770000-0000-4000-8000-000000000031', 'G2', 'RESVGG02');
insert into public.enrollments (class_id, user_id, group_id) values
  ('de770000-0000-4000-8000-000000000031', 'de770000-0000-4000-8000-000000000011', 'de770000-0000-4000-8000-000000000041'),
  ('de770000-0000-4000-8000-000000000031', 'de770000-0000-4000-8000-000000000012', 'de770000-0000-4000-8000-000000000042'),
  ('de770000-0000-4000-8000-000000000032', 'de770000-0000-4000-8000-000000000013', null);

-- Actividades. X: una a la vez, navegación libre, 30 min · Y: una a la vez, solo adelante, 1 min · Z: adaptativo
-- E: clásica · F: futura · U: sin publicar · B: otra sección · PR: práctica evaluada · G2: solo grupo G2 · C: cerrada
insert into public.activities (id, class_id, group_id, title, mode, reveal_policy, hints_enabled, published, opens_at, closes_at) values
  ('de770000-0000-4000-8000-0000000000a1', 'de770000-0000-4000-8000-000000000031', null, 'Parcial X', 'exam', 'after_submit', false, true, now() - interval '1 hour', now() + interval '1 day'),
  ('de770000-0000-4000-8000-0000000000a2', 'de770000-0000-4000-8000-000000000031', null, 'Parcial E', 'exam', 'after_close', false, true, now() - interval '1 hour', now() + interval '1 day'),
  ('de770000-0000-4000-8000-0000000000a3', 'de770000-0000-4000-8000-000000000031', null, 'Parcial F', 'exam', 'after_close', false, true, now() + interval '1 day', now() + interval '2 days'),
  ('de770000-0000-4000-8000-0000000000a4', 'de770000-0000-4000-8000-000000000031', null, 'Parcial U', 'exam', 'after_submit', false, false, null, null),
  ('de770000-0000-4000-8000-0000000000a5', 'de770000-0000-4000-8000-000000000032', null, 'Parcial B', 'exam', 'after_submit', false, true, now() - interval '1 hour', now() + interval '1 day'),
  ('de770000-0000-4000-8000-0000000000a6', 'de770000-0000-4000-8000-000000000031', null, 'Práctica PR', 'practice', 'after_submit', false, true, now() - interval '1 hour', now() + interval '1 day'),
  ('de770000-0000-4000-8000-0000000000a7', 'de770000-0000-4000-8000-000000000031', 'de770000-0000-4000-8000-000000000042', 'Parcial G2', 'exam', 'after_submit', false, true, now() - interval '1 hour', now() + interval '1 day'),
  ('de770000-0000-4000-8000-0000000000a8', 'de770000-0000-4000-8000-000000000031', null, 'Parcial Y', 'exam', 'after_submit', false, true, now() - interval '1 hour', now() + interval '1 day'),
  ('de770000-0000-4000-8000-0000000000a9', 'de770000-0000-4000-8000-000000000031', null, 'Parcial Z', 'exam', 'after_submit', false, true, now() - interval '1 hour', now() + interval '1 day'),
  ('de770000-0000-4000-8000-0000000000aa', 'de770000-0000-4000-8000-000000000031', null, 'Parcial C', 'exam', 'after_submit', false, true, now() - interval '2 days', now() - interval '1 day');
insert into public.activity_items (activity_id, exercise_id, position) values
  ('de770000-0000-4000-8000-0000000000a1', 'de770000-0000-4000-8000-0000000000e2', 1), ('de770000-0000-4000-8000-0000000000a1', 'de770000-0000-4000-8000-0000000000e3', 2),
  ('de770000-0000-4000-8000-0000000000a1', 'de770000-0000-4000-8000-0000000000e4', 3),
  ('de770000-0000-4000-8000-0000000000a2', 'de770000-0000-4000-8000-0000000000e5', 1),
  ('de770000-0000-4000-8000-0000000000a3', 'de770000-0000-4000-8000-0000000000e6', 1),
  ('de770000-0000-4000-8000-0000000000a4', 'de770000-0000-4000-8000-0000000000e7', 1),
  ('de770000-0000-4000-8000-0000000000a5', 'de770000-0000-4000-8000-0000000000e8', 1),
  ('de770000-0000-4000-8000-0000000000a6', 'de770000-0000-4000-8000-0000000000e9', 1),
  ('de770000-0000-4000-8000-0000000000a7', 'de770000-0000-4000-8000-0000000000ea', 1),
  ('de770000-0000-4000-8000-0000000000a8', 'de770000-0000-4000-8000-0000000000eb', 1), ('de770000-0000-4000-8000-0000000000a8', 'de770000-0000-4000-8000-0000000000ec', 2),
  ('de770000-0000-4000-8000-0000000000aa', 'de770000-0000-4000-8000-0000000000ee', 1);
insert into public.activity_items (activity_id, exercise_id, position)
  select 'de770000-0000-4000-8000-0000000000a9', ('de770000-0000-4000-8000-0000000002' || lpad(g::text, 2, '0'))::uuid, g from generate_series(1, 16) g;
insert into public.exam_settings (activity_id, presentacion, navegacion, duracion_s) values
  ('de770000-0000-4000-8000-0000000000a1', 'una_a_la_vez', 'libre', 1800),
  ('de770000-0000-4000-8000-0000000000a8', 'una_a_la_vez', 'solo_adelante', 60);

-- -----------------------------------------------------------------------------
-- Utilidades de la prueba (pg_temp: desaparecen con la sesión)
-- -----------------------------------------------------------------------------
-- Marcadores secretos que aparecen en un texto, salvo los permitidos
create function pg_temp.secretos(p_texto text, p_permitidos text[]) returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct m[1]), '{}')
  from regexp_matches(coalesce(p_texto, ''), '(RESERVADO-[A-Z0-9]+|CLAVE-SECRETA|PISTA-SECRETA|4242\.42)', 'g') m
  where not (m[1] = any (p_permitidos))
$$;

-- (a) Barrido de TODAS las tablas y vistas de public que authenticated puede leer
create function pg_temp.barrido_tablas(p_permitidos text[]) returns text[] language plpgsql as $$
declare t record; v text; fallos text[] := '{}';
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') and has_table_privilege('authenticated', c.oid, 'select')
  loop
    begin
      execute format('select string_agg(x::text, ''|'') from public.%I x', t.relname) into v;
    exception when insufficient_privilege then v := null;  -- privilegios por columna (p. ej. profiles): sin enunciados
    end;
    if cardinality(pg_temp.secretos(v, p_permitidos)) > 0 then fallos := fallos || (t.relname || ': ' || array_to_string(pg_temp.secretos(v, p_permitidos), ',')); end if;
  end loop;
  return fallos;
end $$;

-- (b) Barrido de TODAS las funciones de public ejecutables por authenticated: cada parámetro uuid recibe cada
-- identificador conocido (las de dos uuid, todos los pares), uuid[] un arreglo con él y el resto NULL. Cada llamada se
-- deshace (excepción forzada) y se examinan el resultado y el mensaje de error.
create function pg_temp.barrido_funciones(p_ids uuid[], p_permitidos text[]) returns text[] language plpgsql as $$
declare f record; c1 uuid; c2 uuid; v text; q text; args text; fallos text[] := '{}'; k integer; n_llamadas integer := 0;
begin
  for f in select p.oid, p.proname, p.pronargs,
                  coalesce((select array_agg(format_type(t, null) order by o) from unnest(p.proargtypes) with ordinality u(t, o)), '{}') tipos
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
             and has_function_privilege('authenticated', p.oid, 'execute')
  loop
    for c1 in select unnest(case when 'uuid' = any (f.tipos) or 'uuid[]' = any (f.tipos) then p_ids else array[null::uuid] end) loop
      for c2 in select unnest(case when f.pronargs = 2 and f.tipos = array['uuid', 'uuid'] then p_ids else array[c1] end) loop
        args := '';
        for k in 1 .. f.pronargs loop
          args := args || case when k > 1 then ', ' else '' end || case
            when f.tipos[k] = 'uuid' then quote_literal(case when k = 2 and f.tipos = array['uuid', 'uuid'] then c2 else c1 end) || '::uuid'
            when f.tipos[k] = 'uuid[]' then 'array[' || quote_literal(c1) || ']::uuid[]'
            else 'null::' || f.tipos[k] end;
        end loop;
        q := format('select string_agg(x::text, ''|'') from public.%I(%s) x', f.proname, args);
        n_llamadas := n_llamadas + 1;
        begin
          execute q into v;
          raise exception using errcode = 'P0099', message = 'deshacer', detail = coalesce(v, '');
        exception
          when sqlstate 'P0099' then get stacked diagnostics v = pg_exception_detail;
          when others then get stacked diagnostics v = message_text;
        end;
        if cardinality(pg_temp.secretos(v, p_permitidos)) > 0 then
          fallos := fallos || (f.proname || '(' || args || '): ' || array_to_string(pg_temp.secretos(v, p_permitidos), ','));
        end if;
      end loop;
    end loop;
  end loop;
  raise notice 'barrido de funciones: % llamadas', n_llamadas;
  return fallos;
end $$;

-- Identificadores conocidos por un atacante (o adivinables): actividades, ejercicios, secciones, curso, lección,
-- usuarios y grupos. Los intentos se añaden cuando existen.
create function pg_temp.ids() returns uuid[] language sql stable as $$
  select array_agg(x) from (
    select id x from public.activities where class_id::text like 'de770000-%'
    union select id from public.exercises where course_id = 'de770000-0000-4000-8000-000000000021'
    union select id from public.classes where id::text like 'de770000-%'
    union select id from public.class_groups where id::text like 'de770000-%'
    union select id from public.profiles where id::text like 'de770000-%'
    union values ('de770000-0000-4000-8000-000000000021'::uuid), ('de770000-0000-4000-8000-000000000023'::uuid)
    union select id from public.attempts where user_id::text like 'de770000-%'
  ) s
$$;

-- Como PostgREST: rol authenticated + JWT del usuario
create function pg_temp.como(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true)
$$;
grant execute on function pg_temp.secretos(text, text[]), pg_temp.barrido_tablas(text[]), pg_temp.barrido_funciones(uuid[], text[]),
  pg_temp.ids(), pg_temp.como(uuid) to authenticated;
select set_config('prueba.ids', pg_temp.ids()::text, true);

-- =============================================================================
-- 1) ESTUDIANTE ANTES DE EMPEZAR: ni REST, ni relaciones anidadas, ni RPC, ni tablas alternativas
-- =============================================================================
set local role authenticated;
select pg_temp.como('de770000-0000-4000-8000-000000000011');
do $$ declare n integer; v text; begin
  -- GET /rest/v1/activity_items  (incidente: devolvía los 11 ejercicios de la práctica)
  if exists (select 1 from public.activity_items) then raise exception 'FALLO: el estudiante lee activity_items'; end if;
  -- GET /rest/v1/exercises?select=id,prompt,options,figure,simulation  (incidente: devolvía el enunciado)
  select count(*) into n from public.exercises where course_id = 'de770000-0000-4000-8000-000000000021' and prompt like 'RESERVADO-%';
  if n > 0 then raise exception 'FALLO: el estudiante lee % enunciados reservados por REST', n; end if;
  -- GET /rest/v1/exercises?id=eq.<id conocido> (identificador obtenido por otra vía)
  if exists (select 1 from public.exercises where id in ('de770000-0000-4000-8000-0000000000e2', 'de770000-0000-4000-8000-0000000000e5', 'de770000-0000-4000-8000-0000000000e9', 'de770000-0000-4000-8000-0000000000ed')) then
    raise exception 'FALLO: lectura por identificador conocido'; end if;
  -- el catálogo público de estudio sigue legible
  if not exists (select 1 from public.exercises where id = 'de770000-0000-4000-8000-0000000000e1') then raise exception 'FALLO: el catálogo de la lección dejó de ser legible'; end if;
  -- GET /rest/v1/exercise_keys  y  GET /rest/v1/exercises?select=*,exercise_keys(*)
  if exists (select 1 from public.exercise_keys) then raise exception 'FALLO: el estudiante lee claves'; end if;
  select string_agg(row_to_json(r)::text, '|') into v from (
    select e.*, (select json_agg(k) from public.exercise_keys k where k.exercise_id = e.id) as exercise_keys from public.exercises e) r;
  if cardinality(pg_temp.secretos(v, '{}')) > 0 then raise exception 'FALLO: relación anidada exercises→exercise_keys: %', pg_temp.secretos(v, '{}'); end if;
  -- GET /rest/v1/activities?select=*,activity_items(*,exercises(*))
  select string_agg(row_to_json(r)::text, '|') into v from (
    select a.*, (select json_agg(json_build_object('item', i, 'exercises', (select row_to_json(e) from public.exercises e where e.id = i.exercise_id)))
                 from public.activity_items i where i.activity_id = a.id) as activity_items
    from public.activities a) r;
  if cardinality(pg_temp.secretos(v, '{}')) > 0 then raise exception 'FALLO: relación anidada activities→activity_items→exercises: %', pg_temp.secretos(v, '{}'); end if;
  if v not like '%Parcial X%' then raise exception 'FALLO: el estudiante dejó de ver la ficha de su evaluación'; end if;
  -- GET /rest/v1/exercises?select=*,activity_items(*)  (relación inversa)
  select string_agg(row_to_json(r)::text, '|') into v from (
    select e.id, (select json_agg(i) from public.activity_items i where i.exercise_id = e.id) as items from public.exercises e) r;
  if v like '%activity_id%' then raise exception 'FALLO: relación inversa exercises→activity_items'; end if;
  -- POST /rest/v1/rpc/exercise_in_open_activity: era un oráculo de composición
  begin perform public.exercise_in_open_activity('de770000-0000-4000-8000-0000000000e2'); raise exception 'FALLO: exercise_in_open_activity ejecutable';
  exception when insufficient_privilege then null; end;
  -- tablas alternativas con copias de contenido: sin privilegios
  begin perform 1 from public.control_items; raise exception 'FALLO: control_items legible'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.exam_adaptive_pool; raise exception 'FALLO: exam_adaptive_pool legible'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.attempt_item_orders; raise exception 'FALLO: attempt_item_orders legible'; exception when insufficient_privilege then null; end;
  if exists (select 1 from public.exercise_bank_meta) then raise exception 'FALLO: exercise_bank_meta legible'; end if;
end $$;
-- barridos genéricos antes de empezar: ningún marcador reservado en NINGUNA tabla ni función
do $$ declare f text[]; begin
  f := pg_temp.barrido_tablas('{}');
  if cardinality(f) > 0 then raise exception 'FALLO (barrido de tablas, antes de empezar): %', f; end if;
  f := pg_temp.barrido_funciones(current_setting('prueba.ids')::uuid[], '{}');
  if cardinality(f) > 0 then raise exception 'FALLO (barrido de funciones, antes de empezar): %', f; end if;
end $$;

-- =============================================================================
-- 2) ACTIVIDADES NO DISPONIBLES: futura, sin publicar, cerrada, de otra sección, de otro grupo
-- =============================================================================
do $$ declare a uuid; begin
  foreach a in array array['de770000-0000-4000-8000-0000000000a3', 'de770000-0000-4000-8000-0000000000a4', 'de770000-0000-4000-8000-0000000000aa',
                           'de770000-0000-4000-8000-0000000000a5', 'de770000-0000-4000-8000-0000000000a7']::uuid[] loop
    begin
      perform public.start_activity_attempt(a);
      raise exception 'FALLO: empezó la actividad no disponible %', a;
    exception when insufficient_privilege or raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
    end;
  end loop;
end $$;

-- =============================================================================
-- 3) EXAMEN «UNA A LA VEZ»: solo la pregunta autorizada por el servidor
-- =============================================================================
select set_config('prueba.tx', public.start_activity_attempt('de770000-0000-4000-8000-0000000000a1')::text, true);
do $$ declare v jsonb; begin
  -- recién creado el intento, antes de abrir la sesión: ninguna pregunta con contenido
  v := public.get_attempt(current_setting('prueba.tx')::uuid);
  if jsonb_array_length(v -> 'items') <> 3 then raise exception 'FALLO: el intento debe tener 3 posiciones'; end if;
  if cardinality(pg_temp.secretos(v::text, '{}')) > 0 then raise exception 'FALLO: get_attempt antes de exam_open: %', pg_temp.secretos(v::text, '{}'); end if;
  if not (v -> 'flags' ->> 'reservadas')::boolean then raise exception 'FALLO: bandera reservadas'; end if;
  -- abrir: el servidor autoriza la primera
  perform public.exam_open(current_setting('prueba.tx')::uuid);
  v := public.get_attempt(current_setting('prueba.tx')::uuid);
  if v -> 'items' -> 0 -> 'exercise' ->> 'prompt' <> 'RESERVADO-X1' then raise exception 'FALLO: no recibe la pregunta autorizada'; end if;
  if (v -> 'items' -> 0 -> 'exercise' -> 'figure' ->> 'alt') <> 'RESERVADO-X1-FIG' then raise exception 'FALLO: falta la figura de la pregunta autorizada'; end if;
  if pg_temp.secretos(v::text, '{}') <> '{RESERVADO-X1}' then raise exception 'FALLO: get_attempt entrega además %', pg_temp.secretos(v::text, '{RESERVADO-X1}'); end if;
  if (v -> 'items' -> 1 -> 'exercise' ->> 'oculto')::boolean is not true or v -> 'items' -> 1 -> 'exercise' ? 'options' then raise exception 'FALLO: el marcador lleva contenido'; end if;
  -- la pregunta futura sigue sin poder leerse por REST aunque se conozca su identificador
  if exists (select 1 from public.exercises where id = 'de770000-0000-4000-8000-0000000000e3') then raise exception 'FALLO: pregunta futura legible por REST'; end if;
  -- navegar (exam_goto) es lo que la autoriza
  perform public.exam_goto(current_setting('prueba.tx')::uuid, 'de770000-0000-4000-8000-0000000000e3');
  v := public.get_attempt(current_setting('prueba.tx')::uuid);
  if v -> 'items' -> 1 -> 'exercise' -> 'options' ->> 0 <> 'RESERVADO-X2-OPC-A' then raise exception 'FALLO: tras exam_goto no recibe la pregunta 2'; end if;
  if 'RESERVADO-X3' = any (pg_temp.secretos(v::text, '{}')) then raise exception 'FALLO: la pregunta 3 llegó sin autorizarse'; end if;
  -- una pregunta ajena al intento no se autoriza
  begin perform public.exam_goto(current_setting('prueba.tx')::uuid, 'de770000-0000-4000-8000-0000000000e5'); raise exception 'FALLO: exam_goto a una pregunta ajena';
  exception when insufficient_privilege then null; end;
  -- en evaluación no hay pistas ni solución
  begin perform public.get_hint(current_setting('prueba.tx')::uuid, 'de770000-0000-4000-8000-0000000000e2'); raise exception 'FALLO: pista en evaluación';
  exception when others then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.reveal_solution(current_setting('prueba.tx')::uuid, 'de770000-0000-4000-8000-0000000000e2'); raise exception 'FALLO: solución en evaluación';
  exception when others then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;

-- reconexión y reintentos: el mismo intento, el mismo progreso autorizado
do $$ declare v jsonb; t uuid; n integer; begin
  t := public.start_activity_attempt('de770000-0000-4000-8000-0000000000a1');
  if t <> current_setting('prueba.tx')::uuid then raise exception 'FALLO: la reconexión creó otro intento'; end if;
  perform public.exam_open(t); perform public.exam_open(t);
  v := public.get_attempt(t);
  select count(*) into n from jsonb_array_elements(v -> 'items') x where x -> 'exercise' ->> 'prompt' is not null;
  if n <> 2 then raise exception 'FALLO: tras reconectar hay % preguntas con contenido (deben ser 2)', n; end if;
  if (public.exam_open(t) ->> 'activa')::uuid <> 'de770000-0000-4000-8000-0000000000e3' then raise exception 'FALLO: la reconexión cambió la pregunta activa'; end if;
end $$;

-- clásica: al empezar recibe su pregunta (por RPC, no por REST)
select set_config('prueba.te', public.start_activity_attempt('de770000-0000-4000-8000-0000000000a2')::text, true);
do $$ declare v jsonb; begin
  v := public.get_attempt(current_setting('prueba.te')::uuid);
  if v -> 'items' -> 0 -> 'exercise' ->> 'prompt' <> 'RESERVADO-E1' then raise exception 'FALLO: la evaluación clásica no entrega su pregunta'; end if;
  if v -> 'items' -> 0 -> 'solution' <> 'null'::jsonb then raise exception 'FALLO: solución antes del cierre'; end if;
  if exists (select 1 from public.exercises where id = 'de770000-0000-4000-8000-0000000000e5') then raise exception 'FALLO: con intento, el enunciado se volvió legible por REST'; end if;
end $$;

-- barridos durante los intentos: solo X1, X2 (autorizadas) y E1 (clásica empezada). Los identificadores (incluidos los
-- intentos, que el estudiante no puede listar) se calculan sin RLS: el atacante podría conocerlos por otra vía.
reset role;
select set_config('prueba.ids', pg_temp.ids()::text, true);
do $$ begin
  if not current_setting('prueba.tx')::uuid = any (current_setting('prueba.ids')::uuid[]) then raise exception 'FALLO: el barrido no incluye los intentos'; end if;
end $$;
set local role authenticated;
do $$ declare f text[]; begin
  f := pg_temp.barrido_tablas('{}');
  if cardinality(f) > 0 then raise exception 'FALLO (barrido de tablas, durante): %', f; end if;
  f := pg_temp.barrido_funciones(current_setting('prueba.ids')::uuid[], '{RESERVADO-X1,RESERVADO-X2,RESERVADO-E1}');
  if cardinality(f) > 0 then raise exception 'FALLO (barrido de funciones, durante): %', f; end if;
end $$;

-- =============================================================================
-- 4) OTRO ESTUDIANTE / OTRA SECCIÓN: acceso denegado
-- =============================================================================
select pg_temp.como('de770000-0000-4000-8000-000000000013');
do $$ begin
  begin perform public.get_attempt(current_setting('prueba.tx')::uuid); raise exception 'FALLO: otra sección lee el intento';
  exception when insufficient_privilege then null; end;
  begin perform public.exam_goto(current_setting('prueba.tx')::uuid, 'de770000-0000-4000-8000-0000000000e4'); raise exception 'FALLO: otra sección navega el intento';
  exception when insufficient_privilege then null; end;
  begin perform public.start_activity_attempt('de770000-0000-4000-8000-0000000000a1'); raise exception 'FALLO: otra sección empezó';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.exercises where course_id = 'de770000-0000-4000-8000-000000000021' and prompt like 'RESERVADO-%') then raise exception 'FALLO: otra sección lee enunciados'; end if;
  -- su propia evaluación abierta: tampoco por REST antes de empezar
  if exists (select 1 from public.activity_items) or exists (select 1 from public.exercises where id = 'de770000-0000-4000-8000-0000000000e8') then
    raise exception 'FALLO: la sección B lee su evaluación por REST'; end if;
end $$;
select pg_temp.como('de770000-0000-4000-8000-000000000012');
do $$ begin
  begin perform public.get_attempt(current_setting('prueba.tx')::uuid); raise exception 'FALLO: un compañero lee el intento';
  exception when insufficient_privilege then null; end;
end $$;

-- =============================================================================
-- 5) INTENTO VENCIDO: no avanza ni recibe preguntas nuevas
-- =============================================================================
select pg_temp.como('de770000-0000-4000-8000-000000000011');
select set_config('prueba.ty', public.start_activity_attempt('de770000-0000-4000-8000-0000000000a8')::text, true);
select public.exam_open(current_setting('prueba.ty')::uuid) is not null;
reset role;
update public.attempts set started_at = now() - interval '5 minutes' where id = current_setting('prueba.ty')::uuid;   -- 1 min de duración: vencido
set local role authenticated;
do $$ declare v jsonb; begin
  if public.exam_open(current_setting('prueba.ty')::uuid) ->> 'estado' <> 'vencido' then raise exception 'FALLO: el intento debía estar vencido'; end if;
  begin perform public.exam_goto(current_setting('prueba.ty')::uuid, 'de770000-0000-4000-8000-0000000000ec'); raise exception 'FALLO: avanzó con el tiempo vencido';
  exception when raise_exception then if sqlerrm not like '%terminó%' then raise; end if; end;
  v := public.get_attempt(current_setting('prueba.ty')::uuid);
  if 'RESERVADO-Y2' = any (pg_temp.secretos(v::text, '{}')) then raise exception 'FALLO: el intento vencido recibió una pregunta nueva'; end if;
  if v -> 'items' -> 0 -> 'exercise' ->> 'prompt' <> 'RESERVADO-Y1' then raise exception 'FALLO: perdió la pregunta ya autorizada'; end if;
  begin perform public.exam_save(current_setting('prueba.ty')::uuid, 'de770000-0000-4000-8000-0000000000eb', '{"text":"1 m"}', 1); raise exception 'FALLO: guardó con el tiempo vencido';
  exception when others then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;

-- =============================================================================
-- 6) EXAMEN ADAPTATIVO: solo el ítem que eligió el motor del servidor
-- =============================================================================
select pg_temp.como('de770000-0000-4000-8000-000000000001');
select (public.exam_adaptive_save('de770000-0000-4000-8000-0000000000a9', '{"max_items":5,"min_items":3,"se_objetivo":0.2,"exposicion":1}') -> 'config' ->> 'max_items') = '5';
select pg_temp.como('de770000-0000-4000-8000-000000000011');
select set_config('prueba.tz', public.start_activity_attempt('de770000-0000-4000-8000-0000000000a9')::text, true);
do $$ declare v jsonb; begin
  v := public.get_attempt(current_setting('prueba.tz')::uuid);
  if jsonb_array_length(v -> 'items') <> 1 or cardinality(pg_temp.secretos(v::text, '{}')) > 0 then raise exception 'FALLO: adaptativo antes de abrir: %', v -> 'items'; end if;
  perform public.exam_open(current_setting('prueba.tz')::uuid);
  v := public.get_attempt(current_setting('prueba.tz')::uuid);
  if cardinality(pg_temp.secretos(v::text, '{}')) <> 1 or (v -> 'items' -> 0 -> 'exercise' ->> 'prompt') not like 'RESERVADO-Z%' then raise exception 'FALLO: adaptativo debe entregar exactamente 1 ítem'; end if;
  perform set_config('prueba.z1', v -> 'items' -> 0 -> 'exercise' ->> 'id', true);
  if exists (select 1 from public.exercises where prompt like 'RESERVADO-Z%') then raise exception 'FALLO: el banco adaptativo es legible por REST'; end if;
  -- adelantar el recorrido por RPC: una pregunta del banco no asignada se rechaza
  begin perform public.exam_goto(current_setting('prueba.tz')::uuid, 'de770000-0000-4000-8000-000000000216'); raise exception 'FALLO: adelantó el recorrido adaptativo';
  exception when insufficient_privilege then null; end;
end $$;
-- el motor (Edge Function con service_role) elige la siguiente
reset role;
set local role service_role;
select set_config('prueba.z2', public.svc_adaptativo_siguiente('de770000-0000-4000-8000-000000000011', current_setting('prueba.tz')::uuid,
  current_setting('prueba.z1')::uuid, jsonb_build_object(current_setting('prueba.z1'), 1)) ->> 'siguiente', true);
reset role;
set local role authenticated;
select pg_temp.como('de770000-0000-4000-8000-000000000011');
do $$ declare v jsonb; begin
  v := public.get_attempt(current_setting('prueba.tz')::uuid);
  if jsonb_array_length(v -> 'items') <> 2 then raise exception 'FALLO: tras la selección debe haber 2 ítems'; end if;
  if cardinality(pg_temp.secretos(v::text, '{}')) <> 1 then raise exception 'FALLO: el ítem seleccionado llegó antes de pasar a él'; end if;
  perform public.exam_goto(current_setting('prueba.tz')::uuid, current_setting('prueba.z2')::uuid);
  v := public.get_attempt(current_setting('prueba.tz')::uuid);
  if cardinality(pg_temp.secretos(v::text, '{}')) <> 2 then raise exception 'FALLO: adaptativo: debe ver exactamente los 2 ítems administrados'; end if;
  -- solo hacia adelante: no vuelve al primero
  begin perform public.exam_goto(current_setting('prueba.tz')::uuid, current_setting('prueba.z1')::uuid); raise exception 'FALLO: volvió atrás';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;

-- =============================================================================
-- 7) PRÁCTICA: la libre de la lección y la evaluada siguen funcionando
-- =============================================================================
do $$ declare t uuid; v jsonb; begin
  t := public.start_lesson_practice('de770000-0000-4000-8000-000000000023');
  v := public.get_attempt(t);
  if v -> 'items' -> 0 -> 'exercise' ->> 'prompt' <> 'PUBLICO-P1 ¿Cuánto?' then raise exception 'FALLO: la práctica de la lección no entrega su ejercicio'; end if;
  if v::text like '%RESERVADO-NOPUB%' then raise exception 'FALLO: ejercicio sin publicar en la práctica'; end if;
  perform public.save_response(t, 'de770000-0000-4000-8000-0000000000e1', '{"text":"3 m"}');
  if (public.get_hint(t, 'de770000-0000-4000-8000-0000000000e1') ->> 'hint') <> 'PISTA-SECRETA' then raise exception 'FALLO: la pista pedida en práctica libre'; end if;
  t := public.start_activity_attempt('de770000-0000-4000-8000-0000000000a6');
  v := public.get_attempt(t);
  if v -> 'items' -> 0 -> 'exercise' ->> 'prompt' <> 'RESERVADO-PR1' or (v -> 'flags' ->> 'reservadas')::boolean then raise exception 'FALLO: la práctica evaluada no entrega sus ejercicios'; end if;
  perform public.save_response(t, 'de770000-0000-4000-8000-0000000000e9', '{"text":"3 m"}');
end $$;

-- =============================================================================
-- 8) ENTREGADO CON LA EVALUACIÓN ABIERTA: lo no abierto sigue reservado hasta el cierre
-- =============================================================================
reset role;
update public.attempts set status = 'submitted', submitted_at = now() where id = current_setting('prueba.tx')::uuid;   -- lo que hace la Edge Function
set local role authenticated;
do $$ declare v jsonb; begin
  v := public.get_attempt(current_setting('prueba.tx')::uuid);
  if 'RESERVADO-X3' = any (pg_temp.secretos(v::text, '{}')) then raise exception 'FALLO: tras entregar recibió la pregunta que nunca abrió (evaluación abierta)'; end if;
  begin perform public.exam_goto(current_setting('prueba.tx')::uuid, 'de770000-0000-4000-8000-0000000000e4'); raise exception 'FALLO: navegó un intento entregado';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
reset role;
update public.activities set closes_at = now() - interval '1 minute' where id = 'de770000-0000-4000-8000-0000000000a1';
set local role authenticated;
do $$ begin
  if public.get_attempt(current_setting('prueba.tx')::uuid)::text not like '%RESERVADO-X3%' then raise exception 'FALLO: tras el cierre la revisión debe mostrar todas las preguntas'; end if;
end $$;
reset role;
update public.activities set closes_at = now() + interval '1 day' where id = 'de770000-0000-4000-8000-0000000000a1';

-- =============================================================================
-- 9) PROFESORADO: conserva sus permisos
-- =============================================================================
set local role authenticated;
select pg_temp.como('de770000-0000-4000-8000-000000000001');
do $$ declare v jsonb; n integer; begin
  select count(*) into n from public.activity_items where activity_id = 'de770000-0000-4000-8000-0000000000a1';
  if n <> 3 then raise exception 'FALLO: el profesor no ve la composición de su evaluación (%)', n; end if;
  if not exists (select 1 from public.exercises where id = 'de770000-0000-4000-8000-0000000000e7') then raise exception 'FALLO: el profesor no ve su banco'; end if;
  if not exists (select 1 from public.exercise_keys where exercise_id = 'de770000-0000-4000-8000-0000000000e2') then raise exception 'FALLO: el profesor no ve las claves de su curso'; end if;
  -- relación anidada del panel docente
  select count(*) into n from public.activity_items i join public.exercises e on e.id = i.exercise_id where i.activity_id = 'de770000-0000-4000-8000-0000000000a1';
  if n <> 3 then raise exception 'FALLO: activity_items→exercises para el profesor'; end if;
  -- revisa el intento completo, aunque el estudiante no haya abierto todas
  v := public.get_attempt(current_setting('prueba.ty')::uuid);
  if v::text not like '%RESERVADO-Y2%' or (v -> 'flags' ->> 'reservadas')::boolean then raise exception 'FALLO: el profesor no ve el intento completo'; end if;
  -- no ve la composición de la otra sección
  if exists (select 1 from public.activity_items where activity_id = 'de770000-0000-4000-8000-0000000000a5') then raise exception 'FALLO: profesor de A ve la composición de B'; end if;
  -- administra: edita la composición y el enunciado
  update public.activity_items set points = 2 where activity_id = 'de770000-0000-4000-8000-0000000000a4' and exercise_id = 'de770000-0000-4000-8000-0000000000e7';
  if not found then raise exception 'FALLO: el profesor no edita la composición'; end if;
  update public.exercises set prompt = 'RESERVADO-U1 (editado)' where id = 'de770000-0000-4000-8000-0000000000e7';
  if not found then raise exception 'FALLO: el profesor no edita su banco'; end if;
  insert into public.activity_items (activity_id, exercise_id, position) values ('de770000-0000-4000-8000-0000000000a4', 'de770000-0000-4000-8000-0000000000e6', 2);
end $$;
select pg_temp.como('de770000-0000-4000-8000-000000000002');
do $$ begin
  if not exists (select 1 from public.activity_items where activity_id = 'de770000-0000-4000-8000-0000000000a5') then raise exception 'FALLO: profesor de B no ve su composición'; end if;
end $$;
reset role;

select 'reserva_enunciados.sql: PRUEBAS PASARON' as resultado;
rollback;
