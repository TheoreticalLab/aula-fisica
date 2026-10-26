import { describe, expect, it } from 'vitest';
import type { Activity, ExerciseKeyRow } from '@/api/tipos';
import { crearSimulador, lecturaSimulada } from '@/lib/simulacion';

const claves = new Map<string, ExerciseKeyRow>([
  ['num', { exercise_id: 'num', answer: { format: 'numeric', value: '50 m', relTol: 0.05 }, hints: ['Pista 1', 'Pista 2'], explanation: 'Explicación numérica' }],
  ['sel', { exercise_id: 'sel', answer: { format: 'choice', correct: [1] }, hints: [], explanation: 'Explicación de selección' }],
]);
const opciones = new Map([['sel', 4]]);
const practica: Pick<Activity, 'mode' | 'reveal_policy' | 'hints_enabled' | 'max_tries_per_item'> = { mode: 'practice', reveal_policy: 'immediate', hints_enabled: true, max_tries_per_item: 3 };

describe('vista previa: simulación de una práctica (mismas reglas que el servidor)', () => {
  it('un fallo no cierra el ejercicio; acertar después da crédito con penalización y muestra la solución', async () => {
    const s = crearSimulador(practica, claves, opciones);
    const r1 = await s.comprobar('x', 'num', { text: '100 m' });
    expect(r1.state).toMatchObject({ status: 'incorrect', tries: 1, locked: false, solution: null });
    const r2 = await s.comprobar('x', 'num', { text: '50 m' });
    expect(r2.state).toMatchObject({ status: 'correct', tries: 2, locked: true });
    expect(r2.state!.credit).toBeCloseTo(0.8); // 1 − 0.2 por un reintento
    expect(r2.state!.solution?.explanation).toBe('Explicación numérica');
    await expect(s.comprobar('x', 'num', { text: '50 m' })).rejects.toThrow('ya está cerrado');
  });

  it('las pistas restan 10 % y se entregan en orden', async () => {
    const s = crearSimulador(practica, claves, opciones);
    expect((await s.pista('x', 'num')).hint).toBe('Pista 1');
    const r = await s.comprobar('x', 'num', { text: '50 m' });
    expect(r.state!.credit).toBeCloseTo(0.9);
    expect((await s.pista('x', 'num')).hint).toBe('Pista 2');
    expect((await s.pista('x', 'num')).hint).toBeNull();
  });

  it('tras agotar los intentos se cierra y muestra la solución', async () => {
    const s = crearSimulador(practica, claves, opciones);
    await s.comprobar('x', 'sel', { selected: [0] });
    await s.comprobar('x', 'sel', { selected: [2] });
    const r = await s.comprobar('x', 'sel', { selected: [3] });
    expect(r.state).toMatchObject({ status: 'incorrect', tries: 3, locked: true });
    expect(r.state!.solution).not.toBeNull();
  });

  it('una respuesta que no se entiende no cuenta como intento', async () => {
    const s = crearSimulador(practica, claves, opciones);
    const r = await s.comprobar('x', 'num', { text: 'cincuenta' });
    expect(r.recorded).toBe(false);
    expect((await s.comprobar('x', 'num', { text: '50 m' })).state!.credit).toBeCloseTo(1);
  });
});

describe('vista previa: simulación de una evaluación', () => {
  const examen = { ...practica, mode: 'exam' as const, reveal_policy: 'after_submit' as const, hints_enabled: false };

  it('no da retroalimentación ni pistas mientras se responde', async () => {
    const s = crearSimulador(examen, claves, opciones);
    await expect(s.comprobar('x', 'num', { text: '50 m' })).rejects.toThrow('retroalimentación inmediata');
    await expect(s.pista('x', 'num')).rejects.toThrow('evaluaciones');
  });

  it('al entregar califica lo guardado; lo no respondido cuenta como incorrecto', async () => {
    const s = crearSimulador(examen, claves, opciones);
    await s.guardar('x', 'num', { text: '50 m' });
    const r = s.entregar(new Map([['num', 2], ['sel', 3]]));
    expect(r).toMatchObject({ score: 2, max: 5 });
    expect(r.porEjercicio.get('sel')!.status).toBe('incorrect');
  });
});

describe('vista previa: lectura cronometrada simulada', () => {
  it('cuenta solo el tiempo real entre latidos seguidos y se detiene al salir', async () => {
    let t = 0;
    const l = lecturaSimulada(60, () => t);
    expect((await l.latido(true)).seconds_read).toBe(0);
    t += 10_000;
    expect((await l.latido(true)).seconds_read).toBe(10);
    await l.latido(false); // sale
    t += 300_000;
    expect((await l.latido(true)).seconds_read).toBe(10); // el tiempo fuera no cuenta
    for (const s of [20, 20, 20]) {
      t += s * 1000;
      await l.latido(true);
    }
    const e = await l.estado();
    expect(e).toMatchObject({ seconds_read: 60, completed: true, pauses: 1 });
  });
});
