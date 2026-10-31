/**
 * Práctica con aprendizaje asistido para el estudiante: por ejercicio, cuatro momentos
 *   1 Intentar (primer intento + declaración) · 2 Aprender (corrección) · 3 Explicar (reflexión y fuentes) · 4 Comprobar (transferencia, opcional)
 * Un paso a la vez, una acción principal. Nada avanza hasta que el servidor confirma; el borrador de cada paso se guarda
 * en el dispositivo y el reintento usa el mismo identificador (el servidor no lo duplica).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { asistidaEstado, asistidaPaso, asistidaReflexion, type EstadoAsistida } from '@/api/asistida';
import { submitAttempt } from '@/api/estudiante';
import type { AttemptItem, AttemptView, StudentAnswer } from '@/api/tipos';
import {
  casoReflexion, compararRespuestas, CAMBIO, DECLARACION, FUENTE, pasosVisibles, PREGUNTAS, ultimo,
  type Declaracion, type EstadoItem, type Fuente, type Paso,
} from '@/lib/asistida';
import { porcentaje, useAsync } from '@/lib/util';
import { Badge, ErrorBox, Notice, Spinner } from '@/components/ui';
import { EntradaRespuesta, EnunciadoEjercicio, SolucionBox } from '@/components/Ejercicio';

// ---------- borrador del paso en el dispositivo ----------
interface Borrador { answer: StudentAnswer; procedimiento: string; no_se: boolean; declaracion: Declaracion | null; client_id: string;
  reflexion: Record<string, string>; fuentes: Fuente[]; referencia: { fuente: string; enlace: string; concepto: string; idea: string } }
const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`);
const vacio = (answer: StudentAnswer = {}): Borrador => ({ answer, procedimiento: '', no_se: false, declaracion: null, client_id: nuevoId(), reflexion: {}, fuentes: [],
  referencia: { fuente: '', enlace: '', concepto: '', idea: '' } });

function useBorrador(clave: string, inicial: () => Borrador): [Borrador, (p: Partial<Borrador>) => void, () => void] {
  const [b, setB] = useState<Borrador>(() => { try { const x = localStorage.getItem(clave); if (x) return { ...inicial(), ...JSON.parse(x) }; } catch { /* */ } return inicial(); });
  useEffect(() => { try { const x = localStorage.getItem(clave); setB(x ? { ...inicial(), ...JSON.parse(x) } : inicial()); } catch { setB(inicial()); } }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Borrador>) => setB((x) => { const n = { ...x, ...p }; try { localStorage.setItem(clave, JSON.stringify(n)); } catch { /* */ } return n; });
  const limpiar = () => { try { localStorage.removeItem(clave); } catch { /* */ } };
  return [b, set, limpiar];
}

const Recuadro = ({ titulo, children, tono = 'azul' }: { titulo: string; children: ReactNode; tono?: 'azul' | 'verde' | 'gris' }) => (
  <div className={`rounded-xl border p-4 ${tono === 'verde' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-900/20' : tono === 'gris' ? 'border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5' : 'border-primario-200 bg-primario-50 dark:border-primario-500/30 dark:bg-primario-900/30'}`}>
    <p className="font-semibold">{titulo}</p><div className="mt-1 space-y-2 text-sm">{children}</div>
  </div>
);

function RespuestaGuardada({ ex, paso, titulo }: { ex: AttemptItem['exercise']; paso: Paso; titulo: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo} · {new Date(paso.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}</p>
      {paso.no_se ? <p className="text-sm italic">«No sé resolverlo»</p> : <EntradaRespuesta ex={ex} answer={paso.answer ?? {}} onChange={() => undefined} disabled />}
      {paso.procedimiento && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300">Procedimiento: {paso.procedimiento}</p>}
    </div>
  );
}

export function PracticaAsistida({ view, onEntregado }: { view: AttemptView; onEntregado: () => void }) {
  const attemptId = view.attempt.id;
  const st = useAsync(() => asistidaEstado(attemptId), [attemptId]);
  const [sel, setSel] = useState(0);
  const [entregando, setEntregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const e = st.data as Required<EstadoAsistida>;
  const items = e.items;
  const actualizar = (it: EstadoItem) => st.setData({ ...e, items: items.map((x) => (x.exercise_id === it.exercise_id ? it : x)) });
  const completos = items.filter((x) => x.siguiente === 'completo').length;
  const item = items[sel], vItem = view.items.find((x) => x.exercise.id === item?.exercise_id);
  const editable = view.attempt.status === 'in_progress' && view.flags.is_owner;

  async function finalizar() {
    if (completos < items.length && !window.confirm(`Le faltan ${items.length - completos} ejercicio(s) por completar. Lo pendiente contará solo por lo que haya hecho. ¿Finalizar?`)) return;
    setEntregando(true); setError(null);
    try { await submitAttempt(attemptId); onEntregado(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setEntregando(false); }
  }

  return (
    <div className="space-y-4">
      <Notice>
        <strong>Práctica con aprendizaje asistido.</strong> En cada ejercicio: <strong>1 Intentar</strong> por su cuenta · <strong>2 Aprender</strong> con ayuda (IA, libros, apuntes…) ·
        <strong> 3 Explicar</strong> lo que aprendió{e.config.transferencia ? <> · <strong>4 Comprobar</strong> con un ejercicio nuevo</> : null}. Lo que importa es entender, no solo acertar.
      </Notice>
      {items.length > 1 && (
        <nav aria-label="Ejercicios" className="flex gap-1.5 overflow-x-auto pb-1">
          {items.map((x, i) => (
            <button key={x.exercise_id} onClick={() => setSel(i)} aria-current={i === sel ? 'step' : undefined}
              className={`min-h-[40px] min-w-[40px] shrink-0 rounded-lg border text-sm font-medium ${i === sel ? 'border-primario-600 bg-primario-600 text-white' : x.siguiente === 'completo' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' : 'border-gray-300 dark:border-white/20'}`}>
              {x.siguiente === 'completo' ? '✓' : i + 1}
            </button>
          ))}
          <span className="ml-2 self-center text-xs text-gray-500">{completos}/{items.length} completos</span>
        </nav>
      )}
      {item && vItem && (
        <EjercicioAsistido key={item.exercise_id} index={sel} attemptId={attemptId} item={item} ex={vItem.exercise} config={e.config} editable={editable}
          onActualizar={actualizar} onSiguiente={sel + 1 < items.length ? () => setSel(sel + 1) : null} />
      )}
      <ErrorBox error={error} />
      {editable && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10">
          <span className="text-sm">{completos}/{items.length} ejercicios completos</span>
          <button className="btn-acento" onClick={() => void finalizar()} disabled={entregando}>{entregando ? 'Finalizando…' : 'Finalizar la práctica'}</button>
        </div>
      )}
    </div>
  );
}

function EjercicioAsistido({ index, attemptId, item, ex, config, editable, onActualizar, onSiguiente }: {
  index: number; attemptId: string; item: EstadoItem; ex: AttemptItem['exercise']; config: Required<EstadoAsistida>['config'];
  editable: boolean; onActualizar: (it: EstadoItem) => void; onSiguiente: (() => void) | null;
}) {
  const pasos = pasosVisibles(item.con_transferencia);
  const ini = ultimo(item.pasos, 'inicial'), cor = ultimo(item.pasos, 'corregida'), ref = ultimo(item.pasos, 'reflexion'), tra = ultimo(item.pasos, 'transferencia');
  const actual = item.siguiente === 'completo' ? pasos.length : Math.max(0, pasos.findIndex((p) => p.fase === item.siguiente));
  const [verCorreccion, setVerCorreccion] = useState(false);
  const base = `asistida:${attemptId}:${item.exercise_id}`;
  return (
    <article className="tarjeta space-y-4">
      <header>
        <p className="text-sm text-gray-500">Ejercicio {index + 1}</p>
        {/* indicador de progreso: los cuatro momentos */}
        <ol className="mt-2 flex items-center gap-1 text-xs sm:text-sm" aria-label="Progreso del ejercicio">
          {pasos.map((p, i) => (
            <li key={p.fase} className="flex flex-1 items-center gap-1">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-semibold ${i < actual ? 'border-emerald-500 bg-emerald-500 text-white' : i === actual ? 'border-primario-600 bg-primario-600 text-white' : 'border-gray-300 text-gray-400 dark:border-white/20'}`}
                aria-current={i === actual ? 'step' : undefined}>{i < actual ? '✓' : i + 1}</span>
              <span className={i === actual ? 'font-semibold' : 'text-gray-500'}>{p.titulo}</span>
              {i < pasos.length - 1 && <span className="mx-1 h-px flex-1 bg-gray-200 dark:bg-white/10" />}
            </li>
          ))}
        </ol>
      </header>
      <EnunciadoEjercicio ex={ex} />

      {item.siguiente === 'inicial' && editable && <PasoInicial attemptId={attemptId} item={item} ex={ex} clave={`${base}:inicial`} onActualizar={onActualizar} />}

      {ini && <RespuestaGuardada ex={ex} paso={ini} titulo="Tu respuesta inicial (guardada, no cambia)" />}

      {(item.siguiente === 'corregida' || (verCorreccion && item.siguiente === 'reflexion' && item.correcciones < config.max_correcciones)) && editable && (
        <PasoCorreccion attemptId={attemptId} item={item} ex={ex} clave={`${base}:corregida`} inicial={ini} quedan={config.max_correcciones - item.correcciones}
          onActualizar={(it) => { setVerCorreccion(false); onActualizar(it); }} />
      )}
      {cor && (
        <div>
          <RespuestaGuardada ex={ex} paso={cor} titulo={`Tu respuesta después de estudiar${item.correcciones > 1 ? ` (versión ${cor.version})` : ''}`} />
          <ResultadoMotor paso={cor} />
          {ini && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Cambio: {CAMBIO[compararRespuestas(ex.format, ini, cor).cambio]}{compararRespuestas(ex.format, ini, cor).procedimientoCambio ? ' · cambió el procedimiento' : ''}</p>}
          {item.siguiente === 'reflexion' && editable && !verCorreccion && item.correcciones < config.max_correcciones && cor.status !== 'correct' && (
            <button className="btn-texto mt-1 text-sm" onClick={() => setVerCorreccion(true)}>Volver a corregir (quedan {config.max_correcciones - item.correcciones})</button>
          )}
        </div>
      )}

      {item.siguiente === 'reflexion' && editable && !verCorreccion && <PasoReflexion attemptId={attemptId} item={item} clave={`${base}:reflexion`} onActualizar={onActualizar} />}
      {ref && (
        <Recuadro titulo="Lo que explicaste" tono="gris">
          {Object.entries(ref.reflexion ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => <p key={k} className="whitespace-pre-wrap">{v}</p>)}
          {!!ref.fuentes?.length && <p className="text-xs text-gray-500">Ayudas usadas: {ref.fuentes.map((f) => FUENTE[f]).join(', ')}</p>}
        </Recuadro>
      )}
      {item.solucion && <SolucionBox solution={item.solucion as never} options={ex.options} />}

      {item.siguiente === 'transferencia' && item.transferencia && editable && <PasoTransferencia attemptId={attemptId} item={item} clave={`${base}:transferencia`} onActualizar={onActualizar} />}
      {tra && item.transferencia && (
        <div>
          <p className="text-sm font-semibold">Demostraste lo aprendido en un ejercicio nuevo:</p>
          <RespuestaGuardada ex={{ ...ex, ...item.transferencia, options: item.transferencia.options } as AttemptItem['exercise']} paso={tra} titulo="Tu respuesta" />
          <ResultadoMotor paso={tra} />
        </div>
      )}

      {item.siguiente === 'completo' && (
        <Recuadro titulo="✓ Ejercicio completado" tono="verde">
          {item.calificacion && <p>Valoración de este ejercicio: <strong>{porcentaje(item.calificacion.credito)}</strong> (participación, corrección, explicación{item.calificacion.transferencia !== null ? ' y comprobación' : ''}; no depende de si declaró usar ayuda).</p>}
          {onSiguiente && <button className="btn-primario mt-1" onClick={onSiguiente}>Siguiente ejercicio →</button>}
        </Recuadro>
      )}
      {item.siguiente === 'completo' && config.verificacion.tipo && (
        <p className="text-xs text-gray-500">Habrá una comprobación posterior de este tema{config.verificacion.tipo === 'fecha' && config.verificacion.fecha ? ` (${new Date(config.verificacion.fecha).toLocaleDateString('es-DO')})` : config.verificacion.tipo === 'examen' ? ' en un examen' : config.verificacion.tipo === 'presencial' ? ' en clase' : ' en otra sesión'}.{config.verificacion.nota ? ` ${config.verificacion.nota}` : ''}</p>
      )}
    </article>
  );
}

function ResultadoMotor({ paso }: { paso: Paso }) {
  if (!paso.status) return null;
  const tono = paso.status === 'correct' ? 'green' : paso.status === 'partial' ? 'amber' : 'red';
  return (
    <div className="mt-1 text-sm">
      <Badge tone={tono}>{paso.status === 'correct' ? 'Correcta' : paso.status === 'partial' ? 'Parcialmente correcta' : paso.status === 'pending_review' ? 'La revisará el profesor' : 'Todavía no es correcta'}</Badge>
      {(paso.messages ?? []).map((m) => <p key={m} className="mt-1 text-xs text-gray-600 dark:text-gray-300">{m}</p>)}
    </div>
  );
}

/** Envío con confirmación del servidor; si la red falla, el borrador sigue aquí y el reintento reutiliza el mismo id. */
function useEnvio() {
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'error'>('listo');
  const [mensaje, setMensaje] = useState<string | null>(null);
  async function enviar<T>(fn: () => Promise<T>): Promise<T | null> {
    if (!navigator.onLine) { setEstado('error'); setMensaje('Sin conexión. Su respuesta sigue guardada en este dispositivo; pulse de nuevo cuando vuelva la red.'); return null; }
    setEstado('enviando'); setMensaje(null);
    try { const r = await fn(); setEstado('listo'); return r; }
    catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setEstado('error');
      setMensaje(/conexión|fetch|network/i.test(m) ? 'No se pudo guardar por la conexión. Su respuesta sigue aquí; pulse de nuevo (no se guardará dos veces).' : m);
      return null;
    }
  }
  return { estado, mensaje, enviar, setMensaje };
}

function PasoInicial({ attemptId, item, ex, clave, onActualizar }: { attemptId: string; item: EstadoItem; ex: AttemptItem['exercise']; clave: string; onActualizar: (it: EstadoItem) => void }) {
  const [b, set, limpiar] = useBorrador(clave, () => vacio());
  const [declarar, setDeclarar] = useState(false);
  const env = useEnvio();
  const tieneAlgo = b.no_se || !!(b.answer.text?.trim() || b.answer.selected?.length || typeof b.answer.value === 'boolean');
  async function guardar() {
    const r = await env.enviar(() => asistidaPaso({ fase: 'inicial', attempt_id: attemptId, exercise_id: item.exercise_id, client_id: b.client_id,
      answer: b.no_se ? undefined : b.answer, procedimiento: b.procedimiento, no_se: b.no_se, declaracion: b.declaracion ?? undefined }));
    if (!r) return;
    if (!r.guardado) { env.setMensaje((r.mensajes ?? []).join(' ')); setDeclarar(false); return; }
    limpiar();
    if (r.estado) onActualizar(r.estado);
  }
  return (
    <div className="space-y-3">
      <Recuadro titulo="1 · Primero intenta resolverlo por ti mismo">
        <p>Esta primera respuesta nos ayuda a conocer cómo comprendes el ejercicio antes de consultar herramientas externas.</p>
        <p>Intenta resolverlo con tus propios conocimientos. <strong>No necesitas acertar para continuar aprendiendo.</strong></p>
      </Recuadro>
      {!b.no_se && <EntradaRespuesta ex={ex} answer={b.answer} onChange={(a) => set({ answer: a })} disabled={env.estado === 'enviando'} />}
      <label className="block text-sm"><span className="etiqueta">Tus operaciones o una explicación breve (opcional)</span>
        <textarea className="campo" rows={3} value={b.procedimiento} maxLength={5000} onChange={(e) => set({ procedimiento: e.target.value })} placeholder="Escribe los pasos que seguiste." /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.no_se} onChange={(e) => set({ no_se: e.target.checked })} /> No sé resolverlo todavía</label>
      {!declarar ? (
        <button className="btn-primario w-full sm:w-auto" disabled={!tieneAlgo || env.estado === 'enviando'} onClick={() => setDeclarar(true)}>Guardar mi primer intento</button>
      ) : (
        <fieldset className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
          <legend className="px-1 font-semibold">¿Cómo realizaste este primer intento?</legend>
          {(Object.keys(DECLARACION) as Declaracion[]).map((d) => (
            <label key={d} className="flex items-start gap-2 py-1.5 text-sm"><input type="radio" name={`decl-${item.exercise_id}`} checked={b.declaracion === d} onChange={() => set({ declaracion: d })} className="mt-1" /> {DECLARACION[d]}</label>
          ))}
          <p className="mt-1 text-xs text-gray-500">Es una declaración voluntaria para fines pedagógicos. No cambia tu nota y no se presenta como una verificación técnica.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primario" disabled={!b.declaracion || env.estado === 'enviando'} onClick={() => void guardar()}>{env.estado === 'enviando' ? 'Guardando…' : 'Confirmar y guardar'}</button>
            <button className="btn-secundario" onClick={() => setDeclarar(false)} disabled={env.estado === 'enviando'}>Volver</button>
          </div>
        </fieldset>
      )}
      {env.mensaje && <ErrorBox error={env.mensaje} />}
    </div>
  );
}

function PasoCorreccion({ attemptId, item, ex, clave, inicial, quedan, onActualizar }: {
  attemptId: string; item: EstadoItem; ex: AttemptItem['exercise']; clave: string; inicial: Paso | null; quedan: number; onActualizar: (it: EstadoItem) => void;
}) {
  const [b, set, limpiar] = useBorrador(clave, () => ({ ...vacio(inicial?.answer ?? {}), procedimiento: inicial?.procedimiento ?? '' }));
  const env = useEnvio();
  async function guardar() {
    const r = await env.enviar(() => asistidaPaso({ fase: 'corregida', attempt_id: attemptId, exercise_id: item.exercise_id, client_id: b.client_id, answer: b.answer, procedimiento: b.procedimiento }));
    if (!r) return;
    if (!r.guardado) { env.setMensaje((r.mensajes ?? []).join(' ')); return; }
    limpiar();
    if (r.estado) onActualizar(r.estado);
  }
  return (
    <div className="space-y-3">
      {item.correcciones === 0 && (
        <Recuadro titulo="2 · Ahora puedes aprender con ayuda">
          <p>Ya guardamos tu primera respuesta.</p>
          <p>Ahora puedes consultar inteligencia artificial, libros, apuntes, explicaciones o cualquier recurso permitido para comprender mejor este problema.</p>
          <p><strong>El objetivo no es solamente conseguir la respuesta correcta, sino entender por qué lo es.</strong></p>
        </Recuadro>
      )}
      <p className="text-sm font-semibold">Tu respuesta después de estudiar</p>
      <EntradaRespuesta ex={ex} answer={b.answer} onChange={(a) => set({ answer: a })} disabled={env.estado === 'enviando'} />
      <label className="block text-sm"><span className="etiqueta">Tu procedimiento corregido</span>
        <textarea className="campo" rows={3} value={b.procedimiento} maxLength={5000} onChange={(e) => set({ procedimiento: e.target.value })} /></label>
      <button className="btn-primario w-full sm:w-auto" disabled={env.estado === 'enviando'} onClick={() => void guardar()}>{env.estado === 'enviando' ? 'Guardando…' : 'Guardar mi corrección'}</button>
      <p className="text-xs text-gray-500">Comprobaciones disponibles: {quedan}. Si ya estabas seguro, confirma tu respuesta tal como está.</p>
      {env.mensaje && <ErrorBox error={env.mensaje} />}
    </div>
  );
}

function PasoReflexion({ attemptId, item, clave, onActualizar }: { attemptId: string; item: EstadoItem; clave: string; onActualizar: (it: EstadoItem) => void }) {
  const caso = casoReflexion(item.pasos);
  const [b, set, limpiar] = useBorrador(clave, () => vacio());
  const env = useEnvio();
  const preguntas = PREGUNTAS[caso];
  const alguna = Object.values(b.reflexion).some((v) => (v ?? '').trim().length >= 15);
  const alternarFuente = (f: Fuente) => set({ fuentes: b.fuentes.includes(f) ? b.fuentes.filter((x) => x !== f) : f === 'ninguna' ? ['ninguna'] : [...b.fuentes.filter((x) => x !== 'ninguna'), f] });
  async function guardar() {
    const ref = b.referencia.fuente.trim() ? [{ fuente: b.referencia.fuente.trim(), enlace: b.referencia.enlace.trim() || undefined, concepto: b.referencia.concepto.trim() || undefined, idea: b.referencia.idea.trim() || undefined }] : [];
    const r = await env.enviar(() => asistidaReflexion(attemptId, item.exercise_id, b.reflexion, b.fuentes, ref, b.client_id));
    if (!r) return;
    limpiar();
    onActualizar(r);
  }
  return (
    <div className="space-y-3">
      <Recuadro titulo="3 · Explica lo que aprendiste">
        <p>{caso === 'incorrecto' ? 'Tu primer intento no era correcto, y eso está bien: ahí está el aprendizaje.' : caso === 'correcto' ? 'Tu primer intento ya era correcto. No hace falta inventar un error.' : 'Al principio no sabías resolverlo. Cuéntanos qué te permitió avanzar.'} Responde con tus palabras; basta con frases cortas.</p>
      </Recuadro>
      {preguntas.map((p) => (
        <label key={p.clave} className="block text-sm"><span className="etiqueta">{p.texto}</span>
          <textarea className="campo" rows={2} maxLength={1500} value={b.reflexion[p.clave] ?? ''} placeholder={p.ejemplo ? `Ejemplo: ${p.ejemplo}` : ''}
            onChange={(e) => set({ reflexion: { ...b.reflexion, [p.clave]: e.target.value } })} /></label>
      ))}
      <fieldset>
        <legend className="etiqueta">¿Qué ayudas usaste? (puedes marcar varias)</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FUENTE) as Fuente[]).map((f) => (
            <label key={f} className={`flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-sm ${b.fuentes.includes(f) ? 'border-primario-500 bg-primario-50 dark:bg-primario-900/40' : 'border-gray-300 dark:border-white/20'}`}>
              <input type="checkbox" className="sr-only" checked={b.fuentes.includes(f)} onChange={() => alternarFuente(f)} />{FUENTE[f]}
            </label>
          ))}
        </div>
      </fieldset>
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 dark:text-gray-300">Añadir una referencia (opcional)</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className="campo" placeholder="Herramienta o fuente" value={b.referencia.fuente} onChange={(e) => set({ referencia: { ...b.referencia, fuente: e.target.value } })} maxLength={120} />
          <input className="campo" placeholder="Enlace (si existe)" value={b.referencia.enlace} onChange={(e) => set({ referencia: { ...b.referencia, enlace: e.target.value } })} maxLength={300} />
          <input className="campo" placeholder="Concepto consultado" value={b.referencia.concepto} onChange={(e) => set({ referencia: { ...b.referencia, concepto: e.target.value } })} maxLength={150} />
          <input className="campo" placeholder="Idea que te ayudó" value={b.referencia.idea} onChange={(e) => set({ referencia: { ...b.referencia, idea: e.target.value } })} maxLength={300} />
        </div>
        <p className="mt-1 text-xs text-gray-500">No hace falta copiar conversaciones privadas ni dar acceso a cuentas externas.</p>
      </details>
      <button className="btn-primario w-full sm:w-auto" disabled={!alguna || env.estado === 'enviando'} onClick={() => void guardar()}>{env.estado === 'enviando' ? 'Guardando…' : 'Guardar mi explicación'}</button>
      {!alguna && <p className="text-xs text-gray-500">Escribe al menos una respuesta de una frase.</p>}
      {env.mensaje && <ErrorBox error={env.mensaje} />}
    </div>
  );
}

function PasoTransferencia({ attemptId, item, clave, onActualizar }: { attemptId: string; item: EstadoItem; clave: string; onActualizar: (it: EstadoItem) => void }) {
  const t = item.transferencia!;
  const ex = { id: t.id, slug: '', lesson_id: null, category: 'numerica', difficulty: 'intermedio', role: 'bank', format: t.format, concepts: t.concepts,
    prompt: t.prompt, options: t.options, multiple: t.multiple, figure: t.figure, simulation: null, unit_hint: t.unit_hint } as unknown as AttemptItem['exercise'];
  const [b, set, limpiar] = useBorrador(clave, () => vacio());
  const env = useEnvio();
  async function guardar() {
    const r = await env.enviar(() => asistidaPaso({ fase: 'transferencia', attempt_id: attemptId, exercise_id: item.exercise_id, client_id: b.client_id, answer: b.answer, procedimiento: b.procedimiento }));
    if (!r) return;
    if (!r.guardado) { env.setMensaje((r.mensajes ?? []).join(' ')); return; }
    limpiar();
    if (r.estado) onActualizar(r.estado);
  }
  return (
    <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-white/10">
      <Recuadro titulo="4 · Demuestra lo que aprendiste">
        <p>Un ejercicio distinto con el mismo concepto. Tienes una sola oportunidad: intenta resolverlo con lo que acabas de aprender.</p>
      </Recuadro>
      <EnunciadoEjercicio ex={ex} />
      <EntradaRespuesta ex={ex} answer={b.answer} onChange={(a) => set({ answer: a })} disabled={env.estado === 'enviando'} />
      <label className="block text-sm"><span className="etiqueta">Tu procedimiento (opcional)</span>
        <textarea className="campo" rows={2} value={b.procedimiento} maxLength={5000} onChange={(e) => set({ procedimiento: e.target.value })} /></label>
      <button className="btn-primario w-full sm:w-auto" disabled={env.estado === 'enviando' || !(b.answer.text?.trim() || b.answer.selected?.length || typeof b.answer.value === 'boolean')}
        onClick={() => void guardar()}>{env.estado === 'enviando' ? 'Comprobando…' : 'Comprobar mi aprendizaje'}</button>
      {env.mensaje && <ErrorBox error={env.mensaje} />}
    </div>
  );
}
