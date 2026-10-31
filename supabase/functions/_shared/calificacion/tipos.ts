/**
 * Tipos compartidos por el motor de calificación (Edge Function), el frontend y la semilla.
 * Este módulo no tiene dependencias para poder ejecutarse en Deno y en el navegador.
 */

export type AnswerFormat = 'choice' | 'truefalse' | 'numeric' | 'text' | 'open';

export interface ChoiceKey {
  format: 'choice';
  /** Índices (desde 0) de las opciones correctas. */
  correct: number[];
  /** Retroalimentación específica para opciones incorrectas, por índice. */
  optionFeedback?: Record<number, string>;
}

export interface TrueFalseKey {
  format: 'truefalse';
  value: boolean;
  /** Justificación modelo que verá el estudiante cuando se revele la solución. */
  modelJustification: string;
}

export interface NumericKey {
  format: 'numeric';
  /** Valor con unidad, p. ej. '20 m/s', '-4.9 m', '3.0e8 m/s', '35 °' o '0.25' (adimensional). */
  value: string;
  /** Tolerancia relativa (por defecto 0.02 = 2 %). */
  relTol?: number;
  /** Tolerancia absoluta en unidades SI (útil cuando el valor esperado es 0). */
  absTol?: number;
  /** Cifras significativas esperadas, si se evalúan. */
  sigFigs?: number;
  /** Si es true, un número de cifras distinto resta crédito; si no, solo se advierte. */
  strictSigFigs?: boolean;
  /** Por defecto true cuando el valor lleva unidad (salvo grados y porcentajes). */
  unitRequired?: boolean;
  /** Las temperaturas en °C/°F se interpretan como diferencias (sin desplazamiento). */
  temperatureInterval?: boolean;
  /** Exige expresar el resultado en esta unidad (p. ej. 'm/s' en una pregunta de conversión). */
  expectUnit?: string;
  /** Otras respuestas equivalentes aceptadas como correctas. */
  alternatives?: string[];
  /** Respuestas erróneas típicas con un mensaje que explica el error. */
  commonErrors?: { value: string; message: string }[];
  /**
   * Mayúsculas en las unidades cuando lo escrito no es ninguna unidad (p. ej. «10290 j»):
   *  · 'pedagogica' (por defecto): se lee como la única unidad con las dimensiones pedidas («J») y se califica, con
   *    un aviso de que el símbolo SI correcto es otro. Si hay más de una lectura (p. ej. «mj»: mJ o MJ), se rechaza.
   *  · 'estricta': se rechaza como error de formato, sugiriendo la escritura correcta.
   * Nunca convierte una unidad válida en otra, ni acepta dimensiones distintas de las de la pregunta.
   */
  unitCase?: 'pedagogica' | 'estricta';
  /**
   * Arrastre de errores en problemas por etapas: si la respuesta no coincide con la clave pero sí con el valor que
   * se obtiene a partir de la respuesta del MISMO estudiante en una etapa anterior (`desde`, slug del ejercicio),
   * se califica como correcta con un aviso, para no penalizar dos veces el mismo error.
   * `expresion` usa `x` (valor SI de la etapa anterior), números, + − * / ^, paréntesis y sqrt/abs; da un valor SI.
   */
  arrastre?: { desde: string; expresion: string };
}

export interface TextKey {
  format: 'text';
  /** Respuestas aceptadas (se comparan sin mayúsculas, tildes ni signos de puntuación). */
  accepted: string[];
}

export interface OpenKey {
  format: 'open';
  /** Criterios para la revisión manual del profesor. */
  rubric: string;
}

export type AnswerKey = ChoiceKey | TrueFalseKey | NumericKey | TextKey | OpenKey;

/** Respuesta enviada por el estudiante (columna responses.answer). */
export interface StudentAnswer {
  selected?: number[]; // choice
  value?: boolean; // truefalse
  justification?: string; // truefalse
  text?: string; // numeric, text, open
}

export type GradeStatus = 'correct' | 'partial' | 'incorrect' | 'invalid' | 'pending_review';

export interface GradeResult {
  status: GradeStatus;
  /** Fracción del puntaje, entre 0 y 1. */
  credit: number;
  /** Mensajes para el estudiante (diagnóstico del error, advertencias). Nunca contienen la respuesta correcta. */
  messages: string[];
  /** Código breve del diagnóstico para estadísticas: 'ok', 'unit_mismatch', 'sign', 'common_error', ... */
  code: string;
  /** Cómo se interpretó la respuesta (p. ej. «20 m/s = 20 m/s en SI»). */
  interpreted?: string;
}

export const MAX_TEXT_LENGTH = 5000;
