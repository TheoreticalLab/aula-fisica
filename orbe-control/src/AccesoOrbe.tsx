/**
 * ORBE CONTROL · GESTIÓN DE ACCESO ESTUDIANTIL: solicitudes de acceso sin contraseña (verificación presencial),
 * historial inmutable, alertas y controles (interruptores por sección, monitores designados, suspensión inmediata).
 * Todo lo valida el servidor (migración 77); esta pantalla solo muestra y llama a sus funciones.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { rpc, supabase } from './supabase';
import {
  ACCION_EVENTO, ALERTA_TEXTO, ESTADO_SOLICITUD, ESTADOS_PESTANA, METODO_TEXTO, METODOS, ROL_TEXTO, normalizarCodigo, restante,
  type MetodoVerificacion, type Pestana,
} from '../../src/lib/acceso';
import type { AlertaAcceso, EventoAcceso, MonitorAcceso, PanelAcceso, ResultadoAccion, SeccionAcceso, SolicitudAcceso } from '../../src/api/acceso';

type Vista = Pestana | 'alertas' | 'controles';
type Accion = { tipo: 'aprobar' | 'rechazar' | 'revocar' | 'cancelar' | 'detalle'; s: SolicitudAcceso };
const fecha = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const dia = (d: string, fin = false) => (d ? new Date(new Date(d + 'T00:00:00').getTime() + (fin ? 86400000 : 0)).toISOString() : null);
const msg = (e: unknown) => {
  const t = e instanceof Error ? e.message : String(e);
  return /Could not find the function|PGRST202|schema cache/i.test(t) ? 'Falta instalar la migración 77 en el servidor.' : t;
};

export function AccesoOrbe() {
  const [panel, setPanel] = useState<PanelAcceso | null>(null);
  const [vista, setVista] = useState<Vista>('pendientes');
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    try { setPanel(await rpc<PanelAcceso>('acceso_estado_panel')); setError(null); } catch (e) { setError(msg(e)); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  if (error) return <p className="error">{error}</p>;
  if (!panel) return <p className="tenue">Cargando…</p>;
  const pendientes = panel.secciones.reduce((n, s) => n + s.pendientes, 0);
  return (
    <div>
      {!panel.recuperacion && <p className="aviso">La recuperación supervisada está desactivada (interruptor general).</p>}
      <div className="pestanas" role="tablist">
        {([['pendientes', `⏳ Pendientes${pendientes ? ` (${pendientes})` : ''}`], ['aprobadas', '✅ Aprobadas'], ['rechazadas', '⛔ Rechazadas'], ['historial', '📜 Historial'],
          ['alertas', `🚨 Alertas${panel.alertas ? ` (${panel.alertas})` : ''}`], ['controles', '⚙️ Controles']] as [Vista, string][]).map(([v, t]) => (
          <button key={v} role="tab" aria-selected={vista === v} className={vista === v ? 'activa' : ''} onClick={() => setVista(v)}>{t}</button>
        ))}
      </div>
      {vista === 'historial' ? <Historial secciones={panel.secciones} />
        : vista === 'alertas' ? <Alertas alCambiar={cargar} />
        : vista === 'controles' ? <Controles panel={panel} alCambiar={cargar} />
        : <Lista key={vista} pestana={vista} secciones={panel.secciones} alCambiar={cargar} />}
    </div>
  );
}

function Lista({ pestana, secciones, alCambiar }: { pestana: Exclude<Pestana, 'historial'>; secciones: SeccionAcceso[]; alCambiar: () => Promise<void> }) {
  const [f, setF] = useState({ seccion: '', buscar: '', desde: '', hasta: '', estado: '', actor: '', rol: '' });
  const [xs, setXs] = useState<SolicitudAcceso[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const cargar = useCallback(async () => {
    try {
      setXs(await rpc<SolicitudAcceso[]>('acceso_solicitudes_lista', {
        p_estados: f.estado ? [f.estado] : ESTADOS_PESTANA[pestana], p_class: f.seccion || null, p_desde: dia(f.desde), p_hasta: dia(f.hasta, true),
        p_buscar: f.buscar.trim() || null, p_actor: f.actor || null, p_rol: f.rol || null, p_limite: 300,
      }));
      setError(null);
    } catch (e) { setError(msg(e)); }
  }, [pestana, f]);
  useEffect(() => { void cargar(); const t = setInterval(() => document.visibilityState === 'visible' && void cargar(), 15000); return () => clearInterval(t); }, [cargar]);
  const actores = useMemo(() => [...new Map((xs ?? []).filter((s) => s.aprobada_por).map((s) => [s.aprobada_por!, `${s.aprobada_por_nombre ?? '—'} (${ROL_TEXTO[s.aprobada_rol ?? ''] ?? ''})`])).entries()], [xs]);
  const terminar = async () => { setAccion(null); await cargar(); await alCambiar(); };
  return (
    <div>
      <div className="filtros">
        <select aria-label="Sección" value={f.seccion} onChange={(e) => setF({ ...f, seccion: e.target.value })}>
          <option value="">Todas las secciones</option>
          {secciones.map((s) => <option key={s.class_id} value={s.class_id}>{s.curso} · {s.seccion}</option>)}
        </select>
        <input aria-label="Estudiante" placeholder="Estudiante (nombre o ID)" value={f.buscar} onChange={(e) => setF({ ...f, buscar: e.target.value })} />
        <div className="fila-fechas">
          <input type="date" aria-label="Desde" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
          <input type="date" aria-label="Hasta" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        </div>
        {pestana !== 'pendientes' && (
          <>
            <select aria-label="Estado" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
              <option value="">Todos los estados</option>
              {ESTADOS_PESTANA[pestana].map((e) => <option key={e} value={e}>{ESTADO_SOLICITUD[e].texto}</option>)}
            </select>
            <select aria-label="Responsable" value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })}>
              <option value="">Cualquier monitor o profesor</option>
              {actores.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <select aria-label="Papel" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
              <option value="">Monitores y profesores</option>
              <option value="monitor">Solo monitores</option>
              <option value="profesor">Solo profesores</option>
            </select>
          </>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {xs && xs.length === 0 && <p className="vacio">No hay solicitudes en esta vista.</p>}
      <div className="grupo">
        {(xs ?? []).map((s) => (
          <div key={s.id} className="tarjeta">
            <div className="grupo-cab">
              <span className="nombre">{s.estudiante_nombre} <span className="tenue">{s.estudiante_login}</span></span>
              <span className={s.estado === 'completada' ? 'verde' : s.estado === 'pendiente' ? 'advertencia' : 'tenue'}>{ESTADO_SOLICITUD[s.estado].texto}</span>
            </div>
            <p className="tenue">{s.seccion} · {fecha(s.created_at)} · para {s.destinatario === 'monitor' ? 'monitor' : 'profesor'}{s.estado === 'pendiente' ? ` · vence en ${restante(s.expires_at, Date.now())}` : ''}</p>
            {s.aprobada_por_nombre && <p className="pequeno">Aprobada por {s.aprobada_por_nombre} ({ROL_TEXTO[s.aprobada_rol ?? ''] ?? ''}) · {METODO_TEXTO[s.metodo_verificacion ?? ''] ?? '—'}</p>}
            {s.motivo && <p className="pequeno">Motivo: {s.motivo}</p>}
            {s.otras_activas > 0 && <p className="pequeno advertencia">⚠ {s.otras_activas} otra(s) solicitud(es) activa(s) para esta cuenta.</p>}
            <div className="fila">
              {s.estado === 'pendiente' && <button className="boton" onClick={() => setAccion({ tipo: 'aprobar', s })}>Aprobar</button>}
              {s.estado === 'pendiente' && <button className="boton secundario" onClick={() => setAccion({ tipo: 'rechazar', s })}>Rechazar</button>}
              {s.estado === 'pendiente' && <button className="boton secundario" onClick={() => setAccion({ tipo: 'cancelar', s })}>Cancelar</button>}
              {s.estado === 'aprobada' && <button className="boton secundario" onClick={() => setAccion({ tipo: 'revocar', s })}>Revocar</button>}
              <button className="enlace" onClick={() => setAccion({ tipo: 'detalle', s })}>Detalles</button>
            </div>
          </div>
        ))}
      </div>
      {accion && <Dialogo a={accion} alCerrar={() => setAccion(null)} alTerminar={terminar} />}
    </div>
  );
}

function Dialogo({ a, alCerrar, alTerminar }: { a: Accion; alCerrar: () => void; alTerminar: () => Promise<void> }) {
  const [codigo, setCodigo] = useState('');
  const [metodo, setMetodo] = useState<MetodoVerificacion | ''>('');
  const [texto, setTexto] = useState('');
  const [verifique, setVerifique] = useState(false);
  const [r, setR] = useState<ResultadoAccion | null>(null);
  const [busy, setBusy] = useState(false);
  const [ev, setEv] = useState<EventoAcceso[] | null>(null);
  useEffect(() => {
    if (a.tipo === 'detalle') void rpc<EventoAcceso[]>('acceso_eventos_lista', { p_solicitud: a.s.id, p_limite: 200 }).then(setEv).catch(() => setEv([]));
  }, [a]);
  async function enviar() {
    setBusy(true);
    try {
      const res = a.tipo === 'aprobar'
        ? await rpc<ResultadoAccion>('acceso_aprobar', { p_solicitud: a.s.id, p_codigo: normalizarCodigo(codigo), p_metodo: metodo, p_nota: texto.trim() || null })
        : await rpc<ResultadoAccion>('acceso_cerrar', { p_solicitud: a.s.id, p_accion: a.tipo, p_motivo: texto.trim() });
      setR(res);
      if (res.ok) await alTerminar();
    } catch (e) { setR({ ok: false, error: msg(e) }); } finally { setBusy(false); }
  }
  const titulo = { aprobar: 'Verificar identidad y aprobar', rechazar: 'Rechazar solicitud', revocar: 'Revocar autorización pendiente', cancelar: 'Cancelar solicitud', detalle: 'Detalles' }[a.tipo];
  return (
    <div className="velo" onClick={alCerrar}>
      <div className="tarjeta modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        <p className="tenue">{a.s.estudiante_nombre} · {a.s.estudiante_login} · {a.s.seccion}</p>
        {a.tipo === 'detalle' ? (
          <div className="modal-plano">
            <p className="pequeno">Flujo {a.s.flujo_id} · pedida {fecha(a.s.created_at)} · vence {fecha(a.s.expires_at)}{a.s.dispositivo ? ` · ${a.s.dispositivo}` : ''}{a.s.navegador ? `, ${a.s.navegador}` : ''}</p>
            {(ev ?? []).map((e) => (
              <p key={e.id} className={`pequeno${e.resultado === 'ok' ? '' : ' error'}`}>
                {fecha(e.created_at)} · {ACCION_EVENTO[e.accion] ?? e.accion} · {e.actor_nombre ?? ROL_TEXTO[e.actor_rol]} ({ROL_TEXTO[e.actor_rol] ?? e.actor_rol}){e.motivo ? ` · ${e.motivo}` : ''}
              </p>
            ))}
          </div>
        ) : (
          <div className="modal-plano">
            {a.tipo === 'aprobar' && (
              <>
                <p className="aviso">Apruebe solo con el estudiante delante y su identidad comprobada. Escriba el código que muestra SU dispositivo. Nunca pida su contraseña.</p>
                <input className="codigo" style={{ fontSize: '2rem' }} aria-label="Código del dispositivo" autoComplete="off" maxLength={8} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
                <select aria-label="Método de verificación" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoVerificacion)}>
                  <option value="">¿Cómo verificó la identidad?</option>
                  {METODOS.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
                </select>
                <label className="casilla"><input type="checkbox" checked={verifique} onChange={(e) => setVerifique(e.target.checked)} /> Verifiqué en persona que es el titular.</label>
              </>
            )}
            <input aria-label={a.tipo === 'aprobar' ? 'Nota' : 'Motivo'} placeholder={a.tipo === 'aprobar' ? 'Nota (opcional)' : a.tipo === 'rechazar' ? 'Motivo (obligatorio)' : 'Motivo'} maxLength={300} value={texto} onChange={(e) => setTexto(e.target.value)} />
            {r && !r.ok && <p className="error">{r.error}</p>}
            {r?.codigo === 'sesion_no_reciente' && <button className="boton secundario" onClick={() => void supabase.auth.signOut()}>Volver a iniciar sesión</button>}
            <button className="boton" disabled={busy || (a.tipo === 'aprobar' ? normalizarCodigo(codigo).length !== 6 || !metodo || !verifique : a.tipo === 'rechazar' && !texto.trim())} onClick={() => void enviar()}>
              {busy ? 'Guardando…' : titulo}
            </button>
          </div>
        )}
        <div className="fila"><button className="enlace" onClick={alCerrar}>Cerrar</button></div>
      </div>
    </div>
  );
}

function Historial({ secciones }: { secciones: SeccionAcceso[] }) {
  const [f, setF] = useState({ seccion: '', buscar: '', desde: '', hasta: '' });
  const [xs, setXs] = useState<EventoAcceso[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void rpc<EventoAcceso[]>('acceso_eventos_lista', { p_class: f.seccion || null, p_desde: dia(f.desde), p_hasta: dia(f.hasta, true), p_limite: 1000 })
      .then((d) => { setXs(d); setError(null); }).catch((e) => setError(msg(e)));
  }, [f.seccion, f.desde, f.hasta]);
  const b = f.buscar.trim().toLowerCase();
  const vis = (xs ?? []).filter((e) => !b || `${e.estudiante_nombre ?? ''} ${e.estudiante_login ?? ''} ${e.actor_nombre ?? ''}`.toLowerCase().includes(b));
  return (
    <div>
      <div className="filtros">
        <select aria-label="Sección" value={f.seccion} onChange={(e) => setF({ ...f, seccion: e.target.value })}>
          <option value="">Todas las secciones</option>
          {secciones.map((s) => <option key={s.class_id} value={s.class_id}>{s.curso} · {s.seccion}</option>)}
        </select>
        <input aria-label="Estudiante, monitor o profesor" placeholder="Estudiante, monitor o profesor" value={f.buscar} onChange={(e) => setF({ ...f, buscar: e.target.value })} />
        <div className="fila-fechas">
          <input type="date" aria-label="Desde" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
          <input type="date" aria-label="Hasta" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        </div>
      </div>
      <p className="tenue">Registro inmutable con hora del servidor: nadie puede borrarlo ni modificarlo.</p>
      {error && <p className="error">{error}</p>}
      {xs && vis.length === 0 && <p className="vacio">Sin eventos.</p>}
      <div className="grupo">
        {vis.map((e) => (
          <div key={e.id} className={`tarjeta${e.resultado === 'ok' ? '' : ' rechazo'}`}>
            <span className="nombre">{ACCION_EVENTO[e.accion] ?? e.accion}</span> <span className="tenue">{fecha(e.created_at)} · {e.resultado}</span>
            <p className="pequeno">{e.actor_nombre ?? '—'} ({ROL_TEXTO[e.actor_rol] ?? e.actor_rol}){e.estudiante_nombre ? ` → ${e.estudiante_nombre}` : ''}{e.seccion ? ` · ${e.seccion}` : ''}{e.metodo ? ` · ${METODO_TEXTO[e.metodo] ?? e.metodo}` : ''}{e.motivo ? ` · ${e.motivo}` : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Alertas({ alCambiar }: { alCambiar: () => Promise<void> }) {
  const [xs, setXs] = useState<AlertaAcceso[] | null>(null);
  const [todas, setTodas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    try { setXs(await rpc<AlertaAcceso[]>('acceso_alertas_lista', { p_todas: todas })); setError(null); } catch (e) { setError(msg(e)); }
  }, [todas]);
  useEffect(() => { void cargar(); }, [cargar]);
  return (
    <div>
      <label className="casilla"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Mostrar también las atendidas</label>
      {error && <p className="error">{error}</p>}
      {xs && xs.length === 0 && <p className="vacio">Sin alertas.</p>}
      <div className="grupo">
        {(xs ?? []).map((a) => (
          <div key={a.id} className="tarjeta">
            <span className="nombre">{ALERTA_TEXTO[a.tipo] ?? a.tipo}</span>
            <p className="pequeno">{fecha(a.created_at)}{a.seccion ? ` · ${a.seccion}` : ''}{a.actor_nombre ? ` · monitor: ${a.actor_nombre}` : ''}{a.estudiante_nombre ? ` · estudiante: ${a.estudiante_nombre}` : ''}{a.detalle ? ` · ${a.detalle}` : ''}</p>
            {a.atendida_at ? <p className="tenue">Atendida por {a.atendida_por_nombre ?? '—'}</p>
              : <button className="boton secundario" onClick={() => void rpc('acceso_alerta_atender', { p_id: a.id }).then(cargar).then(alCambiar)}>Marcar atendida</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Controles({ panel, alCambiar }: { panel: PanelAcceso; alCambiar: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hacer = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const r = (await fn()) as ResultadoAccion | null;
      if (r && r.ok === false) setError(r.error ?? 'No se pudo guardar.');
    } catch (e) { setError(msg(e)); } finally { setBusy(false); await alCambiar(); }
  };
  const c = panel.config;
  return (
    <div className="grupo">
      {!panel.sesion_reciente && (
        <p className="aviso">Para ACTIVAR o delegar hace falta un inicio de sesión reciente. <button className="enlace" onClick={() => void supabase.auth.signOut()}>Volver a iniciar sesión</button>. Desactivar funciona siempre.</p>
      )}
      {error && <p className="error">{error}</p>}
      {c && (
        <div className="tarjeta">
          <h2>Interruptores generales</h2>
          {([['passkeys', 'Passkeys (acceso sin contraseña)', c.passkeys], ['recuperacion', 'Recuperación supervisada', c.recuperacion], ['monitores', 'Recuperación por monitores', c.recuperacion_monitores]] as const).map(([k, t, v]) => (
            <label key={k} className="casilla"><input type="checkbox" disabled={busy} checked={v}
              onChange={(e) => void hacer(() => rpc('acceso_config_guardar', { p_passkeys: k === 'passkeys' ? e.target.checked : null, p_recuperacion: k === 'recuperacion' ? e.target.checked : null, p_monitores: k === 'monitores' ? e.target.checked : null }))} /> {t}</label>
          ))}
          <p className="tenue">Solicitud {c.minutos_solicitud} min · aprobación {c.minutos_aprobacion} min · sesión reciente {c.horas_sesion_reciente} h · máx. {c.max_aprobaciones_monitor_dia} por monitor al día.</p>
        </div>
      )}
      {panel.secciones.filter((s) => s.papel !== 'monitor').map((s) => <Seccion key={s.class_id} s={s} busy={busy} hacer={hacer} />)}
    </div>
  );
}

function Seccion({ s, busy, hacer }: { s: SeccionAcceso; busy: boolean; hacer: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [mon, setMon] = useState<MonitorAcceso[] | null>(null);
  const cargar = useCallback(() => rpc<MonitorAcceso[]>('acceso_monitores_lista', { p_class: s.class_id }).then(setMon).catch(() => setMon([])), [s.class_id]);
  useEffect(() => { void cargar(); }, [cargar]);
  const h = (fn: () => Promise<unknown>) => hacer(fn).then(cargar);
  return (
    <div className="tarjeta">
      <h2>{s.curso} · {s.seccion}</h2>
      <label className="casilla"><input type="checkbox" disabled={busy} checked={s.recuperacion}
        onChange={(e) => void h(() => rpc('acceso_seccion_guardar', { p_class: s.class_id, p_recuperacion: e.target.checked, p_monitores: s.monitores && e.target.checked }))} /> Recuperación supervisada</label>
      <label className="casilla"><input type="checkbox" disabled={busy || !s.recuperacion} checked={s.monitores}
        onChange={(e) => void h(() => rpc('acceso_seccion_guardar', { p_class: s.class_id, p_recuperacion: s.recuperacion, p_monitores: e.target.checked }))} /> Monitores designados pueden aprobar</label>
      {(mon ?? []).map((m) => (
        <div key={m.user_id} className="alumno">
          <span>{m.full_name} <span className="tenue">{m.login_id}{m.aprobaciones_24h ? ` · ${m.aprobaciones_24h} en 24 h` : ''}</span></span>
          <button className="boton secundario" disabled={busy} onClick={() => void h(() => rpc('acceso_monitor_permiso', { p_class: s.class_id, p_user: m.user_id, p_activo: !m.delegado }))}>
            {m.delegado ? 'Suspender' : 'Otorgar'}
          </button>
        </div>
      ))}
      {mon && mon.length === 0 && <p className="tenue">La sección no tiene monitores.</p>}
      <p className="tenue">Ningún monitor recibe el permiso automáticamente; suspenderlo anula al instante sus aprobaciones sin canjear.</p>
    </div>
  );
}
