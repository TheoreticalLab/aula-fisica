/**
 * LIEIA · Protocolo de aceptación. Un detector solo se usa sobre datos reales si la batería de experimentos con
 * verdad conocida demuestra que controla los falsos positivos en TODOS los controles negativos; su potencia y la
 * calibración de su probabilidad posterior determinan cómo se presenta (o si se abstiene).
 *
 * Criterios (α = 0,05):
 *   FPR    límite superior del IC de Wilson al 95 % ≤ 0,075 en cada control negativo y entre las unidades NO
 *          implicadas de cada escenario positivo o adversarial.
 *   Potencia  ≥ 0,80 en sus escenarios objetivo → «validado»; 0,20–0,80 → «validado con limitaciones»;
 *          < 0,20 → «sin potencia demostrada» (no se muestra como evidencia).
 *   Posterior  «calibrada» si en ningún tramo con n ≥ 10 la frecuencia observada queda por debajo de la predicha
 *          (sin sobreconfianza: límite superior de Wilson + 0,05 ≥ predicha), ECE ≤ 0,05 y es INFORMATIVA (al menos
 *          el 30 % de las parejas dependientes reciben ≥ 0,5). Si no, en datos reales se muestra abstención.
 */
import type { Detector, ResultadoExperimento } from './laboratorio';
import type { Escenario } from './simulador';
import { wilson } from './estadistica';

export const NEGATIVOS: Escenario[] = ['independiente', 'facil', 'mismo_ritmo', 'inicio_escalonado', 'orden_aleatorio', 'misma_confusion'];
export const OBJETIVO: Record<Detector, Escenario[]> = {
  d1: ['parejas', 'red'], d2: ['parejas', 'red'], d3: ['parejas', 'red'],
  d4: ['asistencia_ia'], d5: ['asistencia_ia'], d6: ['asistencia_ia'], d7: ['asistencia_ia'], d8: ['filtracion'],
};
export const FPR_MAX = 0.075;

export type Estado = 'validado' | 'validado_limitado' | 'sin_potencia' | 'no_validado';
export const ESTADO_TEXTO: Record<Estado, string> = {
  validado: 'Validado', validado_limitado: 'Validado con limitaciones (solo indicio)', sin_potencia: 'Sin potencia demostrada', no_validado: 'No validado (falsos positivos no controlados)',
};

export interface Veredicto {
  estado: Estado;
  fpr: { escenario: Escenario; fpr: number; ic: [number, number]; ok: boolean }[];
  potencia: { escenario: Escenario; potencia: number | null; ic: [number, number] | null }[];
  limitaciones: string[];
}

export function veredicto(d: Detector, res: Partial<Record<Escenario, ResultadoExperimento>>): Veredicto {
  // falsos positivos: controles negativos Y unidades no implicadas dentro de los escenarios positivos y adversariales
  const fpr = (Object.keys(res) as Escenario[]).filter((e) => res[e] && res[e]!.detectores[d].nulos > 0).map((e) => {
    const m = res[e]!.detectores[d];
    return { escenario: e, fpr: m.fpr, ic: m.fprIC, ok: m.fprIC[1] <= FPR_MAX };
  });
  const potencia = OBJETIVO[d].filter((e) => res[e]).map((e) => ({ escenario: e, potencia: res[e]!.detectores[d].potencia, ic: res[e]!.detectores[d].potenciaIC }));
  const limitaciones: string[] = [];
  const cc = res.misma_confusion?.detectores[d].señaladosOtros;
  if (cc && cc.causaComunTotal && cc.causaComun / cc.causaComunTotal > 0.2) {
    limitaciones.push(`Señala al ${Math.round((100 * cc.causaComun) / cc.causaComunTotal)} % de las parejas con una misma confusión (causa común legítima): no distingue copiar de haber estudiado juntos.`);
  }
  let estado: Estado;
  const pots = potencia.map((p) => p.potencia ?? 0);
  if (fpr.some((f) => !f.ok)) estado = 'no_validado';
  else if (!pots.length || Math.min(...pots) < 0.2) estado = pots.some((p) => p >= 0.2) ? 'validado_limitado' : 'sin_potencia';
  else estado = Math.min(...pots) >= 0.8 ? 'validado' : 'validado_limitado';
  return { estado, fpr, potencia, limitaciones };
}

export interface VeredictoPosterior { calibrada: boolean; informativa: boolean; ece: number; sobreconfianza: { desde: number; predicha: number; observada: number; n: number }[]; fraccionAlta: number }

/** Calibración de la posterior de un detector de pareja, sumando los escenarios dados (negativos y positivos). */
export function veredictoPosterior(d: 'd1' | 'd2', res: ResultadoExperimento[], dependientesAltas: { altas: number; total: number }): VeredictoPosterior {
  const tramos = Array.from({ length: 10 }, (_, k) => ({ desde: k / 10, n: 0, pred: 0, obs: 0 }));
  let n = 0;
  for (const r of res) {
    for (const t of r.calibracion[d].tabla) {
      const k = Math.round(t.desde * 10);
      tramos[k].n += t.n;
      tramos[k].pred += t.predicha * t.n;
      tramos[k].obs += t.observada * t.n;
      n += t.n;
    }
  }
  let ece = 0;
  const sobreconfianza: VeredictoPosterior['sobreconfianza'] = [];
  for (const t of tramos) {
    if (!t.n) continue;
    const pred = t.pred / t.n, obs = t.obs / t.n;
    ece += (t.n / n) * Math.abs(pred - obs);
    if (t.n >= 10 && wilson(Math.round(obs * t.n), t.n)[1] + 0.05 < pred) sobreconfianza.push({ desde: t.desde, predicha: pred, observada: obs, n: t.n });
  }
  const fraccionAlta = dependientesAltas.total ? dependientesAltas.altas / dependientesAltas.total : 0;
  return { calibrada: !sobreconfianza.length && ece <= 0.05, informativa: fraccionAlta >= 0.3, ece, sobreconfianza, fraccionAlta };
}
