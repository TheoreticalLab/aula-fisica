/**
 * Práctica secuencial (migración 110): un ejercicio a la vez, en orden al azar fijo por intento, sin pasar al
 * siguiente hasta cerrar el actual (correcto, sin intentos o con la solución vista). Al cerrarlo el estudiante ve el
 * resultado y pulsa «Siguiente ejercicio». Si acierta antes del umbral de su dificultad, aparece el aviso del profesor
 * y puede continuar. El tiempo se mide en el navegador desde que el ejercicio aparece y se guarda localmente para que
 * recargar no lo reinicie. No cambia la calificación.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttemptItem, AttemptView } from '@/api/tipos';
import { Ejercicio } from '@/components/Ejercicio';
import { avisoRapidez, ordenPractica, posicionActual, type ConfigSecuencial } from '@/lib/practicaSecuencial';

const CLAVE = (attempt: string, ex: string) => `aula:secuencial:${attempt}:${ex}`;

function leerInicio(attempt: string, ex: string): number | null {
  try {
    const v = window.localStorage.getItem(CLAVE(attempt, ex));
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
function guardarInicio(attempt: string, ex: string, t: number) {
  try { window.localStorage.setItem(CLAVE(attempt, ex), String(t)); } catch { /* sin almacenamiento: queda en memoria */ }
}

export const cerrado = (it: AttemptItem) =>
  it.locked || it.response?.status === 'correct' || it.response?.status === 'revealed' || !!it.response?.solution_revealed;

export function PracticaSecuencial({ view, config, onItem, onReload }: {
  view: AttemptView;
  config: ConfigSecuencial;
  onItem: (index: number, it: AttemptItem) => void;
  onReload: () => void;
}) {
  const n = view.items.length;
  const orden = useMemo(() => ordenPractica(n, view.attempt.id, config.aleatorio), [n, view.attempt.id, config.aleatorio]);
  const cerrados = view.items.map(cerrado);
  const k = posicionActual(cerrados, orden);
  const abierto = k < n ? orden[k] : -1; // primer ejercicio aún abierto, en el orden del intento
  // ejercicio en pantalla: se queda el que acaba de cerrarse hasta que pulse «Siguiente»
  const [vistaId, setVistaId] = useState<string | null>(null);
  const vistaIdx = vistaId ? view.items.findIndex((x) => x.exercise.id === vistaId) : -1;
  const mostrar = vistaIdx >= 0 ? vistaIdx : abierto;
  useEffect(() => {
    if (vistaIdx < 0 && abierto >= 0) setVistaId(view.items[abierto].exercise.id);
  }, [vistaIdx, abierto, view.items]);

  const inicios = useRef<Record<string, number>>({});
  const [aviso, setAviso] = useState(false);
  const enPantalla = mostrar >= 0 ? view.items[mostrar] : null;
  const idEnPantalla = enPantalla?.exercise.id ?? null;
  const abiertoEnPantalla = !!enPantalla && !cerrado(enPantalla);
  // el reloj del ejercicio empieza cuando aparece abierto por primera vez
  useEffect(() => {
    if (!idEnPantalla || !abiertoEnPantalla) return;
    const previo = inicios.current[idEnPantalla] ?? leerInicio(view.attempt.id, idEnPantalla);
    const t = previo ?? Date.now();
    inicios.current[idEnPantalla] = t;
    if (previo === null) guardarInicio(view.attempt.id, idEnPantalla, t);
  }, [idEnPantalla, abiertoEnPantalla, view.attempt.id]);

  const cambiar = (idx: number) => (nuevo: AttemptItem) => {
    const antes = view.items[idx];
    const inicio = inicios.current[nuevo.exercise.id];
    if (inicio !== undefined) {
      const segundos = (Date.now() - inicio) / 1000;
      if (avisoRapidez(config, nuevo.exercise.difficulty, segundos, antes.response?.status, nuevo.response?.status)) setAviso(true);
    }
    onItem(idx, nuevo);
  };

  const hechos = cerrados.filter(Boolean).length;
  const numero = mostrar >= 0 ? orden.indexOf(mostrar) : n - 1;
  const haySiguiente = abierto >= 0 && abierto !== mostrar;
  return (
    <div className="space-y-4">
      <div className="tarjeta !py-2">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium">Ejercicio {numero + 1} de {n} · {hechos} cerrados</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
            <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(100 * hechos) / n}%` }} />
          </span>
        </div>
        <p className="text-xs text-gray-500">Los ejercicios aparecen de uno en uno. El siguiente se abre cuando cierra el actual: al acertarlo, al agotar los intentos o al ver la solución.</p>
      </div>
      {enPantalla && (
        <div key={enPantalla.exercise.id}>
          <Ejercicio index={numero} item={enPantalla} view={view} onChange={cambiar(mostrar)} onReload={onReload} />
        </div>
      )}
      {enPantalla && cerrado(enPantalla) && haySiguiente && (
        <div className="flex justify-end">
          <button className="btn-acento min-h-[44px]" onClick={() => { setVistaId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Siguiente ejercicio →</button>
        </div>
      )}
      {abierto < 0 && <div className="tarjeta text-sm">Completó los {n} ejercicios. Ya puede entregar la práctica.</div>}
      {aviso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="aviso-rapidez" className="tarjeta w-full max-w-md space-y-4 bg-white dark:bg-gray-900">
            <h2 id="aviso-rapidez" className="text-lg font-bold">Aviso</h2>
            <p>{config.aviso}</p>
            <div className="flex justify-end">
              <button className="btn-acento min-h-[44px] min-w-[120px]" onClick={() => setAviso(false)}>Continuar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
