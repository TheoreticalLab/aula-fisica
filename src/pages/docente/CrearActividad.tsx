/**
 * Asistente «+ Crear actividad» en cuatro pasos: 1) qué crear (plantillas), 2) preguntas, 3) fechas y reglas,
 * 4) revisar y crear. Las opciones avanzadas están plegadas; los valores de la plantilla sirven tal cual.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createActivity, getClass, listExercises, setActivityItems, updateActivity } from '@/api/docente';
import { getLessonList } from '@/api/estudiante';
import { examSettingsSave, funcionAusente } from '@/api/examen';
import { assistedSettingsSave } from '@/api/asistida';
import type { Exercise } from '@/api/tipos';
import { aActividad, borradorDesde, PLANTILLAS, plantilla, resumen, revisar, type Borrador, type IdPlantilla } from '@/lib/plantillas';
import { CATEGORIA, DIFICULTAD, useAction, useAsync } from '@/lib/util';
import { Badge, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { InlineMd } from '@/components/Markdown';
import { useModoConcentracion } from '@/components/Layout';

const PASOS = ['Tipo', 'Preguntas', 'Reglas', 'Revisar'] as const;
const aLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const deLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export default function CrearActividad() {
  const { classId = '' } = useParams();
  const nav = useNavigate();
  const clase = useAsync(() => getClass(classId), [classId]);
  const [paso, setPaso] = useState(0);
  const [b, setB] = useState<Borrador | null>(null);
  const action = useAction();
  useModoConcentracion();
  if (clase.loading) return <Spinner />;
  if (clase.error) return <ErrorBox error={clase.error} onRetry={clase.reload} />;
  const c = clase.data!;
  const set = (p: Partial<Borrador>) => setB((x) => (x ? { ...x, ...p } : x));
  const rev = b ? revisar(b) : { errores: [], avisos: [] };

  async function crear(publicar: boolean) {
    if (!b) return;
    const final = { ...b, publicar };
    const r = revisar(final);
    if (r.errores.length) { action.setError(r.errores.join(' ')); setPaso(publicar && !b.preguntas.length ? 1 : 2); return; }
    const a = await action.run(async () => {
      // se crea oculta, se completa (preguntas y modo de examen) y solo al final se publica
      const act = await createActivity({ ...aActividad(final, c.id), published: false });
      if (final.preguntas.length) await setActivityItems(act.id, final.preguntas);
      // sin el motor en el servidor (migración 35 sin aplicar), la evaluación queda clásica en vez de fallar a medias
      if (final.mode === 'exam' && final.examen) await examSettingsSave(act.id, final.examen).catch((e) => { if (!funcionAusente(e)) throw e; });
      if (final.asistida) {
        await assistedSettingsSave(act.id, { transferencia: final.asistida.transferencia }, null).catch((e) => {
          throw funcionAusente(e) ? new Error('La práctica se creó como borrador, pero el aprendizaje asistido aún no está activado en el servidor (falta aplicar la migración 38).') : e;
        });
      }
      if (publicar) await updateActivity(act.id, { published: true });
      return act;
    });
    if (a) nav(`/docente/actividades/${a.id}?creada=1`);
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <PageTitle title="Crear actividad" subtitle={c.name} back={{ to: `/docente/clases/${c.id}?t=actividades`, label: c.name }} />
      {/* indicador de pasos */}
      <ol className="mb-5 flex items-center gap-1 text-xs sm:text-sm" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <li key={p} className="flex flex-1 items-center gap-1">
            <button type="button" disabled={!b || i > paso} onClick={() => setPaso(i)} aria-current={i === paso ? 'step' : undefined}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-semibold ${i === paso ? 'border-primario-600 bg-primario-600 text-white' : i < paso ? 'border-primario-600 text-primario-700 dark:text-primario-300' : 'border-gray-300 text-gray-400 dark:border-white/20'}`}>{i + 1}</button>
            <span className={`truncate ${i === paso ? 'font-semibold' : 'text-gray-500'}`}>{p}</span>
            {i < PASOS.length - 1 && <span className="mx-1 h-px flex-1 bg-gray-200 dark:bg-white/10" />}
          </li>
        ))}
      </ol>

      {paso === 0 && <PasoTipo elegida={b?.plantilla ?? null} onElegir={(id) => { setB((x) => ({ ...borradorDesde(id, new Date()), titulo: x?.titulo ?? '' })); setPaso(1); }} />}
      {paso === 1 && b && <PasoPreguntas courseId={c.course_id} b={b} set={set} />}
      {paso === 2 && b && <PasoReglas b={b} set={set} />}
      {paso === 3 && b && (
        <div className="tarjeta">
          <h2 className="mb-2 font-semibold">{b.titulo || 'Sin título'}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{resumen(b).map((l) => <li key={l}>{l}</li>)}</ul>
          {rev.errores.length > 0 && <div className="mt-3"><ErrorBox error={rev.errores.join(' ')} /></div>}
          {rev.avisos.map((a) => <div key={a} className="mt-2"><Notice tone="warn">{a}</Notice></div>)}
          <p className="mt-3 text-xs text-gray-500">Después podrá cambiar cualquier cosa desde la actividad (pestañas Configuración y Ejercicios) y verla como estudiante.</p>
        </div>
      )}
      <ErrorBox error={action.error} />

      {/* barra inferior */}
      {b && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-primario-950/95">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <button className="btn-secundario min-h-[44px]" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0 || action.busy}>← Atrás</button>
            <span className="flex-1" />
            {paso < 3 ? (
              <button className="btn-primario min-h-[44px]" onClick={() => setPaso((p) => p + 1)} disabled={paso === 2 && !b.titulo.trim()}>
                {paso === 1 && !b.preguntas.length ? 'Elegir después →' : 'Siguiente →'}
              </button>
            ) : (
              <>
                <button className="btn-secundario min-h-[44px]" onClick={() => void crear(false)} disabled={action.busy || rev.errores.length > 0}>Guardar borrador</button>
                <button className="btn-primario min-h-[44px]" onClick={() => void crear(true)} disabled={action.busy || revisar({ ...b, publicar: true }).errores.length > 0}>{action.busy ? 'Creando…' : 'Crear y publicar'}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PasoTipo({ elegida, onElegir }: { elegida: IdPlantilla | null; onElegir: (id: IdPlantilla) => void }) {
  const grupos: { titulo: string; ids: IdPlantilla[] }[] = [
    { titulo: 'Para practicar', ids: ['practica_libre', 'practica_asistida', 'tarea'] },
    { titulo: 'Para evaluar', ids: ['quiz', 'parcial', 'estricto'] },
    { titulo: 'Desde cero', ids: ['blanco_practica', 'blanco_examen'] },
  ];
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">¿Qué quiere crear?</h2>
      {grupos.map((g) => (
        <section key={g.titulo}>
          <h3 className="mb-2 text-sm font-medium text-gray-500">{g.titulo}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.ids.map((id) => { const p = plantilla(id); return (
              <button key={id} type="button" onClick={() => onElegir(id)}
                className={`tarjeta flex min-h-[88px] items-start gap-3 text-left transition hover:border-primario-400 hover:shadow ${elegida === id ? 'ring-2 ring-primario-500' : ''}`}>
                <span className="text-2xl" aria-hidden>{p.icono}</span>
                <span><span className="block font-semibold">{p.titulo}</span><span className="block text-sm text-gray-600 dark:text-gray-400">{p.descripcion}</span></span>
              </button>
            ); })}
          </div>
        </section>
      ))}
    </div>
  );
}

function PasoPreguntas({ courseId, b, set }: { courseId: string; b: Borrador; set: (p: Partial<Borrador>) => void }) {
  const lecciones = useAsync(() => getLessonList(courseId), [courseId]);
  const [leccion, setLeccion] = useState('');
  const [dificultad, setDificultad] = useState('');
  const [buscar, setBuscar] = useState('');
  const ej = useAsync(() => listExercises({ courseId, lessonId: leccion || undefined, difficulty: dificultad || undefined, search: buscar.trim() || undefined }), [courseId, leccion, dificultad, buscar]);
  const elegidas = useMemo(() => new Set(b.preguntas.map((p) => p.exercise_id)), [b.preguntas]);
  const sugeridas = PLANTILLAS.find((p) => p.id === b.plantilla)?.preguntas_sugeridas ?? 0;
  const alternar = (e: Exercise) => set({ preguntas: elegidas.has(e.id) ? b.preguntas.filter((p) => p.exercise_id !== e.id) : [...b.preguntas, { exercise_id: e.id, points: null }] });
  const visibles = ej.data ?? [];
  return (
    <div>
      <h2 className="text-lg font-semibold">Preguntas</h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">Elija del banco de la asignatura. {sugeridas ? `Para este tipo suelen bastar unas ${sugeridas}.` : ''} Puede cambiarlas después.</p>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <select className="campo" value={leccion} onChange={(e) => setLeccion(e.target.value)} aria-label="Lección">
          <option value="">Todas las lecciones</option>
          {lecciones.data?.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <select className="campo" value={dificultad} onChange={(e) => setDificultad(e.target.value)} aria-label="Dificultad">
          <option value="">Cualquier dificultad</option>
          {Object.entries(DIFICULTAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="campo" placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar" />
      </div>
      <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 rounded-lg bg-primario-50 px-3 py-2 text-sm dark:bg-white/5">
        <strong>{b.preguntas.length}</strong> elegida(s)
        {b.preguntas.length > 0 && <button className="enlace ml-auto text-xs" onClick={() => set({ preguntas: [] })}>Quitar todas</button>}
      </div>
      {ej.loading ? <Spinner /> : ej.error ? <ErrorBox error={ej.error} onRetry={ej.reload} /> : visibles.length ? (
        <ul className="space-y-2">
          {visibles.map((e) => (
            <li key={e.id}>
              <label className={`tarjeta flex cursor-pointer items-start gap-3 ${elegidas.has(e.id) ? 'ring-2 ring-primario-500' : ''}`}>
                <input type="checkbox" className="mt-1 h-5 w-5" checked={elegidas.has(e.id)} onChange={() => alternar(e)} />
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex flex-wrap gap-1"><Badge>{DIFICULTAD[e.difficulty]}</Badge><Badge>{CATEGORIA[e.category] ?? e.category}</Badge></span>
                  <span className="line-clamp-3 block text-sm"><InlineMd>{e.prompt.slice(0, 280)}</InlineMd></span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-gray-500">No hay preguntas con esos filtros.</p>}
    </div>
  );
}

function PasoReglas({ b, set }: { b: Borrador; set: (p: Partial<Borrador>) => void }) {
  const exam = b.mode === 'exam';
  const ex = b.examen;
  const setEx = (p: Partial<NonNullable<Borrador['examen']>>) => ex && set({ examen: { ...ex, ...p } });
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Fechas y reglas</h2>
      <label className="block text-sm"><span className="etiqueta">Título</span>
        <input className="campo" value={b.titulo} onChange={(e) => set({ titulo: e.target.value })} maxLength={160} placeholder={exam ? 'Parcial 1: cinemática' : 'Práctica 3: MRU'} autoFocus /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="etiqueta">Abre (opcional)</span>
          <input type="datetime-local" className="campo" value={aLocal(b.opens_at)} onChange={(e) => set({ opens_at: deLocal(e.target.value) })} /></label>
        <label className="text-sm"><span className="etiqueta">Cierra {b.reveal_policy === 'after_close' ? '' : '(opcional)'}</span>
          <input type="datetime-local" className="campo" value={aLocal(b.closes_at)} onChange={(e) => set({ closes_at: deLocal(e.target.value) })} /></label>
      </div>
      {b.asistida && (
        <div className="rounded-xl border border-primario-200 bg-primario-50 p-3 text-sm dark:border-primario-500/30 dark:bg-primario-900/30">
          <p className="font-medium">Aprendizaje asistido: Intentar → Aprender → Explicar{b.asistida.transferencia ? ' → Comprobar' : ''}</p>
          <label className="mt-2 flex items-start gap-2"><input type="checkbox" className="mt-1" checked={b.asistida.transferencia} onChange={(e) => set({ asistida: { transferencia: e.target.checked } })} />
            <span>Añadir el paso 4 «Demuestra lo que aprendiste»: un ejercicio distinto con el mismo concepto. <span className="text-xs text-gray-500">Después de crear la práctica, elija el ejercicio de transferencia de cada pregunta en Configuración → Aprendizaje asistido.</span></span></label>
        </div>
      )}
      {exam && ex && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="etiqueta">Duración (minutos)</span>
            <input type="number" min={1} max={360} className="campo" value={ex.duracion_s ? Math.round(ex.duracion_s / 60) : ''} placeholder="Sin límite"
              onChange={(e) => setEx({ duracion_s: e.target.value ? Math.max(1, Math.min(360, Number(e.target.value))) * 60 : null })} /></label>
          <label className="text-sm"><span className="etiqueta">Navegación</span>
            <select className="campo" value={ex.navegacion} onChange={(e) => setEx({ navegacion: e.target.value as 'libre' | 'solo_adelante' })}>
              <option value="libre">Libre (puede volver)</option><option value="solo_adelante">Solo hacia adelante</option>
            </select></label>
        </div>
      )}
      <details className="tarjeta">
        <summary className="cursor-pointer text-sm font-medium">Opciones avanzadas</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="etiqueta">Intentos</span>
            <input type="number" min={1} max={50} className="campo" value={b.max_attempts ?? ''} placeholder="Ilimitados" onChange={(e) => set({ max_attempts: e.target.value ? Number(e.target.value) : null })} /></label>
          {!exam && <label className="text-sm"><span className="etiqueta">Comprobaciones por ejercicio</span>
            <input type="number" min={1} max={20} className="campo" value={b.max_tries_per_item} onChange={(e) => set({ max_tries_per_item: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /></label>}
          <label className="text-sm"><span className="etiqueta">Soluciones</span>
            <select className="campo" value={b.reveal_policy} onChange={(e) => set({ reveal_policy: e.target.value as Borrador['reveal_policy'] })}>
              {!exam && !b.asistida && <option value="immediate">Al comprobar cada ejercicio</option>}
              <option value="after_submit">Al entregar</option><option value="after_close">Al cerrar la actividad</option><option value="never">Nunca</option>
            </select></label>
          {!exam && !b.asistida && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.hints_enabled} onChange={(e) => set({ hints_enabled: e.target.checked })} /> Pistas disponibles</label>}
          {exam && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!ex} onChange={(e) => set({ examen: e.target.checked ? (plantilla('parcial').examen ? { ...structuredClone(plantilla('parcial').examen!), pausas: { permitidas: false, max_numero: 0, max_total_s: 0, detienen_reloj: false } } : null) : null })} />
              Una pregunta a la vez (reloj oficial, tiempo por pregunta, recuperación tras desconexiones)</label>
          )}
          {exam && ex && (
            <fieldset className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ex.pausas.permitidas}
                onChange={(e) => setEx({ pausas: e.target.checked ? { permitidas: true, max_numero: 1, max_total_s: 300, detienen_reloj: !!ex.duracion_s } : { permitidas: false, max_numero: 0, max_total_s: 0, detienen_reloj: false } })} />
                Permitir pausas (las preguntas se ocultan durante la pausa)</label>
              {ex.pausas.permitidas && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs">Número<input type="number" min={1} max={10} className="campo" value={ex.pausas.max_numero} onChange={(e) => setEx({ pausas: { ...ex.pausas, max_numero: Math.max(1, Math.min(10, Number(e.target.value) || 1)) } })} /></label>
                  <label className="text-xs">Minutos en total<input type="number" min={1} max={60} className="campo" value={Math.round(ex.pausas.max_total_s / 60)} onChange={(e) => setEx({ pausas: { ...ex.pausas, max_total_s: Math.max(1, Math.min(60, Number(e.target.value) || 1)) * 60 } })} /></label>
                  <label className="col-span-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={ex.pausas.detienen_reloj} disabled={!ex.duracion_s} onChange={(e) => setEx({ pausas: { ...ex.pausas, detienen_reloj: e.target.checked } })} /> La pausa detiene el reloj</label>
                </div>
              )}
            </fieldset>
          )}
          <label className="text-sm sm:col-span-2"><span className="etiqueta">Instrucciones para los estudiantes (opcional)</span>
            <textarea className="campo" rows={3} value={b.instrucciones} onChange={(e) => set({ instrucciones: e.target.value })} maxLength={4000} /></label>
        </div>
      </details>
    </div>
  );
}
