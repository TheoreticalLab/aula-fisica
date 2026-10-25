import { useMemo } from 'react';
import { estadoBloque, tramosBloque } from '@/fisica/modelos';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Controles, Flecha, Lecturas, muestrear, useSimClock } from './comun';
import type { SimProps } from './tipos';

const W = 560;
const H = 340;
const T_END = 10;
const PX_POR_M = 36;

export default function Fuerzas({ params }: SimProps) {
  const dark = useDark();
  const p = { m: params.m, F: params.F, theta: params.theta, muS: params.muS, muK: params.muK, g: params.g };
  const tramos = useMemo(() => tramosBloque(p, T_END), [p.m, p.F, p.theta, p.muS, p.muK, p.g]); // eslint-disable-line react-hooks/exhaustive-deps
  const clock = useSimClock(T_END);
  const s = estadoBloque(tramos, clock.t);
  const f = s.fuerzas;
  const muestras = useMemo(() => muestrear(T_END, 200, (t) => estadoBloque(tramos, t)), [tramos]);
  const visibles = muestras.filter((m) => m.t <= clock.t + 1e-9).map((m) => ({ t: m.t, x: m.x, v: m.v }));
  const final = muestras[muestras.length - 1];

  // geometría: plano que sube hacia la derecha con ángulo θ (y del SVG hacia abajo)
  const th = (p.theta * Math.PI) / 180;
  const u = { x: Math.cos(th), y: -Math.sin(th) }; // hacia arriba del plano
  const n = { x: -Math.sin(th), y: -Math.cos(th) }; // normal hacia fuera
  const P0 = { x: W / 2, y: H / 2 + 20 };
  // longitud visible del plano: que sus extremos queden dentro del lienzo
  const L = th > 0.01 ? Math.min(520, Math.min(2 * (H - 5 - P0.y), 2 * (P0.y - 30)) / Math.sin(th)) : 520;
  const A = { x: P0.x - u.x * L / 2, y: P0.y - u.y * L / 2 };
  const B = { x: P0.x + u.x * L / 2, y: P0.y + u.y * L / 2 };
  const hb = 44;
  const C = { x: P0.x + n.x * hb / 2, y: P0.y + n.y * hb / 2 };

  // escala de flechas
  const fMax = Math.max(f.peso, Math.abs(p.F), f.normal, Math.abs(f.friccion), 1);
  const k = 90 / fMax;
  const tinta = dark ? '#d1d5db' : '#374151';
  const col = {
    peso: dark ? '#e07a8c' : '#b4475a',
    normal: dark ? '#7f9fd6' : '#264886',
    fric: dark ? '#eec770' : '#a5741b',
    F: dark ? '#5fc79f' : '#1f7a55',
  };
  const shift = (s.x * PX_POR_M) % PX_POR_M;
  const ticks = Array.from({ length: Math.ceil(L / PX_POR_M) + 2 }, (_, i) => -L / 2 + i * PX_POR_M - shift).filter((d) => Math.abs(d) <= L / 2);

  const tipo = f.tipoFriccion === 'estatica' ? 'estática' : f.tipoFriccion === 'cinetica' ? 'cinética' : '—';
  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Bloque de ${p.m} kg sobre un plano de ${p.theta} grados. Aceleración ${s.a.toFixed(2)} m/s²`}>
        <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${B.x},${H} ${A.x},${H}`} fill={dark ? '#1e293b' : '#e5e7eb'} />
        <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={tinta} strokeWidth={2} />
        {ticks.map((d, i) => (
          <line key={i} x1={P0.x + u.x * d} y1={P0.y + u.y * d} x2={P0.x + u.x * d - n.x * 8} y2={P0.y + u.y * d - n.y * 8} stroke={tinta} strokeOpacity={0.6} />
        ))}
        <g transform={`translate(${C.x}, ${C.y}) rotate(${-p.theta})`}>
          <rect x={-30} y={-hb / 2} width={60} height={hb} rx={4} fill={dark ? '#33415c' : '#94a3b8'} fillOpacity={0.55} stroke={tinta} />
        </g>
        <text x={C.x + 40} y={C.y - 34} fontSize={12} fill={tinta}>m = {p.m} kg</text>
        {/* diagrama de cuerpo libre desde el centro del bloque */}
        <Flecha x1={C.x} y1={C.y} x2={C.x} y2={C.y + f.peso * k} color={col.peso} label="P" labelOffset={12} />
        <Flecha x1={C.x} y1={C.y} x2={C.x + n.x * f.normal * k} y2={C.y + n.y * f.normal * k} color={col.normal} label="N" labelOffset={12} />
        {Math.abs(p.F) > 1e-9 && (
          <Flecha x1={C.x} y1={C.y} x2={C.x + u.x * p.F * k} y2={C.y + u.y * p.F * k} color={col.F} label="F" labelOffset={12} />
        )}
        {Math.abs(f.friccion) > 1e-9 && (
          <Flecha x1={P0.x} y1={P0.y} x2={P0.x + u.x * f.friccion * k} y2={P0.y + u.y * f.friccion * k} color={col.fric} label="f" labelOffset={12} />
        )}
        {p.theta > 0 && (
          <text x={A.x + 30} y={A.y + 22} fontSize={12} fill={tinta}>θ = {p.theta}°</text>
        )}
        <text x={10} y={20} fontSize={12} fill={tinta}>Eje + : hacia arriba del plano{p.theta === 0 ? ' (hacia la derecha)' : ''}</text>
      </svg>
      <Controles clock={clock} tEnd={T_END} />
      {s.enReposo && <p className="text-sm font-medium text-acento-700 dark:text-acento-300">El bloque permanece en reposo: la fricción estática equilibra a las demás fuerzas.</p>}
      <Lecturas
        title="Fuerzas (N)"
        items={[
          { label: 'Peso mg', value: f.peso, unit: 'N' },
          { label: 'mg sin θ', value: f.pesoParalelo, unit: 'N' },
          { label: 'mg cos θ', value: f.pesoPerpendicular, unit: 'N' },
          { label: 'Normal N', value: f.normal, unit: 'N' },
          { label: `Fricción (${tipo})`, value: Math.abs(f.friccion), unit: 'N' },
          { label: 'μs·N (máx. estática)', value: p.muS * f.normal, unit: 'N' },
          { label: 'Fuerza neta (con signo)', value: f.fuerzaNeta, unit: 'N' },
          { label: 'Aceleración a (con signo)', value: s.a, unit: 'm/s²' },
        ]}
      />
      <Lecturas
        title="Movimiento (parte del reposo en x = 0)"
        items={[
          { label: 't', value: clock.t, unit: 's' },
          { label: 'x', value: s.x, unit: 'm' },
          { label: 'v', value: s.v, unit: 'm/s' },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, T_END]} yDomain={[Math.floor(Math.min(0, final.x)), Math.ceil(Math.max(0.1, final.x))]}
          series={[{ key: 'x', name: 'x' }]} yLabel="x (m)" />
        <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, T_END]} yDomain={[Math.floor(Math.min(0, final.v)), Math.ceil(Math.max(0.1, final.v))]}
          series={[{ key: 'v', name: 'v' }]} yLabel="v (m/s)" />
      </div>
    </div>
  );
}
