/**
 * Pruebas del contenido inicial: estructura, LaTeX, simuladores y coherencia de las claves
 * (cada clave debe calificarse como correcta contra sí misma; los errores comunes, como incorrectos).
 * Si privado/claves no existe (repositorio clonado sin claves), las pruebas de claves se omiten.
 */
import { describe, expect, it } from 'vitest';
import { loadContent, privateKeysPresent } from '../scripts/cargar-contenido';
import { validateContent } from '../scripts/validar-contenido';
import { grade } from '@calif/calificar.ts';
import type { ExerciseCategory } from '../contenido/tipos';

const units = await loadContent();
const withKeys = privateKeysPresent();

describe('contenido inicial', () => {
  it('hay lecciones en los bloques I–III y los IV–VI están anunciados', () => {
    expect(units).toHaveLength(6);
    for (const u of units.slice(0, 3)) expect(u.lessons.length).toBeGreaterThan(0);
    for (const u of units.slice(3)) {
      expect(u.meta.comingSoon).toBe(true);
      expect(u.meta.plannedTopics.length).toBeGreaterThan(0);
    }
  });

  it('pasa la validación estructural (incluido el LaTeX con KaTeX)', () => {
    const problems = validateContent(units, { requireKeys: withKeys });
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('cada bloque con contenido usa las ocho categorías de ejercicios', () => {
    const all: ExerciseCategory[] = ['seleccion', 'vf_justificacion', 'numerica', 'grafica', 'conceptual', 'error', 'desarrollo', 'experimento'];
    for (const u of units.filter((x) => x.lessons.length >= 7)) {
      const cats = new Set(u.lessons.flatMap((l) => l.lesson.exercises.map((e) => e.category)));
      expect([...all].filter((c) => !cats.has(c)), u.meta.title).toEqual([]);
    }
  });

  it('ningún enunciado público contiene una clave', () => {
    for (const u of units) for (const l of u.lessons) for (const e of l.lesson.exercises) {
      const pub = JSON.stringify(e);
      expect(pub).not.toMatch(/"(correct|answer|explanation|hints|rubric|modelJustification)"/);
    }
  });
});

describe.skipIf(!withKeys)('claves de respuesta', () => {
  const cases = units.flatMap((u) => u.lessons.flatMap((l) => l.lesson.exercises.map((e) => ({ e, k: l.keys?.[e.id], file: l.file }))));

  it.each(cases.filter((c) => c.k && c.k.answer.format !== 'open').map((c) => [c.e.id, c] as const))(
    '%s: la respuesta de la clave se califica como correcta',
    (_, { e, k }) => {
      const a = k!.answer;
      const answer =
        a.format === 'choice' ? { selected: a.correct }
        : a.format === 'truefalse' ? { value: a.value, justification: a.modelJustification }
        : a.format === 'numeric' ? { text: a.value }
        : a.format === 'text' ? { text: a.accepted[0] }
        : {};
      const r = grade(a, answer, e.options?.length);
      expect(r.status, JSON.stringify(r)).toBe('correct');
    },
  );

  it.each(
    cases
      .filter((c) => c.k?.answer.format === 'numeric' && (c.k.answer as { commonErrors?: unknown[] }).commonErrors?.length)
      .map((c) => [c.e.id, c] as const),
  )('%s: los errores comunes no se aceptan como correctos', (_, { k }) => {
    const a = k!.answer;
    if (a.format !== 'numeric') return;
    for (const ce of a.commonErrors ?? []) {
      const r = grade(a, { text: ce.value });
      expect(r.status, `${ce.value}: ${JSON.stringify(r)}`).not.toBe('correct');
    }
  });
});
