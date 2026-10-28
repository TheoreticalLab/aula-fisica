/** LIEIA · Trabajador en segundo plano: experimentos, barridos y análisis de exámenes reales sin congelar el panel. */
import { analizar, type OpcionesAnalisis } from './detectores';
import { barrido, ejecutarExperimento, type ConfigExperimento } from './laboratorio';
import { serializarAnalisis, serializarExperimento } from './serial';
import type { ParametrosSim } from './simulador';
import type { ExamenObservado } from './tipos';

export type Peticion =
  | { tipo: 'experimento'; cfg: ConfigExperimento }
  | { tipo: 'barrido'; cfg: ConfigExperimento; parametro: keyof ParametrosSim; valores: number[] }
  | { tipo: 'analizar'; examen: ExamenObservado; opciones: Partial<OpcionesAnalisis> };

const ctx = self as unknown as { postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent<Peticion>) => void) | null };

ctx.onmessage = (e) => {
  try {
    const m = e.data;
    if (m.tipo === 'experimento') {
      const r = ejecutarExperimento(m.cfg, (k) => ctx.postMessage({ tipo: 'progreso', hechas: k, total: m.cfg.replicas }));
      ctx.postMessage({ tipo: 'resultado', resultado: serializarExperimento(r) });
    } else if (m.tipo === 'barrido') {
      const r = barrido(m.cfg, m.parametro, m.valores, (k) => ctx.postMessage({ tipo: 'progreso', hechas: k, total: m.valores.length }));
      ctx.postMessage({ tipo: 'resultado', resultado: r });
    } else {
      ctx.postMessage({ tipo: 'resultado', resultado: serializarAnalisis(analizar(m.examen, m.opciones)) });
    }
  } catch (err) {
    ctx.postMessage({ tipo: 'error', mensaje: err instanceof Error ? err.message : String(err) });
  }
};
