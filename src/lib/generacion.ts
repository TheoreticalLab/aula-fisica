/**
 * Generación de preguntas con IA para el banco: reparto de N preguntas entre lecciones, niveles y formatos, lotes y
 * estimación del coste ANTES de generar. Lógica pura (probada en tests/generacion.test.ts).
 */
export type Nivel = 'basico' | 'intermedio' | 'desafiante';
export type Formato = 'numeric' | 'choice' | 'truefalse';
export interface Especificacion { leccion_id: string; dificultad: Nivel; formato: Formato }
export const NIVELES: Nivel[] = ['basico', 'intermedio', 'desafiante'];
export const FORMATOS: Formato[] = ['numeric', 'choice', 'truefalse'];
export const MAX_PREGUNTAS = 300;

/** Reparto entero de n según pesos (método del mayor resto): suma exactamente n. */
export function reparto<K extends string>(n: number, pesos: Record<K, number>): Record<K, number> {
  const claves = Object.keys(pesos) as K[];
  const total = claves.reduce((s, k) => s + Math.max(0, pesos[k]), 0);
  const out = Object.fromEntries(claves.map((k) => [k, 0])) as Record<K, number>;
  if (n <= 0 || total <= 0) return out;
  const exactos = claves.map((k) => ({ k, x: (n * Math.max(0, pesos[k])) / total }));
  for (const e of exactos) out[e.k] = Math.floor(e.x);
  let resto = n - claves.reduce((s, k) => s + out[k], 0);
  for (const e of [...exactos].sort((a, b) => (b.x - Math.floor(b.x)) - (a.x - Math.floor(a.x)) || claves.indexOf(a.k) - claves.indexOf(b.k))) {
    if (resto-- <= 0) break;
    out[e.k]++;
  }
  return out;
}

/** Secuencia de n categorías con las cantidades dadas, intercaladas de forma pareja (round robin ponderado). */
export function intercalar<K extends string>(cantidades: Record<K, number>): K[] {
  const claves = (Object.keys(cantidades) as K[]).filter((k) => cantidades[k] > 0);
  const n = claves.reduce((s, k) => s + cantidades[k], 0);
  const usado = Object.fromEntries(claves.map((k) => [k, 0])) as Record<K, number>;
  const out: K[] = [];
  for (let i = 1; i <= n; i++) {
    // la categoría más atrasada respecto de su ritmo ideal
    const k = claves.reduce((m, c) => ((i * cantidades[c]) / n - usado[c] > (i * cantidades[m]) / n - usado[m] ? c : m), claves[0]);
    out.push(k); usado[k]++;
  }
  return out;
}

/** N especificaciones repartidas por igual entre las lecciones, con la mezcla de niveles y formatos pedida. */
export function planificar(n: number, lecciones: string[], niveles: Record<Nivel, number>, formatos: Record<Formato, number>): Especificacion[] {
  if (!lecciones.length || n <= 0) return [];
  const m = Math.min(n, MAX_PREGUNTAS);
  const porLeccion = reparto(m, Object.fromEntries(lecciones.map((l) => [l, 1])) as Record<string, number>);
  const ns = intercalar(reparto(m, niveles)), fs = intercalar(reparto(m, formatos));
  const out: Especificacion[] = [];
  let k = 0;
  for (const l of lecciones) for (let j = 0; j < porLeccion[l]; j++, k++) out.push({ leccion_id: l, dificultad: ns[k], formato: fs[k] });
  return out;
}

/** Lotes de hasta `tam` preguntas de la MISMA lección (el contexto enviado es menor y más relevante). */
export function lotes(specs: Especificacion[], tam = 4): Especificacion[][] {
  const out: Especificacion[][] = [];
  for (const l of [...new Set(specs.map((s) => s.leccion_id))]) {
    const g = specs.filter((s) => s.leccion_id === l);
    for (let i = 0; i < g.length; i += tam) out.push(g.slice(i, i + tam));
  }
  return out;
}

export interface DatosEstimacion {
  encendido: boolean; api_real: boolean; modelo: string; precio_entrada: number; precio_salida: number; max_salida: number;
  presupuesto_mes: number; gastado_mes: number; llamadas_hoy: number; limite_diario: number; por_lote: number;
}
/** Tokens por lote: entrada (instrucciones + lección + enunciados existentes) y salida (preguntas + razonamiento). */
export const TOKENS = { entradaTipica: 3000, entradaMaxima: 4500, salidaPorPregunta: 650, razonamiento: 800 };

export interface Estimacion {
  preguntas: number; llamadas: number; tokensEntrada: number; tokensSalida: number;
  costoTipico: number; costoMaximo: number; simulado: boolean;
  restantePresupuesto: number; llamadasRestantesHoy: number; cabeHoy: boolean; cabePresupuesto: boolean; avisos: string[];
}

export function estimar(grupos: Especificacion[][], d: DatosEstimacion): Estimacion {
  const preguntas = grupos.reduce((s, g) => s + g.length, 0);
  const llamadas = grupos.length;
  const salida = grupos.reduce((s, g) => s + Math.min(d.max_salida, g.length * TOKENS.salidaPorPregunta + TOKENS.razonamiento), 0);
  const entrada = llamadas * TOKENS.entradaTipica;
  const precio = (ent: number, sal: number) => (ent * d.precio_entrada + sal * d.precio_salida) / 1e6;
  const simulado = !d.api_real;
  const costoTipico = simulado ? 0 : precio(entrada, salida);
  const costoMaximo = simulado ? 0 : precio(llamadas * TOKENS.entradaMaxima, llamadas * d.max_salida);
  const restantePresupuesto = Math.max(0, d.presupuesto_mes - d.gastado_mes);
  const llamadasRestantesHoy = Math.max(0, d.limite_diario - d.llamadas_hoy);
  const avisos: string[] = [];
  if (!d.encendido) avisos.push('Orbe IA está apagado: enciéndalo en Orbe IA → Configuración general.');
  if (simulado) avisos.push('Las llamadas reales están apagadas: se generarán preguntas de SIMULACIÓN (sin coste) para probar el flujo.');
  const cabeHoy = llamadas <= llamadasRestantesHoy;
  if (!cabeHoy) avisos.push(`Hacen falta ${llamadas} llamadas y hoy quedan ${llamadasRestantesHoy} (límite diario ${d.limite_diario}): se generarán unas ${llamadasRestantesHoy * d.por_lote} hoy; el resto, otro día o subiendo el límite.`);
  const cabePresupuesto = simulado || costoMaximo <= restantePresupuesto;
  if (!cabePresupuesto) avisos.push(`El coste máximo posible (US$ ${costoMaximo.toFixed(2)}) supera lo que queda del presupuesto del mes (US$ ${restantePresupuesto.toFixed(2)}): el servidor parará cuando se agote.`);
  return { preguntas, llamadas, tokensEntrada: entrada, tokensSalida: salida, costoTipico, costoMaximo, simulado, restantePresupuesto, llamadasRestantesHoy, cabeHoy, cabePresupuesto, avisos };
}
