/**
 * LIEIA · Laboratorio de la telemetría del proceso: réplicas con verdad conocida, mismas funciones que con datos
 * reales (reconstruir → analizarProceso). Mide falsos positivos, potencia, AUC, la frecuencia de «pegados» y la
 * PRECISIÓN de la reconstrucción temporal (error al recuperar la hora real de cada primera vista) bajo pérdida y
 * retraso de eventos y recargas.
 */
import { derivarSemilla } from './azar';
import { analizarProceso } from './detectoresProceso';
import { auc, wilson } from './estadistica';
import { reconstruir } from './proceso';
import { simularProceso, type ParamProceso } from './simuladorProceso';

export interface MetricaP { nulos: number; fp: number; fpr: number; fprIC: [number, number]; positivos: number; tp: number; potencia: number | null; auc: number | null; abstenciones: number }
export interface ResultadoLabProceso {
  p1: MetricaP; p2: MetricaP;
  p3: { conPegadosPositivos: number | null; conPegadosNegativos: number };
  reconstruccion: { errorMedianoS: number; error90S: number; perdidaObservada: number; recuperadas: number };
  segundos: number;
}

export function experimentoProceso(p: ParamProceso, replicas: number, semilla: number, bootstrap = 99): ResultadoLabProceso {
  const t0 = Date.now();
  const acc = { p1: { s: [] as number[], v: [] as boolean[], ab: 0 }, p2: { s: [] as number[], v: [] as boolean[], ab: 0 } };
  const errores: number[] = [];
  let pegPos = 0, nPos = 0, pegNeg = 0, nNeg = 0, perdidos = 0, totales = 0, recuperadas = 0, vistasVerdad = 0;
  for (let rep = 0; rep < replicas; rep++) {
    const sem = derivarSemilla(semilla, rep);
    const sim = simularProceso(p, sem);
    const ids = sim.items.map((x) => x.id);
    const procesos = sim.intentos.map((x) => reconstruir(x.eventos, x.inicio, x.entrega, ids));
    const res = analizarProceso(procesos, ids, { semilla: sem, bootstrap });
    res.forEach((r, i) => {
      const pos = sim.positivos.has(i);
      for (const d of ['p1', 'p2'] as const) {
        const x = r[d];
        if (!x) { acc[d].ab++; continue; }
        acc[d].s.push(x.p); acc[d].v.push(pos);
      }
      const abiertas = sim.items.filter((x) => x.abierta).length;
      if (pos) { nPos++; if (r.p3.pegados >= Math.max(2, abiertas / 2)) pegPos++; } else { nNeg++; if (r.p3.pegados >= Math.max(2, abiertas / 2)) pegNeg++; }
    });
    // precisión de la reconstrucción: hora de la primera vista recuperada frente a la real
    sim.intentos.forEach((x, i) => {
      for (const [id, tv] of x.verdad.vistas) {
        vistasVerdad++;
        const it = procesos[i].items.find((y) => y.exercise_id === id);
        if (it?.vista !== null && it?.vista !== undefined) { recuperadas++; errores.push(Math.abs(it.vista - tv)); }
      }
      const porS = new Map<string, number[]>();
      for (const e of x.eventos) porS.set(e.s, [...(porS.get(e.s) ?? []), e.q]);
      for (const qs of porS.values()) { totales += Math.max(...qs); perdidos += Math.max(...qs) - new Set(qs).size; }
    });
  }
  const metrica = (a: { s: number[]; v: boolean[]; ab: number }): MetricaP => {
    const nul = a.s.filter((_, k) => !a.v[k]), pos = a.s.filter((_, k) => a.v[k]);
    const fp = nul.filter((x) => x < 0.05).length, tp = pos.filter((x) => x < 0.05).length;
    return {
      nulos: nul.length, fp, fpr: nul.length ? fp / nul.length : 0, fprIC: wilson(fp, nul.length), positivos: pos.length, tp,
      potencia: pos.length ? tp / pos.length : null, auc: pos.length && nul.length ? auc(a.s.map((x) => -x), a.v) : null, abstenciones: a.ab,
    };
  };
  errores.sort((a, b) => a - b);
  return {
    p1: metrica(acc.p1), p2: metrica(acc.p2),
    p3: { conPegadosPositivos: nPos ? pegPos / nPos : null, conPegadosNegativos: nNeg ? pegNeg / nNeg : 0 },
    reconstruccion: { errorMedianoS: errores[Math.floor(errores.length / 2)] ?? NaN, error90S: errores[Math.floor(errores.length * 0.9)] ?? NaN, perdidaObservada: totales ? perdidos / totales : 0, recuperadas: vistasVerdad ? recuperadas / vistasVerdad : 0 },
    segundos: (Date.now() - t0) / 1000,
  };
}
