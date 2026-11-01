/**
 * LIEIA · reapertura de investigaciones guardadas (etapa 8, parcial).
 * Separa las hipótesis REGISTRADAS ANTES de tener datos (guardadas con n = 0 o antes de la primera entrega) de los
 * hallazgos EXPLORATORIOS (formulados viendo los datos). Solo las primeras pueden contrastarse de forma confirmatoria
 * con los datos posteriores; las segundas necesitan otra aplicación.
 */
import type { Ficha } from './descubrimiento';
import type { Informe } from './informe';

export interface Guardada { id: string; clave: string; estado: string; version_examen: string | null; payload: Record<string, unknown>; procedencia: Record<string, unknown>; updated_at: string }

export interface Reapertura {
  id: string; clave: string; titulo: string; estado: string; guardadaCon: number;
  tipo: 'preregistrada' | 'exploratoria';
  resultadoEntonces: string | null; resultadoAhora: string | null; estadoAhora: Ficha['estado'] | 'ya_no_aplica';
  cambio: 'sin_cambios' | 'nuevos_datos' | 'ya_no_aplica';
  explicacion: string;
}

export function reabrir(guardadas: Guardada[], inf: Informe): Reapertura[] {
  const nAhora = inf.examen?.n ?? 0;
  return guardadas.map((g) => {
    const antes = g.payload as unknown as Partial<Ficha>;
    const ahora = inf.fichas.find((f) => f.id === g.clave);
    const nEntonces = Number(g.procedencia?.n ?? 0);
    const tipo: Reapertura['tipo'] = nEntonces === 0 ? 'preregistrada' : 'exploratoria';
    const cambio: Reapertura['cambio'] = !ahora ? 'ya_no_aplica' : g.version_examen === inf.version ? 'sin_cambios' : 'nuevos_datos';
    const explicacion = tipo === 'preregistrada'
      ? nAhora > 0 ? `Se guardó antes de que hubiera respuestas (n = 0); ahora hay ${nAhora}: el contraste con estos datos es CONFIRMATORIO para la hipótesis tal como se registró.` : 'Registrada antes de los datos; todavía no hay respuestas para contrastarla.'
      : `Se formuló viendo datos (n = ${nEntonces}). ${nAhora > nEntonces ? `Ahora hay ${nAhora}: los ${nAhora - nEntonces} nuevos permiten un contraste parcial, pero los ${nEntonces} originales no pueden confirmar lo que ayudaron a generar.` : 'Para confirmarla hace falta otra aplicación.'}`;
    return {
      id: g.id, clave: g.clave, titulo: String(antes.titulo ?? g.clave), estado: g.estado, guardadaCon: nEntonces, tipo,
      resultadoEntonces: (antes.resultado as string | null) ?? null, resultadoAhora: ahora?.resultado ?? null, estadoAhora: ahora?.estado ?? 'ya_no_aplica', cambio, explicacion,
    };
  });
}
