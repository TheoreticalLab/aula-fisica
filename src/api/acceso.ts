/** Acceso sin contraseña y recuperación supervisada (migración 77 y Edge Function «recuperar»). */
import { invocar, rpc } from '@/lib/supabase';
import type { EstadoSolicitud, MetodoVerificacion } from '@/lib/acceso';

export interface ConfigPublica { passkeys: boolean; recuperacion: boolean; monitores: boolean; minutos_solicitud: number; inactividad_dias?: number | null }

export interface SeccionAcceso {
  class_id: string; seccion: string; curso: string; papel: 'admin' | 'profesor' | 'monitor';
  recuperacion: boolean; monitores: boolean; pendientes: number;
}

export interface ConfigAcceso {
  passkeys: boolean; recuperacion: boolean; recuperacion_monitores: boolean; minutos_solicitud: number; minutos_aprobacion: number;
  horas_sesion_reciente: number; max_aprobaciones_monitor_dia: number; updated_at: string;
}

export interface PanelAcceso {
  passkeys: boolean; recuperacion: boolean; monitores: boolean; config: ConfigAcceso | null;
  secciones: SeccionAcceso[]; sesion_reciente: boolean; alertas: number | null;
}

export interface SolicitudAcceso {
  id: string; flujo_id: string; created_at: string; expires_at: string; estado: EstadoSolicitud; destinatario: 'profesor' | 'monitor';
  class_id: string; seccion: string; curso: string; estudiante: string; estudiante_nombre: string; estudiante_login: string | null;
  aprobada_por: string | null; aprobada_por_nombre: string | null; aprobada_rol: string | null; aprobada_at: string | null; aprobada_hasta: string | null;
  metodo_verificacion: string | null; nota_verificacion: string | null; cerrada_por_nombre: string | null; cerrada_at: string | null; motivo: string | null;
  completada_at: string | null; intentos_codigo: number; navegador: string | null; dispositivo: string | null; otras_activas: number; mi_papel: string;
}

export interface EventoAcceso {
  id: number; created_at: string; actor: string | null; actor_nombre: string | null; actor_rol: string; class_id: string | null; seccion: string | null;
  estudiante: string | null; estudiante_nombre: string | null; estudiante_login: string | null; solicitud: string | null;
  accion: string; metodo: string | null; resultado: 'ok' | 'rechazado' | 'error'; motivo: string | null;
}

export interface AlertaAcceso {
  id: number; created_at: string; tipo: string; class_id: string | null; seccion: string | null; actor: string | null; actor_nombre: string | null;
  estudiante: string | null; estudiante_nombre: string | null; solicitud: string | null; detalle: string | null; atendida_at: string | null; atendida_por_nombre: string | null;
}

export interface MonitorAcceso { user_id: string; full_name: string; login_id: string | null; delegado: boolean; otorgado_at: string | null; aprobaciones_24h: number }

export interface ResultadoAccion { ok: boolean; error?: string; codigo?: string; estado?: string; aprobada_hasta?: string }

export interface FiltrosSolicitudes {
  estados?: EstadoSolicitud[] | null; class_id?: string | null; desde?: string | null; hasta?: string | null; buscar?: string | null;
  actor?: string | null; rol?: string | null;
}

// --- sin sesión (Edge Function «recuperar») ---------------------------------------------------
export const configPublica = () => invocar<ConfigPublica>('recuperar', { accion: 'config' });
export const solicitarAcceso = (id: string, destinatario: 'profesor' | 'monitor', secreto: string, install_id: string | null) =>
  invocar<{ solicitud: string; codigo: string; expira: string }>('recuperar', { accion: 'solicitar', id, destinatario, secreto, install_id });
export const estadoSolicitud = (solicitud: string, secreto: string) =>
  invocar<{ estado: EstadoSolicitud; expira: string | null; aprobada_hasta: string | null }>('recuperar', { accion: 'estado', solicitud, secreto });
export const completarAcceso = (solicitud: string, secreto: string) =>
  invocar<{ token_hash: string; tipo: 'magiclink' | 'email' }>('recuperar', { accion: 'completar', solicitud, secreto });

// --- con sesión --------------------------------------------------------------------------------
export const panelAcceso = () => rpc<PanelAcceso>('acceso_estado_panel');
export const solicitudesAcceso = (f: FiltrosSolicitudes = {}) => rpc<SolicitudAcceso[]>('acceso_solicitudes_lista', {
  p_estados: f.estados ?? null, p_class: f.class_id ?? null, p_desde: f.desde ?? null, p_hasta: f.hasta ?? null,
  p_buscar: f.buscar || null, p_actor: f.actor ?? null, p_rol: f.rol ?? null, p_limite: 300,
});
export const aprobarAcceso = (solicitud: string, codigo: string, metodo: MetodoVerificacion, nota: string) =>
  rpc<ResultadoAccion>('acceso_aprobar', { p_solicitud: solicitud, p_codigo: codigo, p_metodo: metodo, p_nota: nota || null });
export const cerrarAcceso = (solicitud: string, accion: 'rechazar' | 'revocar' | 'cancelar', motivo: string) =>
  rpc<ResultadoAccion>('acceso_cerrar', { p_solicitud: solicitud, p_accion: accion, p_motivo: motivo });
export const eventosAcceso = (f: { class_id?: string | null; solicitud?: string | null; desde?: string | null; hasta?: string | null; actor?: string | null } = {}) =>
  rpc<EventoAcceso[]>('acceso_eventos_lista', { p_class: f.class_id ?? null, p_solicitud: f.solicitud ?? null, p_desde: f.desde ?? null, p_hasta: f.hasta ?? null, p_actor: f.actor ?? null, p_limite: 500 });
export const alertasAcceso = (todas = false) => rpc<AlertaAcceso[]>('acceso_alertas_lista', { p_todas: todas });
export const atenderAlerta = (id: number) => rpc<void>('acceso_alerta_atender', { p_id: id });
export const guardarConfigAcceso = (c: Partial<{ passkeys: boolean; recuperacion: boolean; monitores: boolean; minutos_solicitud: number; minutos_aprobacion: number; horas_sesion: number; max_monitor_dia: number }>) =>
  rpc<ConfigAcceso>('acceso_config_guardar', {
    p_passkeys: c.passkeys ?? null, p_recuperacion: c.recuperacion ?? null, p_monitores: c.monitores ?? null,
    p_minutos_solicitud: c.minutos_solicitud ?? null, p_minutos_aprobacion: c.minutos_aprobacion ?? null, p_horas_sesion: c.horas_sesion ?? null,
    p_max_monitor_dia: c.max_monitor_dia ?? null,
  });
export const guardarSeccionAcceso = (class_id: string, recuperacion: boolean, monitores: boolean) =>
  rpc<unknown>('acceso_seccion_guardar', { p_class: class_id, p_recuperacion: recuperacion, p_monitores: monitores });
export const monitoresAcceso = (class_id: string) => rpc<MonitorAcceso[]>('acceso_monitores_lista', { p_class: class_id });
export const permisoMonitor = (class_id: string, user_id: string, activo: boolean) =>
  rpc<ResultadoAccion>('acceso_monitor_permiso', { p_class: class_id, p_user: user_id, p_activo: activo });
export const anotarEventoPropio = (accion: 'passkey_registrada' | 'passkey_eliminada' | 'ingreso_passkey') =>
  rpc<void>('acceso_evento_propio', { p_accion: accion }).catch(() => undefined);   // constancia: nunca bloquea al usuario
