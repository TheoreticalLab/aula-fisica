import { useMemo } from 'react';
import { anguloGrados, choque2D, modulo, trayectorias, type V } from '@/lib/fisica/choques2d';
import { useDark } from '@/lib/tema';
import { Notice } from '@/components/ui';
import { Controles, Flecha, fmtNum, Lecturas, useSimClock } from './comun';
import type { SimProps } from './tipos';

const W = 640, H = 360;
const TIPOS = [{ label: 'Elástico', e: 1 }, { label: 'Parcialmente inelástico', e: 0.5 }, { label: 'Totalmente inelástico', e: 0 }];

export default function Choques2D({ params, compact, setParams }: SimProps) {
  const dark = useDark();
  const { m1, m2, v1, v2, ang2, b, e, R } = params;
  const c = useMemo(() => choque2D({ m1, m2, v1, v2, ang2, b, e, R }), [m1, m2, v1, v2, ang2, b, e, R]);
  const tray = useMemo(() => trayectorias({ m1, m2, v1, v2, ang2, b, e, R }, c), [m1, m2, v1, v2, ang2, b, e, R, c]);
  const clock = useSimClock(tray.tFin);
  const idx = Math.min(tray.muestras.length - 1, Math.round((clock.t / tray.tFin) * (tray.muestras.length - 1)));
  const s = tray.muestras[idx];

  // escala: todo el recorrido dentro del lienzo
  const { cx, cy, k } = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of tray.muestras) for (const p of [q.x1, q.x2]) { x0 = Math.min(x0, p[0] - R); x1 = Math.max(x1, p[0] + R); y0 = Math.min(y0, p[1] - R); y1 = Math.max(y1, p[1] + R); }
    const kk = Math.min((W - 40) / (x1 - x0 || 1), (H - 40) / (y1 - y0 || 1));
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k: kk };
  }, [tray, R]);
  const X = (p: V) => W / 2 + (p[0] - cx) * k, Y = (p: V) => H / 2 - (p[1] - cy) * k;
  const tinta = dark ? '#d1d5db' : '#374151', c1 = dark ? '#7aa5e8' : '#264886', c2 = dark ? '#eec770' : '#b07a12', cp = dark ? '#86efac' : '#15803d';
  const vel1 = s.despues ? c.v1f : c.v1i, vel2 = s.despues ? c.v2f : c.v2i;
  const ef = 40 / Math.max(1, modulo(c.v1i), modulo(c.v2i));
  const flecha = (p: V, v: V, color: string, label: string) => modulo(v) > 1e-9 && <Flecha x1={X(p)} y1={Y(p)} x2={X(p) + v[0] * ef} y2={Y(p) - v[1] * ef} color={color} label={label} />;

  // diagrama de cantidad de movimiento: p₁ + p₂ antes y después (mismo total)
  const pk = 90 / Math.max(1e-9, modulo(c.pIni), m1 * modulo(c.v1f), m2 * modulo(c.v2f), m1 * modulo(c.v1i), m2 * modulo(c.v2i));
  const tri = (o: [number, number], a: V, bv: V) => {
    const pa: [number, number] = [o[0] + a[0] * pk, o[1] - a[1] * pk], pb: [number, number] = [pa[0] + bv[0] * pk, pa[1] - bv[1] * pk];
    return { pa, pb };
  };
  const antes = tri([30, 110], [m1 * c.v1i[0], m1 * c.v1i[1]], [m2 * c.v2i[0], m2 * c.v2i[1]]);
  const desp = tri([230, 110], [m1 * c.v1f[0], m1 * c.v1f[1]], [m2 * c.v2f[0], m2 * c.v2f[1]]);

  return (
    <div className="space-y-3">
      {setParams && (
        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Tipo de choque">
          <span className="text-gray-600 dark:text-gray-300">Tipo de choque:</span>
          {TIPOS.map((t) => (
            <button key={t.label} className={Math.abs(e - t.e) < 1e-9 ? 'btn-primario py-1' : 'btn-secundario py-1'} aria-pressed={Math.abs(e - t.e) < 1e-9}
              onClick={() => setParams({ ...params, e: t.e })}>{t.label}</button>
          ))}
        </div>
      )}
      {!c.choca && <Notice>Con estos valores los discos no se tocan: el parámetro de impacto es demasiado grande o no se acercan. Para que choquen, |b| debe ser menor que 2R = {fmtNum(2 * R)} m (con el disco 2 en reposo).</Notice>}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
        aria-label={`Vista desde arriba. ${s.despues ? 'Después' : 'Antes'} del choque. v₁ = ${fmtNum(modulo(vel1))} m/s a ${fmtNum(anguloGrados(vel1), 0)}°, v₂ = ${fmtNum(modulo(vel2))} m/s a ${fmtNum(anguloGrados(vel2), 0)}°.`}>
        <polyline fill="none" stroke={c1} strokeOpacity={0.35} strokeDasharray="4 4" points={tray.muestras.slice(0, idx + 1).map((q) => `${X(q.x1)},${Y(q.x1)}`).join(' ')} />
        <polyline fill="none" stroke={c2} strokeOpacity={0.35} strokeDasharray="4 4" points={tray.muestras.slice(0, idx + 1).map((q) => `${X(q.x2)},${Y(q.x2)}`).join(' ')} />
        {c.choca && s.despues && c.n && (() => { const q = tray.muestras.find((x) => x.despues)!; const mid: V = [(q.x1[0] + q.x2[0]) / 2, (q.x1[1] + q.x2[1]) / 2];
          return <line x1={X(mid) - c.n[0] * 60} y1={Y(mid) + c.n[1] * 60} x2={X(mid) + c.n[0] * 60} y2={Y(mid) - c.n[1] * 60} stroke={tinta} strokeDasharray="2 3" />; })()}
        <circle cx={X(s.x1)} cy={Y(s.x1)} r={R * k} fill={c1} fillOpacity={0.85} />
        <text x={X(s.x1)} y={Y(s.x1) + 4} fontSize={12} textAnchor="middle" fill="#fff">1</text>
        <circle cx={X(s.x2)} cy={Y(s.x2)} r={R * k} fill={c2} fillOpacity={0.85} />
        <text x={X(s.x2)} y={Y(s.x2) + 4} fontSize={12} textAnchor="middle" fill="#fff">2</text>
        {flecha(s.x1, vel1, c1, 'v₁')}
        {flecha(s.x2, vel2, c2, 'v₂')}
        <text x={12} y={18} fontSize={11} fill={tinta}>Vista desde arriba (sin fricción) · {s.despues ? 'después del choque' : 'antes del choque'} · e = {fmtNum(e)}{c.choca && s.despues ? ' · línea punteada: dirección del impulso' : ''}</text>
      </svg>
      <Controles clock={clock} tEnd={tray.tFin} />

      {c.choca && (
        <>
          <Lecturas title="Velocidades" items={[
            { label: 'v₁ antes', value: `${fmtNum(modulo(c.v1i))} m/s a ${fmtNum(anguloGrados(c.v1i), 1)}°` },
            { label: 'v₂ antes', value: `${fmtNum(modulo(c.v2i))} m/s a ${fmtNum(anguloGrados(c.v2i), 1)}°` },
            { label: "v₁' después", value: `${fmtNum(modulo(c.v1f))} m/s a ${fmtNum(anguloGrados(c.v1f), 1)}°` },
            { label: "v₂' después", value: `${fmtNum(modulo(c.v2f))} m/s a ${fmtNum(anguloGrados(c.v2f), 1)}°` },
            ...(c.anguloEntreFinales !== null ? [{ label: 'Ángulo entre v₁\' y v₂\'', value: c.anguloEntreFinales, unit: '°' }] : []),
          ]} />
          <Lecturas title="Conservación" items={[
            { label: 'pₓ antes → después', value: `${fmtNum(c.pIni[0])} → ${fmtNum(c.pFin[0])}`, unit: 'kg·m/s' },
            { label: 'p_y antes → después', value: `${fmtNum(c.pIni[1])} → ${fmtNum(c.pFin[1])}`, unit: 'kg·m/s' },
            { label: 'K antes', value: c.Kini, unit: 'J' },
            { label: 'K después', value: c.Kfin, unit: 'J' },
            { label: 'K transformada', value: c.Kini - c.Kfin, unit: 'J' },
            { label: '|J| (impulso)', value: modulo(c.J!), unit: 'N·s' },
          ]} />
          {!compact && (
            <svg viewBox="0 0 440 160" className="w-full max-w-xl rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-primario-950" role="img"
              aria-label="Diagrama de cantidad de movimiento: la suma p₁ + p₂ es la misma antes y después del choque.">
              <text x={30} y={18} fontSize={11} fill={tinta}>Antes: p₁ + p₂</text>
              <text x={230} y={18} fontSize={11} fill={tinta}>Después: p₁' + p₂'</text>
              <Flecha x1={30} y1={110} x2={antes.pa[0]} y2={antes.pa[1]} color={c1} label="p₁" />
              <Flecha x1={antes.pa[0]} y1={antes.pa[1]} x2={antes.pb[0]} y2={antes.pb[1]} color={c2} label="p₂" />
              <Flecha x1={30} y1={110} x2={antes.pb[0]} y2={antes.pb[1]} color={cp} label="p" />
              <Flecha x1={230} y1={110} x2={desp.pa[0]} y2={desp.pa[1]} color={c1} label="p₁'" />
              <Flecha x1={desp.pa[0]} y1={desp.pa[1]} x2={desp.pb[0]} y2={desp.pb[1]} color={c2} label="p₂'" />
              <Flecha x1={230} y1={110} x2={desp.pb[0]} y2={desp.pb[1]} color={cp} label="p" />
            </svg>
          )}
        </>
      )}
      <p className="text-xs text-gray-500">
        Observe: el impulso actúa a lo largo de la línea que une los centros en el contacto, así que la componente de cada velocidad perpendicular a esa línea no cambia.
        La cantidad de movimiento total (flecha verde) es la misma antes y después; la energía cinética solo se conserva si e = 1. Con masas iguales, choque elástico y el
        disco 2 en reposo, los discos salen formando 90°.
      </p>
    </div>
  );
}
