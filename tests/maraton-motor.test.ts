/**
 * Maratón adaptativo: reglas del motor (espejo TS de las funciones SQL de la migración 94) y simulaciones de jornada.
 * Las mismas transiciones se comprueban contra la base de datos en supabase/pruebas/maraton_adaptativo.sql.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_PREDETERMINADA, combinar, erroresConfig } from '@/lib/maraton/config';
import { finJornada, nivelSiguiente, segundosAcreditados, simularJornada, unidades, type Perfil } from '@/lib/maraton/motor';
import { mulberry32 } from '../scripts/maraton/marco';

const C = CONFIG_PREDETERMINADA;

describe('máquina de estados', () => {
  it('ascenso D1→D2 … D5→D6 y permanencia D6→D6 al acertar', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => nivelSiguiente(n, 'respuesta', true, C))).toEqual([2, 3, 4, 5, 6, 6]);
  });
  it('descenso D6→D5 … D2→D1 y permanencia D1→D1 al fallar', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => nivelSiguiente(n, 'respuesta', false, C))).toEqual([1, 1, 2, 3, 4, 5]);
  });
  it('«No puedo» desciende un nivel en todos los niveles', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => nivelSiguiente(n, 'no_puedo', false, C))).toEqual([1, 1, 2, 3, 4, 5]);
  });
  it('el ejemplo del enunciado: D6 → no puedo → D5 → no puedo → D4 → correcto → D5', () => {
    let n = 6;
    n = nivelSiguiente(n, 'no_puedo', false, C);
    n = nivelSiguiente(n, 'no_puedo', false, C);
    expect(n).toBe(4);
    expect(nivelSiguiente(n, 'respuesta', true, C)).toBe(5);
  });
  it('cambiar ejercicio no altera el nivel', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => nivelSiguiente(n, 'cambio', false, C))).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('sin adaptación el nivel queda fijo; saltos configurables', () => {
    const fijo = combinar({ dificultad: { adaptativa: false } });
    expect(nivelSiguiente(3, 'respuesta', true, fijo)).toBe(3);
    const doble = combinar({ dificultad: { ascenso: 2, niveles: 4 } });
    expect(nivelSiguiente(3, 'respuesta', true, doble)).toBe(4);
  });
});

describe('unidades de trabajo', () => {
  it('ponderaciones iniciales D1 1.00, D2 1.20, D3 1.40, D4 1.50, D5 1.00, D6 1.00', () => {
    expect(C.dificultad.pesos).toEqual([1, 1.2, 1.4, 1.5, 1, 1]);
    expect([1, 2, 3, 4, 5, 6].map((n) => unidades(n, 'respuesta', true, 600, 300, C))).toEqual([1, 1.2, 1.4, 1.5, 1, 1]);
  });
  it('una incorrecta suma la mitad (configurable: 1 = igual, 0 = nada); «no puedo» y cambio no suman', () => {
    expect(C.carga.fraccion_fallo).toBe(0.5);
    expect(unidades(3, 'respuesta', true, 400, 180, C)).toBe(1.4);
    expect(unidades(3, 'respuesta', false, 400, 180, C)).toBe(0.7);
    expect(unidades(3, 'respuesta', false, 400, 180, combinar({ carga: { fraccion_fallo: 1 } }))).toBe(1.4);
    expect(unidades(3, 'respuesta', false, 400, 180, combinar({ carga: { fraccion_fallo: 0 } }))).toBe(0);
    expect(unidades(3, 'no_puedo', false, 400, 180, C)).toBe(0);
    expect(unidades(3, 'cambio', false, 400, 180, C)).toBe(0);
  });
  it('una respuesta antes del tiempo mínimo recibe crédito proporcional, no completo (y si es incorrecta, además la fracción)', () => {
    expect(unidades(4, 'respuesta', true, 120, 240, C)).toBe(0.75);
    expect(unidades(4, 'respuesta', false, 120, 240, C)).toBe(0.38);
    expect(unidades(4, 'respuesta', true, 0, 240, C)).toBe(0);
  });
  it('el tiempo acreditado nunca supera el reloj del servidor ni el tope del problema', () => {
    expect(segundosAcreditados(30, 5000, 600)).toBe(30);
    expect(segundosAcreditados(5000, null, 600)).toBe(600);
    expect(segundosAcreditados(300, 120, 600)).toBe(120);
    expect(segundosAcreditados(300, -5, 600)).toBe(0);
  });
});

describe('finalización de la jornada', () => {
  it('vía A: cuota de 12 unidades, nunca antes de 30 min de trabajo efectivo', () => {
    expect(finJornada({ unidades: 11.9, segundos: 2000, validos: 10, presentados: 10, correctas: 6 }, C)).toEqual({ fin: false });
    expect(finJornada({ unidades: 12, segundos: 2000, validos: 10, presentados: 10, correctas: 6 }, C)).toEqual({ fin: true, estado: 'completada', via: 'cuota' });
    expect(finJornada({ unidades: 14, segundos: 1799, validos: 10, presentados: 10, correctas: 6 }, C)).toEqual({ fin: false });
    expect(finJornada({ unidades: 14, segundos: 1800, validos: 10, presentados: 10, correctas: 6 }, C)).toEqual({ fin: true, estado: 'completada', via: 'cuota' });
    expect(finJornada({ unidades: 12, segundos: 600, validos: 10, presentados: 10, correctas: 6 }, combinar({ carga: { minutos_minimos: 0 } }))).toMatchObject({ via: 'cuota' });
  });
  it('vía B: 60 min efectivos y 8 intentos válidos (ambos)', () => {
    expect(finJornada({ unidades: 8, segundos: 3600, validos: 7, presentados: 9, correctas: 6 }, C).fin).toBe(false);
    expect(finJornada({ unidades: 8, segundos: 3599, validos: 8, presentados: 9, correctas: 6 }, C).fin).toBe(false);
    expect(finJornada({ unidades: 8, segundos: 3600, validos: 8, presentados: 9, correctas: 6 }, C)).toEqual({ fin: true, estado: 'completada', via: 'alternativa' });
  });
  it('límites de protección: 90 min, 18 intentos, 30 presentados → cierre seguro para revisión (sin reglas de permanencia)', () => {
    const libre = { min_correctas: 0, fuera_por_presentados: false, fuera_por_continuidad: false, fuera_rapido_nivel: null };
    const sinB = combinar({ carga: { alternativa_activa: false }, permanencia: libre }), L = combinar({ permanencia: libre });
    expect(finJornada({ unidades: 5, segundos: 5400, validos: 5, presentados: 9, correctas: 0 }, sinB)).toMatchObject({ estado: 'cerrada_limite', motivo: 'tiempo' });
    expect(finJornada({ unidades: 5, segundos: 100, validos: 18, presentados: 20, correctas: 0 }, L)).toMatchObject({ estado: 'cerrada_limite', motivo: 'intentos' });
    expect(finJornada({ unidades: 1, segundos: 100, validos: 1, presentados: 30, correctas: 0 }, L)).toMatchObject({ estado: 'cerrada_limite', motivo: 'presentados' });
  });
});

describe('permanencia (migración 98)', () => {
  it('el mínimo de 5 aciertos es requisito para completar por cualquiera de las dos vías', () => {
    expect(finJornada({ unidades: 14, segundos: 2000, validos: 10, presentados: 10, correctas: 4 }, C)).toEqual({ fin: false });
    expect(finJornada({ unidades: 8, segundos: 3700, validos: 10, presentados: 12, correctas: 4 }, C)).toEqual({ fin: false });
    expect(finJornada({ unidades: 8, segundos: 3700, validos: 10, presentados: 12, correctas: 5 }, C)).toMatchObject({ estado: 'completada', via: 'alternativa' });
  });
  it('queda fuera en cuanto ya no puede llegar al mínimo: 26 presentados sin acierto (máx. 30) o 14 respuestas sin acierto (máx. 18)', () => {
    expect(finJornada({ unidades: 0, segundos: 600, validos: 0, presentados: 25, correctas: 0 }, C)).toEqual({ fin: false });
    expect(finJornada({ unidades: 0, segundos: 600, validos: 0, presentados: 26, correctas: 0 }, C)).toEqual({ fin: true, estado: 'fuera', motivo: 'aciertos' });
    expect(finJornada({ unidades: 6, segundos: 900, validos: 13, presentados: 13, correctas: 0 }, C)).toEqual({ fin: false });
    expect(finJornada({ unidades: 6, segundos: 900, validos: 14, presentados: 14, correctas: 0 }, C)).toEqual({ fin: true, estado: 'fuera', motivo: 'aciertos' });
    expect(finJornada({ unidades: 6, segundos: 900, validos: 14, presentados: 14, correctas: 1 }, C)).toEqual({ fin: false });
  });
  it('agotar los 30 problemas sin completar deja fuera aunque tenga el mínimo de aciertos', () => {
    expect(finJornada({ unidades: 6, segundos: 900, validos: 6, presentados: 30, correctas: 5 }, C)).toEqual({ fin: true, estado: 'fuera', motivo: 'presentados' });
  });
  it('los límites de 18 intentos y 90 min con el mínimo alcanzable siguen cerrando para revisión', () => {
    expect(finJornada({ unidades: 9, segundos: 3000, validos: 18, presentados: 20, correctas: 5 }, C)).toMatchObject({ estado: 'cerrada_limite', motivo: 'intentos' });
    expect(finJornada({ unidades: 9, segundos: 5400, validos: 9, presentados: 15, correctas: 3 }, combinar({ carga: { alternativa_activa: false } })))
      .toMatchObject({ estado: 'cerrada_limite', motivo: 'tiempo' });
  });
  it('validación: el mínimo no puede superar los intentos ni los problemas de la jornada; el nivel de rapidez va de 1 a 6', () => {
    expect(erroresConfig(combinar({ permanencia: { min_correctas: 19 } })).join(' ')).toMatch(/nadie podría completarla/);
    expect(erroresConfig(combinar({ permanencia: { fuera_rapido_nivel: 9 } })).join(' ')).toMatch(/rapidez/);
    expect(erroresConfig(combinar({ permanencia: { fuera_rapido_nivel: null } }))).toEqual([]);
  });
});

describe('configuración', () => {
  it('la configuración predeterminada es válida y coincide con maraton_defaults() de la última migración que la define', () => {
    expect(erroresConfig(C)).toEqual([]);
    const dir = join(__dirname, '..', 'supabase', 'migrations');
    const ultima = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().reverse()
      .map((f) => readFileSync(join(dir, f), 'utf8')).find((s) => s.includes('create or replace function public.maraton_defaults()'))!;
    const json = ultima.match(/create or replace function public\.maraton_defaults\(\)[\s\S]*?select '([\s\S]*?)'::jsonb/)![1];
    expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify(C)));
  });
  it('detecta configuraciones inválidas', () => {
    expect(erroresConfig(combinar({ carga: { cuota: 0 } })).join(' ')).toMatch(/cuota/);
    expect(erroresConfig(combinar({ dificultad: { nivel_inicial: 7 } })).join(' ')).toMatch(/nivel inicial/);
    expect(erroresConfig(combinar({ programacion: { modo: 'calendario', calendario: ['2026-12-01'] } })).join(' ')).toMatch(/calendario/);
    expect(erroresConfig(combinar({ programacion: { apertura: '20:00', cierre: '08:00' } })).join(' ')).toMatch(/apertura/);
    expect(erroresConfig(combinar({ dificultad: { pesos: [1, 1, 1] } })).join(' ')).toMatch(/ponderación/);
    expect(erroresConfig(combinar({ carga: { fraccion_fallo: 1.5 } })).join(' ')).toMatch(/incorrecta/);
    expect(erroresConfig(combinar({ carga: { minutos_minimos: 100 } })).join(' ')).toMatch(/supera el límite/);
  });
});

describe('simulación: la ponderación no acorta la jornada de quien resuelve problemas extremos', () => {
  // tiempos realistas por intento (min) y probabilidad de acierto por nivel
  const excepcional: Perfil = { nombre: 'excepcional', acierto: [1, 1, 1, 0.98, 0.95, 0.9], minutos: [3, 4, 6, 8, 10, 12] };
  const medio: Perfil = { nombre: 'medio', acierto: [0.85, 0.7, 0.5, 0.3, 0.15, 0.05], minutos: [4, 5, 7, 9, 11, 13], noPuedo: [0, 0, 0.05, 0.15, 0.3, 0.5] };
  const debil: Perfil = { nombre: 'débil', acierto: [0.5, 0.3, 0.15, 0.05, 0.02, 0.01], minutos: [5, 6, 8, 10, 12, 14], noPuedo: [0.05, 0.15, 0.3, 0.5, 0.6, 0.7] };
  const correr = (p: Perfil, veces = 400) => {
    const az = mulberry32(20261114);
    return Array.from({ length: veces }, () => simularJornada(p, C, 2, az));
  };
  const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('quien vive en D6 no termina antes que un estudiante medio: trabaja al menos 60 min y 8 intentos válidos', () => {
    const e = correr(excepcional), m = correr(medio);
    expect(prom(e.map((r) => r.enD6))).toBeGreaterThan(3);
    // con D5 = D6 = 1 la cuota no es un atajo: termina por la vía B (tiempo + intentos), no antes que el resto
    expect(Math.min(...e.map((r) => r.minutos))).toBeGreaterThanOrEqual(60);
    expect(prom(e.map((r) => r.minutos))).toBeGreaterThanOrEqual(prom(m.map((r) => r.minutos)));
    expect(Math.min(...e.map((r) => r.validos))).toBeGreaterThanOrEqual(8);
  });
  it('contrafactual: si D5 y D6 pesaran según su dificultad, el estudiante excepcional terminaría antes de 60 min; por eso valen 1', () => {
    const inflado = combinar({ dificultad: { pesos: [1, 1.2, 1.4, 1.5, 2.5, 3] } });
    const az = mulberry32(7);
    const con = Array.from({ length: 300 }, () => simularJornada(excepcional, inflado, 2, az));
    expect(prom(con.map((r) => r.minutos))).toBeLessThan(60);
    expect(prom(con.map((r) => r.minutos))).toBeLessThan(prom(correr(excepcional).map((r) => r.minutos)));
    expect(con.every((r) => r.via === 'cuota')).toBe(true);
  });
  it('el estudiante excepcional no queda atrapado: termina por la cuota o por la vía alternativa, dentro de los 90 min', () => {
    const e = correr(excepcional);
    expect(e.every((r) => r.estado === 'completada')).toBe(true);
    expect(Math.max(...e.map((r) => r.minutos))).toBeLessThanOrEqual(90);
    expect(e.some((r) => r.via === 'alternativa')).toBe(true);
  });
  it('un estudiante con dificultades no trabaja indefinidamente: los límites cierran la jornada', () => {
    const d = correr(debil);
    expect(Math.max(...d.map((r) => r.minutos))).toBeLessThanOrEqual(90 + 14);
    expect(Math.max(...d.map((r) => r.presentados))).toBeLessThanOrEqual(30);
    expect(d.every((r) => ['completada', 'cerrada_limite', 'fuera'].includes(r.estado))).toBe(true);
    // con el mínimo de 5 aciertos, el perfil débil (50 % en D1) casi siempre completa
    expect(d.filter((r) => r.estado === 'fuera').length / d.length).toBeLessThan(0.05);
  });
  it('quien trabaja de verdad (excepcional y medio) nunca queda fuera', () => {
    expect([...correr(excepcional), ...correr(medio)].some((r) => r.estado === 'fuera')).toBe(false);
  });
  it('fallar a propósito y rápido ya no completa la jornada: queda fuera (sin acierto posible); sin permanencia, revisión docente', () => {
    // escribe cualquier cosa y espera justo el tiempo mínimo de cada problema (D1 = 1 min)
    const fallador: Perfil = { nombre: 'fallador', acierto: [0, 0, 0, 0, 0, 0], minutos: [1, 2, 3, 4, 5, 7] };
    const libre = { min_correctas: 0, fuera_por_presentados: false, fuera_por_continuidad: false, fuera_rapido_nivel: null };
    const az = mulberry32(3);
    expect(simularJornada(fallador, C, 2, az)).toMatchObject({ estado: 'fuera', motivo: 'aciertos', validos: 14 });
    const ahora = simularJornada(fallador, combinar({ permanencia: libre }), 2, az);
    expect(ahora).toMatchObject({ estado: 'cerrada_limite', motivo: 'intentos' });
    expect(ahora.unidades).toBeLessThan(C.carga.cuota);
    // contrafactual con la regla anterior (incorrecta = correcta y sin tiempo mínimo): jornada completada en ~13 min sin un acierto
    const antes = simularJornada(fallador, combinar({ carga: { fraccion_fallo: 1, minutos_minimos: 0 }, permanencia: libre }), 2, az);
    expect(antes).toMatchObject({ estado: 'completada', via: 'cuota' });
    expect(antes.minutos).toBeLessThanOrEqual(13);
  });
  it('quien trabaja en serio no se ve afectado: el estudiante medio sigue completando por cuota o alternativa', () => {
    const m = correr(medio);
    expect(m.filter((r) => r.estado === 'completada').length / m.length).toBeGreaterThan(0.9);
    expect(Math.min(...m.filter((r) => r.via === 'cuota').map((r) => r.minutos))).toBeGreaterThanOrEqual(30);
  });
  it('la cantidad de ejercicios por jornada es variable', () => {
    const todos = [...correr(excepcional, 100), ...correr(medio, 100), ...correr(debil, 100)];
    expect(new Set(todos.map((r) => r.validos)).size).toBeGreaterThan(3);
  });
});
