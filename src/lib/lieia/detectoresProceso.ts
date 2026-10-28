/**
 * LIEIA · Detectores sobre la telemetría del proceso (cada uno con su hipótesis nula explícita).
 *
 *  P1  Respuestas rápidas con envío diferido. C1 = fracción de preguntas en que la latencia de generación del
 *      estudiante queda en el 25 % más rápido de los DEMÁS en esa pregunta; C2 = fracción del tiempo total pasada
 *      oculta o inactiva DESPUÉS de la última edición. H0: la espera inactiva no depende de la rapidez → para los
 *      estudiantes rápidos (C1 > mediana), su C2 se compara con la de los NO rápidos (valor p por rango). La primera
 *      versión (emparejar con todos) perdía potencia porque otros implicados contaminaban la referencia.
 *      Explicaciones legítimas: saber mucho y luego distraerse, dejar la pestaña abierta.
 *  P2  Regularidad anómala de los intervalos entre respuestas. Razón = coeficiente de variación observado / el que el
 *      modelo lognormal espera para SUS preguntas (bootstrap paramétrico); se compara por rango con la razón del
 *      resto de la clase (cola inferior). H0: estudiantes intercambiables en esa razón. Historia de la validación:
 *      el bootstrap puro dio FPR hasta 6,2 % (IC > 7,5 %); la variabilidad residual por rango controló los falsos
 *      positivos pero perdió la señal (el ritmo regular ignora la exigencia: sus residuos son GRANDES); una referencia
 *      robusta normal recuperó la potencia pero subió los falsos positivos al 9 %. Queda el rango: válido, potencia
 *      limitada cuando varios estudiantes comparten el patrón (ocupan los rangos más bajos).
 *      Explicación legítima: un estudiante muy metódico o preguntas de exigencia muy parecida.
 *  P3  Respuestas que aparecen «de golpe» (≥ 15 caracteres en una ráfaga ≤ 0,3 s). DESCRIPTIVO: pegar puede ser
 *      legítimo (notas propias, calculadora) y no se conoce la frecuencia real: no se convierte en valor p.
 */
import { crearAzar, derivarSemilla } from './azar';
import { benjaminiHochberg, cuantil } from './estadistica';
import { ajustarTiempos } from './modelos';
import type { ProcesoIntento } from './proceso';

export interface ResultadoProceso {
  i: number;
  p1: { c1: number; c2: number; s: number; p: number } | null;
  p2: { cv: number; esperado: number; p: number } | null;
  p3: { pegados: number; cambios: number };
  q1: number | null; q2: number | null;
}

export function analizarProceso(ps: ProcesoIntento[], itemsIds: string[], opciones: { semilla?: number; bootstrap?: number } = {}): ResultadoProceso[] {
  const n = ps.length, m = itemsIds.length;
  const B = opciones.bootstrap ?? 199;
  const semilla = opciones.semilla ?? 20261028;
  const lat = ps.map((p) => itemsIds.map((id) => p.items.find((x) => x.exercise_id === id)?.latenciaGeneracion ?? null));

  // --- P1 ---
  const c1 = lat.map((fila, i) => {
    let rapidas = 0, tot = 0;
    fila.forEach((v, j) => {
      if (v === null) return;
      const otros = lat.filter((_, k) => k !== i).map((f) => f[j]).filter((x): x is number => x !== null);
      if (otros.length < 5) return;
      tot++;
      if (v < cuantil(otros, 0.25)) rapidas++;
    });
    return tot >= 4 ? rapidas / tot : null;
  });
  const c2 = ps.map((p) => (p.cronologico && p.esperaFinalInactiva !== null ? Math.min(1, p.esperaFinalInactiva / Math.max(1, p.cronologico)) : 0));

  // --- P2: intervalos entre primeras respuestas consecutivas, modelo de tiempos por pregunta ---
  const intervalos = ps.map((p) => {
    const orden = p.items.filter((x) => x.primeraNoVacia !== null).sort((a, b) => (a.primeraNoVacia as number) - (b.primeraNoVacia as number));
    const fila: (number | null)[] = itemsIds.map(() => null);
    let previo = 0;
    for (const it of orden) {
      const j = itemsIds.indexOf(it.exercise_id);
      fila[j] = Math.max(1, (it.primeraNoVacia as number) - previo);
      previo = it.primeraNoVacia as number;
    }
    return fila;
  });
  const tm = n >= 5 ? ajustarTiempos(intervalos) : null;
  const cv = (xs: number[]) => { const mu = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / xs.length) / mu; };
  // razón variación observada / esperada por el modelo para las preguntas de cada estudiante (bootstrap paramétrico)
  const razon = intervalos.map((fila, i) => {
    const xs = fila.filter((x): x is number => x !== null);
    if (!tm || xs.length < 6) return null;
    const az = crearAzar(derivarSemilla(semilla, 9, i));
    let suma = 0;
    for (let b = 0; b < B; b++) suma += cv(fila.map((v, j) => (v === null ? null : Math.exp(tm.beta[j] - tm.tau[i] + tm.sigma[j] * az.normal()))).filter((x): x is number => x !== null));
    return { obs: cv(xs), esperado: suma / B, r: cv(xs) / (suma / B) };
  });

  const res: ResultadoProceso[] = ps.map((p, i) => {
    let p1: ResultadoProceso['p1'] = null;
    if (c1[i] !== null && n >= 10) {
      const s = (c1[i] as number) * c2[i];
      // referencia: la espera inactiva de los estudiantes NO rápidos (C1 ≤ mediana). Bajo H0 la espera no depende de
      // la rapidez, así que esa referencia es válida y no la contaminan otros estudiantes con el mismo patrón.
      const medC1 = cuantil(c1.filter((x): x is number => x !== null), 0.5);
      const ref = c2.filter((_, k) => k !== i && c1[k] !== null && (c1[k] as number) <= medC1);
      const rapido = (c1[i] as number) > medC1;
      // valor p por rango con corrección de medio punto (con ~15 de referencia, el rango puro no baja de 1/16)
      const mayores = ref.filter((x) => x > c2[i]).length, iguales = ref.filter((x) => x === c2[i]).length;
      p1 = { c1: c1[i] as number, c2: c2[i], s, p: !rapido || c2[i] === 0 || ref.length < 5 ? 1 : (mayores + 0.5 * iguales + 0.5) / (ref.length + 1) };
    }
    let p2: ResultadoProceso['p2'] = null;
    const xs = intervalos[i].filter((x): x is number => x !== null);
    const ri = razon[i];
    if (ri && xs.length >= 6 && n >= 10) {
      // la razón de cada estudiante frente a la del resto de la clase, por RANGO con medio punto (cola inferior).
      // Se probó una referencia robusta normal (mediana, MAD): más potencia, pero FPR hasta 9,3 % → descartada.
      const ref = razon.filter((x, k) => k !== i && x !== null).map((x) => x!.r);
      const menores = ref.filter((x) => x < ri.r).length, iguales = ref.filter((x) => x === ri.r).length;
      p2 = { cv: ri.obs, esperado: ri.esperado, p: ref.length < 9 ? 1 : (menores + 0.5 * iguales + 0.5) / (ref.length + 1) };
    }
    const pegados = p.items.reduce((s, x) => s + x.pegados, 0);
    return { i, p1, p2, p3: { pegados, cambios: p.items.reduce((s, x) => s + x.cambios, 0) }, q1: null, q2: null };
  });
  const qs = (vals: (number | null)[]) => {
    const idx = vals.map((v, k) => (v === null ? -1 : k)).filter((k) => k >= 0);
    const q = benjaminiHochberg(idx.map((k) => vals[k] as number));
    const out: (number | null)[] = vals.map(() => null);
    idx.forEach((k, r) => { out[k] = q[r]; });
    return out;
  };
  const q1 = qs(res.map((r) => r.p1?.p ?? null)), q2 = qs(res.map((r) => r.p2?.p ?? null));
  res.forEach((r, k) => { r.q1 = q1[k]; r.q2 = q2[k]; });
  void m;
  return res;
}
