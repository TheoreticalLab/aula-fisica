/**
 * Seguimiento académico: estudiantes que pueden necesitar apoyo (lógica pura, probada).
 * Son avisos para el profesor, con reglas explícitas y sencillas; no son juicios sobre el estudiante ni indicadores
 * de integridad. Solo usan entregas y calificaciones del libro de calificaciones.
 */
import type { Gradebook } from '@/api/tipos';

export const UMBRAL_APROBACION = 0.7;      // 70 %: nota de aprobación
export const CAIDA_RELEVANTE = 0.2;        // 20 puntos porcentuales
export const HORAS_URGENTE = 48;

export type TipoAlerta = 'no_entrego' | 'cierra_pronto' | 'promedio_bajo' | 'bajando' | 'en_curso_vencido';
export interface Alerta { tipo: TipoAlerta; texto: string; peso: number }
export interface Seguimiento { user_id: string; nombre: string; grupo: string | null; alertas: Alerta[]; promedio: number | null; entregadas: number; asignadas: number }

type Est = Gradebook['students'][number];
type Act = Gradebook['activities'][number];

const aplica = (a: Act, e: Est) => a.published && (a.group_id === null || a.group_id === e.group_id);

export function seguimientoEstudiante(e: Est, acts: Act[], ahora = Date.now()): Seguimiento {
  const mias = acts.filter((a) => aplica(a, e));
  const g = (a: Act) => e.grades[a.id];
  const cerradas = mias.filter((a) => a.closes_at && new Date(a.closes_at).getTime() <= ahora);
  const noEntrego = cerradas.filter((a) => !(g(a)?.submitted > 0));
  const vencidasEnCurso = cerradas.filter((a) => g(a)?.in_progress && !(g(a)?.submitted > 0));
  const pronto = mias.filter((a) => a.closes_at && !(g(a)?.submitted > 0)
    && new Date(a.closes_at).getTime() > ahora && new Date(a.closes_at).getTime() - ahora < HORAS_URGENTE * 3600_000);
  // calificadas en orden de cierre (las que no tienen cierre, al final)
  const calificadas = mias.filter((a) => g(a)?.submitted > 0 && g(a)?.best !== null && a.max_score > 0)
    .sort((x, y) => (x.closes_at ? new Date(x.closes_at).getTime() : Infinity) - (y.closes_at ? new Date(y.closes_at).getTime() : Infinity))
    .map((a) => Number(g(a)!.best) / Number(a.max_score));
  const promedio = calificadas.length ? calificadas.reduce((s, x) => s + x, 0) / calificadas.length : null;
  const alertas: Alerta[] = [];
  if (noEntrego.length) alertas.push({ tipo: 'no_entrego', peso: 3 * noEntrego.length, texto: `No entregó ${noEntrego.length} actividad(es) ya cerrada(s): ${noEntrego.map((a) => `«${a.title}»`).join(', ')}.` });
  if (vencidasEnCurso.length) alertas.push({ tipo: 'en_curso_vencido', peso: 1, texto: `${vencidasEnCurso.length} intento(s) quedaron abiertos al cerrar (se pueden entregar y calificar desde la actividad).` });
  if (pronto.length) alertas.push({ tipo: 'cierra_pronto', peso: 2, texto: `Le falta entregar ${pronto.length} actividad(es) que cierran en menos de ${HORAS_URGENTE} h.` });
  if (promedio !== null && calificadas.length >= 2 && promedio < UMBRAL_APROBACION) alertas.push({ tipo: 'promedio_bajo', peso: 2, texto: `Promedio de ${Math.round(100 * promedio)} % en ${calificadas.length} actividades (por debajo del ${Math.round(100 * UMBRAL_APROBACION)} %).` });
  if (calificadas.length >= 4) {
    const ult = calificadas.slice(-2), prev = calificadas.slice(0, -2);
    const mu = ult.reduce((s, x) => s + x, 0) / ult.length, mp = prev.reduce((s, x) => s + x, 0) / prev.length;
    if (mp - mu >= CAIDA_RELEVANTE) alertas.push({ tipo: 'bajando', peso: 1, texto: `Sus dos últimas notas (${Math.round(100 * mu)} %) están ${Math.round(100 * (mp - mu))} puntos por debajo de las anteriores (${Math.round(100 * mp)} %).` });
  }
  return { user_id: e.user_id, nombre: e.full_name, grupo: e.group_name, alertas, promedio, entregadas: calificadas.length, asignadas: mias.length };
}

/** Estudiantes con algún aviso, de más a menos urgente. */
export function seguimientoSeccion(gb: Gradebook, ahora = Date.now()): Seguimiento[] {
  return gb.students.filter((e) => e.active !== false).map((e) => seguimientoEstudiante(e, gb.activities, ahora))
    .filter((s) => s.alertas.length)
    .sort((a, b) => b.alertas.reduce((s, x) => s + x.peso, 0) - a.alertas.reduce((s, x) => s + x.peso, 0) || a.nombre.localeCompare(b.nombre));
}
