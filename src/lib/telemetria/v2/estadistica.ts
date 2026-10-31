/**
 * Telemetría V2 · análisis estadístico DESCRIPTIVO entre intentos (fase 11). Independiente de LIEIA.
 *
 * Parte de la misma reconstrucción que ve el profesor en cada intento (reconstruirPaquete + auditarRespuestas): no
 * recalcula tiempos por su cuenta. Reglas:
 *  - solo entran valores IDENTIFICABLES (observado, reconstruido o estimado); los demás se cuentan como faltantes,
 *    nunca como cero, y cada resultado informa su cobertura (n válidos / n posibles);
 *  - mediana y cuartiles por interpolación lineal (tipo 7); IC 95 % de la mediana por remuestreo (bootstrap) con semilla
 *    fija, así que el resultado es reproducible; con menos de 5 observaciones se marca «poco estable» y no hay IC;
 *  - descriptivo: no compara personas ni infiere conductas. No mezcla formatos distintos en una misma comparación.
 */
import { auditarRespuestas, reconstruirPaquete, type AuditoriaPregunta, type FuenteElegida, type PaqueteIntento } from './fuente';
import type { Metrica, Reconstruccion, ResultadoPregunta } from './modelo';

export const VERSION_ANALISIS = 'telemetria-v2/estadistica@1.0.0';
export const N_ESTABLE = 5;

export interface Descriptivos {
  n: number; faltantes: number; media: number | null; de: number | null; mediana: number | null; p10: number | null; p25: number | null; p75: number | null;
  p90: number | null; min: number | null; max: number | null; ic95_mediana: [number, number] | null; estable: boolean;
}

function cuantil(ord: number[], p: number): number | null {
  if (!ord.length) return null;
  const h = (ord.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
  return ord[lo] + (h - lo) * (ord[hi] - ord[lo]);
}

/** PRNG determinista (mulberry32) para el bootstrap. */
function prng(semilla: number) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function descriptivos(valores: (number | null | undefined)[], B = 1000): Descriptivos {
  const xs = valores.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  const faltantes = valores.length - xs.length;
  const ord = [...xs].sort((a, b) => a - b);
  const n = ord.length;
  if (!n) return { n: 0, faltantes, media: null, de: null, mediana: null, p10: null, p25: null, p75: null, p90: null, min: null, max: null, ic95_mediana: null, estable: false };
  const media = ord.reduce((s, x) => s + x, 0) / n;
  const de = n > 1 ? Math.sqrt(ord.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1)) : null;
  let ic: [number, number] | null = null;
  if (n >= N_ESTABLE) {
    const r = prng(0x5eed + n);
    const meds: number[] = [];
    for (let b = 0; b < B; b++) {
      const m = Array.from({ length: n }, () => ord[Math.floor(r() * n)]).sort((a, c) => a - c);
      meds.push(cuantil(m, 0.5)!);
    }
    meds.sort((a, c) => a - c);
    ic = [cuantil(meds, 0.025)!, cuantil(meds, 0.975)!];
  }
  return { n, faltantes, media, de, mediana: cuantil(ord, 0.5), p10: cuantil(ord, 0.1), p25: cuantil(ord, 0.25), p75: cuantil(ord, 0.75), p90: cuantil(ord, 0.9),
    min: ord[0], max: ord[n - 1], ic95_mediana: ic, estable: n >= N_ESTABLE };
}

/** Histograma con k clases iguales entre el mínimo y el máximo (k = ⌈√n⌉ acotado a 5–15). */
export function histograma(valores: number[], k?: number): { desde: number; hasta: number; n: number }[] {
  const xs = valores.filter(Number.isFinite);
  if (!xs.length) return [];
  const min = Math.min(...xs), max = Math.max(...xs);
  const nk = k ?? Math.min(15, Math.max(5, Math.ceil(Math.sqrt(xs.length))));
  if (max === min) return [{ desde: min, hasta: max, n: xs.length }];
  const w = (max - min) / nk;
  const c = Array.from({ length: nk }, (_, i) => ({ desde: min + i * w, hasta: min + (i + 1) * w, n: 0 }));
  for (const x of xs) c[Math.min(nk - 1, Math.floor((x - min) / w))].n++;
  return c;
}

const IDENTIFICABLE = new Set<Metrica['estado']>(['observado', 'reconstruido', 'estimado']);
export const valorSi = (m: Metrica) => (IDENTIFICABLE.has(m.estado) ? m.valor : null);

export type MetricaAnalizada = 'T_focus' | 'T_interaction' | 'T_edit' | 'T_until_first_response' | 'T_exposure' | 'visitas';
export const METRICAS: Record<MetricaAnalizada, string> = {
  T_focus: 'Foco (pregunta activa)', T_interaction: 'Interacción', T_edit: 'Edición', T_until_first_response: 'Hasta la primera respuesta', T_exposure: 'En pantalla', visitas: 'Visitas',
};
const leer = (q: ResultadoPregunta, m: MetricaAnalizada) => valorSi(q[m]);

export interface IntentoAnalizado {
  estudiante: { user_id: string; full_name: string; student_code: string | null };
  numero: number;
  attempt_id: string;
  fuente: FuenteElegida;
  rec: Reconstruccion | null;
  auditoria: AuditoriaPregunta[];
  paquete: PaqueteIntento;
}

/** Reconstruye todos los intentos con el mismo motor que la vista individual. */
export function analizarIntentos(xs: { estudiante: IntentoAnalizado['estudiante']; numero: number; paquete: PaqueteIntento }[]): IntentoAnalizado[] {
  return xs.map((x) => {
    const r = reconstruirPaquete(x.paquete);
    return { estudiante: x.estudiante, numero: x.numero, attempt_id: x.paquete.intento.id, fuente: r.fuente, rec: r.reconstruccion, auditoria: auditarRespuestas(x.paquete, r.reconstruccion), paquete: x.paquete };
  });
}

export interface FilaPregunta {
  exercise_id: string; titulo: string; dificultad: string; formato: string; conceptos: string[];
  intentos: number;                         // intentos que incluyen la pregunta
  metricas: Record<MetricaAnalizada, Descriptivos>;
  acierto: { n: number; correctas: number; tasa: number | null };
  cambio_respuesta: { n: number; cambiaron: number };   // primera revisión guardada ≠ final
  asistida: { n: number; inicial_correcta: number; final_correcta: number; transferencia_correcta: number; transferencias: number } | null;
}

const correcta = (s: string | null | undefined) => s === 'correct';

export function porPregunta(intentos: IntentoAnalizado[]): FilaPregunta[] {
  const orden: PaqueteIntento['items'] = [];
  for (const i of intentos) for (const it of i.paquete.items) if (!orden.some((o) => o.exercise_id === it.exercise_id)) orden.push(it);
  return orden.map((it) => {
    const con = intentos.filter((i) => i.paquete.items.some((x) => x.exercise_id === it.exercise_id));
    const res = con.map((i) => i.rec?.preguntas.find((q) => q.pregunta === it.exercise_id) ?? null);
    const metricas = Object.fromEntries((Object.keys(METRICAS) as MetricaAnalizada[]).map((m) => [m, descriptivos(res.map((q) => (q ? leer(q, m) : null)))])) as Record<MetricaAnalizada, Descriptivos>;
    const resp = con.map((i) => i.paquete.respuestas.find((r) => r.exercise_id === it.exercise_id)).filter((r): r is NonNullable<typeof r> => !!r && r.status !== 'draft');
    const aud = con.map((i) => i.auditoria.find((a) => a.exercise_id === it.exercise_id)).filter((a): a is AuditoriaPregunta => !!a);
    const conRev = aud.filter((a) => a.primera && a.final);
    const asis = aud.map((a) => a.asistida).filter((x): x is NonNullable<AuditoriaPregunta['asistida']> => !!x);
    return {
      exercise_id: it.exercise_id, titulo: it.titulo, dificultad: it.dificultad, formato: it.formato, conceptos: it.conceptos ?? [], intentos: con.length, metricas,
      acierto: { n: resp.length, correctas: resp.filter((r) => correcta(r.status)).length, tasa: resp.length ? resp.filter((r) => correcta(r.status)).length / resp.length : null },
      cambio_respuesta: { n: conRev.length, cambiaron: conRev.filter((a) => a.primera!.answer_hash !== a.final!.answer_hash).length },
      asistida: asis.length ? {
        n: asis.length, inicial_correcta: asis.filter((x) => correcta(x.inicial?.status)).length, final_correcta: asis.filter((x) => correcta((x.final ?? x.inicial)?.status)).length,
        transferencias: asis.filter((x) => x.transferencia).length, transferencia_correcta: asis.filter((x) => correcta(x.transferencia?.status)).length,
      } : null,
    };
  });
}

export type Agrupacion = 'dificultad' | 'formato' | 'concepto';

/** Agrupa las observaciones de las preguntas por dificultad, formato o concepto (una pregunta cuenta en cada concepto suyo). */
export function porGrupo(intentos: IntentoAnalizado[], agrupar: Agrupacion, metrica: MetricaAnalizada): { grupo: string; preguntas: number; formatos: string[]; d: Descriptivos }[] {
  const grupos = new Map<string, { preguntas: Set<string>; formatos: Set<string>; valores: (number | null)[] }>();
  for (const i of intentos) {
    for (const it of i.paquete.items) {
      const claves = agrupar === 'dificultad' ? [it.dificultad] : agrupar === 'formato' ? [it.formato] : (it.conceptos?.length ? it.conceptos : ['(sin concepto)']);
      const q = i.rec?.preguntas.find((x) => x.pregunta === it.exercise_id);
      for (const k of claves) {
        const g = grupos.get(k) ?? { preguntas: new Set(), formatos: new Set(), valores: [] };
        g.preguntas.add(it.exercise_id); g.formatos.add(it.formato); g.valores.push(q ? leer(q, metrica) : null);
        grupos.set(k, g);
      }
    }
  }
  return [...grupos.entries()].map(([grupo, g]) => ({ grupo, preguntas: g.preguntas.size, formatos: [...g.formatos].sort(), d: descriptivos(g.valores) }))
    .sort((a, b) => (a.grupo < b.grupo ? -1 : 1));
}

export interface FilaIntento {
  attempt_id: string; estudiante: IntentoAnalizado['estudiante']; numero: number; fuente: FuenteElegida;
  T_wall: number | null; activo: number | null; inactiva: number | null; oculta: number | null; pausa: number | null; sin_observar: number | null;
  foco_total: number | null; cobertura_media: number | null; respondidas: number; correctas: number; invariantes: number;
}

export function porIntento(intentos: IntentoAnalizado[]): FilaIntento[] {
  return intentos.map((i) => {
    const r = i.rec;
    const focos = r?.preguntas.map((q) => valorSi(q.T_focus)) ?? [];
    const cob = (r?.preguntas.map((q) => q.calidad.cobertura) ?? []).filter((x): x is number => x !== null);
    const resp = i.paquete.respuestas.filter((x) => x.status !== 'draft');
    return {
      attempt_id: i.attempt_id, estudiante: i.estudiante, numero: i.numero, fuente: i.fuente,
      T_wall: r?.T_wall ?? null, activo: r ? r.totales.observable_activo : null, inactiva: r ? r.totales.inactiva : null, oculta: r ? r.totales.oculta : null,
      pausa: r ? r.totales.pausa_declarada : null, sin_observar: r ? r.totales.sin_observacion + r.totales.desconocido + r.totales.conflicto : null,
      // el foco total solo existe si TODAS las preguntas son identificables (si no, sería una suma parcial engañosa)
      foco_total: focos.length && focos.every((x) => x !== null) ? focos.reduce((s, x) => s + (x as number), 0) : null,
      cobertura_media: cob.length ? cob.reduce((s, x) => s + x, 0) / cob.length : null,
      respondidas: resp.length, correctas: resp.filter((x) => correcta(x.status)).length, invariantes: r?.invariantes.length ?? 0,
    };
  });
}

export interface ResumenActividad {
  version: string; intentos: number; estudiantes: number; fuentes: Record<FuenteElegida, number>;
  duracion: Descriptivos; proporcion_activa: Descriptivos; proporcion_sin_observar: Descriptivos; con_pausas: number; con_invariantes_fallidos: number;
  formatos: string[];
}

export function resumen(intentos: IntentoAnalizado[]): ResumenActividad {
  const filas = porIntento(intentos);
  const fuentes = { diario_examen: 0, v2: 0, v1: 0, ninguna: 0 } as Record<FuenteElegida, number>;
  for (const i of intentos) fuentes[i.fuente]++;
  const prop = (f: (x: FilaIntento) => number | null) => filas.map((x) => (x.T_wall && f(x) !== null ? (f(x) as number) / x.T_wall : null));
  return {
    version: VERSION_ANALISIS, intentos: intentos.length, estudiantes: new Set(intentos.map((i) => i.estudiante.user_id)).size, fuentes,
    duracion: descriptivos(filas.map((x) => x.T_wall)), proporcion_activa: descriptivos(prop((x) => x.activo)), proporcion_sin_observar: descriptivos(prop((x) => x.sin_observar)),
    con_pausas: filas.filter((x) => (x.pausa ?? 0) > 0).length, con_invariantes_fallidos: filas.filter((x) => x.invariantes > 0).length,
    formatos: [...new Set(intentos.flatMap((i) => i.paquete.items.map((it) => it.formato)))].sort(),
  };
}
