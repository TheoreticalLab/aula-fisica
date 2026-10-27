/**
 * Genera los iconos PNG de Orbe Control (sin dependencias: PNG escrito a mano con zlib).
 *   node scripts/generar-iconos-control.mjs
 * Diseño: fondo azul marino, una «órbita» (anillo) blanca y un punto verde de «en línea».
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(n, pixel) {
  const filas = [];
  for (let y = 0; y < n; y++) {
    const fila = Buffer.alloc(1 + n * 4);
    for (let x = 0; x < n; x++) fila.set(pixel(x + 0.5, y + 0.5), 1 + x * 4);
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(filas), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mezcla = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const suave = (d) => Math.max(0, Math.min(1, 0.5 - d)); // borde antialias de 1 px

/** escala = fracción del icono que ocupa el dibujo (maskable: zona segura del 80 %) */
function icono(n, { redondeado, escala }) {
  const c = n / 2;
  const R = (n / 2) * escala;
  const fondoA = [11, 21, 48];
  const fondoB = [5, 7, 13];
  return png(n, (x, y) => {
    // fondo: degradado marino → negro; esquinas redondeadas si procede
    let col = mezcla(fondoA, fondoB, y / n);
    let alfa = 1;
    if (redondeado) {
      const r = n * 0.22;
      const dx = Math.max(r - x, x - (n - r), 0);
      const dy = Math.max(r - y, y - (n - r), 0);
      alfa = suave(Math.hypot(dx, dy) - r + 0.5);
    }
    const d = Math.hypot(x - c, y - c);
    // anillo (órbita)
    const anillo = suave(Math.abs(d - R * 0.62) - R * 0.07);
    col = mezcla(col, [241, 245, 249], anillo);
    // núcleo
    col = mezcla(col, [59, 111, 216], suave(d - R * 0.26));
    // punto verde «en línea» sobre la órbita (arriba a la derecha)
    const ang = -Math.PI / 4;
    const px = c + Math.cos(ang) * R * 0.62;
    const py = c + Math.sin(ang) * R * 0.62;
    const dp = Math.hypot(x - px, y - py);
    col = mezcla(col, [5, 7, 13], suave(dp - R * 0.2)); // halo oscuro
    col = mezcla(col, [34, 197, 94], suave(dp - R * 0.14));
    return [...col, Math.round(alfa * 255)];
  });
}

const dir = new URL('../orbe-control/public/icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('icon-192.png', dir), icono(192, { redondeado: true, escala: 0.92 }));
writeFileSync(new URL('icon-512.png', dir), icono(512, { redondeado: true, escala: 0.92 }));
writeFileSync(new URL('icon-maskable-512.png', dir), icono(512, { redondeado: false, escala: 0.72 }));
writeFileSync(new URL('apple-touch-icon.png', dir), icono(180, { redondeado: false, escala: 0.85 }));
console.log('Iconos de Orbe Control generados en orbe-control/public/icons/');
