/**
 * AURORA-07 (migración 105) — vista del profesor: vista previa del guion, habilitación (una sola vez) e informe de
 * entrevista y contraste técnico, calculado con reglas fijas (src/lib/aurora/contraste.ts).
 */
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_AURORA } from '@/api/aurora';
import { informeMarkdown, type Guion, type InformeAurora } from '@/lib/aurora/contraste';
import { descargarBlob } from '@/lib/maraton/exportar';
import { useAction, useAsync } from '@/lib/util';
import { Card, ErrorBox, Modal, Notice, PageTitle, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';

function VistaGuion({ g }: { g: Guion }) {
  return (
    <ol className="space-y-3 text-sm">
      {Object.entries(g.nodos).map(([id, n]) => (
        <li key={id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-1 font-mono text-xs text-gray-500">{id} · {n.tipo}{n.afirmacion ? ` · contrasta: ${n.afirmacion}` : ''}{n.revision ? ' · revisión humana' : ''}{id === g.inicio ? ' · INICIO' : ''}</div>
          <p className="whitespace-pre-wrap">{n.texto}</p>
          {n.opciones && (
            <ul className="mt-2 list-disc pl-5">
              {n.opciones.map((o) => <li key={o.valor}>{o.texto}{o.pide_texto ? ' (pide explicación)' : ''} → <span className="font-mono text-xs">{o.siguiente ?? n.siguiente}</span></li>)}
            </ul>
          )}
          {n.ramas?.map((r, k) => <p key={k} className="mt-1 font-mono text-xs">si {r.si.nodo} ∈ [{r.si.en.join(', ')}] → {r.ir}</p>)}
          {n.tipo !== 'opcion' && n.siguiente && <p className="mt-1 font-mono text-xs">→ {n.siguiente}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function AuroraInforme() {
  const { id = '' } = useParams();
  const st = useAsync(() => API_AURORA.informe(id), [id]);
  const [inf, setInf] = useState<InformeAurora | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [verGuion, setVerGuion] = useState(false);
  const accion = useAction();
  const d = inf ?? st.data ?? null;
  const md = useMemo(() => (d ? informeMarkdown(d) : ''), [d]);
  if (st.loading && !d) return <Spinner />;
  if (st.error && !d) return <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!d) return null;
  const e = d.entrevista;
  const nombre = `aurora-07-${(d.estudiante.login_id ?? 'estudiante').replace(/[^\w-]/g, '')}`;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageTitle title="AURORA-07" subtitle={`${d.estudiante.nombre} · ${d.maraton.titulo}`}
        actions={<div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="btn-secundario" onClick={st.reload}>Actualizar</button>
          <button type="button" className="btn-secundario" onClick={() => descargarBlob(`${nombre}.md`, new Blob([md], { type: 'text/markdown;charset=utf-8' }))}>Descargar (.md)</button>
          <button type="button" className="btn-secundario" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>} />
      {e.estado === 'preparada' && (
        <div className="print:hidden">
          <Notice tone="warn">
            La entrevista está <strong>preparada pero no habilitada</strong>: el estudiante todavía no la ve. Revise el guion completo y, cuando lo
            autorice, habilítela. Solo se puede habilitar una vez; después, el estudiante la verá en su inicio.
          </Notice>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primario" onClick={() => setConfirmar(true)}>Habilitar la entrevista…</button>
          </div>
        </div>
      )}
      <ErrorBox error={accion.error} />
      <Card title="Guion" className="print:hidden" actions={<button type="button" className="btn-secundario" onClick={() => setVerGuion((v) => !v)}>{verGuion ? 'Ocultar' : 'Ver el guion completo'}</button>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {Object.keys(e.guion.nodos).length} nodos. El estudiante solo ve la pregunta actual y su conversación; nunca el guion, las ramas ni este informe.
        </p>
        {verGuion && <div className="mt-3"><VistaGuion g={e.guion} /></div>}
      </Card>
      <article className="tarjeta prose max-w-none dark:prose-invert">
        <Markdown>{md}</Markdown>
      </article>
      {confirmar && (
        <Modal open title="Habilitar AURORA-07" onClose={() => setConfirmar(false)}>
          <p className="text-sm">
            {d.estudiante.nombre} verá la entrevista en su inicio y podrá responderla una sola vez. Las respuestas no cambian calificaciones
            ni el funcionamiento del maratón. ¿Habilitarla ahora?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
            <button type="button" className="btn-primario" disabled={accion.busy}
              onClick={() => void accion.run(() => API_AURORA.habilitar(id)).then((r) => { if (r) setInf(r); setConfirmar(false); })}>
              Sí, habilitar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
