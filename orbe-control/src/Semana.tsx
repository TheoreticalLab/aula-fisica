/**
 * ORBE CONTROL · «Semana» (migración 68): resumen semanal del profesor. Lo pendiente en sus secciones y el gasto de IA
 * de los últimos 7 días. Los controles se resuelven aquí (pestaña Control); el resto abre el aula.
 */
import { useCallback, useEffect, useState } from 'react';
import { rpc } from './supabase';
import { actividadSemana, avisos, PROPOSITOS, rutaAviso, usd, type ResumenSemanal } from '../../src/lib/resumenSemanal';

export function Semana({ irAControl }: { irAControl: () => void }) {
  const [r, setR] = useState<ResumenSemanal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try { setR(await rpc<ResumenSemanal>('resumen_semanal')); }
    catch (e) { setError(/Could not find the function|PGRST202|schema cache/i.test(String(e)) ? 'Falta instalar la migración 68 en el servidor.' : e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando && !r) return <p className="vacio">Cargando el resumen de la semana…</p>;
  if (error) return <p className="error" onClick={() => void cargar()}>{error} (toque para reintentar)</p>;
  if (!r) return null;
  const lista = avisos(r);
  const act = actividadSemana(r);
  const propositos = Object.entries(r.ia.mio_por_proposito).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <section className="tarjeta">
        <p className="tenue">ÚLTIMOS 7 DÍAS</p>
        <p>{act.controles} control(es) realizados · {act.coincidencias} coincidencia(s) de archivos registradas</p>
        <button className="boton pequeno" onClick={() => void cargar()} disabled={cargando}>{cargando ? 'Actualizando…' : 'Actualizar'}</button>
      </section>
      {lista.length === 0 ? <p className="vacio">Nada pendiente en sus secciones. ✓</p> : lista.map((a) => {
        const ruta = rutaAviso(a.destino);
        return (
          <article key={a.clave} className="tarjeta">
            <p className="tenue">{a.seccion.toUpperCase()}</p>
            <p className="nombre">{a.tono === 'red' ? '⛔ ' : a.tono === 'amber' ? '⚠️ ' : ''}{a.texto}</p>
            {ruta ? <a className="boton pequeno" href={`../#${ruta}`} target="_blank" rel="noreferrer">Abrir en el aula</a>
              : <button className="boton pequeno" onClick={irAControl}>Ir a Control</button>}
          </article>
        );
      })}
      <section className="tarjeta">
        <p className="tenue">GASTO DE IA A SU NOMBRE</p>
        <p className="cifra">{usd(r.ia.mio_usd)}</p>
        <p className="tenue">{r.ia.mio_llamadas} llamada(s){propositos.length ? ` · ${propositos.map(([k, v]) => `${PROPOSITOS[k] ?? k} ${usd(v)}`).join(' · ')}` : ''}</p>
        {r.es_admin && r.ia.total_usd !== null && <p className="tenue">Total del aula esta semana {usd(r.ia.total_usd)} · este mes {usd(r.ia.mes_usd)}{r.ia.presupuesto_mes ? ` de ${usd(r.ia.presupuesto_mes)}` : ''}</p>}
      </section>
    </div>
  );
}
