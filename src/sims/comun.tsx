import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SimInfo } from './catalogo';
import { Markdown } from '@/components/Markdown';

/** Reloj de simulación: avanza el tiempo simulado con requestAnimationFrame hasta tEnd. */
export function useSimClock(tEnd: number, opts: { loop?: boolean } = {}) {
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const last = useRef<number | null>(null);
  const tRef = useRef(0);

  useEffect(() => {
    if (!running) {
      last.current = null;
      return;
    }
    let raf = 0;
    const step = (now: number) => {
      if (last.current !== null) {
        const dt = Math.min(0.1, (now - last.current) / 1000) * speed;
        let nt = tRef.current + dt;
        if (nt >= tEnd) {
          if (opts.loop) nt = nt % tEnd;
          else {
            nt = tEnd;
            setRunning(false);
          }
        }
        tRef.current = nt;
        setT(nt);
      }
      last.current = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, tEnd, opts.loop]);

  const reset = useCallback(() => {
    setRunning(false);
    tRef.current = 0;
    setT(0);
  }, []);
  const play = useCallback(() => {
    if (tRef.current >= tEnd) {
      tRef.current = 0;
      setT(0);
    }
    setRunning(true);
  }, [tEnd]);
  const seek = useCallback(
    (v: number) => {
      const nt = Math.max(0, Math.min(tEnd, v));
      tRef.current = nt;
      setT(nt);
    },
    [tEnd],
  );
  // si cambian los parámetros (tEnd), volver al inicio
  useEffect(() => reset(), [tEnd, reset]);
  return { t, running, play, pause: () => setRunning(false), reset, speed, setSpeed, seek };
}

export type Clock = ReturnType<typeof useSimClock>;

export function Controles({ clock, tEnd }: { clock: Clock; tEnd: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {clock.running ? (
        <button className="btn-primario" onClick={clock.pause}>
          ❚❚ Pausar
        </button>
      ) : (
        <button className="btn-primario" onClick={clock.play}>
          ▶ {clock.t > 0 && clock.t < tEnd ? 'Continuar' : 'Iniciar'}
        </button>
      )}
      <button className="btn-secundario" onClick={clock.reset}>
        ↺ Reiniciar
      </button>
      <label className="flex items-center gap-1 text-sm">
        Velocidad
        <select className="campo w-auto py-1" value={clock.speed} onChange={(e) => clock.setSpeed(Number(e.target.value))}>
          <option value={0.25}>×0.25</option>
          <option value={0.5}>×0.5</option>
          <option value={1}>×1</option>
          <option value={2}>×2</option>
        </select>
      </label>
      <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm">
        <span className="whitespace-nowrap tabular-nums">t = {clock.t.toFixed(2)} s</span>
        <input
          type="range"
          min={0}
          max={tEnd}
          step={tEnd / 500}
          value={clock.t}
          onChange={(e) => {
            clock.pause();
            clock.seek(Number(e.target.value));
          }}
          className="w-full accent-primario-700"
          aria-label="Instante de la simulación"
        />
      </label>
    </div>
  );
}

export function Deslizadores({
  info,
  params,
  onChange,
  disabled,
}: {
  info: SimInfo;
  params: Record<string, number>;
  onChange: (p: Record<string, number>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {info.params.map((p) => (
        <label key={p.name} className="block text-sm">
          <span className="flex justify-between gap-2">
            <span>{p.label}</span>
            <span className="flex items-center gap-1 tabular-nums">
              <input
                type="number"
                inputMode="decimal"
                className="campo w-20 px-2 py-0.5 text-right text-sm"
                value={params[p.name]}
                min={p.min}
                max={p.max}
                step={p.step}
                disabled={disabled}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) onChange({ ...params, [p.name]: Math.min(p.max, Math.max(p.min, v)) });
                }}
                aria-label={p.label}
              />
              <span className="w-10 text-gray-500">{p.unit}</span>
            </span>
          </span>
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.step}
            value={params[p.name]}
            disabled={disabled}
            onChange={(e) => onChange({ ...params, [p.name]: Number(e.target.value) })}
            className="mt-1 w-full accent-acento-500"
            aria-label={`${p.label} (deslizador)`}
          />
        </label>
      ))}
    </div>
  );
}

export interface Lectura {
  label: ReactNode;
  value: number | string | null;
  unit?: string;
  digits?: number;
}

export function Lecturas({ items, title = 'Lecturas' }: { items: Lectura[]; title?: string }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-300">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between gap-2 border-b border-dotted border-gray-200 py-0.5 dark:border-white/10">
            <dt className="text-gray-600 dark:text-gray-400">{it.label}</dt>
            <dd className="tabular-nums font-medium">
              {it.value === null ? '—' : typeof it.value === 'number' ? fmtNum(it.value, it.digits) : it.value}
              {it.unit && it.value !== null ? ` ${it.unit}` : ''}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function fmtNum(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '—';
  const r = Number(v.toFixed(digits));
  return (Object.is(r, -0) ? 0 : r).toFixed(digits);
}

export function TablaDatos({ cols, rows, title = 'Tabla de datos' }: { cols: { label: string; digits?: number }[]; rows: number[][]; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="btn-texto text-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? '▾' : '▸'} {title} ({rows.length} filas)
      </button>
      {open && (
        <div className="max-h-64 overflow-auto rounded border border-gray-200 dark:border-white/10">
          <table className="w-full text-right text-sm tabular-nums">
            <thead className="sticky top-0 bg-gray-100 dark:bg-primario-900">
              <tr>
                {cols.map((c) => (
                  <th key={c.label} className="px-2 py-1 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50 dark:odd:bg-transparent dark:even:bg-white/5">
                  {r.map((v, j) => (
                    <td key={j} className="px-2 py-0.5">
                      {fmtNum(v, cols[j].digits ?? 2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SimMarco({ info, children, compact }: { info: SimInfo; children: ReactNode; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      {!compact && <p className="text-sm text-gray-700 dark:text-gray-300">{info.description}</p>}
      {children}
      <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/5">
        <button className="font-medium text-primario-800 dark:text-primario-200" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? '▾' : '▸'} Modelo físico y simplificaciones
        </button>
        {open && (
          <div className="mt-2">
            <Markdown>{info.model}</Markdown>
            <ul className="mt-2 list-disc pl-5">
              {info.simplifications.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** Paso «redondo» (1, 2 o 5 × 10ⁿ) para unas `n` divisiones de un intervalo. */
export function pasoBonito(span: number, n = 5): number {
  if (!(span > 0)) return 1;
  const crudo = span / n;
  const p = Math.pow(10, Math.floor(Math.log10(crudo)));
  const m = crudo / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** Muestras uniformes de una función en [0, tEnd] para gráficas y tablas. */
export function muestrear<T>(tEnd: number, n: number, f: (t: number) => T): T[] {
  const out: T[] = [];
  for (let i = 0; i <= n; i++) out.push(f((tEnd * i) / n));
  return out;
}

/** Filas de tabla cada `dt` segundos. */
export function filasCada(tEnd: number, dt: number, f: (t: number) => number[]): number[][] {
  const rows: number[][] = [];
  const n = Math.floor(tEnd / dt + 1e-9);
  for (let i = 0; i <= n; i++) rows.push(f(Number((i * dt).toFixed(6))));
  if (Math.abs(n * dt - tEnd) > 1e-6) rows.push(f(tEnd));
  return rows;
}

/** Flecha SVG con punta. */
export function Flecha({ x1, y1, x2, y2, color, width = 2.5, label, labelOffset = 8 }: {
  x1: number; y1: number; x2: number; y2: number; color: string; width?: number; label?: string; labelOffset?: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(10, len * 0.4);
  const p1 = `${x2},${y2}`;
  const p2 = `${x2 - ux * h - uy * h * 0.5},${y2 - uy * h + ux * h * 0.5}`;
  const p3 = `${x2 - ux * h + uy * h * 0.5},${y2 - uy * h - ux * h * 0.5}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2 - ux * h * 0.8} y2={y2 - uy * h * 0.8} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={`${p1} ${p2} ${p3}`} fill={color} />
      {label && (
        <text x={x2 + ux * labelOffset} y={y2 + uy * labelOffset + 4} fill={color} fontSize={13} fontWeight={600} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}
