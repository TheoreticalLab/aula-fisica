/**
 * PREGUNTA RELÁMPAGO: el profesor lanza una pregunta de opción múltiple (propuesta por Claude o escrita por él) a los
 * conectados o a toda una sección y ve las respuestas en vivo. Con «bloquear a quien salga», el estudiante que
 * abandone la plataforma tras ver la pregunta y antes de responder queda con la pantalla bloqueada hasta que el
 * profesor le dé el código (o lo libere). Todo lo decide el servidor (poll_*); aquí solo se muestra.
 */
import { useCallback, useEffect, useState } from 'react';
import { rpc, supabase } from './supabase';
import { pedirIA } from './ia';
import { porcentajes, segundosRestantes } from './logica';

interface Propuesta { enunciado: string; opciones: string[]; correcta: number; explicacion: string }
interface Resultado {
  id: string; question: string; options: string[]; correct: number | null; explanation: string | null; lock_on_leave: boolean;
  closes_at: string; abierta: boolean; server_now: string; conteo: number[]; destinatarios: number; vieron: number; respondieron: number; salieron: number;
  estudiantes: { user_id: string; nombre: string; vio: boolean; respuesta: number | null; respondio: string | null; salio: string | null; bloqueado: boolean }[];
}
interface Reciente { id: string; question: string; created_at: string; abierta: boolean; destinatarios: number; respondieron: number; salieron: number }

const LETRA = 'ABCDEF';
const codigoAleatorio = () => String(Math.floor(1000 + Math.random() * 9000));

export function Pregunta({ secciones, conectados, onCambio }: { secciones: [string, string][]; conectados: number; onCambio: () => void }) {
  const [activa, setActiva] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<Record<string, string>>({});   // código de desbloqueo de cada pregunta (solo en este teléfono)
  const [recientes, setRecientes] = useState<Reciente[]>([]);
  const cargarRecientes = useCallback(async () => {
    try {
      const r = await rpc<Reciente[]>('my_recent_polls');
      setRecientes(r);
      setActiva((a) => a ?? r.find((x) => x.abierta)?.id ?? null);
    } catch { /* sin conexión */ }
  }, []);
  useEffect(() => { void cargarRecientes(); }, [cargarRecientes]);

  return (
    <div className="asistencia">
      {activa
        ? <Resultados id={activa} codigo={codigo[activa]} onNueva={() => { setActiva(null); void cargarRecientes(); }} onCambio={onCambio} />
        : <Nueva secciones={secciones} conectados={conectados} onLanzada={(id, cod) => { setCodigo((c) => ({ ...c, [id]: cod })); setActiva(id); void cargarRecientes(); }} />}
      {recientes.length > 0 && (
        <section className="grupo">
          <h2>PREGUNTAS RECIENTES</h2>
          {recientes.map((r) => (
            <article key={r.id} className="tarjeta alumno">
              <div>
                <p>{r.question.slice(0, 80)}{r.question.length > 80 ? '…' : ''}</p>
                <p className="tenue">{new Date(r.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })} · {r.respondieron}/{r.destinatarios} respondieron{r.salieron ? ` · ${r.salieron} salieron` : ''}{r.abierta ? ' · ABIERTA' : ''}</p>
              </div>
              <button className="boton secundario pequeno" onClick={() => setActiva(r.id)}>Ver</button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function Nueva({ secciones, conectados, onLanzada }: { secciones: [string, string][]; conectados: number; onLanzada: (id: string, codigo: string) => void }) {
  const [clase, setClase] = useState('');
  const [modo, setModo] = useState<'conectados' | 'seccion'>('conectados');
  const [lecciones, setLecciones] = useState<{ id: string; titulo: string }[]>([]);
  const [leccion, setLeccion] = useState('');
  const [tema, setTema] = useState('');
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null);
  const [simulado, setSimulado] = useState(false);
  const [enunciado, setEnunciado] = useState('');
  const [opciones, setOpciones] = useState<string[]>(['', '', '', '']);
  const [correcta, setCorrecta] = useState<number | null>(0);
  const [explicacion, setExplicacion] = useState('');
  const [deIA, setDeIA] = useState(false);
  const [minutos, setMinutos] = useState(2);
  const [bloquear, setBloquear] = useState(true);
  const [codigo, setCodigo] = useState(codigoAleatorio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  // lecciones de la asignatura de la sección elegida (para que Claude proponga preguntas de esa lección)
  useEffect(() => {
    setLeccion(''); setLecciones([]);
    if (!clase) return;
    void (async () => {
      const { data: c } = await supabase.from('classes').select('course_id').eq('id', clase).maybeSingle();
      if (!c) return;
      const [{ data: us }, { data: ls }] = await Promise.all([
        supabase.from('units').select('id, position').eq('course_id', c.course_id),
        supabase.from('lessons').select('id, title, position, unit_id').eq('course_id', c.course_id),
      ]);
      const pos = new Map((us ?? []).map((u: { id: string; position: number }) => [u.id, u.position]));
      setLecciones(((ls ?? []) as { id: string; title: string; position: number; unit_id: string }[])
        .sort((a, b) => (pos.get(a.unit_id) ?? 0) - (pos.get(b.unit_id) ?? 0) || a.position - b.position)
        .map((l) => ({ id: l.id, titulo: l.title })));
    })();
  }, [clase]);

  async function proponer() {
    setBusy(true); setError(null); setPropuestas(null);
    try {
      const r = await pedirIA<Propuesta[]>({ action: 'preguntas', lesson_id: leccion || null, tema: tema || null, n: 3 });
      setPropuestas(r.resultado); setSimulado(r.simulado);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function usar(p: Propuesta) {
    setEnunciado(p.enunciado); setOpciones([...p.opciones]); setCorrecta(p.correcta); setExplicacion(p.explicacion); setDeIA(true); setConfirmar(false);
  }
  const validas = opciones.map((o) => o.trim()).filter(Boolean);
  const lista = enunciado.trim().length >= 5 && validas.length >= 2 && (!bloquear || codigo.trim().length >= 4) && (modo === 'conectados' || !!clase);
  async function lanzar() {
    if (!confirmar) return setConfirmar(true);
    setBusy(true); setError(null);
    try {
      const limpias = opciones.map((o) => o.trim());
      const idx = correcta === null || !limpias[correcta] ? null : limpias.slice(0, correcta).filter(Boolean).length;
      const r = await rpc<{ id: string; destinatarios: number }>('poll_open', {
        p_mode: modo, p_class: clase || null, p_question: enunciado, p_options: limpias.filter(Boolean), p_correct: idx,
        p_explanation: explicacion || null, p_lock: bloquear, p_code: bloquear ? codigo : null, p_minutes: minutos, p_origin: deIA ? 'ia' : 'profesor',
      });
      onLanzada(r.id, bloquear ? codigo.trim() : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setConfirmar(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="tarjeta modal-plano">
        <h2>NUEVA PREGUNTA RELÁMPAGO</h2>
        <label>Sección
          <select value={clase} onChange={(e) => { setClase(e.target.value); setConfirmar(false); }}>
            <option value="">Todas mis secciones</option>
            {secciones.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
          </select>
        </label>
        <label>Destinatarios
          <select value={modo} onChange={(e) => { setModo(e.target.value as 'conectados' | 'seccion'); setConfirmar(false); }}>
            <option value="conectados">Conectados ahora{clase ? '' : ` (${conectados})`}</option>
            <option value="seccion" disabled={!clase}>Toda la sección (los desconectados la verán al entrar si sigue abierta)</option>
          </select>
        </label>
      </section>

      <section className="tarjeta ia">
        <h2>✨ PROPUESTA DE CLAUDE</h2>
        {clase && lecciones.length > 0 && (
          <label>Lección
            <select value={leccion} onChange={(e) => setLeccion(e.target.value)}>
              <option value="">(sin lección: use el tema)</option>
              {lecciones.map((l) => <option key={l.id} value={l.id}>{l.titulo}</option>)}
            </select>
          </label>
        )}
        <label>Tema o enfoque (opcional)<input maxLength={200} value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej.: diferencia entre velocidad media e instantánea" /></label>
        <button className="boton secundario" disabled={busy || (!leccion && tema.trim().length < 3)} onClick={() => void proponer()}>{busy ? 'Pensando…' : '✨ Proponer 3 preguntas'}</button>
        {propuestas && propuestas.map((p, i) => (
          <article key={i} className="tarjeta">
            <p>{p.enunciado}</p>
            {p.opciones.map((o, j) => <p key={j} className={j === p.correcta ? 'verde' : 'tenue'}>{LETRA[j]}) {o}{j === p.correcta ? ' ✓' : ''}</p>)}
            <div className="fila"><button className="boton pequeno" onClick={() => usar(p)}>Usar esta</button></div>
          </article>
        ))}
        {propuestas && <p className="tenue pequeno">{simulado ? 'Simulador: active las llamadas reales para preguntas de verdad.' : 'Revise la respuesta marcada como correcta antes de lanzarla.'}</p>}
      </section>

      <section className="tarjeta modal-plano">
        <h2>PREGUNTA</h2>
        <label>Enunciado<textarea rows={3} maxLength={500} value={enunciado} onChange={(e) => { setEnunciado(e.target.value); setConfirmar(false); }} /></label>
        {opciones.map((o, i) => (
          <div key={i} className="opcion-editar">
            <input type="radio" name="correcta" aria-label={`Correcta: ${LETRA[i]}`} checked={correcta === i} onChange={() => setCorrecta(i)} />
            <input aria-label={`Opción ${LETRA[i]}`} maxLength={200} value={o} placeholder={`Opción ${LETRA[i]}`} onChange={(e) => { const n = [...opciones]; n[i] = e.target.value; setOpciones(n); setConfirmar(false); }} />
            {opciones.length > 2 && <button className="enlace" aria-label="Quitar opción" onClick={() => { setOpciones(opciones.filter((_, j) => j !== i)); setCorrecta(null); }}>✕</button>}
          </div>
        ))}
        <div className="fila">
          {opciones.length < 6 && <button className="boton secundario pequeno" onClick={() => setOpciones([...opciones, ''])}>+ Opción</button>}
          <button className="boton secundario pequeno" onClick={() => setCorrecta(null)}>Sin respuesta correcta (encuesta)</button>
        </div>
        <label>Explicación (la ve usted; opcional)<textarea rows={2} maxLength={600} value={explicacion} onChange={(e) => setExplicacion(e.target.value)} /></label>
        <label>Duración
          <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
            {[1, 2, 3, 5, 10].map((m) => <option key={m} value={m}>{m} minuto{m > 1 ? 's' : ''}</option>)}
          </select>
        </label>
        <label className="casilla"><input type="checkbox" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)} /> 🔒 Bloquear la pantalla a quien salga de la plataforma sin responder</label>
        {bloquear && (
          <label>Código de desbloqueo (anótelo: se guarda cifrado)
            <input maxLength={32} autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </label>
        )}
        {confirmar && (
          <p className="aviso">
            ¿Lanzar la pregunta a {modo === 'conectados' ? 'los estudiantes conectados' : 'toda la sección'} durante {minutos} min?
            {bloquear && ` Quien salga de la plataforma sin responder quedará bloqueado hasta que le dé el código «${codigo.trim()}» o lo libere.`}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="boton grande" disabled={busy || !lista} onClick={() => void lanzar()}>{busy ? 'Lanzando…' : confirmar ? 'Sí, lanzar' : '🚀 Lanzar pregunta'}</button>
      </section>
    </>
  );
}

function Resultados({ id, codigo, onNueva, onCambio }: { id: string; codigo?: string; onNueva: () => void; onCambio: () => void }) {
  const [r, setR] = useState<Resultado | null>(null);
  const [offset, setOffset] = useState(0);
  const [, setTic] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    try {
      const d = await rpc<Resultado>('poll_results', { p_poll: id });
      setOffset(new Date(d.server_now).getTime() - Date.now());
      setR(d); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);
  useEffect(() => {
    void cargar();
    const t = window.setInterval(() => void cargar(), 3_000);
    const s = window.setInterval(() => setTic((x) => x + 1), 1_000);
    return () => { window.clearInterval(t); window.clearInterval(s); };
  }, [cargar]);
  if (!r) return <p className="tenue">{error ?? 'Cargando…'}</p>;
  const pct = porcentajes(r.conteo);
  const quedan = segundosRestantes(r.closes_at, offset);
  const abierta = r.abierta && quedan > 0;
  const faltan = r.estudiantes.filter((e) => !e.respondio && !e.salio);
  const salieron = r.estudiantes.filter((e) => e.salio);
  return (
    <>
      <section className="tarjeta resumen">
        <p className="tenue">{abierta ? `ABIERTA · quedan ${Math.floor(quedan / 60)}:${String(quedan % 60).padStart(2, '0')}` : 'CERRADA'}</p>
        <p className="cifra">{r.respondieron}<span className="tenue"> / {r.destinatarios}</span></p>
        <p className="tenue">respondieron · {r.vieron} la vieron{r.salieron ? ` · ${r.salieron} salieron` : ''}</p>
        {r.lock_on_leave && codigo && <p className="aviso">🔒 Código de desbloqueo: <strong>{codigo}</strong></p>}
      </section>
      <section className="tarjeta">
        <p className="nombre">{r.question}</p>
        {r.options.map((o, i) => (
          <div key={i} className="opcion-resultado">
            <p className={r.correct === i ? 'verde' : ''}>{LETRA[i]}) {o}{r.correct === i ? ' ✓' : ''} <span className="tenue">· {r.conteo[i]} ({pct[i]} %)</span></p>
            <div className="barra"><div style={{ width: `${pct[i]}%`, background: r.correct === i ? 'var(--verde)' : undefined }} /></div>
          </div>
        ))}
        {r.explanation && <p className="tenue">💡 {r.explanation}</p>}
      </section>
      {error && <p className="error">{error}</p>}
      <div className="fila">
        {abierta
          ? <button className="boton secundario" onClick={() => void rpc('poll_close', { p_poll: id }).then(cargar)}>Cerrar pregunta</button>
          : <button className="boton" onClick={onNueva}>Nueva pregunta</button>}
      </div>
      {salieron.length > 0 && (
        <section className="grupo">
          <div className="grupo-cab">
            <h2>🔒 SALIERON SIN RESPONDER ({salieron.length})</h2>
            {salieron.some((e) => e.bloqueado) && (
              <button className="boton pequeno" onClick={() => void rpc('poll_release_all', { p_poll: id }).then(() => { void cargar(); onCambio(); })}>Liberar a todos</button>
            )}
          </div>
          {salieron.map((e) => (
            <p key={e.user_id} className="tarjeta">{e.nombre} <span className="tenue">· {new Date(e.salio!).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{e.bloqueado ? ' · bloqueado' : ' · ya liberado'}</span></p>
          ))}
        </section>
      )}
      {abierta && faltan.length > 0 && (
        <section className="grupo">
          <h2>AÚN NO RESPONDEN ({faltan.length})</h2>
          <p className="tenue">{faltan.map((e) => `${e.nombre}${e.vio ? '' : ' (no la ha visto)'}`).join(' · ')}</p>
        </section>
      )}
    </>
  );
}
