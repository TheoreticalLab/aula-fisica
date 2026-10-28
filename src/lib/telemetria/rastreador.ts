/**
 * Telemetría del proceso de respuesta · capa semántica (lógica pura; el componente React solo le pasa señales).
 *
 * Eventos: apertura de la sesión, visualización de cada pregunta, primera interacción, cambios de respuesta
 * agrupados en RÁFAGAS (inicio, fin, longitud y huella; nunca las teclas), primera entrada no vacía, borrados,
 * guardado del borrador (con confirmación del servidor), comprobación y envío, visibilidad, foco, inactividad
 * y conexión. NO hay keylogging ni se registra nada fuera de la plataforma: la respuesta se resume en una huella
 * (para saber si cambió o si coincide) y su longitud.
 */
import type { ColaTelemetria, DatoEvento } from './cola';

export interface DescripcionRespuesta { vacia: boolean; huella: string | null; longitud: number }

/** Huella FNV-1a de 32 bits (solo para igualdad; no es un secreto ni permite reconstruir la respuesta). */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export function describirRespuesta(a: { selected?: number[]; value?: boolean; text?: string; justification?: string } | null | undefined): DescripcionRespuesta {
  const sel = a?.selected?.length ? [...a.selected].sort((x, y) => x - y).join(',') : '';
  const val = typeof a?.value === 'boolean' ? String(a.value) : '';
  const txt = (a?.text ?? '').replace(/\s+/g, '').toLowerCase();
  const longitud = (a?.text ?? '').length + (a?.justification ?? '').length + (sel ? sel.split(',').length : 0) + (val ? 1 : 0);
  const vacia = !sel && !val && !txt && !(a?.justification ?? '').trim();
  return { vacia, huella: vacia ? null : fnv1a(`${sel}|${val}|${txt}`), longitud };
}

export const CONFIG_RASTREO = { rafagaMs: 2000, inactividadMs: 60_000 };

interface EstadoItem {
  visible: boolean; vistas: number; interactuado: boolean; noVacia: boolean; confirmada: DescripcionRespuesta | null;
  rafaga: { inicio: number; ultimo: number; desde: DescripcionRespuesta | null; actual: DescripcionRespuesta; n: number } | null;
}

export class Rastreador {
  private items = new Map<string, EstadoItem>();
  private ultimaActividad: number;
  private inactivo = false;
  private visiblePagina = true;

  constructor(private cola: ColaTelemetria, readonly attemptId: string, private cfg = CONFIG_RASTREO) {
    this.ultimaActividad = cola.ahora();
  }

  private ev(kind: Parameters<ColaTelemetria['registrar']>[1], ex: string | null = null, data: DatoEvento = {}) {
    return this.cola.registrar(this.attemptId, kind, ex, data);
  }
  private item(ex: string, inicial?: DescripcionRespuesta | null): EstadoItem {
    let s = this.items.get(ex);
    if (!s) {
      s = { visible: false, vistas: 0, interactuado: false, noVacia: !!inicial && !inicial.vacia, confirmada: inicial ?? null, rafaga: null };
      this.items.set(ex, s);
    }
    return s;
  }

  iniciar(navegacion: string, pestana: string) { this.ev('sesion_inicio', null, { navegacion, pestana }); }

  /** Respuesta ya guardada al abrir (recarga o vuelta): punto de partida para medir cambios. */
  conocer(ex: string, d: DescripcionRespuesta) { this.item(ex, d); }

  vista(ex: string, visible: boolean) {
    const s = this.item(ex);
    if (s.visible === visible) return;
    s.visible = visible;
    if (visible) s.vistas++;
    this.ev('pregunta_vista', ex, { visible, n: s.vistas });
  }

  interaccion(ex: string) {
    this.actividad();
    const s = this.item(ex);
    if (s.interactuado) return;
    s.interactuado = true;
    this.ev('primera_interaccion', ex);
  }

  cambio(ex: string, d: DescripcionRespuesta) {
    this.actividad();
    const s = this.item(ex);
    const t = this.cola.ahora();
    if (s.rafaga && t - s.rafaga.ultimo > this.cfg.rafagaMs) this.cerrarRafaga(ex);
    if (!s.rafaga) s.rafaga = { inicio: t, ultimo: t, desde: s.confirmada, actual: d, n: 0 };
    s.rafaga.ultimo = t;
    s.rafaga.actual = d;
    s.rafaga.n++;
  }

  private cerrarRafaga(ex: string) {
    const s = this.items.get(ex);
    if (!s?.rafaga) return;
    const r = s.rafaga;
    s.rafaga = null;
    if (r.desde && r.actual.huella === r.desde.huella && r.actual.vacia === r.desde.vacia) return; // volvió a lo mismo
    const primera = !s.noVacia && !r.actual.vacia;
    if (primera) s.noVacia = true;
    this.ev('respuesta_cambio', ex, {
      h: r.actual.huella, len: r.actual.longitud, delta: r.actual.longitud - (r.desde?.longitud ?? 0), vacia: r.actual.vacia,
      borrado: !!r.desde && !r.desde.vacia && r.actual.vacia, primera, inicio_ms: r.inicio, rafaga_ms: r.ultimo - r.inicio, n: r.n,
    });
    s.confirmada = r.actual;
  }

  guardado(ex: string, ok: boolean) { this.ev('borrador_guardado', ex, { ok }); }
  comprobacion(ex: string, fase: 'solicitada' | 'recibida' | 'error') { this.cerrarRafaga(ex); this.ev('comprobacion', ex, { fase }); }

  envio(fase: 'solicitado' | 'recibido' | 'error') {
    for (const ex of this.items.keys()) this.cerrarRafaga(ex);
    this.ev('envio', null, { fase });
  }

  visibilidad(visible: boolean) {
    if (visible === this.visiblePagina) return;
    this.visiblePagina = visible;
    if (!visible) for (const ex of this.items.keys()) this.cerrarRafaga(ex);
    this.ev('visibilidad', null, { visible });
    if (visible) this.actividad();
  }
  foco(enfocado: boolean) { this.ev('foco', null, { visible: enfocado }); }
  conexion(enLinea: boolean) { this.ev('conexion', null, { en_linea: enLinea }); }

  /** Cualquier señal de actividad (puntero, tecla, desplazamiento): solo marca que hay actividad, sin contenido. */
  actividad() {
    const t = this.cola.ahora();
    if (this.inactivo) {
      this.inactivo = false;
      this.ev('inactividad', null, { estado: 'fin', duracion_ms: t - this.ultimaActividad });
    }
    this.ultimaActividad = t;
  }

  /** Llamar cada segundo: cierra ráfagas terminadas y detecta inactividad. */
  tick() {
    const t = this.cola.ahora();
    for (const [ex, s] of this.items) if (s.rafaga && t - s.rafaga.ultimo > this.cfg.rafagaMs) this.cerrarRafaga(ex);
    if (!this.inactivo && this.visiblePagina && t - this.ultimaActividad > this.cfg.inactividadMs) {
      this.inactivo = true;
      this.ev('inactividad', null, { estado: 'inicio', desde_ms: this.ultimaActividad });
    }
  }

  salida() {
    for (const ex of this.items.keys()) this.cerrarRafaga(ex);
    this.ev('salida');
    this.cola.persistir();
  }
}
