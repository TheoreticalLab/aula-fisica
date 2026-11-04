/**
 * Práctica extraordinaria → Añadir un ejercicio → «✨ Generar con IA»: paquetes de 1 a 50 problemas por apartados,
 * repartidos entre las lecciones, dificultades y tipos elegidos. Cada problema llega como PROPUESTA verificada por el
 * servidor (cálculos y unidades de las numéricas); el profesor la añade tal cual, la edita antes de añadirla o la descarta.
 */
import { useMemo, useRef, useState } from 'react';
import { describeKey } from '@calif/calificar.ts';
import type { AnswerKey } from '@calif/tipos.ts';
import { generarEstimacion, generarTemas } from '@/api/generacion';
import {
  pesGenerarIniciar, pesGenerarProblema, pesPropuestaAceptar, pesPropuestaDescartar, pesPropuestas,
  type ApartadoRedactado, type DetallePes, type PropuestaPes,
} from '@/api/pes';
import {
  aFormulario, DESCARTES_SEGUIDOS_MAX, estimarPes, MAX_PAQUETE, MOTIVO_IA, NIVELES_PES, planificarPes, TIPOS_PES, type NivelPes, type TipoProblemaPes,
} from '@/lib/pesGeneracion';
import { FORMATO, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Notice, Spinner } from '@/components/ui';
import { InlineMd, Markdown } from '@/components/Markdown';
import { AgregarRedactado } from './PesEditor';

const ETAPA: Record<string, string> = {
  prediccion: 'Predicción', formulacion: 'Formulación', resolucion: 'Resolución', interpretacion: 'Interpretación', transferencia: 'Transferencia', otra: 'Otra',
};
const usd = (x: number) => `US$ ${x.toFixed(x < 1 ? 3 : 2)}`;

export function GenerarConIA({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const courseId = d.practica.course_id;
  const temas = useAsync(() => generarTemas(courseId), [courseId]);
  const est = useAsync(() => generarEstimacion(courseId), [courseId]);
  const props = useAsync(() => pesPropuestas(d.practica.id, 'pendiente'), [d.practica.id]);
  const [lecciones, setLecciones] = useState<string[]>([]);
  const [niveles, setNiveles] = useState<NivelPes[]>(['intermedio']);
  const [tipos, setTipos] = useState<TipoProblemaPes[]>(['calculo']);
  const [apartados, setApartados] = useState<3 | 4 | 5>(4);
  const [n, setN] = useState(5);
  const [prog, setProg] = useState<{ hechos: number; total: number; creados: number; rechazos: string[]; costo: number; simulado: boolean; parado: string | null } | null>(null);
  const corriendo = useRef(false);
  const detener = useRef(false);
  const act = useAction();

  const plan = useMemo(() => planificarPes(n, lecciones, niveles, tipos, apartados), [n, lecciones, niveles, tipos, apartados]);
  const estim = est.data ? estimarPes(plan.length, apartados, est.data) : null;
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

  async function generar() {
    if (!plan.length || corriendo.current) return;
    corriendo.current = true; detener.current = false;
    setProg({ hechos: 0, total: plan.length, creados: 0, rechazos: [], costo: 0, simulado: false, parado: null });
    try {
      const gen = await act.run(() => pesGenerarIniciar(d.practica.id, { lecciones, niveles, tipos, apartados }, plan.length));
      if (!gen) return;
      let seguidos = 0;                           // descartes seguidos: cada uno se cobra
      for (let i = 0; i < plan.length; i++) {
        if (detener.current) { setProg((p) => p && { ...p, parado: 'Detenido por usted.' }); break; }
        let r;
        try { r = await pesGenerarProblema(gen, plan[i]); }
        catch (e) { r = { ok: false, motivo: e instanceof Error ? e.message : String(e) }; }
        if (!r.ok) {
          // presupuesto, límite, apagado, clave…: no tiene sentido seguir
          setProg((p) => p && { ...p, hechos: i + 1, parado: `Se detuvo: ${MOTIVO_IA[r.motivo ?? ''] ?? r.motivo}.` });
          break;
        }
        setProg((p) => p && { ...p, hechos: i + 1, creados: p.creados + (r.propuesta_id ? 1 : 0), costo: p.costo + (r.costo_usd ?? 0), simulado: !!r.simulado,
          rechazos: r.rechazado ? [...p.rechazos, `Problema ${i + 1}: ${r.rechazado}`] : p.rechazos });
        if (r.propuesta_id) void props.reload();
        seguidos = r.rechazado ? seguidos + 1 : 0;
        if (seguidos >= DESCARTES_SEGUIDOS_MAX && i + 1 < plan.length) {
          setProg((p) => p && { ...p, parado: `Se detuvo para no gastar más: ${DESCARTES_SEGUIDOS_MAX} problemas seguidos descartados por el servidor. Revise los motivos; pruebe con otra lección, otro tipo o menos apartados.` });
          break;
        }
      }
    } finally {
      corriendo.current = false;
      void props.reload(); void est.reload();
    }
  }

  if (temas.loading && !temas.data) return <Spinner />;
  if (temas.error) return <ErrorBox error={temas.error} onRetry={temas.reload} />;
  return (
    <div className="space-y-4">
      <Notice>La IA redacta problemas completos de {apartados} apartados por etapas. El servidor comprueba cada cálculo numérico (datos escritos en el enunciado, fórmula,
        unidades y resultado) y la estructura; aun así, <strong>revise la física de cada propuesta</strong> antes de añadirla. La IA solo recibe el temario, nunca datos de estudiantes.</Notice>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold">Lecciones ({lecciones.length})</h3>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded border border-gray-200 p-2 text-sm dark:border-white/10">
            {(temas.data?.unidades ?? []).map((u) => (
              <details key={u.id} open={u.lecciones.some((l) => lecciones.includes(l.id))}>
                <summary className="cursor-pointer font-medium">{u.titulo}</summary>
                {u.lecciones.map((l) => (
                  <label key={l.id} className="ml-3 flex items-center gap-2">
                    <input type="checkbox" checked={lecciones.includes(l.id)} onChange={() => setLecciones(toggle(lecciones, l.id))} />{l.titulo}
                  </label>
                ))}
              </details>
            ))}
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div><h3 className="mb-1 font-semibold">Dificultad</h3>
            <div className="flex flex-wrap gap-3">{NIVELES_PES.map((x) => (
              <label key={x.id} className="flex items-center gap-1"><input type="checkbox" checked={niveles.includes(x.id)} onChange={() => setNiveles(toggle(niveles, x.id))} />{x.t}</label>
            ))}</div>
          </div>
          <div><h3 className="mb-1 font-semibold">Tipo de problema</h3>
            {TIPOS_PES.map((x) => (
              <label key={x.id} className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={tipos.includes(x.id)} onChange={() => setTipos(toggle(tipos, x.id))} />
                <span><strong>{x.t}</strong> <span className="text-xs text-gray-500">— {x.d}</span></span></label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 font-semibold">Apartados
              <select className="campo w-20" value={apartados} onChange={(e) => setApartados(Number(e.target.value) as 3 | 4 | 5)}>
                <option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
              </select></label>
            <span className="font-semibold">Cantidad</span>
            {[1, 5, 10, 20].map((k) => <button key={k} type="button" className={n === k ? 'btn-primario px-3' : 'btn-secundario px-3'} onClick={() => setN(k)}>{k}</button>)}
            <input type="number" min={1} max={MAX_PAQUETE} className="campo w-20" value={n} onChange={(e) => setN(Math.max(1, Math.min(MAX_PAQUETE, Number(e.target.value) || 1)))} />
          </div>
          <p className="text-xs text-gray-500">El paquete se reparte por igual entre las lecciones, dificultades y tipos marcados.</p>
        </div>
      </div>

      {estim && (
        <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/5">
          {estim.simulado ? <p>Simulación: sin coste.</p>
            : <p>Coste estimado del paquete: <strong>{usd(estim.costoTipico)}</strong> (máximo {usd(estim.costoMaximo)}) · quedan {usd(estim.restantePresupuesto)} del presupuesto del mes · {estim.llamadasRestantesHoy} llamadas hoy.</p>}
          {estim.avisos.map((a) => <p key={a} className="text-xs text-amber-700 dark:text-amber-300">{a}</p>)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primario" disabled={!plan.length || corriendo.current || !est.data?.encendido}
          onClick={() => void generar()}>✨ Generar paquete de {plan.length || n} problema{plan.length === 1 ? '' : 's'}</button>
        {corriendo.current && <button type="button" className="btn-secundario" onClick={() => { detener.current = true; }}>Detener después del actual</button>}
        {!lecciones.length && <span className="text-xs text-gray-500">Elija al menos una lección.</span>}
      </div>
      <ErrorBox error={act.error} />
      {prog && (
        <Card title={`Paquete: ${prog.hechos} de ${prog.total}${prog.simulado ? ' (simulación)' : ''}`}>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"><div className="h-full bg-primario-600" style={{ width: `${(prog.hechos / prog.total) * 100}%` }} /></div>
          <p className="mt-2 text-sm">{prog.creados} propuesta(s) verificadas · {prog.rechazos.length} descartada(s) por el servidor{prog.costo > 0 && ` · coste ${usd(prog.costo)}`}</p>
          {prog.parado && <p className="text-sm text-amber-700">{prog.parado}</p>}
          {prog.rechazos.length > 0 && (
            <details className="mt-1 text-xs"><summary className="cursor-pointer">Por qué se descartaron</summary>
              <ul className="list-disc pl-5">{prog.rechazos.map((x) => <li key={x}>{x}</li>)}</ul></details>
          )}
        </Card>
      )}

      <Propuestas d={d} props={props.data ?? null} cargando={props.loading} recargarPropuestas={props.reload} recargar={recargar} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
function resumenClave(a: ApartadoRedactado): string {
  if (a.formato === 'open') return `Rúbrica: ${a.rubrica ?? ''}`;
  if (!a.clave) return '⚠ sin clave';
  try { return describeKey(a.clave as unknown as AnswerKey, a.opciones); } catch { return 'clave no legible'; }
}

function Propuestas({ d, props, cargando, recargarPropuestas, recargar }: {
  d: DetallePes; props: PropuestaPes[] | null; cargando: boolean; recargarPropuestas: () => Promise<void>; recargar: () => Promise<void>;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const act = useAction();
  const hecho = async () => { await recargarPropuestas(); await recargar(); };
  if (cargando && !props) return <Spinner />;
  const xs = props ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Propuestas por revisar ({xs.length})</h3>
        {xs.length > 1 && (
          <button type="button" className="btn-secundario ml-auto" disabled={act.busy} onClick={async () => {
            if (!confirm(`¿Añadir las ${xs.length} propuestas a la práctica? Revise antes la física de cada una.`)) return;
            for (const p of xs) await act.run(() => pesPropuestaAceptar(p.id));
            await hecho();
          }}>Añadir todas</button>
        )}
      </div>
      <ErrorBox error={act.error} />
      {xs.length === 0 && <Empty>No hay propuestas pendientes. Las que genere aparecerán aquí para revisarlas.</Empty>}
      {xs.map((p) => (
        <Card key={p.id} title={<>{p.problema.titulo} <Badge>{TIPOS_PES.find((t) => t.id === p.tipo)?.t ?? p.tipo}</Badge> <Badge tone="blue">{NIVELES_PES.find((x) => x.id === p.dificultad)?.t}</Badge></>}>
          {editando === p.id ? (
            <AgregarRedactado d={d} recargar={hecho} inicial={aFormulario(p.problema)} textoBoton="Comprobar claves y añadir esta versión"
              guardar={async (datos) => { const id = await pesPropuestaAceptar(p.id, datos); setEditando(null); return id; }} />
          ) : (
            <>
              <p className="text-xs text-gray-500">{p.leccion ?? ''}</p>
              <div className="mt-1 rounded bg-gray-50 p-2 text-sm dark:bg-white/5"><Markdown>{p.problema.contexto}</Markdown></div>
              <ol className="mt-2 space-y-2 text-sm">
                {p.problema.apartados.map((a, i) => (
                  <li key={i} className="border-l-2 border-gray-200 pl-2 dark:border-white/10">
                    <span className="font-semibold">{String.fromCharCode(65 + i)}.</span> <Badge>{ETAPA[a.etapa] ?? a.etapa}</Badge> <Badge>{FORMATO[a.formato] ?? a.formato}</Badge>
                    {p.verificacion[i] === 'calculo_comprobado' ? <Badge tone="green">cálculo comprobado</Badge> : <Badge tone="amber">revisar</Badge>}
                    <span className="ml-1 text-xs text-gray-500">{Math.round(a.t_ref_s / 60)} min</span>
                    <div className="mt-1"><InlineMd>{a.enunciado}</InlineMd></div>
                    {a.opciones && <ul className="ml-4 list-[lower-alpha] text-xs">{a.opciones.map((o) => <li key={o}><InlineMd>{o}</InlineMd></li>)}</ul>}
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">Respuesta: <InlineMd>{resumenClave(a)}</InlineMd></p>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-primario" disabled={act.busy} onClick={async () => { if ((await act.run(() => pesPropuestaAceptar(p.id))) !== undefined) await hecho(); }}>Añadir a la práctica</button>
                <button type="button" className="btn-secundario" onClick={() => setEditando(p.id)}>Editar y añadir</button>
                <button type="button" className="btn-secundario" disabled={act.busy} onClick={async () => { if ((await act.run(() => pesPropuestaDescartar(p.id))) !== undefined) await recargarPropuestas(); }}>Descartar</button>
              </div>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
