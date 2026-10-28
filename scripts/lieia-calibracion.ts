/** Exploración de la calibración de la probabilidad posterior (desarrollo). */
import { ejecutarExperimento } from '../src/lib/lieia/laboratorio';
import { PARAMETROS_BASE, type Escenario } from '../src/lib/lieia/simulador';

for (const e of ['parejas', 'red', 'misma_confusion'] as Escenario[]) {
  for (const implicados of [3, 8]) {
    const r = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: e, implicados }, replicas: 8, semilla: 11, alfa: 0.05, qUmbral: 0.1, analisis: { permutaciones: 99, bootstrap: 99 } });
    for (const d of ['d1', 'd2'] as const) {
      const c = r.calibracion[d];
      const t = c.tabla.filter((x) => x.n).map((x) => `[${x.desde.toFixed(1)}: n=${x.n} pred=${x.predicha.toFixed(2)} obs=${x.observada.toFixed(2)}]`).join(' ');
      console.log(`${e} k=${implicados} ${d} ece=${c.ece.toFixed(3)} brier=${c.brier.toFixed(4)} ${t}`);
    }
    if (r.centroRecuperado) console.log(`  centro ${r.centroRecuperado.aciertos}/${r.centroRecuperado.total}`);
  }
}
