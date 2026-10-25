import { useState } from 'react';
import { direccionGrados, magnitud, restar, sumar, vectorPolar } from '@/fisica/modelos';
import { useDark } from '@/lib/tema';
import { Flecha, Lecturas } from './comun';
import type { SimProps } from './tipos';

const W = 440;
const H = 440;
const cx = W / 2;
const cy = H / 2;

export default function Vectores({ params }: SimProps) {
  const dark = useDark();
  const [verDiferencia, setVerDiferencia] = useState(false);
  const A = vectorPolar(params.aMag, params.aAng);
  const B = vectorPolar(params.bMag, params.bAng);
  const R = sumar(A, B);
  const Dif = restar(A, B);
  // escala adaptable: el vector más largo cabe en el lienzo
  const maxLen = Math.max(10, magnitud(R), verDiferencia ? magnitud(Dif) : 0);
  const S = 200 / maxLen;
  const nGrid = Math.ceil(cx / S);
  const px = (x: number) => cx + x * S;
  const py = (y: number) => cy - y * S;
  const cA = dark ? '#7f9fd6' : '#264886';
  const cB = dark ? '#eec770' : '#a5741b';
  const cR = dark ? '#5fc79f' : '#1f7a55';
  const cD = dark ? '#e07a8c' : '#b4475a';
  const grid = dark ? '#ffffff14' : '#0000000f';
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
          aria-label={`Vector A de magnitud ${params.aMag} a ${params.aAng} grados, vector B de magnitud ${params.bMag} a ${params.bAng} grados y su suma`}>
          {Array.from({ length: 2 * nGrid + 1 }, (_, i) => i - nGrid).map((k) => (
            <g key={k}>
              <line x1={px(k)} y1={0} x2={px(k)} y2={H} stroke={grid} />
              <line x1={0} y1={py(k)} x2={W} y2={py(k)} stroke={grid} />
            </g>
          ))}
          <line x1={0} y1={cy} x2={W} y2={cy} stroke={dark ? '#ffffff55' : '#00000055'} />
          <line x1={cx} y1={0} x2={cx} y2={H} stroke={dark ? '#ffffff55' : '#00000055'} />
          <text x={W - 14} y={cy - 6} fontSize={12} fill={dark ? '#ccc' : '#444'}>x</text>
          <text x={cx + 6} y={14} fontSize={12} fill={dark ? '#ccc' : '#444'}>y</text>
          {/* paralelogramo */}
          <line x1={px(A.x)} y1={py(A.y)} x2={px(R.x)} y2={py(R.y)} stroke={cB} strokeDasharray="5 4" strokeWidth={1.5} />
          <line x1={px(B.x)} y1={py(B.y)} x2={px(R.x)} y2={py(R.y)} stroke={cA} strokeDasharray="5 4" strokeWidth={1.5} />
          {/* componentes de R */}
          <line x1={px(0)} y1={py(0)} x2={px(R.x)} y2={py(0)} stroke={cR} strokeDasharray="2 3" />
          <line x1={px(R.x)} y1={py(0)} x2={px(R.x)} y2={py(R.y)} stroke={cR} strokeDasharray="2 3" />
          <Flecha x1={px(0)} y1={py(0)} x2={px(A.x)} y2={py(A.y)} color={cA} label="A" labelOffset={12} />
          <Flecha x1={px(0)} y1={py(0)} x2={px(B.x)} y2={py(B.y)} color={cB} label="B" labelOffset={12} />
          <Flecha x1={px(0)} y1={py(0)} x2={px(R.x)} y2={py(R.y)} color={cR} width={3.5} label="A+B" labelOffset={16} />
          {verDiferencia && <Flecha x1={px(0)} y1={py(0)} x2={px(Dif.x)} y2={py(Dif.y)} color={cD} width={3} label="A−B" labelOffset={16} />}
        </svg>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verDiferencia} onChange={(e) => setVerDiferencia(e.target.checked)} /> Mostrar A − B
        </label>
      </div>
      <div className="space-y-4">
        <Lecturas
          title="Componentes"
          items={[
            { label: 'Ax', value: A.x, unit: 'u' },
            { label: 'Ay', value: A.y, unit: 'u' },
            { label: 'Bx', value: B.x, unit: 'u' },
            { label: 'By', value: B.y, unit: 'u' },
            { label: 'Rx', value: R.x, unit: 'u' },
            { label: 'Ry', value: R.y, unit: 'u' },
          ]}
        />
        <Lecturas
          title="Resultante"
          items={[
            { label: '|A + B|', value: magnitud(R), unit: 'u' },
            { label: 'Dirección de A + B', value: magnitud(R) > 1e-9 ? direccionGrados(R) : null, unit: '°', digits: 1 },
            { label: '|A − B|', value: magnitud(Dif), unit: 'u' },
            { label: 'Dirección de A − B', value: magnitud(Dif) > 1e-9 ? direccionGrados(Dif) : null, unit: '°', digits: 1 },
          ]}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Los ángulos se miden desde el eje +x en sentido antihorario, entre −180° y 180°. La cuadrícula es de 1 unidad.
        </p>
      </div>
    </div>
  );
}
