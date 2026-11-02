/**
 * Huella perceptual de imágenes (dHash de 64 bits) para detectar que dos estudiantes suben la misma imagen aunque
 * cambie la resolución, la compresión o el formato (migración 67). Funciones puras + el cálculo en el navegador.
 *
 * Método: la imagen se reduce a 9 × 8 tonos de gris PROMEDIANDO bloques (no muestreando píxeles sueltos: así la huella
 * no depende de la resolución ni del ruido de compresión) y cada bit dice si un tono es más claro que su vecino de la
 * derecha. Imágenes iguales a otra escala dan huellas casi idénticas; el servidor las compara por bits distintos.
 * Límites: no es robusta a recortes grandes, giros ni espejos; los PDF solo tienen huella exacta.
 */

/** dHash a partir de 9 × 8 tonos de gris (fila por fila). Devuelve 16 caracteres hexadecimales. */
export function dhashDesdeGris(gris: ArrayLike<number>): string {
  if (gris.length !== 72) throw new Error('Se esperaban 9 × 8 tonos de gris');
  let hex = '';
  for (let fila = 0; fila < 8; fila++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) {
      const izq = gris[fila * 9 + col], der = gris[fila * 9 + col + 1];
      byte = (byte << 1) | (izq > der ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Promedia una imagen RGBA (ancho × alto) en una rejilla de 9 × 8 tonos de gris (luminancia). */
export function grisPorBloques(rgba: ArrayLike<number>, ancho: number, alto: number): number[] {
  const out: number[] = [];
  for (let by = 0; by < 8; by++) {
    const y0 = Math.floor((by * alto) / 8), y1 = Math.max(y0 + 1, Math.floor(((by + 1) * alto) / 8));
    for (let bx = 0; bx < 9; bx++) {
      const x0 = Math.floor((bx * ancho) / 9), x1 = Math.max(x0 + 1, Math.floor(((bx + 1) * ancho) / 9));
      let suma = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * ancho + x) * 4;
        suma += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
        n++;
      }
      out.push(n ? suma / n : 0);
    }
  }
  return out;
}

/**
 * Una imagen casi uniforme (hoja en blanco, foto oscura) no tiene huella perceptual fiable: dos imágenes distintas
 * darían la misma. En ese caso solo se usa la huella exacta.
 */
export function contrasteSuficiente(gris: ArrayLike<number>, minimo = 10): boolean {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < gris.length; i++) { lo = Math.min(lo, gris[i]); hi = Math.max(hi, gris[i]); }
  return hi - lo >= minimo;
}

/** Bits distintos entre dos huellas de 16 caracteres hexadecimales (0 = idénticas, 64 = opuestas). */
export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < 16; i += 4) {
    let x = parseInt(a.slice(i, i + 4), 16) ^ parseInt(b.slice(i, i + 4), 16);
    while (x) { d += x & 1; x >>>= 1; }
  }
  return d;
}

/** Huella de una imagen ya decodificada (en el navegador). null si el navegador no permite leer los píxeles. */
export function dhashImagen(fuente: CanvasImageSource, ancho: number, alto: number): string | null {
  try {
    const W = 72, H = 64;   // rejilla intermedia (8 × 8 píxeles por celda): el promedio absorbe ruido y escala
    const lienzo = document.createElement('canvas');
    lienzo.width = W; lienzo.height = H;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fuente, 0, 0, ancho, alto, 0, 0, W, H);
    const gris = grisPorBloques(ctx.getImageData(0, 0, W, H).data, W, H);
    return contrasteSuficiente(gris) ? dhashDesdeGris(gris) : null;
  } catch {
    return null;
  }
}
