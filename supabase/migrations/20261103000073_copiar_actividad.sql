-- =============================================================================
-- Migración 73 · Copiar una práctica o evaluación a otra sección (de la misma asignatura o de otra, p. ej. de
-- Física General I a Física General IA). Solo añade una función.
--
--  · Copia la actividad con TODA su configuración: ejercicios y su orden y valor, lectura cronometrada, opciones,
--    motor de examen, diseño (orden, versiones, roles), examen adaptativo, práctica asistida (pesos y transferencias)
--    y el vínculo con el Registro de Calificaciones (si el valor fijo no cabe en el destino, queda «por definir»).
--  · NUNCA copia nada de los estudiantes: intentos, respuestas, notas, telemetría ni controles hechos.
--  · La copia queda OCULTA (borrador) para que el profesor la revise, ajuste las fechas y la publique. Opcionalmente
--    sin fechas.
--  · Otra asignatura: cada ejercicio se enlaza con el de la asignatura de destino que tiene el mismo identificador
--    (las asignaturas que comparten biblioteca tienen los mismos); si no existe allí, se copia (con su clave) como
--    borrador del banco de destino.
--  · Las Prácticas de Control (se generan en clase) no se copian; la política de control por defecto la crea la
--    asignatura de destino como en cualquier práctica nueva.
-- =============================================================================

create or replace function public.actividad_copiar(p_activity uuid, p_class uuid, p_fechas boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  a public.activities; v_src uuid; v_dst uuid; v_new uuid := gen_random_uuid(); v_lesson uuid;
  r record; v_ex uuid; v_map jsonb := '{}'::jsonb; v_enl integer := 0; v_cop integer := 0;
  g public.activity_grade_links; v_fijos numeric; v_disp numeric; v_reg text := null; v_patch jsonb;
begin
  select * into a from public.activities where id = p_activity;
  if a.id is null or not public.is_class_teacher(a.class_id) or p_class is null or not public.is_class_teacher(p_class) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if exists (select 1 from public.control_sessions s where s.control_activity_id = a.id) then
    raise exception 'Una Práctica de Control no se copia: se genera en clase desde Orbe Control' using errcode = 'P0001'; end if;
  select course_id into v_src from public.classes where id = a.class_id;
  select course_id into v_dst from public.classes where id = p_class and not archived;
  if v_dst is null then raise exception 'Sección de destino no válida' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('copiar-actividad:' || v_dst::text, 0));

  -- 1) ejercicios: misma asignatura → los mismos; otra → el del mismo identificador, o una copia
  for r in
    select ex.* from public.exercises ex where ex.id in (
      select i.exercise_id from public.activity_items i where i.activity_id = a.id
      union select d.exercise_id from public.exam_design_items d where d.activity_id = a.id
      union select t.exercise_id from public.assisted_transfer t where t.activity_id = a.id
      union select t.transfer_exercise_id from public.assisted_transfer t where t.activity_id = a.id)
  loop
    if v_src = v_dst then
      v_ex := r.id;
    else
      v_ex := (select e.id from public.exercises e where e.course_id = v_dst and e.slug = r.slug);
      if v_ex is not null then
        v_enl := v_enl + 1;
      else
        v_ex := gen_random_uuid();
        insert into public.exercises
          select (jsonb_populate_record(null::public.exercises, to_jsonb(r) || jsonb_build_object(
            'id', v_ex, 'course_id', v_dst, 'created_by', auth.uid(), 'updated_at', now(),
            'lesson_id', (select l.id from public.lessons l where l.course_id = v_dst and l.slug = (select l0.slug from public.lessons l0 where l0.id = r.lesson_id))))).*;
        insert into public.exercise_keys
          select (jsonb_populate_record(null::public.exercise_keys, to_jsonb(k) || jsonb_build_object('exercise_id', v_ex))).*
          from public.exercise_keys k where k.exercise_id = r.id;
        insert into public.exercise_bank_meta (exercise_id, course_id, meta)
          select v_ex, v_dst, m.meta from public.exercise_bank_meta m where m.exercise_id = r.id;
        v_cop := v_cop + 1;
      end if;
    end if;
    v_map := v_map || jsonb_build_object(r.id::text, v_ex);
  end loop;

  -- 2) la actividad (oculta; sin grupo; lección equivalente en la asignatura de destino)
  v_lesson := case when v_src = v_dst then a.lesson_id
                   else (select l.id from public.lessons l where l.course_id = v_dst and l.slug = (select l0.slug from public.lessons l0 where l0.id = a.lesson_id)) end;
  v_patch := jsonb_build_object('id', v_new, 'class_id', p_class, 'group_id', null, 'lesson_id', v_lesson, 'published', false, 'grades_published', false,
                                'created_by', auth.uid(), 'created_at', now(), 'updated_at', now());
  if not coalesce(p_fechas, true) then
    v_patch := v_patch || jsonb_build_object('opens_at', null, 'closes_at', null)
      -- «después del cierre» necesita una fecha de cierre
      || case when a.reveal_policy = 'after_close' then jsonb_build_object('reveal_policy', 'after_submit') else '{}'::jsonb end;
  end if;
  insert into public.activities select (jsonb_populate_record(null::public.activities, to_jsonb(a) || v_patch)).*;

  insert into public.activity_items (activity_id, exercise_id, position, points)
    select v_new, (v_map ->> i.exercise_id::text)::uuid, i.position, i.points from public.activity_items i where i.activity_id = a.id;

  -- 3) configuración asociada (cada tabla, si la actividad la tiene)
  insert into public.exam_settings
    select (jsonb_populate_record(null::public.exam_settings, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now()))).*
    from public.exam_settings x where x.activity_id = a.id;
  insert into public.exam_designs
    select (jsonb_populate_record(null::public.exam_designs, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now()))).*
    from public.exam_designs x where x.activity_id = a.id;
  insert into public.exam_design_items
    select (jsonb_populate_record(null::public.exam_design_items, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'exercise_id', v_map ->> x.exercise_id::text))).*
    from public.exam_design_items x where x.activity_id = a.id;
  insert into public.exam_adaptive
    select (jsonb_populate_record(null::public.exam_adaptive, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now()))).*
    from public.exam_adaptive x where x.activity_id = a.id;
  -- la actividad de verificación de la práctica asistida es de la sección de origen: en la copia se elige de nuevo
  insert into public.assisted_settings
    select (jsonb_populate_record(null::public.assisted_settings, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now(),
      'verificacion_actividad', null))).*
    from public.assisted_settings x where x.activity_id = a.id;
  insert into public.assisted_transfer (activity_id, exercise_id, transfer_exercise_id)
    select v_new, (v_map ->> t.exercise_id::text)::uuid, (v_map ->> t.transfer_exercise_id::text)::uuid from public.assisted_transfer t where t.activity_id = a.id;

  -- 4) Registro de Calificaciones: el mismo apartado; el valor fijo solo si cabe en el destino
  select * into g from public.activity_grade_links where activity_id = a.id;
  if g.activity_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('vinculos:' || p_class::text || g.category, 0));
    v_disp := public.grade_category_max(g.category) - public.grade_part_max(p_class, g.category);
    select coalesce(sum(points), 0) into v_fijos from public.activity_grade_links where class_id = p_class and category = g.category and points is not null;
    insert into public.activity_grade_links (activity_id, class_id, category, points, updated_by)
      values (v_new, p_class, g.category, case when g.points is not null and v_fijos + g.points <= v_disp then g.points end, auth.uid());
    v_reg := g.category;
  end if;

  return jsonb_build_object('id', v_new, 'misma_asignatura', v_src = v_dst, 'ejercicios', (select count(*) from public.activity_items where activity_id = v_new),
    'ejercicios_enlazados', v_enl, 'ejercicios_copiados', v_cop, 'registro', v_reg,
    'registro_por_definir', coalesce(g.points is not null and not exists (select 1 from public.activity_grade_links k where k.activity_id = v_new and k.points is not null), false));
end;
$$;

revoke all on function public.actividad_copiar(uuid, uuid, boolean) from public, anon;
grant execute on function public.actividad_copiar(uuid, uuid, boolean) to authenticated;
