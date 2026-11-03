/** Prácticas extraordinarias secuenciales del estudiante (en Evaluaciones). Sin la migración 74, no muestra nada. */
import { Link } from 'react-router-dom';
import { API_PES, type ResumenPes } from '@/api/pes';
import { funcionAusente } from '@/api/examen';
import { fecha, useAsync } from '@/lib/util';
import { Badge } from './ui';

const ESTADO: Record<string, { t: string; tono: 'gray' | 'blue' | 'green' | 'amber' | 'red' }> = {
  no_iniciada: { t: 'Sin empezar', tono: 'blue' }, apartado_abierto: { t: 'En curso', tono: 'amber' }, esperando_liberacion: { t: 'Esperando el siguiente bloque', tono: 'gray' },
  completada: { t: 'Terminada', tono: 'green' }, vencida: { t: 'Plazo terminado', tono: 'red' },
};

export function ListaPes() {
  const st = useAsync(() => API_PES.misPracticas().catch((e) => { if (funcionAusente(e)) return [] as ResumenPes[]; throw e; }), []);
  const xs = st.data ?? [];
  if (!xs.length) return null;
  return (
    <section>
      <h2 className="mb-2 font-semibold">Prácticas extraordinarias</h2>
      <ul className="space-y-2">
        {xs.map((p) => {
          const e = ESTADO[p.estado ?? 'no_iniciada'] ?? ESTADO.no_iniciada;
          return (
            <li key={p.id}>
              <Link to={`/pes/${p.id}`} className="tarjeta flex flex-wrap items-center gap-2 hover:border-primario-400">
                <span className="flex-1 font-medium">{p.titulo}</span>
                <Badge tone={e.tono}>{p.estado_practica === 'cerrada' && p.estado !== 'completada' ? 'Cerrada' : e.t}</Badge>
                <span className="w-full text-xs text-gray-500">{p.cerrados} de {p.apartados} apartados · cierra {fecha(p.cierre)}{p.resultado ? ' · resultados publicados' : ''}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
