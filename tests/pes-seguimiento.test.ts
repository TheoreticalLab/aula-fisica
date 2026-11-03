import { describe, expect, it } from 'vitest';
import { compararTiempos, factorControl, mediana } from '@/lib/pes';
import { enApartadoS, filtrarMonitor, indicadores, porcentaje, resumenMonitor, type DatosMonitor, type FilaMonitor } from '@/lib/pesMonitor';
import { ejecutarSondas, type ClienteSondas } from '@/lib/pesSondas';
import type { PuntajeServidor } from '@/api/pesTipos';

describe('PES · control presencial (igual que pes_puntaje)', () => {
  const aj = { modo: 'ajuste' as const, peso: 0.2, descripcion: '' };
  it('informativo o sin control realizado: factor 1', () => {
    expect(factorControl({ ...aj, modo: 'informativo' }, [0])).toBe(1);
    expect(factorControl(aj, [])).toBe(1);
  });
  it('ajuste: 1 − w·(1 − C) con el resultado más favorable; w nunca pasa de 0,3', () => {
    expect(factorControl(aj, [0.5])).toBeCloseTo(0.9, 12);
    expect(factorControl(aj, [0.5, 1])).toBe(1);
    expect(factorControl(aj, [0])).toBeCloseTo(0.8, 12);
    expect(factorControl({ ...aj, peso: 0.9 }, [0])).toBeCloseTo(0.7, 12);
  });
});

describe('PES · informe de tiempos (esperado frente a impuesto)', () => {
  it('mediana', () => {
    expect(mediana([])).toBeNull();
    expect(mediana([90, 50, 70])).toBe(70);
    expect(mediana([1, 2, 3, 10])).toBe(2.5);
  });
  it('compara la mediana medida con la espera impuesta y avisa de penalizaciones desproporcionadas', () => {
    const r = compararTiempos([
      { etiqueta: '1A', t_ref_s: 300, t_min_s: 360, calibraciones: [120, 150, 180], piloto_s: null },    // espera 360 frente a 150 medidos: desproporcionada
      { etiqueta: '1B', t_ref_s: 300, t_min_s: 360, calibraciones: [400, 420, 500], piloto_s: 410 },     // lo medido supera la espera: no limita
      { etiqueta: '1C', t_ref_s: 120, t_min_s: 144, calibraciones: [], piloto_s: null },                // sin medir
    ]);
    expect(r.filas[0].esperado).toBe(150);
    expect(r.filas[0].razon).toBeCloseTo(2.4, 10);
    expect(r.filas[2].esperado).toBe(120);
    expect(r.esperadoS).toBe(150 + 420 + 120);
    expect(r.impuestoS).toBe(360 + 360 + 144);
    expect(r.calibrados).toBe(2);
    expect(r.avisos.some((a) => a.nivel === 'aviso' && a.texto.startsWith('1A') && /considere T_ref ≈ 2,5 min/.test(a.texto))).toBe(true);
    expect(r.avisos.some((a) => a.texto.startsWith('1B') && /no limita/.test(a.texto))).toBe(true);
    expect(r.avisos.some((a) => /1 apartado\(s\) sin tiempos medidos/.test(a.texto))).toBe(true);
  });
  it('pocas mediciones: aviso de fiabilidad', () => {
    expect(compararTiempos([{ etiqueta: '2A', t_ref_s: 60, t_min_s: 72, calibraciones: [60], piloto_s: null }]).avisos.some((a) => /solo 1 medición/.test(a.texto))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
const F = (P: number) => ({ S: 0, S_m: 0, P_base: 0, F_tiempo: 0, P });
const PUNTAJE: PuntajeServidor = {
  N: 2, P_max: 8, alfa: 2, puede_responder: true, provisional: F(2), validada: { ...F(1), completa: false }, maxima_alcanzable: F(6),
  control: { modo: 'informativo', peso: 0, C: null, realizados: 0, factor: 1, validada_con_control: 1 }, apartados: 8, cerrados: 4, omitidos: 0, anticipados: 0,
  pendientes_revision: 0, sin_validar: 4,
};
const AHORA = Date.parse('2026-11-10T12:00:00Z');
const fila = (x: Partial<FilaMonitor> = {}): FilaMonitor => ({
  user_id: 'u', nombre: 'Ana Pérez', codigo: '2026-1', estado: 'apartado_abierto', cierre: '2026-11-20T00:00:00Z', aceptado_at: null,
  adaptacion: { tiempo_extra_min: 0, factor_espera: 1, pegado_permitido: false },
  actual: { ejercicio: 2, letra: 'A', revelado_at: '2026-11-10T11:58:00Z', t_min_s: 72 }, cerrados: 4, omitidos: 0, anticipados: 0, validadas: 0,
  pendientes_revision: 0, breves: 0, tiempo_total_s: 900, ejercicios_completos: 1, ultima_actividad: '2026-11-10T11:59:00Z', pegados_bloqueados: 0,
  reconexiones: 0, controles: 0, puntaje: PUNTAJE, ...x,
});

describe('PES · monitor docente: indicadores para revisar (no pruebas)', () => {
  it('sin nada que señalar', () => {
    expect(indicadores(fila(), 8, AHORA)).toEqual([]);
    expect(porcentaje(fila(), 8)).toBe(0.5);
    expect(enApartadoS(fila(), AHORA)).toBe(120);
  });
  it('técnicos: reconexiones frecuentes e inactividad con un apartado abierto', () => {
    const xs = indicadores(fila({ reconexiones: 4, ultima_actividad: '2026-11-10T10:00:00Z' }), 8, AHORA);
    expect(xs.map((x) => x.clave)).toEqual(['reconexiones', 'inactivo']);
    expect(xs.every((x) => x.tipo === 'tecnico')).toBe(true);
    expect(xs[1].texto).toMatch(/hace 2 h/);
  });
  it('de revisión: respuestas breves y pegados bloqueados, siempre como indicadores', () => {
    const xs = indicadores(fila({ breves: 3, cerrados: 5, omitidos: 1, pegados_bloqueados: 3 }), 8, AHORA);
    expect(xs.map((x) => x.clave)).toEqual(['breves', 'pegado']);
    for (const x of xs) expect(x.texto).toMatch(/no prueba/);
    expect(indicadores(fila({ breves: 3, cerrados: 10 }), 20, AHORA)).toEqual([]);      // 3 de 10: no es mayoría
  });
  it('de avance: pendientes de revisión y cierre cercano con poco hecho', () => {
    const xs = indicadores(fila({ pendientes_revision: 2, cerrados: 1, cierre: '2026-11-11T00:00:00Z' }), 8, AHORA);
    expect(xs.map((x) => x.clave)).toEqual(['pendientes', 'cierre']);
    expect(xs[1].texto).toMatch(/Cierra en 12 h con el 13 % hecho/);
    expect(indicadores(fila({ estado: 'completada', cerrados: 1, cierre: '2026-11-11T00:00:00Z', actual: null }), 8, AHORA)).toEqual([]);
  });
  it('filtros por texto, estado y «con indicadores»; resumen', () => {
    const xs = [fila(), fila({ user_id: 'b', nombre: 'Luis Gómez', estado: 'completada', actual: null }), fila({ user_id: 'c', nombre: 'Marta', reconexiones: 5 })];
    expect(filtrarMonitor(xs, { texto: 'gómez' }, 8, AHORA).map((x) => x.user_id)).toEqual(['b']);
    expect(filtrarMonitor(xs, { estado: 'apartado_abierto' }, 8, AHORA)).toHaveLength(2);
    expect(filtrarMonitor(xs, { conIndicadores: true }, 8, AHORA).map((x) => x.user_id)).toEqual(['c']);
    const d = { ahora: '', practica: {} as DatosMonitor['practica'], estudiantes: xs } as DatosMonitor;
    expect(resumenMonitor(d)).toMatchObject({ asignados: 3, enCurso: 2, terminadas: 1, mediaProvisional: 2 });
  });
});

describe('PES · sondas del simulador', () => {
  const ctx = { practica: 'p', apartadoFuturo: 'f', secretos: ['Rúbrica privada: conservación', 'corto'] };
  const rechaza: ClienteSondas = {
    tabla: async () => ({ error: 'permission denied' }),
    rpc: async (fn) => (fn === 'pes_actual' ? { error: null, data: { estado: 'apartado_abierto', apartado: { enunciado: 'Calcule' } } } : { error: 'permission denied' }),
    calificar: async () => ({ error: 'Ese apartado no está abierto' }),
  };
  it('todo rechazado y sin fugas: todas correctas', async () => {
    const r = await ejecutarSondas(rechaza, ctx);
    expect(r.length).toBe(10 + 6 + 4 + 1);
    expect(r.every((x) => x.ok)).toBe(true);
  });
  it('una tabla legible, una función aceptada o una fuga en la vista: se señalan', async () => {
    const malo: ClienteSondas = {
      ...rechaza,
      tabla: async (t) => (t === 'pes_claves' ? { error: null, data: [{ clave: 1 }] } : { error: 'denied' }),
      rpc: async (fn) => (fn === 'pes_actual' ? { error: null, data: { rubrica: 'Rúbrica privada: conservación de la energía' } }
        : fn === 'pes_omitir' ? { error: null, data: {} } : { error: 'denied' }),
    };
    const r = await ejecutarSondas(malo, ctx);
    const fallidas = r.filter((x) => !x.ok).map((x) => x.nombre);
    expect(fallidas).toContain('Leer la tabla pes_claves por REST');
    expect(fallidas).toContain('Omitir un apartado futuro');
    const vista = r.find((x) => x.nombre.startsWith('Vista del apartado'))!;
    expect(vista.ok).toBe(false);
    expect(vista.obtenido).toMatch(/"rubrica".*Rúbrica privada/);
  });
  it('sin apartado futuro no se prueban las escrituras sobre él', async () => {
    expect((await ejecutarSondas(rechaza, { ...ctx, apartadoFuturo: null })).length).toBe(10 + 6 + 1);
  });
});
