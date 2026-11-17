/**
 * Código de entrada rotativo de una evaluación (migración 100): el profesor lo ve aquí y se lo dice al estudiante que va
 * a empezar. Lo calcula el servidor (cambia cada minuto; vale el actual y el anterior). Si la evaluación no lo usa, no
 * se muestra nada.
 */
import { useEffect, useState } from 'react';
import { examCodigoEntrada, funcionAusente, type CodigoEntrada as Codigo } from '@/api/examen';
import { Card } from '@/components/ui';

export function CodigoEntrada({ activityId }: { activityId: string }) {
  const [c, setC] = useState<Codigo | null>(null);
  const [desfase, setDesfase] = useState(0);   // reloj del servidor − reloj del dispositivo
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    let vivo = true;
    let t: number | undefined;
    const cargar = async () => {
      try {
        const r = await examCodigoEntrada(activityId);
        if (!vivo) return;
        setC(r);
        if (r.ahora) setDesfase(new Date(r.ahora).getTime() - Date.now());
        // se vuelve a pedir justo cuando cambia (o cada 30 s si algo falla)
        const espera = r.cambia_at && r.ahora ? new Date(r.cambia_at).getTime() - new Date(r.ahora).getTime() + 300 : 30_000;
        t = window.setTimeout(cargar, Math.max(1000, Math.min(espera, 130_000)));
      } catch (e) {
        if (!vivo || funcionAusente(e)) return;
        t = window.setTimeout(cargar, 10_000);
      }
    };
    void cargar();
    const tic = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => { vivo = false; window.clearTimeout(t); window.clearInterval(tic); };
  }, [activityId]);
  if (!c?.activo || !c.codigo) return null;
  const quedan = c.cambia_at ? Math.max(0, Math.round((new Date(c.cambia_at).getTime() - (ahora + desfase)) / 1000)) : null;
  return (
    <Card className="mb-4" title="Código de entrada">
      <div className="flex flex-wrap items-center gap-4">
        <div className="font-mono text-5xl font-bold tracking-[0.3em]" aria-live="polite">{c.codigo}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {quedan !== null && <p>Cambia en <strong>{quedan} s</strong> (el anterior sigue valiendo un minuto más).</p>}
          <p>Dígaselo al estudiante cuando vaya a empezar. Solo se pide para comenzar, no para continuar.</p>
        </div>
      </div>
    </Card>
  );
}
