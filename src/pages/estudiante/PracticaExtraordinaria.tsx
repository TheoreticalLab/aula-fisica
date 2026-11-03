/**
 * Práctica Extraordinaria Secuencial · pantalla del estudiante.
 * Condiciones (con aceptación registrada) → un solo apartado a la vista → confirmar (o avanzar antes de tiempo con
 * reducción, u omitir) → el siguiente. Todo lo decide el servidor; la sesión (lib/pesSesion) guarda, reintenta y
 * recupera tras recargas o cortes de red.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import { sustituirParametros, tieneParametros } from '@calif/marcadores.ts';
import { API_PES, type ApartadoVisible, type PuntajeServidor, type ResumenPes } from '@/api/pes';
import type { AttemptItem, Figure } from '@/api/tipos';
import { AVISO_OMITIR, AVISO_PEGADO, avisoAnticipado } from '@/lib/pes';
import { SesionPes, respuestaVacia, type EstadoSesion } from '@/lib/pesSesion';
import { almacenLocal } from '@/lib/examen/guardado';
import { formatoCuenta } from '@/lib/examen/reloj';
import { fecha, useAsync } from '@/lib/util';
import { EntradaRespuesta } from '@/components/Ejercicio';
import { BarreraPegado } from '@/components/BarreraPegado';
import { Markdown } from '@/components/Markdown';
import { Figura } from '@/components/Grafica';
import { Badge, ErrorBox, Modal, Notice, PageTitle, ProgressBar, Spinner } from '@/components/ui';
import { useModoConcentracion } from '@/components/Layout';

const ETAPA: Record<string, string> = {
  prediccion: 'Predicción', formulacion: 'Formulación', resolucion: 'Resolución', interpretacion: 'Interpretación', transferencia: 'Transferencia', otra: '',
};
/** Dos decimales, redondeo a la mitad hacia arriba (2,025 → 2,03; toFixed daría 2,02 por la representación binaria). */
export const puntos = (x: number) => (Math.round(x * 100 + 1e-7) / 100).toFixed(2).replace('.', ',');

function useSesion(s: SesionPes): EstadoSesion {
  return useSyncExternalStore((f) => s.suscribir(() => f()), () => s.e);
}

/** El apartado con la forma que espera la entrada de respuestas del aula (solo usa id, formato, opciones y unidad). */
const comoEjercicio = (a: ApartadoVisible) => ({
  id: a.id, format: a.formato, options: a.opciones, multiple: a.multiple, unit_hint: a.unidad_sugerida, prompt: a.enunciado, figure: null,
}) as unknown as AttemptItem['exercise'];

export default function PracticaExtraordinaria() {
  const { practicaId = '' } = useParams();
  const resumen = useAsync(() => API_PES.misPracticas().then((xs) => xs.find((x) => x.id === practicaId) ?? null), [practicaId]);
  const ses = useMemo(() => new SesionPes(practicaId, {
    api: API_PES, almacen: almacenLocal(), reloj: () => Date.now(), nuevoId: () => crypto.randomUUID(),
  }), [practicaId]);
  const e = useSesion(ses);
  useModoConcentracion(e.fase === 'apartado');

  useEffect(() => {
    void ses.cargar();
    const enLinea = () => { ses.registrar('reconexion'); void ses.reconectado(); };
    const oculta = () => { if (document.visibilityState === 'hidden') void ses.guardar(); };
    window.addEventListener('online', enLinea);
    document.addEventListener('visibilitychange', oculta);
    return () => { window.removeEventListener('online', enLinea); document.removeEventListener('visibilitychange', oculta); ses.detener(); };
  }, [ses]);
  // al terminar, los datos de la lista (resultados publicados) pueden haber cambiado
  useEffect(() => { if (e.fase === 'completada' || e.fase === 'vencida') void resumen.reload(); }, [e.fase]); // eslint-disable-line react-hooks/exhaustive-deps

  if ((e.fase === 'cargando' && !e.error) || (resumen.loading && !resumen.data)) return <Spinner />;
  if (resumen.error) return <ErrorBox error={resumen.error} onRetry={resumen.reload} />;
  const r = resumen.data;
  if (!r) return <ErrorBox error="No tiene asignada esta práctica." />;
  if (e.fase === 'error') return <ErrorBox error={e.error} onRetry={() => ses.cargar()} />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle title={r.titulo} subtitle="Práctica extraordinaria secuencial" back={{ to: '/evaluaciones', label: 'Evaluaciones' }} />
      {e.fase === 'condiciones' && <Condiciones r={r} onAceptar={() => ses.iniciar()} error={e.error} />}
      {e.fase === 'apartado' && <Apartado ses={ses} e={e} practica={practicaId} />}
      {e.fase === 'esperando' && (
        <Notice>El siguiente bloque (ejercicio {e.vista?.proximo_ejercicio}) se libera el {e.vista?.disponible_desde ? fecha(`${e.vista.disponible_desde}T12:00:00`) : '—'}.
          Lo que ya respondió está guardado. Vuelva ese día para continuar.</Notice>
      )}
      {(e.fase === 'completada' || e.fase === 'vencida') && <Final r={r} e={e} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
export function Condiciones({ r, onAceptar, error }: { r: ResumenPes; onAceptar: () => Promise<unknown>; error: string | null }) {
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const pct = Math.round(r.factor_anticipado * 100);
  return (
    <section className="tarjeta space-y-4">
      {r.descripcion && <Markdown>{r.descripcion}</Markdown>}
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div><span className="text-gray-500">Contenido</span><br />{r.ejercicios} ejercicios · {r.apartados} apartados</div>
        <div><span className="text-gray-500">Tiempo estimado de trabajo</span><br />≈ {r.minutos_referencia} min</div>
        <div><span className="text-gray-500">Fecha límite</span><br />{fecha(r.cierre)}{r.tiempo_extra_min > 0 && <> (incluye {r.tiempo_extra_min} min adicionales)</>}</div>
      </div>
      <div>
        <h2 className="mb-1 font-semibold">Condiciones</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Los apartados se muestran <strong>de uno en uno</strong> y en orden. No puede ver los siguientes ni volver a los anteriores.</li>
          <li>Cada respuesta que confirme es <strong>definitiva</strong>. El tiempo de cada apartado empieza cuando se muestra.</li>
          <li>Cada apartado tiene una <strong>espera mínima</strong> (un 20 % más que su tiempo de referencia{r.factor_espera < 1 ? ', reducida por su adaptación' : ''}).
            Si confirma antes, la puntuación obtenible en ese apartado se reduce al {pct}%: se le pedirá que lo acepte.</li>
          <li><strong>Omitir</strong> un apartado es definitivo y vale 0.</li>
          <li>{r.pegado_permitido ? 'Tiene autorizada la adaptación de pegado: puede pegar y arrastrar texto en sus respuestas.' : AVISO_PEGADO}</li>
          <li>Su trabajo se guarda solo: si recarga la página o pierde la conexión, continúa donde estaba y ninguna decisión se aplica dos veces.
            Si un problema técnico persiste, avise a su profesor indicando el ejercicio y el apartado: el servidor registra cada paso y se puede revisar.</li>
          <li>La puntuación es informativa (máximo {puntos(r.p_max)}) y la publica su profesor: P = {puntos(r.p_max)} · (S/N)<sup>{String(r.alfa).replace('.', ',')}</sup> · F,
            donde S es el dominio acumulado (cada ejercicio vale hasta 1), N el número de ejercicios y F la parte obtenida a tiempo. Dominar la mitad da la cuarta parte.</li>
          {r.control_politica?.descripcion && (
            <li><strong>Control presencial:</strong> {r.control_politica.descripcion}{' '}
              {r.control_politica.modo === 'ajuste'
                ? `Efecto anunciado: su puntuación se multiplica por 1 − ${String(r.control_politica.peso).replace('.', ',')} × (1 − C), con C el mejor resultado del control (de 0 a 1).`
                : 'Es informativo: no cambia la puntuación.'}</li>
          )}
          <li>Las respuestas deben ser de su autoría. Si recibió ayuda de otra persona o de una herramienta externa, decláreselo a su profesor.</li>
        </ul>
      </div>
      {r.instrucciones && <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/5"><Markdown>{r.instrucciones}</Markdown></div>}
      {r.estado_practica !== 'publicada' ? <Notice tone="warn">La práctica está cerrada.</Notice> : (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={acepto} onChange={(x) => setAcepto(x.target.checked)} />
            He leído las condiciones y las acepto.
          </label>
          <ErrorBox error={error} />
          <button type="button" className="btn-primario" disabled={!acepto || enviando}
            onClick={async () => { setEnviando(true); await onAceptar(); setEnviando(false); }}>
            {enviando ? 'Abriendo…' : 'Comenzar'}
          </button>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
function useParametros(practica: string, a: ApartadoVisible | undefined) {
  const [p, setP] = useState<{ id: string; valores: Record<string, number> | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!a?.variante && !tieneParametros(a?.enunciado ?? '')) return;
    let vivo = true;
    API_PES.variante(practica, a!.id).then((v) => vivo && setP({ id: a!.id, valores: v })).catch((x) => vivo && setError(String(x?.message ?? x)));
    return () => { vivo = false; };
  }, [practica, a?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const necesita = !!a && (a.variante || tieneParametros(a.enunciado));
  return { cargando: necesita && p?.id !== a?.id && !error, error, sustituir: (t: string) => (necesita && p?.id === a?.id ? sustituirParametros(t, p.valores) : t) };
}

export function Apartado({ ses, e, practica }: { ses: SesionPes; e: EstadoSesion; practica: string }) {
  const v = e.vista!;
  const a = v.apartado!;
  const [, setTic] = useState(0);
  const [modal, setModal] = useState<null | 'confirmar' | 'anticipar' | 'omitir' | 'vacia'>(null);
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const par = useParametros(practica, a);
  useEffect(() => { const t = setInterval(() => setTic((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setModal(null); setBloqueo(null); }, [a.id]);

  const falta = ses.faltaMinimoS();
  const cierre = ses.faltaCierreS();
  const ocupado = !!e.enviando || !!e.pendiente;
  const pct = Math.round((v.factor_anticipado ?? 0.5) * 100);
  const accion = async (f: () => Promise<string>) => {
    setModal(null);
    const res = await f();
    if (res === 'requiere_anticipar') setModal('anticipar');
    if (res === 'vacia') setModal('vacia');
  };
  const pulsarConfirmar = () => {
    if (respuestaVacia(a.formato, e.respuesta)) setModal('vacia');
    else setModal(falta > 0 ? 'anticipar' : 'confirmar');
  };

  return (
    <section className="space-y-3">
      <ProgressBar value={v.apartados_total ? v.cerrados / v.apartados_total : 0} label={`${v.cerrados} de ${v.apartados_total} apartados cerrados`} />
      <div className="tarjeta space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="blue">Ejercicio {v.ejercicio!.posicion} de {v.ejercicios}</Badge>
          <Badge tone="purple">Apartado {a.letra} de {v.ejercicio!.apartados}</Badge>
          {ETAPA[a.etapa] && <Badge>{ETAPA[a.etapa]}</Badge>}
          <span className="ml-auto text-xs text-gray-500">{e.guardado === 'guardado' ? 'Guardado' : e.guardado === 'guardando' ? 'Guardando…' : e.guardado === 'sin_conexion' ? 'Sin conexión: guardado en este dispositivo' : 'Cambios sin guardar'}</span>
        </div>
        {v.ejercicio!.titulo && <h2 className="font-semibold">{v.ejercicio!.titulo}</h2>}
        {v.ejercicio!.contexto && <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/5"><Markdown>{par.sustituir(v.ejercicio!.contexto)}</Markdown></div>}
        {par.cargando ? <p className="text-sm text-gray-500">Preparando su versión de este apartado…</p> : <Markdown>{par.sustituir(a.enunciado)}</Markdown>}
        {par.error && <p className="text-xs text-red-700 dark:text-red-400">No se pudieron cargar los números de su versión: {par.error}. Recargue la página.</p>}
        {a.figura ? <Figura figure={a.figura as Figure} /> : null}
        <BarreraPegado permitido={!!v.pegado_permitido} onBloqueo={(t) => {
          setBloqueo(t === 'pegado' ? 'Pegar está desactivado en esta práctica: escriba su respuesta.' : 'Arrastrar texto está desactivado en esta práctica: escriba su respuesta.');
          ses.registrar(t === 'pegado' ? 'pegado_bloqueado' : 'arrastre_bloqueado');
        }}>
          <EntradaRespuesta ex={comoEjercicio(a)} answer={e.respuesta} onChange={(x) => ses.editar(x)} disabled={ocupado} />
        </BarreraPegado>
        {bloqueo && <p className="text-xs text-acento-700 dark:text-acento-300" role="status">{bloqueo} Si necesita pegar por una adaptación (p. ej., tecnología de asistencia), pídala a su profesor.</p>}
        {e.mensajes.length > 0 && (
          <Notice tone="warn"><strong>Revise el formato de su respuesta</strong> (el apartado sigue abierto): {e.mensajes.join(' ')}</Notice>
        )}
      </div>

      <div className="tarjeta flex flex-wrap items-center gap-3">
        <div className="flex-1 text-sm" aria-live="polite">
          {falta > 0
            ? <>Espera mínima: <strong className="font-mono">{formatoCuenta(falta * 1000)}</strong>. Antes de ese tiempo, la puntuación obtenible se reduce al {pct}%.</>
            : <span className="text-emerald-700 dark:text-emerald-300">Puede confirmar sin reducción.</span>}
          {cierre !== null && cierre < 86400 && <> · Cierre en <strong className="font-mono">{formatoCuenta(Math.max(0, cierre) * 1000)}</strong></>}
        </div>
        <button type="button" className="btn-secundario" disabled={ocupado} onClick={() => setModal('omitir')}>Omitir apartado</button>
        <button type="button" className="btn-primario" disabled={ocupado} onClick={pulsarConfirmar}>
          {e.enviando ? 'Enviando…' : falta > 0 ? `Confirmar (antes de tiempo: ${pct}%)` : 'Confirmar respuesta'}
        </button>
      </div>
      {e.pendiente && !e.enviando && (
        <Notice tone="warn">
          Su decisión ({e.pendiente.tipo === 'omitir' ? 'omitir' : 'confirmar'} el apartado {a.letra}) quedó guardada en este dispositivo y se enviará al recuperar la conexión.{' '}
          <button type="button" className="enlace" onClick={() => ses.reconectado()}>Reintentar ahora</button>
        </Notice>
      )}
      {e.aviso && !e.pendiente && <Notice>{e.aviso}</Notice>}
      <ErrorBox error={e.error} />

      <Modal open={modal === 'confirmar'} onClose={() => setModal(null)} title="Confirmar respuesta">
        <p className="text-sm">Su respuesta al apartado {a.letra} quedará registrada y no podrá cambiarla. Después verá el siguiente apartado.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secundario" onClick={() => setModal(null)}>Seguir trabajando</button>
          <button type="button" className="btn-primario" onClick={() => accion(() => ses.confirmar())}>Confirmar</button>
        </div>
      </Modal>
      <Modal open={modal === 'anticipar'} onClose={() => setModal(null)} title="Avance anticipado">
        <p className="text-sm font-semibold">{avisoAnticipado(v.factor_anticipado)}.</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Faltan {formatoCuenta(Math.max(falta, 1) * 1000)} para la espera mínima de este apartado.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secundario" onClick={() => setModal(null)}>Seguir trabajando</button>
          <button type="button" className="btn-acento" onClick={() => accion(() => ses.confirmar({ anticipado: true }))}>Avanzar con la puntuación reducida</button>
        </div>
      </Modal>
      <Modal open={modal === 'omitir'} onClose={() => setModal(null)} title="Omitir apartado">
        <p className="text-sm font-semibold">{AVISO_OMITIR}.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secundario" onClick={() => setModal(null)}>Seguir trabajando</button>
          <button type="button" className="btn-acento" onClick={() => accion(() => ses.omitir())}>Omitir definitivamente</button>
        </div>
      </Modal>
      <Modal open={modal === 'vacia'} onClose={() => setModal(null)} title="Respuesta vacía">
        <p className="text-sm">Escriba o elija una respuesta antes de confirmar. Si no quiere responder este apartado, use «Omitir apartado» (vale 0).</p>
        <div className="mt-4 flex justify-end"><button type="button" className="btn-primario" onClick={() => setModal(null)}>Entendido</button></div>
      </Modal>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
export function Final({ r, e }: { r: ResumenPes; e: EstadoSesion }) {
  const res: PuntajeServidor | null = r.resultado;
  return (
    <section className="tarjeta space-y-3">
      {e.fase === 'completada'
        ? <Notice tone="ok">Terminó la práctica: cerró los {e.vista?.apartados_total ?? r.apartados} apartados. Sus respuestas están registradas.</Notice>
        : <Notice tone="warn">El plazo de la práctica terminó. Lo que confirmó antes del cierre está registrado.</Notice>}
      {e.aviso && <p className="text-sm text-gray-600 dark:text-gray-300">{e.aviso}</p>}
      {res ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs text-gray-500">Validada por el profesor</p><p className="text-2xl font-semibold">{puntos(res.validada.P)} <span className="text-sm font-normal text-gray-500">/ {puntos(res.P_max)}</span></p>
            {!res.validada.completa && <p className="text-xs text-gray-500">Aún hay apartados por validar.</p>}</div>
          <div><p className="text-xs text-gray-500">Provisional</p><p className="text-2xl font-semibold">{puntos(res.provisional.P)}</p>
            {res.pendientes_revision > 0 && <p className="text-xs text-gray-500">{res.pendientes_revision} apartado(s) pendientes de revisión cuentan 0 por ahora.</p>}</div>
          <div><p className="text-xs text-gray-500">Máxima alcanzable</p><p className="text-2xl font-semibold">{puntos(res.maxima_alcanzable.P)}</p></div>
          {res.control?.C !== null && res.control?.C !== undefined && (
            <p className="text-sm sm:col-span-3">Control presencial: resultado {puntos(res.control.C)} de 1
              {res.control.modo === 'ajuste' ? ` · factor ${res.control.factor.toFixed(2).replace('.', ',')} · validada con control ${puntos(res.control.validada_con_control)}` : ' (informativo)'}.</p>
          )}
        </div>
      ) : <p className="text-sm text-gray-600 dark:text-gray-300">La puntuación (informativa) se verá aquí cuando su profesor publique los resultados.</p>}
      <Link to="/evaluaciones" className="btn-secundario inline-flex">Volver a Evaluaciones</Link>
    </section>
  );
}
