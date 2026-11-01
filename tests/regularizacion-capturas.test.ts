/** Capturas de la regularización de prácticas (Edge Function «entregas», capturas.ts). */
import { describe, expect, it } from 'vitest';
import { HttpError } from '../supabase/functions/entregas/handler';
import {
  eliminarBorrador, infoImagen, quitarCaptura, rutaCaptura, subirCaptura, verCaptura, type DepsCapturas,
} from '../supabase/functions/entregas/capturas';

const DECL = 'a1000000-0000-4000-8000-0000000000d1';
const CLASE = 'c1000000-0000-4000-8000-000000000001';
const USER = 'b1000000-0000-4000-8000-000000000001';
const SHA = 'f'.repeat(64);

const relleno = (cab: number[], n = 256) => { const b = new Uint8Array(n); b.set(cab); return b; };
const txt = (s: string) => [...s].map((c) => c.charCodeAt(0));
const be32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const le16 = (v: number) => [v & 255, (v >>> 8) & 255];
const le24 = (v: number) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255];

export function png(w: number, h: number) { return relleno([0x89, ...txt('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...txt('IHDR'), ...be32(w), ...be32(h), 8, 6, 0, 0, 0]); }
export function webpX(w: number, h: number) { return relleno([...txt('RIFF'), 0, 0, 0, 0, ...txt('WEBP'), ...txt('VP8X'), 10, 0, 0, 0, 0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)]); }
export function webpL(w: number, h: number) {
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  return relleno([...txt('RIFF'), 0, 0, 0, 0, ...txt('WEBP'), ...txt('VP8L'), 0, 0, 0, 0, 0x2f, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255]);
}
export function webpLossy(w: number, h: number) { return relleno([...txt('RIFF'), 0, 0, 0, 0, ...txt('WEBP'), ...txt('VP8 '), 0, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(w), ...le16(h)]); }
export function jpeg(w: number, h: number) {
  // SOI, APP0 (JFIF, 16 bytes), SOF0 con alto y ancho
  return relleno([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...txt('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3]);
}

function deps(over: Partial<DepsCapturas> & { existe?: boolean } = {}) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const subidos: { path: string; bytes: number; mime: string }[] = [];
  const borrados: string[] = [];
  const d: DepsCapturas = {
    rpc: async (fn, args) => {
      llamadas.push({ fn, args });
      if (fn === 'svc_hist_captura_check') return { data: { class_id: CLASE, max_bytes: 2 * 1048576 }, error: null };
      if (fn === 'svc_hist_captura_registrar') return { data: { id: args.p_id, liberar: null }, error: null };
      if (fn === 'svc_hist_captura_ruta') return { data: `${CLASE}/${USER}/${SHA}.webp`, error: null };
      if (fn === 'svc_hist_captura_quitar') return { data: `${CLASE}/${USER}/${SHA}.webp`, error: null };
      if (fn === 'svc_hist_borrador_eliminar') return { data: [`${CLASE}/${USER}/${SHA}.webp`], error: null };
      return { data: null, error: { message: 'desconocida', code: 'XX' } };
    },
    ensureBucket: async () => undefined,
    upload: async (path, bytes, mime) => { subidos.push({ path, bytes: bytes.length, mime }); return over.existe ? 'existe' : 'nuevo'; },
    remove: async (paths) => { borrados.push(...paths); },
    signedUrl: async (path, s) => `https://firmado/${path}?s=${s}`,
    newId: () => 'e1000000-0000-4000-8000-000000000001',
    sha256: async () => SHA,
    ...over,
  };
  return { d, llamadas, subidos, borrados };
}

describe('infoImagen: la firma decide, no la extensión', () => {
  it('lee PNG, WebP (VP8X, VP8L, VP8) y JPEG con sus dimensiones', () => {
    expect(infoImagen(png(1170, 2532))).toEqual({ mime: 'image/png', ancho: 1170, alto: 2532 });
    expect(infoImagen(webpX(1080, 2340))).toEqual({ mime: 'image/webp', ancho: 1080, alto: 2340 });
    expect(infoImagen(webpL(1280, 720))).toEqual({ mime: 'image/webp', ancho: 1280, alto: 720 });
    expect(infoImagen(webpLossy(1920, 1080))).toEqual({ mime: 'image/webp', ancho: 1920, alto: 1080 });
    expect(infoImagen(jpeg(1600, 900))).toEqual({ mime: 'image/jpeg', ancho: 1600, alto: 900 });
  });
  it('rechaza PDF, documentos de Word (ZIP), texto y archivos truncados', () => {
    expect(infoImagen(relleno(txt('%PDF-1.7\n')))).toBeNull();
    expect(infoImagen(relleno([0x50, 0x4b, 3, 4]))).toBeNull();
    expect(infoImagen(relleno(txt('hola profesor')))).toBeNull();
    expect(infoImagen(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});

describe('subirCaptura', () => {
  it('caso 1: guarda solo la imagen en el almacenamiento privado y registra metadatos (sin bytes en la base)', async () => {
    const { d, llamadas, subidos } = deps();
    const r = await subirCaptura({ declaration_id: DECL, posicion: '1', sha_original: '1'.repeat(64), bytes_original: '3100000' }, { bytes: webpX(1080, 2340) }, USER, d);
    expect(r).toMatchObject({ ancho: 1080, alto: 2340, mime: 'image/webp', reutilizada: false });
    expect(subidos).toEqual([{ path: rutaCaptura(CLASE, USER, SHA, 'image/webp'), bytes: 256, mime: 'image/webp' }]);
    const reg = llamadas.find((l) => l.fn === 'svc_hist_captura_registrar')!;
    expect(reg.args).toMatchObject({ p_path: `${CLASE}/${USER}/${SHA}.webp`, p_bytes: 256, p_sha: SHA, p_sha_original: '1'.repeat(64), p_bytes_original: 3100000 });
    // caso 12: ningún argumento de la base de datos lleva los bytes de la imagen
    for (const l of llamadas) for (const v of Object.values(l.args)) expect(v instanceof Uint8Array || (typeof v === 'string' && v.length > 300)).toBe(false);
  });
  it('comprueba el permiso ANTES de tocar el almacenamiento', async () => {
    const { d, subidos } = deps({ rpc: async () => ({ data: null, error: { message: 'No tiene acceso a este registro', code: '42501' } }) });
    await expect(subirCaptura({ declaration_id: DECL, posicion: 1 }, { bytes: png(1170, 2532) }, USER, d)).rejects.toMatchObject({ status: 403 });
    expect(subidos).toHaveLength(0);
  });
  it('rechaza el documento de la práctica con un mensaje claro', async () => {
    const { d, subidos } = deps();
    await expect(subirCaptura({ declaration_id: DECL, posicion: 1 }, { bytes: relleno(txt('%PDF-1.4')) }, USER, d)).rejects.toThrow(/No suba el documento/);
    await expect(subirCaptura({ declaration_id: DECL, posicion: 1 }, { bytes: relleno([0x50, 0x4b, 3, 4]) }, USER, d)).rejects.toThrow(/documento/);
    expect(subidos).toHaveLength(0);
  });
  it('rechaza imágenes ilegibles por diminutas, posiciones inválidas y archivos vacíos', async () => {
    const { d } = deps();
    await expect(subirCaptura({ declaration_id: DECL, posicion: 1 }, { bytes: png(120, 80) }, USER, d)).rejects.toThrow(/pequeña/);
    await expect(subirCaptura({ declaration_id: DECL, posicion: 4 }, { bytes: png(1170, 2532) }, USER, d)).rejects.toBeInstanceOf(HttpError);
    await expect(subirCaptura({ declaration_id: 'x', posicion: 1 }, { bytes: png(1170, 2532) }, USER, d)).rejects.toThrow(/declaration_id/);
    await expect(subirCaptura({ declaration_id: DECL, posicion: 1 }, null, USER, d)).rejects.toThrow(/ninguna imagen/);
  });
  it('si el registro falla, borra el archivo nuevo; si ya existía (misma imagen reutilizada), no lo toca', async () => {
    const fallo = async (fn: string) => (fn === 'svc_hist_captura_check'
      ? { data: { class_id: CLASE }, error: null } : { data: null, error: { message: 'Esa misma imagen ya está adjunta en este registro', code: 'P0001' } });
    const a = deps({ rpc: fallo });
    await expect(subirCaptura({ declaration_id: DECL, posicion: 2 }, { bytes: jpeg(1600, 900) }, USER, a.d)).rejects.toMatchObject({ status: 400 });
    expect(a.borrados).toEqual([`${CLASE}/${USER}/${SHA}.jpg`]);
    const b = deps({ rpc: fallo, existe: true });
    await expect(subirCaptura({ declaration_id: DECL, posicion: 2 }, { bytes: jpeg(1600, 900) }, USER, b.d)).rejects.toMatchObject({ status: 400 });
    expect(b.borrados).toEqual([]);
  });
  it('al reemplazar una captura borra del almacenamiento la anterior que quedó sin uso', async () => {
    const { d, borrados } = deps({
      rpc: async (fn, args) => (fn === 'svc_hist_captura_check' ? { data: { class_id: CLASE }, error: null } : { data: { id: args.p_id, liberar: `${CLASE}/${USER}/viejo.png` }, error: null }),
    });
    await subirCaptura({ declaration_id: DECL, posicion: 1 }, { bytes: png(1170, 2532) }, USER, d);
    expect(borrados).toEqual([`${CLASE}/${USER}/viejo.png`]);
  });
  it('ignora un sha_original mal formado (es un dato declarado por el navegador)', async () => {
    const { d, llamadas } = deps();
    await subirCaptura({ declaration_id: DECL, posicion: 1, sha_original: 'nope', bytes_original: '-5' }, { bytes: png(1170, 2532) }, USER, d);
    expect(llamadas.find((l) => l.fn === 'svc_hist_captura_registrar')!.args).toMatchObject({ p_sha_original: null, p_bytes_original: null });
  });
});

describe('ver, quitar y eliminar', () => {
  it('caso 11: ver una captura ajena se deniega (403) y no se firma ningún enlace', async () => {
    let firmados = 0;
    const { d } = deps({ rpc: async () => ({ data: null, error: { message: 'No tiene acceso a esta captura', code: '42501' } }), signedUrl: async () => { firmados++; return 'x'; } });
    await expect(verCaptura(DECL, USER, d)).rejects.toMatchObject({ status: 403 });
    expect(firmados).toBe(0);
  });
  it('el enlace temporal dura 5 minutos', async () => {
    const { d } = deps();
    expect((await verCaptura(DECL, USER, d)).url).toMatch(/s=300$/);
  });
  it('quitar y eliminar un borrador borran los archivos que quedaron sin uso', async () => {
    const a = deps();
    await quitarCaptura(DECL, USER, a.d);
    expect(a.borrados).toHaveLength(1);
    const b = deps();
    await eliminarBorrador(DECL, USER, b.d);
    expect(b.borrados).toEqual([`${CLASE}/${USER}/${SHA}.webp`]);
  });
});
