/**
 * LIEIA · Validación de la telemetría del proceso (reproducible). Escribe src/lib/lieia/procesoValidacion.json y
 * docs/LIEIA_PROCESO.md. Uso: ./node_modules/.bin/vite-node scripts/lieia-proceso.ts [réplicas=20]
 */
import { writeFileSync } from 'node:fs';
import { experimentoProceso, type ResultadoLabProceso } from '../src/lib/lieia/laboratorioProceso';
import { ESCENARIOS_PROCESO, PARAM_PROCESO, type EscenarioProceso } from '../src/lib/lieia/simuladorProceso';

const R = Number(process.argv[2] ?? 20);
const SEM = 20261029;
const t0 = Date.now();
const FPR_MAX = 0.075;
const res = {} as Record<EscenarioProceso, ResultadoLabProceso>;
for (const e of Object.keys(ESCENARIOS_PROCESO) as EscenarioProceso[]) { res[e] = experimentoProceso({ ...PARAM_PROCESO, escenario: e }, R, SEM, 199); console.log(e, res[e].segundos.toFixed(1)); }
const perdidas = [0, 0.1, 0.3, 0.5];
const robustez = perdidas.map((perdida) => ({
  perdida,
  normal: experimentoProceso({ ...PARAM_PROCESO, escenario: 'normal', perdida }, Math.ceil(R / 2), SEM + 1, 99),
  diferida: experimentoProceso({ ...PARAM_PROCESO, escenario: 'rapida_diferida', perdida }, Math.ceil(R / 2), SEM + 2, 99),
  regular: experimentoProceso({ ...PARAM_PROCESO, escenario: 'ritmo_regular', perdida }, Math.ceil(R / 2), SEM + 3, 99),
}));

const OBJ: Record<'p1' | 'p2', EscenarioProceso[]> = { p1: ['rapida_diferida'], p2: ['ritmo_regular', 'pegado_ia'] };
const veredicto = (d: 'p1' | 'p2') => {
  const fpr = (Object.keys(res) as EscenarioProceso[]).filter((e) => res[e][d].nulos > 0).map((e) => ({ escenario: e, fpr: res[e][d].fpr, ic: res[e][d].fprIC, ok: res[e][d].fprIC[1] <= FPR_MAX }));
  const pot = OBJ[d].map((e) => res[e][d].potencia ?? 0);
  const estado = fpr.some((f) => !f.ok) ? 'no_validado' : Math.min(...pot) >= 0.8 ? 'validado' : Math.max(...pot) >= 0.2 ? 'validado_limitado' : 'sin_potencia';
  return { estado, fpr, potencia: OBJ[d].map((e) => ({ escenario: e, potencia: res[e][d].potencia })) };
};
const salida = {
  generado: new Date().toISOString(), semilla: SEM, replicas: R, parametros: PARAM_PROCESO, minutos: (Date.now() - t0) / 60000, fprMax: FPR_MAX,
  veredictos: { p1: veredicto('p1'), p2: veredicto('p2') }, escenarios: res,
  robustez: robustez.map((x) => ({ perdida: x.perdida, fprP1: x.normal.p1.fpr, fprP2: x.normal.p2.fpr, potP1: x.diferida.p1.potencia, potP2: x.regular.p2.potencia,
    errorVistaS: x.normal.reconstruccion.errorMedianoS, recuperadas: x.normal.reconstruccion.recuperadas, perdidaObservada: x.normal.reconstruccion.perdidaObservada })),
};
writeFileSync('src/lib/lieia/procesoValidacion.json', JSON.stringify(salida));
const p = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? '—' : `${(100 * x).toFixed(1)} %`);
const L = ['# LIEIA · Validación de la telemetría del proceso de respuesta', '',
  `Generado ${salida.generado} · semilla ${SEM} · ${R} réplicas por escenario · ${PARAM_PROCESO.estudiantes} estudiantes × ${PARAM_PROCESO.items} preguntas · ${salida.minutos.toFixed(1)} min.`,
  'Reproducir: `./node_modules/.bin/vite-node scripts/lieia-proceso.ts ' + R + '`. Se usan las MISMAS funciones que con datos reales (reconstruir → analizarProceso).', '',
  '## Veredictos', '', '| Detector | Estado | Peor tasa de falsos positivos (IC 95 %) | Potencia en su objetivo |', '|---|---|---|---|'];
for (const d of ['p1', 'p2'] as const) {
  const v = salida.veredictos[d];
  const peor = [...v.fpr].sort((a, b) => b.ic[1] - a.ic[1])[0];
  L.push(`| ${d === 'p1' ? 'P1 Respuestas rápidas con envío diferido' : 'P2 Regularidad anómala de los intervalos'} | ${v.estado} | ${p(peor.fpr)} (${p(peor.ic[0])}–${p(peor.ic[1])}) en «${ESCENARIOS_PROCESO[peor.escenario].titulo}» | ${v.potencia.map((x) => `${ESCENARIOS_PROCESO[x.escenario].titulo}: ${p(x.potencia)}`).join('; ')} |`);
}
L.push(`| P3 Respuestas que aparecen de golpe | descriptivo (no validable) | — | Las frecuencias simuladas no dicen nada de la realidad: en el simulador los honestos nunca pegan |`, '');
L.push('## Por escenario (tasa de señalados a α = 0,05)', '', '| Escenario | Tipo | P1 FP / potencia | P2 FP / potencia | Con muchos «pegados» (pos / neg) | Error de reconstrucción (mediana · p90) | Primeras vistas recuperadas |', '|---|---|---|---|---|---|---|');
for (const e of Object.keys(res) as EscenarioProceso[]) {
  const r = res[e];
  L.push(`| ${ESCENARIOS_PROCESO[e].titulo} | ${ESCENARIOS_PROCESO[e].tipo} | ${p(r.p1.fpr)} / ${p(r.p1.potencia)} | ${p(r.p2.fpr)} / ${p(r.p2.potencia)} | ${p(r.p3.conPegadosPositivos)} / ${p(r.p3.conPegadosNegativos)} | ${r.reconstruccion.errorMedianoS.toFixed(2)} s · ${r.reconstruccion.error90S.toFixed(2)} s | ${p(r.reconstruccion.recuperadas)} |`);
}
L.push('', '## Robustez ante pérdida de eventos', '', '| Pérdida | FP P1 | FP P2 | Potencia P1 (envío diferido) | Potencia P2 (ritmo regular) | Pérdida observada | Primeras vistas recuperadas | Error de reconstrucción |', '|---|---|---|---|---|---|---|---|');
for (const x of salida.robustez) L.push(`| ${p(x.perdida)} | ${p(x.fprP1)} | ${p(x.fprP2)} | ${p(x.potP1)} | ${p(x.potP2)} | ${p(x.perdidaObservada)} | ${p(x.recuperadas)} | ${x.errorVistaS.toFixed(2)} s |`);
L.push('', '## Límites', '',
  '- Los comportamientos «legítimos» del laboratorio los define el simulador: que un detector controle los falsos positivos aquí no garantiza que lo haga con los hábitos reales de una sección. Por eso los resultados reales se presentan con incertidumbre, sin sanciones y con explicaciones alternativas.',
  '- Quien simula actividad durante la espera (adversarial) o teclea a mano una respuesta externa reduce o anula la señal.',
  '- Los eventos del navegador pueden perderse, retrasarse o manipularse: la reconstrucción cuantifica la pérdida observable (huecos de secuencia), no la manipulación.');
writeFileSync('docs/LIEIA_PROCESO.md', L.join('\n') + '\n');
console.log('Listo', salida.minutos.toFixed(1), 'min', salida.veredictos.p1.estado, salida.veredictos.p2.estado);
