/**
 * LIEIA · laboratorio científico: psicometría avanzada (TRI por examen), simulador de diseños y tamaños muestrales,
 * e historial de investigaciones (preregistradas frente a exploratorias).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { gruposExamen, historialCalibracion, listar, type RegistroLab, type VersionCalibracion } from '@/api/lieiaCiencia';
import { difMH, MIN_DIF_GRUPO, type ResultadoDIF } from '@/lib/lieia/ciencia/dif';
import type { Informe } from '@/lib/lieia/ciencia/informe';
import { ajustarTRI, MIN_TRI, type TRI } from '@/lib/lieia/ciencia/tri';
import { analisisFactorial, MIN_FACTORIAL, POR_PREGUNTA, type Factorial } from '@/lib/lieia/ciencia/factorial';
import { resumenParaIA } from '@/lib/lieia/ciencia/resumenIA';
import { invocar } from '@/lib/supabase';
import { ESCENARIO_BASE, nCorrelacion, nProporciones, potenciaCorrelacion, simular, type Escenario, type ItemSim, type ResultadoSim } from '@/lib/lieia/ciencia/simulacion';
import { reabrir } from '@/lib/lieia/ciencia/historial';
import { ESTADOS } from '@/lib/lieia/ciencia/descubrimiento';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Notice, Spinner } from '@/components/ui';

const pct = (v: number) => `${(100 * v).toFixed(0)} %`;
const E = (inf: Informe, id: string) => `P${inf.preguntas.find((p) => p.id === id)?.posicion ?? '?'}`;

export function itemsParaSimular(inf: Informe, tri: TRI | null, ids?: string[]): ItemSim[] {
  const lista = ids ? inf.preguntas.filter((p) => ids.includes(p.id)) : inf.preguntas;
  return lista.map((p) => {
    const a = inf.analisis.find((x) => x.id === p.id);
    return {
      id: p.id, etiqueta: `P${p.posicion}`, dificultad: a?.dificultadAPriori.valor ?? p.difficulty, formato: p.format, tiempoMin: a?.tiempoAPrioriMin ?? 3,
      cal: tri?.ok ? tri.items.find((i) => i.id === p.id)?.cal ?? null : null,
    };
  });
}

// ------------------------------------------------------------------------------------------------------------------
function Calibraciones({ inf, courseId }: { inf: Informe; courseId: string }) {
  const st = useAsync(() => historialCalibracion(courseId), [courseId]);
  if (st.loading) return <Spinner label="Cargando calibraciones guardadas…" />;
  if (st.error) return <p className="text-xs text-gray-500">El historial de calibraciones requiere la migración 49 ({st.error}).</p>;
  const porItem = new Map<string, VersionCalibracion[]>();
  for (const v of st.data ?? []) if (inf.preguntas.some((p) => p.id === v.exercise_id)) porItem.set(v.exercise_id, [...(porItem.get(v.exercise_id) ?? []), v]);
  if (!porItem.size) return <p className="text-xs">Ninguna pregunta de este examen tiene una calibración guardada todavía. Se calibra con todas las respuestas de la asignatura en la pestaña «Calibración de ítems»; cada recalibración queda como una versión nueva.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {[...porItem.entries()].map(([id, vs]) => (
        <li key={id}><strong>{E(inf, id)}</strong>: {vs.map((v) => `b = ${v.b.toFixed(2)} ± ${v.se_b.toFixed(2)} (n = ${v.n_resp}, ${new Date(v.calibrated_at).toLocaleDateString('es-DO')})`).join(' → ')}
          {vs.length > 1 && Math.abs(vs[vs.length - 1].b - vs[0].b) > 2 * Math.hypot(vs[0].se_b, vs[vs.length - 1].se_b) && <span className="text-amber-700 dark:text-amber-300"> · el parámetro cambió más de lo que explica su incertidumbre: revise si la pregunta o el grupo cambiaron</span>}</li>
      ))}
    </ul>
  );
}

function VistaDIF({ inf, activityId }: { inf: Informe; activityId: string }) {
  const [res, setRes] = useState<ResultadoDIF | null>(null);
  const accion = useAction();
  return (
    <Card title="Funcionamiento diferencial entre subgrupos (DIF)">
      <p className="text-xs text-gray-500">Compara a estudiantes de igual nivel de dos subgrupos de la sección (Mantel-Haenszel). Un DIF no prueba sesgo: indica que la pregunta funciona distinto y merece revisar su contenido. Mínimo {MIN_DIF_GRUPO} estudiantes por subgrupo. Los subgrupos llegan con los mismos seudónimos, sin nombres.</p>
      {!res ? <button className="btn-secundario mt-2" disabled={accion.busy} onClick={() => void accion.run(async () => {
        const g = await gruposExamen(activityId);
        setRes(difMH(inf.matriz!, new Map(g.map((x) => [x.seudonimo, x.grupo]))));
      })}>Calcular DIF</button>
        : !res.ok ? <Notice tone="info">{res.motivo}</Notice> : (
          <div className="mt-2 text-xs">
            <p>Subgrupos: <strong>{res.grupos[0]}</strong> (n = {res.n[0]}) y <strong>{res.grupos[1]}</strong> (n = {res.n[1]}). {res.metodo}.</p>
            <ul className="mt-1 space-y-0.5">{res.items.filter((i) => i.clase && i.clase !== 'A').map((i) => (
              <li key={i.id}><Badge tone={i.clase === 'C' ? 'red' : 'amber'}>{i.clase}</Badge> {E(inf, i.id)}: delta MH = {i.delta!.toFixed(2)}, q = {i.q!.toFixed(3)}; a igual nivel, rinde mejor el subgrupo «{i.favorece}».</li>
            ))}</ul>
            {res.items.every((i) => !i.clase || i.clase === 'A') && <p>Ninguna pregunta muestra DIF moderado o grande (todas en clase A o sin datos).</p>}
          </div>
        )}
      <ErrorBox error={accion.error} />
    </Card>
  );
}

export function VistaTRI({ inf, tri, setTri, courseId, activityId }: { inf: Informe; tri: TRI | null; setTri: (t: TRI) => void; courseId: string; activityId: string }) {
  const [calculando, setCalculando] = useState(false);
  if (!inf.matriz) return (
    <div className="space-y-3 text-sm">
      <Notice tone="info">n = 0: no hay respuestas reales en este examen; la TRI no puede ajustarse aquí.</Notice>
      <Card title="Calibración guardada del banco (progresiva)"><Calibraciones inf={inf} courseId={courseId} /></Card>
    </div>
  );
  return (
    <div className="space-y-3 text-sm">
      <Card title="Calibración guardada del banco (progresiva)"><Calibraciones inf={inf} courseId={courseId} /></Card>
      <VistaDIF inf={inf} activityId={activityId} />
      <VistaFactorial inf={inf} />
      <Card title="Teoría de respuesta al ítem (2PL) para este examen">
        <p className="text-xs text-gray-500">Mínimo {MIN_TRI} estudiantes; con menos de 200 el ajuste es provisional. El parámetro b está en escala logit (habilidad media = 0): no es la proporción de aciertos. No se ajusta 3PL: con estas muestras el azar no es identificable.</p>
        {!tri ? (
          <button className="btn-primario mt-2" disabled={calculando} onClick={() => { setCalculando(true); setTimeout(() => { setTri(ajustarTRI(inf.matriz!)); setCalculando(false); }, 10); }}>
            {calculando ? 'Ajustando…' : 'Ajustar TRI con las respuestas reales'}
          </button>
        ) : !tri.ok ? <Notice tone="warn">{tri.motivo}</Notice> : (
          <div className="mt-2 space-y-3">
            <p><Badge tone={tri.estabilidad === 'estable' ? 'green' : 'amber'}>{tri.estabilidad}</Badge> n = {tri.n}. <span className="text-xs text-gray-500">{tri.metodo}</span></p>
            {tri.avisos.map((a) => <p key={a} className="text-xs text-amber-700 dark:text-amber-300">⚠ {a}</p>)}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-gray-500"><tr>{['Pregunta', 'Discriminación a ± ET', 'Dificultad b ± ET', 'Estado', 'Dificultad clásica'].map((h) => <th key={h} className="p-1">{h}</th>)}</tr></thead>
                <tbody>{tri.items.map(({ id, cal }) => {
                  const e = inf.empirico.get(id);
                  return (
                    <tr key={id} className="border-t border-gray-100 dark:border-white/10">
                      <td className="p-1">{E(inf, id)}</td><td className="p-1">{cal.a.toFixed(2)} ± {cal.se_a.toFixed(2)}</td><td className="p-1">{cal.b.toFixed(2)} ± {cal.se_b.toFixed(2)}</td>
                      <td className="p-1">{cal.estado.replace('_', ' ')}</td><td className="p-1">{e?.p.ok ? pct(e.p.valor.p) : '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <div>
              <p className="font-medium">Precisión del examen según la habilidad</p>
              <p className="text-xs text-gray-500">Error típico de la habilidad estimada (menor = más preciso), con banda 10–90 % por la incertidumbre de los parámetros.</p>
              <div className="mt-1 grid grid-cols-5 gap-1 text-center text-xs">
                {[-2, -1, 0, 1, 2].map((t) => { const c = tri.curva.find((x) => Math.abs(x.theta - t) < 1e-9)!; return (
                  <div key={t} className="rounded border border-gray-200 p-1 dark:border-white/10"><div className="text-gray-500">θ = {t}</div><div className="font-semibold">ET {Number.isFinite(c.se) ? c.se.toFixed(2) : '∞'}</div>
                    <div className="text-gray-500">info {c.p10.toFixed(1)}–{c.p90.toFixed(1)}</div></div>
                ); })}
              </div>
            </div>
            <div>
              <p className="font-medium">Dependencia local (Q3 de Yen)</p>
              {tri.q3.length === 0 ? <p className="text-xs">Ningún par supera la media de Q3 ({tri.q3Media.toFixed(2)}) + 0,2.</p>
                : <ul className="list-disc pl-5 text-xs">{tri.q3.map((p) => <li key={p.a + p.b}>{E(inf, p.a)} — {E(inf, p.b)}: Q3 = {p.q3.toFixed(2)} (media {tri.q3Media.toFixed(2)}). Indicio de que comparten algo más que la habilidad general (mismo método, misma figura, etapas encadenadas); revíselo.</li>)}</ul>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
/** Análisis factorial exploratorio: ¿una dimensión o varias? (la TRI supone una sola). */
function VistaFactorial({ inf }: { inf: Informe }) {
  const [r, setR] = useState<Factorial | null>(null);
  const [calculando, setCalculando] = useState(false);
  return (
    <Card title="Estructura del examen: ¿una dimensión o varias? (análisis factorial exploratorio)">
      <p className="text-xs text-gray-500">Mínimo {MIN_FACTORIAL} estudiantes y {POR_PREGUNTA} por pregunta. Usa correlaciones tetracóricas (las adecuadas para preguntas correcta/incorrecta) y decide el número de factores comparando con datos al azar (análisis paralelo). Un factor es un grupo de preguntas que covarían: no es una habilidad demostrada.</p>
      {!r ? (
        <button className="btn-primario mt-2" disabled={calculando} onClick={() => { setCalculando(true); setTimeout(() => { setR(analisisFactorial(inf.matriz!, inf.preguntas)); setCalculando(false); }, 10); }}>
          {calculando ? 'Calculando…' : 'Analizar la estructura'}
        </button>
      ) : !r.ok ? <Notice tone="warn">{r.motivo}</Notice> : (
        <div className="mt-2 space-y-3">
          <p>
            <Badge tone={r.confianza === 'media' ? 'green' : 'amber'}>confianza {r.confianza}</Badge>{' '}
            n = {r.n} ·{' '}
            {r.kmo !== null && r.bartlett ? <>KMO = {r.kmo.toFixed(2)} · Bartlett p {r.bartlett.p < 0.001 ? '< 0,001' : `= ${r.bartlett.p.toFixed(3)}`} · </> : null}
            <strong>{r.m === 0 ? 'sin estructura común detectable' : r.m === 1 ? '1 factor' : `${r.m} factores`}</strong>
            {r.m <= 1 && ` · primer/segundo autovalor = ${r.unidimensional.razon.toFixed(1)}${r.unidimensional.esencial ? ' (esencialmente unidimensional: la TRI 2PL es razonable)' : ''}`}
          </p>
          {r.m > 1 && <p className="text-xs">Con más de una dimensión, la TRI unidimensional resume varias habilidades en un solo número: interprétela con cautela o analice cada grupo de preguntas por separado.</p>}
          {r.avisos.map((a) => <p key={a} className="text-xs text-amber-700 dark:text-amber-300">⚠ {a}</p>)}
          {r.excluidos.length > 0 && <p className="text-xs text-gray-500">Excluidas: {r.excluidos.map((e) => `${E(inf, e.id)} (${e.motivo})`).join('; ')}.</p>}
          <div>
            <p className="font-medium">Autovalores frente al azar</p>
            <div className="mt-1 flex flex-wrap gap-1 text-xs">
              {r.autovalores.slice(0, Math.min(6, r.autovalores.length)).map((l, k) => (
                <span key={k} className={`rounded border px-2 py-0.5 ${l > r.umbralParalelo[k] ? 'border-emerald-400' : 'border-gray-200 dark:border-white/10'}`}>
                  {k + 1}: {l.toFixed(2)} <span className="text-gray-500">(azar {r.umbralParalelo[k].toFixed(2)})</span>
                </span>
              ))}
            </div>
          </div>
          {r.m > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-gray-500"><tr><th className="p-1">Pregunta</th>{r.factores.map((f) => <th key={f.indice} className="p-1">F{f.indice}</th>)}<th className="p-1">Comunalidad</th><th className="p-1">Nota</th></tr></thead>
                <tbody>{r.items.map((it) => (
                  <tr key={it.id} className="border-t border-gray-100 dark:border-white/10">
                    <td className="p-1">{E(inf, it.id)}</td>
                    {it.cargas.map((l, f) => <td key={f} className={`p-1 ${it.factor === f ? 'font-semibold' : 'text-gray-500'}`}>{l.toFixed(2)}</td>)}
                    <td className="p-1">{it.comunalidad.toFixed(2)}</td>
                    <td className="p-1">{it.cruzada ? 'carga en dos factores' : it.factor === null ? 'sin factor claro' : ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {r.m > 1 && (
            <ul className="list-disc pl-5 text-xs">
              {r.factores.map((f) => <li key={f.indice}>F{f.indice} ({pct(f.varianza)} de la varianza): {f.items.length ? f.items.map((id) => E(inf, id)).join(', ') : 'ninguna pregunta asignada'}{f.etiqueta ? ` — ${f.etiqueta}` : ''}.</li>)}
            </ul>
          )}
          <p className="text-xs text-gray-500">{r.metodo} Procedencia: empírica, exploratoria.</p>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------------------------
interface RespuestaIA {
  ok: boolean; motivo?: string; simulado?: boolean;
  resultado?: { resumen: string; hallazgos: { tipo: string; texto: string; preguntas: number[] }[]; limitaciones: string; descartados: { texto: string; motivo: string }[]; etiqueta: string };
}
const MOTIVOS_IA: Record<string, string> = {
  apagado: 'Orbe IA está apagado. Se enciende en el panel de Orbe IA (administración); con las llamadas reales apagadas responde el simulador, sin coste.',
  limite_diario: 'Se alcanzó el límite diario de llamadas de Orbe IA.', presupuesto: 'Se alcanzaría el presupuesto mensual de Orbe IA.',
  permiso: 'Su cuenta no puede usar Orbe IA.', sin_clave: 'Las llamadas reales están activadas pero el servidor no tiene clave de API.',
  formato: 'La respuesta del modelo no tenía el formato pedido; no se muestra nada.', rechazo_modelo: 'El modelo no respondió a esta petición.',
  proposito: 'Falta instalar la migración 52 (interpretación con IA).',
};
const TIPOS_IA: Record<string, string> = { revisar_pregunta: 'Revisar pregunta', concepto_dificil: 'Concepto difícil', estructura: 'Estructura', investigar: 'Para investigar' };

/** Capa B: interpretación con Claude a través de Orbe IA (solo cifras agregadas; capa C de verificación en el servidor). */
export function InterpretacionIA({ inf }: { inf: Informe }) {
  const datos = resumenParaIA(inf, null);
  const [r, setR] = useState<RespuestaIA | null>(null);
  const accion = useAction();
  const pedir = () => void accion.run(async () => setR(await invocar<RespuestaIA>('orbe-ia', { action: 'lieia', examen: datos })));
  return (
    <div className="space-y-3 text-sm">
      <Card title="Interpretación con IA (sin validar)">
        <p className="text-xs text-gray-500">Claude propone interpretaciones pedagógicas a partir de las cifras agregadas del examen. No recibe seudónimos, respuestas individuales ni nombres: solo lo que ve abajo. El servidor descarta las propuestas que citan cifras o preguntas que no están en los datos, afirman causas o hablan de conducta. Usa el presupuesto y los límites de Orbe IA.</p>
        <details className="mt-2 text-xs"><summary className="cursor-pointer">Datos que se enviarán ({datos.items.length} preguntas, {datos.n} estudiantes)</summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 dark:bg-white/5">{JSON.stringify(datos, null, 1)}</pre>
        </details>
        <button className="btn-primario mt-2" disabled={accion.busy} onClick={pedir}>{accion.busy ? 'Consultando…' : 'Pedir interpretación'}</button>
        <ErrorBox error={accion.error} />
      </Card>
      {r && !r.ok && <Notice tone="warn">{MOTIVOS_IA[r.motivo ?? ''] ?? `No se pudo obtener la interpretación (${r.motivo}).`}</Notice>}
      {r?.ok && r.resultado && (
        <Card title={r.simulado ? 'Interpretación (SIMULACIÓN: llamadas reales apagadas)' : 'Interpretación de Claude'}>
          <p><Badge tone="amber">{r.resultado.etiqueta}</Badge></p>
          {r.resultado.resumen && <p className="mt-2">{r.resultado.resumen}</p>}
          {r.resultado.hallazgos.length === 0 ? <Empty>Ninguna propuesta superó la verificación.</Empty> : (
            <ul className="mt-2 space-y-2">{r.resultado.hallazgos.map((h, i) => (
              <li key={i} className="rounded border border-gray-200 p-2 dark:border-white/10">
                <Badge>{TIPOS_IA[h.tipo] ?? h.tipo}</Badge> {h.preguntas.length > 0 && <span className="text-xs text-gray-500">{h.preguntas.map((p) => `P${p}`).join(', ')}</span>}
                <p className="mt-1">{h.texto}</p>
              </li>
            ))}</ul>
          )}
          {r.resultado.limitaciones && <p className="mt-2 text-xs text-gray-500">Limitaciones: {r.resultado.limitaciones}</p>}
          {r.resultado.descartados.length > 0 && (
            <details className="mt-2 text-xs"><summary className="cursor-pointer">Descartadas por la verificación ({r.resultado.descartados.length})</summary>
              <ul className="mt-1 list-disc pl-5">{r.resultado.descartados.map((d, i) => <li key={i}>«{d.texto}» — {d.motivo}</li>)}</ul>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
export function Simulador({ items, titulo }: { items: ItemSim[]; titulo: string }) {
  const [e, setE] = useState<Escenario>({ ...ESCENARIO_BASE });
  const [res, setRes] = useState<ResultadoSim[]>([]);
  const [semilla, setSemilla] = useState(20261101);
  const [ocupado, setOcupado] = useState(false);
  const [r, setR] = useState('0.3');
  const [p1, setP1] = useState('0.5'), [p2, setP2] = useState('0.7');
  const ultimo = res[res.length - 1];
  const correr = () => { setOcupado(true); setTimeout(() => { setRes((x) => [...x, simular(items, { ...e, nombre: e.nombre || `Escenario ${x.length + 1}` }, 200, semilla)]); setOcupado(false); }, 10); };
  const num = (k: keyof Escenario, v: string) => setE({ ...e, [k]: v === '' ? null : Number(v) });
  return (
    <div className="space-y-3 text-sm">
      <Notice tone="info">Estudiantes SINTÉTICOS bajo supuestos que usted elige. Los resultados son simulados: no describen a estudiantes reales ni se mezclan con datos observados.</Notice>
      <Card title={`Escenario · ${titulo}`}>
        <div className="grid gap-2 sm:grid-cols-4">
          <label>Nombre<input className="campo" value={e.nombre} onChange={(x) => setE({ ...e, nombre: x.target.value })} /></label>
          <label>Estudiantes<input type="number" min={5} max={500} className="campo" value={e.n} onChange={(x) => num('n', x.target.value)} /></label>
          <label>Duración (min)<input type="number" min={5} className="campo" placeholder="sin límite" value={e.limiteMin ?? ''} onChange={(x) => num('limiteMin', x.target.value)} /></label>
          <label>Orden<select className="campo" value={e.orden} onChange={(x) => setE({ ...e, orden: x.target.value as Escenario['orden'] })}><option value="fijo">fijo</option><option value="inverso">inverso</option><option value="aleatorio">aleatorio</option></select></label>
          <label>Habilidad media<input type="number" step={0.25} className="campo" value={e.mu} onChange={(x) => num('mu', x.target.value)} /></label>
          <label>Dispersión de habilidad<input type="number" step={0.1} min={0.1} className="campo" value={e.sigma} onChange={(x) => num('sigma', x.target.value)} /></label>
          <label>Propensión a omitir (0–1)<input type="number" step={0.1} min={0} max={1} className="campo" value={e.propensionOmitir} onChange={(x) => num('propensionOmitir', x.target.value)} /></label>
          <label>Dispersión de velocidad<input type="number" step={0.05} min={0} className="campo" value={e.sdVelocidad} onChange={(x) => num('sdVelocidad', x.target.value)} /></label>
        </div>
        <details className="mt-2"><summary className="cursor-pointer text-xs">Quitar preguntas ({e.excluir.length})</summary>
          <div className="mt-1 grid grid-cols-4 gap-1 text-xs sm:grid-cols-8">{items.map((i) => (
            <label key={i.id} className="flex items-center gap-1"><input type="checkbox" checked={e.excluir.includes(i.id)} onChange={(x) => setE({ ...e, excluir: x.target.checked ? [...e.excluir, i.id] : e.excluir.filter((y) => y !== i.id) })} /> {i.etiqueta}</label>
          ))}</div>
        </details>
        <details className="mt-1"><summary className="cursor-pointer text-xs">Avanzado</summary><label className="text-xs">Semilla<input type="number" className="campo w-40" value={semilla} onChange={(x) => setSemilla(Number(x.target.value))} /></label></details>
        <div className="mt-2 flex gap-2">
          <button className="btn-primario" disabled={ocupado || items.length - e.excluir.length < 1} onClick={correr}>{ocupado ? 'Simulando…' : 'Simular (200 réplicas)'}</button>
          {res.length > 0 && <button className="btn-texto" onClick={() => setRes([])}>Borrar escenarios</button>}
        </div>
      </Card>

      {res.length > 0 && (
        <Card title="Comparación de escenarios (simulado)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-gray-500"><tr>{['Escenario', 'Preg.', 'Duración', 'Puntuación media ± DE', 'KR-20 [p10–p90]', 'Terminan', 'Omisiones por tiempo', 'Parámetros'].map((h) => <th key={h} className="p-1">{h}</th>)}</tr></thead>
              <tbody>{res.map((x, k) => (
                <tr key={k} className="border-t border-gray-100 dark:border-white/10">
                  <td className="p-1">{x.escenario.nombre}</td><td className="p-1">{x.porItem.length}</td><td className="p-1">{x.escenario.limiteMin ? `${x.escenario.limiteMin} min` : 'libre'}</td>
                  <td className="p-1">{x.puntuacion.media.toFixed(1)} ± {x.puntuacion.sd.toFixed(1)}</td>
                  <td className="p-1">{x.kr20 ? `${x.kr20.mediana.toFixed(2)} [${x.kr20.p10.toFixed(2)}–${x.kr20.p90.toFixed(2)}]` : '—'}</td>
                  <td className="p-1">{pct(x.terminan)}</td><td className="p-1">{pct(x.porItem.reduce((s, i) => s + i.omiteTiempo, 0) / Math.max(1, x.porItem.length))}</td>
                  <td className="p-1">{x.procedenciaParametros.calibrados ? `${x.procedenciaParametros.calibrados} calibrados` : 'a priori'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {ultimo && (
            <>
              <p className="mt-3 font-medium">Por pregunta · {ultimo.escenario.nombre}</p>
              <div className="mt-1 grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">{ultimo.porItem.map((i) => (
                <div key={i.id} className="rounded border border-gray-200 p-1 dark:border-white/10"><strong>{i.etiqueta}</strong> aciertos {pct(i.aciertos)} · omite por tiempo {pct(i.omiteTiempo)} · por desconocimiento {pct(i.omiteDesconocimiento)}</div>
              ))}</div>
              <ul className="mt-2 list-disc pl-5 text-xs text-gray-500">{ultimo.supuestos.map((s) => <li key={s}>{s}</li>)}</ul>
            </>
          )}
        </Card>
      )}

      <Card title="¿Cuántos estudiantes harían falta?">
        <p className="text-xs text-gray-500">Cálculo analítico (α = 0,05 bilateral, potencia 80 %). Supone muestras independientes y medidas sin error: con pocas preguntas por habilidad, hará falta más.</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs">Correlación que quiere poder detectar<input type="number" step={0.05} min={0.05} max={0.95} className="campo w-28" value={r} onChange={(x) => setR(x.target.value)} /></label>
            {Number(r) > 0 && Number(r) < 1 && <p className="mt-1">≈ <strong>{nCorrelacion(Number(r))}</strong> estudiantes. Con 40, la potencia sería {pct(potenciaCorrelacion(Number(r), 40))}.</p>}
          </div>
          <div>
            <span className="text-xs">Diferencia entre dos grupos (proporción de aciertos)</span>
            <div className="flex gap-1"><input type="number" step={0.05} className="campo w-24" value={p1} onChange={(x) => setP1(x.target.value)} /><input type="number" step={0.05} className="campo w-24" value={p2} onChange={(x) => setP2(x.target.value)} /></div>
            {Number(p1) > 0 && Number(p2) > 0 && Number(p1) < 1 && Number(p2) < 1 && Number(p1) !== Number(p2) && <p className="mt-1">≈ <strong>{nProporciones(Number(p1), Number(p2))}</strong> estudiantes por grupo.</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------
export function Historial({ inf, classId, activityId }: { inf: Informe; classId: string; activityId: string }) {
  const st = useAsync(() => listar(classId, null), [classId]);
  const [ver, setVer] = useState<'investigacion' | 'diseno'>('investigacion');
  if (st.loading) return <Spinner />;
  if (st.error) return <Notice tone="info">El historial requiere la migración 48 instalada. ({st.error})</Notice>;
  const regs: RegistroLab[] = st.data ?? [];
  const inv = reabrir(regs.filter((r) => r.kind === 'investigacion' && r.activity_id === activityId), inf);
  const dis = regs.filter((r) => r.kind === 'diseno');
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-2"><button className={ver === 'investigacion' ? 'btn-primario' : 'btn-secundario'} onClick={() => setVer('investigacion')}>Investigaciones de este examen ({inv.length})</button>
        <button className={ver === 'diseno' ? 'btn-primario' : 'btn-secundario'} onClick={() => setVer('diseno')}>Diseños de la sección ({dis.length})</button></div>
      {ver === 'investigacion' && (inv.length === 0 ? <Empty>No hay investigaciones guardadas para este examen.</Empty> : inv.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <strong className="min-w-0 flex-1">{r.titulo}</strong>
            <span className="flex gap-1"><Badge tone={r.tipo === 'preregistrada' ? 'green' : 'amber'}>{r.tipo === 'preregistrada' ? 'registrada antes de los datos' : 'exploratoria'}</Badge><Badge tone="gray">{r.estado}</Badge></span>
          </div>
          <p className="mt-1 text-xs">{r.explicacion}</p>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded border border-gray-200 p-2 dark:border-white/10"><strong>Al guardarla</strong> (n = {r.guardadaCon}): {r.resultadoEntonces ?? 'sin resultado calculado'}</div>
            <div className="rounded border border-gray-200 p-2 dark:border-white/10"><strong>Ahora</strong> (n = {inf.examen?.n ?? 0}): {r.estadoAhora === 'ya_no_aplica' ? 'la propuesta ya no aparece con los datos actuales' : r.resultadoAhora ?? ESTADOS[r.estadoAhora]}</div>
          </div>
          {r.cambio === 'nuevos_datos' && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Hay datos nuevos desde que se guardó.</p>}
        </Card>
      )))}
      {ver === 'diseno' && (dis.length === 0 ? <Empty>No hay diseños guardados.</Empty> : dis.map((d) => {
        const p = d.payload as { titulo?: string; criterio?: string; semilla?: number; items?: unknown[]; borradores?: string[] };
        return (
          <Card key={d.id}>
            <strong>{p.titulo ?? d.clave}</strong> <Badge tone="gray">{d.estado}</Badge>
            <p className="text-xs text-gray-500">{p.criterio} · semilla {p.semilla} · {p.items?.length ?? 0} preguntas · {new Date(d.updated_at).toLocaleString('es-DO')}</p>
            {p.borradores?.length ? <p className="text-xs">Borradores: {p.borradores.map((id, k) => <Link key={id} className="enlace mr-2" to={`/docente/actividades/${id}`}>{p.borradores!.length > 1 ? `versión ${'AB'[k]}` : 'abrir'}</Link>)}</p> : null}
          </Card>
        );
      }))}
    </div>
  );
}
