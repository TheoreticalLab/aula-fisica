/**
 * Aviso urgente con lectura obligatoria (migración 70; p. ej. «puntos perdidos»): ocupa la pantalla, no tiene «cerrar»
 * ni se cierra con Escape; hay una espera con cuenta atrás, después una casilla blanca que el estudiante marca y solo
 * entonces se habilita «Entendido». Si recarga la página, el aviso vuelve (el servidor no lo da por leído ni acepta la
 * confirmación antes de la espera).
 */
import { useEffect, useState } from 'react';
import { estadoConfirmacion, type MensajeVivo } from '@/lib/mensajes';

export function AvisoConfirmado({ m, cabecera, quedan, onEntendido }: { m: MensajeVivo; cabecera: React.ReactNode; quedan: number; onEntendido: () => void }) {
  const espera = Math.max(0, m.confirmacion?.espera ?? 0);
  const [restante, setRestante] = useState(espera);
  const [marcada, setMarcada] = useState(false);
  useEffect(() => {
    setRestante(espera);
    setMarcada(false);
    const inicio = Date.now();
    const t = window.setInterval(() => {
      const r = Math.max(0, espera - Math.floor((Date.now() - inicio) / 1000));
      setRestante(r);
      if (r === 0) window.clearInterval(t);
    }, 250);
    return () => window.clearInterval(t);
  }, [m.id, espera]);
  const e = estadoConfirmacion(restante, marcada);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3" onKeyDown={(ev) => ev.key === 'Escape' && ev.stopPropagation()}>
      <div role="alertdialog" aria-modal="true" aria-label="Aviso urgente del profesor" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border-4 border-red-600 bg-white p-5 shadow-2xl dark:bg-primario-950">
        <div className="text-red-700 dark:text-red-300">{cabecera}</div>
        <p className="mt-3 whitespace-pre-wrap text-base">{m.body}</p>
        <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-300" aria-live="polite">
          {e.esperando ? `Lea el aviso con calma: podrá confirmarlo en ${restante} s.` : !marcada ? 'Marque la casilla para confirmar que lo ha leído.' : 'Gracias. Pulse «Entendido».'}
        </p>
        <button
          type="button"
          role="checkbox"
          aria-checked={marcada}
          disabled={!e.cajaHabilitada}
          onClick={() => setMarcada((x) => !x)}
          className={`mt-2 flex w-full items-start gap-3 rounded-lg border-2 bg-white p-3 text-left text-sm text-gray-900 transition ${e.cajaHabilitada ? 'cursor-pointer border-gray-400 hover:border-red-600' : 'cursor-not-allowed border-gray-200 opacity-50'}`}
        >
          <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${marcada ? 'border-red-700 bg-red-700 text-white' : 'border-gray-500 bg-white'}`}>{marcada ? '✓' : ''}</span>
          <span>{m.confirmacion?.caja || 'He leído y entendido este aviso.'}</span>
        </button>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{quedan > 0 ? `${quedan} mensaje(s) más` : 'Su trabajo en la página sigue intacto.'}</span>
          <button className="btn-primario !bg-red-700 hover:!bg-red-800 disabled:opacity-40" disabled={!e.botonHabilitado} onClick={onEntendido}>
            {e.esperando ? `Entendido (${restante} s)` : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  );
}
