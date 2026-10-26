-- Pruebas: lectura cronometrada (migración 10). Transacción que se deshace al final.
-- Dentro de una transacción now() no avanza: el paso del tiempo se simula moviendo last_beat hacia atrás.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('da000000-0000-4000-8000-000000000001', 'pa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-lec","aula_role":"teacher"}', '{}', now(), now()),
  ('da000000-0000-4000-8000-000000000002', 'ea@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-lec-1"}', '{}', now(), now()),
  ('da000000-0000-4000-8000-000000000003', 'fa@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"est-lec-2"}', '{}', now(), now());
update public.profiles set must_change_password = false where id::text like 'da000000-%';
insert into public.courses (id, title) values ('da000000-0000-4000-8000-000000000011', 'Curso lectura');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('da000000-0000-4000-8000-000000000021', 'da000000-0000-4000-8000-000000000011', 'Sección L1', 'LECTURA2', 'da000000-0000-4000-8000-000000000001'),
  ('da000000-0000-4000-8000-000000000022', 'da000000-0000-4000-8000-000000000011', 'Sección L2', 'LECTURB2', null);
insert into public.enrollments (class_id, user_id) values
  ('da000000-0000-4000-8000-000000000021', 'da000000-0000-4000-8000-000000000002'),
  ('da000000-0000-4000-8000-000000000022', 'da000000-0000-4000-8000-000000000003');
insert into public.activities (id, class_id, title, mode, published, reading_text, reading_min_seconds) values
  ('da000000-0000-4000-8000-000000000031', 'da000000-0000-4000-8000-000000000021', 'Lectura Newton', 'practice', true, 'Texto de la lectura.', 60),
  ('da000000-0000-4000-8000-000000000032', 'da000000-0000-4000-8000-000000000021', 'Sin lectura', 'practice', true, null, null);

-- un tiempo mínimo sin texto no se admite
do $$ begin
  begin
    update public.activities set reading_text = null where id = 'da000000-0000-4000-8000-000000000031';
    raise exception 'FALLO: se aceptó un tiempo de lectura sin texto';
  exception when check_violation then null;
  end;
end $$;

-- el estudiante no puede empezar los ejercicios antes de leer
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"da000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000002', true);
do $$ begin
  if (public.my_reading('da000000-0000-4000-8000-000000000031') ->> 'seconds_read')::int <> 0 then raise exception 'FALLO: lectura no empieza en 0'; end if;
  begin
    perform public.start_activity_attempt('da000000-0000-4000-8000-000000000031');
    raise exception 'FALLO: empezó los ejercicios sin leer';
  exception when raise_exception then
    if sqlerrm not like 'Primero complete%' then raise; end if;
  end;
  -- primer latido: todavía no suma nada
  if (public.reading_beat('da000000-0000-4000-8000-000000000031', true) ->> 'seconds_read')::int <> 0 then raise exception 'FALLO: el primer latido sumó tiempo'; end if;
  -- no puede escribir su progreso directamente
  begin
    update public.reading_progress set seconds_read = 999;
    raise exception 'FALLO: el estudiante modificó su progreso de lectura';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 10 s de lectura real entre latidos: suma 10
reset role;
update public.reading_progress set last_beat = now() - interval '10 seconds' where user_id = 'da000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
  if (public.reading_beat('da000000-0000-4000-8000-000000000031', true) ->> 'seconds_read')::int <> 10 then raise exception 'FALLO: no sumó 10 s'; end if;
  -- sale de la plataforma: se registra la pausa y deja de contar
  if (public.reading_beat('da000000-0000-4000-8000-000000000031', false) ->> 'pauses')::int <> 1 then raise exception 'FALLO: no registró la pausa'; end if;
end $$;

-- estuvo fuera 5 minutos: al volver no se suma ese tiempo
reset role;
update public.reading_progress set last_beat = now() - interval '5 minutes' where user_id = 'da000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
  if (public.reading_beat('da000000-0000-4000-8000-000000000031', true) ->> 'seconds_read')::int <> 10 then raise exception 'FALLO: contó tiempo fuera de la plataforma'; end if;
end $$;

-- dos tramos de 20 s y uno de 15 s: 10 + 20 + 20 + 15 = 65 ≥ 60 → completada (se limita a 60)
reset role;
update public.reading_progress set last_beat = now() - interval '20 seconds' where user_id = 'da000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.reading_beat('da000000-0000-4000-8000-000000000031', true);
reset role;
update public.reading_progress set last_beat = now() - interval '20 seconds' where user_id = 'da000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.reading_beat('da000000-0000-4000-8000-000000000031', true);
reset role;
update public.reading_progress set last_beat = now() - interval '15 seconds' where user_id = 'da000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$
declare r jsonb := public.reading_beat('da000000-0000-4000-8000-000000000031', true);
begin
  if not (r ->> 'completed')::boolean or (r ->> 'seconds_read')::int <> 60 then raise exception 'FALLO: lectura no completada: %', r; end if;
  if public.start_activity_attempt('da000000-0000-4000-8000-000000000031') is null then raise exception 'FALLO: no pudo empezar tras leer'; end if;
  if not exists (select 1 from jsonb_array_elements(public.my_activities()) x
                 where x ->> 'id' = 'da000000-0000-4000-8000-000000000031' and (x ->> 'reading_done')::boolean) then
    raise exception 'FALLO: my_activities no refleja la lectura completada';
  end if;
  -- una actividad sin lectura no acepta latidos
  begin
    perform public.reading_beat('da000000-0000-4000-8000-000000000032', true);
    raise exception 'FALLO: aceptó latidos en una actividad sin lectura';
  exception when raise_exception then
    if sqlerrm not like 'Esta actividad no tiene lectura%' then raise; end if;
  end;
end $$;

-- un estudiante de otra sección no puede leer ni ver el progreso ajeno
select set_config('request.jwt.claims', '{"sub":"da000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000003', true);
do $$ begin
  begin
    perform public.reading_beat('da000000-0000-4000-8000-000000000031', true);
    raise exception 'FALLO: un estudiante de otra sección registró lectura';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.reading_progress) then raise exception 'FALLO: un estudiante ve el progreso de otro'; end if;
end $$;

-- el profesor de la sección sí ve el progreso
select set_config('request.jwt.claims', '{"sub":"da000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000001', true);
do $$ begin
  if not exists (select 1 from public.reading_progress where user_id = 'da000000-0000-4000-8000-000000000002') then
    raise exception 'FALLO: el profesor no ve el progreso de lectura';
  end if;
end $$;

reset role;
rollback;
select 'PRUEBAS DE LECTURA CRONOMETRADA PASARON' as resultado;
