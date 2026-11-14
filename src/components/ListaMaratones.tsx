/**
 * Maratones adaptativos publicados en las secciones del estudiante (Evaluaciones: todos; Inicio: los que tienen
 * jornada abierta hoy). Sin la migración 94 no muestra nada. Una sola consulta al cargar la página, sin sondeos.
 */
import { Link } from 'react-router-dom';
import { API_MARATON, type ResumenMaratonEstudiante } from '@/api/maraton';
import { funcionAusente } from '@/api/examen';
import { useAsync } from '@/lib/util';
import { Badge, ErrorBox } from './ui';

function estado(m: ResumenMaratonEstudiante): { t: string; tono: 'gray' | 'blue' | 'green' | 'amber' | 'red' } {
  if (m.finalizado || m.hoy.fase === 'finalizado') return { t: m.informe_disponible ? 'Terminado · informe disponible' : 'Terminado', tono: 'gray' };
  if (m.hoy.fase === 'antes' || m.hoy.fase === 'sin_fecha') return { t: 'Próximamente', tono: 'gray' };
  if (m.jornada_hoy === 'completada') return { t: `Jornada ${m.hoy.numero} completada`, tono: 'green' };
  if (m.jornada_hoy === 'en_curso') return { t: `Jornada ${m.hoy.numero} en desarrollo`, tono: 'amber' };
  if (m.hoy.fase === 'abierta') return { t: `Jornada ${m.hoy.numero} abierta`, tono: 'blue' };
  return { t: 'Sin jornada abierta ahora', tono: 'gray' };
}

export const maratonPendienteHoy = (m: ResumenMaratonEstudiante) => m.hoy.fase === 'abierta' && m.jornada_hoy !== 'completada' && m.jornada_hoy !== 'cerrada';

export function ListaMaratones({ soloPendientes = false, titulo = 'Maratón académico' }: { soloPendientes?: boolean; titulo?: string }) {
  const st = useAsync(() => API_MARATON.misMaratones().catch((e) => { if (funcionAusente(e)) return [] as ResumenMaratonEstudiante[]; throw e; }), []);
  if (st.error) return <ErrorBox error={`No se pudieron cargar los maratones: ${st.error}`} onRetry={st.reload} />;
  const xs = (st.data ?? []).filter((m) => !soloPendientes || maratonPendienteHoy(m));
  if (!xs.length) return null;
  return (
    <section>
      <h2 className="mb-2 font-semibold">{titulo}</h2>
      <ul className="space-y-2">
        {xs.map((m) => {
          const e = estado(m);
          return (
            <li key={m.id}>
              <Link to={`/maraton/${m.id}`} className="tarjeta flex flex-wrap items-center gap-2 hover:border-primario-400">
                <span className="text-xl" aria-hidden>🏃</span>
                <span className="flex-1 font-medium">{m.titulo}</span>
                <Badge tone={e.tono}>{e.t}</Badge>
                <span className="w-full text-xs text-gray-500">{m.asignatura} · {m.jornadas} jornadas{m.fecha_inicio ? ` desde el ${m.fecha_inicio}` : ''}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
