/**
 * CENTRO DE DATOS — Exportación, investigación y análisis. Elige alcance, contenido, formato y modo; muestra una
 * vista previa con recuentos; genera los archivos en este dispositivo a partir de datos que el servidor entrega por
 * páginas y ya filtrados por permisos (export_*). Si algo falla, no se entrega archivo alguno.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { rpc, supabase } from './supabase';
import { exportar, ExportacionFallida, type Alcance, type Progreso } from '../../src/lib/exportacion/motor';
import { GRUPOS } from '../../src/lib/exportacion/catalogo';
import type { Formato } from '../../src/lib/exportacion/paquete';
import paquete from '../../package.json';

interface Alumno { user_id: string; full_name: string; student_code: string | null; class_id: string; class_name: string; course_id: string; course_title: string }
interface Vista { estudiantes: number; intentos: number; cursos: number; secciones: number; actividades: number; respuestas: number; eventos_telemetria: number;
  eventos_respuesta: number; eventos_pregunta: number; visitas: number; es_admin: boolean }
interface Historial { id: string; created_at: string; modo: string; tipo: string; estado: string; formatos: string[]; manifiesto_sha256: string | null; actor: string | null; error_code: string | null }

const TIPOS: [Alcance['tipo'], string][] = [
  ['estudiante', 'Un estudiante (todos sus datos)'], ['grupo', 'Grupo de estudiantes'], ['seccion', 'Sección académica'], ['curso', 'Asignatura completa'],
  ['actividad', 'Actividad o examen (todos los intentos)'], ['intento', 'Intento(s) concretos de un estudiante'], ['todo', 'Todos los datos autorizados'],
];
const CONTENIDOS = Object.entries(GRUPOS).filter(([k]) => k !== 'claves' && k !== 'academico') as [string, string][];
const FORMATOS: [Formato, string][] = [['excel', 'Excel (.xlsx)'], ['csv', 'CSV'], ['json', 'JSON Lines'], ['sqlite', 'SQLite (script .sql)']];
const MB = (b: number) => (b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : `${(b / 1e6).toFixed(1)} MB`);

export function Datos({ secciones }: { secciones: [string, string][] }) {
  const [tipo, setTipo] = useState<Alcance['tipo']>('estudiante');
  const [ids, setIds] = useState<string[]>([]);
  const [estudianteIntentos, setEstudianteIntentos] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [contenido, setContenido] = useState<string[]>(CONTENIDOS.map(([k]) => k));
  const [claves, setClaves] = useState(false);
  const [formatos, setFormatos] = useState<Formato[]>(['excel', 'csv', 'json', 'sqlite']);
  const [modo, setModo] = useState<'identificado' | 'investigacion'>('identificado');
  const [buscar, setBuscar] = useState('');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [actividades, setActividades] = useState<{ id: string; title: string; mode: string; class_id: string }[]>([]);
  const [intentos, setIntentos] = useState<{ id: string; attempt_number: number; started_at: string; status: string; mode: string; titulo: string }[]>([]);
  const [vista, setVista] = useState<Vista | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [resultado, setResultado] = useState<{ nombre: string; url: string; sha: string; tablas: Record<string, number>; advertencias: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const control = useRef<AbortController | null>(null);
  const trabajando = !!progreso && progreso.fase !== 'fin';

  useEffect(() => {
    void rpc<Alumno[]>('my_messageable_students').then(setAlumnos).catch(() => undefined);
    void rpc<Historial[]>('my_exports').then(setHistorial).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!secciones.length) return;
    void supabase.from('activities').select('id, title, mode, class_id').in('class_id', secciones.map(([id]) => id)).order('created_at', { ascending: false })
      .then(({ data }) => setActividades((data ?? []) as typeof actividades));
  }, [secciones]);
  useEffect(() => {
    setIntentos([]);
    if (tipo !== 'intento' || !estudianteIntentos) return;
    void supabase.from('attempts').select('id, attempt_number, started_at, status, mode, activity_id, lesson_id').eq('user_id', estudianteIntentos).order('started_at')
      .then(({ data }) => setIntentos(((data ?? []) as { id: string; attempt_number: number; started_at: string; status: string; mode: string; activity_id: string | null }[])
        .map((a) => ({ ...a, titulo: actividades.find((x) => x.id === a.activity_id)?.title ?? (a.activity_id ? 'Actividad' : 'Práctica libre') }))));
  }, [tipo, estudianteIntentos, actividades]);

  const unicos = useMemo(() => [...new Map(alumnos.map((a) => [a.user_id, a])).values()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')), [alumnos]);
  const cursos = useMemo(() => [...new Map(alumnos.map((a) => [a.course_id, a.course_title])).entries()], [alumnos]);
  const q = buscar.trim().toLowerCase();
  const filtrados = unicos.filter((a) => !q || a.full_name.toLowerCase().includes(q) || (a.student_code ?? '').toLowerCase().includes(q));
  const alcance: Alcance = { tipo, ids: tipo === 'todo' ? [] : ids, desde: desde || null, hasta: hasta || null };
  const listo = (tipo === 'todo' || ids.length > 0) && formatos.length > 0;
  const cambiar = (fn: () => void) => { fn(); setVista(null); setResultado(null); setError(null); };
  const alternar = (x: string) => cambiar(() => setIds(tipo === 'estudiante' ? [x] : ids.includes(x) ? ids.filter((y) => y !== x) : [...ids, x]));

  async function previsualizar() {
    setError(null);
    try {
      const v = await rpc<Vista>('export_preview', { p_alcance: alcance });
      setVista(v); setEsAdmin(v.es_admin);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function generar() {
    setError(null); setResultado(null);
    control.current = new AbortController();
    try {
      const r = await exportar({ rpc, alcance, modo, contenido, formatos, claves, version: paquete.version, alProgreso: setProgreso, senal: control.current.signal });
      const url = URL.createObjectURL(new Blob(r.partes, { type: r.tipo }));
      setResultado({ nombre: r.nombre, url, sha: r.manifiestoSha, tablas: r.manifiesto.registros_por_tabla as Record<string, number>, advertencias: r.advertencias });
      const a = document.createElement('a');
      a.href = url; a.download = r.nombre; a.click();
    } catch (e) {
      setError(e instanceof ExportacionFallida ? `${e.motivo === 'cancelada' ? 'Cancelada' : 'Exportación NO completada'}: ${e.message} No se generó ningún archivo.`
        : e instanceof Error ? e.message : String(e));
    } finally {
      setProgreso(null);
      void rpc<Historial[]>('my_exports').then(setHistorial).catch(() => undefined);
    }
  }

  const volumen = vista ? vista.eventos_telemetria * 320 + vista.respuestas * 700 + vista.eventos_respuesta * 500 + vista.visitas * 450 + vista.intentos * 400 : 0;
  const avisos = vista ? [
    modo === 'investigacion' && 'Modo investigación: seudónimos estables y sin nombres, pero los textos libres (respuestas abiertas, comentarios) pueden contener datos personales.',
    modo === 'identificado' && 'Modo identificado: el archivo contendrá datos personales. Guárdelo cifrado y no lo comparta.',
    vista.eventos_telemetria > 1_048_575 && formatos.includes('excel') && 'Más de 1 048 575 eventos: en Excel se repartirán en varias hojas.',
    vista.eventos_telemetria > 200_000 && 'Exportación grande: conviene hacerla desde una computadora y no cerrar esta página.',
    claves && 'Incluye las claves de respuesta: no deje el archivo al alcance de estudiantes.',
  ].filter(Boolean) as string[] : [];

  return (
    <div className="asistencia">
      <section className="tarjeta modal-plano">
        <h2>🗄️ CENTRO DE DATOS</h2>
        <p className="tenue">Descarga estructurada de los datos originales y de las métricas derivadas, para investigación. Recomendado desde una computadora para conjuntos grandes.</p>
        <label>Alcance
          <select value={tipo} onChange={(e) => cambiar(() => { setTipo(e.target.value as Alcance['tipo']); setIds([]); setEstudianteIntentos(''); })}>
            {TIPOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        {(tipo === 'estudiante' || tipo === 'grupo' || tipo === 'intento') && (
          <>
            <input type="search" placeholder="Buscar estudiante…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <div className="lista-eleccion">
              {filtrados.map((a) => tipo === 'intento' ? (
                <label key={a.user_id} className="casilla"><input type="radio" name="est-int" checked={estudianteIntentos === a.user_id} onChange={() => cambiar(() => { setEstudianteIntentos(a.user_id); setIds([]); })} /> {a.full_name} <span className="tenue">{a.student_code ?? ''}</span></label>
              ) : (
                <label key={a.user_id} className="casilla"><input type={tipo === 'estudiante' ? 'radio' : 'checkbox'} name="est" checked={ids.includes(a.user_id)} onChange={() => alternar(a.user_id)} /> {a.full_name} <span className="tenue">{a.student_code ?? ''}</span></label>
              ))}
            </div>
            {tipo === 'grupo' && <div className="fila"><button className="boton secundario pequeno" onClick={() => cambiar(() => setIds(filtrados.map((a) => a.user_id)))}>Marcar los {filtrados.length} visibles</button></div>}
          </>
        )}
        {tipo === 'intento' && estudianteIntentos && (
          <div className="lista-eleccion">
            {intentos.length ? intentos.map((i) => (
              <label key={i.id} className="casilla"><input type="checkbox" checked={ids.includes(i.id)} onChange={() => alternar(i.id)} /> {i.titulo} · intento {i.attempt_number} · {new Date(i.started_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })} <span className="tenue">{i.mode === 'exam' ? 'evaluación' : 'práctica'} · {i.status === 'submitted' ? 'entregado' : 'en curso'}</span></label>
            )) : <p className="tenue">Sin intentos.</p>}
          </div>
        )}
        {tipo === 'seccion' && <div className="lista-eleccion">{secciones.map(([id, t]) => <label key={id} className="casilla"><input type="checkbox" checked={ids.includes(id)} onChange={() => alternar(id)} /> {t}</label>)}</div>}
        {tipo === 'curso' && <div className="lista-eleccion">{cursos.map(([id, t]) => <label key={id} className="casilla"><input type="checkbox" checked={ids.includes(id)} onChange={() => alternar(id)} /> {t}</label>)}</div>}
        {tipo === 'actividad' && <div className="lista-eleccion">{actividades.map((a) => <label key={a.id} className="casilla"><input type="checkbox" checked={ids.includes(a.id)} onChange={() => alternar(a.id)} /> {a.title} <span className="tenue">{a.mode === 'exam' ? 'evaluación' : 'práctica'} · {secciones.find(([s]) => s === a.class_id)?.[1] ?? ''}</span></label>)}</div>}

        <div className="fila-fechas">
          <label>Desde (opcional)<input type="date" value={desde} onChange={(e) => cambiar(() => setDesde(e.target.value))} /></label>
          <label>Hasta (opcional)<input type="date" value={hasta} onChange={(e) => cambiar(() => setHasta(e.target.value))} /></label>
        </div>
      </section>

      <section className="tarjeta modal-plano">
        <h2>CONTENIDO</h2>
        <p className="tenue pequeno">Siempre se incluyen los datos académicos (estudiantes, asignaturas, ejercicios, actividades e intentos), las métricas, el diccionario y el manifiesto.</p>
        <label className="casilla"><input type="checkbox" checked={contenido.length === CONTENIDOS.length} onChange={(e) => cambiar(() => setContenido(e.target.checked ? CONTENIDOS.map(([k]) => k) : []))} /> <strong>Todo</strong></label>
        {CONTENIDOS.map(([k, v]) => (
          <label key={k} className="casilla"><input type="checkbox" checked={contenido.includes(k)} onChange={() => cambiar(() => setContenido(contenido.includes(k) ? contenido.filter((x) => x !== k) : [...contenido, k]))} /> {v}</label>
        ))}
        {esAdmin && <label className="casilla"><input type="checkbox" checked={claves} onChange={(e) => cambiar(() => setClaves(e.target.checked))} /> 🔑 Incluir las claves de respuesta (solo administrador)</label>}
      </section>

      <section className="tarjeta modal-plano">
        <h2>FORMATO Y MODO</h2>
        <label className="casilla"><input type="checkbox" checked={formatos.length === FORMATOS.length} onChange={(e) => cambiar(() => setFormatos(e.target.checked ? FORMATOS.map(([k]) => k) : ['csv']))} /> <strong>Paquete completo (ZIP con todos los formatos)</strong></label>
        {FORMATOS.map(([k, v]) => (
          <label key={k} className="casilla"><input type="checkbox" checked={formatos.includes(k)} onChange={() => cambiar(() => setFormatos(formatos.includes(k) ? formatos.filter((x) => x !== k) : [...formatos, k]))} /> {v}</label>
        ))}
        <p className="tenue pequeno">Solo Excel = un único .xlsx (con hojas de diccionario y manifiesto). Cualquier otra combinación = un .zip. SQLite se entrega como script: «sqlite3 investigacion.sqlite &lt; investigacion.sql».</p>
        <label>Modo
          <select value={modo} onChange={(e) => cambiar(() => setModo(e.target.value as 'identificado' | 'investigacion'))}>
            <option value="identificado">Identificado (nombres e identificadores académicos)</option>
            <option value="investigacion">Investigación (seudónimos, sin datos personales directos)</option>
          </select>
        </label>
      </section>

      <section className="tarjeta resumen">
        <button className="boton secundario" disabled={!listo || trabajando} onClick={() => void previsualizar()}>Vista previa</button>
        {vista && (
          <div className="vista-previa">
            <p><strong>{vista.estudiantes}</strong> estudiantes · <strong>{vista.intentos}</strong> intentos · <strong>{vista.actividades}</strong> actividades · {vista.cursos} asignaturas</p>
            <p className="tenue">{vista.eventos_telemetria} eventos de telemetría · {vista.respuestas} respuestas · {vista.eventos_respuesta} comprobaciones · {vista.eventos_pregunta} cambios guardados · {vista.visitas} visitas</p>
            <p className="tenue">Volumen estimado: {MB(volumen)} por formato · {formatos.map((f) => FORMATOS.find(([k]) => k === f)?.[1]).join(', ')} · modo {modo === 'investigacion' ? 'investigación' : 'identificado'}</p>
            {avisos.map((a) => <p key={a} className="aviso">{a}</p>)}
          </div>
        )}
        <button className="boton grande" disabled={!listo || trabajando || !vista} onClick={() => void generar()}>{trabajando ? 'Generando…' : 'GENERAR EXPORTACIÓN'}</button>
        {!vista && listo && <p className="tenue pequeno">Primero la vista previa.</p>}
        {progreso && (
          <div>
            <p className="tenue">{progreso.fase === 'descarga' ? `Descargando «${progreso.tabla}» (tabla ${progreso.tablaN} de ${progreso.tablas}): ${progreso.filas} de ${progreso.esperadas} filas` : progreso.mensaje}</p>
            {progreso.fase === 'descarga' && <div className="barra"><div style={{ width: `${progreso.esperadas ? Math.round((100 * (progreso.filas ?? 0)) / progreso.esperadas) : 100}%` }} /></div>}
            <button className="boton secundario pequeno" onClick={() => control.current?.abort()}>Cancelar</button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {resultado && (
          <div className="ok">
            <p>✓ Exportación completa: <a href={resultado.url} download={resultado.nombre}>{resultado.nombre}</a></p>
            <p className="pequeno">SHA-256 del manifiesto: {resultado.sha.slice(0, 16)}… · {Object.entries(resultado.tablas).filter(([, n]) => n > 0).length} tablas con datos</p>
            {resultado.advertencias.map((a) => <p key={a} className="pequeno">⚠ {a}</p>)}
          </div>
        )}
      </section>

      {historial.length > 0 && (
        <section className="grupo">
          <h2>EXPORTACIONES REGISTRADAS</h2>
          {historial.slice(0, 10).map((h) => (
            <p key={h.id} className="tarjeta pequeno">{new Date(h.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })} · {h.tipo} · {h.modo} · <strong>{h.estado}</strong>{h.error_code ? ` (${h.error_code})` : ''}{h.actor ? ` · ${h.actor}` : ''}{h.manifiesto_sha256 ? ` · ${h.manifiesto_sha256.slice(0, 10)}…` : ''}</p>
          ))}
        </section>
      )}
    </div>
  );
}
