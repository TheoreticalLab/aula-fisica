-- Pruebas: Maratón — progresión avanzada por etapas y comprobaciones de razonamiento (migración 99). Se deshace al final.
-- Banco sintético: 2 temas × 9 niveles × 10 variantes; niveles 7–9 con 3 etapas; en los ordinarios, las variantes del
-- tema A tienen comprobación de razonamiento (las del B no). Profesor T; estudiantes S1…S5 en la sección A.
-- A (predeterminado, comprobaciones al 0 %): S1 sube D2→D6→D7→D8→D9 por etapas; S2 «No puedo» a mitad de un D7;
--   S3 completa la jornada justo al acertar un D6 (maratón C con cuota baja). B (comprobaciones al 100 %): S4. D (sin
--   progresión avanzada): S5 se queda en D6.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('de990000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'a' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k = 1 then '{"login_id":"prof-av","aula_role":"teacher"}' else json_build_object('login_id', 'sint-av-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 11, 12, 13, 14, 15]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'de990000-%';
update public.profiles set role = 'teacher' where id = 'de990000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de990000-0000-4000-8000-000000000021', 'Curso avanzado');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de990000-0000-4000-8000-000000000031', 'de990000-0000-4000-8000-000000000021', 'Sección A', 'AVANZ001', 'de990000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('de990000-0000-4000-8000-000000000031', 'de990000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'de990000-0000-4000-8000-000000000031', ('de990000-0000-4000-8000-0000000000' || k)::uuid from unnest(array[11, 12, 13, 14, 15]) k;

insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-av', 'Banco de prueba', array['de990000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values
  ('prueba-av', 'pa', 'Tema A', 'alta', 'verificado', 1), ('prueba-av', 'pb', 'Tema B', 'alta', 'verificado', 2);
-- la restricción de nivel admite 7–9 (antes 1–6)
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'pv.' || t || '.d' || n, 'prueba-av', t, n, 'Plantilla ' || t || n, case when n > 6 then 600 else 60 end, 3000, 'validada'
  from unnest(array['pa', 'pb']) t cross join generate_series(1, 9) n;
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id || ' variante ' || v, '[{"etiqueta":"v","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 10) v where p.banco_id = 'prueba-av';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', 'solución' from public.maraton_variantes where plantilla_id like 'pv.%';
insert into public.maraton_etapas (variante_id, numero, tipo, enunciado, partes)
  select v.id, e, 'etapa', 'Etapa ' || e || ' de ' || v.id, '[{"etiqueta":"E","unidad":"J"}]'
  from public.maraton_variantes v join public.maraton_plantillas p on p.id = v.plantilla_id cross join generate_series(2, 3) e
  where p.banco_id = 'prueba-av' and p.nivel > 6;
insert into public.maraton_etapas (variante_id, numero, tipo, enunciado, partes)
  select v.id, 2, 'comprobacion', 'Comprobación de ' || v.id, '[{"etiqueta":"Factor","unidad":""}]'
  from public.maraton_variantes v join public.maraton_plantillas p on p.id = v.plantilla_id
  where p.banco_id = 'prueba-av' and p.nivel <= 6 and p.tema = 'pa';   -- el reparto por temas alterna pa/pb: hay de ambos casos
insert into public.maraton_etapas_claves (variante_id, numero, clave)
  select variante_id, numero, '{"partes":[{"format":"numeric","value":"1.414"}]}' from public.maraton_etapas where variante_id like 'pv.%';

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns uuid language sql as $$ select ('de990000-0000-4000-8000-0000000000' || k)::uuid $$;
create function pg_temp.pres(p_m uuid, p_u uuid) returns public.maraton_presentaciones language sql as $$
  select x.* from public.maraton_presentaciones x join public.maraton_inscripciones i on i.presentacion_actual = x.id
  where i.maraton_id = p_m and i.user_id = p_u
$$;
create function pg_temp.envejecer(p uuid, s integer) returns void language plpgsql as $$ begin
  perform set_config('maraton.ajuste_tiempo', 'si', true);
  update public.maraton_presentaciones set presentada_at = presentada_at - make_interval(secs => s) where id = p;
  perform set_config('maraton.ajuste_tiempo', 'no', true);
end $$;
-- entrega la etapa ABIERTA (o la indicada) como lo hace la Edge Function
create function pg_temp.etapa(p_m uuid, p_u uuid, p_ok boolean, s integer default 0, p_num integer default null, p_idem uuid default null)
returns jsonb language plpgsql as $$
declare x public.maraton_presentaciones := pg_temp.pres(p_m, p_u); begin
  if x.id is null then raise exception 'FALLO: no hay problema abierto'; end if;
  if s > 0 then perform pg_temp.envejecer(x.id, s); end if;
  -- el tiempo del navegador alto: manda el reloj del servidor (greatest(null, 0) sería 0)
  return public.svc_maraton_etapa(p_u, x.id, coalesce(p_idem, gen_random_uuid()), coalesce(p_num, x.etapa_actual), '{"partes":["1 m/s"]}', 'proc', 86400,
    p_ok, jsonb_build_object('partes', jsonb_build_array(jsonb_build_object('correcta', p_ok, 'codigo', 'x'))));
end $$;
-- responde un problema completo (todas sus etapas) con el mismo resultado en cada una
create function pg_temp.resolver(p_m uuid, p_u uuid, p_ok boolean, s integer) returns void language plpgsql as $$
declare x public.maraton_presentaciones := pg_temp.pres(p_m, p_u); k integer; begin
  perform pg_temp.envejecer(x.id, s);
  for k in 1 .. x.etapas_total loop perform pg_temp.etapa(p_m, p_u, p_ok); end loop;
end $$;
create function pg_temp.jornada(p_m uuid, p_u uuid) returns public.maraton_jornadas language sql as $$
  select j.* from public.maraton_jornadas j join public.maraton_inscripciones i on i.id = j.inscripcion_id
  where i.maraton_id = p_m and i.user_id = p_u order by j.numero desc limit 1
$$;
create function pg_temp.insc(p_m uuid, p_u uuid) returns public.maraton_inscripciones language sql as $$
  select * from public.maraton_inscripciones where maraton_id = p_m and user_id = p_u
$$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Santo_Domingo')::date $$;
create temp table ids (nombre text primary key, id uuid);
grant all on ids to authenticated;

-- 1) Valores predeterminados, validación (sin bonificaciones) y publicación
set local role authenticated;
select pg_temp.como('de990000-0000-4000-8000-000000000001');
do $$ declare v uuid; r jsonb; cfg jsonb; begin
  begin perform public.maraton_crear('de990000-0000-4000-8000-000000000031', '{"config":{"avanzado":{"pesos":[1, 1, 2]}}}'); raise exception 'FALLO: aceptó una bonificación por nivel';
  exception when invalid_parameter_value then null; end;
  begin perform public.maraton_crear('de990000-0000-4000-8000-000000000031', '{"config":{"avanzado":{"comprobacion_porcentaje":101}}}'); raise exception 'FALLO: aceptó 101 %%';
  exception when invalid_parameter_value then null; end;
  v := public.maraton_crear('de990000-0000-4000-8000-000000000031', '{"titulo":"V"}');
  r := public.maraton_detalle_docente(v) -> 'config' -> 'avanzado';
  if r <> '{"activo": true, "pesos": [1.00, 1.00, 1.00], "comprobacion_porcentaje": 10, "comprobacion_tras_anticipada": 100, "comprobacion_segundos": 60}'::jsonb then
    raise exception 'FALLO: valores predeterminados: %', r; end if;
  v := public.maraton_crear('de990000-0000-4000-8000-000000000031', jsonb_build_object('titulo', 'A',
         'config', jsonb_build_object('avanzado', jsonb_build_object('comprobacion_porcentaje', 0, 'comprobacion_tras_anticipada', 0),
                                      'informes', jsonb_build_object('publicacion_estudiante', pg_temp.hoy()))));
  insert into ids values ('A', v);
  insert into ids values ('B', public.maraton_crear('de990000-0000-4000-8000-000000000031', '{"titulo":"B","config":{"avanzado":{"comprobacion_porcentaje":100}}}'));
  insert into ids values ('C', public.maraton_crear('de990000-0000-4000-8000-000000000031',
    '{"titulo":"C","config":{"carga":{"cuota":6,"minutos_minimos":0},"avanzado":{"comprobacion_porcentaje":0,"comprobacion_tras_anticipada":0}}}'));
  insert into ids values ('D', public.maraton_crear('de990000-0000-4000-8000-000000000031', '{"titulo":"D","config":{"avanzado":{"activo":false}}}'));
  insert into ids values ('E', public.maraton_crear('de990000-0000-4000-8000-000000000031',
    '{"titulo":"E","config":{"avanzado":{"comprobacion_porcentaje":0,"comprobacion_tras_anticipada":100}}}'));
  for r in select to_jsonb(i) from ids i loop
    perform public.maraton_guardar((r ->> 'id')::uuid, jsonb_build_object('fecha_inicio', pg_temp.hoy()));
    perform public.maraton_cambiar_estado((r ->> 'id')::uuid, 'publicado');
  end loop;
end $$;
reset role;

-- 2) S1: D2→D6 acertando; tras el D6 llega un D7 de 3 etapas, invisible para el estudiante
do $$ declare m uuid := (select id from ids where nombre = 'A'); u uuid := pg_temp.u(11); k integer; x public.maraton_presentaciones;
  j public.maraton_jornadas; r jsonb; v_id uuid; v_idem uuid := gen_random_uuid();
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 5 loop perform pg_temp.resolver(m, u, true, 300); end loop;   -- D2, D3, D4, D5, D6
  x := pg_temp.pres(m, u);
  if x.nivel <> 7 or x.etapas_total <> 3 or x.etapa_actual <> 1 or x.comprobacion then raise exception 'FALLO: tras acertar D6 no llegó un D7 de 3 etapas: %', to_jsonb(x); end if;
  if x.peso <> 1 then raise exception 'FALLO: ponderación del D7 %', x.peso; end if;
  j := pg_temp.jornada(m, u);
  if j.intentos_validos <> 5 or j.correctas <> 5 then raise exception 'FALLO: contadores antes del D7: %', to_jsonb(j); end if;
  -- lo que ve el estudiante: ni nivel, ni total de etapas, ni si es comprobación
  perform pg_temp.como(u::text);
  r := public.maraton_estado(m);
  if r -> 'problema' ->> 'etapa' <> '1' or r -> 'problema' ? 'etapas_total' or r -> 'problema' ? 'nivel' or r -> 'problema' ? 'comprobacion'
     or r::text ~ '"nivel"' or r::text ~ 'D7' then raise exception 'FALLO: el estado revela la progresión: %', r -> 'problema'; end if;
  -- no se puede cerrar con la función de una sola respuesta ni saltar a la etapa 2
  begin perform public.svc_maraton_responder(u, x.id, gen_random_uuid(), '{"partes":["1 m/s"]}', null, 10, true, null);
    raise exception 'FALLO: cerró un problema por etapas de golpe';
  exception when sqlstate 'P0001' then null; end;
  r := pg_temp.etapa(m, u, true, 0, 2);
  if r ->> 'aviso' <> 'ya_procesada' or (select count(*) from public.maraton_respuestas_etapa where presentacion_id = x.id) <> 0 then
    raise exception 'FALLO: saltó a la etapa 2: %', r ->> 'aviso'; end if;
  -- etapa 1 → se guarda, aparece la 2 (con lo respondido, sin decir si acertó); no cuenta todavía como respuesta
  perform pg_temp.envejecer(x.id, 900);
  r := pg_temp.etapa(m, u, true, 0, 1, v_idem);
  if r -> 'problema' ->> 'etapa' <> '2' or r -> 'problema' ->> 'actual' not like 'Etapa 2%' or jsonb_array_length(r -> 'problema' -> 'previas') <> 1
     or r -> 'problema' -> 'previas' -> 0 -> 'respuesta' <> '["1 m/s"]' or (r -> 'problema')::text ~ 'correct' or r -> 'ultimo' <> 'null'::jsonb and r -> 'ultimo' is not null then
    raise exception 'FALLO: estado tras la etapa 1: %', r -> 'problema'; end if;
  if r -> 'problema' ->> 'enunciado' not like '%**Etapa 2.**%' then raise exception 'FALLO: el texto compatible no incluye la etapa 2'; end if;
  j := pg_temp.jornada(m, u);
  if j.intentos_validos <> 5 or j.presentados <> 6 then raise exception 'FALLO: una etapa contó como respuesta: %', to_jsonb(j); end if;
  -- doble envío de la misma etapa: no se registra dos veces
  r := pg_temp.etapa(m, u, true, 0, 1, v_idem);
  if r ->> 'aviso' <> 'ya_procesada' or (select count(*) from public.maraton_respuestas_etapa where presentacion_id = x.id) <> 1 then
    raise exception 'FALLO: doble envío de la etapa 1'; end if;
  -- lo entregado no se puede cambiar
  begin update public.maraton_respuestas_etapa set correcta = false where presentacion_id = x.id; raise exception 'FALLO: se modificó una etapa entregada';
  exception when insufficient_privilege then null; end;
  -- etapas 2 y 3 → el conjunto cuenta como UNA respuesta correcta y sube a D8
  perform pg_temp.etapa(m, u, true); perform pg_temp.etapa(m, u, true);
  select * into x from public.maraton_presentaciones where id = x.id;
  j := pg_temp.jornada(m, u);
  if x.resultado <> 'correcta' or x.nivel_despues <> 8 or x.unidades <> 1.00 or jsonb_array_length(x.respuesta -> 'partes') <> 3
     or jsonb_array_length(x.detalle -> 'partes') <> 3 or j.intentos_validos <> 6 or j.correctas <> 6 then
    raise exception 'FALLO: cierre del D7: % %', to_jsonb(x), to_jsonb(j); end if;
  -- D8 con la etapa 1 mal y las demás bien: respuesta parcial = incorrecta (media unidad) y vuelve a D7
  x := pg_temp.pres(m, u);
  if x.nivel <> 8 then raise exception 'FALLO: no llegó un D8'; end if;
  perform pg_temp.envejecer(x.id, 900);
  perform pg_temp.etapa(m, u, false); perform pg_temp.etapa(m, u, true); perform pg_temp.etapa(m, u, true);
  select * into x from public.maraton_presentaciones where id = x.id;
  if x.resultado <> 'incorrecta' or x.nivel_despues <> 7 or x.unidades <> 0.50 then raise exception 'FALLO: respuesta parcial en D8: %', to_jsonb(x); end if;
  -- D7, D8 bien (rápido, para no llegar aún a los 60 min de la vía B) → D9; D9 bien → sigue en D9
  perform pg_temp.resolver(m, u, true, 60); perform pg_temp.resolver(m, u, true, 60);
  x := pg_temp.pres(m, u);
  if x.nivel is distinct from 9 then raise exception 'FALLO: no llegó a D9 (%)', x.nivel; end if;
  perform pg_temp.resolver(m, u, true, 60);
  j := pg_temp.jornada(m, u);
  if j.estado <> 'en_curso' or (pg_temp.pres(m, u)).nivel is distinct from 9 then raise exception 'FALLO: D9 no se repite: %', to_jsonb(j); end if;
  -- las mismas reglas de siempre: con 60 min y 8 respuestas (y 5 aciertos) completa por la vía B
  perform pg_temp.resolver(m, u, true, 600);
  j := pg_temp.jornada(m, u);
  if j.estado <> 'completada' or j.via <> 'alternativa' then raise exception 'FALLO: no completó por la vía B: %', to_jsonb(j); end if;
  -- informe del profesor: todas las partes en orden, con la clave y la respuesta de cada etapa
  perform pg_temp.como('de990000-0000-4000-8000-000000000001');
  r := (select p from jsonb_array_elements(public.maraton_historial(m, u) -> 'presentaciones') p where (p ->> 'nivel')::int = 7 limit 1);
  if jsonb_array_length(r -> 'partes') <> 3 or jsonb_array_length(r -> 'clave' -> 'partes') <> 3 or jsonb_array_length(r -> 'etapas') <> 2
     or r -> 'etapas' -> 0 ->> 'enunciado' not like 'Etapa 2%' or r -> 'etapas' -> 1 -> 'clave' is null or (r -> 'etapas' -> 0 ->> 'correcta')::boolean is not true then
    raise exception 'FALLO: historial de un D7: %', r; end if;
end $$;

-- 3) S2: «No puedo» a mitad de un D7: se cierra como «No puedo» (sin unidades, baja a D6); lo entregado se conserva
do $$ declare m uuid := (select id from ids where nombre = 'A'); u uuid := pg_temp.u(12); k integer; x public.maraton_presentaciones; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 5 loop perform pg_temp.resolver(m, u, true, 300); end loop;
  x := pg_temp.pres(m, u);
  perform pg_temp.etapa(m, u, true, 600);
  perform pg_temp.como(u::text);
  perform public.maraton_no_puedo(x.id, gen_random_uuid(), 30, null);
  select * into x from public.maraton_presentaciones where id = x.id;
  j := pg_temp.jornada(m, u);
  if x.accion <> 'no_puedo' or x.unidades <> 0 or x.nivel_despues <> 6 or j.intentos_validos <> 5 or j.no_puedo <> 1
     or (select count(*) from public.maraton_respuestas_etapa where presentacion_id = x.id) <> 1 or (pg_temp.pres(m, u)).nivel <> 6 then
    raise exception 'FALLO: «No puedo» a mitad de etapas: % %', to_jsonb(x), to_jsonb(j); end if;
end $$;

-- 4) S3: completa la jornada exactamente al acertar el D6 (cuota 6): no se presenta un D7 y mañana empieza en D7
do $$ declare m uuid := (select id from ids where nombre = 'C'); u uuid := pg_temp.u(13); k integer; j public.maraton_jornadas; i public.maraton_inscripciones;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 5 loop perform pg_temp.resolver(m, u, true, 300); end loop;
  j := pg_temp.jornada(m, u); i := pg_temp.insc(m, u);
  if j.estado <> 'completada' or j.via <> 'cuota' or i.presentacion_actual is not null or i.nivel <> 7 then
    raise exception 'FALLO: completar al acertar el D6: % %', to_jsonb(j), to_jsonb(i); end if;
end $$;

-- 5) S4: comprobaciones al 100 %: las variantes con comprobación llevan una etapa 2 y 60 s más; las demás no
do $$ declare m uuid := (select id from ids where nombre = 'B'); u uuid := pg_temp.u(14); k integer; x public.maraton_presentaciones; n_comp integer := 0; n_sin integer := 0;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 6 loop
    x := pg_temp.pres(m, u);
    if x.nivel > 6 then exit; end if;
    if exists (select 1 from public.maraton_etapas where variante_id = x.variante_id and tipo = 'comprobacion') then
      if not x.comprobacion or x.etapas_total <> 2 or x.t_min_s <> 120 then raise exception 'FALLO: comprobación no asignada: %', to_jsonb(x); end if;
      n_comp := n_comp + 1;
    else
      if x.comprobacion or x.etapas_total <> 1 or x.t_min_s <> 60 then raise exception 'FALLO: comprobación sin etapa en el banco: %', to_jsonb(x); end if;
      n_sin := n_sin + 1;
    end if;
    perform pg_temp.resolver(m, u, true, 300);
  end loop;
  if n_comp = 0 or n_sin = 0 then raise exception 'FALLO: no se cubrieron ambos casos al 100 %% (con %, sin %)', n_comp, n_sin; end if;
end $$;
-- con 0 % (maratón A) ninguna presentación ordinaria llevó comprobación
do $$ begin
  if exists (select 1 from public.maraton_presentaciones x join public.maraton_inscripciones i on i.id = x.inscripcion_id
             where i.maraton_id = (select id from ids where nombre = 'A') and x.comprobacion) then raise exception 'FALLO: comprobación con 0 %%'; end if;
end $$;

-- 5b) S5 en E (base 0 %, 100 % tras una anticipada): la comprobación aparece SOLO después de responder antes del tiempo mínimo
do $$ declare m uuid := (select id from ids where nombre = 'E'); u uuid := pg_temp.u(15); k integer; x public.maraton_presentaciones;
  rapido boolean := false; con integer := 0; sin integer := 0;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 16 loop
    x := pg_temp.pres(m, u);
    exit when x.id is null or x.nivel > 6;
    if exists (select 1 from public.maraton_etapas where variante_id = x.variante_id and tipo = 'comprobacion') then
      if x.comprobacion is distinct from rapido then raise exception 'FALLO: comprobación % tras una respuesta % anticipada', x.comprobacion, case when rapido then '' else 'no' end; end if;
      if rapido then con := con + 1; else sin := sin + 1; end if;
    end if;
    -- alterna respuestas anticipadas (20 s, mínimo 60 s) y pausadas (300 s); falla para quedarse en niveles ordinarios
    rapido := k % 2 = 1;
    perform pg_temp.resolver(m, u, false, case when rapido then 20 else 300 end);
  end loop;
  if con = 0 or sin = 0 then raise exception 'FALLO: el sorteo no cubrió ambos casos (con %, sin %)', con, sin; end if;
end $$;

-- 6) S5: sin progresión avanzada, acertar el D6 deja en D6 (como antes)
do $$ declare m uuid := (select id from ids where nombre = 'D'); u uuid := pg_temp.u(15); k integer;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 6 loop perform pg_temp.resolver(m, u, true, 300); end loop;
  if (pg_temp.pres(m, u)).nivel <> 6 or exists (select 1 from public.maraton_presentaciones x join public.maraton_inscripciones i on i.id = x.inscripcion_id
      where i.maraton_id = (select id from ids where nombre = 'D') and x.nivel > 6) then raise exception 'FALLO: sin progresión avanzada pasó de D6'; end if;
end $$;

-- 7) informe del estudiante sin niveles ni respuestas anticipadas
do $$ declare r jsonb; begin
  perform pg_temp.como(pg_temp.u(11)::text);
  r := public.maraton_mi_informe((select id from ids where nombre = 'A'));
  if r -> 'resumen' ?| array['nivel_maximo', 'nivel_maximo_correcto', 'extremos_resueltos', 'por_nivel', 'anticipadas']
     or r -> 'resumen' -> 'por_jornada' -> 0 ?| array['nivel_medio', 'nivel_maximo', 'anticipadas'] then
    raise exception 'FALLO: el informe del estudiante muestra niveles: %', r -> 'resumen'; end if;
end $$;

-- 8) recorrido de prueba del profesor con etapas: reiniciarlo borra también las etapas entregadas
do $$ declare m uuid := (select id from ids where nombre = 'A'); t uuid := 'de990000-0000-4000-8000-000000000001'; k integer; begin
  perform pg_temp.como(t::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 5 loop perform pg_temp.resolver(m, t, true, 300); end loop;
  perform pg_temp.etapa(m, t, true, 600);
  if not exists (select 1 from public.maraton_respuestas_etapa r join public.maraton_inscripciones i on i.id = r.inscripcion_id where i.user_id = t) then
    raise exception 'FALLO: la prueba del profesor no registró etapas'; end if;
  perform pg_temp.como(t::text);
  perform public.maraton_reiniciar_prueba(m);
  if exists (select 1 from public.maraton_inscripciones where maraton_id = m and user_id = t) then raise exception 'FALLO: no se reinició la prueba'; end if;
  -- y el de un estudiante no se puede borrar
  begin delete from public.maraton_respuestas_etapa where inscripcion_id = (pg_temp.insc(m, pg_temp.u(11))).id; raise exception 'FALLO: se borró una etapa de un estudiante';
  exception when insufficient_privilege then null; end;
end $$;

-- 9) permisos: el estudiante no puede llamar a las funciones del servidor de calificación ni leer las tablas nuevas
set local role authenticated;
select pg_temp.como('de990000-0000-4000-8000-000000000011');
do $$ begin
  begin perform public.svc_maraton_etapa(pg_temp.u(11), gen_random_uuid(), gen_random_uuid(), 1, '{}', null, 1, true, null); raise exception 'FALLO: svc_maraton_etapa accesible';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.maraton_etapas_claves; raise exception 'FALLO: claves de etapas legibles';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.maraton_respuestas_etapa; raise exception 'FALLO: respuestas de etapas legibles';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'maraton_avanzado: PRUEBAS PASARON' as resultado;
rollback;
