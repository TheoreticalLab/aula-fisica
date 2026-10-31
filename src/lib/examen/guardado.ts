/**
 * Motor de examen · guardado automático confiable.
 *
 *  · Cada cambio recibe una REVISIÓN creciente (ms del reloj del servidor + contador): el servidor solo aplica una
 *    revisión mayor que la guardada, así que reintentos y envíos fuera de orden no pisan una respuesta más nueva.
 *  · Lo pendiente se escribe primero en el dispositivo (localStorage o equivalente): si se cierra la pestaña, se va la
 *    red o se recarga, al volver se recupera y se reenvía. Solo se borra cuando el servidor confirma esa revisión.
 *  · Reintentos con espera exponencial (1 s → 30 s). Estado visible por pregunta.
 */

export interface Almacen { leer(k: string): string | null; escribir(k: string, v: string): void; borrar(k: string): void }

export type Respuesta = Record<string, unknown>;
export interface Pendiente { exercise_id: string; answer: Respuesta; rev: number; t: number }
export type EstadoGuardado = 'guardado' | 'pendiente' | 'enviando' | 'sin_conexion' | 'rechazado';
export interface Confirmacion { rev: number; aplicada: boolean }
export type Enviar = (p: Pendiente) => Promise<Confirmacion>;

export class ErrorDefinitivo extends Error {} // p. ej. plazo vencido o intento entregado: no se reintenta

export class ColaGuardado {
  private pendientes = new Map<string, Pendiente>();
  private estados = new Map<string, EstadoGuardado>();
  private mensajes = new Map<string, string>();
  private ultimaRev = 0;
  private espera = 1000;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private enCurso: Promise<void> | null = null;
  private oyentes = new Set<() => void>();

  constructor(private readonly clave: string, private readonly enviar: Enviar, private readonly almacen: Almacen,
    private readonly ahora: () => number, private readonly retardo = 800) {
    this.cargar();
  }

  private cargar() {
    try {
      const x = JSON.parse(this.almacen.leer(this.clave) ?? '[]') as Pendiente[];
      for (const p of x) if (p && typeof p.exercise_id === 'string' && typeof p.rev === 'number') {
        this.pendientes.set(p.exercise_id, p); this.estados.set(p.exercise_id, 'pendiente'); this.ultimaRev = Math.max(this.ultimaRev, p.rev);
      }
    } catch { /* almacén dañado: se ignora (lo confirmado está en el servidor) */ }
  }

  private persistir() {
    const xs = [...this.pendientes.values()];
    if (xs.length) this.almacen.escribir(this.clave, JSON.stringify(xs)); else this.almacen.borrar(this.clave);
  }

  private avisar() { for (const f of this.oyentes) f(); }
  suscribir(f: () => void) { this.oyentes.add(f); return () => { this.oyentes.delete(f); }; }

  /** Respuestas pendientes recuperadas del dispositivo (para mostrarlas al reabrir antes de que el servidor confirme). */
  recuperadas(): Pendiente[] { return [...this.pendientes.values()]; }

  estado(id: string): EstadoGuardado { return this.estados.get(id) ?? 'guardado'; }
  mensaje(id: string): string | null { return this.mensajes.get(id) ?? null; }
  hayPendientes(): boolean { return this.pendientes.size > 0; }
  resumen(): EstadoGuardado {
    const e = [...this.estados.values()];
    return e.includes('rechazado') ? 'rechazado' : e.includes('sin_conexion') ? 'sin_conexion' : e.includes('enviando') ? 'enviando' : e.includes('pendiente') ? 'pendiente' : 'guardado';
  }

  /** Registra un cambio (se guarda en el dispositivo al instante y se envía tras una breve espera). */
  cambiar(exercise_id: string, answer: Respuesta) {
    const rev = Math.max(this.ultimaRev + 1, Math.floor(this.ahora()));
    this.ultimaRev = rev;
    this.pendientes.set(exercise_id, { exercise_id, answer, rev, t: this.ahora() });
    this.estados.set(exercise_id, 'pendiente');
    this.mensajes.delete(exercise_id);
    this.persistir();
    this.avisar();
    this.programar(this.retardo);
  }

  private programar(ms: number) {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => { this.temporizador = null; void this.vaciar(); }, ms);
  }

  /** Envía todo lo pendiente ahora (antes de entregar, al ocultarse la página…). Resuelve cuando termina el intento. */
  vaciar(): Promise<void> {
    if (this.enCurso) return this.enCurso.then(() => (this.pendientes.size ? this.vaciar() : undefined));
    this.enCurso = this.vaciarUnaVez().finally(() => { this.enCurso = null; });
    return this.enCurso;
  }

  private async vaciarUnaVez() {
    let fallo = false;
    for (const p of [...this.pendientes.values()]) {
      this.estados.set(p.exercise_id, 'enviando');
      this.avisar();
      try {
        const c = await this.enviar(p);
        const actual = this.pendientes.get(p.exercise_id);
        // solo se borra si no hubo un cambio más nuevo mientras se enviaba
        if (actual && actual.rev <= Math.max(c.rev, p.rev)) { this.pendientes.delete(p.exercise_id); this.estados.set(p.exercise_id, 'guardado'); }
        else this.estados.set(p.exercise_id, 'pendiente');
        if (!c.aplicada && c.rev > p.rev) this.mensajes.set(p.exercise_id, 'El servidor ya tenía una versión más reciente de esta respuesta.');
      } catch (err) {
        if (err instanceof ErrorDefinitivo) {
          this.pendientes.delete(p.exercise_id);
          this.estados.set(p.exercise_id, 'rechazado');
          this.mensajes.set(p.exercise_id, err.message);
        } else { fallo = true; this.estados.set(p.exercise_id, 'sin_conexion'); }
      }
    }
    this.persistir();
    this.avisar();
    if (fallo) { this.programar(this.espera); this.espera = Math.min(30_000, this.espera * 2); } else this.espera = 1000;
  }

  /** Reintento inmediato (p. ej. al recuperar la conexión). */
  reintentar() { this.espera = 1000; if (this.pendientes.size) this.programar(0); }

  detener() { if (this.temporizador) clearTimeout(this.temporizador); this.temporizador = null; }
}

/** Almacén en memoria (pruebas) y adaptador de localStorage (navegador, con fallo silencioso si está lleno o bloqueado). */
export class AlmacenMemoria implements Almacen {
  datos = new Map<string, string>();
  leer(k: string) { return this.datos.get(k) ?? null; }
  escribir(k: string, v: string) { this.datos.set(k, v); }
  borrar(k: string) { this.datos.delete(k); }
}

export const almacenLocal = (): Almacen => ({
  leer: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  escribir: (k, v) => { try { localStorage.setItem(k, v); } catch { /* lleno o bloqueado */ } },
  borrar: (k) => { try { localStorage.removeItem(k); } catch { /* */ } },
});
