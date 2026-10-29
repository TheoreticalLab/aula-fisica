/**
 * Centro de Datos · escritor ZIP sin dependencias (PKWARE APPNOTE 6.3). Comprime con «deflate» mediante
 * CompressionStream cuando el navegador lo ofrece; si no, almacena sin comprimir (igual de válido). Nombres en
 * UTF-8 (bit 11). Sin ZIP64: si el paquete superara 4 GiB o 65 535 archivos, se avisa en lugar de truncar.
 */

export interface EntradaZip { ruta: string; datos: Uint8Array }

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflateRaw(datos: Uint8Array): Promise<Uint8Array | null> {
  const CS = (globalThis as { CompressionStream?: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).CompressionStream;
  if (!CS) return null;
  try {
    const flujo = new Blob([datos]).stream().pipeThrough(new CS('deflate-raw'));
    return new Uint8Array(await new Response(flujo).arrayBuffer());
  } catch {
    return null;
  }
}

function fechaDos(d: Date): { hora: number; dia: number } {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    dia: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const LIMITE = 0xffffffff;

/** Devuelve el ZIP como partes (para construir un Blob sin copiar todo a un único búfer). */
export async function crearZip(entradas: EntradaZip[], opciones: { comprimir?: boolean; fecha?: Date } = {}): Promise<Uint8Array[]> {
  if (entradas.length > 65535) throw new Error('Demasiados archivos para un ZIP sin ZIP64');
  const { hora, dia } = fechaDos(opciones.fecha ?? new Date());
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;
  for (const e of entradas) {
    const nombre = enc.encode(e.ruta);
    const crc = crc32(e.datos);
    const comprimido = opciones.comprimir === false ? null : await deflateRaw(e.datos);
    const usar = comprimido && comprimido.length < e.datos.length ? comprimido : e.datos;
    const metodo = usar === e.datos ? 0 : 8;
    if (e.datos.length >= LIMITE || desplazamiento + usar.length + 30 + nombre.length >= LIMITE) throw new Error('El paquete supera 4 GiB: divida la exportación');
    const local = new Uint8Array(30 + nombre.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, metodo, true);
    lv.setUint16(10, hora, true); lv.setUint16(12, dia, true); lv.setUint32(14, crc, true);
    lv.setUint32(18, usar.length, true); lv.setUint32(22, e.datos.length, true); lv.setUint16(26, nombre.length, true);
    local.set(nombre, 30);
    const cab = new Uint8Array(46 + nombre.length);
    const cv = new DataView(cab.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 0x031e, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, metodo, true); cv.setUint16(12, hora, true); cv.setUint16(14, dia, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, usar.length, true); cv.setUint32(24, e.datos.length, true); cv.setUint16(28, nombre.length, true);
    cv.setUint32(38, 0o100644 << 16, true); cv.setUint32(42, desplazamiento, true);
    cab.set(nombre, 46);
    partes.push(local, usar);
    central.push(cab);
    desplazamiento += local.length + usar.length;
  }
  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const fv = new DataView(fin.buffer);
  fv.setUint32(0, 0x06054b50, true); fv.setUint16(8, entradas.length, true); fv.setUint16(10, entradas.length, true);
  fv.setUint32(12, tamCentral, true); fv.setUint32(16, desplazamiento, true);
  return [...partes, ...central, fin];
}

/** Une las partes en un único búfer (útil en pruebas y para calcular la huella del archivo final). */
export function unir(partes: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

/** Lector mínimo (archivos almacenados o comprimidos) para verificar paquetes en las pruebas. */
export async function leerZip(zip: Uint8Array): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let fin = zip.length - 22;
  while (fin >= 0 && dv.getUint32(fin, true) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error('No es un ZIP');
  const n = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < n; i++) {
    const metodo = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true), tc = dv.getUint32(p + 20, true);
    const ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nombre = dec.decode(zip.subarray(p + 46, p + 46 + ln));
    const inicio = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    let datos = zip.subarray(inicio, inicio + tc);
    if (metodo === 8) {
      const DS = (globalThis as { DecompressionStream?: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream!;
      datos = new Uint8Array(await new Response(new Blob([datos]).stream().pipeThrough(new DS('deflate-raw'))).arrayBuffer());
    }
    if (crc32(datos) !== crc) throw new Error(`CRC incorrecto en ${nombre}`);
    out.set(nombre, datos);
    p += 46 + ln + le + lc;
  }
  return out;
}
