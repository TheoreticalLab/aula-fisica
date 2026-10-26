/**
 * Validación estructural y física del contenido inicial. Devuelve una lista de problemas (vacía = correcto).
 */
import katex from 'katex';
import { getSimulation } from '../src/sims/catalogo';
import { validateNumericKey } from '../supabase/functions/_shared/calificacion/calificar.ts';
import type { ExerciseDef, LessonDef } from '../contenido/tipos';
import type { LoadedUnit } from './cargar-contenido';

/** Extrae fragmentos matemáticos ($$...$$ y $...$) de un texto Markdown. */
export function extractMath(md: string): string[] {
  const out: string[] = [];
  const withoutDisplay = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => {
    out.push(m);
    return ' ';
  });
  withoutDisplay.replace(/\$([^$\n]+?)\$/g, (_, m: string) => {
    out.push(m);
    return ' ';
  });
  return out;
}

export function katexErrors(tex: string): string | null {
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'ignore' });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function checkMarkdown(where: string, md: string | undefined, problems: string[]) {
  if (!md) return;
  const dollars = (md.replace(/\$\$/g, '').match(/\$/g) || []).length;
  if (dollars % 2 !== 0) problems.push(`${where}: número impar de signos $ (fórmula sin cerrar)`);
  for (const m of extractMath(md)) {
    const err = katexErrors(m);
    if (err) problems.push(`${where}: LaTeX inválido «${m.slice(0, 60)}»: ${err}`);
  }
}

export function checkTex(where: string, tex: string, problems: string[]) {
  const err = katexErrors(tex);
  if (err) problems.push(`${where}: LaTeX inválido «${tex.slice(0, 60)}»: ${err}`);
}

export function checkSimRef(where: string, key: string, params: Record<string, number> | undefined, problems: string[]) {
  const sim = getSimulation(key);
  if (!sim) {
    problems.push(`${where}: simulador desconocido «${key}»`);
    return;
  }
  for (const [name, value] of Object.entries(params ?? {})) {
    const p = sim.params.find((x) => x.name === name);
    if (!p) problems.push(`${where}: el simulador «${key}» no tiene el parámetro «${name}»`);
    else if (value < p.min || value > p.max) problems.push(`${where}: ${name} = ${value} fuera de rango [${p.min}, ${p.max}]`);
  }
}

export function checkExercise(where: string, e: ExerciseDef, problems: string[]) {
  checkMarkdown(`${where} enunciado`, e.prompt, problems);
  if (e.format === 'choice') {
    if (!e.options || e.options.length < 2) problems.push(`${where}: selección con menos de 2 opciones`);
    e.options?.forEach((o, i) => checkMarkdown(`${where} opción ${i}`, o, problems));
  } else if (e.options) {
    problems.push(`${where}: tiene opciones pero su formato es ${e.format}`);
  }
  if (e.category === 'grafica' && !e.figure) problems.push(`${where}: categoría 'grafica' sin figure`);
  if (e.category === 'experimento' && !e.simulation) problems.push(`${where}: categoría 'experimento' sin simulation`);
  if (e.category === 'desarrollo' && e.format !== 'open') problems.push(`${where}: 'desarrollo' debería tener formato 'open'`);
  if (e.figure) {
    if (!e.figure.series.length || e.figure.series.some((s) => s.points.length < 2)) problems.push(`${where}: figura sin datos suficientes`);
    if (e.figure.series.some((s) => s.points.some((p) => p.length !== 2 || !p.every(Number.isFinite)))) {
      problems.push(`${where}: figura con puntos no numéricos`);
    }
  }
  if (e.simulation) checkSimRef(where, e.simulation.key, e.simulation.params, problems);
}

function checkLesson(where: string, L: LessonDef, problems: string[]) {
  if (!/^[a-z0-9-]+$/.test(L.slug)) problems.push(`${where}: slug inválido «${L.slug}»`);
  if (L.theory.split(/\s+/).length < 300) problems.push(`${where}: la teoría es demasiado corta (${L.theory.split(/\s+/).length} palabras)`);
  checkMarkdown(`${where} teoría`, L.theory, problems);
  if (L.formulas.length < 1) problems.push(`${where}: sin fórmulas`);
  L.formulas.forEach((f, i) => {
    checkTex(`${where} fórmula ${i + 1}`, f.latex, problems);
    f.variables.forEach((v) => checkTex(`${where} fórmula ${i + 1} variable`, v.symbol, problems));
    checkMarkdown(`${where} fórmula ${i + 1} descripción`, f.description, problems);
    checkMarkdown(`${where} fórmula ${i + 1} notas`, f.notes, problems);
  });
  if (L.examples.length < 2) problems.push(`${where}: menos de 2 ejemplos resueltos`);
  L.examples.forEach((ex, i) => {
    const w = `${where} ejemplo ${i + 1}`;
    checkMarkdown(w, ex.statement, problems);
    ex.steps.forEach((s, k) => checkMarkdown(`${w} paso ${k + 1}`, s, problems));
    checkMarkdown(w, ex.result, problems);
    checkMarkdown(w, ex.interpretation, problems);
    if (ex.steps.length < 2) problems.push(`${w}: menos de 2 pasos`);
  });
  if (L.simulation) {
    checkSimRef(`${where} simulación`, L.simulation.key, L.simulation.params, problems);
    checkMarkdown(`${where} guía`, L.simulation.guide, problems);
  }
  const practice = L.exercises.filter((e) => e.role === 'practice');
  const count = (d: string) => practice.filter((e) => e.difficulty === d).length;
  if (count('basico') < 3 || count('intermedio') < 1 || count('desafiante') < 1) {
    problems.push(`${where}: el conjunto de práctica necesita al menos 3 básicos, 1 intermedio y 1 desafiante (tiene ${count('basico')}/${count('intermedio')}/${count('desafiante')})`);
  }
  if (L.exercises.filter((e) => e.role === 'reinforcement').length < 1) problems.push(`${where}: sin ejercicios de refuerzo`);
}

export function validateContent(units: LoadedUnit[], opts: { requireKeys: boolean }): string[] {
  const problems: string[] = [];
  const lessonSlugs = new Set<string>();
  const exerciseIds = new Set<string>();
  const conceptSlugs = new Set<string>();
  for (const u of units) for (const ll of u.lessons) for (const c of ll.lesson.concepts) {
    if (conceptSlugs.has(c.slug)) problems.push(`${ll.file}: concepto repetido «${c.slug}»`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(c.slug)) problems.push(`${ll.file}: slug de concepto inválido «${c.slug}»`);
    conceptSlugs.add(c.slug);
  }
  for (const u of units) {
    for (const ll of u.lessons) {
      const L = ll.lesson;
      if (lessonSlugs.has(L.slug)) problems.push(`${ll.file}: slug de lección repetido «${L.slug}»`);
      lessonSlugs.add(L.slug);
      checkLesson(ll.file, L, problems);
      for (const e of L.exercises) {
        const where = `${ll.file} ${e.id}`;
        if (exerciseIds.has(e.id)) problems.push(`${where}: id de ejercicio repetido`);
        exerciseIds.add(e.id);
        if (e.concepts.length === 0) problems.push(`${where}: sin conceptos`);
        for (const c of e.concepts) if (!conceptSlugs.has(c)) problems.push(`${where}: concepto inexistente «${c}»`);
        checkExercise(where, e, problems);
        const k = ll.keys?.[e.id];
        if (!k) {
          if (opts.requireKeys) problems.push(`${where}: falta la clave en privado/claves/${ll.file}`);
          continue;
        }
        if (k.answer.format !== e.format) problems.push(`${where}: la clave es ${k.answer.format} pero el ejercicio es ${e.format}`);
        if (!k.explanation?.trim()) problems.push(`${where}: clave sin explicación`);
        if (!Array.isArray(k.hints) || k.hints.length === 0) problems.push(`${where}: clave sin pistas`);
        checkMarkdown(`${where} explicación`, k.explanation, problems);
        k.hints?.forEach((h, i) => checkMarkdown(`${where} pista ${i + 1}`, h, problems));
        const a = k.answer;
        if (a.format === 'choice') {
          const n = e.options?.length ?? 0;
          if (!a.correct.length || a.correct.some((i) => !Number.isInteger(i) || i < 0 || i >= n)) problems.push(`${where}: índices correctos fuera de rango`);
          if (!e.multiple && a.correct.length > 1) problems.push(`${where}: varias correctas pero multiple no está activado`);
          for (const idx of Object.keys(a.optionFeedback ?? {})) {
            if (a.correct.includes(Number(idx))) problems.push(`${where}: optionFeedback para una opción correcta (${idx})`);
          }
        } else if (a.format === 'numeric') {
          for (const err of validateNumericKey(a)) problems.push(`${where}: ${err}`);
        } else if (a.format === 'text') {
          if (!a.accepted.length) problems.push(`${where}: sin respuestas aceptadas`);
        } else if (a.format === 'truefalse') {
          if (!a.modelJustification?.trim()) problems.push(`${where}: sin justificación modelo`);
        } else if (a.format === 'open') {
          if (!a.rubric?.trim()) problems.push(`${where}: sin rúbrica`);
        }
      }
      for (const id of Object.keys(ll.keys ?? {})) {
        if (!L.exercises.some((e) => e.id === id)) problems.push(`${ll.file}: clave sobrante «${id}» sin ejercicio`);
      }
    }
  }
  return problems;
}
