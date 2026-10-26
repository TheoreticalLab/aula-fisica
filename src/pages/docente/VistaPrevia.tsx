/**
 * Vista previa de una actividad «como estudiante». Usa los MISMOS componentes que ve el estudiante (ficha,
 * lectura cronometrada, ejercicios, barra de entrega) con una simulación local: se califica con el mismo motor
 * y las mismas reglas, pero no se guarda nada ni cuenta para calificaciones o estadísticas.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { vistaPreviaActividad } from '@/api/docente';
import type { Activity, ActivityItem, AttemptItem, AttemptView, Exercise, ExerciseKeyRow } from '@/api/tipos';
import { Ejercicio } from '@/components/Ejercicio';
import { LecturaCronometrada, type ServicioLectura } from '@/components/LecturaCronometrada';
import { Markdown } from '@/components/Markdown';
import { Badge, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { crearSimulador, lecturaSimulada } from '@/lib/simulacion';
import { puntaje, useAsync } from '@/lib/util';
import { FichaActividad, REVEAL_TEXT } from '../estudiante/Actividad';

type Datos = Awaited<ReturnType<typeof vistaPreviaActividad>>;

export default function VistaPrevia() {
  const { activityId = '' } = useParams();
  const st = useAsync(() => vistaPreviaActividad(activityId), [activityId]);
  const [ronda, setRonda] = useState(0);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  return <Simulacion key={ronda} datos={st.data!} onReiniciar={() => setRonda((r) => r + 1)} />;
}

function itemsIniciales(items: ActivityItem[], exercises: Exercise[], claves: Map<string, ExerciseKeyRow>): AttemptItem[] {
  const porId = new Map(exercises.map((e) => [e.id, e]));
  return items
    .filter((i) => porId.has(i.exercise_id))
    .map((i) => {
      const e = porId.get(i.exercise_id)!;
      return {
        exercise: {
          id: e.id, slug: e.slug, lesson_id: e.lesson_id, category: e.category, difficulty: e.difficulty, role: e.role, format: e.format,
          concepts: e.concepts, prompt: e.prompt, options: e.options, multiple: e.multiple, figure: e.figure, simulation: e.simulation, unit_hint: e.unit_hint,
        },
        points: Number(i.points ?? e.points),
        response: null,
        hints: null,
        hints_total: claves.get(e.id)?.hints.length ?? 0,
        locked: false,
        solution: null,
      };
    });
}

function vista(act: Activity, courseId: string, items: AttemptItem[]): AttemptView {
  const practica = act.mode === 'practice';
  return {
    attempt: {
      id: 'vista-previa', status: 'in_progress', mode: act.mode, attempt_number: 1, started_at: new Date().toISOString(), submitted_at: null,
      score: null, max_score: items.reduce((s, i) => s + i.points, 0), needs_review: false, lesson_id: null, activity_id: act.id, course_id: courseId,
    },
    activity: act,
    lesson: null,
    student: null,
    flags: {
      is_owner: true, is_reviewer: false, editable: true,
      correctness_visible: practica && act.reveal_policy === 'immediate',
      score_visible: act.grades_published || (practica && act.reveal_policy === 'immediate'),
      feedback_visible: false,
      max_tries: act.max_tries_per_item,
      hints_enabled: practica && act.hints_enabled,
      reveal_allowed: practica && act.reveal_policy === 'immediate',
    },
    items,
  };
}

function Simulacion({ datos, onReiniciar }: { datos: Datos; onReiniciar: () => void }) {
  const { act, cls, items, exercises, keys } = datos;
  const claves = useMemo(() => new Map(keys.map((k) => [k.exercise_id, k])), [keys]);
  const sim = useMemo(() => crearSimulador(act, claves, new Map(exercises.map((e) => [e.id, e.options?.length ?? 0]))), [act, claves, exercises]);
  const lectura = useMemo(() => (act.reading_min_seconds && act.reading_text ? lecturaSimulada(act.reading_min_seconds) : null), [act]);
  const servicio = useMemo<ServicioLectura | undefined>(() => (lectura ? { estado: lectura.estado, latido: lectura.latido } : undefined), [lectura]);
  const [fase, setFase] = useState<'portada' | 'intento'>('portada');
  const [lecturaHecha, setLecturaHecha] = useState(false);
  const [lecturaKey, setLecturaKey] = useState(0);
  const [verClaves, setVerClaves] = useState(false);
  const [view, setView] = useState<AttemptView>(() => vista(act, cls.course_id, itemsIniciales(items, exercises, claves)));
  const [resumen, setResumen] = useState<{ score: number; max: number } | null>(null);
  const alCompletar = useCallback(() => setLecturaHecha(true), []);

  const conLectura = !!lectura;
  const bloqueada = conLectura && !lecturaHecha;
  const update = (i: number) => (it: AttemptItem) => setView((v) => ({ ...v, items: v.items.map((x, j) => (j === i ? it : x)) }));
  const sinClave = view.items.filter((it) => !claves.has(it.exercise.id)).length;
  const sinResponder = view.items.filter((it) => {
    const a = it.response?.answer ?? sim.respuesta(it.exercise.id);
    return !a || (!a.text?.trim() && !a.selected?.length && typeof a.value !== 'boolean');
  }).length;

  function alternarClaves() {
    const ver = !verClaves;
    setVerClaves(ver);
    setView((v) => ({
      ...v,
      items: v.items.map((it) => {
        const k = claves.get(it.exercise.id);
        if (ver && k) return { ...it, solution: it.solution ?? { answer: k.answer, explanation: k.explanation } };
        return it.locked || v.attempt.status === 'submitted' ? it : { ...it, solution: null };
      }),
    }));
  }

  function entregar() {
    const msg = sinResponder
      ? `Quedan ${sinResponder} ejercicios sin responder. Si entrega ahora, contarán como incorrectos. ¿Entregar?`
      : '¿Entregar el intento? Después no podrá modificar sus respuestas.';
    if (!window.confirm(msg)) return;
    const r = sim.entregar(new Map(view.items.map((it) => [it.exercise.id, it.points])));
    const cerro = !!act.closes_at && new Date(act.closes_at).getTime() <= Date.now();
    const correctas = act.reveal_policy === 'immediate' || act.reveal_policy === 'after_submit' || (act.reveal_policy === 'after_close' && cerro);
    const nota = act.grades_published || (act.mode === 'practice' && act.reveal_policy === 'immediate');
    setResumen({ score: r.score, max: r.max });
    setView((v) => ({
      ...v,
      attempt: { ...v.attempt, status: 'submitted', submitted_at: new Date().toISOString(), score: nota ? r.score : null },
      flags: { ...v.flags, editable: false, correctness_visible: correctas, score_visible: nota },
      items: v.items.map((it) => {
        const res = r.porEjercicio.get(it.exercise.id)!;
        const k = claves.get(it.exercise.id);
        return {
          ...it,
          locked: true,
          response: {
            id: it.exercise.id, answer: it.response?.answer ?? sim.respuesta(it.exercise.id) ?? {},
            status: correctas ? res.status : 'submitted', credit: nota ? res.credit : null, messages: correctas ? res.messages : [],
            tries: it.response?.tries ?? 0, hints_used: it.response?.hints_used ?? 0, solution_revealed: false,
            teacher_feedback: null, manual_credit: null, updated_at: new Date().toISOString(),
          },
          solution: (correctas || verClaves) && k ? { answer: k.answer, explanation: k.explanation } : null,
        };
      }),
    }));
    window.scrollTo({ top: 0 });
  }

  const banner = (
    <div className="sticky top-14 z-40 mb-4 rounded-xl border-2 border-dashed border-acento-500 bg-acento-100/95 p-3 text-sm text-primario-950 shadow backdrop-blur dark:bg-acento-700/30 dark:text-acento-100">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">👁 Vista previa como estudiante</span>
        <span className="text-xs">Así lo verá un estudiante de {cls.name}. Se califica con el mismo motor, pero nada se guarda ni cuenta.</span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button className="btn-texto text-xs" onClick={alternarClaves}>{verClaves ? 'Ocultar respuestas' : 'Ver respuestas (solo usted)'}</button>
          <button className="btn-texto text-xs" onClick={onReiniciar}>Reiniciar</button>
          <Link className="btn-texto text-xs" to={`/docente/actividades/${act.id}`}>Volver al editor</Link>
        </span>
      </div>
      {!act.published && <p className="mt-1 text-xs">Borrador: los estudiantes todavía <strong>no</strong> ven esta actividad.</p>}
      {sinClave > 0 && <p className="mt-1 text-xs text-red-800 dark:text-red-200">⚠ {sinClave} ejercicio(s) sin clave de respuesta: no se podrán calificar.</p>}
    </div>
  );

  if (fase === 'portada') {
    return (
      <div className="mx-auto max-w-3xl">
        {banner}
        <PageTitle title={act.title} subtitle={cls.name} />
        <FichaActividad act={act} items={view.items.length} maxScore={view.attempt.max_score ?? 0} used={0} bestScore={null}>
          <div className="mt-4 flex flex-wrap gap-2">
            {view.items.length === 0 ? (
              <p className="text-sm text-gray-600">Esta actividad todavía no tiene ejercicios.</p>
            ) : bloqueada ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">🔒 Los ejercicios se habilitan cuando cumpla el tiempo mínimo de la lectura de abajo.</p>
            ) : (
              <button className="btn-primario" onClick={() => { setFase('intento'); window.scrollTo({ top: 0 }); }}>{conLectura ? 'Ir a los ejercicios' : 'Comenzar'}</button>
            )}
          </div>
        </FichaActividad>
        {conLectura && servicio && (
          <div className="mt-5">
            <LecturaCronometrada key={lecturaKey} actividadId={act.id} texto={act.reading_text!} onCompletada={alCompletar} servicio={servicio} />
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {bloqueada ? (
                <button className="btn-secundario text-sm" onClick={() => { lectura!.completar(); setLecturaKey((k) => k + 1); }}>
                  Saltar la lectura (solo en la vista previa)
                </button>
              ) : (
                <button className="btn-primario" onClick={() => { setFase('intento'); window.scrollTo({ top: 0 }); }}>Ir a los ejercicios →</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { attempt, flags } = view;
  return (
    <div className="mx-auto max-w-3xl">
      {banner}
      <PageTitle
        title={act.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={attempt.mode === 'exam' ? 'purple' : 'blue'}>{attempt.mode === 'exam' ? 'Evaluación' : 'Práctica'}</Badge>
            <span>Intento 1</span>
            {attempt.status === 'submitted' ? <Badge tone="green">Entregado</Badge> : <Badge tone="amber">En curso</Badge>}
          </span>
        }
      />
      {act.instructions && attempt.status === 'in_progress' && <div className="tarjeta mb-4"><Markdown>{act.instructions}</Markdown></div>}
      {attempt.status === 'submitted' && (
        <>
          <Notice tone="ok">Intento entregado. {REVEAL_TEXT[act.reveal_policy]}</Notice>
          <div className="tarjeta mb-4">
            <p className="text-sm">
              Calificación:{' '}
              {flags.score_visible && attempt.score !== null ? <strong className="text-lg">{puntaje(attempt.score, attempt.max_score)}</strong> : <span>pendiente de publicación por el profesor</span>}
            </p>
            {!flags.correctness_visible && <p className="mt-1 text-xs text-gray-500">{REVEAL_TEXT[act.reveal_policy]}</p>}
          </div>
          {resumen && (
            <p className="mb-4 rounded-lg border border-dashed border-acento-500 p-2 text-xs">
              Solo para usted: con estas respuestas, la nota sería <strong>{puntaje(resumen.score, resumen.max)}</strong>
              {!flags.score_visible && ' (el estudiante la verá cuando publique las calificaciones)'}.
            </p>
          )}
        </>
      )}
      <div className="space-y-4">
        {view.items.map((it, i) => (
          <Ejercicio key={it.exercise.id} index={i} item={it} view={view} onChange={update(i)} acciones={sim} />
        ))}
      </div>
      {attempt.status === 'in_progress' && (
        <div className="sticky bottom-20 z-30 mt-6 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-primario-950/95 md:bottom-4">
          <span className="text-sm">{sinResponder ? `${sinResponder} sin responder` : 'Todo respondido'}</span>
          <button className="btn-acento" onClick={entregar}>Entregar</button>
        </div>
      )}
    </div>
  );
}
