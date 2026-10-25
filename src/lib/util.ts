import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Carga de datos asíncrona
// ---------------------------------------------------------------------------
export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T) => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await fn();
      if (my === seq.current) setData(d);
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void run();
  }, [run]);
  return { data, error, loading, reload: run, setData };
}

/** Ejecuta una acción mostrando estado de «ocupado» y error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

/** Valor con retardo (para guardar borradores sin saturar al servidor). */
export function useDebouncedEffect(effect: () => void, deps: unknown[], ms: number) {
  useEffect(() => {
    const t = setTimeout(effect, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, ms]);
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------
const fechaFmt = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' });
const fechaCorta = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' });

export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  return fechaFmt.format(new Date(iso));
}

export function fechaBreve(iso: string | null | undefined): string {
  if (!iso) return '—';
  return fechaCorta.format(new Date(iso));
}

/** «en 3 días», «hace 2 horas»… */
export function relativo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 3600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3600_000), 'hour');
  return rtf.format(Math.round(diff / 86_400_000), 'day');
}

/** ISO → valor para <input type="datetime-local"> en hora local. */
export function aInputFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function deInputFecha(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function puntaje(score: number | null | undefined, max: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  const s = Number(score);
  const m = Number(max ?? 0);
  return m > 0 ? `${redondear(s)} / ${redondear(m)}` : `${redondear(s)}`;
}

export function porcentaje(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return `${Math.round(Number(x) * 100)} %`;
}

export function redondear(x: number, d = 2): string {
  return String(Math.round(x * 10 ** d) / 10 ** d);
}

// ---------------------------------------------------------------------------
// CSV (Excel en español usa «;» como separador)
// ---------------------------------------------------------------------------
export function toCsv(rows: (string | number | null | undefined)[][], sep = ';'): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    // evita la inyección de fórmulas en hojas de cálculo
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[";\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((r) => r.map(esc).join(sep)).join('\r\n');
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const DIFICULTAD: Record<string, string> = { basico: 'Básico', intermedio: 'Intermedio', desafiante: 'Desafiante' };
export const CATEGORIA: Record<string, string> = {
  seleccion: 'Selección múltiple',
  vf_justificacion: 'Verdadero o falso',
  numerica: 'Respuesta numérica',
  grafica: 'Interpretación de gráficas',
  conceptual: 'Pregunta conceptual',
  error: 'Identificación de errores',
  desarrollo: 'Problema desarrollado',
  experimento: 'Basada en un experimento',
};
export const FORMATO: Record<string, string> = {
  choice: 'Opciones',
  truefalse: 'Verdadero/falso',
  numeric: 'Numérica',
  text: 'Texto corto',
  open: 'Desarrollo (manual)',
};
