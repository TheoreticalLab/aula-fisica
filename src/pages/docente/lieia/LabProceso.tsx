/** LIEIA · Pestaña «Proceso de respuesta»: experimentos con telemetría sintética y resultados de validación. */
import { useState } from 'react';
import { enTrabajador } from '@/lib/lieia/cliente';
import type { ResultadoLabProceso } from '@/lib/lieia/laboratorioProceso';
import { ESCENARIOS_PROCESO, PARAM_PROCESO, type EscenarioProceso, type ParamProceso } from '@/lib/lieia/simuladorProceso';
import { Badge, Card, ErrorBox, Spinner } from '@/components/ui';
import validacion from '@/lib/lieia/procesoValidacion.json';

const pct = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? '—' : `${(100 * x).toFixed(1)} %`);
type V = { generado: string; replicas: number; semilla: number; veredictos: Record<'p1' | 'p2', { estado: string; potencia: { escenario: EscenarioProceso; potencia: number | null }[]; fpr: { escenario: EscenarioProceso; fpr: number; ic: [number, number] }[] }>;
  robustez: { perdida: number; fprP1: number; fprP2: number; potP1: number | null; potP2: number | null; recuperadas: number; errorVistaS: number }[] };

export function LabProceso() {
  const [p, setP] = useState<ParamProceso>({ ...PARAM_PROCESO, escenario: 'rapida_diferida' });
  const [replicas, setReplicas] = useState(10);
  const [semilla, setSemilla] = useState(20261029);
  const [res, setRes] = useState<ResultadoLabProceso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = validacion as unknown as V;
  async function ejecutar() {
    setOcupado(true); setError(null);
    try { setRes(await enTrabajador<ResultadoLabProceso>({ tipo: 'proceso', param: p, replicas, semilla }).promesa); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setOcupado(false);
  }
  const num = (k: keyof ParamProceso, min: number, max: number, paso = 1) => <input type="number" className="campo" min={min} max={max} step={paso} value={p[k] as number} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} />;
  return (
    <div className="space-y-4">
      <Card title="Experimento con telemetría sintética">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2">Escenario
            <select className="campo" value={p.escenario} onChange={(e) => setP({ ...p, escenario: e.target.value as EscenarioProceso })}>
              {(['negativo', 'positivo', 'adversarial'] as const).map((tipo) => (
                <optgroup key={tipo} label={tipo === 'negativo' ? 'Comportamientos legítimos' : tipo === 'positivo' ? 'Mecanismos inyectados' : 'Adversariales'}>
                  {(Object.keys(ESCENARIOS_PROCESO) as EscenarioProceso[]).filter((e) => ESCENARIOS_PROCESO[e].tipo === tipo).map((e) => <option key={e} value={e}>{ESCENARIOS_PROCESO[e].titulo}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">{ESCENARIOS_PROCESO[p.escenario].descripcion}</span>
          </label>
          <label>Estudiantes{num('estudiantes', 6, 80)}</label>
          <label>Preguntas{num('items', 4, 40)}</label>
          <label>Implicados{num('implicados', 1, 15)}</label>
          <label>Fracción abiertas{num('fraccionAbiertas', 0, 1, 0.1)}</label>
          <label>Pérdida de eventos{num('perdida', 0, 0.8, 0.05)}</label>
          <label>Réplicas<input type="number" className="campo" min={1} max={60} value={replicas} onChange={(e) => setReplicas(Number(e.target.value))} /></label>
          <label>Semilla<input type="number" className="campo" value={semilla} onChange={(e) => setSemilla(Number(e.target.value))} /></label>
        </div>
        <button className="btn-primario mt-3" disabled={ocupado} onClick={() => void ejecutar()}>{ocupado ? 'Ejecutando…' : 'Ejecutar'}</button>
        <ErrorBox error={error} />
        {ocupado && <Spinner />}
        {res && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Detector</th><th className="text-right">Falsos positivos (IC 95 %)</th><th className="text-right">Potencia</th><th className="text-right">AUC</th><th className="text-right">Abstenciones</th></tr></thead>
              <tbody>{(['p1', 'p2'] as const).map((d) => (
                <tr key={d} className="border-b border-gray-100 dark:border-white/5">
                  <td className="py-1">{d === 'p1' ? 'P1 Rápidas con envío diferido' : 'P2 Regularidad anómala'}</td>
                  <td className={`text-right tabular-nums ${res[d].fprIC[1] > 0.075 ? 'text-red-600' : ''}`}>{pct(res[d].fpr)} <span className="text-xs text-gray-500">({pct(res[d].fprIC[0])}–{pct(res[d].fprIC[1])})</span></td>
                  <td className="text-right tabular-nums">{pct(res[d].potencia)}</td><td className="text-right tabular-nums">{res[d].auc?.toFixed(3) ?? '—'}</td><td className="text-right tabular-nums">{res[d].abstenciones}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="mt-2 text-sm">P3 (muchas apariciones de golpe): {pct(res.p3.conPegadosPositivos)} de los implicados · {pct(res.p3.conPegadosNegativos)} del resto (en el simulador los honestos no pegan: no indica nada de la realidad).</p>
            <p className="text-sm">Reconstrucción: error mediano de la hora de cada primera vista {res.reconstruccion.errorMedianoS.toFixed(2)} s (p90 {res.reconstruccion.error90S.toFixed(2)} s) · primeras vistas recuperadas {pct(res.reconstruccion.recuperadas)} · pérdida observada {pct(res.reconstruccion.perdidaObservada)}.</p>
          </div>
        )}
      </Card>
      <Card title="Validación de la telemetría (protocolo de aceptación)">
        <p className="mb-2 text-xs text-gray-500">Batería del {new Date(v.generado).toLocaleString('es-DO')} · {v.replicas} réplicas · semilla {v.semilla} · <code>scripts/lieia-proceso.ts</code> · informe en <code>docs/LIEIA_PROCESO.md</code>.</p>
        <ul className="text-sm">
          {(['p1', 'p2'] as const).map((d) => {
            const x = v.veredictos[d];
            const peor = [...x.fpr].sort((a, b) => b.ic[1] - a.ic[1])[0];
            return <li key={d} className="mb-1"><Badge tone={x.estado === 'validado' ? 'green' : x.estado === 'validado_limitado' ? 'amber' : 'red'}>{x.estado.replace('_', ' ')}</Badge> {d === 'p1' ? 'P1 Rápidas con envío diferido' : 'P2 Regularidad anómala'} · peor FP {pct(peor.fpr)} ({ESCENARIOS_PROCESO[peor.escenario].titulo}) · potencia {x.potencia.map((y) => `${ESCENARIOS_PROCESO[y.escenario].titulo}: ${pct(y.potencia)}`).join('; ')}</li>;
          })}
          <li><Badge>descriptivo</Badge> P3 Apariciones de golpe: no validable sin datos reales sobre cuánto pegan los estudiantes honestos.</li>
        </ul>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Pérdida de eventos</th><th className="text-right">FP P1</th><th className="text-right">FP P2</th><th className="text-right">Potencia P1</th><th className="text-right">Potencia P2</th><th className="text-right">Primeras vistas recuperadas</th></tr></thead>
          <tbody>{v.robustez.map((r) => (
            <tr key={r.perdida} className="border-b border-gray-100 dark:border-white/5"><td className="py-1">{pct(r.perdida)}</td><td className="text-right">{pct(r.fprP1)}</td><td className="text-right">{pct(r.fprP2)}</td><td className="text-right">{pct(r.potP1)}</td><td className="text-right">{pct(r.potP2)}</td><td className="text-right">{pct(r.recuperadas)}</td></tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}
