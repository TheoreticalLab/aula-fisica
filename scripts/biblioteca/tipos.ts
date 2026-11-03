/**
 * Biblioteca académica reutilizable: un mismo contenido que se instala en varias asignaturas.
 * La FUENTE vive en privado/biblioteca/<nombre>/ (incluidas las claves). Este archivo solo define su forma.
 *
 * Estructura obligatoria de cada minicapítulo:
 *   A objetivos · B introducción · C explicación conceptual · D desarrollo matemático · E interpretación
 *   (B–E son secciones «## …» de `teoria`) · F ejemplos resueltos · G errores frecuentes · H preguntas
 *   conceptuales · I ejercicios propuestos (práctica: 3 fáciles, 2 intermedios, 1 difícil) · J autoevaluación
 *   breve · K conexiones con temas anteriores.
 */
import type { ConceptDef, ExerciseDef, ExerciseKeyDef, Formula, LessonSimulation, WorkedExample } from '../../contenido/tipos';

export type EstadoUnidad = 'borrador' | 'preparado' | 'publicado' | 'archivado';

export interface ErrorFrecuente {
  /** La idea equivocada, tal como la diría un estudiante. */
  error: string;
  /** Por qué es incorrecta y cuál es la idea correcta. */
  aclaracion: string;
}

export interface PreguntaConceptual {
  pregunta: string;
  /** Respuesta razonada (se muestra al pedirla; no es una evaluación). */
  respuesta: string;
}

export interface Autoevaluacion {
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
}

// Metadatos del banco de ejercicios (sin respuestas): definidos en src/lib/banco.ts, que también usa el panel docente.
export { FAMILIAS, TIPOS_PREGUNTA } from '../../src/lib/banco';
export type { Familia, MetaBanco, ParametroBanco, TipoChoque, TipoPregunta } from '../../src/lib/banco';
import type { MetaBanco } from '../../src/lib/banco';

/** Ejercicio de la biblioteca: el enunciado, su clave protegida y una comprobación física independiente. */
export interface EjercicioBiblioteca extends Omit<ExerciseDef, 'role'> {
  role?: ExerciseDef['role'];
  clave: ExerciseKeyDef;
  meta?: MetaBanco;
  /**
   * Obligatorio en los numéricos: recalcula el resultado desde los datos del enunciado y lo devuelve EN UNIDADES SI.
   * El validador lo compara con la clave: así se detectan errores aritméticos, de unidades o de signo.
   */
  verificar?: () => number;
  /**
   * En lugar de `verificar`, en las claves con variante por intento: recalcula el resultado EN UNIDADES SI desde los
   * parámetros de cada versión, con fórmulas propias (no con el motor de choques). Se compara en muchas versiones.
   */
  verificarVariante?: (p: Record<string, number>) => number;
}

export interface MiniCapitulo {
  slug: string;
  titulo: string;
  resumen: string;
  /** Práctica integradora de la unidad: estructura más breve y más ejercicios. */
  integradora?: boolean;
  conceptos: ConceptDef[];
  objetivos: string[];
  teoria: string;
  formulas: Formula[];
  ejemplos: WorkedExample[];
  errores: ErrorFrecuente[];
  preguntas: PreguntaConceptual[];
  autoevaluacion: Autoevaluacion[];
  conexiones: string;
  simulacion: LessonSimulation | null;
  ejercicios: EjercicioBiblioteca[];
  /** Asignaturas con programa (curso.programa): aplicaciones físicas o tecnológicas y referencia bibliográfica. */
  aplicaciones?: string[];
  referencia?: string;
}

export interface UnidadBiblioteca {
  slug: string;
  titulo: string;
  resumen: string;
  /** Estado con el que se instala por primera vez (después lo decide el profesor). */
  estadoInicial: EstadoUnidad;
  /** Unidad con banco de ejercicios: todos sus ejercicios deben llevar `meta` completa (se valida). */
  banco?: boolean;
  /**
   * Unidad que esta sustituye (slug): en la primera instalación se hereda su estado en cada asignatura (si estaba
   * publicada, la nueva nace publicada; si no, `estadoInicial`). Evita que los estudiantes se queden sin la unidad
   * al archivar la anterior, sin publicar nada que el profesor no hubiera publicado ya.
   */
  heredaEstadoDe?: string;
}

export interface InstanciaCurso {
  codigo: string;
  titulo: string;
  /** Secciones existentes que deben pasar a esta asignatura (solo si no tienen actividades). */
  secciones?: { nombre: string; desde: string }[];
}

export interface CursoBiblioteca {
  nombre: string;
  presentacion: string;
  objetivos: string[];
  /** Carpetas de las unidades, en orden. */
  unidades: string[];
  /**
   * Slugs de unidades instaladas antes y sustituidas por otras: el instalador las pasa a «archivado» (no las borra;
   * sus lecciones, ejercicios, actividades, intentos y respuestas se conservan intactos).
   */
  archivar?: string[];
  instancias: InstanciaCurso[];
  /**
   * Asignatura con programa académico y seguimiento de lo impartido (migración 71). Cada minicapítulo es un CAPÍTULO
   * del programa y cada concepto un SUBTEMA (con nivel). No exige ejercicios ni práctica integradora: el programa se
   * carga sin evaluaciones y el profesor las añade cuando quiera.
   */
  programa?: boolean;
}

/** Lo que se guarda en lessons.study (y lee la página de la lección). */
export interface EstudioLeccion {
  objetivos: string[];
  errores: ErrorFrecuente[];
  preguntas: PreguntaConceptual[];
  autoevaluacion: Autoevaluacion[];
  conexiones: string;
  integradora?: boolean;
  aplicaciones?: string[];
  referencia?: string;
}
