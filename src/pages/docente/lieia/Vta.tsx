/**
 * VTA · Verificación de Transferencia y Autonomía (migración 62). Forma parte de LIEIA pero está separada, en concepto
 * y en datos, de los indicadores de presunta irregularidad: compara lo entregado en prácticas con lo resuelto de forma
 * supervisada en Prácticas de Control confirmadas. Son señales pedagógicas con incertidumbre, nunca pruebas de uso de IA.
 */
import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { listMyTeachingClasses } from '@/api/docente';
import { controlSesiones, vtaEstudiante, vtaSeccion } from '@/api/control';
import { Badge, Card, Empty, ErrorBox, Notice, Spinner } from '@/components/ui';
import { SENAL_VTA, TIPO_TRANSFERENCIA } from '@/lib/control';
import { useAsync } from '@/lib/util';

export function Vta() {
  const { profile } = useAuth();
  const clases = useAsync(() => (profile ? listMyTeachingClasses(profile.id) : Promise.resolve([])), [profile?.id]);
  const [clase, setClase] = useState('');
  const [alumno, setAlumno] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Notice>VTA compara el rendimiento en prácticas con el rendimiento <strong>autónomo y supervisado</strong> en Prácticas de Control confirmadas. Una brecha es una
        señal pedagógica (conviene reforzar la resolución autónoma), no una demostración de fraude ni de uso de IA. Se ajusta por dificultad (0,10 por nivel cuando el control
        es más difícil que la práctica) y no se interpreta con menos de 3 controles. No forma parte de los detectores de integridad.</Notice>
      {clases.loading ? <Spinner /> : (
        <label className="text-sm"><span className="etiqueta">Sección</span>
          <select className="campo max-w-md" value={clase} onChange={(e) => { setClase(e.target.value); setAlumno(null); }}>
            <option value="">Elija una sección…</option>
            {(clases.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.term ? ` · ${c.term}` : ''}</option>)}
          </select></label>
      )}
      {clase && <Seccion classId={clase} onAlumno={setAlumno} />}
      {clase && alumno && <Estudiante classId={clase} userId={alumno} />}
    </div>
  );
}

function Seccion({ classId, onAlumno }: { classId: string; onAlumno: (u: string) => void }) {
  const st = useAsync(() => Promise.all([vtaSeccion(classId), controlSesiones(classId)]), [classId]);
  if (st.loading) return <Spinner />;
  if (st.error || !st.data) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const [d, sesiones] = st.data;
  const conDatos = d.estudiantes.filter((e) => e.controles > 0);
  return (
    <>
      <Card title={`Controles de la sección (${sesiones.length})`}>
        {sesiones.length === 0 ? <Empty>Aún no hay Prácticas de Control. Se activan en clase desde Orbe Control → Asistencia.</Empty> : (
          <ul className="space-y-1 text-sm">
            {sesiones.slice(0, 12).map((s) => (
              <li key={s.id} className="flex flex-wrap gap-2"><span>{new Date(s.preparado_at).toLocaleDateString('es-DO')}</span><strong>{s.practica}</strong>
                <Badge tone={s.estado === 'cerrado' ? 'green' : s.estado === 'cancelado' ? 'gray' : 'blue'}>{s.estado}</Badge>{s.recuperacion && <Badge tone="amber">recuperación</Badge>}
                <span className="text-gray-500">{s.entregados}/{s.asignados} entregados · {s.confirmados} confirmados</span></li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Prácticas frente a control supervisado">
        <p className="text-xs text-gray-500">{d.aviso} Cobertura = competencias verificadas (control ≥ 70) frente a las trabajadas en prácticas entregadas.</p>
        {conDatos.length === 0 && <p className="mt-2 text-sm text-gray-500">Sin controles confirmados todavía.</p>}
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Estudiante</th><th>Controles</th><th>Prácticas</th><th>Supervisado</th><th>Brecha (± 2 EE)</th><th>Competencias</th><th>Señal</th></tr></thead>
            <tbody>
              {d.estudiantes.map((e) => (
                <tr key={e.user_id} className="border-t border-gray-100 dark:border-white/5">
                  <td><button className="btn-texto" onClick={() => onAlumno(e.user_id)}>{e.nombre}</button></td>
                  <td>{e.controles}</td><td>{e.practica ?? '—'}</td><td>{e.supervisado ?? '—'}</td>
                  <td>{e.brecha === null ? '—' : `${e.brecha > 0 ? '+' : ''}${e.brecha}${e.brecha_ee !== null ? ` ± ${Math.round(2 * e.brecha_ee * 10) / 10}` : ''}`}</td>
                  <td>{e.competencias_verificadas} verificadas · {e.competencias_pendientes} pendientes</td>
                  <td className="text-xs">{SENAL_VTA[e.senal] ?? e.senal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Estudiante({ classId, userId }: { classId: string; userId: string }) {
  const st = useAsync(() => vtaEstudiante(classId, userId), [classId, userId]);
  if (st.loading) return <Spinner />;
  if (st.error || !st.data) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const h = st.data.historial;
  return (
    <Card title="Historial del estudiante (tendencia longitudinal)">
      {st.data.pendientes_de_confirmar > 0 && <Notice tone="warn">{st.data.pendientes_de_confirmar} control(es) sin confirmar: no se incluyen.</Notice>}
      {h.length === 0 ? <Empty>Sin controles confirmados.</Empty> : (
        <ol className="space-y-1 text-sm">
          {h.map((x) => (
            <li key={x.session_id} className="flex flex-wrap gap-2">
              <span>{new Date(x.fecha).toLocaleDateString('es-DO')}</span><strong>{x.practica}</strong>
              {x.competencia && <Badge tone="blue">{x.competencia}</Badge>}{x.recuperacion && <Badge tone="amber">recuperación</Badge>}
              <span>práctica {x.practica_pct ?? '—'} · control {x.control_pct ?? '—'}</span>
              <span className="text-xs text-gray-500">{TIPO_TRANSFERENCIA[x.tipo ?? ''] ?? x.tipo} · dificultad práctica {x.dif_practica ?? '—'} / control {x.dif_control ?? '—'}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs text-gray-500">{st.data.aviso}</p>
    </Card>
  );
}
