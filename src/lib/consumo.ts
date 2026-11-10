/**
 * MODO DE BAJO CONSUMO — un solo lugar para decidir cuánto trabajo de fondo hace el aula contra Supabase.
 *
 * Motivo: que una clase entera pueda trabajar a la vez con los recursos actuales. La mayor parte del trabajo de fondo
 * eran escrituras pequeñas y repetidas (presencia, latidos de tiempo, telemetría) y consultas de sondeo que se repetían
 * aunque nada cambiara. (Informe y mediciones: en la carpeta privada del proyecto.)
 *
 * Reglas:
 *  - Lo académico NO depende de nada de este archivo: guardar respuestas, comprobar, entregar, el motor de examen,
 *    sus relojes oficiales y sus avisos siguen exactamente igual.
 *  - Los avisos que tienen canal Realtime (mensajes, bloqueo de pantalla, pregunta relámpago) siguen llegando al
 *    instante; aquí solo se alarga la consulta de RESPALDO por si el canal se cae.
 *  - Para volver al comportamiento anterior basta con cambiar `MODO_BAJO_CONSUMO` a false (usa `NORMAL`).
 *  - No hay detección automática de sobrecarga: cuesta consultas y es justo lo que se quiere evitar.
 */

export interface PerfilConsumo {
  /** Latido de conexión del estudiante para Orbe Control (`presence_ping`). El servidor da la conexión por
   *  perdida tras `presenciaCaducaS` sin latido: debe ser ≥ 2,5 × este intervalo (migración 87: 150 s). */
  presenciaMs: number;
  /** Respaldo del canal Realtime de bloqueo de pantalla (`my_screen_lock`). */
  bloqueoPantallaMs: number;
  /** Respaldo del canal Realtime de la pregunta relámpago (`my_open_poll`). */
  preguntaRelampagoMs: number;
  /** Respaldo del canal Realtime de mensajes (`my_pending_messages_v3`). */
  mensajesMs: number;
  /** Aviso de Práctica de Control (`my_control_pendiente`; no tiene canal Realtime). */
  controlPendienteMs: number;
  /** Aviso flotante de asistencia abierta (`my_open_attendance`). */
  avisoAsistenciaMs: number;
  /** Botón de asistencia del inicio (`my_open_attendance`). */
  botonAsistenciaMs: number;
  /** Las consultas de avisos no se repiten por cambiar de página si se hicieron hace menos de esto. */
  minEntreConsultasRutaMs: number;
  /** Comprobación de suspensión por inactividad al volver a la pestaña (`cuenta_presencia`; el servidor solo
   *  escribe una vez cada 5 min). */
  cuentaPresenciaMinMs: number;
  /** Latido de tiempo de estudio (`study_beat`): mínimo en segundos (el servidor sugiere 15). El servidor acredita por
   *  reloj real entre latidos, así que latir menos no pierde tiempo; el primer latido admite hasta 60 s. */
  latidoEstudioMinS: number;
  /** Vaciado periódico de las colas de telemetría (además del vaciado al ocultar o cerrar la página). */
  telemetriaVaciadoMs: number;
  /** Telemetría V1 en PRÁCTICAS cuando la asignatura ya tiene V2 (duplicaba casi todos los eventos). En exámenes V1
   *  sigue activa siempre. */
  telemetriaV1ConV2EnPracticas: boolean;
  /** Orbe IA en las lecciones (chistes/curiosidades): secundario; consume consultas y llamadas a la IA. */
  orbeIaLecciones: boolean;
  /** Tiempo máximo de una petición a la base de datos antes de darla por fallida (evita «Cargando» eterno). */
  peticionTimeoutMs: number;
  /** Ídem para Edge Functions (calificar, IA, entregas…). Debe superar el límite de la pasarela de Supabase (150 s):
   *  así el navegador nunca abandona un «Comprobar» que el servidor todavía podría completar (repetirlo gasta un intento). */
  funcionTimeoutMs: number;
  /** Orbe Control: consulta de respaldo de la lista de conectados (Realtime avisa de los cambios). */
  controlOnlineMs: number;
  /** Orbe Control: historial de mensajes. */
  controlHistorialMs: number;
  /** Orbe Control: alertas de seguridad (solo administrador). */
  controlAlertasMs: number;
  /** Orbe Control: recargas por Realtime agrupadas como máximo una cada… */
  controlAgruparMs: number;
  /** Centro de mando del profesor (`tablero_docente`): una sola consulta de lectura con todo el tablero. */
  tableroDocenteMs: number;
  /** Los paneles docentes no consultan con la pestaña oculta (al volver, consultan al momento). */
  pausarOculto: boolean;
}

/** Comportamiento anterior (hasta el 5 de noviembre de 2026), por si hubiera que volver. */
export const NORMAL: PerfilConsumo = {
  presenciaMs: 25_000,
  bloqueoPantallaMs: 20_000,
  preguntaRelampagoMs: 15_000,
  mensajesMs: 60_000,
  controlPendienteMs: 10_000,
  avisoAsistenciaMs: 30_000,
  botonAsistenciaMs: 20_000,
  minEntreConsultasRutaMs: 0,
  cuentaPresenciaMinMs: 0,
  latidoEstudioMinS: 0,
  telemetriaVaciadoMs: 10_000,
  telemetriaV1ConV2EnPracticas: true,
  orbeIaLecciones: true,
  peticionTimeoutMs: 0,
  funcionTimeoutMs: 0,
  controlOnlineMs: 10_000,
  controlHistorialMs: 20_000,
  controlAlertasMs: 120_000,
  controlAgruparMs: 600,
  tableroDocenteMs: 30_000,
  pausarOculto: false,
};

/** Modo de bajo consumo (permanente desde el 6 de noviembre de 2026). */
export const BAJO_CONSUMO: PerfilConsumo = {
  presenciaMs: 50_000,
  bloqueoPantallaMs: 90_000,
  preguntaRelampagoMs: 90_000,
  mensajesMs: 120_000,
  controlPendienteMs: 20_000,
  avisoAsistenciaMs: 60_000,
  botonAsistenciaMs: 30_000,
  minEntreConsultasRutaMs: 30_000,
  cuentaPresenciaMinMs: 5 * 60_000,
  latidoEstudioMinS: 45,
  telemetriaVaciadoMs: 30_000,
  telemetriaV1ConV2EnPracticas: false,
  orbeIaLecciones: false,
  peticionTimeoutMs: 25_000,
  funcionTimeoutMs: 160_000,
  controlOnlineMs: 20_000,
  controlHistorialMs: 45_000,
  controlAlertasMs: 15 * 60_000,
  controlAgruparMs: 2_000,
  tableroDocenteMs: 60_000,
  pausarOculto: true,
};

export const MODO_BAJO_CONSUMO = true;
export const CONSUMO: PerfilConsumo = MODO_BAJO_CONSUMO ? BAJO_CONSUMO : NORMAL;

/**
 * Consulta periódica «amable»: solo con la pestaña visible (si `soloVisible`), una al montar, otra al volver a la
 * pestaña o a la red, y nunca dos más cerca que `minimoMs` salvo `forzar`. Devuelve la función de limpieza.
 */
export function sondeo(f: () => void, cadaMs: number, opciones: { soloVisible?: boolean; minimoMs?: number; alVolver?: boolean } = {}): () => void {
  const { soloVisible = true, minimoMs = 0, alVolver = true } = opciones;
  let ultima = 0;
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
  const intentar = (forzar = false) => {
    if (soloVisible && !visible()) return;
    const ahora = Date.now();
    if (!forzar && minimoMs > 0 && ahora - ultima < minimoMs) return;
    ultima = ahora;
    f();
  };
  intentar(true);
  const t = setInterval(() => intentar(true), cadaMs);
  const volver = () => { if (visible()) intentar(); };
  if (alVolver) {
    document.addEventListener('visibilitychange', volver);
    window.addEventListener('online', volver);
  }
  return () => {
    clearInterval(t);
    if (alVolver) {
      document.removeEventListener('visibilitychange', volver);
      window.removeEventListener('online', volver);
    }
  };
}

/** Memoria (por pestaña) de la última vez que se hizo una consulta, para no repetirla al cambiar de página. */
const ultimas = new Map<string, number>();
export function hechaHaceMenosDe(clave: string, ms: number, ahora = Date.now()): boolean {
  const u = ultimas.get(clave);
  return u !== undefined && ms > 0 && ahora - u < ms;
}
export function marcarHecha(clave: string, ahora = Date.now()) {
  ultimas.set(clave, ahora);
}

/**
 * `fetch` con tiempo máximo. Si la base de datos no responde, la petición falla con un error legible en lugar de
 * dejar la pantalla en «Cargando» para siempre. Una escritura que se da por fallida en el navegador PUEDE haberse
 * guardado en el servidor: por eso las pantallas nunca la confirman, y el reintento es idempotente (guardar la misma
 * respuesta otra vez no duplica nada).
 */
export function fetchConLimite(limiteBdMs: number, limiteFuncionesMs: number): typeof fetch {
  return (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    // Auth (sesión) y Storage (archivos grandes) quedan con el comportamiento propio de supabase-js
    if (/\/(auth|storage)\/v1\//.test(url)) return fetch(entrada, init);
    const limite = /\/functions\/v1\//.test(url) ? limiteFuncionesMs : limiteBdMs;
    if (!limite || typeof AbortController === 'undefined') return fetch(entrada, init);
    const ctrl = new AbortController();
    const externa = init?.signal;
    if (externa) {
      if (externa.aborted) ctrl.abort(externa.reason);
      else externa.addEventListener('abort', () => ctrl.abort(externa.reason), { once: true });
    }
    let agotado = false;
    const t = setTimeout(() => { agotado = true; ctrl.abort(); }, limite);
    return fetch(entrada, { ...init, signal: ctrl.signal })
      .catch((e) => {
        if (agotado) throw new TypeError('Failed to fetch: el servidor tardó demasiado en responder');
        throw e;
      })
      .finally(() => clearTimeout(t));
  };
}

/** Espera de reintento con crecimiento exponencial y variación aleatoria (evita que todos reintenten a la vez). */
export function esperaReintento(intento: number, baseMs = 1_000, maxMs = 30_000, azar: () => number = Math.random): number {
  const techo = Math.min(maxMs, baseMs * 2 ** Math.max(0, intento));
  return Math.round(techo / 2 + azar() * (techo / 2));
}
