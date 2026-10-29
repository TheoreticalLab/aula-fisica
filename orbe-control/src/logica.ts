/** Lógica pura de Orbe Control (probada en tests/orbe-control.test.ts). */

export interface EnLinea {
  user_id: string;
  full_name: string;
  student_code: string | null;
  class_id: string;
  class_name: string;
  course_title: string;
  last_seen: string;
  conexiones: number;
  visible: boolean;
  section: string | null;
  lesson_title: string | null;
  activity_title: string | null;
}

/** Segundos tras los cuales una señal deja de contar (igual que en el servidor). */
export const EXPIRA_S = 75;

/** Edad de la última señal en segundos, con el reloj del SERVIDOR (offset = servidor − local). */
export function edadSenal(lastSeen: string, offsetMs: number, ahoraLocal = Date.now()): number {
  return Math.max(0, Math.round((ahoraLocal + offsetMs - new Date(lastSeen).getTime()) / 1000));
}

export function haceTexto(s: number): string {
  if (s < 5) return 'hace un instante';
  if (s < 60) return `hace ${s} segundos`;
  const m = Math.floor(s / 60);
  return m === 1 ? 'hace 1 minuto' : `hace ${m} minutos`;
}

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra (sección, búsqueda por nombre o matrícula, sin acentos) y quita las señales caducadas. */
export function filtrar(lista: EnLinea[], seccion: string, busqueda: string, offsetMs: number, ahoraLocal = Date.now()): EnLinea[] {
  const q = normal(busqueda.trim());
  return lista.filter(
    (e) =>
      edadSenal(e.last_seen, offsetMs, ahoraLocal) <= EXPIRA_S &&
      (!seccion || e.class_id === seccion) &&
      (!q || normal(e.full_name).includes(q) || normal(e.student_code ?? '').includes(q)),
  );
}

/** Estudiantes únicos (el servidor ya agrupa, pero un estudiante puede estar en dos secciones). */
export function unicos(lista: EnLinea[]): number {
  return new Set(lista.map((e) => e.user_id)).size;
}

/** Agrupa por «ASIGNATURA — SECCIÓN», en orden. */
export function agrupar<T extends EnLinea>(lista: T[]): { clave: string; class_id: string; titulo: string; alumnos: T[] }[] {
  const m = new Map<string, { clave: string; class_id: string; titulo: string; alumnos: T[] }>();
  for (const e of lista) {
    const g = m.get(e.class_id) ?? { clave: e.class_id, class_id: e.class_id, titulo: `${e.course_title} — ${e.class_name}`, alumnos: [] };
    g.alumnos.push(e);
    m.set(e.class_id, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, alumnos: g.alumnos.sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')) }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
}

/** Estudiante de mis secciones (my_messageable_students) con su última señal conocida (live_presence). */
export interface Alumno {
  user_id: string;
  full_name: string;
  student_code: string | null;
  class_id: string;
  class_name: string;
  course_title: string;
}
export interface Fila extends EnLinea {
  online: boolean;
}

/**
 * Vista «Todos»: cada estudiante de mis secciones, marcado en línea si tiene una señal vigente; los demás con su
 * última señal conocida (o ninguna). Filtra por sección y búsqueda, sin quitar a los desconectados.
 */
export function combinarTodos(
  alumnos: Alumno[], enLinea: EnLinea[], ultimas: Map<string, string | null>, seccion: string, busqueda: string,
  offsetMs: number, ahoraLocal = Date.now(),
): Fila[] {
  const vivos = new Map(filtrar(enLinea, '', '', offsetMs, ahoraLocal).map((e) => [`${e.user_id}:${e.class_id}`, e]));
  const q = normal(busqueda.trim());
  return alumnos
    .filter((a) => (!seccion || a.class_id === seccion) && (!q || normal(a.full_name).includes(q) || normal(a.student_code ?? '').includes(q)))
    .map((a) => {
      const v = vivos.get(`${a.user_id}:${a.class_id}`);
      return v
        ? { ...v, online: true }
        : { ...a, online: false, last_seen: ultimas.get(a.user_id) ?? '', conexiones: 0, visible: false, section: null, lesson_title: null, activity_title: null };
    });
}

// ---------------------------------------------------------------------------------------------------------
// Orbe IA en Orbe Control

/** Primer nombre para personalizar un mensaje («Ana María Pérez» → «Ana»). */
export function primerNombre(completo: string | null | undefined): string {
  return (completo ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * Pone el nombre en el hueco {nombre} de un mensaje redactado con IA (Claude nunca ve el nombre: se rellena aquí).
 * Sin nombre, se quita el hueco y se arregla la mayúscula inicial.
 */
export function personalizar(texto: string, nombre: string): string {
  if (nombre) return texto.replace(/\{nombre\}/g, nombre);
  const s = texto.replace(/\{nombre\}\s*,?\s*/g, '').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Porcentaje de cada opción sobre el total de respuestas (redondeado). */
export function porcentajes(conteo: number[]): number[] {
  const total = conteo.reduce((s, x) => s + x, 0);
  return conteo.map((x) => (total ? Math.round((100 * x) / total) : 0));
}

/** Segundos que le quedan a una pregunta, con el reloj del servidor (offset = servidor − local). */
export function segundosRestantes(cierraIso: string, offsetMs: number, ahoraLocal = Date.now()): number {
  return Math.max(0, Math.round((new Date(cierraIso).getTime() - (ahoraLocal + offsetMs)) / 1000));
}

/** Estado de la sincronización: datos frescos si la última consulta correcta fue hace poco y hay red. */
export function estadoSync(ultimaOkMs: number | null, enLinea: boolean, ahoraLocal = Date.now()): 'conectado' | 'reconectando' {
  return enLinea && ultimaOkMs !== null && ahoraLocal - ultimaOkMs < 30_000 ? 'conectado' : 'reconectando';
}
