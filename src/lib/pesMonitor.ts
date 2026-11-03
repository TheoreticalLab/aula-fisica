/**
 * Monitor docente de una PES (aula y Orbe Control): porcentaje de avance, tiempo en el apartado abierto, indicadores y
 * filtros. Los indicadores son para REVISAR (técnicos, de avance o de revisión), nunca pruebas de fraude ni de uso de IA.
 * Sin dependencias de ejecución: Orbe Control lo importa con ruta relativa.
 */
import type { PuntajeServidor } from '../api/pesTipos';

export interface FilaMonitor {
  user_id: string; nombre: string; codigo: string | null;
  estado: 'no_iniciada' | 'apartado_abierto' | 'esperando_liberacion' | 'completada' | 'vencida';
  cierre: string | null; aceptado_at: string | null;
  adaptacion: { tiempo_extra_min: number; factor_espera: number; pegado_permitido: boolean };
  actual: { ejercicio: number; letra: string; revelado_at: string | null; t_min_s: number } | null;
  cerrados: number; omitidos: number; anticipados: number; validadas: number; pendientes_revision: number; breves: number; tiempo_total_s: number;
  ejercicios_completos: number; ultima_actividad: string | null; pegados_bloqueados: number; reconexiones: number; controles: number;
  puntaje: PuntajeServidor;
}
export interface DatosMonitor {
  ahora: string;
  practica: { id: string; titulo: string; estado: string; cierra_at: string | null; resultados_publicados: boolean; ejercicios: number; apartados: number;
    control_politica: { modo: 'informativo' | 'ajuste'; peso: number; descripcion: string } };
  estudiantes: FilaMonitor[];
}

export type TipoIndicador = 'tecnico' | 'revision' | 'avance';
export interface Indicador { tipo: TipoIndicador; clave: string; texto: string }

export const ESTADO_MONITOR: Record<FilaMonitor['estado'], string> = {
  no_iniciada: 'Sin empezar', apartado_abierto: 'En curso', esperando_liberacion: 'Esperando bloque', completada: 'Terminada', vencida: 'Plazo terminado',
};

export const porcentaje = (f: FilaMonitor, apartados: number) => (apartados > 0 ? f.cerrados / apartados : 0);

/** segundos en el apartado abierto (reloj del servidor ≈ `ahoraMs`) */
export function enApartadoS(f: FilaMonitor, ahoraMs: number): number | null {
  return f.actual?.revelado_at ? Math.max(0, (ahoraMs - Date.parse(f.actual.revelado_at)) / 1000) : null;
}

export function indicadores(f: FilaMonitor, apartados: number, ahoraMs: number): Indicador[] {
  const xs: Indicador[] = [];
  const respondidos = f.cerrados - f.omitidos;
  if (f.pendientes_revision > 0) xs.push({ tipo: 'avance', clave: 'pendientes', texto: `${f.pendientes_revision} respuesta(s) por revisar` });
  if (f.reconexiones >= 3) xs.push({ tipo: 'tecnico', clave: 'reconexiones', texto: `Reconexiones frecuentes (${f.reconexiones}): posible problema de red` });
  if (f.estado === 'apartado_abierto' && f.ultima_actividad) {
    const min = (ahoraMs - Date.parse(f.ultima_actividad)) / 60000;
    if (min >= 30) xs.push({ tipo: 'tecnico', clave: 'inactivo', texto: `Sin actividad registrada desde hace ${min >= 120 ? `${Math.round(min / 60)} h` : `${Math.round(min)} min`} (puede haber cerrado la página)` });
  }
  if (f.breves >= 3 && respondidos > 0 && f.breves / respondidos >= 0.5)
    xs.push({ tipo: 'revision', clave: 'breves', texto: `${f.breves} respuestas muy por debajo de la espera mínima: indicador para revisar, no prueba de fraude` });
  if (f.pegados_bloqueados >= 3) xs.push({ tipo: 'revision', clave: 'pegado', texto: `${f.pegados_bloqueados} intentos de pegar bloqueados (indicador, no prueba)` });
  if (f.cierre && f.estado !== 'completada' && f.estado !== 'vencida') {
    const h = (Date.parse(f.cierre) - ahoraMs) / 3600000;
    const pct = porcentaje(f, apartados);
    if (h > 0 && h <= 24 && pct < 0.5) xs.push({ tipo: 'avance', clave: 'cierre', texto: `Cierra en ${Math.max(1, Math.round(h))} h con el ${Math.round(pct * 100)} % hecho` });
  }
  return xs;
}

export interface FiltroMonitor { texto?: string; estado?: FilaMonitor['estado'] | ''; conIndicadores?: boolean }

export function filtrarMonitor(filas: FilaMonitor[], f: FiltroMonitor, apartados: number, ahoraMs: number): FilaMonitor[] {
  const t = (f.texto ?? '').trim().toLowerCase();
  return filas.filter((x) => (!t || `${x.nombre} ${x.codigo ?? ''}`.toLowerCase().includes(t))
    && (!f.estado || x.estado === f.estado)
    && (!f.conIndicadores || indicadores(x, apartados, ahoraMs).length > 0));
}

/** Resumen de la sección para el encabezado del monitor. */
export function resumenMonitor(d: DatosMonitor) {
  const xs = d.estudiantes;
  const por = (e: FilaMonitor['estado']) => xs.filter((x) => x.estado === e).length;
  return {
    asignados: xs.length, sinEmpezar: por('no_iniciada'), enCurso: por('apartado_abierto') + por('esperando_liberacion'), terminadas: por('completada'), vencidas: por('vencida'),
    pendientesRevision: xs.reduce((s, x) => s + x.pendientes_revision, 0),
    mediaProvisional: xs.length ? xs.reduce((s, x) => s + x.puntaje.provisional.P, 0) / xs.length : 0,
  };
}

export const fmtDuracion = (s: number) => {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
