/**
 * Página de una asignatura de LABORATORIO (migración 84), en lugar del programa de capítulos y lecciones:
 *  · Módulo A «Subir controles»: los N controles del estudiante (Laboratorio de Física Básica: 8). Una fotografía por
 *    control, con vista previa y confirmación; la hora la pone el servidor. Solo el profesor aprueba o pide corrección;
 *    una nueva imagen (tras «requiere corrección») no borra la anterior, que sigue en el historial.
 *  · Módulo B «Prácticas y/o exámenes»: las actividades de su sección, con el motor de evaluaciones de siempre.
 * (No confundir con /laboratorio, el laboratorio virtual de simulaciones.)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Course, MyActivity, Aviso } from '@/api/tipos';
import { misControles, subirControl, type ControlLab } from '@/api/laboratorio';
import { contar, ESTADO_CONTROL, MAX_BYTES_ENVIO, motivoArchivo, textoFechas } from '@/lib/laboratorio';
import { optimizarPizarra, type FotoPizarra } from '@/lib/imagen';
import { fecha, puntaje, relativo, useAsync } from '@/lib/util';
import { Badge, ErrorBox, Modal, Notice, PageTitle, ProgressBar, Spinner } from '@/components/ui';
import { VisorControl } from '@/components/VisorControl';

const kb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const ESTADO_ENTREGA: Record<string, string> = { recibido: 'Sin revisar', aceptado: 'Aprobada', rechazado: 'Requiere corrección' };

export default function LabCurso({ course, actividades, avisos, secciones, isTeacher }: {
  course: Course; actividades: MyActivity[]; avisos: Aviso[]; secciones: string[]; isTeacher: boolean;
}) {
  const { data, loading, error, reload } = useAsync(() => misControles(course.id), [course.id]);
  const [subiendo, setSubiendo] = useState<ControlLab | null>(null);
  const [viendo, setViendo] = useState<ControlLab | null>(null);
  const [recibido, setRecibido] = useState<string | null>(null);

  return (
    <div>
      <PageTitle title={course.title} subtitle={secciones.length ? `Sección: ${secciones.join(', ')}` : 'Asignatura de laboratorio'} />
      {course.description && <p className="mb-5 max-w-3xl text-sm text-gray-700 dark:text-gray-300">{course.description}</p>}
      {recibido && <div className="mb-4"><Notice tone="ok">{recibido}</Notice></div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section aria-labelledby="modulo-a">
            <h2 id="modulo-a" className="mb-1 font-serif text-2xl font-semibold">Módulo A · Subir controles</h2>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              Cada control se entrega como <strong>una fotografía</strong> (JPG, PNG o WEBP). Revise que se lea bien antes de enviarla: después
              solo podrá cambiarla si el profesor la marca «Requiere corrección».
            </p>
            {loading && <Spinner />}
            {error && <ErrorBox error={error} onRetry={reload} />}
            {data && data.secciones.length === 0 && (
              <Notice tone="info">
                {isTeacher
                  ? 'Como profesor, revise los controles en Panel docente → la sección → «Controles de laboratorio».'
                  : 'Todavía no está inscrito en una sección de esta asignatura.'}
              </Notice>
            )}
            {data?.secciones.map((s) => {
              const c = contar(s.controles.map((x) => x.estado));
              return (
                <div key={s.class_id} className="mb-6">
                  {data.secciones.length > 1 && (
                    <h3 className="mb-2 font-semibold">{s.seccion}{s.archivada && <span className="ml-2"><Badge>Periodo anterior</Badge></span>}</h3>
                  )}
                  <div className="tarjeta mb-3">
                    <ProgressBar value={c.total ? c.entregados / c.total : 0} tone={c.aprobados === c.total ? 'green' : 'blue'}
                      label={`Controles entregados: ${c.entregados}/${c.total}`} />
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      Aprobados: <strong>{c.aprobados}/{c.total}</strong>
                      {c.sinRevisar > 0 && <> · sin revisar: {c.sinRevisar}</>}
                      {c.porCorregir > 0 && <> · <span className="font-semibold text-amber-700 dark:text-amber-300">requieren corrección: {c.porCorregir}</span></>}
                    </p>
                    {s.controles.some((x) => x.cuenta === false) && (() => {
                      const cuentan = s.controles.filter((x) => x.cuenta !== false);
                      const fuera = s.controles.filter((x) => x.cuenta === false).map((x) => x.numero).join(', ');
                      return (
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Para la nota de Práctica cuentan {cuentan.length} controles (no cuenta: {fuera}); de esos tiene entregados{' '}
                          {contar(cuentan.map((x) => x.estado)).entregados}.
                        </p>
                      );
                    })()}
                  </div>
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {s.controles.map((x) => (
                      <TarjetaControl key={x.box_id} control={x} archivada={s.archivada} onSubir={() => { setRecibido(null); setSubiendo(x); }} onVer={() => setViendo(x)} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          <section aria-labelledby="modulo-b">
            <h2 id="modulo-b" className="mb-3 font-serif text-2xl font-semibold">Módulo B · Prácticas y/o exámenes</h2>
            <Actividades actividades={actividades} />
          </section>
        </div>

        <aside className="space-y-4">
          {avisos.length > 0 && (
            <div className="tarjeta">
              <p className="mb-2 text-sm font-semibold">Avisos del profesor</p>
              <ul className="space-y-2 text-sm">
                {avisos.slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <p className="font-medium">{a.pinned && '📌 '}{a.title}</p>
                    {a.body && <p className="whitespace-pre-line text-xs text-gray-600 dark:text-gray-300">{a.body}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="tarjeta text-sm text-gray-700 dark:text-gray-300">
            <p className="mb-1 font-semibold">Estados de un control</p>
            <ul className="space-y-1">
              {Object.entries(ESTADO_CONTROL).map(([k, v]) => <li key={k}><Badge tone={v.tono}>{v.texto}</Badge></li>)}
            </ul>
            <p className="mt-2 text-xs text-gray-500">«Entregado» significa recibido y pendiente de revisión. Solo el profesor aprueba.</p>
          </div>
        </aside>
      </div>

      {subiendo && (
        <SubirControl control={subiendo} onClose={() => setSubiendo(null)}
          onListo={(subido) => { setSubiendo(null); setRecibido(`Control ${subiendo.numero} recibido el ${fecha(subido)}.`); reload(); }} />
      )}
      <Modal open={!!viendo} onClose={() => setViendo(null)} title={viendo ? `Control ${viendo.numero} · mis entregas` : ''}>
        {viendo && <Historial control={viendo} />}
      </Modal>
    </div>
  );
}

function TarjetaControl({ control: x, archivada, onSubir, onVer }: { control: ControlLab; archivada: boolean; onSubir: () => void; onVer: () => void }) {
  const est = ESTADO_CONTROL[x.estado];
  const ultima = x.historial[0];
  const fechas = textoFechas(x.abre, x.cierra, fecha);
  return (
    <li className="tarjeta flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold">Control {x.numero}</h4>
        <Badge tone={est.tono}>{est.texto}</Badge>
      </div>
      {x.cuenta === false && <p className="text-xs text-gray-500">No cuenta para la nota de Práctica.</p>}
      {fechas && <p className="text-xs text-gray-500">{fechas}{x.fecha_individual && ' (fecha personal)'}</p>}
      {ultima && <p className="text-xs text-gray-600 dark:text-gray-400">Enviado el {fecha(ultima.subido)}</p>}
      {x.estado === 'requiere_correccion' && ultima?.nota && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">Profesor: {ultima.nota}</p>
      )}
      {x.estado === 'aprobado' && ultima?.nota && <p className="text-xs text-gray-600 dark:text-gray-400">Profesor: {ultima.nota}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {x.puede_subir && !archivada && (
          <button className="btn-primario text-sm" onClick={onSubir}>{x.estado === 'requiere_correccion' ? 'Subir nueva imagen' : 'Subir imagen'}</button>
        )}
        {x.historial.length > 0 && <button className="btn-secundario text-sm" onClick={onVer}>Ver entrega</button>}
      </div>
      {!x.puede_subir && x.estado === 'pendiente' && x.motivo && <p className="text-xs text-gray-500">{x.motivo}</p>}
    </li>
  );
}

function Historial({ control }: { control: ControlLab }) {
  return (
    <ol className="space-y-4">
      {control.historial.map((h, i) => (
        <li key={h.id} className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
          <p className="mb-2 text-sm">
            <strong>{i === 0 ? 'Entrega vigente' : 'Entrega anterior'}</strong> · {fecha(h.subido)} · {ESTADO_ENTREGA[h.estado] ?? h.estado}
            {h.ancho && h.alto ? <span className="text-xs text-gray-500"> · {h.ancho}×{h.alto}, {kb(h.bytes)}</span> : null}
          </p>
          {h.nota && <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">Profesor: {h.nota}</p>}
          <VisorControl fileId={h.id} abierta={i === 0} />
        </li>
      ))}
    </ol>
  );
}

function SubirControl({ control, onClose, onListo }: { control: ControlLab; onClose: () => void; onListo: (subido: string) => void }) {
  const [foto, setFoto] = useState<FotoPizarra | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => { if (foto) URL.revokeObjectURL(foto.vistaPrevia); onClose(); };
  const elegir = async (a: File | undefined) => {
    if (!a) return;
    setError(null); setConfirmar(false);
    const m = motivoArchivo(a.name, a.type, a.size);
    if (m) { setError(m); return; }
    setProcesando(true);
    try {
      const p = await optimizarPizarra(a, MAX_BYTES_ENVIO);
      if (foto) URL.revokeObjectURL(foto.vistaPrevia);
      setFoto(p);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setProcesando(false); }
  };
  const enviar = async () => {
    if (!foto) return;
    setEnviando(true); setError(null);
    try {
      const r = await subirControl(control.box_id, foto.blob, foto.tipo);
      URL.revokeObjectURL(foto.vistaPrevia);
      onListo(r.subido);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setConfirmar(false); } finally { setEnviando(false); }
  };

  return (
    <Modal open onClose={cerrar} title={`Subir Control ${control.numero}`}>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        Una sola imagen. Tome la foto de frente, con buena luz y sin sombras; todo el control debe verse y leerse.
      </p>
      <div className="flex flex-wrap gap-2">
        <label className="btn-secundario cursor-pointer text-sm">
          Tomar foto
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={procesando || enviando}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void elegir(f); }} />
        </label>
        <label className="btn-secundario cursor-pointer text-sm">
          {foto ? 'Elegir otra imagen' : 'Elegir imagen'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*" className="sr-only" disabled={procesando || enviando}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void elegir(f); }} />
        </label>
      </div>
      {procesando && <p className="mt-3 text-sm text-gray-500">Preparando la imagen…</p>}
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>}
      {foto && (
        <div className="mt-3">
          <img src={foto.vistaPrevia} alt={`Vista previa del Control ${control.numero}`}
            className="max-h-[55vh] w-full rounded border border-gray-200 bg-white object-contain dark:border-white/10" />
          <p className="mt-1 text-xs text-gray-500">
            {foto.ancho}×{foto.alto} · {kb(foto.bytes)} ({foto.tipo === 'image/webp' ? 'WebP' : 'JPEG'}; original {kb(foto.bytesOriginal)}). Aún no se ha enviado.
          </p>
          {!confirmar ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primario" onClick={() => setConfirmar(true)} disabled={enviando}>Enviar Control {control.numero}</button>
              <button className="btn-texto" onClick={cerrar}>Cancelar</button>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-acento-50 p-3 dark:bg-acento-700/20">
              <p className="text-sm font-semibold">¿Confirma que esta es la imagen del Control {control.numero}?</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">Quedará registrada con la hora del servidor y no podrá cambiarla salvo que el profesor lo indique.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-primario" onClick={() => void enviar()} disabled={enviando}>{enviando ? 'Enviando…' : 'Sí, enviar'}</button>
                <button className="btn-texto" onClick={() => setConfirmar(false)} disabled={enviando}>Volver</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Actividades({ actividades }: { actividades: MyActivity[] }) {
  if (!actividades.length) return <p className="tarjeta text-sm text-gray-600 dark:text-gray-400">Su profesor todavía no ha publicado prácticas ni exámenes.</p>;
  const ahora = Date.now();
  const orden = [...actividades].sort((a, b) => (a.closes_at ?? '9999').localeCompare(b.closes_at ?? '9999'));
  return (
    <ul className="tarjeta divide-y divide-gray-100 dark:divide-white/10">
      {orden.map((a) => {
        const noAbre = a.opens_at && new Date(a.opens_at).getTime() > ahora;
        const cerrada = a.closes_at && new Date(a.closes_at).getTime() < ahora;
        const estado = a.in_progress ? { t: 'En curso', tono: 'blue' as const } : a.submitted ? { t: 'Enviada', tono: 'green' as const }
          : noAbre ? { t: 'Aún no abre', tono: 'gray' as const } : cerrada ? { t: 'Cerrada', tono: 'red' as const } : { t: 'Pendiente', tono: 'amber' as const };
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
            <Link className="enlace font-medium" to={a.in_progress ? `/intento/${a.in_progress}` : `/actividad/${a.id}`}>{a.title}</Link>
            <Badge tone={a.mode === 'exam' ? 'purple' : 'blue'}>{a.mode === 'exam' ? 'Examen' : 'Práctica'}</Badge>
            <Badge tone={estado.tono}>{estado.t}</Badge>
            <span className="w-full text-xs text-gray-500 sm:ml-auto sm:w-auto">
              {noAbre ? `abre ${relativo(a.opens_at)}` : a.closes_at ? (cerrada ? `cerró el ${fecha(a.closes_at)}` : `cierra ${relativo(a.closes_at)}`) : 'sin fecha límite'}
              {a.grades_published && a.best_score !== null && <> · nota {puntaje(a.best_score, a.max_score)}</>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
