import { useEffect, useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MasteryLevel } from '@/api/tipos';

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-gray-500 dark:text-gray-400" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primario-300 border-t-primario-700" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string | null | undefined; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="my-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-900/20 dark:text-red-200">
      {error}
      {onRetry && (
        <button className="ml-3 font-medium underline" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'ok' | 'warn' }) {
  const cls = {
    info: 'border-primario-200 bg-primario-50 text-primario-900 dark:border-primario-700 dark:bg-primario-900/40 dark:text-primario-100',
    ok: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-100',
    warn: 'border-acento-300 bg-acento-100 text-acento-700 dark:border-acento-600/50 dark:bg-acento-700/20 dark:text-acento-200',
  }[tone];
  return <div className={`my-3 rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">{children}</p>;
}

export function PageTitle({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-5">
      {back && (
        <Link to={back.to} className="mb-2 inline-block text-sm text-primario-700 hover:underline dark:text-primario-200">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primario-900 dark:text-white sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ title, children, className = '', actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`tarjeta ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-primario-900 dark:text-primario-100">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple' }) {
  const cls = {
    gray: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
    blue: 'bg-primario-100 text-primario-800 dark:bg-primario-800/60 dark:text-primario-100',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    amber: 'bg-acento-100 text-acento-700 dark:bg-acento-700/30 dark:text-acento-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    purple: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function ProgressBar({ value, label, tone = 'blue' }: { value: number; label?: string; tone?: 'blue' | 'green' | 'amber' }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const color = { blue: 'bg-primario-600 dark:bg-primario-400', green: 'bg-emerald-600', amber: 'bg-acento-500' }[tone];
  return (
    <div>
      {label && <div className="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-400"><span>{label}</span><span>{Math.round(v * 100)} %</span></div>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10" role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  dominado: 'Dominado',
  en_progreso: 'En progreso',
  dificultad: 'Con dificultad',
  pocos_datos: 'Pocos datos',
};

export function MasteryBadge({ level }: { level: MasteryLevel }) {
  const tone = { dominado: 'green', en_progreso: 'blue', dificultad: 'red', pocos_datos: 'gray' }[level] as 'green' | 'blue' | 'red' | 'gray';
  return <Badge tone={tone}>{LEVEL_LABEL[level]}</Badge>;
}

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="mb-3">
      <label htmlFor={id} className="etiqueta">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; disabled?: boolean }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="-mx-4 mb-4 overflow-x-auto border-b border-gray-200 px-4 dark:border-white/10 sm:mx-0 sm:px-0" role="tablist">
      <div className="flex min-w-max gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={value === t.id}
            disabled={t.disabled}
            onClick={() => onChange(t.id)}
            className={`min-h-[44px] whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
              value === t.id
                ? 'border-acento-500 text-primario-900 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-primario-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-primario-950 sm:max-w-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-texto" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  switch (status) {
    case 'correct':
      return <Badge tone="green">Correcto</Badge>;
    case 'partial':
      return <Badge tone="amber">Parcial</Badge>;
    case 'incorrect':
      return <Badge tone="red">Incorrecto</Badge>;
    case 'revealed':
      return <Badge tone="purple">Solución vista</Badge>;
    case 'pending_review':
      return <Badge tone="blue">Pendiente de revisión</Badge>;
    case 'submitted':
      return <Badge tone="blue">Entregado</Badge>;
    case 'draft':
      return <Badge>Borrador</Badge>;
    default:
      return <Badge>Sin responder</Badge>;
  }
}
