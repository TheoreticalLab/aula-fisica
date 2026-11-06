/**
 * Regularización obligatoria (migración 64): mientras el estudiante no termine la regularización de prácticas
 * anteriores en una sección con el bloqueo activado, el aula muestra solo esta pantalla (salvo la propia regularización
 * y el cambio de contraseña). El servidor ya rechaza todo lo demás (my_account_ok); esto es la explicación visible.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { miBloqueo, type SeccionBloqueo } from '@/api/regularizacion';
import { CONSUMO } from '@/lib/consumo';

export const EVENTO_REGULARIZACION = 'aula:regularizacion-cambio';
const PERMITIDAS = /^\/(practicas-anteriores|cambiar-clave)(\/|$)/;

/** Secciones que bloquean al estudiante; se vuelve a consultar al cambiar de página y al terminar la regularización. */
export function useBloqueoRegularizacion(activo: boolean) {
  const { pathname } = useLocation();
  const [secciones, setSecciones] = useState<SeccionBloqueo[]>([]);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const f = () => setRev((x) => x + 1);
    window.addEventListener(EVENTO_REGULARIZACION, f);
    return () => window.removeEventListener(EVENTO_REGULARIZACION, f);
  }, []);
  // modo de bajo consumo: al cambiar de página solo se vuelve a consultar si pasó un rato (el servidor ya impone el
  // bloqueo en cada petición; esto es la explicación visible). Al terminar una regularización (rev) se consulta siempre.
  const consulta = useRef({ t: 0, rev: -1, n: 0 });
  useEffect(() => () => { consulta.current.n++; }, []); // al desmontar se descartan las respuestas pendientes
  useEffect(() => {
    if (!activo) { setSecciones([]); consulta.current = { t: 0, rev: -1, n: consulta.current.n + 1 }; return; }
    const ahora = Date.now();
    if (consulta.current.rev === rev && ahora - consulta.current.t < CONSUMO.minEntreConsultasRutaMs) return;
    const n = consulta.current.n + 1;
    consulta.current = { t: ahora, rev, n };
    // la respuesta vale mientras no haya otra consulta más nueva (no se descarta por cambiar de página)
    miBloqueo().then((s) => consulta.current.n === n && setSecciones(s)).catch(() => undefined);
  }, [activo, pathname, rev]);
  return { bloqueado: secciones.length > 0, secciones, permitida: PERMITIDAS.test(pathname) };
}

export function PantallaBloqueo({ secciones, onSalir }: { secciones: SeccionBloqueo[]; onSalir: () => void }) {
  return (
    <div className="mx-auto max-w-lg tarjeta">
      <p className="text-3xl" aria-hidden="true">🗂️</p>
      <h1 className="mb-2 font-serif text-xl font-semibold">Primero termina la regularización de prácticas</h1>
      <p className="text-sm">Tu profesor activó la regularización obligatoria. Hasta que la termines no podrás usar el aula: ni prácticas, ni evaluaciones,
        ni asistencia, ni notas. En cuanto pulses «Terminar la regularización», todo vuelve a la normalidad.</p>
      <ul className="mt-3 list-disc pl-5 text-sm">
        {secciones.map((s) => <li key={s.class_id}><strong>{s.course_title}</strong> · {s.class_name}{s.mensaje ? <span className="block text-gray-600 dark:text-gray-300">{s.mensaje}</span> : null}</li>)}
      </ul>
      <p className="mt-2 text-xs text-gray-500">Si no tienes prácticas anteriores que regularizar, entra y márcalo: también cuenta como terminar. Terminar no es una calificación.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/practicas-anteriores" className="btn-primario">Ir a la regularización</Link>
        <button className="btn-secundario" onClick={onSalir}>Salir</button>
      </div>
    </div>
  );
}
