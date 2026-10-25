import { Link } from 'react-router-dom';
import { myGrades } from '@/api/estudiante';
import { fecha, porcentaje, puntaje, useAsync } from '@/lib/util';
import { Badge, Empty, ErrorBox, PageTitle, Spinner } from '@/components/ui';

export default function Calificaciones() {
  const { data, loading, error, reload } = useAsync(myGrades, []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const byClass = new Map<string, typeof data>();
  for (const g of data!) byClass.set(g.class_name, [...(byClass.get(g.class_name) ?? []), g]);
  return (
    <div>
      <PageTitle title="Calificaciones" subtitle="Solo aparecen las actividades cuyas notas publicó el profesor. Se toma el mejor intento entregado." />
      {!data!.length && <Empty>Todavía no hay calificaciones publicadas.</Empty>}
      {[...byClass.entries()].map(([cls, rows]) => {
        const valid = rows!.filter((r) => r.best_score !== null && r.max_score > 0);
        const avg = valid.length ? valid.reduce((s, r) => s + Number(r.best_score) / Number(r.max_score), 0) / valid.length : null;
        return (
          <section key={cls} className="tarjeta mb-4">
            <div className="mb-2 flex justify-between gap-2">
              <h2 className="text-lg font-semibold">{cls}</h2>
              <span className="text-sm">Promedio: <strong>{porcentaje(avg)}</strong></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="py-1 pr-2">Actividad</th>
                    <th className="py-1 pr-2">Tipo</th>
                    <th className="py-1 pr-2">Cierre</th>
                    <th className="py-1 pr-2 text-right">Nota</th>
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody>
                  {rows!.map((g) => (
                    <tr key={g.activity_id} className="border-t border-gray-100 dark:border-white/10">
                      <td className="py-2 pr-2">{g.title}</td>
                      <td className="py-2 pr-2"><Badge tone={g.mode === 'exam' ? 'purple' : 'blue'}>{g.mode === 'exam' ? 'Evaluación' : 'Práctica'}</Badge></td>
                      <td className="py-2 pr-2 text-gray-500">{fecha(g.closes_at)}</td>
                      <td className="py-2 pr-2 text-right font-medium tabular-nums">
                        {g.attempts ? puntaje(g.best_score, g.max_score) : 'No entregada'}
                        {g.pending_review && <span className="block text-xs font-normal text-gray-500">revisión pendiente</span>}
                      </td>
                      <td className="py-2 text-right">{g.last_attempt_id && <Link className="enlace" to={`/intento/${g.last_attempt_id}`}>Ver</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
