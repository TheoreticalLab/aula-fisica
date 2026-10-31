/**
 * Telemetría V2 · cliente (lógica pura, dependencias inyectables). Convive con V1 sin modificarla.
 *
 * Cola: cada evento tiene un identificador estable (event_id) y una secuencia por sesión; reenviar no duplica. Estados:
 * generado → en cola (persistido en el dispositivo) → enviado → confirmado (el servidor respondió). Presupuestos:
 * tope de eventos guardados, lote máximo, tamaño máximo del payload y eventos por segundo (los no esenciales se
 * descartan y se informa cuántos en el siguiente latido).
 *
 * Rastreador: sesión, sincronización de reloj (muestras ida y vuelta), latido, visibilidad, foco, conexión,
 * inactividad, exposición (criterio corregido), pregunta activa (control enfocado), cambios de respuesta
 * consolidados en ráfagas con su tipo (introducida, modificada, reemplazada, vaciada, restaurada), guardados
 * solicitados/confirmados/fallidos, borrador recuperado, comprobación y solicitud de entrega. Nunca teclas, texto,
 * portapapeles ni nada fuera de la plataforma: la respuesta se resume en huella y longitud.
 */
import { describirRespuesta, fnv1a, type DescripcionRespuesta } from '../rastreador';

export type TipoEventoV2 =
  | 'session_started' | 'session_resumed' | 'session_ended' | 'clock_sync' | 'heartbeat'
  | 'page_visible' | 'page_hidden' | 'focus_gained' | 'focus_lost' | 'idle_started' | 'idle_ended' | 'connection_lost' | 'connection_restored'
  | 'question_exposure_started' | 'question_exposure_ended' | 'question_activated' | 'question_deactivated'
  | 'answer_draft_changed' | 'answer_draft_restored' | 'answer_save_requested' | 'answer_save_confirmed' | 'answer_save_failed'
  | 'answer_checked' | 'attempt_submit_requested' | 'simulation_event';

export type PayloadV2 = Record<string, string | number | boolean>;

export interface EventoV2 {
  event_id: string;
  attempt_id: string;
  session_id: string;
  tab_id: string | null;
  client_seq: number;
  event_type: TipoEventoV2;
  question_id: string | null;
  active_question_id: string | null;
  t_mono: number;
  wall: number;
  visibility: 'visible' | 'hidden';
  connectivity: 'online' | 'offline';
  payload: PayloadV2;
}

export interface AlmacenV2 { leer(k: string): string | null; escribir(k: string, v: string): void }
export type ResultadoEnvioV2 = 'ok' | 'rechazo' | 'error';
export interface DepsV2 {
  almacen: AlmacenV2 | null;
  enviar: (eventos: EventoV2[]) => Promise<ResultadoEnvioV2>;
  monotonico: () => number;
  pared: () => number;
  uuid: () => string;
  tab: string | null;
}

export const PRESUPUESTO = { maxPendientes: 3000, lote: 100, payloadBytes: 500, eventosPorSegundo: 20 } as const;
export const CLAVE_V2 = 'aula-telemetria-v2-pendientes';
/** Tipos que nunca se descartan por exceso de ritmo (sin ellos la reconstrucción pierde estados). */
const ESENCIALES = new Set<TipoEventoV2>(['session_started', 'session_resumed', 'session_ended', 'clock_sync', 'page_visible', 'page_hidden',
  'connection_lost', 'connection_restored', 'question_activated', 'question_deactivated', 'answer_draft_changed', 'answer_draft_restored',
  'answer_save_confirmed', 'answer_save_failed', 'attempt_submit_requested', 'idle_started', 'idle_ended']);

export class ColaV2 {
  readonly sesion: string;
  private seq = 0;
  private t0: number;
  private enVuelo = false;
  private pendientes: EventoV2[];
  private ventana = { segundo: -1, n: 0 };
  descartados = 0;
  confirmados = 0;

  constructor(private deps: DepsV2) {
    this.sesion = deps.uuid();
    this.t0 = deps.monotonico();
    this.pendientes = this.cargar();
  }
  private cargar(): EventoV2[] {
    try {
      const s = this.deps.almacen?.leer(CLAVE_V2);
      const xs = s ? (JSON.parse(s) as EventoV2[]) : [];
      return Array.isArray(xs) ? xs.filter((e) => e && typeof e.event_id === 'string' && typeof e.client_seq === 'number') : [];
    } catch { return []; }
  }
  private guardar() {
    try {
      if (this.pendientes.length > PRESUPUESTO.maxPendientes) {
        this.descartados += this.pendientes.length - PRESUPUESTO.maxPendientes;
        this.pendientes = this.pendientes.slice(-PRESUPUESTO.maxPendientes);
      }
      this.deps.almacen?.escribir(CLAVE_V2, JSON.stringify(this.pendientes));
    } catch { /* almacenamiento lleno: los eventos siguen en memoria */ }
  }
  ahora(): number { return Math.max(0, Math.round(this.deps.monotonico() - this.t0)); }
  get numPendientes() { return this.pendientes.length; }

  registrar(base: Omit<EventoV2, 'event_id' | 'session_id' | 'tab_id' | 'client_seq' | 't_mono' | 'wall'>): EventoV2 | null {
    const t = this.ahora();
    const seg = Math.floor(t / 1000);
    if (seg !== this.ventana.segundo) this.ventana = { segundo: seg, n: 0 };
    if (++this.ventana.n > PRESUPUESTO.eventosPorSegundo && !ESENCIALES.has(base.event_type)) { this.descartados++; return null; }
    const payload = recortarPayload(base.payload);
    const e: EventoV2 = { ...base, payload, event_id: this.deps.uuid(), session_id: this.sesion, tab_id: this.deps.tab, client_seq: ++this.seq, t_mono: t, wall: this.deps.pared() };
    this.pendientes.push(e);
    if (this.pendientes.length <= 300 || this.seq % 25 === 0) this.guardar();
    return e;
  }
  persistir() { this.guardar(); }

  /** Envía un lote; lo confirmado (o rechazado por validación) sale de la cola. Un error de red lo deja para después. */
  async vaciar(): Promise<{ enviados: number; resultado: ResultadoEnvioV2 | 'nada' | 'ocupado' }> {
    if (this.enVuelo) return { enviados: 0, resultado: 'ocupado' };
    if (!this.pendientes.length) return { enviados: 0, resultado: 'nada' };
    this.enVuelo = true;
    const lote = this.pendientes.slice(0, PRESUPUESTO.lote);
    try {
      const r = await this.deps.enviar(lote);
      if (r === 'ok' || r === 'rechazo') {
        const ids = new Set(lote.map((e) => e.event_id));
        this.pendientes = this.pendientes.filter((e) => !ids.has(e.event_id));
        if (r === 'ok') this.confirmados += lote.length;
        this.guardar();
        return { enviados: lote.length, resultado: r };
      }
      return { enviados: 0, resultado: r };
    } catch { return { enviados: 0, resultado: 'error' }; } finally { this.enVuelo = false; }
  }
}

/** El payload nunca supera el presupuesto: se quitan campos de texto largos primero. */
export function recortarPayload(p: PayloadV2): PayloadV2 {
  const out: PayloadV2 = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && (typeof v !== 'string' || v.length <= 40)) out[k] = v;
  while (JSON.stringify(out).length > PRESUPUESTO.payloadBytes) { const k = Object.keys(out).pop(); if (!k) break; delete out[k]; }
  return out;
}

export type TipoCambio = 'introducida' | 'modificada' | 'reemplazada' | 'vaciada' | 'restaurada';

/** Clasifica un cambio consolidado de respuesta (huellas y longitudes; nunca el contenido). */
export function tipoCambio(desde: DescripcionRespuesta | null, hasta: DescripcionRespuesta, anteriores: Set<string>): TipoCambio {
  if (hasta.vacia) return 'vaciada';
  if (!desde || desde.vacia) return hasta.huella && anteriores.has(hasta.huella) ? 'restaurada' : 'introducida';
  if (hasta.huella && anteriores.has(hasta.huella)) return 'restaurada';
  // sin texto no se puede saber cuánto se conservó: si la longitud cambia poco es una modificación; si no, reemplazo
  return Math.abs(hasta.longitud - desde.longitud) <= Math.max(3, desde.longitud / 2) ? 'modificada' : 'reemplazada';
}

export const CONFIG_V2 = { rafagaMs: 2000, inactividadMs: 60_000, latidoMs: 30_000, sincronizacionMs: 300_000 };

interface EstadoPregunta { expuesta: boolean; confirmada: DescripcionRespuesta | null; huellas: Set<string>; rafaga: { inicio: number; ultimo: number; desde: DescripcionRespuesta | null; actual: DescripcionRespuesta; n: number } | null }

export class RastreadorV2 {
  private q = new Map<string, EstadoPregunta>();
  private activa: string | null = null;
  private visible = true;
  private enLinea = true;
  private ultimaActividad: number;
  private inactivo = false;
  private ultimoLatido = 0;

  constructor(private cola: ColaV2, readonly attemptId: string, private cfg = CONFIG_V2) { this.ultimaActividad = cola.ahora(); }

  private ev(event_type: TipoEventoV2, question_id: string | null = null, payload: PayloadV2 = {}) {
    return this.cola.registrar({ attempt_id: this.attemptId, event_type, question_id, active_question_id: this.activa,
      visibility: this.visible ? 'visible' : 'hidden', connectivity: this.enLinea ? 'online' : 'offline', payload });
  }
  private estado(id: string): EstadoPregunta {
    let s = this.q.get(id);
    if (!s) { s = { expuesta: false, confirmada: null, huellas: new Set(), rafaga: null }; this.q.set(id, s); }
    return s;
  }

  iniciar(navegacion: string, visible: boolean, enLinea: boolean, reanudada = false) {
    this.visible = visible; this.enLinea = enLinea;
    this.ev(reanudada ? 'session_resumed' : 'session_started', null, { navegacion, visible });
  }
  /** Muestra de sincronización: tiempos monotónicos de envío y recepción y la hora del servidor (ms). */
  sincronizacion(envio_tau: number, servidor_ms: number, recibo_tau: number) { this.ev('clock_sync', null, { envio_tau, servidor_ms, recibo_tau }); }
  conocer(id: string, d: DescripcionRespuesta) { const s = this.estado(id); s.confirmada = d; if (d.huella) s.huellas.add(d.huella); }

  exposicion(id: string, visible: boolean) {
    const s = this.estado(id);
    if (s.expuesta === visible) return;
    s.expuesta = visible;
    this.ev(visible ? 'question_exposure_started' : 'question_exposure_ended', id);
  }
  /** El estudiante pasó a usar los controles de una pregunta (foco dentro de su tarjeta) o el examen la activó. */
  activar(id: string | null) {
    if (this.activa === id) return;
    if (this.activa) this.ev('question_deactivated', this.activa);
    this.activa = id;
    if (id) this.ev('question_activated', id);
    this.actividad();
  }
  interaccion() { this.actividad(); }

  cambio(id: string, d: DescripcionRespuesta) {
    this.actividad();
    const s = this.estado(id);
    const t = this.cola.ahora();
    if (s.rafaga && t - s.rafaga.ultimo > this.cfg.rafagaMs) this.cerrar(id);
    if (!s.rafaga) s.rafaga = { inicio: t, ultimo: t, desde: s.confirmada, actual: d, n: 0 };
    s.rafaga.ultimo = t; s.rafaga.actual = d; s.rafaga.n++;
  }
  private cerrar(id: string) {
    const s = this.q.get(id);
    if (!s?.rafaga) return;
    const r = s.rafaga; s.rafaga = null;
    if (r.desde && r.actual.huella === r.desde.huella && r.actual.vacia === r.desde.vacia) return;
    const tipo = tipoCambio(r.desde, r.actual, s.huellas);
    this.ev('answer_draft_changed', id, {
      inicio_tau: r.inicio, fin_tau: r.ultimo, n: r.n, len: r.actual.longitud, delta: r.actual.longitud - (r.desde?.longitud ?? 0), vacia: r.actual.vacia,
      primera: !r.desde || r.desde.vacia, borrado: tipo === 'vaciada', tipo_cambio: tipo, ...(r.actual.huella ? { h: r.actual.huella } : {}),
    });
    if (r.actual.huella) s.huellas.add(r.actual.huella);
    s.confirmada = r.actual;
  }
  restaurado(id: string, d: DescripcionRespuesta) { this.ev('answer_draft_restored', id, { len: d.longitud, ...(d.huella ? { h: d.huella } : {}) }); }
  guardadoSolicitado(id: string) { this.cerrar(id); this.ev('answer_save_requested', id); }
  guardadoConfirmado(id: string) { this.ev('answer_save_confirmed', id); }
  guardadoFallido(id: string, codigo: string, intentos: number) { this.ev('answer_save_failed', id, { codigo: codigo.slice(0, 40), intentos }); }
  comprobacion(id: string, fase: 'solicitada' | 'recibida' | 'error') { this.cerrar(id); this.ev('answer_checked', id, { fase }); }
  entregaSolicitada() { for (const id of this.q.keys()) this.cerrar(id); this.ev('attempt_submit_requested'); }
  simulacion(id: string | null, accion: string, param?: string, valor?: number) {
    this.ev('simulation_event', id, { accion: accion.slice(0, 40), ...(param ? { param: param.slice(0, 40) } : {}), ...(typeof valor === 'number' ? { valor } : {}) });
  }

  visibilidad(v: boolean) {
    if (v === this.visible) return;
    if (!v) for (const id of this.q.keys()) this.cerrar(id);
    this.visible = v;
    this.ev(v ? 'page_visible' : 'page_hidden');
    if (v) this.actividad();
  }
  foco(f: boolean) { this.ev(f ? 'focus_gained' : 'focus_lost'); }
  conexion(c: boolean) { if (c === this.enLinea) return; this.enLinea = c; this.ev(c ? 'connection_restored' : 'connection_lost'); }

  actividad() {
    const t = this.cola.ahora();
    if (this.inactivo) { this.inactivo = false; this.ev('idle_ended', null, { duracion_ms: t - this.ultimaActividad }); }
    this.ultimaActividad = t;
  }
  /** Cada segundo: cierra ráfagas, detecta inactividad y emite el latido mientras la página está visible. */
  tick() {
    const t = this.cola.ahora();
    for (const [id, s] of this.q) if (s.rafaga && t - s.rafaga.ultimo > this.cfg.rafagaMs) this.cerrar(id);
    if (!this.inactivo && this.visible && t - this.ultimaActividad > this.cfg.inactividadMs) {
      this.inactivo = true;
      this.ev('idle_started', null, { desde_tau: this.ultimaActividad });
    }
    if (this.visible && t - this.ultimoLatido >= this.cfg.latidoMs) {
      this.ultimoLatido = t;
      this.ev('heartbeat', null, { pendientes: this.cola.numPendientes, ...(this.cola.descartados ? { n: this.cola.descartados } : {}) });
    }
  }
  salida() { for (const id of this.q.keys()) this.cerrar(id); this.ev('session_ended'); this.cola.persistir(); }
}

export { describirRespuesta, fnv1a };
