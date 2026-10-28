/** LIEIA · Ejecuta una petición en el trabajador en segundo plano, con progreso. */
import type { Peticion } from './worker';

export function enTrabajador<T>(peticion: Peticion, progreso?: (hechas: number, total: number) => void): { promesa: Promise<T>; cancelar: () => void } {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const promesa = new Promise<T>((resolve, reject) => {
    w.onmessage = (e) => {
      const m = e.data;
      if (m.tipo === 'progreso') progreso?.(m.hechas, m.total);
      else if (m.tipo === 'resultado') { resolve(m.resultado as T); w.terminate(); }
      else if (m.tipo === 'error') { reject(new Error(m.mensaje)); w.terminate(); }
    };
    w.onerror = (e) => { reject(new Error(e.message || 'Error en el cálculo')); w.terminate(); };
    w.postMessage(peticion);
  });
  return { promesa, cancelar: () => w.terminate() };
}
