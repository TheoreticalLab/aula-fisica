/** Telemetría V2: lectura auditada de un intento, bandera por asignatura y monitor (la autorización la impone el servidor). */
import { rpc } from '@/lib/supabase';
import type { PaqueteIntento } from '@/lib/telemetria/v2/fuente';

const ausente = (e: unknown) => /Could not find the function|PGRST202|schema cache/i.test(e instanceof Error ? e.message : String(e));

/** null si la migración 42 aún no está en la base. */
export const telemetriaIntento = (attemptId: string) =>
  rpc<PaqueteIntento>('telemetria_v2_intento', { p_attempt: attemptId }).catch((e) => { if (ausente(e)) return null; throw e; });

export const banderaV2 = (courseId: string) =>
  rpc<boolean>('telemetry_v2_flag', { p_course: courseId }).catch((e) => { if (ausente(e)) return null; throw e; });

export const fijarBanderaV2 = (courseId: string, activo: boolean) => rpc<void>('telemetry_v2_set', { p_course: courseId, p_activo: activo });

export interface MonitorV2 {
  ingesta: { hora: string; lotes: number; aceptados: number; duplicados: number; rechazados: number }[];
  por_tipo: Record<string, number>;
  calidad: Record<string, number>;
  pendientes_max: number | null;
  banderas: { course_id: string; activo: boolean; updated_at: string }[];
  revisiones_24h: number;
  instantaneas_24h: number;
}
export const monitorV2 = (horas = 48) => rpc<MonitorV2>('telemetry_v2_monitor', { p_horas: horas }).catch((e) => { if (ausente(e)) return null; throw e; });
