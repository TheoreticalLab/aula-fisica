/** LIEIA · Pestaña «Laboratorio»: diseñar, ejecutar y comparar experimentos con datos sintéticos y verdad conocida. */
import { useRef, useState } from 'react';
import { enTrabajador } from '@/lib/lieia/cliente';
import { DETECTORES, type Detector, type ResultadoExperimento } from '@/lib/lieia/laboratorio';
import { ESCENARIOS, PARAMETROS_BASE, type Escenario, type ParametrosSim } from '@/lib/lieia/simulador';
import { clavePareja } from '@/lib/lieia/tipos';
import { Badge, Card, ErrorBox } from '@/components/ui';
import { CurvasRoc, Fiabilidad, HistogramaNulo, LineasBarrido, MatrizParejas, useTema } from './graficos';

const pct = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? '—' : `${(100 * x).toFixed(1)} %`);
type Barrido = { valor: number; detectores: ResultadoExperimento['detectores'] }[];
const PARAM_BARRIDO: { k: keyof ParametrosSim; titulo: string; valores: number[] }[] = [
  { k: 'intensidad', titulo: 'Intensidad (prob. de copiar cada ítem / de acertar con ayuda)', valores: [0.2, 0.35, 0.5, 0.7, 0.9] },
  { k: 'retardoMediano', titulo: 'Retardo de la copia (s)', valores: [10, 30, 90, 240, 600] },
  { k: 'estudiantes', titulo: 'Número de estudiantes', valores: [12, 20, 36, 60] },
  { k: 'items', titulo: 'Número de ítems', valores: [10, 16, 24, 40] },
  { k: 'implicados', titulo: 'Parejas / receptores / asistidos', valores: [1, 2, 4, 8] },
];

export function Laboratorio() {
  const t = useTema();
  const [p, setP] = useState<ParametrosSim>({ ...PARAMETROS_BASE, escenario: 'parejas' });
  const [replicas, setReplicas] = useState(10);
  const [semilla, setSemilla] = useState(20261027);
  const [alfa, setAlfa] = useState(0.05);
  const [perm, setPerm] = useState(99);
  const [progreso, setProgreso] = useState<[number, number] | null>(null);
  const [res, setRes] = useState<ResultadoExperimento | null>(null);
  const [historial, setHistorial] = useState<{ etiqueta: string; r: ResultadoExperimento }[]>([]);
  const [barrido, setBarrido] = useState<{ param: string; filas: Barrido } | null>(null);
  const [paramB, setParamB] = useState(0);
  const [detHist, setDetHist] = useState<Detector>('d1');
  const [error, setError] = useState<string | null>(null);
  const cancelar = useRef<(() => void) | null>(null);
  const cfg = () => ({ parametros: p, replicas, semilla, alfa, qUmbral: 0.1, analisis: { permutaciones: perm, bootstrap: perm } });

  async function ejecutar() {
    setError(null); setBarrido(null); setProgreso([0, replicas]);
    const tarea = enTrabajador<ResultadoExperimento>({ tipo: 'experimento', cfg: cfg() }, (h, tot) => setProgreso([h, tot]));
    cancelar.current = tarea.cancelar;
    try {
      const r = await tarea.promesa;
      setRes(r);
      setHistorial((h) => [{ etiqueta: `${ESCENARIOS[p.escenario].titulo} · n=${p.estudiantes} · ${p.items} ítems · int=${p.intensidad} · sem=${semilla}`, r }, ...h].slice(0, 8));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setProgreso(null);
  }
  async function barrer() {
    const b = PARAM_BARRIDO[paramB];
    setError(null); setProgreso([0, b.valores.length]);
    const tarea = enTrabajador<Barrido>({ tipo: 'barrido', cfg: cfg(), parametro: b.k, valores: b.valores }, (h, tot) => setProgreso([h, tot]));
    cancelar.current = tarea.cancelar;
    try { setBarrido({ param: b.titulo, filas: await tarea.promesa }); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setProgreso(null);
  }

  const num = (k: keyof ParametrosSim, min: number, max: number, paso = 1) => (
    <input type="number" className="campo" min={min} max={max} step={paso} value={p[k] as number} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} />
  );
  const ej = res?.ejemplo;
  return (
    <div className="space-y-4">
      <Card title="Diseño del experimento (datos sintéticos, separados de los registros reales)">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2">Escenario
            <select className="campo" value={p.escenario} onChange={(e) => setP({ ...p, escenario: e.target.value as Escenario })}>
              {(['negativo', 'positivo', 'adversarial'] as const).map((tipo) => (
                <optgroup key={tipo} label={tipo === 'negativo' ? 'Controles negativos (sin dependencia)' : tipo === 'positivo' ? 'Controles positivos (dependencia inyectada)' : 'Adversariales'}>
                  {(Object.keys(ESCENARIOS) as Escenario[]).filter((e) => ESCENARIOS[e].tipo === tipo).map((e) => <option key={e} value={e}>{ESCENARIOS[e].titulo}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">{ESCENARIOS[p.escenario].descripcion}</span>
          </label>
          <label>Estudiantes{num('estudiantes', 8, 120)}</label>
          <label>Ítems{num('items', 6, 60)}</label>
          <label>Fracción de selección múltiple{num('fraccionSeleccion', 0, 1, 0.1)}</label>
          <label>Dificultad media (logits){num('dificultadMedia', -3, 3, 0.5)}</label>
          <label>Intensidad{num('intensidad', 0, 1, 0.05)}</label>
          <label>Implicados{num('implicados', 1, 15)}</label>
          <label>Retardo de la copia (s){num('retardoMediano', 1, 900, 5)}</label>
          <label>Réplicas<input type="number" className="campo" min={1} max={100} value={replicas} onChange={(e) => setReplicas(Number(e.target.value))} /></label>
          <label>Semilla<input type="number" className="campo" value={semilla} onChange={(e) => setSemilla(Number(e.target.value))} /></label>
          <label>α<select className="campo" value={alfa} onChange={(e) => setAlfa(Number(e.target.value))}>{[0.01, 0.05, 0.1].map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          <label>Permutaciones / remuestreos<select className="campo" value={perm} onChange={(e) => setPerm(Number(e.target.value))}>{[49, 99, 199].map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-primario" disabled={!!progreso} onClick={() => void ejecutar()}>Ejecutar experimento</button>
          <select className="campo !w-auto" value={paramB} onChange={(e) => setParamB(Number(e.target.value))}>{PARAM_BARRIDO.map((b, k) => <option key={b.k} value={k}>Barrido: {b.titulo}</option>)}</select>
          <button className="btn-secundario" disabled={!!progreso} onClick={() => void barrer()}>Ejecutar barrido</button>
          {progreso && (
            <span className="flex items-center gap-2 text-sm">
              <span className="h-2 w-40 overflow-hidden rounded bg-gray-200 dark:bg-white/10"><span className="block h-full bg-primario-600" style={{ width: `${(100 * progreso[0]) / Math.max(1, progreso[1])}%` }} /></span>
              {progreso[0]}/{progreso[1]} <button className="btn-texto text-xs" onClick={() => { cancelar.current?.(); setProgreso(null); }}>Cancelar</button>
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">Misma semilla y parámetros ⇒ mismos resultados. Los cálculos corren en segundo plano en este navegador; nada se guarda en el servidor.</p>
        <ErrorBox error={error} />
      </Card>

      {res && (
        <>
          <Card title={`Resultados · ${ESCENARIOS[res.config.parametros.escenario].titulo} · ${res.config.replicas} réplicas · ${res.segundos.toFixed(1)} s`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs dark:border-white/10">
                  <th className="py-1">Detector</th><th className="text-right">Falsos positivos a α (IC 95 %)</th><th className="text-right">Potencia a α (IC 95 %)</th>
                  <th className="text-right">FDR con BH (q &lt; 0,1)</th><th className="text-right">Potencia con BH</th><th className="text-right">AUC</th><th className="text-right">Abstenciones</th><th>Otras dependencias señaladas</th>
                </tr></thead>
                <tbody>
                  {(Object.keys(DETECTORES) as Detector[]).map((d) => {
                    const m = res.detectores[d];
                    const malo = m.fprIC[1] > 0.075;
                    return (
                      <tr key={d} className="border-b border-gray-100 dark:border-white/5">
                        <td className="py-1"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color(d) }} />{d.toUpperCase()} {DETECTORES[d].nombre}</td>
                        <td className={`text-right tabular-nums ${malo ? 'text-red-600' : ''}`}>{pct(m.fpr)} <span className="text-xs text-gray-500">({pct(m.fprIC[0])}–{pct(m.fprIC[1])})</span></td>
                        <td className="text-right tabular-nums">{m.potencia === null ? '—' : <>{pct(m.potencia)} <span className="text-xs text-gray-500">({pct(m.potenciaIC?.[0])}–{pct(m.potenciaIC?.[1])})</span></>}</td>
                        <td className="text-right tabular-nums">{pct(m.fdrBH)}</td>
                        <td className="text-right tabular-nums">{pct(m.potenciaBH)}</td>
                        <td className="text-right tabular-nums">{m.auc === null ? '—' : m.auc.toFixed(3)}</td>
                        <td className="text-right tabular-nums">{m.abstenciones}</td>
                        <td className="text-xs">{m.señaladosOtros.causaComunTotal ? `causa común: ${pct(m.señaladosOtros.causaComun / m.señaladosOtros.causaComunTotal)}` : ''}{m.señaladosOtros.indirectasTotal ? ` indirectas: ${pct(m.señaladosOtros.indirectas / m.señaladosOtros.indirectasTotal)}` : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {res.centroRecuperado && <p className="mt-2 text-sm">Fuente central identificada (por dirección temporal): <strong>{res.centroRecuperado.aciertos}/{res.centroRecuperado.total}</strong> réplicas.</p>}
            <p className="mt-2 text-xs text-gray-500">Falsos positivos en rojo: el límite superior del IC supera el 7,5 % (no pasaría la validación). Positivos = dependencia directa (parejas) o recibir ayuda (estudiantes). Las parejas con causa común o dependencia indirecta se excluyen y se reportan aparte.</p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Curvas ROC (detectores de pareja)">
              {res.detectores.d1.roc.length ? <CurvasRoc curvas={(['d1', 'd2', 'd3'] as const).filter((d) => res.detectores[d].roc.length).map((d) => ({ d, nombre: `${d.toUpperCase()} ${DETECTORES[d].nombre}`, puntos: res.detectores[d].roc }))} />
                : res.detectores.d6.roc.length ? <CurvasRoc curvas={(['d4', 'd5', 'd6'] as const).map((d) => ({ d, nombre: `${d.toUpperCase()} ${DETECTORES[d].nombre}`, puntos: res.detectores[d].roc }))} />
                : <p className="text-sm text-gray-500">En un control negativo no hay positivos: no hay curva ROC. Mire los falsos positivos y el histograma de valores p.</p>}
            </Card>
            <Card title="Valores p bajo la hipótesis nula" actions={<select className="campo !w-auto !py-1 text-xs" value={detHist} onChange={(e) => setDetHist(e.target.value as Detector)}>{(Object.keys(DETECTORES) as Detector[]).map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}</select>}>
              <HistogramaNulo datos={res.detectores[detHist].histogramaNulo} color={t.color(detHist)} />
              <p className="text-xs text-gray-500">Si el detector está bien calibrado, los valores p de las unidades sin dependencia son uniformes (todas las barras ≈ 10 %). Exceso a la izquierda = falsos positivos; exceso a la derecha = prueba conservadora.</p>
            </Card>
            <Card title={`Calibración de la probabilidad posterior (D1) · ECE ${res.calibracion.d1.ece.toFixed(3)}`}>
              <Fiabilidad tabla={res.calibracion.d1.tabla} />
              <p className="text-xs text-gray-500">Cada punto agrupa parejas con probabilidad parecida: sobre la diagonal = bien calibrada; debajo = exagera; encima = conservadora.</p>
            </Card>
            {ej && (
              <Card title="Réplica 1: evidencia de respuestas idénticas por pareja (D1)">
                <MatrizParejas n={ej.examen.estudiantes.length} etiquetas={ej.examen.estudiantes.map((e) => e.id)} marcadas={new Set([...ej.verdad.parejas, ...ej.verdad.causaComun])}
                  valor={(i, j) => { const par = ej.analisis.parejas.find((x) => x.i === i && x.j === j); return par?.d1 ? -Math.log10(Math.max(1e-12, par.d1.p)) : null; }} />
                <p className="text-xs text-gray-500">Más intenso = coincidencias más improbables bajo independencia. Recuadro = dependencia real inyectada (o causa común) en esta réplica.
                  {[...ej.verdad.parejas].slice(0, 6).map((k) => { const [i, j] = k.split('-').map(Number); const par = ej.analisis.parejas.find((x) => clavePareja(x.i, x.j) === k); return ` ${ej.examen.estudiantes[i].id}–${ej.examen.estudiantes[j].id}: p=${par?.d1?.p.toExponential(1) ?? '—'}`; }).join(';')}</p>
              </Card>
            )}
          </div>
        </>
      )}

      {barrido && (
        <Card title={`Análisis de sensibilidad: ${barrido.param}`}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div><h3 className="text-sm font-medium">Potencia</h3><LineasBarrido filas={barrido.filas} detectores={['d1', 'd2', 'd3', 'd6']} campo="potencia" nombres={Object.fromEntries(Object.entries(DETECTORES).map(([k, v]) => [k, `${k.toUpperCase()} ${v.nombre}`]))} etiquetaX={barrido.param} /></div>
            <div><h3 className="text-sm font-medium">Falsos positivos (línea: α = 5 %)</h3><LineasBarrido filas={barrido.filas} detectores={['d1', 'd2', 'd3', 'd6']} campo="fpr" nombres={Object.fromEntries(Object.entries(DETECTORES).map(([k, v]) => [k, `${k.toUpperCase()} ${v.nombre}`]))} etiquetaX={barrido.param} /></div>
          </div>
        </Card>
      )}

      {historial.length > 1 && (
        <Card title="Comparar experimentos de esta sesión">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b text-left dark:border-white/10"><th className="py-1">Experimento</th>{(['d1', 'd2', 'd3', 'd6'] as const).map((d) => <th key={d} className="text-right">{d.toUpperCase()} FP / pot.</th>)}</tr></thead>
              <tbody>{historial.map((h, k) => (
                <tr key={k} className="border-b border-gray-100 dark:border-white/5"><td className="py-1">{h.etiqueta}</td>
                  {(['d1', 'd2', 'd3', 'd6'] as const).map((d) => <td key={d} className="text-right tabular-nums">{pct(h.r.detectores[d].fpr)} / {pct(h.r.detectores[d].potencia)}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-gray-500"><Badge>Laboratorio</Badge> Los escenarios positivos miden si un detector recupera una señal conocida; los negativos y adversariales, cuándo se equivoca. Ningún resultado del laboratorio se aplica a estudiantes reales.</p>
    </div>
  );
}
