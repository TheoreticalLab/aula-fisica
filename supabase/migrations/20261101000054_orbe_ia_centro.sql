-- =============================================================================
-- Orbe IA como centro de inteligencia artificial del aula (migración 54).
-- Orbe IA empezó como humor contextual y hoy también redacta mensajes, da el pulso de la clase, propone preguntas
-- relámpago (Orbe Control) e interpreta exámenes en LIEIA, con la misma configuración de gasto. El panel necesita ver
-- el consumo POR USO. Se redefine orbe_ia_admin_get (copia de la migración 30) añadiendo:
--   - consumo[].purpose (para qué fue cada llamada; la columna existe desde la migración 33)
--   - estadisticas.por_proposito: llamadas, llamadas reales, gasto y tokens del mes por uso
-- Solo lectura y aditiva: no cambia datos ni permisos (create or replace conserva los grant).
-- =============================================================================

create or replace function public.orbe_ia_admin_get()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_mes timestamptz := date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
        v_hoy timestamptz := date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
begin
  perform public.orbe_ia_assert_admin();
  return jsonb_build_object(
    'config', (select to_jsonb(c) - 'id' from public.orbe_ia_config c where c.id = 1),
    'cursos', (select coalesce(jsonb_agg(jsonb_build_object('course_id', co.id, 'titulo', co.title, 'archivada', co.archived,
        'enabled', coalesce(oc.enabled, false), 'all_lessons', coalesce(oc.all_lessons, false), 'lessons', coalesce(to_jsonb(oc.lessons), '[]'::jsonb),
        'pendientes', (select count(*) from public.orbe_ia_jokes j where j.course_id = co.id and j.status = 'pendiente'),
        'aprobados', (select count(*) from public.orbe_ia_jokes j where j.course_id = co.id and j.status = 'aprobado'))
        order by co.archived, co.title), '[]'::jsonb)
      from public.courses co left join public.orbe_ia_courses oc on oc.course_id = co.id),
    'estadisticas', jsonb_build_object(
      'chistes', (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb) from (select status, count(*) n from public.orbe_ia_jokes group by status) s),
      'mostrados', (select count(*) from public.orbe_ia_deliveries),
      'mostrados_7d', (select count(*) from public.orbe_ia_deliveries where shown_at > now() - interval '7 days'),
      'estudiantes_alcanzados', (select count(distinct user_id) from public.orbe_ia_deliveries),
      'cerrados_al_instante', (select count(*) from public.orbe_ia_deliveries where closed_at < shown_at + interval '3 seconds'),
      'no_mostrar_mas', (select count(*) from public.orbe_ia_deliveries where action = 'no_mostrar_mas'),
      'estudiantes_desactivados', (select count(*) from public.orbe_ia_prefs where disabled),
      'gasto_mes_usd', (select coalesce(sum(cost_usd), 0) from public.orbe_ia_usage where created_at >= v_mes and not simulated and status = 'ok'),
      'tokens_mes', (select jsonb_build_object('entrada', coalesce(sum(input_tokens), 0), 'salida', coalesce(sum(output_tokens), 0))
                     from public.orbe_ia_usage where created_at >= v_mes and not simulated),
      'llamadas_hoy', (select count(*) from public.orbe_ia_usage where created_at >= v_hoy),
      'llamadas_reales_mes', (select count(*) from public.orbe_ia_usage where created_at >= v_mes and not simulated),
      'errores_mes', (select count(*) from public.orbe_ia_usage where created_at >= v_mes and status = 'error'),
      'por_proposito', (select coalesce(jsonb_object_agg(x.purpose, jsonb_build_object('llamadas', x.llamadas, 'reales', x.reales,
          'gasto_usd', x.gasto, 'tokens', x.tokens, 'errores', x.errores, 'ultima', x.ultima)), '{}'::jsonb)
        from (select u.purpose, count(*) llamadas, count(*) filter (where not u.simulated) reales,
                     coalesce(sum(u.cost_usd) filter (where not u.simulated and u.status = 'ok'), 0) gasto,
                     coalesce(sum(u.input_tokens + u.output_tokens) filter (where not u.simulated), 0) tokens,
                     count(*) filter (where u.status = 'error') errores, max(u.created_at) ultima
              from public.orbe_ia_usage u where u.created_at >= v_mes group by u.purpose) x)),
    'consumo', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select u.id, u.created_at, u.trigger, u.model, u.simulated, u.status, u.input_tokens, u.output_tokens, u.cost_usd,
             u.jokes_generated, u.jokes_rejected, u.error_code, u.section, u.apartado, u.evento, l.title leccion, u.purpose
      from public.orbe_ia_usage u left join public.lessons l on l.id = u.lesson_id order by u.created_at desc limit 60) x)
  );
end;
$$;
