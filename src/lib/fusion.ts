/** Fusión de cuentas: lógica pura de presentación (las reglas y las comprobaciones están en el servidor). */
import type { ActividadComparada, Conflicto, Decision } from '@/api/fusion';

/** Nombre legible de cada tabla trasladada. */
export const NOMBRE_TABLA: Record<string, string> = {
  attempts: 'Intentos de actividades', responses: 'Respuestas', response_revisions: 'Revisiones de respuestas', response_events: 'Eventos de respuestas',
  attempt_snapshots: 'Instantáneas de entrega', attempt_active_time: 'Tiempo activo de prácticas', assisted_steps: 'Pasos de práctica asistida',
  exam_sessions: 'Sesiones de examen', exam_events: 'Eventos de examen', exam_intervals: 'Intervalos de examen', exam_item_events: 'Eventos de preguntas de examen',
  exam_adaptive_state: 'Estado de examen adaptativo', telemetry_events: 'Telemetría', telemetry_v2_events: 'Telemetría (v2)',
  pes_asignaciones: 'Prácticas extraordinarias asignadas', pes_estado: 'Estado en prácticas extraordinarias', pes_respuestas: 'Respuestas de prácticas extraordinarias',
  pes_controles: 'Controles de prácticas extraordinarias', grade_entries: 'Notas del registro', grade_part_scores: 'Partes de notas del registro',
  grade_history: 'Historial de notas', enrollments: 'Matrículas en secciones', control_assignments: 'Prácticas de control', reading_progress: 'Lecturas cronometradas',
  attendance_records: 'Asistencia', attendance_quorum_requests: 'Solicitudes de asistencia', live_message_recipients: 'Mensajes recibidos',
  quick_poll_recipients: 'Preguntas relámpago', upload_permissions: 'Permisos de entrega', hist_cierres: 'Cierres de regularización',
  hist_libre_avisos: 'Avisos de prácticas sin correo', lost_alerts: 'Alertas de puntos perdidos', orbe_ia_deliveries: 'Contenido de Orbe IA visto',
  duplicate_requests: 'Solicitudes por archivos repetidos', extra_points: 'Puntos extra', hist_captures: 'Capturas de regularización',
  hist_declarations: 'Declaraciones de regularización', hist_libres: 'Prácticas sin envío por correo', hist_libre_fotos: 'Fotos de prácticas sin correo',
  hist_suggestions: 'Sugerencias de regularización', upload_files: 'Entregas en PDF', upload_fingerprints: 'Huellas de archivos',
  attendance_rejections: 'Rechazos de asistencia', study_visits: 'Tiempo de estudio', screen_locks: 'Bloqueos de pantalla',
};

export const TEXTO_DECISION: Record<Decision, string> = {
  principal: 'Vale la de la cuenta principal',
  secundaria: 'Vale la de la cuenta secundaria',
  pendiente: 'Pendiente (no se traslada; las notas no cambian)',
};

export const TEXTO_CATEGORIA: Record<ActividadComparada['categoria'], string> = {
  solo_principal: 'Solo en la principal', solo_secundaria: 'Solo en la secundaria', ambas: 'En las dos (conflicto)',
};

/** Conflictos que todavía no tienen decisión. */
export function sinDecidir(conflictos: Conflicto[], decisiones: Record<string, Decision>): Conflicto[] {
  return conflictos.filter((c) => !decisiones[c.clave] || !c.opciones.includes(decisiones[c.clave]));
}

/** Impacto en las notas de la principal (mejor intento entregado por actividad), solo donde cambia algo. */
export function impactoNotas(antes: Record<string, number>, despues: Record<string, number> | undefined, actividades: ActividadComparada[]) {
  if (!despues) return [];
  const titulo = new Map(actividades.map((a) => [a.activity_id, a.titulo]));
  const ids = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
  return ids
    .map((id) => ({ activity_id: id, titulo: titulo.get(id) ?? 'Actividad', antes: antes[id] ?? null, despues: despues[id] ?? null }))
    .filter((x) => x.antes !== x.despues)
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
}

export function duracion(s: number): string {
  const m = Math.round((s ?? 0) / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
