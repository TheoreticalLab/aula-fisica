import { describe, expect, it } from 'vitest';
import { normalizeDisplayMath } from '@/components/Markdown';
import { pasoBonito } from '@/sims/comun';
import { toCsv } from '@/lib/util';

describe('Markdown', () => {
  it('convierte «$$…$$» en una sola línea a ecuación destacada', () => {
    expect(normalizeDisplayMath('Texto\n\n$$x = x_0 + v t$$\n\nMás')).toBe('Texto\n\n$$\nx = x_0 + v t\n$$\n\nMás');
  });
  it('no toca fórmulas en línea ni bloques ya bien escritos', () => {
    expect(normalizeDisplayMath('a $x$ b')).toBe('a $x$ b');
    expect(normalizeDisplayMath('$$\nx\n$$')).toBe('$$\nx\n$$');
    expect(normalizeDisplayMath('el valor $$x$$ dentro de una frase')).toBe('el valor $$x$$ dentro de una frase');
  });
});

describe('escalas de los simuladores', () => {
  it('pasos 1, 2 o 5 × 10ⁿ', () => {
    expect(pasoBonito(22)).toBe(5);
    expect(pasoBonito(44, 6)).toBe(5);
    expect(pasoBonito(90, 6)).toBe(20);
    expect(pasoBonito(1)).toBeCloseTo(0.2);
    expect(pasoBonito(0)).toBe(1);
  });
});

describe('exportación CSV', () => {
  it('neutraliza fórmulas de hoja de cálculo y respeta los negativos', () => {
    const csv = toCsv([['=HYPERLINK("x")', '-3,5', '@cmd', 'Ana; López']]);
    expect(csv).toBe(`"'=HYPERLINK(""x"")";"-3,5";'@cmd;"Ana; López"`);
  });
});
