import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { describeKey, interpretNumeric } from '@calif/calificar.ts';
import type { AccionesEjercicio, AttemptItem, AttemptView, GradeResult, Solution, StudentAnswer } from '@/api/tipos';
import { checkAnswer, getHint, reinforcementFor, revealSolution, saveResponse } from '@/api/estudiante';

/** Los estudiantes usan siempre el servidor; la vista previa del profesor pasa una simulación local. */
export const ACCIONES_SERVIDOR: AccionesEjercicio = {
  comprobar: checkAnswer,
  pista: getHint,
  verSolucion: revealSolution,
  guardar: saveResponse,
  refuerzo: reinforcementFor,
};
import { CATEGORIA, DIFICULTAD, porcentaje } from '@/lib/util';
import { Badge, ErrorBox, StatusBadge } from './ui';
import { InlineMd, Markdown } from './Markdown';
import { Figura } from './Grafica';
import { Simulador } from '@/sims/Simulador';
import { useTelemetria } from './Telemetria';
import { describirRespuesta } from '@/lib/telemetria/rastreador';

const LETRAS = 'abcdefghijklmnopqrstuvwxyz';

/** Teclas rápidas para escribir unidades en el móvil. */
const TECLAS = ['·', '/', '^', '²', '³', '×10^', '−', '°', 'm/s', 'm/s²', 'N', 'kg'];

function esVacia(f: string, a: StudentAnswer): boolean {
  if (f === 'choice') return !a.selected?.length;
  if (f === 'truefalse') return typeof a.value !== 'boolean';
  return !a.text?.trim();
}

export function SolucionBox({ solution, options }: { solution: Solution; options?: string[] | null }) {
  return (
    <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-700/60 dark:bg-emerald-900/20">
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Respuesta correcta</p>
      <div className="text-sm">
        <InlineMd>{describeKey(solution.answer, options ?? undefined)}</InlineMd>
      </div>
      {solution.explanation && (
        <>
          <p className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">Explicación</p>
          <Markdown className="text-sm">{solution.explanation}</Markdown>
        </>
      )}
    </div>
  );
}

export function EnunciadoEjercicio({ ex }: { ex: AttemptItem['exercise'] }) {
  return (
    <>
      <Markdown>{ex.prompt}</Markdown>
      {ex.figure && <Figura figure={ex.figure} />}
      {ex.simulation && (
        <div className="my-3 rounded-lg border border-primario-200 p-3 dark:border-primario-700">
          <p className="mb-2 text-sm font-semibold text-primario-800 dark:text-primario-200">Experimento virtual</p>
          <Simulador simKey={ex.simulation.key} params={ex.simulation.params} compact />
        </div>
      )}
    </>
  );
}

export function EntradaRespuesta({
  ex,
  answer,
  onChange,
  disabled,
}: {
  ex: AttemptItem['exercise'];
  answer: StudentAnswer;
  onChange: (a: StudentAnswer) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (ex.format === 'choice') {
    const sel = answer.selected ?? [];
    return (
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="sr-only">Opciones</legend>
        {ex.multiple && <p className="text-xs text-gray-500">Marque todas las opciones correctas.</p>}
        {(ex.options ?? []).map((o, i) => {
          const checked = sel.includes(i);
          return (
            <label key={i} className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${checked ? 'border-primario-500 bg-primario-50 dark:bg-primario-900/40' : 'border-gray-200 dark:border-white/10'}`}>
              <input
                type={ex.multiple ? 'checkbox' : 'radio'}
                name={`op-${ex.id}`}
                className="mt-1 accent-primario-700"
                checked={checked}
                onChange={() => onChange({ selected: ex.multiple ? (checked ? sel.filter((x) => x !== i) : [...sel, i].sort()) : [i] })}
              />
              <span className="font-semibold">{LETRAS[i]})</span>
              <span className="flex-1"><InlineMd>{o}</InlineMd></span>
            </label>
          );
        })}
      </fieldset>
    );
  }
  if (ex.format === 'truefalse') {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" disabled={disabled} onClick={() => onChange({ ...answer, value: v })}
              className={answer.value === v ? 'btn-primario flex-1' : 'btn-secundario flex-1'} aria-pressed={answer.value === v}>
              {v ? 'Verdadero' : 'Falso'}
            </button>
          ))}
        </div>
        <label className="etiqueta" htmlFor={`just-${ex.id}`}>Justificación</label>
        <textarea id={`just-${ex.id}`} className="campo min-h-[80px]" disabled={disabled} value={answer.justification ?? ''}
          onChange={(e) => onChange({ ...answer, justification: e.target.value })} placeholder="Explique por qué con sus palabras." maxLength={5000} />
      </div>
    );
  }
  if (ex.format === 'numeric') {
    const text = answer.text ?? '';
    const interp = text.trim() ? interpretNumeric(text) : null;
    const insert = (s: string) => {
      const el = inputRef.current;
      const ins = s === '−' ? '-' : s.startsWith('m') || s === 'N' || s === 'kg' ? ` ${s}` : s;
      const start = el?.selectionStart ?? text.length;
      const end = el?.selectionEnd ?? text.length;
      const nt = text.slice(0, start) + ins + text.slice(end);
      onChange({ text: nt });
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + ins.length, start + ins.length);
      });
    };
    return (
      <div>
        <label className="etiqueta" htmlFor={`num-${ex.id}`}>Respuesta (número y unidad)</label>
        <input ref={inputRef} id={`num-${ex.id}`} className="campo font-mono" disabled={disabled} value={text} autoComplete="off" autoCapitalize="off" spellCheck={false}
          inputMode="text" placeholder={ex.unit_hint ? `Ejemplo de formato: 12.5 ${ex.unit_hint}` : 'Ejemplo de formato: 9.8 m/s^2'}
          onChange={(e) => onChange({ text: e.target.value })} maxLength={200} />
        {!disabled && (
          <div className="mt-2 flex flex-wrap gap-1" aria-label="Teclas de unidades">
            {TECLAS.map((k) => (
              <button key={k} type="button" className="min-h-[36px] rounded border border-gray-300 px-2 text-sm dark:border-white/20" onClick={() => insert(k)}>
                {k}
              </button>
            ))}
          </div>
        )}
        {interp && <p className={`mt-1 text-xs ${interp.ok ? 'text-gray-500 dark:text-gray-400' : 'text-acento-700 dark:text-acento-300'}`}>{interp.ok ? 'Se interpreta como: ' : ''}{interp.text}</p>}
      </div>
    );
  }
  return (
    <div>
      <label className="etiqueta" htmlFor={`txt-${ex.id}`}>{ex.format === 'open' ? 'Desarrollo' : 'Respuesta'}</label>
      {ex.format === 'open' ? (
        <textarea id={`txt-${ex.id}`} className="campo min-h-[160px]" disabled={disabled} value={answer.text ?? ''} maxLength={5000}
          onChange={(e) => onChange({ text: e.target.value })} placeholder="Escriba el planteamiento, los pasos y el resultado con unidades." />
      ) : (
        <input id={`txt-${ex.id}`} className="campo" disabled={disabled} value={answer.text ?? ''} maxLength={300} onChange={(e) => onChange({ text: e.target.value })} />
      )}
    </div>
  );
}

interface Props {
  index: number;
  item: AttemptItem;
  view: AttemptView;
  onChange: (item: AttemptItem) => void;
  /** Llamado cuando el servidor devuelve un estado nuevo y conviene recargar el intento completo. */
  onReload?: () => void;
  /** Solo la vista previa del profesor lo cambia; por defecto, el servidor. */
  acciones?: AccionesEjercicio;
}

/** Ejercicio dentro de un intento (práctica libre, actividad de práctica o evaluación). */
export function Ejercicio({ index, item, view, onChange, onReload, acciones = ACCIONES_SERVIDOR }: Props) {
  const { exercise: ex, response } = item;
  const practice = view.attempt.mode === 'practice';
  const [answer, setAnswer] = useState<StudentAnswer>(response?.answer ?? {});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [similares, setSimilares] = useState<{ exercise_id: string; lesson_id: string }[] | null>(null);
  const dirty = useRef(false);
  const tel = useTelemetria();
  const tarjeta = useRef<HTMLElement>(null);

  const locked = item.locked || !view.flags.editable;
  const status = response?.status ?? null;

  // telemetría: respuesta de partida y visibilidad de la pregunta en pantalla (≥ 50 %)
  useEffect(() => {
    if (!tel) return;
    tel.conocer(ex.id, describirRespuesta(response?.answer));
    const el = tarjeta.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => tel.vista(ex.id, e.isIntersecting), { threshold: 0.5 });
    obs.observe(el);
    return () => { obs.disconnect(); tel.vista(ex.id, false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tel, ex.id]);

  // guardado automático de borradores
  useEffect(() => {
    if (!dirty.current || locked || !view.flags.is_owner) return;
    const t = setTimeout(async () => {
      setSaved('saving');
      try {
        await acciones.guardar(view.attempt.id, ex.id, answer);
        tel?.guardado(ex.id, true);
        setSaved('saved');
        if (!practice) onChange({ ...item, response: { ...(response ?? emptyResponse()), answer, status: 'draft' } });
      } catch (e) {
        tel?.guardado(ex.id, false);
        setSaved('idle');
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer]);

  const change = (a: StudentAnswer) => {
    dirty.current = true;
    tel?.cambio(ex.id, describirRespuesta(a));
    setSaved('idle');
    setAnswer(a);
    setResult(null);
  };

  async function comprobar() {
    setBusy(true);
    setError(null);
    // señal para el medidor de tiempo efectivo (no lleva el contenido de la respuesta)
    window.dispatchEvent(new CustomEvent('aula:respuesta'));
    tel?.comprobacion(ex.id, 'solicitada');
    try {
      const r = await acciones.comprobar(view.attempt.id, ex.id, answer);
      tel?.comprobacion(ex.id, 'recibida');
      setResult(r.result);
      dirty.current = false;
      if (r.recorded && r.state) {
        onChange({
          ...item,
          locked: r.state.locked,
          solution: r.state.solution ?? item.solution,
          response: {
            ...(response ?? emptyResponse()),
            answer,
            status: r.state.status,
            credit: r.state.credit,
            tries: r.state.tries,
            messages: r.result.messages,
          },
        });
        if (r.state.status !== 'correct' && ex.format !== 'open') {
          acciones.refuerzo(ex.id).then(setSimilares).catch(() => setSimilares([]));
        }
      }
    } catch (e) {
      tel?.comprobacion(ex.id, 'error');
      setError(e instanceof Error ? e.message : String(e));
      onReload?.();
    } finally {
      setBusy(false);
    }
  }

  async function pista() {
    setBusy(true);
    setError(null);
    try {
      const h = await acciones.pista(view.attempt.id, ex.id);
      if (!h.hint) onChange({ ...item, hints_total: h.total });
      else {
        onChange({
          ...item,
          hints_total: h.total,
          hints: [...(item.hints ?? []), h.hint],
          response: { ...(response ?? emptyResponse()), hints_used: h.index },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function verSolucion() {
    if (!window.confirm('Si ve la solución, este ejercicio quedará cerrado y no sumará como resuelto al primer intento. ¿Continuar?')) return;
    setBusy(true);
    try {
      const sol = await acciones.verSolucion(view.attempt.id, ex.id);
      onChange({
        ...item,
        locked: true,
        solution: sol,
        response: { ...(response ?? emptyResponse()), solution_revealed: true, status: status === 'correct' || status === 'partial' ? status : 'revealed' },
      });
      acciones.refuerzo(ex.id).then(setSimilares).catch(() => setSimilares([]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const triesLeft = Math.max(0, view.flags.max_tries - (response?.tries ?? 0));
  const hintsUsed = item.hints?.length ?? 0;
  const showCheck = practice && view.flags.is_owner && !locked && view.flags.correctness_visible;
  const messages = result?.messages ?? (view.flags.correctness_visible ? response?.messages ?? [] : []);
  const resultStatus = result?.status ?? (view.flags.correctness_visible ? status : null);

  return (
    <article className="tarjeta" id={`ej-${ex.id}`} ref={tarjeta} onPointerDownCapture={() => tel?.interaccion(ex.id)} onFocusCapture={() => tel?.interaccion(ex.id)}>
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-serif text-lg font-semibold">Ejercicio {index + 1}</h3>
        <Badge tone={ex.difficulty === 'basico' ? 'green' : ex.difficulty === 'intermedio' ? 'amber' : 'red'}>{DIFICULTAD[ex.difficulty]}</Badge>
        <Badge>{CATEGORIA[ex.category]}</Badge>
        {ex.role === 'reinforcement' && <Badge tone="purple">Refuerzo</Badge>}
        <span className="text-xs text-gray-500">{item.points} pt</span>
        <span className="ml-auto"><StatusBadge status={status} /></span>
      </header>
      <EnunciadoEjercicio ex={ex} />
      <div className="mt-3">
        <EntradaRespuesta ex={ex} answer={answer} onChange={change} disabled={locked || !view.flags.is_owner || busy} />
      </div>

      {item.hints && item.hints.length > 0 && (
        <div className="mt-3 space-y-1">
          {item.hints.map((h, i) => (
            <div key={i} className="rounded-lg bg-acento-100/70 px-3 py-2 text-sm dark:bg-acento-700/20">
              <span className="font-semibold">Pista {i + 1}: </span>
              <InlineMd>{h}</InlineMd>
            </div>
          ))}
        </div>
      )}

      {resultStatus && resultStatus !== 'draft' && resultStatus !== 'submitted' && (messages.length > 0 || result) && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${
          resultStatus === 'correct' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100'
          : resultStatus === 'partial' || resultStatus === 'pending_review' ? 'bg-acento-100 text-acento-700 dark:bg-acento-700/20 dark:text-acento-200'
          : resultStatus === 'invalid' ? 'bg-gray-100 dark:bg-white/10'
          : 'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100'}`} role="status">
          <p className="font-semibold">
            {resultStatus === 'correct' ? '✓ Correcto' : resultStatus === 'partial' ? 'Parcialmente correcto' : resultStatus === 'invalid' ? 'No se pudo interpretar la respuesta' : resultStatus === 'pending_review' ? 'Respuesta registrada' : '✗ Incorrecto'}
            {response?.credit !== null && response?.credit !== undefined && view.flags.score_visible && resultStatus !== 'invalid' && (
              <span className="ml-2 font-normal">(crédito {porcentaje(response.credit)})</span>
            )}
          </p>
          {messages.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
          {result?.status === 'invalid' && <p className="text-xs">Este envío no cuenta como intento.</p>}
        </div>
      )}

      {response?.teacher_feedback && (
        <div className="mt-3 rounded-lg border-l-4 border-primario-500 bg-primario-50 px-3 py-2 text-sm dark:bg-primario-900/30">
          <p className="font-semibold">Comentario del profesor</p>
          <p className="whitespace-pre-wrap">{response.teacher_feedback}</p>
        </div>
      )}

      <ErrorBox error={error} />

      {view.flags.is_owner && view.flags.editable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {showCheck && (
            <button className="btn-primario" disabled={busy || esVacia(ex.format, answer)} onClick={comprobar}>
              {ex.format === 'open' ? 'Enviar' : 'Comprobar'}
            </button>
          )}
          {showCheck && view.flags.hints_enabled && item.hints_total > hintsUsed && (
            <button className="btn-secundario" disabled={busy} onClick={pista}>
              Pista ({hintsUsed}/{item.hints_total})
            </button>
          )}
          {showCheck && view.flags.reveal_allowed && ex.format !== 'open' && (
            <button className="btn-texto" disabled={busy} onClick={verSolucion}>
              Ver solución
            </button>
          )}
          {showCheck && ex.format !== 'open' && (
            <span className="text-xs text-gray-500">
              {triesLeft} {triesLeft === 1 ? 'intento restante' : 'intentos restantes'}
            </span>
          )}
          {!practice && !locked && (
            <span className="text-xs text-gray-500">{saved === 'saving' ? 'Guardando…' : saved === 'saved' ? 'Guardado ✓' : 'Se guarda automáticamente'}</span>
          )}
        </div>
      )}

      {item.solution && <SolucionBox solution={item.solution} options={ex.options} />}

      {similares && similares.length > 0 && view.flags.is_owner && (
        <div className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-sm dark:bg-violet-900/20">
          <p className="font-semibold">Practique con un problema similar</p>
          <ul className="mt-1 space-y-1">
            {similares.map((s, i) => (
              <li key={s.exercise_id}>
                <Link className="enlace" to={`/curso/${view.attempt.course_id}/leccion/${s.lesson_id}?s=practica&refuerzo=${s.exercise_id}`}>
                  Problema de refuerzo {i + 1}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function emptyResponse() {
  return {
    id: '',
    answer: {},
    status: 'draft' as const,
    credit: null,
    messages: [],
    tries: 0,
    hints_used: 0,
    solution_revealed: false,
    teacher_feedback: null,
    manual_credit: null,
    updated_at: new Date().toISOString(),
  };
}
