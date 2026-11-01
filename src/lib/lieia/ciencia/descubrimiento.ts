/**
 * LIEIA · motor de descubrimiento: «¿Qué puedo investigar con este examen?».
 * Combina un catálogo de líneas de investigación con reglas estadísticas sobre los datos REALES disponibles y con el
 * grafo de relaciones. Cada propuesta es una FICHA con hipótesis comprobable, variables, método, datos disponibles y
 * faltantes, limitaciones y estado de factibilidad. Un «resultado» solo aparece si se calculó aquí con datos reales.
 * Nada de esto es una conclusión: son hipótesis y diseños para contrastarlas. Ninguna ficha atribuye conductas a personas.
 */
import { normalCdf } from '../estadistica';
import { COGNITIVAS, MINIMOS, type Cognitiva } from './modelo';
import type { AnalisisContenido } from './contenido';
import type { ExamenEmpirico, ItemEmpirico, Matriz } from './psicometria';
import { redundancia, type Arista } from './relaciones';

export type Linea = 'correlaciones' | 'dependencias' | 'errores' | 'redundancia' | 'omisiones' | 'ayuda_externa' | 'estabilidad' | 'construccion' | 'abierta';
export type Estado = 'analizable' | 'datos_insuficientes' | 'requiere_nueva_evaluacion';
export type ModoDiseno = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'H' | 'I' | 'J' | 'L' | 'N' | 'O' | 'Q';

export interface Ficha {
  id: string; linea: Linea; titulo: string; pregunta: string; hipotesis: string; variables: string[]; metodo: string; tipoEstudio: string;
  disponibles: string[]; faltantes: string[]; limitaciones: string[]; estado: Estado;
  resultado: string | null;                 // solo si se calculó con datos reales
  items: string[]; modo: ModoDiseno | null; prioridad: number; porQue: string;
}

export const LINEAS: Record<Linea, string> = {
  correlaciones: 'Relaciones entre habilidades', dependencias: 'Dependencias conceptuales', errores: 'Errores sistemáticos', redundancia: 'Redundancia',
  omisiones: 'Omisiones', ayuda_externa: 'Asistencia externa (diseño prospectivo)', estabilidad: 'Estabilidad del aprendizaje', construccion: 'Construcción del examen',
  abierta: 'Descubrimiento abierto',
};
export const ESTADOS: Record<Estado, string> = { analizable: 'Analizable con los datos actuales', datos_insuficientes: 'Datos insuficientes', requiere_nueva_evaluacion: 'Requiere una nueva evaluación' };

export interface Contexto { analisis: AnalisisContenido[]; items: Map<string, ItemEmpirico>; examen: ExamenEmpirico | null; matriz: Matriz | null; aristas: Arista[]; etiqueta: (id: string) => string; ordenAleatorio: boolean }

const pct = (v: number) => `${(100 * v).toFixed(0)} %`;
const NO_CAUSA = 'Es un análisis observacional: una asociación no demuestra causalidad.';
const MISMO_EXAMEN = 'Si la hipótesis surgió de estos mismos datos, confirmarla con ellos reutiliza la información: debe contrastarse en otra aplicación.';

/** Diferencia de proporciones con IC 95 % (Wald) y prueba z; null si falta muestra. */
function difProp(x1: number, n1: number, x2: number, n2: number): { d: number; ic: [number, number]; p: number } | null {
  if (n1 < MINIMOS.item || n2 < MINIMOS.item) return null;
  const p1 = x1 / n1, p2 = x2 / n2, d = p1 - p2, se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const pp = (x1 + x2) / (n1 + n2), se0 = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2));
  return { d, ic: [d - 1.96 * se, d + 1.96 * se], p: se0 > 0 ? 2 * (1 - normalCdf(Math.abs(d) / se0)) : 1 };
}

/** Éxito en B según el resultado en A (solo estudiantes con ambas calificadas). */
function condicional(m: Matriz, a: string, b: string) {
  const ia = m.items.indexOf(a), ib = m.items.indexOf(b);
  let x1 = 0, n1 = 0, x2 = 0, n2 = 0;
  for (const f of m.x) {
    const ca = f[ia], cb = f[ib];
    if ((ca !== 0 && ca !== 1) || (cb !== 0 && cb !== 1)) continue;
    if (ca === 1) { n1++; x1 += cb; } else { n2++; x2 += cb; }
  }
  return { x1, n1, x2, n2, r: difProp(x1, n1, x2, n2) };
}

/** Subpuntuación de un grupo de preguntas por estudiante (proporción de aciertos entre las calificadas). */
function subpuntuacion(m: Matriz, ids: string[]): (number | null)[] {
  const js = ids.map((id) => m.items.indexOf(id)).filter((j) => j >= 0);
  return m.x.map((f) => { const v = js.map((j) => f[j]).filter((c): c is 0 | 1 => c === 0 || c === 1); return v.length ? v.reduce<number>((s, c) => s + c, 0) / v.length : null; });
}
function corr(a: (number | null)[], b: (number | null)[]): { r: number; n: number } | null {
  const pares = a.map((v, i) => [v, b[i]] as const).filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);
  if (pares.length < MINIMOS.correlacion) return null;
  const mx = pares.reduce((s, p) => s + p[0], 0) / pares.length, my = pares.reduce((s, p) => s + p[1], 0) / pares.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pares) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx > 0 && syy > 0 ? { r: sxy / Math.sqrt(sxx * syy), n: pares.length } : null;
}
/** IC 95 % de una correlación por la transformación de Fisher. */
function icFisher(r: number, n: number): [number, number] {
  const z = Math.atanh(Math.max(-0.999, Math.min(0.999, r))), se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
}

export function descubrir(ctx: Contexto): Ficha[] {
  const out: Ficha[] = [];
  const { analisis, items, examen, matriz: m, aristas, etiqueta: E } = ctx;
  const N = examen?.n ?? 0;
  const conDatos = (x: string) => (N ? `${N} estudiantes con el examen entregado${x}` : 'ningún estudiante ha entregado este examen');
  const tiene = (c: Cognitiva) => analisis.filter((a) => a.cognitivas.some((x) => x.valor === c)).map((a) => a.id);

  // 1) dependencias conceptuales (prerrequisitos teóricos) → asociación empírica condicional
  for (const ar of aristas.filter((x) => x.tipo === 'prerrequisito').slice(0, 4)) {
    const c = m ? condicional(m, ar.a, ar.b) : null;
    const ok = c?.r;
    out.push({
      id: `dep:${ar.a}:${ar.b}`, linea: 'dependencias', titulo: `¿Dominar ${E(ar.a)} se asocia con acertar ${E(ar.b)}?`,
      pregunta: `¿El éxito en ${E(ar.b)} es más frecuente entre quienes aciertan ${E(ar.a)}?`, hipotesis: `P(acierto en ${E(ar.b)} | acierto en ${E(ar.a)}) > P(acierto en ${E(ar.b)} | fallo en ${E(ar.a)})`,
      variables: [`acierto en ${E(ar.a)}`, `acierto en ${E(ar.b)}`], metodo: 'Comparación de proporciones condicionadas (tabla 2×2) con IC 95 %', tipoEstudio: 'Observacional (asociación)',
      disponibles: [conDatos(''), `relación teórica: ${ar.explicacion}`],
      faltantes: ok ? [] : [`al menos ${MINIMOS.item} estudiantes en cada grupo (aciertan / fallan ${E(ar.a)}); ahora: ${c ? `${c.n1} y ${c.n2}` : 0}`],
      limitaciones: [NO_CAUSA, 'Una sola pregunta por concepto mide el dominio con mucho error.', 'La dependencia teórica viene de los metadatos del banco; la empírica, de este grupo.'],
      estado: ok ? 'analizable' : N ? 'datos_insuficientes' : 'requiere_nueva_evaluacion',
      resultado: ok ? `Aciertan ${E(ar.b)}: ${pct(c!.x1 / c!.n1)} de quienes aciertan ${E(ar.a)} (n = ${c!.n1}) frente a ${pct(c!.x2 / c!.n2)} de quienes la fallan (n = ${c!.n2}); diferencia ${pct(ok.d)} [IC 95 %: ${pct(ok.ic[0])}, ${pct(ok.ic[1])}], p = ${ok.p.toFixed(3)} (sin corregir).` : null,
      items: [ar.a, ar.b], modo: 'D', prioridad: (ok ? 3 : 1) + 1, porQue: 'Hay una dependencia conceptual declarada que nunca se ha comprobado con respuestas.',
    });
  }

  // 2) comprensión conceptual frente a cálculo
  const concept = tiene('comprension_conceptual'), calculo = [...new Set([...tiene('aplicacion_directa'), ...tiene('razonamiento_matematico')])].filter((x) => !concept.includes(x));
  if (concept.length >= 2 && calculo.length >= 2) {
    const c = m ? corr(subpuntuacion(m, concept), subpuntuacion(m, calculo)) : null;
    out.push({
      id: 'cor:conceptual-calculo', linea: 'correlaciones', titulo: 'Relación entre comprensión conceptual y resolución matemática',
      pregunta: '¿El desempeño en preguntas conceptuales se asocia con el desempeño en preguntas de cálculo?', hipotesis: 'Existe una asociación positiva entre ambas subpuntuaciones.',
      variables: [`subpuntuación conceptual (${concept.length} preguntas)`, `subpuntuación de cálculo (${calculo.length} preguntas)`], metodo: 'Correlación de Pearson entre subpuntuaciones con IC 95 % (Fisher)',
      tipoEstudio: 'Correlacional', disponibles: [conDatos(''), `preguntas conceptuales: ${concept.map(E).join(', ')}`, `de cálculo: ${calculo.map(E).join(', ')}`],
      faltantes: c ? [] : [`al menos ${MINIMOS.correlacion} estudiantes con ambas subpuntuaciones (ahora ${N})`],
      limitaciones: [NO_CAUSA, 'Con pocas preguntas por grupo, la correlación se atenúa por error de medida.', 'La clasificación de las preguntas es a priori (revísela).'],
      estado: c ? 'analizable' : N ? 'datos_insuficientes' : 'requiere_nueva_evaluacion',
      resultado: c ? `r = ${c.r.toFixed(2)} [IC 95 %: ${icFisher(c.r, c.n).map((v) => v.toFixed(2)).join(', ')}], n = ${c.n}.` : null,
      items: [...concept, ...calculo], modo: 'H', prioridad: (c ? 3 : 1) + 1, porQue: 'El examen mezcla preguntas conceptuales y de cálculo: permite distinguir dominio procedimental y comprensión.',
    });
  } else {
    out.push({
      id: 'cor:conceptual-calculo', linea: 'correlaciones', titulo: 'Relación entre comprensión conceptual y resolución matemática',
      pregunta: '¿El desempeño conceptual se asocia con el de cálculo?', hipotesis: 'Asociación positiva entre ambas dimensiones.', variables: ['subpuntuación conceptual', 'subpuntuación de cálculo'],
      metodo: 'Correlación entre subpuntuaciones', tipoEstudio: 'Correlacional', disponibles: [`preguntas conceptuales: ${concept.length}; de cálculo: ${calculo.length}`],
      faltantes: ['al menos 2 preguntas de cada tipo en el mismo examen'], limitaciones: [NO_CAUSA], estado: 'requiere_nueva_evaluacion', resultado: null, items: [], modo: 'H', prioridad: 1.5,
      porQue: 'Este examen no tiene preguntas suficientes de ambos tipos; un examen correlacional lo permitiría.',
    });
  }

  // 3) errores sistemáticos (la misma respuesta incorrecta repetida)
  for (const a of analisis) {
    const it = items.get(a.id);
    if (!it?.erroresFrecuentes.length) continue;
    const e = it.erroresFrecuentes[0];
    out.push({
      id: `err:${a.id}`, linea: 'errores', titulo: `Respuesta incorrecta repetida en ${E(a.id)}`,
      pregunta: `¿La respuesta incorrecta más frecuente de ${E(a.id)} refleja una concepción errónea concreta?`, hipotesis: 'Los errores no se reparten al azar: una misma idea equivocada produce la misma respuesta.',
      variables: ['respuesta incorrecta (huella anónima)', 'acierto en preguntas del mismo concepto'], metodo: 'Análisis de distractores / respuestas incorrectas; contraste con preguntas que separen explicaciones alternativas',
      tipoEstudio: 'Descriptivo, con diseño prospectivo para contrastar', disponibles: [`${e.veces} de ${e.deIncorrectas} respuestas incorrectas son idénticas`],
      faltantes: ['saber qué idea errónea produce esa respuesta (revise la respuesta en «Revisión manual» o en el informe de la pregunta)', 'preguntas que distingan entre explicaciones alternativas'],
      limitaciones: ['Una respuesta idéntica puede deberse a un error de cálculo común, a un distractor atractivo o a una confusión conceptual: no se sabe cuál sin más preguntas.', 'Coincidir en un error NO indica copia ni ayuda externa.'],
      estado: 'analizable', resultado: `${e.veces} de ${e.deIncorrectas} respuestas incorrectas (${pct(e.veces / e.deIncorrectas)}) son la misma.`, items: [a.id], modo: 'I', prioridad: 3.5,
      porQue: 'Un patrón de error concentrado suele indicar una concepción errónea que merece una evaluación específica.',
    });
  }

  // 4) redundancia (similitud teórica frente a evidencia psicométrica)
  const vistos = new Set<string>();
  for (const ar of aristas.filter((x) => x.tipo === 'textual' || x.tipo === 'conceptual')) {
    const k = [ar.a, ar.b].sort().join('|');
    if (vistos.has(k)) continue;
    vistos.add(k);
    const r = redundancia(ar.a, ar.b, aristas, items);
    out.push({
      id: `red:${k}`, linea: 'redundancia', titulo: `¿${E(ar.a)} y ${E(ar.b)} aportan la misma información?`, pregunta: '¿Las dos preguntas miden prácticamente lo mismo?',
      hipotesis: 'Si son redundantes, su correlación es alta, su dificultad parecida y quitar una no reduce la confiabilidad.', variables: ['aciertos en ambas', 'dificultad observada', 'confiabilidad sin cada una'],
      metodo: 'Correlación entre ítems, comparación de dificultades y confiabilidad «si se elimina el ítem»', tipoEstudio: 'Psicométrico',
      disponibles: r.razones, faltantes: r.falta, limitaciones: ['La similitud textual o de conceptos no demuestra redundancia psicométrica.'],
      estado: r.veredicto === 'sin_evidencia' ? (N ? 'datos_insuficientes' : 'requiere_nueva_evaluacion') : 'analizable',
      resultado: r.veredicto === 'posible' ? 'Indicios compatibles con redundancia: revise si una de ellas puede sustituirse.' : r.veredicto === 'no' ? 'No parecen redundantes: sus dificultades observadas difieren.' : null,
      items: [ar.a, ar.b], modo: 'A', prioridad: r.veredicto === 'posible' ? 3 : 1.2, porQue: ar.explicacion,
    });
  }

  // 5) omisiones (sin atribuir intenciones)
  const omis = [...items.values()].filter((i) => i.omisiones > 0);
  if (omis.length) {
    const pos = examen?.omisionPorPosicion;
    out.push({
      id: 'omi:mecanismos', linea: 'omisiones', titulo: 'Mecanismos de las omisiones', pregunta: '¿Las omisiones se relacionan con la posición, la dificultad o el tiempo?',
      hipotesis: 'Si la omisión se debe a falta de tiempo, aumenta con la posición; si se debe a desconocimiento, con la dificultad.',
      variables: ['omisión por pregunta', 'posición en el examen', 'dificultad observada', 'orden de presentación (si fue aleatorio)'], metodo: 'Correlación de rangos posición–omisión; comparación con la dificultad',
      tipoEstudio: 'Descriptivo', disponibles: [`${omis.length} preguntas con omisiones; total ${omis.reduce((s, i) => s + i.omisiones, 0)}`],
      faltantes: [...(pos?.ok ? [] : [pos ? pos.motivo : 'datos del examen']), ...(ctx.ordenAleatorio ? [] : ['un orden aleatorio de preguntas, para separar posición y contenido'])],
      limitaciones: ['Posibles mecanismos: desconocimiento, falta de tiempo, decisión estratégica, problemas de interfaz, interrupción, abandono u otros no observables.', 'Nunca se puede afirmar que una omisión fue deliberada solo por el patrón.'],
      estado: pos?.ok ? 'analizable' : N ? 'datos_insuficientes' : 'requiere_nueva_evaluacion',
      resultado: pos?.ok ? `Correlación de rangos entre posición y tasa de omisión: ${pos.valor.toFixed(2)} (${pos.n} preguntas). ${pos.valor > 0.5 ? 'Las omisiones se concentran al final: compatible con falta de tiempo (entre otras explicaciones).' : 'Las omisiones no se concentran claramente al final.'}` : null,
      items: omis.map((i) => i.id), modo: ctx.ordenAleatorio ? null : 'Q', prioridad: 2.5, porQue: 'Hay omisiones: distinguir sus causas mejora el instrumento.',
    });
  }

  // 6) contraste: aciertos en difíciles y omisiones en fáciles (Fase 11)
  const ct = examen?.contraste;
  out.push({
    id: 'omi:contraste', linea: 'omisiones', titulo: 'Aciertos en preguntas difíciles con omisión de preguntas fáciles',
    pregunta: '¿Qué explica que alguien acierte preguntas difíciles y omita otras observadas como fáciles?', hipotesis: 'El patrón se explica por factores observables (tiempo, orden, lectura, habilidades distintas) más que por azar.',
    variables: ['acierto en preguntas difíciles', 'omisión en preguntas fáciles', 'posición', 'tiempo', 'tipo de habilidad'], metodo: 'Conteo descriptivo y, si interesa, evaluación complementaria con pares equivalentes',
    tipoEstudio: 'Descriptivo (no causal)', disponibles: ct?.ok ? [`${ct.valor.estudiantes} de ${ct.n} estudiantes muestran el patrón`] : [],
    faltantes: ct?.ok ? ['una evaluación complementaria con pares conceptualmente equivalentes y tiempo suficiente'] : [ct ? ct.motivo : 'datos del examen'],
    limitaciones: ['Explicaciones posibles: diferencias de dificultad real, falta de tiempo, habilidades distintas, lectura, decisión estratégica, interfaz, variación aleatoria.',
      'Este patrón NO es prueba de ayuda externa ni de ninguna conducta. No genera sanciones ni puntuaciones de culpabilidad.', MISMO_EXAMEN],
    estado: ct?.ok ? 'analizable' : N ? 'datos_insuficientes' : 'requiere_nueva_evaluacion',
    resultado: ct?.ok ? `${ct.valor.estudiantes} de ${ct.n} estudiantes aciertan alguna difícil (${ct.valor.dificilesCorrectas.map(E).join(', ')}) y omiten alguna fácil (${ct.valor.facilesOmitidas.map(E).join(', ')}).` : null,
    items: ct?.ok ? [...ct.valor.dificilesCorrectas, ...ct.valor.facilesOmitidas] : [], modo: 'O', prioridad: ct?.ok && ct.valor.estudiantes > 0 ? 2.8 : 1, porQue: 'Línea original de LIEIA, ahora como hipótesis a contrastar y no como indicio de conducta.',
  });

  // 7) dificultad a priori frente a observada
  for (const a of analisis) {
    const it = items.get(a.id);
    if (!it?.p.ok) continue;
    const p = it.p.valor.p, d = a.dificultadAPriori.valor;
    const raro = (d === 'basico' && it.p.valor.ic[1] < 0.5) || (d === 'desafiante' && it.p.valor.ic[0] > 0.8);
    if (!raro) continue;
    out.push({
      id: `dif:${a.id}`, linea: 'construccion', titulo: `La dificultad observada de ${E(a.id)} no coincide con la prevista`, pregunta: `¿Por qué ${E(a.id)} resultó ${d === 'basico' ? 'más difícil' : 'más fácil'} de lo previsto?`,
      hipotesis: 'Hay una causa identificable (enunciado ambiguo, clave, formato o un contenido no trabajado).', variables: ['dificultad prevista', 'dificultad observada', 'errores frecuentes'],
      metodo: 'Revisión del enunciado y la clave; comparación con preguntas del mismo concepto', tipoEstudio: 'Revisión del instrumento',
      disponibles: [`prevista: ${d}; observada: ${pct(p)} de aciertos [IC 95 %: ${pct(it.p.valor.ic[0])}, ${pct(it.p.valor.ic[1])}], n = ${it.p.n}`], faltantes: [],
      limitaciones: ['La dificultad observada depende de este grupo; puede variar en otro.'], estado: 'analizable', resultado: `Aciertos observados ${pct(p)} frente a dificultad prevista «${d}».`,
      items: [a.id], modo: 'L', prioridad: 3.2, porQue: 'Una discrepancia clara entre lo previsto y lo observado suele revelar un problema del ítem o de la enseñanza.',
    });
  }

  // 8) confiabilidad del instrumento
  const cf = examen?.confiabilidad;
  out.push({
    id: 'con:confiabilidad', linea: 'construccion', titulo: 'Confiabilidad del examen', pregunta: '¿Con qué consistencia mide el examen?', hipotesis: 'El examen tiene una consistencia interna aceptable (KR-20 ≥ 0,7).',
    variables: ['aciertos por pregunta'], metodo: 'KR-20 con IC bootstrap', tipoEstudio: 'Psicométrico', disponibles: cf?.ok ? [cf.metodo] : [],
    faltantes: cf?.ok ? [] : [cf ? cf.motivo : 'datos del examen'], limitaciones: ['KR-20 supone unidimensionalidad aproximada; con contenidos muy distintos, se subestima.'],
    estado: cf?.ok ? 'analizable' : N ? 'datos_insuficientes' : 'requiere_nueva_evaluacion',
    resultado: cf?.ok ? `KR-20 = ${cf.valor.kr20.toFixed(2)} [IC 95 %: ${cf.valor.ic[0].toFixed(2)}, ${cf.valor.ic[1].toFixed(2)}], n = ${cf.n}.` : null, items: [], modo: 'L', prioridad: cf?.ok ? 2 : 1, porQue: 'Toda conclusión sobre el examen depende de su precisión.',
  });

  // 9) isomorfos: ¿misma dificultad?
  for (const ar of aristas.filter((x) => x.tipo === 'isomorfismo').slice(0, 3)) {
    const ia = items.get(ar.a), ib = items.get(ar.b);
    const r = ia && ib ? difProp(ia.correctas, ia.calificadas, ib.correctas, ib.calificadas) : null;
    out.push({
      id: `iso:${ar.a}:${ar.b}`, linea: 'construccion', titulo: `¿${E(ar.a)} y ${E(ar.b)} son igual de difíciles?`, pregunta: '¿Dos preguntas de la misma familia funcionan como equivalentes?',
      hipotesis: 'Diferencia de dificultad dentro de ±10 puntos (equivalencia práctica).', variables: ['aciertos en cada una'], metodo: 'Diferencia de proporciones con IC 95 % (para equivalencia estricta: TOST)',
      tipoEstudio: 'Equivalencia entre versiones', disponibles: [ar.explicacion], faltantes: r ? [] : [`al menos ${MINIMOS.item} respuestas calificadas en cada una`],
      limitaciones: ['Si las responden los mismos estudiantes, las proporciones no son independientes (el IC es aproximado).'], estado: r ? 'analizable' : N ? 'datos_insuficientes' : 'requiere_nueva_evaluacion',
      resultado: r ? `Diferencia ${pct(r.d)} [IC 95 %: ${pct(r.ic[0])}, ${pct(r.ic[1])}]. ${Math.abs(r.ic[0]) <= 0.1 && Math.abs(r.ic[1]) <= 0.1 ? 'Compatible con equivalencia práctica.' : 'No se puede afirmar equivalencia.'}` : null,
      items: [ar.a, ar.b], modo: 'N', prioridad: r ? 2.5 : 1.3, porQue: 'Las versiones isomorfas solo son justas si su dificultad es equivalente.',
    });
  }

  // 10) efecto del orden
  out.push({
    id: 'con:orden', linea: 'construccion', titulo: 'Efecto del orden de las preguntas', pregunta: '¿El rendimiento en una pregunta depende de su posición?', hipotesis: 'Las preguntas rinden peor cuanto más tarde aparecen (fatiga o tiempo).',
    variables: ['posición', 'acierto', 'omisión'], metodo: ctx.ordenAleatorio ? 'Regresión del acierto sobre la posición, por pregunta' : 'Diseño aleatorizado del orden (cada estudiante con un orden reproducible)',
    tipoEstudio: ctx.ordenAleatorio ? 'Aleatorizado (el orden fue asignado al azar)' : 'Requiere asignación aleatoria del orden', disponibles: ctx.ordenAleatorio ? ['el examen se aplicó con orden aleatorio'] : [],
    faltantes: ctx.ordenAleatorio ? [] : ['aplicar el examen con orden aleatorio por estudiante'], limitaciones: ['Sin orden aleatorio, posición y contenido están confundidos.'],
    estado: ctx.ordenAleatorio && N >= MINIMOS.correlacion ? 'analizable' : ctx.ordenAleatorio ? 'datos_insuficientes' : 'requiere_nueva_evaluacion', resultado: null, items: [], modo: 'Q', prioridad: 1.6,
    porQue: 'Permite separar la dificultad del contenido de la del momento en que aparece.',
  });

  // 11) transferencia y retención (requieren nuevas evaluaciones)
  const transf = tiene('transferencia');
  out.push({
    id: 'est:retencion', linea: 'estabilidad', titulo: 'Retención de lo evaluado', pregunta: '¿Se mantiene el rendimiento en los mismos conceptos semanas después?', hipotesis: 'El rendimiento en preguntas equivalentes disminuye con el tiempo, más en lo memorizado que en lo comprendido.',
    variables: ['acierto ahora', 'acierto en la evaluación posterior', 'tipo de habilidad'], metodo: 'Medidas repetidas con preguntas isomorfas', tipoEstudio: 'Longitudinal', disponibles: [`${analisis.length} preguntas como base`],
    faltantes: ['una segunda evaluación con preguntas equivalentes tras un intervalo'], limitaciones: ['Entre ambas mediciones hay enseñanza y repaso: no es un experimento controlado.'],
    estado: 'requiere_nueva_evaluacion', resultado: null, items: analisis.map((a) => a.id), modo: 'J', prioridad: 1.4, porQue: 'Informa si el aprendizaje medido es estable.',
  });
  out.push({
    id: 'est:transferencia', linea: 'estabilidad', titulo: 'Transferencia a situaciones nuevas', pregunta: '¿Quien acierta en el contexto trabajado acierta también en un contexto nuevo?', hipotesis: 'El acierto en contexto conocido predice parcialmente el acierto en contexto nuevo.',
    variables: ['acierto en contexto conocido', 'acierto en contexto nuevo'], metodo: 'Pares de preguntas base/transferencia; asociación y diferencia de proporciones', tipoEstudio: transf.length ? 'Observacional' : 'Requiere nueva evaluación',
    disponibles: transf.length ? [`preguntas de transferencia: ${transf.map(E).join(', ')}`] : [], faltantes: transf.length ? [] : ['preguntas de transferencia emparejadas con preguntas base'],
    limitaciones: [NO_CAUSA], estado: transf.length && N >= MINIMOS.correlacion ? 'analizable' : transf.length ? 'datos_insuficientes' : 'requiere_nueva_evaluacion', resultado: null,
    items: transf, modo: 'F', prioridad: 1.5, porQue: 'Distingue comprensión de reconocimiento.',
  });

  // 12) asistencia externa: solo diseño prospectivo, consentido y sin sanciones
  out.push({
    id: 'ayu:prospectivo', linea: 'ayuda_externa', titulo: 'Desempeño con y sin asistencia (diseño consentido)', pregunta: '¿Cambia el desempeño entre condiciones declaradas de asistencia y no asistencia?',
    hipotesis: 'El desempeño difiere entre condiciones, y la diferencia es menor en preguntas de transferencia.', variables: ['condición (con / sin asistencia, declarada y asignada)', 'acierto en pares equivalentes', 'transferencia'],
    metodo: 'Diseño cruzado con pares isomorfos y orden de condiciones aleatorizado', tipoEstudio: 'Experimental (con asignación de condiciones)', disponibles: [],
    faltantes: ['consentimiento informado y condiciones explicadas a los estudiantes', 'pares de preguntas equivalentes', 'una aplicación específica'],
    limitaciones: ['Los datos actuales (tiempos, omisiones, similitudes) NO pueden demostrar uso de IA.', 'Resultados individuales separados de la calificación salvo reglas comunicadas de antemano; sin sanciones automáticas.'],
    estado: 'requiere_nueva_evaluacion', resultado: null, items: [], modo: 'O', prioridad: 1.2, porQue: 'Conserva la línea original de LIEIA de forma metodológicamente válida.',
  });

  // 13) descubrimiento abierto: asociaciones empíricas SIN relación teórica prevista
  const teor = new Set(aristas.filter((x) => x.procedencia === 'a_priori').map((x) => [x.a, x.b].sort().join('|')));
  for (const ar of aristas.filter((x) => x.tipo === 'correlacion' && !teor.has([x.a, x.b].sort().join('|'))).slice(0, 3)) {
    out.push({
      id: `abi:${ar.a}:${ar.b}`, linea: 'abierta', titulo: `Asociación no prevista entre ${E(ar.a)} y ${E(ar.b)}`, pregunta: '¿Comparten estas preguntas una habilidad que el contenido no hace evidente?',
      hipotesis: 'Ambas dependen de una habilidad común (p. ej. un paso algebraico o una lectura de gráficas).', variables: [`acierto en ${E(ar.a)}`, `acierto en ${E(ar.b)}`], metodo: 'Revisión de ambos enunciados y confirmación en otra aplicación',
      tipoEstudio: 'Exploratorio', disponibles: [ar.explicacion], faltantes: ['confirmación con otra muestra (los mismos datos ya se usaron para encontrarla)'],
      limitaciones: [MISMO_EXAMEN, NO_CAUSA], estado: 'analizable', resultado: ar.explicacion, items: [ar.a, ar.b], modo: 'H', prioridad: 3.4,
      porQue: 'Es una relación que el profesor probablemente no había considerado.',
    });
  }

  // prioridad: factibilidad + señal, sin saturar
  return out.sort((a, b) => b.prioridad - a.prioridad);
}

export const etiquetaCognitiva = (c: Cognitiva) => COGNITIVAS[c];
