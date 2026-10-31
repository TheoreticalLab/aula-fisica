/**
 * Cobertura del banco de la Unidad 9 («Física de los choques») contra la especificación. La biblioteca vive en
 * privado/ (contiene claves) y no está en el repositorio: en GitHub Actions esta prueba se omite; en el equipo del
 * administrador se ejecuta con el contenido real.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cargarBiblioteca, type BibliotecaCargada } from '../scripts/biblioteca/cargar';
import { validarBiblioteca, valorSI } from '../scripts/biblioteca/validar';
import { FAMILIAS, TIPOS_PREGUNTA, type EjercicioBiblioteca } from '../scripts/biblioteca/tipos';

const DIR = join(__dirname, '..', 'privado', 'biblioteca', 'mecanica');
const hay = existsSync(join(DIR, 'u09-choques', 'unidad.ts'));

describe.skipIf(!hay)('banco de la Unidad 9 (biblioteca privada)', async () => {
  const b: BibliotecaCargada = hay ? await cargarBiblioteca(DIR) : ({ unidades: [] } as unknown as BibliotecaCargada);
  const u9 = b.unidades.find((u) => u.meta.slug === 'fisica-choques')!;
  const ej: EjercicioBiblioteca[] = u9 ? u9.minis.flatMap((m) => m.mini.ejercicios) : [];
  const leccion = (slug: string) => u9.minis.find((m) => m.mini.slug === slug)!.mini;
  /** estructuras distintas: una cadena de etapas cuenta una sola vez */
  const estructuras = (nivel: string) => new Set(ej.filter((e) => e.difficulty === nivel).map((e) => e.meta?.problema?.id ?? e.id)).size;

  it('la biblioteca completa es válida (estructura, LaTeX, claves con el motor, comprobación independiente, metadatos, etapas)', () => {
    expect(validarBiblioteca(b)).toEqual([]);
  });
  it('unidad 9 nueva en la posición 9, con 15 lecciones; las antiguas se archivan', () => {
    expect(u9.posicion).toBe(9);
    expect(u9.minis).toHaveLength(15);
    expect(u9.minis.filter((m) => m.mini.integradora)).toHaveLength(1);
    expect(b.curso.archivar).toEqual(['cantidad-movimiento', 'colisiones']);
    expect(b.unidades.some((u) => u.meta.slug === 'cantidad-movimiento' || u.meta.slug === 'colisiones')).toBe(false);
  });
  it('≥ 90 estructuras distintas: ≥ 30 fáciles, ≥ 30 intermedias, ≥ 30 difíciles', () => {
    expect(estructuras('basico')).toBeGreaterThanOrEqual(30);
    expect(estructuras('intermedio')).toBeGreaterThanOrEqual(30);
    expect(estructuras('desafiante')).toBeGreaterThanOrEqual(30);
  });
  it('cada familia A–L tiene al menos 2 ejercicios', () => {
    for (const f of Object.keys(FAMILIAS)) {
      expect(new Set(ej.filter((e) => e.meta?.familia === f).map((e) => e.meta?.problema?.id ?? e.id)).size, `familia ${f}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('los 10 tipos de pregunta aparecen, y no todo es selección múltiple', () => {
    for (const t of Object.keys(TIPOS_PREGUNTA)) expect(ej.some((e) => e.meta?.tipo === t), `tipo ${t}`).toBe(true);
    expect(ej.filter((e) => e.format === 'numeric').length).toBeGreaterThan(ej.length / 2);
  });
  it('≥ 10 intermedios aplican unidades anteriores y ≥ 15 difíciles tienen 3 o más etapas', () => {
    expect(ej.filter((e) => e.difficulty === 'intermedio' && e.meta?.unidadesPrevias?.length).length).toBeGreaterThanOrEqual(10);
    expect(new Set(ej.filter((e) => e.difficulty === 'desafiante' && (e.meta?.etapas ?? 0) >= 3).map((e) => e.meta?.problema?.id ?? e.id)).size).toBeGreaterThanOrEqual(15);
  });
  it('hay problemas por etapas con arrastre (no se penaliza dos veces)', () => {
    const cadenas = new Set(ej.filter((e) => e.meta?.problema).map((e) => e.meta!.problema!.id));
    expect(cadenas.size).toBeGreaterThanOrEqual(2);
    expect(ej.some((e) => e.clave.answer.format === 'numeric' && e.clave.answer.arrastre)).toBe(true);
  });
  it('todo numérico tiene comprobación independiente y validación dimensional', () => {
    for (const e of ej.filter((x) => x.format === 'numeric')) {
      expect(typeof e.verificar, e.id).toBe('function');
      expect(e.meta?.dimensional?.trim(), e.id).toBeTruthy();
    }
  });
  it('caso de referencia (9.9): v = 4 m/s, 12 J en el choque, d = 3.2 m, W = −24 J', () => {
    const claves = leccion('u9c-totalmente-inelasticos').ejercicios.filter((e) => e.clave.answer.format === 'numeric')
      .map((e) => valorSI((e.clave.answer as { value: string }).value));
    const tiene = (v: number) => claves.some((k) => Math.abs(k - v) < 1e-9 * Math.max(1, Math.abs(v)) + 1e-6);
    expect(tiene(3.2) || tiene(-24) || tiene(4)).toBe(true);
    const p = leccion('u9c-totalmente-inelasticos').ejercicios.map((e) => e.prompt).join('\n');
    expect(p).toMatch(/0\.25/);
  });
  it('caso 2 (9.10): e = 0.5 con masas de 1 kg', () => {
    const claves = leccion('u9c-parcialmente-inelasticos').ejercicios.filter((e) => e.clave.answer.format === 'numeric')
      .map((e) => valorSI((e.clave.answer as { value: string }).value));
    expect(claves.some((k) => Math.abs(k - 3) < 1e-6)).toBe(true);
  });
  it('los metadatos nunca contienen la respuesta y los ids son nuevos (no reutilizan los de las unidades archivadas)', () => {
    for (const e of ej) {
      expect(e.id.startsWith('mec-u9c-'), e.id).toBe(true);
      if (e.clave.answer.format === 'numeric') expect(JSON.stringify(e.meta)).not.toContain(e.clave.answer.value);
    }
    for (const m of u9.minis) expect(m.mini.slug.startsWith('u9c-')).toBe(true);
  });
});
