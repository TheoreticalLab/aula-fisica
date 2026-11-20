/**
 * Panel docente → sección → Entrenador (migración 107): visible o no para los estudiantes, cuánto entrenó cada uno,
 * aciertos por tema y, por estudiante, cada ejercicio con sus respuestas y el valor correcto. No hay notas.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_ENTRENADOR_DOCENTE, type EjercicioDetalle, type EntrenadorDeClase } from '@/api/entrenador';
import { funcionAusente } from '@/api/examen';
import { fecha, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Modal, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { TABLA } from './PesTab';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');
const ESTADO: Record<EjercicioDetalle['estado'], { t: string; tono: 'gray' | 'green' | 'amber' | 'red' }> = {
  abierto: { t: 'En curso', tono: 'gray' }, correcto: { t: 'Correcto', tono: 'green' }, agotado: { t: 'Intentos agotados', tono: 'red' }, solucion: { t: 'Vio la solución', tono: 'amber' },
};

export function TabEntrenador({ classId }: { classId: string }) {
  const lista = useAsync(() => API_ENTRENADOR_DOCENTE.deClase(classId).catch((e) => { if (funcionAusente(e)) return null; throw e; }), [classId]);
  if (lista.loading) return <Spinner />;
  if (lista.error) return <ErrorBox error={lista.error} onRetry={lista.reload} />;
  if (!lista.data) return <Empty>El Entrenador todavía no está instalado en el servidor.</Empty>;
  if (!lista.data.length) return <Empty>Esta sección no tiene Entrenador.</Empty>;
  return <div className="space-y-6">{lista.data.map((e) => <Informe key={e.id} e={e} onCambio={lista.reload} />)}</div>;
}

function Informe({ e, onCambio }: { e: EntrenadorDeClase; onCambio: () => void }) {
  const inf = useAsync(() => API_ENTRENADOR_DOCENTE.informe(e.id), [e.id]);
  const act = useAction();
  const [viendo, setViendo] = useState<{ id: string; nombre: string } | null>(null);
  async function alternar() {
    if (await act.run(() => API_ENTRENADOR_DOCENTE.activar(e.id, !e.activo)) !== undefined) onCambio();
  }
  return (
    <Card title={<>{e.titulo} <Badge tone={e.activo ? 'green' : 'gray'}>{e.activo ? 'Visible para los estudiantes' : 'Oculto'}</Badge></>}
      actions={<>
        <Link to={`/entrenador/${e.id}`} className="btn-secundario">Probarlo</Link>
        <button className="btn-secundario" disabled={act.busy} onClick={() => void alternar()}>{e.activo ? 'Ocultar' : 'Hacer visible'}</button>
      </>}>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Ejercicios al azar del banco, siempre del mismo nivel; {e.intentos} intento(s) por ejercicio y después la solución. No cuenta para la nota.
        Sus recorridos de prueba no aparecen aquí.
      </p>
      <ErrorBox error={act.error} />
      {inf.loading && <Spinner />}
      {inf.error && <ErrorBox error={inf.error} onRetry={inf.reload} />}
      {inf.data && (
        <div className="space-y-5">
          <div className="overflow-x-auto">
            <table className={TABLA}>
              <thead><tr><th>Estudiante</th><th>Ejercicios</th><th>Correctos</th><th>Al 1.er intento</th><th>Sin resolver</th><th>Hoy</th><th>Minutos</th><th>Último</th></tr></thead>
              <tbody>
                {inf.data.estudiantes.map((s) => (
                  <tr key={s.user_id}>
                    <td>{s.resumen.ejercicios ? <button className="btn-texto text-left" onClick={() => setViendo({ id: s.user_id, nombre: s.nombre })}>{s.nombre}</button> : s.nombre}</td>
                    <td>{s.resumen.ejercicios}</td>
                    <td>{s.resumen.correctos} <span className="text-gray-500">({pct(s.resumen.correctos, s.resumen.ejercicios)})</span></td>
                    <td>{s.resumen.primer_intento}</td>
                    <td>{s.resumen.sin_resolver}</td>
                    <td>{s.resumen.hoy}</td>
                    <td>{s.resumen.minutos}</td>
                    <td className="whitespace-nowrap">{s.ultimo ? fecha(s.ultimo) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Por tema</h3>
            <table className={TABLA}>
              <thead><tr><th>Tema</th><th>Ejercicios</th><th>Correctos</th></tr></thead>
              <tbody>
                {inf.data.temas.map((t) => <tr key={t.codigo}><td>{t.nombre}</td><td>{t.ejercicios}</td><td>{t.correctos} <span className="text-gray-500">({pct(t.correctos, t.ejercicios)})</span></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal open={viendo !== null} onClose={() => setViendo(null)} title={viendo ? `${viendo.nombre} — ejercicios del Entrenador` : ''}>
        {viendo && <Detalle entrenador={e.id} userId={viendo.id} />}
      </Modal>
    </Card>
  );
}

function Detalle({ entrenador, userId }: { entrenador: string; userId: string }) {
  const st = useAsync(() => API_ENTRENADOR_DOCENTE.detalle(entrenador, userId), [entrenador, userId]);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!st.data?.length) return <Empty>Sin ejercicios.</Empty>;
  return (
    <ul className="max-h-[70vh] space-y-3 overflow-y-auto">
      {st.data.map((x) => (
        <li key={x.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-white/10">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <Badge tone={ESTADO[x.estado].tono}>{ESTADO[x.estado].t}</Badge>
            <span>{fecha(x.presentado_at)}</span>
            {x.segundos != null && <span>· {Math.max(1, Math.round(x.segundos / 60))} min</span>}
          </div>
          <details>
            <summary className="cursor-pointer">Enunciado</summary>
            <Markdown className="prosa mt-1 text-sm">{x.enunciado}</Markdown>
          </details>
          <table className={`${TABLA} mt-2`}>
            <thead><tr><th>Resultado</th>{x.respuestas.map((r) => <th key={r.n}>Intento {r.n}</th>)}<th>Correcto</th></tr></thead>
            <tbody>
              {x.partes.map((p, i) => (
                <tr key={i}>
                  <td>{p.etiqueta}</td>
                  {x.respuestas.map((r) => (
                    <td key={r.n} className="font-mono">{r.partes[i]} {r.detalle?.partes?.[i] ? (r.detalle.partes[i].correcta ? '✔' : '✖') : ''}</td>
                  ))}
                  <td className="font-mono">{x.valores?.[i] ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
      ))}
    </ul>
  );
}
