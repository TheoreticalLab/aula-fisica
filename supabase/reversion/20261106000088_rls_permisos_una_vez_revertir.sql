-- =============================================================================
-- REVERSIÓN de la migración 88 (RLS de contenido con permisos calculados una vez)
-- =============================================================================
-- Restaura literalmente las políticas SELECT de courses y lessons (migración 2), units (migración 11) y concepts
-- (migración 71), y las de escritura «for all» de units, lessons y concepts (migración 2). Las funciones
-- mis_cursos_inscritos(), mis_cursos_staff() y mis_unidades_visibles() pueden quedarse: no las usa nadie más y solo
-- devuelven lo que el propio usuario ya puede leer.
-- No borra ni modifica datos. Se aplica como una migración nueva (copiándola a supabase/migrations con una marca de
-- tiempo mayor) por el flujo normal: respaldo → probar → plan → autorización → aplicar.

set local lock_timeout = '5s';   -- si no obtiene el bloqueo en 5 s, falla y se deshace (no deja lecturas en cola)

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated
  using (public.is_teacher() or public.is_enrolled_course(id));

drop policy if exists units_select on public.units;
create policy units_select on public.units for select to authenticated
  using (public.is_teacher() or (not hidden and status = 'publicado' and public.is_enrolled_course(course_id)));

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
  using (public.is_teacher() or public.lesson_visible_to_me(id));

drop policy if exists concepts_select on public.concepts;
create policy concepts_select on public.concepts for select to authenticated
  using (public.is_teacher() or (public.is_enrolled_course(course_id) and not hidden));

-- políticas de escritura (migración 2)
drop policy if exists units_write on public.units;
create policy units_write on public.units for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));
drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));
drop policy if exists concepts_write on public.concepts;
create policy concepts_write on public.concepts for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));
