/**
 * Verificación de los apartados numéricos generados con IA (generar.ts → validarNumerica), con los casos REALES que
 * hacían descartar problemas buenos (y cobrar): coma decimal de LaTeX, «× 10^», unidad del enunciado distinta de la
 * anotada, unidades de electromagnetismo. Y, sobre todo, que lo que está mal se siga rechazando.
 */
import { describe, expect, it } from 'vitest';
import { grade } from '../supabase/functions/_shared/calificacion/calificar.ts';
import { datoEnEnunciado, numerosEscritos, validarNumerica } from '../supabase/functions/orbe-ia/generar.ts';
import { construirPeticionPes, validarProblema, type ContextoPes } from '../supabase/functions/orbe-ia/pes.ts';

const num = (datos: [string, number, string][], expresion: string, resultado: number, unidad: string) =>
  ({ datos: datos.map(([nombre, valor, u]) => ({ nombre, valor, unidad: u })), expresion, resultado, unidad, errores: [] });

describe('lectura de números como los ve el estudiante', () => {
  it('coma decimal de LaTeX, \\text{}, espacios finos y notación científica', () => {
    expect(datoEnEnunciado(0.05, 'Una bala de $m_b = 0{,}05\\,\\text{kg}$')).toBe(true);
    expect(datoEnEnunciado(0.1, 'masa $0{,}1\\ \\mathrm{kg}$')).toBe(true);
    expect(datoEnEnunciado(1200, 'una fuerza de $1{,}2\\times10^{3}$ N')).toBe(true);
    expect(datoEnEnunciado(1200, 'una fuerza de 1,2 · 10^3 N')).toBe(true);
    expect(datoEnEnunciado(2.5, 'v = 2{,}5 m/s')).toBe(true);
    expect(datoEnEnunciado(0.0042, 'q = 4{,}2\\times10^{-3}\\,\\text{C}')).toBe(true);
  });
  it('no confunde números: «2» no está en «12» ni en «0,25»; un dato que no está, no está', () => {
    expect(datoEnEnunciado(2, 'recorre 12 m en 0,25 s')).toBe(false);
    expect(datoEnEnunciado(0.05, 'una bala de 50 g')).toBe(false);      // el número 0,05 no está escrito (la cantidad sí: ver abajo)
    expect(datoEnEnunciado(7, 'sin ese valor')).toBe(false);
  });
  it('lee la unidad que acompaña a cada número', () => {
    const xs = numerosEscritos('Una bala de $0{,}05\\,\\text{kg}$ a 300 m/s choca con un bloque de 2 kg.');
    expect(xs.map((x) => [x.valor, x.unidad?.factor, x.unidad?.dims.join()])).toEqual([[0.05, 1, '1,0,0,0,0,0,0'], [300, 1, '0,1,-1,0,0,0,0'], [2, 1, '1,0,0,0,0,0,0']]);
  });
});

describe('apartados numéricos: se acepta lo correcto aunque esté escrito de otra forma', () => {
  it('la misma cantidad con otra unidad: «50 g» en el texto, dato anotado como 0,05 kg', () => {
    const r = validarNumerica(num([['m', 0.05, 'kg'], ['v', 300, 'm/s']], 'm*v', 15, 'kg*m/s'), 'Una bala de 50 g sale a 300 m/s. Calcule su cantidad de movimiento.');
    expect(r.ok).toBe(true);
  });
  it('unidad mal anotada por el modelo («g») cuando el estudiante lee «0,05 kg»: manda el texto y la clave es la correcta', () => {
    const r = validarNumerica(num([['m', 0.05, 'g'], ['v', 300, 'm/s']], 'm*v', 15, 'kg*m/s'), 'Una bala de $0{,}05\\,\\text{kg}$ sale a 300 m/s.');
    expect(r.ok).toBe(true);
    if (r.ok) expect(grade(r.key, { text: '15 kg·m/s' }).status).toBe('correct');
  });
  it('electromagnetismo: «10 Ω» en el texto con el dato en V/A; la corriente se califica en A', () => {
    const r = validarNumerica(num([['V', 12, 'V'], ['R', 10, 'V/A']], 'V/R', 1.2, 'A'), 'Una batería de 12 V alimenta una resistencia de 10 Ω.');
    expect(r.ok).toBe(true);
    if (r.ok) { expect(grade(r.key, { text: '1.2 A' }).status).toBe('correct'); expect(grade(r.key, { text: '1200 mA' }).status).toBe('correct'); }
  });
  it('capacitor: «4,7 μF» con el dato en μC/V', () => {
    const r = validarNumerica(num([['C', 4.7, 'μC/V'], ['V', 9, 'V']], 'C*V', 42.3, 'μC'), 'Un condensador de $4{,}7\\,\\mu\\text{F}$ se carga a 9 V.');
    expect(r.ok).toBe(true);
  });
  it('redondeo del modelo dentro del 2 % (la tolerancia de la calificación) en la PES; la clave usa el valor exacto', () => {
    const n = num([['d', 7, 'm'], ['t', 3, 's']], 'd/t', 2.35, 'm/s');            // exacto 2,333…: 0,7 % (pasa también con 1 %)
    expect(validarNumerica(n, 'Recorre 7 m en 3 s.', 0.02).ok).toBe(true);
    const n2 = num([['d', 7, 'm'], ['t', 3, 's']], 'd/t', 2.37, 'm/s');           // 1,6 %: solo con la tolerancia de la PES
    expect(validarNumerica(n2, 'Recorre 7 m en 3 s.').ok).toBe(false);
    const r = validarNumerica(n2, 'Recorre 7 m en 3 s.', 0.02);
    expect(r.ok && r.key.value).toBe('2.33 m/s');
  });
});

describe('apartados numéricos: lo que está mal se sigue rechazando', () => {
  it('un factor 1000 que no se explica por el texto (fórmula o unidad del resultado mal)', () => {
    expect(validarNumerica(num([['m', 0.05, 'kg'], ['v', 300, 'm/s']], 'm*v', 15000, 'kg*m/s'), 'Una bala de 0,05 kg a 300 m/s.'))
      .toMatchObject({ ok: false, motivo: expect.stringMatching(/no coincide/) });
  });
  it('más del 2 % de diferencia (fórmula distinta de la que dice el modelo)', () => {
    expect(validarNumerica(num([['d', 7, 'm'], ['t', 3, 's']], 'd/t', 2.5, 'm/s'), 'Recorre 7 m en 3 s.', 0.02).ok).toBe(false);
  });
  it('un dato que el estudiante no puede ver, ni con otra unidad', () => {
    expect(validarNumerica(num([['m', 0.08, 'kg'], ['v', 300, 'm/s']], 'm*v', 24, 'kg*m/s'), 'Una bala de 50 g sale a 300 m/s.'))
      .toMatchObject({ ok: false, motivo: expect.stringMatching(/no aparece/) });
  });
  it('la unidad del texto solo se usa si es de la misma magnitud (un «2 s» no corrige un dato de 2 m)', () => {
    const r = validarNumerica(num([['d', 2, 'm'], ['t', 2, 's']], 'd/t', 1, 'm/s'), 'Recorre 2 m en 2 s.');
    expect(r.ok && r.key.value).toBe('1 m/s');
  });
  it('el mismo número junto a una unidad de OTRA magnitud no cambia la unidad del dato («4 g» no convierte F = 4 N en gramos)', () => {
    const r = validarNumerica(num([['m', 4, 'g'], ['F', 4, 'N']], 'F/m', 1000, 'm/s^2'), 'Un objeto de 4 g recibe una fuerza neta de cuatro newtons. Calcule su aceleración.');
    expect(r.ok).toBe(true);
    if (r.ok) expect(grade(r.key, { text: '1000 m/s^2' }).status).toBe('correct');
  });
  it('dimensiones incoherentes y resultados en unidades que el corrector no entiende', () => {
    expect(validarNumerica(num([['d', 7, 'm'], ['t', 3, 's']], 'd/t', 2.33, 'm/s^2'), 'Recorre 7 m en 3 s.').ok).toBe(false);
    expect(validarNumerica(num([['V', 12, 'V'], ['I', 2, 'A']], 'V/I', 6, 'Ω'), 'Con 12 V circulan 2 A.')).toMatchObject({ ok: false, motivo: expect.stringMatching(/desconocida/) });
  });
});

describe('problema completo de electromagnetismo (Física General III)', () => {
  const CTX: ContextoPes = { asignatura: 'Física General III', leccion: { id: '11111111-1111-4111-8111-111111111111', titulo: 'Circuitos de corriente continua', unidad: 'Circuitos', resumen: '', conceptos: [] }, existentes: [] };
  const v = { opciones: [], correcta: -1, retro: [], vf: false, justificacion: '', rubrica: '', minutos: 4, explicacion: 'Aplicando la ley de Ohm al circuito en serie, paso a paso.' };
  const vacio = { datos: [], expresion: '', resultado: 0, unidad: '', errores: [] };
  it('con Ω en el texto, datos en V/A y resultados en A y W: se acepta', () => {
    const p = {
      titulo: 'Dos resistencias en serie',
      contexto: 'Una batería de 12 V se conecta a dos resistencias en serie de $4{,}0\\,\\Omega$ y $2{,}0\\,\\Omega$ (escritas también 4,0 Ω y 2,0 Ω).',
      apartados: [
        { ...v, etapa: 'prediccion', formato: 'choice', enunciado: '¿Por cuál resistencia circula más corriente?', numerica: vacio, opciones: ['Por la de 4,0 Ω', 'Por la de 2,0 Ω', 'Por las dos igual'], correcta: 2,
          retro: ['En serie la corriente es la misma en ambas.', 'En serie la corriente es la misma en ambas.', ''] },
        { ...v, etapa: 'formulacion', formato: 'truefalse', enunciado: 'Verdadero o falso: la resistencia equivalente es la suma de ambas.', numerica: vacio, vf: true,
          justificacion: 'En serie las resistencias se suman porque la corriente recorre ambas una tras otra.' },
        { ...v, etapa: 'resolucion', formato: 'numeric', enunciado: 'Calcule la corriente del circuito.',
          numerica: { datos: [{ nombre: 'V', valor: 12, unidad: 'V' }, { nombre: 'R1', valor: 4, unidad: 'V/A' }, { nombre: 'R2', valor: 2, unidad: 'V/A' }], expresion: 'V/(R1+R2)', resultado: 2, unidad: 'A', errores: [] } },
        { ...v, etapa: 'interpretacion', formato: 'numeric', enunciado: 'Use I = 2,0 A, obtenida antes: ¿qué potencia disipa la resistencia de 4,0 Ω?',
          numerica: { datos: [{ nombre: 'I', valor: 2, unidad: 'A' }, { nombre: 'R1', valor: 4, unidad: 'V/A' }], expresion: 'I^2*R1', resultado: 16, unidad: 'W', errores: [] } },
      ],
    };
    const r = validarProblema(p, { leccion_id: CTX.leccion.id, dificultad: 'basico', tipo: 'calculo', apartados: 4 }, CTX);
    expect(r.ok, r.ok ? '' : r.motivo).toBe(true);
  });
});

describe('opciones de selección: repetidas de verdad, no por un signo', () => {
  const CTX2: ContextoPes = { asignatura: 'Física General I', leccion: { id: '11111111-1111-4111-8111-111111111111', titulo: 'Leyes de Newton', unidad: 'Dinámica', resumen: '', conceptos: [] }, existentes: [] };
  const vacio = { datos: [], expresion: '', resultado: 0, unidad: '', errores: [] };
  const base = { numerica: vacio, correcta: 0, vf: false, justificacion: '', rubrica: '', minutos: 3, explicacion: 'Explicación breve y completa del apartado.' };
  const retro = ['', 'Retroalimentación de la segunda opción.', 'Retroalimentación de la tercera opción.'];
  const problema = (ops: string[]) => ({
    titulo: 'Dos bloques', contexto: 'Dos bloques de 2 kg y 4 kg se empujan con una fuerza de 12 N sobre una mesa sin rozamiento.',
    apartados: [
      { ...base, etapa: 'prediccion', formato: 'choice', enunciado: 'Compare las fuerzas netas sobre cada bloque.', opciones: ops, retro },
      { ...base, etapa: 'resolucion', formato: 'numeric', enunciado: 'Calcule la aceleración del conjunto.', opciones: [], retro: [],
        numerica: { datos: [{ nombre: 'F', valor: 12, unidad: 'N' }, { nombre: 'm1', valor: 2, unidad: 'kg' }, { nombre: 'm2', valor: 4, unidad: 'kg' }], expresion: 'F/(m1+m2)', resultado: 2, unidad: 'm/s^2', errores: [] } },
      { ...base, etapa: 'interpretacion', formato: 'open', enunciado: 'Explique por qué el bloque más pesado acelera igual.', opciones: [], retro: [], rubrica: 'Usa que ambos forman un sistema con la misma aceleración.' },
    ],
  });
  const spec3 = { leccion_id: CTX2.leccion.id, dificultad: 'basico' as const, tipo: 'calculo' as const, apartados: 3 as const };
  it('se aceptan opciones que solo difieren en >, <, = o en el signo', () => {
    expect(validarProblema(problema(['$F_1 < F_2$', '$F_1 > F_2$', '$F_1 = F_2$']), spec3, CTX2).ok).toBe(true);
    expect(validarProblema(problema(['+2 m/s', '−2 m/s', '0 m/s']), spec3, CTX2).ok).toBe(true);
  });
  it('se rechazan las de verdad repetidas (solo cambian mayúsculas, espacios o los $ de LaTeX)', () => {
    expect(validarProblema(problema(['$F_1 < F_2$', 'f_1<f_2', '$F_1 = F_2$']), spec3, CTX2)).toMatchObject({ ok: false, motivo: expect.stringMatching(/opciones repetidas/) });
    expect(validarProblema(problema(['Aumenta', ' aumenta ', 'Disminuye']), spec3, CTX2)).toMatchObject({ ok: false, motivo: expect.stringMatching(/opciones repetidas/) });
  });
  it('el encargo pide no meter factores de conversión en la fórmula (causa de factores 1000 irresolubles)', () => {
    expect(construirPeticionPes(spec3, CTX2, 'm', 4000).system).toMatch(/NO pongas factores de conversión/);
  });
});
