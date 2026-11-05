/** Fusión de cuentas duplicadas de estudiantes (migración 82). Todo lo decide y comprueba el servidor. */
import { rpc } from '@/lib/supabase';

export type Decision = 'principal' | 'secundaria' | 'pendiente';

export interface ResumenCuenta {
  id: string; login_id: string | null; nombre: string; matricula: string | null; rol: string; activa: boolean; creada: string; fusionada: boolean;
  secciones: { id: string; nombre: string; asignatura: string }[]; practicas: number; practicas_completadas: number; examenes: number; intentos: number;
  notas_manuales: number; promedio_mejores: number | null; practicas_extraordinarias: number; entregas_pdf: number; tiempo_s: number; ultimo_acceso: string | null;
}
export interface Conflicto {
  clave: string; tipo: 'actividad' | 'nota' | 'parte' | 'pes'; titulo: string; modo?: string;
  principal: Record<string, number | null>; secundaria: Record<string, number | null>; opciones: Decision[];
}
export interface ActividadComparada {
  activity_id: string; titulo: string; modo: 'practice' | 'exam'; seccion: string; categoria: 'ambas' | 'solo_principal' | 'solo_secundaria'; en_curso: boolean;
  principal: { intentos: number; mejor: number | null; maximo: number | null }; secundaria: { intentos: number; mejor: number | null; maximo: number | null };
}
export interface VistaPrevia {
  bloqueos: string[]; conflictos: Conflicto[]; avisos: string[]; actividades: ActividadComparada[]; principal: ResumenCuenta; secundaria: ResumenCuenta;
  huella: string; decisiones_pendientes: string[]; ejecutable: boolean; error_simulacion: string | null; notas_principal_antes: Record<string, number>;
  simulacion: { trasladadas: Record<string, number>; total: number; notas_principal_despues: Record<string, number> } | null;
}
export interface Candidato {
  cuenta_a: string; login_a: string | null; nombre_a: string; activa_a: boolean; intentos_a: number;
  cuenta_b: string; login_b: string | null; nombre_b: string; activa_b: boolean; intentos_b: number; confianza: 'alta' | 'media' | 'baja'; puntos: number; razones: string[];
}
export interface CuentaEncontrada { id: string; login_id: string | null; nombre: string; matricula: string | null; activa: boolean; fusionada: boolean; secciones: string | null; intentos: number }
export interface Operacion {
  op: string; created_at: string; estado: 'auth_pendiente' | 'completada' | 'revertida' | 'ejecutando' | 'revirtiendo'; principal: string; login_principal: string | null;
  nombre_principal: string; secundaria: string; login_secundaria: string | null; motivo: string; filas: number; auth_error: string | null; autorizado_por: string | null; revertida_at: string | null;
}

export const fusionCandidatos = (incluirPrueba = false) => rpc<Candidato[]>('fusion_candidatos', { p_incluir_prueba: incluirPrueba });
export const fusionBuscar = (texto: string) => rpc<CuentaEncontrada[]>('fusion_buscar', { p_texto: texto });
export const fusionVistaPrevia = (principal: string, secundaria: string, decisiones: Record<string, Decision>) =>
  rpc<VistaPrevia>('fusion_vista_previa', { p_principal: principal, p_secundaria: secundaria, p_decisiones: decisiones });
export const fusionEjecutar = (principal: string, secundaria: string, huella: string, decisiones: Record<string, Decision>, usarIdSecundaria: boolean, motivo: string) =>
  rpc<{ op: string; estado: string; trasladadas: Record<string, number>; total: number }>('fusion_ejecutar', {
    p_principal: principal, p_secundaria: secundaria, p_huella: huella, p_decisiones: decisiones, p_usar_id_secundaria: usarIdSecundaria, p_motivo: motivo,
  });
export const fusionRegistrarFallo = (principal: string, secundaria: string, error: string) =>
  rpc<void>('fusion_registrar_fallo', { p_principal: principal, p_secundaria: secundaria, p_error: error }).catch(() => undefined);
export const fusionAuthResultado = (op: string, ok: boolean, error?: string) => rpc<{ estado: string }>('fusion_auth_resultado', { p_op: op, p_ok: ok, p_error: error ?? null });
export const fusionRevertir = (op: string, motivo: string) => rpc<{ ok: boolean; motivo?: string; filas?: number; cambios?: { tabla: string; accion: string }[] }>('fusion_revertir', { p_op: op, p_motivo: motivo });
export const fusionHistorial = () => rpc<Operacion[]>('fusion_historial');
export const fusionDetalle = (op: string) => rpc<Record<string, unknown> & { por_tabla: Record<string, number>; eventos: { id: number; created_at: string; accion: string; resultado: string; detalle: Record<string, unknown> }[] }>('fusion_detalle', { p_op: op });
