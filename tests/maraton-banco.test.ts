/**
 * Banco preconstruido del Maratón de FG1 (privado/maraton/fg1, excluido de git por contener la lógica de las claves).
 * En GitHub Actions se omite; en el equipo del administrador se construye y valida completo:
 * consistencia dimensional, coherencia física, soluciones verificadas por un método independiente, variantes válidas,
 * tolerancias, corrección automática, ausencia de ambigüedad, LaTeX renderizable y coherencia de la dificultad.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { construirBanco, type BancoConstruido } from '../scripts/maraton/validar';
import { sqlBanco } from '../scripts/maraton/generar-banco';
import type { Banco } from '../scripts/maraton/marco';

const RUTA = join(__dirname, '..', 'privado', 'maraton', 'fg1', 'banco.ts');
const hay = existsSync(RUTA);

function erroresKatex(texto: string): string[] {
  const out: string[] = [];
  texto.split(/(?<!\\)\$/).forEach((t, i) => {
    if (i % 2 === 0) return;
    try { katex.renderToString(t, { throwOnError: true, strict: 'error' }); } catch (e) { out.push(`${(e as Error).message.slice(0, 120)} en «${t.slice(0, 60)}»`); }
  });
  return out;
}

describe.skipIf(!hay)('banco del Maratón de Física General 1', async () => {
  const banco: Banco = hay ? (await import(/* @vite-ignore */ RUTA)).banco : ({ temas: [], plantillas: [] } as unknown as Banco);
  // 12 variantes por plantilla mantienen la prueba rápida; el generador construye y valida 30 con las mismas reglas
  const c: BancoConstruido = hay ? construirBanco(banco, 12, 20261114) : ({ variantes: new Map(), errores: [] } as unknown as BancoConstruido);
  const validadas = banco.plantillas.filter((p) => (p.estado ?? 'validada') === 'validada');
  const todas = [...c.variantes.values()].flat();

  it('todas las variantes superan la validación (verificación independiente, dimensiones, corrección, ambigüedad, datos, LaTeX)', () => {
    expect(c.errores).toEqual([]);
    expect(todas.length).toBe(banco.plantillas.length * 12);
  });
  it('solo temas efectivamente impartidos: verificados con problemas, pendientes sin plantillas validadas, excluidos vacíos', () => {
    const estado = new Map(banco.temas.map((t) => [t.codigo, t.estado]));
    for (const p of banco.plantillas) {
      expect(estado.get(p.tema), p.id).not.toBe('excluido');
      if (estado.get(p.tema) === 'pendiente') expect(p.estado, p.id).toBe('pendiente_revision');
    }
    for (const t of banco.temas.filter((x) => x.estado === 'verificado')) expect(validadas.some((p) => p.tema === t.codigo), t.codigo).toBe(true);
    for (const t of ['movimiento_circular', 'potencia', 'centro_masa', 'rotacion', 'colisiones_2d', 'retroceso_explosiones']) expect(estado.get(t)).toBe('excluido');
  });
  it('los seis niveles tienen variedad suficiente de plantillas y de temas', () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const pls = validadas.filter((p) => p.nivel === n);
      expect(pls.length, `D${n}`).toBeGreaterThanOrEqual(8);
      expect(new Set(pls.map((p) => p.tema)).size, `D${n}`).toBeGreaterThanOrEqual(4);
    }
  });
  it('coherencia de la dificultad: tiempos mínimos crecientes y problemas D5–D6 de varias etapas', () => {
    const media = (n: number) => { const xs = validadas.filter((p) => p.nivel === n).map((p) => p.t_min_s); return xs.reduce((a, b) => a + b, 0) / xs.length; };
    for (const n of [2, 3, 4, 5, 6]) expect(media(n)).toBeGreaterThan(media(n - 1));
    for (const p of validadas.filter((x) => x.nivel >= 5)) {
      const v = c.variantes.get(p.id)![0];
      const etapas = v.partes.length >= 2 || p.etiquetas.some((e) => ['varias_etapas', 'serie_geometrica', 'razonamiento', 'inverso'].includes(e));
      expect(etapas, p.id).toBe(true);
    }
    for (const p of validadas.filter((x) => x.nivel <= 2)) expect(c.variantes.get(p.id)![0].partes.length, p.id).toBeLessThanOrEqual(2);
    // los D6 tienen tope de tiempo razonable (≤ 35 min)
    for (const p of validadas.filter((x) => x.nivel === 6)) expect(p.t_max_s).toBeLessThanOrEqual(2100);
  });
  it('variantes físicamente válidas: masas, tiempos, longitudes y constantes positivas; coeficientes en rango', () => {
    for (const v of todas) {
      for (const [k, x] of Object.entries(v.datos)) {
        if (/^(m\d?|m[A-C]|m1g|k|L\d?|h\d?|H|t\d?|T|dt|ms|d\d?|A|g)$/.test(k)) expect(x, `${v.id} ${k}`).toBeGreaterThan(0);
        if (/^(e|mu)$/.test(k)) { expect(x, `${v.id} ${k}`).toBeGreaterThan(0); expect(x, `${v.id} ${k}`).toBeLessThan(1); }
      }
      for (const k of v.clave.partes) expect(Number.isFinite(parseFloat(k.value)), v.id).toBe(true);
    }
  });
  it('enunciados y soluciones se renderizan con KaTeX sin errores', () => {
    const errs = todas.flatMap((v) => [...erroresKatex(v.enunciado), ...erroresKatex(v.solucion)].map((e) => `${v.id}: ${e}`));
    expect(errs).toEqual([]);
  });
  it('la verificación independiente coincide con la respuesta analítica en TODAS las variantes', () => {
    expect(Math.max(...todas.map((v) => v.verificacion.desviacion_max))).toBeLessThan(0.006);
  });
  it('no hay variantes repetidas y cada una tiene identificador, solución y método', () => {
    expect(new Set(todas.map((v) => v.id)).size).toBe(todas.length);
    expect(new Set(todas.map((v) => `${v.plantilla}|${JSON.stringify(v.datos)}`)).size).toBe(todas.length);
    for (const p of banco.plantillas) expect(p.metodo.length > 10 && p.fuente.length > 10, p.id).toBe(true);
    for (const v of todas) expect(v.solucion.length, v.id).toBeGreaterThan(30);
  });
  it('el SQL generado es idempotente y no contiene nada fuera de las tablas del maratón', () => {
    const sql = sqlBanco(c);
    const sentencias = sql.split('\n').filter((l) => /^insert into/.test(l));
    expect(sentencias.every((l) => /^insert into public\.maraton_(bancos|temas|plantillas|variantes|claves) /.test(l))).toBe(true);
    expect(sql.split('\n').filter((l) => /^insert into public\.maraton_variantes/.test(l)).length).toBe(todas.length);
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate)\b/i);
  });
});
