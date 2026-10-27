/** Entregas en PDF: el estudiante solicita autorización y, con ella, sube su práctica o examen escrito escaneado. */
import { useState } from 'react';
import { abrirPdf, misBuzones, solicitarPermiso, subirPdf, tamano, TIPO_BUZON, type MiBuzon } from '@/api/entregas';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const ESTADO = { recibido: ['recibido, sin revisar', 'blue'], aceptado: ['aceptado', 'green'], rechazado: ['rechazado', 'red'] } as const;

function Buzon({ b, onCambio }: { b: MiBuzon; onCambio: () => void }) {
  const [nota, setNota] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const accion = useAction();
  const limite = b.max_mb * 1048576;
  const errorArchivo = archivo && (archivo.type && archivo.type !== 'application/pdf' && !/\.pdf$/i.test(archivo.name) ? 'Debe ser un archivo PDF.' : archivo.size > limite ? `Supera el máximo de ${b.max_mb} MB.` : null);

  async function solicitar() {
    await accion.run(async () => {
      await solicitarPermiso(b.id, nota.trim() || null);
      setHecho('Solicitud enviada. Podrá subir el archivo cuando el profesor la apruebe.');
      onCambio();
    });
  }
  async function subir() {
    if (!archivo || errorArchivo) return;
    await accion.run(async () => {
      await subirPdf(b.id, archivo);
      setArchivo(null);
      setHecho('Archivo entregado. El profesor lo revisará.');
      onCambio();
    });
  }

  const pendienteAutorizacion = b.requires_approval && b.permiso !== 'aprobado';
  return (
    <Card title={<>{b.title} <Badge tone={b.kind === 'examen' ? 'purple' : 'blue'}>{TIPO_BUZON[b.kind]}</Badge></>}>
      <p className="text-xs text-gray-500">{b.class_name} · {b.course_title}{b.closes_at ? ` · entrega hasta ${fecha(b.closes_at)}` : ''} · hasta {b.max_files} archivo(s) de {b.max_mb} MB</p>
      {b.instructions && <p className="mt-2 whitespace-pre-line text-sm">{b.instructions}</p>}

      {hecho && <div className="mt-3"><Notice tone="ok">{hecho}</Notice></div>}
      <ErrorBox error={accion.error} />

      {pendienteAutorizacion && (
        <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-white/10">
          {b.permiso === 'solicitado' ? (
            <p className="text-sm">⏳ Solicitud enviada. Espere la aprobación del profesor.</p>
          ) : b.permiso === 'revocado' ? (
            <p className="text-sm text-red-700 dark:text-red-400">El profesor retiró su autorización para este buzón.{b.decision_note ? ` «${b.decision_note}»` : ''}</p>
          ) : (
            <>
              {b.permiso === 'rechazado' && <p className="mb-2 text-sm text-red-700 dark:text-red-400">Su solicitud fue rechazada{b.decision_note ? `: «${b.decision_note}»` : '.'} Puede volver a solicitarla.</p>}
              <p className="mb-2 text-sm">Para subir su archivo necesita la autorización del profesor.</p>
              <textarea className="campo mb-2 min-h-[3rem] text-sm" maxLength={500} placeholder="Mensaje para el profesor (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
              <button className="btn-primario" disabled={accion.busy || b.motivo === 'El plazo de entrega terminó'} onClick={() => void solicitar()}>Solicitar autorización</button>
            </>
          )}
        </div>
      )}

      {!pendienteAutorizacion && (
        <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-white/10">
          {b.puede_subir ? (
            <>
              {b.requires_approval && <p className="mb-2 text-sm text-green-700 dark:text-green-400">✓ Autorizado por el profesor{b.decision_note ? `: «${b.decision_note}»` : ''}.</p>}
              <input type="file" accept="application/pdf,.pdf" className="block w-full text-sm" onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setHecho(null); }} />
              {archivo && <p className={`mt-1 text-xs ${errorArchivo ? 'text-red-600' : 'text-gray-500'}`}>{errorArchivo ?? `${archivo.name} · ${tamano(archivo.size)}`}</p>}
              <button className="btn-primario mt-2" disabled={!archivo || !!errorArchivo || accion.busy} onClick={() => void subir()}>{accion.busy ? 'Subiendo…' : 'Entregar PDF'}</button>
              <p className="mt-1 text-xs text-gray-500">Revise que se lean todas las páginas antes de entregar. Una vez entregado no se puede borrar.</p>
            </>
          ) : <p className="text-sm text-gray-600 dark:text-gray-300">{b.motivo}</p>}
        </div>
      )}

      {b.archivos.length > 0 && (
        <>
          <h3 className="mb-1 mt-3 text-sm font-semibold">Mis archivos entregados</h3>
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            {b.archivos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span><button className="enlace" onClick={() => void accion.run(() => abrirPdf(a.id))}>{a.nombre}</button> <span className="text-xs text-gray-500">· {tamano(a.bytes)} · {fecha(a.subido)}</span>
                  {a.nota && <span className="block text-xs">Profesor: «{a.nota}»</span>}</span>
                <Badge tone={ESTADO[a.estado][1]}>{ESTADO[a.estado][0]}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export default function Entregas() {
  const st = useAsync(misBuzones, []);
  return (
    <div className="space-y-4">
      <PageTitle title="Entregas en PDF" subtitle="Prácticas y exámenes escritos: solicite autorización y suba su archivo escaneado." />
      {st.loading ? <Spinner /> : st.error ? <ErrorBox error={st.error} onRetry={st.reload} /> : !st.data!.length ? (
        <Empty>No hay buzones de entrega abiertos en sus secciones.</Empty>
      ) : st.data!.map((b) => <Buzon key={b.id} b={b} onCambio={() => void st.reload()} />)}
    </div>
  );
}
