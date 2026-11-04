/**
 * Acceso sin contraseña y recuperación supervisada: lógica pura compartida por el aula y Orbe Control.
 * Nada de esto concede permisos: lo decide el servidor (migración 77 y Edge Function «recuperar»).
 */

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'vencida' | 'cancelada' | 'revocada' | 'completada' | 'desconocida';
export type MetodoVerificacion = 'carnet' | 'cedula' | 'conocimiento_personal' | 'otro_documento';
export type Pestana = 'pendientes' | 'aprobadas' | 'rechazadas' | 'historial';

export const ESTADO_SOLICITUD: Record<EstadoSolicitud, { texto: string; tono: 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple' }> = {
  pendiente: { texto: 'Pendiente', tono: 'amber' },
  aprobada: { texto: 'Aprobada (sin canjear)', tono: 'blue' },
  completada: { texto: 'Acceso recuperado', tono: 'green' },
  rechazada: { texto: 'Rechazada', tono: 'red' },
  cancelada: { texto: 'Cancelada', tono: 'gray' },
  revocada: { texto: 'Revocada', tono: 'purple' },
  vencida: { texto: 'Vencida', tono: 'gray' },
  desconocida: { texto: 'Desconocida', tono: 'gray' },
};

export const METODOS: { id: MetodoVerificacion; texto: string }[] = [
  { id: 'carnet', texto: 'Carné universitario' },
  { id: 'cedula', texto: 'Cédula de identidad' },
  { id: 'otro_documento', texto: 'Otro documento con foto' },
  { id: 'conocimiento_personal', texto: 'Lo conozco personalmente' },
];

export const METODO_TEXTO: Record<string, string> = Object.fromEntries(METODOS.map((m) => [m.id, m.texto]));

/** Estados de cada pestaña del panel (historial = eventos de auditoría, no solicitudes). */
export const ESTADOS_PESTANA: Record<Exclude<Pestana, 'historial'>, EstadoSolicitud[]> = {
  pendientes: ['pendiente'],
  aprobadas: ['aprobada', 'completada'],
  rechazadas: ['rechazada', 'cancelada', 'revocada', 'vencida'],
};

export const ACCION_EVENTO: Record<string, string> = {
  solicitar: 'Solicitud', aprobar: 'Aprobación', rechazar: 'Rechazo', revocar: 'Revocación', cancelar: 'Cancelación', vencer: 'Vencimiento',
  canjear: 'Canje en el dispositivo', emitir_token: 'Emisión del token', configurar: 'Configuración general', configurar_seccion: 'Configuración de la sección',
  otorgar_permiso: 'Permiso otorgado al monitor', retirar_permiso: 'Permiso retirado al monitor', atender_alerta: 'Alerta atendida',
  passkey_registrada: 'Passkey registrada', passkey_eliminada: 'Passkey eliminada', ingreso_passkey: 'Ingreso con passkey',
};

export const ALERTA_TEXTO: Record<string, string> = {
  monitor_exceso: 'Monitor con demasiadas aprobaciones',
  cuenta_muchas_solicitudes: 'Muchas solicitudes para la misma cuenta',
  mismo_dispositivo: 'Solicitud desde un dispositivo del monitor',
  codigo_fallido: 'Códigos incorrectos repetidos',
  ip_muchas_solicitudes: 'Muchas solicitudes desde la misma red',
  cuenta_no_elegible: 'Intento de recuperar una cuenta de profesor o administrador',
  canje_fallido: 'Canje fallido',
  monitor_aprobo: 'Aprobación de un monitor (para supervisión)',
};

export const ROL_TEXTO: Record<string, string> = {
  estudiante: 'Estudiante', monitor: 'Monitor', profesor: 'Profesor', admin: 'Administrador', sistema: 'Sistema', anonimo: 'Sin sesión',
};

/** Secreto del dispositivo: 32 bytes aleatorios en hexadecimal (64 caracteres). */
export function secretoHex(bytes: Uint8Array): string {
  if (bytes.length !== 32) throw new Error('Se necesitan 32 bytes');
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function nuevoSecreto(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return secretoHex(b);
}

/** «ACDEFG» → «ACD EFG» (más fácil de leer en voz alta). */
export function formatoCodigo(c: string): string {
  const x = normalizarCodigo(c);
  return x.length === 6 ? `${x.slice(0, 3)} ${x.slice(3)}` : x;
}

/** Lo que escribe el profesor o el monitor: sin espacios ni guiones, en mayúsculas. */
export function normalizarCodigo(c: string): string {
  return (c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** Tiempo restante «m:ss» (o «0:00»). */
export function restante(hastaIso: string | null | undefined, ahoraMs: number): string {
  if (!hastaIso) return '';
  const s = Math.max(0, Math.floor((Date.parse(hastaIso) - ahoraMs) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** ¿Puede este navegador usar passkeys (WebAuthn)? */
export function soportaPasskeys(w: { PublicKeyCredential?: unknown; isSecureContext?: boolean } | undefined): boolean {
  return !!w && !!w.PublicKeyCredential && w.isSecureContext !== false;
}

/** Solicitud en curso en ESTA pestaña (sessionStorage: se pierde al cerrar la pestaña; el secreto no sale del dispositivo). */
export interface Pendiente {
  solicitud: string;
  secreto: string;
  codigo: string;
  expira: string;
  destinatario: 'profesor' | 'monitor';
}
const CLAVE_PENDIENTE = 'aula-recuperacion';

export function guardarPendiente(s: Pick<Storage, 'setItem'>, p: Pendiente): void {
  s.setItem(CLAVE_PENDIENTE, JSON.stringify(p));
}

export function leerPendiente(s: Pick<Storage, 'getItem'>, ahoraMs: number): Pendiente | null {
  try {
    const p = JSON.parse(s.getItem(CLAVE_PENDIENTE) ?? 'null') as Pendiente | null;
    if (!p || !/^[0-9a-f]{64}$/.test(p.secreto) || !p.solicitud || Date.parse(p.expira) <= ahoraMs) return null;
    return p;
  } catch {
    return null;
  }
}

export function borrarPendiente(s: Pick<Storage, 'removeItem'>): void {
  s.removeItem(CLAVE_PENDIENTE);
}

/** Estados en que el dispositivo deja de consultar. */
export function esFinal(e: EstadoSolicitud): boolean {
  return e !== 'pendiente' && e !== 'aprobada';
}

/** Lo que necesita el dispositivo del estudiante para avanzar (Edge Function «recuperar» y Supabase Auth). */
export interface DepsRecuperacion {
  estado(solicitud: string, secreto: string): Promise<{ estado: EstadoSolicitud }>;
  completar(solicitud: string, secreto: string): Promise<{ token_hash: string; tipo: 'magiclink' | 'email' }>;
  /** supabase.auth.verifyOtp({ token_hash, type }): es Supabase Auth quien crea la sesión. */
  verificarOtp(token_hash: string, tipo: 'magiclink' | 'email'): Promise<{ error: unknown }>;
}

/**
 * Un paso del dispositivo: consulta el estado y, si está aprobada, canjea (un solo uso) y verifica el token.
 * Devuelve sesion=true solo si Supabase Auth aceptó el token. Nunca crea sesiones por su cuenta.
 */
export async function pasoRecuperacion(p: Pick<Pendiente, 'solicitud' | 'secreto'>, d: DepsRecuperacion): Promise<{ estado: EstadoSolicitud; sesion: boolean }> {
  const r = await d.estado(p.solicitud, p.secreto);
  if (r.estado !== 'aprobada') return { estado: r.estado, sesion: false };
  const t = await d.completar(p.solicitud, p.secreto);
  const { error } = await d.verificarOtp(t.token_hash, t.tipo);
  if (error) throw error;
  return { estado: 'completada', sesion: true };
}

/** Mensaje para el estudiante según el estado de su solicitud. */
export function mensajeEstado(e: EstadoSolicitud): string {
  switch (e) {
    case 'pendiente': return 'Esperando la verificación presencial.';
    case 'aprobada': return 'Aprobada. Entrando…';
    case 'completada': return 'Esta solicitud ya se usó.';
    case 'rechazada': return 'La solicitud fue rechazada. Hable con su profesor.';
    case 'revocada': return 'La aprobación fue revocada. Pida una nueva solicitud.';
    case 'cancelada': return 'La solicitud fue cancelada. Pida una nueva si la necesita.';
    case 'vencida': return 'La solicitud venció. Pida una nueva.';
    default: return 'No se encontró la solicitud en este dispositivo. Pida una nueva.';
  }
}
