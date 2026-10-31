/**
 * Análisis → Telemetría: activación de la Telemetría V2 por asignatura (equipo de la asignatura) y monitor de la
 * propia telemetría (administración): ingesta, rechazos, duplicados, calidad y cola. Sin datos personales.
 */
import { useState } from 'react';
import { banderaV2, fijarBanderaV2, monitorV2 } from '@/api/telemetria';
import { listCourses } from '@/api/docente';
import { useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, PageTitle, Spinner } from '@/components/ui';

export default function TelemetriaPanel() {
  const cursos = useAsync(listCourses, []);
  const monitor = useAsync(() => monitorV2(48).catch(() => null), []);
  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Telemetría" subtitle="Observatorio del proceso de aprendizaje (V2). La reconstrucción de cada intento está en su revisión." />
      <Card className="mb-4 text-sm">
        <p>La Telemetría V2 registra, solo dentro del aula, cuándo se presenta, activa, modifica, guarda y entrega cada pregunta, la visibilidad de la página, la conexión, las pausas y la sincronización del reloj. <strong>No</strong> registra teclas, texto escrito fuera de las respuestas, portapapeles, pantalla, audio, vídeo ni otras aplicaciones. Las respuestas se resumen con una huella; su contenido se guarda, como siempre, en el historial de revisiones del servidor.</p>
        <p className="mt-1">Se activa por asignatura y nace apagada. La V1 sigue funcionando igual (los indicadores LIEIA la usan y no cambian).</p>
      </Card>
      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Activación por asignatura</h2>
        {cursos.loading ? <Spinner /> : <ErrorBox error={cursos.error} />}
        <ul className="divide-y divide-gray-100 dark:divide-white/10">
          {cursos.data?.map((c) => <FilaCurso key={c.id} id={c.id} titulo={c.title} />)}
        </ul>
      </Card>
      {monitor.data && (
        <Card>
          <h2 className="mb-2 font-semibold">Monitor de la telemetría (últimas 48 h)</h2>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Dato k="Aceptados" v={monitor.data.ingesta.reduce((s, h) => s + h.aceptados, 0)} />
            <Dato k="Duplicados (reenvíos)" v={monitor.data.ingesta.reduce((s, h) => s + h.duplicados, 0)} />
            <Dato k="Rechazados" v={monitor.data.ingesta.reduce((s, h) => s + h.rechazados, 0)} />
            <Dato k="Lotes" v={monitor.data.ingesta.reduce((s, h) => s + h.lotes, 0)} />
            <Dato k="Cola máxima en un dispositivo" v={monitor.data.pendientes_max ?? '—'} />
            <Dato k="Revisiones de respuestas (24 h)" v={monitor.data.revisiones_24h} />
            <Dato k="Instantáneas de entrega (24 h)" v={monitor.data.instantaneas_24h} />
          </div>
          <h3 className="mt-3 text-sm font-semibold">Ingesta por hora</h3>
          <div className="flex h-24 items-end gap-0.5" role="img" aria-label="Eventos aceptados por hora">
            {monitor.data.ingesta.map((h) => {
              const max = Math.max(1, ...monitor.data!.ingesta.map((x) => x.aceptados + x.rechazados));
              return (
                <div key={h.hora} className="flex flex-1 flex-col justify-end" title={`${new Date(h.hora).toLocaleString('es-DO')}: ${h.aceptados} aceptados, ${h.rechazados} rechazados, ${h.duplicados} duplicados`}>
                  {h.rechazados > 0 && <div style={{ height: `${(100 * h.rechazados) / max}%`, background: '#dc2626' }} />}
                  <div style={{ height: `${(100 * h.aceptados) / max}%`, background: '#2563eb' }} />
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-500">Azul: aceptados; rojo: rechazados. Un aumento brusco de rechazos tras una versión nueva suele indicar un error de esquema.</p>
          <div className="mt-3 grid gap-4 text-sm md:grid-cols-2">
            <div><h3 className="font-semibold">Eventos por tipo</h3><ul className="text-xs">{Object.entries(monitor.data.por_tipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul></div>
            <div><h3 className="font-semibold">Indicadores de calidad</h3>
              {Object.keys(monitor.data.calidad).length ? <ul className="text-xs">{Object.entries(monitor.data.calidad).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul> : <p className="text-xs text-gray-500">Ninguno.</p>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: number | string }) {
  return <div className="rounded border border-gray-200 p-2 dark:border-white/10"><p className="text-xs text-gray-500">{k}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>;
}

function FilaCurso({ id, titulo }: { id: string; titulo: string }) {
  const st = useAsync(() => banderaV2(id).catch(() => undefined), [id]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const valor = st.data;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="flex-1">{titulo}</span>
      {valor === undefined ? <span className="text-xs text-gray-500">sin permiso</span> : valor === null ? <span className="text-xs text-gray-500">migración 42 pendiente</span> : (
        <>
          <Badge tone={valor ? 'green' : 'gray'}>{valor ? 'Activa' : 'Apagada'}</Badge>
          <button className="btn-secundario py-1 text-xs" disabled={ocupado} onClick={async () => {
            setOcupado(true); setError(null);
            try { await fijarBanderaV2(id, !valor); st.reload(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
          }}>{valor ? 'Apagar' : 'Activar'}</button>
        </>
      )}
      {error && <span className="w-full text-xs text-red-700">{error}</span>}
    </li>
  );
}
