import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAttempt } from '@/api/estudiante';
import { gradeResponse, responseEvents } from '@/api/docente';
import type { AttemptItem } from '@/api/tipos';
import { CATEGORIA, DIFICULTAD, fecha, porcentaje, puntaje, useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, PageTitle, Spinner, StatusBadge } from '@/components/ui';
import { EnunciadoEjercicio, EntradaRespuesta, SolucionBox } from '@/components/Ejercicio';
import { Markdown } from '@/components/Markdown';
import { TarjetaCronologia } from './lieia/Cronologia';
import { TiemposExamen } from './TiemposExamen';

function Eventos({ responseId }: { responseId: string }) {
  const ev = useAsync(() => responseEvents(responseId), [responseId]);
  if (ev.loading) return <Spinner />;
  return (
    <ul className="space-y-1 text-xs">
      {ev.data?.map((e) => {
        const r = e.result as { status?: string; code?: string; credit?: number; index?: number } | null;
        const a = e.answer as { text?: string; selected?: number[]; value?: boolean } | null;
        return (
          <li key={e.id} className="rounded bg-gray-50 px-2 py-1 dark:bg-white/5">
            <span className="text-gray-500">{fecha(e.created_at)}</span> · <strong>{{ check: 'Comprobación', submit: 'Entrega', hint: 'Pista', reveal: 'Vio la solución', manual_grade: 'Calificación manual' }[e.kind] ?? e.kind}</strong>
            {a && <> · respuesta: <code>{a.text ?? (a.selected ? a.selected.map((i) => String.fromCharCode(97 + i)).join(', ') : a.value === undefined ? '' : a.value ? 'V' : 'F')}</code></>}
            {r?.status && <> · {r.status}</>}
            {r?.code && <> ({r.code})</>}
            {r?.credit !== undefined && <> · crédito {porcentaje(r.credit)}</>}
            {r?.index !== undefined && <> · n.º {r.index}</>}
          </li>
        );
      })}
    </ul>
  );
}

function ItemRevision({ item, index, onSaved }: { item: AttemptItem; index: number; onSaved: () => void }) {
  const r = item.response;
  const ex = item.exercise;
  const [credit, setCredit] = useState<string>(r?.manual_credit !== null && r?.manual_credit !== undefined ? String(Math.round(r.manual_credit * 100)) : '');
  const [fb, setFb] = useState(r?.teacher_feedback ?? '');
  const [log, setLog] = useState(false);
  const action = useAction();
  const [ok, setOk] = useState(false);
  return (
    <article id={r ? `r-${r.id}` : undefined} className="tarjeta">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-serif text-lg font-semibold">Ejercicio {index + 1}</h3>
        <Badge>{DIFICULTAD[ex.difficulty]}</Badge>
        <Badge>{CATEGORIA[ex.category]}</Badge>
        <span className="text-xs text-gray-500">{item.points} pt · <Link className="enlace" to={`/docente/ejercicios/${ex.id}`}>{ex.slug}</Link></span>
        <span className="ml-auto"><StatusBadge status={r?.status} /></span>
      </header>
      <EnunciadoEjercicio ex={ex} />
      <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-white/5">
        <p className="mb-1 text-sm font-semibold">Respuesta del estudiante</p>
        {r ? <EntradaRespuesta ex={ex} answer={r.answer} onChange={() => undefined} disabled /> : <p className="text-sm text-gray-500">Sin respuesta.</p>}
        {r && ex.format === 'open' && r.answer.text && <div className="mt-2 rounded border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-transparent"><Markdown>{r.answer.text}</Markdown></div>}
        {r && (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Calificación automática: {r.status === 'pending_review' ? 'pendiente (revisión manual)' : porcentaje(r.credit)} · intentos: {r.tries} · pistas: {r.hints_used}
            {r.solution_revealed && ' · vio la solución'}
          </p>
        )}
        {r?.messages?.map((m, i) => <p key={i} className="text-xs text-gray-600 dark:text-gray-400">Motor: {m}</p>)}
      </div>
      {item.solution && <SolucionBox solution={item.solution} options={ex.options} />}
      {item.solution?.answer.format === 'open' && <div className="mt-2 rounded-lg bg-primario-50 p-3 text-sm dark:bg-white/5"><p className="font-semibold">Rúbrica</p><Markdown>{item.solution.answer.rubric}</Markdown></div>}
      {r && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr]">
          <label className="text-sm">Crédito manual (%)
            <input type="number" min={0} max={100} className="campo mt-1" value={credit} onChange={(e) => { setOk(false); setCredit(e.target.value); }} placeholder="automático" />
          </label>
          <label className="text-sm">Comentario para el estudiante
            <textarea className="campo mt-1" rows={2} value={fb} onChange={(e) => { setOk(false); setFb(e.target.value); }} maxLength={4000} />
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button className="btn-primario" disabled={action.busy} onClick={async () => {
              const c = credit.trim() === '' ? null : Math.max(0, Math.min(100, Number(credit))) / 100;
              const done = await action.run(async () => { await gradeResponse(r.id, c, fb); return true; });
              if (done) { setOk(true); onSaved(); }
            }}>Guardar calificación</button>
            {[0, 50, 100].map((v) => <button key={v} className="btn-secundario text-sm" onClick={() => setCredit(String(v))}>{v} %</button>)}
            {ok && <span className="text-sm text-emerald-700">Guardado ✓</span>}
            <button className="btn-texto ml-auto text-sm" onClick={() => setLog((l) => !l)}>{log ? 'Ocultar' : 'Ver'} registro de envíos</button>
          </div>
          <ErrorBox error={action.error} />
          {log && <div className="sm:col-span-2"><Eventos responseId={r.id} /></div>}
        </div>
      )}
    </article>
  );
}

export default function RevisionIntento() {
  const { attemptId = '' } = useParams();
  const st = useAsync(() => getAttempt(attemptId), [attemptId]);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} />;
  const v = st.data!;
  if (!v.flags.is_reviewer) return <ErrorBox error="No puede revisar este intento." />;
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title={`Revisión: ${v.student?.full_name ?? ''}`}
        subtitle={<>{v.activity?.title ?? `Práctica libre: ${v.lesson?.title}`} · intento {v.attempt.attempt_number} · {v.attempt.status === 'submitted' ? `entregado ${fecha(v.attempt.submitted_at)}` : 'en curso'}</>}
        back={v.activity ? { to: `/docente/actividades/${v.activity.id}`, label: 'Actividad' } : undefined} />
      <CuerpoRevision v={v} attemptId={attemptId} onSaved={st.reload} conCronologia />
    </div>
  );
}

/** Revisión de un intento dentro de otra página (la ficha del estudiante muestra la cronología aparte). */
export function RevisionIntentoContenido({ attemptId }: { attemptId: string }) {
  const st = useAsync(() => getAttempt(attemptId), [attemptId]);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} />;
  const v = st.data!;
  if (!v.flags.is_reviewer) return <ErrorBox error="No puede revisar este intento." />;
  return <CuerpoRevision v={v} attemptId={attemptId} onSaved={st.reload} conCronologia={false} />;
}

type VistaIntento = Awaited<ReturnType<typeof getAttempt>>;

/** Puntaje, cronología (opcional) y cada respuesta con su calificación manual. */
function CuerpoRevision({ v, attemptId, onSaved, conCronologia }: { v: VistaIntento; attemptId: string; onSaved: () => void; conCronologia: boolean }) {
  const [verProceso, setVerProceso] = useState(false);
  return (
    <>
      <Card className="mb-4">
        <p className="text-sm">Estudiante: <strong>{v.student?.full_name}</strong> {v.student?.student_code && `· ${v.student.student_code}`}</p>
        <p className="text-sm">Puntaje: <strong>{puntaje(v.attempt.score, v.attempt.max_score)}</strong> {v.attempt.needs_review && <Badge tone="red">Hay respuestas por revisar</Badge>}</p>
        {v.activity && !v.activity.grades_published && <p className="mt-1 text-xs text-gray-500">Las calificaciones de esta actividad aún no están publicadas: el estudiante no ve la nota ni los comentarios.</p>}
      </Card>
      <p className="mb-4"><Link className="btn-secundario py-1 text-sm" to={`/docente/intentos/${attemptId}/telemetria`}>⏱ Telemetría V2 — Reconstrucción del intento</Link></p>
      {v.attempt.mode === 'exam' && <TiemposExamen attemptId={attemptId} etiquetas={Object.fromEntries(v.items.map((it) => [it.exercise.id, it.exercise.slug]))} />}
      {conCronologia && (
        <details className="mb-4" open={verProceso} onToggle={(e) => setVerProceso((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-sm font-medium">⏱ Proceso de respuesta (cronología de la telemetría)</summary>
          {verProceso && <div className="mt-2"><TarjetaCronologia attemptId={attemptId} /></div>}
        </details>
      )}
      <div className="space-y-4">
        {v.items.map((it, i) => <ItemRevision key={it.exercise.id} item={it} index={i} onSaved={onSaved} />)}
      </div>
    </>
  );
}
