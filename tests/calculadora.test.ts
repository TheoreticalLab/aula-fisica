import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluar, formatear, LIMITES } from '@/lib/calculadora/motor';

const v = (expr: string, modo: 'DEG' | 'RAD' = 'DEG', ans = 0) => {
  const r = evaluar(expr, { modo, ans });
  if (!r.ok) throw new Error(`${expr}: ${r.error}`);
  return r.valor;
};
const err = (expr: string, modo: 'DEG' | 'RAD' = 'DEG') => {
  const r = evaluar(expr, { modo });
  expect(r.ok, `${expr} debía fallar`).toBe(false);
  return r.ok ? '' : r.error;
};

describe('calculadora · casos obligatorios', () => {
  it('precedencia y paréntesis', () => {
    expect(v('2+3*4')).toBe(14);
    expect(v('(2+3)*4')).toBe(20);
  });
  it('trigonometría en grados y radianes', () => {
    expect(v('sin(30)', 'DEG')).toBeCloseTo(0.5, 12);
    expect(evaluar('sin(30)', { modo: 'DEG' })).toMatchObject({ texto: '0.5' });
    expect(v('cos(π)', 'RAD')).toBe(-1);
    expect(v('cos(pi)', 'RAD')).toBe(-1);
  });
  it('raíz, logaritmos y potencias', () => {
    expect(v('sqrt(144)')).toBe(12);
    expect(v('√(144)')).toBe(12);
    expect(v('log(1000)')).toBeCloseTo(3, 12);
    expect(v('ln(e)')).toBe(1);
    expect(v('2^10')).toBe(1024);
  });
  it('1/0 da un error controlado', () => {
    expect(err('1/0')).toMatch(/división entre cero/i);
  });
  it('expresiones incorrectas no lanzan excepciones', () => {
    for (const e of ['', '2+', '(2+3', '2+*3', ')(', 'sin', 'sin()', '3..2', '2E', '1,2', ',', '%', '^2', 'root(2)', '((((']) {
      expect(() => evaluar(e)).not.toThrow();
      expect(evaluar(e).ok, e).toBe(false);
    }
  });
});

describe('calculadora · precedencia, potencias y notación científica', () => {
  it('potencia asociativa a la derecha y signo menos', () => {
    expect(v('2^3^2')).toBe(512);
    expect(v('-2^2')).toBe(-4);
    expect(v('(-2)^2')).toBe(4);
    expect(v('2^-1')).toBe(0.5);
    expect(v('2^(-2)')).toBe(0.25);
    expect(v('10^-3')).toBeCloseTo(0.001, 15);
    expect(v('-3*-2')).toBe(6);
    expect(v('8/2/2')).toBe(2);
    expect(v('2-3-4')).toBe(-5);
  });
  it('notación científica con E', () => {
    expect(v('3.0E8')).toBe(3e8);
    expect(v('1.6E-19*2')).toBeCloseTo(3.2e-19, 30);
    expect(v('6.67E-11*5.97E24/(6.37E6)^2')).toBeCloseTo(9.81, 2);
    expect(formatear(3e8)).toBe('300000000');
    expect(formatear(6.022e23)).toBe('6.022E23');
    expect(formatear(1.6e-19)).toBe('1.6E-19');
  });
  it('e minúscula es la constante y multiplicación implícita', () => {
    expect(v('2e')).toBeCloseTo(2 * Math.E, 12);
    expect(v('2π')).toBeCloseTo(2 * Math.PI, 12);
    expect(v('2(3+1)')).toBe(8);
    expect(v('(1+1)(2+1)')).toBe(6);
    expect(v('3sqrt(4)')).toBe(6);
  });
});

describe('calculadora · funciones', () => {
  it('inversas en grados y radianes', () => {
    expect(v('asin(0.5)', 'DEG')).toBeCloseTo(30, 10);
    expect(v('sin⁻¹(1)', 'DEG')).toBeCloseTo(90, 10);
    expect(v('acos(-1)', 'RAD')).toBeCloseTo(Math.PI, 12);
    expect(v('atan(1)', 'DEG')).toBeCloseTo(45, 10);
  });
  it('ángulos notables exactos', () => {
    expect(v('sin(180)')).toBe(0);
    expect(v('cos(90)')).toBe(0);
    expect(v('tan(45)')).toBeCloseTo(1, 12);
    expect(err('tan(90)')).toMatch(/dominio/i);
  });
  it('raíces de índice arbitrario, cubos y cuadrados', () => {
    expect(v('root(3, 27)')).toBeCloseTo(3, 12);
    expect(v('root(3, -8)')).toBeCloseTo(-2, 12);
    expect(v('root(4, 16)')).toBeCloseTo(2, 12);
    expect(v('∛(-27)')).toBeCloseTo(-3, 12);
    expect(v('5²')).toBe(25);
    expect(v('2³')).toBe(8);
    expect(v('4^(-1)')).toBe(0.25);
    expect(err('root(2, -4)')).toMatch(/dominio/i);
  });
  it('factorial, porcentaje, valor absoluto, exponencial', () => {
    expect(v('5!')).toBe(120);
    expect(v('0!')).toBe(1);
    expect(v('3!^2')).toBe(36);
    expect(v('50%')).toBe(0.5);
    expect(v('200*15%')).toBe(30);
    expect(v('abs(-7.5)')).toBe(7.5);
    expect(v('exp(1)')).toBeCloseTo(Math.E, 12);
    expect(err('3.5!')).toMatch(/entero/i);
    expect(err('(-1)!')).toMatch(/entero/i);
    expect(err(`${LIMITES.factorial + 1}!`)).toMatch(/factorial/i);
  });
  it('ANS recupera el resultado anterior', () => {
    expect(v('ans*2', 'DEG', 21)).toBe(42);
    expect(v('ANS+1', 'DEG', 1)).toBe(2);
  });
  it('dominios', () => {
    expect(err('sqrt(-1)')).toMatch(/dominio/i);
    expect(err('log(0)')).toMatch(/dominio/i);
    expect(err('ln(-2)')).toMatch(/dominio/i);
    expect(err('asin(2)')).toMatch(/dominio/i);
    expect(err('(-8)^0.5')).toMatch(/dominio/i);
    expect(err('0^-1')).toMatch(/división/i);
    expect(err('10^400')).toMatch(/grande/i);
  });
});

describe('calculadora · seguridad', () => {
  it('no ejecuta código ni acepta identificadores fuera de la lista', () => {
    for (const e of ['alert(1)', 'constructor', '__proto__', 'this', 'window.location', 'process.exit()', 'x=2', '"2"', '`2`',
      'Function("return 1")()', 'sin.constructor', '[1]', '{}', '2;3', 'e=3', 'eval(1)', 'Math.PI']) {
      const r = evaluar(e);
      expect(r.ok, e).toBe(false);
    }
  });
  it('límites de longitud y anidamiento', () => {
    expect(err('1+'.repeat(150) + '1')).toMatch(/larga/i);
    expect(err('('.repeat(40) + '1' + ')'.repeat(40))).toMatch(/anidada/i);
  });
  it('el motor no usa eval ni new Function', () => {
    const src = readFileSync('src/lib/calculadora/motor.ts', 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(src).not.toMatch(/\beval\s*\(|new\s+Function|Function\s*\(/);
  });
});
