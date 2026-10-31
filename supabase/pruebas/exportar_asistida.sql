-- Pruebas: Centro de Datos + práctica asistida y prórrogas (migración 39). Solo plantillas y seudonimización; se deshace.
begin;
do $$
declare f record; r jsonb; v uuid := 'de390000-0000-4000-8000-000000000001';
begin
  select * into f from public.export_fuente('asistida_pasos');
  if f.grupo <> 'respuestas' or f.tabla_real <> 'assisted_steps' or not ('client_id' = any (f.quitar)) then raise exception 'FALLO: asistida_pasos %', f; end if;
  select * into f from public.export_fuente('asistida_config');
  if f.grupo <> 'diseno' or f.tabla_real <> 'assisted_settings' or not ('updated_by' = any (f.quitar)) then raise exception 'FALLO: asistida_config %', f; end if;
  select * into f from public.export_fuente('asistida_transferencias');
  if f.grupo <> 'diseno' or f.tabla_real <> 'assisted_transfer' then raise exception 'FALLO: asistida_transferencias %', f; end if;
  select * into f from public.export_fuente('examen_prorrogas');
  if f.grupo <> 'telemetria' or f.tabla_real <> 'exam_extensions' then raise exception 'FALLO: examen_prorrogas %', f; end if;
  -- lo anterior sigue igual
  if (select tabla_real from public.export_fuente('examen_tramos')) <> 'exam_intervals' then raise exception 'FALLO: examen_tramos'; end if;
  if (select quitar from public.export_fuente('asistencia_registros')) <> '{lat,lng,device_hash}' then raise exception 'FALLO: columnas sensibles de asistencia'; end if;
  for f in select x, (public.export_fuente(x)).tabla_real t from unnest(array['asistida_pasos', 'asistida_config', 'asistida_transferencias', 'examen_prorrogas']) x loop
    if to_regclass('public.' || f.t) is null then raise exception 'FALLO: no existe %', f.t; end if;
  end loop;
  -- modo investigación: quién concedió la prórroga también se seudonimiza; el identificador técnico del envío nunca sale
  r := public.export_fila('investigacion', 'examen_prorrogas', '{}', jsonb_build_object('teacher_id', v, 'segundos', 300));
  if r ->> 'teacher_id' = v::text or r ->> 'segundos' <> '300' then raise exception 'FALLO: teacher_id sin seudonimizar %', r; end if;
  r := public.export_fila('identificado', 'examen_prorrogas', '{}', jsonb_build_object('teacher_id', v));
  if r ->> 'teacher_id' <> v::text then raise exception 'FALLO: en modo identificado no se seudonimiza'; end if;
  r := public.export_fila('investigacion', 'asistida_pasos', (public.export_fuente('asistida_pasos')).quitar,
    jsonb_build_object('client_id', v, 'user_id', v, 'declaracion', 'autonomo'));
  if r ? 'client_id' or r ->> 'user_id' = v::text or r ->> 'declaracion' <> 'autonomo' then raise exception 'FALLO: paso exportado %', r; end if;
  if has_function_privilege('authenticated', 'public.export_fila(text, text, text[], jsonb)', 'execute') then raise exception 'FALLO: export_fila expuesta'; end if;
end $$;
select 'exportar_asistida.sql: PRUEBAS PASARON' as resultado;
rollback;
