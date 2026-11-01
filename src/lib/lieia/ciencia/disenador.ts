/**
 * LIEIA · diseñador de exámenes por OBJETIVO (capa A, determinista y reproducible por semilla).
 * Selecciona preguntas EXISTENTES del banco de la asignatura (estrategia 1, reutilización). La generación asistida de
 * preguntas nuevas (estrategia 2) no está implementada: cuando faltan preguntas, el diseño lo dice.
 * Cada elección lleva su razón; el resultado es un BORRADOR editable que nunca se publica solo.
 * Criterio de optimización explícito por modo (ningún diseño es «mejor» sin decir respecto a qué).
 */
import { mulberry32 } from '@/lib/fisica/variantes';
import { informacionEsperada, informacionItem, aPriori, THETAS, type Calibracion } from '../diseno';
import { logistica } from '../estadistica';
import { COGNITIVAS, MINIMOS, type Cognitiva, type Pregunta } from './modelo';
import type { AnalisisContenido } from './contenido';
import { jaccard } from './relaciones';

/** cal: calibración TRI guardada (item_calibrations), si existe; es empírica y versionada (migración 49). */
export interface ItemBancoCiencia { pregunta: Pregunta; analisis: AnalisisContenido; historico: { p: number; n: number; discriminacion: number | null } | null; cal?: Calibracion | null }
const calibrada = (b: ItemBancoCiencia) => !!b.cal && b.cal.estado !== 'no_calibrado';
export const MIN_ADAPTATIVO = 15;

export const MODOS = {
  A: { nombre: 'Equilibrado', criterio: 'cobertura de conceptos, mezcla de dificultad (≈30/50/20) y de habilidades, sin redundancia, dentro del tiempo', implementado: true },
  B: { nombre: 'Diagnóstico', criterio: 'una pregunta corta por concepto, priorizando preguntas de un solo paso que aíslan cada conocimiento', implementado: true },
  C: { nombre: 'Conceptual', criterio: 'comprensión física por encima del cálculo (habilidades conceptuales, supuestos, predicción)', implementado: true },
  D: { nombre: 'Razonamiento profundo', criterio: 'problemas multietapa, de transferencia o que exigen justificar o identificar supuestos', implementado: true },
  E: { nombre: 'Discriminación de niveles', criterio: 'mayor discriminación observada (o, sin datos, dificultades repartidas en todo el rango, rotulado «a priori»)', implementado: true },
  F: { nombre: 'Transferencia', criterio: 'preguntas de transferencia o de unidades previas que NO estaban en el examen base', implementado: true },
  G: { nombre: 'Isomorfo (dos versiones)', criterio: 'pares de la misma familia y tipo repartidos en versiones A y B', implementado: true },
  H: { nombre: 'Investigación correlacional', criterio: 'al menos 3 preguntas por cada una de las dos habilidades a relacionar', implementado: true },
  I: { nombre: 'Errores conceptuales', criterio: 'preguntas de detección de errores y afirmaciones incorrectas, más las de errores frecuentes observados', implementado: true },
  J: { nombre: 'Retención', criterio: 'mismos conceptos que el examen base con preguntas distintas (para aplicar tras un intervalo)', implementado: true },
  L: { nombre: 'Calibración', criterio: 'preguntas con menos respuestas históricas (n bajo), para mejorar su estimación', implementado: true },
  Q: { nombre: 'Optimizado por restricciones', criterio: 'cumplir duración, número de preguntas y conceptos obligatorios; luego cobertura', implementado: true },
  K: { nombre: 'Antes / después', criterio: 'dos formas paralelas (pares de la misma familia y tipo): forma A antes y forma B después de una intervención', implementado: true },
  M: { nombre: 'Adaptativo', criterio: `banco de preguntas CALIBRADAS (TRI) con regla de selección por máxima información en θ̂ y parada por error típico; exige al menos ${MIN_ADAPTATIVO} calibradas`, implementado: true },
  N: { nombre: 'Robustez', criterio: 'pares del mismo concepto presentado en contextos distintos (otro tipo de pregunta o formato)', implementado: true },
  O: { nombre: 'Asistencia externa (prospectivo)', criterio: 'pares isomorfos en dos condiciones declaradas y consentidas, con asignación cruzada y reproducible', implementado: true },
  P: { nombre: 'Por hipótesis (texto libre)', criterio: 'detecta en su frase los conceptos del banco (por coincidencia de palabras, sin IA) y propone un diseño correlacional entre ellos', implementado: true },
  R: { nombre: 'Exploratorio', criterio: 'máxima reducción esperada de la incertidumbre de los parámetros: Σ ET(b)² × información de Fisher esperada para b con θ ~ N(0,1)', implementado: true },
} as const;
export type Modo = keyof typeof MODOS;

export interface Opciones {
  modo: Modo; n: number; minutos: number | null; obligatorios: string[]; conceptos: string[];
  base: string[];                              // preguntas del examen analizado
  habilidades?: [Cognitiva, Cognitiva];        // para el modo H
  erroresFrecuentes?: string[];                // para el modo I
  hipotesis?: string;                          // para el modo P
  /**
   * Temas del examen analizado. Si se dan, las candidatas se limitan a preguntas que comparten un concepto o una
   * lección con él (salvo en F, que busca transferencia fuera del examen, y en P, cuyos temas fija la hipótesis).
   */
  temasBase?: { conceptos: string[]; lecciones: string[] } | null;
  semilla: number;
}

/** Modos en los que limitar a los temas del examen analizado no tiene sentido. */
export const MODOS_SIN_LIMITE: Modo[] = ['F', 'P'];

/** Especificación y rendimiento SIMULADO de un examen adaptativo (modo M). */
export interface Adaptativo {
  pool: number; inicio: string; seleccion: string; parada: string;
  simulacion: { estudiantes: number; itemsMedios: number; seMedio: number; correlacion: number; semilla: number };
  aviso: string;
}

export interface Diseno {
  modo: Modo; titulo: string; criterio: string; semilla: number;
  items: { id: string; razon: string; version?: 'A' | 'B' }[];
  tiempoMin: number; conceptos: string[]; conceptosSinCubrir: string[];
  dificultad: Record<'basico' | 'intermedio' | 'desafiante', number>; habilidades: Record<string, number>;
  historicas: number; sinHistorico: number;
  informacionAPriori: number;                  // bajo el modelo 2PL a priori (no calibrado), para comparar diseños
  validacion: 'a_priori' | 'parcialmente_empirica';
  avisos: string[]; riesgos: string[];
  adaptativo?: Adaptativo;
  hipotesisFormal?: { texto: string; conceptosA: string[]; conceptosB: string[] };
  etiquetasVersion?: { A: string; B: string };
}

/** Palabras distintivas (sin tildes ni palabras vacías) para comparar la hipótesis con los conceptos del banco. */
const VACIAS_HIP = new Set('quiero investigar si los las que quienes dominan dominar comprenden comprender mejor tambien saben saber entre relacion con del de la el y en un una por para estudiantes alumnos tienen mas menos'.split(' '));
const palabras = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !VACIAS_HIP.has(w)).map((w) => w.replace(/(es|s)$/, ''));

/** Divide la hipótesis en dos partes y busca en cada una conceptos del banco (slug o tema). */
export function interpretarHipotesis(texto: string, banco: ItemBancoCiencia[]): { conceptosA: string[]; conceptosB: string[] } {
  const partes = texto.split(/\b(?:tambien|también|mejor|entonces|implica|predice|se asocia|comprenden|dominan|y)\b/i).map((p) => p.trim()).filter(Boolean);
  const conceptos = [...new Set(banco.flatMap((b) => b.analisis.conceptos))];
  const temaDe = new Map<string, string>();
  for (const b of banco) for (const c of b.analisis.conceptos) if (b.analisis.tema && !temaDe.has(c)) temaDe.set(c, b.analisis.tema);
  const casan = (parte: string) => {
    const w = new Set(palabras(parte));
    return conceptos.filter((c) => { const cw = palabras(`${c.replace(/-/g, ' ')} ${temaDe.get(c) ?? ''}`); return cw.length > 0 && cw.filter((x) => w.has(x)).length >= Math.min(2, cw.length); });
  };
  const a = partes.length > 1 ? casan(partes.slice(0, Math.ceil(partes.length / 2)).join(' ')) : [];
  const b = partes.length > 1 ? casan(partes.slice(Math.ceil(partes.length / 2)).join(' ')).filter((c) => !a.includes(c)) : [];
  return { conceptosA: a, conceptosB: b };
}

/** Asignación aleatoria EQUILIBRADA y reproducible de estudiantes a condiciones (A/B) por semilla. */
export function asignarCondiciones(ids: string[], semilla: number): { id: string; condicion: 'A' | 'B'; orden: 'A→B' | 'B→A' }[] {
  const rnd = mulberry32(semilla);
  const v = [...ids].sort();
  for (let k = v.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [v[k], v[j]] = [v[j], v[k]]; }
  return v.map((id, i) => ({ id, condicion: i % 2 ? 'B' : 'A', orden: i % 2 ? 'B→A' : 'A→B' }));
}

/** Simulación de una aplicación adaptativa con el banco calibrado (θ ~ N(0,1); EAP con a priori N(0,1)). */
function simularAdaptativo(pool: Calibracion[], maxItems: number, seParada: number, semilla: number): Adaptativo['simulacion'] {
  const rnd = mulberry32(semilla);
  const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const N = 400, est: number[] = [], ver: number[] = [];
  let sumItems = 0, sumSe = 0;
  for (let s = 0; s < N; s++) {
    const th = normal();
    const usados = new Set<number>();
    const lp = THETAS.map((t) => -0.5 * t * t);
    let eap = 0, se = 1;
    while (usados.size < Math.min(maxItems, pool.length)) {
      let mejor = -1, inf = -Infinity;
      pool.forEach((c, j) => { if (!usados.has(j)) { const v = informacionItem(c, eap); if (v > inf) { inf = v; mejor = j; } } });
      usados.add(mejor);
      const c = pool[mejor], x = rnd() < logistica(c.a * (th - c.b));
      THETAS.forEach((t, k) => { const p = logistica(c.a * (t - c.b)); lp[k] += Math.log(x ? p : 1 - p); });
      const mx = Math.max(...lp), w = lp.map((v) => Math.exp(v - mx)), z = w.reduce((a, b) => a + b, 0);
      eap = THETAS.reduce((a, t, k) => a + t * w[k], 0) / z;
      se = Math.sqrt(THETAS.reduce((a, t, k) => a + (t - eap) ** 2 * w[k], 0) / z);
      if (se < seParada) break;
    }
    sumItems += usados.size; sumSe += se; est.push(eap); ver.push(th);
  }
  const mx = est.reduce((a, b) => a + b, 0) / N, my = ver.reduce((a, b) => a + b, 0) / N;
  let sxy = 0, sxx = 0, syy = 0;
  est.forEach((x, i) => { sxy += (x - mx) * (ver[i] - my); sxx += (x - mx) ** 2; syy += (ver[i] - my) ** 2; });
  return { estudiantes: N, itemsMedios: sumItems / N, seMedio: sumSe / N, correlacion: sxy / Math.sqrt(sxx * syy), semilla };
}

const tiene = (it: ItemBancoCiencia, ...cs: Cognitiva[]) => it.analisis.cognitivas.some((c) => cs.includes(c.valor));
const fichasTexto = (t: string) => new Set(t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter((w) => w.length > 4));

export function disenar(banco: ItemBancoCiencia[], o: Opciones): Diseno {
  const def = MODOS[o.modo];
  if (!def.implementado) throw new Error(`El modo ${o.modo} (${def.nombre}) no está disponible: ${'motivo' in def ? def.motivo : ''}`);
  const rnd = mulberry32(o.semilla);
  const desempate = new Map(banco.map((b) => [b.pregunta.id, rnd()]));   // orden reproducible ante empates
  const avisos: string[] = [], riesgos: string[] = [];
  const baseSet = new Set(o.base);
  const conceptosBase = new Set(banco.filter((b) => baseSet.has(b.pregunta.id)).flatMap((b) => b.analisis.conceptos));
  // candidatas: publicadas y, si se pide, solo de los temas del examen analizado
  let candidatos = banco.filter((b) => b.pregunta.published !== false);
  if (o.temasBase && !MODOS_SIN_LIMITE.includes(o.modo)) {
    const cs = new Set(o.temasBase.conceptos), ls = new Set(o.temasBase.lecciones);
    if (!cs.size && !ls.size) {
      avisos.push('El examen analizado no tiene conceptos ni lecciones asociados: no se pudo limitar a sus temas y se usó toda la asignatura.');
    } else {
      candidatos = candidatos.filter((b) => b.analisis.conceptos.some((c) => cs.has(c)) || b.pregunta.concepts.some((c) => cs.has(c))
        || (!!b.pregunta.leccion && ls.has(b.pregunta.leccion)));
      avisos.push(`Limitado a los temas del examen analizado (${cs.size} concepto(s), ${ls.size} lección(es)): ${candidatos.length} preguntas candidatas en el banco.`);
    }
  }
  const nCal = candidatos.filter(calibrada).length;
  if (o.modo === 'M' && nCal < MIN_ADAPTATIVO) {
    throw new Error(`El modo adaptativo necesita parámetros calibrados (TRI) de al menos ${MIN_ADAPTATIVO} preguntas${o.temasBase ? ' de estos temas' : ''}; hay ${nCal}. Calibre el banco en «Calibración de ítems» cuando haya suficientes respuestas${o.temasBase ? ', o quite el límite a los temas del examen analizado' : ''}.`);
  }
  let hip: { conceptosA: string[]; conceptosB: string[] } | null = null;
  if (o.modo === 'P') {
    hip = interpretarHipotesis(o.hipotesis ?? '', banco);
    if (!hip.conceptosA.length || !hip.conceptosB.length) {
      throw new Error('No encontré en la frase conceptos del banco para las dos partes de la hipótesis. Escríbala con los nombres de los conceptos, p. ej. «Quienes dominan la segunda ley de Newton comprenden mejor el impulso».');
    }
  }

  // puntuación por modo
  if (o.modo === 'F' || o.modo === 'J') candidatos = candidatos.filter((b) => !baseSet.has(b.pregunta.id));
  if (o.modo === 'J') candidatos = candidatos.filter((b) => b.analisis.conceptos.some((c) => conceptosBase.has(c)));
  const puntua = (b: ItemBancoCiencia): { s: number; razon: string } | null => {
    const a = b.analisis, h = b.historico;
    switch (o.modo) {
      case 'A': case 'Q': return { s: 1, razon: 'aporta cobertura y equilibrio' };
      case 'B': return { s: a.pasos.valor === 1 ? 2 : 1, razon: a.pasos.valor === 1 ? 'un solo paso: aísla el concepto' : 'cubre un concepto' };
      case 'C': return tiene(b, 'comprension_conceptual', 'razonamiento_fisico', 'comprension_supuestos', 'pensamiento_critico', 'modelizacion')
        ? { s: 2 + (a.complejidadAlgebraica.valor === 'baja' ? 1 : 0), razon: 'evalúa comprensión física con poca carga algebraica' } : null;
      case 'D': return tiene(b, 'resolucion_multietapa', 'transferencia', 'pensamiento_critico', 'comprension_supuestos', 'modelizacion')
        ? { s: 2 + a.pasos.valor * 0.3, razon: `exige integrar o justificar (${a.cognitivas.slice(0, 2).map((c) => COGNITIVAS[c.valor]).join(', ')})` } : null;
      case 'E': return calibrada(b) ? { s: 2 + b.cal!.a / 2, razon: `discriminación TRI a = ${b.cal!.a.toFixed(2)} ± ${b.cal!.se_a.toFixed(2)} (n = ${b.cal!.n_resp}, observada)` }
        : h && h.discriminacion !== null && h.n >= MINIMOS.discriminacion
        ? { s: 2 + h.discriminacion, razon: `discriminación observada ${h.discriminacion.toFixed(2)} (n = ${h.n})` }
        : { s: 0.5, razon: 'sin discriminación observada: elegida por su dificultad prevista (a priori)' };
      case 'F': return tiene(b, 'transferencia') ? { s: 3, razon: 'pregunta de transferencia no incluida en el examen base' }
        : a.conceptos.some((c) => conceptosBase.has(c)) ? { s: 1.5, razon: 'mismo concepto que el examen base en un problema distinto' } : null;
      case 'G': case 'K': case 'O': return b.pregunta.meta?.familia ? { s: 2, razon: `familia ${b.pregunta.meta.familia}` } : null;
      case 'N': return a.conceptos.length ? { s: 1, razon: 'concepto con varias presentaciones' } : null;
      case 'M': return calibrada(b) ? { s: 1, razon: `calibrada: a = ${b.cal!.a.toFixed(2)}, b = ${b.cal!.b.toFixed(2)} ± ${b.cal!.se_b.toFixed(2)}` } : null;
      case 'P': { const ca = a.conceptos.some((c) => hip!.conceptosA.includes(c)), cb = a.conceptos.some((c) => hip!.conceptosB.includes(c));
        return ca ? { s: 2, razon: `mide ${hip!.conceptosA.filter((c) => a.conceptos.includes(c)).join(', ')} (parte 1 de la hipótesis)` }
          : cb ? { s: 2, razon: `mide ${hip!.conceptosB.filter((c) => a.conceptos.includes(c)).join(', ')} (parte 2 de la hipótesis)` } : null; }
      case 'R': {
        const c = calibrada(b) ? b.cal! : aPriori({ dificultad: a.dificultadAPriori.valor, formato: b.pregunta.format });
        const info = THETAS.reduce((s, t) => s + Math.exp(-0.5 * t * t) * informacionItem(c, t), 0) / THETAS.reduce((s, t) => s + Math.exp(-0.5 * t * t), 0);
        const v = c.se_b ** 2 * info;
        return { s: 2 * v, razon: `reducción esperada de la incertidumbre de b: ET(b)² × info = ${v.toFixed(2)}${calibrada(b) ? '' : ' (sin calibrar: ET a priori = 1)'}` };
      }
      case 'H': { const [x, y] = o.habilidades ?? ['comprension_conceptual', 'aplicacion_directa'];
        return tiene(b, x) ? { s: 2, razon: `mide ${COGNITIVAS[x]}` } : tiene(b, y) ? { s: 2, razon: `mide ${COGNITIVAS[y]}` } : null; }
      case 'I': return (o.erroresFrecuentes ?? []).includes(b.pregunta.id) ? { s: 3, razon: 'tuvo una respuesta incorrecta frecuente en el examen base' }
        : tiene(b, 'deteccion_contradicciones') ? { s: 2, razon: 'pide detectar un error o una afirmación falsa' } : null;
      case 'J': return { s: 2, razon: 'mismo concepto que el examen base, con otra pregunta' };
      case 'L': return { s: h ? 3 / (1 + h.n / MINIMOS.item) : 3, razon: h ? `solo ${h.n} respuestas históricas` : 'sin respuestas históricas (n = 0)' };
      default: return null;
    }
  };
  const puntuados = candidatos.map((b) => ({ b, p: puntua(b) })).filter((x): x is { b: ItemBancoCiencia; p: { s: number; razon: string } } => !!x.p);

  const elegidos: { b: ItemBancoCiencia; razon: string; version?: 'A' | 'B' }[] = [];
  const tiempo = () => elegidos.reduce((s, e) => s + e.b.analisis.tiempoAPrioriMin, 0);
  const cubiertos = () => new Set(elegidos.flatMap((e) => e.b.analisis.conceptos));
  const objetivoDif = { basico: 0.3, intermedio: 0.5, desafiante: 0.2 };

  for (const id of o.obligatorios) { const x = banco.find((b) => b.pregunta.id === id); if (x) elegidos.push({ b: x, razon: 'obligatoria (indicada por el profesor)' }); }

  if (o.modo === 'N') {
    // por concepto, dos preguntas que lo presentan de forma distinta (otro tipo de pregunta u otro formato)
    const porConcepto = new Map<string, ItemBancoCiencia[]>();
    for (const { b } of puntuados) for (const c of b.analisis.conceptos) porConcepto.set(c, [...(porConcepto.get(c) ?? []), b]);
    for (const [c, g] of [...porConcepto.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      if (elegidos.length + 2 > o.n) break;
      const orden = [...g].sort((p, q) => desempate.get(p.pregunta.id)! - desempate.get(q.pregunta.id)!).filter((x) => !elegidos.some((e) => e.b === x));
      const x = orden[0];
      const y = x && orden.find((z) => z !== x && ((z.pregunta.meta?.tipo ?? z.pregunta.category) !== (x.pregunta.meta?.tipo ?? x.pregunta.category) || z.pregunta.format !== x.pregunta.format));
      if (x && y) elegidos.push({ b: x, razon: `«${c}» presentado como ${x.pregunta.meta?.tipo ?? x.pregunta.category} (${x.pregunta.format})` }, { b: y, razon: `«${c}» en otro contexto: ${y.pregunta.meta?.tipo ?? y.pregunta.category} (${y.pregunta.format})` });
    }
    if (!elegidos.length) avisos.push('No hay conceptos con preguntas de distinto tipo o formato: no se puede evaluar la robustez con este banco.');
    riesgos.push('El «contexto» se aproxima por el tipo de pregunta y el formato; la equivalencia de dificultad entre presentaciones no está verificada.');
  } else if (o.modo === 'G' || o.modo === 'K' || o.modo === 'O') {
    // pares por familia y tipo: uno a cada versión
    const grupos = new Map<string, ItemBancoCiencia[]>();
    for (const { b } of puntuados) { const k = `${b.pregunta.meta!.familia}|${b.pregunta.meta!.tipo}`; grupos.set(k, [...(grupos.get(k) ?? []), b]); }
    for (const [k, g] of [...grupos.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      if (g.length < 2 || elegidos.length + 2 > o.n * 2) continue;
      const [x, y] = [...g].sort((p, q) => desempate.get(p.pregunta.id)! - desempate.get(q.pregunta.id)!);
      elegidos.push({ b: x, razon: `par isomorfo ${k.split('|')[0]} (versión A)`, version: 'A' }, { b: y, razon: `par isomorfo ${k.split('|')[0]} (versión B)`, version: 'B' });
    }
    riesgos.push('La equivalencia de cada par es supuesta (misma familia y tipo); verifique parámetros y soluciones admisibles y, tras aplicarlo, compruebe la dificultad con la ficha «¿son igual de difíciles?».');
  } else if (o.modo === 'M') {
    // el «examen» adaptativo es el BANCO calibrado; cada estudiante recibe como máximo n preguntas
    for (const x of puntuados) elegidos.push({ b: x.b, razon: x.p.razon });
  } else {
    while (elegidos.length < o.n) {
      const faltan = o.conceptos.filter((c) => !cubiertos().has(c));
      let mejor: (typeof puntuados)[number] | null = null, mejorS = -Infinity;
      for (const x of puntuados) {
        if (elegidos.some((e) => e.b === x.b)) continue;
        if (o.minutos && tiempo() + x.b.analisis.tiempoAPrioriMin > o.minutos) continue;
        let s = x.p.s;
        const nuevos = x.b.analisis.conceptos.filter((c) => !cubiertos().has(c)).length;
        s += Math.min(nuevos, 2) * (o.modo === 'A' || o.modo === 'B' || o.modo === 'Q' ? 1 : 0.3);
        if (x.b.analisis.conceptos.some((c) => faltan.includes(c))) s += 5;
        const ft = fichasTexto(x.b.pregunta.prompt);
        if (elegidos.some((e) => jaccard(ft, fichasTexto(e.b.pregunta.prompt)) >= 0.55)) s -= 3;   // evita redundancia textual
        if (o.modo === 'A' || o.modo === 'E' || o.modo === 'Q') {
          const d = x.b.analisis.dificultadAPriori.valor, frac = elegidos.filter((e) => e.b.analisis.dificultadAPriori.valor === d).length / Math.max(1, o.n);
          s += objetivoDif[d] - frac;
        }
        s += desempate.get(x.b.pregunta.id)! * 1e-3;
        if (s > mejorS) { mejorS = s; mejor = x; }
      }
      if (!mejor) { avisos.push(`Solo se encontraron ${elegidos.length} preguntas que cumplen el objetivo${o.minutos ? ' y el tiempo' : ''}: haría falta generar o crear más (la generación asistida aún no está disponible).`); break; }
      elegidos.push({ b: mejor.b, razon: mejor.p.razon });
    }
  }

  if (o.modo === 'H') {
    const [x, y] = o.habilidades ?? ['comprension_conceptual', 'aplicacion_directa'];
    const nx = elegidos.filter((e) => tiene(e.b, x)).length, ny = elegidos.filter((e) => tiene(e.b, y)).length;
    if (nx < 3 || ny < 3) avisos.push(`Para correlacionar habilidades conviene al menos 3 preguntas de cada una (hay ${nx} y ${ny}).`);
    riesgos.push(`Para estimar una correlación con precisión razonable (±0,3 al 95 %) harán falta unos ${MINIMOS.correlacion} estudiantes o más.`, 'Es un diseño correlacional: no permitirá conclusiones causales.');
  }
  if (o.modo === 'E' && elegidos.every((e) => !e.b.historico || e.b.historico.n < MINIMOS.discriminacion)) avisos.push('Ninguna pregunta tiene discriminación observada suficiente: el diseño se basa en dificultades previstas (a priori).');
  if (o.modo === 'J') riesgos.push('Aplíquelo tras un intervalo (p. ej. 3–6 semanas). Entre ambas mediciones hay enseñanza: no es un experimento controlado.');
  const faltan = o.conceptos.filter((c) => !cubiertos().has(c));
  if (faltan.length) avisos.push(`Conceptos obligatorios sin cubrir: ${faltan.join(', ')}.`);
  let etiquetasVersion: Diseno['etiquetasVersion'];
  let adaptativo: Adaptativo | undefined;
  let hipotesisFormal: Diseno['hipotesisFormal'];
  if (o.modo === 'K') {
    etiquetasVersion = { A: 'Antes (pretest)', B: 'Después (postest)' };
    riesgos.push('Sin grupo de control, un cambio entre antes y después no se puede atribuir a la intervención (maduración, práctica, otras clases).',
      'Contrabalancee si puede: la mitad hace la forma A antes y la B después, y la otra mitad al revés (vea «Asignar estudiantes» en el modo O).');
  }
  if (o.modo === 'O') {
    etiquetasVersion = { A: 'Condición A', B: 'Condición B' };
    riesgos.push('Requiere consentimiento informado y explicar a los estudiantes las dos condiciones (p. ej. con y sin asistencia declarada) antes de aplicarlo.',
      'Los resultados individuales quedan separados de la calificación salvo reglas comunicadas de antemano; no habilita sanciones.',
      'Use la asignación cruzada reproducible (semilla) para decidir quién hace cada condición primero.');
  }
  if (o.modo === 'M') {
    const pool = elegidos.map((e) => e.b.cal!);
    adaptativo = {
      pool: pool.length, inicio: 'θ̂ = 0 (habilidad media) para todos',
      seleccion: 'en cada paso, la pregunta no usada con máxima información de Fisher en la θ̂ actual (EAP con a priori N(0,1))',
      parada: `cuando el error típico de θ̂ baja de 0,40 o se alcanzan ${o.n} preguntas`,
      simulacion: simularAdaptativo(pool, o.n, 0.4, o.semilla),
      aviso: 'El motor de examen del aula todavía NO administra exámenes adaptativos: esto es la especificación del diseño y su rendimiento simulado con estudiantes sintéticos.',
    };
    riesgos.push(adaptativo.aviso, 'Cada estudiante ve preguntas distintas: las notas solo son comparables a través de θ̂, no por número de aciertos.');
  }
  if (o.modo === 'P' && hip) {
    hipotesisFormal = { texto: `Entre quienes responden ambos grupos de preguntas, el acierto en las de ${hip.conceptosA.join(', ')} se asocia positivamente con el acierto en las de ${hip.conceptosB.join(', ')}.`, conceptosA: hip.conceptosA, conceptosB: hip.conceptosB };
    const na = elegidos.filter((e) => e.b.analisis.conceptos.some((c) => hip!.conceptosA.includes(c))).length, nb = elegidos.length - na;
    if (na < 3 || nb < 3) avisos.push(`Conviene al menos 3 preguntas por cada parte de la hipótesis (hay ${na} y ${nb}).`);
    riesgos.push('Los conceptos se detectaron por coincidencia de palabras: revise que correspondan a lo que quiso decir.', 'Es un diseño correlacional: «comprenden mejor» se contrastará como asociación, no como causa.');
  }
  if (o.modo === 'R') riesgos.push('Prioriza aprender sobre las preguntas (calibración), no medir con precisión a cada estudiante: no lo use como examen calificado sin revisarlo.');

  const dificultad = { basico: 0, intermedio: 0, desafiante: 0 };
  const habilidades: Record<string, number> = {};
  for (const e of elegidos) { dificultad[e.b.analisis.dificultadAPriori.valor]++; for (const c of e.b.analisis.cognitivas) habilidades[COGNITIVAS[c.valor]] = (habilidades[COGNITIVAS[c.valor]] ?? 0) + 1; }
  const historicas = elegidos.filter((e) => e.b.historico && e.b.historico.n >= MINIMOS.item).length;
  const params = elegidos.map((e) => aPriori({ dificultad: e.b.analisis.dificultadAPriori.valor, formato: e.b.pregunta.format }));
  const pares = o.modo === 'G' || o.modo === 'K' || o.modo === 'O';
  return {
    modo: o.modo, titulo: `${def.nombre} · borrador LIEIA`, criterio: def.criterio, semilla: o.semilla,
    items: elegidos.map((e) => ({ id: e.b.pregunta.id, razon: e.razon, version: e.version })),
    tiempoMin: Math.round(pares ? tiempo() / 2 : o.modo === 'M' ? (tiempo() / Math.max(1, elegidos.length)) * Math.min(o.n, elegidos.length) : tiempo()),
    conceptos: [...cubiertos()], conceptosSinCubrir: faltan, dificultad, habilidades,
    historicas, sinHistorico: elegidos.length - historicas,
    informacionAPriori: params.length ? informacionEsperada(params, 0, 1) : 0,
    validacion: historicas || elegidos.some((e) => calibrada(e.b)) ? 'parcialmente_empirica' : 'a_priori', avisos, riesgos,
    adaptativo, hipotesisFormal, etiquetasVersion,
  };
}

/** Comparación de diseños por dimensión (sin declarar un «ganador» sin criterio). */
export function comparar(ds: Diseno[]) {
  return ds.map((d) => ({
    modo: d.modo, nombre: MODOS[d.modo].nombre, criterio: d.criterio, preguntas: d.items.length, minutos: d.tiempoMin, conceptos: d.conceptos.length,
    dificultad: d.dificultad, informacionAPriori: d.informacionAPriori, historicas: d.historicas, validacion: d.validacion, avisos: d.avisos.length + d.riesgos.length,
  }));
}
