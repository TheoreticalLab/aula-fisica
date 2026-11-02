/**
 * Clases impartidas (migración 66): componentes compartidos por el estudiante y el profesor.
 *  · AprenderTabs: «Estudiar teoría» | «Clases impartidas» (sin cambiar las rutas existentes).
 *  · GaleriaPizarras: fotos en su orden, con zoom, navegación y descarga solo si el profesor la habilitó.
 *  · ClaseAmpliada: secciones en Markdown con KaTeX (el mismo renderizador de la teoría, sin HTML).
 *  · DondeEstudiar: enlaces a la teoría (solo identificadores reales) y temas aún no desarrollados.
 */
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { fotosClase } from '@/api/clases';
import { ErrorBox, Spinner } from '@/components/ui';

export function AprenderTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-1.5 text-sm font-medium ${isActive ? 'bg-primario-700 text-white dark:bg-acento-400 dark:text-primario-950' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200'}`;
  return (
    <nav className="no-print mb-4 flex gap-2" aria-label="Aprender">
      <NavLink to="/temario" className={({ isActive }) => tab({ isActive: isActive || /^#\/curso\//.test(window.location.hash) })}>📘 Estudiar teoría</NavLink>
      <NavLink to="/clases" className={tab}>🧑‍🏫 Clases impartidas</NavLink>
    </nav>
  );
}

type Foto = { id: string; posicion: number; url: string; miniatura: string | null; descarga: string | null };

export function GaleriaPizarras({ sessionId, n }: { sessionId: string; n: number }) {
  const [fotos, setFotos] = useState<Foto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const cargar = () => fotosClase(sessionId).then((r) => { setFotos(r.fotos); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { void cargar(); /* las URLs firmadas caducan a los 10 min: se renuevan al volver */
    const t = window.setInterval(() => void cargar(), 9 * 60_000);
    return () => window.clearInterval(t);
  }, [sessionId, n]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (abierta === null) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(null);
      if (e.key === 'ArrowRight' && fotos) setAbierta((i) => Math.min(fotos.length - 1, (i ?? 0) + 1));
      if (e.key === 'ArrowLeft') setAbierta((i) => Math.max(0, (i ?? 0) - 1));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierta, fotos]);
  if (error) return <ErrorBox error={error} onRetry={() => void cargar()} />;
  if (!fotos) return <Spinner label="Cargando las pizarras…" />;
  const f = abierta !== null ? fotos[abierta] : null;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fotos.map((x, i) => (
          <button key={x.id} className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-white/10" onClick={() => { setAbierta(i); setZoom(1); }}
            aria-label={`Ampliar pizarra ${x.posicion}`}>
            <img src={x.miniatura ?? x.url} alt={`Pizarra ${x.posicion}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">{x.posicion}</span>
          </button>
        ))}
      </div>
      {/* impresión: las pizarras completas */}
      <div className="solo-imprimir">{fotos.map((x) => <img key={x.id} src={x.url} alt={`Pizarra ${x.posicion}`} className="mb-2 w-full" />)}</div>
      {f && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={`Pizarra ${f.posicion}`}>
          <div className="flex items-center gap-2 p-2 text-white">
            <span className="text-sm">Pizarra {f.posicion} de {fotos.length}</span>
            <button className="ml-auto rounded bg-white/15 px-3 py-1" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Alejar">−</button>
            <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)} %</span>
            <button className="rounded bg-white/15 px-3 py-1" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} aria-label="Acercar">+</button>
            {f.descarga && <a className="rounded bg-white/15 px-3 py-1 text-sm" href={f.descarga}>Descargar</a>}
            <button className="rounded bg-white/15 px-3 py-1" onClick={() => setAbierta(null)} aria-label="Cerrar">✕</button>
          </div>
          <div className="flex-1 overflow-auto" onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}>
            <img src={f.url} alt={`Pizarra ${f.posicion}`} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} className="mx-auto block" />
          </div>
          <div className="flex justify-between p-2">
            <button className="rounded bg-white/15 px-4 py-2 text-white disabled:opacity-30" disabled={abierta === 0} onClick={() => { setAbierta((abierta ?? 1) - 1); setZoom(1); }}>← Anterior</button>
            <button className="rounded bg-white/15 px-4 py-2 text-white disabled:opacity-30" disabled={abierta === fotos.length - 1} onClick={() => { setAbierta((abierta ?? 0) + 1); setZoom(1); }}>Siguiente →</button>
          </div>
        </div>
      )}
    </>
  );
}

export { ClaseAmpliada, DondeEstudiar } from './Presentacion';
