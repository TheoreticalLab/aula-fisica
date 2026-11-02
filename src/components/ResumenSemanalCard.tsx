/**
 * Panel docente · «Esta semana» (migración 68): lo pendiente en sus secciones (controles por confirmar, coincidencias
 * de archivos, fotos y clases ampliadas por revisar, estudiantes bloqueados por la regularización, preguntas de IA sin
 * publicar) y el gasto de IA de los últimos 7 días. Sin la migración, no se muestra.
 */
import { Link } from 'react-router-dom';
import { rpc } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { actividadSemana, avisos, PROPOSITOS, rutaAviso, usd, type ResumenSemanal } from '@/lib/resumenSemanal';
import { Badge } from '@/components/ui';

const cargar = () => rpc<ResumenSemanal>('resumen_semanal').catch((e) => {
  if (/Could not find the function|PGRST202|schema cache/i.test(e instanceof Error ? e.message : String(e))) return null;
  throw e;
});

export function ResumenSemanalCard() {
  const st = useAsync(cargar, []);
  if (st.loading || !st.data) return st.error ? <p className="text-xs text-red-700">No se pudo cargar el resumen de la semana.</p> : null;
  const r = st.data;
  const lista = avisos(r);
  const act = actividadSemana(r);
  const propositos = Object.entries(r.ia.mio_por_proposito).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <section className="tarjeta" aria-labelledby="resumen-semanal">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="resumen-semanal" className="font-semibold">🗓️ Esta semana</h2>
        <span className="text-xs text-gray-500">últimos 7 días · {act.controles} control(es) realizados · {act.coincidencias} coincidencia(s) de archivos registradas</span>
      </div>
      {lista.length === 0 ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">Nada pendiente en sus secciones. ✓</p> : (
        <ul className="mt-2 divide-y divide-gray-100 text-sm dark:divide-white/10">
          {lista.map((a) => {
            const ruta = rutaAviso(a.destino);
            return (
              <li key={a.clave} className="flex flex-wrap items-center gap-2 py-1.5">
                <Badge tone={a.tono}>{a.seccion}</Badge>
                <span className="min-w-0 flex-1">{a.texto}</span>
                {ruta ? <Link className="enlace text-xs" to={ruta}>Abrir</Link>
                  : <a className="enlace text-xs" href={`${import.meta.env.BASE_URL}control/`} target="_blank" rel="noreferrer">Abrir Orbe Control</a>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-gray-500">
        Gasto de IA a su nombre: <strong>{usd(r.ia.mio_usd)}</strong> en {r.ia.mio_llamadas} llamada(s)
        {propositos.length > 0 && <> ({propositos.map(([k, v]) => `${PROPOSITOS[k] ?? k} ${usd(v)}`).join(' · ')})</>}
        {r.es_admin && r.ia.total_usd !== null && <> · total del aula esta semana {usd(r.ia.total_usd)} · este mes {usd(r.ia.mes_usd)}{r.ia.presupuesto_mes ? ` de ${usd(r.ia.presupuesto_mes)}` : ''}</>}.
      </p>
    </section>
  );
}
