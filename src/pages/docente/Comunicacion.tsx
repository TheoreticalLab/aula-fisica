/**
 * Centro de Comunicación en Vivo (profesor). El servidor decide el remitente y recorta los destinatarios a los
 * estudiantes que el profesor enseña; aquí solo se elige y se muestra el estado.
 * Presencia: deducida del último latido del seguimiento de tiempo (no es prueba de atención).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rpc, supabase } from '@/lib/supabase';
import { Card, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { useAction, useAsync } from '@/lib/util';
import { etiquetaSeccion } from '@/lib/tiempo';
import { ETIQUETA_TIPO, type TipoMensaje } from '@/lib/mensajes';

interface Alumno { user_id: string; full_name: string; student_code: string | null; class_id: string; class_name: string; course_id: string; course_title: string }
interface Presencia { user_id: string; estado: 'conectado' | 'no_confirmado' | 'desconectado'; last_seen: string | null; section: string | null; lesson_title: string | null; unit_title: string | null; activity_title: string | null; course_title: string | null }
interface Historial { id: string; kind: TipoMensaje; body: string; sender_name: string; audience: { modo?: string }; created_at: string; expires_at: string | null; total: number; pendientes: number; recibidos: number; confirmados: number; expirados: number }
interface EstadoDest { user_id: string; full_name: string; student_code: string | null; estado: string; delivered_at: string | null; read_at: string | null }

const PUNTO = { conectado: '🟢 Conectado', no_confirmado: '🟡 Presencia no confirmada', desconectado: '🔴 Desconectado' } as const;
const VIGENCIAS = [
  { min: 60, label: '1 hora' },
  { min: 1440, label: '1 día' },
  { min: 10080, label: '7 días' },
  { min: 0, label: 'Sin vencimiento' },
];
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function actividad(p?: Presencia): string {
  if (!p || !p.last_seen || p.estado === 'desconectado') return '';
  if (p.lesson_title) return `${p.unit_title ? p.unit_title + ' — ' : ''}${p.lesson_title} (${etiquetaSeccion(p.section ?? '')})`;
  if (p.activity_title) return `Actividad: ${p.activity_title}`;
  if (p.course_title) return `${p.course_title} (${etiquetaSeccion(p.section ?? '')})`;
  return p.section ? etiquetaSeccion(p.section) : '';
}

export default function Comunicacion() {
  const [params] = useSearchParams();
  const alumnos = useAsync(() => rpc<Alumno[]>('my_messageable_students'), []);
  const [presencia, setPresencia] = useState<Map<string, Presencia>>(new Map());
  const [sel, setSel] = useState<Set<string>>(new Set(params.get('u') ? [params.get('u')!] : []));
  const [seccion, setSeccion] = useState('');
  const [modo, setModo] = useState<'seleccion' | 'seccion' | 'todos' | 'conectados'>(params.get('u') ? 'seleccion' : 'seleccion');
  const [tipo, setTipo] = useState<TipoMensaje | 'bloqueo'>('importante');
  const [codigo, setCodigo] = useState('');
  const bloqueos = useAsync(() => rpc<{ id: string; user_id: string; full_name: string; student_code: string | null; body: string; created_at: string; failed_attempts: number }[]>('active_screen_locks'), []);
  const [vigencia, setVigencia] = useState(1440);
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verAlumno, setVerAlumno] = useState<string | null>(params.get('u'));
  const envio = useAction();
  const historial = useAsync(() => rpc<Historial[]>('live_message_history', { p_user: verAlumno, p_limit: 50 }), [verAlumno]);
  const detalle = useAsync(() => (abierto ? rpc<EstadoDest[]>('live_message_recipients_status', { p_message: abierto }) : Promise.resolve([])), [abierto]);

  // presencia cada 15 s; estados de entrega en vivo (Realtime) con respaldo cada 30 s
  useEffect(() => {
    const cargar = () =>
      rpc<Presencia[]>('live_presence').then((ps) => setPresencia(new Map(ps.map((p) => [p.user_id, p])))).catch(() => undefined);
    void cargar();
    const t = window.setInterval(() => document.visibilityState === 'visible' && void cargar(), 15_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    const refrescar = () => {
      void historial.reload();
      if (abierto) void detalle.reload();
    };
    const canal = supabase
      .channel('comunicacion-estados')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_message_recipients' }, refrescar)
      .subscribe();
    const t = window.setInterval(refrescar, 30_000);
    return () => {
      void supabase.removeChannel(canal);
      window.clearInterval(t);
    };
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => {
    const porId = new Map<string, Alumno & { secciones: string[] }>();
    for (const a of alumnos.data ?? []) {
      const x = porId.get(a.user_id);
      if (x) x.secciones.push(a.class_name);
      else porId.set(a.user_id, { ...a, secciones: [a.class_name] });
    }
    return [...porId.values()]
      .filter((a) => !seccion || (alumnos.data ?? []).some((b) => b.user_id === a.user_id && b.class_id === seccion))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'));
  }, [alumnos.data, seccion]);
  const secciones = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alumnos.data ?? []) m.set(a.class_id, `${a.class_name} · ${a.course_title}`);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [alumnos.data]);
  const conectados = lista.filter((a) => presencia.get(a.user_id)?.estado === 'conectado').map((a) => a.user_id);
  const destinatarios =
    modo === 'seleccion' ? sel.size : modo === 'conectados' ? conectados.length : modo === 'seccion' ? (seccion ? lista.length : 0) : new Set((alumnos.data ?? []).map((a) => a.user_id)).size;

  async function enviar() {
    setEnviado(null);
    if (tipo === 'bloqueo') {
      const n = destinatarios;
      if (!window.confirm(`¿Bloquear la pantalla de ${n} estudiante(s)? Solo se desbloqueará con el código «${codigo.trim()}» (anótelo) o si usted lo libera.`)) return;
      const b = await envio.run(() =>
        rpc<{ locked: number }>('send_screen_lock', {
          p_body: texto,
          p_code: codigo,
          p_mode: modo,
          p_users: modo === 'seleccion' ? [...sel] : null,
          p_class: modo === 'seccion' || modo === 'conectados' ? seccion || null : null,
        }),
      );
      if (b) {
        setEnviado(`Pantalla bloqueada a ${b.locked} estudiante(s). Código: ${codigo.trim()}`);
        setTexto('');
        void bloqueos.reload();
      }
      return;
    }
    const r = await envio.run(() =>
      rpc<{ id: string; recipients: number }>('send_live_message', {
        p_kind: tipo,
        p_body: texto,
        p_mode: modo,
        p_users: modo === 'seleccion' ? [...sel] : modo === 'conectados' ? conectados : null,
        p_class: modo === 'seccion' ? seccion || null : null,
        p_expires_minutes: vigencia || null,
      }),
    );
    if (r) {
      setEnviado(`Mensaje enviado a ${r.recipients} estudiante(s).`);
      setTexto('');
      void historial.reload();
    }
  }
  const alternar = (id: string) => {
    const s = new Set(sel);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSel(s);
    setModo('seleccion');
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Centro de Comunicación en Vivo" subtitle="Mensajes emergentes a sus estudiantes, en cualquier página del aula." back={{ to: '/docente', label: 'Panel docente' }} />

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <Card title={`Estudiantes (${lista.length})`} actions={
          <select className="campo !py-1 text-xs" value={seccion} onChange={(e) => setSeccion(e.target.value)}>
            <option value="">Todas mis secciones</option>
            {secciones.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        }>
          {alumnos.loading && !alumnos.data ? <Spinner /> : (
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-xs dark:border-white/10">
                  <th className="w-8 px-1 py-1"><input type="checkbox" aria-label="Seleccionar todos" checked={lista.length > 0 && lista.every((a) => sel.has(a.user_id))}
                    onChange={(e) => { setSel(e.target.checked ? new Set(lista.map((a) => a.user_id)) : new Set()); setModo('seleccion'); }} /></th>
                  <th className="px-1 py-1">Estudiante</th><th className="px-1 py-1">Estado</th><th className="hidden px-1 py-1 md:table-cell">Actividad actual</th><th />
                </tr></thead>
                <tbody>
                  {lista.map((a) => {
                    const p = presencia.get(a.user_id);
                    return (
                      <tr key={a.user_id} className="border-b border-gray-100 dark:border-white/5">
                        <td className="px-1 py-1.5"><input type="checkbox" aria-label={`Seleccionar a ${a.full_name}`} checked={sel.has(a.user_id)} onChange={() => alternar(a.user_id)} /></td>
                        <td className="px-1 py-1.5"><button className="enlace text-left" onClick={() => setVerAlumno(a.user_id)}>{a.full_name || a.student_code || '—'}</button>
                          <span className="block text-xs text-gray-500">{a.secciones.join(', ')}</span></td>
                        <td className="whitespace-nowrap px-1 py-1.5 text-xs" title={p?.last_seen ? `Último latido: ${fecha(p.last_seen)}` : 'Sin registros recientes'}>{PUNTO[p?.estado ?? 'desconectado']}</td>
                        <td className="hidden px-1 py-1.5 text-xs text-gray-600 dark:text-gray-400 md:table-cell">{actividad(p)}</td>
                        <td className="px-1 py-1.5 text-right"><button className="btn-secundario !px-2 !py-0.5 text-xs" onClick={() => { setSel(new Set([a.user_id])); setModo('seleccion'); document.getElementById('mensaje-texto')?.focus(); }}>✉ Mensaje</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!lista.length && <p className="text-sm text-gray-500">No hay estudiantes en sus secciones.</p>}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">La presencia se deduce de la actividad reciente en el aula (latidos cada ~15 s). Estar conectado no indica que el estudiante esté prestando atención.</p>
        </Card>

        <Card title="Nuevo mensaje">
          <label className="mb-2 block text-xs">Destinatario
            <select className="campo mt-1" value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
              <option value="seleccion">Estudiantes seleccionados ({sel.size})</option>
              <option value="conectados">Todos los conectados ahora ({conectados.length})</option>
              <option value="seccion">Una sección completa</option>
              <option value="todos">Todos mis estudiantes</option>
            </select>
          </label>
          {modo === 'seccion' && (
            <label className="mb-2 block text-xs">Sección
              <select className="campo mt-1" value={seccion} onChange={(e) => setSeccion(e.target.value)}>
                <option value="">Elija una sección</option>
                {secciones.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
            </label>
          )}
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="text-xs">Tipo
              <select className="campo mt-1" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMensaje | 'bloqueo')}>
                <option value="informativo">Informativo (aviso breve)</option>
                <option value="importante">Importante (pide «Entendido»)</option>
                <option value="urgente">Urgente (destacado hasta confirmar)</option>
                <option value="bloqueo">🔒 Bloqueo con código</option>
              </select>
            </label>
            <label className="text-xs">Vigencia
              <select className="campo mt-1" value={vigencia} onChange={(e) => setVigencia(Number(e.target.value))}>
                {VIGENCIAS.map((v) => <option key={v.min} value={v.min}>{v.label}</option>)}
              </select>
            </label>
          </div>
          <label className="mb-2 block text-xs">Mensaje
            <textarea id="mensaje-texto" className="campo mt-1 min-h-[7rem]" maxLength={tipo === 'bloqueo' ? 1000 : 2000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escriba el mensaje…" />
          </label>
          {tipo === 'bloqueo' && (
            <label className="mb-2 block text-xs">Código de desbloqueo (4 a 32 caracteres; anótelo: se guarda cifrado y no podrá verse después)
              <input className="campo mt-1 tracking-widest" maxLength={32} autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </label>
          )}
          <p className="mb-2 text-xs text-gray-500">{texto.length}/2000 · llegará a {destinatarios} estudiante(s). A los desconectados se les mostrará al volver, mientras esté vigente.</p>
          <ErrorBox error={envio.error} />
          {enviado && <Notice tone="ok">{enviado}</Notice>}
          <button className="btn-primario w-full" disabled={envio.busy || !texto.trim() || destinatarios === 0 || (tipo === 'bloqueo' && codigo.trim().length < 4)} onClick={() => void enviar()}>
            {envio.busy ? 'Enviando…' : tipo === 'bloqueo' ? 'BLOQUEAR PANTALLA' : 'ENVIAR MENSAJE'}
          </button>
        </Card>
      </div>

      {(bloqueos.data ?? []).length > 0 && (
        <Card title={`🔒 Pantallas bloqueadas (${bloqueos.data!.length})`}>
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            {bloqueos.data!.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><strong>{b.full_name || b.student_code}</strong> · {b.body}
                  <span className="block text-xs text-gray-500">desde {new Date(b.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}{b.failed_attempts ? ` · ${b.failed_attempts} intento(s) fallido(s)` : ''}</span></span>
                <button className="btn-secundario !py-1 text-xs" onClick={() => void envio.run(() => rpc('release_screen_lock', { p_lock: b.id })).then(() => bloqueos.reload())}>Liberar</button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={verAlumno ? `Historial de ${lista.find((a) => a.user_id === verAlumno)?.full_name ?? 'el estudiante'}` : 'Historial de comunicaciones'}
        actions={verAlumno ? <button className="btn-secundario !py-1 text-xs" onClick={() => setVerAlumno(null)}>Ver todos mis mensajes</button> : undefined}>
        <ErrorBox error={historial.error} />
        {historial.loading && !historial.data ? <Spinner /> : (
          <div className="space-y-2">
            {(historial.data ?? []).map((h) => (
              <div key={h.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">{fecha(h.created_at)} · {ETIQUETA_TIPO[h.kind]} · {h.sender_name}{h.expires_at ? ` · vence ${fecha(h.expires_at)}` : ''}</span>
                  <button className="enlace text-xs" onClick={() => setAbierto(abierto === h.id ? null : h.id)}>{abierto === h.id ? 'Ocultar estados' : 'Ver estado por estudiante'}</button>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{h.body}</p>
                <p className="mt-1 text-xs">
                  {h.total} destinatario(s): <strong>{h.confirmados}</strong> confirmado(s) · {h.recibidos} recibido(s) sin confirmar · {h.pendientes} pendiente(s){h.expirados ? ` · ${h.expirados} expirado(s)` : ''}
                </p>
                {abierto === h.id && (
                  <table className="mt-2 w-full text-xs">
                    <thead><tr className="text-left text-gray-500"><th>Estudiante</th><th>Estado</th><th>Recibido</th><th>Confirmado</th></tr></thead>
                    <tbody>
                      {(detalle.data ?? []).map((d) => (
                        <tr key={d.user_id} className="border-t border-gray-100 dark:border-white/5">
                          <td className="py-0.5">{d.full_name || d.student_code}</td>
                          <td className="py-0.5 capitalize">{d.estado}</td>
                          <td className="py-0.5">{fecha(d.delivered_at)}</td>
                          <td className="py-0.5">{fecha(d.read_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
            {!(historial.data ?? []).length && <p className="text-sm text-gray-500">Todavía no hay mensajes.</p>}
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">«Recibido» = la aplicación del estudiante lo mostró; «Confirmado» = el estudiante pulsó «Entendido». Entregar no equivale a leer.</p>
      </Card>
    </div>
  );
}
