-- =============================================================================
-- Regularización de prácticas: «Ya registré todo lo que tengo» y recordatorio al entrar.
--
-- · El estudiante marca que TERMINÓ en una sección (con registros, o declarando que no tiene prácticas anteriores que
--   regularizar). Para terminar no puede dejar borradores. Desde entonces no puede crear registros nuevos, pero sí
--   responder a las aclaraciones del profesor. El profesor puede reabrirle la regularización.
-- · Terminar (o no) NO es una calificación: «sin prácticas que regularizar» no se convierte en ceros.
-- · Recordatorio: mientras la regularización esté abierta en su sección y no haya terminado (o tenga una aclaración
--   pendiente), el estudiante ve un aviso cada vez que entra a la plataforma (hist_pendientes). El profesor puede
--   desactivarlo por sección (hist_settings.recordar, activado por defecto).
-- Aditiva: columna con valor por defecto, tabla nueva y funciones; hist_config, hist_mis_secciones y hist_guardar se
-- redefinen con la misma firma (copiadas de la migración 45, con los añadidos marcados).
-- =============================================================================

alter table public.hist_settings add column if not exists recordar boolean not null default true;

create table if not exists public.hist_cierres (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  finalizado_at timestamptz,                             -- null = reabierta por el profesor
  sin_practicas boolean not null default false,          -- declaró que no tiene prácticas anteriores que regularizar
  registradas integer not null default 0,                -- registros enviados en el momento de terminar
  nota text check (nota is null or char_length(nota) <= 500),
  reabierto_at timestamptz,
  reabierto_por uuid references public.profiles (id) on delete set null,
  primary key (class_id, user_id)
);
alter table public.hist_cierres enable row level security;
revoke all on public.hist_cierres from anon, authenticated;

create or replace function public.hist_terminado(p_class uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.hist_cierres c where c.class_id = p_class and c.user_id = p_user and c.finalizado_at is not null) $$;

-- --- estudiante -----------------------------------------------------------------------------------------------------
create or replace function public.hist_finalizar(p_class uuid, p_sin_practicas boolean, p_nota text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_borradores integer; v_enviadas integer;
begin
  if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = v_uid) or not public.my_account_ok() then
    raise exception 'No está inscrito en esta sección' using errcode = '42501';
  end if;
  if not coalesce((select abierto from public.hist_settings where class_id = p_class), false) then
    raise exception 'La regularización de prácticas no está abierta en esta sección' using errcode = 'P0001';
  end if;
  select count(*) filter (where estado = 'borrador'), count(*) filter (where estado <> 'borrador') into v_borradores, v_enviadas
    from public.hist_declarations where class_id = p_class and user_id = v_uid;
  if v_borradores > 0 then
    raise exception 'Tiene % borrador(es) sin registrar: regístrelos o elimínelos antes de terminar', v_borradores using errcode = 'P0001';
  end if;
  if v_enviadas = 0 and not coalesce(p_sin_practicas, false) then
    raise exception 'No ha registrado ninguna práctica. Si no tiene prácticas anteriores que regularizar, márquelo expresamente' using errcode = '22023';
  end if;
  if v_enviadas > 0 and coalesce(p_sin_practicas, false) then
    raise exception 'Ya registró prácticas: no puede declarar que no tiene ninguna' using errcode = '22023';
  end if;
  insert into public.hist_cierres (class_id, user_id, finalizado_at, sin_practicas, registradas, nota)
    values (p_class, v_uid, now(), coalesce(p_sin_practicas, false), v_enviadas, nullif(left(btrim(coalesce(p_nota, '')), 500), ''))
  on conflict (class_id, user_id) do update set finalizado_at = now(), sin_practicas = excluded.sin_practicas, registradas = excluded.registradas, nota = excluded.nota;
  perform public.hist_log(p_class, null, null, null, 'estudiante', 'terminada', null, null, p_nota,
    jsonb_build_object('registradas', v_enviadas, 'sin_practicas', coalesce(p_sin_practicas, false)));
  return jsonb_build_object('registradas', v_enviadas, 'sin_practicas', coalesce(p_sin_practicas, false));
end;
$$;

-- Secciones con algo pendiente para el aviso al entrar: sin terminar (si el recordatorio está activo) o con aclaraciones.
create or replace function public.hist_pendientes()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'course_title', x->>'class_name'), '[]'::jsonb) from (
    select jsonb_build_object('class_id', c.id, 'class_name', c.name, 'course_title', co.title,
      'sin_terminar', s.recordar and not public.hist_terminado(c.id, auth.uid()),
      'registradas', (select count(*) from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid() and d.estado <> 'borrador'),
      'borradores', (select count(*) from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid() and d.estado = 'borrador'),
      'aclaraciones', (select count(*) from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid() and d.estado = 'aclaracion')) as x
    from public.enrollments e
    join public.classes c on c.id = e.class_id join public.courses co on co.id = c.course_id
    join public.hist_settings s on s.class_id = c.id
    join public.profiles pr on pr.id = auth.uid() and pr.role = 'student'
    where e.user_id = auth.uid() and public.my_account_ok() and not c.archived and s.abierto
  ) t
  where (x->>'sin_terminar')::boolean or (x->>'aclaraciones')::int > 0
$$;

-- --- profesorado -----------------------------------------------------------------------------------------------------
create or replace function public.hist_terminados(p_class uuid)
returns table (user_id uuid, finalizado_at timestamptz, sin_practicas boolean, registradas integer, nota text, reabierto_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.hist_assert_teacher(p_class);
  return query select c.user_id, c.finalizado_at, c.sin_practicas, c.registradas, c.nota, c.reabierto_at
    from public.hist_cierres c where c.class_id = p_class;
end;
$$;

create or replace function public.hist_reabrir_estudiante(p_class uuid, p_user uuid, p_nota text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.hist_assert_teacher(p_class);
  update public.hist_cierres set finalizado_at = null, reabierto_at = now(), reabierto_por = auth.uid()
    where class_id = p_class and user_id = p_user and finalizado_at is not null;
  if not found then raise exception 'Ese estudiante no había terminado' using errcode = 'P0001'; end if;
  perform public.hist_log(p_class, null, null, null, 'docente', 'reabierta', null, null, p_nota, jsonb_build_object('estudiante', p_user));
end;
$$;

create or replace function public.hist_recordatorio(p_class uuid, p_recordar boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.hist_assert_teacher(p_class);
  update public.hist_settings set recordar = coalesce(p_recordar, true), updated_by = auth.uid(), updated_at = now() where class_id = p_class;
  if not found then raise exception 'Active primero la regularización en esta sección' using errcode = 'P0001'; end if;
end;
$$;

-- --- redefiniciones (misma firma) -------------------------------------------------------------------------------------
-- hist_config: + recordar, + terminados
create or replace function public.hist_config(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.hist_settings;
begin
  perform public.hist_assert_teacher(p_class);
  select * into s from public.hist_settings where class_id = p_class;
  return jsonb_build_object(
    'configurado', s.class_id is not null,
    'abierto', coalesce(s.abierto, false),
    'recordar', coalesce(s.recordar, true),                                                            -- añadido (46)
    'terminados', (select count(*) from public.hist_cierres c where c.class_id = p_class and c.finalizado_at is not null),  -- añadido (46)
    'mensaje', coalesce(s.mensaje, ''),
    'margen_dias', coalesce(s.margen_dias, 7),
    'max_mb_captura', coalesce(s.max_mb_captura, 2),
    'cuota_mb', coalesce(s.cuota_mb, 300),
    'max_registros', coalesce(s.max_registros, 40),
    'practicas', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'numero', p.numero, 'titulo', p.titulo, 'descripcion', p.descripcion,
        'provisional', p.provisional, 'origen', p.origen, 'archivada', p.archivada, 'unida_a', p.unida_a, 'activity_id', p.activity_id,
        'actividad', (select a.title from public.activities a where a.id = p.activity_id),
        'declaraciones', (select count(*) from public.hist_declarations d where d.practice_id = p.id and d.estado <> 'borrador'),
        'borradores', (select count(*) from public.hist_declarations d where d.practice_id = p.id and d.estado = 'borrador'))
        order by p.archivada, p.numero), '[]'::jsonb) from public.hist_practices p where p.class_id = p_class),
    'actividades', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title) order by a.created_at), '[]'::jsonb)
        from public.activities a where a.class_id = p_class),
    'almacenamiento', jsonb_build_object(
      'bytes_seccion', public.hist_bytes_seccion(p_class),
      'archivos_seccion', (select count(distinct storage_path) from public.hist_captures where class_id = p_class),
      'bytes_modulo', (select coalesce(sum(b), 0)::bigint from (select max(bytes) as b from public.hist_captures group by storage_path) x),
      'archivos_modulo', (select count(distinct storage_path) from public.hist_captures))
  );
end;
$$;

-- hist_mis_secciones: + terminado_at, + sin_practicas
create or replace function public.hist_mis_secciones()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', c.id, 'class_name', c.name, 'course_title', co.title,
    'abierto', coalesce(s.abierto, false), 'mensaje', coalesce(s.mensaje, ''), 'max_mb_captura', coalesce(s.max_mb_captura, 2),
    'max_registros', coalesce(s.max_registros, 40),
    'terminado_at', (select ci.finalizado_at from public.hist_cierres ci where ci.class_id = c.id and ci.user_id = auth.uid()),     -- añadido (46)
    'sin_practicas', coalesce((select ci.sin_practicas from public.hist_cierres ci where ci.class_id = c.id and ci.user_id = auth.uid() and ci.finalizado_at is not null), false),  -- añadido (46)
    'practicas', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'numero', p.numero, 'titulo', p.titulo, 'descripcion', p.descripcion,
        'provisional', p.provisional) order by p.numero), '[]'::jsonb)
        from public.hist_practices p where p.class_id = c.id and (not p.archivada or exists (select 1 from public.hist_declarations d where d.practice_id = p.id and d.user_id = auth.uid()))),
    'registros', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'practice_id', d.practice_id, 'tipo', d.tipo, 'tema', d.tema, 'descripcion', d.descripcion, 'fecha_declarada', d.fecha_declarada,
        'fecha_desconocida', d.fecha_desconocida, 'medio', d.medio, 'correo_remitente', d.correo_remitente, 'otra_via', d.otra_via, 'contacto', d.contacto,
        'motivo_incidencia', d.motivo_incidencia, 'estado', d.estado, 'editable', public.hist_editable(d), 'faltantes', to_jsonb(public.hist_faltantes(d)),
        'enviado_at', d.enviado_at, 'nota_docente', d.nota_docente, 'respuesta_estudiante', d.respuesta_estudiante, 'updated_at', d.updated_at,
        'capturas', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'posicion', k.posicion, 'bytes', k.bytes, 'ancho', k.ancho, 'alto', k.alto)
            order by k.posicion), '[]'::jsonb) from public.hist_captures k where k.declaration_id = d.id)
        ) order by d.created_at), '[]'::jsonb)
        from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid()),
    'sugerencias', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'tema', g.tema, 'descripcion', g.descripcion, 'fecha_aprox', g.fecha_aprox,
        'comentarios', g.comentarios, 'total_estimado', g.total_estimado, 'estado', g.estado, 'created_at', g.created_at) order by g.created_at), '[]'::jsonb)
        from public.hist_suggestions g where g.class_id = c.id and g.user_id = auth.uid())
  ) order by co.title, c.name), '[]'::jsonb)
  from public.enrollments e
  join public.classes c on c.id = e.class_id join public.courses co on co.id = c.course_id
  left join public.hist_settings s on s.class_id = c.id
  where e.user_id = auth.uid() and public.my_account_ok() and not c.archived
    and (s.abierto or exists (select 1 from public.hist_declarations d where d.class_id = c.id and d.user_id = auth.uid()))
$$;

-- hist_guardar: + quien terminó no crea registros nuevos (sí corrige los existentes, p. ej. una aclaración)
create or replace function public.hist_guardar(p_id uuid, p_class uuid, p_practice uuid, p_tipo text, p_tema text, p_descripcion text,
  p_fecha date, p_fecha_desconocida boolean, p_medio text, p_correo text, p_otra_via text, p_contacto text, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); s public.hist_settings; d public.hist_declarations; v_nuevo boolean; v_correo text := nullif(lower(btrim(coalesce(p_correo, ''))), '');
begin
  if p_id is null then raise exception 'Falta el identificador del registro' using errcode = '22023'; end if;
  select * into d from public.hist_declarations where id = p_id for update;
  v_nuevo := d.id is null;
  if not v_nuevo and (d.user_id <> v_uid or d.class_id <> p_class) then raise exception 'No tiene acceso a este registro' using errcode = '42501'; end if;
  if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = v_uid) or not public.my_account_ok() then
    raise exception 'No está inscrito en esta sección' using errcode = '42501';
  end if;
  select * into s from public.hist_settings where class_id = p_class;
  if not coalesce(s.abierto, false) then raise exception 'La regularización de prácticas no está abierta en esta sección' using errcode = 'P0001'; end if;
  -- añadido (46)
  if v_nuevo and public.hist_terminado(p_class, v_uid) then
    raise exception 'Ya marcó que terminó la regularización; si necesita añadir algo, pida al profesor que se la reabra' using errcode = 'P0001';
  end if;
  if not v_nuevo and not public.hist_editable(d) then raise exception 'El profesor ya revisó este registro; no se puede modificar' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.hist_practices p where p.id = p_practice and p.class_id = p_class and (not p.archivada or p.id = d.practice_id)) then
    raise exception 'Elija una práctica del catálogo de la sección' using errcode = '22023';
  end if;
  if coalesce(p_tipo, 'evidencia') not in ('evidencia', 'incidencia') then raise exception 'Tipo no válido' using errcode = '22023'; end if;
  if not v_nuevo and d.tipo <> coalesce(p_tipo, 'evidencia') then raise exception 'No se puede cambiar el tipo de un registro existente' using errcode = '22023'; end if;
  if p_medio is not null and p_medio not in ('correo', 'otra') then raise exception 'Medio no válido' using errcode = '22023'; end if;
  if p_medio = 'correo' and v_correo is not null and v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'La dirección de correo no parece válida' using errcode = '22023'; end if;
  if p_fecha is not null and (p_fecha > current_date + 1 or p_fecha < date '2000-01-01') then raise exception 'La fecha declarada no es válida' using errcode = '22023'; end if;
  if exists (select 1 from public.hist_declarations x where x.user_id = v_uid and x.practice_id = p_practice and x.id <> p_id and x.tipo = coalesce(p_tipo, 'evidencia')) then
    raise exception 'Ya tiene un registro de esa práctica; corrija el existente' using errcode = 'P0001';
  end if;
  if v_nuevo and (select count(*) from public.hist_declarations x where x.user_id = v_uid and x.class_id = p_class) >= s.max_registros then
    raise exception 'Alcanzó el máximo de % registros en esta sección', s.max_registros using errcode = 'P0001';
  end if;

  if v_nuevo then
    insert into public.hist_declarations (id, class_id, user_id, practice_id, tipo) values (p_id, p_class, v_uid, p_practice, coalesce(p_tipo, 'evidencia'));
  end if;
  update public.hist_declarations set
    practice_id = p_practice,
    tema = left(btrim(coalesce(p_tema, '')), 160),
    descripcion = left(btrim(coalesce(p_descripcion, '')), 1000),
    fecha_declarada = case when coalesce(p_fecha_desconocida, false) then null else p_fecha end,
    fecha_desconocida = coalesce(p_fecha_desconocida, false),
    medio = p_medio,
    correo_remitente = case when p_medio = 'correo' then left(v_correo, 200) end,
    otra_via = case when p_medio = 'otra' then nullif(left(btrim(coalesce(p_otra_via, '')), 120), '') end,
    contacto = nullif(left(btrim(coalesce(p_contacto, '')), 200), ''),
    motivo_incidencia = case when coalesce(p_tipo, 'evidencia') = 'incidencia' then nullif(left(btrim(coalesce(p_motivo, '')), 1000), '') end,
    updated_at = now()
  where id = p_id returning * into d;
  -- un registro ya enviado sigue completo después de corregirlo
  if d.estado = 'registrada' and cardinality(public.hist_faltantes(d)) > 0 then
    raise exception 'Falta: %', array_to_string(public.hist_faltantes(d), ', ') using errcode = '22023';
  end if;
  perform public.hist_log(p_class, d.id, d.practice_id, null, 'estudiante', case when v_nuevo then 'creada' else 'corregida' end, d.estado, d.estado, null, '{}');
  return jsonb_build_object('id', d.id, 'estado', d.estado, 'faltantes', to_jsonb(public.hist_faltantes(d)));
end;
$$;

-- --- permisos --------------------------------------------------------------------------------------------------------
revoke all on function public.hist_terminado(uuid, uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'hist_finalizar(uuid, boolean, text)', 'hist_pendientes()', 'hist_terminados(uuid)', 'hist_reabrir_estudiante(uuid, uuid, text)',
    'hist_recordatorio(uuid, boolean)', 'hist_config(uuid)', 'hist_mis_secciones()',
    'hist_guardar(uuid, uuid, uuid, text, text, text, date, boolean, text, text, text, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
