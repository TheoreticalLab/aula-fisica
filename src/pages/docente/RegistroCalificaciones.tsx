/**
 * Registro de Calificaciones de una sección (profesor). La autorización y los límites están en la base de datos;
 * aquí solo se edita y se muestra. Celda vacía = pendiente (no es cero).
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getClass } from '@/api/docente';
import { rpc } from '@/lib/supabase';
import { Card, ErrorBox, Modal, Notice, PageTitle, Spinner } from '@/components/ui';
import { useAction, useAsync } from '@/lib/util';
import { CATEGORIAS, leerCelda, type Categoria } from '@/lib/notas';
import { aCsv } from '@/lib/tiempo';

interface Fila { user_id: string; full_name: string; student_code: string | null; parcial1: number | null; parcial2: number | null; parcial3: number | null; practica: number | null; final: number | null; extras: number; extras_pendientes: number; bruto: number; nota_final: number; pendientes: number; es_monitor: boolean }
interface Ajustes { published: boolean; extra_max_per_student: number; extra_max_per_operation: number; extra_from: string | null; extra_to: string | null; extra_requires_approval: boolean }
interface Extra { id: string; user_id: string; alumno: string; asignado_por: string; assigner_role: string; points: number; reason: string; status: string; created_at: string; review_note: string | null }
interface Hist { cuando: string; tipo: string; categoria: string | null; antes: number | null; despues: number | null; puntos: number | null; motivo: string | null; estado: string | null; autor: string }

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const fecha = (iso: string) => new Date(iso).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });
const ETIQUETA: Record<string, string> = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.label]));

function Celda({ valor, max, onGuardar }: { valor: number | null; max: number; onGuardar: (v: number | null) => Promise<boolean> }) {
  const [texto, setTexto] = useState(valor === null ? '' : String(valor));
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<'' | 'guardando' | 'ok'>('');
  async function guardar() {
    const r = leerCelda(texto, max);
    if (!r.ok) return setError(r.error);
    setError(null);
    if (r.valor === valor) return;
    setEstado('guardando');
    setEstado((await onGuardar(r.valor)) ? 'ok' : '');
  }
  return (
    <input
      aria-label={`Nota (máximo ${max})`}
      title={error ?? (texto === '' ? 'Pendiente' : '')}
      inputMode="decimal"
      className={`w-14 rounded border px-1 py-0.5 text-right text-sm tabular-nums dark:bg-transparent ${error ? 'border-red-500' : estado === 'ok' ? 'border-green-500' : 'border-gray-300 dark:border-white/20'}`}
      value={texto}
      placeholder="—"
      onChange={(e) => { setTexto(e.target.value); setEstado(''); }}
      onBlur={() => void guardar()}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export default function RegistroCalificaciones() {
  const { classId = '' } = useParams();
  const cls = useAsync(() => getClass(classId), [classId]);
  const filas = useAsync(async () => (await rpc<Fila[]>('gradebook_official', { p_class: classId })).map((f) => ({
    ...f, ...Object.fromEntries(CATEGORIAS.map((c) => [c.id, n(f[c.id])])), extras: Number(f.extras), extras_pendientes: Number(f.extras_pendientes), bruto: Number(f.bruto), nota_final: Number(f.nota_final),
  })) as Fila[], [classId]);
  const ajustes = useAsync(() => rpc<Ajustes>('official_grade_settings', { p_class: classId }), [classId]);
  const extras = useAsync(() => rpc<Extra[]>('class_extra_points', { p_class: classId }), [classId]);
  const [historial, setHistorial] = useState<{ nombre: string; filas: Hist[] } | null>(null);
  const [extraPara, setExtraPara] = useState<Fila | null>(null);
  const [extraForm, setExtraForm] = useState({ puntos: '1', motivo: '' });
  const accion = useAction();

  async function guardarNota(f: Fila, cat: Categoria, v: number | null) {
    const ok = await accion.run(() => rpc('set_official_grade', { p_class: classId, p_user: f.user_id, p_category: cat, p_score: v }));
    if (ok !== undefined) void filas.reload();
    return ok !== undefined;
  }
  async function guardarAjustes(patch: Partial<Ajustes>) {
    const a = { ...ajustes.data!, ...patch };
    const r = await accion.run(() => rpc<Ajustes>('set_official_grade_settings', {
      p_class: classId, p_published: a.published, p_max_student: Number(a.extra_max_per_student), p_max_operation: Number(a.extra_max_per_operation),
      p_from: a.extra_from || null, p_to: a.extra_to || null, p_requires_approval: a.extra_requires_approval,
    }));
    if (r) ajustes.setData(r);
  }
  async function monitor(f: Fila) {
    await accion.run(() => rpc('set_class_monitor', { p_class: classId, p_user: f.user_id, p_active: !f.es_monitor }));
    void filas.reload();
  }
  async function revisar(e: Extra, status: 'aprobado' | 'rechazado' | 'revertido') {
    const nota = status === 'revertido' ? window.prompt('Motivo de la reversión (queda en el historial):') ?? '' : '';
    await accion.run(() => rpc('review_extra_points', { p_id: e.id, p_status: status, p_note: nota }));
    void extras.reload();
    void filas.reload();
  }
  async function verHistorial(f: Fila) {
    const r = await accion.run(() => rpc<Hist[]>('official_grade_history', { p_class: classId, p_user: f.user_id }));
    if (r) setHistorial({ nombre: f.full_name, filas: r });
  }
  async function asignarExtra() {
    if (!extraPara) return;
    const r = await accion.run(() => rpc('add_extra_points', {
      p_request: crypto.randomUUID(), p_class: classId, p_user: extraPara.user_id, p_points: Number(extraForm.puntos.replace(',', '.')), p_reason: extraForm.motivo,
    }));
    if (r) { setExtraPara(null); setExtraForm({ puntos: '1', motivo: '' }); void extras.reload(); void filas.reload(); }
  }
  function exportar() {
    const enc = ['Estudiante', 'Matrícula', ...CATEGORIAS.map((c) => `${c.label} (${c.max})`), 'Extras aprobados', 'Total bruto', 'Nota final (máx. 100)', 'Categorías pendientes'];
    const datos = (filas.data ?? []).map((f) => [f.full_name, f.student_code, ...CATEGORIAS.map((c) => f[c.id] ?? 'Pendiente'), f.extras, f.bruto, f.nota_final, f.pendientes]);
    const url = URL.createObjectURL(new Blob([aCsv([enc, ...datos])], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `registro-${(cls.data?.name ?? 'seccion').replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (cls.loading || filas.loading && !filas.data) return <Spinner />;
  const a = ajustes.data;
  const pendientesExtra = (extras.data ?? []).filter((e) => e.status === 'pendiente');
  return (
    <div className="space-y-4">
      <PageTitle title="Registro de Calificaciones" subtitle={cls.data?.name} back={{ to: `/docente/clases/${classId}`, label: cls.data?.name ?? 'Sección' }}
        actions={<button className="btn-secundario" onClick={exportar}>⬇ Exportar a Excel (CSV)</button>} />
      <ErrorBox error={cls.error || filas.error || accion.error} />
      {a && (
        <Card title="Publicación y puntos extras">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={a.published} onChange={(e) => void guardarAjustes({ published: e.target.checked })} />
              <span><strong>Notas publicadas</strong> (los estudiantes ven sus notas)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={a.extra_requires_approval} onChange={(e) => void guardarAjustes({ extra_requires_approval: e.target.checked })} />
              Los extras del monitor requieren mi aprobación</label>
            <label>Máximo de extras por estudiante <input className="campo mt-1" type="number" step="0.5" min="0" max="100" defaultValue={a.extra_max_per_student} onBlur={(e) => void guardarAjustes({ extra_max_per_student: Number(e.target.value) })} /></label>
            <label>Máximo por operación <input className="campo mt-1" type="number" step="0.5" min="0.5" max="100" defaultValue={a.extra_max_per_operation} onBlur={(e) => void guardarAjustes({ extra_max_per_operation: Number(e.target.value) })} /></label>
            <label>Asignaciones desde <input className="campo mt-1" type="date" defaultValue={a.extra_from ?? ''} onBlur={(e) => void guardarAjustes({ extra_from: e.target.value || null })} /></label>
            <label>Asignaciones hasta <input className="campo mt-1" type="date" defaultValue={a.extra_to ?? ''} onBlur={(e) => void guardarAjustes({ extra_to: e.target.value || null })} /></label>
          </div>
        </Card>
      )}

      <Card title={`Estudiantes (${filas.data?.length ?? 0})`}>
        <p className="mb-2 text-xs text-gray-500">Escriba la nota y pulse Enter o salga de la celda para guardarla. Vacío = pendiente; 0 es una nota. Cada cambio queda en el historial.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs dark:border-white/10">
              <th className="px-1 py-1">Estudiante</th>
              {CATEGORIAS.map((c) => <th key={c.id} className="px-1 py-1 text-right">{c.label}<br /><span className="text-gray-500">/{c.max}</span></th>)}
              <th className="px-1 py-1 text-right">Extras</th><th className="px-1 py-1 text-right">Bruto</th><th className="px-1 py-1 text-right">Final</th><th className="px-1 py-1" />
            </tr></thead>
            <tbody>
              {(filas.data ?? []).map((f) => (
                <tr key={f.user_id} className="border-b border-gray-100 dark:border-white/5">
                  <td className="px-1 py-1">{f.full_name || '—'} {f.es_monitor && <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">monitor</span>}
                    <span className="block text-xs text-gray-500">{f.student_code}</span></td>
                  {CATEGORIAS.map((c) => (
                    <td key={c.id} className="px-1 py-1 text-right"><Celda valor={f[c.id]} max={c.max} onGuardar={(v) => guardarNota(f, c.id, v)} /></td>
                  ))}
                  <td className="px-1 py-1 text-right tabular-nums">{f.extras}{f.extras_pendientes > 0 && <span className="block text-xs text-amber-700">+{f.extras_pendientes} pend.</span>}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{f.bruto}</td>
                  <td className="px-1 py-1 text-right font-semibold tabular-nums">{f.nota_final}{f.pendientes > 0 && <span className="block text-xs font-normal text-gray-500">{f.pendientes} pend.</span>}</td>
                  <td className="whitespace-nowrap px-1 py-1 text-right text-xs">
                    <button className="enlace mr-2" onClick={() => setExtraPara(f)}>+ extra</button>
                    <button className="enlace mr-2" onClick={() => void verHistorial(f)}>historial</button>
                    <button className="enlace" onClick={() => void monitor(f)}>{f.es_monitor ? 'revocar monitor' : 'nombrar monitor'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Puntos extras${pendientesExtra.length ? ` · ${pendientesExtra.length} por aprobar` : ''}`}>
        {(extras.data ?? []).length ? (
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            {(extras.data ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <strong>+{e.points}</strong> a {e.alumno} · {e.reason}
                  <span className="block text-xs text-gray-500">{fecha(e.created_at)} · por {e.asignado_por} ({e.assigner_role}) · <span className="capitalize">{e.status}</span>{e.review_note ? ` · ${e.review_note}` : ''}</span>
                </div>
                <div className="flex gap-1 text-xs">
                  {e.status === 'pendiente' && <><button className="btn-primario !px-2 !py-0.5" onClick={() => void revisar(e, 'aprobado')}>Aprobar</button>
                    <button className="btn-secundario !px-2 !py-0.5" onClick={() => void revisar(e, 'rechazado')}>Rechazar</button></>}
                  {e.status === 'aprobado' && <button className="btn-secundario !px-2 !py-0.5" onClick={() => void revisar(e, 'revertido')}>Revertir</button>}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">Sin asignaciones.</p>}
      </Card>

      <Modal open={!!extraPara} onClose={() => setExtraPara(null)} title={`Puntos extras para ${extraPara?.full_name ?? ''}`}>
        <label className="mb-2 block text-sm">Cantidad <input className="campo mt-1" inputMode="decimal" value={extraForm.puntos} onChange={(e) => setExtraForm({ ...extraForm, puntos: e.target.value })} /></label>
        <label className="mb-3 block text-sm">Motivo <input className="campo mt-1" maxLength={300} value={extraForm.motivo} onChange={(e) => setExtraForm({ ...extraForm, motivo: e.target.value })} /></label>
        <ErrorBox error={accion.error} />
        <button className="btn-primario" disabled={accion.busy || extraForm.motivo.trim().length < 3} onClick={() => void asignarExtra()}>Asignar</button>
      </Modal>
      <Modal open={!!historial} onClose={() => setHistorial(null)} title={`Historial de ${historial?.nombre ?? ''}`}>
        {historial?.filas.length ? (
          <ul className="space-y-1 text-sm">
            {historial.filas.map((h, i) => (
              <li key={i} className="border-b border-gray-100 pb-1 dark:border-white/10">
                <span className="text-xs text-gray-500">{fecha(h.cuando)} · {h.autor}</span><br />
                {h.tipo === 'nota'
                  ? <>{ETIQUETA[h.categoria ?? ''] ?? h.categoria}: {h.antes ?? 'pendiente'} → <strong>{h.despues ?? 'pendiente'}</strong></>
                  : <>Extra +{h.puntos} ({h.tipo.replace('extra:', '')}) · {h.motivo} · <span className="capitalize">{h.estado}</span></>}
              </li>
            ))}
          </ul>
        ) : <Notice>Sin cambios registrados.</Notice>}
      </Modal>
    </div>
  );
}
