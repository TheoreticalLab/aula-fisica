import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAttempt, submitAttempt } from '@/api/estudiante';
import type { AttemptItem } from '@/api/tipos';
import { fecha, puntaje, relativo, useAction, useAsync } from '@/lib/util';
import { Badge, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { Ejercicio } from '@/components/Ejercicio';
import { Markdown } from '@/components/Markdown';
import { REVEAL_TEXT } from './Actividad';
import { AvisoTelemetria, TelemetriaProvider, useTelemetria } from '@/components/Telemetria';
import { examOpen, type AperturaExamen } from '@/api/examen';
import { ExamenUnaALaVez } from './ExamenUnaALaVez';

/** Botón de entrega con los eventos de envío (solicitado → recibido por el servidor, o error). */
function BotonEntregar({ entregar, ocupado }: { entregar: (tel: ReturnType<typeof useTelemetria>) => void; ocupado: boolean }) {
  const tel = useTelemetria();
  return <button className="btn-acento" onClick={() => entregar(tel)} disabled={ocupado}>{ocupado ? 'Entregando…' : 'Entregar'}</button>;
}

export default function Intento() {
  const { attemptId = '' } = useParams();
  const st = useAsync(() => getAttempt(attemptId), [attemptId]);
  const action = useAction();
  const [justSubmitted, setJustSubmitted] = useState(false);
  // motor de examen: solo para evaluaciones en curso del propio estudiante; si no está configurado, interfaz clásica
  const usaMotor = !!st.data && st.data.flags.is_owner && st.data.attempt.mode === 'exam' && st.data.attempt.status === 'in_progress';
  const apertura = useAsync(() => (usaMotor ? examOpen(attemptId) : Promise.resolve({ modo: 'clasico' } as AperturaExamen)), [attemptId, usaMotor]);
  if ((st.loading && !st.data) || (usaMotor && apertura.loading && !apertura.data)) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const view = st.data!;
  const { attempt, activity, flags } = view;
  if (usaMotor && apertura.error) return <ErrorBox error={apertura.error} onRetry={apertura.reload} />;
  if (usaMotor && apertura.data?.modo === 'una_a_la_vez') {
    const servidor = apertura.data;
    return (
      <TelemetriaProvider attemptId={attempt.id} activo>
        <PageTitle title={activity?.title ?? 'Evaluación'} subtitle={<Badge tone="purple">Evaluación · una pregunta a la vez</Badge>}
          back={activity ? { to: `/actividad/${activity.id}`, label: 'Actividad' } : undefined} />
        {servidor.estado === 'vencido' && <Notice tone="warn">El tiempo oficial terminó. Ya no puede cambiar respuestas; se entregará lo guardado.</Notice>}
        <ExamenUnaALaVez view={view} servidor={servidor}
          onItems={(items) => st.setData({ ...view, items })}
          onEntregado={() => { setJustSubmitted(true); void st.reload(); }} />
      </TelemetriaProvider>
    );
  }
  const update = (i: number) => (it: AttemptItem) => {
    const items = [...view.items];
    items[i] = it;
    st.setData({ ...view, items });
  };
  const sinResponder = view.items.filter((it) => {
    const a = it.response?.answer;
    return !a || (!a.text?.trim() && !a.selected?.length && typeof a.value !== 'boolean');
  }).length;
  const vencido = activity?.closes_at && new Date(activity.closes_at).getTime() <= Date.now();

  async function entregar(tel: ReturnType<typeof useTelemetria>) {
    const msg = sinResponder
      ? `Quedan ${sinResponder} ejercicios sin responder. Si entrega ahora, contarán como incorrectos. ¿Entregar?`
      : '¿Entregar el intento? Después no podrá modificar sus respuestas.';
    if (!window.confirm(msg)) return;
    tel?.envio('solicitado');
    // pequeña espera para que se guarden los últimos borradores
    await new Promise((r) => setTimeout(r, 1300));
    const r = await action.run(() => submitAttempt(attempt.id));
    tel?.envio(r ? 'recibido' : 'error');
    if (r) {
      setJustSubmitted(true);
      await st.reload();
    }
  }

  return (
    <TelemetriaProvider attemptId={attempt.id} activo={flags.is_owner && attempt.status === 'in_progress'}>
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title={activity?.title ?? view.lesson?.title ?? 'Intento'}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={attempt.mode === 'exam' ? 'purple' : 'blue'}>{attempt.mode === 'exam' ? 'Evaluación' : 'Práctica'}</Badge>
            <span>Intento {attempt.attempt_number}</span>
            {attempt.status === 'submitted' ? <Badge tone="green">Entregado {fecha(attempt.submitted_at)}</Badge> : <Badge tone="amber">En curso</Badge>}
            {activity?.closes_at && attempt.status === 'in_progress' && <span>Cierra {relativo(activity.closes_at)}</span>}
          </span>
        }
        back={activity ? { to: `/actividad/${activity.id}`, label: 'Actividad' } : undefined}
      />
      {view.student && flags.is_reviewer && <Notice>Vista del profesor: intento de {view.student.full_name}. <Link className="enlace" to={`/docente/intentos/${attempt.id}`}>Abrir revisión</Link></Notice>}
      {activity?.instructions && attempt.status === 'in_progress' && <div className="tarjeta mb-4"><Markdown>{activity.instructions}</Markdown></div>}
      {justSubmitted && <Notice tone="ok">Intento entregado. {activity ? REVEAL_TEXT[activity.reveal_policy] : ''}</Notice>}
      {attempt.status === 'submitted' && (
        <div className="tarjeta mb-4">
          <p className="text-sm">
            Calificación:{' '}
            {flags.score_visible && attempt.score !== null ? (
              <strong className="text-lg">{puntaje(attempt.score, attempt.max_score)}</strong>
            ) : (
              <span>pendiente de publicación por el profesor</span>
            )}
            {attempt.needs_review && flags.score_visible && <span className="ml-2 text-xs text-gray-500">(hay respuestas pendientes de revisión manual)</span>}
          </p>
          {!flags.correctness_visible && <p className="mt-1 text-xs text-gray-500">{activity ? REVEAL_TEXT[activity.reveal_policy] : ''}</p>}
        </div>
      )}
      {attempt.status === 'in_progress' && vencido && flags.is_owner && (
        <Notice tone="warn">El plazo terminó. Ya no puede cambiar respuestas, pero puede entregar lo que guardó a tiempo para que se califique.</Notice>
      )}
      <div className="space-y-4">
        {view.items.map((it, i) => (
          <Ejercicio key={it.exercise.id} index={i} item={it} view={view} onChange={update(i)} onReload={st.reload} />
        ))}
      </div>
      <ErrorBox error={action.error} />
      {attempt.status === 'in_progress' && flags.is_owner && activity && (
        <div className="sticky bottom-20 z-30 mt-6 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-primario-950/95 md:bottom-4">
          <span className="text-sm">{sinResponder ? `${sinResponder} sin responder` : 'Todo respondido'}</span>
          <BotonEntregar entregar={(tel) => void entregar(tel)} ocupado={action.busy} />
        </div>
      )}
      {flags.is_owner && attempt.status === 'in_progress' && <div className="mt-3"><AvisoTelemetria /></div>}
    </div>
    </TelemetriaProvider>
  );
}
