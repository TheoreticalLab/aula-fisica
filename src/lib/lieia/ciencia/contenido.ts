/**
 * LIEIA · análisis científico del CONTENIDO de cada pregunta y clasificación multidimensional (capa A, determinista).
 * Todo es «a_priori»: sale del enunciado y de los metadatos del banco, nunca de respuestas. La confianza es cualitativa:
 *   alta  = dato explícito del banco (tipo, etapas, prerrequisitos, familia, validación dimensional)
 *   media = categoría o formato de la pregunta
 *   baja  = palabras clave del enunciado
 * La complejidad ALGEBRAICA (cuántas magnitudes y operaciones) se informa aparte de la exigencia COGNITIVA.
 */
import { COGNITIVAS, type Cognitiva, type Confianza, type Evidencia, type FuncionExamen, type Pregunta } from './modelo';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface AnalisisContenido {
  id: string; posicion: number;
  tema: string | null;
  conceptos: string[];
  prerrequisitos: string[];
  cognitivas: Evidencia<Cognitiva>[];
  pasos: Evidencia<number>;
  complejidadAlgebraica: Evidencia<'baja' | 'media' | 'alta'>;
  exigenciaCognitiva: Evidencia<'baja' | 'media' | 'alta'>;
  cargaLectura: { palabras: number; nivel: 'baja' | 'media' | 'alta' };
  dificultadAPriori: Evidencia<'basico' | 'intermedio' | 'desafiante'>;
  tiempoAPrioriMin: number;
  unidades: { declaradas: string | null; dimensional: string | null };
  funcionesExamen: Evidencia<FuncionExamen>[];
  advertencias: string[];
}

const REGLAS_TEXTO: { re: RegExp; cog: Cognitiva; ev: string }[] = [
  { re: /\b(estim|aproximad|orden de magnitud)/, cog: 'estimacion', ev: 'el enunciado pide una estimación' },
  { re: /\b(justifi|explique|explica|por que|argument)/, cog: 'pensamiento_critico', ev: 'el enunciado pide justificar o explicar' },
  { re: /\b(grafic|grafica|pendiente|area bajo)/, cog: 'interpretacion_graficas', ev: 'el enunciado se refiere a una gráfica' },
  { re: /\b(dimension|unidades? de|homogene)/, cog: 'analisis_dimensional', ev: 'el enunciado trata de dimensiones o unidades' },
  { re: /\b(suponga|supon|desprecie|ideal|sin friccion|hipotesis)/, cog: 'comprension_supuestos', ev: 'el enunciado declara supuestos del modelo' },
  { re: /\b(incorrect|falsa|error|contradic)/, cog: 'deteccion_contradicciones', ev: 'el enunciado pide encontrar un error o una afirmación falsa' },
  { re: /\b(defin|enuncie|cual es la unidad|se llama)/, cog: 'memorizacion', ev: 'el enunciado pide una definición o un nombre' },
  { re: /\b(predig|que pasaria|que ocurriria|si se duplica)/, cog: 'razonamiento_fisico', ev: 'el enunciado pide predecir el efecto de un cambio' },
  { re: /\b(por lo tanto|se deduce|implica|si y solo si)/, cog: 'deduccion_logica', ev: 'el enunciado plantea una deducción' },
];

function ev<T>(valor: T, confianza: Confianza, evidencia: string, alternativas?: T[]): Evidencia<T> {
  return { valor, procedencia: 'a_priori', confianza, evidencia, alternativas };
}

/** Números con o sin unidades en el enunciado (una señal de carga algebraica, no de dificultad). */
const numeros = (t: string) => (t.match(/-?\d+(?:[.,]\d+)?(?:\s*[×x]\s*10\^?-?\d+)?/g) ?? []).length;

export function analizarContenido(p: Pregunta): AnalisisContenido {
  const m = p.meta ?? null;
  const t = sinTildes(p.prompt);
  const cog = new Map<Cognitiva, Evidencia<Cognitiva>>();
  const add = (c: Cognitiva, conf: Confianza, e: string) => { const prev = cog.get(c); if (!prev || rango(conf) > rango(prev.confianza)) cog.set(c, ev(c, conf, e)); };

  // 1) metadatos del banco (alta)
  if (m) {
    const porTipo: Partial<Record<string, Cognitiva[]>> = {
      calculo: ['aplicacion_directa'], conceptual: ['comprension_conceptual'], afirmacion_incorrecta: ['deteccion_contradicciones', 'comprension_conceptual'],
      grafica: ['interpretacion_graficas'], simulacion: ['interpretacion', 'modelizacion'], encadenada: ['resolucion_multietapa'],
      prediccion: ['razonamiento_fisico', 'modelizacion'], esperado_observado: ['interpretacion', 'pensamiento_critico'],
      info_insuficiente: ['comprension_supuestos', 'pensamiento_critico'], dimensional: ['analisis_dimensional'],
    };
    for (const c of porTipo[m.tipo] ?? []) add(c, 'alta', `tipo del banco: «${m.tipo}»`);
    if (m.etapas >= 2) { add('resolucion_multietapa', 'alta', `${m.etapas} etapas de razonamiento declaradas en el banco`); add('razonamiento_matematico', 'media', 'varias etapas encadenadas de cálculo'); }
    if (m.unidadesPrevias?.length) add('transferencia', 'alta', `aplica contenido de unidades anteriores (${m.unidadesPrevias.join(', ')})`);
    if (m.dimensional) add('analisis_dimensional', 'media', 'el banco incluye la validación dimensional de la respuesta');
  }
  // 2) categoría y formato (media)
  const porCategoria: Record<string, Cognitiva[]> = {
    conceptual: ['comprension_conceptual'], numerica: ['aplicacion_directa'], grafica: ['interpretacion_graficas'], error: ['deteccion_contradicciones'],
    vf_justificacion: ['razonamiento_fisico', 'pensamiento_critico'], desarrollo: ['resolucion_multietapa', 'razonamiento_fisico'],
    experimento: ['interpretacion', 'modelizacion'], seleccion: ['comprension_conceptual'],
  };
  for (const c of porCategoria[p.category] ?? []) add(c, 'media', `categoría de la pregunta: «${p.category}»`);
  // 3) palabras del enunciado (baja)
  for (const r of REGLAS_TEXTO) if (r.re.test(t)) add(r.cog, 'baja', r.ev);
  if (!cog.size) add(p.format === 'numeric' ? 'aplicacion_directa' : 'comprension_conceptual', 'baja', 'sin otra evidencia: se deduce solo del formato');

  // pasos y complejidad algebraica (distintas de la exigencia cognitiva)
  const nNum = numeros(p.prompt);
  const pasos = m?.etapas ? ev(m.etapas, 'alta', 'etapas declaradas en el banco')
    : ev(Math.max(1, p.format === 'numeric' ? Math.min(4, Math.ceil(nNum / 2)) : 1), 'baja', `estimado por ${nNum} dato(s) numérico(s) en el enunciado`);
  const datos = m?.datos?.length ?? nNum;
  const alg = datos >= 5 || pasos.valor >= 3 ? 'alta' : datos >= 3 || pasos.valor === 2 ? 'media' : 'baja';
  const complejidadAlgebraica = ev(alg as 'baja' | 'media' | 'alta', m ? 'media' : 'baja', `${datos} dato(s) y ${pasos.valor} paso(s): mide manipulación, no comprensión`);
  const altas: Cognitiva[] = ['transferencia', 'modelizacion', 'pensamiento_critico', 'comprension_supuestos', 'deteccion_contradicciones', 'resolucion_multietapa'];
  const medias: Cognitiva[] = ['razonamiento_fisico', 'interpretacion', 'interpretacion_graficas', 'razonamiento_matematico', 'deduccion_logica', 'analisis_dimensional', 'estimacion'];
  const ks = [...cog.keys()];
  const nivel = ks.some((k) => altas.includes(k)) ? 'alta' : ks.some((k) => medias.includes(k)) ? 'media' : 'baja';
  const exigenciaCognitiva = ev(nivel as 'baja' | 'media' | 'alta', [...cog.values()].some((x) => x.confianza === 'alta') ? 'media' : 'baja',
    `según las habilidades propuestas: ${ks.map((k) => COGNITIVAS[k]).join(', ')}`);

  const palabras = p.prompt.split(/\s+/).filter(Boolean).length;
  const cargaLectura = { palabras, nivel: (palabras > 90 ? 'alta' : palabras > 45 ? 'media' : 'baja') as 'baja' | 'media' | 'alta' };
  const dificultadAPriori = ev(p.difficulty, 'media', 'dificultad asignada por el autor (no calibrada con respuestas)',
    (['basico', 'intermedio', 'desafiante'] as const).filter((d) => d !== p.difficulty));
  const tiempoAPrioriMin = (p.format === 'choice' || p.format === 'truefalse' ? 1.5 : p.format === 'numeric' ? 3 : 6) + Math.max(0, pasos.valor - 1) * 1.5 + (cargaLectura.nivel === 'alta' ? 1 : 0);

  const funcionesExamen: Evidencia<FuncionExamen>[] = [];
  if (p.difficulty === 'basico') funcionesExamen.push(ev('introductoria', 'media', 'dificultad del autor: básica'));
  if (p.difficulty === 'intermedio') funcionesExamen.push(ev('intermedia', 'media', 'dificultad del autor: intermedia'));
  if (p.difficulty === 'desafiante' || nivel === 'alta') funcionesExamen.push(ev('alta_exigencia', 'media', 'dificultad desafiante o exigencia cognitiva alta'));
  if ((m?.unidadesPrevias?.length ?? 0) > 0 || (m?.previos?.length ?? 0) >= 2) funcionesExamen.push(ev('enlace', 'media', 'combina contenidos de varias unidades o conceptos previos'));

  const advertencias: string[] = [];
  if (p.format === 'numeric' && !p.unit_hint && !m?.dimensional) advertencias.push('Pregunta numérica sin unidad indicada: posible ambigüedad en la respuesta.');
  if (p.format === 'choice' && (p.opciones ?? 0) < 3) advertencias.push('Selección con menos de 3 opciones: el acierto por azar es alto.');
  if (p.format === 'truefalse') advertencias.push('Verdadero/falso: 50 % de acierto por azar; mide poco por sí sola.');
  if (cargaLectura.nivel === 'alta') advertencias.push(`Enunciado largo (${palabras} palabras): la lectura puede influir en el resultado.`);
  if (!p.concepts.length && !m?.tema) advertencias.push('Sin conceptos asociados: no puede relacionarse con otras preguntas por contenido.');

  return {
    id: p.id, posicion: p.posicion, tema: m?.tema ?? null, conceptos: [...new Set(p.concepts)], prerrequisitos: m?.previos ?? [],
    cognitivas: [...cog.values()].sort((a, b) => rango(b.confianza) - rango(a.confianza)), pasos, complejidadAlgebraica, exigenciaCognitiva,
    cargaLectura, dificultadAPriori, tiempoAPrioriMin, unidades: { declaradas: p.unit_hint, dimensional: m?.dimensional ?? null }, funcionesExamen, advertencias,
  };
}

const rango = (c: Confianza) => (c === 'alta' ? 3 : c === 'media' ? 2 : 1);

/** Correcciones del profesor: sustituyen la propuesta y quedan marcadas como revisadas (procedencia docente). */
export interface Revision { id: string; cognitivas?: Cognitiva[]; dificultad?: 'basico' | 'intermedio' | 'desafiante' }
export function aplicarRevision(a: AnalisisContenido, r: Revision | undefined): AnalisisContenido & { revisada: boolean } {
  if (!r) return { ...a, revisada: false };
  return {
    ...a, revisada: true,
    cognitivas: r.cognitivas ? r.cognitivas.map((c) => ({ valor: c, procedencia: 'a_priori' as const, confianza: 'alta' as const, evidencia: 'revisada por el profesor' })) : a.cognitivas,
    dificultadAPriori: r.dificultad ? { ...a.dificultadAPriori, valor: r.dificultad, confianza: 'alta', evidencia: 'revisada por el profesor' } : a.dificultadAPriori,
  };
}
