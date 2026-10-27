/**
 * Registro de calificaciones del estudiante: la distribución (siempre), sus notas (si el profesor las publicó),
 * de dónde sale cada nota y un enlace para revisar las actividades que la componen. Solo datos propios.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { rpc } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { calcularNota, CATEGORIAS, type Categoria, type Notas } from '@/lib/notas';

interface ActividadV { activity_id: string; title: string; mode: string; closes_at: string | null; peso: number | null; por_definir: boolean; visible: boolean; mejor: number | null }
interface CategoriaV { category: Categoria; max: number; score: number | null; source: 'manual' | 'actividades' | null; pendientes: number | null; actividades: ActividadV[] }
interface Seccion { class_id: string; class_name: string; course_title: string; published: boolean; categorias: CategoriaV[]; extras: { points: number; reason: string; created_at: string }[] }

const ETIQUETA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.label])) as Record<Categoria, string>;

function Apartado({ c, publicado }: { c: CategoriaV; publicado: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const calificado = publicado && c.score !== null;
  const hayActs = c.actividades.length > 0;
  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium">{ETIQUETA[c.category]} <span className="text-xs font-normal text-gray-500">vale {c.max} puntos</span></p>
          <p className="text-xs text-gray-500">
            {!publicado ? 'Notas aún no publicadas'
              : c.source === 'manual' ? 'Calificado por el profesor'
              : c.source === 'actividades' ? `Calculado con ${c.actividades.length} actividad(es)${c.pendientes ? ` · ${c.pendientes} pendiente(s)` : ''}`
              : hayActs ? 'Se calculará con las actividades indicadas' : 'Pendiente de calificar'}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular-nums">{calificado ? <><strong className="text-lg">{Number(c.score)}</strong> / {c.max}</> : <span className="text-sm text-gray-500">{publicado ? 'Pendiente' : '—'}</span>}</p>
          {hayActs && <button className="enlace text-xs" onClick={() => setAbierto(!abierto)}>{abierto ? 'Ocultar' : 'Revisar'}</button>}
        </div>
      </div>
      {abierto && (
        <ul className="mt-2 space-y-1 rounded-lg bg-gray-50 p-2 text-sm dark:bg-white/5">
          {c.actividades.map((a) => (
            <li key={a.activity_id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {a.visible ? <Link to={`/actividad/${a.activity_id}`} className="enlace">{a.title}</Link> : a.title}
                <span className="text-xs text-gray-500"> · {a.mode === 'exam' ? 'examen' : 'práctica'} · vale {a.peso !== null ? Number(a.peso) : '—'} pts{a.por_definir ? ' (valor provisional)' : ''}</span>
              </span>
              <span className="text-xs">
                {!publicado ? '' : a.mejor !== null ? <>su mejor intento: <strong>{Number(a.mejor)} %</strong> → {a.peso !== null ? Math.round(Number(a.peso) * Number(a.mejor)) / 100 : '—'} pts</>
                  : a.closes_at && new Date(a.closes_at) < new Date() ? 'no entregada (cuenta 0)' : 'pendiente de entregar'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function MisNotasOficiales() {
  const { data } = useAsync(() => rpc<Seccion[]>('my_grade_breakdown'), []);
  if (!data?.length) return null;
  return (
    <>
      {data.map((s) => {
        const notas = Object.fromEntries(s.categorias.map((c) => [c.category, c.score === null ? null : Number(c.score)])) as Notas;
        const extras = s.extras.reduce((t, x) => t + Number(x.points), 0);
        const t = calcularNota(notas, extras);
        return (
          <section key={s.class_id} className="tarjeta mb-4">
            <h2 className="text-lg font-semibold">Registro de calificaciones · {s.course_title}</h2>
            <p className="text-xs text-gray-500">{s.class_name} · distribución: 15 + 15 + 15 + 30 + 25 = 100 puntos, más extras</p>
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {s.categorias.map((c) => <Apartado key={c.category} c={c} publicado={s.published} />)}
              {s.published && (
                <li className="flex justify-between py-2">
                  <span>Puntos extras {s.extras.length > 0 && <span className="block text-xs text-gray-500">{s.extras.map((x) => `+${Number(x.points)} ${x.reason}`).join(' · ')}</span>}</span>
                  <span className="tabular-nums">{extras ? `+${extras}` : '0'}</span>
                </li>
              )}
            </ul>
            {s.published ? (
              <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 dark:border-white/10">
                <span className="font-semibold">Nota final{t.pendientes.length ? ' (hasta ahora)' : ''}</span>
                <span className="text-lg font-semibold tabular-nums">{t.final} / 100</span>
              </div>
            ) : <p className="mt-2 text-sm text-gray-500">El profesor todavía no ha publicado las notas de esta sección.</p>}
            {s.published && t.bruto > 100 && <p className="text-xs text-gray-500">Total bruto: {t.bruto} (la nota oficial tiene un máximo de 100).</p>}
            {s.published && t.pendientes.length > 0 && <p className="text-xs text-gray-500">«Pendiente» = todavía sin calificar (no es un cero).</p>}
          </section>
        );
      })}
    </>
  );
}
