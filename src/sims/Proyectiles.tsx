import { useMemo } from 'react';
import { estadoProyectil, proyectil } from '@/fisica/modelos';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Controles, Flecha, Lecturas, muestrear, pasoBonito, useSimClock } from './comun';
import type { SimProps } from './tipos';

const W = 600;
const H_MAX = 380;

export default function Proyectiles({ params }: SimProps) {
  const dark = useDark();
  const { v0, angulo, h0, g } = params;
  const r = useMemo(() => proyectil(v0, angulo, h0, g), [v0, angulo, h0, g]);
  const tEnd = Math.max(0.01, r.tiempoVuelo);
  const clock = useSimClock(tEnd);
  const muestras = useMemo(() => muestrear(tEnd, 240, (t) => estadoProyectil(v0, angulo, h0, g, t)), [v0, angulo, h0, g, tEnd]);
  const s = estadoProyectil(v0, angulo, h0, g, clock.t);

  // misma escala en ambos ejes para no deformar la trayectoria
  const spanX = Math.max(r.alcance, 1) * 1.08;
  const spanY = Math.max(r.alturaMaxima, 1) * 1.15;
  const scale = Math.min((W - 60) / spanX, (H_MAX - 50) / spanY);
  // altura del lienzo ajustada a la trayectoria (sin cielo vacío)
  const H = Math.max(170, Math.min(H_MAX, spanY * scale + 60));
  const px = (x: number) => 40 + x * scale;
  const py = (y: number) => H - 30 - y * scale;
  const tinta = dark ? '#d1d5db' : '#374151';
  const visibles = muestras.filter((m) => m.t <= clock.t + 1e-9);
  const camino = visibles.map((m, i) => `${i ? 'L' : 'M'}${px(m.x).toFixed(1)},${py(Math.max(0, m.y)).toFixed(1)}`).join(' ');
  const fantasma = muestras.map((m, i) => `${i ? 'L' : 'M'}${px(m.x).toFixed(1)},${py(Math.max(0, m.y)).toFixed(1)}`).join(' ');
  const pasoX = pasoBonito(spanX, 6);
  const ticksX: number[] = [];
  for (let k = 0; k <= spanX; k += pasoX) ticksX.push(Number(k.toFixed(6)));
  const vs = 2.2; // px por m/s
  const verde = dark ? '#5fc79f' : '#1f7a55';
  const azul = dark ? '#7f9fd6' : '#264886';
  const ambar = dark ? '#eec770' : '#a5741b';
  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-gradient-to-b from-sky-50 to-white dark:border-white/10 dark:from-primario-900 dark:to-primario-950"
        role="img" aria-label={`Proyectil en x = ${s.x.toFixed(1)} m, y = ${Math.max(0, s.y).toFixed(1)} m`}>
        <rect x={0} y={H - 30} width={W} height={30} fill={dark ? '#1f3a2c' : '#a7d7a0'} />
        {ticksX.map((k) => (
          <g key={k}>
            <line x1={px(k)} y1={H - 30} x2={px(k)} y2={H - 24} stroke={tinta} />
            <text x={px(k)} y={H - 10} fontSize={11} textAnchor="middle" fill={tinta}>{k}</text>
          </g>
        ))}
        <text x={W - 8} y={H - 34} fontSize={11} textAnchor="end" fill={tinta}>x (m)</text>
        {h0 > 0 && <rect x={px(0) - 24} y={py(h0)} width={24} height={h0 * scale} fill={dark ? '#33415c' : '#cbd5e1'} />}
        <path d={fantasma} fill="none" stroke={tinta} strokeOpacity={0.25} strokeDasharray="4 5" />
        <path d={camino} fill="none" stroke={dark ? '#e07a8c' : '#b4475a'} strokeWidth={2} />
        <line x1={px(r.vx * r.tiempoAlturaMaxima)} y1={py(r.alturaMaxima)} x2={px(r.vx * r.tiempoAlturaMaxima)} y2={H - 30} stroke={ambar} strokeDasharray="3 4" />
        <circle cx={px(s.x)} cy={py(Math.max(0, s.y))} r={6} fill={dark ? '#e07a8c' : '#b4475a'} />
        <Flecha x1={px(s.x)} y1={py(Math.max(0, s.y))} x2={px(s.x) + s.vx * vs} y2={py(Math.max(0, s.y))} color={azul} label="vx" labelOffset={12} />
        <Flecha x1={px(s.x)} y1={py(Math.max(0, s.y))} x2={px(s.x)} y2={py(Math.max(0, s.y)) - s.vy * vs} color={verde} label="vy" labelOffset={12} />
      </svg>
      <Controles clock={clock} tEnd={tEnd} />
      <Lecturas
        title="En este instante"
        items={[
          { label: 't', value: clock.t, unit: 's' },
          { label: 'x', value: s.x, unit: 'm' },
          { label: 'y', value: Math.max(0, s.y), unit: 'm' },
          { label: 'vx', value: s.vx, unit: 'm/s' },
          { label: 'vy', value: s.vy, unit: 'm/s' },
          { label: '|v|', value: Math.hypot(s.vx, s.vy), unit: 'm/s' },
        ]}
      />
      <Lecturas
        title="Resultados del lanzamiento"
        items={[
          { label: 'Alcance horizontal', value: r.alcance, unit: 'm' },
          { label: 'Altura máxima (desde el suelo)', value: r.alturaMaxima, unit: 'm' },
          { label: 'Tiempo hasta la altura máxima', value: r.tiempoAlturaMaxima, unit: 's' },
          { label: 'Tiempo de vuelo', value: r.tiempoVuelo, unit: 's' },
          { label: 'Rapidez de impacto', value: r.rapidezImpacto, unit: 'm/s' },
          { label: 'Ángulo de impacto (bajo la horizontal)', value: r.anguloImpactoGrados, unit: '°', digits: 1 },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <GraficaEnVivo data={visibles.map((m) => ({ t: m.t, vx: m.vx, vy: m.vy }))} xKey="t" xLabel="t (s)" xDomain={[0, tEnd]}
          yDomain={[Math.floor(Math.min(0, r.vy0 - g * tEnd)), Math.ceil(Math.max(r.vx, r.vy0, 1))]}
          series={[{ key: 'vx', name: 'vx' }, { key: 'vy', name: 'vy' }]} yLabel="v (m/s)" />
        <GraficaEnVivo data={visibles.map((m) => ({ t: m.t, y: Math.max(0, m.y) }))} xKey="t" xLabel="t (s)" xDomain={[0, tEnd]}
          yDomain={[0, Math.ceil(r.alturaMaxima)]} series={[{ key: 'y', name: 'y' }]} yLabel="y (m)" />
      </div>
    </div>
  );
}
