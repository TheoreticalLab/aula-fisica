-- Pruebas: analítica del tiempo de aprendizaje (migración 12). Transacción que se deshace al final.
-- Dentro de una transacción now() no avanza: el paso del tiempo se simula moviendo last_beat_at y el reloj
-- de acreditación hacia atrás.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('dc000000-0000-4000-8000-000000000001', 'pt1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-tiempo","aula_role":"teacher"}', '{}', now(), now()),
  ('dc000000-0000-4000-8000-000000000002', 'et1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-tiempo-1"}', '{}', now(), now()),
  ('dc000000-0000-4000-8000-000000000003', 'et2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-tiempo-2"}', '{}', now(), now()),
  ('dc000000-0000-4000-8000-000000000004', 'pt2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ajeno","aula_role":"teacher"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'dc000000-%';
insert into public.courses (id, title) values
  ('dc000000-0000-4000-8000-000000000011', 'Curso tiempo'),
  ('dc000000-0000-4000-8000-000000000012', 'Curso ajeno');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('dc000000-0000-4000-8000-000000000021', 'dc000000-0000-4000-8000-000000000011', 'Sección T1', 'TIEMPOA2', 'dc000000-0000-4000-8000-000000000001'),
  ('dc000000-0000-4000-8000-000000000022', 'dc000000-0000-4000-8000-000000000011', 'Sección T2', 'TIEMPOB2', null),
  ('dc000000-0000-4000-8000-000000000023', 'dc000000-0000-4000-8000-000000000012', 'Sección ajena', 'TIEMPOC2', null);
insert into public.enrollments (class_id, user_id) values
  ('dc000000-0000-4000-8000-000000000021', 'dc000000-0000-4000-8000-000000000002'),
  ('dc000000-0000-4000-8000-000000000022', 'dc000000-0000-4000-8000-000000000003');
insert into public.units (id, course_id, slug, title) values
  ('dc000000-0000-4000-8000-000000000031', 'dc000000-0000-4000-8000-000000000011', 'u-tiempo', 'Cinemática'),
  ('dc000000-0000-4000-8000-000000000032', 'dc000000-0000-4000-8000-000000000012', 'u-ajena', 'Ajena');
insert into public.lessons (id, unit_id, course_id, slug, title) values
  ('dc000000-0000-4000-8000-000000000041', 'dc000000-0000-4000-8000-000000000031', 'dc000000-0000-4000-8000-000000000011', 'l-velocidad', 'Velocidad'),
  ('dc000000-0000-4000-8000-000000000042', 'dc000000-0000-4000-8000-000000000032', 'dc000000-0000-4000-8000-000000000012', 'l-ajena', 'Ajena');

-- ===== estudiante 1 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dc000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000002', true);
do $$
declare r jsonb;
begin
  -- primer latido de una visita: la jerarquía la deduce el servidor
  r := public.study_beat('dc000000-0000-4000-8000-0000000000a1', 'dc000000-0000-4000-8000-0000000000f1', 'leccion',
        'dc000000-0000-4000-8000-000000000041', 'teoria', 1, 20, 20, 0, 0, 0, 3, 0, false);
  if (r ->> 'effective_seconds')::int <> 20 then raise exception 'FALLO: primer latido no acreditó 20 s (%).', r; end if;
  -- repetir el mismo latido (misma secuencia) no cambia nada
  r := public.study_beat('dc000000-0000-4000-8000-0000000000a1', 'dc000000-0000-4000-8000-0000000000f1', 'leccion',
        'dc000000-0000-4000-8000-000000000041', 'teoria', 1, 20, 20, 0, 0, 0, 3, 0, false);
  if not coalesce((r ->> 'duplicate')::boolean, false) or (r ->> 'effective_seconds')::int <> 20 then raise exception 'FALLO: el latido repetido duplicó (%).', r; end if;
  -- solicitud manipulada: pide 5000 s sin que haya pasado tiempo real → se recorta
  r := public.study_beat('dc000000-0000-4000-8000-0000000000a1', 'dc000000-0000-4000-8000-0000000000f1', 'leccion',
        'dc000000-0000-4000-8000-000000000041', 'teoria', 2, 5000, 5000, 0, 0, 0, 3, 0, false);
  if (r ->> 'effective_seconds')::int > 22 then raise exception 'FALLO: aceptó tiempo manipulado (%).', r; end if;
  -- no puede leer ni escribir los registros
  begin
    perform 1 from public.study_visits;
    raise exception 'FALLO: el estudiante leyó study_visits';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.study_visits set effective_seconds = 99999;
    raise exception 'FALLO: el estudiante modificó su tiempo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.study_clock;
    raise exception 'FALLO: el estudiante leyó study_clock';
  exception when insufficient_privilege then null;
  end;
  -- ni consulta la analítica
  begin
    perform * from public.analytics_students('dc000000-0000-4000-8000-000000000011', null, null, null, null, null, null, null, null);
    raise exception 'FALLO: el estudiante consultó la analítica';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.analytics_visits('dc000000-0000-4000-8000-000000000011', null, null, null, null, null, null, null, null, null);
    raise exception 'FALLO: el estudiante ejecutó analytics_visits';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.analytics_log('exportar_csv', '{}');
    raise exception 'FALLO: el estudiante escribió en la auditoría';
  exception when insufficient_privilege then null;
  end;
  -- ni mide una lección de una asignatura en la que no está
  begin
    perform public.study_beat('dc000000-0000-4000-8000-0000000000a9', 'dc000000-0000-4000-8000-0000000000f1', 'leccion',
        'dc000000-0000-4000-8000-000000000042', 'teoria', 1, 20, 20, 0, 0, 0, 0, 0, false);
    raise exception 'FALLO: midió una lección ajena';
  exception when insufficient_privilege then null;
  end;
end $$;

-- pasan 15 s reales: el siguiente latido acredita 15 s
reset role;
update public.study_visits set last_beat_at = last_beat_at - interval '15 seconds' where id = 'dc000000-0000-4000-8000-0000000000a1';
update public.study_clock set credited_until = now() - interval '15 seconds' where user_id = 'dc000000-0000-4000-8000-000000000002';
do $$ begin
  if (select class_id from public.study_visits where id = 'dc000000-0000-4000-8000-0000000000a1') <> 'dc000000-0000-4000-8000-000000000021'
     or (select unit_id from public.study_visits where id = 'dc000000-0000-4000-8000-0000000000a1') <> 'dc000000-0000-4000-8000-000000000031' then
    raise exception 'FALLO: no dedujo sección y unidad';
  end if;
end $$;
set local role authenticated;
do $$
declare r jsonb; antes int;
begin
  r := public.study_beat('dc000000-0000-4000-8000-0000000000a1', 'dc000000-0000-4000-8000-0000000000f1', 'leccion',
        'dc000000-0000-4000-8000-000000000041', 'teoria', 3, 5015, 5015, 0, 0, 0, 5, 0, false);
  antes := (r ->> 'effective_seconds')::int;
  if antes < 35 or antes > 39 then raise exception 'FALLO: 15 s reales no acreditaron ~15 s (%).', r; end if;
  -- otra pestaña al mismo tiempo (subsección «ejemplos»): no puede sumar tiempo ya transcurrido y acreditado
  r := public.study_beat('dc000000-0000-4000-8000-0000000000a2', 'dc000000-0000-4000-8000-0000000000f2', 'leccion',
        'dc000000-0000-4000-8000-000000000041', 'ejemplos', 1, 15, 15, 0, 0, 0, 1, 0, false);
  if (r ->> 'effective_seconds')::int > 2 then raise exception 'FALLO: dos pestañas duplicaron el tiempo (%).', r; end if;
end $$;

-- una lección nueva empieza a medirse sin configurar nada
reset role;
insert into public.lessons (id, unit_id, course_id, slug, title) values
  ('dc000000-0000-4000-8000-000000000043', 'dc000000-0000-4000-8000-000000000031', 'dc000000-0000-4000-8000-000000000011', 'l-aceleracion', 'Aceleración');
update public.study_clock set credited_until = now() - interval '1 hour' where user_id = 'dc000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
  perform public.study_beat('dc000000-0000-4000-8000-0000000000a3', 'dc000000-0000-4000-8000-0000000000f1', 'leccion',
        'dc000000-0000-4000-8000-000000000043', 'practica', 1, 40, 40, 0, 0, 0, 2, 1, false);
end $$;
reset role;
do $$ begin
  if (select effective_seconds from public.study_visits where id = 'dc000000-0000-4000-8000-0000000000a3') <> 40
     or (select unit_id from public.study_visits where id = 'dc000000-0000-4000-8000-0000000000a3') <> 'dc000000-0000-4000-8000-000000000031' then
    raise exception 'FALLO: la lección nueva no se midió';
  end if;
end $$;

-- ===== estudiante 2 no puede usar la visita del estudiante 1 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dc000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000003', true);
do $$ begin
  begin
    perform public.study_beat('dc000000-0000-4000-8000-0000000000a1', 'dc000000-0000-4000-8000-0000000000f9', 'leccion',
        'dc000000-0000-4000-8000-000000000041', 'teoria', 9, 99, 99, 0, 0, 0, 0, 0, false);
    raise exception 'FALLO: escribió en la visita de otro estudiante';
  exception when insufficient_privilege then null;
  end;
  perform public.study_beat('dc000000-0000-4000-8000-0000000000b1', 'dc000000-0000-4000-8000-0000000000f9', 'leccion',
        'dc000000-0000-4000-8000-000000000041', 'teoria', 1, 30, 30, 0, 0, 0, 2, 0, false);
end $$;

-- ===== profesor de la sección T1 =====
select set_config('request.jwt.claims', '{"sub":"dc000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000001', true);
do $$
declare n int; e1 bigint; tot_unidad bigint; tot_secciones bigint; r jsonb;
begin
  -- el profesor no se mide (vista previa)
  r := public.study_beat('dc000000-0000-4000-8000-0000000000c1', 'dc000000-0000-4000-8000-0000000000f8', 'general', null, 'inicio', 1, 30, 30, 0, 0, 0, 0, 0, false);
  if coalesce((r ->> 'tracked')::boolean, true) then raise exception 'FALLO: midió al profesor'; end if;
  -- ve a su estudiante (T1) y no al de la otra sección (T2)
  select count(*) into n from public.analytics_students('dc000000-0000-4000-8000-000000000011', null, null, null, null, null, null, null, null);
  if n <> 1 then raise exception 'FALLO: el profesor ve % estudiantes (esperado 1)', n; end if;
  select effective_seconds into e1 from public.analytics_students('dc000000-0000-4000-8000-000000000011', null, null, null, null, null, null, null, null)
    where user_id = 'dc000000-0000-4000-8000-000000000002';
  if e1 < 75 then raise exception 'FALLO: tiempo acumulado del estudiante = %', e1; end if;
  -- el total del capítulo coincide con la suma de sus subsecciones (sin duplicar)
  select sum(effective_seconds) into tot_unidad from public.analytics_tree('dc000000-0000-4000-8000-000000000011', null, null,
    'dc000000-0000-4000-8000-000000000002', 'unidad', null, null, null, null, null) where unit_id = 'dc000000-0000-4000-8000-000000000031';
  select sum(effective_seconds) into tot_secciones from public.analytics_tree('dc000000-0000-4000-8000-000000000011', null, null,
    'dc000000-0000-4000-8000-000000000002', 'seccion', 'dc000000-0000-4000-8000-000000000031', null, null, null, null);
  if tot_unidad is distinct from tot_secciones or tot_unidad <> e1 then
    raise exception 'FALLO: capítulo % ≠ subsecciones % (estudiante %)', tot_unidad, tot_secciones, e1;
  end if;
  -- no puede pedir la sección T2, ni otra asignatura
  begin
    perform * from public.analytics_students('dc000000-0000-4000-8000-000000000011', 'dc000000-0000-4000-8000-000000000022', null, null, null, null, null, null, null);
    raise exception 'FALLO: consultó una sección que no enseña';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.analytics_tree('dc000000-0000-4000-8000-000000000012', null, null, null, 'unidad', null, null, null, null, null);
    raise exception 'FALLO: consultó otra asignatura';
  exception when insufficient_privilege then null;
  end;
  -- auditoría de exportaciones
  perform public.analytics_log('exportar_csv', '{"filas": 1}');
  -- cambiar la configuración es solo del administrador
  begin
    perform public.set_study_settings(60, 20, 15, 15, 30, 180);
    raise exception 'FALLO: el profesor cambió la configuración';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== profesor sin relación con la asignatura =====
select set_config('request.jwt.claims', '{"sub":"dc000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000004', true);
do $$ begin
  begin
    perform * from public.analytics_students('dc000000-0000-4000-8000-000000000011', null, null, null, null, null, null, null, null);
    raise exception 'FALLO: un profesor ajeno consultó la analítica';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  if (select count(*) from public.analytics_audit where actor_id = 'dc000000-0000-4000-8000-000000000001' and action = 'exportar_csv') <> 1 then
    raise exception 'FALLO: no quedó la auditoría de la exportación';
  end if;
end $$;

select 'PRUEBAS DE TIEMPO DE APRENDIZAJE PASARON' as resultado;
rollback;
