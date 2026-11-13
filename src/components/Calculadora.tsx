/**
 * Calculadora científica integrada (migración 93: activities.calculadora, desactivada por defecto).
 *  · CalculadoraProvider: se monta una vez por intento (Intento.tsx), así que la calculadora conserva su estado al
 *    cambiar de pregunta, cerrarla y volver a abrirla. Si la actividad no la permite, no se muestra nada.
 *  · BotonCalculadora: el botón «🧮 Calculadora» (barra del examen o barra inferior de la práctica). Sin proveedor o
 *    sin permiso, no renderiza nada (vista previa del profesor, revisión de intentos, otras páginas).
 * El panel se carga la primera vez que se abre (import diferido) y nunca consulta al servidor.
 */
import { createContext, lazy, Suspense, useContext, useMemo, useState, type ReactNode } from 'react';

const Panel = lazy(() => import('./CalculadoraPanel'));

interface Ctx { abierta: boolean; alternar: () => void }
const Contexto = createContext<Ctx | null>(null);

export function CalculadoraProvider({ permitida, children }: { permitida: boolean; children: ReactNode }) {
  const [abierta, setAbierta] = useState(false);
  const [cargada, setCargada] = useState(false);
  const valor = useMemo<Ctx>(() => ({ abierta, alternar: () => { setCargada(true); setAbierta((a) => !a); } }), [abierta]);
  if (!permitida) return <>{children}</>;
  return (
    <Contexto.Provider value={valor}>
      {children}
      {cargada && <Suspense fallback={null}><Panel abierta={abierta} onCerrar={() => setAbierta(false)} /></Suspense>}
    </Contexto.Provider>
  );
}

export function BotonCalculadora({ className = '' }: { className?: string }) {
  const c = useContext(Contexto);
  if (!c) return null;
  return (
    <button type="button" onClick={c.alternar} aria-pressed={c.abierta} aria-label={c.abierta ? 'Cerrar la calculadora' : 'Abrir la calculadora'}
      className={`btn-secundario min-h-[40px] text-sm ${c.abierta ? 'ring-2 ring-primario-300 dark:ring-primario-600' : ''} ${className}`}>🧮 Calculadora</button>
  );
}
