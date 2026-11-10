/**
 * Herramientas del profesor de uso ocasional: una sola lista para el menú «Herramientas» de la barra superior y para el
 * panel docente. `externa` = Orbe Control (otra página del mismo sitio, fuera del enrutador).
 */
export interface HerramientaDocente { to: string; icono: string; titulo: string; texto: string; grupo: 'Contenido' | 'Inteligencia artificial' | 'En clase' | 'Análisis' | 'Administración'; admin?: boolean; externa?: boolean }

export const HERRAMIENTAS_DOCENTE: HerramientaDocente[] = [
  { grupo: 'Contenido', to: '/docente/cursos', icono: '📚', titulo: 'Asignaturas y contenido', texto: 'Lecciones, teoría y su orden.' },
  { grupo: 'Contenido', to: '/docente/ejercicios', icono: '🗂️', titulo: 'Banco de ejercicios', texto: 'Preguntas, claves y dificultad.' },
  { grupo: 'Contenido', to: '/docente/practicas-anteriores', icono: '🗃️', titulo: 'Prácticas anteriores', texto: 'Regularización: localizar, verificar y convalidar las prácticas entregadas antes del aula.' },
  { grupo: 'Inteligencia artificial', to: '/docente/centro-ia', icono: '🤖', titulo: 'Centro de IA', texto: 'Pida una práctica o un examen conversando; la IA pregunta lo que falte.' },
  { grupo: 'Inteligencia artificial', to: '/docente/generar-preguntas', icono: '✨', titulo: 'Generar preguntas con IA', texto: 'Por temas y niveles, con coste estimado; quedan como borradores.' },
  { grupo: 'Inteligencia artificial', to: '/docente/orbe-ia', icono: '🧠', titulo: 'Orbe IA', texto: 'Claude en el aula: encendido, gasto y consumo.', admin: true },
  { grupo: 'En clase', to: '/docente/comunicacion', icono: '📢', titulo: 'Comunicación en vivo', texto: 'Mensajes a la sección o a un estudiante.' },
  { grupo: 'En clase', to: 'control/', icono: '📱', titulo: 'Orbe Control', texto: 'El aula desde el teléfono: pulso, preguntas y datos.', externa: true },
  { grupo: 'En clase', to: '/', icono: '👁', titulo: 'Vista de estudiante', texto: 'Vea la plataforma como la ve un estudiante.' },
  { grupo: 'Análisis', to: '/docente/analitica', icono: '⏱', titulo: 'Analítica de tiempo', texto: 'Tiempo efectivo de estudio por estudiante.' },
  { grupo: 'Análisis', to: '/docente/telemetria', icono: '🔭', titulo: 'Telemetría', texto: 'Activar la Telemetría V2 por asignatura y vigilar su calidad.' },
  { grupo: 'Análisis', to: '/docente/lieia', icono: '🔬', titulo: 'Laboratorio LIEIA', texto: 'Investigación de integridad (indicadores experimentales: no son pruebas).' },
  { grupo: 'Administración', to: '/docente/cuentas', icono: '👥', titulo: 'Cuentas', texto: 'Alta de estudiantes y profesores, accesos.', admin: true },
  { grupo: 'Administración', to: '/ayuda', icono: '❓', titulo: 'Ayuda', texto: 'Guía breve: crear exámenes, prórrogas, revisar y seguimiento.' },
];

export function herramientasPorGrupo(esAdmin: boolean): { grupo: string; items: HerramientaDocente[] }[] {
  const out: { grupo: string; items: HerramientaDocente[] }[] = [];
  for (const h of HERRAMIENTAS_DOCENTE) {
    if (h.admin && !esAdmin) continue;
    const g = out.find((x) => x.grupo === h.grupo);
    if (g) g.items.push(h);
    else out.push({ grupo: h.grupo, items: [h] });
  }
  return out;
}
