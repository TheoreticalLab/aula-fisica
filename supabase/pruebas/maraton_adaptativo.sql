-- Pruebas: Maratón adaptativo (migración 94). Se deshace al final.
-- Banco sintético «prueba-maraton» (2 temas verificados × 6 niveles × 6 variantes; 1 tema excluido; 1 plantilla pendiente).
-- Profesor T (secciones A y B), T2 (solo B), T3 (otra asignatura). Estudiantes S1, S2 (A), S3 (B).
-- Maratones en A: M (predeterminado), M2 (nivel inicial D6, 2 comodines), M3 (predeterminado), M4 (límite 30 min),
-- M5 (máx. 3 intentos), M6 (cuota 1, 14 jornadas).
-- Todos fijan la regla de la migración 94 (incorrecta = correcta, sin tiempo mínimo de jornada, sin reglas de
-- permanencia); las de las migraciones 97 y 98 se prueban en maraton_fallo_tiempo_minimo.sql y maraton_permanencia.sql.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de940000-0000-4000-8000-000000000001', 'm1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-maraton","aula_role":"teacher"}', '{}', now(), now()),
  ('de940000-0000-4000-8000-000000000002', 'm2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-maraton-2","aula_role":"teacher"}', '{}', now(), now()),
  ('de940000-0000-4000-8000-000000000003', 'm3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-maraton-3","aula_role":"teacher"}', '{}', now(), now()),
  ('de940000-0000-4000-8000-000000000011', 'm11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-mar-s1"}', '{}', now(), now()),
  ('de940000-0000-4000-8000-000000000012', 'm12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-mar-s2"}', '{}', now(), now()),
  ('de940000-0000-4000-8000-000000000013', 'm13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-mar-s3"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de940000-%';
update public.profiles set role = 'teacher' where id in ('de940000-0000-4000-8000-000000000001', 'de940000-0000-4000-8000-000000000002', 'de940000-0000-4000-8000-000000000003');
insert into public.courses (id, title) values
  ('de940000-0000-4000-8000-000000000021', 'Curso maratón'), ('de940000-0000-4000-8000-000000000022', 'Otra asignatura');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de940000-0000-4000-8000-000000000031', 'de940000-0000-4000-8000-000000000021', 'Sección A', 'MARATA01', 'de940000-0000-4000-8000-000000000001'),
  ('de940000-0000-4000-8000-000000000032', 'de940000-0000-4000-8000-000000000021', 'Sección B', 'MARATB01', 'de940000-0000-4000-8000-000000000001'),
  ('de940000-0000-4000-8000-000000000033', 'de940000-0000-4000-8000-000000000022', 'Sección X', 'MARATX01', 'de940000-0000-4000-8000-000000000003');
insert into public.class_teachers (class_id, user_id) values
  ('de940000-0000-4000-8000-000000000031', 'de940000-0000-4000-8000-000000000001'),
  ('de940000-0000-4000-8000-000000000032', 'de940000-0000-4000-8000-000000000001'),
  ('de940000-0000-4000-8000-000000000032', 'de940000-0000-4000-8000-000000000002'),
  ('de940000-0000-4000-8000-000000000033', 'de940000-0000-4000-8000-000000000003') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de940000-0000-4000-8000-000000000031', 'de940000-0000-4000-8000-000000000011'),
  ('de940000-0000-4000-8000-000000000031', 'de940000-0000-4000-8000-000000000012'),
  ('de940000-0000-4000-8000-000000000032', 'de940000-0000-4000-8000-000000000013');

-- banco sintético
insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-maraton', 'Banco de prueba', array['de940000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values
  ('prueba-maraton', 'ta', 'Tema A', 'alta', 'verificado', 1), ('prueba-maraton', 'tb', 'Tema B', 'alta', 'verificado', 2),
  ('prueba-maraton', 'tx', 'Tema excluido', 'sin_evidencia', 'excluido', 3);
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'pm.' || t || '.d' || n, 'prueba-maraton', t, n, 'Plantilla ' || t || n, 60, 600, 'validada'
  from unnest(array['ta', 'tb', 'tx']) t cross join generate_series(1, 6) n;
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  values ('pm.ta.d3p', 'prueba-maraton', 'ta', 3, 'Plantilla pendiente', 60, 600, 'pendiente_revision');
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id || ' variante ' || v, '[{"etiqueta":"v","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 6) v where p.banco_id = 'prueba-maraton';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', 'SOLUCION-SECRETA' from public.maraton_variantes where plantilla_id like 'pm.%';

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.pres(p_m uuid, p_u uuid) returns uuid language sql as $$
  select presentacion_actual from public.maraton_inscripciones where maraton_id = p_m and user_id = p_u
$$;
create function pg_temp.envejecer(p uuid, s integer) returns void language plpgsql as $$ begin
  perform set_config('maraton.ajuste_tiempo', 'si', true);
  update public.maraton_presentaciones set presentada_at = presentada_at - make_interval(secs => s) where id = p;
  perform set_config('maraton.ajuste_tiempo', 'no', true);
end $$;
-- responde (vía svc, como hace la Edge Function) tras «s» segundos; devuelve "nivel→nivel_despues"
create function pg_temp.resp(p_m uuid, p_u uuid, p_ok boolean, s integer) returns text language plpgsql as $$
declare p uuid := pg_temp.pres(p_m, p_u); x public.maraton_presentaciones; begin
  if p is null then raise exception 'FALLO: no hay problema abierto'; end if;
  perform pg_temp.envejecer(p, s);
  perform public.svc_maraton_responder(p_u, p, gen_random_uuid(), '{"partes":["1 m/s"]}', 'procedimiento', s, p_ok, null);
  select * into x from public.maraton_presentaciones where id = p;
  return x.nivel || '→' || x.nivel_despues;
end $$;
create function pg_temp.jornada(p_m uuid, p_u uuid) returns public.maraton_jornadas language sql as $$
  select j.* from public.maraton_jornadas j join public.maraton_inscripciones i on i.id = j.inscripcion_id
  where i.maraton_id = p_m and i.user_id = p_u order by j.numero desc limit 1
$$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Santo_Domingo')::date $$;
create temp table cuenta_notas as
  select (select count(*) from public.grade_entries) ge, (select count(*) from public.grade_history) gh,
         (select count(*) from public.activity_grade_links) gl, (select count(*) from public.extra_points) ep,
         (select count(*) from public.attempts) at, (select count(*) from public.responses) rs, (select count(*) from public.activities) ac;
create temp table ids (nombre text primary key, id uuid);
grant all on cuenta_notas, ids to authenticated;

-- 1) Creación (borrador), validación y aislamiento del borrador
set local role authenticated;
select pg_temp.como('de940000-0000-4000-8000-000000000011');
do $$ begin
  begin perform public.maraton_crear('de940000-0000-4000-8000-000000000031', '{}'); raise exception 'FALLO: el estudiante creó un maratón';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('de940000-0000-4000-8000-000000000001');
do $$ declare v uuid; r jsonb; begin
  begin perform public.maraton_crear('de940000-0000-4000-8000-000000000031', '{"config":{"carga":{"cuota":0}}}'); raise exception 'FALLO: cuota 0';
  exception when invalid_parameter_value then null; end;
  begin perform public.maraton_crear('de940000-0000-4000-8000-000000000033', '{}'); raise exception 'FALLO: profesor ajeno creó';
  exception when insufficient_privilege then null; end;
  v := public.maraton_crear('de940000-0000-4000-8000-000000000031', '{"titulo":"M","config":{"permanencia":{"min_correctas":0,"fuera_por_presentados":false,"fuera_por_continuidad":false,"fuera_rapido_nivel":null},"carga":{"fraccion_fallo":1,"minutos_minimos":0}}}');
  insert into ids values ('M', v);
  r := public.maraton_detalle_docente(v);
  if r ->> 'estado' <> 'borrador' or r ->> 'fecha_inicio' is not null or (r ->> 'calificacion_automatica')::boolean then raise exception 'FALLO: no nace como borrador sin fecha: %', r; end if;
  if (r -> 'config' -> 'dificultad' ->> 'nivel_inicial')::int <> 2 or (r -> 'config' -> 'carga' ->> 'cuota')::numeric <> 12
     or r -> 'config' -> 'dificultad' -> 'pesos' <> '[1.00, 1.20, 1.40, 1.50, 1.00, 1.00]'::jsonb or (r -> 'config' -> 'comodines' ->> 'total')::int <> 10
     or (r -> 'config' -> 'programacion' ->> 'jornadas')::int <> 14 then raise exception 'FALLO: valores predeterminados: %', r -> 'config'; end if;
  if not (r -> 'revision' -> 'errores')::text like '%fecha de inicio%' then raise exception 'FALLO: la revisión no exige la fecha'; end if;
  begin perform public.maraton_cambiar_estado(v, 'publicado'); raise exception 'FALLO: publicó sin fecha';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  insert into ids values ('M2', public.maraton_crear('de940000-0000-4000-8000-000000000031', '{"titulo":"M2","config":{"permanencia":{"min_correctas":0,"fuera_por_presentados":false,"fuera_por_continuidad":false,"fuera_rapido_nivel":null},"carga":{"fraccion_fallo":1,"minutos_minimos":0},"dificultad":{"nivel_inicial":6},"comodines":{"total":2}}}'));
  insert into ids values ('M3', public.maraton_crear('de940000-0000-4000-8000-000000000031', '{"titulo":"M3","config":{"permanencia":{"min_correctas":0,"fuera_por_presentados":false,"fuera_por_continuidad":false,"fuera_rapido_nivel":null},"carga":{"fraccion_fallo":1,"minutos_minimos":0}}}'));
  insert into ids values ('M4', public.maraton_crear('de940000-0000-4000-8000-000000000031', '{"titulo":"M4","config":{"permanencia":{"min_correctas":0,"fuera_por_presentados":false,"fuera_por_continuidad":false,"fuera_rapido_nivel":null},"carga":{"fraccion_fallo":1,"minutos_minimos":0,"limite_minutos":30,"alternativa_activa":false}}}'));
  insert into ids values ('M5', public.maraton_crear('de940000-0000-4000-8000-000000000031', '{"titulo":"M5","config":{"permanencia":{"min_correctas":0,"fuera_por_presentados":false,"fuera_por_continuidad":false,"fuera_rapido_nivel":null},"carga":{"fraccion_fallo":1,"minutos_minimos":0,"intentos_max":3,"presentados_max":3,"alternativa_activa":false}}}'));
  insert into ids values ('M6', public.maraton_crear('de940000-0000-4000-8000-000000000031', '{"titulo":"M6","config":{"permanencia":{"min_correctas":0,"fuera_por_presentados":false,"fuera_por_continuidad":false,"fuera_rapido_nivel":null},"carga":{"fraccion_fallo":1,"minutos_minimos":0,"cuota":1}}}'));
end $$;
select pg_temp.como('de940000-0000-4000-8000-000000000011');
do $$ begin
  if jsonb_array_length(public.maraton_mis_maratones()) <> 0 then raise exception 'FALLO: el estudiante ve borradores'; end if;
  begin perform public.maraton_estado((select id from ids where nombre = 'M')); raise exception 'FALLO: el estudiante abrió un borrador';
  exception when insufficient_privilege then null; end;
  begin perform public.maraton_iniciar((select id from ids where nombre = 'M')); raise exception 'FALLO: el estudiante inició un borrador';
  exception when insufficient_privilege then null; end;
end $$;

-- 2) Publicación (con fecha de hoy) — solo el profesor; luego el estudiante lo ve
select pg_temp.como('de940000-0000-4000-8000-000000000001');
do $$ declare r record; begin
  for r in select * from ids loop
    perform public.maraton_guardar(r.id, jsonb_build_object('fecha_inicio', pg_temp.hoy()));
    perform public.maraton_cambiar_estado(r.id, 'publicado');
  end loop;
end $$;
select pg_temp.como('de940000-0000-4000-8000-000000000013');
do $$ begin
  if jsonb_array_length(public.maraton_mis_maratones()) <> 0 then raise exception 'FALLO: un estudiante de otra sección ve el maratón'; end if;
  begin perform public.maraton_iniciar((select id from ids where nombre = 'M')); raise exception 'FALLO: estudiante de otra sección entró';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('de940000-0000-4000-8000-000000000011');
do $$ declare r jsonb; t text; begin
  if jsonb_array_length(public.maraton_mis_maratones()) <> 6 then raise exception 'FALLO: no ve los maratones publicados'; end if;
  r := public.maraton_iniciar((select id from ids where nombre = 'M'));
  if r -> 'problema' ->> 'presentacion_id' is null or (r ->> 'comodines_disponibles')::int <> 10 or (r -> 'jornada' ->> 'numero')::int <> 1 then
    raise exception 'FALLO: iniciar: %', r; end if;
  -- parámetros ocultos y respuestas protegidas
  t := r::text;
  if t ~ '"(nivel|peso|unidades|cuota|clave|solucion|t_min_s|t_max_s|variante_id|plantilla_id|tema)"' or t like '%7.77%' or t like '%SOLUCION%' then
    raise exception 'FALLO: el estado del estudiante expone datos ocultos: %', t; end if;
  -- recarga: el mismo problema
  if public.maraton_estado((select id from ids where nombre = 'M')) -> 'problema' ->> 'presentacion_id' <> r -> 'problema' ->> 'presentacion_id'
     or public.maraton_iniciar((select id from ids where nombre = 'M')) -> 'problema' ->> 'presentacion_id' <> r -> 'problema' ->> 'presentacion_id' then
    raise exception 'FALLO: recargar cambió el problema'; end if;
  -- lecturas directas y funciones de servidor: prohibidas
  begin perform 1 from public.maraton_claves; raise exception 'FALLO: leyó claves'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.maraton_variantes; raise exception 'FALLO: leyó variantes'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.maraton_presentaciones; raise exception 'FALLO: leyó presentaciones'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.maraton_inscripciones; raise exception 'FALLO: leyó inscripciones'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.maraton_actividades; raise exception 'FALLO: leyó la configuración'; exception when insufficient_privilege then null; end;
  begin perform public.svc_maraton_clave('de940000-0000-4000-8000-000000000011', (r -> 'problema' ->> 'presentacion_id')::uuid); raise exception 'FALLO: llamó svc_maraton_clave';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_maraton_responder('de940000-0000-4000-8000-000000000011', (r -> 'problema' ->> 'presentacion_id')::uuid, gen_random_uuid(), '{}', null, 1, true, null);
    raise exception 'FALLO: llamó svc_maraton_responder'; exception when insufficient_privilege then null; end;
  begin perform public.maraton_resumen((select id from ids where nombre = 'M')); raise exception 'FALLO: el estudiante vio el informe docente';
  exception when insufficient_privilege then null; end;
  begin perform public.maraton_banco_muestra('pm.ta.d1', 1); raise exception 'FALLO: el estudiante vio el banco';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 3) Máquina de estados y unidades (S1 en M): D2 inicial, 11 respuestas, cuota 12 alcanzada en la undécima
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := 'de940000-0000-4000-8000-000000000011'; j public.maraton_jornadas;
  pasos text[] := '{}'; esperado text[] := array['2→3', '3→2', '2→1', '1→1', '1→2', '2→3', '3→4', '4→5', '5→6', '6→6', '6→5'];
  resultados boolean[] := array[true, false, false, false, true, true, true, true, true, true, false]; k integer; nv integer;
begin
  for k in 1 .. 11 loop
    -- consistencia: el nivel del problema presentado = nivel de su plantilla = nivel de la inscripción
    select x.nivel into nv from public.maraton_presentaciones x join public.maraton_plantillas p on p.id = x.plantilla_id and p.nivel = x.nivel
     where x.id = pg_temp.pres(m, u);
    if nv is distinct from (select nivel from public.maraton_inscripciones where maraton_id = m and user_id = u) then
      raise exception 'FALLO: nivel presentado inconsistente en el paso %', k; end if;
    pasos := pasos || pg_temp.resp(m, u, resultados[k], 120);
    j := pg_temp.jornada(m, u);
    if k < 11 and j.estado <> 'en_curso' then raise exception 'FALLO: la jornada terminó antes de tiempo en el paso % (%)', k, j.unidades; end if;
  end loop;
  if pasos <> esperado then raise exception 'FALLO: transiciones % (esperado %)', pasos, esperado; end if;
  j := pg_temp.jornada(m, u);
  -- 1.2+1.4+1.2+1.0+1.0+1.2+1.4+1.5+1.0+1.0+1.0 = 12.9 (incorrectas también suman; D5 y D6 valen 1)
  if j.unidades <> 12.9 or j.intentos_validos <> 11 or j.correctas <> 7 or j.incorrectas <> 4 or j.estado <> 'completada' or j.via <> 'cuota' then
    raise exception 'FALLO: cuota/unidades: %', to_jsonb(j); end if;
  if pg_temp.pres(m, u) is not null then raise exception 'FALLO: presentó otro problema tras completar'; end if;
  if (select count(*) from public.maraton_presentaciones x join public.maraton_plantillas p on p.id = x.plantilla_id where p.tema = 'tx' or p.estado <> 'validada') > 0 then
    raise exception 'FALLO: presentó problemas de temas excluidos o plantillas sin validar'; end if;
end $$;
set local role authenticated;
select pg_temp.como('de940000-0000-4000-8000-000000000011');
do $$ declare r jsonb := public.maraton_iniciar((select id from ids where nombre = 'M')); begin
  if r -> 'jornada' ->> 'estado' <> 'completada' or r -> 'problema' <> 'null'::jsonb and r -> 'problema' is not null then raise exception 'FALLO: tras completar: %', r; end if;
end $$;
reset role;

-- 4) «No puedo» en todos los niveles (S2 en M2, empieza en D6): baja uno, sin unidades ni comodines
do $$ declare m uuid := (select id from ids where nombre = 'M2'); u uuid := 'de940000-0000-4000-8000-000000000012'; r jsonb; x public.maraton_presentaciones;
  k integer; pasos text[] := '{}'; j public.maraton_jornadas; p uuid;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 7 loop
    p := pg_temp.pres(m, u);
    r := public.maraton_no_puedo(p, gen_random_uuid(), 5, null);
    select * into x from public.maraton_presentaciones where id = p;
    pasos := pasos || (x.nivel || '→' || x.nivel_despues);
    if x.accion <> 'no_puedo' or x.unidades <> 0 or x.comodines_despues <> 0 then raise exception 'FALLO: no puedo: %', to_jsonb(x); end if;
  end loop;
  if pasos <> array['6→5', '5→4', '4→3', '3→2', '2→1', '1→1', '1→1'] then raise exception 'FALLO: «no puedo» %', pasos; end if;
  j := pg_temp.jornada(m, u);
  if j.unidades <> 0 or j.intentos_validos <> 0 or j.no_puedo <> 7 or (r ->> 'comodines_disponibles')::int <> 2 then raise exception 'FALLO: contadores tras «no puedo»: % %', to_jsonb(j), r; end if;
end $$;

-- 5) Comodines (S1 en M2: 2 en total): mismo nivel, otro problema, el retirado no vuelve, no se pasa del máximo
do $$ declare m uuid := (select id from ids where nombre = 'M2'); u uuid := 'de940000-0000-4000-8000-000000000011'; r jsonb;
  p1 uuid; p2 uuid; p3 uuid; v1 text; v2 text; i public.maraton_inscripciones; idem uuid := gen_random_uuid();
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  p1 := pg_temp.pres(m, u);
  select variante_id into v1 from public.maraton_presentaciones where id = p1;
  r := public.maraton_cambiar(p1, idem, 30);
  p2 := pg_temp.pres(m, u);
  select variante_id into v2 from public.maraton_presentaciones where id = p2;
  if p2 = p1 or v2 = v1 or (r ->> 'comodines_disponibles')::int <> 1 then raise exception 'FALLO: primer cambio: %', r; end if;
  if (select nivel from public.maraton_presentaciones where id = p2) <> 6 or (select nivel from public.maraton_inscripciones where maraton_id = m and user_id = u) <> 6 then
    raise exception 'FALLO: el cambio alteró el nivel'; end if;
  if (select unidades from public.maraton_presentaciones where id = p1) <> 0 then raise exception 'FALLO: el cambio dio unidades'; end if;
  -- repetición de la misma solicitud (recarga/doble clic): no consume otro comodín
  r := public.maraton_cambiar(p1, idem, 30);
  if r ->> 'aviso' <> 'ya_procesada' or (r ->> 'comodines_disponibles')::int <> 1 then raise exception 'FALLO: cambio repetido: %', r; end if;
  r := public.maraton_cambiar(p1, gen_random_uuid(), 30);
  if r ->> 'aviso' <> 'ya_cerrada' or (r ->> 'comodines_disponibles')::int <> 1 then raise exception 'FALLO: cambio sobre problema viejo: %', r; end if;
  perform public.maraton_cambiar(p2, gen_random_uuid(), 30);
  p3 := pg_temp.pres(m, u);
  begin perform public.maraton_cambiar(p3, gen_random_uuid(), 30); raise exception 'FALLO: usó más comodines de los disponibles';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; if sqlerrm not like '%comodines%' then raise; end if; end;
  select * into i from public.maraton_inscripciones where maraton_id = m and user_id = u;
  if i.comodines_usados <> 2 or i.presentacion_actual <> p3 then raise exception 'FALLO: comodines usados %', i.comodines_usados; end if;
  if exists (select 1 from public.maraton_presentaciones where inscripcion_id = i.id group by variante_id having count(*) > 1) then raise exception 'FALLO: problema repetido'; end if;
  -- doble envío de una respuesta: una sola cuenta
  perform pg_temp.envejecer(p3, 200);
  idem := gen_random_uuid();
  perform public.svc_maraton_responder(u, p3, idem, '{"partes":["1 m/s"]}', null, 200, true, null);
  r := public.svc_maraton_responder(u, p3, idem, '{"partes":["1 m/s"]}', null, 200, true, null);
  if r ->> 'aviso' <> 'ya_procesada' or (pg_temp.jornada(m, u)).intentos_validos <> 1 then raise exception 'FALLO: doble envío contó dos veces: %', r; end if;
  r := public.svc_maraton_responder(u, p3, gen_random_uuid(), '{"partes":["1 m/s"]}', null, 200, false, null);
  if r ->> 'aviso' <> 'ya_cerrada' or (pg_temp.jornada(m, u)).intentos_validos <> 1 then raise exception 'FALLO: reenvío con otra clave: %', r; end if;
end $$;

-- 6) Respuesta anticipada (antes del tiempo mínimo): crédito proporcional, marcada; y límite de intentos (M5)
do $$ declare m uuid := (select id from ids where nombre = 'M5'); u uuid := 'de940000-0000-4000-8000-000000000012'; x public.maraton_presentaciones; p uuid; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  p := pg_temp.pres(m, u);
  perform public.svc_maraton_responder(u, p, gen_random_uuid(), '{"partes":["1 m/s"]}', null, 0, true, null);
  select * into x from public.maraton_presentaciones where id = p;
  if not x.anticipada or x.unidades > 0.05 or x.nivel_despues <> 3 then raise exception 'FALLO: anticipada: %', to_jsonb(x); end if;
  -- el navegador no puede acreditar más tiempo que el reloj del servidor
  p := pg_temp.pres(m, u);
  perform pg_temp.envejecer(p, 30);
  perform public.svc_maraton_responder(u, p, gen_random_uuid(), '{"partes":["1 m/s"]}', null, 5000, false, null);
  select * into x from public.maraton_presentaciones where id = p;
  if x.segundos > 31 or not x.anticipada then raise exception 'FALLO: tiempo inflado aceptado: %', x.segundos; end if;
  perform pg_temp.resp(m, u, false, 100);
  j := pg_temp.jornada(m, u);
  if j.estado <> 'cerrada_limite' or not j.revision or j.motivo_revision not like '%intentos%' or pg_temp.pres(m, u) is not null then
    raise exception 'FALLO: límite de intentos: %', to_jsonb(j); end if;
end $$;

-- 7) Finalización alternativa (S1 en M3): 8 intentos válidos y ≥ 60 min, sin llegar a la cuota
do $$ declare m uuid := (select id from ids where nombre = 'M3'); u uuid := 'de940000-0000-4000-8000-000000000011'; k integer; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 8 loop
    perform pg_temp.resp(m, u, false, 480);
    j := pg_temp.jornada(m, u);
    if k < 8 and j.estado <> 'en_curso' then raise exception 'FALLO: terminó en el intento %', k; end if;
  end loop;
  if j.estado <> 'completada' or j.via <> 'alternativa' or j.unidades >= 12 or j.segundos < 3600 then raise exception 'FALLO: vía alternativa: %', to_jsonb(j); end if;
end $$;

-- 8) Límite máximo de tiempo (S1 en M4: 30 min, sin vía alternativa): cierre seguro y marcado para revisión
do $$ declare m uuid := (select id from ids where nombre = 'M4'); u uuid := 'de940000-0000-4000-8000-000000000011'; k integer; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 4 loop perform pg_temp.resp(m, u, false, 480); end loop;
  j := pg_temp.jornada(m, u);
  if j.estado <> 'cerrada_limite' or not j.revision or j.motivo_revision not like '%tiempo%' then raise exception 'FALLO: límite de tiempo: %', to_jsonb(j); end if;
end $$;

-- 9) Desconexión y plazo: la jornada vencida se cierra sola; reapertura y justificación auditadas (S2 en M3)
do $$ declare m uuid := (select id from ids where nombre = 'M3'); u uuid := 'de940000-0000-4000-8000-000000000012'; p uuid; r jsonb; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  p := pg_temp.pres(m, u);
  -- reanudación tras «desconexión»: el mismo problema, con el tiempo que realmente pasó
  perform pg_temp.envejecer(p, 90);
  if public.maraton_iniciar(m) -> 'problema' ->> 'presentacion_id' <> p::text then raise exception 'FALLO: reanudar cambió el problema'; end if;
  -- pasa el día (la jornada 1 fue ayer)
  update public.maraton_actividades set fecha_inicio = pg_temp.hoy() - 1 where id = m;
  r := public.maraton_estado(m);
  select * into j from public.maraton_jornadas where inscripcion_id = (select id from public.maraton_inscripciones where maraton_id = m and user_id = u) and numero = 1;
  if j.estado <> 'incompleta' or (select accion from public.maraton_presentaciones where id = p) <> 'cierre' then raise exception 'FALLO: jornada vencida: %', to_jsonb(j); end if;
  r := public.svc_maraton_responder(u, p, gen_random_uuid(), '{"partes":["1 m/s"]}', null, 60, true, null);
  if r ->> 'aviso' <> 'ya_cerrada' then raise exception 'FALLO: respondió en una jornada vencida: %', r; end if;
  -- reapertura por el profesor
  perform pg_temp.como('de940000-0000-4000-8000-000000000001');
  begin perform public.maraton_incidencia(m, u, 1, 'reapertura', 'Corte eléctrico verificado', now() - interval '1 hour'); raise exception 'FALLO: plazo pasado';
  exception when invalid_parameter_value then null; end;
  perform public.maraton_incidencia(m, u, 1, 'reapertura', 'Corte eléctrico verificado', now() + interval '1 day');
  perform public.maraton_incidencia(m, u, 5, 'justificacion', 'Certificado médico', null);
  perform pg_temp.como(u::text);
  r := public.maraton_iniciar(m);
  if (r -> 'jornada' ->> 'numero')::int <> 1 or r -> 'jornada' ->> 'estado' <> 'en_curso' or r -> 'problema' ->> 'presentacion_id' is null or r -> 'jornada' ->> 'reabierta_hasta' is null then
    raise exception 'FALLO: reapertura: %', r; end if;
  if (select estado from public.maraton_jornadas where inscripcion_id = (select id from public.maraton_inscripciones where maraton_id = m and user_id = u) and numero = 5) <> 'justificada' then
    raise exception 'FALLO: justificación'; end if;
  if (select count(*) from public.maraton_incidencias where maraton_id = m and user_id = u) <> 2 then raise exception 'FALLO: incidencias no registradas'; end if;
end $$;

-- 10) Catorce jornadas (S1 en M6, cuota 1): una por día, el nivel continúa de un día a otro, después termina
do $$ declare m uuid := (select id from ids where nombre = 'M6'); u uuid := 'de940000-0000-4000-8000-000000000011'; k integer; r jsonb; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  for k in 1 .. 14 loop
    update public.maraton_actividades set fecha_inicio = pg_temp.hoy() - (k - 1) where id = m;
    r := public.maraton_iniciar(m);
    if (r -> 'jornada' ->> 'numero')::int <> k then raise exception 'FALLO: día % abrió la jornada %', k, r -> 'jornada' ->> 'numero'; end if;
    perform pg_temp.resp(m, u, true, 120);
    j := pg_temp.jornada(m, u);
    if j.numero <> k or j.estado <> 'completada' or j.fecha <> pg_temp.hoy() then raise exception 'FALLO: jornada % no completada: %', k, to_jsonb(j); end if;
  end loop;
  if (select nivel from public.maraton_inscripciones where maraton_id = m and user_id = u) <> 6 then raise exception 'FALLO: el nivel no continuó entre jornadas'; end if;
  if (select count(*) from public.maraton_jornadas where maraton_id = m and estado = 'completada') <> 14 then raise exception 'FALLO: 14 jornadas'; end if;
  update public.maraton_actividades set fecha_inicio = pg_temp.hoy() - 14 where id = m;
  r := public.maraton_iniciar(m);
  if not (r ->> 'finalizado')::boolean or r -> 'hoy' ->> 'fase' <> 'finalizado' or r -> 'problema' is not null and r -> 'problema' <> 'null'::jsonb then
    raise exception 'FALLO: después de la jornada 14: %', r; end if;
  -- informe del estudiante: ya terminó el maratón → visible, sin unidades ni ponderaciones
  r := public.maraton_mi_informe(m);
  if not (r ->> 'participo')::boolean or (r -> 'resumen' ->> 'jornadas_completadas')::int <> 14 or r -> 'resumen' ? 'unidades' or r::text like '%"peso"%' then
    raise exception 'FALLO: informe del estudiante: %', r; end if;
end $$;
-- informe aún no publicado (M en curso)
set local role authenticated;
select pg_temp.como('de940000-0000-4000-8000-000000000011');
do $$ begin
  begin perform public.maraton_mi_informe((select id from ids where nombre = 'M')); raise exception 'FALLO: informe visible antes de tiempo';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  -- otro estudiante no puede actuar sobre mi problema
end $$;
select pg_temp.como('de940000-0000-4000-8000-000000000012');
do $$ begin
  begin perform public.maraton_cambiar(public.maraton_estado((select id from ids where nombre = 'M3')) -> 'problema' ->> 'presentacion_id' || '', gen_random_uuid(), 1);
  exception when others then null; end;
end $$;
reset role;
do $$ declare p uuid := pg_temp.pres((select id from ids where nombre = 'M3'), 'de940000-0000-4000-8000-000000000012'); begin
  perform pg_temp.como('de940000-0000-4000-8000-000000000011');
  begin perform public.maraton_no_puedo(p, gen_random_uuid(), 1, null); raise exception 'FALLO: S1 actuó sobre el problema de S2';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_maraton_clave('de940000-0000-4000-8000-000000000011', p); raise exception 'FALLO: clave del problema ajeno';
  exception when insufficient_privilege then null; end;
end $$;

-- 11) Integridad del historial
do $$ declare p uuid := (select id from public.maraton_presentaciones where cerrada_at is not null limit 1); begin
  begin update public.maraton_presentaciones set resultado = 'correcta' where id = p; raise exception 'FALLO: modificó una presentación cerrada';
  exception when insufficient_privilege then null; end;
  begin delete from public.maraton_presentaciones where id = p; raise exception 'FALLO: borró historial';
  exception when insufficient_privilege then null; end;
  begin update public.maraton_eventos set tipo = 'x' where id = (select min(id) from public.maraton_eventos); raise exception 'FALLO: modificó eventos';
  exception when insufficient_privilege then null; end;
  begin delete from public.maraton_incidencias; raise exception 'FALLO: borró incidencias';
  exception when insufficient_privilege then null; end;
  begin delete from public.maraton_jornadas where maraton_id = (select id from ids where nombre = 'M'); raise exception 'FALLO: borró jornadas';
  exception when insufficient_privilege then null; end;
end $$;

-- 12) Informes docentes y aislamiento entre profesores/secciones
set local role authenticated;
select pg_temp.como('de940000-0000-4000-8000-000000000001');
do $$ declare r jsonb; e jsonb; h jsonb; begin
  r := public.maraton_resumen((select id from ids where nombre = 'M'));
  select x into e from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'login_id' = 'sint-mar-s1';
  if (e -> 'resumen' ->> 'correctas')::int <> 7 or (e -> 'resumen' ->> 'nivel_maximo')::int <> 6 or (e -> 'resumen' ->> 'extremos_resueltos')::int <> 1
     or jsonb_array_length(r -> 'estudiantes') <> 2 or jsonb_array_length(r -> 'calendario') <> 14 then raise exception 'FALLO: resumen docente: %', r; end if;
  h := public.maraton_historial((select id from ids where nombre = 'M'), 'de940000-0000-4000-8000-000000000011');
  if jsonb_array_length(h -> 'presentaciones') <> 11 or h -> 'presentaciones' -> 0 ->> 'nivel' <> '2' or h -> 'presentaciones' -> 0 ->> 'nivel_despues' <> '3'
     or h -> 'presentaciones' -> 0 -> 'clave' is null or h -> 'presentaciones' -> 0 ->> 'procedimiento' <> 'procedimiento' then raise exception 'FALLO: historial: %', h -> 'presentaciones' -> 0; end if;
  if jsonb_array_length(public.maraton_exportar((select id from ids where nombre = 'M'))) <> 11 then raise exception 'FALLO: exportación'; end if;
  if jsonb_array_length(public.maraton_lista_docente('de940000-0000-4000-8000-000000000031')) <> 6 then raise exception 'FALLO: lista docente'; end if;
  if jsonb_array_length(public.maraton_bancos_disponibles('de940000-0000-4000-8000-000000000031')) <> 1 then raise exception 'FALLO: bancos'; end if;
  if (public.maraton_banco_muestra('pm.ta.d1', 2) -> 0 ->> 'solucion') <> 'SOLUCION-SECRETA' then raise exception 'FALLO: vista previa del banco'; end if;
  -- revisión docente de una plantilla pendiente
  if (public.maraton_plantilla_revisar('pm.ta.d3p', 'validada', 'Revisada') ->> 'estado') <> 'validada' then raise exception 'FALLO: revisar plantilla'; end if;
  -- con participantes, las reglas no cambian a mitad del maratón
  begin perform public.maraton_guardar((select id from ids where nombre = 'M'), '{"config":{"carga":{"cuota":5}}}'); raise exception 'FALLO: cambió la cuota con participantes';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  perform public.maraton_guardar((select id from ids where nombre = 'M'), '{"titulo":"M renombrado"}');
  begin perform public.maraton_cambiar_estado((select id from ids where nombre = 'M'), 'borrador'); raise exception 'FALLO: volvió a borrador con participantes';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
select pg_temp.como('de940000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.maraton_resumen((select id from ids where nombre = 'M')); raise exception 'FALLO: profesor de otra sección vio el informe';
  exception when insufficient_privilege then null; end;
  begin perform public.maraton_historial((select id from ids where nombre = 'M'), 'de940000-0000-4000-8000-000000000011'); raise exception 'FALLO: historial ajeno';
  exception when insufficient_privilege then null; end;
  begin perform public.maraton_detalle_docente((select id from ids where nombre = 'M')); raise exception 'FALLO: configuración ajena';
  exception when insufficient_privilege then null; end;
  if jsonb_array_length(public.maraton_lista_docente('de940000-0000-4000-8000-000000000032')) <> 0 then raise exception 'FALLO: ve maratones de otra sección'; end if;
end $$;
select pg_temp.como('de940000-0000-4000-8000-000000000003');
do $$ begin
  begin perform public.maraton_banco_muestra('pm.ta.d1', 1); raise exception 'FALLO: profesor de otra asignatura vio claves';
  exception when insufficient_privilege then null; end;
end $$;

-- 13) Duplicar en otra sección: nueva instancia limpia; el profesor la prueba en modo prueba sin afectar informes
select pg_temp.como('de940000-0000-4000-8000-000000000001');
do $$ declare v uuid; r jsonb; begin
  begin perform public.maraton_duplicar((select id from ids where nombre = 'M'), 'de940000-0000-4000-8000-000000000033', null); raise exception 'FALLO: duplicó en sección ajena';
  exception when insufficient_privilege then null; end;
  v := public.maraton_duplicar((select id from ids where nombre = 'M2'), 'de940000-0000-4000-8000-000000000032', 'Copia B');
  r := public.maraton_detalle_docente(v);
  if r ->> 'estado' <> 'borrador' or r ->> 'fecha_inicio' is not null or (r ->> 'participantes')::int <> 0 or r ->> 'class_id' <> 'de940000-0000-4000-8000-000000000032'
     or (r -> 'config' -> 'dificultad' ->> 'nivel_inicial')::int <> 6 or r ->> 'origen_id' <> (select id from ids where nombre = 'M2')::text then raise exception 'FALLO: duplicado: %', r; end if;
  -- recorrido de prueba del profesor sobre el borrador
  r := public.maraton_iniciar(v);
  if not (r ->> 'prueba')::boolean or r -> 'problema' ->> 'presentacion_id' is null then raise exception 'FALLO: prueba docente: %', r; end if;
  if (public.maraton_resumen(v) -> 'estudiantes')::text like '%prof-maraton%' then raise exception 'FALLO: la prueba aparece en el informe'; end if;
  perform public.maraton_reiniciar_prueba(v);
  if (public.maraton_estado(v) ->> 'aceptado')::boolean or public.maraton_estado(v) -> 'jornada' <> 'null'::jsonb then raise exception 'FALLO: reiniciar prueba'; end if;
end $$;
select pg_temp.como('de940000-0000-4000-8000-000000000013');
do $$ begin
  if jsonb_array_length(public.maraton_mis_maratones()) <> 0 then raise exception 'FALLO: el borrador duplicado es visible'; end if;
end $$;
reset role;

-- 14) Ninguna escritura en notas, intentos ni actividades
do $$ declare c record; begin
  select * into c from cuenta_notas;
  if c.ge <> (select count(*) from public.grade_entries) or c.gh <> (select count(*) from public.grade_history)
     or c.gl <> (select count(*) from public.activity_grade_links) or c.ep <> (select count(*) from public.extra_points)
     or c.at <> (select count(*) from public.attempts) or c.rs <> (select count(*) from public.responses) or c.ac <> (select count(*) from public.activities) then
    raise exception 'FALLO: el maratón escribió en notas, intentos o actividades'; end if;
  if exists (select 1 from pg_proc where proname like 'maraton%' and (prosrc ~* '(grade_entries|grade_history|activity_grade_links|extra_points|official_scores|insert into public\.(attempts|responses|activities))')) then
    raise exception 'FALLO: una función del maratón referencia el registro de calificaciones'; end if;
end $$;

select 'maraton_adaptativo: PRUEBAS PASARON' as resultado;
rollback;
