-- Pruebas: Maratón — reglas de permanencia (migración 98). Se deshace al final.
-- Banco sintético (2 temas × 6 niveles × 10 variantes; tiempo mínimo 60 s). Profesor T; estudiantes S1…S7 en la sección A.
-- P (reglas predeterminadas, empieza hoy): S1 «No puedo» ×26, S2 falla ×14, S3 necesita el 5.º acierto para completar,
-- S4 agota los 30 problemas, S5 resuelve un D6 en 30 s. Q (empieza hoy y se retrasa dos días): S7 deja de venir.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('de980000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'p' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k = 1 then '{"login_id":"prof-perm","aula_role":"teacher"}' else json_build_object('login_id', 'sint-perm-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 11, 12, 13, 14, 15, 17]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'de980000-%';
update public.profiles set role = 'teacher' where id = 'de980000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de980000-0000-4000-8000-000000000021', 'Curso permanencia');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de980000-0000-4000-8000-000000000031', 'de980000-0000-4000-8000-000000000021', 'Sección A', 'PERMA001', 'de980000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('de980000-0000-4000-8000-000000000031', 'de980000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'de980000-0000-4000-8000-000000000031', ('de980000-0000-4000-8000-0000000000' || k)::uuid from unnest(array[11, 12, 13, 14, 15, 17]) k;

insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-perm', 'Banco de prueba', array['de980000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values
  ('prueba-perm', 'pa', 'Tema A', 'alta', 'verificado', 1), ('prueba-perm', 'pb', 'Tema B', 'alta', 'verificado', 2);
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'pp.' || t || '.d' || n, 'prueba-perm', t, n, 'Plantilla ' || t || n, 60, 600, 'validada'
  from unnest(array['pa', 'pb']) t cross join generate_series(1, 6) n;
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id || ' variante ' || v, '[{"etiqueta":"v","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 10) v where p.banco_id = 'prueba-perm';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', 'solución' from public.maraton_variantes where plantilla_id like 'pp.%';

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns uuid language sql as $$ select ('de980000-0000-4000-8000-0000000000' || k)::uuid $$;
create function pg_temp.pres(p_m uuid, p_u uuid) returns uuid language sql as $$
  select presentacion_actual from public.maraton_inscripciones where maraton_id = p_m and user_id = p_u
$$;
create function pg_temp.envejecer(p uuid, s integer) returns void language plpgsql as $$ begin
  perform set_config('maraton.ajuste_tiempo', 'si', true);
  update public.maraton_presentaciones set presentada_at = presentada_at - make_interval(secs => s) where id = p;
  perform set_config('maraton.ajuste_tiempo', 'no', true);
end $$;
create function pg_temp.resp(p_m uuid, p_u uuid, p_ok boolean, s integer) returns void language plpgsql as $$
declare p uuid := pg_temp.pres(p_m, p_u); begin
  if p is null then raise exception 'FALLO: no hay problema abierto'; end if;
  perform pg_temp.envejecer(p, s);
  perform public.svc_maraton_responder(p_u, p, gen_random_uuid(), '{"partes":["1 m/s"]}', 'procedimiento', s, p_ok, null);
end $$;
create function pg_temp.np(p_m uuid, p_u uuid) returns void language plpgsql as $$
declare p uuid := pg_temp.pres(p_m, p_u); begin
  if p is null then raise exception 'FALLO: no hay problema abierto'; end if;
  perform pg_temp.como(p_u::text);
  perform public.maraton_no_puedo(p, gen_random_uuid(), 5, null);
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

-- 1) Valores predeterminados, validación y publicación (como profesor)
set local role authenticated;
select pg_temp.como('de980000-0000-4000-8000-000000000001');
do $$ declare v uuid; r jsonb; begin
  begin perform public.maraton_crear('de980000-0000-4000-8000-000000000031', '{"config":{"permanencia":{"min_correctas":19}}}'); raise exception 'FALLO: aceptó mínimo > intentos';
  exception when invalid_parameter_value then null; end;
  begin perform public.maraton_crear('de980000-0000-4000-8000-000000000031', '{"config":{"permanencia":{"fuera_rapido_nivel":9}}}'); raise exception 'FALLO: aceptó nivel 9';
  exception when invalid_parameter_value then null; end;
  v := public.maraton_crear('de980000-0000-4000-8000-000000000031', '{"titulo":"P"}');
  insert into ids values ('P', v);
  r := public.maraton_detalle_docente(v) -> 'config' -> 'permanencia';
  if r <> '{"min_correctas": 5, "fuera_por_presentados": true, "fuera_por_continuidad": true, "fuera_rapido_nivel": 6, "fuera_rapido_segundos": 60}'::jsonb then
    raise exception 'FALLO: valores predeterminados: %', r; end if;
  insert into ids values ('Q', public.maraton_crear('de980000-0000-4000-8000-000000000031', '{"titulo":"Q"}'));
  for r in select to_jsonb(i) from ids i loop
    perform public.maraton_guardar((r ->> 'id')::uuid, jsonb_build_object('fecha_inicio', pg_temp.hoy()));
    perform public.maraton_cambiar_estado((r ->> 'id')::uuid, 'publicado');
  end loop;
end $$;
-- el estudiante conoce las reglas antes de empezar
select pg_temp.como('de980000-0000-4000-8000-000000000011');
do $$ declare r jsonb := public.maraton_estado((select id from ids where nombre = 'P')) -> 'maraton' -> 'permanencia'; begin
  if r <> '{"min_correctas": 5, "presentados_max": 30, "continuidad": true, "rapido_segundos": 60}'::jsonb then raise exception 'FALLO: reglas para el estudiante: %', r; end if;
end $$;
reset role;

-- 2) «No puedo» una y otra vez (S1): con 26 presentados y ningún acierto ya no llega a 5 en 30 → fuera
do $$ declare m uuid := (select id from ids where nombre = 'P'); u uuid := pg_temp.u(11); k integer; j public.maraton_jornadas; i public.maraton_inscripciones; r jsonb;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 25 loop perform pg_temp.np(m, u); end loop;
  j := pg_temp.jornada(m, u);
  if j.estado <> 'en_curso' or j.presentados <> 26 or (pg_temp.insc(m, u)).fuera_at is not null then raise exception 'FALLO: salió antes de tiempo: %', to_jsonb(j); end if;
  perform pg_temp.np(m, u);
  j := pg_temp.jornada(m, u); i := pg_temp.insc(m, u);
  if i.fuera_tipo is distinct from 'aciertos' or i.fuera_jornada <> 1 or j.estado <> 'incompleta' or i.presentacion_actual is not null then
    raise exception 'FALLO: «no puedo» ×26 no dejó fuera: % %', to_jsonb(i), to_jsonb(j); end if;
  -- no puede seguir: ni problema nuevo ni jornada nueva; el estado lo dice sin detalles internos
  perform pg_temp.como(u::text);
  r := public.maraton_iniciar(m);
  if r -> 'problema' <> 'null'::jsonb and r -> 'problema' is not null then raise exception 'FALLO: recibió otro problema estando fuera'; end if;
  if r -> 'fuera' ->> 'tipo' <> 'aciertos' or r -> 'fuera' ? 'motivo' then raise exception 'FALLO: estado del estudiante fuera: %', r -> 'fuera'; end if;
  if not exists (select 1 from public.maraton_eventos where maraton_id = m and user_id = u and tipo = 'fuera_del_maraton') then raise exception 'FALLO: sin evento'; end if;
end $$;

-- 3) Fallar respuestas (S2): con 14 respuestas sin acierto quedan 4 intentos de 18 → fuera
do $$ declare m uuid := (select id from ids where nombre = 'P'); u uuid := pg_temp.u(12); k integer; i public.maraton_inscripciones;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 13 loop perform pg_temp.resp(m, u, false, 60); end loop;
  if (pg_temp.insc(m, u)).fuera_at is not null or (pg_temp.jornada(m, u)).estado <> 'en_curso' then raise exception 'FALLO: S2 salió antes del intento 14'; end if;
  perform pg_temp.resp(m, u, false, 60);
  i := pg_temp.insc(m, u);
  if i.fuera_tipo is distinct from 'aciertos' or i.fuera_motivo not like '%mínimo de 5%' then raise exception 'FALLO: S2: %', to_jsonb(i); end if;
end $$;

-- 4) El mínimo de aciertos es requisito para completar (S3): con 4 aciertos, 60 min y 10 intentos no completa; con el 5.º sí
do $$ declare m uuid := (select id from ids where nombre = 'P'); u uuid := pg_temp.u(13); k integer; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 4 loop perform pg_temp.resp(m, u, true, 120); end loop;     -- D2 → D6
  for k in 1 .. 6 loop perform pg_temp.resp(m, u, false, 600); end loop;    -- 4080 s, 10 intentos válidos
  j := pg_temp.jornada(m, u);
  if j.estado <> 'en_curso' or j.correctas <> 4 or j.segundos < 3600 or j.intentos_validos < 8 then
    raise exception 'FALLO: completó sin el mínimo de aciertos: %', to_jsonb(j); end if;
  perform pg_temp.resp(m, u, true, 120);
  j := pg_temp.jornada(m, u);
  if j.estado <> 'completada' or j.via <> 'alternativa' or j.correctas <> 5 or (pg_temp.insc(m, u)).fuera_at is not null then
    raise exception 'FALLO: no completó con el 5.º acierto: %', to_jsonb(j); end if;
end $$;

-- 5) Agotar los 30 problemas sin completar (S4): 5 aciertos y 25 «No puedo» → fuera por presentados
do $$ declare m uuid := (select id from ids where nombre = 'P'); u uuid := pg_temp.u(14); k integer; i public.maraton_inscripciones;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 5 loop perform pg_temp.resp(m, u, true, 120); end loop;
  for k in 1 .. 24 loop perform pg_temp.np(m, u); end loop;
  if (pg_temp.insc(m, u)).fuera_at is not null or (pg_temp.jornada(m, u)).presentados <> 30 then raise exception 'FALLO: S4 antes del problema 30: %', to_jsonb(pg_temp.jornada(m, u)); end if;
  perform pg_temp.np(m, u);
  i := pg_temp.insc(m, u);
  if i.fuera_tipo is distinct from 'presentados' then raise exception 'FALLO: S4: % %', to_jsonb(i), to_jsonb(pg_temp.jornada(m, u)); end if;
end $$;

-- 6) Rapidez (S5): un D5 bien en 30 s no saca; un D6 bien en 30 s sí
do $$ declare m uuid := (select id from ids where nombre = 'P'); u uuid := pg_temp.u(15); k integer; i public.maraton_inscripciones; r jsonb;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 3 loop perform pg_temp.resp(m, u, true, 120); end loop;     -- D2, D3, D4
  perform pg_temp.resp(m, u, true, 30);                                      -- D5 en 30 s
  if (pg_temp.insc(m, u)).fuera_at is not null then raise exception 'FALLO: un D5 rápido dejó fuera'; end if;
  perform pg_temp.resp(m, u, true, 30);                                      -- D6 en 30 s
  i := pg_temp.insc(m, u);
  if i.fuera_tipo is distinct from 'rapidez' or i.fuera_motivo not like '%(D6) en 30 s%' then raise exception 'FALLO: S5: %', to_jsonb(i); end if;
  perform pg_temp.como(u::text);
  r := public.maraton_estado(m);
  if r::text like '%D6%' or r -> 'fuera' ->> 'tipo' <> 'rapidez' then raise exception 'FALLO: el estudiante ve detalles internos: %', r -> 'fuera'; end if;
end $$;

-- 7) Continuidad (S7 en Q): inicia la jornada 1, el calendario avanza dos días → informe la marca pendiente; al volver, fuera
do $$ declare m uuid := (select id from ids where nombre = 'Q'); u uuid := pg_temp.u(17); r jsonb; i public.maraton_inscripciones;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  update public.maraton_actividades set fecha_inicio = pg_temp.hoy() - 2 where id = m;
  perform pg_temp.como('de980000-0000-4000-8000-000000000001');
  r := (select e from jsonb_array_elements(public.maraton_resumen(m) -> 'estudiantes') e where e ->> 'user_id' = u::text);
  if (r ->> 'continuidad_pendiente')::int is distinct from 1 or r -> 'fuera' <> 'null'::jsonb then raise exception 'FALLO: resumen sin continuidad pendiente: %', r; end if;
  perform pg_temp.como(u::text);
  r := public.maraton_iniciar(m);
  i := pg_temp.insc(m, u);
  if i.fuera_tipo is distinct from 'continuidad' or i.fuera_jornada <> 1 or r -> 'fuera' ->> 'tipo' <> 'continuidad'
     or (r -> 'problema' <> 'null'::jsonb and r -> 'problema' is not null) then
    raise exception 'FALLO: continuidad: % %', to_jsonb(i), r; end if;
  if (select estado from public.maraton_jornadas where inscripcion_id = i.id and numero = 1) <> 'incompleta' then raise exception 'FALLO: la jornada 1 no quedó incompleta'; end if;
end $$;

-- 8) Reincorporación: solo el profesor, con motivo; justifica lo que lo dejó fuera y puede seguir
select pg_temp.como('de980000-0000-4000-8000-000000000017');
set local role authenticated;
do $$ begin
  begin perform public.maraton_reincorporar((select id from ids where nombre = 'Q'), 'de980000-0000-4000-8000-000000000017', 'me reincorporo');
    raise exception 'FALLO: el estudiante se reincorporó solo'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('de980000-0000-4000-8000-000000000001');
do $$ declare q uuid := (select id from ids where nombre = 'Q'); p uuid := (select id from ids where nombre = 'P'); h jsonb; begin
  begin perform public.maraton_reincorporar(q, 'de980000-0000-4000-8000-000000000017', ''); raise exception 'FALLO: sin motivo';
  exception when invalid_parameter_value then null; end;
  begin perform public.maraton_reincorporar(p, 'de980000-0000-4000-8000-000000000013', 'no está fuera'); raise exception 'FALLO: reincorporó a quien no estaba fuera';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  h := public.maraton_historial(p, 'de980000-0000-4000-8000-000000000015');
  if h -> 'inscripcion' -> 'fuera' ->> 'motivo' not like '%(D6)%' then raise exception 'FALLO: el profesor no ve el motivo: %', h -> 'inscripcion' -> 'fuera'; end if;
  h := public.maraton_reincorporar(q, 'de980000-0000-4000-8000-000000000017', 'Falla de conexión comprobada');
  if h -> 'inscripcion' -> 'fuera' <> 'null'::jsonb then raise exception 'FALLO: sigue fuera: %', h -> 'inscripcion'; end if;
  if (select count(*) from jsonb_array_elements(h -> 'incidencias') x where x ->> 'tipo' = 'justificacion') <> 2
     or not exists (select 1 from jsonb_array_elements(h -> 'incidencias') x where x ->> 'tipo' = 'nota' and x ->> 'motivo' like 'Reincorporación%') then
    raise exception 'FALLO: incidencias de la reincorporación: %', h -> 'incidencias'; end if;
  perform public.maraton_reincorporar(p, 'de980000-0000-4000-8000-000000000011', 'Revisado con el estudiante');
end $$;
reset role;
do $$ declare q uuid := (select id from ids where nombre = 'Q'); p uuid := (select id from ids where nombre = 'P'); r jsonb; begin
  -- S7: jornadas 1 y 2 justificadas; hoy (jornada 3) trabaja con normalidad
  perform pg_temp.como('de980000-0000-4000-8000-000000000017');
  r := public.maraton_iniciar(q);
  if r -> 'fuera' <> 'null'::jsonb and r -> 'fuera' is not null or r -> 'problema' ->> 'presentacion_id' is null or (r -> 'jornada' ->> 'numero')::int <> 3 then
    raise exception 'FALLO: S7 no pudo seguir tras reincorporarse: %', r; end if;
  if (select array_agg(estado order by numero) from public.maraton_jornadas j join public.maraton_inscripciones i on i.id = j.inscripcion_id
       where i.maraton_id = q and i.user_id = 'de980000-0000-4000-8000-000000000017') <> array['justificada', 'justificada', 'en_curso'] then
    raise exception 'FALLO: jornadas de S7 tras reincorporarse'; end if;
  -- S1: la jornada de hoy quedó justificada (no se reabre sola) y ya no está fuera
  perform pg_temp.como('de980000-0000-4000-8000-000000000011');
  r := public.maraton_iniciar(p);
  if r -> 'fuera' <> 'null'::jsonb and r -> 'fuera' is not null or r -> 'jornada' ->> 'estado' <> 'justificada' then raise exception 'FALLO: S1 tras reincorporarse: %', r; end if;
end $$;

select 'maraton_permanencia: PRUEBAS PASARON' as resultado;
rollback;
