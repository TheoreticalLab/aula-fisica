/**
 * LIEIA · Laboratorio experimental: réplicas reproducibles (semilla), verdad conocida y métricas de desempeño.
 *
 * Unidad de evaluación:
 *   - Detectores de pareja (D1–D3): positiva = dependencia DIRECTA; negativa = ninguna dependencia. Las parejas con
 *     dependencia indirecta (dos receptores de una misma fuente) o por causa común (misma confusión) se excluyen
 *     de positivas y negativas y se reporta aparte con qué frecuencia se señalan.
 *   - Detectores de estudiante (D4–D7): positivo = recibe ayuda (asistencia externa o copia de un compañero).
 * Métricas: tasa de falsos positivos a α (con IC de Wilson), potencia a α, FDR realizada y potencia con BH (q < 0,1),
 * AUC, histograma de valores p bajo la nula y calibración de la probabilidad posterior (Brier, ECE, fiabilidad).
 */
import { derivarSemilla } from './azar';
import { analizar, grafo, type OpcionesAnalisis } from './detectores';
import { auc, calibracion, curvaRoc, wilson } from './estadistica';
import { simular, type ParametrosSim } from './simulador';
import { clavePareja } from './tipos';

export type Detector = 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7' | 'd8';
export const DETECTORES: Record<Detector, { nombre: string; unidad: 'pareja' | 'estudiante'; hipotesis: string }> = {
  d1: { nombre: 'Respuestas incorrectas idénticas', unidad: 'pareja', hipotesis: 'Colaboración / intercambio de respuestas' },
  d2: { nombre: 'Tiempos acoplados', unidad: 'pareja', hipotesis: 'Uno espera la respuesta del otro' },
  d3: { nombre: 'Sincronía de respuestas iguales', unidad: 'pareja', hipotesis: 'Uno responde lo mismo poco después del otro (líder–seguidor)' },
  d4: { nombre: 'Ajuste de persona (l_z)', unidad: 'estudiante', hipotesis: 'Patrón de aciertos incoherente con la habilidad' },
  d5: { nombre: 'Aciertos difíciles demasiado rápidos', unidad: 'estudiante', hipotesis: 'Asistencia externa / IA' },
  d6: { nombre: 'Tiempo insensible a la dificultad (v1, obsoleto)', unidad: 'estudiante', hipotesis: 'Asistencia externa / IA' },
  d7: { nombre: 'Anomalía multivariante (descriptiva)', unidad: 'estudiante', hipotesis: 'Comportamiento atípico (sin hipótesis específica)' },
  d8: { nombre: 'Inconsistencia entre versiones isomorfas', unidad: 'estudiante', hipotesis: 'Conocimiento específico de ciertas preguntas (filtración)' },
};

export interface ConfigExperimento { parametros: ParametrosSim; replicas: number; semilla: number; alfa: number; qUmbral: number; analisis: Partial<OpcionesAnalisis> }

export interface MetricasDetector {
  nulos: number; fp: number; fpr: number; fprIC: [number, number];
  positivos: number; tp: number; potencia: number | null; potenciaIC: [number, number] | null;
  fdrBH: number | null; potenciaBH: number | null;
  auc: number | null;
  abstenciones: number;
  histogramaNulo: number[]; // 10 tramos de p bajo la nula (uniforme si está bien calibrado)
  señaladosOtros: { causaComun: number; causaComunTotal: number; indirectas: number; indirectasTotal: number };
  roc: { fpr: number; tpr: number }[];
}
export interface ResultadoExperimento {
  config: ConfigExperimento;
  detectores: Record<Detector, MetricasDetector>;
  calibracion: Record<'d1' | 'd2', ReturnType<typeof calibracion> & { n: number; altas: number; dependientes: number }>;
  centroRecuperado: { aciertos: number; total: number } | null;
  ejemplo: ReturnType<typeof simular> & { analisis: ReturnType<typeof analizar> };
  segundos: number;
}

const vacio = (): MetricasDetector => ({
  nulos: 0, fp: 0, fpr: 0, fprIC: [0, 1], positivos: 0, tp: 0, potencia: null, potenciaIC: null, fdrBH: null, potenciaBH: null, auc: null,
  abstenciones: 0, histogramaNulo: new Array(10).fill(0), señaladosOtros: { causaComun: 0, causaComunTotal: 0, indirectas: 0, indirectasTotal: 0 }, roc: [],
});

export function ejecutarExperimento(cfg: ConfigExperimento, progreso?: (hechas: number) => void): ResultadoExperimento {
  const t0 = Date.now();
  const det = Object.fromEntries((Object.keys(DETECTORES) as Detector[]).map((d) => [d, vacio()])) as Record<Detector, MetricasDetector>;
  const puntajes = Object.fromEntries((Object.keys(DETECTORES) as Detector[]).map((d) => [d, { s: [] as number[], v: [] as boolean[] }])) as Record<Detector, { s: number[]; v: boolean[] }>;
  const fdrs = Object.fromEntries((Object.keys(DETECTORES) as Detector[]).map((d) => [d, { fdr: [] as number[], tp: 0 }])) as Record<Detector, { fdr: number[]; tp: number }>;
  const cal = { d1: { p: [] as number[], v: [] as boolean[] }, d2: { p: [] as number[], v: [] as boolean[] } };
  let centro = cfg.parametros.escenario === 'red' ? { aciertos: 0, total: 0 } : null;
  let ejemplo: ResultadoExperimento['ejemplo'] | null = null;

  for (let rep = 0; rep < cfg.replicas; rep++) {
    const sem = derivarSemilla(cfg.semilla, rep);
    const sim = simular(cfg.parametros, sem);
    const a = analizar(sim.examen, { ...cfg.analisis, semilla: sem });
    if (rep === 0) ejemplo = { ...sim, analisis: a };
    const v = sim.verdad;

    // --- parejas ---
    for (const d of ['d1', 'd2', 'd3'] as const) {
      const qk = d === 'd1' ? 'q1' : d === 'd2' ? 'q2' : 'q3';
      let descubiertos = 0, falsos = 0;
      for (const p of a.parejas) {
        const r = p[d];
        const clave = clavePareja(p.i, p.j);
        const directa = v.parejas.has(clave);
        const otra = v.indirectas.has(clave) || v.causaComun.has(clave);
        if (!r) { det[d].abstenciones++; continue; }
        const q = p[qk] as number;
        if (v.causaComun.has(clave)) { det[d].señaladosOtros.causaComunTotal++; if (r.p < cfg.alfa) det[d].señaladosOtros.causaComun++; }
        if (v.indirectas.has(clave)) { det[d].señaladosOtros.indirectasTotal++; if (r.p < cfg.alfa) det[d].señaladosOtros.indirectas++; }
        if (q < cfg.qUmbral) { descubiertos++; if (!directa && !otra) falsos++; if (directa) fdrs[d].tp++; }
        if (otra) continue;
        puntajes[d].s.push(-Math.log10(Math.max(1e-300, r.p)));
        puntajes[d].v.push(directa);
        if (directa) { det[d].positivos++; if (r.p < cfg.alfa) det[d].tp++; }
        else { det[d].nulos++; if (r.p < cfg.alfa) det[d].fp++; det[d].histogramaNulo[Math.min(9, Math.floor(r.p * 10))]++; }
      }
      fdrs[d].fdr.push(descubiertos ? falsos / descubiertos : 0);
    }
    for (const p of a.parejas) {
      const clave = clavePareja(p.i, p.j);
      const dependiente = v.parejas.has(clave) || v.indirectas.has(clave) || v.causaComun.has(clave);
      if (p.post1 !== null) { cal.d1.p.push(p.post1); cal.d1.v.push(dependiente); }
      if (p.post2 !== null) { cal.d2.p.push(p.post2); cal.d2.v.push(dependiente); }
    }

    // --- estudiantes ---
    for (const d of ['d4', 'd5', 'd6', 'd7', 'd8'] as const) {
      const qk = d === 'd4' ? 'q4' : d === 'd5' ? 'q5' : d === 'd6' ? 'q6' : d === 'd7' ? 'q7' : 'q8';
      let descubiertos = 0, falsos = 0;
      for (const e of a.estudiantes) {
        const r = e[d];
        if (!r) { det[d].abstenciones++; continue; }
        const positivo = v.asistidos.has(e.i) || v.receptores.has(e.i);
        const q = e[qk] as number;
        if (q < cfg.qUmbral) { descubiertos++; if (!positivo) falsos++; else fdrs[d].tp++; }
        puntajes[d].s.push(-Math.log10(Math.max(1e-300, r.p)));
        puntajes[d].v.push(positivo);
        if (positivo) { det[d].positivos++; if (r.p < cfg.alfa) det[d].tp++; }
        else { det[d].nulos++; if (r.p < cfg.alfa) det[d].fp++; det[d].histogramaNulo[Math.min(9, Math.floor(r.p * 10))]++; }
      }
      fdrs[d].fdr.push(descubiertos ? falsos / descubiertos : 0);
    }

    if (centro && v.centro !== null) {
      const g = grafo(a, sim.examen.estudiantes.length, ['d1', 'd3']);
      centro.total++;
      if (g.centro === v.centro) centro.aciertos++;
    }
    progreso?.(rep + 1);
  }

  for (const d of Object.keys(det) as Detector[]) {
    const m = det[d];
    m.fpr = m.nulos ? m.fp / m.nulos : 0;
    m.fprIC = wilson(m.fp, m.nulos);
    m.potencia = m.positivos ? m.tp / m.positivos : null;
    m.potenciaIC = m.positivos ? wilson(m.tp, m.positivos) : null;
    m.fdrBH = fdrs[d].fdr.length ? fdrs[d].fdr.reduce((s, x) => s + x, 0) / fdrs[d].fdr.length : null;
    m.potenciaBH = m.positivos ? fdrs[d].tp / m.positivos : null;
    m.auc = m.positivos && m.nulos ? auc(puntajes[d].s, puntajes[d].v) : null;
    m.roc = m.positivos && m.nulos ? curvaRoc(puntajes[d].s, puntajes[d].v) : [];
  }
  if (centro && centro.total === 0) centro = null;
  return {
    config: cfg,
    detectores: det,
    calibracion: {
      d1: { ...calibracion(cal.d1.p, cal.d1.v), n: cal.d1.p.length, altas: cal.d1.p.filter((p, k) => cal.d1.v[k] && p >= 0.5).length, dependientes: cal.d1.v.filter(Boolean).length },
      d2: { ...calibracion(cal.d2.p, cal.d2.v), n: cal.d2.p.length, altas: cal.d2.p.filter((p, k) => cal.d2.v[k] && p >= 0.5).length, dependientes: cal.d2.v.filter(Boolean).length },
    },
    centroRecuperado: centro,
    ejemplo: ejemplo!,
    segundos: (Date.now() - t0) / 1000,
  };
}

/** Análisis de sensibilidad: repite el experimento variando un parámetro. */
export function barrido(base: ConfigExperimento, parametro: keyof ParametrosSim, valores: number[], progreso?: (k: number) => void) {
  return valores.map((valor, k) => {
    const r = ejecutarExperimento({ ...base, parametros: { ...base.parametros, [parametro]: valor } });
    progreso?.(k + 1);
    return { valor, detectores: r.detectores };
  });
}
