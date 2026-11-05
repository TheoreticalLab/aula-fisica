/**
 * Panel docente · «Controles de laboratorio» de una sección (asignaturas con courses.laboratorio_controles, migración 84).
 * Tabla por estudiante con el estado de cada control, entregados y aprobados; filtros; detalle con las imágenes y su
 * historial; aprobar o pedir corrección (con nota); fechas generales o individuales. Nadie califica automáticamente.
 */
import { useMemo, useState } from 'react';
import { detalleLab, fechasLab, panelLab, revisarControl, type ControlLab, type FilaLab } from '@/api/laboratorio';
import { contar, cumpleFiltro, ESTADO_CONTROL, FILTROS_LAB, textoFechas, type EstadoControl, type FiltroLab } from '@/lib/laboratorio';
import { aInputFecha, deInputFecha, downloadText, fecha, toCsv, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Modal, Notice, Spinner } from '@/components/ui';
import { VisorControl } from '@/components/VisorControl';

const CELDA: Record<EstadoControl, string> = {
  pendiente: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
  entregado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  aprobado: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  requiere_correccion: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
};
const ESTADO_ENTREGA: Record<string, string> = { recibido: 'Sin revisar', aceptado: 'Aprobada', rechazado: 'Requiere corrección' };

export function TabControlesLab({ classId }: { classId: string }) {
  const { data, loading, error, reload } = useAsync(() => panelLab(classId), [classId]);
  const [filtro, setFiltro] = useState<FiltroLab>('todos');
  const [buscar, setBuscar] = useState('');
  const [abierto, setAbierto] = useState<FilaLab | null>(null);

  const filas = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (data?.estudiantes ?? []).filter((e) => cumpleFiltro(e.estados, filtro)
      && (!q || e.nombre.toLowerCase().includes(q) || (e.matricula ?? '').includes(q) || (e.login ?? '').toLowerCase().includes(q)));
  }, [data, filtro, buscar]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const p = data!;
  const n = p.controles;
  const completos = p.estudiantes.filter((e) => cumpleFiltro(e.estados, 'completos')).length;
  const sinRevisar = p.estudiantes.reduce((s, e) => s + e.sin_revisar, 0);
  const porCorregir = p.estudiantes.filter((e) => e.por_corregir > 0).length;

  const exportar = () => downloadText(`controles-${p.seccion}.csv`, toCsv([
    ['Nombre', 'Matrícula', 'Sección', ...Array.from({ length: n }, (_, i) => `Control ${i + 1}`), 'Entregados', 'Aprobados'],
    ...p.estudiantes.map((e) => [e.nombre, e.matricula ?? e.login ?? '', p.seccion, ...e.estados.map((s) => ESTADO_CONTROL[s].texto), e.entregados, e.aprobados]),
  ]));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Resumen titulo="Estudiantes" valor={p.estudiantes.length} />
        <Resumen titulo={`Con los ${n} entregados`} valor={completos} />
        <Resumen titulo="Entregas sin revisar" valor={sinRevisar} />
        <Resumen titulo="Con correcciones pendientes" valor={porCorregir} />
      </div>

      <Card title="Estudiantes y controles" actions={<button className="btn-texto text-sm" onClick={exportar}>Exportar CSV</button>}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FILTROS_LAB.map((f) => (
            <button key={f.id} className={filtro === f.id ? 'btn-primario text-sm' : 'btn-secundario text-sm'} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}>
              {f.texto}
            </button>
          ))}
          <input className="campo ml-auto w-full sm:w-56" placeholder="Buscar nombre o matrícula" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar estudiante" />
        </div>
        {filas.length === 0 ? <Empty>No hay estudiantes con ese filtro.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">Estudiante</th>
                  <th className="py-2 pr-3">Matrícula</th>
                  <th className="py-2 pr-3">Sección</th>
                  {Array.from({ length: n }, (_, i) => <th key={i} className="px-0.5 py-2 text-center">C{i + 1}</th>)}
                  <th className="py-2 pl-3 text-right">Entregados</th>
                  <th className="py-2 pl-3 text-right">Aprobados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {filas.map((e) => (
                  <tr key={e.user_id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => setAbierto(e)}>
                    <td className="py-2 pr-3"><button className="enlace text-left" onClick={(ev) => { ev.stopPropagation(); setAbierto(e); }}>{e.nombre || '(sin nombre)'}</button></td>
                    <td className="py-2 pr-3 tabular-nums">{e.matricula ?? e.login ?? '—'}</td>
                    <td className="py-2 pr-3">{p.seccion}</td>
                    {e.estados.map((s, i) => (
                      <td key={i} className="px-0.5 py-2 text-center">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded text-xs font-semibold ${CELDA[s]}`} title={`Control ${i + 1}: ${ESTADO_CONTROL[s].texto}`}>
                          {ESTADO_CONTROL[s].corto}
                        </span>
                      </td>
                    ))}
                    <td className="py-2 pl-3 text-right tabular-nums">{e.entregados}/{n}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{e.aprobados}/{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500">
              {(Object.keys(ESTADO_CONTROL) as EstadoControl[]).map((k) => <span key={k} className="mr-3">{ESTADO_CONTROL[k].corto} = {ESTADO_CONTROL[k].texto}</span>)}
            </p>
          </div>
        )}
      </Card>

      <FechasGenerales classId={classId} cajas={p.cajas} onCambio={reload} />

      {abierto && (
        <Modal open onClose={() => { setAbierto(null); reload(); }} title={`${abierto.nombre} · controles`}>
          <DetalleEstudiante classId={classId} userId={abierto.user_id} />
        </Modal>
      )}
    </div>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="tarjeta">
      <p className="text-xs uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

function DetalleEstudiante({ classId, userId }: { classId: string; userId: string }) {
  const { data, loading, error, reload } = useAsync(() => detalleLab(classId, userId), [classId, userId]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const d = data!;
  const c = contar(d.controles.map((x) => x.estado));
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Matrícula {d.estudiante.matricula ?? d.estudiante.login ?? '—'} · Controles entregados: <strong>{c.entregados}/{c.total}</strong> · aprobados: <strong>{c.aprobados}/{c.total}</strong>
      </p>
      {d.controles.map((x) => <ControlDocente key={x.box_id} classId={classId} userId={userId} control={x} onCambio={reload} />)}
    </div>
  );
}

function ControlDocente({ classId, userId, control: x, onCambio }: { classId: string; userId: string; control: ControlLab; onCambio: () => void }) {
  const [nota, setNota] = useState('');
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [fechas, setFechas] = useState(false);
  const accion = useAction();
  const vigente = x.historial[0];
  const anteriores = x.historial.slice(1);
  const est = ESTADO_CONTROL[x.estado];
  const revisar = (estado: 'aprobado' | 'requiere_correccion' | 'entregado') => accion.run(async () => {
    if (!vigente) return;
    if (estado === 'requiere_correccion' && !nota.trim() && !window.confirm('¿Pedir corrección sin escribir el motivo? El estudiante no sabrá qué cambiar.')) return;
    await revisarControl(vigente.id, estado, nota.trim() || null);
    setNota('');
    onCambio();
  });
  const rango = textoFechas(x.abre, x.cierra, fecha);
  return (
    <section className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Control {x.numero}</h3>
        <Badge tone={est.tono}>{est.texto}</Badge>
        {rango && <span className="text-xs text-gray-500">{rango}{x.fecha_individual && ' (fecha individual)'}</span>}
        <button className="btn-texto ml-auto text-xs" onClick={() => setFechas((v) => !v)}>{fechas ? 'Ocultar fechas' : 'Fecha individual'}</button>
      </div>
      {fechas && <FechasIndividuales classId={classId} userId={userId} control={x} onCambio={onCambio} />}
      {!vigente ? <p className="text-sm text-gray-500">Sin entregas.</p> : (
        <div className="space-y-2">
          <p className="text-sm">
            Enviado el <strong>{fecha(vigente.subido)}</strong> · {ESTADO_ENTREGA[vigente.estado]}
            {vigente.revisado && <span className="text-xs text-gray-500"> · revisado el {fecha(vigente.revisado)}</span>}
            {vigente.ancho && vigente.alto ? <span className="text-xs text-gray-500"> · {vigente.ancho}×{vigente.alto}</span> : null}
          </p>
          {vigente.nota && <p className="text-sm text-gray-700 dark:text-gray-300">Nota: {vigente.nota}</p>}
          <VisorControl fileId={vigente.id} etiqueta="Ver imagen" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="text-xs text-gray-500">Nota para el estudiante (opcional; necesaria si pide corrección)</span>
              <input className="campo w-full" value={nota} maxLength={1000} onChange={(e) => setNota(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              {vigente.estado !== 'aceptado' && <button className="btn-primario text-sm" disabled={accion.busy} onClick={() => void revisar('aprobado')}>Aprobar</button>}
              {vigente.estado !== 'rechazado' && <button className="btn-secundario text-sm" disabled={accion.busy} onClick={() => void revisar('requiere_correccion')}>Requiere corrección</button>}
              {vigente.estado !== 'recibido' && <button className="btn-texto text-sm" disabled={accion.busy} onClick={() => void revisar('entregado')}>Deshacer revisión</button>}
            </div>
          </div>
          {vigente.estado === 'rechazado' && <p className="text-xs text-gray-500">El estudiante puede subir una nueva imagen; esta se conservará en el historial.</p>}
          {accion.error && <p className="text-sm text-red-700 dark:text-red-400">{accion.error}</p>}
          {vigente.revisiones.length > 0 && (
            <details className="text-xs text-gray-600 dark:text-gray-400">
              <summary className="cursor-pointer">Registro de revisiones ({vigente.revisiones.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {vigente.revisiones.map((r, i) => (
                  <li key={i}>{fecha(r.en)}: {ESTADO_ENTREGA[r.de] ?? r.de} → {ESTADO_ENTREGA[r.a] ?? r.a}{r.nota && ` · «${r.nota}»`}</li>
                ))}
              </ul>
            </details>
          )}
          {anteriores.length > 0 && (
            <div>
              <button className="btn-texto text-xs" onClick={() => setVerAnteriores((v) => !v)}>
                {verAnteriores ? 'Ocultar entregas anteriores' : `Entregas anteriores (${anteriores.length})`}
              </button>
              {verAnteriores && (
                <ol className="mt-2 space-y-3">
                  {anteriores.map((h) => (
                    <li key={h.id} className="rounded bg-gray-50 p-2 dark:bg-white/5">
                      <p className="mb-1 text-xs">{fecha(h.subido)} · {ESTADO_ENTREGA[h.estado]}{h.nota && ` · «${h.nota}»`}</p>
                      <VisorControl fileId={h.id} etiqueta="Ver imagen anterior" />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FechasIndividuales({ classId, userId, control: x, onCambio }: { classId: string; userId: string; control: ControlLab; onCambio: () => void }) {
  const [abre, setAbre] = useState(x.fecha_individual ? aInputFecha(x.abre) : '');
  const [cierra, setCierra] = useState(x.fecha_individual ? aInputFecha(x.cierra) : '');
  const accion = useAction();
  return (
    <div className="mb-3 rounded bg-gray-50 p-2 text-sm dark:bg-white/5">
      <p className="mb-1 text-xs text-gray-500">Solo para este estudiante y este control. Vacías y «Guardar» = sin fecha individual (vuelven a valer las generales).</p>
      <div className="flex flex-wrap items-end gap-2">
        <label><span className="block text-xs">Abre</span><input type="datetime-local" className="campo" value={abre} onChange={(e) => setAbre(e.target.value)} /></label>
        <label><span className="block text-xs">Cierra</span><input type="datetime-local" className="campo" value={cierra} onChange={(e) => setCierra(e.target.value)} /></label>
        <button className="btn-secundario text-sm" disabled={accion.busy}
          onClick={() => void accion.run(async () => { await fechasLab(classId, x.numero, userId, deInputFecha(abre), deInputFecha(cierra)); onCambio(); })}>Guardar</button>
      </div>
      {accion.error && <p className="mt-1 text-red-700 dark:text-red-400">{accion.error}</p>}
    </div>
  );
}

function FechasGenerales({ classId, cajas, onCambio }: { classId: string; cajas: { numero: number; abre: string | null; cierra: string | null }[]; onCambio: () => void }) {
  const [numero, setNumero] = useState<number | null>(null);
  const [abre, setAbre] = useState('');
  const [cierra, setCierra] = useState('');
  const [hecho, setHecho] = useState<string | null>(null);
  const accion = useAction();
  const guardar = () => accion.run(async () => {
    setHecho(null);
    const n = await fechasLab(classId, numero, null, deInputFecha(abre), deInputFecha(cierra));
    setHecho(`Fechas guardadas en ${n} ${n === 1 ? 'control' : 'controles'}.`);
    onCambio();
  });
  return (
    <Card title="Fechas de los controles (toda la sección)">
      <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
        Por defecto los controles no tienen fechas: están abiertos. Puede fijar apertura y cierre para uno o para todos; las fechas individuales
        (en el detalle de cada estudiante) prevalecen sobre estas.
      </p>
      <ul className="mb-3 grid gap-1 text-xs text-gray-600 dark:text-gray-400 sm:grid-cols-2">
        {cajas.map((b) => <li key={b.numero}>Control {b.numero}: {textoFechas(b.abre, b.cierra, fecha) ?? 'sin fechas'}</li>)}
      </ul>
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label><span className="block text-xs">Control</span>
          <select className="campo" value={numero ?? ''} onChange={(e) => setNumero(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Todos</option>
            {cajas.map((b) => <option key={b.numero} value={b.numero}>Control {b.numero}</option>)}
          </select>
        </label>
        <label><span className="block text-xs">Abre</span><input type="datetime-local" className="campo" value={abre} onChange={(e) => setAbre(e.target.value)} /></label>
        <label><span className="block text-xs">Cierra</span><input type="datetime-local" className="campo" value={cierra} onChange={(e) => setCierra(e.target.value)} /></label>
        <button className="btn-secundario" disabled={accion.busy} onClick={() => void guardar()}>Guardar fechas</button>
      </div>
      <p className="mt-1 text-xs text-gray-500">Dejar ambas vacías quita las fechas (control siempre abierto).</p>
      {accion.error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{accion.error}</p>}
      {hecho && <div className="mt-2"><Notice tone="ok">{hecho}</Notice></div>}
    </Card>
  );
}
