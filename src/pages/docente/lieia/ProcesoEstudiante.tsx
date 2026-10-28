/**
 * LIEIA · Proceso de respuesta de un estudiante a lo largo del tiempo (ficha del estudiante): intentos con
 * telemetría, cronología de cada uno y comparación longitudinal. Descriptivo: los cambios de patrón tienen
 * muchas explicaciones (práctica, cansancio, conexión, dispositivo) y no se atribuyen intenciones.
 */
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rpc } from '@/lib/supabase';
import { useAction, useAsync } from '@/lib/util';
import { mediana } from '@/lib/lieia/estadistica';
import { reconstruir, type EventoCrudo } from '@/lib/lieia/proceso';
import { formatoDuracion } from '@/lib/tiempo';
import { Card, ErrorBox, Spinner } from '@/components/ui';
import { CronologiaDeIntento } from './Cronologia';
import { useTema } from './graficos';

interface IntentoTel { attempt_id: string; titulo: string | null; modo: string; inicio: string; entrega: string | null; eventos: number }
interface Resumen { attempt_id: string; titulo: string; fecha: string; latenciaMediana: number | null; cambios: number; borrados: number; activoFrac: number | null; esperaFinal: number | null; pegados: number; perdidos: number; sesiones: number }

const fmt = (s: number | null) => (s === null ? '—' : formatoDuracion(s));

export function ProcesoEstudiante({ userId }: { userId: string }) {
  const t = useTema();
  const lista = useAsync(() => rpc<IntentoTel[]>('telemetry_student_attempts', { p_user: userId }), [userId]);
  const [sel, setSel] = useState<string | null>(null);
  const [comp, setComp] = useState<Resumen[] | null>(null);
  const accion = useAction();

  async function comparar() {
    await accion.run(async () => {
      const out: Resumen[] = [];
      for (const it of (lista.data ?? []).slice(0, 12)) {
        const d = await rpc<{ intento: { inicio: string; entrega: string | null }; items: { exercise_id: string }[]; eventos: EventoCrudo[] }>('telemetry_attempt', { p_attempt: it.attempt_id });
        const p = reconstruir(d.eventos, new Date(d.intento.inicio).getTime() / 1000, d.intento.entrega ? new Date(d.intento.entrega).getTime() / 1000 : null, d.items.map((x) => x.exercise_id));
        const lats = p.items.map((x) => x.latenciaGeneracion).filter((x): x is number => x !== null);
        out.push({
          attempt_id: it.attempt_id, titulo: it.titulo ?? '—', fecha: it.inicio, latenciaMediana: lats.length ? mediana(lats) : null,
          cambios: p.items.reduce((s, x) => s + x.cambios, 0), borrados: p.items.reduce((s, x) => s + x.borrados, 0),
          activoFrac: p.cronologico ? p.activo / p.cronologico : null, esperaFinal: p.esperaFinal, pegados: p.items.reduce((s, x) => s + x.pegados, 0),
          perdidos: p.calidad.perdidos, sesiones: p.calidad.sesiones,
        });
      }
      setComp(out.reverse());
    });
  }

  if (lista.loading) return <Spinner />;
  if (lista.error) return <ErrorBox error={lista.error} />;
  if (!lista.data?.length) return <p className="text-sm text-gray-500">No hay intentos con telemetría del proceso (se registra desde su activación).</p>;
  return (
    <div className="space-y-4">
      <Card title={`Intentos con telemetría · ${lista.data.length}`} actions={<button className="btn-secundario !py-1 text-xs" disabled={accion.busy} onClick={() => void comparar()}>{accion.busy ? 'Calculando…' : 'Comparar intentos'}</button>}>
        <ErrorBox error={accion.error} />
        <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
          {lista.data.map((it) => (
            <li key={it.attempt_id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>{it.titulo ?? '—'} <span className="text-xs text-gray-500">· {it.modo === 'exam' ? 'evaluación' : 'práctica'} · {new Date(it.inicio).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })} · {it.eventos} eventos</span></span>
              <button className="btn-secundario !py-0.5 text-xs" onClick={() => setSel(sel === it.attempt_id ? null : it.attempt_id)}>{sel === it.attempt_id ? 'Ocultar' : 'Ver cronología'}</button>
            </li>
          ))}
        </ul>
      </Card>
      {sel && <Card title="Cronología del intento"><CronologiaDeIntento attemptId={sel} /></Card>}
      {comp && (
        <Card title="Patrones a lo largo del tiempo (descriptivo)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={comp.map((c) => ({ fecha: new Date(c.fecha).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }), latencia: c.latenciaMediana }))}>
              <CartesianGrid stroke={t.rejilla} vertical={false} />
              <XAxis dataKey="fecha" tick={{ fill: t.texto, fontSize: 10 }} />
              <YAxis tick={{ fill: t.texto, fontSize: 10 }} tickFormatter={(v) => `${Math.round(v)} s`} />
              <Tooltip contentStyle={t.tip} formatter={(v: number) => [`${v.toFixed(0)} s`, 'Mediana hasta responder']} />
              <Line dataKey="latencia" stroke={t.color('d1')} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Intento</th><th className="text-right">Mediana hasta responder</th><th className="text-right">Cambios / borrados</th><th className="text-right">Tiempo activo</th><th className="text-right">Tras la última modificación</th><th className="text-right">De golpe</th><th className="text-right">Calidad</th></tr></thead>
              <tbody>{comp.map((c) => (
                <tr key={c.attempt_id} className="border-b border-gray-100 dark:border-white/5">
                  <td className="py-1 text-xs">{c.titulo}<span className="block text-gray-500">{new Date(c.fecha).toLocaleDateString('es-DO')}</span></td>
                  <td className="text-right tabular-nums">{fmt(c.latenciaMediana)}</td>
                  <td className="text-right tabular-nums">{c.cambios} / {c.borrados}</td>
                  <td className="text-right tabular-nums">{c.activoFrac === null ? '—' : `${Math.round(100 * c.activoFrac)} %`}</td>
                  <td className="text-right tabular-nums">{fmt(c.esperaFinal)}</td>
                  <td className="text-right tabular-nums">{c.pegados}</td>
                  <td className="text-right text-xs">{c.sesiones} ses. · {c.perdidos} perdidos</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">Los patrones cambian con la práctica, el cansancio, el dispositivo o la conexión. Esta comparación es descriptiva: no se atribuyen intenciones.</p>
        </Card>
      )}
    </div>
  );
}
