import type { ReactNode } from 'react';

/**
 * Tarjeta flotante discreta (abajo a la derecha; en el teléfono, por encima de la barra de navegación). La usan
 * los mensajes informativos del profesor y Orbe IA: no tapa la página ni le quita el foco.
 */
export function TarjetaEmergente({ children, etiqueta, className = '' }: { children: ReactNode; etiqueta: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={etiqueta}
      className={`fixed bottom-20 right-3 z-[60] w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-primario-200 bg-white p-4 shadow-xl dark:border-white/15 dark:bg-primario-950 md:bottom-6 ${className}`}>
      {children}
    </div>
  );
}
