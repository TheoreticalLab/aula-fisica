/** Configuración de la asistencia autónoma por quórum de una sección: activación, horario semanal y parámetros. */
import { useEffect, useState } from 'react';
import { configQuorum, guardarConfigQuorum, type AjustesQuorum } from '@/api/asistencia';
import { horaLocal } from '@/lib/quorum';
import { useAction, useAsync } from '@/lib/util';
import { ErrorBox, Notice, Spinner } from '@/components/ui';

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CAMPOS: { k: keyof AjustesQuorum; etiqueta: string; unidad: string; min: number; max: number }[] = [
  { k: 'quorum', etiqueta: 'Quórum mínimo', unidad: 'estudiantes', min: 3, max: 6 },
  { k: 'ventana_min', etiqueta: 'Ventana para formar el quórum', unidad: 'min desde la hora', min: 5, max: 120 },
  { k: 'radio_quorum_m', etiqueta: 'Distancia máxima entre los del quórum (R_q)', unidad: 'm', min: 10, max: 200 },
  { k: 'radio_general_m', etiqueta: 'Radio de la zona alrededor del centro inicial (R_a)', unidad: 'm', min: 20, max: 2000 },
  { k: 'radio_proximidad_m', etiqueta: 'Distancia máxima a un estudiante ya validado (R_p)', unidad: 'm', min: 10, max: 200 },
  { k: 'vigencia_ref_min', etiqueta: 'Vigencia de la ubicación de un admitido como referencia', unidad: 'min', min: 2, max: 180 },
  { k: 'precision_max_m', etiqueta: 'Peor precisión aceptable del GPS', unidad: 'm', min: 5, max: 500 },
  { k: 'edad_max_s', etiqueta: 'Antigüedad máxima de la medición', unidad: 's', min: 10, max: 600 },
  { k: 'simultaneidad_s', etiqueta: 'Ventana de simultaneidad del quórum', unidad: 's', min: 30, max: 900 },
  { k: 'duracion_min', etiqueta: 'La asistencia activada queda abierta', unidad: 'min', min: 10, max: 300 },
];

export function ConfigQuorum({ classId }: { classId: string }) {
  const cfg = useAsync(() => configQuorum(classId), [classId]);
  const [aj, setAj] = useState<AjustesQuorum | null>(null);
  const [horario, setHorario] = useState<{ dia_semana: number; hora: string }[]>([]);
  const [ok, setOk] = useState(false);
  const accion = useAction();
  useEffect(() => {
    if (cfg.data) { setAj(cfg.data.ajustes); setHorario(cfg.data.horario.map((h) => ({ dia_semana: h.dia_semana, hora: h.hora }))); }
  }, [cfg.data]);
  if (cfg.loading) return <Spinner />;
  if (cfg.data === null) return <p className="text-sm text-gray-500">Disponible al instalar la migración 43.</p>;
  if (!aj) return <ErrorBox error={cfg.error} />;
  const guardar = () => void accion.run(async () => { setOk(false); await guardarConfigQuorum(classId, aj, horario); await cfg.reload(); setOk(true); });
  return (
    <div className="space-y-3 text-sm">
      <p className="text-gray-600 dark:text-gray-300">
        A la hora de clase, si {aj.quorum} estudiantes matriculados, con dispositivos distintos, están a menos de {aj.radio_quorum_m} m entre sí y pulsan «Estoy aquí», la asistencia
        se activa sola y quedan presentes. Los demás se validan uno a uno: dentro de {aj.radio_general_m} m del centro del grupo inicial (que no se mueve) y a menos de {aj.radio_proximidad_m} m
        de alguien ya validado recientemente. Usted conserva todo el control: abrir con código, cerrar, marcar o quitar a mano.
      </p>
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={aj.enabled} onChange={(e) => setAj({ ...aj, enabled: e.target.checked })} /> Permitir la activación colectiva en esta sección
      </label>
      <div>
        <p className="font-medium">Horario de clase (hora de Santo Domingo)</p>
        {horario.map((h, i) => (
          <div key={i} className="mt-1 flex flex-wrap items-center gap-2">
            <select className="campo !w-auto" value={h.dia_semana} onChange={(e) => setHorario(horario.map((x, j) => j === i ? { ...x, dia_semana: Number(e.target.value) } : x))} aria-label="Día">
              {DIAS.slice(1).map((d, k) => <option key={d} value={k + 1}>{d}</option>)}
            </select>
            <input type="time" className="campo !w-auto" value={h.hora} onChange={(e) => setHorario(horario.map((x, j) => j === i ? { ...x, hora: e.target.value } : x))} aria-label="Hora" />
            <button className="btn-texto text-xs" onClick={() => setHorario(horario.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
        <button className="btn-secundario mt-1 py-1 text-xs" onClick={() => setHorario([...horario, { dia_semana: 1, hora: '16:00' }])}>+ Añadir clase</button>
        {cfg.data?.proxima && <p className="mt-1 text-xs text-gray-500">Próxima: {new Date(cfg.data.proxima).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Santo_Domingo' })}, {horaLocal(Date.parse(cfg.data.proxima))}</p>}
      </div>
      <details>
        <summary className="cursor-pointer font-medium">Parámetros avanzados</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <label key={c.k} className="block">
              <span className="text-xs">{c.etiqueta}</span>
              <span className="flex items-center gap-1">
                <input type="number" className="campo !w-24" min={c.min} max={c.max} value={aj[c.k] as number}
                  onChange={(e) => setAj({ ...aj, [c.k]: Math.min(c.max, Math.max(c.min, Number(e.target.value) || c.min)) })} />
                <span className="text-xs text-gray-500">{c.unidad}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">Una ubicación con precisión peor que el umbral, o cerca de un límite, se trata como «inconclusa» (no como ausencia): el estudiante puede reintentar o usted puede validarlo a mano.</p>
      </details>
      <ErrorBox error={accion.error} />
      {ok && <Notice tone="ok">Guardado.</Notice>}
      <button className="btn-primario" disabled={accion.busy} onClick={guardar}>Guardar</button>
    </div>
  );
}
