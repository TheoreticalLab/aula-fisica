/**
 * Suspensión automática por inactividad (migración 79), pestaña de Cuentas: interruptor y días (administrador),
 * estudiantes por días sin usar el aula, marcar las vencidas y reactivar. Los permisos los decide el servidor.
 */
import { useMemo, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { fecha, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Notice, Spinner } from '@/components/ui';

interface Config { activo: boolean; dias: number; activado_at: string | null; updated_at: string }
interface Fila {
  user_id: string; full_name: string; login_id: string | null; secciones: string | null; ultimo_uso: string | null; referencia: string;
  dias_sin_uso: number; estado: 'activa' | 'vencida' | 'suspendida_inactividad' | 'suspendida'; suspendida_at: string | null;
}
const ESTADO: Record<Fila['estado'], { texto: string; tono: 'green' | 'amber' | 'red' | 'gray' }> = {
  activa: { texto: 'Activa', tono: 'green' },
  vencida: { texto: 'Plazo vencido (se suspende al volver)', tono: 'amber' },
  suspendida_inactividad: { texto: 'Suspendida por inactividad', tono: 'red' },
  suspendida: { texto: 'Suspendida por el administrador', tono: 'gray' },
};
type Filtro = 'todas' | 'riesgo' | 'suspendidas';

export function Inactividad({ esAdmin }: { esAdmin: boolean }) {
  const cfg = useAsync(() => rpc<Config>('inactividad_estado'), []);
  const lista = useAsync(() => rpc<Fila[]>('inactividad_lista'), []);
  const [dias, setDias] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('riesgo');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const plazo = dias ?? cfg.data?.dias ?? 10;

  const xs = useMemo(() => (lista.data ?? []).filter((f) =>
    filtro === 'todas' ? true
      : filtro === 'suspendidas' ? f.estado === 'suspendida_inactividad' || f.estado === 'vencida'
      : f.estado === 'vencida' || f.estado === 'suspendida_inactividad' || (f.estado === 'activa' && f.dias_sin_uso >= Math.max(1, plazo - 3))), [lista.data, filtro, plazo]);

  async function hacer(fn: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setAviso(null);
    try {
      setAviso(await fn());
      await Promise.all([cfg.reload(), lista.reload()]);
      setSel(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (cfg.loading && !cfg.data) return <Spinner />;
  if (cfg.error) return <ErrorBox error={cfg.error} onRetry={() => void cfg.reload()} />;
  const c = cfg.data!;
  const reactivables = xs.filter((f) => f.estado === 'suspendida_inactividad' || f.estado === 'vencida');
  return (
    <div className="space-y-4">
      <Card title="Suspensión automática por inactividad">
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Una cuenta de <strong>estudiante</strong> que pasa {c.dias} días o más sin usar el aula queda suspendida. Uso = tener el aula abierta con la sesión
          iniciada; iniciar sesión no basta. Profesores y administradores nunca se suspenden. La reactiva usted aquí o en Cuentas, o el estudiante
          con «Recuperar acceso» (verificación en persona), si la recuperación está activada en su sección.
        </p>
        {esAdmin ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={c.activo} disabled={busy}
                onChange={(e) => void hacer(async () => { await rpc('inactividad_configurar', { p_activo: e.target.checked, p_dias: plazo }); return e.target.checked ? `Activada: ${plazo} días desde ahora para todos.` : 'En pausa: nadie se suspende.'; })} />
              Activada
            </label>
            <label className="flex items-center gap-2">Días:
              <input type="number" min={3} max={365} className="campo w-24" value={plazo} onChange={(e) => setDias(Math.max(3, Math.min(365, Number(e.target.value) || 10)))} />
            </label>
            <button className="btn-secundario" disabled={busy || plazo === c.dias}
              onClick={() => void hacer(async () => { await rpc('inactividad_configurar', { p_activo: null, p_dias: plazo }); return `Plazo: ${plazo} días.`; })}>Guardar días</button>
            {c.activo && (
              <button className="btn-secundario" disabled={busy}
                onClick={() => void hacer(async () => `${await rpc<number>('inactividad_aplicar')} cuenta(s) marcadas como suspendidas.`)}>Marcar ya las vencidas</button>
            )}
          </div>
        ) : <p className="text-sm">{c.activo ? `Activada (${c.dias} días).` : 'Desactivada.'} Solo el administrador la cambia.</p>}
        {c.activo && c.activado_at && <p className="mt-2 text-xs text-gray-500">Activada el {fecha(c.activado_at)}: nadie se suspende antes de {c.dias} días desde esa fecha. Pausarla y reanudarla (p. ej. tras vacaciones) da a todos {c.dias} días nuevos.</p>}
        {!c.activo && <Notice>Desactivada: ninguna cuenta se suspende por inactividad.</Notice>}
        <ErrorBox error={error} />
        {aviso && <Notice tone="ok">{aviso}</Notice>}
      </Card>

      <Card title="Estudiantes">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <select className="campo w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Filtro">
            <option value="riesgo">Vencidas, suspendidas y a 3 días o menos</option>
            <option value="suspendidas">Solo vencidas o suspendidas por inactividad</option>
            <option value="todas">Todas</option>
          </select>
          <button className="btn-primario" disabled={busy || sel.size === 0}
            onClick={() => void hacer(async () => `${await rpc<number>('inactividad_reactivar', { p_users: [...sel] })} cuenta(s) reactivada(s).`)}>
            Reactivar seleccionadas ({sel.size})
          </button>
          {reactivables.length > 0 && <button className="enlace" onClick={() => setSel(new Set(reactivables.map((f) => f.user_id)))}>Seleccionar todas las suspendidas</button>}
        </div>
        {lista.loading && !lista.data ? <Spinner /> : <ErrorBox error={lista.error} onRetry={() => void lista.reload()} />}
        {lista.data && xs.length === 0 && <Empty>No hay estudiantes en esta vista.</Empty>}
        <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
          {xs.map((f) => {
            const puede = f.estado === 'suspendida_inactividad' || f.estado === 'vencida';
            return (
              <li key={f.user_id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <label className="flex items-center gap-2">
                  <input type="checkbox" disabled={!puede} checked={sel.has(f.user_id)}
                    onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(f.user_id); else n.delete(f.user_id); return n; })} />
                  <span>{f.full_name || '(sin nombre)'} <span className="font-mono text-xs text-gray-500">{f.login_id}</span>
                    <span className="block text-xs text-gray-500">{f.secciones ?? 'Sin sección'} · último uso: {f.ultimo_uso ? fecha(f.ultimo_uso) : 'sin registro'}</span></span>
                </label>
                <span className="flex items-center gap-2 text-xs">{f.dias_sin_uso} día(s) <Badge tone={ESTADO[f.estado].tono}>{ESTADO[f.estado].texto}</Badge></span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-gray-500">Los días cuentan desde lo más reciente: último uso, creación de la cuenta o activación de la regla. «Sin registro» = no ha usado el aula desde que existe este control.</p>
      </Card>
    </div>
  );
}
