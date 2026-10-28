/**
 * LIEIA · Pestaña «Diseño LIEIA» del editor de actividades: configuración experimental, calibración por pregunta,
 * distribución de dificultad, información del examen, tiempos y equidad, equivalencia de versiones, prueba
 * experimental previa con el laboratorio, comparación de diseños y selección óptima de preguntas.
 * Ciclo: Diseño → Simulación → Calibración → Validación → Publicación → Análisis.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rpc } from '@/lib/supabase';
import { setActivityItems } from '@/api/docente';
import { useAction, useAsync } from '@/lib/util';
import { enTrabajador } from '@/lib/lieia/cliente';
import {
  aPriori, curvaInformacion, equivalencia, informacionEsperada, parametros, seleccionOptima, tiempoExamen, type Calibracion, type ItemBanco,
} from '@/lib/lieia/diseno';
import { disenoDesdeCalibracion, type FilaComparacion } from '@/lib/lieia/experimentosDiseno';
import { DETECTORES, type Detector } from '@/lib/lieia/laboratorio';
import { ESCENARIOS, type DisenoSim, type Escenario } from '@/lib/lieia/simulador';
import type { RolItem } from '@/lib/lieia/tipos';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';
import { useTema } from './graficos';
import disenos from '@/lib/lieia/disenos.json';

interface ItemDisenoUI {
  exercise_id: string; posicion: number; titulo: string; dificultad: ItemBanco['dificultad']; categoria: string; formato: string; conceptos: string[];
  opciones: number | null; rol: RolItem; grupo: string | null; bloque: number | null; calibracion: (Calibracion & { beta_t: number | null; sigma_t: number | null }) | null;
}
interface DatosDiseno { diseno: { orden: DisenoSim['orden']; versiones: boolean; limite_minutos: number | null } | null; intentos: number; course_id: string; items: ItemDisenoUI[] }

const ROLES: Record<RolItem, string> = { normal: 'normal', ancla: 'ancla', isomorfa: 'isomorfa', conceptual: 'conceptual', razonamiento: 'razonamiento' };
const ORDENES: Record<DisenoSim['orden'], string> = { fijo: 'Fijo (todos igual)', aleatorio: 'Aleatorio por estudiante', contrabalanceado: 'Contrabalanceado por bloques', anclas_fijas: 'Aleatorio con anclas fijas' };
const TONO: Record<string, 'green' | 'amber' | 'gray'> = { calibrado: 'green', provisional: 'amber', no_calibrado: 'gray' };
const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${(100 * x).toFixed(0)} %`);

/** Calibración efectiva: la guardada (completando el tiempo con el a priori si falta) o el a priori. */
function calDe(it: ItemDisenoUI): Calibracion {
  const p = aPriori(it);
  if (!it.calibracion) return p;
  return { ...it.calibracion, beta_t: it.calibracion.beta_t ?? p.beta_t, sigma_t: it.calibracion.sigma_t ?? p.sigma_t };
}
const aBanco = (it: ItemDisenoUI): ItemBanco => ({ exercise_id: it.exercise_id, titulo: it.titulo, dificultad: it.dificultad, formato: it.formato, categoria: it.categoria, conceptos: it.conceptos, calibracion: calDe(it) });

export function DisenoExamen({ activityId, courseId, estudiantesSeccion }: { activityId: string; courseId: string; estudiantesSeccion: number }) {
  const t = useTema();
  const st = useAsync(() => rpc<DatosDiseno>('design_get', { p_activity: activityId }), [activityId]);
  const [cfg, setCfg] = useState<{ orden: DisenoSim['orden']; versiones: boolean; limite: number | null } | null>(null);
  const [items, setItems] = useState<ItemDisenoUI[] | null>(null);
  const accion = useAction();
  const d = st.data;
  const conf = cfg ?? (d ? { orden: d.diseno?.orden ?? 'fijo', versiones: d.diseno?.versiones ?? false, limite: d.diseno?.limite_minutos ?? null } : null);
  const its = items ?? d?.items ?? [];
  const bloqueado = (d?.intentos ?? 0) > 0;

  const cals = useMemo(() => its.map(calDe), [its]);
  const curva = useMemo(() => (cals.length ? curvaInformacion(cals) : []), [cals]);
  const tiempo = useMemo(() => (cals.length ? tiempoExamen(cals, 0.3, conf?.limite ?? null) : null), [cals, conf?.limite]);
  const grupos = useMemo(() => {
    const m = new Map<string, ItemDisenoUI[]>();
    for (const it of its) if (it.grupo) m.set(it.grupo, [...(m.get(it.grupo) ?? []), it]);
    return [...m.entries()].map(([grupo, xs]) => ({ grupo, items: xs.map(aBanco) }));
  }, [its]);
  const equiv = useMemo(() => equivalencia(grupos), [grupos]);
  const estados = { calibrado: cals.filter((c) => c.estado === 'calibrado').length, provisional: cals.filter((c) => c.estado === 'provisional').length, no_calibrado: cals.filter((c) => c.estado === 'no_calibrado').length };

  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!d || !conf) return null;

  const cambiar = (k: number, patch: Partial<ItemDisenoUI>) => setItems(its.map((it, j) => (j === k ? { ...it, ...patch } : it)));
  async function guardar() {
    await accion.run(async () => {
      await rpc('design_save', { p_activity: activityId, p_orden: conf!.orden, p_versiones: conf!.versiones, p_limite: conf!.limite,
        p_items: its.map((it) => ({ exercise_id: it.exercise_id, rol: it.rol, grupo: it.grupo, bloque: it.bloque })) });
      setCfg(null); setItems(null); await st.reload();
    });
  }
  const disenoSim = (orden: DisenoSim['orden'], versiones: boolean): DisenoSim =>
    disenoDesdeCalibracion(its.map((it) => ({ cal: calDe(it), opciones: it.opciones, rol: it.rol, grupo: it.grupo, bloque: it.bloque })), orden, versiones);

  return (
    <div className="space-y-4">
      <Notice>Ciclo de trabajo: <strong>Diseño</strong> (configure el examen) → <strong>Simulación</strong> (prueba experimental con el laboratorio) → <strong>Calibración</strong> (con respuestas reales, en el Laboratorio LIEIA) → <strong>Validación</strong> → <strong>Publicación</strong> → <strong>Análisis</strong> (pestaña «Evaluaciones reales» de LIEIA). La detección nunca entra en la elección de preguntas: primero la validez pedagógica y la equidad.</Notice>

      <Card title="Configuración experimental" actions={<button className="btn-primario !py-1 text-sm" disabled={accion.busy || (!cfg && !items)} onClick={() => void guardar()}>Guardar diseño</button>}>
        <ErrorBox error={accion.error} />
        {bloqueado && <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">Ya hay {d.intentos} intento(s): el orden y las versiones quedan fijos para que todos tengan las mismas condiciones. Los papeles de las preguntas sí se pueden cambiar.</p>}
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <label>Orden de las preguntas
            <select className="campo" value={conf.orden} disabled={bloqueado} onChange={(e) => setCfg({ ...conf, orden: e.target.value as DisenoSim['orden'] })}>
              {Object.entries(ORDENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-5"><input type="checkbox" checked={conf.versiones} disabled={bloqueado} onChange={(e) => setCfg({ ...conf, versiones: e.target.checked })} /> Versiones: cada estudiante recibe una variante de cada grupo isomorfo</label>
          <label>Duración prevista (min, referencia)
            <input type="number" className="campo" min={1} max={600} value={conf.limite ?? ''} onChange={(e) => setCfg({ ...conf, limite: e.target.value ? Number(e.target.value) : null })} />
            <span className="text-xs text-gray-500">Se usa para estimar quién no terminaría; el aula todavía no corta el examen por tiempo.</span>
          </label>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10">
              <th className="py-1">#</th><th>Pregunta</th><th>Papel</th><th>Grupo isomorfo</th><th>Bloque</th>
              <th className="text-right">Dificultad b ± ET</th><th className="text-right">Discriminación a ± ET</th><th className="text-right">Tiempo típico</th><th>Estado</th><th className="text-right">n</th>
            </tr></thead>
            <tbody>{its.map((it, k) => {
              const c = calDe(it);
              return (
                <tr key={it.exercise_id} className="border-b border-gray-100 align-top dark:border-white/5">
                  <td className="py-1 tabular-nums">{it.posicion}</td>
                  <td className="max-w-xs text-xs">{it.titulo}<span className="block text-gray-500">{it.dificultad} · {it.formato} · {it.conceptos.join(', ')}</span></td>
                  <td><select className="campo !w-auto !py-0.5 text-xs" value={it.rol} onChange={(e) => cambiar(k, { rol: e.target.value as RolItem })}>{Object.entries(ROLES).map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></td>
                  <td><input className="campo !w-20 !py-0.5 text-xs" maxLength={40} placeholder="—" value={it.grupo ?? ''} disabled={bloqueado && conf.versiones} onChange={(e) => cambiar(k, { grupo: e.target.value.trim() || null })} /></td>
                  <td><input type="number" className="campo !w-16 !py-0.5 text-xs" min={0} max={20} value={it.bloque ?? ''} onChange={(e) => cambiar(k, { bloque: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                  <td className="text-right tabular-nums">{c.b.toFixed(2)} <span className="text-xs text-gray-500">± {c.se_b.toFixed(2)}</span></td>
                  <td className="text-right tabular-nums">{c.a.toFixed(2)} <span className="text-xs text-gray-500">± {c.se_a.toFixed(2)}</span></td>
                  <td className="text-right tabular-nums">{Math.round(Math.exp(c.beta_t))} s <span className="text-xs text-gray-500">({Math.round(Math.exp(c.beta_t - c.sigma_t))}–{Math.round(Math.exp(c.beta_t + c.sigma_t))})</span></td>
                  <td><Badge tone={TONO[c.estado]}>{c.estado === 'no_calibrado' ? 'no calibrado (a priori)' : c.estado}</Badge></td>
                  <td className="text-right tabular-nums">{c.n_resp}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {estados.calibrado} calibradas · {estados.provisional} provisionales · {estados.no_calibrado} sin calibrar. «Calibrado»: ≥ 100 respuestas y errores típicos pequeños; «provisional»: ≥ 20 respuestas; «no calibrado»: se usan valores a priori según la etiqueta de dificultad y el formato (incertidumbre amplia). Calibre las preguntas en <Link className="enlace" to="/docente/lieia">Laboratorio LIEIA → Calibración</Link>.
          Anclas: preguntas comunes que conectan versiones y secciones. Isomorfas: el mismo problema con otra apariencia (mismo grupo).
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Información del examen y precisión de la nota">
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={curva.map((p) => ({ ...p, banda: [p.p10, p.p90] }))} margin={{ right: 8 }}>
              <CartesianGrid stroke={t.rejilla} />
              <XAxis dataKey="theta" type="number" domain={[-4, 4]} tick={{ fill: t.texto, fontSize: 10 }} label={{ value: 'habilidad (θ)', fill: t.texto, fontSize: 10, position: 'insideBottom', offset: -2 }} />
              <YAxis tick={{ fill: t.texto, fontSize: 10 }} />
              <Tooltip contentStyle={t.tip} formatter={(v: number | number[]) => (Array.isArray(v) ? `${v[0].toFixed(1)}–${v[1].toFixed(1)}` : v.toFixed(2))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area dataKey="banda" name="incertidumbre (10–90 %)" fill={t.color('d1')} fillOpacity={0.18} stroke="none" />
              <Line dataKey="info" name="información" stroke={t.color('d1')} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500">Más información = nota más precisa para esa habilidad (error típico ≈ 1/√información). Información esperada en la población: <strong>{informacionEsperada(cals).toFixed(2)}</strong>. La banda refleja la incertidumbre de la calibración.</p>
        </Card>
        <Card title="Distribución de dificultad">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={Array.from({ length: 8 }, (_, k) => ({ tramo: `${(-4 + k).toFixed(0)} a ${(-3 + k).toFixed(0)}`, n: cals.filter((c) => c.b >= -4 + k && c.b < -3 + k).length }))}>
              <CartesianGrid stroke={t.rejilla} vertical={false} />
              <XAxis dataKey="tramo" tick={{ fill: t.texto, fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: t.texto, fontSize: 10 }} />
              <Tooltip contentStyle={t.tip} formatter={(v) => [v, 'preguntas']} />
              <Bar dataKey="n" fill={t.color('d3')} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500">Dificultad en logits (0 = estudiante típico acierta la mitad de las veces). Un examen sin preguntas en algún tramo mide mal a esos estudiantes.</p>
        </Card>
        {tiempo && (
          <Card title="Tiempo total esperado y equidad">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tiempo.histograma.map((h) => ({ min: Math.round(h.desde), n: h.n }))}>
                <CartesianGrid stroke={t.rejilla} vertical={false} />
                <XAxis dataKey="min" tick={{ fill: t.texto, fontSize: 10 }} label={{ value: 'minutos', fill: t.texto, fontSize: 10, position: 'insideBottom', offset: -2 }} />
                <YAxis tick={{ fill: t.texto, fontSize: 10 }} tickFormatter={(v) => `${Math.round(v * 100)} %`} />
                <Tooltip contentStyle={t.tip} formatter={(v: number) => [`${(v * 100).toFixed(1)} %`, 'estudiantes']} />
                <Bar dataKey="n" fill={t.color('d6')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-sm">Mediana {tiempo.mediana.toFixed(0)} min · 90 % termina en {tiempo.p90.toFixed(0)} min · 95 % en {tiempo.p95.toFixed(0)} min.</p>
            {conf.limite && (
              <p className={`text-sm ${tiempo.superaLimite! > 0.05 ? 'text-red-700 dark:text-red-400' : ''}`}>
                Con {conf.limite} min no terminaría el {pct(tiempo.superaLimite)} de los estudiantes; entre los más lentos (el 16 % de menor velocidad), el {pct(tiempo.superaLimiteLentos)}.
                {tiempo.superaLimiteLentos! > 0.1 && ' ⚠ El límite perjudica a los estudiantes lentos: amplíe el tiempo o acorte el examen.'}
              </p>
            )}
            <p className="text-xs text-gray-500">Simulación Monte Carlo con el modelo lognormal de tiempos y la variabilidad de velocidad entre estudiantes. Las preguntas sin datos de tiempo usan un a priori por formato.</p>
          </Card>
        )}
        {equiv.length > 0 && (
          <Card title="Equivalencia de versiones (equidad)">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Grupo</th><th className="text-right">Variantes</th><th className="text-right">Diferencia de dificultad</th><th className="text-right">Razón de tiempos</th><th>Veredicto</th></tr></thead>
              <tbody>{equiv.map((g) => (
                <tr key={g.grupo} className="border-b border-gray-100 dark:border-white/5">
                  <td className="py-1">{g.grupo}</td><td className="text-right">{g.variantes}</td><td className="text-right tabular-nums">{g.difDificultad.toFixed(2)}</td><td className="text-right tabular-nums">{g.razonTiempo.toFixed(2)}</td>
                  <td>{g.incierto ? <Badge>sin calibrar: no se puede afirmar</Badge> : g.equivalente ? <Badge tone="green">equivalentes</Badge> : <Badge tone="red">no equivalentes</Badge>}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500">Con versiones, cada estudiante recibe una sola variante: deben ser equivalentes (diferencia de dificultad ≤ 0,5 logits y de tiempo ≤ 30 %) para no favorecer a nadie.</p>
            {conf.versiones && equiv.some((g) => !g.equivalente) && <p className="mt-1 text-sm text-red-700 dark:text-red-400">⚠ Hay grupos no equivalentes o sin calibrar: las versiones podrían ser injustas.</p>}
          </Card>
        )}
      </div>

      <PruebaExperimental activityId={activityId} disenoSim={disenoSim} conf={conf} tieneGrupos={grupos.length > 0} estudiantes={estudiantesSeccion} sinCalibrar={estados.no_calibrado / Math.max(1, its.length)} />
      <SeleccionOptima courseId={courseId || d.course_id} activityId={activityId} actuales={its} bloqueado={bloqueado} onAplicado={() => { setItems(null); void st.reload(); }} />
      <ResultadosDiseno />
    </div>
  );
}

function PruebaExperimental({ activityId, disenoSim, conf, tieneGrupos, estudiantes, sinCalibrar }: {
  activityId: string; disenoSim: (o: DisenoSim['orden'], v: boolean) => DisenoSim; conf: { orden: DisenoSim['orden']; versiones: boolean }; tieneGrupos: boolean; estudiantes: number; sinCalibrar: number;
}) {
  const [n, setN] = useState(Math.max(12, estudiantes || 30));
  const [replicas, setReplicas] = useState(8);
  const [prog, setProg] = useState<[number, number] | null>(null);
  const [res, setRes] = useState<FilaComparacion[] | null>(null);
  const [comparar, setComparar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const escenarios: Escenario[] = ['independiente', 'mismo_ritmo', 'parejas', 'asistencia_ia', ...(tieneGrupos ? ['filtracion' as Escenario] : [])];
  const alternativas = [
    { nombre: 'Diseño actual', diseno: disenoSim(conf.orden, conf.versiones) },
    ...(comparar ? [
      ...(conf.orden !== 'fijo' ? [{ nombre: 'Orden fijo', diseno: disenoSim('fijo', conf.versiones) }] : []),
      ...(conf.orden !== 'aleatorio' ? [{ nombre: 'Orden aleatorio', diseno: disenoSim('aleatorio', conf.versiones) }] : []),
      ...(tieneGrupos ? [{ nombre: conf.versiones ? 'Sin versiones' : 'Con versiones', diseno: disenoSim(conf.orden, !conf.versiones) }] : []),
    ] : []),
  ];
  async function ejecutar() {
    setError(null); setRes(null); setProg([0, alternativas.length * escenarios.length]);
    try {
      const r = await enTrabajador<FilaComparacion[]>({ tipo: 'disenos', disenos: alternativas, escenarios, base: { estudiantes: n }, replicas, semilla: 20261028, analisis: { permutaciones: 49, bootstrap: 49 } }, (h, tot) => setProg([h, tot])).promesa;
      setRes(r);
      try { sessionStorage.setItem(`lieia-prueba-${activityId}`, new Date().toISOString()); } catch { /* sin almacenamiento */ }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setProg(null);
  }
  const dets: Detector[] = ['d1', 'd3', 'd6', 'd8'];
  return (
    <Card title="Prueba experimental del examen (antes de publicar)">
      <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">Simula este examen con estudiantes sintéticos de la habilidad y velocidad de una sección real, con y sin colaboración, asistencia externa o filtración, y mide qué podría detectar el análisis posterior y con cuántos falsos positivos. No usa datos de estudiantes.</p>
      {sinCalibrar > 0.5 && <Notice tone="warn">Más de la mitad de las preguntas no está calibrada: la simulación usa valores a priori y sus resultados son provisionales.</Notice>}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>Estudiantes<input type="number" className="campo !w-24" min={8} max={120} value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
        <label>Réplicas<input type="number" className="campo !w-24" min={2} max={40} value={replicas} onChange={(e) => setReplicas(Number(e.target.value))} /></label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} /> Comparar con diseños alternativos</label>
        <button className="btn-primario" disabled={!!prog} onClick={() => void ejecutar()}>Ejecutar prueba</button>
        {prog && <span className="text-xs">{prog[0]}/{prog[1]} combinaciones…</span>}
      </div>
      <ErrorBox error={error} />
      {res && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Diseño</th><th>Escenario</th>{dets.map((d) => <th key={d} className="text-right">{d.toUpperCase()} {DETECTORES[d].nombre}</th>)}</tr></thead>
            <tbody>{res.map((f, k) => (
              <tr key={k} className="border-b border-gray-100 dark:border-white/5">
                <td className="py-1">{f.diseno}</td><td className="text-xs">{ESCENARIOS[f.escenario].titulo} <Badge tone={ESCENARIOS[f.escenario].tipo === 'negativo' ? 'green' : 'blue'}>{ESCENARIOS[f.escenario].tipo}</Badge></td>
                {dets.map((d) => {
                  const m = f.detectores[d];
                  return <td key={d} className="text-right tabular-nums text-xs"><span className={m.fprSup > 0.075 && m.fpr > 0 ? 'text-red-600' : ''}>FP {pct(m.fpr)}</span>{m.potencia !== null && <strong className="block">detecta {pct(m.potencia)}</strong>}</td>;
                })}
              </tr>
            ))}</tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">«Detecta» = proporción de casos simulados que el detector señala a α = 5 %; «FP» = falsos positivos entre quienes no hicieron nada (en rojo si el IC supera el 7,5 %). Pocas réplicas ⇒ estimaciones gruesas. Más preguntas abiertas, más preguntas y pares isomorfos suelen aumentar la información (vea abajo los experimentos de diseño).</p>
        </div>
      )}
    </Card>
  );
}

function SeleccionOptima({ courseId, activityId, actuales, bloqueado, onAplicado }: { courseId: string; activityId: string; actuales: ItemDisenoUI[]; bloqueado: boolean; onAplicado: () => void }) {
  const banco = useAsync(() => rpc<(Omit<ItemDisenoUI, 'posicion' | 'rol' | 'grupo' | 'bloque'> & { leccion: string | null })[]>('calibration_bank', { p_course: courseId }), [courseId]);
  const [n, setN] = useState(Math.max(5, actuales.length || 10));
  const [conceptos, setConceptos] = useState<string[]>([]);
  const [limite, setLimite] = useState<number | null>(null);
  const [maxSin, setMaxSin] = useState(0.5);
  const [res, setRes] = useState<ReturnType<typeof seleccionOptima> | null>(null);
  const accion = useAction();
  if (banco.loading) return <Card title="Selección óptima de preguntas"><Spinner /></Card>;
  if (banco.error || !banco.data) return null;
  const bancoItems: ItemBanco[] = banco.data.map((b) => ({ exercise_id: b.exercise_id, titulo: b.titulo, dificultad: b.dificultad, formato: b.formato, categoria: b.categoria, conceptos: b.conceptos, calibracion: b.calibracion ? calDe({ ...b, posicion: 0, rol: 'normal', grupo: null, bloque: null }) : null }));
  const todos = [...new Set(bancoItems.flatMap((b) => b.conceptos))].sort();
  const obligatorios = actuales.filter((a) => a.rol === 'ancla').map((a) => a.exercise_id);
  return (
    <Card title="Selección óptima de preguntas (banco de la asignatura)">
      <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">Elige, entre las preguntas publicadas de la asignatura, las que más información aportan sobre la habilidad de la población, <strong>respetando primero la cobertura de los conceptos</strong>, el tiempo y un tope de preguntas sin calibrar. Las anclas del diseño actual se incluyen siempre.</p>
      <div className="grid gap-3 text-sm sm:grid-cols-4">
        <label>Nº de preguntas<input type="number" className="campo" min={1} max={60} value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
        <label>Tiempo mediano máx. (min)<input type="number" className="campo" min={1} value={limite ?? ''} onChange={(e) => setLimite(e.target.value ? Number(e.target.value) : null)} /></label>
        <label>Máx. sin calibrar<select className="campo" value={maxSin} onChange={(e) => setMaxSin(Number(e.target.value))}>{[0, 0.25, 0.5, 1].map((v) => <option key={v} value={v}>{v * 100} %</option>)}</select></label>
        <label>Conceptos que deben cubrirse
          <select multiple className="campo h-24" value={conceptos} onChange={(e) => setConceptos([...e.target.selectedOptions].map((o) => o.value))}>{todos.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
      </div>
      <button className="btn-secundario mt-2" onClick={() => setRes(seleccionOptima(bancoItems, { n, conceptos, obligatorios, limiteMin: limite, maxSinCalibrar: maxSin, poblacion: { mu: 0, sigma: 1 } }))}>Proponer selección</button>
      {res && (
        <div className="mt-3">
          {res.avisos.map((a) => <p key={a} className="text-sm text-amber-700 dark:text-amber-400">⚠ {a}</p>)}
          <p className="text-sm">Información esperada: <strong>{res.informacion.toFixed(2)}</strong> (actual: {informacionEsperada(actuales.map(calDe)).toFixed(2)}) · tiempo mediano ≈ {res.tiempoMediano.toFixed(0)} min.</p>
          <ol className="mt-1 list-decimal pl-5 text-xs">{res.elegidos.map((it) => { const c = parametros(it); return <li key={it.exercise_id}>{it.titulo} <span className="text-gray-500">· b {c.b.toFixed(2)} ± {c.se_b.toFixed(2)} · {c.estado} · {it.conceptos.join(', ')}{actuales.some((a) => a.exercise_id === it.exercise_id) ? ' · ya está' : ''}</span></li>; })}</ol>
          <ErrorBox error={accion.error} />
          <button className="btn-secundario mt-2" disabled={bloqueado || accion.busy} title={bloqueado ? 'Ya hay intentos: no se cambian las preguntas' : ''}
            onClick={() => window.confirm('¿Reemplazar las preguntas de la actividad por esta selección? (Se conservan los puntos por defecto de cada pregunta.)') &&
              void accion.run(async () => { await setActivityItems(activityId, res.elegidos.map((it) => ({ exercise_id: it.exercise_id, points: null }))); onAplicado(); })}>
            Usar esta selección en la actividad
          </button>
        </div>
      )}
    </Card>
  );
}

type Disenos = typeof disenos;
function ResultadosDiseno() {
  const x = disenos as Disenos;
  return (
    <Card title="Qué características del examen aportan información (experimentos de validación)">
      <p className="mb-2 text-xs text-gray-500">Experimento factorial del {new Date(x.generado).toLocaleDateString('es-DO')} · {x.replicas} réplicas por diseño y escenario · semilla {x.semilla}. Reproducible con <code>scripts/lieia-disenos.ts</code>; informe en <code>docs/LIEIA_DISENO.md</code>.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Característica</th><th>Efecto por detector</th></tr></thead>
          <tbody>{x.contrastes.map((c) => (
            <tr key={c.titulo} className="border-b border-gray-100 align-top dark:border-white/5">
              <td className="py-1.5">{c.titulo}</td>
              <td className="text-xs">{c.conclusiones.map((k) => (
                <span key={k.detector} className="mr-2 inline-block">
                  <Badge tone={k.veredicto === 'aporta' ? 'green' : k.veredicto === 'engañosa' ? 'red' : k.veredicto === 'resta' ? 'amber' : 'gray'}>{k.detector.toUpperCase()} {k.veredicto}</Badge> {pct(k.potenciaA)}→{pct(k.potenciaB)}
                </span>
              ))}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}
