import { describe, expect, it } from 'vitest';
import { aActividad, borradorDesde, PLANTILLAS, resumen, revisar, type Borrador } from '../src/lib/plantillas';

const ahora = new Date('2026-11-02T10:00:00');
const conTitulo = (b: Borrador, extra: Partial<Borrador> = {}): Borrador => ({ ...b, titulo: 'Parcial 1', preguntas: [{ exercise_id: 'e1', points: null }], ...extra });

describe('Asistente · plantillas', () => {
  it('toda plantilla produce una actividad que cumple las reglas de la base de datos', () => {
    for (const p of PLANTILLAS) {
      const b = conTitulo(borradorDesde(p.id, ahora));
      expect(revisar(b).errores, p.id).toEqual([]);
      const a = aActividad(b, 'k');
      if (a.mode === 'exam') {
        expect(a.reveal_policy).not.toBe('immediate');
        expect(a.hints_enabled).toBe(false);
      }
      if (a.reveal_policy === 'after_close') expect(a.closes_at).toBeTruthy();
    }
  });
  it('las evaluaciones con motor traen la configuración del examen', () => {
    expect(borradorDesde('parcial', ahora).examen).toMatchObject({ presentacion: 'una_a_la_vez', duracion_s: 3600, pausas: { permitidas: true, max_numero: 1 } });
    expect(borradorDesde('estricto', ahora).examen?.navegacion).toBe('solo_adelante');
    expect(borradorDesde('practica_libre', ahora).examen).toBeNull();
  });
  it('el cierre sugerido es a las 23:59 del día indicado', () => {
    const c = new Date(borradorDesde('tarea', ahora).closes_at!);
    expect([c.getDate(), c.getHours(), c.getMinutes()]).toEqual([9, 23, 59]);
  });
  it('cada borrador es independiente (no comparte la configuración de la plantilla)', () => {
    const a = borradorDesde('parcial', ahora), b = borradorDesde('parcial', ahora);
    a.examen!.pausas.max_numero = 5;
    expect(b.examen!.pausas.max_numero).toBe(1);
  });
});

describe('Asistente · validación', () => {
  const base = conTitulo(borradorDesde('quiz', ahora));
  it('errores que impiden crear', () => {
    expect(revisar({ ...base, titulo: ' ' }).errores).toContain('Escriba un título.');
    expect(revisar({ ...base, opens_at: '2026-11-05T10:00:00Z', closes_at: '2026-11-04T10:00:00Z' }).errores).toContain('El cierre debe ser posterior a la apertura.');
    expect(revisar({ ...base, reveal_policy: 'after_close', closes_at: null }).errores.join()).toMatch(/fecha de cierre/);
    expect(revisar({ ...base, reveal_policy: 'immediate' }).errores.join()).toMatch(/de inmediato/);
    expect(revisar({ ...base, examen: { ...base.examen!, duracion_s: 30 } }).errores.join()).toMatch(/duración/);
    expect(revisar({ ...base, examen: { ...base.examen!, duracion_s: null, pausas: { permitidas: true, max_numero: 1, max_total_s: 60, detienen_reloj: true } } }).errores.join()).toMatch(/requiere una duración/);
  });
  it('sin preguntas: aviso si es borrador, error si se publica', () => {
    expect(revisar({ ...base, preguntas: [] }).errores).toEqual([]);
    expect(revisar({ ...base, preguntas: [] }).avisos.join()).toMatch(/Todavía no tiene preguntas/);
    expect(revisar({ ...base, preguntas: [], publicar: true }).errores.join()).toMatch(/al menos una pregunta/);
  });
  it('aviso si queda menos de un minuto por pregunta', () => {
    const muchas = Array.from({ length: 20 }, (_, i) => ({ exercise_id: `e${i}`, points: null }));
    expect(revisar({ ...base, preguntas: muchas }).avisos.join()).toMatch(/menos de un minuto/);
  });
  it('en una evaluación se fuerzan 1 comprobación, sin pistas y sin solución inmediata', () => {
    const a = aActividad({ ...base, max_tries_per_item: 5, hints_enabled: true, reveal_policy: 'immediate' }, 'k');
    expect(a).toMatchObject({ max_tries_per_item: 1, hints_enabled: false, reveal_policy: 'after_submit' });
  });
  it('el resumen describe la actividad en lenguaje llano', () => {
    const r = resumen(conTitulo(borradorDesde('parcial', ahora))).join(' ');
    expect(r).toMatch(/Evaluación calificable con 1 pregunta/);
    expect(r).toMatch(/60 minutos/);
    expect(r).toMatch(/1 pausa\(s\), 5 min en total \(detienen el reloj\)/);
    expect(r).toMatch(/borrador/);
  });
});
