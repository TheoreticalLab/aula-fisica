/**
 * LIEIA · grafo de relaciones entre preguntas.
 * Aristas TEÓRICAS (a_priori, del contenido y del banco) separadas de las EMPÍRICAS (correlación observada, exploratoria).
 * La similitud textual NO implica redundancia psicométrica: para afirmar redundancia hacen falta datos (correlación alta,
 * dificultad parecida y ninguna información propia), y se dice explícitamente qué falta.
 */
import type { AnalisisContenido } from './contenido';
import type { ExamenEmpirico, ItemEmpirico } from './psicometria';
import type { Confianza, Pregunta, Procedencia, TipoRelacion } from './modelo';

export interface Arista { a: string; b: string; tipo: TipoRelacion; procedencia: Procedencia; confianza: Confianza; explicacion: string; peso: number }

const VACIAS = new Set('de la el los las un una y o en con por para del al que se su sus es son a como si su cual cuales cuanto cuantos esta este'.split(' '));
const fichas = (t: string) => new Set(t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !VACIAS.has(w) && !/^\d+$/.test(w)));
export const jaccard = <T>(x: Set<T>, y: Set<T>) => { if (!x.size || !y.size) return 0; let c = 0; for (const v of x) if (y.has(v)) c++; return c / (x.size + y.size - c); };

export function relacionesTeoricas(ps: Pregunta[], an: AnalisisContenido[]): Arista[] {
  const out: Arista[] = [];
  const A = new Map(an.map((x) => [x.id, x]));
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const p = ps[i], q = ps[j], ap = A.get(p.id)!, aq = A.get(q.id)!;
    const mp = p.meta, mq = q.meta;
    if (mp?.problema && mq?.problema && mp.problema.id === mq.problema.id) {
      out.push({ a: p.id, b: q.id, tipo: 'mismo_metodo', procedencia: 'a_priori', confianza: 'alta', peso: 1,
        explicacion: `etapas ${mp.problema.etapa} y ${mq.problema.etapa} del mismo problema: dependencia local esperada (no son independientes)` });
    } else if (mp?.familia && mp.familia === mq?.familia && mp.tipo === mq?.tipo) {
      out.push({ a: p.id, b: q.id, tipo: 'isomorfismo', procedencia: 'a_priori', confianza: 'media', peso: 0.9,
        explicacion: `misma familia de problemas (${mp.familia}) y mismo tipo: candidatas a isomorfas; la equivalencia de dificultad no está verificada` });
    }
    const prereq = (x: AnalisisContenido, y: AnalisisContenido) => x.prerrequisitos.some((c) => y.conceptos.includes(c));
    if (prereq(aq, ap)) out.push({ a: p.id, b: q.id, tipo: 'prerrequisito', procedencia: 'a_priori', confianza: 'alta', peso: 0.8, explicacion: 'un concepto de la primera figura como previo de la segunda (dependencia TEÓRICA, no comprobada)' });
    else if (prereq(ap, aq)) out.push({ a: q.id, b: p.id, tipo: 'prerrequisito', procedencia: 'a_priori', confianza: 'alta', peso: 0.8, explicacion: 'un concepto de la segunda figura como previo de la primera (dependencia TEÓRICA, no comprobada)' });
    const jc = jaccard(new Set(ap.conceptos), new Set(aq.conceptos));
    if (jc >= 0.5) out.push({ a: p.id, b: q.id, tipo: 'conceptual', procedencia: 'a_priori', confianza: 'media', peso: jc, explicacion: `comparten conceptos (Jaccard ${jc.toFixed(2)}): podrían medir habilidades relacionadas` });
    const jt = jaccard(fichas(p.prompt), fichas(q.prompt));
    if (jt >= 0.55) out.push({ a: p.id, b: q.id, tipo: 'textual', procedencia: 'a_priori', confianza: 'baja', peso: jt, explicacion: `enunciados muy parecidos (Jaccard ${jt.toFixed(2)}); NO demuestra que midan lo mismo` });
  }
  return out;
}

export function relacionesEmpiricas(ex: ExamenEmpirico, umbralQ = 0.1): Arista[] {
  if (!ex.pares.ok) return [];
  return ex.pares.valor.filter((p) => p.q <= umbralQ).map((p) => ({
    a: p.a, b: p.b, tipo: 'correlacion' as const, procedencia: 'empirica' as const, confianza: (p.q <= 0.01 ? 'media' : 'baja') as Confianza, peso: Math.abs(p.phi),
    explicacion: `phi = ${p.phi.toFixed(2)} con n = ${p.n} (q = ${p.q.toFixed(3)} tras corregir por comparaciones múltiples). Asociación exploratoria: no implica causa ni que midan lo mismo`,
  }));
}

/** Evaluación de redundancia: qué hay y qué falta para afirmarla. */
export function redundancia(a: string, b: string, aristas: Arista[], its: Map<string, ItemEmpirico>): { veredicto: 'posible' | 'sin_evidencia' | 'no'; razones: string[]; falta: string[] } {
  const teor = aristas.filter((x) => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.procedencia === 'a_priori');
  const emp = aristas.find((x) => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.tipo === 'correlacion');
  const ia = its.get(a), ib = its.get(b);
  const razones: string[] = teor.map((x) => x.explicacion), falta: string[] = [];
  if (!emp) falta.push('una correlación empírica alta entre ambas (no la hay o falta muestra)');
  else razones.push(emp.explicacion);
  if (!ia?.p.ok || !ib?.p.ok) falta.push('dificultad observada de ambas con muestra suficiente');
  else if (Math.abs(ia.p.valor.p - ib.p.valor.p) > 0.15) return { veredicto: 'no', razones: [...razones, 'sus dificultades observadas difieren más de 15 puntos'], falta };
  return { veredicto: emp && !falta.length && emp.peso >= 0.6 ? 'posible' : 'sin_evidencia', razones, falta };
}
