/**
 * Optimización de capturas de pantalla en el navegador antes de subirlas (regularización de prácticas).
 *
 * Objetivo aproximado: 150–400 KB por captura SIN perder legibilidad. No es un límite rígido: si una captura larga
 * no baja de 400 KB sin volverse ilegible, se acepta más grande (hasta el máximo de la sección).
 *  · Reglas de legibilidad: el lado corto nunca baja de 1080 px (o del original, si ya era menor) y la calidad nunca
 *    baja de 0,6. Las capturas de pantallas grandes (p. ej. 2880×1800) se reducen primero a 1440 px de lado corto.
 *  · Formato: WebP cuando el navegador sabe codificarlo; si no (algunos Safari antiguos), JPEG.
 *  · Volver a codificar elimina los metadatos (EXIF, ubicación GPS) de la imagen original.
 * La parte de decisión es pura (planificar, elegir) y se prueba en Node; la del lienzo es una capa delgada.
 */

export const OBJETIVO_BYTES = 400 * 1024;
export const LADO_CORTO_PREFERIDO = 1440;
export const LADO_CORTO_MINIMO = 1080;
export const CALIDAD_MINIMA = 0.6;
const LADO_MAXIMO = 8192;                 // límite práctico del lienzo en teléfonos
const PIXELES_MAXIMOS = 16_000_000;

export interface Paso { ancho: number; alto: number; calidad: number }

/** Escalones de compresión de menos a más agresivo, sin cruzar los mínimos de legibilidad. */
export function planificar(ancho: number, alto: number): Paso[] {
  const corto = Math.min(ancho, alto), largo = Math.max(ancho, alto);
  const limite = Math.min(1, LADO_MAXIMO / largo, Math.sqrt(PIXELES_MAXIMOS / (ancho * alto)));
  const e0 = Math.min(limite, corto > LADO_CORTO_PREFERIDO ? LADO_CORTO_PREFERIDO / corto : 1);
  const eMin = Math.min(limite, corto > LADO_CORTO_MINIMO ? LADO_CORTO_MINIMO / corto : 1);
  const dims = (e: number) => ({ ancho: Math.max(1, Math.round(ancho * e)), alto: Math.max(1, Math.round(alto * e)) });
  const pasos: Paso[] = [0.85, 0.75, 0.65].map((calidad) => ({ ...dims(e0), calidad }));
  if (eMin < e0 - 1e-9) pasos.push(...[0.8, 0.7, CALIDAD_MINIMA].map((calidad) => ({ ...dims(eMin), calidad })));
  else pasos.push({ ...dims(e0), calidad: CALIDAD_MINIMA });
  return pasos;
}

export interface Resultado<B> { blob: B; bytes: number; tipo: string; paso: Paso }

/**
 * Recorre los escalones con el codificador dado y se queda con el PRIMERO que cumple el objetivo; si ninguno lo cumple,
 * con el más pequeño (que sigue respetando la legibilidad). `codificar` devuelve null si no pudo.
 */
export async function optimizarCon<B>(ancho: number, alto: number, codificar: (p: Paso) => Promise<{ blob: B; bytes: number; tipo: string } | null>,
  objetivo = OBJETIVO_BYTES): Promise<Resultado<B> | null> {
  let mejor: Resultado<B> | null = null;
  for (const paso of planificar(ancho, alto)) {
    const r = await codificar(paso);
    if (!r) continue;
    const res = { ...r, paso };
    if (!mejor || res.bytes < mejor.bytes) mejor = res;
    if (res.bytes <= objetivo) return res;
  }
  return mejor;
}

export interface CapturaOptimizada {
  blob: Blob; tipo: string; ancho: number; alto: number; bytes: number;
  anchoOriginal: number; altoOriginal: number; bytesOriginal: number; shaOriginal: string | null; enObjetivo: boolean; calidad: number;
}

async function sha256(buf: ArrayBuffer): Promise<string | null> {
  try {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;   // contexto sin crypto.subtle: el servidor calcula igualmente el hash de lo guardado
  }
}

/** Optimiza un archivo de imagen elegido por el estudiante. Lanza un Error con un mensaje claro si no es posible. */
export async function optimizarCaptura(archivo: File, maxBytes: number): Promise<CapturaOptimizada> {
  if (!archivo.type.startsWith('image/') && !/\.(png|jpe?g|webp|heic|heif|gif|bmp)$/i.test(archivo.name)) {
    throw new Error('Adjunte una captura de pantalla (imagen). No suba el documento de la práctica.');
  }
  const buf = await archivo.arrayBuffer();
  const shaOriginal = await sha256(buf);
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([buf], { type: archivo.type || 'image/png' }), { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Este navegador no puede abrir esa imagen (¿formato HEIC?). Haga la captura de nuevo o guárdela como JPG o PNG.');
  }
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen en este navegador.');
  let webp = true;
  const codificar = async (p: Paso) => {
    lienzo.width = p.ancho; lienzo.height = p.alto;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, p.ancho, p.alto);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, p.ancho, p.alto);
    const intentar = (tipo: string) => new Promise<Blob | null>((ok) => lienzo.toBlob(ok, tipo, p.calidad));
    let blob = webp ? await intentar('image/webp') : null;
    if (!blob || blob.type !== 'image/webp') { webp = false; blob = await intentar('image/jpeg'); }
    return blob ? { blob, bytes: blob.size, tipo: blob.type } : null;
  };
  const r = await optimizarCon(bmp.width, bmp.height, codificar);
  const anchoOriginal = bmp.width, altoOriginal = bmp.height;
  bmp.close();
  if (!r) throw new Error('No se pudo procesar la imagen.');
  if (r.bytes > maxBytes) {
    throw new Error(`La captura sigue ocupando ${Math.round(r.bytes / 1024)} KB después de optimizarla (máximo ${Math.round(maxBytes / 1024)} KB). Recórtela o divídala en dos: puede adjuntar hasta tres imágenes.`);
  }
  return {
    blob: r.blob, tipo: r.tipo, ancho: r.paso.ancho, alto: r.paso.alto, bytes: r.bytes, anchoOriginal, altoOriginal,
    bytesOriginal: archivo.size, shaOriginal, enObjetivo: r.bytes <= OBJETIVO_BYTES, calidad: r.paso.calidad,
  };
}
