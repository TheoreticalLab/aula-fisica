/**
 * LIEIA · Batería de validación (reproducible). Ejecuta todos los escenarios con verdad conocida, análisis de
 * sensibilidad y la calibración de las posteriores; aplica los criterios de src/lib/lieia/validacion.ts y escribe:
 *   - src/lib/lieia/validacion.json  (lo usa el panel para habilitar o no cada detector sobre datos reales)
 *   - docs/LIEIA_VALIDACION.md       (informe legible)
 * Uso: ./node_modules/.bin/vite-node scripts/lieia-validar.ts [réplicas=30]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { barrido, DETECTORES, ejecutarExperimento, type Detector, type ResultadoExperimento } from '../src/lib/lieia/laboratorio';
import { ESCENARIOS, PARAMETROS_BASE, type Escenario } from '../src/lib/lieia/simulador';
import { ESTADO_TEXTO, FPR_MAX, NEGATIVOS, veredicto, veredictoPosterior } from '../src/lib/lieia/validacion';

const REPLICAS = Number(process.argv[2] ?? 30);
const SEMILLA = 20261027;
const ANALISIS = { permutaciones: 199, bootstrap: 199 };
const t0 = Date.now();
const base = { replicas: REPLICAS, semilla: SEMILLA, alfa: 0.05, qUmbral: 0.1, analisis: ANALISIS };

const res: Partial<Record<Escenario, ResultadoExperimento>> = {};
for (const e of Object.keys(ESCENARIOS) as Escenario[]) {
  res[e] = ejecutarExperimento({ ...base, parametros: { ...PARAMETROS_BASE, escenario: e } });
  console.log(`${e}: ${res[e]!.segundos.toFixed(1)} s`);
}

// sensibilidad (menos réplicas por punto)
const rs = Math.max(6, Math.round(REPLICAS / 3));
const sens = {
  intensidad: barrido({ ...base, replicas: rs, parametros: { ...PARAMETROS_BASE, escenario: 'parejas' } }, 'intensidad', [0.2, 0.35, 0.5, 0.7, 0.9]),
  retardoMediano: barrido({ ...base, replicas: rs, parametros: { ...PARAMETROS_BASE, escenario: 'parejas' } }, 'retardoMediano', [10, 30, 90, 240, 600]),
  itemsPotencia: barrido({ ...base, replicas: rs, parametros: { ...PARAMETROS_BASE, escenario: 'parejas' } }, 'items', [10, 16, 24, 40]),
  estudiantesFpr: barrido({ ...base, replicas: rs, parametros: { ...PARAMETROS_BASE, escenario: 'independiente' } }, 'estudiantes', [12, 20, 36, 60]),
  iaIntensidad: barrido({ ...base, replicas: rs, parametros: { ...PARAMETROS_BASE, escenario: 'asistencia_ia' } }, 'intensidad', [0.5, 0.7, 0.9]),
};
console.log('sensibilidad lista');

const veredictos = Object.fromEntries((Object.keys(DETECTORES) as Detector[]).map((d) => [d, veredicto(d, res)])) as Record<Detector, ReturnType<typeof veredicto>>;
const todos = Object.values(res) as ResultadoExperimento[];
const posterior = {
  d1: veredictoPosterior('d1', todos, { altas: todos.reduce((s, r) => s + r.calibracion.d1.altas, 0), total: todos.reduce((s, r) => s + r.calibracion.d1.dependientes, 0) }),
  d2: veredictoPosterior('d2', todos, { altas: todos.reduce((s, r) => s + r.calibracion.d2.altas, 0), total: todos.reduce((s, r) => s + r.calibracion.d2.dependientes, 0) }),
};

const resumen = (r: ResultadoExperimento) => ({
  segundos: r.segundos,
  centroRecuperado: r.centroRecuperado,
  calibracion: { d1: { ece: r.calibracion.d1.ece, tabla: r.calibracion.d1.tabla }, d2: { ece: r.calibracion.d2.ece, tabla: r.calibracion.d2.tabla } },
  detectores: Object.fromEntries(Object.entries(r.detectores).map(([d, m]) => [d, { ...m, roc: m.roc.filter((_, k) => k % 2 === 0) }])),
});
const sensRes = Object.fromEntries(Object.entries(sens).map(([k, v]) => [k, v.map((x) => ({ valor: x.valor, detectores: Object.fromEntries(Object.entries(x.detectores).map(([d, m]) => [d, { fpr: m.fpr, potencia: m.potencia }])) }))]));

const salida = {
  generado: new Date().toISOString(), semilla: SEMILLA, replicas: REPLICAS, analisis: ANALISIS, parametrosBase: PARAMETROS_BASE, fprMax: FPR_MAX,
  minutos: (Date.now() - t0) / 60000,
  veredictos, posterior, escenarios: Object.fromEntries(Object.entries(res).map(([e, r]) => [e, resumen(r!)])), sensibilidad: sensRes,
};
writeFileSync('src/lib/lieia/validacion.json', JSON.stringify(salida));

// --- informe legible ---
const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${(100 * x).toFixed(1)} %`);
const lineas: string[] = [];
lineas.push('# LIEIA · Informe de validación', '');
lineas.push(`Generado: ${salida.generado} · semilla ${SEMILLA} · ${REPLICAS} réplicas por escenario · ${PARAMETROS_BASE.estudiantes} estudiantes × ${PARAMETROS_BASE.items} ítems · ${ANALISIS.permutaciones} permutaciones / ${ANALISIS.bootstrap} remuestreos · duración ${salida.minutos.toFixed(1)} min.`, '');
lineas.push('Reproducir: `./node_modules/.bin/vite-node scripts/lieia-validar.ts ' + REPLICAS + '` (mismos resultados con la misma semilla).', '');
lineas.push('## Veredicto por detector', '', '| Detector | Estado | Peor tasa de falsos positivos (IC 95 %) | Potencia en su escenario objetivo |', '|---|---|---|---|');
for (const d of Object.keys(DETECTORES) as Detector[]) {
  const v = veredictos[d];
  const peor = [...v.fpr].sort((a, b) => b.ic[1] - a.ic[1])[0];
  lineas.push(`| ${d.toUpperCase()} ${DETECTORES[d].nombre} | ${ESTADO_TEXTO[v.estado]} | ${peor ? `${pct(peor.fpr)} (${pct(peor.ic[0])}–${pct(peor.ic[1])}) en «${ESCENARIOS[peor.escenario].titulo}»` : '—'} | ${v.potencia.map((p) => `${ESCENARIOS[p.escenario].titulo}: ${pct(p.potencia)}`).join('; ')} |`);
}
lineas.push('', `Criterio: límite superior del IC ≤ ${pct(FPR_MAX)} en cada control negativo (${NEGATIVOS.map((e) => ESCENARIOS[e].titulo).join(', ')}) y entre las unidades no implicadas de los escenarios positivos y adversariales.`, '');
for (const d of Object.keys(DETECTORES) as Detector[]) for (const l of veredictos[d].limitaciones) lineas.push(`- **${d.toUpperCase()}**: ${l}`);
lineas.push('', '## Probabilidad posterior de dependencia', '');
for (const d of ['d1', 'd2'] as const) {
  const p = posterior[d];
  lineas.push(`- **${d.toUpperCase()}**: ECE ${p.ece.toFixed(3)} · ${p.sobreconfianza.length ? `sobreconfianza en ${p.sobreconfianza.length} tramo(s)` : 'sin sobreconfianza'} · ${pct(p.fraccionAlta)} de las parejas dependientes reciben ≥ 0,5 → ${p.calibrada && p.informativa ? '**se muestra**' : p.calibrada ? '**no informativa: abstención**' : '**no calibrada: abstención**'}.`);
}
lineas.push('', '## Resultados por escenario (tasa de alertas a α = 0,05)', '', `| Escenario | Tipo | ${(Object.keys(DETECTORES) as Detector[]).map((d) => d.toUpperCase()).join(' | ')} |`, `|---|---|${(Object.keys(DETECTORES) as Detector[]).map(() => '---').join('|')}|`);
for (const e of Object.keys(ESCENARIOS) as Escenario[]) {
  const r = res[e]!;
  lineas.push(`| ${ESCENARIOS[e].titulo} | ${ESCENARIOS[e].tipo} | ${(Object.keys(DETECTORES) as Detector[]).map((d) => { const m = r.detectores[d]; return `FP ${pct(m.fpr)}${m.potencia !== null ? ` · pot ${pct(m.potencia)}` : ''}`; }).join(' | ')} |`);
}
if (res.red?.centroRecuperado) lineas.push('', `Fuente central identificada (red con ${PARAMETROS_BASE.implicados} receptores): ${res.red.centroRecuperado.aciertos}/${res.red.centroRecuperado.total} réplicas.`);
lineas.push('', '## Sensibilidad', '');
const tabla = (titulo: string, xs: typeof sensRes[string], ds: Detector[], campo: 'potencia' | 'fpr') => {
  lineas.push(`**${titulo}** (${campo === 'potencia' ? 'potencia' : 'falsos positivos'})`, '', `| valor | ${ds.map((d) => d.toUpperCase()).join(' | ')} |`, `|---|${ds.map(() => '---').join('|')}|`);
  for (const x of xs) lineas.push(`| ${x.valor} | ${ds.map((d) => pct((x.detectores as Record<string, { fpr: number; potencia: number | null }>)[d][campo])).join(' | ')} |`);
  lineas.push('');
};
tabla('Probabilidad de copiar cada ítem (copia en parejas)', sensRes.intensidad, ['d1', 'd2', 'd3'], 'potencia');
tabla('Retardo mediano de la copia, en segundos', sensRes.retardoMediano, ['d1', 'd2', 'd3'], 'potencia');
tabla('Número de ítems (copia en parejas)', sensRes.itemsPotencia, ['d1', 'd2', 'd3'], 'potencia');
tabla('Número de estudiantes (independencia)', sensRes.estudiantesFpr, ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], 'fpr');
tabla('Intensidad de la asistencia externa', sensRes.iaIntensidad, ['d4', 'd5', 'd6'], 'potencia');
lineas.push('## Qué NO puede inferirse', '',
  '- Ningún detector prueba fraude ni identifica la causa: un valor p pequeño indica que los datos son improbables bajo independencia, no quién hizo qué.',
  '- D1 no distingue copia de causa común (misma confusión, mismo material de estudio).',
  '- La copia con retardo de varios minutos borra la huella temporal (D2, D3).',
  '- La asistencia que imita los tiempos de un estudiante real no se distingue con telemetría (adversarial «IA que imita los tiempos»).',
  '- Los resultados dependen de que el modelo generador del laboratorio represente razonablemente la realidad; por eso el panel muestra incertidumbre y abstención.');
mkdirSync('docs', { recursive: true });
writeFileSync('docs/LIEIA_VALIDACION.md', lineas.join('\n') + '\n');
console.log(`Listo en ${salida.minutos.toFixed(1)} min`);
for (const d of Object.keys(DETECTORES) as Detector[]) console.log(d, veredictos[d].estado);
console.log('posterior d1', posterior.d1.calibrada, posterior.d1.informativa, 'd2', posterior.d2.calibrada, posterior.d2.informativa);
