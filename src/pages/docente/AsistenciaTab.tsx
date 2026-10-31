/** Pestaña «Asistencia» de una sección: abrir con código, lista en vivo, correcciones e historial. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { asistenciaEnVivo, cerrarAsistencia, iniciarAsistencia, informeAsistencia, marcarManual, nuevoCodigo, type AsistenciaEnVivo } from '@/api/asistencia';
import { avisoPrecision, MOTIVO_RECHAZO, PRECISION_PROFESOR, textoVerificacion, ubicacionActual } from '@/lib/ubicacion';
import { aCsv } from '@/lib/tiempo';
import { porcentajeAsistencia, tonoAsistencia, UMBRAL_ASISTENCIA } from '@/lib/asistencia';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Spinner } from '@/components/ui';
import { ConfigQuorum } from './ConfigQuorum';

const fecha = (iso: string) => new Date(iso).toLocaleString('es-DO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export function EnVivo({ id, onCerrada }: { id: string; onCerrada: () => void }) {
  const [d, setD] = useState<AsistenciaEnVivo | null>(null);
  const [desfase, setDesfase] = useState(0);
  const [, setTick] = useState(0);
  const accion = useAction();
  async function cargar() {
    const r = await asistenciaEnVivo(id);
    setDesfase(new Date(r.server_now).getTime() - Date.now());
    setD(r);
  }
  useEffect(() => {
    void accion.run(cargar);
    const t = window.setInterval(() => void cargar().catch(() => undefined), 4000);
    const s = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => { window.clearInterval(t); window.clearInterval(s); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // con código rotativo: recargar justo cuando cambia (además de la consulta periódica)
  useEffect(() => {
    if (!d?.code_changes_at) return;
    const ms = new Date(d.code_changes_at).getTime() - (Date.now() + desfase) + 300;
    const t = window.setTimeout(() => void cargar().catch(() => undefined), Math.max(300, ms));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.code_changes_at]);
  if (!d) return accion.error ? <ErrorBox error={accion.error} /> : <Spinner />;
  const restante = Math.max(0, Math.round((new Date(d.code_expires_at).getTime() - (Date.now() + desfase)) / 1000));
  const abierta = !d.closed_at && restante > 0;
  const presentes = d.estudiantes.filter((e) => e.presente);
  const cambiaEn = d.code_changes_at ? Math.max(0, Math.ceil((new Date(d.code_changes_at).getTime() - (Date.now() + desfase)) / 1000)) : null;
  const porQuorum = d.activacion === 'quorum';
  return (
    <div className="space-y-3">
      <ErrorBox error={accion.error} />
      {porQuorum && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-800 dark:bg-sky-900/20">
          <p className="font-semibold">Activada por quórum de proximidad</p>
          <p>Hora programada: {d.franja ? hora(d.franja) : '—'} · activación real: {hora(d.opened_at)} · zona de {d.geo_radius_m} m alrededor del centro del grupo inicial (fijo)</p>
          <p>Quórum inicial: {(d.quorum ?? []).map((q) => q.full_name || q.student_code).join(', ') || '—'}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">Los demás se validaron por proximidad a compañeros ya registrados. Usted puede cerrar, marcar o quitar a mano, o habilitar también el código.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <div className={`rounded-xl border border-gray-200 px-6 py-3 text-center dark:border-white/10 ${porQuorum ? 'hidden' : ''}`}>
          <p className="text-xs text-gray-500">Código {d.rotate_seconds ? `(cambia cada ${d.rotate_seconds} s)` : ''}</p>
          <p className={`font-mono text-5xl font-bold tracking-[0.2em] ${abierta ? '' : 'text-gray-400 line-through'}`}>{d.code.slice(0, 3)} {d.code.slice(3)}</p>
          {abierta && cambiaEn !== null && (
            <div className="mx-auto mt-1 h-1.5 w-40 overflow-hidden rounded bg-gray-200 dark:bg-white/10" aria-label={`El código cambia en ${cambiaEn} s`}>
              <div className="h-full bg-primario-600 transition-all" style={{ width: `${(100 * cambiaEn) / d.rotate_seconds}%` }} />
            </div>
          )}
          <p className="text-xs text-gray-500">{d.closed_at ? 'asistencia cerrada' : abierta ? `asistencia abierta ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')} más` : 'tiempo terminado'}</p>
          <p className="text-xs text-gray-500">{d.tiene_ubicacion ? `📍 verifica ubicación (radio ${d.geo_radius_m} m${d.require_location ? ', obligatoria' : ''})` : 'sin verificación de ubicación'}</p>
        </div>
        <div>
          <p className="font-serif text-3xl font-semibold">{presentes.length}<span className="text-lg text-gray-500">/{d.estudiantes.length}</span></p>
          <p className="text-sm text-gray-500">presentes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secundario" disabled={accion.busy} onClick={() => void accion.run(async () => { await nuevoCodigo(id, 10); await cargar(); })}>{porQuorum ? 'Habilitar también código (10 min)' : 'Nuevo código (10 min)'}</button>
          {!d.closed_at && <button className="btn-secundario" disabled={accion.busy} onClick={() => void accion.run(async () => { await cerrarAsistencia(id); await cargar(); onCerrada(); })}>Cerrar asistencia</button>}
        </div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {d.estudiantes.map((e) => (
          <div key={e.user_id} className={`flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm ${e.presente ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-gray-200 dark:border-white/10'}`}>
            <span><Link className="enlace" to={`/docente/estudiantes/${e.user_id}`}>{e.full_name || e.student_code || '—'}</Link>
              <span className="block text-xs text-gray-500">{e.presente ? `${e.method === 'profesor' ? 'marcado por usted' : e.method === 'quorum' ? 'quórum inicial' : e.method === 'proximidad' ? 'por proximidad' : 'con código'} · ${hora(e.marked_at!)}` : 'ausente'}</span>
              {e.presente && e.method === 'codigo' && e.geo_status && <span className={`block text-xs ${e.geo_status === 'verificado' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>{textoVerificacion(e.geo_status, e.distance_m, e.accuracy)}</span>}
              {e.presente && (e.method === 'quorum' || e.method === 'proximidad') && <span className="block text-xs text-green-700 dark:text-green-400">📍 a {e.distance_m ?? '?'} m del centro{e.method === 'proximidad' && e.validado_por ? ` · a ${e.distancia_ref_m ?? '?'} m de ${e.validado_por.split(' ')[0]}` : ''}{e.accuracy ? ` · ±${e.accuracy} m` : ''}</span>}</span>
            <button className="btn-secundario !px-2 !py-0.5 text-xs" disabled={accion.busy} onClick={() => void accion.run(async () => { await marcarManual(id, e.user_id, !e.presente); await cargar(); })}>{e.presente ? 'Quitar' : 'Marcar'}</button>
          </div>
        ))}
      </div>
      {d.rechazos.length > 0 && (
        <div className="rounded-lg border border-red-200 p-2 dark:border-red-900">
          <p className="mb-1 text-sm font-semibold text-red-700 dark:text-red-400">Intentos rechazados ({d.rechazos.length})</p>
          <ul className="text-xs">
            {d.rechazos.map((r, i) => (
              <li key={i}>{hora(r.fecha)} · <strong>{r.full_name || r.student_code}</strong> · {MOTIVO_RECHAZO[r.motivo] ?? r.motivo}{r.distance_m !== null ? ` (a ${r.distance_m >= 1000 ? `${(r.distance_m / 1000).toFixed(1)} km` : `${r.distance_m} m`}${r.accuracy ? `, ±${r.accuracy} m` : ''})` : ''}
                {presentes.some((p) => p.full_name === r.full_name && p.student_code === r.student_code) && <span className="text-green-700 dark:text-green-400"> · después quedó presente</span>}</li>
            ))}
          </ul>
        </div>
      )}
      {(d.incidencias ?? []).length > 0 && (
        <details className="rounded-lg border border-gray-200 p-2 text-xs dark:border-white/10">
          <summary className="cursor-pointer text-sm font-semibold">Validaciones e incidencias geográficas ({d.incidencias!.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {d.incidencias!.map((x, i) => (
              <li key={i}>{hora(x.fecha)} · <strong>{x.full_name ?? '—'}</strong> · {TIPO_INCIDENCIA[x.tipo] ?? x.tipo}
                {x.detalle.motivo ? ` (${MOTIVO_INCIDENCIA[String(x.detalle.motivo)] ?? String(x.detalle.motivo)})` : ''}
                {x.detalle.distancia_centro_m !== undefined ? ` · a ${String(x.detalle.distancia_centro_m)} m del centro` : ''}
                {x.detalle.distancia_ref_m !== undefined ? ` · a ${String(x.detalle.distancia_ref_m)} m del admitido más cercano` : ''}
                {x.detalle.precision_m !== undefined && x.detalle.precision_m !== null ? ` · ±${String(x.detalle.precision_m)} m` : ''}</li>
            ))}
          </ul>
          <p className="mt-1 text-gray-500">«Inconclusa» no es ausencia: la medición no permitió decidir (puede validar al estudiante con «Marcar»).</p>
        </details>
      )}
    </div>
  );
}

const TIPO_INCIDENCIA: Record<string, string> = {
  activacion: 'activó la asistencia (quórum)', presente: 'presente por proximidad', inconclusa: 'validación inconclusa', fuera_de_zona: 'fuera de la zona',
  medicion_antigua: 'medición antigua', dispositivo_compartido: 'dispositivo de otro estudiante', renovada: 'renovó su referencia',
  configuracion: 'cambió la configuración', centro_modificado: 'el docente cambió el centro',
};
const MOTIVO_INCIDENCIA: Record<string, string> = {
  precision: 'GPS poco preciso', sin_referencias_vigentes: 'ningún admitido con ubicación reciente', zona_incierta: 'en el límite de la zona',
  proximidad_incierta: 'proximidad incierta', lejos_del_centro: 'lejos del centro inicial', lejos_de_los_admitidos: 'lejos de los admitidos',
};

/** Formulario para abrir la asistencia con las medidas anti-trampa (compartido con la pestaña de la sección). */
function AbrirAsistencia({ classId, onAbierta }: { classId: string; onAbierta: (id: string) => void }) {
  const [minutos, setMinutos] = useState(15);
  const [rotar, setRotar] = useState(30);
  const [verificar, setVerificar] = useState(true);
  const [radio, setRadio] = useState(100);
  const [paso, setPaso] = useState<string | null>(null);
  const accion = useAction();
  async function abrir() {
    await accion.run(async () => {
      let ubic = null;
      if (verificar) {
        setPaso('Obteniendo su ubicación…');
        const r = await ubicacionActual();
        if (!r.ubicacion) throw new Error(`${r.motivo} Sin su ubicación no se puede verificar la de los estudiantes; desmarque «Verificar ubicación» si quiere abrir igualmente.`);
        if (r.ubicacion.accuracy > PRECISION_PROFESOR && !window.confirm(avisoPrecision(r.ubicacion.accuracy))) return;
        ubic = r.ubicacion;
      }
      setPaso('Abriendo…');
      const r = await iniciarAsistencia(classId, { minutos, rotar, ubicacion: ubic, exigirUbicacion: verificar, radio });
      onAbierta(r.id);
    }).finally(() => setPaso(null));
  }
  return (
    <div className="space-y-2 text-sm">
      <ErrorBox error={accion.error} />
      <div className="flex flex-wrap items-end gap-3">
        <label>Abierta durante
          <select className="campo !w-auto" value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
            {[5, 10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
          </select>
        </label>
        <label>El código cambia
          <select className="campo !w-auto" value={rotar} onChange={(e) => setRotar(Number(e.target.value))}>
            <option value={15}>cada 15 s</option><option value={30}>cada 30 s (recomendado)</option><option value={60}>cada minuto</option><option value={0}>nunca (código fijo)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" checked={verificar} onChange={(e) => setVerificar(e.target.checked)} /> Verificar ubicación</label>
        {verificar && (
          <label>Radio del aula
            <select className="campo !w-auto" value={radio} onChange={(e) => setRadio(Number(e.target.value))}>
              {[50, 100, 150, 250, 500].map((m) => <option key={m} value={m}>{m} m</option>)}
            </select>
          </label>
        )}
        <button className="btn-primario" disabled={accion.busy} onClick={() => void abrir()}>{paso ?? 'Abrir asistencia'}</button>
      </div>
      <p className="text-xs text-gray-500">
        Muestre el código en la pantalla o proyector (mejor desde Orbe Control). Con <strong>código rotativo</strong>, quien lo reciba por mensaje fuera del aula probablemente llegue tarde;
        con <strong>verificar ubicación</strong>, el servidor compara la ubicación de cada estudiante con la de este dispositivo y rechaza a quien esté fuera del radio; además,
        <strong> un dispositivo no puede marcar a dos estudiantes</strong>. Verá la verificación de cada presente y los intentos rechazados.
        Ninguna medida es infalible (la ubicación del navegador puede falsearse con conocimientos técnicos), pero juntas impiden lo habitual.
      </p>
    </div>
  );
}

export function TabAsistencia({ classId, nombre }: { classId: string; nombre: string }) {
  const inf = useAsync(() => informeAsistencia(classId), [classId]);
  const [activa, setActiva] = useState<string | null>(null);
  const accion = useAction();
  const abierta = inf.data?.sesiones.find((s) => !s.closed_at);
  useEffect(() => { if (abierta && !activa) setActiva(abierta.id); }, [abierta, activa]);

  function exportar() {
    const ses = [...(inf.data?.sesiones ?? [])].reverse();
    const filas = (inf.data?.estudiantes ?? []).map((e) => [e.full_name, e.student_code, ...ses.map((s) => (e.sesiones ?? []).includes(s.id) ? 'P' : 'A'), e.presentes, ses.length, porcentajeAsistencia(e.presentes, ses.length)]);
    const url = URL.createObjectURL(new Blob([aCsv([['Estudiante', 'Matrícula', ...ses.map((s) => fecha(s.opened_at)), 'Presentes', 'Clases', '% asistencia'], ...filas])], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia-${nombre.replace(/\W+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <ErrorBox error={inf.error || accion.error} />
      <Card title="Pasar lista con código">
        {activa ? <EnVivo id={activa} onCerrada={() => void inf.reload()} /> : <AbrirAsistencia classId={classId} onAbierta={(id) => { setActiva(id); void inf.reload(); }} />}
        {activa && <button className="btn-secundario mt-3 text-xs" onClick={() => { setActiva(null); void inf.reload(); }}>Volver al historial</button>}
      </Card>
      <Card title="Asistencia autónoma por quórum de proximidad">
        <ConfigQuorum classId={classId} />
      </Card>
      {inf.data && inf.data.sesiones.length > 0 && (() => {
        const n = inf.data.sesiones.length;
        const pcts = inf.data.estudiantes.map((e) => porcentajeAsistencia(e.presentes, n) ?? 0);
        const media = pcts.length ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length) : 0;
        const bajos = inf.data.estudiantes.filter((e) => (porcentajeAsistencia(e.presentes, n) ?? 0) < UMBRAL_ASISTENCIA);
        const ultima = inf.data.sesiones[0];
        return (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="tarjeta !p-3"><p className="text-xs text-gray-500">Clases con lista pasada</p><p className="font-serif text-2xl font-semibold">{n}</p></div>
            <div className="tarjeta !p-3"><p className="text-xs text-gray-500">Asistencia media</p><p className="font-serif text-2xl font-semibold"><Badge tone={tonoAsistencia(media)}>{media} %</Badge></p></div>
            <div className="tarjeta !p-3"><p className="text-xs text-gray-500">Por debajo del {UMBRAL_ASISTENCIA} %</p><p className="font-serif text-2xl font-semibold">{bajos.length}<span className="text-sm text-gray-500"> de {inf.data.estudiantes.length}</span></p>
              {bajos.length > 0 && <p className="text-xs text-gray-500">{bajos.slice(0, 4).map((e) => e.full_name.split(' ')[0]).join(', ')}{bajos.length > 4 ? '…' : ''}</p>}</div>
            <div className="tarjeta !p-3"><p className="text-xs text-gray-500">Última clase ({fecha(ultima.opened_at)})</p><p className="font-serif text-2xl font-semibold">{ultima.presentes}<span className="text-sm text-gray-500"> / {inf.data.estudiantes.length} presentes</span></p></div>
          </div>
        );
      })()}
      <Card title={`Historial · ${inf.data?.sesiones.length ?? 0} clases`} actions={<button className="btn-secundario !py-1 text-xs" onClick={exportar} disabled={!inf.data?.sesiones.length}>Exportar CSV</button>}>
        {inf.loading ? <Spinner /> : !inf.data?.sesiones.length ? <p className="text-sm text-gray-500">Aún no se ha pasado lista.</p> : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1 pr-3">Estudiante</th><th className="pr-3 text-right">Total</th>
                {inf.data.sesiones.map((s) => <th key={s.id} className="px-1 text-center font-normal"><button className="enlace" onClick={() => setActiva(s.id)} title="Abrir y corregir">{new Date(s.opened_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}</button></th>)}
              </tr></thead>
              <tbody>
                {inf.data.estudiantes.map((e) => (
                  <tr key={e.user_id} className="border-b border-gray-100 dark:border-white/5">
                    <td className="py-1 pr-3"><Link className="enlace" to={`/docente/estudiantes/${e.user_id}`}>{e.full_name || e.student_code}</Link></td>
                    <td className="whitespace-nowrap pr-3 text-right tabular-nums">{e.presentes}/{inf.data!.sesiones.length} <Badge tone={tonoAsistencia(porcentajeAsistencia(e.presentes, inf.data!.sesiones.length))}>{porcentajeAsistencia(e.presentes, inf.data!.sesiones.length)} %</Badge></td>
                    {inf.data!.sesiones.map((s) => <td key={s.id} className="px-1 text-center">{(e.sesiones ?? []).includes(s.id) ? <Badge tone="green">P</Badge> : <span className="text-red-500">A</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
