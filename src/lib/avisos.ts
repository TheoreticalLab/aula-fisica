/** Avisos automáticos del panel del estudiante: actividades que cierran pronto y notas recién publicadas. */
import type { MyActivity, MyGrade } from '@/api/tipos';
import type { AvisoPanel } from '@/pages/estudiante/PanelEstudiante';
import { relativo } from './util';

export function avisosAutomaticos(
  actividades: MyActivity[],
  notas: MyGrade[],
  ahora = Date.now(),
  rutaActividad: (id: string) => string = (id) => `/actividad/${id}`,
): AvisoPanel[] {
  const out: AvisoPanel[] = [];
  for (const a of actividades) {
    if (!a.closes_at || a.submitted) continue;
    const resta = new Date(a.closes_at).getTime() - ahora;
    if (resta > 0 && resta < 48 * 3600_000) {
      out.push({
        id: `cierre-${a.id}`,
        titulo: `«${a.title}» cierra ${relativo(a.closes_at)}`,
        cuerpo: a.in_progress ? 'Tiene un intento sin entregar.' : 'Todavía no la ha empezado.',
        origen: `${a.class_name} · aviso automático`,
        fecha: new Date(ahora).toISOString(),
        fijado: false,
        automatico: true,
        enlace: a.in_progress ? `/intento/${a.in_progress}` : rutaActividad(a.id),
      });
    }
  }
  // notas recién publicadas: solo las de actividades cerradas en la última semana
  for (const g of notas.slice(0, 2)) {
    const reciente = !g.closes_at || ahora - new Date(g.closes_at).getTime() < 7 * 24 * 3600_000;
    if (g.attempts > 0 && reciente) {
      out.push({
        id: `nota-${g.activity_id}`,
        titulo: `Calificación publicada: ${g.title}`,
        cuerpo: '',
        origen: `${g.class_name} · aviso automático`,
        fecha: g.closes_at ?? new Date(ahora).toISOString(),
        fijado: false,
        automatico: true,
        enlace: g.last_attempt_id ? `/intento/${g.last_attempt_id}` : '/calificaciones',
      });
    }
  }
  return out;
}

/** «Curso · Sección · Autor» sin repetir el nombre cuando la sección se llama igual que el curso. */
export function origenAviso(curso: string | null | undefined, seccion: string | null | undefined, autor: string | null | undefined): string {
  return [...new Set([curso, seccion, autor].filter((x): x is string => !!x))].join(' · ');
}
