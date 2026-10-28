/**
 * ORBE IA — HUMOR CONTEXTUAL · panel del administrador. Todo lo decide el profesor: encender o apagar el módulo,
 * dónde funciona, con qué frecuencia, qué chistes se muestran (modo revisión), qué modelo y cuánto se puede gastar.
 * Las comprobaciones de permisos y límites se repiten en el servidor (orbe_ia_admin_* y la Edge Function).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  MODELOS_ORBE, orbeAccionChiste, orbeAgregarChiste, orbeChistes, orbeEstadoClave, orbeGenerar, orbeGuardarConfig, orbeGuardarCurso,
  orbeLecciones, orbePanel, type ChisteOrbe, type ConfigOrbe, type CursoOrbe, type LeccionOrbe, type PanelOrbe, type ResultadoGeneracion,
} from '@/api/orbeIa';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Notice, PageTitle, Spinner, Tabs } from '@/components/ui';

type Tab = 'estado' | 'cursos' | 'chistes' | 'consumo';

const SECCIONES: [string, string][] = [['teoria', 'Teoría'], ['formulas', 'Fórmulas'], ['ejemplos', 'Ejemplos'], ['simulacion', 'Simulación'], ['comprension', 'Comprensión'], ['practica', 'Práctica']];
const EVENTOS: [string, string][] = [['ejercicio_correcto', 'Ejercicio resuelto'], ['leccion_terminada', 'Lección terminada'], ['actividad_tras_intentos', 'Resuelta tras varios intentos'], ['fin_sesion', 'Fin de la sesión']];
const nombreSeccion = (s: string | null) => SECCIONES.find((x) => x[0] === s)?.[1] ?? null;
const nombreEvento = (s: string | null) => EVENTOS.find((x) => x[0] === s)?.[1] ?? null;
const usd = (n: number) => `US$ ${Number(n).toFixed(Number(n) < 1 ? 4 : 2)}`;
const fecha = (iso: string) => new Date(iso).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });

const MOTIVOS: Record<string, string> = {
  apagado: 'Orbe IA está apagado (interruptor general).', permiso: 'Sin permiso.', leccion: 'Lección inexistente.', apartado: 'Ese apartado no existe en la teoría.',
  suficientes: 'Esa lección ya tiene demasiados chistes guardados.', limite_diario: 'Se alcanzó el límite diario de llamadas.',
  presupuesto: 'La llamada superaría el presupuesto mensual.', sin_clave: 'Falta la clave de la API en el servidor.', autenticacion: 'La API rechazó la clave.',
  limite_api: 'La API está limitando las peticiones; pruebe más tarde.', red: 'No se pudo conectar con la API.', servidor_api: 'Error de la API.',
  formato: 'La respuesta no tenía el formato esperado.', rechazo_modelo: 'El modelo rechazó la petición.', peticion_invalida: 'La API no aceptó la petición.',
};

export default function OrbeIaPanel() {
  const [tab, setTab] = useState<Tab>('estado');
  const panel = useAsync(orbePanel, []);
  const clave = useAsync(() => orbeEstadoClave().catch(() => null), []);
  if (panel.loading && !panel.data) return <Spinner />;
  if (panel.error) return <ErrorBox error={panel.error} onRetry={panel.reload} />;
  const p = panel.data!;
  const c = p.config;
  return (
    <div className="space-y-4">
      <PageTitle title="🤖 ORBE IA — HUMOR CONTEXTUAL" subtitle="Chistes de física sobre lo que estudia cada estudiante, generados con Claude, revisados por usted y reutilizados." back={{ to: '/docente', label: 'Panel docente' }} />
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge tone={c.enabled ? 'green' : 'gray'}>{c.enabled ? 'Módulo encendido' : 'Módulo apagado'}</Badge>
        <Badge tone={c.students_enabled && c.enabled ? 'green' : 'gray'}>{c.students_enabled && c.enabled ? 'Visible para estudiantes' : 'Oculto a los estudiantes'}</Badge>
        <Badge tone={c.auto_approve ? 'amber' : 'blue'}>{c.auto_approve ? 'Aprobación automática' : 'Modo revisión'}</Badge>
        <Badge tone={c.api_real ? 'purple' : 'gray'}>{c.api_real ? `API real · ${c.model}` : 'Simulador (sin coste)'}</Badge>
        <Badge>{usd(p.estadisticas.gasto_mes_usd)} de {usd(c.monthly_budget_usd)} este mes</Badge>
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'estado', label: 'Configuración' }, { id: 'cursos', label: 'Asignaturas y lecciones' },
        { id: 'chistes', label: `Chistes${p.estadisticas.chistes.pendiente ? ` (${p.estadisticas.chistes.pendiente} por revisar)` : ''}` }, { id: 'consumo', label: 'Estadísticas y consumo' },
      ]} />
      {tab === 'estado' && <Configuracion c={c} clave={clave.data?.clave_configurada ?? null} onSaved={panel.reload} />}
      {tab === 'cursos' && <Cursos cursos={p.cursos} onSaved={panel.reload} />}
      {tab === 'chistes' && <Chistes cursos={p.cursos} onChange={panel.reload} />}
      {tab === 'consumo' && <Consumo p={p} />}
    </div>
  );
}

function Interruptor({ label, ayuda, checked, onChange, disabled }: { label: string; ayuda: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 border-b border-gray-100 py-2 dark:border-white/5 ${disabled ? 'opacity-60' : ''}`}>
      <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="font-medium">{label}</span><span className="block text-xs text-gray-500">{ayuda}</span></span>
    </label>
  );
}

function Numero({ label, value, onChange, min, max, step = 1, sufijo }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; sufijo?: string }) {
  return (
    <label className="text-sm">{label}
      <span className="mt-1 flex items-center gap-2">
        <input type="number" className="campo" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
        {sufijo && <span className="whitespace-nowrap text-xs text-gray-500">{sufijo}</span>}
      </span>
    </label>
  );
}

function Configuracion({ c, clave, onSaved }: { c: ConfigOrbe; clave: boolean | null; onSaved: () => void }) {
  const [d, setD] = useState<ConfigOrbe>(c);
  useEffect(() => setD(c), [c]);
  const set = (x: Partial<ConfigOrbe>) => setD((v) => ({ ...v, ...x }));
  const accion = useAction();
  const [ok, setOk] = useState(false);
  const loteMax = (4000 * d.price_input_per_mtok + d.max_output_tokens * d.price_output_per_mtok) / 1e6;
  const loteTipico = (600 * d.price_input_per_mtok + 1500 * d.price_output_per_mtok) / 1e6;
  async function guardar() {
    setOk(false);
    if (d.api_real && !c.api_real && !window.confirm(`Va a activar llamadas REALES (de pago) a ${d.model}. El gasto queda limitado a ${usd(d.monthly_budget_usd)} al mes y ${d.daily_max_calls} llamadas al día. ¿Continuar?`)) return;
    const r = await accion.run(() => orbeGuardarConfig({ ...d }));
    if (r) { setOk(true); onSaved(); }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Interruptores">
        <Interruptor label="Orbe IA encendido" ayuda="Interruptor general. Apagado: no se genera nada ni se muestra nada a nadie." checked={d.enabled} onChange={(v) => set({ enabled: v })} />
        <Interruptor label="Mostrar a los estudiantes" ayuda="Con esto apagado puede generar y revisar chistes sin que ningún estudiante los vea." checked={d.students_enabled} onChange={(v) => set({ students_enabled: v })} />
        <Interruptor label="Modo revisión (recomendado)" ayuda="Los chistes generados esperan su aprobación. Si lo desactiva, los que superen la validación se publican solos." checked={!d.auto_approve} onChange={(v) => set({ auto_approve: !v })} />
        <Interruptor label="Llamadas reales a la API de Claude" ayuda={clave === false ? 'Primero configure la clave en el servidor (vea las instrucciones abajo).' : 'Apagado: se usa el simulador, que no cuesta nada. Encendido: llamadas de pago, dentro de los límites de abajo.'}
          checked={d.api_real} onChange={(v) => set({ api_real: v })} disabled={clave === false && !d.api_real} />
        <Interruptor label="Reponer automáticamente" ayuda="Si un estudiante ya vio todos los chistes aprobados de una lección, se genera un lote nuevo (con los mismos límites; en modo revisión queda pendiente)." checked={d.auto_generate} onChange={(v) => set({ auto_generate: v })} />
        <Interruptor label="Eventos académicos (nivel C)" ayuda="Chistes al resolver bien un ejercicio de práctica. Nunca en evaluaciones." checked={d.events_enabled} onChange={(v) => set({ events_enabled: v })} />
      </Card>
      <Card title="Frecuencia de aparición">
        <div className="grid gap-3 sm:grid-cols-2">
          <Numero label="Como máximo un mensaje cada" value={d.interval_minutes} min={1} max={1440} onChange={(v) => set({ interval_minutes: v })} sufijo="minutos" />
          <Numero label="Actividad mínima antes del primero" value={Math.round(d.min_activity_seconds / 60)} min={0} max={60} onChange={(v) => set({ min_activity_seconds: v * 60 })} sufijo="minutos" />
        </div>
        <p className="mt-2 text-xs text-gray-500">Se comprueba en el servidor con el seguimiento de tiempo (actividad en los últimos 20 minutos). Nunca aparece durante una evaluación en curso, ni mientras el estudiante escribe, ni encima de un aviso del profesor.</p>
      </Card>
      <Card title="Modelo y límites de gasto">
        <label className="text-sm">Modelo
          <select className="campo mt-1" value={d.model} onChange={(e) => {
            const m = MODELOS_ORBE.find((x) => x.id === e.target.value)!;
            set({ model: m.id, price_input_per_mtok: m.entrada, price_output_per_mtok: m.salida });
          }}>
            {MODELOS_ORBE.map((m) => <option key={m.id} value={m.id}>{m.nombre} · US$ {m.entrada} / {m.salida} por millón de tokens (entrada / salida)</option>)}
          </select>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Numero label="Presupuesto mensual" value={d.monthly_budget_usd} min={0} max={1000} step={0.5} onChange={(v) => set({ monthly_budget_usd: v })} sufijo="US$" />
          <Numero label="Llamadas por día (máximo)" value={d.daily_max_calls} min={0} max={1000} onChange={(v) => set({ daily_max_calls: v })} />
          <Numero label="Chistes por llamada" value={d.jokes_per_batch} min={1} max={20} onChange={(v) => set({ jokes_per_batch: v })} />
          <Numero label="Tokens de salida por llamada (máximo)" value={d.max_output_tokens} min={512} max={8000} step={100} onChange={(v) => set({ max_output_tokens: v })} />
          <Numero label="Precio de entrada" value={d.price_input_per_mtok} min={0} max={100} step={0.01} onChange={(v) => set({ price_input_per_mtok: v })} sufijo="US$/M tokens" />
          <Numero label="Precio de salida" value={d.price_output_per_mtok} min={0} max={200} step={0.01} onChange={(v) => set({ price_output_per_mtok: v })} sufijo="US$/M tokens" />
        </div>
        <p className="mt-2 text-xs text-gray-500">Coste estimado por llamada ({d.jokes_per_batch} chistes): típico ≈ {usd(loteTipico)}; máximo {usd(loteMax)}. Antes de cada llamada real el servidor reserva el máximo y la rechaza si superaría el presupuesto del mes.</p>
      </Card>
      <Card title="Clave de la API">
        {clave === null ? <p className="text-sm text-gray-500">No se pudo consultar la Edge Function (¿aún no está desplegada?).</p>
          : clave ? <Notice tone="ok">La clave está configurada en el servidor. Nunca se muestra ni llega al navegador.</Notice>
          : <Notice tone="warn">Todavía no hay clave en el servidor: solo funciona el simulador.</Notice>}
        <p className="mt-2 text-xs text-gray-500">Se guarda como secreto de Supabase, desde su terminal: <code>npx supabase secrets set ANTHROPIC_API_KEY=… --project-ref …</code> (o en el panel de Supabase → Edge Functions → Secrets). No la escriba en el código ni en este formulario.</p>
      </Card>
      <div className="flex items-center gap-3 lg:col-span-2">
        <button className="btn-primario" disabled={accion.busy} onClick={() => void guardar()}>{accion.busy ? 'Guardando…' : 'Guardar configuración'}</button>
        {ok && <span className="text-sm text-emerald-700">Guardado ✓</span>}
        <ErrorBox error={accion.error} />
      </div>
    </div>
  );
}

function Cursos({ cursos, onSaved }: { cursos: CursoOrbe[]; onSaved: () => void }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">Active Orbe IA por asignatura y elija las lecciones. Desde cada lección puede generar chistes (con el simulador mientras no active las llamadas reales).</p>
      {cursos.filter((x) => !x.archivada).map((co) => (
        <CursoFila key={co.course_id} co={co} abierto={abierto === co.course_id} onToggle={() => setAbierto(abierto === co.course_id ? null : co.course_id)} onSaved={onSaved} />
      ))}
    </div>
  );
}

function CursoFila({ co, abierto, onToggle, onSaved }: { co: CursoOrbe; abierto: boolean; onToggle: () => void; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(co.enabled);
  const [todas, setTodas] = useState(co.all_lessons);
  const [sel, setSel] = useState<Set<string>>(new Set(co.lessons));
  const lecciones = useAsync(() => (abierto ? orbeLecciones(co.course_id) : Promise.resolve([] as LeccionOrbe[])), [abierto, co.course_id]);
  const accion = useAction();
  const [ok, setOk] = useState(false);
  const cambiado = enabled !== co.enabled || todas !== co.all_lessons || sel.size !== co.lessons.length || co.lessons.some((l) => !sel.has(l));
  async function guardar() {
    setOk(false);
    const r = await accion.run(async () => { await orbeGuardarCurso(co.course_id, enabled, todas, [...sel]); return true; });
    if (r) { setOk(true); onSaved(); }
  }
  return (
    <Card title={<span>{co.titulo} {co.enabled ? <Badge tone="green">activo</Badge> : <Badge>inactivo</Badge>}</span>}
      actions={<button className="btn-secundario !py-1 text-xs" onClick={onToggle}>{abierto ? 'Cerrar' : 'Lecciones y chistes'}</button>}>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Orbe IA en esta asignatura</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> En todas sus lecciones</label>
        <span className="text-xs text-gray-500">{co.aprobados} aprobados · {co.pendientes} por revisar</span>
        {cambiado && <button className="btn-primario !py-1 text-xs" disabled={accion.busy} onClick={() => void guardar()}>Guardar</button>}
        {ok && !cambiado && <span className="text-xs text-emerald-700">Guardado ✓</span>}
      </div>
      <ErrorBox error={accion.error} />
      {abierto && (lecciones.loading ? <Spinner /> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Activa</th><th>Lección</th><th className="text-right">Chistes</th><th>Generar</th></tr></thead>
            <tbody>{(lecciones.data ?? []).map((l) => (
              <tr key={l.lesson_id} className="border-b border-gray-100 align-top dark:border-white/5">
                <td className="py-1.5"><input type="checkbox" disabled={todas} checked={todas || sel.has(l.lesson_id)}
                  onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(l.lesson_id); else n.delete(l.lesson_id); return n; })} /></td>
                <td>{l.titulo} {l.oculta && <Badge>oculta</Badge>}<span className="block text-xs text-gray-500">{l.unidad}</span></td>
                <td className="text-right text-xs tabular-nums">{l.aprobados} ✓ · {l.pendientes} ⏳</td>
                <td><Generador leccion={l} onDone={() => { void lecciones.reload(); onSaved(); }} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}
    </Card>
  );
}

function Generador({ leccion, onDone }: { leccion: LeccionOrbe; onDone: () => void }) {
  const [seccion, setSeccion] = useState('');
  const [apartado, setApartado] = useState('');
  const accion = useAction();
  const [res, setRes] = useState<ResultadoGeneracion | null>(null);
  async function generar() {
    setRes(null);
    const evento = seccion.startsWith('evento:') ? (seccion.slice(7) as 'ejercicio_correcto') : null;
    const r = await accion.run(() => orbeGenerar(leccion.lesson_id, evento ? null : seccion || null, !evento && seccion === 'teoria' ? apartado || null : null, evento));
    if (r) { setRes(r); onDone(); }
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <select className="campo !w-auto !py-1 text-xs" value={seccion} onChange={(e) => { setSeccion(e.target.value); setApartado(''); }}>
        <option value="">Toda la lección</option>
        {SECCIONES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        {EVENTOS.map(([k, v]) => <option key={k} value={`evento:${k}`}>Evento: {v}</option>)}
      </select>
      {seccion === 'teoria' && leccion.apartados.length > 0 && (
        <select className="campo !w-auto !py-1 text-xs" value={apartado} onChange={(e) => setApartado(e.target.value)}>
          <option value="">Toda la teoría</option>
          {leccion.apartados.map((a) => <option key={a} value={a}>{a.slice(0, 50)}</option>)}
        </select>
      )}
      <button className="btn-secundario !py-1 text-xs" disabled={accion.busy} onClick={() => void generar()}>{accion.busy ? 'Generando…' : 'Generar'}</button>
      {res && <span className={`w-full text-xs ${res.ok ? 'text-emerald-700' : 'text-red-600'}`}>
        {res.ok ? `${res.generados} nuevos${res.simulado ? ' (simulados)' : ''}${res.rechazados ? ` · ${res.rechazados} descartados` : ''}${res.aprobados ? ' · publicados' : ' · por revisar'}` : MOTIVOS[res.motivo ?? ''] ?? res.motivo}
      </span>}
      <ErrorBox error={accion.error} />
    </div>
  );
}

function Chistes({ cursos, onChange }: { cursos: CursoOrbe[]; onChange: () => void }) {
  const visibles = cursos.filter((x) => !x.archivada);
  const [curso, setCurso] = useState(visibles.find((x) => x.pendientes > 0)?.course_id ?? visibles[0]?.course_id ?? '');
  const [leccion, setLeccion] = useState('');
  const [estado, setEstado] = useState('pendiente');
  const lecciones = useAsync(() => (curso ? orbeLecciones(curso) : Promise.resolve([] as LeccionOrbe[])), [curso]);
  const lista = useAsync(() => (curso ? orbeChistes(curso, leccion || null, estado || null) : Promise.resolve([] as ChisteOrbe[])), [curso, leccion, estado]);
  const accion = useAction();
  const [nuevo, setNuevo] = useState('');
  const recargar = () => { void lista.reload(); void lecciones.reload(); onChange(); };
  async function actuar(j: ChisteOrbe, a: 'aprobado' | 'pendiente' | 'eliminado') {
    if (a === 'eliminado' && !window.confirm('¿Eliminar este chiste? Deja de mostrarse.')) return;
    await accion.run(() => orbeAccionChiste(j.id, a));
    recargar();
  }
  const pendientes = (lista.data ?? []).filter((j) => j.status === 'pendiente');
  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Asignatura
            <select className="campo mt-1" value={curso} onChange={(e) => { setCurso(e.target.value); setLeccion(''); }}>
              {visibles.map((x) => <option key={x.course_id} value={x.course_id}>{x.titulo}</option>)}
            </select>
          </label>
          <label className="text-sm">Lección
            <select className="campo mt-1" value={leccion} onChange={(e) => setLeccion(e.target.value)}>
              <option value="">Todas</option>
              {(lecciones.data ?? []).map((l) => <option key={l.lesson_id} value={l.lesson_id}>{l.titulo}</option>)}
            </select>
          </label>
          <label className="text-sm">Estado
            <select className="campo mt-1" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="pendiente">Por revisar</option><option value="aprobado">Aprobados</option><option value="eliminado">Eliminados</option><option value="">Todos (salvo eliminados)</option>
            </select>
          </label>
        </div>
        {pendientes.length > 1 && (
          <button className="btn-secundario mt-3 text-sm" disabled={accion.busy} onClick={() => void accion.run(async () => { for (const j of pendientes) await orbeAccionChiste(j.id, 'aprobado'); recargar(); })}>
            Aprobar los {pendientes.length} que se ven
          </button>
        )}
        <ErrorBox error={accion.error || lista.error} />
      </Card>
      {leccion && (
        <Card title="Escribir un chiste propio para esta lección">
          <textarea className="campo" rows={2} maxLength={300} value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Queda aprobado directamente." />
          <button className="btn-secundario mt-2 text-sm" disabled={accion.busy || nuevo.trim().length < 10}
            onClick={() => void accion.run(async () => { await orbeAgregarChiste(leccion, null, nuevo); setNuevo(''); recargar(); })}>Añadir</button>
        </Card>
      )}
      {lista.loading ? <Spinner /> : !(lista.data ?? []).length ? <p className="text-sm text-gray-500">No hay chistes con este filtro.</p> : (
        <div className="space-y-2">{lista.data!.map((j) => <FilaChiste key={j.id} j={j} ocupado={accion.busy} onAccion={(a) => void actuar(j, a)} onEditado={recargar} />)}</div>
      )}
    </div>
  );
}

function FilaChiste({ j, ocupado, onAccion, onEditado }: { j: ChisteOrbe; ocupado: boolean; onAccion: (a: 'aprobado' | 'pendiente' | 'eliminado') => void; onEditado: () => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(j.text);
  const guardar = useAction();
  const donde = [j.leccion, nombreSeccion(j.section), j.apartado, nombreEvento(j.evento) && `evento: ${nombreEvento(j.evento)}`].filter(Boolean).join(' · ');
  return (
    <div className="tarjeta !p-3">
      {editando ? (
        <>
          <textarea className="campo" rows={2} maxLength={300} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className="btn-primario !py-1 text-xs" disabled={guardar.busy || texto.trim().length < 10}
              onClick={() => void guardar.run(async () => { await orbeAccionChiste(j.id, 'editar', texto); setEditando(false); onEditado(); })}>Guardar</button>
            <button className="btn-secundario !py-1 text-xs" onClick={() => { setTexto(j.text); setEditando(false); }}>Cancelar</button>
          </div>
          <ErrorBox error={guardar.error} />
        </>
      ) : <p className="text-sm">{j.text}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <Badge tone={j.status === 'aprobado' ? 'green' : j.status === 'pendiente' ? 'amber' : 'gray'}>{j.status === 'pendiente' ? 'por revisar' : j.status}</Badge>
        <Badge tone={j.origin === 'simulador' ? 'gray' : j.origin === 'profesor' ? 'blue' : 'purple'}>{j.origin === 'ia' ? (j.model ?? 'IA') : j.origin}</Badge>
        {j.edited && <span>editado</span>}
        <span>{donde}</span>
        <span>· mostrado {j.times_shown} {j.times_shown === 1 ? 'vez' : 'veces'} · {fecha(j.created_at)}</span>
        <span className="ml-auto flex gap-1">
          {j.status !== 'aprobado' && <button className="btn-primario !px-2 !py-0.5 text-xs" disabled={ocupado} onClick={() => onAccion('aprobado')}>Aprobar</button>}
          {j.status === 'aprobado' && <button className="btn-secundario !px-2 !py-0.5 text-xs" disabled={ocupado} onClick={() => onAccion('pendiente')}>Retirar</button>}
          {!editando && <button className="btn-secundario !px-2 !py-0.5 text-xs" onClick={() => setEditando(true)}>Editar</button>}
          {j.status !== 'eliminado' && <button className="btn-secundario !px-2 !py-0.5 text-xs text-red-700" disabled={ocupado} onClick={() => onAccion('eliminado')}>Eliminar</button>}
        </span>
      </div>
    </div>
  );
}

function Dato({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) {
  return <div className="tarjeta !p-3"><p className="text-xs text-gray-500">{k}</p><p className="font-serif text-xl font-semibold tabular-nums">{v}</p>{sub && <p className="text-xs text-gray-500">{sub}</p>}</div>;
}

function Consumo({ p }: { p: PanelOrbe }) {
  const e = p.estadisticas;
  const c = p.config;
  const pct = c.monthly_budget_usd > 0 ? Math.min(100, Math.round((100 * e.gasto_mes_usd) / c.monthly_budget_usd)) : 0;
  const totales = useMemo(() => p.consumo.reduce((s, x) => ({ ent: s.ent + x.input_tokens, sal: s.sal + x.output_tokens }), { ent: 0, sal: 0 }), [p.consumo]);
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Dato k="Gasto este mes" v={usd(e.gasto_mes_usd)} sub={`${pct} % de ${usd(c.monthly_budget_usd)}`} />
        <Dato k="Llamadas hoy" v={`${e.llamadas_hoy}/${c.daily_max_calls}`} sub="incluye las simuladas" />
        <Dato k="Llamadas reales (mes)" v={e.llamadas_reales_mes} sub={`${e.errores_mes} con error`} />
        <Dato k="Tokens (mes, reales)" v={(e.tokens_mes.entrada + e.tokens_mes.salida).toLocaleString('es-DO')} sub={`${e.tokens_mes.entrada.toLocaleString('es-DO')} entrada · ${e.tokens_mes.salida.toLocaleString('es-DO')} salida`} />
        <Dato k="Chistes" v={(e.chistes.aprobado ?? 0) + (e.chistes.pendiente ?? 0)} sub={`${e.chistes.aprobado ?? 0} aprobados · ${e.chistes.pendiente ?? 0} por revisar · ${e.chistes.eliminado ?? 0} eliminados`} />
        <Dato k="Mostrados" v={e.mostrados} sub={`${e.mostrados_7d} en 7 días · ${e.estudiantes_alcanzados} estudiantes`} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Dato k="Cerrados en menos de 3 s" v={e.cerrados_al_instante} sub="señal de que molestan" />
        <Dato k="«No mostrar más»" v={e.no_mostrar_mas} />
        <Dato k="Estudiantes que los desactivaron" v={e.estudiantes_desactivados} />
      </div>
      <Card title={`Últimas llamadas · ${p.consumo.length}`}>
        {!p.consumo.length ? <p className="text-sm text-gray-500">Aún no se ha generado nada.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Fecha</th><th>Origen</th><th>Lección</th><th>Modelo</th><th>Estado</th><th className="text-right">Tokens (ent. / sal.)</th><th className="text-right">Coste</th><th className="text-right">Chistes</th></tr></thead>
              <tbody>{p.consumo.map((x) => (
                <tr key={x.id} className="border-b border-gray-100 dark:border-white/5">
                  <td className="whitespace-nowrap py-1 text-xs">{fecha(x.created_at)}</td>
                  <td className="text-xs">{x.trigger === 'profesor' ? 'profesor' : 'automática'}</td>
                  <td className="text-xs">{x.leccion ?? '—'}{(x.section || x.evento) && <span className="block text-gray-500">{[nombreSeccion(x.section), x.apartado, nombreEvento(x.evento)].filter(Boolean).join(' · ')}</span>}</td>
                  <td className="text-xs">{x.simulated ? <Badge>simulador</Badge> : x.model}</td>
                  <td className="text-xs">{x.status === 'ok' ? <Badge tone="green">ok</Badge> : x.status === 'error' ? <Badge tone="red">{MOTIVOS[x.error_code ?? ''] ?? x.error_code}</Badge> : <Badge tone="amber">en curso</Badge>}</td>
                  <td className="text-right text-xs tabular-nums">{x.input_tokens} / {x.output_tokens}</td>
                  <td className="text-right text-xs tabular-nums">{usd(x.cost_usd)}</td>
                  <td className="text-right text-xs tabular-nums">{x.jokes_generated}{x.jokes_rejected ? ` (−${x.jokes_rejected})` : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">Tokens de estas filas: {totales.ent.toLocaleString('es-DO')} de entrada y {totales.sal.toLocaleString('es-DO')} de salida. El coste se calcula con los precios configurados (US$ por millón de tokens); el valor exacto lo da la facturación de Anthropic.</p>
      </Card>
    </div>
  );
}
