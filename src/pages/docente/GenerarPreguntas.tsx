/**
 * Generar preguntas con IA para el banco de una asignatura: por temas (lecciones), niveles y formatos, en la cantidad
 * pedida (50, 100…), con el COSTE ESTIMADO antes de empezar y el coste real al terminar. Todo queda como borrador del
 * banco (no publicado) para que el profesor lo revise. Las numéricas llegan con el cálculo comprobado en el servidor.
 * Con «?clase=<id>» (botón «Proponer preguntas de esta clase»), las preguntas evalúan lo trabajado en esa clase impartida.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listCourses } from '@/api/docente';
import { generarClaseInfo, generarEstimacion, generarIniciar, generarIniciarClase, generarLote, generarResumen, generarTemas, type ResumenGeneracion } from '@/api/generacion';
import { ENTRADA_CLASE, estimar, lotes, MAX_PREGUNTAS, planificar, type Formato, type Nivel } from '@/lib/generacion';
import { fechaClase } from '@/lib/clases';
import { useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';

const usd = (n: number) => `US$ ${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`;
const NOMBRE_NIVEL: Record<Nivel, string> = { basico: 'Básico', intermedio: 'Intermedio', desafiante: 'Desafiante' };
const NOMBRE_FORMATO: Record<Formato, string> = { numeric: 'Numérica (cálculo comprobado)', choice: 'Selección múltiple', truefalse: 'Verdadero / falso' };
const MOTIVOS: Record<string, string> = {
  apagado: 'Orbe IA está apagado (Orbe IA → Configuración general).', limite_diario: 'Se alcanzó el límite diario de llamadas de Orbe IA.',
  presupuesto: 'Se agotó el presupuesto mensual de Orbe IA.', permiso: 'Su cuenta no puede usar Orbe IA.', sin_clave: 'Falta la clave de la API en el servidor.',
  proposito: 'Falta instalar la migración 55 (generación de preguntas).', respuesta_cortada: 'La respuesta del modelo se cortó (demasiado larga).',
  formato: 'La respuesta del modelo no tenía el formato pedido.', red: 'No se pudo conectar con la API.', limite_api: 'La API está limitando las peticiones.',
};
const DETIENEN = new Set(['apagado', 'limite_diario', 'presupuesto', 'permiso', 'sin_clave', 'proposito']);

export default function GenerarPreguntas() {
  const [params, setParams] = useSearchParams();
  const cursos = useAsync(listCourses, []);
  const claseId = params.get('clase') || '';
  const clase = useAsync(() => (claseId ? generarClaseInfo(claseId) : Promise.resolve(null)), [claseId]);
  const courseId = clase.data?.course_id || params.get('curso') || cursos.data?.find((c) => !c.archived)?.id || '';
  const temas = useAsync(() => (courseId ? generarTemas(courseId) : Promise.resolve(null)), [courseId]);
  const datos = useAsync(() => (courseId ? generarEstimacion(courseId) : Promise.resolve(null)), [courseId]);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [n, setN] = useState(50);
  // desde una clase: se marcan las lecciones enlazadas a ella (o las de su unidad) y se proponen menos preguntas
  useEffect(() => {
    if (!clase.data) return;
    setElegidas(clase.data.lecciones);
    setN(10);
  }, [clase.data]);
  const [niveles, setNiveles] = useState<Record<Nivel, number>>({ basico: 30, intermedio: 50, desafiante: 20 });
  const [formatos, setFormatos] = useState<Record<Formato, number>>({ numeric: 60, choice: 30, truefalse: 10 });

  const plan = useMemo(() => planificar(n, elegidas, niveles, formatos), [n, elegidas, niveles, formatos]);
  const grupos = useMemo(() => lotes(plan, datos.data?.por_lote ?? 4), [plan, datos.data]);
  const est = datos.data ? estimar(grupos, datos.data, clase.data ? ENTRADA_CLASE : 0) : null;

  // ejecución
  const [corriendo, setCorriendo] = useState(false);
  const parar = useRef(false);
  const [prog, setProg] = useState<{ lote: number; total: number; creadas: number; verificadas: number; rechazadas: { pregunta: number; motivo: string }[]; costo: number; errores: string[]; simulado: boolean } | null>(null);
  const [resumen, setResumen] = useState<ResumenGeneracion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    if (!est || !grupos.length) return;
    if (!est.simulado && !window.confirm(`Va a generar ${est.preguntas} preguntas con ${datos.data!.modelo} en ${est.llamadas} llamadas.\n\nCoste estimado: ${usd(est.costoTipico)} (máximo posible ${usd(est.costoMaximo)}).\n\nQuedan como borradores para revisar. ¿Continuar?`)) return;
    setError(null); setResumen(null); parar.current = false; setCorriendo(true);
    const p = { lote: 0, total: grupos.length, creadas: 0, verificadas: 0, rechazadas: [] as { pregunta: number; motivo: string }[], costo: 0, errores: [] as string[], simulado: est.simulado };
    setProg({ ...p });
    let run: string | null = null;
    try {
      run = clase.data
        ? await generarIniciarClase(clase.data.session_id, { lecciones: elegidas, niveles, formatos, n }, plan.length)
        : await generarIniciar(courseId, { lecciones: elegidas, niveles, formatos, n }, plan.length);
      let seguidos = 0;
      for (const g of grupos) {
        if (parar.current) { p.errores.push('Detenido por usted.'); break; }
        p.lote++;
        try {
          const r = await generarLote(run, g);
          if (!r.ok) {
            const m = r.motivo ?? 'error';
            p.errores.push(`Lote ${p.lote}: ${MOTIVOS[m] ?? m}`);
            if (DETIENEN.has(m)) break;
            if (++seguidos >= 3) { p.errores.push('Tres lotes seguidos fallaron: se detiene.'); break; }
          } else {
            seguidos = 0;
            p.creadas += r.creadas ?? 0; p.verificadas += r.verificadas ?? 0; p.costo += r.costo_usd ?? 0; p.simulado = !!r.simulado;
            p.rechazadas.push(...(r.rechazadas ?? []));
          }
        } catch (e) {
          p.errores.push(`Lote ${p.lote}: ${e instanceof Error ? e.message : String(e)}`);
          if (++seguidos >= 3) { p.errores.push('Tres lotes seguidos fallaron: se detiene.'); break; }
        }
        setProg({ ...p, rechazadas: [...p.rechazadas], errores: [...p.errores] });
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally {
      setProg({ ...p, rechazadas: [...p.rechazadas], errores: [...p.errores] });
      setCorriendo(false);
      if (run) setResumen(await generarResumen(run).catch(() => null));
      datos.reload();
    }
  }

  if ((cursos.loading && !cursos.data) || (clase.loading && !clase.data)) return <Spinner />;
  const todas = (temas.data?.unidades ?? []).flatMap((u) => u.lecciones.map((l) => l.id));
  const alternar = (ids: string[], marcar: boolean) => setElegidas((x) => (marcar ? [...new Set([...x, ...ids])] : x.filter((y) => !ids.includes(y))));
  const sumaN = niveles.basico + niveles.intermedio + niveles.desafiante, sumaF = formatos.numeric + formatos.choice + formatos.truefalse;

  return (
    <div className="space-y-4">
      <PageTitle title={clase.data ? '✨ Proponer preguntas de esta clase' : '✨ Generar preguntas con IA'}
        subtitle={clase.data ? 'Preguntas nuevas sobre lo trabajado en la clase impartida, para el banco. Quedan como borradores para su revisión; nunca entran solas en una práctica o evaluación.' : 'Preguntas nuevas para el banco de una asignatura, por temas, niveles y formatos. Quedan como borradores para su revisión; nunca entran solas en una práctica o evaluación.'}
        back={clase.data ? { to: `/docente/clases-impartidas/${clase.data.session_id}`, label: clase.data.titulo } : { to: `/docente/ejercicios${courseId ? `?curso=${courseId}` : ''}`, label: 'Banco de ejercicios' }} />
      <ErrorBox error={cursos.error ?? clase.error ?? temas.error ?? datos.error ?? error} />
      {clase.data && (
        <Card title={`Clase impartida · ${clase.data.titulo}`}>
          <p className="text-sm">{fechaClase(clase.data.fecha)} · {clase.data.seccion}{clase.data.temas.length ? ` · temas: ${clase.data.temas.join(', ')}` : ''}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            El modelo recibe el tema y {clase.data.ampliada ? <>el texto de la <strong>clase ampliada</strong> ({clase.data.ampliada === 'publicada' ? 'versión publicada' : 'último borrador, aún sin publicar'})</> : <>la descripción (esta clase aún no tiene clase ampliada: las preguntas serán más generales)</>},
            sin fotos ni datos de estudiantes. Pide situaciones y valores nuevos, no los ejemplos de la pizarra.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {clase.data.lecciones.length ? 'Ya están marcadas las lecciones enlazadas a la clase (o las de su unidad); puede cambiarlas. ' : 'La clase no tiene lecciones enlazadas: elija abajo en qué lecciones del banco se guardan. '}
            {clase.data.ya_generadas > 0 && `Ya se propusieron ${clase.data.ya_generadas} pregunta(s) desde esta clase. `}
            Al publicarlas en el banco, aparecen como sugerencias en el catálogo de control de las prácticas que comparten sus conceptos.
          </p>
        </Card>
      )}

      <Card title="1. Asignatura y temas">
        <label className="text-sm"><span className="etiqueta">Asignatura</span>
          <select className="campo" value={courseId} disabled={corriendo || !!clase.data} onChange={(e) => { setElegidas([]); setParams({ curso: e.target.value }); }}>
            {(cursos.data ?? []).filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select></label>
        {temas.loading && !temas.data ? <Spinner /> : !temas.data?.unidades.length ? <Empty>Esta asignatura no tiene lecciones.</Empty> : (
          <div className="mt-3 space-y-3">
            <div className="flex gap-2 text-xs"><button className="btn-texto" onClick={() => setElegidas(todas)} disabled={corriendo}>Todas</button><button className="btn-texto" onClick={() => setElegidas([])} disabled={corriendo}>Ninguna</button>
              <span className="text-gray-500">{elegidas.length} lección(es) elegida(s)</span></div>
            {temas.data.unidades.map((u) => {
              const ids = u.lecciones.map((l) => l.id), todasU = ids.length > 0 && ids.every((i) => elegidas.includes(i));
              return (
                <details key={u.id} className="rounded border border-gray-200 p-2 dark:border-white/10" open={ids.some((i) => elegidas.includes(i))}>
                  <summary className="cursor-pointer text-sm font-medium">
                    <input type="checkbox" className="mr-2" checked={todasU} disabled={corriendo} onChange={(e) => alternar(ids, e.target.checked)} onClick={(e) => e.stopPropagation()} />
                    {u.titulo} <span className="text-xs text-gray-500">({u.lecciones.length})</span></summary>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {u.lecciones.map((l) => (
                      <label key={l.id} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={elegidas.includes(l.id)} disabled={corriendo} onChange={(e) => alternar([l.id], e.target.checked)} />
                        <span>{l.titulo}{l.oculta && <Badge>oculta</Badge>}
                          <span className="block text-xs text-gray-500">En el banco: {l.banco.basico} básicas · {l.banco.intermedio} intermedias · {l.banco.desafiante} desafiantes{l.conceptos.length ? ` · ${l.conceptos.length} conceptos` : ''}</span></span>
                      </label>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="2. Cantidad, niveles y formatos">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm"><span className="etiqueta">Número de preguntas</span>
            <input type="number" className="campo" min={1} max={MAX_PREGUNTAS} value={n} disabled={corriendo} onChange={(e) => setN(Math.max(1, Math.min(MAX_PREGUNTAS, Number(e.target.value) || 1)))} />
            <span className="mt-1 flex flex-wrap gap-1">{[10, 25, 50, 100, 200].map((x) => <button key={x} className="btn-texto text-xs" disabled={corriendo} onClick={() => setN(x)}>{x}</button>)}</span>
            <span className="block text-xs text-gray-500">Se reparten por igual entre las lecciones elegidas (máximo {MAX_PREGUNTAS}).</span></label>
          <fieldset className="text-sm"><legend className="etiqueta">Mezcla de niveles (%)</legend>
            {(['basico', 'intermedio', 'desafiante'] as Nivel[]).map((k) => (
              <label key={k} className="flex items-center justify-between gap-2 py-0.5">{NOMBRE_NIVEL[k]}
                <input type="number" className="campo w-20 py-1 text-right" min={0} max={100} value={niveles[k]} disabled={corriendo} onChange={(e) => setNiveles({ ...niveles, [k]: Math.max(0, Number(e.target.value) || 0) })} /></label>
            ))}
            {sumaN === 0 && <span className="text-xs text-red-700">Elija al menos un nivel.</span>}
          </fieldset>
          <fieldset className="text-sm"><legend className="etiqueta">Mezcla de formatos (%)</legend>
            {(['numeric', 'choice', 'truefalse'] as Formato[]).map((k) => (
              <label key={k} className="flex items-center justify-between gap-2 py-0.5">{NOMBRE_FORMATO[k]}
                <input type="number" className="campo w-20 py-1 text-right" min={0} max={100} value={formatos[k]} disabled={corriendo} onChange={(e) => setFormatos({ ...formatos, [k]: Math.max(0, Number(e.target.value) || 0) })} /></label>
            ))}
            {sumaF === 0 && <span className="text-xs text-red-700">Elija al menos un formato.</span>}
          </fieldset>
        </div>
      </Card>

      <Card title="3. Coste estimado">
        {!est ? <Spinner /> : !plan.length ? <p className="text-sm text-gray-500">Elija al menos una lección.</p> : (
          <div className="space-y-2 text-sm">
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="tarjeta !p-3"><p className="text-xs text-gray-500">Preguntas</p><p className="text-xl font-semibold tabular-nums">{est.preguntas}</p><p className="text-xs text-gray-500">en {est.llamadas} llamadas de hasta {datos.data!.por_lote}</p></div>
              <div className="tarjeta !p-3"><p className="text-xs text-gray-500">Coste estimado</p><p className="text-xl font-semibold tabular-nums">{usd(est.costoTipico)}</p><p className="text-xs text-gray-500">≈ {usd(est.preguntas ? est.costoTipico / est.preguntas : 0)} por pregunta</p></div>
              <div className="tarjeta !p-3"><p className="text-xs text-gray-500">Máximo posible</p><p className="text-xl font-semibold tabular-nums">{usd(est.costoMaximo)}</p><p className="text-xs text-gray-500">si todas las respuestas fueran del tamaño máximo</p></div>
              <div className="tarjeta !p-3"><p className="text-xs text-gray-500">Presupuesto del mes</p><p className="text-xl font-semibold tabular-nums">{usd(est.restantePresupuesto)}</p><p className="text-xs text-gray-500">disponible · {est.llamadasRestantesHoy} llamadas hoy</p></div>
            </div>
            <p className="text-xs text-gray-500">Modelo {datos.data!.modelo} · {datos.data!.precio_entrada} / {datos.data!.precio_salida} US$ por millón de tokens (entrada / salida) · ≈ {est.tokensEntrada.toLocaleString('es-DO')} tokens de entrada y {est.tokensSalida.toLocaleString('es-DO')} de salida. Es una estimación: el coste real depende de la longitud de cada respuesta y se muestra al terminar.</p>
            {est.avisos.map((a) => <Notice key={a} tone="warn">{a}</Notice>)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!corriendo ? (
            <button className="btn-primario" disabled={!est || !plan.length || sumaN === 0 || sumaF === 0 || !datos.data?.encendido} onClick={() => void generar()}>
              Generar {plan.length} preguntas{est && !est.simulado ? ` (≈ ${usd(est.costoTipico)})` : est?.simulado ? ' (simulación, sin coste)' : ''}
            </button>
          ) : <button className="btn-secundario" onClick={() => { parar.current = true; }}>Detener después de este lote</button>}
        </div>
      </Card>

      {prog && (
        <Card title={corriendo ? `Generando… lote ${prog.lote} de ${prog.total}` : 'Resultado'}>
          <div className="h-2 w-full overflow-hidden rounded bg-gray-100 dark:bg-white/10"><div className="h-full bg-primario-600 transition-all" style={{ width: `${(100 * prog.lote) / Math.max(1, prog.total)}%` }} /></div>
          <p className="mt-2 text-sm">{prog.creadas} creadas ({prog.verificadas} numéricas con cálculo comprobado) · {prog.rechazadas.length} rechazadas por la verificación · coste real {prog.simulado ? 'US$ 0 (simulación)' : usd(prog.costo)}</p>
          {prog.errores.map((e) => <p key={e} className="text-xs text-amber-700 dark:text-amber-300">⚠ {e}</p>)}
          {prog.rechazadas.length > 0 && (
            <details className="mt-1 text-xs"><summary className="cursor-pointer">Por qué se rechazaron ({prog.rechazadas.length})</summary>
              <ul className="list-disc pl-5">{prog.rechazadas.map((r, i) => <li key={i}>{r.motivo}</li>)}</ul></details>
          )}
        </Card>
      )}

      {resumen && resumen.items.length > 0 && (
        <Card title={`Borradores creados · ${resumen.items.length}`}>
          <p className="mb-2 text-xs text-gray-500">Revíselos en el banco antes de usarlos: corrija lo necesario y publíquelos. «Cálculo comprobado» garantiza la aritmética y las unidades de la clave; el planteamiento físico y la redacción los decide usted. Las de selección y verdadero/falso necesitan revisión completa.</p>
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            {resumen.items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <Badge tone={it.verificacion === 'calculo_comprobado' ? 'green' : 'amber'}>{it.verificacion === 'calculo_comprobado' ? 'cálculo comprobado' : 'revisar'}</Badge>
                <Badge>{NOMBRE_NIVEL[it.dificultad as Nivel] ?? it.dificultad}</Badge>
                <span className="min-w-0 flex-1 truncate">{it.enunciado}</span>
                <span className="text-xs text-gray-500">{it.leccion}</span>
                <Link className="enlace text-xs" to={`/docente/ejercicios/${it.id}`}>Revisar</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
