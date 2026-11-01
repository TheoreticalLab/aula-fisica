/** LIEIA · etapas 5, 6 y 8: TRI por examen, simulador y tamaños muestrales, reapertura de investigaciones. */
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/lib/fisica/variantes';
import type { Matriz } from '../src/lib/lieia/ciencia/psicometria';
import { ajustarTRI } from '../src/lib/lieia/ciencia/tri';
import { ESCENARIO_BASE, nCorrelacion, nProporciones, potenciaCorrelacion, probit, simular, type ItemSim } from '../src/lib/lieia/ciencia/simulacion';
import { reabrir } from '../src/lib/lieia/ciencia/historial';
import { analizar } from '../src/lib/lieia/ciencia/informe';
import type { Pregunta } from '../src/lib/lieia/ciencia/modelo';

/** Matriz sintética 2PL con parámetros verdaderos conocidos; «pareja» añade un factor común a dos preguntas (dependencia local). */
function matriz2PL(n: number, items: { a: number; b: number }[], semilla: number, pareja?: [number, number]): Matriz {
  const rnd = mulberry32(semilla);
  const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const x = Array.from({ length: n }, () => {
    const th = normal(), extra = normal() * 1.5;
    return items.map((it, j) => (rnd() < 1 / (1 + Math.exp(-it.a * (th - it.b + (pareja?.includes(j) ? extra : 0)))) ? 1 : 0) as 0 | 1);
  });
  const K = items.length;
  return { items: items.map((_, j) => `q${j + 1}`), estudiantes: x.map((_, s) => `E${s}`), x, tiempos: x.map(() => Array(K).fill(null)), fichas: x.map(() => Array(K).fill('f')), cambios: x.map(() => Array(K).fill(0)), posiciones: x.map(() => items.map((_, j) => j + 1)) };
}

describe('etapa 5 · TRI por examen', () => {
  const verdad = [{ a: 1, b: -1.5 }, { a: 1.5, b: -0.5 }, { a: 0.8, b: 0 }, { a: 1.2, b: 0.5 }, { a: 1, b: 1.5 }, { a: 1.4, b: 1 }];
  it('se abstiene con menos de 50 estudiantes', () => {
    const t = ajustarTRI(matriz2PL(30, verdad, 1));
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.motivo).toMatch(/al menos 50/);
  });
  it('recupera las dificultades verdaderas (orden y error) con n = 600 y da errores típicos', () => {
    const t = ajustarTRI(matriz2PL(600, verdad, 2));
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.estabilidad).toBe('estable');
    const b = t.items.map((i) => i.cal.b);
    verdad.forEach((v, j) => expect(Math.abs(b[j] - v.b)).toBeLessThan(0.35));
    expect(t.items.every((i) => i.cal.se_b > 0 && i.cal.se_b < 0.5)).toBe(true);
    expect(t.curva.length).toBeGreaterThan(10);
  });
  it('señala la dependencia local de un par con un factor común (Q3) y no la inventa sin él', () => {
    // con muy pocas preguntas el 2PL absorbe el factor común en θ (limitación conocida de Q3): se prueba con 12
    const doce = Array.from({ length: 12 }, (_, j) => ({ a: 0.8 + (j % 4) * 0.25, b: -1.5 + j * 0.27 }));
    const con = ajustarTRI(matriz2PL(600, doce, 3, [1, 3]));
    const sin = ajustarTRI(matriz2PL(600, doce, 3));
    expect(con.ok && con.q3.some((p) => (p.a === 'q2' && p.b === 'q4'))).toBe(true);
    expect(sin.ok && sin.q3.length).toBeLessThanOrEqual(1);
  });
  it('con 50–199 estudiantes el ajuste es provisional y lo advierte', () => {
    const t = ajustarTRI(matriz2PL(80, verdad, 4));
    expect(t.ok && t.estabilidad === 'provisional' && t.avisos.join(' ').includes('provisional')).toBe(true);
  });
});

describe('etapa 6 · simulador (casos 9.1, 9.2; pruebas 14 y 15)', () => {
  const items: ItemSim[] = Array.from({ length: 12 }, (_, j) => ({ id: `q${j}`, etiqueta: `P${j + 1}`, dificultad: (['basico', 'intermedio', 'desafiante'] as const)[j % 3], formato: j % 2 ? 'numeric' : 'choice', tiempoMin: j % 2 ? 4 : 1.5 }));
  it('es reproducible y declara que los parámetros son a priori', () => {
    const a = simular(items, ESCENARIO_BASE, 50, 7), b = simular(items, ESCENARIO_BASE, 50, 7);
    expect(a).toEqual(b);
    expect(a.procedenciaParametros).toEqual({ calibrados: 0, aPriori: 12 });
    expect(a.supuestos.join(' ')).toMatch(/A PRIORI/);
  });
  it('un límite de 15 min produce más omisiones por tiempo y menos estudiantes que terminan que uno de 60', () => {
    const corto = simular(items, { ...ESCENARIO_BASE, limiteMin: 15 }, 60, 1), largo = simular(items, { ...ESCENARIO_BASE, limiteMin: 60 }, 60, 1);
    const ot = (r: typeof corto) => r.porItem.reduce((s, i) => s + i.omiteTiempo, 0);
    expect(ot(corto)).toBeGreaterThan(ot(largo));
    expect(corto.terminan).toBeLessThan(largo.terminan);
    // con orden fijo, lo no alcanzado se concentra al final
    expect(corto.porItem[11].omiteTiempo).toBeGreaterThan(corto.porItem[0].omiteTiempo);
  });
  it('quitar preguntas reduce la confiabilidad simulada; los parámetros calibrados se usan y se cuentan', () => {
    const todas = simular(items, ESCENARIO_BASE, 60, 2), menos = simular(items, { ...ESCENARIO_BASE, excluir: ['q0', 'q1', 'q2', 'q3', 'q4', 'q5'] }, 60, 2);
    expect(menos.porItem.length).toBe(6);
    expect(menos.kr20!.mediana).toBeLessThan(todas.kr20!.mediana);
    const cal = items.map((i, j) => (j < 3 ? { ...i, cal: { a: 2, b: 0, se_a: 0.1, se_b: 0.1, beta_t: Math.log(60), sigma_t: 0.5, n_resp: 300, n_tiempos: 300, estado: 'calibrado' as const } } : i));
    expect(simular(cal, ESCENARIO_BASE, 10, 3).procedenciaParametros).toEqual({ calibrados: 3, aPriori: 9 });
  });
  it('tamaños muestrales coinciden con valores de referencia', () => {
    expect(probit(0.975)).toBeCloseTo(1.959964, 5);
    expect(nCorrelacion(0.3)).toBe(85);
    expect(potenciaCorrelacion(0.3, 85)).toBeGreaterThan(0.79);
    expect(nProporciones(0.5, 0.7)).toBe(93);
  });
});

describe('etapa 8 · reapertura: preregistrada frente a exploratoria (Pantalla 6)', () => {
  const ps: Pregunta[] = [1, 2, 3].map((i) => ({ id: `q${i}`, posicion: i, prompt: 'x', format: 'numeric', category: 'numerica', difficulty: 'intermedio', concepts: ['c'], opciones: null, unit_hint: 'm' }));
  const inf = analizar(ps, null);
  it('una investigación guardada con n = 0 es preregistrada; con datos, exploratoria; si ya no aparece, se dice', () => {
    const r = reabrir([
      { id: '1', clave: 'con:confiabilidad', estado: 'guardada', version_examen: 'otra', payload: { titulo: 'Confiabilidad', resultado: null }, procedencia: { n: 0 }, updated_at: '' },
      { id: '2', clave: 'con:confiabilidad', estado: 'guardada', version_examen: inf.version, payload: { titulo: 'Confiabilidad', resultado: 'KR-20 = 0,7' }, procedencia: { n: 40 }, updated_at: '' },
      { id: '3', clave: 'abi:x:y', estado: 'guardada', version_examen: 'v', payload: { titulo: 'Asociación' }, procedencia: { n: 40 }, updated_at: '' },
    ], inf);
    expect(r[0]).toMatchObject({ tipo: 'preregistrada', cambio: 'nuevos_datos' });
    expect(r[1]).toMatchObject({ tipo: 'exploratoria', cambio: 'sin_cambios', resultadoEntonces: 'KR-20 = 0,7' });
    expect(r[1].explicacion).toMatch(/otra aplicación/);
    expect(r[2]).toMatchObject({ cambio: 'ya_no_aplica', estadoAhora: 'ya_no_aplica' });
  });
});
