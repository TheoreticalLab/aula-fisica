/** Respuesta oral (migración 86) y piezas generales del examen de laboratorio: Edge Functions con dobles, reglas puras
 *  e integración estática. El servidor se prueba en supabase/pruebas/respuesta_oral.sql y examen_bloqueo_salida.sql. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../supabase/functions/entregas/handler';
import type { DepsCapturas } from '../supabase/functions/entregas/capturas';
import { purgarAudios, rutaAudio, subirAudio, tipoAudio, verAudio, MAX_BYTES_AUDIO } from '../supabase/functions/entregas/audio';
import { grade, validateAnswerShape } from '../supabase/functions/_shared/calificacion/calificar';
import { handle, type Db } from '../supabase/functions/calificar/handler';
import { CONFIG_AUDIO_POR_DEFECTO, elegirMime, mmss, motivoDuracion, motivoMicrofono, restantes } from '../src/lib/audio';
import { abrir, crearMotor, irA, puedeIrA, siguiente, type EstadoMotor } from '../src/lib/examen/motor';
import { contarPalabras } from '../src/lib/util';

const AT = 'a1000000-0000-4000-8000-0000000000a1';
const EX = 'e1000000-0000-4000-8000-0000000000e1';
const U = 'b1000000-0000-4000-8000-000000000001';
const F = 'f1000000-0000-4000-8000-0000000000f1';
const SHA = 'c'.repeat(64);

const relleno = (cab: number[], n = 256) => { const b = new Uint8Array(n); b.set(cab); return b; };
const txt = (s: string) => [...s].map((c) => c.charCodeAt(0));
const webm = () => relleno([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
const mp4 = () => relleno([0, 0, 0, 0x20, ...txt('ftypM4A ')]);
const ogg = () => relleno(txt('OggS'));
const wav = () => relleno([...txt('RIFF'), 0, 0, 0, 0, ...txt('WAVE')]);
const pdf = () => relleno(txt('%PDF-1.7'));

function deps(over: { check?: { message: string; code: string }; record?: { message: string; code: string }; ruta?: string } = {}) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const subidos: { path: string; mime: string }[] = [];
  const borrados: string[] = [];
  const d: DepsCapturas = {
    rpc: async (fn, args) => {
      llamadas.push({ fn, args });
      if (fn === 'svc_audio_check') return over.check ? { data: null, error: over.check } : { data: { min_s: 60, max_s: 120, usadas: 0 }, error: null };
      if (fn === 'svc_audio_record') return over.record ? { data: null, error: over.record } : { data: { id: args.p_id, subido: '2026-11-05T20:00:00Z', duracion_ms: args.p_duracion_ms }, error: null };
      if (fn === 'svc_audio_path') return { data: over.ruta ?? `${AT}/${U}/${F}.webm`, error: null };
      if (fn === 'svc_audio_caducados') return { data: [{ id: F, path: `${AT}/${U}/${F}.webm` }], error: null };
      if (fn === 'svc_audio_marcar_eliminados') return { data: (args.p_ids as string[]).length, error: null };
      return { data: null, error: { message: 'desconocida', code: 'XX' } };
    },
    ensureBucket: async () => undefined,
    upload: async (path, _b, mime) => { subidos.push({ path, mime }); return 'nuevo'; },
    remove: async (paths) => { borrados.push(...paths); },
    signedUrl: async (path, s) => `https://firmado/${path}?s=${s}`,
    newId: () => F,
    sha256: async () => SHA,
  };
  return { d, llamadas, subidos, borrados };
}
const status = async (p: Promise<unknown>) => { try { await p; return 0; } catch (e) { return e instanceof HttpError ? e.status : -1; } };

describe('Edge Function «entregas» · módulo audio', () => {
  it('reconoce el audio por su firma (no por la extensión) y rechaza lo demás', () => {
    expect(tipoAudio(webm())).toBe('audio/webm');
    expect(tipoAudio(mp4())).toBe('audio/mp4');
    expect(tipoAudio(ogg())).toBe('audio/ogg');
    expect(tipoAudio(wav())).toBe('audio/wav');
    expect(tipoAudio(pdf())).toBeNull();
    expect(tipoAudio(new Uint8Array(4))).toBeNull();
  });
  it('sube: comprueba antes en el servidor, guarda en privado con ruta intento/estudiante/archivo y registra', async () => {
    const { d, llamadas, subidos } = deps();
    const r = await subirAudio({ attempt_id: AT, exercise_id: EX, duracion_ms: '75000' }, { bytes: webm() }, U, d);
    expect(llamadas.map((l) => l.fn)).toEqual(['svc_audio_check', 'svc_audio_record']);
    expect(subidos).toEqual([{ path: rutaAudio(AT, U, F, 'audio/webm'), mime: 'audio/webm' }]);
    expect(llamadas[1].args).toMatchObject({ p_user: U, p_attempt: AT, p_exercise: EX, p_mime: 'audio/webm', p_duracion_ms: 75000, p_sha: SHA });
    expect(r).toMatchObject({ id: F, duracion_ms: 75000 });
  });
  it('si el servidor lo niega (otro intento, duración, sin grabaciones), no toca el almacenamiento', async () => {
    const { d, subidos } = deps({ check: { message: 'Ya usó las 2 grabaciones permitidas', code: '42501' } });
    expect(await status(subirAudio({ attempt_id: AT, exercise_id: EX, duracion_ms: 75000 }, { bytes: webm() }, U, d))).toBe(403);
    expect(subidos).toHaveLength(0);
  });
  it('si el registro falla, el archivo recién guardado se borra', async () => {
    const { d, subidos, borrados } = deps({ record: { message: 'Ruta no válida', code: '22023' } });
    expect(await status(subirAudio({ attempt_id: AT, exercise_id: EX, duracion_ms: 75000 }, { bytes: webm() }, U, d))).toBe(400);
    expect(borrados).toEqual([subidos[0].path]);
  });
  it('rechaza PDF, vacío, más de 20 MB, duración inválida e ids manipulados', async () => {
    expect(await status(subirAudio({ attempt_id: AT, exercise_id: EX, duracion_ms: 75000 }, { bytes: pdf() }, U, deps().d))).toBe(400);
    expect(await status(subirAudio({ attempt_id: AT, exercise_id: EX, duracion_ms: 75000 }, null, U, deps().d))).toBe(400);
    expect(await status(subirAudio({ attempt_id: AT, exercise_id: EX, duracion_ms: 75000 }, { bytes: new Uint8Array(MAX_BYTES_AUDIO + 1) }, U, deps().d))).toBe(413);
    expect(await status(subirAudio({ attempt_id: AT, exercise_id: EX, duracion_ms: 'mucho' }, { bytes: webm() }, U, deps().d))).toBe(400);
    expect(await status(subirAudio({ attempt_id: '../x', exercise_id: EX, duracion_ms: 75000 }, { bytes: webm() }, U, deps().d))).toBe(400);
  });
  it('escuchar: enlace de 5 minutos autorizado por svc_audio_path; nunca firma otra cosa', async () => {
    expect(await verAudio(F, U, deps().d)).toEqual({ url: `https://firmado/${AT}/${U}/${F}.webm?s=300` });
    expect(await status(verAudio(F, U, deps({ ruta: `${AT}/${U}/${F}.pdf` }).d))).toBe(400);
    const d = deps().d;
    d.rpc = async () => ({ data: null, error: { message: 'No tiene acceso a esta grabación', code: '42501' } });
    expect(await status(verAudio(F, 'b1000000-0000-4000-8000-000000000002', d))).toBe(403);
  });
  it('conservación: mínimo 180 días; borra los archivos y después los marca', async () => {
    expect(await status(purgarAudios(30, U, deps().d))).toBe(400);
    const { d, borrados, llamadas } = deps();
    expect(await purgarAudios(365, U, d)).toEqual({ borrados: 1 });
    expect(borrados).toEqual([`${AT}/${U}/${F}.webm`]);
    expect(llamadas.map((l) => l.fn)).toEqual(['svc_audio_caducados', 'svc_audio_marcar_eliminados']);
  });
});

describe('motor de calificación con respuestas orales', () => {
  it('con grabación queda pendiente de revisión docente; sin ella, inválida', () => {
    expect(grade({ format: 'audio', rubric: 'r' }, { audio_id: F, duracion_ms: 75000 }).status).toBe('pending_review');
    expect(grade({ format: 'audio', rubric: 'r' }, {}).status).toBe('invalid');
  });
  it('la forma de la respuesta admite audio_id (uuid) y duracion_ms; rechaza basura', () => {
    expect(validateAnswerShape({ audio_id: F, duracion_ms: 61000 })).toEqual({ audio_id: F, duracion_ms: 61000 });
    expect(validateAnswerShape({ audio_id: '../../otro' })).toBeNull();
    expect(validateAnswerShape({ audio_id: F, duracion_ms: -1 })).toBeNull();
  });
});

describe('grabador (reglas puras)', () => {
  it('elige el formato que admite el navegador: WebM-Opus, o MP4 en Safari', () => {
    expect(elegirMime((m) => m.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(elegirMime((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(elegirMime(() => false)).toBeNull();
  });
  it('por defecto: de 1 a 2 minutos; fuera de rango no se envía', () => {
    expect(CONFIG_AUDIO_POR_DEFECTO).toMatchObject({ min_s: 60, max_s: 120 });
    expect(motivoDuracion(75_000, CONFIG_AUDIO_POR_DEFECTO)).toBeNull();
    expect(motivoDuracion(30_000, CONFIG_AUDIO_POR_DEFECTO)).toMatch(/al menos 1:00/);
    expect(motivoDuracion(130_000, CONFIG_AUDIO_POR_DEFECTO)).toMatch(/no puede pasar de 2:00/);
    expect(mmss(75_000)).toBe('1:15');
    expect(restantes(CONFIG_AUDIO_POR_DEFECTO, 1)).toBe(1);
    expect(restantes(CONFIG_AUDIO_POR_DEFECTO, 3)).toBe(0);
  });
  it('micrófono denegado o ausente: mensaje claro y la incidencia que se anota', () => {
    expect(motivoMicrofono('NotAllowedError')).toMatchObject({ incidencia: 'microfono_denegado' });
    expect(motivoMicrofono('NotFoundError').texto).toMatch(/No se encontró ningún micrófono/);
    expect(motivoMicrofono(undefined).incidencia).toBe('microfono_error');
  });
});

describe('desarrollo escrito: contador orientativo de palabras', () => {
  it('cuenta palabras, no signos sueltos', () => {
    expect(contarPalabras('')).toBe(0);
    expect(contarPalabras('  La energía   se conserva — siempre. ')).toBe(5);   // la raya no cuenta
    expect(contarPalabras('Ep = ½kx² y Ec = ½mv²')).toBe(5);
  });
});

describe('navegación «en orden, sin saltar» en el navegador (el servidor también la exige)', () => {
  const cfg = { presentacion: 'una_a_la_vez' as const, navegacion: 'solo_adelante' as const, duracion_s: 3600,
    pausas: { permitidas: false, max_numero: 0, max_total_s: 0, detienen_reloj: false }, sin_saltos: true };
  const orden = ['q1', 'q2', 'q3', 'q4'];
  const motor = (): EstadoMotor => abrir(crearMotor(orden), 0, { activa: 'q1' });
  it('solo la siguiente; ni saltar ni volver', () => {
    const e = motor();
    expect(puedeIrA(e, 'q3', cfg)).toMatch(/solo puede pasar a la siguiente/);
    expect(puedeIrA(e, 'q2', cfg)).toBeNull();
    const r = siguiente(e, 1000, cfg);
    expect(r.ok && r.estado.activa).toBe('q2');
    if (r.ok) expect(puedeIrA(r.estado, 'q1', cfg)).toMatch(/no se puede volver/);
    expect(irA(e, 1000, 'q4', cfg).ok).toBe(false);
  });
  it('sin la opción, «solo adelante» sigue permitiendo saltar como antes (otros exámenes no cambian)', () => {
    expect(puedeIrA(motor(), 'q3', { ...cfg, sin_saltos: false })).toBeNull();
  });
});

describe('Edge Function «calificar» · finalizar_vencidos', () => {
  it('solo entrega lo que el servidor declara vencido, con el id de cada estudiante', async () => {
    const S1 = '66666666-6666-4666-8666-666666666666';
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const db: Db = {
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        const r: Record<string, unknown> = {
          svc_finalize_vencidos_context: [{ attempt_id: AT, user_id: S1 }],
          svc_submit_context: { mode: 'exam', items: [] },
          svc_record_submission: { status: 'submitted' },
        };
        return { data: r[fn] ?? null, error: null };
      },
    };
    const out = (await handle({ action: 'finalizar_vencidos', activity_id: EX }, U, db)) as { finalized: number };
    expect(out.finalized).toBe(1);
    expect(calls[0]).toMatchObject({ fn: 'svc_finalize_vencidos_context', args: { p_teacher: U, p_activity: EX } });
    expect(calls[1].args.p_user).toBe(S1);
  });
});

describe('integración (estática)', () => {
  const index = readFileSync('supabase/functions/entregas/index.ts', 'utf8');
  const mig = readFileSync('supabase/migrations/20261105000086_respuesta_oral_audio.sql', 'utf8');
  const grab = readFileSync('src/components/GrabadorAudio.tsx', 'utf8');
  const editor = readFileSync('src/pages/docente/EjercicioEditor.tsx', 'utf8');
  const util = readFileSync('src/lib/util.ts', 'utf8');
  it('almacenamiento privado propio para los audios', () => {
    expect(index).toMatch(/createBucket\(BUCKET_AUDIO, \{ public: false/);
    expect(index).toMatch(/form\.get\('modulo'\) === 'audio'/);
    expect(index).toMatch(/body\?\.action === 'audio_ver'/);
  });
  it('el creador de preguntas ofrece la modalidad oral con su configuración (sin activarla en preguntas existentes)', () => {
    expect(util).toMatch(/audio: 'Respuesta oral/);
    expect(editor).toMatch(/ConfigAudioEditor/);
    expect(mig).toMatch(/add value if not exists 'audio'/);
    expect(mig).toMatch(/add column if not exists audio_config jsonb/);
    expect(mig).not.toMatch(/update public\.exercises/i);
  });
  it('el grabador: cronómetro, micrófono activo, detener, escuchar antes de enviar, repetir si quedan grabaciones', () => {
    expect(grab).toMatch(/Micrófono activo/);
    expect(grab).toMatch(/Detener grabación/);
    expect(grab).toMatch(/<audio controls src=\{toma\.url\}/);
    expect(grab).toMatch(/Grabar de nuevo/);
    expect(grab).toMatch(/examIncidencia/);
  });
  it('migración aditiva, sin permisos para anon y con las funciones de servidor solo para service_role', () => {
    expect(mig).not.toMatch(/drop (table|column)|truncate|alter column .* type|rename/i);
    expect(mig).toMatch(/response_audios enable row level security/);
    expect(mig).not.toMatch(/grant [^;]* to anon/i);
    for (const f of ['svc_audio_check', 'svc_audio_record', 'svc_audio_path', 'svc_audio_caducados', 'svc_audio_marcar_eliminados']) {
      expect(mig).not.toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to authenticated`));
    }
  });
});
