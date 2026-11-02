/**
 * «+ Registrar clase» (profesor, monitor habilitado o estudiante delegado) y edición de un envío no publicado.
 * Entre 1 y 4 fotografías elegidas por el usuario (solo esas), optimizadas en el dispositivo (orientación, sin EXIF,
 * legibles para ecuaciones), con vista previa, orden y eliminación antes de enviar. Subir NO genera nada con IA.
 * Si una subida falla, la clase queda como borrador y se puede reintentar desde «Mis envíos».
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  claseCrear, claseDetalle, claseEditar, clasesPuedoSubir, eliminarClase, enviarClase, fotosClase, quitarFotoClase, reordenarFotos, subirFotoClase,
  type ClaseDetalle, type SeccionSubida,
} from '@/api/clases';
import { Card, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { optimizarPizarra, type FotoPizarra } from '@/lib/imagen';
import { hoyAcademico } from '@/lib/clases';

type Existente = { id: string; posicion: number; url: string; miniatura: string | null };
const MAX = 4;

export default function RegistrarClase() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const clientId = useRef(crypto.randomUUID());
  const [secciones, setSecciones] = useState<SeccionSubida[] | null>(null);
  const [clase, setClase] = useState<ClaseDetalle | null>(null);
  const [existentes, setExistentes] = useState<Existente[]>([]);
  const [nuevas, setNuevas] = useState<FotoPizarra[]>([]);
  const [f, setF] = useState({ class_id: '', fecha: hoyAcademico(), title: '', temas: '', unit_id: '', descripcion: '' });
  const [publicar, setPublicar] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const s = await clasesPuedoSubir();
        setSecciones(s);
        if (sessionId) {
          const d = await claseDetalle(sessionId);
          setClase(d);
          setF({ class_id: d.class_id, fecha: d.fecha, title: d.title, temas: d.temas.join(', '), unit_id: d.unit_id ?? '', descripcion: d.descripcion });
          if (d.imagenes.length) setExistentes((await fotosClase(sessionId)).fotos);
        } else if (s.length === 1) setF((x) => ({ ...x, class_id: s[0].class_id }));
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    })();
  }, [sessionId]);
  useEffect(() => () => nuevas.forEach((n) => URL.revokeObjectURL(n.vistaPrevia)), []);   // eslint-disable-line react-hooks/exhaustive-deps

  const sec = secciones?.find((s) => s.class_id === f.class_id);
  const docente = sec?.papel === 'docente' || sec?.papel === 'admin';
  const total = existentes.length + nuevas.length;
  const datos = useMemo(() => ({ class_id: f.class_id, fecha: f.fecha, title: f.title.trim(), temas: f.temas.split(',').map((t) => t.trim()).filter(Boolean),
    unit_id: f.unit_id || null, descripcion: f.descripcion.trim() }), [f]);

  async function elegir(lista: FileList | null) {
    if (!lista) return;
    setError(null);
    const libres = MAX - total;
    const archivos = [...lista].slice(0, libres);
    if (lista.length > libres) setError(`Máximo ${MAX} fotografías por clase: se tomaron las primeras ${libres}.`);
    for (const a of archivos) {
      setProcesando(`Optimizando ${a.name}…`);
      try { const p = await optimizarPizarra(a, 4 * 1048576); setNuevas((x) => [...x, p]); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    }
    setProcesando(null);
  }
  const mover = (i: number, d: -1 | 1) => setNuevas((x) => { const y = [...x]; [y[i], y[i + d]] = [y[i + d], y[i]]; return y; });
  const quitarNueva = (i: number) => setNuevas((x) => { URL.revokeObjectURL(x[i].vistaPrevia); return x.filter((_, k) => k !== i); });

  async function guardar(enviar: boolean) {
    setError(null);
    if (!datos.class_id || !datos.title) return setError('Elija la sección y escriba el título.');
    if (enviar && total === 0) return setError('Añada al menos una fotografía.');
    try {
      setProcesando('Guardando la clase…');
      const id = clase ? (await claseEditar(clase.id, datos)).id : (await claseCrear(datos, clientId.current)).id;
      let pos = existentes.length;
      for (const n of nuevas) {
        pos += 1;
        setProcesando(`Subiendo la fotografía ${pos} de ${total}…`);
        await subirFotoClase(id, pos, n);
      }
      if (enviar) { setProcesando('Enviando…'); await enviarClase(id, docente && publicar); }
      nav(docente ? `/docente/clases-impartidas/${id}` : '/clases');
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)}. Lo ya subido se conserva: puede reintentar.`);
    } finally { setProcesando(null); }
  }

  if (!secciones) return error ? <ErrorBox error={error} /> : <Spinner />;
  if (!secciones.length) return <ErrorBox error="No tiene permiso para registrar clases. El profesor puede autorizarle en su sección." />;
  const bloqueada = !!clase && !['borrador', 'pendiente', 'rechazada'].includes(clase.fotos_estado) && clase.papel !== 'docente';
  return (
    <div className="space-y-4">
      <PageTitle title={clase ? 'Editar clase' : 'Registrar clase'} back={{ to: '/clases', label: 'Clases impartidas' }}
        subtitle="Las fotografías quedan pendientes hasta que el profesor las revise. Subir una clase no genera nada con inteligencia artificial." />
      {clase?.fotos_motivo && <Notice tone="warn">El profesor indicó: {clase.fotos_motivo}</Notice>}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="etiqueta">Sección</span>
            <select className="campo" value={f.class_id} disabled={!!clase && !docente} onChange={(e) => setF({ ...f, class_id: e.target.value, unit_id: '' })}>
              <option value="">Elija…</option>
              {secciones.map((s) => <option key={s.class_id} value={s.class_id}>{s.asignatura} — {s.seccion}</option>)}
            </select></label>
          <label className="text-sm"><span className="etiqueta">Fecha de la clase</span>
            <input type="date" className="campo" value={f.fecha} max={hoyAcademico()} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
          <label className="text-sm sm:col-span-2"><span className="etiqueta">Título</span>
            <input className="campo" maxLength={160} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej.: Teorema trabajo-energía" /></label>
          <label className="text-sm"><span className="etiqueta">Temas trabajados (separados por comas)</span>
            <input className="campo" value={f.temas} onChange={(e) => setF({ ...f, temas: e.target.value })} placeholder="trabajo, energía cinética" /></label>
          <label className="text-sm"><span className="etiqueta">Unidad relacionada (opcional)</span>
            <select className="campo" value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })}>
              <option value="">Sin vincular todavía</option>{sec?.unidades.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select></label>
          <label className="text-sm sm:col-span-2"><span className="etiqueta">Descripción (opcional)</span>
            <textarea className="campo" rows={2} maxLength={2000} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
        </div>
      </Card>
      <Card title={`Fotografías de las pizarras (${total} de ${MAX})`}>
        <Notice tone="warn">Revise antes de subir: que se lean las ecuaciones y que no aparezcan rostros ni datos personales innecesarios. Si los hay, recorte la foto en su teléfono.</Notice>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {existentes.map((x, i) => (
            <figure key={x.id} className="relative">
              <img src={x.miniatura ?? x.url} alt={`Pizarra ${x.posicion}`} className="aspect-[4/3] w-full rounded object-cover" />
              <figcaption className="mt-1 flex items-center gap-1 text-xs">
                <span>{i + 1}</span>
                {!bloqueada && i > 0 && <button className="btn-texto" onClick={async () => { const o = existentes.map((e) => e.id); [o[i - 1], o[i]] = [o[i], o[i - 1]]; await reordenarFotos(clase!.id, o); setExistentes((await fotosClase(clase!.id)).fotos); }}>←</button>}
                {!bloqueada && <button className="btn-texto ml-auto text-red-700" onClick={async () => { await quitarFotoClase(x.id).catch((e) => setError(e.message)); setExistentes((await fotosClase(clase!.id)).fotos); }}>Quitar</button>}
              </figcaption>
            </figure>
          ))}
          {nuevas.map((n, i) => (
            <figure key={n.vistaPrevia} className="relative">
              <img src={n.vistaPrevia} alt={`Nueva ${i + 1}`} className="aspect-[4/3] w-full rounded object-cover ring-2 ring-primario-400" />
              <figcaption className="mt-1 flex items-center gap-1 text-xs">
                <span>{existentes.length + i + 1} · {Math.round(n.bytes / 1024)} KB</span>
                {i > 0 && <button className="btn-texto" onClick={() => mover(i, -1)} aria-label="Mover antes">←</button>}
                {i < nuevas.length - 1 && <button className="btn-texto" onClick={() => mover(i, 1)} aria-label="Mover después">→</button>}
                <button className="btn-texto ml-auto text-red-700" onClick={() => quitarNueva(i)}>Quitar</button>
              </figcaption>
            </figure>
          ))}
        </div>
        {!bloqueada && total < MAX && (
          <label className="btn-secundario mt-3 inline-block cursor-pointer">
            Elegir fotografías
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void elegir(e.target.files); e.target.value = ''; }} />
          </label>
        )}
        <p className="mt-2 text-xs text-gray-500">Se conserva el orden que usted establezca (normalmente, pizarras consecutivas). Las fotos se optimizan en su dispositivo sin perder legibilidad y se les quitan los metadatos (ubicación).</p>
      </Card>
      {docente && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} /> Publicar las fotografías ahora para los estudiantes de la sección</label>}
      {procesando && <Spinner label={procesando} />}
      <ErrorBox error={error} />
      {!bloqueada && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario" disabled={!!procesando} onClick={() => void guardar(true)}>{docente && publicar ? 'Guardar y publicar fotos' : 'Guardar y enviar al profesor'}</button>
          <button className="btn-secundario" disabled={!!procesando} onClick={() => void guardar(false)}>Guardar como borrador</button>
          {clase && <button className="btn-peligro ml-auto" disabled={!!procesando} onClick={async () => {
            if (!window.confirm('¿Eliminar esta clase y sus fotografías? Solo es posible mientras no esté publicada.')) return;
            try { await eliminarClase(clase.id); nav('/clases'); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
          }}>Eliminar</button>}
        </div>
      )}
    </div>
  );
}
