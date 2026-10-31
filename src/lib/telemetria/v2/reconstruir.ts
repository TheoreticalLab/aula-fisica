/**
 * Telemetría V2 · motor de reconstrucción (puro y determinista). Eventos normalizados → estado multidimensional por
 * sesión → partición mutuamente excluyente del intento → métricas por pregunta con su estado y su calidad.
 * Definiciones: docs/TELEMETRIA_V2.md §2. Nunca convierte un dato no identificable en cero.
 */
import { estimarDesfase } from '../../examen/reloj';
import { diferencia, esParticion, interseccion, medida, normalizar, particionar, solapes, union, type Iv } from './intervalos';
import {
  CATEGORIAS, PARAMETROS_POR_DEFECTO, VERSION_MOTOR,
  type CalidadPregunta, type Categoria, type Continuidad, type Entrada, type EventoNorm, type EventoReconstruido, type InfoSesion, type Metrica,
  type NivelCalidad, type Parametros, type Reconstruccion, type ResultadoPregunta,
} from './modelo';

interface Estado {
  vis: 'visible' | 'oculta' | 'desconocida';
  foco: 'si' | 'no' | 'desconocido';
  red: 'si' | 'no' | 'desconocida';
  inact: boolean;
  pausa: boolean;
  activa: string | null;
  expuestas: string[];
  desconocido: boolean;
}
interface Segmento extends Iv { sesion: string; e: Estado }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const m = (valor: number | null, estado: Metrica['estado'], nota?: string): Metrica => (nota ? { valor, estado, nota } : { valor, estado });
const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function reconstruir(entrada: Entrada): Reconstruccion {
  const P: Parametros = { ...PARAMETROS_POR_DEFECTO, ...(entrada.parametros ?? {}) };
  const adv: string[] = [];
  const preguntas = [...entrada.preguntas];

  // 1 · deduplicar por (sesión, secuencia): reenviar no cambia nada
  const claves = new Set<string>();
  const duplicados = new Map<string, number>();
  const evs: EventoNorm[] = [];
  for (const e of entrada.eventos) {
    const k = `${e.sesion}#${e.seq}`;
    if (claves.has(k)) { duplicados.set(e.sesion, (duplicados.get(e.sesion) ?? 0) + 1); continue; }
    claves.add(k);
    evs.push(e);
  }

  // 2 · sesiones y anclas al reloj del servidor
  const porSesion = new Map<string, EventoNorm[]>();
  for (const e of evs) { const l = porSesion.get(e.sesion) ?? []; l.push(e); porSesion.set(e.sesion, l); }
  const nombres = [...porSesion.keys()].sort(comparar);
  const anclas = new Map<string, number | null>();
  const sesiones: InfoSesion[] = [];
  const tiempo = (e: EventoNorm): number | null => {
    if (num(e.t) !== null) return e.t as number;
    const a = anclas.get(e.sesion);
    return a !== null && a !== undefined && num(e.tau) !== null ? a + (e.tau as number) : null;
  };
  for (const s of nombres) {
    const l = porSesion.get(s)!.sort((a, b) => a.seq - b.seq);
    const muestras = l.filter((e) => e.tipo === 'sincronizacion').map((e) => ({ envio_local: num(e.datos?.envio_tau), servidor: num(e.datos?.servidor), recibo_local: num(e.datos?.recibo_tau) }))
      .filter((x): x is { envio_local: number; servidor: number; recibo_local: number } => x.envio_local !== null && x.servidor !== null && x.recibo_local !== null);
    const sync = estimarDesfase(muestras);
    const conRecepcion = l.filter((e) => num(e.tau) !== null && num(e.recibido) !== null);
    let ancla: number | null = null, tipo: InfoSesion['ancla_tipo'], inc: number | null = null;
    if (sync) { ancla = sync.desfase; inc = sync.incertidumbre; tipo = 'sincronizacion'; }
    else if (conRecepcion.length) { ancla = Math.min(...conRecepcion.map((e) => (e.recibido as number) - (e.tau as number))); tipo = 'cota_recepcion'; }
    else if (l.every((e) => num(e.t) !== null)) tipo = 'absoluta';
    else tipo = 'invalida';
    anclas.set(s, ancla);
    let retrocede = 0;
    for (let i = 1; i < l.length; i++) if (num(l[i].tau) !== null && num(l[i - 1].tau) !== null && (l[i].tau as number) < (l[i - 1].tau as number)) retrocede++;
    let huecos = 0;
    if (l[0]?.fuente === 'cliente') {
      huecos = Math.max(0, l[0].seq - 1);
      for (let i = 1; i < l.length; i++) huecos += Math.max(0, l[i].seq - l[i - 1].seq - 1);
    }
    const retrasos = l.map((e) => { const t = tiempo(e); return t !== null && num(e.recibido) !== null ? (e.recibido as number) - t : null; }).filter((x): x is number => x !== null);
    const ts = l.map(tiempo).filter((x): x is number => x !== null);
    sesiones.push({
      sesion: s, eventos: l.length, ancla, ancla_tipo: tipo, incertidumbre_ms: inc,
      cobertura: ts.length ? { inicio: Math.min(...ts), fin: Math.max(...ts) } : null,
      huecos_secuencia: huecos, duplicados: duplicados.get(s) ?? 0,
      muy_retrasados: retrasos.filter((d) => d > P.retraso_alto_ms).length, retraso_max_ms: retrasos.length ? Math.max(...retrasos) : null,
      reloj_retrocede: retrocede,
      pestana: typeof l.find((e) => e.tipo === 'sesion_inicio')?.datos?.pestana === 'string' ? (l.find((e) => e.tipo === 'sesion_inicio')!.datos!.pestana as string) : null,
    });
    if (tipo === 'invalida') adv.push(`Sesión ${s.slice(0, 8)}: sin referencia temporal válida; sus eventos no se sitúan en el tiempo.`);
    if (retrocede) adv.push(`Sesión ${s.slice(0, 8)}: el reloj monotónico retrocede ${retrocede} vez/veces (dato temporal inválido en esos tramos).`);
  }

  // continuidad entre sesiones consecutivas del navegador (no se fusionan)
  const delCliente = sesiones.filter((s) => s.cobertura && porSesion.get(s.sesion)![0].fuente !== 'servidor')
    .sort((a, b) => a.cobertura!.inicio - b.cobertura!.inicio || comparar(a.sesion, b.sesion));
  const continuidades: Continuidad[] = [];
  for (let i = 1; i < delCliente.length; i++) {
    const x = delCliente[i - 1], y = delCliente[i];
    const hueco = y.cobertura!.inicio - x.cobertura!.fin;
    const tipo: Continuidad['tipo'] = hueco < 0 ? 'simultaneas' : x.pestana && y.pestana ? (x.pestana === y.pestana ? 'misma_pestana' : 'otra_pestana') : 'desconocida';
    continuidades.push({ de: x.sesion, a: y.sesion, hueco_ms: hueco, tipo });
  }

  // 3 · máquina de estados por sesión (los hechos del servidor se tratan aparte)
  const segmentos: Segmento[] = [];
  const pausaServidor: Iv[] = [];
  const servidor = evs.filter((e) => e.fuente === 'servidor').map((e) => ({ e, t: tiempo(e) })).filter((x) => x.t !== null)
    .sort((a, b) => (a.t as number) - (b.t as number) || a.e.seq - b.e.seq);
  for (let i = 0; i < servidor.length; i++) {
    if (servidor[i].e.tipo !== 'pausa_inicio') continue;
    const fin = servidor.slice(i + 1).find((x) => x.e.tipo === 'pausa_fin' || x.e.tipo === 'entrega');
    pausaServidor.push({ inicio: servidor[i].t as number, fin: fin ? (fin.t as number) : entrada.intento.fin ?? Infinity });
  }
  let sinTiempo = 0;
  for (const s of nombres) {
    const l = porSesion.get(s)!.filter((e) => e.fuente !== 'servidor');
    if (!l.length) continue;
    const ordenados = l.map((e) => ({ e, t: tiempo(e) })).filter((x) => { if (x.t === null) { sinTiempo++; return false; } return true; })
      .sort((a, b) => (a.t as number) - (b.t as number) || a.e.seq - b.e.seq);
    if (!ordenados.length) continue;
    const ini = ordenados.find((x) => x.e.tipo === 'sesion_inicio');
    const visIni = ini?.e.datos?.visible;
    if (ini && typeof visIni !== 'boolean' && l[0].fuente === 'cliente') adv.push(`Sesión ${s.slice(0, 8)}: visibilidad inicial no registrada; se supone visible.`);
    let est: Estado = {
      vis: visIni === false ? 'oculta' : 'visible', foco: 'desconocido', red: ini?.e.datos?.en_linea === false ? 'no' : 'si',
      inact: false, pausa: false, activa: entrada.atribucion === 'unica' ? preguntas[0] ?? null : null, expuestas: [], desconocido: false,
    };
    const propios: Segmento[] = [];
    let prev: number | null = null;
    const vida = P.inactividad_ms + P.margen_vida_ms;
    for (const { e, t } of ordenados) {
      const tt = t as number;
      if (prev !== null && tt > prev) {
        const silencio = tt - prev;
        const debeHablar = e.fuente === 'cliente' && est.vis === 'visible' && !est.inact && !est.pausa && !est.desconocido;
        if (debeHablar && silencio > vida) {
          propios.push({ inicio: prev, fin: prev + vida, sesion: s, e: { ...est } });
          propios.push({ inicio: prev + vida, fin: tt, sesion: s, e: { ...est, desconocido: true } });
        } else propios.push({ inicio: prev, fin: tt, sesion: s, e: { ...est } });
      }
      const d = e.datos ?? {};
      switch (e.tipo) {
        case 'visible': est = { ...est, vis: 'visible' }; break;
        case 'oculta': est = { ...est, vis: 'oculta' }; break;
        case 'foco_ganado': est = { ...est, foco: 'si' }; break;
        case 'foco_perdido': est = { ...est, foco: 'no' }; break;
        case 'conexion_perdida': est = { ...est, red: 'no' }; break;
        case 'conexion_restaurada': est = { ...est, red: 'si' }; break;
        case 'inactividad_inicio': {
          // la inactividad empieza, por definición, θ después de la última interacción
          const desde = num(d.desde_tau);
          const a = anclas.get(s);
          const tIdle = desde !== null && a !== null && a !== undefined ? a + desde + P.inactividad_ms : tt;
          if (tIdle < tt) marcarInactividad(propios, tIdle, tt);
          est = { ...est, inact: true };
          break;
        }
        case 'inactividad_fin': est = { ...est, inact: false }; break;
        case 'exposicion_inicio': if (e.pregunta && !est.expuestas.includes(e.pregunta)) est = { ...est, expuestas: [...est.expuestas, e.pregunta].sort(comparar) }; break;
        case 'exposicion_fin': if (e.pregunta) est = { ...est, expuestas: est.expuestas.filter((q) => q !== e.pregunta) }; break;
        case 'pregunta_activada': est = { ...est, activa: e.pregunta ?? null }; break;
        case 'pregunta_desactivada': if (est.activa === e.pregunta) est = { ...est, activa: null }; break;
        case 'pausa_inicio': est = { ...est, pausa: true }; break;
        case 'pausa_fin': est = { ...est, pausa: false }; break;
        case 'interaccion': case 'edicion': case 'comprobacion': case 'guardado_solicitado':
          if (est.inact) est = { ...est, inact: false };   // una interacción termina la inactividad
          break;
        case 'estado':
          est = {
            vis: d.vis === 'oculta' ? 'oculta' : d.vis === 'desconocida' ? 'desconocida' : 'visible', foco: est.foco,
            red: d.sin_red === true ? 'no' : 'si', inact: d.inact === true, pausa: d.pausa === true,
            activa: typeof d.activa === 'string' ? d.activa : null, expuestas: typeof d.activa === 'string' ? [d.activa] : [], desconocido: d.desconocido === true,
          };
          break;
        default: break;
      }
      if (e.tipo === 'sesion_fin') { prev = null; continue; }   // lo que siga hasta el próximo evento no se observó
      prev = tt;
    }
    segmentos.push(...propios);
  }
  if (sinTiempo) adv.push(`${sinTiempo} evento(s) sin referencia temporal: no se usan en la cronología.`);

  // 4 · dominio del intento
  const ultimo = segmentos.reduce((x, g) => Math.max(x, g.fin), entrada.intento.inicio);
  const dominio = { inicio: entrada.intento.inicio, fin: entrada.intento.fin ?? Math.max(ultimo, entrada.intento.inicio) };
  if (segmentos.some((g) => g.inicio < dominio.inicio - 5000)) adv.push('Hay observaciones anteriores al inicio del intento registrado por el servidor; se recortan.');
  if (entrada.intento.fin !== null && segmentos.some((g) => g.fin > dominio.fin + 5000)) adv.push('Hay observaciones posteriores a la entrega; se recortan.');
  const D: Iv = { inicio: dominio.inicio, fin: dominio.fin };
  const recortados = segmentos.map((g) => ({ ...g, inicio: Math.max(g.inicio, D.inicio), fin: Math.min(g.fin, D.fin) })).filter((g) => g.fin > g.inicio);
  const sel = (f: (e: Estado) => boolean) => union(recortados.filter((g) => f(g.e)));

  // 5 · capas y partición
  const coberturas = nombres.map((s) => normalizar(recortados.filter((g) => g.sesion === s)));
  const cubierto = union(...coberturas);
  const particion = particionar<Categoria>(D, [
    { cat: 'sin_observacion', ivs: diferencia([D], cubierto) },
    { cat: 'conflicto', ivs: solapes(coberturas.flat()) },
    { cat: 'desconocido', ivs: sel((e) => e.desconocido || e.vis === 'desconocida') },
    { cat: 'pausa_declarada', ivs: union(sel((e) => e.pausa), interseccion(pausaServidor, cubierto)) },
    { cat: 'oculta', ivs: sel((e) => e.vis === 'oculta') },
    { cat: 'inactiva', ivs: sel((e) => e.inact) },
    { cat: 'sin_foco', ivs: sel((e) => e.foco === 'no') },
  ], 'observable_activo');
  const totales = Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<Categoria, number>;
  for (const p of particion) totales[p.cat] += p.fin - p.inicio;
  const deCat = (...cs: Categoria[]) => normalizar(particion.filter((p) => cs.includes(p.cat)));
  const sinRed = interseccion(sel((e) => e.red === 'no'), cubierto);
  const visibles = deCat('observable_activo', 'inactiva', 'sin_foco');
  const observados = deCat('observable_activo', 'inactiva', 'sin_foco', 'oculta', 'pausa_declarada');

  // 6 · métricas por pregunta
  const ordenGlobal = [...recortados].sort((a, b) => a.inicio - b.inicio || comparar(a.sesion, b.sesion));
  const evsT = evs.map((e) => ({ e, t: tiempo(e) })).filter((x) => x.t !== null) as { e: EventoNorm; t: number }[];
  const ambigua = entrada.atribucion === 'ambigua';
  const resultados: ResultadoPregunta[] = preguntas.map((q) => {
    const a: string[] = [];
    const propios = evsT.filter((x) => x.e.pregunta === q).sort((x, y) => x.t - y.t || x.e.seq - y.e.seq);
    const exposicion = interseccion(sel((e) => e.expuestas.includes(q)), visibles);
    const activa = sel((e) => e.activa === q);
    const foco = interseccion(activa, deCat('observable_activo', 'inactiva'));
    const inactQ = interseccion(activa, deCat('inactiva'));
    // una edición es una ráfaga [inicio_tau, fin_tau]; el evento puede emitirse más tarde (al cerrar la ráfaga)
    const enTau = (x: { e: EventoNorm; t: number }, k: 'inicio_tau' | 'fin_tau') => {
      const v = num(x.e.datos?.[k]), an = anclas.get(x.e.sesion);
      return v !== null && an !== null && an !== undefined ? an + v : null;
    };
    const inicioEdicion = (x: { e: EventoNorm; t: number }) => enTau(x, 'inicio_tau') ?? x.t;
    const finEdicion = (x: { e: EventoNorm; t: number }) => Math.max(inicioEdicion(x), enTau(x, 'fin_tau') ?? x.t);
    const ediciones = propios.filter((x) => x.e.tipo === 'edicion').sort((x, y) => finEdicion(x) - finEdicion(y) || x.e.seq - y.e.seq);
    const edicionIvs = normalizar(ediciones.map((x) => ({ inicio: inicioEdicion(x), fin: finEdicion(x) })));
    const ventanas = normalizar([
      ...propios.filter((x) => ['interaccion', 'comprobacion', 'guardado_solicitado'].includes(x.e.tipo)).map((x) => ({ inicio: x.t, fin: x.t + P.ventana_interaccion_ms })),
      ...ediciones.map((x) => ({ inicio: inicioEdicion(x), fin: finEdicion(x) + P.ventana_interaccion_ms })),
    ]);
    const interaccion = interseccion(ventanas, ambigua ? visibles : interseccion(visibles, activa.length ? activa : visibles));
    const primeraExp = exposicion[0]?.inicio ?? null;
    const primeraAct = activa[0]?.inicio ?? null;
    const primeraResp = ediciones.find((x) => x.e.datos?.vacia === false);
    const tPrimeraResp = primeraResp ? inicioEdicion(primeraResp) : null;
    const extremos = [...exposicion, ...activa, ...ventanas].filter((x) => x.fin > x.inicio);
    const wIni = extremos.length ? Math.min(...extremos.map((x) => x.inicio)) : null;
    const wFin = extremos.length ? Math.min(D.fin, Math.max(...extremos.map((x) => x.fin))) : null;
    // visitas: con pregunta activa conocida, cada vez que la pregunta activa pasa a ser q
    let visitas: Metrica;
    if (!ambigua) {
      // las pausas y ocultamientos conservan la pregunta activa: no cuentan como visita nueva; la pantalla de revisión sí
      let n = 0, ultima: string | null | undefined;
      for (const g of ordenGlobal) { if (g.e.activa === q && ultima !== q) n++; ultima = g.e.activa; }
      visitas = m(n, 'reconstruido');
    } else {
      const n = propios.filter((x) => x.e.tipo === 'exposicion_inicio').length;
      visitas = m(n, 'estimado', 'Apariciones en pantalla (varias preguntas visibles a la vez), no visitas a una pregunta activa.');
    }
    // calidad
    const ventana = wIni !== null && wFin !== null && wFin > wIni ? [{ inicio: wIni, fin: wFin }] : [];
    const cobertura = ventana.length ? medida(interseccion(ventana, observados)) / medida(ventana) : null;
    const temporal: NivelCalidad = cobertura === null ? 'sin_datos' : cobertura >= 0.95 ? 'buena' : cobertura >= 0.7 ? 'parcial' : 'baja';
    const sesionesQ = new Set(propios.map((x) => x.e.sesion));
    const perdidas = sesiones.some((s) => sesionesQ.has(s.sesion) && s.huecos_secuencia > 0);
    const confirmaciones = propios.filter((x) => x.e.tipo === 'guardado_confirmado' || (x.e.tipo === 'comprobacion' && x.e.datos?.fase === 'recibida'));
    const fallidos = propios.filter((x) => x.e.tipo === 'guardado_fallido').length;
    const ultEd = ediciones[ediciones.length - 1];
    let respuesta: CalidadPregunta['respuesta'] = 'sin_datos';
    if (ultEd) {
      if (ultEd.e.datos?.vacia === true) respuesta = 'sin_respuesta';
      else respuesta = confirmaciones.some((c) => c.t >= finEdicion(ultEd)) ? 'confirmada' : 'escrito_sin_confirmar';
    } else if (confirmaciones.length) respuesta = 'confirmada';
    if (respuesta === 'escrito_sin_confirmar') a.push('La última respuesta escrita no tiene un guardado confirmado posterior: puede haberse quedado solo en el dispositivo.');
    if (fallidos) a.push(`${fallidos} guardado(s) fallido(s).`);
    if (entrada.origen === 'v1' && ambigua) a.push('Datos V1 de práctica: la exposición en pantalla es poco fiable y el tiempo no se puede atribuir a una sola pregunta.');
    const tUntil: Metrica = tPrimeraResp === null ? m(null, 'informacion_insuficiente', 'Sin primera respuesta registrada.')
      : (primeraAct ?? primeraExp) === null ? m(null, 'no_identificable', 'No consta cuándo se presentó la pregunta.')
        : tPrimeraResp - (primeraAct ?? primeraExp)! < -P.tolerancia_ms ? m(null, 'dato_temporal_invalido', 'La primera respuesta es anterior a la primera presentación registrada.')
          : m(Math.max(0, tPrimeraResp - (primeraAct ?? primeraExp)!), 'reconstruido');
    return {
      pregunta: q,
      T_wall: wIni === null ? m(null, 'informacion_insuficiente') : m((wFin as number) - wIni, 'reconstruido'),
      T_exposure: entrada.origen === 'v1' ? m(medida(exposicion), 'estimado', 'Observador de visibilidad V1: poco fiable.') : m(medida(exposicion), 'reconstruido'),
      T_focus: ambigua ? m(null, 'no_identificable', 'Varias preguntas en pantalla y ninguna activa registrada.') : m(medida(foco), 'reconstruido'),
      T_interaction: m(medida(interaccion), 'estimado', `Cada interacción cuenta ${P.ventana_interaccion_ms / 1000} s.`),
      T_edit: m(medida(edicionIvs), 'observado'),
      T_candidate_work: ambigua ? m(null, 'no_identificable') : m(medida(diferencia(foco, inactQ)), 'estimado', 'Estimación operativa; no es tiempo cognitivo.'),
      T_until_first_response: tUntil,
      visitas,
      ediciones: ediciones.length,
      borrados: ediciones.filter((x) => x.e.datos?.borrado === true).length,
      primera_exposicion: primeraExp, primera_activacion: primeraAct, primera_respuesta: tPrimeraResp,
      ultimo_guardado_confirmado: confirmaciones.length ? confirmaciones[confirmaciones.length - 1].t : null,
      calidad: {
        temporal, cobertura, atribucion: entrada.atribucion, completitud: propios.length ? (perdidas ? 'con_perdidas' : 'completa') : 'sin_datos',
        respuesta, sincronizacion: { guardados_ok: confirmaciones.length, guardados_fallidos: fallidos },
      },
      advertencias: a,
    };
  });

  // 7 · invariantes
  const inv: string[] = esParticion(particion, D, P.tolerancia_ms).map((x) => `partición: ${x}`);
  const T_wall = D.fin - D.inicio;
  const suma = Object.values(totales).reduce((x, y) => x + y, 0);
  if (Math.abs(suma - T_wall) > P.tolerancia_ms) inv.push(`la suma de categorías (${suma}) difiere de T_wall (${T_wall})`);
  const sumaFoco = resultados.reduce((x, r) => x + (r.T_focus.valor ?? 0), 0);
  if (sumaFoco > totales.observable_activo + totales.inactiva + P.tolerancia_ms) inv.push('la suma del foco por pregunta supera el tiempo observable');
  if (T_wall < 0) inv.push('el intento termina antes de empezar');
  for (let i = 1; i < servidor.length; i++) if ((servidor[i].t as number) < (servidor[i - 1].t as number)) inv.push('la hora del servidor retrocede');

  const eventos: EventoReconstruido[] = evs.map((e) => {
    const t = tiempo(e);
    return {
      sesion: e.sesion, seq: e.seq, tipo: e.tipo, fuente: e.fuente, pregunta: e.pregunta ?? null, t, tau: num(e.tau), recibido: num(e.recibido),
      retraso_ms: t !== null && num(e.recibido) !== null ? (e.recibido as number) - t : null, ...(e.ref ? { ref: e.ref } : {}),
    };
  }).sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity) || comparar(a.sesion, b.sesion) || a.seq - b.seq);

  return {
    version: VERSION_MOTOR, parametros: P, origen: entrada.origen, modalidad: entrada.modalidad, dominio, T_wall,
    particion, totales,
    T_disconnected: m(medida(sinRed), 'reconstruido'),
    sin_red: sinRed,
    sesiones, continuidades, preguntas: resultados, eventos, invariantes: inv, advertencias: adv,
  };
}

/** Marca como inactivos, desde tIdle, los segmentos de la sesión que ya se cerraron (la inactividad se detecta tarde). */
function marcarInactividad(segs: Segmento[], desde: number, hasta: number) {
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i];
    if (g.fin <= desde || g.inicio >= hasta || g.e.inact || g.e.vis !== 'visible') continue;
    if (g.inicio < desde) {
      segs.splice(i, 1, { ...g, fin: desde }, { ...g, inicio: desde, e: { ...g.e, inact: true } });
      i++;
    } else segs[i] = { ...g, e: { ...g.e, inact: true } };
  }
}
