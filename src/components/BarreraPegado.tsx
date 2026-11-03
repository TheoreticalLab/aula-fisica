/**
 * Barrera ordinaria de pegado y arrastre para campos de respuesta (Práctica Extraordinaria Secuencial).
 * Es una barrera de INTERACCIÓN, no una garantía contra el uso de otras herramientas: no lee el portapapeles, no
 * registra lo que se intentó pegar y no toca nada fuera de la página. Dictado, autocorrección y teclados de entrada
 * (IME) no son pegado y siempre funcionan; con la adaptación «pegado permitido» no se bloquea nada.
 * Usa los eventos nativos en captura (paste, drop, beforeinput): el onBeforeInput de React no expone inputType.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { decidirEntrada } from '@/lib/pesSesion';

export function BarreraPegado({ permitido, onBloqueo, children }: {
  permitido: boolean;
  onBloqueo: (tipo: 'pegado' | 'arrastre') => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const aviso = useRef(onBloqueo);
  aviso.current = onBloqueo;
  useEffect(() => {
    const el = ref.current;
    if (!el || permitido) return;
    const pegar = (e: Event) => { e.preventDefault(); aviso.current('pegado'); };
    const soltar = (e: Event) => { e.preventDefault(); aviso.current('arrastre'); };
    const entrada = (e: Event) => {
      const d = decidirEntrada((e as InputEvent).inputType ?? '', false);
      if (d !== 'permitir') { e.preventDefault(); aviso.current(d); }
    };
    const arrastrar = (e: Event) => e.preventDefault();      // sin esto algunos navegadores insertan al soltar
    el.addEventListener('paste', pegar, true);
    el.addEventListener('drop', soltar, true);
    el.addEventListener('dragover', arrastrar, true);
    el.addEventListener('beforeinput', entrada, true);
    return () => {
      el.removeEventListener('paste', pegar, true);
      el.removeEventListener('drop', soltar, true);
      el.removeEventListener('dragover', arrastrar, true);
      el.removeEventListener('beforeinput', entrada, true);
    };
  }, [permitido]);
  return <div ref={ref}>{children}</div>;
}
