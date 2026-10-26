/**
 * Secretaría del curso (monitor). Solo asigna puntos extras a compañeros de su sección, con motivo.
 * No ve ni modifica notas: lo impiden las funciones de la base de datos, no esta pantalla.
 */
import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { Card, Empty, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { useAction, useAsync } from '@/lib/util';

interface Clase { class_id: string; class_name: string; course_title: string }
interface Comp { user_id: string; full_name: string; student_code: string | null }
interface Asig { id: string; alumno: string; points: number; reason: string; status: string; created_at: string; review_note: string | null }
interface Ajustes { extra_max_per_student: number; extra_max_per_operation: number; extra_from: string | null; extra_to: string | null; extra_requires_approval: boolean }

export default function Secretaria() {
  const clases = useAsync(() => rpc<Clase[]>('my_monitor_classes'), []);
  const [clase, setClase] = useState('');
  useEffect(() => {
    if (!clase && clases.data?.length) setClase(clases.data[0].class_id);
  }, [clases.data, clase]);
  const comp = useAsync(() => (clase ? rpc<Comp[]>('monitor_classmates', { p_class: clase }) : Promise.resolve([])), [clase]);
  const ajustes = useAsync(() => (clase ? rpc<Ajustes>('official_grade_settings', { p_class: clase }) : Promise.resolve(null)), [clase]);
  const hist = useAsync(() => (clase ? rpc<Asig[]>('my_extra_assignments', { p_class: clase }) : Promise.resolve([])), [clase]);
  const [alumno, setAlumno] = useState('');
  const [puntos, setPuntos] = useState('1');
  const [motivo, setMotivo] = useState('');
  const [ok, setOk] = useState<string | null>(null);
  const [solicitud, setSolicitud] = useState(() => crypto.randomUUID()); // evita duplicar si se pulsa dos veces
  const accion = useAction();

  async function guardar() {
    setOk(null);
    const r = await accion.run(() => rpc<{ status: string }>('add_extra_points', {
      p_request: solicitud, p_class: clase, p_user: alumno, p_points: Number(puntos.replace(',', '.')), p_reason: motivo,
    }));
    if (r) {
      setOk(r.status === 'pendiente' ? 'Asignación guardada. Queda pendiente de aprobación del profesor.' : 'Asignación guardada.');
      setMotivo('');
      setSolicitud(crypto.randomUUID());
      void hist.reload();
    }
  }

  if (clases.loading) return <Spinner />;
  if (!clases.data?.length) return <div className="mx-auto max-w-2xl"><PageTitle title="Secretaría del curso" /><Empty>No tiene el cargo de monitor en ninguna sección.</Empty></div>;
  const a = ajustes.data;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle title="Secretaría del curso" subtitle="Asignación de puntos extras a compañeros de su sección." />
      {clases.data.length > 1 && (
        <select className="campo" value={clase} onChange={(e) => setClase(e.target.value)}>
          {clases.data.map((c) => <option key={c.class_id} value={c.class_id}>{c.class_name} · {c.course_title}</option>)}
        </select>
      )}
      <Card title="Nueva asignación">
        {a && <p className="mb-3 text-xs text-gray-500">
          Máximo {a.extra_max_per_operation} puntos por asignación y {a.extra_max_per_student} por estudiante
          {a.extra_from || a.extra_to ? ` · habilitado ${a.extra_from ? `desde ${a.extra_from}` : ''} ${a.extra_to ? `hasta ${a.extra_to}` : ''}` : ''}
          {a.extra_requires_approval ? ' · requieren aprobación del profesor' : ''}.
        </p>}
        <label className="mb-2 block text-sm">Estudiante
          <select className="campo mt-1" value={alumno} onChange={(e) => setAlumno(e.target.value)}>
            <option value="">Elija un compañero</option>
            {(comp.data ?? []).map((c) => <option key={c.user_id} value={c.user_id}>{c.full_name}{c.student_code ? ` (${c.student_code})` : ''}</option>)}
          </select>
        </label>
        <label className="mb-2 block text-sm">Puntos <input className="campo mt-1" inputMode="decimal" value={puntos} onChange={(e) => setPuntos(e.target.value)} /></label>
        <label className="mb-3 block text-sm">Motivo <input className="campo mt-1" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: participación en la clase del martes" /></label>
        <ErrorBox error={accion.error || comp.error} />
        {ok && <Notice tone="ok">{ok}</Notice>}
        <button className="btn-primario" disabled={accion.busy || !alumno || motivo.trim().length < 3} onClick={() => void guardar()}>Guardar asignación</button>
      </Card>
      <Card title="Mis asignaciones">
        {(hist.data ?? []).length ? (
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            {(hist.data ?? []).map((h) => (
              <li key={h.id} className="py-2"><strong>+{h.points}</strong> a {h.alumno} · {h.reason}
                <span className="block text-xs text-gray-500">{new Date(h.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })} · <span className="capitalize">{h.status}</span>{h.review_note ? ` · ${h.review_note}` : ''}</span></li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">Todavía no ha asignado puntos.</p>}
      </Card>
    </div>
  );
}
