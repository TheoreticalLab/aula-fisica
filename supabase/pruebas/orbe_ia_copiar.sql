-- Pruebas: Orbe IA · copiar el banco entre asignaturas (migración 31). Datos sintéticos; se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d9200000-0000-4000-8000-000000000001', 'ca@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-copiar","aula_role":"admin"}', '{}', now(), now()),
  ('d9200000-0000-4000-8000-000000000011', 'c1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-copiar-1"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'd9200000-%';
update public.profiles set role = 'admin' where id = 'd9200000-0000-4000-8000-000000000001';

-- dos asignaturas instaladas desde la misma biblioteca (mismos slugs); en la 1-A el profesor cambió un título y la teoría
insert into public.courses (id, title) values ('d9200000-0000-4000-8000-000000000021', 'FG1 copia'), ('d9200000-0000-4000-8000-000000000022', 'FG1-A copia');
insert into public.units (id, course_id, slug, title) values
  ('d9200000-0000-4000-8000-000000000031', 'd9200000-0000-4000-8000-000000000021', 'u-cin', 'Cinemática'),
  ('d9200000-0000-4000-8000-000000000032', 'd9200000-0000-4000-8000-000000000022', 'u-cin', 'Cinemática');
insert into public.lessons (id, unit_id, course_id, slug, title, theory) values
  ('d9200000-0000-4000-8000-000000000041', 'd9200000-0000-4000-8000-000000000031', 'd9200000-0000-4000-8000-000000000021', 'mru', 'MRU', E'## Velocidad\n\n## Gráficas'),
  ('d9200000-0000-4000-8000-000000000042', 'd9200000-0000-4000-8000-000000000031', 'd9200000-0000-4000-8000-000000000021', 'solo-fg1', 'Solo en FG1', ''),
  ('d9200000-0000-4000-8000-000000000043', 'd9200000-0000-4000-8000-000000000032', 'd9200000-0000-4000-8000-000000000022', 'mru', 'Movimiento rectilíneo uniforme', E'## Velocidad');

insert into public.orbe_ia_jokes (course_id, lesson_id, section, apartado, text, status, origin) values
  ('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000041', 'teoria', 'Velocidad', 'La velocidad constante es la más tranquila del curso.', 'aprobado', 'ia'),
  ('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000041', 'teoria', 'Gráficas', 'Una recta en la gráfica x-t: la vida sin sobresaltos.', 'aprobado', 'ia'),
  ('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000041', null, null, 'El MRU nunca acelera sus decisiones.', 'pendiente', 'ia'),
  ('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000041', null, null, '[Simulación] Chiste de prueba del simulador.', 'aprobado', 'simulador'),
  ('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000041', null, null, 'Este chiste lo eliminó el profesor en el origen.', 'eliminado', 'ia'),
  ('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000042', null, null, 'Chiste de una lección que no existe en la 1-A.', 'aprobado', 'profesor');
-- en el destino ya estaba (y fue eliminado) un chiste igual al de «Velocidad»: no debe volver
insert into public.orbe_ia_jokes (course_id, lesson_id, section, text, status, origin) values
  ('d9200000-0000-4000-8000-000000000022', 'd9200000-0000-4000-8000-000000000043', 'teoria', 'La velocidad constante es la MÁS tranquila del curso!', 'eliminado', 'ia');

set local role authenticated;

-- 1) un estudiante no puede copiar
select set_config('request.jwt.claims', '{"sub":"d9200000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9200000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.orbe_ia_admin_copiar('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000022', false, false, false);
    raise exception 'FALLO: un estudiante copió el banco'; exception when insufficient_privilege then null; end;
end $$;

-- 2) administrador: vista previa (no guarda), copia real y segunda copia sin duplicar
select set_config('request.jwt.claims', '{"sub":"d9200000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd9200000-0000-4000-8000-000000000001', true);
do $$ declare r jsonb; begin
  begin perform public.orbe_ia_admin_copiar('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000021');
    raise exception 'FALLO: copió una asignatura sobre sí misma'; exception when invalid_parameter_value then null; end;

  -- solo aprobados, sin simulador: 3 candidatos (Velocidad, Gráficas, lección inexistente)
  r := public.orbe_ia_admin_copiar('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000022');
  if r <> '{"revisados": 3, "copiados": 1, "duplicados": 1, "sin_leccion": 1, "sin_apartado": 1, "prueba": true}'::jsonb then raise exception 'FALLO: vista previa %', r; end if;

  -- con pendientes: copia también el pendiente, conservando su estado
  r := public.orbe_ia_admin_copiar('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000022', true, false, false);
  if (r ->> 'copiados')::int <> 2 or (r ->> 'prueba')::boolean then raise exception 'FALLO: copia %', r; end if;
  r := public.orbe_ia_admin_copiar('d9200000-0000-4000-8000-000000000021', 'd9200000-0000-4000-8000-000000000022', true, false, false);
  if (r ->> 'copiados')::int <> 0 or (r ->> 'duplicados')::int <> 3 then raise exception 'FALLO: la segunda copia duplicó %', r; end if;
end $$;

reset role;
do $$ begin
  -- la vista previa no guardó nada extra; la copia real dejó exactamente 2 nuevos en la 1-A, en su lección «mru»
  if (select count(*) from public.orbe_ia_jokes where course_id = 'd9200000-0000-4000-8000-000000000022') <> 3 then raise exception 'FALLO: total en el destino'; end if;
  if exists (select 1 from public.orbe_ia_jokes where course_id = 'd9200000-0000-4000-8000-000000000022' and lesson_id <> 'd9200000-0000-4000-8000-000000000043') then
    raise exception 'FALLO: lección mal emparejada'; end if;
  if not exists (select 1 from public.orbe_ia_jokes where course_id = 'd9200000-0000-4000-8000-000000000022' and text like 'Una recta%' and apartado is null and section = 'teoria' and status = 'aprobado') then
    raise exception 'FALLO: el apartado inexistente en el destino debía quedar como chiste de la subsección'; end if;
  if not exists (select 1 from public.orbe_ia_jokes where course_id = 'd9200000-0000-4000-8000-000000000022' and text like 'El MRU%' and status = 'pendiente') then
    raise exception 'FALLO: no conservó el estado pendiente'; end if;
  if exists (select 1 from public.orbe_ia_jokes where course_id = 'd9200000-0000-4000-8000-000000000022' and (origin = 'simulador' or text like 'Este chiste lo eliminó%')) then
    raise exception 'FALLO: copió simulados o eliminados'; end if;
  if (select count(*) from public.orbe_ia_jokes where course_id = 'd9200000-0000-4000-8000-000000000022' and status = 'eliminado') <> 1 then
    raise exception 'FALLO: resucitó un chiste eliminado en el destino'; end if;
end $$;

select 'ORBE IA · COPIAR BANCO: PRUEBAS PASARON' as resultado;
rollback;
