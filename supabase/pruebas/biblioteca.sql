-- Pruebas: estados de unidad y personalizaciones (migración 11). Transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('db000000-0000-4000-8000-000000000001', 'pb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-bib","aula_role":"teacher"}', '{}', now(), now()),
  ('db000000-0000-4000-8000-000000000002', 'eb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-bib-1"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'db000000-%';
insert into public.courses (id, title) values ('db000000-0000-4000-8000-000000000011', 'Curso biblioteca');
insert into public.course_staff (course_id, user_id) values ('db000000-0000-4000-8000-000000000011', 'db000000-0000-4000-8000-000000000001');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('db000000-0000-4000-8000-000000000021', 'db000000-0000-4000-8000-000000000011', 'Sección B1', 'BIBLIOT2', 'db000000-0000-4000-8000-000000000001');
insert into public.enrollments (class_id, user_id) values ('db000000-0000-4000-8000-000000000021', 'db000000-0000-4000-8000-000000000002');
insert into public.units (id, course_id, slug, position, title, status) values
  ('db000000-0000-4000-8000-000000000031', 'db000000-0000-4000-8000-000000000011', 'u-pub', 1, 'Publicada', 'publicado'),
  ('db000000-0000-4000-8000-000000000032', 'db000000-0000-4000-8000-000000000011', 'u-prep', 2, 'Preparada', 'preparado');
-- instalación desde la biblioteca: no queda marcada como personalizada
select set_config('aula.origen', 'biblioteca', true);
insert into public.lessons (id, unit_id, course_id, slug, position, title, theory) values
  ('db000000-0000-4000-8000-000000000041', 'db000000-0000-4000-8000-000000000031', 'db000000-0000-4000-8000-000000000011', 'l-pub', 1, 'Lección publicada', 'Texto'),
  ('db000000-0000-4000-8000-000000000042', 'db000000-0000-4000-8000-000000000032', 'db000000-0000-4000-8000-000000000011', 'l-prep', 1, 'Lección preparada', 'Texto');
update public.lessons set theory = 'Texto revisado por la biblioteca' where id = 'db000000-0000-4000-8000-000000000041';
select set_config('aula.origen', '', true);

do $$ begin
  if (select customized from public.lessons where id = 'db000000-0000-4000-8000-000000000041') then
    raise exception 'FALLO: una actualización de la biblioteca marcó la lección como personalizada';
  end if;
  if (select status from public.units where slug = 'u-prep' and course_id = 'db000000-0000-4000-8000-000000000011') <> 'preparado' then
    raise exception 'FALLO: estado inicial incorrecto';
  end if;
  begin
    update public.units set status = 'publicada-mal' where id = 'db000000-0000-4000-8000-000000000031';
    raise exception 'FALLO: se aceptó un estado inválido';
  exception when check_violation then null;
  end;
end $$;

-- el estudiante solo ve la unidad publicada y su lección
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000002', true);
do $$ begin
  if (select count(*) from public.units where course_id = 'db000000-0000-4000-8000-000000000011') <> 1 then raise exception 'FALLO: el estudiante ve unidades no publicadas'; end if;
  if (select count(*) from public.lessons where course_id = 'db000000-0000-4000-8000-000000000011') <> 1 then raise exception 'FALLO: el estudiante ve lecciones de unidades no publicadas'; end if;
  if public.lesson_visible_to_me('db000000-0000-4000-8000-000000000042') then raise exception 'FALLO: lesson_visible_to_me deja ver una unidad preparada'; end if;
end $$;

-- el profesor publica la unidad (cambiar el estado no es una personalización) y edita una lección (sí lo es)
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000001', true);
update public.units set status = 'publicado' where id = 'db000000-0000-4000-8000-000000000032';
update public.lessons set theory = 'Mi versión' where id = 'db000000-0000-4000-8000-000000000042';
do $$ begin
  if (select customized from public.units where id = 'db000000-0000-4000-8000-000000000032') then raise exception 'FALLO: publicar marcó la unidad como personalizada'; end if;
  if not (select customized from public.lessons where id = 'db000000-0000-4000-8000-000000000042') then raise exception 'FALLO: la edición del profesor no quedó marcada'; end if;
end $$;

-- ahora el estudiante ve las dos
select set_config('request.jwt.claims', '{"sub":"db000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'db000000-0000-4000-8000-000000000002', true);
do $$ begin
  if (select count(*) from public.lessons where course_id = 'db000000-0000-4000-8000-000000000011') <> 2 then raise exception 'FALLO: tras publicar, el estudiante no ve la lección'; end if;
end $$;

reset role;
rollback;
select 'PRUEBAS DE BIBLIOTECA Y ESTADOS PASARON' as resultado;
