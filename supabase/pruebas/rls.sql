-- =============================================================================
-- Pruebas de seguridad (RLS y funciones) — ejecutar en el editor SQL de Supabase.
-- Todo ocurre dentro de una transacción que se deshace al final (ROLLBACK): no deja datos.
-- Si alguna comprobación falla, el script se detiene con «FALLO: …».
-- Al terminar debe verse el aviso «TODAS LAS PRUEBAS DE SEGURIDAD PASARON».
-- =============================================================================
begin;

-- Usuarios ficticios
insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'prof.prueba@example.com', 'authenticated', 'authenticated', '{"full_name":"Prof Prueba"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000002', 'est1.prueba@example.com', 'authenticated', 'authenticated', '{"full_name":"Est Uno","role":"admin"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000003', 'est2.prueba@example.com', 'authenticated', 'authenticated', '{"full_name":"Est Dos"}', now(), now());

do $$ begin
  if (select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000002') <> 'student' then
    raise exception 'FALLO: el rol se tomó de los metadatos del registro';
  end if;
end $$;

-- Desde la migración 4, una cuenta sin ID asignado por el servidor (p. ej. registro público) nace INACTIVA
do $$ begin
  if (select active from public.profiles where id = 'a0000000-0000-4000-8000-000000000002') then
    raise exception 'FALLO: una cuenta creada sin ID de administrador quedó activa';
  end if;
end $$;
update public.profiles set active = true, login_id = 'prueba-' || right(id::text, 1)
  where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003');

update public.profiles set role = 'teacher' where id = 'a0000000-0000-4000-8000-000000000001';

-- Contenido mínimo
insert into public.courses (id, title) values ('b0000000-0000-4000-8000-000000000001', 'Curso de prueba');
insert into public.course_staff (course_id, user_id) values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001');
insert into public.units (id, course_id, slug, title) values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'u', 'Unidad');
insert into public.lessons (id, unit_id, course_id, slug, title) values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'l', 'Lección');
insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt)
values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'p1', 'numerica', 'basico', 'practice', 'numeric', '¿Cuánto?'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', null, 'x1', 'numerica', 'basico', 'bank', 'numeric', 'Pregunta de examen'),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', null, 'x2', 'numerica', 'basico', 'bank', 'numeric', 'Pregunta del examen futuro');
insert into public.exercise_keys (exercise_id, answer, hints, explanation)
values
  ('e0000000-0000-4000-8000-000000000001', '{"format":"numeric","value":"20 m/s"}', '["pista 1"]', 'SECRETO'),
  ('e0000000-0000-4000-8000-000000000002', '{"format":"numeric","value":"5 m"}', '[]', 'SECRETO EXAMEN');
insert into public.classes (id, course_id, name, join_code, created_by) values ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Clase', 'PRUEBA23', 'a0000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.class_groups (class_id, name, join_code) values ('f0000000-0000-4000-8000-000000000001', 'G1', 'GRUPO234');
-- examen publicado pero que se abre mañana; y otro abierto con cierre ya pasado
insert into public.activities (id, class_id, title, mode, reveal_policy, hints_enabled, published, opens_at, closes_at)
values ('aa000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Examen futuro', 'exam', 'after_close', false, true, now() + interval '1 day', now() + interval '2 days');
insert into public.activity_items (activity_id, exercise_id) values ('aa000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003');
insert into public.activities (id, class_id, title, mode, reveal_policy, hints_enabled, published, opens_at, closes_at)
values ('aa000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'Examen abierto', 'exam', 'after_close', false, true, now() - interval '1 hour', now() + interval '1 hour');
insert into public.activity_items (activity_id, exercise_id) values ('aa000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Como ESTUDIANTE 1
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);

do $$ begin
  if exists (select 1 from public.lessons) then raise exception 'FALLO: un estudiante sin matrícula ve lecciones'; end if;
  if (public.join_class('prueba-23') ->> 'ok')::boolean is not true then raise exception 'FALLO: no se pudo matricular con el código'; end if;
  if not exists (select 1 from public.lessons) then raise exception 'FALLO: el estudiante matriculado no ve la lección'; end if;
  if exists (select 1 from public.exercise_keys) then raise exception 'FALLO: el estudiante ve claves'; end if;
  if exists (select 1 from public.class_groups) then raise exception 'FALLO: el estudiante ve los códigos de grupo'; end if;
  if exists (select 1 from public.profiles where id <> auth.uid() and role = 'student') then raise exception 'FALLO: el estudiante ve perfiles de otros estudiantes'; end if;
  if exists (select 1 from public.exercises where id = 'e0000000-0000-4000-8000-000000000003') then
    raise exception 'FALLO: el estudiante ve una pregunta de un examen que aún no abre';
  end if;
  if not exists (select 1 from public.exercises where id = 'e0000000-0000-4000-8000-000000000002') then
    raise exception 'FALLO: el estudiante no ve la pregunta del examen abierto';
  end if;
  if exists (select 1 from public.activity_items where activity_id = 'aa000000-0000-4000-8000-000000000001') then
    raise exception 'FALLO: el estudiante ve los ítems de un examen que aún no abre';
  end if;
end $$;

-- no puede cambiar su rol
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'FALLO: el estudiante pudo cambiar su rol';
  exception when insufficient_privilege then null;
  end;
end $$;

-- no puede escribir calificaciones directamente
do $$ begin
  begin
    insert into public.attempts (user_id, course_id, lesson_id, mode) values (auth.uid(), 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'practice');
    raise exception 'FALLO: el estudiante pudo crear un intento directamente';
  exception when insufficient_privilege then null;
  end;
end $$;

-- no puede usar las funciones de servicio
do $$ begin
  begin
    perform public.svc_check_context(auth.uid(), gen_random_uuid(), gen_random_uuid());
    raise exception 'FALLO: el estudiante pudo ejecutar svc_check_context';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.bootstrap_admin('est1.prueba@example.com');
    raise exception 'FALLO: el estudiante pudo ejecutar bootstrap_admin';
  exception when insufficient_privilege then null;
  end;
end $$;

-- práctica libre: crea intento, guarda borrador, pide pista; no ve la solución sin haberla pedido
do $$
declare v_att uuid; v jsonb;
begin
  v_att := public.start_lesson_practice('d0000000-0000-4000-8000-000000000001');
  perform public.save_response(v_att, 'e0000000-0000-4000-8000-000000000001', '{"text":"3 m/s"}');
  v := public.get_attempt(v_att);
  if v -> 'items' -> 0 -> 'solution' <> 'null'::jsonb then raise exception 'FALLO: get_attempt muestra la solución antes de tiempo'; end if;
  v := public.get_hint(v_att, 'e0000000-0000-4000-8000-000000000001');
  if v ->> 'hint' <> 'pista 1' then raise exception 'FALLO: no se obtuvo la pista'; end if;
  -- no puede guardar respuestas de una pregunta de banco en su práctica
  begin
    perform public.save_response(v_att, 'e0000000-0000-4000-8000-000000000002', '{"text":"5 m"}');
    raise exception 'FALLO: guardó una pregunta ajena a la práctica';
  exception when insufficient_privilege then null;
  end;
end $$;

-- examen: no puede empezar el que no ha abierto; en el abierto no ve la corrección antes del cierre
do $$
declare v_att uuid; v jsonb;
begin
  begin
    perform public.start_activity_attempt('aa000000-0000-4000-8000-000000000001');
    raise exception 'FALLO: empezó un examen que aún no abre';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
  v_att := public.start_activity_attempt('aa000000-0000-4000-8000-000000000002');
  if public.start_activity_attempt('aa000000-0000-4000-8000-000000000002') <> v_att then
    raise exception 'FALLO: un segundo inicio creó otro intento en lugar de continuar el abierto';
  end if;
  perform public.save_response(v_att, 'e0000000-0000-4000-8000-000000000002', '{"text":"5 m"}');
  v := public.get_attempt(v_att);
  if exists (select 1 from jsonb_array_elements(v -> 'items') it where it -> 'solution' <> 'null'::jsonb) then
    raise exception 'FALLO: el examen en curso muestra soluciones';
  end if;
  if (v -> 'attempt' ->> 'score') is not null then raise exception 'FALLO: el examen en curso muestra el puntaje'; end if;
  begin
    perform public.get_hint(v_att, 'e0000000-0000-4000-8000-000000000002');
    raise exception 'FALLO: obtuvo una pista en un examen';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
  begin
    perform public.reveal_solution(v_att, 'e0000000-0000-4000-8000-000000000002');
    raise exception 'FALLO: vio la solución en un examen';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
  if exists (select 1 from public.responses) then raise exception 'FALLO: el estudiante lee la tabla de respuestas directamente'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Como ESTUDIANTE 2 (no matriculado)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
do $$
declare v_att uuid;
begin
  select id into v_att from public.attempts limit 1;
  if v_att is not null then raise exception 'FALLO: otro estudiante ve intentos ajenos'; end if;
  -- tampoco con get_attempt
  reset role;
  select id into v_att from public.attempts where user_id = 'a0000000-0000-4000-8000-000000000002' limit 1;
  set local role authenticated;
  begin
    perform public.get_attempt(v_att);
    raise exception 'FALLO: otro estudiante abrió un intento ajeno con get_attempt';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.activities) then raise exception 'FALLO: un estudiante no matriculado ve actividades'; end if;
  if exists (select 1 from public.profiles where id = 'a0000000-0000-4000-8000-000000000002') then raise exception 'FALLO: ve el perfil de otro estudiante'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Como PROFESOR
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
do $$ begin
  if not exists (select 1 from public.exercise_keys) then raise exception 'FALLO: el profesor del curso no ve las claves'; end if;
  if not exists (select 1 from public.responses) then raise exception 'FALLO: el profesor no ve las respuestas de su clase'; end if;
  if not exists (select 1 from public.profiles where id = 'a0000000-0000-4000-8000-000000000002') then raise exception 'FALLO: el profesor no ve a su estudiante'; end if;
  if exists (select 1 from public.profiles where id = 'a0000000-0000-4000-8000-000000000003') then raise exception 'FALLO: el profesor ve a un estudiante que no es suyo'; end if;
  begin
    perform public.admin_set_role('a0000000-0000-4000-8000-000000000002', 'teacher');
    raise exception 'FALLO: un profesor no administrador cambió un rol';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
rollback;
-- Solo se llega aquí si ninguna comprobación falló (el editor de Supabase no muestra RAISE NOTICE).
select 'TODAS LAS PRUEBAS DE SEGURIDAD PASARON' as resultado;
