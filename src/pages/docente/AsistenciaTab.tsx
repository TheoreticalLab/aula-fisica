/** Pestaña «Asistencia» de una sección: abrir con código, lista en vivo, correcciones e historial. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { abrirAsistencia, asistenciaEnVivo, cerrarAsistencia, informeAsistencia, marcarManual, nuevoCodigo, type AsistenciaEnVivo } from '@/api/asistencia';
import { aCsv } from '@/lib/tiempo';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Spinner } from '@/components/ui';

const fecha = (iso: string) => new Date(iso).toLocaleString('es-DO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export function EnVivo({ id, onCerrada }: { id: string; onCerrada: () => void }) {
  const [d, setD] = useState<AsistenciaEnVivo | null>(null);
  const [desfase, setDesfase] = useState(0);
  const [, setTick] = useState(0);
  const accion = useAction();
  async function cargar() {
    const r = await asistenciaEnVivo(id);
    setDesfase(new Date(r.server_now).getTime() - Date.now());
    setD(r);
  }
  useEffect(() => {
    void accion.run(cargar);
    const t = window.setInterval(() => void cargar().catch(() => undefined), 4000);
    const s = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => { window.clearInterval(t); window.clearInterval(s); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!d) return accion.error ? <ErrorBox error={accion.error} /> : <Spinner />;
  const restante = Math.max(0, Math.round((new Date(d.code_expires_at).getTime() - (Date.now() + desfase)) / 1000));
  const abierta = !d.closed_at && restante > 0;
  const presentes = d.estudiantes.filter((e) => e.presente);
  return (
    <div className="space-y-3">
      <ErrorBox error={accion.error} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-xl border border-gray-200 px-6 py-3 text-center dark:border-white/10">
          <p className="text-xs text-gray-500">Código</p>
          <p className={`font-mono text-5xl font-bold tracking-[0.2em] ${abierta ? '' : 'text-gray-400 line-through'}`}>{d.code}</p>
          <p className="text-xs text-gray-500">{d.closed_at ? 'asistencia cerrada' : abierta ? `vence en ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}` : 'código vencido'}</p>
        </div>
        <div>
          <p className="font-serif text-3xl font-semibold">{presentes.length}<span className="text-lg text-gray-500">/{d.estudiantes.length}</span></p>
          <p className="text-sm text-gray-500">presentes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secundario" disabled={accion.busy} onClick={() => void accion.run(async () => { await nuevoCodigo(id, 10); await cargar(); })}>Nuevo código (10 min)</button>
          {!d.closed_at && <button className="btn-secundario" disabled={accion.busy} onClick={() => void accion.run(async () => { await cerrarAsistencia(id); await cargar(); onCerrada(); })}>Cerrar asistencia</button>}
        </div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {d.estudiantes.map((e) => (
          <div key={e.user_id} className={`flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm ${e.presente ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-gray-200 dark:border-white/10'}`}>
            <span><Link className="enlace" to={`/docente/estudiantes/${e.user_id}`}>{e.full_name || e.student_code || '—'}</Link>
              <span className="block text-xs text-gray-500">{e.presente ? `${e.method === 'profesor' ? 'marcado por usted' : 'con código'} · ${hora(e.marked_at!)}` : 'ausente'}</span></span>
            <button className="btn-secundario !px-2 !py-0.5 text-xs" disabled={accion.busy} onClick={() => void accion.run(async () => { await marcarManual(id, e.user_id, !e.presente); await cargar(); })}>{e.presente ? 'Quitar' : 'Marcar'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TabAsistencia({ classId, nombre }: { classId: string; nombre: string }) {
  const inf = useAsync(() => informeAsistencia(classId), [classId]);
  const [activa, setActiva] = useState<string | null>(null);
  const [minutos, setMinutos] = useState(10);
  const accion = useAction();
  const abierta = inf.data?.sesiones.find((s) => !s.closed_at);
  useEffect(() => { if (abierta && !activa) setActiva(abierta.id); }, [abierta, activa]);

  function exportar() {
    const ses = [...(inf.data?.sesiones ?? [])].reverse();
    const filas = (inf.data?.estudiantes ?? []).map((e) => [e.full_name, e.student_code, ...ses.map((s) => (e.sesiones ?? []).includes(s.id) ? 'P' : 'A'), e.presentes, ses.length]);
    const url = URL.createObjectURL(new Blob([aCsv([['Estudiante', 'Matrícula', ...ses.map((s) => fecha(s.opened_at)), 'Presentes', 'Clases'], ...filas])], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia-${nombre.replace(/\W+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <ErrorBox error={inf.error || accion.error} />
      <Card title="Pasar lista con código">
        {activa ? <EnVivo id={activa} onCerrada={() => void inf.reload()} /> : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">El código vale
              <select className="campo !w-auto" value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
                {[5, 10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
              </select>
            </label>
            <button className="btn-primario" disabled={accion.busy} onClick={() => void accion.run(async () => { const r = await abrirAsistencia(classId, minutos); setActiva(r.id); await inf.reload(); })}>Abrir asistencia</button>
            <p className="w-full text-xs text-gray-500">Dicte el código en clase; los estudiantes lo escriben en «Asistencia». También puede hacerlo desde Orbe Control.</p>
          </div>
        )}
        {activa && <button className="btn-secundario mt-3 text-xs" onClick={() => { setActiva(null); void inf.reload(); }}>Volver al historial</button>}
      </Card>
      <Card title={`Historial · ${inf.data?.sesiones.length ?? 0} clases`} actions={<button className="btn-secundario !py-1 text-xs" onClick={exportar} disabled={!inf.data?.sesiones.length}>Exportar CSV</button>}>
        {inf.loading ? <Spinner /> : !inf.data?.sesiones.length ? <p className="text-sm text-gray-500">Aún no se ha pasado lista.</p> : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1 pr-3">Estudiante</th><th className="pr-3 text-right">Total</th>
                {inf.data.sesiones.map((s) => <th key={s.id} className="px-1 text-center font-normal"><button className="enlace" onClick={() => setActiva(s.id)} title="Abrir y corregir">{new Date(s.opened_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}</button></th>)}
              </tr></thead>
              <tbody>
                {inf.data.estudiantes.map((e) => (
                  <tr key={e.user_id} className="border-b border-gray-100 dark:border-white/5">
                    <td className="py-1 pr-3"><Link className="enlace" to={`/docente/estudiantes/${e.user_id}`}>{e.full_name || e.student_code}</Link></td>
                    <td className="pr-3 text-right tabular-nums">{e.presentes}/{inf.data!.sesiones.length}</td>
                    {inf.data!.sesiones.map((s) => <td key={s.id} className="px-1 text-center">{(e.sesiones ?? []).includes(s.id) ? <Badge tone="green">P</Badge> : <span className="text-red-500">A</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
