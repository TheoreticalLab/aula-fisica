/**
 * Botón «Asistencia» del inicio del estudiante. Gris e inactivo si el profesor no ha abierto la asistencia;
 * resaltado cuando hay una abierta en una de sus secciones. Se actualiza solo cada 20 s.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { misAsistenciasAbiertas, type AsistenciaAbiertaMia } from '@/api/asistencia';

export function BotonAsistencia() {
  const [abiertas, setAbiertas] = useState<AsistenciaAbiertaMia[]>([]);
  useEffect(() => {
    let vivo = true;
    const cargar = () => document.visibilityState === 'visible' && void misAsistenciasAbiertas().then((d) => vivo && setAbiertas(d)).catch(() => undefined);
    cargar();
    const t = window.setInterval(cargar, 20_000);
    document.addEventListener('visibilitychange', cargar);
    return () => { vivo = false; window.clearInterval(t); document.removeEventListener('visibilitychange', cargar); };
  }, []);
  const pendientes = abiertas.filter((a) => !a.presente);
  const presente = abiertas.length > 0 && pendientes.length === 0;

  if (pendientes.length) {
    return (
      <Link to="/asistencia" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-green-500 bg-green-50 px-5 py-4 shadow-sm hover:bg-green-100 dark:border-green-600 dark:bg-green-950/40 dark:hover:bg-green-900/40">
        <span>
          <span className="block font-serif text-lg font-semibold">📋 Asistencia abierta</span>
          <span className="block text-sm text-gray-700 dark:text-gray-300">{pendientes.map((a) => `${a.asignatura} · ${a.clase}`).join(', ')}: escriba el código del profesor.</span>
        </span>
        <span className="btn-primario whitespace-nowrap">Marcar asistencia</span>
      </Link>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-gray-500 dark:border-white/10 dark:bg-white/5" aria-disabled="true">
      <span>
        <span className="block font-serif text-lg font-semibold">📋 Asistencia</span>
        <span className="block text-sm">{presente ? '✓ Ya está presente en la clase de hoy.' : 'No hay asistencia abierta ahora. Se activará cuando el profesor la abra en clase.'}</span>
      </span>
      <span className="cursor-not-allowed whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-white/20">{presente ? 'Presente ✓' : 'Marcar asistencia'}</span>
    </div>
  );
}
