/**
 * Telemetría V2 · exportación por niveles (fase 14), generada desde la MISMA reconstrucción que ve el profesor.
 *  A · resumen del intento   B · preguntas   C · intervalos de la partición   D · eventos   E · investigación (JSON)
 * Los valores no identificables se exportan VACÍOS con su estado en otra columna (nunca como 0).
 */
import { CATEGORIAS, type Metrica, type Reconstruccion } from './modelo';
import type { AuditoriaPregunta, FuenteElegida } from './fuente';

export type Nivel = 'A' | 'B' | 'C' | 'D' | 'E';

const celda = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  const peligro = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s);   // fórmulas de hoja de cálculo
  const t = peligro ? `'${s}` : s;
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
export const aCsv = (filas: Record<string, unknown>[]): string => {
  if (!filas.length) return '';
  const cols = Object.keys(filas[0]);
  return [cols.join(','), ...filas.map((f) => cols.map((c) => celda(f[c])).join(','))].join('\n') + '\n';
};
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const met = (pref: string, m: Metrica) => ({ [`${pref}_ms`]: m.valor, [`${pref}_estado`]: m.estado });

export interface Contexto { attempt_id: string; fuente: FuenteElegida; titulos?: Record<string, string> }

export function filas(nivel: Exclude<Nivel, 'E'>, rec: Reconstruccion, ctx: Contexto, audit: AuditoriaPregunta[] = []): Record<string, unknown>[] {
  const comun = { attempt_id: ctx.attempt_id, motor: rec.version, fuente: ctx.fuente };
  switch (nivel) {
    case 'A':
      return [{
        ...comun, inicio: iso(rec.dominio.inicio), fin: iso(rec.dominio.fin), T_wall_ms: rec.T_wall,
        ...Object.fromEntries(CATEGORIAS.map((c) => [`T_${c}_ms`, rec.totales[c]])),
        T_disconnected_ms: rec.T_disconnected.valor, sesiones: rec.sesiones.length, eventos: rec.eventos.length,
        muy_retrasados: rec.sesiones.reduce((s, x) => s + x.muy_retrasados, 0), huecos_secuencia: rec.sesiones.reduce((s, x) => s + x.huecos_secuencia, 0),
        invariantes: rec.invariantes.join(' | '), advertencias: rec.advertencias.length,
      }];
    case 'B':
      return rec.preguntas.map((q) => {
        const a = audit.find((x) => x.exercise_id === q.pregunta);
        return {
          ...comun, exercise_id: q.pregunta, titulo: ctx.titulos?.[q.pregunta] ?? null,
          ...met('T_wall', q.T_wall), ...met('T_exposure', q.T_exposure), ...met('T_focus', q.T_focus), ...met('T_interaction', q.T_interaction),
          ...met('T_edit', q.T_edit), ...met('T_candidate_work', q.T_candidate_work), ...met('T_until_first_response', q.T_until_first_response),
          visitas: q.visitas.valor, visitas_estado: q.visitas.estado, ediciones: q.ediciones, borrados: q.borrados,
          primera_exposicion: iso(q.primera_exposicion), primera_activacion: iso(q.primera_activacion), primera_respuesta: iso(q.primera_respuesta),
          calidad_temporal: q.calidad.temporal, cobertura: q.calidad.cobertura, atribucion: q.calidad.atribucion, completitud: q.calidad.completitud,
          estado_respuesta: q.calidad.respuesta, guardados_ok: q.calidad.sincronizacion.guardados_ok, guardados_fallidos: q.calidad.sincronizacion.guardados_fallidos,
          revisiones: a?.revisiones.length ?? null, revision_entregada: a?.entregada?.rev ?? null, diagnostico_respuesta: a?.diagnostico ?? null,
          advertencias: q.advertencias.join(' | '),
        };
      });
    case 'C':
      return rec.particion.map((p, i) => ({ ...comun, n: i + 1, categoria: p.cat, inicio: iso(p.inicio), fin: iso(p.fin), duracion_ms: p.fin - p.inicio }));
    case 'D':
      return rec.eventos.map((e) => ({ ...comun, sesion: e.sesion, seq: e.seq, tipo: e.tipo, fuente_evento: e.fuente, exercise_id: e.pregunta, t: iso(e.t), tau_ms: e.tau, recibido: iso(e.recibido), retraso_ms: e.retraso_ms, ref: e.ref ?? null }));
  }
}

/** Nivel E: todo, con versión, parámetros y calidad, en un JSON reproducible (mismo orden siempre). */
export function investigacion(rec: Reconstruccion, ctx: Contexto, audit: AuditoriaPregunta[] = [], generado?: string) {
  return {
    formato: 'aula-telemetria-v2/investigacion@1', generado: generado ?? null, attempt_id: ctx.attempt_id, fuente: ctx.fuente,
    motor: rec.version, parametros: rec.parametros, dominio: rec.dominio, totales: rec.totales, invariantes: rec.invariantes, advertencias: rec.advertencias,
    sesiones: rec.sesiones, continuidades: rec.continuidades, preguntas: rec.preguntas, particion: rec.particion,
    auditoria_respuestas: audit.map((a) => ({ exercise_id: a.exercise_id, diagnostico: a.diagnostico, revisiones: a.revisiones.map((r) => ({ rev: r.rev, hash: r.answer_hash, vacia: r.vacia, primero_at: r.primero_at, ultimo_at: r.ultimo_at, consolidados: r.consolidados })), entregada: a.entregada })),
  };
}
