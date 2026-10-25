-- =============================================================================
-- Aula Virtual · 8. Datos: asignaturas Física General I y III y las cuatro secciones de clase
-- =============================================================================
-- Migración de DATOS idempotente (no duplica si se ejecuta dos veces). Cada sección recibe automáticamente
-- su clave (classes.join_code). Profesor de las secciones y equipo docente de las asignaturas: el administrador.

insert into public.courses (code, title, description)
select v.code, v.title, v.description
from (values
  ('FIS-GEN-1', 'Física General I', 'Física General I. Contenido en preparación.'),
  ('FIS-GEN-3', 'Física General III', 'Física General III. Contenido en preparación.')
) as v(code, title, description)
where not exists (select 1 from public.courses c where c.code = v.code);

-- los administradores forman parte del equipo docente de todas las asignaturas
insert into public.course_staff (course_id, user_id)
select c.id, p.id from public.courses c cross join public.profiles p where p.role = 'admin'
on conflict do nothing;

-- secciones (el disparador classes_add_creator añade a created_by como profesor de la sección)
insert into public.classes (course_id, name, term, created_by)
select c.id, v.name, '', (select p.id from public.profiles p where p.role = 'admin' order by p.created_at limit 1)
from (values
  ('FIS-BASICA', 'Física Básica'),
  ('FIS-GEN-1', 'Física General 1-A'),
  ('FIS-GEN-1', 'Física General 1'),
  ('FIS-GEN-3', 'Física General 3')
) as v(code, name)
join public.courses c on c.code = v.code
where not exists (select 1 from public.classes x where x.name = v.name and x.course_id = c.id);
