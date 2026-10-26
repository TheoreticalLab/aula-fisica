import { useMemo, useState } from 'react';
import { energiasVertical, oscilador, verletOscilador } from '@/fisica/energia';
import { radAGrados } from '@/fisica/modelos';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Controles, Lecturas, muestrear, useSimClock } from './comun';
import { Barras } from './barras';
import type { SimProps } from './tipos';

/** Resorte en zigzag entre (x1,y) y (x2,y) en horizontal, o entre (x,y1) y (x,y2) en vertical. */
function zigzag(a: number, b: number, c: number, vertical: boolean, vueltas = 12, ancho = 9): string {
  const pts: string[] = [];
  const n = vueltas * 2;
  for (let i = 0; i <= n; i++) {
    const u = a + ((b - a) * i) / n;
    const off = i === 0 || i === n ? 0 : (i % 2 ? ancho : -ancho);
    pts.push(vertical ? `${c + off},${u}` : `${u},${c + off}`);
  }
  return pts.join(' ');
}

export default function MasaResorte({ params }: SimProps) {
  const dark = useDark();
  const vertical = params.vertical >= 0.5;
  const o = useMemo(() => oscilador({ m: params.m, k: params.k, x0: params.x0, v0: params.v0, vertical: params.vertical, g: params.g }), [params]);
  const tEnd = Math.min(60, Math.max(4 * o.T, 4));
  const clock = useSimClock(tEnd);
  const [graf, setGraf] = useState<'x' | 'v' | 'a'>('x');
  const e = o.estado(clock.t);
  // comprobación numérica: Verlet frente a la solución exacta
  const verlet = useMemo(() => {
    const pasos = Math.round(tEnd / (o.T / 400));
    const r = verletOscilador(params.m, params.k, params.x0, params.v0, tEnd / pasos, pasos);
    const E0 = r.energia[0] || 1e-12;
    return Math.max(...r.energia.map((E) => Math.abs(E - E0))) / E0;
  }, [params.m, params.k, params.x0, params.v0, tEnd, o.T]);
  const serie = useMemo(() => muestrear(tEnd, 400, (t) => o.estado(t)), [o, tEnd]);
  const visibles = serie.filter((s) => s.t <= clock.t + 1e-9).map((s) => ({ t: s.t, x: s.x, v: s.v, a: s.a }));
  const tinta = dark ? '#d1d5db' : '#374151';
  const azul = dark ? '#7aa5e8' : '#264886';
  const xMaxVista = Math.max(0.5, o.A * 1.1);
  const fasGrados = radAGrados(o.phi);

  // dibujo
  const W = vertical ? 260 : 600;
  const H = vertical ? 320 : 150;
  const escala = vertical ? 110 / xMaxVista : 220 / xMaxVista;
  let dibujo;
  if (vertical) {
    const yEq = 170;
    const yBloque = yEq + e.x * escala;
    dibujo = (
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-xs rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Bloque a ${(e.x * 100).toFixed(1)} cm del equilibrio`}>
        <line x1={60} y1={14} x2={200} y2={14} stroke={tinta} strokeWidth={4} />
        <polyline points={zigzag(14, yBloque - 20, 130, true)} fill="none" stroke={tinta} strokeWidth={2} />
        <line x1={40} y1={yEq} x2={220} y2={yEq} stroke={tinta} strokeDasharray="4 4" opacity={0.6} />
        <text x={222} y={yEq + 4} fontSize={11} fill={tinta}>eq.</text>
        <rect x={108} y={yBloque - 20} width={44} height={40} rx={4} fill={azul} />
        <text x={8} y={H - 8} fontSize={11} fill={tinta}>x positivo hacia abajo</text>
      </svg>
    );
  } else {
    const xEq = W / 2 + 40;
    const xb = xEq + e.x * escala;
    dibujo = (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Bloque a ${(e.x * 100).toFixed(1)} cm del equilibrio`}>
        <line x1={20} y1={20} x2={20} y2={110} stroke={tinta} strokeWidth={4} />
        <line x1={20} y1={110} x2={W - 10} y2={110} stroke={tinta} strokeWidth={2} />
        <polyline points={zigzag(20, xb - 22, 82, false)} fill="none" stroke={tinta} strokeWidth={2} />
        <line x1={xEq} y1={36} x2={xEq} y2={125} stroke={tinta} strokeDasharray="4 4" opacity={0.6} />
        <text x={xEq} y={140} fontSize={11} textAnchor="middle" fill={tinta}>x = 0 (equilibrio)</text>
        {o.A > 0 && <line x1={xEq - o.A * escala} y1={40} x2={xEq + o.A * escala} y2={40} stroke={tinta} opacity={0.4} />}
        {o.A > 0 && <text x={xEq + o.A * escala} y={34} fontSize={11} textAnchor="middle" fill={tinta}>+A</text>}
        {o.A > 0 && <text x={xEq - o.A * escala} y={34} fontSize={11} textAnchor="middle" fill={tinta}>−A</text>}
        <rect x={xb - 22} y={62} width={44} height={44} rx={4} fill={azul} />
      </svg>
    );
  }

  const ev = vertical ? energiasVertical(params.m, params.k, params.g, e.x, e.v) : null;
  return (
    <div className="space-y-3">
      {dibujo}
      <Controles clock={clock} tEnd={tEnd} />
      <Lecturas
        title="Magnitudes del oscilador"
        items={[
          { label: 'ω = √(k/m)', value: o.omega, unit: 'rad/s' },
          { label: 'f', value: o.f, unit: 'Hz' },
          { label: 'T', value: o.T, unit: 's' },
          { label: 'Amplitud A', value: o.A, unit: 'm', digits: 3 },
          { label: 'Fase inicial φ', value: fasGrados, unit: '°', digits: 1 },
          { label: 'v máx = Aω', value: o.vMax, unit: 'm/s' },
          { label: 'a máx = Aω²', value: o.aMax, unit: 'm/s²' },
          ...(vertical ? [{ label: 'Estiramiento en equilibrio mg/k', value: o.estiramientoEquilibrio, unit: 'm', digits: 3 }] : []),
        ]}
      />
      <Lecturas
        title="En este instante"
        items={[
          { label: 't', value: clock.t, unit: 's' },
          { label: 'x', value: e.x, unit: 'm', digits: 3 },
          { label: 'v', value: e.v, unit: 'm/s' },
          { label: 'a', value: e.a, unit: 'm/s²' },
          { label: 'Fuerza restauradora −kx', value: -params.k * e.x, unit: 'N' },
        ]}
      />
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-white/5">
        Ecuación: <strong>x(t) = {o.A.toFixed(3)} m · cos({o.omega.toFixed(2)} t {fasGrados >= 0 ? '+' : '−'} {Math.abs(fasGrados).toFixed(1)}°)</strong>.
        {Math.abs(fasGrados) < 0.05 && ' Se soltó desde el extremo en reposo: fase cero (función coseno).'}
        {Math.abs(Math.abs(fasGrados) - 90) < 0.05 && ' Partió del equilibrio con velocidad: es una función seno.'}
        {' '}Comprobación numérica (Verlet): la energía varía como máximo {(verlet * 100).toExponential(1)} % durante la simulación.
      </p>
      <Barras
        title="Energías (J)"
        escala={Math.max(1e-6, o.E)}
        items={[
          { label: 'Cinética ½mv²', value: e.K, color: dark ? '#5fc79f' : '#1f7a55' },
          { label: vertical ? 'Potencial ½kx² (desde el eq.)' : 'Potencial ½kx²', value: e.U, color: azul },
          { label: 'Total', value: e.K + e.U, color: dark ? '#eec770' : '#b07a12' },
        ]}
      />
      {ev && (
        <p className="text-xs text-gray-600 dark:text-gray-300">
          En vertical, la energía elástica (medida desde la longitud natural) más la gravitacional vale {ev.suma.toFixed(3)} J, que es ½kx² + ½k(mg/k)² = {ev.equivalente.toFixed(3)} J:
          la gravedad solo añade una constante, así que el movimiento alrededor del equilibrio es el mismo que en horizontal.
        </p>
      )}
      <div>
        <div className="mb-1 flex gap-1" role="tablist" aria-label="Gráfica">
          {(['x', 'v', 'a'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={graf === k} onClick={() => setGraf(k)}
              className={`rounded-md px-3 py-1 text-sm ${graf === k ? 'bg-primario-800 text-white dark:bg-primario-500' : 'bg-gray-100 dark:bg-white/10'}`}>
              {k}–t
            </button>
          ))}
        </div>
        <GraficaEnVivo
          data={visibles}
          xKey="t"
          xLabel="t (s)"
          xDomain={[0, tEnd]}
          yDomain={graf === 'x' ? [-xMaxVista, xMaxVista] : graf === 'v' ? [-Math.max(0.1, o.vMax * 1.1), Math.max(0.1, o.vMax * 1.1)] : [-Math.max(0.1, o.aMax * 1.1), Math.max(0.1, o.aMax * 1.1)]}
          series={[{ key: graf, name: graf }]}
          yLabel={graf === 'x' ? 'x (m)' : graf === 'v' ? 'v (m/s)' : 'a (m/s²)'}
        />
      </div>
    </div>
  );
}
