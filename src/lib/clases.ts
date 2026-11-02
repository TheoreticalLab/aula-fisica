/**
 * Clases impartidas (migración 66): lógica pura de presentación (sin alias, la usa también Orbe Control).
 * Principio: la teoría oficial describe el contenido estructurado; las clases impartidas documentan lo trabajado en
 * el aula; la IA reconstruye y amplía lo visible, sin sustituir las fotos ni la aprobación del profesor.
 */

export interface Seccion { titulo: string; cuerpo: string; clave?: string }
export interface Contenido { formato?: string; titulo?: string | null; modelo?: string; generado_at?: string; secciones: Seccion[] }
export interface Enlace {
  id: string; tipo: 'leccion' | 'unidad' | 'ejercicio' | 'simulador' | 'brecha'; lesson_id: string | null; unit_id: string | null; exercise_id: string | null;
  sim_key: string | null; apartado: string | null; concepto: string | null; cobertura: 'completa' | 'parcial' | 'ninguna' | null;
  estado: 'sugerido' | 'confirmado' | 'rechazado'; origen: 'ia' | 'docente'; leccion_id: string | null; leccion: string | null; course_id: string | null; unidad: string | null; ejercicio: string | null;
}

export const ESTADO_FOTOS: Record<string, { texto: string; tono: 'gray' | 'amber' | 'green' | 'red' }> = {
  borrador: { texto: 'Borrador (sin enviar)', tono: 'gray' },
  pendiente: { texto: 'Pendiente de revisión', tono: 'amber' },
  aprobada: { texto: 'Fotos publicadas', tono: 'green' },
  rechazada: { texto: 'Fotos rechazadas', tono: 'red' },
  retirada: { texto: 'Fotos retiradas', tono: 'gray' },
};

export const COBERTURA: Record<string, string> = {
  completa: 'Desarrollado en la teoría',
  parcial: 'Desarrollado en parte',
  ninguna: 'Todavía no está en la teoría oficial',
};

export interface EnlaceMin {
  tipo: string; lesson_id: string | null; leccion_id?: string | null; unit_id: string | null; exercise_id: string | null; sim_key: string | null;
  apartado: string | null; concepto: string | null; cobertura: string | null; course_id: string | null;
}

/** Ruta interna (HashRouter) del recurso; null si no hay a dónde ir (brechas). Solo identificadores devueltos por la base. */
export function urlEnlace(e: EnlaceMin, courseId: string): string | null {
  const curso = e.course_id ?? courseId;
  const leccion = e.lesson_id ?? e.leccion_id ?? null;
  switch (e.tipo) {
    case 'leccion':
      return leccion ? `/curso/${curso}/leccion/${leccion}?s=teoria${e.apartado ? `&a=${encodeURIComponent(e.apartado)}` : ''}` : null;
    case 'ejercicio':
      return leccion ? `/curso/${curso}/leccion/${leccion}?s=practica` : null;
    case 'simulador':
      return leccion ? `/curso/${curso}/leccion/${leccion}?s=simulacion` : null;
    case 'unidad':
      return `/curso/${curso}`;
    default:
      return null;
  }
}

/** Caso A (existe), B (parcial) o C (no existe) de lo trabajado en clase respecto de la teoría oficial. */
export function casoCobertura(enlaces: EnlaceMin[]): 'A' | 'B' | 'C' | null {
  const teoria = enlaces.filter((e) => e.tipo !== 'brecha');
  const brechas = enlaces.filter((e) => e.tipo === 'brecha');
  if (!teoria.length && !brechas.length) return null;
  if (!teoria.length) return 'C';
  if (brechas.length || teoria.some((e) => e.cobertura === 'parcial')) return 'B';
  return 'A';
}

/** Normaliza un título de apartado para compararlo con el texto renderizado (sin tildes, LaTeX ni símbolos de Markdown). */
export function normApartado(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\$[^$]*\$/g, ' ').replace(/[*_`#\\{}[\]()]/g, ' ').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Busca el encabezado de la teoría que corresponde a un apartado (para desplazarse hasta él). */
export function elegirEncabezado<T>(encabezados: { el: T; texto: string }[], apartado: string): T | null {
  const objetivo = normApartado(apartado);
  if (!objetivo) return null;
  const exacto = encabezados.find((h) => normApartado(h.texto) === objetivo);
  if (exacto) return exacto.el;
  const contiene = encabezados.find((h) => normApartado(h.texto).includes(objetivo) || objetivo.includes(normApartado(h.texto)));
  return contiene?.el ?? null;
}

export interface FiltroClases { desde?: string; hasta?: string; texto?: string; unidad?: string }
export function filtrarClases<T extends { fecha: string; title: string; temas: string[]; unit_id: string | null; unidad: string | null }>(xs: T[], f: FiltroClases): T[] {
  const t = f.texto ? normApartado(f.texto) : '';
  return xs.filter((x) => (!f.desde || x.fecha >= f.desde) && (!f.hasta || x.fecha <= f.hasta) && (!f.unidad || x.unit_id === f.unidad)
    && (!t || normApartado([x.title, ...x.temas, x.unidad ?? ''].join(' ')).includes(t)));
}

/** Fecha de la clase (DATE, sin hora) mostrada sin desplazamiento de zona horaria. */
export function fechaClase(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Hoy en la zona horaria académica (America/Santo_Domingo), formato AAAA-MM-DD. */
export function hoyAcademico(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

export const ERRORES_IA: Record<string, string> = {
  presupuesto: 'Se alcanzaría el presupuesto mensual de Orbe IA.', limite_diario: 'Se alcanzó el límite diario de llamadas de Orbe IA.',
  apagado: 'Orbe IA está apagado.', en_curso: 'Ya hay una generación en curso para esta clase.', permiso: 'Sin permiso.',
  sin_clave: 'Falta la clave de la API en el servidor.', limite_api: 'La API de Claude limitó las peticiones; reintente en unos minutos.',
  autenticacion: 'La clave de la API no es válida.', red: 'Fallo de red con la API.', servidor_api: 'Error del servidor de la API.',
  peticion_invalida: 'La API rechazó la petición.', incompleta: 'La respuesta se cortó (límite de tokens): pruebe un nivel menor o divida las fotos.',
  rechazada: 'El modelo rechazó la petición.', respuesta_invalida: 'La respuesta no tenía el formato esperado.', respuesta_vacia: 'La respuesta vino vacía.',
  interrumpida: 'El servidor interrumpió el procesamiento; puede reintentar.', foto_no_disponible: 'No se pudo leer una fotografía.', contenido_invalido: 'Contenido no válido.',
};
