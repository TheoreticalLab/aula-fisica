/** Lista de actividades del estudiante con estado claro y una sola acción por fila (se usa en el panel y en las páginas). */
import { Link } from 'react-router-dom';
import type { MyActivity } from '@/api/tipos';
import { estadoActividad } from '@/lib/actividades';
import { fecha, relativo } from '@/lib/util';
import { Badge } from './ui';

export function ListaActividades({ actividades, ruta = (id) => `/actividad/${id}`, vacio }: { actividades: MyActivity[]; ruta?: (id: string) => string; vacio: string }) {
  const ahora = Date.now();
  if (!actividades.length) return <p className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-white/15">{vacio}</p>;
  return (
    <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
      {actividades.map((a) => {
        const e = estadoActividad(a, ahora);
        const destino = a.in_progress ? `/intento/${a.in_progress}` : ruta(a.id);
        return (
          <li key={a.id}>
            <Link to={destino} className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-white/5">
              <span className="text-xl" aria-hidden>{a.mode === 'exam' ? '📝' : '🧩'}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2"><span className="font-medium text-primario-950 dark:text-white">{a.title}</span><Badge tone={e.tono}>{e.etiqueta}</Badge></span>
                <span className={`mt-0.5 block text-sm ${e.urgente ? 'font-medium text-red-700 dark:text-red-300' : 'text-gray-500'}`}>
                  {e.estado === 'proxima' && a.opens_at ? `Abre ${relativo(a.opens_at)} (${fecha(a.opens_at)})` : a.closes_at ? `Cierra ${relativo(a.closes_at)} (${fecha(a.closes_at)})` : 'Sin fecha límite'}
                  {' · '}{a.items} pregunta(s){a.max_attempts !== null && ` · intentos ${a.attempts_used}/${a.max_attempts}`}
                </span>
                <span className="block text-xs text-gray-500">{a.class_name}</span>
              </span>
              {e.accion && <span className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${e.estado === 'en_curso' || e.estado === 'disponible' ? 'bg-primario-600 text-white' : 'border border-gray-300 dark:border-white/20'}`}>{e.accion}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
