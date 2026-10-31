/** Evaluaciones del estudiante, separadas de las prácticas: pendientes primero, luego entregadas y cerradas. */
import { Link } from 'react-router-dom';
import { myActivities } from '@/api/estudiante';
import { estadoActividad, ordenar } from '@/lib/actividades';
import { useAsync } from '@/lib/util';
import { ErrorBox, PageTitle, Spinner } from '@/components/ui';
import { ListaActividades } from '@/components/ListaActividades';

export function PaginaActividades({ modo }: { modo: 'exam' | 'practice' }) {
  const st = useAsync(() => myActivities(), []);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const ahora = Date.now();
  const xs = ordenar((st.data ?? []).filter((a) => a.mode === modo), ahora);
  const pendientes = xs.filter((a) => ['en_curso', 'disponible', 'proxima'].includes(estadoActividad(a, ahora).estado));
  const resto = xs.filter((a) => !pendientes.includes(a));
  const exam = modo === 'exam';
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title={exam ? 'Evaluaciones' : 'Practicar'}
        subtitle={exam ? 'Actividades calificables. Se entregan una vez y las soluciones se ven según indique el profesor.' : 'Para aprender: compruebe sus respuestas, use pistas y repita sin miedo.'} />
      <section>
        <h2 className="mb-2 font-semibold">{exam ? 'Pendientes' : 'Prácticas asignadas'}</h2>
        <ListaActividades actividades={pendientes} vacio={exam ? 'No tiene evaluaciones pendientes.' : 'No tiene prácticas pendientes.'} />
      </section>
      {!exam && (
        <section className="tarjeta flex flex-wrap items-center gap-3">
          <span className="text-2xl" aria-hidden>📖</span>
          <span className="flex-1 text-sm">También puede practicar por su cuenta en cada lección del temario.</span>
          <Link to="/temario" className="btn-secundario min-h-[40px]">Ir al temario</Link>
        </section>
      )}
      {resto.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">{exam ? 'Entregadas y cerradas' : 'Hechas y cerradas'}</h2>
          <ListaActividades actividades={resto} vacio="" />
        </section>
      )}
    </div>
  );
}

export default function Evaluaciones() { return <PaginaActividades modo="exam" />; }
export function Practicar() { return <PaginaActividades modo="practice" />; }
