import { useMemo } from 'react';
import { simularPista } from '@/fisica/energia';
import { gradosARad } from '@/fisica/modelos';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Controles, Lecturas, muestrear, useSimClock } from './comun';
import { Barras } from './barras';
import type { SimProps } from './tipos';

const W = 600;
const H = 230;
const T_MAX = 40;

export default function ConservacionEnergia({ params }: SimProps) {
  const dark = useDark();
  const p = useMemo(() => ({ m: params.m, h0: params.h0, v0: params.v0, theta1: params.theta1, theta2: params.theta2, L: params.L, muK: params.muK, g: params.g }), [params]);
  const sim = useMemo(() => simularPista(p, T_MAX), [p]);
  const tEnd = Math.max(1, Math.min(T_MAX, sim.detenido ? sim.tFin + 0.5 : T_MAX));
  const clock = useSimClock(tEnd);
  const e = sim.estado(Math.min(clock.t, sim.tFin));
  const th1 = gradosARad(p.theta1);
  const th2 = gradosARad(p.theta2);
  const yTop = Math.max(p.h0 + (p.v0 * p.v0) / (2 * p.g), p.h0) * 1.12;
  const xIzq = -yTop / Math.tan(th1);
  const xDer = p.L + yTop / Math.tan(th2);
  const escala = Math.min((W - 40) / (xDer - xIzq), (H - 50) / yTop);
  const X = (x: number) => 20 + (x - xIzq) * escala;
  const Y = (y: number) => H - 25 - y * escala;
  const pos = (s: number) => (s < 0 ? { x: s * Math.cos(th1), y: -s * Math.sin(th1) } : s <= p.L ? { x: s, y: 0 } : { x: p.L + (s - p.L) * Math.cos(th2), y: (s - p.L) * Math.sin(th2) });
  const b = pos(e.s);
  const tinta = dark ? '#d1d5db' : '#374151';
  const colores = dark ? { K: '#5fc79f', U: '#7aa5e8', mec: '#eec770', ter: '#e07a8c', tot: '#d1d5db' } : { K: '#1f7a55', U: '#264886', mec: '#b07a12', ter: '#b4475a', tot: '#374151' };
  const serie = useMemo(() => muestrear(tEnd, 300, (t) => sim.estado(Math.min(t, sim.tFin))), [sim, tEnd]);
  const visibles = serie.filter((s) => s.t <= clock.t + 1e-9).map((s) => ({ t: s.t, K: s.K, U: s.U, Emec: s.Emec, Eterm: s.Eterm }));
  const hMaxDer = Math.max(...serie.filter((s) => s.s > p.L).map((s) => s.y), 0);

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Bloque a ${e.y.toFixed(2)} m de altura con rapidez ${Math.abs(e.v).toFixed(2)} m/s`}>
        <polyline fill="none" stroke={tinta} strokeWidth={3}
          points={`${X(xIzq)},${Y(yTop)} ${X(0)},${Y(0)} ${X(p.L)},${Y(0)} ${X(xDer)},${Y(yTop)}`} />
        <line x1={X(xIzq) - 5} y1={Y(p.h0)} x2={X(xDer) + 5} y2={Y(p.h0)} stroke={tinta} strokeDasharray="4 4" opacity={0.5} />
        <text x={X(xDer) - 4} y={Y(p.h0) - 4} fontSize={11} textAnchor="end" fill={tinta}>h₀ = {p.h0} m</text>
        {p.muK > 0 && <text x={X(p.L / 2)} y={Y(0) + 16} fontSize={11} textAnchor="middle" fill={colores.ter}>μk = {p.muK}</text>}
        <circle cx={X(b.x)} cy={Y(b.y) - 9} r={9} fill={dark ? '#eec770' : '#264886'} stroke={tinta} />
      </svg>
      <Controles clock={clock} tEnd={tEnd} />
      <Lecturas
        items={[
          { label: 't', value: clock.t, unit: 's' },
          { label: 'Altura', value: e.y, unit: 'm' },
          { label: 'Rapidez', value: Math.abs(e.v), unit: 'm/s' },
          { label: 'Altura máx. en la rampa derecha', value: hMaxDer, unit: 'm' },
          { label: 'Energía inicial', value: sim.E0, unit: 'J' },
          { label: 'Estado', value: sim.detenido && clock.t >= sim.tFin ? 'detenido' : 'en movimiento' },
        ]}
      />
      <Barras
        title="Energías (J)"
        escala={Math.max(1e-6, sim.E0)}
        items={[
          { label: 'Cinética K', value: e.K, color: colores.K },
          { label: 'Potencial U = mgy', value: e.U, color: colores.U },
          { label: 'Mecánica K + U', value: e.Emec, color: colores.mec },
          { label: 'Térmica (fricción)', value: e.Eterm, color: colores.ter },
          { label: 'Total', value: e.Etotal, color: colores.tot },
        ]}
      />
      <GraficaEnVivo
        data={visibles}
        xKey="t"
        xLabel="t (s)"
        xDomain={[0, tEnd]}
        yDomain={[0, Math.ceil(sim.E0 * 1.05 * 10) / 10]}
        series={[{ key: 'K', name: 'K' }, { key: 'U', name: 'U' }, { key: 'Emec', name: 'K + U' }, { key: 'Eterm', name: 'Térmica' }]}
        yLabel="E (J)"
      />
    </div>
  );
}
