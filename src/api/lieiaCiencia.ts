/** LIEIA · laboratorio científico: carga de datos (existentes) y persistencia (migración 48). */
import { rpc, supabase } from '@/lib/supabase';
import { bankPerformance, createActivity, listBankMeta, roster, setActivityItems } from './docente';
import type { Calibracion } from '@/lib/lieia/diseno';
import type { DatosRealesExamen } from '@/lib/lieia/datosReales';
import type { Exercise } from './tipos';
import type { MetaBanco } from '@/lib/banco';
import { analizarContenido } from '@/lib/lieia/ciencia/contenido';
import type { DatosReales, Pregunta } from '@/lib/lieia/ciencia/modelo';
import type { Diseno, ItemBancoCiencia } from '@/lib/lieia/ciencia/disenador';

export interface ActividadLab { id: string; titulo: string; modo: string; cierra: string | null; entregados: number; con_tiempos: number; items: number }
export const actividades = (classId: string) => rpc<ActividadLab[]>('lieia_activities', { p_class: classId });

const aPregunta = (e: Exercise, posicion: number, meta: MetaBanco | null): Pregunta => ({
  id: e.id, posicion, prompt: e.prompt, format: e.format, category: e.category, difficulty: e.difficulty, concepts: e.concepts ?? [],
  opciones: e.options?.length ?? null, unit_hint: e.unit_hint, meta, published: e.published,
});

/** Preguntas del examen (contenido + metadatos del banco) y sus respuestas reales seudonimizadas. */
export async function cargarExamen(activityId: string, courseId: string): Promise<{ preguntas: Pregunta[]; datos: DatosReales | null; avisoDatos: string | null }> {
  const { data: items, error } = await supabase.from('activity_items').select('exercise_id, position').eq('activity_id', activityId).order('position');
  if (error) throw new Error(error.message);
  const ids = (items ?? []).map((i) => i.exercise_id as string);
  const [{ data: ex, error: e2 }, metas] = await Promise.all([
    supabase.from('exercises').select('*').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
    listBankMeta(courseId).catch(() => [] as { exercise_id: string; meta: MetaBanco }[]),
  ]);
  if (e2) throw new Error(e2.message);
  const meta = new Map(metas.map((m) => [m.exercise_id, m.meta]));
  const preguntas = (items ?? []).map((it, k) => {
    const e = (ex as Exercise[]).find((x) => x.id === it.exercise_id);
    return e ? aPregunta(e, k + 1, meta.get(e.id) ?? null) : null;
  }).filter((p): p is Pregunta => !!p);
  let datos: DatosReales | null = null, avisoDatos: string | null = null;
  try {
    const d = await rpc<DatosRealesExamen>('lieia_exam_data', { p_activity: activityId });
    datos = d.estudiantes.length ? { items: d.items, estudiantes: d.estudiantes as DatosReales['estudiantes'], con_tiempos: d.con_tiempos, diseno: d.diseno ?? null } : null;
  } catch (e) {
    avisoDatos = `No se pudieron leer las respuestas: ${e instanceof Error ? e.message : String(e)}. El análisis se hace solo con el contenido.`;
  }
  return { preguntas, datos, avisoDatos };
}

/** Banco de la asignatura para el diseñador, con el rendimiento histórico agregado y la calibración TRI guardada (la más reciente). */
export async function cargarBanco(courseId: string): Promise<ItemBancoCiencia[]> {
  const [{ data: ex, error }, metas, rend, cals] = await Promise.all([
    supabase.from('exercises').select('*').eq('course_id', courseId),
    listBankMeta(courseId).catch(() => [] as { exercise_id: string; meta: MetaBanco }[]),
    bankPerformance(courseId).catch(() => []),
    rpc<{ exercise_id: string; calibracion: Calibracion | null }[]>('calibration_bank', { p_course: courseId }).catch(() => []),
  ]);
  if (error) throw new Error(error.message);
  const meta = new Map(metas.map((m) => [m.exercise_id, m.meta]));
  const r = new Map(rend.map((x) => [x.exercise_id, x]));
  const cal = new Map((cals ?? []).filter((c) => c.calibracion).map((c) => [c.exercise_id, c.calibracion]));
  return (ex as Exercise[]).filter((e) => e.published).map((e, k) => {
    const p = aPregunta(e, k + 1, meta.get(e.id) ?? null);
    const h = r.get(e.id);
    return { pregunta: p, analisis: analizarContenido(p), historico: h && h.respuestas ? { p: h.correctas / h.respuestas, n: h.respuestas, discriminacion: null } : null, cal: cal.get(e.id) ?? null };
  });
}

export interface VersionCalibracion { exercise_id: string; a: number; b: number; se_a: number; se_b: number; n_resp: number; estado: string; metodo: string; calibrated_at: string }
/** Versiones sucesivas de la calibración de cada pregunta (migración 49). */
export const historialCalibracion = (courseId: string) => rpc<VersionCalibracion[]>('calibration_history', { p_course: courseId });
/** Subgrupo de cada seudónimo del examen (mismos seudónimos que lieia_exam_data; sin nombres). */
export const gruposExamen = (activityId: string) => rpc<{ seudonimo: string; grupo: string | null }[]>('lieia_exam_groups', { p_activity: activityId });
export { roster };

// --- persistencia ------------------------------------------------------------------------------------------------
export type Kind = 'investigacion' | 'diseno' | 'revision' | 'informe';
export type EstadoLab = 'propuesta' | 'guardada' | 'aceptada' | 'pospuesta' | 'descartada' | 'aplicada';
export interface RegistroLab { id: string; activity_id: string | null; kind: Kind; clave: string; version_examen: string | null; estado: EstadoLab; payload: Record<string, unknown>; procedencia: Record<string, unknown>; historial: unknown[]; updated_at: string }
export const listar = (classId: string, activityId: string | null) => rpc<RegistroLab[]>('lieia_lab_listar', { p_class: classId, p_activity: activityId });
export const guardar = (r: { classId: string; activityId: string | null; kind: Kind; clave: string; version: string | null; estado: EstadoLab; payload: object; procedencia: object }) =>
  rpc<string>('lieia_lab_guardar', { p_class: r.classId, p_activity: r.activityId, p_kind: r.kind, p_clave: r.clave, p_version: r.version, p_estado: r.estado, p_payload: r.payload, p_procedencia: r.procedencia });
export const cambiarEstado = (id: string, estado: EstadoLab) => rpc<void>('lieia_lab_estado', { p_id: id, p_estado: estado });

/** Crea el examen como BORRADOR oculto (nunca publicado) con las preguntas del diseño; dos si el diseño tiene versiones. */
export async function crearBorrador(classId: string, d: Diseno, metodologia: string): Promise<string[]> {
  const versiones = d.items.some((i) => i.version) ? (['A', 'B'] as const) : [null];
  const ids: string[] = [];
  for (const v of versiones) {
    const act = await createActivity({
      class_id: classId, title: `${d.titulo}${v ? ` · ${d.etiquetasVersion?.[v] ?? `versión ${v}`}` : ''}`, mode: 'exam', published: false, reveal_policy: 'after_submit', hints_enabled: false,
      instructions: metodologia,
    });
    await setActivityItems(act.id, d.items.filter((i) => !v || i.version === v).map((i) => ({ exercise_id: i.id, points: null })));
    ids.push(act.id);
  }
  return ids;
}
