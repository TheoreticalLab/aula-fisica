/**
 * ORBE CONTROL · «PES» (migraciones 74 y 75): prácticas extraordinarias secuenciales desde el teléfono.
 *  · Crear y configurar (fechas, parámetros, política del control presencial), comprobar la carga temporal, publicar,
 *    publicar resultados y cerrar. Los ejercicios se preparan en el aula (Panel docente → sección → Prácticas extraordinarias).
 *  · Monitor con filtros e historial de cada estudiante (indicadores para revisar, no pruebas).
 *  · Control presencial: elegir un ejercicio ya realizado, ver sus respuestas y un ejercicio equivalente (números nuevos
 *    para las variantes o preguntas del banco de la misma lección, con su respuesta), aplicarlo en persona y registrar C.
 *  · Calibración: tiempos medidos por apartado y, en borrador, usar la mediana como T_ref.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { rpc } from './supabase';
import { analizarCarga, compararTiempos, factorControl } from '../../src/lib/pes';
import { ESTADO_MONITOR, enApartadoS, filtrarMonitor, fmtDuracion, indicadores, porcentaje, resumenMonitor, type DatosMonitor, type FilaMonitor } from '../../src/lib/pesMonitor';
import type {
  ApartadoControl, ControlListaItem, ControlPreparado, DetallePes, HistorialPes, InformeTiemposServidor, PesListaItem, PoliticaControlPes, PuntajeServidor,
} from '../../src/api/pesTipos';
import { claveConcreta, parametrosVariante } from '../../supabase/functions/_shared/calificacion/variante.ts';
import { describeKey } from '../../supabase/functions/_shared/calificacion/calificar.ts';
import { sustituirParametros } from '../../supabase/functions/_shared/calificacion/marcadores.ts';
import type { AnswerKey, NumericKey } from '../../supabase/functions/_shared/calificacion/tipos.ts';

type Vista = 'monitor' | 'control' | 'configurar' | 'calibrar';
const pts = (x: number | null | undefined) => (x === null || x === undefined ? '—' : (Math.round(x * 100 + 1e-7) / 100).toFixed(2).replace('.', ','));
const seg = (s: number) => (s >= 120 ? `${(Math.round(s / 6) / 10).toString().replace('.', ',')} min` : `${Math.round(s)} s`);
const msg = (e: unknown) => {
  const t = e instanceof Error ? e.message : String(e);
  return /Could not find the function|PGRST202|schema cache/i.test(t) ? 'Falta instalar las migraciones 74 y 75 en el servidor.' : t;
};
const aLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const ESTADO_PES: Record<PesListaItem['estado'], string> = { borrador: 'Borrador', publicada: 'Publicada', cerrada: 'Cerrada', archivada: 'Archivada' };

export function PesOrbe({ secciones }: { secciones: [string, string][] }) {
  const [seccion, setSeccion] = useState(secciones[0]?.[0] ?? '');
  const [lista, setLista] = useState<PesListaItem[] | null>(null);
  const [sel, setSel] = useState('');
  const [vista, setVista] = useState<Vista>('monitor');
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [cierre, setCierre] = useState('');

  const cargar = useCallback(async () => {
    if (!seccion) return;
    setError(null);
    try { const l = await rpc<PesListaItem[]>('pes_lista_docente', { p_class: seccion }); setLista(l); setSel((s) => (l.some((x) => x.id === s) ? s : l[0]?.id ?? '')); }
    catch (e) { setLista(null); setError(msg(e)); }
  }, [seccion]);
  useEffect(() => { void cargar(); }, [cargar]);
  const actual = lista?.find((x) => x.id === sel) ?? null;

  return (
    <div>
      <div className="filtros">
        <select aria-label="Sección" value={seccion} onChange={(e) => setSeccion(e.target.value)}>
          {secciones.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
        </select>
        {lista && lista.length > 0 && (
          <select aria-label="Práctica extraordinaria" value={sel} onChange={(e) => setSel(e.target.value)}>
            {lista.map((p) => <option key={p.id} value={p.id}>{p.titulo} · {ESTADO_PES[p.estado]}</option>)}
          </select>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <details className="tarjeta">
        <summary>➕ Nueva práctica extraordinaria</summary>
        <form onSubmit={async (e) => {
          e.preventDefault(); setError(null);
          try {
            const id = await rpc<string>('pes_crear', { p_class: seccion, p: { titulo: titulo.trim(), cierra_at: cierre ? new Date(cierre).toISOString() : null } });
            setTitulo(''); setCierre(''); await cargar(); setSel(id); setVista('configurar');
          } catch (x) { setError(msg(x)); }
        }}>
          <label>Título <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} required /></label>
          <label>Fecha límite <input type="datetime-local" value={cierre} onChange={(e) => setCierre(e.target.value)} /></label>
          <p className="tenue">Valores por defecto: P_max 8, α = 2, avance anticipado al 50 %, espera = 1,20 × T_ref. Los ejercicios se preparan en el aula.</p>
          <button className="boton" disabled={!titulo.trim()}>Crear borrador</button>
        </form>
      </details>
      {lista && lista.length === 0 && <p className="vacio">Esta sección no tiene prácticas extraordinarias.</p>}
      {actual && (
        <>
          <div className="pestanas" role="tablist">
            {(['monitor', 'control', 'configurar', 'calibrar'] as Vista[]).map((v) => (
              <button key={v} role="tab" aria-selected={vista === v} className={vista === v ? 'activa' : ''} onClick={() => setVista(v)}>
                {{ monitor: '📈 Monitor', control: '🧑‍🏫 Control presencial', configurar: '⚙️ Configurar', calibrar: '⏱️ Tiempos' }[v]}
              </button>
            ))}
          </div>
          {vista === 'monitor' && <Monitor practica={actual.id} />}
          {vista === 'control' && <ControlPresencial practica={actual.id} />}
          {vista === 'configurar' && <Configurar practica={actual.id} onCambio={cargar} />}
          {vista === 'calibrar' && <Calibrar practica={actual.id} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
function Monitor({ practica }: { practica: string }) {
  const [d, setD] = useState<DatosMonitor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<FilaMonitor['estado'] | ''>('');
  const [solo, setSolo] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [desfase, setDesfase] = useState(0);
  const [, setTic] = useState(0);
  const cargar = useCallback(async () => {
    try { const x = await rpc<DatosMonitor>('pes_monitor', { p_practica: practica }); setD(x); setDesfase(Date.parse(x.ahora) - Date.now()); setError(null); }
    catch (e) { setError(msg(e)); }
  }, [practica]);
  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), 20000), r = setInterval(() => setTic((x) => x + 1), 1000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [cargar]);
  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="tenue">Cargando…</p>;
  if (d.practica.estado === 'borrador') return <p className="vacio">La práctica está en borrador: publíquela para ver el avance.</p>;
  const ahora = Date.now() + desfase;
  const total = d.practica.apartados;
  const r = resumenMonitor(d);
  const filas = filtrarMonitor(d.estudiantes, { texto, estado, conIndicadores: solo }, total, ahora);
  return (
    <div>
      <section className="tarjeta">
        <p className="tenue">{d.practica.ejercicios} ejercicios · {total} apartados · se actualiza cada 20 s</p>
        <p>{r.asignados} asignados · {r.sinEmpezar} sin empezar · {r.enCurso} en curso · {r.terminadas} terminadas · {r.vencidas} plazo terminado
          {r.pendientesRevision > 0 && <> · <strong>{r.pendientesRevision} por revisar</strong></>}</p>
        <p className="tenue">Los indicadores son para revisar: no son pruebas de fraude ni de uso de IA.</p>
      </section>
      <div className="filtros">
        <input placeholder="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <select value={estado} onChange={(e) => setEstado(e.target.value as FilaMonitor['estado'] | '')}>
          <option value="">Todos</option>
          {Object.entries(ESTADO_MONITOR).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <label className="casilla"><input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} /> Con indicadores</label>
      </div>
      {filas.length === 0 && <p className="vacio">Nadie coincide.</p>}
      {filas.map((f) => {
        const t = enApartadoS(f, ahora);
        const ind = indicadores(f, total, ahora);
        return (
          <button key={f.user_id} className="tarjeta alumno" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => setAbierto(f.user_id)}>
            <p><strong>{f.nombre || '(sin nombre)'}</strong> · {ESTADO_MONITOR[f.estado]}{f.actual && <> · {f.actual.ejercicio}{f.actual.letra}{t !== null && <> ({seg(t)} / {seg(f.actual.t_min_s)})</>}</>}</p>
            <p className="tenue">{Math.round(porcentaje(f, total) * 100)} % · {f.ejercicios_completos} ejerc. completos · omit. {f.omitidos} · antic. {f.anticipados} · {fmtDuracion(f.tiempo_total_s)}
              {' '}· prov. {pts(f.puntaje.provisional.P)} · máx. {pts(f.puntaje.maxima_alcanzable.P)}</p>
            {ind.map((i) => <p key={i.clave} className={i.tipo === 'tecnico' ? 'advertencia' : 'tenue'}>• {i.texto}</p>)}
          </button>
        );
      })}
      {abierto && <Historial practica={practica} user={abierto} onClose={() => setAbierto(null)} />}
    </div>
  );
}

function textoResp(a: { respuesta: HistorialPes['respuestas'][number]['respuesta']; accion: string | null; opciones?: string[] | null }) {
  const r = a.respuesta;
  if (!r) return a.accion === 'omitida' ? '(omitido)' : '—';
  if (r.selected) return r.selected.map((i) => `${String.fromCharCode(97 + i)}) ${a.opciones?.[i] ?? ''}`).join('; ');
  if (typeof r.value === 'boolean') return `${r.value ? 'Verdadero' : 'Falso'}${r.justification ? ` — ${r.justification}` : ''}`;
  return r.text ?? '—';
}

function Historial({ practica, user, onClose }: { practica: string; user: string; onClose: () => void }) {
  const [h, setH] = useState<HistorialPes | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { rpc<HistorialPes>('pes_historial', { p_practica: practica, p_user: user }).then(setH).catch((e) => setError(msg(e))); }, [practica, user]);
  return (
    <div className="velo" onClick={onClose}>
      <div className="modal tarjeta" style={{ maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        {error && <p className="error">{error}</p>}
        {!h ? <p className="tenue">Cargando…</p> : (
          <>
            <p><strong>{h.estudiante.nombre}</strong></p>
            <p className="tenue">Provisional {pts(h.puntaje.provisional.P)} · validada {pts(h.puntaje.validada.P)} · máxima {pts(h.puntaje.maxima_alcanzable.P)}</p>
            {h.respuestas.map((a) => (
              <div key={a.id} className="mensaje">
                <p><strong>{a.ejercicio}{a.letra}</strong> · {a.accion === 'omitida' ? 'omitido' : a.accion === 'anticipada' ? `anticipada (m = ${a.m})` : 'a tiempo'} · {seg(Number(a.segundos))} (mín. {seg(Number(a.t_min_s))})
                  {' '}· {a.revision === 'pendiente' ? 'por revisar' : `q = ${Number(a.q).toFixed(2)}`}</p>
                <p className="tenue">{textoResp(a)}</p>
              </div>
            ))}
            {h.controles.length > 0 && <p className="tenue">Controles: {h.controles.map((c) => `ejercicio ${c.ejercicio} ${c.estado}${c.resultado !== null ? ` (${pts(Number(c.resultado))})` : ''}`).join(' · ')}</p>}
            <p className="tenue">{h.eventos.filter((e) => e.tipo === 'pegado_bloqueado').length} pegados bloqueados · {h.eventos.filter((e) => e.tipo === 'reconexion').length} reconexiones</p>
          </>
        )}
        <button className="boton secundario" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Control presencial
// ---------------------------------------------------------------------------------------------------------------
/** Números nuevos (semilla del control) y respuesta concreta de un apartado con variante: solo para el profesor. */
function versionEquivalente(a: ApartadoControl, semilla: string): { enunciado: string; respuesta: string } | null {
  const k = a.clave as unknown as NumericKey | null;
  if (!a.variante || !k?.variante) return null;
  try {
    const p = parametrosVariante(k.variante.plantilla, semilla, a.id).parametros;
    return { enunciado: sustituirParametros(a.enunciado, p), respuesta: describeKey(claveConcreta(k, semilla, a.id)) };
  } catch { return null; }
}

function ControlPresencial({ practica }: { practica: string }) {
  const [mon, setMon] = useState<DatosMonitor | null>(null);
  const [lista, setLista] = useState<ControlListaItem[]>([]);
  const [user, setUser] = useState('');
  const [h, setH] = useState<HistorialPes | null>(null);
  const [ejercicio, setEjercicio] = useState('');
  const [c, setC] = useState<ControlPreparado | null>(null);
  const [resultado, setResultado] = useState<number | null>(null);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cargar = useCallback(async () => {
    try {
      setMon(await rpc<DatosMonitor>('pes_monitor', { p_practica: practica }));
      setLista(await rpc<ControlListaItem[]>('pes_controles_lista', { p_practica: practica }));
    } catch (e) { setError(msg(e)); }
  }, [practica]);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    setH(null); setEjercicio(''); setC(null);
    if (user) rpc<HistorialPes>('pes_historial', { p_practica: practica, p_user: user }).then(setH).catch((e) => setError(msg(e)));
  }, [practica, user]);
  const ejercicios = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of h?.respuestas ?? []) if (r.accion !== 'omitida') m.set(r.ejercicio_id, r.ejercicio);
    return [...m.entries()].sort((a, b) => a[1] - b[1]);
  }, [h]);
  const hacer = async (f: () => Promise<void>) => { setBusy(true); setError(null); try { await f(); } catch (e) { setError(msg(e)); } finally { setBusy(false); } };
  const pol = mon?.practica.control_politica;
  const candidatos = (mon?.estudiantes ?? []).filter((x) => x.cerrados > x.omitidos);

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {aviso && <p className="ok" onClick={() => setAviso(null)}>{aviso}</p>}
      {pol && (
        <section className="tarjeta">
          <p className="tenue">POLÍTICA ANUNCIADA</p>
          <p>{pol.descripcion || 'Sin descripción (defínala en Configurar antes de publicar).'}</p>
          <p className="tenue">{pol.modo === 'ajuste' ? `Ajuste: P × [1 − ${String(pol.peso).replace('.', ',')}·(1 − C)]; cuenta el mejor resultado.` : 'Informativo: no cambia la puntuación.'}</p>
        </section>
      )}
      <div className="filtros">
        <select aria-label="Estudiante" value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="">Elija un estudiante con trabajo hecho…</option>
          {candidatos.map((x) => <option key={x.user_id} value={x.user_id}>{x.nombre} ({x.cerrados - x.omitidos} respondidos)</option>)}
        </select>
        {ejercicios.length > 0 && (
          <select aria-label="Ejercicio realizado" value={ejercicio} onChange={(e) => { setEjercicio(e.target.value); setC(null); }}>
            <option value="">Ejercicio realizado…</option>
            {ejercicios.map(([id, n]) => <option key={id} value={id}>Ejercicio {n}</option>)}
          </select>
        )}
      </div>
      {ejercicio && !c && (
        <button className="boton" disabled={busy} onClick={() => void hacer(async () => {
          setC(await rpc<ControlPreparado>('pes_control_preparar', { p_practica: practica, p_user: user, p_ejercicio: ejercicio })); setResultado(null); setNota('');
        })}>Preparar el control de este ejercicio</button>
      )}
      {c && (
        <>
          <section className="tarjeta">
            <p className="tenue">LO QUE RESPONDIÓ (ejercicio {c.propuesta.ejercicio.posicion}{c.propuesta.ejercicio.titulo ? ` · ${c.propuesta.ejercicio.titulo}` : ''})</p>
            {c.propuesta.ejercicio.contexto && <p className="tenue">{c.propuesta.ejercicio.contexto}</p>}
            {c.propuesta.apartados.map((a) => (
              <div key={a.id} className="mensaje">
                <p><strong>{a.letra}.</strong> {a.enunciado}</p>
                <p>Respuesta: {textoResp(a)}{a.q !== null && a.accion !== 'omitida' && ` · q = ${Number(a.q).toFixed(2)}`}</p>
              </div>
            ))}
          </section>
          <section className="tarjeta">
            <p className="tenue">EJERCICIO EQUIVALENTE (solo para usted: incluye las respuestas)</p>
            {c.propuesta.apartados.map((a) => {
              const v = versionEquivalente(a, c.semilla);
              return v ? (
                <div key={a.id} className="mensaje"><p><strong>{a.letra} con otros números.</strong> {v.enunciado}</p><p className="tenue">Respuesta: {v.respuesta}</p></div>
              ) : null;
            })}
            {c.propuesta.candidatos.length > 0 ? c.propuesta.candidatos.map((x) => (
              <div key={x.exercise_id} className="mensaje">
                <p>{x.enunciado}</p>
                <p className="tenue">{x.leccion ?? ''} · Respuesta: {(() => { try { return describeKey(x.clave as unknown as AnswerKey, x.opciones ?? undefined); } catch { return '—'; } })()}</p>
              </div>
            )) : !c.propuesta.apartados.some((a) => versionEquivalente(a, c.semilla)) && (
              <p className="tenue">No hay variantes ni preguntas del banco equivalentes: proponga oralmente un caso análogo (cambie datos o condiciones) y evalúe con la rúbrica de cada apartado.</p>
            )}
            {c.propuesta.apartados.some((a) => a.rubrica) && <p className="tenue">Rúbricas: {c.propuesta.apartados.filter((a) => a.rubrica).map((a) => `${a.letra}: ${a.rubrica}`).join(' · ')}</p>}
          </section>
          <section className="tarjeta">
            <p className="tenue">RESULTADO DEL CONTROL (C, de 0 a 1)</p>
            <div className="fila">
              {[0, 0.25, 0.5, 0.75, 1].map((x) => (
                <button key={x} className={`boton ${resultado === x ? '' : 'secundario'} pequeno`} onClick={() => setResultado(x)}>{String(x).replace('.', ',')}</button>
              ))}
            </div>
            {resultado !== null && pol?.modo === 'ajuste' && <p className="tenue">Factor si es el mejor resultado: {pts(factorControl(pol, [resultado]))}</p>}
            <textarea placeholder="Qué se comprobó y cómo respondió (queda en el registro)" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={2000} />
            <div className="fila">
              <button className="boton secundario" disabled={busy} onClick={() => void hacer(async () => {
                const m = window.prompt('Motivo para descartar este control preparado'); if (!m) return;
                await rpc('pes_control_anular', { p_control: c.id, p_motivo: m }); setC(null); await cargar();
              })}>Descartar</button>
              <button className="boton" disabled={busy || resultado === null || !nota.trim()} onClick={() => void hacer(async () => {
                const s = await rpc<PuntajeServidor>('pes_control_registrar', { p_control: c.id, p_resultado: resultado, p_nota: nota });
                setAviso(`✓ Control registrado. ${s.control.modo === 'ajuste' ? `Factor vigente ${pts(s.control.factor)} (validada con control ${pts(s.control.validada_con_control)}).` : 'Informativo.'}`);
                setC(null); setEjercicio(''); await cargar();
              })}>Registrar resultado</button>
            </div>
          </section>
        </>
      )}
      {lista.length > 0 && (
        <section className="tarjeta">
          <p className="tenue">CONTROLES DE ESTA PRÁCTICA</p>
          {lista.map((x) => (
            <p key={x.id}>{x.nombre} · ejercicio {x.ejercicio} · {x.estado}{x.resultado !== null && ` · C = ${pts(Number(x.resultado))}`}
              {x.estado === 'realizado' && <> <button className="boton secundario pequeno" disabled={busy} onClick={() => void hacer(async () => {
                const m = window.prompt('Motivo de la anulación (p. ej., estudiante equivocado)'); if (!m) return;
                await rpc('pes_control_anular', { p_control: x.id, p_motivo: m }); await cargar();
              })}>Anular</button></>}</p>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Configurar
// ---------------------------------------------------------------------------------------------------------------
function Configurar({ practica, onCambio }: { practica: string; onCambio: () => Promise<void> }) {
  const [d, setD] = useState<DetallePes | null>(null);
  const [f, setF] = useState({ titulo: '', abre: '', cierra: '', p_max: '8', alfa: '2', factor: '0.5', incremento: '0.2' });
  const [pol, setPol] = useState<PoliticaControlPes>({ modo: 'informativo', peso: 0, descripcion: '' });
  const [horas, setHoras] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cargar = useCallback(async () => {
    try {
      const x = await rpc<DetallePes>('pes_detalle_docente', { p_practica: practica });
      setD(x);
      const p = x.practica;
      setF({ titulo: p.titulo, abre: aLocal(p.abre_at), cierra: aLocal(p.cierra_at), p_max: String(p.p_max), alfa: String(p.alfa), factor: String(p.factor_anticipado), incremento: String(p.incremento) });
      setPol(p.control_politica);
    } catch (e) { setError(msg(e)); }
  }, [practica]);
  useEffect(() => { void cargar(); }, [cargar]);
  const hacer = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setError(null);
    try { await fn(); setAviso(ok); await cargar(); await onCambio(); } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };
  if (!d) return error ? <p className="error">{error}</p> : <p className="tenue">Cargando…</p>;
  const p = d.practica;
  const borrador = p.estado === 'borrador';
  const carga = analizarCarga({ tRefs: d.ejercicios.map((e) => e.apartados.map((a) => a.t_ref_s)), incremento: Number(f.incremento), abre: f.abre ? new Date(f.abre) : null,
    cierra: f.cierra ? new Date(f.cierra) : null, liberacion: p.liberacion, ahora: new Date(), horasDiarias: horas });
  const errores = carga.avisos.filter((a) => a.nivel === 'error');
  return (
    <div>
      {error && <p className="error">{error}</p>}
      {aviso && <p className="ok" onClick={() => setAviso(null)}>{aviso}</p>}
      <section className="tarjeta">
        <p className="tenue">{ESTADO_PES[p.estado].toUpperCase()} · versión {p.version} · {d.ejercicios.length} ejercicios · {d.ejercicios.reduce((s, e) => s + e.apartados.length, 0)} apartados</p>
        {d.ejercicios.length === 0 && <p className="advertencia">Sin ejercicios: prepárelos en el aula (Panel docente → sección → Prácticas extraordinarias). Una pregunta suelta no se convierte en apartados.</p>}
        <label>Título <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></label>
        <label>Apertura <input type="datetime-local" disabled={!borrador} value={f.abre} onChange={(e) => setF({ ...f, abre: e.target.value })} /></label>
        <label>Fecha límite {!borrador && '(solo ampliar)'} <input type="datetime-local" value={f.cierra} onChange={(e) => setF({ ...f, cierra: e.target.value })} /></label>
        {borrador && (
          <>
            <label>P_max <input inputMode="decimal" value={f.p_max} onChange={(e) => setF({ ...f, p_max: e.target.value })} /></label>
            <label>α <input inputMode="decimal" value={f.alfa} onChange={(e) => setF({ ...f, alfa: e.target.value })} /></label>
            <label>Factor de avance anticipado <input inputMode="decimal" value={f.factor} onChange={(e) => setF({ ...f, factor: e.target.value })} /></label>
            <label>Incremento de la espera <input inputMode="decimal" value={f.incremento} onChange={(e) => setF({ ...f, incremento: e.target.value })} /></label>
          </>
        )}
        <button className="boton" disabled={busy} onClick={() => void hacer(() => rpc('pes_editar', { p_practica: practica, p: borrador ? {
          titulo: f.titulo, abre_at: f.abre ? new Date(f.abre).toISOString() : null, cierra_at: f.cierra ? new Date(f.cierra).toISOString() : null,
          p_max: Number(f.p_max), alfa: Number(f.alfa), factor_anticipado: Number(f.factor), incremento: Number(f.incremento),
        } : { titulo: f.titulo, ...(f.cierra !== aLocal(p.cierra_at) ? { cierra_at: new Date(f.cierra).toISOString() } : {}) } }), '✓ Guardado.')}>Guardar</button>
      </section>
      <section className="tarjeta">
        <p className="tenue">CONTROL PRESENCIAL (se comunica antes de publicar)</p>
        <select disabled={!borrador} value={pol.modo} onChange={(e) => setPol({ ...pol, modo: e.target.value as PoliticaControlPes['modo'], peso: e.target.value === 'ajuste' ? pol.peso || 0.2 : 0 })}>
          <option value="informativo">Informativo</option><option value="ajuste">Ajuste P × [1 − w·(1 − C)]</option>
        </select>
        {pol.modo === 'ajuste' && <label>w (0 a 0,3) <input disabled={!borrador} inputMode="decimal" value={pol.peso} onChange={(e) => setPol({ ...pol, peso: Math.min(0.3, Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) })} /></label>}
        <textarea disabled={!borrador} placeholder="Cómo será y qué consecuencias tiene (lo lee el estudiante)" value={pol.descripcion} onChange={(e) => setPol({ ...pol, descripcion: e.target.value })} maxLength={2000} />
        {borrador && <button className="boton secundario" disabled={busy} onClick={() => void hacer(() => rpc('pes_politica_control', { p_practica: practica, p: pol }), '✓ Política guardada.')}>Guardar política</button>}
      </section>
      <section className="tarjeta">
        <p className="tenue">CARGA TEMPORAL</p>
        <p>Trabajo estimado {carga.referenciaH.toFixed(1).replace('.', ',')} h · espera mínima {carga.esperaH.toFixed(1).replace('.', ',')} h
          {carga.horasPorDia !== null && <> · {carga.horasPorDia.toFixed(1).replace('.', ',')} h/día</>}</p>
        <label>Horas diarias razonables <input type="number" min={0.5} step={0.5} value={horas} onChange={(e) => setHoras(Math.max(0.5, Number(e.target.value) || 3))} /></label>
        {carga.avisos.map((a, i) => <p key={i} className={a.nivel === 'error' ? 'error' : a.nivel === 'aviso' ? 'advertencia' : 'tenue'}>{a.texto}</p>)}
      </section>
      <section className="tarjeta">
        {borrador ? (
          <>
            <p>Publicar asigna la práctica a todos los estudiantes de la sección y congela contenido, claves, pesos, parámetros, apertura, liberación y política.</p>
            <button className="boton grande" disabled={busy || errores.length > 0 || d.ejercicios.length === 0}
              onClick={() => { if (window.confirm('¿Publicar la práctica? El contenido y la calificación quedan congelados.')) void hacer(() => rpc('pes_publicar', { p_practica: practica, p_estudiantes: null }), '✓ Publicada.'); }}>
              Publicar</button>
            {errores.length > 0 && <p className="tenue">Corrija primero los errores de carga.</p>}
          </>
        ) : (
          <div className="fila">
            <button className="boton secundario" disabled={busy} onClick={() => void hacer(() => rpc('pes_publicar_resultados', { p_practica: practica, p_publicar: !p.resultados_publicados }),
              p.resultados_publicados ? '✓ Resultados retirados.' : '✓ Resultados publicados.')}>{p.resultados_publicados ? 'Retirar resultados' : 'Publicar resultados'}</button>
            {p.estado === 'publicada' && <button className="boton secundario" disabled={busy}
              onClick={() => { if (window.confirm('¿Cerrar la práctica? Nadie podrá seguir respondiendo.')) void hacer(() => rpc('pes_cambiar_estado', { p_practica: practica, p_estado: 'cerrada' }), '✓ Cerrada.'); }}>Cerrar</button>}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Calibración de tiempos
// ---------------------------------------------------------------------------------------------------------------
function Calibrar({ practica }: { practica: string }) {
  const [inf, setInf] = useState<InformeTiemposServidor | null>(null);
  const [sel, setSel] = useState('');
  const [tiempo, setTiempo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    try { const x = await rpc<InformeTiemposServidor>('pes_informe_tiempos', { p_practica: practica }); setInf(x); setSel((s) => s || x.apartados[0]?.id || ''); }
    catch (e) { setError(msg(e)); }
  }, [practica]);
  useEffect(() => { void cargar(); }, [cargar]);
  if (!inf) return error ? <p className="error">{error}</p> : <p className="tenue">Cargando…</p>;
  const rep = compararTiempos(inf.apartados.map((a) => ({ etiqueta: `${a.ejercicio}${a.letra}`, t_ref_s: a.t_ref_s, t_min_s: Number(a.t_min_s),
    calibraciones: a.calibraciones.map((c) => Number(c.segundos)), piloto_s: a.piloto_s === null ? null : Number(a.piloto_s) })));
  const leer = (s: string) => { const m = s.trim().match(/^(\d+)(?::(\d{1,2}))?$/); return m ? (m[2] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[1])) : NaN; };
  return (
    <div>
      {error && <p className="error">{error}</p>}
      {aviso && <p className="ok" onClick={() => setAviso(null)}>{aviso}</p>}
      <section className="tarjeta">
        <p className="tenue">TIEMPO MEDIDO EN PAPEL (mm:ss)</p>
        <div className="filtros">
          <select value={sel} onChange={(e) => setSel(e.target.value)}>{inf.apartados.map((a) => <option key={a.id} value={a.id}>{a.ejercicio}{a.letra} · T_ref {seg(a.t_ref_s)}</option>)}</select>
          <input placeholder="mm:ss" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
          <button className="boton" disabled={!(leer(tiempo) > 0)} onClick={async () => {
            try { await rpc('pes_calibrar', { p_apartado: sel, p_segundos: leer(tiempo), p_fuente: 'papel', p_nota: null }); setTiempo(''); setAviso('✓ Tiempo registrado.'); await cargar(); }
            catch (e) { setError(msg(e)); }
          }}>Añadir</button>
        </div>
        <p>Esperado {fmtDuracion(rep.esperadoS)} · impuesto {fmtDuracion(rep.impuestoS)} · {rep.calibrados} de {rep.filas.length} apartados medidos</p>
        {rep.filas.map((f) => (
          <p key={f.etiqueta} className="tenue">{f.etiqueta}: T_ref {seg(f.t_ref_s)} · espera {seg(f.t_min_s)} · {f.n ? `mediana ${seg(f.mediana!)} (${f.n})` : 'sin medir'}</p>
        ))}
        {rep.avisos.filter((a) => a.nivel === 'aviso').map((a, i) => <p key={i} className="advertencia">{a.texto}</p>)}
        {inf.estado === 'borrador' && rep.calibrados > 0 && (
          <button className="boton secundario" onClick={async () => {
            try { const n = await rpc<number>('pes_aplicar_calibracion', { p_practica: practica }); setAviso(`✓ T_ref actualizado en ${n} apartado(s).`); await cargar(); }
            catch (e) { setError(msg(e)); }
          }}>Usar la mediana como T_ref</button>
        )}
      </section>
    </div>
  );
}
