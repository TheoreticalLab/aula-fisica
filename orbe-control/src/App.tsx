/**
 * ORBE CONTROL — una sola pantalla: estudiantes en línea (únicos), filtro, buscador y mensajes emergentes.
 * Todo dato sale de funciones de Supabase que exigen ser profesor; esta interfaz no decide permisos.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configurado, ingresar, rpc, supabase } from './supabase';
import { Asistencia } from './Asistencia';
import { agrupar, combinarTodos, edadSenal, estadoSync, filtrar, haceTexto, personalizar, primerNombre, unicos, type Alumno, type EnLinea, type Fila } from './logica';
import { pedirIA } from './ia';
import { Pulso } from './Pulso';
import { Pregunta } from './Pregunta';

type Tipo = 'informativo' | 'importante' | 'urgente' | 'bloqueo';
interface Bloqueo { id: string; full_name: string; student_code: string | null; body: string; created_at: string; failed_attempts: number }
interface Historial { id: string; body: string; kind: Tipo; created_at: string; total: number; pendientes: number; recibidos: number; confirmados: number; expirados: number }
// alcance: 'conectados' = solo quienes están en línea ahora (decidido en el servidor); 'todos' = todos los
// estudiantes, conectados o no (los desconectados verán el mensaje al entrar al aula)
type Alcance = 'conectados' | 'todos';
type Destino =
  | { tipo: 'uno'; alumno: Fila }
  | { tipo: 'seccion'; class_id: string; titulo: string; n: number; alcance: Alcance }
  | { tipo: 'todos'; n: number; alcance: Alcance };

const SECCION: Record<string, string> = { teoria: 'Teoría', ejemplos: 'Ejemplos', practica: 'Práctica', comprension: 'Comprensión', simulacion: 'Simulación', formulas: 'Fórmulas', actividad: 'Actividad', intento: 'Resolviendo una actividad' };

function Login() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await ingresar(id, pw);
      if (r.must_change_password) setError('Debe cambiar su contraseña en el aula virtual antes de usar Orbe Control.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPw('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="centro">
      <form className="tarjeta login" onSubmit={enviar}>
        <img src="icons/icon-192.png" alt="" width="64" height="64" />
        <h1>ORBE CONTROL</h1>
        <p className="tenue">Acceso exclusivo del profesor. Use su ID y contraseña del aula virtual.</p>
        <label>ID de usuario<input autoComplete="username" autoCapitalize="none" spellCheck={false} required value={id} onChange={(e) => setId(e.target.value)} /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <button className="boton grande" disabled={busy}>{busy ? 'Verificando…' : 'Ingresar'}</button>
      </form>
    </main>
  );
}

/** Redactar con Claude: el profesor escribe lo esencial y recibe el mensaje bien redactado (sin nombres: usa {nombre}). */
function AyudaIA({ tipo, onTexto }: { tipo: Tipo; onTexto: (t: string) => void }) {
  const [abierta, setAbierta] = useState(false);
  const [notas, setNotas] = useState('');
  const [nombre, setNombre] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (tipo === 'bloqueo') return null;
  if (!abierta) return <button className="boton secundario pequeno" onClick={() => setAbierta(true)}>✨ Redactar con IA</button>;
  async function redactar() {
    setBusy(true); setError(null); setInfo(null);
    try {
      const r = await pedirIA<string>({ action: 'redactar', notas, tono: tipo, personalizar: nombre });
      onTexto(r.resultado);
      setInfo(r.simulado ? 'Simulador: active las llamadas reales en el panel de Orbe IA para un texto de verdad.' : 'Revise el mensaje antes de enviarlo.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tarjeta ia">
      <label>Qué quiere decir (lo esencial; sin nombres de estudiantes)
        <textarea rows={2} maxLength={800} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej.: parcial jueves 8 am, temas 3 y 4, traer calculadora" />
      </label>
      <label className="casilla"><input type="checkbox" checked={nombre} onChange={(e) => setNombre(e.target.checked)} /> Personalizar con el nombre de cada estudiante</label>
      <div className="fila">
        <button className="boton pequeno" disabled={busy || notas.trim().length < 3} onClick={() => void redactar()}>{busy ? 'Redactando…' : '✨ Redactar'}</button>
      </div>
      {info && <p className="tenue pequeno">{info}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Redactar({ destino, onCerrar, onEnviado, destinatarios }: {
  destino: Destino; onCerrar: () => void; onEnviado: (msg: string) => void; destinatarios: (d: Destino) => Promise<{ user_id: string; full_name: string }[]>;
}) {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<Tipo>('importante');
  const [codigo, setCodigo] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colectivo = destino.tipo !== 'uno';
  const conNombre = texto.includes('{nombre}');
  async function enviar() {
    if (conNombre && tipo === 'bloqueo') return setError('El bloqueo de pantalla no admite {nombre}.');
    if ((colectivo || tipo === 'bloqueo') && !confirmar) return setConfirmar(true);
    setBusy(true);
    setError(null);
    try {
      // mensaje personalizado: cada estudiante recibe su copia con su nombre (Claude no lo vio)
      if (conNombre) {
        const lista = destino.tipo === 'uno' ? [{ user_id: destino.alumno.user_id, full_name: destino.alumno.full_name }] : await destinatarios(destino);
        if (!lista.length) throw new Error('No hay destinatarios.');
        let n = 0;
        for (const a of lista) {
          await rpc('send_live_message', { p_kind: tipo, p_body: personalizar(texto, primerNombre(a.full_name)), p_mode: 'seleccion', p_users: [a.user_id], p_class: null,
            p_expires_minutes: destino.tipo !== 'uno' && destino.alcance === 'todos' ? 10080 : 1440 });
          n++;
        }
        onEnviado(`Mensaje personalizado guardado para ${n} estudiante(s).`);
        return;
      }
      if (tipo === 'bloqueo') {
        const b = await rpc<{ locked: number }>('send_screen_lock', {
          p_body: texto,
          p_code: codigo,
          p_mode: destino.tipo === 'uno' ? 'seleccion' : destino.alcance === 'conectados' ? 'conectados' : destino.tipo === 'seccion' ? 'seccion' : 'todos',
          p_users: destino.tipo === 'uno' ? [destino.alumno.user_id] : null,
          p_class: destino.tipo === 'seccion' ? destino.class_id : null,
        });
        onEnviado(`Pantalla bloqueada a ${b.locked} estudiante(s). Código: ${codigo.trim()}`);
        return;
      }
      const r =
        destino.tipo === 'uno'
          ? await rpc<{ recipients: number }>('send_live_message', { p_kind: tipo, p_body: texto, p_mode: 'seleccion', p_users: [destino.alumno.user_id], p_class: null, p_expires_minutes: 1440 })
          : destino.alcance === 'conectados'
            ? await rpc<{ recipients: number }>('send_live_message_online', { p_kind: tipo, p_body: texto, p_class: destino.tipo === 'seccion' ? destino.class_id : null, p_expires_minutes: 1440 })
            : await rpc<{ recipients: number }>('send_live_message', {
                p_kind: tipo, p_body: texto, p_mode: destino.tipo === 'seccion' ? 'seccion' : 'todos', p_users: null,
                p_class: destino.tipo === 'seccion' ? destino.class_id : null, p_expires_minutes: 10080,
              });
      onEnviado(`Mensaje guardado para ${r.recipients} estudiante(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConfirmar(false);
    } finally {
      setBusy(false);
    }
  }
  const quien = (n: number, alc: Alcance) => (alc === 'conectados' ? `${n} conectado(s)` : `${n} estudiante(s), conectados o no`);
  const titulo =
    destino.tipo === 'uno'
      ? `${destino.alumno.full_name}${destino.alumno.online ? '' : ' (desconectado: lo verá al entrar al aula)'}`
      : destino.tipo === 'seccion'
        ? `${destino.titulo} · ${quien(destino.n, destino.alcance)}`
        : `${destino.alcance === 'conectados' ? 'Todos los conectados' : 'Todos mis estudiantes'} · ${quien(destino.n, destino.alcance)}`;
  return (
    <div className="velo" onClick={onCerrar}>
      <div className="tarjeta modal" role="dialog" aria-modal="true" aria-label="Enviar mensaje" onClick={(e) => e.stopPropagation()}>
        <h2>ENVIAR MENSAJE</h2>
        <p><span className="tenue">Destinatario:</span> {titulo}</p>
        {destino.tipo === 'uno' && <p><span className="tenue">Sección:</span> {destino.alumno.course_title} — {destino.alumno.class_name}</p>}
        <label>Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
            <option value="informativo">Informativo (aviso breve)</option>
            <option value="importante">Importante (pide «Entendido»)</option>
            <option value="urgente">Urgente (destacado hasta confirmar)</option>
            <option value="bloqueo">🔒 Bloqueo con código</option>
          </select>
        </label>
        <AyudaIA tipo={tipo} onTexto={(t) => { setTexto(t); setConfirmar(false); }} />
        <label>Mensaje<textarea rows={4} maxLength={tipo === 'bloqueo' ? 1000 : 2000} autoFocus value={texto} onChange={(e) => { setTexto(e.target.value); setConfirmar(false); }} /></label>
        {conNombre && tipo !== 'bloqueo' && <p className="tenue pequeno">{'{nombre}'} se sustituirá por el nombre de cada estudiante (cada uno recibe su copia).</p>}
        {tipo === 'bloqueo' && (
          <label>Código de desbloqueo (anótelo: se guarda cifrado)
            <input maxLength={32} autoComplete="off" value={codigo} onChange={(e) => { setCodigo(e.target.value); setConfirmar(false); }} />
          </label>
        )}
        {confirmar && (
          <p className="aviso">
            {tipo === 'bloqueo'
              ? `¿Bloquear la pantalla de ${destino.tipo === 'uno' ? 1 : destino.n} estudiante(s)? Solo se quitará con el código «${codigo.trim()}» o si usted lo libera.`
              : `¿Enviar este mensaje a ${destino.tipo === 'uno' ? 1 : destino.n} estudiante(s)? Los destinatarios exactos los determina el servidor en el momento del envío.`}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <div className="fila">
          <button className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={busy || !texto.trim() || (tipo === 'bloqueo' && codigo.trim().length < 4)} onClick={() => void enviar()}>
            {busy ? 'Enviando…' : confirmar ? (tipo === 'bloqueo' ? 'Sí, bloquear' : 'Sí, enviar') : tipo === 'bloqueo' ? 'Bloquear pantalla' : 'Enviar mensaje'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({ nombre }: { nombre: string }) {
  const [lista, setLista] = useState<EnLinea[]>([]);
  const [offset, setOffset] = useState(0);
  const [ultimaOk, setUltimaOk] = useState<number | null>(null);
  const [red, setRed] = useState(navigator.onLine);
  const [, setTic] = useState(0);
  const [seccion, setSeccion] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [destino, setDestino] = useState<Destino | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [vista, setVista] = useState<'conectados' | 'todos' | 'asistencia' | 'pulso' | 'pregunta'>('conectados');
  // alertas de seguridad graves (solo administrador: para cualquier otro, el servidor rechaza y no se muestra nada)
  const [alertas, setAlertas] = useState<{ regla: string; sujeto: string; severidad: string }[]>([]);
  useEffect(() => {
    const cargarAlertas = () =>
      Promise.all([
        rpc<{ regla: string; sujeto: string; severidad: string }[]>('sec_detections', { p_hours: 24 }),
        // «fallaron y luego entraron» con contexto nunca visto (si la migración aún no está aplicada, se ignora)
        rpc<{ login_id: string; nivel: string }[]>('sec_access_after_failures', { p_days: 1 })
          .then((d) => d.map((x) => ({ regla: 'acceso_tras_fallos', sujeto: x.login_id, severidad: x.nivel })))
          .catch(() => []),
      ])
        .then(([a, b]) => setAlertas([...a, ...b].filter((x) => x.severidad === 'alta' || x.severidad === 'critica')))
        .catch(() => setAlertas([]));
    void cargarAlertas();
    const t = window.setInterval(cargarAlertas, 120_000);
    return () => window.clearInterval(t);
  }, []);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [ultimas, setUltimas] = useState<Map<string, string | null>>(new Map());
  const espera = useRef<number | undefined>(undefined);

  // todos mis estudiantes y su última señal conocida (para la vista «Todos»)
  const cargarTodos = useCallback(async () => {
    try {
      const [als, pres] = await Promise.all([
        rpc<Alumno[]>('my_messageable_students'),
        rpc<{ user_id: string; last_seen: string | null }[]>('live_presence'),
      ]);
      setAlumnos(als);
      setUltimas(new Map(pres.map((p) => [p.user_id, p.last_seen])));
    } catch {
      /* sin conexión */
    }
  }, []);
  useEffect(() => {
    if (vista !== 'todos') return;
    void cargarTodos();
    const t = window.setInterval(() => void cargarTodos(), 60_000);
    return () => window.clearInterval(t);
  }, [vista, cargarTodos]);

  const cargar = useCallback(async () => {
    try {
      const filas = await rpc<(EnLinea & { server_now: string })[]>('control_online');
      if (filas.length) setOffset(new Date(filas[0].server_now).getTime() - Date.now());
      setLista(filas);
      setUltimaOk(Date.now());
    } catch {
      /* se muestra «Reconectando…» por la edad de la última consulta correcta */
    }
  }, []);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const cargarHistorial = useCallback(async () => {
    try {
      setHistorial(await rpc<Historial[]>('live_message_history', { p_user: null, p_limit: 8 }));
      setBloqueos(await rpc<Bloqueo[]>('active_screen_locks'));
    } catch {
      /* sin conexión */
    }
  }, []);
  const pronto = useCallback(() => {
    window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => void cargar(), 600);
  }, [cargar]);

  useEffect(() => {
    void cargar();
    void cargarHistorial();
    // Realtime: cada conexión/desconexión de un estudiante (RLS: solo los míos) y cada cambio de estado de un mensaje
    const canal = supabase
      .channel('orbe-control')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presence_connections' }, pronto)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_message_recipients' }, () => void cargarHistorial())
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') void cargar();
      });
    const t1 = window.setInterval(() => void cargar(), 10_000); // respaldo si Realtime se interrumpe
    const t2 = window.setInterval(() => setTic((x) => x + 1), 1_000); // «hace X segundos» y caducidad
    const t3 = window.setInterval(() => void cargarHistorial(), 20_000);
    const on = () => { setRed(true); void cargar(); };
    const off = () => setRed(false);
    const vis = () => document.visibilityState === 'visible' && void cargar();
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', vis);
    return () => {
      void supabase.removeChannel(canal);
      [t1, t2, t3].forEach((t) => window.clearInterval(t));
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [cargar, cargarHistorial, pronto]);

  // destinatarios de un mensaje personalizado ({nombre}): los conectados ahora o todos los de la sección
  const destinatarios = useCallback(async (d: Destino) => {
    if (d.tipo === 'uno') return [{ user_id: d.alumno.user_id, full_name: d.alumno.full_name }];
    const base = d.alcance === 'conectados' ? filtrar(lista, '', '', offset) : await rpc<Alumno[]>('my_messageable_students');
    const unicosPorId = new Map<string, { user_id: string; full_name: string }>();
    for (const a of base) if (d.tipo === 'todos' || a.class_id === d.class_id) unicosPorId.set(a.user_id, { user_id: a.user_id, full_name: a.full_name });
    return [...unicosPorId.values()];
  }, [lista, offset]);
  const estado = estadoSync(ultimaOk, red);
  const secciones = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of [...lista, ...alumnos]) m.set(e.class_id, `${e.course_title} — ${e.class_name}`);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [lista, alumnos]);
  const vigentes = filtrar(lista, '', '', offset);
  const total = unicos(vigentes);
  const filas: Fila[] =
    vista === 'conectados'
      ? filtrar(lista, seccion, busqueda, offset).map((e) => ({ ...e, online: true }))
      : combinarTodos(alumnos, lista, ultimas, seccion, busqueda, offset);
  const grupos = agrupar(filas);
  const totalTodos = new Set(alumnos.map((a) => a.user_id)).size;
  const ultimaVez = (iso: string) => {
    if (!iso) return 'Sin conexiones registradas';
    const s = edadSenal(iso, offset);
    if (s < 86400) return `Última conexión ${haceTexto(s)}`;
    return `Última conexión: ${new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })}`;
  };

  return (
    <main className="panel">
      <header className="cabecera">
        <h1>ORBE CONTROL</h1>
        <button className="enlace" onClick={() => void supabase.auth.signOut()}>Salir</button>
      </header>
      <p className={`estado ${estado}`}>{estado === 'conectado' ? '🟢 Sistema conectado' : '🔴 Conexión interrumpida. Reconectando…'}</p>
      {alertas.length > 0 && (
        <a className="aviso alerta" href="../#/docente/seguridad">
          ⚠ {alertas.length} alerta(s) de seguridad grave(s) en 24 h ({[...new Set(alertas.map((a) => a.sujeto))].slice(0, 3).join(', ')}). Revisar en el Centro de seguridad →
        </a>
      )}
      <section className={`tarjeta resumen ${estado === 'conectado' ? '' : 'viejo'}`}>
        <p className="tenue">ESTUDIANTES EN LÍNEA</p>
        <p className="cifra">{estado === 'conectado' ? total : '—'}</p>
        {vista === 'conectados' ? (
          <button className="boton" disabled={estado !== 'conectado' || total === 0} onClick={() => setDestino({ tipo: 'todos', n: total, alcance: 'conectados' })}>Enviar mensaje a todos los conectados ({total})</button>
        ) : (
          <button className="boton" disabled={estado !== 'conectado' || totalTodos === 0} onClick={() => setDestino({ tipo: 'todos', n: totalTodos, alcance: 'todos' })}>Enviar mensaje a todos mis estudiantes ({totalTodos})</button>
        )}
      </section>
      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={vista === 'conectados'} className={vista === 'conectados' ? 'activa' : ''} onClick={() => setVista('conectados')}>🟢 Conectados ({total})</button>
        <button role="tab" aria-selected={vista === 'todos'} className={vista === 'todos' ? 'activa' : ''} onClick={() => setVista('todos')}>👥 Todos{totalTodos ? ` (${totalTodos})` : ''}</button>
        <button role="tab" aria-selected={vista === 'asistencia'} className={vista === 'asistencia' ? 'activa' : ''} onClick={() => setVista('asistencia')}>📋 Asistencia</button>
        <button role="tab" aria-selected={vista === 'pulso'} className={vista === 'pulso' ? 'activa' : ''} onClick={() => setVista('pulso')}>📊 Pulso</button>
        <button role="tab" aria-selected={vista === 'pregunta'} className={vista === 'pregunta' ? 'activa' : ''} onClick={() => setVista('pregunta')}>❓ Pregunta</button>
      </div>
      {vista === 'pulso' ? <Pulso secciones={secciones} /> : vista === 'pregunta' ? <Pregunta secciones={secciones} conectados={total} onCambio={() => void cargarHistorial()} /> : vista === 'asistencia' ? <Asistencia /> : <>
      <div className="filtros">
        <select aria-label="Filtrar por sección" value={seccion} onChange={(e) => setSeccion(e.target.value)}>
          <option value="">Todas las secciones</option>
          {secciones.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
        </select>
        <input type="search" placeholder="Buscar estudiante…" aria-label="Buscar estudiante" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      {aviso && <p className="ok" onClick={() => setAviso(null)}>{aviso}</p>}

      <div className={estado === 'conectado' ? '' : 'viejo'}>
        {grupos.length === 0 && (
          <p className="vacio">
            {estado !== 'conectado' ? 'Esperando datos actualizados…' : vista === 'conectados' ? 'No hay estudiantes conectados en este momento.' : 'No hay estudiantes que coincidan.'}
          </p>
        )}
        {grupos.map((g) => {
          const enLineaGrupo = g.alumnos.filter((a) => a.online).length;
          return (
            <section key={g.clave} className="grupo">
              <div className="grupo-cab">
                <h2>{g.titulo.toUpperCase()}{vista === 'todos' ? ` · ${enLineaGrupo}/${g.alumnos.length} en línea` : ''}</h2>
                <button className="boton pequeno" disabled={estado !== 'conectado'}
                  onClick={() => setDestino({ tipo: 'seccion', class_id: g.class_id, titulo: g.titulo, n: g.alumnos.length, alcance: vista })}>
                  Enviar a los {g.alumnos.length}
                </button>
              </div>
              {g.alumnos.map((a) => {
                const act = a.lesson_title ? `${a.lesson_title}${a.section ? ` · ${SECCION[a.section] ?? a.section}` : ''}` : a.activity_title ?? (a.section ? SECCION[a.section] ?? '' : '');
                return (
                  <article key={`${g.clave}-${a.user_id}`} className={`tarjeta alumno ${a.online ? '' : 'fuera'}`}>
                    <div>
                      <p className="nombre"><span className={a.online ? 'punto' : 'punto apagado'} aria-hidden="true" /> {a.full_name || 'Sin nombre'}</p>
                      <p className="tenue">Matrícula: {a.student_code ?? '—'} · <a href={`../#/docente/estudiantes/${a.user_id}`} target="_blank" rel="noreferrer">Ficha completa</a></p>
                      {a.online ? (
                        <p className="tenue">En línea · Última señal {haceTexto(edadSenal(a.last_seen, offset))}{a.visible ? '' : ' · aula en segundo plano'}{a.conexiones > 1 ? ` · ${a.conexiones} dispositivos/pestañas` : ''}</p>
                      ) : (
                        <p className="tenue">Desconectado · {ultimaVez(a.last_seen)}</p>
                      )}
                      {a.online && act && <p className="tenue">{act}</p>}
                    </div>
                    <button className={a.online ? 'boton' : 'boton secundario'} disabled={estado !== 'conectado'} onClick={() => setDestino({ tipo: 'uno', alumno: a })}>Enviar mensaje</button>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      </>}

      {bloqueos.length > 0 && (
        <section className="grupo">
          <h2>🔒 PANTALLAS BLOQUEADAS ({bloqueos.length})</h2>
          {bloqueos.map((b) => (
            <article key={b.id} className="tarjeta alumno">
              <div>
                <p className="nombre">{b.full_name || b.student_code}</p>
                <p className="tenue">{b.body}</p>
                <p className="tenue">{b.failed_attempts ? `${b.failed_attempts} intento(s) fallido(s)` : 'Sin intentos fallidos'}</p>
              </div>
              <button className="boton secundario" onClick={() => void rpc('release_screen_lock', { p_lock: b.id }).then(cargarHistorial)}>Liberar</button>
            </article>
          ))}
        </section>
      )}
      {historial.length > 0 && (
        <section className="grupo">
          <h2>ÚLTIMOS MENSAJES</h2>
          {historial.map((h) => (
            <article key={h.id} className="tarjeta mensaje">
              <p>{h.body}</p>
              <p className="tenue">
                {new Date(h.created_at).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })} · ✓ guardado ·{' '}
                <span className="verde">{h.confirmados} confirmado(s)</span> · {h.recibidos} recibido(s) sin confirmar · {h.pendientes} pendiente(s){h.expirados ? ` · ${h.expirados} expirado(s)` : ''}
              </p>
            </article>
          ))}
          <p className="tenue pequeno">«Recibido» = el aula del estudiante lo mostró. «Confirmado» = pulsó «Entendido».</p>
        </section>
      )}
      <p className="tenue pie">{nombre} · Conectado ≠ atento: solo indica que el aula está abierta.</p>
      {destino && <Redactar destino={destino} destinatarios={destinatarios} onCerrar={() => setDestino(null)} onEnviado={(m) => { setDestino(null); setAviso(m); void cargarHistorial(); }} />}
    </main>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [acceso, setAcceso] = useState<{ ok: boolean; nombre: string } | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    setAcceso(null);
    if (session) void rpc<{ ok: boolean; nombre: string }>('control_access').then(setAcceso).catch(() => setAcceso({ ok: false, nombre: '' }));
  }, [session]);

  if (!configurado) return <main className="centro"><p className="error">Falta la configuración de Supabase.</p></main>;
  if (session === undefined || (session && !acceso)) return <main className="centro"><p className="tenue">Cargando…</p></main>;
  if (!session) return <Login />;
  if (!acceso?.ok) {
    return (
      <main className="centro">
        <div className="tarjeta login">
          <h1>ORBE CONTROL</h1>
          <p className="error">Acceso exclusivo del profesorado.</p>
          <button className="boton" onClick={() => void supabase.auth.signOut()}>Salir</button>
        </div>
      </main>
    );
  }
  return <Panel nombre={acceso.nombre} />;
}
