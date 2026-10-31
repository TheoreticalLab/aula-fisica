import { describe, expect, it } from 'vitest';
import { handle, MENSAJE_FORMATO_INICIAL, type Db } from '../supabase/functions/calificar/handler.ts';
import { casoReflexion, compararRespuestas, notaCompuesta, PESOS_POR_DEFECTO, pasosVisibles, reflexionPresentada, resumenSeccion, type EstadoItem, type Paso } from '../src/lib/asistida';

const A = '11111111-1111-4111-8111-111111111111', E = '22222222-2222-4222-8222-222222222222', U = '33333333-3333-4333-8333-333333333333';
const C1 = '44444444-4444-4444-8444-444444444444';
const clave = { format: 'numeric', value: '0.098 m' };

function mockDb(responses: Record<string, unknown>, errors: Record<string, { message: string; code?: string }> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const db: Db = { rpc: async (fn, args) => { calls.push({ fn, args }); return errors[fn] ? { data: null, error: errors[fn] } : { data: responses[fn] ?? null, error: null }; } };
  return { db, calls };
}
const paso = (p: Partial<Paso>): Paso => ({ fase: 'inicial', version: 1, answer: null, procedimiento: null, explicacion: null, no_se: false, declaracion: null, fuentes: null,
  reflexion: null, referencias: null, status: null, credit: null, messages: null, created_at: '', ...p });

describe('Motor · acción «asistida»', () => {
  const ctx = { svc_asistida_contexto: { key: clave, option_count: null }, svc_asistida_registrar: { siguiente: 'corregida' } };

  it('1 y 5 · primer intento correcto sin ayuda: se guarda y NO se devuelve si es correcto', async () => {
    const { db, calls } = mockDb(ctx);
    const out = (await handle({ action: 'asistida', fase: 'inicial', attempt_id: A, exercise_id: E, client_id: C1, answer: { text: '0.098 m' }, declaracion: 'autonomo' }, U, db)) as Record<string, unknown>;
    expect(out).toEqual({ guardado: true, estado: { siguiente: 'corregida' } });
    expect(JSON.stringify(out)).not.toMatch(/correct|credit/);
    expect(calls[1].args).toMatchObject({ p_user: U, p_fase: 'inicial', p_resultado: { status: 'correct', credit: 1 }, p_client_id: C1 });
  });
  it('2 · primer intento incorrecto: tampoco se revela; la corrección sí recibe retroalimentación', async () => {
    const { db } = mockDb(ctx);
    const ini = (await handle({ action: 'asistida', fase: 'inicial', attempt_id: A, exercise_id: E, client_id: C1, answer: { text: '0.049 m' }, declaracion: 'autonomo' }, U, db)) as Record<string, unknown>;
    expect(ini.resultado).toBeUndefined();
    const cor = (await handle({ action: 'asistida', fase: 'corregida', attempt_id: A, exercise_id: E, client_id: C1, answer: { text: '0.098 m' } }, U, db)) as { resultado: { status: string } };
    expect(cor.resultado.status).toBe('correct');
  });
  it('3 · declara haber consultado ayuda: se registra la declaración tal cual (sin penalizar)', async () => {
    const { db, calls } = mockDb(ctx);
    await handle({ action: 'asistida', fase: 'inicial', attempt_id: A, exercise_id: E, client_id: C1, answer: { text: '0.098 m' }, declaracion: 'consulto_ayuda' }, U, db);
    expect(calls[1].args).toMatchObject({ p_datos: { declaracion: 'consulto_ayuda' }, p_resultado: { credit: 1 } });
  });
  it('4 · «no sé resolverlo»: se guarda sin inventar respuesta', async () => {
    const { db, calls } = mockDb(ctx);
    await handle({ action: 'asistida', fase: 'inicial', attempt_id: A, exercise_id: E, client_id: C1, no_se: true, declaracion: 'no_pudo' }, U, db);
    expect(calls[1].args).toMatchObject({ p_datos: { no_se: true }, p_resultado: { code: 'no_se', credit: 0 } });
  });
  it('sin oráculo: un formato no interpretable en el primer intento da un mensaje genérico y no se guarda', async () => {
    const { db, calls } = mockDb(ctx);
    const out = (await handle({ action: 'asistida', fase: 'inicial', attempt_id: A, exercise_id: E, client_id: C1, answer: { text: '0.098 zorks' }, declaracion: 'autonomo' }, U, db)) as { guardado: boolean; mensajes: string[] };
    expect(out).toEqual({ guardado: false, mensajes: [MENSAJE_FORMATO_INICIAL] });
    expect(out.mensajes.join()).not.toMatch(/«m»|metro/);
    expect(calls.map((c) => c.fn)).toEqual(['svc_asistida_contexto']);
  });
  it('10 · reintento tras perder la conexión: el servidor reconoce el envío y no lo duplica', async () => {
    const { db, calls } = mockDb({ svc_asistida_contexto: { repetido: true, estado: { siguiente: 'corregida' } } });
    const out = await handle({ action: 'asistida', fase: 'inicial', attempt_id: A, exercise_id: E, client_id: C1, answer: { text: '0.098 m' }, declaracion: 'autonomo' }, U, db);
    expect(out).toMatchObject({ guardado: true, repetido: true });
    expect(calls.map((c) => c.fn)).toEqual(['svc_asistida_contexto']);
  });
  it('sin declaración no hay primer intento; fase inventada, rechazada', async () => {
    const { db } = mockDb(ctx);
    await expect(handle({ action: 'asistida', fase: 'inicial', attempt_id: A, exercise_id: E, client_id: C1, answer: { text: '1 m' } }, U, db)).rejects.toThrow(/cómo realizó/);
    await expect(handle({ action: 'asistida', fase: 'reflexion', attempt_id: A, exercise_id: E, client_id: C1, answer: {} }, U, db)).rejects.toThrow(/Fase inválida/);
  });
  it('las reglas del servidor (orden, inmutabilidad) llegan al estudiante como 409', async () => {
    const { db } = mockDb({}, { svc_asistida_contexto: { message: 'El primer intento ya está guardado y no se puede cambiar', code: 'P0001' } });
    await expect(handle({ action: 'asistida', fase: 'inicial', attempt_id: A, exercise_id: E, client_id: C1, answer: { text: '1 m' }, declaracion: 'autonomo' }, U, db))
      .rejects.toMatchObject({ status: 409, message: /ya está guardado/ });
  });
});

describe('Comparación de respuestas', () => {
  it('15 · distingue valor, unidad, ambos, opción y «no sé»', () => {
    const r = (t: string) => paso({ answer: { text: t } });
    expect(compararRespuestas('numeric', r('0.049 m'), r('0.098 m')).cambio).toBe('valor');
    expect(compararRespuestas('numeric', r('98 m'), r('98 cm')).cambio).toBe('unidad');
    expect(compararRespuestas('numeric', r('49 mm'), r('0.098 m')).cambio).toBe('valor_y_unidad');
    expect(compararRespuestas('numeric', r('0.098 m'), r('0.098  m')).cambio).toBe('sin_cambio');
    expect(compararRespuestas('choice', paso({ answer: { selected: [0] } }), paso({ answer: { selected: [2] } })).cambio).toBe('opcion');
    expect(compararRespuestas('numeric', paso({ no_se: true }), r('1 m')).cambio).toBe('de_no_se_a_respuesta');
    expect(compararRespuestas('numeric', paso({ answer: { text: '1 m' }, procedimiento: 'mg/k' }), paso({ answer: { text: '2 m' }, procedimiento: '2mg/k por energía' })).procedimientoCambio).toBe(true);
  });
});

describe('Reflexión adaptada al caso', () => {
  it('no sabía / correcto / incorrecto', () => {
    expect(casoReflexion([paso({ no_se: true })])).toBe('no_sabia');
    expect(casoReflexion([paso({ status: 'correct' })])).toBe('correcto');
    expect(casoReflexion([paso({ status: 'incorrect' })])).toBe('incorrecto');
  });
  it('presentada si alguna respuesta tiene contenido (no se juzga quién la escribió)', () => {
    expect(reflexionPresentada({ error: 'Confundí equilibrio con retorno' })).toBe(true);
    expect(reflexionPresentada({ error: 'no sé' })).toBe(false);
    expect(reflexionPresentada(null)).toBe(false);
  });
});

describe('Nota compuesta (pesos editables, no una escala validada)', () => {
  it('8 · sin transferencia: los pesos activos se reparten proporcionalmente', () => {
    const n = notaCompuesta(PESOS_POR_DEFECTO, { inicial: true, correccion: 1, justificacion: true, transferencia: null });
    expect(n.credito).toBe(1);
    expect(n.efectivos).toEqual({ inicial: 28.6, correccion: 42.9, justificacion: 28.6, transferencia: 0 });
  });
  it('9 · con transferencia: 20/30/20/30', () => {
    expect(notaCompuesta(PESOS_POR_DEFECTO, { inicial: true, correccion: 1, justificacion: true, transferencia: 0 }).credito).toBe(0.7);
  });
  it('6 y 7 · respuesta correcta con justificación ausente: pierde solo la parte de justificación', () => {
    expect(notaCompuesta(PESOS_POR_DEFECTO, { inicial: true, correccion: 1, justificacion: false, transferencia: null }).credito).toBe(0.714);
  });
  it('18 · la declaración de uso de IA no entra en la nota (no es un parámetro)', () => {
    expect(notaCompuesta.length).toBe(2);
    // un primer intento incorrecto no se penaliza: la participación cuenta igual
    expect(notaCompuesta(PESOS_POR_DEFECTO, { inicial: true, correccion: 1, justificacion: true, transferencia: 1 }).credito).toBe(1);
  });
});

describe('Pasos visibles y resumen para el profesor', () => {
  it('cuatro momentos solo si hay transferencia', () => {
    expect(pasosVisibles(false).map((p) => p.titulo)).toEqual(['Intentar', 'Aprender', 'Explicar']);
    expect(pasosVisibles(true).map((p) => p.titulo)).toEqual(['Intentar', 'Aprender', 'Explicar', 'Comprobar']);
  });
  it('resumen: intentos, ayuda declarada, rendimiento inicial declarado y posterior, transferencia', () => {
    const item = (pasos: Paso[]): EstadoItem => ({ exercise_id: 'q', siguiente: 'completo', correcciones: 1, con_transferencia: false, pasos, transferencia: null, solucion: null, calificacion: null });
    const r = resumenSeccion([
      { ejercicio: 'q', item: item([paso({ declaracion: 'autonomo', status: 'incorrect' }), paso({ fase: 'corregida', status: 'correct' }), paso({ fase: 'reflexion', reflexion: { error: 'Usé mg/k en vez de energía' }, fuentes: ['ia'] })]) },
      { ejercicio: 'q', item: item([paso({ declaracion: 'consulto_ayuda', status: 'correct' }), paso({ fase: 'corregida', status: 'correct' })]) },
      { ejercicio: 'q', item: item([]) },
    ]);
    expect(r).toMatchObject({ con_intento: 2, declaro_ayuda: 0.5, rendimiento_inicial_declarado: 0.5, rendimiento_posterior: 1, reflexion: 0.5 });
    expect(r.fuentes).toEqual([['ia', 1]]);
    expect(r.correcciones_por_ejercicio).toEqual([{ ejercicio: 'q', con: 2, corrigieron: 1 }]);
  });
});
