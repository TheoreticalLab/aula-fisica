/**
 * Orbe Control · asistencia autónoma por quórum de proximidad de una sección: activarla, horario semanal (hora de
 * Santo Domingo) y parámetros. Mismas funciones del servidor que el panel web (attendance_quorum_config/configurar).
 */
import { useEffect, useState } from 'react';
import { rpc } from './supabase';
import { horaLocal } from '../../src/lib/quorum';

interface Ajustes {
  enabled: boolean; quorum: number; ventana_min: number; radio_quorum_m: number; radio_proximidad_m: number; radio_general_m: number;
  vigencia_ref_min: number; precision_max_m: number; edad_max_s: number; simultaneidad_s: number; duracion_min: number;
}
interface Config { ajustes: Ajustes; horario: { dia_semana: number; hora: string }[]; proxima: string | null }

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CAMPOS: { k: keyof Ajustes; etiqueta: string; min: number; max: number }[] = [
  { k: 'quorum', etiqueta: 'Quórum mínimo (estudiantes)', min: 3, max: 6 },
  { k: 'ventana_min', etiqueta: 'Minutos para formar el quórum desde la hora', min: 5, max: 120 },
  { k: 'radio_quorum_m', etiqueta: 'Distancia máxima entre los del quórum (m)', min: 10, max: 200 },
  { k: 'radio_general_m', etiqueta: 'Radio de la zona alrededor del centro (m)', min: 20, max: 2000 },
  { k: 'radio_proximidad_m', etiqueta: 'Distancia máxima a un estudiante ya validado (m)', min: 10, max: 200 },
  { k: 'vigencia_ref_min', etiqueta: 'Vigencia de la ubicación de un admitido (min)', min: 2, max: 180 },
  { k: 'precision_max_m', etiqueta: 'Peor precisión aceptable del GPS (m)', min: 5, max: 500 },
  { k: 'edad_max_s', etiqueta: 'Antigüedad máxima de la medición (s)', min: 10, max: 600 },
  { k: 'simultaneidad_s', etiqueta: 'Ventana de simultaneidad del quórum (s)', min: 30, max: 900 },
  { k: 'duracion_min', etiqueta: 'La asistencia activada queda abierta (min)', min: 10, max: 300 },
];
const ausente = (e: unknown) => /Could not find the function|PGRST202|schema cache/i.test(e instanceof Error ? e.message : String(e));

export function QuorumConfig({ classId }: { classId: string }) {
  const [cfg, setCfg] = useState<Config | null | 'sin_migracion'>(null);
  const [aj, setAj] = useState<Ajustes | null>(null);
  const [horario, setHorario] = useState<{ dia_semana: number; hora: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCfg(null); setOk(false); setError(null);
    rpc<Config>('attendance_quorum_config', { p_class: classId })
      .then((c) => { if (!vivo) return; setCfg(c); setAj(c.ajustes); setHorario(c.horario.map((h) => ({ dia_semana: h.dia_semana, hora: h.hora }))); })
      .catch((e) => { if (!vivo) return; if (ausente(e)) setCfg('sin_migracion'); else setError(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [classId]);

  if (cfg === 'sin_migracion') return <p className="tenue pequeno">La activación por quórum estará disponible al instalar la migración 43.</p>;
  if (!cfg || !aj) return error ? <p className="error">{error}</p> : <p className="tenue">Cargando…</p>;

  async function guardar() {
    setBusy(true); setError(null); setOk(false);
    try {
      const c = await rpc<Config>('attendance_quorum_configurar', { p_class: classId, p_ajustes: aj, p_horario: horario });
      setCfg(c); setAj(c.ajustes); setOk(true);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  return (
    <section className="tarjeta modal quorum">
      <h2>ASISTENCIA AUTÓNOMA POR QUÓRUM</h2>
      <p className="tenue pequeno">
        A la hora de clase, si {aj.quorum} estudiantes con teléfonos distintos están a menos de {aj.radio_quorum_m} m entre sí y pulsan «Estoy aquí», la
        asistencia se activa sola y quedan presentes. Los demás se validan dentro de {aj.radio_general_m} m del centro del grupo inicial (fijo) y a menos de
        {' '}{aj.radio_proximidad_m} m de alguien ya validado. Usted puede abrir con código, cerrar, marcar o quitar en cualquier momento.
      </p>
      <label className="casilla"><input type="checkbox" checked={aj.enabled} onChange={(e) => setAj({ ...aj, enabled: e.target.checked })} /> Permitir la activación colectiva en esta sección</label>
      <p className="tenue">Horario de clase (hora de Santo Domingo)</p>
      {horario.map((h, i) => (
        <div key={i} className="fila-horario">
          <select value={h.dia_semana} onChange={(e) => setHorario(horario.map((x, j) => (j === i ? { ...x, dia_semana: Number(e.target.value) } : x)))} aria-label="Día">
            {DIAS.map((d, k) => <option key={d} value={k + 1}>{d}</option>)}
          </select>
          <input type="time" value={h.hora} onChange={(e) => setHorario(horario.map((x, j) => (j === i ? { ...x, hora: e.target.value } : x)))} aria-label="Hora" />
          <button className="boton secundario pequeno" onClick={() => setHorario(horario.filter((_, j) => j !== i))}>Quitar</button>
        </div>
      ))}
      <button className="boton secundario pequeno" onClick={() => setHorario([...horario, { dia_semana: 1, hora: '16:00' }])}>+ Añadir clase</button>
      {cfg.proxima && <p className="tenue pequeno">Próxima: {new Date(cfg.proxima).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Santo_Domingo' })}, {horaLocal(Date.parse(cfg.proxima))}</p>}
      <details>
        <summary className="tenue">Parámetros avanzados</summary>
        {CAMPOS.map((c) => (
          <label key={c.k}>{c.etiqueta}
            <input type="number" inputMode="numeric" min={c.min} max={c.max} value={aj[c.k] as number}
              onChange={(e) => setAj({ ...aj, [c.k]: Math.min(c.max, Math.max(c.min, Number(e.target.value) || c.min)) })} />
          </label>
        ))}
        <p className="tenue pequeno">Una ubicación imprecisa o en el límite queda «inconclusa», no ausente: el estudiante reintenta o usted lo marca a mano.</p>
      </details>
      {error && <p className="error">{error}</p>}
      {ok && <p className="ok">Guardado.</p>}
      <button className="boton grande" disabled={busy} onClick={() => void guardar()}>Guardar</button>
    </section>
  );
}
