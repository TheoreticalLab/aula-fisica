-- =============================================================================
-- Orden aleatorio de las opciones en las preguntas de selección (opcional por actividad; apagado por defecto).
--
-- El barajado es SOLO de presentación y se hace en el navegador, determinista por intento y pregunta (al recargar, el
-- mismo orden). Cada opción conserva su letra original y la respuesta se guarda con los índices originales: la
-- calificación, las claves, las explicaciones que citan letras, la revisión docente y LIEIA no cambian.
-- Las preguntas cuyas opciones dependen de la posición («todas las anteriores», «a y b»…) no se barajan (navegador).
-- Aditiva: columna con valor por defecto y una función de consulta.
-- =============================================================================

alter table public.activities add column if not exists shuffle_options boolean not null default false;

-- ¿Baraja opciones esta actividad? Para el profesorado de la sección y los estudiantes inscritos.
create or replace function public.opciones_aleatorias(p_activity uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select a.shuffle_options from public.activities a
    where a.id = p_activity
      and (public.is_class_teacher(a.class_id) or exists (select 1 from public.enrollments e where e.class_id = a.class_id and e.user_id = auth.uid()))), false)
$$;

revoke all on function public.opciones_aleatorias(uuid) from public, anon;
grant execute on function public.opciones_aleatorias(uuid) to authenticated;
