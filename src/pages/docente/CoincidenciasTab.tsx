/**
 * Panel docente · sección → «Coincidencias de archivos» (migración 67): imágenes o PDF que un estudiante intentó subir
 * y que coinciden con lo que ya subió OTRO estudiante de la asignatura. El archivo no se guardó. Si es un trabajo en
 * grupo, el profesor lo autoriza y el estudiante puede volver a subirlo.
 */
import { rpc } from '@/lib/supabase';
import { Badge, Empty, ErrorBox, Notice, Spinner } from '@/components/ui';
import { useAction, useAsync } from '@/lib/util';

interface Coincidencia {
  id: string; kind: 'captura' | 'foto_libre' | 'pdf'; estado: 'pendiente' | 'autorizada' | 'rechazada'; exacto: boolean; distancia: number; intentos: number;
  created_at: string; updated_at: string; nota: string | null; decided_at: string | null; estudiante: string | null; coincide_con: string | null;
  coincide_seccion: string | null; coincide_kind: string; coincide_vigente: boolean;
}
const TIPO: Record<string, string> = { captura: 'captura de envío', foto_libre: 'foto de práctica', pdf: 'PDF' };

export function TabCoincidencias({ classId }: { classId: string }) {
  const st = useAsync(() => rpc<Coincidencia[]>('huellas_solicitudes', { p_class: classId }), [classId]);
  const accion = useAction();
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const lista = st.data ?? [];
  const decidir = (c: Coincidencia, autorizar: boolean) => {
    const nota = window.prompt(autorizar ? 'Nota (opcional), p. ej. «trabajo en grupo»:' : 'Motivo del rechazo (opcional):', autorizar ? 'Trabajo en grupo' : '');
    if (nota === null) return;
    void accion.run(async () => { await rpc('huella_decidir', { p_id: c.id, p_autorizar: autorizar, p_nota: nota }); st.reload(); });
  };
  return (
    <div className="space-y-3">
      <Notice>Cada imagen y cada PDF que suben los estudiantes tiene una huella. Si coincide con lo que ya subió otro estudiante de la asignatura, el aula no lo guarda:
        <strong> exacta</strong> (el mismo archivo) o <strong>parecida</strong> (la misma imagen con otra resolución, compresión o formato). Una coincidencia no prueba
        por sí sola una copia: si es un trabajo en grupo, autorícela y el estudiante podrá volver a subirlo.</Notice>
      {lista.length === 0 ? <Empty>No hay coincidencias en esta sección.</Empty> : (
        <ul className="space-y-2">
          {lista.map((c) => (
            <li key={c.id} className="tarjeta text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={c.estado === 'pendiente' ? 'amber' : c.estado === 'autorizada' ? 'green' : 'gray'}>{c.estado}</Badge>
                <strong>{c.estudiante ?? '—'}</strong>
                <span>intentó subir {TIPO[c.kind]} {c.exacto ? <Badge tone="red">idéntica</Badge> : <Badge tone="purple">parecida ({c.distancia} de 64 bits distintos)</Badge>}</span>
                <span>· coincide con lo que subió <strong>{c.coincide_con ?? '—'}</strong>{c.coincide_seccion ? ` (${c.coincide_seccion})` : ''} como {TIPO[c.coincide_kind] ?? c.coincide_kind}</span>
                {!c.coincide_vigente && <Badge>el otro archivo ya no existe</Badge>}
              </div>
              <p className="mt-1 text-xs text-gray-500">{new Date(c.updated_at).toLocaleString('es-DO')} · {c.intentos} intento(s){c.nota ? ` · ${c.nota}` : ''}</p>
              {c.estado === 'pendiente' && (
                <div className="mt-2 flex gap-2">
                  <button className="btn-secundario !py-1 text-xs" disabled={accion.busy} onClick={() => decidir(c, true)}>Autorizar (trabajo en grupo)</button>
                  <button className="btn-texto text-xs" disabled={accion.busy} onClick={() => decidir(c, false)}>Rechazar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorBox error={accion.error} />
    </div>
  );
}
