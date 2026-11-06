/**
 * Orbe Control · Clases impartidas (migración 66): revisar desde el móvil las fotografías pendientes, aprobar o
 * rechazar, ver las clases del día y el estado de la generación con IA. La versión ampliada se revisa en el aula (enlace).
 * Mismas funciones del servidor que el aula (clases_seccion, clase_fotos_revisar, entregas/clase_fotos): sin permisos nuevos.
 */
import { useCallback, useEffect, useState } from 'react';
import { funcion, rpc } from './supabase';
import { ESTADO_FOTOS, fechaClase, hoyAcademico } from '../../src/lib/clases';

interface Clase {
  id: string; class_id: string; fecha: string; title: string; temas: string[]; seccion: string; asignatura: string; fotos_estado: string;
  n_fotos: number; ampliada_publicada: boolean; subida_por: string | null; uploader_role: string; procesando?: boolean; borradores?: number;
}
type Foto = { id: string; posicion: number; url: string; miniatura: string | null };
const AULA = `${location.origin}${location.pathname.replace(/control\/?$/, '')}#`;

export function ClasesImpartidas({ secciones }: { secciones: [string, string][] }) {
  const [clases, setClases] = useState<Clase[]>([]);
  const [fotos, setFotos] = useState<Record<string, Foto[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cargar = useCallback(async () => {
    try {
      const todas = (await Promise.all(secciones.map(([id]) => rpc<Clase[]>('clases_seccion', { p_class: id }).catch(() => [] as Clase[])))).flat();
      setClases(todas);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [secciones]);
  useEffect(() => { void cargar(); const t = window.setInterval(() => document.visibilityState === 'visible' && void cargar(), 20_000); return () => window.clearInterval(t); }, [cargar]);
  const verFotos = async (id: string) => {
    if (fotos[id]) return setFotos((f) => { const { [id]: _, ...r } = f; return r; });
    try { const r = await funcion<{ fotos: Foto[] }>('entregas', { action: 'clase_fotos', session_id: id }); setFotos((f) => ({ ...f, [id]: r.fotos })); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  async function decidir(c: Clase, d: 'aprobada' | 'rechazada') {
    const motivo = d === 'rechazada' ? window.prompt('Motivo del rechazo (lo verá quien subió las fotos):') : null;
    if (d === 'rechazada' && !motivo) return;
    if (d === 'aprobada' && !window.confirm(`¿Publicar las ${c.n_fotos} fotografía(s) de «${c.title}» para la sección? (No genera nada con IA.)`)) return;
    setBusy(true);
    try { await rpc('clase_fotos_revisar', { p_session: c.id, p_decision: d, p_motivo: motivo }); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const pendientes = clases.filter((c) => c.fotos_estado === 'pendiente');
  const hoy = clases.filter((c) => c.fecha === hoyAcademico() && c.fotos_estado !== 'pendiente');
  const enCurso = clases.filter((c) => c.procesando || ((c.borradores ?? 0) > 0 && !c.ampliada_publicada));
  const fila = (c: Clase, acciones: boolean) => (
    <article key={c.id} className="tarjeta">
      <p className="nombre">{c.title}</p>
      <p className="tenue pequeno">{fechaClase(c.fecha)} · {c.asignatura} — {c.seccion} · {c.n_fotos} foto(s) · {c.subida_por ?? '—'} ({c.uploader_role})</p>
      <p className="pequeno">{ESTADO_FOTOS[c.fotos_estado]?.texto ?? c.fotos_estado}{c.procesando ? ' · generando con IA…' : ''}{(c.borradores ?? 0) > 0 && !c.ampliada_publicada ? ' · borrador de IA por revisar' : ''}{c.ampliada_publicada ? ' · ampliada publicada' : ''}</p>
      {fotos[c.id] && <div className="fila" style={{ flexWrap: 'wrap' }}>{fotos[c.id].map((f) => (
        <a key={f.id} href={f.url} target="_blank" rel="noreferrer"><img src={f.miniatura ?? f.url} alt={`Pizarra ${f.posicion}`} style={{ width: '7rem', borderRadius: 6 }} /></a>))}</div>}
      <div className="fila">
        <button className="boton secundario pequeno" onClick={() => void verFotos(c.id)}>{fotos[c.id] ? 'Ocultar fotos' : 'Ver fotos'}</button>
        {acciones && <button className="boton pequeno" disabled={busy} onClick={() => void decidir(c, 'aprobada')}>Aprobar</button>}
        {acciones && <button className="boton secundario pequeno" disabled={busy} onClick={() => void decidir(c, 'rechazada')}>Rechazar</button>}
        <a className="boton secundario pequeno" href={`${AULA}/docente/clases-impartidas/${c.id}`} target="_blank" rel="noreferrer">Abrir en el aula</a>
      </div>
    </article>
  );
  return (
    <div className="asistencia">
      {error && <p className="error">{error}</p>}
      <section className="grupo"><h2>📥 PENDIENTES DE REVISIÓN ({pendientes.length})</h2>{pendientes.length ? pendientes.map((c) => fila(c, true)) : <p className="tenue">Nada pendiente.</p>}</section>
      <section className="grupo"><h2>✨ IA: EN CURSO O POR REVISAR ({enCurso.length})</h2>{enCurso.map((c) => fila(c, false))}</section>
      <section className="grupo"><h2>📅 CLASES DE HOY ({hoy.length})</h2>{hoy.map((c) => fila(c, false))}</section>
      <p className="tenue pequeno">La generación con IA y la aprobación de la versión ampliada se hacen en el aula («Abrir en el aula»), donde se ve el costo estimado antes de confirmar.</p>
    </div>
  );
}
