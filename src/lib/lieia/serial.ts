/** LIEIA · Resultados transferibles entre hilos (postMessage no admite funciones). */
import type { Analisis } from './detectores';
import type { ResultadoExperimento } from './laboratorio';

export const serializarAnalisis = (a: Analisis) => ({ ...a, rasch: { theta: a.rasch.theta, b: a.rasch.b } });
export const serializarExperimento = (r: ResultadoExperimento) => ({ ...r, ejemplo: { ...r.ejemplo, analisis: serializarAnalisis(r.ejemplo.analisis) } });
