/**
 * Indicadores del informe docente del Maratón adaptativo, calculados a partir del historial forense.
 *
 * Son OBSERVACIONES descriptivas, no inferencias: no hay puntuaciones de sospecha ni detectores de autoría (no hay
 * validación científica que los respalde). Resolver problemas extremos no prueba el uso de ayudas externas, y la
 * oscilación entre niveles es en parte efecto del propio algoritmo (sube al acertar y baja al fallar), no un cambio
 * demostrado de competencia. El profesor contrasta estos datos con otras evaluaciones.
 */
import type { FilaExportacion, FilaJornada, PresentacionHistorial } from '@/api/maraton';
import type { ConfigMaraton } from '@/lib/maraton/config';

export interface PuntoTrayectoria {
  x: number; nivel: number; despues: number | null; jornada: number;
  tipo: 'correcta' | 'incorrecta' | 'no_puedo' | 'cambio' | 'cierre' | 'abierta';
  movimiento: 'ascenso' | 'descenso' | 'igual' | null;
  p: PresentacionHistorial;
}

export const tipoPunto = (p: PresentacionHistorial): PuntoTrayectoria['tipo'] =>
  p.accion === 'respuesta' ? (p.resultado === 'correcta' ? 'correcta' : 'incorrecta') : p.accion ?? 'abierta';

export function trayectoria(ps: PresentacionHistorial[]): PuntoTrayectoria[] {
  return ps.map((p) => ({
    x: p.secuencia, nivel: p.nivel, despues: p.nivel_despues, jornada: p.jornada, tipo: tipoPunto(p), p,
    movimiento: p.nivel_despues === null ? null : p.nivel_despues > p.nivel ? 'ascenso' : p.nivel_despues < p.nivel ? 'descenso' : 'igual',
  }));
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const tasa = (a: number, b: number) => (b ? a / b : null);

export interface Rendimiento {
  presentados: number; validos: number; correctas: number; incorrectas: number; noPuedo: number; cambios: number; cierres: number; anticipadas: number;
  precision: number | null; minutos: number; mediaSegundosValido: number | null;
  porNivel: { nivel: number; presentados: number; validos: number; correctas: number; precision: number | null; noPuedo: number; cambios: number; mediaSegundos: number | null }[];
  porTema: { tema: string; presentados: number; validos: number; correctas: number; precision: number | null; noPuedo: number }[];
}

/** niveles que se muestran: 1–6 siempre; 7–9 solo si el estudiante llegó a ellos (progresión avanzada, migración 99) */
export function nivelesDe(ps: { nivel: number }[]): number[] {
  const max = Math.max(6, ...ps.map((p) => p.nivel));
  return Array.from({ length: max }, (_, i) => i + 1);
}

export function rendimiento(ps: PresentacionHistorial[]): Rendimiento {
  const cerr = ps.filter((p) => p.accion);
  const val = cerr.filter((p) => p.accion === 'respuesta');
  const porNivel = nivelesDe(ps).map((n) => {
    const xs = cerr.filter((p) => p.nivel === n), v = xs.filter((p) => p.accion === 'respuesta');
    return { nivel: n, presentados: ps.filter((p) => p.nivel === n).length, validos: v.length, correctas: v.filter((p) => p.resultado === 'correcta').length,
      precision: tasa(v.filter((p) => p.resultado === 'correcta').length, v.length), noPuedo: xs.filter((p) => p.accion === 'no_puedo').length,
      cambios: xs.filter((p) => p.accion === 'cambio').length, mediaSegundos: media(v.map((p) => p.segundos ?? 0)) };
  });
  const temas = [...new Set(ps.map((p) => p.tema))];
  const porTema = temas.map((t) => {
    const xs = cerr.filter((p) => p.tema === t), v = xs.filter((p) => p.accion === 'respuesta'), ok = v.filter((p) => p.resultado === 'correcta').length;
    return { tema: t, presentados: ps.filter((p) => p.tema === t).length, validos: v.length, correctas: ok, precision: tasa(ok, v.length), noPuedo: xs.filter((p) => p.accion === 'no_puedo').length };
  }).sort((a, b) => b.presentados - a.presentados);
  const ok = val.filter((p) => p.resultado === 'correcta').length;
  return {
    presentados: ps.length, validos: val.length, correctas: ok, incorrectas: val.length - ok,
    noPuedo: cerr.filter((p) => p.accion === 'no_puedo').length, cambios: cerr.filter((p) => p.accion === 'cambio').length,
    cierres: cerr.filter((p) => p.accion === 'cierre').length, anticipadas: val.filter((p) => p.anticipada).length,
    precision: tasa(ok, val.length), minutos: cerr.reduce((s, p) => s + (p.segundos ?? 0), 0) / 60,
    mediaSegundosValido: media(val.map((p) => p.segundos ?? 0)), porNivel, porTema,
  };
}

export interface Comportamiento {
  noPuedoPorNivel: { nivel: number; n: number; frecuencia: number | null }[];
  cambiosPorNivel: { nivel: number; n: number }[];
  segundosAntesDeAbandonar: number | null;
  rachaCorrectas: number; rachaIncorrectas: number;
  maxPermanenciaD6: number; entradasAltas: number; oscilaciones: number; cambiosDeDireccion: number;
}

export function comportamiento(ps: PresentacionHistorial[]): Comportamiento {
  const cerr = ps.filter((p) => p.accion && p.accion !== 'cierre');
  let rc = 0, ri = 0, c = 0, i = 0;
  for (const p of cerr.filter((x) => x.accion === 'respuesta')) {
    if (p.resultado === 'correcta') { c++; i = 0; } else { i++; c = 0; }
    rc = Math.max(rc, c); ri = Math.max(ri, i);
  }
  // permanencia en D6: problemas consecutivos presentados en D6
  let d6 = 0, maxD6 = 0;
  for (const p of ps) { d6 = p.nivel === 6 ? d6 + 1 : 0; maxD6 = Math.max(maxD6, d6); }
  // entradas a D5–D6 desde niveles inferiores, y cambios de dirección del recorrido
  let entradas = 0, dir = 0, giros = 0, osc = 0;
  for (let k = 0; k < ps.length; k++) {
    const p = ps[k];
    if (p.nivel >= 5 && (k === 0 || ps[k - 1].nivel < 5)) entradas++;
    if (p.nivel_despues !== null && p.nivel_despues !== p.nivel) {
      const d = Math.sign(p.nivel_despues - p.nivel);
      if (dir !== 0 && d !== dir) giros++;
      dir = d;
      osc++;
    }
  }
  return {
    noPuedoPorNivel: nivelesDe(ps).map((n) => {
      const xs = ps.filter((p) => p.nivel === n && p.accion), np = xs.filter((p) => p.accion === 'no_puedo').length;
      return { nivel: n, n: np, frecuencia: tasa(np, xs.length) };
    }),
    cambiosPorNivel: nivelesDe(ps).map((n) => ({ nivel: n, n: ps.filter((p) => p.nivel === n && p.accion === 'cambio').length })),
    segundosAntesDeAbandonar: mediana(ps.filter((p) => p.accion === 'no_puedo').map((p) => p.segundos ?? 0)),
    rachaCorrectas: rc, rachaIncorrectas: ri, maxPermanenciaD6: maxD6, entradasAltas: entradas, oscilaciones: osc, cambiosDeDireccion: giros,
  };
}

export interface EvolucionJornada {
  jornada: number; presentados: number; validos: number; precision: number | null; nivelMedio: number | null; nivelMaximo: number | null;
  medianaSegundos: number | null; noPuedo: number; cambios: number;
}

export function evolucion(ps: PresentacionHistorial[]): EvolucionJornada[] {
  const js = [...new Set(ps.map((p) => p.jornada))].sort((a, b) => a - b);
  return js.map((j) => {
    const xs = ps.filter((p) => p.jornada === j), v = xs.filter((p) => p.accion === 'respuesta');
    return {
      jornada: j, presentados: xs.length, validos: v.length, precision: tasa(v.filter((p) => p.resultado === 'correcta').length, v.length),
      nivelMedio: media(v.map((p) => p.nivel)), nivelMaximo: xs.length ? Math.max(...xs.map((p) => p.nivel)) : null,
      medianaSegundos: mediana(v.map((p) => p.segundos ?? 0)), noPuedo: xs.filter((p) => p.accion === 'no_puedo').length,
      cambios: xs.filter((p) => p.accion === 'cambio').length,
    };
  });
}

/** Evolución de la precisión por tema y jornada (matriz tema × jornada) */
export function evolucionPorTema(ps: PresentacionHistorial[]): { tema: string; celdas: Record<number, { validos: number; correctas: number }> }[] {
  const temas = [...new Set(ps.map((p) => p.tema))];
  return temas.map((t) => {
    const celdas: Record<number, { validos: number; correctas: number }> = {};
    for (const p of ps.filter((x) => x.tema === t && x.accion === 'respuesta')) {
      const c = (celdas[p.jornada] ??= { validos: 0, correctas: 0 });
      c.validos++;
      if (p.resultado === 'correcta') c.correctas++;
    }
    return { tema: t, celdas };
  });
}

export interface Observacion { tipo: string; titulo: string; detalle: string; referencias: number[] }

/**
 * Indicadores de consistencia académica (FASE 15). Cada uno es una observación con los problemas que la sustentan,
 * para revisión humana. No se combinan en ninguna puntuación.
 */
export function consistencia(ps: PresentacionHistorial[]): Observacion[] {
  const out: Observacion[] = [];
  const val = ps.filter((p) => p.accion === 'respuesta');
  // 1) rendimiento alto en problemas extremos y bajo en elementales del MISMO tema
  for (const t of new Set(val.map((p) => p.tema))) {
    const alto = val.filter((p) => p.tema === t && p.nivel >= 5), bajo = val.filter((p) => p.tema === t && p.nivel <= 2);
    if (alto.length >= 2 && bajo.length >= 2) {
      const pa = alto.filter((p) => p.resultado === 'correcta').length / alto.length, pb = bajo.filter((p) => p.resultado === 'correcta').length / bajo.length;
      if (pa >= 0.7 && pb <= 0.4) out.push({ tipo: 'extremo_vs_elemental', titulo: `Tema ${t}: aciertos altos en D5 o superior y bajos en D1–D2`,
        detalle: `D5 o superior: ${Math.round(pa * 100)} % de ${alto.length}; D1–D2: ${Math.round(pb * 100)} % de ${bajo.length}.`, referencias: [...alto, ...bajo].map((p) => p.secuencia) });
    }
  }
  // 2) aciertos en D5 o superior con menos de la mitad del tiempo mínimo del problema
  const rapidos = val.filter((p) => p.nivel >= 5 && p.resultado === 'correcta' && (p.segundos ?? 0) < 0.5 * p.t_min_s);
  if (rapidos.length) out.push({ tipo: 'extremo_rapido', titulo: `${rapidos.length} acierto(s) en D5 o superior con menos de la mitad del tiempo mínimo`,
    detalle: rapidos.map((p) => `#${p.secuencia}: ${Math.round(p.segundos ?? 0)} s (mínimo ${p.t_min_s} s)`).join('; '), referencias: rapidos.map((p) => p.secuencia) });
  // 3) cambios bruscos de tiempo entre jornadas (mediana por intento ×2 o ÷2)
  const ev = evolucion(ps).filter((e) => e.medianaSegundos !== null && e.validos >= 3);
  for (let k = 1; k < ev.length; k++) {
    const r = (ev[k].medianaSegundos as number) / Math.max(1, ev[k - 1].medianaSegundos as number);
    if (r >= 2 || r <= 0.5) out.push({ tipo: 'tiempo_brusco', titulo: `Cambio brusco del tiempo por intento entre las jornadas ${ev[k - 1].jornada} y ${ev[k].jornada}`,
      detalle: `Mediana ${Math.round(ev[k - 1].medianaSegundos as number)} s → ${Math.round(ev[k].medianaSegundos as number)} s.`,
      referencias: ps.filter((p) => p.jornada === ev[k].jornada).map((p) => p.secuencia) });
  }
  // 4) diferencias de desempeño entre jornadas (precisión)
  const conPrec = ev.filter((e) => e.precision !== null && e.validos >= 4);
  if (conPrec.length >= 3) {
    const max = conPrec.reduce((a, b) => ((b.precision as number) > (a.precision as number) ? b : a)), min = conPrec.reduce((a, b) => ((b.precision as number) < (a.precision as number) ? b : a));
    if ((max.precision as number) - (min.precision as number) >= 0.6) out.push({ tipo: 'jornadas_dispares', titulo: 'Precisión muy distinta entre jornadas',
      detalle: `Jornada ${max.jornada}: ${Math.round((max.precision as number) * 100)} %; jornada ${min.jornada}: ${Math.round((min.precision as number) * 100)} %.`, referencias: [] });
  }
  // 5) comportamientos repetitivos: la misma respuesta escrita en problemas distintos
  const porTexto = new Map<string, number[]>();
  for (const p of val) {
    const t = (p.respuesta?.partes ?? []).join(' | ').trim().toLowerCase();
    if (t) porTexto.set(t, [...(porTexto.get(t) ?? []), p.secuencia]);
  }
  for (const [t, refs] of porTexto) if (refs.length >= 3) out.push({ tipo: 'respuesta_repetida', titulo: `La misma respuesta en ${refs.length} problemas distintos`, detalle: `«${t}»`, referencias: refs });
  // 6) secuencias atípicas: rachas de 4+ respuestas anticipadas seguidas
  let racha: number[] = [];
  const rachas: number[][] = [];
  for (const p of val) {
    if (p.anticipada) racha.push(p.secuencia);
    else { if (racha.length >= 4) rachas.push(racha); racha = []; }
  }
  if (racha.length >= 4) rachas.push(racha);
  for (const r of rachas) out.push({ tipo: 'anticipadas_seguidas', titulo: `${r.length} respuestas seguidas antes del tiempo mínimo`, detalle: `Problemas #${r[0]}–#${r[r.length - 1]}.`, referencias: r });
  // 7) comprobación de razonamiento fallada con el resultado numérico bien (migración 99)
  const comp = val.filter((p) => p.comprobacion && p.etapa1?.correcta === true && p.etapas?.find((e) => e.tipo === 'comprobacion')?.correcta === false);
  if (comp.length >= 2) out.push({ tipo: 'comprobacion_fallada', titulo: `${comp.length} resultado(s) correcto(s) con la comprobación de razonamiento fallada`,
    detalle: comp.map((p) => `#${p.secuencia}`).join(', ') + '.', referencias: comp.map((p) => p.secuencia) });
  // 8) problemas por etapas: primera etapa bien y las siguientes mal, de forma repetida
  const etapas = val.filter((p) => (p.etapas_total ?? 1) > 2 && p.etapa1?.correcta === true && (p.etapas ?? []).filter((e) => e.tipo === 'etapa' && e.correcta === false).length >= 2);
  if (etapas.length >= 2) out.push({ tipo: 'etapas_desiguales', titulo: `${etapas.length} problema(s) por etapas con la primera bien y las siguientes mal`,
    detalle: etapas.map((p) => `#${p.secuencia}`).join(', ') + '.', referencias: etapas.map((p) => p.secuencia) });
  return out;
}

export const AVISO_INTERPRETACION =
  'Observaciones, no inferencias: describen lo registrado. Ninguna es prueba de uso de ayudas externas ni de falta de honestidad. ' +
  'La declaración «No puedo resolverlo» es una autoevaluación del estudiante. La oscilación entre niveles es en parte efecto del algoritmo ' +
  '(sube al acertar y baja al fallar), no un cambio demostrado de competencia. Contraste con otras evaluaciones.';

/** Seguimiento en vivo: último ejercicio de cada estudiante (abierto si aún no lo cerró) y cuántos lleva. */
export interface Situacion { ultima: FilaExportacion; abierta: boolean; presentados: number; correctas: number; incorrectas: number }

/** Agrupa las filas de la exportación por estudiante (clave: `login_id`, o el nombre si no tiene). */
export function situacionPorEstudiante(filas: FilaExportacion[]): Map<string, Situacion> {
  const r = new Map<string, Situacion>();
  for (const f of filas) {
    const k = f.login_id ?? f.nombre;
    const s = r.get(k) ?? { ultima: f, abierta: false, presentados: 0, correctas: 0, incorrectas: 0 };
    s.presentados += 1;
    if (f.accion === 'respuesta') { if (f.resultado === 'correcta') s.correctas += 1; else s.incorrectas += 1; }
    if (f.secuencia >= s.ultima.secuencia) s.ultima = f;
    s.abierta = s.ultima.accion == null;
    r.set(k, s);
  }
  return r;
}

/**
 * Lo que le falta a un estudiante para completar una jornada, con las mismas reglas que el servidor: el mínimo de
 * aciertos y además la vía A (cuota de unidades tras el tiempo mínimo) o la vía B (minutos + respuestas). Cuenta solo
 * los problemas ya cerrados (el que tiene abierto suma al entregarlo). También el margen hasta los límites de la jornada.
 */
export interface FaltaJornada {
  estado: 'sin_iniciar' | 'en_curso' | 'completada' | 'cerrada_limite' | 'incompleta' | 'justificada';
  aciertos: { tiene: number; meta: number; falta: number };
  viaA: { unidades: number; meta: number; faltaUnidades: number; faltaMin: number; minimoMin: number } | null;
  viaB: { respuestas: number; metaRespuestas: number; faltaRespuestas: number; minutos: number; metaMin: number; faltaMin: number } | null;
  /** margen hasta los límites de protección (minutos, respuestas, problemas presentados) */
  margen: { min: number; respuestas: number; presentados: number };
  /** ya no puede alcanzar el mínimo de aciertos con las respuestas y problemas que le quedan */
  sinAlcance: boolean;
}

export function faltaJornada(j: FilaJornada | undefined, c: ConfigMaraton): FaltaJornada {
  const k = c.carga, meta = c.permanencia.min_correctas;
  const correctas = j?.correctas ?? 0, validos = j?.validos ?? 0, presentados = j?.presentados ?? 0;
  const segundos = j?.segundos ?? 0, minutos = Math.floor(segundos / 60), unidades = Math.round((j?.unidades ?? 0) * 100) / 100;
  const estado = (j?.estado ?? 'sin_iniciar') as FaltaJornada['estado'];
  const faltan = (m: number) => Math.max(0, Math.ceil((m * 60 - segundos) / 60));
  const margen = { min: faltan(k.limite_minutos), respuestas: Math.max(0, k.intentos_max - validos), presentados: Math.max(0, k.presentados_max - presentados) };
  return {
    estado,
    aciertos: { tiene: correctas, meta, falta: Math.max(0, meta - correctas) },
    viaA: k.cuota > 0 ? { unidades, meta: k.cuota, faltaUnidades: Math.max(0, Math.round((k.cuota - unidades) * 100) / 100), faltaMin: faltan(k.minutos_minimos), minimoMin: k.minutos_minimos } : null,
    viaB: k.alternativa_activa ? { respuestas: validos, metaRespuestas: k.alternativa_intentos, faltaRespuestas: Math.max(0, k.alternativa_intentos - validos),
      minutos, metaMin: k.alternativa_minutos, faltaMin: faltan(k.alternativa_minutos) } : null,
    margen,
    sinAlcance: correctas + Math.min(margen.respuestas, margen.presentados) < meta,
  };
}
