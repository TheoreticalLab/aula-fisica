-- Pruebas: asistencia autónoma por quórum de proximidad (migración 43). Casos 1–12 de la especificación.
-- Coordenadas sintéticas en metros sobre (18.0, −70.0); transacción que se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('a4300000-0000-4000-8000-0000000000' || n)::uuid, 'q' || n || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
  jsonb_build_object('login_id', 'sint-quorum-' || n), '{}', now(), now()
from unnest(array['01', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']) n;
update public.profiles set must_change_password = false, active = true where id::text like 'a4300000-%';
update public.profiles set role = 'teacher' where id = 'a4300000-0000-4000-8000-000000000001';
insert into public.courses (id, title) values ('a4300000-0000-4000-8000-000000000021', 'Física General 1 (quórum)');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('a4300000-0000-4000-8000-000000000031', 'a4300000-0000-4000-8000-000000000021', 'Sección quórum', 'QUORUM01', 'a4300000-0000-4000-8000-000000000001'),
  ('a4300000-0000-4000-8000-000000000032', 'a4300000-0000-4000-8000-000000000021', 'Sección manual', 'QUORUM02', 'a4300000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values
  ('a4300000-0000-4000-8000-000000000031', 'a4300000-0000-4000-8000-000000000001'), ('a4300000-0000-4000-8000-000000000032', 'a4300000-0000-4000-8000-000000000001')
  on conflict do nothing;
-- S11…S19 en la sección de quórum; S11…S13 también en la manual; S20 en ninguna
insert into public.enrollments (class_id, user_id)
  select 'a4300000-0000-4000-8000-000000000031', ('a4300000-0000-4000-8000-0000000000' || n)::uuid from unnest(array['11','12','13','14','15','16','17','18','19']) n;
insert into public.enrollments (class_id, user_id)
  select 'a4300000-0000-4000-8000-000000000032', ('a4300000-0000-4000-8000-0000000000' || n)::uuid from unnest(array['11','12','13']) n;

-- utilidades de la prueba: actuar como un usuario; metros → grados; identificador de instalación por estudiante
create function public.qtest_como(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', 'a4300000-0000-4000-8000-0000000000' || u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', 'a4300000-0000-4000-8000-0000000000' || u, true);
end $$;
create function public.qtest_lat(norte double precision) returns double precision language sql as $$ select 18.0 + norte / 111195.0 $$;
create function public.qtest_lng(este double precision) returns double precision language sql as $$ select -70.0 + este / (111195.0 * cos(radians(18.0))) $$;
create function public.qtest_disp(u text) returns text language sql as $$ select '00000000000000' || u $$;
create function public.qtest_unir(u text, norte double precision, este double precision, prec double precision default 8, edad integer default 1000, disp text default null)
returns jsonb language plpgsql as $$ begin
  perform public.qtest_como(u);
  return public.attendance_quorum_join('a4300000-0000-4000-8000-000000000031', public.qtest_lat(norte), public.qtest_lng(este), prec, edad, gen_random_uuid(), coalesce(disp, public.qtest_disp(u)));
end $$;
create function public.qtest_marcar(u text, norte double precision, este double precision, prec double precision default 8, edad integer default 1000, disp text default null)
returns jsonb language plpgsql as $$ begin
  perform public.qtest_como(u);
  return public.attendance_quorum_check_in(public.qtest_lat(norte), public.qtest_lng(este), prec, edad, coalesce(disp, public.qtest_disp(u)));
end $$;
-- (las funciones auxiliares viven en public solo dentro de esta transacción; la de recuento lee como propietario)
create function public.qtest_sesiones(c text) returns bigint language sql security definer set search_path = '' as $$ select count(*) from public.attendance_sessions where class_id = ('a4300000-0000-4000-8000-0000000000' || c)::uuid $$;

-- privilegios
do $$ begin
  if has_table_privilege('authenticated', 'public.attendance_quorum_requests', 'select') or has_table_privilege('authenticated', 'public.class_schedules', 'insert')
     or has_table_privilege('authenticated', 'public.attendance_quorum_settings', 'update') then raise exception 'FALLO: tablas del quórum accesibles directamente'; end if;
  if has_function_privilege('authenticated', 'public.attendance_quorum_admitir(uuid, uuid, double precision, double precision, double precision, integer, text)', 'execute') then
    raise exception 'FALLO: el núcleo de admisión es invocable por usuarios'; end if;
  if has_function_privilege('anon', 'public.attendance_quorum_join(uuid, double precision, double precision, double precision, integer, uuid, text)', 'execute') then
    raise exception 'FALLO: anon puede pedir quórum'; end if;
  if public.geo_veredicto(45, 10, 10, 50) <> 'compatible' or public.geo_veredicto(80, 10, 10, 50) <> 'incompatible' or public.geo_veredicto(65, 10, 10, 50) <> 'inconclusa' then
    raise exception 'FALLO: veredicto con incertidumbre'; end if;
end $$;

set local role authenticated;

-- el profesor activa el quórum con la clase dentro de 3 horas
do $$ declare t timestamp := (now() at time zone 'America/Santo_Domingo') + interval '3 hours'; r jsonb; begin
  perform public.qtest_como('01');
  r := public.attendance_quorum_configurar('a4300000-0000-4000-8000-000000000031', '{"enabled": true}',
    jsonb_build_array(jsonb_build_object('dia_semana', extract(isodow from t), 'hora', to_char(t, 'HH24:MI'))));
  if (r -> 'ajustes' ->> 'enabled')::boolean is not true or (r -> 'ajustes' ->> 'radio_general_m')::int <> 100 or r ->> 'proxima' is null then raise exception 'FALLO: configuración %', r; end if;
end $$;

-- Caso 9 · fuera del horario: tres estudiantes próximos no activan
do $$ declare r jsonb; begin
  r := public.qtest_unir('11', 0, 0); if r ->> 'estado' <> 'fuera_de_horario' or r ->> 'proxima' is null then raise exception 'FALLO caso 9: %', r; end if;
  perform public.qtest_unir('12', 20, 0); perform public.qtest_unir('13', 0, 25);
  if public.qtest_sesiones('31') <> 0 then raise exception 'FALLO caso 9: se activó fuera del horario'; end if;
end $$;

-- ahora la clase empezó hace 2 minutos
do $$ declare t timestamp := (now() at time zone 'America/Santo_Domingo') - interval '2 minutes'; begin
  perform public.qtest_como('01');
  perform public.attendance_quorum_configurar('a4300000-0000-4000-8000-000000000031', '{}',
    jsonb_build_array(jsonb_build_object('dia_semana', extract(isodow from t), 'hora', to_char(t, 'HH24:MI'))));
end $$;

-- Caso 12 · permisos: un estudiante no cambia el horario; quien no está matriculado no participa
do $$ begin
  perform public.qtest_como('11');
  begin perform public.attendance_quorum_configurar('a4300000-0000-4000-8000-000000000031', '{"quorum": 3}', '[]'); raise exception 'FALLO caso 12: un estudiante cambió el horario';
  exception when insufficient_privilege then null; end;
  begin perform public.qtest_unir('20', 0, 0); raise exception 'FALLO caso 12: un no matriculado pidió quórum';
  exception when insufficient_privilege then null; end;
  begin perform public.attendance_quorum_admitir('a4300000-0000-4000-8000-000000000011', gen_random_uuid(), 18, -70, 5, 0, 'x'); raise exception 'FALLO caso 12: núcleo invocado';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.attendance_quorum_requests; raise exception 'FALLO caso 12: solicitudes legibles';
  exception when insufficient_privilege then null; end;
end $$;

-- Caso 1 · dos estudiantes próximos: no se activa · Caso 3 · separados: no se activa
do $$ declare r jsonb; begin
  r := public.qtest_unir('11', 0, 0);   if r ->> 'estado' <> 'esperando' or (r ->> 'participantes')::int <> 1 then raise exception 'FALLO caso 1 (1/3): %', r; end if;
  r := public.qtest_unir('12', 20, 0);  if r ->> 'estado' <> 'esperando' or (r ->> 'participantes')::int <> 2 then raise exception 'FALLO caso 1 (2/3): %', r; end if;
  r := public.qtest_unir('16', 300, 0); if r ->> 'estado' <> 'esperando' then raise exception 'FALLO caso 3: %', r; end if;
  r := public.qtest_unir('17', 0, 300); if r ->> 'estado' <> 'esperando' then raise exception 'FALLO caso 3: %', r; end if;
  if public.qtest_sesiones('31') <> 0 then raise exception 'FALLO casos 1 y 3: se activó sin quórum de proximidad'; end if;
end $$;

-- Caso 6 · precisión insuficiente · Caso 10 · medición antigua · dispositivo de otro estudiante
do $$ declare r jsonb; begin
  r := public.qtest_unir('13', 0, 25, 120);       if r ->> 'estado' <> 'inconclusa' or r ->> 'motivo' <> 'precision' then raise exception 'FALLO caso 6: %', r; end if;
  r := public.qtest_unir('13', 0, 25, 8, 300000); if r ->> 'estado' <> 'medicion_antigua' then raise exception 'FALLO caso 10: %', r; end if;
  r := public.qtest_unir('14', 10, 10, 8, 1000, public.qtest_disp('11')); if r ->> 'motivo' <> 'dispositivo_compartido' then raise exception 'FALLO dispositivo compartido: %', r; end if;
  if public.qtest_sesiones('31') <> 0 then raise exception 'FALLO: mediciones no válidas activaron la asistencia'; end if;
end $$;

-- Caso 2 · tercer estudiante próximo: activación inmediata y los tres presentes
do $$ declare r jsonb; begin
  r := public.qtest_unir('13', 0, 25);
  if r ->> 'estado' <> 'activada' or r ->> 'session_id' is null then raise exception 'FALLO caso 2: %', r; end if;
end $$;
-- las comprobaciones leen las tablas directamente: como administrador de la prueba (el estudiante no puede, y es correcto)
reset role;
do $$ declare s public.attendance_sessions; begin
  select * into s from public.attendance_sessions where class_id = 'a4300000-0000-4000-8000-000000000031';
  if s.activacion <> 'quorum' or s.geo_radius_m <> 100 or cardinality(s.quorum_ids) <> 3 or s.closed_at is not null then raise exception 'FALLO caso 2: sesión %', row_to_json(s); end if;
  if not (s.quorum_ids @> array['a4300000-0000-4000-8000-000000000011', 'a4300000-0000-4000-8000-000000000012', 'a4300000-0000-4000-8000-000000000013']::uuid[]) then
    raise exception 'FALLO caso 2: integrantes %', s.quorum_ids; end if;
  if (select count(*) from public.attendance_records where session_id = s.id and method = 'quorum') <> 3 then raise exception 'FALLO caso 2: registros'; end if;
  -- C₀ = media de las tres posiciones: (6.7 m N, 8.3 m E)
  if public.geo_distance_m(s.geo_lat, s.geo_lng, public.qtest_lat(20.0 / 3), public.qtest_lng(25.0 / 3)) > 0.5 then raise exception 'FALLO caso 2: centro'; end if;
  perform set_config('prueba.q', s.id::text, true);
end $$;
set local role authenticated;

-- Caso 7 · nuevas pulsaciones con la sesión ya activa: ni otra sesión ni registros duplicados
do $$ declare r jsonb; begin
  r := public.qtest_unir('14', 10, 10);  if r ->> 'estado' <> 'presente' then raise exception 'FALLO caso 7: %', r; end if;      -- usa la sesión existente
  r := public.qtest_unir('14', 10, 10);  if (r ->> 'ya')::boolean is not true then raise exception 'FALLO caso 7 (repetido): %', r; end if;
  r := public.qtest_unir('11', 0, 0);    if (r ->> 'ya')::boolean is not true then raise exception 'FALLO caso 7 (integrante): %', r; end if;
  if public.qtest_sesiones('31') <> 1 then raise exception 'FALLO caso 7: más de una sesión'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.attendance_records where session_id = current_setting('prueba.q')::uuid) <> 4 then raise exception 'FALLO caso 7: registros duplicados o perdidos'; end if;
  begin
    insert into public.attendance_sessions (class_id, code, code_expires_at, activacion, franja)
      select class_id, '123456', now() + interval '1 hour', 'quorum', franja from public.attendance_sessions where id = current_setting('prueba.q')::uuid;
    raise exception 'FALLO caso 7: dos sesiones de quórum en la misma franja';
  exception when unique_violation then null; end;
end $$;
set local role authenticated;

-- Caso 4 · un cuarto (quinto) estudiante en la zona y cerca de un admitido: presente por proximidad
do $$ declare r jsonb; begin
  r := public.qtest_marcar('15', 40, 10);
  if r ->> 'estado' <> 'presente' then raise exception 'FALLO caso 4: %', r; end if;
end $$;
reset role;
do $$ declare v public.attendance_records; begin
  select * into v from public.attendance_records where session_id = current_setting('prueba.q')::uuid and user_id = 'a4300000-0000-4000-8000-000000000015';
  if v.method <> 'proximidad' or v.validado_por is null or v.distancia_ref_m > 50 or v.ref_vigente_hasta <= now() then raise exception 'FALLO caso 4: registro %', row_to_json(v); end if;
end $$;
set local role authenticated;

-- Caso 5 · propagación: S17 entra (a 46 m de S15, a 79 m de C₀); S18 está a 45 m de S17 pero a 124 m de C₀: NO
do $$ declare r jsonb; begin
  r := public.qtest_marcar('17', 85, 0, 5);  if r ->> 'estado' <> 'presente' then raise exception 'FALLO caso 5 (paso intermedio): %', r; end if;
  r := public.qtest_marcar('18', 130, 0, 5); if r ->> 'estado' <> 'fuera_de_zona' or r ->> 'motivo' <> 'lejos_del_centro' then raise exception 'FALLO caso 5: %', r; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.attendance_records where session_id = current_setting('prueba.q')::uuid and user_id = 'a4300000-0000-4000-8000-000000000018') then
    raise exception 'FALLO caso 5: la zona se desplazó'; end if;
  if not exists (select 1 from public.attendance_rejections where session_id = current_setting('prueba.q')::uuid and user_id = 'a4300000-0000-4000-8000-000000000018' and reason = 'lejos') then
    raise exception 'FALLO caso 5: rechazo no registrado'; end if;
end $$;
set local role authenticated;

-- Caso 6 (progresivo) · precisión insuficiente: inconclusa, no ausente · dispositivo de otro: rechazado
do $$ declare r jsonb; begin
  r := public.qtest_marcar('16', 5, 5, 100); if r ->> 'estado' <> 'inconclusa' or r ->> 'motivo' <> 'precision' then raise exception 'FALLO caso 6 progresivo: %', r; end if;
  r := public.qtest_marcar('16', 0, 5, 8, 1000, public.qtest_disp('11')); if r ->> 'motivo' <> 'dispositivo_compartido' then raise exception 'FALLO dispositivo (progresivo): %', r; end if;
  r := public.qtest_marcar('16', 0, 5, 8, 120000); if r ->> 'estado' <> 'medicion_antigua' then raise exception 'FALLO caso 10 progresivo: %', r; end if;
end $$;

-- Caso 11 · referencias caducadas no autorizan; una renovación puntual sí
reset role;
update public.attendance_records set ref_vigente_hasta = now() - interval '1 minute' where session_id = current_setting('prueba.q')::uuid;
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.qtest_marcar('19', 5, 5);
  if r ->> 'estado' <> 'inconclusa' or r ->> 'motivo' <> 'sin_referencias_vigentes' then raise exception 'FALLO caso 11: %', r; end if;
  perform public.qtest_como('11');
  r := public.attendance_quorum_renovar(public.qtest_lat(0), public.qtest_lng(0), 8, 1000, public.qtest_disp('11'));
  if r ->> 'estado' <> 'renovada' then raise exception 'FALLO renovación: %', r; end if;
  r := public.attendance_quorum_renovar(public.qtest_lat(0), public.qtest_lng(0), 8, 1000, public.qtest_disp('12'));
  if r ->> 'motivo' <> 'otro_dispositivo' then raise exception 'FALLO renovación desde otro dispositivo: %', r; end if;
  r := public.qtest_marcar('19', 5, 5);
  if r ->> 'estado' <> 'presente' then raise exception 'FALLO caso 11 (tras renovar): %', r; end if;
end $$;

-- estado del estudiante (sin posiciones de otros) y vista del profesor
do $$ declare r jsonb; l jsonb; begin
  perform public.qtest_como('11');
  r := public.attendance_quorum_estado();
  if r -> 0 ->> 'estado' <> 'activa_quorum' or (r -> 0 ->> 'presente')::boolean is not true then raise exception 'FALLO estado: %', r; end if;
  if r::text ~ '"lat"|"lng"' then raise exception 'FALLO: el estudiante recibe coordenadas'; end if;
  begin perform public.attendance_live(current_setting('prueba.q')::uuid); raise exception 'FALLO: el estudiante abrió la vista del profesor';
  exception when insufficient_privilege then null; end;
  begin perform public.attendance_set(current_setting('prueba.q')::uuid, 'a4300000-0000-4000-8000-000000000016', true); raise exception 'FALLO caso 12: un estudiante marcó a otro';
  exception when insufficient_privilege then null; end;
  perform public.qtest_como('01');
  l := public.attendance_live(current_setting('prueba.q')::uuid);
  if l ->> 'activacion' <> 'quorum' or jsonb_array_length(l -> 'quorum') <> 3 or jsonb_array_length(l -> 'incidencias') = 0 or jsonb_array_length(l -> 'rechazos') = 0 then
    raise exception 'FALLO vista del profesor: %', jsonb_build_object('act', l ->> 'activacion', 'q', l -> 'quorum', 'inc', jsonb_array_length(l -> 'incidencias'));
  end if;
  if not exists (select 1 from jsonb_array_elements(l -> 'estudiantes') e where e ->> 'method' = 'proximidad' and e ->> 'validado_por' is not null) then
    raise exception 'FALLO vista del profesor: validación progresiva no visible'; end if;
  -- el profesor sigue pudiendo marcar a mano y cerrar
  perform public.attendance_set(current_setting('prueba.q')::uuid, 'a4300000-0000-4000-8000-000000000016', true);
  perform public.attendance_close(current_setting('prueba.q')::uuid);
end $$;

-- cerrada por el profesor: los estudiantes no la reabren en la misma franja
do $$ declare r jsonb; begin
  r := public.qtest_unir('18', 0, 0);
  if r ->> 'estado' <> 'cerrada' then raise exception 'FALLO: se reabrió una asistencia cerrada por el profesor: %', r; end if;
end $$;

-- Caso 8 · sesión manual ya activa: se usa la del profesor, no se crea otra
do $$ declare t timestamp := (now() at time zone 'America/Santo_Domingo') - interval '2 minutes'; r jsonb; begin
  perform public.qtest_como('01');
  perform public.attendance_start('a4300000-0000-4000-8000-000000000032', 10, 30, 18.0, -70.0, 10, true, 100);
  perform public.attendance_quorum_configurar('a4300000-0000-4000-8000-000000000032', '{"enabled": true}',
    jsonb_build_array(jsonb_build_object('dia_semana', extract(isodow from t), 'hora', to_char(t, 'HH24:MI'))));
  perform public.qtest_como('11');
  r := public.attendance_quorum_join('a4300000-0000-4000-8000-000000000032', 18.0, -70.0, 8, 1000, gen_random_uuid(), public.qtest_disp('11'));
  if r ->> 'estado' <> 'sesion_manual' then raise exception 'FALLO caso 8: %', r; end if;
  if public.qtest_sesiones('32') <> 1 then raise exception 'FALLO caso 8: se creó otra sesión'; end if;
end $$;
reset role;

-- las sesiones manuales anteriores siguen con su método y sin cambios
do $$ begin
  if exists (select 1 from public.attendance_sessions where class_id = 'a4300000-0000-4000-8000-000000000032' and activacion <> 'manual') then
    raise exception 'FALLO: una sesión manual cambió de activación'; end if;
end $$;

select 'asistencia_quorum.sql: PRUEBAS PASARON' as resultado;
rollback;
