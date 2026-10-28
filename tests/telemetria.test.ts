import { describe, expect, it } from 'vitest';
import { ColaTelemetria, MAX_PENDIENTES, type Almacen, type EventoTelemetria, type ResultadoEnvio } from '../src/lib/telemetria/cola';
import { CONFIG_RASTREO, describirRespuesta, Rastreador } from '../src/lib/telemetria/rastreador';

/** Entorno simulado: reloj monotónico y de pared controlables, almacenamiento y un servidor que deduplica. */
function entorno() {
  let mono = 1000, pared = 1_800_000_000_000, n = 0;
  const datos = new Map<string, string>();
  const almacen: Almacen = { leer: (k) => datos.get(k) ?? null, escribir: (k, v) => void datos.set(k, v) };
  const servidor = new Map<string, EventoTelemetria>();
  let modo: 'ok' | 'caido' | 'respuesta_perdida' | 'rechazo' = 'ok';
  const keepalives: boolean[] = [];
  const enviar = async (evs: EventoTelemetria[], keepalive: boolean): Promise<ResultadoEnvio> => {
    keepalives.push(keepalive);
    if (modo === 'caido') return 'error';
    if (modo === 'rechazo') return 'rechazo';
    for (const e of evs) if (!servidor.has(`${e.session_id}#${e.seq}`)) servidor.set(`${e.session_id}#${e.seq}`, e); // deduplicación
    return modo === 'respuesta_perdida' ? 'error' : 'ok';
  };
  const nuevaCola = () => new ColaTelemetria({ almacen, enviar, monotonico: () => mono, pared: () => pared, uuid: () => `s${++n}` });
  return {
    almacen, servidor, keepalives, nuevaCola,
    avanzar: (ms: number) => { mono += ms; pared += ms; },
    cambiarHoraPared: (ms: number) => { pared += ms; },
    modo: (m: typeof modo) => { modo = m; },
    reiniciarMonotonico: () => { mono = 50; }, // una página nueva empieza su reloj monotónico de cero
  };
}

describe('Telemetría · cola persistente', () => {
  it('secuencia creciente y tiempo monotónico aunque se cambie la hora del dispositivo', () => {
    const E = entorno(); const c = E.nuevaCola();
    c.registrar('A', 'sesion_inicio'); E.avanzar(500); E.cambiarHoraPared(-3_600_000); c.registrar('A', 'pregunta_vista', 'x');
    const ev = JSON.parse(E.almacen.leer('aula-telemetria-pendientes')!) as EventoTelemetria[];
    expect(ev.map((e) => e.seq)).toEqual([1, 2]);
    expect(ev[1].t_ms - ev[0].t_ms).toBe(500);
    expect(ev[1].wall).toBeLessThan(ev[0].wall); // la hora de pared retrocedió; la monotónica no
  });

  it('conexión intermitente: nada se pierde y nada se duplica (aunque se pierda la respuesta del servidor)', async () => {
    const E = entorno(); const c = E.nuevaCola();
    for (let k = 0; k < 5; k++) c.registrar('A', 'pregunta_vista', `p${k}`);
    E.modo('caido');
    expect((await c.vaciar()).resultado).toBe('error');
    expect(c.numPendientes).toBe(5);
    E.modo('respuesta_perdida'); // el servidor guardó, pero el cliente no recibió la confirmación
    await c.vaciar();
    expect(c.numPendientes).toBe(5);
    E.modo('ok');
    await c.vaciar();
    expect(c.numPendientes).toBe(0);
    expect(E.servidor.size).toBe(5);
  });

  it('recarga de página: los pendientes de la sesión anterior se envían; la nueva sesión empieza su secuencia', async () => {
    const E = entorno(); const c1 = E.nuevaCola();
    E.modo('caido');
    c1.registrar('A', 'respuesta_cambio', 'x', { len: 3 }); c1.registrar('A', 'salida');
    await c1.vaciar();
    E.reiniciarMonotonico();
    const c2 = E.nuevaCola(); // la página se recargó
    expect(c2.numPendientes).toBe(2);
    c2.registrar('A', 'sesion_inicio', null, { navegacion: 'reload' });
    E.modo('ok');
    await c2.vaciar();
    expect(E.servidor.size).toBe(3);
    const sesiones = new Set([...E.servidor.values()].map((e) => e.session_id));
    expect(sesiones.size).toBe(2);
    expect([...E.servidor.values()].find((e) => e.kind === 'sesion_inicio')!.seq).toBe(1);
  });

  it('sesión prolongada: miles de eventos se entregan por lotes; sin red, el almacenamiento tiene tope', async () => {
    const E = entorno(); const c = E.nuevaCola();
    for (let k = 0; k < 6000; k++) { c.registrar('A', 'pregunta_vista', 'x', { n: k }); E.avanzar(1000); if (k % 50 === 0) await c.vaciar(); }
    while (c.numPendientes) await c.vaciar();
    expect(E.servidor.size).toBe(6000);
    E.modo('caido');
    for (let k = 0; k < MAX_PENDIENTES + 500; k++) c.registrar('A', 'pregunta_vista', 'x');
    c.persistir();
    expect(JSON.parse(E.almacen.leer('aula-telemetria-pendientes')!).length).toBe(MAX_PENDIENTES);
  });

  it('almacenamiento bloqueado: funciona en memoria; lo rechazado por el servidor no se reintenta sin fin', async () => {
    const E = entorno();
    const c = new ColaTelemetria({ almacen: { leer: () => { throw new Error('bloqueado'); }, escribir: () => { throw new Error('lleno'); } },
      enviar: async () => 'rechazo', monotonico: () => 0, pared: () => 0, uuid: () => 'z' });
    c.registrar('A', 'salida');
    expect(c.numPendientes).toBe(1);
    await c.vaciar();
    expect(c.numPendientes).toBe(0);
    expect(E.servidor.size).toBe(0);
  });
});

describe('Telemetría · semántica de los eventos', () => {
  const preparar = () => { const E = entorno(); const c = E.nuevaCola(); const r = new Rastreador(c, 'A'); return { E, c, r, eventos: () => JSON.parse(E.almacen.leer('aula-telemetria-pendientes') ?? '[]') as EventoTelemetria[] }; };

  it('vista sin duplicados, primera interacción una sola vez', () => {
    const { r, eventos } = preparar();
    r.vista('x', true); r.vista('x', true); r.vista('x', false); r.vista('x', true);
    r.interaccion('x'); r.interaccion('x');
    const ev = eventos();
    expect(ev.filter((e) => e.kind === 'pregunta_vista').map((e) => e.data.visible)).toEqual([true, false, true]);
    expect(ev.filter((e) => e.kind === 'primera_interaccion')).toHaveLength(1);
  });

  it('ráfagas de edición: varias pulsaciones seguidas = un evento con su duración; primera entrada no vacía y borrado', () => {
    const { E, r, eventos } = preparar();
    r.cambio('x', describirRespuesta({ text: '1' })); E.avanzar(300);
    r.cambio('x', describirRespuesta({ text: '12' })); E.avanzar(300);
    r.cambio('x', describirRespuesta({ text: '12 m' })); E.avanzar(CONFIG_RASTREO.rafagaMs + 100); r.tick();
    r.cambio('x', describirRespuesta({ text: '' })); E.avanzar(CONFIG_RASTREO.rafagaMs + 100); r.tick();
    const c = eventos().filter((e) => e.kind === 'respuesta_cambio');
    expect(c).toHaveLength(2);
    expect(c[0].data).toMatchObject({ primera: true, rafaga_ms: 600, n: 3, len: 4, vacia: false });
    expect(c[1].data).toMatchObject({ borrado: true, vacia: true, primera: false });
  });

  it('volver a la misma respuesta no cuenta como cambio; una respuesta pegada se ve como ráfaga instantánea', () => {
    const { E, r, eventos } = preparar();
    r.conocer('x', describirRespuesta({ selected: [1] }));
    r.cambio('x', describirRespuesta({ selected: [2] })); E.avanzar(200); r.cambio('x', describirRespuesta({ selected: [1] }));
    E.avanzar(CONFIG_RASTREO.rafagaMs + 100); r.tick();
    expect(eventos().filter((e) => e.kind === 'respuesta_cambio')).toHaveLength(0);
    r.cambio('y', describirRespuesta({ text: 'Un texto largo pegado de una vez desde otra fuente' }));
    E.avanzar(CONFIG_RASTREO.rafagaMs + 100); r.tick();
    const p = eventos().find((e) => e.kind === 'respuesta_cambio')!;
    expect(p.data.rafaga_ms).toBe(0);
    expect(p.data.delta).toBeGreaterThan(40);
  });

  it('inactividad, ocultar la página y envío cierran las ráfagas pendientes', () => {
    const { E, r, eventos } = preparar();
    r.cambio('x', describirRespuesta({ text: 'a' }));
    r.visibilidad(false);
    expect(eventos().filter((e) => e.kind === 'respuesta_cambio')).toHaveLength(1);
    r.visibilidad(true);
    E.avanzar(CONFIG_RASTREO.inactividadMs + 1000); r.tick();
    E.avanzar(5000); r.actividad();
    const ina = eventos().filter((e) => e.kind === 'inactividad');
    expect(ina.map((e) => e.data.estado)).toEqual(['inicio', 'fin']);
    expect(ina[1].data.duracion_ms).toBe(CONFIG_RASTREO.inactividadMs + 6000);
    r.cambio('y', describirRespuesta({ selected: [0] }));
    r.envio('solicitado');
    const ev = eventos();
    expect(ev.findIndex((e) => e.kind === 'respuesta_cambio' && e.exercise_id === 'y')).toBeLessThan(ev.findIndex((e) => e.kind === 'envio'));
  });

  it('navegación móvil: al ocultar o cerrar la pestaña se registra y se envía con keepalive', async () => {
    const { E, c, r, eventos } = preparar();
    r.salida();
    await c.vaciar(true);
    expect(eventos().length).toBe(0);
    expect(E.keepalives.at(-1)).toBe(true);
    expect([...E.servidor.values()].some((e) => e.kind === 'salida')).toBe(true);
  });

  it('huella: igual para la misma respuesta escrita distinto, independiente del orden de las opciones', () => {
    expect(describirRespuesta({ text: ' 2.5 M/s' }).huella).toBe(describirRespuesta({ text: '2.5m/s' }).huella);
    expect(describirRespuesta({ selected: [2, 0] }).huella).toBe(describirRespuesta({ selected: [0, 2] }).huella);
    expect(describirRespuesta({ text: '   ' }).vacia).toBe(true);
    expect(describirRespuesta({}).huella).toBeNull();
  });
});
