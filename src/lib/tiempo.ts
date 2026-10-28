/**
 * Medidor de tiempo efectivo (lógica pura, sin DOM: se prueba con un reloj simulado).
 *
 * Cada instante con la página abierta se clasifica en:
 *   · oculto   — pestaña en segundo plano, ventana minimizada o pantalla bloqueada;
 *   · visible  — página delante (con o sin foco);
 *   · inactivo — visible pero sin evidencia suficiente de actividad;
 *   · efectivo — visible, con foco y con actividad reciente.
 *
 * Regla conservadora de lectura: tras una señal de actividad, la pausa que la sigue cuenta como lectura si se
 * reanuda la actividad antes de `idleSeconds` (120 s por defecto). Si la pausa supera ese umbral, solo se
 * acredita una «cola» de `tailSeconds` (30 s) tras la última señal y el resto es inactividad. Mientras la pausa
 * está abierta, lo informado como efectivo incluye como mucho esa cola: un cierre inesperado nunca acredita la
 * inactividad posterior a la última señal confirmada.
 *
 * Señales débiles (mover el ratón) solo sostienen la actividad durante `weakMaxSeconds` desde la última señal
 * fuerte (teclado, clic, toque, desplazamiento, respuesta, reproducción de un recurso): un ratón automático no
 * acumula tiempo indefinidamente.
 *
 * Visitas breves: hasta que la visita reúne `minVisitSeconds` de tiempo efectivo, lo informado es 0.
 */

/** Aviso transparente sobre el registro de estadísticas de uso (pie de página, Perfil y activación de cuenta). */
export const AVISO_PRIVACIDAD =
  'Aviso de privacidad: el aula registra estadísticas de uso académico (tiempo dedicado a cada sección y, en prácticas y evaluaciones, cuándo se ve, responde, modifica y entrega cada pregunta), visibles solo para el profesorado y conservadas un año. No registra lo que teclea ni nada fuera del aula, ni usa cámara ni micrófono.';

export interface ConfigTiempo {
  idleSeconds: number;
  tailSeconds: number;
  minVisitSeconds: number;
  weakMaxSeconds: number;
}

export const CONFIG_TIEMPO: ConfigTiempo = { idleSeconds: 120, tailSeconds: 30, minVisitSeconds: 15, weakMaxSeconds: 180 };

export type Senal = 'fuerte' | 'debil' | 'respuesta';

export interface Totales {
  effective: number;
  visible: number;
  idle: number;
  hidden: number;
  weak: number;
  interactions: number;
  answers: number;
}

export class MedidorTiempo {
  private cfg: ConfigTiempo;
  private ultimo: number; // ms del último avance
  private visible: boolean;
  private foco: boolean;
  private ultimaSenal: number | null = null; // ms de la última señal válida (fuerte o débil admitida)
  private ultimaFuerte: number | null = null;
  private senalDebil = false; // la última señal válida fue débil
  // acumulados en ms
  private confirmado = 0; // efectivo confirmado
  private abierto = 0; // pausa abierta desde la última señal (provisional)
  private abiertoDebil = 0;
  private debilConfirmado = 0;
  private vis = 0;
  private inact = 0;
  private oculto = 0;
  private interacciones = 0;
  private ultimaInteraccion = -Infinity;
  private respuestas = 0;
  private calificada: boolean;

  constructor(ahora: number, opciones: { visible: boolean; foco: boolean; cfg?: ConfigTiempo; calificada?: boolean }) {
    this.cfg = opciones.cfg ?? CONFIG_TIEMPO;
    this.ultimo = ahora;
    this.visible = opciones.visible;
    this.foco = opciones.foco;
    this.calificada = opciones.calificada ?? false;
    // abrir una página con ella delante es una señal (el estudiante acaba de navegar)
    if (this.visible && this.foco) this.registrar(ahora, 'fuerte', false);
  }

  /** Avanza la contabilidad hasta `ahora`. */
  avanzar(ahora: number): void {
    const dt = Math.max(0, ahora - this.ultimo);
    if (dt === 0) return;
    this.ultimo = ahora;
    if (!this.visible) {
      this.oculto += dt;
      return;
    }
    this.vis += dt;
    if (!this.foco || this.ultimaSenal === null) {
      this.inact += dt;
      return;
    }
    // dentro de la ventana de lectura, el tiempo queda provisional; fuera, es inactividad
    const limite = this.cfg.idleSeconds * 1000;
    const disponible = Math.max(0, limite - this.abierto);
    const dentro = Math.min(dt, disponible);
    this.abierto += dentro;
    if (this.senalDebil) this.abiertoDebil += dentro;
    this.inact += dt - dentro;
  }

  private cerrarPausa(confirmarTodo: boolean): void {
    const cola = this.cfg.tailSeconds * 1000;
    const acreditado = confirmarTodo ? this.abierto : Math.min(this.abierto, cola);
    this.confirmado += acreditado;
    this.debilConfirmado += Math.min(this.abiertoDebil, acreditado);
    this.inact += this.abierto - acreditado;
    this.abierto = 0;
    this.abiertoDebil = 0;
  }

  private registrar(ahora: number, tipo: Senal, contar = true): void {
    if (tipo === 'debil') {
      // un movimiento de ratón solo vale como actividad poco después de una señal fuerte
      if (this.ultimaFuerte === null || ahora - this.ultimaFuerte > this.cfg.weakMaxSeconds * 1000) return;
    }
    if (this.ultimaSenal !== null) {
      // la pausa termina con actividad: es lectura si no superó el umbral
      this.cerrarPausa(this.abierto < this.cfg.idleSeconds * 1000);
    }
    this.ultimaSenal = ahora;
    this.senalDebil = tipo === 'debil';
    if (tipo !== 'debil') this.ultimaFuerte = ahora;
    if (contar && tipo !== 'debil' && ahora - this.ultimaInteraccion >= 1000) {
      this.interacciones++;
      this.ultimaInteraccion = ahora;
    }
    if (tipo === 'respuesta') this.respuestas++;
  }

  senal(ahora: number, tipo: Senal): void {
    this.avanzar(ahora);
    if (!this.visible || !this.foco) return;
    this.registrar(ahora, tipo);
  }

  /** Cambio de visibilidad de la pestaña (Page Visibility API). */
  visibilidad(ahora: number, visible: boolean): void {
    this.avanzar(ahora);
    if (visible === this.visible) return;
    if (!visible) {
      // salir de la pestaña es un acto: confirma la lectura previa (dentro del umbral) y suspende
      if (this.ultimaSenal !== null) this.cerrarPausa(this.abierto < this.cfg.idleSeconds * 1000);
      this.ultimaSenal = null;
    }
    this.visible = visible;
    if (visible && this.foco) this.registrar(ahora, 'fuerte', false);
  }

  /** Pérdida o recuperación del foco de la ventana. */
  foco_(ahora: number, foco: boolean): void {
    this.avanzar(ahora);
    if (foco === this.foco) return;
    if (!foco) {
      if (this.ultimaSenal !== null) this.cerrarPausa(this.abierto < this.cfg.idleSeconds * 1000);
      this.ultimaSenal = null;
    }
    this.foco = foco;
    if (foco && this.visible) this.registrar(ahora, 'fuerte', false);
  }

  /** Totales en segundos enteros para informar al servidor (acumulados de la visita). */
  totales(ahora: number): Totales {
    this.avanzar(ahora);
    const cola = this.cfg.tailSeconds * 1000;
    const provisional = Math.min(this.abierto, cola);
    const efectivoMs = this.confirmado + provisional;
    if (!this.calificada && efectivoMs >= this.cfg.minVisitSeconds * 1000) this.calificada = true;
    const effective = this.calificada ? Math.floor(efectivoMs / 1000) : 0;
    return {
      effective,
      visible: Math.floor(this.vis / 1000),
      idle: Math.floor((this.inact + (this.abierto - provisional)) / 1000),
      hidden: Math.floor(this.oculto / 1000),
      weak: this.calificada ? Math.floor((this.debilConfirmado + Math.min(this.abiertoDebil, provisional)) / 1000) : 0,
      interactions: this.interacciones,
      answers: this.respuestas,
    };
  }

  /** La visita ya superó el mínimo (al trocear una visita por cambio de hora, el trozo nuevo lo hereda). */
  get esCalificada(): boolean {
    return this.calificada;
  }

  get activo(): boolean {
    return this.visible && this.foco && this.ultimaSenal !== null;
  }
}

/** Contexto medible de una ruta del aula. La jerarquía completa la deduce el servidor. */
export interface ContextoRuta {
  kind: 'leccion' | 'curso' | 'actividad' | 'intento' | 'general';
  ref: string | null;
  section: string;
}

const LIMPIA = (s: string) => s.toLowerCase().replace(/[^a-z0-9:_-]/g, '-').replace(/^-+/, '').slice(0, 60) || 'pagina';

/** Deduce el contexto a partir de la ruta: cualquier lección, unidad o pestaña nueva se mide sin programar nada. */
export function contextoDeRuta(pathname: string, search: string): ContextoRuta | null {
  const p = pathname.replace(/\/+$/, '');
  const params = new URLSearchParams(search);
  let m = p.match(/\/curso\/([0-9a-f-]{36})\/leccion\/([0-9a-f-]{36})$/i);
  if (m) return { kind: 'leccion', ref: m[2], section: LIMPIA(params.get('s') || 'teoria') };
  m = p.match(/\/curso\/([0-9a-f-]{36})\/progreso$/i);
  if (m) return { kind: 'curso', ref: m[1], section: 'progreso' };
  m = p.match(/\/curso\/([0-9a-f-]{36})$/i);
  if (m) return { kind: 'curso', ref: m[1], section: 'inicio-curso' };
  m = p.match(/\/actividad\/([0-9a-f-]{36})$/i);
  if (m) return { kind: 'actividad', ref: m[1], section: 'actividad' };
  m = p.match(/\/intento\/([0-9a-f-]{36})$/i);
  if (m) return { kind: 'intento', ref: m[1], section: 'intento' };
  m = p.match(/\/laboratorio(?:\/([a-z0-9-]+))?$/i);
  if (m) return { kind: 'general', ref: null, section: LIMPIA(`laboratorio${m[1] ? ':' + m[1] : ''}`) };
  if (p === '' || p === '/') return { kind: 'general', ref: null, section: 'inicio' };
  m = p.match(/^\/(calificaciones|perfil|temario|unirse)$/);
  if (m) return { kind: 'general', ref: null, section: m[1] };
  return null; // páginas públicas y del profesor: no se miden
}

/** Duración legible para el panel («2 h 35 min», «8 min», «45 s»). */
export function formatoDuracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const min = Math.round((s % 3600) / 60);
  if (h === 0) return `${min} min`;
  return min ? `${h} h ${min} min` : `${h} h`;
}

const SECCIONES: Record<string, string> = {
  teoria: 'Teoría',
  formulas: 'Fórmulas',
  ejemplos: 'Ejemplos resueltos',
  simulacion: 'Simulación',
  comprension: 'Comprensión',
  practica: 'Práctica (ejercicios)',
  actividad: 'Actividad',
  intento: 'Resolución de la actividad',
  'inicio-curso': 'Inicio de la asignatura',
  progreso: 'Progreso',
};
/** Nombre legible de una subsección (las nuevas aparecen con su clave). */
export function etiquetaSeccion(s: string): string {
  return SECCIONES[s] ?? s.replace(/[-_:]/g, ' ');
}

/** CSV con separador «;» (Excel en español) y comillas donde haga falta. */
export function aCsv(filas: (string | number | null)[][]): string {
  const celda = (v: string | number | null) => {
    const t = v === null ? '' : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
}

/** Histograma en minutos: tramos de igual ancho «bonito» (5, 10, 15, 30, 60… min). */
export function histograma(segundos: number[], tramos = 8): { desde: number; hasta: number; n: number }[] {
  if (!segundos.length) return [];
  const max = Math.max(...segundos) / 60;
  const anchos = [5, 10, 15, 30, 60, 120, 240, 480];
  const ancho = anchos.find((a) => a * tramos >= max) ?? Math.ceil(max / tramos);
  const n = Math.max(1, Math.ceil((max + 1e-9) / ancho));
  const out = Array.from({ length: n }, (_, i) => ({ desde: i * ancho, hasta: (i + 1) * ancho, n: 0 }));
  for (const s of segundos) out[Math.min(n - 1, Math.floor(s / 60 / ancho))].n++;
  return out;
}

/** Mediana de una lista de números (0 si está vacía). */
export function mediana(xs: number[]): number {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
