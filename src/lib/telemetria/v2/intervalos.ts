/**
 * Telemetría V2 · álgebra de intervalos semiabiertos [inicio, fin) en milisegundos. Funciones puras y deterministas.
 * Un conjunto de intervalos se representa normalizado: ordenado, sin solapes ni contigüidades, sin intervalos vacíos.
 */

export interface Iv { inicio: number; fin: number }

export const medida = (xs: Iv[]): number => xs.reduce((s, x) => s + Math.max(0, x.fin - x.inicio), 0);

/** Ordena y fusiona (los contiguos también se fusionan). Descarta intervalos vacíos o con números no finitos. */
export function normalizar(xs: Iv[]): Iv[] {
  const v = xs.filter((x) => Number.isFinite(x.inicio) && Number.isFinite(x.fin) && x.fin > x.inicio)
    .map((x) => ({ inicio: x.inicio, fin: x.fin }))
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
  const out: Iv[] = [];
  for (const x of v) {
    const u = out[out.length - 1];
    if (u && x.inicio <= u.fin) u.fin = Math.max(u.fin, x.fin);
    else out.push(x);
  }
  return out;
}

export const union = (...cs: Iv[][]): Iv[] => normalizar(cs.flat());

export function interseccion(a: Iv[], b: Iv[]): Iv[] {
  const A = normalizar(a), B = normalizar(b), out: Iv[] = [];
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    const ini = Math.max(A[i].inicio, B[j].inicio), fin = Math.min(A[i].fin, B[j].fin);
    if (fin > ini) out.push({ inicio: ini, fin });
    if (A[i].fin < B[j].fin) i++; else j++;
  }
  return out;
}

export function diferencia(a: Iv[], b: Iv[]): Iv[] {
  const B = normalizar(b), out: Iv[] = [];
  for (const x of normalizar(a)) {
    let ini = x.inicio;
    for (const y of B) {
      if (y.fin <= ini) continue;
      if (y.inicio >= x.fin) break;
      if (y.inicio > ini) out.push({ inicio: ini, fin: y.inicio });
      ini = Math.max(ini, y.fin);
      if (ini >= x.fin) break;
    }
    if (ini < x.fin) out.push({ inicio: ini, fin: x.fin });
  }
  return out;
}

export const recortar = (xs: Iv[], ventana: Iv): Iv[] => interseccion(xs, [ventana]);

/** Partes de `xs` cubiertas por al menos dos intervalos de la lista ORIGINAL (sin normalizar): solapes. */
export function solapes(xs: Iv[]): Iv[] {
  const puntos: [number, number][] = [];
  for (const x of xs) if (x.fin > x.inicio) { puntos.push([x.inicio, 1], [x.fin, -1]); }
  puntos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Iv[] = [];
  let n = 0, desde = 0;
  for (const [t, d] of puntos) {
    const antes = n;
    n += d;
    if (antes < 2 && n >= 2) desde = t;
    if (antes >= 2 && n < 2 && t > desde) out.push({ inicio: desde, fin: t });
  }
  return normalizar(out);
}

/**
 * Partición por prioridad: recorre las capas en orden (la primera tiene prioridad) y asigna a cada instante de
 * `dominio` la primera categoría que lo cubre; lo que no cubre ninguna recibe `resto`. Resultado ordenado, sin
 * solapes y que cubre exactamente el dominio.
 */
export function particionar<C extends string>(dominio: Iv, capas: { cat: C; ivs: Iv[] }[], resto: C): (Iv & { cat: C })[] {
  let libre: Iv[] = dominio.fin > dominio.inicio ? [{ ...dominio }] : [];
  const piezas: (Iv & { cat: C })[] = [];
  for (const capa of capas) {
    const toma = interseccion(libre, capa.ivs);
    for (const x of toma) piezas.push({ ...x, cat: capa.cat });
    libre = diferencia(libre, toma);
  }
  for (const x of libre) piezas.push({ ...x, cat: resto });
  piezas.sort((a, b) => a.inicio - b.inicio);
  // fusiona piezas contiguas de la misma categoría
  const out: (Iv & { cat: C })[] = [];
  for (const p of piezas) {
    const u = out[out.length - 1];
    if (u && u.cat === p.cat && u.fin === p.inicio) u.fin = p.fin;
    else out.push({ ...p });
  }
  return out;
}

/** Comprueba que una lista sea una partición del dominio: ordenada, sin huecos ni solapes, duraciones positivas. */
export function esParticion(xs: Iv[], dominio: Iv, tol = 0): string[] {
  const p: string[] = [];
  if (!xs.length) return dominio.fin > dominio.inicio ? ['partición vacía de un dominio no vacío'] : [];
  if (Math.abs(xs[0].inicio - dominio.inicio) > tol) p.push('no empieza en el inicio del dominio');
  if (Math.abs(xs[xs.length - 1].fin - dominio.fin) > tol) p.push('no termina en el fin del dominio');
  xs.forEach((x, i) => {
    if (!(x.fin > x.inicio)) p.push(`intervalo ${i} con duración no positiva`);
    if (i > 0 && Math.abs(x.inicio - xs[i - 1].fin) > tol) p.push(`${x.inicio < xs[i - 1].fin ? 'solape' : 'hueco'} antes del intervalo ${i}`);
  });
  return p;
}
