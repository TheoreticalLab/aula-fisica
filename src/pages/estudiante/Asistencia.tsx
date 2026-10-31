/**
 * Asistencia: solo se puede marcar cuando el profesor abrió la asistencia de una sección del estudiante.
 * Se escribe el código que el profesor muestra (cambia cada pocos segundos) y el navegador comparte la ubicación
 * para comprobar que se está en el aula.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { marcarPresente, misAsistenciasAbiertas, miAsistencia, type AsistenciaAbiertaMia } from '@/api/asistencia';
import { ubicacionActual } from '@/lib/ubicacion';
import { useAction, useAsync } from '@/lib/util';
import { Card, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { AsistenciaQuorum } from '@/components/AsistenciaQuorum';

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function Asistencia() {
  const [codigo, setCodigo] = useState('');
  const [ok, setOk] = useState<string | null>(null);
  const [paso, setPaso] = useState<string | null>(null);
  const [abiertas, setAbiertas] = useState<AsistenciaAbiertaMia[] | null>(null);
  const accion = useAction();
  const hist = useAsync(miAsistencia, []);

  useEffect(() => {
    const cargar = () => void misAsistenciasAbiertas().then(setAbiertas).catch(() => setAbiertas([]));
    cargar();
    const t = window.setInterval(cargar, 15_000);
    return () => window.clearInterval(t);
  }, []);
  const [deQuorum, setDeQuorum] = useState<Set<string>>(new Set());
  const conCodigo = (abiertas ?? []).filter((a) => !deQuorum.has(a.session_id));
  const pendientes = conCodigo.filter((a) => !a.presente);
  const yaPresente = conCodigo.filter((a) => a.presente);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    await accion.run(async () => {
      setPaso('Obteniendo su ubicación…');
      const { ubicacion, motivo } = await ubicacionActual();
      setPaso('Comprobando el código…');
      const r = await marcarPresente(codigo, ubicacion);
      setPaso(null);
      if (!r.ok) throw new Error(r.error ?? 'Código incorrecto o vencido');
      setOk(`${r.nuevo ? '✓ Quedó presente' : 'Ya estaba presente'} en ${r.clases?.join(', ')}.${!ubicacion && motivo ? ' (Sin ubicación: el profesor lo verá marcado.)' : ''}`);
      setCodigo('');
      void misAsistenciasAbiertas().then(setAbiertas);
      void hist.reload();
    }).finally(() => setPaso(null));
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Asistencia" subtitle="Marque su asistencia con el código que muestra el profesor en clase." />
      <AsistenciaQuorum onSesionesQuorum={setDeQuorum} onCambio={() => { void misAsistenciasAbiertas().then(setAbiertas); void hist.reload(); }} />
      <Card>
        {abiertas === null ? <Spinner /> : pendientes.length === 0 ? (
          <div className="text-center">
            <p className="text-4xl" aria-hidden>📋</p>
            {yaPresente.length ? (
              <Notice tone="ok">✓ Ya está presente en {yaPresente.map((a) => `${a.asignatura} · ${a.clase}`).join(', ')}.</Notice>
            ) : (
              <>
                <p className="font-serif text-lg font-semibold">No hay asistencia abierta ahora</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Cuando el profesor abra la asistencia en clase, aquí podrá escribir el código. Esta página se actualiza sola.</p>
              </>
            )}
            {ok && <div className="mt-3"><Notice tone="ok">{ok}</Notice></div>}
          </div>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium">Asistencia abierta: {pendientes.map((a) => `${a.asignatura} · ${a.clase}`).join(', ')}</p>
            <form onSubmit={(e) => void enviar(e)} className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-sm">Código que ve ahora en la pantalla del profesor</span>
                <input className="campo !w-52 text-center font-mono text-3xl tracking-[0.3em]" inputMode="numeric" autoComplete="off" autoFocus maxLength={7} placeholder="000000"
                  value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ''))} />
              </label>
              <button className="btn-primario" disabled={codigo.replace(/\D/g, '').length !== 6 || accion.busy}>{paso ?? 'Marcar presente'}</button>
            </form>
            <p className="mt-2 text-xs text-gray-500">📍 Al marcar, el navegador le pedirá permiso para usar su ubicación: sirve para comprobar que está en el aula. Solo se usa en este momento; no se sigue su ubicación. El código cambia cada pocos segundos: escriba el que se ve ahora.</p>
            <div className="mt-3">
              {ok && <Notice tone="ok">{ok}</Notice>}
              <ErrorBox error={accion.error} />
            </div>
          </>
        )}
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
