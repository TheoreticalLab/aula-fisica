/**
 * Administración de una clase impartida (profesor). Dos procesos y dos aprobaciones INDEPENDIENTES:
 *  A · Fotografías: aprobar, rechazar o retirar su publicación.
 *  B · Clase ampliada con IA: generar (modelo, nivel, instrucciones, costo estimado y confirmación) → borrador →
 *      revisar y editar → «Aprobar y publicar». Regenerar o editar crea otro borrador: lo publicado no cambia solo.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  agregarEnlace, claseDetalle, disponibilidadModelos, estadoEnlace, generarAmpliada, guardarModeloPreferido, guardarVersion, modelosRegistro,
  publicarVersion, retirarVersion, revisarFotos, type ClaseDetalle, type Contenido, type ModeloRegistro, type Version,
} from '@/api/clases';
import { getLesson, getLessonList, getUnits } from '@/api/estudiante';
import { ClaseAmpliada, DondeEstudiar, GaleriaPizarras } from '@/components/clases/Componentes';
import { Markdown } from '@/components/Markdown';
import { Badge, Card, ErrorBox, Modal, Notice, PageTitle, Spinner } from '@/components/ui';
import { ERRORES_IA, ESTADO_FOTOS, fechaClase } from '@/lib/clases';
import { useAction, useAsync } from '@/lib/util';
import { estimar, NIVELES, type Nivel } from '../../../supabase/functions/_shared/clases/estimacion';

const usd = (x: number) => `${x < 0.01 ? x.toFixed(4) : x.toFixed(3)} USD`;

export default function ClaseAdmin() {
  const { sessionId = '' } = useParams();
  const st = useAsync(() => claseDetalle(sessionId), [sessionId]);
  const accion = useAction();
  const [generar, setGenerar] = useState(false);
  const procesando = st.data?.generaciones?.some((g) => g.estado === 'procesando');
  useEffect(() => {
    if (!procesando) return;
    const t = window.setInterval(() => st.reload(), 4000);
    return () => window.clearInterval(t);
  }, [procesando]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (st.loading && !st.data) return <Spinner />;
  if (st.error || !st.data) return <ErrorBox error={st.error ?? 'Clase no disponible'} />;
  const c = st.data;
  if (c.papel !== 'docente') return <ErrorBox error="Solo el profesor de la sección administra esta clase." />;
  const ef = ESTADO_FOTOS[c.fotos_estado];
  const decidir = (d: 'aprobada' | 'rechazada' | 'retirada' | 'pendiente') => {
    const motivo = d === 'rechazada' || d === 'retirada' ? window.prompt(d === 'rechazada' ? 'Motivo del rechazo (lo verá quien subió las fotos):' : 'Motivo de la retirada:') : null;
    if ((d === 'rechazada' || d === 'retirada') && !motivo) return;
    if (d === 'aprobada' && !window.confirm('¿Publicar estas fotografías para los estudiantes de la sección? (No genera nada con IA.)')) return;
    void accion.run(async () => { await revisarFotos(c.id, d, motivo); st.reload(); });
  };
  return (
    <div className="space-y-4">
      <PageTitle title={c.title} back={{ to: `/docente/clases/${c.class_id}?t=clases`, label: c.seccion }}
        subtitle={<>{fechaClase(c.fecha)} · {c.asignatura} · {c.seccion} · subida por {c.subida_por ?? '—'} ({c.uploader_role})</>}
        actions={<div className="flex gap-2"><Link className="btn-secundario" to={`/clases/${c.id}/editar`}>Editar datos y fotos</Link><Link className="btn-secundario" to={`/clases/${c.id}`}>Vista del estudiante</Link></div>} />
      <ErrorBox error={accion.error} />

      {/* ---------------- Proceso A ---------------- */}
      <Card title={<span>A · Fotografías <Badge tone={ef.tono}>{ef.texto}</Badge></span>}>
        {c.fotos_motivo && <p className="mb-2 text-sm text-gray-600">Motivo: {c.fotos_motivo}</p>}
        {c.imagenes.length ? <GaleriaPizarras sessionId={c.id} n={c.imagenes.length} /> : <p className="text-sm text-gray-500">Sin fotografías.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {c.fotos_estado !== 'aprobada' && <button className="btn-primario" disabled={accion.busy || !c.imagenes.length} onClick={() => decidir('aprobada')}>Aprobar y publicar fotografías</button>}
          {['pendiente', 'borrador'].includes(c.fotos_estado) && <button className="btn-secundario" disabled={accion.busy} onClick={() => decidir('rechazada')}>Rechazar</button>}
          {c.fotos_estado === 'aprobada' && <button className="btn-secundario" disabled={accion.busy} onClick={() => decidir('retirada')}>Retirar publicación de las fotos</button>}
        </div>
      </Card>

      {/* ---------------- Proceso B ---------------- */}
      <section className="rounded-2xl border-2 border-purple-300 p-4 dark:border-purple-800">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-lg font-semibold">B · Clase ampliada con IA</h2>
          {c.publicada ? <Badge tone="green">Publicada (versión {c.publicada.numero})</Badge> : <Badge>Sin publicar</Badge>}
          <button className="btn-acento ml-auto" disabled={!c.imagenes.length || !!procesando} onClick={() => setGenerar(true)}>✨ Generar clase ampliada con IA</button>
        </div>
        <p className="mt-1 text-xs text-gray-500">Generar tiene costo y crea un BORRADOR: los estudiantes no lo ven hasta que usted lo apruebe. Las fotos no cambian.</p>
        {procesando && <Notice>Procesando con Claude… (puede tardar unos minutos; esta página se actualiza sola)</Notice>}
        <Generaciones c={c} />
        <Versiones c={c} onCambio={st.reload} />
      </section>

      <Card title="Dónde estudiar · enlaces con la teoría">
        <DondeEstudiar enlaces={c.enlaces} courseId={c.course_id} docente />
        <Enlaces c={c} onCambio={st.reload} />
      </Card>

      <Card title="Auditoría">
        <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
          {(c.auditoria ?? []).map((a, i) => <li key={i}><span className="text-gray-500">{new Date(a.created_at).toLocaleString('es-DO')}</span> · {a.actor ?? 'sistema'} · <strong>{a.accion}</strong></li>)}
        </ul>
      </Card>
      {generar && <DialogoGenerar c={c} onCerrar={() => setGenerar(false)} onIniciado={() => { setGenerar(false); st.reload(); }} />}
    </div>
  );
}

function Generaciones({ c }: { c: ClaseDetalle }) {
  const g = c.generaciones ?? [];
  if (!g.length) return null;
  const total = g.reduce((a, x) => a + Number(x.cost_usd), 0);
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-medium">Generaciones ({g.length}) · costo acumulado {usd(total)}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-gray-500"><th>Fecha</th><th>Modelo</th><th>Nivel</th><th>Estado</th><th>Tokens (entrada/salida)</th><th>Estimado</th><th>Costo</th></tr></thead>
          <tbody>
            {g.map((x) => (
              <tr key={x.id} className="border-t border-gray-100 dark:border-white/5">
                <td>{new Date(x.created_at).toLocaleString('es-DO')}</td><td>{x.model}{x.simulated ? ' (simulado)' : ''}</td><td>{NIVELES[x.nivel]?.etiqueta}</td>
                <td>{x.estado === 'error' ? <span className="text-red-700">error: {ERRORES_IA[x.error_code ?? ''] ?? x.error_code}</span> : x.estado}
                  {x.descartados > 0 && <span className="block text-gray-500">{x.descartados} enlace(s) inventado(s) descartado(s)</span>}
                  {x.fotos_cambiadas && x.estado === 'ok' && <span className="block text-amber-700">las fotos cambiaron después</span>}</td>
                <td>{x.input_tokens.toLocaleString('es-DO')} / {x.output_tokens.toLocaleString('es-DO')}</td><td>≤ {usd(Number(x.estimado_usd))}</td><td>{usd(Number(x.cost_usd))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Versiones({ c, onCambio }: { c: ClaseDetalle; onCambio: () => void }) {
  const versiones = c.versiones ?? [];
  const [sel, setSel] = useState<string | null>(versiones[0]?.id ?? null);
  const [edicion, setEdicion] = useState<Contenido | null>(null);
  const accion = useAction();
  const v = versiones.find((x) => x.id === sel) ?? versiones[0];
  if (!versiones.length) return <p className="mt-3 text-sm text-gray-500">Todavía no hay versiones.</p>;
  const tono = (e: Version['estado']) => (e === 'publicada' ? 'green' : e === 'borrador' ? 'amber' : 'gray');
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-1">
        {versiones.map((x) => <button key={x.id} onClick={() => { setSel(x.id); setEdicion(null); }} className={`rounded-full border px-3 py-1 text-xs ${x.id === v.id ? 'border-purple-500' : 'border-gray-200 dark:border-white/10'}`}>
          v{x.numero} <Badge tone={tono(x.estado)}>{x.estado}</Badge></button>)}
      </div>
      {edicion ? (
        <div className="space-y-3">
          {edicion.secciones.map((s, i) => (
            <div key={i} className="grid gap-2 lg:grid-cols-2">
              <label className="text-sm"><span className="etiqueta">{s.titulo}</span>
                <textarea className="campo font-mono text-xs" rows={8} value={s.cuerpo} onChange={(e) => setEdicion({ ...edicion, secciones: edicion.secciones.map((x, k) => (k === i ? { ...x, cuerpo: e.target.value } : x)) })} /></label>
              <div className="tarjeta max-h-64 overflow-y-auto text-sm"><Markdown>{s.cuerpo}</Markdown></div>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="btn-primario" disabled={accion.busy} onClick={() => void accion.run(async () => { const n = await guardarVersion(c.id, v.id, edicion); setEdicion(null); setSel(n.id); onCambio(); })}>Guardar como nueva versión (borrador)</button>
            <button className="btn-secundario" onClick={() => setEdicion(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secundario" onClick={() => setEdicion(structuredClone(v.contenido))}>Editar (crea una versión nueva)</button>
            {v.estado !== 'publicada' && (
              <button className="btn-primario" disabled={accion.busy} onClick={() => {
                const sug = c.enlaces.some((e) => e.estado === 'sugerido');
                if (!window.confirm(`¿Aprobar y publicar la versión ${v.numero} para los estudiantes?${c.publicada ? ` Sustituirá a la versión ${c.publicada.numero} publicada.` : ''}`)) return;
                const confirmar = sug ? window.confirm('¿Confirmar también los enlaces a la teoría sugeridos por la IA? (Cancelar = publicarlos más tarde uno a uno.)') : false;
                void accion.run(async () => { await publicarVersion(v.id, confirmar); onCambio(); });
              }}>Aprobar y publicar clase ampliada</button>
            )}
            {v.estado === 'publicada' && <button className="btn-secundario" disabled={accion.busy} onClick={() => {
              const m = window.prompt('Motivo para retirar la versión publicada:');
              if (m) void accion.run(async () => { await retirarVersion(c.id, m); onCambio(); });
            }}>Retirar publicación</button>}
          </div>
          <div className="tarjeta"><ClaseAmpliada contenido={v.contenido} aviso={false} /></div>
        </>
      )}
      <ErrorBox error={accion.error} />
    </div>
  );
}

function Enlaces({ c, onCambio }: { c: ClaseDetalle; onCambio: () => void }) {
  const accion = useAction();
  const cat = useAsync(async () => {
    const [unidades, lecciones] = await Promise.all([getUnits(c.course_id), getLessonList(c.course_id)]);
    return { unidades, lecciones };
  }, [c.course_id]);
  const [nuevo, setNuevo] = useState({ tipo: 'leccion', lesson_id: '', unit_id: '', apartado: '', concepto: '', cobertura: 'completa' });
  const [apartados, setApartados] = useState<string[]>([]);
  useEffect(() => {
    if (!nuevo.lesson_id) return setApartados([]);
    void getLesson(nuevo.lesson_id).then((l) => setApartados([...(l.theory ?? '').matchAll(/^#{2,3}[ \t]+(.+)$/gm)].map((m) => m[1].trim().slice(0, 160)))).catch(() => setApartados([]));
  }, [nuevo.lesson_id]);
  return (
    <div className="mt-4 space-y-2 text-sm">
      {c.enlaces.filter((e) => e.estado !== 'confirmado' || e.origen === 'ia').length > 0 && (
        <ul className="space-y-1">
          {c.enlaces.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <Badge tone={e.estado === 'confirmado' ? 'green' : e.estado === 'rechazado' ? 'red' : 'purple'}>{e.estado}</Badge>
              <span>{e.tipo === 'brecha' ? `Brecha: ${e.concepto}` : `${e.tipo}: ${e.leccion ?? e.unidad ?? e.ejercicio ?? ''}${e.apartado ? ` › ${e.apartado}` : ''}`}</span>
              {e.estado !== 'confirmado' && <button className="btn-texto text-xs" onClick={() => void accion.run(async () => { await estadoEnlace(e.id, 'confirmado'); onCambio(); })}>Confirmar</button>}
              {e.estado !== 'rechazado' && <button className="btn-texto text-xs" onClick={() => void accion.run(async () => { await estadoEnlace(e.id, 'rechazado'); onCambio(); })}>Rechazar</button>}
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary className="cursor-pointer font-medium">Añadir una referencia manualmente</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select className="campo" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
            <option value="leccion">Lección (y apartado)</option><option value="unidad">Unidad</option><option value="brecha">Tema sin teoría (brecha)</option>
          </select>
          {nuevo.tipo === 'leccion' && <select className="campo" value={nuevo.lesson_id} onChange={(e) => setNuevo({ ...nuevo, lesson_id: e.target.value, apartado: '' })}>
            <option value="">Lección…</option>{(cat.data?.lecciones ?? []).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>}
          {nuevo.tipo === 'leccion' && apartados.length > 0 && <select className="campo" value={nuevo.apartado} onChange={(e) => setNuevo({ ...nuevo, apartado: e.target.value })}>
            <option value="">Toda la lección</option>{apartados.map((a) => <option key={a} value={a}>{a}</option>)}</select>}
          {nuevo.tipo === 'unidad' && <select className="campo" value={nuevo.unit_id} onChange={(e) => setNuevo({ ...nuevo, unit_id: e.target.value })}>
            <option value="">Unidad…</option>{(cat.data?.unidades ?? []).map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}</select>}
          {nuevo.tipo === 'brecha' && <input className="campo" placeholder="Concepto trabajado en clase" value={nuevo.concepto} onChange={(e) => setNuevo({ ...nuevo, concepto: e.target.value })} />}
          {nuevo.tipo !== 'brecha' && <select className="campo" value={nuevo.cobertura} onChange={(e) => setNuevo({ ...nuevo, cobertura: e.target.value })}>
            <option value="completa">Desarrollado en la teoría</option><option value="parcial">Desarrollado en parte</option></select>}
          <button className="btn-secundario" disabled={accion.busy} onClick={() => void accion.run(async () => {
            await agregarEnlace(c.id, { tipo: nuevo.tipo as never, lesson_id: nuevo.lesson_id || null, unit_id: nuevo.unit_id || null, apartado: nuevo.apartado || null,
              concepto: nuevo.concepto || null, cobertura: (nuevo.tipo === 'brecha' ? 'ninguna' : nuevo.cobertura) as never });
            setNuevo({ ...nuevo, concepto: '' }); onCambio();
          })}>Añadir</button>
        </div>
      </details>
      <ErrorBox error={accion.error} />
    </div>
  );
}

function DialogoGenerar({ c, onCerrar, onIniciado }: { c: ClaseDetalle; onCerrar: () => void; onIniciado: () => void }) {
  const reg = useAsync(async () => {
    const [m, d] = await Promise.all([modelosRegistro(), disponibilidadModelos().catch(() => null)]);
    return { modelos: (m ?? []).filter((x) => x.activo && x.acepta_imagenes), disp: d };
  }, []);
  const [model, setModel] = useState(c.modelo_preferido ?? 'claude-sonnet-5-5');
  const [nivel, setNivel] = useState<Nivel>('detallado');
  const [instr, setInstr] = useState('');
  const [preferido, setPreferido] = useState(false);
  const requestId = useRef(crypto.randomUUID());     // el mismo en reintentos: el servidor no genera dos veces
  const accion = useAction();
  const [motivo, setMotivo] = useState<string | null>(null);
  const tarifa = reg.data?.modelos.find((m) => m.model_id === model);
  const est = useMemo(() => (tarifa ? estimar(tarifa, nivel, c.imagenes) : null), [tarifa, nivel, c.imagenes]);
  const disponible = (m: ModeloRegistro) => { const x = reg.data?.disp?.modelos?.[m.model_id]; return x == null ? null : x.disponible && x.imagenes; };
  const yaGenerada = (c.generaciones ?? []).some((g) => g.estado === 'ok');
  return (
    <Modal open onClose={onCerrar} title="Generar clase ampliada con IA">
      {reg.loading ? <Spinner /> : (
        <div className="space-y-3 text-sm">
          <fieldset>
            <legend className="etiqueta">Modelo</legend>
            {reg.data!.modelos.map((m) => {
              const d = disponible(m);
              return (
                <label key={m.model_id} className={`flex items-center gap-2 py-1 ${d === false ? 'opacity-50' : ''}`}>
                  <input type="radio" name="modelo" disabled={d === false} checked={model === m.model_id} onChange={() => setModel(m.model_id)} />
                  <span className="font-medium">{m.nombre}</span>
                  <span className="text-xs text-gray-500">{m.precio_entrada} / {m.precio_salida} USD por millón de tokens (vigente desde {m.vigente_desde})</span>
                  {d === false && <Badge tone="red">no disponible</Badge>}
                </label>
              );
            })}
            {reg.data!.disp && !reg.data!.disp.comprobado && <p className="text-xs text-gray-500">Disponibilidad no comprobada en vivo ({reg.data!.disp.motivo === 'sin_clave' ? 'sin clave de API: modo simulado' : 'sin respuesta'}).</p>}
            <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={preferido} onChange={(e) => setPreferido(e.target.checked)} /> Guardar como mi modelo preferido</label>
          </fieldset>
          <fieldset>
            <legend className="etiqueta">Nivel de detalle</legend>
            {(Object.keys(NIVELES) as Nivel[]).map((n) => (
              <label key={n} className="flex items-center gap-2 py-0.5"><input type="radio" name="nivel" checked={nivel === n} onChange={() => setNivel(n)} />
                <span className="font-medium">{NIVELES[n].etiqueta}</span><span className="text-xs text-gray-500">{NIVELES[n].descripcion}</span></label>
            ))}
          </fieldset>
          <label className="block"><span className="etiqueta">Instrucciones académicas (opcional)</span>
            <textarea className="campo" rows={3} maxLength={2000} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Ej.: insistir en la comprobación dimensional; la pizarra 3 continúa el ejemplo de la 2." /></label>
          {est && (
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
              <p><strong>Estimación</strong> (no es el costo exacto): {est.fotos} fotografía(s), ~{est.entrada_tipica.toLocaleString('es-DO')}–{est.entrada_maxima.toLocaleString('es-DO')} tokens de entrada,
                hasta {est.salida_maxima.toLocaleString('es-DO')} de salida.</p>
              <p className="mt-1 text-base">≈ <strong>{usd(est.usd_tipico)}</strong> típico · máximo {usd(est.usd_maximo)}</p>
              <p className="mt-1 text-xs text-gray-500">El costo real se registra después con los tokens facturados. Se descuenta del presupuesto de Orbe IA.</p>
            </div>
          )}
          {yaGenerada && <Notice tone="warn">Esta clase ya tiene una generación: una nueva tiene otro costo y crea otro borrador (lo publicado no cambia).</Notice>}
          {motivo && <ErrorBox error={ERRORES_IA[motivo] ?? motivo} />}
          <ErrorBox error={accion.error} />
          <div className="flex gap-2">
            <button className="btn-acento" disabled={accion.busy || !tarifa} onClick={() => void accion.run(async () => {
              setMotivo(null);
              if (preferido) await guardarModeloPreferido(model);
              const r = await generarAmpliada(c.id, requestId.current, model, nivel, instr);
              if (r.ok === false) { setMotivo(r.motivo ?? 'error'); requestId.current = crypto.randomUUID(); return; }
              onIniciado();
            })}>Confirmar generación{est ? ` (≈ ${usd(est.usd_tipico)})` : ''}</button>
            <button className="btn-secundario" onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
