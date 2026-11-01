/** LIEIA · DIF, modos de diseño K/M/N/O/P/R, asignación reproducible, potencia simulada y explorador. */
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/lib/fisica/variantes';
import type { Matriz } from '../src/lib/lieia/ciencia/psicometria';
import { difMH } from '../src/lib/lieia/ciencia/dif';
import { analizarContenido } from '../src/lib/lieia/ciencia/contenido';
import { asignarCondiciones, disenar, interpretarHipotesis, MIN_ADAPTATIVO, type ItemBancoCiencia } from '../src/lib/lieia/ciencia/disenador';
import { nCorrelacion, potenciaCorrelacionalSimulada, type ItemSim } from '../src/lib/lieia/ciencia/simulacion';
import { explorar } from '../src/lib/lieia/ciencia/explorador';
import { analizar } from '../src/lib/lieia/ciencia/informe';
import type { DatosReales, Pregunta } from '../src/lib/lieia/ciencia/modelo';
import type { MetaBanco } from '../src/lib/banco';

/** Dos grupos con la misma distribución de habilidad; la pregunta «sesgada» es más difícil para el grupo B. */
function matrizDIF(n: number, sesgada: number | null, semilla: number): { m: Matriz; grupos: Map<string, string | null> } {
  const rnd = mulberry32(semilla);
  const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const K = 10, grupos = new Map<string, string | null>();
  const x = Array.from({ length: n }, (_, s) => {
    const g = s % 2 ? 'B' : 'A';
    grupos.set(`E${s}`, g);
    const th = normal();
    return Array.from({ length: K }, (_, j) => { const b = -1 + j * 0.2 + (j === sesgada && g === 'B' ? 1.2 : 0); return (rnd() < 1 / (1 + Math.exp(-(th - b))) ? 1 : 0) as 0 | 1; });
  });
  return { m: { items: Array.from({ length: K }, (_, j) => `q${j + 1}`), estudiantes: x.map((_, s) => `E${s}`), x, tiempos: x.map(() => Array(K).fill(null)), fichas: x.map(() => Array(K).fill('f')), cambios: x.map(() => Array(K).fill(0)), posiciones: x.map(() => Array.from({ length: K }, (_, j) => j + 1)) }, grupos };
}

describe('DIF (Mantel-Haenszel)', () => {
  it('detecta la pregunta con funcionamiento diferencial conocido y no las demás', () => {
    const { m, grupos } = matrizDIF(800, 4, 1);
    const r = difMH(m, grupos);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items[4].clase).toMatch(/B|C/);
    expect(r.items[4].favorece).toBe('A');
    expect(r.items.filter((i, j) => j !== 4 && i.clase !== 'A').length).toBeLessThanOrEqual(1);
  });
  it('sin DIF verdadero, todo queda en clase A (casi siempre); con grupos pequeños o sin grupos se abstiene', () => {
    const { m, grupos } = matrizDIF(800, null, 2);
    const r = difMH(m, grupos);
    expect(r.ok && r.items.filter((i) => i.clase !== 'A').length).toBeLessThanOrEqual(1);
    expect(difMH(matrizDIF(30, 4, 3).m, matrizDIF(30, 4, 3).grupos).ok).toBe(false);
    const sinGrupo = new Map(m.estudiantes.map((s) => [s, null]));
    const r2 = difMH(m, sinGrupo);
    expect(!r2.ok && r2.motivo).toMatch(/subgrupos/);
  });
});

const meta = (o: Partial<MetaBanco>): MetaBanco => ({ tema: 't', previos: [], datos: [], solicitado: [], tipo: 'calculo', choque: 'ninguno' as never, etapas: 1, friccion: false, energia: false, cinematica: false, plano: false, ...o });
function banco(calibradas: number): ItemBancoCiencia[] {
  const conceptos = ['segunda-ley-newton', 'impulso', 'energia-mecanica', 'cantidad-movimiento'];
  const temas = ['Segunda ley de Newton', 'Impulso', 'Energía mecánica', 'Cantidad de movimiento'];
  return Array.from({ length: 32 }, (_, i) => {
    const num = Math.floor(i / 4) % 2 === 1;           // el formato varía independientemente del concepto
    const p: Pregunta = {
      id: `q${i + 1}`, posicion: i + 1, prompt: `Enunciado ${i} distinto${i}`, format: num ? 'numeric' : 'choice', category: num ? 'numerica' : 'conceptual',
      difficulty: (['basico', 'intermedio', 'desafiante'] as const)[i % 3], concepts: [conceptos[i % 4]], opciones: num ? null : 4, unit_hint: 'u',
      meta: meta({ tema: temas[i % 4], familia: (['A', 'B', 'C', 'D'] as const)[i % 4], tipo: num ? 'calculo' : 'conceptual' }),
    };
    return { pregunta: p, analisis: analizarContenido(p), historico: null,
      cal: i < calibradas ? { a: 0.8 + (i % 5) * 0.3, b: -2 + (i % 9) * 0.5, se_a: 0.1, se_b: 0.15, beta_t: Math.log(90), sigma_t: 0.5, n_resp: 300, n_tiempos: 0, estado: 'calibrado' as const } : null };
  });
}
const base = { n: 8, minutos: null, obligatorios: [], conceptos: [], base: [], semilla: 5 };

describe('modos de diseño nuevos', () => {
  it('K y O: formas paralelas A/B con etiquetas y riesgos metodológicos; O exige consentimiento', () => {
    const k = disenar(banco(0), { ...base, modo: 'K' });
    expect(k.etiquetasVersion).toEqual({ A: 'Antes (pretest)', B: 'Después (postest)' });
    expect(k.items.filter((i) => i.version === 'A').length).toBe(k.items.filter((i) => i.version === 'B').length);
    expect(k.riesgos.join(' ')).toMatch(/grupo de control/);
    const o = disenar(banco(0), { ...base, modo: 'O' });
    expect(o.riesgos.join(' ')).toMatch(/consentimiento/);
    expect(o.riesgos.join(' ')).toMatch(/no habilita sanciones/);
  });
  it('N: pares del mismo concepto con distinto tipo o formato', () => {
    const n = disenar(banco(0), { ...base, modo: 'N' });
    expect(n.items.length).toBeGreaterThanOrEqual(2);
    expect(n.items[1].razon).toMatch(/otro contexto/);
  });
  it('M: se niega sin suficientes calibradas; con ellas especifica y simula el adaptativo (y avisa que el motor no lo administra)', () => {
    expect(() => disenar(banco(MIN_ADAPTATIVO - 1), { ...base, modo: 'M' })).toThrow(/calibrados/);
    const m = disenar(banco(20), { ...base, modo: 'M', n: 10 });
    expect(m.items.length).toBe(20);
    expect(m.adaptativo!.simulacion.itemsMedios).toBeLessThanOrEqual(10);
    expect(m.adaptativo!.simulacion.correlacion).toBeGreaterThan(0.7);
    expect(m.adaptativo!.aviso).toMatch(/NO administra/);
    expect(m.validacion).toBe('parcialmente_empirica');
  });
  it('P: interpreta la hipótesis por conceptos del banco y propone un diseño correlacional; si no reconoce conceptos, lo dice', () => {
    const h = interpretarHipotesis('Quiero investigar si quienes dominan la segunda ley de Newton comprenden mejor el impulso', banco(0));
    expect(h.conceptosA).toContain('segunda-ley-newton');
    expect(h.conceptosB).toContain('impulso');
    const p = disenar(banco(0), { ...base, modo: 'P', hipotesis: 'Quienes dominan la energía mecánica también dominan la cantidad de movimiento' });
    expect(p.hipotesisFormal!.conceptosA).toContain('energia-mecanica');
    expect(p.riesgos.join(' ')).toMatch(/asociación, no como causa/);
    expect(() => disenar(banco(0), { ...base, modo: 'P', hipotesis: 'algo sin relación alguna' })).toThrow(/No encontré/);
  });
  it('R: prioriza las preguntas con parámetros más inciertos (las no calibradas)', () => {
    const r = disenar(banco(16), { ...base, modo: 'R' });
    const ids = new Set(Array.from({ length: 16 }, (_, i) => `q${i + 1}`));
    expect(r.items.filter((i) => ids.has(i.id)).length).toBeLessThanOrEqual(2);
  });
  it('asignación de condiciones: equilibrada, reproducible y distinta con otra semilla', () => {
    const ids = Array.from({ length: 21 }, (_, i) => `u${i}`);
    const a = asignarCondiciones(ids, 9), b = asignarCondiciones(ids, 9), c = asignarCondiciones(ids, 10);
    expect(a).toEqual(b);
    expect(Math.abs(a.filter((x) => x.condicion === 'A').length - a.filter((x) => x.condicion === 'B').length)).toBeLessThanOrEqual(1);
    expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id));
  });
});

describe('potencia por simulación', () => {
  it('con muchas preguntas se acerca a la analítica; con pocas, la correlación se atenúa y la potencia baja', () => {
    const it = (k: number): ItemSim[] => Array.from({ length: k }, (_, j) => ({ id: `x${j}`, etiqueta: '', dificultad: (['basico', 'intermedio', 'desafiante'] as const)[j % 3], formato: 'choice', tiempoMin: 1 }));
    const n = nCorrelacion(0.5);                             // ≈ 29
    const muchas = potenciaCorrelacionalSimulada(it(40), it(40), 0.5, n, 200, 1);
    const pocas = potenciaCorrelacionalSimulada(it(2), it(2), 0.5, n, 200, 1);
    expect(muchas.potencia).toBeGreaterThan(0.6);
    expect(pocas.atenuacion).toBeLessThan(muchas.atenuacion);
    expect(pocas.potencia).toBeLessThan(muchas.potencia);
    expect(muchas.supuestos.join(' ')).toMatch(/sintéticos/);
  });
});

describe('explorador sin IA', () => {
  const ps: Pregunta[] = [1, 2, 3, 4].map((i) => ({ id: `q${i}`, posicion: i, prompt: `Calcule la fuerza ${i}`, format: 'numeric', category: 'numerica', difficulty: 'intermedio', concepts: [i < 3 ? 'newton' : 'energia'], opciones: null, unit_hint: 'N' }));
  it('con n = 0 responde sin inventar cifras', () => {
    const inf = analizar(ps, null);
    const r = explorar('¿Cuáles tienen mayor poder discriminativo observado?', inf);
    expect(r.lineas.join(' ')).toMatch(/n = 0/);
    expect(explorar('¿Qué podría investigar con estos datos?', inf).accion?.vista).toBe('investigar');
  });
  it('enruta intenciones a procedimientos y modos', () => {
    const rnd = mulberry32(4);
    const d: DatosReales = { items: ps.map((p) => ({ exercise_id: p.id, posicion: p.posicion })), con_tiempos: false,
      estudiantes: Array.from({ length: 40 }, (_, s) => ({ seudonimo: `E${s}`, inicio: '', fin: null, respuestas: ps.map((p) => { const c = rnd() < 0.6; return { exercise_id: p.id, ficha: c ? 'ok' : 'x', correcta: c, primera: null, ultima: null, cambios: 0 }; }) })) };
    const inf = analizar(ps, d);
    expect(explorar('¿Cómo diseño un examen que mida comprensión conceptual?', inf).accion).toMatchObject({ vista: 'disenar', modo: 'C' });
    expect(explorar('¿Qué preguntas debería añadir para reducir incertidumbre?', inf).accion?.modo).toBe('R');
    expect(explorar('Quiero saber si quienes dominan energía mecánica también dominan cantidad de movimiento', inf).accion?.modo).toBe('P');
    expect(explorar('¿Qué tan confiable es el examen?', inf).lineas[0]).toMatch(/KR-20/);
    expect(explorar('xyz', inf).intencion).toBe('No reconocida');
  });
});
