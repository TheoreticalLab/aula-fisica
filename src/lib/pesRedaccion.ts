/**
 * Redacción docente de apartados de una PES: del formulario a la clave del motor de calificación, comprobada con el
 * PROPIO motor (la respuesta de la clave debe calificarse como correcta) antes de enviarla al servidor. Así una clave
 * mal escrita no llega a los estudiantes. El servidor vuelve a comprobar la forma (pes_ejercicio_redactado).
 */
import { grade, validateNumericKey } from '@calif/calificar.ts';
import type { AnswerKey, NumericKey } from '@calif/tipos.ts';
import type { ApartadoRedactado, EtapaPes, FormatoPes } from '@/api/pesTipos';

export interface FormApartado {
  enunciado: string;
  formato: FormatoPes;
  etapa: EtapaPes;
  minutos: number;
  /** peso opcional (vacío = pesos iguales en todo el ejercicio) */
  peso: string;
  valor: string;            // numérico: número y unidad
  tolerancia: string;       // numérico: tolerancia relativa en %
  opciones: string;         // selección: una por línea
  correctas: number[];      // selección: índices
  multiple: boolean;
  verdadero: boolean | null;
  justificacion: string;    // verdadero/falso: justificación modelo
  aceptadas: string;        // texto: una por línea
  rubrica: string;          // abierta (obligatoria) u observaciones
  explicacion: string;
  /** clave de una propuesta generada: se conserva (errores típicos, retroalimentación) si la respuesta no cambia */
  claveOriginal?: Record<string, unknown> | null;
  opcionesOriginales?: string;
}

export const formVacio = (etapa: EtapaPes = 'otra'): FormApartado => ({
  enunciado: '', formato: 'numeric', etapa, minutos: 4, peso: '', valor: '', tolerancia: '2', opciones: '', correctas: [], multiple: false,
  verdadero: null, justificacion: '', aceptadas: '', rubrica: '', explicacion: '',
});

const lineas = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

/** Convierte un apartado del formulario; devuelve el apartado listo o la lista de problemas. */
export function construirApartado(f: FormApartado, letra: string): { ok: true; apartado: ApartadoRedactado } | { ok: false; errores: string[] } {
  const err: string[] = [];
  const p = (m: string) => err.push(`Apartado ${letra}: ${m}`);
  if (!f.enunciado.trim()) p('falta el enunciado');
  const t = Math.round(f.minutos * 60);
  if (!(t >= 10 && t <= 7200)) p('el tiempo de referencia va de 10 s a 120 min');
  let peso: number | null = null;
  if (f.peso.trim()) {
    peso = Number(f.peso.replace(',', '.'));
    if (!(peso > 0 && peso <= 1)) p('el peso debe estar entre 0 y 1');
  }
  let clave: AnswerKey | null = null;
  let opciones: string[] | undefined;
  switch (f.formato) {
    case 'numeric': {
      const tol = Number(f.tolerancia.replace(',', '.'));
      if (!f.valor.trim()) { p('falta el valor correcto (número y unidad)'); break; }
      if (!(tol > 0 && tol <= 50)) { p('la tolerancia relativa va de 0 a 50 %'); break; }
      const k: NumericKey = { format: 'numeric', value: f.valor.trim(), relTol: tol / 100 };
      const v = validateNumericKey(k);
      if (v.length) { v.forEach((x) => p(x)); break; }
      // propuesta generada sin cambios en el valor ni la tolerancia: su clave completa (con errores típicos)
      const o = f.claveOriginal;
      const tolOrig = o && typeof o.relTol === 'number' && o.relTol > 0 ? String(Math.round(o.relTol * 1000) / 10) : '2';
      clave = o && o.format === 'numeric' && o.value === k.value && f.tolerancia.trim() === tolOrig && !o.variante ? (o as unknown as NumericKey) : k;
      if (grade(k, { text: k.value }).status !== 'correct') p('el motor no reconoce el valor de la clave como correcto');
      break;
    }
    case 'choice': {
      opciones = lineas(f.opciones);
      if (opciones.length < 2) { p('escriba al menos 2 opciones (una por línea)'); break; }
      const c = [...new Set(f.correctas)].filter((i) => i >= 0 && i < opciones!.length).sort((a, b) => a - b);
      if (!c.length) { p('marque la opción correcta'); break; }
      if (c.length > 1 && !f.multiple) { p('hay varias correctas: marque «varias respuestas»'); break; }
      const o = f.claveOriginal;
      const igual = !!o && o.format === 'choice' && f.opcionesOriginales === f.opciones && JSON.stringify(o.correct) === JSON.stringify(c);
      clave = igual ? { format: 'choice', correct: c, optionFeedback: (o as { optionFeedback?: Record<number, string> }).optionFeedback } : { format: 'choice', correct: c };
      if (grade(clave, { selected: c }, opciones.length).status !== 'correct') p('el motor no acepta la clave de selección');
      break;
    }
    case 'truefalse':
      if (f.verdadero === null) { p('indique si la afirmación es verdadera o falsa'); break; }
      clave = { format: 'truefalse', value: f.verdadero, modelJustification: f.justificacion.trim() };
      break;
    case 'text': {
      const a = lineas(f.aceptadas);
      if (!a.length) { p('escriba al menos una respuesta aceptada'); break; }
      clave = { format: 'text', accepted: a };
      if (grade(clave, { text: a[0] }).status !== 'correct') p('el motor no acepta la primera respuesta aceptada');
      break;
    }
    case 'open':
      if (f.rubrica.trim().length < 10) p('una respuesta abierta necesita rúbrica (al menos 10 caracteres)');
      break;
  }
  if (err.length) return { ok: false, errores: err };
  return { ok: true, apartado: {
    enunciado: f.enunciado.trim(), formato: f.formato, etapa: f.etapa, t_ref_s: t, peso, clave: clave as unknown as Record<string, unknown> | null,
    ...(opciones ? { opciones, multiple: f.multiple } : {}),
    ...(f.formato === 'numeric' ? { unidad_sugerida: f.valor.trim().replace(/^[-+\d.,\s×x^·eE]+/, '').trim() || undefined } : {}),
    rubrica: f.rubrica.trim(), explicacion: f.explicacion.trim(),
  } };
}

/** Todo el ejercicio: 3 a 5 apartados; pesos todos vacíos (iguales) o todos indicados y sumando 1. */
export function construirEjercicio(fs: FormApartado[]): { ok: true; apartados: ApartadoRedactado[] } | { ok: false; errores: string[] } {
  const err: string[] = [];
  if (fs.length < 3 || fs.length > 5) err.push('Cada ejercicio tiene de 3 a 5 apartados');
  const res = fs.map((f, i) => construirApartado(f, String.fromCharCode(65 + i)));
  for (const r of res) if (!r.ok) err.push(...r.errores);
  const conPeso = fs.filter((f) => f.peso.trim()).length;
  if (conPeso > 0 && conPeso < fs.length) err.push('Indique el peso de todos los apartados o de ninguno (pesos iguales)');
  if (conPeso === fs.length && fs.length) {
    const s = res.reduce((a, r) => a + (r.ok ? r.apartado.peso ?? 0 : 0), 0);
    if (Math.abs(s - 1) > 1e-6) err.push(`Los pesos deben sumar 1 (suman ${s.toFixed(3)})`);
  }
  if (err.length) return { ok: false, errores: err };
  return { ok: true, apartados: res.map((r) => (r as { ok: true; apartado: ApartadoRedactado }).apartado) };
}
