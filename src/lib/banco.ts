/**
 * Banco de ejercicios: metadatos pedagógicos (sin respuestas), filtros del panel docente y resúmenes de rendimiento.
 * Lógica pura, compartida por la biblioteca (scripts/biblioteca) y la interfaz (src/pages/docente/Banco.tsx).
 */

/** Los 10 tipos de pregunta del banco (independientes del formato de respuesta). */
export const TIPOS_PREGUNTA = {
  calculo: 'Cálculo numérico con unidades',
  conceptual: 'Selección múltiple conceptual',
  afirmacion_incorrecta: 'Identificación de afirmaciones físicamente incorrectas',
  grafica: 'Análisis de gráficas',
  simulacion: 'Interpretación de simulaciones',
  encadenada: 'Problema con varias respuestas encadenadas',
  prediccion: 'Predicción antes de ejecutar una simulación',
  esperado_observado: 'Diferencia entre resultado esperado y observado',
  info_insuficiente: 'Identificación de información insuficiente',
  dimensional: 'Verificación dimensional de una respuesta',
} as const;
export type TipoPregunta = keyof typeof TIPOS_PREGUNTA;

/** Familias de problemas integradores (Unidad 9). */
export const FAMILIAS = {
  A: 'Choque totalmente inelástico y frenado por fricción',
  B: 'Choque inelástico y recorrido de una distancia conocida',
  C: 'Choque y plano inclinado',
  D: 'Choque seguido de caída',
  E: 'Colisiones con sentidos opuestos',
  F: 'Choque elástico y movimiento posterior',
  G: 'Pelota que rebota contra el suelo',
  H: 'Choque y energía almacenada en un resorte',
  I: 'Choques sucesivos',
  J: 'Problemas inversos',
  K: 'Choque y sonido',
  L: 'Colisiones bidimensionales',
} as const;
export type Familia = keyof typeof FAMILIAS;

export const TIPOS_CHOQUE = {
  elastico: 'Elástico',
  totalmente_inelastico: 'Totalmente inelástico',
  parcialmente_inelastico: 'Parcialmente inelástico',
  rebote: 'Rebote',
  general: 'General / varios',
  ninguno: 'Sin choque concreto',
} as const;
export type TipoChoque = keyof typeof TIPOS_CHOQUE;

/** Parámetro modificable de un ejercicio parametrizable: rango físicamente válido. */
export interface ParametroBanco { nombre: string; unidad: string; min: number; max: number; valor: number }

/** Metadatos del banco. NO contienen la respuesta; solo los lee el profesorado (tabla exercise_bank_meta). */
export interface MetaBanco {
  /** Tema principal, en una frase. */
  tema: string;
  /** Conceptos previos necesarios: slugs de conceptos de unidades anteriores o de esta unidad. */
  previos: string[];
  /** Datos explícitos del enunciado («m₁ = 2.0 kg», «μk = 0.25»…). */
  datos: string[];
  /** Magnitudes que se piden. */
  solicitado: string[];
  tipo: TipoPregunta;
  choque: TipoChoque;
  /** Etapas de razonamiento físico distintas (1 = directo). */
  etapas: number;
  friccion: boolean;
  energia: boolean;
  cinematica: boolean;
  plano: boolean;
  familia?: Familia;
  /** Unidades anteriores cuyo contenido se aplica (p. ej. [4, 5]). */
  unidadesPrevias?: number[];
  /** Validación dimensional de la respuesta (obligatoria en numéricos), p. ej. «kg·(m/s) = kg·m/s». */
  dimensional?: string;
  /** Problema por etapas: los ejercicios con el mismo `id` forman una cadena; `etapa` empieza en 1. */
  problema?: { id: string; etapa: number; total: number; titulo?: string };
  /** Parámetros modificables y semilla con que se generó la versión instalada (reproducible). */
  parametros?: ParametroBanco[];
  semilla?: number;
  /** Los añade el instalador. */
  unidad?: string;
  leccion?: string;
}

export interface FiltrosBanco {
  tipo?: string;
  choque?: string;
  familia?: string;
  /** '1', '2' o '3+' */
  etapas?: string;
  previo?: string;
  friccion?: boolean;
  energia?: boolean;
  cinematica?: boolean;
  plano?: boolean;
}

export function cumpleFiltros(m: MetaBanco | undefined, f: FiltrosBanco): boolean {
  const activos = f.tipo || f.choque || f.familia || f.etapas || f.previo || f.friccion || f.energia || f.cinematica || f.plano;
  if (!activos) return true;
  if (!m) return false;
  if (f.tipo && m.tipo !== f.tipo) return false;
  if (f.choque && m.choque !== f.choque) return false;
  if (f.familia && m.familia !== f.familia) return false;
  if (f.etapas === '1' && m.etapas !== 1) return false;
  if (f.etapas === '2' && m.etapas !== 2) return false;
  if (f.etapas === '3+' && m.etapas < 3) return false;
  if (f.previo && !m.previos.includes(f.previo)) return false;
  if (f.friccion && !m.friccion) return false;
  if (f.energia && !m.energia) return false;
  if (f.cinematica && !m.cinematica) return false;
  if (f.plano && !m.plano) return false;
  return true;
}

export interface RendimientoEjercicio {
  exercise_id: string;
  respuestas: number;
  correctas: number;
  primer_intento: number;
  intentos_promedio: number | null;
  errores: Record<string, number>;
}

export interface FilaResumen { clave: string; ejercicios: number; respuestas: number; correctas: number; tasa: number | null }

/**
 * Rendimiento agrupado por una propiedad de los metadatos (tipo de pregunta, tipo de choque, familia…) o, con
 * `porPrevio`, por cada concepto previo: un ejercicio cuenta en todos sus conceptos previos. Ordenado de menor a
 * mayor tasa de acierto (las dificultades recurrentes primero); los grupos sin respuestas van al final.
 */
export function resumenRendimiento(
  meta: Map<string, MetaBanco>, rend: RendimientoEjercicio[], clave: (m: MetaBanco) => string | string[] | undefined,
): FilaResumen[] {
  const porId = new Map(rend.map((r) => [r.exercise_id, r]));
  const grupos = new Map<string, FilaResumen>();
  for (const [id, m] of meta) {
    const ks = clave(m);
    for (const k of (Array.isArray(ks) ? ks : ks ? [ks] : [])) {
      const g = grupos.get(k) ?? { clave: k, ejercicios: 0, respuestas: 0, correctas: 0, tasa: null };
      const r = porId.get(id);
      g.ejercicios += 1;
      g.respuestas += r?.respuestas ?? 0;
      g.correctas += r?.correctas ?? 0;
      grupos.set(k, g);
    }
  }
  const filas = [...grupos.values()].map((g) => ({ ...g, tasa: g.respuestas ? g.correctas / g.respuestas : null }));
  return filas.sort((a, b) => (a.tasa ?? 2) - (b.tasa ?? 2) || b.respuestas - a.respuestas || a.clave.localeCompare(b.clave));
}

/** Error más frecuente de un ejercicio (código del motor), para orientar la revisión. */
export function errorPrincipal(r: RendimientoEjercicio | undefined): string | null {
  if (!r) return null;
  const e = Object.entries(r.errores ?? {}).sort((a, b) => b[1] - a[1])[0];
  return e ? e[0] : null;
}

export const CODIGOS_ERROR: Record<string, string> = {
  common_error: 'error típico previsto',
  sign: 'signo',
  unit_mismatch: 'unidades',
  wrong_value: 'valor',
  factor: 'factor numérico',
  blank: 'sin respuesta',
  arrastre: 'arrastre de una etapa anterior',
};
