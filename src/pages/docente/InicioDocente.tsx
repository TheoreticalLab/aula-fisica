/**
 * Panel docente como centro de mando (migración 92): una barra de estado con la sección elegida, y tres columnas que
 * responden qué pasa AHORA, qué REQUIERE SU ATENCIÓN y quién se QUEDA ATRÁS. Debajo, lo ocurrido en la semana, las
 * secciones y las herramientas de uso ocasional. Sin la migración 92 el panel funciona con los datos anteriores.
 * «Conectado» = tiene el aula abierta ahora mismo; no indica atención.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { createClass, gradebook, isCourseStaff, listCourses, reviewQueue, teacherOverview, upcomingActivities } from '@/api/docente';
import { resumenSemanal, tableroDocente, tableroEventos } from '@/api/tablero';
import { CONSUMO, sondeo } from '@/lib/consumo';
import { HERRAMIENTAS_DOCENTE } from '@/lib/herramientasDocente';
import { avisos, PROPOSITOS, rutaAviso, usd } from '@/lib/resumenSemanal';
import { seguimientoSeccion } from '@/lib/seguimiento';
import { bandeja, deSeccion, porDia, riesgo, seccionValida, tableroDesdeResumen, textoEvento, totales, type Tablero } from '@/lib/tablero';
import { fecha, porcentaje, relativo, useAction, useAsync } from '@/lib/util';
import { ABRIR_BUSCADOR } from '@/components/BuscadorEstudiante';
import { Badge, Empty, ErrorBox, Field, Modal, Notice, PageTitle, Spinner } from '@/components/ui';

const CLAVE_SECCION = 'aula-panel-seccion';
const CONTROL = `${import.meta.env.BASE_URL}control/`;
const hora = new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit' });

function leerSeccion(): string | null {
  try {
    return localStorage.getItem(CLAVE_SECCION);
  } catch {
    return null;
  }
}

/** Acción rápida que necesita una sección: con una sola (o una elegida) va directa; si no, pregunta en cuál. */
interface AccionSeccion { icono: string; label: string; ruta: (classId: string) => string }
const ACCIONES: AccionSeccion[] = [
  { icono: '➕', label: 'Actividad', ruta: (id) => `/docente/clases/${id}/nueva-actividad` },
  { icono: '✅', label: 'Pasar asistencia', ruta: (id) => `/docente/clases/${id}?t=asistencia` },
  { icono: '📢', label: 'Publicar aviso', ruta: (id) => `/docente/clases/${id}?t=avisos` },
  { icono: '📊', label: 'Calificaciones', ruta: (id) => `/docente/clases/${id}?t=calificaciones` },
  { icono: '📒', label: 'Registro', ruta: (id) => `/docente/clases/${id}/registro` },
];

export default function InicioDocente() {
  const { profile, isAdmin } = useAuth();
  const nav = useNavigate();
  const base = useAsync(async () => {
    const [secciones, courses] = await Promise.all([teacherOverview(), listCourses()]);
    // solo el equipo docente de una asignatura puede abrir secciones con ella
    const flags = await Promise.all(courses.map((c) => isCourseStaff(c.id)));
    const ownCourses = courses.filter((c, i) => flags[i] && !c.archived);
    const cierres = await upcomingActivities(secciones.filter((s) => !s.archived).map((s) => s.class_id)).catch(() => []);
    return { secciones, courses, ownCourses, cierres };
  }, [profile?.id]);

  // Tablero en vivo: una consulta de lectura cada cierto tiempo, solo con la pestaña visible. null = migración 92 sin aplicar.
  const [vivo, setVivo] = useState<Tablero | null>(null);
  const [sinVivo, setSinVivo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const cargarTablero = useRef(() => {
    void tableroDocente().then((t) => { setFallo(false); if (t) setVivo(t); else setSinVivo(true); }).catch(() => setFallo(true));
  });
  useEffect(() => {
    if (sinVivo) return;
    return sondeo(cargarTablero.current, CONSUMO.tableroDocenteMs, { soloVisible: CONSUMO.pausarOculto, minimoMs: 10_000 });
  }, [sinVivo, profile?.id]);

  const eventos = useAsync(() => tableroEventos(7), [profile?.id]);
  const semana = useAsync(() => resumenSemanal().catch(() => null), [profile?.id]);
  // Sin el tablero en vivo, «en riesgo» se calcula como antes: con el libro de calificaciones de cada sección
  const activasIds = (base.data?.secciones ?? []).filter((s) => !s.archived).map((s) => s.class_id).join(',');
  const apoyo = useAsync(async () => {
    if (!sinVivo || !activasIds) return [];
    return Promise.all(activasIds.split(',').map((id) => gradebook(id).then((gb) => ({ class_id: id, n: seguimientoSeccion(gb).length })).catch(() => ({ class_id: id, n: 0 }))));
  }, [sinVivo, activasIds]);

  const [elegida, setElegida] = useState<string | null>(leerSeccion);
  const [form, setForm] = useState({ course_id: '', name: '', term: '' });
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [preguntar, setPreguntar] = useState<AccionSeccion | null>(null);
  const [todoElHistorial, setTodoElHistorial] = useState(false);
  const action = useAction();
  const siguiente = useAction();

  if (base.loading) return <Spinner />;
  if (base.error) return <ErrorBox error={base.error} onRetry={base.reload} />;
  const { secciones, courses, ownCourses, cierres } = base.data!;
  const tablero = vivo ?? tableroDesdeResumen(secciones);
  const seccion = seccionValida(tablero, elegida);
  const secs = deSeccion(tablero, seccion);
  const tot = totales(secs);
  const nombreSeccion = new Map(secciones.map((s) => [s.class_id, s.name]));
  const enSeccion = (classId: string) => !seccion || classId === seccion;

  const lista = bandeja(secs, semana.data ? avisos(semana.data).map((a) => ({ ...a, ruta: rutaAviso(a.destino) })) : []);
  const enRiesgo = tablero.vivo ? riesgo(secs)
    : (apoyo.data ?? []).filter((x) => x.n > 0 && enSeccion(x.class_id)).map((x) => ({
        clave: x.class_id, seccion: nombreSeccion.get(x.class_id) ?? '', n: x.n, ruta: `/docente/clases/${x.class_id}?t=seguimiento`,
        texto: `${x.n} ${x.n === 1 ? 'estudiante puede' : 'estudiantes pueden'} necesitar apoyo (entregas que faltan o notas bajas)`,
      }));
  const porRevisar = secs.filter((s) => s.por_revisar > 0).sort((a, b) => b.por_revisar - a.por_revisar);
  const totalPorRevisar = porRevisar.reduce((s, x) => s + x.por_revisar, 0);
  const cierresVisibles = cierres.filter((a) => enSeccion(a.class_id));
  const dias = porDia((eventos.data ?? []).filter((e) => enSeccion(e.class_id)));
  const nEventos = dias.reduce((s, d) => s + d.eventos.length, 0);
  const ia = semana.data?.ia;

  function elegir(id: string) {
    setElegida(id || null);
    try {
      if (id) localStorage.setItem(CLAVE_SECCION, id);
      else localStorage.removeItem(CLAVE_SECCION);
    } catch {
      /* sin almacenamiento: la elección dura lo que la página */
    }
  }
  function accion(a: AccionSeccion) {
    const unica = seccion ?? (tablero.secciones.length === 1 ? tablero.secciones[0].class_id : null);
    if (unica) nav(a.ruta(unica));
    else setPreguntar(a);
  }
  /** «Revisar la siguiente»: abre la primera respuesta pendiente y, desde ahí, se pasa a la siguiente sin volver al panel. */
  async function revisarSiguiente() {
    const s = porRevisar[0];
    if (!s) return;
    const cola = await siguiente.run(() => reviewQueue(s.class_id));
    if (cola?.length) nav(`/docente/intentos/${cola[0].attempt_id}?cola=${s.class_id}#r-${cola[0].response_id}`);
    else if (cola) cargarTablero.current();
  }
  async function crear(e: FormEvent) {
    e.preventDefault();
    const c = await action.run(() => createClass({ course_id: form.course_id || ownCourses[0]?.id, name: form.name.trim(), term: form.term.trim() }));
    if (c) nav(`/docente/clases/${c.id}`);
  }

  const visibles = secciones.filter((s) => (verArchivadas || !s.archived) && (s.archived || enSeccion(s.class_id)));
  const porAsignatura = new Map<string, typeof visibles>();
  for (const s of visibles) porAsignatura.set(s.course_title, [...(porAsignatura.get(s.course_title) ?? []), s]);
  const conectadosDe = new Map(tablero.secciones.map((s) => [s.class_id, s.conectados]));

  return (
    <div className="space-y-5">
      <PageTitle title="Centro de mando" subtitle={`${profile?.full_name ?? ''}${isAdmin ? ' · administrador' : ''}`} />
      {!courses.length && <Notice tone="warn">No hay ninguna asignatura. Cargue la semilla del curso inicial o cree una en «Asignaturas y contenido».</Notice>}

      {/* Barra de estado: la sección elegida filtra todo el tablero */}
      <div className="sticky top-[56px] z-30 -mx-4 border-y border-gray-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-white/10 dark:bg-primario-950/95 sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {tablero.secciones.length > 1 ? (
            <select className="campo w-auto max-w-full py-1.5" value={seccion ?? ''} onChange={(e) => elegir(e.target.value)} aria-label="Sección que muestra el tablero">
              <option value="">Todas mis secciones ({tablero.secciones.length})</option>
              {tablero.secciones.map((s) => <option key={s.class_id} value={s.class_id}>{s.course_title} · {s.name}</option>)}
            </select>
          ) : <strong>{tablero.secciones[0]?.name ?? 'Sin secciones'}</strong>}
          {tot.conectados !== null && (
            <span title="Estudiantes con el aula abierta ahora mismo. No indica atención.">
              <span className={tot.conectados ? 'text-emerald-600' : 'text-gray-400'} aria-hidden>●</span> <strong>{tot.conectados}</strong> de {tot.estudiantes} {tot.conectados === 1 ? 'conectado' : 'conectados'}
            </span>
          )}
          {tot.conectados === null && <span><strong>{tot.estudiantes}</strong> estudiantes</span>}
          {tot.enExamen > 0 && <Badge tone="purple">{tot.enExamen} en examen</Badge>}
          {tot.asistenciaAbierta && <Badge tone="green">Asistencia abierta</Badge>}
          <Badge tone={lista.length ? 'red' : 'green'}>{lista.length ? `${lista.length} ${lista.length === 1 ? 'pendiente' : 'pendientes'}` : 'Sin pendientes'}</Badge>
          <span className="ml-auto flex items-center gap-2">
            {fallo && <span className="text-xs text-red-700 dark:text-red-300">Sin conexión con el servidor</span>}
            {tablero.vivo && !fallo && <span className="hidden text-xs text-gray-500 sm:inline">Actualizado {hora.format(new Date(tablero.ahora))}</span>}
            {tablero.vivo && <button className="btn-texto px-2 py-1 text-xs" onClick={() => { cargarTablero.current(); eventos.reload(); }} title="Actualizar ahora">↻ Actualizar</button>}
            <button className="btn-secundario min-h-[36px] px-2 py-1 text-xs" onClick={() => window.dispatchEvent(new Event(ABRIR_BUSCADOR))} title="Buscar un estudiante (tecla / o Ctrl+K)">🔍 Buscar estudiante</button>
          </span>
        </div>
      </div>

      {/* Acciones rápidas */}
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Acciones rápidas">
        {ACCIONES.map((a, i) => (
          <button key={a.label} className={`${i === 0 ? 'btn-primario' : 'btn-secundario'} min-h-[44px] shrink-0 whitespace-nowrap text-sm`} disabled={!tablero.secciones.length} onClick={() => accion(a)}>
            <span aria-hidden>{a.icono}</span> {a.label}
          </button>
        ))}
        <Link className="btn-secundario min-h-[44px] shrink-0 whitespace-nowrap text-sm" to="/docente/comunicacion"><span aria-hidden>💬</span> Mensaje</Link>
        <a className="btn-secundario min-h-[44px] shrink-0 whitespace-nowrap text-sm" href={CONTROL}><span aria-hidden>📱</span> Orbe Control</a>
      </nav>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* AHORA */}
        <Columna titulo="Ahora" icono="🟢">
          {!tablero.vivo && <p className="mb-2 text-xs text-gray-500">El estado en vivo (conectados, exámenes en curso y asistencia de hoy) aún no está activado en el servidor.</p>}
          <ul className="space-y-3 text-sm">
            {secs.flatMap((s) => s.examenes.map((x) => (
              <li key={x.activity_id} className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-400/30 dark:bg-purple-500/10">
                <p className="font-medium">📝 {x.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">{s.name} · {x.en_curso} respondiendo · {x.entregados} de {x.convocados} entregaron{x.closes_at && <> · cierra {relativo(x.closes_at)}</>}</p>
                <Link className="enlace text-xs font-medium" to={`/docente/actividades/${x.activity_id}`}>Abrir el monitor →</Link>
              </li>
            )))}
            {secs.filter((s) => s.asistencia).map((s) => (
              <li key={`as-${s.class_id}`} className="flex flex-wrap items-center gap-2">
                <span aria-hidden>✅</span>
                <span className="min-w-0 flex-1">{s.name}: asistencia de hoy {s.asistencia!.abierta ? <Badge tone="green">abierta</Badge> : 'pasada'} · {s.asistencia!.presentes} de {s.estudiantes} presentes</span>
                <Link className="enlace text-xs" to={`/docente/clases/${s.class_id}?t=asistencia`}>Abrir</Link>
              </li>
            ))}
            {tablero.vivo && secs.length > 1 && secs.filter((s) => s.conectados).map((s) => (
              <li key={`co-${s.class_id}`} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span className="text-emerald-600" aria-hidden>●</span>
                <span className="min-w-0 flex-1">{s.name}: {s.conectados} {s.conectados === 1 ? 'conectado' : 'conectados'}</span>
              </li>
            ))}
          </ul>
          {tablero.vivo && tot.examenes === 0 && !secs.some((s) => s.asistencia) && <p className="text-sm text-gray-500">Ningún examen en marcha ni asistencia abierta hoy.</p>}
          <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Próximos cierres</h3>
          {cierresVisibles.length ? (
            <ul className="space-y-2 text-sm">
              {cierresVisibles.slice(0, 5).map((a) => {
                const pronto = a.closes_at && new Date(a.closes_at).getTime() - Date.now() < 48 * 3600_000;
                return (
                  <li key={a.id}>
                    <Link className="enlace font-medium" to={`/docente/actividades/${a.id}`}>{a.title}</Link> <Badge tone={a.mode === 'exam' ? 'purple' : 'blue'}>{a.mode === 'exam' ? 'Evaluación' : 'Práctica'}</Badge>
                    <span className={`block text-xs ${pronto ? 'font-medium text-red-700 dark:text-red-300' : 'text-gray-500'}`}>{nombreSeccion.get(a.class_id)} · cierra {relativo(a.closes_at)} ({fecha(a.closes_at)})</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-gray-500">Ninguna actividad publicada con cierre próximo.</p>}
          <p className="mt-3 text-xs text-gray-500">{tot.abiertas} {tot.abiertas === 1 ? 'actividad abierta' : 'actividades abiertas'} en este momento.</p>
        </Columna>

        {/* REQUIERE SU ATENCIÓN */}
        <Columna titulo="Requiere su atención" icono="🔔" n={lista.length}>
          {totalPorRevisar > 0 && (
            <div className="mb-3">
              <button className="btn-primario min-h-[44px] w-full" disabled={siguiente.busy} onClick={() => void revisarSiguiente()}>
                ✍️ Revisar la siguiente respuesta ({totalPorRevisar})
              </button>
              <p className="mt-1 text-xs text-gray-500">Al guardar cada una podrá pasar a la siguiente sin volver aquí.</p>
              <ErrorBox error={siguiente.error} />
            </div>
          )}
          {lista.length ? (
            <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
              {lista.map((p) => (
                <li key={p.clave} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge tone={p.tono}>{p.seccion}</Badge>
                  <span className="min-w-0 flex-1">{p.texto}</span>
                  {p.ruta ? <Link className="enlace text-xs font-medium" to={p.ruta}>Abrir</Link>
                    : <a className="enlace text-xs font-medium" href={CONTROL} target="_blank" rel="noreferrer">Abrir Orbe Control</a>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-emerald-700 dark:text-emerald-300">Nada pendiente. ✓</p>}
          {ia && (
            <p className="mt-3 text-xs text-gray-500">
              Gasto de IA a su nombre (7 días): <strong>{usd(ia.mio_usd)}</strong> en {ia.mio_llamadas} llamada(s)
              {Object.entries(ia.mio_por_proposito).filter(([, v]) => v > 0).length > 0 && <> ({Object.entries(ia.mio_por_proposito).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${PROPOSITOS[k] ?? k} ${usd(v)}`).join(' · ')})</>}
              {semana.data?.es_admin && ia.total_usd !== null && <> · total del aula esta semana {usd(ia.total_usd)} · este mes {usd(ia.mes_usd)}{ia.presupuesto_mes ? ` de ${usd(ia.presupuesto_mes)}` : ''}</>}.
            </p>
          )}
        </Columna>

        {/* ESTUDIANTES EN RIESGO */}
        <Columna titulo="Estudiantes en riesgo" icono="🤝" n={enRiesgo.length}>
          {!tablero.vivo && apoyo.loading ? <Spinner /> : enRiesgo.length ? (
            <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
              {enRiesgo.map((r) => (
                <li key={r.clave} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge tone="amber">{r.seccion}</Badge>
                  <span className="min-w-0 flex-1">{r.texto}</span>
                  <Link className="enlace text-xs font-medium" to={r.ruta}>Ver quiénes</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-emerald-700 dark:text-emerald-300">Nadie con avisos. ✓</p>}
          <p className="mt-3 text-xs text-gray-500">Son recuentos para decidir a quién escribir; el detalle con nombres está en cada sección.</p>
        </Columna>
      </div>

      {/* Lo ocurrido: línea de tiempo de los últimos 7 días */}
      {eventos.data && (
        <section className="tarjeta" aria-labelledby="lo-ocurrido">
          <h2 id="lo-ocurrido" className="mb-2 font-semibold">🕒 Lo ocurrido <span className="text-xs font-normal text-gray-500">· últimos 7 días</span></h2>
          {nEventos === 0 ? <p className="text-sm text-gray-500">Sin movimiento en estos días.</p> : (
            <>
              {(todoElHistorial ? dias : dias.slice(0, 2)).map((d) => (
                <div key={d.dia} className="mb-3 last:mb-0">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-acento-600">{d.dia}</h3>
                  <ol className="space-y-1 border-l-2 border-gray-200 pl-3 text-sm dark:border-white/10">
                    {d.eventos.map((e, i) => {
                      const t = textoEvento(e);
                      return (
                        <li key={`${e.tipo}-${e.ref}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="w-16 shrink-0 text-xs tabular-nums text-gray-500">{hora.format(new Date(e.cuando))}</span>
                          <span aria-hidden>{t.icono}</span>
                          <Link className="min-w-0 flex-1 hover:underline" to={t.ruta}>{t.texto}</Link>
                          {!seccion && <span className="text-xs text-gray-500">{e.seccion}</span>}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
              {dias.length > 2 && <button className="btn-texto text-sm" onClick={() => setTodoElHistorial((v) => !v)}>{todoElHistorial ? 'Ver solo lo reciente' : `Ver los ${dias.length} días`}</button>}
            </>
          )}
        </section>
      )}

      {/* Secciones */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mis secciones</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} /> Ver archivadas</label>
        </div>
        {porAsignatura.size ? [...porAsignatura.entries()].map(([asig, lista2]) => (
          <div key={asig}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-acento-600">{asig}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lista2.map((s) => (
                <li key={s.class_id} className="tarjeta">
                  <Link to={`/docente/clases/${s.class_id}`} className="block">
                    <p className="font-semibold hover:underline">{s.name} {s.archived && <Badge tone="amber">Archivada</Badge>}</p>
                    <p className="text-sm text-gray-500">{s.term || 'Sin periodo'}{conectadosDe.get(s.class_id) ? ` · ${conectadosDe.get(s.class_id)} conectados` : ''}</p>
                    <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
                      <div><dt className="text-gray-500">Estudiantes</dt><dd className="text-lg font-semibold">{s.students}</dd></div>
                      <div><dt className="text-gray-500">Abiertas</dt><dd className="text-lg font-semibold">{s.open_activities}</dd></div>
                      <div><dt className="text-gray-500">Media</dt><dd className="text-lg font-semibold">{porcentaje(s.mean_pct)}</dd></div>
                    </dl>
                  </Link>
                  {!s.archived && (
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      <Link className="rounded-lg border border-gray-300 px-2 py-1.5 hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/5" to={`/docente/clases/${s.class_id}/nueva-actividad`}>+ Actividad</Link>
                      <Link className="rounded-lg border border-gray-300 px-2 py-1.5 hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/5" to={`/docente/clases/${s.class_id}?t=estudiantes`}>Estudiantes</Link>
                      <Link className="rounded-lg border border-gray-300 px-2 py-1.5 hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/5" to={`/docente/clases/${s.class_id}?t=calificaciones`}>Notas</Link>
                      {s.pending_review > 0 && <Link className="rounded-lg border border-red-300 px-2 py-1.5 text-red-700 dark:border-red-500/40 dark:text-red-300" to={`/docente/clases/${s.class_id}?t=revision`}>{s.pending_review} por revisar</Link>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )) : <Empty>Todavía no tiene secciones. Cree la primera más abajo.</Empty>}
      </section>

      <details className="tarjeta" open={!secciones.length}>
        <summary className="cursor-pointer font-semibold">➕ Crear una sección</summary>
        <form onSubmit={crear} className="mt-3 max-w-md">
          <Field label="Asignatura">
            {(id) => (
              <select id={id} className="campo" value={form.course_id || ownCourses[0]?.id || ''} onChange={(e) => setForm({ ...form, course_id: e.target.value })} required>
                {ownCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}
          </Field>
          <Field label="Nombre de la sección">{(id) => <input id={id} className="campo" placeholder="FIS-0180 Sección 11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />}</Field>
          <Field label="Periodo">{(id) => <input id={id} className="campo" placeholder="2026-2" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} maxLength={40} />}</Field>
          <ErrorBox error={action.error} />
          <button className="btn-primario w-full" disabled={action.busy || !ownCourses.length}>Crear sección</button>
          {courses.length > 0 && !ownCourses.length && (
            <p className="mt-2 text-xs text-acento-700">No forma parte del equipo docente de ninguna asignatura activa. Pida a un administrador que lo añada.</p>
          )}
          <p className="mt-2 text-xs text-gray-500">Después podrá matricular a los estudiantes por su ID (o compartir el código de la sección).</p>
        </form>
      </details>

      {/* Herramientas de uso ocasional (las mismas del menú «Herramientas» de la barra superior) */}
      <details className="tarjeta">
        <summary className="cursor-pointer font-semibold">🧰 Herramientas <span className="text-xs font-normal text-gray-500">· contenido, banco, IA, telemetría{isAdmin ? ', cuentas' : ''}</span></summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HERRAMIENTAS_DOCENTE.filter((h) => !h.admin || isAdmin).map((h) => {
            const cuerpo = (
              <>
                <span className="text-2xl" aria-hidden>{h.icono}</span>
                <span><span className="block font-medium">{h.titulo}</span><span className="block text-xs text-gray-500">{h.texto}</span></span>
              </>
            );
            const cls = 'flex min-h-[64px] items-center gap-3 rounded-lg border border-gray-200 p-3 hover:border-primario-400 dark:border-white/10';
            return h.externa ? <a key={h.to} href={`${import.meta.env.BASE_URL}${h.to}`} className={cls}>{cuerpo}</a> : <Link key={h.to} to={h.to} className={cls}>{cuerpo}</Link>;
          })}
        </div>
      </details>

      <Modal open={!!preguntar} onClose={() => setPreguntar(null)} title={preguntar ? `${preguntar.label}: ¿en qué sección?` : ''}>
        <h2 className="mb-3 font-serif text-lg font-semibold">{preguntar?.icono} {preguntar?.label}: ¿en qué sección?</h2>
        <ul className="space-y-2">
          {tablero.secciones.map((s) => (
            <li key={s.class_id}><Link className="btn-secundario min-h-[44px] w-full justify-start" to={preguntar ? preguntar.ruta(s.class_id) : '/docente'}>{s.course_title} · {s.name}</Link></li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">Si elige una sección en la barra de estado, las acciones rápidas irán directas a ella.</p>
      </Modal>
    </div>
  );
}

function Columna({ titulo, icono, n, children }: { titulo: string; icono: string; n?: number; children: ReactNode }) {
  return (
    <section className="tarjeta">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
        <span aria-hidden>{icono}</span> {titulo}
        {n !== undefined && n > 0 && <span className="rounded-full bg-gray-200 px-2 text-xs dark:bg-white/15">{n}</span>}
      </h2>
      {children}
    </section>
  );
}
