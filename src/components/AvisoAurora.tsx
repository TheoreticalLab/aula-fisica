/** Aviso en el inicio del estudiante cuando tiene una entrevista AURORA-07 habilitada (migración 105). */
import { Link } from 'react-router-dom';
import { API_AURORA } from '@/api/aurora';
import { funcionAusente } from '@/api/examen';
import { useAsync } from '@/lib/util';

export function AvisoAurora() {
  const st = useAsync(() => API_AURORA.pendiente().catch((e) => { if (funcionAusente(e)) return []; throw e; }), []);
  const xs = st.data ?? [];
  if (!xs.length) return null;
  return (
    <section>
      <h2 className="mb-2 font-semibold">Entrevista pendiente</h2>
      <ul className="space-y-2">
        {xs.map((x) => (
          <li key={x.id}>
            <Link to={`/aurora/${x.id}`} className="tarjeta flex flex-wrap items-center gap-2 hover:border-primario-400">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primario-600 text-[10px] font-bold text-white" aria-hidden>A7</span>
              <span className="flex-1 font-medium">{x.titulo}</span>
              <span className="text-sm text-primario-700 dark:text-primario-300">{x.iniciada ? 'Continuar' : 'Comenzar'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
