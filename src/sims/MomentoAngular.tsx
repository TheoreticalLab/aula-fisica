import { useMemo } from 'react';
import { conservacionL, inerciaPlataforma } from '@/lib/fisica/rotacion';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Controles, Lecturas, useSimClock } from './comun';
import { Barras } from './barras';
import { sig3 } from './Rodadura';
import type { SimProps } from './tipos';

const T_ANTES = 1;   // s girando con r1 antes de mover las masas
const T_DESPUES = 1.5;

export default function MomentoAngular({ params }: SimProps) {
  const dark = useDark();
  const { Ip, m, r1, r2, w0, tc } = params;
  const tEnd = T_ANTES + tc + T_DESPUES;
  const clock = useSimClock(tEnd);
  const I1 = inerciaPlataforma(Ip, m, r1);
  const I2 = inerciaPlataforma(Ip, m, r2);
  const c = conservacionL(I1, w0, I2);
  const estado = (t: number) => {
    const s = Math.min(1, Math.max(0, (t - T_ANTES) / tc));
    const r = r1 + (r2 - r1) * s;
    const I = inerciaPlataforma(Ip, m, r);
    const w = c.L / I;
    return { t, r, I, w, L: I * w, K: 0.5 * I * w * w };
  };
  // ángulo girado: integración numérica de ω(t)
  const serie = useMemo(() => {
    const n = 600, dt = tEnd / n;
    let ang = 0;
    const out: { t: number; w: number; K: number; ang: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const e = estado(i * dt);
      out.push({ t: e.t, w: e.w, K: e.K, ang });
      ang += e.w * dt;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Ip, m, r1, r2, w0, tc]);
  const e = estado(clock.t);
  const idx = Math.min(serie.length - 1, Math.round((clock.t / tEnd) * (serie.length - 1)));
  const ang = serie[idx].ang;
  const tinta = dark ? '#d1d5db' : '#374151';
  const azul = dark ? '#7aa5e8' : '#264886';
  const R = 110, cx = 150, cy = 140, rMaxVis = 100;
  const rp = (e.r / 1) * rMaxVis;
  const visibles = serie.filter((s) => s.t <= clock.t + 1e-9);
  const fase = clock.t < T_ANTES ? 'girando con las masas en r₁' : clock.t < T_ANTES + tc ? 'moviendo las masas (fuerzas internas)' : 'girando con las masas en r₂';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[300px_1fr]">
        <svg viewBox="0 0 300 280" className="w-full max-w-xs rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
          aria-label={`Plataforma vista desde arriba, ω = ${sig3(e.w)} rad/s`}>
          <g transform={`translate(${cx},${cy}) rotate(${(-ang * 180) / Math.PI})`}>
            <circle r={R} fill={dark ? '#1f2937' : '#f3f4f6'} stroke={tinta} strokeWidth={1.5} />
            <line x1={-R} y1={0} x2={R} y2={0} stroke={tinta} strokeWidth={1} opacity={0.5} />
            <line x1={0} y1={-R} x2={0} y2={R} stroke={tinta} strokeWidth={1} opacity={0.25} />
            {m > 0 && <circle cx={rp} cy={0} r={9} fill={azul} />}
            {m > 0 && <circle cx={-rp} cy={0} r={9} fill={azul} />}
          </g>
          <circle cx={cx} cy={cy} r={4} fill={tinta} />
          <text x={8} y={272} fontSize={11} fill={tinta}>Vista desde arriba · giro antihorario</text>
        </svg>
        <div className="space-y-2">
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">Ahora: <strong>{fase}</strong>.</p>
          <Lecturas title="En este instante" items={[
            { label: 't', value: sig3(clock.t), unit: 's' },
            { label: 'r', value: sig3(e.r), unit: 'm' },
            { label: 'I = Ip + 2mr²', value: sig3(e.I), unit: 'kg·m²' },
            { label: 'ω', value: sig3(e.w), unit: 'rad/s' },
            { label: 'L = Iω', value: sig3(e.L), unit: 'kg·m²/s' },
            { label: 'K = ½Iω²', value: sig3(e.K), unit: 'J' },
          ]} />
        </div>
      </div>
      <Controles clock={clock} tEnd={tEnd} />
      <Lecturas title="Antes y después" items={[
        { label: 'I₁', value: sig3(I1), unit: 'kg·m²' },
        { label: 'I₂', value: sig3(I2), unit: 'kg·m²' },
        { label: 'ω₁', value: sig3(w0), unit: 'rad/s' },
        { label: 'ω₂ = I₁ω₁/I₂', value: sig3(c.w2), unit: 'rad/s' },
        { label: 'K₁', value: sig3(c.K1), unit: 'J' },
        { label: 'K₂', value: sig3(c.K2), unit: 'J' },
        { label: 'Trabajo de las fuerzas internas K₂ − K₁', value: sig3(c.trabajoInterno), unit: 'J' },
      ]} />
      <Barras title="Momento angular (constante) y energía cinética" unit="" escala={Math.max(1e-9, c.L, c.K1, c.K2)} items={[
        { label: 'L (kg·m²/s)', value: e.L, color: azul },
        { label: 'K (J)', value: e.K, color: dark ? '#5fc79f' : '#1f7a55' },
      ]} />
      <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, tEnd]}
        yDomain={[0, Math.max(w0, c.w2) * 1.15]} series={[{ key: 'w', name: 'ω (rad/s)' }]} yLabel="ω (rad/s)" />
      <p className="text-xs text-gray-600 dark:text-gray-300">
        El eje es vertical y sin fricción: ninguna fuerza externa hace torque respecto de él, así que L se conserva. La energía cinética no: al acercar
        las masas, las fuerzas internas (los brazos, el mecanismo) hacen trabajo positivo; al alejarlas, negativo.
      </p>
    </div>
  );
}
