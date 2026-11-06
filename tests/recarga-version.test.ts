/** Recuperación tras publicar una versión nueva (src/lib/recargaVersion.ts): recargar una vez, nunca en bucle. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { debeRecargar, VENTANA_MS } from '../src/lib/recargaVersion';

describe('recarga por versión nueva', () => {
  const t = 1_800_000_000_000;
  it('recarga la primera vez', () => { expect(debeRecargar(null, t)).toBe(true); });
  it('no recarga en bucle: dentro de la ventana, no', () => { expect(debeRecargar(t - 5_000, t)).toBe(false); });
  it('pasada la ventana (otra publicación más tarde), vuelve a recargar', () => { expect(debeRecargar(t - VENTANA_MS - 1, t)).toBe(true); });
  it('valores raros (reloj cambiado, basura en el almacenamiento) no bloquean la recuperación', () => {
    expect(debeRecargar(t + 60_000, t)).toBe(true);
    expect(debeRecargar(Number.NaN, t)).toBe(true);
  });
  it('todas las páginas usan la carga con recarga y hay un aviso de error en lugar de la pantalla en blanco', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const main = readFileSync('src/main.tsx', 'utf8');
    expect(app).not.toMatch(/[^a-zA-Z]lazy\(\(\) => import/);
    expect(app.match(/lazyConRecarga\(\(\) => import/g)?.length).toBeGreaterThan(50);
    expect(app).toMatch(/<ErrorCarga>/);
    expect(main).toMatch(/instalarRecargaPorVersion\(\)/);
  });
});
