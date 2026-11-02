import { describe, expect, it } from 'vitest';
import { contrasteSuficiente, dhashDesdeGris, grisPorBloques, hamming } from '../src/lib/huella';

/** Imagen sintética RGBA: una «pizarra» con trazos (función de la posición relativa), a cualquier resolución. */
function imagen(ancho: number, alto: number, escena: (u: number, v: number) => number, ruido = 0, semilla = 1): Uint8ClampedArray {
  let s = semilla;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const px = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const g = Math.max(0, Math.min(255, escena(x / ancho, y / alto) + (rnd() - 0.5) * 2 * ruido));
    const i = (y * ancho + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = g; px[i + 3] = 255;
  }
  return px;
}
const pizarra = (u: number, v: number) => 230 - 120 * Math.exp(-((u - 0.3) ** 2 + (v - 0.4) ** 2) * 18) - 80 * (Math.sin(u * 9) > 0.6 ? 1 : 0) * (v > 0.5 ? 1 : 0);
const otra = (u: number, v: number) => 40 + 180 * v - 60 * Math.cos(u * 5);
const huella = (px: Uint8ClampedArray, w: number, h: number) => dhashDesdeGris(grisPorBloques(px, w, h));

describe('Huella perceptual (dHash) · migración 67', () => {
  it('la misma imagen a otra resolución y con ruido de compresión da una huella casi igual (bloqueada: ≤ 10 bits)', () => {
    const original = huella(imagen(1600, 1200, pizarra), 1600, 1200);
    const reducida = huella(imagen(400, 300, pizarra), 400, 300);
    const ruidosa = huella(imagen(800, 600, pizarra, 12, 7), 800, 600);
    expect(hamming(original, reducida)).toBeLessThanOrEqual(10);
    expect(hamming(original, ruidosa)).toBeLessThanOrEqual(10);
  });
  it('una imagen distinta da una huella muy diferente (permitida)', () => {
    const a = huella(imagen(800, 600, pizarra), 800, 600);
    const b = huella(imagen(800, 600, otra), 800, 600);
    expect(hamming(a, b)).toBeGreaterThan(10);
  });
  it('formato: 16 caracteres hexadecimales; hamming simétrico y exacto', () => {
    const h = huella(imagen(90, 80, pizarra), 90, 80);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(hamming('0000000000000000', '000000000000000f')).toBe(4);
    expect(hamming('ffffffffffffffff', '0000000000000000')).toBe(64);
    expect(hamming(h, h)).toBe(0);
  });
  it('una imagen casi uniforme (hoja en blanco) no tiene huella perceptual: solo cuenta la exacta', () => {
    expect(contrasteSuficiente(grisPorBloques(imagen(400, 300, () => 250, 2), 400, 300))).toBe(false);
    expect(contrasteSuficiente(grisPorBloques(imagen(400, 300, pizarra), 400, 300))).toBe(true);
  });
  it('rechaza una rejilla de tamaño incorrecto', () => {
    expect(() => dhashDesdeGris(new Array(10).fill(0))).toThrow();
  });
});
