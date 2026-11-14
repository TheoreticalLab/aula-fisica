import { useMemo } from 'react';
import { BETA, FORMAS, NOMBRE_FORMA, rodadura, type Forma } from '@/lib/fisica/rotacion';
import { useDark } from '@/lib/tema';
import { Controles, Lecturas, useSimClock } from './comun';
import { Barras } from './barras';
import type { SimProps } from './tipos';

/** Tres cifras significativas (lo que se promete en la ficha del simulador). */
export const sig3 = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(3)).toString() : '—');

const COLORES = ['#264886', '#1f7a55', '#b07a12', '#8b3a8f', '#6b7280'];

export default function Rodadura({ params }: SimProps) {
  const dark = useDark();
  const th = (params.theta * Math.PI) / 180;
  const formaSel = FORMAS[Math.round(params.forma)] as Forma;
  const comparar = params.comparar >= 0.5;
  const formas: Forma[] = comparar ? FORMAS : [formaSel];
  const res = useMemo(() => formas.map((f) => ({ f, r: rodadura(f, th, params.L, params.g, params.m, params.R) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comparar, formaSel, th, params.L, params.g, params.m, params.R]);
  const tEnd = Math.max(...res.map((x) => x.r.t)) * 1.08 + 0.2;
  const clock = useSimClock(tEnd);
  const tinta = dark ? '#d1d5db' : '#374151';

  // geometría del dibujo: plano desde (40, 30) hasta (560, 30 + 520·tanθ) escalado para caber
  const W = 600, H = 260;
  const largoPx = 460;
  const rVis = 13;
  const ux = Math.cos(th), uy = Math.sin(th);
  // espacio para los carriles de la carrera (se apilan según la normal del plano)
  const margenCarriles = comparar ? (FORMAS.length - 1) * 2.2 * rVis + 2 * rVis : 2 * rVis;
  const x0 = 30, y0 = 12 + margenCarriles * ux;
  const dx = largoPx * ux, dy = largoPx * uy;
  const esc = Math.min(1, (H - y0 - 20) / dy, (W - x0 - 20 - margenCarriles * uy) / dx);
  const sel = res[0].r;

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Plano inclinado ${params.theta}° de ${params.L} m`}>
        <polygon points={`${x0},${y0} ${x0 + dx * esc},${y0 + dy * esc} ${x0},${y0 + dy * esc}`} fill={dark ? '#1f2937' : '#f3f4f6'} stroke={tinta} strokeWidth={1.5} />
        <text x={x0 + 8} y={y0 + dy * esc - 8} fontSize={12} fill={tinta}>{params.theta}°</text>
        {res.map(({ f, r }, i) => {
          const s = Math.min(params.L, 0.5 * r.a * clock.t * clock.t);
          const frac = s / params.L;
          // cada carril se desplaza un poco perpendicular al plano para que no se solapen
          const off = comparar ? i * 2.2 * rVis : 0;
          // centro del cuerpo: punto del plano desplazado (rVis + carril) según la normal saliente, que en pantalla
          // (y hacia abajo) es (sen θ, −cos θ): el sólido del plano queda abajo a la izquierda de la hipotenusa
          const bx = x0 + dx * esc * frac + uy * (rVis + 1 + off);
          const by = y0 + dy * esc * frac - ux * (rVis + 1 + off);
          const ang = (s * esc * largoPx) / params.L / rVis; // giro visual sin deslizar
          const c = COLORES[FORMAS.indexOf(f)];
          if (f === 'bloque') {
            return (
              <g key={f} transform={`translate(${bx},${by}) rotate(${(th * 180) / Math.PI})`}>
                <rect x={-rVis} y={-rVis} width={2 * rVis} height={2 * rVis} rx={2} fill={c} opacity={0.85} />
              </g>
            );
          }
          const hueco = f === 'aro' || f === 'esfera-hueca';
          return (
            <g key={f} transform={`translate(${bx},${by})`}>
              <circle r={rVis} fill={hueco ? 'none' : c} stroke={c} strokeWidth={hueco ? 4 : 1} opacity={0.9} />
              <line x1={0} y1={0} x2={rVis * Math.cos(ang)} y2={rVis * Math.sin(ang)} stroke={hueco ? c : '#fff'} strokeWidth={2} />
              {comparar && <text x={rVis + 4} y={-rVis} fontSize={10} fill={c}>{f}</text>}
            </g>
          );
        })}
      </svg>
      <Controles clock={clock} tEnd={tEnd} />
      {comparar ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-300">Carrera (mismo plano, desde el reposo)</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Forma</th><th>β = I/(MR²)</th><th>a (m/s²)</th><th>Tiempo (s)</th><th>v final (m/s)</th><th>K rot / K</th><th>Fricción (N)</th><th>μs mínimo</th></tr></thead>
            <tbody>
              {[...res].sort((p, q) => p.r.t - q.r.t).map(({ f, r }) => (
                <tr key={f} className="border-t border-gray-100 dark:border-white/10">
                  <td style={{ color: COLORES[FORMAS.indexOf(f)] }}>{NOMBRE_FORMA[f]}</td>
                  <td className="tabular-nums">{sig3(BETA[f])}</td>
                  <td className="tabular-nums">{sig3(r.a)}</td>
                  <td className="tabular-nums">{sig3(r.t)}</td>
                  <td className="tabular-nums">{sig3(r.v)}</td>
                  <td className="tabular-nums">{sig3(r.fraccionRot)}</td>
                  <td className="tabular-nums">{f === 'bloque' ? '0 (desliza)' : sig3(r.friccion)}</td>
                  <td className="tabular-nums">{f === 'bloque' ? '—' : sig3(r.muMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">El orden no depende de la masa ni del radio: solo de cómo está repartida la masa (β).</p>
        </div>
      ) : (
        <>
          <Lecturas title={NOMBRE_FORMA[formaSel]} items={[
            { label: 'β = I/(MR²)', value: sig3(BETA[formaSel]) },
            { label: 'Altura h', value: sig3(sel.h), unit: 'm' },
            { label: 'Aceleración a', value: sig3(sel.a), unit: 'm/s²' },
            { label: 'Tiempo de llegada', value: sig3(sel.t), unit: 's' },
            { label: 'v final del CM', value: sig3(sel.v), unit: 'm/s' },
            { label: 'ω final', value: formaSel === 'bloque' ? 'no gira' : sig3(sel.w), unit: formaSel === 'bloque' ? undefined : 'rad/s' },
            { label: 'Fricción estática necesaria', value: sig3(sel.friccion), unit: 'N' },
            { label: 'μs mínimo para no deslizar', value: sig3(sel.muMin) },
            { label: 'Normal', value: sig3(sel.normal), unit: 'N' },
          ]} />
          <Barras title="Energía al llegar abajo (J)" escala={Math.max(1e-9, params.m * params.g * sel.h)} items={[
            { label: 'Potencial perdida Mgh', value: params.m * params.g * sel.h, color: dark ? '#eec770' : '#b07a12' },
            { label: 'Traslación ½Mv²', value: sel.Ktras, color: dark ? '#7aa5e8' : '#264886' },
            { label: 'Rotación ½Iω²', value: sel.Krot, color: dark ? '#5fc79f' : '#1f7a55' },
          ]} />
          <p className="text-xs text-gray-600 dark:text-gray-300">
            La fricción estática actúa hacia arriba del plano en el punto de contacto, que está en reposo instantáneo: no hace trabajo, pero produce el
            torque que hace girar al cuerpo. Por eso Mgh = ½Mv² + ½Iω².
          </p>
        </>
      )}
    </div>
  );
}
