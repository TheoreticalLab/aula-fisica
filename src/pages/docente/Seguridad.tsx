/**
 * Centro de seguridad (solo administrador). Todo dato viene de funciones sec_* que exigen ser administrador y
 * quedan auditadas. Separa HECHOS OBSERVADOS, INFERENCIAS, HIPÓTESIS e INFORMACIÓN DESCONOCIDA, y marca la
 * procedencia de cada dato (servidor / red / declarado por el navegador).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDark } from '@/lib/tema';
import { rpc } from '@/lib/supabase';
import { Badge, Card, ErrorBox, PageTitle, Spinner } from '@/components/ui';
import { useAction, useAsync } from '@/lib/util';
import { evaluar, type ContextoEvento } from '@/lib/forense';
import { aCsv } from '@/lib/tiempo';

interface Evento {
  event_id: string; created_at: string; login_id: string; existe: boolean; rol: string | null; success: boolean; reason: string; rule: string | null;
  ip_hash: string | null; country: string | null; browser: string | null; os: string | null; device_type: string | null; client_tz: string | null;
  client_lang: string | null; app_version: string | null; device_hash: string | null; dispositivo_reconocido: boolean; duration_ms: number | null;
  request_id: string | null; segundos_desde_anterior: number | null; clasificacion: string | null;
}
interface Deteccion { regla: string; severidad: string; sujeto: string; eventos: number; detalle: Record<string, unknown>; desde: string; hasta: string; limitaciones: string; accion: string }
interface Usuario {
  login_id: string; full_name: string | null; student_code: string | null; rol: string | null; existe: boolean; correctos: number; fallos: number;
  rechazos: number; ultimo_acceso: string | null; ultimo_intento: string; ultimo_navegador: string | null; ultimo_sistema: string | null;
  ultimo_tipo: string | null; ultimo_pais: string | null; origenes: number; dispositivos_reconocidos: number; ultimo_evento: string;
}
interface TrasFallo {
  event_id: string; created_at: string; login_id: string; full_name: string | null; student_code: string | null; rol: string | null;
  fallos: number; rechazos: number; primer_fallo: string; ultimo_fallo: string; segundos_tras_ultimo_fallo: number;
  origenes_fallos: number; dispositivos_fallos: number; mismo_origen: boolean; mismo_dispositivo: boolean;
  dispositivo_reconocido: boolean; origen_visto_antes: boolean; primer_acceso: boolean;
  ip_hash: string | null; country: string | null; paises_fallos: string[]; browser: string | null; os: string | null; device_type: string | null;
  nivel: 'critica' | 'alta' | 'moderada' | 'baja'; motivo: string; clasificacion: string | null;
}
interface Dispositivo { id: number; browser: string | null; os: string | null; device_type: string | null; first_seen: string; last_success: string; success_count: number; revoked_at: string | null; fallos_desde_este: number }

const MOTIVO: Record<string, string> = {
  ok: 'Acceso correcto', bad_password: 'Contraseña incorrecta', unknown_id: 'ID inexistente', suspended: 'Cuenta suspendida',
  locked: 'Rechazado: bloqueo temporal del ID', rate_ip: 'Rechazado: límite del origen', invalid_format: 'Formato de ID inválido',
};
const REGLA: Record<string, string> = {
  fuerza_bruta: 'Fuerza bruta', rociado_de_contrasenas: 'Rociado de contraseñas', enumeracion_identificadores: 'Enumeración de identificadores',
  ataque_distribuido: 'Intentos desde muchos orígenes', abuso_de_bloqueo: 'Abuso del bloqueo', acceso_tras_fallos: 'Acceso correcto tras muchos fallos',
  cuenta_privilegiada: 'Fallos contra una cuenta privilegiada',
};
const TONO: Record<string, 'gray' | 'blue' | 'amber' | 'red' | 'green'> = { bajo: 'green', 'bajo-moderado': 'blue', moderado: 'amber', alto: 'red', crítico: 'red', insuficiente: 'gray' };
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'medium' }) : '—');
const origen = (h: string | null) => (h ? `O-${h.slice(0, 6)}` : '—');

function Dato({ k, v, fuente }: { k: string; v: React.ReactNode; fuente: 'servidor' | 'red' | 'navegador' }) {
  const t = { servidor: ['servidor', 'green'], red: ['cabecera de red', 'amber'], navegador: ['declarado, falsificable', 'gray'] }[fuente] as [string, 'green' | 'amber' | 'gray'];
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 py-1 text-sm dark:border-white/5">
      <span className="text-gray-500">{k}</span>
      <span className="text-right">{v ?? '—'} <Badge tone={t[1]}>{t[0]}</Badge></span>
    </div>
  );
}

function Ficha({ ev, onCerrar }: { ev: Evento; onCerrar: () => void }) {
  const ctx = useAsync(() => rpc<ContextoEvento & { cuenta: ContextoEvento['cuenta']; anotaciones: { classification: string | null; note: string | null; created_at: string; actor: string }[] }>('sec_event_context', { p_event: ev.event_id }), [ev.event_id]);
  const crono = useAsync(() => rpc<Evento[]>('sec_events', { p_login: ev.login_id, p_result: null, p_from: new Date(new Date(ev.created_at).getTime() - 3 * 3600e3).toISOString(), p_to: new Date(new Date(ev.created_at).getTime() + 3 * 3600e3).toISOString(), p_limit: 200 }), [ev.event_id]);
  const disp = useAsync(() => rpc<Dispositivo[]>('sec_devices', { p_login: ev.login_id }), [ev.login_id]);
  const [nota, setNota] = useState('');
  const accion = useAction();
  const e = ctx.data ? evaluar(ctx.data) : null;

  async function clasificar(c: string | null) {
    await accion.run(() => rpc('sec_annotate', { p_event: ev.event_id, p_login: ev.login_id, p_classification: c, p_note: nota }));
    setNota('');
    void ctx.reload();
  }

  return (
    <Card title={`${ctx.data?.cuenta?.role === 'admin' ? '¿PUDE HABER SIDO YO?' : 'ANÁLISIS DEL ACCESO'} · ${ev.login_id} · ${ev.success ? 'correcto' : 'fallido'}`} actions={<button className="btn-secundario !py-1 text-xs" onClick={onCerrar}>Cerrar</button>}>
      {ctx.loading ? <Spinner /> : <ErrorBox error={ctx.error} />}
      {ctx.data && e && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <h3 className="mb-1 text-sm font-semibold">HECHOS OBSERVADOS</h3>
            {ctx.data.cuenta && <Dato k="Cuenta" v={`${ctx.data.cuenta.full_name}${ctx.data.cuenta.student_code ? ` · ${ctx.data.cuenta.student_code}` : ''} · ${ctx.data.cuenta.role}`} fuente="servidor" />}
            <Dato k="Fecha y hora" v={fecha(ev.created_at)} fuente="servidor" />
            <Dato k="Resultado" v={MOTIVO[ev.reason] ?? ev.reason} fuente="servidor" />
            {ev.rule && <Dato k="Regla aplicada" v={ev.rule} fuente="servidor" />}
            <Dato k="Origen de red (seudónimo)" v={`${origen(ev.ip_hash)}${ctx.data.origen_visto_en_correctos ? ' · visto en accesos correctos' : ''}`} fuente="servidor" />
            <Dato k="País aproximado" v={ev.country} fuente="red" />
            <Dato k="Navegador / sistema" v={[ev.browser, ev.os, ev.device_type].filter(Boolean).join(' · ') || null} fuente="navegador" />
            <Dato k="Zona horaria / idioma" v={[ev.client_tz, ev.client_lang].filter(Boolean).join(' · ') || null} fuente="navegador" />
            <Dato k="Dispositivo" v={ev.device_hash ? (ctx.data.dispositivo_reconocido ? 'reconocido' : 'no reconocido') : 'sin identificador'} fuente="navegador" />
            <Dato k="Duración / solicitud" v={`${ev.duration_ms ?? '—'} ms · ${ev.request_id?.slice(0, 8) ?? '—'}`} fuente="servidor" />
            <Dato k="Accesos correctos previos (90 días)" v={ctx.data.historial_correctos} fuente="servidor" />
            <Dato k="Fallos de la cuenta en ±1 h" v={ctx.data.rafaga_intentos} fuente="servidor" />
            <Dato k="IDs probados desde el mismo origen (24 h)" v={ctx.data.ids_mismo_origen_24h} fuente="servidor" />
          </section>
          <section>
            <h3 className="mb-1 text-sm font-semibold">INFERENCIAS (señales y su peso)</h3>
            <ul className="space-y-1 text-sm">
              {e.senales.map((s, i) => (
                <li key={i} className="flex justify-between gap-2"><span>{s.texto} <span className="text-xs text-gray-500">({s.tipo})</span></span>
                  <span className={`tabular-nums ${s.peso > 0 ? 'text-red-600' : 'text-green-700'}`}>{s.peso > 0 ? '+' : ''}{s.peso}</span></li>
              ))}
            </ul>
            <h3 className="mb-1 mt-3 text-sm font-semibold">HIPÓTESIS</h3>
            <p className="text-sm"><Badge tone={TONO[e.categoria]}>{e.categoria}{e.puntuacion !== null ? ` · ${e.puntuacion}/100` : ''}</Badge> {e.texto}</p>
            <p className="mt-1 text-xs text-gray-500">La puntuación es una categoría de anomalía respecto al historial, no la probabilidad de que exista un atacante.</p>
            <h3 className="mb-1 mt-3 text-sm font-semibold">INFORMACIÓN DESCONOCIDA</h3>
            <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400">
              {[...e.desconocido, 'Proveedor de internet, sistema autónomo y uso de VPN: no se obtienen en esta fase.'].map((d) => <li key={d}>{d}</li>)}
            </ul>
            <h3 className="mb-1 mt-3 text-sm font-semibold">CLASIFICACIÓN MANUAL</h3>
            <textarea className="campo mb-2 min-h-[3rem] text-sm" placeholder="Nota (opcional)" maxLength={2000} value={nota} onChange={(x) => setNota(x.target.value)} />
            <div className="flex flex-wrap gap-1 text-xs">
              {[['reconozco', 'Reconozco esta actividad'], ['no_reconozco', 'No la reconozco'], ['no_seguro', 'No estoy seguro'], ['prueba_autorizada', 'Prueba autorizada'], ['investigado', 'Marcar investigado']].map(([c, l]) => (
                <button key={c} className="btn-secundario !px-2 !py-1" disabled={accion.busy} onClick={() => void clasificar(c)}>{l}</button>
              ))}
              <button className="btn-secundario !px-2 !py-1" disabled={accion.busy || !nota.trim()} onClick={() => void clasificar(null)}>Solo nota</button>
            </div>
            <p className="mt-1 text-xs text-gray-500">La clasificación queda como anotación (con fecha y sesión); nunca modifica ni borra la evidencia, ni vuelve «confiable» un origen.</p>
            {ctx.data.anotaciones.length > 0 && (
              <ul className="mt-2 text-xs">{ctx.data.anotaciones.map((a, i) => <li key={i}>{fecha(a.created_at)} · {a.actor} · {a.classification ?? 'nota'}{a.note ? ` — ${a.note}` : ''}</li>)}</ul>
            )}
          </section>
          <section>
            <h3 className="mb-1 text-sm font-semibold">CRONOLOGÍA (±3 h)</h3>
            <ul className="space-y-0.5 font-mono text-xs">
              {[...(crono.data ?? [])].reverse().map((c) => (
                <li key={c.event_id} className={c.event_id === ev.event_id ? 'font-bold' : ''}>
                  {new Date(c.created_at).toLocaleTimeString('es-DO', { hour12: false })} — {MOTIVO[c.reason] ?? c.reason} · {origen(c.ip_hash)} · {c.browser ?? '?'}/{c.os ?? '?'}
                  {c.segundos_desde_anterior !== null ? ` · +${c.segundos_desde_anterior}s` : ''}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-1 text-sm font-semibold">DISPOSITIVOS RECONOCIDOS DE LA CUENTA</h3>
            {(disp.data ?? []).length ? (
              <ul className="space-y-1 text-sm">
                {disp.data!.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{[d.browser, d.os, d.device_type].filter(Boolean).join(' · ')} <span className="block text-xs text-gray-500">desde {fecha(d.first_seen)} · último acceso {fecha(d.last_success)} · {d.success_count} accesos · {d.fallos_desde_este} fallos{d.revoked_at ? ' · REVOCADO' : ''}</span></span>
                    {!d.revoked_at && <button className="btn-secundario !py-0.5 text-xs" onClick={() => window.confirm('¿Revocar el reconocimiento de este dispositivo?') && void accion.run(() => rpc('sec_revoke_device', { p_id: d.id })).then(() => disp.reload())}>Revocar</button>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-500">Ninguno (se reconocen tras un acceso correcto con esta versión del aula).</p>}
          </section>
        </div>
      )}
    </Card>
  );
}

interface Series {
  por_dia: { dia: string; fallos: number; rechazos: number; correctos: number }[];
  por_hora: { hora: number; fallos: number }[];
  origenes: { origen: string; fallos: number; ids: number }[];
  navegadores: { navegador: string; intentos: number }[];
}

/** Gráficos con datos reales de los últimos 30 días (sin datos de relleno). */
function Graficos() {
  const s = useAsync(() => rpc<Series>('sec_series', { p_days: 30 }), []);
  const dark = useDark();
  const texto = dark ? '#d1d5db' : '#374151';
  const rejilla = dark ? '#ffffff1a' : '#00000014';
  const tip = { background: dark ? '#0b1730' : '#fff', border: '1px solid #8884', fontSize: 12 };
  const azul = dark ? '#7f9fd6' : '#335ca6';
  if (s.loading) return <Spinner />;
  if (!s.data) return null;
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, fallos: s.data!.por_hora.find((x) => x.hora === h)?.fallos ?? 0 }));
  return (
    <Card title="Gráficos (últimos 30 días)">
      {!s.data.por_dia.length ? <p className="text-sm text-gray-500">Sin intentos en este periodo.</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-medium">Intentos por día</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={s.data.por_dia}>
                <CartesianGrid stroke={rejilla} vertical={false} />
                <XAxis dataKey="dia" tick={{ fill: texto, fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: texto, fontSize: 11 }} />
                <Tooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="fallos" name="Fallos" stackId="a" fill="#b4475a" />
                <Bar dataKey="rechazos" name="Rechazos por bloqueo" stackId="a" fill="#c99325" />
                <Bar dataKey="correctos" name="Correctos" stackId="a" fill="#2f8f6b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium">Fallos por hora del día (Santo Domingo)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={horas}>
                <CartesianGrid stroke={rejilla} vertical={false} />
                <XAxis dataKey="hora" tick={{ fill: texto, fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: texto, fontSize: 11 }} />
                <Tooltip contentStyle={tip} formatter={(v) => [v, 'Fallos']} labelFormatter={(h) => `${h}:00–${Number(h) + 1}:00`} />
                <Bar dataKey="fallos" fill={azul} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium">Orígenes con más fallos (seudónimos)</h3>
            <ul className="text-sm">{s.data.origenes.map((o) => <li key={o.origen} className="flex justify-between border-b border-gray-100 py-0.5 dark:border-white/5"><span className="font-mono">{o.origen}</span><span>{o.fallos} fallos · {o.ids} ID(s)</span></li>)}</ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium">Navegadores (declarados)</h3>
            <ul className="text-sm">{s.data.navegadores.map((n) => <li key={n.navegador} className="flex justify-between border-b border-gray-100 py-0.5 dark:border-white/5"><span>{n.navegador}</span><span>{n.intentos}</span></li>)}</ul>
          </div>
        </div>
      )}
    </Card>
  );
}

const NIVEL: Record<TrasFallo['nivel'], ['red' | 'amber' | 'green', string]> = {
  critica: ['red', 'crítica'], alta: ['red', 'alta'], moderada: ['amber', 'moderada'], baja: ['green', 'baja'],
};
const espera = (s: number) => (s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);

/** «Fallaron y luego entraron»: un fallo informa poco; importa si quien falló logró entrar. */
function TrasFallos({ onAbrir }: { onAbrir: (t: TrasFallo) => void }) {
  const [dias, setDias] = useState(30);
  const [todos, setTodos] = useState(false);
  const d = useAsync(() => rpc<TrasFallo[]>('sec_access_after_failures', { p_days: dias }), [dias]);
  const filas = (d.data ?? []).filter((t) => todos || t.nivel !== 'baja');
  const graves = (d.data ?? []).filter((t) => t.nivel === 'critica' || t.nivel === 'alta').length;
  const si = (b: boolean) => (b ? <strong className="text-red-600">sí</strong> : 'no');
  return (
    <Card
      title={`Fallaron y luego entraron (${dias} días) · ${graves} a revisar`}
      actions={
        <select className="campo !w-auto !py-1 text-xs" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {[1, 7, 30, 90, 180].map((n) => <option key={n} value={n}>{n === 1 ? '24 h' : `${n} días`}</option>)}
        </select>
      }
    >
      <p className="mb-2 text-xs text-gray-500">
        Cada acceso CORRECTO precedido de fallos de la misma cuenta (desde su acceso correcto anterior, máximo 24 h). La pregunta es si <strong>quien falló es quien entró</strong>:
        mismo dispositivo o misma red que los fallos, desde un contexto que la cuenta nunca usó. Si entró desde su dispositivo o red habitual, lo normal es que el titular se equivocara y luego acertara.
      </p>
      <ErrorBox error={d.error} />
      {d.loading ? <Spinner /> : !filas.length ? (
        <p className="text-sm text-gray-500">{(d.data ?? []).length ? 'Solo hay casos de nivel bajo (contexto habitual).' : 'Ningún acceso correcto precedido de fallos en este periodo.'}</p>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs dark:border-white/10">
              <th className="py-1">Nivel</th><th>Cuenta</th><th>Entró</th><th className="text-right">Fallos antes</th><th>¿El que falló entró?</th><th>Contexto del acceso</th><th>Dispositivo</th><th />
            </tr></thead>
            <tbody>
              {filas.map((t) => (
                <tr key={t.event_id} className="cursor-pointer border-b border-gray-100 align-top hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5" onClick={() => onAbrir(t)}>
                  <td className="py-1"><Badge tone={NIVEL[t.nivel][0]}>{NIVEL[t.nivel][1]}</Badge></td>
                  <td>{t.full_name || t.login_id}{t.rol && t.rol !== 'student' && <> <Badge tone="purple">{t.rol}</Badge></>}<span className="block font-mono text-xs text-gray-500">{t.login_id}{t.student_code ? ` · ${t.student_code}` : ''}</span></td>
                  <td className="whitespace-nowrap text-xs">{fecha(t.created_at)}<span className="block text-gray-500">{espera(t.segundos_tras_ultimo_fallo)} tras el último fallo</span></td>
                  <td className="text-right tabular-nums text-red-600">{t.fallos}{t.rechazos ? <span className="block text-xs text-amber-700">+{t.rechazos} rech.</span> : null}<span className="block text-xs text-gray-500">{t.origenes_fallos} origen(es)</span></td>
                  <td className="text-xs">Mismo dispositivo: {si(t.mismo_dispositivo)}<br />Misma red: {si(t.mismo_origen)}</td>
                  <td className="text-xs">
                    {t.primer_acceso ? 'Primer acceso de la cuenta' : <>Dispositivo reconocido: {t.dispositivo_reconocido ? 'sí' : <strong>no</strong>}<br />Red vista antes: {t.origen_visto_antes ? 'sí' : <strong>no</strong>}</>}
                    {t.country && t.paises_fallos.length > 0 && <><br />País: {t.country} (fallos: {t.paises_fallos.join(', ')})</>}
                  </td>
                  <td className="text-xs">{[t.browser, t.os, t.device_type].filter(Boolean).join(' · ') || 'sin datos'}<span className="block font-mono text-gray-500">{origen(t.ip_hash)}</span></td>
                  <td className="max-w-[16rem] text-xs">{t.motivo}{t.clasificacion && <span className="block font-semibold">Clasificado: {t.clasificacion}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Mostrar también los de nivel bajo (contexto habitual)
      </label>
      <p className="mt-1 text-xs text-gray-500">
        Nivel por reglas visibles, no probabilidades. Limitación: una red compartida (laboratorio, operador móvil) puede hacer «habitual» un origen ajeno, y el identificador del dispositivo puede borrarse.
        Pulse una fila para analizar el acceso y clasificarlo («No la reconozco» si el titular no fue).
      </p>
    </Card>
  );
}

export default function Seguridad() {
  const [login, setLogin] = useState('');
  const [resultado, setResultado] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sel, setSel] = useState<Evento | null>(null);
  const resumen = useAsync(() => rpc<Record<string, number | string | null>>('sec_overview'), []);
  const detecciones = useAsync(() => rpc<Deteccion[]>('sec_detections', { p_hours: 168 }), []);
  const eventos = useAsync(
    () => rpc<Evento[]>('sec_events', { p_login: login.trim() || null, p_result: resultado || null, p_from: desde ? new Date(desde).toISOString() : null, p_to: hasta ? new Date(hasta + 'T23:59:59').toISOString() : null, p_limit: 300 }),
    [login, resultado, desde, hasta],
  );
  const usuarios = useAsync(() => rpc<Usuario[]>('sec_users', { p_days: 30 }), []);
  async function abrirUsuario(id: string) {
    setLogin(id);
    const ult = await rpc<Evento[]>('sec_events', { p_login: id, p_result: null, p_from: null, p_to: null, p_limit: 1 }).catch(() => []);
    if (ult[0]) {
      setSel(ult[0]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  async function abrirAcceso(t: TrasFallo) {
    const ev = await rpc<Evento[]>('sec_events', { p_login: t.login_id, p_result: 'correcto', p_from: t.created_at, p_to: t.created_at, p_limit: 1 }).catch(() => []);
    if (ev[0]) {
      setSel(ev[0]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  const r = resumen.data;
  const exportar = () => {
    const filas = (eventos.data ?? []).map((e) => [e.created_at, e.login_id, MOTIVO[e.reason] ?? e.reason, origen(e.ip_hash), e.country, e.browser, e.os, e.device_type, e.dispositivo_reconocido ? 'sí' : 'no', e.segundos_desde_anterior, e.clasificacion]);
    const url = URL.createObjectURL(new Blob([aCsv([['Fecha (UTC)', 'ID', 'Resultado', 'Origen', 'País', 'Navegador', 'Sistema', 'Tipo', 'Dispositivo reconocido', 's desde anterior', 'Clasificación'], ...filas])], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `seguridad-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Centro de seguridad" subtitle="Investigación de accesos. Solo administrador; cada consulta queda auditada." back={{ to: '/docente/cuentas', label: 'Cuentas' }} />
      <ErrorBox error={resumen.error || eventos.error || detecciones.error} />
      {r && (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[['Fallos 24 h', r.fallos_24h], ['Fallos 72 h', r.fallos_72h], ['Fallos 7 días', r.fallos_7d], ['Fallos 30 días', `${r.fallos_30d} (antes: ${r.fallos_30d_anterior})`],
            ['IDs afectados (7 d)', r.ids_afectados_7d], ['Orígenes (7 d)', r.origenes_7d], ['Dispositivos (7 d)', r.dispositivos_7d],
            ['Rechazos por bloqueo (7 d)', r.rechazos_bloqueo_7d], ['Accesos correctos (7 d)', r.correctos_7d], ['Eventos con metadatos (7 d)', `${r.con_metadatos_7d}/${r.total_7d}`]].map(([k, v]) => (
            <div key={k as string} className="tarjeta !p-3"><p className="text-xs text-gray-500">{k}</p><p className="font-serif text-xl font-semibold">{v as string}</p></div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">
        «Fallos» = contraseña incorrecta, ID inexistente o cuenta suspendida. «Rechazos por bloqueo» se cuentan aparte (no se comprobó la contraseña).
        Orígenes = redes seudónimas distintas entre todos los intentos. Los metadatos de dispositivo existen solo desde {r?.primer_evento_forense ? fecha(r.primer_evento_forense as string) : 'la activación de esta fase'}; los eventos anteriores no los tienen y no se inventan.
      </p>

      {sel && <Ficha ev={sel} onCerrar={() => setSel(null)} />}

      <TrasFallos onAbrir={(t) => void abrirAcceso(t)} />

      <Graficos />

      <Card title={`Alertas por reglas (7 días) · ${detecciones.data?.length ?? 0}`}>
        {detecciones.loading ? <Spinner /> : (detecciones.data ?? []).length ? (
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            {detecciones.data!.map((d, i) => (
              <li key={i} className="py-2">
                <Badge tone={d.severidad === 'critica' || d.severidad === 'alta' ? 'red' : 'amber'}>{d.severidad}</Badge> <strong>{REGLA[d.regla] ?? d.regla}</strong> · {d.sujeto} · {d.eventos} eventos · {fecha(d.desde)} → {fecha(d.hasta)}
                <span className="block text-xs text-gray-500">Evidencia: {JSON.stringify(d.detalle)} · Limitación: {d.limitaciones} · Acción: {d.accion}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">Ninguna regla se activó en los últimos 7 días.</p>}
      </Card>

      <Card title={`Todos los usuarios que ingresan (30 días) · ${usuarios.data?.length ?? 0}`}>
        <p className="mb-2 text-xs text-gray-500">Cada inicio de sesión (correcto o fallido) de cualquier cuenta, con el mismo detalle. Pulse un usuario para ver su último intento y su historial.</p>
        {usuarios.loading ? <Spinner /> : (
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-left text-xs dark:border-white/10">
                <th className="py-1">Usuario</th><th>Rol</th><th className="text-right">Correctos</th><th className="text-right">Fallos</th><th>Último acceso</th><th>Último dispositivo</th><th>País</th><th className="text-right">Orígenes</th><th className="text-right">Disp. reconocidos</th>
              </tr></thead>
              <tbody>
                {(usuarios.data ?? []).map((u) => (
                  <tr key={u.login_id} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5" onClick={() => void abrirUsuario(u.login_id)}>
                    <td className="py-1">{u.full_name || u.login_id}<span className="block font-mono text-xs text-gray-500">{u.login_id}{u.student_code ? ` · ${u.student_code}` : ''}{!u.existe ? ' · inexistente' : ''}</span></td>
                    <td className="text-xs">{u.rol ?? '—'}{u.rol === 'student' && <Link className="enlace block" to={`/docente/estudiantes/${encodeURIComponent(u.login_id)}`} onClick={(e) => e.stopPropagation()}>ficha</Link>}</td>
                    <td className="text-right tabular-nums text-green-700">{u.correctos}</td>
                    <td className={`text-right tabular-nums ${u.fallos ? 'text-red-600' : ''}`}>{u.fallos}{u.rechazos ? <span className="block text-xs text-amber-700">+{u.rechazos} rech.</span> : null}</td>
                    <td className="whitespace-nowrap text-xs">{fecha(u.ultimo_acceso)}</td>
                    <td className="text-xs">{[u.ultimo_navegador, u.ultimo_sistema, u.ultimo_tipo].filter(Boolean).join(' · ') || 'sin datos'}</td>
                    <td className="text-xs">{u.ultimo_pais ?? '—'}</td>
                    <td className="text-right tabular-nums">{u.origenes}</td>
                    <td className="text-right tabular-nums">{u.dispositivos_reconocidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Intentos" actions={<button className="btn-secundario !py-1 text-xs" onClick={exportar} disabled={!(eventos.data ?? []).length}>Exportar CSV</button>}>
        <div className="mb-2 grid gap-2 sm:grid-cols-4">
          <input className="campo" placeholder="ID (p. ej. orbe)" value={login} onChange={(e) => setLogin(e.target.value)} />
          <select className="campo" value={resultado} onChange={(e) => setResultado(e.target.value)}>
            <option value="">Todos los resultados</option><option value="fallo">Fallos</option><option value="bloqueo">Rechazos por bloqueo</option><option value="correcto">Correctos</option>
          </select>
          <input className="campo" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <input className="campo" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {eventos.loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-left text-xs dark:border-white/10"><th className="py-1">Fecha</th><th>ID</th><th>Resultado</th><th>Origen</th><th>País</th><th>Dispositivo</th><th>+s</th><th /></tr></thead>
              <tbody>
                {(eventos.data ?? []).map((e) => (
                  <tr key={e.event_id} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5" onClick={() => setSel(e)}>
                    <td className="whitespace-nowrap py-1">{fecha(e.created_at)}</td>
                    <td>{e.login_id}{!e.existe && <span className="text-xs text-gray-500"> (inexistente)</span>}{e.rol && e.rol !== 'student' && <Badge tone="purple">{e.rol}</Badge>}</td>
                    <td className={e.success ? 'text-green-700' : 'text-red-600'}>{MOTIVO[e.reason] ?? e.reason}</td>
                    <td className="font-mono text-xs">{origen(e.ip_hash)}</td>
                    <td>{e.country ?? '—'}</td>
                    <td className="text-xs">{e.browser ? `${e.browser} / ${e.os ?? '?'}` : '—'}{e.dispositivo_reconocido ? ' ✓' : ''}</td>
                    <td className="tabular-nums text-xs">{e.segundos_desde_anterior ?? ''}</td>
                    <td className="text-xs">{e.clasificacion ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
