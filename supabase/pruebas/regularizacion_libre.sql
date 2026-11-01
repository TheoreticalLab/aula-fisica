-- Pruebas: prácticas anteriores realizadas sin envío por correo (migración 47). Datos sintéticos; se deshace al final.
-- Casos del encargo cubiertos aquí: 1–3, 4, 5, 7–15, 17–20 (6 y 16, sugerencias y advertencias, en tests/practicas-libres.test.ts).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ea000000-0000-4000-8000-000000000001', 'la@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-libre","aula_role":"teacher"}', '{}', now(), now()),
  ('ea000000-0000-4000-8000-000000000002', 'lb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ajeno-lib","aula_role":"teacher"}', '{}', now(), now()),
  ('ea000000-0000-4000-8000-000000000011', 'l1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lib-1"}', '{}', now(), now()),
  ('ea000000-0000-4000-8000-000000000012', 'l2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lib-2"}', '{}', now(), now()),
  ('ea000000-0000-4000-8000-000000000013', 'l3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lib-3"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'ea000000-%';
update public.profiles set role = 'teacher' where id in ('ea000000-0000-4000-8000-000000000001', 'ea000000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('ea000000-0000-4000-8000-000000000021', 'Curso sin correo');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('ea000000-0000-4000-8000-000000000031', 'ea000000-0000-4000-8000-000000000021', 'Sección sin correo', 'LIBRE001', 'ea000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('ea000000-0000-4000-8000-000000000031', 'ea000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('ea000000-0000-4000-8000-000000000031', 'ea000000-0000-4000-8000-000000000011'),
  ('ea000000-0000-4000-8000-000000000031', 'ea000000-0000-4000-8000-000000000012'),
  ('ea000000-0000-4000-8000-000000000031', 'ea000000-0000-4000-8000-000000000013');

set local role authenticated;

-- criterio 1: el profesor habilita la modalidad SIN crear ningún catálogo (la modalidad por correo sigue cerrada)
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000001', true);
do $$
declare c jsonb;
begin
  perform public.hist_libre_configurar('ea000000-0000-4000-8000-000000000031', true, null, null, null, null, null, null, null, null);
  c := public.hist_config('ea000000-0000-4000-8000-000000000031');
  if (c->>'abierto')::boolean or not (c->>'libre_habilitado')::boolean or jsonb_array_length(c->'practicas') <> 0 then raise exception 'FALLO: habilitar %', c; end if;
end $$;

-- estudiante 1
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000011', true);
do $$
declare r jsonb; m jsonb; v_c uuid := 'ea000000-0000-4000-8000-000000000031';
begin
  m := public.hist_libre_mias();
  if jsonb_array_length(m) <> 1 or not (m->0->>'habilitado')::boolean or m->0->>'version' <> 'sin-correo-v1' then raise exception 'FALLO: el estudiante no ve la modalidad %', m; end if;
  -- caso 1: 15 ejercicios, 9 realizados (sin foto todavía → «falta la foto»)
  r := public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a1', v_c, 'Leyes de Newton', 15, 9, array['cuaderno'], null, false, null, null, null, true, 'sin-correo-v1');
  if r->>'estado' <> 'declarado' or not (r->>'falta_foto')::boolean then raise exception 'FALLO: caso 1 %', r; end if;
  -- caso 2: más realizados que el total, total 0, total por encima del máximo (200)
  begin perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a9', v_c, 'X', 15, 16, null, null, false, null, null, null, true, 'sin-correo-v1'); raise exception 'FALLO: 16 de 15';
  exception when invalid_parameter_value then null; end;
  begin perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a9', v_c, 'X', 0, 0, null, null, false, null, null, null, true, 'sin-correo-v1'); raise exception 'FALLO: total 0';
  exception when invalid_parameter_value then null; end;
  begin perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a9', v_c, 'X', 201, 1, null, null, false, null, null, null, true, 'sin-correo-v1'); raise exception 'FALLO: total 201';
  exception when invalid_parameter_value then null; end;
  -- sin aceptar la declaración, o con otra versión del texto, no se guarda
  begin perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a9', v_c, 'X', 5, 1, null, null, false, null, null, null, false, 'sin-correo-v1'); raise exception 'FALLO: sin declaración';
  exception when invalid_parameter_value then null; end;
  begin perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a9', v_c, 'X', 5, 1, null, null, false, null, null, null, true, 'v0'); raise exception 'FALLO: versión vieja';
  exception when raise_exception then if sqlerrm not like 'El texto de la declaración cambió%' then raise; end if; end;
  -- caso 3: en clase, sin foto, con explicación (una explicación vacía no basta)
  begin perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a2', v_c, 'Choques', 10, 6, array['clase', 'pizarra'], null, true, 'no', null, null, true, 'sin-correo-v1');
    raise exception 'FALLO: sin foto sin explicación';
  exception when invalid_parameter_value then null; end;
  r := public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a2', v_c, 'Choques', 10, 6, array['clase', 'pizarra', 'clase'], null, true,
    'Se hizo en la pizarra durante la clase y no tomé fotografías', null, null, true, 'sin-correo-v1');
  if (r->>'falta_foto')::boolean then raise exception 'FALLO: caso 3 %', r; end if;
  -- caso 18: cero realizados, sin foto ni explicación
  r := public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a3', v_c, 'Vectores', 8, 0, null, null, false, null, null, null, true, 'sin-correo-v1');
  if (r->>'falta_foto')::boolean then raise exception 'FALLO: caso 18 %', r; end if;
  -- caso 4: cinco prácticas
  perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a4', v_c, 'Trabajo y energía', 18, 12, array['casa'], null, false, null, null, null, true, 'sin-correo-v1');
  perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a5', v_c, 'Fricción', 10, 7, array['otra'], 'En grupo', false, null, 'Recuerdo unos diez', null, true, 'sin-correo-v1');
  m := public.hist_libre_mias()->0->'registros';
  if jsonb_array_length(m) <> 5 or (select sum((x->>'total_declarado')::int) from jsonb_array_elements(m) x) <> 61
     or (select sum((x->>'realizados_declarados')::int) from jsonb_array_elements(m) x) <> 34 then raise exception 'FALLO: caso 4 %', m; end if;
  if (select x->'modalidades' from jsonb_array_elements(m) x where x->>'id' = 'ea000000-0000-4000-8000-0000000000a2') <> '["clase", "pizarra"]'::jsonb then raise exception 'FALLO: modalidades'; end if;
  -- caso 12: sin acceso directo a las tablas ni a las funciones del servidor
  begin perform 1 from public.hist_libres; raise exception 'FALLO: leyó hist_libres'; exception when insufficient_privilege then null; end;
  begin perform public.svc_hist_libre_foto_check('ea000000-0000-4000-8000-000000000011', 'ea000000-0000-4000-8000-0000000000a1', 1, 1000); raise exception 'FALLO: svc';
  exception when insufficient_privilege then null; end;
end $$;

-- el profesor abre también la modalidad por correo (caso 20: las dos conviven)
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000001', true);
do $$
declare c jsonb;
begin
  perform public.hist_configurar('ea000000-0000-4000-8000-000000000031', true, '', 7, 2, 300, 40, 3);
  c := public.hist_config('ea000000-0000-4000-8000-000000000031');
  perform set_config('prueba.p1', (select x->>'id' from jsonb_array_elements(c->'practicas') x where (x->>'numero')::int = 1), true);
  if not (c->>'libre_habilitado')::boolean then raise exception 'FALLO: abrir correo apagó la otra modalidad'; end if;
end $$;

-- estudiante 2: no ve ni toca lo del 1 (12) ni hace acciones del profesor (13); registra la misma práctica con otro nombre (5)
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000012', true);
do $$
declare v_c uuid := 'ea000000-0000-4000-8000-000000000031';
begin
  begin perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a1', v_c, 'Robado', 15, 15, null, null, false, null, null, null, true, 'sin-correo-v1');
    raise exception 'FALLO: modificó un registro ajeno';
  exception when insufficient_privilege then null; end;
  if jsonb_array_length(public.hist_libre_mias()->0->'registros') <> 0 then raise exception 'FALLO: ve registros ajenos'; end if;
  begin perform public.hist_libre_datos(v_c); raise exception 'FALLO: un estudiante vio el panel'; exception when insufficient_privilege then null; end;
  begin perform public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000a1']::uuid[], 'validar', null, null, 9, null); raise exception 'FALLO: un estudiante validó';
  exception when insufficient_privilege then null; end;
  begin perform public.hist_libre_agrupar(null, array['ea000000-0000-4000-8000-0000000000a1']::uuid[]); raise exception 'FALLO: un estudiante agrupó';
  exception when insufficient_privilege then null; end;
  perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000b1', v_c, 'Segunda ley de Newton', 15, 15, array['cuaderno'], null, false, null, null, null, true, 'sin-correo-v1');
  -- caso 20: la modalidad por correo sigue funcionando; caso 16: sus datos llegan para advertir duplicados
  perform public.hist_guardar('ea000000-0000-4000-8000-0000000000d1', v_c, current_setting('prueba.p1')::uuid, 'evidencia', 'Leyes de Newton', '', null, true,
    'correo', 'est2@ejemplo.com', null, null, null);
  if public.hist_mis_secciones()->0->'registros'->0->>'estado' <> 'borrador' then raise exception 'FALLO: la modalidad por correo dejó de funcionar'; end if;
  if not exists (select 1 from jsonb_array_elements(public.hist_libre_mias()->0->'correo') x where x->>'tema' = 'Leyes de Newton') then raise exception 'FALLO: datos de correo para duplicados'; end if;
end $$;

reset role;
-- servidor: fotos (ruta libre/…), adicionales solo con solicitud, acceso, cuota (17)
do $$
declare v_c text := 'ea000000-0000-4000-8000-000000000031'; v_s1 text := 'ea000000-0000-4000-8000-000000000011'; v_s2 text := 'ea000000-0000-4000-8000-000000000012';
begin
  begin perform public.svc_hist_libre_foto_registrar(v_s1::uuid, 'ea000000-0000-4000-8000-0000000000a1', 1, 'ea000000-0000-4000-8000-0000000000f0',
      v_c || '/' || v_s1 || '/' || repeat('a', 64) || '.webp', 'image/webp', 250000, 1080, 1920, repeat('a', 64), null, null); raise exception 'FALLO: ruta sin prefijo libre/';
  exception when invalid_parameter_value then null; end;
  perform public.svc_hist_libre_foto_registrar(v_s1::uuid, 'ea000000-0000-4000-8000-0000000000a1', 1, 'ea000000-0000-4000-8000-0000000000f1',
      'libre/' || v_c || '/' || v_s1 || '/' || repeat('a', 64) || '.webp', 'image/webp', 250000, 1080, 1920, repeat('a', 64), null, null);
  begin perform public.svc_hist_libre_foto_check(v_s1::uuid, 'ea000000-0000-4000-8000-0000000000a1', 2, 1000); raise exception 'FALLO: foto adicional sin solicitud';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_hist_libre_foto_check(v_s2::uuid, 'ea000000-0000-4000-8000-0000000000a1', 1, 1000); raise exception 'FALLO: foto en registro ajeno';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_hist_libre_foto_ruta(v_s2::uuid, 'ea000000-0000-4000-8000-0000000000f1'); raise exception 'FALLO: el estudiante 2 vio la foto del 1';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_hist_libre_foto_ruta('ea000000-0000-4000-8000-000000000002', 'ea000000-0000-4000-8000-0000000000f1'); raise exception 'FALLO: profesor ajeno vio la foto';
  exception when insufficient_privilege then null; end;
  perform public.svc_hist_libre_foto_ruta('ea000000-0000-4000-8000-000000000001', 'ea000000-0000-4000-8000-0000000000f1');
  -- caso 17: cuota de 10 MB → la tercera imagen se rechaza de forma controlada; las declaraciones siguen intactas
  update public.hist_settings set cuota_mb = 10, max_mb_captura = 5 where class_id = v_c::uuid;
  perform public.svc_hist_libre_foto_registrar(v_s1::uuid, 'ea000000-0000-4000-8000-0000000000a4', 1, 'ea000000-0000-4000-8000-0000000000f4',
      'libre/' || v_c || '/' || v_s1 || '/' || repeat('b', 64) || '.jpg', 'image/jpeg', 5000000, 3000, 4000, repeat('b', 64), null, null);
  perform public.svc_hist_libre_foto_registrar(v_s1::uuid, 'ea000000-0000-4000-8000-0000000000a5', 1, 'ea000000-0000-4000-8000-0000000000f5',
      'libre/' || v_c || '/' || v_s1 || '/' || repeat('c', 64) || '.jpg', 'image/jpeg', 5000000, 3000, 4000, repeat('c', 64), null, null);
  begin perform public.svc_hist_libre_foto_check(v_s1::uuid, 'ea000000-0000-4000-8000-0000000000a3', 1, 1000000); raise exception 'FALLO: superó la cuota';
  exception when raise_exception then if sqlerrm not like 'Se alcanzó el espacio reservado%' then raise; end if; end;
  if (select count(*) from public.hist_libres where user_id = v_s1::uuid) <> 5 then raise exception 'FALLO: se perdieron declaraciones'; end if;
  update public.hist_settings set cuota_mb = 300, max_mb_captura = 2 where class_id = v_c::uuid;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name like 'hist\_libre%' and data_type in ('bytea', 'oid')) then
    raise exception 'FALLO: columna binaria';
  end if;
end $$;

set local role authenticated;
-- el profesor: ve todo (7), consolida (7), fija totales oficiales sin tocar lo declarado (8), detecta omisiones (15), pide evidencia (9)
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000001', true);
do $$
declare d jsonb; v_g uuid; r jsonb; v_c uuid := 'ea000000-0000-4000-8000-000000000031'; n integer;
begin
  d := public.hist_libre_datos(v_c);
  if jsonb_array_length(d->'registros') <> 6 or jsonb_array_length(d->'estudiantes') <> 3 then raise exception 'FALLO: datos del profesor %', d; end if;
  v_g := public.hist_libre_grupo_guardar(null, v_c, 'Leyes de Newton', null, '');
  if public.hist_libre_agrupar(v_g, array['ea000000-0000-4000-8000-0000000000a1', 'ea000000-0000-4000-8000-0000000000b1']::uuid[]) <> 2 then raise exception 'FALLO: agrupar'; end if;
  perform public.hist_libre_grupo_guardar(v_g, v_c, 'Leyes de Newton (dinámica)', 15, 'Práctica de la unidad 4');
  perform public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000b1']::uuid[], 'total_oficial', 'En su sección eran 14', null, null, 14);
  d := public.hist_libre_datos(v_c);
  select x into r from jsonb_array_elements(d->'registros') x where x->>'id' = 'ea000000-0000-4000-8000-0000000000b1';
  if r->>'nombre' <> 'Segunda ley de Newton' or (r->>'total_declarado')::int <> 15 or (r->>'realizados_declarados')::int <> 15
     or (r->>'total_oficial')::int <> 14 or (r->>'total_oficial_grupo')::int <> 15 or r->>'grupo_id' <> v_g::text then raise exception 'FALLO: casos 7 y 8 %', r; end if;
  -- 15: el estudiante 3 no tiene registro de esta práctica; se le avisa (al 1, que sí la tiene, no)
  select count(*) into n from public.hist_libre_omisiones(v_g);
  if n <> 1 or (select user_id from public.hist_libre_omisiones(v_g)) <> 'ea000000-0000-4000-8000-000000000013' then raise exception 'FALLO: omisiones (%)', n; end if;
  if public.hist_libre_avisar(v_g, array['ea000000-0000-4000-8000-000000000013', 'ea000000-0000-4000-8000-000000000011']::uuid[], 'Indica si la hiciste') <> 1 then
    raise exception 'FALLO: avisar';
  end if;
  -- 9: solicitar evidencia (exige nota y tipo)
  begin perform public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000a1']::uuid[], 'solicitar_evidencia', '', 'fotos', null, null); raise exception 'FALLO: sin nota';
  exception when invalid_parameter_value then null; end;
  begin perform public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000a1']::uuid[], 'solicitar_evidencia', 'x', 'video', null, null); raise exception 'FALLO: tipo';
  exception when invalid_parameter_value then null; end;
  r := public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000a1']::uuid[], 'solicitar_evidencia', 'Envía fotos de los ejercicios 5 al 9', 'fotos', null, null);
  if (r->>'aplicadas')::int <> 1 then raise exception 'FALLO: caso 9 %', r; end if;
  perform public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000a2']::uuid[], 'solicitar_correccion', 'Revisa el total: eran 12', null, null, null);
end $$;
-- un profesor ajeno no administra nada (13)
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000a1']::uuid[], 'validar', null, null, 9, null); raise exception 'FALLO: profesor ajeno validó';
  exception when insufficient_privilege then null; end;
end $$;

-- estudiante 3: le aparece el aviso al entrar y responde que no la realizó (nadie declara por él)
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000013', true);
do $$
declare m jsonb;
begin
  if (public.hist_pendientes()->0->>'avisos')::int <> 1 then raise exception 'FALLO: aviso al entrar'; end if;
  m := public.hist_libre_mias()->0;
  perform public.hist_libre_aviso_responder((m->'avisos'->0->>'id')::uuid, 'no_realizada', null, 'No la hice');
  if jsonb_array_length(public.hist_libre_mias()->0->'registros') <> 0 then raise exception 'FALLO: se creó un registro en su nombre'; end if;
end $$;

reset role;
select public.svc_hist_libre_foto_registrar('ea000000-0000-4000-8000-000000000011', 'ea000000-0000-4000-8000-0000000000a1', 2, 'ea000000-0000-4000-8000-0000000000f2',
  'libre/ea000000-0000-4000-8000-000000000031/ea000000-0000-4000-8000-000000000011/' || repeat('d', 64) || '.webp', 'image/webp', 200000, 1080, 1920, repeat('d', 64), null, null);
set local role authenticated;

-- 10: el estudiante 1 responde (con la foto adicional ya adjunta) y corrige el registro con corrección solicitada
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000011', true);
do $$
declare v_c uuid := 'ea000000-0000-4000-8000-000000000031';
begin
  if (public.hist_pendientes()->0->>'solicitudes')::int <> 2 then raise exception 'FALLO: solicitudes en el aviso al entrar'; end if;
  perform public.hist_libre_responder('ea000000-0000-4000-8000-0000000000a1', 'Adjunto la foto de los ejercicios que faltaban', false);
  begin perform public.hist_libre_responder('ea000000-0000-4000-8000-0000000000a1', 'otra vez', false); raise exception 'FALLO: respondió sin solicitud';
  exception when raise_exception then if sqlerrm not like 'No hay ninguna solicitud%' then raise; end if; end;
  perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a2', v_c, 'Choques', 12, 6, array['clase', 'pizarra'], null, true,
    'Se hizo en la pizarra durante la clase y no tomé fotografías', null, null, true, 'sin-correo-v1');
  perform public.hist_libre_responder('ea000000-0000-4000-8000-0000000000a2', 'Corregido: eran 12', false);
  -- antes de la revisión puede corregir lo suyo; el valor inicial se conserva
  perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a5', v_c, 'Fricción', 10, 8, array['otra'], 'En grupo', false, null, null, null, true, 'sin-correo-v1');
end $$;

-- 11: el profesor valida 7 verificados de 9 declarados; no se valida sin cantidad ni por encima del total
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000001', true);
do $$
declare r jsonb; d jsonb;
begin
  begin perform public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000a1']::uuid[], 'validar', null, null, null, null); raise exception 'FALLO: validó sin cantidad';
  exception when invalid_parameter_value then null; end;
  r := public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000a1']::uuid[], 'validar', null, null, 16, null);
  if (r->>'aplicadas')::int <> 0 then raise exception 'FALLO: validó 16 de 15'; end if;
  r := public.hist_libre_revisar(array['ea000000-0000-4000-8000-0000000000a1']::uuid[], 'validar', 'Revisé el cuaderno: 7 completos', null, 7, null);
  if (r->>'aplicadas')::int <> 1 then raise exception 'FALLO: validar %', r; end if;
  d := public.hist_libre_datos('ea000000-0000-4000-8000-000000000031');
  select x into r from jsonb_array_elements(d->'registros') x where x->>'id' = 'ea000000-0000-4000-8000-0000000000a1';
  if r->>'estado' <> 'validado' or (r->>'realizados_declarados')::int <> 9 or (r->>'realizados_verificados')::int <> 7 or (r->>'realizados_inicial')::int <> 9 then
    raise exception 'FALLO: caso 11 %', r;
  end if;
  select x into r from jsonb_array_elements(d->'registros') x where x->>'id' = 'ea000000-0000-4000-8000-0000000000a5';
  if (r->>'realizados_declarados')::int <> 8 or (r->>'realizados_inicial')::int <> 7 then raise exception 'FALLO: original y corregido %', r; end if;
  if not exists (select 1 from public.hist_libre_historial('ea000000-0000-4000-8000-0000000000a1') h where h.accion = 'validar'
                 and (h.detalle->'declarados'->>'realizados')::int = 9 and (h.detalle->>'verificados')::int = 7) then raise exception 'FALLO: trazabilidad de la validación'; end if;
  if (select count(*) from public.hist_libre_historial('ea000000-0000-4000-8000-0000000000a5') h where h.accion = 'corregida') <> 1 then raise exception 'FALLO: historial de la corrección'; end if;
  -- 14: cierra los registros nuevos (y luego las correcciones libres)
  perform public.hist_libre_configurar('ea000000-0000-4000-8000-000000000031', null, false, null, null, null, null, null, null, null);
end $$;

select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000011', true);
do $$
declare v_c uuid := 'ea000000-0000-4000-8000-000000000031';
begin
  -- 19: lo validado no se modifica (ni sus fotos)
  begin perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a1', v_c, 'Leyes de Newton', 15, 15, null, null, false, null, null, null, true, 'sin-correo-v1');
    raise exception 'FALLO: modificó un registro validado';
  exception when raise_exception then if sqlerrm not like 'El profesor ya validó%' then raise; end if; end;
  -- 14: nada nuevo, pero lo existente se conserva y sigue corrigiéndose
  begin perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a6', v_c, 'Nueva', 5, 5, null, null, false, null, null, null, true, 'sin-correo-v1');
    raise exception 'FALLO: registro nuevo con la modalidad cerrada';
  exception when raise_exception then if sqlerrm not like 'El profesor cerró los registros nuevos%' then raise; end if; end;
  perform public.hist_libre_guardar('ea000000-0000-4000-8000-0000000000a5', v_c, 'Fricción', 10, 8, array['otra'], 'En grupo', false, null, 'Ok', null, true, 'sin-correo-v1');
  if jsonb_array_length(public.hist_libre_mias()->0->'registros') <> 5 then raise exception 'FALLO: se perdieron registros al cerrar'; end if;
end $$;

reset role;
do $$
declare v_s1 uuid := 'ea000000-0000-4000-8000-000000000011';
begin
  if (select realizados_verificados from public.hist_libres where id = 'ea000000-0000-4000-8000-0000000000a1') <> 7 then raise exception 'FALLO: se sobrescribió la validación'; end if;
  if exists (select 1 from public.grade_entries where class_id = 'ea000000-0000-4000-8000-000000000031') then raise exception 'FALLO: se crearon notas'; end if;
  if (select count(*) from public.live_message_recipients r join public.live_messages m on m.id = r.message_id where r.user_id = v_s1 and m.audience->>'modo' = 'regularizacion') <> 2 then
    raise exception 'FALLO: avisos de las solicitudes';
  end if;
  if not exists (select 1 from public.live_message_recipients where user_id = 'ea000000-0000-4000-8000-000000000013') then raise exception 'FALLO: aviso de omisión'; end if;
  if (select count(*) from public.hist_events where libre_id = 'ea000000-0000-4000-8000-0000000000a1') < 6 then raise exception 'FALLO: historial de a1'; end if;
  if (select count(*) from public.hist_libres where class_id = 'ea000000-0000-4000-8000-000000000031') <> 6 then raise exception 'FALLO: registros perdidos'; end if;
end $$;

select 'PRUEBAS DE PRÁCTICAS SIN ENVÍO POR CORREO PASARON' as resultado;
rollback;
