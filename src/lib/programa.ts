/**
 * Programa académico con seguimiento de lo impartido (migración 71). Tipos y funciones puras compartidas por el
 * panel docente, la vista del estudiante y Orbe Control.
 *
 * Tres estados distintos de cada subtema, que nunca se confunden:
 *  · previsto   — forma parte del programa;
 *  · impartido  — el profesor lo marcó como dado en la sección del estudiante (con fecha);
 *  · disponible — el material del capítulo está publicado para estudiar.
 * Abrir o leer una página NO es dominar un tema: la lectura se muestra como tiempo de estudio, nunca como nota.
 */
import type { NivelSubtema } from '@/api/tipos';

export const NIVELES: Record<NivelSubtema, { etiqueta: string; tono: 'blue' | 'purple' | 'gray'; descripcion: string }> = {
  esencial: { etiqueta: 'Esencial', tono: 'blue', descripcion: 'Lo que debe dominar.' },
  complementario: { etiqueta: 'Complementario', tono: 'purple', descripcion: 'Amplía la comprensión.' },
  profundizacion: { etiqueta: 'Profundización', tono: 'gray', descripcion: 'Opcional, para quien quiera ir más allá.' },
};
export const ORDEN_NIVEL: NivelSubtema[] = ['esencial', 'complementario', 'profundizacion'];

// ---------- vista del estudiante (programa_mio)
export interface SubtemaMio { id: string; nombre: string; nivel: NivelSubtema; descripcion: string; impartido: string[] }
export interface EnlaceMio {
  tipo: TipoEnlace; titulo: string; descripcion: string; url: string | null; sim_key: string | null;
  activity_id: string | null; exercise_id: string | null; session_id: string | null; concept_id: string | null;
}
export interface CapituloMio {
  id: string; titulo: string; resumen: string; position: number; disponible: boolean;
  subtemas: SubtemaMio[]; clases: { id: string; fecha: string; titulo: string }[]; enlaces: EnlaceMio[];
  practicas: { id: string; titulo: string; modo: 'practice' | 'exam' }[]; minutos: number;
}
export interface UnidadMia { id: string; titulo: string; resumen: string; position: number; estado: string; capitulos: CapituloMio[] }
export interface ProgramaMio { unidades: UnidadMia[] }

// ---------- vista del profesor (programa_seccion)
export interface Cobertura { id: string; fecha: string; session_id: string | null; sesion: string | null; nota: string | null }
export interface SubtemaSeccion { id: string; nombre: string; nivel: NivelSubtema; oculto: boolean; position: number; impartido: Cobertura[] }
export interface CapituloSeccion {
  id: string; titulo: string; position: number; oculto: boolean; subtemas: SubtemaSeccion[];
  enlaces: number; notas: number; lectores: number; minutos: number;
}
export interface UnidadSeccion { id: string; titulo: string; position: number; estado: string; oculta: boolean; capitulos: CapituloSeccion[] }
export interface ProgramaSeccion {
  class_id: string; course_id: string; programa: boolean; estudiantes: number;
  sesiones: { id: string; fecha: string; titulo: string }[]; unidades: UnidadSeccion[];
}

export type TipoEnlace = 'actividad' | 'ejercicio' | 'simulador' | 'clase' | 'pdf' | 'video' | 'imagen' | 'enlace';
export const TIPOS_ENLACE: Record<TipoEnlace, { etiqueta: string; icono: string }> = {
  actividad: { etiqueta: 'Práctica o evaluación', icono: '📝' }, ejercicio: { etiqueta: 'Ejercicio del banco', icono: '✏️' },
  simulador: { etiqueta: 'Simulador', icono: '🧪' }, clase: { etiqueta: 'Clase impartida', icono: '🧑‍🏫' },
  pdf: { etiqueta: 'PDF', icono: '📄' }, video: { etiqueta: 'Vídeo', icono: '🎬' }, imagen: { etiqueta: 'Imagen', icono: '🖼️' }, enlace: { etiqueta: 'Enlace', icono: '🔗' },
};

/** Avance: subtemas impartidos (con al menos una fecha) sobre el total, por nivel; el ESENCIAL es el que cuenta. */
export interface Avance { impartidos: number; total: number; esencialesImpartidos: number; esenciales: number }

export function avanceSubtemas(subtemas: { nivel: NivelSubtema; impartido: unknown[]; oculto?: boolean }[]): Avance {
  const vis = subtemas.filter((s) => !s.oculto);
  const es = vis.filter((s) => s.nivel === 'esencial');
  return {
    impartidos: vis.filter((s) => s.impartido.length > 0).length, total: vis.length,
    esencialesImpartidos: es.filter((s) => s.impartido.length > 0).length, esenciales: es.length,
  };
}

export function sumarAvances(xs: Avance[]): Avance {
  return xs.reduce((a, b) => ({
    impartidos: a.impartidos + b.impartidos, total: a.total + b.total,
    esencialesImpartidos: a.esencialesImpartidos + b.esencialesImpartidos, esenciales: a.esenciales + b.esenciales,
  }), { impartidos: 0, total: 0, esencialesImpartidos: 0, esenciales: 0 });
}

export const fraccion = (n: number, d: number) => (d > 0 ? n / d : 0);

/** Estado del capítulo para el estudiante: lo previsto, lo impartido y lo disponible, en una frase. */
export function estadoCapitulo(c: Pick<CapituloMio, 'disponible' | 'subtemas'>): { etiqueta: string; tono: 'gray' | 'amber' | 'green' | 'blue' } {
  const a = avanceSubtemas(c.subtemas);
  const impartido = a.impartidos === 0 ? 'previsto' : a.impartidos === a.total ? 'impartido' : 'en curso';
  if (impartido === 'previsto') return { etiqueta: c.disponible ? 'Previsto · material disponible' : 'Previsto', tono: c.disponible ? 'blue' : 'gray' };
  if (impartido === 'en curso') return { etiqueta: `Impartido en parte (${a.impartidos}/${a.total})${c.disponible ? ' · material disponible' : ''}`, tono: 'amber' };
  return { etiqueta: c.disponible ? 'Impartido · material disponible' : 'Impartido', tono: 'green' };
}

/** Fechas legibles de un subtema impartido (sin repetir y en orden). */
export function fechasImpartido(fechas: string[]): string {
  return [...new Set(fechas)].sort().map((f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })).join(', ');
}

/** Valida una URL de material: solo https (lo exige también la base de datos). */
export function urlValida(u: string): boolean {
  return /^https:\/\/[^\s<>"]+$/.test(u.trim()) && u.trim().length <= 1000;
}

/** Fecha de hoy en Santo Domingo (AAAA-MM-DD), para marcar lo impartido. */
export function hoySantoDomingo(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
