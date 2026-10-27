-- =============================================================================
-- Centro de seguridad — «Fallaron y luego entraron».
--
-- Un fallo aislado informa poco; lo valioso es saber si QUIEN FALLÓ LOGRÓ ENTRAR. Por cada acceso correcto se
-- miran los intentos fallidos (contraseña incorrecta, ID inexistente, suspendida) y los rechazos por bloqueo de la
-- misma cuenta desde el acceso correcto anterior (como máximo 24 h antes), y se compara el acceso con esos fallos
-- y con el historial de la cuenta:
--   · mismo_dispositivo / mismo_origen: el acceso salió del mismo dispositivo o red que los fallos (= «el que falló
--     entró»).
--   · contexto habitual: dispositivo reconocido por accesos correctos anteriores, o red ya vista en accesos
--     correctos anteriores a los fallos.
-- Nivel (reglas visibles, no probabilidades):
--   baja      contexto habitual (lo normal: el titular se equivocó y luego acertó)
--   moderada  primer acceso de la cuenta (sin historial), o contexto nuevo sin relación con los fallos
--   alta      el que falló entró desde un contexto nunca visto, o una cuenta privilegiada entró desde un contexto nuevo
--   critica   lo anterior, en una cuenta privilegiada (administrador o profesor)
-- Limitación: una red compartida (laboratorio, NAT del operador) puede hacer «habitual» un origen ajeno.
-- Solo lectura sobre los datos (no modifica la evidencia). Aditiva: una función nueva.
-- =============================================================================

create or replace function public.sec_access_after_failures(p_days integer)
returns table (event_id uuid, created_at timestamptz, login_id text, full_name text, student_code text, rol text,
  fallos bigint, rechazos bigint, primer_fallo timestamptz, ultimo_fallo timestamptz, segundos_tras_ultimo_fallo numeric,
  origenes_fallos bigint, dispositivos_fallos bigint, mismo_origen boolean, mismo_dispositivo boolean,
  dispositivo_reconocido boolean, origen_visto_antes boolean, primer_acceso boolean,
  ip_hash text, country text, paises_fallos text[], browser text, os text, device_type text,
  nivel text, motivo text, clasificacion text)
language plpgsql security definer set search_path = ''
as $$
declare v_desde timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 180));
begin
  perform public.sec_assert_admin();
  perform public.sec_log('consulta_acceso_tras_fallos', jsonb_build_object('dias', p_days));
  return query
  with s as (
    select a.event_id eid, a.created_at t, a.login_id lid, a.user_id uid, a.ip_hash ip, a.device_hash dev, a.country pais,
      a.browser nav, a.os so, a.device_type tipo, p.full_name nom, p.student_code cod, p.role::text rl,
      (select max(b.created_at) from public.login_attempts b where b.login_id = a.login_id and b.success and b.created_at < a.created_at) prev_ok
    from public.login_attempts a left join public.profiles p on p.id = a.user_id
    where a.success and a.created_at > v_desde
  ), c as (
    select s.*, f.*,
      exists (select 1 from public.known_devices k where k.user_id = s.uid and k.device_hash = s.dev and k.revoked_at is null
              and k.first_seen < s.t) reconocido,
      exists (select 1 from public.login_attempts o where o.login_id = s.lid and o.success and s.ip is not null and o.ip_hash = s.ip
              and o.created_at < f.f_primero) visto
    from s cross join lateral (
      select count(*) filter (where x.reason in ('bad_password','unknown_id','suspended')) n_f,
        count(*) filter (where x.reason in ('locked','rate_ip')) n_r,
        min(x.created_at) f_primero, max(x.created_at) f_ultimo,
        count(distinct x.ip_hash) n_ip, count(distinct x.device_hash) n_dev,
        coalesce(bool_or(x.ip_hash = s.ip), false) m_ip, coalesce(bool_or(x.device_hash = s.dev), false) m_dev,
        array_remove(array_agg(distinct x.country), null) paises
      from public.login_attempts x
      where x.login_id = s.lid and not x.success and x.reason in ('bad_password','unknown_id','suspended','locked','rate_ip')
        and x.created_at < s.t and x.created_at > greatest(coalesce(s.prev_ok, '-infinity'::timestamptz), s.t - interval '24 hours')
    ) f
    where f.n_f + f.n_r > 0
  ), n as (
    select c.*, c.prev_ok is null primero, (c.m_ip or c.m_dev) mismo, (c.reconocido or c.visto) habitual,
      coalesce(c.rl in ('admin','teacher'), false) priv
    from c
  ), m as (
    select n.*,
      case when n.habitual then 'baja' when n.primero then 'moderada' when n.mismo and n.priv then 'critica'
           when n.mismo or n.priv then 'alta' else 'moderada' end niv,
      case when n.habitual then 'Entró desde un dispositivo u origen ya usado en accesos correctos anteriores: compatible con que el titular se equivocó y luego acertó.'
           when n.primero then 'Primer acceso correcto de la cuenta: no hay historial con que comparar (habitual al estrenar la cuenta).'
           when n.mismo then 'Quien falló es quien entró (mismo dispositivo u origen que los fallos), desde un contexto nunca visto en esta cuenta. Confírmelo con el titular.'
           else 'Entró desde un contexto nuevo; los fallos vinieron de otro dispositivo u origen.' end
      || case when n.priv and not n.habitual then ' Cuenta privilegiada.' else '' end mot
    from n
  )
  select m.eid, m.t, m.lid, m.nom, m.cod, m.rl, m.n_f, m.n_r, m.f_primero, m.f_ultimo,
    round(extract(epoch from m.t - m.f_ultimo)::numeric, 1), m.n_ip, m.n_dev, m.m_ip, m.m_dev, m.reconocido, m.visto, m.primero,
    m.ip, m.pais, m.paises, m.nav, m.so, m.tipo, m.niv, m.mot,
    (select sa.classification from public.security_annotations sa where sa.event_id = m.eid and sa.classification is not null
      order by sa.created_at desc limit 1)
  from m
  order by array_position(array['critica','alta','moderada','baja'], m.niv), m.t desc;
end;
$$;

revoke all on function public.sec_access_after_failures(integer) from public, anon;
grant execute on function public.sec_access_after_failures(integer) to authenticated;
