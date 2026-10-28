-- Orbe IA · copiar el banco de chistes de una asignatura a otra (migración 31). Solo añade una función.
--
-- Pensado para asignaturas instaladas desde la misma biblioteca (p. ej. Física General 1 y 1-A): las lecciones se
-- emparejan por su identificador interno (slug), que es el mismo en ambas copias aunque el profesor haya cambiado
-- títulos. Copia los aprobados (y, si se pide, los pendientes y los del simulador), conserva su estado, no
-- duplica (ni vuelve a traer los que el profesor ya eliminó en el destino) y mantiene el apartado solo si existe
-- en la teoría de la lección destino. Con p_probar = true solo cuenta lo que haría, sin guardar nada.

create or replace function public.orbe_ia_admin_copiar(p_origen uuid, p_destino uuid, p_pendientes boolean default false,
  p_simulados boolean default false, p_probar boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_lesson uuid;
  v_apartado text;
  v_total integer := 0; v_cop integer := 0; v_dup integer := 0; v_sin integer := 0; v_sin_apartado integer := 0;
begin
  perform public.orbe_ia_assert_admin();
  if p_origen is null or p_destino is null or p_origen = p_destino then
    raise exception 'Elija dos asignaturas distintas' using errcode = '22023';
  end if;
  if (select count(*) from public.courses where id in (p_origen, p_destino)) <> 2 then
    raise exception 'Asignatura inexistente' using errcode = '22023';
  end if;

  for r in
    select j.lesson_id, j.section, j.apartado, j.evento, j.text, j.status, j.origin, j.model, j.edited, l.slug lesson_slug
    from public.orbe_ia_jokes j left join public.lessons l on l.id = j.lesson_id
    where j.course_id = p_origen
      and (j.status = 'aprobado' or (coalesce(p_pendientes, false) and j.status = 'pendiente'))
      and (coalesce(p_simulados, false) or j.origin <> 'simulador')
    order by j.created_at
  loop
    v_total := v_total + 1;
    v_lesson := null;
    if r.lesson_id is not null then
      select l.id into v_lesson from public.lessons l where l.course_id = p_destino and l.slug = r.lesson_slug;
      if v_lesson is null then v_sin := v_sin + 1; continue; end if;
    end if;
    -- ya está en el destino (en cualquier estado, también eliminado: se respeta la decisión del profesor)
    if exists (select 1 from public.orbe_ia_jokes d where d.course_id = p_destino and d.lesson_id is not distinct from v_lesson
               and d.evento is not distinct from r.evento
               and regexp_replace(lower(d.text), '[^[:alnum:]]+', '', 'g') = regexp_replace(lower(r.text), '[^[:alnum:]]+', '', 'g')) then
      v_dup := v_dup + 1; continue;
    end if;
    v_apartado := null;
    if r.apartado is not null and v_lesson is not null then
      select a into v_apartado from unnest(public.orbe_ia_apartados(v_lesson)) a where public.orbe_ia_norm(a) = public.orbe_ia_norm(r.apartado) limit 1;
      if v_apartado is null then v_sin_apartado := v_sin_apartado + 1; end if;   -- queda como chiste de la subsección
    end if;
    if not coalesce(p_probar, true) then
      insert into public.orbe_ia_jokes (course_id, lesson_id, section, apartado, evento, text, status, origin, model, edited, reviewed_at, reviewed_by)
      values (p_destino, v_lesson, r.section, v_apartado, r.evento, r.text, r.status, r.origin, r.model, r.edited, now(), auth.uid());
    end if;
    v_cop := v_cop + 1;
  end loop;

  return jsonb_build_object('revisados', v_total, 'copiados', v_cop, 'duplicados', v_dup, 'sin_leccion', v_sin,
    'sin_apartado', v_sin_apartado, 'prueba', coalesce(p_probar, true));
end;
$$;

-- permisos con el mismo patrón que las migraciones anteriores (la función comprueba el administrador por dentro)
do $$
declare f text := 'orbe_ia_admin_copiar(uuid, uuid, boolean, boolean, boolean)';
begin
  execute format('revoke all on function public.%s from public, anon', f);
  execute format('grant execute on function public.%s to authenticated', f);
end $$;
