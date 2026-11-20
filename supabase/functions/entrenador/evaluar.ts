/**
 * Entrenador: corrección inmediata de respuestas numéricas (una o varias casillas) con el motor de calificación de siempre
 * (`_shared/calificacion`). Función pura, sin Deno, probada con Vitest.
 *
 * A diferencia del maratón, aquí la corrección se muestra: por casilla, correcta o no, y el mensaje del motor (error
 * típico reconocido, unidad de otra magnitud, factor de 10…). Como en los exámenes de laboratorio, se puede escribir solo
 * el número en la unidad indicada junto a la casilla, o el número con su unidad (se convierte).
 * Un intento NO válido (casilla vacía, texto ilegible) no gasta intento: se devuelve el mensaje y no se registra nada.
 */
import { gradeNumeric } from '../_shared/calificacion/calificar.ts';
import type { NumericKey } from '../_shared/calificacion/tipos.ts';

export interface ClaveEntrenador {
  partes: NumericKey[];
}

export interface ParteCorregida {
  correcta: boolean;
  codigo: string;
  mensaje: string | null;
}

export type Correccion =
  | { valida: false; mensajes: string[] }
  | { valida: true; correcta: boolean; partes: ParteCorregida[] };

export const MAX_PARTE = 200;

export function corregir(clave: ClaveEntrenador, partes: unknown): Correccion {
  if (!clave || !Array.isArray(clave.partes) || clave.partes.length === 0) throw new Error('Clave del Entrenador sin partes');
  const lista = Array.isArray(partes) ? partes : [];
  const n = clave.partes.length;
  if (lista.length !== n) return { valida: false, mensajes: [`Este ejercicio pide ${n} resultado(s): complete todas las casillas.`] };
  const mensajes: string[] = [];
  const out: ParteCorregida[] = [];
  clave.partes.forEach((k, i) => {
    const pref = n > 1 ? `Casilla ${String.fromCharCode(97 + i)}: ` : '';
    const raw = lista[i];
    if (typeof raw !== 'string' || raw.trim() === '') {
      mensajes.push(`${pref}escriba un valor.`);
      return;
    }
    if (raw.length > MAX_PARTE) {
      mensajes.push(`${pref}la respuesta es demasiado larga; escriba solo el número.`);
      return;
    }
    // el número solo se interpreta en la unidad de la clave (la que ve el estudiante junto a la casilla)
    const r = gradeNumeric({ ...k, unitRequired: false }, raw.trim());
    if (r.status === 'invalid') {
      mensajes.push(`${pref}${r.messages[0] ?? 'no se pudo interpretar la respuesta.'}`);
      return;
    }
    const correcta = r.status === 'correct';
    out.push({ correcta, codigo: r.code, mensaje: correcta ? null : r.messages.filter(Boolean).join(' ') || null });
  });
  if (mensajes.length) return { valida: false, mensajes };
  return { valida: true, correcta: out.every((p) => p.correcta), partes: out };
}
