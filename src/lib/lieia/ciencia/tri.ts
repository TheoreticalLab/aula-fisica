/**
 * LIEIA · TRI por examen (etapa 5). Reutiliza la calibración 2PL validada (máxima verosimilitud marginal, Bock–Aitkin,
 * con a priori débiles) de diseno.ts. Reglas:
 *   · n < 50: no se ajusta (la TRI con muestras pequeñas es inestable); se explica qué falta.
 *   · 50 ≤ n < 200: ajuste «provisional», con errores típicos; los a priori pesan.
 *   · El parámetro b (escala logit, θ ~ N(0,1)) NO es la proporción de aciertos (dificultad clásica).
 *   · 3PL no se ajusta: con estas muestras el parámetro de azar no es identificable.
 * Dependencia local: Q3 de Yen (correlación de residuos tras el 2PL); se señalan pares con Q3 por encima de la media
 * de Q3 + 0,2 (criterio habitual), como indicio a revisar, no como prueba.
 */
import { calibrar2PL, curvaInformacion, type Calibracion } from '../diseno';
import { logistica } from '../estadistica';
import type { Matriz } from './psicometria';

export const MIN_TRI = 50, MIN_TRI_ESTABLE = 200;

export interface ResultadoTRI {
  ok: true; n: number; estabilidad: 'provisional' | 'estable'; metodo: string;
  items: { id: string; cal: Calibracion }[];
  curva: { theta: number; info: number; se: number; p10: number; p90: number }[];
  q3: { a: string; b: string; q3: number }[]; q3Media: number;
  avisos: string[];
}
export type TRI = ResultadoTRI | { ok: false; n: number; motivo: string };

export function ajustarTRI(m: Matriz, semilla = 1): TRI {
  // solo estudiantes y preguntas con respuestas calificadas; la omisión se trata como incorrecta (convención TCT/TRI escolar)
  const N = m.estudiantes.length, K = m.items.length;
  if (N < MIN_TRI) return { ok: false, n: N, motivo: `n = ${N}; la TRI necesita al menos ${MIN_TRI} estudiantes para un ajuste mínimamente estable (2PL).` };
  if (K < 4) return { ok: false, n: N, motivo: 'se necesitan al menos 4 preguntas' };
  const respuestas: { s: number; e: number; x: boolean }[] = [];
  m.x.forEach((f, s) => f.forEach((c, e) => { if (c !== 'sin_calificar') respuestas.push({ s, e, x: c === 1 }); }));
  const sinVar = m.items.filter((_, e) => { const v = respuestas.filter((r) => r.e === e); return v.every((r) => r.x) || v.every((r) => !r.x); });
  const r = calibrar2PL({ estudiantes: N, items: K, respuestas, duraciones: [] });
  const avisos: string[] = [];
  if (sinVar.length) avisos.push(`${sinVar.length} pregunta(s) sin variación (todos aciertan o todos fallan): sus parámetros los determina el a priori.`);
  if (N < MIN_TRI_ESTABLE) avisos.push(`Con n = ${N} el ajuste es provisional: revise los errores típicos antes de usar los parámetros.`);
  if (K < 10) avisos.push(`Con ${K} preguntas, Q3 detecta mal la dependencia local: un par dependiente puede «arrastrar» la habilidad estimada y ocultar su residuo. La ausencia de señales no demuestra independencia.`);
  // Q3 de Yen: correlación de residuos x − P(θ̂)
  const res = m.x.map((f, s) => f.map((c, e) => (c === 'sin_calificar' ? null : (c === 1 ? 1 : 0) - logistica(r.items[e].a * (r.theta[s] - r.items[e].b)))));
  const q3: { a: string; b: string; q3: number }[] = [];
  for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) {
    const xs: number[] = [], ys: number[] = [];
    res.forEach((f) => { if (f[a] !== null && f[b] !== null) { xs.push(f[a]!); ys.push(f[b]!); } });
    if (xs.length < MIN_TRI) continue;
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
    let sxy = 0, sxx = 0, syy = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
    if (sxx > 0 && syy > 0) q3.push({ a: m.items[a], b: m.items[b], q3: sxy / Math.sqrt(sxx * syy) });
  }
  const q3Media = q3.length ? q3.reduce((s, x) => s + x.q3, 0) / q3.length : 0;
  return {
    ok: true, n: N, estabilidad: N >= MIN_TRI_ESTABLE ? 'estable' : 'provisional',
    metodo: '2PL por máxima verosimilitud marginal (EM, cuadratura de 31 nodos, θ ~ N(0,1), a priori b ~ N(0, 2²), log a ~ N(0, 0,5²)); errores típicos por producto cruzado de gradientes; omisión = incorrecta',
    items: m.items.map((id, j) => ({ id, cal: r.items[j] })), curva: curvaInformacion(r.items, 200, semilla),
    q3: q3.filter((x) => x.q3 > q3Media + 0.2).sort((x, y) => y.q3 - x.q3), q3Media, avisos,
  };
}
