/**
 * Construcción y validación del banco del Maratón adaptativo. Cada variante debe superar, sin excepciones:
 *  1. datos finitos y respuestas finitas no nulas;
 *  2. verificación INDEPENDIENTE: el verificador de la plantilla (simulación/raíces/planteamiento alternativo) coincide
 *     con la respuesta analítica dentro de su tolerancia;
 *  3. consistencia dimensional: la unidad de cada parte se interpreta con el motor del aula y tiene las dimensiones de
 *     la magnitud declarada;
 *  4. corrección automática: la clave escrita se califica como correcta; un valor desplazado 3×tolerancia, como
 *     incorrecto; una respuesta sin unidad (si la pide) o vacía, como intento NO válido;
 *  5. ausencia de ambigüedad: cada error típico queda fuera de la tolerancia y se califica como incorrecto;
 *  6. los números del enunciado son los de los datos (nada que el estudiante no vea) y no hay variantes repetidas.
 */
import { createHash } from 'node:crypto';
import { evaluarParte, evaluarRespuesta, type ClaveMaraton } from '../../supabase/functions/maraton/evaluar';
import { parseUnit } from '../../supabase/functions/_shared/calificacion/unidades';
import type { NumericKey } from '../../supabase/functions/_shared/calificacion/tipos';
import { DIMENSIONES, hash32, problemasLatex, Rng, sig, type Banco, type Generado, type Plantilla } from './marco';

export interface VarianteConstruida {
  id: string;
  plantilla: string;
  n: number;
  semilla: number;
  enunciado: string;
  partes: { etiqueta: string; unidad: string }[];
  datos: Record<string, number>;
  clave: ClaveMaraton;
  solucion: string;
  verificacion: { independiente: number[]; analitica: number[]; desviacion_max: number };
  huella: string;
}

export const TOL_DEFECTO = (nivel: number) => (nivel >= 5 ? 0.03 : 0.02);

export function claveParte(p: Generado['partes'][number], nivel: number): NumericKey {
  const k: NumericKey = { format: 'numeric', value: p.unidad ? `${sig(p.valor, 4)} ${p.unidad}` : sig(p.valor, 4), relTol: p.relTol ?? TOL_DEFECTO(nivel) };
  if (p.magnitud === 'entero') {
    k.value = String(Math.round(p.valor));
    k.relTol = 0;
    k.absTol = 0.4;
  }
  if (p.absTol !== undefined) k.absTol = p.absTol;
  if (!p.unidad) k.unitRequired = false;
  const errs = (p.errores ?? []).filter((e) => Number.isFinite(e.valor) && e.valor !== 0);
  if (errs.length) k.commonErrors = errs.map((e) => ({ value: p.unidad ? `${sig(e.valor, 4)} ${p.unidad}` : sig(e.valor, 4), message: e.mensaje }));
  return k;
}

/** Problemas de una variante (lista vacía = válida) */
export function problemasVariante(pl: Plantilla, g: Generado): string[] {
  const out: string[] = [];
  const tolRel = (p: Generado['partes'][number]) => p.relTol ?? TOL_DEFECTO(pl.nivel);
  for (const [k, v] of Object.entries(g.datos)) if (!Number.isFinite(v)) out.push(`dato ${k} no finito`);
  if (!g.partes.length || g.partes.length > 6) out.push('número de partes fuera de 1..6');
  g.partes.forEach((p, i) => {
    if (!Number.isFinite(p.valor)) out.push(`parte ${i + 1}: valor no finito`);
    else if (Math.abs(p.valor) < 1e-9) out.push(`parte ${i + 1}: respuesta nula (ambigua con tolerancia relativa)`);
    if (p.magnitud === 'entero' && Math.abs(p.valor - Math.round(p.valor)) > 1e-9) out.push(`parte ${i + 1}: entero no entero`);
  });
  if (out.length) return out;
  // 2) verificación independiente
  let ind: number[];
  try {
    ind = pl.verificar(g.datos);
  } catch (e) {
    return [`verificador: ${(e as Error).message}`];
  }
  if (ind.length !== g.partes.length) return ['el verificador devuelve otro número de partes'];
  const tolV = pl.tolVerificacion ?? 0.005;
  g.partes.forEach((p, i) => {
    const d = Math.abs(ind[i] - p.valor) / Math.max(Math.abs(p.valor), 1e-12);
    if (!(d <= tolV)) out.push(`parte ${i + 1}: verificación independiente ${ind[i]} ≠ ${p.valor} (desv. ${(d * 100).toFixed(3)} %)`);
  });
  // 3) dimensiones
  g.partes.forEach((p, i) => {
    const esperado = DIMENSIONES[p.magnitud];
    try {
      const u = parseUnit(p.unidad);
      const dims = u.empty ? [0, 0, 0] : [u.dims[1], u.dims[0], u.dims[2]];
      if (p.magnitud === 'porcentaje' && p.unidad !== '%') out.push(`parte ${i + 1}: un porcentaje se escribe con %`);
      if (esperado && dims.some((x, j) => Math.abs(x - esperado[j]) > 1e-9)) out.push(`parte ${i + 1}: la unidad «${p.unidad}» no corresponde a ${p.magnitud}`);
    } catch {
      out.push(`parte ${i + 1}: unidad ilegible «${p.unidad}»`);
    }
  });
  if (out.length) return out;
  // 4) y 5) corrección automática y ambigüedad
  const clave: ClaveMaraton = { partes: g.partes.map((p) => claveParte(p, pl.nivel)) };
  const correcta = evaluarRespuesta(clave, clave.partes.map((k) => k.value));
  if (!correcta.valida || !correcta.correcta) out.push(`la clave no se califica como correcta: ${JSON.stringify(correcta)}`);
  g.partes.forEach((p, i) => {
    const k = clave.partes[i];
    const fuera = p.magnitud === 'entero' ? String(Math.round(p.valor) + 1) : `${sig(p.valor * (1 + 3 * tolRel(p)), 4)}${p.unidad ? ' ' + p.unidad : ''}`;
    const r = evaluarParte(k, fuera);
    if (!r.valida || r.correcta) out.push(`parte ${i + 1}: un valor fuera de tolerancia (${fuera}) no se califica como incorrecto`);
    if (evaluarParte(k, '').valida) out.push(`parte ${i + 1}: una respuesta vacía cuenta como intento`);
    if (p.unidad && !['%', '°'].includes(p.unidad) && evaluarParte(k, sig(p.valor, 4)).valida) out.push(`parte ${i + 1}: sin unidad cuenta como intento`);
    if (evaluarParte(k, 'no sé').valida) out.push(`parte ${i + 1}: texto arbitrario cuenta como intento`);
    for (const e of (p.errores ?? []).filter((x) => Number.isFinite(x.valor) && x.valor !== 0)) {
      const d = Math.abs(e.valor - p.valor) / Math.abs(p.valor);
      if (d <= 2 * tolRel(p) || (p.magnitud === 'entero' && Math.round(e.valor) === Math.round(p.valor))) {
        out.push(`AMBIGUA: parte ${i + 1}: el error típico «${e.mensaje}» coincide con la respuesta`);
        continue;
      }
      const re = evaluarParte(k, p.unidad ? `${sig(e.valor, 4)} ${p.unidad}` : sig(e.valor, 4));
      if (re.correcta) out.push(`parte ${i + 1}: el error típico se califica como correcto`);
    }
  });
  // 7) LaTeX bien formado en el enunciado y la solución
  for (const x of problemasLatex(g.enunciado)) out.push(`enunciado: ${x}`);
  for (const x of problemasLatex(g.solucion)) out.push(`solución: ${x}`);
  // 6) datos visibles
  for (const [k, v] of Object.entries(g.datos)) {
    const variantes = [String(v), v.toFixed(1), v.toFixed(2), v.toFixed(3), sig(v, 2), sig(v, 3)];
    if (!variantes.some((s) => g.enunciado.includes(s))) out.push(`el dato ${k} = ${v} no aparece en el enunciado`);
  }
  return out;
}

export interface ResultadoConstruccion {
  variantes: VarianteConstruida[];
  descartes: number;
  errores: string[];
}

/** Construye `n` variantes válidas y distintas de una plantilla (determinista para una semilla de banco dada) */
export function construirPlantilla(pl: Plantilla, n: number, semillaBanco: number, intentosMax = 4000): ResultadoConstruccion {
  const variantes: VarianteConstruida[] = [];
  const vistos = new Set<string>();
  let descartes = 0;
  const errores: string[] = [];
  for (let s = 0; s < intentosMax && variantes.length < n; s++) {
    const semilla = (hash32(`${pl.id}#${s}`) ^ semillaBanco) >>> 0;
    const g = pl.generar(new Rng(semilla));
    if (!g) {
      descartes++;
      continue;
    }
    const firma = JSON.stringify(g.datos);
    if (vistos.has(firma)) {
      descartes++;
      continue;
    }
    const prob = problemasVariante(pl, g);
    if (prob.length && prob.every((x) => x.startsWith('AMBIGUA'))) {
      // con estos números un método equivocado daría casi la misma respuesta: la variante se descarta (no es un error)
      descartes++;
      continue;
    }
    if (prob.length) {
      // un fallo de verificación es un error de la plantilla, no un descarte silencioso
      errores.push(`${pl.id} (semilla ${semilla}): ${prob.join('; ')}`);
      if (errores.length > 5) break;
      continue;
    }
    vistos.add(firma);
    const clave: ClaveMaraton = { partes: g.partes.map((p) => claveParte(p, pl.nivel)) };
    const ind = pl.verificar(g.datos);
    const k = variantes.length + 1;
    variantes.push({
      id: `${pl.id}#${k}`,
      plantilla: pl.id,
      n: k,
      semilla,
      enunciado: g.enunciado,
      partes: g.partes.map((p) => ({ etiqueta: p.etiqueta, unidad: p.unidad })),
      datos: g.datos,
      clave,
      solucion: g.solucion,
      verificacion: {
        independiente: ind,
        analitica: g.partes.map((p) => p.valor),
        desviacion_max: Math.max(...g.partes.map((p, i) => Math.abs(ind[i] - p.valor) / Math.abs(p.valor))),
      },
      huella: createHash('sha256').update(g.enunciado + JSON.stringify(clave)).digest('hex').slice(0, 16),
    });
  }
  if (!errores.length && variantes.length < n) errores.push(`${pl.id}: solo ${variantes.length} variantes válidas de ${n} (${descartes} descartes)`);
  return { variantes, descartes, errores };
}

export interface BancoConstruido {
  banco: Banco;
  variantes: Map<string, VarianteConstruida[]>;
  errores: string[];
  descartes: number;
}

export function validarEstructura(b: Banco): string[] {
  const out: string[] = [];
  const temas = new Set(b.temas.map((t) => t.codigo));
  const ids = new Set<string>();
  for (const p of b.plantillas) {
    if (ids.has(p.id)) out.push(`plantilla repetida ${p.id}`);
    ids.add(p.id);
    if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(p.id)) out.push(`id inválido ${p.id}`);
    if (!temas.has(p.tema)) out.push(`${p.id}: tema desconocido ${p.tema}`);
    const t = b.temas.find((x) => x.codigo === p.tema);
    if (t?.estado === 'excluido') out.push(`${p.id}: plantilla en un tema excluido`);
    if (t?.estado === 'pendiente' && (p.estado ?? 'validada') === 'validada') out.push(`${p.id}: un tema pendiente no puede tener plantillas validadas`);
    if (p.t_min_s < 30 || p.t_max_s < p.t_min_s || p.t_max_s > 3600) out.push(`${p.id}: tiempos fuera de rango`);
    if (!p.fuente || !p.metodo || !p.subtema) out.push(`${p.id}: falta fuente, método o subtema`);
  }
  return out;
}

export function construirBanco(b: Banco, porPlantilla: number, semillaBanco: number): BancoConstruido {
  const errores = validarEstructura(b);
  const variantes = new Map<string, VarianteConstruida[]>();
  let descartes = 0;
  for (const p of b.plantillas) {
    const r = construirPlantilla(p, porPlantilla, semillaBanco);
    variantes.set(p.id, r.variantes);
    descartes += r.descartes;
    errores.push(...r.errores);
  }
  return { banco: b, variantes, errores, descartes };
}
