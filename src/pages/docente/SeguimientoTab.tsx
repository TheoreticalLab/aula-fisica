/** Pestaña «Seguimiento» de una sección: estudiantes que pueden necesitar apoyo, con el motivo y un acceso directo. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { gradebook } from '@/api/docente';
import { rpc } from '@/lib/supabase';
import { CAIDA_RELEVANTE, HORAS_URGENTE, seguimientoSeccion, UMBRAL_APROBACION, type TipoAlerta } from '@/lib/seguimiento';
import { porcentaje, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Notice, Spinner } from '@/components/ui';

const ETIQUETA: Record<TipoAlerta, { texto: string; tono: 'red' | 'amber' | 'blue' | 'gray' | 'purple' }> = {
  no_entrego: { texto: 'No entregó', tono: 'red' },
  cierra_pronto: { texto: 'Cierra pronto', tono: 'amber' },
  promedio_bajo: { texto: 'Promedio bajo', tono: 'purple' },
  bajando: { texto: 'Notas bajando', tono: 'blue' },
  en_curso_vencido: { texto: 'Intento abierto', tono: 'gray' },
};

export function TabSeguimiento({ classId }: { classId: string }) {
  const gb = useAsync(() => gradebook(classId), [classId]);
  const action = useAction();
  const [enviado, setEnviado] = useState<Record<string, boolean>>({});
  if (gb.loading) return <Spinner />;
  if (gb.error) return <ErrorBox error={gb.error} onRetry={gb.reload} />;
  const lista = seguimientoSeccion(gb.data!);
  const total = gb.data!.students.filter((s) => s.active !== false).length;
  async function escribir(userId: string, nombre: string) {
    const texto = window.prompt(`Mensaje para ${nombre}:`, 'Hola, ¿cómo va con el curso? Si necesita ayuda con alguna actividad, escríbame o pase por la tutoría.');
    if (!texto?.trim()) return;
    const r = await action.run(() => rpc<{ recipients: number }>('send_live_message', {
      p_kind: 'informativo', p_body: texto.trim(), p_mode: 'seleccion', p_users: [userId], p_class: null, p_expires_minutes: 4320,
    }));
    if (r) setEnviado((x) => ({ ...x, [userId]: true }));
  }
  return (
    <div className="space-y-4">
      <Notice>
        Avisos para acompañar a sus estudiantes, calculados con sus entregas y calificaciones. No son juicios ni indicadores de conducta.
        Reglas: actividad cerrada sin entregar · actividad que cierra en menos de {HORAS_URGENTE} h sin entregar · promedio por debajo del {Math.round(100 * UMBRAL_APROBACION)} % (con al menos 2 notas) ·
        dos últimas notas {Math.round(100 * CAIDA_RELEVANTE)} puntos por debajo de las anteriores.
      </Notice>
      <ErrorBox error={action.error} />
      <Card title={`Pueden necesitar apoyo (${lista.length} de ${total})`}>
        {lista.length ? (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {lista.map((s) => (
              <li key={s.user_id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="enlace font-medium" to={`/docente/clases/${classId}/estudiantes/${s.user_id}`}>{s.nombre}</Link>
                  {s.grupo && <span className="text-xs text-gray-500">{s.grupo}</span>}
                  {s.alertas.map((a) => <Badge key={a.tipo} tone={ETIQUETA[a.tipo].tono}>{ETIQUETA[a.tipo].texto}</Badge>)}
                  <span className="ml-auto text-xs text-gray-500">{s.entregadas}/{s.asignadas} calificadas · promedio {porcentaje(s.promedio)}</span>
                </div>
                <ul className="mt-1 list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">{s.alertas.map((a) => <li key={a.tipo}>{a.texto}</li>)}</ul>
                <div className="mt-2 flex gap-2">
                  <button className="btn-secundario !min-h-[36px] text-xs" disabled={action.busy || enviado[s.user_id]} onClick={() => void escribir(s.user_id, s.nombre)}>
                    {enviado[s.user_id] ? 'Mensaje enviado ✓' : '📢 Escribirle'}
                  </button>
                  <Link className="btn-texto !min-h-[36px] text-xs" to={`/docente/clases/${classId}/estudiantes/${s.user_id}`}>Ver ficha</Link>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty>Ningún estudiante tiene avisos ahora. ✓</Empty>}
      </Card>
    </div>
  );
}
