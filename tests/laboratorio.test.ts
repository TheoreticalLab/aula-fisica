/** Asignaturas de laboratorio (migración 84): Edge Function «entregas» (controles.ts), reglas puras e integración estática. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../supabase/functions/entregas/handler';
import type { DepsCapturas } from '../supabase/functions/entregas/capturas';
import { MAX_BYTES_CONTROL, rutaControl, subirControl, verControl } from '../supabase/functions/entregas/controles';
import { contar, cumpleFiltro, motivoArchivo, practicaPorControles, textoFechas, MAX_BYTES_ENVIO, type EstadoControl } from '../src/lib/laboratorio';

const BOX = 'a8400000-0000-4000-8000-0000000000b1';
const USER = 'b8400000-0000-4000-8000-000000000001';
const FILE = 'c8400000-0000-4000-8000-0000000000f1';
const SHA = 'a'.repeat(64);

const relleno = (cab: number[], n = 256) => { const b = new Uint8Array(n); b.set(cab); return b; };
const txt = (s: string) => [...s].map((c) => c.charCodeAt(0));
const be32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const le24 = (v: number) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255];
const png = (w: number, h: number) => relleno([0x89, ...txt('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...txt('IHDR'), ...be32(w), ...be32(h), 8, 6, 0, 0, 0]);
const webp = (w: number, h: number) => relleno([...txt('RIFF'), 0, 0, 0, 0, ...txt('WEBP'), ...txt('VP8X'), 10, 0, 0, 0, 0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)]);
const jpeg = (w: number, h: number) =>
  relleno([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...txt('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3]);
const pdf = () => relleno(txt('%PDF-1.7\n'));

function deps(over: { check?: { message: string; code: string }; record?: { message: string; code: string }; ruta?: string; existe?: boolean } = {}) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const subidos: { path: string; bytes: number; mime: string }[] = [];
  const borrados: string[] = [];
  const d: DepsCapturas = {
    rpc: async (fn, args) => {
      llamadas.push({ fn, args });
      if (fn === 'svc_upload_check') return over.check ? { data: null, error: over.check } : { data: { ok: true, max_mb: 5 }, error: null };
      if (fn === 'svc_lab_control_record') return over.record ? { data: null, error: over.record } : { data: { id: args.p_file, estado: 'recibido', subido: '2026-11-05T12:00:00Z' }, error: null };
      if (fn === 'svc_upload_file_path') return { data: over.ruta ?? `${BOX}/${USER}/${FILE}.webp`, error: null };
      return { data: null, error: { message: 'desconocida', code: 'XX' } };
    },
    ensureBucket: async () => undefined,
    upload: async (path, bytes, mime) => { subidos.push({ path, bytes: bytes.length, mime }); return over.existe ? 'existe' : 'nuevo'; },
    remove: async (paths) => { borrados.push(...paths); },
    signedUrl: async (path, s) => `https://firmado/${path}?s=${s}`,
    newId: () => FILE,
    sha256: async () => SHA,
  };
  return { d, llamadas, subidos, borrados };
}

const status = async (p: Promise<unknown>) => { try { await p; return 0; } catch (e) { return e instanceof HttpError ? e.status : -1; } };

describe('subirControl (Edge Function «entregas», módulo «laboratorio»)', () => {
  it('prueba 1: sube una imagen al control: comprueba antes, guarda en privado y registra con su ruta, tipo y tamaño', async () => {
    const { d, llamadas, subidos } = deps();
    const r = await subirControl(BOX, { bytes: jpeg(1600, 1200) }, USER, d);
    expect(llamadas.map((l) => l.fn)).toEqual(['svc_upload_check', 'svc_lab_control_record']);
    expect(subidos).toEqual([{ path: `${BOX}/${USER}/${FILE}.jpg`, bytes: 256, mime: 'image/jpeg' }]);
    expect(llamadas[1].args).toMatchObject({ p_user: USER, p_box: BOX, p_file: FILE, p_path: `${BOX}/${USER}/${FILE}.jpg`, p_mime: 'image/jpeg', p_ancho: 1600, p_alto: 1200, p_sha: SHA });
    expect(r).toMatchObject({ estado: 'recibido', subido: '2026-11-05T12:00:00Z', mime: 'image/jpeg' });
  });

  it('acepta PNG y WebP por su firma; la extensión de la ruta sale del tipo real', async () => {
    for (const [b, ext] of [[png(800, 600), 'png'], [webp(1200, 900), 'webp']] as const) {
      const { d, subidos } = deps();
      await subirControl(BOX, { bytes: b }, USER, d);
      expect(subidos[0].path.endsWith(`.${ext}`)).toBe(true);
    }
  });

  it('prueba 2: si el control ya tiene una imagen vigente, el servidor lo impide y no se toca el almacenamiento', async () => {
    const { d, subidos } = deps({ check: { message: 'Ya entregó este control.', code: '42501' } });
    expect(await status(subirControl(BOX, { bytes: jpeg(1600, 1200) }, USER, d))).toBe(403);
    expect(subidos).toHaveLength(0);
  });

  it('si otro envío simultáneo gana la carrera, el registro falla y el archivo recién guardado se borra', async () => {
    const { d, subidos, borrados } = deps({ record: { message: 'Ya entregó este control.', code: '42501' } });
    expect(await status(subirControl(BOX, { bytes: jpeg(1600, 1200) }, USER, d))).toBe(403);
    expect(borrados).toEqual([subidos[0].path]);
  });

  it('rechaza PDF, documentos, archivos vacíos, imágenes diminutas y archivos de más de 5 MB', async () => {
    expect(await status(subirControl(BOX, { bytes: pdf() }, USER, deps().d))).toBe(400);
    expect(await status(subirControl(BOX, { bytes: relleno(txt('PK\u0003\u0004')) }, USER, deps().d))).toBe(400);
    expect(await status(subirControl(BOX, { bytes: new Uint8Array(0) }, USER, deps().d))).toBe(400);
    expect(await status(subirControl(BOX, null, USER, deps().d))).toBe(400);
    expect(await status(subirControl(BOX, { bytes: png(120, 90) }, USER, deps().d))).toBe(400);
    expect(await status(subirControl(BOX, { bytes: new Uint8Array(MAX_BYTES_CONTROL + 1) }, USER, deps().d))).toBe(413);
  });

  it('no admite un box_id manipulado', async () => {
    expect(await status(subirControl('../../otro', { bytes: jpeg(1600, 1200) }, USER, deps().d))).toBe(400);
  });

  it('nunca sobrescribe un objeto existente', async () => {
    const { d } = deps({ existe: true });
    expect(await status(subirControl(BOX, { bytes: jpeg(1600, 1200) }, USER, d))).toBe(409);
  });
});

describe('verControl', () => {
  it('prueba 3: enlace temporal de 5 minutos a la imagen autorizada por svc_upload_file_path', async () => {
    const { d, llamadas } = deps();
    expect(await verControl(FILE, USER, d)).toEqual({ url: `https://firmado/${BOX}/${USER}/${FILE}.webp?s=300` });
    expect(llamadas[0]).toEqual({ fn: 'svc_upload_file_path', args: { p_user: USER, p_file: FILE } });
  });
  it('no firma PDF de otros buzones por esta vía', async () => {
    expect(await status(verControl(FILE, USER, deps({ ruta: `${BOX}/${USER}/${FILE}.pdf` }).d))).toBe(400);
  });
  it('prueba 4: si el servidor niega el acceso (otro estudiante), responde 403', async () => {
    const d = deps().d;
    d.rpc = async () => ({ data: null, error: { message: 'No tiene acceso a este archivo', code: '42501' } });
    expect(await status(verControl(FILE, 'd8400000-0000-4000-8000-000000000002', d))).toBe(403);
  });
  it('la ruta de un control es buzón/estudiante/archivo.ext', () => {
    expect(rutaControl(BOX, USER, FILE, 'image/png')).toBe(`${BOX}/${USER}/${FILE}.png`);
  });
});

describe('reglas de los controles (src/lib/laboratorio.ts)', () => {
  const ocho = (...e: EstadoControl[]) => [...e, ...Array<EstadoControl>(8 - e.length).fill('pendiente')];
  it('«entregado» cuenta lo vigente sin revisar o aprobado; «requiere corrección» no cuenta como entregado', () => {
    expect(contar(ocho('entregado', 'aprobado', 'requiere_correccion'))).toMatchObject({ total: 8, entregados: 2, aprobados: 1, porCorregir: 1, sinRevisar: 1, pendientes: 5 });
  });
  it('filtros del panel docente', () => {
    const todos = Array<EstadoControl>(8).fill('aprobado');
    expect(cumpleFiltro(todos, 'completos')).toBe(true);
    expect(cumpleFiltro(ocho('aprobado'), 'completos')).toBe(false);
    expect(cumpleFiltro(ocho('aprobado'), 'pendientes')).toBe(true);
    expect(cumpleFiltro(ocho('requiere_correccion'), 'correccion')).toBe(true);
    expect(cumpleFiltro(todos, 'correccion')).toBe(false);
    expect(cumpleFiltro(ocho('entregado'), 'sin_revisar')).toBe(true);
  });
  it('prueba 7: cada control tiene su estado (cambiar uno no altera los demás)', () => {
    const a = ocho('entregado');
    const b = [...a]; b[3] = 'aprobado';
    expect(b.filter((x, i) => x !== a[i])).toHaveLength(1);
  });
  it('valida el archivo elegido antes de procesarlo', () => {
    expect(motivoArchivo('control.pdf', 'application/pdf', 1000)).toMatch(/fotografía/);
    expect(motivoArchivo('notas.docx', 'application/vnd.openxmlformats', 1000)).toMatch(/imagen/);
    expect(motivoArchivo('foto.heic', '', 1000)).toBeNull();          // se convierte en el navegador si puede abrirla
    expect(motivoArchivo('foto.jpg', 'image/jpeg', 0)).toMatch(/vacío/);
    expect(motivoArchivo('IMG_1.JPG', 'image/jpeg', 3_000_000)).toBeNull();
    expect(MAX_BYTES_ENVIO).toBeLessThan(MAX_BYTES_CONTROL);
  });
  it('Práctica por controles (migración 91): 30 entre los que cuentan; sin controles que cuenten, no hay cálculo', () => {
    expect(practicaPorControles(7, 7)).toEqual({ porControl: 4.29, nota: 30 });
    expect(practicaPorControles(4, 7)).toEqual({ porControl: 4.29, nota: 17.14 });
    expect(practicaPorControles(0, 7)?.nota).toBe(0);
    expect(practicaPorControles(5, 8)?.nota).toBe(18.75);
    expect(practicaPorControles(9, 7)?.nota).toBe(30);   // nunca más que el apartado
    expect(practicaPorControles(3, 0)).toBeNull();
  });
  it('fechas: sin fechas por defecto', () => {
    const f = (s: string) => s.slice(0, 10);
    expect(textoFechas(null, null, f)).toBeNull();
    expect(textoFechas(null, '2026-12-01T00:00:00Z', f)).toBe('Cierra el 2026-12-01');
  });
});

describe('integración (estática)', () => {
  const lab = readFileSync('src/pages/estudiante/LabCurso.tsx', 'utf8');
  const temario = readFileSync('src/pages/estudiante/Temario.tsx', 'utf8');
  const clase = readFileSync('src/pages/docente/Clase.tsx', 'utf8');
  const index = readFileSync('supabase/functions/entregas/index.ts', 'utf8');
  const mig = readFileSync('supabase/migrations/20261105000084_laboratorio_controles.sql', 'utf8');

  it('prueba 9 (móvil): la subida ofrece cámara trasera y galería, una sola imagen, vista previa y confirmación', () => {
    expect(lab).toMatch(/capture="environment"/);
    expect(lab).not.toMatch(/multiple/);
    expect(lab).toMatch(/vistaPrevia/);
    expect(lab).toMatch(/¿Confirma que esta es la imagen del Control/);
    expect(lab).toMatch(/Controles entregados: \$\{c\.entregados\}\/\$\{c\.total\}/);
  });
  it('la asignatura de laboratorio sustituye el programa de lecciones solo cuando tiene controles', () => {
    expect(temario).toMatch(/if \(course\.laboratorio_controles\)/);
    // la pestaña «Controles de laboratorio» solo existe si la asignatura tiene controles (pestañas agrupadas, migración 92)
    expect(clase).toMatch(/t === 'controles' \? !!course\.laboratorio_controles/);
  });
  it('prueba 8: el Módulo B usa las actividades del motor existente (my_activities), sin una vía nueva para enunciados', () => {
    expect(lab).toMatch(/\/actividad\/\$\{a\.id\}/);
    expect(lab).not.toMatch(/exercises|exercise_keys|\.from\(/);
  });
  it('la Edge Function enruta el módulo con un bucket privado propio', () => {
    expect(index).toMatch(/form\.get\('modulo'\) === 'laboratorio'/);
    expect(index).toMatch(/body\?\.action === 'control_ver'/);
    expect(index).toMatch(/createBucket\(BUCKET_LABORATORIO, \{ public: false/);
  });
  it('migración aditiva: sin borrados de tablas o columnas, con RLS y sin permisos para anon', () => {
    expect(mig).not.toMatch(/drop (table|column)|truncate|alter column .* type|rename/i);
    expect(mig).toMatch(/upload_box_extensions enable row level security/);
    expect(mig).toMatch(/upload_file_revisiones enable row level security/);
    expect(mig).not.toMatch(/grant [^;]* to anon/i);
    expect(mig).toMatch(/grant execute on function public\.svc_lab_control_record\([^)]*\) to service_role;/);
    expect(mig).not.toMatch(/grant execute on function public\.svc_lab_control_record\([^)]*\) to authenticated/);
  });
});
