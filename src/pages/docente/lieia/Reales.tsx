/**
 * LIEIA · Pestaña «Evaluaciones reales». Solo el profesorado de la sección (comprobado en el servidor). Los datos
 * llegan minimizados (seudónimos, huellas de respuesta); los nombres se revelan solo a petición, y queda auditado.
 * Solo se presentan como evidencia los detectores validados en el laboratorio; el resto se abstiene.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { rpc } from '@/lib/supabase';
import { teacherOverview } from '@/api/docente';
import { useAction, useAsync } from '@/lib/util';
import { enTrabajador } from '@/lib/lieia/cliente';
import { aExamen, type DatosRealesExamen } from '@/lib/lieia/datosReales';
import { grafo, type Analisis } from '@/lib/lieia/detectores';
import { kaplanMeier } from '@/lib/lieia/estadistica';
import { DETECTORES } from '@/lib/lieia/laboratorio';
import type { ExamenObservado } from '@/lib/lieia/tipos';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';
import { CurvaSupervivencia, Dispersion, GrafoDependencias, MatrizParejas, useTema } from './graficos';
import { habilitado, posteriorHabilitada, TONO_ESTADO, VALIDACION } from './Validacion';
import { ESTADO_TEXTO } from '@/lib/lieia/validacion';

type AnalisisSerial = Omit<Analisis, 'rasch'> & { rasch: { theta: number[]; b: number[] } };
interface Actividad { id: string; titulo: string; modo: string; cierra: string | null; entregados: number; con_tiempos: number; items: number }
interface Nombre { seudonimo: string; user_id: string; full_name: string; student_code: string | null }

const fmtP = (p: number | null | undefined) => (p === null || p === undefined ? '—' : p < 0.001 ? '< 0,001' : p.toFixed(3).replace('.', ','));
const Q = 0.1;

function interpretacion(q1: number | null, q3: number | null, q2: number | null): string {
  const s1 = q1 !== null && q1 < Q, s3 = q3 !== null && q3 < Q, s2 = q2 !== null && q2 < Q;
  if (s1 && s3) return 'Errores idénticos y respuestas sincronizadas, ambos improbables bajo independencia: compatible con intercambio de respuestas durante el examen.';
  if (s1) return 'Errores idénticos improbables bajo independencia, sin sincronía temporal: compatible con causa común (estudiar juntos, mismo material) o con copia diferida.';
  if (s3) return 'Sincronía improbable bajo el modelo de tiempos, sin errores idénticos notables: puede deberse a colaboración en respuestas correctas o a variación no modelada.';
  if (s2) return 'Solo tiempos acoplados (detector con potencia limitada): indicio débil.';
  return '';
}

export function Reales() {
  const t = useTema();
  const secciones = useAsync(teacherOverview, []);
  const [clase, setClase] = useState('');
  const acts = useAsync(() => (clase ? rpc<Actividad[]>('lieia_activities', { p_class: clase }) : Promise.resolve([])), [clase]);
  const [act, setAct] = useState<Actividad | null>(null);
  const [examen, setExamen] = useState<ExamenObservado | null>(null);
  const [res, setRes] = useState<AnalisisSerial | null>(null);
  const [nombres, setNombres] = useState<Nombre[] | null>(null);
  const [progreso, setProgreso] = useState(false);
  const accion = useAction();

  async function analizar(a: Actividad) {
    setAct(a); setRes(null); setNombres(null); setExamen(null);
    await accion.run(async () => {
      setProgreso(true);
      const d = await rpc<DatosRealesExamen>('lieia_exam_data', { p_activity: a.id });
      const ex = aExamen(d);
      setExamen(ex);
      if (ex.estudiantes.length < 3) throw new Error('Hay menos de 3 entregas: no hay nada que comparar.');
      const r = await enTrabajador<AnalisisSerial>({ tipo: 'analizar', examen: ex, opciones: { permutaciones: 199, bootstrap: 199 } }).promesa;
      setRes(r);
    }).finally(() => setProgreso(false));
  }

  const etiqueta = (k: number) => {
    const s = examen?.estudiantes[k].id ?? `#${k}`;
    const n = nombres?.find((x) => x.seudonimo === s);
    return n ? `${s} · ${n.full_name}` : s;
  };
  const filas = useMemo(() => {
    if (!res) return [];
    return res.parejas
      .map((p) => ({ ...p, q1v: habilitado('d1') ? p.q1 : null, q2v: habilitado('d2') ? p.q2 : null, q3v: habilitado('d3') ? p.q3 : null }))
      .filter((p) => [p.q1v, p.q2v, p.q3v].some((q) => q !== null && q < 0.2))
      .sort((a, b) => Math.min(a.d1?.p ?? 1, a.d3?.p ?? 1) - Math.min(b.d1?.p ?? 1, b.d3?.p ?? 1));
  }, [res]);
  const g = useMemo(() => (res && examen ? grafo(res as unknown as Analisis, examen.estudiantes.length, (['d1', 'd3'] as const).filter((d) => habilitado(d)), Q) : null), [res, examen]);

  return (
    <div className="space-y-4">
      <Notice tone="warn">Un resultado estadístico no es una acusación ni una sanción: indica que los datos serían improbables si los estudiantes hubieran respondido de forma independiente, según modelos validados con datos sintéticos. Úselo para decidir qué revisar, nunca como prueba por sí solo. Vea «Qué puede y qué no puede inferirse».</Notice>
      <Card title="Elegir una evaluación">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Sección
            <select className="campo" value={clase} onChange={(e) => { setClase(e.target.value); setAct(null); setRes(null); }}>
              <option value="">Elija…</option>
              {(secciones.data ?? []).filter((s) => !s.archived).map((s) => <option key={s.class_id} value={s.class_id}>{s.course_title} · {s.name}</option>)}
            </select>
          </label>
        </div>
        {acts.loading ? <Spinner /> : (acts.data ?? []).length > 0 && (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Actividad</th><th>Tipo</th><th className="text-right">Entregas</th><th className="text-right">Con tiempos por pregunta</th><th /></tr></thead>
            <tbody>{acts.data!.map((a) => (
              <tr key={a.id} className={`border-b border-gray-100 dark:border-white/5 ${act?.id === a.id ? 'bg-primario-50 dark:bg-white/5' : ''}`}>
                <td className="py-1">{a.titulo}</td><td className="text-xs">{a.modo === 'exam' ? 'evaluación' : 'práctica'}</td>
                <td className="text-right tabular-nums">{a.entregados}</td>
                <td className="text-right tabular-nums">{a.con_tiempos}/{a.entregados}</td>
                <td className="text-right"><button className="btn-secundario !py-0.5 text-xs" disabled={a.entregados < 3 || progreso} onClick={() => void analizar(a)}>Analizar</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-gray-500">Los tiempos por pregunta se registran desde la activación de LIEIA; en evaluaciones anteriores solo se analizan las respuestas (D1). Cada consulta queda auditada.</p>
        <ErrorBox error={accion.error || acts.error} />
        {progreso && <Spinner label="Analizando (permutaciones y remuestreos en segundo plano)…" />}
      </Card>

      {res && examen && act && (
        <>
          <Card title={`${act.titulo} · ${examen.estudiantes.length} estudiantes · ${examen.items.length} ítems`}
            actions={!nombres && <button className="btn-secundario !py-1 text-xs" onClick={() => void accion.run(async () => setNombres(await rpc<Nombre[]>('lieia_reveal', { p_activity: act.id })))}>Mostrar nombres (queda registrado)</button>}>
            <ul className="text-sm">
              <li>Tiempos por pregunta: {examen.conTiempos ? '✓ registrados' : '✗ no disponibles (evaluación anterior a la instrumentación)'}</li>
              {res.abstenciones.map((a) => <li key={a} className="text-amber-700 dark:text-amber-400">⚠ {a}</li>)}
              <li className="mt-1 text-xs text-gray-500">Detectores: {(Object.keys(DETECTORES) as (keyof typeof DETECTORES)[]).map((d) => <span key={d} className="mr-2 inline-block"><Badge tone={TONO_ESTADO[VALIDACION.veredictos[d].estado]}>{d.toUpperCase()}</Badge> {ESTADO_TEXTO[VALIDACION.veredictos[d].estado]}</span>)}</li>
              <li className="text-xs text-gray-500">Probabilidad posterior: {posteriorHabilitada('d1') ? 'disponible' : 'abstención (no superó el criterio de calibración e informatividad); se usan valores q (Benjamini–Hochberg)'}.</li>
            </ul>
          </Card>

          <Card title={`Parejas con evidencia de dependencia (q < 0,2) · ${filas.length} de ${res.parejas.length}`}>
            {!filas.length ? <p className="text-sm text-gray-500">Ninguna pareja muestra evidencia de dependencia tras corregir por comparaciones múltiples. Esto no prueba que nadie colaboró: los detectores tienen potencia limitada (vea Validación).</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs dark:border-white/10">
                    <th className="py-1">Pareja</th><th className="text-right">D1 errores idénticos (esperados)</th><th className="text-right">D1 p / q</th>
                    <th className="text-right">D3 sincronía p / q</th><th>Responde primero</th><th className="text-right">D2 p / q</th><th>Lectura</th>
                  </tr></thead>
                  <tbody>{filas.map((p) => (
                    <tr key={`${p.i}-${p.j}`} className="border-b border-gray-100 align-top dark:border-white/5">
                      <td className="py-1 whitespace-nowrap">{etiqueta(p.i)}<br />{etiqueta(p.j)}</td>
                      <td className="text-right tabular-nums">{p.d1 ? `${p.d1.identicas} (${p.d1.esperadas.toFixed(1)}) de ${p.d1.comunes}` : '—'}</td>
                      <td className={`text-right tabular-nums ${p.q1v !== null && p.q1v < Q ? 'font-semibold' : ''}`}>{fmtP(p.d1?.p)} / {fmtP(p.q1v)}</td>
                      <td className={`text-right tabular-nums ${p.q3v !== null && p.q3v < Q ? 'font-semibold' : ''}`}>{fmtP(p.d3?.p)} / {fmtP(p.q3v)}</td>
                      <td className="text-xs">{p.d3?.lider !== null && p.d3?.lider !== undefined ? `${etiqueta(p.d3.lider)} (mediana ${Math.abs(Math.round(p.d3.retardo))} s antes)` : '—'}</td>
                      <td className="text-right tabular-nums text-gray-500">{fmtP(p.d2?.p)} / {fmtP(p.q2v)}</td>
                      <td className="max-w-xs text-xs">{interpretacion(p.q1v, p.q3v, p.q2v)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Matriz de evidencia por pareja (D1, −log₁₀ p)">
              <MatrizParejas n={examen.estudiantes.length} etiquetas={examen.estudiantes.map((e) => e.id)}
                valor={(i, j) => { const par = res.parejas.find((x) => x.i === i && x.j === j); return par?.d1 ? -Math.log10(Math.max(1e-12, par.d1.p)) : null; }} />
            </Card>
            {g && (
              <Card title={`Grafo de dependencias (q < ${String(Q).replace('.', ',')}) · ${g.aristas.length} aristas`}>
                {g.aristas.length ? <GrafoDependencias n={examen.estudiantes.length} etiquetas={examen.estudiantes.map((e) => e.id)} grado={g.grado}
                  aristas={g.aristas.map((a) => ({ i: a.i, j: a.j, tipo: a.q3 !== null && a.q3 < Q ? 'd3' : 'd1', lider: a.d3?.lider ?? null }))} /> : <p className="text-sm text-gray-500">Sin aristas.</p>}
                {g.componentes.filter((c) => c.length >= 3).map((c, k) => <p key={k} className="text-xs">Grupo conectado: {c.map(etiqueta).join(', ')}</p>)}
                {g.centro !== null && <p className="text-xs">Responde primero en más conexiones: <strong>{etiqueta(g.centro)}</strong> (compatible con una fuente que distribuye; en el laboratorio se identificó bien en {VALIDACION.escenarios.red?.centroRecuperado?.aciertos}/{VALIDACION.escenarios.red?.centroRecuperado?.total} réplicas).</p>}
                <p className="text-xs text-gray-500">Azul: errores idénticos (D1). Verde: sincronía (D3), con flecha desde quien responde primero.</p>
              </Card>
            )}
          </div>

          <Card title="Estudiantes">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs dark:border-white/10">
                  <th className="py-1">Estudiante</th><th className="text-right">Aciertos</th><th className="text-right">Habilidad (θ)</th>
                  <th className="text-right">D6 tiempo insensible p / q</th><th className="text-right text-gray-400">D4 l_z</th><th className="text-right text-gray-400">D5 rápidas difíciles</th><th className="text-right">Pestaña oculta</th><th className="text-right text-gray-400">D7 atipicidad</th>
                </tr></thead>
                <tbody>{[...res.estudiantes].sort((a, b) => (a.d6?.p ?? 1) - (b.d6?.p ?? 1)).map((e) => {
                  const n = nombres?.find((x) => x.seudonimo === examen.estudiantes[e.i].id);
                  return (
                    <tr key={e.i} className="border-b border-gray-100 dark:border-white/5">
                      <td className="py-1">{n ? <Link className="enlace" to={`/docente/estudiantes/${n.user_id}`}>{etiqueta(e.i)}</Link> : etiqueta(e.i)}</td>
                      <td className="text-right tabular-nums">{e.puntaje}/{e.respondidas}</td>
                      <td className="text-right tabular-nums">{e.theta.toFixed(2)}</td>
                      <td className={`text-right tabular-nums ${habilitado('d6') && e.q6 !== null && e.q6 < Q ? 'font-semibold' : ''}`}>{habilitado('d6') && e.d6 ? `${fmtP(e.d6.p)} / ${fmtP(e.q6)} (pend. ${e.d6.pendiente.toFixed(2)})` : '—'}</td>
                      <td className="text-right tabular-nums text-gray-400">{e.d4 ? e.d4.lz.toFixed(2) : '—'}</td>
                      <td className="text-right tabular-nums text-gray-400">{e.d5 ? `${e.d5.rapidas} (esp. ${e.d5.esperadas.toFixed(1)})` : '—'}</td>
                      <td className="text-right tabular-nums">{e.oculto ? `${Math.round(e.oculto / 60)} min` : '—'}</td>
                      <td className="text-right tabular-nums text-gray-400">{e.d7 ? e.d7.distancia.toFixed(1) : '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">En gris, indicadores no validados (sin potencia demostrada o con falsos positivos no controlados): solo descriptivos. Pestaña oculta = tiempo con el aula en segundo plano durante el intento; puede deberse a consultar otra fuente o a causas inocentes (no se infiere nada de ello). La pendiente esperada del tiempo frente a la exigencia de cada ítem es ≈ 1; cerca de 0 = tarda lo mismo en todo.</p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {res.tiempos && (
              <Card title="Dificultad frente a exigencia de tiempo, por ítem">
                <Dispersion datos={res.rasch.b.map((b, j) => ({ dificultad: b, tiempo: Math.exp(res.tiempos!.beta[j]) }))} x="dificultad" y="tiempo" etiquetaX="dificultad estimada (logits)" etiquetaY="tiempo típico (s)" color={t.color('d1')} />
              </Card>
            )}
            {examen.conTiempos && (
              <Card title="Tiempo hasta completar el examen (Kaplan–Meier)">
                <CurvaSupervivencia etiqueta="aún sin completar" puntos={kaplanMeier(examen.estudiantes.map((e, i) => {
                  const ts = examen.r[i].map((r) => r.t).filter((x): x is number => x !== null);
                  const completo = ts.length === examen.items.length;
                  return { t: Math.max(0, (ts.length ? Math.max(...ts) : e.fin ?? e.inicio) - e.inicio), evento: completo };
                }))} />
                <p className="text-xs text-gray-500">Proporción de estudiantes que aún no han respondido todas las preguntas; quien entregó con preguntas en blanco cuenta como censurado.</p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
