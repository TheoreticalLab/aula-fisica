/** LIEIA · Gráficos del panel (recharts, ya usado en el aula, y SVG propio para matrices y grafos). */
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { useDark } from '@/lib/tema';

/** Colores por detector (fijos: el color sigue al detector, no a su posición). */
export const COLOR: Record<string, [string, string]> = {
  d1: ['#335ca6', '#86a6e0'], d2: ['#c99325', '#e3bd63'], d3: ['#2f8f6b', '#6fcfa6'], d4: ['#7b4fa0', '#b393d6'],
  d5: ['#b4475a', '#e48a9b'], d6: ['#1f7a8c', '#6ec3d4'], d7: ['#6b7280', '#a5abb6'],
};
export function useTema() {
  const dark = useDark();
  return {
    dark,
    color: (d: string) => COLOR[d]?.[dark ? 1 : 0] ?? '#888',
    texto: dark ? '#d1d5db' : '#374151',
    rejilla: dark ? '#ffffff1a' : '#00000014',
    tip: { background: dark ? '#0b1730' : '#fff', border: '1px solid #8884', fontSize: 12 },
  };
}

export function HistogramaNulo({ datos, color }: { datos: number[]; color: string }) {
  const t = useTema();
  const total = datos.reduce((s, x) => s + x, 0) || 1;
  const filas = datos.map((n, k) => ({ tramo: `${(k / 10).toFixed(1)}–${((k + 1) / 10).toFixed(1)}`, frac: n / total }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={filas}>
        <CartesianGrid stroke={t.rejilla} vertical={false} />
        <XAxis dataKey="tramo" tick={{ fill: t.texto, fontSize: 9 }} />
        <YAxis tick={{ fill: t.texto, fontSize: 10 }} tickFormatter={(v) => `${Math.round(v * 100)} %`} />
        <Tooltip contentStyle={t.tip} formatter={(v) => [`${(Number(v) * 100).toFixed(1)} %`, 'Valores p']} />
        <ReferenceLine y={0.1} stroke={t.texto} strokeDasharray="4 3" label={{ value: 'uniforme', fill: t.texto, fontSize: 10, position: 'insideTopRight' }} />
        <Bar dataKey="frac" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CurvasRoc({ curvas }: { curvas: { d: string; nombre: string; puntos: { fpr: number; tpr: number }[] }[] }) {
  const t = useTema();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart margin={{ right: 8 }}>
        <CartesianGrid stroke={t.rejilla} />
        <XAxis type="number" dataKey="fpr" domain={[0, 1]} tick={{ fill: t.texto, fontSize: 10 }} label={{ value: 'falsos positivos', fill: t.texto, fontSize: 10, position: 'insideBottom', offset: -2 }} />
        <YAxis type="number" dataKey="tpr" domain={[0, 1]} tick={{ fill: t.texto, fontSize: 10 }} label={{ value: 'detectados', angle: -90, fill: t.texto, fontSize: 10, position: 'insideLeft' }} />
        <Tooltip contentStyle={t.tip} formatter={(v: number) => v.toFixed(2)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]} dataKey="tpr" name="azar" stroke={t.texto} strokeDasharray="4 3" dot={false} />
        {curvas.map((c) => <Line key={c.d} data={c.puntos} dataKey="tpr" name={c.nombre} stroke={t.color(c.d)} strokeWidth={2} dot={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Fiabilidad({ tabla }: { tabla: { desde: number; n: number; predicha: number; observada: number }[] }) {
  const t = useTema();
  const filas = tabla.filter((x) => x.n > 0).map((x) => ({ predicha: x.predicha, observada: x.observada, n: x.n }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ right: 8 }}>
        <CartesianGrid stroke={t.rejilla} />
        <XAxis type="number" dataKey="predicha" domain={[0, 1]} tick={{ fill: t.texto, fontSize: 10 }} name="predicha" />
        <YAxis type="number" dataKey="observada" domain={[0, 1]} tick={{ fill: t.texto, fontSize: 10 }} name="observada" />
        <ZAxis type="number" dataKey="n" range={[40, 400]} name="parejas" />
        <Tooltip contentStyle={t.tip} formatter={(v: number) => (Number.isInteger(v) ? v : v.toFixed(2))} />
        <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={t.texto} strokeDasharray="4 3" />
        <Scatter data={filas} fill={t.color('d1')} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function LineasBarrido({ filas, detectores, campo, nombres, etiquetaX }: { filas: { valor: number; detectores: Record<string, { fpr: number; potencia: number | null }> }[]; detectores: string[]; campo: 'fpr' | 'potencia'; nombres: Record<string, string>; etiquetaX: string }) {
  const t = useTema();
  const datos = filas.map((f) => ({ valor: f.valor, ...Object.fromEntries(detectores.map((d) => [d, f.detectores[d]?.[campo] ?? null])) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={datos} margin={{ right: 8 }}>
        <CartesianGrid stroke={t.rejilla} />
        <XAxis dataKey="valor" tick={{ fill: t.texto, fontSize: 10 }} label={{ value: etiquetaX, fill: t.texto, fontSize: 10, position: 'insideBottom', offset: -2 }} />
        <YAxis domain={[0, 1]} tick={{ fill: t.texto, fontSize: 10 }} tickFormatter={(v) => `${Math.round(v * 100)} %`} />
        <Tooltip contentStyle={t.tip} formatter={(v: number) => `${(v * 100).toFixed(1)} %`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {campo === 'fpr' && <ReferenceLine y={0.05} stroke={t.texto} strokeDasharray="4 3" />}
        {detectores.map((d) => <Line key={d} dataKey={d} name={nombres[d] ?? d} stroke={t.color(d)} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Matriz de parejas: intensidad = −log10(p); recuadro = dependencia real (solo en el laboratorio). */
export function MatrizParejas({ n, valor, marcadas, etiquetas }: { n: number; valor: (i: number, j: number) => number | null; marcadas?: Set<string>; etiquetas: string[] }) {
  const t = useTema();
  const c = Math.max(6, Math.min(14, Math.floor(420 / n)));
  const tam = c * n + 34;
  return (
    <svg width="100%" viewBox={`0 0 ${tam} ${tam}`} role="img" aria-label="Matriz de evidencia por pareja">
      {Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
        if (i === j) return null;
        const v = valor(Math.min(i, j), Math.max(i, j));
        const a = v === null ? 0 : Math.min(1, v / 4);
        const clave = `${Math.min(i, j)}-${Math.max(i, j)}`;
        return (
          <rect key={`${i}-${j}`} x={30 + j * c} y={30 + i * c} width={c - 1} height={c - 1} rx={1.5}
            fill={v === null ? (t.dark ? '#ffffff10' : '#00000008') : t.color('d1')} fillOpacity={v === null ? 1 : 0.08 + 0.92 * a}
            stroke={marcadas?.has(clave) ? (t.dark ? '#fbbf24' : '#b45309') : 'none'} strokeWidth={marcadas?.has(clave) ? 1.6 : 0}>
            <title>{`${etiquetas[i]} – ${etiquetas[j]}: ${v === null ? 'sin dato' : `−log10 p = ${v.toFixed(2)}`}`}</title>
          </rect>
        );
      }))}
      {etiquetas.map((e, k) => (k % Math.ceil(n / 12) === 0 ? <text key={k} x={30 + k * c + c / 2} y={24} fontSize={8} textAnchor="middle" fill={t.texto}>{e}</text> : null))}
    </svg>
  );
}

/** Grafo de dependencias en disposición circular; flecha = quién responde primero (D3). */
export function GrafoDependencias({ n, aristas, etiquetas, grado }: { n: number; aristas: { i: number; j: number; tipo: string; lider: number | null }[]; etiquetas: string[]; grado: number[] }) {
  const t = useTema();
  const R = 130, C = 160;
  const pos = (k: number) => ({ x: C + R * Math.cos((2 * Math.PI * k) / n - Math.PI / 2), y: C + R * Math.sin((2 * Math.PI * k) / n - Math.PI / 2) });
  const activos = new Set(aristas.flatMap((a) => [a.i, a.j]));
  return (
    <svg width="100%" viewBox="0 0 320 320" role="img" aria-label="Grafo de dependencias entre estudiantes">
      <defs>
        <marker id="flecha" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={t.texto} /></marker>
      </defs>
      {aristas.map((a, k) => {
        const [o, d] = a.lider === a.j ? [a.j, a.i] : [a.i, a.j];
        const p = pos(o), q = pos(d);
        return <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={t.color(a.tipo)} strokeWidth={2} strokeOpacity={0.85} markerEnd={a.lider !== null ? 'url(#flecha)' : undefined} />;
      })}
      {Array.from({ length: n }, (_, k) => {
        const p = pos(k);
        const on = activos.has(k);
        return (
          <g key={k}>
            <circle cx={p.x} cy={p.y} r={on ? 5 + Math.min(5, grado[k]) : 3} fill={on ? (t.dark ? '#f1f5f9' : '#111827') : (t.dark ? '#475569' : '#cbd5e1')} stroke={t.dark ? '#0b1730' : '#fff'} strokeWidth={2} />
            {on && <text x={p.x} y={p.y - 11} fontSize={9} textAnchor="middle" fill={t.texto}>{etiquetas[k]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Dispersion({ datos, x, y, etiquetaX, etiquetaY, color }: { datos: Record<string, number>[]; x: string; y: string; etiquetaX: string; etiquetaY: string; color: string }) {
  const t = useTema();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ right: 8 }}>
        <CartesianGrid stroke={t.rejilla} />
        <XAxis type="number" dataKey={x} name={etiquetaX} tick={{ fill: t.texto, fontSize: 10 }} label={{ value: etiquetaX, fill: t.texto, fontSize: 10, position: 'insideBottom', offset: -2 }} />
        <YAxis type="number" dataKey={y} name={etiquetaY} tick={{ fill: t.texto, fontSize: 10 }} label={{ value: etiquetaY, angle: -90, fill: t.texto, fontSize: 10, position: 'insideLeft' }} />
        <Tooltip contentStyle={t.tip} formatter={(v: number) => v.toFixed(2)} />
        <Scatter data={datos} fill={color} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function CurvaSupervivencia({ puntos, etiqueta }: { puntos: { t: number; s: number }[]; etiqueta: string }) {
  const t = useTema();
  const escalon = puntos.flatMap((p, k) => (k ? [{ t: p.t, s: puntos[k - 1].s }, p] : [p])).map((p) => ({ min: +(p.t / 60).toFixed(1), s: p.s }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={escalon} margin={{ right: 8 }}>
        <CartesianGrid stroke={t.rejilla} />
        <XAxis dataKey="min" type="number" tick={{ fill: t.texto, fontSize: 10 }} label={{ value: 'minutos desde el inicio', fill: t.texto, fontSize: 10, position: 'insideBottom', offset: -2 }} />
        <YAxis domain={[0, 1]} tick={{ fill: t.texto, fontSize: 10 }} tickFormatter={(v) => `${Math.round(v * 100)} %`} />
        <Tooltip contentStyle={t.tip} formatter={(v: number) => [`${(v * 100).toFixed(0)} %`, etiqueta]} />
        <Line dataKey="s" stroke={t.color('d6')} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
