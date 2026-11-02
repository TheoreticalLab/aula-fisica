/**
 * Prácticas de Control (migración 62): lógica pura compartida por el aula y Orbe Control.
 * Sin alias de importación: Orbe Control compila este módulo con su propia configuración.
 *
 * Principio: una solución entregada demuestra que existe un producto académico; la Práctica de Control comprueba si el
 * estudiante puede aplicar de forma autónoma lo trabajado. No es un detector de IA.
 */

/** Límite institucional de la reducción máxima (igual que control_w_max() en SQL). */
export const W_MAX = 0.3;
export const W_POR_DEFECTO = 0.2;
export const DURACIONES = [5, 7, 10] as const;

/**
 * Factor de la nota de la práctica: 1 − w·(1 − C), con C (0–1) el resultado CONFIRMADO del control.
 * Espejo de control_factor(): sin control aplicable el factor es 1 (la nota no cambia).
 */
export function factorControl(w: number, c: number | null | undefined): number {
  if (c === null || c === undefined || !Number.isFinite(c)) return 1;
  const ww = Math.min(W_MAX, Math.max(0, w));
  return 1 - ww * (1 - Math.min(1, Math.max(0, c)));
}

/** N_final = N_original × [1 − w × (1 − C/100)], todo en la escala de la nota original. C en 0–100. */
export function notaFinal(original: number, controlSobre100: number | null, w: number): number {
  return Math.round(100 * original * factorControl(w, controlSobre100 === null ? null : controlSobre100 / 100)) / 100;
}

/** Varias verificaciones de una misma práctica: regla agregada única (el mejor resultado confirmado), sin encadenar descuentos. */
export function resultadoAgregado(resultados: (number | null)[]): number | null {
  const v = resultados.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? Math.max(...v) : null;
}

/**
 * Selección individual (espejo de control_seleccionar, versión «vta-sel-1»). Todos los componentes en [0, 1]:
 *  necesidad   1 − dominio demostrado en condiciones supervisadas en esa competencia (sin datos = 1)
 *  diagnostico producto correcto en la práctica sin verificar = 1; parcial = 0,7; bajo = 0,4; +0,1 si declaró ayuda
 *              (dato pedagógico: autonomía aún no verificada; nunca una penalización)
 *  cobertura   penaliza repetir la misma competencia o el mismo ejercicio dentro de la sesión
 *  tiempo      mejor cuanto más cerca del 70 % del tiempo disponible
 *  validado    1 = ficha de transferencia aprobada por el profesor; 0,5 = ejercicio publicado del banco
 *  azar        uniforme reproducible a partir de la semilla de la sesión
 */
export const PESOS_SELECCION = { necesidad: 0.3, diagnostico: 0.25, cobertura: 0.15, tiempo: 0.1, validado: 0.1, azar: 0.1 } as const;
export type ComponentesSeleccion = Record<keyof typeof PESOS_SELECCION, number>;

export function puntajeSeleccion(c: ComponentesSeleccion): number {
  const s = (Object.keys(PESOS_SELECCION) as (keyof typeof PESOS_SELECCION)[]).reduce((acc, k) => acc + PESOS_SELECCION[k] * c[k], 0);
  return Math.round(10000 * s) / 10000;
}

export function diagnostico(creditoPractica: number | null, declaroAyuda: boolean): number {
  const base = creditoPractica === null ? 0.4 : creditoPractica >= 0.8 ? 1 : creditoPractica >= 0.4 ? 0.7 : 0.4;
  return Math.min(1, base + (declaroAyuda ? 0.1 : 0));
}

export function ajusteTiempo(minutos: number, duracion: number): number {
  return Math.max(0, 1 - Math.abs(minutos / duracion - 0.7));
}

/** Tiempo estimado de un ejercicio del banco sin ficha (heurística; igual que control_minutos_estimados). */
export function minutosEstimados(format: string, difficulty: string): number {
  if (format === 'choice' || format === 'truefalse') return 2;
  if (format === 'text') return 3;
  if (format === 'open') return 8;
  return difficulty === 'basico' ? 4 : difficulty === 'intermedio' ? 6 : 9;
}

export type EstadoControl =
  | 'pendiente_inicio' | 'en_desarrollo' | 'tiempo_agotado' | 'correccion_pendiente' | 'corregido' | 'confirmado'
  | 'incidencia' | 'ausente' | 'exento' | 'sin_entrega' | 'sin_ejercicio' | 'no_inicio' | 'cancelado' | 'elegible';

export const ESTADO_CONTROL: Record<EstadoControl, { texto: string; tono: 'neutro' | 'activo' | 'ok' | 'aviso' | 'tenue' }> = {
  elegible: { texto: 'Preparado', tono: 'neutro' },
  pendiente_inicio: { texto: 'Pendiente de inicio', tono: 'neutro' },
  en_desarrollo: { texto: 'En desarrollo', tono: 'activo' },
  tiempo_agotado: { texto: 'Tiempo agotado', tono: 'aviso' },
  correccion_pendiente: { texto: 'Corrección pendiente', tono: 'aviso' },
  corregido: { texto: 'Corregido (sin confirmar)', tono: 'ok' },
  confirmado: { texto: 'Corregido y confirmado', tono: 'ok' },
  incidencia: { texto: 'Incidencia técnica', tono: 'aviso' },
  ausente: { texto: 'Ausente', tono: 'tenue' },
  exento: { texto: 'Exento', tono: 'tenue' },
  sin_entrega: { texto: 'No entregó la práctica', tono: 'tenue' },
  sin_ejercicio: { texto: 'Sin problema adecuado', tono: 'aviso' },
  no_inicio: { texto: 'No comenzó', tono: 'aviso' },
  cancelado: { texto: 'Sesión cancelada', tono: 'tenue' },
};

export const TIPO_TRANSFERENCIA: Record<string, string> = {
  contextual: 'Transferencia contextual (otro escenario, mismos principios)',
  parametrica: 'Transferencia paramétrica (otras condiciones y datos)',
  conceptual: 'Transferencia conceptual (hipótesis, leyes, justificación)',
  estructural: 'Transferencia estructural (otra apariencia, misma estructura física)',
  banco: 'Pregunta validada del banco de la misma competencia',
};

/** Texto del aviso que se muestra con la práctica desde que se anuncia la política. */
export const AVISO_VERIFICACION =
  'Esta práctica está diseñada para desarrollar tus conocimientos y habilidades de resolución de problemas. Podrás utilizar los recursos permitidos ' +
  'según las instrucciones del profesor. Tu dominio de las competencias trabajadas podrá comprobarse posteriormente mediante una Práctica de Control ' +
  'breve e individual en el aula. El resultado de esa comprobación podrá ajustar parcialmente la calificación de esta práctica, conforme al porcentaje ' +
  'y las condiciones indicados.';

export const PROCEDIMIENTO_INCIDENCIAS =
  'Si tienes un problema técnico durante el control, avisa de inmediato al profesor: se registra como incidencia y ese control no afecta tu nota. ' +
  'Una ausencia justificada no se convierte en cero. Puedes pedir la revisión de tu resultado; el profesor puede programar una recuperación.';

/** Ejemplo numérico del aviso: con 90 en la práctica y 50 en el control. */
export function ejemploAjuste(w: number) {
  return { original: 90, control: 50, final: notaFinal(90, 50, w), maximo: Math.round(100 * w) };
}

export const SENAL_VTA: Record<string, string> = {
  sin_datos: 'Sin controles confirmados',
  datos_insuficientes: 'Datos insuficientes (menos de 3 controles)',
  reforzar_autonomia: 'Conviene reforzar la resolución autónoma',
  coherente: 'Rendimiento autónomo coherente con las prácticas',
  indeterminada: 'Sin conclusión (incertidumbre alta)',
};
