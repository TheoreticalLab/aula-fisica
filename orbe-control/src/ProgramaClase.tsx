/**
 * ORBE CONTROL · «Programa» (migración 71): desde el teléfono, al terminar la clase, marque qué subtemas del programa
 * se impartieron hoy en la sección (y, si quiere, en qué clase impartida). Solo asignaturas con programa.
 */
import { useCallback, useEffect, useState } from 'react';
import { rpc } from './supabase';
import { avanceSubtemas, fechasImpartido, hoySantoDomingo, NIVELES, sumarAvances, type ProgramaSeccion } from '../../src/lib/programa';

export function ProgramaClase({ secciones }: { secciones: [string, string][] }) {
  const [seccion, setSeccion] = useState(secciones[0]?.[0] ?? '');
  const [p, setP] = useState<ProgramaSeccion | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sesion, setSesion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hoy = hoySantoDomingo();

  const cargar = useCallback(async () => {
    if (!seccion) return;
    setError(null);
    try { setP(await rpc<ProgramaSeccion>('programa_seccion', { p_class: seccion })); }
    catch (e) { setP(null); setError(/Could not find the function|PGRST202|schema cache/i.test(String(e)) ? 'Falta instalar la migración 71 en el servidor.' : e instanceof Error ? e.message : String(e)); }
  }, [seccion]);
  useEffect(() => { setSel(new Set()); setSesion(''); void cargar(); }, [cargar]);

  async function marcar() {
    setBusy(true); setError(null);
    try {
      const n = await rpc<number>('programa_marcar', { p_class: seccion, p_concepts: [...sel], p_fecha: hoy, p_session: sesion || null, p_nota: null });
      setAviso(`✓ ${n} subtema(s) marcados como impartidos hoy.`);
      setSel(new Set());
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const caps = p?.unidades.flatMap((u) => u.capitulos) ?? [];
  const av = sumarAvances(caps.map((c) => avanceSubtemas(c.subtemas)));
  const sesionesHoy = p?.sesiones.filter((s) => s.fecha === hoy) ?? [];
  return (
    <div>
      <div className="filtros">
        <select aria-label="Sección" value={seccion} onChange={(e) => setSeccion(e.target.value)}>
          {secciones.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      {aviso && <p className="ok" onClick={() => setAviso(null)}>{aviso}</p>}
      {p && !p.programa && <p className="vacio">Esta asignatura no usa el seguimiento del programa.</p>}
      {p && p.programa && (
        <>
          <section className="tarjeta">
            <p className="tenue">AVANCE DE LA SECCIÓN</p>
            <p>Esenciales impartidos: {av.esencialesImpartidos} de {av.esenciales} · todos: {av.impartidos} de {av.total}</p>
            {sesionesHoy.length > 0 && (
              <label className="tenue">Clase impartida de hoy:{' '}
                <select value={sesion} onChange={(e) => setSesion(e.target.value)}>
                  <option value="">— ninguna —</option>
                  {sesionesHoy.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
                </select>
              </label>
            )}
            <button className="boton" disabled={!sel.size || busy} onClick={() => void marcar()}>
              {busy ? 'Guardando…' : `Marcar ${sel.size || ''} como impartidos hoy (${fechasImpartido([hoy])})`}
            </button>
          </section>
          {p.unidades.map((u) => (
            <section key={u.id} className="grupo">
              <div className="grupo-cab"><h2>{u.titulo.toUpperCase()}</h2></div>
              {u.capitulos.map((c) => (
                <details key={c.id} className="tarjeta">
                  <summary><strong>{c.titulo}</strong> <span className="tenue">· {avanceSubtemas(c.subtemas).impartidos}/{c.subtemas.filter((s) => !s.oculto).length}</span></summary>
                  {c.subtemas.filter((s) => !s.oculto).map((s) => (
                    <label key={s.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', margin: '0.4rem 0' }}>
                      <input type="checkbox" checked={sel.has(s.id)} onChange={(e) => setSel((x) => { const n = new Set(x); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                      <span>{s.nombre} <span className="tenue">({NIVELES[s.nivel].etiqueta.toLowerCase()})</span>
                        {s.impartido.length > 0 && <span className="tenue"> · ✓ {fechasImpartido(s.impartido.map((k) => k.fecha))}</span>}</span>
                    </label>
                  ))}
                </details>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
