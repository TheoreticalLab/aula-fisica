-- Pruebas: puntos perdidos y alerta urgente con confirmación obligatoria (migración 70). Se deshace al final.
-- Regla: en cada apartado, perdido = lo que vale − lo que sacó; un apartado sin nota no cuenta; se restan los extras aprobados.
-- A: parcial 1 = 0 (pierde 15), Práctica 6 de 30 (20 %, pierde 24), Segundo parcial sin nota (no cuenta), 4 extras → 35.
-- B: parcial 1 = 14 (pierde 1) y Práctica 30 de 30 → 1.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de700000-0000-4000-8000-000000000001', 'pp1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-perdidos","aula_role":"teacher"}', '{}', now(), now()),
  ('de700000-0000-4000-8000-000000000011', 'pp11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pp-a"}', '{}', now(), now()),
  ('de700000-0000-4000-8000-000000000012', 'pp12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-pp-b"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de700000-%';
update public.profiles set role = 'teacher', full_name = 'Francisco Prueba' where id = 'de700000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'Ana María Pérez' where id = 'de700000-0000-4000-8000-000000000011';
update public.profiles set full_name = 'Beto Ruiz' where id = 'de700000-0000-4000-8000-000000000012';
insert into public.courses (id, title) values ('de700000-0000-4000-8000-000000000021', 'Curso 70');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de700000-0000-4000-8000-000000000031', 'de700000-0000-4000-8000-000000000021', 'Sección 70', 'PERDI070', 'de700000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de700000-0000-4000-8000-000000000031', 'de700000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('de700000-0000-4000-8000-000000000031', 'de700000-0000-4000-8000-000000000011'), ('de700000-0000-4000-8000-000000000031', 'de700000-0000-4000-8000-000000000012');
insert into public.activities (id, class_id, title, mode, published, closes_at) values
  ('de700000-0000-4000-8000-0000000000a1', 'de700000-0000-4000-8000-000000000031', 'Cerrada', 'practice', true, now() - interval '1 day'),
  ('de700000-0000-4000-8000-0000000000a2', 'de700000-0000-4000-8000-000000000031', 'Abierta', 'practice', true, now() + interval '3 days');
insert into public.activity_grade_links (activity_id, class_id, category, points) values
  ('de700000-0000-4000-8000-0000000000a1', 'de700000-0000-4000-8000-000000000031', 'practica', 30),
  ('de700000-0000-4000-8000-0000000000a2', 'de700000-0000-4000-8000-000000000031', 'parcial2', 15);
insert into public.attempts (id, user_id, course_id, activity_id, mode, status, score, max_score) values
  ('de700000-0000-4000-8000-0000000000f1', 'de700000-0000-4000-8000-000000000011', 'de700000-0000-4000-8000-000000000021', 'de700000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 2, 10),
  ('de700000-0000-4000-8000-0000000000f2', 'de700000-0000-4000-8000-000000000012', 'de700000-0000-4000-8000-000000000021', 'de700000-0000-4000-8000-0000000000a1', 'practice', 'submitted', 10, 10);
insert into public.grade_entries (class_id, user_id, category, score) values
  ('de700000-0000-4000-8000-000000000031', 'de700000-0000-4000-8000-000000000011', 'parcial1', 0),
  ('de700000-0000-4000-8000-000000000031', 'de700000-0000-4000-8000-000000000012', 'parcial1', 14);
insert into public.grade_settings (class_id, published) values ('de700000-0000-4000-8000-000000000031', true);
insert into public.extra_points (request_id, class_id, user_id, assigner_role, points, reason, status) values
  (gen_random_uuid(), 'de700000-0000-4000-8000-000000000031', 'de700000-0000-4000-8000-000000000011', 'profesor', 4, 'Participación', 'aprobado'),
  (gen_random_uuid(), 'de700000-0000-4000-8000-000000000031', 'de700000-0000-4000-8000-000000000011', 'profesor', 3, 'Pendiente de aprobar', 'pendiente');

do $$ declare t record; begin
  select * into t from public.official_lost_total('de700000-0000-4000-8000-000000000031') where user_id = 'de700000-0000-4000-8000-000000000011';
  if t.perdidos <> 35 or t.por_apartados <> 39 or t.extras <> 4 or (t.detalle ->> 'practica')::numeric <> 24 or (t.detalle ->> 'parcial1')::numeric <> 15 then
    raise exception 'FALLO: puntos perdidos de A %', t; end if;
  if (select perdidos from public.official_lost_total('de700000-0000-4000-8000-000000000031') where user_id = 'de700000-0000-4000-8000-000000000012') <> 1 then
    raise exception 'FALLO: puntos perdidos de B'; end if;
  -- un apartado sin nota (Segundo parcial: su actividad está abierta y sin entrega) no cuenta
  if (select perdidos from public.official_lost('de700000-0000-4000-8000-000000000031') where user_id = 'de700000-0000-4000-8000-000000000011' and category = 'parcial2') <> 0 then
    raise exception 'FALLO: un apartado sin nota cuenta como perdido'; end if;
  -- el mismo apartado, con nota: lo que vale − lo que sacó
  insert into public.grade_entries (class_id, user_id, category, score) values ('de700000-0000-4000-8000-000000000031', 'de700000-0000-4000-8000-000000000012', 'final', 20);
  if (select perdidos from public.official_lost('de700000-0000-4000-8000-000000000031') where user_id = 'de700000-0000-4000-8000-000000000012' and category = 'final') <> 5 then
    raise exception 'FALLO: final'; end if;
  delete from public.grade_entries where user_id = 'de700000-0000-4000-8000-000000000012' and category = 'final';
end $$;

set local role authenticated;
select set_config('request.path', '/rpc/prueba', true);

-- desactivada (por defecto): no hay avisos
select set_config('request.jwt.claims', '{"sub":"de700000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de700000-0000-4000-8000-000000000011', true);
do $$ begin
  if (public.mi_alerta_puntos() ->> 'enviadas')::int <> 0 then raise exception 'FALLO: aviso con la alerta desactivada'; end if;
  begin perform public.set_lost_alert_config('de700000-0000-4000-8000-000000000031', true, 21, 3, 24, 20); raise exception 'FALLO: el estudiante configura';
  exception when insufficient_privilege then null; end;
  begin perform public.gradebook_lost('de700000-0000-4000-8000-000000000031'); raise exception 'FALLO: el estudiante ve el registro';
  exception when insufficient_privilege then null; end;
  if (public.mis_puntos_perdidos() -> 0 ->> 'perdidos')::numeric <> 35 then raise exception 'FALLO: mis puntos perdidos'; end if;
end $$;

-- el profesor la activa (3 avisos para la prueba)
select set_config('request.jwt.claims', '{"sub":"de700000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de700000-0000-4000-8000-000000000001', true);
do $$ begin
  begin perform public.set_lost_alert_config('de700000-0000-4000-8000-000000000031', true, 21, 0, 24, 20); raise exception 'FALLO: 0 avisos';
  exception when invalid_parameter_value then null; end;
  if not (public.set_lost_alert_config('de700000-0000-4000-8000-000000000031', true, 21, 3, 24, 20, '  ') ->> 'activo')::boolean then raise exception 'FALLO: activar'; end if;
end $$;

-- A: primer aviso; B (1 punto) ninguno
select set_config('request.jwt.claims', '{"sub":"de700000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de700000-0000-4000-8000-000000000012', true);
do $$ begin if (public.mi_alerta_puntos() ->> 'enviadas')::int <> 0 then raise exception 'FALLO: aviso por debajo del umbral'; end if; end $$;
select set_config('request.jwt.claims', '{"sub":"de700000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de700000-0000-4000-8000-000000000011', true);
do $$ declare m record; begin
  if (public.mi_alerta_puntos() ->> 'enviadas')::int <> 1 then raise exception 'FALLO: primer aviso'; end if;
  select * into m from public.my_pending_messages_v3();
  if m.kind <> 'urgente' or m.body not like '%Ana, has perdido 35 puntos de los 100%' or m.body not like '%nota máxima posible ahora es 65%'
     or m.body not like '%Primer parcial 15 · Práctica 24 (ya descontados 4 puntos extras)%' or m.body not like '%mayor esfuerzo%' or m.body not like '%' || E'\n\n' || 'Prof. Francisco Prueba' or m.sender_name <> 'Francisco Prueba'
     or (m.confirmacion ->> 'espera')::int <> 20 or m.confirmacion ->> 'caja' not like 'He leído que he perdido 35 puntos%' then
    raise exception 'FALLO: contenido del aviso % / %', m.body, m.confirmacion; end if;
  perform set_config('prueba.m1', m.id::text, true);
  -- sin confirmar: no se acumula otro
  if (public.mi_alerta_puntos() ->> 'enviadas')::int <> 0 then raise exception 'FALLO: segundo aviso sin confirmar el primero'; end if;
  -- no se puede descartar; confirmar antes de la espera tampoco (y la espera empieza al recibirlo)
  begin perform public.ack_live_message(m.id, 'descartado'); raise exception 'FALLO: descartado';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  begin perform public.ack_live_message(m.id, 'leido'); raise exception 'FALLO: confirmado sin espera';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
reset role;
update public.live_message_recipients set delivered_at = now() - interval '30 seconds' where message_id = current_setting('prueba.m1')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de700000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de700000-0000-4000-8000-000000000011', true);
do $$ begin
  perform public.ack_live_message(current_setting('prueba.m1')::uuid, 'leido');
  -- confirmado hace un momento: hasta dentro de 24 h, nada
  if (public.mi_alerta_puntos() ->> 'enviadas')::int <> 0 then raise exception 'FALLO: aviso antes de 24 h'; end if;
end $$;
reset role;

-- 25 h después de confirmarlo: segundo aviso; y así hasta el tercero (máximo de la prueba)
do $$ declare i integer; begin
  for i in 2..4 loop
    update public.live_message_recipients set read_at = now() - interval '25 hours', delivered_at = now() - interval '26 hours'
      where user_id = 'de700000-0000-4000-8000-000000000011' and read_at is null or (user_id = 'de700000-0000-4000-8000-000000000011' and read_at > now() - interval '1 hour');
    perform set_config('request.jwt.claims', '{"sub":"de700000-0000-4000-8000-000000000011","role":"authenticated"}', true);
    perform set_config('request.jwt.claim.sub', 'de700000-0000-4000-8000-000000000011', true);
    if (public.mi_alerta_puntos() ->> 'enviadas')::int <> (case when i <= 3 then 1 else 0 end) then raise exception 'FALLO: aviso número %', i; end if;
  end loop;
  if (select count(*) from public.lost_alerts where user_id = 'de700000-0000-4000-8000-000000000011') <> 3 then raise exception 'FALLO: total de avisos'; end if;
end $$;

-- registro no publicado: no se avisa (aunque toque)
delete from public.lost_alerts where user_id = 'de700000-0000-4000-8000-000000000011' and numero = 3;
update public.grade_settings set published = false where class_id = 'de700000-0000-4000-8000-000000000031';
do $$ begin
  if (public.mi_alerta_puntos() ->> 'enviadas')::int <> 0 then raise exception 'FALLO: aviso con el registro sin publicar'; end if;
end $$;
update public.grade_settings set published = true where class_id = 'de700000-0000-4000-8000-000000000031';

-- con firma configurada, el aviso la usa (el perfil del profesor puede no tener nombre)
update public.profiles set full_name = '' where id = 'de700000-0000-4000-8000-000000000001';
update public.lost_alert_settings set firma = 'Prof. Francisco Orbe' where class_id = 'de700000-0000-4000-8000-000000000031';
delete from public.lost_alerts where user_id = 'de700000-0000-4000-8000-000000000011' and numero = 2;
update public.live_message_recipients set read_at = now() - interval '30 hours' where user_id = 'de700000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de700000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de700000-0000-4000-8000-000000000011', true);
do $$ begin
  if (public.mi_alerta_puntos() ->> 'enviadas')::int <> 1 then raise exception 'FALLO: aviso con firma'; end if;
  if not exists (select 1 from public.my_pending_messages_v3() where body like '%' || E'\n\n' || 'Prof. Francisco Orbe') then raise exception 'FALLO: firma'; end if;
end $$;
reset role;

-- el profesor ve los puntos perdidos y los avisos
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de700000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'de700000-0000-4000-8000-000000000001', true);
do $$ declare r record; begin
  select * into r from public.gradebook_lost('de700000-0000-4000-8000-000000000031') where user_id = 'de700000-0000-4000-8000-000000000011';
  if r.perdidos <> 35 or r.extras <> 4 or r.avisos <> 2 or (r.detalle ->> 'practica')::numeric <> 24 or r.ultimo_leido is null then raise exception 'FALLO: vista del profesor %', r; end if;
end $$;
reset role;

-- un mensaje normal (sin confirmación obligatoria) se sigue pudiendo descartar
do $$ declare v uuid; begin
  insert into public.live_messages (sender_id, kind, body) values ('de700000-0000-4000-8000-000000000001', 'informativo', 'Hola') returning id into v;
  insert into public.live_message_recipients (message_id, user_id) values (v, 'de700000-0000-4000-8000-000000000012');
  perform set_config('request.jwt.claims', '{"sub":"de700000-0000-4000-8000-000000000012","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', 'de700000-0000-4000-8000-000000000012', true);
  if not public.ack_live_message(v, 'descartado') then raise exception 'FALLO: descartar un mensaje normal'; end if;
end $$;

do $$ begin
  if has_function_privilege('authenticated', 'public.official_lost(uuid)', 'execute') or has_function_privilege('authenticated', 'public.official_lost_total(uuid)', 'execute') or has_function_privilege('anon', 'public.mi_alerta_puntos()', 'execute') then
    raise exception 'FALLO: permisos'; end if;
end $$;

select 'puntos_perdidos.sql: PRUEBAS PASARON' as resultado;
rollback;
