-- Pruebas: regularización de prácticas anteriores mediante evidencias (migración 45). Datos sintéticos; se deshace al final.
-- Casos del encargo: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12 y 13 (el 4, optimización de la imagen, está en Vitest).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('e8000000-0000-4000-8000-000000000001', 'ra@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-regular","aula_role":"teacher"}', '{}', now(), now()),
  ('e8000000-0000-4000-8000-000000000002', 'rb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ajeno-reg","aula_role":"teacher"}', '{}', now(), now()),
  ('e8000000-0000-4000-8000-000000000011', 'r1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-reg-1"}', '{}', now(), now()),
  ('e8000000-0000-4000-8000-000000000012', 'r2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-reg-2"}', '{}', now(), now()),
  ('e8000000-0000-4000-8000-000000000013', 'r3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-reg-3"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'e8000000-%';
update public.profiles set role = 'teacher' where id in ('e8000000-0000-4000-8000-000000000001', 'e8000000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('e8000000-0000-4000-8000-000000000021', 'Curso regularización');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('e8000000-0000-4000-8000-000000000031', 'e8000000-0000-4000-8000-000000000021', 'Sección regularización', 'REGULA01', 'e8000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('e8000000-0000-4000-8000-000000000031', 'e8000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('e8000000-0000-4000-8000-000000000031', 'e8000000-0000-4000-8000-000000000011'),
  ('e8000000-0000-4000-8000-000000000031', 'e8000000-0000-4000-8000-000000000012');
-- el estudiante 3 NO está inscrito
insert into public.activities (id, class_id, title, mode, published) values
  ('e8000000-0000-4000-8000-000000000041', 'e8000000-0000-4000-8000-000000000031', 'Práctica 1 (histórica)', 'practice', false);

set local role authenticated;

-- 0) el profesor activa el módulo con 10 posiciones provisionales
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000001', true);
do $$
declare r jsonb; c jsonb;
begin
  r := public.hist_configurar('e8000000-0000-4000-8000-000000000031', true, 'Registre solo lo que recuerde.', 7, 2, 300, 40, 10);
  if (r->>'creadas')::int <> 10 or (r->>'activas')::int <> 10 then raise exception 'FALLO: catálogo inicial %', r; end if;
  c := public.hist_config('e8000000-0000-4000-8000-000000000031');
  if jsonb_array_length(c->'practicas') <> 10 or not (c->>'abierto')::boolean then raise exception 'FALLO: configuración %', c; end if;
  if exists (select 1 from jsonb_array_elements(c->'practicas') x where not (x->>'provisional')::boolean) then raise exception 'FALLO: deberían ser provisionales'; end if;
  perform set_config('prueba.p' || (x->>'numero'), x->>'id', true) from jsonb_array_elements(c->'practicas') x;
end $$;

-- 0b) un profesor ajeno no administra la sección
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.hist_config('e8000000-0000-4000-8000-000000000031'); raise exception 'FALLO: un profesor ajeno vio la configuración';
  exception when insufficient_privilege then null; end;
  begin perform public.hist_registros('e8000000-0000-4000-8000-000000000031'); raise exception 'FALLO: un profesor ajeno vio los registros';
  exception when insufficient_privilege then null; end;
  if jsonb_array_length(public.hist_registros(null)) <> 0 then raise exception 'FALLO: «todas mis secciones» incluyó una sección ajena'; end if;
end $$;

-- 1) y 3) estudiante 1: práctica 1 por correo; sin captura NO se puede registrar
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000011', true);
do $$
declare r jsonb; s jsonb;
begin
  s := public.hist_mis_secciones();
  if jsonb_array_length(s) <> 1 or jsonb_array_length(s->0->'practicas') <> 10 then raise exception 'FALLO: el estudiante no ve el catálogo %', s; end if;
  r := public.hist_guardar('e8000000-0000-4000-8000-0000000000a1', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p1')::uuid, 'evidencia',
    'Práctica sobre las leyes de Newton', 'Problemas del plano inclinado', date '2026-09-15', false, 'correo', ' Est1@Ejemplo.COM ', null, null, null);
  if r->>'estado' <> 'borrador' or not (r->'faltantes') ? 'la captura principal del envío' then raise exception 'FALLO: borrador inicial %', r; end if;
  -- caso 3: sin captura no se registra
  r := public.hist_enviar(array['e8000000-0000-4000-8000-0000000000a1']::uuid[], true, null);
  if (r->>'registradas')::int <> 0 or r->'errores'->0->>'motivo' not like '%captura principal%' then raise exception 'FALLO: registró sin captura %', r; end if;
  -- sin aceptar la declaración tampoco
  begin perform public.hist_enviar(array['e8000000-0000-4000-8000-0000000000a1']::uuid[], false, null); raise exception 'FALLO: registró sin aceptar la declaración';
  exception when invalid_parameter_value then null; end;
  -- guardar dos veces con el mismo id no duplica
  perform public.hist_guardar('e8000000-0000-4000-8000-0000000000a1', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p1')::uuid, 'evidencia',
    'Práctica sobre las leyes de Newton', 'Problemas del plano inclinado', date '2026-09-15', false, 'correo', 'est1@ejemplo.com', null, null, null);
  -- otro registro de la MISMA práctica no se permite: se corrige el existente
  begin perform public.hist_guardar('e8000000-0000-4000-8000-0000000000a9', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p1')::uuid, 'evidencia',
    '', '', null, true, 'correo', null, null, null, null); raise exception 'FALLO: duplicó la práctica 1';
  exception when raise_exception then if sqlerrm not like 'Ya tiene un registro%' then raise; end if; end;
  -- no puede usar las funciones del servidor ni leer las tablas
  begin perform public.svc_hist_captura_check('e8000000-0000-4000-8000-000000000011', 'e8000000-0000-4000-8000-0000000000a1', 1, 1000);
    raise exception 'FALLO: un estudiante llamó a svc_hist_captura_check';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.hist_declarations; raise exception 'FALLO: leyó hist_declarations'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.hist_captures; raise exception 'FALLO: leyó hist_captures'; exception when insufficient_privilege then null; end;
end $$;

-- 2) otra vía: el canal es obligatorio; también una incidencia (perdió la evidencia) y un borrador que se queda en borrador
do $$
declare r jsonb;
begin
  r := public.hist_guardar('e8000000-0000-4000-8000-0000000000a2', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p2')::uuid, 'evidencia',
    'Cinemática', '', null, true, 'otra', null, '   ', null, null);
  if not (r->'faltantes') ? 'especificar por cuál medio la enviaste' then raise exception 'FALLO: otra vía sin especificar %', r; end if;
  r := public.hist_guardar('e8000000-0000-4000-8000-0000000000a2', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p2')::uuid, 'evidencia',
    'Cinemática', '', null, true, 'otra', null, 'Aplicación de mensajería', 'Mi número +1 809 555 0101', null);
  if (r->'faltantes') ? 'especificar por cuál medio la enviaste' then raise exception 'FALLO: canal no guardado %', r; end if;
  r := public.hist_guardar('e8000000-0000-4000-8000-0000000000a3', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p3')::uuid, 'incidencia',
    'Vectores', '', date '2026-08-30', false, 'correo', 'est1@ejemplo.com', null, null, 'Cambié de teléfono y perdí la conversación');
  r := public.hist_enviar(array['e8000000-0000-4000-8000-0000000000a3']::uuid[], true, null);
  if (r->>'registradas')::int <> 1 then raise exception 'FALLO: incidencia %', r; end if;
  begin perform public.hist_guardar('e8000000-0000-4000-8000-0000000000a4', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p4')::uuid, 'evidencia',
    '', '', date '2999-01-01', false, null, null, null, null, null); raise exception 'FALLO: aceptó una fecha futura';
  exception when invalid_parameter_value then null; end;
  begin perform public.hist_guardar('e8000000-0000-4000-8000-0000000000a4', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p4')::uuid, 'evidencia',
    '', '', null, false, 'correo', 'no-es-un-correo', null, null, null); raise exception 'FALLO: aceptó un correo inválido';
  exception when invalid_parameter_value then null; end;
end $$;

-- 11) el estudiante 2 no toca lo del estudiante 1; el 3 (no inscrito) no ve nada
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000012', true);
do $$ begin
  begin perform public.hist_guardar('e8000000-0000-4000-8000-0000000000a1', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p1')::uuid, 'evidencia',
    'x', '', null, true, 'correo', null, null, null, null); raise exception 'FALLO: el estudiante 2 modificó un registro ajeno';
  exception when insufficient_privilege then null; end;
  begin perform public.hist_registros('e8000000-0000-4000-8000-000000000031'); raise exception 'FALLO: un estudiante vio el localizador';
  exception when insufficient_privilege then null; end;
  if jsonb_array_length(public.hist_mis_secciones()->0->'registros') <> 0 then raise exception 'FALLO: el estudiante 2 ve registros ajenos'; end if;
  perform public.hist_guardar('e8000000-0000-4000-8000-0000000000b1', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p1')::uuid, 'evidencia',
    'Newton', '', null, true, 'correo', 'est2@ejemplo.com', null, null, null);
  perform public.hist_guardar('e8000000-0000-4000-8000-0000000000b2', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p5')::uuid, 'evidencia',
    '', '', null, true, null, null, null, null, null);
end $$;
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000013', true);
do $$ begin
  if jsonb_array_length(public.hist_mis_secciones()) <> 0 then raise exception 'FALLO: un no inscrito ve la sección'; end if;
  begin perform public.hist_guardar('e8000000-0000-4000-8000-0000000000c1', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p6')::uuid, 'evidencia',
    '', '', null, true, 'correo', null, null, null, null); raise exception 'FALLO: un no inscrito registró';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
-- servidor (Edge Function, service_role): capturas. Solo metadatos y ruta privada; los bytes van al almacenamiento.
do $$
declare r jsonb; v_c text := 'e8000000-0000-4000-8000-000000000031'; v_s1 text := 'e8000000-0000-4000-8000-000000000011'; v_s2 text := 'e8000000-0000-4000-8000-000000000012';
begin
  -- ruta que no corresponde (otra sección/estudiante/hash) → rechazada
  begin perform public.svc_hist_captura_registrar(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a1', 1, 'e8000000-0000-4000-8000-0000000000f0',
      v_c || '/' || v_s2 || '/' || repeat('a', 64) || '.webp', 'image/webp', 250000, 1080, 2340, repeat('a', 64), null, null);
    raise exception 'FALLO: aceptó una ruta ajena';
  exception when invalid_parameter_value then null; end;
  -- un PDF no es una captura
  begin perform public.svc_hist_captura_registrar(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a1', 1, 'e8000000-0000-4000-8000-0000000000f0',
      v_c || '/' || v_s1 || '/' || repeat('a', 64) || '.pdf', 'application/pdf', 250000, 1080, 2340, repeat('a', 64), null, null);
    raise exception 'FALLO: aceptó un PDF';
  exception when invalid_parameter_value then null; end;
  -- demasiado grande después de optimizar (máx. 2 MB)
  begin perform public.svc_hist_captura_check(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a1', 1, 3 * 1048576); raise exception 'FALLO: aceptó 3 MB';
  exception when invalid_parameter_value then null; end;
  -- el estudiante 2 no puede subir a un registro del 1
  begin perform public.svc_hist_captura_check(v_s2::uuid, 'e8000000-0000-4000-8000-0000000000a1', 1, 1000); raise exception 'FALLO: subió a un registro ajeno';
  exception when insufficient_privilege then null; end;
  -- una incidencia no lleva capturas
  begin perform public.svc_hist_captura_check(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a3', 1, 1000); raise exception 'FALLO: captura en incidencia';
  exception when invalid_parameter_value or insufficient_privilege then null; end;
  -- capturas válidas: principal de a1, principal de a2 (la misma imagen del mismo estudiante: un solo archivo), complementaria de a1
  r := public.svc_hist_captura_registrar(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a1', 1, 'e8000000-0000-4000-8000-0000000000f1',
      v_c || '/' || v_s1 || '/' || repeat('a', 64) || '.webp', 'image/webp', 250000, 1080, 2340, repeat('a', 64), repeat('1', 64), 3100000);
  if r->>'liberar' is not null then raise exception 'FALLO: liberó algo sin reemplazar'; end if;
  perform public.svc_hist_captura_registrar(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a2', 1, 'e8000000-0000-4000-8000-0000000000f2',
      v_c || '/' || v_s1 || '/' || repeat('a', 64) || '.webp', 'image/webp', 250000, 1080, 2340, repeat('a', 64), repeat('1', 64), 3100000);
  perform public.svc_hist_captura_registrar(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a1', 2, 'e8000000-0000-4000-8000-0000000000f3',
      v_c || '/' || v_s1 || '/' || repeat('b', 64) || '.jpg', 'image/jpeg', 180000, 1280, 720, repeat('b', 64), null, null);
  -- la misma imagen dos veces en el mismo registro: no
  begin perform public.svc_hist_captura_registrar(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a1', 3, 'e8000000-0000-4000-8000-0000000000f4',
      v_c || '/' || v_s1 || '/' || repeat('b', 64) || '.jpg', 'image/jpeg', 180000, 1280, 720, repeat('b', 64), null, null); raise exception 'FALLO: imagen repetida en el registro';
  exception when raise_exception then if sqlerrm not like 'Esa misma imagen%' then raise; end if; end;
  -- reemplazar la complementaria devuelve la ruta que quedó libre (para borrarla del almacenamiento)
  r := public.svc_hist_captura_registrar(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a1', 2, 'e8000000-0000-4000-8000-0000000000f5',
      v_c || '/' || v_s1 || '/' || repeat('c', 64) || '.png', 'image/png', 320000, 1170, 2532, repeat('c', 64), null, null);
  if r->>'liberar' <> v_c || '/' || v_s1 || '/' || repeat('b', 64) || '.jpg' then raise exception 'FALLO: reemplazo %', r; end if;
  -- el estudiante 2 sube al suyo una imagen cuyo ORIGINAL es idéntico al del estudiante 1 (se señala, no se comparte)
  perform public.svc_hist_captura_registrar(v_s2::uuid, 'e8000000-0000-4000-8000-0000000000b1', 1, 'e8000000-0000-4000-8000-0000000000f6',
      v_c || '/' || v_s2 || '/' || repeat('d', 64) || '.webp', 'image/webp', 240000, 1080, 2340, repeat('d', 64), repeat('1', 64), 3100000);
  -- 11) ver la captura: el autor y el profesor de la sección sí; otro estudiante y un profesor ajeno no
  if public.svc_hist_captura_ruta(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000f1') <> v_c || '/' || v_s1 || '/' || repeat('a', 64) || '.webp' then raise exception 'FALLO: ruta del autor'; end if;
  perform public.svc_hist_captura_ruta('e8000000-0000-4000-8000-000000000001', 'e8000000-0000-4000-8000-0000000000f1');
  begin perform public.svc_hist_captura_ruta(v_s2::uuid, 'e8000000-0000-4000-8000-0000000000f1'); raise exception 'FALLO: el estudiante 2 vio la captura del 1';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_hist_captura_ruta('e8000000-0000-4000-8000-000000000002', 'e8000000-0000-4000-8000-0000000000f1'); raise exception 'FALLO: un profesor ajeno vio la captura';
  exception when insufficient_privilege then null; end;
  -- borrador ajeno o ya enviado: no se elimina; el propio sí (y devuelve la ruta libre)
  begin perform public.svc_hist_borrador_eliminar(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000b2'); raise exception 'FALLO: eliminó un borrador ajeno';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_hist_borrador_eliminar(v_s1::uuid, 'e8000000-0000-4000-8000-0000000000a3'); raise exception 'FALLO: eliminó un registro enviado';
  exception when raise_exception then if sqlerrm not like 'Solo se pueden eliminar borradores%' then raise; end if; end;
  perform public.svc_hist_captura_registrar(v_s2::uuid, 'e8000000-0000-4000-8000-0000000000b2', 1, 'e8000000-0000-4000-8000-0000000000f7',
      v_c || '/' || v_s2 || '/' || repeat('e', 64) || '.webp', 'image/webp', 100000, 1080, 1920, repeat('e', 64), null, null);
  if public.svc_hist_borrador_eliminar(v_s2::uuid, 'e8000000-0000-4000-8000-0000000000b2') <> array[v_c || '/' || v_s2 || '/' || repeat('e', 64) || '.webp'] then
    raise exception 'FALLO: eliminar borrador';
  end if;
  -- 12) los bytes de las imágenes NO están en PostgreSQL: ninguna columna binaria y filas diminutas
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name like 'hist\_%' and data_type in ('bytea', 'oid')) then
    raise exception 'FALLO: hay una columna binaria en el módulo';
  end if;
  if (select max(pg_column_size(k.*)) from public.hist_captures k) > 1000 then raise exception 'FALLO: una fila de captura ocupa demasiado'; end if;
  if (select count(distinct storage_path) from public.hist_captures where user_id = v_s1::uuid) <> 2 then raise exception 'FALLO: deduplicación por estudiante'; end if;
end $$;

set local role authenticated;
-- 1) y 2) completar el registro con la captura; el estudiante 1 registra a1 y a2 a la vez (envío múltiple)
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000011', true);
do $$
declare r jsonb; s jsonb;
begin
  r := public.hist_enviar(array['e8000000-0000-4000-8000-0000000000a1', 'e8000000-0000-4000-8000-0000000000a2']::uuid[], true, null);
  if (r->>'registradas')::int <> 2 then raise exception 'FALLO: envío múltiple %', r; end if;
  s := public.hist_mis_secciones()->0->'registros';
  if jsonb_array_length(s) <> 3 or exists (select 1 from jsonb_array_elements(s) x where x->>'estado' <> 'registrada') then raise exception 'FALLO: estados del estudiante %', s; end if;
  -- antes de la revisión puede corregir (sigue registrado y completo)
  perform public.hist_guardar('e8000000-0000-4000-8000-0000000000a1', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p1')::uuid, 'evidencia',
    'Práctica sobre las leyes de Newton', 'Plano inclinado y poleas', date '2026-09-16', false, 'correo', 'est1@ejemplo.com', null, null, null);
end $$;
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000012', true);
select public.hist_enviar(array['e8000000-0000-4000-8000-0000000000b1']::uuid[], true, null);

-- 5), 6), 7), 8) el profesor: filtra por correo, ve remitente y fecha, localiza, verifica y convalida (sin nota)
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000001', true);
do $$
declare r jsonb; x jsonb; v_res record;
begin
  r := public.hist_registros('e8000000-0000-4000-8000-000000000031');
  if jsonb_array_length(r) <> 4 then raise exception 'FALLO: registros visibles (los borradores no se muestran) %', jsonb_array_length(r); end if;
  if (select count(*) from jsonb_array_elements(r) e where e->>'medio' = 'correo') <> 3 then raise exception 'FALLO: filtro por correo'; end if;
  select e into x from jsonb_array_elements(r) e where e->>'id' = 'e8000000-0000-4000-8000-0000000000a1';
  if x->>'correo_remitente' <> 'est1@ejemplo.com' or x->>'fecha_declarada' <> '2026-09-16' or x->>'estado' <> 'registrada' then raise exception 'FALLO: ficha %', x; end if;
  if jsonb_array_length(x->'capturas') <> 2 or (x->'capturas'->0->>'igual_a_otros')::int <> 1 then raise exception 'FALLO: capturas o señal de imagen igual %', x->'capturas'; end if;
  select e into x from jsonb_array_elements(r) e where e->>'id' = 'e8000000-0000-4000-8000-0000000000a2';
  if x->>'otra_via' <> 'Aplicación de mensajería' or x->>'contacto' not like '%809%' then raise exception 'FALLO: otra vía %', x; end if;
  -- verificar sin haber localizado: no
  r := public.hist_revisar(array['e8000000-0000-4000-8000-0000000000a1']::uuid[], 'verificada', null);
  if (r->>'aplicadas')::int <> 0 then raise exception 'FALLO: verificó sin localizar'; end if;
  -- 7) localizada
  r := public.hist_revisar(array['e8000000-0000-4000-8000-0000000000a1']::uuid[], 'localizada', null);
  if (r->>'aplicadas')::int <> 1 then raise exception 'FALLO: localizar %', r; end if;
  -- convalidar sin verificar: no
  r := public.hist_revisar(array['e8000000-0000-4000-8000-0000000000a1']::uuid[], 'convalidada', null);
  if (r->>'aplicadas')::int <> 0 then raise exception 'FALLO: convalidó sin verificar'; end if;
  perform public.hist_revisar(array['e8000000-0000-4000-8000-0000000000a1']::uuid[], 'verificada', null);
  -- 8) convalidar sin calificar
  r := public.hist_revisar(array['e8000000-0000-4000-8000-0000000000a1']::uuid[], 'convalidada', null);
  if (r->>'aplicadas')::int <> 1 then raise exception 'FALLO: convalidar %', r; end if;
  select e into x from jsonb_array_elements(public.hist_registros('e8000000-0000-4000-8000-000000000031')) e where e->>'id' = 'e8000000-0000-4000-8000-0000000000a1';
  if x->>'estado' <> 'convalidada' or x->>'localizada_at' is null or x->>'verificada_at' is null or x->>'convalidada_at' is null or x->'calificacion' <> 'null'::jsonb then
    raise exception 'FALLO: estado convalidado %', x;
  end if;
  -- revertir exige nota
  begin perform public.hist_revisar(array['e8000000-0000-4000-8000-0000000000a1']::uuid[], 'revertir_convalidacion', ''); raise exception 'FALLO: revirtió sin nota';
  exception when invalid_parameter_value then null; end;
  -- aclaración a a2 (con aviso por el Centro de Comunicación)
  r := public.hist_revisar(array['e8000000-0000-4000-8000-0000000000a2']::uuid[], 'aclaracion', '¿Desde qué número enviaste la práctica?');
  if (r->>'aplicadas')::int <> 1 then raise exception 'FALLO: aclaración %', r; end if;
  if (select count(*) from public.hist_historial('e8000000-0000-4000-8000-0000000000a1')) < 5 then raise exception 'FALLO: historial incompleto'; end if;
  -- vínculo con el libro de calificaciones: sin notas automáticas; la misma actividad no se asocia dos veces
  perform public.hist_practica_vincular(current_setting('prueba.p1')::uuid, 'e8000000-0000-4000-8000-000000000041');
  begin perform public.hist_practica_vincular(current_setting('prueba.p2')::uuid, 'e8000000-0000-4000-8000-000000000041'); raise exception 'FALLO: actividad asociada dos veces';
  exception when raise_exception then if sqlerrm not like 'Esa actividad ya está asociada%' then raise; end if; end;
  -- 13) el estudiante 1 declaró 3 prácticas: las otras 7 posiciones no generan nada (ni pendientes ni ceros)
  select * into v_res from public.hist_resumen('e8000000-0000-4000-8000-000000000031') where full_name is not null and user_id = 'e8000000-0000-4000-8000-000000000011';
  if v_res.registradas <> 2 or v_res.incidencias <> 1 or v_res.convalidadas <> 1 then raise exception 'FALLO: resumen %', row_to_json(v_res); end if;
end $$;

-- el estudiante 1 responde la aclaración y vuelve a «registrada»; ya revisado, no puede editar el convalidado
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000011', true);
do $$
declare r jsonb;
begin
  begin perform public.hist_guardar('e8000000-0000-4000-8000-0000000000a1', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p1')::uuid, 'evidencia',
    'otro', '', null, true, 'correo', 'est1@ejemplo.com', null, null, null); raise exception 'FALLO: editó un registro revisado';
  exception when raise_exception then if sqlerrm not like 'El profesor ya revisó%' then raise; end if; end;
  perform public.hist_guardar('e8000000-0000-4000-8000-0000000000a2', 'e8000000-0000-4000-8000-000000000031', current_setting('prueba.p2')::uuid, 'evidencia',
    'Cinemática', '', null, true, 'otra', null, 'Aplicación de mensajería', 'Desde el +1 809 555 0101 (a nombre de mi madre)', null);
  r := public.hist_enviar(array['e8000000-0000-4000-8000-0000000000a2']::uuid[], true, 'La envié desde el teléfono de mi madre.');
  if (r->>'registradas')::int <> 1 then raise exception 'FALLO: respuesta a la aclaración %', r; end if;
  -- 9) «recuerdo otra práctica» y «creo que fueron 12»
  perform set_config('prueba.sug1', public.hist_sugerir('e8000000-0000-4000-8000-000000000031', 'Práctica de energía y trabajo', 'Con el péndulo', null, '', 12)::text, true);
end $$;
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000012', true);
do $$ begin
  perform set_config('prueba.sug2', public.hist_sugerir('e8000000-0000-4000-8000-000000000031', 'Energía, trabajo y potencia', '', date '2026-10-01', '', null)::text, true);
  perform public.hist_sugerir('e8000000-0000-4000-8000-000000000031', null, '', null, 'Creo que fueron doce', 12);
  begin perform public.hist_sugerir('e8000000-0000-4000-8000-000000000031', '  ', '', null, '', null); raise exception 'FALLO: sugerencia vacía';
  exception when invalid_parameter_value then null; end;
end $$;

-- 10) el profesor confirma la práctica sugerida (11), amplía a 12 posiciones y luego reduce a 5 sin perder registros; une 2 en 1
select set_config('request.jwt.claims', '{"sub":"e8000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-000000000001', true);
do $$
declare v_p uuid; r jsonb; c jsonb; v_antes jsonb; v_despues jsonb;
begin
  v_antes := (select jsonb_agg(e->>'id' order by e->>'id') from jsonb_array_elements(public.hist_registros('e8000000-0000-4000-8000-000000000031')) e);
  if (select count(*) from public.hist_sugerencias('e8000000-0000-4000-8000-000000000031')) <> 3 then raise exception 'FALLO: sugerencias visibles'; end if;
  v_p := public.hist_sugerencias_decidir(array[current_setting('prueba.sug1'), current_setting('prueba.sug2')]::uuid[], 'confirmada', null, 'Energía y trabajo', null);
  c := public.hist_config('e8000000-0000-4000-8000-000000000031');
  if not exists (select 1 from jsonb_array_elements(c->'practicas') x where x->>'id' = v_p::text and (x->>'numero')::int = 11 and x->>'origen' = 'sugerencia') then
    raise exception 'FALLO: práctica confirmada %', c->'practicas';
  end if;
  r := public.hist_configurar('e8000000-0000-4000-8000-000000000031', null, null, null, null, null, null, 12);
  if (r->>'creadas')::int <> 1 or (r->>'activas')::int <> 12 then raise exception 'FALLO: ampliar %', r; end if;
  r := public.hist_configurar('e8000000-0000-4000-8000-000000000031', null, null, null, null, null, null, 5);
  if (r->>'archivadas')::int <> 7 or (r->>'conservadas')::int <> 1 or (r->>'activas')::int <> 5 then raise exception 'FALLO: reducir %', r; end if;
  perform public.hist_practica_unir(current_setting('prueba.p2')::uuid, current_setting('prueba.p1')::uuid, 'Eran la misma práctica');
  v_despues := (select jsonb_agg(e->>'id' order by e->>'id') from jsonb_array_elements(public.hist_registros('e8000000-0000-4000-8000-000000000031')) e);
  if v_antes <> v_despues then raise exception 'FALLO: se perdieron registros (% → %)', v_antes, v_despues; end if;
  if (select count(*) from jsonb_array_elements(public.hist_registros('e8000000-0000-4000-8000-000000000031')) e where e->>'practice_id' = current_setting('prueba.p1')) <> 3 then
    raise exception 'FALLO: unir prácticas';
  end if;
end $$;

reset role;
do $$ begin
  -- convalidar NO crea notas ni intentos, y nadie recibe ceros por posiciones vacías
  if exists (select 1 from public.grade_entries where class_id = 'e8000000-0000-4000-8000-000000000031') then raise exception 'FALLO: se crearon notas'; end if;
  if exists (select 1 from public.attempts where activity_id = 'e8000000-0000-4000-8000-000000000041') then raise exception 'FALLO: se crearon intentos'; end if;
  -- el aviso de la aclaración llegó al estudiante 1 por el Centro de Comunicación
  if not exists (select 1 from public.live_message_recipients r join public.live_messages m on m.id = r.message_id
                 where r.user_id = 'e8000000-0000-4000-8000-000000000011' and m.audience->>'modo' = 'regularizacion') then
    raise exception 'FALLO: no se avisó de la aclaración';
  end if;
  -- el historial guarda quién hizo cada paso
  if (select count(*) from public.hist_events where declaration_id = 'e8000000-0000-4000-8000-0000000000a1' and papel = 'docente'
      and actor = 'e8000000-0000-4000-8000-000000000001') < 3 then raise exception 'FALLO: historial del docente'; end if;
end $$;

select 'PRUEBAS DE REGULARIZACIÓN DE PRÁCTICAS PASARON' as resultado;
rollback;
