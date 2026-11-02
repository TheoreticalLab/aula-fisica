/**
 * «Aviso de verificación de aprendizaje» de una práctica con política de Práctica de Control (migración 62).
 * Se muestra desde que el profesor anuncia la política; muestra la versión vigente y, si el estudiante ya entregó, la
 * versión que se le aplicará (la anunciada antes de su primera entrega: nunca se cambian las reglas hacia atrás).
 */
import { useEffect, useState } from 'react';
import { controlAviso, type AvisoControl } from '@/api/control';
import { AVISO_VERIFICACION, ejemploAjuste, PROCEDIMIENTO_INCIDENCIAS } from '@/lib/control';

export function AvisoVerificacion({ activityId }: { activityId: string }) {
  const [a, setA] = useState<AvisoControl | null>(null);
  useEffect(() => { void controlAviso(activityId).then(setA).catch(() => setA(null)); }, [activityId]);
  if (!a) return null;
  const pct = Math.round(100 * a.w);
  const ej = ejemploAjuste(a.w);
  return (
    <section className="mt-3 rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100" aria-label="Aviso de verificación de aprendizaje">
      <p className="font-semibold">🔎 Aviso de verificación de aprendizaje</p>
      <p className="mt-1">«{AVISO_VERIFICACION}»</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><strong>Ajuste máximo:</strong> {pct} % de la nota de esta práctica. Nota final = nota de la práctica × [1 − {(a.w).toFixed(2)} × (1 − control/100)].
          Ejemplo: {ej.original} en la práctica y {ej.control}/100 en el control → {ej.final}. Con 100/100 conservas tu nota.</li>
        <li><strong>Duración del control:</strong> unos {a.duracion_min} minutos, individual y en el aula, con un problema nuevo sobre lo trabajado (no una copia de la práctica).</li>
        {a.condiciones && <li><strong>Condiciones:</strong> {a.condiciones}</li>}
        <li><strong>IA y otras ayudas en la práctica:</strong> {a.politica_ayudas || 'Las indicadas por el profesor en las instrucciones.'} Declarar una ayuda no es una falta; el control solo comprueba lo aprendido.</li>
        <li><strong>Incidencias y revisión:</strong> {PROCEDIMIENTO_INCIDENCIAS}</li>
        <li>Si no hay un control confirmado, tu nota no cambia. Una nota baja en el control no se considera prueba de uso indebido de IA.</li>
      </ul>
      <p className="mt-2 text-xs opacity-80">Política versión {a.version}, anunciada el {new Date(a.announced_at).toLocaleString('es-DO')}.
        {a.alcance === 'todas'
          ? ` Se aplica a todas las entregas de esta práctica, también a las anteriores, en los controles realizados desde el ${a.efectiva_desde ? new Date(a.efectiva_desde).toLocaleString('es-DO') : '—'}.`
          : a.aplicable_a_mi ? ` A tu entrega se le aplica la versión ${a.aplicable_a_mi.version} (${Math.round(100 * a.aplicable_a_mi.w)} %).` : ' Se aplica a las entregas hechas desde su anuncio.'}</p>
    </section>
  );
}
