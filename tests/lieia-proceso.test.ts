import { describe, expect, it } from 'vitest';
import { ColaTelemetria, type EventoTelemetria } from '../src/lib/telemetria/cola';
import { describirRespuesta, Rastreador } from '../src/lib/telemetria/rastreador';
import { reconstruir, type EventoCrudo } from '../src/lib/lieia/proceso';
import { analizarProceso } from '../src/lib/lieia/detectoresProceso';
import { experimentoProceso } from '../src/lib/lieia/laboratorioProceso';
import { PARAM_PROCESO, simularProceso } from '../src/lib/lieia/simuladorProceso';

const T0 = 1_800_000_000;
const ev = (s: string, q: number, k: string, t: number, r: number, e: string | null = null, d: Record<string, unknown> = {}): EventoCrudo => ({ s, q, k, e, t, r, d });

describe('LIEIA · reconstrucción temporal del proceso', () => {
  it('alinea sesiones con relojes monotónicos distintos (recarga) y mide la calidad de los datos', () => {
    const eventos = [
      ev('A', 1, 'sesion_inicio', 0, T0 + 0.2, null, { navegacion: 'navigate' }),
      ev('A', 2, 'pregunta_vista', 10_000, T0 + 10.3, 'x', { visible: true }),
      // seq 3 perdido
      ev('A', 4, 'respuesta_cambio', 40_000, T0 + 95, 'x', { len: 3, delta: 3, primera: true, inicio_ms: 38_000, rafaga_ms: 2000 }), // llegó tarde
      ev('B', 1, 'sesion_inicio', 0, T0 + 120.1, null, { navegacion: 'reload' }),
      ev('B', 2, 'pregunta_vista', 5_000, T0 + 125.2, 'y', { visible: true }),
      ev('B', 3, 'respuesta_cambio', 25_000, T0 + 145.1, 'y', { len: 1, delta: 1, primera: true, inicio_ms: 25_000, rafaga_ms: 0 }),
    ];
    const p = reconstruir(eventos, T0, T0 + 200, ['x', 'y']);
    const x = p.items.find((i) => i.exercise_id === 'x')!, y = p.items.find((i) => i.exercise_id === 'y')!;
    expect(x.vista).toBeCloseTo(10.2, 5);       // ancla = mín(recepción − t) = T0 + 0,2
    expect(x.primeraNoVacia).toBeCloseTo(38.2, 5);
    expect(x.latenciaGeneracion).toBeCloseTo(28, 5);
    expect(y.vista).toBeCloseTo(125.1, 5);      // la sesión B se ancla por separado
    expect(p.calidad).toMatchObject({ perdidos: 1, tardios: 1, sesiones: 2, recargas: 1 });
    expect(p.envio).toBe(200);
    expect(y.persistencia).toBeCloseTo(200 - 145.1, 5);
  });

  it('intervalos de oculta, inactiva y sin conexión; tiempo activo y espera final inactiva', () => {
    const eventos = [
      ev('A', 1, 'sesion_inicio', 0, T0),
      ev('A', 2, 'pregunta_vista', 1000, T0 + 1, 'x', { visible: true }),
      ev('A', 3, 'respuesta_cambio', 20_000, T0 + 20, 'x', { len: 2, delta: 2, primera: true, inicio_ms: 19_000, rafaga_ms: 1000 }),
      ev('A', 4, 'borrador_guardado', 21_200, T0 + 21.2, 'x', { ok: true }),
      ev('A', 5, 'visibilidad', 30_000, T0 + 30, null, { visible: false }),
      ev('A', 6, 'visibilidad', 90_000, T0 + 90, null, { visible: true }),
      ev('A', 7, 'inactividad', 160_000, T0 + 160, null, { estado: 'inicio', desde_ms: 100_000 }),
      ev('A', 8, 'inactividad', 200_000, T0 + 200, null, { estado: 'fin', duracion_ms: 100_000 }),
      ev('A', 9, 'envio', 210_000, T0 + 210, null, { fase: 'recibido' }),
    ];
    const p = reconstruir(eventos, T0, null, ['x']);
    expect(p.envio).toBe(210);
    expect(p.oculto).toBeCloseTo(60, 5);
    expect(p.inactivo).toBeCloseTo(100, 5);
    expect(p.activo).toBeCloseTo(210 - 160, 5);
    expect(p.esperaFinal).toBeCloseTo(190, 5);
    expect(p.esperaFinalInactiva).toBeCloseTo(160, 5); // 60 s oculta + 100 s inactiva después de la última edición
    expect(p.items[0].sinGuardar).toBe(false);
  });

  it('integración de extremo a extremo: eventos del cliente real (cola + rastreador) → servidor → reconstrucción', () => {
    let mono = 0;
    const enviados: EventoTelemetria[] = [];
    const cola = new ColaTelemetria({ almacen: null, enviar: async (e) => { enviados.push(...e); return 'ok'; }, monotonico: () => mono, pared: () => 0, uuid: () => 'sesion-1' });
    const r = new Rastreador(cola, 'A');
    r.iniciar('navigate', 'p');
    mono = 5000; r.vista('x', true);
    mono = 12_000; r.interaccion('x'); r.cambio('x', describirRespuesta({ text: '4' }));
    mono = 12_500; r.cambio('x', describirRespuesta({ text: '4.9' }));
    mono = 20_000; r.tick();
    mono = 25_000; r.cambio('x', describirRespuesta({ text: '' }));
    mono = 28_000; r.tick();
    mono = 30_000; r.envio('recibido');
    void cola.vaciar();
    const crudos: EventoCrudo[] = enviados.map((e) => ({ s: e.session_id, q: e.seq, k: e.kind, e: e.exercise_id, t: e.t_ms, r: T0 + e.t_ms / 1000 + 0.1, d: e.data }));
    const p = reconstruir(crudos, T0, null, ['x']);
    const x = p.items[0];
    // un retraso de red CONSTANTE (0,1 s) no se distingue de un inicio de sesión 0,1 s más tarde: todas las horas se
    // desplazan esa latencia (cota de error documentada); las DIFERENCIAS entre eventos son exactas
    expect(x.vista).toBeCloseTo(5.1, 5);
    expect(x.interaccion).toBeCloseTo(12.1, 5);
    expect(x.primeraNoVacia).toBeCloseTo(12.1, 5);
    expect(x.latenciaGeneracion).toBeCloseTo(7, 5);
    expect(x.cambios).toBe(2);
    expect(x.borrados).toBe(1);
    expect(p.envio).toBeCloseTo(30.1, 5);
  });
});

describe('LIEIA · laboratorio del proceso', () => {
  it('el simulador es reproducible y la pérdida de eventos se observa', () => {
    const a = simularProceso({ ...PARAM_PROCESO, estudiantes: 8 }, 3), b = simularProceso({ ...PARAM_PROCESO, estudiantes: 8 }, 3);
    expect(JSON.stringify(a.intentos)).toBe(JSON.stringify(b.intentos));
    const r = experimentoProceso({ ...PARAM_PROCESO, escenario: 'normal', perdida: 0.3 }, 2, 4, 19);
    expect(r.reconstruccion.perdidaObservada).toBeGreaterThan(0.2);
    expect(r.reconstruccion.perdidaObservada).toBeLessThan(0.4);
    expect(r.reconstruccion.errorMedianoS).toBeLessThan(1);
  });

  it('P1 detecta respuestas rápidas con envío diferido y controla los falsos positivos con interrupciones y revisión', () => {
    const pos = experimentoProceso({ ...PARAM_PROCESO, escenario: 'rapida_diferida' }, 4, 5, 49);
    expect(pos.p1.potencia!).toBeGreaterThan(0.8);
    for (const escenario of ['interrupciones', 'revision_prolongada'] as const) {
      const neg = experimentoProceso({ ...PARAM_PROCESO, escenario }, 4, 6, 49);
      expect(neg.p1.fpr).toBeLessThan(0.1);
    }
  });

  it('P2 controla los falsos positivos y señala el ritmo artificialmente regular por encima del azar', () => {
    const neg = experimentoProceso({ ...PARAM_PROCESO, escenario: 'normal' }, 4, 7, 49);
    expect(neg.p2.fpr).toBeLessThan(0.1);
    const pos = experimentoProceso({ ...PARAM_PROCESO, escenario: 'ritmo_regular' }, 4, 8, 49);
    expect(pos.p2.auc!).toBeGreaterThan(0.9);
  });

  it('adversarial: simular revisión durante la espera anula P1 (limitación documentada)', () => {
    const r = experimentoProceso({ ...PARAM_PROCESO, escenario: 'diferida_revision_simulada' }, 3, 9, 49);
    expect(r.p1.potencia!).toBeLessThan(0.3);
  });

  it('análisis con pocos estudiantes: se abstiene', () => {
    const sim = simularProceso({ ...PARAM_PROCESO, estudiantes: 6 }, 10);
    const ids = sim.items.map((x) => x.id);
    const res = analizarProceso(sim.intentos.map((x) => reconstruir(x.eventos, x.inicio, x.entrega, ids)), ids, { bootstrap: 19 });
    expect(res.every((r) => r.p1 === null && r.p2 === null)).toBe(true);
  });
});
