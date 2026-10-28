/** LIEIA · Respuestas seudonimizadas del servidor (calibration_data) → datos para la calibración 2PL. */
import type { Calibracion, DatosCalibracion } from './diseno';

export interface FilaBanco { exercise_id: string; titulo: string; dificultad: string; formato: string; conceptos: string[]; leccion: string | null; calibracion: Calibracion | null }
export interface RespuestaHistorica { s: number; a: number; e: string; x: boolean; t0: number; t: number | null }

/** Primer intento de cada estudiante en cada pregunta; duraciones dentro de cada intento (orden de primera respuesta). */
export function prepararCalibracion(banco: FilaBanco[], resp: RespuestaHistorica[]): { datos: DatosCalibracion; ids: string[] } {
  const ids = banco.map((b) => b.exercise_id);
  const idx = new Map(ids.map((id, k) => [id, k]));
  const estudiantes = new Map<number, number>();
  const visto = new Set<string>();
  const datos: DatosCalibracion = { estudiantes: 0, items: ids.length, respuestas: [], duraciones: [] };
  const porIntento = new Map<number, RespuestaHistorica[]>();
  for (const r of [...resp].sort((x, y) => x.a - y.a)) {
    const e = idx.get(r.e);
    if (e === undefined) continue;
    if (!estudiantes.has(r.s)) estudiantes.set(r.s, estudiantes.size);
    const s = estudiantes.get(r.s)!;
    const clave = `${s}-${e}`;
    if (visto.has(clave)) continue;
    visto.add(clave);
    datos.respuestas.push({ s, e, x: r.x });
    if (r.t !== null) porIntento.set(r.a, [...(porIntento.get(r.a) ?? []), r]);
  }
  for (const rs of porIntento.values()) {
    const o = rs.sort((x, y) => (x.t as number) - (y.t as number));
    let previo = o[0].t0;
    for (const r of o) {
      const d = (r.t as number) - previo;
      previo = r.t as number;
      if (d > 2 && d < 3600) datos.duraciones.push({ s: estudiantes.get(r.s)!, e: idx.get(r.e)!, d });
    }
  }
  datos.estudiantes = estudiantes.size;
  return { datos, ids };
}
