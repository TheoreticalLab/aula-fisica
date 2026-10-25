import { describe, expect, it } from 'vitest';
import type { MyActivity, MyGrade } from '@/api/tipos';
import { avisosAutomaticos, origenAviso } from '@/lib/avisos';

const ahora = Date.parse('2026-10-25T12:00:00Z');
const h = (horas: number) => new Date(ahora + horas * 3600_000).toISOString();
const act = (p: Partial<MyActivity>): MyActivity => ({
  id: 'x', title: 'T', mode: 'practice', opens_at: null, closes_at: null, class_id: 'c', class_name: 'Sec', course_id: 'k',
  lesson_id: null, max_attempts: null, grades_published: false, items: 1, attempts_used: 0, in_progress: null, submitted: false,
  last_attempt_id: null, best_score: null, max_score: 10, ...p,
});
const nota = (p: Partial<MyGrade>): MyGrade => ({
  activity_id: 'g', title: 'N', mode: 'exam', class_id: 'c', class_name: 'Sec', closes_at: null, best_score: 5, max_score: 10,
  attempts: 1, pending_review: false, last_attempt_id: 'a', ...p,
});

describe('avisos automáticos del panel del estudiante', () => {
  it('avisa solo de actividades sin entregar que cierran en menos de 48 h', () => {
    const r = avisosAutomaticos(
      [
        act({ id: 'pronto', closes_at: h(20) }),
        act({ id: 'lejos', closes_at: h(72) }),
        act({ id: 'entregada', closes_at: h(5), submitted: true }),
        act({ id: 'cerrada', closes_at: h(-1) }),
        act({ id: 'sin-cierre' }),
      ],
      [],
      ahora,
    );
    expect(r.map((a) => a.id)).toEqual(['cierre-pronto']);
    expect(r[0].enlace).toBe('/actividad/pronto');
  });

  it('si hay un intento a medias, el aviso lleva a ese intento', () => {
    const [a] = avisosAutomaticos([act({ id: 'p', closes_at: h(3), in_progress: 'int-1' })], [], ahora);
    expect(a.enlace).toBe('/intento/int-1');
    expect(a.cuerpo).toMatch(/sin entregar/);
  });

  it('anuncia notas publicadas recientes, no las antiguas ni las de actividades sin intentos', () => {
    const r = avisosAutomaticos(
      [],
      [nota({ activity_id: 'nueva', closes_at: h(-48) }), nota({ activity_id: 'vieja', closes_at: h(-24 * 10) })],
      ahora,
    );
    expect(r.map((a) => a.id)).toEqual(['nota-nueva']);
    expect(avisosAutomaticos([], [nota({ attempts: 0 })], ahora)).toEqual([]);
  });

  it('el origen de un aviso no repite el nombre si la sección se llama como el curso', () => {
    expect(origenAviso('Física Básica', 'Física Básica', 'F. Orbe')).toBe('Física Básica · F. Orbe');
    expect(origenAviso('Física General I', 'Física General 1-A', null)).toBe('Física General I · Física General 1-A');
  });
});
