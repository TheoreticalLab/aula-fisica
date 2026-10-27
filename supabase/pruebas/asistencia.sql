-- Pruebas: asistencia con código (migración 24). Datos sintéticos; transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d8000000-0000-4000-8000-000000000001', 'aa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-asist","aula_role":"teacher"}', '{}', now(), now()),
  ('d8000000-0000-4000-8000-000000000002', 'ab@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-asist-b","aula_role":"teacher"}', '{}', now(), now()),
  ('d8000000-0000-4000-8000-000000000011', 'a1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-asist-1"}', '{}', now(), now()),
  ('d8000000-0000-4000-8000-000000000012', 'a2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-asist-2"}', '{}', now(), now()),
  ('d8000000-0000-4000-8000-000000000013', 'a3@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-asist-3"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'd8000000-%';
update public.profiles set role = 'teacher' where id in ('d8000000-0000-4000-8000-000000000001', 'd8000000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('d8000000-0000-4000-8000-000000000021', 'Curso asistencia');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('d8000000-0000-4000-8000-000000000031', 'd8000000-0000-4000-8000-000000000021', 'Sección asistencia', 'ASISTE01', 'd8000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('d8000000-0000-4000-8000-000000000031', 'd8000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('d8000000-0000-4000-8000-000000000031', 'd8000000-0000-4000-8000-000000000011'),
  ('d8000000-0000-4000-8000-000000000031', 'd8000000-0000-4000-8000-000000000012');
-- el estudiante 3 no está en la sección

do $$ begin
  -- el generador da siempre 6 cifras
  if exists (select 1 from generate_series(1, 200) where public.attendance_random_code() !~ '^[0-9]{6}$') then raise exception 'FALLO: código mal formado'; end if;
end $$;

set local role authenticated;

-- 1) el profesor abre la asistencia
select set_config('request.jwt.claims', '{"sub":"d8000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd8000000-0000-4000-8000-000000000001', true);
select set_config('prueba.asis', public.attendance_open('d8000000-0000-4000-8000-000000000031', 10)::text, true);

-- 2) un profesor ajeno no puede ver el código ni abrir asistencia en esa sección
select set_config('request.jwt.claims', '{"sub":"d8000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd8000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.attendance_live((current_setting('prueba.asis')::jsonb ->> 'id')::uuid); raise exception 'FALLO: un profesor ajeno vio el código';
  exception when insufficient_privilege then null; end;
  begin perform public.attendance_open('d8000000-0000-4000-8000-000000000031', 10); raise exception 'FALLO: un profesor ajeno abrió asistencia';
  exception when insufficient_privilege then null; end;
end $$;

-- 3) estudiante 1: código incorrecto no marca; el correcto sí (una sola vez); no puede leer el código ni las tablas
select set_config('request.jwt.claims', '{"sub":"d8000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd8000000-0000-4000-8000-000000000011', true);
do $$
declare v_code text := current_setting('prueba.asis')::jsonb ->> 'code'; r jsonb;
begin
  r := public.attendance_mark(case when v_code = '000000' then '000001' else '000000' end);
  if (r ->> 'ok')::boolean then raise exception 'FALLO: aceptó un código incorrecto'; end if;
  r := public.attendance_mark(substr(v_code, 1, 3) || ' ' || substr(v_code, 4));   -- con espacio, como lo dictaría el profesor
  if not (r ->> 'ok')::boolean or not (r ->> 'nuevo')::boolean or r -> 'clases' ->> 0 <> 'Sección asistencia' then raise exception 'FALLO: no marcó presente (%)', r; end if;
  r := public.attendance_mark(v_code);
  if (r ->> 'nuevo')::boolean then raise exception 'FALLO: marcó dos veces'; end if;
  begin perform 1 from public.attendance_sessions; raise exception 'FALLO: leyó los códigos'; exception when insufficient_privilege then null; end;
  begin perform public.attendance_live((current_setting('prueba.asis')::jsonb ->> 'id')::uuid); raise exception 'FALLO: un estudiante vio la lista';
  exception when insufficient_privilege then null; end;
  begin perform public.attendance_set((current_setting('prueba.asis')::jsonb ->> 'id')::uuid, 'd8000000-0000-4000-8000-000000000012', true);
    raise exception 'FALLO: un estudiante marcó a otro';
  exception when insufficient_privilege then null; end;
  if (select presentes from public.my_attendance()) <> 1 then raise exception 'FALLO: mi asistencia'; end if;
end $$;

-- 4) estudiante 3 (no inscrito): el código correcto no lo marca en una sección ajena
select set_config('request.jwt.claims', '{"sub":"d8000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd8000000-0000-4000-8000-000000000013', true);
do $$ begin
  if (public.attendance_mark(current_setting('prueba.asis')::jsonb ->> 'code') ->> 'ok')::boolean then raise exception 'FALLO: marcó en una sección ajena'; end if;
end $$;

-- 5) estudiante 2: tras 6 códigos incorrectos queda bloqueado aunque luego acierte (contra la adivinación)
select set_config('request.jwt.claims', '{"sub":"d8000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd8000000-0000-4000-8000-000000000012', true);
do $$
declare v_code text := current_setting('prueba.asis')::jsonb ->> 'code'; i int; v_malo text;
begin
  v_malo := case when v_code = '111111' then '222222' else '111111' end;
  for i in 1..6 loop perform public.attendance_mark(v_malo); end loop;
  begin perform public.attendance_mark(v_code); raise exception 'FALLO: no limitó los intentos';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;

-- 6) el profesor ve la lista en vivo, corrige a mano y cierra; con la asistencia cerrada nadie marca
select set_config('request.jwt.claims', '{"sub":"d8000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd8000000-0000-4000-8000-000000000001', true);
do $$
declare v_id uuid := (current_setting('prueba.asis')::jsonb ->> 'id')::uuid; l jsonb;
begin
  l := public.attendance_live(v_id);
  if not (l ->> 'abierta')::boolean or jsonb_array_length(l -> 'estudiantes') <> 2 then raise exception 'FALLO: vista en vivo'; end if;
  if (select count(*) from jsonb_array_elements(l -> 'estudiantes') e where (e ->> 'presente')::boolean) <> 1 then raise exception 'FALLO: presentes en vivo'; end if;
  perform public.attendance_set(v_id, 'd8000000-0000-4000-8000-000000000012', true);
  if (select count(*) from jsonb_array_elements(public.attendance_live(v_id) -> 'estudiantes') e where e ->> 'method' = 'profesor') <> 1 then raise exception 'FALLO: marca manual'; end if;
  if (select count(*) from public.attendance_open_sessions()) <> 1 then raise exception 'FALLO: asistencias abiertas'; end if;
  perform public.attendance_close(v_id);
  if (public.attendance_report('d8000000-0000-4000-8000-000000000031') -> 'estudiantes' -> 0 ->> 'presentes')::int <> 1 then raise exception 'FALLO: informe'; end if;
  if jsonb_array_length(public.student_extras('d8000000-0000-4000-8000-000000000011') -> 'asistencia') <> 1 then raise exception 'FALLO: asistencia en la ficha'; end if;
end $$;
reset role;
do $$ begin
  delete from public.attendance_failures where user_id = 'd8000000-0000-4000-8000-000000000012';
  delete from public.attendance_records where user_id = 'd8000000-0000-4000-8000-000000000012';
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d8000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd8000000-0000-4000-8000-000000000012', true);
do $$ begin
  if (public.attendance_mark(current_setting('prueba.asis')::jsonb ->> 'code') ->> 'ok')::boolean then raise exception 'FALLO: marcó con la asistencia cerrada'; end if;
end $$;
reset role;
select 'PRUEBAS DE ASISTENCIA PASARON' as resultado;
rollback;
