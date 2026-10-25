import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { grade, interpretNumeric, validateNumericKey } from '@calif/calificar.ts';
import { deleteExercise, getExerciseFull, isCourseStaff, saveExercise } from '@/api/docente';
import { getConcepts, getLessonList } from '@/api/estudiante';
import type { AnswerKey, Category, Difficulty, Exercise, ExerciseRole, Figure, Format, GradeResult, StudentAnswer } from '@/api/tipos';
import { CATEGORIA, DIFICULTAD, FORMATO, useAction, useAsync } from '@/lib/util';
import { Card, ErrorBox, Field, Notice, PageTitle, Spinner, StatusBadge } from '@/components/ui';
import { EditorMarkdown } from '@/components/EditorMarkdown';
import { EnunciadoEjercicio, EntradaRespuesta, SolucionBox } from '@/components/Ejercicio';
import { resolveParams, SIMULATIONS, getSimulation } from '@/sims/catalogo';
import { slugify } from './CursoEditor';

type Draft = Omit<Exercise, 'id' | 'updated_at'> & { id?: string };

function defaultKey(format: Format): AnswerKey {
  switch (format) {
    case 'choice': return { format, correct: [0], optionFeedback: {} };
    case 'truefalse': return { format, value: true, modelJustification: '' };
    case 'numeric': return { format, value: '' };
    case 'text': return { format, accepted: [''] };
    case 'open': return { format, rubric: '' };
  }
}

function figureToText(f: Figure | null): string {
  if (!f) return '';
  return f.series.map((s) => `# ${s.name}\n${s.points.map(([x, y]) => `${x}, ${y}`).join('\n')}`).join('\n');
}

function textToSeries(t: string): Figure['series'] {
  const series: Figure['series'] = [];
  let cur: Figure['series'][number] | null = null;
  for (const line of t.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (line.startsWith('#')) {
      cur = { name: line.slice(1).trim() || `Serie ${series.length + 1}`, points: [] };
      series.push(cur);
      continue;
    }
    const m = line.split(/[;,\s]+/).map(Number);
    if (m.length >= 2 && m.every(Number.isFinite)) {
      if (!cur) {
        cur = { name: 'Serie 1', points: [] };
        series.push(cur);
      }
      cur.points.push([m[0], m[1]]);
    }
  }
  return series;
}

function KeyEditor({ draft, k, onChange }: { draft: Draft; k: AnswerKey; onChange: (k: AnswerKey) => void }) {
  if (k.format === 'choice') {
    const opts = draft.options ?? [];
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">Marque la(s) opción(es) correcta(s) y explique por qué cada opción incorrecta es un error típico.</p>
        {opts.map((o, i) => {
          const ok = k.correct.includes(i);
          return (
            <div key={i} className="rounded border border-gray-200 p-2 dark:border-white/10">
              <label className="flex items-center gap-2 text-sm">
                <input type={draft.multiple ? 'checkbox' : 'radio'} name="correcta" checked={ok}
                  onChange={() => onChange({ ...k, correct: draft.multiple ? (ok ? k.correct.filter((x) => x !== i) : [...k.correct, i].sort()) : [i] })} />
                <strong>{String.fromCharCode(97 + i)})</strong> <span className="truncate">{o || '(vacía)'}</span> {ok && <span className="text-emerald-700">correcta</span>}
              </label>
              {!ok && (
                <input className="campo mt-1 py-1 text-sm" placeholder="Retroalimentación si el estudiante elige esta opción" value={k.optionFeedback?.[i] ?? ''}
                  onChange={(e) => onChange({ ...k, optionFeedback: { ...(k.optionFeedback ?? {}), [i]: e.target.value } })} />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  if (k.format === 'truefalse') {
    return (
      <div>
        <div className="mb-2 flex gap-2">
          <button type="button" className={k.value ? 'btn-primario' : 'btn-secundario'} onClick={() => onChange({ ...k, value: true })}>Verdadero</button>
          <button type="button" className={!k.value ? 'btn-primario' : 'btn-secundario'} onClick={() => onChange({ ...k, value: false })}>Falso</button>
        </div>
        <EditorMarkdown label="Justificación modelo" value={k.modelJustification} onChange={(v) => onChange({ ...k, modelJustification: v })} rows={3} />
      </div>
    );
  }
  if (k.format === 'numeric') {
    const errors = k.value ? validateNumericKey(k) : [];
    const interp = k.value ? interpretNumeric(k.value) : null;
    return (
      <div className="space-y-2">
        <Field label="Respuesta correcta (número y unidad)" hint="Ejemplos: 20 m/s · -4.9 m · 3.0e8 m/s · 36.9 ° · 0.25 (adimensional). Se aceptará cualquier unidad equivalente.">
          {(id) => <input id={id} className="campo font-mono" value={k.value} onChange={(e) => onChange({ ...k, value: e.target.value })} />}
        </Field>
        {interp && <p className={`text-xs ${interp.ok ? 'text-gray-500' : 'text-red-700'}`}>{interp.text}</p>}
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-sm">Tolerancia relativa (%)
            <input type="number" min={0} max={50} step={0.1} className="campo mt-1" value={(k.relTol ?? 0.02) * 100} onChange={(e) => onChange({ ...k, relTol: Number(e.target.value) / 100 })} />
          </label>
          <label className="text-sm">Tolerancia absoluta (SI, opcional)
            <input type="number" min={0} step="any" className="campo mt-1" value={k.absTol ?? ''} onChange={(e) => onChange({ ...k, absTol: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </label>
          <label className="text-sm">Cifras significativas (opcional)
            <input type="number" min={1} max={10} className="campo mt-1" value={k.sigFigs ?? ''} onChange={(e) => onChange({ ...k, sigFigs: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!k.strictSigFigs} onChange={(e) => onChange({ ...k, strictSigFigs: e.target.checked })} /> Las cifras significativas restan crédito</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={k.unitRequired !== false} onChange={(e) => onChange({ ...k, unitRequired: e.target.checked ? undefined : false })} /> Exigir la unidad</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!k.temperatureInterval} onChange={(e) => onChange({ ...k, temperatureInterval: e.target.checked || undefined })} /> °C como diferencia de temperatura</label>
        </div>
        <Field label="Unidad exigida (opcional)" hint="Solo en preguntas de conversión: obliga a responder en esta unidad exacta, p. ej. m/s.">
          {(id) => <input id={id} className="campo font-mono" value={k.expectUnit ?? ''} onChange={(e) => onChange({ ...k, expectUnit: e.target.value || undefined })} />}
        </Field>
        <Field label="Otras respuestas aceptadas (una por línea)">
          {(id) => <textarea id={id} className="campo font-mono text-sm" rows={2} value={(k.alternatives ?? []).join('\n')}
            onChange={(e) => onChange({ ...k, alternatives: e.target.value.split('\n').filter((x) => x.trim()) })} />}
        </Field>
        <p className="etiqueta">Errores típicos y su explicación</p>
        {(k.commonErrors ?? []).map((ce, i) => (
          <div key={i} className="grid grid-cols-[8rem_1fr_auto] gap-1">
            <input className="campo px-2 py-1 font-mono text-sm" value={ce.value} placeholder="72 m/s" aria-label="Valor erróneo"
              onChange={(e) => onChange({ ...k, commonErrors: k.commonErrors!.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
            <input className="campo px-2 py-1 text-sm" value={ce.message} placeholder="Olvidó convertir km/h a m/s." aria-label="Mensaje"
              onChange={(e) => onChange({ ...k, commonErrors: k.commonErrors!.map((x, j) => (j === i ? { ...x, message: e.target.value } : x)) })} />
            <button type="button" className="btn-texto px-1 text-xs text-red-700" onClick={() => onChange({ ...k, commonErrors: k.commonErrors!.filter((_, j) => j !== i) })} aria-label="Quitar">✕</button>
          </div>
        ))}
        <button type="button" className="btn-texto text-sm" onClick={() => onChange({ ...k, commonErrors: [...(k.commonErrors ?? []), { value: '', message: '' }] })}>+ Error típico</button>
        {errors.length > 0 && <ErrorBox error={errors.join(' · ')} />}
      </div>
    );
  }
  if (k.format === 'text') {
    return (
      <Field label="Respuestas aceptadas (una por línea)" hint="Se comparan sin mayúsculas, tildes ni signos de puntuación; se toleran errores de una letra.">
        {(id) => <textarea id={id} className="campo" rows={3} value={k.accepted.join('\n')} onChange={(e) => onChange({ ...k, accepted: e.target.value.split('\n') })} />}
      </Field>
    );
  }
  return <EditorMarkdown label="Rúbrica para la revisión manual" value={k.rubric} onChange={(v) => onChange({ ...k, rubric: v })} rows={5} />;
}

export default function EjercicioEditor() {
  const { exerciseId = 'nuevo' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const isNew = exerciseId === 'nuevo';
  const st = useAsync(async () => {
    if (isNew) {
      const courseId = params.get('curso') ?? '';
      const lessonId = params.get('leccion');
      const draft: Draft = {
        course_id: courseId, lesson_id: lessonId, slug: '', position: 100, category: 'numerica', difficulty: 'basico', role: lessonId ? 'practice' : 'bank',
        format: 'numeric', concepts: [], prompt: '', options: null, multiple: false, figure: null, simulation: null, unit_hint: null, points: 1, published: true,
      };
      return { draft, key: defaultKey('numeric'), hints: [''], explanation: '' };
    }
    const { exercise, key } = await getExerciseFull(exerciseId);
    return { draft: exercise as Draft, key: key?.answer ?? defaultKey(exercise.format), hints: key?.hints ?? [], explanation: key?.explanation ?? '' };
  }, [exerciseId]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [key, setKey] = useState<AnswerKey | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [explanation, setExplanation] = useState('');
  const [figText, setFigText] = useState('');
  const [test, setTest] = useState<StudentAnswer>({});
  const [testResult, setTestResult] = useState<GradeResult | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const action = useAction();
  useEffect(() => {
    if (!st.data) return;
    setDraft(st.data.draft);
    setKey(st.data.key);
    setHints(st.data.hints);
    setExplanation(st.data.explanation);
    setFigText(figureToText(st.data.draft.figure));
  }, [st.data]);
  const courseId = draft?.course_id ?? '';
  const meta = useAsync(async () => {
    if (!courseId) return { lessons: [], concepts: [], canEdit: false };
    const [lessons, concepts, canEdit] = await Promise.all([getLessonList(courseId), getConcepts(courseId), isCourseStaff(courseId)]);
    return { lessons, concepts, canEdit };
  }, [courseId]);
  const conceptOptions = useMemo(() => {
    const cs = meta.data?.concepts ?? [];
    return [...cs].sort((a, b) => Number(b.lesson_id === draft?.lesson_id) - Number(a.lesson_id === draft?.lesson_id) || a.name.localeCompare(b.name));
  }, [meta.data, draft?.lesson_id]);
  if (st.loading || !draft || !key) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} />;
  const set = (p: Partial<Draft>) => { setSavedMsg(false); setDraft({ ...draft, ...p }); };
  const setFormat = (format: Format) => {
    set({ format, options: format === 'choice' ? draft.options ?? ['', '', '', ''] : null, multiple: format === 'choice' ? draft.multiple : false });
    if (key.format !== format) setKey(defaultKey(format));
    setTest({});
    setTestResult(null);
  };
  const canEdit = meta.data?.canEdit ?? false;
  const numericErrors = key.format === 'numeric' ? (key.value ? validateNumericKey(key) : ['Falta la respuesta correcta.']) : [];

  async function guardar() {
    const slug = draft!.slug.trim() || `${slugify(draft!.prompt.replace(/[$\\{}]/g, ' ')).slice(0, 30)}-${Date.now().toString(36).slice(-5)}`;
    const figure = draft!.figure ? { ...draft!.figure, series: textToSeries(figText) } : null;
    const cleanKey: AnswerKey =
      key!.format === 'choice'
        ? { ...key!, optionFeedback: Object.fromEntries(Object.entries(key!.optionFeedback ?? {}).filter(([i, v]) => v.trim() && !key!.correct.includes(Number(i)))) }
        : key!.format === 'text'
          ? { ...key!, accepted: key!.accepted.map((a) => a.trim()).filter(Boolean) }
          : key!.format === 'numeric'
            ? { ...key!, commonErrors: (key!.commonErrors ?? []).filter((c) => c.value.trim() && c.message.trim()) }
            : key!;
    const saved = await action.run(() =>
      saveExercise({ ...draft!, slug, figure }, { answer: cleanKey, hints: hints.map((h) => h.trim()).filter(Boolean), explanation }),
    );
    if (saved) {
      setSavedMsg(true);
      if (isNew) nav(`/docente/ejercicios/${saved.id}`, { replace: true });
      else st.setData({ draft: saved, key: cleanKey, hints, explanation });
    }
  }
  async function borrar() {
    if (!draft?.id || !window.confirm('¿Borrar definitivamente este ejercicio? Si ya tiene respuestas de estudiantes no se podrá borrar: despublíquelo.')) return;
    const ok = await action.run(async () => { await deleteExercise(draft.id!); return true; });
    if (ok) nav(-1);
  }
  const sim = draft.simulation;
  const simInfo = sim ? getSimulation(sim.key) : undefined;
  const previewEx = { ...draft, id: draft.id ?? 'vista-previa', figure: draft.figure ? { ...draft.figure, series: textToSeries(figText) } : null };

  return (
    <div>
      <PageTitle title={isNew ? 'Nuevo ejercicio' : `Ejercicio ${draft.slug}`} back={{ to: `/docente/ejercicios?curso=${courseId}`, label: 'Banco de ejercicios' }} />
      {!canEdit && !meta.loading && <Notice tone="warn">Solo lectura: no pertenece al equipo docente de este curso.</Notice>}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-4">
          <Card title="Clasificación">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Lección">
                {(id) => (
                  <select id={id} className="campo" value={draft.lesson_id ?? ''} onChange={(e) => set({ lesson_id: e.target.value || null })}>
                    <option value="">Sin lección (solo banco)</option>
                    {meta.data?.lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Rol">
                {(id) => (
                  <select id={id} className="campo" value={draft.role} onChange={(e) => set({ role: e.target.value as ExerciseRole })}>
                    <option value="practice">Práctica de la lección</option>
                    <option value="reinforcement">Refuerzo</option>
                    <option value="bank">Banco (solo en actividades)</option>
                  </select>
                )}
              </Field>
              <Field label="Tipo pedagógico">
                {(id) => <select id={id} className="campo" value={draft.category} onChange={(e) => set({ category: e.target.value as Category })}>{Object.entries(CATEGORIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
              </Field>
              <Field label="Dificultad">
                {(id) => <select id={id} className="campo" value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>{Object.entries(DIFICULTAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
              </Field>
              <Field label="Formato de respuesta">
                {(id) => <select id={id} className="campo" value={draft.format} onChange={(e) => setFormat(e.target.value as Format)}>{Object.entries(FORMATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
              </Field>
              <Field label="Puntos">{(id) => <input id={id} type="number" min={0.25} step={0.25} className="campo" value={draft.points} onChange={(e) => set({ points: Number(e.target.value) })} />}</Field>
              <Field label="Identificador" hint="Se genera solo si lo deja vacío.">{(id) => <input id={id} className="campo font-mono text-sm" value={draft.slug} onChange={(e) => set({ slug: e.target.value })} />}</Field>
              <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.published} onChange={(e) => set({ published: e.target.checked })} /> Publicado</label>
            </div>
            <p className="etiqueta mt-2">Conceptos evaluados</p>
            <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              {conceptOptions.map((c) => {
                const on = draft.concepts.includes(c.slug);
                return (
                  <button key={c.id} type="button" onClick={() => set({ concepts: on ? draft.concepts.filter((x) => x !== c.slug) : [...draft.concepts, c.slug] })}
                    className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-primario-600 bg-primario-600 text-white' : 'border-gray-300 dark:border-white/20'}`}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Enunciado">
            <EditorMarkdown value={draft.prompt} onChange={(v) => set({ prompt: v })} rows={6} />
            {draft.format === 'choice' && (
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.multiple} onChange={(e) => set({ multiple: e.target.checked })} /> Varias respuestas correctas</label>
                {(draft.options ?? []).map((o, i) => (
                  <div key={i} className="mb-1 flex gap-1">
                    <span className="mt-2 w-5 text-sm font-semibold">{String.fromCharCode(97 + i)})</span>
                    <input className="campo text-sm" value={o} onChange={(e) => set({ options: draft.options!.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Opción ${i + 1}`} />
                    <button type="button" className="btn-texto px-1 text-xs text-red-700" onClick={() => set({ options: draft.options!.filter((_, j) => j !== i) })} aria-label="Quitar opción">✕</button>
                  </div>
                ))}
                <button type="button" className="btn-texto text-sm" onClick={() => set({ options: [...(draft.options ?? []), ''] })}>+ Opción</button>
              </div>
            )}
            {draft.format === 'numeric' && (
              <Field label="Unidad sugerida (opcional)" hint="Aparece como ejemplo de formato en el campo de respuesta.">
                {(id) => <input id={id} className="campo" value={draft.unit_hint ?? ''} onChange={(e) => set({ unit_hint: e.target.value || null })} />}
              </Field>
            )}
            <details className="mt-3" open={!!draft.figure}>
              <summary className="cursor-pointer text-sm font-medium">Gráfica del enunciado</summary>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!draft.figure} onChange={(e) => set({ figure: e.target.checked ? { kind: 'line', x: { label: 't', unit: 's' }, y: { label: 'x', unit: 'm' }, series: [] } : null })} /> Incluir gráfica
              </label>
              {draft.figure && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select className="campo" value={draft.figure.kind} onChange={(e) => set({ figure: { ...draft.figure!, kind: e.target.value as 'line' | 'scatter' } })} aria-label="Tipo de gráfica">
                    <option value="line">Líneas</option><option value="scatter">Puntos (datos experimentales)</option>
                  </select>
                  <input className="campo" placeholder="Título" value={draft.figure.title ?? ''} onChange={(e) => set({ figure: { ...draft.figure!, title: e.target.value || undefined } })} aria-label="Título de la gráfica" />
                  <input className="campo" placeholder="Eje x (variable)" value={draft.figure.x.label} onChange={(e) => set({ figure: { ...draft.figure!, x: { ...draft.figure!.x, label: e.target.value } } })} aria-label="Eje x" />
                  <input className="campo" placeholder="Unidad x" value={draft.figure.x.unit ?? ''} onChange={(e) => set({ figure: { ...draft.figure!, x: { ...draft.figure!.x, unit: e.target.value || undefined } } })} aria-label="Unidad x" />
                  <input className="campo" placeholder="Eje y (variable)" value={draft.figure.y.label} onChange={(e) => set({ figure: { ...draft.figure!, y: { ...draft.figure!.y, label: e.target.value } } })} aria-label="Eje y" />
                  <input className="campo" placeholder="Unidad y" value={draft.figure.y.unit ?? ''} onChange={(e) => set({ figure: { ...draft.figure!, y: { ...draft.figure!.y, unit: e.target.value || undefined } } })} aria-label="Unidad y" />
                  <div className="sm:col-span-2">
                    <label className="etiqueta">Datos: un punto «x, y» por línea; «# nombre» empieza otra serie</label>
                    <textarea className="campo font-mono text-sm" rows={6} value={figText} onChange={(e) => setFigText(e.target.value)} placeholder={'# x(t)\n0, 3\n2, 6\n4, 9'} />
                  </div>
                </div>
              )}
            </details>
            <details className="mt-3" open={!!sim}>
              <summary className="cursor-pointer text-sm font-medium">Experimento virtual (simulador en el enunciado)</summary>
              <select className="campo mt-2" value={sim?.key ?? ''} aria-label="Simulador" onChange={(e) => set({ simulation: e.target.value ? { key: e.target.value, params: resolveParams(e.target.value, {}) } : null })}>
                <option value="">Ninguno</option>
                {SIMULATIONS.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
              </select>
              {sim && simInfo && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {simInfo.params.map((p) => (
                    <label key={p.name} className="flex items-center justify-between gap-2 text-sm">{p.label} ({p.unit})
                      <input type="number" className="campo w-24 py-1 text-right" min={p.min} max={p.max} step={p.step} value={sim.params?.[p.name] ?? p.default}
                        onChange={(e) => set({ simulation: { ...sim, params: { ...resolveParams(sim.key, sim.params), [p.name]: Number(e.target.value) } } })} />
                    </label>
                  ))}
                </div>
              )}
            </details>
          </Card>

          <Card title="Clave de respuesta (protegida)">
            <p className="mb-2 text-xs text-gray-500">Se guarda en una tabla a la que los estudiantes no tienen acceso. La calificación se hace en el servidor.</p>
            <KeyEditor draft={draft} k={key} onChange={(k) => { setSavedMsg(false); setKey(k); }} />
          </Card>

          <Card title="Pistas progresivas">
            {hints.map((h, i) => (
              <div key={i} className="flex gap-1">
                <div className="flex-1"><EditorMarkdown label={`Pista ${i + 1}`} value={h} onChange={(v) => setHints(hints.map((x, j) => (j === i ? v : x)))} rows={2} /></div>
                <button type="button" className="btn-texto self-start text-xs text-red-700" onClick={() => setHints(hints.filter((_, j) => j !== i))} aria-label="Quitar pista">✕</button>
              </div>
            ))}
            <button type="button" className="btn-texto text-sm" onClick={() => setHints([...hints, ''])}>+ Pista</button>
            <p className="text-xs text-gray-500">De la más general a la más concreta, sin dar el resultado.</p>
          </Card>

          <Card title="Explicación de la solución">
            <EditorMarkdown value={explanation} onChange={setExplanation} rows={6} />
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card title="Vista previa (como la verá el estudiante)">
            <EnunciadoEjercicio ex={previewEx} />
            <div className="mt-3">
              <EntradaRespuesta ex={previewEx} answer={test} onChange={(a) => { setTest(a); setTestResult(null); }} disabled={false} />
            </div>
            <button type="button" className="btn-secundario mt-3" onClick={() => {
              try { setTestResult(grade(key, test, draft.options?.length)); } catch (e) { setTestResult({ status: 'invalid', credit: 0, messages: [e instanceof Error ? e.message : String(e)], code: 'key_error' }); }
            }}>Probar la calificación</button>
            {testResult && (
              <div className="mt-2 text-sm">
                <StatusBadge status={testResult.status === 'invalid' ? null : testResult.status} /> crédito {Math.round(testResult.credit * 100)} % · código {testResult.code}
                {testResult.messages.map((m, i) => <p key={i}>{m}</p>)}
              </div>
            )}
            <SolucionBox solution={{ answer: key, explanation }} options={draft.options} />
          </Card>
        </div>
      </div>
      <ErrorBox error={action.error} />
      {canEdit && (
        <div className="sticky bottom-20 z-30 mt-4 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg dark:border-white/10 dark:bg-primario-950/95 md:bottom-4">
          {numericErrors.length > 0 && <span className="text-sm text-red-700">Revise la clave numérica.</span>}
          {savedMsg && <span className="text-sm text-emerald-700">Guardado ✓</span>}
          {!isNew && <button className="btn-peligro" onClick={borrar} disabled={action.busy}>Borrar</button>}
          <button className="btn-primario" onClick={guardar} disabled={action.busy || numericErrors.length > 0 || !draft.prompt.trim()}>Guardar</button>
        </div>
      )}
    </div>
  );
}
