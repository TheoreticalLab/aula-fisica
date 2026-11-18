/**
 * Maratón adaptativo — vista del estudiante (y del profesor en modo prueba).
 * Solo muestra información operativa: jornada, estado, ejercicios respondidos, tiempo registrado y comodines.
 * Nunca muestra (ni recibe) el nivel, la ponderación, las unidades, la cuota ni los umbrales internos.
 * No hay latidos periódicos: el tiempo activo se mide en el navegador y se envía con cada acción; el servidor solo
 * acredita como máximo el tiempo real transcurrido desde que presentó el problema.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { interpretNumeric } from '@calif/calificar.ts';
import { API_MARATON, esNoValida, type ConsultaMaraton, type EstadoMaraton, type MiInforme } from '@/api/maraton';
import { reglasPermanencia, SIN_TOPE_MIN } from '@/lib/maraton/config';
import { fecha, useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Modal, Notice, PageTitle, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { BotonCalculadora, CalculadoraProvider } from '@/components/Calculadora';

const INACTIVIDAD_MS = 120_000;
const CLAVE_T = (p: string) => `maraton:t:${p}`;

/** Tiempo activo del problema actual, medido solo en este navegador (se conserva al recargar). */
function useTiempoActivo(presentacion: string | null) {
  const acumulado = useRef(0);
  const ultimaInteraccion = useRef(Date.now());
  const ultimoTic = useRef(Date.now());
  useEffect(() => {
    if (!presentacion) return;
    try { acumulado.current = Number(localStorage.getItem(CLAVE_T(presentacion)) ?? 0) || 0; } catch { acumulado.current = 0; }
    ultimoTic.current = Date.now();
    ultimaInteraccion.current = Date.now();
    let ultimoMov = 0;
    const tocar = () => { ultimaInteraccion.current = Date.now(); };
    const mover = () => { const t = Date.now(); if (t - ultimoMov > 5000) { ultimoMov = t; tocar(); } };
    const evs = ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart', 'wheel'] as const;
    evs.forEach((e) => window.addEventListener(e, tocar, { capture: true, passive: true }));
    window.addEventListener('mousemove', mover, { passive: true });
    const tic = () => {
      const t = Date.now();
      const dt = Math.min(t - ultimoTic.current, 10_000);
      ultimoTic.current = t;
      if (document.visibilityState === 'visible' && t - ultimaInteraccion.current < INACTIVIDAD_MS) {
        acumulado.current += dt;
        try { localStorage.setItem(CLAVE_T(presentacion), String(Math.round(acumulado.current))); } catch { /* sin almacenamiento */ }
      }
    };
    const iv = window.setInterval(tic, 5000);
    const vis = () => { tic(); if (document.visibilityState === 'visible') tocar(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      tic();
      window.clearInterval(iv);
      evs.forEach((e) => window.removeEventListener(e, tocar, { capture: true }));
      window.removeEventListener('mousemove', mover);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [presentacion]);
  return useCallback(() => Math.round(acumulado.current / 100) / 10, []);
}

const AVISOS: Record<string, string> = {
  ya_procesada: 'Su acción ya se había registrado.',
  ya_cerrada: 'Ese ejercicio ya estaba cerrado (quizá desde otra pestaña). Se muestra el estado actual.',
  jornada_cerrada: 'El plazo de la jornada terminó: la acción no se registró.',
};

/** Aviso al estudiante que quedó fuera (sin niveles ni parámetros internos). */
const MOTIVO_FUERA: Record<string, string> = {
  aciertos: 'ya no era posible alcanzar el mínimo de ejercicios bien resueltos de la jornada',
  presentados: 'se llegó al máximo de problemas de la jornada sin completarla',
  continuidad: 'una jornada terminó sin completarse',
  rapidez: 'se registró la resolución correcta de un problema de alta dificultad en menos del tiempo mínimo establecido',
};

const ESTADO_JORNADA: Record<string, { t: string; tono: 'gray' | 'blue' | 'green' | 'amber' | 'red' }> = {
  sin_iniciar: { t: 'Sin iniciar', tono: 'gray' }, en_curso: { t: 'En desarrollo', tono: 'blue' }, completada: { t: 'Completada', tono: 'green' },
  cerrada: { t: 'Cerrada por límite (en revisión)', tono: 'amber' }, incompleta: { t: 'No completada', tono: 'red' }, justificada: { t: 'Justificada', tono: 'gray' },
};

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

export default function Maraton() {
  const { maratonId = '' } = useParams();
  const st = useAsync(() => API_MARATON.estado(maratonId), [maratonId]);
  const [estado, setEstado] = useState<EstadoMaraton | null>(null);
  const e = estado ?? st.data ?? null;
  // al volver a la pestaña tras un rato, se refresca una vez (sin sondeos periódicos)
  const oculto = useRef<number | null>(null);
  useEffect(() => {
    const f = () => {
      if (document.visibilityState === 'hidden') oculto.current = Date.now();
      else if (oculto.current && Date.now() - oculto.current > 5 * 60_000) { oculto.current = null; void API_MARATON.estado(maratonId).then(setEstado).catch(() => undefined); }
    };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [maratonId]);
  // pregunta de la plataforma (migración 101): se consulta al cargar, tras cada acción y cada 2 min con la página visible
  const [consulta, setConsulta] = useState<ConsultaMaraton | null>(null);
  const participa = !!e && e.aceptado && !e.prueba && !e.fuera;
  useEffect(() => {
    if (!participa) { setConsulta(null); return; }
    const buscar = () => { if (document.visibilityState === 'visible') void API_MARATON.consultaPendiente(maratonId).then(setConsulta).catch(() => undefined); };
    buscar();
    const iv = window.setInterval(buscar, 120_000);
    return () => window.clearInterval(iv);
  }, [maratonId, participa, e]);

  if (st.loading && !e) return <Spinner />;
  if (st.error && !e) return <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!e) return null;
  return (
    <CalculadoraProvider permitida>
      <div className="mx-auto max-w-3xl space-y-4 pb-10">
        <PageTitle title="Maratón académico" subtitle={`${e.maraton.asignatura} · ${e.maraton.titulo}`} back={{ to: '/evaluaciones', label: 'Evaluaciones' }}
          actions={<BotonCalculadora />} />
        {e.prueba && <Notice tone="warn">Modo prueba del profesor: este recorrido no aparece en los informes y puede reiniciarse desde el configurador.</Notice>}
        {!e.aceptado ? <Condiciones e={e} onIniciar={setEstado} /> : <Jornada e={e} onEstado={setEstado} />}
        {e.aceptado && e.maraton.instrucciones && (
          <details className="tarjeta text-sm">
            <summary className="cursor-pointer font-medium">Instrucciones y requisitos del maratón</summary>
            <Markdown className="prosa mt-2">{e.maraton.instrucciones}</Markdown>
          </details>
        )}
        {e.informe_disponible && <InformeDisponible maratonId={maratonId} />}
        {consulta && participa && <PreguntaPlataforma maratonId={maratonId} c={consulta} onEstado={(s) => { setConsulta(null); setEstado(s); }} />}
      </div>
    </CalculadoraProvider>
  );
}

/** Pregunta de la plataforma: ocupa la pantalla y no se puede cerrar sin responder; «Sí» pide confirmación. */
function PreguntaPlataforma({ maratonId, c, onEstado }: { maratonId: string; c: ConsultaMaraton; onEstado: (s: EstadoMaraton) => void }) {
  const act = useAction();
  const [confirmar, setConfirmar] = useState(false);
  const responder = async (r: boolean) => { const s = await act.run(() => API_MARATON.declarar(maratonId, c.id, r)); if (s) onEstado(s); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="pregunta-titulo" className="tarjeta w-full max-w-lg space-y-4 bg-white dark:bg-gray-900">
        <h2 id="pregunta-titulo" className="text-lg font-bold">{c.titulo}</h2>
        <div className="space-y-2">{c.texto.split(/\n\s*\n/).map((p, k) => <p key={k}>{p}</p>)}</div>
        {!confirmar ? (
          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn-secundario min-h-[44px] min-w-[96px]" disabled={act.busy} onClick={() => setConfirmar(true)}>Sí</button>
            <button className="btn-secundario min-h-[44px] min-w-[96px]" disabled={act.busy} onClick={() => void responder(false)}>No</button>
          </div>
        ) : (
          <>
            <Notice tone="warn">Al confirmar que marcó «Sí», quedará fuera de este maratón. Esta respuesta no se puede cambiar.</Notice>
            <div className="flex flex-wrap justify-end gap-3">
              <button className="btn-secundario min-h-[44px]" disabled={act.busy} onClick={() => setConfirmar(false)}>Volver</button>
              <button className="btn-primario min-h-[44px]" disabled={act.busy} onClick={() => void responder(true)}>Confirmar «Sí»</button>
            </div>
          </>
        )}
        <ErrorBox error={act.error} />
      </div>
    </div>
  );
}

/** Transparencia académica: lo que el estudiante debe conocer ANTES de empezar (sin parámetros internos). */
function Condiciones({ e, onIniciar }: { e: EstadoMaraton; onIniciar: (s: EstadoMaraton) => void }) {
  const act = useAction();
  const m = e.maraton;
  const abierto = e.prueba || e.hoy.fase === 'abierta';
  return (
    <Card title="Antes de comenzar">
      <ul className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
        <li><strong>Duración:</strong> {m.jornadas} jornadas {m.fecha_inicio ? `desde el ${m.fecha_inicio}` : '(fecha por confirmar)'}.</li>
        <li><strong>Horario diario:</strong> de {m.apertura} a {m.cierre} ({m.zona}).</li>
        <li><strong>Duración orientativa:</strong> {m.tiempo_orientativo[0]}–{m.tiempo_orientativo[1]} min por jornada{m.limite_minutos >= SIN_TOPE_MIN ? ' (sin tope de tiempo)' : ` (máximo ~${m.limite_minutos} min)`}.</li>
        <li><strong>Comodines:</strong> {m.comodines_total} en todo el maratón{m.comodines_por_jornada !== null ? ` (máximo ${m.comodines_por_jornada} por jornada)` : ''}.</li>
        <li><strong>Dificultad adaptativa</strong> y <strong>cantidad variable</strong> de ejercicios por jornada.</li>
        <li><strong>Informes, no notas:</strong> el sistema describe su trabajo; la recuperación la decide el profesor.</li>
      </ul>
      {m.permanencia && reglasPermanencia(m.permanencia).length > 0 && (
        <div className="mb-4 rounded border border-acento-300 bg-acento-50 p-3 text-sm dark:border-acento-700/60 dark:bg-acento-700/20">
          <strong>Reglas de permanencia</strong> (incumplirlas termina su participación en el maratón):
          <ul className="mt-1 list-disc pl-5">{reglasPermanencia(m.permanencia).map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {m.instrucciones ? <Markdown className="prosa">{m.instrucciones}</Markdown> : <p className="text-sm text-gray-500">El profesor no ha añadido instrucciones.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primario min-h-[44px]" disabled={act.busy || !abierto} onClick={async () => { const s = await act.run(() => API_MARATON.iniciar(m.id)); if (s) onIniciar(s); }}>
          {act.busy ? 'Iniciando…' : 'He leído las condiciones: comenzar'}
        </button>
        {!abierto && <span className="text-sm text-gray-500"><FaseTexto e={e} /></span>}
      </div>
      <ErrorBox error={act.error} />
    </Card>
  );
}

function FaseTexto({ e }: { e: EstadoMaraton }) {
  const h = e.hoy;
  if (e.finalizado || h.fase === 'finalizado') return <>El maratón terminó.</>;
  if (h.fase === 'sin_fecha') return <>El maratón todavía no tiene fecha de inicio.</>;
  if (h.fase === 'antes') return <>Empieza el {fecha(h.siguiente?.abre)}.</>;
  if (h.fase === 'antes_de_apertura') return <>La jornada de hoy abre a las {fecha(h.abre)}.</>;
  if (h.fase === 'cerrada_hoy') return <>La jornada de hoy ya cerró. La próxima abre el {fecha(h.siguiente?.abre)}.</>;
  if (h.fase === 'sin_jornada_hoy') return <>Hoy no hay jornada. La próxima abre el {fecha(h.siguiente?.abre)}.</>;
  return null;
}

function Jornada({ e, onEstado }: { e: EstadoMaraton; onEstado: (s: EstadoMaraton) => void }) {
  const act = useAction();
  // El servidor devuelve la última jornada registrada. Si es de un día anterior y hoy abre otra que aún no se ha
  // creado (se crea al pulsar «Comenzar»), se muestra la de hoy sin iniciar, no la anterior.
  const anterior = !!e.jornada && !e.prueba && e.jornada.estado !== 'en_curso' && !e.jornada.reabierta_hasta
    && e.hoy.fase === 'abierta' && e.hoy.numero != null && e.jornada.numero < e.hoy.numero;
  const j = anterior ? null : e.jornada;
  const ej = j ? ESTADO_JORNADA[j.estado] ?? ESTADO_JORNADA.en_curso : anterior ? ESTADO_JORNADA.sin_iniciar : null;
  return (
    <>
      <div className="tarjeta grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
        <div><div className="text-xs uppercase text-gray-500">Jornada</div><div className="text-lg font-semibold">{j ? `${j.numero} de ${e.maraton.jornadas}` : anterior ? `${e.hoy.numero} de ${e.maraton.jornadas}` : '—'}</div></div>
        <div><div className="text-xs uppercase text-gray-500">Estado</div><div className="mt-1">{ej ? <Badge tone={ej.tono}>{ej.t}</Badge> : <Badge>Sin jornada abierta</Badge>}</div></div>
        <div><div className="text-xs uppercase text-gray-500">Ejercicios respondidos</div><div className="text-lg font-semibold">{j?.respondidos ?? 0}</div></div>
        <div><div className="text-xs uppercase text-gray-500">Tiempo registrado</div><div className="text-lg font-semibold">{j?.minutos ?? 0} min</div></div>
        <div className="col-span-2 sm:col-span-4"><span className="text-xs uppercase text-gray-500">Comodines disponibles:</span> <strong>{e.comodines_disponibles}</strong>
          {j?.reabierta_hasta && <span className="ml-3"><Badge tone="purple">Jornada reabierta hasta {fecha(j.reabierta_hasta)}</Badge></span>}</div>
      </div>
      {e.aviso && <Notice tone="warn">{AVISOS[e.aviso] ?? e.aviso}</Notice>}
      {e.ultimo && <Notice tone={e.ultimo.resultado === 'correcta' ? 'ok' : 'warn'}>Su respuesta anterior fue {e.ultimo.resultado === 'correcta' ? 'correcta' : 'incorrecta'}.</Notice>}
      {e.problema ? <Problema key={e.problema.presentacion_id} e={e} onEstado={onEstado} />
        : e.fuera ? (
          <div className="tarjeta border-red-300 dark:border-red-700">
            <h2 className="text-lg font-bold">Su participación en el maratón terminó</h2>
            {e.fuera.tipo === 'declaracion'
              ? <p className="mt-1">Respondió «Sí» a la pregunta de la plataforma sobre el uso de inteligencia artificial{e.fuera.jornada ? ` (jornada ${e.fuera.jornada})` : ''}.</p>
              : <p className="mt-1">Según las reglas de permanencia comunicadas al inicio, {MOTIVO_FUERA[e.fuera.tipo] ?? 'se incumplió una regla de permanencia'}
                  {e.fuera.jornada ? ` (jornada ${e.fuera.jornada})` : ''}.</p>}
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">No puede continuar en las jornadas siguientes. Si cree que hubo un error o una falla técnica, hable con su profesor: puede revisarlo y reincorporarle.</p>
          </div>
        ) : j?.estado === 'completada' ? (
          <div className="tarjeta border-green-300 text-center dark:border-green-700">
            <div className="text-3xl" aria-hidden>🏁</div>
            <h2 className="mt-1 text-xl font-bold">JORNADA COMPLETADA</h2>
            <p className="mt-1">Has cumplido los requisitos correspondientes a esta jornada.</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Podrás continuar el maratón en la próxima jornada{e.hoy.siguiente ? ` (abre el ${fecha(e.hoy.siguiente.abre)})` : ''}.</p>
          </div>
        ) : j?.estado === 'cerrada' ? (
          <Notice tone="warn">La jornada se cerró de forma segura porque se alcanzó un límite de la jornada. Quedó registrada para revisión del profesor; no se declara incumplida automáticamente.</Notice>
        ) : j?.estado === 'incompleta' ? (
          <Notice tone="warn">La jornada {j.numero} terminó sin completarse. Si hubo una falla técnica, avise al profesor con evidencia: puede reabrirla o justificarla.</Notice>
        ) : (j?.estado === 'en_curso' || e.hoy.fase === 'abierta' || (e.prueba && !e.finalizado)) && !(j && j.estado === 'justificada') ? (
          <div className="tarjeta flex flex-wrap items-center gap-3">
            <span className="flex-1">{j?.estado === 'en_curso' ? 'Continúe la jornada en curso.' : 'La jornada de hoy está abierta.'}</span>
            <button className="btn-primario min-h-[44px]" disabled={act.busy} onClick={async () => { const s = await act.run(() => API_MARATON.iniciar(e.maraton.id)); if (s) onEstado(s); }}>
              {act.busy ? 'Cargando…' : j?.estado === 'en_curso' ? 'Continuar' : 'Comenzar la jornada'}
            </button>
          </div>
        ) : <Notice><FaseTexto e={e} /></Notice>}
      <ErrorBox error={act.error} />
    </>
  );
}

function Problema({ e, onEstado }: { e: EstadoMaraton; onEstado: (s: EstadoMaraton) => void }) {
  const p = e.problema!;
  const segundos = useTiempoActivo(p.presentacion_id);
  const [partes, setPartes] = useState<string[]>(() => p.partes.map(() => ''));
  const [proc, setProc] = useState('');
  const [vista, setVista] = useState(false);
  const [invalida, setInvalida] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState<'no_puedo' | 'cambio' | null>(null);
  const act = useAction();
  // clave de idempotencia por acción: un reintento tras un corte de red reutiliza la misma
  const idems = useRef<Record<string, string>>({});
  const idem = (accion: string) => (idems.current[accion] ??= uuid());
  const listo = partes.every((x) => x.trim());
  // problema por etapas: al pasar a la siguiente, casillas nuevas y otra clave de idempotencia (el procedimiento sigue)
  // (solo cuando cambia la etapa: un refresco del estado no borra lo que está escribiendo)
  const etapa = p.etapa ?? 1;
  const nPartes = p.partes.length;
  useEffect(() => {
    setPartes(Array.from({ length: nPartes }, () => ''));
    setInvalida([]);
    delete idems.current.respuesta;
  }, [etapa, nPartes]);

  const terminar = (s: EstadoMaraton) => {
    try { localStorage.removeItem(CLAVE_T(p.presentacion_id)); } catch { /* nada */ }
    onEstado(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  async function responder() {
    setInvalida([]);
    const r = await act.run(() => API_MARATON.responder(p.presentacion_id, idem('respuesta'), partes.map((x) => x.trim()), proc.trim() || null, segundos(), etapa));
    if (!r) return;
    if (esNoValida(r)) { setInvalida(r.mensajes); delete idems.current.respuesta; return; }
    // etapa intermedia: el mismo problema sigue abierto (el tiempo activo se conserva)
    if (r.problema?.presentacion_id === p.presentacion_id) { onEstado(r); return; }
    terminar(r);
  }
  async function noPuedo() {
    setConfirmar(null);
    const r = await act.run(() => API_MARATON.noPuedo(p.presentacion_id, idem('no_puedo'), segundos(), proc.trim() || null));
    if (r) terminar(r);
  }
  async function cambiar() {
    setConfirmar(null);
    const r = await act.run(() => API_MARATON.cambiar(p.presentacion_id, idem('cambio'), segundos()));
    if (r) terminar(r);
  }
  const lecturas = useMemo(() => partes.map((x) => (x.trim() ? interpretNumeric(x) : null)), [partes]);

  return (
    <div className="tarjeta space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500"><span>Ejercicio {p.numero} de la jornada</span></div>
      {etapa > 1 && p.contexto != null ? (
        <>
          <Markdown className="prosa text-base">{p.contexto}</Markdown>
          {/* lo ya entregado, tal como lo envió (no se puede cambiar ni dice si acertó) */}
          {(p.previas ?? []).map((pv) => (
            <div key={pv.etapa} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="text-xs font-semibold uppercase text-gray-500">Etapa {pv.etapa} · entregada</div>
              {pv.enunciado && <Markdown className="prosa mt-1 text-sm">{pv.enunciado}</Markdown>}
              <ul className="mt-1 space-y-0.5">
                {pv.partes.map((pt, i) => <li key={i}>{pt.etiqueta}: <span className="font-mono">{pv.respuesta?.[i] ?? '—'}</span></li>)}
              </ul>
            </div>
          ))}
          <div className="text-xs font-semibold uppercase text-gray-500">Etapa {etapa}</div>
          {p.actual && <Markdown className="prosa text-base">{p.actual}</Markdown>}
        </>
      ) : <Markdown className="prosa text-base">{p.enunciado}</Markdown>}
      <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); if (listo) void responder(); }}>
        {p.partes.map((pt, i) => (
          <label key={i} className="block">
            <span className="etiqueta">{p.partes.length > 1 ? `(${i + 1}) ` : ''}{pt.etiqueta}{pt.unidad ? <span className="text-gray-500"> — unidad sugerida: {pt.unidad}</span> : <span className="text-gray-500"> — sin unidad</span>}</span>
            <input className="campo font-mono" inputMode="text" autoComplete="off" spellCheck={false} maxLength={200} value={partes[i]}
              placeholder={pt.unidad ? `p. ej. 3.25 ${pt.unidad}` : 'p. ej. 0.45'}
              onChange={(ev) => setPartes((xs) => xs.map((x, k) => (k === i ? ev.target.value : x)))} />
            {lecturas[i] && <span className={`mt-1 block text-xs ${lecturas[i]!.ok ? 'text-gray-500' : 'text-amber-700 dark:text-amber-400'}`}>Se interpreta como: {lecturas[i]!.text}</span>}
          </label>
        ))}
        <details className="rounded-lg border border-gray-200 p-2 dark:border-white/10">
          <summary className="cursor-pointer text-sm font-medium">Procedimiento (opcional; lo puede revisar el profesor)</summary>
          <textarea className="campo mt-2 font-mono text-sm" rows={6} maxLength={20000} value={proc} onChange={(ev) => setProc(ev.target.value)}
            placeholder="Planteamiento, ecuaciones y cálculos. Puede usar fórmulas entre $…$." />
          {proc.trim() && <button type="button" className="btn-texto text-sm" onClick={() => setVista((v) => !v)}>{vista ? 'Ocultar' : 'Ver'} vista previa con las ecuaciones</button>}
          {vista && <Markdown className="prosa mt-2 text-sm">{proc}</Markdown>}
        </details>
        {invalida.length > 0 && <Notice tone="warn"><strong>La respuesta no se registró:</strong> {invalida.join(' ')} Corríjala y vuelva a enviarla.</Notice>}
        <ErrorBox error={act.error} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario min-h-[48px] flex-1" disabled={act.busy || !listo}>{act.busy ? 'Enviando…' : 'RESPONDER'}</button>
          {e.maraton.no_puedo && <button type="button" className="btn-secundario min-h-[48px]" disabled={act.busy} onClick={() => setConfirmar('no_puedo')}>NO PUEDO RESOLVERLO</button>}
          <button type="button" className="btn-secundario min-h-[48px]" disabled={act.busy || e.comodines_disponibles < 1} onClick={() => setConfirmar('cambio')}>
            CAMBIAR EJERCICIO ({e.comodines_disponibles})
          </button>
        </div>
      </form>
      <Modal open={confirmar !== null} onClose={() => setConfirmar(null)} title={confirmar === 'cambio' ? 'Cambiar ejercicio' : 'No puedo resolver este ejercicio'}>
        {confirmar === 'cambio' ? (
          <p className="text-sm">Se usará <strong>1 comodín</strong> (le quedarán {e.comodines_disponibles - 1}). Este ejercicio se retira y no volverá; recibirá otro equivalente.</p>
        ) : (
          <p className="text-sm">El ejercicio quedará registrado como no resuelto y recibirá otro. No gasta comodines. Esta decisión no se puede deshacer.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secundario min-h-[44px]" onClick={() => setConfirmar(null)}>Volver al ejercicio</button>
          <button className="btn-primario min-h-[44px]" disabled={act.busy} onClick={() => void (confirmar === 'cambio' ? cambiar() : noPuedo())}>Confirmar</button>
        </div>
      </Modal>
    </div>
  );
}

function InformeDisponible({ maratonId }: { maratonId: string }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="space-y-3">
      {!ver ? (
        <div className="tarjeta flex flex-wrap items-center gap-3">
          <span className="text-2xl" aria-hidden>📄</span><span className="flex-1">Su informe del maratón está disponible.</span>
          <button className="btn-secundario min-h-[44px]" onClick={() => setVer(true)}>Ver mi informe</button>
        </div>
      ) : <MiInformeVista maratonId={maratonId} />}
    </div>
  );
}

export function MiInformeVista({ maratonId }: { maratonId: string }) {
  const st = useAsync(() => API_MARATON.miInforme(maratonId), [maratonId]);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  return <InformeEstudiante i={st.data!} />;
}

export function InformeEstudiante({ i }: { i: MiInforme }) {
  if (!i.participo || !i.resumen) return <Notice>No participó en este maratón.</Notice>;
  const r = i.resumen;
  const pct = r.intentos_validos ? Math.round((r.correctas / r.intentos_validos) * 100) : 0;
  return (
    <div className="space-y-4">
      <Card title={`Informe descriptivo — ${i.titulo ?? ''}`} actions={<button className="btn-secundario no-print" onClick={() => window.print()}>Imprimir / PDF</button>}>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{i.aviso}</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Dato t="Jornadas completadas" v={`${r.jornadas_completadas} de ${i.jornadas_total}`} />
          <Dato t="Problemas presentados" v={r.presentados} />
          <Dato t="Intentos válidos" v={r.intentos_validos} />
          <Dato t="Correctas / incorrectas" v={`${r.correctas} / ${r.incorrectas} (${pct} %)`} />
          <Dato t="Sustituidos (comodines)" v={r.cambios} />
          <Dato t="«No puedo resolverlo»" v={r.no_puedo} />
          <Dato t="Tiempo registrado" v={`${Math.round(r.segundos / 60)} min`} />
        </dl>
      </Card>
      <Card title="Temas abordados">
        <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase text-gray-500"><th>Tema</th><th>Presentados</th><th>Válidos</th><th>Correctas</th></tr></thead>
          <tbody>{r.por_tema.map((t) => <tr key={t.tema} className="border-t border-gray-100 dark:border-white/10"><td>{t.nombre ?? t.tema}</td><td>{t.presentados}</td><td>{t.validos}</td><td>{t.correctas}</td></tr>)}</tbody></table>
      </Card>
      <Card title="Evolución por jornada (correctas e incorrectas)">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.por_jornada.map((j) => ({ j: j.numero, correctas: j.correctas, incorrectas: j.incorrectas }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="j" label={{ value: 'Jornada', position: 'insideBottom', offset: -2 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="correctas" stackId="a" fill="#16a34a" name="Correctas" />
              <Bar dataKey="incorrectas" stackId="a" fill="#d97706" name="Incorrectas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <p className="text-xs text-gray-500 no-print"><Link className="enlace" to="/evaluaciones">Volver a Evaluaciones</Link></p>
    </div>
  );
}

function Dato({ t, v }: { t: string; v: string | number }) {
  return <div><dt className="text-xs uppercase text-gray-500">{t}</dt><dd className="font-semibold">{v}</dd></div>;
}
