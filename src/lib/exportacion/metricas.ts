/**
 * Centro de Datos · tablas DERIVADAS a partir de los datos originales exportados (nunca los sustituyen).
 * La cronología usa exactamente el mismo modelo que LIEIA (reconstruir(), src/lib/lieia/proceso.ts): cada sesión
 * se ancla al reloj del servidor con mín(recepción − t_ms). Se distingue página oculta, inactividad y sin conexión,
 * que pueden superponerse; la falta de eventos no se trata como inactividad por sí sola.
 */
import { reconstruir, type EventoCrudo, type ProcesoIntento } from '../lieia/proceso';
import type { Fila } from './formato';
import { conciliar, intervalosDePregunta, resumirTiempos, type EventoServidor } from '../examen/intervalos';
import type { Tramo } from '../examen/motor';
import { reconstruirTiempo } from '../lieia/d6';
import { compararRespuestas, reflexionPresentada, type Paso } from '../asistida';

const seg = (iso: unknown) => (typeof iso === 'string' && iso ? Date.parse(iso) / 1000 : null);
const iso = (s: number | null) => (s === null || !Number.isFinite(s) ? null : new Date(s * 1000).toISOString());
const r3 = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const num = (x: unknown) => (typeof x === 'number' ? x : typeof x === 'string' && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null);
const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const agrupar = (filas: Fila[], k: string) => {
  const m = new Map<string, Fila[]>();
  for (const f of filas) {
    const v = f[k];
    if (typeof v !== 'string') continue;
    const xs = m.get(v);
    if (xs) xs.push(f); else m.set(v, [f]);
  }
  return m;
};

export interface Derivados { [tabla: string]: Fila[] }

/** Columnas fijas de cada tabla derivada (también cuando no tiene filas: el encabezado nunca falta). */
export const COLUMNAS_DERIVADAS: Record<string, string[]> = {
  eventos_normalizados: ['id', 'attempt_id', 'user_id', 'session_id', 'seq', 'kind', 'exercise_id', 't_ms', 'client_wall', 'received_at', 'ancla_sesion_utc',
    't_alineado_utc', 't_intento_s', 'retraso_recepcion_s', 'tardio', 'hueco_previo', 'llego_desordenado', 'datos'],
  sesiones_telemetria: ['attempt_id', 'session_id', 'user_id', 'eventos', 'seq_min', 'seq_max', 'perdidos', 'ancla_sesion_utc', 'primera_recepcion_utc',
    'ultima_recepcion_utc', 'navegacion', 'pestana', 'tardios', 'retraso_max_s'],
  intervalos_estado: ['attempt_id', 'user_id', 'n', 'tipo', 'desde_s', 'hasta_s', 'duracion_s'],
  modificaciones: ['fuente', 'id_origen', 'attempt_id', 'user_id', 'exercise_id', 'momento_utc', 't_intento_s', 'tipo', 'longitud', 'delta', 'duracion_rafaga_ms',
    'huella', 'resultado', 'codigo_error'],
  calidad_datos: ['attempt_id', 'user_id', 'telemetria', 'eventos', 'sesiones', 'perdidos', 'tardios', 'recargas', 'desfase_reloj_s', 'huecos_conexion', 'error_reconstruccion'],
  metricas_pregunta: ['attempt_id', 'user_id', 'activity_id', 'lesson_id', 'course_id', 'attempt_number', 'mode', 'exercise_id', 'posicion', 'telemetria',
    'primera_vista_s', 'vistas', 'revisitas', 'primera_interaccion_s', 'primera_respuesta_s', 'latencia_s', 'tiempo_edicion_s', 'ultima_edicion_s',
    'persistencia_s', 'activo_s', 'cambios', 'borrados', 'apariciones_de_golpe', 'sin_guardar', 'cambios_guardados', 'comprobaciones', 'estado',
    'credito_automatico', 'credito_manual', 'puntos', 'intentos_respuesta', 'pistas', 'vio_solucion', 'correcta_primer_intento', 'codigo_motor', 'respondida'],
  metricas_intento: ['attempt_id', 'user_id', 'course_id', 'activity_id', 'lesson_id', 'mode', 'status', 'attempt_number', 'started_at', 'submitted_at',
    'duracion_s', 'score', 'max_score', 'porcentaje', 'preguntas', 'respondidas', 'correctas', 'telemetria', 'eventos', 'cronologico_s', 'activo_s',
    'oculto_s', 'inactivo_s', 'sin_conexion_s', 'espera_final_s', 'espera_final_inactiva_s', 'sesiones', 'perdidos', 'tardios', 'recargas'],
  metricas_estudiante: ['user_id', 'intentos', 'entregados', 'evaluaciones', 'respuestas', 'correctas', 'credito_medio', 'estudio_efectivo_s', 'visitas',
    'dias_activos', 'eventos_telemetria', 'intentos_con_telemetria'],
  resumen_colectivo: ['clave_grupo', 'activity_id', 'lesson_id', 'mode', 'estudiantes', 'intentos', 'entregados', 'porcentaje_medio', 'porcentaje_mediana',
    'duracion_mediana_s', 'intentos_con_telemetria', 'eventos_telemetria'],
  tiempos_examen: ['attempt_id', 'user_id', 'exercise_id', 'posicion', 'trabajo_s', 'inactividad_s', 'pausa_s', 'oculta_s', 'desconexion_s', 'desconocido_s',
    'visitas', 'tiempo_observable_s', 'estado_tiempo', 'discrepancias_intento', 'prorroga_s'],
  aprendizaje_asistido: ['attempt_id', 'user_id', 'activity_id', 'exercise_id', 'inicial_respuesta', 'inicial_no_se', 'declaracion', 'inicial_estado', 'inicial_momento_utc',
    'correcciones', 'final_respuesta', 'final_estado', 'final_credito', 'cambio', 'procedimiento_cambio', 'reflexion_presentada', 'fuentes',
    'transferencia_ejercicio', 'transferencia_estado', 'transferencia_credito', 'fase_alcanzada'],
};

/** Práctica asistida: una fila por intento y ejercicio con el proceso INTENTA → CORRIGE → EXPLICA → DEMUESTRA. */
function aprendizajeAsistido(d: Record<string, Fila[]>): Fila[] {
  const formato = new Map((d.ejercicios ?? []).map((e) => [String(e.id), String(e.format ?? '')]));
  const intento = new Map((d.intentos ?? []).map((a) => [String(a.id), a]));
  const grupos = new Map<string, Fila[]>();
  for (const p of d.asistida_pasos ?? []) {
    const k = `${p.attempt_id}|${p.exercise_id}`;
    const xs = grupos.get(k);
    if (xs) xs.push(p); else grupos.set(k, [p]);
  }
  const aPaso = (f: Fila | undefined): Paso | null => (f ? {
    fase: f.fase as Paso['fase'], version: num(f.version) ?? 1, answer: (f.answer as Paso['answer']) ?? null, procedimiento: (f.procedimiento as string) ?? null,
    explicacion: (f.explicacion as string) ?? null, no_se: f.no_se === true, declaracion: (f.declaracion as Paso['declaracion']) ?? null,
    fuentes: (f.fuentes as Paso['fuentes']) ?? null, reflexion: (f.reflexion as Paso['reflexion']) ?? null, referencias: null,
    status: (f.status as string) ?? null, credit: num(f.credit), messages: null, created_at: String(f.created_at ?? ''),
  } : null);
  const ult = (xs: Fila[], fase: string) => xs.filter((x) => x.fase === fase).sort((a, b) => (num(b.version) ?? 0) - (num(a.version) ?? 0))[0];
  const texto = (p: Paso | null) => {
    if (!p) return null;
    if (p.no_se) return null;
    const a = p.answer ?? {};
    return a.selected?.length ? a.selected.join(',') : typeof a.value === 'boolean' ? String(a.value) : (a.text ?? null);
  };
  return [...grupos.entries()].map(([k, xs]) => {
    const [aid, ex] = k.split('|');
    const ini = aPaso(ult(xs, 'inicial')), fin = aPaso(ult(xs, 'corregida')), ref = aPaso(ult(xs, 'reflexion')), trF = ult(xs, 'transferencia'), tra = aPaso(trF);
    const c = compararRespuestas(formato.get(ex) ?? '', ini, fin);
    return {
      attempt_id: aid, user_id: xs[0].user_id ?? null, activity_id: intento.get(aid)?.activity_id ?? null, exercise_id: ex,
      inicial_respuesta: texto(ini), inicial_no_se: ini?.no_se ?? null, declaracion: ini?.declaracion ?? null, inicial_estado: ini?.status ?? null,
      inicial_momento_utc: ini?.created_at || null,
      correcciones: xs.filter((x) => x.fase === 'corregida').length, final_respuesta: texto(fin), final_estado: fin?.status ?? null, final_credito: fin?.credit ?? null,
      cambio: fin ? c.cambio : null, procedimiento_cambio: fin ? c.procedimientoCambio : null,
      reflexion_presentada: reflexionPresentada(ref?.reflexion), fuentes: ref?.fuentes?.join(',') ?? null,
      transferencia_ejercicio: (trF?.transfer_exercise_id as string) ?? null, transferencia_estado: tra?.status ?? null, transferencia_credito: tra?.credit ?? null,
      fase_alcanzada: tra ? 'transferencia' : ref ? 'reflexion' : fin ? 'corregida' : 'inicial',
    };
  });
}

/** Tiempos del motor de examen por intento y pregunta: diario de tramos conciliado con los eventos oficiales. */
function tiemposExamen(d: Record<string, Fila[]>): Fila[] {
  const ms = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : typeof v === 'number' ? v : NaN);
  const tramosPorIntento = agrupar(d.examen_tramos ?? [], 'attempt_id');
  const eventosPorIntento = agrupar(d.examen_eventos ?? [], 'attempt_id');
  const sesion = new Map((d.examen_sesiones ?? []).map((s) => [String(s.attempt_id), s]));
  const ordenPorIntento = agrupar(d.orden_items ?? [], 'attempt_id');
  const intento = new Map((d.intentos ?? []).map((a) => [String(a.id), a]));
  const itemsPorAct = agrupar(d.actividad_items ?? [], 'activity_id');
  const out: Fila[] = [];
  for (const [aid, filas] of tramosPorIntento) {
    const tramos: Tramo[] = filas.map((f) => ({ inicio: ms(f.inicio), fin: ms(f.fin), tipo: f.tipo as Tramo['tipo'], exercise_id: (f.exercise_id as string | null) ?? null }))
      .filter((t) => Number.isFinite(t.inicio) && Number.isFinite(t.fin));
    const eventos: EventoServidor[] = (eventosPorIntento.get(aid) ?? []).filter((e) => ['apertura', 'ir_a', 'pausa', 'reanudacion', 'entrega'].includes(String(e.tipo)))
      .map((e) => ({ t: ms(e.t), tipo: e.tipo as EventoServidor['tipo'], exercise_id: (e.exercise_id as string | null) ?? null }));
    const c = conciliar(tramos, eventos);
    const r = resumirTiempos(c.tramos);
    const a = intento.get(aid);
    const orden = ordenPorIntento.get(aid)?.length ? [...ordenPorIntento.get(aid)!].sort((x, y) => (num(x.position) ?? 0) - (num(y.position) ?? 0)).map((x) => String(x.exercise_id))
      : a?.activity_id ? [...(itemsPorAct.get(String(a.activity_id)) ?? [])].sort((x, y) => (num(x.position) ?? 0) - (num(y.position) ?? 0)).map((x) => String(x.exercise_id))
      : Object.keys(r.por_pregunta);
    const s = (x: number | undefined) => r3((x ?? 0) / 1000);
    orden.forEach((q, k) => {
      const t = r.por_pregunta[q];
      const rec = reconstruirTiempo(intervalosDePregunta(c.tramos, q));
      out.push({
        attempt_id: aid, user_id: filas[0].user_id ?? null, exercise_id: q, posicion: k + 1,
        trabajo_s: s(t?.trabajo), inactividad_s: s(t?.inactividad), pausa_s: s(t?.pausa_declarada), oculta_s: s(t?.oculta), desconexion_s: s(t?.desconexion), desconocido_s: s(t?.desconocido),
        visitas: r.visitas[q] ?? 0, tiempo_observable_s: rec.t === null ? null : r3(rec.t), estado_tiempo: rec.estado,
        discrepancias_intento: c.discrepancias.length, prorroga_s: num(sesion.get(aid)?.extra_s) ?? 0,
      });
    });
  }
  return out;
}

/** Orden de las preguntas de un intento: el presentado (si se barajó), el de la actividad, o el de aparición. */
function itemsDelIntento(a: Fila, orden: Fila[] | undefined, itemsAct: Fila[] | undefined, resp: Fila[] | undefined, tel: Fila[] | undefined): string[] {
  const porPos = (xs: Fila[]) => [...xs].sort((x, y) => (num(x.position) ?? 0) - (num(y.position) ?? 0)).map((x) => String(x.exercise_id));
  if (orden?.length) return porPos(orden);
  if (a.activity_id && itemsAct?.length) return porPos(itemsAct);
  const vistos: string[] = [];
  for (const f of [...(resp ?? []), ...(tel ?? [])]) if (typeof f.exercise_id === 'string' && !vistos.includes(f.exercise_id)) vistos.push(f.exercise_id);
  return vistos;
}

export function calcularDerivados(d: Record<string, Fila[]>): Derivados {
  const intentos = d.intentos ?? [];
  const telPorIntento = agrupar(d.telemetria ?? [], 'attempt_id');
  const respPorIntento = agrupar(d.respuestas ?? [], 'attempt_id');
  const ordenPorIntento = agrupar(d.orden_items ?? [], 'attempt_id');
  const itemsPorAct = agrupar(d.actividad_items ?? [], 'activity_id');
  const preguntaPorIntento = agrupar(d.eventos_pregunta ?? [], 'attempt_id');
  const eventosRespPorResp = agrupar(d.eventos_respuesta ?? [], 'response_id');

  const eventos_normalizados: Fila[] = [];
  const sesiones_telemetria: Fila[] = [];
  const intervalos_estado: Fila[] = [];
  const modificaciones: Fila[] = [];
  const calidad_datos: Fila[] = [];
  const metricas_pregunta: Fila[] = [];
  const metricas_intento: Fila[] = [];

  for (const a of intentos) {
    const id = String(a.id);
    const inicio = seg(a.started_at);
    const entrega = seg(a.submitted_at);
    const tel = telPorIntento.get(id) ?? [];
    const resp = respPorIntento.get(id) ?? [];
    const items = itemsDelIntento(a, ordenPorIntento.get(id), a.activity_id ? itemsPorAct.get(String(a.activity_id)) : undefined, resp, tel);

    // --- normalización evento a evento (los originales quedan intactos en «telemetria») ---
    const ancla = new Map<string, number>();
    const porSesion = agrupar(tel, 'session_id');
    const normalizadosIntento: Fila[] = [];
    for (const [s, xs] of porSesion) {
      let m = Infinity;
      for (const e of xs) { const r = seg(e.received_at); const t = num(e.t_ms); if (r !== null && t !== null) m = Math.min(m, r - t / 1000); }
      ancla.set(s, m);
      const ordenados = [...xs].sort((x, y) => (num(x.seq) ?? 0) - (num(y.seq) ?? 0));
      let maxRecibido = -Infinity, prevSeq = 0;
      let tardios = 0, retrasoMax = 0;
      for (const e of ordenados) {
        const t = num(e.t_ms) ?? 0, r = seg(e.received_at) ?? 0, q = num(e.seq) ?? 0;
        const al = m + t / 1000;
        const retraso = r - al;
        if (retraso > 30) tardios++;
        retrasoMax = Math.max(retrasoMax, retraso);
        const n: Fila = {
          id: e.id, attempt_id: id, user_id: e.user_id, session_id: s, seq: q, kind: e.kind, exercise_id: e.exercise_id ?? null,
          t_ms: t, client_wall: e.client_wall ?? null, received_at: e.received_at, ancla_sesion_utc: iso(m), t_alineado_utc: iso(al),
          t_intento_s: inicio === null ? null : r3(al - inicio), retraso_recepcion_s: r3(retraso), tardio: retraso > 30,
          hueco_previo: Math.max(0, q - prevSeq - 1), llego_desordenado: r < maxRecibido, datos: e.data ?? {},
        };
        eventos_normalizados.push(n);
        normalizadosIntento.push(n);
        maxRecibido = Math.max(maxRecibido, r);
        prevSeq = q;
      }
      const qs = ordenados.map((e) => num(e.seq) ?? 0);
      const inicioSes = ordenados.find((e) => e.kind === 'sesion_inicio');
      const datosIni = (inicioSes?.data ?? {}) as Record<string, unknown>;
      const recep = ordenados.map((e) => seg(e.received_at) ?? 0);
      const minimo = (xs: number[]) => xs.reduce((a, b) => (b < a ? b : a), Infinity);
      const maximo = (xs: number[]) => xs.reduce((a, b) => (b > a ? b : a), -Infinity);
      sesiones_telemetria.push({
        attempt_id: id, session_id: s, user_id: ordenados[0]?.user_id ?? a.user_id, eventos: ordenados.length,
        seq_min: minimo(qs), seq_max: maximo(qs), perdidos: maximo(qs) - new Set(qs).size,
        ancla_sesion_utc: iso(m), primera_recepcion_utc: iso(minimo(recep)), ultima_recepcion_utc: iso(maximo(recep)),
        navegacion: datosIni.navegacion ?? null, pestana: datosIni.pestana ?? null, tardios, retraso_max_s: r3(retrasoMax),
      });
    }

    // --- cronología (mismo modelo que LIEIA) ---
    let p: ProcesoIntento | null = null;
    let error: string | null = null;
    if (tel.length && inicio !== null) {
      try {
        const crudos: EventoCrudo[] = tel.map((e) => ({
          s: String(e.session_id), q: num(e.seq) ?? 0, k: String(e.kind), e: (e.exercise_id as string | null) ?? null,
          t: num(e.t_ms) ?? 0, r: seg(e.received_at) ?? 0, w: seg(e.client_wall), d: (e.data ?? {}) as Record<string, unknown>,
        }));
        p = reconstruir(crudos, inicio, entrega, items);
      } catch (err) {
        error = err instanceof Error ? err.name : 'error';
      }
    }
    p?.intervalos.forEach((iv, n) => intervalos_estado.push({
      attempt_id: id, user_id: a.user_id, n: n + 1, tipo: iv.tipo, desde_s: r3(iv.desde), hasta_s: r3(iv.hasta), duracion_s: r3(iv.hasta - iv.desde),
    }));
    calidad_datos.push({
      attempt_id: id, user_id: a.user_id, telemetria: tel.length > 0, eventos: tel.length, sesiones: porSesion.size,
      perdidos: p?.calidad.perdidos ?? null, tardios: p?.calidad.tardios ?? null, recargas: p?.calidad.recargas ?? null,
      desfase_reloj_s: r3(p?.calidad.desfaseRelojS), huecos_conexion: p?.calidad.huecosConexion ?? null, error_reconstruccion: error,
    });

    // --- modificaciones: tres fuentes, sin mezclarlas ---
    for (const e of normalizadosIntento.filter((x) => x.kind === 'respuesta_cambio' || x.kind === 'borrador_guardado')) {
      const dd = (e.datos ?? {}) as Record<string, unknown>;
      modificaciones.push({
        fuente: 'telemetria', id_origen: e.id, attempt_id: id, user_id: e.user_id, exercise_id: e.exercise_id, momento_utc: e.t_alineado_utc, t_intento_s: e.t_intento_s,
        tipo: e.kind === 'borrador_guardado' ? 'guardado' : dd.borrado ? 'borrado' : 'cambio', longitud: dd.len ?? null, delta: dd.delta ?? null,
        duracion_rafaga_ms: dd.rafaga_ms ?? null, huella: dd.h ?? null, resultado: null, codigo_error: null,
      });
    }
    for (const e of preguntaPorIntento.get(id) ?? []) {
      const t = seg(e.created_at);
      modificaciones.push({
        fuente: 'eventos_pregunta', id_origen: e.id, attempt_id: id, user_id: e.user_id, exercise_id: e.exercise_id, momento_utc: e.created_at,
        t_intento_s: t === null || inicio === null ? null : r3(t - inicio), tipo: e.answer_hash === 'vacia' ? 'vaciada' : 'guardado', longitud: null, delta: null,
        duracion_rafaga_ms: null, huella: e.answer_hash, resultado: null, codigo_error: null,
      });
    }
    for (const r of resp) for (const e of eventosRespPorResp.get(String(r.id)) ?? []) {
      const t = seg(e.created_at);
      const res = (e.result ?? {}) as Record<string, unknown>;
      modificaciones.push({
        fuente: 'eventos_respuesta', id_origen: e.id, attempt_id: id, user_id: e.user_id, exercise_id: r.exercise_id, momento_utc: e.created_at,
        t_intento_s: t === null || inicio === null ? null : r3(t - inicio), tipo: e.kind, longitud: null, delta: null, duracion_rafaga_ms: null, huella: null,
        resultado: res.status ?? null, codigo_error: res.code ?? null,
      });
    }

    // --- por pregunta ---
    const respPorEj = new Map(resp.map((r) => [String(r.exercise_id), r]));
    const cambiosGuardados = agrupar(preguntaPorIntento.get(id) ?? [], 'exercise_id');
    items.forEach((ej, k) => {
      const pi = p?.items.find((x) => x.exercise_id === ej);
      const r = respPorEj.get(ej);
      metricas_pregunta.push({
        attempt_id: id, user_id: a.user_id, activity_id: a.activity_id ?? null, lesson_id: a.lesson_id ?? null, course_id: a.course_id ?? null,
        attempt_number: a.attempt_number ?? null, mode: a.mode ?? null, exercise_id: ej, posicion: k + 1, telemetria: !!pi,
        primera_vista_s: r3(pi?.vista), vistas: pi?.vistas ?? null, revisitas: pi?.revisitas ?? null, primera_interaccion_s: r3(pi?.interaccion),
        primera_respuesta_s: r3(pi?.primeraNoVacia), latencia_s: r3(pi?.latenciaGeneracion), tiempo_edicion_s: r3(pi?.tiempoEdicion),
        ultima_edicion_s: r3(pi?.ultimaEdicion), persistencia_s: r3(pi?.persistencia), activo_s: r3(pi?.activo), cambios: pi?.cambios ?? null,
        borrados: pi?.borrados ?? null, apariciones_de_golpe: pi?.pegados ?? null, sin_guardar: pi?.sinGuardar ?? null,
        cambios_guardados: (cambiosGuardados.get(ej) ?? []).length, comprobaciones: r ? (eventosRespPorResp.get(String(r.id)) ?? []).filter((e) => e.kind === 'check').length : 0,
        estado: r?.status ?? null, credito_automatico: num(r?.auto_credit), credito_manual: num(r?.manual_credit), puntos: num(r?.points),
        intentos_respuesta: num(r?.tries), pistas: num(r?.hints_used), vio_solucion: r?.solution_revealed ?? null,
        correcta_primer_intento: r?.first_try_correct ?? null, codigo_motor: r?.engine_code ?? null, respondida: !!r && r.status !== 'draft',
      });
    });

    metricas_intento.push({
      attempt_id: id, user_id: a.user_id, course_id: a.course_id ?? null, activity_id: a.activity_id ?? null, lesson_id: a.lesson_id ?? null,
      mode: a.mode, status: a.status, attempt_number: a.attempt_number, started_at: a.started_at, submitted_at: a.submitted_at ?? null,
      duracion_s: inicio !== null && entrega !== null ? r3(entrega - inicio) : null, score: num(a.score), max_score: num(a.max_score),
      porcentaje: num(a.max_score) ? r3((100 * (num(a.score) ?? 0)) / (num(a.max_score) as number)) : null, preguntas: items.length,
      respondidas: resp.filter((r) => r.status !== 'draft').length, correctas: resp.filter((r) => r.status === 'correct').length,
      telemetria: !!p, eventos: tel.length, cronologico_s: r3(p?.cronologico), activo_s: r3(p?.activo), oculto_s: r3(p?.oculto),
      inactivo_s: r3(p?.inactivo), sin_conexion_s: r3(p?.sinConexion), espera_final_s: r3(p?.esperaFinal), espera_final_inactiva_s: r3(p?.esperaFinalInactiva),
      sesiones: porSesion.size, perdidos: p?.calidad.perdidos ?? null, tardios: p?.calidad.tardios ?? null, recargas: p?.calidad.recargas ?? null,
    });
  }

  // --- por estudiante ---
  const intentosPorUsuario = agrupar(metricas_intento, 'user_id');
  const respPorUsuario = agrupar(d.respuestas ?? [], 'user_id');
  const visitasPorUsuario = agrupar(d.visitas ?? [], 'user_id');
  const metricas_estudiante: Fila[] = (d.estudiantes ?? []).map((s) => {
    const uid = String(s.id);
    const is = intentosPorUsuario.get(uid) ?? [];
    const rs = respPorUsuario.get(uid) ?? [];
    const vs = visitasPorUsuario.get(uid) ?? [];
    const creditos = rs.map((r) => num(r.manual_credit) ?? num(r.auto_credit)).filter((x): x is number => x !== null);
    return {
      user_id: uid, intentos: is.length, entregados: is.filter((m) => m.status === 'submitted').length, evaluaciones: is.filter((m) => m.mode === 'exam').length,
      respuestas: rs.length, correctas: rs.filter((r) => r.status === 'correct').length,
      credito_medio: creditos.length ? r3(creditos.reduce((a, b) => a + b, 0) / creditos.length) : null,
      estudio_efectivo_s: vs.reduce((a, v) => a + (num(v.effective_seconds) ?? 0), 0), visitas: vs.length,
      dias_activos: new Set(vs.filter((v) => (num(v.effective_seconds) ?? 0) > 0).map((v) => String(v.started_at).slice(0, 10))).size,
      eventos_telemetria: is.reduce((a, m) => a + (m.eventos as number), 0), intentos_con_telemetria: is.filter((m) => m.telemetria).length,
    };
  });

  // --- colectivo ---
  const grupos = new Map<string, Fila[]>();
  for (const m of metricas_intento) {
    const k = m.activity_id ? `actividad:${m.activity_id}` : `practica_libre:${m.lesson_id ?? 'sin_leccion'}`;
    const xs = grupos.get(k);
    if (xs) xs.push(m); else grupos.set(k, [m]);
  }
  const resumen_colectivo: Fila[] = [...grupos.entries()].map(([k, xs]) => {
    const pct = xs.map((m) => m.porcentaje).filter((x): x is number => typeof x === 'number');
    const dur = xs.map((m) => m.duracion_s).filter((x): x is number => typeof x === 'number');
    return {
      clave_grupo: k, activity_id: xs[0].activity_id ?? null, lesson_id: xs[0].lesson_id ?? null, mode: xs[0].mode, estudiantes: new Set(xs.map((m) => m.user_id)).size,
      intentos: xs.length, entregados: xs.filter((m) => m.status === 'submitted').length,
      porcentaje_medio: pct.length ? r3(pct.reduce((a, b) => a + b, 0) / pct.length) : null, porcentaje_mediana: r3(mediana(pct)),
      duracion_mediana_s: r3(mediana(dur)), intentos_con_telemetria: xs.filter((m) => m.telemetria).length,
      eventos_telemetria: xs.reduce((a, m) => a + (m.eventos as number), 0),
    };
  });

  return { eventos_normalizados, sesiones_telemetria, intervalos_estado, modificaciones, calidad_datos, metricas_pregunta, metricas_intento, metricas_estudiante, resumen_colectivo,
    tiempos_examen: tiemposExamen(d), aprendizaje_asistido: aprendizajeAsistido(d) };
}
