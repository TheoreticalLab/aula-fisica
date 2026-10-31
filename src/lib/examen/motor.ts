/**
 * Motor de examen · máquina de estados de la sesión (lógica pura, reloj inyectado).
 *
 * Una sola pregunta ACTIVA a la vez. Cada instante de la sesión pertenece a exactamente un intervalo con un tipo:
 *   trabajo           la pregunta activa está visible y el estudiante interactúa (o piensa, dentro del límite de inactividad)
 *   inactividad       pregunta visible sin interacción durante más del umbral (puede ser pensar o estar ausente)
 *   pausa_declarada   el estudiante pulsó «Pausar» (si la configuración lo permite)
 *   oculta            la página dejó de estar visible (otra pestaña, otra aplicación, pantalla apagada)
 *   desconexion       la aplicación no estaba abierta (cerrada, recargada, sin batería) — se sabe al volver
 *   desconocido       tramo sin información fiable (p. ej. entre el último latido y el cierre)
 *   fuera_de_pregunta pantalla de revisión o instrucciones: ninguna pregunta activa
 * Los tiempos están en milisegundos del RELOJ DEL SERVIDOR (reloj local + desfase estimado, ver reloj.ts).
 * La pérdida de RED no cambia el tipo (la aplicación sigue observando); se marca en el intervalo (sin_red).
 */

export type Presentacion = 'una_a_la_vez' | 'todas';
export type Navegacion = 'libre' | 'solo_adelante';

export interface ConfigExamen {
  presentacion: Presentacion;
  navegacion: Navegacion;
  duracion_s: number | null;                 // límite por intento (null = solo el cierre de la actividad)
  pausas: { permitidas: boolean; max_numero: number; max_total_s: number; detienen_reloj: boolean };
}

export const CONFIG_EXAMEN_POR_DEFECTO: ConfigExamen = {
  presentacion: 'una_a_la_vez', navegacion: 'libre', duracion_s: null,
  pausas: { permitidas: false, max_numero: 0, max_total_s: 0, detienen_reloj: false },
};

export type TipoTramo = 'trabajo' | 'inactividad' | 'pausa_declarada' | 'oculta' | 'desconexion' | 'desconocido' | 'fuera_de_pregunta';

export interface Tramo { inicio: number; fin: number; tipo: TipoTramo; exercise_id: string | null; sin_red?: boolean }

export type Fase = 'sin_abrir' | 'trabajando' | 'revision' | 'en_pausa' | 'entregado';

export interface EstadoMotor {
  fase: Fase;
  orden: string[];
  activa: string | null;
  visitadas: string[];
  marcadas: string[];
  pausas: { n: number; total_ms: number; desde: number | null };
  visible: boolean;
  inactivo: boolean;
  en_red: boolean;
  abierto: { inicio: number; tipo: TipoTramo; exercise_id: string | null; sin_red: boolean } | null;
  tramos: Tramo[];            // cerrados (el diario)
  ultimo_latido: number | null;
}

export type Resultado = { ok: true; estado: EstadoMotor } | { ok: false; estado: EstadoMotor; motivo: string };

export function crearMotor(orden: string[]): EstadoMotor {
  return { fase: 'sin_abrir', orden: [...orden], activa: null, visitadas: [], marcadas: [], pausas: { n: 0, total_ms: 0, desde: null },
    visible: true, inactivo: false, en_red: true, abierto: null, tramos: [], ultimo_latido: null };
}

/** Tipo que corresponde al estado actual. */
function tipoActual(e: EstadoMotor): TipoTramo {
  if (e.fase === 'en_pausa') return 'pausa_declarada';
  if (!e.visible) return 'oculta';
  if (e.fase === 'revision' || !e.activa) return 'fuera_de_pregunta';
  return e.inactivo ? 'inactividad' : 'trabajo';
}

/** Cierra el tramo abierto en t y abre uno nuevo según el estado. Ignora tramos de duración nula. */
function retramar(e: EstadoMotor, t: number): EstadoMotor {
  const tramos = [...e.tramos];
  if (e.abierto && t > e.abierto.inicio) tramos.push({ inicio: e.abierto.inicio, fin: t, tipo: e.abierto.tipo, exercise_id: e.abierto.exercise_id, ...(e.abierto.sin_red ? { sin_red: true } : {}) });
  const abierto = e.fase === 'entregado' ? null : { inicio: e.abierto && t <= e.abierto.inicio ? e.abierto.inicio : t, tipo: tipoActual(e), exercise_id: e.fase === 'revision' ? null : e.activa, sin_red: !e.en_red };
  return { ...e, tramos, abierto, ultimo_latido: t };
}

const visitar = (e: EstadoMotor, id: string) => (e.visitadas.includes(id) ? e.visitadas : [...e.visitadas, id]);

/**
 * Abrir o reabrir la sesión en t. Si había un tramo abierto (la aplicación se cerró sin despedirse), se cierra en el
 * último latido conocido, y el resto hasta t se registra como desconexión (con el tramo incierto como «desconocido»).
 */
export function abrir(e: EstadoMotor, t: number, opciones: { activa?: string | null; incertidumbre_ms?: number } = {}): EstadoMotor {
  let x = e;
  if (x.abierto && x.ultimo_latido !== null && t > x.ultimo_latido) {
    const lat = x.ultimo_latido, inc = Math.min(opciones.incertidumbre_ms ?? 0, t - lat);
    const tramos = [...x.tramos];
    if (lat > x.abierto.inicio) tramos.push({ inicio: x.abierto.inicio, fin: lat, tipo: x.abierto.tipo, exercise_id: x.abierto.exercise_id });
    if (inc > 0) tramos.push({ inicio: lat, fin: lat + inc, tipo: 'desconocido', exercise_id: x.abierto.exercise_id });
    if (t > lat + inc) tramos.push({ inicio: lat + inc, fin: t, tipo: 'desconexion', exercise_id: x.abierto.exercise_id });
    x = { ...x, tramos, abierto: null };
  }
  const activa = opciones.activa !== undefined ? opciones.activa : x.activa ?? x.orden[0] ?? null;
  // una pausa declarada sigue vigente al volver (hay que reanudar a propósito)
  const fase: Fase = x.fase === 'en_pausa' ? 'en_pausa' : x.fase === 'revision' ? 'revision' : 'trabajando';
  x = { ...x, fase, activa, visible: true, inactivo: false, visitadas: activa ? visitar(x, activa) : x.visitadas };
  return retramar({ ...x, abierto: null }, t);
}

export function puedeIrA(e: EstadoMotor, id: string, c: ConfigExamen): string | null {
  if (e.fase === 'entregado') return 'El intento ya fue entregado.';
  if (e.fase === 'en_pausa') return 'Reanude el examen para continuar.';
  if (!e.orden.includes(id)) return 'Esa pregunta no pertenece a este examen.';
  if (c.navegacion === 'solo_adelante' && e.activa) {
    const i = e.orden.indexOf(e.activa), j = e.orden.indexOf(id);
    if (j < i || (e.fase === 'revision' && e.visitadas.includes(id))) return 'En este examen no se puede volver a preguntas anteriores.';
  }
  return null;
}

export function irA(e: EstadoMotor, t: number, id: string, c: ConfigExamen): Resultado {
  const no = puedeIrA(e, id, c);
  if (no) return { ok: false, estado: e, motivo: no };
  if (e.activa === id && e.fase === 'trabajando') return { ok: true, estado: e };
  return { ok: true, estado: retramar({ ...e, fase: 'trabajando', activa: id, inactivo: false, visitadas: visitar(e, id) }, t) };
}

export function siguiente(e: EstadoMotor, t: number, c: ConfigExamen): Resultado {
  const i = e.activa ? e.orden.indexOf(e.activa) : -1;
  if (i + 1 >= e.orden.length) return irRevision(e, t, c);
  return irA(e, t, e.orden[i + 1], c);
}

export function anterior(e: EstadoMotor, t: number, c: ConfigExamen): Resultado {
  const i = e.activa ? e.orden.indexOf(e.activa) : 0;
  if (e.fase === 'revision') return e.activa ? irA(e, t, e.activa, c) : { ok: false, estado: e, motivo: 'No hay pregunta anterior.' };
  if (i <= 0) return { ok: false, estado: e, motivo: 'Es la primera pregunta.' };
  return irA(e, t, e.orden[i - 1], c);
}

/** Pantalla de revisión final (ninguna pregunta activa). En «solo adelante» no permite volver a las ya vistas. */
export function irRevision(e: EstadoMotor, t: number, _c: ConfigExamen): Resultado {
  if (e.fase === 'entregado' || e.fase === 'en_pausa') return { ok: false, estado: e, motivo: e.fase === 'en_pausa' ? 'Reanude el examen para continuar.' : 'El intento ya fue entregado.' };
  return { ok: true, estado: retramar({ ...e, fase: 'revision', inactivo: false }, t) };
}

export function marcar(e: EstadoMotor, id: string): EstadoMotor {
  return { ...e, marcadas: e.marcadas.includes(id) ? e.marcadas.filter((x) => x !== id) : [...e.marcadas, id] };
}

export function puedePausar(e: EstadoMotor, c: ConfigExamen): string | null {
  if (!c.pausas.permitidas) return 'Este examen no admite pausas.';
  if (e.fase === 'en_pausa') return 'El examen ya está en pausa.';
  if (e.fase === 'entregado') return 'El intento ya fue entregado.';
  if (e.pausas.n >= c.pausas.max_numero) return `Ya usó las ${c.pausas.max_numero} pausas permitidas.`;
  if (e.pausas.total_ms >= c.pausas.max_total_s * 1000) return 'Ya usó todo el tiempo de pausa permitido.';
  return null;
}

export function pausar(e: EstadoMotor, t: number, c: ConfigExamen): Resultado {
  const no = puedePausar(e, c);
  if (no) return { ok: false, estado: e, motivo: no };
  return { ok: true, estado: retramar({ ...e, fase: 'en_pausa', pausas: { ...e.pausas, n: e.pausas.n + 1, desde: t } }, t) };
}

/** Reanudar. La pausa cuenta hasta t (aunque exceda el máximo: el exceso lo descuenta el reloj oficial del servidor). */
export function reanudar(e: EstadoMotor, t: number): Resultado {
  if (e.fase !== 'en_pausa') return { ok: false, estado: e, motivo: 'El examen no está en pausa.' };
  const dur = Math.max(0, t - (e.pausas.desde ?? t));
  return { ok: true, estado: retramar({ ...e, fase: 'trabajando', inactivo: false, pausas: { n: e.pausas.n, total_ms: e.pausas.total_ms + dur, desde: null } }, t) };
}

export function visibilidad(e: EstadoMotor, t: number, visible: boolean): EstadoMotor {
  if (e.visible === visible || e.fase === 'entregado') return e;
  return retramar({ ...e, visible, inactivo: visible ? false : e.inactivo }, t);
}

export function inactividad(e: EstadoMotor, t: number, inactivo: boolean): EstadoMotor {
  if (e.inactivo === inactivo || e.fase === 'entregado') return e;
  return retramar({ ...e, inactivo }, t);
}

export function red(e: EstadoMotor, t: number, en_red: boolean): EstadoMotor {
  if (e.en_red === en_red || e.fase === 'entregado') return e;
  return retramar({ ...e, en_red }, t);
}

/** Latido periódico: solo actualiza la última hora en que la aplicación estaba viva (para detectar cierres). */
export function latido(e: EstadoMotor, t: number): EstadoMotor {
  return e.fase === 'entregado' ? e : { ...e, ultimo_latido: t };
}

export function entregar(e: EstadoMotor, t: number): EstadoMotor {
  if (e.fase === 'entregado') return e;
  return retramar({ ...e, fase: 'entregado' }, t);
}

/** Tramos cerrados más el abierto hasta t (sin modificar el estado). */
export function tramosHasta(e: EstadoMotor, t: number): Tramo[] {
  if (!e.abierto || t <= e.abierto.inicio) return e.tramos;
  return [...e.tramos, { inicio: e.abierto.inicio, fin: t, tipo: e.abierto.tipo, exercise_id: e.abierto.exercise_id, ...(e.abierto.sin_red ? { sin_red: true } : {}) }];
}
