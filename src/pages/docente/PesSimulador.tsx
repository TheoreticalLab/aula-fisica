/**
 * Simulador docente de una PES (prueba piloto académica): el profesor abre la práctica como estudiante de prueba
 * (también en borrador) con la MISMA pantalla y el mismo servidor que un estudiante; puede adelantar su reloj, simular
 * cortes de red, inspeccionar la calificación de cada apartado, lanzar las sondas REST no autorizadas, ver el informe de
 * tiempos y reiniciar. Nada de esto cuenta en listas ni puntuaciones reales.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router-dom';
import {
  API_PES, CLIENTE_SONDAS, pesDetalle, pesInformeTiempos, pesPilotoAdelantar, pesPilotoDetalle, pesPilotoIniciar, pesPilotoReiniciar, pesPilotoResumen,
  type ResumenPes,
} from '@/api/pes';
import { compararTiempos } from '@/lib/pes';
import { SesionPes, type EstadoSesion } from '@/lib/pesSesion';
import { conRed, type ModoRed, type Red } from '@/lib/pesRed';
import { ejecutarSondas, type ResultadoSonda } from '@/lib/pesSondas';
import { almacenLocal } from '@/lib/examen/guardado';
import { fmtDuracion } from '@/lib/pesMonitor';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { Apartado, Condiciones, Final, puntos } from '@/pages/estudiante/PracticaExtraordinaria';
import { TABLA } from './PesTab';

export default function PesSimulador() {
  const { practicaId = '' } = useParams();
  const det = useAsync(() => pesDetalle(practicaId), [practicaId]);
  const resumen = useAsync(() => pesPilotoResumen(practicaId), [practicaId]);
  const act = useAction();
  if ((det.loading && !det.data) || (resumen.loading && resumen.data === undefined)) return <Spinner />;
  if (det.error) return <ErrorBox error={det.error} />;
  const p = det.data!.practica;
  return (
    <div className="space-y-4">
      <PageTitle title={`Simulador · ${p.titulo}`} subtitle="Prueba piloto como estudiante de prueba: no cuenta en listas, puntuaciones ni monitor"
        back={{ to: `/docente/pes/${p.id}`, label: 'Editor de la práctica' }} />
      {!resumen.data ? (
        <Card>
          <p className="text-sm">Abrirá la práctica {p.estado === 'borrador' ? '(en borrador) ' : ''}con la misma pantalla, los mismos tiempos y la misma calificación que un estudiante.</p>
          <button type="button" className="btn-primario mt-3" disabled={act.busy} onClick={async () => { if ((await act.run(() => pesPilotoIniciar(practicaId))) !== undefined) await resumen.reload(); }}>
            Abrir como estudiante de prueba</button>
          <ErrorBox error={act.error} />
        </Card>
      ) : <Sesion practica={practicaId} r={resumen.data} recargarResumen={resumen.reload} detalle={det.data!} />}
    </div>
  );
}

function Sesion({ practica, r, recargarResumen, detalle }: { practica: string; r: ResumenPes; recargarResumen: () => Promise<void>; detalle: NonNullable<Awaited<ReturnType<typeof pesDetalle>>> }) {
  const red = useRef<Red>({ modo: 'ok' });
  const [modo, setModo] = useState<ModoRed>('ok');
  const [version, setVersion] = useState(0);              // nueva sesión tras reiniciar
  const ses = useMemo(() => new SesionPes(practica, {
    api: conRed(API_PES, red.current), almacen: almacenLocal(), reloj: () => Date.now(), nuevoId: () => crypto.randomUUID(),
  }), [practica, version]);
  const e: EstadoSesion = useSyncExternalStore((f) => ses.suscribir(() => f()), () => ses.e);
  const notas = useAsync(() => pesPilotoDetalle(practica), [practica, e.vista?.cerrados, e.fase, version]);
  const act = useAction();
  const [sondas, setSondas] = useState<ResultadoSonda[] | null>(null);
  useEffect(() => { void ses.cargar(); return () => ses.detener(); }, [ses]);
  useEffect(() => { red.current.modo = modo; }, [modo]);

  const adelantar = async (s: number) => { if ((await act.run(() => pesPilotoAdelantar(practica, s))) !== undefined) await ses.cargar(); };
  const aps = detalle.ejercicios.flatMap((x) => x.apartados);
  const abierto = e.vista?.apartado?.id ?? null;
  const iAbierto = aps.findIndex((b) => b.id === abierto);
  const futuro = (iAbierto >= 0 ? aps[iAbierto + 1]?.id : aps[0]?.id) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        {e.fase === 'cargando' && <Spinner />}
        {e.fase === 'error' && <ErrorBox error={e.error} onRetry={() => ses.cargar()} />}
        {e.fase === 'condiciones' && <Condiciones r={r} onAceptar={() => ses.iniciar()} error={e.error} />}
        {e.fase === 'apartado' && <Apartado ses={ses} e={e} practica={practica} />}
        {e.fase === 'esperando' && <Notice>Esperando la liberación del ejercicio {e.vista?.proximo_ejercicio} ({e.vista?.disponible_desde}).</Notice>}
        {(e.fase === 'completada' || e.fase === 'vencida') && <Final r={{ ...r, resultado: notas.data?.puntaje ?? r.resultado }} e={e} />}
      </div>
      <aside className="space-y-3">
        <Card title="Controles del simulador">
          <div className="space-y-2 text-sm">
            <label className="block">Red simulada
              <select className="campo" value={modo} onChange={(x) => setModo(x.target.value as ModoRed)}>
                <option value="ok">Normal</option>
                <option value="antes">Sin conexión (la petición no llega)</option>
                <option value="despues">Se pierde la respuesta (llega y se aplica)</option>
              </select>
            </label>
            {modo !== 'ok' && <p className="text-xs text-amber-700">Pruebe a confirmar: la decisión queda en el dispositivo. Vuelva a «Normal» y pulse «Reintentar ahora» o recargue.</p>}
            <div className="flex flex-wrap gap-1">
              <span className="w-full text-xs text-gray-500">Adelantar mi reloj en el apartado abierto (solo el simulador):</span>
              {[60, 300].map((s) => <button key={s} type="button" className="btn-secundario px-2" disabled={e.fase !== 'apartado' || act.busy} onClick={() => adelantar(s)}>+{s / 60} min</button>)}
              <button type="button" className="btn-secundario px-2" disabled={e.fase !== 'apartado' || act.busy || ses.faltaMinimoS() <= 0}
                onClick={() => adelantar(Math.ceil(ses.faltaMinimoS()) + 1)}>Hasta la espera mínima</button>
            </div>
            <button type="button" className="btn-secundario w-full" disabled={act.busy} onClick={async () => {
              if (!confirm('¿Reiniciar el simulador? Se borran sus respuestas de prueba.')) return;
              if ((await act.run(() => pesPilotoReiniciar(practica))) !== undefined) { await recargarResumen(); setSondas(null); setVersion((v) => v + 1); }
            }}>Reiniciar desde el principio</button>
            <ErrorBox error={act.error} />
          </div>
        </Card>
        <Card title="Calificación de cada apartado">
          {!notas.data || notas.data.respuestas.length === 0 ? <p className="text-sm text-gray-500">Aún no ha cerrado apartados.</p> : (
            <>
              <table className={TABLA}>
                <thead><tr><th /><th>Resultado</th><th>m</th><th>q</th><th>Tiempo</th></tr></thead>
                <tbody>{notas.data.respuestas.map((x) => (
                  <tr key={`${x.ejercicio}${x.letra}`}><td>{x.ejercicio}{x.letra}</td>
                    <td>{x.accion === 'omitida' ? 'omitido' : x.revision === 'pendiente' ? 'por revisar' : x.estado ?? '—'}</td>
                    <td>{Number(x.m)}</td><td>{Number(x.q).toFixed(2)}</td>
                    <td>{Math.round(Number(x.segundos))} s{x.adelantado && <Badge tone="amber">adelantado</Badge>}</td></tr>
                ))}</tbody>
              </table>
              <p className="mt-2 text-sm">Provisional {puntos(notas.data.puntaje.provisional.P)} · máxima {puntos(notas.data.puntaje.maxima_alcanzable.P)}</p>
            </>
          )}
        </Card>
        <Card title="Sondas REST no autorizadas">
          <p className="text-xs text-gray-500">Intenta, con su sesión, leer tablas privadas, llamar funciones internas y responder apartados futuros. Todas deben ser rechazadas y la vista no debe contener datos privados. No cambian el estado.</p>
          <button type="button" className="btn-secundario mt-2 w-full" disabled={e.fase === 'condiciones' || act.busy} onClick={async () => {
            const res = await act.run(() => ejecutarSondas(CLIENTE_SONDAS, {
              practica, apartadoFuturo: futuro,
              secretos: aps.flatMap((a) => [a.rubrica, a.explicacion, ...(a.id === abierto ? [] : [a.enunciado])]).filter(Boolean),
            }));
            if (res) setSondas(res);
          }}>Ejecutar las sondas</button>
          {sondas && (
            <>
              <p className={`mt-2 text-sm font-semibold ${sondas.every((x) => x.ok) ? 'text-emerald-700' : 'text-red-700'}`}>{sondas.filter((x) => x.ok).length} de {sondas.length} correctas</p>
              <ul className="mt-1 space-y-1 text-xs">{sondas.map((x) => <li key={x.nombre}>{x.ok ? '✔' : '✖'} {x.nombre}: {x.obtenido}</li>)}</ul>
            </>
          )}
        </Card>
        <InformeTiempos practica={practica} />
      </aside>
    </div>
  );
}

function InformeTiempos({ practica }: { practica: string }) {
  const inf = useAsync(() => pesInformeTiempos(practica), [practica]);
  if (!inf.data) return null;
  const r = compararTiempos(inf.data.apartados.map((a) => ({ etiqueta: `${a.ejercicio}${a.letra}`, t_ref_s: a.t_ref_s, t_min_s: Number(a.t_min_s),
    calibraciones: a.calibraciones.map((c) => Number(c.segundos)), piloto_s: a.piloto_s === null ? null : Number(a.piloto_s) })));
  return (
    <Card title="Tiempo esperado frente a espera impuesta">
      <p className="text-sm">Resolución independiente esperada: <strong>{fmtDuracion(r.esperadoS)}</strong><br />Espera impuesta para crédito completo: <strong>{fmtDuracion(r.impuestoS)}</strong>
        {r.esperadoS > 0 && <> (× {(r.impuestoS / r.esperadoS).toFixed(2).replace('.', ',')})</>}</p>
      <p className="mt-1 text-xs text-gray-500">«Esperado» usa la mediana de los tiempos medidos o, sin mediciones, el T_ref. Registre tiempos en el editor → Carga temporal.</p>
      <ul className="mt-2 space-y-1 text-xs">{r.avisos.slice(0, 6).map((a, i) => <li key={i}>{a.nivel === 'aviso' ? '⚠️ ' : ''}{a.texto}</li>)}</ul>
    </Card>
  );
}
