import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bankPerformance, listBankMeta, listCourses, listExercises } from '@/api/docente';
import { getConcepts, getLessonList } from '@/api/estudiante';
import {
  CODIGOS_ERROR, cumpleFiltros, errorPrincipal, FAMILIAS, resumenRendimiento, TIPOS_CHOQUE, TIPOS_PREGUNTA,
  type FiltrosBanco, type MetaBanco, type RendimientoEjercicio,
} from '@/lib/banco';
import { CATEGORIA, DIFICULTAD, FORMATO, useAsync } from '@/lib/util';
import { Badge, Empty, ErrorBox, PageTitle, Spinner } from '@/components/ui';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(100 * x)} %`);

export default function Banco() {
  const [params, setParams] = useSearchParams();
  const courses = useAsync(listCourses, []);
  const courseId = params.get('curso') || courses.data?.[0]?.id || '';
  const f = {
    lessonId: params.get('leccion') || '',
    difficulty: params.get('dificultad') || '',
    category: params.get('categoria') || '',
    role: params.get('rol') || '',
    search: params.get('q') || '',
  };
  const fb: FiltrosBanco = {
    tipo: params.get('tipo') || '', choque: params.get('choque') || '', familia: params.get('familia') || '',
    etapas: params.get('etapas') || '', previo: params.get('previo') || '',
    friccion: params.has('friccion'), energia: params.has('energia'), cinematica: params.has('cinematica'), plano: params.has('plano'),
  };
  const [search, setSearch] = useState(f.search);
  useEffect(() => setSearch(f.search), [f.search]);
  const lessons = useAsync(() => (courseId ? getLessonList(courseId) : Promise.resolve([])), [courseId]);
  const list = useAsync(
    () => (courseId ? listExercises({ courseId, lessonId: f.lessonId || undefined, difficulty: f.difficulty || undefined, category: f.category || undefined, role: f.role || undefined, search: f.search || undefined }) : Promise.resolve([])),
    [courseId, f.lessonId, f.difficulty, f.category, f.role, f.search],
  );
  // banco con metadatos (migración 41): si no hay, la página funciona como siempre
  const metas = useAsync(() => (courseId ? listBankMeta(courseId) : Promise.resolve([])), [courseId]);
  const rend = useAsync(() => (courseId ? bankPerformance(courseId) : Promise.resolve([] as RendimientoEjercicio[])), [courseId]);
  const conceptos = useAsync(() => (courseId ? getConcepts(courseId) : Promise.resolve([])), [courseId]);
  const meta = useMemo(() => new Map((metas.data ?? []).map((x) => [x.exercise_id, x.meta])), [metas.data]);
  const rendPorId = useMemo(() => new Map((rend.data ?? []).map((r) => [r.exercise_id, r])), [rend.data]);
  const nombreConcepto = useMemo(() => new Map((conceptos.data ?? []).map((c) => [c.slug, c.name])), [conceptos.data]);
  const previos = useMemo(() => [...new Set([...meta.values()].flatMap((m) => m.previos))].sort(), [meta]);
  const hayBanco = meta.size > 0;
  const [verResumen, setVerResumen] = useState(false);

  const setP = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    if (k === 'curso') p.delete('leccion');
    setParams(p, { replace: true });
  };
  if (courses.loading) return <Spinner />;
  const lessonTitle = (id: string | null) => lessons.data?.find((l) => l.id === id)?.title ?? 'Sin lección (banco)';
  const visibles = (list.data ?? []).filter((e) => cumpleFiltros(meta.get(e.id), fb));
  return (
    <div>
      <PageTitle title="Banco de ejercicios" subtitle="Filtre, revise y edite los ejercicios y sus claves. Para usarlos en una práctica o evaluación: sección → + Crear actividad."
        actions={courseId && <Link className="btn-primario" to={`/docente/ejercicios/nuevo?curso=${courseId}${f.lessonId && f.lessonId !== 'none' ? `&leccion=${f.lessonId}` : ''}`}>+ Nuevo ejercicio</Link>} />
      <div className="tarjeta mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <select className="campo" value={courseId} onChange={(e) => setP('curso', e.target.value)} aria-label="Curso">
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select className="campo" value={f.lessonId} onChange={(e) => setP('leccion', e.target.value)} aria-label="Lección">
          <option value="">Todas las lecciones</option>
          <option value="none">Sin lección</option>
          {lessons.data?.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <select className="campo" value={f.difficulty} onChange={(e) => setP('dificultad', e.target.value)} aria-label="Dificultad">
          <option value="">Toda dificultad</option>
          {Object.entries(DIFICULTAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="campo" value={f.category} onChange={(e) => setP('categoria', e.target.value)} aria-label="Tipo">
          <option value="">Todo tipo</option>
          {Object.entries(CATEGORIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="campo" value={f.role} onChange={(e) => setP('rol', e.target.value)} aria-label="Rol">
          <option value="">Todo rol</option>
          <option value="practice">Práctica</option>
          <option value="reinforcement">Refuerzo</option>
          <option value="bank">Banco</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setP('q', search.trim()); }}>
          <input className="campo" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar" />
        </form>
      </div>

      {hayBanco && (
        <details className="tarjeta mb-4" open={Object.values(fb).some(Boolean)}>
          <summary className="cursor-pointer text-sm font-semibold">Filtros del banco pedagógico ({meta.size} ejercicios con metadatos)</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <select className="campo" value={fb.tipo} onChange={(e) => setP('tipo', e.target.value)} aria-label="Tipo de pregunta">
              <option value="">Todo tipo de pregunta</option>
              {Object.entries(TIPOS_PREGUNTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="campo" value={fb.choque} onChange={(e) => setP('choque', e.target.value)} aria-label="Tipo de choque">
              <option value="">Todo tipo de choque</option>
              {Object.entries(TIPOS_CHOQUE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="campo" value={fb.etapas} onChange={(e) => setP('etapas', e.target.value)} aria-label="Etapas de resolución">
              <option value="">Cualquier número de etapas</option>
              <option value="1">1 etapa</option>
              <option value="2">2 etapas</option>
              <option value="3+">3 o más etapas</option>
            </select>
            <select className="campo" value={fb.familia} onChange={(e) => setP('familia', e.target.value)} aria-label="Familia">
              <option value="">Toda familia</option>
              {Object.entries(FAMILIAS).map(([k, v]) => <option key={k} value={k}>{k}. {v}</option>)}
            </select>
            <select className="campo" value={fb.previo} onChange={(e) => setP('previo', e.target.value)} aria-label="Concepto previo">
              <option value="">Todo concepto previo</option>
              {previos.map((s) => <option key={s} value={s}>{nombreConcepto.get(s) ?? s}</option>)}
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {([['friccion', 'Usa fricción'], ['energia', 'Usa energía'], ['cinematica', 'Usa cinemática'], ['plano', 'Usa planos inclinados']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1">
                <input type="checkbox" checked={!!fb[k]} onChange={(e) => setP(k, e.target.checked ? '1' : '')} /> {label}
              </label>
            ))}
            <button className="btn-texto ml-auto" onClick={() => setVerResumen((v) => !v)} aria-expanded={verResumen}>
              {verResumen ? 'Ocultar' : 'Ver'} rendimiento por tipo y conceptos previos
            </button>
          </div>
          {verResumen && <Resumenes meta={meta} rend={rend.data ?? []} nombreConcepto={nombreConcepto} />}
        </details>
      )}

      <ErrorBox error={list.error ?? metas.error ?? rend.error} />
      {list.loading ? <Spinner /> : visibles.length ? (
        <>
          <p className="mb-2 text-sm text-gray-500">{visibles.length} ejercicios</p>
          <ul className="space-y-2">
            {visibles.map((e) => {
              const m = meta.get(e.id);
              const r = rendPorId.get(e.id);
              const err = errorPrincipal(r);
              return (
                <li key={e.id} className="tarjeta py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link className="enlace font-mono" to={`/docente/ejercicios/${e.id}`}>{e.slug}</Link>
                    <Badge tone={e.role === 'practice' ? 'blue' : e.role === 'reinforcement' ? 'purple' : 'gray'}>{e.role === 'practice' ? 'Práctica' : e.role === 'reinforcement' ? 'Refuerzo' : 'Banco'}</Badge>
                    <Badge tone={e.difficulty === 'basico' ? 'green' : e.difficulty === 'intermedio' ? 'amber' : 'red'}>{DIFICULTAD[e.difficulty]}</Badge>
                    <Badge>{CATEGORIA[e.category]}</Badge>
                    <span className="text-gray-500">{FORMATO[e.format]} · {e.points} pt</span>
                    {!e.published && <Badge tone="amber">No publicado</Badge>}
                    <span className="ml-auto text-xs text-gray-500">{lessonTitle(e.lesson_id)}</span>
                  </div>
                  {m && <MetaLinea m={m} />}
                  <p className="mt-1 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">{e.prompt.replace(/[#*$\\]/g, '').slice(0, 220)}</p>
                  {r && r.respuestas > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {r.respuestas} respuestas · acierto {pct(r.correctas / r.respuestas)} · al primer intento {pct(r.primer_intento / r.respuestas)}
                      {r.intentos_promedio !== null && ` · ${r.intentos_promedio} intentos de media`}
                      {err && ` · error más frecuente: ${CODIGOS_ERROR[err] ?? err}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <Empty>No hay ejercicios con esos filtros.</Empty>
      )}
    </div>
  );
}

function MetaLinea({ m }: { m: MetaBanco }) {
  const usa = [m.friccion && 'fricción', m.energia && 'energía', m.cinematica && 'cinemática', m.plano && 'plano inclinado'].filter(Boolean);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <Badge tone="purple">{TIPOS_PREGUNTA[m.tipo] ?? m.tipo}</Badge>
      {m.choque !== 'ninguno' && <Badge>{TIPOS_CHOQUE[m.choque] ?? m.choque}</Badge>}
      {m.familia && <Badge tone="blue">Familia {m.familia}</Badge>}
      <Badge tone={m.etapas >= 3 ? 'red' : 'gray'}>{m.etapas} {m.etapas === 1 ? 'etapa' : 'etapas'}</Badge>
      {m.problema && <Badge tone="amber">Problema {m.problema.id}: etapa {m.problema.etapa}/{m.problema.total}</Badge>}
      {usa.length > 0 && <span className="text-gray-500">usa {usa.join(', ')}</span>}
      <span className="text-gray-500">· {m.tema}</span>
    </div>
  );
}

function Resumenes({ meta, rend, nombreConcepto }: { meta: Map<string, MetaBanco>; rend: RendimientoEjercicio[]; nombreConcepto: Map<string, string> }) {
  const porTipo = resumenRendimiento(meta, rend, (m) => m.tipo);
  const porPrevio = resumenRendimiento(meta, rend, (m) => m.previos).slice(0, 12);
  const tabla = (titulo: string, filas: typeof porTipo, etiqueta: (k: string) => string) => (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{titulo}</h3>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Grupo</th><th>Ejercicios</th><th>Respuestas</th><th>Acierto</th></tr></thead>
        <tbody>
          {filas.map((g) => (
            <tr key={g.clave} className="border-t border-gray-100 dark:border-white/10">
              <td className="py-1 pr-2">{etiqueta(g.clave)}</td><td>{g.ejercicios}</td><td>{g.respuestas}</td><td>{pct(g.tasa)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="mt-3 grid gap-4 md:grid-cols-2">
      {tabla('Rendimiento por tipo de pregunta', porTipo, (k) => TIPOS_PREGUNTA[k as keyof typeof TIPOS_PREGUNTA] ?? k)}
      {tabla('Conceptos previos con menos acierto', porPrevio, (k) => nombreConcepto.get(k) ?? k)}
      <p className="text-xs text-gray-500 md:col-span-2">
        Datos agregados de las respuestas entregadas o comprobadas (sin identificar estudiantes); el profesor de sección ve solo a sus estudiantes.
        Un ejercicio cuenta en cada uno de sus conceptos previos. Con pocas respuestas, las tasas son poco fiables.
      </p>
    </div>
  );
}
