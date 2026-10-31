/**
 * Validación de una biblioteca académica. No basta con que «compile»: comprueba la estructura pedagógica
 * obligatoria, el LaTeX, cada clave con el MISMO motor que califica en el servidor y, en los numéricos,
 * una comprobación física independiente (`verificar`) que recalcula el resultado desde los datos.
 */
import { grade, parseQuantity, validateNumericKey } from '../../supabase/functions/_shared/calificacion/calificar';
import { sameDims, toSI } from '../../supabase/functions/_shared/calificacion/unidades';
import type { ExerciseDef } from '../../contenido/tipos';
import { checkExercise, checkMarkdown, checkSimRef, checkTex } from '../validar-contenido';
import { evaluarExpresion } from '../../supabase/functions/_shared/calificacion/arrastre';
import type { BibliotecaCargada } from './cargar';
import { FAMILIAS, TIPOS_PREGUNTA, type EjercicioBiblioteca, type MiniCapitulo } from './tipos';

/** Secciones «## …» obligatorias en la teoría (B–E). Se comparan sin tildes ni mayúsculas. */
export const SECCIONES_TEORIA = ['introduccion', 'explicacion conceptual', 'desarrollo matematico', 'interpretacion'];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Valor SI de una cantidad escrita como en una clave («29.7 m/s», «-4.9 m»…). */
export function valorSI(texto: string): number {
  const p = parseQuantity(texto);
  if (!p.ok) throw new Error(`no se puede leer «${texto}»: ${p.message}`);
  return toSI(p.q.value, p.q.unit);
}

/** Tolerancia de la comprobación independiente: mucho más estricta que la de calificación. */
export const TOL_VERIFICACION = 0.005;

export function validarEjercicio(where: string, e: EjercicioBiblioteca, conceptos: Set<string>, p: string[]) {
  checkExercise(where, { ...e, role: e.role ?? 'practice' } as ExerciseDef, p);
  for (const c of e.concepts) if (!conceptos.has(c)) p.push(`${where}: concepto desconocido «${c}»`);
  const k = e.clave;
  if (k.answer.format !== e.format) p.push(`${where}: el formato de la clave (${k.answer.format}) no coincide con el del ejercicio (${e.format})`);
  if (!k.hints.length) p.push(`${where}: sin pistas`);
  if (!k.explanation.trim()) p.push(`${where}: sin explicación`);
  k.hints.forEach((h, i) => checkMarkdown(`${where} pista ${i + 1}`, h, p));
  checkMarkdown(`${where} explicación`, k.explanation, p);
  const a = k.answer;
  if (a.format === 'choice') {
    const n = e.options?.length ?? 0;
    if (!a.correct.length || a.correct.some((i) => i < 0 || i >= n)) p.push(`${where}: índice correcto fuera de rango`);
    else if (grade(a, { selected: a.correct }, n).status !== 'correct') p.push(`${where}: la opción correcta no se califica como correcta`);
    for (const i of Object.keys(a.optionFeedback ?? {}).map(Number)) {
      if (a.correct.includes(i)) p.push(`${where}: retroalimentación de error en una opción correcta (${i})`);
      if (i < 0 || i >= n) p.push(`${where}: retroalimentación para una opción inexistente (${i})`);
    }
    const sinComentario = Array.from({ length: n }, (_, i) => i).filter((i) => !a.correct.includes(i) && !a.optionFeedback?.[i]);
    if (sinComentario.length) p.push(`${where}: opciones incorrectas sin retroalimentación: ${sinComentario.join(', ')}`);
  } else if (a.format === 'numeric') {
    for (const m of validateNumericKey(a)) p.push(`${where}: ${m}`);
    // ángulos: la tolerancia debe ser ABSOLUTA (≈1°); una relativa crece con el ángulo y no tiene sentido físico
    const pq = parseQuantity(a.value);
    if (pq.ok && /°|grado|deg/.test(pq.q.unitText)) {
      if ((a.relTol ?? 0.02) > 0 || !a.absTol || a.absTol < 0.005 || a.absTol > 0.06) {
        p.push(`${where}: respuesta en grados: use relTol: 0 y absTol en radianes (p. ej. 0.0175 ≈ 1°)`);
      }
    }
    for (const v of [a.value, ...(a.alternatives ?? [])]) {
      const r = grade(a, { text: v });
      if (r.status !== 'correct') p.push(`${where}: «${v}» debería ser correcta y sale ${r.status}`);
    }
    const dimClave = pq.ok ? pq.q.unit.dims : null;
    for (const ce of a.commonErrors ?? []) {
      if (grade(a, { text: ce.value }).status === 'correct') p.push(`${where}: el error típico «${ce.value}» cae dentro de la tolerancia`);
      // el motor solo compara errores típicos de la MISMA dimensión que la clave: uno de otra dimensión nunca se mostraría
      const pce = parseQuantity(ce.value);
      if (!pce.ok) p.push(`${where}: error típico ilegible «${ce.value}»`);
      else if (dimClave && !sameDims(pce.q.unit.dims, dimClave)) p.push(`${where}: el error típico «${ce.value}» tiene otra dimensión que la clave y nunca se activaría`);
    }
    if (!e.verificar) p.push(`${where}: numérico sin comprobación independiente (verificar)`);
    else {
      try {
        const esperado = valorSI(a.value);
        const calculado = e.verificar();
        const rel = Math.abs(calculado - esperado) / Math.max(Math.abs(esperado), 1e-12);
        if (!Number.isFinite(calculado) || rel > TOL_VERIFICACION) {
          p.push(`${where}: la clave «${a.value}» (${esperado.toPrecision(6)} SI) no coincide con la comprobación independiente (${calculado.toPrecision(6)} SI)`);
        }
      } catch (err) {
        p.push(`${where}: ${(err as Error).message}`);
      }
    }
  } else if (a.format === 'truefalse') {
    if (!a.modelJustification.trim()) p.push(`${where}: verdadero/falso sin justificación modelo`);
  }
}

const CHOQUES = ['elastico', 'totalmente_inelastico', 'parcialmente_inelastico', 'rebote', 'general', 'ninguno'];

/** Metadatos del banco (unidades con `banco: true`): completos, coherentes y sin la respuesta. */
export function validarMeta(where: string, e: EjercicioBiblioteca, conceptos: Set<string>, p: string[]) {
  const m = e.meta;
  if (!m) { p.push(`${where}: falta meta (unidad con banco de ejercicios)`); return; }
  if (!m.tema?.trim()) p.push(`${where}: meta sin tema`);
  if (!m.previos?.length) p.push(`${where}: meta sin conceptos previos`);
  for (const c of m.previos ?? []) if (!conceptos.has(c)) p.push(`${where}: concepto previo desconocido «${c}»`);
  if (!m.datos?.length && m.tipo !== 'info_insuficiente' && e.format === 'numeric') p.push(`${where}: meta sin datos explícitos`);
  if (!m.solicitado?.length) p.push(`${where}: meta sin magnitudes solicitadas`);
  if (!(m.tipo in TIPOS_PREGUNTA)) p.push(`${where}: tipo de pregunta desconocido «${m.tipo}»`);
  if (!CHOQUES.includes(m.choque)) p.push(`${where}: tipo de choque desconocido «${m.choque}»`);
  if (!Number.isInteger(m.etapas) || m.etapas < 1 || m.etapas > 7) p.push(`${where}: etapas debe ser un entero entre 1 y 7`);
  if (m.familia && !(m.familia in FAMILIAS)) p.push(`${where}: familia desconocida «${m.familia}»`);
  if (e.format === 'numeric' && !m.dimensional?.trim()) p.push(`${where}: numérico sin validación dimensional en meta`);
  if (m.tipo === 'grafica' && !e.figure) p.push(`${where}: pregunta de gráfica sin figura`);
  if ((m.tipo === 'simulacion' || m.tipo === 'prediccion') && !e.simulation) p.push(`${where}: pregunta de simulación sin simulación`);
  if (m.tipo === 'encadenada' && !m.problema) p.push(`${where}: pregunta encadenada sin problema/etapa`);
  for (const q of m.parametros ?? []) {
    if (!(q.min <= q.valor && q.valor <= q.max)) p.push(`${where}: parámetro «${q.nombre}» fuera de su rango`);
  }
  // la respuesta no debe colarse en los metadatos (los lee el profesorado, pero no son el lugar de la clave)
  if (e.clave.answer.format === 'numeric') {
    const texto = JSON.stringify(m);
    if (texto.includes(e.clave.answer.value)) p.push(`${where}: meta contiene el valor de la respuesta`);
  }
}

/** Cadenas de etapas y arrastre: orden 1..n dentro del minicapítulo y expresiones coherentes con las claves. */
export function validarCadenas(where: string, m: MiniCapitulo, p: string[]) {
  const pos = new Map(m.ejercicios.map((e, i) => [e.id, i]));
  const cadenas = new Map<string, EjercicioBiblioteca[]>();
  for (const e of m.ejercicios) if (e.meta?.problema) {
    const l = cadenas.get(e.meta.problema.id) ?? [];
    l.push(e);
    cadenas.set(e.meta.problema.id, l);
  }
  for (const [id, l] of cadenas) {
    const total = l[0].meta!.problema!.total;
    if (l.length !== total || l.some((e, i) => e.meta!.problema!.etapa !== i + 1 || e.meta!.problema!.total !== total)) {
      p.push(`${where}: el problema por etapas «${id}» no tiene las etapas 1..${total} en orden`);
    }
    const idx = l.map((e) => pos.get(e.id)!);
    if (idx.some((v, i) => i > 0 && v !== idx[i - 1] + 1)) p.push(`${where}: las etapas del problema «${id}» deben ser consecutivas`);
  }
  for (const e of m.ejercicios) {
    const a = e.clave.answer;
    if (a.format !== 'numeric' || !a.arrastre) continue;
    const w = `${where} ${e.id}`;
    const src = m.ejercicios.find((x) => x.id === a.arrastre!.desde);
    if (!src) { p.push(`${w}: arrastre desde un ejercicio inexistente en este minicapítulo («${a.arrastre.desde}»)`); continue; }
    if (pos.get(src.id)! >= pos.get(e.id)!) p.push(`${w}: el arrastre debe venir de una etapa ANTERIOR`);
    if (src.clave.answer.format !== 'numeric') { p.push(`${w}: el arrastre debe venir de una etapa numérica`); continue; }
    try {
      const x = valorSI(src.clave.answer.value);
      const v = evaluarExpresion(a.arrastre.expresion, x);
      const k = valorSI(a.value);
      if (!Number.isFinite(v) || Math.abs(v - k) / Math.max(Math.abs(k), 1e-12) > TOL_VERIFICACION) {
        p.push(`${w}: la expresión de arrastre con el valor correcto de la etapa anterior da ${v.toPrecision(6)} y la clave es ${k.toPrecision(6)} (SI)`);
      }
    } catch (err) {
      p.push(`${w}: ${(err as Error).message}`);
    }
  }
}

export function validarMini(where: string, m: MiniCapitulo, conceptos: Set<string>, p: string[]) {
  if (!/^[a-z0-9-]+$/.test(m.slug)) p.push(`${where}: slug inválido «${m.slug}»`);
  if (!m.titulo.trim() || !m.resumen.trim()) p.push(`${where}: falta título o resumen`);
  if (m.objetivos.length < (m.integradora ? 1 : 2)) p.push(`${where}: A. objetivos insuficientes`);
  checkMarkdown(`${where} teoría`, m.teoria, p);
  m.objetivos.forEach((o, i) => checkMarkdown(`${where} objetivo ${i + 1}`, o, p));
  if (!m.integradora) {
    const titulos = m.teoria.split('\n').filter((l) => /^##\s/.test(l)).map((l) => norm(l.replace(/^##\s+/, '')));
    for (const s of SECCIONES_TEORIA) {
      if (!titulos.some((t) => t.includes(s))) p.push(`${where}: a la teoría le falta la sección «## ${s}»`);
    }
    if (m.ejemplos.length < 1) p.push(`${where}: F. sin ejemplo resuelto`);
    if (m.errores.length < 2) p.push(`${where}: G. menos de 2 errores frecuentes`);
    if (m.preguntas.length < 2) p.push(`${where}: H. menos de 2 preguntas conceptuales`);
    if (m.autoevaluacion.length < 2) p.push(`${where}: J. menos de 2 preguntas de autoevaluación`);
    if (!m.conexiones.trim()) p.push(`${where}: K. sin conexiones`);
  }
  m.formulas.forEach((f, i) => {
    checkTex(`${where} fórmula ${i + 1}`, f.latex, p);
    f.variables.forEach((v) => checkTex(`${where} fórmula ${i + 1} variable`, v.symbol, p));
    checkMarkdown(`${where} fórmula ${i + 1}`, f.description, p);
    checkMarkdown(`${where} fórmula ${i + 1} notas`, f.notes, p);
  });
  m.ejemplos.forEach((ex, i) => {
    const w = `${where} ejemplo ${i + 1}`;
    if (ex.steps.length < 2) p.push(`${w}: menos de 2 pasos`);
    [ex.statement, ...ex.steps, ex.result, ex.interpretation].forEach((t) => checkMarkdown(w, t, p));
  });
  m.errores.forEach((e, i) => { checkMarkdown(`${where} error ${i + 1}`, e.error, p); checkMarkdown(`${where} error ${i + 1}`, e.aclaracion, p); });
  m.preguntas.forEach((q, i) => { checkMarkdown(`${where} pregunta ${i + 1}`, q.pregunta, p); checkMarkdown(`${where} pregunta ${i + 1}`, q.respuesta, p); });
  m.autoevaluacion.forEach((q, i) => {
    const w = `${where} autoevaluación ${i + 1}`;
    if (q.opciones.length < 2 || q.correcta < 0 || q.correcta >= q.opciones.length) p.push(`${w}: opciones o respuesta inválidas`);
    [q.pregunta, q.explicacion, ...q.opciones].forEach((t) => checkMarkdown(w, t, p));
  });
  checkMarkdown(`${where} conexiones`, m.conexiones, p);
  if (m.simulacion) {
    checkSimRef(`${where} simulación`, m.simulacion.key, m.simulacion.params, p);
    checkMarkdown(`${where} guía`, m.simulacion.guide, p);
  }
  const practica = m.ejercicios.filter((e) => (e.role ?? 'practice') === 'practice');
  const n = (d: string) => practica.filter((e) => e.difficulty === d).length;
  if (m.integradora) {
    if (practica.length < 6 || n('desafiante') < 1) p.push(`${where}: la práctica integradora necesita al menos 6 ejercicios y 1 difícil`);
  } else if (n('basico') !== 3 || n('intermedio') !== 2 || n('desafiante') !== 1) {
    p.push(`${where}: I. la práctica debe tener 3 fáciles, 2 intermedios y 1 difícil (tiene ${n('basico')}/${n('intermedio')}/${n('desafiante')})`);
  }
  m.ejercicios.forEach((e) => validarEjercicio(`${where} ${e.id}`, e, conceptos, p));
}

export function validarBiblioteca(b: BibliotecaCargada): string[] {
  const p: string[] = [];
  const conceptos = new Set<string>();
  const slugs = new Set<string>();
  const ids = new Set<string>();
  for (const u of b.unidades) for (const { mini } of u.minis) for (const c of mini.conceptos) {
    if (conceptos.has(c.slug)) p.push(`concepto repetido «${c.slug}»`);
    conceptos.add(c.slug);
  }
  if (!b.curso.instancias.length) p.push('el curso no tiene asignaturas (instancias)');
  if (b.curso.objetivos.length < 2) p.push('el curso necesita objetivos generales');
  checkMarkdown('presentación', b.curso.presentacion, p);
  for (const u of b.unidades) {
    if (!['borrador', 'preparado', 'publicado', 'archivado'].includes(u.meta.estadoInicial)) p.push(`${u.carpeta}: estado inicial inválido`);
    if (!u.minis.length) p.push(`${u.carpeta}: unidad sin minicapítulos`);
    if (!u.minis.some((x) => x.mini.integradora)) p.push(`${u.carpeta}: falta la práctica integradora de la unidad`);
    for (const { archivo, mini } of u.minis) {
      const w = `${u.carpeta}/${archivo}`;
      if (slugs.has(mini.slug)) p.push(`${w}: slug repetido «${mini.slug}»`);
      slugs.add(mini.slug);
      for (const e of mini.ejercicios) {
        if (ids.has(e.id)) p.push(`${w}: id de ejercicio repetido «${e.id}»`);
        ids.add(e.id);
      }
      validarMini(w, mini, conceptos, p);
      validarCadenas(w, mini, p);
      if (u.meta.banco) for (const e of mini.ejercicios) validarMeta(`${w} ${e.id}`, e, conceptos, p);
    }
  }
  return p;
}
