/**
 * «Reutilizar de otras prácticas»: copia a esta práctica (en borrador) un problema de otra práctica extraordinaria del
 * profesor, tal como quedó (apartados, claves, explicaciones, tiempos). La copia es independiente. Migración 81.
 */
import { useMemo, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { Badge, Empty, ErrorBox, Notice, Spinner } from '@/components/ui';
import type { DetallePes } from '@/api/pesTipos';

interface Reutilizable {
  ejercicio_id: string; practica_id: string; practica_titulo: string; practica_estado: string; seccion: string; asignatura: string;
  titulo: string; contexto: string; apartados: number; formatos: string[]; tipo: string | null; dificultad: string | null; leccion: string | null;
  origen_ref: string | null; ya_en_esta: boolean;
}
const FORMATO: Record<string, string> = { numeric: 'numérica', choice: 'selección', truefalse: 'V/F', open: 'abierta', text: 'texto' };
const NIVEL: Record<string, string> = { basico: 'básico', intermedio: 'intermedio', desafiante: 'desafiante' };

export function ReutilizarPes({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const lista = useAsync(() => rpc<Reutilizable[]>('pes_reutilizables', { p_practica: d.practica.id }), [d.practica.id]);
  const [buscar, setBuscar] = useState('');
  const [practica, setPractica] = useState('');
  const [ocultarCopiados, setOcultarCopiados] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hechos, setHechos] = useState<Set<string>>(new Set());

  const practicas = useMemo(() => [...new Map((lista.data ?? []).map((x) => [x.practica_id, `${x.practica_titulo} · ${x.seccion}`])).entries()], [lista.data]);
  const b = buscar.trim().toLowerCase();
  const xs = (lista.data ?? []).filter((x) => (!practica || x.practica_id === practica) && (!ocultarCopiados || !(x.ya_en_esta || hechos.has(x.ejercicio_id)))
    && (!b || `${x.titulo} ${x.contexto} ${x.leccion ?? ''}`.toLowerCase().includes(b)));

  async function copiar(x: Reutilizable) {
    setBusy(x.ejercicio_id);
    setError(null);
    try {
      await rpc<string>('pes_ejercicio_reutilizar', { p_practica: d.practica.id, p_ejercicio: x.ejercicio_id });
      setHechos((s) => new Set(s).add(x.ejercicio_id));
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (lista.loading && !lista.data) return <Spinner />;
  if (lista.error) return <ErrorBox error={/Could not find the function|PGRST202/.test(lista.error) ? 'Falta instalar la migración 81 en el servidor.' : lista.error} onRetry={() => void lista.reload()} />;
  return (
    <div className="space-y-3">
      <Notice>
        Copie aquí problemas de sus otras prácticas extraordinarias (también de otra sección o asignatura), con sus apartados, claves, explicaciones y tiempos.
        La copia es independiente: puede editarla o quitarla sin afectar al original. Sin costo de IA.
      </Notice>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="campo" placeholder="Buscar por título, situación o lección" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar" />
        <select className="campo" value={practica} onChange={(e) => setPractica(e.target.value)} aria-label="Práctica de origen">
          <option value="">Todas las prácticas</option>
          {practicas.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ocultarCopiados} onChange={(e) => setOcultarCopiados(e.target.checked)} /> Ocultar los que ya están en esta práctica</label>
      </div>
      <ErrorBox error={error} />
      {xs.length === 0 && <Empty>{(lista.data ?? []).length === 0 ? 'No tiene otras prácticas extraordinarias con problemas.' : 'Ningún problema coincide con el filtro.'}</Empty>}
      <ul className="space-y-2">
        {xs.map((x) => {
          const copiado = x.ya_en_esta || hechos.has(x.ejercicio_id);
          return (
            <li key={x.ejercicio_id} className="tarjeta">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{x.titulo || '(sin título)'}</p>
                  <p className="text-xs text-gray-500">
                    De «{x.practica_titulo}» · {x.seccion}{x.asignatura ? ` · ${x.asignatura}` : ''}{x.leccion ? ` · ${x.leccion}` : ''}
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm text-gray-700 dark:text-gray-300">{x.contexto}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge>{x.apartados} apartados</Badge>
                    {x.dificultad && <Badge tone="blue">{NIVEL[x.dificultad] ?? x.dificultad}</Badge>}
                    {x.tipo && <Badge tone="purple">{x.tipo}</Badge>}
                    {(x.formatos ?? []).map((f, i) => <Badge key={i}>{String.fromCharCode(65 + i)}: {FORMATO[f] ?? f}</Badge>)}
                  </div>
                </div>
                {copiado
                  ? <Badge tone="green">Ya está en esta práctica</Badge>
                  : <button className="btn-primario" disabled={!!busy} onClick={() => void copiar(x)}>{busy === x.ejercicio_id ? 'Copiando…' : 'Añadir a esta práctica'}</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
