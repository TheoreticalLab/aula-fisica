/**
 * AURORA-07 (migración 105) — vista del estudiante: entrevista con apariencia de chat que sigue un guion fijo.
 * Cada respuesta se guarda en el servidor, que devuelve la pregunta siguiente. No hay modelos de lenguaje.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_AURORA, type EstadoAurora, type NodoPublico } from '@/api/aurora';
import { fecha, useAction, useAsync } from '@/lib/util';
import { ErrorBox, PageTitle, Spinner } from '@/components/ui';

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

function Burbuja({ de, children }: { de: 'aurora' | 'yo'; children: React.ReactNode }) {
  return de === 'aurora' ? (
    <div className="flex gap-2">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primario-600 text-[10px] font-bold text-white" aria-hidden>A7</span>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2 text-sm dark:bg-gray-800">{children}</div>
    </div>
  ) : (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primario-600 px-4 py-2 text-sm text-white">{children}</div>
    </div>
  );
}

function Responder({ n, ocupado, onEnviar }: { n: NodoPublico; ocupado: boolean; onEnviar: (valor: string | null, texto: string | null) => void }) {
  const [valor, setValor] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  useEffect(() => { setValor(null); setTexto(''); }, [n.nodo]);
  if (n.tipo === 'info') {
    return <button type="button" className="btn-primario" disabled={ocupado} onClick={() => onEnviar(null, null)}>{n.boton ?? 'Continuar'}</button>;
  }
  if (n.tipo === 'opcion') {
    const op = n.opciones?.find((o) => o.valor === valor);
    const listo = !!op && (!op.pide_texto || texto.trim().length > 0);
    return (
      <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); if (listo) onEnviar(valor, op?.pide_texto ? texto : null); }}>
        <fieldset className="space-y-2">
          <legend className="sr-only">Opciones</legend>
          {n.opciones?.map((o) => (
            <label key={o.valor} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${valor === o.valor ? 'border-primario-500 bg-primario-50 dark:bg-primario-900/30' : 'border-gray-300 dark:border-gray-600'}`}>
              <input type="radio" name={n.nodo} className="mt-1" checked={valor === o.valor} onChange={() => setValor(o.valor)} />
              <span>{o.texto}</span>
            </label>
          ))}
        </fieldset>
        {op?.pide_texto && (
          <textarea className="campo min-h-24 w-full" maxLength={3000} placeholder="Escriba su explicación" value={texto} onChange={(ev) => setTexto(ev.target.value)} />
        )}
        <button type="submit" className="btn-primario" disabled={!listo || ocupado}>Enviar</button>
      </form>
    );
  }
  const max = n.max ?? 3000;
  return (
    <form className="space-y-2" onSubmit={(ev) => { ev.preventDefault(); if (n.opcional || texto.trim()) onEnviar(null, texto); }}>
      <textarea className="campo min-h-32 w-full" maxLength={max} value={texto} onChange={(ev) => setTexto(ev.target.value)}
        placeholder={n.opcional ? 'Puede dejarlo en blanco' : 'Escriba su respuesta'} />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primario" disabled={ocupado || (!n.opcional && !texto.trim())}>Enviar</button>
        <span className="text-xs text-gray-500">{texto.length} / {max}</span>
      </div>
    </form>
  );
}

export default function Aurora() {
  const { id = '' } = useParams();
  const st = useAsync(() => API_AURORA.estado(id), [id]);
  const [estado, setEstado] = useState<EstadoAurora | null>(null);
  const accion = useAction();
  const fin = useRef<HTMLDivElement>(null);
  const e = estado ?? st.data ?? null;
  useEffect(() => { fin.current?.scrollIntoView?.({ block: 'end' }); }, [e?.historial.length, e?.actual?.nodo]);

  if (st.loading && !e) return <Spinner />;
  if (st.error && !e) return <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!e) return null;
  const enviar = (valor: string | null, texto: string | null) => {
    if (!e.actual) return;
    void accion.run(() => API_AURORA.responder(e.id, e.actual!.nodo, valor, texto, uuid())).then((r) => { if (r) setEstado(r); });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="AURORA-07" subtitle="Asistente automatizado de verificación académica" />
      <div className="tarjeta space-y-3" aria-live="polite">
        {e.historial.map((h, k) => (
          <div key={k} className="space-y-3">
            <Burbuja de="aurora">{h.pregunta}</Burbuja>
            <Burbuja de="yo">{h.respuesta}</Burbuja>
          </div>
        ))}
        {e.actual && <Burbuja de="aurora">{e.actual.texto}</Burbuja>}
        {e.estado === 'finalizada' && <p className="text-center text-xs text-gray-500">Entrevista terminada · {fecha(e.finalizada_at)}</p>}
        <div ref={fin} />
      </div>
      {e.estado === 'abierta' && e.actual && e.actual.tipo !== 'fin' && (
        <div className="tarjeta mt-3">
          <ErrorBox error={accion.error} />
          <Responder n={e.actual} ocupado={accion.busy} onEnviar={enviar} />
        </div>
      )}
    </div>
  );
}
