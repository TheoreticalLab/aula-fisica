/**
 * Configurador del Maratón adaptativo (Panel docente → sección → Maratón adaptativo → Configurar).
 * Pestañas: Configuración (identificación, programación, carga, dificultad, comodines, informes, seguridad),
 * Contenido (banco y temas), Revisión y publicación, Informe. El servidor valida y decide; aquí solo se edita.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  maratonBancos, maratonCambiarEstado, maratonDetalle, maratonDuplicar, maratonGuardar, maratonMuestra, maratonPlantillas, maratonReiniciarPrueba,
  maratonRevisarPlantilla, type DatosMaraton, type MaratonDocente, type MuestraVariante, type PlantillaBanco,
} from '@/api/maraton';
import { classTeachers, listGroups, listMyTeachingClasses } from '@/api/docente';
import { useAuth } from '@/auth/AuthContext';
import { combinar, describirFinalizacion, erroresConfig, etiquetaNivel, NOMBRE_NIVEL, type ConfigMaraton } from '@/lib/maraton/config';
import { fecha, useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Modal, Notice, PageTitle, Spinner, Tabs } from '@/components/ui';
import { EditorMarkdown } from '@/components/EditorMarkdown';
import { Markdown } from '@/components/Markdown';
import { ESTADO_MARATON, faseTexto } from './MaratonTab';
import { TABLA } from './PesTab';
import { MaratonInforme } from './MaratonInforme';

type Pestana = 'config' | 'contenido' | 'publicacion' | 'informe';

export default function MaratonEditor() {
  const { maratonId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('t') as Pestana) || 'config';
  const st = useAsync(() => maratonDetalle(maratonId), [maratonId]);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const m = st.data!;
  const est = ESTADO_MARATON[m.estado];
  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24">
      <PageTitle title={m.titulo} subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={est.tono}>{est.t}</Badge>{m.seccion} · {faseTexto({ hoy: m.hoy, jornadas: m.config.programacion.jornadas })} · {m.participantes} participante(s)</span>}
        back={{ to: `/docente/clases/${m.class_id}?t=maraton`, label: m.seccion }} />
      {m.estado === 'borrador' && <Notice tone="warn"><strong>BORRADOR:</strong> ningún estudiante puede verlo ni acceder. Se publica en «Revisión y publicación».</Notice>}
      <Tabs<Pestana> value={tab} onChange={(t) => setParams({ t })} tabs={[
        { id: 'config', label: 'Configuración' }, { id: 'contenido', label: 'Contenido' },
        { id: 'publicacion', label: 'Revisión y publicación' }, { id: 'informe', label: 'Informe' },
      ]} />
      {tab === 'config' && <Configuracion m={m} onGuardado={st.setData} />}
      {tab === 'contenido' && <Contenido m={m} onGuardado={st.setData} />}
      {tab === 'publicacion' && <Publicacion m={m} onCambio={st.setData} />}
      {tab === 'informe' && <MaratonInforme m={m} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
function Num({ label, value, onChange, min, max, step = 1, disabled, hint }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; disabled?: boolean; hint?: string }) {
  return (
    <label className="block"><span className="etiqueta">{label}</span>
      <input type="number" className="campo" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step} disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}
function Check({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" checked={value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

function Configuracion({ m, onGuardado }: { m: MaratonDocente; onGuardado: (x: MaratonDocente) => void }) {
  const { profile } = useAuth();
  const [titulo, setTitulo] = useState(m.titulo);
  const [descripcion, setDescripcion] = useState(m.descripcion);
  const [instrucciones, setInstrucciones] = useState(m.instrucciones);
  const [fechaInicio, setFechaInicio] = useState(m.fecha_inicio ?? '');
  const [responsable, setResponsable] = useState(m.responsable ?? '');
  const [grupo, setGrupo] = useState(m.group_id ?? '');
  const [c, setC] = useState<ConfigMaraton>(() => combinar(m.config));
  const [calendarioTxt, setCalendarioTxt] = useState(c.programacion.calendario.join('\n'));
  const docentes = useAsync(() => classTeachers(m.class_id), [m.class_id]);
  const grupos = useAsync(() => listGroups(m.class_id), [m.class_id]);
  const act = useAction();
  const [ok, setOk] = useState(false);
  const bloqueado = m.participantes > 0;
  const set = <K extends keyof ConfigMaraton>(k: K, p: Partial<ConfigMaraton[K]>) => setC((x) => ({ ...x, [k]: { ...x[k], ...p } }));
  const errores = useMemo(() => erroresConfig(c), [c]);
  useEffect(() => { set('programacion', { calendario: calendarioTxt.split(/\s+/).filter(Boolean) }); }, [calendarioTxt]);

  async function guardar() {
    setOk(false);
    const datos: DatosMaraton = bloqueado
      ? { titulo, descripcion, instrucciones, informes: c.informes }
      : { titulo, descripcion, instrucciones, fecha_inicio: fechaInicio || null, responsable: responsable || null, group_id: grupo || null, config: c };
    const r = await act.run(() => maratonGuardar(m.id, datos));
    if (r) { onGuardado(r); setOk(true); }
  }
  const p = c.programacion, k = c.carga, d = c.dificultad, w = c.comodines;
  return (
    <div className="space-y-4">
      {bloqueado && <Notice tone="warn">El maratón ya tiene participantes: para no cambiar las reglas a mitad del recorrido solo se pueden editar los textos y los informes.</Notice>}
      <Card title="Identificación">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="etiqueta">Nombre del maratón</span><input className="campo" value={titulo} maxLength={160} onChange={(e) => setTitulo(e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className="etiqueta">Descripción</span><textarea className="campo" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></label>
          <div className="text-sm"><span className="etiqueta">Asignatura y sección</span>{m.seccion} <span className="text-xs text-gray-500">(banco «{m.banco?.nombre ?? m.banco_id}»)</span></div>
          <div className="text-sm"><span className="etiqueta">Estado</span><Badge tone={ESTADO_MARATON[m.estado].tono}>{ESTADO_MARATON[m.estado].t}</Badge></div>
          <label className="block"><span className="etiqueta">Profesor responsable</span>
            <select className="campo" value={responsable} disabled={bloqueado} onChange={(e) => setResponsable(e.target.value)}>
              <option value="">—</option>
              {(docentes.data ?? []).map((t) => <option key={t.user_id} value={t.user_id}>{t.profiles?.full_name ?? t.user_id}{t.user_id === profile?.id ? ' (usted)' : ''}</option>)}
            </select></label>
          <label className="block"><span className="etiqueta">Grupo de la sección (opcional)</span>
            <select className="campo" value={grupo} disabled={bloqueado} onChange={(e) => setGrupo(e.target.value)}>
              <option value="">Toda la sección</option>
              {(grupos.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select></label>
        </div>
        <div className="mt-3"><EditorMarkdown label="Instrucciones para estudiantes (se muestran antes de comenzar)" value={instrucciones} onChange={setInstrucciones} rows={12} /></div>
        <p className="mt-1 text-xs text-gray-500">Deben explicar: duración, continuidad, dificultad adaptativa, cantidad variable de ejercicios, comodines, consecuencias de abandonar o cambiar,
          duración orientativa, incidencias técnicas, que el sistema genera informes y no notas, y los criterios generales de la recuperación. Un apartado «[PENDIENTE…]» impide publicar.</p>
      </Card>

      <Card title="Programación">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="etiqueta">Fecha de inicio</span><input type="date" className="campo" value={fechaInicio} disabled={bloqueado} onChange={(e) => setFechaInicio(e.target.value)} />
            {!fechaInicio && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">Pendiente de configuración docente.</span>}</label>
          <label className="block"><span className="etiqueta">Hora de inicio (jornada 1)</span><input type="time" className="campo" value={p.hora_inicio} disabled={bloqueado} onChange={(e) => set('programacion', { hora_inicio: e.target.value })} /></label>
          <Num label="Número de jornadas" value={p.jornadas} min={1} max={60} disabled={bloqueado} onChange={(v) => set('programacion', { jornadas: v })} />
          <label className="block"><span className="etiqueta">Calendario</span>
            <select className="campo" value={p.modo} disabled={bloqueado} onChange={(e) => set('programacion', { modo: e.target.value as ConfigMaraton['programacion']['modo'] })}>
              <option value="consecutivas">Jornadas consecutivas</option><option value="calendario">Calendario personalizado</option></select></label>
          <label className="block"><span className="etiqueta">Apertura diaria</span><input type="time" className="campo" value={p.apertura} disabled={bloqueado} onChange={(e) => set('programacion', { apertura: e.target.value })} /></label>
          <label className="block"><span className="etiqueta">Hora límite diaria</span><input type="time" className="campo" value={p.cierre} disabled={bloqueado} onChange={(e) => set('programacion', { cierre: e.target.value })} /></label>
          <label className="block"><span className="etiqueta">Zona horaria</span><input className="campo" value={p.zona} disabled={bloqueado} onChange={(e) => set('programacion', { zona: e.target.value })} /></label>
          {p.modo === 'calendario' && (
            <label className="block sm:col-span-2"><span className="etiqueta">Fechas (una por jornada, AAAA-MM-DD)</span>
              <textarea className="campo font-mono text-sm" rows={4} value={calendarioTxt} disabled={bloqueado} onChange={(e) => setCalendarioTxt(e.target.value)} /></label>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">Las fechas y horas se calculan en el servidor con la zona indicada. Margen de gracia para envíos en curso al cerrar: {c.seguridad.gracia_s} s.</p>
      </Card>

      <Card title="Carga académica por jornada">
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="Cuota diaria (unidades de trabajo)" value={k.cuota} step={0.1} disabled={bloqueado} onChange={(v) => set('carga', { cuota: v })} hint="Interna: el estudiante no la ve." />
          <Num label="Tiempo objetivo mínimo (min)" value={k.objetivo_min} disabled={bloqueado} onChange={(v) => set('carga', { objetivo_min: v })} />
          <Num label="Tiempo objetivo máximo (min)" value={k.objetivo_max} disabled={bloqueado} onChange={(v) => set('carga', { objetivo_max: v })} />
          <div className="sm:col-span-3"><Check label="Finalización alternativa (tiempo efectivo + intentos válidos)" value={k.alternativa_activa} disabled={bloqueado} onChange={(v) => set('carga', { alternativa_activa: v })} /></div>
          <Num label="Tiempo mínimo de jornada para la vía alternativa (min)" value={k.alternativa_minutos} disabled={bloqueado || !k.alternativa_activa} onChange={(v) => set('carga', { alternativa_minutos: v })} />
          <Num label="Mínimo de intentos válidos (vía alternativa)" value={k.alternativa_intentos} disabled={bloqueado || !k.alternativa_activa} onChange={(v) => set('carga', { alternativa_intentos: v })} />
          <Num label="Límite máximo de la jornada (min)" value={k.limite_minutos} disabled={bloqueado} onChange={(v) => set('carga', { limite_minutos: v })} />
          <Num label="Máximo de intentos válidos" value={k.intentos_max} disabled={bloqueado} onChange={(v) => set('carga', { intentos_max: v })} />
          <Num label="Máximo de problemas presentados" value={k.presentados_max} disabled={bloqueado} onChange={(v) => set('carga', { presentados_max: v })} />
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{describirFinalizacion(c)}</p>
      </Card>

      <Card title="Dificultad">
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="Número de niveles" value={d.niveles} min={2} max={6} disabled={bloqueado} onChange={(v) => set('dificultad', { niveles: v })} />
          <label className="block"><span className="etiqueta">Nivel inicial</span>
            <select className="campo" value={d.nivel_inicial} disabled={bloqueado} onChange={(e) => set('dificultad', { nivel_inicial: Number(e.target.value) })}>
              {Array.from({ length: d.niveles }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{etiquetaNivel(n)}</option>)}</select></label>
          <div className="pt-6"><Check label="Adaptación activa" value={d.adaptativa} disabled={bloqueado} onChange={(v) => set('dificultad', { adaptativa: v })} /></div>
          <Num label="Ascenso al acertar (niveles)" value={d.ascenso} min={0} max={3} disabled={bloqueado} onChange={(v) => set('dificultad', { ascenso: v })} />
          <Num label="Descenso al fallar (niveles)" value={d.descenso} min={0} max={3} disabled={bloqueado} onChange={(v) => set('dificultad', { descenso: v })} />
          <Num label="Descenso con «No puedo» (niveles)" value={d.descenso_no_puedo} min={0} max={3} disabled={bloqueado} onChange={(v) => set('dificultad', { descenso_no_puedo: v })} />
          <label className="block"><span className="etiqueta">Nivel al empezar cada jornada</span>
            <select className="campo" value={d.nivel_al_iniciar_jornada} disabled={bloqueado} onChange={(e) => set('dificultad', { nivel_al_iniciar_jornada: e.target.value as 'continuar' | 'inicial' })}>
              <option value="continuar">Continúa donde terminó</option><option value="inicial">Vuelve al nivel inicial</option></select></label>
          <Num label="Factor de tiempo mínimo por problema" value={d.t_min_factor} step={0.05} min={0.25} max={4} disabled={bloqueado} onChange={(v) => set('dificultad', { t_min_factor: v })} hint="1 = tiempos calibrados del banco." />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className={TABLA}>
            <thead><tr><th>Nivel</th>{[1, 2, 3, 4, 5, 6].map((n) => <th key={n}>D{n}</th>)}</tr></thead>
            <tbody>
              <tr><td className="text-xs text-gray-500">Nombre interno</td>{[1, 2, 3, 4, 5, 6].map((n) => <td key={n} className="text-xs">{NOMBRE_NIVEL[n]}</td>)}</tr>
              <tr><td className="text-xs text-gray-500">Unidades</td>{d.pesos.map((x, i) => (
                <td key={i}><input type="number" step={0.05} className="campo w-20" value={x} disabled={bloqueado}
                  onChange={(e) => set('dificultad', { pesos: d.pesos.map((y, j) => (j === i ? Number(e.target.value) : y)) })} /></td>))}</tr>
              <tr><td className="text-xs text-gray-500">T. mínimo (s, opcional)</td>{[0, 1, 2, 3, 4, 5].map((i) => (
                <td key={i}><input type="number" className="campo w-20" placeholder="banco" value={d.t_min_nivel_s?.[i] ?? ''} disabled={bloqueado}
                  onChange={(e) => { const xs = [...(d.t_min_nivel_s ?? [null, null, null, null, null, null])]; xs[i] = e.target.value === '' ? null : Number(e.target.value); set('dificultad', { t_min_nivel_s: xs.every((x) => x === null) ? null : xs }); }} /></td>))}</tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Regla: acierto → sube; fallo → baja; «No puedo» → baja; cambio de ejercicio → mismo nivel. En el nivel máximo permanece mientras acierte.
          D5 y D6 valen 1 unidad para que los problemas extremos no acorten la jornada; la vía alternativa evita que un estudiante excepcional quede atrapado. No hay límite de permanencia en D6 (contradiría la regla de no descender por acertar).</p>
      </Card>

      <Card title="Comodines">
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="Sustituciones en todo el maratón" value={w.total} min={0} max={100} disabled={bloqueado} onChange={(v) => set('comodines', { total: v })} />
          <label className="block"><span className="etiqueta">Límite por jornada (opcional)</span>
            <input type="number" className="campo" min={0} max={100} value={w.por_jornada ?? ''} disabled={bloqueado} placeholder="sin límite"
              onChange={(e) => set('comodines', { por_jornada: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <div className="pt-6"><Check label="Permitir «No puedo resolverlo»" value={w.no_puedo} disabled={bloqueado} onChange={(v) => set('comodines', { no_puedo: v })} /></div>
        </div>
        <p className="mt-2 text-xs text-gray-500">Cambiar ejercicio: consume un comodín de forma atómica, mantiene el nivel, no da unidades y el problema retirado no vuelve.</p>
      </Card>

      <Card title="Informes">
        <div className="grid gap-3 sm:grid-cols-3">
          <Check label="Informe del estudiante" value={c.informes.estudiante} onChange={(v) => set('informes', { estudiante: v })} />
          <Check label="Informe docente" value={c.informes.docente} onChange={(v) => set('informes', { docente: v })} />
          <Check label="Indicadores descriptivos de consistencia" value={c.informes.indicadores} onChange={(v) => set('informes', { indicadores: v })} />
          <label className="block"><span className="etiqueta">Publicación del informe del estudiante</span>
            <input type="date" className="campo" value={c.informes.publicacion_estudiante ?? ''} onChange={(e) => set('informes', { publicacion_estudiante: e.target.value || null })} />
            <span className="mt-1 block text-xs text-gray-500">Vacío: al terminar la última jornada.</span></label>
          <div className="sm:col-span-2"><span className="etiqueta">Exportaciones</span>
            <div className="flex flex-wrap gap-4">{['pdf', 'csv', 'xlsx'].map((x) => (
              <Check key={x} label={x.toUpperCase()} value={c.informes.exportaciones.includes(x)}
                onChange={(v) => set('informes', { exportaciones: v ? [...new Set([...c.informes.exportaciones, x])] : c.informes.exportaciones.filter((y) => y !== x) })} />))}</div></div>
        </div>
      </Card>

      <Card title="Seguridad y privacidad">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="etiqueta">Retroalimentación al responder</span>
            <select className="campo" value={c.seguridad.retroalimentacion} disabled={bloqueado} onChange={(e) => set('seguridad', { retroalimentacion: e.target.value as 'ninguna' | 'correcto_incorrecto' })}>
              <option value="ninguna">Ninguna (recomendado)</option><option value="correcto_incorrecto">Indicar si fue correcta</option></select></label>
          <Num label="Margen de gracia al cerrar (s)" value={c.seguridad.gracia_s} min={0} max={600} disabled={bloqueado} onChange={(v) => set('seguridad', { gracia_s: v })} />
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-400">
          <li>Acceso: solo estudiantes matriculados en la sección (o el grupo elegido) y solo cuando está publicado. El profesor puede probarlo en modo prueba.</li>
          <li>Persistencia y reanudación: cada problema y cada decisión se guardan en el servidor; al volver se recupera el mismo problema.</li>
          <li>Duplicaciones: cada acción lleva una clave única y se procesa bajo bloqueo; repetir una solicitud no cuenta dos veces.</li>
          <li>Respuestas, soluciones, niveles, ponderaciones y unidades nunca llegan al navegador del estudiante.</li>
          <li>Incidencias: reaperturas y justificaciones quedan registradas con autor, motivo y fecha.</li>
          <li>Privacidad: cada estudiante solo puede ver su propio informe; el informe docente es exclusivo del profesorado de la sección.</li>
        </ul>
      </Card>

      {errores.length > 0 && <ErrorBox error={errores.join(' ')} />}
      <ErrorBox error={act.error} />
      {ok && <Notice tone="ok">Cambios guardados.</Notice>}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-primario-950/95">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <span className="flex-1 text-xs text-gray-500">Guardar no publica: el maratón sigue en su estado actual.</span>
          <button className="btn-primario min-h-[44px]" disabled={act.busy || errores.length > 0 || !titulo.trim()} onClick={() => void guardar()}>{act.busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contenido académico
// ---------------------------------------------------------------------------
const COBERTURA: Record<string, 'green' | 'blue' | 'amber' | 'gray'> = { alta: 'green', media: 'blue', baja: 'amber', sin_evidencia: 'gray' };
const ESTADO_PLANTILLA: Record<PlantillaBanco['estado'], { t: string; tono: 'green' | 'amber' | 'red' }> = {
  validada: { t: 'Validada', tono: 'green' }, pendiente_revision: { t: 'Pendiente de revisión', tono: 'amber' }, rechazada: { t: 'Rechazada', tono: 'red' },
};

function Contenido({ m, onGuardado }: { m: MaratonDocente; onGuardado: (x: MaratonDocente) => void }) {
  const bancos = useAsync(() => maratonBancos(m.class_id), [m.class_id]);
  const plantillas = useAsync(() => maratonPlantillas(m.banco_id), [m.banco_id]);
  const c = combinar(m.config);
  const banco = bancos.data?.find((b) => b.id === m.banco_id);
  const verificados = banco?.temas.filter((t) => t.estado === 'verificado').map((t) => t.codigo) ?? [];
  const [temas, setTemas] = useState<string[] | null>(c.contenido.temas);
  const [excluir, setExcluir] = useState<string[]>(c.contenido.excluir_plantillas);
  const [muestra, setMuestra] = useState<PlantillaBanco | null>(null);
  const [filtro, setFiltro] = useState('');
  const act = useAction();
  const bloqueado = m.participantes > 0;
  const sel = temas ?? verificados;
  if (bancos.loading || plantillas.loading) return <Spinner />;
  if (bancos.error) return <ErrorBox error={bancos.error} onRetry={bancos.reload} />;
  async function guardar() {
    const r = await act.run(() => maratonGuardar(m.id, { config: { contenido: { temas, excluir_plantillas: excluir } } }));
    if (r) onGuardado(r);
  }
  const pls = (plantillas.data ?? []).filter((p) => !filtro || p.tema === filtro);
  return (
    <div className="space-y-4">
      <Card title={`Banco: ${banco?.nombre ?? m.banco_id}`}>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{banco?.descripcion}</p>
        <p className="mb-2 text-xs text-gray-500">Matriz de cobertura: solo los temas con evidencia de haberse impartido están verificados. Los pendientes requieren revisión docente; los excluidos no tienen problemas.</p>
        <div className="overflow-x-auto">
          <table className={TABLA}>
            <thead><tr><th>Usar</th><th>Tema</th><th>Unidad</th><th>Fuente académica</th><th>Prácticas</th><th>Exámenes</th><th>Cobertura</th><th>Validadas por nivel</th></tr></thead>
            <tbody>
              {(banco?.temas ?? []).map((t) => (
                <tr key={t.codigo}>
                  <td><input type="checkbox" disabled={bloqueado || t.estado === 'excluido'} checked={sel.includes(t.codigo)}
                    onChange={(e) => setTemas(e.target.checked ? [...new Set([...sel, t.codigo])] : sel.filter((x) => x !== t.codigo))} /></td>
                  <td><button className="enlace text-left" onClick={() => setFiltro(t.codigo)}>{t.nombre}</button><br /><Badge tone={t.estado === 'verificado' ? 'green' : t.estado === 'pendiente' ? 'amber' : 'gray'}>{t.estado}</Badge></td>
                  <td className="text-xs">{t.unidad}</td><td className="text-xs">{t.fuente}</td><td className="text-xs">{t.practicas}</td><td className="text-xs">{t.examenes}</td>
                  <td><Badge tone={COBERTURA[t.cobertura]}>{t.cobertura.replace('_', ' ')}</Badge></td>
                  <td className="whitespace-nowrap text-xs">{[1, 2, 3, 4, 5, 6].map((n) => `D${n}:${t.por_nivel[n]?.variantes ?? 0}`).join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-primario min-h-[40px]" disabled={act.busy || bloqueado} onClick={() => void guardar()}>Guardar selección</button>
          <button className="btn-secundario min-h-[40px]" disabled={bloqueado} onClick={() => setTemas(null)}>Usar todos los verificados</button>
          <span className="text-xs text-gray-500">Disponibles con la selección guardada: {Object.entries(m.revision.disponibles).map(([n, v]) => `D${n}: ${v}`).join(' · ') || '—'}</span>
        </div>
        <ErrorBox error={act.error} />
      </Card>
      <Card title="Plantillas del banco" actions={filtro ? <button className="btn-texto" onClick={() => setFiltro('')}>Ver todas</button> : undefined}>
        <div className="overflow-x-auto">
          <table className={TABLA}>
            <thead><tr><th>Excluir</th><th>Nivel</th><th>Plantilla</th><th>Tema · subtema</th><th>Tiempos</th><th>Variantes</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {pls.map((p) => (
                <tr key={p.id}>
                  <td><input type="checkbox" disabled={bloqueado} checked={excluir.includes(p.id)} onChange={(e) => setExcluir(e.target.checked ? [...excluir, p.id] : excluir.filter((x) => x !== p.id))} /></td>
                  <td className="whitespace-nowrap">{etiquetaNivel(p.nivel)}</td>
                  <td><span className="font-medium">{p.titulo}</span><br /><span className="text-xs text-gray-500">{p.id}</span></td>
                  <td className="text-xs">{p.tema} · {p.subtema}</td>
                  <td className="text-xs">mín. {Math.round(p.t_min_s / 60 * 10) / 10} min · tope {Math.round(p.t_max_s / 60)} min</td>
                  <td>{p.variantes}</td>
                  <td><Badge tone={ESTADO_PLANTILLA[p.estado].tono}>{ESTADO_PLANTILLA[p.estado].t}</Badge></td>
                  <td><button className="enlace" onClick={() => setMuestra(p)}>Vista previa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Las exclusiones se guardan con «Guardar selección».</p>
      </Card>
      {muestra && <VistaPlantilla p={muestra} onClose={() => setMuestra(null)} onRevisada={() => void plantillas.reload()} />}
    </div>
  );
}

function VistaPlantilla({ p, onClose, onRevisada }: { p: PlantillaBanco; onClose: () => void; onRevisada: () => void }) {
  const st = useAsync(() => maratonMuestra(p.id, 3), [p.id]);
  const [nota, setNota] = useState(p.nota_revision ?? '');
  const act = useAction();
  const revisar = async (estado: PlantillaBanco['estado']) => { const r = await act.run(() => maratonRevisarPlantilla(p.id, estado, nota)); if (r) { onRevisada(); onClose(); } };
  return (
    <Modal open onClose={onClose} title={`${etiquetaNivel(p.nivel)} — ${p.titulo}`}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        <p className="text-xs text-gray-500">Fuente: {p.fuente}. Verificación: {p.metodo}.</p>
        {st.loading ? <Spinner /> : st.error ? <ErrorBox error={st.error} /> : (st.data ?? []).map((v: MuestraVariante) => (
          <div key={v.id} className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
            <div className="mb-1 text-xs text-gray-500">Variante {v.n} · {v.id}</div>
            <Markdown className="prosa text-sm">{v.enunciado}</Markdown>
            <div className="mt-2 text-sm"><strong>Clave:</strong> {v.clave?.partes.map((k, i) => <span key={i} className="mr-2 font-mono">{v.partes[i]?.etiqueta}: {k.value} (±{Math.round((k.relTol ?? 0.02) * 100)} %)</span>)}</div>
            {v.solucion && <details className="mt-1 text-sm"><summary className="cursor-pointer">Solución desarrollada</summary><Markdown className="prosa mt-1 text-sm">{v.solucion}</Markdown></details>}
            {v.verificacion && <div className="mt-1 text-xs text-gray-500">Verificación independiente: {v.verificacion.independiente.map((x) => x.toPrecision(5)).join(' | ')} (desviación máx. {(v.verificacion.desviacion_max * 100).toFixed(3)} %)</div>}
          </div>
        ))}
        <label className="block"><span className="etiqueta">Nota de revisión</span><input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario" disabled={act.busy} onClick={() => void revisar('validada')}>Marcar validada</button>
          <button className="btn-secundario" disabled={act.busy} onClick={() => void revisar('pendiente_revision')}>Pendiente de revisión</button>
          <button className="btn-peligro" disabled={act.busy} onClick={() => void revisar('rechazada')}>Rechazar</button>
        </div>
        <ErrorBox error={act.error} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Revisión y publicación
// ---------------------------------------------------------------------------
function Publicacion({ m, onCambio }: { m: MaratonDocente; onCambio: (x: MaratonDocente) => void }) {
  const { profile } = useAuth();
  const act = useAction();
  const [confirmar, setConfirmar] = useState(false);
  const [destino, setDestino] = useState(m.class_id);
  const [tituloCopia, setTituloCopia] = useState(`${m.titulo} (copia)`);
  const [copia, setCopia] = useState<string | null>(null);
  const secciones = useAsync(() => (profile ? listMyTeachingClasses(profile.id) : Promise.resolve([])), [profile?.id]);
  const r = m.revision;
  const estado = async (e: MaratonDocente['estado']) => { setConfirmar(false); const x = await act.run(() => maratonCambiarEstado(m.id, e)); if (x) onCambio(x); };
  return (
    <div className="space-y-4">
      <Card title="Revisión antes de publicar">
        {r.errores.length === 0 ? <Notice tone="ok">La configuración no tiene errores.</Notice> : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-400">{r.errores.map((x) => <li key={x}>{x}</li>)}</ul>
        )}
        {r.avisos.map((x) => <div key={x} className="mt-2"><Notice tone="warn">{x}</Notice></div>)}
        <p className="mt-3 text-sm">Variantes validadas disponibles por nivel: {Object.entries(r.disponibles).map(([n, v]) => `D${n}: ${v}`).join(' · ')}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{describirFinalizacion(combinar(m.config))}</p>
      </Card>
      <Card title="Probar como estudiante">
        <p className="mb-2 text-sm">El modo prueba recorre el maratón con su cuenta (también en borrador), sin esperar al calendario. No aparece en los informes.</p>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secundario min-h-[40px]" to={`/maraton/${m.id}`}>Abrir en modo prueba</Link>
          <button className="btn-texto" disabled={act.busy} onClick={() => void act.run(() => maratonReiniciarPrueba(m.id))}>Reiniciar mi prueba</button>
        </div>
      </Card>
      <Card title="Estado">
        <p className="mb-3 text-sm">Estado actual: <Badge tone={ESTADO_MARATON[m.estado].tono}>{ESTADO_MARATON[m.estado].t}</Badge>{m.publicado_at ? ` · publicado el ${fecha(m.publicado_at)}` : ''}</p>
        <div className="flex flex-wrap gap-2">
          {m.estado !== 'publicado' && <button className="btn-primario min-h-[44px]" disabled={act.busy || r.errores.length > 0} onClick={() => setConfirmar(true)}>Publicar para los estudiantes…</button>}
          {m.estado === 'publicado' && m.participantes === 0 && <button className="btn-secundario min-h-[44px]" disabled={act.busy} onClick={() => void estado('borrador')}>Volver a borrador</button>}
          {m.estado !== 'archivado' && <button className="btn-secundario min-h-[44px]" disabled={act.busy} onClick={() => void estado('archivado')}>Archivar</button>}
          {m.estado === 'archivado' && m.participantes === 0 && <button className="btn-secundario min-h-[44px]" disabled={act.busy} onClick={() => void estado('borrador')}>Recuperar como borrador</button>}
        </div>
        <p className="mt-2 text-xs text-gray-500">Publicar no envía notificaciones ni crea entradas en el registro de calificaciones. Los estudiantes lo verán en Evaluaciones desde ese momento; podrán empezar cuando se abra la primera jornada.</p>
        <ErrorBox error={act.error} />
      </Card>
      <Card title="Duplicar (otra sección o la misma)">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="etiqueta">Sección de destino</span>
            <select className="campo" value={destino} onChange={(e) => setDestino(e.target.value)}>
              {(secciones.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.archived ? ' (archivada)' : ''}</option>)}</select></label>
          <label className="block sm:col-span-2"><span className="etiqueta">Nombre de la copia</span><input className="campo" value={tituloCopia} onChange={(e) => setTituloCopia(e.target.value)} /></label>
        </div>
        <button className="btn-secundario mt-2 min-h-[40px]" disabled={act.busy} onClick={async () => { const id = await act.run(() => maratonDuplicar(m.id, destino, tituloCopia)); if (id) setCopia(id); }}>Crear copia en borrador</button>
        {copia && <Notice tone="ok">Copia creada (borrador, sin fecha, sin participantes). <Link className="enlace" to={`/docente/maraton/${copia}`}>Abrirla</Link></Notice>}
        <p className="mt-2 text-xs text-gray-500">La copia es una instancia nueva con la misma configuración: no comparte respuestas ni estadísticas. Solo se puede copiar a secciones de una asignatura que use el mismo banco.</p>
      </Card>
      <Modal open={confirmar} onClose={() => setConfirmar(false)} title="¿Publicar el maratón?">
        <p className="text-sm">Desde ahora los estudiantes de <strong>{m.seccion}</strong> lo verán en Evaluaciones y podrán empezar el {m.fecha_inicio} a las {combinar(m.config).programacion.hora_inicio}.
          Cuando haya participantes, las reglas ya no se podrán cambiar.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
          <button className="btn-primario" disabled={act.busy} onClick={() => void estado('publicado')}>Publicar</button>
        </div>
      </Modal>
    </div>
  );
}
