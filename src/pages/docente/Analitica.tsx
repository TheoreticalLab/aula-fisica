/**
 * Analítica de tiempo de aprendizaje — exclusiva del profesor.
 * Todo dato viene de las funciones analytics_* (autorización en la base de datos); aquí solo se presenta.
 * Tiempo de utilización ≠ tiempo de aprendizaje: el panel lo recuerda y no califica a nadie por tiempo.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  actividadesDeClases,
  clasesDeCurso,
  estructuraCurso,
  gruposDeClase,
  listCourses,
  tiempoArbol,
  tiempoAuditar,
  tiempoCalidad,
  tiempoCalor,
  tiempoEstudiantes,
  tiempoSerie,
  type EstudianteTiempo,
  type FiltroTiempo,
  type NodoTiempo,
} from '@/api/docente';
import { Card, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { useDark } from '@/lib/tema';
import { aCsv, etiquetaSeccion, formatoDuracion, histograma, mediana } from '@/lib/tiempo';
import { useAsync } from '@/lib/util';

const AZUL = '#335ca6';
const AZUL_OSCURO = '#7f9fd6';
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const min = (s: number) => Math.round((s / 60) * 10) / 10;
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Tabla ordenable genérica. */
function Tabla<T>({ filas, columnas, clave, onFila, inicial }: {
  filas: T[];
  columnas: { id: string; titulo: string; valor: (f: T) => string | number; mostrar?: (f: T) => ReactNode; num?: boolean }[];
  clave: (f: T) => string;
  onFila?: (f: T) => void;
  inicial: string;
}) {
  const [orden, setOrden] = useState<{ id: string; asc: boolean }>({ id: inicial, asc: false });
  const col = columnas.find((c) => c.id === orden.id) ?? columnas[0];
  const ordenadas = [...filas].sort((a, b) => {
    const x = col.valor(a);
    const y = col.valor(b);
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
    return orden.asc ? r : -r;
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left dark:border-white/10">
            {columnas.map((c) => (
              <th key={c.id} className={`px-2 py-1.5 font-medium ${c.num ? 'text-right' : ''}`}>
                <button className="hover:underline" onClick={() => setOrden({ id: c.id, asc: orden.id === c.id ? !orden.asc : false })}>
                  {c.titulo}{orden.id === c.id ? (orden.asc ? ' ▲' : ' ▼') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((f) => (
            <tr key={clave(f)} className={`border-b border-gray-100 dark:border-white/5 ${onFila ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5' : ''}`} onClick={() => onFila?.(f)}>
              {columnas.map((c) => (
                <td key={c.id} className={`px-2 py-1.5 ${c.num ? 'text-right tabular-nums' : ''}`}>{c.mostrar ? c.mostrar(f) : c.valor(f)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Indicador({ titulo, valor, nota }: { titulo: string; valor: ReactNode; nota?: ReactNode }) {
  return (
    <div className="tarjeta !p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{titulo}</p>
      <p className="font-serif text-xl font-semibold">{valor}</p>
      {nota && <p className="text-xs text-gray-500 dark:text-gray-400">{nota}</p>}
    </div>
  );
}

function useEstilo() {
  const dark = useDark();
  return {
    color: dark ? AZUL_OSCURO : AZUL,
    grid: dark ? '#ffffff1a' : '#00000014',
    texto: dark ? '#d1d5db' : '#374151',
    tooltip: { background: dark ? '#0b1730' : '#fff', border: '1px solid #8884', fontSize: 12 },
  };
}

/** Barras horizontales de un solo tono (una serie: sin leyenda; el título la nombra). */
function Barras({ datos, alto = 260 }: { datos: { nombre: string; minutos: number }[]; alto?: number }) {
  const e = useEstilo();
  if (!datos.length) return <p className="text-sm text-gray-500">Sin datos en este filtro.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(alto, datos.length * 26 + 40)}>
      <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid stroke={e.grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: e.texto, fontSize: 12 }} unit=" min" />
        <YAxis type="category" dataKey="nombre" width={170} tick={{ fill: e.texto, fontSize: 11 }} interval={0} />
        <Tooltip cursor={{ fill: '#8881' }} contentStyle={e.tooltip} formatter={(v) => [`${v} min`, 'Tiempo efectivo']} />
        <Bar dataKey="minutos" fill={e.color} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Analitica() {
  const cursos = useAsync(listCourses, []);
  const [course, setCourse] = useState('');
  const [klass, setKlass] = useState('');
  const [group, setGroup] = useState('');
  const [user, setUser] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [unit, setUnit] = useState<string | null>(null);
  const [lesson, setLesson] = useState<{ id: string; kind: 'leccion' | 'actividad' } | null>(null);
  const [gran, setGran] = useState<'day' | 'week' | 'month'>('day');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!course && cursos.data?.length) setCourse(cursos.data[0].id);
  }, [cursos.data, course]);

  // actualización periódica sin recargar la aplicación (cada minuto, solo con la pestaña delante)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const clases = useAsync(() => (course ? clasesDeCurso(course) : Promise.resolve([])), [course]);
  const grupos = useAsync(() => (klass ? gruposDeClase(klass) : Promise.resolve([])), [klass]);
  const estructura = useAsync(() => (course ? estructuraCurso(course) : Promise.resolve({ units: [], lessons: [] })), [course]);
  const actividades = useAsync(() => actividadesDeClases((clases.data ?? []).map((c) => c.id)), [clases.data]);

  const filtro: FiltroTiempo | null = course
    ? { course, klass: klass || null, group: group || null, user: user || null, from: from || null, to: to || null,
        unit: unit && unit !== 'actividades' && unit !== 'paginas' ? unit : null,
        lesson: lesson?.kind === 'leccion' ? lesson.id : null, activity: lesson?.kind === 'actividad' ? lesson.id : null }
    : null;
  const claveFiltro = JSON.stringify(filtro) + tick;
  const nivel: 'unidad' | 'leccion' | 'seccion' = lesson ? 'seccion' : unit ? 'leccion' : 'unidad';

  const arbol = useAsync(() => (filtro ? tiempoArbol(filtro, nivel) : Promise.resolve([] as NodoTiempo[])), [claveFiltro, nivel]);
  const filtroGrupo = filtro ? { ...filtro, user: null } : null;
  const alumnos = useAsync(() => (filtroGrupo ? tiempoEstudiantes(filtroGrupo) : Promise.resolve([] as EstudianteTiempo[])), [claveFiltro]);
  const serie = useAsync(() => (filtro ? tiempoSerie(filtro, gran) : Promise.resolve([])), [claveFiltro, gran]);
  const semanal = useAsync(() => (filtro ? tiempoSerie(filtro, 'week') : Promise.resolve([])), [claveFiltro]);
  const calor = useAsync(() => (filtro ? tiempoCalor(filtro) : Promise.resolve([])), [claveFiltro]);
  const calidad = useAsync(() => (filtro ? tiempoCalidad(filtro) : Promise.resolve(null)), [claveFiltro]);

  // auditoría de consultas individuales
  useEffect(() => {
    if (user && course) void tiempoAuditar('consulta_estudiante', { course, user }).catch(() => undefined);
  }, [user, course]);

  const nombres = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of estructura.data?.units ?? []) m.set(u.id, u.title);
    for (const l of estructura.data?.lessons ?? []) m.set(l.id, l.title);
    for (const a of actividades.data ?? []) m.set(a.id, a.title);
    return m;
  }, [estructura.data, actividades.data]);
  const orden = useMemo(() => {
    const m = new Map<string, number>();
    (estructura.data?.units ?? []).forEach((u, i) => m.set(u.id, i * 1000));
    for (const l of estructura.data?.lessons ?? []) m.set(l.id, (m.get(l.unit_id) ?? 0) + l.position + 1);
    return m;
  }, [estructura.data]);

  function nombreNodo(n: NodoTiempo): string {
    if (nivel === 'unidad') return n.unit_id ? nombres.get(n.unit_id) ?? 'Unidad' : n.nodo === 'actividades' ? 'Prácticas y exámenes' : 'Páginas generales de la asignatura';
    if (nivel === 'leccion') return n.lesson_id ? nombres.get(n.lesson_id) ?? 'Lección' : n.activity_id ? nombres.get(n.activity_id) ?? 'Actividad' : etiquetaSeccion(n.section);
    return etiquetaSeccion(n.section);
  }
  const ordenNodo = (n: NodoTiempo) => orden.get(n.lesson_id ?? n.unit_id ?? '') ?? 99999;

  const lista = alumnos.data ?? [];
  const totalAlumnos = lista.length;
  const tiempos = lista.map((a) => a.effective_seconds);
  const totalGrupo = tiempos.reduce((s, x) => s + x, 0);
  const conActividad = lista.filter((a) => a.effective_seconds > 0).length;
  const elegido = lista.find((a) => a.user_id === user);
  const nodos = [...(arbol.data ?? [])].sort((a, b) => ordenNodo(a) - ordenNodo(b));
  const e = useEstilo();

  function exportarContenidos() {
    const filas: (string | number | null)[][] = [['Contenido', 'Tiempo efectivo (min)', 'Tiempo visible (min)', 'Inactivo (min)', 'Oculto (min)', 'Sesiones', 'Visitas efectivas', 'Estudiantes', 'Primera visita', 'Última visita']];
    for (const n of nodos) filas.push([nombreNodo(n), min(n.effective_seconds), min(n.visible_seconds), min(n.idle_seconds), min(n.hidden_seconds), n.sessions, n.effective_visits, n.students, n.first_visit, n.last_visit]);
    descargar(`tiempo-contenidos-${new Date().toISOString().slice(0, 10)}.csv`, aCsv(filas));
    void tiempoAuditar('exportar_csv', { tabla: 'contenidos', filtro, filas: nodos.length }).catch(() => undefined);
  }
  function exportarEstudiantes() {
    const filas: (string | number | null)[][] = [['Estudiante', 'Matrícula', 'Tiempo efectivo (min)', 'Tiempo visible (min)', 'Sesiones', 'Media por sesión (min)', 'Días activos', 'Primera visita', 'Última visita']];
    for (const a of lista) filas.push([a.full_name, a.student_code, min(a.effective_seconds), min(a.visible_seconds), a.sessions, a.sessions ? min(a.effective_seconds / a.sessions) : 0, a.days_active, a.first_visit, a.last_visit]);
    descargar(`tiempo-estudiantes-${new Date().toISOString().slice(0, 10)}.csv`, aCsv(filas));
    void tiempoAuditar('exportar_csv', { tabla: 'estudiantes', filtro, filas: lista.length }).catch(() => undefined);
  }

  const calorMax = Math.max(1, ...(calor.data ?? []).map((c) => c.effective_seconds));
  const calorMap = new Map((calor.data ?? []).map((c) => [`${c.dow}-${c.hour}`, c.effective_seconds]));
  const q = calidad.data;
  const acumulada = (() => {
    let s = 0;
    return (semanal.data ?? []).map((p) => ({ semana: p.bucket, horas: Math.round(((s += p.effective_seconds) / 3600) * 10) / 10 }));
  })();
  const migas: { label: string; onClick?: () => void }[] = [{ label: 'Todos los capítulos', onClick: unit ? () => { setUnit(null); setLesson(null); } : undefined }];
  if (unit) migas.push({ label: unit === 'actividades' ? 'Prácticas y exámenes' : unit === 'paginas' ? 'Páginas generales' : nombres.get(unit) ?? 'Capítulo', onClick: lesson ? () => setLesson(null) : undefined });
  if (lesson) migas.push({ label: nombres.get(lesson.id) ?? 'Sección' });

  return (
    <div className="space-y-4">
      <PageTitle title="Analítica de tiempo de aprendizaje" subtitle="Tiempo efectivo estimado por estudiante y contenido. Visible solo para el profesorado." back={{ to: '/docente', label: 'Panel docente' }} />
      <Notice>
        El tiempo efectivo es una <strong>estimación de actividad observable</strong> (página delante, con foco y con señales recientes de interacción), no una medida de atención ni de aprendizaje.
        Mucho tiempo puede indicar dificultad; poco tiempo, dominio del tema. No se usa para calificar.
      </Notice>

      {/* filtros en una fila */}
      <div className="tarjeta grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs">Asignatura
          <select className="campo mt-1" value={course} onChange={(ev) => { setCourse(ev.target.value); setKlass(''); setGroup(''); setUser(''); setUnit(null); setLesson(null); }}>
            {(cursos.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="text-xs">Sección
          <select className="campo mt-1" value={klass} onChange={(ev) => { setKlass(ev.target.value); setGroup(''); setUser(''); }}>
            <option value="">Todas las que imparto</option>
            {(clases.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs">Grupo
          <select className="campo mt-1" value={group} onChange={(ev) => setGroup(ev.target.value)} disabled={!klass || !(grupos.data ?? []).length}>
            <option value="">Todos</option>
            {(grupos.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="text-xs">Estudiante
          <select className="campo mt-1" value={user} onChange={(ev) => setUser(ev.target.value)}>
            <option value="">Todo el grupo</option>
            {[...lista].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')).map((a) => <option key={a.user_id} value={a.user_id}>{a.full_name || a.student_code || a.user_id.slice(0, 8)}</option>)}
          </select>
        </label>
        <label className="text-xs">Desde<input type="date" className="campo mt-1" value={from} onChange={(ev) => setFrom(ev.target.value)} /></label>
        <label className="text-xs">Hasta<input type="date" className="campo mt-1" value={to} onChange={(ev) => setTo(ev.target.value)} /></label>
      </div>

      {cursos.loading && <Spinner />}
      <ErrorBox error={cursos.error || arbol.error || alumnos.error} />

      {/* indicadores */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {elegido ? (
          <>
            <Indicador titulo={`Tiempo efectivo · ${elegido.full_name}`} valor={formatoDuracion(elegido.effective_seconds)} nota={`visible: ${formatoDuracion(elegido.visible_seconds)}`} />
            <Indicador titulo="Sesiones efectivas" valor={elegido.sessions} nota={elegido.sessions ? `media: ${formatoDuracion(elegido.effective_seconds / elegido.sessions)} por sesión` : undefined} />
            <Indicador titulo="Días con actividad" valor={elegido.days_active} />
            <Indicador titulo="Primera / última visita" valor={<span className="text-sm">{fecha(elegido.first_visit)}</span>} nota={fecha(elegido.last_visit)} />
          </>
        ) : (
          <>
            <Indicador titulo="Tiempo efectivo del grupo" valor={formatoDuracion(totalGrupo)} nota={`${conActividad} de ${totalAlumnos} estudiantes con actividad`} />
            <Indicador titulo="Media por estudiante" valor={formatoDuracion(totalAlumnos ? totalGrupo / totalAlumnos : 0)} />
            <Indicador titulo="Mediana por estudiante" valor={formatoDuracion(mediana(tiempos))} />
            <Indicador titulo="Sesiones efectivas" valor={lista.reduce((s, a) => s + a.sessions, 0)} />
          </>
        )}
      </div>

      {/* contenidos: navegación jerárquica */}
      <Card title="Contenidos" actions={<button className="btn-secundario !py-1 text-xs" onClick={exportarContenidos} disabled={!nodos.length}>Exportar CSV</button>}>
        <nav className="mb-2 text-sm">
          {migas.map((m, i) => (
            <span key={i}>{i > 0 && ' › '}{m.onClick ? <button className="enlace" onClick={m.onClick}>{m.label}</button> : <strong>{m.label}</strong>}</span>
          ))}
        </nav>
        {arbol.loading && !arbol.data ? <Spinner /> : (
          <>
            <Tabla
              filas={nodos}
              clave={(n) => n.nodo}
              inicial="efectivo"
              onFila={nivel === 'seccion' ? undefined : (n) => {
                if (nivel === 'unidad') { setUnit(n.unit_id ?? n.nodo); setLesson(null); }
                else if (n.lesson_id) setLesson({ id: n.lesson_id, kind: 'leccion' });
                else if (n.activity_id) setLesson({ id: n.activity_id, kind: 'actividad' });
              }}
              columnas={[
                { id: 'nombre', titulo: nivel === 'unidad' ? 'Capítulo' : nivel === 'leccion' ? 'Sección' : 'Subsección', valor: nombreNodo, mostrar: (n) => <span className={nivel !== 'seccion' ? 'enlace' : ''}>{nombreNodo(n)}</span> },
                { id: 'efectivo', titulo: 'Tiempo efectivo', valor: (n) => n.effective_seconds, mostrar: (n) => formatoDuracion(n.effective_seconds), num: true },
                { id: 'visible', titulo: 'Visible', valor: (n) => n.visible_seconds, mostrar: (n) => formatoDuracion(n.visible_seconds), num: true },
                { id: 'sesiones', titulo: 'Sesiones', valor: (n) => n.sessions, num: true },
                ...(user ? [] : [{ id: 'alumnos', titulo: 'Estudiantes', valor: (n: NodoTiempo) => n.students, mostrar: (n: NodoTiempo) => `${n.students} (${totalAlumnos ? Math.round((100 * n.students) / totalAlumnos) : 0} %)`, num: true }]),
                { id: 'ultima', titulo: 'Última visita', valor: (n) => n.last_visit ?? '', mostrar: (n) => fecha(n.last_visit) },
              ]}
            />
            {!nodos.length && <p className="text-sm text-gray-500">Todavía no hay tiempo registrado con estos filtros.</p>}
            <h3 className="mb-1 mt-4 text-sm font-medium">Distribución del tiempo efectivo por contenido</h3>
            <Barras datos={nodos.filter((n) => n.effective_seconds > 0).map((n) => ({ nombre: nombreNodo(n).slice(0, 40), minutos: min(n.effective_seconds) }))} />
          </>
        )}
      </Card>

      {/* estudiantes (colectivo) */}
      {!user && (
        <Card title="Estudiantes" actions={<button className="btn-secundario !py-1 text-xs" onClick={exportarEstudiantes} disabled={!lista.length}>Exportar CSV</button>}>
          <Tabla
            filas={lista}
            clave={(a) => a.user_id}
            inicial="efectivo"
            onFila={(a) => setUser(a.user_id)}
            columnas={[
              { id: 'nombre', titulo: 'Estudiante', valor: (a) => a.full_name, mostrar: (a) => <span className="enlace">{a.full_name || '—'}</span> },
              { id: 'matricula', titulo: 'Matrícula', valor: (a) => a.student_code ?? '' },
              { id: 'efectivo', titulo: 'Tiempo efectivo', valor: (a) => a.effective_seconds, mostrar: (a) => formatoDuracion(a.effective_seconds), num: true },
              { id: 'sesiones', titulo: 'Sesiones', valor: (a) => a.sessions, num: true },
              { id: 'media', titulo: 'Media/sesión', valor: (a) => (a.sessions ? a.effective_seconds / a.sessions : 0), mostrar: (a) => (a.sessions ? formatoDuracion(a.effective_seconds / a.sessions) : '—'), num: true },
              { id: 'dias', titulo: 'Días activos', valor: (a) => a.days_active, num: true },
              { id: 'ultima', titulo: 'Última visita', valor: (a) => a.last_visit ?? '', mostrar: (a) => fecha(a.last_visit) },
            ]}
          />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-medium">Comparación entre estudiantes (tiempo efectivo)</h3>
              <Barras datos={[...lista].sort((a, b) => b.effective_seconds - a.effective_seconds).slice(0, 30).map((a) => ({ nombre: (a.full_name || '—').slice(0, 28), minutos: min(a.effective_seconds) }))} />
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium">Distribución de tiempos (número de estudiantes por tramo)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={histograma(tiempos).map((b) => ({ tramo: `${b.desde}–${b.hasta} min`, n: b.n }))}>
                  <CartesianGrid stroke={e.grid} vertical={false} />
                  <XAxis dataKey="tramo" tick={{ fill: e.texto, fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: e.texto, fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#8881' }} contentStyle={e.tooltip} formatter={(v) => [v, 'Estudiantes']} />
                  <Bar dataKey="n" fill={e.color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {/* actividad temporal y evolución */}
      <Card title={`Actividad temporal${elegido ? ` · ${elegido.full_name}` : ''}`} actions={
        <div className="flex gap-1 text-xs">
          {(['day', 'week', 'month'] as const).map((g) => (
            <button key={g} className={gran === g ? 'btn-primario !px-2 !py-1' : 'btn-secundario !px-2 !py-1'} onClick={() => setGran(g)}>{g === 'day' ? 'Diaria' : g === 'week' ? 'Semanal' : 'Mensual'}</button>
          ))}
        </div>
      }>
        {(serie.data ?? []).length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={(serie.data ?? []).map((p) => ({ fecha: p.bucket, minutos: min(p.effective_seconds), estudiantes: p.students }))}>
              <CartesianGrid stroke={e.grid} vertical={false} />
              <XAxis dataKey="fecha" tick={{ fill: e.texto, fontSize: 11 }} />
              <YAxis unit=" min" tick={{ fill: e.texto, fontSize: 12 }} />
              <Tooltip cursor={{ fill: '#8881' }} contentStyle={e.tooltip} formatter={(v, k) => (k === 'minutos' ? [`${v} min`, 'Tiempo efectivo'] : [v, 'Estudiantes'])} />
              <Bar dataKey="minutos" fill={e.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-gray-500">Sin actividad en este periodo.</p>}
        <h3 className="mb-1 mt-4 text-sm font-medium">Evolución a lo largo del semestre (horas efectivas acumuladas, por semana)</h3>
        {acumulada.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={acumulada}>
              <CartesianGrid stroke={e.grid} vertical={false} />
              <XAxis dataKey="semana" tick={{ fill: e.texto, fontSize: 11 }} />
              <YAxis unit=" h" tick={{ fill: e.texto, fontSize: 12 }} />
              <Tooltip contentStyle={e.tooltip} formatter={(v) => [`${v} h`, 'Acumulado']} labelFormatter={(l) => `Semana del ${l}`} />
              <Line dataKey="horas" stroke={e.color} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-gray-500">Sin datos.</p>}
      </Card>

      {/* mapa de calor */}
      <Card title="Días y horas con más actividad (hora de Santo Domingo)">
        <div className="overflow-x-auto">
          <table className="text-[10px]">
            <thead><tr><th />{Array.from({ length: 24 }, (_, h) => <th key={h} className="w-6 font-normal text-gray-500">{h}</th>)}</tr></thead>
            <tbody>
              {DIAS.map((d, i) => (
                <tr key={d}>
                  <th className="pr-1 text-right font-normal text-gray-500">{d}</th>
                  {Array.from({ length: 24 }, (_, h) => {
                    const v = calorMap.get(`${i + 1}-${h}`) ?? 0;
                    return (
                      <td key={h} className="p-[1px]">
                        <div title={`${d} ${h}:00–${h + 1}:00 · ${formatoDuracion(v)}`} className="h-5 w-6 rounded-sm border border-gray-200 dark:border-white/10"
                          style={{ background: v ? e.color : 'transparent', opacity: v ? 0.15 + 0.85 * (v / calorMax) : 1 }} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-500">Más oscuro = más tiempo efectivo. Pase el cursor por una celda para ver el valor.</p>
      </Card>

      {/* calidad de los datos */}
      <Card title="Calidad y confiabilidad de los datos">
        {q ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <p>Proporción efectivo / visible: <strong>{q.visible_seconds ? Math.round((100 * q.effective_seconds) / q.visible_seconds) : 0} %</strong></p>
            <p>Tiempo inactivo descartado: <strong>{formatoDuracion(q.idle_seconds)}</strong></p>
            <p>Tiempo con la pestaña oculta: <strong>{formatoDuracion(q.hidden_seconds)}</strong></p>
            <p>Visitas efectivas / breves (&lt; mínimo): <strong>{q.effective_visits} / {q.brief_visits}</strong></p>
            <p>Efectivo sostenido solo por el ratón: <strong>{formatoDuracion(q.weak_seconds)}</strong></p>
            <p>Tiempo rechazado por la validación del servidor: <strong>{formatoDuracion(q.clamped_seconds)}</strong></p>
            <p>Visitas sincronizadas tras una desconexión: <strong>{q.offline_visits}</strong></p>
            <p>Primer registro: <strong>{fecha(q.first_visit)}</strong></p>
            <p>Último registro: <strong>{fecha(q.last_visit)}</strong></p>
          </div>
        ) : <Spinner />}
        <p className="mt-2 text-xs text-gray-500">
          Límites: el navegador no puede saber si el estudiante lee con atención. Se acreditan pausas de lectura de hasta {`2 min`} entre señales;
          una pausa mayor solo suma 30 s. Las visitas de menos de 15 s de actividad no cuentan. La precisión es del orden de ±15 s por visita.
        </p>
      </Card>
    </div>
  );
}
