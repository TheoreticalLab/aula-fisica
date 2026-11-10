/**
 * Centro de mando del profesor (migración 92): lógica pura del tablero, probada en tests/tablero.test.ts.
 * El tablero responde tres preguntas: qué pasa AHORA, qué ESPERA al profesor y quién se QUEDA ATRÁS.
 * «Conectado» = pestaña del aula con latido reciente; no es prueba de atención (se dice así en la interfaz).
 * Sin la migración 92 el panel se arma con `teacher_overview`: lo que no se conoce queda en `null` y no se muestra.
 */
import type { SeccionResumen } from '@/api/tipos';
import type { Aviso } from '@/lib/resumenSemanal';

export interface ExamenTablero { activity_id: string; title: string; closes_at: string | null; en_curso: number; entregados: number; convocados: number }
export interface AsistenciaTablero { session_id: string; abierta: boolean; abierta_en: string; presentes: number }
export interface SeccionTablero {
  class_id: string; name: string; term: string | null; course_id: string; course_title: string; laboratorio: boolean;
  estudiantes: number; abiertas: number; por_revisar: number;
  conectados: number | null; archivos_por_revisar: number | null; solicitudes_acceso: number | null;
  asistencia: AsistenciaTablero | null; examenes: ExamenTablero[];
  no_entregaron: number | null; sin_entrar: number | null;
}
/** `vivo`: los datos vienen de `tablero_docente` (migración 92) y no del resumen anterior. */
export interface Tablero { ahora: string; vivo: boolean; secciones: SeccionTablero[] }

export interface EventoTablero {
  tipo: 'entregas' | 'archivos' | 'asistencia' | 'aviso' | 'cierre';
  class_id: string; seccion: string; titulo: string; modo: string; n: number; cuando: string; ref: string;
}

/** Panel sin la migración 92: lo que ya daba `teacher_overview`; lo demás, desconocido. */
export function tableroDesdeResumen(secciones: SeccionResumen[], ahora = new Date()): Tablero {
  return {
    ahora: ahora.toISOString(), vivo: false,
    secciones: secciones.filter((s) => !s.archived).map((s) => ({
      class_id: s.class_id, name: s.name, term: s.term || null, course_id: s.course_id, course_title: s.course_title, laboratorio: false,
      estudiantes: Number(s.students), abiertas: Number(s.open_activities), por_revisar: Number(s.pending_review),
      conectados: null, archivos_por_revisar: null, solicitudes_acceso: null, asistencia: null, examenes: [],
      no_entregaron: null, sin_entrar: null,
    })),
  };
}

/** La sección elegida, si sigue existiendo; si no, todas. */
export function seccionValida(t: Tablero, classId: string | null): string | null {
  return classId && t.secciones.some((s) => s.class_id === classId) ? classId : null;
}

export const deSeccion = (t: Tablero, classId: string | null): SeccionTablero[] =>
  classId ? t.secciones.filter((s) => s.class_id === classId) : t.secciones;

const suma = (xs: (number | null)[]): number | null => (xs.every((x) => x === null) ? null : xs.reduce<number>((s, x) => s + (x ?? 0), 0));

export interface Totales { estudiantes: number; conectados: number | null; abiertas: number; enExamen: number; examenes: number; presentes: number | null; asistenciaAbierta: boolean }

export function totales(secs: SeccionTablero[]): Totales {
  const conAsistencia = secs.filter((s) => s.asistencia);
  return {
    estudiantes: secs.reduce((s, x) => s + x.estudiantes, 0),
    conectados: suma(secs.map((s) => s.conectados)),
    abiertas: secs.reduce((s, x) => s + x.abiertas, 0),
    enExamen: secs.reduce((s, x) => s + x.examenes.reduce((a, e) => a + e.en_curso, 0), 0),
    examenes: secs.reduce((s, x) => s + x.examenes.length, 0),
    presentes: conAsistencia.length ? conAsistencia.reduce((s, x) => s + x.asistencia!.presentes, 0) : null,
    asistenciaAbierta: conAsistencia.some((s) => s.asistencia!.abierta),
  };
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const rutaSeccion = (classId: string, pestana: string) => `/docente/clases/${classId}?t=${pestana}`;

export interface Pendiente {
  clave: string; texto: string; seccion: string; tono: 'red' | 'amber' | 'blue' | 'gray'; n: number;
  /** Ruta dentro del aula; `null` = se resuelve en Orbe Control. */
  ruta: string | null;
}

/**
 * Bandeja única de lo que espera al profesor, de lo más urgente a lo menos: solicitudes de acceso (caducan), respuestas
 * por revisar, archivos recibidos sin revisar y, después, los avisos del resumen semanal en su propio orden.
 */
export function bandeja(secs: SeccionTablero[], semana: (Aviso & { ruta: string | null })[] = []): Pendiente[] {
  const out: (Pendiente & { orden: number })[] = [];
  const ids = new Set(secs.map((s) => s.class_id));
  const cursos = new Set(secs.map((s) => s.course_id));
  for (const s of secs) {
    const seccion = s.name;
    if (s.solicitudes_acceso) out.push({ orden: 0, clave: `${s.class_id}-acceso`, seccion, tono: 'red', n: s.solicitudes_acceso, ruta: '/gestion-acceso',
      texto: `${plural(s.solicitudes_acceso, 'solicitud de acceso espera', 'solicitudes de acceso esperan')} su verificación (caducan)` });
    if (s.por_revisar) out.push({ orden: 1, clave: `${s.class_id}-revision`, seccion, tono: 'red', n: s.por_revisar, ruta: rutaSeccion(s.class_id, 'revision'),
      texto: `${plural(s.por_revisar, 'respuesta', 'respuestas')} por revisar a mano` });
    if (s.archivos_por_revisar) out.push({ orden: 2, clave: `${s.class_id}-archivos`, seccion, tono: 'amber', n: s.archivos_por_revisar,
      ruta: rutaSeccion(s.class_id, s.laboratorio ? 'controles' : 'entregas'),
      texto: s.laboratorio ? `${plural(s.archivos_por_revisar, 'control entregado', 'controles entregados')} sin revisar`
        : `${plural(s.archivos_por_revisar, 'archivo recibido', 'archivos recibidos')} sin revisar` });
  }
  semana.forEach((a, i) => {
    const d = a.destino;
    if ('pagina' in d ? !cursos.has(d.course_id) : !ids.has(d.class_id)) return;
    out.push({ orden: 3 + i, clave: `semana-${a.clave}`, seccion: a.seccion, tono: a.tono, n: 1, ruta: a.ruta, texto: a.texto });
  });
  return out.sort((a, b) => a.orden - b.orden || b.n - a.n || a.seccion.localeCompare(b.seccion)).map(({ orden: _o, ...p }) => p);
}

export interface Riesgo { clave: string; texto: string; seccion: string; n: number; ruta: string }

/** Quién se queda atrás (solo recuentos; el detalle con nombres está en la pestaña «Seguimiento» de la sección). */
export function riesgo(secs: SeccionTablero[]): Riesgo[] {
  const out: Riesgo[] = [];
  for (const s of secs) {
    if (s.no_entregaron) out.push({ clave: `${s.class_id}-noentrego`, seccion: s.name, n: s.no_entregaron, ruta: rutaSeccion(s.class_id, 'seguimiento'),
      texto: `${plural(s.no_entregaron, 'estudiante no entregó', 'estudiantes no entregaron')} alguna actividad cerrada este mes` });
    if (s.sin_entrar) out.push({ clave: `${s.class_id}-sinentrar`, seccion: s.name, n: s.sin_entrar, ruta: rutaSeccion(s.class_id, 'estudiantes'),
      texto: `${plural(s.sin_entrar, 'estudiante lleva', 'estudiantes llevan')} 7 días o más sin entrar al aula` });
  }
  return out.sort((a, b) => b.n - a.n || a.seccion.localeCompare(b.seccion));
}

/** Texto, icono y destino de un evento de la línea de tiempo. */
export function textoEvento(e: EventoTablero): { icono: string; texto: string; ruta: string } {
  switch (e.tipo) {
    case 'entregas':
      return { icono: e.modo === 'exam' ? '📝' : '🧩', ruta: `/docente/actividades/${e.ref}`,
        texto: `${plural(e.n, 'entrega', 'entregas')} de «${e.titulo}»` };
    case 'archivos':
      return { icono: e.modo === 'control' ? '🧪' : '📎', ruta: rutaSeccion(e.class_id, e.modo === 'control' ? 'controles' : 'entregas'),
        texto: `${plural(e.n, 'archivo subido', 'archivos subidos')} a «${e.titulo}»` };
    case 'asistencia':
      return { icono: '✅', ruta: rutaSeccion(e.class_id, 'asistencia'),
        texto: `Asistencia ${e.modo === 'abierta' ? 'abierta' : 'pasada'}: ${plural(e.n, 'presente', 'presentes')}` };
    case 'aviso':
      return { icono: '📢', ruta: rutaSeccion(e.class_id, 'avisos'), texto: `Aviso publicado: «${e.titulo}»` };
    case 'cierre':
      return { icono: '🔒', ruta: `/docente/actividades/${e.ref}`,
        texto: `Cerró «${e.titulo}»: ${e.n === 1 ? 'entregó 1 estudiante' : `entregaron ${e.n} estudiantes`}` };
  }
}

const DIA = new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Santo_Domingo' });
const CLAVE_DIA = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Santo_Domingo' });

/** Eventos agrupados por día (hora de Santo Domingo), del más reciente al más antiguo: «Hoy», «Ayer» o la fecha. */
export function porDia(eventos: EventoTablero[], ahora = new Date()): { dia: string; eventos: EventoTablero[] }[] {
  const hoy = CLAVE_DIA.format(ahora);
  const ayer = CLAVE_DIA.format(new Date(ahora.getTime() - 24 * 3600_000));
  const grupos = new Map<string, { dia: string; eventos: EventoTablero[] }>();
  for (const e of [...eventos].sort((a, b) => b.cuando.localeCompare(a.cuando))) {
    const f = new Date(e.cuando);
    const k = CLAVE_DIA.format(f);
    if (!grupos.has(k)) grupos.set(k, { dia: k === hoy ? 'Hoy' : k === ayer ? 'Ayer' : DIA.format(f), eventos: [] });
    grupos.get(k)!.eventos.push(e);
  }
  return [...grupos.values()];
}

/** Búsqueda de estudiante sin distinguir mayúsculas ni tildes, por nombre (todas las palabras) o matrícula. */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface EstudianteBuscable { user_id: string; full_name: string; student_code: string | null; class_id: string; class_name: string; course_title: string }

export function buscarEstudiantes<T extends EstudianteBuscable>(lista: T[], consulta: string, limite = 12): T[] {
  const q = normalizar(consulta);
  if (q.length < 2) return [];
  const palabras = q.split(/\s+/);
  const puntos = (e: T): number => {
    const nombre = normalizar(e.full_name);
    const codigo = normalizar(e.student_code ?? '');
    if (codigo && codigo === q) return 0;
    if (codigo && codigo.startsWith(q)) return 1;
    if (!palabras.every((p) => nombre.includes(p) || (codigo && codigo.includes(p)))) return -1;
    return nombre.startsWith(q) ? 2 : nombre.split(/\s+/).some((w) => w.startsWith(palabras[0])) ? 3 : 4;
  };
  return lista.map((e) => ({ e, p: puntos(e) })).filter((x) => x.p >= 0)
    .sort((a, b) => a.p - b.p || a.e.full_name.localeCompare(b.e.full_name) || a.e.class_name.localeCompare(b.e.class_name))
    .slice(0, limite).map((x) => x.e);
}

/**
 * Pestañas de una sección agrupadas en cuatro (personas, clases, evaluación, entregas). Los identificadores de pestaña
 * no cambian: los enlaces `?t=…` que ya existen siguen llevando al mismo sitio.
 */
export const GRUPOS_SECCION = [
  { id: 'personas', label: 'Personas', icono: '👥', pestanas: ['estudiantes', 'asistencia', 'seguimiento', 'avisos'] },
  { id: 'clases', label: 'Clases', icono: '🧑‍🏫', pestanas: ['clases', 'programa'] },
  { id: 'evaluacion', label: 'Evaluación', icono: '📝', pestanas: ['actividades', 'pes', 'revision', 'calificaciones', 'estadisticas'] },
  { id: 'entregas', label: 'Entregas', icono: '📎', pestanas: ['controles', 'entregas', 'regularizacion', 'coincidencias'] },
] as const;

export type GrupoSeccion = (typeof GRUPOS_SECCION)[number]['id'];

export function grupoDePestana(pestana: string): GrupoSeccion {
  return GRUPOS_SECCION.find((g) => (g.pestanas as readonly string[]).includes(pestana))?.id ?? 'personas';
}

/** Siguiente respuesta por revisar de la cola: la primera de OTRO intento; si no queda, null. */
export function siguientePorRevisar<T extends { attempt_id: string; response_id: string }>(cola: T[], intentoActual: string): T | null {
  return cola.find((r) => r.attempt_id !== intentoActual) ?? null;
}
