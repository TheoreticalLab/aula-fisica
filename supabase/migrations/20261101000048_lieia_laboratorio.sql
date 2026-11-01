-- =============================================================================
-- LIEIA · laboratorio científico: persistencia de investigaciones, diseños, revisiones de clasificación e informes.
--
-- Una sola tabla (lieia_research) con «kind» y contenido jsonb, porque el modelo multidimensional evoluciona y no
-- conviene fijar hoy una tabla por concepto. Cada registro conserva su PROCEDENCIA (método, versión del motor y del
-- examen, tamaño muestral, fecha, parámetros, semilla) y su historial de estados. Lo a priori, lo empírico y lo simulado
-- se distinguen dentro de cada contenido («procedencia» de cada valor) y nunca se mezclan.
-- Solo el profesorado de la sección (comprobado en el servidor); los estudiantes no tienen ningún acceso.
-- No toca evaluaciones, respuestas ni calificaciones. Aditiva.
-- =============================================================================

create table if not exists public.lieia_research (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete set null,
  kind text not null check (kind in ('investigacion', 'diseno', 'revision', 'informe')),
  clave text not null check (char_length(clave) between 1 and 200),        -- id de ficha, de pregunta, de diseño…
  version_examen text check (version_examen is null or char_length(version_examen) <= 64),
  estado text not null default 'guardada' check (estado in ('propuesta', 'guardada', 'aceptada', 'pospuesta', 'descartada', 'aplicada')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  procedencia jsonb not null default '{}'::jsonb check (jsonb_typeof(procedencia) = 'object'),
  historial jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lieia_research_unica on public.lieia_research (class_id, coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, clave);
create index if not exists lieia_research_clase on public.lieia_research (class_id, kind, updated_at desc);

alter table public.lieia_research enable row level security;
revoke all on public.lieia_research from anon, authenticated;

create or replace function public.lieia_lab_assert(p_class uuid, p_activity uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_class is null or not public.is_teacher() or not public.is_class_teacher(p_class) or not public.my_account_ok() then
    raise exception 'No tiene acceso a esta sección' using errcode = '42501';
  end if;
  if p_activity is not null and not exists (select 1 from public.activities a where a.id = p_activity and a.class_id = p_class) then
    raise exception 'La actividad no pertenece a esta sección' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.lieia_lab_listar(p_class uuid, p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.lieia_lab_assert(p_class, p_activity);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'activity_id', r.activity_id, 'kind', r.kind, 'clave', r.clave, 'version_examen', r.version_examen,
      'estado', r.estado, 'payload', r.payload, 'procedencia', r.procedencia, 'historial', r.historial, 'created_at', r.created_at, 'updated_at', r.updated_at)
      order by r.updated_at desc), '[]'::jsonb)
    from public.lieia_research r where r.class_id = p_class and (p_activity is null or r.activity_id = p_activity));
end;
$$;

-- Guarda (o actualiza por clase/actividad/tipo/clave). El historial registra quién, cuándo y con qué estado.
create or replace function public.lieia_lab_guardar(p_class uuid, p_activity uuid, p_kind text, p_clave text, p_version text, p_estado text,
  p_payload jsonb, p_procedencia jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_evento jsonb;
begin
  perform public.lieia_lab_assert(p_class, p_activity);
  if p_kind not in ('investigacion', 'diseno', 'revision', 'informe') then raise exception 'Tipo no válido' using errcode = '22023'; end if;
  if coalesce(p_estado, 'guardada') not in ('propuesta', 'guardada', 'aceptada', 'pospuesta', 'descartada', 'aplicada') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Contenido no válido' using errcode = '22023'; end if;
  if pg_column_size(p_payload) > 300000 then raise exception 'El contenido es demasiado grande' using errcode = '22023'; end if;
  v_evento := jsonb_build_object('at', now(), 'por', auth.uid(), 'estado', coalesce(p_estado, 'guardada'));
  insert into public.lieia_research (class_id, activity_id, kind, clave, version_examen, estado, payload, procedencia, historial, created_by)
    values (p_class, p_activity, p_kind, left(btrim(p_clave), 200), left(p_version, 64), coalesce(p_estado, 'guardada'), p_payload,
            coalesce(p_procedencia, '{}'::jsonb), jsonb_build_array(v_evento), auth.uid())
  on conflict (class_id, (coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid)), kind, clave) do update set
    version_examen = excluded.version_examen, estado = excluded.estado, payload = excluded.payload, procedencia = excluded.procedencia,
    historial = lieia_research.historial || v_evento, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.lieia_lab_estado(p_id uuid, p_estado text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.lieia_research;
begin
  select * into r from public.lieia_research where id = p_id for update;
  if r.id is null then raise exception 'No existe' using errcode = 'P0002'; end if;
  perform public.lieia_lab_assert(r.class_id, null);
  if p_estado not in ('propuesta', 'guardada', 'aceptada', 'pospuesta', 'descartada', 'aplicada') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  update public.lieia_research set estado = p_estado, historial = historial || jsonb_build_object('at', now(), 'por', auth.uid(), 'estado', p_estado), updated_at = now()
    where id = p_id;
end;
$$;

revoke all on function public.lieia_lab_assert(uuid, uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['lieia_lab_listar(uuid, uuid)', 'lieia_lab_guardar(uuid, uuid, text, text, text, text, jsonb, jsonb)', 'lieia_lab_estado(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
