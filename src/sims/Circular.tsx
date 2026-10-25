import { useMemo } from 'react';
import { estadoMcu, mcu } from '@/fisica/modelos';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Controles, Flecha, Lecturas, muestrear, useSimClock } from './comun';
import type { SimProps } from './tipos';

const W = 320;
const C = W / 2;

export default function Circular({ params }: SimProps) {
  const dark = useDark();
  const { r, T } = params;
  const m = mcu(r, T);
  const tEnd = 3 * T;
  const clock = useSimClock(tEnd);
  const s = estadoMcu(r, T, clock.t);
  const scale = (C - 40) / r;
  const px = (x: number) => C + x * scale;
  const py = (y: number) => C - y * scale;
  const muestras = useMemo(() => muestrear(tEnd, 300, (t) => estadoMcu(r, T, t)), [r, T, tEnd]);
  const visibles = muestras.filter((p) => p.t <= clock.t + 1e-9).map((p) => ({ t: p.t, x: p.x, y: p.y }));
  // longitudes de flecha en píxeles proporcionales (normalizadas para que se vean)
  const vLen = 55;
  const aLen = 45;
  const tinta = dark ? '#d1d5db' : '#374151';
  const ang = ((s.anguloGrados % 360) + 360) % 360;
  return (
    <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
      <svg viewBox={`0 0 ${W} ${W}`} className="mx-auto w-full max-w-[320px] rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950"
        role="img" aria-label={`Partícula a ${ang.toFixed(0)} grados sobre una circunferencia de radio ${r} m`}>
        <line x1={0} y1={C} x2={W} y2={C} stroke={tinta} strokeOpacity={0.3} />
        <line x1={C} y1={0} x2={C} y2={W} stroke={tinta} strokeOpacity={0.3} />
        <circle cx={C} cy={C} r={r * scale} fill="none" stroke={tinta} strokeDasharray="4 4" />
        <line x1={C} y1={C} x2={px(s.x)} y2={py(s.y)} stroke={tinta} strokeOpacity={0.5} />
        <circle cx={C} cy={C} r={3} fill={tinta} />
        <Flecha x1={px(s.x)} y1={py(s.y)} x2={px(s.x) + (s.vx / m.v) * vLen} y2={py(s.y) - (s.vy / m.v) * vLen} color={dark ? '#5fc79f' : '#1f7a55'} label="v" labelOffset={10} />
        <Flecha x1={px(s.x)} y1={py(s.y)} x2={px(s.x) + (s.ax / m.ac) * aLen} y2={py(s.y) - (s.ay / m.ac) * aLen} color={dark ? '#e07a8c' : '#b4475a'} label="ac" labelOffset={12} />
        <circle cx={px(s.x)} cy={py(s.y)} r={7} fill={dark ? '#eec770' : '#264886'} />
        <text x={W - 8} y={C - 6} fontSize={11} textAnchor="end" fill={tinta}>x</text>
        <text x={C + 6} y={14} fontSize={11} fill={tinta}>y</text>
      </svg>
      <div className="space-y-3">
        <Controles clock={clock} tEnd={tEnd} />
        <Lecturas
          title="Magnitudes del movimiento"
          items={[
            { label: 'Rapidez v', value: m.v, unit: 'm/s' },
            { label: 'ω', value: m.omega, unit: 'rad/s', digits: 3 },
            { label: 'Frecuencia f', value: m.f, unit: 'Hz', digits: 3 },
            { label: 'Aceleración centrípeta ac', value: m.ac, unit: 'm/s²' },
          ]}
        />
        <Lecturas
          title="En este instante"
          items={[
            { label: 't', value: clock.t, unit: 's' },
            { label: 'Ángulo', value: ang, unit: '°', digits: 1 },
            { label: 'x', value: s.x, unit: 'm' },
            { label: 'y', value: s.y, unit: 'm' },
          ]}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">Las flechas muestran la dirección de v y de a_c (su longitud no está a escala).</p>
        <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, tEnd]} yDomain={[-Math.ceil(r), Math.ceil(r)]}
          series={[{ key: 'x', name: 'x' }, { key: 'y', name: 'y' }]} yLabel="posición (m)" />
      </div>
    </div>
  );
}
