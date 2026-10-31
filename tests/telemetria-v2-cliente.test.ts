/**
 * Ruta V2 completa con reloj simulado: rastreador → cola → «servidor» (recibe con retraso y desfase de reloj) →
 * adaptador → motor. La cronología real es conocida, así que se mide el error de reconstrucción (fase 17.4).
 */
import { describe, expect, it } from 'vitest';
import { ColaV2, PRESUPUESTO, RastreadorV2, recortarPayload, tipoCambio, type EventoV2 } from '../src/lib/telemetria/v2/cliente';
import { desdeV2, type FilaV2 } from '../src/lib/telemetria/v2/adaptadores';
import { reconstruir } from '../src/lib/telemetria/v2/reconstruir';
import { describirRespuesta } from '../src/lib/telemetria/rastreador';

const S = 1000, MIN = 60_000;

/** Simulación: el reloj monotónico del dispositivo empieza en 5 000 ms; el servidor va `desfase` por delante del reloj de pared. */
function simulador(opts: { inicioServidor: number; latencia?: (i: number) => number }) {
  let mono = 5000;
  let n = 0;
  const recibidos: FilaV2[] = [];
  const almacen = new Map<string, string>();
  const cola = new ColaV2({
    almacen: { leer: (k) => almacen.get(k) ?? null, escribir: (k, v) => void almacen.set(k, v) },
    enviar: async (lote: EventoV2[]) => {
      for (const e of lote) {
        // hora de recepción en el servidor = inicio + t_mono + latencia (la red solo retrasa)
        const lat = opts.latencia?.(n++) ?? 40;
        recibidos.push({ id: recibidos.length + 1, event_id: e.event_id, session_id: e.session_id, tab_id: e.tab_id, client_seq: e.client_seq, event_type: e.event_type,
          question_id: e.question_id, t_mono: e.t_mono, received_at: new Date(opts.inicioServidor + e.t_mono + lat).toISOString(), payload: e.payload });
      }
      return 'ok';
    },
    monotonico: () => mono, pared: () => 0, uuid: (() => { let k = 0; return () => `00000000-0000-4000-8000-${String(++k).padStart(12, '0')}`; })(), tab: 'tab-1',
  });
  const r = new RastreadorV2(cola, 'A');
  return {
    cola, r, recibidos,
    avanzar(ms: number) { for (let t = 0; t < ms; t += 1000) { mono += Math.min(1000, ms - t); r.tick(); } },
    sincronizar() { const envio = cola.ahora(); r.sincronizacion(envio, opts.inicioServidor + envio + 20, envio + 40); },
    async vaciar() { while ((await cola.vaciar()).enviados > 0) { /* hasta vaciar */ } },
  };
}

describe('cliente V2', () => {
  it('cronología conocida → reconstrucción con error 0 en las métricas atribuibles', async () => {
    const T0 = 1_800_000_000_000;
    const s = simulador({ inicioServidor: T0, latencia: (i) => (i % 7 === 0 ? 45_000 : 40) });   // algunos eventos llegan 45 s tarde
    s.r.iniciar('navigate', true, true);
    s.sincronizar();
    s.r.activar('P1');
    for (let k = 0; k < 6; k++) { if (k) s.avanzar(1 * S); s.r.cambio('P1', describirRespuesta({ text: '4'.repeat(k + 1) })); }   // una ráfaga de 5 s
    s.avanzar(1 * S);
    s.r.guardadoSolicitado('P1'); s.r.guardadoConfirmado('P1');
    s.avanzar(24 * S);                                                     // t ≈ 30 s
    s.avanzar(10 * S);                                                     // t ≈ 40 s
    s.r.visibilidad(false); s.avanzar(10 * MIN); s.r.visibilidad(true);   // 10 min oculta
    s.r.activar('P2');
    for (let k = 0; k < 4; k++) { s.r.interaccion(); s.avanzar(15 * S); } // 60 s en P2
    s.r.activar('P1');
    for (let k = 0; k < 2; k++) { s.r.interaccion(); s.avanzar(20 * S); } // 40 s en P1
    s.r.salida();
    await s.vaciar();
    const fin = T0 + s.cola.ahora();
    const r = reconstruir({ intento: { inicio: T0, fin }, preguntas: ['P1', 'P2'], eventos: desdeV2(s.recibidos), modalidad: 'practica', atribucion: 'control', origen: 'v2' });
    expect(r.invariantes).toEqual([]);
    expect(r.sesiones[0].ancla_tipo).toBe('sincronizacion');
    expect(r.sesiones[0].muy_retrasados).toBeGreaterThan(0);
    const P1 = r.preguntas.find((q) => q.pregunta === 'P1')!, P2 = r.preguntas.find((q) => q.pregunta === 'P2')!;
    expect(r.totales.oculta).toBe(10 * MIN);
    expect(P1.T_focus.valor).toBe(40 * S + 40 * S);                       // antes de ocultar + al volver; no los 10 min ni los 60 s de P2
    expect(P2.T_focus.valor).toBe(60 * S);
    expect(P1.visitas.valor).toBe(2);
    expect(P1.calidad.respuesta).toBe('confirmada');
    expect(P1.T_edit.valor).toBe(5 * S);                                   // del primer al último cambio de la ráfaga
    expect(P1.ediciones).toBe(1);
    expect(r.continuidades).toEqual([]);
  });

  it('idempotencia y cola persistente: un error de red no pierde eventos; reenviar no duplica', async () => {
    let falla = true;
    const recibidos: EventoV2[] = [];
    const alm = new Map<string, string>();
    const deps = {
      almacen: { leer: (k: string) => alm.get(k) ?? null, escribir: (k: string, v: string) => void alm.set(k, v) },
      enviar: async (l: EventoV2[]) => { if (falla) return 'error' as const; recibidos.push(...l); return 'ok' as const; },
      monotonico: () => 0, pared: () => 0, uuid: (() => { let k = 0; return () => `u${++k}`; })(), tab: null,
    };
    const c = new ColaV2(deps);
    const r = new RastreadorV2(c, 'A');
    r.iniciar('navigate', true, true); r.activar('P1');
    expect((await c.vaciar()).resultado).toBe('error');
    expect(c.numPendientes).toBe(2);
    // recarga: una cola nueva lee los pendientes del dispositivo
    const c2 = new ColaV2(deps);
    expect(c2.numPendientes).toBe(2);
    falla = false;
    await c2.vaciar();
    expect(recibidos.map((e) => e.event_type)).toEqual(['session_started', 'question_activated']);
    expect(new Set(recibidos.map((e) => e.event_id)).size).toBe(2);
  });

  it('presupuestos: ritmo máximo (lo esencial nunca se descarta), payload acotado, cola acotada', () => {
    const c = new ColaV2({ almacen: null, enviar: async () => 'ok', monotonico: () => 0, pared: () => 0, uuid: (() => { let k = 0; return () => `u${++k}`; })(), tab: null });
    const r = new RastreadorV2(c, 'A');
    for (let i = 0; i < 100; i++) r.exposicion(`P${i}`, true);              // no esenciales: se limitan
    r.visibilidad(false);                                                    // esencial: pasa igual
    expect(c.numPendientes).toBe(PRESUPUESTO.eventosPorSegundo + 1);
    expect(c.descartados).toBe(100 - PRESUPUESTO.eventosPorSegundo);
    const p = recortarPayload({ motivo: 'x'.repeat(100), n: 1, h: 'abcd' });
    expect(p).toEqual({ n: 1, h: 'abcd' });
  });

  it('tipo de cambio de la respuesta (sin contenido: huellas y longitudes)', () => {
    const d = (t: string) => describirRespuesta({ text: t });
    const vistas = new Set<string>([d('4 m/s').huella!]);
    expect(tipoCambio(null, d('4 m/s'), new Set())).toBe('introducida');
    expect(tipoCambio(d('4 m/s'), d('4.0 m/s'), vistas)).toBe('modificada');
    expect(tipoCambio(d('4 m/s'), d('la velocidad final del conjunto es 4 m/s'), vistas)).toBe('reemplazada');
    expect(tipoCambio(d('4.0 m/s'), d(''), vistas)).toBe('vaciada');
    expect(tipoCambio(d('4.0 m/s'), d('4 m/s'), vistas)).toBe('restaurada');
  });
});
