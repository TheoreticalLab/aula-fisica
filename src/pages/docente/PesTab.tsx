/** Panel docente → sección → Prácticas extraordinarias (PES): lista y creación. El editor está en PesEditor. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pesCrear, pesLista, type PesListaItem } from '@/api/pes';
import { funcionAusente } from '@/api/examen';
import { fecha, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Field, Notice, Spinner } from '@/components/ui';

/** Tablas con el estilo de las del panel (encabezado pequeño en gris, filas separadas). */
export const TABLA = 'w-full text-sm [&_th]:py-1 [&_th]:pr-2 [&_th]:text-left [&_th]:text-xs [&_th]:uppercase [&_th]:text-gray-500 [&_td]:py-2 [&_td]:pr-2 [&_td]:align-top [&_tbody_tr]:border-t [&_tbody_tr]:border-gray-100 dark:[&_tbody_tr]:border-white/10';

export const ESTADO_PES: Record<PesListaItem['estado'], { t: string; tono: 'gray' | 'blue' | 'green' | 'amber' }> = {
  borrador: { t: 'Borrador', tono: 'gray' }, publicada: { t: 'Publicada', tono: 'green' }, cerrada: { t: 'Cerrada', tono: 'amber' }, archivada: { t: 'Archivada', tono: 'gray' },
};

export function TabPes({ classId }: { classId: string }) {
  const nav = useNavigate();
  const lista = useAsync(() => pesLista(classId).catch((e) => { if (funcionAusente(e)) return null; throw e; }), [classId]);
  const [titulo, setTitulo] = useState('');
  const act = useAction();
  if (lista.loading && !lista.data) return <Spinner />;
  if (lista.error) return <ErrorBox error={lista.error} onRetry={lista.reload} />;
  if (lista.data === null) return <Notice tone="warn">Las prácticas extraordinarias todavía no están instaladas en la base de datos (migración 74).</Notice>;
  const xs = lista.data ?? [];
  return (
    <div className="space-y-4">
      <Notice>
        Una práctica extraordinaria secuencial presenta problemas de 3 a 5 apartados <strong>de uno en uno</strong>, de forma irreversible, con una
        espera mínima por apartado. Avanzar antes reduce la puntuación del apartado; omitir vale 0. La puntuación es informativa (no entra en el
        Registro de Calificaciones). Dificulta el uso mecánico de asistentes externos; no lo impide ni lo detecta.
      </Notice>
      <Card title="Nueva práctica extraordinaria">
        <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => {
          e.preventDefault();
          const id = await act.run(() => pesCrear(classId, { titulo: titulo.trim() }));
          if (id) nav(`/docente/pes/${id}`);
        }}>
          <div className="min-w-[16rem] flex-1">
            <Field label="Título">{(id) => <input id={id} className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} required />}</Field>
          </div>
          <button className="btn-primario" disabled={act.busy || !titulo.trim()}>Crear borrador</button>
        </form>
        <ErrorBox error={act.error} />
      </Card>
      {xs.length === 0 ? <Empty>Esta sección no tiene prácticas extraordinarias.</Empty> : (
        <div className="overflow-x-auto">
          <table className={TABLA}>
            <thead><tr><th>Práctica</th><th>Estado</th><th>Contenido</th><th>Estudiantes</th><th>Revisión</th><th>Cierre</th><th /></tr></thead>
            <tbody>
              {xs.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.titulo}</td>
                  <td><Badge tone={ESTADO_PES[p.estado].tono}>{ESTADO_PES[p.estado].t}</Badge>{p.resultados_publicados && <> <Badge tone="blue">Resultados publicados</Badge></>}</td>
                  <td>{p.ejercicios} ejerc. · {p.apartados} apart.</td>
                  <td>{p.asignados ? `${p.por_estado.completada ?? 0} terminadas · ${p.por_estado.apartado_abierto ?? 0} en curso · ${p.asignados} asignadas` : '—'}</td>
                  <td>{p.pendientes_revision ? <Badge tone="amber">{p.pendientes_revision} por revisar</Badge> : '—'}</td>
                  <td>{fecha(p.cierra_at)}</td>
                  <td><Link className="enlace" to={`/docente/pes/${p.id}`}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
