/** Muestra una captura de la regularización con un enlace temporal (5 min) pedido al servidor solo cuando se abre. */
import { useEffect, useState } from 'react';
import { urlCaptura } from '@/api/regularizacion';
import { kb } from '@/lib/regularizacion';

export function VisorCaptura({ id, etiqueta, bytes, ancho, alto, abierta = false, destino = 'declaracion' }:
  { id: string; etiqueta: string; bytes: number; ancho: number; alto: number; abierta?: boolean; destino?: 'declaracion' | 'libre' }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState(abierta);
  const [grande, setGrande] = useState(false);
  useEffect(() => {
    if (!ver || url) return;
    let vivo = true;
    urlCaptura(id, destino).then((r) => vivo && setUrl(r.url)).catch((e) => vivo && setError(e instanceof Error ? e.message : String(e)));
    return () => { vivo = false; };
  }, [ver, url, id, destino]);
  return (
    <div className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{etiqueta} <span className="text-xs text-gray-500">· {ancho}×{alto} px · {kb(bytes)}</span></span>
        {!ver && <button className="btn-texto text-sm" onClick={() => { setError(null); setVer(true); }}>Ver captura</button>}
        {ver && url && <button className="btn-texto text-sm" onClick={() => setGrande(!grande)}>{grande ? 'Reducir' : 'Ampliar'}</button>}
      </div>
      {error && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>}
      {ver && !url && !error && <p className="mt-1 text-xs text-gray-500">Cargando…</p>}
      {url && (
        <a href={url} target="_blank" rel="noreferrer" title="Abrir en otra pestaña (el enlace caduca en 5 minutos)">
          <img src={url} alt={etiqueta} className={`mt-2 w-full rounded border border-gray-200 bg-white object-contain dark:border-white/10 ${grande ? '' : 'max-h-80'}`}
            onError={() => { setUrl(null); setError('El enlace caducó; pulse «Ver captura» de nuevo.'); setVer(false); }} />
        </a>
      )}
    </div>
  );
}
