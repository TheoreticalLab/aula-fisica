/**
 * LIEIA · Simulador del PROCESO de respuesta (eventos de telemetría con verdad conocida, mismo formato que el
 * servidor). Modela: vista de cada pregunta, latencia de generación lognormal (exigencia del ítem − velocidad del
 * estudiante), primera interacción, escritura en ráfagas (duración ∝ longitud) o selección, correcciones,
 * interrupciones (página oculta, inactividad), revisión final, envío; y la RED: pérdida y retraso de eventos y
 * recargas de página (sesiones nuevas con su propio reloj monotónico).
 */
import { crearAzar, type Azar } from './azar';
import type { EventoCrudo } from './proceso';

export type EscenarioProceso =
  | 'normal' | 'revision_prolongada' | 'rapida_inmediata' | 'ediciones' | 'interrupciones' | 'conexion_deficiente'
  | 'rapida_diferida' | 'pegado_ia' | 'ritmo_regular'
  | 'diferida_revision_simulada' | 'ia_tecleo_lento' | 'ritmo_aleatorizado';

export const ESCENARIOS_PROCESO: Record<EscenarioProceso, { titulo: string; tipo: 'negativo' | 'positivo' | 'adversarial'; descripcion: string }> = {
  normal: { titulo: 'Resolución normal', tipo: 'negativo', descripcion: 'Leen, piensan, responden y entregan.' },
  revision_prolongada: { titulo: 'Revisión prolongada', tipo: 'negativo', descripcion: 'Terminan y repasan muchos minutos (vuelven a ver preguntas y corrigen alguna).' },
  rapida_inmediata: { titulo: 'Rápidos que entregan enseguida', tipo: 'negativo', descripcion: 'Estudiantes rápidos y hábiles: responden deprisa y entregan al terminar.' },
  ediciones: { titulo: 'Muchas correcciones', tipo: 'negativo', descripcion: 'Cambian varias veces sus respuestas.' },
  interrupciones: { titulo: 'Interrupciones', tipo: 'negativo', descripcion: 'Cambian de aplicación o se quedan quietos un rato varias veces.' },
  conexion_deficiente: { titulo: 'Conexión deficiente', tipo: 'negativo', descripcion: 'Se pierde el 30 % de los eventos, llegan con retraso y recargan la página.' },
  rapida_diferida: { titulo: 'Respuestas rápidas con envío diferido', tipo: 'positivo', descripcion: 'Tienen las respuestas: las escriben enseguida y esperan, sin actividad, para entregar a una hora «normal».' },
  pegado_ia: { titulo: 'Respuestas pegadas (asistencia externa)', tipo: 'positivo', descripcion: 'Las respuestas abiertas aparecen de golpe (pegadas) y tardan lo mismo en todas.' },
  ritmo_regular: { titulo: 'Ritmo artificialmente regular', tipo: 'positivo', descripcion: 'Responden a intervalos casi constantes, sin relación con la dificultad.' },
  diferida_revision_simulada: { titulo: 'Envío diferido con revisión simulada (adversarial)', tipo: 'adversarial', descripcion: 'Como «envío diferido», pero mueven la página y miran preguntas durante la espera.' },
  ia_tecleo_lento: { titulo: 'Asistencia tecleada a mano (adversarial)', tipo: 'adversarial', descripcion: 'Copian la respuesta externa tecleándola despacio: no hay «pegado».' },
  ritmo_aleatorizado: { titulo: 'Ritmo regular con ruido (adversarial)', tipo: 'adversarial', descripcion: 'Añaden variación aleatoria a los intervalos para parecer naturales.' },
};

export interface ParamProceso { escenario: EscenarioProceso; estudiantes: number; items: number; implicados: number; fraccionAbiertas: number; perdida: number }
export const PARAM_PROCESO: ParamProceso = { escenario: 'normal', estudiantes: 30, items: 16, implicados: 4, fraccionAbiertas: 0.4, perdida: 0 };

export interface SimProceso {
  intentos: { inicio: number; entrega: number; eventos: EventoCrudo[]; verdad: { vistas: Map<string, number> } }[];
  items: { id: string; abierta: boolean; beta: number }[];
  positivos: Set<number>;
}

interface EvVerdadero { t: number; k: string; e: string | null; d: Record<string, unknown> }

export function simularProceso(p: ParamProceso, semilla: number): SimProceso {
  const az = crearAzar(semilla);
  const items = Array.from({ length: p.items }, (_, j) => {
    const abierta = az.u() < p.fraccionAbiertas;
    return { id: `item-${j}`, abierta, beta: Math.log(abierta ? 75 : 40) + az.normal(0, 0.45) };
  });
  const positivos = new Set<number>();
  const orden = az.barajar([...Array(p.estudiantes).keys()]);
  const tipo = ESCENARIOS_PROCESO[p.escenario].tipo;
  if (tipo !== 'negativo') for (let k = 0; k < p.implicados; k++) positivos.add(orden[k]);
  const T0 = 1_800_000_000; // segundos (servidor)
  const intentos = Array.from({ length: p.estudiantes }, (_, i) => {
    const imp = positivos.has(i) || (p.escenario === 'rapida_inmediata' && i % 4 === 0) || ['revision_prolongada', 'ediciones', 'interrupciones'].includes(p.escenario) && i % 3 === 0;
    const tau = az.normal(0, 0.3) + (p.escenario === 'rapida_inmediata' && imp ? 0.9 : 0);
    const evs = generarVerdaderos(az, items, tau, p.escenario, imp && tipo !== 'negativo' ? p.escenario : imp ? p.escenario : 'normal');
    const entrega = evs.find((e) => e.k === 'envio' && e.d.fase === 'recibido')!.t;
    const perdida = p.escenario === 'conexion_deficiente' ? Math.max(0.3, p.perdida) : p.perdida;
    return { inicio: T0, entrega: T0 + entrega, eventos: transmitir(az, evs, T0, perdida, p.escenario === 'conexion_deficiente'), verdad: { vistas: primerasVistas(evs) } };
  });
  return { intentos, items, positivos };
}

function primerasVistas(evs: EvVerdadero[]) {
  const m = new Map<string, number>();
  for (const e of evs) if (e.k === 'pregunta_vista' && e.d.visible === true && e.e && !m.has(e.e)) m.set(e.e, e.t);
  return m;
}

function generarVerdaderos(az: Azar, items: SimProceso['items'], tau: number, escenarioGlobal: EscenarioProceso, modo: EscenarioProceso): EvVerdadero[] {
  const evs: EvVerdadero[] = [];
  let t = az.u() * 30;
  const add = (k: string, e: string | null, d: Record<string, unknown> = {}) => evs.push({ t, k, e, d });
  add('sesion_inicio', null, { navegacion: 'navigate' });
  const regular = modo === 'ritmo_regular' || modo === 'ritmo_aleatorizado';
  const sabe = modo === 'rapida_diferida' || modo === 'diferida_revision_simulada';
  const asistido = modo === 'pegado_ia' || modo === 'ia_tecleo_lento';
  for (const it of items) {
    add('pregunta_vista', it.id, { visible: true, n: 1 });
    // latencia de generación (pensar hasta empezar a escribir/elegir)
    let lat: number;
    if (sabe) lat = Math.exp(Math.log(8) + az.normal(0, 0.3));
    else if (asistido) lat = Math.exp(Math.log(35) + az.normal(0, 0.15));
    else if (modo === 'ritmo_regular') lat = 55 + az.normal(0, 1.5);
    else if (modo === 'ritmo_aleatorizado') lat = 55 * Math.exp(az.normal(0, 0.35));
    else lat = Math.exp(it.beta - tau + az.normal(0, 0.45));
    t += Math.max(1, lat * 0.3);
    add('primera_interaccion', it.id);
    t += Math.max(1, lat * 0.7);
    const len = it.abierta ? 20 + az.entero(80) : 1;
    const tecleo = it.abierta ? (modo === 'pegado_ia' ? 0 : modo === 'ia_tecleo_lento' ? len * 0.6 : len * (0.18 + az.u() * 0.15)) : 0;
    const inicio = t;
    t += tecleo;
    add('respuesta_cambio', it.id, { len, delta: len, vacia: false, primera: true, inicio_rel: inicio, rafaga_ms: Math.round(tecleo * 1000), n: it.abierta ? Math.max(1, Math.round(len / 4)) : 1 });
    t += 1.2; add('borrador_guardado', it.id, { ok: true });
    // correcciones
    const pCorr = escenarioGlobal === 'ediciones' && modo === 'ediciones' ? 0.6 : 0.12;
    if (!regular && !sabe && az.u() < pCorr) {
      t += 5 + az.u() * 40;
      const nuevo = len + az.entero(10) - 3;
      add('respuesta_cambio', it.id, { len: Math.max(1, nuevo), delta: nuevo - len, vacia: false, primera: false, inicio_rel: t - 2, rafaga_ms: 2000, n: 3 });
      t += 1.2; add('borrador_guardado', it.id, { ok: true });
    }
    // interrupciones
    if (modo === 'interrupciones' && az.u() < 0.35) {
      add('visibilidad', null, { visible: false }); t += 20 + az.u() * 160; add('visibilidad', null, { visible: true });
    } else if (az.u() < 0.05) {
      add('visibilidad', null, { visible: false }); t += 10 + az.u() * 40; add('visibilidad', null, { visible: true });
    }
    add('pregunta_vista', it.id, { visible: false, n: 1 });
    t += 2 + az.u() * 4;
  }
  // final: revisión, espera deliberada o envío inmediato
  const normalTotal = items.reduce((s, it) => s + Math.exp(it.beta - tau) + 8, 0);
  if (sabe) {
    const espera = Math.max(60, normalTotal - t + az.normal(0, 60));
    if (modo === 'diferida_revision_simulada') {
      const fin = t + espera;
      while (t < fin - 40) { t += 20 + az.u() * 40; const it = az.elegir(items); add('pregunta_vista', it.id, { visible: true, n: 2 }); t += 5 + az.u() * 10; add('pregunta_vista', it.id, { visible: false, n: 2 }); }
      t = fin;
    } else {
      add('inactividad', null, { estado: 'inicio', desde_rel: t + 2 });
      if (az.u() < 0.5) { add('visibilidad', null, { visible: false }); t += espera; add('visibilidad', null, { visible: true }); }
      else t += espera;
      add('inactividad', null, { estado: 'fin', duracion_ms: Math.round(espera * 1000) });
    }
  } else if (modo === 'revision_prolongada') {
    const fin = t + 300 + az.u() * 600;
    while (t < fin) {
      t += 15 + az.u() * 60; const it = az.elegir(items); add('pregunta_vista', it.id, { visible: true, n: 2 });
      if (az.u() < 0.15) { t += 4; add('respuesta_cambio', it.id, { len: 5, delta: 1, vacia: false, primera: false, inicio_rel: t - 1, rafaga_ms: 1000, n: 2 }); t += 1.2; add('borrador_guardado', it.id, { ok: true }); }
      t += 5 + az.u() * 20; add('pregunta_vista', it.id, { visible: false, n: 2 });
    }
  } else if (modo !== 'rapida_inmediata') {
    t += 10 + az.u() * 60;
  }
  add('envio', null, { fase: 'solicitado' }); t += 1.5; add('envio', null, { fase: 'recibido' });
  return evs;
}

/** Convierte la verdad en lo que recibe el servidor: sesiones (recargas), reloj monotónico, pérdidas y retrasos. */
function transmitir(az: Azar, evs: EvVerdadero[], T0: number, perdida: number, recargas: boolean): EventoCrudo[] {
  const out: EventoCrudo[] = [];
  let sesion = `s-${az.entero(1e9)}`, inicioSesion = evs[0].t, seq = 0;
  const desfaseCliente = az.normal(0, 90); // reloj de pared del cliente mal puesto
  evs.forEach((e, k) => {
    if (recargas && k > 0 && az.u() < 0.03 && e.k === 'pregunta_vista') {
      sesion = `s-${az.entero(1e9)}`; inicioSesion = e.t; seq = 0;
      out.push({ s: sesion, q: ++seq, k: 'sesion_inicio', e: null, t: 0, r: T0 + e.t + 0.3, w: T0 + e.t + desfaseCliente, d: { navegacion: 'reload' } });
    }
    seq++;
    if (az.u() < perdida && e.k !== 'envio') return; // evento perdido (el envío lo confirma también el servidor)
    const d: Record<string, unknown> = { ...e.d };
    if (typeof d.inicio_rel === 'number') { d.inicio_ms = Math.round(((d.inicio_rel as number) - inicioSesion) * 1000); delete d.inicio_rel; }
    if (typeof d.desde_rel === 'number') { d.desde_ms = Math.round(((d.desde_rel as number) - inicioSesion) * 1000); delete d.desde_rel; }
    const retraso = 0.05 + az.u() * 0.4 + (recargas && az.u() < 0.2 ? az.u() * 120 : 0);
    out.push({ s: sesion, q: seq, k: e.k, e: e.e, t: Math.round((e.t - inicioSesion) * 1000), r: T0 + e.t + retraso, w: T0 + e.t + desfaseCliente, d });
  });
  return out;
}
