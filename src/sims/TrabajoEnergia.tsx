import { useMemo } from 'react';
import { trabajoEnergia } from '@/fisica/energia';
import { gradosARad } from '@/fisica/modelos';
import { useDark } from '@/lib/tema';
import { Notice } from '@/components/ui';
import { Controles, Flecha, Lecturas, useSimClock } from './comun';
import { Barras } from './barras';
import type { SimProps } from './tipos';

const W = 600;
const H = 170;

export default function TrabajoEnergia({ params }: SimProps) {
  const dark = useDark();
  const r = useMemo(() => trabajoEnergia({ m: params.m, F: params.F, phi: params.phi, muK: params.muK, d: params.d, v0: params.v0, g: params.g }), [params]);
  const tEnd = Math.max(0.5, r.tFin || 0.5);
  const clock = useSimClock(tEnd);
  const t = Math.min(clock.t, r.tFin);
  const x = r.valido && r.s > 0 ? Math.min(r.s, params.v0 * t + 0.5 * r.a * t * t) : 0;
  const v = r.valido && r.s > 0 ? Math.max(0, params.v0 + r.a * t) : 0;
  const tinta = dark ? '#d1d5db' : '#374151';
  const px = (s: number) => 50 + (s / Math.max(params.d, 1)) * (W - 140);
  const bx = px(x);
  const phi = gradosARad(params.phi);
  const fEsc = 1.2; // px por N (limitado)
  const lF = Math.min(110, params.F * fEsc);
  // trabajo hecho HASTA el instante actual (fuerzas constantes: W ∝ x)
  const frac = r.s > 0 ? x / r.s : 0;
  const K = 0.5 * params.m * v * v;
  const colores = dark ? ['#7aa5e8', '#e07a8c', '#9ca3af', '#9ca3af', '#eec770', '#5fc79f'] : ['#264886', '#b4475a', '#6b7280', '#6b7280', '#b07a12', '#1f7a55'];

  return (
    <div className="space-y-3">
      {!r.valido && <Notice tone="warn">{r.motivo}</Notice>}
      {r.valido && r.motivo && <Notice>{r.motivo}</Notice>}
      {r.seDetiene && <Notice>La fricción detiene el bloque después de recorrer {r.s.toFixed(2)} m, antes de completar los {params.d} m.</Notice>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Bloque a ${x.toFixed(2)} m, rapidez ${v.toFixed(2)} m/s`}>
        <line x1={20} y1={120} x2={W - 20} y2={120} stroke={tinta} strokeWidth={2} />
        <line x1={px(0)} y1={124} x2={px(0)} y2={136} stroke={tinta} />
        <line x1={px(params.d)} y1={124} x2={px(params.d)} y2={136} stroke={tinta} />
        <text x={(px(0) + px(params.d)) / 2} y={150} fontSize={12} textAnchor="middle" fill={tinta}>d = {params.d} m</text>
        <rect x={bx - 24} y={84} width={48} height={36} rx={4} fill={dark ? '#264886' : '#afc4e8'} stroke={tinta} />
        <text x={bx} y={107} fontSize={12} textAnchor="middle" fill={tinta}>{params.m} kg</text>
        {params.F > 0 && <Flecha x1={bx} y1={102} x2={bx + lF * Math.cos(phi)} y2={102 - lF * Math.sin(phi)} color={colores[0]} label="F" />}
        {r.f > 0 && x < r.s + 1e-9 && r.s > 0 && <Flecha x1={bx - 24} y1={116} x2={bx - 24 - Math.min(80, r.f * fEsc)} y2={116} color={colores[1]} label="f" />}
        <Flecha x1={bx + 12} y1={84} x2={bx + 12} y2={84 - Math.min(60, r.N * 0.6)} color={colores[2]} label="N" />
        <Flecha x1={bx - 12} y1={120} x2={bx - 12} y2={120 + Math.min(30, params.m * params.g * 0.4)} color={colores[3]} label="mg" />
      </svg>
      <Controles clock={clock} tEnd={tEnd} />
      <Lecturas
        items={[
          { label: 'Recorrido', value: x, unit: 'm' },
          { label: 'Rapidez', value: v, unit: 'm/s' },
          { label: 'N = mg − F sen φ', value: r.N, unit: 'N' },
          { label: 'Fricción', value: r.f, unit: 'N' },
          { label: 'Aceleración', value: r.a, unit: 'm/s²' },
          { label: 'Rapidez al final', value: r.v1, unit: 'm/s' },
        ]}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Barras
          title="Trabajo de cada fuerza (hasta este instante)"
          escala={Math.max(1e-6, Math.abs(r.W.F), Math.abs(r.W.friccion), Math.abs(r.W.neto))}
          items={[
            { label: 'Fuerza aplicada', value: r.W.F * frac, color: colores[0] },
            { label: 'Fricción', value: r.W.friccion * frac, color: colores[1] },
            { label: 'Normal', value: 0, color: colores[2] },
            { label: 'Peso', value: 0, color: colores[3] },
            { label: 'Trabajo neto', value: r.W.neto * frac, color: colores[4] },
          ]}
        />
        <Barras
          title="Energía cinética"
          escala={Math.max(1e-6, r.K0, r.K1, r.K0 + Math.max(0, r.W.neto))}
          items={[
            { label: 'K inicial', value: r.K0, color: colores[5] },
            { label: 'K ahora', value: K, color: colores[5] },
            { label: 'ΔK = K − K₀', value: K - r.K0, color: colores[4] },
          ]}
        />
      </div>
      <p className="text-xs text-gray-500">Compruebe en las barras: el trabajo neto es igual al cambio de energía cinética (ΔK), en cada instante.</p>
    </div>
  );
}
