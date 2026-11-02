/**
 * Resumen semanal del profesor (migración 68): lo pendiente en sus secciones y el gasto de IA de los últimos 7 días.
 * Funciones puras compartidas por el panel docente y Orbe Control.
 */

export interface SeccionSemana {
  class_id: string; seccion: string; asignatura: string;
  controles_por_confirmar: number; controles_sin_cerrar: number; controles_semana: number;
  coincidencias_pendientes: number; coincidencias_semana: number;
  fotos_por_revisar: number; ampliadas_por_revisar: number;
  bloqueo_activo: boolean; bloqueados: number;
}
export interface ResumenSemanal {
  desde: string; hasta: string; es_admin: boolean;
  secciones: SeccionSemana[];
  banco: { course_id: string; asignatura: string; ia: number; clase: number }[];
  ia: { mio_usd: number; mio_llamadas: number; mio_por_proposito: Record<string, number>; total_usd: number | null; mes_usd: number | null; presupuesto_mes: number | null };
}

/** Destino de cada aviso dentro del aula (pestaña de la sección o página). */
export type Destino = { pestana: 'control' | 'coincidencias' | 'clases' | 'regularizacion'; class_id: string } | { pagina: 'banco'; course_id: string };
export interface Aviso { clave: string; texto: string; tono: 'red' | 'amber' | 'blue' | 'gray'; destino: Destino; seccion: string }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Avisos accionables, de lo más urgente a lo menos. Una sección sin pendientes no genera avisos. */
export function avisos(r: ResumenSemanal): Aviso[] {
  const out: (Aviso & { orden: number })[] = [];
  for (const s of r.secciones) {
    const nombre = `${s.asignatura} · ${s.seccion}`;
    const d = (pestana: 'control' | 'coincidencias' | 'clases' | 'regularizacion') => ({ pestana, class_id: s.class_id });
    if (s.controles_sin_cerrar > 0) out.push({ orden: 0, clave: `${s.class_id}-sincerrar`, seccion: nombre, tono: 'red', destino: d('control'), texto: `${plural(s.controles_sin_cerrar, 'control sigue abierto', 'controles siguen abiertos')} desde hace más de 3 horas` });
    if (s.controles_por_confirmar > 0) out.push({ orden: 1, clave: `${s.class_id}-confirmar`, seccion: nombre, tono: 'amber', destino: d('control'), texto: `${plural(s.controles_por_confirmar, 'control pendiente', 'controles pendientes')} de confirmar (no cuentan en la nota hasta confirmarlos)` });
    if (s.coincidencias_pendientes > 0) out.push({ orden: 2, clave: `${s.class_id}-coinc`, seccion: nombre, tono: 'amber', destino: d('coincidencias'), texto: `${plural(s.coincidencias_pendientes, 'coincidencia de archivos', 'coincidencias de archivos')} por decidir` });
    if (s.bloqueados > 0) out.push({ orden: 3, clave: `${s.class_id}-bloq`, seccion: nombre, tono: 'amber', destino: d('regularizacion'), texto: `${plural(s.bloqueados, 'estudiante bloqueado', 'estudiantes bloqueados')} por no terminar la regularización` });
    if (s.fotos_por_revisar > 0) out.push({ orden: 4, clave: `${s.class_id}-fotos`, seccion: nombre, tono: 'blue', destino: d('clases'), texto: `${plural(s.fotos_por_revisar, 'clase con fotos', 'clases con fotos')} por revisar` });
    if (s.ampliadas_por_revisar > 0) out.push({ orden: 5, clave: `${s.class_id}-ampl`, seccion: nombre, tono: 'blue', destino: d('clases'), texto: `${plural(s.ampliadas_por_revisar, 'clase ampliada', 'clases ampliadas')} en borrador sin publicar` });
  }
  for (const b of r.banco) {
    const n = b.ia + b.clase;
    if (n > 0) out.push({ orden: 6, clave: `${b.course_id}-banco`, seccion: b.asignatura, tono: 'gray', destino: { pagina: 'banco', course_id: b.course_id },
      texto: `${plural(n, 'pregunta generada con IA', 'preguntas generadas con IA')} sin publicar en el banco${b.clase ? ` (${b.clase} desde clases impartidas)` : ''}` });
  }
  return out.sort((a, b) => a.orden - b.orden || a.seccion.localeCompare(b.seccion)).map(({ orden: _o, ...a }) => a);
}

/** Actividad de la semana (no pendiente): controles hechos y coincidencias registradas. */
export function actividadSemana(r: ResumenSemanal) {
  return {
    controles: r.secciones.reduce((s, x) => s + x.controles_semana, 0),
    coincidencias: r.secciones.reduce((s, x) => s + x.coincidencias_semana, 0),
  };
}

export const PROPOSITOS: Record<string, string> = {
  chistes: 'Humor', mensaje: 'Mensajes', pulso: 'Pulso', pregunta: 'Preguntas en clase', lieia: 'LIEIA', generar: 'Generación de preguntas', clase: 'Clases ampliadas',
  asistente: 'Asistente de actividades', control: 'Prácticas de Control',
};

export const usd = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `US$ ${n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`);

/** Ruta del aula (HashRouter) para un aviso; null = se resuelve en Orbe Control (confirmar o cerrar controles). */
export function rutaAviso(d: Destino): string | null {
  if ('pagina' in d) return `/docente/ejercicios?curso=${d.course_id}&estado=borrador`;
  if (d.pestana === 'control') return null;
  return `/docente/clases/${d.class_id}?t=${d.pestana}`;
}
