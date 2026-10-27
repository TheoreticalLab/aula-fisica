/** Asistencia: el estudiante escribe el código que dicta el profesor y queda presente. */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { marcarPresente, miAsistencia } from '@/api/asistencia';
import { useAction, useAsync } from '@/lib/util';
import { Card, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function Asistencia() {
  const [codigo, setCodigo] = useState('');
  const [ok, setOk] = useState<string | null>(null);
  const accion = useAction();
  const hist = useAsync(miAsistencia, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    await accion.run(async () => {
      const r = await marcarPresente(codigo);
      if (!r.ok) throw new Error(r.error ?? 'Código incorrecto o vencido');
      setOk(`${r.nuevo ? '✓ Quedó presente' : 'Ya estaba presente'} en ${r.clases?.join(', ')}.`);
      setCodigo('');
      void hist.reload();
    });
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Asistencia" subtitle="Escriba el código que el profesor da en clase." />
      <Card>
        <form onSubmit={(e) => void enviar(e)} className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-sm">Código de asistencia</span>
            <input className="campo !w-48 text-center font-mono text-2xl tracking-[0.3em]" inputMode="numeric" autoComplete="off" maxLength={7} placeholder="000000"
              value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ''))} />
          </label>
          <button className="btn-primario" disabled={codigo.replace(/\D/g, '').length !== 6 || accion.busy}>Marcar presente</button>
        </form>
        <div className="mt-3">
          {ok && <Notice tone="ok">{ok}</Notice>}
          <ErrorBox error={accion.error} />
        </div>
      </Card>
      <Card title="Mi asistencia">
        {hist.loading ? <Spinner /> : !(hist.data ?? []).length ? <p className="text-sm text-gray-500">Sin secciones.</p> : hist.data!.map((c) => (
          <div key={c.class_id} className="mb-3">
            <p className="text-sm font-medium">{c.asignatura} · {c.clase} — {c.presentes}/{c.sesiones} clases</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {c.ultimas.map((u, i) => (
                <span key={i} title={u.presente && u.hora ? `Presente a las ${hora(u.hora)}` : 'Ausente'}
                  className={`rounded px-1.5 py-0.5 text-xs ${u.presente ? 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200' : 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200'}`}>
                  {fecha(u.fecha)} {u.presente ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <p className="text-sm"><Link className="enlace" to="/entregas">Entregas en PDF →</Link></p>
    </div>
  );
}
