/**
 * Red simulada para el simulador docente de la PES y las pruebas de flujo: «antes» la petición no llega al servidor;
 * «despues» llega y se aplica, pero la respuesta se pierde. Envuelve cualquier ApiPes sin cambiar su contrato.
 */
import type { ApiPes } from '../api/pesTipos';

export type ModoRed = 'ok' | 'antes' | 'despues';
export interface Red { modo: ModoRed }

export function conRed(api: ApiPes, red: Red): ApiPes {
  const envolver = <A extends unknown[], R>(f: (...a: A) => Promise<R>) => async (...a: A): Promise<R> => {
    if (red.modo === 'antes') throw new TypeError('Failed to fetch');
    const r = await f(...a);
    if (red.modo === 'despues') throw new TypeError('Failed to fetch');
    return r;
  };
  return {
    misPracticas: envolver(api.misPracticas), iniciar: envolver(api.iniciar), actual: envolver(api.actual), borrador: envolver(api.borrador),
    confirmar: envolver(api.confirmar), omitir: envolver(api.omitir), evento: envolver(api.evento), variante: envolver(api.variante),
  };
}
