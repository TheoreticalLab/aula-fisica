-- =============================================================================
-- PROPUESTA OPCIONAL · Migración 100 · Maratón: la rapidez deja de expulsar (pendiente de aprobación del profesor)
--
-- Regla actual (migración 98): resolver bien un problema de nivel 6 o superior en menos de 60 s (reloj del servidor)
-- deja al estudiante FUERA del maratón. Es una expulsión basada solo en la velocidad.
-- Con la migración 99, todo acierto en D6 lleva de inmediato a un problema encadenado (D7) y una respuesta anticipada
-- hace que el problema ordinario siguiente lleve una comprobación de razonamiento: la rapidez ya ADAPTA la exigencia.
-- Esta propuesta desactiva la expulsión en los valores predeterminados (fuera_rapido_nivel = null). La señal se
-- conserva para el profesor: la presentación queda «anticipada» y el informe muestra «aciertos en D5 o superior con
-- menos de la mitad del tiempo mínimo». Un maratón que guarde su propia regla en la configuración no cambia; el de
-- FG1 no la guarda, así que se le aplicaría. No toca jornadas, presentaciones ni estudiantes ya fuera (para esos, la
-- reincorporación con motivo).
-- =============================================================================
set local lock_timeout = '5s';

create or replace function public.maraton_defaults() returns jsonb
language sql immutable set search_path = '' as $$
  select '{
    "programacion": {"jornadas": 14, "modo": "consecutivas", "calendario": [], "hora_inicio": "00:00",
                     "apertura": "00:00", "cierre": "23:59", "zona": "America/Santo_Domingo"},
    "carga": {"cuota": 12, "alternativa_activa": true, "alternativa_minutos": 60, "alternativa_intentos": 8,
              "objetivo_min": 60, "objetivo_max": 75, "limite_minutos": 90, "intentos_max": 18, "presentados_max": 30,
              "fraccion_fallo": 0.5, "minutos_minimos": 30},
    "permanencia": {"min_correctas": 5, "fuera_por_presentados": true, "fuera_por_continuidad": true,
                    "fuera_rapido_nivel": null, "fuera_rapido_segundos": 60},
    "avanzado": {"activo": true, "pesos": [1.00, 1.00, 1.00], "comprobacion_porcentaje": 10, "comprobacion_tras_anticipada": 100,
                 "comprobacion_segundos": 60},
    "dificultad": {"niveles": 6, "nivel_inicial": 2, "adaptativa": true, "pesos": [1.00, 1.20, 1.40, 1.50, 1.00, 1.00],
                   "ascenso": 1, "descenso": 1, "descenso_no_puedo": 1, "nivel_al_iniciar_jornada": "continuar",
                   "t_min_factor": 1.0, "t_min_nivel_s": null},
    "comodines": {"total": 10, "por_jornada": null, "no_puedo": true},
    "contenido": {"temas": null, "excluir_plantillas": [], "distribucion": {}},
    "informes": {"estudiante": true, "docente": true, "publicacion_estudiante": null,
                 "exportaciones": ["pdf", "csv", "xlsx"], "indicadores": true},
    "seguridad": {"retroalimentacion": "ninguna", "gracia_s": 120, "reanudacion": true}
  }'::jsonb
$$;

revoke all on function public.maraton_defaults() from public, anon, authenticated;
