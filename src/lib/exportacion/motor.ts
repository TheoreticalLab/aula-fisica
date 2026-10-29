/**
 * Centro de Datos · motor de exportación. Pide los datos al servidor por páginas (export_page), comprueba que cada
 * tabla tiene exactamente las filas que el servidor contó al empezar (export_begin), calcula las tablas derivadas y
 * construye el paquete. Cualquier fallo, cancelación o recuento distinto termina SIN archivo y queda registrado
 * (export_finish): nunca se entrega una exportación parcial como si estuviera completa.
 */
import { calcularDerivados } from './metricas';
import { construirPaquete, type ColumnaEsquema, type Formato, type ResultadoPaquete } from './paquete';
import type { Fila } from './formato';

export type Rpc = <T>(fn: string, args: Record<string, unknown>) => Promise<T>;

export interface Alcance { tipo: 'estudiante' | 'grupo' | 'seccion' | 'curso' | 'actividad' | 'intento' | 'todo'; ids: string[]; desde?: string | null; hasta?: string | null }

export interface Progreso {
  fase: 'inicio' | 'descarga' | 'metricas' | 'archivos' | 'fin';
  tabla?: string; filas?: number; esperadas?: number; tablaN?: number; tablas?: number; mensaje?: string;
}

export interface OpcionesExportacion {
  rpc: Rpc;
  alcance: Alcance;
  modo: 'identificado' | 'investigacion';
  contenido: string[];
  formatos: Formato[];
  claves?: boolean;
  version?: string;
  tamPagina?: number;
  alProgreso?: (p: Progreso) => void;
  senal?: AbortSignal;
  ahora?: () => Date;
}

export class ExportacionFallida extends Error {
  constructor(public motivo: 'incompleta' | 'cancelada' | 'error', mensaje: string) {
    super(mensaje);
  }
}

interface Inicio { export_id: string; as_of: string; modo: 'identificado' | 'investigacion'; contenido: string[]; conteos: Record<string, number>; ids_publicos: unknown[] }
interface Pagina { filas: Fila[]; siguiente: string | null; n: number; fin: boolean }

export async function exportar(o: OpcionesExportacion): Promise<ResultadoPaquete> {
  const avisar = (p: Progreso) => o.alProgreso?.(p);
  avisar({ fase: 'inicio', mensaje: 'Fijando el alcance y la hora de corte…' });
  const ini = await o.rpc<Inicio>('export_begin', {
    p_alcance: { tipo: o.alcance.tipo, ids: o.alcance.ids, desde: o.alcance.desde ?? null, hasta: o.alcance.hasta ?? null },
    p_modo: o.modo, p_contenido: o.contenido, p_formatos: o.formatos, p_claves: !!o.claves,
  });
  const terminar = async (estado: 'completada' | 'incompleta' | 'cancelada' | 'error', resumen: unknown, sha: string | null, error: string | null) => {
    try { await o.rpc('export_finish', { p_export: ini.export_id, p_estado: estado, p_resumen: resumen, p_manifiesto_sha256: sha, p_error: error }); } catch { /* el registro no impide informar */ }
  };
  const tablas = Object.keys(ini.conteos);
  const datos: Record<string, Fila[]> = {};
  try {
    const esquema = await o.rpc<Record<string, ColumnaEsquema[]>>('export_esquema', { p_tablas: tablas });
    for (let k = 0; k < tablas.length; k++) {
      const t = tablas[k];
      const esperadas = Number(ini.conteos[t] ?? 0);
      const filas: Fila[] = [];
      let cursor: string | null = null;
      for (;;) {
        if (o.senal?.aborted) throw new ExportacionFallida('cancelada', 'Exportación cancelada.');
        const p: Pagina = await o.rpc<Pagina>('export_page', { p_export: ini.export_id, p_tabla: t, p_after: cursor, p_limit: o.tamPagina ?? 5000 });
        for (const f of p.filas) filas.push(f);
        avisar({ fase: 'descarga', tabla: t, filas: filas.length, esperadas, tablaN: k + 1, tablas: tablas.length });
        if (p.fin || p.n === 0) break;
        if (!p.siguiente || p.siguiente === cursor) throw new ExportacionFallida('error', `Paginación detenida en «${t}».`);
        cursor = p.siguiente;
      }
      if (filas.length !== esperadas) {
        throw new ExportacionFallida('incompleta', `La tabla «${t}» tiene ${filas.length} filas y el servidor contó ${esperadas}. No se generó ningún archivo.`);
      }
      datos[t] = filas;
    }
    if (o.senal?.aborted) throw new ExportacionFallida('cancelada', 'Exportación cancelada.');
    avisar({ fase: 'metricas', mensaje: 'Calculando cronologías y métricas…' });
    const derivados = calcularDerivados(datos);
    avisar({ fase: 'archivos', mensaje: 'Generando los archivos…' });
    const r = await construirPaquete({
      exportId: ini.export_id, modo: ini.modo, alcance: { tipo: o.alcance.tipo, ids_publicos: ini.ids_publicos ?? [], desde: o.alcance.desde, hasta: o.alcance.hasta },
      contenido: ini.contenido, asOf: ini.as_of, datos, derivados, esperados: ini.conteos, esquema, formatos: o.formatos,
      version: o.version ?? 'desconocida', fecha: o.ahora?.() ?? new Date(), advertencias: [],
    });
    if (!r.manifiesto.completa) throw new ExportacionFallida('incompleta', 'Los recuentos finales no coinciden con los del servidor.');
    await terminar('completada', { registros: r.manifiesto.registros_por_tabla, advertencias: r.advertencias.length }, r.manifiestoSha, null);
    avisar({ fase: 'fin', mensaje: 'Exportación completa.' });
    return r;
  } catch (e) {
    const f = e instanceof ExportacionFallida ? e : new ExportacionFallida('error', e instanceof Error ? e.message : String(e));
    await terminar(f.motivo === 'cancelada' ? 'cancelada' : f.motivo === 'incompleta' ? 'incompleta' : 'error',
      { registros: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v.length])) }, null, f.motivo);
    throw f;
  }
}
