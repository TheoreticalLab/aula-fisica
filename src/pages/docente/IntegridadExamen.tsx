/**
 * Panel docente · protección de una evaluación (migración 85): por estudiante, salidas, reingresos y bloqueo activo
 * (con «Liberar», la misma liberación de Comunicación y Orbe Control) e intentos de pegar, arrastrar o copiar.
 * Solo se muestra si la evaluación tiene alguna protección o si hubo eventos.
 */
import { useState } from 'react';
import { examIntegridadResumen, funcionAusente, type FilaIntegridad } from '@/api/examen';
import { rpc } from '@/lib/supabase';
import { fecha, useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox } from '@/components/ui';

const MOTIVO: Record<string, string> = {
  oculta: 'cambió de pestaña o de aplicación', sin_foco: 'más de 5 s fuera de la página', cierre: 'cerró o recargó la página',
  navegacion: 'fue a otra página del aula', reapertura: 'volvió a abrir el examen',
};
const TIPO: Record<string, string> = { salida: 'Salida', reingreso: 'Reingreso', pegado: 'Intentó pegar', arrastre: 'Intentó arrastrar', copia: 'Intentó copiar' };

export function IntegridadExamen({ activityId }: { activityId: string }) {
  const st = useAsync(() => examIntegridadResumen(activityId), [activityId]);
  const accion = useAction();
  const [abierto, setAbierto] = useState<string | null>(null);
  if (st.error) return funcionAusente(st.error) ? null : <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!st.data) return null;
  const { config, estudiantes } = st.data;
  const conEventos = estudiantes.filter((e) => e.salidas + e.reingresos + e.pegados + e.arrastres + e.copias > 0 || e.lock_id);
  if (!config?.bloquear_al_salir && !config?.impedir_copiar && conEventos.length === 0) return null;
  const liberar = (f: FilaIntegridad) => accion.run(async () => { await rpc('release_screen_lock', { p_lock: f.lock_id }); st.reload(); });

  return (
    <Card className="mt-4" title={<span>Protección del examen {config?.bloquear_al_salir && <Badge tone="amber">bloquear al salir</Badge>} {config?.impedir_copiar && <Badge tone="purple">sin copiar ni pegar</Badge>}</span>}
      actions={<button className="btn-texto text-sm" onClick={st.reload}>Actualizar</button>}>
      {conEventos.length === 0 ? <p className="text-sm text-gray-500">Nadie ha salido ni intentado copiar o pegar.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500">
              <th className="py-2 pr-3">Estudiante</th><th className="py-2 pr-3 text-right">Salidas</th><th className="py-2 pr-3 text-right">Reingresos</th>
              <th className="py-2 pr-3 text-right">Pegar / arrastrar</th><th className="py-2 pr-3 text-right">Copiar</th><th className="py-2 pr-3">Estado</th><th />
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {conEventos.map((f) => (
                <FilaEstudiante key={f.attempt_id} f={f} abierto={abierto === f.attempt_id} onAbrir={() => setAbierto(abierto === f.attempt_id ? null : f.attempt_id)}
                  onLiberar={() => void liberar(f)} ocupado={accion.busy} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ErrorBox error={accion.error} />
      <p className="mt-2 text-xs text-gray-500">Liberar quita el bloqueo sin código. El estudiante sigue donde estaba; el tiempo perdido no se devuelve (puede darle una prórroga en el monitor).</p>
    </Card>
  );
}

function FilaEstudiante({ f, abierto, onAbrir, onLiberar, ocupado }: { f: FilaIntegridad; abierto: boolean; onAbrir: () => void; onLiberar: () => void; ocupado: boolean }) {
  return (
    <>
      <tr>
        <td className="py-2 pr-3"><button className="enlace text-left" onClick={onAbrir}>{f.nombre || '(sin nombre)'}</button>
          <span className="block text-xs text-gray-500">{f.matricula ?? ''}{f.ultima_salida && ` · última salida ${fecha(f.ultima_salida)}`}</span></td>
        <td className="py-2 pr-3 text-right tabular-nums">{f.salidas}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{f.reingresos}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{f.pegados + f.arrastres}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{f.copias}</td>
        <td className="py-2 pr-3">{f.lock_id ? <Badge tone="red">Bloqueado</Badge> : f.estado === 'in_progress' ? <Badge tone="blue">En curso</Badge> : <Badge tone="green">Entregado</Badge>}</td>
        <td className="py-2 text-right">{f.lock_id && <button className="btn-secundario !py-1 text-xs" disabled={ocupado} onClick={onLiberar}>Liberar</button>}</td>
      </tr>
      {abierto && (
        <tr><td colSpan={7} className="pb-3">
          <ol className="ml-4 list-decimal space-y-0.5 text-xs text-gray-600 dark:text-gray-300">
            {f.detalle.map((d, i) => <li key={i}>{fecha(d.en)} · {TIPO[d.tipo] ?? d.tipo}{d.motivo && ` (${MOTIVO[d.motivo] ?? d.motivo})`}</li>)}
          </ol>
        </td></tr>
      )}
    </>
  );
}
