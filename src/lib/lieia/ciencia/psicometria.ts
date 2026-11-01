/**
 * LIEIA · psicometría clásica (TCT) a partir de respuestas REALES (procedencia «empirica»). Capa A + C.
 *
 * Codificación por estudiante y pregunta:  1 correcta · 0 incorrecta · «omitida» (sin respuesta guardada) ·
 * «sin_calificar» (respondió, pero aún no hay calificación, p. ej. una abierta pendiente: NO es omisión).
 * Reglas de abstención (MINIMOS en modelo.ts): con n insuficiente se devuelve el motivo, nunca un número.
 * Las correlaciones entre preguntas son EXPLORATORIAS y se corrigen por comparaciones múltiples (Benjamini-Hochberg).
 * La dificultad clásica (proporción de aciertos) NO es el parámetro b de la TRI; la TRI 2PL existente (diseno.ts) se usa
 * solo cuando el examen tiene muestra suficiente, y se rotula aparte.
 */
import { mulberry32 } from '@/lib/fisica/variantes';
import { benjaminiHochberg, chiCuadradoCola, wilson } from '../estadistica';
import { MINIMOS, type DatosReales } from './modelo';

export type Celda = 1 | 0 | 'omitida' | 'sin_calificar';

export interface Matriz { items: string[]; estudiantes: string[]; x: Celda[][]; tiempos: (number | null)[][]; fichas: (string | null)[][]; cambios: number[][]; posiciones: number[][] }

export function matriz(d: DatosReales): Matriz {
  const items = [...d.items].sort((a, b) => a.posicion - b.posicion).map((i) => i.exercise_id);
  const x: Celda[][] = [], tiempos: (number | null)[][] = [], fichas: (string | null)[][] = [], cambios: number[][] = [], posiciones: number[][] = [];
  for (const e of d.estudiantes) {
    const orden = e.orden?.length ? e.orden : items;
    x.push(items.map((id) => {
      const r = e.respuestas.find((y) => y.exercise_id === id);
      if (!r || r.ficha === null) return 'omitida';
      return r.correcta === true ? 1 : r.correcta === false ? 0 : 'sin_calificar';
    }));
    tiempos.push(items.map((id) => {
      const r = e.respuestas.find((y) => y.exercise_id === id);
      return r?.primera && r?.ultima ? (new Date(r.ultima).getTime() - new Date(r.primera).getTime()) / 1000 : null;
    }));
    fichas.push(items.map((id) => e.respuestas.find((y) => y.exercise_id === id)?.ficha ?? null));
    cambios.push(items.map((id) => e.respuestas.find((y) => y.exercise_id === id)?.cambios ?? 0));
    posiciones.push(items.map((id) => orden.indexOf(id) + 1 || items.indexOf(id) + 1));
  }
  return { items, estudiantes: d.estudiantes.map((e) => e.seudonimo), x, tiempos, fichas, cambios, posiciones };
}

/** Un valor estadístico o el motivo de abstención. */
export type Resultado<T> = { ok: true; valor: T; n: number; metodo: string } | { ok: false; motivo: string; n: number };
const no = <T>(n: number, motivo: string): Resultado<T> => ({ ok: false, motivo, n });

const media = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
const varianza = (xs: number[]) => { const m = media(xs); return xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1); };
function pearson(a: number[], b: number[]): number | null {
  if (a.length < 3) return null;
  const ma = media(a), mb = media(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export interface ItemEmpirico {
  id: string; expuestos: number; calificadas: number; correctas: number; omisiones: number; sinCalificar: number;
  /** proporción de aciertos entre las calificadas (dificultad CLÁSICA) con IC de Wilson al 95 %. */
  p: Resultado<{ p: number; ic: [number, number] }>;
  omision: { tasa: number; ic: [number, number] } | null;
  /** correlación punto-biserial ítem-resto (omitida = 0), solo con muestra suficiente y varianza. */
  discriminacion: Resultado<number>;
  tiempo: Resultado<{ mediana: number; dispersion: number }>;
  cambiosMedios: number | null;
  /** la misma respuesta incorrecta (huella idéntica) repetida: posible error sistemático. */
  erroresFrecuentes: { veces: number; deIncorrectas: number }[];
}

export function analizarItems(m: Matriz): ItemEmpirico[] {
  const N = m.estudiantes.length;
  // puntuación total con omisión = 0 y sin calificar excluido del total
  const total = m.x.map((fila) => fila.reduce<number>((s, c) => s + (c === 1 ? 1 : 0), 0));
  return m.items.map((id, j) => {
    const col = m.x.map((f) => f[j]);
    const calificadas = col.filter((c) => c === 0 || c === 1).length, correctas = col.filter((c) => c === 1).length;
    const omisiones = col.filter((c) => c === 'omitida').length, sinCalificar = col.filter((c) => c === 'sin_calificar').length;
    const p: ItemEmpirico['p'] = calificadas === 0 ? no(0, 'n = 0: no hay respuestas calificadas para estimar la dificultad')
      : calificadas < MINIMOS.item ? no(calificadas, `solo ${calificadas} respuestas calificadas (mínimo ${MINIMOS.item})`)
      : { ok: true, valor: { p: correctas / calificadas, ic: wilson(correctas, calificadas) }, n: calificadas, metodo: 'proporción de aciertos (TCT) con IC de Wilson 95 %' };
    let discriminacion: Resultado<number>;
    const filas = m.x.map((f, s) => ({ c: f[j], resto: total[s] - (f[j] === 1 ? 1 : 0) })).filter((r) => r.c !== 'sin_calificar');
    if (filas.length < MINIMOS.discriminacion) discriminacion = no(filas.length, `n = ${filas.length}; la discriminación necesita al menos ${MINIMOS.discriminacion} estudiantes`);
    else {
      const r = pearson(filas.map((f) => (f.c === 1 ? 1 : 0)), filas.map((f) => f.resto));
      discriminacion = r === null ? no(filas.length, 'sin variación (todos aciertan o todos fallan, o el resto es constante)')
        : { ok: true, valor: r, n: filas.length, metodo: 'correlación punto-biserial ítem-resto corregida (omisión = 0)' };
    }
    const ts = m.tiempos.map((f) => f[j]).filter((t): t is number => t !== null && t > 0);
    const tiempo: ItemEmpirico['tiempo'] = ts.length < MINIMOS.item ? no(ts.length, `solo ${ts.length} intervalos de edición registrados`)
      : { ok: true, valor: { mediana: mediana(ts), dispersion: mediana(ts.map((t) => Math.abs(t - mediana(ts)))) }, n: ts.length,
          metodo: 'intervalo entre la primera y la última edición guardada (no es el tiempo total de resolución); mediana y MAD' };
    const cs = m.cambios.map((f) => f[j]);
    const incorrectas = m.fichas.map((f, s) => (m.x[s][j] === 0 ? f[j] : null)).filter((f): f is string => !!f);
    const cuenta = new Map<string, number>();
    for (const f of incorrectas) cuenta.set(f, (cuenta.get(f) ?? 0) + 1);
    const erroresFrecuentes = [...cuenta.values()].filter((v) => v >= 3 && v / incorrectas.length >= 0.3).sort((a, b) => b - a).map((v) => ({ veces: v, deIncorrectas: incorrectas.length }));
    return {
      id, expuestos: N, calificadas, correctas, omisiones, sinCalificar, p,
      omision: N ? { tasa: omisiones / N, ic: wilson(omisiones, N) } : null,
      discriminacion, tiempo, cambiosMedios: N ? media(cs) : null, erroresFrecuentes,
    };
  });
}

export interface ExamenEmpirico {
  n: number; items: number;
  puntuaciones: Resultado<{ media: number; desviacion: number; q1: number; mediana: number; q3: number }>;
  /** KR-20 (respuestas dicotómicas, omisión = 0) con IC bootstrap 95 % reproducible. */
  confiabilidad: Resultado<{ kr20: number; ic: [number, number] }>;
  omisionPorPosicion: Resultado<number>;
  /** pares de preguntas con asociación EXPLORATORIA (phi), corregidos por comparaciones múltiples. */
  pares: Resultado<{ a: string; b: string; phi: number; n: number; p: number; q: number }[]>;
  contraste: Resultado<{ estudiantes: number; dificilesCorrectas: string[]; facilesOmitidas: string[] }>;
}

function kr20(filas: number[][]): number | null {
  const k = filas[0]?.length ?? 0;
  if (k < 3 || filas.length < 3) return null;
  const tot = filas.map((f) => f.reduce((s, v) => s + v, 0));
  const vt = varianza(tot);
  if (!(vt > 0)) return null;
  let pq = 0;
  for (let j = 0; j < k; j++) { const p = media(filas.map((f) => f[j])); pq += p * (1 - p); }
  return (k / (k - 1)) * (1 - pq / vt);
}

export function analizarExamen(m: Matriz, its: ItemEmpirico[], semilla = 20261101): ExamenEmpirico {
  const N = m.estudiantes.length, K = m.items.length;
  const filas01: number[][] = m.x.map((f) => f.map((c) => (c === 1 ? 1 : 0)));
  const tot = filas01.map((f) => f.reduce((s, v) => s + v, 0));
  const ord = [...tot].sort((a, b) => a - b), q = (p: number) => ord[Math.min(ord.length - 1, Math.floor(p * ord.length))];
  const puntuaciones: ExamenEmpirico['puntuaciones'] = N < 2 ? no(N, 'menos de 2 estudiantes')
    : { ok: true, valor: { media: media(tot), desviacion: Math.sqrt(varianza(tot)), q1: q(0.25), mediana: mediana(tot), q3: q(0.75) }, n: N, metodo: 'aciertos por estudiante (omisión = 0)' };

  let confiabilidad: ExamenEmpirico['confiabilidad'];
  const hayAbiertas = m.x.some((f) => f.includes('sin_calificar'));
  if (N < MINIMOS.confiabilidad) confiabilidad = no(N, `n = ${N}; la confiabilidad necesita al menos ${MINIMOS.confiabilidad} estudiantes`);
  else if (K < 3) confiabilidad = no(N, 'menos de 3 preguntas');
  else {
    const k = kr20(filas01);
    if (k === null) confiabilidad = no(N, 'sin varianza en las puntuaciones');
    else {
      const rnd = mulberry32(semilla), reps: number[] = [];
      for (let b = 0; b < 400; b++) { const r = kr20(Array.from({ length: N }, () => filas01[Math.floor(rnd() * N)])); if (r !== null) reps.push(r); }
      reps.sort((a, b) => a - b);
      confiabilidad = { ok: true, valor: { kr20: k, ic: [reps[Math.floor(0.025 * reps.length)], reps[Math.floor(0.975 * reps.length)]] }, n: N,
        metodo: `KR-20 (omisión = 0${hayAbiertas ? '; preguntas sin calificar contadas como 0: subestima' : ''}); IC bootstrap 95 % (400 réplicas, semilla ${semilla})` };
    }
  }

  // omisión frente a posición (Spearman simple sobre las preguntas)
  let omisionPorPosicion: Resultado<number>;
  if (K < 5 || N < MINIMOS.item) omisionPorPosicion = no(N, 'se necesitan al menos 5 preguntas y 10 estudiantes');
  else {
    const tasas = its.map((i) => i.omisiones / N);
    if (tasas.every((t) => t === tasas[0])) omisionPorPosicion = no(N, 'la tasa de omisión es igual en todas las preguntas');
    else {
      const rango = (xs: number[]) => { const o = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = Array(xs.length); o.forEach(([, i], k) => (r[i] = k)); return r as number[]; };
      const pos = m.items.map((_, j) => media(m.posiciones.map((f) => f[j])));
      omisionPorPosicion = { ok: true, valor: pearson(rango(pos), rango(tasas)) ?? 0, n: K, metodo: 'correlación de rangos entre la posición media y la tasa de omisión (descriptiva, por pregunta)' };
    }
  }

  // asociación entre pares (phi) sobre estudiantes con ambas preguntas calificadas
  let pares: ExamenEmpirico['pares'];
  if (N < MINIMOS.correlacion) pares = no(N, `n = ${N}; las correlaciones entre preguntas necesitan al menos ${MINIMOS.correlacion} estudiantes`);
  else {
    const lista: { a: string; b: string; phi: number; n: number; p: number }[] = [];
    for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) {
      const xa: number[] = [], xb: number[] = [];
      m.x.forEach((f) => { const ca = f[a], cb = f[b]; if (ca !== 'sin_calificar' && cb !== 'sin_calificar') { xa.push(ca === 1 ? 1 : 0); xb.push(cb === 1 ? 1 : 0); } });
      const r = pearson(xa, xb);
      if (r === null || xa.length < MINIMOS.correlacion) continue;
      lista.push({ a: m.items[a], b: m.items[b], phi: r, n: xa.length, p: chiCuadradoCola(xa.length * r * r, 1) });
    }
    const qs = benjaminiHochberg(lista.map((l) => l.p));
    pares = { ok: true, valor: lista.map((l, i) => ({ ...l, q: qs[i] })).sort((x, y) => x.q - y.q), n: N,
      metodo: `phi por pares; p por χ² (1 gl); q de Benjamini-Hochberg sobre ${lista.length} comparaciones (EXPLORATORIO)` };
  }

  // contraste descriptivo: acierta preguntas difíciles y omite preguntas fáciles (sin causa atribuida)
  let contraste: ExamenEmpirico['contraste'];
  const pOk = its.map((i) => (i.p.ok ? i.p.valor.p : null));
  const dificiles = m.items.filter((_, j) => pOk[j] !== null && pOk[j]! <= 0.4), faciles = m.items.filter((_, j) => pOk[j] !== null && pOk[j]! >= 0.8);
  if (N < MINIMOS.contraste) contraste = no(N, `n = ${N}; hace falta al menos ${MINIMOS.contraste} estudiantes para saber qué preguntas son difíciles o fáciles`);
  else if (!dificiles.length || !faciles.length) contraste = no(N, 'no hay a la vez preguntas observadas como difíciles (≤ 40 %) y fáciles (≥ 80 %)');
  else {
    const ji = (id: string) => m.items.indexOf(id);
    const n = m.x.filter((f) => dificiles.some((d) => f[ji(d)] === 1) && faciles.some((e) => f[ji(e)] === 'omitida')).length;
    contraste = { ok: true, valor: { estudiantes: n, dificilesCorrectas: dificiles, facilesOmitidas: faciles }, n: N,
      metodo: 'conteo descriptivo; dificultad observada en este mismo examen (no independiente de los datos)' };
  }
  return { n: N, items: K, puntuaciones, confiabilidad, omisionPorPosicion, pares, contraste };
}
