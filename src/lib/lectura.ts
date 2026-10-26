/**
 * Lectura cronometrada: tiempo mínimo sugerido a partir del texto.
 * Un texto técnico con ecuaciones se lee más despacio que uno corriente: se usan 130 palabras por minuto,
 * cada fórmula en línea cuenta como 4 palabras y cada fórmula destacada ($$…$$) añade 15 segundos.
 */
export const PALABRAS_POR_MINUTO = 130;
export const MIN_SEGUNDOS = 30;
export const MAX_SEGUNDOS = 7200;

export function analizarTexto(md: string): { palabras: number; formulasLinea: number; formulasBloque: number } {
  const bloques = md.match(/\$\$[\s\S]+?\$\$/g) ?? [];
  const sinBloques = md.replace(/\$\$[\s\S]+?\$\$/g, ' ');
  const enLinea = sinBloques.match(/\$[^$\n]+?\$/g) ?? [];
  const texto = sinBloques.replace(/\$[^$\n]+?\$/g, ' ').replace(/[#>*_`|[\]()-]/g, ' ');
  const palabras = texto.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return { palabras, formulasLinea: enLinea.length, formulasBloque: bloques.length };
}

/** Segundos sugeridos, redondeados hacia arriba a medio minuto. */
export function segundosSugeridos(md: string): number {
  const { palabras, formulasLinea, formulasBloque } = analizarTexto(md);
  const s = ((palabras + 4 * formulasLinea) / PALABRAS_POR_MINUTO) * 60 + 15 * formulasBloque;
  return Math.min(MAX_SEGUNDOS, Math.max(60, Math.ceil(s / 30) * 30));
}

/** 75 → «1:15»; 3600 → «60:00». */
export function formatoTiempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
