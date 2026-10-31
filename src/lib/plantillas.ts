/**
 * Asistente «+ Crear actividad»: plantillas y construcción de la actividad (lógica pura, probada).
 * Una plantilla fija valores sensatos; el profesor solo cambia lo que quiera. Las reglas de la base de datos
 * (p. ej. en una evaluación no hay solución inmediata ni pistas) se cumplen siempre aquí, antes de enviar nada.
 */
import type { Activity, Mode, RevealPolicy } from '@/api/tipos';
import type { ConfigExamen } from '@/lib/examen/motor';

export type IdPlantilla = 'practica_libre' | 'tarea' | 'quiz' | 'parcial' | 'estricto' | 'blanco_practica' | 'blanco_examen';

export interface Plantilla {
  id: IdPlantilla;
  icono: string;
  titulo: string;
  descripcion: string;
  mode: Mode;
  reveal_policy: RevealPolicy;
  max_attempts: number | null;
  max_tries_per_item: number;
  hints_enabled: boolean;
  dias_cierre: number | null;            // cierre sugerido a N días (null = sin cierre)
  examen: ConfigExamen | null;
  preguntas_sugeridas: number;
}

const sinPausas = { permitidas: false, max_numero: 0, max_total_s: 0, detienen_reloj: false };

export const PLANTILLAS: Plantilla[] = [
  { id: 'practica_libre', icono: '🧩', titulo: 'Práctica libre', descripcion: 'Para aprender: ve si acierta al comprobar, con pistas y varios intentos.',
    mode: 'practice', reveal_policy: 'immediate', max_attempts: null, max_tries_per_item: 3, hints_enabled: true, dias_cierre: null, examen: null, preguntas_sugeridas: 8 },
  { id: 'tarea', icono: '📅', titulo: 'Tarea con fecha', descripcion: 'Práctica con fecha de entrega; las soluciones se muestran al cerrar.',
    mode: 'practice', reveal_policy: 'after_close', max_attempts: 1, max_tries_per_item: 2, hints_enabled: true, dias_cierre: 7, examen: null, preguntas_sugeridas: 6 },
  { id: 'quiz', icono: '⚡', titulo: 'Quiz rápido', descripcion: 'Evaluación corta: una pregunta a la vez, 15 minutos, un intento.',
    mode: 'exam', reveal_policy: 'after_submit', max_attempts: 1, max_tries_per_item: 1, hints_enabled: false, dias_cierre: 1,
    examen: { presentacion: 'una_a_la_vez', navegacion: 'libre', duracion_s: 900, pausas: sinPausas }, preguntas_sugeridas: 5 },
  { id: 'parcial', icono: '📝', titulo: 'Examen parcial', descripcion: '60 minutos, una pregunta a la vez, navegación libre y una pausa de 5 minutos.',
    mode: 'exam', reveal_policy: 'after_close', max_attempts: 1, max_tries_per_item: 1, hints_enabled: false, dias_cierre: 1,
    examen: { presentacion: 'una_a_la_vez', navegacion: 'libre', duracion_s: 3600, pausas: { permitidas: true, max_numero: 1, max_total_s: 300, detienen_reloj: true } }, preguntas_sugeridas: 10 },
  { id: 'estricto', icono: '🔒', titulo: 'Examen estricto', descripcion: 'Solo hacia adelante, sin pausas, 45 minutos.',
    mode: 'exam', reveal_policy: 'after_close', max_attempts: 1, max_tries_per_item: 1, hints_enabled: false, dias_cierre: 1,
    examen: { presentacion: 'una_a_la_vez', navegacion: 'solo_adelante', duracion_s: 2700, pausas: sinPausas }, preguntas_sugeridas: 10 },
  { id: 'blanco_practica', icono: '📄', titulo: 'Práctica en blanco', descripcion: 'Empiece de cero y configure todo usted.',
    mode: 'practice', reveal_policy: 'immediate', max_attempts: null, max_tries_per_item: 3, hints_enabled: true, dias_cierre: null, examen: null, preguntas_sugeridas: 0 },
  { id: 'blanco_examen', icono: '📄', titulo: 'Evaluación en blanco', descripcion: 'Evaluación sin valores sugeridos (todas las preguntas en una página).',
    mode: 'exam', reveal_policy: 'after_submit', max_attempts: 1, max_tries_per_item: 1, hints_enabled: false, dias_cierre: null, examen: null, preguntas_sugeridas: 0 },
];

export const plantilla = (id: IdPlantilla) => PLANTILLAS.find((p) => p.id === id)!;

/** Lo que el profesor elige en el asistente. */
export interface Borrador {
  plantilla: IdPlantilla;
  titulo: string;
  instrucciones: string;
  mode: Mode;
  opens_at: string | null;               // ISO
  closes_at: string | null;
  max_attempts: number | null;
  max_tries_per_item: number;
  reveal_policy: RevealPolicy;
  hints_enabled: boolean;
  examen: ConfigExamen | null;
  preguntas: { exercise_id: string; points: number | null }[];
  publicar: boolean;
}

export function borradorDesde(id: IdPlantilla, ahora: Date): Borrador {
  const p = plantilla(id);
  const cierre = p.dias_cierre === null ? null : new Date(ahora.getTime() + p.dias_cierre * 86_400_000);
  if (cierre) cierre.setHours(23, 59, 0, 0);
  return {
    plantilla: id, titulo: '', instrucciones: '', mode: p.mode, opens_at: null, closes_at: cierre ? cierre.toISOString() : null,
    max_attempts: p.max_attempts, max_tries_per_item: p.max_tries_per_item, reveal_policy: p.reveal_policy, hints_enabled: p.hints_enabled,
    examen: p.examen ? structuredClone(p.examen) : null, preguntas: [], publicar: false,
  };
}

/** Problemas que impiden crear (errores) o que conviene revisar (avisos). */
export function revisar(b: Borrador): { errores: string[]; avisos: string[] } {
  const errores: string[] = [], avisos: string[] = [];
  if (!b.titulo.trim()) errores.push('Escriba un título.');
  if (b.titulo.length > 160) errores.push('El título es demasiado largo (máximo 160 caracteres).');
  if (b.opens_at && b.closes_at && new Date(b.closes_at) <= new Date(b.opens_at)) errores.push('El cierre debe ser posterior a la apertura.');
  if (b.reveal_policy === 'after_close' && !b.closes_at) errores.push('Para mostrar las soluciones «al cerrar» hace falta una fecha de cierre.');
  if (b.mode === 'exam' && b.reveal_policy === 'immediate') errores.push('En una evaluación no se puede mostrar la solución de inmediato.');
  if (b.max_attempts !== null && (b.max_attempts < 1 || b.max_attempts > 50)) errores.push('Los intentos deben estar entre 1 y 50.');
  if (b.max_tries_per_item < 1 || b.max_tries_per_item > 20) errores.push('Las comprobaciones por ejercicio deben estar entre 1 y 20.');
  if (b.examen?.duracion_s !== null && b.examen?.duracion_s !== undefined && (b.examen.duracion_s < 60 || b.examen.duracion_s > 21600)) errores.push('La duración debe estar entre 1 minuto y 6 horas.');
  if (b.examen?.pausas.detienen_reloj && !b.examen.duracion_s) errores.push('«La pausa detiene el reloj» requiere una duración.');
  if (!b.preguntas.length) (b.publicar ? errores : avisos).push(b.publicar ? 'Para publicar, añada al menos una pregunta.' : 'Todavía no tiene preguntas: puede añadirlas después.');
  if (b.publicar && b.closes_at && new Date(b.closes_at) <= new Date()) avisos.push('La fecha de cierre ya pasó: los estudiantes no podrán responder.');
  if (b.mode === 'exam' && b.examen?.duracion_s && b.preguntas.length && b.examen.duracion_s / b.preguntas.length < 60) avisos.push('Queda menos de un minuto por pregunta.');
  return { errores, avisos };
}

/** Fila para la tabla activities (cumple las restricciones de la base de datos). */
export function aActividad(b: Borrador, class_id: string): Partial<Activity> & { class_id: string; title: string } {
  const exam = b.mode === 'exam';
  return {
    class_id, title: b.titulo.trim(), instructions: b.instrucciones.trim(), mode: b.mode,
    opens_at: b.opens_at, closes_at: b.closes_at,
    max_attempts: b.max_attempts, max_tries_per_item: exam ? 1 : b.max_tries_per_item,
    reveal_policy: exam && b.reveal_policy === 'immediate' ? 'after_submit' : b.reveal_policy,
    hints_enabled: exam ? false : b.hints_enabled,
    published: b.publicar,
  };
}

/** Resumen en lenguaje llano para el último paso. */
export function resumen(b: Borrador): string[] {
  const f = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : null);
  const l: string[] = [];
  l.push(`${b.mode === 'exam' ? 'Evaluación calificable' : 'Práctica de aprendizaje'} con ${b.preguntas.length} pregunta(s).`);
  l.push(b.opens_at || b.closes_at ? `Disponible ${b.opens_at ? `desde el ${f(b.opens_at)}` : 'desde que la publique'}${b.closes_at ? ` hasta el ${f(b.closes_at)}` : ', sin fecha de cierre'}.` : 'Disponible desde que la publique, sin fecha de cierre.');
  l.push(b.max_attempts === null ? 'Intentos ilimitados.' : `${b.max_attempts} intento(s).`);
  if (b.mode === 'exam' && b.examen) {
    l.push(`Una pregunta a la vez, navegación ${b.examen.navegacion === 'libre' ? 'libre' : 'solo hacia adelante'}${b.examen.duracion_s ? `, ${Math.round(b.examen.duracion_s / 60)} minutos` : ', sin límite de tiempo'}.`);
    l.push(b.examen.pausas.permitidas ? `${b.examen.pausas.max_numero} pausa(s), ${Math.round(b.examen.pausas.max_total_s / 60)} min en total${b.examen.pausas.detienen_reloj ? ' (detienen el reloj)' : ''}.` : 'Sin pausas.');
  } else if (b.mode === 'exam') l.push('Todas las preguntas en una página.');
  else l.push(`${b.max_tries_per_item} comprobación(es) por ejercicio${b.hints_enabled ? ', con pistas' : ''}.`);
  l.push({ immediate: 'Ve si acierta y la solución al comprobar.', after_submit: 'Ve las soluciones al entregar.', after_close: 'Ve las soluciones cuando cierre la actividad.', never: 'No se muestran las soluciones.' }[b.reveal_policy]);
  l.push(b.publicar ? 'Se publica ahora: los estudiantes la verán.' : 'Se guarda como borrador: los estudiantes no la ven hasta que la publique.');
  return l;
}
