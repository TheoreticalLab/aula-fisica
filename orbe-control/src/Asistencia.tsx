/**
 * Orbe Control · Asistencia: abrir la asistencia de una sección, mostrar el código para dictarlo en clase y ver en
 * vivo quién está presente. Todo lo decide el servidor (attendance_*: solo el profesorado de la sección).
 */
import { useCallback, useEffect, useState } from 'react';
import { rpc } from './supabase';

interface Seccion { class_id: string; class_name: string; course_title: string }
interface EnVivo {
  id: string; clase: string; asignatura: string; code: string; code_expires_at: string; closed_at: string | null; server_now: string;
  estudiantes: { user_id: string; full_name: string; student_code: string | null; presente: boolean; marked_at: string | null; method: string | null }[];
}
interface Abierta { id: string; class_id: string; clase: string; code_expires_at: string; presentes: number }

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });

export function Asistencia() {
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [abiertas, setAbiertas] = useState<Abierta[]>([]);
  const [clase, setClase] = useState('');
  const [minutos, setMinutos] = useState(10);
  const [activa, setActiva] = useState<string | null>(null);
  const [d, setD] = useState<EnVivo | null>(null);
  const [desfase, setDesfase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setTic] = useState(0);

  const cargarInicio = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([rpc<Seccion[]>('my_messageable_students'), rpc<Abierta[]>('attendance_open_sessions')]);
      const m = new Map<string, Seccion>();
      for (const x of s) m.set(x.class_id, { class_id: x.class_id, class_name: x.class_name, course_title: x.course_title });
      setSecciones([...m.values()].sort((x, y) => `${x.course_title} ${x.class_name}`.localeCompare(`${y.course_title} ${y.class_name}`, 'es')));
      setAbiertas(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { void cargarInicio(); }, [cargarInicio]);

  const cargar = useCallback(async (id: string) => {
    const r = await rpc<EnVivo>('attendance_live', { p_session: id });
    setDesfase(new Date(r.server_now).getTime() - Date.now());
    setD(r);
  }, []);
  useEffect(() => {
    if (!activa) return;
    void cargar(activa).catch((e) => setError(e.message));
    const t = window.setInterval(() => void cargar(activa).catch(() => undefined), 3000);
    const s = window.setInterval(() => setTic((x) => x + 1), 1000);
    return () => { window.clearInterval(t); window.clearInterval(s); };
  }, [activa, cargar]);

  async function hacer(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (activa && d) {
    const restante = Math.max(0, Math.round((new Date(d.code_expires_at).getTime() - (Date.now() + desfase)) / 1000));
    const vigente = !d.closed_at && restante > 0;
    const presentes = d.estudiantes.filter((e) => e.presente).sort((a, b) => (b.marked_at ?? '').localeCompare(a.marked_at ?? ''));
    const ausentes = d.estudiantes.filter((e) => !e.presente);
    return (
      <div className="asistencia">
        <button className="enlace" onClick={() => { setActiva(null); setD(null); void cargarInicio(); }}>← Secciones</button>
        <h2>{d.asignatura.toUpperCase()} · {d.clase.toUpperCase()}</h2>
        <section className="tarjeta resumen">
          <p className="tenue">CÓDIGO DE ASISTENCIA</p>
          <p className={`codigo ${vigente ? '' : 'vencido'}`}>{d.code.slice(0, 3)} {d.code.slice(3)}</p>
          <p className="tenue">{d.closed_at ? 'Asistencia cerrada' : vigente ? `Vence en ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}` : 'Código vencido: genere uno nuevo'}</p>
          <p className="cifra">{presentes.length}<span className="tenue"> / {d.estudiantes.length}</span></p>
          <p className="tenue">PRESENTES</p>
          <div className="fila">
            <button className="boton secundario" disabled={busy} onClick={() => void hacer(async () => { await rpc('attendance_new_code', { p_session: d.id, p_minutes: minutos }); await cargar(d.id); })}>Nuevo código</button>
            {!d.closed_at && <button className="boton" disabled={busy} onClick={() => void hacer(async () => { await rpc('attendance_close', { p_session: d.id }); await cargar(d.id); })}>Cerrar asistencia</button>}
          </div>
        </section>
        {error && <p className="error">{error}</p>}
        <section className="grupo">
          <h2>✓ PRESENTES ({presentes.length})</h2>
          {presentes.map((e) => (
            <article key={e.user_id} className="tarjeta alumno">
              <div><p className="nombre"><span className="punto" aria-hidden="true" /> {e.full_name || e.student_code}</p>
                <p className="tenue">{e.marked_at ? hora(e.marked_at) : ''}{e.method === 'profesor' ? ' · marcado por usted' : ' · con código'}</p></div>
              <button className="boton secundario pequeno" disabled={busy} onClick={() => void hacer(async () => { await rpc('attendance_set', { p_session: d.id, p_user: e.user_id, p_present: false }); await cargar(d.id); })}>Quitar</button>
            </article>
          ))}
        </section>
        <section className="grupo">
          <h2>AUSENTES ({ausentes.length})</h2>
          {ausentes.map((e) => (
            <article key={e.user_id} className="tarjeta alumno fuera">
              <div><p className="nombre"><span className="punto apagado" aria-hidden="true" /> {e.full_name || e.student_code}</p><p className="tenue">Matrícula: {e.student_code ?? '—'}</p></div>
              <button className="boton secundario pequeno" disabled={busy} onClick={() => void hacer(async () => { await rpc('attendance_set', { p_session: d.id, p_user: e.user_id, p_present: true }); await cargar(d.id); })}>Marcar presente</button>
            </article>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="asistencia">
      {error && <p className="error">{error}</p>}
      {abiertas.length > 0 && (
        <section className="grupo">
          <h2>ASISTENCIAS ABIERTAS</h2>
          {abiertas.map((a) => (
            <article key={a.id} className="tarjeta alumno">
              <div><p className="nombre">{a.clase}</p><p className="tenue">{a.presentes} presente(s)</p></div>
              <button className="boton" onClick={() => setActiva(a.id)}>Ver</button>
            </article>
          ))}
        </section>
      )}
      <section className="tarjeta modal">
        <h2>PASAR LISTA</h2>
        <label>Sección
          <select value={clase} onChange={(e) => setClase(e.target.value)}>
            <option value="">Elija una sección…</option>
            {secciones.map((s) => <option key={s.class_id} value={s.class_id}>{s.course_title} — {s.class_name}</option>)}
          </select>
        </label>
        <label>El código vale
          <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
            {[5, 10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
          </select>
        </label>
        <button className="boton grande" disabled={!clase || busy} onClick={() => void hacer(async () => {
          const r = await rpc<{ id: string }>('attendance_open', { p_class: clase, p_minutes: minutos });
          setActiva(r.id);
        })}>Abrir asistencia y generar código</button>
        <p className="tenue pequeno">Dicte el código en clase. Los estudiantes lo escriben en el aula, en «Asistencia», y aparecen aquí al instante. Si abre otra asistencia en la misma sección, la anterior se cierra.</p>
      </section>
    </div>
  );
}
