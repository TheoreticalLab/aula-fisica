/**
 * Sesión del estudiante en una Práctica Extraordinaria Secuencial: lógica sin React, con la API, el almacén y el
 * reloj inyectados (la pantalla y las pruebas contra la base real usan exactamente este código).
 *
 *  · El servidor decide; esto solo presenta y reintenta. La espera mínima que se muestra es orientativa (reloj del
 *    servidor estimado): si el servidor dice que aún no se cumple, se pide confirmar el avance anticipado.
 *  · Autoguardado del borrador con revisión creciente: primero en el dispositivo, luego en el servidor; al recargar
 *    gana la revisión más nueva.
 *  · Confirmar y omitir son irreversibles e idempotentes: la acción se escribe en el dispositivo CON su clave de
 *    idempotencia antes de enviarla. Si la red falla (antes o después de llegar), se reenvía con la MISMA clave: el
 *    servidor la aplica una sola vez. Si el apartado ya no está abierto (otra pestaña, plazo), se recarga el estado.
 */
import type { ApiPes, EventoCliente, VistaPes } from '@/api/pesTipos';
import type { StudentAnswer } from '@/api/tipos';
import type { Almacen } from '@/lib/examen/guardado';

export type Fase = 'cargando' | 'condiciones' | 'apartado' | 'esperando' | 'completada' | 'vencida' | 'error';
export type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'sin_conexion';
export type Resultado = 'ok' | 'requiere_anticipar' | 'formato' | 'vacia' | 'sin_conexion' | 'recargado' | 'ocupado' | 'error';

export interface AccionPendiente {
  tipo: 'confirmar' | 'omitir';
  apartado: string;
  idem: string;
  answer?: StudentAnswer;
  anticipado?: boolean;
}

export interface EstadoSesion {
  fase: Fase;
  vista: VistaPes | null;
  respuesta: StudentAnswer;
  rev: number;
  guardado: EstadoGuardado;
  enviando: AccionPendiente['tipo'] | null;
  pendiente: AccionPendiente | null;
  /** mensajes de formato de la última respuesta (no dicen si es correcta) */
  mensajes: string[];
  aviso: string | null;
  error: string | null;
  /** reloj del servidor ≈ reloj local + desfase (ms) */
  desfaseMs: number;
}

export interface Temporizador { poner(fn: () => void, ms: number): unknown; quitar(id: unknown): void }
export interface DependenciasSesion {
  api: ApiPes;
  almacen: Almacen;
  /** ms del reloj local (Date.now en el navegador) */
  reloj: () => number;
  nuevoId: () => string;
  temporizador?: Temporizador;
  retardoGuardadoMs?: number;
}

const RED = /No hay conexión|Failed to fetch|NetworkError|Load failed|network|ECONN|timeout|Tiempo de espera/i;
const NO_ABIERTO = /no está abierto|plazo terminó|ya cerró|no está abierta|Solicitud no válida/i;
const TIEMPO_MINIMO = /tiempo mínimo/i;

export const esErrorDeRed = (e: unknown) => e instanceof TypeError || RED.test(e instanceof Error ? e.message : String(e));
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** ¿La respuesta tiene contenido? (una vacía no se confirma: se omite, con su propia advertencia) */
export function respuestaVacia(formato: string | undefined, a: StudentAnswer): boolean {
  if (formato === 'choice') return !a.selected?.length;
  if (formato === 'truefalse') return typeof a.value !== 'boolean';
  return !a.text?.trim();
}

/**
 * Bloqueo ordinario de pegado y arrastre (evento beforeinput). Dictado, autocorrección y teclados de entrada (IME)
 * no son pegado y siempre se permiten; con la adaptación «pegado permitido» tampoco se bloquea el pegado.
 */
export function decidirEntrada(inputType: string, pegadoPermitido: boolean): 'permitir' | 'pegado' | 'arrastre' {
  if (pegadoPermitido) return 'permitir';
  if (inputType === 'insertFromPaste' || inputType === 'insertFromPasteAsQuotation') return 'pegado';
  if (inputType === 'insertFromDrop') return 'arrastre';
  return 'permitir';
}

export class SesionPes {
  private estado: EstadoSesion = {
    fase: 'cargando', vista: null, respuesta: {}, rev: 0, guardado: 'guardado', enviando: null, pendiente: null,
    mensajes: [], aviso: null, error: null, desfaseMs: 0,
  };
  private oyentes = new Set<(e: EstadoSesion) => void>();
  private tGuardado: unknown = null;
  private tReintento: unknown = null;
  private reintentos = 0;
  private readonly t: Temporizador;

  constructor(private readonly practica: string, private readonly d: DependenciasSesion) {
    this.t = d.temporizador ?? { poner: (fn, ms) => setTimeout(fn, ms), quitar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };
    this.estado.pendiente = this.leerPendiente();
  }

  // ---- estado observable
  get e(): EstadoSesion { return this.estado; }
  suscribir(fn: (e: EstadoSesion) => void): () => void { this.oyentes.add(fn); return () => { this.oyentes.delete(fn); }; }
  private poner(p: Partial<EstadoSesion>) { this.estado = { ...this.estado, ...p }; for (const f of this.oyentes) f(this.estado); }
  detener() { this.t.quitar(this.tGuardado); this.t.quitar(this.tReintento); this.oyentes.clear(); }

  // ---- almacén del dispositivo
  private get kPend() { return `pes:${this.practica}:pendiente`; }
  private kBorr(ap: string) { return `pes:${this.practica}:${ap}:borrador`; }
  private leerPendiente(): AccionPendiente | null {
    try { const x = JSON.parse(this.d.almacen.leer(this.kPend) ?? 'null'); return x && typeof x.idem === 'string' && typeof x.apartado === 'string' ? x : null; } catch { return null; }
  }
  private guardarPendiente(p: AccionPendiente | null) {
    if (p) this.d.almacen.escribir(this.kPend, JSON.stringify(p)); else this.d.almacen.borrar(this.kPend);
    this.poner({ pendiente: p });
  }

  // ---- tiempo (reloj del servidor estimado)
  ahoraServidor(): number { return this.d.reloj() + this.estado.desfaseMs; }
  transcurridoS(): number {
    const r = this.estado.vista?.revelado_at;
    return r ? Math.max(0, (this.ahoraServidor() - Date.parse(r)) / 1000) : 0;
  }
  /** segundos que faltan para la espera mínima (0 si ya se cumplió) */
  faltaMinimoS(): number { return Math.max(0, (this.estado.vista?.t_min_s ?? 0) - this.transcurridoS()); }
  /** segundos hasta el plazo personal (null si no hay) */
  faltaCierreS(): number | null {
    const c = this.estado.vista?.cierre;
    return c ? (Date.parse(c) - this.ahoraServidor()) / 1000 : null;
  }

  // ---- carga y vista
  async cargar(): Promise<void> {
    try {
      const v = await this.d.api.actual(this.practica);
      this.aplicarVista(v);
      const p = this.estado.pendiente;
      if (p) {
        // una acción que quedó en el aire: si su apartado sigue abierto, se reenvía con la misma clave; si no, ya se aplicó
        if (v.estado === 'apartado_abierto' && v.apartado?.id === p.apartado) await this.enviar(p);
        else this.guardarPendiente(null);
      }
    } catch (e) {
      this.poner({ fase: 'error', error: mensaje(e) });
    }
  }

  async iniciar(): Promise<Resultado> {
    try { this.aplicarVista(await this.d.api.iniciar(this.practica)); return 'ok'; }
    catch (e) { if (esErrorDeRed(e)) { this.poner({ error: 'Sin conexión. Inténtelo de nuevo.' }); return 'sin_conexion'; } this.poner({ error: mensaje(e) }); return 'error'; }
  }

  private aplicarVista(v: VistaPes) {
    const desfaseMs = Date.parse(v.ahora) - this.d.reloj();
    const fase: Fase = v.estado === 'no_iniciada' ? 'condiciones' : v.estado === 'apartado_abierto' ? 'apartado'
      : v.estado === 'esperando_liberacion' ? 'esperando' : v.estado === 'completada' ? 'completada' : 'vencida';
    const cambio = v.apartado?.id !== this.estado.vista?.apartado?.id;
    let { respuesta, rev, guardado } = this.estado;
    if (cambio) {
      // apartado nuevo (o recarga): el borrador más nuevo entre el del servidor y la copia del dispositivo
      respuesta = {}; rev = 0; guardado = 'guardado';
      if (v.apartado) {
        let srv: StudentAnswer = {};
        try { srv = v.borrador ? JSON.parse(v.borrador) : {}; } catch { srv = { text: v.borrador ?? '' }; }
        const srvRev = v.borrador_rev ?? 0;
        let loc: { rev: number; answer: StudentAnswer } | null = null;
        try { loc = JSON.parse(this.d.almacen.leer(this.kBorr(v.apartado.id)) ?? 'null'); } catch { loc = null; }
        if (loc && loc.rev > srvRev) { respuesta = loc.answer; rev = loc.rev; guardado = 'pendiente'; }
        else { respuesta = srv; rev = srvRev; }
      }
    }
    this.poner({ vista: v, fase, desfaseMs, respuesta, rev, guardado, error: null, ...(cambio ? { mensajes: [] } : {}) });
    if (cambio && guardado === 'pendiente') this.programarGuardado(0);
  }

  // ---- edición y autoguardado
  editar(answer: StudentAnswer) {
    const ap = this.estado.vista?.apartado;
    if (!ap || this.estado.fase !== 'apartado') return;
    const rev = this.estado.rev + 1;
    this.d.almacen.escribir(this.kBorr(ap.id), JSON.stringify({ rev, answer }));
    this.poner({ respuesta: answer, rev, guardado: 'pendiente', mensajes: [] });
    this.programarGuardado(this.d.retardoGuardadoMs ?? 1500);
  }

  private programarGuardado(ms: number) {
    this.t.quitar(this.tGuardado);
    this.tGuardado = this.t.poner(() => { void this.guardar(); }, ms);
  }

  async guardar(): Promise<void> {
    const ap = this.estado.vista?.apartado;
    if (!ap || this.estado.guardado === 'guardado' || this.estado.fase !== 'apartado') return;
    const { rev, respuesta } = this.estado;
    this.poner({ guardado: 'guardando' });
    try {
      const r = await this.d.api.borrador(this.practica, ap.id, JSON.stringify(respuesta), rev);
      if (this.estado.vista?.apartado?.id !== ap.id) return;
      if (r.rev >= this.estado.rev) { this.d.almacen.borrar(this.kBorr(ap.id)); this.poner({ guardado: 'guardado' }); this.reintentos = 0; }
      else this.programarGuardado(0);                 // se editó mientras se guardaba
    } catch (e) {
      if (esErrorDeRed(e)) { this.poner({ guardado: 'sin_conexion' }); this.programarReintento(() => this.guardar()); return; }
      if (NO_ABIERTO.test(mensaje(e))) { await this.recargar('El apartado ya no está abierto: se muestra el estado actual.'); return; }
      this.poner({ guardado: 'pendiente', error: mensaje(e) });
    }
  }

  private programarReintento(fn: () => Promise<unknown>) {
    this.t.quitar(this.tReintento);
    this.reintentos++;
    this.tReintento = this.t.poner(() => { void fn(); }, Math.min(30000, 1000 * 2 ** Math.min(this.reintentos, 5)));
  }

  /** La red volvió (evento «online»): reintenta lo pendiente de inmediato. */
  async reconectado(): Promise<void> {
    this.reintentos = 0;
    this.t.quitar(this.tReintento);
    if (this.estado.pendiente) await this.enviar(this.estado.pendiente);
    else if (this.estado.guardado !== 'guardado') await this.guardar();
  }

  // ---- acciones irreversibles
  /** Confirma la respuesta. Antes de la espera mínima exige `anticipado` (el estudiante aceptó la reducción). */
  async confirmar(opciones: { anticipado?: boolean } = {}): Promise<Resultado> {
    const v = this.estado.vista;
    if (!v?.apartado || this.estado.fase !== 'apartado') return 'error';
    if (this.estado.enviando || this.estado.pendiente) return 'ocupado';
    if (respuestaVacia(v.apartado.formato, this.estado.respuesta)) return 'vacia';
    if (!opciones.anticipado && this.faltaMinimoS() > 0) return 'requiere_anticipar';
    const p: AccionPendiente = { tipo: 'confirmar', apartado: v.apartado.id, idem: this.d.nuevoId(), answer: this.estado.respuesta, anticipado: !!opciones.anticipado };
    this.guardarPendiente(p);
    return this.enviar(p);
  }

  /** Omite definitivamente el apartado abierto (vale 0). */
  async omitir(): Promise<Resultado> {
    const v = this.estado.vista;
    if (!v?.apartado || this.estado.fase !== 'apartado') return 'error';
    if (this.estado.enviando || this.estado.pendiente) return 'ocupado';
    const p: AccionPendiente = { tipo: 'omitir', apartado: v.apartado.id, idem: this.d.nuevoId() };
    this.guardarPendiente(p);
    return this.enviar(p);
  }

  private async enviar(p: AccionPendiente): Promise<Resultado> {
    if (this.estado.enviando) return 'ocupado';
    this.poner({ enviando: p.tipo, error: null, aviso: null });
    try {
      let actual: VistaPes;
      if (p.tipo === 'confirmar') {
        const r = await this.d.api.confirmar(this.practica, p.apartado, p.answer ?? {}, !!p.anticipado, p.idem);
        if (!r.confirmado) { this.guardarPendiente(null); this.poner({ enviando: null, mensajes: r.mensajes }); return 'formato'; }
        actual = r.estado.actual;
      } else {
        actual = (await this.d.api.omitir(this.practica, p.apartado, p.idem)).actual;
      }
      this.guardarPendiente(null);
      this.d.almacen.borrar(this.kBorr(p.apartado));
      this.reintentos = 0;
      this.poner({ enviando: null });
      this.aplicarVista(actual);
      return 'ok';
    } catch (e) {
      this.poner({ enviando: null });
      if (esErrorDeRed(e)) {
        // se conserva la acción con su clave: al reintentar (o recargar) se aplica una sola vez
        this.poner({ aviso: 'Sin conexión: su decisión quedó guardada en este dispositivo y se enviará al recuperar la red.' });
        this.programarReintento(() => this.enviar(p));
        return 'sin_conexion';
      }
      this.guardarPendiente(null);
      if (TIEMPO_MINIMO.test(mensaje(e))) return 'requiere_anticipar';
      if (NO_ABIERTO.test(mensaje(e))) { await this.recargar('Ese apartado ya estaba cerrado (quizá desde otra pestaña o dispositivo, o terminó el plazo). Se muestra el estado actual.'); return 'recargado'; }
      this.poner({ error: mensaje(e) });
      return 'error';
    }
  }

  private async recargar(aviso: string) {
    try { this.aplicarVista(await this.d.api.actual(this.practica)); this.poner({ aviso }); }
    catch (e) { if (NO_ABIERTO.test(mensaje(e))) this.poner({ fase: 'vencida', aviso }); else this.poner({ error: mensaje(e) }); }
  }

  /** Incidencia del navegador (solo el tipo; nunca el contenido). Un fallo de red no molesta al estudiante. */
  registrar(tipo: EventoCliente) { this.d.api.evento(this.practica, tipo).catch(() => undefined); }
}
