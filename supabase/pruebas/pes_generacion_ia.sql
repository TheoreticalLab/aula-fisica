-- Pruebas: PES · problemas generados con IA (migración 76): paquetes, propuestas, aceptar/editar/descartar y permisos.
-- Profesor P (sección S, asignatura A), profesor ajeno Q, estudiante E. La generación real la hace «orbe-ia» (service_role).
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de770000-0000-4000-8000-000000000001', 'gi1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-gia","aula_role":"teacher"}', '{}', now(), now()),
  ('de770000-0000-4000-8000-000000000002', 'gi2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-gia-otro","aula_role":"teacher"}', '{}', now(), now()),
  ('de770000-0000-4000-8000-000000000011', 'gi11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"sint-gia-1"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true where id::text like 'de770000-%';
update public.profiles set role = 'teacher' where id in ('de770000-0000-4000-8000-000000000001', 'de770000-0000-4000-8000-000000000002');
insert into public.courses (id, title) values ('de770000-0000-4000-8000-0000000000a0', 'Curso IA'), ('de770000-0000-4000-8000-0000000000b0', 'Otro');
insert into public.units (id, course_id, slug, title, position) values
  ('de770000-0000-4000-8000-0000000000a1', 'de770000-0000-4000-8000-0000000000a0', 'u', 'Cinemática', 1),
  ('de770000-0000-4000-8000-0000000000b1', 'de770000-0000-4000-8000-0000000000b0', 'u', 'U', 1);
insert into public.lessons (id, unit_id, course_id, slug, title, summary) values
  ('de770000-0000-4000-8000-0000000000a2', 'de770000-0000-4000-8000-0000000000a1', 'de770000-0000-4000-8000-0000000000a0', 'mru', 'MRU', 'Velocidad constante'),
  ('de770000-0000-4000-8000-0000000000b2', 'de770000-0000-4000-8000-0000000000b1', 'de770000-0000-4000-8000-0000000000b0', 'x', 'Ajena', '');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de770000-0000-4000-8000-000000000031', 'de770000-0000-4000-8000-0000000000a0', 'S', 'GIA77001', 'de770000-0000-4000-8000-000000000001');
insert into public.class_teachers (class_id, user_id) values ('de770000-0000-4000-8000-000000000031', 'de770000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.enrollments (class_id, user_id) values ('de770000-0000-4000-8000-000000000031', 'de770000-0000-4000-8000-000000000011');

create temp table gi_t (k text primary key, val uuid);
grant all on gi_t to public;

-- un problema válido como lo guarda «orbe-ia»
create temp table gi_p (j jsonb);
grant all on gi_p to public;
insert into gi_p values ('{"leccion_id":"de770000-0000-4000-8000-0000000000a2","dificultad":"intermedio","tipo":"calculo","verificacion":["revisar","calculo_comprobado","revisar"],
  "problema":{"titulo":"Ciclista","contexto":"Una ciclista recorre 150 m en 30 s con velocidad constante.","apartados":[
    {"enunciado":"¿Cómo es su aceleración?","formato":"choice","opciones":["Nula","Positiva","Negativa"],"multiple":false,"etapa":"prediccion","peso":null,"t_ref_s":120,
     "clave":{"format":"choice","correct":[0],"optionFeedback":{"1":"No acelera.","2":"No frena."}},"rubrica":"","explicacion":"Velocidad constante: aceleración nula."},
    {"enunciado":"Calcule su rapidez.","formato":"numeric","unidad_sugerida":"m/s","etapa":"resolucion","peso":null,"t_ref_s":180,
     "clave":{"format":"numeric","value":"5 m/s","relTol":0.02,"commonErrors":[{"value":"2.5 m/s","message":"Dividió entre el doble del tiempo."}]},"rubrica":"","explicacion":"v = d/t = 5 m/s."},
    {"enunciado":"Interprete el resultado.","formato":"open","etapa":"interpretacion","peso":null,"t_ref_s":240,"clave":null,
     "rubrica":"Interpreta 5 m recorridos cada segundo y usa unidades.","explicacion":"Cada segundo recorre 5 m."}]}}');

-- ---------------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.path', '/rpc/prueba', true);
do $$ declare v uuid; g uuid; begin
  perform set_config('request.jwt.claim.sub', 'de770000-0000-4000-8000-000000000001', true);
  v := public.pes_crear('de770000-0000-4000-8000-000000000031', jsonb_build_object('titulo', 'PES IA', 'cierra_at', now() + interval '10 days'));
  insert into gi_t values ('p', v);
  begin perform public.pes_generar_iniciar(v, '{}', 51); raise exception 'FALLO: 51 problemas'; exception when invalid_parameter_value then null; end;
  g := public.pes_generar_iniciar(v, '{"tipos":["calculo"]}', 3);
  insert into gi_t values ('g', g);
  perform set_config('request.jwt.claim.sub', 'de770000-0000-4000-8000-000000000002', true);
  begin perform public.pes_generar_iniciar(v, '{}', 1); raise exception 'FALLO: profesor ajeno genera'; exception when insufficient_privilege then null; end;
  begin perform public.pes_propuestas(v); raise exception 'FALLO: profesor ajeno ve propuestas'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', 'de770000-0000-4000-8000-000000000011', true);
  begin perform public.pes_generar_iniciar(v, '{}', 1); raise exception 'FALLO: estudiante genera'; exception when insufficient_privilege then null; end;
  begin perform public.pes_propuestas(v); raise exception 'FALLO: estudiante ve propuestas'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.pes_propuestas_ia; raise exception 'FALLO: tabla de propuestas legible'; exception when insufficient_privilege then null; end;
  begin perform public.svc_pes_generar_contexto(auth.uid(), g, 'de770000-0000-4000-8000-0000000000a2'); raise exception 'FALLO: svc expuesta'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- «orbe-ia»: contexto (solo la lección de la asignatura, del actor del paquete) y guardado
set local role service_role;
do $$ declare g uuid := (select val from gi_t where k = 'g'); c jsonb; r jsonb; begin
  c := public.svc_pes_generar_contexto('de770000-0000-4000-8000-000000000001', g, 'de770000-0000-4000-8000-0000000000a2');
  if c -> 'leccion' ->> 'titulo' <> 'MRU' or c ->> 'asignatura' <> 'Curso IA' then raise exception 'FALLO: contexto %', c; end if;
  if c::text like '%sint-gia%' or c::text like '%@%' then raise exception 'FALLO: datos de personas en el contexto'; end if;
  begin perform public.svc_pes_generar_contexto('de770000-0000-4000-8000-000000000001', g, 'de770000-0000-4000-8000-0000000000b2'); raise exception 'FALLO: lección ajena';
  exception when insufficient_privilege then null; end;
  begin perform public.svc_pes_generar_contexto('de770000-0000-4000-8000-000000000002', g, 'de770000-0000-4000-8000-0000000000a2'); raise exception 'FALLO: actor distinto';
  exception when insufficient_privilege then null; end;
  for i in 1..3 loop
    r := public.svc_pes_generar_guardar('de770000-0000-4000-8000-000000000001', g, (select j from gi_p), null, 0.01);
    insert into gi_t values ('x' || i, (r ->> 'id')::uuid);
  end loop;
  r := public.svc_pes_generar_guardar('de770000-0000-4000-8000-000000000001', g, null, 'apartado C: el dato d = 999 no aparece en el enunciado', 0.01);
  if r ->> 'id' is not null then raise exception 'FALLO: un rechazo creó propuesta'; end if;
  -- con 4 intentos de 3 pedidos, aún puede seguir (tope: el doble); al llegar al doble, se cierra
  perform public.svc_pes_generar_guardar('de770000-0000-4000-8000-000000000001', g, null, 'r', 0);
  perform public.svc_pes_generar_guardar('de770000-0000-4000-8000-000000000001', g, null, 'r', 0);
  begin perform public.svc_pes_generar_contexto('de770000-0000-4000-8000-000000000001', g, 'de770000-0000-4000-8000-0000000000a2'); raise exception 'FALLO: paquete sin tope';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
reset role;

set local role authenticated;
do $$ declare v uuid := (select val from gi_t where k = 'p'); l jsonb; e uuid; d jsonb; begin
  perform set_config('request.jwt.claim.sub', 'de770000-0000-4000-8000-000000000001', true);
  l := public.pes_generaciones_lista(v);
  if (l -> 0 ->> 'creados')::integer <> 3 or (l -> 0 ->> 'rechazados')::integer <> 3 or (l -> 0 ->> 'costo_usd')::numeric <> 0.04
     or l -> 0 -> 'motivos' ->> 0 not like 'apartado C:%' then raise exception 'FALLO: resumen del paquete %', l; end if;
  if jsonb_array_length(public.pes_propuestas(v)) <> 3 then raise exception 'FALLO: 3 propuestas pendientes'; end if;
  -- aceptar tal cual: ejercicio con claves completas (errores típicos) y origen marcado
  e := public.pes_propuesta_aceptar((select val from gi_t where k = 'x1'));
  begin perform public.pes_propuesta_aceptar((select val from gi_t where k = 'x1')); raise exception 'FALLO: aceptar dos veces';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  -- editada: se usa la versión del profesor
  perform public.pes_propuesta_aceptar((select val from gi_t where k = 'x2'),
    jsonb_set((select j -> 'problema' from gi_p), '{titulo}', '"Ciclista (editado)"'));
  -- una versión editada inválida no entra y la propuesta sigue pendiente
  begin perform public.pes_propuesta_aceptar((select val from gi_t where k = 'x3'),
      jsonb_set((select j -> 'problema' from gi_p), '{apartados,0,clave,correct}', '[7]')); raise exception 'FALLO: aceptó una clave inválida';
  exception when invalid_parameter_value then null; end;
  perform public.pes_propuesta_descartar((select val from gi_t where k = 'x3'));
  begin perform public.pes_propuesta_descartar((select val from gi_t where k = 'x3')); raise exception 'FALLO: descartar dos veces';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  if jsonb_array_length(public.pes_propuestas(v)) <> 0 or jsonb_array_length(public.pes_propuestas(v, null)) <> 3 then raise exception 'FALLO: estados de las propuestas'; end if;
  d := public.pes_detalle_docente(v);
  if jsonb_array_length(d -> 'ejercicios') <> 2 or d -> 'ejercicios' -> 0 ->> 'origen_ref' <> 'Generado con IA · revisado por el profesor'
     or d -> 'ejercicios' -> 1 ->> 'titulo' <> 'Ciclista (editado)' or d -> 'ejercicios' -> 1 ->> 'origen_ref' <> 'Generado con IA · editado por el profesor'
     or jsonb_array_length(d -> 'ejercicios' -> 0 -> 'apartados' -> 1 -> 'clave' -> 'commonErrors') <> 1
     or d -> 'ejercicios' -> 0 -> 'apartados' -> 2 ->> 'rubrica' not like 'Interpreta%' then raise exception 'FALLO: ejercicios creados %', d -> 'ejercicios'; end if;
  -- publicada: ya no se genera ni se acepta
  perform public.pes_publicar(v);
  begin perform public.pes_generar_iniciar(v, '{}', 1); raise exception 'FALLO: generar tras publicar'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.exercises where course_id = 'de770000-0000-4000-8000-0000000000a0') then raise exception 'FALLO: la IA escribió en el banco'; end if;
  if exists (select 1 from public.activities where class_id = 'de770000-0000-4000-8000-000000000031') then raise exception 'FALLO: actividades ordinarias'; end if;
end $$;

select 'pes_generacion_ia.sql: PRUEBAS PASARON' as resultado;
rollback;
