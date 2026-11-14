-- Prueba del borrador «MARATÓN DE RECUPERACIÓN — FÍSICA GENERAL 1» (datos privados 20261114170100_…).
-- Con la copia de producción (npm run probar): comprueba que existe como BORRADOR, sin fecha, invisible para TODOS los
-- estudiantes de la sección, sin participantes ni notas, y que el banco fg1 cumple lo exigido para poder publicarlo
-- cuando el profesor lo programe. Sin datos de producción (--limpio) no hay borrador y la prueba no comprueba nada.
begin;

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
$$;

do $$
declare m public.maraton_actividades; s record; r jsonb; v_cfg jsonb; n integer;
begin
  select * into m from public.maraton_actividades where id = 'f9a7a700-0000-4000-8000-000000000001';
  if m.id is null then return; end if;
  if m.estado <> 'borrador' or m.fecha_inicio is not null or m.publicado_at is not null or m.calificacion_automatica then
    raise exception 'FALLO: el maratón de FG1 no está en borrador sin fecha: % %', m.estado, m.fecha_inicio; end if;
  if m.titulo <> 'MARATÓN DE RECUPERACIÓN — FÍSICA GENERAL 1' or m.class_id <> 'cb7410e2-7922-4a15-89e3-6e3d50b4b424' then raise exception 'FALLO: título o sección'; end if;
  v_cfg := public.maraton_cfg(m.config);
  if (v_cfg -> 'programacion' ->> 'jornadas')::int <> 14 or v_cfg -> 'programacion' ->> 'modo' <> 'consecutivas'
     or (v_cfg -> 'carga' ->> 'cuota')::numeric <> 12 or (v_cfg -> 'dificultad' ->> 'nivel_inicial')::int <> 2
     or (v_cfg -> 'dificultad' ->> 'niveles')::int <> 6 or v_cfg -> 'dificultad' -> 'pesos' <> '[1.00, 1.20, 1.40, 1.50, 1.00, 1.00]'::jsonb
     or (v_cfg -> 'comodines' ->> 'total')::int <> 10 or (v_cfg -> 'carga' ->> 'alternativa_minutos')::numeric <> 60
     or (v_cfg -> 'carga' ->> 'alternativa_intentos')::int <> 8 or (v_cfg -> 'carga' ->> 'objetivo_min')::int <> 60
     or (v_cfg -> 'carga' ->> 'objetivo_max')::int <> 75 or not (v_cfg -> 'informes' ->> 'estudiante')::boolean
     or not (v_cfg -> 'informes' ->> 'docente')::boolean or v_cfg -> 'programacion' ->> 'zona' <> 'America/Santo_Domingo' then
    raise exception 'FALLO: configuración inicial: %', v_cfg; end if;
  if exists (select 1 from public.maraton_inscripciones where maraton_id = m.id) then raise exception 'FALLO: el borrador tiene participantes'; end if;
  -- ningún estudiante matriculado lo ve ni puede abrirlo
  for s in select e.user_id from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student' where e.class_id = m.class_id loop
    perform pg_temp.como(s.user_id::text);
    if public.maraton_mis_maratones()::text like '%f9a7a700-0000-4000-8000-000000000001%' then raise exception 'FALLO: un estudiante ve el borrador'; end if;
    begin
      perform public.maraton_estado(m.id);
      raise exception 'FALLO: un estudiante abrió el borrador';
    exception when insufficient_privilege then null; end;
  end loop;
  -- banco: temas verificados con problemas validados en los seis niveles; temas excluidos sin problemas
  r := public.maraton_revision(m);
  for n in 1 .. 6 loop
    if coalesce((r -> 'disponibles' ->> n::text)::int, 0) < 100 then raise exception 'FALLO: pocas variantes validadas en D%: %', n, r -> 'disponibles'; end if;
  end loop;
  if exists (select 1 from public.maraton_plantillas p join public.maraton_temas t on t.banco_id = p.banco_id and t.codigo = p.tema
              where p.banco_id = 'fg1' and (t.estado = 'excluido' or (t.estado = 'pendiente' and p.estado = 'validada'))) then
    raise exception 'FALLO: plantillas validadas en temas excluidos o pendientes'; end if;
  -- la revisión solo debe pedir lo que es decisión del profesor: la fecha y los criterios de recuperación
  if (select count(*) from jsonb_array_elements_text(r -> 'errores') x where x not like '%fecha de inicio%' and x not like '%PENDIENTE%') > 0 then
    raise exception 'FALLO: errores inesperados en la revisión: %', r -> 'errores'; end if;
  -- el registro de calificaciones no lo conoce
  if exists (select 1 from public.activity_grade_links l where l.activity_id = m.id) or exists (select 1 from public.activities a where a.id = m.id) then
    raise exception 'FALLO: el maratón aparece entre las actividades calificables'; end if;
end $$;

select 'maraton_borrador_fg1: PRUEBAS PASARON' as resultado;
rollback;
