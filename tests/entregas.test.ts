import { describe, expect, it } from 'vitest';
import { descargar, esPdf, HttpError, nombreSeguro, rutaArchivo, subir, type Deps } from '../supabase/functions/entregas/handler';

const BOX = 'a1000000-0000-4000-8000-000000000001';
const USER = 'b1000000-0000-4000-8000-000000000001';
const FILE = 'c1000000-0000-4000-8000-000000000001';
const pdf = (cuerpo = 'contenido') => new TextEncoder().encode(`%PDF-1.7\n${cuerpo}\n%%EOF\n`);

function deps(errores: Record<string, { message: string; code: string }> = {}) {
  const log: string[] = [];
  const d: Deps = {
    rpc: async (fn, args) => {
      log.push(`rpc:${fn}:${JSON.stringify(args)}`);
      return errores[fn] ? { data: null, error: errores[fn] } : { data: fn === 'svc_upload_file_path' ? `${BOX}/${USER}/${FILE}.pdf` : { id: FILE, estado: 'recibido' }, error: null };
    },
    ensureBucket: async () => void log.push('bucket'),
    upload: async (p) => void log.push(`upload:${p}`),
    remove: async (p) => void log.push(`remove:${p}`),
    signedUrl: async (p, s) => `https://firmado/${p}?s=${s}`,
    newId: () => FILE,
    sha256: async () => 'f'.repeat(64),
  };
  return { d, log };
}

describe('entregas en PDF (Edge Function)', () => {
  it('reconoce un PDF real y rechaza otros archivos con extensión .pdf', () => {
    expect(esPdf(pdf())).toBe(true);
    expect(esPdf(new TextEncoder().encode('<html>no soy un pdf</html> %%EOF'))).toBe(false);
    expect(esPdf(new TextEncoder().encode('%PDF-1.4 truncado sin final'))).toBe(false);
  });

  it('sanea el nombre original (sin rutas ni caracteres peligrosos)', () => {
    expect(nombreSeguro('C:\\Users\\x\\Práctica 3.PDF')).toBe('Práctica 3.pdf');
    expect(nombreSeguro('../../etc/passwd')).toBe('passwd.pdf');
    expect(nombreSeguro('<script>.pdf')).toBe('script.pdf');
    expect(nombreSeguro('')).toBe('entrega.pdf');
  });

  it('comprueba la autorización antes de guardar, guarda en ruta propia y registra', async () => {
    const { d, log } = deps();
    const r = await subir(BOX, { name: 'p.pdf', bytes: pdf() }, USER, d);
    expect(r).toEqual({ id: FILE, estado: 'recibido' });
    expect(log[0]).toMatch(/^rpc:svc_upload_check/);
    expect(log).toContain(`upload:${rutaArchivo(BOX, USER, FILE)}`);
    expect(log.at(-1)).toMatch(/^rpc:svc_upload_record/);
  });

  it('sin autorización no toca el almacenamiento', async () => {
    const { d, log } = deps({ svc_upload_check: { message: 'Necesita la autorización del profesor', code: '42501' } });
    await expect(subir(BOX, { name: 'p.pdf', bytes: pdf() }, USER, d)).rejects.toMatchObject({ status: 403, message: 'Necesita la autorización del profesor' });
    expect(log.some((l) => l.startsWith('upload'))).toBe(false);
  });

  it('un archivo que no es PDF se rechaza sin guardarlo', async () => {
    const { d, log } = deps();
    await expect(subir(BOX, { name: 'virus.pdf', bytes: new TextEncoder().encode('MZ ejecutable disfrazado') }, USER, d)).rejects.toBeInstanceOf(HttpError);
    expect(log.some((l) => l.startsWith('upload'))).toBe(false);
  });

  it('si el registro falla, borra el archivo recién guardado', async () => {
    const { d, log } = deps({ svc_upload_record: { message: 'Ya entregó el máximo de archivos permitido', code: '42501' } });
    await expect(subir(BOX, { name: 'p.pdf', bytes: pdf() }, USER, d)).rejects.toMatchObject({ status: 403 });
    expect(log).toContain(`remove:${rutaArchivo(BOX, USER, FILE)}`);
  });

  it('parámetros inválidos y descarga con enlace temporal', async () => {
    const { d } = deps();
    await expect(subir('no-es-uuid', { name: 'p.pdf', bytes: pdf() }, USER, d)).rejects.toMatchObject({ status: 400 });
    await expect(subir(BOX, null, USER, d)).rejects.toMatchObject({ status: 400 });
    const r = await descargar(FILE, USER, d);
    expect(r.url).toBe(`https://firmado/${BOX}/${USER}/${FILE}.pdf?s=120`);
    const sin = deps({ svc_upload_file_path: { message: 'No tiene acceso a este archivo', code: '42501' } });
    await expect(descargar(FILE, USER, sin.d)).rejects.toMatchObject({ status: 403 });
  });
});
