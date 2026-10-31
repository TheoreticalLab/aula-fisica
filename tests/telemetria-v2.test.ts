import { describe, expect, it } from 'vitest';
import { diferencia, esParticion, interseccion, medida, normalizar, particionar, solapes, union, type Iv } from '../src/lib/telemetria/v2/intervalos';
import { reconstruir } from '../src/lib/telemetria/v2/reconstruir';
import { desdeDiarioExamen, desdeV1 } from '../src/lib/telemetria/v2/adaptadores';
import type { Entrada, EventoNorm, TipoEvento } from '../src/lib/telemetria/v2/modelo';
import { mulberry32 } from '../src/lib/fisica/variantes';

const T0 = 1_800_000_000_000; // hora del servidor al empezar el intento (ms)
const S = 1000, MIN = 60_000;

/** Constructor de una sesión del navegador: eventos con reloj monotónico y recepción sin retraso salvo que se indique. */
function sesion(id: string, inicioServidor: number, pestana = 'p1') {
  const evs: EventoNorm[] = [];
  let seq = 0;
  const api = {
    /** `extra.recibido` es el RETRASO de recepción en ms (0 por defecto). */
    ev(tipo: TipoEvento, tau: number, extra: Partial<EventoNorm> = {}) {
      const retraso = extra.recibido ?? 0;
      evs.push({ sesion: id, seq: ++seq, tipo, fuente: 'cliente', tau, ...extra, recibido: inicioServidor + tau + retraso });
      return api;
    },
    eventos: evs,
  };
  api.ev('sesion_inicio', 0, { datos: { visible: true, pestana } });
  return api;
}
/** Interacciones cada 20 s en [desde, hasta) para que no haya inactividad ni silencios. */
function interactuar(s: ReturnType<typeof sesion>, q: string, desde: number, hasta: number) {
  for (let t = desde; t < hasta; t += 20 * S) s.ev('interaccion', t, { pregunta: q });
}
const entrada = (eventos: EventoNorm[], over: Partial<Entrada> = {}): Entrada => ({
  intento: { inicio: T0, fin: null }, preguntas: ['P1', 'P2'], eventos, modalidad: 'practica', atribucion: 'control', origen: 'v2', ...over,
});
const P = (r: ReturnType<typeof reconstruir>, q: string) => r.preguntas.find((x) => x.pregunta === q)!;

describe('álgebra de intervalos', () => {
  it('operaciones básicas', () => {
    expect(normalizar([{ inicio: 5, fin: 8 }, { inicio: 0, fin: 3 }, { inicio: 3, fin: 4 }, { inicio: 9, fin: 9 }])).toEqual([{ inicio: 0, fin: 4 }, { inicio: 5, fin: 8 }]);
    expect(interseccion([{ inicio: 0, fin: 10 }], [{ inicio: 2, fin: 4 }, { inicio: 8, fin: 12 }])).toEqual([{ inicio: 2, fin: 4 }, { inicio: 8, fin: 10 }]);
    expect(diferencia([{ inicio: 0, fin: 10 }], [{ inicio: 2, fin: 4 }, { inicio: 8, fin: 12 }])).toEqual([{ inicio: 0, fin: 2 }, { inicio: 4, fin: 8 }]);
    expect(solapes([{ inicio: 0, fin: 5 }, { inicio: 3, fin: 8 }, { inicio: 10, fin: 12 }])).toEqual([{ inicio: 3, fin: 5 }]);
  });
  it('propiedades con 500 conjuntos aleatorios', () => {
    const rnd = mulberry32(42);
    const conj = (): Iv[] => Array.from({ length: Math.floor(rnd() * 8) }, () => { const a = Math.floor(rnd() * 1000); return { inicio: a, fin: a + Math.floor(rnd() * 200) }; });
    for (let k = 0; k < 500; k++) {
      const A = conj(), B = conj();
      expect(medida(union(A, B))).toBe(medida(normalizar(A)) + medida(normalizar(B)) - medida(interseccion(A, B)));
      expect(medida(interseccion(diferencia(A, B), B))).toBe(0);
      expect(medida(diferencia(A, B)) + medida(interseccion(A, B))).toBe(medida(normalizar(A)));
      const D = { inicio: 0, fin: 1300 };
      const p = particionar(D, [{ cat: 'a', ivs: A }, { cat: 'b', ivs: B }], 'resto');
      expect(esParticion(p, D)).toEqual([]);
      expect(medida(p.filter((x) => x.cat === 'a'))).toBe(medida(interseccion(A, [D])));
    }
  });
});

describe('casos de validación (fase 17)', () => {
  it('A · pregunta activa 100 s sin interrupciones', () => {
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(s, 'P1', 10 * S, 100 * S);
    s.ev('sesion_fin', 100 * S);
    const r = reconstruir(entrada(s.eventos, { intento: { inicio: T0, fin: T0 + 100 * S } }));
    expect(r.invariantes).toEqual([]);
    expect(P(r, 'P1').T_focus).toMatchObject({ valor: 100 * S, estado: 'reconstruido' });
    expect(r.totales.observable_activo).toBe(100 * S);
    expect(P(r, 'P2').T_focus.valor).toBe(0);
  });

  it('B · trabajo 4 min, pausa 2 min, trabajo 3 min: la pausa no es trabajo y la pregunta no se excluye', () => {
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(s, 'P1', 10 * S, 4 * MIN);
    s.ev('pausa_inicio', 4 * MIN).ev('pausa_fin', 6 * MIN);
    interactuar(s, 'P1', 6 * MIN + 10 * S, 9 * MIN);
    s.ev('sesion_fin', 9 * MIN);
    const r = reconstruir(entrada(s.eventos, { intento: { inicio: T0, fin: T0 + 9 * MIN } }));
    expect(r.invariantes).toEqual([]);
    expect(P(r, 'P1').T_focus.valor).toBe(7 * MIN);
    expect(r.totales.pausa_declarada).toBe(2 * MIN);
    expect(P(r, 'P1').T_wall.valor).toBe(9 * MIN);
    expect(P(r, 'P1').visitas.valor).toBe(1);                 // la pausa no es una visita nueva
  });

  it('C · P1 30 s → P2 2 min → P1 40 s: foco de P1 = 70 s (no 190 s)', () => {
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(s, 'P1', 5 * S, 30 * S);
    s.ev('pregunta_activada', 30 * S, { pregunta: 'P2' });
    interactuar(s, 'P2', 35 * S, 150 * S);
    s.ev('pregunta_activada', 150 * S, { pregunta: 'P1' });
    interactuar(s, 'P1', 155 * S, 190 * S);
    s.ev('sesion_fin', 190 * S);
    const r = reconstruir(entrada(s.eventos, { intento: { inicio: T0, fin: T0 + 190 * S } }));
    expect(P(r, 'P1').T_focus.valor).toBe(70 * S);
    expect(P(r, 'P2').T_focus.valor).toBe(120 * S);
    expect(P(r, 'P1').visitas.valor).toBe(2);
    expect(P(r, 'P1').T_wall.valor).toBe(190 * S);              // T_wall sí es cronológico
  });

  it('D · página oculta 10 min: no es trabajo observable', () => {
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(s, 'P1', 5 * S, MIN);
    s.ev('oculta', MIN).ev('visible', 11 * MIN);
    interactuar(s, 'P1', 11 * MIN + 5 * S, 12 * MIN);
    s.ev('sesion_fin', 12 * MIN);
    const r = reconstruir(entrada(s.eventos, { intento: { inicio: T0, fin: T0 + 12 * MIN } }));
    expect(r.totales.oculta).toBe(10 * MIN);
    expect(P(r, 'P1').T_focus.valor).toBe(2 * MIN);
    expect(r.invariantes).toEqual([]);
  });

  it('E/F/T · fuera de orden, duplicados y retrasos: mismo resultado, determinista', () => {
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(s, 'P1', 5 * S, 2 * MIN);
    s.ev('edicion', 90 * S, { pregunta: 'P1', recibido: 45 * S, datos: { inicio_tau: 80 * S, vacia: false } });   // llegó 45 s tarde
    s.ev('sesion_fin', 2 * MIN);
    const base = reconstruir(entrada(s.eventos));
    const rnd = mulberry32(7);
    const barajado = [...s.eventos].sort(() => rnd() - 0.5);
    const conDuplicados = [...barajado, ...s.eventos.slice(0, 5)];
    const r2 = reconstruir(entrada(conDuplicados));
    expect(JSON.stringify({ ...r2, sesiones: r2.sesiones.map((x) => ({ ...x, duplicados: 0 })) })).toBe(JSON.stringify(base));
    expect(r2.sesiones[0].duplicados).toBe(5);
    expect(base.sesiones[0].muy_retrasados).toBe(1);
    expect(base.eventos.find((e) => e.tipo === 'edicion')!.t).toBe(T0 + 90 * S);   // colocado por su reloj, no al final
    expect(P(base, 'P1').primera_respuesta).toBe(T0 + 80 * S);
    expect(reconstruir(entrada(s.eventos))).toEqual(base);
  });

  it('G · respuesta escrita con guardado fallido: sin confirmación de persistencia', () => {
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' })
      .ev('edicion', 10 * S, { pregunta: 'P1', datos: { inicio_tau: 5 * S, vacia: false } })
      .ev('guardado_fallido', 12 * S, { pregunta: 'P1' }).ev('sesion_fin', 20 * S);
    const q = P(reconstruir(entrada(s.eventos)), 'P1');
    expect(q.calidad.respuesta).toBe('escrito_sin_confirmar');
    expect(q.calidad.sincronizacion.guardados_fallidos).toBe(1);
    expect(q.advertencias.join(' ')).toMatch(/solo en el dispositivo/);
  });

  it('regresión: el cambio V1 se emite al cerrar la ráfaga, DESPUÉS del guardado; la respuesta sí está confirmada', () => {
    // último cambio a los 10 s; guardado confirmado a los 11.2 s; la ráfaga se cierra (evento) a los 12 s
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' })
      .ev('guardado_confirmado', 11_200, { pregunta: 'P1' })
      .ev('edicion', 12 * S, { pregunta: 'P1', datos: { inicio_tau: 5 * S, fin_tau: 10 * S, vacia: false } }).ev('sesion_fin', 20 * S);
    const q = P(reconstruir(entrada(s.eventos)), 'P1');
    expect(q.calidad.respuesta).toBe('confirmada');
    expect(q.T_edit.valor).toBe(5 * S);
  });

  it('H · respuesta confirmada antes de perder la red; la desconexión no es inactividad', () => {
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' })
      .ev('edicion', 10 * S, { pregunta: 'P1', datos: { inicio_tau: 5 * S, vacia: false } })
      .ev('guardado_confirmado', 12 * S, { pregunta: 'P1' })
      .ev('conexion_perdida', 20 * S);
    interactuar(s, 'P1', 25 * S, 80 * S);
    s.ev('conexion_restaurada', 80 * S).ev('sesion_fin', 90 * S);
    const r = reconstruir(entrada(s.eventos));
    expect(P(r, 'P1').calidad.respuesta).toBe('confirmada');
    expect(r.T_disconnected.valor).toBe(60 * S);
    expect(r.totales.inactiva).toBe(0);
    expect(P(r, 'P1').T_focus.valor).toBe(90 * S);            // sin red, el navegador siguió observando
  });

  it('I · dos pestañas a la vez: conflicto, nunca tiempo duplicado', () => {
    const a = sesion('a', T0, 'pA').ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(a, 'P1', 5 * S, 100 * S); a.ev('sesion_fin', 100 * S);
    const b = sesion('b', T0 + 40 * S, 'pB').ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(b, 'P1', 5 * S, 100 * S); b.ev('sesion_fin', 100 * S);
    const r = reconstruir(entrada([...a.eventos, ...b.eventos]));
    expect(r.totales.conflicto).toBe(60 * S);
    expect(r.continuidades[0].tipo).toBe('simultaneas');
    expect(P(r, 'P1').T_focus.valor).toBe(80 * S);            // 40 s solo A + 40 s solo B; los 60 s simultáneos no cuentan
    expect(r.invariantes).toEqual([]);
  });

  it('J · recarga: hueco sin observación y continuidad probable (misma pestaña)', () => {
    const a = sesion('a', T0).ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(a, 'P1', 5 * S, 50 * S); a.ev('sesion_fin', 50 * S);
    const b = sesion('b', T0 + 60 * S).ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(b, 'P1', 5 * S, 40 * S); b.ev('sesion_fin', 40 * S);
    const r = reconstruir(entrada([...a.eventos, ...b.eventos]));
    expect(r.totales.sin_observacion).toBe(10 * S);
    expect(r.continuidades).toEqual([{ de: 'a', a: 'b', hueco_ms: 10 * S, tipo: 'misma_pestana' }]);
    expect(P(r, 'P1').T_focus.valor).toBe(90 * S);
  });

  it('K · una sola pregunta: foco exclusivo', () => {
    const s = sesion('s1', T0); interactuar(s, 'P1', 5 * S, 60 * S); s.ev('sesion_fin', 60 * S);
    const r = reconstruir(entrada(s.eventos, { preguntas: ['P1'], atribucion: 'unica' }));
    expect(P(r, 'P1').T_focus.valor).toBe(60 * S);
  });

  it('L · varias preguntas visibles sin pregunta activa: foco NO identificable (nunca cero)', () => {
    const s = sesion('s1', T0).ev('exposicion_inicio', 1 * S, { pregunta: 'P1' }).ev('exposicion_inicio', 1 * S, { pregunta: 'P2' });
    interactuar(s, 'P1', 5 * S, 60 * S); s.ev('sesion_fin', 60 * S);
    const r = reconstruir(entrada(s.eventos, { atribucion: 'ambigua' }));
    for (const q of ['P1', 'P2']) {
      expect(P(r, q).T_focus).toMatchObject({ valor: null, estado: 'no_identificable' });
      expect(P(r, q).T_candidate_work.valor).toBeNull();
      expect(P(r, q).T_exposure.valor).toBe(59 * S);           // la exposición sí se puede medir (y se superpone)
    }
    expect(P(r, 'P1').T_interaction.valor).toBeGreaterThan(0);  // usar los controles de P1 sí es atribuible
    expect(P(r, 'P2').T_interaction.valor).toBe(0);
  });

  it('M · sin interacción: inactiva desde θ tras la última señal; silencio sin detector = desconocido', () => {
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' })
      .ev('inactividad_inicio', 61 * S, { datos: { desde_tau: 0 } }).ev('inactividad_fin', 5 * MIN).ev('sesion_fin', 5 * MIN);
    const r = reconstruir(entrada(s.eventos));
    expect(r.totales.inactiva).toBe(4 * MIN);
    expect(P(r, 'P1').T_focus.valor).toBe(5 * MIN);              // estuvo activa (foco), pero…
    expect(P(r, 'P1').T_candidate_work.valor).toBe(MIN);         // …no se supone que trabajó durante la inactividad
    const t = sesion('t', T0).ev('pregunta_activada', 0, { pregunta: 'P1' }).ev('interaccion', 10 * MIN, { pregunta: 'P1' }).ev('sesion_fin', 10 * MIN);
    const r2 = reconstruir(entrada(t.eventos));
    expect(r2.totales.desconocido).toBe(10 * MIN - 75 * S);       // ni pensaba ni abandonaba: no se sabe
  });

  it('Q · eventos perdidos: completitud con pérdidas', () => {
    const s = sesion('s1', T0).ev('pregunta_activada', 0, { pregunta: 'P1' });
    interactuar(s, 'P1', 5 * S, 60 * S); s.ev('sesion_fin', 60 * S);
    const sinAlgunos = s.eventos.filter((e) => e.seq !== 3 && e.seq !== 4);
    const r = reconstruir(entrada(sinAlgunos));
    expect(r.sesiones[0].huecos_secuencia).toBe(2);
    expect(P(r, 'P1').calidad.completitud).toBe('con_perdidas');
  });

  it('R · el servidor manda: un tramo de trabajo durante una pausa oficial pasa a desconocido', () => {
    const diario = [
      { inicio: T0, fin: T0 + MIN, tipo: 'trabajo' as const, exercise_id: 'P1' },
      { inicio: T0 + MIN, fin: T0 + 3 * MIN, tipo: 'trabajo' as const, exercise_id: 'P1' },   // el navegador dice «trabajo»
      { inicio: T0 + 3 * MIN, fin: T0 + 4 * MIN, tipo: 'trabajo' as const, exercise_id: 'P1' },
    ];
    const servidor = [
      { t: T0, tipo: 'apertura' as const, exercise_id: 'P1' }, { t: T0 + MIN, tipo: 'pausa' as const },
      { t: T0 + 3 * MIN, tipo: 'reanudacion' as const }, { t: T0 + 4 * MIN, tipo: 'entrega' as const },
    ];
    const { eventos, discrepancias } = desdeDiarioExamen(diario, servidor);
    expect(discrepancias.join()).toMatch(/pausa oficial/);
    const r = reconstruir({ intento: { inicio: T0, fin: T0 + 4 * MIN }, preguntas: ['P1'], eventos, modalidad: 'examen', atribucion: 'servidor', origen: 'diario_examen' });
    expect(r.totales.desconocido).toBe(2 * MIN);
    expect(P(r, 'P1').T_focus.valor).toBe(2 * MIN);
    expect(r.invariantes).toEqual([]);
  });

  it('examen: la aplicación cerrada es tiempo sin observación', () => {
    const diario = [
      { inicio: T0, fin: T0 + MIN, tipo: 'trabajo' as const, exercise_id: 'P1' },
      { inicio: T0 + MIN, fin: T0 + 2 * MIN, tipo: 'desconexion' as const, exercise_id: 'P1' },
      { inicio: T0 + 2 * MIN, fin: T0 + 3 * MIN, tipo: 'trabajo' as const, exercise_id: 'P2' },
    ];
    const servidor = [{ t: T0, tipo: 'apertura' as const, exercise_id: 'P1' }, { t: T0 + 2 * MIN, tipo: 'ir_a' as const, exercise_id: 'P2' }, { t: T0 + 3 * MIN, tipo: 'entrega' as const }];
    const { eventos } = desdeDiarioExamen(diario, servidor);
    const r = reconstruir({ intento: { inicio: T0, fin: T0 + 3 * MIN }, preguntas: ['P1', 'P2'], eventos, modalidad: 'examen', atribucion: 'servidor', origen: 'diario_examen' });
    expect(r.totales.sin_observacion).toBe(MIN);
    expect(P(r, 'P1').T_focus.valor).toBe(MIN);
    expect(P(r, 'P2').T_focus.valor).toBe(MIN);
  });
});

describe('adaptador V1', () => {
  it('traduce los tipos V1 y conserva la referencia al registro', () => {
    const filas = [
      { id: 1, session_id: 's', seq: 1, kind: 'sesion_inicio', exercise_id: null, t_ms: 0, received_at: new Date(T0).toISOString(), data: { navegacion: 'reload', pestana: 'x' } },
      { id: 2, session_id: 's', seq: 2, kind: 'pregunta_vista', exercise_id: 'P1', t_ms: 1000, received_at: new Date(T0 + 1000).toISOString(), data: { visible: true, n: 1 } },
      { id: 3, session_id: 's', seq: 3, kind: 'respuesta_cambio', exercise_id: 'P1', t_ms: 9000, received_at: new Date(T0 + 9000).toISOString(), data: { inicio_ms: 4000, vacia: false, h: 'abcd1234' } },
      { id: 4, session_id: 's', seq: 4, kind: 'inactividad', exercise_id: null, t_ms: 70000, received_at: new Date(T0 + 70000).toISOString(), data: { estado: 'inicio', desde_ms: 9000 } },
    ];
    const e = desdeV1(filas);
    expect(e.map((x) => x.tipo)).toEqual(['sesion_inicio', 'exposicion_inicio', 'edicion', 'inactividad_inicio']);
    expect(e[2]).toMatchObject({ ref: 'telemetry_events:3', datos: { inicio_tau: 4000, vacia: false } });
    const r = reconstruir({ intento: { inicio: T0, fin: null }, preguntas: ['P1'], eventos: e, modalidad: 'practica', atribucion: 'ambigua', origen: 'v1' });
    expect(r.sesiones[0].pestana).toBe('x');
    expect(r.totales.inactiva).toBe(1000);                     // desde 9 s + θ = 69 s hasta el evento a 70 s
    expect(P(r, 'P1').T_exposure.estado).toBe('estimado');
  });
});

describe('invariantes con flujos aleatorios', () => {
  const tipos: TipoEvento[] = ['visible', 'oculta', 'foco_ganado', 'foco_perdido', 'conexion_perdida', 'conexion_restaurada', 'inactividad_inicio', 'inactividad_fin',
    'pregunta_activada', 'interaccion', 'edicion', 'pausa_inicio', 'pausa_fin', 'guardado_confirmado', 'sesion_fin'];
  it('300 intentos sintéticos con varias sesiones, retrasos y duplicados: siempre una partición válida', () => {
    const rnd = mulberry32(2026);
    for (let k = 0; k < 300; k++) {
      const eventos: EventoNorm[] = [];
      const nS = 1 + Math.floor(rnd() * 3);
      for (let s = 0; s < nS; s++) {
        const ini = T0 + Math.floor(rnd() * 10 * MIN);
        const ses = sesion(`s${s}`, ini, rnd() < 0.5 ? 'p1' : 'p2');
        let tau = 0;
        for (let i = 0; i < 40; i++) {
          tau += Math.floor(rnd() * 3 * MIN);
          const tipo = tipos[Math.floor(rnd() * tipos.length)];
          ses.ev(tipo, tau, { pregunta: rnd() < 0.5 ? 'P1' : 'P2', recibido: Math.floor(rnd() * 60 * S), datos: { vacia: rnd() < 0.3, inicio_tau: Math.max(0, tau - 5000), desde_tau: Math.max(0, tau - 70 * S) } });
        }
        eventos.push(...ses.eventos);
        if (rnd() < 0.3) eventos.push(...ses.eventos.slice(0, 3));
      }
      const fin = rnd() < 0.5 ? null : T0 + Math.floor(rnd() * 120 * MIN);
      const r = reconstruir(entrada(eventos, { intento: { inicio: T0, fin }, atribucion: rnd() < 0.5 ? 'control' : 'ambigua' }));
      expect(r.invariantes, `intento ${k}`).toEqual([]);
      for (const q of r.preguntas) {
        for (const x of [q.T_focus, q.T_edit, q.T_interaction, q.T_exposure, q.T_candidate_work]) if (x.valor !== null) expect(x.valor).toBeGreaterThanOrEqual(0);
        if (q.T_focus.valor !== null && q.T_candidate_work.valor !== null) expect(q.T_candidate_work.valor).toBeLessThanOrEqual(q.T_focus.valor);
      }
      expect(reconstruir(entrada(eventos, { intento: { inicio: T0, fin } , atribucion: 'control' }))).toEqual(reconstruir(entrada([...eventos].reverse(), { intento: { inicio: T0, fin }, atribucion: 'control' })));
    }
  });
});
