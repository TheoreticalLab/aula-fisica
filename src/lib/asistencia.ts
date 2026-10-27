/** Métrica de asistencia: porcentaje y nivel (para colorear de forma uniforme en todo el panel docente). */

/** Por debajo de este porcentaje la asistencia se marca en rojo (ajústelo si su reglamento usa otro valor). */
export const UMBRAL_ASISTENCIA = 75;

export function porcentajeAsistencia(presentes: number, clases: number): number | null {
  return clases > 0 ? Math.round((100 * presentes) / clases) : null;
}

export function tonoAsistencia(pct: number | null): 'green' | 'amber' | 'red' | 'gray' {
  if (pct === null) return 'gray';
  if (pct < UMBRAL_ASISTENCIA) return 'red';
  if (pct < UMBRAL_ASISTENCIA + 10) return 'amber';
  return 'green';
}

export const textoAsistencia = (presentes: number, clases: number) => {
  const p = porcentajeAsistencia(presentes, clases);
  return p === null ? 'sin clases registradas' : `${presentes}/${clases} · ${p} %`;
};
