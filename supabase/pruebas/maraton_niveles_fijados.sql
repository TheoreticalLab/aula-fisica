-- Pruebas: Maratón — rango de niveles fijado por el profesor (migración 104). Se deshace al final.
-- Banco sintético: 2 temas × 9 niveles × 10 variantes; niveles 7–9 con 3 etapas; sin comprobaciones. Profesor T;
-- estudiantes S1…S3 en la sección A. S1 con rango 8–9 en la jornada 1; S2 con rango 8–9 solo en las jornadas 2–3 (hoy no
-- le afecta); S3 sin rango.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('de104000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'n' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k = 1 then '{"login_id":"prof-nf","aula_role":"teacher"}' else json_build_object('login_id', 'sint-nf-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 11, 12, 13]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'de104000-%';
update public.profiles set role = 'teacher' where id = 'de104000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de104000-0000-4000-8000-000000000021', 'Curso de prueba NF');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de104000-0000-4000-8000-000000000031', 'de104000-0000-4000-8000-000000000021', 'Sección A', 'NIVFI001', 'de104000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('de104000-0000-4000-8000-000000000031', 'de104000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id)
  select 'de104000-0000-4000-8000-000000000031', ('de104000-0000-4000-8000-0000000000' || k)::uuid from unnest(array[11, 12, 13]) k;

insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-nf', 'Banco de prueba', array['de104000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values
  ('prueba-nf', 'pa', 'Tema A', 'alta', 'verificado', 1), ('prueba-nf', 'pb', 'Tema B', 'alta', 'verificado', 2);
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'nf.' || t || '.d' || n, 'prueba-nf', t, n, 'Plantilla ' || t || n, case when n > 6 then 600 else 60 end, 3000, 'validada'
  from unnest(array['pa', 'pb']) t cross join generate_series(1, 9) n;
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id || ' variante ' || v, '[{"etiqueta":"v","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 10) v where p.banco_id = 'prueba-nf';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', 'solución' from public.maraton_variantes where plantilla_id like 'nf.%';
insert into public.maraton_etapas (variante_id, numero, tipo, enunciado, partes)
  select v.id, e, 'etapa', 'Etapa ' || e || ' de ' || v.id, '[{"etiqueta":"E","unidad":"J"}]'
  from public.maraton_variantes v join public.maraton_plantillas p on p.id = v.plantilla_id cross join generate_series(2, 3) e
  where p.banco_id = 'prueba-nf' and p.nivel > 6;
insert into public.maraton_etapas_claves (variante_id, numero, clave)
  select variante_id, numero, '{"partes":[{"format":"numeric","value":"1.414"}]}' from public.maraton_etapas where variante_id like 'nf.%';

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns uuid language sql as $$ select ('de104000-0000-4000-8000-0000000000' || k)::uuid $$;
create function pg_temp.pres(p_m uuid, p_u uuid) returns public.maraton_presentaciones language sql as $$
  select x.* from public.maraton_presentaciones x join public.maraton_inscripciones i on i.presentacion_actual = x.id
  where i.maraton_id = p_m and i.user_id = p_u
$$;
create function pg_temp.envejecer(p uuid, s integer) returns void language plpgsql as $$ begin
  perform set_config('maraton.ajuste_tiempo', 'si', true);
  update public.maraton_presentaciones set presentada_at = presentada_at - make_interval(secs => s) where id = p;
  perform set_config('maraton.ajuste_tiempo', 'no', true);
end $$;
-- responde el problema abierto completo (todas sus etapas) con el mismo resultado, como la Edge Function
create function pg_temp.resolver(p_m uuid, p_u uuid, p_ok boolean, s integer) returns void language plpgsql as $$
declare x public.maraton_presentaciones := pg_temp.pres(p_m, p_u); k integer; begin
  perform pg_temp.envejecer(x.id, s);
  if x.etapas_total = 1 then
    perform public.svc_maraton_responder(p_u, x.id, gen_random_uuid(), '{"partes":["1 m/s"]}', null, 86400, p_ok, null);
    return;
  end if;
  for k in 1 .. x.etapas_total loop
    perform public.svc_maraton_etapa(p_u, x.id, gen_random_uuid(), k, '{"partes":["1 m/s"]}', 'proc', 86400,
      p_ok, jsonb_build_object('partes', jsonb_build_array(jsonb_build_object('correcta', p_ok, 'codigo', 'x'))));
  end loop;
end $$;
create function pg_temp.insc(p_m uuid, p_u uuid) returns public.maraton_inscripciones language sql as $$
  select * from public.maraton_inscripciones where maraton_id = p_m and user_id = p_u
$$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Santo_Domingo')::date $$;
create temp table ids (nombre text primary key, id uuid);
grant all on ids to authenticated;

-- 1) Maratón publicado hoy (jornada 1), sin comprobaciones de razonamiento
set local role authenticated;
select pg_temp.como('de104000-0000-4000-8000-000000000001');
do $$ declare v uuid; begin
  v := public.maraton_crear('de104000-0000-4000-8000-000000000031',
         '{"titulo":"N","config":{"avanzado":{"comprobacion_porcentaje":0,"comprobacion_tras_anticipada":0}}}');
  insert into ids values ('M', v);
  perform public.maraton_guardar(v, jsonb_build_object('fecha_inicio', pg_temp.hoy()));
  perform public.maraton_cambiar_estado(v, 'publicado');
end $$;
reset role;

-- 2) Rangos (como los cargan los datos privados)
insert into public.maraton_niveles_fijados (maraton_id, user_id, jornada_desde, jornada_hasta, nivel_min, nivel_max, motivo)
select id, pg_temp.u(11), 1, 1, 8, 9, 'Prueba: S1 en D8–D9' from ids where nombre = 'M'
union all
select id, pg_temp.u(12), 2, 3, 8, 9, 'Prueba: S2 en D8–D9 desde mañana' from ids where nombre = 'M';

-- la función de acotar, sola
do $$ declare m uuid := (select id from ids where nombre = 'M'); begin
  if public.maraton_nivel_fijado(m, pg_temp.u(11), 1, 2, 9) <> 8 or public.maraton_nivel_fijado(m, pg_temp.u(11), 1, 7, 9) <> 8
     or public.maraton_nivel_fijado(m, pg_temp.u(11), 1, 9, 9) <> 9 or public.maraton_nivel_fijado(m, pg_temp.u(11), 2, 2, 9) <> 2
     or public.maraton_nivel_fijado(m, pg_temp.u(12), 1, 3, 9) <> 3 or public.maraton_nivel_fijado(m, pg_temp.u(12), 3, 3, 9) <> 8
     or public.maraton_nivel_fijado(m, pg_temp.u(12), 4, 3, 9) <> 3 or public.maraton_nivel_fijado(m, pg_temp.u(13), 1, 5, 9) <> 5
     or public.maraton_nivel_fijado(m, pg_temp.u(11), 1, 2, 6) <> 6 then
    raise exception 'FALLO: maraton_nivel_fijado';
  end if;
end $$;

-- 3) S1: empieza en D8 (no en D2); falla D8 → D8; «No puedo» en D8 → D8; acierta D8 → D9; acierta D9 → D9;
--    falla D9 → D8; cambiar → D8
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(11); x public.maraton_presentaciones; begin
  perform pg_temp.como(u::text);
  perform public.maraton_iniciar(m);
  x := pg_temp.pres(m, u);
  if x.nivel <> 8 or x.etapas_total <> 3 then raise exception 'FALLO: S1 no empezó en D8: %', to_jsonb(x); end if;
  perform pg_temp.resolver(m, u, false, 120);
  select * into x from public.maraton_presentaciones where id = x.id;
  if x.resultado <> 'incorrecta' or x.nivel_despues <> 8 or (pg_temp.insc(m, u)).nivel <> 8 or (pg_temp.pres(m, u)).nivel <> 8 then
    raise exception 'FALLO: tras fallar D8 bajó: % (nivel %)', to_jsonb(x), (pg_temp.pres(m, u)).nivel; end if;
  x := pg_temp.pres(m, u);
  perform pg_temp.como(u::text);
  perform public.maraton_no_puedo(x.id, gen_random_uuid(), 30, null);
  select * into x from public.maraton_presentaciones where id = x.id;
  if x.accion <> 'no_puedo' or x.nivel_despues <> 8 or (pg_temp.pres(m, u)).nivel <> 8 then raise exception 'FALLO: «No puedo» en D8 bajó: %', to_jsonb(x); end if;
  perform pg_temp.resolver(m, u, true, 120);
  if (pg_temp.pres(m, u)).nivel <> 9 then raise exception 'FALLO: acertar D8 no llevó a D9'; end if;
  perform pg_temp.resolver(m, u, true, 120);
  if (pg_temp.pres(m, u)).nivel <> 9 then raise exception 'FALLO: acertar D9 no se quedó en D9'; end if;
  perform pg_temp.resolver(m, u, false, 120);
  if (pg_temp.pres(m, u)).nivel <> 8 then raise exception 'FALLO: fallar D9 no volvió a D8'; end if;
  x := pg_temp.pres(m, u);
  perform pg_temp.como(u::text);
  perform public.maraton_cambiar(x.id, gen_random_uuid(), 30);
  if (pg_temp.pres(m, u)).nivel <> 8 or (pg_temp.pres(m, u)).id = x.id then raise exception 'FALLO: cambiar salió de D8'; end if;
  -- el estudiante no ve niveles ni rangos
  perform pg_temp.como(u::text);
  if public.maraton_estado(m)::text ~ '"nivel"' or public.maraton_estado(m)::text ~ 'fijad' then raise exception 'FALLO: el estado revela el rango: %', substring(public.maraton_estado(m)::text from '.{60}(?:"nivel"|fijad).{60}'); end if;
end $$;

-- 4) S2 (rango solo en las jornadas 2–3) y S3 (sin rango): hoy empiezan en D2 y bajan como siempre
do $$ declare m uuid := (select id from ids where nombre = 'M'); k integer; begin
  foreach k in array array[12, 13] loop
    perform pg_temp.como(pg_temp.u(k)::text);
    perform public.maraton_iniciar(m);
    if (pg_temp.pres(m, pg_temp.u(k))).nivel <> 2 then raise exception 'FALLO: S% no empezó en D2', k - 10; end if;
    perform pg_temp.resolver(m, pg_temp.u(k), false, 120);
    if (pg_temp.pres(m, pg_temp.u(k))).nivel <> 1 then raise exception 'FALLO: S% no bajó a D1', k - 10; end if;
  end loop;
end $$;

-- 5) Manda la fila más reciente: un rango nuevo 1–9 para S1 deja la progresión libre (falla D8 → D7)
insert into public.maraton_niveles_fijados (maraton_id, user_id, jornada_desde, jornada_hasta, nivel_min, nivel_max, motivo)
select id, pg_temp.u(11), 1, 1, 1, 9, 'Prueba: se libera' from ids where nombre = 'M';
do $$ declare m uuid := (select id from ids where nombre = 'M'); u uuid := pg_temp.u(11); begin
  perform pg_temp.resolver(m, u, false, 120);
  if (pg_temp.pres(m, u)).nivel <> 7 then raise exception 'FALLO: el rango nuevo no liberó la progresión (%)', (pg_temp.pres(m, u)).nivel; end if;
end $$;

-- 6) Solo se añaden filas; datos válidos
do $$ begin
  begin update public.maraton_niveles_fijados set nivel_min = 1; raise exception 'FALLO: se modificó un rango';
  exception when insufficient_privilege then null; end;
  begin delete from public.maraton_niveles_fijados where motivo like 'Prueba%'; raise exception 'FALLO: se borró un rango';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.maraton_niveles_fijados (maraton_id, user_id, jornada_desde, jornada_hasta, nivel_min, nivel_max, motivo)
    select id, pg_temp.u(13), 1, 1, 9, 8, 'Prueba: al revés' from ids where nombre = 'M';
    raise exception 'FALLO: aceptó nivel_min > nivel_max';
  exception when check_violation then null; end;
end $$;

-- 7) Permisos
do $$ begin
  if has_table_privilege('authenticated', 'public.maraton_niveles_fijados', 'select')
     or has_table_privilege('anon', 'public.maraton_niveles_fijados', 'select')
     or has_function_privilege('authenticated', 'public.maraton_nivel_fijado(uuid, uuid, integer, integer, integer)', 'execute')
     or has_function_privilege('anon', 'public.maraton_nivel_fijado(uuid, uuid, integer, integer, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.maraton_presentar(public.maraton_actividades, uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.maraton_cerrar(public.maraton_actividades, uuid, text, boolean, jsonb, text, numeric, uuid, jsonb)', 'execute') then
    raise exception 'FALLO: permisos';
  end if;
end $$;

select 'MARATÓN NIVELES FIJADOS: PRUEBAS PASARON' as resultado;
rollback;
