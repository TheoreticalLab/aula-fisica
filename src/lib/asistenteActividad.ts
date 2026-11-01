/**
 * Asistente de actividades con IA: lógica pura COMPARTIDA por el aula y Orbe Control (sin llamadas al servidor).
 * Claude completa un borrador conversando; aquí se elige qué preguntas del banco entran y se construye la actividad con
 * las MISMAS reglas del asistente «+ Crear actividad» (plantillas.ts). Probado en tests/asistente-actividad.test.ts.
 */
import { borradorDesde, revisar, type Borrador, type IdPlantilla } from './plantillas';
import { reparto } from './generacion';

export type Nivel = 'basico' | 'intermedio' | 'desafiante';
export type Modalidad = 'libre' | 'asistida' | 'tarea' | 'quiz' | 'parcial' | 'estricto' | 'clasico';
export const MODALIDADES: Record<Modalidad, { tipo: 'practica' | 'examen'; nombre: string; plantilla: IdPlantilla }> = {
  libre: { tipo: 'practica', nombre: 'Práctica libre (comprobar, pistas, varios intentos)', plantilla: 'practica_libre' },
  asistida: { tipo: 'practica', nombre: 'Práctica con aprendizaje asistido', plantilla: 'practica_asistida' },
  tarea: { tipo: 'practica', nombre: 'Tarea con fecha (soluciones al cerrar)', plantilla: 'tarea' },
  quiz: { tipo: 'examen', nombre: 'Quiz (una a la vez, corto)', plantilla: 'quiz' },
  parcial: { tipo: 'examen', nombre: 'Examen parcial (una a la vez, navegación libre, una pausa)', plantilla: 'parcial' },
  estricto: { tipo: 'examen', nombre: 'Examen estricto (solo hacia adelante, sin pausas)', plantilla: 'estricto' },
  clasico: { tipo: 'examen', nombre: 'Evaluación clásica (todas en una página)', plantilla: 'blanco_examen' },
};

/** Borrador que completa Claude (fechas en hora LOCAL de la República Dominicana, «AAAA-MM-DDTHH:MM»). */
export interface BorradorIA {
  seccion_id: string | null; tipo: 'practica' | 'examen' | null; modalidad: Modalidad | null; titulo: string;
  lecciones: string[]; n: number | null; niveles: Record<Nivel, number>;
  abre: string | null; cierra: string | null; duracion_min: number | null; intentos: number | null; instrucciones: string;
}
export const BORRADOR_VACIO: BorradorIA = {
  seccion_id: null, tipo: null, modalidad: null, titulo: '', lecciones: [], n: null, niveles: { basico: 30, intermedio: 50, desafiante: 20 },
  abre: null, cierra: null, duracion_min: null, intentos: null, instrucciones: '',
};

/** La República Dominicana no tiene horario de verano: siempre UTC−4. */
export function localAISO(local: string | null): string | null {
  if (!local || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00-04:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface EjercicioBanco { id: string; lesson_id: string | null; difficulty: Nivel; format: string; published: boolean }
export interface Seleccion { ids: string[]; faltan: { leccion_id: string; nivel: Nivel; cuantos: number }[]; sustituidas: number }

/** Mezcla reproducible (Fisher-Yates con semilla). */
function barajar<T>(xs: T[], semilla: number): T[] {
  let s = semilla >>> 0 || 1;
  const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const ORDEN_SUSTITUTOS: Record<Nivel, Nivel[]> = { basico: ['intermedio', 'desafiante'], intermedio: ['basico', 'desafiante'], desafiante: ['intermedio', 'basico'] };

/**
 * Elige n preguntas PUBLICADAS del banco repartidas por igual entre las lecciones y con la mezcla de niveles pedida.
 * Si en una lección no hay suficientes de un nivel, usa el nivel más cercano de la misma lección (y lo cuenta); si aun
 * así faltan, lo informa (el profesor puede generarlas con IA o crear la actividad con las disponibles).
 */
export function seleccionar(banco: EjercicioBanco[], lecciones: string[], n: number, niveles: Record<Nivel, number>, semilla = 1): Seleccion {
  const ids: string[] = [], faltan: Seleccion['faltan'] = [];
  let sustituidas = 0;
  if (!lecciones.length || n <= 0) return { ids, faltan, sustituidas };
  const porLeccion = reparto(n, Object.fromEntries(lecciones.map((l) => [l, 1])) as Record<string, number>);
  lecciones.forEach((l, li) => {
    const cuotas = reparto(porLeccion[l], niveles);
    const disponibles: Record<Nivel, string[]> = { basico: [], intermedio: [], desafiante: [] };
    for (const e of barajar(banco.filter((x) => x.published && x.lesson_id === l), semilla + li * 7919)) disponibles[e.difficulty]?.push(e.id);
    for (const nivel of ['basico', 'intermedio', 'desafiante'] as Nivel[]) {
      let quedan = cuotas[nivel];
      while (quedan > 0 && disponibles[nivel].length) { ids.push(disponibles[nivel].shift()!); quedan--; }
      for (const alt of ORDEN_SUSTITUTOS[nivel]) {
        while (quedan > 0 && disponibles[alt].length) { ids.push(disponibles[alt].shift()!); quedan--; sustituidas++; }
      }
      if (quedan > 0) faltan.push({ leccion_id: l, nivel, cuantos: quedan });
    }
  });
  return { ids, faltan, sustituidas };
}

/** Borrador del asistente «+ Crear actividad» a partir del borrador de la IA y las preguntas elegidas. */
export function aBorradorActividad(b: BorradorIA, preguntas: string[], publicar: boolean, ahora = new Date()): Borrador {
  const m = b.modalidad ?? (b.tipo === 'examen' ? 'parcial' : 'libre');
  const base = borradorDesde(MODALIDADES[m].plantilla, ahora);
  const examen = base.examen && b.duracion_min ? { ...base.examen, duracion_s: Math.round(b.duracion_min * 60) } : base.examen;
  return {
    ...base,
    titulo: b.titulo.trim(),
    instrucciones: b.instrucciones.trim(),
    opens_at: localAISO(b.abre),
    closes_at: localAISO(b.cierra) ?? base.closes_at,
    max_attempts: b.intentos ?? base.max_attempts,
    examen,
    preguntas: preguntas.map((exercise_id) => ({ exercise_id, points: null })),
    publicar,
  };
}

/** ¿Se puede crear ya? Errores del asistente clásico más los propios del borrador de la IA. */
export function comprobar(b: BorradorIA, preguntas: string[], publicar: boolean): { errores: string[]; avisos: string[] } {
  const r = revisar(aBorradorActividad(b, preguntas, publicar));
  if (!b.seccion_id) r.errores.unshift('Falta la sección.');
  if (b.abre && !localAISO(b.abre)) r.errores.push('La fecha de apertura no es válida.');
  if (b.cierra && !localAISO(b.cierra)) r.errores.push('La fecha de cierre no es válida.');
  if (publicar && b.abre && localAISO(b.abre)! < new Date().toISOString()) r.avisos.push('La apertura ya pasó: se abrirá en cuanto la publique.');
  return r;
}

export const fmtLocal = (local: string | null) => {
  const iso = localAISO(local);
  return iso ? new Date(iso).toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—';
};
