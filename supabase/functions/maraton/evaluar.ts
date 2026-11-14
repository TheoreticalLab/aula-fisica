/**
 * Maratón adaptativo: validación de intentos y corrección de respuestas estructuradas (una o varias magnitudes).
 * Función pura sobre el motor de calificación existente (`_shared/calificacion`), sin IA y sin dependencias de Deno.
 * Vive en la carpeta de la función (no en _shared/) para que desplegarla no cambie ni redespliegue las demás funciones.
 *
 * Regla central: la VALIDEZ de un intento se decide SOLO por la forma de la respuesta (cada parte es una magnitud legible
 * con unidad cuando la pide), nunca por si es correcta. Así, «inválido» no revela nada sobre la clave:
 *  · vacío, texto arbitrario o un número sin la unidad pedida → intento NO válido (no cuenta, no cambia el nivel);
 *  · cualquier magnitud legible → intento válido, correcto o incorrecto (también la unidad de otra dimensión).
 */
import { gradeNumeric, parseQuantity } from '../_shared/calificacion/calificar.ts';
import type { NumericKey } from '../_shared/calificacion/tipos.ts';

export interface ClaveMaraton {
  partes: NumericKey[];
}

export interface EvaluacionParte {
  valida: boolean;
  correcta: boolean;
  codigo: string;
  /** Solo para respuestas no válidas (formato): nunca dice si el valor es correcto. */
  mensaje?: string;
}

export interface EvaluacionRespuesta {
  valida: boolean;
  correcta: boolean;
  partes: EvaluacionParte[];
  mensajes: string[];
}

export const MAX_PARTE = 200;
const SIN_UNIDAD_OBLIGATORIA = new Set(['', '°', '%', 'deg']);

function unidadDeClave(clave: NumericKey): string {
  const p = parseQuantity(clave.value);
  if (!p.ok) throw new Error(`Clave del maratón ilegible: ${clave.value}`);
  return p.q.unit.empty ? '' : p.q.unitText.trim();
}

export function evaluarParte(clave: NumericKey, raw: unknown): EvaluacionParte {
  if (typeof raw !== 'string' || raw.trim() === '') return { valida: false, correcta: false, codigo: 'vacia', mensaje: 'Escriba un valor en cada casilla.' };
  if (raw.length > MAX_PARTE) return { valida: false, correcta: false, codigo: 'larga', mensaje: 'La respuesta de una casilla es demasiado larga: escriba solo la magnitud.' };
  const unidad = unidadDeClave(clave);
  const exige = clave.unitRequired ?? !SIN_UNIDAD_OBLIGATORIA.has(unidad);
  const p = parseQuantity(raw);
  if (p.ok && exige && p.q.unit.empty) {
    return { valida: false, correcta: false, codigo: 'sin_unidad', mensaje: 'Incluya la unidad en cada magnitud (por ejemplo, 3.2 m/s).' };
  }
  const r = gradeNumeric(clave, raw);
  if (r.status === 'invalid') return { valida: false, correcta: false, codigo: r.code, mensaje: r.messages[0] ?? 'No se pudo interpretar la respuesta.' };
  // 'partial' (cifras significativas estrictas) no se usa en el banco del maratón: se trata como no correcta
  return { valida: true, correcta: r.status === 'correct', codigo: r.code };
}

export function evaluarRespuesta(clave: ClaveMaraton, partes: unknown): EvaluacionRespuesta {
  if (!clave || !Array.isArray(clave.partes) || clave.partes.length === 0) throw new Error('Clave del maratón sin partes');
  const lista = Array.isArray(partes) ? partes : [];
  if (lista.length !== clave.partes.length) {
    return { valida: false, correcta: false, partes: [], mensajes: [`Este problema pide ${clave.partes.length} resultado(s): complete todas las casillas.`] };
  }
  const ev = clave.partes.map((k, i) => evaluarParte(k, lista[i]));
  const valida = ev.every((e) => e.valida);
  const mensajes = ev.flatMap((e, i) => (e.valida ? [] : [clave.partes.length > 1 ? `Casilla ${i + 1}: ${e.mensaje}` : e.mensaje ?? '']));
  return { valida, correcta: valida && ev.every((e) => e.correcta), partes: ev, mensajes };
}
