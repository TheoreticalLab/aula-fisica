/**
 * Prácticas anteriores · «Prácticas realizadas sin envío por correo» (estudiante). Registro libre en pocos pasos:
 * nombre → total → realizados → foto representativa o explicación → declaración → guardar → «Agregar otra práctica».
 */
import { useEffect, useState } from 'react';
import {
  guardarLibre, quitarFoto, responderAviso, responderSolicitud, subirFoto, type AvisoOmision, type MiSeccionLibre,
} from '@/api/practicasLibres';
import { optimizarCaptura, type CapturaOptimizada } from '@/lib/imagen';
import {
  errorCantidades, ESTADO_LIBRE, estadisticas, etiquetas, MODALIDADES, parecidosCorreo, parecidosPropios, pct, TEXTO_DECLARACION, TEXTO_INFORMACION,
  VERSION_DECLARACION, type Modalidad, type RegistroLibre,
} from '@/lib/practicasLibres';
import { kb } from '@/lib/regularizacion';
import { useAction } from '@/lib/util';
import { Badge, ErrorBox, Modal, Notice } from '@/components/ui';
import { VisorCaptura } from '@/components/VisorCaptura';

const negrita = (t: string) => t.split('**').map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>));

export function InformacionRegistro({ compacta = false }: { compacta?: boolean }) {
  const [abierta, setAbierta] = useState(!compacta);
  return (
    <div className="rounded-lg border border-primario-200 bg-primario-50 p-3 text-sm dark:border-white/15 dark:bg-white/5">
      <button type="button" className="flex w-full items-center justify-between text-left font-semibold" onClick={() => setAbierta(!abierta)} aria-expanded={abierta}>
        Información importante sobre el registro de prácticas <span aria-hidden="true">{abierta ? '▲' : '▼'}</span>
      </button>
      {abierta && <div className="mt-2 space-y-1.5">{TEXTO_INFORMACION.map((p) => <p key={p}>{negrita(p)}</p>)}</div>}
    </div>
  );
}

interface Foto { nueva?: CapturaOptimizada & { vista: string }; procesando?: boolean; error?: string }

async function optimizar(archivo: File, maxMb: number, set: (f: Foto) => void, anterior?: Foto) {
  set({ ...anterior, procesando: true, error: undefined });
  try {
    const c = await optimizarCaptura(archivo, maxMb * 1048576);
    if (anterior?.nueva) URL.revokeObjectURL(anterior.nueva.vista);
    set({ nueva: { ...c, vista: URL.createObjectURL(c.blob) } });
  } catch (e) {
    set({ ...anterior, procesando: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function SelectorFoto({ etiqueta, foto, setFoto, maxMb }: { etiqueta: string; foto: Foto; setFoto: (f: Foto) => void; maxMb: number }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-2 dark:border-white/20">
      <p className="mb-1 font-medium">{etiqueta}</p>
      {foto.nueva && (
        <>
          <img src={foto.nueva.vista} alt="Vista previa" className="max-h-64 w-full rounded border border-gray-200 bg-white object-contain dark:border-white/10" />
          <p className="mt-1 text-xs text-gray-500">{kb(foto.nueva.bytesOriginal)} → {kb(foto.nueva.bytes)} ({foto.nueva.ancho}×{foto.nueva.alto}). Se enviará al guardar.</p>
        </>
      )}
      {foto.procesando && <p className="text-xs text-gray-500">Optimizando la imagen…</p>}
      {foto.error && <p className="text-xs text-red-700 dark:text-red-400">{foto.error}</p>}
      <label className="btn-secundario mt-2 inline-block cursor-pointer text-sm">
        {foto.nueva ? 'Cambiar foto' : 'Elegir o tomar foto'}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void optimizar(f, maxMb, setFoto, foto); }} />
      </label>
    </div>
  );
}

function FormLibre({ s, r, preset, onListo, onCancelar, onEditar }: {
  s: MiSeccionLibre; r: RegistroLibre | null; preset?: { nombre: string; grupo: string | null }; onListo: (msg: string, id: string) => void; onCancelar: () => void;
  onEditar: (r: RegistroLibre) => void;
}) {
  const [id] = useState(() => r?.id ?? crypto.randomUUID());
  const [f, setF] = useState({
    nombre: r?.nombre ?? preset?.nombre ?? '', grupo: r?.grupo_elegido ?? preset?.grupo ?? '', total: r ? String(r.total_declarado) : '', realizados: r ? String(r.realizados_declarados) : '',
    modalidades: new Set<Modalidad>(r?.modalidades ?? []), modalidadOtra: r?.modalidad_otra ?? '', evidencia: (r?.sin_foto ? 'sin_foto' : 'foto') as 'foto' | 'sin_foto',
    explicacion: r?.explicacion_sin_foto ?? '', observaciones: r?.observaciones ?? '',
  });
  const existente = r?.fotos.find((x) => x.posicion === 1) ?? null;
  const [quitarExistente, setQuitarExistente] = useState(false);
  const [foto, setFoto] = useState<Foto>({});
  const [acepto, setAcepto] = useState(false);
  const [distinta, setDistinta] = useState(false);
  const accion = useAction();
  useEffect(() => () => { if (foto.nueva) URL.revokeObjectURL(foto.nueva.vista); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const total = f.total === '' ? null : Number(f.total), realizados = f.realizados === '' ? null : Number(f.realizados);
  const errCant = f.total !== '' || f.realizados !== '' ? errorCantidades(total, realizados, s.max_ejercicios) : null;
  const hizo = (realizados ?? 0) > 0;
  const tieneFoto = !!foto.nueva || (!!existente && !quitarExistente);
  const parecidos = parecidosPropios(f.nombre, total, s.registros, id);
  const enCorreo = parecidosCorreo(f.nombre, s.correo);
  const avisoDuplicado = parecidos.length > 0 || enCorreo.length > 0;
  const nombreOk = !!f.nombre.trim() || !!f.grupo;
  const falta = [
    ...(nombreOk ? [] : ['el nombre de la práctica']),
    ...(total === null || realizados === null || errCant ? ['las cantidades'] : []),
    ...(hizo && f.evidencia === 'sin_foto' && f.explicacion.trim().length < 10 ? ['explicar por qué no tienes fotografía'] : []),
    ...(!s.nombres_libres && !f.grupo ? ['elegir una práctica de la lista'] : []),
    ...(avisoDuplicado && !distinta ? ['confirmar que es una práctica diferente'] : []),
    // el texto mostrado debe ser la versión que el servidor registra; si no coincide, la página está desactualizada
    ...(s.version !== VERSION_DECLARACION ? ['recargar la página (hay una versión nueva del texto de la declaración)'] : []),
  ];

  async function guardar() {
    const ok = await accion.run(async () => {
      await guardarLibre({ id, class_id: s.class_id, nombre: f.nombre, total: total!, realizados: realizados!, modalidades: [...f.modalidades],
        modalidad_otra: f.modalidadOtra, sin_foto: hizo && f.evidencia === 'sin_foto', explicacion: f.explicacion, observaciones: f.observaciones, grupo: f.grupo || null }, s.version);
      return true;
    });
    if (!ok) return;
    let extra = '';
    try {
      if (hizo && f.evidencia === 'foto' && foto.nueva) await subirFoto(id, 1, foto.nueva);
      else if (existente && (quitarExistente || !hizo || f.evidencia === 'sin_foto')) await quitarFoto(existente.id);
    } catch (e) {
      extra = ` Tu registro quedó guardado, pero la foto no se pudo subir: ${e instanceof Error ? e.message : String(e)}. Puedes intentarlo de nuevo con «Corregir».`;
    }
    onListo((r ? 'Registro corregido.' : 'Práctica registrada. Quedó pendiente de revisión del profesor.') + extra, id);
  }

  return (
    <div className="space-y-3 text-sm">
      <InformacionRegistro compacta={!!r} />
      {r?.solicitud_tipo === 'correccion' && r.solicitud && <Notice tone="warn">El profesor pide una corrección: «{r.solicitud}»</Notice>}

      <label className="block font-medium">Nombre de la práctica *
        {s.grupos.length > 0 && (
          <select className="campo mb-1 font-normal" value={f.grupo} onChange={(e) => setF({ ...f, grupo: e.target.value, nombre: f.nombre || (s.grupos.find((g) => g.id === e.target.value)?.nombre ?? '') })}>
            <option value="">{s.nombres_libres ? '— Elegir de las prácticas ya identificadas (opcional) —' : '— Elegir la práctica —'}</option>
            {s.grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        )}
        {s.nombres_libres && <input className="campo font-normal" maxLength={160} placeholder="Leyes de Newton" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />}
      </label>

      {avisoDuplicado && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-2 text-xs dark:bg-amber-900/20">
          {parecidos.length > 0 && (
            <>
              <p className="font-medium">Ya registraste una práctica con un nombre similar:</p>
              <ul className="my-1 space-y-1">
                {parecidos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2">«{p.nombre}» ({p.realizados_declarados} de {p.total_declarado})
                    {p.editable && <button type="button" className="btn-texto text-xs" onClick={() => onEditar(p)}>Revisar ese registro</button>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {enCorreo.length > 0 && <p className="font-medium">Parece que ya la registraste como enviada por correo (práctica {enCorreo.map((c) => c.numero).join(', ')}). No la dupliques si es la misma.</p>}
          <label className="mt-1 flex items-center gap-2"><input type="checkbox" checked={distinta} onChange={(e) => setDistinta(e.target.checked)} /> Es una práctica diferente; continuar</label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block font-medium">¿Cuántos ejercicios contenía? *
          <input type="number" inputMode="numeric" min={1} max={s.max_ejercicios} className="campo font-normal" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} />
        </label>
        <label className="block font-medium">¿Cuántos realizaste? *
          <input type="number" inputMode="numeric" min={0} max={total ?? undefined} className="campo font-normal" value={f.realizados} onChange={(e) => setF({ ...f, realizados: e.target.value })} />
        </label>
      </div>
      {errCant && <p className="text-xs text-red-700 dark:text-red-400">{errCant}</p>}
      {realizados === 0 && !errCant && <p className="text-xs text-gray-600 dark:text-gray-300">Quedará como «práctica declarada como no realizada». No necesitas foto.</p>}

      <fieldset>
        <legend className="mb-1 font-medium">¿Cómo la realizaste? (puedes marcar varias)</legend>
        <div className="grid grid-cols-2 gap-1">
          {MODALIDADES.map(([k, t]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={f.modalidades.has(k)} onChange={(e) => { const m = new Set(f.modalidades); if (e.target.checked) m.add(k); else m.delete(k); setF({ ...f, modalidades: m }); }} /> {t}
            </label>
          ))}
        </div>
        {f.modalidades.has('otra') && <input className="campo mt-1" maxLength={120} placeholder="¿Cuál?" value={f.modalidadOtra} onChange={(e) => setF({ ...f, modalidadOtra: e.target.value })} />}
      </fieldset>

      {hizo && (
        <fieldset className="space-y-2">
          <legend className="mb-1 font-medium">Evidencia</legend>
          <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={f.evidencia === 'foto'} onChange={() => setF({ ...f, evidencia: 'foto' })} /> Adjuntar una fotografía representativa (basta con una parte del trabajo)</label>
          {s.sin_foto_permitido && <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={f.evidencia === 'sin_foto'} onChange={() => setF({ ...f, evidencia: 'sin_foto' })} /> La realicé, pero no conservo evidencia fotográfica</label>}
          {f.evidencia === 'foto' ? (
            existente && !quitarExistente && !foto.nueva ? (
              <div>
                <VisorCaptura id={existente.id} etiqueta="Foto guardada" bytes={existente.bytes} ancho={existente.ancho} alto={existente.alto} destino="libre" />
                <div className="mt-1 flex gap-2">
                  <label className="btn-secundario cursor-pointer text-sm">Cambiar foto
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) void optimizar(x, s.max_mb_captura, setFoto, foto); }} />
                  </label>
                  <button type="button" className="btn-texto text-sm" onClick={() => setQuitarExistente(true)}>Quitar</button>
                </div>
              </div>
            ) : <SelectorFoto etiqueta="Fotografía representativa" foto={foto} setFoto={setFoto} maxMb={s.max_mb_captura} />
          ) : (
            <label className="block">Explica brevemente por qué no tienes fotografía *
              <textarea className="campo min-h-[3rem]" maxLength={1000} placeholder="Esta práctica fue realizada en la pizarra durante la clase y no tomé fotografías." value={f.explicacion} onChange={(e) => setF({ ...f, explicacion: e.target.value })} />
              <span className="text-xs text-gray-500">Quedará como «sin evidencia fotográfica; pendiente de verificación». El profesor decidirá cómo verificarla.</span>
            </label>
          )}
          {f.evidencia === 'foto' && !tieneFoto && <p className="text-xs text-amber-700 dark:text-amber-300">Puedes guardar ahora y añadir la foto después con «Corregir».</p>}
        </fieldset>
      )}

      <label className="block">Observaciones (opcional)
        <textarea className="campo min-h-[3rem]" maxLength={1000} placeholder="La práctica tenía unos doce ejercicios; hice nueve y corregí dos en la pizarra." value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} />
      </label>

      <label className="flex items-start gap-2 font-medium"><input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} /> {TEXTO_DECLARACION}</label>
      {falta.length > 0 && <p className="text-xs text-gray-600 dark:text-gray-400">Falta: {falta.join(', ')}.</p>}
      <ErrorBox error={accion.error} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" disabled={accion.busy || foto.procesando || falta.length > 0 || !acepto} onClick={() => void guardar()}>{r ? 'GUARDAR CORRECCIÓN' : 'GUARDAR'}</button>
        <button className="btn-texto" disabled={accion.busy} onClick={onCancelar}>Cancelar</button>
      </div>
      {accion.busy && <p className="text-xs text-gray-500">Guardando…</p>}
    </div>
  );
}

function ResponderSolicitud({ s, r, onListo, onCorregir }: { s: MiSeccionLibre; r: RegistroLibre; onListo: (m: string) => void; onCorregir: () => void }) {
  const libres = [2, 3, 4].filter((p) => !r.fotos.some((x) => x.posicion === p));
  const [fotos, setFotos] = useState<Record<number, Foto>>({});
  const [texto, setTexto] = useState('');
  const [noDisponible, setNoDisponible] = useState(false);
  const accion = useAction();
  const nuevas = Object.entries(fotos).filter(([, x]) => x.nueva);
  async function enviar() {
    const ok = await accion.run(async () => {
      for (const [p, x] of nuevas) await subirFoto(r.id, Number(p), x.nueva!);
      await responderSolicitud(r.id, texto, noDisponible);
      return true;
    });
    if (ok) onListo('Respuesta enviada al profesor.');
  }
  const tipo = { fotos: 'fotografías adicionales', presencial: 'presentar el trabajo en persona', explicacion: 'una explicación', correccion: 'una corrección' }[r.solicitud_tipo ?? 'explicacion'];
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-amber-400 p-2 text-sm">
      <p>El profesor solicita <strong>{tipo}</strong> de la práctica «{r.nombre}». Declaraste haber realizado {r.realizados_declarados} de {r.total_declarado} ejercicios.</p>
      {r.solicitud && <p className="italic">«{r.solicitud}»</p>}
      {r.solicitud_tipo === 'correccion' && <button className="btn-secundario text-sm" onClick={onCorregir}>Corregir el registro</button>}
      {r.solicitud_tipo === 'fotos' && libres.map((p) => (
        <SelectorFoto key={p} etiqueta={`Foto adicional ${p - 1}`} foto={fotos[p] ?? {}} setFoto={(x) => setFotos((m) => ({ ...m, [p]: x }))} maxMb={s.max_mb_captura} />
      ))}
      {r.fotos.filter((x) => x.posicion > 1).map((x) => <VisorCaptura key={x.id} id={x.id} etiqueta={`Foto adicional ${x.posicion - 1} (ya enviada)`} bytes={x.bytes} ancho={x.ancho} alto={x.alto} destino="libre" />)}
      <textarea className="campo min-h-[3rem]" maxLength={1000} placeholder="Tu explicación o respuesta" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={noDisponible} onChange={(e) => setNoDisponible(e.target.checked)} /> Ya no conservo el material original</label>
      <ErrorBox error={accion.error} />
      <button className="btn-primario" disabled={accion.busy || (!texto.trim() && !noDisponible && !nuevas.length)} onClick={() => void enviar()}>Enviar respuesta</button>
    </div>
  );
}

function AvisoPendiente({ a, s, onRegistrar, onListo }: { a: AvisoOmision; s: MiSeccionLibre; onRegistrar: () => void; onListo: (m: string) => void }) {
  const [otro, setOtro] = useState('');
  const accion = useAction();
  const responder = (estado: 'no_realizada' | 'otro_nombre') => void accion.run(async () => {
    await responderAviso(a.id, estado, estado === 'otro_nombre' ? otro : null, '');
    onListo('Respuesta enviada al profesor.');
  });
  return (
    <div className="rounded-lg border border-amber-400 p-2 text-sm">
      <p>El profesor pregunta por la práctica <strong>«{a.grupo}»</strong>{a.total_oficial ? ` (${a.total_oficial} ejercicios)` : ''}: no tienes un registro de ella.</p>
      {a.nota && <p className="italic">«{a.nota}»</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn-primario text-sm" onClick={onRegistrar} disabled={!s.nuevos}>La realicé: registrarla</button>
        <button className="btn-secundario text-sm" disabled={accion.busy} onClick={() => responder('no_realizada')}>No la realicé</button>
      </div>
      {s.registros.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="campo flex-1 text-sm" value={otro} onChange={(e) => setOtro(e.target.value)}>
            <option value="">Ya la registré con otro nombre…</option>
            {s.registros.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <button className="btn-secundario text-sm" disabled={!otro || accion.busy} onClick={() => responder('otro_nombre')}>Indicar</button>
        </div>
      )}
      <ErrorBox error={accion.error} />
    </div>
  );
}

type Edicion = { r: RegistroLibre | null; preset?: { nombre: string; grupo: string | null }; aviso?: string } | null;

export function SeccionLibre({ s, recargar }: { s: MiSeccionLibre; recargar: () => void }) {
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState(false);
  const accion = useAction();
  const st = estadisticas(s.registros);
  const avisos = s.avisos.filter((a) => a.estado === 'pendiente');
  const listo = (m: string, nuevoId?: string, avisoId?: string) => {
    setEdicion(null); setAviso(m); setUltimo(true);
    if (avisoId && nuevoId) void accion.run(() => responderAviso(avisoId, 'registrada', nuevoId, '')).then(recargar);
    else recargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (edicion) {
    return (
      <div>
        <h3 className="mb-2 font-semibold">{edicion.r ? `Corregir «${edicion.r.nombre}»` : 'Agregar práctica sin envío por correo'}</h3>
        <FormLibre s={s} r={edicion.r} preset={edicion.preset} onCancelar={() => setEdicion(null)} onEditar={(r) => setEdicion({ r })}
          onListo={(m, id) => listo(m, id, edicion.aviso)} />
      </div>
    );
  }
  return (
    <div className="space-y-3 text-sm">
      {aviso && <Notice tone="ok">{aviso}</Notice>}
      <ErrorBox error={accion.error} />
      {!s.habilitado && <Notice tone="warn">El profesor deshabilitó por ahora esta modalidad: puedes ver tus registros.</Notice>}
      {s.habilitado && !s.nuevos && <Notice tone="info">{s.terminado_at ? 'Marcaste que terminaste la regularización.' : 'El profesor cerró los registros nuevos.'} Puedes atender las solicitudes del profesor{s.correcciones ? ' y corregir lo que aún no se ha revisado' : ''}.</Notice>}
      {avisos.map((a) => (
        <AvisoPendiente key={a.id} a={a} s={s} onListo={(m) => listo(m)} onRegistrar={() => setEdicion({ r: null, preset: { nombre: a.grupo, grupo: s.grupos.find((g) => g.nombre === a.grupo)?.id ?? null }, aviso: a.id })} />
      ))}

      {s.registros.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[['Prácticas registradas', st.practicas], ['Ejercicios totales declarados', st.total], ['Ejercicios realizados declarados', st.realizados], ['Cumplimiento declarado', pct(st.cumplimiento)]].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-gray-200 p-2 dark:border-white/10"><div className="text-lg font-semibold tabular-nums">{v}</div><div className="text-xs text-gray-500">{k}</div></div>
          ))}
        </div>
      )}
      {s.registros.length > 0 && (
        <p className="text-xs text-gray-500">
          El «cumplimiento declarado» se calcula solo con las prácticas que registraste (Σ realizados ÷ Σ totales). No es una calificación, no está verificado y no representa todas las prácticas del semestre.
        </p>
      )}

      {s.registros.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-300">Aún no has registrado prácticas sin envío por correo.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-white/10">
          {s.registros.map((r) => (
            <li key={r.id} className="py-2">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.nombre}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    {r.realizados_declarados} de {r.total_declarado} ejercicios · {pct((100 * r.realizados_declarados) / r.total_declarado)}
                    {' · '}{r.fotos.some((x) => x.posicion === 1) ? 'con foto' : r.sin_foto ? 'sin foto (explicado)' : r.realizados_declarados ? 'sin foto' : '—'}
                  </p>
                  {etiquetas(r).map((e) => <span key={e} className="mr-1 text-xs text-amber-700 dark:text-amber-300">{e}.</span>)}
                  {r.estado === 'validado' && r.realizados_verificados !== null && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Verificados por el profesor: {r.realizados_verificados}{r.total_oficial ?? r.total_oficial_grupo ? ` de ${r.total_oficial ?? r.total_oficial_grupo}` : ''}</p>
                  )}
                </div>
                <Badge tone={ESTADO_LIBRE[r.estado].tono}>{ESTADO_LIBRE[r.estado].estudiante}</Badge>
                {r.editable && <button className="btn-texto text-sm" onClick={() => { setAviso(null); setEdicion({ r }); }}>Corregir</button>}
              </div>
              {(r.estado === 'evidencia_solicitada' || r.estado === 'correccion_solicitada') && (
                <ResponderSolicitud s={s} r={r} onListo={(m) => listo(m)} onCorregir={() => setEdicion({ r })} />
              )}
            </li>
          ))}
        </ul>
      )}

      {s.habilitado && s.nuevos && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario" disabled={s.registros.length >= s.max_registros} onClick={() => { setAviso(null); setEdicion({ r: null }); }}>
            {ultimo ? '+ Agregar otra práctica' : '+ Agregar práctica sin envío por correo'}
          </button>
        </div>
      )}
      {s.registros.length >= s.max_registros && <p className="text-xs text-gray-500">Alcanzaste el máximo de {s.max_registros} registros.</p>}
    </div>
  );
}

/** Ventana para elegir modalidad cuando el estudiante no sabe cuál usar. */
export function AyudaModalidades({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="¿Qué modalidad uso?">
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li><strong>Enviadas por correo u otra vía:</strong> la entregaste por correo, mensajería u otro canal digital. Adjuntas una captura del envío.</li>
        <li><strong>Sin envío por correo:</strong> la hiciste en el cuaderno, en hojas, en clase, en la pizarra o en casa y no la enviaste. Indicas cuántos ejercicios tenía y cuántos hiciste, con una foto representativa o una explicación.</li>
      </ul>
      <p className="mt-2 text-sm">No registres la misma práctica en las dos modalidades.</p>
    </Modal>
  );
}
