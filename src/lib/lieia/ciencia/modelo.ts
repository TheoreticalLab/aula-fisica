/**
 * LIEIA · Laboratorio científico — modelo multidimensional (capa A, determinista).
 *
 * Cinco dimensiones independientes por pregunta (no excluyentes):
 *   1. naturaleza cognitiva (varias etiquetas)   2. propiedades psicométricas   3. función experimental (según el diseño)
 *   4. relaciones entre preguntas (grafo)        5. función dentro del examen
 * Toda afirmación lleva su PROCEDENCIA: «a_priori» (del contenido), «empirica» (de respuestas reales) o «simulada».
 * La confianza es CUALITATIVA (alta / media / baja) porque no hay una calibración estadística de la confianza.
 */
import type { MetaBanco } from '@/lib/banco';

export type Procedencia = 'a_priori' | 'empirica' | 'simulada';
export type Confianza = 'alta' | 'media' | 'baja';

export interface Evidencia<T> { valor: T; procedencia: Procedencia; confianza: Confianza; evidencia: string; alternativas?: T[] }

export const COGNITIVAS = {
  memorizacion: 'Memorización', comprension_conceptual: 'Comprensión conceptual', aplicacion_directa: 'Aplicación directa',
  razonamiento_matematico: 'Razonamiento matemático', razonamiento_fisico: 'Razonamiento físico', interpretacion: 'Interpretación',
  transferencia: 'Transferencia', resolucion_multietapa: 'Resolución multietapa', pensamiento_critico: 'Pensamiento crítico',
  modelizacion: 'Modelización', deteccion_contradicciones: 'Detección de contradicciones', estimacion: 'Estimación',
  analisis_dimensional: 'Análisis dimensional', interpretacion_graficas: 'Interpretación de gráficas',
  comprension_supuestos: 'Comprensión de supuestos', deduccion_logica: 'Deducción lógica',
} as const;
export type Cognitiva = keyof typeof COGNITIVAS;

export const FUNCIONES_EXAMEN = {
  introductoria: 'Introductoria', intermedia: 'Dificultad intermedia', alta_exigencia: 'Alta exigencia', enlace: 'Enlace entre temas',
  calibracion: 'Calibración', dominio: 'Estimación de dominio',
} as const;
export type FuncionExamen = keyof typeof FUNCIONES_EXAMEN;

export const FUNCIONES_EXPERIMENTALES = {
  ancla: 'Ancla', control: 'Control', diagnostico: 'Diagnóstico', exploratoria: 'Exploratoria', comparacion: 'Comparación',
  transferencia: 'Transferencia', verificacion_conceptual: 'Verificación conceptual', medicion: 'Medición de habilidad',
  robustez: 'Robustez', consistencia: 'Consistencia', isomorfa: 'Comparación isomorfa', errores: 'Detección de errores sistemáticos',
} as const;
export type FuncionExperimental = keyof typeof FUNCIONES_EXPERIMENTALES;

export const RELACIONES = {
  isomorfismo: 'Isomorfismo (misma familia o parámetros)', mismo_metodo: 'Mismo método / problema por etapas',
  prerrequisito: 'Prerrequisito (teórico)', conceptual: 'Conceptos compartidos', textual: 'Similitud textual (no implica redundancia)',
  correlacion: 'Correlación empírica (exploratoria)',
} as const;
export type TipoRelacion = keyof typeof RELACIONES;

/** Lo que el laboratorio sabe de una pregunta antes de mirar respuestas. */
export interface Pregunta {
  id: string; posicion: number; prompt: string; format: 'choice' | 'truefalse' | 'numeric' | 'text' | 'open';
  category: string; difficulty: 'basico' | 'intermedio' | 'desafiante'; concepts: string[]; opciones: number | null;
  unit_hint: string | null; meta?: MetaBanco | null; leccion?: string | null; published?: boolean;
}

/** Respuestas reales seudonimizadas (de lieia_exam_data). correcta null = sin calificar (p. ej. abierta pendiente). */
export interface DatosReales {
  items: { exercise_id: string; posicion: number }[];
  estudiantes: { seudonimo: string; inicio: string; fin: string | null; orden?: string[] | null;
    respuestas: { exercise_id: string; ficha: string | null; correcta: boolean | null; primera: string | null; ultima: string | null; cambios: number }[] }[];
  con_tiempos: boolean;
  diseno?: { orden: string; versiones: boolean } | null;
}

/** Umbrales de abstención (documentados en docs/LIEIA_LABORATORIO.md). */
export const MINIMOS = { item: 10, discriminacion: 20, confiabilidad: 20, correlacion: 30, contraste: 10 } as const;
