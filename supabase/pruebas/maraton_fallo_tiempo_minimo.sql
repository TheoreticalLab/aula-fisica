-- Pruebas: Maratón — respuesta incorrecta con fracción de unidades y tiempo mínimo de jornada (migración 97). Se deshace al final.
-- Banco sintético (2 temas × 6 niveles, tiempo mínimo 60 s). Profesor T; estudiantes S1, S2, S3 en la sección A.
-- F (predeterminado: incorrecta 0,5; mínimo 30 min) y G (regla anterior: incorrecta 1; sin mínimo).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de970000-0000-4000-8000-000000000001', 'f1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-fallo","aula_role":"teacher"}', '{}', now(), now()),
  ('de970000-0000-4000-8000-000000000011', 'f11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-fallo-s1"}', '{}', now(), now()),
  ('de970000-0000-4000-8000-000000000012', 'f12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-fallo-s2"}', '{}', now(), now()),
  ('de970000-0000-4000-8000-000000000013', 'f13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-fallo-s3"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de970000-%';
update public.profiles set role = 'teacher' where id = 'de970000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de970000-0000-4000-8000-000000000021', 'Curso fallo');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de970000-0000-4000-8000-000000000031', 'de970000-0000-4000-8000-000000000021', 'Sección A', 'FALLOA01', 'de970000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('de970000-0000-4000-8000-000000000031', 'de970000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de970000-0000-4000-8000-000000000031', 'de970000-0000-4000-8000-000000000011'),
  ('de970000-0000-4000-8000-000000000031', 'de970000-0000-4000-8000-000000000012'),
  ('de970000-0000-4000-8000-000000000031', 'de970000-0000-4000-8000-000000000013');

insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-fallo', 'Banco de prueba', array['de970000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values
  ('prueba-fallo', 'fa', 'Tema A', 'alta', 'verificado', 1), ('prueba-fallo', 'fb', 'Tema B', 'alta', 'verificado', 2);
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'pf.' || t || '.d' || n, 'prueba-fallo', t, n, 'Plantilla ' || t || n, 60, 600, 'validada'
  from unnest(array['fa', 'fb']) t cross join generate_series(1, 6) n;
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id || ' variante ' || v, '[{"etiqueta":"v","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 6) v where p.banco_id = 'prueba-fallo';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', 'solución' from public.maraton_variantes where plantilla_id like 'pf.%';

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
-- responde (vía svc, como hace la Edge Function) tras «s» segundos; devuelve la presentación cerrada
create function pg_temp.resp(p_m uuid, p_u uuid, p_ok boolean, s integer) returns public.maraton_presentaciones language plpgsql as $$
declare p uuid := pg_temp.pres(p_m, p_u); x public.maraton_presentaciones; begin
  if p is null then raise exception 'FALLO: no hay problema abierto'; end if;
  perform pg_temp.envejecer(p, s);
  perform public.svc_maraton_responder(p_u, p, gen_random_uuid(), '{"partes":["1 m/s"]}', 'procedimiento', s, p_ok, null);
  select * into x from public.maraton_presentaciones where id = p;
  return x;
end $$;
create function pg_temp.jornada(p_m uuid, p_u uuid) returns public.maraton_jornadas language sql as $$
  select j.* from public.maraton_jornadas j join public.maraton_inscripciones i on i.id = j.inscripcion_id
  where i.maraton_id = p_m and i.user_id = p_u order by j.numero desc limit 1
$$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Santo_Domingo')::date $$;
create temp table ids (nombre text primary key, id uuid);
grant all on ids to authenticated;

-- 1) Valores predeterminados y validación (como profesor)
set local role authenticated;
select pg_temp.como('de970000-0000-4000-8000-000000000001');
do $$ declare v uuid; r jsonb; begin
  begin perform public.maraton_crear('de970000-0000-4000-8000-000000000031', '{"config":{"carga":{"fraccion_fallo":1.5}}}'); raise exception 'FALLO: aceptó fracción 1,5';
  exception when invalid_parameter_value then null; end;
  begin perform public.maraton_crear('de970000-0000-4000-8000-000000000031', '{"config":{"carga":{"minutos_minimos":100}}}'); raise exception 'FALLO: aceptó mínimo > límite';
  exception when invalid_parameter_value then null; end;
  v := public.maraton_crear('de970000-0000-4000-8000-000000000031', '{"titulo":"F"}');
  insert into ids values ('F', v);
  r := public.maraton_detalle_docente(v);
  if (r -> 'config' -> 'carga' ->> 'fraccion_fallo')::numeric <> 0.5 or (r -> 'config' -> 'carga' ->> 'minutos_minimos')::numeric <> 30 then
    raise exception 'FALLO: valores predeterminados: %', r -> 'config' -> 'carga'; end if;
  insert into ids values ('G', public.maraton_crear('de970000-0000-4000-8000-000000000031', '{"titulo":"G","config":{"carga":{"fraccion_fallo":1,"minutos_minimos":0}}}'));
  for r in select to_jsonb(i) from ids i loop
    perform public.maraton_guardar((r ->> 'id')::uuid, jsonb_build_object('fecha_inicio', pg_temp.hoy()));
    perform public.maraton_cambiar_estado((r ->> 'id')::uuid, 'publicado');
  end loop;
end $$;
reset role;

-- 2) Fallar a propósito y rápido (S1 en F): cada incorrecta suma la mitad; no completa, cierra por el límite de intentos
do $$ declare m uuid := (select id from ids where nombre = 'F'); u uuid := 'de970000-0000-4000-8000-000000000011'; k integer;
  x public.maraton_presentaciones; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 18 loop
    x := pg_temp.resp(m, u, false, 60);
    if x.unidades <> round(x.peso * 0.5, 2) then raise exception 'FALLO: una incorrecta sumó % (peso %)', x.unidades, x.peso; end if;
    j := pg_temp.jornada(m, u);
    if k < 18 and j.estado <> 'en_curso' then raise exception 'FALLO: terminó en el intento % (%)', k, to_jsonb(j); end if;
  end loop;
  -- cada incorrecta vale la mitad del peso de su nivel (D1 0,5; D2 0,6 cuando el banco de prueba agota las variantes de D1)
  if j.estado <> 'cerrada_limite' or not j.revision or j.unidades >= 12 or j.correctas <> 0 or j.intentos_validos <> 18
     or j.unidades <> (select sum(round(q.peso * 0.5, 2)) from public.maraton_presentaciones q where q.jornada_id = j.id) then
    raise exception 'FALLO: el que falla rápido no terminó en revisión: %', to_jsonb(j); end if;
end $$;

-- 3) La misma conducta con la regla anterior (S1 en G): completaba la jornada en 12 intentos y 12 minutos sin un acierto
do $$ declare m uuid := (select id from ids where nombre = 'G'); u uuid := 'de970000-0000-4000-8000-000000000011'; k integer; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 12 loop perform pg_temp.resp(m, u, false, 60); end loop;
  j := pg_temp.jornada(m, u);
  if j.estado <> 'completada' or j.via <> 'cuota' or j.correctas <> 0 or j.segundos > 720 then
    raise exception 'FALLO: contrafactual de la regla anterior: %', to_jsonb(j); end if;
end $$;

-- 4) Trabajo correcto (S2 en F): llega a la cuota antes de 30 min, sigue recibiendo problemas y completa al cumplir el tiempo
do $$ declare m uuid := (select id from ids where nombre = 'F'); u uuid := 'de970000-0000-4000-8000-000000000012'; k integer;
  x public.maraton_presentaciones; j public.maraton_jornadas;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  for k in 1 .. 15 loop
    x := pg_temp.resp(m, u, true, 120);
    if x.unidades <> x.peso then raise exception 'FALLO: una correcta sumó % (peso %)', x.unidades, x.peso; end if;
    j := pg_temp.jornada(m, u);
    -- D2..D6 correctas: 1,2 + 1,4 + 1,5 + 1 × 8 = 12,1 en el undécimo intento (22 min)
    if k = 11 and (j.unidades < 12 or j.estado <> 'en_curso' or pg_temp.pres(m, u) is null) then
      raise exception 'FALLO: completó por la cuota antes del tiempo mínimo: %', to_jsonb(j); end if;
    if k < 15 and j.estado <> 'en_curso' then raise exception 'FALLO: terminó en el intento % (%)', k, to_jsonb(j); end if;
  end loop;
  if j.estado <> 'completada' or j.via <> 'cuota' or j.segundos < 1800 then raise exception 'FALLO: no completó al cumplir 30 min: %', to_jsonb(j); end if;
  if pg_temp.pres(m, u) is not null then raise exception 'FALLO: presentó otro problema tras completar'; end if;
end $$;

-- 5) «No puedo» y cambio siguen sin sumar (S3 en F)
do $$ declare m uuid := (select id from ids where nombre = 'F'); u uuid := 'de970000-0000-4000-8000-000000000013'; p uuid;
begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  p := pg_temp.pres(m, u);
  perform pg_temp.envejecer(p, 90);
  perform public.maraton_no_puedo(p, gen_random_uuid(), 90, null);
  if (select unidades from public.maraton_presentaciones where id = p) <> 0 then raise exception 'FALLO: «no puedo» sumó unidades'; end if;
end $$;

select 'maraton_fallo_tiempo_minimo: PRUEBAS PASARON' as resultado;
rollback;
