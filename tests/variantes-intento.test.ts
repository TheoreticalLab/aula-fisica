/**
 * Variantes por intento: semilla, clave concreta, validación y la acción «variante» de la función de calificación.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { claveConcreta, evaluarVariables, parametrosVariante, semillaVariante, validarVariante } from '../supabase/functions/_shared/calificacion/variante.ts';
import { sustituirParametros, tieneParametros } from '../supabase/functions/_shared/calificacion/marcadores.ts';
import { generarVariante } from '../supabase/functions/_shared/fisica/variantes.ts';
import { grade } from '../supabase/functions/_shared/calificacion/calificar.ts';
import type { NumericKey } from '../supabase/functions/_shared/calificacion/tipos.ts';
import { handle, type Db } from '../supabase/functions/calificar/handler.ts';
import { INTENTOS_PRUEBA, validarClaveVariante } from '../scripts/biblioteca/validar';
import type { EjercicioBiblioteca } from '../scripts/biblioteca/tipos';

const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '44444444-4444-4444-8444-444444444444';
const E = '22222222-2222-4222-8222-222222222222';
const U = '33333333-3333-4333-8333-333333333333';

const CLAVE: NumericKey = {
  format: 'numeric', value: '0 m', relTol: 0.02,
  variante: {
    plantilla: 'A', respuesta: 'd', unidad: 'm',
    errores: [{ expresion: 'v1^2/(2*mu*g)', message: 'Usó la rapidez de antes del choque: después del choque quedan unidos y van más lentos.' }],
  },
};

function mockDb(responses: Record<string, unknown>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const db: Db = { rpc: async (fn, args) => { calls.push({ fn, args }); return { data: responses[fn] ?? null, error: null }; } };
  return { db, calls };
}

describe('semilla y parámetros', () => {
  it('la semilla es determinista y distinta entre intentos', () => {
    expect(semillaVariante(A1, E)).toBe(semillaVariante(A1, E));
    expect(semillaVariante(A1, E)).not.toBe(semillaVariante(A2, E));
    expect(semillaVariante(A1, E)).toBeGreaterThanOrEqual(0);
  });

  it('los parámetros coinciden con los del generador para esa semilla', () => {
    const p = parametrosVariante('A', A1, E);
    expect(p.parametros).toEqual(generarVariante('A', semillaVariante(A1, E)).parametros);
  });
});

describe('clave concreta', () => {
  it('el valor es la respuesta del motor con los números del intento', () => {
    const k = claveConcreta(CLAVE, A1, E);
    const { respuestas } = parametrosVariante('A', A1, E);
    expect(Number.parseFloat(k.value)).toBeCloseTo(respuestas.d, 1);
    expect(k.value.endsWith(' m')).toBe(true);
    expect(k.variante).toBeUndefined();
    expect(k.alternatives).toBeUndefined();
  });

  it('acepta la respuesta de su versión y rechaza la de otro intento (si difieren)', () => {
    const k1 = claveConcreta(CLAVE, A1, E), k2 = claveConcreta(CLAVE, A2, E);
    expect(grade(k1, { text: k1.value }).status).toBe('correct');
    const d1 = Number.parseFloat(k1.value), d2 = Number.parseFloat(k2.value);
    if (Math.abs(d1 - d2) > 0.05 * Math.abs(d1)) expect(grade(k1, { text: k2.value }).status).not.toBe('correct');
  });

  it('el error típico se calcula con sus números y produce su mensaje', () => {
    const k = claveConcreta(CLAVE, A1, E);
    const { parametros } = parametrosVariante('A', A1, E);
    const malo = parametros.v1 ** 2 / (2 * parametros.mu * 9.8);
    expect(k.commonErrors).toHaveLength(1);
    const r = grade(k, { text: `${malo.toPrecision(3)} m` });
    expect(r.status).toBe('incorrect');
    expect(r.messages.join(' ')).toContain('antes del choque');
  });

  it('descarta un error típico que coincide con la respuesta correcta', () => {
    const k = claveConcreta({ ...CLAVE, variante: { ...CLAVE.variante!, errores: [{ expresion: 'd*1.001', message: 'x' }] } }, A1, E);
    expect(k.commonErrors).toEqual([]);
  });

  it('una respuesta que la plantilla no calcula es un error de clave', () => {
    expect(() => claveConcreta({ ...CLAVE, variante: { ...CLAVE.variante!, respuesta: 'nada' } }, A1, E)).toThrow();
  });
});

describe('evaluarVariables (gramática cerrada)', () => {
  it('evalúa operaciones, potencias y funciones permitidas', () => {
    expect(evaluarVariables('sqrt(a^2+b^2)', { a: 3, b: 4 })).toBe(5);
    expect(evaluarVariables('-2*abs(x)/4', { x: -6 })).toBe(-3);
  });
  it('rechaza variables desconocidas y código', () => {
    expect(() => evaluarVariables('y+1', { x: 1 })).toThrow(/desconocida/);
    expect(() => evaluarVariables('constructor', {})).toThrow();
    expect(() => evaluarVariables('alert(1)', {})).toThrow();
    expect(() => evaluarVariables('1;2', {})).toThrow();
  });
});

describe('validarVariante (biblioteca)', () => {
  const prompt = 'Un bloque de {{m1}} kg a {{v1}} m/s choca con otro de {{m2}} kg en reposo; μ = {{mu}}. ¿Qué distancia recorren?';
  it('acepta una definición correcta', () => {
    expect(validarVariante(CLAVE.variante!, prompt)).toEqual([]);
  });
  it('detecta plantilla, respuesta, marcadores y expresiones inválidas', () => {
    expect(validarVariante({ ...CLAVE.variante!, plantilla: 'Z' }, prompt)[0]).toMatch(/plantilla desconocida/);
    expect(validarVariante({ ...CLAVE.variante!, respuesta: 'nada' }, prompt).join()).toMatch(/no calcula/);
    expect(validarVariante(CLAVE.variante!, prompt + ' {{h}}').join()).toMatch(/\{\{h\}\}/);
    expect(validarVariante(CLAVE.variante!, 'sin marcadores').join()).toMatch(/mismos números/);
    expect(validarVariante({ ...CLAVE.variante!, errores: [{ expresion: 'q*2', message: '' }] }, prompt).join()).toMatch(/desconocida/);
  });
});

describe('validación de la biblioteca con variantes', () => {
  const base = {
    id: 'prueba-var', prompt: 'Bloque de {{m1}} kg a {{v1}} m/s contra {{m2}} kg; μ = {{mu}}.',
    clave: { answer: CLAVE, hints: ['Use {{m1}}.'], explanation: 'Con μ = {{mu}}.' },
    verificarVariante: ({ m1, m2, v1, mu }: Record<string, number>) => ((m1 * v1) / (m1 + m2)) ** 2 / (2 * mu * 9.8),
  } as unknown as EjercicioBiblioteca;
  it('una clave correcta no produce problemas (probada en muchas versiones)', () => {
    const p: string[] = [];
    validarClaveVariante('e', base, p);
    expect(p).toEqual([]);
  });
  it('detecta marcadores ajenos, errores fijos, arrastre y errores típicos inútiles', () => {
    const p: string[] = [];
    validarClaveVariante('e', {
      ...base,
      clave: {
        answer: { ...CLAVE, commonErrors: [{ value: '1 m', message: 'x' }], arrastre: { desde: 'a', expresion: 'x' }, variante: { ...CLAVE.variante!, errores: [{ expresion: 'd', message: 'igual' }] } },
        hints: ['{{h}}'], explanation: '',
      },
    } as unknown as EjercicioBiblioteca, p);
    const t = p.join('\n');
    expect(t).toMatch(/\{\{h\}\}/);
    expect(t).toMatch(/errores típicos fijos/);
    expect(t).toMatch(/arrastre/);
    expect(t).toMatch(/coincide con la respuesta en todas las versiones/);
  });
  it('exige y aplica la comprobación independiente', () => {
    const sin: string[] = [];
    validarClaveVariante('e', { ...base, verificarVariante: undefined } as unknown as EjercicioBiblioteca, sin);
    expect(sin.join()).toMatch(/sin comprobación independiente/);
    const mala: string[] = [];
    // olvida el choque: la comprobación detecta la discrepancia con el motor
    validarClaveVariante('e', { ...base, verificarVariante: ({ v1, mu }: Record<string, number>) => v1 ** 2 / (2 * mu * 9.8) } as unknown as EjercicioBiblioteca, mala);
    expect(mala.join()).toMatch(/comprobación independiente/);
    const sinExigir: string[] = [];
    validarClaveVariante('e', { ...base, verificarVariante: undefined } as unknown as EjercicioBiblioteca, sinExigir, false);
    expect(sinExigir).toEqual([]);
  });
  it('el piloto de la biblioteca (familia A) da versiones distintas', () => {
    const valores = new Set(INTENTOS_PRUEBA.map((id) => claveConcreta(CLAVE, id, 'mec-u9c-09-9').value));
    expect(valores.size).toBeGreaterThan(20);
  });
});

describe('marcadores (navegador)', () => {
  it('sustituye los parámetros y marca con «?» los que faltan', () => {
    expect(tieneParametros('a {{ m1 }} b')).toBe(true);
    expect(tieneParametros('sin nada')).toBe(false);
    expect(sustituirParametros('{{m1}} kg y {{x}}', { m1: 2.5 })).toBe('2.5 kg y ?');
    expect(sustituirParametros('{{m1}}', null)).toBe('?');
  });
});

describe('función de calificación con variantes', () => {
  it('«variante» devuelve solo los parámetros, nunca la respuesta', async () => {
    const { db, calls } = mockDb({ svc_variante_info: { plantilla: 'A' } });
    const out = (await handle({ action: 'variante', attempt_id: A1, exercise_id: E }, U, db)) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(['parametros']);
    expect(out.parametros).toEqual(parametrosVariante('A', A1, E).parametros);
    expect(JSON.stringify(out)).not.toContain('respuesta');
    expect(calls[0]).toEqual({ fn: 'svc_variante_info', args: { p_user: U, p_attempt: A1, p_exercise: E } });
  });

  it('«variante» sin plantilla devuelve parámetros nulos', async () => {
    const { db } = mockDb({ svc_variante_info: null });
    expect(await handle({ action: 'variante', attempt_id: A1, exercise_id: E }, U, db)).toEqual({ parametros: null });
  });

  it('«check» califica con la clave concreta del intento', async () => {
    const k = claveConcreta(CLAVE, A1, E);
    const { db } = mockDb({
      svc_check_context: { key: CLAVE, format: 'numeric', option_count: null, max_tries: 3 },
      svc_record_check: { status: 'correct' },
    });
    const out = (await handle({ action: 'check', attempt_id: A1, exercise_id: E, answer: { text: k.value } }, U, db)) as { result: { status: string } };
    expect(out.result.status).toBe('correct');
  });

  it('«submit» califica cada pregunta con su variante', async () => {
    const k = claveConcreta(CLAVE, A1, E);
    const { db, calls } = mockDb({
      svc_submit_context: { mode: 'exam', items: [{ exercise_id: E, format: 'numeric', option_count: null, key: CLAVE, answer: { text: k.value }, status: null }] },
      svc_record_submission: { status: 'submitted' },
    });
    await handle({ action: 'submit', attempt_id: A1 }, U, db);
    const res = calls.find((c) => c.fn === 'svc_record_submission')!.args.p_results as { status: string }[];
    expect(res[0].status).toBe('correct');
  });

  it('la transferencia de la práctica asistida usa la semilla de SU ejercicio', async () => {
    const T = '55555555-5555-4555-8555-555555555555';
    const kT = claveConcreta(CLAVE, A1, T);
    const { db, calls } = mockDb({
      svc_asistida_contexto: { key: CLAVE, option_count: null, transfer_exercise_id: T },
      svc_asistida_registrar: { ok: true },
    });
    await handle({ action: 'asistida', fase: 'transferencia', attempt_id: A1, exercise_id: E, client_id: U, answer: { text: kT.value } }, U, db);
    const reg = calls.find((c) => c.fn === 'svc_asistida_registrar')!.args.p_resultado as { status: string };
    expect(reg.status).toBe('correct');
  });
});

describe('aislamiento', () => {
  it('el código del navegador (src/) no importa el cálculo de respuestas de las variantes', () => {
    const archivos: string[] = [];
    const recorrer = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) recorrer(p); else if (/\.(ts|tsx)$/.test(f)) archivos.push(p); } };
    recorrer('src');
    const RUTA = String.raw`(?:calificacion|@calif)\/variante(?:\.ts)?['"]`;
    const estaticos = archivos.filter((f) => new RegExp(String.raw`from\s+['"][^'"]*` + RUTA).test(readFileSync(f, 'utf8')));
    expect(estaticos).toEqual([]);
    // la única carga es diferida, en la caja de la solución (solo cuando ya se puede ver la respuesta)
    const diferidos = archivos.filter((f) => new RegExp(String.raw`import\(\s*['"][^'"]*` + RUTA).test(readFileSync(f, 'utf8')));
    expect(diferidos.map((f) => f.replace(/\\/g, '/'))).toEqual(['src/components/Ejercicio.tsx']);
  });
});
