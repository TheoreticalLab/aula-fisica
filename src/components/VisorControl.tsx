/**
 * Imagen de un control de laboratorio (migración 84). Se pide un enlace temporal (5 min) a la Edge Function «entregas»
 * solo cuando se quiere ver: la imagen está en almacenamiento privado y el servidor decide quién puede abrirla.
 */
import { useEffect, useState } from 'react';
import { urlControl } from '@/api/laboratorio';

export function VisorControl({ fileId, etiqueta = 'Ver imagen', abierta = false }: { fileId: string; etiqueta?: string; abierta?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedida, setPedida] = useState(false);

  const cargar = async () => {
    setCargando(true); setError(null);
    try { setUrl((await urlControl(fileId)).url); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  };
  useEffect(() => {
    if (abierta && !pedida) { setPedida(true); void cargar(); }
  });

  if (!url) {
    return (
      <div>
        <button type="button" className="btn-secundario text-sm" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? 'Cargando imagen…' : etiqueta}
        </button>
        {error && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>}
      </div>
    );
  }
  return (
    <figure>
      <img src={url} alt="Imagen entregada" className="max-h-[70vh] w-full rounded border border-gray-200 bg-white object-contain dark:border-white/10"
        onError={() => { setUrl(null); setError('El enlace caducó. Vuelva a abrir la imagen.'); }} />
      <figcaption className="mt-1 text-xs">
        <a href={url} target="_blank" rel="noopener noreferrer" className="enlace">Abrir en tamaño completo</a>
        <span className="text-gray-500"> · el enlace caduca en 5 minutos</span>
      </figcaption>
    </figure>
  );
}
