import { describe, expect, it } from 'vitest';
import { seguimientoEstudiante, seguimientoSeccion } from '../src/lib/seguimiento';
import type { Gradebook } from '../src/api/tipos';

const t0 = new Date('2026-11-10T12:00:00Z').getTime();
const d = (dias: number) => new Date(t0 + dias * 86_400_000).toISOString();
const act = (id: string, closes: string | null, extra: Partial<Gradebook['activities'][number]> = {}) =>
  ({ id, title: id.toUpperCase(), mode: 'exam' as const, closes_at: closes, published: true, grades_published: true, group_id: null, max_score: 10, ...extra });
const nota = (best: number | null, submitted = 1, in_progress = false) => ({ best, submitted, in_progress, needs_review: false, last_attempt_id: 'x' });
const est = (id: string, grades: Gradebook['students'][number]['grades'], extra: Partial<Gradebook['students'][number]> = {}) =>
  ({ user_id: id, full_name: `Estudiante ${id}`, login_id: null, email: null, student_code: null, group_id: null, group_name: null, grades, ...extra });

describe('Seguimiento académico', () => {
  const acts = [act('a1', d(-30)), act('a2', d(-20)), act('a3', d(-10)), act('a4', d(-5)), act('a5', d(1)), act('a6', null)];

  it('sin avisos para quien entrega todo con buenas notas', () => {
    const s = seguimientoEstudiante(est('ok', { a1: nota(9), a2: nota(9), a3: nota(8), a4: nota(9), a5: nota(9) }), acts, t0);
    expect(s.alertas).toEqual([]);
    expect(s.promedio).toBeCloseTo(0.88, 2);
  });
  it('no entregó actividades cerradas, y le falta una que cierra pronto', () => {
    const s = seguimientoEstudiante(est('x', { a1: nota(8), a2: nota(8) }), acts, t0);
    expect(s.alertas.map((a) => a.tipo)).toEqual(['no_entrego', 'cierra_pronto']);
    expect(s.alertas[0].texto).toMatch(/No entregó 2 actividad\(es\).*«A3», «A4»/);
  });
  it('promedio bajo (con al menos dos notas) y notas bajando', () => {
    const s = seguimientoEstudiante(est('y', { a1: nota(9), a2: nota(9), a3: nota(4), a4: nota(3), a5: nota(5) }), acts, t0);
    const tipos = s.alertas.map((a) => a.tipo);
    expect(tipos).toContain('bajando');
    const z = seguimientoEstudiante(est('z', { a1: nota(5), a2: nota(6), a3: nota(5), a4: nota(6), a5: nota(5) }), acts, t0);
    expect(z.alertas.map((a) => a.tipo)).toEqual(['promedio_bajo']);
    expect(seguimientoEstudiante(est('w', { a1: nota(3) }), [acts[0]], t0).alertas).toEqual([]);   // una sola nota: sin aviso de promedio
  });
  it('intento abierto al cerrar', () => {
    const s = seguimientoEstudiante(est('v', { a1: nota(9), a2: nota(9), a3: nota(9), a4: nota(null, 0, true), a5: nota(9) }), acts, t0);
    expect(s.alertas.map((a) => a.tipo)).toEqual(['no_entrego', 'en_curso_vencido']);
  });
  it('solo cuenta actividades publicadas y de su grupo', () => {
    const otras = [act('g', d(-3), { group_id: 'otro' }), act('b', d(-3), { published: false })];
    expect(seguimientoEstudiante(est('u', {}, { group_id: 'mio' }), otras, t0).alertas).toEqual([]);
  });
  it('la sección se ordena por urgencia y omite a quien no tiene avisos o está dado de baja', () => {
    const gb: Gradebook = { activities: acts, students: [
      est('bien', { a1: nota(9), a2: nota(9), a3: nota(9), a4: nota(9), a5: nota(9) }),
      est('poco', { a1: nota(9), a2: nota(9), a3: nota(9) }),
      est('mucho', {}),
      est('baja', {}, { active: false }),
    ] };
    expect(seguimientoSeccion(gb, t0).map((s) => s.user_id)).toEqual(['mucho', 'poco']);
  });
});
