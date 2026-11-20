-- Pruebas: Entrenador (migración 107). Se deshace al final.
-- Banco sintético: 2 temas × 3 plantillas × 4 variantes (nivel 1). Profesor T de la sección A; estudiantes S1, S2 en A;
-- S3 en otra sección B; S4 en A con baja vigente no se prueba aquí (baja_vigente tiene sus propias pruebas).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('de107000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid, 'e' || k || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
         case when k = 1 then '{"login_id":"prof-ent","aula_role":"teacher"}' else json_build_object('login_id', 'sint-ent-s' || (k - 10))::text end::jsonb,
         '{}', now(), now()
  from unnest(array[1, 11, 12, 13]) k;
update public.profiles set must_change_password = false, active = true where id::text like 'de107000-%';
update public.profiles set role = 'teacher' where id = 'de107000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de107000-0000-4000-8000-000000000021', 'Curso de prueba ENT');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de107000-0000-4000-8000-000000000031', 'de107000-0000-4000-8000-000000000021', 'Sección A', 'ENTRE001', 'de107000-0000-4000-8000-000000000001'),
  ('de107000-0000-4000-8000-000000000032', 'de107000-0000-4000-8000-000000000021', 'Sección B', 'ENTRE002', 'de107000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('de107000-0000-4000-8000-000000000031', 'de107000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de107000-0000-4000-8000-000000000031', 'de107000-0000-4000-8000-000000000011'),
  ('de107000-0000-4000-8000-000000000031', 'de107000-0000-4000-8000-000000000012'),
  ('de107000-0000-4000-8000-000000000032', 'de107000-0000-4000-8000-000000000013');

insert into public.maraton_bancos (id, nombre, cursos) values ('prueba-ent', 'Banco de prueba', array['de107000-0000-4000-8000-000000000021'::uuid]);
insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado, orden) values
  ('prueba-ent', 'ta', 'Tema A', 'alta', 'verificado', 1), ('prueba-ent', 'tb', 'Tema B', 'alta', 'verificado', 2);
insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
  select 'ent.' || t || '.p' || n, 'prueba-ent', t, 1, 'Plantilla ' || t || n, 60, 600, 'validada'
  from unnest(array['ta', 'tb']) t cross join generate_series(1, 3) n;
insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
  select p.id || '#' || v, p.id, v, 'Enunciado ' || p.id || ' variante ' || v, '[{"etiqueta":"Rapidez","unidad":"m/s"}]'
  from public.maraton_plantillas p cross join generate_series(1, 4) v where p.banco_id = 'prueba-ent';
insert into public.maraton_claves (variante_id, clave, solucion)
  select id, '{"partes":[{"format":"numeric","value":"7.77 m/s"}]}', 'SOLUCION-SECRETA' from public.maraton_variantes where plantilla_id like 'ent.%';
insert into public.entrenadores (id, class_id, banco_id, titulo, created_by) values
  ('de107000-0000-4000-8000-000000000041', 'de107000-0000-4000-8000-000000000031', 'prueba-ent', 'Entrenador A', 'de107000-0000-4000-8000-000000000001');

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;
create function pg_temp.u(k integer) returns uuid language sql as $$ select ('de107000-0000-4000-8000-0000000000' || lpad(k::text, 2, '0'))::uuid $$;

do $$
declare
  ent uuid := 'de107000-0000-4000-8000-000000000041';
  r jsonb; r2 jsonb; ej uuid; ej2 uuid; idem uuid := gen_random_uuid(); n integer; vistas text[] := '{}'; ok boolean;
begin
  -- 1) el estudiante de la sección lo ve; el de otra sección no
  perform pg_temp.como(pg_temp.u(11)::text);
  set local role authenticated;
  r := public.entrenador_mis();
  if jsonb_array_length(r) <> 1 or r -> 0 ->> 'titulo' <> 'Entrenador A' then raise exception 'S1 debería ver su entrenador: %', r; end if;
  r := public.entrenador_estado(ent);
  if r -> 'actual' <> 'null'::jsonb or jsonb_array_length(r -> 'temas') <> 2 then raise exception 'estado inicial: %', r; end if;
  reset role;
  perform pg_temp.como(pg_temp.u(13)::text);
  set local role authenticated;
  if jsonb_array_length(public.entrenador_mis()) <> 0 then raise exception 'S3 (otra sección) no debería verlo'; end if;
  begin
    perform public.entrenador_estado(ent);
    raise exception 'S3 no debería tener acceso';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 2) el estudiante no puede leer las tablas ni las claves directamente, ni llamar a las svc_*
  perform pg_temp.como(pg_temp.u(11)::text);
  set local role authenticated;
  begin perform 1 from public.entrenador_ejercicios; raise exception 'lectura directa permitida'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.maraton_claves; raise exception 'claves legibles'; exception when insufficient_privilege then null; end;
  begin perform public.svc_entrenador_clave(pg_temp.u(11), gen_random_uuid()); raise exception 'svc accesible'; exception when insufficient_privilege then null; end;

  -- 3) siguiente: un ejercicio abierto, sin solución ni valores; pedir otro devuelve el mismo
  r := public.entrenador_siguiente(ent);
  ej := (r -> 'actual' ->> 'id')::uuid;
  if ej is null or r -> 'actual' ->> 'estado' <> 'abierto' then raise exception 'debería haber ejercicio abierto: %', r; end if;
  if r::text like '%SOLUCION-SECRETA%' or r::text like '%7.77%' then raise exception 'filtró la clave o la solución: %', r; end if;
  if (public.entrenador_siguiente(ent) -> 'actual' ->> 'id')::uuid <> ej then raise exception 'con uno abierto debe devolver el mismo'; end if;
  begin perform public.entrenador_siguiente(ent, 'inexistente'); raise exception 'tema desconocido aceptado'; exception when invalid_parameter_value then null; end;
  reset role;

  -- 4) la Edge Function: clave del ejercicio abierto; 1.ª respuesta incorrecta → sigue abierto, sin solución
  r := public.svc_entrenador_clave(pg_temp.u(11), ej);
  if not (r ->> 'abierto')::boolean or r -> 'clave' -> 'partes' -> 0 ->> 'value' <> '7.77 m/s' then raise exception 'svc clave: %', r; end if;
  begin perform public.svc_entrenador_clave(pg_temp.u(12), ej); raise exception 'S2 obtuvo la clave de S1'; exception when insufficient_privilege then null; end;
  r := public.svc_entrenador_responder(pg_temp.u(11), ej, idem, '["5 m/s"]', false, '{"partes":[{"correcta":false}]}', 30);
  if not (r ->> 'registrada')::boolean or r -> 'ejercicio' ->> 'estado' <> 'abierto' or r -> 'ejercicio' -> 'solucion' <> 'null'::jsonb then
    raise exception '1.ª incorrecta: %', r; end if;
  -- doble envío: no escribe
  r := public.svc_entrenador_responder(pg_temp.u(11), ej, idem, '["5 m/s"]', false, null, 30);
  if (r ->> 'registrada')::boolean or (select count(*) from public.entrenador_respuestas where ejercicio_id = ej) <> 1 then raise exception 'idempotencia: %', r; end if;
  -- 2.ª incorrecta → agotado, con solución y valores
  r := public.svc_entrenador_responder(pg_temp.u(11), ej, gen_random_uuid(), '["6 m/s"]', false, null, 40);
  if r -> 'ejercicio' ->> 'estado' <> 'agotado' or r -> 'ejercicio' ->> 'solucion' <> 'SOLUCION-SECRETA' or r -> 'ejercicio' -> 'valores' ->> 0 <> '7.77 m/s' then
    raise exception '2.ª incorrecta: %', r; end if;
  -- cerrado: ya no da la clave ni registra
  if (public.svc_entrenador_clave(pg_temp.u(11), ej) -> 'clave') <> 'null'::jsonb then raise exception 'clave de un ejercicio cerrado'; end if;
  r := public.svc_entrenador_responder(pg_temp.u(11), ej, gen_random_uuid(), '["7.77 m/s"]', true, null, 40);
  if (r ->> 'registrada')::boolean then raise exception 'registró en un ejercicio cerrado'; end if;
  if (select segundos from public.entrenador_ejercicios where id = ej) > 40 then raise exception 'segundos acreditados de más'; end if;

  -- 5) siguiente ejercicio: correcto al primer intento
  perform pg_temp.como(pg_temp.u(11)::text);
  set local role authenticated;
  ej2 := (public.entrenador_siguiente(ent) -> 'actual' ->> 'id')::uuid;
  if ej2 = ej then raise exception 'no avanzó'; end if;
  reset role;
  r := public.svc_entrenador_responder(pg_temp.u(11), ej2, gen_random_uuid(), '["7.77 m/s"]', true, null, 20);
  if r -> 'ejercicio' ->> 'estado' <> 'correcto' or (r -> 'resumen' ->> 'primer_intento')::int <> 1 or (r -> 'resumen' ->> 'ejercicios')::int <> 2 then
    raise exception 'correcto: %', r; end if;

  -- 6) «Ver la solución» y no repetir variante ni tipo reciente
  perform pg_temp.como(pg_temp.u(11)::text);
  set local role authenticated;
  for n in 1..6 loop
    r := public.entrenador_siguiente(ent, 'ta');
    if r -> 'actual' ->> 'tema' <> 'ta' then raise exception 'filtro por tema: %', r; end if;
    r2 := public.entrenador_ver_solucion((r -> 'actual' ->> 'id')::uuid);
    if r2 ->> 'estado' <> 'solucion' or r2 ->> 'solucion' <> 'SOLUCION-SECRETA' then raise exception 'ver solución: %', r2; end if;
  end loop;
  reset role;
  select array_agg(variante_id) into vistas from public.entrenador_ejercicios where user_id = pg_temp.u(11) and entrenador_id = ent;
  if (select count(distinct v) from unnest(vistas) v) <> array_length(vistas, 1) then raise exception 'repitió variante: %', vistas; end if;
  -- tres seguidos del tema A (3 plantillas): no repite plantilla en los tres primeros del tema
  if (select count(distinct plantilla_id) from (select plantilla_id from public.entrenador_ejercicios
        where user_id = pg_temp.u(11) and tema = 'ta' order by presentado_at desc limit 3) s) < 3 then raise exception 'repitió tipo reciente'; end if;

  -- 7) S2 no puede ver la solución de un ejercicio de S1
  perform pg_temp.como(pg_temp.u(12)::text);
  set local role authenticated;
  begin perform public.entrenador_ver_solucion(ej); raise exception 'S2 vio un ejercicio de S1'; exception when insufficient_privilege then null; end;
  -- ni el informe
  begin perform public.entrenador_informe(ent); raise exception 'estudiante leyó el informe'; exception when insufficient_privilege then null; end;
  reset role;

  -- 8) profesor: informe, detalle, recorrido de prueba fuera del informe, activar/desactivar
  perform pg_temp.como(pg_temp.u(1)::text);
  set local role authenticated;
  r := public.entrenador_siguiente(ent);
  if not (r ->> 'prueba')::boolean then raise exception 'el profesor debería entrar en modo prueba'; end if;
  r := public.entrenador_informe(ent);
  if jsonb_array_length(r -> 'estudiantes') <> 2 then raise exception 'informe estudiantes: %', r; end if;
  if (select (x -> 'resumen' ->> 'ejercicios')::int from jsonb_array_elements(r -> 'estudiantes') x where x ->> 'user_id' = pg_temp.u(11)::text) <> 8 then
    raise exception 'resumen S1 en informe: %', r; end if;
  if (select sum((t ->> 'ejercicios')::int) from jsonb_array_elements(r -> 'temas') t) <> 8 then raise exception 'temas (sin prueba): %', r -> 'temas'; end if;
  r := public.entrenador_detalle(ent, pg_temp.u(11));
  if jsonb_array_length(r) <> 8 or r -> -1 -> 'respuestas' -> 1 -> 'partes' ->> 0 <> '6 m/s' then raise exception 'detalle: %', r -> -1; end if;
  if jsonb_array_length(public.entrenador_de_clase('de107000-0000-4000-8000-000000000031')) <> 1 then raise exception 'de_clase'; end if;
  perform public.entrenador_activar(ent, false);
  reset role;
  perform pg_temp.como(pg_temp.u(12)::text);
  set local role authenticated;
  if jsonb_array_length(public.entrenador_mis()) <> 0 then raise exception 'desactivado: no debería listarse'; end if;
  begin perform public.entrenador_siguiente(ent); raise exception 'desactivado: no debería dar ejercicios'; exception when insufficient_privilege then null; end;
  begin perform public.entrenador_activar(ent, true); raise exception 'estudiante activó'; exception when insufficient_privilege then null; end;
  reset role;

  -- 9) las respuestas no se pueden alterar
  ok := false;
  begin
    update public.entrenador_respuestas set correcta = true where ejercicio_id = ej;
  exception when raise_exception then
    ok := sqlerrm like '%no se pueden alterar%';
  end;
  if not ok then raise exception 'una respuesta del Entrenador se pudo alterar'; end if;
end $$;

select 'entrenador.sql: PRUEBAS PASARON' as resultado;
rollback;
