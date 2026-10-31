/**
 * LIEIA · Batería de validación del D6 v2 POR SIMULACIÓN.
 *
 * Esto NO es una validación empírica: los datos son sintéticos y el modelo generador es el mismo que el detector
 * supone (salvo en los escenarios de telemetría imperfecta y de dificultad mal declarada). Sirve para comprobar que
 * la lógica es correcta y que las tasas de error nominales se cumplen bajo el modelo; la validación empírica
 * requiere casos reales con verdad conocida (p. ej. sesiones de control declaradas) y no se presenta aquí.
 *
 * Escenarios:
 *  · contaminación 0/20/50/80/100 % de estudiantes «insensibles» en la cohorte evaluada, con referencia EXTERNA
 *    (D6 v2) y, para contraste, con referencia calibrada en la propia cohorte (como hacía el D6 v1);
 *  · cobertura extrema (un solo nivel, dos niveles);
 *  · telemetría imperfecta (tiempos perdidos, pausas no detectadas que inflan tiempos);
 *  · rapidez (copia rápida y correcta) para D6-B.
 * Métricas: tasa de falsos positivos (FPR), sensibilidad, especificidad (sobre los evaluados), tasa de abstención,
 * con intervalos de Wilson al 95 %.
 */
import { crearAzar, type Azar } from './azar';
import { calibrarReferencia, d6, diagnosticoReferencia, type DatoCalibracion, type Nivel, type ReferenciaD6, type RespuestaD6 } from './d6';
import { logistica, wilson } from './estadistica';

export type Perfil = 'honesto' | 'insensible' | 'rapido';

export interface ParametrosD6Sim {
  items_por_nivel: number;   // en el banco
  gamma: number;             // cuánto crece log T por nivel de dificultad en la población real
  sigma: number;             // ruido residual de log T
  tau_alpha: number; tau_beta: number;
  t_base: number;            // segundos típicos de un ítem intermedio
}

export const PARAMETROS_D6: ParametrosD6Sim = { items_por_nivel: 10, gamma: 0.5, sigma: 0.45, tau_alpha: 0.35, tau_beta: 0.1, t_base: 60 };

export interface Banco { ids: string[]; nivel: Record<string, Nivel>; mu: Record<string, number>; D: Record<string, number> }

export function crearBanco(p: ParametrosD6Sim, az: Azar): Banco {
  const ids: string[] = [], nivel: Record<string, Nivel> = {}, mu: Record<string, number> = {}, D: Record<string, number> = {};
  for (const n of [1, 2, 3] as Nivel[]) for (let k = 0; k < p.items_por_nivel; k++) {
    const id = `n${n}-${k}`;
    ids.push(id); nivel[id] = n; D[id] = n - 2;
    mu[id] = Math.log(p.t_base) + p.gamma * (n - 2) + az.normal(0, 0.15);
  }
  return { ids, nivel, mu, D };
}

interface Opciones {
  perdidos?: number; pausas?: number; marcarPausas?: boolean;
  deltaGamma?: number;   // la cohorte evaluada difiere de la de calibración en cuánto crece su tiempo con la dificultad
}

/** Simula las respuestas de un estudiante a una lista de ítems. */
export function simularEstudiante(perfil: Perfil, items: string[], b: Banco, p: ParametrosD6Sim, az: Azar, o: Opciones = {}): RespuestaD6[] {
  const alfa = az.normal(0, p.tau_alpha), beta = az.normal(0, p.tau_beta), theta = az.normal(0, 1);
  const muMedio = items.reduce((s, j) => s + b.mu[j], 0) / items.length;
  return items.map((j) => {
    let y: number, correcta: boolean;
    if (perfil === 'honesto') { y = b.mu[j] + alfa + (beta + (o.deltaGamma ?? 0)) * b.D[j] + az.normal(0, p.sigma); correcta = az.bernoulli(logistica(theta - b.D[j])); }
    else if (perfil === 'insensible') { y = muMedio + alfa + az.normal(0, p.sigma); correcta = az.bernoulli(0.9); }
    else { y = b.mu[j] - 1.6 + az.normal(0, p.sigma); correcta = az.bernoulli(0.95); }
    let calidad: RespuestaD6['calidad'] = 'observado';
    if (o.pausas && az.bernoulli(o.pausas)) { y += 0.3 + az.u(); if (o.marcarPausas) calidad = 'parcial'; }
    const perdido = o.perdidos ? az.bernoulli(o.perdidos) : false;
    return { exercise_id: j, respondida: true, correcta, tiempo_s: perdido ? null : Math.exp(y), calidad: perdido ? 'no_observado' : calidad };
  });
}

export function cohorteCalibracion(n: number, b: Banco, p: ParametrosD6Sim, az: Azar): DatoCalibracion[] {
  const out: DatoCalibracion[] = [];
  for (let i = 0; i < n; i++) for (const r of simularEstudiante('honesto', b.ids, b, p, az))
    out.push({ estudiante: `c${i}`, exercise_id: r.exercise_id, tiempo_s: r.tiempo_s, correcta: r.correcta });
  return out;
}

export interface Metrica { exitos: number; n: number; tasa: number; ic95: [number, number] }
const met = (exitos: number, n: number): Metrica => ({ exitos, n, tasa: n ? exitos / n : NaN, ic95: wilson(exitos, n) });

export interface FilaValidacion {
  escenario: string;
  referencia: 'externa' | 'propia_cohorte';
  detector: 'D6-A' | 'D6-B';
  fpr: Metrica;              // positivos entre honestos evaluados
  sensibilidad: Metrica;     // positivos entre contaminados evaluados
  especificidad: number;
  abstencion_honestos: Metrica; abstencion_contaminados: Metrica;
  deriva: Metrica | null;    // cohortes en que el diagnóstico de transporte de la referencia da la alarma
}

function resumir(escenario: string, referencia: FilaValidacion['referencia'], detector: FilaValidacion['detector'],
  casos: { perfil: Perfil; p: number | null }[], alfa: number, deriva: Metrica | null = null): FilaValidacion {
  const h = casos.filter((c) => c.perfil === 'honesto'), c = casos.filter((x) => x.perfil !== 'honesto');
  const hEv = h.filter((x) => x.p !== null), cEv = c.filter((x) => x.p !== null);
  const fp = hEv.filter((x) => x.p! < alfa).length, vp = cEv.filter((x) => x.p! < alfa).length;
  return {
    escenario, referencia, detector, fpr: met(fp, hEv.length), sensibilidad: met(vp, cEv.length),
    especificidad: hEv.length ? 1 - fp / hEv.length : NaN,
    abstencion_honestos: met(h.length - hEv.length, h.length), abstencion_contaminados: met(c.length - cEv.length, c.length), deriva,
  };
}

export interface ConfigBateria {
  semilla?: number; replicas?: number; tam_cohorte?: number; tam_calibracion?: number; alfa?: number; p?: ParametrosD6Sim;
}

/** Ejecuta la batería completa. Devuelve filas y la referencia usada (para el informe). */
export function bateriaD6(cfg: ConfigBateria = {}): { filas: FilaValidacion[]; referencia: ReferenciaD6; aviso: string } {
  const p = cfg.p ?? PARAMETROS_D6, az = crearAzar(cfg.semilla ?? 2026), alfa = cfg.alfa ?? 0.05;
  const R = cfg.replicas ?? 20, N = cfg.tam_cohorte ?? 60;
  const banco = crearBanco(p, az);
  const ref = calibrarReferencia(cohorteCalibracion(cfg.tam_calibracion ?? 300, banco, p, az), banco.nivel,
    { version: 'ref-simulada', dificultad: banco.D, minimo_por_item: 20, ahora: '2026-10-30T00:00:00Z' });
  const examen = (niveles: Nivel[], k = 4) => niveles.flatMap((n) => banco.ids.filter((j) => banco.nivel[j] === n).slice(0, k));
  const completo = examen([1, 2, 3]);
  const filas: FilaValidacion[] = [];

  const correr = (escenario: string, items: string[], frac: number, contaminante: Perfil, o: Opciones = {}, tambienPropia = false) => {
    const A: { perfil: Perfil; p: number | null }[] = [], B: typeof A = [], Ap: typeof A = [];
    let derivas = 0;
    for (let r = 0; r < R; r++) {
      const nC = Math.round(frac * N);
      const cohorte = Array.from({ length: N }, (_, i) => {
        const perfil: Perfil = i < nC ? contaminante : 'honesto';
        return { perfil, resp: simularEstudiante(perfil, items, banco, p, az, o) };
      });
      const res = cohorte.map((e) => d6(e.resp, ref));
      res.forEach((x, i) => { A.push({ perfil: cohorte[i].perfil, p: x.a.p }); B.push({ perfil: cohorte[i].perfil, p: x.b.p }); });
      if (diagnosticoReferencia(res.map((x) => x.a), ref).estado === 'deriva') derivas++;
      if (tambienPropia) {
        // contraste: «normalidad» calibrada con la misma cohorte investigada (lo que hacía el D6 v1)
        const propia = calibrarReferencia(cohorte.flatMap((e, i) => e.resp.map((x) => ({ estudiante: `s${i}`, exercise_id: x.exercise_id, tiempo_s: x.tiempo_s, correcta: x.correcta }))),
          banco.nivel, { version: 'propia', dificultad: banco.D, minimo_por_item: 1, ahora: '2026-10-30T00:00:00Z' });
        for (const e of cohorte) Ap.push({ perfil: e.perfil, p: d6(e.resp, propia).a.p });
      }
    }
    filas.push(resumir(escenario, 'externa', 'D6-A', A, alfa, met(derivas, R)));
    if (contaminante === 'rapido') filas.push(resumir(escenario, 'externa', 'D6-B', B, alfa));
    if (tambienPropia) filas.push(resumir(escenario, 'propia_cohorte', 'D6-A', Ap, alfa));
  };

  for (const c of [0, 0.2, 0.5, 0.8, 1]) correr(`contaminación ${Math.round(c * 100)} %`, completo, c, 'insensible', {}, true);
  correr('cobertura: solo nivel básico', examen([1], 12), 0.2, 'insensible');
  correr('cobertura: básico + intermedio', examen([1, 2], 6), 0.2, 'insensible');
  correr('cobertura: básico + desafiante (6 + 6)', examen([1, 3], 6), 0.2, 'insensible');
  correr('cobertura: 3 niveles, 2 ítems por nivel', examen([1, 2, 3], 2), 0.2, 'insensible');
  correr('telemetría: 30 % de tiempos perdidos', completo, 0.2, 'insensible', { perdidos: 0.3 });
  correr('telemetría: 20 % de pausas NO detectadas', completo, 0.2, 'insensible', { pausas: 0.2 });
  correr('telemetría: 20 % de pausas detectadas (excluidas)', completo, 0.2, 'insensible', { pausas: 0.2, marcarPausas: true });
  // límite conocido: la cohorte evaluada no se parece a la de calibración (sus tiempos crecen menos con la dificultad)
  correr('población distinta de la referencia (γ 0,3 frente a 0,5)', completo, 0, 'insensible', { deltaGamma: -0.2 });
  correr('rapidez: copia rápida y correcta (20 %)', completo, 0.2, 'rapido');
  return { filas, referencia: ref, aviso: 'Resultados de SIMULACIÓN con datos sintéticos: no son una validación empírica.' };
}
