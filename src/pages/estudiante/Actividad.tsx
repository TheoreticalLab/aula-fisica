import { useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LecturaCronometrada } from '@/components/LecturaCronometrada';
import { formatoTiempo } from '@/lib/lectura';
import { myActivities, startActivityAttempt } from '@/api/estudiante';
import { supabase } from '@/lib/supabase';
import type { Activity } from '@/api/tipos';
import { fecha, puntaje, relativo, useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';

export const REVEAL_TEXT: Record<string, string> = {
  immediate: 'Verá si acierta y la solución al comprobar cada ejercicio.',
  after_submit: 'Verá las respuestas correctas al entregar.',
  after_close: 'Verá las respuestas correctas cuando cierre la actividad.',
  never: 'Las respuestas correctas no se mostrarán.',
};

/** Ficha de la actividad tal como la ve el estudiante (la reutiliza la vista previa del profesor). */
export function FichaActividad({ act, items, maxScore, used, bestScore, children }: {
  act: Activity;
  items?: number;
  maxScore?: number;
  used: number;
  bestScore: number | null;
  children?: ReactNode;
}) {
  const conLectura = !!act.reading_min_seconds && !!act.reading_text;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone={act.mode === 'exam' ? 'purple' : 'blue'}>{act.mode === 'exam' ? 'Evaluación calificable' : 'Práctica de aprendizaje'}</Badge>
        {items !== undefined && <Badge>{items} ejercicios · {maxScore} puntos</Badge>}
        {conLectura && <Badge tone="amber">Lectura previa · mínimo {formatoTiempo(act.reading_min_seconds!)} min</Badge>}
      </div>
      {act.instructions && <Markdown>{act.instructions}</Markdown>}
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-gray-500">Apertura</dt><dd>{act.opens_at ? fecha(act.opens_at) : 'Abierta'}</dd></div>
        <div><dt className="text-gray-500">Cierre</dt><dd>{act.closes_at ? `${fecha(act.closes_at)} (${relativo(act.closes_at)})` : 'Sin fecha límite'}</dd></div>
        <div><dt className="text-gray-500">Intentos</dt><dd>{act.max_attempts === null ? 'Ilimitados' : `${used} de ${act.max_attempts} usados`}</dd></div>
        <div><dt className="text-gray-500">Respuestas correctas</dt><dd>{REVEAL_TEXT[act.reveal_policy]}</dd></div>
        {act.mode === 'practice' && <div><dt className="text-gray-500">Ayudas</dt><dd>{act.hints_enabled ? `Pistas disponibles; ${act.max_tries_per_item} intentos por ejercicio` : `Sin pistas; ${act.max_tries_per_item} intentos por ejercicio`}</dd></div>}
        {bestScore !== null && maxScore !== undefined && <div><dt className="text-gray-500">Mejor calificación</dt><dd className="font-semibold">{puntaje(bestScore, maxScore)}</dd></div>}
      </dl>
      {act.mode === 'exam' && <Notice tone="warn">En una evaluación no hay pistas ni retroalimentación inmediata. Sus respuestas se guardan solas; al terminar pulse «Entregar».</Notice>}
      {children}
    </Card>
  );
}

export default function Actividad() {
  const { activityId = '' } = useParams();
  const nav = useNavigate();
  const { data, loading, error } = useAsync(async () => {
    const [{ data: act, error }, list] = await Promise.all([
      supabase.from('activities').select('*').eq('id', activityId).single(),
      myActivities(),
    ]);
    if (error) throw new Error('Actividad no disponible.');
    return { act: act as Activity, mine: list.find((a) => a.id === activityId) };
  }, [activityId]);
  const action = useAction();
  const [lecturaHecha, setLecturaHecha] = useState(false);
  const alCompletarLectura = useCallback(() => setLecturaHecha(true), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const { act, mine } = data!;
  const conLectura = !!act.reading_min_seconds && !!act.reading_text;
  const bloqueada = conLectura && !lecturaHecha && !mine?.reading_done && !mine?.in_progress;
  const now = Date.now();
  const notOpen = act.opens_at && new Date(act.opens_at).getTime() > now;
  const closed = act.closes_at && new Date(act.closes_at).getTime() <= now;
  const used = mine?.attempts_used ?? 0;
  const left = act.max_attempts === null ? null : act.max_attempts - used;
  async function start() {
    const id = await action.run(() => startActivityAttempt(activityId));
    if (id) nav(`/intento/${id}`);
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title={act.title} subtitle={mine?.class_name} back={{ to: '/', label: 'Inicio' }} />
      <FichaActividad act={act} items={mine?.items} maxScore={mine?.max_score} used={used} bestScore={mine?.best_score ?? null}>
        <ErrorBox error={action.error} />
        <div className="mt-4 flex flex-wrap gap-2">
          {mine?.in_progress ? (
            <button className="btn-primario" onClick={() => nav(`/intento/${mine.in_progress}`)}>Continuar intento</button>
          ) : notOpen ? (
            <p className="text-sm">Se abre {relativo(act.opens_at)}.</p>
          ) : closed ? (
            <p className="text-sm">La actividad está cerrada.</p>
          ) : left !== null && left <= 0 ? (
            <p className="text-sm">Ya usó todos los intentos.</p>
          ) : bloqueada ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">🔒 Los ejercicios se habilitan cuando cumpla el tiempo mínimo de la lectura de abajo.</p>
          ) : (
            <button className="btn-primario" onClick={start} disabled={action.busy}>
              {conLectura ? (used ? 'Nuevo intento de los ejercicios' : 'Ir a los ejercicios') : used ? 'Nuevo intento' : 'Comenzar'}
            </button>
          )}
        </div>
      </FichaActividad>
      {conLectura && !mine?.in_progress && !notOpen && (
        <div className="mt-5">
          <LecturaCronometrada actividadId={activityId} texto={act.reading_text!} onCompletada={alCompletarLectura} />
          {!bloqueada && !closed && !(left !== null && left <= 0) && (
            <div className="mt-4 text-center">
              <button className="btn-primario" onClick={start} disabled={action.busy}>Ir a los ejercicios →</button>
            </div>
          )}
        </div>
      )}
      {mine?.last_attempt_id && (
        <p className="mt-4 text-sm">
          <Link className="enlace" to={`/intento/${mine.last_attempt_id}`}>Revisar mi último intento entregado</Link>
          <span className="text-gray-500"> · lo que pueda ver depende de la configuración de la actividad y de si el profesor publicó las notas.</span>
        </p>
      )}
    </div>
  );
}
