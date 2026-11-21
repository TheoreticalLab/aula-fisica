/**
 * Profesor: preguntas de la plataforma de una práctica (migración 108) con las respuestas, quién falta y los excluidos.
 * Sin preguntas (o sin la migración) no muestra nada.
 */
import { API_CONSULTAS_ACTIVIDAD } from '@/api/actividadConsultas';
import { fecha, useAction, useAsync } from '@/lib/util';
import { TABLA } from '@/pages/docente/PesTab';
import { Badge, Card, ErrorBox } from './ui';

export function ConsultasActividad({ activityId }: { activityId: string }) {
  const cons = useAsync(() => API_CONSULTAS_ACTIVIDAD.docente(activityId), [activityId]);
  const act = useAction();
  if (cons.error) return <ErrorBox error={cons.error} onRetry={cons.reload} />;
  return (
    <>
      {(cons.data ?? []).map((c) => (
        <Card key={c.id} className="mt-4" title={`Pregunta de la plataforma: ${c.titulo}`} actions={c.activa
          ? <button className="btn-secundario text-sm no-print" disabled={act.busy}
              onClick={() => { if (window.confirm('¿Cerrar la pregunta? Dejará de mostrarse a quienes no la han respondido; las respuestas se conservan.')) void act.run(async () => cons.setData(await API_CONSULTAS_ACTIVIDAD.cerrar(c.id))); }}>Cerrar la pregunta</button>
          : <Badge>Cerrada {fecha(c.cerrada_at)}</Badge>}>
          <p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">{c.texto}</p>
          <p className="mt-2 text-sm">
            <strong>{c.respuestas.filter((r) => r.respuesta).length}</strong> «Sí» · <strong>{c.respuestas.filter((r) => !r.respuesta).length}</strong> «No» · <strong>{c.pendientes.length}</strong> sin responder
            {c.excluidos.length > 0 && <> · no se pregunta a {c.excluidos.map((x) => x.nombre).join(', ')}</>}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className={TABLA}>
              <thead><tr><th>Estudiante</th><th>Respuesta</th><th>Hora</th></tr></thead>
              <tbody>
                {c.respuestas.map((r) => (
                  <tr key={r.user_id}><td>{r.nombre}</td>
                    <td>{r.respuesta ? <Badge tone="red">Sí</Badge> : <Badge tone="green">No</Badge>}</td><td>{fecha(r.created_at)}</td></tr>
                ))}
                {c.pendientes.map((p) => (
                  <tr key={p.user_id}><td>{p.nombre}</td>
                    <td><Badge>{!c.activa ? 'No respondió' : p.empezo ? 'Pendiente (la verá al volver a la práctica)' : 'Pendiente (no ha abierto la práctica)'}</Badge></td><td>—</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <ErrorBox error={act.error} />
        </Card>
      ))}
    </>
  );
}
