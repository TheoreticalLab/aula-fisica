/** Barras horizontales con signo (energías, trabajos): la escala es común a todas para poder compararlas. */
import { fmtNum } from './comun';

export interface Barra {
  label: string;
  value: number;
  color: string;
}

export function Barras({ items, unit = 'J', title, escala }: { items: Barra[]; unit?: string; title: string; escala?: number }) {
  const max = escala ?? Math.max(1e-9, ...items.map((b) => Math.abs(b.value)));
  const hayNegativos = items.some((b) => b.value < -1e-9);
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ul className="space-y-1.5">
        {items.map((b) => {
          const frac = Math.min(1, Math.abs(b.value) / max);
          return (
            <li key={b.label} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-2 text-xs sm:grid-cols-[9rem_1fr_6rem]">
              <span className="truncate">{b.label}</span>
              <span className={`relative h-4 rounded bg-gray-100 dark:bg-white/10 ${hayNegativos ? '' : ''}`}>
                {hayNegativos && <span className="absolute inset-y-0 left-1/2 w-px bg-gray-400" />}
                <span
                  className="absolute inset-y-0 rounded"
                  style={{
                    background: b.color,
                    width: `${(hayNegativos ? 50 : 100) * frac}%`,
                    left: hayNegativos ? (b.value >= 0 ? '50%' : `${50 - 50 * frac}%`) : 0,
                  }}
                />
              </span>
              <span className="text-right tabular-nums">{fmtNum(b.value)} {unit}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
