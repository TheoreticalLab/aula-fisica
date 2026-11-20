/**
 * Entrenadores visibles en las secciones del estudiante (migración 107). Sin la migración no muestra nada.
 * `classIds`: solo los de esas secciones (p. ej. en la página de una asignatura). Una consulta al cargar, sin sondeos.
 */
import { Link } from 'react-router-dom';
import { API_ENTRENADOR, type EntrenadorEstudiante } from '@/api/entrenador';
import { funcionAusente } from '@/api/examen';
import { useAsync } from '@/lib/util';
import { ErrorBox } from './ui';

export function ListaEntrenadores({ classIds, titulo = 'Entrenador' }: { classIds?: string[]; titulo?: string }) {
  const st = useAsync(() => API_ENTRENADOR.mis().catch((e) => { if (funcionAusente(e)) return [] as EntrenadorEstudiante[]; throw e; }), []);
  if (st.error) return <ErrorBox error={`No se pudo cargar el Entrenador: ${st.error}`} onRetry={st.reload} />;
  const xs = (st.data ?? []).filter((e) => !classIds || classIds.includes(e.class_id));
  if (!xs.length) return null;
  return (
    <section>
      <h2 className="mb-2 font-semibold">{titulo}</h2>
      <ul className="space-y-2">
        {xs.map((e) => (
          <li key={e.id}>
            <Link to={`/entrenador/${e.id}`} className="tarjeta flex flex-wrap items-center gap-2 hover:border-primario-400">
              <span className="text-xl" aria-hidden>🏋️</span>
              <span className="flex-1 font-medium">{e.titulo}</span>
              <span className="btn-primario pointer-events-none min-h-[40px]">Entrenar</span>
              <span className="w-full text-xs text-gray-500">
                {e.resumen.ejercicios ? `${e.resumen.ejercicios} ejercicios hechos · ${e.resumen.correctos} correctos` : 'Ejercicios del nivel del examen, con corrección al momento. No cuenta para la nota.'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
