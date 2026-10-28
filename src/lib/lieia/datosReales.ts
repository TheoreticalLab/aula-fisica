/**
 * LIEIA · Adaptador de datos reales: convierte la respuesta de lieia_exam_data (servidor) en un ExamenObservado.
 * El servidor ya minimiza: seudónimos (E01…), fichas opacas de respuesta (huella, no el contenido) y tiempos.
 */
import type { ExamenObservado } from './tipos';

export interface DatosRealesExamen {
  actividad: { id: string; titulo: string; modo: string; abre: string | null; cierra: string | null };
  items: { exercise_id: string; posicion: number; formato: string; opciones: number | null }[];
  estudiantes: {
    seudonimo: string; inicio: string; fin: string | null; oculto: number;
    respuestas: { exercise_id: string; ficha: string | null; correcta: boolean | null; primera: string | null; ultima: string | null; cambios: number }[];
  }[];
  con_tiempos: boolean;
}

export function aExamen(d: DatosRealesExamen): ExamenObservado {
  const items = [...d.items].sort((a, b) => a.posicion - b.posicion);
  const t0 = Math.min(...d.estudiantes.map((e) => new Date(e.inicio).getTime()));
  const seg = (iso: string | null) => (iso ? (new Date(iso).getTime() - t0) / 1000 : null);
  return {
    items: items.map((it, j) => ({ id: `P${j + 1}`, opciones: it.formato === 'choice' || it.formato === 'truefalse' ? it.opciones ?? (it.formato === 'truefalse' ? 2 : null) : null, orden: j + 1 })),
    estudiantes: d.estudiantes.map((e) => ({ id: e.seudonimo, inicio: seg(e.inicio) ?? 0, fin: seg(e.fin), oculto: e.oculto ?? 0 })),
    r: d.estudiantes.map((e) => items.map((it) => {
      const r = e.respuestas.find((x) => x.exercise_id === it.exercise_id);
      if (!r || r.ficha === null) return { respuesta: null, correcta: null, t: null, primera: null, cambios: 0 };
      return { respuesta: r.ficha, correcta: r.correcta, t: seg(r.ultima), primera: seg(r.primera), cambios: r.cambios };
    })),
    conTiempos: d.con_tiempos,
  };
}
