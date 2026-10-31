import { describe, expect, it } from 'vitest';
import { estadoActividad, ordenar } from '../src/lib/actividades';

const t0 = new Date('2026-11-02T10:00:00Z').getTime();
const h = (x: number) => new Date(t0 + x * 3600_000).toISOString();
const base = { opens_at: null, closes_at: null, in_progress: null, submitted: false, attempts_used: 0, max_attempts: 1, mode: 'exam' as const };

describe('Estado de una actividad para el estudiante', () => {
  it('disponible, en curso, próxima, entregada, cerrada y sin intentos', () => {
    expect(estadoActividad(base, t0)).toMatchObject({ estado: 'disponible', accion: 'Empezar' });
    expect(estadoActividad({ ...base, mode: 'practice' }, t0).accion).toBe('Practicar');
    expect(estadoActividad({ ...base, in_progress: 'a1' }, t0)).toMatchObject({ estado: 'en_curso', accion: 'Continuar' });
    expect(estadoActividad({ ...base, opens_at: h(5) }, t0)).toMatchObject({ estado: 'proxima', accion: null });
    expect(estadoActividad({ ...base, submitted: true, attempts_used: 1 }, t0)).toMatchObject({ estado: 'entregada', accion: 'Ver' });
    expect(estadoActividad({ ...base, closes_at: h(-1) }, t0)).toMatchObject({ estado: 'cerrada', accion: null });
    expect(estadoActividad({ ...base, attempts_used: 1 }, t0)).toMatchObject({ estado: 'sin_intentos' });
    expect(estadoActividad({ ...base, mode: 'practice', max_attempts: null, attempts_used: 3, submitted: true }, t0).accion).toBe('Practicar otra vez');
  });
  it('urgente si cierra en menos de 48 h', () => {
    expect(estadoActividad({ ...base, closes_at: h(20) }, t0).urgente).toBe(true);
    expect(estadoActividad({ ...base, closes_at: h(72) }, t0).urgente).toBe(false);
  });
  it('orden: en curso, disponibles por cierre, próximas, entregadas, cerradas', () => {
    const xs = [
      { ...base, id: 'cerrada', closes_at: h(-2) },
      { ...base, id: 'entregada', submitted: true, attempts_used: 1 },
      { ...base, id: 'tarde', closes_at: h(50) },
      { ...base, id: 'curso', in_progress: 'x' },
      { ...base, id: 'pronto', closes_at: h(3) },
      { ...base, id: 'proxima', opens_at: h(10) },
    ];
    expect(ordenar(xs, t0).map((x) => x.id)).toEqual(['curso', 'pronto', 'tarde', 'proxima', 'entregada', 'cerrada']);
  });
});
