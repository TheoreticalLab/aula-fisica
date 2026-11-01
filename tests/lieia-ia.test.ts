/**
 * LIEIA · interpretación con IA (acción «lieia» de orbe-ia): lista blanca de la entrada, simulador, capa C de
 * verificación y registro del consumo.
 */
import { describe, expect, it, vi } from 'vitest';
import { atender, type Deps, type Peticion, type RespuestaModelo } from '../supabase/functions/orbe-ia/handler.ts';
import { construirInterpretacion, resumirExamen, simularInterpretacion, textoDatos, validarInterpretacion } from '../supabase/functions/orbe-ia/lieia.ts';
import { resumenParaIA } from '../src/lib/lieia/ciencia/resumenIA';

const PROF = '55555555-5555-4555-8555-555555555555';

const EXAMEN = {
  n: 42, kr20: 0.71, factores: 1, unidimensional: true,
  items: [
    { posicion: 1, enunciado: 'Un bloque de 2 kg…', formato: 'numeric', conceptos: ['u9c-totalmente-inelastico'], dificultad: 'basico', n: 42, p: 0.81, disc: 0.35, omision: 0.02 },
    { posicion: 2, enunciado: '¿Qué se conserva en un choque?', formato: 'choice', conceptos: ['u9c-conservacion'], dificultad: 'intermedio', n: 42, p: 0.33, disc: 0.12, omision: 0.1 },
    { posicion: 3, enunciado: 'Rebote con e = 0.6', formato: 'numeric', conceptos: [], dificultad: 'desafiante', n: 40, p: 0.5, disc: 0.41, omision: 0 },
  ],
};

function servidor(opts: { rol?: string; reserva?: Record<string, unknown>; texto?: string } = {}) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const modelo = vi.fn(async (_p: Peticion): Promise<RespuestaModelo> => ({ texto: opts.texto ?? '{}', stop_reason: 'end_turn', input_tokens: 900, output_tokens: 400 }));
  const deps: Deps = {
    hayClave: true, llamarModelo: modelo,
    rpc: async (fn, args) => {
      llamadas.push({ fn, args });
      if (fn === 'svc_orbe_ia_rol') return { data: opts.rol ?? 'teacher', error: null };
      if (fn === 'svc_orbe_ia_reservar_uso') return { data: { ok: true, usage_id: 7, api_real: false, model: 'claude-opus-5-5', max_tokens: 3000, contexto: null, ...opts.reserva }, error: null };
      if (fn === 'svc_orbe_ia_finalizar_uso') return { data: null, error: null };
      return { data: null, error: { message: 'función desconocida' } };
    },
  };
  return { deps, llamadas, modelo };
}

describe('lista blanca de la entrada', () => {
  it('descarta todo campo desconocido: seudónimos, respuestas e identificadores no llegan al modelo', () => {
    const r = resumirExamen({
      ...EXAMEN, estudiantes: [{ seudonimo: 'E-7f3a', respuestas: ['42 m'] }], activity_id: 'a1b2',
      items: [{ ...EXAMEN.items[0], id: '11111111-1111-4111-8111-111111111111', respuestas: ['9.8 m/s'], seudonimos: ['E-1'] }],
    });
    const texto = construirInterpretacion(r, 'm', 100).user;
    for (const fuga of ['E-7f3a', '42 m', 'a1b2', '11111111', '9.8 m/s', 'E-1']) expect(texto).not.toContain(fuga);
    expect(Object.keys(r.items[0]).sort()).toEqual(['conceptos', 'dificultad', 'disc', 'enunciado', 'formato', 'n', 'omision', 'p', 'posicion']);
  });
  it('acota y limpia: cifras fuera de rango, etiquetas HTML, enunciados largos, posiciones repetidas', () => {
    const r = resumirExamen({ n: 5, items: [{ posicion: 1, enunciado: `<script>x</script>${'a'.repeat(900)}`, p: 7, disc: -3 }, { posicion: 1, enunciado: 'repetida' }] });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].p).toBe(1);
    expect(r.items[0].disc).toBe(-1);
    expect(r.items[0].enunciado).not.toMatch(/[<>]/);
    expect(r.items[0].enunciado.length).toBeLessThanOrEqual(400);
    expect(() => resumirExamen({ items: [] })).toThrow();
  });
  it('el cliente arma el resumen solo con agregados (sin la matriz de respuestas)', () => {
    const inf = {
      preguntas: [{ id: 'q1', posicion: 1, prompt: 'Enunciado {{m1}}', format: 'numeric', concepts: ['c1'], difficulty: 'basico' }],
      analisis: [{ id: 'q1', dificultadAPriori: { valor: 'intermedio' } }],
      empirico: new Map([['q1', { calificadas: 30, expuestos: 31, omisiones: 1, p: { ok: true, valor: { p: 0.6 } }, discriminacion: { ok: true, valor: 0.3 } }]]),
      examen: { n: 31, confiabilidad: { ok: true, valor: { kr20: 0.7 } } },
      matriz: { estudiantes: ['E-SECRETO'], x: [[1]] },
    };
    const r = resumenParaIA(inf as never, null);
    expect(JSON.stringify(r)).not.toContain('E-SECRETO');
    expect(r).toMatchObject({ n: 31, kr20: 0.7, items: [{ posicion: 1, p: 0.6, disc: 0.3, n: 30, dificultad: 'intermedio' }] });
  });
});

describe('capa C: verificación de la interpretación', () => {
  const r = resumirExamen(EXAMEN);
  const salida = (hallazgos: unknown[], resumen = 'Examen con una pregunta difícil.') => JSON.stringify({ resumen, hallazgos, limitaciones: 'Muestra moderada.' });
  it('acepta hallazgos que citan preguntas y cifras de los datos', () => {
    const v = validarInterpretacion(salida([{ tipo: 'revisar_pregunta', texto: 'P2 tiene 33 % de acierto y discrimina 0.12: conviene revisar sus distractores.', preguntas: [2] }]), r);
    expect(v.hallazgos).toHaveLength(1);
    expect(v.descartados).toEqual([]);
    expect(v.etiqueta).toMatch(/IA, sin validar/);
  });
  it('descarta cifras inventadas, preguntas inexistentes, causas y acusaciones', () => {
    const v = validarInterpretacion(salida([
      { tipo: 'revisar_pregunta', texto: 'P2 tiene un 47 % de acierto, conviene revisarla.', preguntas: [2] },
      { tipo: 'revisar_pregunta', texto: 'P9 es demasiado fácil y conviene cambiarla.', preguntas: [9] },
      { tipo: 'estructura', texto: 'La baja discriminación de P2 se debe a que el enunciado es largo.', preguntas: [2] },
      { tipo: 'investigar', texto: 'Algunos estudiantes podrían haber copiado en P3.', preguntas: [3] },
      { tipo: 'investigar', texto: 'Conviene comprobar si P1 y P3 miden lo mismo en otra aplicación.', preguntas: [1, 3] },
    ]), r);
    expect(v.hallazgos.map((h) => h.preguntas)).toEqual([[1, 3]]);
    const motivos = v.descartados.map((d) => d.motivo).join(' | ');
    expect(motivos).toMatch(/cifras que no están/);
    expect(motivos).toMatch(/no existen/);
    expect(motivos).toMatch(/causa/);
    expect(motivos).toMatch(/conducta/);
  });
  it('una salida sin el formato pedido es un error', () => {
    expect(() => validarInterpretacion('no es json', r)).toThrow();
    expect(() => validarInterpretacion('{"resumen":1}', r)).toThrow();
  });
  it('el simulador cumple sus propias reglas', () => {
    const v = validarInterpretacion(simularInterpretacion(r), r);
    expect(v.descartados).toEqual([]);
    expect(v.hallazgos.length).toBeGreaterThan(0);
    expect(textoDatos(r)).toContain('KR-20: 0.71');
  });
});

describe('acción «lieia» de orbe-ia', () => {
  it('solo profesorado; con el simulador no se llama a la API y se registra el uso con propósito «lieia»', async () => {
    const s = servidor();
    const r = await atender({ action: 'lieia', examen: EXAMEN }, PROF, s.deps);
    expect(r).toMatchObject({ ok: true, simulado: true });
    expect(s.modelo).not.toHaveBeenCalled();
    expect(s.llamadas.find((c) => c.fn === 'svc_orbe_ia_reservar_uso')!.args).toMatchObject({ p_purpose: 'lieia', p_lesson: null });
    await expect(atender({ action: 'lieia', examen: EXAMEN }, PROF, servidor({ rol: 'student' }).deps)).rejects.toMatchObject({ status: 403 });
  });
  it('API real: una llamada con solo los datos agregados; la salida pasa por la capa C y se registran los tokens', async () => {
    const texto = JSON.stringify({ resumen: 'Examen razonable.', hallazgos: [{ tipo: 'revisar_pregunta', texto: 'P2 discrimina 0.12; revise sus distractores.', preguntas: [2] }, { tipo: 'revisar_pregunta', texto: 'P1 tiene 99 % de acierto.', preguntas: [1] }], limitaciones: 'n moderado.' });
    const s = servidor({ reserva: { api_real: true }, texto });
    const r = (await atender({ action: 'lieia', examen: EXAMEN }, PROF, s.deps)) as { ok: boolean; simulado: boolean; resultado: { hallazgos: unknown[]; descartados: unknown[] } };
    expect(r.ok).toBe(true);
    expect(r.simulado).toBe(false);
    expect(s.modelo).toHaveBeenCalledTimes(1);
    expect(s.modelo.mock.calls[0][0].user).toContain('P2 [choice');
    expect(r.resultado.hallazgos).toHaveLength(1);
    expect(r.resultado.descartados).toHaveLength(1);
    expect(s.llamadas.find((c) => c.fn === 'svc_orbe_ia_finalizar_uso')!.args).toMatchObject({ p_ok: true, p_input: 900, p_output: 400 });
  });
  it('si el servidor dice que está apagado, no hace nada', async () => {
    const s = servidor({ reserva: { ok: false, motivo: 'apagado' } });
    expect(await atender({ action: 'lieia', examen: EXAMEN }, PROF, s.deps)).toEqual({ ok: false, motivo: 'apagado' });
    expect(s.modelo).not.toHaveBeenCalled();
  });
});
