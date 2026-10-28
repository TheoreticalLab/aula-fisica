/**
 * LIEIA · Pestaña «Calibración de ítems»: estima dificultad, discriminación y tiempos de cada pregunta de una
 * asignatura con las respuestas históricas seudonimizadas (2PL por máxima verosimilitud marginal) y la guarda.
 * El estado de cada parámetro (calibrado / provisional / no calibrado) lo decide el servidor con reglas fijas.
 */
import { useMemo, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { teacherOverview } from '@/api/docente';
import { useAction, useAsync } from '@/lib/util';
import { enTrabajador } from '@/lib/lieia/cliente';
import type { Calibracion } from '@/lib/lieia/diseno';
import { prepararCalibracion, type FilaBanco, type RespuestaHistorica as Resp } from '@/lib/lieia/calibracionDatos';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';
import validacionCal from '@/lib/lieia/calibracion.json';

const TONO: Record<string, 'green' | 'amber' | 'gray'> = { calibrado: 'green', provisional: 'amber', no_calibrado: 'gray' };

export function Calibracion() {
  const secciones = useAsync(teacherOverview, []);
  const cursos = useMemo(() => [...new Map((secciones.data ?? []).map((s) => [s.course_id, s.course_title])).entries()], [secciones.data]);
  const [curso, setCurso] = useState('');
  const banco = useAsync(() => (curso ? rpc<FilaBanco[]>('calibration_bank', { p_course: curso }) : Promise.resolve([] as FilaBanco[])), [curso]);
  const [nueva, setNueva] = useState<{ items: Calibracion[]; ids: string[]; estudiantes: number; respuestas: number; tiempos: number } | null>(null);
  const accion = useAction();
  const [guardado, setGuardado] = useState<string | null>(null);

  async function calibrar() {
    setGuardado(null);
    await accion.run(async () => {
      const resp = await rpc<Resp[]>('calibration_data', { p_course: curso });
      const { datos, ids } = prepararCalibracion(banco.data ?? [], resp);
      if (datos.estudiantes < 10) throw new Error(`Solo hay respuestas de ${datos.estudiantes} estudiante(s): se necesitan al menos 10 para calibrar.`);
      const r = await enTrabajador<{ items: Calibracion[] }>({ tipo: 'calibrar', datos }).promesa;
      setNueva({ items: r.items, ids, estudiantes: datos.estudiantes, respuestas: datos.respuestas.length, tiempos: datos.duraciones.length });
    });
  }
  async function guardar() {
    if (!nueva) return;
    await accion.run(async () => {
      const items = nueva.items.map((c, k) => ({ exercise_id: nueva.ids[k], a: c.a, b: c.b, se_a: c.se_a, se_b: c.se_b,
        beta_t: Number.isFinite(c.beta_t) ? c.beta_t : null, sigma_t: Number.isFinite(c.sigma_t) ? c.sigma_t : null, n_resp: c.n_resp, n_tiempos: c.n_tiempos }))
        .filter((x) => x.n_resp > 0);
      const n = await rpc<number>('calibration_save', { p_course: curso, p_items: items });
      setGuardado(`Calibración guardada para ${n} preguntas.`);
      setNueva(null);
      await banco.reload();
    });
  }
  const v = validacionCal as { replicas: number; resultados: { n: number; rmseB: number; coberturaB: number; coberturaA: number }[] };

  return (
    <div className="space-y-4">
      <Card title="Calibrar las preguntas de una asignatura">
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">Usa las respuestas ya dadas (prácticas y evaluaciones; primer intento de cada estudiante en cada pregunta), seudonimizadas en el servidor. Estima la dificultad <em>b</em>, la discriminación <em>a</em> y el tiempo típico de cada pregunta, con su error típico.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Asignatura
            <select className="campo" value={curso} onChange={(e) => { setCurso(e.target.value); setNueva(null); }}>
              <option value="">Elija…</option>
              {cursos.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
            </select>
          </label>
          <button className="btn-primario" disabled={!curso || accion.busy} onClick={() => void calibrar()}>{accion.busy ? 'Calibrando…' : 'Calibrar con las respuestas reales'}</button>
          {nueva && <button className="btn-secundario" disabled={accion.busy} onClick={() => void guardar()}>Guardar esta calibración</button>}
        </div>
        <ErrorBox error={accion.error || banco.error} />
        {guardado && <Notice tone="ok">{guardado}</Notice>}
        {nueva && <p className="mt-2 text-sm">{nueva.estudiantes} estudiantes · {nueva.respuestas} respuestas · {nueva.tiempos} tiempos por pregunta. Revise y guarde.</p>}
        <p className="mt-2 text-xs text-gray-500">
          Reglas de estado (las aplica el servidor): <Badge tone="green">calibrado</Badge> ≥ 100 respuestas, ET(b) ≤ 0,30 y ET(a) ≤ 0,35 · <Badge tone="amber">provisional</Badge> ≥ 20 respuestas y ET(b) ≤ 0,80 · <Badge>no calibrado</Badge> en otro caso (el diseñador usa entonces un a priori según la etiqueta de dificultad).
          Validación en laboratorio ({v.replicas} réplicas): {v.resultados.map((r) => `con ${r.n} estudiantes, error de b ${r.rmseB.toFixed(2)} y cobertura del IC 95 % ${(100 * r.coberturaB).toFixed(0)} %`).join('; ')} (docs/LIEIA_CALIBRACION.md).
        </p>
      </Card>
      {curso && (banco.loading ? <Spinner /> : (
        <Card title={`Banco de preguntas · ${(banco.data ?? []).length}`}>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Pregunta</th><th>Etiqueta</th><th className="text-right">b ± ET</th><th className="text-right">a ± ET</th><th className="text-right">Tiempo</th><th className="text-right">n</th><th>Estado</th></tr></thead>
              <tbody>{(banco.data ?? []).map((it) => {
                const k = nueva?.ids.indexOf(it.exercise_id) ?? -1;
                const c = k >= 0 && nueva!.items[k].n_resp > 0 ? nueva!.items[k] : it.calibracion;
                return (
                  <tr key={it.exercise_id} className="border-b border-gray-100 dark:border-white/5">
                    <td className="max-w-md py-1 text-xs">{it.titulo}<span className="block text-gray-500">{it.leccion ?? '—'} · {it.formato}</span></td>
                    <td className="text-xs">{it.dificultad}</td>
                    <td className="text-right tabular-nums">{c ? <>{c.b.toFixed(2)} <span className="text-xs text-gray-500">± {c.se_b.toFixed(2)}</span></> : '—'}</td>
                    <td className="text-right tabular-nums">{c ? <>{c.a.toFixed(2)} <span className="text-xs text-gray-500">± {c.se_a.toFixed(2)}</span></> : '—'}</td>
                    <td className="text-right tabular-nums">{c && Number.isFinite(c.beta_t) && c.beta_t !== null ? `${Math.round(Math.exp(c.beta_t))} s` : '—'}</td>
                    <td className="text-right tabular-nums">{c?.n_resp ?? 0}</td>
                    <td>{c ? <Badge tone={TONO[c.estado]}>{c.estado.replace('_', ' ')}{k >= 0 ? ' (nuevo)' : ''}</Badge> : <Badge>sin datos</Badge>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
