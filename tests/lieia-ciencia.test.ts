/**
 * LIEIA · laboratorio científico. Pruebas con VERDAD CONOCIDA (datos sintéticos generados aquí) y escenarios negativos
 * en los que el laboratorio debe abstenerse. Que pasen no valida el modelo científico en datos reales: comprueba que los
 * métodos hacen lo que dicen y que se abstienen cuando deben.
 */
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/lib/fisica/variantes';
import { analizarContenido, aplicarRevision } from '../src/lib/lieia/ciencia/contenido';
import { analizar } from '../src/lib/lieia/ciencia/informe';
import { comparar, disenar, type ItemBancoCiencia } from '../src/lib/lieia/ciencia/disenador';
import type { DatosReales, Pregunta } from '../src/lib/lieia/ciencia/modelo';
import type { MetaBanco } from '../src/lib/banco';

const meta = (o: Partial<MetaBanco>): MetaBanco => ({ tema: 't', previos: [], datos: [], solicitado: [], tipo: 'calculo', choque: 'ninguno' as never, etapas: 1, friccion: false, energia: false, cinematica: false, plano: false, ...o });
const P = (i: number, o: Partial<Pregunta> = {}): Pregunta => ({
  id: `q${i}`, posicion: i, prompt: `Calcule la velocidad del bloque ${i} con masa 2 kg y fuerza 10 N`, format: 'numeric', category: 'numerica', difficulty: 'intermedio',
  concepts: [`c${i}`], opciones: null, unit_hint: 'm/s', ...o,
});

/** Respuestas sintéticas: prob(correcto) = logística(a·(θ_factor − b)). */
function sintetico(n: number, items: { factor: 0 | 1 | 'azar'; b: number; depende?: number }[], semilla = 1, omision?: (j: number) => number): DatosReales {
  const rnd = mulberry32(semilla);
  const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const estudiantes = Array.from({ length: n }, (_, s) => {
    const th = [normal(), normal()];
    const res: boolean[] = [];
    const respuestas = items.map((it, j) => {
      let c = it.factor === 'azar' ? rnd() < 0.5 : rnd() < 1 / (1 + Math.exp(-2 * (th[it.factor] - it.b)));
      if (it.depende !== undefined && !res[it.depende]) c = false;
      res.push(c);
      if (omision && rnd() < omision(j)) return null;
      return { exercise_id: `q${j + 1}`, ficha: c ? 'ok' : `mal${Math.floor(rnd() * 5)}`, correcta: c, primera: null, ultima: null, cambios: 0 };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
    return { seudonimo: `E${s}`, inicio: '2026-11-01T10:00:00Z', fin: '2026-11-01T11:00:00Z', respuestas };
  });
  return { items: items.map((_, j) => ({ exercise_id: `q${j + 1}`, posicion: j + 1 })), estudiantes, con_tiempos: false };
}

describe('clasificación multidimensional (casos 1 y 2)', () => {
  it('propone varias habilidades no excluyentes, con evidencia y confianza cualitativa', () => {
    const a = analizarContenido(P(1, { meta: meta({ tipo: 'encadenada', etapas: 3, unidadesPrevias: [4], dimensional: 'kg·m/s' }) }));
    const cs = a.cognitivas.map((c) => c.valor);
    expect(cs).toEqual(expect.arrayContaining(['resolucion_multietapa', 'transferencia', 'analisis_dimensional', 'aplicacion_directa']));
    expect(a.cognitivas.every((c) => c.procedencia === 'a_priori' && ['alta', 'media', 'baja'].includes(c.confianza) && c.evidencia.length > 5)).toBe(true);
    expect(a.cognitivas.find((c) => c.valor === 'transferencia')!.confianza).toBe('alta');
    expect(a.pasos).toMatchObject({ valor: 3, confianza: 'alta' });
  });
  it('separa complejidad algebraica de exigencia cognitiva', () => {
    const calc = analizarContenido(P(2, { prompt: 'Con m = 2 kg, v = 3 m/s, t = 4 s, F = 5 N y d = 6 m calcule la potencia', meta: meta({ datos: ['a', 'b', 'c', 'd', 'e'] }) }));
    const conc = analizarContenido(P(3, { prompt: '¿Qué pasaría con la energía si se duplica la velocidad? Justifique.', format: 'open', category: 'conceptual', unit_hint: null }));
    expect(calc.complejidadAlgebraica.valor).toBe('alta');
    expect(calc.exigenciaCognitiva.valor).toBe('baja');
    expect(conc.complejidadAlgebraica.valor).toBe('baja');
    expect(conc.exigenciaCognitiva.valor).toBe('alta');
  });
  it('advierte de ambigüedades y la revisión del profesor prevalece', () => {
    const vf = analizarContenido(P(4, { format: 'truefalse', category: 'seleccion', unit_hint: null }));
    expect(vf.advertencias.join(' ')).toMatch(/azar/);
    const r = aplicarRevision(vf, { id: 'q4', cognitivas: ['razonamiento_fisico'], dificultad: 'desafiante' });
    expect(r.revisada).toBe(true);
    expect(r.cognitivas.map((c) => c.valor)).toEqual(['razonamiento_fisico']);
    expect(r.dificultadAPriori.valor).toBe('desafiante');
  });
});

describe('n = 0 y datos insuficientes (casos 8, 12, 13)', () => {
  const ps = [P(1), P(2), P(3)];
  it('sin respuestas: nada empírico, todo rotulado como pendiente', () => {
    const inf = analizar(ps, null);
    expect(inf.examen).toBeNull();
    expect(inf.fichas.some((f) => f.estado === 'analizable' && f.resultado)).toBe(false);
    expect(inf.diagnostico.find((d) => d.clave === 'datos')!.estado).toBe('sin_datos');
    expect(inf.resumen.join(' ')).toMatch(/n = 0/);
  });
  it('con 5 estudiantes se abstiene de estimar dificultad, discriminación y confiabilidad', () => {
    const inf = analizar(ps, sintetico(5, [{ factor: 0, b: 0 }, { factor: 0, b: 0 }, { factor: 0, b: 0 }]));
    const it0 = inf.empirico.get('q1')!;
    expect(it0.p.ok).toBe(false);
    expect(it0.discriminacion.ok).toBe(false);
    expect(inf.examen!.confiabilidad.ok).toBe(false);
    expect(inf.examen!.pares.ok).toBe(false);
    if (!it0.p.ok) expect(it0.p.motivo).toMatch(/mínimo/);
  });
});

describe('verdad conocida (casos 4, 23, 24)', () => {
  const items = [...[0, 0, 0, 0].map((f, k) => ({ factor: f as 0, b: -0.5 + k * 0.3 })), ...[1, 1, 1, 1].map((f, k) => ({ factor: f as 1, b: -0.5 + k * 0.3 }))];
  const ps = items.map((_, j) => P(j + 1));
  const inf = analizar(ps, sintetico(300, items, 7));
  const par = (a: number, b: number) => inf.aristas.find((x) => x.tipo === 'correlacion' && ((x.a === `q${a}` && x.b === `q${b}`) || (x.a === `q${b}` && x.b === `q${a}`)));
  it('detecta asociaciones dentro de cada factor y casi ninguna entre factores (BH al 10 %)', () => {
    let dentro = 0, entre = 0;
    for (let a = 1; a <= 8; a++) for (let b = a + 1; b <= 8; b++) { const mismo = (a <= 4) === (b <= 4); if (par(a, b)) mismo ? dentro++ : entre++; }
    expect(dentro).toBeGreaterThanOrEqual(10);       // de 12 pares verdaderos
    expect(entre).toBeLessThanOrEqual(2);            // de 16 pares nulos
  });
  it('calcula proporciones con IC, discriminación y KR-20 con IC bootstrap reproducible', () => {
    const q1 = inf.empirico.get('q1')!;
    expect(q1.p.ok && q1.p.valor.ic[0] < q1.p.valor.p && q1.p.valor.p < q1.p.valor.ic[1]).toBe(true);
    expect(q1.discriminacion.ok && q1.discriminacion.valor > 0.2).toBe(true);
    const c = inf.examen!.confiabilidad;
    expect(c.ok).toBe(true);
    const otra = analizar(ps, sintetico(300, items, 7)).examen!.confiabilidad;
    expect(otra).toEqual(c);                          // mismo resultado con la misma semilla
  });
  it('escenario negativo: respuestas al azar no producen asociaciones', () => {
    const azar = Array.from({ length: 8 }, () => ({ factor: 'azar' as const, b: 0 }));
    const inf2 = analizar(ps, sintetico(300, azar, 11));
    expect(inf2.aristas.filter((x) => x.tipo === 'correlacion').length).toBeLessThanOrEqual(1);
    expect(inf2.fichas.filter((f) => f.linea === 'abierta').length).toBeLessThanOrEqual(1);
  });
});

describe('descubrimiento (casos 3, 5, 6)', () => {
  it('propone investigaciones no solicitadas y comprueba un prerrequisito con datos', () => {
    const ps = [P(1, { concepts: ['cantidad-movimiento'] }), P(2, { concepts: ['conservacion'], meta: meta({ previos: ['cantidad-movimiento'] }) }), P(3), P(4)];
    const d = sintetico(200, [{ factor: 0, b: -0.8 }, { factor: 0, b: 0, depende: 0 }, { factor: 1, b: 0 }, { factor: 1, b: 0 }], 3);
    const inf = analizar(ps, d);
    const dep = inf.fichas.find((f) => f.linea === 'dependencias')!;
    expect(dep.estado).toBe('analizable');
    expect(dep.resultado).toMatch(/IC 95 %/);
    expect(dep.limitaciones.join(' ')).toMatch(/no demuestra causalidad/);
    expect(new Set(inf.fichas.map((f) => f.linea)).size).toBeGreaterThanOrEqual(5);
    expect(inf.fichas.every((f) => f.hipotesis && f.metodo && f.limitaciones.length)).toBe(true);
  });
  it('agrupa respuestas incorrectas idénticas como posible error sistemático, sin atribuir copia', () => {
    const d = sintetico(40, [{ factor: 0, b: 1.5 }, { factor: 0, b: 0 }], 5);
    for (const e of d.estudiantes) for (const r of e.respuestas) if (r.exercise_id === 'q1' && !r.correcta) r.ficha = 'misma';
    const inf = analizar([P(1), P(2)], d);
    const err = inf.fichas.find((f) => f.linea === 'errores')!;
    expect(err.resultado).toMatch(/son la misma/);
    expect(err.limitaciones.join(' ')).toMatch(/NO indica copia/);
  });
  it('las omisiones concentradas al final se describen sin atribuir intención', () => {
    const items = Array.from({ length: 8 }, () => ({ factor: 0 as const, b: 0 }));
    const inf = analizar(items.map((_, j) => P(j + 1)), sintetico(60, items, 9, (j) => j / 10));
    const om = inf.fichas.find((f) => f.id === 'omi:mecanismos')!;
    expect(om.estado).toBe('analizable');
    expect(om.resultado).toMatch(/final/);
    expect(om.limitaciones.join(' ')).toMatch(/Nunca se puede afirmar/);
  });
  it('la línea de asistencia externa nunca sale como analizable con datos existentes', () => {
    const inf = analizar([P(1), P(2), P(3)], sintetico(100, [{ factor: 0, b: 0 }, { factor: 0, b: 0 }, { factor: 0, b: 0 }], 2));
    const ay = inf.fichas.find((f) => f.linea === 'ayuda_externa')!;
    expect(ay.estado).toBe('requiere_nueva_evaluacion');
    expect(ay.limitaciones.join(' ')).toMatch(/NO pueden demostrar uso de IA/);
  });
});

describe('diseñador (casos 5, 6; pruebas 7–10, 14)', () => {
  const banco: ItemBancoCiencia[] = Array.from({ length: 30 }, (_, i) => {
    const conceptual = i % 3 === 0;
    const p = P(i + 1, {
      concepts: [`c${i % 6}`], difficulty: (['basico', 'intermedio', 'desafiante'] as const)[i % 3], category: conceptual ? 'conceptual' : 'numerica',
      format: conceptual ? 'choice' : 'numeric', opciones: conceptual ? 4 : null, prompt: `Enunciado ${i} sobre tema${i % 6} distinto${i}`,
      meta: meta({ familia: i < 8 ? (['A', 'B', 'C', 'D'] as const)[i % 4] : undefined, tipo: conceptual ? 'conceptual' : 'calculo', etapas: 1 + (i % 3) }),
    });
    return { pregunta: p, analisis: analizarContenido(p), historico: i < 5 ? { p: 0.5, n: 40, discriminacion: 0.1 + i * 0.1 } : null };
  });
  const base = { n: 8, minutos: null, obligatorios: [], conceptos: [], base: ['q1', 'q2', 'q3'], semilla: 42 };
  it('es reproducible con la misma semilla y respeta n, tiempo y conceptos obligatorios', () => {
    const a = disenar(banco, { ...base, modo: 'A' }), b = disenar(banco, { ...base, modo: 'A' });
    expect(a.items).toEqual(b.items);
    expect(a.items.length).toBe(8);
    const t = disenar(banco, { ...base, modo: 'Q', minutos: 15 });
    expect(t.tiempoMin).toBeLessThanOrEqual(15);
    const c = disenar(banco, { ...base, modo: 'Q', conceptos: ['c5'] });
    expect(c.conceptos).toContain('c5');
  });
  it('modo conceptual elige solo preguntas conceptuales; transferencia excluye las del examen base', () => {
    const c = disenar(banco, { ...base, modo: 'C' });
    expect(c.items.every((x) => banco.find((b) => b.pregunta.id === x.id)!.analisis.cognitivas.some((k) => k.valor === 'comprension_conceptual'))).toBe(true);
    const f = disenar(banco, { ...base, modo: 'F' });
    expect(f.items.some((x) => base.base.includes(x.id))).toBe(false);
  });
  it('modo isomorfo reparte pares de la misma familia en versiones A y B y advierte que no están validados', () => {
    const g = disenar(banco, { ...base, modo: 'G' });
    expect(g.items.filter((x) => x.version === 'A').length).toBe(g.items.filter((x) => x.version === 'B').length);
    expect(g.riesgos.join(' ')).toMatch(/supuesta/);
  });
  it('discriminación usa datos observados cuando los hay y lo rotula; el adaptativo se niega sin calibración', () => {
    const e = disenar(banco, { ...base, modo: 'E', n: 4 });
    expect(e.items[0].razon).toMatch(/observada/);
    expect(() => disenar(banco, { ...base, modo: 'M' })).toThrow(/calibrados/);
  });
  it('avisa cuando faltan preguntas en lugar de inventarlas; compara diseños por dimensión', () => {
    const i = disenar(banco, { ...base, modo: 'I', n: 10 });
    expect(i.avisos.join(' ')).toMatch(/haría falta generar o crear más/);
    const cmp = comparar([disenar(banco, { ...base, modo: 'A' }), disenar(banco, { ...base, modo: 'C' })]);
    expect(cmp[0]).toHaveProperty('criterio');
    expect(cmp[0].validacion).toBe(cmp[0].historicas ? 'parcialmente_empirica' : 'a_priori');
    expect(disenar(banco, { ...base, modo: 'E', n: 4 }).validacion).toBe('parcialmente_empirica');   // usa preguntas con historial
  });
});
