/**
 * Asistencia autónoma por quórum de proximidad (estudiante). Se integra en la página de Asistencia existente.
 * La ubicación se pide SOLO al pulsar un botón (nunca en segundo plano); el servidor decide todo.
 */
import { useCallback, useEffect, useState } from 'react';
import { estadoQuorum, marcarPorProximidad, renovarReferencia, unirseQuorum, type EstadoQuorum, type RespuestaQuorum } from '@/api/asistencia';
import { horaLocal, mensajeQuorum } from '@/lib/quorum';
import { ubicacionActual } from '@/lib/ubicacion';
import { Notice } from './ui';

export function AsistenciaQuorum({ onCambio, onSesionesQuorum }: { onCambio?: () => void; onSesionesQuorum?: (ids: Set<string>) => void }) {
  const [clases, setClases] = useState<EstadoQuorum[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<Record<string, { tono: 'ok' | 'info' | 'warn'; texto: string }>>({});
  const cargar = useCallback(() => void estadoQuorum().then((d) => {
    setClases(d ?? []);
    // las asistencias activadas por quórum no tienen código: la página no debe pedirlo para ellas
    onSesionesQuorum?.(new Set((d ?? []).filter((c) => c.activacion === 'quorum' && c.session_id).map((c) => c.session_id!)));
  }).catch(() => setClases([])), [onSesionesQuorum]);
  const esperando = (clases ?? []).some((c) => c.estado === 'quorum_disponible' && c.mi_solicitud);
  useEffect(() => {
    cargar();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, esperando ? 5000 : 15000);
    return () => window.clearInterval(t);
  }, [cargar, esperando]);

  async function conUbicacion(c: EstadoQuorum, paso: string, f: (u: NonNullable<Awaited<ReturnType<typeof ubicacionActual>>['ubicacion']>) => Promise<RespuestaQuorum>) {
    setOcupado(c.class_id);
    setMensaje((m) => ({ ...m, [c.class_id]: { tono: 'info', texto: 'Obteniendo tu ubicación…' } }));
    try {
      const { ubicacion, motivo } = await ubicacionActual();
      if (!ubicacion) { setMensaje((m) => ({ ...m, [c.class_id]: { tono: 'warn', texto: `${motivo ?? 'No se pudo obtener la ubicación.'} Sin ubicación no se puede confirmar la presencia; puedes solicitar validación al docente.` } })); return; }
      setMensaje((m) => ({ ...m, [c.class_id]: { tono: 'info', texto: paso } }));
      const r = await f(ubicacion);
      setMensaje((m) => ({ ...m, [c.class_id]: mensajeQuorum(r) }));
      cargar();
      onCambio?.();
    } catch (e) {
      setMensaje((m) => ({ ...m, [c.class_id]: { tono: 'warn', texto: e instanceof Error ? e.message : String(e) } }));
    } finally { setOcupado(null); }
  }

  const visibles = (clases ?? []).filter((c) => c.estado !== 'activa_manual' && c.estado !== 'sin_horario');
  if (!visibles.length) return null;
  return (
    <div className="space-y-3">
      {visibles.map((c) => {
        const m = mensaje[c.class_id];
        const refCaducada = c.presente && c.mi_ref_vigente_hasta !== null && Date.parse(c.mi_ref_vigente_hasta) < Date.parse(c.server_now);
        return (
          <div key={c.class_id} className="rounded-xl border border-gray-200 p-4 dark:border-white/10" aria-live="polite">
            <p className="text-xs text-gray-500">{c.asignatura} · {c.clase}</p>
            {c.estado === 'programada' && (
              <>
                <p className="font-semibold">Asistencia programada</p>
                <p className="text-sm">La asistencia podrá activarse a las {horaLocal(Date.parse(c.proxima!))}{new Date(c.proxima!).toDateString() !== new Date().toDateString() ? ` del ${new Date(c.proxima!).toLocaleDateString('es-DO', { weekday: 'long', timeZone: 'America/Santo_Domingo' })}` : ''}.</p>
              </>
            )}
            {c.estado === 'quorum_disponible' && (
              <>
                <p className="font-semibold">Activación colectiva disponible</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Cuando {c.quorum} compañeros que están juntos en el aula pulsen el botón, la asistencia se activa sola y quedan presentes. Disponible hasta las {horaLocal(Date.parse(c.fin_ventana!))}.</p>
                {c.mi_solicitud && <p className="mt-1 text-sm font-medium">Esperando compañeros: {Math.max(1, Math.min(c.participantes, c.quorum - 1))}/{c.quorum}</p>}
                <button className="btn-primario mt-2" disabled={ocupado === c.class_id} onClick={() => void conUbicacion(c, 'Buscando el quórum…', (u) => unirseQuorum(c.class_id, u))}>
                  {ocupado === c.class_id ? 'Comprobando…' : c.mi_solicitud ? 'Volver a intentar' : 'Estoy aquí — Activar asistencia'}
                </button>
              </>
            )}
            {c.estado === 'activa_quorum' && !c.presente && (
              <>
                <p className="font-semibold">Asistencia disponible</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Activada por tus compañeros. Se comprueba que estás en la zona del aula y cerca de alguien ya registrado.</p>
                <button className="btn-primario mt-2" disabled={ocupado === c.class_id} onClick={() => void conUbicacion(c, 'Comprobando…', (u) => marcarPorProximidad(u))}>
                  {ocupado === c.class_id ? 'Comprobando…' : 'Marcar presente'}
                </button>
              </>
            )}
            {c.estado === 'activa_quorum' && c.presente && (
              <>
                <p className="font-semibold text-green-800 dark:text-green-300">✅ Presente registrado</p>
                {refCaducada && (
                  <div className="mt-1 text-sm">
                    <p className="text-gray-600 dark:text-gray-300">Si un compañero que llega no logra confirmar su presencia, puedes ayudarle renovando tu ubicación (una sola medición; tu asistencia ya está registrada y no depende de esto).</p>
                    <button className="btn-secundario mt-1 py-1 text-sm" disabled={ocupado === c.class_id} onClick={() => void conUbicacion(c, 'Renovando…', (u) => renovarReferencia(u))}>Renovar mi ubicación</button>
                  </div>
                )}
              </>
            )}
            {c.estado === 'cerrada' && <p className="text-sm">El profesor cerró la asistencia de esta clase.</p>}
            {m && <div className="mt-2"><Notice tone={m.tono}>{m.texto}</Notice></div>}
          </div>
        );
      })}
      <p className="text-xs text-gray-500">📍 La ubicación se pide solo al pulsar el botón y se usa para esa comprobación; no se sigue tu ubicación ni se muestra a tus compañeros. Si no se puede confirmar, el docente puede validar tu asistencia.</p>
    </div>
  );
}
