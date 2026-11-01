/**
 * Regularización de prácticas anteriores (estudiante). Cuatro pasos: elegir la práctica, decir cómo y cuándo se envió,
 * adjuntar UNA captura del envío y registrar. No se sube el documento de la práctica.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  eliminarBorrador, guardarRegistro, misSecciones, quitarCaptura, registrar, subirCaptura, sugerir,
  type MiRegistro, type MiSeccion,
} from '@/api/regularizacion';
import { optimizarCaptura, type CapturaOptimizada } from '@/lib/imagen';
import { correoValido, ESTADO, faltantes, kb, recomendaciones, type Medio, type Tipo } from '@/lib/regularizacion';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Modal, Notice, PageTitle, ProgressBar, Spinner } from '@/components/ui';
import { VisorCaptura } from '@/components/VisorCaptura';

const DECLARACION = 'Declaro que la información proporcionada corresponde a una práctica que entregué anteriormente al profesor y que la captura adjunta procede del medio indicado.';
const DECLARACION_INCIDENCIA = 'Declaro que la información proporcionada corresponde a una práctica que entregué anteriormente al profesor y que no conservo la captura del envío.';
const EXITO = 'Tu evidencia fue registrada correctamente. El profesor podrá utilizar esta información para localizar y verificar tu entrega original.';
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fechaCorta = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-DO', { dateStyle: 'medium' }) : null);
const nombrePractica = (s: MiSeccion, id: string) => {
  const p = s.practicas.find((x) => x.id === id);
  return p ? `Práctica ${p.numero}${p.titulo ? ` · ${p.titulo}` : ''}` : 'Práctica';
};

interface Ranura { existente?: { id: string; bytes: number; ancho: number; alto: number }; nueva?: CapturaOptimizada & { vista: string }; quitar?: boolean; procesando?: boolean; error?: string }

function FormRegistro({ s, r, tipo, onListo, onCancelar }: { s: MiSeccion; r: MiRegistro | null; tipo: Tipo; onListo: (msg: string) => void; onCancelar: () => void }) {
  const [id] = useState(() => r?.id ?? crypto.randomUUID());
  const [f, setF] = useState({
    practice_id: r?.practice_id ?? '', tema: r?.tema ?? '', descripcion: r?.descripcion ?? '', fecha: r?.fecha_declarada ?? '', fechaDesconocida: r?.fecha_desconocida ?? false,
    medio: (r?.medio ?? null) as Medio | null, correo: r?.correo_remitente ?? '', otraVia: r?.otra_via ?? '', contacto: r?.contacto ?? '', motivo: r?.motivo_incidencia ?? '',
  });
  const [ranuras, setRanuras] = useState<Ranura[]>(() => [1, 2, 3].map((p) => {
    const c = r?.capturas.find((x) => x.posicion === p);
    return c ? { existente: c } : {};
  }));
  const [acepto, setAcepto] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const accion = useAction();
  const aclaracion = r?.estado === 'aclaracion';
  const enviado = r != null && r.estado !== 'borrador';
  useEffect(() => () => ranuras.forEach((x) => x.nueva && URL.revokeObjectURL(x.nueva.vista)), []);   // eslint-disable-line react-hooks/exhaustive-deps

  const usadas = new Set(s.registros.filter((x) => x.id !== id && x.tipo === tipo).map((x) => x.practice_id));
  const tienePrincipal = !!(ranuras[0].nueva || (ranuras[0].existente && !ranuras[0].quitar));
  const borrador = { tipo, medio: f.medio, otra_via: f.otraVia, correo_remitente: f.correo, motivo_incidencia: f.motivo, tieneCapturaPrincipal: tienePrincipal };
  const falta = [...(f.practice_id ? [] : ['elegir la práctica']), ...faltantes(borrador)];
  const consejos = recomendaciones({ ...borrador, fecha_desconocida: f.fechaDesconocida, fecha_declarada: f.fecha || null, tema: f.tema });
  const errorCorreo = f.medio === 'correo' && f.correo.trim() && !correoValido(f.correo) ? 'La dirección no parece válida.' : null;
  const procesando = ranuras.some((x) => x.procesando);
  const pasos = [!!f.practice_id, !!f.medio && (f.medio === 'correo' || !!f.otraVia.trim()), tipo === 'incidencia' ? !!f.motivo.trim() : tienePrincipal, acepto];

  async function elegirImagen(i: number, archivo: File | undefined) {
    if (!archivo) return;
    setRanuras((rs) => rs.map((x, j) => (j === i ? { ...x, procesando: true, error: undefined } : x)));
    try {
      const c = await optimizarCaptura(archivo, s.max_mb_captura * 1048576);
      setRanuras((rs) => rs.map((x, j) => {
        if (j !== i) return x;
        if (x.nueva) URL.revokeObjectURL(x.nueva.vista);
        return { ...x, nueva: { ...c, vista: URL.createObjectURL(c.blob) }, quitar: false, procesando: false };
      }));
    } catch (e) {
      setRanuras((rs) => rs.map((x, j) => (j === i ? { ...x, procesando: false, error: e instanceof Error ? e.message : String(e) } : x)));
    }
  }

  /** Guarda los datos y sincroniza las capturas. Devuelve true si quedó bien. */
  async function guardarTodo(): Promise<boolean> {
    const ok = await accion.run(async () => {
      await guardarRegistro({ id, class_id: s.class_id, practice_id: f.practice_id, tipo, tema: f.tema, descripcion: f.descripcion, fecha_declarada: f.fecha || null,
        fecha_desconocida: f.fechaDesconocida, medio: f.medio, correo_remitente: f.correo, otra_via: f.otraVia, contacto: f.contacto, motivo_incidencia: f.motivo });
      for (const [i, x] of ranuras.entries()) {
        if (x.nueva) await subirCaptura(id, i + 1, x.nueva);
        else if (x.quitar && x.existente) await quitarCaptura(x.existente.id);
      }
      return true;
    });
    return ok === true;
  }
  async function guardarBorrador() {
    if (await guardarTodo()) onListo(enviado ? 'Cambios guardados.' : 'Borrador guardado. Puedes completarlo y registrarlo después.');
  }
  async function registrarYa() {
    if (!(await guardarTodo())) return;
    const res = await accion.run(() => registrar([id], acepto, aclaracion ? respuesta.trim() || null : null));
    if (!res) return;
    if (res.errores.length) accion.setError(res.errores.map((e) => e.motivo).join(' · '));
    else onListo(EXITO);
  }

  return (
    <Card title={r ? `${tipo === 'incidencia' ? 'Incidencia' : 'Registro'} · ${nombrePractica(s, r.practice_id)}` : tipo === 'incidencia' ? 'No tengo la captura del envío' : 'Registrar una práctica'}>
      <div className="mb-3 flex gap-1" aria-label="Progreso del registro">
        {['Práctica', 'Medio', tipo === 'incidencia' ? 'Motivo' : 'Captura', 'Confirmar'].map((t, i) => (
          <div key={t} className="flex-1 text-center text-[11px]">
            <div className={`mb-1 h-1.5 rounded-full ${pasos[i] ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/10'}`} />
            {i + 1}. {t}
          </div>
        ))}
      </div>
      {aclaracion && r?.nota_docente && <div className="mb-3"><Notice tone="warn">El profesor pide una aclaración: «{r.nota_docente}». Corrige lo necesario y responde abajo.</Notice></div>}
      {tipo === 'incidencia' && <div className="mb-3"><Notice tone="info">Usa esto solo si perdiste la evidencia del envío. El profesor decidirá si hace una revisión excepcional; una incidencia no cuenta como entrega acreditada.</Notice></div>}

      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 font-semibold">1. ¿Qué práctica entregaste?</legend>
        <label className="block">Número de práctica
          <select className="campo" value={f.practice_id} onChange={(e) => setF({ ...f, practice_id: e.target.value })}>
            <option value="">— Elegir —</option>
            {s.practicas.map((p) => (
              <option key={p.id} value={p.id} disabled={usadas.has(p.id)}>
                Práctica {p.numero}{p.titulo ? ` · ${p.titulo}` : ''}{usadas.has(p.id) ? ' (ya la registraste)' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-gray-500">Las posiciones son provisionales: registra solo las que recuerdes. Si hubo más, usa «Profesor, recuerdo otra práctica».</p>
        <label className="block">Nombre o tema
          <input className="campo" maxLength={160} placeholder="Práctica sobre las leyes de Newton" value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })} />
        </label>
        <label className="block">Descripción (opcional)
          <textarea className="campo min-h-[3rem]" maxLength={1000} placeholder="Algo que ayude a identificarla" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </label>
        <label className="block">Fecha aproximada de entrega
          <input type="date" className="campo" max={hoy()} disabled={f.fechaDesconocida} value={f.fechaDesconocida ? '' : f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.fechaDesconocida} onChange={(e) => setF({ ...f, fechaDesconocida: e.target.checked })} /> No recuerdo la fecha</label>
      </fieldset>

      <fieldset className="mt-4 space-y-2 text-sm">
        <legend className="mb-1 font-semibold">2. ¿Por cuál medio enviaste esta práctica al profesor?</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2"><input type="radio" name={`medio-${id}`} checked={f.medio === 'correo'} onChange={() => setF({ ...f, medio: 'correo' })} /> Correo electrónico</label>
          <label className="flex items-center gap-2"><input type="radio" name={`medio-${id}`} checked={f.medio === 'otra'} onChange={() => setF({ ...f, medio: 'otra' })} /> Otra vía</label>
        </div>
        {f.medio === 'correo' && (
          <label className="block">¿Desde cuál dirección de correo la enviaste?
            <input type="email" inputMode="email" autoComplete="email" className="campo" maxLength={200} placeholder="tu.correo@ejemplo.com" value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} />
            {errorCorreo && <span className="text-xs text-red-700 dark:text-red-400">{errorCorreo}</span>}
          </label>
        )}
        {f.medio === 'otra' && (
          <>
            <label className="block">Especifica por cuál medio la enviaste <span className="text-red-600">*</span>
              <input className="campo" maxLength={120} placeholder="Aplicación de mensajería, plataforma de comunicación…" value={f.otraVia} onChange={(e) => setF({ ...f, otraVia: e.target.value })} />
            </label>
            <label className="block">Cuenta, nombre o contacto desde el que realizaste el envío (opcional)
              <input className="campo" maxLength={200} value={f.contacto} onChange={(e) => setF({ ...f, contacto: e.target.value })} />
            </label>
          </>
        )}
        <p className="text-xs text-gray-500">Nunca escribas contraseñas ni des acceso a tus cuentas.</p>
      </fieldset>

      {tipo === 'evidencia' ? (
        <fieldset className="mt-4 space-y-2 text-sm">
          <legend className="mb-1 font-semibold">3. Adjunta una captura de pantalla que muestre que enviaste esta práctica</legend>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            La captura debe venir del medio que indicaste (el correo enviado o la conversación) y, si es posible, dejar ver la fecha, el destinatario, la referencia a la
            práctica y que el mensaje se envió. Servirá para localizar y revisar tu entrega original. <strong>No subas el documento de la práctica.</strong> Puedes
            ocultar datos de otras personas que no hagan falta.
          </p>
          {ranuras.map((x, i) => (
            <div key={i} className="rounded-lg border border-dashed border-gray-300 p-2 dark:border-white/20">
              <p className="mb-1 font-medium">{i === 0 ? 'Captura principal *' : `Captura complementaria ${i} (opcional)`}</p>
              {x.nueva ? (
                <div>
                  <img src={x.nueva.vista} alt="Vista previa" className="max-h-72 w-full rounded border border-gray-200 bg-white object-contain dark:border-white/10" />
                  <p className="mt-1 text-xs text-gray-500">
                    Original {kb(x.nueva.bytesOriginal)} ({x.nueva.anchoOriginal}×{x.nueva.altoOriginal}) → {kb(x.nueva.bytes)} ({x.nueva.ancho}×{x.nueva.alto}, {x.nueva.tipo === 'image/webp' ? 'WebP' : 'JPEG'})
                    {!x.nueva.enObjetivo && ' · se conservó más grande para que siga legible'}. Aún no se ha enviado.
                  </p>
                </div>
              ) : x.existente && !x.quitar ? (
                <VisorCaptura id={x.existente.id} etiqueta="Captura guardada" bytes={x.existente.bytes} ancho={x.existente.ancho} alto={x.existente.alto} />
              ) : null}
              {x.procesando && <p className="text-xs text-gray-500">Optimizando la imagen…</p>}
              {x.error && <p className="text-xs text-red-700 dark:text-red-400">{x.error}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="btn-secundario cursor-pointer text-sm">
                  {x.nueva || (x.existente && !x.quitar) ? 'Cambiar imagen' : 'Elegir imagen'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { void elegirImagen(i, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                {(x.nueva || (x.existente && !x.quitar)) && (i > 0 || !enviado) && (
                  <button className="btn-texto text-sm" onClick={() => setRanuras((rs) => rs.map((y, j) => {
                    if (j !== i) return y;
                    if (y.nueva) { URL.revokeObjectURL(y.nueva.vista); return { existente: y.existente }; }
                    return { ...y, quitar: true };
                  }))}>Quitar</button>
                )}
              </div>
            </div>
          ))}
        </fieldset>
      ) : (
        <fieldset className="mt-4 space-y-2 text-sm">
          <legend className="mb-1 font-semibold">3. ¿Qué pasó con la evidencia del envío?</legend>
          <textarea className="campo min-h-[4rem]" maxLength={1000} placeholder="Por ejemplo: cambié de teléfono y perdí la conversación." value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
        </fieldset>
      )}

      <fieldset className="mt-4 space-y-2 text-sm">
        <legend className="mb-1 font-semibold">4. Confirmación</legend>
        {aclaracion && (
          <label className="block">Tu respuesta al profesor
            <textarea className="campo min-h-[3rem]" maxLength={1000} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
          </label>
        )}
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} /> {tipo === 'incidencia' ? DECLARACION_INCIDENCIA : DECLARACION}</label>
      </fieldset>

      {consejos.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-amber-800 dark:text-amber-300">{consejos.map((c) => <li key={c}>{c}</li>)}</ul>}
      {falta.length > 0 && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Para registrar falta: {falta.join(', ')}.</p>}
      <ErrorBox error={accion.error} />
      <div className="mt-3 flex flex-wrap gap-2">
        {!enviado || aclaracion ? (
          <button className="btn-primario" disabled={accion.busy || procesando || falta.length > 0 || !acepto || !!errorCorreo} onClick={() => void registrarYa()}>
            {aclaracion ? 'RESPONDER Y VOLVER A ENVIAR' : tipo === 'incidencia' ? 'REGISTRAR INCIDENCIA' : 'REGISTRAR EVIDENCIA'}
          </button>
        ) : null}
        <button className="btn-secundario" disabled={accion.busy || procesando || !f.practice_id || !!errorCorreo || (enviado && falta.length > 0)} onClick={() => void guardarBorrador()}>
          {enviado ? 'Guardar corrección' : 'Guardar borrador'}
        </button>
        <button className="btn-texto" disabled={accion.busy} onClick={onCancelar}>Cancelar</button>
      </div>
      {accion.busy && <p className="mt-2 text-xs text-gray-500">Guardando…</p>}
    </Card>
  );
}

function FormSugerencia({ s, onListo, onCancelar }: { s: MiSeccion; onListo: (m: string) => void; onCancelar: () => void }) {
  const [f, setF] = useState({ tema: '', descripcion: '', fecha: '', comentarios: '', total: '' });
  const accion = useAction();
  const total = f.total ? Number(f.total) : null;
  async function enviar() {
    const ok = await accion.run(() => sugerir({ class_id: s.class_id, tema: f.tema.trim(), descripcion: f.descripcion, fecha: f.fecha || null, comentarios: f.comentarios, total }));
    if (ok) onListo('Gracias. El profesor revisará tu sugerencia; no se convierte sola en una práctica oficial.');
  }
  return (
    <Card title="Profesor, recuerdo otra práctica">
      <div className="space-y-2 text-sm">
        <label className="block">Tema<input className="campo" maxLength={160} value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })} /></label>
        <label className="block">Descripción<textarea className="campo min-h-[3rem]" maxLength={1000} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
        <label className="block">Fecha aproximada (opcional)<input type="date" className="campo" max={hoy()} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
        <label className="block">Comentarios<textarea className="campo min-h-[3rem]" maxLength={1000} value={f.comentarios} onChange={(e) => setF({ ...f, comentarios: e.target.value })} /></label>
        <label className="block">¿Cuántas prácticas crees que se asignaron en total? (opcional)
          <input type="number" min={1} max={60} inputMode="numeric" className="campo w-32" placeholder="12" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} />
        </label>
        <ErrorBox error={accion.error} />
        <div className="flex gap-2">
          <button className="btn-primario" disabled={accion.busy || (!f.tema.trim() && !total)} onClick={() => void enviar()}>Enviar al profesor</button>
          <button className="btn-texto" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </Card>
  );
}

type Edicion = { modo: 'registro'; r: MiRegistro | null; tipo: Tipo } | { modo: 'sugerencia' } | null;

function Seccion({ s, recargar, varias }: { s: MiSeccion; recargar: () => void; varias: boolean }) {
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmarVarios, setConfirmarVarios] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const accion = useAction();
  const borradores = s.registros.filter((r) => r.estado === 'borrador');
  const completos = borradores.filter((r) => r.faltantes.length === 0);
  const enviados = s.registros.filter((r) => r.estado !== 'borrador');
  const revisados = enviados.filter((r) => !['registrada', 'aclaracion'].includes(r.estado));
  const aclarar = s.registros.filter((r) => r.estado === 'aclaracion');

  const listo = (m: string) => { setEdicion(null); setAviso(m); recargar(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  async function registrarMarcados() {
    const res = await accion.run(() => registrar([...marcados], acepto));
    if (!res) return;
    setConfirmarVarios(false); setMarcados(new Set()); setAcepto(false);
    setAviso(res.errores.length ? `Se registraron ${res.registradas}. No se pudieron registrar ${res.errores.length}: ${res.errores.map((e) => e.motivo).join(' · ')}` : `${res.registradas === 1 ? EXITO : `Se registraron ${res.registradas} evidencias. El profesor podrá utilizar esta información para localizar y verificar tus entregas originales.`}`);
    recargar();
  }
  async function borrar(r: MiRegistro) {
    if (!window.confirm('¿Eliminar este borrador? Sus capturas también se borran.')) return;
    await accion.run(async () => { await eliminarBorrador(r.id); recargar(); });
  }

  if (edicion?.modo === 'registro') return <FormRegistro s={s} r={edicion.r} tipo={edicion.tipo} onListo={listo} onCancelar={() => setEdicion(null)} />;
  if (edicion?.modo === 'sugerencia') return <FormSugerencia s={s} onListo={listo} onCancelar={() => setEdicion(null)} />;

  return (
    <Card title={varias ? `${s.course_title} · ${s.class_name}` : undefined}>
      {aviso && <div className="mb-3"><Notice tone="ok">{aviso}</Notice></div>}
      <ErrorBox error={accion.error} />
      {s.mensaje && <p className="mb-2 whitespace-pre-line text-sm">{s.mensaje}</p>}
      {!s.abierto && <div className="mb-3"><Notice tone="warn">El profesor cerró por ahora la regularización: puedes ver tus registros, pero no modificarlos.</Notice></div>}
      {aclarar.length > 0 && <div className="mb-3"><Notice tone="warn">El profesor pide una aclaración en {aclarar.length} registro(s). Ábrelos con «Corregir».</Notice></div>}

      {s.registros.length > 0 && (
        <div className="mb-3">
          <ProgressBar value={s.registros.length ? enviados.length / s.registros.length : 0} label={`Registradas ${enviados.length} de ${s.registros.length} iniciadas · ${revisados.length} revisadas por el profesor`} tone="green" />
        </div>
      )}

      {s.registros.length === 0 ? (
        <Empty>Aún no has registrado ninguna práctica. Registra solo las que recuerdes haber entregado.</Empty>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
          {s.registros.map((r) => {
            const e = ESTADO[r.estado];
            const marcable = r.estado === 'borrador' && r.faltantes.length === 0 && s.abierto;
            return (
              <li key={r.id} className="flex flex-wrap items-start gap-2 py-2">
                {marcable && <input type="checkbox" className="mt-1" aria-label="Marcar para registrar" checked={marcados.has(r.id)}
                  onChange={(ev) => setMarcados((m) => { const n = new Set(m); if (ev.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{nombrePractica(s, r.practice_id)}{r.tema && <span className="font-normal text-gray-600 dark:text-gray-300"> — {r.tema}</span>}</p>
                  <p className="text-xs text-gray-500">
                    {r.tipo === 'incidencia' ? 'Incidencia (sin captura)' : r.medio === 'correo' ? 'Correo' : r.medio === 'otra' ? `Otra vía${r.otra_via ? `: ${r.otra_via}` : ''}` : 'Medio sin indicar'}
                    {' · '}{r.tipo === 'incidencia' ? '—' : r.capturas.some((c) => c.posicion === 1) ? `Captura adjuntada${r.capturas.length > 1 ? ` (+${r.capturas.length - 1})` : ''}` : 'Captura pendiente'}
                    {' · '}{r.fecha_desconocida ? 'fecha no recordada' : fechaCorta(r.fecha_declarada) ?? 'sin fecha'}
                  </p>
                  {r.estado === 'borrador' && r.faltantes.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">Falta: {r.faltantes.join(', ')}</p>}
                  {r.nota_docente && r.estado !== 'borrador' && <p className="text-xs text-gray-600 dark:text-gray-400">Nota del profesor: «{r.nota_docente}»</p>}
                </div>
                <Badge tone={e.tono}>{e.estudiante}</Badge>
                <div className="flex gap-1">
                  {r.editable && s.abierto && <button className="btn-texto text-sm" onClick={() => setEdicion({ modo: 'registro', r, tipo: r.tipo })}>{r.estado === 'borrador' ? 'Completar' : 'Corregir'}</button>}
                  {r.estado === 'borrador' && s.abierto && <button className="btn-texto text-sm text-red-700 dark:text-red-400" onClick={() => void borrar(r)}>Eliminar</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {completos.length > 0 && s.abierto && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button className="btn-secundario" onClick={() => setMarcados(new Set(completos.map((r) => r.id)))}>Marcar los {completos.length} borradores completos</button>
          <button className="btn-primario" disabled={!marcados.size} onClick={() => setConfirmarVarios(true)}>Registrar marcados ({marcados.size})</button>
        </div>
      )}

      {s.abierto && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primario" disabled={s.registros.length >= s.max_registros} onClick={() => { setAviso(null); setEdicion({ modo: 'registro', r: null, tipo: 'evidencia' }); }}>+ Registrar una práctica</button>
          <button className="btn-secundario" onClick={() => { setAviso(null); setEdicion({ modo: 'registro', r: null, tipo: 'incidencia' }); }}>Perdí la captura del envío</button>
          <button className="btn-secundario" onClick={() => { setAviso(null); setEdicion({ modo: 'sugerencia' }); }}>Profesor, recuerdo otra práctica</button>
        </div>
      )}

      {s.sugerencias.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="font-medium">Tus sugerencias</p>
          <ul className="mt-1 space-y-1">
            {s.sugerencias.map((g) => (
              <li key={g.id} className="text-xs text-gray-600 dark:text-gray-300">
                {g.tema ?? 'Total de prácticas'}{g.total_estimado ? ` · crees que fueron ${g.total_estimado}` : ''} —{' '}
                {{ pendiente: 'pendiente de revisión', confirmada: 'el profesor la añadió al catálogo', relacionada: 'el profesor la relacionó con una práctica existente', descartada: 'descartada' }[g.estado] ?? g.estado}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={confirmarVarios} onClose={() => setConfirmarVarios(false)} title={`Registrar ${marcados.size} práctica(s)`}>
        <ul className="mb-3 list-disc pl-5 text-sm">{s.registros.filter((r) => marcados.has(r.id)).map((r) => <li key={r.id}>{nombrePractica(s, r.practice_id)}</li>)}</ul>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} /> {DECLARACION}</label>
        <ErrorBox error={accion.error} />
        <button className="btn-primario mt-3" disabled={!acepto || accion.busy} onClick={() => void registrarMarcados()}>REGISTRAR EVIDENCIA</button>
      </Modal>
    </Card>
  );
}

export default function Regularizacion() {
  const st = useAsync(() => misSecciones(), []);
  const secciones = useMemo(() => st.data ?? [], [st.data]);
  return (
    <div>
      <PageTitle title="Prácticas anteriores" subtitle="Regularización de las prácticas que entregaste antes del aula virtual" back={{ to: '/cuenta', label: 'Mi cuenta' }} />
      <div className="mb-4">
        <Notice tone="info">
          No vuelvas a subir tus trabajos. Indica qué práctica entregaste, por qué medio y cuándo, y adjunta <strong>una captura de pantalla del envío</strong>.
          Registrar no significa que la práctica esté aprobada ni calificada: el profesor la localizará y verificará en su canal original.
        </Notice>
      </div>
      {st.loading && <Spinner />}
      <ErrorBox error={st.error} onRetry={() => void st.reload()} />
      {!st.loading && !st.error && secciones.length === 0 && <Empty>El profesor no ha abierto la regularización de prácticas anteriores en tus secciones.</Empty>}
      <div className="space-y-4">
        {secciones.map((s) => <Seccion key={s.class_id} s={s} varias={secciones.length > 1} recargar={() => void st.reload()} />)}
      </div>
    </div>
  );
}
