/**
 * Evaluación de una pregunta a la vez (motor de examen, etapa 2).
 * Reloj oficial del servidor, una pregunta activa, navegación según la configuración, pausas declaradas, diario de
 * tramos de tiempo, guardado automático con revisiones y recuperación tras cerrar, recargar o perder la red.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { examGoto, examJournal, examPause, examPing, examResume, examSave, type EstadoExamenServidor } from '@/api/examen';
import { submitAttempt } from '@/api/estudiante';
import type { AccionesEjercicio, AttemptItem, AttemptView, StudentAnswer } from '@/api/tipos';
import {
  abrir, anterior as motorAnterior, crearMotor, entregar as motorEntregar, inactividad, irA, irRevision, latido, marcar, pausar, puedeIrA, puedePausar,
  reanudar, red, siguiente as motorSiguiente, visibilidad, type EstadoMotor, type Resultado,
} from '@/lib/examen/motor';
import { estimarDesfase, formatoCuenta, horaLimite, restante, type MuestraReloj } from '@/lib/examen/reloj';
import { almacenLocal, ColaGuardado, ErrorDefinitivo } from '@/lib/examen/guardado';
import { ACCIONES_SERVIDOR, Ejercicio } from '@/components/Ejercicio';
import { Badge, ErrorBox, Modal, Notice } from '@/components/ui';
import { useTelemetria } from '@/components/Telemetria';
import { useModoConcentracion } from '@/components/Layout';

const INACTIVIDAD_MS = 60_000, LATIDO_MS = 5_000, PING_MS = 20_000, DIARIO_MS = 15_000;
const DEFINITIVO = /terminó|entregado|no se puede modificar|no pertenece|inválid|Sin permiso|no encontrado/i;

export const estaRespondida = (it: AttemptItem) => {
  const a = it.response?.answer;
  return !!a && (!!a.text?.trim() || !!a.selected?.length || typeof a.value === 'boolean');
};

interface Persistido { motor: EstadoMotor; seqBase: number }

export function ExamenUnaALaVez({ view, servidor, onEntregado, onItems }: {
  view: AttemptView; servidor: EstadoExamenServidor; onEntregado: () => void; onItems: (items: AttemptItem[]) => void;
}) {
  const attemptId = view.attempt.id;
  const cfg = servidor.config;
  useModoConcentracion();
  const tel = useTelemetria();
  const almacen = useMemo(() => almacenLocal(), []);
  const claveMotor = `examen:${attemptId}:motor`;

  // ---- reloj oficial: servidor ≈ performance.now() + desfase
  const muestras = useRef<MuestraReloj[]>([]);
  const desfase = useRef<number>(servidor.ahora_ms - performance.now());
  const ahora = useCallback(() => performance.now() + desfase.current, []);
  const [, setTic] = useState(0);
  const [pausaSrv, setPausaSrv] = useState(servidor.pausa);

  // ---- motor (persistido en el dispositivo)
  const [motor, setMotorEstado] = useState<EstadoMotor>(() => {
    let p: Persistido | null = null;
    try { p = JSON.parse(almacen.leer(claveMotor) ?? 'null') as Persistido | null; } catch { p = null; }
    const t = servidor.ahora_ms;
    let m = p && JSON.stringify(p.motor.orden) === JSON.stringify(servidor.orden) ? p.motor : crearMotor(servidor.orden);
    m = { ...m, visitadas: [...new Set([...m.visitadas, ...servidor.visitadas])] };
    m = abrir(m, t, { activa: servidor.activa, incertidumbre_ms: LATIDO_MS });
    const permisivo = { ...cfg, pausas: { permitidas: true, max_numero: 1e6, max_total_s: 1e9, detienen_reloj: cfg.pausas.detienen_reloj } };
    if (servidor.estado === 'en_pausa' && m.fase !== 'en_pausa') { const r = pausar(m, t, permisivo); if (r.ok) m = r.estado; }
    if (servidor.estado !== 'en_pausa' && m.fase === 'en_pausa') { const r = reanudar(m, t); if (r.ok) m = r.estado; }
    return m;
  });
  const seqBase = useRef<number>((() => { try { return (JSON.parse(almacen.leer(claveMotor) ?? 'null') as Persistido | null)?.seqBase ?? servidor.diario_seq; } catch { return servidor.diario_seq; } })());
  const motorRef = useRef(motor);
  const setMotor = useCallback((m: EstadoMotor) => {
    motorRef.current = m;
    setMotorEstado(m);
    almacen.escribir(claveMotor, JSON.stringify({ motor: m, seqBase: seqBase.current } satisfies Persistido));
  }, [almacen, claveMotor]);

  // ---- guardado automático
  const cola = useMemo(() => new ColaGuardado(`examen:${attemptId}:cola`, async (p) => {
    try { return await examSave(attemptId, p.exercise_id, p.answer, p.rev); }
    catch (e) { const msg = e instanceof Error ? e.message : String(e); if (DEFINITIVO.test(msg)) throw new ErrorDefinitivo(msg); throw e; }
  }, almacen, () => performance.now() + desfase.current, 0), [attemptId, almacen]);
  useEffect(() => () => cola.detener(), [cola]);
  const [, setEstadoCola] = useState(0);
  useEffect(() => cola.suscribir(() => setEstadoCola((x) => x + 1)), [cola]);
  const [recuperadas] = useState(() => cola.recuperadas().length);
  // aplica a la vista las respuestas que estaban pendientes en este dispositivo
  useEffect(() => {
    const pend = cola.recuperadas();
    if (!pend.length) return;
    onItems(view.items.map((it) => { const p = pend.find((x) => x.exercise_id === it.exercise.id);
      return p ? { ...it, response: { ...(it.response ?? ({} as NonNullable<AttemptItem['response']>)), answer: p.answer as StudentAnswer, status: 'draft' } } : it; }));
    void cola.vaciar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const acciones: AccionesEjercicio = useMemo(() => ({
    ...ACCIONES_SERVIDOR,
    guardar: async (_a, exerciseId, answer) => {
      cola.cambiar(exerciseId, answer as Record<string, unknown>);
      await cola.vaciar();
      const e = cola.estado(exerciseId);
      if (e === 'rechazado') throw new Error(cola.mensaje(exerciseId) ?? 'No se pudo guardar');
      if (e !== 'guardado') throw new Error('Sin conexión: la respuesta quedó guardada en este dispositivo y se enviará sola al volver la red.');
    },
  }), [cola]);

  // ---- diario de tramos (se envía en lotes; idempotente por número de secuencia)
  const enviadoHasta = useRef(servidor.diario_seq);
  const enviarDiario = useCallback(async () => {
    const m = motorRef.current;
    const lote = m.tramos.map((t, k) => ({ ...t, seq: seqBase.current + k + 1 })).filter((t) => t.seq > enviadoHasta.current).slice(0, 200);
    if (!lote.length) return;
    try { const r = await examJournal(attemptId, lote); enviadoHasta.current = Math.max(enviadoHasta.current, r.diario_seq); } catch { /* se reintenta */ }
  }, [attemptId]);

  // ---- latidos, sincronización, visibilidad, inactividad y red
  const ultimaEntrada = useRef(performance.now());
  useEffect(() => {
    const lat = setInterval(() => { setMotor(latido(motorRef.current, ahora())); setTic((x) => x + 1); }, LATIDO_MS);
    const seg = setInterval(() => setTic((x) => x + 1), 1000);
    const dia = setInterval(() => void enviarDiario(), DIARIO_MS);
    const sincronizar = async () => {
      const envio = performance.now();
      try {
        const r = await examPing(attemptId);
        muestras.current = [...muestras.current.slice(-9), { envio_local: envio, servidor: r.ahora_ms, recibo_local: performance.now() }];
        const d = estimarDesfase(muestras.current);
        if (d) desfase.current = d.desfase;
      } catch { /* sin red */ }
    };
    void sincronizar();
    const ping = setInterval(() => void sincronizar(), PING_MS);
    const ina = setInterval(() => {
      const inactivo = performance.now() - ultimaEntrada.current > INACTIVIDAD_MS;
      if (inactivo !== motorRef.current.inactivo) setMotor(inactividad(motorRef.current, inactivo ? ahora() - (performance.now() - ultimaEntrada.current - INACTIVIDAD_MS) : ahora(), inactivo));
    }, 2000);
    const entrada = () => { ultimaEntrada.current = performance.now(); if (motorRef.current.inactivo) setMotor(inactividad(motorRef.current, ahora(), false)); };
    const vis = () => {
      setMotor(visibilidad(motorRef.current, ahora(), document.visibilityState === 'visible'));
      if (document.visibilityState !== 'visible') { void cola.vaciar(); void enviarDiario(); }
    };
    const enRed = () => { setMotor(red(motorRef.current, ahora(), navigator.onLine)); if (navigator.onLine) { cola.reintentar(); void enviarDiario(); } };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('online', enRed); window.addEventListener('offline', enRed);
    for (const ev of ['keydown', 'pointerdown', 'input', 'scroll'] as const) window.addEventListener(ev, entrada, { passive: true });
    return () => {
      clearInterval(lat); clearInterval(seg); clearInterval(dia); clearInterval(ping); clearInterval(ina);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('online', enRed); window.removeEventListener('offline', enRed);
      for (const ev of ['keydown', 'pointerdown', 'input', 'scroll'] as const) window.removeEventListener(ev, entrada);
    };
  }, [ahora, attemptId, cola, enviarDiario, setMotor]);

  // ---- límite oficial
  const limite = horaLimite({
    inicio: servidor.inicio_ms, duracion_s: cfg.duracion_s, pausas_ms: pausaSrv.ms, pausa_en_curso_desde: pausaSrv.desde_ms,
    detienen_reloj: cfg.pausas.detienen_reloj, max_pausa_ms: cfg.pausas.max_total_s * 1000, cierre_actividad: servidor.cierre_ms,
  }, ahora());
  const queda = restante(limite, ahora());

  // ---- acciones
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const aplicar = (r: Resultado) => { if (!r.ok) { setError(r.motivo); return false; } setError(null); setMotor(r.estado); return true; };
  const ir = async (fn: () => Resultado) => {
    const antes = motorRef.current;
    const r = fn();
    if (!aplicar(r) || !r.estado.activa || r.estado.activa === antes.activa && r.estado.fase === antes.fase) return;
    if (r.estado.fase === 'revision') return;
    void cola.vaciar();
    try { await examGoto(attemptId, r.estado.activa); }
    catch (e) { const msg = e instanceof Error ? e.message : String(e); if (DEFINITIVO.test(msg) || /volver/.test(msg)) { setMotor(antes); setError(msg); } }
  };
  const doPausa = async () => {
    const no = puedePausar(motorRef.current, cfg);
    if (no) { setError(no); return; }
    setOcupado(true);
    try { await cola.vaciar(); const s = await examPause(attemptId); setPausaSrv(s.pausa); aplicar(pausar(motorRef.current, ahora(), cfg)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  };
  const doReanudar = async () => {
    setOcupado(true);
    try { const s = await examResume(attemptId); setPausaSrv(s.pausa); aplicar(reanudar(motorRef.current, ahora())); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  };
  const entregando = useRef(false);
  const doEntregar = useCallback(async (automatica = false) => {
    if (entregando.current) return;
    entregando.current = true;
    setOcupado(true);
    tel?.envio('solicitado');
    try {
      await cola.vaciar();
      setMotor(motorEntregar(motorRef.current, ahora()));
      await enviarDiario();
      await submitAttempt(attemptId);
      tel?.envio('recibido');
      almacen.borrar(claveMotor);
      onEntregado();
    } catch (e) {
      tel?.envio('error');
      entregando.current = false;
      if (motorRef.current.fase === 'entregado') setMotor(abrir(motorRef.current, ahora())); // la entrega no se completó: se sigue

      setError(`${automatica ? 'El tiempo terminó, pero no se pudo entregar todavía: ' : ''}${e instanceof Error ? e.message : String(e)}. Se reintentará al pulsar «Entregar».`);
    } finally { setOcupado(false); }
  }, [ahora, almacen, attemptId, claveMotor, cola, enviarDiario, onEntregado, setMotor, tel]);
  // entrega automática al vencer el tiempo oficial
  useEffect(() => { if (queda === 0 && limite !== null && !entregando.current) void doEntregar(true); }, [queda, limite, doEntregar]);

  // ---- vista
  // lo pendiente en el dispositivo también cuenta como respondido (sin conexión, la vista no se actualiza)
  const pendientes = new Map(cola.recuperadas().map((p) => [p.exercise_id, p.answer as StudentAnswer]));
  const items = view.items.map((it) => (pendientes.has(it.exercise.id)
    ? { ...it, response: { ...(it.response ?? ({} as NonNullable<AttemptItem['response']>)), answer: pendientes.get(it.exercise.id)! } } : it));
  const idx = motor.activa ? items.findIndex((it) => it.exercise.id === motor.activa) : -1;
  const actual = idx >= 0 ? view.items[idx] : null;
  const respondidas = items.filter(estaRespondida).length;
  const resumen = cola.resumen();
  const updateItem = (it: AttemptItem) => onItems(view.items.map((x) => (x.exercise.id === it.exercise.id ? it : x)));
  const tonoReloj = queda === null ? 'gray' : queda < 60_000 ? 'red' : queda < 300_000 ? 'amber' : 'blue';

  return (
    <div className="mx-auto max-w-3xl pb-28">
      {/* barra superior: reloj oficial, estado del guardado y pausa */}
      <div className="sticky top-0 z-30 -mx-3 mb-3 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-primario-950/95">
        <span className="text-sm font-medium">{respondidas}/{items.length} respondidas</span>
        {queda !== null && <Badge tone={tonoReloj}><span aria-live="polite" className="tabular-nums">⏱ {formatoCuenta(queda)}</span></Badge>}
        <span className="text-xs text-gray-500" aria-live="polite">
          {resumen === 'guardado' ? 'Guardado ✓' : resumen === 'enviando' || resumen === 'pendiente' ? 'Guardando…' : resumen === 'sin_conexion' ? 'Sin conexión: guardado en este dispositivo' : 'No se pudo guardar'}
        </span>
        <span className="flex-1" />
        {cfg.pausas.permitidas && motor.fase !== 'en_pausa' && (
          <button className="btn-secundario min-h-[40px] text-sm" onClick={() => void doPausa()} disabled={ocupado || !!puedePausar(motor, cfg)}
            title={puedePausar(motor, cfg) ?? `Pausas: ${motor.pausas.n}/${cfg.pausas.max_numero}`}>⏸ Pausar</button>
        )}
      </div>

      {recuperadas > 0 && <Notice>Recuperamos {recuperadas} respuesta(s) que estaban guardadas en este dispositivo y se están enviando.</Notice>}
      {!motor.en_red && <Notice tone="warn">Sin conexión. Puede seguir respondiendo: se guarda en este dispositivo y se enviará sola al volver la red. El reloj oficial sigue corriendo.</Notice>}
      <ErrorBox error={error} />

      {/* navegador de preguntas */}
      <nav aria-label="Preguntas" className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {items.map((it, i) => {
          const id = it.exercise.id, es = id === motor.activa && motor.fase === 'trabajando', bloqueada = !!puedeIrA(motor, id, cfg) && !es;
          const marcada = motor.marcadas.includes(id), resp = estaRespondida(it);
          return (
            <button key={id} onClick={() => void ir(() => irA(motorRef.current, ahora(), id, cfg))} disabled={bloqueada || motor.fase === 'en_pausa'}
              aria-current={es ? 'step' : undefined} aria-label={`Pregunta ${i + 1}${resp ? ', respondida' : ''}${marcada ? ', marcada' : ''}`}
              className={`relative min-h-[40px] min-w-[40px] shrink-0 rounded-lg border text-sm font-medium tabular-nums ${es ? 'border-primario-600 bg-primario-600 text-white' : resp ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' : 'border-gray-300 dark:border-white/20'} ${bloqueada ? 'opacity-40' : ''}`}>
              {i + 1}{marcada && <span className="absolute -right-1 -top-1 text-xs" aria-hidden>🚩</span>}
            </button>
          );
        })}
        <button onClick={() => aplicar(irRevision(motorRef.current, ahora(), cfg))} disabled={motor.fase === 'en_pausa'}
          className={`min-h-[40px] shrink-0 rounded-lg border px-3 text-sm ${motor.fase === 'revision' ? 'border-primario-600 bg-primario-600 text-white' : 'border-gray-300 dark:border-white/20'}`}>Revisar</button>
      </nav>

      {/* pausa: el contenido se oculta mientras dura */}
      {motor.fase === 'en_pausa' ? (
        <div className="tarjeta py-10 text-center">
          <p className="text-lg font-semibold">Examen en pausa</p>
          <p className="mt-1 text-sm text-gray-500">Las preguntas están ocultas durante la pausa.{cfg.pausas.detienen_reloj ? ' El reloj del examen está detenido' : ' El reloj del examen sigue corriendo'} (pausa disponible en total: {Math.round(cfg.pausas.max_total_s / 60)} min).</p>
          {pausaSrv.desde_ms && <p className="mt-2 tabular-nums">Pausa en curso: {formatoCuenta(Math.max(0, ahora() - pausaSrv.desde_ms))}</p>}
          <button className="btn-primario mt-4" onClick={() => void doReanudar()} disabled={ocupado}>Reanudar</button>
        </div>
      ) : motor.fase === 'revision' ? (
        <div className="tarjeta">
          <h2 className="mb-2 font-semibold">Revisión antes de entregar</h2>
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {items.map((it, i) => {
              const id = it.exercise.id, bloqueada = !!puedeIrA(motor, id, cfg);
              return (
                <li key={id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="w-8 tabular-nums">{i + 1}.</span>
                  <span className="flex-1">{estaRespondida(it) ? <Badge tone="green">Respondida</Badge> : <Badge tone="amber">Sin responder</Badge>} {motor.marcadas.includes(id) && <Badge tone="purple">Marcada</Badge>}</span>
                  {!bloqueada && <button className="enlace" onClick={() => void ir(() => irA(motorRef.current, ahora(), id, cfg))}>Ir</button>}
                </li>
              );
            })}
          </ul>
          {cfg.navegacion === 'solo_adelante' && <p className="mt-2 text-xs text-gray-500">En este examen no se puede volver a las preguntas ya vistas.</p>}
          <button className="btn-acento mt-4 w-full sm:w-auto" onClick={() => setConfirmar(true)} disabled={ocupado}>Entregar el examen</button>
        </div>
      ) : actual ? (
        <div>
          <p className="mb-1 text-sm text-gray-500">Pregunta {idx + 1} de {items.length}</p>
          <Ejercicio key={actual.exercise.id} index={idx} item={actual} view={view} onChange={updateItem} acciones={acciones} />
        </div>
      ) : null}

      {/* barra inferior: navegación */}
      {motor.fase !== 'en_pausa' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-primario-950/95 md:bottom-0">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <button className="btn-secundario min-h-[44px] flex-1 sm:flex-none" onClick={() => void ir(() => motorAnterior(motorRef.current, ahora(), cfg))}
              disabled={motor.fase === 'trabajando' && (idx <= 0 || !!(idx > 0 && puedeIrA(motor, items[idx - 1].exercise.id, cfg)))}>← Anterior</button>
            {motor.fase === 'trabajando' && actual && (
              <button className="btn-secundario min-h-[44px]" onClick={() => setMotor(marcar(motorRef.current, actual.exercise.id))} aria-pressed={motor.marcadas.includes(actual.exercise.id)}>
                {motor.marcadas.includes(actual.exercise.id) ? '🚩 Marcada' : 'Marcar'}
              </button>
            )}
            <span className="hidden flex-1 sm:block" />
            {motor.fase === 'trabajando' && (
              <button className="btn-primario min-h-[44px] flex-1 sm:flex-none" onClick={() => void ir(() => motorSiguiente(motorRef.current, ahora(), cfg))}>
                {idx + 1 >= items.length ? 'Revisar y entregar →' : 'Siguiente →'}
              </button>
            )}
          </div>
        </div>
      )}

      <Modal open={confirmar} onClose={() => setConfirmar(false)} title="¿Entregar el examen?">
        <p className="text-sm">{items.length - respondidas ? `Quedan ${items.length - respondidas} pregunta(s) sin responder; contarán como incorrectas.` : 'Respondió todas las preguntas.'} Después de entregar no podrá cambiar sus respuestas.</p>
        {cola.hayPendientes() && <p className="mt-2 text-sm text-acento-700">Hay respuestas pendientes de enviar; se intentará enviarlas antes de entregar.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secundario" onClick={() => setConfirmar(false)}>Seguir revisando</button>
          <button className="btn-acento" onClick={() => { setConfirmar(false); void doEntregar(); }} disabled={ocupado}>{ocupado ? 'Entregando…' : 'Entregar'}</button>
        </div>
      </Modal>
      {queda === 0 && limite !== null && <Notice tone="warn">El tiempo oficial terminó. Entregando lo guardado…</Notice>}
    </div>
  );
}
