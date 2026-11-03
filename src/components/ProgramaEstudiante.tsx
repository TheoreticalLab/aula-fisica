/**
 * Programa académico en la vista del estudiante (migración 71), con los mismos componentes visuales del Temario y de
 * la lección. Distingue siempre: PREVISTO (está en el programa), IMPARTIDO (el profesor lo marcó en su sección) y
 * DISPONIBLE (el material del capítulo está publicado). El tiempo de estudio es lectura, no dominio ni nota.
 */
import { Link } from 'react-router-dom';
import { InlineMd } from '@/components/Markdown';
import { Badge, Card, ProgressBar } from '@/components/ui';
import type { Lesson, Unit } from '@/api/tipos';
import { getSimulation } from '@/sims/catalogo';
import {
  avanceSubtemas, estadoCapitulo, fechasImpartido, fraccion, NIVELES, ORDEN_NIVEL, sumarAvances, TIPOS_ENLACE,
  type CapituloMio, type ProgramaMio,
} from '@/lib/programa';

const ESTADO_UNIDAD: Record<string, string> = { preparado: 'Programa visible; material en preparación', publicado: '', borrador: 'Borrador (solo profesorado)' };

/** Programa del curso en el Temario: unidades → capítulos, con el estado de cada capítulo y el avance impartido. */
/** Datos del Temario de siempre que la vista de programa conserva: simulación, práctica y avisos de cada lección. */
export interface ExtrasTemario {
  lessons: Pick<Lesson, 'id' | 'simulation' | 'hidden'>[];
  units: Pick<Unit, 'id' | 'coming_soon' | 'planned_topics'>[];
  progress: Map<string, { practice_total: number; practice_solved: number }>;
}

export function ProgramaTemario({ courseId, programa, isTeacher, extras }: { courseId: string; programa: ProgramaMio; isTeacher: boolean; extras?: ExtrasTemario }) {
  const leccion = new Map((extras?.lessons ?? []).map((l) => [l.id, l]));
  const unidad = new Map((extras?.units ?? []).map((u) => [u.id, u]));
  if (!programa.unidades.length) return <p className="tarjeta text-sm text-gray-600">Su profesor todavía no ha publicado el programa de este curso.</p>;
  return (
    <>
      {programa.unidades.map((u, ui) => {
        const av = sumarAvances(u.capitulos.map((c) => avanceSubtemas(c.subtemas)));
        return (
          <details key={u.id} id={`u-${u.id}`} className="tarjeta group" open={ui === 0 || undefined}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-acento-700 dark:text-acento-300">Unidad {u.position}</span>
              <h3 className="font-serif text-xl font-semibold text-primario-900 dark:text-primario-100">{u.titulo}</h3>
              {ESTADO_UNIDAD[u.estado] && (isTeacher || u.estado === 'preparado') && <Badge tone={u.estado === 'preparado' ? 'amber' : 'gray'}>{ESTADO_UNIDAD[u.estado]}</Badge>}
              {unidad.get(u.id)?.coming_soon && <Badge>En preparación</Badge>}
              <span className="ml-auto text-xs text-gray-500">{u.capitulos.length} {u.capitulos.length === 1 ? 'capítulo' : 'capítulos'} <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span></span>
            </summary>
            <p className="mb-3 mt-2 text-sm text-gray-600 dark:text-gray-400">{u.resumen}</p>
            {av.esenciales > 0 && (
              <div className="mb-3 max-w-sm">
                <ProgressBar value={fraccion(av.esencialesImpartidos, av.esenciales)} label={`Impartido en su sección: ${av.esencialesImpartidos} de ${av.esenciales} subtemas esenciales`} />
              </div>
            )}
            <ol className="divide-y divide-gray-100 dark:divide-white/10">
              {u.capitulos.map((c, i) => {
                const est = estadoCapitulo(c);
                const l = leccion.get(c.id);
                const p = extras?.progress.get(c.id);
                const sim = l?.simulation?.key ? getSimulation(l.simulation.key) : null;
                const integradora = /integradora/i.test(c.titulo);
                const programaPropio = /^cap[ií]tulo\s+\d+/i.test(c.titulo);   // «Capítulo 21. …» ya lleva su número
                const cabecera = (
                  <>
                    {!programaPropio && (
                      <span className={`flex h-7 min-w-[2.25rem] shrink-0 items-center justify-center rounded-full px-1 text-xs font-semibold ${integradora ? 'bg-acento-200 text-acento-800' : 'bg-primario-100 text-primario-800 dark:bg-primario-800 dark:text-primario-100'}`}>
                        {integradora ? '★' : `${u.position}.${i + 1}`}
                      </span>
                    )}
                    <span className="font-medium group-hover/l:underline">{c.titulo}</span>
                    {sim && <Badge tone="blue">Simulación</Badge>}
                    {l?.hidden && isTeacher && <Badge tone="amber">Oculta</Badge>}
                    {p && p.practice_total > 0 && p.practice_solved === p.practice_total && <Badge tone="green">Práctica completa</Badge>}
                    <Badge tone={est.tono}>{est.etiqueta}</Badge>
                  </>
                );
                const sangria = programaPropio ? '' : 'ml-12 ';
                return (
                  <li key={c.id} className="py-3">
                    {c.disponible ? (
                      <Link to={`/curso/${courseId}/leccion/${c.id}`} className="group/l flex flex-wrap items-center gap-x-3 gap-y-1">{cabecera}</Link>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{cabecera}</div>
                    )}
                    <p className={`${sangria}mt-0.5 text-sm text-gray-600 dark:text-gray-400`}>{c.resumen}</p>
                    {p && p.practice_total > 0 && p.practice_solved > 0 && (
                      <div className={`${sangria}mt-2 max-w-sm`}>
                        <ProgressBar value={p.practice_solved / p.practice_total} label={`Práctica ${p.practice_solved}/${p.practice_total}`} />
                      </div>
                    )}
                    {c.subtemas.length > 0 && (
                      <details className={`${sangria}mt-1 text-sm`}>
                        <summary className="cursor-pointer text-xs text-primario-700 dark:text-primario-300">Temas del programa ({c.subtemas.length})</summary>
                        <ListaSubtemas c={c} />
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
            {unidad.get(u.id)?.coming_soon && (unidad.get(u.id)?.planned_topics.length ?? 0) > 0 && (
              <ul className="grid list-disc gap-x-6 pl-5 text-sm text-gray-600 dark:text-gray-400 sm:grid-cols-2">
                {unidad.get(u.id)!.planned_topics.map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
          </details>
        );
      })}
    </>
  );
}

/** Avance del programa en la barra lateral del Temario. */
export function AvancePrograma({ programa }: { programa: ProgramaMio }) {
  const caps = programa.unidades.flatMap((u) => u.capitulos);
  const av = sumarAvances(caps.map((c) => avanceSubtemas(c.subtemas)));
  const disponibles = caps.filter((c) => c.disponible).length;
  const minutos = caps.reduce((s, c) => s + Number(c.minutos), 0);
  if (!caps.length) return null;
  return (
    <div className="tarjeta">
      <p className="mb-2 text-sm font-semibold">Avance del programa</p>
      <ProgressBar value={fraccion(av.esencialesImpartidos, av.esenciales)} label={`Subtemas esenciales impartidos en su sección: ${av.esencialesImpartidos} de ${av.esenciales}`} />
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">Capítulos con material para estudiar: {disponibles} de {caps.length}.</p>
      {minutos > 0 && <p className="text-xs text-gray-600 dark:text-gray-300">Su tiempo de estudio en el programa: {minutos} min.</p>}
      <p className="mt-1 text-xs text-gray-500">«Impartido» lo marca el profesor en clase; leer una página no cuenta como dominar el tema.</p>
    </div>
  );
}

function ListaSubtemas({ c }: { c: CapituloMio }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {ORDEN_NIVEL.flatMap((n) => c.subtemas.filter((s) => s.nivel === n)).map((s) => (
        <li key={s.id} className="flex flex-wrap items-start gap-2">
          <Badge tone={NIVELES[s.nivel].tono}>{NIVELES[s.nivel].etiqueta}</Badge>
          <span className="min-w-0 flex-1">
            {s.nombre}
            {s.descripcion && <span className="block text-xs text-gray-500"><InlineMd>{s.descripcion}</InlineMd></span>}
          </span>
          {s.impartido.length > 0 ? <Badge tone="green">Impartido · {fechasImpartido(s.impartido)}</Badge> : <Badge>Previsto</Badge>}
        </li>
      ))}
    </ul>
  );
}

/** Programa del capítulo en la página de la lección: subtemas, clases, material, prácticas y tiempo de estudio. */
export function ProgramaCapitulo({ c }: { c: CapituloMio }) {
  const av = avanceSubtemas(c.subtemas);
  return (
    <Card title="Programa de este capítulo">
      <p className="mb-2 text-xs text-gray-500">
        {av.impartidos} de {av.total} temas impartidos en su sección. Esencial: lo que debe dominar · Complementario: amplía la comprensión ·
        Profundización: opcional.
      </p>
      <ListaSubtemas c={c} />
      {c.clases.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Clases impartidas</p>
          <ul className="text-sm">{c.clases.map((k) => <li key={k.id}><Link className="enlace" to={`/clases/${k.id}`}>{k.titulo}</Link> <span className="text-xs text-gray-500">· {fechasImpartido([k.fecha])}</span></li>)}</ul>
        </div>
      )}
      {c.enlaces.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Material y vínculos</p>
          <ul className="space-y-1 text-sm">
            {c.enlaces.map((e, i) => {
              const t = TIPOS_ENLACE[e.tipo];
              const destino = e.url ? <a className="enlace" href={e.url} target="_blank" rel="noopener noreferrer">{e.titulo}</a>
                : e.activity_id ? <Link className="enlace" to={`/actividad/${e.activity_id}`}>{e.titulo}</Link>
                : e.session_id ? <Link className="enlace" to={`/clases/${e.session_id}`}>{e.titulo}</Link>
                : <span>{e.titulo}{e.sim_key ? ` (${getSimulation(e.sim_key)?.title ?? e.sim_key})` : ''}</span>;
              return <li key={i}>{t.icono} {destino} <span className="text-xs text-gray-500">· {t.etiqueta}</span>{e.descripcion && <span className="block text-xs text-gray-500">{e.descripcion}</span>}</li>;
            })}
          </ul>
        </div>
      )}
      {c.practicas.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Prácticas y evaluaciones relacionadas</p>
          <ul className="text-sm">{c.practicas.map((p) => <li key={p.id}><Link className="enlace" to={`/actividad/${p.id}`}>{p.titulo}</Link> <span className="text-xs text-gray-500">· {p.modo === 'exam' ? 'evaluación' : 'práctica'}</span></li>)}</ul>
        </div>
      )}
      {Number(c.minutos) > 0 && <p className="mt-3 text-xs text-gray-500">Su tiempo de estudio en este capítulo: {Number(c.minutos)} min (lectura; no es una nota ni mide el dominio).</p>}
    </Card>
  );
}
