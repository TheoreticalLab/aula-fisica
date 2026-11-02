/**
 * Clases impartidas (migración 66): estimación del costo de generar la clase ampliada con Claude.
 * Función pura compartida por el navegador (lo que ve el profesor antes de confirmar) y la Edge Function «orbe-ia»
 * (lo que se reserva del presupuesto). Es una ESTIMACIÓN: el costo real se calcula después con los tokens facturados.
 *
 * Imágenes: la API cobra cerca de (ancho × alto) / 750 tokens por imagen tras reducirla a su tamaño de trabajo.
 * El tamaño de trabajo depende del modelo (algunos admiten alta resolución), así que se dan dos cifras:
 *  · típica: imagen reducida a ~1,15 megapíxeles (≈ 1 600 tokens como máximo);
 *  · máxima: hasta ≈ 4 800 tokens por imagen (alta resolución).
 */

export type Nivel = 'estandar' | 'detallado' | 'exhaustivo';
export const NIVELES: Record<Nivel, { etiqueta: string; max_tokens: number; esfuerzo: 'medium' | 'high'; descripcion: string }> = {
  estandar: { etiqueta: 'Estándar', max_tokens: 8000, esfuerzo: 'medium', descripcion: 'Reconstrucción, explicación y desarrollo principales' },
  detallado: { etiqueta: 'Detallado', max_tokens: 12000, esfuerzo: 'medium', descripcion: 'Además, cada paso algebraico y ejemplos completos' },
  exhaustivo: { etiqueta: 'Exhaustivo', max_tokens: 16000, esfuerzo: 'high', descripcion: 'Máximo detalle: derivaciones, ampliaciones y errores frecuentes' },
};

export interface Tarifa { precio_entrada: number; precio_salida: number; umbral_largo?: number | null; precio_entrada_largo?: number | null; precio_salida_largo?: number | null }

/** Tokens de texto fijos: instrucciones (~2 500) + catálogo de la asignatura (~3 500). */
export const TOKENS_TEXTO = 6000;
export const TOKENS_IMAGEN_TIPICO = 1600;
export const TOKENS_IMAGEN_MAX = 4800;

export function tokensImagen(ancho: number, alto: number, tope: number): number {
  if (!(ancho > 0) || !(alto > 0)) return tope;
  return Math.min(tope, Math.ceil((ancho * alto) / 750));
}

export function costo(t: Tarifa, entrada: number, salida: number): number {
  const largo = t.umbral_largo != null && entrada > t.umbral_largo && t.precio_entrada_largo != null && t.precio_salida_largo != null;
  const pe = largo ? Number(t.precio_entrada_largo) : Number(t.precio_entrada);
  const ps = largo ? Number(t.precio_salida_largo) : Number(t.precio_salida);
  return Math.round(((entrada * pe + salida * ps) / 1e6) * 1e6) / 1e6;
}

export interface Estimacion {
  fotos: number;
  entrada_tipica: number; entrada_maxima: number;
  salida_tipica: number; salida_maxima: number;
  usd_tipico: number; usd_maximo: number;
}

/** Estimación para un modelo, un nivel y unas fotos (dimensiones en píxeles). */
export function estimar(t: Tarifa, nivel: Nivel, fotos: { ancho: number; alto: number }[], extraTexto = 0): Estimacion {
  const n = NIVELES[nivel];
  const entradaT = TOKENS_TEXTO + extraTexto + fotos.reduce((a, f) => a + tokensImagen(f.ancho, f.alto, TOKENS_IMAGEN_TIPICO), 0);
  const entradaM = TOKENS_TEXTO + extraTexto + fotos.reduce((a, f) => a + tokensImagen(f.ancho, f.alto, TOKENS_IMAGEN_MAX), 0);
  const salidaT = Math.round(n.max_tokens * 0.7);
  return {
    fotos: fotos.length, entrada_tipica: entradaT, entrada_maxima: entradaM, salida_tipica: salidaT, salida_maxima: n.max_tokens,
    usd_tipico: costo(t, entradaT, salidaT), usd_maximo: costo(t, entradaM, n.max_tokens),
  };
}

/** Secciones de la clase ampliada (orden y títulos fijos; el contenido lo genera la IA y lo revisa el profesor). */
export const SECCIONES = [
  ['identificacion', 'Identificación del tema'],
  ['reconstruccion', 'Reconstrucción de la pizarra'],
  ['explicacion', 'Explicación teórica'],
  ['desarrollo', 'Desarrollo matemático'],
  ['ejemplos', 'Ejemplos resueltos'],
  ['ampliaciones', 'Ampliaciones generadas por IA'],
  ['errores', 'Errores frecuentes'],
  ['conclusiones', 'Conclusiones'],
  ['incertidumbres', 'Incertidumbres de la reconstrucción'],
] as const;
export type ClaveSeccion = (typeof SECCIONES)[number][0];
