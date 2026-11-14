import { poleaMasiva } from '@/lib/fisica/rotacion';
import { useDark } from '@/lib/tema';
import { Controles, Flecha, Lecturas, useSimClock } from './comun';
import { sig3 } from './Rodadura';
import type { SimProps } from './tipos';

const RECORRIDO = 1.2; // m que puede bajar el bloque antes de llegar al suelo

export default function PoleaMasiva({ params }: SimProps) {
  const dark = useDark();
  const { m1, m2, M, R, g } = params;
  const forma = params.formaPolea >= 0.5 ? 'aro' : 'disco';
  const p = poleaMasiva(m1, m2, M, R, forma, g);
  const aAbs = Math.abs(p.a);
  const tFin = aAbs > 1e-9 ? Math.sqrt((2 * RECORRIDO) / aAbs) : 3;
  const clock = useSimClock(tFin);
  const s = aAbs > 1e-9 ? 0.5 * p.a * Math.min(clock.t, tFin) ** 2 : 0; // desplazamiento de m2 hacia abajo (con signo)
  const tinta = dark ? '#d1d5db' : '#374151';
  const azul = dark ? '#7aa5e8' : '#264886';
  const naranja = dark ? '#eec770' : '#b07a12';
  const cx = 170, cy = 50, rVis = 22 + 40 * (R / 0.5);
  const esc = 110; // px por metro
  const y1 = 170 - s * esc, y2 = 170 + s * esc;
  const ang = (s * esc) / rVis; // giro visual sin deslizar
  const lado = (m: number) => 14 + 16 * Math.cbrt(m / 10);

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 340 360" className="mx-auto w-full max-w-sm rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label="Máquina de Atwood con polea de masa">
        <line x1={cx} y1={8} x2={cx} y2={cy} stroke={tinta} strokeWidth={3} />
        <line x1={cx - rVis} y1={cy} x2={cx - rVis} y2={y1} stroke={tinta} strokeWidth={1.5} />
        <line x1={cx + rVis} y1={cy} x2={cx + rVis} y2={y2} stroke={tinta} strokeWidth={1.5} />
        <g transform={`translate(${cx},${cy}) rotate(${(ang * 180) / Math.PI})`}>
          <circle r={rVis} fill={forma === 'disco' ? (dark ? '#374151' : '#e5e7eb') : 'none'} stroke={tinta} strokeWidth={forma === 'aro' ? 5 : 2} />
          <line x1={0} y1={0} x2={rVis} y2={0} stroke={naranja} strokeWidth={2} />
        </g>
        <rect x={cx - rVis - lado(m1) / 2} y={y1} width={lado(m1)} height={lado(m1)} rx={2} fill={azul} />
        <text x={cx - rVis} y={y1 + lado(m1) + 14} fontSize={11} textAnchor="middle" fill={tinta}>m₁</text>
        <rect x={cx + rVis - lado(m2) / 2} y={y2} width={lado(m2)} height={lado(m2)} rx={2} fill={azul} />
        <text x={cx + rVis} y={y2 + lado(m2) + 14} fontSize={11} textAnchor="middle" fill={tinta}>m₂</text>
        {aAbs > 1e-9 && <Flecha x1={cx + rVis + 30} y1={170} x2={cx + rVis + 30} y2={170 + Math.sign(p.a) * 40} color={naranja} label="a₂" />}
        <line x1={20} y1={350} x2={320} y2={350} stroke={tinta} strokeWidth={2} />
      </svg>
      <Controles clock={clock} tEnd={tFin} />
      <Lecturas title="Resultados del modelo" items={[
        { label: `I (${forma})`, value: sig3(p.I), unit: 'kg·m²' },
        { label: 'a (m₂ hacia abajo +)', value: sig3(p.a), unit: 'm/s²' },
        { label: 'α = a/R', value: sig3(p.alfa), unit: 'rad/s²' },
        { label: 'T₁', value: sig3(p.T1), unit: 'N' },
        { label: 'T₂', value: sig3(p.T2), unit: 'N' },
        { label: 'Torque neto (T₂ − T₁)R', value: sig3(p.torqueNeto), unit: 'N·m' },
      ]} />
      <p className="text-xs text-gray-600 dark:text-gray-300">
        Con una polea de masa, las dos tensiones son distintas: su diferencia da el torque que acelera la polea, (T₂ − T₁)R = Iα. Con M = 0 se recupera la
        máquina de Atwood ideal (T₁ = T₂ y a = (m₂ − m₁)g/(m₁ + m₂)). El bloque recorre como máximo {RECORRIDO} m.
      </p>
    </div>
  );
}
