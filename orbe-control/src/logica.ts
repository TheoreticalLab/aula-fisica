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
export function agrupar(lista: EnLinea[]): { clave: string; class_id: string; titulo: string; alumnos: EnLinea[] }[] {
  const m = new Map<string, { clave: string; class_id: string; titulo: string; alumnos: EnLinea[] }>();
  for (const e of lista) {
    const g = m.get(e.class_id) ?? { clave: e.class_id, class_id: e.class_id, titulo: `${e.course_title} — ${e.class_name}`, alumnos: [] };
    g.alumnos.push(e);
    m.set(e.class_id, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, alumnos: g.alumnos.sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')) }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
}

/** Estado de la sincronización: datos frescos si la última consulta correcta fue hace poco y hay red. */
export function estadoSync(ultimaOkMs: number | null, enLinea: boolean, ahoraLocal = Date.now()): 'conectado' | 'reconectando' {
  return enLinea && ultimaOkMs !== null && ahoraLocal - ultimaOkMs < 30_000 ? 'conectado' : 'reconectando';
}
