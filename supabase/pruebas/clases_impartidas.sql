-- Pruebas: Clases impartidas (migración 66). Se deshace al final.
-- Sección A (profesor P, monitor M, delegado D, estudiante S) y sección B (estudiante X, otra asignatura igual).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de660000-0000-4000-8000-000000000001', 'ci1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-clases","aula_role":"teacher"}', '{}', now(), now()),
  ('de660000-0000-4000-8000-000000000011', 'ci11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-cl-monitor"}', '{}', now(), now()),
  ('de660000-0000-4000-8000-000000000012', 'ci12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-cl-delegado"}', '{}', now(), now()),
  ('de660000-0000-4000-8000-000000000013', 'ci13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-cl-estudiante"}', '{}', now(), now()),
  ('de660000-0000-4000-8000-000000000014', 'ci14@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-cl-otra"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de660000-%';
update public.profiles set role = 'teacher' where id = 'de660000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de660000-0000-4000-8000-000000000021', 'Curso clases');
insert into public.units (id, course_id, slug, title) values ('de660000-0000-4000-8000-0000000000d1', 'de660000-0000-4000-8000-000000000021', 'energia', 'Energía');
insert into public.lessons (id, unit_id, course_id, slug, title, theory, simulation) values
  ('de660000-0000-4000-8000-0000000000b1', 'de660000-0000-4000-8000-0000000000d1', 'de660000-0000-4000-8000-000000000021', 'trabajo', 'Trabajo y energía',
   E'## Teorema trabajo-energía\nTexto.\n\n### Fuerzas conservativas\nTexto.', '{"key":"plano-inclinado"}');
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt, points, published) values
  ('de660000-0000-4000-8000-0000000000e1', 'de660000-0000-4000-8000-000000000021', 'de660000-0000-4000-8000-0000000000b1', 'te-1', 'numerica', 'basico', 'bank', 'numeric', 'P', 1, true);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de660000-0000-4000-8000-000000000031', 'de660000-0000-4000-8000-000000000021', 'Sección A', 'CLASEA01', 'de660000-0000-4000-8000-000000000001'),
  ('de660000-0000-4000-8000-000000000032', 'de660000-0000-4000-8000-000000000021', 'Sección B', 'CLASEB01', 'de660000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de660000-0000-4000-8000-000000000031', 'de660000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de660000-0000-4000-8000-000000000031', 'de660000-0000-4000-8000-000000000011'), ('de660000-0000-4000-8000-000000000031', 'de660000-0000-4000-8000-000000000012'),
  ('de660000-0000-4000-8000-000000000031', 'de660000-0000-4000-8000-000000000013'), ('de660000-0000-4000-8000-000000000032', 'de660000-0000-4000-8000-000000000014'),
  ('de660000-0000-4000-8000-000000000032', 'de660000-0000-4000-8000-000000000012');
insert into public.class_monitors (class_id, user_id) values ('de660000-0000-4000-8000-000000000031', 'de660000-0000-4000-8000-000000000011');
update public.orbe_ia_config set enabled = true, api_real = false where id = 1;

-- utilidades de la prueba: rutas válidas
create temp table rutas (n int, path text, sha text);
grant all on rutas to authenticated, service_role;

-- 1) el profesor registra una clase y configura permisos; un monitor NO habilitado es rechazado
set local role authenticated;
select set_config('request.path', '/rpc/clase_crear', true);
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.clase_crear('{"client_id":"c6600000-0000-4000-8000-000000000009","class_id":"de660000-0000-4000-8000-000000000031","fecha":"2026-11-02","title":"X"}');
    raise exception 'FALLO: monitor no habilitado registró'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  r := public.clase_crear('{"client_id":"c6600000-0000-4000-8000-000000000001","class_id":"de660000-0000-4000-8000-000000000031","fecha":"2026-11-02","title":"Teorema trabajo-energía","temas":["trabajo","energía cinética"],"unit_id":"de660000-0000-4000-8000-0000000000d1"}');
  perform set_config('prueba.c1', r ->> 'id', true);
  if (public.clase_crear('{"client_id":"c6600000-0000-4000-8000-000000000001","class_id":"de660000-0000-4000-8000-000000000031","fecha":"2026-11-02","title":"Otra"}') ->> 'id') <> r ->> 'id' then
    raise exception 'FALLO: registrar no es idempotente'; end if;
  begin perform public.clase_crear('{"client_id":"c6600000-0000-4000-8000-000000000002","class_id":"de660000-0000-4000-8000-000000000031","fecha":"2030-01-01","title":"Futuro"}');
    raise exception 'FALLO: fecha futura'; exception when invalid_parameter_value then null; end;
  perform public.clase_permisos_config('de660000-0000-4000-8000-000000000031', true, false);
  perform public.clase_delegado_otorgar('de660000-0000-4000-8000-000000000031', 'de660000-0000-4000-8000-000000000012', null);
  begin perform public.clase_delegado_otorgar('de660000-0000-4000-8000-000000000031', 'de660000-0000-4000-8000-000000000014', null);
    raise exception 'FALLO: delegado de otra sección'; exception when raise_exception then null; end;
end $$;

-- 2) el monitor (ya habilitado) y el delegado registran; el delegado solo en su sección autorizada; no publican
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000012', true);
do $$ declare r jsonb; begin
  r := public.clase_crear('{"client_id":"c6600000-0000-4000-8000-000000000003","class_id":"de660000-0000-4000-8000-000000000031","fecha":"2026-11-02","title":"Pizarras del delegado"}');
  perform set_config('prueba.c2', r ->> 'id', true);
  if r ->> 'uploader_role' <> 'delegado' then raise exception 'FALLO: papel %', r ->> 'uploader_role'; end if;
  begin perform public.clase_crear('{"client_id":"c6600000-0000-4000-8000-000000000004","class_id":"de660000-0000-4000-8000-000000000032","fecha":"2026-11-02","title":"Otra sección"}');
    raise exception 'FALLO: delegado subió a una sección no autorizada'; exception when insufficient_privilege then null; end;
  if (select count(*) from jsonb_array_elements(public.clases_puedo_subir())) <> 1 then raise exception 'FALLO: secciones del delegado'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000011', true);
do $$ declare r jsonb; begin
  r := public.clase_crear('{"client_id":"c6600000-0000-4000-8000-000000000005","class_id":"de660000-0000-4000-8000-000000000031","fecha":"2026-11-01","title":"Pizarras del monitor"}');
  if r ->> 'uploader_role' <> 'monitor' then raise exception 'FALLO: monitor'; end if;
end $$;
reset role;

-- fotos (lo que hace la Edge Function «entregas» con service_role): hasta 4 por clase
insert into rutas select n, 'de660000-0000-4000-8000-000000000031/' || current_setting('prueba.c2') || '/' || repeat(n::text, 64) || '.webp', repeat(n::text, 64) from generate_series(1, 5) n;
set local role service_role;
do $$ declare i int; begin
  for i in 1 .. 4 loop
    perform public.svc_clase_foto_registrar('de660000-0000-4000-8000-000000000012', current_setting('prueba.c2')::uuid, i, (select path from rutas where n = i), null,
      'image/webp', 900000, 0, 2400, 1800, (select sha from rutas where n = i), null);
  end loop;
  begin perform public.svc_clase_foto_check('de660000-0000-4000-8000-000000000012', current_setting('prueba.c2')::uuid, 5, 1000); raise exception 'FALLO: quinta foto';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_clase_foto_check('de660000-0000-4000-8000-000000000012', current_setting('prueba.c2')::uuid, 1, 99000000); raise exception 'FALLO: tamaño';
  exception when invalid_parameter_value then null; end;
  begin perform public.svc_clase_foto_registrar('de660000-0000-4000-8000-000000000012', current_setting('prueba.c2')::uuid, 2, '../../otra/sección.webp', null,
      'image/webp', 1000, 0, 100, 100, (select sha from rutas where n = 5), null); raise exception 'FALLO: ruta manipulada';
  exception when invalid_parameter_value or check_violation then null; end;
  begin perform public.svc_clase_foto_check('de660000-0000-4000-8000-000000000014', current_setting('prueba.c2')::uuid, 1, 1000); raise exception 'FALLO: estudiante de otra sección sube';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 3) el delegado envía; no puede publicar ni revisar; el estudiante no ve lo pendiente
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000012', true);
do $$ begin
  begin perform public.clase_enviar(current_setting('prueba.c2')::uuid, true); raise exception 'FALLO: el delegado publicó';
  exception when insufficient_privilege then null; end;
  perform public.clase_enviar(current_setting('prueba.c2')::uuid, false);
  begin perform public.clase_fotos_revisar(current_setting('prueba.c2')::uuid, 'aprobada', null); raise exception 'FALLO: el delegado aprobó';
  exception when insufficient_privilege then null; end;
  begin perform public.clase_version_guardar(current_setting('prueba.c2')::uuid, null, '{"secciones":[{"titulo":"x","cuerpo":"y"}]}'); raise exception 'FALLO: el delegado editó la ampliada';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000013', true);
do $$ begin
  if jsonb_array_length(public.clases_mias()) <> 0 then raise exception 'FALLO: el estudiante ve clases pendientes'; end if;
  begin perform public.clase_detalle(current_setting('prueba.c2')::uuid); raise exception 'FALLO: detalle pendiente visible';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.class_session_images; raise exception 'FALLO: tabla de fotos legible'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  begin perform public.svc_clase_fotos('de660000-0000-4000-8000-000000000013', current_setting('prueba.c2')::uuid); raise exception 'FALLO: URLs de fotos pendientes';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 4) el profesor corrige, reordena y aprueba; las fotos aprobadas se ven en la sección A, no en la B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000001', true);
do $$ declare ids uuid[]; begin
  perform public.clase_editar(current_setting('prueba.c2')::uuid, '{"fecha":"2026-11-02","title":"Conservación de la energía","temas":["energía mecánica"]}');
  select array_agg(id order by posicion desc) into ids from (select id, posicion from jsonb_to_recordset(public.clase_detalle(current_setting('prueba.c2')::uuid) -> 'imagenes') as x(id uuid, posicion int)) q;
  perform public.clase_fotos_reordenar(current_setting('prueba.c2')::uuid, ids);
  if (public.clase_detalle(current_setting('prueba.c2')::uuid) -> 'imagenes' -> 0 ->> 'id')::uuid <> ids[1] then raise exception 'FALLO: orden'; end if;
  perform public.clase_fotos_revisar(current_setting('prueba.c2')::uuid, 'aprobada', null);
end $$;
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000013', true);
do $$ declare d jsonb; begin
  if jsonb_array_length(public.clases_mias()) <> 1 then raise exception 'FALLO: clase aprobada no visible'; end if;
  d := public.clase_detalle(current_setting('prueba.c2')::uuid);
  if jsonb_array_length(d -> 'imagenes') <> 4 or d ? 'versiones' or d ? 'generaciones' or d -> 'publicada' <> 'null'::jsonb then raise exception 'FALLO: detalle del estudiante %', d; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000014","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000014', true);
do $$ begin
  if jsonb_array_length(public.clases_mias()) <> 0 then raise exception 'FALLO: otra sección ve la clase'; end if;
  begin perform public.clase_detalle(current_setting('prueba.c2')::uuid); raise exception 'FALLO: otra sección ve el detalle';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 5) IA: no se genera al subir; solo el profesor; idempotente; borrador separado; publicación aparte
do $$ begin
  -- solo las clases de esta prueba (la copia de producción puede tener generaciones reales)
  if exists (select 1 from public.class_ai_generations where session_id::text in (current_setting('prueba.c1'), current_setting('prueba.c2'))) then
    raise exception 'FALLO: se generó al subir'; end if;
end $$;
set local role service_role;
do $$ declare r jsonb; f jsonb; begin
  begin perform public.svc_clase_ia_iniciar('de660000-0000-4000-8000-000000000012', current_setting('prueba.c2')::uuid, 'a6600000-0000-4000-8000-000000000001', 'claude-sonnet-5-5', 'detallado', '', 0);
    raise exception 'FALLO: el delegado generó con IA'; exception when insufficient_privilege then null; end;
  begin perform public.svc_clase_ia_iniciar('de660000-0000-4000-8000-000000000001', current_setting('prueba.c2')::uuid, 'a6600000-0000-4000-8000-000000000001', 'claude-inventado-9', 'detallado', '', 0);
    raise exception 'FALLO: modelo inventado'; exception when invalid_parameter_value then null; end;
  r := public.svc_clase_ia_iniciar('de660000-0000-4000-8000-000000000001', current_setting('prueba.c2')::uuid, 'a6600000-0000-4000-8000-000000000002', 'claude-haiku-5-5', 'estandar', 'Insistir en las unidades', 0.01);
  if not (r ->> 'ok')::boolean or r ->> 'model' <> 'claude-haiku-5-5' or jsonb_array_length(r -> 'imagenes') <> 4 or jsonb_array_length(r -> 'catalogo' -> 'lecciones') <> 1 then raise exception 'FALLO: iniciar %', r; end if;
  perform set_config('prueba.g1', r ->> 'generation_id', true);
  -- doble clic: la misma petición no crea otra generación
  if not (public.svc_clase_ia_iniciar('de660000-0000-4000-8000-000000000001', current_setting('prueba.c2')::uuid, 'a6600000-0000-4000-8000-000000000002', 'claude-haiku-5-5', 'estandar', '', 0) ->> 'repetida')::boolean then
    raise exception 'FALLO: doble clic'; end if;
  -- otra petición mientras la primera sigue en curso: rechazada
  if public.svc_clase_ia_iniciar('de660000-0000-4000-8000-000000000001', current_setting('prueba.c2')::uuid, 'a6600000-0000-4000-8000-000000000003', 'claude-opus-5-5', 'estandar', '', 0) ->> 'motivo' <> 'en_curso' then
    raise exception 'FALLO: dos generaciones a la vez'; end if;
  -- falla la API: las fotos siguen y se puede reintentar
  f := public.svc_clase_ia_finalizar(current_setting('prueba.g1')::uuid, false, 0, 0, 'limite_api', null, null);
  if (select count(*) from public.class_session_images where session_id = current_setting('prueba.c2')::uuid) <> 4 then raise exception 'FALLO: el error borró fotos'; end if;
  if (public.svc_clase_ia_finalizar(current_setting('prueba.g1')::uuid, true, 1, 1, null, null, null) ->> 'repetida') is null then raise exception 'FALLO: finalizar dos veces'; end if;
  -- reintento con Sonnet: borrador + enlaces validados (uno real con apartado real, uno inventado, una brecha, un apartado inventado)
  r := public.svc_clase_ia_iniciar('de660000-0000-4000-8000-000000000001', current_setting('prueba.c2')::uuid, 'a6600000-0000-4000-8000-000000000004', 'claude-sonnet-5-5', 'detallado', '', 0.05);
  perform set_config('prueba.g2', r ->> 'generation_id', true);
  f := public.svc_clase_ia_finalizar(current_setting('prueba.g2')::uuid, true, 12000, 6000, null,
    '{"secciones":[{"titulo":"Reconstrucción de la pizarra","cuerpo":"Teorema: $W = \\\\Delta K$"},{"titulo":"Incertidumbres","cuerpo":"Un exponente es ilegible."}]}',
    '[{"tipo":"leccion","lesson_id":"de660000-0000-4000-8000-0000000000b1","apartado":"Teorema trabajo-energía","cobertura":"completa"},
      {"tipo":"leccion","lesson_id":"de660000-0000-4000-8000-0000000000ff","cobertura":"completa"},
      {"tipo":"leccion","lesson_id":"de660000-0000-4000-8000-0000000000b1","apartado":"Apartado inventado","cobertura":"parcial"},
      {"tipo":"ejercicio","exercise_id":"de660000-0000-4000-8000-0000000000e1"},
      {"tipo":"simulador","lesson_id":"de660000-0000-4000-8000-0000000000b1","sim_key":"plano-inclinado"},
      {"tipo":"simulador","lesson_id":"de660000-0000-4000-8000-0000000000b1","sim_key":"inexistente"},
      {"tipo":"brecha","concepto":"Potencia instantánea","cobertura":"ninguna"}]');
  if (f ->> 'enlaces')::int <> 5 or (f ->> 'descartados')::int <> 2 then raise exception 'FALLO: validación de enlaces %', f; end if;
  if (select apartado from public.class_resource_links where session_id = current_setting('prueba.c2')::uuid and cobertura = 'parcial') is not null then
    raise exception 'FALLO: apartado inventado conservado'; end if;
  if (select model from public.class_ai_generations where id = current_setting('prueba.g2')::uuid) <> 'claude-sonnet-5-5' then raise exception 'FALLO: modelo registrado'; end if;
  if (select estado from public.class_ai_versions where generation_id = current_setting('prueba.g2')::uuid) <> 'borrador' then raise exception 'FALLO: se publicó sin aprobación'; end if;
  -- simulador: costo 0
  if (select cost_usd from public.class_ai_generations where id = current_setting('prueba.g2')::uuid) <> 0 then raise exception 'FALLO: costo simulado'; end if;
end $$;
reset role;

-- costo real según el registro de modelos (Sonnet 2/10 USD por millón): 12 000 entrada y 6 000 salida = 0,084 USD; Haiku largo
do $$ begin
  if public.orbe_ia_costo_modelo('claude-sonnet-5-5', 12000, 6000) <> 0.084 then raise exception 'FALLO: costo Sonnet %', public.orbe_ia_costo_modelo('claude-sonnet-5-5', 12000, 6000); end if;
  if public.orbe_ia_costo_modelo('claude-haiku-5-5', 200000, 1000) <> 0.1025 then raise exception 'FALLO: tarifa larga de Haiku'; end if;
end $$;

-- el estudiante no ve el borrador ni los enlaces sugeridos
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000013', true);
do $$ declare d jsonb; begin
  d := public.clase_detalle(current_setting('prueba.c2')::uuid);
  if d -> 'publicada' <> 'null'::jsonb or jsonb_array_length(d -> 'enlaces') <> 0 then raise exception 'FALLO: borrador visible %', d; end if;
end $$;
-- el profesor publica (confirmando los enlaces sugeridos); una edición posterior NO cambia lo publicado
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000001', true);
do $$ declare v uuid; nueva jsonb; begin
  select (x ->> 'id')::uuid into v from jsonb_array_elements(public.clase_detalle(current_setting('prueba.c2')::uuid) -> 'versiones') x where x ->> 'generation_id' = current_setting('prueba.g2');
  perform public.clase_version_publicar(v, true);
  nueva := public.clase_version_guardar(current_setting('prueba.c2')::uuid, v, '{"secciones":[{"titulo":"Reconstrucción","cuerpo":"Editado por el profesor"}]}');
  if (public.clase_detalle(current_setting('prueba.c2')::uuid) -> 'publicada' ->> 'id')::uuid <> v then raise exception 'FALLO: la edición sustituyó lo publicado'; end if;
  if nueva ->> 'estado' <> 'borrador' then raise exception 'FALLO: estado de la edición'; end if;
  begin perform public.clase_version_guardar(current_setting('prueba.c2')::uuid, v, '{"secciones":[]}'); raise exception 'FALLO: contenido vacío';
  exception when invalid_parameter_value then null; end;
  perform set_config('prueba.v1', v::text, true);
  if jsonb_array_length(public.clases_brechas('de660000-0000-4000-8000-000000000031')) <> 1 then raise exception 'FALLO: brecha curricular'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de660000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de660000-0000-4000-8000-000000000013', true);
do $$ declare d jsonb; begin
  d := public.clase_detalle(current_setting('prueba.c2')::uuid);
  if (d -> 'publicada' ->> 'id')::uuid <> current_setting('prueba.v1')::uuid or jsonb_array_length(d -> 'enlaces') <> 5 then raise exception 'FALLO: publicada para el estudiante %', d; end if;
  if d -> 'publicada' -> 'contenido' -> 'secciones' -> 0 ->> 'cuerpo' not like '%Delta K%' then raise exception 'FALLO: contenido publicado'; end if;
end $$;
reset role;

-- 6) presupuesto en el servidor: con API real y presupuesto agotado no se reserva; la clase publicada no se borra
update public.orbe_ia_config set api_real = true, monthly_budget_usd = 0.01 where id = 1;
set local role service_role;
do $$ declare r jsonb; begin
  r := public.svc_clase_ia_iniciar('de660000-0000-4000-8000-000000000001', current_setting('prueba.c2')::uuid, 'a6600000-0000-4000-8000-000000000005', 'claude-opus-5-5', 'exhaustivo', '', 0.9);
  if r ->> 'motivo' <> 'presupuesto' then raise exception 'FALLO: presupuesto %', r; end if;
  begin perform public.svc_clase_eliminar('de660000-0000-4000-8000-000000000001', current_setting('prueba.c2')::uuid); raise exception 'FALLO: borró una clase publicada';
  exception when raise_exception then null; end;
end $$;
reset role;

-- 7) auditoría y permisos
do $$ begin
  if (select count(*) from public.class_audit_events where session_id = current_setting('prueba.c2')::uuid) < 8 then raise exception 'FALLO: auditoría'; end if;
  if has_function_privilege('authenticated', 'public.svc_clase_ia_iniciar(uuid, uuid, uuid, text, text, text, numeric)', 'execute')
     or has_function_privilege('anon', 'public.clases_mias()', 'execute') then raise exception 'FALLO: permisos'; end if;
end $$;

select 'clases_impartidas.sql: PRUEBAS PASARON' as resultado;
rollback;
