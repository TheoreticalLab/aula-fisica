-- Pruebas: Maratón — jornadas a elegir dentro de un plazo (migración 106). Se deshace al final.
-- Banco sintético: 2 temas × 9 niveles × 10 variantes. Profesor T; estudiantes S1…S6 en la sección A.
-- Maratón M: 5 días, 3 jornadas requeridas, hoy es el día 3. Maratón F: el mismo, con el plazo ya terminado.
-- Maratón O: ordinario (sin «requeridas»), para comprobar que la continuidad de siempre no cambia.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('de106000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'j' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k = 1 then '{"login_id":"prof-je","aula_role":"teacher"}' else json_build_object('login_id', 'sint-je-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 11, 12, 13, 14, 15, 16, 17]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'de106000-%';
update public.profiles set role = 'teacher' where id = 'de106000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de106000-0000-4000-8000-000000000021', 'Curso de prueba JE');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de106000-0000-4000-8000-000000000031', 'de106000-0000-4000-8000-000000000021', 'Sección A', 'JORELE01', 'de106000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('de106000-0000-4000-8000-000000000031', 'de106000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'de106000-0000-4000-8000-000000000031', ('de106000-0000-4000-8000-0000000000' || k)::uuid from generate_series(11, 17) k;

insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-je', 'Banco de prueba', array['de106000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values
  ('prueba-je', 'pa', 'Tema A', 'alta', 'verificado', 1), ('prueba-je', 'pb', 'Tema B', 'alta', 'verificado', 2);
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'je.' || t || '.d' || n, 'prueba-je', t, n, 'Plantilla ' || t || n, 60, 3000, 'validada'
  from unnest(array['pa', 'pb']) t cross join generate_series(1, 9) n;
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id || ' variante ' || v, '[{"etiqueta":"v","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 10) v where p.banco_id = 'prueba-je';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', 'solución' from public.maraton_variantes where plantilla_id like 'je.%';
insert into public.maraton_etapas (variante_id, numero, tipo, enunciado, partes)
  select v.id, e, 'etapa', 'Etapa ' || e || ' de ' || v.id, '[{"etiqueta":"E","unidad":"J"}]'
  from public.maraton_variantes v join public.maraton_plantillas p on p.id = v.plantilla_id cross join generate_series(2, 3) e
  where p.banco_id = 'prueba-je' and p.nivel > 6;
insert into public.maraton_etapas_claves (variante_id, numero, clave)
  select variante_id, numero, '{"partes":[{"format":"numeric","value":"1.414"}]}' from public.maraton_etapas where variante_id like 'je.%';

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns uuid language sql as $$ select ('de106000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid $$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Santo_Domingo')::date $$;
create function pg_temp.insc(p_m uuid, p_u uuid) returns public.maraton_inscripciones language sql as $$
  select * from public.maraton_inscripciones where maraton_id = p_m and user_id = p_u
$$;
-- inscripción aceptada y jornadas pasadas con el estado dado (dia → estado), como si se hubieran hecho esos días
create function pg_temp.historia(p_m uuid, p_u uuid, p_dias jsonb) returns void language plpgsql as $$
declare i uuid; f date; k text; begin
  insert into public.maraton_inscripciones (maraton_id, user_id, nivel, aceptado_at) values (p_m, p_u, 2, now() - interval '3 days')
  on conflict (maraton_id, user_id) do nothing;
  select id into i from public.maraton_inscripciones where maraton_id = p_m and user_id = p_u;
  select fecha_inicio into f from public.maraton_actividades where id = p_m;
  for k in select jsonb_object_keys(p_dias) loop
    insert into public.maraton_jornadas (inscripcion_id, maraton_id, numero, fecha, estado, iniciada_at, cerrada_at)
    values (i, p_m, k::int, f + (k::int - 1), p_dias ->> k, (f + (k::int - 1))::timestamp + interval '15 hours',
            case when p_dias ->> k <> 'en_curso' then (f + (k::int - 1))::timestamp + interval '17 hours' end);
  end loop;
end $$;
create temp table ids (nombre text primary key, id uuid);
grant all on ids to authenticated;

-- 1) Creación y publicación (como profesor); la clave se valida
set local role authenticated;
select pg_temp.como('de106000-0000-4000-8000-000000000001');
do $$ declare v uuid; n text; begin
  foreach n in array array['M', 'F'] loop
    v := public.maraton_crear('de106000-0000-4000-8000-000000000031',
           '{"titulo":"JE","config":{"programacion":{"jornadas":5,"requeridas":3},"avanzado":{"comprobacion_porcentaje":0,"comprobacion_tras_anticipada":0}}}');
    insert into ids values (n, v);
    perform public.maraton_guardar(v, jsonb_build_object('fecha_inicio', pg_temp.hoy()));
    perform public.maraton_cambiar_estado(v, 'publicado');
  end loop;
  v := public.maraton_crear('de106000-0000-4000-8000-000000000031', '{"titulo":"Ordinario","config":{"programacion":{"jornadas":5}}}');
  insert into ids values ('O', v);
  perform public.maraton_guardar(v, jsonb_build_object('fecha_inicio', pg_temp.hoy()));
  perform public.maraton_cambiar_estado(v, 'publicado');
  begin
    perform public.maraton_crear('de106000-0000-4000-8000-000000000031', '{"titulo":"Mal","config":{"programacion":{"jornadas":5,"requeridas":6}}}');
    raise exception 'FALLO: aceptó 6 jornadas requeridas de 5';
  exception when sqlstate 'P0001' then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
  begin
    perform public.maraton_crear('de106000-0000-4000-8000-000000000031', '{"titulo":"Mal","config":{"programacion":{"jornadas":5,"requeridas":"tres"}}}');
    raise exception 'FALLO: aceptó requeridas no numérica';
  exception when sqlstate 'P0001' then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;
reset role;

-- hoy es el día 3 de M y de O; el plazo de F terminó ayer
update public.maraton_actividades set fecha_inicio = pg_temp.hoy() - 2 where id in (select id from ids where nombre in ('M', 'O'));
update public.maraton_actividades set fecha_inicio = pg_temp.hoy() - 5 where id = (select id from ids where nombre = 'F');

select pg_temp.historia((select id from ids where nombre = 'M'), pg_temp.u(11), '{"1":"completada"}');
select pg_temp.historia((select id from ids where nombre = 'M'), pg_temp.u(12), '{"1":"completada","2":"completada"}');
select pg_temp.historia((select id from ids where nombre = 'M'), pg_temp.u(13), '{"1":"en_curso"}');
select pg_temp.historia((select id from ids where nombre = 'F'), pg_temp.u(15), '{"1":"completada","3":"completada"}');
select pg_temp.historia((select id from ids where nombre = 'F'), pg_temp.u(16), '{"1":"completada","2":"completada","4":"completada"}');
select pg_temp.historia((select id from ids where nombre = 'O'), pg_temp.u(17), '{"2":"completada"}');

-- 2) S1 se saltó el día 2: sigue dentro; hoy hace su 2.ª jornada (de 3)
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(11); s jsonb; begin
  perform pg_temp.como(u::text);
  s := public.maraton_estado(m);
  if s -> 'fuera' <> 'null'::jsonb or s -> 'hoy' ->> 'fase' <> 'abierta' or (s -> 'hoy' ->> 'numero')::int <> 2 or (s -> 'hoy' ->> 'dia')::int <> 3
     or (s -> 'maraton' ->> 'jornadas')::int <> 3 or (s -> 'maraton' ->> 'dias')::int <> 5 or (s ->> 'finalizado')::boolean then
    raise exception 'FALLO: estado de S1 antes de empezar: %', s; end if;
  s := public.maraton_iniciar(m);
  if s -> 'problema' = 'null'::jsonb or (s -> 'jornada' ->> 'numero')::int <> 2 or s -> 'jornada' ->> 'estado' <> 'en_curso' then
    raise exception 'FALLO: S1 no empezó su 2.ª jornada: %', s; end if;
  if not exists (select 1 from public.maraton_jornadas where inscripcion_id = (pg_temp.insc(m, u)).id and numero = 3 and fecha = pg_temp.hoy()) then
    raise exception 'FALLO: la jornada de hoy no quedó como día 3'; end if;
  s := public.maraton_mis_maratones();
  if (select count(*) from jsonb_array_elements(s) x where x ->> 'id' = m::text and (x ->> 'jornadas')::int = 3
        and (x -> 'hoy' ->> 'numero')::int = 2 and x ->> 'jornada_hoy' = 'en_curso') <> 1 then
    raise exception 'FALLO: mis maratones de S1: %', s; end if;
end $$;

-- 3) S2: hoy completa la 3.ª → el maratón termina para S2 (no se abre otra jornada, ni mañana)
select pg_temp.historia((select id from ids where nombre = 'M'), pg_temp.u(12), jsonb_build_object('3', 'completada'));
update public.maraton_jornadas set fecha = pg_temp.hoy() where numero = 3 and inscripcion_id = (pg_temp.insc((select id from ids where nombre = 'M'), pg_temp.u(12))).id;
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(12); s jsonb; n integer; begin
  perform pg_temp.como(u::text);
  s := public.maraton_iniciar(m);
  if not (s ->> 'finalizado')::boolean or s -> 'hoy' ->> 'fase' <> 'finalizado' or not (s -> 'hoy' ->> 'terminado')::boolean
     or s -> 'problema' <> 'null'::jsonb or s -> 'fuera' <> 'null'::jsonb then
    raise exception 'FALLO: S2 con 3 jornadas no terminó: %', s; end if;
  if (s -> 'jornada' ->> 'numero')::int <> 3 then raise exception 'FALLO: S2 debería ver su 3.ª jornada: %', s -> 'jornada'; end if;
  select count(*) into n from public.maraton_jornadas where inscripcion_id = (pg_temp.insc(m, u)).id;
  if n <> 3 then raise exception 'FALLO: se abrió otra jornada a S2 (%)', n; end if;
  -- mañana (día 4) tampoco se le abre
  perform set_config('request.jwt.claims', '', true);
end $$;
update public.maraton_actividades set fecha_inicio = fecha_inicio - 1 where id = (select id from ids where nombre = 'M');
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(12); s jsonb; begin
  perform pg_temp.como(u::text);
  s := public.maraton_iniciar(m);
  if not (s ->> 'finalizado')::boolean or s -> 'problema' <> 'null'::jsonb
     or (select count(*) from public.maraton_jornadas where inscripcion_id = (pg_temp.insc(m, u)).id) <> 3 then
    raise exception 'FALLO: al día siguiente se abrió otra jornada a S2: %', s; end if;
end $$;
update public.maraton_actividades set fecha_inicio = fecha_inicio + 1 where id = (select id from ids where nombre = 'M');

-- 4) S3 empezó una jornada y no la completó: queda fuera, como en FG1 (y el motivo usa su numeración)
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(13); s jsonb; begin
  perform pg_temp.como(u::text);
  s := public.maraton_estado(m);
  if s -> 'fuera' = 'null'::jsonb or s -> 'fuera' ->> 'tipo' <> 'continuidad' or (s -> 'fuera' ->> 'jornada')::int <> 1 then
    raise exception 'FALLO: S3 debería estar fuera por continuidad: %', s -> 'fuera'; end if;
  if (pg_temp.insc(m, u)).fuera_motivo not like 'No completó la jornada 1 (quedó incompleta)%' then
    raise exception 'FALLO: motivo de S3: %', (pg_temp.insc(m, u)).fuera_motivo; end if;
end $$;

-- 5) S4 no ha hecho ninguna jornada en dos días: sigue dentro y puede empezar hoy su 1.ª
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(14); s jsonb; begin
  perform pg_temp.como(u::text);
  s := public.maraton_iniciar(m);
  if s -> 'fuera' <> 'null'::jsonb or (s -> 'jornada' ->> 'numero')::int <> 1 or s -> 'problema' = 'null'::jsonb then
    raise exception 'FALLO: S4 no pudo empezar su 1.ª jornada el día 3: %', s; end if;
end $$;

-- 6) Plazo terminado (F): S5 con 2 de 3 queda fuera; S6 con 3 de 3 terminó; el resumen del profesor lo anticipa
do $$ declare f uuid := (select id from ids where nombre = 'F'); s jsonb; r jsonb; begin
  perform pg_temp.como(pg_temp.u(1)::text);
  r := public.maraton_resumen(f);
  if (select (x ->> 'continuidad_pendiente')::int from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'user_id' = pg_temp.u(15)::text) is distinct from 5
     or (select x ->> 'continuidad_pendiente' from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'user_id' = pg_temp.u(16)::text) is not null then
    raise exception 'FALLO: continuidad pendiente en el resumen: %', r -> 'estudiantes'; end if;
  perform pg_temp.como(pg_temp.u(15)::text);
  s := public.maraton_estado(f);
  if s -> 'fuera' = 'null'::jsonb or (pg_temp.insc(f, pg_temp.u(15))).fuera_motivo not like 'Completó 2 de las 3 jornadas requeridas%' then
    raise exception 'FALLO: S5 debería estar fuera (2 de 3): % / %', s -> 'fuera', (pg_temp.insc(f, pg_temp.u(15))).fuera_motivo; end if;
  perform pg_temp.como(pg_temp.u(16)::text);
  s := public.maraton_estado(f);
  if s -> 'fuera' <> 'null'::jsonb or not (s ->> 'finalizado')::boolean then raise exception 'FALLO: S6 (3 de 3): %', s; end if;
end $$;

-- 7) Resumen del profesor en M: S1 y S4 sin continuidad pendiente aunque se saltaron días
do $$ declare m uuid := (select id from ids where nombre = 'M'); r jsonb; begin
  perform pg_temp.como(pg_temp.u(1)::text);
  r := public.maraton_resumen(m);
  if exists (select 1 from jsonb_array_elements(r -> 'estudiantes') x
             where x ->> 'user_id' in (pg_temp.u(11)::text, pg_temp.u(14)::text) and x ->> 'continuidad_pendiente' is not null) then
    raise exception 'FALLO: día saltado tomado como incumplimiento: %', r -> 'estudiantes'; end if;
end $$;

-- 8) Maratón ordinario: saltarse un día sigue dejando fuera (comportamiento de siempre)
do $$ declare o uuid := (select id from ids where nombre = 'O'); s jsonb; begin
  perform pg_temp.como(pg_temp.u(17)::text);
  s := public.maraton_estado(o);
  if s -> 'fuera' = 'null'::jsonb or (pg_temp.insc(o, pg_temp.u(17))).fuera_motivo not like 'No completó la jornada 1 (no la inició)%'
     or (s -> 'maraton' ->> 'jornadas')::int <> 5 or s -> 'maraton' -> 'dias' <> 'null'::jsonb then
    raise exception 'FALLO: el maratón ordinario cambió: % / %', s, (pg_temp.insc(o, pg_temp.u(17))).fuera_motivo; end if;
end $$;

-- 9) Permisos de las funciones nuevas
do $$ begin
  if has_function_privilege('authenticated', 'public.maraton_hoy_insc(public.maraton_actividades, uuid)', 'execute')
     or has_function_privilege('anon', 'public.maraton_continuidad_falla(public.maraton_actividades, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.maraton_continuidad_falla(public.maraton_actividades, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.maraton_requeridas(public.maraton_actividades)', 'execute')
     or has_function_privilege('authenticated', 'public.maraton_estado_json(public.maraton_actividades, uuid, text, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.maraton_mis_maratones()', 'execute')
     or has_function_privilege('anon', 'public.maraton_mis_maratones()', 'execute') then
    raise exception 'FALLO: permisos';
  end if;
end $$;

select 'MARATÓN JORNADAS A ELEGIR: PRUEBAS PASARON' as resultado;
rollback;
