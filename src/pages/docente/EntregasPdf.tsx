/** Pestaña «Entregas en PDF» de una sección: buzones, autorizaciones y revisión de los archivos. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  abrirPdf, archivarBuzon, autorizarATodos, buzonesDeSeccion, decidirPermiso, estudiantesDeBuzon, guardarBuzon, revisarArchivo, tamano, TIPO_BUZON,
  type Buzon,
} from '@/api/entregas';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Modal, Spinner } from '@/components/ui';

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const PERMISO: Record<string, [string, 'amber' | 'green' | 'red' | 'gray']> = {
  solicitado: ['solicita autorización', 'amber'], aprobado: ['autorizado', 'green'], rechazado: ['rechazado', 'red'], revocado: ['revocado', 'red'],
};
const ESTADO = { recibido: ['sin revisar', 'blue'], aceptado: ['aceptado', 'green'], rechazado: ['rechazado', 'red'] } as const;

function FormBuzon({ classId, b, onListo }: { classId: string; b: Buzon | null; onListo: () => void }) {
  const [f, setF] = useState({
    title: b?.title ?? '', instructions: b?.instructions ?? '', kind: b?.kind ?? 'practica', opens_at: local(b?.opens_at ?? null),
    closes_at: local(b?.closes_at ?? null), requires_approval: b?.requires_approval ?? true, max_files: b?.max_files ?? 1, max_mb: b?.max_mb ?? 10,
  });
  const accion = useAction();
  async function guardar() {
    await accion.run(async () => {
      await guardarBuzon({ id: b?.id ?? null, class_id: classId, ...f, title: f.title.trim(),
        opens_at: f.opens_at ? new Date(f.opens_at).toISOString() : null, closes_at: f.closes_at ? new Date(f.closes_at).toISOString() : null });
      onListo();
    });
  }
  return (
    <div className="space-y-2 text-sm">
      <ErrorBox error={accion.error} />
      <label className="block">Título<input className="campo" maxLength={160} placeholder="Práctica 3 · Movimiento parabólico (escrita)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="block">Tipo
        <select className="campo" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Buzon['kind'] })}>
          {Object.entries(TIPO_BUZON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="block">Instrucciones<textarea className="campo min-h-[4rem]" maxLength={4000} placeholder="Escanee todas las páginas en orden, con su nombre y matrícula visibles." value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">Abre (opcional)<input type="datetime-local" className="campo" value={f.opens_at} onChange={(e) => setF({ ...f, opens_at: e.target.value })} /></label>
        <label className="block">Cierra (opcional)<input type="datetime-local" className="campo" value={f.closes_at} onChange={(e) => setF({ ...f, closes_at: e.target.value })} /></label>
        <label className="block">Archivos por estudiante<input type="number" min={1} max={10} className="campo" value={f.max_files} onChange={(e) => setF({ ...f, max_files: Number(e.target.value) })} /></label>
        <label className="block">Tamaño máximo (MB)<input type="number" min={1} max={20} className="campo" value={f.max_mb} onChange={(e) => setF({ ...f, max_mb: Number(e.target.value) })} /></label>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={f.requires_approval} onChange={(e) => setF({ ...f, requires_approval: e.target.checked })} /> Exigir mi autorización antes de subir (recomendado)</label>
      <button className="btn-primario" disabled={!f.title.trim() || accion.busy} onClick={() => void guardar()}>{b ? 'Guardar cambios' : 'Crear buzón'}</button>
    </div>
  );
}

function DetalleBuzon({ b, onCambio }: { b: Buzon; onCambio: () => void }) {
  const st = useAsync(() => estudiantesDeBuzon(b.id), [b.id]);
  const accion = useAction();
  const [nota, setNota] = useState<Record<string, string>>({});
  const recargar = () => { void st.reload(); onCambio(); };
  const hacer = (fn: () => Promise<unknown>) => void accion.run(fn).then(recargar);
  const lista = st.data ?? [];
  const pendientes = lista.filter((e) => e.permiso === 'solicitado');
  return (
    <div className="space-y-3">
      <ErrorBox error={accion.error || st.error} />
      <div className="flex flex-wrap gap-2">
        {b.requires_approval && <button className="btn-secundario !py-1 text-xs" disabled={accion.busy} onClick={() => window.confirm('¿Autorizar a todos los estudiantes de la sección? (no cambia a los que rechazó)') && hacer(() => autorizarATodos(b.id))}>Autorizar a todos</button>}
        {pendientes.length > 1 && <button className="btn-secundario !py-1 text-xs" disabled={accion.busy} onClick={() => hacer(() => Promise.all(pendientes.map((e) => decidirPermiso(b.id, e.user_id, 'aprobado', null))))}>Aprobar las {pendientes.length} solicitudes</button>}
      </div>
      {st.loading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Estudiante</th>{b.requires_approval && <th>Autorización</th>}<th>Archivos entregados</th></tr></thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.user_id} className="border-b border-gray-100 align-top dark:border-white/5">
                  <td className="py-1.5"><Link className="enlace" to={`/docente/estudiantes/${e.user_id}`}>{e.full_name || '—'}</Link><span className="block text-xs text-gray-500">{e.student_code}</span></td>
                  {b.requires_approval && (
                    <td className="text-xs">
                      {e.permiso ? <Badge tone={PERMISO[e.permiso][1]}>{PERMISO[e.permiso][0]}</Badge> : <span className="text-gray-400">no ha solicitado</span>}
                      {e.request_note && <span className="block italic">«{e.request_note}»</span>}
                      {e.requested_at && <span className="block text-gray-500">{fecha(e.requested_at)}</span>}
                      <span className="mt-1 flex flex-wrap gap-1">
                        {e.permiso !== 'aprobado' && <button className="btn-secundario !px-2 !py-0.5" disabled={accion.busy} onClick={() => hacer(() => decidirPermiso(b.id, e.user_id, 'aprobado', null))}>Aprobar</button>}
                        {e.permiso === 'solicitado' && <button className="btn-secundario !px-2 !py-0.5" disabled={accion.busy} onClick={() => { const n = window.prompt('Motivo del rechazo (lo verá el estudiante):') ?? null; if (n !== null) hacer(() => decidirPermiso(b.id, e.user_id, 'rechazado', n)); }}>Rechazar</button>}
                        {e.permiso === 'aprobado' && <button className="btn-secundario !px-2 !py-0.5" disabled={accion.busy} onClick={() => window.confirm('¿Retirar la autorización? Ya no podrá subir más archivos.') && hacer(() => decidirPermiso(b.id, e.user_id, 'revocado', null))}>Retirar</button>}
                      </span>
                    </td>
                  )}
                  <td>
                    {e.archivos.length ? e.archivos.map((a) => (
                      <div key={a.id} className="mb-1.5 text-xs">
                        <button className="enlace text-sm" onClick={() => void accion.run(() => abrirPdf(a.id))}>📄 {a.nombre}</button> · {tamano(a.bytes)} · {fecha(a.subido)} <Badge tone={ESTADO[a.estado][1]}>{ESTADO[a.estado][0]}</Badge>
                        {a.nota && <span className="block italic">«{a.nota}»</span>}
                        <span className="mt-0.5 flex flex-wrap items-center gap-1">
                          <input className="campo !w-48 !py-0.5 text-xs" placeholder="Nota para el estudiante" value={nota[a.id] ?? ''} onChange={(x) => setNota({ ...nota, [a.id]: x.target.value })} />
                          <button className="btn-secundario !px-2 !py-0.5" disabled={accion.busy} onClick={() => hacer(() => revisarArchivo(a.id, 'aceptado', nota[a.id] ?? null))}>Aceptar</button>
                          <button className="btn-secundario !px-2 !py-0.5" disabled={accion.busy} onClick={() => hacer(() => revisarArchivo(a.id, 'rechazado', nota[a.id] ?? null))}>Rechazar</button>
                        </span>
                      </div>
                    )) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">Un archivo rechazado no cuenta para el máximo: el estudiante puede subir otro. Nada se borra; queda el historial de lo entregado. Los PDF se guardan en un almacenamiento privado y se abren con un enlace que caduca en 2 minutos.</p>
    </div>
  );
}

export function TabEntregas({ classId }: { classId: string }) {
  const st = useAsync(() => buzonesDeSeccion(classId), [classId]);
  const [editar, setEditar] = useState<Buzon | 'nuevo' | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const accion = useAction();
  if (st.loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <ErrorBox error={st.error || accion.error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-300">Buzones para que los estudiantes suban en PDF sus prácticas o exámenes escritos, con su autorización.</p>
        <button className="btn-primario" onClick={() => setEditar('nuevo')}>+ Nuevo buzón</button>
      </div>
      {!(st.data ?? []).length ? <Empty>Aún no hay buzones en esta sección.</Empty> : st.data!.map((b) => (
        <Card key={b.id}
          title={<>{b.title} <Badge tone={b.kind === 'examen' ? 'purple' : 'blue'}>{TIPO_BUZON[b.kind]}</Badge> {b.archived && <Badge>cerrado</Badge>} {b.solicitudes_pendientes > 0 && <Badge tone="amber">{b.solicitudes_pendientes} solicitud(es)</Badge>} {b.sin_revisar > 0 && <Badge tone="blue">{b.sin_revisar} sin revisar</Badge>}</>}
          actions={<div className="flex gap-1">
            <button className="btn-secundario !py-1 text-xs" onClick={() => setAbierto(abierto === b.id ? null : b.id)}>{abierto === b.id ? 'Ocultar' : 'Ver estudiantes'}</button>
            <button className="btn-secundario !py-1 text-xs" onClick={() => setEditar(b)}>Editar</button>
            <button className="btn-secundario !py-1 text-xs" onClick={() => void accion.run(() => archivarBuzon(b.id, !b.archived)).then(() => st.reload())}>{b.archived ? 'Reabrir' : 'Cerrar'}</button>
          </div>}>
          <p className="text-xs text-gray-500">
            {b.opens_at ? `Abre ${fecha(b.opens_at)} · ` : ''}{b.closes_at ? `cierra ${fecha(b.closes_at)}` : 'sin fecha de cierre'} · {b.max_files} archivo(s) de {b.max_mb} MB · {b.requires_approval ? `exige autorización (${b.autorizados} autorizados)` : 'sin autorización previa'} · entregaron {b.con_entrega}/{b.estudiantes} · {b.archivos} archivo(s)
          </p>
          {abierto === b.id && <div className="mt-3"><DetalleBuzon b={b} onCambio={() => void st.reload()} /></div>}
        </Card>
      ))}
      <Modal open={editar !== null} onClose={() => setEditar(null)} title={editar === 'nuevo' ? 'Nuevo buzón de entrega' : 'Editar buzón'}>
        {editar !== null && <FormBuzon classId={classId} b={editar === 'nuevo' ? null : editar} onListo={() => { setEditar(null); void st.reload(); }} />}
      </Modal>
    </div>
  );
}
