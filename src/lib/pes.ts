/**
 * Práctica Extraordinaria Secuencial (PES): reglas puras compartidas por la interfaz y las pruebas.
 * La autoridad es el servidor (migración 74: pes_puntaje, pes_formula, pes_t_min, svc_pes_confirmar); esto es su
 * espejo para mostrar, simular y probar. Si cambia una fórmula aquí, debe cambiar allí (y al revés): la prueba de
 * paridad (scripts/pruebas-pg/pes-integracion.ts) compara ambas con casos aleatorios.
 *
 *   S = Σ w·q        P_base = P_max·(S/N)^α        F = Σ w·q·m / S        P = P_base·F   (0 si S = 0; ≤ P_max)
 *
 * w: peso del apartado (los de un ejercicio suman 1), q ∈ [0, 1]: calidad, m: 1 a tiempo o el factor de avance
 * anticipado (0.5 por defecto).
 *  · Provisional: todo lo calificado hasta ahora; lo pendiente de revisión docente cuenta q = 0.
 *  · Validada: solo lo que el profesor validó (calificaciones automáticas validadas y revisiones).
 *  · Máxima alcanzable: lo provisional + lo pendiente de revisión con crédito completo (con su m) + lo que el
 *    estudiante aún puede responder a tiempo (m = 1). Lo omitido no se recupera.
 */

export interface ApartadoPuntuado {
  peso: number;
  /** calidad 0–1; null: todavía no respondido */
  q: number | null;
  /** factor temporal con que se cerró: 1 a tiempo, factor_anticipado si avanzó antes del mínimo */
  m: number;
  omitido?: boolean;
  pendienteRevision?: boolean;
  validada?: boolean;
}

export interface ParametrosPes {
  pMax: number;
  alfa: number;
  factorAnticipado: number;
  incremento: number;
}

export const PES_POR_DEFECTO: ParametrosPes = { pMax: 8, alfa: 2, factorAnticipado: 0.5, incremento: 0.2 };

export interface Formula {
  S: number;
  Sm: number;
  pBase: number;
  fTiempo: number;
  p: number;
}

export interface PuntajePes {
  provisional: Formula;
  validada: Formula & { completa: boolean };
  maxima: Formula;
}

const acotar = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** La fórmula (igual que pes_formula). */
export function formula(S: number, Sm: number, n: number, p: Pick<ParametrosPes, 'pMax' | 'alfa'> = PES_POR_DEFECTO): Formula {
  const pBase = n > 0 ? p.pMax * Math.pow(S / n, p.alfa) : 0;
  const fTiempo = S > 0 ? Sm / S : 0;
  const pf = S > 0 && n > 0 ? Math.min(p.pMax, pBase * fTiempo) : 0;
  return { S, Sm, pBase, fTiempo, p: pf };
}

export function puntajePes(apartados: ApartadoPuntuado[], nEjercicios: number, p: Pick<ParametrosPes, 'pMax' | 'alfa'> = PES_POR_DEFECTO, puedeResponder = true): PuntajePes {
  let S = 0, Sm = 0, Sv = 0, Svm = 0, libre = 0, pend = 0, pendM = 0, sinValidar = 0, cerrados = 0;
  for (const a of apartados) {
    const respondido = a.q !== null || a.omitido;
    const m = acotar(a.m, 0, 1);
    const q = a.omitido || a.pendienteRevision || a.q === null ? 0 : acotar(a.q, 0, 1);
    S += a.peso * q;
    Sm += a.peso * q * m;
    if (a.validada && !a.pendienteRevision) { Sv += a.peso * q; Svm += a.peso * q * m; }
    if (!respondido) libre += a.peso;
    if (a.pendienteRevision && !a.omitido) { pend += a.peso; pendM += a.peso * m; }
    if (respondido) { cerrados++; if (!a.validada) sinValidar++; }
  }
  const extra = puedeResponder ? libre : 0;
  return {
    provisional: formula(S, Sm, nEjercicios, p),
    validada: { ...formula(Sv, Svm, nEjercicios, p), completa: sinValidar === 0 && cerrados === apartados.length },
    maxima: formula(S + pend + extra, Sm + pendM + extra, nEjercicios, p),
  };
}

/**
 * Espera mínima de un apartado (s): (1 + incremento)·T_ref·factor de espera. Igual que pes_t_min (2 decimales).
 * El factor de espera es una adaptación que solo REDUCE (0 a 1); el tiempo adicional no la cambia: amplía el plazo.
 */
export function tiempoMinimo(tRefS: number, incremento = PES_POR_DEFECTO.incremento, factorEspera = 1): number {
  const f = acotar(factorEspera, 0, 1);
  return Math.round((1 + incremento) * tRefS * f * 100) / 100;
}

/** Texto obligatorio del aviso de avance anticipado (con el porcentaje que corresponda al factor configurado). */
export function avisoAnticipado(factor = PES_POR_DEFECTO.factorAnticipado): string {
  const pct = Math.round(factor * 100);
  return `Si avanza ahora, la puntuación obtenible en este apartado se reducirá al ${pct}%. Esta decisión es irreversible`;
}

export const AVISO_OMITIR = 'Si omite este apartado, valdrá 0 y no podrá volver a él. Esta decisión es irreversible';

/** Lo que se dice del bloqueo de pegado: una barrera de interacción, no una garantía. */
export const AVISO_PEGADO = 'En esta práctica no se puede pegar ni arrastrar texto en las respuestas: escríbalas usted. Es una barrera de interacción, no un detector: no impide ni comprueba el uso de otras herramientas.';

/** Estructura de un ejercicio: 3 a 5 apartados con pesos positivos que suman 1. Devuelve el problema o null. */
export function validarEjercicio(pesos: number[]): string | null {
  if (pesos.length < 3 || pesos.length > 5) return 'Cada ejercicio tiene de 3 a 5 apartados';
  if (pesos.some((w) => !(w > 0) || w > 1)) return 'Cada peso debe estar entre 0 y 1';
  if (Math.abs(pesos.reduce((s, w) => s + w, 0) - 1) > 1e-6) return 'Los pesos de los apartados deben sumar 1';
  return null;
}

/** Pesos iguales con 5 decimales; el último absorbe el redondeo (igual que pes_pesos). */
export function pesosIguales(n: number): number[] {
  const w = Math.round((1 / n) * 1e5) / 1e5;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round((1 - w * (n - 1)) * 1e5) / 1e5 : w));
}

// ---------------------------------------------------------------------------------------------------------------
// Carga temporal de la práctica frente al plazo disponible (herramienta docente)
// ---------------------------------------------------------------------------------------------------------------
export interface BloqueLiberacion { desde: string; ejercicios: number }
export interface EntradaCarga {
  /** T_ref (s) de cada apartado, por ejercicio */
  tRefs: number[][];
  incremento?: number;
  abre?: Date | null;
  cierra?: Date | null;
  liberacion?: BloqueLiberacion[];
  ahora: Date;
  /** horas de trabajo razonables por día para esta práctica (además del resto de la carga del curso) */
  horasDiarias?: number;
}
export interface AvisoCarga { nivel: 'error' | 'aviso' | 'info'; texto: string }
export interface BloqueCarga { desde: Date; hasta: Date; ejercicios: [number, number]; esperaH: number; dias: number; horasPorDia: number }
export interface Carga {
  ejercicios: number;
  apartados: number;
  /** Σ T_ref: tiempo de trabajo estimado */
  referenciaH: number;
  /** Σ espera mínima: tiempo mínimo para obtener crédito completo en todo */
  esperaH: number;
  /** días naturales desde la apertura (o ahora) hasta el cierre */
  dias: number | null;
  horasPorDia: number | null;
  bloques: BloqueCarga[];
  avisos: AvisoCarga[];
}

const H = 3600, DIA_MS = 86400000;
const fmtH = (h: number) => (h < 10 ? h.toFixed(1) : String(Math.round(h))).replace('.', ',');
const inicioDia = (s: string) => new Date(`${s}T00:00:00-04:00`);     // fechas de liberación en hora de Santo Domingo

export function analizarCarga(e: EntradaCarga): Carga {
  const inc = e.incremento ?? PES_POR_DEFECTO.incremento;
  const horasDiarias = e.horasDiarias ?? 3;
  const n = e.tRefs.length;
  const espEj = e.tRefs.map((xs) => xs.reduce((s, t) => s + tiempoMinimo(t, inc), 0) / H);
  const referenciaH = e.tRefs.flat().reduce((s, t) => s + t, 0) / H;
  const esperaH = espEj.reduce((s, x) => s + x, 0);
  const avisos: AvisoCarga[] = [];
  const bloques: BloqueCarga[] = [];
  let dias: number | null = null, horasPorDia: number | null = null;
  if (n === 0) avisos.push({ nivel: 'aviso', texto: 'La práctica todavía no tiene ejercicios.' });
  if (!e.cierra) {
    avisos.push({ nivel: 'error', texto: 'Falta la fecha límite: no se puede publicar ni estimar la carga diaria.' });
  } else {
    const inicio = new Date(Math.max(e.ahora.getTime(), e.abre?.getTime() ?? 0));
    const ms = e.cierra.getTime() - inicio.getTime();
    if (ms <= 0) avisos.push({ nivel: 'error', texto: 'La fecha límite ya pasó o es anterior a la apertura.' });
    else {
      dias = ms / DIA_MS;
      horasPorDia = esperaH / Math.max(dias, 1 / 24);
      if (esperaH * H * 1000 > ms) avisos.push({ nivel: 'error', texto: `Imposible: la espera mínima total (${fmtH(esperaH)} h) supera el tiempo que queda hasta el cierre (${fmtH(ms / H / 1000)} h).` });
      else if (horasPorDia > 2 * horasDiarias) avisos.push({ nivel: 'error', texto: `Carga excesiva: harían falta ${fmtH(horasPorDia)} h diarias (más del doble de ${fmtH(horasDiarias)} h). Amplíe el plazo o reduzca ejercicios.` });
      else if (horasPorDia > horasDiarias) avisos.push({ nivel: 'aviso', texto: `Carga alta: ${fmtH(horasPorDia)} h diarias de media, por encima de ${fmtH(horasDiarias)} h.` });
    }
    // bloques de liberación
    const lib = [...(e.liberacion ?? [])].sort((a, b) => a.desde.localeCompare(b.desde));
    let previo = 0;
    lib.forEach((b, i) => {
      const desde = inicioDia(b.desde);
      const hasta = i + 1 < lib.length ? inicioDia(lib[i + 1].desde) : e.cierra!;
      const hastaEj = Math.min(b.ejercicios, n);
      if (b.ejercicios <= previo) avisos.push({ nivel: 'error', texto: `El bloque del ${b.desde} no libera ejercicios nuevos (el número es acumulado).` });
      if (desde >= e.cierra!) avisos.push({ nivel: 'error', texto: `El bloque del ${b.desde} se libera después de la fecha límite.` });
      const esp = espEj.slice(previo, hastaEj).reduce((s, x) => s + x, 0);
      const d = Math.max((hasta.getTime() - Math.max(desde.getTime(), e.ahora.getTime())) / DIA_MS, 0);
      const hpd = d > 0 ? esp / d : Infinity;
      bloques.push({ desde, hasta, ejercicios: [previo + 1, hastaEj], esperaH: esp, dias: d, horasPorDia: hpd });
      if (hastaEj > previo && d > 0 && esp * H * 1000 > d * DIA_MS) avisos.push({ nivel: 'error', texto: `Bloque del ${b.desde}: la espera mínima (${fmtH(esp)} h) no cabe antes del siguiente bloque.` });
      else if (hastaEj > previo && hpd > horasDiarias) avisos.push({ nivel: 'aviso', texto: `Bloque del ${b.desde} (ejercicios ${previo + 1}–${hastaEj}): ${fmtH(hpd)} h diarias.` });
      previo = Math.max(previo, b.ejercicios);
    });
    if (lib.length > 0 && previo < n) avisos.push({ nivel: 'error', texto: `Los ejercicios ${previo + 1}–${n} nunca se liberan: el último bloque libera ${previo}.` });
  }
  if (esperaH > 40) avisos.push({ nivel: 'info', texto: `Carga total alta: ${fmtH(esperaH)} h de espera mínima (${fmtH(referenciaH)} h de trabajo estimado).` });
  return { ejercicios: n, apartados: e.tRefs.flat().length, referenciaH, esperaH, dias, horasPorDia, bloques, avisos };
}

// ---------------------------------------------------------------------------------------------------------------
// Control presencial de comprensión (igual que pes_puntaje → control)
// ---------------------------------------------------------------------------------------------------------------
export interface PoliticaControl { modo: 'informativo' | 'ajuste'; peso: number; descripcion: string }

/**
 * Factor que se aplica a la puntuación validada según la política ANUNCIADA: 1 si es informativa o no hay control
 * realizado; si es de ajuste, 1 − w·(1 − C) con w ≤ 0.3 y C el resultado más favorable de los controles realizados.
 */
export function factorControl(p: PoliticaControl, resultados: number[]): number {
  if (p.modo !== 'ajuste' || resultados.length === 0) return 1;
  const w = acotar(p.peso, 0, 0.3);
  const c = acotar(Math.max(...resultados), 0, 1);
  return 1 - w * (1 - c);
}

// ---------------------------------------------------------------------------------------------------------------
// Calibración: tiempo de resolución esperado frente a la espera impuesta (informe del simulador docente)
// ---------------------------------------------------------------------------------------------------------------
export function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b), k = Math.floor(o.length / 2);
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
}

export interface TiempoApartado { etiqueta: string; t_ref_s: number; t_min_s: number; calibraciones: number[]; piloto_s: number | null }
export interface FilaTiempos extends TiempoApartado {
  n: number;
  mediana: number | null;
  /** tiempo de resolución independiente esperado: la mediana medida o, sin mediciones, T_ref */
  esperado: number;
  /** espera mínima para conservar la puntuación completa */
  impuesto: number;
  razon: number;
}
export interface InformeTiempos { filas: FilaTiempos[]; esperadoS: number; impuestoS: number; referenciaS: number; calibrados: number; avisos: AvisoCarga[] }

export function compararTiempos(aps: TiempoApartado[]): InformeTiempos {
  const filas: FilaTiempos[] = aps.map((a) => {
    const med = mediana(a.calibraciones);
    const esperado = med ?? a.t_ref_s;
    return { ...a, n: a.calibraciones.length, mediana: med, esperado, impuesto: a.t_min_s, razon: esperado > 0 ? a.t_min_s / esperado : Infinity };
  });
  const avisos: AvisoCarga[] = [];
  const s = (x: number) => (x >= 120 ? `${Math.round(x / 6) / 10} min` : `${Math.round(x)} s`).replace('.', ',');
  for (const f of filas) {
    if (f.mediana === null) continue;
    if (f.razon > 1.5) avisos.push({ nivel: 'aviso', texto: `${f.etiqueta}: la espera impuesta (${s(f.impuesto)}) supera en más del 50 % el tiempo medido (mediana ${s(f.mediana)}). Podría penalizar a quien resuelve bien y rápido: considere T_ref ≈ ${s(f.mediana)}.` });
    else if (f.mediana > f.impuesto) avisos.push({ nivel: 'info', texto: `${f.etiqueta}: el tiempo medido (${s(f.mediana)}) supera la espera mínima: la espera no limita a quien resuelve con cuidado.` });
    if (f.n < 3) avisos.push({ nivel: 'info', texto: `${f.etiqueta}: solo ${f.n} medición(es); la mediana es poco fiable.` });
  }
  const sin = filas.filter((f) => f.mediana === null).length;
  if (sin) avisos.push({ nivel: 'info', texto: `${sin} apartado(s) sin tiempos medidos: su T_ref es una estimación, no una calibración.` });
  return {
    filas, avisos, calibrados: filas.length - sin,
    esperadoS: filas.reduce((x, f) => x + f.esperado, 0), impuestoS: filas.reduce((x, f) => x + f.impuesto, 0), referenciaS: filas.reduce((x, f) => x + f.t_ref_s, 0),
  };
}
