/**
 * Ficha del estudiante · «Mapa para tutoría» (migración 68): por concepto, lo que resuelve en práctica, en evaluaciones
 * y en las Prácticas de Control confirmadas, más la señal VTA de la sección, en una sola vista imprimible.
 * Señales pedagógicas para orientar la conversación; no son pruebas de uso de IA ni de irregularidades.
 */
import { Fragment, useMemo } from 'react';
import { rpc } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { clasificar, ESTADOS, pct, prioridades, recuento, SENAL_VTA, type ConceptoMapa, type EstadoConcepto, type MapaTutoria } from '@/lib/tutoria';
import { Badge, Card, Empty, ErrorBox, Notice, Spinner } from '@/components/ui';

export function MapaTutoriaTab({ clases, userId }: { clases: { class_id: string; nombre: string }[]; userId: string }) {
  const st = useAsync(() => Promise.all(clases.map((c) => rpc<MapaTutoria>('tutoria_mapa', { p_class: c.class_id, p_user: userId })
    .then((m) => ({ c, m, error: null as string | null }))
    .catch((e) => ({ c, m: null, error: /Could not find the function|PGRST202|schema cache/i.test(String(e)) ? 'Falta instalar la migración 68.' : e instanceof Error ? e.message : String(e) })))),
  [userId, clases.map((c) => c.class_id).join()]);
  if (st.loading) return <Spinner label="Uniendo dominio, evaluaciones y controles…" />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!clases.length) return <Empty>El estudiante no está en ninguna de sus secciones.</Empty>;
  return (
    <div className="space-y-5">
      <Notice>
        Une, por concepto, lo que resuelve en <strong>práctica</strong> (prácticas y práctica libre), en <strong>evaluaciones</strong> (exámenes,
        quizzes y controles) y en las <strong>Prácticas de Control</strong> confirmadas. Cuenta sus 10 respuestas más recientes por concepto.
        Son señales para orientar la tutoría, <strong>no pruebas de uso de IA</strong> ni de irregularidades: una diferencia entre práctica
        y evaluación tiene muchas causas.
      </Notice>
      {st.data!.map(({ c, m, error }) => (
        <section key={c.class_id} className="space-y-3">
          {clases.length > 1 && <h2 className="font-serif text-lg font-semibold">{c.nombre}</h2>}
          {error || !m ? <ErrorBox error={error ?? 'Sin datos'} /> : <Mapa m={m} />}
        </section>
      ))}
    </div>
  );
}

function Mapa({ m }: { m: MapaTutoria }) {
  const prio = useMemo(() => prioridades(m.conceptos), [m.conceptos]);
  const cuenta = useMemo(() => recuento(m.conceptos), [m.conceptos]);
  const porLeccion = useMemo(() => {
    const g = new Map<string, ConceptoMapa[]>();
    for (const c of m.conceptos) g.set(c.leccion ?? 'Sin lección', [...(g.get(c.leccion ?? 'Sin lección') ?? []), c]);
    return [...g.entries()];
  }, [m.conceptos]);
  const v = m.vta;
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Por dónde empezar la tutoría">
          {prio.length === 0 ? <p className="text-sm text-gray-500">No hay conceptos que requieran atención con los datos actuales.</p> : (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {prio.map((x) => (
                <li key={x.c.slug}><strong>{x.c.nombre}</strong> <Badge tone={ESTADOS[x.estado].tono}>{ESTADOS[x.estado].etiqueta}</Badge>
                  <span className="block text-xs text-gray-600 dark:text-gray-300">{x.motivo}{x.c.leccion ? ` · ${x.c.leccion}` : ''}</span></li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Resumen">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(Object.keys(ESTADOS) as EstadoConcepto[]).sort((a, b) => ESTADOS[a].orden - ESTADOS[b].orden).map((k) => (
              <Badge key={k} tone={ESTADOS[k].tono}>{ESTADOS[k].etiqueta}: {cuenta[k]}</Badge>
            ))}
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <div><dt className="inline text-gray-500">Prácticas de Control: </dt><dd className="inline">{v ? `${v.controles} confirmado(s)` : '—'}
              {m.pendientes_de_confirmar > 0 && <> · <Badge tone="amber">{m.pendientes_de_confirmar} sin confirmar</Badge></>}</dd></div>
            {v && v.controles > 0 && <>
              <div><dt className="inline text-gray-500">Práctica / control: </dt><dd className="inline">{v.practica ?? '—'} % / {v.supervisado ?? '—'} %
                {v.brecha !== null && ` · diferencia ${v.brecha} puntos${v.brecha_ee !== null ? ` (± ${v.brecha_ee})` : ''}`}</dd></div>
              <div><dt className="inline text-gray-500">Competencias verificadas: </dt><dd className="inline">{v.competencias_verificadas} · pendientes de verificar {v.competencias_pendientes}</dd></div>
            </>}
            <div><dt className="inline text-gray-500">Señal VTA: </dt><dd className="inline">{v ? SENAL_VTA[v.senal] : 'Sin controles todavía'}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-gray-500">{m.aviso}</p>
        </Card>
      </div>
      <Card title="Mapa por concepto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500"><th className="py-1 pr-2">Concepto</th><th>Práctica</th><th>Evaluaciones</th><th>Controles</th><th>Estado</th></tr></thead>
            <tbody>
              {porLeccion.map(([leccion, lista]) => (
                <Fragment key={leccion}>
                  <tr><td colSpan={5} className="pt-3 text-xs font-semibold uppercase tracking-wide text-acento-600">{leccion}</td></tr>
                  {lista.map((c) => {
                    const { estado, motivo } = clasificar(c);
                    return (
                      <tr key={c.slug} className="border-t border-gray-100 align-top dark:border-white/10" title={motivo}>
                        <td className="py-1 pr-2">{c.nombre}</td>
                        <td className="tabular-nums">{c.practica.n ? `${pct(c.practica.score)} (${c.practica.n})` : '—'}</td>
                        <td className="tabular-nums">{c.evaluaciones.n ? `${pct(c.evaluaciones.score)} (${c.evaluaciones.n})` : '—'}</td>
                        <td className="tabular-nums">{c.controles.n ? `${pct(c.controles.pct)} (${c.controles.n})` : '—'}</td>
                        <td><Badge tone={ESTADOS[estado].tono}>{ESTADOS[estado].etiqueta}</Badge></td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Entre paréntesis, el número de respuestas (o de controles). Pase el cursor por una fila para ver el motivo del estado.
          Umbrales: ≥ 80 % domina, &lt; 50 % dificultad (mínimo 2 respuestas); un control verifica con ≥ 70 %.</p>
      </Card>
    </>
  );
}
