/**
 * Clases impartidas (migración 66): estimación del costo de generar la clase ampliada con Claude.
 * Función pura compartida por el navegador (lo que ve el profesor antes de confirmar) y la Edge Function «orbe-ia»
 * (lo que se reserva del presupuesto). Es una ESTIMACIÓN: el costo real se calcula después con los tokens facturados.
 *
 * Imágenes: la API cobra cerca de (ancho × alto) / 750 tokens por imagen; los modelos actuales las leen en alta
 * resolución, así que se cuentan completas (hasta ~6 700 tokens por foto). La salida incluye el razonamiento interno.
 * Medición real (2 nov 2026, Opus, 3 fotos, catálogo sin compactar): 75 468 tokens de entrada; con el catálogo compacto
 * la entrada esperada es de ~20 000–30 000 tokens.
 */

export type Nivel = 'estandar' | 'detallado' | 'exhaustivo';
// max_tokens incluye el razonamiento interno del modelo (en Opus 5.5 no se puede desactivar): el margen es deliberado.
// Esfuerzo «medium» en todos: con «high» el razonamiento consumía el presupuesto y la respuesta se cortaba (2 nov 2026).
export const NIVELES: Record<Nivel, { etiqueta: string; max_tokens: number; esfuerzo: 'medium' | 'high'; descripcion: string }> = {
  estandar: { etiqueta: 'Estándar', max_tokens: 12000, esfuerzo: 'medium', descripcion: 'Reconstrucción, explicación y desarrollo principales' },
  detallado: { etiqueta: 'Detallado', max_tokens: 20000, esfuerzo: 'medium', descripcion: 'Además, cada paso algebraico y ejemplos completos' },
  exhaustivo: { etiqueta: 'Exhaustivo', max_tokens: 24000, esfuerzo: 'medium', descripcion: 'Máximo detalle: derivaciones, ampliaciones y errores frecuentes' },
};

export interface Tarifa { precio_entrada: number; precio_salida: number; umbral_largo?: number | null; precio_entrada_largo?: number | null; precio_salida_largo?: number | null }

/** Tokens de texto: instrucciones (~2 500) + catálogo compacto de la asignatura (alias cortos, acotado; ~6 000 como máximo). */
export const TOKENS_TEXTO = 9000;
/** Fotos: los modelos actuales las leen en alta resolución (≈ ancho × alto / 750, hasta ~6 700 tokens por foto). */
export const TOKENS_IMAGEN_TIPICO = 6700;
export const TOKENS_IMAGEN_MAX = 6700;

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
  const salidaT = Math.round(n.max_tokens * 0.6);
  return {
    fotos: fotos.length, entrada_tipica: entradaT, entrada_maxima: entradaM, salida_tipica: salidaT, salida_maxima: n.max_tokens,
    usd_tipico: costo(t, entradaT, salidaT), usd_maximo: costo(t, entradaM, n.max_tokens),
  };
}

/**
 * Secciones de la clase ampliada (orden y títulos fijos; el profesor revisa el contenido). Decisión del profesor
 * (2 nov 2026): lo que no se lee con seguridad va AL PRINCIPIO, en una sola nota («en la pizarra se observa…; si fuera…,
 * la explicación es la misma sustituyendo…»), y el resto se escribe limpio, sin marcas «(dudoso)» en medio del texto.
 */
export const SECCIONES = [
  ['incertidumbres', 'Nota sobre la lectura de las pizarras'],
  ['identificacion', 'Tema de la clase'],
  ['reconstruccion', 'Lo trabajado en la pizarra'],
  ['explicacion', 'Explicación teórica'],
  ['desarrollo', 'Desarrollo matemático'],
  ['ejemplos', 'Ejemplos resueltos'],
  ['ampliaciones', 'Ampliaciones'],
  ['errores', 'Errores frecuentes'],
  ['conclusiones', 'Conclusiones'],
] as const;
export type ClaveSeccion = (typeof SECCIONES)[number][0];
