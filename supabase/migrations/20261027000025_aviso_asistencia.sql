-- =============================================================================
-- Aviso de asistencia abierta: el aula del estudiante pregunta si alguna de SUS secciones tiene la asistencia
-- abierta (código vigente) y si ya está presente, para mostrarle «Marcar presente». Nunca devuelve el código.
-- Aditiva: una función nueva de solo lectura.
-- =============================================================================

create or replace function public.my_open_attendance()
returns table (session_id uuid, clase text, asignatura text, code_expires_at timestamptz, presente boolean)
language sql stable security definer set search_path = ''
as $$
  select s.id, c.name, co.title, s.code_expires_at,
    exists (select 1 from public.attendance_records r where r.session_id = s.id and r.user_id = auth.uid())
  from public.attendance_sessions s
  join public.enrollments e on e.class_id = s.class_id and e.user_id = auth.uid()
  join public.classes c on c.id = s.class_id join public.courses co on co.id = c.course_id
  where s.closed_at is null and s.code_expires_at > now() and public.my_account_ok()
  order by s.opened_at desc
$$;

revoke all on function public.my_open_attendance() from public, anon;
grant execute on function public.my_open_attendance() to authenticated;
