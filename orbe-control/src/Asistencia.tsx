/**
 * Orbe Control · Asistencia: abrir la asistencia de una sección, mostrar el código para dictarlo en clase y ver en
 * vivo quién está presente. Todo lo decide el servidor (attendance_*: solo el profesorado de la sección).
 */
import { useCallback, useEffect, useState } from 'react';
import { rpc } from './supabase';
import { avisoPrecision, MOTIVO_RECHAZO, PRECISION_PROFESOR, textoVerificacion, ubicacionActual } from '../../src/lib/ubicacion';
import { QuorumConfig } from './QuorumConfig';

interface Seccion { class_id: string; class_name: string; course_title: string }
interface EnVivo {
  id: string; clase: string; asignatura: string; code: string; code_expires_at: string; closed_at: string | null; server_now: string;
  rotate_seconds: number; code_changes_at: string | null; require_location: boolean; geo_radius_m: number; tiene_ubicacion: boolean;
  estudiantes: { user_id: string; full_name: string; student_code: string | null; presente: boolean; marked_at: string | null; method: string | null;
    geo_status: string | null; distance_m: number | null; accuracy: number | null; distancia_ref_m?: number | null; validado_por?: string | null }[];
  rechazos: { full_name: string; student_code: string | null; motivo: string; distance_m: number | null; accuracy: number | null; fecha: string }[];
  // migración 43 (asistencia por quórum); ausentes en bases anteriores
  opened_at?: string; activacion?: 'manual' | 'quorum'; franja?: string | null;
  quorum?: { user_id: string; full_name: string; student_code: string | null }[];
  incidencias?: { tipo: string; full_name: string | null; detalle: Record<string, unknown>; fecha: string }[];
}
const COMO: Record<string, string> = { profesor: 'marcado por usted', codigo: 'con código', quorum: 'quórum inicial', proximidad: 'por proximidad' };
const INCIDENCIA: Record<string, string> = {
  activacion: 'activó la asistencia (quórum)', presente: 'presente por proximidad', inconclusa: 'validación inconclusa', fuera_de_zona: 'fuera de la zona',
  medicion_antigua: 'medición antigua', dispositivo_compartido: 'dispositivo de otro estudiante', renovada: 'renovó su referencia',
  configuracion: 'cambió la configuración', centro_modificado: 'el docente cambió el centro',
};
const MOTIVO: Record<string, string> = {
  precision: 'GPS poco preciso', sin_referencias_vigentes: 'ningún admitido con ubicación reciente', zona_incierta: 'en el límite de la zona',
  proximidad_incierta: 'proximidad incierta', lejos_del_centro: 'lejos del centro inicial', lejos_de_los_admitidos: 'lejos de los admitidos',
};
const distancia = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
interface Abierta { id: string; class_id: string; clase: string; code_expires_at: string; presentes: number }

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });

export function Asistencia() {
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [abiertas, setAbiertas] = useState<Abierta[]>([]);
  const [clase, setClase] = useState('');
  const [minutos, setMinutos] = useState(15);
  const [rotar, setRotar] = useState(30);
  const [verificar, setVerificar] = useState(true);
  const [radio, setRadio] = useState(100);
  const [paso, setPaso] = useState<string | null>(null);
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

  // con código rotativo: recargar justo cuando cambia (además de la consulta cada 3 s)
  useEffect(() => {
    if (!activa || !d?.code_changes_at) return;
    const ms = new Date(d.code_changes_at).getTime() - (Date.now() + desfase) + 300;
    const t = window.setTimeout(() => void cargar(activa).catch(() => undefined), Math.max(300, ms));
    return () => window.clearTimeout(t);
  }, [activa, d?.code_changes_at, desfase, cargar]);

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
    const cambiaEn = d.code_changes_at ? Math.max(0, Math.ceil((new Date(d.code_changes_at).getTime() - (Date.now() + desfase)) / 1000)) : null;
    const porQuorum = d.activacion === 'quorum';
    return (
      <div className="asistencia">
        <button className="enlace" onClick={() => { setActiva(null); setD(null); void cargarInicio(); }}>← Secciones</button>
        <h2>{d.asignatura.toUpperCase()} · {d.clase.toUpperCase()}</h2>
        <section className="tarjeta resumen">
          {porQuorum ? (
            <>
              <p className="tenue">ACTIVADA POR QUÓRUM DE PROXIMIDAD</p>
              <p className="tenue pequeno">Hora programada {d.franja ? hora(d.franja) : '—'} · activada a las {d.opened_at ? hora(d.opened_at) : '—'}</p>
              <p className="pequeno">Quórum inicial: {(d.quorum ?? []).map((q) => q.full_name || q.student_code).join(', ') || '—'}</p>
              <p className="tenue pequeno">Zona de {d.geo_radius_m} m alrededor del centro del grupo inicial (fijo). Los demás se validan por cercanía a compañeros ya registrados.</p>
            </>
          ) : (<>
          <p className="tenue">CÓDIGO DE ASISTENCIA</p>
          <p className={`codigo ${vigente ? '' : 'vencido'}`}>{d.code.slice(0, 3)} {d.code.slice(3)}</p>
          </>)}
          {!porQuorum && vigente && cambiaEn !== null && (
            <>
              <div className="barra" aria-hidden="true"><div style={{ width: `${(100 * cambiaEn) / d.rotate_seconds}%` }} /></div>
              <p className="tenue pequeno">Cambia en {cambiaEn} s</p>
            </>
          )}
          <p className="tenue">{d.closed_at ? 'Asistencia cerrada' : vigente ? `Abierta ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')} más` : 'Tiempo terminado'}</p>
          {!porQuorum && <p className="tenue pequeno">{d.tiene_ubicacion ? `📍 Verifica ubicación · radio ${d.geo_radius_m} m${d.require_location ? ' · obligatoria' : ''}` : 'Sin verificación de ubicación'}</p>}
          <p className="cifra">{presentes.length}<span className="tenue"> / {d.estudiantes.length}</span></p>
          <p className="tenue">PRESENTES</p>
          <div className="fila">
            <button className="boton secundario" disabled={busy} onClick={() => void hacer(async () => { await rpc('attendance_new_code', { p_session: d.id, p_minutes: minutos }); await cargar(d.id); })}>{porQuorum ? 'Habilitar también código' : 'Nuevo código'}</button>
            {!d.closed_at && <button className="boton" disabled={busy} onClick={() => void hacer(async () => { await rpc('attendance_close', { p_session: d.id }); await cargar(d.id); })}>Cerrar asistencia</button>}
          </div>
        </section>
        {error && <p className="error">{error}</p>}
        <section className="grupo">
          <h2>✓ PRESENTES ({presentes.length})</h2>
          {presentes.map((e) => (
            <article key={e.user_id} className="tarjeta alumno">
              <div><p className="nombre"><span className="punto" aria-hidden="true" /> {e.full_name || e.student_code}</p>
                <p className="tenue">{e.marked_at ? hora(e.marked_at) : ''} · {COMO[e.method ?? ''] ?? 'con código'}</p>
                {e.method === 'codigo' && e.geo_status && <p className={e.geo_status === 'verificado' ? 'verde pequeno' : 'advertencia pequeno'}>{textoVerificacion(e.geo_status, e.distance_m, e.accuracy)}</p>}
                {(e.method === 'quorum' || e.method === 'proximidad') && <p className="verde pequeno">📍 a {e.distance_m ?? '?'} m del centro{e.method === 'proximidad' && e.validado_por ? ` · a ${e.distancia_ref_m ?? '?'} m de ${e.validado_por.split(' ')[0]}` : ''}{e.accuracy ? ` · ±${e.accuracy} m` : ''}</p>}</div>
              <button className="boton secundario pequeno" disabled={busy} onClick={() => void hacer(async () => { await rpc('attendance_set', { p_session: d.id, p_user: e.user_id, p_present: false }); await cargar(d.id); })}>Quitar</button>
            </article>
          ))}
        </section>
        {d.rechazos.length > 0 && (
          <section className="grupo">
            <h2>⛔ INTENTOS RECHAZADOS ({d.rechazos.length})</h2>
            {d.rechazos.map((r, i) => (
              <article key={i} className="tarjeta rechazo">
                <p className="nombre">{r.full_name || r.student_code}</p>
                <p className="tenue">{hora(r.fecha)} · {MOTIVO_RECHAZO[r.motivo] ?? r.motivo}{r.distance_m !== null ? ` · a ${distancia(r.distance_m)}${r.accuracy ? ` (±${r.accuracy} m)` : ''}` : ''}</p>
                {presentes.some((p) => p.full_name === r.full_name && p.student_code === r.student_code) && <p className="verde pequeno">Después quedó presente</p>}
              </article>
            ))}
          </section>
        )}
        {(d.incidencias ?? []).length > 0 && (
          <section className="grupo">
            <details>
              <summary><h2 style={{ display: 'inline' }}>📍 VALIDACIONES E INCIDENCIAS ({d.incidencias!.length})</h2></summary>
              {d.incidencias!.map((x, i) => (
                <article key={i} className="tarjeta rechazo">
                  <p className="nombre">{x.full_name ?? '—'}</p>
                  <p className="tenue">{hora(x.fecha)} · {INCIDENCIA[x.tipo] ?? x.tipo}{x.detalle.motivo ? ` (${MOTIVO[String(x.detalle.motivo)] ?? String(x.detalle.motivo)})` : ''}
                    {x.detalle.distancia_centro_m !== undefined ? ` · a ${String(x.detalle.distancia_centro_m)} m del centro` : ''}
                    {x.detalle.precision_m !== undefined && x.detalle.precision_m !== null ? ` · ±${String(x.detalle.precision_m)} m` : ''}</p>
                </article>
              ))}
              <p className="tenue pequeno">«Inconclusa» no es ausencia: la medición no permitió decidir. Puede marcarlo a mano abajo.</p>
            </details>
          </section>
        )}
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
        <label>Abierta durante
          <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
            {[5, 10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
          </select>
        </label>
        <label>El código cambia
          <select value={rotar} onChange={(e) => setRotar(Number(e.target.value))}>
            <option value={15}>cada 15 segundos</option><option value={30}>cada 30 segundos (recomendado)</option><option value={60}>cada minuto</option><option value={0}>nunca (código fijo)</option>
          </select>
        </label>
        <label className="casilla"><input type="checkbox" checked={verificar} onChange={(e) => setVerificar(e.target.checked)} /> Verificar que están en el aula (ubicación)</label>
        {verificar && (
          <label>Radio del aula
            <select value={radio} onChange={(e) => setRadio(Number(e.target.value))}>
              {[50, 100, 150, 250, 500].map((m) => <option key={m} value={m}>{m} metros</option>)}
            </select>
          </label>
        )}
        <button className="boton grande" disabled={!clase || busy} onClick={() => void hacer(async () => {
          let u: { lat: number; lng: number; accuracy: number } | null = null;
          if (verificar) {
            setPaso('Obteniendo su ubicación…');
            const r = await ubicacionActual();
            setPaso(null);
            if (!r.ubicacion) throw new Error(`${r.motivo} Sin su ubicación no se puede verificar la de los estudiantes; desmarque la verificación si quiere abrir igualmente.`);
            if (r.ubicacion.accuracy > PRECISION_PROFESOR && !window.confirm(avisoPrecision(r.ubicacion.accuracy))) return;
            u = r.ubicacion;
          }
          const r = await rpc<{ id: string }>('attendance_start', {
            p_class: clase, p_minutes: minutos, p_rotate: rotar, p_lat: u?.lat ?? null, p_lng: u?.lng ?? null, p_accuracy: u?.accuracy ?? null,
            p_require_location: verificar, p_radius: radio,
          });
          setActiva(r.id);
        })}>{paso ?? 'Abrir asistencia y mostrar el código'}</button>
        <p className="tenue pequeno">Muestre esta pantalla en el proyector o léala en voz alta. Con el código que cambia, quien lo reciba por mensaje fuera del aula probablemente llegue tarde. Con la ubicación, el servidor rechaza a quien esté fuera del radio. Un mismo dispositivo no puede marcar a dos estudiantes. Verá cada rechazo aquí. Si abre otra asistencia en la misma sección, la anterior se cierra (también una activada por quórum).</p>
      </section>
      {clase ? <QuorumConfig classId={clase} /> : <p className="tenue pequeno">Elija una sección para configurar también la asistencia autónoma por quórum (activación por los estudiantes a la hora de clase).</p>}
    </div>
  );
}
