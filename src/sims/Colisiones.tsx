import { useMemo } from 'react';
import { colision1D } from '@/fisica/energia';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Notice } from '@/components/ui';
import { Controles, Flecha, Lecturas, muestrear, useSimClock } from './comun';
import { Barras } from './barras';
import type { SimProps } from './tipos';

const W = 600;
const H = 140;
const T_FIN = 6;

export default function Colisiones({ params }: SimProps) {
  const dark = useDark();
  const { m1, m2, v1, v2, e } = params;
  const c = useMemo(() => colision1D(m1, m2, v1, v2, e), [m1, m2, v1, v2, e]);
  // posiciones iniciales: separación de 3 m entre los frentes; choque cuando se tocan
  const ancho1 = 0.25 + 0.05 * m1;
  const ancho2 = 0.25 + 0.05 * m2;
  const x1i = -1.5 - ancho1;
  const x2i = 1.5;
  const tChoque = c.seAcercan ? (x2i - (x1i + ancho1)) / (v1 - v2) : Infinity;
  const tEnd = Number.isFinite(tChoque) ? Math.min(T_FIN, Math.max(2, tChoque * 2)) : T_FIN;
  const clock = useSimClock(tEnd);
  const pos = (t: number) => {
    if (t <= tChoque) return { t, x1: x1i + v1 * t, x2: x2i + v2 * t, u1: v1, u2: v2 };
    const xc1 = x1i + v1 * tChoque, xc2 = x2i + v2 * tChoque;
    return { t, x1: xc1 + c.v1f * (t - tChoque), x2: xc2 + c.v2f * (t - tChoque), u1: c.v1f, u2: c.v2f };
  };
  const s = pos(clock.t);
  const despues = clock.t > tChoque;
  const ext = 6;
  const px = (x: number) => W / 2 + (x / ext) * (W / 2 - 10);
  const tinta = dark ? '#d1d5db' : '#374151';
  const c1 = dark ? '#7aa5e8' : '#264886';
  const c2 = dark ? '#eec770' : '#b07a12';
  const serie = useMemo(() => muestrear(tEnd, 200, (t) => pos(t)), [tEnd, c]); // eslint-disable-line react-hooks/exhaustive-deps
  const visibles = serie.filter((x) => x.t <= clock.t + 1e-9).map((x) => ({ t: x.t, v1: x.u1, v2: x.u2 }));
  const tipo = e >= 0.999 ? 'elástico' : e <= 0.001 ? 'perfectamente inelástico' : 'inelástico';

  return (
    <div className="space-y-3">
      {!c.seAcercan && <Notice>Con estas velocidades los carros no se acercan: no hay choque. Haga que el carro 1 vaya más rápido hacia la derecha que el carro 2.</Notice>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Carro 1 con velocidad ${s.u1.toFixed(2)} m/s, carro 2 con ${s.u2.toFixed(2)} m/s`}>
        <line x1={10} y1={100} x2={W - 10} y2={100} stroke={tinta} strokeWidth={2} />
        <rect x={px(s.x1)} y={66} width={px(s.x1 + ancho1) - px(s.x1)} height={30} rx={4} fill={c1} />
        <text x={(px(s.x1) + px(s.x1 + ancho1)) / 2} y={86} fontSize={12} textAnchor="middle" fill="#fff">1</text>
        <rect x={px(s.x2)} y={66} width={px(s.x2 + ancho2) - px(s.x2)} height={30} rx={4} fill={c2} />
        <text x={(px(s.x2) + px(s.x2 + ancho2)) / 2} y={86} fontSize={12} textAnchor="middle" fill="#fff">2</text>
        <Flecha x1={(px(s.x1) + px(s.x1 + ancho1)) / 2} y1={52} x2={(px(s.x1) + px(s.x1 + ancho1)) / 2 + s.u1 * 18} y2={52} color={c1} label="v₁" />
        <Flecha x1={(px(s.x2) + px(s.x2 + ancho2)) / 2} y1={40} x2={(px(s.x2) + px(s.x2 + ancho2)) / 2 + s.u2 * 18} y2={40} color={c2} label="v₂" />
        <text x={12} y={126} fontSize={11} fill={tinta}>Choque {tipo} (e = {e.toFixed(2)}) · {despues ? 'después del choque' : 'antes del choque'}</text>
      </svg>
      <Controles clock={clock} tEnd={tEnd} />
      <Lecturas
        title="Antes y después"
        items={[
          { label: "v₁ → v₁'", value: `${v1.toFixed(2)} → ${c.v1f.toFixed(2)}`, unit: 'm/s' },
          { label: "v₂ → v₂'", value: `${v2.toFixed(2)} → ${c.v2f.toFixed(2)}`, unit: 'm/s' },
          { label: 'p total antes', value: c.p0, unit: 'kg·m/s' },
          { label: 'p total después', value: c.p1, unit: 'kg·m/s' },
          { label: 'K antes', value: c.K0, unit: 'J' },
          { label: 'K después', value: c.K1, unit: 'J' },
          { label: 'K perdida', value: c.perdidaK, unit: 'J' },
          { label: 'v del centro de masa', value: c.vcm, unit: 'm/s' },
        ]}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Barras title="Cantidad de movimiento total (kg·m/s)" unit="kg·m/s" items={[
          { label: 'Antes', value: c.p0, color: c1 },
          { label: 'Después', value: despues ? c.p1 : c.p0, color: c2 },
        ]} />
        <Barras title="Energía cinética total (J)" escala={Math.max(1e-6, c.K0)} items={[
          { label: 'Antes', value: c.K0, color: c1 },
          { label: 'Después', value: despues ? c.K1 : c.K0, color: c2 },
        ]} />
      </div>
      <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, tEnd]} yDomain={[-5.5, 5.5]}
        series={[{ key: 'v1', name: 'v₁' }, { key: 'v2', name: 'v₂' }]} yLabel="v (m/s)" />
      <p className="text-xs text-gray-500">Observe: la cantidad de movimiento total es la misma antes y después en todos los casos; la energía cinética solo se conserva si e = 1.</p>
    </div>
  );
}
