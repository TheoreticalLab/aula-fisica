import { useMemo, useState } from 'react';
import { mrua } from '@/fisica/modelos';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Controles, filasCada, Flecha, Lecturas, muestrear, pasoBonito, TablaDatos, useSimClock } from './comun';
import type { SimProps } from './tipos';

const W = 600;
const H = 120;

export default function Rectilineo({ params }: SimProps) {
  const dark = useDark();
  const { x0, v0, a, tMax } = params;
  const clock = useSimClock(tMax);
  const [graf, setGraf] = useState<'x' | 'v' | 'a'>('x');
  const muestras = useMemo(() => muestrear(tMax, 200, (t) => mrua(x0, v0, a, t)), [x0, v0, a, tMax]);
  const visibles = muestras.filter((m) => m.t <= clock.t + 1e-9);
  const s = mrua(x0, v0, a, clock.t);

  // rango del eje de posiciones: todo el recorrido, con margen
  const xs = muestras.map((m) => m.x);
  const xmin = Math.min(...xs, 0);
  const xmax = Math.max(...xs, 0);
  const pad = Math.max(2, (xmax - xmin) * 0.08);
  const lo = xmin - pad;
  const hi = xmax + pad;
  const px = (x: number) => 20 + ((x - lo) / (hi - lo)) * (W - 40);
  const paso = pasoBonito(hi - lo, 8);
  const ticks: number[] = [];
  for (let k = Math.ceil(lo / paso) * paso; k <= hi; k += paso) ticks.push(Number(k.toFixed(6)));
  const tinta = dark ? '#d1d5db' : '#374151';
  const auto = dark ? '#eec770' : '#264886';
  const vScale = 6; // px por m/s

  const filas = filasCada(tMax, 1, (t) => {
    const e = mrua(x0, v0, a, t);
    return [t, e.x, e.v];
  });

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Móvil en x = ${s.x.toFixed(1)} m con velocidad ${s.v.toFixed(1)} m/s`}>
        <line x1={10} y1={80} x2={W - 10} y2={80} stroke={tinta} strokeWidth={1.5} />
        {ticks.map((k) => (
          <g key={k}>
            <line x1={px(k)} y1={76} x2={px(k)} y2={84} stroke={tinta} />
            <text x={px(k)} y={100} fontSize={11} textAnchor="middle" fill={tinta}>{k}</text>
          </g>
        ))}
        <text x={W - 14} y={114} fontSize={11} textAnchor="end" fill={tinta}>x (m)</text>
        {/* origen */}
        <line x1={px(0)} y1={60} x2={px(0)} y2={86} stroke={dark ? '#e07a8c' : '#b4475a'} strokeWidth={1.5} />
        {/* móvil */}
        <g transform={`translate(${px(s.x)}, 0)`}>
          <rect x={-16} y={52} width={32} height={18} rx={4} fill={auto} />
          <circle cx={-9} cy={73} r={4} fill={tinta} />
          <circle cx={9} cy={73} r={4} fill={tinta} />
        </g>
        <Flecha x1={px(s.x)} y1={40} x2={px(s.x) + s.v * vScale} y2={40} color={dark ? '#5fc79f' : '#1f7a55'} label="v" labelOffset={10} />
      </svg>
      <Controles clock={clock} tEnd={tMax} />
      <Lecturas
        items={[
          { label: 't', value: clock.t, unit: 's' },
          { label: 'x', value: s.x, unit: 'm' },
          { label: 'v', value: s.v, unit: 'm/s' },
          { label: 'a', value: a, unit: 'm/s²' },
          { label: 'Δx desde t = 0', value: s.x - x0, unit: 'm' },
        ]}
      />
      <div>
        <div className="mb-1 flex gap-1" role="tablist" aria-label="Gráfica">
          {(['x', 'v', 'a'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={graf === k} onClick={() => setGraf(k)}
              className={`rounded-md px-3 py-1 text-sm ${graf === k ? 'bg-primario-800 text-white dark:bg-primario-500' : 'bg-gray-100 dark:bg-white/10'}`}>
              {k}–t
            </button>
          ))}
        </div>
        <GraficaEnVivo
          data={visibles.map((m) => ({ t: m.t, x: m.x, v: m.v, a: m.a }))}
          xKey="t"
          xLabel="t (s)"
          xDomain={[0, tMax]}
          yDomain={
            graf === 'x' ? [Math.floor(xmin), Math.ceil(xmax)]
            : graf === 'v' ? [Math.floor(Math.min(v0, v0 + a * tMax, 0)), Math.ceil(Math.max(v0, v0 + a * tMax, 0.1))]
            : [Math.min(-1, a - 1), Math.max(1, a + 1)]
          }
          series={[{ key: graf, name: graf }]}
          yLabel={graf === 'x' ? 'x (m)' : graf === 'v' ? 'v (m/s)' : 'a (m/s²)'}
        />
      </div>
      <TablaDatos title="Tabla de datos cada 1 s" cols={[{ label: 't (s)', digits: 1 }, { label: 'x (m)' }, { label: 'v (m/s)' }]} rows={filas} />
    </div>
  );
}
