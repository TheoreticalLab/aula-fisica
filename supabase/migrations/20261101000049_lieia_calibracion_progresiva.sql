-- =============================================================================
-- LIEIA · calibración progresiva y funcionamiento diferencial.
--
-- 1) item_calibration_history: cada vez que se guarda una calibración (item_calibrations, función calibration_save ya
--    existente) se conserva una VERSIÓN con sus parámetros, errores típicos, tamaño muestral, método, fecha y autor.
--    Así la calibración mejora con cada aplicación sin perder las anteriores. El disparador nunca bloquea el guardado.
--    Se copian las calibraciones actuales como primera versión. Solo datos reales: las simulaciones no se guardan aquí.
-- 2) lieia_exam_groups: subgrupo de la sección de cada estudiante del examen, con el MISMO seudónimo que
--    lieia_exam_data (sin nombres), para estudiar el funcionamiento diferencial de las preguntas (DIF) entre subgrupos.
-- Aditiva: tabla, disparador y funciones nuevas. No cambia calibration_save ni lieia_exam_data.
-- =============================================================================

create table if not exists public.item_calibration_history (
  id bigint generated always as identity primary key,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  a double precision not null, b double precision not null, se_a double precision not null, se_b double precision not null,
  beta_t double precision, sigma_t double precision,
  n_resp integer not null, n_tiempos integer not null default 0,
  estado text not null, metodo text not null,
  calibrated_at timestamptz not null, calibrated_by uuid references public.profiles (id) on delete set null,
  registrada_at timestamptz not null default now()
);
create index if not exists item_calibration_history_ej on public.item_calibration_history (exercise_id, calibrated_at);
alter table public.item_calibration_history enable row level security;
revoke all on public.item_calibration_history from anon, authenticated;

create or replace function public.item_calibration_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    insert into public.item_calibration_history (exercise_id, a, b, se_a, se_b, beta_t, sigma_t, n_resp, n_tiempos, estado, metodo, calibrated_at, calibrated_by)
      values (new.exercise_id, new.a, new.b, new.se_a, new.se_b, new.beta_t, new.sigma_t, new.n_resp, new.n_tiempos, new.estado, new.metodo, new.calibrated_at, new.calibrated_by);
  exception when others then null;   -- el historial nunca impide guardar la calibración
  end;
  return null;
end;
$$;
revoke all on function public.item_calibration_version() from public, anon, authenticated;
drop trigger if exists item_calibrations_version on public.item_calibrations;
create trigger item_calibrations_version after insert or update on public.item_calibrations
  for each row execute function public.item_calibration_version();

-- primera versión: las calibraciones que ya existen (solo si aún no tienen historial)
insert into public.item_calibration_history (exercise_id, a, b, se_a, se_b, beta_t, sigma_t, n_resp, n_tiempos, estado, metodo, calibrated_at, calibrated_by)
  select c.exercise_id, c.a, c.b, c.se_a, c.se_b, c.beta_t, c.sigma_t, c.n_resp, c.n_tiempos, c.estado, c.metodo, c.calibrated_at, c.calibrated_by
  from public.item_calibrations c
  where not exists (select 1 from public.item_calibration_history h where h.exercise_id = c.exercise_id);

create or replace function public.calibration_history(p_course uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.course_assert_teacher(p_course);
  return (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', h.exercise_id, 'a', h.a, 'b', h.b, 'se_a', h.se_a, 'se_b', h.se_b,
      'n_resp', h.n_resp, 'estado', h.estado, 'metodo', h.metodo, 'calibrated_at', h.calibrated_at) order by h.exercise_id, h.calibrated_at, h.id), '[]'::jsonb)
    from public.item_calibration_history h join public.exercises e on e.id = h.exercise_id where e.course_id = p_course);
end;
$$;

-- Subgrupo de cada estudiante con el mismo seudónimo que lieia_exam_data (misma regla de selección y de orden).
create or replace function public.lieia_exam_groups(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid := public.lieia_assert(p_activity);
begin
  return (
    with intentos as (
      select distinct on (t.user_id) t.* from public.attempts t
      join public.profiles p on p.id = t.user_id and p.role = 'student'
      where t.activity_id = p_activity and t.status = 'submitted'
      order by t.user_id, t.attempt_number, t.started_at
    ), seud as (
      select i.user_id, 'E' || lpad(row_number() over (order by md5(i.user_id::text || p_activity::text))::text, 2, '0') seudonimo from intentos i
    )
    select coalesce(jsonb_agg(jsonb_build_object('seudonimo', s.seudonimo, 'grupo', g.name) order by s.seudonimo), '[]'::jsonb)
    from seud s
    left join public.enrollments e on e.class_id = v_class and e.user_id = s.user_id
    left join public.class_groups g on g.id = e.group_id
  );
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['calibration_history(uuid)', 'lieia_exam_groups(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
