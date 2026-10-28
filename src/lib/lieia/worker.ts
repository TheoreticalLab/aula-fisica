/** LIEIA · Trabajador en segundo plano: experimentos, barridos, calibración, comparación de diseños y análisis real. */
import { analizar, type OpcionesAnalisis } from './detectores';
import { calibrar2PL, type DatosCalibracion } from './diseno';
import { compararDisenos } from './experimentosDiseno';
import { barrido, ejecutarExperimento, type ConfigExperimento } from './laboratorio';
import { experimentoProceso } from './laboratorioProceso';
import type { ParamProceso } from './simuladorProceso';
import { serializarAnalisis, serializarExperimento } from './serial';
import type { DisenoSim, Escenario, ParametrosSim } from './simulador';
import type { ExamenObservado } from './tipos';

export type Peticion =
  | { tipo: 'experimento'; cfg: ConfigExperimento }
  | { tipo: 'barrido'; cfg: ConfigExperimento; parametro: keyof ParametrosSim; valores: number[] }
  | { tipo: 'analizar'; examen: ExamenObservado; opciones: Partial<OpcionesAnalisis> }
  | { tipo: 'calibrar'; datos: DatosCalibracion }
  | { tipo: 'proceso'; param: ParamProceso; replicas: number; semilla: number }
  | { tipo: 'disenos'; disenos: { nombre: string; diseno: DisenoSim }[]; escenarios: Escenario[]; base: Partial<ParametrosSim>; replicas: number; semilla: number; analisis: Partial<OpcionesAnalisis> };

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
    } else if (m.tipo === 'proceso') {
      ctx.postMessage({ tipo: 'resultado', resultado: experimentoProceso(m.param, m.replicas, m.semilla, 99) });
    } else if (m.tipo === 'calibrar') {
      ctx.postMessage({ tipo: 'resultado', resultado: calibrar2PL(m.datos) });
    } else if (m.tipo === 'disenos') {
      const r = compararDisenos(m.disenos, m.escenarios, m.base, m.replicas, m.semilla, m.analisis, (k, total) => ctx.postMessage({ tipo: 'progreso', hechas: k, total }));
      ctx.postMessage({ tipo: 'resultado', resultado: r });
    } else {
      ctx.postMessage({ tipo: 'resultado', resultado: serializarAnalisis(analizar(m.examen, m.opciones)) });
    }
  } catch (err) {
    ctx.postMessage({ tipo: 'error', mensaje: err instanceof Error ? err.message : String(err) });
  }
};
