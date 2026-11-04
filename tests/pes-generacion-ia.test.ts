/**
 * Problemas por apartados generados con IA para la PES (orbe-ia, acción «pes_generar»): petición, verificación
 * determinista de cada apartado, simulador, flujo en la Edge Function con una base simulada, y en el aula el reparto
 * del paquete, la estimación y la edición de una propuesta conservando sus claves.
 */
import { describe, expect, it, vi } from 'vitest';
import { grade } from '../supabase/functions/_shared/calificacion/calificar.ts';
import {
  construirPeticionPes, ETAPAS, generarProblemaPes, simularProblema, validarEspecificacionPes, validarProblema,
  type ContextoPes, type EspecificacionPes,
} from '../supabase/functions/orbe-ia/pes.ts';
import type { Deps, Peticion, RespuestaModelo } from '../supabase/functions/orbe-ia/handler.ts';
import { aFormulario, estimarPes, planificarPes } from '@/lib/pesGeneracion';
import { construirEjercicio } from '@/lib/pesRedaccion';
import type { DatosEstimacion } from '@/lib/generacion';
import type { ApartadoRedactado } from '@/api/pesTipos';

const L1 = '11111111-1111-4111-8111-111111111111', L2 = '22222222-2222-4222-8222-222222222222';
const GEN = '33333333-3333-4333-8333-333333333333', PROF = '44444444-4444-4444-8444-444444444444';
const CTX: ContextoPes = {
  asignatura: 'Física General I',
  leccion: { id: L1, titulo: 'Movimiento rectilíneo uniforme', unidad: 'Cinemática', resumen: 'Posición, velocidad constante y gráficas x–t.', conceptos: [{ slug: 'mru', nombre: 'MRU' }] },
  existentes: ['Un tren recorre 120 km en 2 h…'],
};
const spec = (x: Partial<EspecificacionPes> = {}): EspecificacionPes => ({ leccion_id: L1, dificultad: 'intermedio', tipo: 'calculo', apartados: 4, ...x });

// un problema válido de 4 apartados (cálculo), escrito a mano
const vacioN = { datos: [], expresion: '', resultado: 0, unidad: '', errores: [] };
const b = { opciones: [], correcta: -1, retro: [], vf: false, justificacion: '', rubrica: '', minutos: 3, numerica: vacioN, explicacion: 'Explicación completa del apartado, con los pasos.' };
const BUENO = {
  titulo: 'Ciclista en una pista recta',
  contexto: 'Una ciclista recorre 150 m en 30 s con velocidad constante por una pista recta y horizontal.',
  apartados: [
    { ...b, etapa: 'prediccion', formato: 'choice', enunciado: 'Antes de calcular, ¿cómo es su aceleración durante el recorrido?', opciones: ['Nula', 'Positiva', 'Negativa'], correcta: 0,
      retro: ['', 'La velocidad no cambia: no hay aceleración positiva.', 'La velocidad no disminuye: no hay aceleración negativa.'] },
    { ...b, etapa: 'formulacion', formato: 'truefalse', enunciado: 'Verdadero o falso: en este movimiento la distancia es proporcional al tiempo.', vf: true,
      justificacion: 'Con velocidad constante, d = v·t: la distancia crece en proporción directa al tiempo transcurrido.' },
    { ...b, etapa: 'resolucion', formato: 'numeric', enunciado: 'Calcule la rapidez de la ciclista.',
      numerica: { datos: [{ nombre: 'd', valor: 150, unidad: 'm' }, { nombre: 't', valor: 30, unidad: 's' }], expresion: 'd/t', resultado: 5, unidad: 'm/s',
        errores: [{ expresion: 'd/(2*t)', mensaje: 'Dividió entre el doble del tiempo: use el tiempo total del recorrido.' },
          { expresion: 't/d', mensaje: 'Invirtió el cociente (unidades s/m: el servidor lo descarta por dimensiones).' }] } },
    { ...b, etapa: 'interpretacion', formato: 'open', enunciado: 'Explique qué significa físicamente el valor obtenido.',
      rubrica: '1) Interpreta 5 m/s como 5 m recorridos cada segundo. 2) Usa las unidades correctamente.' },
  ],
};

describe('PES · IA · petición al modelo', () => {
  it('solo el temario y lo existente; tipo, nivel y las etapas en orden', () => {
    const p = construirPeticionPes(spec(), CTX, 'claude-opus-5-5', 4000);
    expect(p.effort).toBe('medium');
    expect(p.user).toContain('Movimiento rectilíneo uniforme');
    expect(p.user).toContain('Exactamente 4 apartados');
    expect(p.user).toMatch(/A\) predicción cualitativa; B\) formulación de la ley o ecuación; C\) resolución matemática; D\) interpretación física/);
    expect(p.user).toContain('Un tren recorre 120 km');
    expect(p.system).toMatch(/ESCRIBE ese valor en su enunciado/);
    expect(p.user).not.toMatch(/estudiante:|correo|@/i);
  });
  it('valida la especificación', () => {
    expect(() => validarEspecificacionPes({ ...spec(), apartados: 6 })).toThrow();
    expect(() => validarEspecificacionPes({ ...spec(), tipo: 'otro' })).toThrow();
    expect(() => validarEspecificacionPes({ ...spec(), leccion_id: 'x' })).toThrow();
    expect(validarEspecificacionPes(spec({ apartados: 5 })).apartados).toBe(5);
  });
});

describe('PES · IA · verificación de cada problema', () => {
  it('acepta un problema coherente: clave numérica recalculada, selección con retroalimentación, abierta con rúbrica', () => {
    const r = validarProblema(BUENO, spec(), CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const aps = r.propuesta.problema.apartados;
    expect(r.propuesta.verificacion).toEqual(['revisar', 'revisar', 'calculo_comprobado', 'revisar']);
    expect(aps[2].clave).toMatchObject({ format: 'numeric', value: '5 m/s' });
    expect(grade(aps[2].clave!, { text: '5.0 m/s' }).status).toBe('correct');
    expect(aps[3]).toMatchObject({ formato: 'open', clave: null });
    expect(aps.map((a) => a.etapa)).toEqual(ETAPAS[4]);
    expect(aps[0].t_ref_s).toBe(180);
  });
  it('rechaza datos que el estudiante no verá, resultados mal calculados y unidades incoherentes', () => {
    const conDato = (n: object) => ({ ...BUENO, apartados: BUENO.apartados.map((a, i) => (i === 2 ? { ...a, numerica: { ...a.numerica, ...n } } : a)) });
    expect(validarProblema(conDato({ datos: [{ nombre: 'd', valor: 999, unidad: 'm' }, { nombre: 't', valor: 30, unidad: 's' }] }), spec(), CTX))
      .toMatchObject({ ok: false, motivo: expect.stringMatching(/apartado C: el dato d = 999 no aparece/) });
    expect(validarProblema(conDato({ resultado: 7 }), spec(), CTX)).toMatchObject({ ok: false, motivo: expect.stringMatching(/no coincide/) });
    expect(validarProblema(conDato({ unidad: 'm/s^2' }), spec(), CTX)).toMatchObject({ ok: false, motivo: expect.stringMatching(/dimensiones/) });
  });
  it('rechaza estructura incorrecta: número de apartados, etapa fuera de orden, dos abiertas, sin numérica, sin rúbrica', () => {
    expect(validarProblema({ ...BUENO, apartados: BUENO.apartados.slice(0, 3) }, spec(), CTX)).toMatchObject({ ok: false, motivo: expect.stringMatching(/3 apartados en lugar de 4/) });
    const cambia = (i: number, x: object) => ({ ...BUENO, apartados: BUENO.apartados.map((a, j) => (j === i ? { ...a, ...x } : a)) });
    expect(validarProblema(cambia(0, { etapa: 'resolucion' }), spec(), CTX)).toMatchObject({ ok: false, motivo: expect.stringMatching(/apartado A: etapa/) });
    expect(validarProblema(cambia(1, { formato: 'open', rubrica: 'Rúbrica suficientemente larga para pasar la validación.' }), spec(), CTX))
      .toMatchObject({ ok: false, motivo: expect.stringMatching(/más de un apartado abierto/) });
    expect(validarProblema(cambia(2, { formato: 'truefalse', vf: false, justificacion: 'Justificación modelo larga de al menos cuarenta caracteres.' }), spec(), CTX))
      .toMatchObject({ ok: false, motivo: expect.stringMatching(/al menos un apartado numérico/) });
    expect(validarProblema(cambia(3, { rubrica: 'corta' }), spec(), CTX)).toMatchObject({ ok: false, motivo: expect.stringMatching(/rúbrica/) });
    expect(validarProblema(cambia(0, { retro: ['', '', 'x'] }), spec(), CTX)).toMatchObject({ ok: false, motivo: expect.stringMatching(/retroalimentación/) });
    expect(validarProblema(cambia(1, { enunciado: BUENO.apartados[0].enunciado, formato: 'choice', opciones: ['Nula', 'Positiva', 'Negativa'], correcta: 0,
      retro: ['', 'La velocidad no cambia: no hay aceleración positiva.', 'La velocidad no disminuye: no hay aceleración negativa.'] }), spec(), CTX))
      .toMatchObject({ ok: false, motivo: expect.stringMatching(/mismo enunciado/) });
  });
  it('tipos: «datos» exige la tabla; «conceptual» admite como mucho un apartado numérico', () => {
    expect(validarProblema(BUENO, spec({ tipo: 'datos' }), CTX)).toMatchObject({ ok: false, motivo: expect.stringMatching(/tabla/) });
    expect(validarProblema(BUENO, spec({ tipo: 'conceptual' }), CTX).ok).toBe(true);
  });
  it('el simulador produce problemas válidos para cada tipo y número de apartados', () => {
    for (const tipo of ['calculo', 'conceptual', 'datos', 'errores', 'transferencia'] as const) for (const k of [3, 4, 5] as const) {
      const s = spec({ tipo, apartados: k });
      const r = validarProblema(JSON.parse(simularProblema(s, CTX, 3)), s, CTX);
      expect(r.ok, `${tipo}/${k}: ${r.ok ? '' : r.motivo}`).toBe(true);
    }
  });
});

describe('PES · IA · un problema en la Edge Function', () => {
  function servidor(o: { reserva?: Record<string, unknown>; texto?: string; stop?: string } = {}) {
    const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
    const modelo = vi.fn(async (_p: Peticion): Promise<RespuestaModelo> => ({ texto: o.texto ?? '{}', stop_reason: o.stop ?? 'end_turn', input_tokens: 2500, output_tokens: 2200 }));
    const deps: Deps = {
      hayClave: true, llamarModelo: modelo,
      rpc: async (fn, args) => {
        llamadas.push({ fn, args });
        if (fn === 'svc_pes_generar_contexto') return { data: CTX, error: null };
        if (fn === 'svc_orbe_ia_reservar_uso') return { data: { ok: true, usage_id: 9, api_real: false, model: 'claude-opus-5-5', max_tokens: 4000, precio_entrada: 4, precio_salida: 20, ...o.reserva }, error: null };
        if (fn === 'svc_pes_generar_guardar') return { data: { id: args.p_propuesta ? 'prop-1' : null }, error: null };
        if (fn === 'svc_orbe_ia_finalizar_uso') return { data: null, error: null };
        return { data: null, error: { message: 'desconocida' } };
      },
    };
    return { deps, llamadas, modelo };
  }
  const body = { action: 'pes_generar', generacion_id: GEN, especificacion: spec() };

  it('simulador: guarda la propuesta verificada, sin llamar a la API y con coste 0', async () => {
    const s = servidor();
    expect(await generarProblemaPes(body, PROF, s.deps)).toMatchObject({ ok: true, simulado: true, propuesta_id: 'prop-1', verificados: 1, costo_usd: 0 });
    expect(s.modelo).not.toHaveBeenCalled();
    expect(s.llamadas.find((c) => c.fn === 'svc_orbe_ia_reservar_uso')!.args).toMatchObject({ p_purpose: 'generar' });
    expect(s.llamadas.find((c) => c.fn === 'svc_pes_generar_contexto')!.args).toEqual({ p_actor: PROF, p_generacion: GEN, p_leccion: L1 });
  });
  it('API real: propuesta con coste real; un problema que no pasa la verificación se cuenta como rechazado (con su motivo)', async () => {
    const s = servidor({ reserva: { api_real: true }, texto: JSON.stringify(BUENO) });
    const r = await generarProblemaPes(body, PROF, s.deps);
    expect(r).toMatchObject({ ok: true, simulado: false, propuesta_id: 'prop-1' });
    expect(r.costo_usd).toBeCloseTo((2500 * 4 + 2200 * 20) / 1e6, 10);
    expect(s.modelo.mock.calls[0][0].schema).toBeDefined();
    const sim = servidor({ reserva: { api_real: true }, texto: simularProblema(spec(), CTX, 2) });
    expect(await generarProblemaPes(body, PROF, sim.deps)).toMatchObject({ ok: true, rechazado: expect.stringMatching(/simulación/) });
    const malo = servidor({ reserva: { api_real: true }, texto: JSON.stringify({ ...BUENO, apartados: BUENO.apartados.slice(0, 2) }) });
    const r2 = await generarProblemaPes(body, PROF, malo.deps);
    expect(r2).toMatchObject({ ok: true, rechazado: expect.stringMatching(/2 apartados/) });
    expect(malo.llamadas.find((c) => c.fn === 'svc_pes_generar_guardar')!.args).toMatchObject({ p_propuesta: null, p_motivo: expect.stringMatching(/2 apartados/) });
  });
  it('respuesta cortada, sin presupuesto o sin clave: no guarda nada', async () => {
    const c = servidor({ reserva: { api_real: true }, texto: '{"titulo":', stop: 'max_tokens' });
    expect(await generarProblemaPes(body, PROF, c.deps)).toEqual({ ok: false, motivo: 'respuesta_cortada' });
    expect(c.llamadas.some((x) => x.fn === 'svc_pes_generar_guardar')).toBe(false);
    const p = servidor({ reserva: { ok: false, motivo: 'presupuesto' } });
    expect(await generarProblemaPes(body, PROF, p.deps)).toEqual({ ok: false, motivo: 'presupuesto' });
    const k = servidor({ reserva: { api_real: true } });
    k.deps.hayClave = false;
    expect(await generarProblemaPes(body, PROF, k.deps)).toEqual({ ok: false, motivo: 'sin_clave' });
  });
});

describe('PES · IA · en el aula: paquete, coste y edición', () => {
  it('reparte el paquete por igual entre lecciones, dificultades y tipos', () => {
    const p = planificarPes(10, [L1, L2], ['basico', 'desafiante'], ['calculo', 'datos'], 4);
    expect(p).toHaveLength(10);
    expect(p.filter((x) => x.leccion_id === L1)).toHaveLength(5);
    expect(p.filter((x) => x.dificultad === 'basico')).toHaveLength(5);
    expect(p.filter((x) => x.tipo === 'datos')).toHaveLength(5);
    expect(p.every((x) => x.apartados === 4)).toBe(true);
    expect(planificarPes(80, [L1], ['basico'], ['calculo'], 3)).toHaveLength(50);
    expect(planificarPes(5, [], ['basico'], ['calculo'], 3)).toEqual([]);
  });
  it('estima el coste antes de empezar y avisa del presupuesto y del límite diario', () => {
    const d: DatosEstimacion = { encendido: true, api_real: true, modelo: 'm', precio_entrada: 5, precio_salida: 25, max_salida: 4000, presupuesto_mes: 0.5, gastado_mes: 0.2, llamadas_hoy: 95, limite_diario: 100, por_lote: 4 };
    const e = estimarPes(10, 4, d);
    expect(e.llamadas).toBe(10);
    expect(e.costoTipico).toBeCloseTo(10 * (2500 * 5 + (4 * 550 + 900) * 25) / 1e6, 10);
    expect(e.costoMaximo).toBeCloseTo(10 * (4000 * 5 + 4000 * 25) / 1e6, 10);
    expect(e.cabeHoy).toBe(false);
    expect(e.cabePresupuesto).toBe(false);
    expect(estimarPes(10, 4, { ...d, api_real: false }).costoMaximo).toBe(0);
  });
  it('editar una propuesta: el formulario la reproduce y, si no cambia la respuesta, conserva la clave completa (errores típicos)', () => {
    const r = validarProblema(BUENO, spec(), CTX);
    if (!r.ok) throw new Error(r.motivo);
    const prop = r.propuesta.problema as unknown as { titulo: string; contexto: string; apartados: ApartadoRedactado[] };
    const f = aFormulario(prop);
    expect(f.aps[2].valor).toBe('5 m/s');
    const sin = construirEjercicio(f.aps);
    expect(sin.ok).toBe(true);
    if (!sin.ok) return;
    expect((sin.apartados[2].clave as { commonErrors?: unknown[] }).commonErrors?.length).toBe(1);
    expect((sin.apartados[0].clave as { optionFeedback?: Record<number, string> }).optionFeedback?.[1]).toMatch(/no hay aceleración positiva/);
    // si el profesor cambia el valor, la clave se rehace (sin los errores típicos del valor anterior)
    const cambiado = construirEjercicio(f.aps.map((a, i) => (i === 2 ? { ...a, valor: '5.5 m/s' } : a)));
    expect(cambiado.ok && (cambiado.apartados[2].clave as { value: string; commonErrors?: unknown[] })).toMatchObject({ value: '5.5 m/s' });
    expect(cambiado.ok && (cambiado.apartados[2].clave as { commonErrors?: unknown[] }).commonErrors).toBeUndefined();
  });
});
