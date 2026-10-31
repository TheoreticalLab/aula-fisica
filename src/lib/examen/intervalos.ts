/**
 * Motor de examen · tiempo observable por pregunta y categorías de tiempo.
 *
 * Entrada: el diario de tramos (motor.ts) que el navegador envía, y los eventos oficiales del SERVIDOR (apertura,
 * cambios de pregunta, pausas, entrega) con su hora. La conciliación comprueba que el diario sea coherente con lo
 * que el servidor vio; un tramo que lo contradice (más de la tolerancia) se reclasifica como «desconocido» en vez de
 * fiarse del navegador.
 *
 * Salida: por pregunta, la lista de intervalos en el formato que consume LIEIA (TipoIntervalo de d6.ts), donde el
 * tiempo en que la pregunta NO estaba activa figura como «otra_pregunta»; y los totales por categoría.
 */
import type { Tramo, TipoTramo } from './motor';

export interface EventoServidor { t: number; tipo: 'apertura' | 'ir_a' | 'pausa' | 'reanudacion' | 'entrega'; exercise_id?: string | null }

export const TOLERANCIA_MS = 5000;

export interface Conciliacion { tramos: Tramo[]; discrepancias: { tramo: Tramo; motivo: string }[] }

/** Valida el diario: orden, no solapamiento, dentro de la sesión del servidor y coherente con sus eventos. */
export function conciliar(diario: Tramo[], eventos: EventoServidor[], tol = TOLERANCIA_MS): Conciliacion {
  const ev = [...eventos].sort((a, b) => a.t - b.t);
  const ini = ev.find((e) => e.tipo === 'apertura')?.t ?? -Infinity;
  const fin = ev.find((e) => e.tipo === 'entrega')?.t ?? Infinity;
  const discrepancias: Conciliacion['discrepancias'] = [];
  const out: Tramo[] = [];
  let ultimoFin = -Infinity;
  // pausas oficiales [pausa, reanudación)
  const pausas: [number, number][] = [];
  ev.forEach((e, k) => { if (e.tipo === 'pausa') pausas.push([e.t, ev.slice(k + 1).find((x) => x.tipo === 'reanudacion' || x.tipo === 'entrega')?.t ?? Infinity]); });
  // periodos en que el servidor tuvo activa cada pregunta: desde un «ir_a»/«apertura» hasta el siguiente (o la entrega)
  const cambios = ev.filter((e) => (e.tipo === 'ir_a' || e.tipo === 'apertura') && e.exercise_id);
  const periodos = cambios.map((e, k) => ({ q: e.exercise_id!, desde: e.t, hasta: cambios[k + 1]?.t ?? fin }));
  const activaDurante = (q: string, a: number, b: number) => periodos.some((p) => p.q === q && p.desde <= b + tol && p.hasta >= a - tol);
  for (const tr of [...diario].sort((a, b) => a.inicio - b.inicio)) {
    const malo = (motivo: string) => { discrepancias.push({ tramo: tr, motivo }); out.push({ ...tr, tipo: 'desconocido' }); ultimoFin = Math.max(ultimoFin, tr.fin); };
    if (!(tr.fin > tr.inicio)) { discrepancias.push({ tramo: tr, motivo: 'duración no positiva' }); continue; }
    if (tr.inicio < ultimoFin - tol) { malo('se solapa con el tramo anterior'); continue; }
    if (tr.inicio < ini - tol || tr.fin > fin + tol) { malo('fuera de la sesión registrada por el servidor'); continue; }
    const enPausa = pausas.some(([a, b]) => tr.inicio >= a - tol && tr.fin <= b + tol);
    if (tr.tipo === 'pausa_declarada' && !enPausa) { malo('pausa no registrada por el servidor'); continue; }
    if ((tr.tipo === 'trabajo' || tr.tipo === 'inactividad') && pausas.some(([a, b]) => tr.inicio < b - tol && tr.fin > a + tol)) { malo('trabajo durante una pausa oficial'); continue; }
    if ((tr.tipo === 'trabajo' || tr.tipo === 'inactividad') && tr.exercise_id && periodos.length && !activaDurante(tr.exercise_id, tr.inicio, tr.fin)) {
      malo('la pregunta no estaba activa según el servidor'); continue;
    }
    out.push(tr);
    ultimoFin = Math.max(ultimoFin, tr.fin);
  }
  return { tramos: out, discrepancias };
}

export type Categoria = TipoTramo;
export type Totales = Record<Categoria, number>;
const cero = (): Totales => ({ trabajo: 0, inactividad: 0, pausa_declarada: 0, oculta: 0, desconexion: 0, desconocido: 0, fuera_de_pregunta: 0 });

export interface ResumenTiempos {
  total: Totales;                                     // ms por categoría en todo el intento
  por_pregunta: Record<string, Totales>;              // ms por categoría mientras esa pregunta estaba activa
  visitas: Record<string, number>;                    // veces que se volvió a cada pregunta
}

export function resumirTiempos(tramos: Tramo[]): ResumenTiempos {
  const total = cero(), por_pregunta: Record<string, Totales> = {}, visitas: Record<string, number> = {};
  let previa: string | null = null;
  for (const tr of [...tramos].sort((a, b) => a.inicio - b.inicio)) {
    const d = tr.fin - tr.inicio;
    total[tr.tipo] += d;
    if (tr.exercise_id) {
      (por_pregunta[tr.exercise_id] ??= cero())[tr.tipo] += d;
      if (tr.exercise_id !== previa && (tr.tipo === 'trabajo' || tr.tipo === 'inactividad')) { visitas[tr.exercise_id] = (visitas[tr.exercise_id] ?? 0) + 1; previa = tr.exercise_id; }
    }
  }
  return { total, por_pregunta, visitas };
}

/** Intervalos de una pregunta en el formato de LIEIA (segundos desde el primer tramo del intento). */
export interface IntervaloLieia { inicio: number; fin: number; tipo: 'trabajo' | 'inactividad' | 'pausa_declarada' | 'oculta' | 'desconexion' | 'desconocido' | 'otra_pregunta' }

export function intervalosDePregunta(tramos: Tramo[], exercise_id: string): IntervaloLieia[] {
  const xs = [...tramos].sort((a, b) => a.inicio - b.inicio);
  if (!xs.length) return [];
  const t0 = xs[0].inicio;
  const propios = xs.filter((t) => t.exercise_id === exercise_id);
  if (!propios.length) return [];
  const desde = propios[0].inicio, hasta = propios[propios.length - 1].fin;
  return xs.filter((t) => t.fin > desde && t.inicio < hasta).map((t) => ({
    inicio: (Math.max(t.inicio, desde) - t0) / 1000, fin: (Math.min(t.fin, hasta) - t0) / 1000,
    tipo: t.exercise_id === exercise_id ? (t.tipo === 'fuera_de_pregunta' ? 'otra_pregunta' : t.tipo) : 'otra_pregunta',
  }));
}
