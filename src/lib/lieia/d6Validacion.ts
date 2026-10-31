/**
 * LIEIA · Validación del D6 v2 POR SIMULACIÓN, con varias semillas.
 *
 * Esto NO es una validación empírica: los datos son sintéticos. Sirve para comprobar la lógica y las tasas de error
 * bajo modelos conocidos, incluidos escenarios donde el modelo del detector es FALSO (población distinta, pausas que
 * dependen de la dificultad, telemetría ambigua). La validación empírica exige casos reales con verdad conocida.
 *
 * Reglas de la evaluación (fijadas en PROTOCOLO_D6 antes de ejecutarla):
 *  · Cada semilla genera un banco nuevo, una cohorte de calibración nueva (referencia nueva) y cohortes evaluadas nuevas.
 *  · Las semillas de DESARROLLO (las usadas para ajustar) y las de EVALUACIÓN (50 000 … 50 099) no se mezclan.
 *  · Se informan distribuciones entre semillas (mediana, P5–P95) y la tasa agregada con IC de Wilson al 95 %.
 *  · Para cada escenario se separan: tasa entre EVALUADOS (FPR, sensibilidad) y tasa sobre TODOS (señalados / total),
 *    con la COBERTURA (evaluados / total) y las abstenciones por causa. Una FPR baja entre pocos evaluados no es éxito.
 */
import { crearAzar, type Azar } from './azar';
import {
  analizarCohorteD6, calibrarReferencia, d6Individual, huellaProtocolo, precisionDiseno, PROTOCOLO_D6,
  type ContextoCohorte, type DatoCalibracion, type EstadoD6A, type EstrategiaPausas, type Intervalo, type ItemReferencia, type Nivel, type ProtocoloD6,
  type ReferenciaD6, type RespuestaD6, type TipoIntervalo,
} from './d6';
import { logistica, normalCdf, poissonBinomialCola, wilson } from './estadistica';

/** 'rapido_legitimo': estudiante honesto con velocidad personal extrema (se cuenta aparte: todo señalamiento es un falso positivo). */
export type Perfil = 'honesto' | 'insensible' | 'rapido' | 'asistido_total' | 'rapido_legitimo';

export interface ParametrosD6Sim {
  items_por_nivel: number; gamma: number; sigma: number; tau_alpha: number; tau_beta: number; t_base: number;
}
export const PARAMETROS_D6: ParametrosD6Sim = { items_por_nivel: 10, gamma: 0.5, sigma: 0.45, tau_alpha: 0.35, tau_beta: 0.1, t_base: 60 };
export const AMBITO_SIM = { asignatura: 'Física (simulada)', modalidad: 'examen' as const, telemetria: 'v2' };
export const CONTEXTO_SIM: ContextoCohorte = { ...AMBITO_SIM, fecha: '2026-11-01' };

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

export interface OpcionesSim {
  perdidos?: number;                       // fracción de preguntas sin ningún registro de tiempo
  pausas?: {
    prob: Record<Nivel, number>;           // probabilidad base de pausa por nivel (depende de la dificultad)
    lucha?: number;                        // exponente: las preguntas en que más se tarda tienen más pausas
    detectadas: boolean;                   // false: la pausa queda registrada como trabajo (no detectada)
    ambiguas?: number;                     // prob. de un hueco sin registro tras la pausa (bordes inciertos)
  };
  deltaGamma?: number;                     // población evaluada: sus tiempos crecen distinto con la dificultad
  escalaBeta?: number;                     // población evaluada: dispersión de β distinta
  desplazamientoAlfa?: number;             // población evaluada: más rápida/lenta en general
  alfaFijo?: number;                       // estudiante con velocidad personal fija (rápidos legítimos)
  factorAsistido?: number;                 // asistido_total: factor de tiempo (todas las preguntas)
}

const TIPOS_PAUSA: TipoIntervalo[] = ['pausa_declarada', 'oculta', 'desconexion'];

/** Simula las respuestas de un estudiante (con intervalos de trabajo y pausas). */
export function simularEstudiante(perfil: Perfil, items: string[], b: Banco, p: ParametrosD6Sim, az: Azar, o: OpcionesSim = {}): RespuestaD6[] {
  const alfa = o.alfaFijo ?? az.normal(o.desplazamientoAlfa ?? 0, p.tau_alpha);
  const beta = az.normal(0, p.tau_beta * (o.escalaBeta ?? 1)), theta = az.normal(0, 1);
  const muMedio = items.reduce((s, j) => s + b.mu[j], 0) / items.length;
  return items.map((j) => {
    let y: number, correcta: boolean;
    if (perfil === 'honesto' || perfil === 'rapido_legitimo') { y = b.mu[j] + alfa + (beta + (o.deltaGamma ?? 0)) * b.D[j] + az.normal(0, p.sigma); correcta = az.bernoulli(logistica(theta - b.D[j])); }
    else if (perfil === 'insensible') { y = muMedio + alfa + az.normal(0, p.sigma); correcta = az.bernoulli(0.9); }
    else if (perfil === 'rapido') { y = b.mu[j] - 1.6 + az.normal(0, p.sigma); correcta = az.bernoulli(0.95); }
    else { y = b.mu[j] + alfa + Math.log(o.factorAsistido ?? 0.3) + az.normal(0, p.sigma); correcta = az.bernoulli(0.95); }
    const W = Math.exp(y);
    if (o.perdidos && az.bernoulli(o.perdidos)) return { exercise_id: j, respondida: true, correcta, intervalos: [] };
    let intervalos: Intervalo[] = [{ inicio: 0, fin: W, tipo: 'trabajo' }];
    const pz = o.pausas;
    if (pz) {
      const prob = Math.min(1, pz.prob[b.nivel[j]] * Math.pow(W / Math.exp(b.mu[j]), pz.lucha ?? 0));
      if (az.bernoulli(prob)) {
        const P = Math.exp(Math.log(90) + az.normal(0, 0.8)), u = az.u() * W;
        const tipo = pz.detectadas ? az.elegir(TIPOS_PAUSA) : 'trabajo';
        const hueco = pz.ambiguas && az.bernoulli(pz.ambiguas) ? Math.min(P * 0.9, Math.exp(Math.log(az.bernoulli(0.5) ? 2 : 60) + az.normal(0, 0.5))) : 0;
        intervalos = [
          { inicio: 0, fin: u, tipo: 'trabajo' },
          { inicio: u, fin: u + P - hueco, tipo },
          // [u + P − hueco, u + P]: sin registro (en realidad seguía en pausa)
          { inicio: u + P, fin: W + P, tipo: 'trabajo' },
        ];
      }
    }
    return { exercise_id: j, respondida: true, correcta, intervalos };
  });
}

export function cohorteCalibracion(n: number, b: Banco, p: ParametrosD6Sim, az: Azar): DatoCalibracion[] {
  const out: DatoCalibracion[] = [];
  for (let i = 0; i < n; i++) for (const r of simularEstudiante('honesto', b.ids, b, p, az))
    out.push({ estudiante: `c${i}`, exercise_id: r.exercise_id, tiempo_s: r.intervalos![0].fin, correcta: r.correcta });
  return out;
}

/** D6-B con normalización INTERNA (descuenta la velocidad media del propio estudiante). Solo para demostrar por qué NO
 *  se usa: borra la rapidez de quien recibe ayuda durante todo el examen. */
export function d6bNormalizadoInterno(resp: RespuestaD6[], ref: ReferenciaD6, P: ProtocoloD6 = PROTOCOLO_D6): number | null {
  const ev = resp.filter((r) => r.respondida && ref.items[r.exercise_id] && r.intervalos?.length).map((r) => ({ r, it: ref.items[r.exercise_id], y: Math.log(r.intervalos![r.intervalos!.length - 1].fin) }));
  if (ev.length < 2) return null;
  const a = ev.reduce((s, e) => s + e.y - e.it.mu, 0) / ev.length;
  const corr = ev.filter((e) => e.r.correcta === true);
  if (!corr.length) return null;
  const k = corr.filter((e) => e.y - e.it.mu - a < -P.z_rapida * e.it.sigma).length;
  return poissonBinomialCola(corr.map(() => normalCdf(-P.z_rapida)), k);
}

// ---------------------------------------------------------------------------------------------------------
// Escenarios

export interface Escenario {
  id: string; titulo: string; grupo: 'contaminacion' | 'rapidez' | 'poblacion' | 'cobertura' | 'telemetria' | 'contexto';
  detectores: ('A' | 'B')[];
  examen: { niveles: Nivel[]; por_nivel: number } | { porNivel: Partial<Record<Nivel, number>> };
  contaminacion: number; contaminante: Perfil;
  sim?: OpcionesSim; simContaminados?: OpcionesSim; tam_cohorte?: number; estrategia?: EstrategiaPausas;
  contexto?: Partial<ContextoCohorte>;
  interno?: boolean;   // calcula también D6-B con normalización interna (comparación)
}

/** Contaminación de los escenarios que aíslan otro factor (cobertura, telemetría, contexto, tamaño). El efecto de la
 *  contaminación se estudia aparte (c0 … c100). Fijado antes de la evaluación final. */
const C_AISLADA = 0.05;
const PAUSAS_DIF ={ prob: { 1: 0.1, 2: 0.2, 3: 0.35 } as Record<Nivel, number>, lucha: 1 };
const E3 = { niveles: [1, 2, 3] as Nivel[], por_nivel: 4 };

export const ESCENARIOS_D6: Escenario[] = [
  ...[0, 5, 10, 20, 50, 80, 100].map((c): Escenario => ({ id: `c${c}`, titulo: `Contaminación ${c} % (insensibles)`, grupo: 'contaminacion', detectores: c === 0 ? ['A', 'B'] : ['A'], examen: E3, contaminacion: c / 100, contaminante: 'insensible' })),
  { id: 'r20', titulo: 'Copia rápida y correcta (20 %)', grupo: 'rapidez', detectores: ['A', 'B'], examen: E3, contaminacion: 0.2, contaminante: 'rapido' },
  { id: 'asistido20', titulo: 'Asistencia en todo el examen, ×0,3 en tiempo (20 %)', grupo: 'rapidez', detectores: ['A', 'B'], examen: E3, contaminacion: 0.2, contaminante: 'asistido_total', simContaminados: { factorAsistido: 0.3 }, interno: true },
  { id: 'asistido20_suave', titulo: 'Asistencia en todo el examen, ×0,6 en tiempo (20 %)', grupo: 'rapidez', detectores: ['B'], examen: E3, contaminacion: 0.2, contaminante: 'asistido_total', simContaminados: { factorAsistido: 0.6 }, interno: true },
  { id: 'rapidos_p90', titulo: 'Rápidos legítimos (10 % con velocidad en el P90)', grupo: 'rapidez', detectores: ['B'], examen: E3, contaminacion: 0.1, contaminante: 'rapido_legitimo', simContaminados: { alfaFijo: -1.2816 * PARAMETROS_D6.tau_alpha } },
  { id: 'rapidos_p99', titulo: 'Rápidos legítimos (10 % con velocidad en el P99)', grupo: 'rapidez', detectores: ['B'], examen: E3, contaminacion: 0.1, contaminante: 'rapido_legitimo', simContaminados: { alfaFijo: -2.3263 * PARAMETROS_D6.tau_alpha } },
  { id: 'pob_gamma', titulo: 'Población distinta: sensibilidad 0,3 frente a 0,5', grupo: 'poblacion', detectores: ['A'], examen: E3, contaminacion: 0, contaminante: 'insensible', sim: { deltaGamma: -0.2 } },
  { id: 'pob_escala', titulo: 'Población distinta: dispersión de β × 2,5', grupo: 'poblacion', detectores: ['A'], examen: E3, contaminacion: 0, contaminante: 'insensible', sim: { escalaBeta: 2.5 } },
  { id: 'pob_rapida', titulo: 'Población distinta: más rápida en general (−0,5 en log T)', grupo: 'poblacion', detectores: ['B'], examen: E3, contaminacion: 0, contaminante: 'rapido', sim: { desplazamientoAlfa: -0.5 } },
  { id: 'pob_gamma_c20', titulo: 'Población distinta (0,3) + 20 % insensibles', grupo: 'poblacion', detectores: ['A'], examen: E3, contaminacion: 0.2, contaminante: 'insensible', sim: { deltaGamma: -0.2 } },
  { id: 'pequena', titulo: 'Cohorte pequeña (15 estudiantes), 5 % insensibles', grupo: 'poblacion', detectores: ['A', 'B'], examen: E3, contaminacion: C_AISLADA, contaminante: 'insensible', tam_cohorte: 15 },
  { id: 'cob_1', titulo: 'Solo nivel básico (12)', grupo: 'cobertura', detectores: ['A'], examen: { niveles: [1], por_nivel: 12 }, contaminacion: C_AISLADA, contaminante: 'insensible' },
  { id: 'cob_12', titulo: 'Básico + intermedio (6 + 6)', grupo: 'cobertura', detectores: ['A'], examen: { niveles: [1, 2], por_nivel: 6 }, contaminacion: C_AISLADA, contaminante: 'insensible' },
  { id: 'cob_13_4', titulo: 'Básico + desafiante (4 + 4)', grupo: 'cobertura', detectores: ['A'], examen: { niveles: [1, 3], por_nivel: 4 }, contaminacion: C_AISLADA, contaminante: 'insensible' },
  { id: 'cob_13_6', titulo: 'Básico + desafiante (6 + 6)', grupo: 'cobertura', detectores: ['A'], examen: { niveles: [1, 3], por_nivel: 6 }, contaminacion: C_AISLADA, contaminante: 'insensible' },
  { id: 'cob_3x2', titulo: 'Tres niveles, 2 por nivel', grupo: 'cobertura', detectores: ['A'], examen: { niveles: [1, 2, 3], por_nivel: 2 }, contaminacion: C_AISLADA, contaminante: 'insensible' },
  { id: 'cob_3x6', titulo: 'Tres niveles, 6 por nivel', grupo: 'cobertura', detectores: ['A'], examen: { niveles: [1, 2, 3], por_nivel: 6 }, contaminacion: C_AISLADA, contaminante: 'insensible' },
  { id: 'tel_perdidos', titulo: '30 % de preguntas sin registro de tiempo', grupo: 'telemetria', detectores: ['A', 'B'], examen: E3, contaminacion: C_AISLADA, contaminante: 'insensible', sim: { perdidos: 0.3 }, simContaminados: { perdidos: 0.3 } },
  ...(['reconstruir', 'reloj', 'excluir_pregunta'] as EstrategiaPausas[]).map((e): Escenario => ({
    id: `pausas_${e}`, titulo: `Pausas más frecuentes en preguntas difíciles y largas · ${e === 'reconstruir' ? 'intervalos reconstruidos' : e === 'reloj' ? 'reloj de pared (pausas sin descontar)' : 'excluir la pregunta con pausa'}`,
    grupo: 'telemetria', detectores: ['A', 'B'], examen: E3, contaminacion: C_AISLADA, contaminante: 'insensible',
    sim: { pausas: { ...PAUSAS_DIF, detectadas: true } }, simContaminados: { pausas: { ...PAUSAS_DIF, detectadas: true } }, estrategia: e,
  })),
  { id: 'pausas_no_detectadas', titulo: 'Pausas en difíciles NO registradas por la telemetría', grupo: 'telemetria', detectores: ['A', 'B'], examen: E3, contaminacion: C_AISLADA, contaminante: 'insensible', sim: { pausas: { ...PAUSAS_DIF, detectadas: false } }, simContaminados: { pausas: { ...PAUSAS_DIF, detectadas: false } } },
  { id: 'pausas_ambiguas', titulo: 'Pausas con bordes sin registrar (huecos de 2 s o 60 s)', grupo: 'telemetria', detectores: ['A', 'B'], examen: E3, contaminacion: C_AISLADA, contaminante: 'insensible', sim: { pausas: { ...PAUSAS_DIF, detectadas: true, ambiguas: 0.6 } }, simContaminados: { pausas: { ...PAUSAS_DIF, detectadas: true, ambiguas: 0.6 } } },
  { id: 'ctx_practica', titulo: 'Referencia de examen aplicada a una práctica', grupo: 'contexto', detectores: ['A', 'B'], examen: E3, contaminacion: C_AISLADA, contaminante: 'insensible', contexto: { modalidad: 'practica' } },
];

// ---------------------------------------------------------------------------------------------------------
// Ejecución

export interface Conteo {
  total_h: number; eval_h: number; fp: number;      // honestos
  total_c: number; eval_c: number; tp: number;      // contaminados
  cohortes: number; aplicables: number;
  estados: Partial<Record<EstadoD6A | 'evaluable' | 'sin_datos' | 'referencia_no_aplicable', number>>;
  sin_puerta: { fp: number; eval_h: number; tp: number; eval_c: number };   // antes de la abstención por aplicabilidad
  fp_interno?: number; tp_interno?: number; eval_interno_h?: number; eval_interno_c?: number;
  sesgo?: { suma: number; suma2: number; n: number };  // β̂ de los honestos (sesgo por pausas), sin la puerta de aplicabilidad
}
const nuevoConteo = (): Conteo => ({ total_h: 0, eval_h: 0, fp: 0, total_c: 0, eval_c: 0, tp: 0, cohortes: 0, aplicables: 0, estados: {}, sin_puerta: { fp: 0, eval_h: 0, tp: 0, eval_c: 0 }, sesgo: { suma: 0, suma2: 0, n: 0 } });

export interface ConfigValidacion {
  semillas: number[]; replicas: number; tam_cohorte: number; tam_calibracion: number; escenarios?: string[]; p?: ParametrosD6Sim;
  alAvanzar?: (hechas: number, total: number) => void;
}

/** Ejecuta todos los escenarios con cada semilla; devuelve conteos por semilla. */
export function ejecutarValidacion(cfg: ConfigValidacion): { porSemilla: Record<string, Record<'A' | 'B', Conteo>>[]; referencias: ReferenciaD6[]; huella: string } {
  const p = cfg.p ?? PARAMETROS_D6, alfa = PROTOCOLO_D6.alfa;
  const escenarios = ESCENARIOS_D6.filter((e) => !cfg.escenarios || cfg.escenarios.includes(e.id));
  const porSemilla: Record<string, Record<'A' | 'B', Conteo>>[] = [];
  const referencias: ReferenciaD6[] = [];
  for (const semilla of cfg.semillas) {
    const az = crearAzar(semilla);
    const banco = crearBanco(p, az);
    const ref = calibrarReferencia(cohorteCalibracion(cfg.tam_calibracion, banco, p, az), banco.nivel,
      { version: `ref-sim-${semilla}`, ambito: AMBITO_SIM, dificultad: banco.D, ahora: '2026-10-30T00:00:00Z' });
    referencias.push(ref);
    const res: Record<string, Record<'A' | 'B', Conteo>> = {};
    for (const esc of escenarios) {
      const items = 'niveles' in esc.examen
        ? esc.examen.niveles.flatMap((n) => banco.ids.filter((j) => banco.nivel[j] === n).slice(0, (esc.examen as { por_nivel: number }).por_nivel))
        : Object.entries(esc.examen.porNivel).flatMap(([n, k]) => banco.ids.filter((j) => banco.nivel[j] === Number(n)).slice(0, k));
      const C = { A: nuevoConteo(), B: nuevoConteo() };
      const N = esc.tam_cohorte ?? cfg.tam_cohorte;
      for (let r = 0; r < cfg.replicas; r++) {
        const nC = Math.round(esc.contaminacion * N);
        const cohorte = Array.from({ length: N }, (_, i) => {
          const perfil: Perfil = i < nC ? esc.contaminante : 'honesto';
          return { id: `s${i}`, perfil, respuestas: simularEstudiante(perfil, items, banco, p, az, perfil === 'honesto' ? esc.sim : { ...esc.sim, ...esc.simContaminados }) };
        });
        const out = analizarCohorteD6(cohorte, ref, { ...CONTEXTO_SIM, ...esc.contexto }, { estrategiaPausas: esc.estrategia, incluirPreliminar: true });
        for (const d of ['A', 'B'] as const) {
          const c = C[d];
          c.cohortes++;
          if (out.aplicabilidad[d === 'A' ? 'a' : 'b'].aplicable) c.aplicables++;
        }
        out.estudiantes.forEach((e, i) => {
          const h = cohorte[i].perfil === 'honesto';
          for (const d of ['A', 'B'] as const) {
            const x = d === 'A' ? e.a : e.b, c = C[d];
            c.estados[x.estado] = (c.estados[x.estado] ?? 0) + 1;
            if (h) { c.total_h++; if (x.p !== null) { c.eval_h++; if (x.p < alfa) c.fp++; } }
            else { c.total_c++; if (x.p !== null) { c.eval_c++; if (x.p < alfa) c.tp++; } }
            const pp = d === 'A' ? e.preliminar!.pa : e.preliminar!.pb;
            if (pp !== null) { if (h) { c.sin_puerta.eval_h++; if (pp < alfa) c.sin_puerta.fp++; } else { c.sin_puerta.eval_c++; if (pp < alfa) c.sin_puerta.tp++; } }
          }
          if (h && e.a.beta !== null && e.a.estado !== 'precision_insuficiente') { C.A.sesgo!.suma += e.a.beta; C.A.sesgo!.suma2 += e.a.beta ** 2; C.A.sesgo!.n++; }
          if (esc.interno) {
            const pi = d6bNormalizadoInterno(cohorte[i].respuestas, ref);
            const c = C.B;
            if (pi !== null) {
              if (h) { c.eval_interno_h = (c.eval_interno_h ?? 0) + 1; if (pi < alfa) c.fp_interno = (c.fp_interno ?? 0) + 1; }
              else { c.eval_interno_c = (c.eval_interno_c ?? 0) + 1; if (pi < alfa) c.tp_interno = (c.tp_interno ?? 0) + 1; }
            }
          }
        });
      }
      res[esc.id] = C;
    }
    porSemilla.push(res);
    cfg.alAvanzar?.(porSemilla.length, cfg.semillas.length);
  }
  return { porSemilla, referencias, huella: huellaProtocolo() };
}

// ---------------------------------------------------------------------------------------------------------
// Resumen: distribuciones entre semillas e intervalos agregados

export interface Distribucion { mediana: number | null; p5: number | null; p95: number | null; agregada: number | null; ic95: [number, number] | null; n: number }

function distribucion(pares: { x: number; n: number }[]): Distribucion {
  const tasas = pares.filter((q) => q.n > 0).map((q) => q.x / q.n).sort((a, b) => a - b);
  const X = pares.reduce((s, q) => s + q.x, 0), N = pares.reduce((s, q) => s + q.n, 0);
  const qtl = (f: number) => (tasas.length ? tasas[Math.min(tasas.length - 1, Math.max(0, Math.round(f * (tasas.length - 1))))] : null);
  return { mediana: qtl(0.5), p5: qtl(0.05), p95: qtl(0.95), agregada: N ? X / N : null, ic95: N ? wilson(X, N) : null, n: N };
}

export interface FilaResumen {
  escenario: string; titulo: string; grupo: Escenario['grupo']; detector: 'A' | 'B';
  fpr_evaluados: Distribucion; fpr_todos: Distribucion; cobertura_h: Distribucion;
  sens_evaluados: Distribucion; sens_todos: Distribucion; cobertura_c: Distribucion;
  cohortes_aplicables: Distribucion;
  estados: Record<string, number>;
  sin_puerta: { fpr: Distribucion; sens: Distribucion };
  interno?: { fpr: Distribucion; sens: Distribucion };
  sesgo_beta?: { media: number; se: number; n: number } | null;
}

export function resumir(porSemilla: Record<string, Record<'A' | 'B', Conteo>>[]): FilaResumen[] {
  const filas: FilaResumen[] = [];
  for (const esc of ESCENARIOS_D6) {
    if (!porSemilla[0]?.[esc.id]) continue;
    for (const d of esc.detectores) {
      const cs = porSemilla.map((s) => s[esc.id][d]);
      const estados: Record<string, number> = {};
      cs.forEach((c) => Object.entries(c.estados).forEach(([k, v]) => { estados[k] = (estados[k] ?? 0) + (v ?? 0); }));
      const sg = cs.reduce((a, c) => ({ s: a.s + (c.sesgo?.suma ?? 0), s2: a.s2 + (c.sesgo?.suma2 ?? 0), n: a.n + (c.sesgo?.n ?? 0) }), { s: 0, s2: 0, n: 0 });
      const media = sg.n ? sg.s / sg.n : 0;
      filas.push({
        escenario: esc.id, titulo: esc.titulo, grupo: esc.grupo, detector: d,
        fpr_evaluados: distribucion(cs.map((c) => ({ x: c.fp, n: c.eval_h }))),
        fpr_todos: distribucion(cs.map((c) => ({ x: c.fp, n: c.total_h }))),
        cobertura_h: distribucion(cs.map((c) => ({ x: c.eval_h, n: c.total_h }))),
        sens_evaluados: distribucion(cs.map((c) => ({ x: c.tp, n: c.eval_c }))),
        sens_todos: distribucion(cs.map((c) => ({ x: c.tp, n: c.total_c }))),
        cobertura_c: distribucion(cs.map((c) => ({ x: c.eval_c, n: c.total_c }))),
        cohortes_aplicables: distribucion(cs.map((c) => ({ x: c.aplicables, n: c.cohortes }))),
        estados,
        sin_puerta: { fpr: distribucion(cs.map((c) => ({ x: c.sin_puerta.fp, n: c.sin_puerta.eval_h }))), sens: distribucion(cs.map((c) => ({ x: c.sin_puerta.tp, n: c.sin_puerta.eval_c }))) },
        interno: esc.interno && d === 'B' ? { fpr: distribucion(cs.map((c) => ({ x: c.fp_interno ?? 0, n: c.eval_interno_h ?? 0 }))), sens: distribucion(cs.map((c) => ({ x: c.tp_interno ?? 0, n: c.eval_interno_c ?? 0 }))) } : undefined,
        sesgo_beta: d === 'A' && sg.n > 1 ? { media, se: Math.sqrt(Math.max(0, sg.s2 / sg.n - media ** 2) / sg.n), n: sg.n } : null,
      });
    }
  }
  return filas;
}

// ---------------------------------------------------------------------------------------------------------
// Diseño del examen frente a la calibración: qué diseños alcanzan la precisión exigida con CADA referencia.

export interface DisenoExamen { id: string; titulo: string; preguntas: (ref: ReferenciaD6) => { D: number; sigma: number; se_mu: number }[]; supuesto?: string }

const delNivel = (ref: ReferenciaD6, n: Nivel, k: number) => Object.values(ref.items).filter((it) => it.nivel === n).slice(0, k);
const tal = (its: ItemReferencia[], D?: number) => its.map((it) => ({ D: D ?? it.D, sigma: it.sigma, se_mu: it.se_mu }));

export const DISENOS_D6: DisenoExamen[] = [
  ...[2, 3, 4, 5, 6].map((k): DisenoExamen => ({ id: `3x${k}`, titulo: `Tres niveles × ${k} (${3 * k} preguntas)`, preguntas: (r) => [1, 2, 3].flatMap((n) => tal(delNivel(r, n as Nivel, k))) })),
  ...[2, 3, 4, 5, 6].map((k): DisenoExamen => ({ id: `ext${k}`, titulo: `Solo extremos: ${k} básicas + ${k} desafiantes (${2 * k})`, preguntas: (r) => [...tal(delNivel(r, 1, k)), ...tal(delNivel(r, 3, k))] })),
  ...[3, 4].map((k): DisenoExamen => ({ id: `ext${k}_amplio`, titulo: `Extremos ${k} + ${k} con familias calibradas de rango amplio (D = ±1,5)`,
    preguntas: (r) => [...tal(delNivel(r, 1, k), r.D_ref - 1.5), ...tal(delNivel(r, 3, k), r.D_ref + 1.5)],
    supuesto: 'Supone familias de problemas isomorfos con dificultad EMPÍRICA más separada que la de los niveles declarados; hay que calibrarlas.' })),
  { id: '3x2_acum3', titulo: 'Tres niveles × 2 en 3 evaluaciones acumuladas (18)', preguntas: (r) => [0, 1, 2].flatMap(() => [1, 2, 3].flatMap((n) => tal(delNivel(r, n as Nivel, 2)))),
    supuesto: 'Supone que la sensibilidad individual β_i es estable entre evaluaciones del semestre (no comprobado).' },
];

export function analisisDiseno(referencias: ReferenciaD6[]) {
  return DISENOS_D6.map((d) => {
    const r = referencias.map((ref) => precisionDiseno(d.preguntas(ref), ref));
    const pots = r.map((x) => x.potencia ?? 0).sort((a, b) => a - b), ses = r.map((x) => x.se ?? Infinity).sort((a, b) => a - b);
    const q = (xs: number[], f: number) => xs[Math.round(f * (xs.length - 1))];
    return { id: d.id, titulo: d.titulo, supuesto: d.supuesto ?? null, n_preguntas: d.preguntas(referencias[0]).length,
      suficiente: r.filter((x) => x.suficiente).length / r.length, potencia: { mediana: q(pots, 0.5), p5: q(pots, 0.05), p95: q(pots, 0.95) },
      se_mediana: q(ses, 0.5), se_max_mediana: q(referencias.map((x) => x.se_max).sort((a, b) => a - b), 0.5) };
  });
}

/** Huellas del protocolo y de los escenarios FIJADAS antes de la evaluación final (las comprueban las pruebas y el script). */
export const HUELLAS_CONGELADAS = { protocolo: 'eedb7558', escenarios: '40a5c6fe', disenos: '41bff7b4' }; // congeladas el 2026-10-30
export const huellasActuales = () => ({
  protocolo: huellaProtocolo(),
  escenarios: huellaProtocolo(ESCENARIOS_D6),
  disenos: huellaProtocolo(DISENOS_D6.map((d) => ({ id: d.id, titulo: d.titulo, supuesto: d.supuesto }))),
});

export const semillasEvaluacion = () => Array.from({ length: PROTOCOLO_D6.semillas_evaluacion.cantidad }, (_, k) => PROTOCOLO_D6.semillas_evaluacion.desde + k);

export type { ItemReferencia };
export { d6Individual };
