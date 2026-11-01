/**
 * LIEIA · informe inteligente de un examen: une contenido (a priori), respuestas (empírico), relaciones, descubrimiento,
 * diagnóstico multidimensional (sin puntuación única) y recomendaciones priorizadas. Determinista y reproducible.
 * El resumen en lenguaje natural se construye SOLO con cantidades calculadas aquí.
 */
import { analizarContenido, aplicarRevision, type AnalisisContenido, type Revision } from './contenido';
import { descubrir, type Ficha, type ModoDiseno } from './descubrimiento';
import { MINIMOS, type DatosReales, type Pregunta } from './modelo';
import { analizarExamen, analizarItems, matriz, type ExamenEmpirico, type ItemEmpirico, type Matriz } from './psicometria';
import { relacionesEmpiricas, relacionesTeoricas, type Arista } from './relaciones';

export type EstadoDim = 'bien' | 'atencion' | 'problema' | 'sin_datos';
export interface Dimension { clave: string; nombre: string; estado: EstadoDim; detalle: string }
export interface Recomendacion { id: string; texto: string; porQue: string; modo: ModoDiseno | null; fichaId: string | null }

export interface Informe {
  version: string; generado: string;
  preguntas: Pregunta[]; analisis: (AnalisisContenido & { revisada: boolean })[]; empirico: Map<string, ItemEmpirico>; examen: ExamenEmpirico | null; matriz: Matriz | null;
  aristas: Arista[]; fichas: Ficha[]; diagnostico: Dimension[]; recomendaciones: Recomendacion[]; resumen: string[];
}

/** Huella del examen y de los datos: si no cambia, el informe guardado sigue siendo válido (caché por versión). */
export function versionDe(ps: Pregunta[], d: DatosReales | null): string {
  const s = ps.map((p) => `${p.id}:${p.posicion}`).join(',') + `|n=${d?.estudiantes.length ?? 0}|r=${d?.estudiantes.reduce((t, e) => t + e.respuestas.length, 0) ?? 0}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

export function diagnosticar(an: AnalisisContenido[], emp: Map<string, ItemEmpirico>, ex: ExamenEmpirico | null, ar: Arista[], fichas: Ficha[]): Dimension[] {
  const K = an.length;
  const porConcepto = new Map<string, number>();
  for (const a of an) for (const c of a.conceptos) porConcepto.set(c, (porConcepto.get(c) ?? 0) + 1);
  const sinConcepto = an.filter((a) => !a.conceptos.length).length;
  const dif = { basico: 0, intermedio: 0, desafiante: 0 };
  for (const a of an) dif[a.dificultadAPriori.valor]++;
  const minutos = Math.round(an.reduce((s, a) => s + a.tiempoAPrioriMin, 0));
  const red = ar.filter((x) => x.tipo === 'textual').length;
  const conN = [...emp.values()].filter((i) => i.p.ok).length;
  const azar = an.filter((a) => a.advertencias.some((w) => /azar/.test(w))).length;
  const lectura = an.filter((a) => a.cargaLectura.nivel === 'alta').length;
  const iso = ar.filter((x) => x.tipo === 'isomorfismo').length;
  const analizables = fichas.filter((f) => f.estado === 'analizable').length;
  const N = ex?.n ?? 0;
  return [
    { clave: 'cobertura', nombre: 'Cobertura de contenidos', estado: porConcepto.size === 0 ? 'sin_datos' : porConcepto.size >= Math.min(3, K) ? 'bien' : 'atencion',
      detalle: porConcepto.size ? `${porConcepto.size} conceptos; ${[...porConcepto.values()].filter((v) => v === 1).length} con una sola pregunta (se miden con poca precisión).` : 'Las preguntas no tienen conceptos asociados.' },
    { clave: 'coherencia', nombre: 'Coherencia conceptual', estado: sinConcepto ? 'atencion' : 'bien', detalle: sinConcepto ? `${sinConcepto} pregunta(s) sin conceptos: no se pueden relacionar con el resto.` : 'Todas las preguntas tienen conceptos.' },
    { clave: 'redundancia', nombre: 'Redundancia', estado: red ? 'atencion' : 'bien', detalle: red ? `${red} par(es) de enunciados muy parecidos (solo similitud textual; ver fichas de redundancia).` : 'No hay enunciados casi idénticos.' },
    { clave: 'dificultad', nombre: 'Balance de dificultad (prevista)', estado: K && (dif.basico === K || dif.desafiante === K) ? 'atencion' : 'bien',
      detalle: `Básica ${dif.basico} · intermedia ${dif.intermedio} · desafiante ${dif.desafiante} (dificultad del autor, no calibrada).` },
    { clave: 'tiempo', nombre: 'Tiempo estimado', estado: 'bien', detalle: `≈ ${minutos} min según formato, pasos y lectura (estimación a priori).` },
    { clave: 'datos', nombre: 'Calidad de los datos', estado: N === 0 ? 'sin_datos' : conN === K ? 'bien' : 'atencion',
      detalle: N === 0 ? 'n = 0: ningún estudiante lo ha entregado; no hay respuestas para calibrar.' : `${N} estudiantes; ${conN} de ${K} preguntas con al menos ${MINIMOS.item} respuestas calificadas.` },
    { clave: 'medicion', nombre: 'Capacidad de medición', estado: !ex?.confiabilidad.ok ? 'sin_datos' : ex.confiabilidad.valor.kr20 >= 0.7 ? 'bien' : ex.confiabilidad.valor.kr20 >= 0.5 ? 'atencion' : 'problema',
      detalle: ex?.confiabilidad.ok ? `KR-20 = ${ex.confiabilidad.valor.kr20.toFixed(2)} [${ex.confiabilidad.valor.ic.map((v) => v.toFixed(2)).join(', ')}].` : ex && !ex.confiabilidad.ok ? ex.confiabilidad.motivo : 'Sin datos.' },
    { clave: 'factibilidad', nombre: 'Investigaciones factibles ahora', estado: analizables ? 'bien' : 'sin_datos', detalle: `${analizables} de ${fichas.length} propuestas se pueden analizar con los datos actuales.` },
    { clave: 'equidad', nombre: 'Equidad del instrumento', estado: azar + lectura ? 'atencion' : 'bien',
      detalle: `${azar} pregunta(s) con mucho acierto por azar; ${lectura} con enunciado largo (la lectura puede pesar más que la física).` },
    { clave: 'equivalencia', nombre: 'Equivalencia entre versiones', estado: iso ? 'atencion' : 'sin_datos', detalle: iso ? `${iso} par(es) candidatos a isomorfos: su equivalencia no está validada empíricamente.` : 'No hay versiones isomorfas identificadas.' },
  ];
}

function recomendar(fichas: Ficha[], diag: Dimension[]): Recomendacion[] {
  const r: Recomendacion[] = [];
  for (const f of fichas.filter((x) => x.estado === 'analizable' && x.resultado).slice(0, 4)) r.push({ id: `r:${f.id}`, texto: f.titulo, porQue: f.porQue, modo: f.modo, fichaId: f.id });
  const sinUna = diag.find((d) => d.clave === 'cobertura');
  if (sinUna && /\d+ con una sola pregunta/.test(sinUna.detalle) && !/ 0 con una/.test(sinUna.detalle)) r.push({ id: 'r:cobertura', texto: 'Añadir preguntas a los conceptos que solo se miden una vez', porQue: sinUna.detalle, modo: 'A', fichaId: null });
  const datos = diag.find((d) => d.clave === 'datos');
  if (datos?.estado !== 'bien') r.push({ id: 'r:calibracion', texto: 'Recoger más respuestas para calibrar las preguntas', porQue: datos?.detalle ?? '', modo: 'L', fichaId: null });
  return r.slice(0, 6);
}

export function analizar(preguntas: Pregunta[], datos: DatosReales | null, revisiones: Revision[] = []): Informe {
  const analisis = preguntas.map((p) => aplicarRevision(analizarContenido(p), revisiones.find((r) => r.id === p.id)));
  const m = datos && datos.estudiantes.length ? matriz(datos) : null;
  const its = m ? analizarItems(m) : [];
  const empirico = new Map(its.map((i) => [i.id, i]));
  const examen = m ? analizarExamen(m, its) : null;
  const aristas = [...relacionesTeoricas(preguntas, analisis), ...(examen ? relacionesEmpiricas(examen) : [])];
  const etiqueta = (id: string) => `P${(preguntas.find((p) => p.id === id)?.posicion ?? 0)}`;
  const fichas = descubrir({ analisis, items: empirico, examen, matriz: m, aristas, etiqueta, ordenAleatorio: datos?.diseno?.orden === 'aleatorio' });
  const diagnostico = diagnosticar(analisis, empirico, examen, aristas, fichas);
  const recomendaciones = recomendar(fichas, diagnostico);
  const grupos = new Set(analisis.flatMap((a) => a.conceptos)).size;
  const relT = aristas.filter((a) => a.procedencia === 'a_priori' && a.tipo !== 'textual').length, relE = aristas.filter((a) => a.procedencia === 'empirica').length;
  const resumen = [
    `He analizado las ${preguntas.length} preguntas (sin clasificación manual): ${grupos} conceptos distintos y ${relT} relaciones teóricas entre preguntas.`,
    examen ? `Hay respuestas reales de ${examen.n} estudiantes${relE ? `; ${relE} asociación(es) empírica(s) superan la corrección por comparaciones múltiples (exploratorias)` : ''}.` : 'Todavía no hay respuestas reales (n = 0): todo lo psicométrico está pendiente y las propiedades son estimaciones a priori.',
    `Propongo ${fichas.length} investigaciones: ${fichas.filter((f) => f.estado === 'analizable').length} analizables ahora, ${fichas.filter((f) => f.estado === 'datos_insuficientes').length} con datos insuficientes y ${fichas.filter((f) => f.estado === 'requiere_nueva_evaluacion').length} que requieren una nueva evaluación.`,
  ];
  return { version: versionDe(preguntas, datos), generado: new Date().toISOString(), preguntas, analisis, empirico, examen, matriz: m, aristas, fichas, diagnostico, recomendaciones, resumen };
}
