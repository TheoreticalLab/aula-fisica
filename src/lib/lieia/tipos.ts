/**
 * LIEIA · Estructura común de un examen observado. La producen tanto el simulador (laboratorio, con verdad
 * conocida) como la consulta de datos reales (lieia_exam_data), para que los detectores sean exactamente los mismos.
 */
export type RolItem = 'normal' | 'ancla' | 'isomorfa' | 'conceptual' | 'razonamiento';

export interface ItemExamen {
  id: string;
  opciones: number | null; // nº de opciones si es de selección; null si es abierta/numérica
  orden: number;           // posición en el examen (diseño base)
  rol?: RolItem;           // papel en el diseño experimental
  grupo?: string | null;   // grupo isomorfo (versiones equivalentes del mismo problema)
}

export interface RespuestaObservada {
  respuesta: string | null;  // ficha opaca de la respuesta (igualdad = misma respuesta); null = sin responder
  correcta: boolean | null;
  t: number | null;          // segundos desde el inicio común del examen hasta la última respuesta a este ítem
  primera: number | null;    // segundos hasta la primera respuesta a este ítem (si se registró)
  cambios: number;           // nº de respuestas registradas para el ítem
}

export interface EstudianteExamen {
  id: string;      // seudónimo (E01…), nunca el nombre
  inicio: number;  // segundos desde el inicio común hasta que empezó su intento
  fin: number | null;
  oculto: number;  // segundos con la pestaña del aula oculta durante el intento (si se registró)
}

export interface ExamenObservado {
  items: ItemExamen[];
  estudiantes: EstudianteExamen[];
  r: RespuestaObservada[][]; // r[estudiante][ítem]
  /** ¿Hay tiempo por ítem registrado (instrumentación)? Sin él, los detectores temporales se abstienen. */
  conTiempos: boolean;
}

/** Verdad conocida de un escenario simulado (solo en el laboratorio). */
export interface Verdad {
  parejas: Set<string>;       // claves «i-j» (i<j) con dependencia DIRECTA (uno copia del otro)
  indirectas: Set<string>;    // dependientes a través de una fuente común (dos receptores de la misma red)
  causaComun: Set<string>;    // dependientes por causa común legítima (misma confusión), sin copia
  asistidos: Set<number>;     // estudiantes con asistencia externa (IA u otra)
  receptores: Set<number>;    // estudiantes que copian de otro (reciben ayuda de un compañero)
  centro: number | null;      // fuente central de una red, si existe
}

export const clavePareja = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`);
