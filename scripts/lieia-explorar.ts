/** Exploración rápida del laboratorio LIEIA (desarrollo): FPR y potencia por escenario. */
import { ejecutarExperimento, DETECTORES, type Detector } from '../src/lib/lieia/laboratorio';
import { PARAMETROS_BASE, ESCENARIOS, type Escenario } from '../src/lib/lieia/simulador';

const replicas = Number(process.argv[2] ?? 8);
const escenarios = (process.argv[3]?.split(',') as Escenario[]) ?? (Object.keys(ESCENARIOS) as Escenario[]);
for (const e of escenarios) {
  const r = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: e }, replicas, semilla: 7, alfa: 0.05, qUmbral: 0.1, analisis: { permutaciones: 99, bootstrap: 99 } });
  const fila = (Object.keys(DETECTORES) as Detector[]).map((d) => {
    const m = r.detectores[d];
    return `${d}:fpr=${m.fpr.toFixed(3)}${m.potencia !== null ? ` pot=${m.potencia.toFixed(2)}` : ''}${m.señaladosOtros.causaComunTotal ? ` cc=${(m.señaladosOtros.causaComun / m.señaladosOtros.causaComunTotal).toFixed(2)}` : ''}`;
  });
  console.log(`${e.padEnd(22)} ${r.segundos.toFixed(1)}s ${fila.join(' | ')} ece1=${r.calibracion.d1.ece.toFixed(3)} ece2=${r.calibracion.d2.ece.toFixed(3)}${r.centroRecuperado ? ` centro=${r.centroRecuperado.aciertos}/${r.centroRecuperado.total}` : ''}`);
}
