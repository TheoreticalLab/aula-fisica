/**
 * LIEIA · Laboratorio científico (flujo principal): seleccionar examen → analizar → descubrir investigaciones → diseñar
 * un examen nuevo → revisar → guardar borrador. Todo determinista en el navegador del profesor; nada se publica solo.
 * La tabla manual de roles queda como configuración avanzada en la pestaña «Calibración de ítems».
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { teacherOverview } from '@/api/docente';
import { actividades, cambiarEstado, cargarBanco, cargarExamen, crearBorrador, guardar, listar, type RegistroLab } from '@/api/lieiaCiencia';
import { analizar, type Informe } from '@/lib/lieia/ciencia/informe';
import { ESTADOS, LINEAS, type Ficha, type Linea } from '@/lib/lieia/ciencia/descubrimiento';
import { comparar, disenar, MODOS, type Diseno, type ItemBancoCiencia, type Modo } from '@/lib/lieia/ciencia/disenador';
import { COGNITIVAS, MINIMOS, RELACIONES, type Cognitiva } from '@/lib/lieia/ciencia/modelo';
import type { Revision } from '@/lib/lieia/ciencia/contenido';
import type { TRI } from '@/lib/lieia/ciencia/tri';
import { Historial, itemsParaSimular, Simulador, VistaTRI } from './CienciaAvanzada';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Notice, Spinner, Tabs } from '@/components/ui';

const MOTOR = 'lieia-ciencia@1.0.0';
const pct = (v: number) => `${(100 * v).toFixed(0)} %`;
const TONO_CONF = { alta: 'green', media: 'blue', baja: 'gray' } as const;
const TONO_EST = { analizable: 'green', datos_insuficientes: 'amber', requiere_nueva_evaluacion: 'purple' } as const;
const TONO_DIM = { bien: 'green', atencion: 'amber', problema: 'red', sin_datos: 'gray' } as const;
const TEXTO_DIM = { bien: 'bien', atencion: 'atención', problema: 'problema', sin_datos: 'sin datos' } as const;

type Vista = 'resumen' | 'preguntas' | 'relaciones' | 'investigar' | 'disenar' | 'tri' | 'simular' | 'historial' | 'metodo';
interface Contexto { classId: string; courseId: string; activityId: string; titulo: string }

// ------------------------------------------------------------------------------------------------------------------
function Preguntas({ inf, onRevisar }: { inf: Informe; onRevisar: (r: Revision) => Promise<void> }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ cognitivas: Cognitiva[]; dificultad: 'basico' | 'intermedio' | 'desafiante' } | null>(null);
  const accion = useAction();
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Clasificación propuesta automáticamente. Confianza cualitativa: <strong>alta</strong> = dato explícito del banco; <strong>media</strong> = categoría o formato; <strong>baja</strong> = palabras del enunciado. No son porcentajes calibrados.</p>
      {inf.analisis.map((a) => {
        const e = inf.empirico.get(a.id), p = inf.preguntas.find((x) => x.id === a.id)!;
        return (
          <Card key={a.id}>
            <button className="flex w-full flex-wrap items-start justify-between gap-2 text-left" onClick={() => { setAbierta(abierta === a.id ? null : a.id); setEdit(null); }}>
              <span className="min-w-0 flex-1"><strong>P{a.posicion}</strong> <span className="text-sm text-gray-600 dark:text-gray-300">{p.prompt.slice(0, 110)}{p.prompt.length > 110 ? '…' : ''}</span></span>
              <span className="flex flex-wrap gap-1">{a.revisada && <Badge tone="purple">revisada</Badge>}{a.cognitivas.slice(0, 3).map((c) => <Badge key={c.valor} tone={TONO_CONF[c.confianza]}>{COGNITIVAS[c.valor]}</Badge>)}</span>
            </button>
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-4">
              <span>Prevista: <strong>{a.dificultadAPriori.valor}</strong> <span className="text-gray-500">(a priori)</span></span>
              <span>Observada: {e?.p.ok ? <strong>{pct(e.p.valor.p)} [{pct(e.p.valor.ic[0])}–{pct(e.p.valor.ic[1])}], n = {e.p.n}</strong> : <span className="text-gray-500">{e ? (e.p.ok ? '' : e.p.motivo) : 'n = 0: sin respuestas para calibrar'}</span>}</span>
              <span>Discriminación: {e?.discriminacion.ok ? <strong>{e.discriminacion.valor.toFixed(2)}</strong> : <span className="text-gray-500">{e && !e.discriminacion.ok ? e.discriminacion.motivo : '—'}</span>}</span>
              <span>Omisiones: {e ? `${e.omisiones} de ${e.expuestos}` : '—'}</span>
            </div>
            {abierta === a.id && (
              <div className="mt-3 space-y-2 border-t border-gray-100 pt-2 text-sm dark:border-white/10">
                <p><strong>Tema:</strong> {a.tema ?? '—'} · <strong>Conceptos:</strong> {a.conceptos.join(', ') || '—'} · <strong>Prerrequisitos:</strong> {a.prerrequisitos.join(', ') || '—'}</p>
                <p><strong>Pasos:</strong> {a.pasos.valor} ({a.pasos.evidencia}) · <strong>Complejidad algebraica:</strong> {a.complejidadAlgebraica.valor} · <strong>Exigencia cognitiva:</strong> {a.exigenciaCognitiva.valor} · <strong>Lectura:</strong> {a.cargaLectura.palabras} palabras · <strong>Tiempo previsto:</strong> ≈ {a.tiempoAPrioriMin.toFixed(1)} min</p>
                <ul className="list-disc pl-5 text-xs">{a.cognitivas.map((c) => <li key={c.valor}>{COGNITIVAS[c.valor]} — confianza {c.confianza}: {c.evidencia}</li>)}</ul>
                {a.funcionesExamen.length > 0 && <p className="text-xs"><strong>Función en el examen:</strong> {a.funcionesExamen.map((f) => f.valor).join(', ')}</p>}
                {a.advertencias.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{a.advertencias.map((w) => <li key={w}>{w}</li>)}</ul>}
                {e?.erroresFrecuentes.length ? <p className="text-xs">Respuesta incorrecta repetida: {e.erroresFrecuentes[0].veces} de {e.erroresFrecuentes[0].deIncorrectas} incorrectas.</p> : null}
                {!edit ? (
                  <button className="btn-texto text-sm" onClick={() => setEdit({ cognitivas: a.cognitivas.map((c) => c.valor), dificultad: a.dificultadAPriori.valor })}>Corregir clasificación</button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-gray-200 p-2 dark:border-white/10">
                    <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
                      {(Object.keys(COGNITIVAS) as Cognitiva[]).map((c) => (
                        <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={edit.cognitivas.includes(c)}
                          onChange={(ev) => setEdit({ ...edit, cognitivas: ev.target.checked ? [...edit.cognitivas, c] : edit.cognitivas.filter((x) => x !== c) })} /> {COGNITIVAS[c]}</label>
                      ))}
                    </div>
                    <select className="campo w-auto text-sm" value={edit.dificultad} onChange={(ev) => setEdit({ ...edit, dificultad: ev.target.value as typeof edit.dificultad })}>
                      <option value="basico">básica</option><option value="intermedio">intermedia</option><option value="desafiante">desafiante</option>
                    </select>
                    <ErrorBox error={accion.error} />
                    <button className="btn-primario text-sm" disabled={accion.busy || !edit.cognitivas.length} onClick={() => void accion.run(async () => { await onRevisar({ id: a.id, ...edit }); setEdit(null); })}>Guardar revisión</button>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Relaciones({ inf }: { inf: Informe }) {
  const E = (id: string) => `P${inf.preguntas.find((p) => p.id === id)?.posicion ?? '?'}`;
  const teor = inf.aristas.filter((a) => a.procedencia === 'a_priori'), emp = inf.aristas.filter((a) => a.procedencia === 'empirica');
  const conceptos = new Map<string, string[]>();
  for (const a of inf.analisis) for (const c of a.conceptos) conceptos.set(c, [...(conceptos.get(c) ?? []), `P${a.posicion}`]);
  return (
    <div className="space-y-4 text-sm">
      <Card title="Mapa de conceptos">
        {conceptos.size === 0 ? <Empty>Las preguntas no tienen conceptos asociados.</Empty> : (
          <ul className="grid gap-1 sm:grid-cols-2">{[...conceptos.entries()].sort((x, y) => y[1].length - x[1].length).map(([c, ps]) => <li key={c}><strong>{c}</strong>: {ps.join(', ')}{ps.length === 1 && <span className="text-xs text-gray-500"> (una sola pregunta)</span>}</li>)}</ul>
        )}
      </Card>
      <Card title={`Relaciones teóricas (${teor.length}) · del contenido, no comprobadas`}>
        {teor.length === 0 ? <Empty>Sin relaciones teóricas detectadas.</Empty> : <ul className="space-y-1">{teor.map((a, i) => <li key={i}><Badge tone={TONO_CONF[a.confianza]}>{RELACIONES[a.tipo]}</Badge> {E(a.a)} — {E(a.b)}: {a.explicacion}</li>)}</ul>}
      </Card>
      <Card title={`Asociaciones empíricas (${emp.length}) · exploratorias`}>
        {!inf.examen ? <Empty>n = 0: no hay respuestas.</Empty> : !inf.examen.pares.ok ? <Notice tone="info">{inf.examen.pares.motivo}</Notice>
          : emp.length === 0 ? <p>Ningún par supera la corrección por comparaciones múltiples (q ≤ 0,10) con {inf.examen.n} estudiantes.</p>
          : <ul className="space-y-1">{emp.map((a, i) => <li key={i}>{E(a.a)} — {E(a.b)}: {a.explicacion}</li>)}</ul>}
      </Card>
    </div>
  );
}

function TarjetaFicha({ f, guardada, onGuardar, onDisenar }: { f: Ficha; guardada?: RegistroLab; onGuardar: (f: Ficha, estado: RegistroLab['estado']) => void; onDisenar: (m: Modo) => void }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <Card>
      <button className="flex w-full flex-wrap items-start justify-between gap-2 text-left" onClick={() => setAbierta(!abierta)}>
        <span className="min-w-0 flex-1"><span className="text-xs text-gray-500">{LINEAS[f.linea]}</span><br /><strong>{f.titulo}</strong></span>
        <span className="flex flex-wrap gap-1"><Badge tone={TONO_EST[f.estado]}>{ESTADOS[f.estado]}</Badge>{guardada && <Badge tone="gray">{guardada.estado}</Badge>}</span>
      </button>
      {f.resultado && <p className="mt-2 rounded bg-emerald-50 p-2 text-sm dark:bg-emerald-900/20"><strong>Calculado con datos reales:</strong> {f.resultado}</p>}
      {abierta && (
        <dl className="mt-2 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="font-semibold">Pregunta científica</dt><dd>{f.pregunta}</dd>
          <dt className="font-semibold">Hipótesis</dt><dd>{f.hipotesis}</dd>
          <dt className="font-semibold">Variables</dt><dd>{f.variables.join(' · ')}</dd>
          <dt className="font-semibold">Método</dt><dd>{f.metodo}</dd>
          <dt className="font-semibold">Tipo de estudio</dt><dd>{f.tipoEstudio}</dd>
          <dt className="font-semibold">Datos disponibles</dt><dd>{f.disponibles.length ? f.disponibles.join(' · ') : 'ninguno'}</dd>
          <dt className="font-semibold">Datos faltantes</dt><dd>{f.faltantes.length ? f.faltantes.join(' · ') : 'ninguno'}</dd>
          <dt className="font-semibold">Limitaciones</dt><dd><ul className="list-disc pl-4">{f.limitaciones.map((l) => <li key={l}>{l}</li>)}</ul></dd>
          <dt className="font-semibold">Por qué se propone</dt><dd>{f.porQue}</dd>
        </dl>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        {f.modo && MODOS[f.modo as Modo]?.implementado && <button className="btn-secundario" onClick={() => onDisenar(f.modo as Modo)}>Diseñar examen complementario</button>}
        <button className="btn-texto" onClick={() => onGuardar(f, 'guardada')}>Guardar</button>
        <button className="btn-texto" onClick={() => onGuardar(f, 'pospuesta')}>Posponer</button>
        <button className="btn-texto" onClick={() => onGuardar(f, 'descartada')}>Descartar</button>
      </div>
    </Card>
  );
}

function Investigar({ inf, guardados, onGuardar, onDisenar }: { inf: Informe; guardados: Map<string, RegistroLab>; onGuardar: (f: Ficha, e: RegistroLab['estado']) => void; onDisenar: (m: Modo) => void }) {
  const [linea, setLinea] = useState<'' | Linea>('');
  const [verDescartadas, setVerDescartadas] = useState(false);
  const lista = inf.fichas.filter((f) => (!linea || f.linea === linea) && (verDescartadas || guardados.get(f.id)?.estado !== 'descartada'));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select className="campo w-auto" value={linea} onChange={(e) => setLinea(e.target.value as '' | Linea)}>
          <option value="">Todas las líneas</option>{(Object.keys(LINEAS) as Linea[]).map((l) => <option key={l} value={l}>{LINEAS[l]}</option>)}
        </select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={verDescartadas} onChange={(e) => setVerDescartadas(e.target.checked)} /> ver descartadas</label>
      </div>
      <p className="text-xs text-gray-500">Ordenadas por factibilidad y señal. Un resultado solo aparece si se calculó aquí con respuestas reales; el resto son hipótesis y diseños para contrastarlas. Ninguna ficha atribuye conductas a personas.</p>
      {lista.length === 0 ? <Empty>No hay propuestas con este filtro.</Empty> : lista.map((f) => <TarjetaFicha key={f.id} f={f} guardada={guardados.get(f.id)} onGuardar={onGuardar} onDisenar={onDisenar} />)}
    </div>
  );
}

function Disenador({ inf, ctx, modoInicial, onGuardado }: { inf: Informe; ctx: Contexto; modoInicial: Modo; onGuardado: (d: Diseno, ids: string[]) => Promise<void> }) {
  const banco = useAsync(() => cargarBanco(ctx.courseId), [ctx.courseId]);
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [n, setN] = useState(Math.max(5, Math.min(15, inf.preguntas.length)));
  const [minutos, setMinutos] = useState('');
  const [conceptos, setConceptos] = useState<string[]>([]);
  const [hab, setHab] = useState<[Cognitiva, Cognitiva]>(['comprension_conceptual', 'aplicacion_directa']);
  const [semilla, setSemilla] = useState(() => Math.floor(Math.random() * 1e9));
  const [diseno, setDiseno] = useState<Diseno | null>(null);
  const [quitados, setQuitados] = useState<Set<string>>(new Set());
  const [comparados, setComparados] = useState<Diseno[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creados, setCreados] = useState<string[] | null>(null);
  const [simular, setSimular] = useState(false);
  const accion = useAction();
  const errores = inf.fichas.filter((f) => f.linea === 'errores').flatMap((f) => f.items);
  const todosConceptos = useMemo(() => [...new Set((banco.data ?? []).flatMap((b) => b.analisis.conceptos))].sort(), [banco.data]);

  function generar(s = semilla) {
    setError(null); setCreados(null); setQuitados(new Set());
    try {
      setDiseno(disenar(banco.data as ItemBancoCiencia[], { modo, n, minutos: minutos ? Number(minutos) : null, obligatorios: [], conceptos, base: inf.preguntas.map((p) => p.id), habilidades: hab, erroresFrecuentes: errores, semilla: s }));
    } catch (e) { setDiseno(null); setError(e instanceof Error ? e.message : String(e)); }
  }
  const final = diseno ? { ...diseno, items: diseno.items.filter((i) => !quitados.has(i.id)) } : null;
  const etiqueta = (id: string) => (banco.data ?? []).find((b) => b.pregunta.id === id)?.pregunta.prompt.slice(0, 90) ?? id;
  const metodologia = (d: Diseno) => `Borrador creado por LIEIA (${MOTOR}) a partir de «${ctx.titulo}». Modo ${d.modo} · ${MODOS[d.modo].nombre}. Criterio: ${d.criterio}. Semilla ${d.semilla}. Validación: ${d.validacion === 'a_priori' ? 'a priori (sin calibrar)' : 'parcialmente empírica'}. Revise las preguntas antes de publicar.`;

  if (banco.loading) return <Spinner label="Cargando el banco de la asignatura…" />;
  if (banco.error) return <ErrorBox error={banco.error} />;
  return (
    <div className="space-y-4 text-sm">
      <Card title="1. Objetivo del nuevo examen">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(MODOS) as Modo[]).map((m) => {
            const d = MODOS[m];
            return (
              <label key={m} className={`flex items-start gap-2 rounded-lg border p-2 ${modo === m ? 'border-acento-500' : 'border-gray-200 dark:border-white/10'} ${d.implementado ? '' : 'opacity-60'}`}>
                <input type="radio" className="mt-1" disabled={!d.implementado} checked={modo === m} onChange={() => setModo(m)} />
                <span><strong>{m}. {d.nombre}</strong><span className="block text-xs text-gray-500">{d.implementado ? d.criterio : `No disponible: ${'motivo' in d ? d.motivo : ''}`}</span></span>
              </label>
            );
          })}
        </div>
      </Card>
      <Card title="2. Restricciones (opcionales)">
        <div className="grid gap-2 sm:grid-cols-3">
          <label>Número de preguntas{modo === 'G' ? ' por versión' : ''}<input type="number" min={2} max={40} className="campo" value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
          <label>Duración máxima (min)<input type="number" min={5} className="campo" placeholder="sin límite" value={minutos} onChange={(e) => setMinutos(e.target.value)} /></label>
          {modo === 'H' && (
            <label>Habilidades a relacionar
              <span className="flex gap-1">{[0, 1].map((k) => (
                <select key={k} className="campo" value={hab[k]} onChange={(e) => { const h = [...hab] as [Cognitiva, Cognitiva]; h[k] = e.target.value as Cognitiva; setHab(h); }}>
                  {(Object.keys(COGNITIVAS) as Cognitiva[]).map((c) => <option key={c} value={c}>{COGNITIVAS[c]}</option>)}
                </select>
              ))}</span>
            </label>
          )}
        </div>
        {todosConceptos.length > 0 && (
          <details className="mt-2"><summary className="cursor-pointer text-xs">Conceptos obligatorios ({conceptos.length})</summary>
            <div className="mt-1 grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">{todosConceptos.map((c) => (
              <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={conceptos.includes(c)} onChange={(e) => setConceptos(e.target.checked ? [...conceptos, c] : conceptos.filter((x) => x !== c))} /> {c}</label>
            ))}</div>
          </details>
        )}
        <details className="mt-2"><summary className="cursor-pointer text-xs">Avanzado</summary>
          <label className="mt-1 block text-xs">Semilla (reproducibilidad)<input type="number" className="campo w-40" value={semilla} onChange={(e) => setSemilla(Number(e.target.value))} /></label>
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primario" onClick={() => generar()}>Proponer diseño</button>
          {diseno && <button className="btn-secundario" onClick={() => { const s = semilla + 1; setSemilla(s); generar(s); }}>Generar alternativa</button>}
        </div>
        {error && <div className="mt-2"><Notice tone="warn">{error}</Notice></div>}
      </Card>

      {final && (
        <Card title={`3. Propuesta: ${MODOS[final.modo].nombre}`}>
          <p className="text-xs text-gray-500">Criterio de optimización: {final.criterio}. Semilla {final.semilla}. Validación: {final.validacion === 'a_priori' ? 'a priori (ninguna pregunta con respuestas suficientes)' : `parcialmente empírica (${final.historicas} preguntas con historial)`}.</p>
          <div className="my-2 grid gap-2 text-xs sm:grid-cols-4">
            <span>Preguntas: <strong>{final.items.length}</strong></span><span>Tiempo previsto: <strong>≈ {final.tiempoMin} min</strong></span>
            <span>Conceptos: <strong>{final.conceptos.length}</strong></span><span>Dificultad prevista: {final.dificultad.basico}/{final.dificultad.intermedio}/{final.dificultad.desafiante}</span>
          </div>
          {[...final.avisos, ...final.riesgos].map((w) => <p key={w} className="text-xs text-amber-700 dark:text-amber-300">⚠ {w}</p>)}
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {final.items.map((i) => (
              <li key={i.id}>{i.version && <Badge tone="blue">versión {i.version}</Badge>} {etiqueta(i.id)}… <span className="text-xs text-gray-500">— {i.razon}</span>
                <button className="btn-texto ml-2 text-xs" onClick={() => setQuitados(new Set(quitados).add(i.id))}>Quitar</button></li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-secundario" onClick={() => setComparados([...comparados.filter((c) => c.modo !== final.modo || c.semilla !== final.semilla), final])}>Añadir al comparador</button>
            <button className="btn-secundario" onClick={() => setSimular(!simular)}>{simular ? 'Ocultar simulación' : 'Simular este diseño'}</button>
            <button className="btn-primario" disabled={accion.busy || !final.items.length} onClick={() => void accion.run(async () => {
              const ids = await crearBorrador(ctx.classId, final, metodologia(final)); setCreados(ids); await onGuardado(final, ids);
            })}>Crear examen borrador</button>
          </div>
          <ErrorBox error={accion.error} />
          {simular && (
            <div className="mt-3">
              {/* con dos versiones se simula la A (mismas condiciones que la B) */}
              <Simulador titulo={`${MODOS[final.modo].nombre}${final.items.some((i) => i.version) ? ' · versión A' : ''}`}
                items={final.items.filter((i) => !i.version || i.version === 'A').map((i, k) => {
                  const b = (banco.data ?? []).find((x) => x.pregunta.id === i.id)!;
                  return { id: i.id, etiqueta: `P${k + 1}`, dificultad: b.analisis.dificultadAPriori.valor, formato: b.pregunta.format, tiempoMin: b.analisis.tiempoAPrioriMin };
                })} />
            </div>
          )}
          {creados && <div className="mt-2"><Notice tone="ok">Borrador creado y oculto para los estudiantes. Revíselo antes de publicarlo: {creados.map((id, k) => <Link key={id} className="enlace ml-1" to={`/docente/actividades/${id}`}>{creados.length > 1 ? `versión ${'AB'[k]}` : 'abrir'}</Link>)}</Notice></div>}
        </Card>
      )}

      {comparados.length > 0 && (
        <Card title="Comparador de diseños">
          <p className="mb-2 text-xs text-gray-500">Cada diseño optimiza un criterio distinto: ninguno es «mejor» en general. La información es bajo el modelo 2PL A PRIORI (no calibrado): solo sirve para comparar entre sí.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-gray-500"><tr>{['Diseño', 'Criterio', 'Preg.', 'Min', 'Conceptos', 'Dificultad b/i/d', 'Información (a priori)', 'Con historial', 'Avisos'].map((h) => <th key={h} className="p-1">{h}</th>)}</tr></thead>
              <tbody>{comparar(comparados).map((c, k) => (
                <tr key={k} className="border-t border-gray-100 dark:border-white/10"><td className="p-1">{c.modo}. {c.nombre}</td><td className="p-1">{c.criterio}</td><td className="p-1">{c.preguntas}</td><td className="p-1">{c.minutos}</td>
                  <td className="p-1">{c.conceptos}</td><td className="p-1">{c.dificultad.basico}/{c.dificultad.intermedio}/{c.dificultad.desafiante}</td><td className="p-1">{c.informacionAPriori.toFixed(2)}</td><td className="p-1">{c.historicas}</td><td className="p-1">{c.avisos}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <button className="btn-texto mt-2 text-xs" onClick={() => setComparados([])}>Vaciar comparador</button>
        </Card>
      )}
    </div>
  );
}

function Metodo({ inf }: { inf: Informe }) {
  return (
    <div className="space-y-3 text-sm">
      <Card title="Capas y procedencia">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>A priori</strong>: del enunciado y los metadatos del banco (clasificación, pasos, dificultad del autor, tiempo previsto).</li>
          <li><strong>Empírico</strong>: de respuestas reales seudonimizadas (<code>lieia_exam_data</code>). Versión del informe: <code>{inf.version}</code>, generado {new Date(inf.generado).toLocaleString('es-DO')}.</li>
          <li><strong>Simulado</strong>: no se usa en este informe (los simuladores con verdad conocida están en «Laboratorio» y «Validación»).</li>
          <li>La IA (Claude) no interviene en este análisis: todo es determinista y reproducible. No se envían datos a servicios externos.</li>
        </ul>
      </Card>
      <Card title="Métodos y umbrales de abstención">
        <ul className="list-disc space-y-1 pl-5">
          <li>Dificultad clásica: proporción de aciertos entre las respuestas calificadas, IC de Wilson 95 %; mínimo {MINIMOS.item} respuestas. No es el parámetro b de la TRI.</li>
          <li>Discriminación: punto-biserial ítem-resto corregida (omisión = 0); mínimo {MINIMOS.discriminacion} estudiantes.</li>
          <li>Confiabilidad: KR-20 con IC bootstrap reproducible; mínimo {MINIMOS.confiabilidad} estudiantes y 3 preguntas.</li>
          <li>Asociación entre preguntas: phi, p por χ², q de Benjamini-Hochberg (FDR 10 %); mínimo {MINIMOS.correlacion} estudiantes. Exploratorio.</li>
          <li>Omisión: sin respuesta guardada. Una respuesta sin calificar (p. ej. abierta pendiente) no cuenta como omisión.</li>
          <li>Intervalo de edición: primera a última edición guardada; no es el tiempo total de resolución.</li>
          <li>Diseñador: selección voraz reproducible por semilla; criterio explícito por modo; tiempo previsto por formato, pasos y lectura.</li>
        </ul>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
export function Ciencia() {
  const secs = useAsync(() => teacherOverview(), []);
  const [classId, setClassId] = useState('');
  const acts = useAsync(() => (classId ? actividades(classId) : Promise.resolve([])), [classId]);
  const [activityId, setActivityId] = useState('');
  const [inf, setInf] = useState<Informe | null>(null);
  const [ctx, setCtx] = useState<Contexto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('resumen');
  const [modoInicial, setModoInicial] = useState<Modo>('A');
  const [guardados, setGuardados] = useState<Map<string, RegistroLab>>(new Map());
  const [revisiones, setRevisiones] = useState<Revision[]>([]);
  const [persistencia, setPersistencia] = useState(true);
  const [datosCache, setDatosCache] = useState<Awaited<ReturnType<typeof cargarExamen>> | null>(null);
  const [tri, setTri] = useState<TRI | null>(null);
  const accion = useAction();
  const sec = (secs.data ?? []).find((s) => s.class_id === classId);

  async function analizarAhora() {
    if (!sec) return;
    const act = (acts.data ?? []).find((a) => a.id === activityId)!;
    const d = await cargarExamen(activityId, sec.course_id);
    let regs: RegistroLab[] = [], ok = true;
    try { regs = await listar(classId, activityId); } catch { ok = false; }
    const revs = regs.filter((r) => r.kind === 'revision').map((r) => ({ id: r.clave, ...(r.payload as object) }) as Revision);
    setPersistencia(ok); setRevisiones(revs); setDatosCache(d);
    setGuardados(new Map(regs.filter((r) => r.kind === 'investigacion').map((r) => [r.clave, r])));
    setCtx({ classId, courseId: sec.course_id, activityId, titulo: act.titulo });
    setAviso(d.avisoDatos);
    setTri(null);
    setInf(analizar(d.preguntas, d.datos, revs)); setVista('resumen');
  }
  async function revisar(r: Revision) {
    const nuevas = [...revisiones.filter((x) => x.id !== r.id), r];
    setRevisiones(nuevas);
    if (datosCache) setInf(analizar(datosCache.preguntas, datosCache.datos, nuevas));
    if (persistencia && ctx) await guardar({ classId: ctx.classId, activityId: ctx.activityId, kind: 'revision', clave: r.id, version: inf?.version ?? null, estado: 'guardada', payload: { cognitivas: r.cognitivas, dificultad: r.dificultad }, procedencia: { motor: MOTOR, origen: 'profesor' } });
  }
  function guardarFicha(f: Ficha, estado: RegistroLab['estado']) {
    if (!ctx || !inf) return;
    if (!persistencia) { accion.setError('La persistencia del laboratorio aún no está instalada (migración 48): no se puede guardar.'); return; }
    void accion.run(async () => {
      const prev = guardados.get(f.id);
      if (prev) await cambiarEstado(prev.id, estado);
      else await guardar({ classId: ctx.classId, activityId: ctx.activityId, kind: 'investigacion', clave: f.id, version: inf.version, estado, payload: f as unknown as object,
        procedencia: { motor: MOTOR, n: inf.examen?.n ?? 0, version_examen: inf.version, fecha: inf.generado, calculado: !!f.resultado } });
      setGuardados(new Map((await listar(ctx.classId, ctx.activityId)).filter((r) => r.kind === 'investigacion').map((r) => [r.clave, r])));
    });
  }
  async function disenoGuardado(d: Diseno, ids: string[]) {
    if (!persistencia || !ctx) return;
    await guardar({ classId: ctx.classId, activityId: ctx.activityId, kind: 'diseno', clave: `${d.modo}:${d.semilla}`, version: inf?.version ?? null, estado: 'aplicada',
      payload: { ...d, borradores: ids }, procedencia: { motor: MOTOR, semilla: d.semilla, criterio: d.criterio, validacion: d.validacion } });
  }

  return (
    <div className="space-y-4">
      <Card title="🔬 Laboratorio científico">
        <p className="mb-3 text-sm">Elija un examen: el laboratorio clasifica las preguntas, mide lo que los datos permiten, propone investigaciones y diseña exámenes nuevos. Usted valida y decide; nada se publica solo.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="campo" value={classId} onChange={(e) => { setClassId(e.target.value); setActivityId(''); setInf(null); }}>
            <option value="">— Sección —</option>{(secs.data ?? []).filter((s) => !s.archived).map((s) => <option key={s.class_id} value={s.class_id}>{s.course_title} · {s.name}</option>)}
          </select>
          <select className="campo" value={activityId} disabled={!classId} onChange={(e) => { setActivityId(e.target.value); setInf(null); }}>
            <option value="">— Examen o práctica —</option>{(acts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.titulo} · {a.items} preguntas · {a.entregados} entregas</option>)}
          </select>
        </div>
        <ErrorBox error={secs.error ?? acts.error ?? accion.error} />
        <button className="btn-primario mt-3 w-full sm:w-auto" disabled={!activityId || accion.busy} onClick={() => void accion.run(analizarAhora)}>
          {accion.busy ? 'Analizando…' : 'ANALIZAR EXAMEN Y DESCUBRIR POSIBILIDADES'}
        </button>
      </Card>

      {inf && ctx && (
        <>
          {aviso && <Notice tone="warn">{aviso}</Notice>}
          {!persistencia && <Notice tone="info">El análisis funciona, pero guardar investigaciones y revisiones requiere instalar la migración 48.</Notice>}
          <Tabs<Vista> value={vista} onChange={setVista} tabs={[
            { id: 'resumen', label: 'Informe' }, { id: 'preguntas', label: `Preguntas (${inf.preguntas.length})` }, { id: 'relaciones', label: 'Relaciones' },
            { id: 'investigar', label: `¿Qué puedo investigar? (${inf.fichas.length})` }, { id: 'disenar', label: 'Diseñar nuevo examen' },
            { id: 'tri', label: 'Psicometría avanzada' }, { id: 'simular', label: 'Simular' }, { id: 'historial', label: 'Historial' }, { id: 'metodo', label: 'Métodos' },
          ]} />
          {vista === 'resumen' && (
            <div className="space-y-4">
              <Card title={`Diagnóstico general · ${ctx.titulo}`}>
                <div className="space-y-1 text-sm">{inf.resumen.map((l) => <p key={l}>{l}</p>)}</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {inf.diagnostico.map((d) => (
                    <div key={d.clave} className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10">
                      <div className="flex items-center justify-between gap-2"><strong>{d.nombre}</strong><Badge tone={TONO_DIM[d.estado]}>{TEXTO_DIM[d.estado]}</Badge></div>
                      <p className="text-xs text-gray-600 dark:text-gray-300">{d.detalle}</p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Recomendaciones">
                {inf.recomendaciones.length === 0 ? <Empty>Sin recomendaciones con los datos actuales.</Empty> : (
                  <ul className="space-y-2 text-sm">{inf.recomendaciones.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0 flex-1"><strong>{r.texto}</strong><span className="block text-xs text-gray-500">Por qué: {r.porQue}</span></span>
                      <span className="flex gap-1">
                        {r.fichaId && <button className="btn-texto text-xs" onClick={() => setVista('investigar')}>Ver ficha</button>}
                        {r.modo && MODOS[r.modo as Modo]?.implementado && <button className="btn-secundario text-xs" onClick={() => { setModoInicial(r.modo as Modo); setVista('disenar'); }}>Convertir en examen</button>}
                      </span>
                    </li>
                  ))}</ul>
                )}
              </Card>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primario" onClick={() => setVista('investigar')}>¿QUÉ PUEDO INVESTIGAR CON ESTE EXAMEN?</button>
                <button className="btn-secundario" onClick={() => setVista('disenar')}>DISEÑAR NUEVO EXAMEN A PARTIR DEL ANÁLISIS</button>
              </div>
            </div>
          )}
          {vista === 'preguntas' && <Preguntas inf={inf} onRevisar={revisar} />}
          {vista === 'relaciones' && <Relaciones inf={inf} />}
          {vista === 'investigar' && <Investigar inf={inf} guardados={guardados} onGuardar={guardarFicha} onDisenar={(m) => { setModoInicial(m); setVista('disenar'); }} />}
          {vista === 'disenar' && <Disenador key={modoInicial} inf={inf} ctx={ctx} modoInicial={modoInicial} onGuardado={disenoGuardado} />}
          {vista === 'tri' && <VistaTRI inf={inf} tri={tri} setTri={setTri} />}
          {vista === 'simular' && <Simulador items={itemsParaSimular(inf, tri)} titulo={ctx.titulo} />}
          {vista === 'historial' && <Historial inf={inf} classId={ctx.classId} activityId={ctx.activityId} />}
          {vista === 'metodo' && <Metodo inf={inf} />}
        </>
      )}
    </div>
  );
}
