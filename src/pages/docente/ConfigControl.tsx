/**
 * Práctica de Control de una práctica (migración 62): política de nota anunciada (versionada, sin retroactividad),
 * catálogo de problemas de transferencia con revisión docente, historial de controles y ajustes de la nota.
 * La activación se hace en clase, desde la asistencia de Orbe Control.
 */
import { useState } from 'react';
import { controlAjustes, controlAviso, controlCatalogo, controlItemGuardar, controlPoliticaAnunciar, controlPoliticaRetirar, type Alcance, type ItemCatalogo } from '@/api/control';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';
import { DURACIONES, ejemploAjuste, TIPO_TRANSFERENCIA, W_MAX, W_POR_DEFECTO } from '@/lib/control';
import { useAction, useAsync } from '@/lib/util';

export default function ConfigControl({ activityId }: { activityId: string }) {
  return (
    <div className="mt-4 space-y-4">
      <Politica activityId={activityId} />
      <CatalogoTransferencia activityId={activityId} />
      <Ajustes activityId={activityId} />
    </div>
  );
}

function Politica({ activityId }: { activityId: string }) {
  const st = useAsync(() => controlAviso(activityId), [activityId]);
  const [w, setW] = useState(Math.round(100 * W_POR_DEFECTO));
  const [dur, setDur] = useState(7);
  const [cond, setCond] = useState('Se aplica a las entregas hechas después de este aviso. No se aplica a ausencias justificadas, incidencias técnicas ni mientras la corrección esté pendiente.');
  const [ayudas, setAyudas] = useState('Puedes usar libros, apuntes, simuladores e inteligencia artificial para aprender; lo que se comprueba después es que puedas resolver solo un problema nuevo.');
  const [alcance, setAlcance] = useState<Alcance>('nuevas');
  const [anticipacion, setAnticipacion] = useState(24);
  const [publicar, setPublicar] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const accion = useAction();
  const vigente = st.data;
  const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <Card title="Práctica de Control · política de nota">
      <p className="text-sm text-gray-600 dark:text-gray-300">Anuncie aquí, antes de las entregas o al menos antes del control, cuánto puede ajustar un control presencial la nota de esta práctica:
        N_final = N_original × [1 − w × (1 − C/100)]. Los estudiantes lo ven en la práctica desde ese momento. Cada cambio crea una versión nueva:
        cada control se rige por la versión que el estudiante conocía antes de hacerlo (nunca se cambian las reglas de un control ya hecho).</p>
      {st.loading ? <Spinner /> : vigente ? (
        <Notice tone="ok">Vigente: versión {vigente.version} · ajuste máximo {Math.round(100 * vigente.w)} % · {vigente.duracion_min} min · anunciada el {new Date(vigente.announced_at).toLocaleString('es-DO')}.
          Ej.: 90 en la práctica y 50 en el control → {ejemploAjuste(vigente.w).final}.
          {vigente.alcance === 'todas'
            ? ` Se aplica también a quien ya entregó, en controles iniciados desde el ${vigente.efectiva_desde ? fechaHora(vigente.efectiva_desde) : '—'}.`
            : ' Se aplica a las entregas hechas desde el anuncio.'}</Notice>
      ) : <Notice>Sin política anunciada: un control de esta práctica sería solo diagnóstico y no cambiaría ninguna nota.</Notice>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="etiqueta">Ajuste máximo (w)</span>
          <span className="flex items-center gap-2"><input type="range" min={0} max={Math.round(100 * W_MAX)} step={5} value={w} onChange={(e) => setW(Number(e.target.value))} className="flex-1" />
            <span className="w-12 text-right tabular-nums">{w} %</span></span>
          <span className="block text-xs text-gray-500">Límite institucional {Math.round(100 * W_MAX)} %. Con {w} %: 90 y control 50 → {ejemploAjuste(w / 100).final}; control 0 → {ejemploAjuste(w / 100).original * (1 - w / 100)}.</span></label>
        <label className="text-sm"><span className="etiqueta">Duración del control</span>
          <select className="campo" value={dur} onChange={(e) => setDur(Number(e.target.value))}>{DURACIONES.map((m) => <option key={m} value={m}>{m} minutos</option>)}</select></label>
        <fieldset className="text-sm sm:col-span-2">
          <legend className="etiqueta">¿A qué entregas se aplica?</legend>
          <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={alcance === 'nuevas'} onChange={() => setAlcance('nuevas')} />
            <span>Solo a las entregas posteriores a este anuncio <span className="text-gray-500">(práctica nueva o aún abierta)</span></span></label>
          <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={alcance === 'todas'} onChange={() => setAlcance('todas')} />
            <span>También a las entregas ANTERIORES <span className="text-gray-500">(práctica ya dada): solo cuenta en controles hechos con la antelación que fije, para que todos lo sepan antes de la prueba</span></span></label>
          {alcance === 'todas' && (
            <label className="mt-1 block"><span className="etiqueta">Antelación mínima entre el anuncio y el control</span>
              <select className="campo max-w-xs" value={anticipacion} onChange={(e) => setAnticipacion(Number(e.target.value))}>
                {[1, 12, 24, 48, 72, 168].map((h) => <option key={h} value={h}>{h < 24 ? `${h} hora(s)` : `${h / 24} día(s)`}</option>)}
              </select>
              <span className="block text-xs text-gray-500">Un control iniciado antes de ese momento será solo diagnóstico (no cambia notas). Recomendado: 24 h o «para la próxima clase».</span></label>
          )}
          <label className="mt-1 flex items-center gap-2"><input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} /> Publicar además un aviso fijado en la sección (lo ven aunque no abran la práctica)</label>
        </fieldset>
        <label className="text-sm sm:col-span-2"><span className="etiqueta">Condiciones de aplicación</span>
          <textarea className="campo" rows={2} maxLength={1500} value={cond} onChange={(e) => setCond(e.target.value)} /></label>
        <label className="text-sm sm:col-span-2"><span className="etiqueta">Política sobre IA y otras ayudas (en la práctica)</span>
          <textarea className="campo" rows={2} maxLength={1000} value={ayudas} onChange={(e) => setAyudas(e.target.value)} /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primario" disabled={accion.busy} onClick={() => {
          const texto = alcance === 'todas'
            ? `¿Anunciar la política (${w} %, ${dur} min) TAMBIÉN para quienes ya entregaron? Solo contará en controles iniciados dentro de ${anticipacion} h o más.`
            : `¿Anunciar la política (${w} %, ${dur} min)? Se aplicará a las entregas hechas desde ahora.`;
          if (!window.confirm(texto)) return;
          void accion.run(async () => {
            const r = await controlPoliticaAnunciar(activityId, w / 100, dur, cond, ayudas, alcance, alcance === 'todas' ? anticipacion : 0, publicar);
            setMsg(`Anunciada la versión ${r.version}${r.aviso_id ? ' y publicado el aviso en la sección' : ''}.` + (alcance === 'todas'
              ? ` Cuenta en controles desde el ${fechaHora(r.efectiva_desde)} (también para las ${r.entregas_previas} entrega(s) anteriores).`
              : r.entregas_previas ? ` ${r.entregas_previas} estudiante(s) ya habían entregado: a ellos no se les aplica.` : ''));
            st.reload();
          });
        }}>{vigente ? 'Anunciar versión nueva' : 'Anunciar política'}</button>
        {vigente && <button className="btn-secundario" disabled={accion.busy} onClick={() => {
          if (!window.confirm('¿Retirar la política? Los controles posteriores no ajustarán notas de quien entregue desde ahora; los controles ya hechos conservan la regla con la que se hicieron.')) return;
          void accion.run(async () => { await controlPoliticaRetirar(activityId); st.reload(); });
        }}>Retirar</button>}
        {msg && <span className="text-sm text-emerald-700 dark:text-emerald-300">{msg}</span>}
      </div>
      <ErrorBox error={accion.error ?? st.error} />
    </Card>
  );
}

const vacioFicha = (exercise_id: string, origen: string | null, competencia: string, minutos: number): Partial<ItemCatalogo> & { exercise_id: string } => ({
  exercise_id, origen_exercise_id: origen, tipo: 'contextual', competencia, competencias_secundarias: [], minutos, hipotesis: '', justificacion: '', rubrica: [], estado: 'propuesto',
});

function CatalogoTransferencia({ activityId }: { activityId: string }) {
  const st = useAsync(() => controlCatalogo(activityId), [activityId]);
  const [ficha, setFicha] = useState<(Partial<ItemCatalogo> & { exercise_id: string }) | null>(null);
  const accion = useAction();
  if (st.loading) return <Card title="Problemas de transferencia"><Spinner /></Card>;
  if (st.error || !st.data) return <Card title="Problemas de transferencia"><ErrorBox error={st.error} onRetry={st.reload} /></Card>;
  const c = st.data;
  const guardar = (estado: 'propuesto' | 'aprobado' | 'rechazado') => void accion.run(async () => {
    await controlItemGuardar({ ...ficha!, estado });
    setFicha(null);
    st.reload();
  });
  return (
    <Card title="Problemas de transferencia (catálogo del control)">
      <p className="text-sm text-gray-600 dark:text-gray-300">Cada estudiante recibe UN problema nuevo de una competencia de esta práctica, elegido por el servidor
        (necesidad, diagnóstico, cobertura, tiempo y azar reproducible). Se priorizan las fichas que usted aprueba aquí; si no hay, se usan ejercicios publicados del banco
        de la misma competencia que quepan en el tiempo. Nunca se usa un ejercicio de la propia práctica ni uno sin clave o sin publicar.</p>
      <p className="mt-2 text-xs text-gray-500">Competencias de la práctica: {c.conceptos.join(', ') || '—'}</p>
      <h3 className="mt-3 font-medium">Fichas ({c.catalogo.length})</h3>
      {c.catalogo.length === 0 && <p className="text-sm text-gray-500">Aún no hay fichas. Cree una desde una sugerencia.</p>}
      <ul className="mt-1 space-y-2">
        {c.catalogo.map((i) => (
          <li key={i.id} className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2"><strong>{i.slug}</strong>
              <Badge tone={i.estado === 'aprobado' ? 'green' : i.estado === 'rechazado' ? 'red' : 'amber'}>{i.estado}</Badge>
              <Badge>{TIPO_TRANSFERENCIA[i.tipo] ?? i.tipo}</Badge><Badge tone="blue">{i.competencia}</Badge><span className="text-xs text-gray-500">~{i.minutos} min</span>
              {!i.published && <Badge tone="red">ejercicio no publicado</Badge>}
              <button className="btn-texto ml-auto text-xs" onClick={() => setFicha({ ...i })}>Editar / revisar</button></div>
            <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{i.prompt}</p>
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">Sugerencias del banco ({c.sugerencias.length})</summary>
        <ul className="mt-1 space-y-1">
          {c.sugerencias.filter((s) => !c.catalogo.some((i) => i.exercise_id === s.exercise_id)).map((s) => (
            <li key={s.exercise_id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-xs">{s.slug}</span><span className="text-xs text-gray-500">{s.format} · {s.difficulty} · ~{s.minutos} min · {s.concepts.join(', ')}</span>
              <button className="btn-texto text-xs" onClick={() => setFicha(vacioFicha(s.exercise_id, c.originales.find((o) => o.concepts.some((x) => s.concepts.includes(x)))?.exercise_id ?? null,
                s.concepts.find((x) => c.conceptos.includes(x)) ?? s.concepts[0] ?? '', s.minutos))}>Crear ficha</button>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-gray-500">Para un problema nuevo, créelo en el Banco (o con «Generar preguntas» de Orbe IA, que deja los ítems sin publicar hasta que usted los revise), publíquelo y aparecerá aquí.</p>
      </details>
      {ficha && (
        <div className="mt-3 rounded-xl border border-blue-200 p-3 dark:border-blue-900">
          <p className="font-medium">Ficha de transferencia</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-sm"><span className="etiqueta">Ejercicio de origen</span>
              <select className="campo" value={ficha.origen_exercise_id ?? ''} onChange={(e) => setFicha({ ...ficha, origen_exercise_id: e.target.value || null })}>
                <option value="">— pregunta validada de la competencia —</option>
                {c.originales.map((o) => <option key={o.exercise_id} value={o.exercise_id}>{o.slug}</option>)}
              </select></label>
            <label className="text-sm"><span className="etiqueta">Tipo de transferencia</span>
              <select className="campo" value={ficha.tipo} onChange={(e) => setFicha({ ...ficha, tipo: e.target.value })}>
                {['contextual', 'parametrica', 'conceptual', 'estructural'].map((t) => <option key={t} value={t}>{TIPO_TRANSFERENCIA[t]}</option>)}
              </select></label>
            <label className="text-sm"><span className="etiqueta">Competencia principal</span>
              <select className="campo" value={ficha.competencia} onChange={(e) => setFicha({ ...ficha, competencia: e.target.value })}>
                {c.conceptos.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="text-sm"><span className="etiqueta">Tiempo previsto (minutos, máx. 10)</span>
              <input className="campo" type="number" min={1} max={10} step={0.5} value={ficha.minutos} onChange={(e) => setFicha({ ...ficha, minutos: Number(e.target.value) })} /></label>
            <label className="text-sm sm:col-span-2"><span className="etiqueta">Competencias secundarias (separadas por comas)</span>
              <input className="campo" value={(ficha.competencias_secundarias ?? []).join(', ')} onChange={(e) => setFicha({ ...ficha, competencias_secundarias: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
            <label className="text-sm sm:col-span-2"><span className="etiqueta">Hipótesis físicas necesarias</span>
              <input className="campo" maxLength={1000} value={ficha.hipotesis ?? ''} onChange={(e) => setFicha({ ...ficha, hipotesis: e.target.value })} /></label>
            <label className="text-sm sm:col-span-2"><span className="etiqueta">Justificación de la equivalencia pedagógica (obligatoria)</span>
              <textarea className="campo" rows={2} maxLength={1500} value={ficha.justificacion ?? ''} onChange={(e) => setFicha({ ...ficha, justificacion: e.target.value })}
                placeholder="Qué habilidad decisiva del ejercicio original comprueba y por qué no basta con copiar su resultado." /></label>
          </div>
          <Rubrica valor={ficha.rubrica ?? []} onChange={(r) => setFicha({ ...ficha, rubrica: r })} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-primario" disabled={accion.busy} onClick={() => guardar('aprobado')}>Aprobar para controles</button>
            <button className="btn-secundario" disabled={accion.busy} onClick={() => guardar('propuesto')}>Guardar como propuesta</button>
            <button className="btn-secundario" disabled={accion.busy} onClick={() => guardar('rechazado')}>Rechazar</button>
            <button className="btn-texto" onClick={() => setFicha(null)}>Cancelar</button>
          </div>
          <p className="mt-1 text-xs text-gray-500">Para aprobar, el servidor exige: ejercicio publicado, clave coherente con su formato y, si es abierta, una rúbrica cuyos pesos sumen 100.
            La solución de referencia, las respuestas, tolerancias y unidades son las de la clave del ejercicio (no salen del servidor hacia los estudiantes).</p>
          <ErrorBox error={accion.error} />
        </div>
      )}
    </Card>
  );
}

const CRITERIOS = ['Identificación del principio físico', 'Planteamiento', 'Desarrollo', 'Resultado', 'Interpretación y unidades'];

function Rubrica({ valor, onChange }: { valor: { criterio: string; peso: number }[]; onChange: (r: { criterio: string; peso: number }[]) => void }) {
  const suma = valor.reduce((a, c) => a + Number(c.peso || 0), 0);
  return (
    <div className="mt-2">
      <p className="text-sm font-medium">Rúbrica (corrección parcial; obligatoria en preguntas abiertas)</p>
      {valor.map((c, i) => (
        <div key={i} className="mt-1 flex gap-2">
          <input className="campo flex-1" value={c.criterio} onChange={(e) => onChange(valor.map((x, k) => (k === i ? { ...x, criterio: e.target.value } : x)))} />
          <input className="campo w-20" type="number" min={0} max={100} value={c.peso} onChange={(e) => onChange(valor.map((x, k) => (k === i ? { ...x, peso: Number(e.target.value) } : x)))} />
          <button className="btn-texto" onClick={() => onChange(valor.filter((_, k) => k !== i))}>✕</button>
        </div>
      ))}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {valor.length === 0 && <button className="btn-texto text-xs" onClick={() => onChange(CRITERIOS.map((criterio) => ({ criterio, peso: 20 })))}>Usar los 5 criterios estándar (20 % cada uno)</button>}
        {valor.length < 8 && <button className="btn-texto text-xs" onClick={() => onChange([...valor, { criterio: '', peso: 0 }])}>+ criterio</button>}
        {valor.length > 0 && <span className={`text-xs ${Math.abs(suma - 100) < 0.01 ? 'text-emerald-700' : 'text-red-700'}`}>Suma: {suma} (debe ser 100)</span>}
      </div>
    </div>
  );
}

function Ajustes({ activityId }: { activityId: string }) {
  const st = useAsync(() => controlAjustes(activityId), [activityId]);
  const filas = (st.data ?? []).filter((a) => a.original !== null);
  return (
    <Card title="Ajustes de la nota por controles">
      <p className="text-sm text-gray-600 dark:text-gray-300">La nota original no se modifica: el Registro de calificaciones usa la final. Solo hay ajuste con un control
        confirmado, sin incidencia, sin corrección pendiente y con una política aplicable (anunciada antes de la entrega o, si es «también anteriores», con la antelación fijada antes del control). Con varios controles cuenta el más favorable (no se encadenan descuentos).
        Los controles se activan en clase desde Orbe Control → Asistencia → Práctica de Control.</p>
      {st.loading ? <Spinner /> : st.error ? <ErrorBox error={st.error} onRetry={st.reload} /> : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Estudiante</th><th>Original</th><th>Control</th><th>Política</th><th>Factor</th><th>Final</th></tr></thead>
            <tbody>
              {filas.map((a) => (
                <tr key={a.user_id} className="border-t border-gray-100 dark:border-white/5">
                  <td>{a.nombre}</td><td>{a.original}</td><td>{a.control ?? '—'}</td><td>{a.politica ? `v${a.politica.version} (${Math.round(100 * a.politica.w)} %)` : '—'}</td>
                  <td>{a.factor < 1 ? `×${a.factor.toFixed(3)}` : '—'}</td><td className="font-medium">{a.final}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 && <p className="text-sm text-gray-500">Nadie ha entregado todavía.</p>}
        </div>
      )}
    </Card>
  );
}
