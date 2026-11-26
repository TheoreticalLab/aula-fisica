-- Pruebas: Maratón de jornada fija (migración 111): N problemas por día, niveles en secuencia, puntuación y apartado
-- teórico tras «No puedo». Se deshace al final.
-- Banco sintético SOLO D2–D3 (2 temas × 2 niveles × 30 variantes). Profesor T; estudiantes S1…S3 en la sección A.
-- Maratón M: 5 jornadas desde hoy, 10 problemas por jornada, secuencia [2, 3], 12 puntos, teoría, sin comodines.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('de111000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'jf' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k = 1 then '{"login_id":"prof-jf","aula_role":"teacher"}' else json_build_object('login_id', 'sint-jf-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 11, 12, 13]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'de111000-%';
update public.profiles set role = 'teacher' where id = 'de111000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de111000-0000-4000-8000-000000000021', 'Curso de prueba JF');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de111000-0000-4000-8000-000000000031', 'de111000-0000-4000-8000-000000000021', 'Sección A', 'JORFIJ01', 'de111000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('de111000-0000-4000-8000-000000000031', 'de111000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'de111000-0000-4000-8000-000000000031', ('de111000-0000-4000-8000-0000000000' || k)::uuid from generate_series(11, 13) k;

insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-jf', 'Banco de prueba JF', array['de111000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values
  ('prueba-jf', 'pa', 'Tema A', 'alta', 'verificado', 1), ('prueba-jf', 'pb', 'Tema B', 'alta', 'verificado', 2);
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'jf.' || t || '.d' || n, 'prueba-jf', t, n, 'Plantilla ' || t || n, 120, 900, 'validada'
  from unnest(array['pa', 'pb']) t cross join generate_series(2, 3) n;
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id || ' variante ' || v, '[{"etiqueta":"v","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 30) v where p.banco_id = 'prueba-jf';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', '**Paso 1.** Solución de ' || id from public.maraton_variantes where plantilla_id like 'jf.%';

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns uuid language sql as $$ select ('de111000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid $$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Santo_Domingo')::date $$;
create temp table ids (nombre text primary key, id uuid);
grant all on ids to authenticated;

-- 1) Creación, validación de las claves nuevas y publicación (la revisión no exige D1 con secuencia [2, 3])
set local role authenticated;
select pg_temp.como('de111000-0000-4000-8000-000000000001');
do $$ declare v uuid; r jsonb; begin
  v := public.maraton_crear('de111000-0000-4000-8000-000000000031', $j${"titulo":"JF","config":{
    "programacion":{"jornadas":5},
    "carga":{"problemas_jornada":10,"puntos_total":12,"alternativa_activa":false,"intentos_max":10,"presentados_max":10,"minutos_minimos":0,"limite_minutos":600},
    "permanencia":{"min_correctas":0,"fuera_por_presentados":false,"fuera_por_continuidad":false,"fuera_rapido_nivel":null},
    "avanzado":{"activo":false,"comprobacion_porcentaje":0,"comprobacion_tras_anticipada":0},
    "dificultad":{"adaptativa":false,"nivel_inicial":2,"secuencia":[2,3]},
    "comodines":{"total":0,"no_puedo":true},
    "contenido":{"teoria":"## Teoría\n\n$e = v'/v$"},
    "seguridad":{"retroalimentacion":"correcto_incorrecto"}}}$j$::jsonb);
  insert into ids values ('M', v);
  perform public.maraton_guardar(v, jsonb_build_object('fecha_inicio', pg_temp.hoy(),
    'instrucciones', 'Instrucciones de prueba suficientemente largas para la revisión del maratón de jornada fija.'));
  -- «Publicar» pasa por maraton_revision: fallaría si exigiera problemas D1 (el banco solo tiene D2–D3)
  perform public.maraton_cambiar_estado(v, 'publicado');
  -- claves mal escritas: se rechazan
  begin
    perform public.maraton_crear('de111000-0000-4000-8000-000000000031', '{"titulo":"Mal","config":{"carga":{"problemas_jornada":0}}}');
    raise exception 'FALLO: aceptó 0 problemas por jornada';
  exception when sqlstate 'P0001' then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  begin
    perform public.maraton_crear('de111000-0000-4000-8000-000000000031', '{"titulo":"Mal","config":{"dificultad":{"secuencia":[2,10]}}}');
    raise exception 'FALLO: aceptó un nivel 10 en la secuencia';
  exception when sqlstate 'P0001' then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  begin
    perform public.maraton_crear('de111000-0000-4000-8000-000000000031', '{"titulo":"Mal","config":{"carga":{"puntos_total":12}}}');
    raise exception 'FALLO: aceptó puntos sin problemas por jornada';
  exception when sqlstate 'P0001' then if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;

-- 2) Estudiante S1: la jornada alterna D2, D3, D2, D3… y termina exactamente al cerrar el problema 10
--    (7 bien, 2 mal, 1 «No puedo»): 7 × 0.24 = 1.68 puntos; el estado nunca trae niveles ni claves
select pg_temp.como('de111000-0000-4000-8000-000000000011');
do $$ declare m uuid := (select id from ids where nombre = 'M'); s jsonb; k integer; p uuid; v_niv integer[] := '{}'; v_np uuid; t jsonb; begin
  s := public.maraton_iniciar(m);
  if s -> 'maraton' ->> 'problemas_jornada' <> '10' then raise exception 'FALLO: problemas_jornada %', s -> 'maraton' ->> 'problemas_jornada'; end if;
  if (s -> 'maraton' -> 'puntos' ->> 'por_problema')::numeric <> 0.24 then raise exception 'FALLO: puntos por problema %', s -> 'maraton' -> 'puntos'; end if;
  if (s -> 'maraton' ->> 'teoria')::boolean is not true then raise exception 'FALLO: no anuncia la teoría'; end if;
  if s::text ~ '"nivel"|7\.77|Solución de' then raise exception 'FALLO: el estado expone nivel o clave: %', s; end if;
  for k in 1 .. 10 loop
    if s -> 'problema' is null or s -> 'problema' = 'null'::jsonb then raise exception 'FALLO: sin problema en el paso %', k; end if;
    if (s -> 'problema' ->> 'numero')::int <> k then raise exception 'FALLO: el problema % se numera %', k, s -> 'problema' ->> 'numero'; end if;
    if (s -> 'jornada' ->> 'cerrados')::int <> k - 1 then raise exception 'FALLO: cerrados % en el paso %', s -> 'jornada' ->> 'cerrados', k; end if;
    p := (s -> 'problema' ->> 'presentacion_id')::uuid;
    reset role;
    v_niv := v_niv || (select nivel::int from public.maraton_presentaciones where id = p);
    if k = 4 then
      set local role authenticated;
      perform pg_temp.como('de111000-0000-4000-8000-000000000011');
      -- la teoría no da la solución del problema abierto
      begin
        perform public.maraton_teoria(m, p);
        raise exception 'FALLO: dio la solución del problema abierto';
      exception when sqlstate '42501' then null;
      end;
      s := public.maraton_no_puedo(p, gen_random_uuid(), 30, null);
      v_np := p;
    else
      s := public.svc_maraton_responder(pg_temp.u(11), p, gen_random_uuid(), '{"partes":["7.77 m/s"]}', null, 200, k not in (2, 7), null);
      set local role authenticated;
      perform pg_temp.como('de111000-0000-4000-8000-000000000011');
    end if;
  end loop;
  if v_niv <> '{2,3,2,3,2,3,2,3,2,3}'::int[] then raise exception 'FALLO: secuencia de niveles %', v_niv; end if;
  if s -> 'jornada' ->> 'estado' <> 'completada' then raise exception 'FALLO: la jornada no se completó: %', s -> 'jornada'; end if;
  if s -> 'problema' <> 'null'::jsonb and s -> 'problema' is not null then raise exception 'FALLO: presentó un problema 11'; end if;
  if (s -> 'jornada' ->> 'correctas')::int <> 7 or (s -> 'jornada' ->> 'puntos')::numeric <> 1.68 then raise exception 'FALLO: puntos del día %', s -> 'jornada'; end if;
  if (s -> 'puntos' ->> 'acumulado')::numeric <> 1.68 or (s -> 'puntos' ->> 'maximo')::numeric <> 12 then raise exception 'FALLO: acumulado %', s -> 'puntos'; end if;
  if s -> 'fuera' is not null and s -> 'fuera' <> 'null'::jsonb then raise exception 'FALLO: quedó fuera'; end if;
  -- apartado teórico: la teoría y el problema 4 resuelto
  t := public.maraton_teoria(m, v_np);
  if t ->> 'teoria' not like '## Teoría%' then raise exception 'FALLO: teoría %', t ->> 'teoria'; end if;
  if jsonb_array_length(t -> 'resueltos') <> 1 or (t -> 'resueltos' -> 0 ->> 'numero')::int <> 4
     or t -> 'resueltos' -> 0 ->> 'solucion' not like '**Paso 1.**%' then raise exception 'FALLO: resueltos %', t -> 'resueltos'; end if;
  -- volver a iniciar el mismo día no abre otra jornada ni otro problema
  s := public.maraton_iniciar(m);
  if s -> 'problema' <> 'null'::jsonb and s -> 'problema' is not null then raise exception 'FALLO: reabrió la jornada completada'; end if;
end $$;
reset role;
do $$ declare j record; begin
  select * into j from public.maraton_jornadas where inscripcion_id = (select id from public.maraton_inscripciones
    where maraton_id = (select id from ids where nombre = 'M') and user_id = pg_temp.u(11));
  if j.via <> 'problemas' or j.presentados <> 10 or j.correctas <> 7 or j.incorrectas <> 2 or j.no_puedo <> 1 then
    raise exception 'FALLO: jornada registrada %', row_to_json(j); end if;
end $$;

-- 3) Otro estudiante no puede ver la teoría con un problema ajeno; sin argumento ve la teoría y nada resuelto
set local role authenticated;
select pg_temp.como('de111000-0000-4000-8000-000000000012');
do $$ declare m uuid := (select id from ids where nombre = 'M'); p uuid; t jsonb; begin
  reset role;
  select x.id into p from public.maraton_presentaciones x join public.maraton_inscripciones i on i.id = x.inscripcion_id
   where i.user_id = pg_temp.u(11) and x.accion = 'no_puedo';
  set local role authenticated;
  perform pg_temp.como('de111000-0000-4000-8000-000000000012');
  begin
    perform public.maraton_teoria(m, p);
    raise exception 'FALLO: vio la solución de otro estudiante';
  exception when sqlstate '42501' then null;
  end;
  t := public.maraton_teoria(m, null);
  if jsonb_array_length(t -> 'resueltos') <> 0 then raise exception 'FALLO: resueltos ajenos %', t -> 'resueltos'; end if;
end $$;

-- 4) Un maratón ordinario (sin las claves nuevas) sigue igual: su estado no trae puntos ni problemas_jornada
select pg_temp.como('de111000-0000-4000-8000-000000000001');
do $$ declare v uuid; s jsonb; begin
  v := public.maraton_crear('de111000-0000-4000-8000-000000000031', '{"titulo":"Ordinario","config":{"programacion":{"jornadas":5},"dificultad":{"niveles":3,"nivel_inicial":2}}}');
  s := public.maraton_estado(v);
  if s -> 'maraton' -> 'problemas_jornada' <> 'null'::jsonb or s -> 'maraton' -> 'puntos' <> 'null'::jsonb or (s -> 'maraton' ->> 'teoria')::boolean then
    raise exception 'FALLO: el maratón ordinario anuncia jornada fija: %', s -> 'maraton'; end if;
  begin
    perform public.maraton_teoria(v, null);
    raise exception 'FALLO: dio teoría en un maratón sin teoría';
  exception when sqlstate 'P0001' then if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;
reset role;

rollback;
select 'MARATÓN JORNADA FIJA: PRUEBAS PASARON' as resultado;
