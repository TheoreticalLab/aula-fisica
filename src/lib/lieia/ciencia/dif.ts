/**
 * LIEIA · funcionamiento diferencial de las preguntas (DIF) entre dos subgrupos de la sección, por Mantel-Haenszel.
 * Se compara a estudiantes de IGUAL nivel (estratos por la puntuación en el resto del examen), de modo que una diferencia
 * no se explique solo porque un grupo rinda más en general. Clasificación del ETS: A (insignificante), B (moderado),
 * C (grande), con la delta MH = −2,35·ln(α_MH). p-valores corregidos por Benjamini-Hochberg.
 * Un DIF no implica sesgo: indica que la pregunta funciona distinto entre grupos y merece revisión de contenido.
 * Abstención: cada grupo necesita al menos 20 estudiantes; con menos, se explica.
 */
import { benjaminiHochberg, chiCuadradoCola } from '../estadistica';
import type { Matriz } from './psicometria';

export const MIN_DIF_GRUPO = 20;

export interface ItemDIF { id: string; alfaMH: number | null; delta: number | null; p: number | null; q: number | null; clase: 'A' | 'B' | 'C' | null; favorece: string | null }
export type ResultadoDIF = { ok: true; grupos: [string, string]; n: [number, number]; items: ItemDIF[]; metodo: string } | { ok: false; motivo: string };

export function difMH(m: Matriz, grupoDe: Map<string, string | null>): ResultadoDIF {
  const cuenta = new Map<string, number>();
  for (const s of m.estudiantes) { const g = grupoDe.get(s); if (g) cuenta.set(g, (cuenta.get(g) ?? 0) + 1); }
  const top = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  if (top.length < 2) return { ok: false, motivo: top.length ? `Solo hay un subgrupo con estudiantes en este examen («${top[0][0]}»).` : 'Los estudiantes no están asignados a subgrupos de la sección.' };
  const [[g1, n1], [g2, n2]] = top;
  if (n2 < MIN_DIF_GRUPO) return { ok: false, motivo: `Los dos subgrupos más numerosos tienen ${n1} y ${n2} estudiantes; el DIF necesita al menos ${MIN_DIF_GRUPO} en cada uno.` };
  const filas = m.estudiantes.map((s, i) => ({ g: grupoDe.get(s), x: m.x[i].map((c): number => (c === 1 ? 1 : 0)) })).filter((f) => f.g === g1 || f.g === g2);
  const tot = filas.map((f) => f.x.reduce((s, v) => s + v, 0));
  const items: ItemDIF[] = m.items.map((id, j) => {
    // estratos por puntuación en el resto (excluida la pregunta)
    const estratos = new Map<number, { a: number; b: number; c: number; d: number }>();
    filas.forEach((f, i) => {
      const k = tot[i] - f.x[j];
      const e = estratos.get(k) ?? { a: 0, b: 0, c: 0, d: 0 };
      if (f.g === g1) { if (f.x[j]) e.a++; else e.b++; } else { if (f.x[j]) e.c++; else e.d++; }
      estratos.set(k, e);
    });
    let num = 0, den = 0, sumA = 0, eA = 0, vA = 0;
    for (const { a, b, c, d } of estratos.values()) {
      const T = a + b + c + d;
      if (T < 2 || a + b === 0 || c + d === 0) continue;
      num += (a * d) / T; den += (b * c) / T;
      const m1 = a + c, m0 = b + d, nR = a + b, nF = c + d;
      sumA += a; eA += (nR * m1) / T; vA += (nR * nF * m1 * m0) / (T * T * (T - 1));
    }
    if (!(num > 0 && den > 0 && vA > 0)) return { id, alfaMH: null, delta: null, p: null, q: null, clase: null, favorece: null };
    const alfa = num / den, delta = -2.35 * Math.log(alfa);
    const chi = (Math.abs(sumA - eA) - 0.5) ** 2 / vA;
    return { id, alfaMH: alfa, delta, p: chiCuadradoCola(Math.max(0, chi), 1), q: null, clase: null, favorece: alfa > 1 ? g1 : g2 };
  });
  const conP = items.filter((i) => i.p !== null);
  const qs = benjaminiHochberg(conP.map((i) => i.p!));
  conP.forEach((it, k) => {
    it.q = qs[k];
    const ad = Math.abs(it.delta!);
    it.clase = ad >= 1.5 && it.q <= 0.05 ? 'C' : ad >= 1 && it.q <= 0.05 ? 'B' : 'A';
  });
  return { ok: true, grupos: [g1, g2], n: [n1, n2], items,
    metodo: 'Mantel-Haenszel estratificado por la puntuación en el resto del examen (omisión = 0); χ² MH con corrección de continuidad; q de Benjamini-Hochberg; clases A/B/C del ETS' };
}
