/**
 * LIEIA · explorador científico en lenguaje natural (etapa 7, versión SIN IA).
 * Reconoce la intención de la pregunta por palabras clave y la traduce a un procedimiento ya validado del laboratorio.
 * Toda cifra de la respuesta sale del informe calculado; si los datos no alcanzan, lo dice. Nunca inventa resultados.
 * (Una capa de IA podrá, más adelante, solo mejorar la INTERPRETACIÓN de la pregunta, no producir números.)
 */
import type { Informe } from './informe';
import type { Modo } from './disenador';

export interface RespuestaExplorador {
  intencion: string; procedimiento: string; lineas: string[];
  accion: { vista: 'relaciones' | 'investigar' | 'preguntas' | 'disenar' | 'tri' | 'simular'; modo?: Modo; hipotesis?: string; etiqueta: string } | null;
}

export const EJEMPLOS = [
  '¿Qué preguntas parecen medir la misma habilidad?', '¿Cuáles tienen mayor poder discriminativo observado?', '¿Qué relaciones interesantes existen entre las preguntas?',
  '¿Qué podría investigar con estos datos?', '¿Cómo diseño un examen que mida comprensión conceptual?', '¿Qué preguntas debería añadir para reducir incertidumbre?',
  '¿Qué preguntas tienen más omisiones?', '¿Qué tan confiable es el examen?', 'Quiero saber si quienes dominan energía mecánica también dominan cantidad de movimiento',
];

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pct = (v: number) => `${(100 * v).toFixed(0)} %`;

export function explorar(preguntaUsuario: string, inf: Informe): RespuestaExplorador {
  const t = norm(preguntaUsuario);
  const E = (id: string) => `P${inf.preguntas.find((p) => p.id === id)?.posicion ?? '?'}`;
  const sinDatos = !inf.examen ? 'Todavía no hay respuestas reales (n = 0): ' : '';

  // hipótesis del tipo «quienes dominan X también/mejor Y» → diseño por hipótesis
  if (/(domin|comprend|saben|entienden).*(tambien|mejor|ademas)|se asocia|predice/.test(t) && !/^\s*que |cuales/.test(t)) {
    return { intencion: 'Contrastar una hipótesis entre dos conceptos', procedimiento: 'Diseño por hipótesis (modo P): detecta los conceptos en su frase y propone un diseño correlacional',
      lineas: ['Puedo convertir su frase en un diseño verificable: dos grupos de preguntas (uno por concepto) y la asociación entre sus subpuntuaciones.',
        'Si el examen actual ya tiene preguntas de ambos conceptos, mire también la ficha «Relación entre…» en «¿Qué puedo investigar?».',
        'Limitación: será una asociación, no una causa; y con pocas preguntas por concepto la correlación sale atenuada.'],
      accion: { vista: 'disenar', modo: 'P', hipotesis: preguntaUsuario, etiqueta: 'Diseñar con esta hipótesis' } };
  }
  if (/misma habilidad|miden lo mismo|lo mismo|redundan|parecid|similares/.test(t)) {
    const teor = inf.aristas.filter((a) => a.procedencia === 'a_priori' && (a.tipo === 'conceptual' || a.tipo === 'isomorfismo' || a.tipo === 'textual'));
    const emp = inf.aristas.filter((a) => a.tipo === 'correlacion').sort((x, y) => y.peso - x.peso);
    return { intencion: 'Preguntas que podrían medir lo mismo', procedimiento: 'Conceptos compartidos, familias isomorfas y similitud textual (a priori) + correlación phi con corrección BH (empírica)',
      lineas: [
        teor.length ? `Por contenido: ${teor.slice(0, 6).map((a) => `${E(a.a)}–${E(a.b)} (${a.tipo})`).join(', ')}.` : 'Por contenido no hay pares claramente parecidos.',
        emp.length ? `Por respuestas: ${emp.slice(0, 5).map((a) => `${E(a.a)}–${E(a.b)} (phi ${a.peso.toFixed(2)})`).join(', ')}.` : `${sinDatos}${inf.examen && !inf.examen.pares.ok ? inf.examen.pares.motivo : 'ningún par muestra una asociación que supere la corrección por comparaciones múltiples.'}`,
        'Para afirmar que miden lo mismo hacen falta ambas cosas y que quitar una no reduzca la confiabilidad (vea las fichas de redundancia).'],
      accion: { vista: 'relaciones', etiqueta: 'Ver relaciones' } };
  }
  if (/discrimin|distinguen|separan/.test(t)) {
    const con = inf.analisis.map((a) => ({ a, e: inf.empirico.get(a.id) })).filter((x) => x.e?.discriminacion.ok).sort((x, y) => (y.e!.discriminacion.ok ? y.e!.discriminacion.valor : 0) - (x.e!.discriminacion.ok ? x.e!.discriminacion.valor : 0));
    const motivo = inf.empirico.size ? [...inf.empirico.values()].find((i) => !i.discriminacion.ok) : null;
    return { intencion: 'Poder discriminativo observado', procedimiento: 'Correlación punto-biserial ítem-resto corregida (TCT)',
      lineas: con.length ? [`Mayor discriminación: ${con.slice(0, 5).map((x) => `${E(x.a.id)} (${x.e!.discriminacion.ok ? x.e!.discriminacion.valor.toFixed(2) : ''}, n = ${x.e!.discriminacion.n})`).join(', ')}.`,
        `Menor: ${con.slice(-3).reverse().map((x) => `${E(x.a.id)} (${x.e!.discriminacion.ok ? x.e!.discriminacion.valor.toFixed(2) : ''})`).join(', ')}. Valores bajo 0,2 suelen indicar una pregunta que no distingue niveles o que tiene un problema.`]
        : [`${sinDatos}${motivo && !motivo.discriminacion.ok ? motivo.discriminacion.motivo : 'no hay datos suficientes para estimar la discriminación.'}`],
      accion: con.length ? { vista: 'preguntas', etiqueta: 'Ver preguntas' } : null };
  }
  if (/omisi|omit|en blanco|sin responder|no respond/.test(t)) {
    const it = [...inf.empirico.values()].filter((i) => i.omisiones > 0).sort((a, b) => b.omisiones - a.omisiones);
    return { intencion: 'Omisiones', procedimiento: 'Conteo de preguntas sin respuesta guardada por pregunta y relación con la posición',
      lineas: it.length ? [`Más omitidas: ${it.slice(0, 5).map((i) => `${E(i.id)} (${i.omisiones} de ${i.expuestos})`).join(', ')}.`, 'Las causas posibles (tiempo, desconocimiento, estrategia, interfaz…) no se distinguen solo con este conteo: vea la ficha «Mecanismos de las omisiones».']
        : [inf.examen ? 'No hay omisiones registradas.' : `${sinDatos}no se pueden contar omisiones.`],
      accion: it.length ? { vista: 'investigar', etiqueta: 'Ver fichas de omisiones' } : null };
  }
  if (/confiab|consistencia|precision del examen|que tan preciso/.test(t)) {
    const c = inf.examen?.confiabilidad;
    return { intencion: 'Confiabilidad del examen', procedimiento: 'KR-20 con IC bootstrap',
      lineas: [c?.ok ? `KR-20 = ${c.valor.kr20.toFixed(2)} [IC 95 %: ${c.valor.ic[0].toFixed(2)}, ${c.valor.ic[1].toFixed(2)}], n = ${c.n}. ${c.valor.kr20 >= 0.7 ? 'Consistencia aceptable.' : 'Consistencia baja: las puntuaciones tienen mucho error de medida.'}` : `${sinDatos}${c && !c.ok ? c.motivo : 'no hay datos.'}`,
        'Con TRI puede ver la precisión según el nivel de cada estudiante (pestaña Psicometría avanzada).'],
      accion: { vista: 'tri', etiqueta: 'Psicometría avanzada' } };
  }
  if (/dificil|facil|dificultad/.test(t)) {
    const con = [...inf.empirico.values()].filter((i) => i.p.ok).sort((a, b) => (a.p.ok ? a.p.valor.p : 0) - (b.p.ok ? b.p.valor.p : 0));
    return { intencion: 'Dificultad observada', procedimiento: 'Proporción de aciertos con IC de Wilson (dificultad clásica, no el b de la TRI)',
      lineas: con.length ? [`Más difíciles: ${con.slice(0, 3).map((i) => `${E(i.id)} (${pct(i.p.ok ? i.p.valor.p : 0)})`).join(', ')}.`, `Más fáciles: ${con.slice(-3).reverse().map((i) => `${E(i.id)} (${pct(i.p.ok ? i.p.valor.p : 0)})`).join(', ')}.`]
        : [`${sinDatos}la dificultad solo puede estimarse a priori (la asignada por el autor).`],
      accion: { vista: 'preguntas', etiqueta: 'Ver preguntas' } };
  }
  if (/relacion|correlac|interesante|asociac/.test(t)) {
    const emp = inf.aristas.filter((a) => a.procedencia === 'empirica'), teor = inf.aristas.filter((a) => a.procedencia === 'a_priori' && a.tipo !== 'textual');
    return { intencion: 'Relaciones entre preguntas', procedimiento: 'Grafo de relaciones teóricas (contenido) y empíricas (phi + BH, exploratorias)',
      lineas: [`${teor.length} relaciones teóricas (no comprobadas) y ${emp.length} asociaciones empíricas que superan la corrección por comparaciones múltiples.`,
        ...inf.fichas.filter((f) => f.linea === 'abierta').slice(0, 2).map((f) => `No prevista: ${f.titulo}.`), 'Ninguna asociación implica causa.'],
      accion: { vista: 'relaciones', etiqueta: 'Ver relaciones' } };
  }
  if (/(diseñ|disen|crear|construir|armar).*(examen|prueba|evaluaci)|examen que/.test(t)) {
    const modo: Modo = /conceptual|comprension|principio/.test(t) ? 'C' : /transfer/.test(t) ? 'F' : /razonam|profund/.test(t) ? 'D' : /diagnost/.test(t) ? 'B' : /mecanic.*(principio|comprend)|distinga/.test(t) ? 'C' : /isomorf|version/.test(t) ? 'G' : 'A';
    return { intencion: 'Diseñar un examen', procedimiento: `Diseñador por objetivo (modo ${modo})`,
      lineas: [modo === 'C' ? 'Para medir comprensión conceptual, el diseñador prioriza preguntas conceptuales, de supuestos y de predicción con poca carga algebraica. Para distinguir a quien resuelve mecánicamente de quien comprende, combine este examen con el de cálculo (modo H con «comprensión conceptual» y «aplicación directa»).'
        : `Abro el diseñador con el objetivo más cercano a su pregunta (modo ${modo}); puede cambiarlo.`],
      accion: { vista: 'disenar', modo, etiqueta: 'Abrir el diseñador' } };
  }
  if (/incertidumbre|añadir|anadir|calibr|que preguntas deberia/.test(t)) {
    return { intencion: 'Reducir incertidumbre', procedimiento: 'Diseño exploratorio (modo R): máxima reducción esperada de la varianza de los parámetros; o de calibración (modo L)',
      lineas: [`${inf.analisis.filter((a) => !inf.empirico.get(a.id)?.p.ok).length} de ${inf.preguntas.length} preguntas de este examen no tienen dificultad observada con muestra suficiente.`,
        'El modo R elige las preguntas cuyos parámetros son más inciertos y más informativos para la población; el modo L, las que tienen menos respuestas.'],
      accion: { vista: 'disenar', modo: 'R', etiqueta: 'Diseño exploratorio' } };
  }
  if (/investig|que puedo|no se que|estudiar|hipotes/.test(t)) {
    const an = inf.fichas.filter((f) => f.estado === 'analizable');
    return { intencion: 'Qué investigar', procedimiento: 'Motor de descubrimiento (catálogo + reglas estadísticas + factibilidad)',
      lineas: [`Hay ${inf.fichas.length} propuestas: ${an.length} analizables ahora.`, ...inf.fichas.slice(0, 4).map((f) => `• ${f.titulo} — ${f.estado === 'analizable' ? 'analizable' : f.estado === 'datos_insuficientes' ? 'datos insuficientes' : 'requiere nueva evaluación'}.`)],
      accion: { vista: 'investigar', etiqueta: 'Ver todas las fichas' } };
  }
  if (/cuantos estudiantes|tamano|tamaño|muestra|potencia/.test(t)) {
    return { intencion: 'Tamaño muestral', procedimiento: 'Cálculo analítico (Fisher / dos proporciones) y potencia por simulación', lineas: ['Use la calculadora del simulador: para detectar una correlación de 0,3 hacen falta unos 85 estudiantes (α = 0,05, potencia 80 %).'],
      accion: { vista: 'simular', etiqueta: 'Abrir el simulador' } };
  }
  return { intencion: 'No reconocida', procedimiento: '—', lineas: ['No reconocí la pregunta. Pruebe con alguna de estas:', ...EJEMPLOS.map((e) => `• ${e}`)], accion: null };
}
