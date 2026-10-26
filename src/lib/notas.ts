/** Registro de Calificaciones: distribución oficial y cálculo de la nota (igual que en gradebook_official). */
export const CATEGORIAS = [
  { id: 'parcial1', label: 'Primer parcial', max: 15 },
  { id: 'parcial2', label: 'Segundo parcial', max: 15 },
  { id: 'parcial3', label: 'Tercer parcial', max: 15 },
  { id: 'practica', label: 'Práctica', max: 30 },
  { id: 'final', label: 'Examen final', max: 25 },
] as const;
export type Categoria = (typeof CATEGORIAS)[number]['id'];
export type Notas = Partial<Record<Categoria, number | null>>;

/** null/ausente = pendiente (no es 0). La nota final suma categorías y extras aprobados, con máximo 100. */
export function calcularNota(notas: Notas, extras: number): { bruto: number; final: number; pendientes: Categoria[] } {
  const pendientes = CATEGORIAS.filter((c) => notas[c.id] === null || notas[c.id] === undefined).map((c) => c.id);
  const suma = CATEGORIAS.reduce((s, c) => s + (notas[c.id] ?? 0), 0) + Math.max(0, extras);
  const bruto = Math.round(suma * 100) / 100;
  return { bruto, final: Math.min(100, bruto), pendientes };
}

/** Valida lo que el profesor escribe en una celda: '' = pendiente; si no, número entre 0 y el máximo. */
export function leerCelda(texto: string, max: number): { ok: true; valor: number | null } | { ok: false; error: string } {
  const t = texto.trim().replace(',', '.');
  if (t === '') return { ok: true, valor: null };
  const v = Number(t);
  if (!Number.isFinite(v)) return { ok: false, error: 'No es un número' };
  if (v < 0 || v > max) return { ok: false, error: `Debe estar entre 0 y ${max}` };
  return { ok: true, valor: Math.round(v * 100) / 100 };
}
