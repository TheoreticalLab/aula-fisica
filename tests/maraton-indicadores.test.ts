/** Maratón adaptativo: indicadores descriptivos del informe docente y exportaciones (src/lib/maraton). */
import { describe, expect, it } from 'vitest';
import type { PresentacionHistorial, ResumenDocente } from '@/api/maraton';
import { comportamiento, consistencia, evolucion, rendimiento, trayectoria } from '@/lib/maraton/indicadores';
import { csvDetalle, csvEstadisticas, csvResumen, estadisticasSeccion } from '@/lib/maraton/exportar';

let sec = 0;
function p(nivel: number, accion: PresentacionHistorial['accion'], resultado: PresentacionHistorial['resultado'], extra: Partial<PresentacionHistorial> = {}): PresentacionHistorial {
  sec++;
  const desp = accion === 'respuesta' ? (resultado === 'correcta' ? Math.min(6, nivel + 1) : Math.max(1, nivel - 1)) : accion === 'no_puedo' ? Math.max(1, nivel - 1) : nivel;
  return {
    id: `p${sec}`, secuencia: sec, jornada: 1, variante_id: `v${sec}`, plantilla_id: 'x', tema: 'colisiones', subtema: '', titulo: '', nivel, t_min_s: 300, t_max_s: 1800, peso: 1,
    presentada_at: '2026-12-01T12:00:00Z', cerrada_at: '2026-12-01T12:10:00Z', accion, resultado, respuesta: accion === 'respuesta' ? { partes: [`${sec} m/s`] } : null,
    procedimiento: null, detalle: null, segundos: 400, segundos_cliente: 400, anticipada: false, unidades: 1, nivel_despues: desp, comodines_antes: 0, comodines_despues: 0,
    enunciado: '', partes: [], clave: null, ...extra,
  };
}

describe('indicadores', () => {
  sec = 0;
  const h: PresentacionHistorial[] = [
    p(2, 'respuesta', 'correcta'), p(3, 'respuesta', 'correcta'), p(4, 'respuesta', 'correcta'), p(5, 'respuesta', 'correcta'),
    p(6, 'respuesta', 'correcta'), p(6, 'respuesta', 'correcta'), p(6, 'cambio', null), p(6, 'respuesta', 'incorrecta'),
    p(5, 'no_puedo', null), p(4, 'respuesta', 'incorrecta'), p(3, 'respuesta', 'correcta', { jornada: 2 }), p(4, 'respuesta', 'correcta', { jornada: 2 }),
  ];
  it('rendimiento general y por nivel', () => {
    const r = rendimiento(h);
    expect(r).toMatchObject({ presentados: 12, validos: 10, correctas: 8, incorrectas: 2, noPuedo: 1, cambios: 1 });
    expect(r.porNivel.find((x) => x.nivel === 6)).toMatchObject({ presentados: 4, validos: 3, correctas: 2 });
  });
  it('trayectoria: tipos y movimientos (D6 permanece en D6 al acertar)', () => {
    const t = trayectoria(h);
    expect(t.map((x) => x.tipo).slice(4, 9)).toEqual(['correcta', 'correcta', 'cambio', 'incorrecta', 'no_puedo']);
    expect(t[5]).toMatchObject({ nivel: 6, despues: 6, movimiento: 'igual' });
    expect(t[7].movimiento).toBe('descenso');
  });
  it('comportamiento ante dificultades', () => {
    const c = comportamiento(h);
    expect(c.rachaCorrectas).toBe(6);
    expect(c.maxPermanenciaD6).toBe(4);
    expect(c.entradasAltas).toBe(1);
    expect(c.noPuedoPorNivel.find((x) => x.nivel === 5)).toMatchObject({ n: 1 });
    expect(c.cambiosPorNivel.find((x) => x.nivel === 6)?.n).toBe(1);
    expect(c.cambiosDeDireccion).toBeGreaterThanOrEqual(2);
  });
  it('evolución por jornada', () => {
    const e = evolucion(h);
    expect(e.map((x) => x.jornada)).toEqual([1, 2]);
    expect(e[1]).toMatchObject({ validos: 2, precision: 1 });
  });
  it('consistencia: son observaciones descriptivas con sus referencias, sin puntuaciones', () => {
    sec = 100;
    const xs = [
      p(5, 'respuesta', 'correcta', { segundos: 60 }), p(6, 'respuesta', 'correcta', { segundos: 50 }), p(6, 'respuesta', 'correcta'),
      p(1, 'respuesta', 'incorrecta'), p(2, 'respuesta', 'incorrecta'), p(1, 'respuesta', 'incorrecta'),
      ...[1, 2, 3].map(() => p(3, 'respuesta', 'incorrecta', { respuesta: { partes: ['5 m/s'] } })),
    ];
    const o = consistencia(xs);
    const tipos = o.map((x) => x.tipo);
    expect(tipos).toContain('extremo_vs_elemental');
    expect(tipos).toContain('extremo_rapido');
    expect(tipos).toContain('respuesta_repetida');
    for (const x of o) expect(Object.keys(x).sort()).toEqual(['detalle', 'referencias', 'tipo', 'titulo']);
    expect(JSON.stringify(o)).not.toMatch(/sospech|trampa|probabilidad de|inteligencia artificial/i);
  });
});

describe('exportaciones', () => {
  const d: ResumenDocente = {
    maraton: {} as ResumenDocente['maraton'],
    calendario: [{ numero: 1, fecha: '2026-12-01', abre: '', cierra: '' }, { numero: 2, fecha: '2026-12-02', abre: '', cierra: '' }],
    estudiantes: [
      { user_id: 'a', nombre: 'Estudiante A', login_id: 'A1', matriculado: true, participa: true, nivel_actual: 4, comodines_usados: 2, aceptado_at: null,
        resumen: { jornadas_completadas: 1, jornadas_iniciadas: 2, jornadas_revision: 1, via_cuota: 1, via_alternativa: 0, presentados: 14, intentos_validos: 12, correctas: 9, incorrectas: 3,
          no_puedo: 1, cambios: 1, anticipadas: 0, segundos: 4800, unidades: 14.2, nivel_maximo: 6, nivel_maximo_correcto: 6, extremos_resueltos: 2, por_nivel: [], por_tema: [],
          por_jornada: [
            { numero: 1, fecha: '2026-12-01', estado: 'completada', via: 'cuota', presentados: 10, validos: 9, correctas: 7, incorrectas: 2, no_puedo: 1, cambios: 0, anticipadas: 0, segundos: 3600, nivel_medio: 3.5, nivel_maximo: 6 },
            { numero: 2, fecha: '2026-12-02', estado: 'cerrada_limite', via: null, revision: true, presentados: 4, validos: 3, correctas: 2, incorrectas: 1, no_puedo: 0, cambios: 1, anticipadas: 0, segundos: 1200, nivel_medio: 4, nivel_maximo: 5 },
          ] } },
      { user_id: 'b', nombre: 'Estudiante B', login_id: 'B1', matriculado: true, participa: false, nivel_actual: null, comodines_usados: null, aceptado_at: null, resumen: null },
    ],
  };
  it('CSV resumen: una fila por estudiante, separador «;», coma decimal y sin notas', () => {
    const csv = csvResumen(d);
    const filas = csv.trim().split(/\r?\n/);
    expect(filas).toHaveLength(3);
    expect(filas[1]).toContain('Estudiante A');
    expect(filas[1]).toContain('75');
    expect(csv).not.toMatch(/nota|calificaci/i);
  });
  it('estadísticas por sección agregan por jornada', () => {
    const e = estadisticasSeccion(d);
    expect(e[0]).toMatchObject({ jornada: 1, participantes: 1, completadas: 1, validos: 9, correctas: 7 });
    expect(e[1]).toMatchObject({ revision: 1 });
    expect(csvEstadisticas(d).split(/\r?\n/)[0]).toMatch(/Jornada/);
  });
  it('CSV de detalle con las columnas del historial', () => {
    const csv = csvDetalle([{ login_id: 'A1', nombre: 'Estudiante A', jornada: 1, fecha: '2026-12-01', secuencia: 1, variante_id: 'v', plantilla_id: 'p', tema: 't', nivel: 2,
      presentada_at: 'x', cerrada_at: 'y', accion: 'respuesta', resultado: 'correcta', respuesta: ['3 m/s'], segundos: 200.5, anticipada: false, unidades: 1.2, nivel_despues: 3, comodines_despues: 0 }]);
    expect(csv).toContain('3 m/s');
    expect(csv).toContain('200,5');
  });
});
