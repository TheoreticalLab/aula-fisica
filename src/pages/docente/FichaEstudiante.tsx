/**
 * Ficha completa del estudiante (profesorado). Todo viene de student_dossier (una consulta auditada): perfil,
 * accesos, sesiones de estudio, actividades intentadas y no intentadas, respuestas y errores, calificaciones
 * oficiales, comunicación e historial de la cuenta. El dominio por concepto usa las funciones existentes.
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rpc } from '@/lib/supabase';
import { useAction, useAsync } from '@/lib/util';
import { abrirPdf } from '@/api/entregas';
import { porcentajeAsistencia, textoAsistencia, tonoAsistencia, UMBRAL_ASISTENCIA } from '@/lib/asistencia';
import { useDark } from '@/lib/tema';
import { etiquetaSeccion, formatoDuracion } from '@/lib/tiempo';
import { CATEGORIAS, calcularNota, type Notas } from '@/lib/notas';
import { nombreCodigo } from '@/lib/codigos';
import { conceptMastery, getLessonList, getUnits, lessonProgress } from '@/api/estudiante';
import { Badge, Card, ErrorBox, PageTitle, Spinner, Tabs } from '@/components/ui';
import { COMO_SE_CALCULA, VistaDominio } from '../estudiante/Progreso';

type Iso = string | null;
interface Actividad {
  id: string; clase: string; titulo: string; modo: 'practice' | 'exam'; abre: Iso; cierra: Iso; max_intentos: number | null; notas_publicadas: boolean;
  items: number; intentos: number; entregados: number; mejor: number | null; mejor_pct: number | null; maximo: number | null; primer_inicio: Iso;
  ultimo: { id: string; estado: string; inicio: string; entrega: Iso; puntaje: number | null; maximo: number | null; por_revisar: boolean; respondidos: number } | null;
  tiempo_efectivo: number; lectura: { segundos: number; pausas: number; completada: Iso; minimo: number | null } | null;
  registro: { categoria: string; puntos: number | null } | null;
}
interface Ficha {
  generado: string;
  perfil: { id: string; full_name: string; login_id: string | null; student_code: string | null; email: string | null; role: string; created_at: string; active: boolean; suspended_at: Iso; must_change_password: boolean; creado_por: string | null; ultimo_ingreso_auth: Iso };
  clases: { class_id: string; nombre: string; periodo: string; course_id: string; asignatura: string; grupo: string | null; inscrito: string; archivada: boolean; monitor: boolean }[];
  accesos: {
    correctos: number; fallos: number; rechazos: number; primer_acceso: Iso; ultimo_acceso: Iso; ultimo_fallo: Iso; dias_con_acceso: number;
    en_linea: boolean; ultima_presencia: Iso; sesiones_abiertas: number; detalle_tecnico: boolean;
    eventos: { fecha: string; correcto: boolean; motivo: string; navegador: string | null; sistema: string | null; tipo: string | null; pais: string | null; origen: string | null }[];
    dispositivos: { navegador: string | null; sistema: string | null; tipo: string | null; desde: string; ultimo: string; accesos: number; revocado: Iso }[] | null;
  };
  estudio: {
    efectivo: number; visible: number; inactivo: number; oculto: number; debil: number; rechazado: number; visitas: number; visitas_efectivas: number;
    dias_activos: number; primera: Iso; ultima: Iso; sin_conexion: number; interacciones: number; respuestas: number;
    por_dia: { dia: string; efectivo: number; visible: number }[];
    por_contenido: { tipo: 'leccion' | 'actividad' | 'pagina'; titulo: string | null; seccion: string; efectivo: number; visitas: number; ultima: string }[];
    mapa: { dow: number; hora: number; efectivo: number }[];
  };
  sesiones: { total: number; duracion_media: number; efectivo_medio: number; lista: { inicio: string; fin: string; efectivo: number; visible: number; visitas: number; respuestas: number; sin_conexion: boolean; titulos: string[]; secciones: string[] }[] };
  actividades: Actividad[];
  practica_libre: { lesson_id: string; leccion: string; intentos: number; entregados: number; mejor_pct: number | null; ultimo: string; ultimo_intento: string }[];
  respuestas: {
    total: number; correctas: number; parciales: number; incorrectas: number; por_revisar: number; reveladas: number;
    primer_intento_correctas: number; primer_intento_total: number; pistas: number; intentos_promedio: number | null; credito_medio: number | null;
    por_dificultad: { dificultad: string; total: number; correctas: number }[];
    por_concepto: { concepto: string; total: number; correctas: number }[];
    errores: { codigo: string; n: number }[];
    dificiles: { enunciado: string; estado: string; intentos: number; pistas: number; codigo: string | null; donde: string | null; attempt_id: string; fecha: string }[];
    recientes: { fecha: string; accion: string; estado: string | null; codigo: string | null; enunciado: string; donde: string | null; attempt_id: string }[];
  };
  calificaciones: { class_id: string; clase: string; publicadas: boolean;
    categorias: { categoria: string; nota: number | null; origen: string | null; pendientes: number }[];
    extras: { puntos: number; motivo: string; estado: string; fecha: string; por: string | null }[];
    historial: { categoria: string; antes: number | null; despues: number | null; fecha: string; por: string | null }[] }[];
  mensajes: { fecha: string; tipo: string; texto: string; entregado: Iso; leido: Iso; cerrado: Iso; por: string | null }[];
  bloqueos: { fecha: string; texto: string; desbloqueado: Iso; como: string | null; intentos_fallidos: number }[];
  cuenta: { fecha: string; accion: string; por: string | null }[];
}

type Tab = 'resumen' | 'accesos' | 'estudio' | 'actividades' | 'respuestas' | 'notas' | 'asistencia' | 'dominio' | 'comunicacion';

const fecha = (iso: Iso) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const dia = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—');
const hace = (iso: Iso) => {
  if (!iso) return 'nunca';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} días`;
};
const MOTIVO: Record<string, string> = {
  ok: 'Acceso correcto', bad_password: 'Contraseña incorrecta', unknown_id: 'ID inexistente', suspended: 'Cuenta suspendida',
  locked: 'Rechazado: bloqueo temporal', rate_ip: 'Rechazado: límite del origen', invalid_format: 'Formato inválido',
};
const ESTADO: Record<string, [string, 'green' | 'amber' | 'red' | 'gray' | 'blue']> = {
  correct: ['correcta', 'green'], partial: ['parcial', 'amber'], incorrect: ['incorrecta', 'red'], invalid: ['no válida', 'red'],
  pending_review: ['por revisar', 'blue'], revealed: ['vio la solución', 'gray'], draft: ['borrador', 'gray'],
};
const ACCION: Record<string, string> = { check: 'Comprobó', submit: 'Entregó', hint: 'Pidió pista', reveal: 'Vio la solución', manual_grade: 'Calificada por el profesor' };
const CUENTA: Record<string, string> = {
  create: 'Cuenta creada', reset_password: 'Contraseña restablecida', suspend: 'Cuenta suspendida', reactivate: 'Cuenta reactivada',
  password_changed: 'Cambió su contraseña', bootstrap: 'Alta inicial', enroll: 'Inscrito en una sección',
};
const DIF: Record<string, string> = { basico: 'Básico', intermedio: 'Intermedio', desafiante: 'Desafiante' };
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function Dato({ k, v, sub }: { k: string; v: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="tarjeta !p-3">
      <p className="text-xs text-gray-500">{k}</p>
      <p className="font-serif text-xl font-semibold tabular-nums">{v}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-100 py-1 text-sm dark:border-white/5">
      <span className="text-gray-500">{k}</span><span className="text-right">{v ?? '—'}</span>
    </div>
  );
}

/** Estado de una actividad para el estudiante, en palabras. */
function estadoActividad(a: Actividad): [string, 'green' | 'amber' | 'red' | 'gray' | 'blue'] {
  const vencida = a.cierra !== null && new Date(a.cierra) < new Date();
  const futura = a.abre !== null && new Date(a.abre) > new Date();
  if (a.entregados > 0) return a.ultimo?.por_revisar ? ['entregada · por revisar', 'blue'] : ['entregada', 'green'];
  if (a.intentos > 0) return vencida ? ['empezó y no entregó', 'red'] : ['en curso', 'amber'];
  if (futura) return ['aún no abre', 'gray'];
  return vencida ? ['no la intentó (cerrada)', 'red'] : ['no la ha intentado', 'amber'];
}

function Resumen({ f, x }: { f: Ficha; x: Extras | null }) {
  const acts = f.actividades;
  const sinIntentar = acts.filter((a) => a.intentos === 0 && !(a.abre && new Date(a.abre) > new Date()));
  const vencidas = sinIntentar.filter((a) => a.cierra && new Date(a.cierra) < new Date());
  const r = f.respuestas;
  const asis = x?.asistencia ?? [];
  const clases = asis.reduce((s, a) => s + a.sesiones, 0);
  const presentes = asis.reduce((s, a) => s + a.presentes, 0);
  const pctAsis = porcentajeAsistencia(presentes, clases);
  const ausenciasSeguidas = (() => {
    // ausencias consecutivas más recientes (en cualquier sección)
    const det = asis.flatMap((a) => a.detalle).sort((p, q) => q.fecha.localeCompare(p.fecha));
    let n = 0;
    for (const d of det) { if (d.presente) break; n++; }
    return n;
  })();
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Dato k="Asistencia a clase" v={pctAsis === null ? '—' : <Badge tone={tonoAsistencia(pctAsis)}>{pctAsis} %</Badge>} sub={clases ? `${presentes} de ${clases} clases${ausenciasSeguidas ? ` · ${ausenciasSeguidas} ausencia(s) seguida(s)` : ''}` : 'aún no se ha pasado lista'} />
        <Dato k="Última vez que entró" v={hace(f.accesos.ultimo_acceso ?? f.perfil.ultimo_ingreso_auth)} sub={fecha(f.accesos.ultimo_acceso ?? f.perfil.ultimo_ingreso_auth)} />
        <Dato k="Ingresos al aula" v={f.accesos.correctos} sub={`${f.accesos.dias_con_acceso} días distintos · ${f.accesos.fallos} fallos`} />
        <Dato k="Tiempo de estudio efectivo" v={formatoDuracion(f.estudio.efectivo)} sub={`${f.estudio.dias_activos} días activos`} />
        <Dato k="Sesiones de estudio" v={f.sesiones.total} sub={`media ${formatoDuracion(f.sesiones.duracion_media)} (efectivo ${formatoDuracion(f.sesiones.efectivo_medio)})`} />
        <Dato k="Actividades entregadas" v={`${acts.filter((a) => a.entregados > 0).length}/${acts.length}`} sub={`${sinIntentar.length} sin intentar · ${vencidas.length} vencidas`} />
        <Dato k="Aciertos" v={pct(r.correctas, r.total)} sub={`${r.total} respuestas · 1.er intento ${pct(r.primer_intento_correctas, r.primer_intento_total)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Datos de la cuenta">
          <Fila k="ID de acceso" v={<span className="font-mono">{f.perfil.login_id}</span>} />
          <Fila k="Matrícula" v={f.perfil.student_code} />
          {f.perfil.email && !f.perfil.email.endsWith('.invalid') && <Fila k="Correo" v={f.perfil.email} />}
          <Fila k="Estado" v={f.perfil.suspended_at ? <Badge tone="red">suspendida desde {fecha(f.perfil.suspended_at)}</Badge> : f.perfil.must_change_password ? <Badge tone="amber">no ha activado / cambiado la contraseña provisional</Badge> : <Badge tone="green">activa</Badge>} />
          <Fila k="Cuenta creada" v={`${fecha(f.perfil.created_at)}${f.perfil.creado_por ? ` por ${f.perfil.creado_por}` : ''}`} />
          <Fila k="Primer acceso registrado" v={fecha(f.accesos.primer_acceso)} />
          <Fila k="Ahora mismo" v={f.accesos.en_linea ? <Badge tone="green">conectado</Badge> : `desconectado · visto ${hace(f.accesos.ultima_presencia)}`} />
          <Fila k="Sesiones abiertas (dispositivos)" v={f.accesos.sesiones_abiertas} />
          <Fila k="Primera / última actividad de estudio" v={`${fecha(f.estudio.primera)} → ${fecha(f.estudio.ultima)}`} />
        </Card>
        <Card title="Secciones">
          {f.clases.map((c) => (
            <div key={c.class_id} className="border-b border-gray-100 py-1.5 text-sm dark:border-white/5">
              <Link className="enlace font-medium" to={`/docente/clases/${c.class_id}`}>{c.nombre}</Link> {c.archivada && <Badge>archivada</Badge>} {c.monitor && <Badge tone="purple">monitor</Badge>}
              <span className="block text-xs text-gray-500">{c.asignatura}{c.periodo ? ` · ${c.periodo}` : ''}{c.grupo ? ` · grupo ${c.grupo}` : ''} · inscrito {fecha(c.inscrito)}
                {(() => { const a = asis.find((y) => y.clase === c.nombre); return a && a.sesiones ? ` · asistencia ${textoAsistencia(a.presentes, a.sesiones)}` : ''; })()}</span>
            </div>
          ))}
          <h3 className="mb-1 mt-3 text-sm font-semibold">Lo que conviene mirar</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {pctAsis !== null && pctAsis < UMBRAL_ASISTENCIA && <li className="text-red-700 dark:text-red-400">Asistencia de {pctAsis} %, por debajo del {UMBRAL_ASISTENCIA} % ({clases - presentes} ausencias).</li>}
            {ausenciasSeguidas >= 2 && <li>Faltó a las últimas {ausenciasSeguidas} clases.</li>}
            {vencidas.length > 0 && <li className="text-red-700 dark:text-red-400">No intentó {vencidas.length} actividad(es) ya cerrada(s): {vencidas.slice(0, 3).map((a) => a.titulo).join(', ')}{vencidas.length > 3 ? '…' : ''}</li>}
            {sinIntentar.length - vencidas.length > 0 && <li>{sinIntentar.length - vencidas.length} actividad(es) abiertas sin empezar.</li>}
            {r.errores.length > 0 && <li>Error más frecuente: <strong>{nombreCodigo(r.errores[0].codigo)}</strong> ({r.errores[0].n} veces).</li>}
            {r.reveladas > 0 && <li>Vio la solución en {r.reveladas} ejercicio(s) sin resolverlo.</li>}
            {r.por_revisar > 0 && <li>{r.por_revisar} respuesta(s) esperan su revisión.</li>}
            {f.accesos.fallos >= 5 && <li>{f.accesos.fallos} intentos de acceso fallidos.</li>}
            {f.estudio.efectivo === 0 && <li>No hay tiempo de estudio registrado.</li>}
            {!vencidas.length && !r.errores.length && !r.reveladas && !r.por_revisar && f.estudio.efectivo > 0 && <li className="text-gray-500">Nada llamativo.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Accesos({ f }: { f: Ficha }) {
  const a = f.accesos;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Dato k="Ingresos correctos" v={a.correctos} />
        <Dato k="Contraseña incorrecta" v={a.fallos} sub={a.ultimo_fallo ? `último ${fecha(a.ultimo_fallo)}` : undefined} />
        <Dato k="Rechazos por bloqueo" v={a.rechazos} />
        <Dato k="Días con acceso" v={a.dias_con_acceso} />
        <Dato k="Primer acceso" v={a.primer_acceso ? dia(a.primer_acceso) : '—'} />
        <Dato k="Último acceso" v={a.ultimo_acceso ? dia(a.ultimo_acceso) : '—'} sub={a.ultimo_acceso ? hora(a.ultimo_acceso) : undefined} />
      </div>
      <Card title={`Inicios de sesión (últimos ${a.eventos.length})`}>
        <p className="mb-2 text-xs text-gray-500">Se conservan 180 días.{!a.detalle_tecnico && ' El dispositivo, el país y el origen de red solo los ve el administrador.'}</p>
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Fecha</th><th>Resultado</th>{a.detalle_tecnico && <><th>Dispositivo</th><th>País</th><th>Origen</th></>}</tr></thead>
            <tbody>
              {a.eventos.map((e, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-white/5">
                  <td className="whitespace-nowrap py-1">{fecha(e.fecha)}</td>
                  <td className={e.correcto ? 'text-green-700' : 'text-red-600'}>{MOTIVO[e.motivo] ?? e.motivo}</td>
                  {a.detalle_tecnico && <><td className="text-xs">{[e.navegador, e.sistema, e.tipo].filter(Boolean).join(' · ') || '—'}</td><td>{e.pais ?? '—'}</td><td className="font-mono text-xs">{e.origen ? `O-${e.origen}` : '—'}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {a.detalle_tecnico && <p className="mt-2 text-xs"><Link className="enlace" to="/docente/seguridad">Analizar en el Centro de seguridad →</Link></p>}
      </Card>
      {a.dispositivos && (
        <Card title="Dispositivos reconocidos">
          {a.dispositivos.length ? a.dispositivos.map((d, i) => (
            <Fila key={i} k={[d.navegador, d.sistema, d.tipo].filter(Boolean).join(' · ') || 'Dispositivo'} v={`desde ${fecha(d.desde)} · último ${fecha(d.ultimo)} · ${d.accesos} accesos${d.revocado ? ' · REVOCADO' : ''}`} />
          )) : <p className="text-sm text-gray-500">Ninguno todavía (se reconocen tras un acceso correcto con la versión actual del aula).</p>}
        </Card>
      )}
    </div>
  );
}

function Estudio({ f }: { f: Ficha }) {
  const dark = useDark();
  const e = f.estudio;
  const texto = dark ? '#d1d5db' : '#374151';
  const azul = dark ? '#7f9fd6' : '#335ca6';
  const dias = useMemo(() => {
    // los últimos 60 días, con ceros donde no estudió (sin inventar datos: cero = sin registro)
    const m = new Map(e.por_dia.map((d) => [d.dia, d.efectivo]));
    return Array.from({ length: 60 }, (_, i) => {
      const d = new Date(Date.now() - (59 - i) * 86400e3);
      const k = d.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });
      return { dia: k.slice(5), min: Math.round((m.get(k) ?? 0) / 60) };
    });
  }, [e.por_dia]);
  const maxMapa = Math.max(1, ...e.mapa.map((x) => x.efectivo));
  const celda = (d: number, h: number) => e.mapa.find((x) => x.dow === d && x.hora === h)?.efectivo ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Dato k="Tiempo efectivo" v={formatoDuracion(e.efectivo)} sub={`con la página visible: ${formatoDuracion(e.visible)}`} />
        <Dato k="Días activos" v={e.dias_activos} />
        <Dato k="Sesiones" v={f.sesiones.total} sub={`media ${formatoDuracion(f.sesiones.duracion_media)}`} />
        <Dato k="Páginas visitadas" v={e.visitas} sub={`${e.visitas_efectivas} con estudio efectivo`} />
        <Dato k="Inactivo / en otra pestaña" v={formatoDuracion(e.inactivo + e.oculto)} sub={`inactivo ${formatoDuracion(e.inactivo)} · oculto ${formatoDuracion(e.oculto)}`} />
        <Dato k="Respuestas durante el estudio" v={e.respuestas} sub={`${e.interacciones} interacciones`} />
      </div>
      {(e.debil > 0 || e.rechazado > 0 || e.sin_conexion > 0) && (
        <p className="text-xs text-gray-500">Calidad del dato: {formatoDuracion(e.debil)} sostenidos solo con el ratón · {formatoDuracion(e.rechazado)} rechazados por la validación · {e.sin_conexion} visitas sincronizadas tras perder la conexión.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Minutos de estudio efectivo por día (60 días)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dias}>
              <CartesianGrid stroke={dark ? '#ffffff1a' : '#00000014'} vertical={false} />
              <XAxis dataKey="dia" tick={{ fill: texto, fontSize: 9 }} interval={6} />
              <YAxis allowDecimals={false} tick={{ fill: texto, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: dark ? '#0b1730' : '#fff', border: '1px solid #8884', fontSize: 12 }} formatter={(v) => [`${v} min`, 'Estudio efectivo']} />
              <Bar dataKey="min" fill={azul} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="¿Cuándo estudia? (día y hora, Santo Domingo)">
          <div className="overflow-x-auto">
            <table className="text-[10px]">
              <thead><tr><th />{Array.from({ length: 24 }, (_, h) => <th key={h} className="w-4 font-normal text-gray-500">{h % 3 === 0 ? h : ''}</th>)}</tr></thead>
              <tbody>
                {DIAS.map((n, i) => (
                  <tr key={n}><td className="pr-1 text-gray-500">{n}</td>
                    {Array.from({ length: 24 }, (_, h) => {
                      const v = celda(i + 1, h);
                      return <td key={h} title={`${n} ${h}:00 · ${formatoDuracion(v)}`} className="h-4 w-4 rounded-sm" style={{ background: v ? azul : 'transparent', opacity: v ? 0.2 + 0.8 * (v / maxMapa) : 1, outline: '1px solid #8882' }} />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card title={`Sesiones de estudio: cuándo entró y cuándo salió (últimas ${f.sesiones.lista.length})`}>
        <p className="mb-2 text-xs text-gray-500">Una sesión agrupa las visitas seguidas; una pausa más larga que la configurada en Analítica abre otra.</p>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Día</th><th>Entró</th><th>Salió</th><th className="text-right">Duración</th><th className="text-right">Efectivo</th><th className="text-right">Págs.</th><th>Qué estudió</th></tr></thead>
            <tbody>
              {f.sesiones.lista.map((s, i) => (
                <tr key={i} className="border-b border-gray-100 align-top dark:border-white/5">
                  <td className="whitespace-nowrap py-1">{dia(s.inicio)}</td><td className="tabular-nums">{hora(s.inicio)}</td><td className="tabular-nums">{hora(s.fin)}</td>
                  <td className="text-right tabular-nums">{formatoDuracion((new Date(s.fin).getTime() - new Date(s.inicio).getTime()) / 1000)}</td>
                  <td className="text-right tabular-nums">{formatoDuracion(s.efectivo)}</td>
                  <td className="text-right tabular-nums">{s.visitas}</td>
                  <td className="text-xs">{[...s.titulos, ...s.secciones.map(etiquetaSeccion)].join(' · ') || '—'}{s.respuestas ? ` · ${s.respuestas} respuestas` : ''}{s.sin_conexion ? ' · (sin conexión)' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Tiempo por contenido">
        <div className="max-h-[24rem] overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Contenido</th><th className="text-right">Efectivo</th><th className="text-right">Visitas</th><th>Última vez</th></tr></thead>
            <tbody>
              {e.por_contenido.map((c, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-white/5">
                  <td className="py-1">{c.titulo ?? (c.tipo === 'pagina' ? 'Página del aula' : '—')} <span className="text-xs text-gray-500">· {etiquetaSeccion(c.seccion)}</span>{c.tipo === 'actividad' && <> <Badge tone="blue">actividad</Badge></>}</td>
                  <td className="text-right tabular-nums">{formatoDuracion(c.efectivo)}</td><td className="text-right tabular-nums">{c.visitas}</td>
                  <td className="whitespace-nowrap text-xs">{fecha(c.ultima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Actividades({ f }: { f: Ficha }) {
  return (
    <div className="space-y-4">
      <Card title={`Actividades de sus secciones · ${f.actividades.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Actividad</th><th>Estado</th><th className="text-right">Mejor nota</th><th className="text-right">Intentos</th><th>Último intento</th><th className="text-right">Tiempo</th><th>Registro</th></tr></thead>
            <tbody>
              {f.actividades.map((a) => {
                const [t, tono] = estadoActividad(a);
                return (
                  <tr key={a.id} className="border-b border-gray-100 align-top dark:border-white/5">
                    <td className="py-1.5"><Link className="enlace" to={`/docente/actividades/${a.id}`}>{a.titulo}</Link> {a.modo === 'exam' && <Badge tone="purple">evaluación</Badge>}
                      <span className="block text-xs text-gray-500">{a.clase} · {a.items} ejercicios{a.cierra ? ` · cierra ${fecha(a.cierra)}` : ''}</span>
                      {a.lectura && <span className="block text-xs text-gray-500">Lectura: {formatoDuracion(a.lectura.segundos)}{a.lectura.minimo ? ` de ${formatoDuracion(a.lectura.minimo)}` : ''} · {a.lectura.pausas} pausas · {a.lectura.completada ? 'completada' : 'sin completar'}</span>}
                    </td>
                    <td><Badge tone={tono}>{t}</Badge></td>
                    <td className="text-right tabular-nums">{a.mejor_pct !== null ? <>{a.mejor_pct} %<span className="block text-xs text-gray-500">{a.mejor}/{a.maximo}</span></> : '—'}</td>
                    <td className="text-right tabular-nums">{a.intentos}{a.max_intentos ? `/${a.max_intentos}` : ''}</td>
                    <td className="text-xs">{a.ultimo ? <Link className="enlace" to={`/docente/intentos/${a.ultimo.id}`}>{fecha(a.ultimo.inicio)}</Link> : '—'}
                      {a.ultimo && <span className="block text-gray-500">{a.ultimo.respondidos}/{a.items} respondidos{a.ultimo.entrega ? ` · entregó ${fecha(a.ultimo.entrega)}` : ''}</span>}</td>
                    <td className="text-right text-xs tabular-nums">{a.tiempo_efectivo ? formatoDuracion(a.tiempo_efectivo) : '—'}</td>
                    <td className="text-xs">{a.registro ? `${CATEGORIAS.find((c) => c.id === a.registro!.categoria)?.label ?? a.registro.categoria}${a.registro.puntos ? ` · ${a.registro.puntos} pts` : ''}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={`Práctica libre por lección · ${f.practica_libre.length}`}>
        {f.practica_libre.length ? f.practica_libre.map((p) => (
          <Fila key={p.lesson_id} k={p.leccion} v={<><Link className="enlace" to={`/docente/intentos/${p.ultimo_intento}`}>{p.mejor_pct !== null ? `${p.mejor_pct} %` : 'en curso'}</Link> <span className="text-xs text-gray-500">· {p.intentos} intento(s) · {fecha(p.ultimo)}</span></>} />
        )) : <p className="text-sm text-gray-500">No ha hecho práctica libre.</p>}
      </Card>
    </div>
  );
}

function Respuestas({ f }: { f: Ficha }) {
  const r = f.respuestas;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Dato k="Respuestas" v={r.total} />
        <Dato k="Correctas" v={r.correctas} sub={pct(r.correctas, r.total)} />
        <Dato k="Parciales / incorrectas" v={`${r.parciales} / ${r.incorrectas}`} />
        <Dato k="Correctas al primer intento" v={pct(r.primer_intento_correctas, r.primer_intento_total)} sub={`${r.primer_intento_correctas} de ${r.primer_intento_total}`} />
        <Dato k="Pistas pedidas" v={r.pistas} sub={`vio la solución en ${r.reveladas}`} />
        <Dato k="Intentos por ejercicio" v={r.intentos_promedio ?? '—'} sub={r.credito_medio !== null ? `crédito medio ${r.credito_medio} %` : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Errores que más comete">
          {r.errores.length ? r.errores.map((e) => <Fila key={e.codigo} k={nombreCodigo(e.codigo)} v={`${e.n} vez/veces`} />) : <p className="text-sm text-gray-500">El motor no detectó errores típicos.</p>}
        </Card>
        <Card title="Por dificultad">
          {r.por_dificultad.length ? r.por_dificultad.map((d) => <Fila key={d.dificultad} k={DIF[d.dificultad] ?? d.dificultad} v={`${d.correctas}/${d.total} · ${pct(d.correctas, d.total)}`} />) : <p className="text-sm text-gray-500">Sin respuestas.</p>}
        </Card>
        <Card title="Por concepto">
          <div className="max-h-60 overflow-auto">
            {r.por_concepto.length ? r.por_concepto.map((c) => <Fila key={c.concepto} k={c.concepto.replace(/-/g, ' ')} v={`${c.correctas}/${c.total} · ${pct(c.correctas, c.total)}`} />) : <p className="text-sm text-gray-500">Sin respuestas.</p>}
          </div>
        </Card>
      </div>
      <Card title="Ejercicios en los que tuvo dificultad">
        {r.dificiles.length ? (
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            {r.dificiles.map((d, i) => (
              <li key={i} className="py-1.5">
                <Badge tone={ESTADO[d.estado]?.[1] ?? 'gray'}>{ESTADO[d.estado]?.[0] ?? d.estado}</Badge> {d.enunciado}
                <span className="block text-xs text-gray-500">{d.donde ?? '—'} · {d.intentos} intento(s) · {d.pistas} pista(s){d.codigo && d.codigo !== 'ok' ? ` · ${nombreCodigo(d.codigo)}` : ''} · <Link className="enlace" to={`/docente/intentos/${d.attempt_id}`}>ver el intento</Link></span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">Ninguno.</p>}
      </Card>
      <Card title="Lo último que hizo (cada comprobación, entrega, pista y solución vista)">
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full text-sm">
            <tbody>
              {r.recientes.map((x, i) => (
                <tr key={i} className="border-b border-gray-100 align-top dark:border-white/5">
                  <td className="whitespace-nowrap py-1 pr-2 text-xs">{fecha(x.fecha)}</td>
                  <td className="pr-2 text-xs font-medium">{ACCION[x.accion] ?? x.accion}</td>
                  <td className="pr-2">{x.estado && <Badge tone={ESTADO[x.estado]?.[1] ?? 'gray'}>{ESTADO[x.estado]?.[0] ?? x.estado}</Badge>}{x.codigo && x.codigo !== 'ok' && <span className="block text-xs text-gray-500">{nombreCodigo(x.codigo)}</span>}</td>
                  <td className="text-xs">{x.enunciado}<span className="block text-gray-500">{x.donde} · <Link className="enlace" to={`/docente/intentos/${x.attempt_id}`}>intento</Link></span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!r.recientes.length && <p className="text-sm text-gray-500">Sin actividad registrada.</p>}
        </div>
      </Card>
    </div>
  );
}

function Calificaciones({ f }: { f: Ficha }) {
  if (!f.calificaciones.length) return <p className="text-sm text-gray-500">Sin secciones a su cargo.</p>;
  return (
    <div className="space-y-4">
      {f.calificaciones.map((c) => {
        const notas: Notas = Object.fromEntries(c.categorias.map((x) => [x.categoria, x.nota]));
        const extras = c.extras.filter((x) => x.estado === 'aprobado').reduce((s, x) => s + Number(x.puntos), 0);
        const n = calcularNota(notas, extras);
        return (
          <Card key={c.class_id} title={`${c.clase} · nota ${n.final}/100${n.pendientes.length ? ` (${n.pendientes.length} apartado(s) pendiente(s))` : ''}`}
            actions={<Link className="btn-secundario !py-1 text-xs" to={`/docente/clases/${c.class_id}/registro`}>Abrir el registro</Link>}>
            <p className="mb-2 text-xs text-gray-500">{c.publicadas ? 'Las calificaciones están publicadas para el estudiante.' : 'Aún no publicadas para el estudiante.'}</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Apartado</th><th className="text-right">Nota</th><th className="text-right">Máximo</th><th>Origen</th></tr></thead>
              <tbody>
                {CATEGORIAS.map((cat) => {
                  const x = c.categorias.find((y) => y.categoria === cat.id);
                  return (
                    <tr key={cat.id} className="border-b border-gray-100 dark:border-white/5">
                      <td className="py-1">{cat.label}</td>
                      <td className="text-right tabular-nums">{x?.nota ?? <span className="text-gray-400">pendiente</span>}</td>
                      <td className="text-right tabular-nums text-gray-500">{cat.max}</td>
                      <td className="text-xs">{x?.origen === 'manual' ? 'escrita por el profesor' : x?.origen === 'actividades' ? `de las actividades${x.pendientes ? ` (${x.pendientes} por entregar)` : ''}` : '—'}</td>
                    </tr>
                  );
                })}
                <tr className="border-b border-gray-100 dark:border-white/5"><td className="py-1">Puntos extra aprobados</td><td className="text-right tabular-nums">{extras}</td><td /><td /></tr>
                <tr className="font-semibold"><td className="py-1">Nota final</td><td className="text-right tabular-nums">{n.final}</td><td className="text-right text-gray-500">100</td><td className="text-xs font-normal">{n.bruto > 100 ? `(suma ${n.bruto}, máximo 100)` : ''}</td></tr>
              </tbody>
            </table>
            {c.extras.length > 0 && (
              <><h3 className="mb-1 mt-3 text-sm font-semibold">Puntos extra</h3>
                {c.extras.map((x, i) => <Fila key={i} k={`${fecha(x.fecha)} · ${x.motivo}`} v={`${x.puntos} pts · ${x.estado}${x.por ? ` · ${x.por}` : ''}`} />)}</>
            )}
            {c.historial.length > 0 && (
              <><h3 className="mb-1 mt-3 text-sm font-semibold">Historial de cambios</h3>
                {c.historial.map((h, i) => <Fila key={i} k={`${fecha(h.fecha)} · ${CATEGORIAS.find((y) => y.id === h.categoria)?.label ?? h.categoria}`} v={`${h.antes ?? '—'} → ${h.despues ?? '—'}${h.por ? ` · ${h.por}` : ''}`} />)}</>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Dominio({ f, userId }: { f: Ficha; userId: string }) {
  const cursos = [...new Map(f.clases.map((c) => [c.course_id, c.asignatura])).entries()];
  const st = useAsync(() => Promise.all(cursos.map(async ([id, titulo]) => {
    const [units, lessons, progress, mastery] = await Promise.all([getUnits(id), getLessonList(id), lessonProgress(id, userId), conceptMastery(id, userId)]);
    return { id, titulo, units, lessons, progress, mastery };
  })), [userId, cursos.map((c) => c[0]).join()]);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} />;
  return (
    <div className="space-y-5">
      <div>{COMO_SE_CALCULA}</div>
      {st.data!.map((c) => (
        <section key={c.id}>
          {cursos.length > 1 && <h2 className="mb-2 font-serif text-lg font-semibold">{c.titulo}</h2>}
          <VistaDominio units={c.units} lessons={c.lessons} progress={c.progress} mastery={c.mastery} courseId={c.id} linkLessons={false} />
        </section>
      ))}
    </div>
  );
}

interface Extras {
  asistencia: { clase: string; sesiones: number; presentes: number; detalle: { fecha: string; presente: boolean; hora: Iso; como: string | null }[] }[];
  entregas: { buzon: string; clase: string; tipo: string; cierra: Iso; permiso: string | null; archivos: { id: string; nombre: string; bytes: number; subido: string; estado: string; nota: string | null }[] }[];
}

function AsistenciaEntregas({ x }: { x: Extras }) {
  const accion = useAction();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Asistencia">
        <ErrorBox error={accion.error} />
        {x.asistencia.length ? x.asistencia.map((a) => (
          <div key={a.clase} className="mb-3">
            <p className="text-sm font-medium">{a.clase} — {a.presentes}/{a.sesiones} clases <Badge tone={tonoAsistencia(porcentajeAsistencia(a.presentes, a.sesiones))}>{porcentajeAsistencia(a.presentes, a.sesiones) ?? '—'} %</Badge></p>
            <div className="mt-1 flex flex-wrap gap-1">
              {a.detalle.map((d, i) => (
                <span key={i} title={d.presente ? `Presente ${d.hora ? hora(d.hora) : ''}${d.como === 'profesor' ? ' (marcado por el profesor)' : ''}` : 'Ausente'}
                  className={`rounded px-1.5 py-0.5 text-xs ${d.presente ? 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200' : 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200'}`}>
                  {dia(d.fecha)} {d.presente ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>
        )) : <p className="text-sm text-gray-500">No se ha pasado lista en sus secciones.</p>}
      </Card>
      <Card title="Entregas en PDF">
        {x.entregas.length ? x.entregas.map((e, i) => (
          <div key={i} className="border-b border-gray-100 py-1.5 text-sm dark:border-white/5">
            <span className="font-medium">{e.buzon}</span> <span className="text-xs text-gray-500">· {e.clase}{e.cierra ? ` · cierra ${fecha(e.cierra)}` : ''} · autorización: {e.permiso ?? 'no solicitada'}</span>
            {e.archivos.map((a) => (
              <span key={a.id} className="block text-xs"><button className="enlace" onClick={() => void accion.run(() => abrirPdf(a.id))}>📄 {a.nombre}</button> · {fecha(a.subido)} · {a.estado}{a.nota ? ` · «${a.nota}»` : ''}</span>
            ))}
            {!e.archivos.length && <span className="block text-xs text-gray-400">sin archivos</span>}
          </div>
        )) : <p className="text-sm text-gray-500">No hay buzones de entrega en sus secciones.</p>}
      </Card>
    </div>
  );
}

function Comunicacion({ f }: { f: Ficha }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Mensajes recibidos · ${f.mensajes.length}`}>
        {f.mensajes.length ? f.mensajes.map((m, i) => (
          <div key={i} className="border-b border-gray-100 py-1.5 text-sm dark:border-white/5">
            <Badge tone={m.tipo === 'urgente' ? 'red' : m.tipo === 'importante' ? 'amber' : 'blue'}>{m.tipo}</Badge> {m.texto}
            <span className="block text-xs text-gray-500">{fecha(m.fecha)}{m.por ? ` · ${m.por}` : ''} · {m.leido ? `leído ${fecha(m.leido)}` : m.entregado ? 'entregado, sin leer' : 'aún no entregado'}</span>
          </div>
        )) : <p className="text-sm text-gray-500">Ninguno.</p>}
      </Card>
      <div className="space-y-4">
        <Card title={`Bloqueos de pantalla · ${f.bloqueos.length}`}>
          {f.bloqueos.length ? f.bloqueos.map((b, i) => (
            <Fila key={i} k={`${fecha(b.fecha)} · ${b.texto}`} v={b.desbloqueado ? `desbloqueado ${fecha(b.desbloqueado)} (${b.como === 'codigo' ? 'con el código' : 'por el profesor'})${b.intentos_fallidos ? ` · ${b.intentos_fallidos} códigos errados` : ''}` : <Badge tone="red">activo</Badge>} />
          )) : <p className="text-sm text-gray-500">Ninguno.</p>}
        </Card>
        <Card title="Historial de la cuenta">
          {f.cuenta.length ? f.cuenta.map((c, i) => <Fila key={i} k={fecha(c.fecha)} v={`${CUENTA[c.accion] ?? c.accion}${c.por ? ` · ${c.por}` : ''}`} />) : <p className="text-sm text-gray-500">Sin eventos.</p>}
        </Card>
      </div>
    </div>
  );
}

export default function FichaEstudiante() {
  const { userId = '', classId } = useParams();
  const [tab, setTab] = useState<Tab>('resumen');
  // el parámetro es el identificador interno o, desde el Centro de seguridad, el ID de acceso
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  const st = useAsync(async () => {
    const f = await (esUuid ? rpc<Ficha>('student_dossier', { p_user: userId }) : rpc<Ficha>('student_dossier_by_login', { p_login: userId }));
    const x = await rpc<Extras>('student_extras', { p_user: f.perfil.id }).catch(() => null);
    return { f, x };
  }, [userId]);
  if (st.loading) return <Spinner label="Reuniendo toda la información del estudiante…" />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const { f, x } = st.data!;
  const volver = classId ? { to: `/docente/clases/${classId}`, label: f.clases.find((c) => c.class_id === classId)?.nombre ?? 'Sección' } : { to: '/docente', label: 'Panel docente' };
  return (
    <div className="space-y-4">
      <PageTitle
        title={f.perfil.full_name || f.perfil.login_id || 'Estudiante'}
        subtitle={<>ID <span className="font-mono">{f.perfil.login_id ?? '—'}</span>{f.perfil.student_code ? ` · ${f.perfil.student_code}` : ''} · {f.clases.map((c) => c.nombre).join(', ') || 'sin secciones a su cargo'} {f.accesos.en_linea && <Badge tone="green">conectado ahora</Badge>}</>}
        back={volver}
        actions={<>
          <Link to={`/docente/comunicacion?u=${f.perfil.id}`} className="btn-secundario">✉ Mensaje</Link>
          <button className="btn-secundario" onClick={() => window.print()}>Imprimir</button>
          <button className="btn-secundario" onClick={() => void st.reload()}>Actualizar</button>
        </>}
      />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'resumen', label: 'Resumen' }, { id: 'accesos', label: 'Accesos' }, { id: 'estudio', label: 'Estudio y sesiones' },
        { id: 'actividades', label: 'Actividades' }, { id: 'respuestas', label: 'Respuestas y errores' }, { id: 'notas', label: 'Calificaciones' }, { id: 'asistencia', label: 'Asistencia y entregas' },
        { id: 'dominio', label: 'Dominio' }, { id: 'comunicacion', label: 'Mensajes y cuenta' },
      ]} />
      {tab === 'resumen' && <Resumen f={f} x={x} />}
      {tab === 'accesos' && <Accesos f={f} />}
      {tab === 'estudio' && <Estudio f={f} />}
      {tab === 'actividades' && <Actividades f={f} />}
      {tab === 'respuestas' && <Respuestas f={f} />}
      {tab === 'notas' && <Calificaciones f={f} />}
      {tab === 'asistencia' && (x ? <AsistenciaEntregas x={x} /> : <ErrorBox error="No se pudo cargar la asistencia." onRetry={st.reload} />)}
      {tab === 'dominio' &&<Dominio f={f} userId={f.perfil.id} />}
      {tab === 'comunicacion' && <Comunicacion f={f} />}
      <p className="text-xs text-gray-500">Datos al {fecha(f.generado)}. Cada consulta de esta ficha queda registrada. Solo se muestran las secciones a su cargo.</p>
    </div>
  );
}
