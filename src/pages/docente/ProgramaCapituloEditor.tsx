/**
 * Editor de un capítulo dentro del editor de lecciones (migración 71):
 *  · SubtemasEditor  — subtemas del programa (conceptos con orden, nivel, ocultos y descripción); asignaturas con programa.
 *  · EstudioEditor   — objetivos, errores frecuentes, aplicaciones, conexiones y referencia (lessons.study); todas.
 *  · RecursosCapitulo — vínculos con prácticas, ejercicios, simuladores, clases y material, y notas docentes.
 */
import { useState } from 'react';
import { deleteConcept, updateConcept, upsertConcept } from '@/api/docente';
import { programaCapitulo, programaEnlaceGuardar, programaEnlaceRetirar, programaNotaGuardar, programaNotaRetirar, type EnlaceDocente } from '@/api/programa';
import type { Concept, LessonStudy, NivelSubtema } from '@/api/tipos';
import { NIVELES, ORDEN_NIVEL, TIPOS_ENLACE, urlValida, type TipoEnlace } from '@/lib/programa';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';
import { EditorMarkdown } from '@/components/EditorMarkdown';
import { SIMULATIONS } from '@/sims/catalogo';
import { slugify } from './CursoEditor';

// ------------------------------------------------------------------------------------------------ subtemas
export function SubtemasEditor({ courseId, lessonId, lessonSlug, conceptos, canEdit, onChange }: {
  courseId: string; lessonId: string; lessonSlug: string; conceptos: Concept[]; canEdit: boolean; onChange: () => void;
}) {
  const accion = useAction();
  const [nuevo, setNuevo] = useState<{ nombre: string; nivel: NivelSubtema }>({ nombre: '', nivel: 'esencial' });
  const lista = [...conceptos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name));
  const guardar = async (c: Concept, patch: Partial<Concept>) => { if ((await accion.run(() => updateConcept(c.id, patch))) !== undefined) onChange(); };
  async function mover(i: number, d: -1 | 1) {
    const a = lista[i], b = lista[i + d];
    if (!a || !b) return;
    await accion.run(async () => { await updateConcept(a.id, { position: b.position ?? i + d + 1 }); await updateConcept(b.id, { position: a.position ?? i + 1 }); });
    onChange();
  }
  return (
    <div className="mt-4">
      <p className="etiqueta">Subtemas del programa (cada uno se marca como impartido por sección y sirve para medir el dominio)</p>
      <ul className="space-y-2">
        {lista.map((c, i) => (
          <li key={c.id} className={`rounded-lg border border-gray-200 p-2 dark:border-white/10 ${c.hidden ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-5 text-right text-xs text-gray-500">{i + 1}</span>
              <input className="campo min-w-[14rem] flex-1 !py-1 text-sm" defaultValue={c.name} disabled={!canEdit} aria-label="Nombre del subtema"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) void guardar(c, { name: v }); }} />
              <select className="campo w-auto !py-1 text-xs" value={c.nivel ?? 'esencial'} disabled={!canEdit} aria-label="Nivel" onChange={(e) => void guardar(c, { nivel: e.target.value as NivelSubtema })}>
                {ORDEN_NIVEL.map((n) => <option key={n} value={n}>{NIVELES[n].etiqueta}</option>)}
              </select>
              {canEdit && <>
                <button className="btn-texto text-xs" disabled={i === 0} onClick={() => void mover(i, -1)} aria-label="Subir">↑</button>
                <button className="btn-texto text-xs" disabled={i === lista.length - 1} onClick={() => void mover(i, 1)} aria-label="Bajar">↓</button>
                <button className="btn-texto text-xs" onClick={() => void guardar(c, { hidden: !c.hidden })}>{c.hidden ? 'Mostrar' : 'Ocultar'}</button>
                <button className="btn-texto text-xs text-red-700" onClick={async () => {
                  if (!window.confirm(`¿Borrar el subtema «${c.name}»? Si ya se impartió en alguna sección no se puede borrar: ocúltelo.`)) return;
                  if ((await accion.run(() => deleteConcept(c.id))) !== undefined) onChange();
                }}>Borrar</button>
              </>}
              <span className="font-mono text-[10px] text-gray-400">{c.slug}</span>
            </div>
            <input className="campo mt-1 !py-1 text-xs" defaultValue={c.descripcion ?? ''} disabled={!canEdit} maxLength={1500} placeholder="Descripción breve (opcional; admite $…$)"
              aria-label="Descripción del subtema" onBlur={(e) => { if (e.target.value !== (c.descripcion ?? '')) void guardar(c, { descripcion: e.target.value }); }} />
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="campo min-w-[14rem] flex-1" placeholder="Nuevo subtema, p. ej. «Ley de Coulomb»" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} aria-label="Nuevo subtema" />
          <select className="campo w-auto" value={nuevo.nivel} onChange={(e) => setNuevo({ ...nuevo, nivel: e.target.value as NivelSubtema })} aria-label="Nivel del nuevo subtema">
            {ORDEN_NIVEL.map((n) => <option key={n} value={n}>{NIVELES[n].etiqueta}</option>)}
          </select>
          <button className="btn-secundario" disabled={!nuevo.nombre.trim() || accion.busy} onClick={async () => {
            const r = await accion.run(() => upsertConcept({ course_id: courseId, lesson_id: lessonId, slug: `${slugify(lessonSlug).slice(0, 20)}-${slugify(nuevo.nombre).slice(0, 30)}`,
              name: nuevo.nombre.trim(), nivel: nuevo.nivel, position: Math.max(0, ...lista.map((c) => c.position ?? 0)) + 1 }));
            if (r !== undefined) { setNuevo({ nombre: '', nivel: 'esencial' }); onChange(); }
          }}>Añadir</button>
        </div>
      )}
      {/violates foreign key|program_coverage/i.test(accion.error ?? '') ? <Notice tone="warn">Ese subtema ya se marcó como impartido en alguna sección: no se borra para conservar el historial. Use «Ocultar».</Notice> : <ErrorBox error={accion.error} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ estudio
const lineas = (t: string) => t.split('\n').map((s) => s.trim()).filter(Boolean);

export function EstudioEditor({ study, onChange, canEdit }: { study: LessonStudy; onChange: (s: LessonStudy) => void; canEdit: boolean }) {
  const errores = study.errores ?? [];
  return (
    <div className="space-y-4">
      <Card title="Objetivos de aprendizaje">
        <p className="mb-1 text-xs text-gray-500">Uno por línea, en términos observables («Calcular…», «Explicar…»). Admite $…$.</p>
        <textarea className="campo text-sm" rows={6} disabled={!canEdit} value={(study.objetivos ?? []).join('\n')} onChange={(e) => onChange({ ...study, objetivos: lineas(e.target.value) })} aria-label="Objetivos" />
      </Card>
      <Card title="Aplicaciones físicas o tecnológicas">
        <p className="mb-1 text-xs text-gray-500">Una por línea. Se muestran al final de la teoría.</p>
        <textarea className="campo text-sm" rows={4} disabled={!canEdit} value={(study.aplicaciones ?? []).join('\n')} onChange={(e) => onChange({ ...study, aplicaciones: lineas(e.target.value) })} aria-label="Aplicaciones" />
      </Card>
      <Card title={`Errores conceptuales frecuentes (${errores.length})`}>
        <div className="space-y-2">
          {errores.map((er, i) => (
            <div key={i} className="grid gap-1 rounded border border-gray-200 p-2 dark:border-white/10">
              <input className="campo text-sm" disabled={!canEdit} value={er.error} placeholder="La idea equivocada, como la diría un estudiante" aria-label={`Error ${i + 1}`}
                onChange={(e) => onChange({ ...study, errores: errores.map((x, j) => (j === i ? { ...x, error: e.target.value } : x)) })} />
              <textarea className="campo text-sm" rows={2} disabled={!canEdit} value={er.aclaracion} placeholder="Por qué es incorrecta y cuál es la idea correcta" aria-label={`Aclaración ${i + 1}`}
                onChange={(e) => onChange({ ...study, errores: errores.map((x, j) => (j === i ? { ...x, aclaracion: e.target.value } : x)) })} />
              {canEdit && <button className="btn-texto justify-self-start text-xs text-red-700" onClick={() => onChange({ ...study, errores: errores.filter((_, j) => j !== i) })}>Quitar</button>}
            </div>
          ))}
        </div>
        {canEdit && <button className="btn-texto mt-1 text-sm" onClick={() => onChange({ ...study, errores: [...errores, { error: '', aclaracion: '' }] })}>+ Error frecuente</button>}
      </Card>
      <Card title="Conexiones con otros capítulos">
        <EditorMarkdown label="Conexiones" value={study.conexiones ?? ''} onChange={(v) => onChange({ ...study, conexiones: v })} rows={4} />
      </Card>
      <Card title="Referencia bibliográfica">
        <textarea className="campo text-sm" rows={2} disabled={!canEdit} value={study.referencia ?? ''} onChange={(e) => onChange({ ...study, referencia: e.target.value })} aria-label="Referencia" />
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ recursos y notas
type Borrador = { tipo: TipoEnlace; titulo: string; url: string; descripcion: string; activity_id: string; session_id: string; sim_key: string; exercise_id: string; concept_id: string; class_id: string; publicado: boolean };
const VACIO: Borrador = { tipo: 'enlace', titulo: '', url: '', descripcion: '', activity_id: '', session_id: '', sim_key: '', exercise_id: '', concept_id: '', class_id: '', publicado: false };

export function RecursosCapitulo({ lessonId, conceptos, ejercicios, canEditGlobal }: {
  lessonId: string; conceptos: Concept[]; ejercicios: { id: string; slug: string }[]; canEditGlobal: boolean;
}) {
  const st = useAsync(() => programaCapitulo(lessonId), [lessonId]);
  const accion = useAction();
  const [b, setB] = useState<Borrador>(VACIO);
  const [nota, setNota] = useState({ texto: '', class_id: '', concept_id: '' });
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const d = st.data!;
  const nombreConcepto = new Map(conceptos.map((c) => [c.id, c.name]));
  const conUrl = ['pdf', 'video', 'imagen', 'enlace'].includes(b.tipo);
  const valido = b.titulo.trim() && (conUrl ? urlValida(b.url) : b.tipo === 'actividad' ? b.activity_id : b.tipo === 'clase' ? b.session_id : b.tipo === 'simulador' ? b.sim_key : b.exercise_id)
    && (b.class_id || canEditGlobal);
  async function crear() {
    const r = await accion.run(() => programaEnlaceGuardar({
      lesson_id: lessonId, tipo: b.tipo, titulo: b.titulo.trim(), descripcion: b.descripcion, publicado: b.publicado,
      url: conUrl ? b.url.trim() : null, activity_id: b.tipo === 'actividad' ? b.activity_id : null, session_id: b.tipo === 'clase' ? b.session_id : null,
      sim_key: b.tipo === 'simulador' ? b.sim_key : null, exercise_id: b.tipo === 'ejercicio' ? b.exercise_id : null,
      concept_id: b.concept_id || null, class_id: b.class_id || null,
    }));
    if (r !== undefined) { setB(VACIO); st.reload(); }
  }
  const publicar = async (e: EnlaceDocente) => { if ((await accion.run(() => programaEnlaceGuardar({ ...e, publicado: !e.publicado }))) !== undefined) st.reload(); };
  return (
    <div className="space-y-4">
      <Card title={`Material y vínculos (${d.enlaces.length})`}>
        <p className="mb-2 text-xs text-gray-500">
          Prácticas, evaluaciones, ejercicios, simuladores, clases impartidas y material propio (PDF, vídeo, imagen o enlace, siempre con https; por ejemplo,
          un archivo compartido de su Drive). Los estudiantes solo ven lo PUBLICADO, y solo cuando el material del capítulo está disponible.
        </p>
        {d.enlaces.length === 0 ? <p className="text-sm text-gray-500">Sin vínculos todavía.</p> : (
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            {d.enlaces.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span>{TIPOS_ENLACE[e.tipo].icono}</span>
                <span className="min-w-0 flex-1">{e.url ? <a className="enlace" href={e.url} target="_blank" rel="noopener noreferrer">{e.titulo}</a> : e.titulo}
                  <span className="block text-xs text-gray-500">{TIPOS_ENLACE[e.tipo].etiqueta} · {e.seccion ?? 'todas las secciones'}{e.concept_id ? ` · ${nombreConcepto.get(e.concept_id) ?? 'subtema'}` : ''}</span></span>
                <Badge tone={e.publicado ? 'green' : 'amber'}>{e.publicado ? 'Publicado' : 'Borrador'}</Badge>
                <button className="btn-texto text-xs" disabled={accion.busy} onClick={() => void publicar(e)}>{e.publicado ? 'Despublicar' : 'Publicar'}</button>
                <button className="btn-texto text-xs text-red-700" disabled={accion.busy} onClick={() => {
                  if (window.confirm(`¿Retirar «${e.titulo}»?`)) void accion.run(() => programaEnlaceRetirar(e.id)).then(() => st.reload());
                }}>Retirar</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid gap-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm dark:border-white/15 sm:grid-cols-2">
          <label><span className="etiqueta">Tipo</span>
            <select className="campo" value={b.tipo} onChange={(e) => setB({ ...b, tipo: e.target.value as TipoEnlace })}>
              {(Object.keys(TIPOS_ENLACE) as TipoEnlace[]).map((t) => <option key={t} value={t}>{TIPOS_ENLACE[t].icono} {TIPOS_ENLACE[t].etiqueta}</option>)}
            </select></label>
          <label><span className="etiqueta">Título</span><input className="campo" maxLength={200} value={b.titulo} onChange={(e) => setB({ ...b, titulo: e.target.value })} /></label>
          {conUrl && <label className="sm:col-span-2"><span className="etiqueta">Dirección (https://…)</span><input className="campo" value={b.url} onChange={(e) => setB({ ...b, url: e.target.value })} placeholder="https://" />
            {b.url && !urlValida(b.url) && <span className="text-xs text-red-700">Debe empezar por https://</span>}</label>}
          {b.tipo === 'actividad' && <label className="sm:col-span-2"><span className="etiqueta">Práctica o evaluación</span>
            <select className="campo" value={b.activity_id} onChange={(e) => { const a = d.actividades.find((x) => x.id === e.target.value); setB({ ...b, activity_id: e.target.value, class_id: a?.class_id ?? b.class_id, titulo: b.titulo || a?.titulo || '' }); }}>
              <option value="">— elija —</option>
              {d.actividades.map((a) => <option key={a.id} value={a.id}>{a.titulo} ({d.secciones.find((s) => s.id === a.class_id)?.nombre})</option>)}
            </select></label>}
          {b.tipo === 'clase' && <label className="sm:col-span-2"><span className="etiqueta">Clase impartida</span>
            <select className="campo" value={b.session_id} onChange={(e) => { const s = d.sesiones.find((x) => x.id === e.target.value); setB({ ...b, session_id: e.target.value, class_id: s?.class_id ?? b.class_id, titulo: b.titulo || s?.titulo || '' }); }}>
              <option value="">— elija —</option>
              {d.sesiones.map((s) => <option key={s.id} value={s.id}>{s.fecha} · {s.titulo}</option>)}
            </select></label>}
          {b.tipo === 'simulador' && <label className="sm:col-span-2"><span className="etiqueta">Simulador</span>
            <select className="campo" value={b.sim_key} onChange={(e) => setB({ ...b, sim_key: e.target.value, titulo: b.titulo || SIMULATIONS.find((s) => s.key === e.target.value)?.title || '' })}>
              <option value="">— elija —</option>
              {SIMULATIONS.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
            </select></label>}
          {b.tipo === 'ejercicio' && <label className="sm:col-span-2"><span className="etiqueta">Ejercicio del banco de la asignatura</span>
            <select className="campo" value={b.exercise_id} onChange={(e) => setB({ ...b, exercise_id: e.target.value })}>
              <option value="">— elija —</option>
              {ejercicios.map((x) => <option key={x.id} value={x.id}>{x.slug}</option>)}
            </select></label>}
          <label><span className="etiqueta">Subtema (opcional)</span>
            <select className="campo" value={b.concept_id} onChange={(e) => setB({ ...b, concept_id: e.target.value })}>
              <option value="">Todo el capítulo</option>
              {conceptos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <label><span className="etiqueta">Para</span>
            <select className="campo" value={b.class_id} onChange={(e) => setB({ ...b, class_id: e.target.value })}>
              {canEditGlobal && <option value="">Todas las secciones</option>}
              {!canEditGlobal && <option value="">— elija una sección —</option>}
              {d.secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select></label>
          <label className="sm:col-span-2"><span className="etiqueta">Descripción (opcional)</span><input className="campo" maxLength={1000} value={b.descripcion} onChange={(e) => setB({ ...b, descripcion: e.target.value })} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={b.publicado} onChange={(e) => setB({ ...b, publicado: e.target.checked })} /> Publicar ya</label>
          <button className="btn-secundario justify-self-end" disabled={!valido || accion.busy} onClick={() => void crear()}>Añadir vínculo</button>
        </div>
      </Card>
      <Card title={`Observaciones docentes (${d.notas.length})`}>
        <p className="mb-2 text-xs text-gray-500">Solo las ve el profesorado. Úselas para anotar qué funcionó, qué conviene reforzar o cómo adaptar el capítulo.</p>
        <ul className="space-y-2 text-sm">
          {d.notas.map((n) => (
            <li key={n.id} className="rounded bg-gray-50 p-2 dark:bg-white/5">
              <p className="whitespace-pre-wrap">{n.texto}</p>
              <p className="mt-1 text-xs text-gray-500">{n.autor || 'Profesor'} · {new Date(n.created_at).toLocaleDateString('es-DO')} · {n.seccion ?? 'todas las secciones'}{n.concept_id ? ` · ${nombreConcepto.get(n.concept_id) ?? ''}` : ''}
                <button className="btn-texto ml-2 text-xs" onClick={() => { if (window.confirm('¿Retirar esta nota?')) void accion.run(() => programaNotaRetirar(n.id)).then(() => st.reload()); }}>Retirar</button></p>
            </li>
          ))}
        </ul>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <textarea className="campo text-sm sm:col-span-2" rows={2} maxLength={2000} value={nota.texto} placeholder="Nueva observación…" onChange={(e) => setNota({ ...nota, texto: e.target.value })} aria-label="Nueva observación" />
          <select className="campo text-sm" value={nota.class_id} onChange={(e) => setNota({ ...nota, class_id: e.target.value })} aria-label="Sección de la nota">
            {canEditGlobal ? <option value="">Todas las secciones</option> : <option value="">— elija una sección —</option>}
            {d.secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select className="campo text-sm" value={nota.concept_id} onChange={(e) => setNota({ ...nota, concept_id: e.target.value })} aria-label="Subtema de la nota">
            <option value="">Todo el capítulo</option>
            {conceptos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-secundario justify-self-start" disabled={!nota.texto.trim() || (!nota.class_id && !canEditGlobal) || accion.busy} onClick={async () => {
            const r = await accion.run(() => programaNotaGuardar(lessonId, nota.texto, nota.concept_id || null, nota.class_id || null));
            if (r !== undefined) { setNota({ texto: '', class_id: '', concept_id: '' }); st.reload(); }
          }}>Guardar observación</button>
        </div>
      </Card>
      <ErrorBox error={accion.error} />
    </div>
  );
}
