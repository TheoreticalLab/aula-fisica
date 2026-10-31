import { describe, expect, it } from 'vitest';
import { cumpleFiltros, errorPrincipal, resumenRendimiento, type MetaBanco, type RendimientoEjercicio } from '../src/lib/banco';

const base: MetaBanco = {
  tema: 't', previos: ['u4-friccion-cinetica'], datos: [], solicitado: ['d'], tipo: 'calculo', choque: 'totalmente_inelastico',
  etapas: 3, friccion: true, energia: true, cinematica: true, plano: false, familia: 'A',
};

describe('filtros del banco', () => {
  it('sin filtros pasa todo, incluso sin metadatos', () => {
    expect(cumpleFiltros(undefined, {})).toBe(true);
    expect(cumpleFiltros(base, { tipo: '', friccion: false })).toBe(true);
  });
  it('con filtros, un ejercicio sin metadatos no aparece', () => {
    expect(cumpleFiltros(undefined, { friccion: true })).toBe(false);
  });
  it('cada filtro se aplica', () => {
    expect(cumpleFiltros(base, { tipo: 'calculo', choque: 'totalmente_inelastico', familia: 'A', etapas: '3+', previo: 'u4-friccion-cinetica', friccion: true, energia: true, cinematica: true })).toBe(true);
    expect(cumpleFiltros(base, { plano: true })).toBe(false);
    expect(cumpleFiltros(base, { etapas: '1' })).toBe(false);
    expect(cumpleFiltros(base, { etapas: '2' })).toBe(false);
    expect(cumpleFiltros({ ...base, etapas: 2 }, { etapas: '3+' })).toBe(false);
    expect(cumpleFiltros(base, { previo: 'u2-mrua-velocidad' })).toBe(false);
    expect(cumpleFiltros(base, { familia: 'B' })).toBe(false);
    expect(cumpleFiltros(base, { tipo: 'grafica' })).toBe(false);
  });
});

describe('rendimiento agregado', () => {
  const meta = new Map<string, MetaBanco>([
    ['e1', base],
    ['e2', { ...base, tipo: 'grafica', previos: ['u4-friccion-cinetica', 'u2-mrua-velocidad'] }],
    ['e3', { ...base, tipo: 'dimensional', previos: [] }],
  ]);
  const rend: RendimientoEjercicio[] = [
    { exercise_id: 'e1', respuestas: 10, correctas: 8, primer_intento: 6, intentos_promedio: 1.4, errores: { sign: 1, common_error: 3 } },
    { exercise_id: 'e2', respuestas: 4, correctas: 1, primer_intento: 1, intentos_promedio: 2, errores: {} },
  ];
  it('por tipo: de menor a mayor acierto; sin respuestas al final', () => {
    const r = resumenRendimiento(meta, rend, (m) => m.tipo);
    expect(r.map((x) => x.clave)).toEqual(['grafica', 'calculo', 'dimensional']);
    expect(r[0].tasa).toBeCloseTo(0.25);
    expect(r[2].tasa).toBeNull();
  });
  it('por concepto previo: un ejercicio cuenta en cada uno de sus previos', () => {
    const r = resumenRendimiento(meta, rend, (m) => m.previos);
    const fr = r.find((x) => x.clave === 'u4-friccion-cinetica')!;
    expect(fr).toMatchObject({ ejercicios: 2, respuestas: 14, correctas: 9 });
    expect(r[0].clave).toBe('u2-mrua-velocidad');
  });
  it('error principal', () => {
    expect(errorPrincipal(rend[0])).toBe('common_error');
    expect(errorPrincipal(rend[1])).toBeNull();
    expect(errorPrincipal(undefined)).toBeNull();
  });
});
