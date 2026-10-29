/**
 * PULSO DE LA CLASE: qué está pasando ahora mismo en el aula (cifras agregadas de los últimos 15 minutos, sin
 * nombres) y, a petición, un resumen con una sugerencia para la clase redactados por Claude.
 */
import { useCallback, useEffect, useState } from 'react';
import { rpc } from './supabase';
import { pedirIA } from './ia';

interface DatosPulso {
  ventana_min: number; inscritos: number; conectados: number; en_segundo_plano: number; sin_actividad_reciente: number;
  por_lugar: { lugar: string; seccion: string | null; estudiantes: number }[];
  ejercicios: { enunciado: string; leccion: string | null; intentos: number; estudiantes: number; correctos: number; error_frecuente: string | null }[];
}

const SECCION: Record<string, string> = { teoria: 'Teoría', ejemplos: 'Ejemplos', practica: 'Práctica', comprension: 'Comprensión', simulacion: 'Simulación', formulas: 'Fórmulas', actividad: 'Actividad', intento: 'Resolviendo' };
const ERROR: Record<string, string> = {
  unit_mismatch: 'unidad de otra magnitud', missing_unit: 'falta la unidad', expected_unit: 'unidad no pedida', sign: 'signo cambiado',
  kmh: 'conversión km/h–m/s', time_conversion: 'conversión de tiempo', power_of_ten: 'potencia de 10', factor_two: 'factor 2', mass_weight: 'masa/peso',
};

export function Pulso({ secciones }: { secciones: [string, string][] }) {
  const [clase, setClase] = useState('');
  const [d, setD] = useState<DatosPulso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ia, setIa] = useState<{ resumen: string; sugerencia: string; simulado: boolean } | null>(null);
  const [pensando, setPensando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setD(await rpc<DatosPulso>('control_pulso', { p_class: clase || null }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [clase]);
  useEffect(() => {
    setIa(null);
    void cargar();
    const t = window.setInterval(() => void cargar(), 20_000);
    return () => window.clearInterval(t);
  }, [cargar]);

  async function sugerir() {
    if (!d) return;
    setPensando(true); setError(null);
    try {
      const r = await pedirIA<{ resumen: string; sugerencia: string }>({ action: 'pulso', pulso: d });
      setIa({ ...r.resultado, simulado: r.simulado });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPensando(false);
    }
  }

  return (
    <div className="asistencia">
      <select aria-label="Sección" value={clase} onChange={(e) => setClase(e.target.value)}>
        <option value="">Todas mis secciones</option>
        {secciones.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
      </select>
      {error && <p className="error">{error}</p>}
      {!d ? <p className="tenue">Cargando…</p> : <>
        <section className="tarjeta resumen">
          <p className="tenue">CONECTADOS AHORA</p>
          <p className="cifra">{d.conectados}<span className="tenue"> / {d.inscritos}</span></p>
          <p className="tenue">{d.en_segundo_plano} con el aula en segundo plano · {d.sin_actividad_reciente} sin actividad en 5 min</p>
          <button className="boton" disabled={pensando} onClick={() => void sugerir()}>{pensando ? 'Pensando…' : '✨ Resumen y sugerencia de Claude'}</button>
        </section>
        {ia && (
          <section className="tarjeta ia">
            <p><strong>{ia.resumen}</strong></p>
            <p>💡 {ia.sugerencia}</p>
            <p className="tenue pequeno">{ia.simulado ? 'Simulador (sin coste).' : 'Claude solo recibió cifras, sin nombres.'}</p>
          </section>
        )}
        <section className="grupo">
          <h2>DÓNDE ESTÁN</h2>
          {d.por_lugar.length ? d.por_lugar.map((x, i) => (
            <article key={i} className="tarjeta alumno"><div><p className="nombre">{x.lugar}</p>{x.seccion && <p className="tenue">{SECCION[x.seccion] ?? x.seccion}</p>}</div><p className="cifra-pequena">{x.estudiantes}</p></article>
          )) : <p className="vacio">Nadie conectado en este momento.</p>}
        </section>
        <section className="grupo">
          <h2>DONDE SE EQUIVOCAN (ÚLTIMOS {d.ventana_min} MIN)</h2>
          {d.ejercicios.length ? d.ejercicios.map((x, i) => (
            <article key={i} className="tarjeta">
              <p>{x.enunciado}{x.enunciado.length >= 90 ? '…' : ''}</p>
              <p className="tenue">{x.leccion ?? ''} · {x.estudiantes} estudiante(s) · {x.correctos}/{x.intentos} intentos correctos
                {x.error_frecuente && <> · <span className="advertencia">{ERROR[x.error_frecuente] ?? x.error_frecuente}</span></>}</p>
            </article>
          )) : <p className="vacio">Sin errores en los últimos minutos.</p>}
        </section>
        <p className="tenue pequeno">Se actualiza cada 20 segundos. Solo cifras: para ver a cada estudiante, use «Conectados».</p>
      </>}
    </div>
  );
}
