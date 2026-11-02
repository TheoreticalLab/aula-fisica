import { describe, expect, it } from 'vitest';
import { actividadSemana, avisos, rutaAviso, usd, type ResumenSemanal, type SeccionSemana } from '../src/lib/resumenSemanal';

const sec = (o: Partial<SeccionSemana> = {}): SeccionSemana => ({
  class_id: 'c1', seccion: 'Sección 01', asignatura: 'Física', controles_por_confirmar: 0, controles_sin_cerrar: 0, controles_semana: 0,
  coincidencias_pendientes: 0, coincidencias_semana: 0, fotos_por_revisar: 0, ampliadas_por_revisar: 0, bloqueo_activo: false, bloqueados: 0, ...o,
});
const res = (secciones: SeccionSemana[], banco: ResumenSemanal['banco'] = []): ResumenSemanal => ({
  desde: '2026-10-26T00:00:00Z', hasta: '2026-11-02T00:00:00Z', es_admin: false, secciones, banco,
  ia: { mio_usd: 0.5, mio_llamadas: 3, mio_por_proposito: { clase: 0.5 }, total_usd: null, mes_usd: null, presupuesto_mes: null },
});

describe('Resumen semanal del profesor · migración 68', () => {
  it('una sección sin pendientes no genera avisos', () => {
    expect(avisos(res([sec({ controles_semana: 2, coincidencias_semana: 1 })]))).toEqual([]);
  });
  it('ordena de lo más urgente a lo menos y redacta en singular o plural', () => {
    const a = avisos(res([sec({ controles_por_confirmar: 3, fotos_por_revisar: 1, bloqueados: 2, coincidencias_pendientes: 1, controles_sin_cerrar: 1, ampliadas_por_revisar: 2 })],
      [{ course_id: 'k', asignatura: 'Física', ia: 4, clase: 2 }]));
    expect(a.map((x) => x.clave)).toEqual(['c1-sincerrar', 'c1-confirmar', 'c1-coinc', 'c1-bloq', 'c1-fotos', 'c1-ampl', 'k-banco']);
    expect(a[1].texto).toMatch(/^3 controles pendientes de confirmar/);
    expect(a[2].texto).toMatch(/^1 coincidencia de archivos por decidir/);
    expect(a[3].texto).toMatch(/^2 estudiantes bloqueados/);
    expect(a[6].texto).toBe('6 preguntas generadas con IA sin publicar en el banco (2 desde clases impartidas)');
  });
  it('rutas: controles en Orbe Control; el resto, en la pestaña de la sección o el banco filtrado', () => {
    expect(rutaAviso({ pestana: 'control', class_id: 'c1' })).toBeNull();
    expect(rutaAviso({ pestana: 'coincidencias', class_id: 'c1' })).toBe('/docente/clases/c1?t=coincidencias');
    expect(rutaAviso({ pagina: 'banco', course_id: 'k' })).toBe('/docente/ejercicios?curso=k&estado=borrador');
  });
  it('actividad de la semana y formato de dinero', () => {
    expect(actividadSemana(res([sec({ controles_semana: 2 }), sec({ class_id: 'c2', controles_semana: 1, coincidencias_semana: 4 })]))).toEqual({ controles: 3, coincidencias: 4 });
    expect(usd(0.004)).toBe('US$ 0.0040');
    expect(usd(1.5)).toBe('US$ 1.50');
    expect(usd(null)).toBe('—');
  });
});
