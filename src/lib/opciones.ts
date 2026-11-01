/**
 * Orden aleatorio de las opciones (solo presentación). Determinista por semilla (intento + pregunta): el mismo
 * estudiante ve siempre el mismo orden. Las opciones conservan su índice (y su letra) original, de modo que la respuesta
 * guardada, la calificación y las explicaciones no cambian.
 */
import { mulberry32 } from './azar';   // no desde fisica/variantes: el estudiante no debe cargar el cálculo de respuestas

/** Opciones cuyo sentido depende de la posición: no se barajan. */
const DEPENDE_POSICION = /todas las anteriores|ninguna de las anteriores|las dos anteriores|ambas|todas son correctas|ninguna es correcta|\b[a-e]\)?\s*y\s*[a-e]\)?\b|\b(solo|sólo)\s+[a-e]\b|anterior(es)?\b/i;

export function dependeDePosicion(opciones: string[]): boolean {
  return opciones.some((o) => DEPENDE_POSICION.test(o));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Permutación de los índices originales para mostrar. Identidad si no procede barajar. */
export function ordenOpciones(opciones: string[], semilla: string, activo: boolean): number[] {
  const idx = opciones.map((_, i) => i);
  if (!activo || opciones.length < 3 || dependeDePosicion(opciones)) return idx;
  const rnd = mulberry32(hash(semilla));
  for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
  return idx;
}
