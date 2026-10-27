/**
 * Aviso para el estudiante cuando el profesor abre la asistencia de una de sus secciones y aún no está presente.
 * Consulta cada 30 s (solo con la pestaña visible); nunca recibe el código.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { rpc } from '@/lib/supabase';

interface Abierta { session_id: string; clase: string; asignatura: string; code_expires_at: string; presente: boolean }

export function AvisoAsistencia() {
  const [pendientes, setPendientes] = useState<Abierta[]>([]);
  const { pathname } = useLocation();
  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      if (document.visibilityState !== 'visible') return;
      rpc<Abierta[]>('my_open_attendance')
        .then((d) => vivo && setPendientes(d.filter((x) => !x.presente)))
        .catch(() => undefined);
    };
    cargar();
    const t = window.setInterval(cargar, 30_000);
    document.addEventListener('visibilitychange', cargar);
    return () => { vivo = false; window.clearInterval(t); document.removeEventListener('visibilitychange', cargar); };
  }, [pathname]);
  if (!pendientes.length || pathname === '/asistencia') return null;
  return (
    <Link to="/asistencia" className="fixed inset-x-3 top-3 z-50 mx-auto block max-w-lg rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <p className="font-semibold">📋 El profesor abrió la asistencia</p>
      <p className="text-sm">{pendientes.map((p) => `${p.asignatura} · ${p.clase}`).join(', ')} — toque aquí y escriba el código para quedar presente.</p>
    </Link>
  );
}
