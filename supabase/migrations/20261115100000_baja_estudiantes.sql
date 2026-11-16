-- =============================================================================
-- Migración 95 · Baja de estudiantes de una sección (archivada y reversible).
--
-- Suspender (profiles.active) es una medida de la CUENTA, temporal: el estudiante sigue matriculado y sigue saliendo en
-- las listas. Dar de BAJA es una medida de la SECCIÓN: el estudiante deja de existir para ella. No aparece en la lista
-- de estudiantes, en «Pendientes de entregar» de una práctica, en el registro de calificaciones, en la asistencia, en
-- el tablero ni en ninguna otra lista, y él tampoco ve la sección.
--
-- Cómo: la fila de la matrícula se TRASLADA completa (grupo y fecha de matrícula incluidos) a matriculas_bajas y se
-- quita de enrollments. Las 112 funciones que construyen listas a partir de enrollments dejan de verlo sin tocarlas.
-- Intentos, respuestas, notas, asistencias y archivos NO se tocan: siguen en sus tablas y vuelven a verse si el
-- profesor lo reincorpora (la matrícula se restaura con su grupo y su fecha originales). Antes, «Dar de baja» borraba
-- la matrícula sin dejar copia; ahora no se pierde ninguna fila.
--  · Un estudiante dado de baja no puede volver a entrar con el código de la clase (disparador en enrollments).
--    Si el profesor lo matricula de nuevo por ID, cuenta como reincorporación.
--  · Si era monitor de la sección, deja de serlo.
--  · activity_stats deja fuera los intentos de los dados de baja (cifras de «Resultados» de una actividad).
-- =============================================================================

create table if not exists public.matriculas_bajas (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.class_groups (id) on delete set null,
  enrolled_at timestamptz not null,
  baja_at timestamptz not null default now(),
  baja_por uuid references public.profiles (id) on delete set null,
  motivo text not null default '' check (char_length(motivo) <= 300),
  reincorporada_at timestamptz,
  reincorporada_por uuid references public.profiles (id) on delete set null
);
create unique index if not exists matriculas_bajas_vigente on public.matriculas_bajas (class_id, user_id) where reincorporada_at is null;
create index if not exists matriculas_bajas_user_idx on public.matriculas_bajas (user_id);

alter table public.matriculas_bajas enable row level security;
create policy matriculas_bajas_select on public.matriculas_bajas for select to authenticated
  using (public.is_class_teacher(class_id));
-- sin políticas de escritura: solo las funciones de abajo escriben

-- ¿Está este estudiante dado de baja (sin reincorporar) en la sección?
create or replace function public.baja_vigente(p_class uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.matriculas_bajas b
                 where b.class_id = p_class and b.user_id = p_user and b.reincorporada_at is null)
$$;

-- Toda matrícula nueva pasa por aquí: un estudiante dado de baja no vuelve por su cuenta (código de clase); si lo
-- matricula un profesor de la sección o el servidor (alta por ID), es una reincorporación y la baja se cierra.
create or replace function public.matricula_respeta_baja()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.baja_vigente(new.class_id, new.user_id) then
    if auth.uid() is null or public.is_class_teacher(new.class_id) then
      update public.matriculas_bajas set reincorporada_at = now(), reincorporada_por = auth.uid()
      where class_id = new.class_id and user_id = new.user_id and reincorporada_at is null;
    else
      raise exception 'Usted fue dado de baja de esta sección. Consulte a su profesor.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enrollments_respeta_baja on public.enrollments;
create trigger enrollments_respeta_baja before insert on public.enrollments
  for each row execute function public.matricula_respeta_baja();

-- Ninguna matrícula se borra sin copia: un borrado directo (p. ej. el botón antiguo «Dar de baja», que borraba la fila)
-- también queda archivado como baja. Los borrados en cascada (sección o cuenta eliminadas) no se archivan: su fila
-- de baja apuntaría a algo que ya no existe. Si era monitor de la sección, deja de serlo.
create or replace function public.matricula_borrada_a_baja()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then return old; end if;
  if not public.baja_vigente(old.class_id, old.user_id) then
    insert into public.matriculas_bajas (class_id, user_id, group_id, enrolled_at, baja_por)
      values (old.class_id, old.user_id, old.group_id, old.enrolled_at, auth.uid());
  end if;
  update public.class_monitors set revoked_at = now(), revoked_by = auth.uid()
    where class_id = old.class_id and user_id = old.user_id and revoked_at is null;
  return old;
end;
$$;

drop trigger if exists enrollments_borrada_a_baja on public.enrollments;
create trigger enrollments_borrada_a_baja before delete on public.enrollments
  for each row execute function public.matricula_borrada_a_baja();

-- Dar de baja a un estudiante de una sección (profesor de la sección o administrador).
create or replace function public.dar_de_baja(p_class uuid, p_user uuid, p_motivo text default '')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_mat public.enrollments;
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_mat from public.enrollments where class_id = p_class and user_id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'El estudiante no está matriculado en esta sección.'); end if;
  insert into public.matriculas_bajas (class_id, user_id, group_id, enrolled_at, baja_por, motivo)
    values (v_mat.class_id, v_mat.user_id, v_mat.group_id, v_mat.enrolled_at, auth.uid(), left(coalesce(trim(p_motivo), ''), 300));
  -- el disparador de borrado ve la baja ya archivada (no la duplica) y retira el papel de monitor
  delete from public.enrollments where class_id = p_class and user_id = p_user;
  return jsonb_build_object('ok', true);
end;
$$;

-- Dar de baja de TODAS las secciones en que el que llama es profesor (o de todas, si es administrador).
create or replace function public.dar_de_baja_todas(p_user uuid, p_motivo text default '')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r record; n integer := 0;
begin
  if not public.is_teacher() then raise exception 'No autorizado' using errcode = '42501'; end if;
  for r in select e.class_id from public.enrollments e where e.user_id = p_user loop
    if public.is_class_teacher(r.class_id) then
      perform public.dar_de_baja(r.class_id, p_user, p_motivo);
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'secciones', n);
end;
$$;

-- Reincorporar: restaura la matrícula con su grupo y su fecha originales.
create or replace function public.reincorporar(p_class uuid, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_baja public.matriculas_bajas;
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_baja from public.matriculas_bajas
    where class_id = p_class and user_id = p_user and reincorporada_at is null for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No hay una baja vigente de ese estudiante en esta sección.'); end if;
  -- el disparador cierra la baja (lo inserta un profesor de la sección)
  insert into public.enrollments (class_id, user_id, group_id, enrolled_at)
    values (v_baja.class_id, v_baja.user_id, v_baja.group_id, v_baja.enrolled_at)
    on conflict (class_id, user_id) do nothing;
  update public.matriculas_bajas set reincorporada_at = now(), reincorporada_por = auth.uid()
    where id = v_baja.id and reincorporada_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

-- Bajas vigentes de una sección (para reincorporar).
create or replace function public.bajas_seccion(p_class uuid)
returns table (user_id uuid, full_name text, login_id text, student_code text, baja_at timestamptz, motivo text, baja_por_nombre text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
    select b.user_id, p.full_name, p.login_id, p.student_code, b.baja_at, b.motivo, q.full_name
    from public.matriculas_bajas b join public.profiles p on p.id = b.user_id
    left join public.profiles q on q.id = b.baja_por
    where b.class_id = p_class and b.reincorporada_at is null
    order by b.baja_at desc;
end;
$$;

-- activity_stats (vigente: migración 3) sin los intentos de estudiantes dados de baja de la sección.
create or replace function public.activity_stats(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'enrolled', (select count(*) from public.enrollments en where en.class_id = v_class),
        'students_started', count(distinct t.user_id),
        'students_submitted', count(distinct t.user_id) filter (where t.status = 'submitted'),
        'attempts', count(*) filter (where t.status = 'submitted'),
        'mean_best', (select round(avg(b.best), 2) from (
            select max(t2.score) as best from public.attempts t2
            where t2.activity_id = p_activity and t2.status = 'submitted'
              and not public.baja_vigente(v_class, t2.user_id) group by t2.user_id) b),
        'scores', (select coalesce(jsonb_agg(b.best order by b.best), '[]'::jsonb) from (
            select max(t2.score) as best from public.attempts t2
            where t2.activity_id = p_activity and t2.status = 'submitted'
              and not public.baja_vigente(v_class, t2.user_id) group by t2.user_id) b))
      from public.attempts t where t.activity_id = p_activity and not public.baja_vigente(v_class, t.user_id)),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'exercise_id', e.id, 'slug', e.slug, 'prompt', left(e.prompt, 160), 'format', e.format,
          'difficulty', e.difficulty, 'concepts', to_jsonb(e.concepts),
          'answered', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                       where t.activity_id = p_activity and r.exercise_id = e.id and r.status not in ('draft')
                         and not public.baja_vigente(v_class, t.user_id)),
          'correct', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                      where t.activity_id = p_activity and r.exercise_id = e.id and r.status = 'correct'
                        and not public.baja_vigente(v_class, t.user_id)),
          'first_try', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                        where t.activity_id = p_activity and r.exercise_id = e.id and r.first_try_correct
                          and not public.baja_vigente(v_class, t.user_id)),
          'mean_credit', (select round(avg(coalesce(r.manual_credit, r.auto_credit)), 3) from public.responses r
                          join public.attempts t on t.id = r.attempt_id
                          where t.activity_id = p_activity and r.exercise_id = e.id and r.status not in ('draft')
                            and not public.baja_vigente(v_class, t.user_id)),
          'codes', (select coalesce(jsonb_object_agg(c.engine_code, c.n), '{}'::jsonb) from (
                      select r.engine_code, count(*) as n from public.responses r join public.attempts t on t.id = r.attempt_id
                      where t.activity_id = p_activity and r.exercise_id = e.id and r.engine_code is not null
                        and r.engine_code <> 'ok' and not public.baja_vigente(v_class, t.user_id) group by r.engine_code) c)
        ) order by i.position), '[]'::jsonb)
      from public.activity_items i join public.exercises e on e.id = i.exercise_id
      where i.activity_id = p_activity)
  );
end;
$$;

-- fusión de cuentas: el historial de bajas se queda con su cuenta
insert into public.fusion_tablas (tabla, estrategia, ancla, clave, orden, nota)
  values ('matriculas_bajas', 'conservar', null, null, 90, 'historial de bajas de la cuenta')
  on conflict (tabla) do nothing;

revoke all on public.matriculas_bajas from anon;
revoke insert, update, delete on public.matriculas_bajas from authenticated;
grant select on public.matriculas_bajas to authenticated;
revoke all on function public.baja_vigente(uuid, uuid), public.matricula_respeta_baja(), public.matricula_borrada_a_baja(),
  public.dar_de_baja(uuid, uuid, text), public.dar_de_baja_todas(uuid, text), public.reincorporar(uuid, uuid),
  public.bajas_seccion(uuid), public.activity_stats(uuid) from public, anon, authenticated;
grant execute on function public.dar_de_baja(uuid, uuid, text), public.dar_de_baja_todas(uuid, text),
  public.reincorporar(uuid, uuid), public.bajas_seccion(uuid), public.activity_stats(uuid) to authenticated;
