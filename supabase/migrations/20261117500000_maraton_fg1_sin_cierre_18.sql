-- Maratón FG1: la jornada ya no se cierra al llegar a 18 respuestas (decisión del profesor, 17-nov-2026, 23:10; rige
-- en cuanto se aplica, también para la jornada en curso).
--
-- intentos_max pasa de 18 a 30, el mismo valor que el máximo de problemas presentados (la configuración no admite que
-- sea mayor): como cada respuesta es un problema presentado, el límite de respuestas deja de actuar por sí mismo.
-- Sigue la regla de los 30 problemas presentados (llegar a 30 sin completar la jornada deja fuera del maratón) y la de
-- los 5 aciertos, que ahora se calcula con lo que queda hasta 30 (antes, hasta 18 respuestas).
-- Nada retroactivo: las jornadas ya cerradas no cambian.

update public.maraton_actividades
   set config = jsonb_set(coalesce(config, '{}'::jsonb), '{carga}', coalesce(config -> 'carga', '{}'::jsonb) || '{"intentos_max": 30}'::jsonb),
       updated_at = now()
 where id = 'f9a7a700-0000-4000-8000-000000000001';

-- la configuración resultante sigue siendo válida
do $$ declare e text[]; begin
  select public.maraton_config_errores(public.maraton_cfg(config)) into e from public.maraton_actividades where id = 'f9a7a700-0000-4000-8000-000000000001';
  if coalesce(array_length(e, 1), 0) > 0 then raise exception 'Configuración de FG1 no válida: %', array_to_string(e, ' '); end if;
end $$;
