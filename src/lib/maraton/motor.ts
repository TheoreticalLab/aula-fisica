/**
 * Espejo puro (TypeScript) de las reglas del motor del Maratón adaptativo. La decisión real la toma SIEMPRE el servidor
 * (public.maraton_cerrar / maraton_continuar, migración 94); este módulo existe para:
 *  - documentar y probar la máquina de estados con Vitest (las mismas tablas que comprueba supabase/pruebas/maraton_adaptativo.sql);
 *  - simular estudiantes de distinto perfil y comprobar que la ponderación no acorta la jornada de quien resuelve
 *    muchos problemas extremos, ni obliga a un estudiante excepcional a trabajar indefinidamente.
 */
import type { ConfigMaraton } from './config';

export type Accion = 'respuesta' | 'no_puedo' | 'cambio';

/** Nivel después de una acción (máquina de estados determinista). */
export function nivelSiguiente(nivel: number, accion: Accion, correcta: boolean, c: ConfigMaraton): number {
  const d = c.dificultad;
  if (!d.adaptativa) return nivel;
  if (accion === 'respuesta') return correcta ? Math.min(d.niveles, nivel + d.ascenso) : Math.max(1, nivel - d.descenso);
  if (accion === 'no_puedo') return Math.max(1, nivel - d.descenso_no_puedo);
  return nivel; // cambio de ejercicio: mismo nivel
}

/** Unidades de trabajo de una acción: solo los intentos válidos suman (correctos o no); anticipados, en proporción. */
export function unidades(nivel: number, accion: Accion, segundos: number, tMin: number, c: ConfigMaraton): number {
  if (accion !== 'respuesta') return 0;
  const peso = c.dificultad.pesos[nivel - 1];
  return Math.round(peso * Math.min(1, segundos / tMin) * 100) / 100;
}

/** Tiempo acreditable: nunca más que el reloj del servidor ni que el tope del problema. */
export function segundosAcreditados(reloj: number, cliente: number | null, tMax: number): number {
  return Math.round(Math.min(reloj, tMax, cliente === null ? reloj : Math.max(0, cliente)) * 10) / 10;
}

export interface ContadoresJornada { unidades: number; segundos: number; validos: number; presentados: number }
export type FinJornada = { fin: false } | { fin: true; estado: 'completada'; via: 'cuota' | 'alternativa' } | { fin: true; estado: 'cerrada_limite'; motivo: string };

/** ¿Termina la jornada? (vía A: cuota; vía B: tiempo + intentos; si no, límites de protección) */
export function finJornada(j: ContadoresJornada, c: ConfigMaraton): FinJornada {
  const k = c.carga;
  if (j.unidades >= k.cuota) return { fin: true, estado: 'completada', via: 'cuota' };
  if (k.alternativa_activa && j.segundos >= k.alternativa_minutos * 60 && j.validos >= k.alternativa_intentos) return { fin: true, estado: 'completada', via: 'alternativa' };
  if (j.segundos >= k.limite_minutos * 60) return { fin: true, estado: 'cerrada_limite', motivo: 'tiempo' };
  if (j.validos >= k.intentos_max) return { fin: true, estado: 'cerrada_limite', motivo: 'intentos' };
  if (j.presentados >= k.presentados_max) return { fin: true, estado: 'cerrada_limite', motivo: 'presentados' };
  return { fin: false };
}

// ---------------------------------------------------------------------------
// Simulación (solo pruebas y documentación)
// ---------------------------------------------------------------------------
export interface Perfil {
  nombre: string;
  /** probabilidad de acertar por nivel (índice 0 = D1) */
  acierto: number[];
  /** minutos que tarda en un intento válido, por nivel */
  minutos: number[];
  /** probabilidad de declarar «No puedo» por nivel */
  noPuedo?: number[];
}
export interface ResultadoJornada { estado: string; via?: string; motivo?: string; validos: number; presentados: number; minutos: number; unidades: number; nivelMedio: number; enD6: number; nivelFinal: number }

/** Simula una jornada con un generador determinista (los tiempos mínimos son los del banco: D1 1 min … D6 7 min). */
export function simularJornada(p: Perfil, c: ConfigMaraton, nivelInicial: number, azar: () => number, tMinMin = [1, 2, 3, 4, 5, 7]): ResultadoJornada {
  const j: ContadoresJornada = { unidades: 0, segundos: 0, validos: 0, presentados: 0 };
  let nivel = nivelInicial, suma = 0, enD6 = 0;
  for (let guarda = 0; guarda < 1000; guarda++) {
    j.presentados++;
    const L = nivel;
    if (p.noPuedo && azar() < p.noPuedo[L - 1]) {
      j.segundos += 120;
      nivel = nivelSiguiente(L, 'no_puedo', false, c);
    } else {
      const seg = p.minutos[L - 1] * 60;
      const ok = azar() < p.acierto[L - 1];
      j.unidades = Math.round((j.unidades + unidades(L, 'respuesta', seg, tMinMin[L - 1] * 60, c)) * 100) / 100;
      j.segundos += seg;
      j.validos++;
      suma += L;
      if (L === 6) enD6++;
      nivel = nivelSiguiente(L, 'respuesta', ok, c);
    }
    const f = finJornada(j, c);
    if (f.fin) {
      return { estado: f.estado, via: f.estado === 'completada' ? f.via : undefined, motivo: f.estado === 'cerrada_limite' ? f.motivo : undefined,
        validos: j.validos, presentados: j.presentados, minutos: j.segundos / 60, unidades: j.unidades, nivelMedio: j.validos ? suma / j.validos : 0, enD6, nivelFinal: nivel };
    }
  }
  throw new Error('la simulación no terminó');
}
