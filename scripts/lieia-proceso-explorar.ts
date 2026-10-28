/** Exploración rápida del laboratorio de telemetría del proceso (desarrollo). */
import { experimentoProceso } from '../src/lib/lieia/laboratorioProceso';
import { ESCENARIOS_PROCESO, PARAM_PROCESO, type EscenarioProceso } from '../src/lib/lieia/simuladorProceso';

const R = Number(process.argv[2] ?? 6);
const pct = (x: number | null) => (x === null ? '—' : `${(100 * x).toFixed(1)}%`);
for (const e of Object.keys(ESCENARIOS_PROCESO) as EscenarioProceso[]) {
  const r = experimentoProceso({ ...PARAM_PROCESO, escenario: e }, R, 11);
  console.log(`${e.padEnd(28)} P1 fp ${pct(r.p1.fpr)} pot ${pct(r.p1.potencia)} | P2 fp ${pct(r.p2.fpr)} pot ${pct(r.p2.potencia)} | P3 pos ${pct(r.p3.conPegadosPositivos)} neg ${pct(r.p3.conPegadosNegativos)} | recon med ${r.reconstruccion.errorMedianoS.toFixed(2)}s p90 ${r.reconstruccion.error90S.toFixed(2)}s rec ${pct(r.reconstruccion.recuperadas)} pérd ${pct(r.reconstruccion.perdidaObservada)} | ${r.segundos.toFixed(1)}s`);
}
