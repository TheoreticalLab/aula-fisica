/**
 * Telemetría del proceso de respuesta · cola persistente del cliente (lógica pura, dependencias inyectables).
 *
 *  - Cada carga de página es una SESIÓN (identificador aleatorio) con número de SECUENCIA creciente: el servidor
 *    descarta duplicados por (sesión, secuencia), así que reenviar es seguro.
 *  - Marca de tiempo MONOTÓNICA (ms desde el inicio de la sesión, performance.now): cambiar la hora del dispositivo
 *    no la altera. También se envía la hora de pared del cliente; el servidor añade la hora de recepción.
 *  - Los eventos pendientes se guardan en almacenamiento local: si falla la red, se recarga o se cierra la página,
 *    se reenvían después (también los de sesiones anteriores). Tope de eventos guardados para no llenar el disco.
 *  - Lo que el servidor rechaza por validación (4xx) se descarta para no reintentar sin fin.
 */

export type TipoEvento =
  | 'sesion_inicio' | 'pregunta_vista' | 'primera_interaccion' | 'respuesta_cambio' | 'borrador_guardado'
  | 'comprobacion' | 'envio' | 'visibilidad' | 'foco' | 'inactividad' | 'conexion' | 'salida';

export type DatoEvento = Record<string, string | number | boolean | null>;

export interface EventoTelemetria {
  session_id: string;
  seq: number;
  attempt_id: string;
  exercise_id: string | null;
  kind: TipoEvento;
  t_ms: number;   // monotónico desde el inicio de la sesión
  wall: number;   // hora de pared del cliente (ms epoch), solo orientativa
  data: DatoEvento;
}

export interface Almacen { leer(clave: string): string | null; escribir(clave: string, valor: string): void }
export type ResultadoEnvio = 'ok' | 'rechazo' | 'error';
export interface DepsCola {
  almacen: Almacen | null;
  enviar: (eventos: EventoTelemetria[], keepalive: boolean) => Promise<ResultadoEnvio>;
  monotonico: () => number;   // ms (performance.now)
  pared: () => number;        // ms epoch (Date.now)
  uuid: () => string;
}

export const CLAVE_PENDIENTES = 'aula-telemetria-pendientes';
export const MAX_PENDIENTES = 3000;
export const LOTE = 200;

export class ColaTelemetria {
  readonly sesion: string;
  private seq = 0;
  private t0: number;
  private enVuelo = false;
  private pendientes: EventoTelemetria[];

  constructor(private deps: DepsCola) {
    this.sesion = deps.uuid();
    this.t0 = deps.monotonico();
    this.pendientes = this.cargar();
  }

  private cargar(): EventoTelemetria[] {
    try {
      const s = this.deps.almacen?.leer(CLAVE_PENDIENTES);
      const xs = s ? (JSON.parse(s) as EventoTelemetria[]) : [];
      return Array.isArray(xs) ? xs.filter((e) => e && typeof e.session_id === 'string' && typeof e.seq === 'number') : [];
    } catch {
      return [];
    }
  }
  private guardar() {
    try {
      // si hay demasiados, se conservan los más recientes (los antiguos ya serían poco útiles)
      if (this.pendientes.length > MAX_PENDIENTES) this.pendientes = this.pendientes.slice(-MAX_PENDIENTES);
      this.deps.almacen?.escribir(CLAVE_PENDIENTES, JSON.stringify(this.pendientes));
    } catch {
      /* almacenamiento lleno o bloqueado: los eventos siguen en memoria */
    }
  }

  /** ms monotónicos desde el inicio de esta sesión. */
  ahora(): number { return Math.max(0, Math.round(this.deps.monotonico() - this.t0)); }

  registrar(attemptId: string, kind: TipoEvento, exerciseId: string | null = null, data: DatoEvento = {}): EventoTelemetria {
    const e: EventoTelemetria = { session_id: this.sesion, seq: ++this.seq, attempt_id: attemptId, exercise_id: exerciseId, kind, t_ms: this.ahora(), wall: this.deps.pared(), data };
    this.pendientes.push(e);
    // con pocos pendientes se guarda cada evento; con muchos (sin red mucho rato), cada 25 para no recargar el
    // dispositivo serializando miles de eventos en cada pulsación. persistir() fuerza el guardado (al salir).
    if (this.pendientes.length <= 300 || this.seq % 25 === 0) this.guardar();
    return e;
  }

  persistir() { this.guardar(); }

  get numPendientes() { return this.pendientes.length; }

  /** Envía un lote. Devuelve cuántos quedaron confirmados (o descartados por rechazo). */
  async vaciar(keepalive = false): Promise<{ enviados: number; resultado: ResultadoEnvio | 'nada' | 'ocupado' }> {
    if (this.enVuelo) return { enviados: 0, resultado: 'ocupado' };
    if (!this.pendientes.length) return { enviados: 0, resultado: 'nada' };
    this.enVuelo = true;
    const lote = this.pendientes.slice(0, LOTE);
    try {
      const r = await this.deps.enviar(lote, keepalive);
      if (r === 'ok' || r === 'rechazo') {
        const enviados = new Set(lote.map((e) => `${e.session_id}#${e.seq}`));
        this.pendientes = this.pendientes.filter((e) => !enviados.has(`${e.session_id}#${e.seq}`));
        this.guardar();
        return { enviados: lote.length, resultado: r };
      }
      return { enviados: 0, resultado: r };
    } catch {
      return { enviados: 0, resultado: 'error' };
    } finally {
      this.enVuelo = false;
    }
  }
}
