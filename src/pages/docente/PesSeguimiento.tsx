/**
 * Seguimiento docente de una PES en el aula (migración 75): monitor con filtros e historial por estudiante,
 * calibración de tiempos con informe comparativo y política del control presencial. Orbe Control tiene su propia
 * versión para el teléfono (orbe-control/src/PesOrbe.tsx) con la misma lógica (lib/pesMonitor, lib/pes).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  pesAplicarCalibracion, pesCalibracionBorrar, pesCalibrar, pesHistorial, pesInformeTiempos, pesMonitor, pesPoliticaControl,
  type DetallePes, type HistorialPes, type PoliticaControlPes,
} from '@/api/pes';
import { compararTiempos } from '@/lib/pes';
import { ESTADO_MONITOR, enApartadoS, filtrarMonitor, fmtDuracion, indicadores, porcentaje, resumenMonitor, type FilaMonitor } from '@/lib/pesMonitor';
import { formatoCuenta } from '@/lib/examen/reloj';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Field, Modal, Notice, Spinner } from '@/components/ui';
import { InlineMd } from '@/components/Markdown';
import { TABLA } from './PesTab';

const pts = (x: number) => (Math.round(x * 100 + 1e-7) / 100).toFixed(2).replace('.', ',');
const seg = (s: number) => (s >= 120 ? `${(Math.round(s / 6) / 10).toString().replace('.', ',')} min` : `${Math.round(s)} s`);
const TONO = { tecnico: 'red', revision: 'amber', avance: 'blue' } as const;

// ---------------------------------------------------------------------------------------------------------------
// Monitor
// ---------------------------------------------------------------------------------------------------------------
export function MonitorPes({ practica }: { practica: string }) {
  const m = useAsync(() => pesMonitor(practica), [practica]);
  const [filtro, setFiltro] = useState<{ texto: string; estado: FilaMonitor['estado'] | ''; conIndicadores: boolean }>({ texto: '', estado: '', conIndicadores: false });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [, setTic] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { void m.reload(); }, 20000);
    const r = setInterval(() => setTic((x) => x + 1), 1000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [practica]); // eslint-disable-line react-hooks/exhaustive-deps
  const desfase = useMemo(() => (m.data ? Date.parse(m.data.ahora) - Date.now() : 0), [m.data]);
  if (m.loading && !m.data) return <Spinner />;
  if (m.error) return <ErrorBox error={m.error} onRetry={m.reload} />;
  const d = m.data!;
  const ahora = Date.now() + desfase;
  const total = d.practica.apartados;
  const r = resumenMonitor(d);
  const filas = filtrarMonitor(d.estudiantes, filtro, total, ahora);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 text-sm sm:grid-cols-6">
        {[['Asignados', r.asignados], ['Sin empezar', r.sinEmpezar], ['En curso', r.enCurso], ['Terminadas', r.terminadas], ['Plazo terminado', r.vencidas], ['Por revisar', r.pendientesRevision]].map(([t, n]) => (
          <div key={t as string} className="tarjeta py-2"><p className="text-xs text-gray-500">{t}</p><p className="text-xl font-semibold">{n}</p></div>
        ))}
      </div>
      <Notice>Se actualiza cada 20 s. Los indicadores (respuestas muy breves, pegados bloqueados, inactividad) son para revisar: no son pruebas de fraude ni de uso de IA.</Notice>
      <div className="flex flex-wrap gap-2">
        <input className="campo w-56" placeholder="Buscar estudiante" value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} />
        <select className="campo w-auto" value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value as FilaMonitor['estado'] | '' })}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_MONITOR).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={filtro.conIndicadores} onChange={(e) => setFiltro({ ...filtro, conIndicadores: e.target.checked })} />Solo con indicadores</label>
        <button type="button" className="btn-secundario" onClick={() => m.reload()}>Actualizar</button>
      </div>
      {filas.length === 0 ? <Empty>Ningún estudiante coincide.</Empty> : (
        <div className="overflow-x-auto">
          <table className={TABLA}>
            <thead><tr><th>Estudiante</th><th>Estado</th><th>Actual</th><th>Avance</th><th>Omit. / antic.</th><th>Tiempo</th><th>Provisional</th><th>Máxima</th><th>Indicadores</th></tr></thead>
            <tbody>{filas.map((f) => {
              const t = enApartadoS(f, ahora);
              const ind = indicadores(f, total, ahora);
              return (
                <tr key={f.user_id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => setAbierto(f.user_id)}>
                  <td><span className="enlace">{f.nombre || '(sin nombre)'}</span><span className="block text-xs text-gray-500">{f.codigo ?? ''}</span></td>
                  <td>{ESTADO_MONITOR[f.estado]}</td>
                  <td>{f.actual ? <>{f.actual.ejercicio}{f.actual.letra}{t !== null && <span className={`block text-xs ${t < f.actual.t_min_s ? 'text-amber-700' : 'text-emerald-700'}`}>{formatoCuenta(t * 1000)} / {seg(f.actual.t_min_s)}</span>}</> : '—'}</td>
                  <td>{Math.round(porcentaje(f, total) * 100)} %<span className="block text-xs text-gray-500">{f.cerrados}/{total} apart. · {f.ejercicios_completos} ejerc.</span></td>
                  <td>{f.omitidos} / {f.anticipados}</td>
                  <td>{fmtDuracion(f.tiempo_total_s)}</td>
                  <td>{pts(f.puntaje.provisional.P)}<span className="block text-xs text-gray-500">validada {pts(f.puntaje.validada.P)}</span></td>
                  <td>{pts(f.puntaje.maxima_alcanzable.P)}</td>
                  <td className="space-y-1">{ind.map((i) => <Badge key={i.clave} tone={TONO[i.tipo]}>{i.texto}</Badge>)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {abierto && <HistorialModal practica={practica} user={abierto} onClose={() => setAbierto(null)} />}
    </div>
  );
}

const ACCION: Record<string, string> = { confirmada: 'A tiempo', anticipada: 'Anticipada', omitida: 'Omitida' };
const EVENTO: Record<string, string> = {
  condiciones_aceptadas: 'Aceptó las condiciones', apartado_revelado: 'Se mostró el apartado', apartado_confirmado: 'Confirmó', apartado_anticipado: 'Confirmó antes de tiempo',
  apartado_omitido: 'Omitió', practica_completada: 'Terminó la práctica', practica_vencida: 'Venció el plazo', pegado_bloqueado: 'Intento de pegar (bloqueado)',
  arrastre_bloqueado: 'Intento de arrastrar (bloqueado)', reconexion: 'Reconexión', adaptacion: 'Adaptación', revision_docente: 'Revisión docente',
  control_preparado: 'Control presencial preparado', control_realizado: 'Control presencial realizado', control_anulado: 'Control anulado', calificaciones_validadas: 'Validación docente',
};

export function textoRespuesta(a: HistorialPes['respuestas'][number]): string {
  const r = a.respuesta;
  if (!r) return a.accion === 'omitida' ? '(omitido)' : '—';
  if (r.selected) return r.selected.map((i) => `${String.fromCharCode(97 + i)}) ${a.opciones?.[i] ?? ''}`).join('; ');
  if (typeof r.value === 'boolean') return `${r.value ? 'Verdadero' : 'Falso'}${r.justification ? ` — ${r.justification}` : ''}`;
  return r.text ?? '—';
}

export function HistorialModal({ practica, user, onClose }: { practica: string; user: string; onClose: () => void }) {
  const h = useAsync(() => pesHistorial(practica, user), [practica, user]);
  return (
    <Modal open onClose={onClose} title={h.data ? `Historial · ${h.data.estudiante.nombre}` : 'Historial'}>
      {h.loading && !h.data ? <Spinner /> : h.error ? <ErrorBox error={h.error} /> : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm">
          <p>Provisional {pts(h.data!.puntaje.provisional.P)} · validada {pts(h.data!.puntaje.validada.P)} · máxima {pts(h.data!.puntaje.maxima_alcanzable.P)}
            {h.data!.puntaje.control.C !== null && <> · control presencial {pts(h.data!.puntaje.control.C)} (factor {pts(h.data!.puntaje.control.factor)})</>}</p>
          <table className={TABLA}>
            <thead><tr><th /><th>Respuesta</th><th>Decisión</th><th>Tiempo</th><th>Calidad</th></tr></thead>
            <tbody>{h.data!.respuestas.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold">{a.ejercicio}{a.letra}</td>
                <td className="max-w-xs"><span className="block text-xs text-gray-500"><InlineMd>{a.enunciado.length > 120 ? `${a.enunciado.slice(0, 120)}…` : a.enunciado}</InlineMd></span>
                  <span className="whitespace-pre-wrap">{textoRespuesta(a)}</span></td>
                <td>{ACCION[a.accion]}{a.accion === 'anticipada' && ` (m = ${a.m})`}</td>
                <td>{seg(Number(a.segundos))}<span className="block text-xs text-gray-500">mín. {seg(Number(a.t_min_s))}</span></td>
                <td>{a.revision === 'pendiente' ? <Badge tone="amber">Por revisar</Badge> : Number(a.q).toFixed(2)}{a.validada && ' ✓'}</td>
              </tr>
            ))}</tbody>
          </table>
          {h.data!.controles.length > 0 && (
            <div><h3 className="font-semibold">Controles presenciales</h3>
              <ul className="list-disc pl-5">{h.data!.controles.map((c) => <li key={c.id}>Ejercicio {c.ejercicio}: {c.estado}{c.resultado !== null && ` · resultado ${pts(Number(c.resultado))}`}{c.nota && ` · ${c.nota}`}</li>)}</ul></div>
          )}
          <details><summary className="cursor-pointer font-semibold">Registro de eventos ({h.data!.eventos.length})</summary>
            <ul className="mt-1 space-y-0.5 text-xs">{h.data!.eventos.map((ev, i) => (
              <li key={i}>{new Date(ev.at).toLocaleString('es-DO')} · {EVENTO[ev.tipo] ?? ev.tipo}{ev.ejercicio ? ` · ${ev.ejercicio}${ev.letra}` : ''}</li>
            ))}</ul>
          </details>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Calibración de tiempos e informe comparativo
// ---------------------------------------------------------------------------------------------------------------
export function PanelTiempos({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const inf = useAsync(() => pesInformeTiempos(d.practica.id), [d.practica.id]);
  const act = useAction();
  const [entrada, setEntrada] = useState<Record<string, string>>({});
  if (inf.loading && !inf.data) return <Spinner />;
  if (inf.error) return <ErrorBox error={inf.error} onRetry={inf.reload} />;
  const i = inf.data!;
  const rep = compararTiempos(i.apartados.map((a) => ({ etiqueta: `${a.ejercicio}${a.letra}`, t_ref_s: a.t_ref_s, t_min_s: Number(a.t_min_s),
    calibraciones: a.calibraciones.map((c) => Number(c.segundos)), piloto_s: a.piloto_s === null ? null : Number(a.piloto_s) })));
  const borrador = d.practica.estado === 'borrador';
  const leer = (s: string) => { const m = s.trim().match(/^(\d+)(?::(\d{1,2}))?$/); return m ? (m[2] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[1])) : NaN; };
  return (
    <Card title="Calibración de tiempos">
      <p className="text-sm text-gray-600 dark:text-gray-300">Registre el tiempo que necesitó una persona para resolver cada apartado correctamente en papel, en condiciones de
        referencia (mm:ss o segundos). La espera mínima es 1,20 × T_ref. En borrador, la mediana de lo medido puede pasar a ser el T_ref.</p>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <div>Tiempo de resolución esperado: <strong>{fmtDuracion(rep.esperadoS)}</strong></div>
        <div>Espera impuesta (crédito completo): <strong>{fmtDuracion(rep.impuestoS)}</strong></div>
        <div>Apartados calibrados: <strong>{rep.calibrados} de {rep.filas.length}</strong></div>
      </div>
      <table className={`${TABLA} mt-3`}>
        <thead><tr><th>Apartado</th><th>T_ref</th><th>Espera</th><th>Medidos</th><th>Mediana</th><th>Simulador</th><th>Impuesto/esperado</th><th>Añadir</th></tr></thead>
        <tbody>{rep.filas.map((f, k) => {
          const a = i.apartados[k];
          return (
            <tr key={a.id}>
              <td className="font-semibold">{f.etiqueta}</td><td>{seg(f.t_ref_s)}</td><td>{seg(f.t_min_s)}</td>
              <td className="text-xs">{a.calibraciones.map((c) => (
                <span key={c.id} className="mr-1 inline-flex items-center gap-1">{seg(Number(c.segundos))}{c.fuente === 'simulador' ? '*' : ''}
                  <button type="button" className="text-red-600" title="Quitar" onClick={async () => { await act.run(() => pesCalibracionBorrar(c.id)); await inf.reload(); }}>×</button></span>
              ))}</td>
              <td>{f.mediana === null ? '—' : seg(f.mediana)}</td>
              <td>{f.piloto_s === null ? '—' : seg(f.piloto_s)}</td>
              <td className={f.razon > 1.5 ? 'text-amber-700' : ''}>{f.mediana === null ? '—' : `× ${f.razon.toFixed(2).replace('.', ',')}`}</td>
              <td><form className="flex gap-1" onSubmit={async (e) => {
                e.preventDefault();
                const v = leer(entrada[a.id] ?? '');
                if (!(v > 0)) return;
                if ((await act.run(() => pesCalibrar(a.id, v, 'papel', ''))) !== undefined) { setEntrada({ ...entrada, [a.id]: '' }); await inf.reload(); }
              }}>
                <input className="campo w-20" placeholder="mm:ss" value={entrada[a.id] ?? ''} onChange={(e) => setEntrada({ ...entrada, [a.id]: e.target.value })} />
                <button className="btn-secundario px-2">+</button>
                {f.piloto_s !== null && <button type="button" className="btn-secundario px-2" title="Registrar el tiempo del simulador"
                  onClick={async () => { await act.run(() => pesCalibrar(a.id, f.piloto_s!, 'simulador', 'simulador docente')); await inf.reload(); }}>Sim.</button>}
              </form></td>
            </tr>
          );
        })}</tbody>
      </table>
      <p className="mt-1 text-xs text-gray-500">* medido en el simulador docente. Solo se ofrece el tiempo del simulador si no se adelantó el reloj en ese apartado.</p>
      <div className="mt-3 space-y-2">{rep.avisos.map((a, k) => <Notice key={k} tone={a.nivel === 'info' ? 'info' : 'warn'}>{a.texto}</Notice>)}</div>
      {borrador && rep.calibrados > 0 && (
        <button type="button" className="btn-primario mt-3" disabled={act.busy} onClick={async () => {
          const n = await act.run(() => pesAplicarCalibracion(d.practica.id));
          if (n !== undefined) { await inf.reload(); await recargar(); }
        }}>Usar la mediana como T_ref ({rep.calibrados} apartados)</button>
      )}
      <ErrorBox error={act.error} />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Política del control presencial (se define y se comunica antes de publicar)
// ---------------------------------------------------------------------------------------------------------------
export function PoliticaControl({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const p0 = d.practica.control_politica;
  const [p, setP] = useState<PoliticaControlPes>(p0);
  const act = useAction();
  const borrador = d.practica.estado === 'borrador';
  return (
    <Card title="Control presencial de comprensión">
      <p className="text-sm text-gray-600 dark:text-gray-300">Desde Orbe Control podrá elegir un ejercicio que el estudiante ya hizo y aplicarle uno equivalente en persona.
        Sus consecuencias deben estar definidas y comunicadas antes de publicar: el texto se muestra al estudiante en las condiciones.</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <Field label="Efecto">{(id) => (
          <select id={id} className="campo" disabled={!borrador} value={p.modo} onChange={(e) => setP({ ...p, modo: e.target.value as PoliticaControlPes['modo'], peso: e.target.value === 'ajuste' ? p.peso || 0.2 : 0 })}>
            <option value="informativo">Informativo (no cambia la puntuación)</option>
            <option value="ajuste">Ajuste: P × [1 − w·(1 − C)]</option>
          </select>
        )}</Field>
        {p.modo === 'ajuste' && <Field label="Peso w (0 a 0,3)">{(id) => <input id={id} className="campo" inputMode="decimal" disabled={!borrador} value={p.peso}
          onChange={(e) => setP({ ...p, peso: Math.min(0.3, Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) })} />}</Field>}
      </div>
      <Field label="Cómo será y qué consecuencias tiene (lo lee el estudiante)">{(id) => (
        <textarea id={id} className="campo min-h-[70px]" disabled={!borrador} value={p.descripcion} onChange={(e) => setP({ ...p, descripcion: e.target.value })} maxLength={2000} />
      )}</Field>
      {p.modo === 'ajuste' && <p className="text-xs text-gray-500">Con w = {String(p.peso).replace('.', ',')}, un control con resultado 0 deja la puntuación en el {Math.round((1 - p.peso) * 100)} %; cuenta el mejor resultado.</p>}
      {borrador ? (
        <button type="button" className="btn-secundario mt-2" disabled={act.busy} onClick={async () => { if ((await act.run(() => pesPoliticaControl(d.practica.id, p))) !== undefined) await recargar(); }}>Guardar política</button>
      ) : <p className="mt-2 text-xs text-gray-500">Publicada: la política está congelada.</p>}
      <ErrorBox error={act.error} />
    </Card>
  );
}

