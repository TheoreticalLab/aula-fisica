/**
 * LIEIA · Modelo temporal del proceso de respuesta (a partir de los eventos de telemetría de un intento).
 *
 * Reloj: cada sesión (carga de página) tiene su reloj monotónico t_ms. Se ancla al reloj del SERVIDOR con
 * ancla = mín(recepción − t_ms) (la red solo retrasa, así que el mínimo es la mejor cota del inicio real de la
 * sesión). Tiempo alineado = ancla + t_ms, en segundos desde el inicio del intento.
 *
 * Tiempos: cronológico (inicio → envío), activo (= cronológico − oculto ∪ inactivo ∪ sin conexión), de edición
 * (primera entrada no vacía → última edición) y posterior a la última modificación (última edición → envío).
 * Por pregunta: primera vista, primera interacción, primera entrada no vacía, cambios, borrados, última edición,
 * latencia de generación (primera vista → primera entrada no vacía), persistencia, ráfagas «pegadas».
 * Calidad: eventos perdidos (huecos de secuencia), llegadas tardías, sesiones y recargas, desfase del reloj del
 * cliente. Los eventos del navegador pueden perderse o manipularse: son indicios, no evidencia infalible.
 */

export interface EventoCrudo { s: string; q: number; k: string; e: string | null; t: number; r: number; w?: number | null; d: Record<string, unknown> }
export interface Intervalo { desde: number; hasta: number; tipo: 'oculta' | 'inactiva' | 'sin_conexion' }
export interface Rafaga { t: number; inicio: number; dur: number; delta: number; len: number; vacia: boolean; borrado: boolean }

export interface ProcesoItem {
  exercise_id: string;
  vista: number | null; vistas: number; interaccion: number | null; primeraNoVacia: number | null;
  cambios: number; borrados: number; ultimaEdicion: number | null; rafagas: Rafaga[];
  latenciaGeneracion: number | null; tiempoEdicion: number | null; persistencia: number | null;
  intervalosEntreCambios: number[]; activo: number; pegados: number; sinGuardar: boolean; revisitas: number;
}
export interface CalidadDatos { eventos: number; perdidos: number; tardios: number; sesiones: number; recargas: number; desfaseRelojS: number | null; huecosConexion: number }
export interface ProcesoIntento {
  envio: number | null; cronologico: number | null; activo: number; oculto: number; inactivo: number; sinConexion: number;
  esperaFinal: number | null; esperaFinalInactiva: number | null; ultimaEdicion: number | null;
  items: ProcesoItem[]; intervalos: Intervalo[]; calidad: CalidadDatos;
  linea: { t: number; k: string; e: string | null; d: Record<string, unknown> }[];
}

const num = (v: unknown) => (typeof v === 'number' ? v : null);

/** Une intervalos solapados y devuelve su duración total dentro de [a, b]. */
function cubierto(xs: { desde: number; hasta: number }[], a: number, b: number): number {
  const o = xs.map((x) => ({ desde: Math.max(a, x.desde), hasta: Math.min(b, x.hasta) })).filter((x) => x.hasta > x.desde).sort((x, y) => x.desde - y.desde);
  let tot = 0, ini = -Infinity, fin = -Infinity;
  for (const x of o) {
    if (x.desde > fin) { if (fin > ini) tot += fin - ini; ini = x.desde; fin = x.hasta; } else fin = Math.max(fin, x.hasta);
  }
  if (fin > ini) tot += fin - ini;
  return tot;
}

export function reconstruir(eventos: EventoCrudo[], inicioServidor: number, entregaServidor: number | null, itemsIds: string[]): ProcesoIntento {
  // --- alineación de relojes por sesión ---
  const porSesion = new Map<string, EventoCrudo[]>();
  for (const e of eventos) porSesion.set(e.s, [...(porSesion.get(e.s) ?? []), e]);
  const ancla = new Map<string, number>();
  let perdidos = 0, tardios = 0, recargas = 0;
  const desfases: number[] = [];
  for (const [s, xs] of porSesion) {
    xs.sort((a, b) => a.q - b.q);
    ancla.set(s, Math.min(...xs.map((e) => e.r - e.t / 1000)));
    const qs = new Set(xs.map((e) => e.q));
    perdidos += Math.max(...xs.map((e) => e.q)) - qs.size;
    for (const e of xs) {
      const al = ancla.get(s)! + e.t / 1000;
      if (e.r - al > 30) tardios++;
      if (typeof e.w === 'number') desfases.push(e.w - al);
      if (e.k === 'sesion_inicio' && e.d.navegacion === 'reload') recargas++;
    }
  }
  const rel = (e: EventoCrudo, ms = e.t) => ancla.get(e.s)! + ms / 1000 - inicioServidor;
  const linea = eventos.map((e) => ({ t: rel(e), k: e.k, e: e.e, d: e.d, s: e.s, src: e })).sort((a, b) => a.t - b.t);

  // --- envío y fin del registro ---
  const recibido = linea.find((x) => x.k === 'envio' && x.d.fase === 'recibido');
  const envio = entregaServidor !== null ? entregaServidor - inicioServidor : recibido?.t ?? null;
  const fin = envio ?? (linea.length ? linea[linea.length - 1].t : 0);

  // --- intervalos de oculta / inactiva / sin conexión (cada sesión cierra los suyos) ---
  const intervalos: Intervalo[] = [];
  let huecosConexion = 0;
  for (const [s] of porSesion) {
    const xs = linea.filter((x) => x.s === s);
    const finSesion = Math.min(fin, xs.length ? xs[xs.length - 1].t : fin);
    let oc: number | null = null, ina: number | null = null, sc: number | null = null;
    for (const x of xs) {
      if (x.k === 'visibilidad') { if (x.d.visible === false && oc === null) oc = x.t; if (x.d.visible === true && oc !== null) { intervalos.push({ desde: oc, hasta: x.t, tipo: 'oculta' }); oc = null; } }
      if (x.k === 'inactividad') {
        if (x.d.estado === 'inicio' && ina === null) ina = num(x.d.desde_ms) !== null ? rel(x.src, num(x.d.desde_ms)!) : x.t;
        if (x.d.estado === 'fin' && ina !== null) { intervalos.push({ desde: ina, hasta: x.t, tipo: 'inactiva' }); ina = null; }
      }
      if (x.k === 'conexion') { if (x.d.en_linea === false && sc === null) { sc = x.t; huecosConexion++; } if (x.d.en_linea === true && sc !== null) { intervalos.push({ desde: sc, hasta: x.t, tipo: 'sin_conexion' }); sc = null; } }
    }
    if (oc !== null) intervalos.push({ desde: oc, hasta: finSesion, tipo: 'oculta' });
    if (ina !== null) intervalos.push({ desde: ina, hasta: finSesion, tipo: 'inactiva' });
    if (sc !== null) intervalos.push({ desde: sc, hasta: finSesion, tipo: 'sin_conexion' });
  }
  // huecos entre sesiones (recarga o cierre): tiempo sin registro, contado como oculto
  const ses = [...porSesion.keys()].map((s) => { const xs = linea.filter((x) => x.s === s); return { a: xs[0]?.t ?? 0, b: xs[xs.length - 1]?.t ?? 0 }; }).sort((x, y) => x.a - y.a);
  for (let k = 1; k < ses.length; k++) if (ses[k].a > ses[k - 1].b + 5) intervalos.push({ desde: ses[k - 1].b, hasta: ses[k].a, tipo: 'oculta' });

  const oculto = cubierto(intervalos.filter((x) => x.tipo === 'oculta'), 0, fin);
  const inactivo = cubierto(intervalos.filter((x) => x.tipo === 'inactiva'), 0, fin);
  const sinConexion = cubierto(intervalos.filter((x) => x.tipo === 'sin_conexion'), 0, fin);
  const ausente = cubierto(intervalos, 0, fin);

  // --- por pregunta ---
  const items: ProcesoItem[] = itemsIds.map((id) => {
    const xs = linea.filter((x) => x.e === id);
    const vistas = xs.filter((x) => x.k === 'pregunta_vista' && x.d.visible === true);
    const cambiosEv = xs.filter((x) => x.k === 'respuesta_cambio');
    const rafagas: Rafaga[] = cambiosEv.map((x) => {
      const inicio = num(x.d.inicio_ms) !== null ? rel(x.src, num(x.d.inicio_ms)!) : x.t;
      return { t: x.t, inicio, dur: (num(x.d.rafaga_ms) ?? 0) / 1000, delta: num(x.d.delta) ?? 0, len: num(x.d.len) ?? 0, vacia: x.d.vacia === true, borrado: x.d.borrado === true };
    });
    const primera = rafagas.find((r) => !r.vacia);
    const ultima = rafagas.length ? rafagas[rafagas.length - 1] : null;
    const vista = vistas[0]?.t ?? null;
    const guardados = xs.filter((x) => x.k === 'borrador_guardado' && x.d.ok === true);
    // tiempo activo atribuido: desde cada evento de esta pregunta hasta el siguiente evento de cualquier pregunta (tope 5 min)
    let activo = 0;
    const itemEv = linea.filter((x) => x.e !== null);
    itemEv.forEach((x, k) => {
      if (x.e !== id) return;
      const sig = Math.min(itemEv[k + 1]?.t ?? fin, x.t + 300, fin);
      if (sig > x.t) activo += (sig - x.t) - cubierto(intervalos, x.t, sig);
    });
    const tiemposCambio = rafagas.map((r) => r.inicio);
    return {
      exercise_id: id, vista, vistas: vistas.length, interaccion: xs.find((x) => x.k === 'primera_interaccion')?.t ?? null,
      primeraNoVacia: primera?.inicio ?? null, cambios: rafagas.length, borrados: rafagas.filter((r) => r.borrado).length,
      ultimaEdicion: ultima ? ultima.t : null, rafagas,
      latenciaGeneracion: primera && vista !== null ? Math.max(0, primera.inicio - vista) : null,
      tiempoEdicion: primera && ultima ? Math.max(0, ultima.t - primera.inicio) : null,
      persistencia: ultima && envio !== null ? Math.max(0, envio - ultima.t) : null,
      intervalosEntreCambios: tiemposCambio.slice(1).map((t, k) => t - tiemposCambio[k]),
      activo, pegados: rafagas.filter((r) => r.delta >= 15 && r.dur <= 0.3).length,
      sinGuardar: !!ultima && !ultima.vacia && !guardados.some((g) => g.t >= ultima.t),
      revisitas: primera ? vistas.filter((v) => v.t > primera.inicio).length : 0,
    };
  });
  const ultimaEdicion = items.reduce<number | null>((m, it) => (it.ultimaEdicion !== null && (m === null || it.ultimaEdicion > m) ? it.ultimaEdicion : m), null);
  const esperaFinal = envio !== null && ultimaEdicion !== null ? Math.max(0, envio - ultimaEdicion) : null;
  return {
    envio, cronologico: envio, activo: Math.max(0, fin - ausente), oculto, inactivo, sinConexion,
    esperaFinal, esperaFinalInactiva: esperaFinal !== null && ultimaEdicion !== null ? cubierto(intervalos.filter((x) => x.tipo !== 'sin_conexion'), ultimaEdicion, envio as number) : null,
    ultimaEdicion, items, intervalos,
    calidad: { eventos: eventos.length, perdidos, tardios, sesiones: porSesion.size, recargas, desfaseRelojS: desfases.length ? desfases.sort((a, b) => a - b)[Math.floor(desfases.length / 2)] : null, huecosConexion },
    linea: linea.map(({ t, k, e, d }) => ({ t, k, e, d })),
  };
}
