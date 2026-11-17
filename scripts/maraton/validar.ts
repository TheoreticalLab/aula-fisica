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
import { DIMENSIONES, hash32, NIVEL_MAX_ORDINARIO, partesTodas, problemasLatex, Rng, sig, type Banco, type Generado, type Plantilla } from './marco';

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
  /** etapas 2…n (niveles 7–9): texto, partes visibles y clave propia de cada una */
  etapas?: { enunciado: string; partes: { etiqueta: string; unidad: string }[]; clave: ClaveMaraton }[];
  /** comprobación breve de razonamiento (niveles 1–6 con datos escalables) */
  comprobacion?: Comprobacion;
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
  const todas = partesTodas(g);
  for (const [k, v] of Object.entries(g.datos)) if (!Number.isFinite(v)) out.push(`dato ${k} no finito`);
  if (!g.partes.length || g.partes.length > 6) out.push('número de partes fuera de 1..6');
  // etapas: solo y siempre en los niveles avanzados (3 a 5 etapas en total, 1–3 partes cada una)
  const nEt = g.etapas?.length ?? 0;
  if (pl.nivel > NIVEL_MAX_ORDINARIO && (nEt < 2 || nEt > 4)) out.push(`un problema de nivel ${pl.nivel} debe tener de 3 a 5 etapas (tiene ${nEt + 1})`);
  if (pl.nivel <= NIVEL_MAX_ORDINARIO && nEt > 0) out.push('un problema ordinario no tiene etapas');
  if (nEt > 0 && g.partes.length > 3) out.push('etapa 1: más de 3 partes');
  (g.etapas ?? []).forEach((e, i) => {
    if (!e.partes.length || e.partes.length > 3) out.push(`etapa ${i + 2}: debe tener de 1 a 3 partes`);
    if (!e.enunciado.trim()) out.push(`etapa ${i + 2}: sin enunciado`);
  });
  todas.forEach((p, i) => {
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
  if (ind.length !== todas.length) return ['el verificador devuelve otro número de partes'];
  const tolV = pl.tolVerificacion ?? 0.005;
  todas.forEach((p, i) => {
    const d = Math.abs(ind[i] - p.valor) / Math.max(Math.abs(p.valor), 1e-12);
    if (!(d <= tolV)) out.push(`parte ${i + 1}: verificación independiente ${ind[i]} ≠ ${p.valor} (desv. ${(d * 100).toFixed(3)} %)`);
  });
  // 3) dimensiones
  todas.forEach((p, i) => {
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
  // cada etapa se califica con su propia clave (así lo hace la Edge Function)
  for (const [n, ps] of [g.partes, ...(g.etapas ?? []).map((e) => e.partes)].entries()) {
    const ke: ClaveMaraton = { partes: ps.map((p) => claveParte(p, pl.nivel)) };
    const r = evaluarRespuesta(ke, ke.partes.map((k) => k.value));
    if (!r.valida || !r.correcta) out.push(`etapa ${n + 1}: la clave no se califica como correcta: ${JSON.stringify(r)}`);
  }
  const clave: ClaveMaraton = { partes: todas.map((p) => claveParte(p, pl.nivel)) };
  todas.forEach((p, i) => {
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
  (g.etapas ?? []).forEach((e, i) => problemasLatex(e.enunciado).forEach((x) => out.push(`etapa ${i + 2}: ${x}`)));
  for (const x of problemasLatex(g.solucion)) out.push(`solución: ${x}`);
  // 6) datos visibles (en el enunciado o en la etapa que los introduce)
  const textos = [g.enunciado, ...(g.etapas ?? []).map((e) => e.enunciado)].join('\n');
  for (const [k, v] of Object.entries(g.datos)) {
    const variantes = [String(v), v.toFixed(1), v.toFixed(2), v.toFixed(3), sig(v, 2), sig(v, 3)];
    if (!variantes.some((s) => textos.includes(s))) out.push(`el dato ${k} = ${v} no aparece en el enunciado`);
  }
  return out;
}

export interface Comprobacion {
  enunciado: string;
  parte: { etiqueta: string; unidad: string };
  clave: ClaveMaraton;
  solucion: string;
  /** dato cambiado, factor y parte a la que se refiere (para el informe) */
  dato: string;
  factor: number;
  parte_ref: number;
}

const FACTOR_TXT: Record<string, string> = { '2': 'se duplicara', '3': 'se triplicara', '0.5': 'se redujera a la mitad', '4': 'se cuadruplicara', '0.25': 'se redujera a la cuarta parte' };

/**
 * Comprobación breve de razonamiento de una variante ordinaria: «si solo <dato> se duplicara, ¿por qué factor quedaría
 * multiplicado <resultado>?». El factor lo da el verificador INDEPENDIENTE con el dato cambiado (no la fórmula de la
 * plantilla). Se descartan factores no finitos, no positivos, que se confundan con un error típico (r = s, s², 1/s, √s)
 * cuando no lo son, y partes enteras. Determinista por variante. Devuelve null si ninguna combinación sirve.
 */
export function construirComprobacion(pl: Plantilla, g: Generado, semilla: number): Comprobacion | null {
  if (!pl.escalables || pl.nivel > NIVEL_MAX_ORDINARIO) return null;
  const rng = new Rng((semilla ^ 0x5bd1e995) >>> 0);
  const base = pl.verificar(g.datos);
  const opciones: { dato: string; s: number; parte: number }[] = [];
  for (const [dato, e] of Object.entries(pl.escalables)) {
    if (!(dato in g.datos)) continue;
    for (const s of e.factores) g.partes.forEach((p, i) => { if (p.magnitud !== 'entero') opciones.push({ dato, s, parte: i }); });
  }
  // orden reproducible y luego barajado con la semilla de la variante
  for (let i = opciones.length - 1; i > 0; i--) {
    const j = Math.floor(rng.u() * (i + 1));
    [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
  }
  for (const o of opciones) {
    let r: number;
    try {
      const nuevo = pl.verificar({ ...g.datos, [o.dato]: g.datos[o.dato] * o.s });
      r = nuevo[o.parte] / base[o.parte];
    } catch {
      continue;
    }
    if (!Number.isFinite(r) || r <= 0 || r > 1000 || r < 1e-3) continue;
    const tol = 0.02;
    const candidatos = [o.s, o.s * o.s, 1 / o.s, Math.sqrt(o.s), 1 / (o.s * o.s), 1 / Math.sqrt(o.s), 1];
    // si r coincide con un candidato es ESE (exacto); si queda cerca de otro sin ser él, la comprobación es ambigua
    if (candidatos.some((c) => Math.abs(c - r) / r > 1e-6 && Math.abs(c - r) / r <= 2 * tol)) continue;
    const errores = candidatos.filter((c) => Math.abs(c - r) / r > 2 * tol);
    const p = g.partes[o.parte];
    const ft = FACTOR_TXT[String(o.s)] ?? `se multiplicara por ${o.s}`;
    const nombre = pl.escalables[o.dato].nombre;
    const clave: ClaveMaraton = {
      partes: [claveParte({ etiqueta: 'Factor', unidad: '', magnitud: 'adimensional', valor: r, relTol: tol, errores: errores.map((c) => ({ valor: c, mensaje: 'Dependencia funcional equivocada.' })) }, pl.nivel)],
    };
    return {
      enunciado: `**Comprobación de razonamiento.** En este mismo problema, suponga que solo ${nombre} ${ft} y que todo lo demás queda igual. ¿Por qué número quedaría multiplicado el resultado «${p.etiqueta}»? (Escriba solo el número; por ejemplo, 0.5 si se reduce a la mitad.)`,
      parte: { etiqueta: `Factor por el que se multiplica «${p.etiqueta}»`, unidad: '' },
      clave,
      solucion: `Recalculando con ese único cambio (${nombre} × ${o.s}), «${p.etiqueta}» queda multiplicado por ${sig(r, 4)}.`,
      dato: o.dato,
      factor: o.s,
      parte_ref: o.parte + 1,
    };
  }
  return null;
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
    const todas = partesTodas(g);
    const comprobacion = construirComprobacion(pl, g, semilla) ?? undefined;
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
        analitica: todas.map((p) => p.valor),
        desviacion_max: Math.max(...todas.map((p, i) => Math.abs(ind[i] - p.valor) / Math.abs(p.valor))),
      },
      etapas: g.etapas?.map((e) => ({
        enunciado: e.enunciado,
        partes: e.partes.map((p) => ({ etiqueta: p.etiqueta, unidad: p.unidad })),
        clave: { partes: e.partes.map((p) => claveParte(p, pl.nivel)) },
      })),
      comprobacion,
      huella: createHash('sha256').update(g.enunciado + JSON.stringify(clave) + (g.etapas ? JSON.stringify(g.etapas) : '')).digest('hex').slice(0, 16),
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
    if (p.nivel > NIVEL_MAX_ORDINARIO && p.escalables) out.push(`${p.id}: los niveles avanzados no llevan comprobación de razonamiento`);
  }
  return out;
}

export function construirBanco(b: Banco, porPlantilla: number, semillaBanco: number): BancoConstruido {
  const errores = validarEstructura(b);
  const variantes = new Map<string, VarianteConstruida[]>();
  let descartes = 0;
  for (const p of b.plantillas) {
    const r = construirPlantilla(p, p.variantes ?? porPlantilla, semillaBanco);
    variantes.set(p.id, r.variantes);
    descartes += r.descartes;
    errores.push(...r.errores);
  }
  return { banco: b, variantes, errores, descartes };
}
