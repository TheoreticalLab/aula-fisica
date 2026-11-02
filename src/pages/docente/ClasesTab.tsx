/**
 * Panel docente · sección → «Clases impartidas»: clases registradas (pendientes primero), autorizaciones de carga
 * (monitores y estudiantes delegados, con vencimiento opcional) y temas trabajados en clase que aún no están en la teoría.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clasesBrechas, clasesSeccion, configurarPermisos, otorgarDelegado, permisosClases, revocarDelegado } from '@/api/clases';
import { Badge, Card, Empty, ErrorBox, Spinner } from '@/components/ui';
import { ESTADO_FOTOS, fechaClase, filtrarClases } from '@/lib/clases';
import { useAction, useAsync } from '@/lib/util';

export function TabClasesImpartidas({ classId }: { classId: string }) {
  const st = useAsync(() => Promise.all([clasesSeccion(classId), clasesBrechas(classId)]), [classId]);
  const [texto, setTexto] = useState('');
  if (st.loading) return <Spinner />;
  if (st.error || !st.data) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const [clases, brechas] = st.data;
  const lista = filtrarClases(clases, { texto });
  const pendientes = clases.filter((c) => c.fotos_estado === 'pendiente').length;
  const costo = clases.reduce((a, c) => a + Number(c.costo_usd ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/clases/registrar" className="btn-primario">+ Registrar clase</Link>
        {pendientes > 0 && <Badge tone="amber">{pendientes} pendiente(s) de revisión</Badge>}
        <span className="text-xs text-gray-500">Costo de IA acumulado en esta sección: {costo.toFixed(3)} USD</span>
        <input className="campo ml-auto max-w-xs" placeholder="Buscar por título o tema" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      {lista.length === 0 ? <Empty>Todavía no hay clases registradas en esta sección.</Empty> : (
        <ul className="space-y-2">
          {lista.map((c) => (
            <li key={c.id}>
              <Link to={`/docente/clases-impartidas/${c.id}`} className="tarjeta flex flex-wrap items-center gap-2 hover:border-primario-400">
                <span className="w-full text-xs text-gray-500 sm:w-auto">{fechaClase(c.fecha)}</span>
                <span className="font-medium">{c.title}</span>
                <Badge tone={ESTADO_FOTOS[c.fotos_estado].tono}>{ESTADO_FOTOS[c.fotos_estado].texto}</Badge>
                {c.ampliada_publicada ? <Badge tone="green">Ampliada publicada</Badge> : (c.borradores ?? 0) > 0 ? <Badge tone="purple">Borrador de IA</Badge> : null}
                {c.procesando && <Badge tone="blue">Generando…</Badge>}
                <span className="ml-auto text-xs text-gray-500">{c.n_fotos} foto(s) · {c.subida_por ?? '—'} ({c.uploader_role})</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Autorizaciones classId={classId} />
      {brechas.length > 0 && (
        <Card title="Trabajado en clase, aún no incorporado a la teoría">
          <ul className="list-disc pl-5 text-sm">
            {brechas.map((b, i) => <li key={i}>{b.concepto} <span className="text-gray-500">— <Link className="enlace" to={`/docente/clases-impartidas/${b.session_id}`}>{b.clase}</Link> ({fechaClase(b.fecha)}){b.estado === 'sugerido' ? ' · sugerido' : ''}</span></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Autorizaciones({ classId }: { classId: string }) {
  const st = useAsync(() => permisosClases(classId), [classId]);
  const accion = useAction();
  const [alumno, setAlumno] = useState('');
  const [vence, setVence] = useState('');
  const p = st.data;
  return (
    <Card title="Autorizaciones para subir fotografías">
      {st.loading ? <Spinner /> : !p ? <ErrorBox error={st.error} /> : (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-gray-500">Quien está autorizado puede registrar clases y subir fotografías. NO puede publicar, generar con IA, aprobar ni modificar la teoría (lo impone el servidor).</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.monitores_suben} disabled={accion.busy}
            onChange={(e) => void accion.run(async () => { await configurarPermisos(classId, e.target.checked, p.permitir_descarga); st.reload(); })} />
            Los monitores de la sección pueden subir fotografías {p.monitores.length ? `(${p.monitores.map((m) => m.nombre).join(', ')})` : '(no hay monitores asignados)'}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.permitir_descarga} disabled={accion.busy}
            onChange={(e) => void accion.run(async () => { await configurarPermisos(classId, p.monitores_suben, e.target.checked); st.reload(); })} />
            Los estudiantes pueden descargar las fotografías publicadas</label>
          <div>
            <p className="font-medium">Estudiantes autorizados</p>
            {p.delegados.length === 0 ? <p className="text-gray-500">Ninguno.</p> : (
              <ul className="mt-1 space-y-1">
                {p.delegados.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2">
                    {d.nombre} {d.expires_at && <span className="text-xs text-gray-500">hasta {new Date(d.expires_at).toLocaleDateString('es-DO')}</span>}
                    {!d.vigente && <Badge tone="gray">vencida</Badge>}
                    <button className="btn-texto text-xs" disabled={accion.busy} onClick={() => void accion.run(async () => { await revocarDelegado(d.id); st.reload(); })}>Revocar</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select className="campo max-w-xs" value={alumno} onChange={(e) => setAlumno(e.target.value)}>
                <option value="">Elegir estudiante…</option>
                {p.estudiantes.filter((e) => !p.delegados.some((d) => d.user_id === e.user_id)).map((e) => <option key={e.user_id} value={e.user_id}>{e.nombre}</option>)}
              </select>
              <label className="text-xs"><span className="etiqueta">Vence (opcional)</span><input type="date" className="campo" value={vence} onChange={(e) => setVence(e.target.value)} /></label>
              <button className="btn-secundario" disabled={!alumno || accion.busy} onClick={() => void accion.run(async () => {
                await otorgarDelegado(classId, alumno, vence ? new Date(`${vence}T23:59:59-04:00`).toISOString() : null); setAlumno(''); setVence(''); st.reload();
              })}>Autorizar</button>
            </div>
          </div>
          <ErrorBox error={accion.error} />
        </div>
      )}
    </Card>
  );
}
