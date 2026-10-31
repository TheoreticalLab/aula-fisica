/**
 * Criterio de «pregunta en pantalla» para la práctica de varias preguntas (lógica pura).
 *
 * Una pregunta está expuesta si se ve al menos la mitad de ella o si ocupa al menos la mitad de la pantalla.
 * El criterio anterior (threshold 0.5 + isIntersecting) dejaba marcada como vista una pregunta mientras quedara un
 * píxel en pantalla (al bajar del 50 % el navegador avisa con isIntersecting = true) y nunca marcaba las preguntas
 * más altas que dos pantallas (su fracción visible nunca llega a 0.5). Ver docs/TELEMETRIA_V2.md §1.2.
 */
export interface Interseccion {
  isIntersecting: boolean;
  intersectionRect: { height: number };
  boundingClientRect: { height: number };
  rootBounds: { height: number } | null;
}

export function preguntaVisible(e: Interseccion, alturaVentana: number): boolean {
  if (!e.isIntersecting) return false;
  const pantalla = e.rootBounds?.height ?? alturaVentana;
  return e.intersectionRect.height >= 0.5 * Math.min(e.boundingClientRect.height, pantalla);
}
