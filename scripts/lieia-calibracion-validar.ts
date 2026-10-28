/**
 * LIEIA · Validación de la calibración 2PL (recuperación de parámetros conocidos y cobertura de los intervalos).
 * Escribe src/lib/lieia/calibracion.json y docs/LIEIA_CALIBRACION.md.
 * Uso: ./node_modules/.bin/vite-node scripts/lieia-calibracion-validar.ts [réplicas=30]
 */
import { writeFileSync } from 'node:fs';
import { crearAzar, derivarSemilla } from '../src/lib/lieia/azar';
import { calibrar2PL, type DatosCalibracion } from '../src/lib/lieia/diseno';
import { logistica, pearson } from '../src/lib/lieia/estadistica';

const R = Number(process.argv[2] ?? 30);
const SEM = 7070;
const ITEMS = 20;
const resultados: { n: number; rmseB: number; rmseA: number; corrB: number; coberturaB: number; coberturaA: number; coberturaB_cal: number; nCal: number; estados: Record<string, number> }[] = [];
for (const n of [40, 100, 300]) {
  let seB = 0, seA = 0, cB = 0, cA = 0, tot = 0, corr = 0, cBcal = 0, nCal = 0;
  const estados: Record<string, number> = { calibrado: 0, provisional: 0, no_calibrado: 0 };
  for (let rep = 0; rep < R; rep++) {
    const az = crearAzar(derivarSemilla(SEM, n, rep));
    const a = Array.from({ length: ITEMS }, () => 0.6 + az.u() * 1.4), b = Array.from({ length: ITEMS }, () => az.normal(0, 1));
    const theta = Array.from({ length: n }, () => az.normal());
    const d: DatosCalibracion = { estudiantes: n, items: ITEMS, respuestas: [], duraciones: [] };
    for (let s = 0; s < n; s++) for (let e = 0; e < ITEMS; e++) {
      d.respuestas.push({ s, e, x: az.u() < logistica(a[e] * (theta[s] - b[e])) });
      d.duraciones.push({ s, e, d: Math.exp(4 + 0.2 * b[e] + az.normal(0, 0.35)) });
    }
    const c = calibrar2PL(d);
    corr += pearson(c.items.map((x) => x.b), b) / R;
    c.items.forEach((x, e) => {
      seB += (x.b - b[e]) ** 2; seA += (x.a - a[e]) ** 2; tot++;
      if (Math.abs(x.b - b[e]) <= 1.96 * x.se_b) cB++;
      if (Math.abs(x.a - a[e]) <= 1.96 * x.se_a) cA++;
      estados[x.estado]++;
      if (x.estado === 'calibrado') { nCal++; if (Math.abs(x.b - b[e]) <= 1.96 * x.se_b) cBcal++; }
    });
  }
  resultados.push({ n, rmseB: Math.sqrt(seB / tot), rmseA: Math.sqrt(seA / tot), corrB: corr, coberturaB: cB / tot, coberturaA: cA / tot, coberturaB_cal: nCal ? cBcal / nCal : NaN, nCal, estados });
  console.log(n, resultados.at(-1));
}
writeFileSync('src/lib/lieia/calibracion.json', JSON.stringify({ generado: new Date().toISOString(), semilla: SEM, replicas: R, items: ITEMS, resultados }));
const p = (x: number) => (Number.isNaN(x) ? '—' : `${(100 * x).toFixed(1)} %`);
writeFileSync('docs/LIEIA_CALIBRACION.md', [
  '# LIEIA · Validación de la calibración 2PL', '',
  `Generado ${new Date().toISOString()} · semilla ${SEM} · ${R} réplicas × ${ITEMS} ítems por tamaño de muestra. Parámetros verdaderos: a ~ U(0,6; 2,0), b ~ N(0, 1), θ ~ N(0, 1).`,
  'Reproducir: `./node_modules/.bin/vite-node scripts/lieia-calibracion-validar.ts ' + R + '`.', '',
  '| Estudiantes | RMSE de b | RMSE de a | Correlación b̂–b | Cobertura IC 95 % de b | Cobertura IC 95 % de a | Estados (calibrado / provisional / no calibrado) | Cobertura de b entre los «calibrados» |',
  '|---|---|---|---|---|---|---|---|',
  ...resultados.map((r) => `| ${r.n} | ${r.rmseB.toFixed(3)} | ${r.rmseA.toFixed(3)} | ${r.corrB.toFixed(3)} | ${p(r.coberturaB)} | ${p(r.coberturaA)} | ${r.estados.calibrado} / ${r.estados.provisional} / ${r.estados.no_calibrado} | ${p(r.coberturaB_cal)} (${r.nCal}) |`),
  '', 'Método: máxima verosimilitud marginal (EM con cuadratura). Errores típicos por producto cruzado de gradientes por estudiante. Una cobertura cercana al 95 % indica intervalos honestos. (La primera versión, de verosimilitud conjunta, se descartó: su error crecía con la muestra y su cobertura caía al 20 %.)', '',
].join('\n'));
