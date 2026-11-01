/**
 * LIEIA · laboratorio científico: psicometría avanzada (TRI por examen), simulador de diseños y tamaños muestrales,
 * e historial de investigaciones (preregistradas frente a exploratorias).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listar, type RegistroLab } from '@/api/lieiaCiencia';
import type { Informe } from '@/lib/lieia/ciencia/informe';
import { ajustarTRI, MIN_TRI, type TRI } from '@/lib/lieia/ciencia/tri';
import { ESCENARIO_BASE, nCorrelacion, nProporciones, potenciaCorrelacion, simular, type Escenario, type ItemSim, type ResultadoSim } from '@/lib/lieia/ciencia/simulacion';
import { reabrir } from '@/lib/lieia/ciencia/historial';
import { ESTADOS } from '@/lib/lieia/ciencia/descubrimiento';
import { useAsync } from '@/lib/util';
import { Badge, Card, Empty, Notice, Spinner } from '@/components/ui';

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
export function VistaTRI({ inf, tri, setTri }: { inf: Informe; tri: TRI | null; setTri: (t: TRI) => void }) {
  const [calculando, setCalculando] = useState(false);
  if (!inf.matriz) return <Notice tone="info">n = 0: no hay respuestas reales; la TRI no puede ajustarse. Los parámetros de las preguntas son estimaciones a priori.</Notice>;
  return (
    <div className="space-y-3 text-sm">
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
            <p className="text-xs text-gray-500">Funcionamiento diferencial (DIF): no se calcula porque los datos seudonimizados no incluyen una variable de grupo; requeriría definirla de antemano.</p>
          </div>
        )}
      </Card>
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
