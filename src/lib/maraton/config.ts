/**
 * Configuración del Maratón adaptativo: tipos, valores predeterminados y validación en el cliente.
 * Es un ESPEJO de public.maraton_defaults() y public.maraton_config_errores() (migraciones 94, 97, 98 y 99): el servidor vuelve a
 * validar todo al guardar; aquí solo sirve para avisar antes de enviar.
 */

export interface ConfigMaraton {
  programacion: { jornadas: number; modo: 'consecutivas' | 'calendario'; calendario: string[]; hora_inicio: string; apertura: string; cierre: string; zona: string };
  carga: {
    cuota: number; alternativa_activa: boolean; alternativa_minutos: number; alternativa_intentos: number;
    objetivo_min: number; objetivo_max: number; limite_minutos: number; intentos_max: number; presentados_max: number;
    /** fracción de las unidades del nivel que suma una respuesta incorrecta (migración 97) */
    fraccion_fallo: number;
    /** minutos de trabajo efectivo antes de los cuales la cuota no completa la jornada (migración 97) */
    minutos_minimos: number;
    /** jornada fija (migración 111): la jornada se completa al cerrar exactamente estos problemas; ausente = cuota */
    problemas_jornada?: number | null;
    /** puntuación informativa (migración 111): puntos de todo el maratón, repartidos por respuesta correcta */
    puntos_total?: number | null;
  };
  dificultad: {
    niveles: number; nivel_inicial: number; adaptativa: boolean; pesos: number[]; ascenso: number; descenso: number; descenso_no_puedo: number;
    nivel_al_iniciar_jornada: 'continuar' | 'inicial'; t_min_factor: number; t_min_nivel_s: (number | null)[] | null;
    /** niveles en secuencia por número de problema de la jornada (migración 111): manda sobre la adaptación */
    secuencia?: number[] | null;
  };
  /** reglas de permanencia (migración 98): incumplirlas deja al estudiante fuera del maratón */
  permanencia: {
    /** mínimo de ejercicios bien resueltos por jornada (requisito para completarla) */
    min_correctas: number;
    fuera_por_presentados: boolean;
    fuera_por_continuidad: boolean;
    /** resolver bien un problema de este nivel o superior en menos de `fuera_rapido_segundos` deja fuera; null = desactivada */
    fuera_rapido_nivel: number | null;
    fuera_rapido_segundos: number;
  };
  /**
   * progresión avanzada (migración 99): tras acertar el nivel 6 llegan problemas de varias etapas (niveles 7–9), y una
   * proporción de los ordinarios lleva una comprobación breve de razonamiento. Invisible para el estudiante.
   */
  avanzado: {
    activo: boolean;
    /** ponderación de los niveles 7, 8 y 9 (no puede superar la mayor ordinaria: sin bonificación por nivel) */
    pesos: number[];
    /** porcentaje de problemas ordinarios (con comprobación disponible) que la llevan */
    comprobacion_porcentaje: number;
    /** porcentaje para el problema que sigue a una respuesta anticipada (la misma regla para todos, según la conducta) */
    comprobacion_tras_anticipada: number;
    /** segundos que una comprobación añade al tiempo mínimo y al tope del problema */
    comprobacion_segundos: number;
  };
  comodines: { total: number; por_jornada: number | null; no_puedo: boolean };
  contenido: { temas: string[] | null; excluir_plantillas: string[]; distribucion: Record<string, number> };
  informes: { estudiante: boolean; docente: boolean; publicacion_estudiante: string | null; exportaciones: string[]; indicadores: boolean };
  seguridad: { retroalimentacion: 'ninguna' | 'correcto_incorrecto'; gracia_s: number; reanudacion: boolean };
}

export const CONFIG_PREDETERMINADA: ConfigMaraton = {
  programacion: { jornadas: 14, modo: 'consecutivas', calendario: [], hora_inicio: '00:00', apertura: '00:00', cierre: '23:59', zona: 'America/Santo_Domingo' },
  carga: { cuota: 12, alternativa_activa: true, alternativa_minutos: 60, alternativa_intentos: 8, objetivo_min: 60, objetivo_max: 75, limite_minutos: 90, intentos_max: 18, presentados_max: 30,
    fraccion_fallo: 0.5, minutos_minimos: 30 },
  permanencia: { min_correctas: 5, fuera_por_presentados: true, fuera_por_continuidad: true, fuera_rapido_nivel: 6, fuera_rapido_segundos: 60 },
  dificultad: { niveles: 6, nivel_inicial: 2, adaptativa: true, pesos: [1.0, 1.2, 1.4, 1.5, 1.0, 1.0], ascenso: 1, descenso: 1, descenso_no_puedo: 1, nivel_al_iniciar_jornada: 'continuar', t_min_factor: 1, t_min_nivel_s: null },
  avanzado: { activo: true, pesos: [1.0, 1.0, 1.0], comprobacion_porcentaje: 10, comprobacion_tras_anticipada: 100, comprobacion_segundos: 60 },
  comodines: { total: 10, por_jornada: null, no_puedo: true },
  contenido: { temas: null, excluir_plantillas: [], distribucion: {} },
  informes: { estudiante: true, docente: true, publicacion_estudiante: null, exportaciones: ['pdf', 'csv', 'xlsx'], indicadores: true },
  seguridad: { retroalimentacion: 'ninguna', gracia_s: 120, reanudacion: true },
};

/** Nombres internos de los niveles (solo para el profesor y el informe final; nunca durante la resolución). */
export const NOMBRE_NIVEL: Record<number, string> = {
  1: 'Básico', 2: 'Intermedio', 3: 'Avanzado', 4: 'Difícil', 5: 'Desafiante', 6: 'Extremo',
  7: 'Encadenado', 8: 'Integrado', 9: 'Generalización',
};
/** nivel más alto que puede aparecer (los 7–9 solo con la progresión avanzada) */
export const NIVEL_MAX = 9;
export const etiquetaNivel = (n: number | null | undefined) => (n ? `D${n} · ${NOMBRE_NIVEL[n] ?? ''}` : '—');

/** Combina una configuración parcial con la predeterminada (un nivel de profundidad, como maraton_cfg). */
export function combinar(c: Partial<{ [K in keyof ConfigMaraton]: Partial<ConfigMaraton[K]> }> | null | undefined): ConfigMaraton {
  const out = structuredClone(CONFIG_PREDETERMINADA) as unknown as Record<string, Record<string, unknown>>;
  for (const [k, v] of Object.entries(c ?? {})) if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...out[k], ...(v as Record<string, unknown>) };
  return out as unknown as ConfigMaraton;
}

const hora = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const entre = (x: unknown, a: number, b: number) => typeof x === 'number' && Number.isFinite(x) && x >= a && x <= b;

/** Errores de configuración (espejo de maraton_config_errores). Lista vacía = válida. */
export function erroresConfig(c: ConfigMaraton): string[] {
  const e: string[] = [];
  const p = c.programacion, k = c.carga, d = c.dificultad, w = c.comodines;
  if (!Number.isInteger(p.jornadas) || !entre(p.jornadas, 1, 60)) e.push('El número de jornadas debe estar entre 1 y 60.');
  if (p.modo === 'calendario') {
    if (p.calendario.length !== p.jornadas) e.push('El calendario personalizado debe tener exactamente una fecha por jornada.');
    else if (p.calendario.some((f, i) => !/^\d{4}-\d{2}-\d{2}$/.test(f) || (i > 0 && f <= p.calendario[i - 1]))) e.push('Las fechas del calendario deben ser crecientes y distintas.');
  }
  if (![p.apertura, p.cierre, p.hora_inicio].every(hora)) e.push('Escriba las horas como HH:MM.');
  else if (p.apertura >= p.cierre) e.push('La hora de apertura debe ser anterior a la hora límite.');
  if (!entre(k.cuota, 0.01, 100)) e.push('La cuota diaria debe estar entre 0 y 100 unidades.');
  if (!entre(k.alternativa_minutos, 1, 600)) e.push('Los minutos de la finalización alternativa deben estar entre 1 y 600.');
  if (!entre(k.alternativa_intentos, 1, 100)) e.push('Los intentos de la finalización alternativa deben estar entre 1 y 100.');
  if (!entre(k.limite_minutos, 5, 600)) e.push('El límite máximo de la jornada debe estar entre 5 y 600 minutos.');
  if (!entre(k.intentos_max, 1, 200)) e.push('El máximo de intentos válidos debe estar entre 1 y 200.');
  if (k.presentados_max < k.intentos_max) e.push('El máximo de problemas presentados no puede ser menor que el máximo de intentos.');
  if (k.objetivo_min > k.objetivo_max) e.push('El tiempo objetivo mínimo supera al máximo.');
  if (k.alternativa_activa && k.alternativa_intentos > k.intentos_max) e.push('La finalización alternativa pide más intentos que el máximo permitido.');
  if (!entre(k.fraccion_fallo, 0, 1)) e.push('La fracción de unidades de una respuesta incorrecta debe estar entre 0 y 1.');
  if (!entre(k.minutos_minimos, 0, 600)) e.push('El tiempo mínimo de la jornada debe estar entre 0 y 600 minutos.');
  else if (k.minutos_minimos > k.limite_minutos) e.push('El tiempo mínimo de la jornada supera el límite máximo: nunca se completaría por la cuota.');
  if (!entre(d.niveles, 2, 6)) e.push('El número de niveles debe estar entre 2 y 6.');
  if (!entre(d.nivel_inicial, 1, d.niveles)) e.push('El nivel inicial debe estar entre 1 y el número de niveles.');
  if (d.pesos.length !== 6 || d.pesos.some((x) => !entre(x, 0.1, 10))) e.push('Cada ponderación debe estar entre 0.1 y 10 (seis niveles).');
  if (![d.ascenso, d.descenso, d.descenso_no_puedo].every((x) => Number.isInteger(x) && entre(x, 0, 3))) e.push('Los saltos de ascenso y descenso deben estar entre 0 y 3 niveles.');
  if (!entre(d.t_min_factor, 0.25, 4)) e.push('El factor de tiempo mínimo debe estar entre 0.25 y 4.');
  if (d.t_min_nivel_s && (d.t_min_nivel_s.length !== 6 || d.t_min_nivel_s.some((x) => x !== null && !entre(x, 30, 3600)))) e.push('Cada tiempo mínimo por nivel debe estar entre 30 y 3600 s.');
  const pe = c.permanencia;
  if (!Number.isInteger(pe.min_correctas) || !entre(pe.min_correctas, 0, 100)) e.push('El mínimo de ejercicios bien resueltos debe estar entre 0 y 100.');
  else if (pe.min_correctas > Math.min(k.intentos_max, k.presentados_max)) e.push('El mínimo de ejercicios bien resueltos supera el máximo de intentos o de problemas de la jornada: nadie podría completarla.');
  if (pe.fuera_rapido_nivel !== null && (!Number.isInteger(pe.fuera_rapido_nivel) || !entre(pe.fuera_rapido_nivel, 1, 6))) e.push('El nivel de la regla de rapidez debe estar entre 1 y 6.');
  if (!Number.isInteger(pe.fuera_rapido_segundos) || !entre(pe.fuera_rapido_segundos, 1, 3600)) e.push('Los segundos de la regla de rapidez deben estar entre 1 y 3600.');
  const av = c.avanzado;
  if (av.pesos.length !== 3) e.push('Debe haber una ponderación por cada nivel avanzado (7, 8 y 9).');
  else if (av.pesos.some((x) => !entre(x, 0.1, 10))) e.push('Cada ponderación avanzada debe ser al menos 0.1.');
  else if (av.pesos.some((x) => x > Math.max(...d.pesos))) e.push('La ponderación de un nivel avanzado no puede superar la mayor ponderación ordinaria (no hay bonificación por nivel).');
  if (![av.comprobacion_porcentaje, av.comprobacion_tras_anticipada].every((x) => Number.isInteger(x) && entre(x, 0, 100))) e.push('Los porcentajes de comprobaciones de razonamiento deben estar entre 0 y 100.');
  if (!Number.isInteger(av.comprobacion_segundos) || !entre(av.comprobacion_segundos, 0, 600)) e.push('El tiempo adicional de una comprobación debe estar entre 0 y 600 s.');
  if (!Number.isInteger(w.total) || !entre(w.total, 0, 100)) e.push('Los comodines deben estar entre 0 y 100.');
  if (w.por_jornada !== null && (!Number.isInteger(w.por_jornada) || !entre(w.por_jornada, 0, 100))) e.push('El límite diario de comodines no es válido.');
  if (!entre(c.seguridad.gracia_s, 0, 600)) e.push('El margen de gracia debe estar entre 0 y 600 s.');
  return e;
}

/** Un límite de tiempo de 600 min (el máximo admitido) equivale a no tener tope en un día de clase. */
export const SIN_TOPE_MIN = 600;

/** Texto breve de la regla de finalización (para el profesor). */
export function describirFinalizacion(c: ConfigMaraton): string {
  const fallo = c.carga.fraccion_fallo === 1 ? 'una respuesta incorrecta suma igual que una correcta'
    : c.carga.fraccion_fallo === 0 ? 'una respuesta incorrecta no suma' : `una respuesta incorrecta suma el ${Math.round(c.carga.fraccion_fallo * 100)} %`;
  const a = `cuando acumula ${c.carga.cuota} unidades de trabajo (${fallo})${c.carga.minutos_minimos > 0 ? `, nunca antes de ${c.carga.minutos_minimos} min de trabajo efectivo,` : ''}`;
  const b = c.carga.alternativa_activa ? ` o cuando registra ${c.carga.alternativa_minutos} min de trabajo efectivo y ${c.carga.alternativa_intentos} intentos válidos` : '';
  const min = c.permanencia.min_correctas > 0 ? ` En ambos casos necesita al menos ${c.permanencia.min_correctas} ejercicios bien resueltos.` : '';
  return `La jornada termina ${a}${b}.${min} Límites de protección: ${c.carga.limite_minutos >= SIN_TOPE_MIN ? '' : `${c.carga.limite_minutos} min, `}${c.carga.intentos_max} intentos válidos o ${c.carga.presentados_max} problemas presentados (cierre seguro y revisión docente).`;
}

/** Reglas de permanencia en frases (para el profesor y, sin niveles, para el estudiante). */
export function reglasPermanencia(p: { min_correctas: number; presentados_max: number | null; continuidad: boolean; rapido_segundos: number | null; rapido_nivel?: number | null }): string[] {
  const r: string[] = [];
  if (p.min_correctas > 0) r.push(`Cada jornada exige al menos ${p.min_correctas} ejercicios bien resueltos; si ya no es posible alcanzarlos con los problemas que quedan, la participación termina.`);
  if (p.presentados_max) r.push(`Llegar a ${p.presentados_max} problemas en una jornada sin completarla termina la participación.`);
  if (p.continuidad) r.push('Una jornada no completada al cierre del día (o no iniciada) termina la participación, salvo justificación del profesor.');
  if (p.rapido_segundos) r.push(`Resolver correctamente un problema ${p.rapido_nivel ? `de nivel D${p.rapido_nivel} o superior` : 'de alta dificultad'} en menos de ${p.rapido_segundos} s termina la participación.`);
  return r;
}
