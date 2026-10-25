import { useMemo } from 'react';
import { estadoVertical, lanzamientoVertical } from '@/fisica/modelos';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Controles, filasCada, Flecha, Lecturas, muestrear, pasoBonito, TablaDatos, useSimClock } from './comun';
import type { SimProps } from './tipos';

const W = 240;
const H = 420;

export default function CaidaLibre({ params }: SimProps) {
  const dark = useDark();
  const { y0, v0, g } = params;
  const r = useMemo(() => lanzamientoVertical(y0, v0, g), [y0, v0, g]);
  const tEnd = Math.max(0.01, r.tiempoVuelo);
  const clock = useSimClock(tEnd);
  const muestras = useMemo(() => muestrear(tEnd, 200, (t) => estadoVertical(y0, v0, g, t)), [y0, v0, g, tEnd]);
  const s = estadoVertical(y0, v0, g, clock.t);
  const y = Math.max(0, s.y);
  const top = Math.max(r.alturaMaxima, 1) * 1.1;
  const py = (v: number) => H - 30 - (v / top) * (H - 60);
  const tinta = dark ? '#d1d5db' : '#374151';
  const paso = pasoBonito(top);
  const ticks: number[] = [];
  for (let k = 0; k <= top; k += paso) ticks.push(Number(k.toFixed(6)));
  const filas = filasCada(tEnd, 0.5, (t) => {
    const e = estadoVertical(y0, v0, g, t);
    return [t, Math.max(0, e.y), e.v];
  });
  const visibles = muestras.filter((m) => m.t <= clock.t + 1e-9).map((m) => ({ t: m.t, y: Math.max(0, m.y), v: m.v }));
  return (
    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[240px] rounded-lg border border-gray-200 bg-gradient-to-b from-sky-50 to-white dark:border-white/10 dark:from-primario-900 dark:to-primario-950"
        role="img" aria-label={`Objeto a ${y.toFixed(1)} m de altura con velocidad ${s.v.toFixed(1)} m/s`}>
        <rect x={0} y={H - 30} width={W} height={30} fill={dark ? '#1f3a2c' : '#a7d7a0'} />
        <line x1={40} y1={py(0)} x2={40} y2={py(top)} stroke={tinta} />
        {ticks.map((k) => (
          <g key={k}>
            <line x1={36} y1={py(k)} x2={44} y2={py(k)} stroke={tinta} />
            <text x={32} y={py(k) + 4} fontSize={11} textAnchor="end" fill={tinta}>{k}</text>
          </g>
        ))}
        <text x={8} y={14} fontSize={11} fill={tinta}>y (m)</text>
        {/* plataforma de lanzamiento */}
        {y0 > 0 && <rect x={120} y={py(y0)} width={70} height={H - 30 - py(y0)} fill={dark ? '#33415c' : '#cbd5e1'} />}
        {/* altura máxima */}
        {v0 > 0 && <line x1={60} y1={py(r.alturaMaxima)} x2={W - 6} y2={py(r.alturaMaxima)} stroke={dark ? '#eec770' : '#a5741b'} strokeDasharray="4 4" />}
        <circle cx={105} cy={py(y) - 8} r={8} fill={dark ? '#e07a8c' : '#b4475a'} />
        <Flecha x1={105} y1={py(y) - 8} x2={105} y2={py(y) - 8 - s.v * 4} color={dark ? '#5fc79f' : '#1f7a55'} label="v" labelOffset={10} />
      </svg>
      <div className="space-y-3">
        <Controles clock={clock} tEnd={tEnd} />
        <Lecturas
          title="En este instante"
          items={[
            { label: 't', value: clock.t, unit: 's' },
            { label: 'y', value: y, unit: 'm' },
            { label: 'v (+ arriba)', value: s.v, unit: 'm/s' },
            { label: 'a', value: -g, unit: 'm/s²' },
          ]}
        />
        <Lecturas
          title="Resultados del lanzamiento"
          items={[
            { label: 'Altura máxima (desde el suelo)', value: r.alturaMaxima, unit: 'm' },
            { label: 'Tiempo hasta la altura máxima', value: r.tiempoSubida, unit: 's' },
            { label: 'Tiempo hasta el suelo', value: r.tiempoVuelo, unit: 's' },
            { label: 'Velocidad de impacto', value: r.velocidadImpacto, unit: 'm/s' },
            { label: 'Rapidez de impacto', value: Math.abs(r.velocidadImpacto), unit: 'm/s' },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, tEnd]} yDomain={[0, Math.ceil(r.alturaMaxima)]} series={[{ key: 'y', name: 'y' }]} yLabel="y (m)" />
          <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, tEnd]}
            yDomain={[Math.floor(r.velocidadImpacto), Math.ceil(Math.max(v0, 0.1))]} series={[{ key: 'v', name: 'v' }]} yLabel="v (m/s)" />
        </div>
        <TablaDatos title="Tabla de datos cada 0.5 s" cols={[{ label: 't (s)', digits: 2 }, { label: 'y (m)' }, { label: 'v (m/s)' }]} rows={filas} />
      </div>
    </div>
  );
}
