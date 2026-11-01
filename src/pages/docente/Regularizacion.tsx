/**
 * Regularización de prácticas anteriores (profesor): localizador de entregas históricas, resumen por estudiante,
 * sugerencias de prácticas adicionales y catálogo/configuración. No se conecta a ningún correo: genera el texto de
 * búsqueda para copiarlo en el correo institucional. Ninguna acción crea notas.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  archivarPractica, configSeccion, configurar, decidirSugerencias, guardarPractica, historial, reabrirEstudiante, recordatorio, registros as cargarRegistros,
  resumen, revisar, sugerencias as cargarSugerencias, terminados, unirPracticas, vincularActividad, type ConfigSeccion, type PracticaDocente, type SugerenciaDocente,
} from '@/api/regularizacion';
import { teacherOverview } from '@/api/docente';
import {
  ACCIONES, accionesPosibles, agruparSugerencias, busquedaCorreo, duplicados, ESTADO, estimacionTotal, filtrar, FILTROS_VACIOS, kb, totales,
  type AccionDocente, type Estado, type Filtros, type Registro,
} from '@/lib/regularizacion';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Modal, Notice, PageTitle, ProgressBar, Spinner, Tabs } from '@/components/ui';
import { VisorCaptura } from '@/components/VisorCaptura';
import { TabPracticasLibres } from './PracticasLibres';

const fecha = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-DO', { dateStyle: 'medium' }) : '—');
const fechaHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const medioTexto = (r: Registro) => (r.medio === 'correo' ? 'Correo' : r.medio === 'otra' ? `Otra vía${r.otra_via ? `: ${r.otra_via}` : ''}` : '—');

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <code className="flex-1 break-all rounded bg-gray-100 px-2 py-1 text-xs dark:bg-white/10">{texto}</code>
      <button className="btn-texto text-xs" onClick={() => void navigator.clipboard.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })}>{ok ? 'Copiado ✓' : 'Copiar'}</button>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
// Ficha de una entrega
// ------------------------------------------------------------------------------------------------------------------
function Ficha({ r, margen, repetido, onCambio }: { r: Registro; margen: number; repetido: boolean; onCambio: () => void }) {
  const [nota, setNota] = useState('');
  const [verHistorial, setVerHistorial] = useState(false);
  const hist = useAsync(() => (verHistorial ? historial(r.id) : Promise.resolve([])), [verHistorial, r.id, r.estado]);
  const accion = useAction();
  const [aviso, setAviso] = useState<string | null>(null);
  const b = busquedaCorreo(r, margen);
  const posibles = accionesPosibles(r.estado, !!r.localizada_at);
  const igual = Math.max(0, ...r.capturas.map((c) => c.igual_a_otros));

  async function hacer(acciones: AccionDocente[]) {
    for (const a of acciones) {
      const def = ACCIONES.find((x) => x.id === a)!;
      if (def.nota === 'obligatoria' && !nota.trim()) { accion.setError(`«${def.etiqueta}» necesita una nota.`); return; }
    }
    const res = await accion.run(async () => {
      let ultimo = null;
      for (const a of acciones) {
        ultimo = await revisar([r.id], a, nota.trim() || null);
        if (ultimo.errores.length) break;
      }
      return ultimo;
    });
    if (!res) return;
    if (res.errores.length) accion.setError(res.errores.map((e) => e.motivo).join(' · '));
    else { setAviso('Guardado en el historial.'); setNota(''); }
    onCambio();
  }

  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[10rem_1fr]">
        <dt className="font-semibold">Estudiante</dt><dd>{r.full_name}{r.student_code ? ` · ${r.student_code}` : ''} <span className="text-xs text-gray-500">({r.course_title} · {r.class_name}{r.group_name ? ` · ${r.group_name}` : ''})</span></dd>
        <dt className="font-semibold">Práctica</dt>
        <dd>Práctica {r.numero}{r.practica_titulo ? ` · ${r.practica_titulo}` : ''}{r.practica_archivada && <Badge tone="gray">archivada</Badge>}
          {r.tema && <span className="block">Tema declarado: {r.tema}</span>}{r.descripcion && <span className="block text-gray-600 dark:text-gray-300">{r.descripcion}</span>}</dd>
        <dt className="font-semibold">Medio de entrega</dt><dd>{r.medio === 'correo' ? 'Correo electrónico' : r.medio === 'otra' ? 'Otra vía' : '—'}{r.tipo === 'incidencia' && <> · <Badge tone="amber">incidencia: sin captura</Badge></>}</dd>
        <dt className="font-semibold">Origen del envío</dt>
        <dd>{r.medio === 'correo' ? (r.correo_remitente ?? <span className="text-amber-700">no indicó la dirección</span>) : <>{r.otra_via}{r.contacto && <span className="block">Cuenta o contacto: {r.contacto}</span>}</>}</dd>
        <dt className="font-semibold">Fecha declarada</dt><dd>{r.fecha_desconocida ? 'No la recuerda' : fecha(r.fecha_declarada)} <span className="text-xs text-gray-500">(declarada por el estudiante, no verificada)</span></dd>
        <dt className="font-semibold">Estado</dt>
        <dd><Badge tone={ESTADO[r.estado].tono}>{ESTADO[r.estado].docente}</Badge>
          <span className="block text-xs text-gray-500">Registrada {fechaHora(r.enviado_at)} · Localizada {fechaHora(r.localizada_at)} · Verificada {fechaHora(r.verificada_at)} · Convalidada {fechaHora(r.convalidada_at)}</span></dd>
        <dt className="font-semibold">Calificación</dt>
        <dd className="text-xs">
          Declarada ✓ · Convalidada {r.convalidada_at ? '✓' : '—'} · Calificada {r.calificacion ? `✓ (${r.calificacion.score}/${r.calificacion.max})` : '—'}
          <span className="block text-gray-500">{r.actividad ? `Asociada a la actividad «${r.actividad}». ` : 'Sin actividad asociada (se asocia en Catálogo). '}Este módulo no crea notas.</span>
        </dd>
      </dl>

      {r.motivo_incidencia && <Notice tone="warn">Incidencia: «{r.motivo_incidencia}». Puede revisarla de forma excepcional; no cuenta sola como entrega acreditada.</Notice>}
      {r.respuesta_estudiante && <Notice tone="info">Respuesta del estudiante: «{r.respuesta_estudiante}»</Notice>}
      {igual > 0 && <Notice tone="warn">La misma imagen exacta aparece en registros de {igual} estudiante(s) más. Es una observación para revisar, no una prueba de nada.</Notice>}
      {repetido && <Notice tone="warn">Este estudiante tiene otro registro de la misma práctica (quizá después de unir dos posiciones del catálogo).</Notice>}

      <div>
        <p className="mb-1 font-semibold">Evidencia</p>
        {r.capturas.length === 0 ? <p className="text-xs text-gray-500">Sin capturas.</p> : (
          <div className="space-y-2">
            {r.capturas.map((c) => <VisorCaptura key={c.id} id={c.id} etiqueta={c.posicion === 1 ? 'Captura principal' : `Complementaria ${c.posicion - 1}`} bytes={c.bytes} ancho={c.ancho} alto={c.alto} abierta={c.posicion === 1} />)}
          </div>
        )}
        <p className="mt-1 text-xs text-gray-500">La captura sirve para localizar el envío; por sí sola no es una verificación.</p>
      </div>

      <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
        <p className="mb-1 font-semibold">Para buscar el envío original</p>
        {r.medio === 'correo' ? (
          <div className="space-y-1">
            <p className="text-xs">En el buscador de su correo (sintaxis de Gmail / Google Workspace), margen ±{margen} días:</p>
            {b.gmail ? <Copiar texto={b.gmail} /> : <p className="text-xs text-gray-500">No hay dirección ni fecha para construir la búsqueda.</p>}
            {b.gmailConPalabras && <><p className="text-xs">Con palabras de la práctica (cualquiera de ellas):</p><Copiar texto={b.gmailConPalabras} /></>}
            {b.desde && <p className="text-xs text-gray-500">En Outlook u otro correo: busque <code>from:{r.correo_remitente ?? '…'}</code> y filtre los mensajes recibidos entre el {fecha(b.desde)} y el {fecha(b.hasta)}.</p>}
          </div>
        ) : (
          <p className="text-xs">Busque en <strong>{r.otra_via ?? 'el canal indicado'}</strong>{r.contacto ? <> la conversación con <strong>{r.contacto}</strong></> : ''}
            {b.desde ? ` entre el ${fecha(b.desde)} y el ${fecha(b.hasta)}` : ''}{b.palabras.length ? `; palabras útiles: ${b.palabras.join(', ')}` : ''}.</p>
        )}
        <p className="mt-1 text-xs text-gray-500">La plataforma no accede a su correo: la búsqueda la hace usted.</p>
      </div>

      {posibles.length > 0 && (
        <div className="space-y-2">
          <textarea className="campo min-h-[3rem]" maxLength={1000} placeholder="Nota (obligatoria para aclaración, observación o revertir; el estudiante la verá)" value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {posibles.map((a) => {
              const def = ACCIONES.find((x) => x.id === a)!;
              return <button key={a} title={def.ayuda} className={a === 'convalidada' ? 'btn-primario' : a === 'no_localizada' || a === 'observada' ? 'btn-peligro' : 'btn-secundario'} disabled={accion.busy} onClick={() => void hacer([a])}>{def.etiqueta}</button>;
            })}
            {posibles.includes('localizada') && !r.localizada_at && <button className="btn-secundario" title="Registra dos pasos: localizada y verificada" disabled={accion.busy} onClick={() => void hacer(['localizada', 'verificada'])}>Localizada y verificada</button>}
          </div>
          <p className="text-xs text-gray-500">Localizada = encontré el mensaje · Verificada = el mensaje contiene esta práctica · Convalidar = reconocimiento oficial (sin nota).</p>
        </div>
      )}
      {aviso && <Notice tone="ok">{aviso}</Notice>}
      <ErrorBox error={accion.error} />

      <div>
        <button className="btn-texto text-sm" onClick={() => setVerHistorial(!verHistorial)}>{verHistorial ? 'Ocultar historial' : 'Ver historial de cambios'}</button>
        {verHistorial && (hist.loading ? <Spinner /> : (
          <ul className="mt-1 space-y-1 text-xs">
            {(hist.data ?? []).map((e, i) => (
              <li key={i}>{fechaHora(e.at)} · {e.papel === 'docente' ? e.actor_name ?? 'Profesor' : 'Estudiante'} · {e.accion.replace(/_/g, ' ')}
                {e.estado_antes !== e.estado_despues && e.estado_despues ? ` (${e.estado_antes ?? '—'} → ${e.estado_despues})` : ''}{e.nota ? ` · «${e.nota}»` : ''}</li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
// Localizador
// ------------------------------------------------------------------------------------------------------------------
function Localizador({ classId, margenInicial }: { classId: string | null; margenInicial: number }) {
  const st = useAsync(() => cargarRegistros(classId), [classId]);
  const [f, setF] = useState<Filtros>(FILTROS_VACIOS);
  const [margen, setMargen] = useState(margenInicial);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [notaLote, setNotaLote] = useState('');
  const accion = useAction();
  const todos = useMemo(() => st.data ?? [], [st.data]);
  const lista = useMemo(() => filtrar(todos, f), [todos, f]);
  const t = totales(todos);
  const rep = useMemo(() => duplicados(todos), [todos]);
  const opciones = (k: (r: Registro) => [string, string] | null) => [...new Map(todos.map(k).filter((x): x is [string, string] => !!x)).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const cursos = opciones((r) => [r.course_id, r.course_title]);
  const secciones = opciones((r) => [r.class_id, `${r.course_title} · ${r.class_name}`]);
  const grupos = opciones((r) => (r.group_id ? [r.group_id, r.group_name ?? ''] : null));
  const numeros = [...new Set(todos.map((r) => r.numero))].sort((a, b) => a - b);
  const actual = todos.find((r) => r.id === abierto) ?? null;

  async function lote(a: AccionDocente) {
    const def = ACCIONES.find((x) => x.id === a)!;
    if (def.nota === 'obligatoria' && !notaLote.trim()) { accion.setError(`«${def.etiqueta}» necesita una nota.`); return; }
    const res = await accion.run(() => revisar([...marcados], a, notaLote.trim() || null));
    if (!res) return;
    if (res.errores.length) accion.setError(`Aplicada a ${res.aplicadas}. Sin aplicar ${res.errores.length}: ${[...new Set(res.errores.map((e) => e.motivo))].join(' · ')}`);
    setMarcados(new Set()); setNotaLote('');
    void st.reload();
  }

  if (st.loading && !st.data) return <Spinner />;
  return (
    <div className="space-y-4">
      <ErrorBox error={st.error} onRetry={() => void st.reload()} />
      <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4 lg:grid-cols-8">
        {[
          ['Estudiantes', t.estudiantes, ''], ['Declaradas', t.declaradas, ''], ['Con captura', t.evidencias, ''], ['Por localizar', t.porLocalizar, 'por_revisar'],
          ['Localizadas', t.localizadas, 'localizada'], ['Verificadas', t.verificadas, 'verificada'], ['Convalidadas', t.convalidadas, 'convalidada'], ['Observadas', t.observadas + t.noLocalizadas, 'observada'],
        ].map(([k, v, e]) => (
          <button key={k as string} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5" onClick={() => setF({ ...FILTROS_VACIOS, estado: e as Filtros['estado'] })}>
            <div className="text-xl font-semibold tabular-nums">{v as number}</div><div className="text-xs text-gray-500">{k as string}</div>
          </button>
        ))}
      </div>
      {t.incidencias > 0 && <p className="text-xs"><button className="enlace" onClick={() => setF({ ...FILTROS_VACIOS, tipo: 'incidencia' })}>{t.incidencias} incidencia(s)</button> de estudiantes que perdieron la evidencia.</p>}

      <Card>
        <div className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <input className="campo" placeholder="Estudiante, correo, contacto…" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
          {cursos.length > 1 && <select className="campo" value={f.curso} onChange={(e) => setF({ ...f, curso: e.target.value })}><option value="">Todas las asignaturas</option>{cursos.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
          {secciones.length > 1 && <select className="campo" value={f.seccion} onChange={(e) => setF({ ...f, seccion: e.target.value })}><option value="">Todas las secciones</option>{secciones.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
          {grupos.length > 0 && <select className="campo" value={f.grupo} onChange={(e) => setF({ ...f, grupo: e.target.value })}><option value="">Todos los grupos</option>{grupos.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
          <select className="campo" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })}><option value="">Toda práctica</option>{numeros.map((n) => <option key={n} value={n}>Práctica {n}</option>)}</select>
          <select className="campo" value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value as Filtros['medio'] })}><option value="">Todo medio</option><option value="correo">Correo</option><option value="otra">Otra vía</option></select>
          <select className="campo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Filtros['tipo'] })}><option value="">Evidencias e incidencias</option><option value="evidencia">Con captura</option><option value="incidencia">Incidencias</option></select>
          <select className="campo" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as Filtros['estado'] })}>
            <option value="">Todo estado</option><option value="por_revisar">Por localizar</option>
            {(Object.keys(ESTADO) as Estado[]).filter((e) => e !== 'borrador').map((e) => <option key={e} value={e}>{ESTADO[e].docente}</option>)}
          </select>
          <label className="text-xs">Fecha declarada desde<input type="date" className="campo" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></label>
          <label className="text-xs">hasta<input type="date" className="campo" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
          <label className="text-xs">Margen de búsqueda (días)<input type="number" min={0} max={60} className="campo" value={margen} onChange={(e) => setMargen(Math.max(0, Math.min(60, Number(e.target.value) || 0)))} /></label>
          <button className="btn-texto text-sm" onClick={() => setF(FILTROS_VACIOS)}>Quitar filtros</button>
        </div>
      </Card>

      {marcados.size > 0 && (
        <Card title={`${marcados.size} seleccionado(s)`}>
          <input className="campo mb-2 text-sm" maxLength={1000} placeholder="Nota (obligatoria para aclaración u observación)" value={notaLote} onChange={(e) => setNotaLote(e.target.value)} />
          <div className="flex flex-wrap gap-2 text-sm">
            {(['localizada', 'verificada', 'no_localizada', 'aclaracion', 'observada', 'convalidada'] as AccionDocente[]).map((a) => (
              <button key={a} className="btn-secundario" disabled={accion.busy} onClick={() => void lote(a)}>{ACCIONES.find((x) => x.id === a)!.etiqueta}</button>
            ))}
            <button className="btn-texto" onClick={() => setMarcados(new Set())}>Deseleccionar</button>
          </div>
          <p className="mt-1 text-xs text-gray-500">Cada acción se comprueba registro por registro (p. ej. no se verifica lo que no se ha localizado).</p>
        </Card>
      )}
      <ErrorBox error={accion.error} />

      {lista.length === 0 ? <Empty>{todos.length ? 'Ningún registro con esos filtros.' : 'Todavía no hay registros enviados por los estudiantes.'}</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="p-2"><input type="checkbox" aria-label="Seleccionar todo" checked={lista.every((r) => marcados.has(r.id))} onChange={(e) => setMarcados(e.target.checked ? new Set(lista.map((r) => r.id)) : new Set())} /></th>
                <th className="p-2">Estudiante</th><th className="p-2">Práctica</th><th className="p-2">Medio</th><th className="p-2">Fecha declarada</th><th className="p-2">Evidencia</th><th className="p-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {lista.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => setAbierto(r.id)}>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Seleccionar ${r.full_name}`} checked={marcados.has(r.id)} onChange={(e) => setMarcados((m) => { const n = new Set(m); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                  </td>
                  <td className="p-2">{r.full_name}{secciones.length > 1 && <span className="block text-xs text-gray-500">{r.class_name}</span>}</td>
                  <td className="p-2">P{r.numero}{r.tema && <span className="block max-w-[14rem] truncate text-xs text-gray-500">{r.tema}</span>}{rep.has(r.id) && <Badge tone="amber">repetida</Badge>}</td>
                  <td className="p-2">{medioTexto(r)}{r.correo_remitente && <span className="block max-w-[14rem] truncate text-xs text-gray-500">{r.correo_remitente}</span>}</td>
                  <td className="p-2 whitespace-nowrap">{r.fecha_desconocida ? 'No la recuerda' : fecha(r.fecha_declarada)}</td>
                  <td className="p-2">{r.tipo === 'incidencia' ? <Badge tone="amber">incidencia</Badge> : `${r.capturas.length} captura(s)`}{r.capturas.some((c) => c.igual_a_otros > 0) && <Badge tone="amber">imagen igual</Badge>}</td>
                  <td className="p-2"><Badge tone={ESTADO[r.estado].tono}>{ESTADO[r.estado].docente}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!actual} onClose={() => setAbierto(null)} title="Ficha de la entrega">
        {actual && <Ficha r={actual} margen={margen} repetido={rep.has(actual.id)} onCambio={() => void st.reload()} />}
      </Modal>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
// Resumen por estudiante
// ------------------------------------------------------------------------------------------------------------------
function Resumen({ classId }: { classId: string }) {
  const st = useAsync(async () => {
    const [filas, fin] = await Promise.all([resumen(classId), terminados(classId)]);
    return { filas, fin: new Map(fin.map((t) => [t.user_id, t])) };
  }, [classId]);
  const accion = useAction();
  if (st.loading && !st.data) return <Spinner />;
  const filas = st.data?.filas ?? [];
  const fin = st.data?.fin ?? new Map();
  const nTerminaron = filas.filter((s) => fin.get(s.user_id)?.finalizado_at).length;
  const n = (v: number) => (v ? v : <span className="text-gray-400">—</span>);
  const reabrir = (userId: string, nombre: string) => {
    if (!window.confirm(`¿Reabrir la regularización a ${nombre}? Podrá añadir registros y volverá a ver el aviso al entrar.`)) return;
    void accion.run(async () => { await reabrirEstudiante(classId, userId, null); void st.reload(); });
  };
  return (
    <div>
      <ErrorBox error={st.error ?? accion.error} />
      <p className="mb-2 text-sm"><strong>{nTerminaron} de {filas.length}</strong> estudiantes marcaron que terminaron.</p>
      <p className="mb-2 text-xs text-gray-500">Un estudiante sin declaraciones aparece con guiones: no es un incumplimiento ni un cero, solo que no ha registrado nada.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>{['Estudiante', 'Terminó', 'Grupo', 'Con captura', 'Incidencias', 'Por localizar', 'Localizadas', 'Verificadas', 'Convalidadas', 'Observadas / no loc.', 'Aclaración', 'Borradores', 'Sugerencias'].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums dark:divide-white/10">
            {filas.map((s) => (
              <tr key={s.user_id}>
                <td className="p-2">{s.full_name}{s.student_code && <span className="block text-xs text-gray-500">{s.student_code}</span>}</td>
                <td className="p-2 text-xs">
                  {fin.get(s.user_id)?.finalizado_at ? (
                    <>
                      <Badge tone="green">Sí</Badge> <span className="text-gray-500">{fechaHora(fin.get(s.user_id)!.finalizado_at)}</span>
                      {fin.get(s.user_id)!.sin_practicas && <span className="block text-gray-500">Sin prácticas que regularizar</span>}
                      {fin.get(s.user_id)!.nota && <span className="block text-gray-500">«{fin.get(s.user_id)!.nota}»</span>}
                      <button className="btn-texto block text-xs" disabled={accion.busy} onClick={() => reabrir(s.user_id, s.full_name)}>Reabrir</button>
                    </>
                  ) : fin.get(s.user_id)?.reabierto_at ? <span className="text-amber-700 dark:text-amber-300">Reabierta</span> : <span className="text-gray-400">No</span>}
                </td>
                <td className="p-2 text-xs">{s.group_name ?? '—'}</td>
                <td className="p-2">{n(s.registradas)}</td><td className="p-2">{n(s.incidencias)}</td><td className="p-2">{n(s.pendientes)}</td><td className="p-2">{n(s.localizadas)}</td>
                <td className="p-2">{n(s.verificadas)}</td><td className="p-2">{n(s.convalidadas)}</td><td className="p-2">{n(s.observadas + s.no_localizadas)}</td>
                <td className="p-2">{n(s.aclaraciones)}</td><td className="p-2">{n(s.borradores)}</td><td className="p-2">{n(s.sugerencias)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
// Sugerencias «Profesor, recuerdo otra práctica»
// ------------------------------------------------------------------------------------------------------------------
function GrupoSugerencias({ grupo, practicas, onCambio }: { grupo: SugerenciaDocente[]; practicas: PracticaDocente[]; onCambio: () => void }) {
  const pendientes = grupo.filter((s) => s.estado === 'pendiente');
  const [sel, setSel] = useState<Set<string>>(new Set(pendientes.map((s) => s.id)));
  const [titulo, setTitulo] = useState(grupo.find((s) => s.tema)?.tema ?? '');
  const [rel, setRel] = useState('');
  const [nota, setNota] = useState('');
  const accion = useAction();
  const decidir = (d: 'confirmada' | 'relacionada' | 'descartada' | 'pendiente') => void accion.run(async () => {
    await decidirSugerencias([...sel], d, d === 'relacionada' ? rel : null, d === 'confirmada' ? titulo : null, nota || null);
    onCambio();
  });
  return (
    <Card title={<>{grupo.length > 1 ? `${grupo.length} sugerencias parecidas` : 'Sugerencia'} {pendientes.length === 0 && <Badge tone="gray">decidida</Badge>}</>}>
      <ul className="space-y-1 text-sm">
        {grupo.map((s) => (
          <li key={s.id} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={sel.has(s.id)} onChange={(e) => setSel((m) => { const n = new Set(m); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
            <div>
              <span className="font-medium">{s.tema}</span> <span className="text-xs text-gray-500">— {s.full_name}{s.fecha_aprox ? ` · ${fecha(s.fecha_aprox)}` : ''}{s.total_estimado ? ` · cree que fueron ${s.total_estimado}` : ''}</span>
              {(s.descripcion || s.comentarios) && <span className="block text-xs text-gray-600 dark:text-gray-300">{[s.descripcion, s.comentarios].filter(Boolean).join(' · ')}</span>}
              {s.estado !== 'pendiente' && <span className="block text-xs text-gray-500">{s.estado}{s.numero ? ` → práctica ${s.numero}` : ''}{s.nota_revision ? ` · «${s.nota_revision}»` : ''}</span>}
            </div>
          </li>
        ))}
      </ul>
      {sel.size > 0 && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1">Título de la práctica nueva<input className="campo" maxLength={160} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>
            <button className="btn-primario" disabled={accion.busy} onClick={() => decidir('confirmada')}>Confirmar como práctica nueva</button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <select className="campo flex-1" value={rel} onChange={(e) => setRel(e.target.value)}>
              <option value="">Relacionar con una práctica existente…</option>
              {practicas.filter((p) => !p.archivada).map((p) => <option key={p.id} value={p.id}>Práctica {p.numero}{p.titulo ? ` · ${p.titulo}` : ''}</option>)}
            </select>
            <button className="btn-secundario" disabled={!rel || accion.busy} onClick={() => decidir('relacionada')}>Relacionar</button>
            <button className="btn-peligro" disabled={accion.busy} onClick={() => decidir('descartada')}>Descartar</button>
            {pendientes.length < grupo.length && <button className="btn-texto" disabled={accion.busy} onClick={() => decidir('pendiente')}>Volver a pendiente</button>}
          </div>
          <input className="campo" maxLength={500} placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
          <ErrorBox error={accion.error} />
        </div>
      )}
    </Card>
  );
}

function Sugerencias({ classId, practicas, onCambio }: { classId: string; practicas: PracticaDocente[]; onCambio: () => void }) {
  const st = useAsync(() => cargarSugerencias(classId), [classId]);
  const lista = useMemo(() => st.data ?? [], [st.data]);
  const grupos = useMemo(() => agruparSugerencias(lista), [lista]);
  const est = estimacionTotal(lista);
  if (st.loading) return <Spinner />;
  return (
    <div className="space-y-3">
      <ErrorBox error={st.error} />
      {est.respuestas > 0 && (
        <Notice tone="info">
          {est.respuestas} estudiante(s) indicaron cuántas prácticas hubo: mediana {est.mediana}, la respuesta más repetida {est.moda} ({est.conteo.map(([v, n]) => `${v}: ${n}`).join(' · ')}).
          Ajuste la cantidad en «Catálogo» si lo considera.
        </Notice>
      )}
      {grupos.length === 0 ? <Empty>No hay sugerencias de prácticas adicionales.</Empty> : grupos.map((g) => (
        <GrupoSugerencias key={g.map((s) => s.id).join()} grupo={g} practicas={practicas} onCambio={() => { void st.reload(); onCambio(); }} />
      ))}
      <p className="text-xs text-gray-500">Las sugerencias se agrupan por temas parecidos. Confirmar añade una práctica al catálogo histórico; nunca crea actividades oficiales.</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
// Catálogo y configuración
// ------------------------------------------------------------------------------------------------------------------
function FilaPractica({ classId, p, practicas, actividades, onCambio }: { classId: string; p: PracticaDocente; practicas: PracticaDocente[]; actividades: ConfigSeccion['actividades']; onCambio: () => void }) {
  const [f, setF] = useState({ numero: p.numero, titulo: p.titulo, descripcion: p.descripcion });
  const [unir, setUnir] = useState('');
  const accion = useAction();
  const hacer = (fn: () => Promise<unknown>) => void accion.run(async () => { await fn(); onCambio(); });
  const cambiado = f.numero !== p.numero || f.titulo !== p.titulo || f.descripcion !== p.descripcion;
  return (
    <tr className={p.archivada ? 'opacity-60' : ''}>
      <td className="p-2"><input type="number" min={1} max={99} className="campo w-16" value={f.numero} disabled={p.archivada} onChange={(e) => setF({ ...f, numero: Number(e.target.value) })} /></td>
      <td className="p-2">
        <input className="campo" maxLength={160} placeholder={p.provisional ? '(provisional, sin título)' : ''} value={f.titulo} disabled={p.archivada} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        <input className="campo mt-1 text-xs" maxLength={1000} placeholder="Descripción" value={f.descripcion} disabled={p.archivada} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        <span className="text-xs text-gray-500">{p.provisional ? 'provisional' : p.origen === 'sugerencia' ? 'de una sugerencia' : 'confirmada'}{p.archivada ? ' · archivada' : ''}{p.unida_a ? ` · unida a la práctica ${practicas.find((x) => x.id === p.unida_a)?.numero ?? '?'}` : ''}</span>
        <ErrorBox error={accion.error} />
      </td>
      <td className="p-2 text-center tabular-nums">{p.declaraciones}{p.borradores ? <span className="block text-xs text-gray-500">+{p.borradores} borr.</span> : null}</td>
      <td className="p-2">
        <select className="campo text-xs" value={p.activity_id ?? ''} disabled={p.archivada} onChange={(e) => hacer(() => vincularActividad(p.id, e.target.value || null))}>
          <option value="">— sin asociar —</option>
          {actividades.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </td>
      <td className="p-2">
        <div className="flex flex-col gap-1 text-xs">
          {cambiado && <button className="btn-primario text-xs" disabled={accion.busy} onClick={() => hacer(() => guardarPractica({ id: p.id, class_id: classId, numero: f.numero, titulo: f.titulo, descripcion: f.descripcion }))}>Guardar</button>}
          <button className="btn-texto text-xs" disabled={accion.busy} onClick={() => hacer(() => archivarPractica(p.id, !p.archivada))}>{p.archivada ? 'Restaurar' : 'Archivar'}</button>
          {!p.archivada && (
            <span className="flex gap-1">
              <select className="campo text-xs" value={unir} onChange={(e) => setUnir(e.target.value)}>
                <option value="">Unir con…</option>
                {practicas.filter((x) => !x.archivada && x.id !== p.id).map((x) => <option key={x.id} value={x.id}>P{x.numero}{x.titulo ? ` · ${x.titulo}` : ''}</option>)}
              </select>
              {unir && <button className="btn-texto text-xs" disabled={accion.busy} onClick={() => { if (window.confirm(`Las declaraciones de la práctica ${p.numero} pasarán a la práctica elegida y esta quedará archivada. ¿Continuar?`)) hacer(() => unirPracticas(p.id, unir, '')); }}>Unir</button>}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function Catalogo({ classId, c, onCambio }: { classId: string; c: ConfigSeccion; onCambio: () => void }) {
  const activas = c.practicas.filter((p) => !p.archivada).length;
  const [f, setF] = useState({ abierto: c.abierto, mensaje: c.mensaje, margen_dias: c.margen_dias, max_mb_captura: c.max_mb_captura, cuota_mb: c.cuota_mb, max_registros: c.max_registros, espacios: activas || 10 });
  const [nueva, setNueva] = useState({ titulo: '', descripcion: '' });
  const [resultado, setResultado] = useState<string | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [recordar, setRecordar] = useState(c.recordar ?? true);
  const accion = useAction();
  const uso = c.almacenamiento.bytes_seccion / (c.cuota_mb * 1048576);
  async function guardar() {
    const r = await accion.run(() => configurar(classId, f));
    if (!r) return;
    setResultado(`Guardado. Prácticas activas: ${r.activas}.${r.creadas ? ` Se añadieron ${r.creadas}.` : ''}${r.archivadas ? ` Se archivaron ${r.archivadas} vacías.` : ''}${r.conservadas ? ` Se conservaron ${r.conservadas} que tienen título, declaraciones o sugerencias.` : ''}`);
    onCambio();
  }
  return (
    <div className="space-y-4">
      <Card title="Configuración de la sección">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={f.abierto} onChange={(e) => setF({ ...f, abierto: e.target.checked })} /> Abierta: los estudiantes pueden registrar y corregir</label>
          <label className="flex items-start gap-2 sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={recordar} disabled={accion.busy} onChange={(e) => { const v = e.target.checked; void accion.run(async () => { await recordatorio(classId, v); setRecordar(v); onCambio(); }); }} />
            <span>Aviso obligatorio al entrar: a quien no haya marcado «Terminé» le aparece un mensaje cada vez que accede a la plataforma (se guarda al momento).
              {typeof c.terminados === 'number' && <span className="block text-xs text-gray-500">{c.terminados} estudiante(s) ya marcaron que terminaron.</span>}</span>
          </label>
          <label className="sm:col-span-2">Mensaje para los estudiantes (opcional)<textarea className="campo min-h-[3rem]" maxLength={1000} value={f.mensaje} onChange={(e) => setF({ ...f, mensaje: e.target.value })} /></label>
          <label>Cantidad de prácticas (estimación)<input type="number" min={0} max={99} className="campo" value={f.espacios} onChange={(e) => setF({ ...f, espacios: Number(e.target.value) })} /></label>
          <label>Margen de búsqueda en el correo (días)<input type="number" min={0} max={60} className="campo" value={f.margen_dias} onChange={(e) => setF({ ...f, margen_dias: Number(e.target.value) })} /></label>
          <label>Máximo por captura, ya optimizada (MB)<input type="number" min={0.5} max={5} step={0.5} className="campo" value={f.max_mb_captura} onChange={(e) => setF({ ...f, max_mb_captura: Number(e.target.value) })} /></label>
          <label>Espacio reservado para la sección (MB)<input type="number" min={10} max={2000} className="campo" value={f.cuota_mb} onChange={(e) => setF({ ...f, cuota_mb: Number(e.target.value) })} /></label>
          <label>Registros máximos por estudiante<input type="number" min={1} max={200} className="campo" value={f.max_registros} onChange={(e) => setF({ ...f, max_registros: Number(e.target.value) })} /></label>
        </div>
        <p className="mt-2 text-xs text-gray-500">Reducir la cantidad solo archiva posiciones provisionales vacías; nunca borra declaraciones. Cada estudiante puede adjuntar una captura principal y hasta dos complementarias por registro.</p>
        <ErrorBox error={accion.error} />
        {resultado && <Notice tone="ok">{resultado}</Notice>}
        <button className="btn-primario mt-2" disabled={accion.busy} onClick={() => void guardar()}>Guardar configuración</button>
      </Card>

      <Card title="Almacenamiento de capturas">
        <ProgressBar value={uso} label={`Esta sección: ${kb(c.almacenamiento.bytes_seccion)} de ${c.cuota_mb} MB (${c.almacenamiento.archivos_seccion} archivos)`} tone={uso > 0.8 ? 'amber' : 'blue'} />
        <p className="mt-2 text-xs text-gray-500">Todo el módulo (todas las secciones): {kb(c.almacenamiento.bytes_modulo)} en {c.almacenamiento.archivos_modulo} archivos. Las imágenes están en el almacenamiento privado, no en la base de datos.</p>
      </Card>

      <Card title={`Catálogo histórico (${activas} activas)`} actions={<button className="btn-texto text-sm" onClick={() => setVerArchivadas(!verArchivadas)}>{verArchivadas ? 'Ocultar archivadas' : 'Ver archivadas'}</button>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="p-2">N.º</th><th className="p-2">Título y descripción</th><th className="p-2">Declaraciones</th><th className="p-2">Actividad del registro de calificaciones</th><th className="p-2"></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {c.practicas.filter((p) => verArchivadas || !p.archivada).map((p) => (
                <FilaPractica key={`${p.id}-${p.numero}-${p.titulo}-${p.archivada}`} classId={classId} p={p} practicas={c.practicas} actividades={c.actividades} onCambio={onCambio} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
          <label className="flex-1">Añadir práctica<input className="campo" maxLength={160} placeholder="Título" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} /></label>
          <button className="btn-secundario" disabled={accion.busy} onClick={() => void accion.run(async () => {
            const num = Math.max(0, ...c.practicas.filter((p) => !p.archivada).map((p) => p.numero)) + 1;
            await guardarPractica({ id: null, class_id: classId, numero: num, titulo: nueva.titulo, descripcion: nueva.descripcion });
            setNueva({ titulo: '', descripcion: '' }); onCambio();
          })}>Añadir</button>
        </div>
        <p className="mt-2 text-xs text-gray-500">Asociar una práctica con una actividad solo las relaciona: no crea ni cambia notas, y una actividad no puede asociarse a dos prácticas.</p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
type Vista = 'localizador' | 'resumen' | 'sugerencias' | 'catalogo' | 'libre';

/** Contenido para una sección concreta (pestaña de la sección) o para todas (classId null, solo el localizador). */
export function RegularizacionSeccion({ classId }: { classId: string }) {
  const cfg = useAsync(() => configSeccion(classId), [classId]);
  const [vista, setVista] = useState<Vista | null>(null);
  const accion = useAction();
  if (cfg.loading && !cfg.data) return <Spinner />;
  if (cfg.error) return <ErrorBox error={cfg.error} onRetry={() => void cfg.reload()} />;
  const c = cfg.data!;
  if (!c.configurado) {
    return (
      <div className="space-y-4">
        <Card title="Prácticas enviadas por correo u otra vía">
          <p className="text-sm">Los estudiantes indican qué prácticas entregaron antes del aula virtual, por qué medio y cuándo, con <strong>una captura del envío</strong>. No suben los documentos.
            Usted localiza cada envío en su propio correo (la plataforma no se conecta a él), lo verifica y, si procede, lo convalida. Nada crea notas.</p>
          <ErrorBox error={accion.error} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primario" disabled={accion.busy} onClick={() => void accion.run(async () => { await configurar(classId, { abierto: true, espacios: 10 }); void cfg.reload(); })}>Activar y abrir con 10 prácticas provisionales</button>
            <button className="btn-secundario" disabled={accion.busy} onClick={() => void accion.run(async () => { await configurar(classId, { abierto: false, espacios: 10 }); void cfg.reload(); })}>Preparar sin abrir</button>
          </div>
        </Card>
        <TabPracticasLibres classId={classId} />
      </div>
    );
  }
  const actual: Vista = vista ?? (!c.abierto && c.libre_habilitado ? 'libre' : 'localizador');
  return (
    <div>
      {!c.abierto && actual !== 'libre' && <div className="mb-3"><Notice tone="warn">La modalidad por correo está cerrada para los estudiantes (pueden ver sus registros, no modificarlos). Ábrala en «Catálogo y configuración».</Notice></div>}
      <Tabs<Vista> value={actual} onChange={setVista} tabs={[
        { id: 'localizador', label: 'Localizador' }, { id: 'resumen', label: 'Por estudiante' }, { id: 'sugerencias', label: 'Sugerencias' }, { id: 'catalogo', label: 'Catálogo y configuración' },
        { id: 'libre', label: 'Prácticas sin correo' },
      ]} />
      {actual === 'libre' && <TabPracticasLibres classId={classId} />}
      {actual === 'localizador' && <Localizador classId={classId} margenInicial={c.margen_dias} />}
      {actual === 'resumen' && <Resumen classId={classId} />}
      {actual === 'sugerencias' && <Sugerencias classId={classId} practicas={c.practicas} onCambio={() => void cfg.reload()} />}
      {actual === 'catalogo' && <Catalogo classId={classId} c={c} onCambio={() => void cfg.reload()} />}
    </div>
  );
}

export default function Regularizacion() {
  const secs = useAsync(() => teacherOverview(), []);
  const [sel, setSel] = useState<string>('');
  const lista = (secs.data ?? []).filter((s) => !s.archived);
  return (
    <div>
      <PageTitle title="Prácticas anteriores" subtitle="Localizador de entregas históricas (regularización mediante evidencias)" back={{ to: '/docente', label: 'Panel docente' }}
        actions={sel ? <Link className="btn-secundario" to={`/docente/clases/${sel}?t=regularizacion`}>Abrir en la sección</Link> : undefined} />
      {secs.loading ? <Spinner /> : (
        <>
          <ErrorBox error={secs.error} />
          <select className="campo mb-4 w-auto" value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Sección">
            <option value="">Todas mis secciones (solo localizador)</option>
            {lista.map((s) => <option key={s.class_id} value={s.class_id}>{s.course_title} · {s.name}</option>)}
          </select>
          {sel ? <RegularizacionSeccion key={sel} classId={sel} /> : <Localizador classId={null} margenInicial={7} />}
        </>
      )}
    </div>
  );
}
