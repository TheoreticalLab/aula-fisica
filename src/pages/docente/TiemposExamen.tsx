/**
 * Tiempos de un intento con el motor de examen: por pregunta y por categoría (trabajo, inactividad, pausa, página
 * oculta, desconexión, desconocido), con el diario conciliado con los eventos oficiales del servidor.
 * Es una DESCRIPCIÓN del proceso, no un indicador: no lleva valores p ni juicios.
 */
import { examTimeline } from '@/api/examen';
import { conciliar, resumirTiempos, type EventoServidor, type Totales } from '@/lib/examen/intervalos';
import type { Tramo } from '@/lib/examen/motor';
import { formatoDuracion } from '@/lib/tiempo';
import { useAsync } from '@/lib/util';
import { Card, Spinner } from '@/components/ui';

const COLUMNAS: { k: keyof Totales; titulo: string; color: string }[] = [
  { k: 'trabajo', titulo: 'Trabajo', color: 'bg-emerald-500' },
  { k: 'inactividad', titulo: 'Inactiva', color: 'bg-emerald-200' },
  { k: 'pausa_declarada', titulo: 'Pausa', color: 'bg-sky-400' },
  { k: 'oculta', titulo: 'Página oculta', color: 'bg-amber-400' },
  { k: 'desconexion', titulo: 'Desconectado', color: 'bg-gray-400' },
  { k: 'desconocido', titulo: 'Desconocido', color: 'bg-gray-200' },
];
const fmt = (ms: number) => (ms >= 1000 ? formatoDuracion(Math.round(ms / 1000)) : ms > 0 ? '<1 s' : '—');

export function TiemposExamen({ attemptId, etiquetas }: { attemptId: string; etiquetas: Record<string, string> }) {
  const st = useAsync(() => examTimeline(attemptId).catch(() => null), [attemptId]);
  if (st.loading) return <Spinner />;
  const d = st.data;
  if (!d || !d.sesion) return null;   // intento sin motor de examen
  const diario: Tramo[] = d.tramos.map((t) => ({ inicio: t.inicio, fin: t.fin, tipo: t.tipo, exercise_id: t.exercise_id, ...(t.sin_red ? { sin_red: true } : {}) }));
  const eventos: EventoServidor[] = d.eventos.filter((e) => ['apertura', 'ir_a', 'pausa', 'reanudacion', 'entrega'].includes(e.tipo))
    .map((e) => ({ t: e.t, tipo: e.tipo as EventoServidor['tipo'], exercise_id: e.exercise_id }));
  const c = conciliar(diario, eventos);
  const r = resumirTiempos(c.tramos);
  const rechazos = d.eventos.filter((e) => e.tipo === 'rechazo').length;
  const max = Math.max(1, ...d.orden.map((id) => Object.values(r.por_pregunta[id] ?? {}).reduce((s, v) => s + v, 0)));
  return (
    <Card title="Tiempo por pregunta (motor de examen)" className="mb-4">
      <p className="mb-2 text-xs text-gray-500">
        Hora del servidor. Total: trabajo {fmt(r.total.trabajo)}, pausas {fmt(r.total.pausa_declarada)}, página oculta {fmt(r.total.oculta)}, desconectado {fmt(r.total.desconexion)}, revisión final {fmt(r.total.fuera_de_pregunta)}.
        {(c.discrepancias.length > 0 || rechazos > 0) && ` ${c.discrepancias.length + rechazos} tramo(s) del navegador no coincidieron con el servidor y se cuentan como «desconocido».`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Pregunta</th><th className="w-1/3"> </th>{COLUMNAS.map((x) => <th key={x.k} className="text-right">{x.titulo}</th>)}<th className="text-right">Visitas</th></tr></thead>
          <tbody>
            {d.orden.map((id, i) => {
              const t = r.por_pregunta[id];
              return (
                <tr key={id} className="border-b border-gray-100 dark:border-white/5">
                  <td className="py-1">{i + 1}. <span className="text-xs text-gray-500">{etiquetas[id] ?? ''}</span></td>
                  <td>{t && <div className="flex h-2.5 overflow-hidden rounded bg-gray-100 dark:bg-white/10" aria-hidden>{COLUMNAS.map((x) => <div key={x.k} className={x.color} style={{ width: `${(100 * (t[x.k] ?? 0)) / max}%` }} />)}</div>}</td>
                  {COLUMNAS.map((x) => <td key={x.k} className="text-right tabular-nums">{t ? fmt(t[x.k]) : '—'}</td>)}
                  <td className="text-right tabular-nums">{r.visitas[id] ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">Describe el proceso; no es un indicador de conducta. Una pausa o una página oculta tienen muchas explicaciones legítimas.</p>
    </Card>
  );
}
