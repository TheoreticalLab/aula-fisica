/**
 * Espejo puro (TypeScript) de las reglas del motor del Maratón adaptativo. La decisión real la toma SIEMPRE el servidor
 * (public.maraton_cerrar / maraton_continuar, migraciones 94, 97 y 98); este módulo existe para:
 *  - documentar y probar la máquina de estados con Vitest (las mismas tablas que comprueba supabase/pruebas/maraton_adaptativo.sql);
 *  - simular estudiantes de distinto perfil y comprobar que la ponderación no acorta la jornada de quien resuelve
 *    muchos problemas extremos, ni obliga a un estudiante excepcional a trabajar indefinidamente.
 */
import type { ConfigMaraton } from './config';

export type Accion = 'respuesta' | 'no_puedo' | 'cambio';

/**
 * Nivel máximo efectivo (public.maraton_nivel_max, migración 99): 9 con la progresión avanzada activa sobre los 6
 * niveles adaptativos (y un banco con problemas 7–9); si no, los niveles configurados.
 */
export function nivelMaximo(c: ConfigMaraton, bancoAvanzado = true): number {
  const d = c.dificultad;
  return c.avanzado.activo && d.niveles === 6 && d.adaptativa && bancoAvanzado ? 9 : d.niveles;
}

/** Nivel después de una acción (máquina de estados determinista). */
export function nivelSiguiente(nivel: number, accion: Accion, correcta: boolean, c: ConfigMaraton, bancoAvanzado = true): number {
  const d = c.dificultad;
  if (!d.adaptativa) return nivel;
  if (accion === 'respuesta') return correcta ? Math.min(nivelMaximo(c, bancoAvanzado), nivel + d.ascenso) : Math.max(1, nivel - d.descenso);
  if (accion === 'no_puedo') return Math.max(1, nivel - d.descenso_no_puedo);
  return nivel; // cambio de ejercicio: mismo nivel
}

/** Ponderación de un nivel: 1–6 de `dificultad.pesos`, 7–9 de `avanzado.pesos` (sin bonificación, migración 99). */
export const ponderacion = (nivel: number, c: ConfigMaraton) => (nivel > 6 ? c.avanzado.pesos[nivel - 7] : c.dificultad.pesos[nivel - 1]);

/**
 * Unidades de trabajo de una acción: solo los intentos válidos suman; una respuesta incorrecta, la fracción
 * `carga.fraccion_fallo` (migración 97); una anticipada, en proporción al tiempo mínimo. Un problema por etapas es UNA
 * respuesta: correcta solo si todas sus etapas lo son (una parcial es incorrecta).
 */
export function unidades(nivel: number, accion: Accion, correcta: boolean, segundos: number, tMin: number, c: ConfigMaraton): number {
  if (accion !== 'respuesta') return 0;
  const peso = ponderacion(nivel, c);
  return Math.round(peso * Math.min(1, segundos / tMin) * (correcta ? 1 : c.carga.fraccion_fallo) * 100) / 100;
}

/** Tiempo acreditable: nunca más que el reloj del servidor ni que el tope del problema. */
export function segundosAcreditados(reloj: number, cliente: number | null, tMax: number): number {
  return Math.round(Math.min(reloj, tMax, cliente === null ? reloj : Math.max(0, cliente)) * 10) / 10;
}

export interface ContadoresJornada { unidades: number; segundos: number; validos: number; presentados: number; correctas: number }
export type FinJornada = { fin: false } | { fin: true; estado: 'completada'; via: 'cuota' | 'alternativa' } | { fin: true; estado: 'cerrada_limite' | 'fuera'; motivo: string };

/**
 * ¿Termina la jornada? (vía A: cuota tras el tiempo mínimo; vía B: tiempo + intentos; ambas con el mínimo de aciertos;
 * si ya no puede llegar al mínimo o agota los problemas, queda fuera del maratón; si no, límites de protección).
 * La regla de rapidez (migración 98) depende del reloj de cada problema y no se modela aquí.
 */
export function finJornada(j: ContadoresJornada, c: ConfigMaraton): FinJornada {
  const k = c.carga, pe = c.permanencia;
  const aciertos = j.correctas >= pe.min_correctas;
  if (aciertos && j.unidades >= k.cuota && j.segundos >= k.minutos_minimos * 60) return { fin: true, estado: 'completada', via: 'cuota' };
  if (aciertos && k.alternativa_activa && j.segundos >= k.alternativa_minutos * 60 && j.validos >= k.alternativa_intentos) return { fin: true, estado: 'completada', via: 'alternativa' };
  if (j.correctas + Math.min(k.presentados_max - j.presentados, k.intentos_max - j.validos) < pe.min_correctas) return { fin: true, estado: 'fuera', motivo: 'aciertos' };
  if (pe.fuera_por_presentados && j.presentados >= k.presentados_max) return { fin: true, estado: 'fuera', motivo: 'presentados' };
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
  /** probabilidad de acertar por nivel (índice 0 = D1; hasta 9 valores; si faltan, se repite el último) */
  acierto: number[];
  /** minutos que tarda en un intento válido, por nivel (problema completo, todas sus etapas) */
  minutos: number[];
  /** probabilidad de declarar «No puedo» por nivel */
  noPuedo?: number[];
  /** probabilidad de acertar la comprobación de razonamiento cuando acertó el problema (por defecto 1) */
  comprobacion?: number;
  /** minutos que le lleva una comprobación (por defecto 1) */
  minutosComprobacion?: number;
}
export interface ResultadoJornada {
  estado: string; via?: string; motivo?: string; validos: number; presentados: number; correctas: number; minutos: number; unidades: number;
  nivelMedio: number; enD6: number; avanzados: number; comprobaciones: number; nivelFinal: number;
}

/** tiempos mínimos del banco FG1 por nivel, en minutos (D1 1 … D6 7; avanzados 9, 11, 13) */
export const T_MIN_BANCO_MIN = [1, 2, 3, 4, 5, 7, 9, 11, 13];
const porNivel = (xs: number[] | undefined, L: number, def = 0) => (xs && xs.length ? xs[Math.min(L, xs.length) - 1] : def);

/**
 * Simula una jornada con un generador determinista. Con la progresión avanzada, los niveles 7–9 llegan tras acertar el 6;
 * una proporción `avanzado.comprobacion_porcentaje` de los problemas ordinarios lleva comprobación (el sorteo del servidor
 * es determinista por inscripción y número de problema: aquí se modela con el mismo azar para todos los perfiles).
 */
export function simularJornada(p: Perfil, c: ConfigMaraton, nivelInicial: number, azar: () => number, tMinMin = T_MIN_BANCO_MIN, bancoAvanzado = true): ResultadoJornada {
  const j: ContadoresJornada = { unidades: 0, segundos: 0, validos: 0, presentados: 0, correctas: 0 };
  let nivel = nivelInicial, suma = 0, enD6 = 0, avanzados = 0, comprobaciones = 0, anticipadaPrev = false;
  for (let guarda = 0; guarda < 1000; guarda++) {
    j.presentados++;
    const L = nivel;
    // porcentaje base, o el mayor si la respuesta anterior fue anticipada (misma regla para todos, según la conducta)
    const pc: number = anticipadaPrev ? Math.max(c.avanzado.comprobacion_porcentaje, c.avanzado.comprobacion_tras_anticipada) : c.avanzado.comprobacion_porcentaje;
    // (sin comprobaciones ni «No puedo» no se consume azar: las simulaciones anteriores a la migración 99 no cambian)
    const conComp: boolean = L <= 6 && pc > 0 && azar() * 100 < pc;
    anticipadaPrev = false;
    if (p.noPuedo && azar() < porNivel(p.noPuedo, L)) {
      j.segundos += 120;
      nivel = nivelSiguiente(L, 'no_puedo', false, c, bancoAvanzado);
    } else {
      const extra = conComp ? c.avanzado.comprobacion_segundos : 0;
      const seg: number = porNivel(p.minutos, L) * 60 + (conComp ? (p.minutosComprobacion ?? 1) * 60 : 0);
      // acierto completo: el problema y, si la lleva, la comprobación
      const ok = azar() < porNivel(p.acierto, L) && (!conComp || azar() < (p.comprobacion ?? 1));
      j.unidades = Math.round((j.unidades + unidades(L, 'respuesta', ok, seg, tMinMin[L - 1] * 60 + extra, c)) * 100) / 100;
      anticipadaPrev = seg < tMinMin[L - 1] * 60 + extra;
      j.segundos += seg;
      j.validos++;
      if (ok) j.correctas++;
      suma += L;
      if (L === 6) enD6++;
      if (L > 6) avanzados++;
      if (conComp) comprobaciones++;
      nivel = nivelSiguiente(L, 'respuesta', ok, c, bancoAvanzado);
    }
    const f = finJornada(j, c);
    if (f.fin) {
      return { estado: f.estado, via: f.estado === 'completada' ? f.via : undefined, motivo: f.estado !== 'completada' ? f.motivo : undefined,
        validos: j.validos, presentados: j.presentados, correctas: j.correctas, minutos: j.segundos / 60, unidades: j.unidades,
        nivelMedio: j.validos ? suma / j.validos : 0, enD6, avanzados, comprobaciones, nivelFinal: nivel };
    }
  }
  throw new Error('la simulación no terminó');
}
