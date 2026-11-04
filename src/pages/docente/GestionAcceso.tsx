/**
 * GESTIÓN DE ACCESO ESTUDIANTIL (aula): solicitudes de acceso sin contraseña de las secciones donde quien entra es
 * profesor, administrador o monitor DELEGADO. Esta interfaz no decide permisos: cada acción la valida el servidor
 * (sección, papel, sesión reciente, código del dispositivo) y queda en la auditoría inmutable.
 * El monitor no ve tokens, contraseñas ni códigos: escribe el código que le muestra el estudiante en persona.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import {
  alertasAcceso, aprobarAcceso, atenderAlerta, cerrarAcceso, eventosAcceso, guardarConfigAcceso, guardarSeccionAcceso, monitoresAcceso, panelAcceso,
  permisoMonitor, solicitudesAcceso, type PanelAcceso, type ResultadoAccion, type SeccionAcceso, type SolicitudAcceso,
} from '@/api/acceso';
import {
  ACCION_EVENTO, ALERTA_TEXTO, ESTADO_SOLICITUD, ESTADOS_PESTANA, METODO_TEXTO, METODOS, ROL_TEXTO, normalizarCodigo, restante,
  type MetodoVerificacion, type Pestana,
} from '@/lib/acceso';
import { useAsync } from '@/lib/util';
import { Badge, Empty, ErrorBox, Field, Modal, Notice, PageTitle, Spinner, Tabs } from '@/components/ui';

type Vista = Pestana | 'controles' | 'alertas';
const fecha = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const inicioDia = (d: string) => (d ? new Date(d + 'T00:00:00').toISOString() : null);
const finDia = (d: string) => (d ? new Date(new Date(d + 'T00:00:00').getTime() + 86400000).toISOString() : null);

export default function GestionAcceso() {
  const panel = useAsync(() => panelAcceso(), []);
  const [vista, setVista] = useState<Vista>('pendientes');
  if (panel.loading && !panel.data) return <Spinner />;
  if (panel.error) return <ErrorBox error={panel.error} onRetry={() => void panel.reload()} />;
  const p = panel.data!;
  const docente = p.secciones.some((s) => s.papel !== 'monitor');
  if (!p.secciones.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Gestión de acceso estudiantil" />
        <Notice>No tiene secciones con permiso para gestionar el acceso de estudiantes.</Notice>
      </div>
    );
  }
  const pendientes = p.secciones.reduce((n, s) => n + s.pendientes, 0);
  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Gestión de acceso estudiantil" subtitle="Recuperación de acceso con verificación presencial de la identidad." />
      {!p.recuperacion && <Notice tone="warn">La recuperación supervisada está desactivada en el aula (interruptor general).</Notice>}
      <Tabs<Vista>
        value={vista}
        onChange={setVista}
        tabs={[
          { id: 'pendientes', label: `Pendientes${pendientes ? ` (${pendientes})` : ''}` },
          { id: 'aprobadas', label: 'Aprobadas' },
          { id: 'rechazadas', label: 'Rechazadas' },
          { id: 'historial', label: 'Historial' },
          ...(docente ? [{ id: 'alertas' as Vista, label: `Alertas${p.alertas ? ` (${p.alertas})` : ''}` }, { id: 'controles' as Vista, label: 'Controles' }] : []),
        ]}
      />
      {vista === 'historial' ? <Historial secciones={p.secciones} />
        : vista === 'alertas' ? <Alertas alCambiar={() => void panel.reload()} />
        : vista === 'controles' ? <Controles panel={p} alCambiar={() => void panel.reload()} />
        : <Solicitudes key={vista} pestana={vista} secciones={p.secciones} docente={docente} alCambiar={() => void panel.reload()} />}
    </div>
  );
}

function Filtros({ secciones, f, setF, conEstudiante = true }: {
  secciones: SeccionAcceso[]; f: { seccion: string; buscar: string; desde: string; hasta: string }; setF: (f: { seccion: string; buscar: string; desde: string; hasta: string }) => void; conEstudiante?: boolean;
}) {
  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-4">
      <select className="campo" aria-label="Sección" value={f.seccion} onChange={(e) => setF({ ...f, seccion: e.target.value })}>
        <option value="">Todas las secciones</option>
        {secciones.map((s) => <option key={s.class_id} value={s.class_id}>{s.curso} · {s.seccion}</option>)}
      </select>
      {conEstudiante && <input className="campo" aria-label="Estudiante" placeholder="Estudiante (nombre o ID)" value={f.buscar} onChange={(e) => setF({ ...f, buscar: e.target.value })} />}
      <input className="campo" type="date" aria-label="Desde" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
      <input className="campo" type="date" aria-label="Hasta" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
    </div>
  );
}

function Solicitudes({ pestana, secciones, docente, alCambiar }: { pestana: Exclude<Pestana, 'historial'>; secciones: SeccionAcceso[]; docente: boolean; alCambiar: () => void }) {
  const [f, setF] = useState({ seccion: '', buscar: '', desde: '', hasta: '' });
  const [estado, setEstado] = useState('');
  const [actor, setActor] = useState('');
  const [rol, setRol] = useState('');
  const datos = useAsync(() => solicitudesAcceso({
    estados: estado ? [estado as SolicitudAcceso['estado']] : ESTADOS_PESTANA[pestana], class_id: f.seccion || null, buscar: f.buscar.trim() || null,
    desde: inicioDia(f.desde), hasta: finDia(f.hasta), actor: actor || null, rol: rol || null,
  }), [pestana, f.seccion, f.buscar, f.desde, f.hasta, estado, actor, rol]);
  const [accion, setAccion] = useState<{ tipo: 'aprobar' | 'rechazar' | 'revocar' | 'cancelar' | 'detalle'; s: SolicitudAcceso } | null>(null);
  const actores = useMemo(() => [...new Map((datos.data ?? []).filter((s) => s.aprobada_por).map((s) => [s.aprobada_por!, `${s.aprobada_por_nombre ?? '—'} (${ROL_TEXTO[s.aprobada_rol ?? ''] ?? s.aprobada_rol})`])).entries()], [datos.data]);
  const ahora = Date.now();
  const terminar = () => { setAccion(null); void datos.reload(); alCambiar(); };
  return (
    <>
      <Filtros secciones={secciones} f={f} setF={setF} />
      {pestana !== 'pendientes' && (
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <select className="campo" aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS_PESTANA[pestana].map((e) => <option key={e} value={e}>{ESTADO_SOLICITUD[e].texto}</option>)}
          </select>
          <select className="campo" aria-label="Aprobada por" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Cualquier responsable</option>
            {actores.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          {docente && (
            <select className="campo" aria-label="Papel" value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="">Monitor o profesor</option>
              <option value="monitor">Aprobadas por monitores</option>
              <option value="profesor">Aprobadas por profesores</option>
              <option value="admin">Aprobadas por administradores</option>
            </select>
          )}
        </div>
      )}
      {datos.loading && !datos.data ? <Spinner /> : <ErrorBox error={datos.error} onRetry={() => void datos.reload()} />}
      {datos.data && datos.data.length === 0 && <Empty>No hay solicitudes en esta vista.</Empty>}
      <div className="flex justify-end"><button className="enlace text-sm" disabled={datos.loading} onClick={() => void datos.reload()}>{datos.loading ? 'Actualizando…' : 'Actualizar'}</button></div>
      <ul className="space-y-2">
        {(datos.data ?? []).map((s) => (
          <li key={s.id} className="tarjeta">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{s.estudiante_nombre || '(sin nombre)'} <span className="font-mono text-sm text-gray-500">{s.estudiante_login}</span></p>
                <p className="text-xs text-gray-500">
                  {s.curso} · {s.seccion} · pedida {fecha(s.created_at)} · para {s.destinatario === 'monitor' ? 'el monitor' : 'el profesor'}
                  {s.dispositivo || s.navegador ? ` · ${[s.dispositivo, s.navegador].filter(Boolean).join(', ')}` : ''}
                </p>
                {s.estado === 'pendiente' && <p className="text-xs text-gray-500">Vence en {restante(s.expires_at, ahora)}</p>}
                {s.aprobada_por_nombre && <p className="text-xs">Aprobada por {s.aprobada_por_nombre} ({ROL_TEXTO[s.aprobada_rol ?? ''] ?? s.aprobada_rol}) · {METODO_TEXTO[s.metodo_verificacion ?? ''] ?? '—'} · {fecha(s.aprobada_at)}</p>}
                {s.motivo && <p className="text-xs">Motivo: {s.motivo}{s.cerrada_por_nombre ? ` (${s.cerrada_por_nombre})` : ''}</p>}
                {s.otras_activas > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">⚠ Hay {s.otras_activas} otra(s) solicitud(es) activa(s) para esta cuenta: compruebe bien la identidad.</p>}
                {s.intentos_codigo > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">⚠ {s.intentos_codigo} código(s) incorrecto(s).</p>}
              </div>
              <Badge tone={ESTADO_SOLICITUD[s.estado].tono}>{ESTADO_SOLICITUD[s.estado].texto}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {s.estado === 'pendiente' && <button className="btn-primario" onClick={() => setAccion({ tipo: 'aprobar', s })}>Verificar y aprobar</button>}
              {s.estado === 'pendiente' && <button className="btn-secundario" onClick={() => setAccion({ tipo: 'rechazar', s })}>Rechazar</button>}
              {s.estado === 'pendiente' && s.mi_papel !== 'monitor' && <button className="btn-secundario" onClick={() => setAccion({ tipo: 'cancelar', s })}>Cancelar</button>}
              {s.estado === 'aprobada' && <button className="btn-secundario" onClick={() => setAccion({ tipo: 'revocar', s })}>Revocar autorización</button>}
              <button className="btn-texto" onClick={() => setAccion({ tipo: 'detalle', s })}>Ver detalles</button>
            </div>
          </li>
        ))}
      </ul>
      {accion?.tipo === 'aprobar' && <Aprobar s={accion.s} alCerrar={() => setAccion(null)} alTerminar={terminar} />}
      {accion && (accion.tipo === 'rechazar' || accion.tipo === 'revocar' || accion.tipo === 'cancelar') && <Cerrar tipo={accion.tipo} s={accion.s} alCerrar={() => setAccion(null)} alTerminar={terminar} />}
      {accion?.tipo === 'detalle' && <Detalle s={accion.s} alCerrar={() => setAccion(null)} />}
    </>
  );
}

function useReingreso() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return async () => {
    await signOut();
    nav('/ingresar', { replace: true, state: { from: '/gestion-acceso' } });
  };
}

function ErrorAccion({ r }: { r: ResultadoAccion | null }) {
  const reingresar = useReingreso();
  if (!r || r.ok) return null;
  return (
    <div className="mb-3">
      <ErrorBox error={r.error ?? 'No se pudo completar la acción.'} />
      {r.codigo === 'sesion_no_reciente' && <button className="btn-secundario" onClick={() => void reingresar()}>Volver a iniciar sesión</button>}
    </div>
  );
}

function Aprobar({ s, alCerrar, alTerminar }: { s: SolicitudAcceso; alCerrar: () => void; alTerminar: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [metodo, setMetodo] = useState<MetodoVerificacion | ''>('');
  const [nota, setNota] = useState('');
  const [verifique, setVerifique] = useState(false);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<ResultadoAccion | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  async function aprobar() {
    if (!metodo) return;
    setBusy(true);
    setFallo(null);
    try {
      const res = await aprobarAcceso(s.id, normalizarCodigo(codigo), metodo, nota.trim());
      setR(res);
      if (res.ok) alTerminar();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={alCerrar} title="Verificar identidad y aprobar">
      <Notice>
        Apruebe solo si tiene <strong>delante</strong> a {s.estudiante_nombre} ({s.estudiante_login}) y comprobó su identidad con un documento.
        Escriba el código que aparece en <strong>su</strong> dispositivo. Nunca le pida su contraseña.
      </Notice>
      <Field label="Código que muestra el dispositivo del estudiante">
        {(id) => <input id={id} className="campo text-center font-mono text-2xl uppercase tracking-[0.3em]" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={8}
          value={codigo} onChange={(e) => setCodigo(e.target.value)} />}
      </Field>
      <Field label="¿Cómo verificó la identidad?">
        {(id) => (
          <select id={id} className="campo" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoVerificacion)}>
            <option value="">Elija…</option>
            {METODOS.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
          </select>
        )}
      </Field>
      <Field label="Nota (opcional)" hint="Sin datos sensibles: por ejemplo, «carné vigente».">
        {(id) => <input id={id} className="campo" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />}
      </Field>
      <label className="mb-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={verifique} onChange={(e) => setVerifique(e.target.checked)} /> Verifiqué en persona que es el titular de la cuenta.</label>
      <ErrorAccion r={r} />
      <ErrorBox error={fallo} />
      <button className="btn-primario w-full" disabled={busy || normalizarCodigo(codigo).length !== 6 || !metodo || !verifique} onClick={() => void aprobar()}>
        {busy ? 'Aprobando…' : 'Aprobar acceso'}
      </button>
      <p className="mt-2 text-xs text-gray-500">La aprobación no da acceso por sí misma: solo el dispositivo del estudiante puede completarla, una vez y en pocos minutos.</p>
    </Modal>
  );
}

function Cerrar({ tipo, s, alCerrar, alTerminar }: { tipo: 'rechazar' | 'revocar' | 'cancelar'; s: SolicitudAcceso; alCerrar: () => void; alTerminar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<ResultadoAccion | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const titulo = { rechazar: 'Rechazar solicitud', revocar: 'Revocar autorización pendiente', cancelar: 'Cancelar solicitud' }[tipo];
  async function enviar() {
    setBusy(true);
    setFallo(null);
    try {
      const res = await cerrarAcceso(s.id, tipo, motivo.trim());
      setR(res);
      if (res.ok) alTerminar();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={alCerrar} title={titulo}>
      <p className="mb-2 text-sm">{s.estudiante_nombre} · {s.estudiante_login} · {s.seccion}</p>
      <Field label={tipo === 'rechazar' ? 'Motivo (obligatorio)' : 'Motivo'}>
        {(id) => <input id={id} className="campo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
      </Field>
      <ErrorAccion r={r} />
      <ErrorBox error={fallo} />
      <button className="btn-primario w-full" disabled={busy || (tipo === 'rechazar' && !motivo.trim())} onClick={() => void enviar()}>{busy ? 'Guardando…' : titulo}</button>
    </Modal>
  );
}

function Detalle({ s, alCerrar }: { s: SolicitudAcceso; alCerrar: () => void }) {
  const ev = useAsync(() => eventosAcceso({ solicitud: s.id }), [s.id]);
  return (
    <Modal open onClose={alCerrar} title="Detalles de la solicitud">
      <dl className="mb-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-gray-500">Estudiante</dt><dd>{s.estudiante_nombre} ({s.estudiante_login})</dd>
        <dt className="text-gray-500">Sección</dt><dd>{s.curso} · {s.seccion}</dd>
        <dt className="text-gray-500">Para</dt><dd>{s.destinatario === 'monitor' ? 'Monitor de la sección' : 'Profesor'}</dd>
        <dt className="text-gray-500">Estado</dt><dd>{ESTADO_SOLICITUD[s.estado].texto}</dd>
        <dt className="text-gray-500">Pedida / vence</dt><dd>{fecha(s.created_at)} / {fecha(s.expires_at)}</dd>
        <dt className="text-gray-500">Flujo</dt><dd className="font-mono text-xs">{s.flujo_id}</dd>
      </dl>
      <h3 className="mb-1 font-semibold">Trazabilidad</h3>
      {ev.loading ? <Spinner /> : <ErrorBox error={ev.error} />}
      <ul className="space-y-1 text-sm">
        {(ev.data ?? []).map((e) => (
          <li key={e.id} className={e.resultado === 'ok' ? '' : 'text-red-700 dark:text-red-300'}>
            {fecha(e.created_at)} · {ACCION_EVENTO[e.accion] ?? e.accion} · {e.actor_nombre ?? ROL_TEXTO[e.actor_rol] ?? e.actor_rol} ({ROL_TEXTO[e.actor_rol] ?? e.actor_rol})
            {e.metodo ? ` · ${METODO_TEXTO[e.metodo] ?? e.metodo}` : ''}{e.resultado !== 'ok' ? ` · ${e.resultado}` : ''}{e.motivo ? ` · ${e.motivo}` : ''}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function Historial({ secciones }: { secciones: SeccionAcceso[] }) {
  const [f, setF] = useState({ seccion: '', buscar: '', desde: '', hasta: '' });
  const ev = useAsync(() => eventosAcceso({ class_id: f.seccion || null, desde: inicioDia(f.desde), hasta: finDia(f.hasta) }), [f.seccion, f.desde, f.hasta]);
  const b = f.buscar.trim().toLowerCase();
  const xs = (ev.data ?? []).filter((e) => !b || `${e.estudiante_nombre ?? ''} ${e.estudiante_login ?? ''} ${e.actor_nombre ?? ''}`.toLowerCase().includes(b));
  return (
    <>
      <Filtros secciones={secciones} f={f} setF={setF} />
      <p className="mb-2 text-xs text-gray-500">Registro inmutable con hora del servidor. Nadie puede borrarlo ni modificarlo.</p>
      {ev.loading && !ev.data ? <Spinner /> : <ErrorBox error={ev.error} onRetry={() => void ev.reload()} />}
      {ev.data && xs.length === 0 && <Empty>Sin eventos.</Empty>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500"><th className="p-1">Fecha</th><th className="p-1">Acción</th><th className="p-1">Actor</th><th className="p-1">Estudiante</th><th className="p-1">Sección</th><th className="p-1">Resultado</th><th className="p-1">Motivo</th></tr></thead>
          <tbody>
            {xs.map((e) => (
              <tr key={e.id} className="border-t border-gray-100 dark:border-white/10">
                <td className="whitespace-nowrap p-1">{fecha(e.created_at)}</td>
                <td className="p-1">{ACCION_EVENTO[e.accion] ?? e.accion}{e.metodo ? ` (${METODO_TEXTO[e.metodo] ?? e.metodo})` : ''}</td>
                <td className="p-1">{e.actor_nombre ?? '—'} <span className="text-xs text-gray-500">{ROL_TEXTO[e.actor_rol] ?? e.actor_rol}</span></td>
                <td className="p-1">{e.estudiante_nombre ?? '—'}</td>
                <td className="p-1">{e.seccion ?? '—'}</td>
                <td className="p-1"><Badge tone={e.resultado === 'ok' ? 'green' : e.resultado === 'error' ? 'red' : 'amber'}>{e.resultado}</Badge></td>
                <td className="p-1 text-xs">{e.motivo ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Alertas({ alCambiar }: { alCambiar: () => void }) {
  const [todas, setTodas] = useState(false);
  const al = useAsync(() => alertasAcceso(todas), [todas]);
  return (
    <>
      <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Mostrar también las atendidas</label>
      {al.loading && !al.data ? <Spinner /> : <ErrorBox error={al.error} onRetry={() => void al.reload()} />}
      {al.data && al.data.length === 0 && <Empty>Sin alertas.</Empty>}
      <ul className="space-y-2">
        {(al.data ?? []).map((a) => (
          <li key={a.id} className="tarjeta flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <span className="block font-medium">{ALERTA_TEXTO[a.tipo] ?? a.tipo}</span>
              <span className="block text-xs text-gray-500">{fecha(a.created_at)}{a.seccion ? ` · ${a.seccion}` : ''}{a.actor_nombre ? ` · monitor: ${a.actor_nombre}` : ''}{a.estudiante_nombre ? ` · estudiante: ${a.estudiante_nombre}` : ''}</span>
              {a.detalle && <span className="block text-xs">{a.detalle}</span>}
            </span>
            {a.atendida_at ? <Badge>Atendida por {a.atendida_por_nombre ?? '—'}</Badge>
              : <button className="btn-secundario" onClick={() => void atenderAlerta(a.id).then(() => { void al.reload(); alCambiar(); })}>Marcar atendida</button>}
          </li>
        ))}
      </ul>
    </>
  );
}

function Controles({ panel, alCambiar }: { panel: PanelAcceso; alCambiar: () => void }) {
  const reingresar = useReingreso();
  const [fallo, setFallo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hacer = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setFallo(null);
    try {
      const r = (await fn()) as ResultadoAccion | undefined;
      if (r && r.ok === false) setFallo(r.error ?? 'No se pudo guardar.');
      alCambiar();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const c = panel.config;
  return (
    <div className="space-y-4">
      {!panel.sesion_reciente && <Notice tone="warn">Para ACTIVAR algo o delegar permisos hace falta un inicio de sesión reciente. <button className="enlace" onClick={() => void reingresar()}>Volver a iniciar sesión</button>. Desactivar funciona siempre.</Notice>}
      <ErrorBox error={fallo} />
      {c && (
        <section className="tarjeta space-y-2">
          <h2 className="font-semibold">Interruptores generales (administrador)</h2>
          {([['passkeys', 'Passkeys (acceso sin contraseña)', c.passkeys], ['recuperacion', 'Recuperación supervisada', c.recuperacion], ['monitores', 'Recuperación por monitores', c.recuperacion_monitores]] as const).map(([k, t, v]) => (
            <label key={k} className="flex items-center justify-between gap-2 text-sm">
              <span>{t}</span>
              <input type="checkbox" disabled={busy} checked={v} onChange={(e) => void hacer(() => guardarConfigAcceso({ [k]: e.target.checked }))} />
            </label>
          ))}
          <p className="text-xs text-gray-500">
            Solicitud: {c.minutos_solicitud} min · Aprobación: {c.minutos_aprobacion} min · Sesión reciente: {c.horas_sesion_reciente} h · Máximo por monitor: {c.max_aprobaciones_monitor_dia} al día.
            Las passkeys requieren además que estén habilitadas en Supabase Auth.
          </p>
        </section>
      )}
      {panel.secciones.filter((s) => s.papel !== 'monitor').map((s) => <SeccionControles key={s.class_id} s={s} busy={busy} hacer={hacer} />)}
    </div>
  );
}

function SeccionControles({ s, busy, hacer }: { s: SeccionAcceso; busy: boolean; hacer: (fn: () => Promise<unknown>) => Promise<void> }) {
  const mon = useAsync(() => monitoresAcceso(s.class_id), [s.class_id]);
  const h = (fn: () => Promise<unknown>) => hacer(fn).then(() => mon.reload());
  return (
    <section className="tarjeta space-y-2">
      <h2 className="font-semibold">{s.curso} · {s.seccion}</h2>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>Recuperación supervisada en esta sección</span>
        <input type="checkbox" disabled={busy} checked={s.recuperacion} onChange={(e) => void h(() => guardarSeccionAcceso(s.class_id, e.target.checked, s.monitores && e.target.checked))} />
      </label>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>Permitir que monitores designados aprueben</span>
        <input type="checkbox" disabled={busy || !s.recuperacion} checked={s.monitores} onChange={(e) => void h(() => guardarSeccionAcceso(s.class_id, s.recuperacion, e.target.checked))} />
      </label>
      <h3 className="pt-1 text-sm font-medium">Monitores designados para aprobar</h3>
      {mon.loading ? <Spinner /> : <ErrorBox error={mon.error} />}
      {mon.data && mon.data.length === 0 && <p className="text-sm text-gray-500">La sección no tiene monitores.</p>}
      <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
        {(mon.data ?? []).map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-1">
            <span>{m.full_name} <span className="font-mono text-xs text-gray-500">{m.login_id}</span>{m.aprobaciones_24h > 0 && <span className="text-xs text-gray-500"> · {m.aprobaciones_24h} aprobación(es) en 24 h</span>}</span>
            {m.delegado
              ? <button className="btn-secundario text-red-700 dark:text-red-300" disabled={busy} onClick={() => void h(() => permisoMonitor(s.class_id, m.user_id, false))}>Suspender permiso</button>
              : <button className="btn-secundario" disabled={busy} onClick={() => void h(() => permisoMonitor(s.class_id, m.user_id, true))}>Otorgar permiso</button>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">Ningún monitor recibe el permiso automáticamente. Suspenderlo es inmediato y anula sus aprobaciones sin canjear.</p>
    </section>
  );
}
