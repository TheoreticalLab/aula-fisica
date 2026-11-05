/**
 * Fusión de cuentas (migración 82): lógica de presentación. El motor (traslados, conflictos, bloqueos, huella, reversión,
 * permisos) se prueba en supabase/pruebas/fusion_cuentas.sql y la concurrencia en scripts/pruebas-pg/fusion-concurrencia.ts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { duracion, impactoNotas, NOMBRE_TABLA, sinDecidir } from '@/lib/fusion';
import type { ActividadComparada, Conflicto } from '@/api/fusion';

const act = (id: string, titulo: string): ActividadComparada => ({
  activity_id: id, titulo, modo: 'practice', seccion: 'A', categoria: 'ambas', en_curso: false,
  principal: { intentos: 1, mejor: 75, maximo: 100 }, secundaria: { intentos: 1, mejor: 90, maximo: 100 },
});

describe('fusión · presentación', () => {
  it('conflictos sin decidir (o con una opción que no admite)', () => {
    const cs: Conflicto[] = [
      { clave: 'actividad:1', tipo: 'actividad', titulo: 'P6', principal: {}, secundaria: {}, opciones: ['principal', 'secundaria', 'pendiente'] },
      { clave: 'pes:2', tipo: 'pes', titulo: 'PES', principal: {}, secundaria: {}, opciones: ['principal', 'pendiente'] },
    ];
    expect(sinDecidir(cs, {}).map((c) => c.clave)).toEqual(['actividad:1', 'pes:2']);
    expect(sinDecidir(cs, { 'actividad:1': 'secundaria', 'pes:2': 'secundaria' }).map((c) => c.clave)).toEqual(['pes:2']);
    expect(sinDecidir(cs, { 'actividad:1': 'pendiente', 'pes:2': 'principal' })).toEqual([]);
  });
  it('impacto en notas: solo lo que cambia, con el nombre de la actividad', () => {
    const r = impactoNotas({ a: 75, b: 100 }, { a: 90, b: 100, c: 60 }, [act('a', 'Práctica 6'), act('b', 'Práctica 1'), act('c', 'Práctica 4')]);
    expect(r).toEqual([
      { activity_id: 'c', titulo: 'Práctica 4', antes: null, despues: 60 },
      { activity_id: 'a', titulo: 'Práctica 6', antes: 75, despues: 90 },
    ]);
    expect(impactoNotas({ a: 1 }, undefined, [])).toEqual([]);
  });
  it('duraciones y nombres de tablas', () => {
    expect(duracion(1200)).toBe('20 min');
    expect(duracion(3900)).toBe('1 h 05 min');
    expect(NOMBRE_TABLA.attempts).toBe('Intentos de actividades');
  });
  it('toda tabla trasladable del registro tiene nombre legible', () => {
    const sql = readFileSync('supabase/migrations/20261104000082_fusion_cuentas.sql', 'utf8');
    const tablas = [...sql.matchAll(/^  \('([a-z_0-9]+)', '(intento|respuesta|practica|unico|mover|nota)'/gm)].map((m) => m[1]);
    expect(tablas.length).toBeGreaterThan(40);
    expect(tablas.filter((t) => !NOMBRE_TABLA[t])).toEqual([]);
  });
  it('la interfaz ejecuta con la huella de la vista previa y bloquea en Auth con la acción oficial', () => {
    const ui = readFileSync('src/pages/docente/FusionCuentas.tsx', 'utf8');
    expect(ui).toMatch(/fusionEjecutar\(p\.id, s\.id, vp\.huella/);
    expect(ui).toMatch(/suspenderCuenta\(s\.id, true\)/);
    expect(ui).not.toMatch(/\.from\(['"](attempts|responses|profiles|fusion_)/);
  });
});
