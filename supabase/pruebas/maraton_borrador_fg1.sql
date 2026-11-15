-- Prueba del maratón «MARATÓN DE RECUPERACIÓN — FÍSICA GENERAL 1» (datos privados 20261114170100_…), sobre la copia de
-- producción (npm run probar). El profesor puede programarlo y publicarlo: la prueba comprueba lo que debe cumplirse en
-- CUALQUIER estado y, según el estado:
--  · borrador → nadie de la sección lo ve y la revisión solo pide decisiones docentes (fecha, criterios);
--  · publicado → tiene fecha y la revisión no tiene errores; lo ven los estudiantes matriculados.
-- Siempre: no califica, no está entre las actividades ni en el registro de calificaciones, el banco no presenta temas
-- excluidos ni plantillas sin validar en temas pendientes. Sin datos de producción (--limpio) no comprueba nada.
begin;

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;

do $$
declare m public.maraton_actividades; s record; r jsonb; n integer; v_ve boolean;
begin
  select * into m from public.maraton_actividades where id = 'f9a7a700-0000-4000-8000-000000000001';
  if m.id is null then return; end if;
  if m.calificacion_automatica then raise exception 'FALLO: calificación automática activada'; end if;
  if m.class_id <> 'cb7410e2-7922-4a15-89e3-6e3d50b4b424' then raise exception 'FALLO: sección'; end if;
  if exists (select 1 from public.activity_grade_links l where l.activity_id = m.id) or exists (select 1 from public.activities a where a.id = m.id) then
    raise exception 'FALLO: el maratón aparece entre las actividades calificables'; end if;
  if exists (select 1 from public.maraton_plantillas p join public.maraton_temas t on t.banco_id = p.banco_id and t.codigo = p.tema
              where p.banco_id = 'fg1' and (t.estado = 'excluido' or (t.estado = 'pendiente' and p.estado = 'validada' and p.revisado_por is null))) then
    raise exception 'FALLO: plantillas validadas en temas excluidos, o en temas pendientes sin revisión docente'; end if;
  r := public.maraton_revision(m);

  if m.estado = 'borrador' then
    if exists (select 1 from public.maraton_inscripciones where maraton_id = m.id and not prueba) then raise exception 'FALLO: el borrador tiene participantes'; end if;
    for s in select e.user_id from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' where e.class_id = m.class_id loop
      perform pg_temp.como(s.user_id::text);
      if public.maraton_mis_maratones()::text like '%f9a7a700-0000-4000-8000-000000000001%' then raise exception 'FALLO: un estudiante ve el borrador'; end if;
      begin
        perform public.maraton_estado(m.id);
        raise exception 'FALLO: un estudiante abrió el borrador';
      exception when insufficient_privilege then null; end;
    end loop;
    if (select count(*) from jsonb_array_elements_text(r -> 'errores') x where x not like '%fecha de inicio%' and x not like '%PENDIENTE%' and x not like '%ya pasó%') > 0 then
      raise exception 'FALLO: errores inesperados en la revisión del borrador: %', r -> 'errores'; end if;
  elsif m.estado = 'publicado' then
    if m.fecha_inicio is null then raise exception 'FALLO: publicado sin fecha de inicio'; end if;
    if (select count(*) from jsonb_array_elements_text(r -> 'errores') x where x not like '%ya pasó%') > 0 then
      raise exception 'FALLO: publicado con errores de configuración: %', r -> 'errores'; end if;
    for n in 1 .. least(6, (public.maraton_cfg(m.config) -> 'dificultad' ->> 'niveles')::int) loop
      if coalesce((r -> 'disponibles' ->> n::text)::int, 0) = 0 then raise exception 'FALLO: sin problemas validados en D%', n; end if;
    end loop;
    -- un estudiante matriculado (del grupo, si lo hay) lo ve en su lista
    select e.user_id into s from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
      where e.class_id = m.class_id and (m.group_id is null or e.group_id = m.group_id) and public.account_ok(e.user_id) limit 1;
    if s.user_id is not null then
      perform pg_temp.como(s.user_id::text);
      v_ve := public.maraton_mis_maratones()::text like '%f9a7a700-0000-4000-8000-000000000001%';
      if not v_ve then raise exception 'FALLO: un estudiante matriculado no ve el maratón publicado'; end if;
    end if;
  end if;
end $$;

select 'maraton_borrador_fg1: PRUEBAS PASARON' as resultado;
rollback;
