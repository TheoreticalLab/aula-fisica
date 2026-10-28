/**
 * LIEIA · Cronología interactiva del proceso de respuesta de un intento (telemetría). Un carril por pregunta con
 * primera vista, primera interacción, primera entrada no vacía, cambios, borrados, última modificación y envío;
 * franjas de página oculta, inactividad y sin conexión; tabla comparativa y calidad de los datos.
 * Una espera, por larga que sea, no es prueba de nada: el panel lo dice expresamente.
 */
import { useMemo, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { reconstruir, type EventoCrudo, type ProcesoIntento } from '@/lib/lieia/proceso';
import { formatoDuracion } from '@/lib/tiempo';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';
import { useTema } from './graficos';

export interface ItemCronologia { exercise_id: string; titulo: string; dificultad?: string; b?: number | null }
interface DatosTelemetria { intento: { id: string; inicio: string; entrega: string | null; estado: string; modo: string }; items: ItemCronologia[]; eventos: EventoCrudo[] }

const fmt = (s: number | null | undefined) => (s === null || s === undefined ? '—' : formatoDuracion(s));
const COLOR_INTERVALO = { oculta: '#94a3b8', inactiva: '#fcd34d', sin_conexion: '#f87171' } as const;

export function CronologiaIntento({ p, items, comparacion }: { p: ProcesoIntento; items: ItemCronologia[]; comparacion?: Map<string, { latencia: number | null; persistencia: number | null }> }) {
  const t = useTema();
  const [hover, setHover] = useState<string | null>(null);
  const fin = Math.max(p.envio ?? 0, ...p.linea.map((x) => x.t), 1);
  const W = 760, L = 150, alto = 22, H = items.length * alto + 46;
  const x = (s: number) => L + ((W - L - 10) * Math.max(0, s)) / fin;
  const recargas = p.linea.filter((e) => e.k === 'sesion_inicio' && e.d.navegacion === 'reload');
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg width={W} height={H} role="img" aria-label="Cronología del intento por pregunta" className="max-w-full">
          {p.intervalos.map((iv, k) => (
            <rect key={k} x={x(iv.desde)} y={18} width={Math.max(1, x(iv.hasta) - x(iv.desde))} height={H - 36} fill={COLOR_INTERVALO[iv.tipo]} fillOpacity={0.25}>
              <title>{`${iv.tipo === 'oculta' ? 'Página oculta o sin registro' : iv.tipo === 'inactiva' ? 'Sin actividad' : 'Sin conexión'}: ${fmt(iv.hasta - iv.desde)}`}</title>
            </rect>
          ))}
          {Array.from({ length: 6 }, (_, k) => (k * fin) / 5).map((s) => (
            <g key={s}><line x1={x(s)} x2={x(s)} y1={14} y2={H - 18} stroke={t.rejilla} /><text x={x(s)} y={H - 4} fontSize={9} textAnchor="middle" fill={t.texto}>{fmt(s)}</text></g>
          ))}
          {recargas.map((r, k) => <g key={k}><line x1={x(r.t)} x2={x(r.t)} y1={10} y2={H - 18} stroke={t.color('d4')} strokeDasharray="3 2" /><text x={x(r.t) + 2} y={10} fontSize={8} fill={t.color('d4')}>recarga</text></g>)}
          {items.map((it, k) => {
            const pi = p.items.find((y) => y.exercise_id === it.exercise_id);
            const y = 26 + k * alto;
            return (
              <g key={it.exercise_id} onMouseEnter={() => setHover(it.exercise_id)} onMouseLeave={() => setHover(null)} opacity={hover && hover !== it.exercise_id ? 0.35 : 1}>
                <text x={L - 6} y={y + 4} fontSize={10} textAnchor="end" fill={t.texto}>{`P${k + 1} ${it.titulo.slice(0, 18)}`}</text>
                <line x1={L} x2={W - 10} y1={y} y2={y} stroke={t.rejilla} />
                {pi?.vista !== null && pi?.vista !== undefined && pi.primeraNoVacia !== null && <line x1={x(pi.vista)} x2={x(pi.primeraNoVacia)} y1={y} y2={y} stroke={t.color('d1')} strokeWidth={3} strokeOpacity={0.35} />}
                {pi?.ultimaEdicion !== null && pi?.ultimaEdicion !== undefined && p.envio !== null && <line x1={x(pi.ultimaEdicion)} x2={x(p.envio)} y1={y} y2={y} stroke={t.texto} strokeDasharray="2 3" strokeOpacity={0.4} />}
                {p.linea.filter((e) => e.e === it.exercise_id && e.k === 'pregunta_vista' && e.d.visible === true).map((e, j) => <circle key={`v${j}`} cx={x(e.t)} cy={y} r={3} fill="none" stroke={t.color('d1')}><title>{`Vista ${fmt(e.t)}`}</title></circle>)}
                {pi?.interaccion !== null && pi?.interaccion !== undefined && <rect x={x(pi.interaccion) - 2} y={y - 2} width={4} height={4} fill={t.color('d3')}><title>{`Primera interacción ${fmt(pi.interaccion)}`}</title></rect>}
                {pi?.rafagas.map((r, j) => (
                  <g key={`r${j}`}>
                    <rect x={x(r.inicio)} y={y - 4} width={Math.max(2, x(r.t) - x(r.inicio))} height={8} rx={2} fill={r.borrado ? '#dc2626' : r.delta >= 15 && r.dur <= 0.3 ? t.color('d5') : t.color('d6')}>
                      <title>{`${r.borrado ? 'Borrado' : j === 0 ? 'Primera entrada no vacía' : 'Cambio'} ${fmt(r.inicio)} · ráfaga ${r.dur.toFixed(1)} s · longitud ${r.len} (${r.delta >= 0 ? '+' : ''}${r.delta})${r.delta >= 15 && r.dur <= 0.3 ? ' · aparición de golpe' : ''}`}</title>
                    </rect>
                  </g>
                ))}
              </g>
            );
          })}
          {p.envio !== null && <g><line x1={x(p.envio)} x2={x(p.envio)} y1={14} y2={H - 18} stroke="#dc2626" strokeWidth={2} /><text x={x(p.envio) - 3} y={12} fontSize={9} textAnchor="end" fill="#dc2626">envío</text></g>}
        </svg>
      </div>
      <p className="text-xs text-gray-500">○ vista · ■ primera interacción · barra azul tenue: de la primera vista a la primera respuesta · bloques: ráfagas de edición (verde) · rojo: borrado · rosa: aparición de golpe · línea punteada: tiempo desde la última modificación hasta el envío · franjas: gris = página oculta o sin registro, amarillo = sin actividad, rojo = sin conexión.</p>

      <div className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[['Cronológico', fmt(p.cronologico)], ['Activo', fmt(p.activo)], ['Página oculta', fmt(p.oculto)], ['Sin actividad', fmt(p.inactivo)], ['Sin conexión', fmt(p.sinConexion)], ['Tras la última modificación', `${fmt(p.esperaFinal)}${p.esperaFinalInactiva ? ` (${fmt(p.esperaFinalInactiva)} inactivo/oculto)` : ''}`]].map(([k, v]) => (
          <div key={k} className="tarjeta !p-2"><p className="text-xs text-gray-500">{k}</p><p className="font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs dark:border-white/10">
            <th className="py-1">Pregunta</th><th className="text-right">Primera vista</th><th className="text-right">Hasta responder</th><th className="text-right">Edición</th><th className="text-right">Cambios / borrados</th>
            <th className="text-right">Tiempo activo</th><th className="text-right">Antes del envío</th><th className="text-right">Revisitas</th><th>Notas</th>
          </tr></thead>
          <tbody>{items.map((it, k) => {
            const pi = p.items.find((y) => y.exercise_id === it.exercise_id);
            const c = comparacion?.get(it.exercise_id);
            return (
              <tr key={it.exercise_id} className={`border-b border-gray-100 dark:border-white/5 ${hover === it.exercise_id ? 'bg-primario-50 dark:bg-white/5' : ''}`} onMouseEnter={() => setHover(it.exercise_id)} onMouseLeave={() => setHover(null)}>
                <td className="py-1 text-xs">P{k + 1} {it.titulo.slice(0, 40)}{it.dificultad ? <span className="block text-gray-500">{it.dificultad}{it.b !== null && it.b !== undefined ? ` · b ${it.b.toFixed(2)}` : ''}</span> : null}</td>
                <td className="text-right tabular-nums">{fmt(pi?.vista)}</td>
                <td className="text-right tabular-nums">{fmt(pi?.latenciaGeneracion)}{c?.latencia !== null && c?.latencia !== undefined && <span className="block text-xs text-gray-500">sección: {fmt(c.latencia)}</span>}</td>
                <td className="text-right tabular-nums">{fmt(pi?.tiempoEdicion)}</td>
                <td className="text-right tabular-nums">{pi?.cambios ?? 0} / {pi?.borrados ?? 0}</td>
                <td className="text-right tabular-nums">{fmt(pi?.activo)}</td>
                <td className="text-right tabular-nums">{fmt(pi?.persistencia)}{c?.persistencia !== null && c?.persistencia !== undefined && <span className="block text-xs text-gray-500">sección: {fmt(c.persistencia)}</span>}</td>
                <td className="text-right tabular-nums">{pi?.revisitas ?? 0}</td>
                <td className="text-xs">{pi?.sinGuardar && <Badge tone="amber">escrita sin guardar</Badge>} {pi && pi.pegados > 0 && <Badge>{pi.pegados} de golpe</Badge>} {!pi?.vista && <Badge>sin vista registrada</Badge>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>

      <div className="rounded-lg border border-gray-200 p-3 text-xs dark:border-white/10">
        <p className="mb-1 font-semibold">Calidad y límites de los datos</p>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>{p.calidad.eventos} eventos en {p.calidad.sesiones} sesión(es){p.calidad.recargas ? `, ${p.calidad.recargas} recarga(s)` : ''}. Perdidos detectables (huecos de secuencia): {p.calidad.perdidos}. Llegados con más de 30 s de retraso: {p.calidad.tardios}.</li>
          <li>Reloj del dispositivo frente al del servidor: {p.calidad.desfaseRelojS === null ? 'sin dato' : `${p.calidad.desfaseRelojS.toFixed(0)} s`} (las horas mostradas usan el reloj monotónico de cada sesión anclado al servidor; error típico: la latencia de la red).</li>
          <li>Los eventos del navegador pueden perderse, retrasarse o manipularse, y no se registra nada fuera del aula. Una espera larga, un cambio de pestaña o una respuesta pegada tienen explicaciones legítimas: <strong>no prueban nada por sí solos</strong>.</li>
        </ul>
      </div>
    </div>
  );
}

/** Carga la telemetría de un intento y muestra su cronología (profesorado; consulta auditada). */
export function CronologiaDeIntento({ attemptId }: { attemptId: string }) {
  const st = useAsync(() => rpc<DatosTelemetria>('telemetry_attempt', { p_attempt: attemptId }), [attemptId]);
  const p = useMemo(() => {
    if (!st.data) return null;
    const d = st.data;
    return reconstruir(d.eventos, new Date(d.intento.inicio).getTime() / 1000, d.intento.entrega ? new Date(d.intento.entrega).getTime() / 1000 : null, d.items.map((i) => i.exercise_id));
  }, [st.data]);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} />;
  if (!st.data?.eventos.length || !p) return <Notice>Este intento no tiene telemetría del proceso (se registra desde su activación).</Notice>;
  return <CronologiaIntento p={p} items={st.data.items} />;
}

export function TarjetaCronologia({ attemptId }: { attemptId: string }) {
  return <Card title="Proceso de respuesta (telemetría)"><CronologiaDeIntento attemptId={attemptId} /></Card>;
}
