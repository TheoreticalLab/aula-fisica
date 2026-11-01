-- Pruebas: asistente de actividades con IA (migración 56). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de560000-0000-4000-8000-000000000001', 'aa1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-asistente","aula_role":"teacher"}', '{}', now(), now()),
  ('de560000-0000-4000-8000-000000000002', 'aa2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-asistente-ajeno","aula_role":"teacher"}', '{}', now(), now()),
  ('de560000-0000-4000-8000-000000000011', 'aa11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-asistente"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de560000-%';
update public.profiles set role = 'teacher' where id in ('de560000-0000-4000-8000-000000000001', 'de560000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de560000-0000-4000-8000-000000000021', 'Curso asistente'), ('de560000-0000-4000-8000-000000000022', 'Curso ajeno');
insert into public.units (id, course_id, slug, title) values
  ('de560000-0000-4000-8000-000000000031', 'de560000-0000-4000-8000-000000000021', 'u-as', 'Choques'),
  ('de560000-0000-4000-8000-000000000032', 'de560000-0000-4000-8000-000000000022', 'u-aj', 'Otra');
insert into public.lessons (id, unit_id, course_id, slug, title, hidden) values
  ('de560000-0000-4000-8000-000000000041', 'de560000-0000-4000-8000-000000000031', 'de560000-0000-4000-8000-000000000021', 'l-as', 'Choques inelásticos', false),
  ('de560000-0000-4000-8000-000000000043', 'de560000-0000-4000-8000-000000000031', 'de560000-0000-4000-8000-000000000021', 'l-oc', 'Lección oculta', true),
  ('de560000-0000-4000-8000-000000000042', 'de560000-0000-4000-8000-000000000032', 'de560000-0000-4000-8000-000000000022', 'l-aj', 'Ajena', false);
insert into public.exercises (course_id, lesson_id, slug, category, difficulty, role, format, prompt, published) values
  ('de560000-0000-4000-8000-000000000021', 'de560000-0000-4000-8000-000000000041', 'as-1', 'numerica', 'basico', 'bank', 'numeric', 'P1', true),
  ('de560000-0000-4000-8000-000000000021', 'de560000-0000-4000-8000-000000000041', 'as-2', 'numerica', 'intermedio', 'bank', 'numeric', 'P2', true),
  ('de560000-0000-4000-8000-000000000021', 'de560000-0000-4000-8000-000000000041', 'as-3', 'numerica', 'intermedio', 'bank', 'numeric', 'P3 borrador', false);
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de560000-0000-4000-8000-000000000051', 'de560000-0000-4000-8000-000000000021', 'Sección asistente', 'ASISTE01', 'de560000-0000-4000-8000-000000000001'),
  ('de560000-0000-4000-8000-000000000052', 'de560000-0000-4000-8000-000000000022', 'Sección ajena', 'ASISTE02', 'de560000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('de560000-0000-4000-8000-000000000051', 'de560000-0000-4000-8000-000000000001'), ('de560000-0000-4000-8000-000000000052', 'de560000-0000-4000-8000-000000000002') on conflict do nothing;

do $$ begin
  if has_function_privilege('authenticated', 'public.svc_asistente_contexto(uuid)', 'execute') then raise exception 'FALLO: contexto expuesto'; end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conname = 'orbe_ia_usage_purpose_check') not like '%asistente%' then raise exception 'FALLO: falta el propósito asistente'; end if;
end $$;

set local role service_role;
do $$ declare c jsonb; l jsonb; r jsonb; begin
  c := public.svc_asistente_contexto('de560000-0000-4000-8000-000000000001');
  -- solo sus secciones y sus asignaturas; lecciones visibles con las preguntas PUBLICADAS por nivel
  if jsonb_array_length(c -> 'secciones') <> 1 or c -> 'secciones' -> 0 ->> 'nombre' <> 'Sección asistente' then raise exception 'FALLO: secciones %', c -> 'secciones'; end if;
  if jsonb_array_length(c -> 'asignaturas') <> 1 then raise exception 'FALLO: asignaturas ajenas %', c -> 'asignaturas'; end if;
  l := c -> 'asignaturas' -> 0 -> 'lecciones';
  if jsonb_array_length(l) <> 1 or l -> 0 ->> 'titulo' <> 'Choques inelásticos' then raise exception 'FALLO: lecciones (sin las ocultas) %', l; end if;
  if (l -> 0 -> 'publicadas' ->> 'intermedio')::int <> 1 or (l -> 0 -> 'publicadas' ->> 'basico')::int <> 1 then raise exception 'FALLO: conteo de publicadas %', l -> 0 -> 'publicadas'; end if;
  if c::text like '%P1%' or c::text like '%borrador%' then raise exception 'FALLO: el contexto lleva enunciados'; end if;
  if not (c ->> 'ahora' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$') or c ->> 'dia_semana' not in ('domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado') then raise exception 'FALLO: hora local %', c; end if;
  begin perform public.svc_asistente_contexto('de560000-0000-4000-8000-000000000011'); raise exception 'FALLO: un estudiante obtuvo contexto';
  exception when insufficient_privilege then null; end;
  -- reserva con el nuevo propósito (simulada si las llamadas reales están apagadas)
  update public.orbe_ia_config set enabled = true, api_real = false, daily_max_calls = 1000 where id = 1;
  r := public.svc_orbe_ia_reservar_uso('de560000-0000-4000-8000-000000000001', 'asistente');
  if not (r ->> 'ok')::boolean or (r ->> 'api_real')::boolean then raise exception 'FALLO: reserva asistente %', r; end if;
  if (select purpose from public.orbe_ia_usage where id = (r ->> 'usage_id')::bigint) <> 'asistente' then raise exception 'FALLO: propósito registrado'; end if;
  r := public.svc_orbe_ia_reservar_uso('de560000-0000-4000-8000-000000000001', 'generar');
  if not (r ->> 'ok')::boolean then raise exception 'FALLO: el propósito generar dejó de funcionar (%)', r; end if;
end $$;
reset role;

select 'asistente_actividades.sql: PRUEBAS PASARON' as resultado;
rollback;
