/**
 * Orbe Control · Práctica de Control dentro de la asistencia (migración 62).
 * Ninguna (predeterminada) → la asistencia funciona exactamente igual. Con una práctica: preparar (vista previa de los
 * problemas individuales) → comprobar presencia → INICIAR (solo el profesor) → seguir en vivo → finalizar → revisar →
 * confirmar. Todo lo valida el servidor (control_*: solo el profesorado de la sección); la nota original no se toca.
 */
import { useCallback, useEffect, useState } from 'react';
import { funcion, rpc } from './supabase';
import { DURACIONES, ESTADO_CONTROL, ejemploAjuste, TIPO_TRANSFERENCIA, type EstadoControl } from '../../src/lib/control';

interface Practica {
  id: string; title: string; curso: string; seccion: string; opens_at: string | null; closes_at: string | null; created_at: string; entregaron: number;
  politica: { version: number; w: number; duracion_min: number; announced_at: string; alcance?: 'nuevas' | 'todas'; efectiva_desde?: string } | null; abierta: string | null;
}
interface Alumno {
  user_id: string; nombre: string; estado: EstadoControl; estado_elegibilidad: string; presente: boolean | null; exercise_id: string | null; slug: string | null;
  enunciado: string | null; formato: string | null; tipo: string | null; competencia: string | null; minutos: number | null; extra_min: number;
  seleccion: { alternativas?: { exercise_id: string; puntaje: number }[]; puntaje?: number } | null; attempt_id: string | null; resultado: number | null;
  en_blanco: boolean | null; limite: string | null; incidencia: string | null; exencion: string | null; nota_practica: number | null;
  politica_aplicable: number | null; factor: number; confirmado_at: string | null;
}
interface Vivo {
  session: { id: string; estado: 'preparado' | 'activo' | 'cerrado' | 'cancelado'; duracion_min: number; control_activity_id: string; recuperacion: boolean };
  server_now: string; practica: { id: string; title: string; curso: string; seccion: string; opens_at: string | null; closes_at: string | null; created_at: string };
  control: { closes_at: string | null }; politica: { version: number; w: number; duracion_min: number } | null; estudiantes: Alumno[];
}
interface Sesion { id: string; practica: string; estado: string; preparado_at: string; asignados: number; entregados: number; confirmados: number }
interface Revision {
  nombre: string; competencia: string | null; ejercicio: { prompt: string; format: string; options: string[] | null };
  clave: Record<string, unknown> | null; solucion: string | null;
  ficha: { rubrica: { criterio: string; peso: number }[]; hipotesis: string | null; justificacion: string } | null;
  respuesta: { id: string; answer: { text?: string; selected?: number[]; value?: boolean; justification?: string } | null; status: string; auto_credit: number | null; manual_credit: number | null; feedback: string | null } | null;
}
interface Ajuste { user_id: string; nombre: string; original: number | null; control: number | null; factor: number; final: number | null; politica: { version: number; w: number } | null }

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }) : '—');
const pct = (x: number) => `${Math.round(100 * x)} %`;
const nuevoId = () => crypto.randomUUID();

export function ControlPractica({ classId, attendanceId }: { classId: string; attendanceId: string | null }) {
  const [practicas, setPracticas] = useState<Practica[]>([]);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [elegida, setElegida] = useState('');
  const [duracion, setDuracion] = useState(7);
  const [sesion, setSesion] = useState<string | null>(null);
  const [v, setV] = useState<Vivo | null>(null);
  const [desfase, setDesfase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revisar, setRevisar] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<Ajuste[] | null>(null);
  const [, setTic] = useState(0);

  const cargarInicio = useCallback(async () => {
    const [p, s] = await Promise.all([rpc<Practica[]>('control_practicas', { p_class: classId }), rpc<Sesion[]>('control_sesiones', { p_class: classId })]);
    setPracticas(p);
    setSesiones(s);
    const abierta = s.find((x) => x.estado === 'preparado' || x.estado === 'activo');
    if (abierta) setSesion(abierta.id);
  }, [classId]);
  useEffect(() => { void cargarInicio().catch((e) => setError(e instanceof Error ? e.message : String(e))); }, [cargarInicio]);

  const cargar = useCallback(async (id: string) => {
    const r = await rpc<Vivo>('control_live', { p_session: id });
    setDesfase(new Date(r.server_now).getTime() - Date.now());
    setV(r);
  }, []);
  useEffect(() => {
    if (!sesion) { setV(null); return; }
    void cargar(sesion).catch((e) => setError(e.message));
    const t = window.setInterval(() => document.visibilityState === 'visible' && void cargar(sesion).catch(() => undefined), 4000);
    const s = window.setInterval(() => setTic((x) => x + 1), 1000);
    return () => { window.clearInterval(t); window.clearInterval(s); };
  }, [sesion, cargar]);

  async function hacer(fn: () => Promise<unknown>, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (sesion) await cargar(sesion);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const p = practicas.find((x) => x.id === elegida);
  useEffect(() => { if (p?.politica) setDuracion(p.politica.duracion_min); }, [p?.politica]);

  // ---------------------------------------------------------------- sin sesión: selector (Ninguna por defecto)
  if (!sesion || !v) {
    return (
      <section className="tarjeta modal-plano">
        <h2>PRÁCTICA DE CONTROL</h2>
        <label>Práctica de Control
          <select value={elegida} onChange={(e) => setElegida(e.target.value)}>
            <option value="">Ninguna (la asistencia funciona como siempre)</option>
            {practicas.map((x) => <option key={x.id} value={x.id} disabled={!!x.abierta}>{x.title}{x.abierta ? ' (ya preparada)' : ''}</option>)}
          </select>
        </label>
        {p && (
          <>
            <p className="pequeno"><strong>{p.title}</strong> · {p.curso} · {p.seccion}</p>
            <p className="tenue pequeno">Asignada {fecha(p.opens_at ?? p.created_at)} · entrega {fecha(p.closes_at)} · {p.entregaron} estudiante(s) la entregaron (elegibles si están presentes)</p>
            {p.politica ? (
              <p className="pequeno">Política anunciada (v{p.politica.version}): ajuste máximo <strong>{pct(p.politica.w)}</strong> de la nota de la práctica.
                Ej.: 90 en la práctica y 50 en el control → {ejemploAjuste(p.politica.w).final}.
                {p.politica.alcance === 'todas' ? ' Incluye entregas anteriores.' : ' Solo entregas posteriores al aviso.'}</p>
            ) : (
              <p className="aviso pequeno">Esta práctica no anunció una política de ajuste: el control será solo diagnóstico y NO cambiará ninguna nota.</p>
            )}
            {p.politica?.alcance === 'todas' && p.politica.efectiva_desde && new Date(p.politica.efectiva_desde).getTime() > Date.now() && (
              <p className="aviso pequeno">Aún no se cumple la antelación anunciada (desde {new Date(p.politica.efectiva_desde).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}): si lo inicia ahora será solo diagnóstico y no cambiará notas.</p>
            )}
            <label>Duración
              <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
                {[...new Set([...DURACIONES, p.politica?.duracion_min ?? 7])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m} minutos</option>)}
              </select>
            </label>
            <button className="boton grande" disabled={busy} onClick={() => void hacer(async () => {
              const r = await rpc<Vivo>('control_preparar', { p_practice: p.id, p_attendance: attendanceId, p_duracion: duracion, p_client_id: nuevoId(), p_recuperacion: false });
              setSesion(r.session.id);
            }, `¿Preparar la Práctica de Control de «${p.title}» (${duracion} min)? Se elegirá un problema para cada estudiante. NO empieza todavía: usted la inicia después.`)}>Preparar controles</button>
            <p className="tenue pequeno">Preparar no inicia nada: verá el problema de cada estudiante y podrá cambiarlo. La asistencia sigue igual.</p>
            {!attendanceId && <p className="aviso pequeno">Sin asistencia abierta: al iniciar, el control se dará a TODOS los que entregaron la práctica (no se comprueba quién está presente).</p>}
          </>
        )}
        {error && <p className="error">{error}</p>}
        {sesiones.filter((s) => s.estado === 'cerrado').length > 0 && (
          <details>
            <summary className="pequeno">Historial de controles de esta sección</summary>
            {sesiones.filter((s) => s.estado === 'cerrado').slice(0, 10).map((s) => (
              <article key={s.id} className="tarjeta alumno">
                <div><p className="nombre">{s.practica}</p><p className="tenue pequeno">{fecha(s.preparado_at)} · {s.entregados}/{s.asignados} entregados · {s.confirmados} confirmados</p></div>
                <button className="boton secundario pequeno" onClick={() => setSesion(s.id)}>Ver</button>
              </article>
            ))}
          </details>
        )}
      </section>
    );
  }

  // ---------------------------------------------------------------- con sesión
  const s = v.session;
  const elegibles = v.estudiantes.filter((e) => e.estado_elegibilidad === 'elegible' && e.exercise_id);
  const presentesElegibles = elegibles.filter((e) => e.presente !== false);
  const cierra = v.control.closes_at ? Math.max(0, Math.round((new Date(v.control.closes_at).getTime() - (Date.now() + desfase)) / 1000)) : null;
  const pendientes = v.estudiantes.filter((e) => e.estado === 'correccion_pendiente');
  const listos = v.estudiantes.filter((e) => e.estado === 'corregido');
  const orden: Record<string, number> = { en_desarrollo: 0, tiempo_agotado: 1, pendiente_inicio: 2, correccion_pendiente: 3, corregido: 4, confirmado: 5, incidencia: 6 };
  const lista = [...v.estudiantes].sort((a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) || a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <section className="grupo">
      <section className="tarjeta resumen">
        <p className="tenue">PRÁCTICA DE CONTROL{s.recuperacion ? ' · RECUPERACIÓN' : ''}</p>
        <p className="nombre">{v.practica.title}</p>
        <p className="tenue pequeno">{v.practica.curso} · {v.practica.seccion} · {s.duracion_min} min
          {v.politica && v.politica.w > 0 ? ` · ajuste máximo ${pct(v.politica.w)} (política v${v.politica.version})` : ' · solo diagnóstico (sin política anunciada)'}</p>
        <p className="tenue">{s.estado === 'preparado' ? 'PREPARADA · AÚN NO INICIADA' : s.estado === 'activo' ? 'EN CURSO' : s.estado === 'cerrado' ? 'FINALIZADA' : 'CANCELADA'}</p>
        {s.estado === 'activo' && cierra !== null && <p className="tenue pequeno">Ventana de inicio abierta {Math.floor(cierra / 60)}:{String(cierra % 60).padStart(2, '0')} más (el tiempo de cada estudiante lo controla el servidor)</p>}
        <p className="cifra">{s.estado === 'preparado' ? presentesElegibles.length : v.estudiantes.filter((e) => e.attempt_id).length}
          <span className="tenue"> / {elegibles.length}</span></p>
        <p className="tenue">{s.estado === 'preparado' ? 'PRESENTES Y ELEGIBLES' : 'COMENZARON'}</p>
        <div className="fila">
          {s.estado === 'preparado' && <>
            <button className="boton" disabled={busy || presentesElegibles.length === 0} onClick={() => void hacer(() => rpc('control_iniciar', { p_session: s.id }),
              `¿Iniciar ahora la Práctica de Control para ${presentesElegibles.length} estudiante(s) presente(s)? Empezará a contar su tiempo en cuanto la abran.`)}>Iniciar control</button>
            <button className="boton secundario" disabled={busy} onClick={() => void hacer(async () => { await rpc('control_cancelar', { p_session: s.id, p_motivo: 'Cancelada antes de empezar' }); setSesion(null); await cargarInicio(); },
              '¿Cancelar esta Práctica de Control? No afectará a ninguna nota.')}>Cancelar</button>
          </>}
          {s.estado === 'activo' && <>
            <button className="boton" disabled={busy} onClick={() => void hacer(async () => {
              await rpc('control_cerrar', { p_session: s.id });
              await funcion('calificar', { action: 'finalize', activity_id: s.control_activity_id });   // entrega lo guardado de quien no entregó
            }, '¿Finalizar el control? Se entregará lo que cada estudiante tenga guardado y nadie más podrá empezar.')}>Finalizar control</button>
            <button className="boton secundario" disabled={busy} onClick={() => void hacer(async () => { const m = window.prompt('Motivo de la cancelación (activación accidental, fallo general…)'); if (m) await rpc('control_cancelar', { p_session: s.id, p_motivo: m }); })}>Anular</button>
          </>}
          {s.estado === 'cerrado' && <>
            <button className="boton" disabled={busy || listos.length === 0} onClick={() => void hacer(() => rpc('control_confirmar', { p_session: s.id, p_users: null }),
              `¿Confirmar ${listos.length} resultado(s)? Solo después de confirmar se aplica el ajuste anunciado. Los pendientes de revisión y las incidencias no se confirman.`)}>Confirmar resultados ({listos.length})</button>
            <button className="boton secundario" disabled={busy} onClick={() => void hacer(async () => setAjustes(await rpc<Ajuste[]>('control_ajustes', { p_practice: v.practica.id })))}>Ver ajustes de nota</button>
          </>}
          {(s.estado === 'cerrado' || s.estado === 'cancelado') && <button className="boton secundario" onClick={() => { setSesion(null); void cargarInicio(); }}>Cerrar vista</button>}
        </div>
        {s.estado === 'cerrado' && pendientes.length > 0 && <p className="aviso pequeno">{pendientes.length} respuesta(s) necesitan su revisión antes de poder confirmarse.</p>}
      </section>
      {error && <p className="error">{error}</p>}

      {lista.map((e) => {
        const est = ESTADO_CONTROL[e.estado] ?? { texto: e.estado, tono: 'neutro' };
        const restante = e.limite ? Math.max(0, Math.round((new Date(e.limite).getTime() - (Date.now() + desfase)) / 1000)) : null;
        return (
          <article key={e.user_id} className={`tarjeta alumno ${est.tono === 'tenue' ? 'fuera' : ''}`}>
            <div>
              <p className="nombre"><span className={`punto ${est.tono === 'tenue' ? 'apagado' : ''}`} aria-hidden="true" /> {e.nombre}</p>
              <p className={est.tono === 'aviso' ? 'advertencia pequeno' : est.tono === 'ok' ? 'verde pequeno' : 'tenue pequeno'}>
                {est.texto}{e.estado === 'en_desarrollo' && restante !== null ? ` · ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}` : ''}
                {e.resultado !== null ? ` · ${e.resultado}/100` : ''}{e.en_blanco ? ' · EN BLANCO' : ''}{e.extra_min ? ` · +${e.extra_min} min` : ''}
                {s.estado === 'preparado' && e.presente === false && e.estado_elegibilidad === 'elegible' ? ' · aún no marcó asistencia' : ''}</p>
              {e.competencia && <p className="tenue pequeno">{e.competencia} · {TIPO_TRANSFERENCIA[e.tipo ?? ''] ?? e.tipo}{e.minutos ? ` · ~${e.minutos} min` : ''}</p>}
              {e.incidencia && <p className="advertencia pequeno">Incidencia: {e.incidencia}</p>}
              {e.exencion && <p className="tenue pequeno">Exento: {e.exencion}</p>}
              {e.enunciado && s.estado === 'preparado' && <details><summary className="pequeno">Ver problema</summary><p className="pequeno">{e.enunciado}</p></details>}
              {e.confirmado_at && e.factor < 1 && <p className="pequeno">Práctica {e.nota_practica ?? '—'} → ×{e.factor.toFixed(2)}</p>}
            </div>
            <div className="fila">
              {s.estado === 'preparado' && e.estado_elegibilidad === 'elegible' && (e.seleccion?.alternativas?.length ?? 0) > 1 && (
                <button className="boton secundario pequeno" disabled={busy} onClick={() => void hacer(async () => {
                  const alt = e.seleccion!.alternativas!.map((a) => a.exercise_id);
                  const siguiente = alt[(alt.indexOf(e.exercise_id ?? '') + 1) % alt.length];
                  await rpc('control_sustituir', { p_session: s.id, p_user: e.user_id, p_exercise: siguiente });
                })}>Cambiar problema</button>
              )}
              {(s.estado === 'preparado' || s.estado === 'activo') && e.estado_elegibilidad === 'elegible' && (
                <button className="boton secundario pequeno" disabled={busy} onClick={() => void hacer(async () => {
                  const m = window.prompt('Minutos adicionales (adaptación justificada, 1–20):', String(e.extra_min || 2));
                  if (!m) return;
                  const motivo = window.prompt('Motivo (queda registrado):');
                  if (!motivo) return;
                  await rpc('control_tiempo_extra', { p_session: s.id, p_user: e.user_id, p_minutos: Number(m), p_motivo: motivo });
                })}>+ Tiempo</button>
              )}
              {s.estado === 'preparado' && e.estado_elegibilidad !== 'sin_entrega' && (
                <button className="boton secundario pequeno" disabled={busy} onClick={() => void hacer(async () => {
                  const motivo = e.estado_elegibilidad === 'exento' ? '' : window.prompt('Motivo de la exención (queda registrado):');
                  if (motivo === null) return;
                  await rpc('control_exentar', { p_session: s.id, p_user: e.user_id, p_motivo: motivo });
                })}>{e.estado_elegibilidad === 'exento' ? 'Quitar exención' : 'Exentar'}</button>
              )}
              {s.estado === 'activo' && (e.estado === 'ausente' || (e.estado_elegibilidad === 'elegible' && !e.exercise_id)) && (
                <button className="boton secundario pequeno" disabled={busy} onClick={() => void hacer(() => rpc('control_agregar', { p_session: s.id, p_user: e.user_id }),
                  `¿Dar el control a ${e.nombre} (llegada tardía)? Su tiempo empezará cuando lo abra.`)}>Dar control</button>
              )}
              {(s.estado === 'activo' || s.estado === 'cerrado') && e.attempt_id && (
                <button className="boton secundario pequeno" disabled={busy} onClick={() => void hacer(async () => {
                  const t = window.prompt(e.incidencia ? 'Deje vacío para quitar la incidencia:' : 'Describa la incidencia técnica (el control no afectará a su nota):', e.incidencia ?? '');
                  if (t === null) return;
                  await rpc('control_incidencia', { p_session: s.id, p_user: e.user_id, p_texto: t });
                })}>{e.incidencia ? 'Incidencia ✓' : 'Incidencia'}</button>
              )}
              {s.estado === 'cerrado' && e.attempt_id && <button className="boton secundario pequeno" onClick={() => setRevisar(e.user_id)}>Revisar</button>}
            </div>
          </article>
        );
      })}
      {revisar && <RevisarControl sesion={s.id} usuario={revisar} onCerrar={() => { setRevisar(null); void cargar(s.id); }} />}
      {ajustes && (
        <div className="velo" onClick={() => setAjustes(null)}>
          <section className="tarjeta modal" onClick={(ev) => ev.stopPropagation()}>
            <h2>AJUSTES DE LA NOTA DE LA PRÁCTICA</h2>
            <p className="tenue pequeno">N_final = N_original × [1 − w × (1 − C/100)]. La nota original no se modifica; el Registro usa la final.</p>
            {ajustes.filter((a) => a.original !== null).map((a) => (
              <p key={a.user_id} className="pequeno">{a.nombre}: {a.original} {a.control !== null ? `→ control ${a.control}/100 → ${a.final}` : '(sin control confirmado: sin cambio)'}
                {a.politica ? '' : a.control !== null ? ' · sin política aplicable (entregó antes del aviso): sin cambio' : ''}</p>
            ))}
            <button className="boton" onClick={() => setAjustes(null)}>Cerrar</button>
          </section>
        </div>
      )}
    </section>
  );
}

/** Revisión docente con rúbrica: propone un crédito (suma de criterios marcados) que el profesor puede ajustar y guardar. */
function RevisarControl({ sesion, usuario, onCerrar }: { sesion: string; usuario: string; onCerrar: () => void }) {
  const [r, setR] = useState<Revision | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [credito, setCredito] = useState<number>(0);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void rpc<Revision>('control_revision', { p_session: sesion, p_user: usuario }).then((x) => {
      setR(x);
      setCredito(Math.round(100 * (x.respuesta?.manual_credit ?? x.respuesta?.auto_credit ?? 0)));
      setNota(x.respuesta?.feedback ?? '');
    }).catch((e) => setError(e.message));
  }, [sesion, usuario]);
  const rub = r?.ficha?.rubrica ?? [];
  const alternar = (i: number) => {
    const n = new Set(marcados);
    if (n.has(i)) n.delete(i); else n.add(i);
    setMarcados(n);
    setCredito(rub.reduce((a, c, k) => a + (n.has(k) ? c.peso : 0), 0));
  };
  const resp = r?.respuesta?.answer;
  return (
    <div className="velo" onClick={onCerrar}>
      <section className="tarjeta modal" onClick={(e) => e.stopPropagation()}>
        <h2>REVISIÓN · {r?.nombre ?? ''}</h2>
        {error && <p className="error">{error}</p>}
        {r && <>
          <p className="tenue pequeno">{r.competencia}</p>
          <p className="pequeno">{r.ejercicio.prompt}</p>
          <p className="tenue">RESPUESTA</p>
          <p>{resp?.text ?? (resp?.selected ? resp.selected.map((i) => r.ejercicio.options?.[i] ?? i).join(', ') : resp?.value !== undefined ? (resp.value ? 'Verdadero' : 'Falso') : '— en blanco —')}</p>
          {resp?.justification && <p className="pequeno">Justificación: {resp.justification}</p>}
          <p className="tenue pequeno">Corrección automática: {r.respuesta?.status} {r.respuesta?.auto_credit !== null ? `(${Math.round(100 * (r.respuesta?.auto_credit ?? 0))} %)` : ''}</p>
          {r.solucion && <details><summary className="pequeno">Solución de referencia</summary><p className="pequeno">{r.solucion}</p></details>}
          {r.ficha?.hipotesis && <p className="tenue pequeno">Hipótesis: {r.ficha.hipotesis}</p>}
          {rub.length > 0 && <>
            <p className="tenue">RÚBRICA (marque lo logrado)</p>
            {rub.map((c, i) => <label key={i} className="casilla"><input type="checkbox" checked={marcados.has(i)} onChange={() => alternar(i)} /> {c.criterio} ({c.peso})</label>)}
          </>}
          <label>Calificación confirmada (0–100)
            <input type="number" min={0} max={100} value={credito} onChange={(e) => setCredito(Math.max(0, Math.min(100, Number(e.target.value))))} />
          </label>
          <label>Comentario para el estudiante<input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} /></label>
          <div className="fila">
            <button className="boton" disabled={!r.respuesta} onClick={() => void rpc('grade_response', { p_response: r.respuesta!.id, p_credit: credito / 100, p_feedback: nota })
              .then(onCerrar).catch((e) => setError(e.message))}>Guardar calificación</button>
            <button className="boton secundario" onClick={onCerrar}>Cerrar</button>
          </div>
          <p className="tenue pequeno">Queda registrada con su nombre y hora. Una nota baja en el control no es prueba de uso indebido de IA.</p>
        </>}
      </section>
    </div>
  );
}

interface AsistenciaAbierta { id: string; class_id: string; clase: string; presentes: number }

/**
 * Pestaña «Control»: punto de entrada visible. Elige la sección; si tiene una asistencia abierta, el control se vincula a
 * ella (solo los presentes lo reciben). Si no, avisa y permite seguir sin asistencia.
 */
export function ControlTab({ secciones }: { secciones: [string, string][] }) {
  const [clase, setClase] = useState('');
  const [abiertas, setAbiertas] = useState<AsistenciaAbierta[]>([]);
  const [sinAsistencia, setSinAsistencia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void rpc<AsistenciaAbierta[]>('attendance_open_sessions').then(setAbiertas).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [clase]);
  const asistencia = abiertas.find((a) => a.class_id === clase) ?? null;
  return (
    <div className="asistencia">
      <section className="tarjeta modal-plano">
        <h2>🎯 PRÁCTICA DE CONTROL</h2>
        <p className="tenue pequeno">Prueba corta, individual y presencial sobre una práctica ya hecha. Elija la sección: si tiene la asistencia abierta,
          el control se da solo a los presentes. La política de nota de cada práctica se anuncia en el aula (Actividad → Configuración).</p>
        <label>Sección
          <select value={clase} onChange={(e) => { setClase(e.target.value); setSinAsistencia(false); }}>
            <option value="">Elija una sección…</option>
            {secciones.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
          </select>
        </label>
        {clase && (asistencia
          ? <p className="verde pequeno">Asistencia abierta en esta sección · {asistencia.presentes} presente(s). El control se vinculará a ella.</p>
          : <p className="aviso pequeno">Esta sección no tiene la asistencia abierta. Lo recomendable es abrirla primero (pestaña 📋 Asistencia) para dar el control solo a los presentes.
              {!sinAsistencia && <button className="boton secundario pequeno" onClick={() => setSinAsistencia(true)}>Continuar sin asistencia</button>}</p>)}
        {error && <p className="error">{error}</p>}
      </section>
      {clase && (asistencia || sinAsistencia) && <ControlPractica key={clase + (asistencia?.id ?? '')} classId={clase} attendanceId={asistencia?.id ?? null} />}
    </div>
  );
}
