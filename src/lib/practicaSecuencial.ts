/**
 * Práctica secuencial (migración 110): lógica pura del orden al azar, del ejercicio actual y del aviso de rapidez.
 * El orden depende solo del intento (semilla), así que recargar la página no lo cambia.
 */
import type { Difficulty } from '@/api/tipos';

export interface ConfigSecuencial {
  aleatorio: boolean;
  umbrales: Record<Difficulty, number>;
  aviso: string;
}

/** Generador pseudoaleatorio pequeño y determinista (mulberry32) a partir de un texto. */
function generador(semilla: string): () => number {
  let h = 1779033703 ^ semilla.length;
  for (let i = 0; i < semilla.length; i++) {
    h = Math.imul(h ^ semilla.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Posiciones 0…n−1 barajadas (Fisher–Yates) con la semilla; sin barajar si aleatorio es falso. */
export function ordenPractica(n: number, semilla: string, aleatorio = true): number[] {
  const orden = Array.from({ length: n }, (_, i) => i);
  if (!aleatorio) return orden;
  const r = generador(semilla);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  return orden;
}

/** Índice (dentro del orden) del primer ejercicio aún abierto; n si ya se cerraron todos. */
export function posicionActual(cerrados: boolean[], orden: number[]): number {
  const k = orden.findIndex((i) => !cerrados[i]);
  return k === -1 ? orden.length : k;
}

/** Umbral en segundos según la dificultad (0 = sin aviso). */
export function umbralDe(cfg: ConfigSecuencial, dificultad: Difficulty): number {
  return Math.max(0, cfg.umbrales[dificultad] ?? 0);
}

/** ¿Corresponde el aviso? Solo cuando el ejercicio pasa a «correcto» antes del umbral. */
export function avisoRapidez(cfg: ConfigSecuencial, dificultad: Difficulty, segundos: number, antes: string | undefined, despues: string | undefined): boolean {
  const u = umbralDe(cfg, dificultad);
  return u > 0 && antes !== 'correct' && despues === 'correct' && segundos >= 0 && segundos < u;
}
