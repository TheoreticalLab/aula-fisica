-- Pruebas: LIEIA laboratorio científico, persistencia (migración 48). Datos sintéticos; se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('eb000000-0000-4000-8000-000000000001', 'ia@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-lab","aula_role":"teacher"}', '{}', now(), now()),
  ('eb000000-0000-4000-8000-000000000002', 'ib@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ajeno-lab","aula_role":"teacher"}', '{}', now(), now()),
  ('eb000000-0000-4000-8000-000000000011', 'i1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-lab-1"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'eb000000-%';
update public.profiles set role = 'teacher' where id in ('eb000000-0000-4000-8000-000000000001', 'eb000000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('eb000000-0000-4000-8000-000000000021', 'Curso laboratorio');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('eb000000-0000-4000-8000-000000000031', 'eb000000-0000-4000-8000-000000000021', 'Sección laboratorio', 'LABOR001', 'eb000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('eb000000-0000-4000-8000-000000000031', 'eb000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('eb000000-0000-4000-8000-000000000031', 'eb000000-0000-4000-8000-000000000011');
insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values
  ('eb000000-0000-4000-8000-000000000041', 'eb000000-0000-4000-8000-000000000031', 'Examen base', 'exam', true, 'after_submit', false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eb000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'eb000000-0000-4000-8000-000000000001', true);
do $$
declare v_id uuid; v_id2 uuid; l jsonb; v_c uuid := 'eb000000-0000-4000-8000-000000000031'; v_a uuid := 'eb000000-0000-4000-8000-000000000041';
begin
  -- 28) guardar una investigación con su procedencia; volver a guardarla actualiza (no duplica) y amplía el historial
  v_id := public.lieia_lab_guardar(v_c, v_a, 'investigacion', 'dep:q1:q2', 'abc123', 'guardada',
    '{"titulo":"¿Dominar P1 se asocia con acertar P2?","resultado":null}', '{"metodo":"proporciones condicionadas","n":0,"motor":"ciencia@1"}');
  v_id2 := public.lieia_lab_guardar(v_c, v_a, 'investigacion', 'dep:q1:q2', 'abc124', 'aceptada', '{"titulo":"x"}', '{"n":40}');
  if v_id <> v_id2 then raise exception 'FALLO: duplicó la investigación'; end if;
  l := public.lieia_lab_listar(v_c, v_a);
  if jsonb_array_length(l) <> 1 or l->0->>'estado' <> 'aceptada' or jsonb_array_length(l->0->'historial') <> 2 or l->0->'procedencia'->>'n' <> '40' then raise exception 'FALLO: listar %', l; end if;
  -- 27) revisión del profesor y diseño borrador (sin actividad asociada aún)
  perform public.lieia_lab_guardar(v_c, v_a, 'revision', 'q1', 'abc124', 'guardada', '{"cognitivas":["razonamiento_fisico"]}', '{}');
  perform public.lieia_lab_guardar(v_c, null, 'diseno', 'C:42', null, 'propuesta', '{"modo":"C","semilla":42,"items":["q1","q3"]}', '{"semilla":42}');
  if jsonb_array_length(public.lieia_lab_listar(v_c, null)) <> 3 then raise exception 'FALLO: listar todo'; end if;
  perform public.lieia_lab_estado(v_id, 'descartada');
  -- validaciones
  begin perform public.lieia_lab_guardar(v_c, v_a, 'otra', 'x', null, null, '{}', '{}'); raise exception 'FALLO: tipo inválido';
  exception when invalid_parameter_value then null; end;
  begin perform public.lieia_lab_guardar(v_c, v_a, 'informe', 'x', null, null, '[1]', '{}'); raise exception 'FALLO: contenido no objeto';
  exception when invalid_parameter_value or check_violation then null; end;
end $$;

-- 16, 17, 25) otro profesor y un estudiante no ven ni guardan nada; el estudiante no lee la tabla
select set_config('request.jwt.claims', '{"sub":"eb000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'eb000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.lieia_lab_listar('eb000000-0000-4000-8000-000000000031', null); raise exception 'FALLO: profesor ajeno listó';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"eb000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'eb000000-0000-4000-8000-000000000011', true);
do $$ begin
  begin perform public.lieia_lab_listar('eb000000-0000-4000-8000-000000000031', null); raise exception 'FALLO: estudiante listó';
  exception when insufficient_privilege then null; end;
  begin perform public.lieia_lab_guardar('eb000000-0000-4000-8000-000000000031', null, 'informe', 'x', null, null, '{}', '{}'); raise exception 'FALLO: estudiante guardó';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.lieia_research; raise exception 'FALLO: estudiante leyó la tabla'; exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  -- 18) no toca calificaciones ni la actividad base
  if exists (select 1 from public.grade_entries where class_id = 'eb000000-0000-4000-8000-000000000031') then raise exception 'FALLO: notas'; end if;
  if not (select published from public.activities where id = 'eb000000-0000-4000-8000-000000000041') then raise exception 'FALLO: cambió la actividad'; end if;
end $$;

select 'PRUEBAS DEL LABORATORIO CIENTÍFICO LIEIA PASARON' as resultado;
rollback;
