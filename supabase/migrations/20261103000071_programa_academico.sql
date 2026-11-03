-- =============================================================================
-- Migración 71 · Programa académico con seguimiento de lo impartido (primera asignatura: Física General III).
-- Reutiliza la arquitectura de cursos: asignatura → unidades → lecciones (= capítulos) → conceptos (= subtemas).
-- Solo añade: una columna en courses, columnas en concepts, tres tablas nuevas y funciones.
--
--  · courses.programa: la asignatura usa el seguimiento del programa (las demás no cambian en nada).
--  · concepts: orden, nivel (esencial / complementario / profundización), oculto y descripción del subtema;
--    «customized» como en unidades y lecciones (el instalador de la biblioteca no pisa lo que edita el profesor).
--    Un subtema oculto deja de verse para los estudiantes (política concepts_select).
--  · program_coverage: qué subtema se impartió, en qué sección, qué día y en qué clase impartida. Nunca se borra:
--    desmarcar lo «anula» (queda en el historial).
--  · program_links: vínculos del capítulo (o de un subtema) con actividades, ejercicios, simuladores, clases
--    impartidas y materiales (PDF, vídeo, imagen o enlace https); para todas las secciones o una; publicar/despublicar.
--  · program_notes: observaciones docentes (nunca las ven los estudiantes).
--  · En una asignatura con programa, una unidad «preparada» muestra a sus estudiantes el PROGRAMA (capítulos y
--    subtemas: contenido previsto) pero no el material; «publicada» además deja estudiar el material.
--  · La lectura (study_visits) se muestra como tiempo de estudio; nunca como dominio ni como nota.
-- =============================================================================

alter table public.courses add column if not exists programa boolean not null default false;

alter table public.concepts add column if not exists position integer not null default 0;
alter table public.concepts add column if not exists nivel text not null default 'esencial';
alter table public.concepts add column if not exists hidden boolean not null default false;
alter table public.concepts add column if not exists descripcion text not null default '';
alter table public.concepts add column if not exists customized boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'concepts_nivel_check') then
    alter table public.concepts add constraint concepts_nivel_check check (nivel in ('esencial', 'complementario', 'profundizacion'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'concepts_descripcion_check') then
    alter table public.concepts add constraint concepts_descripcion_check check (char_length(descripcion) <= 1500);
  end if;
end $$;
drop trigger if exists concepts_customized on public.concepts;
create trigger concepts_customized before update of name, nivel, position, hidden, descripcion on public.concepts
  for each row when (old.name is distinct from new.name or old.nivel is distinct from new.nivel or old.position is distinct from new.position
                     or old.hidden is distinct from new.hidden or old.descripcion is distinct from new.descripcion)
  execute function public.mark_customized();

-- concepts_select (migración 2) + un subtema oculto no lo ven los estudiantes
drop policy if exists concepts_select on public.concepts;
create policy concepts_select on public.concepts for select to authenticated
  using (public.is_teacher() or (public.is_enrolled_course(course_id) and not hidden));

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.program_coverage (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete restrict,   -- un subtema ya impartido se oculta, no se borra
  fecha date not null,
  session_id uuid references public.class_sessions (id) on delete set null,
  nota text check (nota is null or char_length(nota) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  anulado_at timestamptz,
  anulado_por uuid references public.profiles (id) on delete set null
);
create unique index if not exists program_coverage_unico on public.program_coverage (class_id, concept_id, fecha) where anulado_at is null;
create index if not exists program_coverage_concept_idx on public.program_coverage (concept_id);

create table if not exists public.program_links (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  concept_id uuid references public.concepts (id) on delete set null,
  class_id uuid references public.classes (id) on delete cascade,               -- null = todas las secciones
  tipo text not null check (tipo in ('actividad', 'ejercicio', 'simulador', 'clase', 'pdf', 'video', 'imagen', 'enlace')),
  activity_id uuid references public.activities (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete cascade,
  session_id uuid references public.class_sessions (id) on delete cascade,
  sim_key text check (sim_key is null or sim_key ~ '^[a-z0-9_-]{1,60}$'),
  url text check (url is null or (url ~ '^https://[^\s<>"]+$' and char_length(url) <= 1000)),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  descripcion text not null default '' check (char_length(descripcion) <= 1000),
  publicado boolean not null default false,
  position integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retirado_at timestamptz,
  check ((tipo = 'actividad' and activity_id is not null) or (tipo = 'ejercicio' and exercise_id is not null)
      or (tipo = 'simulador' and sim_key is not null) or (tipo = 'clase' and session_id is not null)
      or (tipo in ('pdf', 'video', 'imagen', 'enlace') and url is not null))
);
create index if not exists program_links_lesson_idx on public.program_links (lesson_id) where retirado_at is null;

create table if not exists public.program_notes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  concept_id uuid references public.concepts (id) on delete set null,
  class_id uuid references public.classes (id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  retirado_at timestamptz
);
create index if not exists program_notes_lesson_idx on public.program_notes (lesson_id) where retirado_at is null;

alter table public.program_coverage enable row level security;
alter table public.program_links enable row level security;
alter table public.program_notes enable row level security;
revoke all on public.program_coverage, public.program_links, public.program_notes from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Permisos auxiliares
-- -----------------------------------------------------------------------------
-- profesorado de la sección (o equipo docente de su asignatura, o administración)
create or replace function public.programa_docente_seccion(p_class uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.is_class_teacher(p_class) or public.is_course_staff((select course_id from public.classes where id = p_class)), false) $$;

-- profesorado de alguna sección de la asignatura o su equipo docente
create or replace function public.programa_docente_curso(p_course uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.is_course_staff(p_course) or exists (select 1 from public.classes c where c.course_id = p_course and public.is_class_teacher(c.id)), false) $$;

-- -----------------------------------------------------------------------------
-- Profesor: el programa de una sección (estructura, lo impartido, vínculos, notas y lectura)
-- -----------------------------------------------------------------------------
create or replace function public.programa_seccion(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_course uuid;
begin
  if p_class is null or not public.programa_docente_seccion(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select course_id into v_course from public.classes where id = p_class;
  return jsonb_build_object(
    'class_id', p_class, 'course_id', v_course, 'programa', (select programa from public.courses where id = v_course),
    'estudiantes', (select count(*) from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' where e.class_id = p_class),
    'sesiones', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'fecha', s.fecha, 'titulo', s.title) order by s.fecha desc), '[]'::jsonb)
                 from public.class_sessions s where s.class_id = p_class),
    'unidades', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'titulo', u.title, 'position', u.position, 'estado', u.status, 'oculta', u.hidden,
        'capitulos', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.title, 'position', l.position, 'oculto', l.hidden,
            'subtemas', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.name, 'nivel', c.nivel, 'oculto', c.hidden, 'position', c.position,
                'impartido', (select coalesce(jsonb_agg(jsonb_build_object('id', pc.id, 'fecha', pc.fecha, 'session_id', pc.session_id,
                    'sesion', (select s.title from public.class_sessions s where s.id = pc.session_id), 'nota', pc.nota) order by pc.fecha), '[]'::jsonb)
                  from public.program_coverage pc where pc.class_id = p_class and pc.concept_id = c.id and pc.anulado_at is null))
              order by c.position, c.name), '[]'::jsonb) from public.concepts c where c.lesson_id = l.id),
            'enlaces', (select count(*) from public.program_links k where k.lesson_id = l.id and k.retirado_at is null and (k.class_id is null or k.class_id = p_class)),
            'notas', (select count(*) from public.program_notes n where n.lesson_id = l.id and n.retirado_at is null and (n.class_id is null or n.class_id = p_class)),
            -- lectura: estudiantes de la sección que estudiaron el capítulo y minutos efectivos (no es dominio ni nota)
            'lectores', (select count(distinct v.user_id) from public.study_visits v join public.enrollments e on e.user_id = v.user_id and e.class_id = p_class
                          where v.lesson_id = l.id and v.effective_seconds > 0),
            'minutos', (select coalesce(round(sum(v.effective_seconds) / 60.0), 0) from public.study_visits v join public.enrollments e on e.user_id = v.user_id and e.class_id = p_class
                          where v.lesson_id = l.id))
          order by l.position, l.title), '[]'::jsonb) from public.lessons l where l.unit_id = u.id))
      order by u.position, u.title), '[]'::jsonb) from public.units u where u.course_id = v_course and u.status <> 'archivado'));
end;
$$;

-- Marcar subtemas como impartidos en una sección (una fecha; opcionalmente una clase impartida y una nota)
create or replace function public.programa_marcar(p_class uuid, p_concepts uuid[], p_fecha date, p_session uuid default null, p_nota text default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_course uuid; v_n integer;
begin
  if p_class is null or not public.programa_docente_seccion(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select course_id into v_course from public.classes where id = p_class;
  if p_fecha is null or p_fecha > (now() at time zone 'America/Santo_Domingo')::date + 1 or p_fecha < date '2020-01-01' then
    raise exception 'Fecha no válida' using errcode = '22023'; end if;
  if coalesce(cardinality(p_concepts), 0) = 0 then raise exception 'Elija al menos un subtema' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_concepts) x where not exists (select 1 from public.concepts c where c.id = x and c.course_id = v_course)) then
    raise exception 'Subtema ajeno a la asignatura' using errcode = '42501'; end if;
  if p_session is not null and not exists (select 1 from public.class_sessions s where s.id = p_session and s.class_id = p_class) then
    raise exception 'La clase impartida no es de esta sección' using errcode = '42501'; end if;
  insert into public.program_coverage (class_id, concept_id, fecha, session_id, nota, created_by)
    select p_class, x, p_fecha, p_session, left(nullif(btrim(p_nota), ''), 500), auth.uid() from unnest(p_concepts) x
    on conflict (class_id, concept_id, fecha) where anulado_at is null
      do update set session_id = coalesce(excluded.session_id, public.program_coverage.session_id),
                    nota = coalesce(excluded.nota, public.program_coverage.nota);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Desmarcar: la marca se ANULA (queda en el historial)
create or replace function public.programa_desmarcar(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid;
begin
  select class_id into v_class from public.program_coverage where id = p_id and anulado_at is null;
  if v_class is null or not public.programa_docente_seccion(v_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.program_coverage set anulado_at = now(), anulado_por = auth.uid() where id = p_id;
end;
$$;

-- Capítulo para el profesor: vínculos y notas (todas las secciones a su cargo) y opciones para vincular
create or replace function public.programa_capitulo(p_lesson uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare l public.lessons;
begin
  select * into l from public.lessons where id = p_lesson;
  if l.id is null or not public.programa_docente_curso(l.course_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'enlaces', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'tipo', k.tipo, 'titulo', k.titulo, 'descripcion', k.descripcion, 'url', k.url,
        'activity_id', k.activity_id, 'exercise_id', k.exercise_id, 'session_id', k.session_id, 'sim_key', k.sim_key, 'concept_id', k.concept_id,
        'class_id', k.class_id, 'seccion', (select c.name from public.classes c where c.id = k.class_id), 'publicado', k.publicado, 'position', k.position)
      order by k.position, k.created_at), '[]'::jsonb)
      from public.program_links k where k.lesson_id = p_lesson and k.retirado_at is null
        and (k.class_id is null or public.programa_docente_seccion(k.class_id))),
    'notas', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto, 'concept_id', n.concept_id, 'class_id', n.class_id,
        'seccion', (select c.name from public.classes c where c.id = n.class_id), 'autor', (select p.full_name from public.profiles p where p.id = n.created_by),
        'created_at', n.created_at) order by n.created_at desc), '[]'::jsonb)
      from public.program_notes n where n.lesson_id = p_lesson and n.retirado_at is null and (n.class_id is null or public.programa_docente_seccion(n.class_id))),
    -- opciones: secciones a su cargo, sus actividades y sus clases impartidas
    'secciones', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.name) order by c.name), '[]'::jsonb)
      from public.classes c where c.course_id = l.course_id and not c.archived and public.programa_docente_seccion(c.id)),
    'actividades', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.title, 'modo', a.mode, 'class_id', a.class_id) order by a.created_at desc), '[]'::jsonb)
      from public.activities a join public.classes c on c.id = a.class_id where c.course_id = l.course_id and not c.archived and public.programa_docente_seccion(c.id)),
    'sesiones', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'fecha', s.fecha, 'titulo', s.title, 'class_id', s.class_id) order by s.fecha desc), '[]'::jsonb)
      from public.class_sessions s join public.classes c on c.id = s.class_id where c.course_id = l.course_id and public.programa_docente_seccion(c.id)));
end;
$$;

-- Guardar un vínculo (nuevo o existente). Para todas las secciones: equipo docente; para una sección: su profesorado.
create or replace function public.programa_enlace_guardar(p jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid; v_old public.program_links; l public.lessons;
  v_class uuid := nullif(p ->> 'class_id', '')::uuid; v_concept uuid := nullif(p ->> 'concept_id', '')::uuid;
  v_tipo text := p ->> 'tipo'; v_act uuid := nullif(p ->> 'activity_id', '')::uuid; v_ex uuid := nullif(p ->> 'exercise_id', '')::uuid;
  v_ses uuid := nullif(p ->> 'session_id', '')::uuid; v_url text := nullif(btrim(coalesce(p ->> 'url', '')), '');
begin
  if v_id is not null then
    select * into v_old from public.program_links where id = v_id and retirado_at is null;
    if v_old.id is null then raise exception 'Vínculo no encontrado' using errcode = 'P0002'; end if;
  end if;
  select * into l from public.lessons where id = coalesce(v_old.lesson_id, nullif(p ->> 'lesson_id', '')::uuid);
  if l.id is null then raise exception 'Capítulo no encontrado' using errcode = 'P0002'; end if;
  -- permiso sobre el vínculo anterior y sobre el nuevo alcance
  if (v_old.id is not null and not (case when v_old.class_id is null then public.is_course_staff(l.course_id) else public.programa_docente_seccion(v_old.class_id) end))
     or not (case when v_class is null then public.is_course_staff(l.course_id) else public.programa_docente_seccion(v_class) end) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if v_class is not null and not exists (select 1 from public.classes c where c.id = v_class and c.course_id = l.course_id) then
    raise exception 'Sección ajena a la asignatura' using errcode = '42501'; end if;
  if v_concept is not null and not exists (select 1 from public.concepts c where c.id = v_concept and c.lesson_id = l.id) then
    raise exception 'El subtema no es de este capítulo' using errcode = '22023'; end if;
  if v_act is not null and not exists (select 1 from public.activities a join public.classes c on c.id = a.class_id
                                        where a.id = v_act and c.course_id = l.course_id and public.programa_docente_seccion(c.id)) then
    raise exception 'Actividad ajena' using errcode = '42501'; end if;
  if v_ex is not null and not exists (select 1 from public.exercises e where e.id = v_ex and e.course_id = l.course_id) then
    raise exception 'Ejercicio ajeno a la asignatura' using errcode = '42501'; end if;
  if v_ses is not null and not exists (select 1 from public.class_sessions s join public.classes c on c.id = s.class_id
                                        where s.id = v_ses and c.course_id = l.course_id and public.programa_docente_seccion(c.id)) then
    raise exception 'Clase impartida ajena' using errcode = '42501'; end if;
  if v_id is null then
    insert into public.program_links (course_id, lesson_id, concept_id, class_id, tipo, activity_id, exercise_id, session_id, sim_key, url, titulo, descripcion, publicado, position, created_by)
    values (l.course_id, l.id, v_concept, v_class, v_tipo, v_act, v_ex, v_ses, nullif(p ->> 'sim_key', ''), v_url, btrim(coalesce(p ->> 'titulo', '')),
            left(coalesce(p ->> 'descripcion', ''), 1000), coalesce((p ->> 'publicado')::boolean, false),
            coalesce((p ->> 'position')::integer, (select coalesce(max(position), 0) + 1 from public.program_links where lesson_id = l.id)), auth.uid())
    returning id into v_id;
  else
    update public.program_links set concept_id = v_concept, class_id = v_class, tipo = v_tipo, activity_id = v_act, exercise_id = v_ex, session_id = v_ses,
      sim_key = nullif(p ->> 'sim_key', ''), url = v_url, titulo = btrim(coalesce(p ->> 'titulo', '')), descripcion = left(coalesce(p ->> 'descripcion', ''), 1000),
      publicado = coalesce((p ->> 'publicado')::boolean, publicado), position = coalesce((p ->> 'position')::integer, position), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.programa_enlace_retirar(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare k public.program_links;
begin
  select * into k from public.program_links where id = p_id and retirado_at is null;
  if k.id is null or not (case when k.class_id is null then public.is_course_staff(k.course_id) else public.programa_docente_seccion(k.class_id) end) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.program_links set retirado_at = now(), publicado = false, updated_at = now() where id = p_id;
end;
$$;

create or replace function public.programa_nota_guardar(p_lesson uuid, p_texto text, p_concept uuid default null, p_class uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare l public.lessons; v_id uuid;
begin
  select * into l from public.lessons where id = p_lesson;
  if l.id is null or not (case when p_class is null then public.is_course_staff(l.course_id) else public.programa_docente_seccion(p_class) end) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_class is not null and not exists (select 1 from public.classes c where c.id = p_class and c.course_id = l.course_id) then
    raise exception 'Sección ajena a la asignatura' using errcode = '42501'; end if;
  if p_concept is not null and not exists (select 1 from public.concepts c where c.id = p_concept and c.lesson_id = l.id) then
    raise exception 'El subtema no es de este capítulo' using errcode = '22023'; end if;
  insert into public.program_notes (course_id, lesson_id, concept_id, class_id, texto, created_by)
    values (l.course_id, l.id, p_concept, p_class, btrim(p_texto), auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.programa_nota_retirar(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare n public.program_notes;
begin
  select * into n from public.program_notes where id = p_id and retirado_at is null;
  if n.id is null or not (n.created_by = auth.uid() or (case when n.class_id is null then public.is_course_staff(n.course_id) else public.programa_docente_seccion(n.class_id) end)) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.program_notes set retirado_at = now() where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Estudiante: el programa de su asignatura (previsto · impartido en su sección · disponible para estudiar)
-- -----------------------------------------------------------------------------
create or replace function public.programa_mio(p_course uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_clases uuid[];
begin
  if v_uid is null or not public.my_account_ok() then return null; end if;
  if not exists (select 1 from public.courses where id = p_course and programa) then return null; end if;
  select coalesce(array_agg(e.class_id), '{}') into v_clases from public.enrollments e join public.classes c on c.id = e.class_id
    where e.user_id = v_uid and c.course_id = p_course;
  if cardinality(v_clases) = 0 and not public.programa_docente_curso(p_course) then return null; end if;
  return jsonb_build_object('unidades', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'titulo', u.title, 'resumen', u.summary, 'position', u.position, 'estado', u.status,
      'capitulos', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.title, 'resumen', l.summary, 'position', l.position,
          'disponible', public.lesson_visible_to_me(l.id),
          'objetivos', coalesce(l.study -> 'objetivos', '[]'::jsonb),
          'subtemas', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.name, 'nivel', c.nivel, 'descripcion', c.descripcion,
              'impartido', (select coalesce(jsonb_agg(distinct pc.fecha), '[]'::jsonb) from public.program_coverage pc
                            where pc.concept_id = c.id and pc.class_id = any (v_clases) and pc.anulado_at is null))
            order by c.position, c.name), '[]'::jsonb) from public.concepts c where c.lesson_id = l.id and not c.hidden),
          -- clases impartidas asociadas (solo las publicadas para el estudiante)
          'clases', (select coalesce(jsonb_agg(distinct jsonb_build_object('id', s.id, 'fecha', s.fecha, 'titulo', s.title)), '[]'::jsonb)
            from public.class_sessions s where s.class_id = any (v_clases) and (s.fotos_estado = 'aprobada' or s.version_publicada is not null)
              and (exists (select 1 from public.program_coverage pc join public.concepts c on c.id = pc.concept_id
                           where pc.session_id = s.id and pc.anulado_at is null and c.lesson_id = l.id)
                   or exists (select 1 from public.program_links k where k.session_id = s.id and k.lesson_id = l.id and k.publicado and k.retirado_at is null))),
          -- material y vínculos publicados (de todas las secciones o de la suya), solo si el material del capítulo está disponible
          'enlaces', case when public.lesson_visible_to_me(l.id) then (select coalesce(jsonb_agg(jsonb_build_object('tipo', k.tipo, 'titulo', k.titulo, 'descripcion', k.descripcion,
              'url', k.url, 'sim_key', k.sim_key, 'activity_id', case when k.activity_id is not null and public.activity_visible_to_me(k.activity_id) then k.activity_id end,
              'exercise_id', k.exercise_id, 'session_id', k.session_id, 'concept_id', k.concept_id) order by k.position, k.created_at), '[]'::jsonb)
            from public.program_links k where k.lesson_id = l.id and k.publicado and k.retirado_at is null
              and (k.class_id is null or k.class_id = any (v_clases))
              and (k.activity_id is null or public.activity_visible_to_me(k.activity_id))) else '[]'::jsonb end,
          -- prácticas y evaluaciones de su sección que trabajan subtemas del capítulo
          'practicas', (select coalesce(jsonb_agg(distinct jsonb_build_object('id', a.id, 'titulo', a.title, 'modo', a.mode)), '[]'::jsonb)
            from public.activities a join public.activity_items i on i.activity_id = a.id join public.exercises e on e.id = i.exercise_id
            where a.class_id = any (v_clases) and public.activity_visible_to_me(a.id)
              and e.concepts && (select coalesce(array_agg(c.slug), '{}') from public.concepts c where c.lesson_id = l.id and not c.hidden)),
          -- su propio tiempo de estudio del capítulo (lectura: no es dominio ni nota)
          'minutos', (select coalesce(round(sum(v.effective_seconds) / 60.0), 0) from public.study_visits v where v.user_id = v_uid and v.lesson_id = l.id))
        order by l.position, l.title), '[]'::jsonb) from public.lessons l where l.unit_id = u.id and not l.hidden))
    order by u.position, u.title), '[]'::jsonb)
    from public.units u where u.course_id = p_course and not u.hidden
      and (u.status in ('preparado', 'publicado') or (public.programa_docente_curso(p_course) and u.status <> 'archivado'))));
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['programa_docente_seccion(uuid)', 'programa_docente_curso(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['programa_seccion(uuid)', 'programa_marcar(uuid, uuid[], date, uuid, text)', 'programa_desmarcar(uuid)',
                           'programa_capitulo(uuid)', 'programa_enlace_guardar(jsonb)', 'programa_enlace_retirar(uuid)',
                           'programa_nota_guardar(uuid, text, uuid, uuid)', 'programa_nota_retirar(uuid)', 'programa_mio(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
