/**
 * LIEIA · Evaluación FINAL del D6 v2 por simulación (semillas de evaluación, protocolo congelado).
 *
 *   ./node_modules/.bin/vite-node scripts/lieia-d6-validar.ts
 *
 * Se niega a ejecutarse si el protocolo, los escenarios o los diseños cambiaron respecto de las huellas congeladas
 * (HUELLAS_CONGELADAS en src/lib/lieia/d6Validacion.ts): un cambio exige versión nueva y una evaluación nueva.
 * Escribe:
 *   - src/lib/lieia/d6Validacion.json   (resumen para la interfaz)
 *   - docs/LIEIA_D6_VALIDACION.md        (informe legible)
 */
import { writeFileSync } from 'node:fs';
import { PROTOCOLO_D6 } from '../src/lib/lieia/d6';
import {
  analisisDiseno, ejecutarValidacion, ESCENARIOS_D6, huellasActuales, HUELLAS_CONGELADAS, resumir, semillasEvaluacion, type Distribucion, type FilaResumen,
} from '../src/lib/lieia/d6Validacion';
import { ESTADO_D6A } from '../src/lib/lieia/d6';

const h = huellasActuales();
if (JSON.stringify(h) !== JSON.stringify(HUELLAS_CONGELADAS)) {
  console.error('✖ El protocolo o los escenarios cambiaron respecto de lo congelado:', h, 'frente a', HUELLAS_CONGELADAS);
  process.exit(1);
}
const inicio = new Date();
const semillas = semillasEvaluacion();
console.log(`Evaluación final D6 ${PROTOCOLO_D6.version} · ${semillas.length} semillas (${semillas[0]}–${semillas[semillas.length - 1]}) · huellas ${Object.values(h).join('/')}`);
const { porSemilla, referencias } = ejecutarValidacion({
  semillas, ...PROTOCOLO_D6.evaluacion,
  alAvanzar: (k, n) => { if (k % 10 === 0 || k === n) console.log(`  ${k}/${n} semillas · ${((Date.now() - inicio.getTime()) / 60000).toFixed(1)} min`); },
});
const filas = resumir(porSemilla);
const disenos = analisisDiseno(referencias);
const q = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.round(f * (s.length - 1))]; };
const refs = (k: 'pendiente_mu_D' | 'tau_beta' | 'tau_alpha' | 'se_max') => ({ mediana: q(referencias.map((r) => r[k]), 0.5), p5: q(referencias.map((r) => r[k]), 0.05), p95: q(referencias.map((r) => r[k]), 0.95) });
const minutos = (Date.now() - inicio.getTime()) / 60000;
const salida = {
  generado: inicio.toISOString(), minutos, version: PROTOCOLO_D6.version, huellas: h, semillas: { desde: semillas[0], cantidad: semillas.length },
  evaluacion: PROTOCOLO_D6.evaluacion, referencias: { pendiente_mu_D: refs('pendiente_mu_D'), tau_beta: refs('tau_beta'), tau_alpha: refs('tau_alpha'), se_max: refs('se_max') },
  filas, disenos, aviso: 'Resultados de SIMULACIÓN con datos sintéticos: no son una validación empírica.',
};
writeFileSync('src/lib/lieia/d6Validacion.json', JSON.stringify(salida, null, 1) + '\n');

// ---- informe legible ----
const pc = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${(100 * x).toFixed(1)} %`);
const dist = (d: Distribucion) => (d.agregada === null ? '—' : `${pc(d.agregada)} [${pc(d.ic95![0])}–${pc(d.ic95![1])}]<br><small>semillas: ${pc(d.mediana)} (P5–P95 ${pc(d.p5)}–${pc(d.p95)})</small>`);
const corto = (d: Distribucion) => (d.agregada === null ? '—' : pc(d.agregada));
const L: string[] = [];
L.push(`# LIEIA · D6 v2 — Evaluación final por simulación (${PROTOCOLO_D6.version})`, '');
L.push('> **Simulación, no validación empírica.** Datos sintéticos. Ningún número de este informe describe a estudiantes reales.', '');
L.push(`Generado: ${inicio.toISOString()} · ${minutos.toFixed(1)} min · ${semillas.length} semillas de EVALUACIÓN (${semillas[0]}–${semillas[semillas.length - 1]}), distintas de las de desarrollo (${PROTOCOLO_D6.semillas_desarrollo.join(', ')}) · ${PROTOCOLO_D6.evaluacion.replicas} cohortes de ${PROTOCOLO_D6.evaluacion.tam_cohorte} estudiantes por escenario y semilla · referencia nueva por semilla (${PROTOCOLO_D6.evaluacion.tam_calibracion} estudiantes de calibración).`, '');
L.push(`Protocolo, escenarios y diseños congelados antes de ejecutar (huellas \`${h.protocolo}\` / \`${h.escenarios}\` / \`${h.disenos}\`); el script se niega a correr si cambian. Reproducir: \`./node_modules/.bin/vite-node scripts/lieia-d6-validar.ts\`.`, '');
L.push('## Cómo leer las tablas', '',
  '- **FPR (evaluados)**: señalados (p < 0,05) entre los honestos que recibieron un resultado. **FPR (todos)**: señalados entre TODOS los honestos.',
  '- **Sensibilidad (evaluados / todos)**: lo mismo entre los estudiantes con el comportamiento simulado. En los escenarios de «rápidos legítimos» esa columna es una tasa de FALSOS positivos (son honestos).',
  '- **Cobertura**: fracción que recibió un resultado. Una FPR baja con cobertura baja no es un éxito: el detector se abstuvo.',
  '- **Cohortes aplicables**: fracción de cohortes en que la referencia se declaró aplicable (si no, toda la cohorte se abstiene).',
  '- **Sin la puerta**: lo que habría pasado sin la política de abstención por aplicabilidad (para medir qué evita y qué cuesta).',
  '- Cada celda: tasa agregada [IC de Wilson 95 %] y, debajo, la mediana entre semillas con su rango P5–P95.', '');
L.push('## Referencias calibradas (variación entre semillas)', '', '| Parámetro | Mediana | P5–P95 |', '|---|---|---|');
for (const [k, v] of Object.entries(salida.referencias)) L.push(`| ${k} | ${v.mediana.toFixed(3)} | ${v.p5.toFixed(3)}–${v.p95.toFixed(3)} |`);
const grupos: Record<string, string> = { contaminacion: 'Contaminación de la cohorte', rapidez: 'Rapidez y asistencia (D6-B)', poblacion: 'Población distinta de la de calibración', cobertura: 'Cobertura de niveles (diseño del examen)', telemetria: 'Telemetría imperfecta y pausas', contexto: 'Contexto' };
for (const [g, titulo] of Object.entries(grupos)) {
  const fs = filas.filter((f) => f.grupo === g);
  if (!fs.length) continue;
  L.push('', `## ${titulo}`, '', '| Escenario | Det. | FPR (evaluados) | FPR (todos) | Cobertura honestos | Sensibilidad (evaluados) | Sensibilidad (todos) | Cohortes aplicables | Sin la puerta: FPR / sens. |', '|---|---|---|---|---|---|---|---|---|');
  for (const f of fs) L.push(`| ${f.titulo} | ${f.detector === 'A' ? 'D6-A' : 'D6-B'} | ${dist(f.fpr_evaluados)} | ${corto(f.fpr_todos)} | ${corto(f.cobertura_h)} | ${dist(f.sens_evaluados)} | ${corto(f.sens_todos)} | ${corto(f.cohortes_aplicables)} | ${corto(f.sin_puerta.fpr)} / ${corto(f.sin_puerta.sens)} |`);
  const extra = fs.filter((f) => f.interno || f.sesgo_beta);
  if (g === 'telemetria' || g === 'rapidez') {
    for (const f of extra) {
      if (f.sesgo_beta && g === 'telemetria') L.push(`- ${f.titulo}: sesgo medio de β̂ en honestos ${f.sesgo_beta.media.toFixed(3)} ± ${f.sesgo_beta.se.toFixed(3)} (n = ${f.sesgo_beta.n}).`);
      if (f.interno) L.push(`- ${f.titulo} · D6-B con normalización INTERNA (descontando la velocidad propia): sensibilidad ${corto(f.interno.sens)} frente a ${corto(f.sin_puerta.sens)} con la referencia; FPR ${corto(f.interno.fpr)}.`);
    }
  }
}
L.push('', '## Abstenciones por causa (D6-A, todas las semillas)', '', '| Escenario | ' + Object.keys(ESTADO_D6A).map((e) => ESTADO_D6A[e as keyof typeof ESTADO_D6A].titulo).join(' | ') + ' |', '|---|' + Object.keys(ESTADO_D6A).map(() => '---').join('|') + '|');
for (const f of filas.filter((x) => x.detector === 'A')) {
  const tot = Object.values(f.estados).reduce((s, v) => s + v, 0);
  L.push(`| ${f.titulo} | ` + Object.keys(ESTADO_D6A).map((e) => pc((f.estados[e] ?? 0) / tot)).join(' | ') + ' |');
}
L.push('', '## Diseño del examen frente a la calibración actual', '',
  'Proporción de las referencias calibradas (una por semilla) con las que cada diseño alcanza la precisión exigida (potencia ≥ 80 % frente a la insensibilidad completa). Es una consecuencia de la calibración (σ de los tiempos, pendiente y τ_β), no una regla universal.', '',
  '| Diseño | Preguntas | Referencias con precisión suficiente | Potencia (mediana, P5–P95) |', '|---|---|---|---|');
for (const d of disenos) L.push(`| ${d.titulo}${d.supuesto ? ' *' : ''} | ${d.n_preguntas} | ${pc(d.suficiente)} | ${pc(d.potencia.mediana)} (${pc(d.potencia.p5)}–${pc(d.potencia.p95)}) |`);
for (const d of disenos.filter((x) => x.supuesto)) L.push(`- \\* ${d.titulo}: ${d.supuesto}`);
L.push('', `Escenarios evaluados: ${ESCENARIOS_D6.length}.`, '');
writeFileSync('docs/LIEIA_D6_VALIDACION.md', L.join('\n'));
console.log(`✔ ${minutos.toFixed(1)} min · escrito src/lib/lieia/d6Validacion.json y docs/LIEIA_D6_VALIDACION.md`);
export type { FilaResumen };
