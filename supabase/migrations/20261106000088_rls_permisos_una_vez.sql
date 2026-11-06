-- =============================================================================
-- Migración 88 · Políticas RLS de lectura del contenido: los permisos se calculan UNA vez por consulta.
--
-- Problema (medido en una copia local): leer la lista de lecciones de una asignatura
-- costaba ~0,6 s por estudiante porque lessons_select evaluaba, FILA POR FILA, is_teacher() y lesson_visible_to_me(id),
-- y cada una vuelve a comprobar la cuenta (account_ok: perfil, regularización, inactividad). Con ~140 lecciones son
-- cientos de comprobaciones idénticas por consulta; con 15 estudiantes entrando a la vez, segundos de CPU de golpe.
--
-- Cambio: las mismas reglas, escritas para que PostgreSQL las calcule una vez por consulta:
--   · (select public.is_teacher())             → InitPlan: una evaluación por consulta (no depende de la fila);
--   · course_id in (select mis_cursos_inscritos()) ⇔ is_enrolled_course(course_id) (mismo conjunto: cuenta habilitada
--     y matrícula en una sección de la asignatura), calculado una vez;
--   · unit_id in (select mis_unidades_visibles()): la parte de lesson_visible_to_me que depende de la unidad (no oculta
--     y publicada), calculada una vez y limitada a lo que el usuario ya puede ver (sin fugas si se llama por RPC).
-- Tablas: courses, units, lessons, concepts: políticas SELECT y las de escritura «for all» de units, lessons y concepts
-- (que PostgreSQL también evalúa en cada SELECT). Las reglas no cambian: solo cuándo se calculan.
-- Equivalencia comprobada usuario por usuario sobre la copia de producción: supabase/pruebas/rls_permisos_una_vez.sql.
-- Aditiva: funciones nuevas y políticas recreadas en la misma migración. Reversión:
-- supabase/reversion/20261106000088_rls_permisos_una_vez_revertir.sql
-- =============================================================================

-- Recrear una política bloquea la tabla un instante: si otra consulta la retiene, mejor fallar (y deshacer la migración
-- entera, que va en una transacción) que dejar en cola todas las lecturas del aula detrás de este cambio.
set local lock_timeout = '5s';

-- Asignaturas en las que el usuario actual está matriculado (vacío si su cuenta no está habilitada).
-- Mismo criterio que is_enrolled_course(p): my_account_ok() y una matrícula en una sección de la asignatura.
create or replace function public.mis_cursos_inscritos()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct c.course_id
  from public.enrollments e join public.classes c on c.id = e.class_id
  where e.user_id = auth.uid() and (select public.my_account_ok())
$$;

-- Unidades (no ocultas y publicadas) de las lecciones no ocultas de mis asignaturas: exactamente las unidades de las
-- lecciones que lesson_visible_to_me deja ver. Es un CONJUNTO limitado a lo que el usuario ya puede leer, así que
-- llamarla directamente por RPC no revela nada nuevo (una función por unidad diría si CUALQUIER unidad está publicada).
create or replace function public.mis_unidades_visibles()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select u.id from public.units u
  where not u.hidden and u.status = 'publicado'
    and exists (select 1 from public.lessons l
                where l.unit_id = u.id and not l.hidden and l.course_id in (select public.mis_cursos_inscritos()))
$$;

-- Asignaturas en las que el usuario actual es personal docente (course_staff) con la cuenta habilitada. Mismo criterio
-- que la parte no administrativa de is_course_staff(p) vigente (migración 4): my_account_ok() y fila en course_staff.
create or replace function public.mis_cursos_staff()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select s.course_id from public.course_staff s where s.user_id = auth.uid() and (select public.my_account_ok())
$$;

-- courses (migración 2): is_teacher() or is_enrolled_course(id)
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated
  using ((select public.is_teacher()) or id in (select public.mis_cursos_inscritos()));

-- units (migración 11): is_teacher() or (not hidden and status = 'publicado' and is_enrolled_course(course_id))
drop policy if exists units_select on public.units;
create policy units_select on public.units for select to authenticated
  using ((select public.is_teacher()) or (not hidden and status = 'publicado' and course_id in (select public.mis_cursos_inscritos())));

-- lessons (migración 2): is_teacher() or lesson_visible_to_me(id)
--   lesson_visible_to_me(id) = not l.hidden and unidad no oculta y publicada and is_enrolled_course(l.course_id)
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
  using ((select public.is_teacher())
         or (not hidden and course_id in (select public.mis_cursos_inscritos()) and unit_id in (select public.mis_unidades_visibles())));

-- concepts (migración 71): is_teacher() or (is_enrolled_course(course_id) and not hidden)
drop policy if exists concepts_select on public.concepts;
create policy concepts_select on public.concepts for select to authenticated
  using ((select public.is_teacher()) or (course_id in (select public.mis_cursos_inscritos()) and not hidden));

-- Las políticas de ESCRITURA de units, lessons y concepts son «for all»: PostgreSQL también las evalúa en cada SELECT
-- (se combinan con OR), así que is_course_staff(course_id) se calculaba por fila. Misma regla, calculada una vez:
--   is_course_staff(p) = is_admin() or p ∈ mis_cursos_staff()
drop policy if exists units_write on public.units;
create policy units_write on public.units for all to authenticated
  using ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()))
  with check ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()));
drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons for all to authenticated
  using ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()))
  with check ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()));
drop policy if exists concepts_write on public.concepts;
create policy concepts_write on public.concepts for all to authenticated
  using ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()))
  with check ((select public.is_admin()) or course_id in (select public.mis_cursos_staff()));

revoke all on function public.mis_cursos_staff() from public, anon;
grant execute on function public.mis_cursos_staff() to authenticated;
revoke all on function public.mis_cursos_inscritos() from public, anon;
grant execute on function public.mis_cursos_inscritos() to authenticated;
revoke all on function public.mis_unidades_visibles() from public, anon;
grant execute on function public.mis_unidades_visibles() to authenticated;
