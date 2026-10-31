-- Pruebas: Centro de Datos + motor de examen (migración 36). Solo lectura de las plantillas; se deshace al final.
begin;
do $$
declare n integer; f record;
begin
  -- las cuatro fuentes nuevas, con su grupo y su tabla
  select * into f from public.export_fuente('examen_tramos');
  if f.grupo <> 'telemetria' or f.tabla_real <> 'exam_intervals' then raise exception 'FALLO: examen_tramos %', f; end if;
  select * into f from public.export_fuente('examen_eventos');
  if f.grupo <> 'telemetria' or f.tabla_real <> 'exam_events' then raise exception 'FALLO: examen_eventos %', f; end if;
  select * into f from public.export_fuente('examen_sesiones');
  if f.grupo <> 'telemetria' or f.tabla_real <> 'exam_sessions' then raise exception 'FALLO: examen_sesiones %', f; end if;
  select * into f from public.export_fuente('examen_config');
  if f.grupo <> 'diseno' or f.tabla_real <> 'exam_settings' or not ('updated_by' = any (f.quitar)) then raise exception 'FALLO: examen_config %', f; end if;
  -- las anteriores siguen igual y lo desconocido no existe
  if (select grupo from public.export_fuente('calibraciones')) <> 'diseno' then raise exception 'FALLO: calibraciones'; end if;
  if (select quitar from public.export_fuente('asistencia_registros')) <> '{lat,lng,device_hash}' then raise exception 'FALLO: columnas sensibles de asistencia'; end if;
  if (select grupo from public.export_fuente('exam_intervals; drop table x')) is not null then raise exception 'FALLO: fuente inventada'; end if;
  -- la tabla real de cada fuente existe
  for f in select x, (public.export_fuente(x)).tabla_real t from unnest(array['examen_config', 'examen_sesiones', 'examen_eventos', 'examen_tramos']) x loop
    if to_regclass('public.' || f.t) is null then raise exception 'FALLO: no existe %', f.t; end if;
  end loop;
  if has_function_privilege('authenticated', 'public.export_fuente(text)', 'execute') then raise exception 'FALLO: export_fuente expuesta'; end if;
end $$;
select 'exportar_motor_examen.sql: PRUEBAS PASARON' as resultado;
rollback;
