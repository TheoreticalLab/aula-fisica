/**
 * LIEIA · Experimentos de DISEÑO: ¿qué características del examen aportan información útil y cuáles generan
 * asociaciones engañosas? Compara diseños con los mismos escenarios, réplicas y semilla (diseño emparejado).
 * Una característica «aporta» si sube la potencia sin romper el control de falsos positivos; «engaña» si hace
 * que algún detector supere el límite de falsos positivos en un control negativo.
 */
import { crearAzar } from './azar';
import { ejecutarExperimento, type Detector, type ResultadoExperimento } from './laboratorio';
import { PARAMETROS_BASE, type DisenoSim, type Escenario, type ItemDiseno, type ParametrosSim } from './simulador';
import type { OpcionesAnalisis } from './detectores';
import type { Calibracion } from './diseno';

export interface EspecDiseno {
  items: number; fraccionAbiertas: number; isomorfos: boolean; orden: DisenoSim['orden']; versiones: boolean; fatiga: number; aprendizaje?: number;
}

/** Diseño sintético a partir de una especificación (ítems con parámetros de un banco plausible). */
export function construirDiseno(e: EspecDiseno, semilla = 77): DisenoSim {
  const az = crearAzar(semilla);
  const items: ItemDiseno[] = [];
  for (let j = 0; j < e.items; j++) {
    const gemela = e.isomorfos && j % 2 === 1 && j > 1;
    const b = gemela ? items[j - 1].b + az.normal(0, 0.2) : az.normal(0, 1);
    const abierta = gemela ? items[j - 1].opciones === null : az.u() < e.fraccionAbiertas;
    items.push({
      a: 0.7 + az.u(), b, se_a: 0.12, se_b: 0.2, beta_t: Math.log(abierta ? 110 : 60) + 0.25 * b + az.normal(0, 0.25), sigma_t: 0.35,
      opciones: abierta ? null : 4, rol: j < 2 ? 'ancla' : e.isomorfos ? 'isomorfa' : 'normal',
      grupo: e.isomorfos && j >= 2 ? `G${Math.floor(j / 2)}` : null, bloque: Math.floor((3 * j) / e.items),
    });
  }
  return { items, orden: e.orden, versiones: e.versiones, fatiga: e.fatiga, aprendizaje: e.aprendizaje ?? 0, propagarIncertidumbre: true };
}

/** Diseño a partir de ítems REALES con su calibración (o a priori), para la prueba previa de un examen concreto. */
export function disenoDesdeCalibracion(items: { cal: Calibracion; opciones: number | null; rol: ItemDiseno['rol']; grupo: string | null; bloque: number | null }[], orden: DisenoSim['orden'], versiones: boolean): DisenoSim {
  return {
    items: items.map((x) => ({ a: x.cal.a, b: x.cal.b, se_a: x.cal.se_a, se_b: x.cal.se_b, beta_t: x.cal.beta_t, sigma_t: x.cal.sigma_t, opciones: x.opciones, rol: x.rol, grupo: x.grupo, bloque: x.bloque })),
    orden, versiones, fatiga: 0.3, aprendizaje: 0, propagarIncertidumbre: true,
  };
}

export interface FilaComparacion { diseno: string; escenario: Escenario; detectores: Record<Detector, { fpr: number; fprSup: number; potencia: number | null }> }

export function compararDisenos(
  disenos: { nombre: string; diseno: DisenoSim; analisis?: Partial<OpcionesAnalisis> }[],
  escenarios: Escenario[], base: Partial<ParametrosSim>, replicas: number, semilla: number, analisis: Partial<OpcionesAnalisis>,
  progreso?: (k: number, total: number) => void,
): FilaComparacion[] {
  const filas: FilaComparacion[] = [];
  let k = 0;
  for (const d of disenos) for (const e of escenarios) {
    const r: ResultadoExperimento = ejecutarExperimento({
      parametros: { ...PARAMETROS_BASE, ...base, escenario: e, items: d.diseno.items.length, diseno: d.diseno }, replicas, semilla, alfa: 0.05, qUmbral: 0.1,
      analisis: { ...analisis, ...d.analisis },
    });
    filas.push({ diseno: d.nombre, escenario: e, detectores: Object.fromEntries(Object.entries(r.detectores).map(([x, m]) => [x, { fpr: m.fpr, fprSup: m.fprIC[1], potencia: m.potencia }])) as FilaComparacion['detectores'] });
    progreso?.(++k, disenos.length * escenarios.length);
  }
  return filas;
}

/** Conclusión automática de un contraste A (referencia) frente a B (con la característica). */
export function contrastar(filas: FilaComparacion[], a: string, b: string, negativos: Escenario[], positivo: Escenario, detectores: Detector[], fprMax = 0.075) {
  const fa = (e: Escenario) => filas.find((f) => f.diseno === a && f.escenario === e)!;
  const fb = (e: Escenario) => filas.find((f) => f.diseno === b && f.escenario === e)!;
  return detectores.map((d) => {
    const engana = negativos.some((e) => fb(e).detectores[d].fpr > 0 && fb(e).detectores[d].fprSup > fprMax) && !negativos.some((e) => fa(e).detectores[d].fprSup > fprMax);
    const pa = fa(positivo).detectores[d].potencia ?? 0, pb = fb(positivo).detectores[d].potencia ?? 0;
    const veredicto = engana ? 'engañosa' : pb - pa >= 0.1 ? 'aporta' : pa - pb >= 0.1 ? 'resta' : 'neutra';
    return { detector: d, potenciaA: pa, potenciaB: pb, fprB: Math.max(...negativos.map((e) => fb(e).detectores[d].fpr)), veredicto };
  });
}
