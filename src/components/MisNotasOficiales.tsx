/** Notas oficiales del estudiante (solo las propias y solo si el profesor las publicó). */
import { rpc } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { calcularNota, CATEGORIAS, type Notas } from '@/lib/notas';

interface Registro {
  class_id: string;
  class_name: string;
  course_title: string;
  published: boolean;
  notas: Notas | null;
  extras: { points: number; reason: string; created_at: string }[] | null;
}

export function MisNotasOficiales() {
  const { data } = useAsync(() => rpc<Registro[]>('my_official_grades'), []);
  const regs = (data ?? []).filter((r) => r.published);
  if (!regs.length) return null;
  return (
    <>
      {regs.map((r) => {
        const notas = Object.fromEntries(Object.entries(r.notas ?? {}).map(([k, v]) => [k, v === null ? null : Number(v)])) as Notas;
        const extras = (r.extras ?? []).reduce((s, x) => s + Number(x.points), 0);
        const t = calcularNota(notas, extras);
        return (
          <section key={r.class_id} className="tarjeta mb-4">
            <h2 className="text-lg font-semibold">Registro de calificaciones · {r.course_title}</h2>
            <p className="mb-2 text-xs text-gray-500">{r.class_name}</p>
            <table className="w-full text-sm">
              <tbody>
                {CATEGORIAS.map((c) => {
                  const v = notas[c.id];
                  return (
                    <tr key={c.id} className="border-b border-gray-100 dark:border-white/5">
                      <td className="py-1">{c.label}</td>
                      <td className="py-1 text-right tabular-nums">
                        {v === null || v === undefined ? <span className="text-gray-500">Pendiente</span> : <><strong>{v}</strong> / {c.max}</>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-b border-gray-100 dark:border-white/5">
                  <td className="py-1">Puntos extras</td>
                  <td className="py-1 text-right tabular-nums">{extras ? `+${extras}` : '0'}</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold">Nota final{t.pendientes.length ? ' (parcial)' : ''}</td>
                  <td className="py-2 text-right text-lg font-semibold tabular-nums">{t.final} / 100</td>
                </tr>
              </tbody>
            </table>
            {t.bruto > 100 && <p className="text-xs text-gray-500">Total bruto: {t.bruto} (la nota oficial tiene un máximo de 100).</p>}
            {t.pendientes.length > 0 && <p className="text-xs text-gray-500">«Pendiente» = todavía sin calificar (no es un cero).</p>}
            {(r.extras ?? []).length > 0 && (
              <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {(r.extras ?? []).map((x, i) => <li key={i}>+{Number(x.points)} · {x.reason} · {new Date(x.created_at).toLocaleDateString('es-DO')}</li>)}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
