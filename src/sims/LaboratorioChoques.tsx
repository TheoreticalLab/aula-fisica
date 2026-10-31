import { useMemo, useState } from 'react';
import { pulsoContacto, simularLaboratorio, type Muestra } from '@/lib/fisica/choques';
import { useDark } from '@/lib/tema';
import { GraficaEnVivo } from '@/components/Grafica';
import { Notice } from '@/components/ui';
import { Controles, Flecha, fmtNum, Lecturas, useSimClock } from './comun';
import { Barras } from './barras';
import type { SimProps } from './tipos';

const W = 640;
const H = 150;
const ANCHO = 0.4; // ancho de cada bloque (m)

type Grafica = 'x' | 'v' | 'p' | 'K' | 'F';
const GRAFICAS: { id: Grafica; label: string }[] = [
  { id: 'x', label: 'x–t' }, { id: 'v', label: 'v–t' }, { id: 'p', label: 'p–t' }, { id: 'K', label: 'K–t' }, { id: 'F', label: 'F–t (modelo)' },
];

const TIPOS = [
  { label: 'Elástico', e: 1 },
  { label: 'Parcialmente inelástico', e: 0.5 },
  { label: 'Totalmente inelástico', e: 0 },
];

export default function LaboratorioChoques({ params, compact, setParams }: SimProps) {
  const dark = useDark();
  const { m1, m2, v1, v2, e, mu, g, separacion, dt_ms } = params;
  const sim = useMemo(
    () => simularLaboratorio({ m1, m2, v1, v2, e, mu, g, separacion, ancho: ANCHO }),
    [m1, m2, v1, v2, e, mu, g, separacion],
  );
  const clock = useSimClock(sim.t_fin);
  const [grafica, setGrafica] = useState<Grafica>('v');
  const ch = sim.choque;
  const unidos = !!ch && e === 0;

  const dtSim = sim.muestras.length > 1 ? sim.muestras[1].t - sim.muestras[0].t : 0.01;
  const actual: Muestra = sim.muestras[Math.min(sim.muestras.length - 1, Math.round(clock.t / dtSim))];
  const despues = actual.etapa === 'B';

  // escala horizontal: todo el recorrido cabe en la pista
  const { xmin, xmax } = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const s of sim.muestras) { lo = Math.min(lo, s.x1, s.x2); hi = Math.max(hi, s.x1 + ANCHO, s.x2 + ANCHO); }
    const pad = 0.08 * (hi - lo) + 0.2;
    return { xmin: lo - pad, xmax: hi + pad };
  }, [sim]);
  const px = (x: number) => 10 + ((x - xmin) / (xmax - xmin)) * (W - 20);
  const xChoque = sim.t_choque !== null ? v1 * sim.t_choque + ANCHO : null;

  const tinta = dark ? '#d1d5db' : '#374151';
  const c1 = dark ? '#7aa5e8' : '#264886';
  const c2 = dark ? '#eec770' : '#b07a12';
  const rugosa = dark ? '#a16207' : '#92400e';
  const escalaFlecha = 120 / Math.max(1, Math.abs(v1), Math.abs(v2));

  const serie = useMemo(() => {
    const paso = Math.max(1, Math.floor(sim.muestras.length / 400));
    return sim.muestras.filter((_, i) => i % paso === 0 || i === sim.muestras.length - 1).map((s) => ({
      t: s.t, x1: s.x1, x2: s.x2, v1: s.v1, v2: s.v2, p1: s.p1, p2: s.p2, P: s.p1 + s.p2, K1: s.K1, K2: s.K2, K: s.K1 + s.K2,
    }));
  }, [sim]);
  const visibles = serie.filter((s) => s.t <= clock.t + 1e-9);
  const pulso = useMemo(() => (ch ? pulsoContacto(Math.abs(ch.J2), dt_ms / 1000) : null), [ch, dt_ms]);

  const tipo = !ch ? '' : ch.tipo === 'elastico' ? 'elástico' : ch.tipo === 'totalmente_inelastico' ? 'totalmente inelástico' : 'parcialmente inelástico';
  const f1 = sim.frenado1, f2 = sim.frenado2;
  const conFriccion = mu > 0;

  return (
    <div className="space-y-3">
      {setParams && (
        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Tipo de choque">
          <span className="text-gray-600 dark:text-gray-300">Tipo de choque:</span>
          {TIPOS.map((t) => (
            <button key={t.label} className={Math.abs(e - t.e) < 1e-9 ? 'btn-primario py-1' : 'btn-secundario py-1'}
              aria-pressed={Math.abs(e - t.e) < 1e-9} onClick={() => setParams({ ...params, e: t.e })}>{t.label}</button>
          ))}
        </div>
      )}
      {!sim.choca && (
        <Notice>Con estas velocidades los bloques no se acercan: no hay choque. Para que choquen, la velocidad del bloque 1 debe ser mayor que la del bloque 2 (con signo).</Notice>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Etapa ${actual.etapa}. Bloque 1: x = ${fmtNum(actual.x1)} m, v = ${fmtNum(actual.v1)} m/s. Bloque 2: x = ${fmtNum(actual.x2)} m, v = ${fmtNum(actual.v2)} m/s.`}>
        <line x1={10} y1={104} x2={W - 10} y2={104} stroke={despues && conFriccion ? rugosa : tinta} strokeWidth={despues && conFriccion ? 5 : 2}
          strokeDasharray={despues && conFriccion ? '2 3' : undefined} />
        {xChoque !== null && (
          <g>
            <line x1={px(xChoque)} y1={108} x2={px(xChoque)} y2={118} stroke={tinta} />
            <text x={px(xChoque)} y={130} fontSize={10} textAnchor="middle" fill={tinta}>punto de choque</text>
          </g>
        )}
        <rect x={px(actual.x1)} y={70} width={Math.max(2, px(actual.x1 + ANCHO) - px(actual.x1))} height={32} rx={4} fill={c1} />
        <text x={px(actual.x1 + ANCHO / 2)} y={91} fontSize={12} textAnchor="middle" fill="#fff">1</text>
        <rect x={px(actual.x2)} y={70} width={Math.max(2, px(actual.x2 + ANCHO) - px(actual.x2))} height={32} rx={4} fill={c2} />
        <text x={px(actual.x2 + ANCHO / 2)} y={91} fontSize={12} textAnchor="middle" fill="#fff">2</text>
        {Math.abs(actual.v1) > 1e-9 && (
          <Flecha x1={px(actual.x1 + ANCHO / 2)} y1={56} x2={px(actual.x1 + ANCHO / 2) + actual.v1 * escalaFlecha * 0.25} y2={56} color={c1} label="v₁" />
        )}
        {Math.abs(actual.v2) > 1e-9 && !(unidos && despues) && (
          <Flecha x1={px(actual.x2 + ANCHO / 2)} y1={42} x2={px(actual.x2 + ANCHO / 2) + actual.v2 * escalaFlecha * 0.25} y2={42} color={c2} label="v₂" />
        )}
        <text x={12} y={18} fontSize={11} fill={tinta}>
          {despues
            ? `Etapa B: después del choque${conFriccion ? `, con fricción (μk = ${fmtNum(mu)})` : ', sin fricción'}`
            : 'Etapa A: antes del choque, superficie lisa'}
          {ch ? ` · choque ${tipo} (e = ${fmtNum(e)})` : ''}
        </text>
        <text x={12} y={146} fontSize={10} fill={tinta}>{fmtNum(xmin, 1)} m</text>
        <text x={W - 12} y={146} fontSize={10} textAnchor="end" fill={tinta}>{fmtNum(xmax, 1)} m</text>
      </svg>
      <Controles clock={clock} tEnd={sim.t_fin} />

      <Lecturas
        title={`En t = ${fmtNum(clock.t)} s`}
        items={[
          { label: 'x₁', value: actual.x1, unit: 'm' },
          { label: 'x₂', value: actual.x2, unit: 'm' },
          { label: 'v₁', value: actual.v1, unit: 'm/s' },
          { label: 'v₂', value: actual.v2, unit: 'm/s' },
          { label: 'p₁', value: actual.p1, unit: 'kg·m/s' },
          { label: 'p₂', value: actual.p2, unit: 'kg·m/s' },
          { label: 'p total', value: actual.p1 + actual.p2, unit: 'kg·m/s' },
          { label: 'K₁', value: actual.K1, unit: 'J' },
          { label: 'K₂', value: actual.K2, unit: 'J' },
          { label: 'K total', value: actual.K1 + actual.K2, unit: 'J' },
        ]}
      />

      {ch && (
        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-lg border border-gray-200 p-3 dark:border-white/10" aria-label="Etapa A: el choque">
            <h3 className="mb-1 text-sm font-semibold">Etapa A · el choque (se conserva p)</h3>
            <Lecturas title="" items={[
              { label: "v₁ → v₁'", value: `${fmtNum(v1)} → ${fmtNum(ch.v1f)}`, unit: 'm/s' },
              { label: "v₂ → v₂'", value: `${fmtNum(v2)} → ${fmtNum(ch.v2f)}`, unit: 'm/s' },
              { label: 'p antes', value: ch.p_inicial, unit: 'kg·m/s' },
              { label: 'p después', value: ch.p_final, unit: 'kg·m/s' },
              { label: 'K antes', value: ch.K_inicial, unit: 'J' },
              { label: 'K después', value: ch.K_final, unit: 'J' },
              { label: 'K transformada', value: sim.transformada_choque, unit: 'J' },
              { label: 'J sobre 1', value: ch.J1, unit: 'N·s' },
              { label: 'J sobre 2', value: ch.J2, unit: 'N·s' },
            ]} />
          </section>
          <section className="rounded-lg border border-gray-200 p-3 dark:border-white/10" aria-label="Etapa B: deslizamiento con fricción">
            <h3 className="mb-1 text-sm font-semibold">Etapa B · deslizamiento con fricción (p no se conserva)</h3>
            {!conFriccion ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">Sin fricción (μk = 0): después del choque los bloques siguen con velocidad constante y no se detienen.</p>
            ) : (
              <Lecturas title="" items={[
                ...frenadoItems(unidos ? 'bloques unidos' : 'bloque 1', f1),
                ...(unidos ? [] : frenadoItems('bloque 2', f2)),
                { label: 'Energía transformada por la fricción', value: sim.transformada_deslizamiento, unit: 'J' },
              ]} />
            )}
          </section>
        </div>
      )}

      {ch && !compact && (
        <Barras title="Balance de energía cinética (J)" escala={Math.max(1e-6, ch.K_inicial)} items={[
          { label: 'K inicial', value: ch.K_inicial, color: c1 },
          { label: 'Transformada en el choque', value: sim.transformada_choque, color: c2 },
          { label: 'Transformada por fricción', value: sim.transformada_deslizamiento, color: rugosa },
          { label: 'K que queda', value: ch.K_final - sim.transformada_deslizamiento, color: c1 },
        ]} />
      )}

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Gráfica">
        {GRAFICAS.map((gr) => (
          <button key={gr.id} role="tab" aria-selected={grafica === gr.id} className={grafica === gr.id ? 'btn-primario py-1 text-sm' : 'btn-secundario py-1 text-sm'}
            onClick={() => setGrafica(gr.id)} disabled={gr.id === 'F' && !pulso}>{gr.label}</button>
        ))}
      </div>
      {grafica === 'x' && <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, sim.t_fin]} yLabel="x (m)"
        series={[{ key: 'x1', name: 'x₁' }, { key: 'x2', name: 'x₂' }]} />}
      {grafica === 'v' && <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, sim.t_fin]} yLabel="v (m/s)"
        series={[{ key: 'v1', name: 'v₁' }, { key: 'v2', name: 'v₂' }]} />}
      {grafica === 'p' && <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, sim.t_fin]} yLabel="p (kg·m/s)"
        series={[{ key: 'p1', name: 'p₁' }, { key: 'p2', name: 'p₂' }, { key: 'P', name: 'p total' }]} />}
      {grafica === 'K' && <GraficaEnVivo data={visibles} xKey="t" xLabel="t (s)" xDomain={[0, sim.t_fin]} yLabel="K (J)"
        series={[{ key: 'K1', name: 'K₁' }, { key: 'K2', name: 'K₂' }, { key: 'K', name: 'K total' }]} />}
      {grafica === 'F' && pulso && (
        <div className="space-y-1">
          <GraficaEnVivo data={pulso.puntos.map((q) => ({ t: q.t * 1000, F21: q.F, F12: -q.F, media: pulso.media }))} xKey="t" xLabel="tiempo desde el inicio del contacto (ms)"
            yLabel="F (N)" series={[{ key: 'F21', name: 'fuerza de 1 sobre 2' }, { key: 'F12', name: 'fuerza de 2 sobre 1' }, { key: 'media', name: 'fuerza media sobre 2' }]} />
          <p className="text-xs text-gray-500">
            Modelo de contacto: pulso semisinusoidal de {dt_ms} ms con el impulso del choque (|J| = {fmtNum(Math.abs(ch!.J2))} N·s). Pico {fmtNum(pulso.pico, 0)} N, media {fmtNum(pulso.media, 0)} N.
            La forma es una hipótesis; el área bajo la curva (el impulso) no depende de ella. Las dos fuerzas son iguales y opuestas en todo instante.
          </p>
        </div>
      )}
      <p className="text-xs text-gray-500">
        Observe: en la etapa A la cantidad de movimiento total es constante; durante el choque cambia la de cada bloque pero no la suma. En la etapa B la
        fricción (fuerza externa) la reduce hasta cero, y su trabajo transforma la energía cinética que quedó después del choque.
      </p>
    </div>
  );
}

function frenadoItems(quien: string, f: { Ff: number; a: number; t: number; d: number; W: number } | null) {
  if (!f) return [];
  return [
    { label: `Ff (${quien})`, value: f.Ff, unit: 'N' },
    { label: `a (${quien})`, value: f.a, unit: 'm/s²' },
    { label: `t de frenado (${quien})`, value: f.t, unit: 's' },
    { label: `distancia (${quien})`, value: f.d, unit: 'm' },
    { label: `W fricción (${quien})`, value: f.W, unit: 'J' },
  ];
}
