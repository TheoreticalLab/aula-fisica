/**
 * Apartado teórico del maratón (migración 111). Se llega aquí tras pulsar «No puedo realizar el ejercicio»: primero el
 * ejercicio que no pudo hacer, resuelto paso a paso; después la teoría de todo el maratón y los demás ejercicios que
 * declaró no poder resolver. Al fondo, «Volver al maratón». Solo recibe problemas ya CERRADOS (nunca el abierto).
 */
import { Link, useParams } from 'react-router-dom';
import { API_MARATON, type TeoriaMaraton } from '@/api/maraton';
import { useAsync } from '@/lib/util';
import { ErrorBox, PageTitle, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';

type Resuelto = TeoriaMaraton['resueltos'][number];

function EjercicioResuelto({ r, abierto }: { r: Resuelto; abierto: boolean }) {
  const cuerpo = (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold uppercase text-gray-500">Enunciado</div>
        <Markdown className="prosa text-base">{r.enunciado}</Markdown>
        {r.partes.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-sm text-gray-600 dark:text-gray-400">
            {r.partes.map((p, i) => <li key={i}>{p.etiqueta}{p.unidad ? ` (${p.unidad})` : ''}</li>)}
          </ul>
        )}
      </div>
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800/60 dark:bg-green-900/20">
        <div className="mb-1 text-xs font-semibold uppercase text-green-800 dark:text-green-300">Solución paso a paso</div>
        <Markdown className="prosa text-base">{r.solucion}</Markdown>
      </div>
    </div>
  );
  if (abierto) return cuerpo;
  return (
    <details className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <summary className="cursor-pointer text-sm font-medium">Jornada {r.jornada} · ejercicio {r.numero}</summary>
      <div className="mt-3">{cuerpo}</div>
    </details>
  );
}

export default function MaratonTeoria() {
  const { maratonId = '', presentacionId } = useParams();
  const st = useAsync(() => API_MARATON.teoria(maratonId, presentacionId ?? null), [maratonId, presentacionId]);
  const volver = (
    <div className="flex justify-center pt-2">
      <Link className="btn-primario min-h-[48px] px-8 text-base" to={`/maraton/${maratonId}`}>Volver al maratón</Link>
    </div>
  );
  if (st.loading) return <Spinner />;
  if (st.error || !st.data) return <div className="mx-auto max-w-3xl space-y-4"><ErrorBox error={st.error} onRetry={st.reload} />{volver}</div>;
  const t = st.data;
  const actual = t.resueltos.find((r) => r.presentacion_id === t.actual) ?? null;
  const otros = t.resueltos.filter((r) => r !== actual);
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
      <PageTitle title="Apartado teórico" subtitle={t.titulo} back={{ to: `/maraton/${maratonId}`, label: 'Maratón' }} />
      {actual && (
        <section className="tarjeta space-y-3">
          <h2 className="text-lg font-bold">El ejercicio que no pudo realizar</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Léalo con calma y siga cada paso. Los ejercicios que vienen son del mismo tipo, con otros números.</p>
          <EjercicioResuelto r={actual} abierto />
        </section>
      )}
      <section className="tarjeta">
        <h2 className="mb-2 text-lg font-bold">Teoría del maratón</h2>
        <Markdown className="prosa text-base">{t.teoria}</Markdown>
      </section>
      {otros.length > 0 && (
        <section className="tarjeta space-y-2">
          <h2 className="text-lg font-bold">Otros ejercicios resueltos</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Los ejercicios anteriores en los que pulsó «No puedo realizar el ejercicio».</p>
          {otros.map((r) => <EjercicioResuelto key={r.presentacion_id} r={r} abierto={false} />)}
        </section>
      )}
      {volver}
    </div>
  );
}
