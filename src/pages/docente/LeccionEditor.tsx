import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { deleteConcept, isCourseStaff, listExercises, updateLesson, upsertConcept } from '@/api/docente';
import { getConcepts, getLesson } from '@/api/estudiante';
import type { Difficulty, Formula, Lesson, LessonSimulation, WorkedExample } from '@/api/tipos';
import { CATEGORIA, DIFICULTAD, useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Field, Notice, PageTitle, Spinner, Tabs } from '@/components/ui';
import { EditorMarkdown } from '@/components/EditorMarkdown';
import { Tex } from '@/components/Markdown';
import { getSimulation, resolveParams, SIMULATIONS } from '@/sims/catalogo';
import { Simulador } from '@/sims/Simulador';
import { slugify } from './CursoEditor';

type Sec = 'datos' | 'teoria' | 'formulas' | 'ejemplos' | 'simulacion' | 'practica';

function FormulaEditor({ f, onChange, onRemove, onMove }: { f: Formula; onChange: (f: Formula) => void; onRemove: () => void; onMove: (d: -1 | 1) => void }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="mb-2 flex gap-1">
        <input className="campo" placeholder="Nombre de la fórmula" value={f.name} onChange={(e) => onChange({ ...f, name: e.target.value })} aria-label="Nombre" />
        <button className="btn-texto" onClick={() => onMove(-1)} aria-label="Subir">↑</button>
        <button className="btn-texto" onClick={() => onMove(1)} aria-label="Bajar">↓</button>
        <button className="btn-texto text-red-700" onClick={onRemove}>Quitar</button>
      </div>
      <label className="etiqueta">Ecuación (LaTeX)</label>
      <input className="campo font-mono text-sm" value={f.latex} onChange={(e) => onChange({ ...f, latex: e.target.value })} placeholder="x = x_0 + v\,t" />
      <div className="my-2 rounded bg-primario-50 py-2 text-center dark:bg-white/5">{f.latex ? <Tex display>{f.latex}</Tex> : <span className="text-xs text-gray-400">vista previa</span>}</div>
      <EditorMarkdown label="Descripción" value={f.description} onChange={(v) => onChange({ ...f, description: v })} rows={2} />
      <p className="etiqueta">Variables</p>
      <div className="space-y-1">
        {f.variables.map((v, i) => (
          <div key={i} className="grid grid-cols-[6rem_1fr_6rem_auto] items-center gap-1">
            <input className="campo px-2 py-1 font-mono text-xs" value={v.symbol} placeholder="v_0" aria-label="Símbolo"
              onChange={(e) => onChange({ ...f, variables: f.variables.map((x, j) => (j === i ? { ...x, symbol: e.target.value } : x)) })} />
            <input className="campo px-2 py-1 text-sm" value={v.meaning} placeholder="Significado" aria-label="Significado"
              onChange={(e) => onChange({ ...f, variables: f.variables.map((x, j) => (j === i ? { ...x, meaning: e.target.value } : x)) })} />
            <input className="campo px-2 py-1 text-sm" value={v.unit} placeholder="m/s" aria-label="Unidad"
              onChange={(e) => onChange({ ...f, variables: f.variables.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) })} />
            <button className="btn-texto px-1 text-xs text-red-700" onClick={() => onChange({ ...f, variables: f.variables.filter((_, j) => j !== i) })} aria-label="Quitar variable">✕</button>
          </div>
        ))}
      </div>
      <button className="btn-texto mt-1 text-sm" onClick={() => onChange({ ...f, variables: [...f.variables, { symbol: '', meaning: '', unit: '' }] })}>+ Variable</button>
      <EditorMarkdown label="Notas (opcional)" value={f.notes ?? ''} onChange={(v) => onChange({ ...f, notes: v || undefined })} rows={2} />
    </div>
  );
}

function EjemploEditor({ ex, onChange, onRemove, onMove }: { ex: WorkedExample; onChange: (e: WorkedExample) => void; onRemove: () => void; onMove: (d: -1 | 1) => void }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="mb-2 flex gap-1">
        <input className="campo" placeholder="Título del ejemplo" value={ex.title} onChange={(e) => onChange({ ...ex, title: e.target.value })} aria-label="Título" />
        <button className="btn-texto" onClick={() => onMove(-1)} aria-label="Subir">↑</button>
        <button className="btn-texto" onClick={() => onMove(1)} aria-label="Bajar">↓</button>
        <button className="btn-texto text-red-700" onClick={onRemove}>Quitar</button>
      </div>
      <EditorMarkdown label="Enunciado" value={ex.statement} onChange={(v) => onChange({ ...ex, statement: v })} rows={3} />
      {ex.steps.map((s, i) => (
        <div key={i} className="flex gap-1">
          <div className="flex-1"><EditorMarkdown label={`Paso ${i + 1}`} value={s} onChange={(v) => onChange({ ...ex, steps: ex.steps.map((x, j) => (j === i ? v : x)) })} rows={2} /></div>
          <button className="btn-texto self-start text-xs text-red-700" onClick={() => onChange({ ...ex, steps: ex.steps.filter((_, j) => j !== i) })} aria-label="Quitar paso">✕</button>
        </div>
      ))}
      <button className="btn-texto mb-2 text-sm" onClick={() => onChange({ ...ex, steps: [...ex.steps, ''] })}>+ Paso</button>
      <EditorMarkdown label="Resultado" value={ex.result} onChange={(v) => onChange({ ...ex, result: v })} rows={2} />
      <EditorMarkdown label="Interpretación (opcional)" value={ex.interpretation ?? ''} onChange={(v) => onChange({ ...ex, interpretation: v || undefined })} rows={2} />
    </div>
  );
}

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export default function LeccionEditor() {
  const { lessonId = '' } = useParams();
  const st = useAsync(async () => {
    const lesson = await getLesson(lessonId);
    const [concepts, exercises, canEdit] = await Promise.all([getConcepts(lesson.course_id), listExercises({ courseId: lesson.course_id, lessonId }), isCourseStaff(lesson.course_id)]);
    return { lesson, concepts, exercises, canEdit };
  }, [lessonId]);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [sec, setSec] = useState<Sec>('datos');
  const [saved, setSaved] = useState(false);
  const [concept, setConcept] = useState('');
  const action = useAction();
  useEffect(() => {
    if (st.data) setDraft(st.data.lesson);
  }, [st.data]);
  if (st.loading || !draft) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} />;
  const { concepts, exercises, canEdit, lesson } = st.data!;
  const dirty = JSON.stringify(draft) !== JSON.stringify(lesson);
  const set = (p: Partial<Lesson>) => {
    setSaved(false);
    setDraft({ ...draft, ...p });
  };
  async function guardar() {
    const { title, summary, hidden, theory, formulas, examples, simulation, practice_config } = draft!;
    const r = await action.run(() => updateLesson(lessonId, { title, summary, hidden, theory, formulas, examples, simulation, practice_config }));
    if (r) {
      setSaved(true);
      st.setData({ ...st.data!, lesson: r });
    }
  }
  const sim = draft.simulation;
  const simInfo = sim ? getSimulation(sim.key) : undefined;
  const lessonConcepts = concepts.filter((c) => c.lesson_id === lessonId);
  const practicePool = (d: Difficulty) => exercises.filter((e) => e.role === 'practice' && e.difficulty === d && e.published).length;

  return (
    <div>
      <PageTitle title={draft.title || 'Lección'} subtitle={draft.hidden ? <Badge tone="amber">Oculta para estudiantes</Badge> : <Badge tone="green">Visible</Badge>}
        back={{ to: `/docente/cursos/${lesson.course_id}`, label: 'Contenido del curso' }}
        actions={<Link className="btn-secundario" to={`/curso/${lesson.course_id}/leccion/${lessonId}`}>Ver como estudiante</Link>} />
      {!canEdit && <Notice tone="warn">Solo lectura: no pertenece al equipo docente de este curso.</Notice>}
      <Tabs<Sec> value={sec} onChange={setSec} tabs={[
        { id: 'datos', label: 'Datos' }, { id: 'teoria', label: 'Teoría' }, { id: 'formulas', label: `Fórmulas (${draft.formulas.length})` },
        { id: 'ejemplos', label: `Ejemplos (${draft.examples.length})` }, { id: 'simulacion', label: 'Simulación' }, { id: 'practica', label: `Práctica y ejercicios (${exercises.length})` },
      ]} />

      {sec === 'datos' && (
        <Card>
          <Field label="Título">{(id) => <input id={id} className="campo" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={160} />}</Field>
          <Field label="Resumen (una o dos frases)">{(id) => <textarea id={id} className="campo" rows={2} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />}</Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.hidden} onChange={(e) => set({ hidden: e.target.checked })} /> Ocultar a los estudiantes</label>
          <div className="mt-4">
            <p className="etiqueta">Conceptos que trabaja esta lección (se usan para medir el dominio)</p>
            <ul className="mb-2 flex flex-wrap gap-2">
              {lessonConcepts.map((c) => (
                <li key={c.id} className="flex items-center gap-1 rounded-full bg-primario-50 px-3 py-1 text-sm dark:bg-white/10">
                  {c.name} <span className="font-mono text-xs text-gray-500">{c.slug}</span>
                  {canEdit && <button className="ml-1 text-xs text-red-700" aria-label={`Quitar ${c.name}`} onClick={async () => { if (window.confirm('¿Quitar este concepto?')) { await action.run(() => deleteConcept(c.id)); await st.reload(); } }}>✕</button>}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="flex gap-2">
                <input className="campo" placeholder="Nombre del concepto, p. ej. «Pendiente de la gráfica x–t»" value={concept} onChange={(e) => setConcept(e.target.value)} aria-label="Nuevo concepto" />
                <button className="btn-secundario" disabled={!concept.trim()} onClick={async () => {
                  await action.run(() => upsertConcept({ course_id: lesson.course_id, lesson_id: lessonId, slug: `${slugify(draft.slug).slice(0, 20)}-${slugify(concept).slice(0, 30)}`, name: concept.trim() }));
                  setConcept('');
                  await st.reload();
                }}>Añadir</button>
              </div>
            )}
          </div>
        </Card>
      )}

      {sec === 'teoria' && (
        <Card>
          <EditorMarkdown label="Teoría" value={draft.theory} onChange={(v) => set({ theory: v })} rows={24} />
        </Card>
      )}

      {sec === 'formulas' && (
        <div className="space-y-3">
          {draft.formulas.map((f, i) => (
            <FormulaEditor key={i} f={f}
              onChange={(nf) => set({ formulas: draft.formulas.map((x, j) => (j === i ? nf : x)) })}
              onRemove={() => set({ formulas: draft.formulas.filter((_, j) => j !== i) })}
              onMove={(d) => set({ formulas: move(draft.formulas, i, d) })} />
          ))}
          <button className="btn-secundario" onClick={() => set({ formulas: [...draft.formulas, { name: '', latex: '', description: '', variables: [] }] })}>+ Añadir fórmula</button>
        </div>
      )}

      {sec === 'ejemplos' && (
        <div className="space-y-3">
          {draft.examples.map((ex, i) => (
            <EjemploEditor key={i} ex={ex}
              onChange={(ne) => set({ examples: draft.examples.map((x, j) => (j === i ? ne : x)) })}
              onRemove={() => set({ examples: draft.examples.filter((_, j) => j !== i) })}
              onMove={(d) => set({ examples: move(draft.examples, i, d) })} />
          ))}
          <button className="btn-secundario" onClick={() => set({ examples: [...draft.examples, { title: '', statement: '', steps: [''], result: '' }] })}>+ Añadir ejemplo</button>
        </div>
      )}

      {sec === 'simulacion' && (
        <Card>
          <Field label="Simulador de la lección">
            {(id) => (
              <select id={id} className="campo" value={sim?.key ?? ''} onChange={(e) => {
                const key = e.target.value;
                set({ simulation: key ? ({ key, params: resolveParams(key, {}), guide: sim?.guide ?? '' } as LessonSimulation) : null });
              }}>
                <option value="">Sin simulación</option>
                {SIMULATIONS.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
              </select>
            )}
          </Field>
          {sim && simInfo && (
            <>
              <p className="etiqueta">Valores iniciales de los parámetros</p>
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                {simInfo.params.map((p) => (
                  <label key={p.name} className="flex items-center justify-between gap-2 text-sm">
                    <span>{p.label} ({p.unit})</span>
                    <input type="number" className="campo w-28 py-1 text-right" min={p.min} max={p.max} step={p.step}
                      value={sim.params?.[p.name] ?? p.default}
                      onChange={(e) => set({ simulation: { ...sim, params: { ...resolveParams(sim.key, sim.params), [p.name]: Number(e.target.value) } } })} />
                  </label>
                ))}
              </div>
              <EditorMarkdown label="Actividad guiada" value={sim.guide} onChange={(v) => set({ simulation: { ...sim, guide: v } })} rows={8} />
              <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Vista previa del simulador</summary>
                <div className="mt-2"><Simulador key={JSON.stringify(sim.params)} simKey={sim.key} params={sim.params} /></div>
              </details>
            </>
          )}
        </Card>
      )}

      {sec === 'practica' && (
        <div className="space-y-4">
          <Card title="Conjunto de práctica">
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              La práctica de la lección toma, por dificultad, los primeros ejercicios publicados con rol «práctica». Los de rol «refuerzo» se
              ofrecen a quien falla. Los de «banco» solo aparecen si los asigna en una actividad.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['basico', 'intermedio', 'desafiante'] as Difficulty[]).map((d) => (
                <label key={d} className="text-sm">
                  {DIFICULTAD[d]}
                  <input type="number" min={0} max={20} className="campo mt-1" value={draft.practice_config?.[d] ?? 0}
                    onChange={(e) => set({ practice_config: { ...draft.practice_config, [d]: Math.max(0, Math.min(20, Number(e.target.value))) } })} />
                  <span className="text-xs text-gray-500">disponibles: {practicePool(d)}</span>
                </label>
              ))}
            </div>
          </Card>
          <Card title="Ejercicios de la lección" actions={canEdit && <Link className="btn-primario text-sm" to={`/docente/ejercicios/nuevo?curso=${lesson.course_id}&leccion=${lessonId}`}>+ Nuevo ejercicio</Link>}>
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {exercises.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Link className="enlace font-mono" to={`/docente/ejercicios/${e.id}`}>{e.slug}</Link>
                  <Badge tone={e.role === 'practice' ? 'blue' : e.role === 'reinforcement' ? 'purple' : 'gray'}>{e.role === 'practice' ? 'Práctica' : e.role === 'reinforcement' ? 'Refuerzo' : 'Banco'}</Badge>
                  <Badge>{DIFICULTAD[e.difficulty]}</Badge>
                  <span className="text-gray-500">{CATEGORIA[e.category]}</span>
                  {!e.published && <Badge tone="amber">No publicado</Badge>}
                  <span className="w-full truncate text-gray-600 dark:text-gray-400">{e.prompt.replace(/[#*$\\]/g, '').slice(0, 140)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <ErrorBox error={action.error} />
      {canEdit && sec !== 'practica' && (
        <div className="sticky bottom-20 z-30 mt-4 flex items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg dark:border-white/10 dark:bg-primario-950/95 md:bottom-4">
          {saved && !dirty && <span className="text-sm text-emerald-700">Guardado ✓</span>}
          {dirty && <span className="text-sm text-acento-700">Cambios sin guardar</span>}
          <button className="btn-secundario" disabled={!dirty} onClick={() => setDraft(lesson)}>Descartar</button>
          <button className="btn-primario" disabled={!dirty || action.busy} onClick={guardar}>Guardar lección</button>
        </div>
      )}
      {canEdit && sec === 'practica' && dirty && (
        <div className="mt-4 flex justify-end"><button className="btn-primario" onClick={guardar}>Guardar configuración</button></div>
      )}
    </div>
  );
}
