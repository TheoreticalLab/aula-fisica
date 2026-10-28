/**
 * LIEIA · Proceso de respuesta en una evaluación real: telemetría seudonimizada de todos los intentos entregados,
 * reconstrucción temporal, detectores P1/P2 (solo si están validados) y P3 descriptivo, comparación por pregunta y
 * cronología de cada estudiante. Sin sanciones ni acusaciones: indicios con sus explicaciones legítimas.
 */
import { useMemo, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { analizarProceso } from '@/lib/lieia/detectoresProceso';
import { mediana } from '@/lib/lieia/estadistica';
import { reconstruir, type EventoCrudo } from '@/lib/lieia/proceso';
import { formatoDuracion } from '@/lib/tiempo';
import { Badge, Card, ErrorBox, Modal, Spinner } from '@/components/ui';
import validacionProceso from '@/lib/lieia/procesoValidacion.json';
import { CronologiaIntento, type ItemCronologia } from './Cronologia';

interface TelSeud { seudonimo: string; inicio: number; entrega: number | null; eventos: EventoCrudo[] }
const V = validacionProceso as { veredictos: Record<'p1' | 'p2', { estado: string }>; replicas: number };
const habilitadoP = (d: 'p1' | 'p2') => ['validado', 'validado_limitado'].includes(V.veredictos[d].estado);
const fmt = (s: number | null | undefined) => (s === null || s === undefined ? '—' : formatoDuracion(s));
const fmtP = (p: number | null | undefined) => (p === null || p === undefined ? '—' : p < 0.001 ? '< 0,001' : p.toFixed(3).replace('.', ','));

export function ProcesoExamen({ activityId, items, etiqueta, b }: { activityId: string; items: string[]; etiqueta: (seud: string) => string; b?: number[] }) {
  const st = useAsync(() => rpc<TelSeud[]>('lieia_telemetry', { p_activity: activityId }), [activityId]);
  const [ver, setVer] = useState<number | null>(null);
  const datos = useMemo(() => {
    const conTel = (st.data ?? []).filter((x) => x.eventos.length > 0);
    if (!conTel.length) return null;
    const procesos = conTel.map((x) => reconstruir(x.eventos, x.inicio, x.entrega, items));
    return { conTel, procesos, res: analizarProceso(procesos, items, { bootstrap: 199 }) };
  }, [st.data, items]);

  if (st.loading) return <Card title="Proceso de respuesta (telemetría)"><Spinner /></Card>;
  if (st.error) return <ErrorBox error={st.error} />;
  if (!datos) return <Card title="Proceso de respuesta (telemetría)"><p className="text-sm text-gray-500">Esta evaluación no tiene telemetría del proceso (se registra desde su activación).</p></Card>;
  const { conTel, procesos, res } = datos;
  const itemsCron: ItemCronologia[] = items.map((id, j) => ({ exercise_id: id, titulo: `Pregunta ${j + 1}`, b: b?.[j] ?? null }));
  const comparacion = new Map(items.map((id) => {
    const lat = procesos.map((p) => p.items.find((x) => x.exercise_id === id)?.latenciaGeneracion).filter((x): x is number => x !== null && x !== undefined);
    const per = procesos.map((p) => p.items.find((x) => x.exercise_id === id)?.persistencia).filter((x): x is number => x !== null && x !== undefined);
    return [id, { latencia: lat.length ? mediana(lat) : null, persistencia: per.length ? mediana(per) : null }];
  }));
  return (
    <Card title={`Proceso de respuesta (telemetría) · ${conTel.length} intentos con datos`}>
      <p className="mb-2 text-xs text-gray-500">
        P1 (rápidas con envío diferido): <Badge tone={habilitadoP('p1') ? 'green' : 'gray'}>{V.veredictos.p1.estado.replace('_', ' ')}</Badge> ·
        P2 (regularidad anómala): <Badge tone={habilitadoP('p2') ? 'amber' : 'gray'}>{V.veredictos.p2.estado.replace('_', ' ')}</Badge> ·
        P3 (apariciones de golpe): descriptivo. Validación con datos sintéticos en docs/LIEIA_PROCESO.md ({V.replicas} réplicas).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs dark:border-white/10">
            <th className="py-1">Estudiante</th><th className="text-right">Mediana hasta responder</th><th className="text-right">Activo</th><th className="text-right">Tras la última modificación</th>
            <th className="text-right">P1 p / q</th><th className="text-right">P2 p / q</th><th className="text-right">De golpe</th><th className="text-right">Calidad</th><th />
          </tr></thead>
          <tbody>{res.map((r, k) => {
            const p = procesos[k];
            const lats = p.items.map((x) => x.latenciaGeneracion).filter((x): x is number => x !== null);
            return (
              <tr key={k} className="border-b border-gray-100 dark:border-white/5">
                <td className="py-1">{etiqueta(conTel[k].seudonimo)}</td>
                <td className="text-right tabular-nums">{lats.length ? fmt(mediana(lats)) : '—'}</td>
                <td className="text-right tabular-nums">{p.cronologico ? `${Math.round((100 * p.activo) / p.cronologico)} %` : '—'}</td>
                <td className="text-right tabular-nums">{fmt(p.esperaFinal)}{p.esperaFinalInactiva ? <span className="block text-xs text-gray-500">{fmt(p.esperaFinalInactiva)} inactivo/oculto</span> : null}</td>
                <td className={`text-right tabular-nums ${r.q1 !== null && r.q1 < 0.1 ? 'font-semibold' : ''}`}>{habilitadoP('p1') && r.p1 ? `${fmtP(r.p1.p)} / ${fmtP(r.q1)}` : '—'}</td>
                <td className="text-right tabular-nums text-gray-500">{habilitadoP('p2') && r.p2 ? `${fmtP(r.p2.p)} / ${fmtP(r.q2)}` : '—'}</td>
                <td className="text-right tabular-nums">{r.p3.pegados}</td>
                <td className="text-right text-xs">{p.calidad.sesiones} ses. · {p.calidad.perdidos} perd.</td>
                <td><button className="btn-secundario !py-0.5 text-xs" onClick={() => setVer(k)}>Cronología</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Explicaciones legítimas: responder rápido y luego distraerse o dejar la pestaña abierta (P1); ser muy metódico o que las preguntas pidan un esfuerzo parecido (P2, indicio de potencia limitada);
        pegar desde notas propias o una calculadora (P3). Los eventos del navegador pueden perderse o manipularse. Nada de esto prueba fraude ni genera sanciones.
      </p>
      <h3 className="mb-1 mt-4 text-sm font-semibold">Comparación por pregunta (medianas de la sección)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Pregunta</th><th className="text-right">Dificultad (b)</th><th className="text-right">Hasta responder</th><th className="text-right">Antes del envío</th><th className="text-right">Cambios (media)</th><th className="text-right">Revisitas (media)</th></tr></thead>
          <tbody>{items.map((id, j) => {
            const c = comparacion.get(id)!;
            const cambios = procesos.map((p) => p.items.find((x) => x.exercise_id === id)?.cambios ?? 0);
            const rev = procesos.map((p) => p.items.find((x) => x.exercise_id === id)?.revisitas ?? 0);
            return (
              <tr key={id} className="border-b border-gray-100 dark:border-white/5">
                <td className="py-1">Pregunta {j + 1}</td><td className="text-right tabular-nums">{b?.[j] !== undefined ? b[j].toFixed(2) : '—'}</td>
                <td className="text-right tabular-nums">{fmt(c.latencia)}</td><td className="text-right tabular-nums">{fmt(c.persistencia)}</td>
                <td className="text-right tabular-nums">{(cambios.reduce((s, x) => s + x, 0) / cambios.length).toFixed(1)}</td>
                <td className="text-right tabular-nums">{(rev.reduce((s, x) => s + x, 0) / rev.length).toFixed(1)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <Modal open={ver !== null} onClose={() => setVer(null)} title={ver !== null ? `Cronología · ${etiqueta(conTel[ver].seudonimo)}` : ''}>
        {ver !== null && <CronologiaIntento p={procesos[ver]} items={itemsCron} comparacion={comparacion} />}
      </Modal>
    </Card>
  );
}
