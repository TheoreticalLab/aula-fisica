/**
 * El validador de la biblioteca debe RECHAZAR contenido defectuoso (no basta con que apruebe el correcto),
 * y el instalador debe generar SQL que respete las personalizaciones del profesor.
 */
import { describe, expect, it } from 'vitest';
import type { EjercicioBiblioteca, MiniCapitulo } from '../scripts/biblioteca/tipos';
import { validarMini, valorSI } from '../scripts/biblioteca/validar';
import { sqlBiblioteca } from '../scripts/generar-curso';

const TEORIA = String.raw`## Introducción
Texto.

## Explicación conceptual
Texto.

## Desarrollo matemático
$$a = \frac{\Delta v}{\Delta t}$$

## Interpretación de las ecuaciones
Texto.`;

function num(id: string, d: EjercicioBiblioteca['difficulty'], over: Partial<EjercicioBiblioteca> = {}): EjercicioBiblioteca {
  return {
    id, category: 'numerica', difficulty: d, concepts: ['c-1'], format: 'numeric', unitHint: 'm/s²',
    prompt: String.raw`Pasa de $2.0\ \mathrm{m/s}$ a $8.0\ \mathrm{m/s}$ en $3.0\ \mathrm{s}$. ¿Aceleración media?`,
    clave: { answer: { format: 'numeric', value: '2.0 m/s^2', commonErrors: [{ value: '2.67 m/s^2', message: 'Usó la velocidad final.' }] }, hints: ['Δv/Δt'], explanation: 'Δv/Δt = 2.0 m/s².' },
    verificar: () => (8 - 2) / 3,
    ...over,
  };
}
function sel(id: string, d: EjercicioBiblioteca['difficulty']): EjercicioBiblioteca {
  return {
    id, category: 'conceptual', difficulty: d, concepts: ['c-1'], format: 'choice', prompt: '¿Signo?', options: ['+', '−'],
    clave: { answer: { format: 'choice', correct: [0], optionFeedback: { 1: 'Revise el sentido.' } }, hints: ['Piense.'], explanation: 'Positivo.' },
  };
}
function miniValido(): MiniCapitulo {
  return {
    slug: 'prueba', titulo: 'Prueba', resumen: 'Resumen.', conceptos: [{ slug: 'c-1', name: 'Concepto' }],
    objetivos: ['Uno.', 'Dos.'], teoria: TEORIA, formulas: [],
    ejemplos: [{ title: 'E', statement: 'S', steps: ['1', '2'], result: 'R' }],
    errores: [{ error: 'a', aclaracion: 'b' }, { error: 'c', aclaracion: 'd' }],
    preguntas: [{ pregunta: 'p', respuesta: 'r' }, { pregunta: 'p2', respuesta: 'r2' }],
    autoevaluacion: [{ pregunta: 'q', opciones: ['x', 'y'], correcta: 0, explicacion: 'e' }, { pregunta: 'q2', opciones: ['x', 'y'], correcta: 1, explicacion: 'e' }],
    conexiones: 'Usa 2.3.', simulacion: null,
    ejercicios: [num('e1', 'basico'), sel('e2', 'basico'), num('e3', 'basico'), sel('e4', 'intermedio'), num('e5', 'intermedio'), num('e6', 'desafiante')],
  };
}
const validar = (m: MiniCapitulo) => {
  const p: string[] = [];
  validarMini('m', m, new Set(['c-1']), p);
  return p;
};

describe('validador de la biblioteca', () => {
  it('acepta un minicapítulo completo y correcto', () => {
    expect(validar(miniValido())).toEqual([]);
  });

  it('exige las secciones B–E de la teoría', () => {
    const m = { ...miniValido(), teoria: TEORIA.replace('## Desarrollo matemático', '## Matemáticas') };
    expect(validar(m).join()).toMatch(/desarrollo matematico/);
  });

  it('exige la distribución 3 fáciles / 2 intermedios / 1 difícil', () => {
    const m = miniValido();
    m.ejercicios[5] = num('e6', 'intermedio');
    expect(validar(m).join()).toMatch(/3 fáciles, 2 intermedios y 1 difícil/);
  });

  it('detecta una clave que no coincide con la comprobación física independiente', () => {
    const m = miniValido();
    m.ejercicios[0] = num('e1', 'basico', { verificar: () => (8 + 2) / 3 });
    expect(validar(m).join()).toMatch(/no coincide con la comprobación independiente/);
  });

  it('exige la comprobación independiente en los numéricos', () => {
    const m = miniValido();
    m.ejercicios[0] = num('e1', 'basico', { verificar: undefined });
    expect(validar(m).join()).toMatch(/sin comprobación independiente/);
  });

  it('detecta un error típico que caería dentro de la tolerancia', () => {
    const m = miniValido();
    m.ejercicios[0] = num('e1', 'basico', { clave: { answer: { format: 'numeric', value: '2.0 m/s^2', commonErrors: [{ value: '2.01 m/s^2', message: 'x' }] }, hints: ['h'], explanation: 'e' } });
    expect(validar(m).join()).toMatch(/cae dentro de la tolerancia/);
  });

  it('detecta errores típicos de otra dimensión (nunca se activarían) y ángulos con tolerancia relativa', () => {
    const m = miniValido();
    m.ejercicios[0] = num('e1', 'basico', { clave: { answer: { format: 'numeric', value: '2.0 m/s^2', commonErrors: [{ value: '6 m/s', message: 'x' }] }, hints: ['h'], explanation: 'e' } });
    m.ejercicios[2] = num('e3', 'basico', { verificar: () => (30 * Math.PI) / 180, clave: { answer: { format: 'numeric', value: '30 °' }, hints: ['h'], explanation: 'e' } });
    const p = validar(m).join();
    expect(p).toMatch(/otra dimensión que la clave/);
    expect(p).toMatch(/respuesta en grados/);
  });

  it('exige retroalimentación para cada opción incorrecta', () => {
    const m = miniValido();
    m.ejercicios[1] = { ...sel('e2', 'basico'), options: ['+', '−', '0'] };
    expect(validar(m).join()).toMatch(/sin retroalimentación: 2/);
  });

  it('detecta LaTeX inválido y conceptos desconocidos', () => {
    const m = miniValido();
    m.teoria += '\n\n$\\frac{1}{$';
    m.ejercicios[2] = num('e3', 'basico', { concepts: ['no-existe'] });
    const p = validar(m).join();
    expect(p).toMatch(/LaTeX|número impar/);
    expect(p).toMatch(/concepto desconocido/);
  });

  it('valorSI convierte las claves a unidades SI', () => {
    expect(valorSI('72 km/h')).toBeCloseTo(20, 10);
    expect(valorSI('500 g')).toBeCloseTo(0.5, 10);
    expect(valorSI('-9.8 m/s^2')).toBeCloseTo(-9.8, 10);
  });
});

describe('instalador de la biblioteca', () => {
  const sql = sqlBiblioteca({
    dir: '/x',
    curso: { nombre: 'prueba', presentacion: 'Curso de prueba.', objetivos: ['a', 'b'], unidades: ['u1'], instancias: [
      { codigo: 'C-1', titulo: 'Curso 1' },
      { codigo: 'C-1A', titulo: 'Curso 1A', secciones: [{ nombre: 'Sección A', desde: 'C-1' }] },
    ] },
    unidades: [{ carpeta: 'u1', posicion: 1, meta: { slug: 'u1', titulo: 'U1', resumen: 'R', estadoInicial: 'preparado' }, minis: [{ archivo: '01-prueba.ts', posicion: 1, mini: miniValido() }] }],
  });

  it('instala la misma biblioteca en cada asignatura, como copias independientes', () => {
    expect(sql.match(/insert into public\.lessons/g)).toHaveLength(2);
    expect(sql).toMatch(/code = \$aula_b7\$C-1\$aula_b7\$/);
    expect(sql).toMatch(/code = \$aula_b7\$C-1A\$aula_b7\$/);
  });

  it('no pisa lo que el profesor personalizó y no cambia el estado de una unidad ya instalada', () => {
    expect(sql).toMatch(/where lessons\.customized = false/);
    expect(sql).toMatch(/where exercises\.customized = false/);
    expect(sql).toMatch(/where exercise_keys\.customized = false/);
    const unidades = sql.match(/insert into public\.units[\s\S]*?;/g)!.join('\n');
    expect(unidades).not.toMatch(/do update set[^;]*status/);
  });

  it('marca sus escrituras como «biblioteca» y nunca borra nada', () => {
    expect(sql.startsWith('--')).toBe(true);
    expect(sql).toMatch(/set_config\('aula\.origen', 'biblioteca', true\)/);
    expect(sql).not.toMatch(/\bdelete\b|\bdrop\b|\btruncate\b/i);
  });

  it('solo mueve una sección si no tiene actividades', () => {
    expect(sql).toMatch(/if exists \(select 1 from public\.activities where class_id = v_clase\) then\s+raise exception/);
  });
});
