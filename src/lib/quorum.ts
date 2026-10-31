/**
 * Asistencia autónoma por quórum de proximidad · reglas de decisión (lógica pura).
 *
 * La autoridad es el SERVIDOR (migración 43, funciones attendance_quorum_*): este módulo replica exactamente sus
 * reglas para probarlas a fondo y para explicar los resultados en la interfaz. Ver docs/ASISTENCIA_QUORUM.md.
 *
 * Una coordenada del navegador es una ESTIMACIÓN con una incertidumbre (precisión, en metros). Por eso cada
 * comparación con un radio R da tres resultados:
 *   compatible    d ≤ R
 *   incompatible  d − (a₁ + a₂) > R        (lejos incluso descontando la incertidumbre de ambas mediciones)
 *   inconclusa    lo demás
 * y una medición con precisión peor que el umbral es inconclusa por sí misma. Inconclusa NUNCA significa «ausente».
 */

export interface Posicion { lat: number; lng: number; precision: number }
export type Veredicto = 'compatible' | 'incompatible' | 'inconclusa';

export interface ParametrosQuorum {
  quorum: number;               // estudiantes distintos para activar (3)
  ventanaMin: number;           // minutos desde la hora programada para formar el quórum (20)
  radioQuorumM: number;         // R_q: distancia máxima entre los integrantes del quórum (50)
  radioProximidadM: number;     // R_p: distancia máxima a un estudiante ya validado (50)
  radioGeneralM: number;        // R_a: radio alrededor del centro inicial C₀ (100, el de la asistencia existente)
  vigenciaRefMin: number;       // minutos durante los que la posición de un admitido sirve de referencia (15)
  precisionMaxM: number;        // peor precisión aceptable (40)
  edadMaxS: number;             // antigüedad máxima de la medición al enviarla (60)
  simultaneidadS: number;       // las solicitudes del quórum deben estar en esta ventana (120)
  duracionMin: number;          // minutos que queda abierta la asistencia activada por quórum (90)
}

export const PARAMETROS_QUORUM: ParametrosQuorum = {
  quorum: 3, ventanaMin: 20, radioQuorumM: 50, radioProximidadM: 50, radioGeneralM: 100, vigenciaRefMin: 15, precisionMaxM: 40, edadMaxS: 60,
  simultaneidadS: 120, duracionMin: 90,
};

/** Distancia geodésica en metros (semiverseno, radio terrestre medio): la misma fórmula que geo_distance_m del servidor. */
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** ¿Está p a no más de R de q, teniendo en cuenta la incertidumbre de ambas? */
export function compararRadio(p: Posicion, q: Posicion, R: number): Veredicto {
  const d = distanciaM(p, q);
  if (d <= R) return 'compatible';
  if (d - (p.precision + q.precision) > R) return 'incompatible';
  return 'inconclusa';
}

export const precisionSuficiente = (p: Posicion, P = PARAMETROS_QUORUM) => Number.isFinite(p.precision) && p.precision > 0 && p.precision <= P.precisionMaxM;

export interface Candidato extends Posicion { id: string; dispositivo: string }

/**
 * Busca un grupo de `quorum` candidatos que incluya a `yo`, todos compatibles dos a dos (máx d ≤ R_q), con
 * dispositivos distintos. Voraz: añade candidatos por distancia creciente a `yo` si son compatibles con todos los ya
 * elegidos. Puede no encontrar un grupo que existe (entonces no activa: es conservador), pero nunca activa uno inválido.
 */
export function buscarQuorum(yo: Candidato, otros: Candidato[], P = PARAMETROS_QUORUM): Candidato[] | null {
  const grupo: Candidato[] = [yo];
  const orden = otros.filter((c) => c.id !== yo.id && precisionSuficiente(c, P)).sort((a, b) => distanciaM(yo, a) - distanciaM(yo, b) || (a.id < b.id ? -1 : 1));
  for (const c of orden) {
    if (grupo.length >= P.quorum) break;
    if (grupo.some((g) => g.dispositivo === c.dispositivo)) continue;
    if (grupo.every((g) => distanciaM(g, c) <= P.radioQuorumM)) grupo.push(c);
  }
  return grupo.length >= P.quorum ? grupo : null;
}

/** Centro inicial C₀: media de las posiciones (válida para distancias de decenas de metros) y su incertidumbre media. */
export function centro(grupo: Posicion[]): Posicion {
  const n = grupo.length;
  return { lat: grupo.reduce((s, p) => s + p.lat, 0) / n, lng: grupo.reduce((s, p) => s + p.lng, 0) / n, precision: grupo.reduce((s, p) => s + p.precision, 0) / n };
}

export type Admision =
  | { resultado: 'presente'; referencia: string; distanciaCentroM: number; distanciaRefM: number }
  | { resultado: 'fuera_de_zona'; motivo: 'lejos_del_centro' | 'lejos_de_los_admitidos'; distanciaCentroM: number }
  | { resultado: 'inconclusa'; motivo: 'precision' | 'zona_incierta' | 'sin_referencias_vigentes' | 'proximidad_incierta' };

/**
 * Validación progresiva de un estudiante que llega después:
 *   d(P, C₀) ≤ R_a   (nunca se relaja: la zona no se desplaza)   y   min_i d(P, P_i) ≤ R_p con referencias VIGENTES.
 */
export function admitir(p: Posicion, c0: Posicion, referencias: (Posicion & { id: string; vigenteHasta: number })[], ahora: number, P = PARAMETROS_QUORUM): Admision {
  if (!precisionSuficiente(p, P)) return { resultado: 'inconclusa', motivo: 'precision' };
  const dC = distanciaM(p, c0);
  const zona = compararRadio(p, c0, P.radioGeneralM);
  if (zona === 'incompatible') return { resultado: 'fuera_de_zona', motivo: 'lejos_del_centro', distanciaCentroM: dC };
  const vigentes = referencias.filter((r) => r.vigenteHasta > ahora);
  if (!vigentes.length) return { resultado: 'inconclusa', motivo: 'sin_referencias_vigentes' };
  const veredictos = vigentes.map((r) => ({ r, v: compararRadio(p, r, P.radioProximidadM), d: distanciaM(p, r) })).sort((a, b) => a.d - b.d);
  const mejor = veredictos.find((x) => x.v === 'compatible');
  if (zona === 'inconclusa') return { resultado: 'inconclusa', motivo: 'zona_incierta' };
  if (mejor) return { resultado: 'presente', referencia: mejor.r.id, distanciaCentroM: dC, distanciaRefM: mejor.d };
  if (veredictos.every((x) => x.v === 'incompatible')) return { resultado: 'fuera_de_zona', motivo: 'lejos_de_los_admitidos', distanciaCentroM: dC };
  return { resultado: 'inconclusa', motivo: 'proximidad_incierta' };
}

// ---- horario (America/Santo_Domingo) ------------------------------------------------------------------------------

export const ZONA = 'America/Santo_Domingo';
export interface Horario { diaSemana: number; hora: string }   // diaSemana ISO: 1 = lunes … 7 = domingo; hora 'HH:MM'

/** Partes de fecha y hora locales de un instante en una zona horaria. */
function local(t: number, zona = ZONA) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}
/** Instante UTC de una fecha y hora locales (la zona de la República Dominicana no tiene horario de verano, pero se calcula igual). */
export function instanteLocal(y: number, m: number, d: number, h: number, min: number, zona = ZONA): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const l = local(guess, zona);
  const offset = Date.UTC(l.y, l.m - 1, l.d, l.h, l.min) - guess;
  return guess - offset;
}

/** Inicio de la clase programada cuya ventana de formación contiene `ahora` (o null). Mira hoy y ayer (clases nocturnas). */
export function franjaActiva(horarios: Horario[], ahora: number, P = PARAMETROS_QUORUM): number | null {
  let mejor: number | null = null;
  for (const desplaz of [0, -1]) {
    const l = local(ahora + desplaz * 86_400_000);
    const iso = ((new Date(Date.UTC(l.y, l.m - 1, l.d)).getUTCDay() + 6) % 7) + 1;
    for (const h of horarios) {
      if (h.diaSemana !== iso) continue;
      const [hh, mm] = h.hora.split(':').map(Number);
      const ini = instanteLocal(l.y, l.m, l.d, hh, mm);
      if (ini <= ahora && ahora < ini + P.ventanaMin * 60_000 && (mejor === null || ini > mejor)) mejor = ini;
    }
  }
  return mejor;
}

/** Próximo inicio programado a partir de `ahora` (para «La asistencia podrá activarse a las 4:00 p. m.»). */
export function proximaFranja(horarios: Horario[], ahora: number): number | null {
  let mejor: number | null = null;
  for (let k = 0; k <= 7; k++) {
    const l = local(ahora + k * 86_400_000);
    const iso = ((new Date(Date.UTC(l.y, l.m - 1, l.d)).getUTCDay() + 6) % 7) + 1;
    for (const h of horarios) {
      if (h.diaSemana !== iso) continue;
      const [hh, mm] = h.hora.split(':').map(Number);
      const ini = instanteLocal(l.y, l.m, l.d, hh, mm);
      if (ini > ahora && (mejor === null || ini < mejor)) mejor = ini;
    }
  }
  return mejor;
}

/** Mensaje para el estudiante según la respuesta del servidor (textos de la especificación). Nunca muestra posiciones. */
export function mensajeQuorum(r: { estado: string; motivo?: string; participantes?: number; quorum?: number; proxima?: string | null; ya?: boolean }): { tono: 'ok' | 'info' | 'warn'; texto: string } {
  switch (r.estado) {
    case 'activada': return { tono: 'ok', texto: '✅ Asistencia activada. Se ha alcanzado el quórum de proximidad. Tu asistencia ha quedado registrada.' };
    case 'presente': return { tono: 'ok', texto: r.ya ? '✅ Ya estabas registrado como presente.' : '✅ Presente registrado correctamente.' };
    case 'esperando': return { tono: 'info', texto: `Esperando compañeros: ${Math.max(1, r.participantes ?? 1)}/${r.quorum ?? 3}. Tu solicitud vale 2 minutos; si el quórum no se completa, vuelve a pulsar.` };
    case 'fuera_de_zona': return { tono: 'warn', texto: 'No se ha podido confirmar tu presencia dentro de la zona habilitada.' };
    case 'inconclusa':
      if (r.motivo === 'precision') return { tono: 'warn', texto: 'Tu ubicación no tiene precisión suficiente. Intenta nuevamente o solicita validación al docente.' };
      if (r.motivo === 'sin_referencias_vigentes') return { tono: 'warn', texto: 'Ningún compañero ya registrado tiene una ubicación reciente para confirmar la tuya. Pide a uno que pulse «Renovar mi ubicación», intenta de nuevo o solicita validación al docente.' };
      return { tono: 'warn', texto: 'No se pudo confirmar tu ubicación con seguridad (estás cerca del límite). Intenta nuevamente o solicita validación al docente.' };
    case 'medicion_antigua': return { tono: 'warn', texto: 'La ubicación del dispositivo no era reciente. Intenta de nuevo para tomar una medición nueva.' };
    case 'rechazada': return { tono: 'warn', texto: r.motivo === 'dispositivo_compartido' ? 'Este dispositivo ya se usó para registrar a otro estudiante. Cada estudiante debe usar su propio dispositivo.' : r.motivo === 'otro_dispositivo' ? 'Solo puedes renovar tu ubicación desde el dispositivo con el que marcaste.' : 'No se pudo identificar este dispositivo. Recarga la página e inténtalo de nuevo.' };
    case 'fuera_de_horario': return { tono: 'info', texto: r.proxima ? `La asistencia podrá activarse a las ${horaLocal(Date.parse(r.proxima))}.` : 'Esta sección no tiene un horario de clase programado.' };
    case 'sesion_manual': return { tono: 'info', texto: 'El profesor ya abrió la asistencia: escribe el código que muestra en clase.' };
    case 'cerrada': return { tono: 'info', texto: 'El profesor cerró la asistencia de esta clase.' };
    case 'renovada': return { tono: 'ok', texto: 'Tu ubicación de referencia se renovó. Gracias: así tus compañeros pueden confirmar su presencia.' };
    case 'sin_sesion': return { tono: 'info', texto: 'No hay una asistencia activa ahora.' };
    default: return { tono: 'info', texto: 'La activación colectiva no está disponible en esta sección.' };
  }
}

export const horaLocal = (t: number) => new Date(t).toLocaleTimeString('es-DO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true });
