/**
 * Telemetría V2 — Reconstrucción del intento. Todo lo que se muestra sale de reconstruirPaquete() y auditarRespuestas()
 * (src/lib/telemetria/v2): la vista no calcula métricas propias, así que coincide con la exportación.
 * Describe el proceso OBSERVABLE; no interpreta intenciones ni detecta uso de IA.
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { telemetriaIntento } from '@/api/telemetria';
import { auditarRespuestas, reconstruirPaquete, type AuditoriaPregunta, type FuenteElegida, type PaqueteIntento } from '@/lib/telemetria/v2/fuente';
import { aCsv, filas, investigacion, type Nivel } from '@/lib/telemetria/v2/exportar';
import { CATEGORIAS, type Categoria, type EventoReconstruido, type Metrica, type Reconstruccion, type ResultadoPregunta } from '@/lib/telemetria/v2/modelo';
import { useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, PageTitle, Spinner } from '@/components/ui';

export const NOMBRE_CAT: Record<Categoria, string> = {
  observable_activo: 'Activa y observable', inactiva: 'Inactiva (sin interacción > 60 s)', sin_foco: 'Visible sin foco de la ventana', oculta: 'Página oculta',
  pausa_declarada: 'Pausa declarada', desconocido: 'Desconocido (sin señales fiables)', conflicto: 'Dos sesiones a la vez', sin_observacion: 'Sin observación',
};
const COLOR_CAT: Record<Categoria, string> = {
  observable_activo: '#2563eb', inactiva: '#93c5fd', sin_foco: '#a78bfa', oculta: '#9ca3af', pausa_declarada: '#f59e0b', desconocido: '#fca5a5', conflicto: '#dc2626', sin_observacion: '#e5e7eb',
};
const LETRA_CAT: Record<Categoria, string> = { observable_activo: 'A', inactiva: 'I', sin_foco: 'F', oculta: 'O', pausa_declarada: 'P', desconocido: '?', conflicto: '!', sin_observacion: '–' };
const FUENTE: Record<FuenteElegida, string> = {
  diario_examen: 'Diario del motor de examen (conciliado con el servidor)', v2: 'Telemetría V2 (reloj sincronizado, pregunta activa por control)',
  v1: 'Telemetría V1 (garantías reducidas: sin pregunta activa)', ninguna: 'Sin datos de telemetría',
};
const ESTADO: Record<Metrica['estado'], string> = {
  observado: 'observado', reconstruido: 'reconstruido', estimado: 'estimado', no_identificable: 'no identificable', informacion_insuficiente: 'información insuficiente', dato_temporal_invalido: 'dato temporal inválido',
};
const MARCA: Partial<Record<EventoReconstruido['tipo'], { s: string; n: string }>> = {
  edicion: { s: '▲', n: 'Edición' }, guardado_confirmado: { s: '●', n: 'Guardado confirmado' }, guardado_fallido: { s: '✕', n: 'Guardado fallido' },
  comprobacion: { s: '◆', n: 'Comprobación' }, interaccion: { s: '·', n: 'Interacción' }, pregunta_activada: { s: '▶', n: 'Activada' }, exposicion_inicio: { s: '◦', n: 'En pantalla' },
  entrega_solicitada: { s: '⚑', n: 'Entrega solicitada' }, entrega: { s: '⚑', n: 'Entrega' },
};

export function dur(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return `${m} min ${String(r).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
const hora = (ms: number | null) => (ms === null ? '—' : new Date(ms).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
export function valorMetrica(m: Metrica): string {
  if (m.valor === null) return m.estado === 'no_identificable' ? 'No identificable' : m.estado === 'dato_temporal_invalido' ? 'Dato temporal inválido' : 'Información insuficiente';
  return dur(m.valor);
}

export default function TelemetriaIntento() {
  const { attemptId = '' } = useParams();
  const st = useAsync(() => telemetriaIntento(attemptId), [attemptId]);
  const [vista, setVista] = useState<'resumen' | 'cronologia' | 'investigacion'>('resumen');
  const [ficha, setFicha] = useState<string | null>(null);
  const datos = useMemo(() => {
    if (!st.data) return null;
    const r = reconstruirPaquete(st.data);
    return { ...r, auditoria: auditarRespuestas(st.data, r.reconstruccion) };
  }, [st.data]);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} />;
  if (st.data === null) return <Empty>La Telemetría V2 aún no está instalada en el servidor (migración 42 pendiente).</Empty>;
  const p = st.data!, d = datos!;
  const rec = d.reconstruccion;
  const titulo = (id: string) => { const i = p.items.findIndex((x) => x.exercise_id === id); return i < 0 ? id.slice(0, 8) : `P${i + 1} · ${p.items[i].titulo}`; };
  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title="Telemetría V2 — Reconstrucción del intento" subtitle={<>Fuente: {FUENTE[d.fuente]}{rec && <> · motor {rec.version}</>}</>}
        back={{ to: `/docente/intentos/${attemptId}`, label: 'Revisión del intento' }} />
      <Card className="mb-4 text-sm">
        <p>Describe lo que la plataforma <strong>observó</strong> y lo que <strong>no pudo observar</strong>. No revela pensamientos, intenciones ni fuentes externas, y no es una prueba de uso de IA: una pausa, una página oculta o una respuesta rápida tienen muchas explicaciones legítimas.</p>
        {d.fuente === 'v1' && <p className="mt-1 text-amber-700 dark:text-amber-300">Datos V1: varias preguntas estaban en pantalla a la vez y no se registró cuál se trabajaba, así que el tiempo por pregunta no es identificable. La interacción con los controles de cada pregunta sí lo es.</p>}
        {d.discrepancias.length > 0 && <p className="mt-1">El diario del navegador contradice al servidor en {d.discrepancias.length} tramo(s): se muestran como «desconocido».</p>}
        {rec && rec.invariantes.length > 0 && <p className="mt-1 text-red-700">Comprobaciones internas fallidas: {rec.invariantes.join(' · ')}</p>}
      </Card>
      {!rec ? <Empty>No hay telemetría de este intento.</Empty> : (
        <>
          <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Vista">
            {(['resumen', 'cronologia', 'investigacion'] as const).map((k) => (
              <button key={k} role="tab" aria-selected={vista === k} className={vista === k ? 'btn-primario py-1' : 'btn-secundario py-1'} onClick={() => setVista(k)}>
                {k === 'resumen' ? 'Resumen' : k === 'cronologia' ? 'Cronología' : 'Investigación avanzada'}
              </button>
            ))}
          </div>
          {vista === 'resumen' && <Resumen rec={rec} auditoria={d.auditoria} titulo={titulo} onFicha={setFicha} />}
          {vista === 'cronologia' && <Cronologia rec={rec} titulo={titulo} onFicha={setFicha} />}
          {vista === 'investigacion' && <Investigacion rec={rec} p={p} fuente={d.fuente} auditoria={d.auditoria} />}
          {ficha && <Ficha q={rec.preguntas.find((x) => x.pregunta === ficha)!} a={d.auditoria.find((x) => x.exercise_id === ficha)} titulo={titulo(ficha)} item={p.items.find((x) => x.exercise_id === ficha)} onCerrar={() => setFicha(null)} />}
        </>
      )}
    </div>
  );
}

function Resumen({ rec, auditoria, titulo, onFicha }: { rec: Reconstruccion; auditoria: AuditoriaPregunta[]; titulo: (id: string) => string; onFicha: (id: string) => void }) {
  const retrasados = rec.sesiones.reduce((s, x) => s + x.muy_retrasados, 0), huecos = rec.sesiones.reduce((s, x) => s + x.huecos_secuencia, 0);
  const tarjetas: [string, string, string?][] = [
    ['Duración cronológica', dur(rec.T_wall)],
    ...CATEGORIAS.filter((c) => rec.totales[c] > 0).map((c) => [NOMBRE_CAT[c], dur(rec.totales[c]), COLOR_CAT[c]] as [string, string, string]),
    ['Sin conexión (superpuesto)', dur(rec.T_disconnected.valor)],
    ['Sesiones del navegador', String(rec.sesiones.length)],
    ['Eventos', String(rec.eventos.length)],
    ['Llegaron > 30 s tarde', String(retrasados)],
    ['Eventos perdidos (huecos)', String(huecos)],
  ];
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tarjetas.map(([k, v, c]) => (
          <div key={k} className="rounded-lg border border-gray-200 p-2 dark:border-white/10">
            <p className="flex items-center gap-1 text-xs text-gray-500">{c && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} aria-hidden />}{k}</p>
            <p className="text-lg font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      {rec.continuidades.length > 0 && (
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Entre sesiones: {rec.continuidades.map((c, i) => <span key={i}>{i ? ' · ' : ''}{c.tipo === 'misma_pestana' ? 'recarga en la misma pestaña' : c.tipo === 'otra_pestana' ? 'otra pestaña o dispositivo' : c.tipo === 'simultaneas' ? 'sesiones simultáneas' : 'relación desconocida'} ({c.hueco_ms >= 0 ? `${dur(c.hueco_ms)} sin observación` : `solapadas ${dur(-c.hueco_ms)}`})</span>)}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500">
            <th className="py-1">Pregunta</th><th>Foco</th><th>Interacción</th><th>Edición</th><th>Visitas</th><th>Hasta 1.ª respuesta</th><th>Respuesta</th><th>Calidad temporal</th>
          </tr></thead>
          <tbody>
            {rec.preguntas.map((q) => {
              const a = auditoria.find((x) => x.exercise_id === q.pregunta);
              return (
                <tr key={q.pregunta} className="border-t border-gray-100 dark:border-white/10">
                  <td className="py-1 pr-2"><button className="enlace text-left" onClick={() => onFicha(q.pregunta)}>{titulo(q.pregunta)}</button></td>
                  <td title={ESTADO[q.T_focus.estado]}>{valorMetrica(q.T_focus)}</td>
                  <td title={q.T_interaction.nota}>{valorMetrica(q.T_interaction)}</td>
                  <td>{valorMetrica(q.T_edit)}</td>
                  <td title={q.visitas.nota}>{q.visitas.valor ?? '—'}{q.visitas.estado === 'estimado' ? '*' : ''}</td>
                  <td>{valorMetrica(q.T_until_first_response)}</td>
                  <td>{a ? <Badge tone={a.diagnostico === 'guardada' || a.diagnostico === 'sin_historial' ? 'green' : a.diagnostico === 'escrita_sin_guardar' ? 'red' : 'gray'}>{a.diagnostico.replace(/_/g, ' ')}</Badge> : '—'}</td>
                  <td><Badge tone={q.calidad.temporal === 'buena' ? 'green' : q.calidad.temporal === 'parcial' ? 'amber' : q.calidad.temporal === 'baja' ? 'red' : 'gray'}>{q.calidad.temporal}{q.calidad.cobertura !== null ? ` ${Math.round(100 * q.calidad.cobertura)} %` : ''}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-gray-500">* Apariciones en pantalla, no visitas. Pulse una pregunta para ver su ficha. «Foco» y «trabajo» son tiempos observables, no tiempo de pensamiento.</p>
      </div>
    </>
  );
}

function Cronologia({ rec, titulo, onFicha }: { rec: Reconstruccion; titulo: (id: string) => string; onFicha: (id: string) => void }) {
  const [ventana, setVentana] = useState<[number, number]>([rec.dominio.inicio, Math.max(rec.dominio.fin, rec.dominio.inicio + 1000)]);
  const [sel, setSel] = useState<EventoReconstruido | null>(null);
  const [tipos, setTipos] = useState<Set<string>>(new Set(['edicion', 'guardado_confirmado', 'guardado_fallido', 'comprobacion', 'pregunta_activada', 'entrega', 'entrega_solicitada']));
  const W = 1000, IZQ = 170, FILA = 26, filasQ = rec.preguntas.length, H = 30 + FILA * (filasQ + 1) + 10;
  const [a, b] = ventana;
  const x = (t: number) => IZQ + ((Math.min(Math.max(t, a), b) - a) / (b - a)) * (W - IZQ - 10);
  const zoom = (f: number) => { const c = (a + b) / 2, m = Math.max(5000, ((b - a) * f) / 2); setVentana([Math.max(rec.dominio.inicio, c - m), Math.min(rec.dominio.fin, c + m)]); };
  const mover = (f: number) => { const w = b - a, d = w * f; const na = Math.min(Math.max(rec.dominio.inicio, a + d), rec.dominio.fin - w); setVentana([na, na + w]); };
  const visibleIv = (iv: { inicio: number; fin: number }) => iv.fin > a && iv.inicio < b;
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <button className="btn-secundario py-1" onClick={() => zoom(0.5)} aria-label="Acercar">＋ Acercar</button>
        <button className="btn-secundario py-1" onClick={() => zoom(2)} aria-label="Alejar">－ Alejar</button>
        <button className="btn-secundario py-1" onClick={() => mover(-0.25)} aria-label="Hacia atrás">◀</button>
        <button className="btn-secundario py-1" onClick={() => mover(0.25)} aria-label="Hacia adelante">▶</button>
        <button className="btn-texto" onClick={() => setVentana([rec.dominio.inicio, rec.dominio.fin])}>Todo el intento</button>
        <span className="text-gray-500">{hora(a)} – {hora(b)} ({dur(b - a)})</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-3 text-xs" aria-label="Filtros de marcas">
        {Object.entries(MARCA).map(([k, m]) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={tipos.has(k)} onChange={(e) => { const s = new Set(tipos); if (e.target.checked) s.add(k); else s.delete(k); setTipos(s); }} />
            <span aria-hidden>{m!.s}</span> {m!.n}
          </label>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img" aria-label="Cronología del intento por pregunta">
        <text x={8} y={22} fontSize={11} fill="currentColor">Intento</text>
        {rec.particion.filter(visibleIv).map((t, i) => (
          <g key={i}>
            <rect x={x(t.inicio)} y={10} width={Math.max(1, x(t.fin) - x(t.inicio))} height={18} fill={COLOR_CAT[t.cat]}><title>{`${NOMBRE_CAT[t.cat]}: ${hora(t.inicio)}–${hora(t.fin)} (${dur(t.fin - t.inicio)})`}</title></rect>
            {x(t.fin) - x(t.inicio) > 14 && <text x={(x(t.inicio) + x(t.fin)) / 2} y={23} fontSize={10} textAnchor="middle" fill={t.cat === 'observable_activo' || t.cat === 'conflicto' ? '#fff' : '#111'}>{LETRA_CAT[t.cat]}</text>}
          </g>
        ))}
        {rec.preguntas.map((q, k) => {
          const y = 34 + FILA * (k + 1) - FILA;
          return (
            <g key={q.pregunta}>
              <text x={8} y={y + 15} fontSize={11} fill="currentColor" style={{ cursor: 'pointer' }} onClick={() => onFicha(q.pregunta)}>{titulo(q.pregunta).slice(0, 26)}</text>
              <line x1={IZQ} x2={W - 10} y1={y + 11} y2={y + 11} stroke="#e5e7eb" />
              {q.intervalos.exposicion.filter(visibleIv).map((iv, i) => <rect key={`e${i}`} x={x(iv.inicio)} y={y + 4} width={Math.max(1, x(iv.fin) - x(iv.inicio))} height={14} fill="#dbeafe"><title>{`En pantalla ${dur(iv.fin - iv.inicio)}`}</title></rect>)}
              {q.intervalos.foco.filter(visibleIv).map((iv, i) => <rect key={`f${i}`} x={x(iv.inicio)} y={y + 6} width={Math.max(1, x(iv.fin) - x(iv.inicio))} height={10} fill="#2563eb"><title>{`Activa ${dur(iv.fin - iv.inicio)}`}</title></rect>)}
              {q.intervalos.edicion.filter(visibleIv).map((iv, i) => <rect key={`d${i}`} x={x(iv.inicio)} y={y + 16} width={Math.max(2, x(iv.fin) - x(iv.inicio))} height={4} fill="#059669"><title>{`Edición ${dur(iv.fin - iv.inicio)}`}</title></rect>)}
              {rec.eventos.filter((e) => e.pregunta === q.pregunta && e.t !== null && e.t >= a && e.t <= b && tipos.has(e.tipo) && MARCA[e.tipo]).map((e, i) => (
                <text key={`m${i}`} x={x(e.t!)} y={y + 9} fontSize={11} textAnchor="middle" fill={e.tipo === 'guardado_fallido' ? '#dc2626' : '#111'} style={{ cursor: 'pointer' }} onClick={() => setSel(e)}>
                  {MARCA[e.tipo]!.s}<title>{`${MARCA[e.tipo]!.n} · ${hora(e.t)}`}</title>
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {CATEGORIAS.map((c) => <span key={c} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: COLOR_CAT[c] }} aria-hidden />{LETRA_CAT[c]} {NOMBRE_CAT[c]}</span>)}
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#dbeafe' }} aria-hidden />En pantalla</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#2563eb' }} aria-hidden />Pregunta activa</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-sm" style={{ background: '#059669' }} aria-hidden />Edición</span>
      </div>
      {sel && (
        <div className="mt-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-white/10" role="region" aria-label="Evento seleccionado">
          <div className="flex justify-between"><strong>{MARCA[sel.tipo]?.n ?? sel.tipo}</strong><button className="btn-texto" onClick={() => setSel(null)}>Cerrar</button></div>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            <dt className="text-gray-500">Hora (servidor)</dt><dd>{hora(sel.t)}</dd>
            <dt className="text-gray-500">Pregunta</dt><dd>{sel.pregunta ? titulo(sel.pregunta) : '—'}</dd>
            <dt className="text-gray-500">Sesión · secuencia</dt><dd>{sel.sesion.slice(0, 8)} · {sel.seq}</dd>
            <dt className="text-gray-500">Origen</dt><dd>{sel.fuente === 'servidor' ? 'servidor (autoritativo)' : sel.fuente === 'diario' ? 'diario conciliado' : 'navegador (declarado)'}</dd>
            <dt className="text-gray-500">Fuente temporal</dt><dd>{sel.tau !== null ? `reloj monotónico ${dur(sel.tau)} desde el inicio de la sesión` : 'hora del servidor'}</dd>
            <dt className="text-gray-500">Retraso de recepción</dt><dd>{sel.retraso_ms === null ? '—' : dur(sel.retraso_ms)}</dd>
            <dt className="text-gray-500">Registro original</dt><dd className="font-mono text-xs">{sel.ref ?? '—'}</dd>
          </dl>
        </div>
      )}
    </Card>
  );
}

function Ficha({ q, a, titulo, item, onCerrar }: { q: ResultadoPregunta; a?: AuditoriaPregunta; titulo: string; item?: PaqueteIntento['items'][number]; onCerrar: () => void }) {
  const metricas: [string, Metrica][] = [['Tiempo cronológico', q.T_wall], ['En pantalla', q.T_exposure], ['Foco (activa)', q.T_focus], ['Interacción', q.T_interaction],
    ['Edición', q.T_edit], ['Trabajo candidato', q.T_candidate_work], ['Hasta la primera respuesta', q.T_until_first_response]];
  const texto = (ans: Record<string, unknown> | null | undefined) => (ans ? (ans.text as string) ?? (Array.isArray(ans.selected) ? `opción ${(ans.selected as number[]).map((i) => i + 1).join(', ')}` : typeof ans.value === 'boolean' ? (ans.value ? 'Verdadero' : 'Falso') : '—') : '—');
  return (
    <Card className="mt-4">
      <div className="flex items-start justify-between gap-2">
        <div><h3 className="font-semibold">{titulo}</h3>{item && <p className="text-xs text-gray-500">{item.slug} · {item.dificultad} · {item.formato}</p>}</div>
        <button className="btn-texto" onClick={onCerrar}>Cerrar</button>
      </div>
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold">Tiempos</h4>
          <dl className="text-sm">
            {metricas.map(([k, m]) => <div key={k} className="flex justify-between border-b border-dotted border-gray-200 py-0.5 dark:border-white/10"><dt>{k}</dt><dd title={m.nota}>{valorMetrica(m)} <span className="text-xs text-gray-500">({ESTADO[m.estado]})</span></dd></div>)}
            <div className="flex justify-between py-0.5"><dt>Visitas</dt><dd>{q.visitas.valor ?? '—'} <span className="text-xs text-gray-500">({ESTADO[q.visitas.estado]})</span></dd></div>
          </dl>
          <h4 className="mt-3 text-sm font-semibold">Secuencia</h4>
          <ul className="text-sm">
            <li>Primera vez en pantalla: {hora(q.primera_exposicion)}</li>
            <li>Primera activación: {hora(q.primera_activacion)}</li>
            <li>Primera respuesta: {hora(q.primera_respuesta)}</li>
            <li>Último guardado confirmado: {hora(q.ultimo_guardado_confirmado)}</li>
            <li>Ediciones: {q.ediciones} · vaciados: {q.borrados}</li>
          </ul>
          <h4 className="mt-3 text-sm font-semibold">Calidad (por dimensión)</h4>
          <ul className="text-sm">
            <li>Temporal: {q.calidad.temporal}{q.calidad.cobertura !== null ? ` (${Math.round(100 * q.calidad.cobertura)} % observado)` : ''}</li>
            <li>Atribución: {q.calidad.atribucion}</li>
            <li>Completitud de eventos: {q.calidad.completitud}</li>
            <li>Respuesta: {q.calidad.respuesta.replace(/_/g, ' ')}</li>
            <li>Guardados: {q.calidad.sincronizacion.guardados_ok} confirmados, {q.calidad.sincronizacion.guardados_fallidos} fallidos</li>
          </ul>
          {q.advertencias.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{q.advertencias.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
        <div>
          <h4 className="text-sm font-semibold">Respuesta</h4>
          {a ? (
            <>
              <p className="text-sm">{a.explicacion}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded border border-gray-200 p-2 dark:border-white/10"><p className="text-xs text-gray-500">Primera guardada{a.primera ? ` (rev. 1, ${new Date(a.primera.primero_at).toLocaleTimeString('es-DO')})` : ''}</p><p className="font-mono">{texto(a.primera?.answer)}</p></div>
                <div className="rounded border border-gray-200 p-2 dark:border-white/10"><p className="text-xs text-gray-500">Final{a.final ? ` (rev. ${a.final.rev})` : ''}</p><p className="font-mono">{texto(a.final?.answer ?? a.actual?.answer)}</p></div>
              </div>
              <p className="mt-2 text-sm">Entregada: {a.entregada ? `revisión ${a.entregada.rev ?? '—'} (${a.entregada.status})` : 'sin instantánea de entrega'}</p>
              {a.actual && <p className="text-sm">Resultado: {a.actual.status}{a.actual.auto_credit !== null ? ` · crédito ${a.actual.auto_credit}` : ''}{a.actual.engine_code ? ` · ${a.actual.engine_code}` : ''}</p>}
              {a.evaluaciones.length > 0 && (
                <details className="mt-2 text-sm"><summary className="cursor-pointer">Comprobaciones y calificaciones ({a.evaluaciones.length})</summary>
                  <ul className="mt-1 space-y-0.5">{a.evaluaciones.map((e, i) => <li key={i}>{new Date(e.at).toLocaleTimeString('es-DO')} · {e.kind} · {texto(e.answer)} → {String((e.result as { status?: string } | null)?.status ?? '—')}</li>)}</ul>
                </details>
              )}
              {a.revisiones.length > 2 && <p className="mt-1 text-xs text-gray-500">{a.revisiones.length} revisiones guardadas (los guardados seguidos en menos de 20 s se consolidan).</p>}
            </>
          ) : <p className="text-sm text-gray-500">Sin datos de respuesta.</p>}
        </div>
      </div>
    </Card>
  );
}

function Investigacion({ rec, p, fuente, auditoria }: { rec: Reconstruccion; p: PaqueteIntento; fuente: FuenteElegida; auditoria: AuditoriaPregunta[] }) {
  const ctx = { attempt_id: p.intento.id, fuente, titulos: Object.fromEntries(p.items.map((i, k) => [i.exercise_id, `P${k + 1} ${i.titulo}`])) };
  const bajar = (nombre: string, contenido: string, tipo: string) => {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = document.createElement('a'); a.href = url; a.download = nombre; a.click(); URL.revokeObjectURL(url);
  };
  const exportar = (n: Nivel) => {
    const base = `telemetria-v2_${p.intento.id.slice(0, 8)}_nivel-${n}`;
    if (n === 'E') bajar(`${base}.json`, JSON.stringify(investigacion(rec, ctx, auditoria, new Date().toISOString()), null, 2), 'application/json');
    else bajar(`${base}.csv`, aCsv(filas(n, rec, ctx, auditoria)), 'text/csv;charset=utf-8');
  };
  const [pagina, setPagina] = useState(0);
  const POR = 100;
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-2 font-semibold">Exportar (mismo cálculo que esta vista)</h3>
        <div className="flex flex-wrap gap-2">
          {([['A', 'A · Resumen del intento'], ['B', 'B · Preguntas'], ['C', 'C · Intervalos'], ['D', 'D · Eventos'], ['E', 'E · Investigación (JSON)']] as const).map(([n, l]) => (
            <button key={n} className="btn-secundario py-1 text-sm" onClick={() => exportar(n)}>{l}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">Motor {rec.version} · parámetros {JSON.stringify(rec.parametros)}. Los valores no identificables se exportan vacíos con su estado. Para exportaciones de muchos intentos y con seudónimos, use el Centro de Datos.</p>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">Sesiones del navegador</h3>
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-gray-500"><th>Sesión</th><th>Eventos</th><th>Ancla</th><th>Incertidumbre</th><th>Cobertura</th><th>Huecos</th><th>Duplicados</th><th>&gt; 30 s tarde</th><th>Retraso máx.</th></tr></thead>
          <tbody>{rec.sesiones.map((s) => (
            <tr key={s.sesion} className="border-t border-gray-100 dark:border-white/10">
              <td className="font-mono">{s.sesion.slice(0, 8)}</td><td>{s.eventos}</td><td>{s.ancla_tipo}</td><td>{s.incertidumbre_ms === null ? '—' : `± ${dur(s.incertidumbre_ms)}`}</td>
              <td>{s.cobertura ? `${hora(s.cobertura.inicio)}–${hora(s.cobertura.fin)}` : '—'}</td><td>{s.huecos_secuencia}</td><td>{s.duplicados}</td><td>{s.muy_retrasados}</td><td>{dur(s.retraso_max_ms)}</td>
            </tr>))}</tbody>
        </table></div>
        {rec.advertencias.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-gray-600 dark:text-gray-300">{rec.advertencias.map((w, i) => <li key={i}>{w}</li>)}</ul>}
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">Eventos ({rec.eventos.length})</h3>
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-gray-500"><th>Hora</th><th>Tipo</th><th>Pregunta</th><th>Origen</th><th>Sesión·seq</th><th>Retraso</th><th>Registro</th></tr></thead>
          <tbody>{rec.eventos.slice(pagina * POR, (pagina + 1) * POR).map((e) => (
            <tr key={`${e.sesion}#${e.seq}`} className="border-t border-gray-100 dark:border-white/10">
              <td>{hora(e.t)}</td><td>{e.tipo}</td><td>{e.pregunta ? ctx.titulos[e.pregunta]?.slice(0, 20) ?? e.pregunta.slice(0, 8) : '—'}</td><td>{e.fuente}</td>
              <td className="font-mono">{e.sesion.slice(0, 6)}·{e.seq}</td><td>{dur(e.retraso_ms)}</td><td className="font-mono">{e.ref ?? '—'}</td>
            </tr>))}</tbody>
        </table></div>
        {rec.eventos.length > POR && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <button className="btn-texto" disabled={pagina === 0} onClick={() => setPagina((x) => x - 1)}>◀ Anteriores</button>
            <span>{pagina * POR + 1}–{Math.min(rec.eventos.length, (pagina + 1) * POR)}</span>
            <button className="btn-texto" disabled={(pagina + 1) * POR >= rec.eventos.length} onClick={() => setPagina((x) => x + 1)}>Siguientes ▶</button>
          </div>
        )}
      </Card>
      <p className="text-xs text-gray-500">Origen «navegador» = declarado por el cliente (puede perderse, retrasarse o alterarse); «servidor» = hecho autoritativo. <Link className="enlace" to="/ayuda">Ayuda</Link></p>
    </div>
  );
}
