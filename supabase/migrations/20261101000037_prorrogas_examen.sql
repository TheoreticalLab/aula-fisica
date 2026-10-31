-- =============================================================================
-- Motor de examen · prórrogas individuales. El profesorado de la sección puede dar minutos extra a un intento
-- en curso (conexión caída, adaptación, incidencia). Quedan registradas (quién, cuánto, cuándo).
--
-- Aditiva: una columna nueva con valor por defecto (exam_sessions.extra_s), una tabla nueva de registro, una función
-- nueva (exam_extend) y dos redefinidas, copiadas de la migración 35 con un único cambio cada una:
--   exam_deadline: suma extra_s a la duración (sin pasar nunca del cierre de la actividad)
--   exam_monitor:  devuelve extra_s
-- =============================================================================

alter table public.exam_sessions add column if not exists extra_s integer not null default 0;

create table if not exists public.exam_extensions (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  teacher_id uuid references public.profiles (id) on delete set null,
  segundos integer not null check (segundos between 60 and 7200),
  motivo text check (motivo is null or char_length(motivo) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists exam_extensions_attempt_idx on public.exam_extensions (attempt_id);
alter table public.exam_extensions enable row level security;
revoke all on public.exam_extensions from anon, authenticated;

-- exam_deadline (migración 35) + prórroga
create or replace function public.exam_deadline(p_attempt uuid)
returns timestamptz
language plpgsql stable security definer set search_path = ''
as $$
declare s public.exam_sessions; a public.attempts; v_cierre timestamptz; v_lim timestamptz; v_pausa bigint := 0;
begin
  select * into s from public.exam_sessions where attempt_id = p_attempt;
  select * into a from public.attempts where id = p_attempt;
  if a.id is null then return null; end if;
  select closes_at into v_cierre from public.activities where id = a.activity_id;
  if s.attempt_id is null or s.duracion_s is null then return v_cierre; end if;
  if s.pausa_detiene_reloj then
    v_pausa := least(s.pausa_max_total_s::bigint * 1000,
      s.pausas_ms + case when s.pausa_desde is null then 0 else public.exam_ms(now()) - public.exam_ms(s.pausa_desde) end);
  end if;
  v_lim := a.started_at + make_interval(secs => s.duracion_s + s.extra_s) + make_interval(secs => v_pausa / 1000.0);
  return case when v_cierre is null then v_lim else least(v_lim, v_cierre) end;
end;
$$;

-- Dar minutos extra a un intento en curso (solo el profesorado de su sección)
create or replace function public.exam_extend(p_attempt uuid, p_minutos integer, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a public.attempts; v_class uuid; s public.exam_sessions;
begin
  select * into a from public.attempts where id = p_attempt;
  if not found then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  select class_id into v_class from public.activities where id = a.activity_id;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then raise exception 'El intento ya fue entregado' using errcode = 'P0001'; end if;
  select * into s from public.exam_sessions where attempt_id = p_attempt for update;
  if not found then raise exception 'Este intento no tiene sesión de examen' using errcode = 'P0001'; end if;
  if s.duracion_s is null then raise exception 'Este examen no tiene límite de tiempo' using errcode = 'P0001'; end if;
  if p_minutos is null or p_minutos < 1 or p_minutos > 120 then raise exception 'La prórroga debe ser de 1 a 120 minutos' using errcode = '22023'; end if;
  if s.extra_s + p_minutos * 60 > 21600 then raise exception 'Prórroga total demasiado grande (máximo 6 horas)' using errcode = '22023'; end if;
  update public.exam_sessions set extra_s = extra_s + p_minutos * 60 where attempt_id = p_attempt;
  insert into public.exam_extensions (attempt_id, teacher_id, segundos, motivo) values (p_attempt, auth.uid(), p_minutos * 60, left(nullif(trim(p_motivo), ''), 200));
  return jsonb_build_object('extra_s', s.extra_s + p_minutos * 60, 'limite_ms', public.exam_ms(public.exam_deadline(p_attempt)));
end;
$$;

-- exam_monitor (migración 35) + extra_s
create or replace function public.exam_monitor(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'ahora_ms', public.exam_ms(now()),
    'inscritos', (select count(*) from public.enrollments e where e.class_id = act.class_id),
    'entregados', (select count(distinct a.user_id) from public.attempts a where a.activity_id = p_activity and a.status = 'submitted'),
    'en_curso', (select coalesce(jsonb_agg(jsonb_build_object(
        'attempt_id', a.id, 'nombre', p.full_name,
        'pregunta', array_position(public.exam_item_order(a.id), s.activa), 'total', cardinality(public.exam_item_order(a.id)),
        'respondidas', (select count(*) from public.responses r where r.attempt_id = a.id and r.answer <> '{}'::jsonb),
        'en_pausa', s.pausa_desde is not null, 'pausas', s.pausas_n,
        'ultimo_contacto_ms', public.exam_ms(s.ultimo_contacto), 'limite_ms', public.exam_ms(public.exam_deadline(a.id)),
        'inicio_ms', public.exam_ms(a.started_at), 'extra_s', s.extra_s) order by p.full_name), '[]'::jsonb)
      from public.attempts a join public.exam_sessions s on s.attempt_id = a.id join public.profiles p on p.id = a.user_id
      where a.activity_id = p_activity and a.status = 'in_progress'));
end;
$$;

do $$
begin
  execute 'revoke all on function public.exam_deadline(uuid) from public, anon, authenticated';
  execute 'revoke all on function public.exam_extend(uuid, integer, text) from public, anon';
  execute 'grant execute on function public.exam_extend(uuid, integer, text) to authenticated';
end $$;
