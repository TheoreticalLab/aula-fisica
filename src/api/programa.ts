/** Programa académico con seguimiento de lo impartido (migración 71). */
import { rpc } from '@/lib/supabase';
import type { ProgramaMio, ProgramaSeccion, TipoEnlace } from '@/lib/programa';

export const programaMio = (courseId: string) => rpc<ProgramaMio | null>('programa_mio', { p_course: courseId });
export const programaSeccion = (classId: string) => rpc<ProgramaSeccion>('programa_seccion', { p_class: classId });
export const programaMarcar = (classId: string, concepts: string[], fecha: string, sessionId: string | null, nota: string | null) =>
  rpc<number>('programa_marcar', { p_class: classId, p_concepts: concepts, p_fecha: fecha, p_session: sessionId, p_nota: nota });
export const programaDesmarcar = (id: string) => rpc<void>('programa_desmarcar', { p_id: id });

export interface EnlaceDocente {
  id: string; tipo: TipoEnlace; titulo: string; descripcion: string; url: string | null; activity_id: string | null; exercise_id: string | null;
  session_id: string | null; sim_key: string | null; concept_id: string | null; class_id: string | null; seccion: string | null; publicado: boolean; position: number;
}
export interface NotaDocente { id: string; texto: string; concept_id: string | null; class_id: string | null; seccion: string | null; autor: string | null; created_at: string }
export interface CapituloDocente {
  enlaces: EnlaceDocente[]; notas: NotaDocente[];
  secciones: { id: string; nombre: string }[];
  actividades: { id: string; titulo: string; modo: string; class_id: string }[];
  sesiones: { id: string; fecha: string; titulo: string; class_id: string }[];
}
export const programaCapitulo = (lessonId: string) => rpc<CapituloDocente>('programa_capitulo', { p_lesson: lessonId });
export const programaEnlaceGuardar = (p: Partial<EnlaceDocente> & { lesson_id?: string }) => rpc<string>('programa_enlace_guardar', { p });
export const programaEnlaceRetirar = (id: string) => rpc<void>('programa_enlace_retirar', { p_id: id });
export const programaNotaGuardar = (lessonId: string, texto: string, conceptId: string | null, classId: string | null) =>
  rpc<string>('programa_nota_guardar', { p_lesson: lessonId, p_texto: texto, p_concept: conceptId, p_class: classId });
export const programaNotaRetirar = (id: string) => rpc<void>('programa_nota_retirar', { p_id: id });
