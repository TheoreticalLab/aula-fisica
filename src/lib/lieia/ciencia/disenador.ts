/**
 * LIEIA · diseñador de exámenes por OBJETIVO (capa A, determinista y reproducible por semilla).
 * Selecciona preguntas EXISTENTES del banco de la asignatura (estrategia 1, reutilización). La generación asistida de
 * preguntas nuevas (estrategia 2) no está implementada: cuando faltan preguntas, el diseño lo dice.
 * Cada elección lleva su razón; el resultado es un BORRADOR editable que nunca se publica solo.
 * Criterio de optimización explícito por modo (ningún diseño es «mejor» sin decir respecto a qué).
 */
import { mulberry32 } from '@/lib/fisica/variantes';
import { informacionEsperada, aPriori } from '../diseno';
import { COGNITIVAS, MINIMOS, type Cognitiva, type Pregunta } from './modelo';
import type { AnalisisContenido } from './contenido';
import { jaccard } from './relaciones';

export interface ItemBancoCiencia { pregunta: Pregunta; analisis: AnalisisContenido; historico: { p: number; n: number; discriminacion: number | null } | null }

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
  K: { nombre: 'Antes / después', criterio: 'dos formas equivalentes (usa el modo G) aplicadas antes y después de una intervención', implementado: false, motivo: 'use el modo G para las dos formas; la planificación de la intervención aún no está en el laboratorio' },
  M: { nombre: 'Adaptativo', criterio: 'selección por estimación de dominio', implementado: false, motivo: 'requiere parámetros calibrados (TRI) de suficientes preguntas; no se activa sin ellos' },
  N: { nombre: 'Robustez', criterio: 'el mismo concepto en contextos distintos', implementado: false, motivo: 'pendiente: necesita metadatos de contexto en el banco' },
  O: { nombre: 'Asistencia externa (prospectivo)', criterio: 'pares isomorfos en condiciones declaradas y consentidas', implementado: false, motivo: 'se planifica desde la ficha correspondiente; requiere consentimiento y no se crea automáticamente' },
  P: { nombre: 'Por hipótesis (texto libre)', criterio: 'convierte una pregunta científica en diseño', implementado: false, motivo: 'requiere la capa de IA, aún no conectada' },
  R: { nombre: 'Exploratorio', criterio: 'información sobre relaciones poco conocidas', implementado: false, motivo: 'requiere definir antes un modelo y una medida de información' },
} as const;
export type Modo = keyof typeof MODOS;

export interface Opciones {
  modo: Modo; n: number; minutos: number | null; obligatorios: string[]; conceptos: string[];
  base: string[];                              // preguntas del examen analizado
  habilidades?: [Cognitiva, Cognitiva];        // para el modo H
  erroresFrecuentes?: string[];                // para el modo I
  semilla: number;
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

  // candidatos y puntuación por modo
  let candidatos = banco.filter((b) => b.pregunta.published !== false);
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
      case 'E': return h && h.discriminacion !== null && h.n >= MINIMOS.discriminacion
        ? { s: 2 + h.discriminacion, razon: `discriminación observada ${h.discriminacion.toFixed(2)} (n = ${h.n})` }
        : { s: 0.5, razon: 'sin discriminación observada: elegida por su dificultad prevista (a priori)' };
      case 'F': return tiene(b, 'transferencia') ? { s: 3, razon: 'pregunta de transferencia no incluida en el examen base' }
        : a.conceptos.some((c) => conceptosBase.has(c)) ? { s: 1.5, razon: 'mismo concepto que el examen base en un problema distinto' } : null;
      case 'G': return b.pregunta.meta?.familia ? { s: 2, razon: `familia ${b.pregunta.meta.familia}` } : null;
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

  if (o.modo === 'G') {
    // pares por familia y tipo: uno a cada versión
    const grupos = new Map<string, ItemBancoCiencia[]>();
    for (const { b } of puntuados) { const k = `${b.pregunta.meta!.familia}|${b.pregunta.meta!.tipo}`; grupos.set(k, [...(grupos.get(k) ?? []), b]); }
    for (const [k, g] of [...grupos.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      if (g.length < 2 || elegidos.length + 2 > o.n * 2) continue;
      const [x, y] = [...g].sort((p, q) => desempate.get(p.pregunta.id)! - desempate.get(q.pregunta.id)!);
      elegidos.push({ b: x, razon: `par isomorfo ${k.split('|')[0]} (versión A)`, version: 'A' }, { b: y, razon: `par isomorfo ${k.split('|')[0]} (versión B)`, version: 'B' });
    }
    riesgos.push('La equivalencia de cada par es supuesta (misma familia y tipo); verifique parámetros y soluciones admisibles y, tras aplicarlo, compruebe la dificultad con la ficha «¿son igual de difíciles?».');
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

  const dificultad = { basico: 0, intermedio: 0, desafiante: 0 };
  const habilidades: Record<string, number> = {};
  for (const e of elegidos) { dificultad[e.b.analisis.dificultadAPriori.valor]++; for (const c of e.b.analisis.cognitivas) habilidades[COGNITIVAS[c.valor]] = (habilidades[COGNITIVAS[c.valor]] ?? 0) + 1; }
  const historicas = elegidos.filter((e) => e.b.historico && e.b.historico.n >= MINIMOS.item).length;
  const params = elegidos.map((e) => aPriori({ dificultad: e.b.analisis.dificultadAPriori.valor, formato: e.b.pregunta.format }));
  return {
    modo: o.modo, titulo: `${def.nombre} · borrador LIEIA`, criterio: def.criterio, semilla: o.semilla,
    items: elegidos.map((e) => ({ id: e.b.pregunta.id, razon: e.razon, version: e.version })),
    tiempoMin: Math.round(o.modo === 'G' ? tiempo() / 2 : tiempo()), conceptos: [...cubiertos()], conceptosSinCubrir: faltan, dificultad, habilidades,
    historicas, sinHistorico: elegidos.length - historicas,
    informacionAPriori: params.length ? informacionEsperada(params, 0, 1) : 0,
    validacion: historicas ? 'parcialmente_empirica' : 'a_priori', avisos, riesgos,
  };
}

/** Comparación de diseños por dimensión (sin declarar un «ganador» sin criterio). */
export function comparar(ds: Diseno[]) {
  return ds.map((d) => ({
    modo: d.modo, nombre: MODOS[d.modo].nombre, criterio: d.criterio, preguntas: d.items.length, minutos: d.tiempoMin, conceptos: d.conceptos.length,
    dificultad: d.dificultad, informacionAPriori: d.informacionAPriori, historicas: d.historicas, validacion: d.validacion, avisos: d.avisos.length + d.riesgos.length,
  }));
}
