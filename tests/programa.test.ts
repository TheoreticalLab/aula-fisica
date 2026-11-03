import { describe, expect, it } from 'vitest';
import { avanceSubtemas, estadoCapitulo, fechasImpartido, hoySantoDomingo, sumarAvances, urlValida } from '../src/lib/programa';

const s = (nivel: 'esencial' | 'complementario' | 'profundizacion', impartido: string[] = [], oculto = false) => ({ nivel, impartido, oculto });

describe('Programa académico · migración 71', () => {
  it('avance: cuenta los subtemas impartidos y aparte los esenciales; los ocultos no cuentan', () => {
    const a = avanceSubtemas([s('esencial', ['2026-11-02']), s('esencial'), s('complementario', ['2026-11-03']), s('profundizacion', [], true)]);
    expect(a).toEqual({ impartidos: 2, total: 3, esencialesImpartidos: 1, esenciales: 2 });
    expect(sumarAvances([a, a])).toEqual({ impartidos: 4, total: 6, esencialesImpartidos: 2, esenciales: 4 });
  });
  it('estado del capítulo: previsto, impartido en parte o impartido, y si el material está disponible (sin mezclar los tres)', () => {
    const sub = (n: number, de: number) => Array.from({ length: de }, (_, i) => ({ id: `${i}`, nombre: '', nivel: 'esencial' as const, descripcion: '', impartido: i < n ? ['2026-11-02'] : [] }));
    expect(estadoCapitulo({ disponible: false, subtemas: sub(0, 3) }).etiqueta).toBe('Previsto');
    expect(estadoCapitulo({ disponible: true, subtemas: sub(0, 3) }).etiqueta).toBe('Previsto · material disponible');
    expect(estadoCapitulo({ disponible: false, subtemas: sub(2, 3) }).etiqueta).toBe('Impartido en parte (2/3)');
    expect(estadoCapitulo({ disponible: true, subtemas: sub(3, 3) })).toEqual({ etiqueta: 'Impartido · material disponible', tono: 'green' });
  });
  it('fechas sin repetir y en orden; URL solo https; hoy en Santo Domingo', () => {
    expect(fechasImpartido(['2026-11-05', '2026-11-02', '2026-11-05']).split(', ')).toHaveLength(2);
    expect(urlValida('https://drive.google.com/x')).toBe(true);
    expect(urlValida('http://inseguro.org')).toBe(false);
    expect(urlValida('javascript:alert(1)')).toBe(false);
    // 2 nov 2026 a las 02:00 UTC es todavía 1 nov en Santo Domingo (UTC−4)
    expect(hoySantoDomingo(new Date('2026-11-02T02:00:00Z'))).toBe('2026-11-01');
  });
});
