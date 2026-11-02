/**
 * Mapa de dominio para tutorías (migración 68): une, por concepto, lo resuelto en práctica, en evaluaciones (actividades
 * en modo examen: exámenes, quizzes y controles) y en las Prácticas de Control confirmadas. Funciones puras.
 *
 * Son SEÑALES PEDAGÓGICAS para orientar una conversación con el estudiante, no pruebas de uso de IA ni de
 * irregularidades: una diferencia entre práctica y evaluación tiene muchas causas (nervios, tiempo, ayuda de un
 * compañero, una práctica hecha con apuntes…).
 */

export interface Medida { n: number; score: number | null }
export interface ConceptoMapa {
  slug: string; nombre: string; leccion: string | null; leccion_id: string | null;
  practica: Medida; evaluaciones: Medida; general: Medida;
  controles: { n: number; pct: number | null; practica: number | null };
  ultima: string | null;
}
export interface VtaFila {
  controles: number; practica: number | null; supervisado: number | null; brecha: number | null; brecha_ee: number | null;
  competencias_verificadas: number; competencias_pendientes: number;
  senal: 'sin_datos' | 'datos_insuficientes' | 'reforzar_autonomia' | 'coherente' | 'indeterminada';
}
export interface MapaTutoria {
  asignatura: string; seccion: string; estudiante: string | null; conceptos: ConceptoMapa[]; vta: VtaFila | null;
  pendientes_de_confirmar: number; aviso: string;
}

export type EstadoConcepto = 'autonomia' | 'dificultad' | 'por_verificar' | 'en_progreso' | 'consolidado' | 'sin_evidencia';

/** Umbrales: los mismos que el dominio de la ficha (≥ 0,8 dominado; < 0,5 dificultad; mínimo 2 respuestas) y la VTA (control ≥ 0,7 verifica). */
export const UMBRAL = { alto: 0.8, bajo: 0.5, control: 0.7, minimo: 2 } as const;

export const ESTADOS: Record<EstadoConcepto, { etiqueta: string; tono: 'red' | 'amber' | 'purple' | 'blue' | 'green' | 'gray'; orden: number }> = {
  autonomia: { etiqueta: 'Practicar la resolución autónoma', tono: 'red', orden: 0 },
  dificultad: { etiqueta: 'Con dificultad', tono: 'amber', orden: 1 },
  por_verificar: { etiqueta: 'Por comprobar sin apoyo', tono: 'purple', orden: 2 },
  en_progreso: { etiqueta: 'En progreso', tono: 'blue', orden: 3 },
  sin_evidencia: { etiqueta: 'Sin evidencia', tono: 'gray', orden: 4 },
  consolidado: { etiqueta: 'Consolidado', tono: 'green', orden: 5 },
};

const alto = (m: Medida) => m.n >= UMBRAL.minimo && m.score !== null && m.score >= UMBRAL.alto;
const bajo = (m: Medida) => m.n >= UMBRAL.minimo && m.score !== null && m.score < UMBRAL.bajo;
const controlBajo = (c: ConceptoMapa['controles']) => c.n >= 1 && c.pct !== null && c.pct < UMBRAL.bajo;
const controlOk = (c: ConceptoMapa['controles']) => c.n >= 1 && c.pct !== null && c.pct >= UMBRAL.control;
const evalBaja = (m: Medida) => m.n >= 1 && m.score !== null && m.score < UMBRAL.bajo;

/** Estado de un concepto y el motivo en una frase (para la tutoría). */
export function clasificar(c: ConceptoMapa): { estado: EstadoConcepto; motivo: string } {
  const { practica: p, evaluaciones: e, controles: k, general: g } = c;
  if (p.n + e.n + k.n === 0) return { estado: 'sin_evidencia', motivo: 'Todavía no ha respondido ejercicios de este concepto.' };
  if (alto(p) && (controlBajo(k) || evalBaja(e))) {
    return { estado: 'autonomia', motivo: `Lo resuelve en práctica (${pct(p.score)}), pero no ${controlBajo(k) ? `en los controles (${pct(k.pct)})` : `en las evaluaciones (${pct(e.score)})`}: conviene trabajar la resolución sin apoyo.` };
  }
  if (bajo(g) || controlBajo(k) || (e.n >= UMBRAL.minimo && bajo(e))) {
    return { estado: 'dificultad', motivo: `Acierta poco${g.score !== null ? ` (${pct(g.score)} en sus últimas ${g.n} respuestas)` : ''}${controlBajo(k) ? ` y en los controles (${pct(k.pct)})` : ''}: repasar la idea y practicar ejemplos guiados.` };
  }
  if (alto(g) && (controlOk(k) || alto(e))) return { estado: 'consolidado', motivo: 'Lo resuelve en práctica y también en evaluación o control.' };
  if (alto(p) && e.n === 0 && k.n === 0) return { estado: 'por_verificar', motivo: 'Lo domina en práctica, pero aún no lo ha resuelto en una evaluación ni en un control: una pregunta oral breve lo confirma.' };
  return { estado: 'en_progreso', motivo: g.n < UMBRAL.minimo ? 'Hay pocas respuestas para valorar este concepto.' : `Va avanzando (${pct(g.score)}).` };
}

/** Conceptos por atender en la tutoría, del más urgente al menos (sin los consolidados ni los que aún no tienen evidencia). */
export function prioridades(conceptos: ConceptoMapa[], max = 6) {
  return conceptos
    .map((c) => ({ c, ...clasificar(c) }))
    .filter((x) => x.estado !== 'consolidado' && x.estado !== 'sin_evidencia' && x.estado !== 'en_progreso')
    .sort((a, b) => ESTADOS[a.estado].orden - ESTADOS[b.estado].orden || (a.c.general.score ?? 1) - (b.c.general.score ?? 1))
    .slice(0, max);
}

/** Recuento por estado (para la cabecera del mapa). */
export function recuento(conceptos: ConceptoMapa[]): Record<EstadoConcepto, number> {
  const r = { autonomia: 0, dificultad: 0, por_verificar: 0, en_progreso: 0, consolidado: 0, sin_evidencia: 0 };
  for (const c of conceptos) r[clasificar(c).estado]++;
  return r;
}

export function pct(x: number | null | undefined): string {
  return x === null || x === undefined ? '—' : `${Math.round(100 * x)} %`;
}

export const SENAL_VTA: Record<VtaFila['senal'], string> = {
  sin_datos: 'Sin controles todavía', datos_insuficientes: 'Menos de 3 controles: aún no se interpreta',
  reforzar_autonomia: 'Rinde menos en los controles que en las prácticas: reforzar la autonomía', coherente: 'Prácticas y controles coherentes',
  indeterminada: 'Diferencia no concluyente',
};
