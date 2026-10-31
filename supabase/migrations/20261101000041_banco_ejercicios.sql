-- Banco de ejercicios (Unidad 9 «Física de los choques» y siguientes). Migración ADITIVA: no redefine ninguna función
-- existente ni toca datos de estudiantes.
--
-- 1. exercise_bank_meta: metadatos pedagógicos de cada ejercicio del banco (tema, conceptos previos, datos, magnitudes
--    pedidas, tipo de pregunta, tipo de choque, etapas, uso de fricción/energía/cinemática/planos, familia, validación
--    dimensional, parámetros). NO contiene respuestas. Solo lo lee el profesorado de la asignatura (como las claves);
--    lo escribe el instalador de la biblioteca (datos privados).
-- 2. svc_respuesta_etapa: para el ARRASTRE en problemas por etapas, la Edge Function «calificar» obtiene lo que el
--    mismo estudiante respondió, en el mismo intento, a la etapa anterior (mismo minicapítulo). Solo service_role.
-- 3. banco_rendimiento: rendimiento agregado por ejercicio del banco (sin identidades) para el panel docente.
--
-- Reversión: no hace falta borrar nada. Sin filas en exercise_bank_meta el panel no muestra el banco; la Edge Function
-- trata la ausencia de svc_respuesta_etapa como «sin arrastre».

-- 1 ----------------------------------------------------------------------------------------------------------------
create table if not exists public.exercise_bank_meta (
  exercise_id uuid primary key references public.exercises (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  meta jsonb not null,
  updated_at timestamptz not null default now(),
  constraint exercise_bank_meta_objeto check (jsonb_typeof(meta) = 'object')
);
create index if not exists exercise_bank_meta_course_idx on public.exercise_bank_meta (course_id);
alter table public.exercise_bank_meta enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'exercise_bank_meta' and policyname = 'bank_meta_select_staff') then
    create policy bank_meta_select_staff on public.exercise_bank_meta for select to authenticated
      using (public.can_view_keys(course_id));
  end if;
end $$;

-- 2 ----------------------------------------------------------------------------------------------------------------
create or replace function public.svc_respuesta_etapa(p_user uuid, p_attempt uuid, p_exercise uuid, p_desde text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_texto text;
begin
  if not exists (select 1 from public.attempts a where a.id = p_attempt and a.user_id = p_user) then
    raise exception 'El intento no pertenece a este usuario' using errcode = '42501';
  end if;
  -- la etapa anterior debe estar en el MISMO minicapítulo y haber sido respondida en el MISMO intento
  select r.answer ->> 'text' into v_texto
  from public.exercises e
  join public.exercises d on d.course_id = e.course_id and d.lesson_id = e.lesson_id and d.slug = p_desde
  join public.responses r on r.exercise_id = d.id and r.attempt_id = p_attempt and r.user_id = p_user
  where e.id = p_exercise;
  return v_texto;
end;
$$;

-- 3 ----------------------------------------------------------------------------------------------------------------
create or replace function public.banco_rendimiento(p_course uuid)
returns table (exercise_id uuid, respuestas bigint, correctas bigint, primer_intento bigint, intentos_promedio numeric, errores jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_todo boolean := public.is_course_staff(p_course);
begin
  if not public.can_view_keys(p_course) then
    raise exception 'Solo el profesorado de la asignatura puede consultar el banco' using errcode = '42501';
  end if;
  -- el equipo de la asignatura ve todo; un profesor de sección, solo a sus estudiantes. Solo agregados.
  return query
  with r as (
    select x.exercise_id, x.status::text as estado, x.first_try_correct, x.tries, x.engine_code
    from public.responses x
    join public.exercise_bank_meta b on b.exercise_id = x.exercise_id
    where b.course_id = p_course and x.status <> 'draft' and (v_todo or public.teaches_student(x.user_id))
  )
  select r.exercise_id, count(*), count(*) filter (where r.estado = 'correct'), count(*) filter (where r.first_try_correct),
    round(avg(r.tries)::numeric, 2),
    coalesce((select jsonb_object_agg(c.engine_code, c.n)
              from (select r2.engine_code, count(*) as n from r r2
                    where r2.exercise_id = r.exercise_id and r2.engine_code is not null and r2.estado <> 'correct'
                    group by r2.engine_code) c), '{}'::jsonb)
  from r
  group by r.exercise_id;
end;
$$;

-- permisos ---------------------------------------------------------------------------------------------------------
do $$ begin
  execute 'revoke all on table public.exercise_bank_meta from anon, public';
  execute 'grant select on table public.exercise_bank_meta to authenticated';
  execute 'revoke all on function public.svc_respuesta_etapa(uuid, uuid, uuid, text) from public, anon, authenticated';
  execute 'grant execute on function public.svc_respuesta_etapa(uuid, uuid, uuid, text) to service_role';
  execute 'revoke all on function public.banco_rendimiento(uuid) from public, anon';
  execute 'grant execute on function public.banco_rendimiento(uuid) to authenticated';
end $$;
