/**
 * Generación de preguntas con IA: reparto y coste (cliente), análisis dimensional, verificación de cada pregunta
 * (capa C) y el flujo de un lote en la Edge Function con un servidor simulado.
 */
import { describe, expect, it, vi } from 'vitest';
import { estimar, intercalar, lotes, planificar, reparto, TOKENS, type DatosEstimacion } from '@/lib/generacion';
import { evaluarConDimensiones } from '../supabase/functions/_shared/calificacion/dimensional.ts';
import { grade } from '../supabase/functions/_shared/calificacion/calificar.ts';
import { datoEnEnunciado, generarPreguntas, simularLote, validarLote, validarPregunta, type Contexto, type Especificacion } from '../supabase/functions/orbe-ia/generar.ts';
import type { Deps, Peticion, RespuestaModelo } from '../supabase/functions/orbe-ia/handler.ts';

const L1 = '11111111-1111-4111-8111-111111111111', L2 = '22222222-2222-4222-8222-222222222222';
const RUN = '33333333-3333-4333-8333-333333333333', PROF = '44444444-4444-4444-8444-444444444444';
const CTX: Contexto = {
  asignatura: 'Física General I',
  lecciones: [
    { id: L1, titulo: 'Movimiento rectilíneo uniforme', unidad: 'Cinemática', resumen: 'Rapidez constante.', conceptos: [{ slug: 'mru', nombre: 'MRU' }] },
    { id: L2, titulo: 'Plano inclinado', unidad: 'Dinámica', resumen: 'Componentes del peso.', conceptos: [{ slug: 'plano', nombre: 'Plano inclinado' }] },
  ],
  existentes: ['Un tren recorre 300 km en 2 h. ¿Cuál es su rapidez media?'],
};
const vacia = { datos: [], expresion: '', resultado: 0, unidad: '', errores: [] };
const base = { conceptos: ['mru'], pistas: ['Use la definición de rapidez.'], explicacion: 'La rapidez constante es la distancia recorrida dividida entre el tiempo empleado.', opciones: [], correcta: -1, retro: [], vf: false, justificacion: '' };
const numerica = (o: Partial<typeof vacia> & Record<string, unknown> = {}, enunciado = 'Un ciclista recorre 120 m en 8 s con rapidez constante. ¿Cuál es su rapidez?') => ({
  ...base, enunciado,
  numerica: { datos: [{ nombre: 'd', valor: 120, unidad: 'm' }, { nombre: 't', valor: 8, unidad: 's' }], expresion: 'd/t', resultado: 15, unidad: 'm/s',
    errores: [{ expresion: 'd/(2*t)', mensaje: 'Dividió también entre 2, como si fuera una rapidez media con aceleración.' },
      { expresion: 't/d', mensaje: 'Otra dimensión (s/m): el motor nunca la compararía, se descarta.' }, { expresion: 'd/t', mensaje: 'Este coincide con la correcta y se descarta.' }], ...o },
});
const sN: Especificacion = { leccion_id: L1, dificultad: 'basico', formato: 'numeric' };

describe('reparto, lotes y coste (cliente)', () => {
  it('reparte exactamente n con el mayor resto e intercala las categorías', () => {
    expect(reparto(10, { a: 30, b: 50, c: 20 })).toEqual({ a: 3, b: 5, c: 2 });
    expect(Object.values(reparto(7, { a: 1, b: 1, c: 1 })).reduce((s, x) => s + x, 0)).toBe(7);
    const seq = intercalar({ a: 2, b: 2 });
    expect(seq).toHaveLength(4);
    expect(seq[0]).not.toBe(seq[1]);
  });
  it('100 preguntas en 2 lecciones: 50 y 50, niveles 30/50/20 y formatos pedidos; lotes de la misma lección de hasta 4', () => {
    const p = planificar(100, [L1, L2], { basico: 30, intermedio: 50, desafiante: 20 }, { numeric: 60, choice: 30, truefalse: 10 });
    expect(p).toHaveLength(100);
    expect(p.filter((s) => s.leccion_id === L1)).toHaveLength(50);
    expect(p.filter((s) => s.dificultad === 'basico')).toHaveLength(30);
    expect(p.filter((s) => s.formato === 'truefalse')).toHaveLength(10);
    // cada lección recibe una mezcla, no un solo nivel
    expect(new Set(p.filter((s) => s.leccion_id === L2).map((s) => s.dificultad)).size).toBe(3);
    const g = lotes(p, 4);
    expect(g).toHaveLength(26);   // 13 por lección (12 de 4 + 1 de 2)
    expect(g.every((x) => x.length <= 4 && new Set(x.map((s) => s.leccion_id)).size === 1)).toBe(true);
  });
  it('estima el coste con los precios del modelo y avisa de límites y presupuesto', () => {
    const d: DatosEstimacion = { encendido: true, api_real: true, modelo: 'claude-opus-5-5', precio_entrada: 4, precio_salida: 20, max_salida: 4000,
      presupuesto_mes: 1, gastado_mes: 0.5, llamadas_hoy: 190, limite_diario: 200, por_lote: 4 };
    const g = lotes(planificar(100, [L1, L2], { basico: 1, intermedio: 1, desafiante: 1 }, { numeric: 1, choice: 0, truefalse: 0 }), 4);
    const e = estimar(g, d);
    const salida = 24 * (4 * TOKENS.salidaPorPregunta + TOKENS.razonamiento) + 2 * (2 * TOKENS.salidaPorPregunta + TOKENS.razonamiento);
    expect(e.llamadas).toBe(26);
    expect(e.costoTipico).toBeCloseTo((26 * TOKENS.entradaTipica * 4 + salida * 20) / 1e6, 10);
    expect(e.costoMaximo).toBeCloseTo((26 * TOKENS.entradaMaxima * 4 + 26 * 4000 * 20) / 1e6, 10);
    expect(e.cabeHoy).toBe(false);
    expect(e.cabePresupuesto).toBe(false);
    expect(e.avisos.join(' ')).toMatch(/quedan 10/);
    const sim = estimar(g, { ...d, api_real: false });
    expect(sim.costoTipico).toBe(0);
    expect(sim.avisos.join(' ')).toMatch(/SIMULACIÓN/);
  });
});

describe('análisis dimensional', () => {
  const m = (v: number) => ({ v, d: [0, 1, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number] });
  const s = (v: number) => ({ v, d: [0, 0, 1, 0, 0, 0, 0] as [number, number, number, number, number, number, number] });
  it('calcula valor y dimensiones', () => {
    const r = evaluarConDimensiones('d/t^2', { d: m(10), t: s(2) });
    expect(r.v).toBe(2.5);
    expect(r.d).toEqual([0, 1, -2, 0, 0, 0, 0]);
    expect(evaluarConDimensiones('sqrt(d*d)', { d: m(3) }).d).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });
  it('rechaza sumas incoherentes, trigonometría con dimensiones y raíces impares', () => {
    expect(() => evaluarConDimensiones('d+t', { d: m(1), t: s(1) })).toThrow(/dimensiones distintas/);
    expect(() => evaluarConDimensiones('sin(d)', { d: m(1) })).toThrow(/adimensional/);
    expect(() => evaluarConDimensiones('sqrt(d)', { d: m(1) })).toThrow(/impares/);
    expect(() => evaluarConDimensiones('constructor', {})).toThrow(/desconocida/);
  });
});

describe('verificación de cada pregunta (capa C)', () => {
  it('numérica correcta: clave construida por el servidor, aceptada por el motor; errores típicos filtrados', () => {
    const r = validarPregunta(numerica(), sN, CTX, new Set());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item.verificacion).toBe('calculo_comprobado');
    expect(r.item.answer).toMatchObject({ format: 'numeric', value: '15 m/s' });
    expect(grade(r.item.answer, { text: '54 km/h' }).status).toBe('correct');
    const errores = (r.item.answer as { commonErrors: { value: string }[] }).commonErrors;
    expect(errores.map((e) => e.value)).toEqual(['7.5 m/s']);
    expect(r.item.unit_hint).toBe('m/s');
  });
  it('rechaza: resultado que no cuadra, dimensiones incoherentes, dato ausente del enunciado, unidad desconocida', () => {
    expect(validarPregunta(numerica({ resultado: 12 }), sN, CTX, new Set())).toMatchObject({ ok: false, motivo: expect.stringMatching(/no coincide/) });
    expect(validarPregunta(numerica({ expresion: 'd*t' }), sN, CTX, new Set())).toMatchObject({ ok: false, motivo: expect.stringMatching(/dimensiones/) });
    expect(validarPregunta(numerica({}, 'Un ciclista recorre 120 m con rapidez constante durante un rato. ¿Cuál es su rapidez?'), sN, CTX, new Set()))
      .toMatchObject({ ok: false, motivo: expect.stringMatching(/no aparece en el enunciado/) });
    expect(validarPregunta(numerica({ unidad: 'furlong' }), sN, CTX, new Set())).toMatchObject({ ok: false, motivo: expect.stringMatching(/desconocida/) });
  });
  it('ángulos: datos en grados, funciones trigonométricas y resultado en grados con tolerancia absoluta', () => {
    const p = { ...base, conceptos: ['plano'], enunciado: 'Un bloque sube 3 m por un plano inclinado de 30° de inclinación. ¿Qué altura gana?',
      numerica: { datos: [{ nombre: 'L', valor: 3, unidad: 'm' }, { nombre: 'th', valor: 30, unidad: '°' }], expresion: 'L*sin(th)', resultado: 1.5, unidad: 'm', errores: [{ expresion: 'L*cos(th)', mensaje: 'Usó el coseno: la altura es el cateto opuesto al ángulo.' }] } };
    const r = validarPregunta(p, { leccion_id: L2, dificultad: 'intermedio', formato: 'numeric' }, CTX, new Set());
    expect(r.ok && r.item.answer).toMatchObject({ value: '1.5 m' });
    const ang = { ...p, enunciado: 'Un bloque sube 3 m por un plano y gana 1.5 m de altura. ¿Cuál es la inclinación del plano?',
      numerica: { datos: [{ nombre: 'L', valor: 3, unidad: 'm' }, { nombre: 'h', valor: 1.5, unidad: 'm' }], expresion: 'asin(h/L)', resultado: 30, unidad: '°', errores: [] } };
    const r2 = validarPregunta(ang, { leccion_id: L2, dificultad: 'intermedio', formato: 'numeric' }, CTX, new Set());
    expect(r2.ok && r2.item.answer).toMatchObject({ value: '30 °', relTol: 0, absTol: 0.0175 });
  });
  it('selección: exige opciones distintas y retroalimentación por cada incorrecta; queda «revisar»', () => {
    const sel = { ...base, enunciado: '¿Qué magnitud permanece constante en un movimiento rectilíneo uniforme?', numerica: vacia, opciones: ['La velocidad', 'La aceleración no nula', 'La posición', 'El tiempo'], correcta: 0,
      retro: ['', 'En el MRU la aceleración es cero.', 'La posición cambia con el tiempo.', 'El tiempo no es una magnitud del móvil.'] };
    const sC: Especificacion = { leccion_id: L1, dificultad: 'basico', formato: 'choice' };
    const r = validarPregunta(sel, sC, CTX, new Set());
    expect(r.ok && r.item).toMatchObject({ verificacion: 'revisar', answer: { format: 'choice', correct: [0] }, options: sel.opciones });
    expect(validarPregunta({ ...sel, retro: ['', 'Solo una.'] }, sC, CTX, new Set())).toMatchObject({ ok: false });
    expect(validarPregunta({ ...sel, opciones: ['A', 'A', 'B', 'C'] }, sC, CTX, new Set())).toMatchObject({ ok: false, motivo: expect.stringMatching(/repetidas/) });
  });
  it('conceptos ajenos a la lección se descartan; un enunciado repetido se rechaza', () => {
    const r = validarPregunta({ ...numerica(), conceptos: ['mru', 'inventado'] }, sN, CTX, new Set());
    expect(r.ok && r.item.concepts).toEqual(['mru']);
    const lote = validarLote(JSON.stringify({ preguntas: [numerica(), numerica()] }), [sN, sN], CTX);
    expect(lote.aceptados).toHaveLength(1);
    expect(lote.rechazados[0].motivo).toMatch(/repite/);
  });
  it('datos en el enunciado con coma decimal; un número dentro de otro no cuenta', () => {
    expect(datoEnEnunciado(2.5, 'una masa de 2,5 kg')).toBe(true);
    expect(datoEnEnunciado(5, 'recorre 25 m')).toBe(false);
    // aparece primero dentro de otro número y después suelto
    expect(datoEnEnunciado(2, 'recorre 12 m en 2 s')).toBe(true);
    expect(datoEnEnunciado(9.8, 'con g = 9.8 m/s^2')).toBe(true);
  });
  it('el simulador cumple sus propias reglas en los tres formatos, con cualquier semilla', () => {
    const specs: Especificacion[] = [sN, { leccion_id: L2, dificultad: 'intermedio', formato: 'choice' }, { leccion_id: L1, dificultad: 'desafiante', formato: 'truefalse' }];
    for (let sem = 0; sem < 97; sem++) {
      const v = validarLote(simularLote(specs, CTX, sem), specs, CTX);
      expect(v.rechazados, `semilla ${sem}`).toEqual([]);
      expect(v.aceptados.map((a) => a.format)).toEqual(['numeric', 'choice', 'truefalse']);
    }
  });
});

describe('un lote en la Edge Function', () => {
  function servidor(o: { reserva?: Record<string, unknown>; texto?: string; stop?: string } = {}) {
    const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
    const modelo = vi.fn(async (_p: Peticion): Promise<RespuestaModelo> => ({ texto: o.texto ?? '{}', stop_reason: o.stop ?? 'end_turn', input_tokens: 3000, output_tokens: 2000 }));
    const deps: Deps = {
      hayClave: true, llamarModelo: modelo,
      rpc: async (fn, args) => {
        llamadas.push({ fn, args });
        if (fn === 'svc_generar_contexto') return { data: CTX, error: null };
        if (fn === 'svc_orbe_ia_reservar_uso') return { data: { ok: true, usage_id: 5, api_real: false, model: 'claude-opus-5-5', max_tokens: 4000, precio_entrada: 4, precio_salida: 20, ...o.reserva }, error: null };
        if (fn === 'svc_generar_guardar') return { data: { ids: (args.p_items as unknown[]).map((_, i) => `id${i}`) }, error: null };
        if (fn === 'svc_orbe_ia_finalizar_uso') return { data: null, error: null };
        return { data: null, error: { message: 'desconocida' } };
      },
    };
    return { deps, llamadas, modelo };
  }
  const body = { action: 'generar_preguntas', run_id: RUN, especificaciones: [sN, { leccion_id: L1, dificultad: 'intermedio', formato: 'choice' }] };

  it('con el simulador: guarda borradores verificados, sin llamar a la API y con coste 0', async () => {
    const s = servidor();
    const r = await generarPreguntas(body, PROF, s.deps);
    expect(r).toMatchObject({ ok: true, simulado: true, creadas: 2, costo_usd: 0, verificadas: 1 });
    expect(s.modelo).not.toHaveBeenCalled();
    const g = s.llamadas.find((c) => c.fn === 'svc_generar_guardar')!.args;
    expect(g).toMatchObject({ p_actor: PROF, p_run: RUN, p_rechazadas: 0, p_costo: 0 });
    expect(s.llamadas.find((c) => c.fn === 'svc_orbe_ia_reservar_uso')!.args).toMatchObject({ p_purpose: 'generar' });
  });
  it('API real: esfuerzo medio, coste con los tokens reales; lo que no pasa la verificación se cuenta como rechazado', async () => {
    const texto = JSON.stringify({ preguntas: [numerica({ resultado: 99 }), { ...base, enunciado: '¿Qué magnitud es constante en el MRU según la lección estudiada?', numerica: vacia, opciones: ['Velocidad', 'Aceleración', 'Posición'], correcta: 0, retro: ['', 'En el MRU la aceleración es nula.', 'La posición cambia.'] }] });
    const s = servidor({ reserva: { api_real: true }, texto });
    const r = await generarPreguntas(body, PROF, s.deps) as { creadas: number; rechazadas: { motivo: string }[]; costo_usd: number };
    expect(s.modelo.mock.calls[0][0].effort).toBe('medium');
    expect(r.creadas).toBe(1);
    expect(r.rechazadas[0].motivo).toMatch(/no coincide/);
    expect(r.costo_usd).toBeCloseTo((3000 * 4 + 2000 * 20) / 1e6, 10);
    expect(s.llamadas.find((c) => c.fn === 'svc_orbe_ia_finalizar_uso')!.args).toMatchObject({ p_ok: true, p_input: 3000, p_output: 2000 });
  });
  it('respuesta cortada por límite de tokens: no guarda nada y registra el error', async () => {
    const s = servidor({ reserva: { api_real: true }, texto: '{"preguntas":[', stop: 'max_tokens' });
    expect(await generarPreguntas(body, PROF, s.deps)).toEqual({ ok: false, motivo: 'respuesta_cortada' });
    expect(s.llamadas.some((c) => c.fn === 'svc_generar_guardar')).toBe(false);
    expect(s.llamadas.find((c) => c.fn === 'svc_orbe_ia_finalizar_uso')!.args).toMatchObject({ p_ok: false, p_error: 'respuesta_cortada' });
  });
  it('sin presupuesto o apagado: no llama a nada más', async () => {
    const s = servidor({ reserva: { ok: false, motivo: 'presupuesto' } });
    expect(await generarPreguntas(body, PROF, s.deps)).toEqual({ ok: false, motivo: 'presupuesto' });
    expect(s.modelo).not.toHaveBeenCalled();
  });
  it('valida la petición', async () => {
    const s = servidor();
    await expect(generarPreguntas({ ...body, especificaciones: Array(5).fill(sN) }, PROF, s.deps)).rejects.toMatchObject({ status: 400 });
    await expect(generarPreguntas({ ...body, run_id: 'x' }, PROF, s.deps)).rejects.toMatchObject({ status: 400 });
  });
});
