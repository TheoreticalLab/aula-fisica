-- Maratón FG1: vía B de 150 min y sin tope de 90 min, desde la jornada 3 (decisión del profesor, 17-nov-2026, 22:40).
--
-- Con la progresión avanzada, quien llega a D7–D9 tarda tanto por problema que el tope de 90 min cerraba su jornada
-- antes de las 8 respuestas (jornada 2: 5 aciertos, 7 respuestas y 105 min → cerrada por límite). El profesor decide:
--   · sin tope de tiempo por jornada: limite_minutos = 600 (el máximo que admite la configuración; 10 h de trabajo
--     acreditado, inalcanzable en un día de clase). Siguen los otros límites: 18 respuestas y 30 problemas presentados.
--   · vía B: 5 aciertos + 8 respuestas + al menos 150 min de trabajo (antes 60 min).
--   · vía A sin cambios (5 aciertos + 12 unidades, nunca antes de 30 min). Duración orientativa: 60–150 min.
-- Sin el tope, una jornada que no se completa al cierre del día queda incompleta (y la continuidad deja fuera), salvo
-- que llegue a 18 respuestas o 30 problemas (cierre por límite, en revisión).
-- Rige desde la jornada 3: la migración se niega a aplicarse en producción antes de las 00:03 del 18-nov (jornada 2
-- cerrada, con su gracia de 2 min). Nada retroactivo: las jornadas ya cerradas no cambian.
-- La configuración de FG1 está bloqueada en el editor porque ya hay participantes; este cambio lo hace la migración por
-- decisión expresa del profesor. También se actualiza la línea de duración de las instrucciones.

do $$ begin
  if current_database() = 'postgres' and now() < timestamptz '2026-11-18 00:03:00-04' then
    raise exception 'Esta migración rige desde la jornada 3: aplíquela después de las 00:03 del 18-nov-2026 (hora de Santo Domingo)';
  end if;
end $$;

update public.maraton_actividades
   set config = jsonb_set(coalesce(config, '{}'::jsonb), '{carga}', coalesce(config -> 'carga', '{}'::jsonb)
                 || '{"alternativa_minutos": 150, "alternativa_intentos": 8, "limite_minutos": 600, "objetivo_min": 60, "objetivo_max": 150}'::jsonb),
       instrucciones = replace(instrucciones,
         '- **Duración orientativa:** entre 60 y 75 minutos por jornada (como máximo, unos 90 minutos).',
         '- **Duración y requisitos (desde la jornada 3, 18-nov):** no hay tope de tiempo por jornada. Para completarla necesita al menos **5 ejercicios bien resueltos** y, además, **8 respuestas con al menos 150 minutos de trabajo**, o la cuota de trabajo del día (nunca antes de 30 minutos). Una jornada que no se completa al cierre del día queda sin completar.'),
       updated_at = now()
 where id = 'f9a7a700-0000-4000-8000-000000000001';

-- la configuración resultante sigue siendo válida
do $$ declare e text[]; begin
  select public.maraton_config_errores(public.maraton_cfg(config)) into e from public.maraton_actividades where id = 'f9a7a700-0000-4000-8000-000000000001';
  if coalesce(array_length(e, 1), 0) > 0 then raise exception 'Configuración de FG1 no válida: %', array_to_string(e, ' '); end if;
end $$;
