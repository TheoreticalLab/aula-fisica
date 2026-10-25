import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { Figure } from '@/api/tipos';
import { useDark } from '@/lib/tema';

export const SERIES_COLORS = ['#335ca6', '#c99325', '#2f8f6b', '#b4475a', '#7a5cc2'];
export const SERIES_COLORS_DARK = ['#7f9fd6', '#eec770', '#5fc79f', '#e07a8c', '#a98fe6'];

function axisLabel(a: { label: string; unit?: string }) {
  return a.unit ? `${a.label} (${a.unit})` : a.label;
}

const fmt = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(1) : String(Math.round(v * 1000) / 1000));

/** Gráfica de un enunciado (datos fijos). Cada serie tiene sus propios valores de x. */
export function Figura({ figure, height = 260 }: { figure: Figure; height?: number }) {
  const dark = useDark();
  const colors = dark ? SERIES_COLORS_DARK : SERIES_COLORS;
  const grid = dark ? '#ffffff22' : '#00000018';
  const text = dark ? '#d1d5db' : '#374151';
  const series = figure.series.map((s) => ({ name: s.name, data: s.points.map(([x, y]) => ({ x, y })) }));
  const common = (
    <>
      <CartesianGrid stroke={grid} />
      <XAxis type="number" dataKey="x" domain={['auto', 'auto']} tick={{ fill: text, fontSize: 12 }} tickFormatter={fmt}
        label={{ value: axisLabel(figure.x), position: 'insideBottom', offset: -4, fill: text, fontSize: 12 }} />
      <YAxis type="number" dataKey="y" domain={['auto', 'auto']} tick={{ fill: text, fontSize: 12 }} tickFormatter={fmt} width={52}
        label={{ value: axisLabel(figure.y), angle: -90, position: 'insideLeft', fill: text, fontSize: 12 }} />
      <ReferenceLine y={0} stroke={dark ? '#ffffff55' : '#00000044'} />
      <Tooltip formatter={(v) => fmt(Number(v))} labelFormatter={(v) => `${figure.x.label} = ${fmt(Number(v))}`}
        contentStyle={{ background: dark ? '#0b1730' : '#fff', border: '1px solid #8884', fontSize: 12 }} />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
    </>
  );
  return (
    <figure className="my-3 rounded-lg border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
      {figure.title && <figcaption className="mb-1 text-center text-sm font-medium">{figure.title}</figcaption>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {figure.kind === 'scatter' ? (
            <ScatterChart margin={{ top: 8, right: 16, bottom: 18, left: 8 }}>
              {common}
              {series.map((s, i) => (
                <Scatter key={s.name} name={s.name} data={s.data} fill={colors[i % colors.length]} isAnimationActive={false} />
              ))}
            </ScatterChart>
          ) : (
            <LineChart margin={{ top: 8, right: 16, bottom: 18, left: 8 }}>
              {common}
              {series.map((s, i) => (
                <Line key={s.name} name={s.name} data={s.data} dataKey="y" type="linear" stroke={colors[i % colors.length]}
                  strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} strokeDasharray={i > 0 ? '6 4' : undefined} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export interface LiveSeries {
  key: string;
  name: string;
}

/** Gráfica en tiempo real de un simulador: `data` crece mientras corre la simulación. */
export function GraficaEnVivo({
  data,
  xKey,
  xLabel,
  series,
  yLabel,
  xDomain,
  yDomain,
  height = 200,
}: {
  data: Record<string, number>[];
  xKey: string;
  xLabel: string;
  series: LiveSeries[];
  yLabel: string;
  xDomain?: [number, number];
  yDomain?: [number | 'auto', number | 'auto'];
  height?: number;
}) {
  const dark = useDark();
  const colors = dark ? SERIES_COLORS_DARK : SERIES_COLORS;
  const text = dark ? '#d1d5db' : '#374151';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-white/5" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 16, left: 4 }}>
          <CartesianGrid stroke={dark ? '#ffffff22' : '#00000018'} />
          <XAxis type="number" dataKey={xKey} domain={xDomain ?? ['auto', 'auto']} tick={{ fill: text, fontSize: 11 }} tickFormatter={fmt} allowDataOverflow
            label={{ value: xLabel, position: 'insideBottom', offset: -6, fill: text, fontSize: 11 }} />
          <YAxis domain={yDomain ?? ['auto', 'auto']} tick={{ fill: text, fontSize: 11 }} tickFormatter={fmt} width={48}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: text, fontSize: 11 }} />
          <ReferenceLine y={0} stroke={dark ? '#ffffff55' : '#00000044'} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {series.map((s, i) => (
            <Line key={s.key} dataKey={s.key} name={s.name} type="linear" stroke={colors[i % colors.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
