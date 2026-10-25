/**
 * Tipos del contenido inicial del curso (fuente de la semilla de la base de datos).
 *
 * Este directorio (contenido/) es PÚBLICO: teoría, fórmulas, ejemplos y enunciados.
 * Las claves de respuesta, pistas y explicaciones viven en privado/claves/ (excluido de git)
 * y solo llegan a la tabla protegida exercise_keys. El frontend nunca importa nada de aquí.
 *
 * Convenciones de redacción:
 *  - Texto en Markdown. Matemáticas con KaTeX: $...$ en línea y $$...$$ en bloque.
 *  - Escribir las cadenas con String.raw`...` para no duplicar las barras invertidas de LaTeX.
 *  - Punto decimal (3.5). Unidades del SI con \,\mathrm{m/s} o \text{ m/s} dentro de LaTeX.
 *  - g = 9.8 m/s² salvo que el enunciado indique otra cosa.
 */

export type Difficulty = 'basico' | 'intermedio' | 'desafiante';

/** Tipo pedagógico del ejercicio (para filtrar y para estadísticas). */
export type ExerciseCategory =
  | 'seleccion' // selección múltiple
  | 'vf_justificacion' // verdadero o falso con justificación
  | 'numerica' // respuesta numérica con unidades
  | 'grafica' // interpretación de gráficas
  | 'conceptual' // pregunta conceptual
  | 'error' // identificación de errores
  | 'desarrollo' // problema desarrollado (revisión manual)
  | 'experimento'; // basado en un experimento virtual

/** Formato de la respuesta: determina el control de entrada y el motor de calificación. */
export type AnswerFormat = 'choice' | 'truefalse' | 'numeric' | 'text' | 'open';

/** Rol dentro de la lección: 'practice' forma el conjunto de práctica; 'reinforcement' se ofrece como refuerzo. */
export type ExerciseRole = 'practice' | 'reinforcement' | 'bank';

export interface FigureSeries {
  name: string;
  points: [number, number][];
}

/** Gráfica x–y que acompaña a un enunciado (se dibuja con Recharts). */
export interface Figure {
  kind: 'line' | 'scatter';
  title?: string;
  x: { label: string; unit?: string };
  y: { label: string; unit?: string };
  series: FigureSeries[];
}

/** Simulación incrustada: `key` debe existir en src/sims/catalogo.ts y `params` usar sus nombres. */
export interface SimulationRef {
  key: string;
  params?: Record<string, number>;
}

export interface ExerciseDef {
  /** Identificador estable y único en todo el curso, p. ej. 'b2-mru-03'. */
  id: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  role: ExerciseRole;
  /** Slugs de conceptos (definidos en alguna lección del curso). */
  concepts: string[];
  prompt: string;
  format: AnswerFormat;
  /** Para 'choice': opciones en Markdown. */
  options?: string[];
  /** 'choice' con varias respuestas correctas ("marque todas las que apliquen"). */
  multiple?: boolean;
  figure?: Figure;
  simulation?: SimulationRef;
  /** Texto de ayuda en el campo numérico, p. ej. 'm/s'. No revela la respuesta. */
  unitHint?: string;
  points?: number;
}

export interface FormulaVariable {
  symbol: string; // LaTeX
  meaning: string;
  unit: string; // texto, p. ej. 'm/s' o '— (adimensional)'
}

export interface Formula {
  name: string;
  latex: string;
  description: string;
  variables: FormulaVariable[];
  notes?: string;
}

export interface WorkedExample {
  title: string;
  statement: string;
  steps: string[];
  result: string;
  interpretation?: string;
}

export interface LessonSimulation {
  key: string;
  params?: Record<string, number>;
  /** Actividad guiada en Markdown: qué cambiar, qué observar, qué anotar. */
  guide: string;
}

export interface ConceptDef {
  slug: string;
  name: string;
}

export interface LessonDef {
  slug: string;
  title: string;
  summary: string;
  concepts: ConceptDef[];
  theory: string;
  formulas: Formula[];
  examples: WorkedExample[];
  simulation: LessonSimulation | null;
  exercises: ExerciseDef[];
}

export interface UnitDef {
  slug: string;
  title: string;
  summary: string;
  /** Bloque anunciado en el temario pero todavía sin lecciones redactadas. */
  comingSoon?: boolean;
  plannedTopics?: string[];
  lessons: LessonDef[];
}

// ---------------------------------------------------------------------------
// Claves (solo en privado/claves/, nunca en archivos públicos)
// ---------------------------------------------------------------------------

export type {
  AnswerKey,
  ChoiceKey,
  NumericKey,
  OpenKey,
  TextKey,
  TrueFalseKey,
} from '../supabase/functions/_shared/calificacion/tipos.ts';
import type { AnswerKey } from '../supabase/functions/_shared/calificacion/tipos.ts';

export interface ExerciseKeyDef {
  answer: AnswerKey;
  /** Pistas progresivas: de la más general a la más concreta, sin dar el resultado final. */
  hints: string[];
  /** Explicación completa de la solución (Markdown + LaTeX). */
  explanation: string;
}

/** Claves de un archivo de lección: id del ejercicio → clave. */
export type KeyMap = Record<string, ExerciseKeyDef>;
