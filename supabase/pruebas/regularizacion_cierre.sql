-- Pruebas: «Ya registré todo lo que tengo» y recordatorio al entrar (migración 46). Datos sintéticos; se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('e9000000-0000-4000-8000-000000000001', 'ca@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-cierre","aula_role":"teacher"}', '{}', now(), now()),
  ('e9000000-0000-4000-8000-000000000002', 'cb@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-ajeno-cie","aula_role":"teacher"}', '{}', now(), now()),
  ('e9000000-0000-4000-8000-000000000011', 'c1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-cie-1"}', '{}', now(), now()),
  ('e9000000-0000-4000-8000-000000000012', 'c2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-cie-2"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'e9000000-%';
update public.profiles set role = 'teacher' where id in ('e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('e9000000-0000-4000-8000-000000000021', 'Curso cierre');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('e9000000-0000-4000-8000-000000000031', 'e9000000-0000-4000-8000-000000000021', 'Sección cierre', 'CIERRE01', 'e9000000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('e9000000-0000-4000-8000-000000000031', 'e9000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values
  ('e9000000-0000-4000-8000-000000000031', 'e9000000-0000-4000-8000-000000000011'),
  ('e9000000-0000-4000-8000-000000000031', 'e9000000-0000-4000-8000-000000000012');

set local role authenticated;

-- antes de activar: ningún aviso
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000011', true);
do $$ begin
  if jsonb_array_length(public.hist_pendientes()) <> 0 then raise exception 'FALLO: aviso sin regularización abierta'; end if;
end $$;

-- el profesor activa la regularización
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000001', true);
do $$
declare c jsonb;
begin
  perform public.hist_configurar('e9000000-0000-4000-8000-000000000031', true, '', 7, 2, 300, 40, 10);
  c := public.hist_config('e9000000-0000-4000-8000-000000000031');
  if not (c->>'recordar')::boolean or (c->>'terminados')::int <> 0 then raise exception 'FALLO: configuración inicial %', c; end if;
  perform set_config('prueba.p' || (x->>'numero'), x->>'id', true) from jsonb_array_elements(c->'practicas') x;
end $$;

-- estudiante 1: le aparece el aviso; con un borrador no puede terminar; registra y termina; ya no crea registros nuevos
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000011', true);
do $$
declare p jsonb; r jsonb;
begin
  p := public.hist_pendientes();
  if jsonb_array_length(p) <> 1 or not (p->0->>'sin_terminar')::boolean then raise exception 'FALLO: aviso inicial %', p; end if;
  perform public.hist_guardar('e9000000-0000-4000-8000-0000000000a1', 'e9000000-0000-4000-8000-000000000031', current_setting('prueba.p1')::uuid, 'incidencia',
    'Newton', '', null, true, 'correo', 'est1@ejemplo.com', null, null, 'Perdí la conversación');
  begin perform public.hist_finalizar('e9000000-0000-4000-8000-000000000031', false, null); raise exception 'FALLO: terminó con un borrador';
  exception when raise_exception then if sqlerrm not like 'Tiene 1 borrador%' then raise; end if; end;
  r := public.hist_enviar(array['e9000000-0000-4000-8000-0000000000a1']::uuid[], true, null);
  if (r->>'registradas')::int <> 1 then raise exception 'FALLO: registrar %', r; end if;
  begin perform public.hist_finalizar('e9000000-0000-4000-8000-000000000031', true, null); raise exception 'FALLO: declaró «sin prácticas» teniendo registros';
  exception when invalid_parameter_value then null; end;
  r := public.hist_finalizar('e9000000-0000-4000-8000-000000000031', false, 'Es todo lo que tengo');
  if (r->>'registradas')::int <> 1 then raise exception 'FALLO: terminar %', r; end if;
  if jsonb_array_length(public.hist_pendientes()) <> 0 then raise exception 'FALLO: el aviso sigue después de terminar'; end if;
  if public.hist_mis_secciones()->0->>'terminado_at' is null then raise exception 'FALLO: mis_secciones sin terminado_at'; end if;
  begin perform public.hist_guardar('e9000000-0000-4000-8000-0000000000a2', 'e9000000-0000-4000-8000-000000000031', current_setting('prueba.p2')::uuid, 'evidencia',
    '', '', null, true, null, null, null, null, null); raise exception 'FALLO: creó un registro después de terminar';
  exception when raise_exception then if sqlerrm not like 'Ya marcó que terminó%' then raise; end if; end;
  begin perform 1 from public.hist_cierres; raise exception 'FALLO: leyó hist_cierres'; exception when insufficient_privilege then null; end;
  begin perform public.hist_terminados('e9000000-0000-4000-8000-000000000031'); raise exception 'FALLO: un estudiante vio los terminados';
  exception when insufficient_privilege then null; end;
end $$;

-- estudiante 2: sin registros no termina sin declararlo; declarando «no tengo prácticas» sí (no es una nota)
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000012', true);
do $$ begin
  begin perform public.hist_finalizar('e9000000-0000-4000-8000-000000000031', false, null); raise exception 'FALLO: terminó sin registros ni declaración';
  exception when invalid_parameter_value then null; end;
  perform public.hist_finalizar('e9000000-0000-4000-8000-000000000031', true, null);
  if jsonb_array_length(public.hist_pendientes()) <> 0 then raise exception 'FALLO: aviso al estudiante 2'; end if;
  if not (public.hist_mis_secciones()->0->>'sin_practicas')::boolean then raise exception 'FALLO: sin_practicas'; end if;
end $$;

-- el profesor: ve quién terminó; pide una aclaración (vuelve el aviso solo por la aclaración); reabre al estudiante 1
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000001', true);
do $$
declare n integer;
begin
  select count(*) into n from public.hist_terminados('e9000000-0000-4000-8000-000000000031') where finalizado_at is not null;
  if n <> 2 or (public.hist_config('e9000000-0000-4000-8000-000000000031')->>'terminados')::int <> 2 then raise exception 'FALLO: terminados %', n; end if;
  perform public.hist_revisar(array['e9000000-0000-4000-8000-0000000000a1']::uuid[], 'aclaracion', '¿Desde qué correo?');
end $$;
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000011', true);
do $$
declare p jsonb;
begin
  p := public.hist_pendientes();
  if jsonb_array_length(p) <> 1 or (p->0->>'sin_terminar')::boolean or (p->0->>'aclaraciones')::int <> 1 then raise exception 'FALLO: aviso por aclaración %', p; end if;
  -- habiendo terminado, sí puede corregir el registro con aclaración y responder
  perform public.hist_guardar('e9000000-0000-4000-8000-0000000000a1', 'e9000000-0000-4000-8000-000000000031', current_setting('prueba.p1')::uuid, 'incidencia',
    'Newton', '', null, true, 'correo', 'otro@ejemplo.com', null, null, 'Perdí la conversación');
  perform public.hist_enviar(array['e9000000-0000-4000-8000-0000000000a1']::uuid[], true, 'Fue desde otro@ejemplo.com');
  if jsonb_array_length(public.hist_pendientes()) <> 0 then raise exception 'FALLO: el aviso sigue tras responder'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin perform public.hist_reabrir_estudiante('e9000000-0000-4000-8000-000000000031', 'e9000000-0000-4000-8000-000000000011', null); raise exception 'FALLO: un profesor ajeno reabrió';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000001', true);
select public.hist_reabrir_estudiante('e9000000-0000-4000-8000-000000000031', 'e9000000-0000-4000-8000-000000000011', 'Añade la práctica 2');
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000011', true);
do $$ begin
  if not (public.hist_pendientes()->0->>'sin_terminar')::boolean then raise exception 'FALLO: aviso tras reabrir'; end if;
  perform public.hist_guardar('e9000000-0000-4000-8000-0000000000a2', 'e9000000-0000-4000-8000-000000000031', current_setting('prueba.p2')::uuid, 'evidencia',
    '', '', null, true, null, null, null, null, null);
end $$;

-- recordatorio desactivado por el profesor: ya no hay aviso (salvo aclaraciones)
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000001', true);
select public.hist_recordatorio('e9000000-0000-4000-8000-000000000031', false);
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000011', true);
do $$ begin
  if jsonb_array_length(public.hist_pendientes()) <> 0 then raise exception 'FALLO: aviso con el recordatorio desactivado'; end if;
end $$;

reset role;
do $$ begin
  if exists (select 1 from public.grade_entries where class_id = 'e9000000-0000-4000-8000-000000000031') then raise exception 'FALLO: terminar creó notas'; end if;
  if (select count(*) from public.hist_events where class_id = 'e9000000-0000-4000-8000-000000000031' and accion in ('terminada', 'reabierta')) <> 3 then
    raise exception 'FALLO: historial de terminar/reabrir';
  end if;
end $$;

select 'PRUEBAS DE CIERRE Y RECORDATORIO DE LA REGULARIZACIÓN PASARON' as resultado;
rollback;
