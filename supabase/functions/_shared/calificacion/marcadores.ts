/**
 * Marcadores {{parámetro}} de los enunciados con variante por intento. SIN dependencias: lo carga el navegador, que solo
 * recibe los parámetros (no las respuestas, que calcula el servidor en variante.ts).
 */
export function sustituirParametros(texto: string, parametros: Record<string, number> | null): string {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, n: string) => (parametros && Object.prototype.hasOwnProperty.call(parametros, n) ? String(parametros[n]) : '?'));
}
export const tieneParametros = (texto: string) => /\{\{\s*\w+\s*\}\}/.test(texto);
