-- =============================================================================
-- Prácticas de Control: política también para prácticas YA ENTREGADAS, con aviso previo al control (migración 63).
-- Decisión del profesor: lo que importa es que el estudiante conozca la regla ANTES DE HACER el control.
--  · control_policies.alcance: 'nuevas' (como en la 62: se aplica a quien entrega después del anuncio) o 'todas'
--    (también a entregas anteriores, pero SOLO en controles iniciados al menos anticipacion_horas después del anuncio).
--  · Al anunciar, opcionalmente se publica un aviso fijado en la sección (announcements, migración 9).
--  · La política se evalúa por control (control_politica_sesion). Con varios controles cuenta el más favorable
--    al estudiante (control_mejor): una regla agregada única, sin descuentos encadenados.
--  · Corrección de un defecto de la 62: al anunciar una versión nueva, la anterior quedaba «inactiva» y dejaba de
--    aplicarse también a quien entregó bajo ella. Las versiones son inmutables: «activa» solo indica la vigente para
--    las entregas y controles nuevos; las anteriores siguen aplicándose a quien le corresponden.
-- control_live, control_practicas y control_aviso se copian de la 62 con el cambio. Aditiva.
-- =============================================================================

alter table public.control_policies add column if not exists alcance text not null default 'nuevas';
alter table public.control_policies add column if not exists anticipacion_horas integer not null default 24;
alter table public.control_policies add column if not exists aviso_id uuid references public.announcements (id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'control_policies_alcance_check') then
    alter table public.control_policies add constraint control_policies_alcance_check check (alcance in ('nuevas', 'todas'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'control_policies_anticipacion_check') then
    alter table public.control_policies add constraint control_policies_anticipacion_check check (anticipacion_horas between 0 and 336);
  end if;
end $$;

-- Política que rige UN control de un estudiante (la última versión cuyas condiciones se cumplen)
create or replace function public.control_politica_sesion(p_session uuid, p_user uuid)
returns public.control_policies
language sql stable security definer set search_path = ''
as $$
  select p.* from public.control_sessions s
  join public.control_policies p on p.activity_id = s.practice_activity_id
  where s.id = p_session and (
    (p.alcance = 'nuevas' and p.announced_at <= (select min(t.submitted_at) from public.attempts t
                                                 where t.activity_id = s.practice_activity_id and t.user_id = p_user and t.status = 'submitted'))
    -- retroactiva: solo controles iniciados con la antelación anunciada y MIENTRAS era la versión vigente
    or (p.alcance = 'todas' and s.iniciado_at is not null and p.announced_at + make_interval(hours => p.anticipacion_horas) <= s.iniciado_at
        and not exists (select 1 from public.control_policies q where q.activity_id = p.activity_id and q.announced_at > p.announced_at and q.announced_at <= s.iniciado_at)))
  order by p.announced_at desc limit 1
$$;

-- Control más favorable con política aplicable: (factor, C, w, versión, sesión)
create or replace function public.control_mejor(p_activity uuid, p_user uuid)
returns table (factor numeric, c numeric, w numeric, version integer, session_id uuid)
language sql stable security definer set search_path = ''
as $$
  select 1 - p.w * (1 - least(1, greatest(0, t.score / nullif(t.max_score, 0)))), t.score / nullif(t.max_score, 0), p.w, p.version, s.id
  from public.control_sessions s
  join public.control_assignments a on a.session_id = s.id and a.user_id = p_user
  join public.attempts t on t.id = a.attempt_id
  cross join lateral public.control_politica_sesion(s.id, p_user) p
  where s.practice_activity_id = p_activity and s.estado in ('activo', 'cerrado')
    and a.estado = 'elegible' and a.confirmado_at is not null and a.incidencia is null
    and t.status = 'submitted' and not t.needs_review and t.max_score > 0 and p.id is not null
  order by 1 desc, 2 desc limit 1
$$;

-- control_factor (62): ahora por control, con su política
create or replace function public.control_factor(p_activity uuid, p_user uuid)
returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare f numeric;
begin
  if not exists (select 1 from public.control_sessions s where s.practice_activity_id = p_activity) then return 1; end if;
  select m.factor into f from public.control_mejor(p_activity, p_user) m;
  return coalesce(f, 1);
end;
$$;

-- control_resultado (62): el resultado que fija la nota; si ninguno tiene política aplicable, el mejor confirmado (diagnóstico)
create or replace function public.control_resultado(p_activity uuid, p_user uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce((select m.c from public.control_mejor(p_activity, p_user) m),
    (select max(t.score / nullif(t.max_score, 0))
     from public.control_sessions s
     join public.control_assignments a on a.session_id = s.id and a.user_id = p_user
     join public.attempts t on t.id = a.attempt_id
     where s.practice_activity_id = p_activity and s.estado in ('activo', 'cerrado')
       and a.estado = 'elegible' and a.confirmado_at is not null and a.incidencia is null
       and t.status = 'submitted' and not t.needs_review))
$$;

-- control_politica_aplicable (62): sin filtrar por «activa» (corrección) y, si ya hay un control que cuenta, su política
create or replace function public.control_politica_aplicable(p_activity uuid, p_user uuid)
returns public.control_policies
language sql stable security definer set search_path = ''
as $$
  select p.* from public.control_policies p
  where p.activity_id = p_activity and (
    p.version = (select m.version from public.control_mejor(p_activity, p_user) m)
    or (not exists (select 1 from public.control_mejor(p_activity, p_user)) and (
      (p.alcance = 'nuevas' and p.announced_at <= (select min(t.submitted_at) from public.attempts t where t.activity_id = p_activity and t.user_id = p_user and t.status = 'submitted'))
      or (p.alcance = 'todas' and p.activa))))
  order by (p.version = (select m.version from public.control_mejor(p_activity, p_user) m)) desc nulls last, p.announced_at desc limit 1
$$;

-- Anunciar política con alcance, antelación mínima y aviso en la sección
create or replace function public.control_politica_anunciar(p_activity uuid, p_w numeric, p_duracion integer, p_condiciones text, p_politica_ayudas text,
  p_alcance text, p_anticipacion_horas integer, p_publicar_aviso boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities; v integer; r public.control_policies; v_aviso uuid; v_desde timestamptz; v_txt text;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if act.mode <> 'practice' then raise exception 'Las Prácticas de Control se vinculan a prácticas, no a evaluaciones' using errcode = 'P0001'; end if;
  if p_w is null or p_w < 0 or p_w > public.control_w_max() then raise exception 'La reducción máxima debe estar entre 0 %% y %s %%', round(100 * public.control_w_max()) using errcode = '22023'; end if;
  if p_duracion is null or p_duracion < 3 or p_duracion > 10 then raise exception 'La duración debe ser de 3 a 10 minutos' using errcode = '22023'; end if;
  if p_alcance is null or p_alcance not in ('nuevas', 'todas') then raise exception 'Alcance inválido' using errcode = '22023'; end if;
  if p_anticipacion_horas is null or p_anticipacion_horas < 0 or p_anticipacion_horas > 336 then raise exception 'La antelación debe ser de 0 a 336 horas' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('control_politica' || p_activity::text, 0));
  update public.control_policies set activa = false where activity_id = p_activity and activa;
  select coalesce(max(version), 0) + 1 into v from public.control_policies where activity_id = p_activity;
  v_desde := now() + make_interval(hours => p_anticipacion_horas);
  if coalesce(p_publicar_aviso, false) and p_w > 0 then
    v_txt := 'Habrá una Práctica de Control breve e individual (unos ' || p_duracion || ' minutos, en el aula) sobre la práctica «' || act.title || '». '
      || 'Su resultado podrá ajustar hasta un ' || round(100 * p_w) || ' % de la nota de esa práctica: nota final = nota × [1 − ' || to_char(p_w, 'FM0.00')
      || ' × (1 − control/100)]. Con 100/100 conservas tu nota. '
      || case when p_alcance = 'todas' then 'Se aplica también a quien ya la entregó, en los controles realizados a partir del '
              || to_char(v_desde at time zone 'America/Santo_Domingo', 'DD/MM/YYYY HH24:MI') || '. '
              else 'Se aplica a las entregas hechas desde este aviso. ' end
      || 'No afecta a ausencias justificadas ni a incidencias técnicas, y puedes pedir revisión. '
      || coalesce(nullif(trim(p_condiciones), ''), '');
    insert into public.announcements (class_id, title, body, pinned, visible_until, created_by)
      values (act.class_id, left('Práctica de Control: «' || act.title || '»', 140), left(v_txt, 4000), true, now() + interval '21 days', auth.uid())
      returning id into v_aviso;
  end if;
  insert into public.control_policies (activity_id, version, w, duracion_min, condiciones, politica_ayudas, created_by, alcance, anticipacion_horas, aviso_id)
    values (p_activity, v, round(p_w, 2), p_duracion, left(coalesce(p_condiciones, ''), 1500), left(coalesce(p_politica_ayudas, ''), 1000), auth.uid(),
            p_alcance, p_anticipacion_horas, v_aviso)
    returning * into r;
  return to_jsonb(r) || jsonb_build_object('efectiva_desde', v_desde,
    'entregas_previas', (select count(distinct t.user_id) from public.attempts t where t.activity_id = p_activity and t.status = 'submitted'));
end;
$$;

-- control_live (62) + política por control y fecha efectiva
create or replace function public.control_live(p_session uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.control_sessions; act public.activities; ctrl public.activities;
begin
  s := public.control_session_teacher(p_session);
  select * into act from public.activities where id = s.practice_activity_id;
  select * into ctrl from public.activities where id = s.control_activity_id;
  return jsonb_build_object(
    'session', to_jsonb(s) - 'client_id',
    'server_now', now(),
    'practica', jsonb_build_object('id', act.id, 'title', act.title, 'opens_at', act.opens_at, 'closes_at', act.closes_at, 'created_at', act.created_at,
      'curso', (select k.title from public.classes c join public.courses k on k.id = c.course_id where c.id = act.class_id),
      'seccion', (select c.name from public.classes c where c.id = act.class_id)),
    'control', jsonb_build_object('id', ctrl.id, 'opens_at', ctrl.opens_at, 'closes_at', ctrl.closes_at, 'published', ctrl.published),
    'politica', (select to_jsonb(p) - 'created_by' || jsonb_build_object('efectiva_desde', p.announced_at + make_interval(hours => p.anticipacion_horas))
                from public.control_policies p where p.activity_id = act.id and p.activa order by p.announced_at desc limit 1),
    'estudiantes', (select coalesce(jsonb_agg(x order by x ->> 'nombre'), '[]'::jsonb) from (
      select jsonb_build_object(
        'user_id', a.user_id, 'nombre', pr.full_name, 'estado_elegibilidad', a.estado, 'exencion', a.exencion, 'incidencia', a.incidencia,
        'presente', case when s.attendance_session_id is null then null else exists (select 1 from public.attendance_records r where r.session_id = s.attendance_session_id and r.user_id = a.user_id) end,
        'exercise_id', a.exercise_id, 'slug', e.slug, 'enunciado', left(e.prompt, 600), 'formato', e.format, 'tipo', a.tipo, 'competencia', a.competencia,
        'minutos', (a.seleccion ->> 'minutos')::numeric, 'seleccion', a.seleccion, 'extra_min', a.extra_min, 'extra_motivo', a.extra_motivo,
        'attempt_id', a.attempt_id, 'confirmado_at', a.confirmado_at,
        'resultado', case when t.status = 'submitted' then round(100 * t.score / nullif(t.max_score, 0), 1) end,
        'en_blanco', t.status = 'submitted' and exists (select 1 from public.responses r where r.attempt_id = t.id and (r.answer is null or r.answer = '{}'::jsonb or coalesce(trim(r.answer ->> 'text'), '') = '' and r.answer -> 'selected' is null and r.answer -> 'value' is null)),
        'limite', case when t.id is not null then public.exam_deadline(t.id) end,
        'estado', case
          when a.estado <> 'elegible' then a.estado
          when a.incidencia is not null then 'incidencia'
          when s.estado = 'cancelado' then 'cancelado'
          when t.id is null then case when s.estado = 'cerrado' then 'no_inicio' else 'pendiente_inicio' end
          when t.status = 'in_progress' then case when now() > public.exam_deadline(t.id) then 'tiempo_agotado' else 'en_desarrollo' end
          when t.needs_review then 'correccion_pendiente'
          when a.confirmado_at is not null then 'confirmado'
          else 'corregido' end,
        'nota_practica', (select round(100 * max(p.score / nullif(p.max_score, 0)), 1) from public.attempts p where p.activity_id = s.practice_activity_id and p.user_id = a.user_id and p.status = 'submitted'),
        'politica_aplicable', (select x.version from public.control_politica_sesion(s.id, a.user_id) x where x.id is not null and x.w > 0),
        'factor', round(public.control_factor(s.practice_activity_id, a.user_id), 4)) x
      from public.control_assignments a join public.profiles pr on pr.id = a.user_id
      left join public.exercises e on e.id = a.exercise_id left join public.attempts t on t.id = a.attempt_id
      where a.session_id = p_session) q));
end;
$$;


-- control_practicas (62) + alcance, antelación y fecha efectiva
create or replace function public.control_practicas(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'opens_at', a.opens_at, 'closes_at', a.closes_at, 'created_at', a.created_at,
      'curso', k.title, 'seccion', c.name,
      'entregaron', (select count(distinct t.user_id) from public.attempts t where t.activity_id = a.id and t.status = 'submitted'),
      'politica', (select jsonb_build_object('version', p.version, 'w', p.w, 'duracion_min', p.duracion_min, 'announced_at', p.announced_at,
                     'alcance', p.alcance, 'anticipacion_horas', p.anticipacion_horas, 'efectiva_desde', p.announced_at + make_interval(hours => p.anticipacion_horas))
                   from public.control_policies p where p.activity_id = a.id and p.activa order by p.announced_at desc limit 1),
      'abierta', (select s.id from public.control_sessions s where s.practice_activity_id = a.id and s.estado in ('preparado', 'activo'))) order by a.created_at desc), '[]'::jsonb)
    from public.activities a join public.classes c on c.id = a.class_id join public.courses k on k.id = c.course_id
    where a.class_id = p_class and a.mode = 'practice' and a.published
      and not exists (select 1 from public.control_sessions s2 where s2.control_activity_id = a.id));
end;
$$;


-- control_aviso (62) + alcance, antelación y fecha efectiva
create or replace function public.control_aviso(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities; p public.control_policies;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null then return null; end if;
  if not (public.activity_visible_to_me(p_activity) or public.is_class_teacher(act.class_id)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into p from public.control_policies where activity_id = p_activity and activa order by announced_at desc limit 1;
  if p.id is null or p.w = 0 then return null; end if;
  return jsonb_build_object('version', p.version, 'w', p.w, 'duracion_min', p.duracion_min, 'condiciones', p.condiciones,
    'alcance', p.alcance, 'anticipacion_horas', p.anticipacion_horas, 'efectiva_desde', p.announced_at + make_interval(hours => p.anticipacion_horas),
    'politica_ayudas', p.politica_ayudas, 'announced_at', p.announced_at,
    -- vínculo con la versión: la política que se aplicará a este estudiante (si ya entregó) y si se le aplica
    'aplicable_a_mi', (select to_jsonb(x) - 'created_by' from public.control_politica_aplicable(p_activity, auth.uid()) x where x.id is not null));
end;
$$;


revoke all on function public.control_politica_sesion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.control_mejor(uuid, uuid) from public, anon, authenticated;
revoke all on function public.control_politica_anunciar(uuid, numeric, integer, text, text, text, integer, boolean) from public, anon;
grant execute on function public.control_politica_anunciar(uuid, numeric, integer, text, text, text, integer, boolean) to authenticated;
