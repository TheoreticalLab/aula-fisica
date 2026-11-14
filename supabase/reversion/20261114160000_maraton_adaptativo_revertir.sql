-- =============================================================================
-- REVERSIÓN de la migración 94 (Maratón adaptativo). Solo para usar ANTES de que haya participantes: si existen filas
-- en maraton_inscripciones / maraton_presentaciones, borrar las tablas perdería el historial de los estudiantes.
-- Alternativa no destructiva (recomendada si ya hubo participación): archivar los maratones desde el configurador y
-- dejar las tablas; nada del resto del aula depende de ellas.
-- Se aplica como una migración nueva (copiándola a supabase/migrations con una marca de tiempo mayor) y, como toda
-- migración, con la aprobación del administrador. Antes: npm run respaldo.
-- =============================================================================
do $$ begin
  if exists (select 1 from public.maraton_inscripciones where not prueba) then
    raise exception 'Hay participantes en algún maratón: no se revierte (archive los maratones en su lugar)';
  end if;
end $$;

-- funciones (todas las del maratón empiezan por maraton_ o svc_maraton_)
do $$ declare f record; begin
  for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'maraton\_%' or p.proname like 'svc\_maraton\_%') loop
    execute format('drop function if exists %s cascade', f.firma);
  end loop;
end $$;

-- @destructivo-autorizado: reversión de tablas nuevas de la migración 94 sin participantes
drop table if exists public.maraton_incidencias, public.maraton_eventos, public.maraton_presentaciones, public.maraton_jornadas,
  public.maraton_inscripciones, public.maraton_actividades, public.maraton_claves, public.maraton_variantes, public.maraton_plantillas,
  public.maraton_temas, public.maraton_bancos;
