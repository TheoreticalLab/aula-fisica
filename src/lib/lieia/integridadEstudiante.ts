/**
 * LIEIA · Lo que el análisis de una evaluación dice de UN estudiante (ficha del estudiante). Lógica pura: recibe los
 * resultados del examen completo (los mismos que «Evaluaciones reales») y extrae su fila, las parejas en las que
 * participa y su posición frente a la sección. Solo se consideran los detectores habilitados (validados).
 */
import type { ResultadoEstudiante, ResultadoPareja } from './detectores';
import type { ResultadoProceso } from './detectoresProceso';

export type DetectorPareja = 'd1' | 'd2' | 'd3';

export interface ParejaDelEstudiante {
  /** índice del otro estudiante en el examen */
  otro: number;
  par: ResultadoPareja;
  /** q de los detectores habilitados (null si el detector no está validado o no se calculó) */
  q1: number | null; q2: number | null; q3: number | null;
  /** quién responde primero según D3: el propio estudiante, el otro, o no se sabe */
  primero: 'estudiante' | 'otro' | null;
  /** mediana del adelanto en segundos (siempre positiva) */
  adelanto: number | null;
}

export interface IntegridadEstudiante {
  estudiante: ResultadoEstudiante;
  /** puesto por aciertos (1 = el mejor) entre `total` estudiantes */
  puesto: number; total: number;
  parejas: ParejaDelEstudiante[];
  proceso: ResultadoProceso | null;
}

/** Umbral de q a partir del cual una pareja se muestra (el mismo que en «Evaluaciones reales»). */
export const Q_MOSTRAR = 0.2;

export function integridadDe(
  indice: number,
  analisis: { parejas: ResultadoPareja[]; estudiantes: ResultadoEstudiante[] },
  habilitado: (d: DetectorPareja) => boolean,
  proceso: ResultadoProceso | null = null,
): IntegridadEstudiante | null {
  const estudiante = analisis.estudiantes.find((e) => e.i === indice);
  if (!estudiante) return null;
  const mejores = analisis.estudiantes.filter((e) => e.puntaje > estudiante.puntaje).length;
  const parejas = analisis.parejas
    .filter((p) => p.i === indice || p.j === indice)
    .map((p): ParejaDelEstudiante => {
      const otro = p.i === indice ? p.j : p.i;
      const lider = p.d3?.lider ?? null;
      return {
        otro, par: p,
        q1: habilitado('d1') ? p.q1 : null, q2: habilitado('d2') ? p.q2 : null, q3: habilitado('d3') ? p.q3 : null,
        primero: lider === null ? null : lider === indice ? 'estudiante' : 'otro',
        adelanto: lider === null || !p.d3 ? null : Math.abs(p.d3.retardo),
      };
    })
    .filter((x) => [x.q1, x.q2, x.q3].some((q) => q !== null && q < Q_MOSTRAR))
    .sort((a, b) => Math.min(a.par.d1?.p ?? 1, a.par.d3?.p ?? 1) - Math.min(b.par.d1?.p ?? 1, b.par.d3?.p ?? 1));
  return { estudiante, puesto: mejores + 1, total: analisis.estudiantes.length, parejas, proceso };
}
