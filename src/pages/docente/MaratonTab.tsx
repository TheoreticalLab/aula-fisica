/** Panel docente → sección → Maratón adaptativo: lista y creación. El configurador está en MaratonEditor. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { maratonCrear, maratonLista, type MaratonListaItem } from '@/api/maraton';
import { funcionAusente } from '@/api/examen';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Field, Notice, Spinner } from '@/components/ui';
import { TABLA } from './PesTab';

export const ESTADO_MARATON: Record<MaratonListaItem['estado'], { t: string; tono: 'gray' | 'green' | 'amber' }> = {
  borrador: { t: 'Borrador', tono: 'gray' }, publicado: { t: 'Publicado', tono: 'green' }, archivado: { t: 'Archivado', tono: 'amber' },
};

export function faseTexto(m: Pick<MaratonListaItem, 'hoy' | 'jornadas'>): string {
  const h = m.hoy;
  switch (h.fase) {
    case 'sin_fecha': return 'Sin fecha de inicio';
    case 'antes': return `Empieza el ${h.siguiente?.fecha ?? '—'}`;
    case 'finalizado': return 'Terminado';
    case 'abierta': return `Jornada ${h.numero} de ${m.jornadas} (abierta)`;
    case 'antes_de_apertura': return `Jornada ${h.numero} (abre más tarde)`;
    case 'cerrada_hoy': return `Jornada ${h.numero} (cerrada por hoy)`;
    default: return 'Hoy no hay jornada';
  }
}

export function TabMaraton({ classId }: { classId: string }) {
  const nav = useNavigate();
  const lista = useAsync(() => maratonLista(classId).catch((e) => { if (funcionAusente(e)) return null; throw e; }), [classId]);
  const [titulo, setTitulo] = useState('');
  const act = useAction();
  if (lista.loading && !lista.data) return <Spinner />;
  if (lista.error) return <ErrorBox error={lista.error} onRetry={lista.reload} />;
  if (lista.data === null) return <Notice tone="warn">El Maratón adaptativo todavía no está instalado en la base de datos (migración 94).</Notice>;
  const xs = lista.data ?? [];
  return (
    <div className="space-y-4">
      <Notice>
        Un maratón adaptativo presenta, durante varias jornadas, problemas del banco de la asignatura con una dificultad que sube al acertar y baja al
        fallar o al declarar «No puedo». La cantidad de ejercicios por jornada es variable (cuota interna de trabajo). Genera informes descriptivos y
        un historial auditable; <strong>no asigna calificaciones</strong> ni entra en el Registro de Calificaciones.
      </Notice>
      <Card title="Nuevo maratón (borrador)">
        <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => {
          e.preventDefault();
          const id = await act.run(() => maratonCrear(classId, { titulo: titulo.trim() }));
          if (id) nav(`/docente/maraton/${id}`);
        }}>
          <div className="min-w-[16rem] flex-1">
            <Field label="Nombre">{(id) => <input id={id} className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} required />}</Field>
          </div>
          <button className="btn-primario" disabled={act.busy || !titulo.trim()}>Crear borrador</button>
        </form>
        <ErrorBox error={act.error} />
      </Card>
      {xs.length === 0 ? <Empty>Esta sección no tiene maratones.</Empty> : (
        <div className="overflow-x-auto">
          <table className={TABLA}>
            <thead><tr><th>Maratón</th><th>Estado</th><th>Calendario</th><th>Participantes</th><th>Banco</th><th /></tr></thead>
            <tbody>
              {xs.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.titulo}</td>
                  <td><Badge tone={ESTADO_MARATON[m.estado].tono}>{ESTADO_MARATON[m.estado].t}</Badge></td>
                  <td>{m.jornadas} jornadas · {faseTexto(m)}</td>
                  <td>{m.participantes}</td>
                  <td className="text-xs text-gray-500">{m.banco_id}</td>
                  <td className="whitespace-nowrap"><Link className="enlace" to={`/docente/maraton/${m.id}`}>Configurar</Link> · <Link className="enlace" to={`/docente/maraton/${m.id}?t=informe`}>Informe</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
