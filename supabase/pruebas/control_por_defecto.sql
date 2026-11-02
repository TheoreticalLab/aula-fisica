-- Pruebas: Práctica de Control activada por defecto en toda práctica (migración 65). Se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de650000-0000-4000-8000-000000000001', 'cd1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-defecto","aula_role":"teacher"}', '{}', now(), now()),
  ('de650000-0000-4000-8000-000000000011', 'cd11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-defecto-1"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de650000-%';
update public.profiles set role = 'teacher' where id = 'de650000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('de650000-0000-4000-8000-000000000021', 'Curso defecto');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de650000-0000-4000-8000-000000000031', 'de650000-0000-4000-8000-000000000021', 'Sección defecto', 'DEFECT01', 'de650000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de650000-0000-4000-8000-000000000031', 'de650000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('de650000-0000-4000-8000-000000000031', 'de650000-0000-4000-8000-000000000011');

-- 1) una práctica nueva nace con el control activado (w = 20 %, 7 min, alcance «nuevas»); una evaluación no
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled, max_tries_per_item, created_by) values
  ('de650000-0000-4000-8000-0000000000a1', 'de650000-0000-4000-8000-000000000031', 'Práctica nueva', 'practice', true, 'immediate', true, 3, 'de650000-0000-4000-8000-000000000001'),
  ('de650000-0000-4000-8000-0000000000a2', 'de650000-0000-4000-8000-000000000031', 'Examen', 'exam', true, 'after_submit', false, 1, 'de650000-0000-4000-8000-000000000001'),
  ('de650000-0000-4000-8000-0000000000a3', 'de650000-0000-4000-8000-000000000031', 'Otra práctica', 'practice', true, 'immediate', true, 3, 'de650000-0000-4000-8000-000000000001');
do $$ begin
  if not exists (select 1 from public.control_policies where activity_id = 'de650000-0000-4000-8000-0000000000a1' and version = 1 and w = 0.20 and duracion_min = 7 and alcance = 'nuevas' and activa) then
    raise exception 'FALLO: la práctica nueva no tiene el control por defecto'; end if;
  if exists (select 1 from public.control_policies where activity_id = 'de650000-0000-4000-8000-0000000000a2') then raise exception 'FALLO: una evaluación recibió política'; end if;
  -- convertir la evaluación en práctica también la activa (una sola vez)
  update public.activities set mode = 'practice', reveal_policy = 'immediate', hints_enabled = true where id = 'de650000-0000-4000-8000-0000000000a2';
  update public.activities set title = 'Examen (renombrado)' where id = 'de650000-0000-4000-8000-0000000000a2';
  if (select count(*) from public.control_policies where activity_id = 'de650000-0000-4000-8000-0000000000a2') <> 1 then raise exception 'FALLO: cambio de modo'; end if;
end $$;

-- 2) el estudiante ve el aviso; el profesor la ve en Orbe Control; al desactivarla deja de ofrecerse y de avisarse
set local role authenticated;
select set_config('request.path', '/rpc/control_aviso', true);
select set_config('request.jwt.claims', '{"sub":"de650000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de650000-0000-4000-8000-000000000011', true);
do $$ begin
  if public.control_aviso('de650000-0000-4000-8000-0000000000a1') ->> 'w' <> '0.20' then raise exception 'FALLO: aviso por defecto'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"de650000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de650000-0000-4000-8000-000000000001', true);
do $$ declare l jsonb; begin
  l := public.control_practicas('de650000-0000-4000-8000-000000000031');
  if (select count(*) from jsonb_array_elements(l)) <> 3 then raise exception 'FALLO: prácticas ofrecidas %', l; end if;
  perform public.control_politica_retirar('de650000-0000-4000-8000-0000000000a3');
  l := public.control_practicas('de650000-0000-4000-8000-000000000031');
  if exists (select 1 from jsonb_array_elements(l) x where x ->> 'id' = 'de650000-0000-4000-8000-0000000000a3') then raise exception 'FALLO: se ofrece una práctica desactivada'; end if;
  if public.control_aviso('de650000-0000-4000-8000-0000000000a3') is not null then raise exception 'FALLO: aviso de una práctica desactivada'; end if;
  -- reactivarla
  perform public.control_politica_anunciar('de650000-0000-4000-8000-0000000000a3', 0.2, 7, '', '', 'todas', 24, false);
  l := public.control_practicas('de650000-0000-4000-8000-000000000031');
  if not exists (select 1 from jsonb_array_elements(l) x where x ->> 'id' = 'de650000-0000-4000-8000-0000000000a3') then raise exception 'FALLO: reactivar'; end if;
end $$;
reset role;

select 'control_por_defecto.sql: PRUEBAS PASARON' as resultado;
rollback;
