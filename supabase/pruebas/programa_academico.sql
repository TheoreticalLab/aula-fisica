-- Pruebas: programa académico con seguimiento de lo impartido (migración 71). Se deshace al final.
-- Asignatura P (con programa): U1 preparada (capítulo L1), U2 publicada (L2), U3 borrador (L3).
-- Secciones S1 (profesor T1, equipo docente) y S2 (profesor T2). Estudiantes A (S1) y B (S2). Asignatura Q sin programa.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de710000-0000-4000-8000-000000000001', 'pr1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-programa1","aula_role":"teacher"}', '{}', now(), now()),
  ('de710000-0000-4000-8000-000000000002', 'pr2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-programa2","aula_role":"teacher"}', '{}', now(), now()),
  ('de710000-0000-4000-8000-000000000011', 'pr11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pr-a"}', '{}', now(), now()),
  ('de710000-0000-4000-8000-000000000012', 'pr12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pr-b"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de710000-%';
update public.profiles set role = 'teacher' where id in ('de710000-0000-4000-8000-000000000001', 'de710000-0000-4000-8000-000000000002');
insert into public.courses (id, title, programa) values ('de710000-0000-4000-8000-000000000021', 'Curso P', true), ('de710000-0000-4000-8000-000000000022', 'Curso Q', false);
insert into public.course_staff (course_id, user_id) values ('de710000-0000-4000-8000-000000000021', 'de710000-0000-4000-8000-000000000001');
insert into public.units (id, course_id, slug, title, position, status) values
  ('de710000-0000-4000-8000-000000000041', 'de710000-0000-4000-8000-000000000021', 'u1', 'Unidad I', 1, 'preparado'),
  ('de710000-0000-4000-8000-000000000042', 'de710000-0000-4000-8000-000000000021', 'u2', 'Unidad II', 2, 'publicado'),
  ('de710000-0000-4000-8000-000000000043', 'de710000-0000-4000-8000-000000000021', 'u3', 'Unidad III', 3, 'borrador'),
  ('de710000-0000-4000-8000-000000000044', 'de710000-0000-4000-8000-000000000022', 'q1', 'Q', 1, 'publicado');
insert into public.lessons (id, unit_id, course_id, slug, title, position) values
  ('de710000-0000-4000-8000-000000000051', 'de710000-0000-4000-8000-000000000041', 'de710000-0000-4000-8000-000000000021', 'l1', 'Capítulo 1', 1),
  ('de710000-0000-4000-8000-000000000052', 'de710000-0000-4000-8000-000000000042', 'de710000-0000-4000-8000-000000000021', 'l2', 'Capítulo 2', 1),
  ('de710000-0000-4000-8000-000000000053', 'de710000-0000-4000-8000-000000000043', 'de710000-0000-4000-8000-000000000021', 'l3', 'Capítulo 3', 1),
  ('de710000-0000-4000-8000-000000000054', 'de710000-0000-4000-8000-000000000044', 'de710000-0000-4000-8000-000000000022', 'q1', 'Q1', 1);
insert into public.concepts (id, course_id, lesson_id, slug, name, nivel, position, hidden) values
  ('de710000-0000-4000-8000-0000000000c1', 'de710000-0000-4000-8000-000000000021', 'de710000-0000-4000-8000-000000000051', 'p-c1', 'Subtema 1', 'esencial', 1, false),
  ('de710000-0000-4000-8000-0000000000c2', 'de710000-0000-4000-8000-000000000021', 'de710000-0000-4000-8000-000000000052', 'p-c2', 'Subtema 2', 'esencial', 1, false),
  ('de710000-0000-4000-8000-0000000000c3', 'de710000-0000-4000-8000-000000000021', 'de710000-0000-4000-8000-000000000052', 'p-c3', 'Subtema 3', 'complementario', 2, false),
  ('de710000-0000-4000-8000-0000000000c4', 'de710000-0000-4000-8000-000000000021', 'de710000-0000-4000-8000-000000000052', 'p-c4', 'Subtema oculto', 'profundizacion', 3, true),
  ('de710000-0000-4000-8000-0000000000c5', 'de710000-0000-4000-8000-000000000022', 'de710000-0000-4000-8000-000000000054', 'q-c5', 'Ajeno', 'esencial', 1, false);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de710000-0000-4000-8000-000000000031', 'de710000-0000-4000-8000-000000000021', 'S1', 'PROGR071', 'de710000-0000-4000-8000-000000000001'),
  ('de710000-0000-4000-8000-000000000032', 'de710000-0000-4000-8000-000000000021', 'S2', 'PROGR072', 'de710000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('de710000-0000-4000-8000-000000000031', 'de710000-0000-4000-8000-000000000001'), ('de710000-0000-4000-8000-000000000032', 'de710000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de710000-0000-4000-8000-000000000031', 'de710000-0000-4000-8000-000000000011'), ('de710000-0000-4000-8000-000000000032', 'de710000-0000-4000-8000-000000000012');
insert into public.class_sessions (id, class_id, fecha, title, uploader_role, uploaded_by, fotos_estado) values
  ('de710000-0000-4000-8000-0000000000a1', 'de710000-0000-4000-8000-000000000031', current_date, 'Clase de S1', 'docente', 'de710000-0000-4000-8000-000000000001', 'aprobada'),
  ('de710000-0000-4000-8000-0000000000a2', 'de710000-0000-4000-8000-000000000032', current_date, 'Clase de S2', 'docente', 'de710000-0000-4000-8000-000000000002', 'aprobada');

-- el profesor edita un subtema desde el panel: queda «personalizado» (el instalador no lo pisa)
update public.concepts set name = 'Subtema 2 (editado)' where id = 'de710000-0000-4000-8000-0000000000c2';
do $$ begin
  if not (select customized from public.concepts where id = 'de710000-0000-4000-8000-0000000000c2') then raise exception 'FALLO: customized'; end if;
end $$;

set local role authenticated;
select set_config('request.path', '/rpc/prueba', true);

-- ---- T2 no gestiona S1; un estudiante tampoco
select set_config('request.jwt.claims', '{"sub":"de710000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de710000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.programa_seccion('de710000-0000-4000-8000-000000000031'); raise exception 'FALLO: T2 ve S1'; exception when insufficient_privilege then null; end;
  begin perform public.programa_marcar('de710000-0000-4000-8000-000000000031', array['de710000-0000-4000-8000-0000000000c2'::uuid], current_date); raise exception 'FALLO: T2 marca en S1';
  exception when insufficient_privilege then null; end;
  -- T2 no es del equipo docente: no puede crear vínculos para todas las secciones, sí para la suya
  begin perform public.programa_enlace_guardar(jsonb_build_object('lesson_id', 'de710000-0000-4000-8000-000000000052', 'tipo', 'enlace', 'url', 'https://ejemplo.org/x', 'titulo', 'X'));
    raise exception 'FALLO: T2 crea un vínculo global'; exception when insufficient_privilege then null; end;
  perform public.programa_enlace_guardar(jsonb_build_object('lesson_id', 'de710000-0000-4000-8000-000000000052', 'class_id', 'de710000-0000-4000-8000-000000000032',
    'tipo', 'enlace', 'url', 'https://ejemplo.org/s2', 'titulo', 'Solo S2', 'publicado', true));
end $$;
select set_config('request.jwt.claims', '{"sub":"de710000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de710000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.programa_seccion('de710000-0000-4000-8000-000000000031'); raise exception 'FALLO: el estudiante ve el seguimiento'; exception when insufficient_privilege then null; end;
  begin perform public.programa_capitulo('de710000-0000-4000-8000-000000000052'); raise exception 'FALLO: el estudiante ve las notas'; exception when insufficient_privilege then null; end;
  -- el subtema oculto no se ve ni en la tabla
  if exists (select 1 from public.concepts where id = 'de710000-0000-4000-8000-0000000000c4') then raise exception 'FALLO: subtema oculto visible'; end if;
end $$;

-- ---- T1: marca lo impartido en S1, crea vínculos y notas
select set_config('request.jwt.claims', '{"sub":"de710000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de710000-0000-4000-8000-000000000001', true);
do $$ declare j jsonb; n integer; v uuid; begin
  n := public.programa_marcar('de710000-0000-4000-8000-000000000031', array['de710000-0000-4000-8000-0000000000c2', 'de710000-0000-4000-8000-0000000000c3']::uuid[],
                              current_date, 'de710000-0000-4000-8000-0000000000a1', 'Primera parte');
  if n <> 2 then raise exception 'FALLO: marcar (%)', n; end if;
  -- repetir no duplica
  perform public.programa_marcar('de710000-0000-4000-8000-000000000031', array['de710000-0000-4000-8000-0000000000c2']::uuid[], current_date);
  begin perform public.programa_marcar('de710000-0000-4000-8000-000000000031', array['de710000-0000-4000-8000-0000000000c5']::uuid[], current_date); raise exception 'FALLO: subtema ajeno';
  exception when insufficient_privilege then null; end;
  begin perform public.programa_marcar('de710000-0000-4000-8000-000000000031', array['de710000-0000-4000-8000-0000000000c2']::uuid[], current_date, 'de710000-0000-4000-8000-0000000000a2');
    raise exception 'FALLO: clase de otra sección'; exception when insufficient_privilege then null; end;
  begin perform public.programa_marcar('de710000-0000-4000-8000-000000000031', array['de710000-0000-4000-8000-0000000000c2']::uuid[], current_date + 30); raise exception 'FALLO: fecha futura';
  exception when invalid_parameter_value then null; end;

  j := public.programa_seccion('de710000-0000-4000-8000-000000000031');
  if jsonb_array_length(j -> 'unidades') <> 3 or (j ->> 'estudiantes')::int <> 1
     or jsonb_array_length((select x from jsonb_array_elements(j -> 'unidades' -> 1 -> 'capitulos' -> 0 -> 'subtemas') x where x ->> 'nombre' = 'Subtema 2 (editado)') -> 'impartido') <> 1 then
    raise exception 'FALLO: programa de la sección %', j; end if;

  -- vínculos: global (equipo docente) publicado, borrador sin publicar, URL no segura rechazada
  perform public.programa_enlace_guardar(jsonb_build_object('lesson_id', 'de710000-0000-4000-8000-000000000052', 'tipo', 'pdf', 'url', 'https://ejemplo.org/apuntes.pdf',
    'titulo', 'Apuntes', 'publicado', true, 'concept_id', 'de710000-0000-4000-8000-0000000000c2'));
  v := public.programa_enlace_guardar(jsonb_build_object('lesson_id', 'de710000-0000-4000-8000-000000000052', 'tipo', 'video', 'url', 'https://ejemplo.org/v', 'titulo', 'Borrador'));
  begin perform public.programa_enlace_guardar(jsonb_build_object('lesson_id', 'de710000-0000-4000-8000-000000000052', 'tipo', 'enlace', 'url', 'http://inseguro.org', 'titulo', 'X'));
    raise exception 'FALLO: http'; exception when check_violation then null; end;
  begin perform public.programa_enlace_guardar(jsonb_build_object('lesson_id', 'de710000-0000-4000-8000-000000000052', 'tipo', 'enlace', 'url', 'https://a.org', 'titulo', 'X',
    'concept_id', 'de710000-0000-4000-8000-0000000000c1')); raise exception 'FALLO: subtema de otro capítulo'; exception when invalid_parameter_value then null; end;
  perform public.programa_enlace_guardar(jsonb_build_object('id', v, 'tipo', 'video', 'url', 'https://ejemplo.org/v2', 'titulo', 'Vídeo', 'publicado', false));
  perform public.programa_nota_guardar('de710000-0000-4000-8000-000000000052', 'Insistir en las unidades', null, 'de710000-0000-4000-8000-000000000031');
  j := public.programa_capitulo('de710000-0000-4000-8000-000000000052');
  -- T1 es del equipo docente: ve los de todas las secciones (global, borrador y el de S2)
  if jsonb_array_length(j -> 'enlaces') <> 3 or jsonb_array_length(j -> 'notas') <> 1 then raise exception 'FALLO: capítulo docente %', j; end if;
end $$;

-- ---- A (S1): previsto, impartido en su sección y disponible para estudiar
select set_config('request.jwt.claims', '{"sub":"de710000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de710000-0000-4000-8000-000000000011', true);
do $$ declare j jsonb; c1 jsonb; c2 jsonb; begin
  j := public.programa_mio('de710000-0000-4000-8000-000000000021');
  -- U1 preparada (programa visible, material no) y U2 publicada; U3 en borrador no aparece
  if jsonb_array_length(j -> 'unidades') <> 2 then raise exception 'FALLO: unidades visibles %', j -> 'unidades'; end if;
  c1 := j -> 'unidades' -> 0 -> 'capitulos' -> 0;
  c2 := j -> 'unidades' -> 1 -> 'capitulos' -> 0;
  if (c1 ->> 'disponible')::boolean or not (c2 ->> 'disponible')::boolean then raise exception 'FALLO: disponible'; end if;
  if jsonb_array_length(c2 -> 'subtemas') <> 2 then raise exception 'FALLO: el subtema oculto aparece'; end if;
  if jsonb_array_length(c2 -> 'subtemas' -> 0 -> 'impartido') <> 1 or jsonb_array_length(c2 -> 'clases') <> 1 then raise exception 'FALLO: impartido en su sección %', c2; end if;
  -- solo el material publicado, global o de su sección
  if jsonb_array_length(c2 -> 'enlaces') <> 1 or c2 -> 'enlaces' -> 0 ->> 'titulo' <> 'Apuntes' then raise exception 'FALLO: enlaces %', c2 -> 'enlaces'; end if;
  if public.programa_mio('de710000-0000-4000-8000-000000000022') is not null then raise exception 'FALLO: asignatura sin programa'; end if;
end $$;

-- ---- B (S2): lo impartido en S1 no cuenta en su sección; ve el vínculo de S2
select set_config('request.jwt.claims', '{"sub":"de710000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de710000-0000-4000-8000-000000000012', true);
do $$ declare c2 jsonb; begin
  c2 := public.programa_mio('de710000-0000-4000-8000-000000000021') -> 'unidades' -> 1 -> 'capitulos' -> 0;
  if jsonb_array_length(c2 -> 'subtemas' -> 0 -> 'impartido') <> 0 or jsonb_array_length(c2 -> 'clases') <> 0 then raise exception 'FALLO: aislamiento entre secciones'; end if;
  if (select count(*) from jsonb_array_elements(c2 -> 'enlaces') x where x ->> 'titulo' in ('Apuntes', 'Solo S2')) <> 2 then raise exception 'FALLO: enlaces de B %', c2 -> 'enlaces'; end if;
end $$;

-- ---- desmarcar: se anula, no se borra
select set_config('request.jwt.claims', '{"sub":"de710000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de710000-0000-4000-8000-000000000001', true);
do $$ declare v uuid; begin
  select (x -> 'impartido' -> 0 ->> 'id')::uuid into v
    from jsonb_array_elements(public.programa_seccion('de710000-0000-4000-8000-000000000031') -> 'unidades' -> 1 -> 'capitulos' -> 0 -> 'subtemas') x where x ->> 'nombre' like 'Subtema 2%';
  perform public.programa_desmarcar(v);
  perform set_config('prueba.cov', v::text, true);
end $$;
reset role;
do $$ begin
  if (select anulado_at from public.program_coverage where id = current_setting('prueba.cov')::uuid) is null then raise exception 'FALLO: anulación'; end if;
  -- un subtema ya impartido no se puede borrar (se oculta)
  begin delete from public.concepts where id = 'de710000-0000-4000-8000-0000000000c3'; raise exception 'FALLO: borrar un subtema impartido';
  exception when foreign_key_violation then null; end;
  if has_function_privilege('anon', 'public.programa_mio(uuid)', 'execute') or has_function_privilege('authenticated', 'public.programa_docente_seccion(uuid)', 'execute') then
    raise exception 'FALLO: permisos'; end if;
end $$;

select 'programa_academico.sql: PRUEBAS PASARON' as resultado;
rollback;
