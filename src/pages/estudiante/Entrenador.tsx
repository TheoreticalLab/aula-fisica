/**
 * Entrenador (migración 107): el estudiante pide un ejercicio, lo resuelve con corrección inmediata (N intentos) y, al
 * acertar, agotar los intentos o pedirla, ve la solución desarrollada. Siempre el mismo nivel; no cuenta para la nota.
 * La corrección la hace la Edge Function «entrenador» (la clave no llega al navegador).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { interpretNumeric } from '@calif/calificar.ts';
import { API_ENTRENADOR, esNoValida, type EjercicioEntrenador, type EstadoEntrenador, type ResumenEntrenador } from '@/api/entrenador';
import { useAction, useAsync } from '@/lib/util';
import { ErrorBox, Modal, Notice, PageTitle, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { BotonCalculadora, CalculadoraProvider } from '@/components/Calculadora';

const INACTIVIDAD_MS = 120_000;
const CLAVE_T = (e: string) => `entrenador:t:${e}`;
const CLAVE_TEMA = (id: string) => `entrenador:tema:${id}`;
const letra = (i: number) => String.fromCharCode(97 + i);

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

/** Tiempo activo del ejercicio, medido en este navegador: pestaña visible y alguna interacción en los últimos 2 min. */
function useTiempoActivo(ejercicio: string | null) {
  const acumulado = useRef(0);
  useEffect(() => {
    if (!ejercicio) return;
    try { acumulado.current = Number(localStorage.getItem(CLAVE_T(ejercicio)) ?? 0) || 0; } catch { acumulado.current = 0; }
    let ultimoTic = Date.now();
    let ultimaInteraccion = Date.now();
    const tocar = () => { ultimaInteraccion = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, tocar, { capture: true, passive: true }));
    const tic = () => {
      const t = Date.now();
      const dt = Math.min(t - ultimoTic, 10_000);
      ultimoTic = t;
      if (document.visibilityState === 'visible' && t - ultimaInteraccion < INACTIVIDAD_MS) {
        acumulado.current += dt;
        try { localStorage.setItem(CLAVE_T(ejercicio), String(Math.round(acumulado.current))); } catch { /* sin almacenamiento */ }
      }
    };
    const iv = window.setInterval(tic, 5000);
    return () => { tic(); window.clearInterval(iv); evs.forEach((e) => window.removeEventListener(e, tocar, { capture: true })); };
  }, [ejercicio]);
  return useCallback(() => Math.round(acumulado.current / 1000), []);
}

export default function Entrenador() {
  const { entrenadorId = '' } = useParams();
  const st = useAsync(() => API_ENTRENADOR.estado(entrenadorId), [entrenadorId]);
  const [estado, setEstado] = useState<EstadoEntrenador | null>(null);
  /** ejercicio recién cerrado: se muestra con su solución hasta pedir el siguiente */
  const [cerrado, setCerrado] = useState<EjercicioEntrenador | null>(null);
  const [tema, setTema] = useState<string | null>(() => { try { return localStorage.getItem(CLAVE_TEMA(entrenadorId)); } catch { return null; } });
  const act = useAction();
  useEffect(() => { if (st.data) setEstado(st.data); }, [st.data]);

  // `estado` se copia de st.data en un efecto (después del render): mientras tanto se usa st.data directamente
  const e = estado ?? st.data;
  if (!e) return st.error ? <ErrorBox error={st.error} onRetry={st.reload} /> : <Spinner />;
  const temaValido = tema && e.temas.some((t) => t.codigo === tema) ? tema : null;

  const elegirTema = (t: string | null) => {
    setTema(t);
    try { if (t) localStorage.setItem(CLAVE_TEMA(entrenadorId), t); else localStorage.removeItem(CLAVE_TEMA(entrenadorId)); } catch { /* nada */ }
  };
  async function siguiente() {
    const r = await act.run(() => API_ENTRENADOR.siguiente(entrenadorId, temaValido));
    if (!r) return;
    setCerrado(null);
    setEstado(r);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const alCerrar = (ej: EjercicioEntrenador, resumen?: ResumenEntrenador) => {
    try { localStorage.removeItem(CLAVE_T(ej.id)); } catch { /* nada */ }
    setCerrado(ej);
    setEstado((s) => (s ? { ...s, actual: null, resumen: resumen ?? s.resumen } : s));
  };
  const nombreTema = (c: string) => e.temas.find((t) => t.codigo === c)?.nombre ?? c;

  return (
    <CalculadoraProvider permitida>
      <div className="space-y-4">
        <PageTitle title={e.entrenador.titulo} subtitle="Entrenamiento libre: no cuenta para la nota." actions={<BotonCalculadora />} />
        {e.prueba && <Notice>Recorrido de prueba del profesor: no aparece en el informe.</Notice>}
        {e.entrenador.descripcion && !e.actual && !cerrado && <Markdown className="prosa max-w-3xl text-sm">{e.entrenador.descripcion}</Markdown>}
        <Resumen r={e.resumen} />

        {e.actual ? (
          <Ejercicio key={e.actual.id} ej={e.actual} tema={nombreTema(e.actual.tema)} onCerrado={alCerrar}
            onActualizado={(ej) => setEstado((s) => (s ? { ...s, actual: ej } : s))} />
        ) : (
          <>
            {cerrado && <Cerrado ej={cerrado} tema={nombreTema(cerrado.tema)} />}
            {e.temas.length > 1 && (
              <div className="tarjeta">
                <p className="etiqueta mb-2">Tema del próximo ejercicio</p>
                <div className="flex flex-wrap gap-2">
                  <Chip activo={!temaValido} onClick={() => elegirTema(null)}>Todos los temas</Chip>
                  {e.temas.map((t) => <Chip key={t.codigo} activo={temaValido === t.codigo} onClick={() => elegirTema(t.codigo)}>{t.nombre}</Chip>)}
                </div>
              </div>
            )}
            <button className="btn-primario min-h-[56px] w-full text-lg" disabled={act.busy} onClick={() => void siguiente()}>
              {act.busy ? 'Cargando…' : cerrado ? 'SIGUIENTE EJERCICIO' : 'ENTRENAR'}
            </button>
            <ErrorBox error={act.error} />
          </>
        )}
      </div>
    </CalculadoraProvider>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className={`min-h-[40px] rounded-full border px-3 text-sm ${activo ? 'border-primario-500 bg-primario-50 font-semibold text-primario-800 dark:bg-primario-500/20 dark:text-primario-100' : 'border-gray-300 dark:border-white/20'}`}>
      {children}
    </button>
  );
}

function Resumen({ r }: { r: ResumenEntrenador }) {
  if (!r.ejercicios) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Dato t="Ejercicios hechos" v={r.ejercicios} />
      <Dato t="Correctos" v={`${r.correctos} (${Math.round((r.correctos / r.ejercicios) * 100)} %)`} />
      <Dato t="Al primer intento" v={r.primer_intento} />
      <Dato t="Hoy" v={r.hoy} />
    </div>
  );
}
const Dato = ({ t, v }: { t: string; v: React.ReactNode }) => (
  <div className="tarjeta py-2 text-center"><div className="text-xl font-semibold">{v}</div><div className="text-xs text-gray-500">{t}</div></div>
);

function Ejercicio({ ej, tema, onCerrado, onActualizado }: {
  ej: EjercicioEntrenador; tema: string; onCerrado: (ej: EjercicioEntrenador, r?: ResumenEntrenador) => void; onActualizado: (ej: EjercicioEntrenador) => void;
}) {
  const segundos = useTiempoActivo(ej.id);
  const [partes, setPartes] = useState<string[]>(() => ej.partes.map(() => ''));
  const [invalida, setInvalida] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const act = useAction();
  const idem = useRef<string | null>(null);
  const listo = partes.every((x) => x.trim());
  const ultima = ej.respuestas[ej.respuestas.length - 1];
  const restantes = ej.intentos_max - ej.intentos;
  const lecturas = useMemo(() => partes.map((x) => (x.trim() ? interpretNumeric(x) : null)), [partes]);

  async function comprobar() {
    setInvalida([]);
    idem.current ??= uuid();
    const r = await act.run(() => API_ENTRENADOR.responder(ej.id, idem.current!, partes.map((x) => x.trim()), segundos()));
    if (!r) return;
    idem.current = null;
    if (esNoValida(r)) { setInvalida(r.mensajes); return; }
    if (r.ejercicio.estado !== 'abierto') { onCerrado(r.ejercicio, r.resumen); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    onActualizado(r.ejercicio);
  }
  async function verSolucion() {
    setConfirmar(false);
    const r = await act.run(() => API_ENTRENADOR.verSolucion(ej.id, segundos()));
    if (r) { onCerrado(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  return (
    <div className="tarjeta space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <span className="flex-1">{tema}</span>
        <span>Intento {Math.min(ej.intentos + 1, ej.intentos_max)} de {ej.intentos_max}</span>
      </div>
      <Markdown className="prosa text-base">{ej.enunciado}</Markdown>
      {ultima && !ultima.correcta && (
        <Notice tone="warn">
          <strong>No es correcto todavía.</strong> {restantes === 1 ? 'Le queda 1 intento.' : `Le quedan ${restantes} intentos.`}
          {ultima.detalle?.partes && (
            <ul className="mt-1 space-y-0.5">
              {ultima.detalle.partes.map((p, i) => (
                <li key={i}>
                  {ej.partes.length > 1 && <>({letra(i)}) </>}
                  <span className="font-mono">{ultima.partes[i]}</span>: {p.correcta ? '✔ correcto' : <>✖ incorrecto{p.mensaje ? <> — {p.mensaje}</> : null}</>}
                </li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); if (listo) void comprobar(); }}>
        {ej.partes.map((pt, i) => (
          <label key={i} className="block">
            <span className="etiqueta">{ej.partes.length > 1 ? `(${letra(i)}) ` : ''}{pt.etiqueta}{pt.unidad ? <span className="text-gray-500"> (en {pt.unidad})</span> : null}</span>
            <span className="flex items-center gap-2">
              <input className="campo font-mono" inputMode="decimal" autoComplete="off" spellCheck={false} maxLength={200} value={partes[i]}
                placeholder="Escriba el número" onChange={(ev) => setPartes((xs) => xs.map((x, k) => (k === i ? ev.target.value : x)))} />
              {pt.unidad && <span className="shrink-0 font-mono text-sm text-gray-600 dark:text-gray-400">{pt.unidad}</span>}
            </span>
            {lecturas[i] && !lecturas[i]!.ok && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">{lecturas[i]!.text}</span>}
          </label>
        ))}
        {invalida.length > 0 && <Notice tone="warn"><strong>No se comprobó (no gasta intento):</strong> {invalida.join(' ')}</Notice>}
        <ErrorBox error={act.error} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario min-h-[48px] flex-1" disabled={act.busy || !listo}>{act.busy ? 'Comprobando…' : 'COMPROBAR'}</button>
          <button type="button" className="btn-secundario min-h-[48px]" disabled={act.busy} onClick={() => setConfirmar(true)}>Ver la solución</button>
        </div>
        <p className="text-xs text-gray-500">Escriba solo el número en la unidad indicada (o el número con su unidad). Use g = 9.8 m/s² si el enunciado no dice otra cosa.</p>
      </form>
      <Modal open={confirmar} onClose={() => setConfirmar(false)} title="Ver la solución">
        <p className="text-sm">El ejercicio quedará como no resuelto y verá la solución completa. Después podrá pedir otro.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secundario min-h-[44px]" onClick={() => setConfirmar(false)}>Seguir intentando</button>
          <button className="btn-primario min-h-[44px]" disabled={act.busy} onClick={() => void verSolucion()}>Ver la solución</button>
        </div>
      </Modal>
    </div>
  );
}

function Cerrado({ ej, tema }: { ej: EjercicioEntrenador; tema: string }) {
  const ok = ej.estado === 'correcto';
  return (
    <div className="tarjeta space-y-3">
      <div className="text-sm text-gray-500">{tema}</div>
      <Notice tone={ok ? 'ok' : 'warn'}>
        {ok ? <strong>¡Correcto{ej.intentos === 1 ? ' al primer intento' : ''}!</strong>
          : ej.estado === 'agotado' ? <strong>Se agotaron los intentos. Revise la solución y pruebe con otro ejercicio.</strong>
          : <strong>Solución del ejercicio.</strong>}
      </Notice>
      <Markdown className="prosa text-base">{ej.enunciado}</Markdown>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Resultado</th>{ej.respuestas.map((r) => <th key={r.n} className="py-1 pr-3">Intento {r.n}</th>)}<th className="py-1">Valor correcto</th></tr></thead>
          <tbody>
            {ej.partes.map((pt, i) => (
              <tr key={i} className="border-t border-gray-200 dark:border-white/10">
                <td className="py-1 pr-3">{ej.partes.length > 1 ? `(${letra(i)}) ` : ''}{pt.etiqueta}</td>
                {ej.respuestas.map((r) => (
                  <td key={r.n} className="py-1 pr-3 font-mono">{r.partes[i]} {r.detalle?.partes?.[i] ? (r.detalle.partes[i].correcta ? '✔' : '✖') : ''}</td>
                ))}
                <td className="py-1 font-mono font-semibold">{ej.valores?.[i] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ej.solucion && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Solución</div>
          <Markdown className="prosa text-sm">{ej.solucion}</Markdown>
        </div>
      )}
    </div>
  );
}
