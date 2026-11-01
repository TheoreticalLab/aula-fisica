/**
 * Prácticas anteriores · pestaña «Prácticas sin correo» (profesor): por estudiante, por práctica (catálogo consolidado,
 * sugerencias y omisiones) y configuración. Registrar primero, verificar después: nada se agrupa ni se valida solo.
 */
import { useMemo, useState } from 'react';
import {
  agrupar, avisarOmision, configurarLibre, datosLibre, guardarGrupo, historialLibre, revisarLibre, type AccionLibre, type DatosSeccionLibre, type GrupoLibre,
} from '@/api/practicasLibres';
import {
  ESTADO_LIBRE, etiquetas, MODALIDADES, parecidosCorreo, parecidosPropios, pct, porEstudiante, porPractica, sugerirAgrupaciones, totalOficial,
  type RegistroLibre, type Sugerencia,
} from '@/lib/practicasLibres';
import { kb } from '@/lib/regularizacion';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Modal, Notice, ProgressBar, Spinner, Tabs } from '@/components/ui';
import { VisorCaptura } from '@/components/VisorCaptura';

const fechaHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const nombreModalidad = Object.fromEntries(MODALIDADES) as Record<string, string>;
const num = (v: string) => (v.trim() === '' ? null : Number(v));

// ------------------------------------------------------------------------------------------------------------------
// Ficha de un registro con las acciones del profesor
// ------------------------------------------------------------------------------------------------------------------
function FichaRegistro({ r, d, onCambio }: { r: RegistroLibre; d: DatosSeccionLibre; onCambio: () => void }) {
  const [nota, setNota] = useState('');
  const [tipo, setTipo] = useState<'fotos' | 'presencial' | 'explicacion'>('fotos');
  const [verificados, setVerificados] = useState(String(r.realizados_verificados ?? r.realizados_declarados));
  const [totalOf, setTotalOf] = useState(r.total_oficial !== null ? String(r.total_oficial) : '');
  const [verHist, setVerHist] = useState(false);
  const hist = useAsync(() => (verHist ? historialLibre(r.id) : Promise.resolve([])), [verHist, r.id, r.estado, r.updated_at]);
  const accion = useAction();
  const [aviso, setAviso] = useState<string | null>(null);
  const grupo = d.grupos.find((g) => g.id === r.grupo_id);
  const oficial = totalOficial(r);
  const propios = parecidosPropios(r.nombre, r.total_declarado, d.registros.filter((x) => x.user_id === r.user_id), r.id);
  const correo = parecidosCorreo(r.nombre, d.correo.filter((c) => c.user_id === r.user_id));
  const validado = r.estado === 'validado';

  async function hacer(a: AccionLibre, o: Parameters<typeof revisarLibre>[2] = {}) {
    const res = await accion.run(() => revisarLibre([r.id], a, { nota: nota.trim() || null, ...o }));
    if (!res) return;
    if (res.errores.length) accion.setError(res.errores.map((e) => e.motivo).join(' · '));
    else { setAviso('Guardado en el historial.'); setNota(''); }
    onCambio();
  }

  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[11rem_1fr]">
        <dt className="font-semibold">Práctica (escrita por el estudiante)</dt>
        <dd>{r.nombre}{r.nombre_original !== r.nombre && <span className="block text-xs text-gray-500">Nombre original: «{r.nombre_original}»</span>}</dd>
        <dt className="font-semibold">Práctica consolidada</dt><dd>{grupo ? grupo.nombre_oficial : <span className="text-gray-500">sin consolidar</span>}</dd>
        <dt className="font-semibold">Declarado</dt>
        <dd>{r.realizados_declarados} de {r.total_declarado} ejercicios
          {(r.total_inicial !== r.total_declarado || r.realizados_inicial !== r.realizados_declarados) && <span className="block text-xs text-gray-500">Valores iniciales: {r.realizados_inicial} de {r.total_inicial}</span>}</dd>
        <dt className="font-semibold">Total oficial</dt><dd>{oficial ?? <span className="text-gray-500">sin fijar</span>}{r.total_oficial !== null && grupo?.total_oficial != null && r.total_oficial !== grupo.total_oficial ? ` (corregido en este registro; la práctica dice ${grupo.total_oficial})` : ''}</dd>
        <dt className="font-semibold">Verificados</dt><dd>{validado ? r.realizados_verificados : <span className="text-gray-500">{r.realizados_verificados !== null ? `${r.realizados_verificados} (antes de reabrir)` : 'sin verificar'}</span>}</dd>
        <dt className="font-semibold">Modalidad</dt><dd>{r.modalidades.map((m) => nombreModalidad[m]).join(', ') || '—'}{r.modalidad_otra ? ` (${r.modalidad_otra})` : ''}</dd>
        <dt className="font-semibold">Estado</dt>
        <dd><Badge tone={ESTADO_LIBRE[r.estado].tono}>{ESTADO_LIBRE[r.estado].docente}</Badge> {etiquetas(r).map((e) => <span key={e} className="ml-1 text-xs text-amber-700 dark:text-amber-300">{e}</span>)}
          <span className="block text-xs text-gray-500">Declarado {fechaHora(r.declaracion_at)}{r.revision_presencial_at ? ` · revisión presencial ${fechaHora(r.revision_presencial_at)}` : ''}{r.validado_at ? ` · validado ${fechaHora(r.validado_at)}` : ''}</span></dd>
      </dl>
      {r.sin_foto && r.explicacion_sin_foto && <Notice tone="warn">Sin evidencia fotográfica: «{r.explicacion_sin_foto}»</Notice>}
      {r.observaciones && <p className="text-xs">Observaciones del estudiante: «{r.observaciones}»</p>}
      {r.solicitud && <p className="text-xs">Su solicitud ({fechaHora(r.solicitud_at)}): «{r.solicitud}»</p>}
      {(r.respuesta || r.material_no_disponible) && <Notice tone="info">Respuesta ({fechaHora(r.respondido_at)}): {r.respuesta ? `«${r.respuesta}»` : ''}{r.material_no_disponible ? ' Indica que ya no conserva el material original.' : ''}</Notice>}
      {propios.length > 0 && <Notice tone="warn">Este estudiante tiene otro registro parecido: {propios.map((p) => `«${p.nombre}» (${p.realizados_declarados}/${p.total_declarado})`).join(', ')}.</Notice>}
      {correo.length > 0 && <Notice tone="warn">Posible duplicado con la modalidad por correo: práctica {correo.map((c) => c.numero).join(', ')}.</Notice>}
      <div className="space-y-2">
        {r.fotos.length === 0 ? <p className="text-xs text-gray-500">Sin fotografías.</p> : r.fotos.map((f) => (
          <VisorCaptura key={f.id} id={f.id} destino="libre" etiqueta={f.posicion === 1 ? 'Foto representativa' : `Foto adicional ${f.posicion - 1}`} bytes={f.bytes} ancho={f.ancho} alto={f.alto} abierta={f.posicion === 1} />
        ))}
        <p className="text-xs text-gray-500">Una fotografía es una muestra, no la validación del contenido declarado.</p>
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-white/10">
        <textarea className="campo min-h-[3rem]" maxLength={1000} placeholder="Nota (obligatoria para solicitudes y para reabrir; el estudiante la verá)" value={nota} onChange={(e) => setNota(e.target.value)} />
        {!validado ? (
          <>
            <div className="flex flex-wrap gap-2">
              {r.estado !== 'en_revision' && <button className="btn-secundario" disabled={accion.busy} onClick={() => void hacer('en_revision')}>En revisión</button>}
              <button className="btn-secundario" disabled={accion.busy} onClick={() => void hacer('presencial')}>Registrar revisión presencial</button>
              <button className="btn-secundario" disabled={accion.busy || !nota.trim()} onClick={() => void hacer('solicitar_correccion')}>Solicitar corrección</button>
            </div>
            {d.config.solicitudes && (
              <div className="flex flex-wrap items-center gap-2">
                <select className="campo w-auto" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
                  <option value="fotos">Fotografías adicionales</option><option value="presencial">Presentar el cuaderno en persona</option><option value="explicacion">Una explicación</option>
                </select>
                <button className="btn-secundario" disabled={accion.busy || !nota.trim()} onClick={() => void hacer('solicitar_evidencia', { tipo })}>Solicitar evidencia adicional</button>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">Ejercicios verificados<input type="number" min={0} className="campo w-28" value={verificados} onChange={(e) => setVerificados(e.target.value)} /></label>
              <label className="text-xs">Total oficial (opcional)<input type="number" min={1} className="campo w-28" placeholder={oficial !== null ? String(oficial) : ''} value={totalOf} onChange={(e) => setTotalOf(e.target.value)} /></label>
              <button className="btn-primario" disabled={accion.busy || verificados.trim() === ''} onClick={() => void hacer('validar', { verificados: num(verificados), totalOficial: num(totalOf) })}>Validar</button>
            </div>
            <p className="text-xs text-gray-500">Validar registra la cantidad que usted comprobó (puede ser distinta de la declarada). No crea ninguna nota.</p>
          </>
        ) : (
          <button className="btn-secundario" disabled={accion.busy || !nota.trim()} onClick={() => void hacer('reabrir')}>Reabrir (vuelve a «en revisión»)</button>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">Corregir solo el total oficial de este registro<input type="number" min={1} className="campo w-28" value={totalOf} onChange={(e) => setTotalOf(e.target.value)} /></label>
          <button className="btn-texto" disabled={accion.busy || totalOf.trim() === ''} onClick={() => void hacer('total_oficial', { totalOficial: num(totalOf) })}>Guardar total oficial</button>
        </div>
        {aviso && <Notice tone="ok">{aviso}</Notice>}
        <ErrorBox error={accion.error} />
      </div>

      <button className="btn-texto text-sm" onClick={() => setVerHist(!verHist)}>{verHist ? 'Ocultar historial' : 'Ver historial de cambios'}</button>
      {verHist && (hist.loading ? <Spinner /> : (
        <ul className="space-y-1 text-xs">
          {(hist.data ?? []).map((e, i) => (
            <li key={i}>{fechaHora(e.at)} · {e.papel === 'docente' ? e.actor_name ?? 'Profesor' : 'Estudiante'} · {e.accion.replace(/_/g, ' ')}
              {e.estado_antes !== e.estado_despues && e.estado_despues ? ` (${e.estado_antes ?? '—'} → ${e.estado_despues})` : ''}{e.nota ? ` · «${e.nota}»` : ''}
              {e.detalle && 'antes' in e.detalle ? ` · antes ${JSON.stringify(e.detalle.antes)} → ${JSON.stringify(e.detalle.despues)}` : ''}</li>
          ))}
        </ul>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
// Vista A · por estudiante
// ------------------------------------------------------------------------------------------------------------------
function PorEstudiante({ d, onCambio }: { d: DatosSeccionLibre; onCambio: () => void }) {
  const filas = useMemo(() => porEstudiante(d.estudiantes, d.registros), [d]);
  const [sel, setSel] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const est = filas.find((f) => f.user_id === sel);
  const suyos = d.registros.filter((r) => r.user_id === sel);
  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">El cumplimiento declarado solo cuenta lo que cada estudiante registró; no es una nota ni está verificado. Un estudiante sin registros no es un incumplimiento.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>{['Estudiante', 'Prácticas', 'Total decl.', 'Realizados decl.', 'Cumplimiento declarado', 'Con foto', 'Sin evidencia', 'Pendientes', 'Validados', 'Verificados'].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums dark:divide-white/10">
            {filas.map((f) => (
              <tr key={f.user_id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => setSel(f.user_id)}>
                <td className="p-2">{f.full_name}{f.student_code && <span className="block text-xs text-gray-500">{f.student_code}</span>}</td>
                <td className="p-2">{f.practicas || '—'}</td><td className="p-2">{f.total || '—'}</td><td className="p-2">{f.practicas ? f.realizados : '—'}</td>
                <td className="p-2">{pct(f.cumplimiento)}</td><td className="p-2">{f.conFoto || '—'}</td><td className="p-2">{f.sinEvidencia || '—'}</td>
                <td className="p-2">{f.pendientes || '—'}</td><td className="p-2">{f.validados || '—'}</td><td className="p-2">{f.validados ? f.verificados : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!est} onClose={() => { setSel(null); setAbierto(null); }} title={est ? `${est.full_name} · prácticas sin correo` : ''}>
        {est && (
          <div className="space-y-2">
            <p className="text-sm">{est.practicas} práctica(s) · {est.realizados} de {est.total} ejercicios declarados · cumplimiento declarado {pct(est.cumplimiento)}</p>
            {suyos.length === 0 ? <Empty>Sin registros.</Empty> : suyos.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 p-2 dark:border-white/10">
                <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm" onClick={() => setAbierto(abierto === r.id ? null : r.id)}>
                  <span><strong>{r.nombre}</strong> · {r.realizados_declarados}/{r.total_declarado}{r.estado === 'validado' ? ` · verificados ${r.realizados_verificados}` : ''}</span>
                  <Badge tone={ESTADO_LIBRE[r.estado].tono}>{ESTADO_LIBRE[r.estado].docente}</Badge>
                </button>
                {abierto === r.id && <div className="mt-2"><FichaRegistro r={r} d={d} onCambio={onCambio} /></div>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
// Vista B · por práctica: catálogo consolidado, sugerencias y omisiones
// ------------------------------------------------------------------------------------------------------------------
function PracticaConsolidada({ p, d, classId, onCambio }: { p: ReturnType<typeof porPractica<GrupoLibre>>[number]; d: DatosSeccionLibre; classId: string; onCambio: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [f, setF] = useState({ nombre: p.nombre_oficial, total: p.total_oficial !== null ? String(p.total_oficial) : '' });
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [nota, setNota] = useState('');
  const [verRegistro, setVerRegistro] = useState<string | null>(null);
  const accion = useAction();
  const hacer = (fn: () => Promise<unknown>) => void accion.run(async () => { await fn(); onCambio(); });
  const avisoDe = (u: string) => d.avisos.find((a) => a.grupo_id === p.id && a.user_id === u);
  const reg = d.registros.find((r) => r.id === verRegistro);
  return (
    <Card>
      <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setAbierta(!abierta)}>
        <span><strong>{p.nombre_oficial}</strong> <span className="text-xs text-gray-500">· {p.estudiantes} estudiante(s) · total oficial {p.total_oficial ?? 'sin fijar'} · habitual {p.totalHabitual ?? '—'}</span></span>
        <span className="text-xs">
          {p.discrepancias > 0 && <Badge tone="amber">{p.discrepancias} con otro total</Badge>}{' '}
          {p.sinRegistro.length > 0 && <Badge tone="gray">{p.sinRegistro.length} sin registro</Badge>}
        </span>
      </button>
      {abierta && (
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1">Nombre oficial<input className="campo" maxLength={160} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
            <label>Total oficial<input type="number" min={1} className="campo w-28" placeholder="sin fijar" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></label>
            <button className="btn-secundario" disabled={accion.busy || !f.nombre.trim()} onClick={() => hacer(() => guardarGrupo({ id: p.id, class_id: classId, nombre: f.nombre, total_oficial: num(f.total), descripcion: p.descripcion }))}>Guardar</button>
          </div>
          <p className="text-xs text-gray-500">Fijar el total oficial no cambia lo que declaró cada estudiante: las diferencias se muestran para revisarlas. Nombres escritos: {p.nombresOriginales.map((n) => `«${n}»`).join(', ')}.</p>
          {p.totales.length > 1 && <Notice tone="warn">Los estudiantes declararon totales distintos: {p.totales.join(', ')} ejercicios.</Notice>}
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {p.registros.map((r) => {
              const e = d.estudiantes.find((x) => x.user_id === r.user_id);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1">{e?.full_name ?? '—'} · «{r.nombre_original}» · {r.realizados_declarados}/{r.total_declarado}
                    {p.total_oficial !== null && r.total_declarado !== p.total_oficial && <Badge tone="amber">total distinto</Badge>}</span>
                  <Badge tone={ESTADO_LIBRE[r.estado].tono}>{ESTADO_LIBRE[r.estado].docente}</Badge>
                  <button className="btn-texto text-xs" onClick={() => setVerRegistro(r.id)}>Ficha</button>
                  <button className="btn-texto text-xs" disabled={accion.busy} onClick={() => hacer(() => agrupar(null, [r.id]))}>Sacar de esta práctica</button>
                </li>
              );
            })}
          </ul>
          {p.sinRegistro.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-2 dark:border-white/10">
              <p className="font-medium">{p.sinRegistro.length === 1 ? 'Un estudiante no tiene' : `${p.sinRegistro.length} estudiantes no tienen`} un registro de esta práctica.</p>
              <p className="text-xs text-gray-500">La ausencia de registro no demuestra que no la realizaran (pudieron registrarla con otro nombre). Puede enviarles un aviso: nadie declara por ellos.</p>
              <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                {p.sinRegistro.map((e) => {
                  const a = avisoDe(e.user_id);
                  return (
                    <li key={e.user_id} className="flex items-center gap-2">
                      <input type="checkbox" checked={marcados.has(e.user_id)} onChange={(ev) => setMarcados((m) => { const n = new Set(m); if (ev.target.checked) n.add(e.user_id); else n.delete(e.user_id); return n; })} />
                      {e.full_name}
                      {a && <span className="text-xs text-gray-500">({{ pendiente: 'aviso enviado', registrada: 'dice que la registró', no_realizada: 'dice que no la hizo', otro_nombre: 'dice que la registró con otro nombre' }[a.estado]}{a.respuesta ? `: «${a.respuesta}»` : ''})</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-texto text-xs" onClick={() => setMarcados(new Set(p.sinRegistro.filter((e) => !avisoDe(e.user_id)).map((e) => e.user_id)))}>Marcar a quienes no han recibido aviso</button>
                <input className="campo flex-1 text-sm" maxLength={1000} placeholder="Nota para el aviso (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
                <button className="btn-secundario" disabled={!marcados.size || accion.busy} onClick={() => hacer(async () => { await avisarOmision(p.id, [...marcados], nota); setMarcados(new Set()); })}>Enviar aviso ({marcados.size})</button>
              </div>
            </div>
          )}
          <ErrorBox error={accion.error} />
        </div>
      )}
      <Modal open={!!reg} onClose={() => setVerRegistro(null)} title="Registro">{reg && <FichaRegistro r={reg} d={d} onCambio={onCambio} />}</Modal>
    </Card>
  );
}

function TarjetaSugerencia({ s, d, classId, onCambio, onDescartar }: { s: Sugerencia; d: DatosSeccionLibre; classId: string; onCambio: () => void; onDescartar: () => void }) {
  const [incl, setIncl] = useState<Set<string>>(new Set(s.ids));
  const [nombre, setNombre] = useState(s.nombres[0]?.nombre ?? '');
  const [total, setTotal] = useState('');
  const [destino, setDestino] = useState(s.grupoSugerido?.id ?? '');
  const accion = useAction();
  const regs = d.registros.filter((r) => s.ids.includes(r.id));
  const ids = [...incl];
  return (
    <Card>
      <p className="font-medium">{s.ids.length > 1 ? 'Posible misma práctica' : 'Registro sin consolidar'}: {s.nombres.map((n) => `«${n.nombre}»${n.n > 1 ? ` ×${n.n}` : ''}`).join(', ')}</p>
      <p className="text-xs text-gray-500">{s.estudiantes} estudiante(s) · total habitual {s.totalHabitual ?? '—'}{s.totales.length > 1 ? ` · totales declarados: ${s.totales.join(', ')}` : ''}</p>
      {s.ids.length > 1 && (
        <ul className="mt-1 space-y-0.5 text-xs">
          {regs.map((r) => (
            <li key={r.id}><label className="flex items-center gap-2">
              <input type="checkbox" checked={incl.has(r.id)} onChange={(e) => setIncl((m) => { const n = new Set(m); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
              {d.estudiantes.find((x) => x.user_id === r.user_id)?.full_name ?? '—'} · «{r.nombre}» · {r.realizados_declarados}/{r.total_declarado}
            </label></li>
          ))}
        </ul>
      )}
      <div className="mt-2 space-y-2 text-sm">
        {d.grupos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select className="campo flex-1" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Añadir a una práctica consolidada…</option>
              {d.grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre_oficial}{s.grupoSugerido?.id === g.id ? ' (sugerida)' : ''}</option>)}
            </select>
            <button className="btn-secundario" disabled={!destino || !ids.length || accion.busy} onClick={() => void accion.run(async () => { await agrupar(destino, ids); onCambio(); })}>Confirmar</button>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-xs">Nombre oficial<input className="campo" maxLength={160} value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <label className="text-xs">Total oficial (si lo conoce)<input type="number" min={1} className="campo w-28" placeholder={s.totalHabitual ? `habitual ${s.totalHabitual}` : ''} value={total} onChange={(e) => setTotal(e.target.value)} /></label>
          <button className="btn-primario" disabled={!nombre.trim() || !ids.length || accion.busy} onClick={() => void accion.run(async () => {
            const g = await guardarGrupo({ id: null, class_id: classId, nombre, total_oficial: num(total), descripcion: '' });
            await agrupar(g, ids); onCambio();
          })}>Consolidar como práctica nueva</button>
          {s.ids.length > 1 && <button className="btn-texto text-xs" onClick={onDescartar}>Ocultar sugerencia</button>}
        </div>
        <ErrorBox error={accion.error} />
      </div>
    </Card>
  );
}

function PorPractica({ d, classId, onCambio }: { d: DatosSeccionLibre; classId: string; onCambio: () => void }) {
  const consolidadas = useMemo(() => porPractica(d.grupos, d.registros, d.estudiantes), [d]);
  const sugerencias = useMemo(() => (d.config.sugerencias ? sugerirAgrupaciones(d.registros, d.grupos) : sugerirAgrupaciones(d.registros, d.grupos, 2)), [d]);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const visibles = sugerencias.filter((s) => !ocultas.has(s.clave));
  const multiples = visibles.filter((s) => s.ids.length > 1), sueltas = visibles.filter((s) => s.ids.length === 1);
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 font-semibold">Catálogo consolidado ({consolidadas.length})</h3>
        {consolidadas.length === 0 ? <Empty>Todavía no ha consolidado ninguna práctica. Use las sugerencias de abajo.</Empty> : (
          <div className="space-y-2">{consolidadas.map((p) => <PracticaConsolidada key={p.id} p={p} d={d} classId={classId} onCambio={onCambio} />)}</div>
        )}
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Consolidar prácticas · sugerencias ({multiples.length})</h3>
        <p className="mb-2 text-xs text-gray-500">
          {d.config.sugerencias ? 'Agrupaciones propuestas por semejanza del nombre (sin tildes, plurales, siglas como MRUA) y del total de ejercicios. Son solo sugerencias: nada se une hasta que usted confirma.'
            : 'Las sugerencias automáticas están desactivadas: solo se agrupan nombres idénticos.'}
        </p>
        {multiples.length === 0 ? <Empty>No hay coincidencias sugeridas.</Empty> : (
          <div className="space-y-2">{multiples.map((s) => <TarjetaSugerencia key={s.clave} s={s} d={d} classId={classId} onCambio={onCambio} onDescartar={() => setOcultas((o) => new Set(o).add(s.clave))} />)}</div>
        )}
      </section>
      {sueltas.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Registros sin consolidar ({sueltas.length})</h3>
          <div className="space-y-2">{sueltas.map((s) => <TarjetaSugerencia key={s.clave} s={s} d={d} classId={classId} onCambio={onCambio} onDescartar={() => undefined} />)}</div>
        </section>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------------------------------------------------------
function Configuracion({ d, classId, onCambio }: { d: DatosSeccionLibre; classId: string; onCambio: () => void }) {
  const [f, setF] = useState({ ...d.config });
  const [ok, setOk] = useState(false);
  const accion = useAction();
  const cb = (k: keyof typeof f, t: string) => (
    <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {t}</label>
  );
  return (
    <div className="space-y-4">
      <Card title="Configuración de las prácticas sin envío por correo">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {cb('habilitado', 'Habilitar prácticas sin envío por correo')}
          {cb('nuevos', 'Admitir registros nuevos (desmarcar = cerrar nuevos registros; los existentes se conservan)')}
          {cb('nombres_libres', 'Permitir nombres libres (desmarcar = elegir solo entre las prácticas consolidadas)')}
          {cb('correcciones', 'Permitir que los estudiantes corrijan lo que aún no se ha revisado')}
          {cb('sin_foto', 'Permitir registros sin fotografía, con explicación')}
          {cb('sugerencias', 'Sugerir prácticas similares para consolidar')}
          {cb('solicitudes', 'Permitir solicitudes de evidencia adicional')}
          <label>Registros máximos por estudiante<input type="number" min={1} max={300} className="campo" value={f.max_registros} onChange={(e) => setF({ ...f, max_registros: Number(e.target.value) })} /></label>
          <label>Máximo de ejercicios por práctica<input type="number" min={1} max={1000} className="campo" value={f.max_ejercicios} onChange={(e) => setF({ ...f, max_ejercicios: Number(e.target.value) })} /></label>
        </div>
        <p className="mt-2 text-xs text-gray-500">Las respuestas a sus solicitudes siguen abiertas aunque cierre los registros nuevos o las correcciones. El tamaño máximo por foto ({f.max_mb_captura} MB) y el espacio de la sección ({f.cuota_mb} MB) son los de «Catálogo y configuración» y no cambian aquí.</p>
        <ErrorBox error={accion.error} />
        {ok && <Notice tone="ok">Configuración guardada.</Notice>}
        <button className="btn-primario mt-2" disabled={accion.busy} onClick={() => void accion.run(async () => { await configurarLibre(classId, f); setOk(true); onCambio(); })}>Guardar</button>
      </Card>
      <Card title="Almacenamiento de imágenes de la sección">
        <ProgressBar value={d.config.bytes_seccion / (d.config.cuota_mb * 1048576)} label={`${kb(d.config.bytes_seccion)} de ${d.config.cuota_mb} MB (capturas y fotos)`} tone={d.config.bytes_seccion > 0.8 * d.config.cuota_mb * 1048576 ? 'amber' : 'blue'} />
      </Card>
    </div>
  );
}

type Vista = 'estudiantes' | 'practicas' | 'config';

export function TabPracticasLibres({ classId }: { classId: string }) {
  const st = useAsync(() => datosLibre(classId), [classId]);
  const [vista, setVista] = useState<Vista>('estudiantes');
  const accion = useAction();
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={() => void st.reload()} />;
  const d = st.data!;
  const recargar = () => void st.reload();
  if (!d.config.habilitado && d.registros.length === 0) {
    return (
      <Card title="Prácticas realizadas sin envío por correo">
        <p className="text-sm">Para las prácticas hechas en el cuaderno, en clase, en la pizarra o en casa. <strong>No necesita crear antes ningún catálogo</strong>: cada estudiante
          registra el nombre de la práctica, cuántos ejercicios tenía y cuántos hizo, con una foto representativa o una explicación. Después usted consolida los nombres
          equivalentes, detecta omisiones, pide evidencia y valida la cantidad verificada. Nada crea notas.</p>
        <ErrorBox error={accion.error} />
        <button className="btn-primario mt-3" disabled={accion.busy} onClick={() => void accion.run(async () => { await configurarLibre(classId, { habilitado: true }); recargar(); })}>Habilitar prácticas sin envío por correo</button>
      </Card>
    );
  }
  const pendientes = d.registros.filter((r) => r.estado !== 'validado').length;
  return (
    <div>
      {!d.config.habilitado && <div className="mb-3"><Notice tone="warn">Deshabilitada para los estudiantes. Puede habilitarla en «Configuración».</Notice></div>}
      <p className="mb-2 text-sm">{d.registros.length} registro(s) de {new Set(d.registros.map((r) => r.user_id)).size} estudiante(s) · {pendientes} sin validar · {d.grupos.length} práctica(s) consolidada(s)</p>
      <Tabs<Vista> value={vista} onChange={setVista} tabs={[{ id: 'estudiantes', label: 'Por estudiante' }, { id: 'practicas', label: 'Por práctica' }, { id: 'config', label: 'Configuración' }]} />
      {vista === 'estudiantes' && <PorEstudiante d={d} onCambio={recargar} />}
      {vista === 'practicas' && <PorPractica d={d} classId={classId} onCambio={recargar} />}
      {vista === 'config' && <Configuracion d={d} classId={classId} onCambio={recargar} />}
    </div>
  );
}

