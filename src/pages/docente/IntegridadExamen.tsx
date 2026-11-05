/**
 * Panel docente · protección de una evaluación (migración 85): por estudiante, salidas, reingresos y bloqueo activo
 * (con «Liberar», la misma liberación de Comunicación y Orbe Control) e intentos de pegar, arrastrar o copiar.
 * Solo se muestra si la evaluación tiene alguna protección o si hubo eventos.
 */
import { useEffect, useRef, useState } from 'react';
import { examCodigoAnular, examCodigoGenerar, examCodigosActivos, examIntegridadResumen, funcionAusente, type FilaIntegridad } from '@/api/examen';
import { rpc, supabase } from '@/lib/supabase';
import { fecha, useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox } from '@/components/ui';

const MOTIVO: Record<string, string> = {
  oculta: 'cambió de pestaña o de aplicación', sin_foco: 'más de 5 s fuera de la página', cierre: 'cerró o recargó la página',
  navegacion: 'fue a otra página del aula', reapertura: 'volvió a abrir el examen',
};
const TIPO: Record<string, string> = { salida: 'Salida', reingreso: 'Reingreso', pegado: 'Intentó pegar', arrastre: 'Intentó arrastrar', copia: 'Intentó copiar',
  salida_autorizada: 'Salió con código del profesor', codigo_fallido: 'Código incorrecto', incidencia: 'Incidencia técnica' };
// (vías de copiar/pegar: teclado = Ctrl/Cmd+C/V/X; menu = menú contextual; evento = el navegador lo intentó)
Object.assign(MOTIVO, { teclado: 'teclado', menu: 'menú contextual', evento: 'navegador', codigo_docente: 'código del profesor', microfono_denegado: 'micrófono denegado',
  microfono_error: 'micrófono no disponible', grabacion_fallida: 'grabación no posible', subida_fallida: 'subida fallida', sin_conexion: 'sin conexión' });

export function IntegridadExamen({ activityId }: { activityId: string }) {
  const st = useAsync(() => examIntegridadResumen(activityId), [activityId]);
  const accion = useAction();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<{ id: number; texto: string; en: string }[]>([]);
  // avisos en tiempo real (Realtime con RLS: solo llegan los de las secciones de este profesor)
  const nombres = useRef(new Map<string, string>());
  nombres.current = new Map((st.data?.estudiantes ?? []).map((e) => [e.attempt_id, e.nombre]));
  const recargar = useRef(st.reload);
  recargar.current = st.reload;
  useEffect(() => {
    const canal = supabase.channel(`integridad-${activityId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exam_integridad_eventos' }, (p) => {
        const e = p.new as { id: number; attempt_id: string; tipo: string; motivo: string | null; resultado: string | null; created_at: string };
        const nombre = nombres.current.get(e.attempt_id);
        if (!nombre && nombres.current.size) return;          // de otra evaluación
        const texto = textoAviso(e.tipo, e.motivo, e.resultado);
        if (!texto) return;
        setAvisos((xs) => [{ id: e.id, texto: `${nombre ?? 'Un estudiante'}: ${texto}`, en: e.created_at }, ...xs].slice(0, 8));
        void recargar.current();
      })
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [activityId]);
  if (st.error) return funcionAusente(st.error) ? null : <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!st.data) return null;
  const { config, estudiantes } = st.data;
  const conEventos = estudiantes.filter((e) => e.salidas + e.reingresos + e.pegados + e.arrastres + e.copias > 0 || e.lock_id);
  if (!config?.bloquear_al_salir && !config?.impedir_copiar && conEventos.length === 0) return null;
  const liberar = (f: FilaIntegridad) => accion.run(async () => { await rpc('release_screen_lock', { p_lock: f.lock_id }); st.reload(); });

  return (
    <Card className="mt-4" title={<span>Protección del examen {config?.bloquear_al_salir && <Badge tone="amber">bloquear al salir</Badge>} {config?.impedir_copiar && <Badge tone="purple">sin copiar ni pegar</Badge>}</span>}
      actions={<button className="btn-texto text-sm" onClick={st.reload}>Actualizar</button>}>
      {avisos.length > 0 && (
        <ul className="mb-3 space-y-1" aria-live="polite" aria-label="Avisos en tiempo real">
          {avisos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
              <span aria-hidden>⚠</span><span className="flex-1">{a.texto}</span><span className="text-xs opacity-70">{fecha(a.en)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mb-3 text-xs text-gray-500">Los eventos son indicios para su revisión, no pruebas de fraude: un cambio de pestaña puede ser una llamada o una notificación.
        No se detecta lo que ocurre fuera del navegador (otro dispositivo, fotos de la pantalla).</p>
      {config?.bloquear_al_salir && <CodigosTemporales activityId={activityId} estudiantes={estudiantes} />}
      {conEventos.length === 0 ? <p className="text-sm text-gray-500">Nadie ha salido ni intentado copiar o pegar.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500">
              <th className="py-2 pr-3">Estudiante</th><th className="py-2 pr-3 text-right">Salidas</th><th className="py-2 pr-3 text-right">Reingresos</th>
              <th className="py-2 pr-3 text-right">Pegar / arrastrar</th><th className="py-2 pr-3 text-right">Copiar</th><th className="py-2 pr-3">Estado</th><th />
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {conEventos.map((f) => (
                <FilaEstudiante key={f.attempt_id} f={f} abierto={abierto === f.attempt_id} onAbrir={() => setAbierto(abierto === f.attempt_id ? null : f.attempt_id)}
                  onLiberar={() => void liberar(f)} ocupado={accion.busy} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ErrorBox error={accion.error} />
      <p className="mt-2 text-xs text-gray-500">Liberar quita el bloqueo sin código. El estudiante sigue donde estaba; el tiempo perdido no se devuelve (puede darle una prórroga en el monitor).</p>
    </Card>
  );
}

function textoAviso(tipo: string, motivo: string | null, resultado: string | null): string | null {
  const r = resultado === 'bloqueado' ? ' (impedido)' : resultado === 'detectado' ? ' (detectado)' : '';
  switch (tipo) {
    case 'salida': return `salió del examen — ${MOTIVO[motivo ?? ''] ?? motivo ?? ''}`;
    case 'reingreso': return 'volvió a abrir el examen (pantalla bloqueada)';
    case 'pegado': return `intentó pegar${r}`;
    case 'arrastre': return `intentó arrastrar texto${r}`;
    case 'copia': return `intentó copiar${r}`;
    case 'salida_autorizada': return 'salió con un código del profesor';
    case 'codigo_fallido': return 'escribió un código incorrecto';
    case 'incidencia': return `incidencia técnica: ${motivo ?? ''}`;
    default: return null;
  }
}

/** Códigos temporales: para salir con autorización o volver a entrar tras un bloqueo. Se muestran una sola vez. */
function CodigosTemporales({ activityId, estudiantes }: { activityId: string; estudiantes: FilaIntegridad[] }) {
  const lista = useAsync(() => examCodigosActivos(activityId), [activityId]);
  const accion = useAction();
  const [para, setPara] = useState('');
  const [minutos, setMinutos] = useState(15);
  const [usos, setUsos] = useState(1);
  const [nuevo, setNuevo] = useState<{ codigo: string; vence: string; nombre: string } | null>(null);
  const generar = () => accion.run(async () => {
    const r = await examCodigoGenerar(activityId, para || null, minutos, usos);
    setNuevo({ codigo: r.codigo, vence: r.vence, nombre: para ? estudiantes.find((e) => e.user_id === para)?.nombre ?? 'el estudiante' : 'cualquier estudiante' });
    lista.reload();
  });
  return (
    <div className="mb-4 rounded-lg border border-gray-200 p-3 text-sm dark:border-white/10">
      <p className="mb-2 font-semibold">Códigos temporales (salir o volver a entrar)</p>
      <div className="flex flex-wrap items-end gap-2">
        <label>Para<select className="campo" value={para} onChange={(e) => setPara(e.target.value)}>
          <option value="">Cualquier estudiante de la evaluación</option>
          {estudiantes.map((e) => <option key={e.user_id} value={e.user_id}>{e.nombre || e.matricula || e.user_id.slice(0, 8)}</option>)}
        </select></label>
        <label>Vale (min)<input type="number" className="campo w-20" min={1} max={240} value={minutos} onChange={(e) => setMinutos(Math.max(1, Math.min(240, Number(e.target.value) || 15)))} /></label>
        <label>Usos<input type="number" className="campo w-20" min={1} max={200} value={usos} onChange={(e) => setUsos(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} /></label>
        <button className="btn-secundario" disabled={accion.busy} onClick={() => void generar()}>Generar código</button>
      </div>
      {nuevo && (
        <p className="mt-2 rounded bg-emerald-50 p-2 dark:bg-emerald-900/20">
          Código para {nuevo.nombre}: <strong className="font-mono text-xl tracking-widest">{nuevo.codigo}</strong> · vence {fecha(nuevo.vence)}.
          <span className="block text-xs text-gray-600 dark:text-gray-300">Dígalo al estudiante; no se volverá a mostrar.</span>
        </p>
      )}
      <ErrorBox error={accion.error} />
      {!!lista.data?.length && (
        <ul className="mt-2 space-y-1 text-xs">
          {lista.data.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span>{c.nombre ?? 'Cualquier estudiante'} · {c.usos}/{c.usos_max} usos · vence {fecha(c.vence)}</span>
              <button className="btn-texto !py-0 text-xs text-red-700" onClick={() => void accion.run(async () => { await examCodigoAnular(c.id); lista.reload(); })}>Anular</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaEstudiante({ f, abierto, onAbrir, onLiberar, ocupado }: { f: FilaIntegridad; abierto: boolean; onAbrir: () => void; onLiberar: () => void; ocupado: boolean }) {
  return (
    <>
      <tr>
        <td className="py-2 pr-3"><button className="enlace text-left" onClick={onAbrir}>{f.nombre || '(sin nombre)'}</button>
          <span className="block text-xs text-gray-500">{f.matricula ?? ''}{f.ultima_salida && ` · última salida ${fecha(f.ultima_salida)}`}</span></td>
        <td className="py-2 pr-3 text-right tabular-nums">{f.salidas}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{f.reingresos}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{f.pegados + f.arrastres}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{f.copias}</td>
        <td className="py-2 pr-3">{f.lock_id ? <Badge tone="red">Bloqueado</Badge> : f.estado === 'in_progress' ? <Badge tone="blue">En curso</Badge> : <Badge tone="green">Entregado</Badge>}</td>
        <td className="py-2 text-right">{f.lock_id && <button className="btn-secundario !py-1 text-xs" disabled={ocupado} onClick={onLiberar}>Liberar</button>}</td>
      </tr>
      {abierto && (
        <tr><td colSpan={7} className="pb-3">
          <ol className="ml-4 list-decimal space-y-0.5 text-xs text-gray-600 dark:text-gray-300">
            {f.detalle.map((d, i) => (
              <li key={i}>{fecha(d.en)} · {TIPO[d.tipo] ?? d.tipo}{d.motivo && ` (${MOTIVO[d.motivo] ?? d.motivo})`}
                {d.pregunta ? ` · pregunta ${d.pregunta}` : ''}{d.resultado === 'bloqueado' ? ' · impedido' : d.resultado === 'detectado' ? ' · detectado' : ''}</li>
            ))}
          </ol>
        </td></tr>
      )}
    </>
  );
}
